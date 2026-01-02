/**
 * OpenTelemetry Setup for Langfuse Integration
 *
 * Configures OpenTelemetry with LangfuseSpanProcessor to automatically
 * track AI SDK calls (streamText, generateText, etc.) with proper
 * multi-step observability.
 *
 * See: https://langfuse.com/integrations/frameworks/vercel-ai-sdk
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { logger } from './logger.js';

/**
 * OpenTelemetry SDK instance
 */
let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry with Langfuse span processor
 *
 * Should be called once at server startup, before any AI SDK calls.
 * The LangfuseSpanProcessor reads configuration from environment variables:
 * - LANGFUSE_PUBLIC_KEY
 * - LANGFUSE_SECRET_KEY
 * - LANGFUSE_BASEURL (optional, defaults to cloud)
 */
export function initializeOpenTelemetry(): void {
  if (sdk) {
    logger.warn('otel_already_initialized', { message: 'OpenTelemetry already initialized' });
    return;
  }

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const enabled = process.env.LANGFUSE_ENABLED !== 'false';

  if (!enabled) {
    logger.info('otel_disabled', { message: 'Langfuse OpenTelemetry disabled via LANGFUSE_ENABLED=false' });
    return;
  }

  if (!publicKey || !secretKey) {
    logger.warn('otel_missing_keys', { message: 'Langfuse keys not configured, OpenTelemetry disabled' });
    return;
  }

  try {
    sdk = new NodeSDK({
      spanProcessors: [new LangfuseSpanProcessor()],
    });

    sdk.start();

    logger.info('otel_initialized', {
      message: 'OpenTelemetry initialized with Langfuse span processor',
      baseUrl: process.env.LANGFUSE_BASEURL || 'cloud',
    });
  } catch (error) {
    logger.error('otel_init_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Shutdown OpenTelemetry SDK gracefully
 *
 * Should be called during server shutdown to flush pending spans.
 */
export async function shutdownOpenTelemetry(): Promise<void> {
  if (!sdk) {
    return;
  }

  try {
    await sdk.shutdown();
    sdk = null;
    logger.info('otel_shutdown', { message: 'OpenTelemetry SDK shut down' });
  } catch (error) {
    logger.error('otel_shutdown_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
