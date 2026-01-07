import "reflect-metadata";
import { DataSource, DataSourceOptions, LogLevel } from "typeorm";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Load environment variables
config();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Common options shared between URL and individual configs
const commonOptions = {
  // Connection pool settings
  poolSize: 10,
  extra: {
    max: 20, // Max pool clients
    min: 2, // Min pool clients
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  },

  // Entity and migration paths
  entities: [path.join(__dirname, "../entities/**/*.{ts,js}")],
  migrations: [path.join(__dirname, "../migrations/**/*.{ts,js}")],

  // CRITICAL: never synchronize in production
  synchronize: false,
  migrationsRun: process.env.NODE_ENV === "production",

  // Logging configuration
  logging: (process.env.DB_LOGGING === "true"
    ? ["query", "error"]
    : ["error"]) as LogLevel[],

  // Migration settings
  migrationsTableName: "migrations",
};

// Build DataSourceOptions from DATABASE_URL or individual env vars
const buildDataSourceOptions = (): DataSourceOptions => {
  if (process.env.DATABASE_URL) {
    // Use DATABASE_URL (supports Cloud SQL Unix sockets via ?host= parameter)
    return {
      type: "postgres",
      url: process.env.DATABASE_URL,
      ...commonOptions,
    };
  }
  // Fall back to individual env vars for local development
  return {
    type: "postgres",
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5433", 10),
    username: process.env.POSTGRES_USER || "algojuke_user",
    password: process.env.POSTGRES_PASSWORD || "changeme",
    database: process.env.POSTGRES_DB || "algojuke",
    ...commonOptions,
  };
};

export const dataSourceOptions: DataSourceOptions = buildDataSourceOptions();

// Create DataSource instance
export const AppDataSource = new DataSource(dataSourceOptions);

/**
 * Initialize database connection with retry logic and exponential backoff
 * @param maxRetries Maximum number of connection retry attempts
 * @param initialDelay Initial delay in milliseconds before first retry
 */
export async function initializeDatabase(
  maxRetries: number = 5,
  initialDelay: number = 1000,
): Promise<void> {
  let attempt = 0;
  let delay = initialDelay;

  while (attempt < maxRetries) {
    try {
      console.log(
        `Attempting to connect to database (attempt ${attempt + 1}/${maxRetries})...`,
      );
      await AppDataSource.initialize();
      console.log("Database connection established successfully");
      return;
    } catch (error) {
      attempt++;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Database connection error: ${errorMessage}`);

      if (attempt >= maxRetries) {
        console.error("Failed to connect to database after maximum retries");
        throw new Error(`Database connection failed: ${errorMessage}`);
      }

      console.warn(
        `Database connection attempt ${attempt} failed. Retrying in ${delay}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Exponential backoff with jitter
      delay = Math.min(delay * 2 + Math.random() * 1000, 30000);
    }
  }
}
