import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import { CacheService } from './services/cacheService.js';
import { TidalTokenService } from './services/tidalTokenService.js';
import { TidalService } from './services/tidalService.js';
import { searchResolver } from './resolvers/searchResolver.js';
import { logger } from './utils/logger.js';

// Load environment variables
config();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load GraphQL schema
const typeDefs = readFileSync(
  join(__dirname, 'schema', 'schema.graphql'),
  'utf-8'
);

// Initialize services
const cache = new CacheService(parseInt(process.env.SEARCH_CACHE_TTL || '3600'));
const tokenService = new TidalTokenService();
const tidalService = new TidalService(tokenService);

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers: searchResolver,
});

// Start server
const port = parseInt(process.env.PORT || '4000');

startStandaloneServer(server, {
  listen: { port },
  context: async () => ({
    tidalService,
    cache,
  }),
})
  .then(({ url }) => {
    logger.info('server_started', { url });
    console.log(`🚀 Server ready at ${url}`);
  })
  .catch((error) => {
    logger.error('server_start_failed', { error: String(error) });
    console.error('Failed to start server:', error);
    process.exit(1);
  });
