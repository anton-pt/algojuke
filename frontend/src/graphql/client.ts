import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";

// Use relative path to go through Vite proxy (which handles CORS and auth cookies)
// In production, VITE_GRAPHQL_ENDPOINT should be set to the API server URL
const graphqlEndpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT || "/graphql";

// Create HTTP link for GraphQL endpoint
const httpLink = new HttpLink({
  uri: graphqlEndpoint,
  // Include credentials (cookies) for authentication
  credentials: "include",
});

// Create Apollo Client instance
export const apolloClient = new ApolloClient({
  link: httpLink,
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
