/**
 * Track Ingestion Pipeline
 *
 * Inngest function that ingests music tracks by ISRC into the vector search index.
 * Pipeline steps:
 * 1. fetch-audio-features: Retrieve audio features from ReccoBeats API
 * 2. fetch-lyrics: Retrieve lyrics from Musixmatch API
 * 3. generate-interpretation: Generate thematic interpretation via Claude Sonnet 4.5
 * 4. generate-short-description: Generate single-sentence summary via Claude Haiku 4.5
 * 5. embed-interpretation: Generate 1024-dim embedding via TEI
 * 6. store-document: Upsert complete document to Qdrant
 * 7. emit-completion: Send track/ingestion.completed event
 */

import { inngest } from "../client.js";
import { createReccoBeatsClient, type AudioFeatures } from "../../clients/reccobeats.js";
import { createMusixmatchClient, type LyricsContent } from "../../clients/musixmatch.js";
import { createAnthropicClient, type InterpretationResult, CLAUDE_MODEL } from "../../clients/anthropic.js";
import {
  createTEIClient,
  createZeroVector,
  validateEmbeddingDimensions,
  EMBEDDING_DIMENSIONS,
} from "../../clients/tei.js";
import { buildInterpretationPrompt } from "../../prompts/lyricsInterpretation.js";
import {
  buildShortDescriptionPrompt,
  buildInstrumentalShortDescriptionPrompt,
  buildMetadataOnlyShortDescriptionPrompt,
} from "../../prompts/shortDescription.js";
import {
  createIngestionTrace,
  createHTTPSpan,
  createGenerationSpan,
  createSearchSpan,
  flushLangfuse,
} from "../../observability/langfuse.js";
import { QdrantClient } from "@qdrant/js-client-rest";
import { createHash } from "crypto";

/**
 * ISRC namespace for deterministic UUID generation
 */
const ISRC_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

/**
 * Qdrant collection name
 */
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION ?? "tracks";

/**
 * Qdrant URL
 */
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";

/**
 * Hash ISRC to deterministic UUID
 */
function hashIsrcToUuid(isrc: string): string {
  const normalizedIsrc = isrc.toUpperCase();
  const hash = createHash("sha256")
    .update(ISRC_NAMESPACE)
    .update(normalizedIsrc)
    .digest("hex");

  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32),
  ].join("-");
}

/**
 * Track Ingestion Inngest Function
 *
 * Configuration:
 * - id: track-ingestion
 * - trigger: track/ingestion.requested event
 * - retries: 5 attempts with exponential backoff
 * - concurrency: 10 concurrent executions
 * - idempotency: keyed by ISRC (24-hour window)
 */
