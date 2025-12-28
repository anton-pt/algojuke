import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

// Get GraphQL endpoint from environment or use default
const graphqlEndpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

// Create HTTP link for GraphQL endpoint
const httpLink = new HttpLink({
  uri: graphqlEndpoint,
});

// Create Apollo Client instance
export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
    query: {
      fetchPolicy: 'cache-first',
      errorPolicy: 'all',
    },
  },
});
