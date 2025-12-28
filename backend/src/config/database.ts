import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
config();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5433', 10),
  username: process.env.POSTGRES_USER || 'algojuke_user',
  password: process.env.POSTGRES_PASSWORD || 'changeme',
  database: process.env.POSTGRES_DB || 'algojuke',

  // Connection pool settings
  poolSize: 10,
  extra: {
    max: 20, // Max pool clients
    min: 2,  // Min pool clients
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 30000,
  },

  // Entity and migration paths
  entities: [path.join(__dirname, '../entities/**/*.{ts,js}')],
  migrations: [path.join(__dirname, '../migrations/**/*.{ts,js}')],

  // CRITICAL: never synchronize in production
  synchronize: false,
  migrationsRun: process.env.NODE_ENV === 'production',

  // Logging configuration
  logging: process.env.DB_LOGGING === 'true' ? ['query', 'error'] : ['error'],

  // Migration settings
  migrationsTableName: 'migrations',
};

// Create DataSource instance
export const AppDataSource = new DataSource(dataSourceOptions);

/**
 * Initialize database connection with retry logic and exponential backoff
 * @param maxRetries Maximum number of connection retry attempts
 * @param initialDelay Initial delay in milliseconds before first retry
 */
export async function initializeDatabase(
  maxRetries: number = 5,
  initialDelay: number = 1000
): Promise<void> {
  let attempt = 0;
  let delay = initialDelay;

  while (attempt < maxRetries) {
    try {
      console.log(`Attempting to connect to database (attempt ${attempt + 1}/${maxRetries})...`);
      await AppDataSource.initialize();
      console.log('Database connection established successfully');
      return;
    } catch (error) {
      attempt++;

      if (attempt >= maxRetries) {
        console.error('Failed to connect to database after maximum retries');
        throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      console.warn(`Database connection attempt ${attempt} failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Exponential backoff with jitter
      delay = Math.min(delay * 2 + Math.random() * 1000, 30000);
    }
  }
}