export const trackIngestion = inngest.createFunction(
  {
    id: "track-ingestion",
    retries: 5,
    concurrency: {
      limit: 10,
    },
    throttle: {
      limit: 10,
      period: "1m",
    },
    idempotency: "event.data.isrc",
  },
  { event: "track/ingestion.requested" },
  async ({ event, step, runId }) => {
    const { isrc, title, artist, album, artworkUrl, force } = event.data;
    const startTime = Date.now();

    // Create observability trace for this ingestion
    const trace = createIngestionTrace(isrc, runId);

    // Step 1: Fetch audio features from ReccoBeats
    const audioFeatures = await step.run("fetch-audio-features", async () => {
      const stepStart = Date.now();
      const httpSpan = createHTTPSpan(trace, {
        name: "reccobeats-audio-features",
        url: `https://api.reccobeats.com/v1/audio-features?isrc=${isrc}`,
        method: "GET",
        metadata: { isrc },
      });

      try {
        const client = createReccoBeatsClient();
        const features = await client.getAudioFeatures(isrc);
        httpSpan.end({
          statusCode: features ? 200 : 404,
          durationMs: Date.now() - stepStart,
        });
        return features;
      } catch (error) {
        httpSpan.end({
          statusCode: 500,
          durationMs: Date.now() - stepStart,
        });
        throw error;
      }
    });

    // Step 2: Fetch lyrics from Musixmatch
    const lyrics = await step.run("fetch-lyrics", async () => {
      const stepStart = Date.now();
      const httpSpan = createHTTPSpan(trace, {
        name: "musixmatch-lyrics",
        url: `https://api.musixmatch.com/ws/1.1/track.lyrics.get?track_isrc=${isrc}`,
        method: "GET",
        metadata: { isrc },
      });

      try {
        const client = createMusixmatchClient();
        const lyricsContent = await client.getLyrics(isrc);
        httpSpan.end({
          statusCode: lyricsContent ? 200 : 404,
          durationMs: Date.now() - stepStart,
        });
        return lyricsContent;
      } catch (error) {
        httpSpan.end({
          statusCode: 500,
          durationMs: Date.now() - stepStart,
        });
        throw error;
      }
    });

    // Step 3: Generate interpretation (skip if no lyrics)
    const interpretation = await step.run("generate-interpretation", async () => {
      if (!lyrics || !lyrics.lyrics_body) {
        // Instrumental track - no interpretation needed
        return null;
      }

      const prompt = buildInterpretationPrompt(title, artist, album, lyrics.lyrics_body);
      const generationSpan = createGenerationSpan(trace, {
        name: "llm-interpretation",
        model: CLAUDE_MODEL,
        prompt,
        metadata: { isrc, title, artist },
      });

      try {
        const client = createAnthropicClient();
        const result = await client.generateInterpretation(
          title,
          artist,
          album,
          lyrics.lyrics_body
        );
        generationSpan.end({
          completion: result.text,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        });
        return result;
      } catch (error) {
        generationSpan.end({
          completion: "",
          inputTokens: 0,
          outputTokens: 0,
        });
        throw error;
      }
    });

    // Step 4: Generate short description via Haiku (graceful failure)
    const shortDescription = await step.run("generate-short-description", async () => {
      const generationSpan = createGenerationSpan(trace, {
        name: "llm-short-description",
        model: "claude-haiku-4-5-20251001",
        prompt: "", // Will be set below
        metadata: { isrc, title, artist, hasInterpretation: !!interpretation?.text },
      });

      try {
        const client = createAnthropicClient();
        let prompt: string;

        if (interpretation?.text) {
          // Has interpretation - use it for the short description
          prompt = buildShortDescriptionPrompt(title, artist, interpretation.text);
        } else if (audioFeatures) {
          // Instrumental track with audio features
          prompt = buildInstrumentalShortDescriptionPrompt(
            title,
            artist,
            album,
            audioFeatures
          );
        } else {
          // Fallback to metadata only
          prompt = buildMetadataOnlyShortDescriptionPrompt(title, artist, album);
        }

        const result = await client.generateShortDescription(prompt);
        generationSpan.end({
          completion: result.text,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        });
        return result.text;
      } catch (error) {
        // Graceful failure - log and return null, don't block pipeline
        generationSpan.end({
          completion: "",
          inputTokens: 0,
          outputTokens: 0,
        });
        console.error(`Short description generation failed for ${isrc}:`, error);
        return null;
      }
    });

    // Step 5: Generate embedding (zero vector if no interpretation)
    const embedding = await step.run("embed-interpretation", async () => {
      if (!interpretation || !interpretation.text) {
        // No interpretation available - use zero vector
        return createZeroVector();
      }

      const stepStart = Date.now();
      const teiUrl = process.env.TEI_URL ?? "http://localhost:8080";
      const httpSpan = createHTTPSpan(trace, {
        name: "tei-embedding",
        url: `${teiUrl}/embed`,
        method: "POST",
        metadata: { textLength: interpretation.text.length },
      });

      try {
        const client = createTEIClient();
        const embeddingVector = await client.embed(interpretation.text);

        // Validate embedding dimensions (must be exactly 4096)
        validateEmbeddingDimensions(embeddingVector);

        httpSpan.end({
          statusCode: 200,
          durationMs: Date.now() - stepStart,
        });
        return embeddingVector;
      } catch (error) {
        httpSpan.end({
          statusCode: 500,
          durationMs: Date.now() - stepStart,
        });
        throw error;
      }
    });

    // Step 6: Store document in Qdrant
    await step.run("store-document", async () => {
      const stepStart = Date.now();
      const searchSpan = createSearchSpan(trace, {
        name: "qdrant-upsert",
        collection: QDRANT_COLLECTION,
        operation: "upsert",
        metadata: { isrc },
      });

      try {
        const qdrant = new QdrantClient({ url: QDRANT_URL });
        const pointId = hashIsrcToUuid(isrc);

        // Build payload with all available data
        const payload: Record<string, unknown> = {
          isrc,
          title,
          artist,
          album,
          artworkUrl: artworkUrl ?? null,
          lyrics: lyrics?.lyrics_body ?? null,
          interpretation: interpretation?.text ?? null,
          short_description: shortDescription ?? null,
        };

        // Add audio features if available
        if (audioFeatures) {
          payload.acousticness = audioFeatures.acousticness;
          payload.danceability = audioFeatures.danceability;
          payload.energy = audioFeatures.energy;
          payload.instrumentalness = audioFeatures.instrumentalness;
          payload.key = audioFeatures.key;
          payload.liveness = audioFeatures.liveness;
          payload.loudness = audioFeatures.loudness;
          payload.mode = audioFeatures.mode;
          payload.speechiness = audioFeatures.speechiness;
          payload.tempo = audioFeatures.tempo;
          payload.valence = audioFeatures.valence;
        }

        // Upsert point with vector and payload
        await qdrant.upsert(QDRANT_COLLECTION, {
          wait: true,
          points: [
            {
              id: pointId,
              vector: {
                interpretation_embedding: embedding,
              },
              payload,
            },
          ],
        });

        searchSpan.end({
          pointCount: 1,
          durationMs: Date.now() - stepStart,
        });

        return { pointId };
      } catch (error) {
        searchSpan.end({
          pointCount: 0,
          durationMs: Date.now() - stepStart,
        });
        throw error;
      }
    });

    // Step 7: Emit completion event
    const completionResult = await step.run("emit-completion", async () => {
      const completedAt = Date.now();
      const durationMs = completedAt - startTime;

      const result = {
        hasLyrics: !!lyrics?.lyrics_body,
        hasAudioFeatures: !!audioFeatures,
        hasInterpretation: !!interpretation?.text,
        hasShortDescription: !!shortDescription,
        embeddingDimensions: EMBEDDING_DIMENSIONS,
      };

      await inngest.send({
        name: "track/ingestion.completed",
        data: {
          isrc,
          runId,
          completedAt,
          durationMs,
          result,
        },
      });

      // Flush observability data
      await flushLangfuse();

      return {
        isrc,
        runId,
        completedAt,
        durationMs,
        result,
      };
    });

    return completionResult;
  }
);
