/**
 * ElevenLabs TTS API Client
 *
 * Generates MP3 audio from text input using the ElevenLabs text-to-speech API.
 * Uses the official @elevenlabs/elevenlabs-js SDK (v2.31.0).
 *
 * This is Ticket 5 of the Radio Station Phase 1 implementation,
 * enabling voice segment generation for radio mixes.
 */

import {
  ElevenLabsClient as ElevenLabsSDK,
  ElevenLabsError,
  ElevenLabsTimeoutError,
} from "@elevenlabs/elevenlabs-js";
import { z } from "zod";
import { createAPIError, APIError } from "./errors.js";

/**
 * ElevenLabs API key from environment
 */
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? "";

/**
 * Default model for text-to-speech
 */
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

/**
 * Default output format (MP3 at 44.1kHz, 128kbps)
 */
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";

/**
 * Maximum text length (ElevenLabs limit)
 */
const MAX_TEXT_LENGTH = 5000;

/**
 * Voice settings for text-to-speech generation
 */
export interface ElevenLabsVoiceSettings {
  stability?: number; // 0-1, default 0.5
  similarityBoost?: number; // 0-1, default 0.75
  style?: number; // 0-1, default 0
  useSpeakerBoost?: boolean; // default true
}

/**
 * Options for generateSpeech
 */
export interface GenerateSpeechOptions {
  voiceSettings?: ElevenLabsVoiceSettings;
  modelId?: string; // default: "eleven_multilingual_v2"
  outputFormat?: string; // default: "mp3_44100_128"
}

/**
 * ElevenLabs client interface
 */
export interface ElevenLabsClient {
  generateSpeech(
    text: string,
    voiceId: string,
    options?: GenerateSpeechOptions,
  ): Promise<Buffer>;
}

/**
 * Zod schema for voice settings validation
 */
export const VoiceSettingsSchema = z
  .object({
    stability: z.number().min(0).max(1).optional(),
    similarityBoost: z.number().min(0).max(1).optional(),
    style: z.number().min(0).max(1).optional(),
    useSpeakerBoost: z.boolean().optional(),
  })
  .optional();

/**
 * Zod schema for generateSpeech input validation
 */
export const GenerateSpeechInputSchema = z.object({
  text: z
    .string()
    .min(1, "Text cannot be empty")
    .max(MAX_TEXT_LENGTH, `Text too long (max ${MAX_TEXT_LENGTH} characters)`),
  voiceId: z.string().min(1, "Voice ID required"),
  voiceSettings: VoiceSettingsSchema,
  modelId: z.string().optional(),
  outputFormat: z.string().optional(),
});

export type GenerateSpeechInput = z.infer<typeof GenerateSpeechInputSchema>;

/**
 * Map SDK errors to APIError with correct retryable flag
 *
 * SDK error types:
 * - UnprocessableEntityError (422) - Invalid params, non-retryable
 * - ElevenLabsTimeoutError - Request timeout, retryable
 * - ElevenLabsError - Generic error with statusCode
 *
 * @param error - The error thrown by the SDK
 * @returns APIError with appropriate retryable flag
 */
export function mapSdkError(error: unknown): APIError {
  // Handle SDK timeout errors (retryable)
  if (error instanceof ElevenLabsTimeoutError) {
    return createAPIError(408, "ElevenLabs", "Request timeout");
  }

  // Handle SDK errors with statusCode
  if (error instanceof ElevenLabsError) {
    const status = error.statusCode ?? 500;
    return createAPIError(status, "ElevenLabs", error.message);
  }

  // Handle generic errors by duck-typing
  if (error instanceof Error) {
    // Check for timeout in message
    if (error.message.toLowerCase().includes("timeout")) {
      return createAPIError(408, "ElevenLabs", "Request timeout");
    }

    // Handle errors with statusCode property
    const errorWithStatus = error as Error & {
      statusCode?: number;
      status?: number;
    };
    const status = errorWithStatus.statusCode ?? errorWithStatus.status;

    if (status !== undefined) {
      return createAPIError(status, "ElevenLabs", error.message);
    }

    // UnprocessableEntityError or validation errors (check by name)
    if (
      error.name === "UnprocessableEntityError" ||
      error.message.includes("Unprocessable") ||
      error.message.includes("validation")
    ) {
      return createAPIError(422, "ElevenLabs", error.message);
    }
  }

  // Unknown errors - treat as retryable server error
  return createAPIError(
    500,
    "ElevenLabs",
    error instanceof Error ? error.message : String(error),
  );
}

/**
 * Convert a ReadableStream to a Buffer
 *
 * The SDK returns a ReadableStream<Uint8Array> for audio data.
 * This helper collects all chunks into a single Buffer.
 *
 * @param stream - ReadableStream from SDK
 * @returns Buffer containing all audio data
 */
async function streamToBuffer(
  stream: ReadableStream<Uint8Array>,
): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  try {
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

/**
 * Create ElevenLabs TTS client
 *
 * @param apiKey - Optional API key override (uses ELEVENLABS_API_KEY env var by default)
 * @returns ElevenLabs client instance
 * @throws Error if API key is not provided and not in environment
 */
export function createElevenLabsClient(apiKey?: string): ElevenLabsClient {
  const key = apiKey ?? ELEVENLABS_API_KEY;

  if (!key) {
    throw new Error("ELEVENLABS_API_KEY environment variable is not set");
  }

  // Initialize the SDK client
  const sdk = new ElevenLabsSDK({ apiKey: key });

  return {
    async generateSpeech(
      text: string,
      voiceId: string,
      options?: GenerateSpeechOptions,
    ): Promise<Buffer> {
      // Validate input before calling SDK
      const parseResult = GenerateSpeechInputSchema.safeParse({
        text,
        voiceId,
        voiceSettings: options?.voiceSettings,
        modelId: options?.modelId,
        outputFormat: options?.outputFormat,
      });

      if (!parseResult.success) {
        const errorMessage = parseResult.error.errors
          .map((e) => e.message)
          .join(", ");
        throw createAPIError(422, "ElevenLabs", errorMessage);
      }

      try {
        // Build voice settings for SDK (SDK uses camelCase)
        const voiceSettings = options?.voiceSettings
          ? {
              stability: options.voiceSettings.stability,
              similarityBoost: options.voiceSettings.similarityBoost,
              style: options.voiceSettings.style,
              useSpeakerBoost: options.voiceSettings.useSpeakerBoost,
            }
          : undefined;

        // Call SDK textToSpeech.convert
        const stream = await sdk.textToSpeech.convert(voiceId, {
          text,
          modelId: options?.modelId ?? DEFAULT_MODEL_ID,
          outputFormat:
            (options?.outputFormat as
              | "mp3_44100_128"
              | "mp3_22050_32"
              | "mp3_44100_64"
              | "mp3_44100_192"
              | undefined) ?? DEFAULT_OUTPUT_FORMAT,
          voiceSettings,
        });

        // Convert stream to Buffer
        return await streamToBuffer(stream);
      } catch (error) {
        // Re-throw APIError as-is
        if (error instanceof APIError) {
          throw error;
        }

        // Map SDK errors to APIError
        throw mapSdkError(error);
      }
    },
  };
}
