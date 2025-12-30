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
import { IngestionScheduler } from './services/ingestionScheduler.js';
import { createBackendQdrantClient } from './clients/qdrantClient.js';
import { searchResolver } from './resolvers/searchResolver.js';
import { libraryResolvers } from './resolvers/library.js';
import { trackMetadataResolvers } from './resolvers/trackMetadata.js';
import { TrackMetadataService } from './services/trackMetadataService.js';
import { createIsrcDataLoader } from './loaders/isrcDataLoader.js';
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

const trackMetadataSchema = readFileSync(
  join(__dirname, 'schema', 'trackMetadata.graphql'),
  'utf-8'
);

const typeDefs = [searchSchema, librarySchema, trackMetadataSchema];

// Initialize services (these will be created fresh after DB initialization)
const cache = new CacheService(parseInt(process.env.SEARCH_CACHE_TTL || '3600'));
const tokenService = new TidalTokenService();
const tidalService = new TidalService(tokenService);

// Merge resolvers from search, library, and track metadata
const mergedResolvers = {
  Query: {
    ...searchResolver.Query,
    ...libraryResolvers.Query,
    ...trackMetadataResolvers.Query,
  },
  Mutation: {
    ...libraryResolvers.Mutation,
  },
  AddAlbumToLibraryResult: libraryResolvers.AddAlbumToLibraryResult,
  AddTrackToLibraryResult: libraryResolvers.AddTrackToLibraryResult,
  LibraryAlbum: libraryResolvers.LibraryAlbum,
  LibraryTrack: {
    ...libraryResolvers.LibraryTrack,
    ...trackMetadataResolvers.LibraryTrack,
  },
  TrackInfo: trackMetadataResolvers.TrackInfo,
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

    // Initialize library service with repositories and ingestion scheduler
    const albumRepository = AppDataSource.getRepository(LibraryAlbum);
    const trackRepository = AppDataSource.getRepository(LibraryTrack);

    // Initialize Qdrant client and ingestion scheduler for automatic track ingestion
    const qdrantClient = createBackendQdrantClient();
    const ingestionScheduler = new IngestionScheduler(qdrantClient);
    logger.info('ingestion_scheduler_initialized', {
      qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
    });

    // Initialize track metadata service for extended metadata display
    const trackMetadataService = new TrackMetadataService(qdrantClient);
    logger.info('track_metadata_service_initialized');

    const libraryService = new LibraryService(
      albumRepository,
      trackRepository,
      tidalService,
      ingestionScheduler
    );

    // Start Apollo Server
    const { url } = await startStandaloneServer(server, {
      listen: { port },
      context: async () => ({
        tidalService,
        cache,
        libraryService,
        trackMetadataService,
        // Create a new DataLoader per request for proper batching and caching
        isrcDataLoader: createIsrcDataLoader(trackMetadataService),
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
