import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import { CacheService } from './services/cacheService.js';
import { TidalTokenService } from './services/tidalTokenService.js';
import { TidalService } from './services/tidalService.js';
import { LibraryService } from './services/libraryService.js';
import { searchResolver } from './resolvers/searchResolver.js';
import { libraryResolvers } from './resolvers/library.js';
import { logger } from './utils/logger.js';
import { initializeDatabase, AppDataSource } from './config/database.js';
import { LibraryAlbum } from './entities/LibraryAlbum.js';
import { LibraryTrack } from './entities/LibraryTrack.js';

// Load environment variables
config();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load GraphQL schemas
const searchSchema = readFileSync(
  join(__dirname, 'schema', 'schema.graphql'),
  'utf-8'
);

const librarySchema = readFileSync(
  join(__dirname, 'schema', 'library.graphql'),
  'utf-8'
);

const typeDefs = [searchSchema, librarySchema];

// Initialize services (these will be created fresh after DB initialization)
const cache = new CacheService(parseInt(process.env.SEARCH_CACHE_TTL || '3600'));
const tokenService = new TidalTokenService();
const tidalService = new TidalService(tokenService);

// Merge resolvers from search and library
const mergedResolvers = {
  Query: {
    ...searchResolver.Query,
    ...libraryResolvers.Query,
  },
  Mutation: {
    ...libraryResolvers.Mutation,
  },
  AddAlbumToLibraryResult: libraryResolvers.AddAlbumToLibraryResult,
  AddTrackToLibraryResult: libraryResolvers.AddTrackToLibraryResult,
  LibraryAlbum: libraryResolvers.LibraryAlbum,
  LibraryTrack: libraryResolvers.LibraryTrack,
};

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers: mergedResolvers,
});

// Start server
const port = parseInt(process.env.PORT || '4000');

async function startServer() {
  try {
    // Initialize database connection
    await initializeDatabase();
    logger.info('database_initialized', { message: 'Database connection established' });

    // Initialize library service with repositories
    const albumRepository = AppDataSource.getRepository(LibraryAlbum);
    const trackRepository = AppDataSource.getRepository(LibraryTrack);
    const libraryService = new LibraryService(albumRepository, trackRepository, tidalService);

    // Start Apollo Server
    const { url } = await startStandaloneServer(server, {
      listen: { port },
      context: async () => ({
        tidalService,
        cache,
        libraryService,
        dataSources: {
          db: AppDataSource,
        },
      }),
    });

    logger.info('server_started', { url });
    console.log(`🚀 Server ready at ${url}`);
  } catch (error) {
    logger.error('server_start_failed', { error: String(error) });
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
