/**
 * Apollo Provider with Clerk Authentication
 *
 * Provides Apollo Client with:
 * - Automatic JWT token injection from Clerk on all requests (T031)
 * - UNAUTHENTICATED error handling with redirect to sign-in (T032)
 *
 * Feature: 018-per-user-library
 */

import { useMemo, type ReactNode } from "react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import {
  ApolloClient,
  ApolloProvider,
  InMemoryCache,
  HttpLink,
  from,
  type ApolloLink,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";

interface ApolloProviderWithAuthProps {
  children: ReactNode;
}

// Use relative path to go through Vite proxy (which handles CORS)
// In production, VITE_GRAPHQL_ENDPOINT should be set to the API server URL
const graphqlEndpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT || "/graphql";

/**
 * Apollo Provider that injects Clerk JWT tokens and handles auth errors
 *
 * Note: The useMemo dependency on [getToken, signOut] is safe because Clerk's
 * useAuth and useClerk hooks return stable function references that don't change
 * between renders. This ensures the Apollo client is not recreated unnecessarily.
 */
export function ApolloProviderWithAuth({
  children,
}: ApolloProviderWithAuthProps) {
  const { getToken } = useAuth();
  const { signOut } = useClerk();

  const client = useMemo(() => {
    // HTTP link for GraphQL endpoint
    const httpLink = new HttpLink({
      uri: graphqlEndpoint,
      credentials: "include",
    });

    // Auth context link - adds JWT to every request (T031)
    const authLink = setContext(async (_, { headers }) => {
      try {
        // Get fresh JWT from Clerk
        const token = await getToken();

        return {
          headers: {
            ...headers,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        };
      } catch {
        // If token retrieval fails, continue without auth header
        // The server will return UNAUTHENTICATED which will trigger redirect
        return { headers };
      }
    });

    // Error link - handles UNAUTHENTICATED errors (T032)
    const errorLink = onError(({ graphQLErrors, networkError }) => {
      if (graphQLErrors) {
        for (const error of graphQLErrors) {
          if (error.extensions?.code === "UNAUTHENTICATED") {
            // Sign out and redirect to landing page
            signOut({ redirectUrl: "/" });
            return;
          }
        }
      }

      // Log network errors for debugging
      if (networkError) {
        console.error("[Apollo Network Error]:", networkError);
      }
    });

    // Compose links: error handling -> auth injection -> HTTP
    const link: ApolloLink = from([errorLink, authLink, httpLink]);

    return new ApolloClient({
      link,
      cache: new InMemoryCache(),
      defaultOptions: {
        watchQuery: {
          fetchPolicy: "cache-and-network",
        },
        query: {
          fetchPolicy: "cache-first",
          errorPolicy: "all",
        },
      },
    });
  }, [getToken, signOut]);

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
