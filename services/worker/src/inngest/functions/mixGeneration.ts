/**
 * Mix Generation Pipeline
 *
 * Feature: ALG-85 - Inngest mixGeneration Function (DJ Agent)
 *
 * Orchestrates mix generation:
 * 1. validate-input: Validate event data
 * 2. fetch-article-content: Fetch articles via backend GraphQL
 * 3. compose-mix: LLM agent selects music and generates voice scripts
 * 4. generate-voice-segments: TTS via ElevenLabs, upload to GCS
 * 5. assemble-mix: Calculate timeline positions
 * 6. save-mix: Update mix via backend GraphQL
 * 7. emit-completion: Send completion event
 */

import { inngest } from "../client.js";
import {
  createBackendClient,
  type BackendClient,
} from "../../clients/backend.js";
import {
  createElevenLabsClient,
  type ElevenLabsClient,
} from "../../clients/elevenlabs.js";
import { createGCSClient, type GCSClient } from "../../clients/gcs.js";
import {
  buildDiscoverySystemPrompt,
  buildDiscoveryUserPrompt,
  buildCompositionSystemPrompt,
  buildCompositionUserPrompt,
} from "../../prompts/djAgentPrompt.js";
import {
  type ArticleContent,
  type MixPlan,
  type MixPlanSegment,
  type GeneratedVoiceSegment,
  type FinalMixSegment,
  type FinalizeMixPlanInput,
  DJ_VOICE_SETTINGS,
  DEFAULT_DJ_VOICE_ID,
} from "../../schemas/mixGeneration.js";
import type { MixSegmentInput } from "../../schemas/backend.js";
import {
  createMixGenerationTrace,
  createHTTPSpan,
  createGenerationSpan,
  flushLangfuse,
} from "../../observability/langfuse.js";
import { generateText, tool, jsonSchema, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { randomUUID } from "crypto";
// @ts-expect-error - mp3-duration doesn't have complete types
import mp3Duration from "mp3-duration";
import { promisify } from "util";

// Promisify mp3Duration for async/await usage
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unnecessary-type-assertion
const getMp3Duration = promisify(mp3Duration) as (
  buffer: Buffer,
) => Promise<number>;

// =============================================================================
// Tool Input Schemas (using jsonSchema to avoid TypeScript inference issues)
// See: https://github.com/vercel/ai/issues/7431
// =============================================================================

/**
 * Semantic search tool input type
 */
interface SemanticSearchInput {
  query: string;
  limit?: number;
}

/**
 * Semantic search tool input schema (JSON Schema format)
 */
const SemanticSearchInputSchema = jsonSchema<SemanticSearchInput>({
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Natural language query describing desired mood/theme",
    },
    limit: {
      type: "number",
      description: "Max results (default 20)",
    },
  },
  required: ["query"],
});

/**
 * Tidal search tool input type
 */
interface TidalSearchInput {
  query: string;
  searchType: "tracks" | "albums" | "both";
  limit?: number;
}

/**
 * Tidal search tool input schema (JSON Schema format)
 */
const TidalSearchInputSchema = jsonSchema<TidalSearchInput>({
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Search query",
    },
    searchType: {
      type: "string",
      enum: ["tracks", "albums", "both"],
      description: "What to search for",
    },
    limit: {
      type: "number",
      description: "Max results per type (default 10)",
    },
  },
  required: ["query", "searchType"],
});

/**
 * Batch metadata tool input type
 */
interface BatchMetadataInput {
  isrcs: string[];
}

/**
 * Batch metadata tool input schema (JSON Schema format)
 */
const BatchMetadataInputSchema = jsonSchema<BatchMetadataInput>({
  type: "object",
  properties: {
    isrcs: {
      type: "array",
      items: { type: "string" },
      description: "ISRCs of tracks to look up",
    },
  },
  required: ["isrcs"],
});

/**
 * Finalize mix plan input schema (JSON Schema format)
 * Used by the DJ agent composition phase
 */
const FinalizeMixPlanJsonSchema = jsonSchema<FinalizeMixPlanInput>({
  type: "object",
  properties: {
    theme: {
      type: "string",
      description: "Overall theme/narrative for the mix",
    },
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["voice", "music"],
            description: "Segment type",
          },
          // Voice segment fields
          voiceScript: {
            type: "string",
            description: "Voice script text with SSML annotations",
          },
          sourceDocumentId: {
            type: "string",
            description: "Readwise document ID for source article",
          },
          sourceTitle: { type: "string", description: "Article title" },
          sourceUrl: { type: "string", description: "Article URL" },
          // Music segment fields
          isrc: { type: "string", description: "Track ISRC" },
          tidalTrackId: { type: "string", description: "Tidal track ID" },
          trackTitle: { type: "string", description: "Track title" },
          artistName: { type: "string", description: "Artist name" },
          albumName: { type: "string", description: "Album name" },
          albumArtUrl: { type: "string", description: "Album art URL" },
          trackDurationMs: {
            type: "integer",
            description: "Track duration in ms",
          },
          playDurationMs: {
            type: "integer",
            description: "How long to play in ms",
          },
          fadeIn: { type: "boolean", description: "Fade in at start" },
          fadeOut: { type: "boolean", description: "Fade out at end" },
          selectionReason: {
            type: "string",
            description: "Why this track was selected",
          },
        },
        required: ["type"],
      },
      description: "Ordered segments with voice scripts and music selections",
    },
  },
  required: ["segments"],
});

/**
 * Tool result types - explicitly defined to avoid type inference issues
 */
interface SemanticSearchResult {
  tracks: Array<{
    isrc: string;
    title: string;
    artist: string;
    album: string | null;
    duration: number | null;
    shortDescription: string | null;
    score: number;
  }>;
  totalFound: number;
  summary: string;
  error?: string;
}

interface TidalSearchResult {
  tracks?: Array<{
    tidalId: string | null;
    isrc: string;
    title: string;
    artist: string;
    album: string;
    duration: number | null;
    inLibrary: boolean;
    isIndexed: boolean;
  }>;
  albums?: Array<{
    tidalId: string;
    title: string;
    artist: string;
    trackCount: number;
    inLibrary: boolean;
  }>;
  totalFound: { tracks: number; albums: number };
  summary: string;
  error?: string;
}

interface BatchMetadataResult {
  tracks: Array<{
    isrc: string;
    title: string;
    artist: string;
    album: string;
    duration: number | null;
    shortDescription: string | null;
  }>;
  found: string[];
  notFound: string[];
  summary: string;
  error?: string;
}

/**
 * Claude model for DJ agent
 */
const DJ_AGENT_MODEL = "claude-sonnet-4-5";

/**
 * Max concurrent TTS calls (rate limiting)
 */
const TTS_CONCURRENCY = 3;

/**
 * Create discovery tools - separated to avoid type inference issues
 */
function createDiscoveryTools(
  backendClient: BackendClient,
  userId: string,
  discoveredTracks: DiscoveredTrack[],
) {
  return {
    semanticSearch: tool({
      description:
        "Search indexed music library by mood, theme, or lyrical content. Returns tracks with short descriptions.",
      inputSchema: SemanticSearchInputSchema,
      execute: async (
        input: SemanticSearchInput,
      ): Promise<SemanticSearchResult> => {
        console.log(`[Discovery] semanticSearch called with: ${input.query}`);
        try {
          const response = await backendClient.semanticSearch(
            input.query,
            userId,
            input.limit ?? 20,
          );
          for (const t of response.tracks) {
            if (t.isrc && !discoveredTracks.some((dt) => dt.isrc === t.isrc)) {
              discoveredTracks.push({
                isrc: t.isrc,
                title: t.title,
                artist: t.artist,
                album: t.album ?? undefined,
                duration: t.duration ?? undefined,
                shortDescription: t.shortDescription ?? undefined,
              });
            }
          }
          console.log(
            `[Discovery] semanticSearch found ${response.tracks.length} tracks (total collected: ${discoveredTracks.length})`,
          );
          return {
            tracks: response.tracks.map((t) => ({
              isrc: t.isrc,
              title: t.title,
              artist: t.artist,
              album: t.album,
              duration: t.duration,
              shortDescription: t.shortDescription,
              score: t.score,
            })),
            totalFound: response.totalFound,
            summary: response.summary,
          };
        } catch (error) {
          console.error(
            `[Discovery] semanticSearch error: ${error instanceof Error ? error.message : String(error)}`,
          );
          return {
            error: error instanceof Error ? error.message : String(error),
            tracks: [],
            totalFound: 0,
            summary: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}. Try a shorter, simpler query.`,
          };
        }
      },
    }),
    tidalSearch: tool({
      description:
        "Search Tidal catalogue by artist, album, or track name. Use for finding specific artists or albums.",
      inputSchema: TidalSearchInputSchema,
      execute: async (input: TidalSearchInput): Promise<TidalSearchResult> => {
        console.log(`[Discovery] tidalSearch called with: ${input.query}`);
        try {
          const response = await backendClient.tidalSearch(
            input.query,
            input.searchType,
            userId,
            input.limit ?? 10,
          );
          if (response.tracks) {
            for (const t of response.tracks) {
              if (
                t.isrc &&
                !discoveredTracks.some((dt) => dt.isrc === t.isrc)
              ) {
                discoveredTracks.push({
                  isrc: t.isrc,
                  title: t.title,
                  artist: t.artist,
                  album: t.album ?? undefined,
                  duration: t.duration ?? undefined,
                  tidalId: t.tidalId ?? undefined,
                });
              }
            }
          }
          console.log(
            `[Discovery] tidalSearch found ${response.tracks?.length ?? 0} tracks (total collected: ${discoveredTracks.length})`,
          );
          return {
            tracks: response.tracks?.map((t) => ({
              tidalId: t.tidalId,
              isrc: t.isrc,
              title: t.title,
              artist: t.artist,
              album: t.album,
              duration: t.duration,
              inLibrary: t.inLibrary,
              isIndexed: t.isIndexed,
            })),
            albums: response.albums?.map((a) => ({
              tidalId: a.tidalId,
              title: a.title,
              artist: a.artist,
              trackCount: a.trackCount,
              inLibrary: a.inLibrary,
            })),
            totalFound: response.totalFound,
            summary: response.summary,
          };
        } catch (error) {
          console.error(
            `[Discovery] tidalSearch error: ${error instanceof Error ? error.message : String(error)}`,
          );
          return {
            error: error instanceof Error ? error.message : String(error),
            tracks: [],
            albums: [],
            totalFound: { tracks: 0, albums: 0 },
            summary: `Tidal search failed: ${error instanceof Error ? error.message : "Unknown error"}.`,
          };
        }
      },
    }),
    batchMetadata: tool({
      description:
        "Get full metadata (lyrics, interpretation, audio features) for tracks by ISRC. Use after finding tracks to get detailed info.",
      inputSchema: BatchMetadataInputSchema,
      execute: async (
        input: BatchMetadataInput,
      ): Promise<BatchMetadataResult> => {
        console.log(
          `[Discovery] batchMetadata called with ${input.isrcs.length} ISRCs`,
        );
        try {
          const response = await backendClient.batchMetadata(
            input.isrcs,
            userId,
          );
          for (const t of response.tracks) {
            const existing = discoveredTracks.find((dt) => dt.isrc === t.isrc);
            if (existing) {
              existing.shortDescription =
                t.shortDescription ?? existing.shortDescription;
            }
          }
          console.log(
            `[Discovery] batchMetadata found ${response.found.length} tracks`,
          );
          return {
            tracks: response.tracks.map((t) => ({
              isrc: t.isrc,
              title: t.title,
              artist: t.artist,
              album: t.album,
              duration: t.duration,
              shortDescription: t.shortDescription,
            })),
            found: response.found,
            notFound: response.notFound,
            summary: response.summary,
          };
        } catch (error) {
          console.error(
            `[Discovery] batchMetadata error: ${error instanceof Error ? error.message : String(error)}`,
          );
          return {
            error: error instanceof Error ? error.message : String(error),
            tracks: [],
            found: [],
            notFound: input.isrcs,
            summary: `Metadata lookup failed: ${error instanceof Error ? error.message : "Unknown error"}.`,
          };
        }
      },
    }),
  };
}

/**
 * Discovered track interface
 */
interface DiscoveredTrack {
  isrc: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  shortDescription?: string;
  tidalId?: string;
}

/**
 * Default track duration if not available (30 seconds)
 */
const DEFAULT_TRACK_DURATION_MS = 30000;

/**
 * Mix Generation Inngest Function
 *
 * Configuration:
 * - id: mix-generation
 * - trigger: mix/generation.requested event
 * - retries: 3 attempts
 * - concurrency: 3 concurrent executions
 * - throttle: 5 per minute
 * - idempotency: keyed by mixId
 */
export const mixGeneration = inngest.createFunction(
  {
    id: "mix-generation",
    retries: 3,
    concurrency: {
      limit: 3,
    },
    throttle: {
      limit: 5,
      period: "1m",
    },
    idempotency: "event.data.mixId",
  },
  { event: "mix/generation.requested" },
  async ({ event, step, runId }) => {
    const { mixId, userId, title, articles, musicInstructions } = event.data;
    const startTime = Date.now();

    // Create observability trace
    const trace = createMixGenerationTrace(mixId, runId, userId);

    // Initialize clients
    let backendClient: BackendClient;
    let elevenLabsClient: ElevenLabsClient;
    let gcsClient: GCSClient;

    try {
      backendClient = createBackendClient();
      elevenLabsClient = createElevenLabsClient();
      gcsClient = createGCSClient();
    } catch (error) {
      // Client initialization failed - update mix status and fail
      console.error("Client initialization failed:", error);
      try {
        const fallbackClient = createBackendClient();
        await fallbackClient.updateMixStatus(
          mixId,
          "FAILED",
          error instanceof Error
            ? error.message
            : "Client initialization failed",
        );
      } catch {
        // Ignore fallback error
      }
      throw error;
    }

    // Step 1: Validate input
    await step.run("validate-input", () => {
      // Validate articles count
      if (!articles || articles.length === 0) {
        throw new Error("At least one article is required");
      }
      if (articles.length > 10) {
        throw new Error("Maximum 10 articles allowed");
      }

      // Validate each article has required fields
      for (const article of articles) {
        if (!article.documentId || !article.contentMode) {
          throw new Error("Each article must have documentId and contentMode");
        }
      }

      return { validated: true, articleCount: articles.length };
    });

    // Step 2: Fetch article content from Readwise via backend
    const articleContents = await step.run(
      "fetch-article-content",
      async () => {
        const contents: ArticleContent[] = [];
        const errors: string[] = [];

        // Fetch each article (sequentially to avoid rate limits)
        for (const article of articles) {
          const stepStart = Date.now();
          const httpSpan = createHTTPSpan(trace, {
            name: "readwise-fetch",
            url: `backend/agentReadwiseFetch/${article.documentId}`,
            method: "POST",
            metadata: {
              documentId: article.documentId,
              contentMode: article.contentMode,
            },
          });

          try {
            const result = await backendClient.readwiseFetch(
              article.documentId,
              article.contentMode === "full" ? "full" : "summary",
              userId,
              article.contentMode === "summary" ? "medium" : undefined,
            );

            contents.push({
              documentId: article.documentId,
              title: result.document.title,
              author: result.document.author,
              url: result.document.url,
              content: result.content,
              contentMode: article.contentMode,
            });

            httpSpan.end({
              statusCode: 200,
              durationMs: Date.now() - stepStart,
            });
          } catch (error) {
            httpSpan.end({
              statusCode: 500,
              durationMs: Date.now() - stepStart,
            });
            errors.push(
              `Failed to fetch article ${article.documentId}: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }
        }

        // Require at least one successful article fetch
        if (contents.length === 0) {
          throw new Error(`All article fetches failed: ${errors.join("; ")}`);
        }

        // Log warnings for partial failures
        if (errors.length > 0) {
          console.warn(`Some articles failed to fetch: ${errors.join("; ")}`);
        }

        return { contents, errors };
      },
    );

    // Step 3: Compose mix using two-phase DJ agent
    // Phase 1: Music Discovery - use tools to find matching tracks
    // Phase 2: Mix Composition - use structured output to create the plan
    const mixPlan = await step.run("compose-mix", async () => {
      // =========================================================================
      // PHASE 1: MUSIC DISCOVERY
      // =========================================================================
      const discoverySystemPrompt = buildDiscoverySystemPrompt();
      const discoveryUserPrompt = buildDiscoveryUserPrompt(
        title,
        articleContents.contents,
        musicInstructions,
      );

      const discoverySpan = createGenerationSpan(trace, {
        name: "dj-agent-discovery",
        model: DJ_AGENT_MODEL,
        prompt: discoveryUserPrompt,
        metadata: {
          phase: "discovery",
          articleCount: articleContents.contents.length,
        },
      });

      // Collect all discovered music from tool calls
      const discoveredTracks: DiscoveredTrack[] = [];

      // Create discovery tools using factory (avoids type inference issues)
      const discoveryTools = createDiscoveryTools(
        backendClient,
        userId,
        discoveredTracks,
      );

      try {
        // Phase 1: Run discovery with tools
        const discoveryResult = await generateText({
          model: anthropic(DJ_AGENT_MODEL),
          system: discoverySystemPrompt,
          prompt: discoveryUserPrompt,
          maxOutputTokens: 4096,
          stopWhen: stepCountIs(10), // Allow multiple tool calls for discovery
          tools: discoveryTools,
        });

        discoverySpan.end({
          completion: discoveryResult.text,
          inputTokens: discoveryResult.usage?.inputTokens ?? 0,
          outputTokens: discoveryResult.usage?.outputTokens ?? 0,
        });

        console.log(
          `[Discovery] Phase 1 complete. Found ${discoveredTracks.length} tracks.`,
        );

        // If no tracks discovered, throw error
        if (discoveredTracks.length === 0) {
          throw new Error(
            "Music discovery phase found no tracks. Cannot compose mix.",
          );
        }

        // =========================================================================
        // PHASE 2: MIX COMPOSITION
        // =========================================================================
        const compositionSystemPrompt = buildCompositionSystemPrompt();
        const compositionUserPrompt = buildCompositionUserPrompt(
          title,
          articleContents.contents,
          JSON.stringify(discoveredTracks, null, 2),
          musicInstructions,
        );

        const compositionSpan = createGenerationSpan(trace, {
          name: "dj-agent-composition",
          model: DJ_AGENT_MODEL,
          prompt: compositionUserPrompt,
          metadata: {
            phase: "composition",
            discoveredTracksCount: discoveredTracks.length,
          },
        });

        // Phase 2: Use generateText with finalizeMixPlan tool
        // This is more reliable with Anthropic than generateObject
        let finalPlan: FinalizeMixPlanInput | null = null;

        const compositionResult = await generateText({
          model: anthropic(DJ_AGENT_MODEL),
          system: compositionSystemPrompt,
          prompt: compositionUserPrompt,
          maxOutputTokens: 8192,
          stopWhen: stepCountIs(1), // Only need one step - the tool call
          tools: {
            finalizeMixPlan: tool({
              description:
                "Submit the final mix plan with all voice scripts and music selections. Call this once you have composed the complete mix.",
              inputSchema: FinalizeMixPlanJsonSchema,
              /* eslint-disable @typescript-eslint/require-await */
              execute: async (
                input: FinalizeMixPlanInput,
              ): Promise<{ success: boolean; segmentCount: number }> => {
                finalPlan = input;
                return { success: true, segmentCount: input.segments.length };
              },
              /* eslint-enable @typescript-eslint/require-await */
            }),
          },
        });

        compositionSpan.end({
          completion: finalPlan
            ? JSON.stringify(finalPlan)
            : "No plan generated",
          inputTokens: compositionResult.usage?.inputTokens ?? 0,
          outputTokens: compositionResult.usage?.outputTokens ?? 0,
        });

        if (!finalPlan) {
          throw new Error(
            "DJ agent did not call finalizeMixPlan. Mix composition incomplete.",
          );
        }

        // Type assertion needed because TypeScript doesn't track assignments in async callbacks
        const validatedPlan = finalPlan as FinalizeMixPlanInput;

        console.log(
          `[Composition] Phase 2 complete. Generated ${validatedPlan.segments.length} segments.`,
        );

        // Transform the plan into our MixPlan format
        const plan: MixPlan = {
          mixId,
          title,
          theme: validatedPlan.theme,
          segments: validatedPlan.segments.map(
            (seg: FinalizeMixPlanInput["segments"][number], index: number) => {
              const id = randomUUID();
              if (seg.type === "voice") {
                return {
                  type: "voice" as const,
                  id,
                  order: index,
                  script: {
                    text: seg.voiceScript ?? "",
                    characterCount: (seg.voiceScript ?? "").length,
                    sourceArticle: seg.sourceDocumentId
                      ? {
                          documentId: seg.sourceDocumentId,
                          title: seg.sourceTitle ?? "",
                          url: seg.sourceUrl ?? "",
                        }
                      : null,
                  },
                };
              } else {
                return {
                  type: "music" as const,
                  id,
                  order: index,
                  track: {
                    isrc: seg.isrc ?? "",
                    tidalTrackId: seg.tidalTrackId,
                    title: seg.trackTitle ?? "Unknown",
                    artist: seg.artistName ?? "Unknown",
                    album: seg.albumName,
                    albumArtUrl: seg.albumArtUrl,
                    durationMs:
                      seg.trackDurationMs ?? DEFAULT_TRACK_DURATION_MS,
                    selectionReason: seg.selectionReason,
                  },
                  playDurationMs:
                    seg.playDurationMs ??
                    seg.trackDurationMs ??
                    DEFAULT_TRACK_DURATION_MS,
                  fadeIn: seg.fadeIn ?? false,
                  fadeOut: seg.fadeOut ?? false,
                };
              }
            },
          ),
          articleCount: articleContents.contents.length,
          estimatedTotalDurationMs: 0, // Will be calculated later
        };

        // Calculate estimated duration
        plan.estimatedTotalDurationMs = plan.segments.reduce((total, seg) => {
          if (seg.type === "voice") {
            // Estimate ~150 words per minute, ~5 chars per word
            const words = seg.script.characterCount / 5;
            const durationMs = (words / 150) * 60 * 1000;
            return total + durationMs;
          } else {
            return total + seg.playDurationMs;
          }
        }, 0);

        return plan;
      } catch (error) {
        discoverySpan.end({
          completion: "",
          inputTokens: 0,
          outputTokens: 0,
        });
        throw error;
      }
    });

    // Step 4: Generate voice segments via TTS
    const voiceSegments = await step.run(
      "generate-voice-segments",
      async () => {
        const voicePlanSegments = mixPlan.segments.filter(
          (s): s is MixPlanSegment & { type: "voice" } => s.type === "voice",
        );

        const generated: GeneratedVoiceSegment[] = [];
        const errors: string[] = [];
        let failedCount = 0;

        // Process in batches for rate limiting
        for (let i = 0; i < voicePlanSegments.length; i += TTS_CONCURRENCY) {
          const batch = voicePlanSegments.slice(i, i + TTS_CONCURRENCY);

          const batchResults = await Promise.allSettled(
            batch.map(async (segment) => {
              const stepStart = Date.now();
              const httpSpan = createHTTPSpan(trace, {
                name: "elevenlabs-tts",
                url: `elevenlabs/text-to-speech/${DEFAULT_DJ_VOICE_ID}`,
                method: "POST",
                metadata: {
                  segmentId: segment.id,
                  characterCount: segment.script.characterCount,
                },
              });

              try {
                // Generate speech
                const audioBuffer = await elevenLabsClient.generateSpeech(
                  segment.script.text,
                  DEFAULT_DJ_VOICE_ID,
                  {
                    voiceSettings: DJ_VOICE_SETTINGS,
                  },
                );

                // Parse MP3 duration
                const durationSeconds: number =
                  await getMp3Duration(audioBuffer);
                const durationMs = Math.round(durationSeconds * 1000);

                // Upload to GCS
                const gcsPath = `mixes/${mixId}/voice/${segment.id}.mp3`;
                await gcsClient.uploadAudio(audioBuffer, gcsPath);

                httpSpan.end({
                  statusCode: 200,
                  durationMs: Date.now() - stepStart,
                  responseSize: audioBuffer.length,
                });

                return {
                  segmentId: segment.id,
                  gcsPath,
                  durationMs,
                  characterCount: segment.script.characterCount,
                  sourceArticle: segment.script.sourceArticle,
                };
              } catch (error) {
                httpSpan.end({
                  statusCode: 500,
                  durationMs: Date.now() - stepStart,
                });
                throw error;
              }
            }),
          );

          // Process results
          for (let j = 0; j < batchResults.length; j++) {
            const result = batchResults[j];
            const segment = batch[j];

            if (result.status === "fulfilled") {
              generated.push(result.value);
            } else {
              failedCount++;
              errors.push(
                `Segment ${segment.id}: ${result.reason instanceof Error ? result.reason.message : "Unknown error"}`,
              );
            }
          }
        }

        // Check failure threshold (>50% fail = mix fails)
        const totalVoiceSegments = voicePlanSegments.length;
        if (failedCount > totalVoiceSegments / 2) {
          throw new Error(
            `Too many TTS failures (${failedCount}/${totalVoiceSegments}): ${errors.join("; ")}`,
          );
        }

        if (errors.length > 0) {
          console.warn(`Some TTS calls failed: ${errors.join("; ")}`);
        }

        return { generated, errors, failedCount };
      },
    );

    // Step 5: Assemble final mix with timeline
    const assembledMix = await step.run("assemble-mix", () => {
      const finalSegments: FinalMixSegment[] = [];
      const voiceMap = new Map(
        voiceSegments.generated.map((v) => [v.segmentId, v]),
      );

      let currentTimeMs = 0;
      let totalCharacterCount = 0;

      for (const planSegment of mixPlan.segments) {
        if (planSegment.type === "voice") {
          const voiceData = voiceMap.get(planSegment.id);
          if (!voiceData) {
            // Skip failed voice segments
            console.warn(`Voice segment ${planSegment.id} not found, skipping`);
            continue;
          }

          const segment: FinalMixSegment = {
            id: planSegment.id,
            type: "VOICE",
            startMs: currentTimeMs,
            endMs: currentTimeMs + voiceData.durationMs,
            durationMs: voiceData.durationMs,
            audioUrl: voiceData.gcsPath,
            sourceType: "readwise",
            sourceId: voiceData.sourceArticle?.documentId,
            sourceTitle: voiceData.sourceArticle?.title,
            sourceUrl: voiceData.sourceArticle?.url,
            contentMode: "summary",
          };

          finalSegments.push(segment);
          currentTimeMs += voiceData.durationMs;
          totalCharacterCount += voiceData.characterCount;
        } else {
          // Music segment
          const segment: FinalMixSegment = {
            id: planSegment.id,
            type: "MUSIC",
            startMs: currentTimeMs,
            endMs: currentTimeMs + planSegment.playDurationMs,
            durationMs: planSegment.playDurationMs,
            tidalTrackId: planSegment.track.tidalTrackId,
            isrc: planSegment.track.isrc,
            trackTitle: planSegment.track.title,
            artistName: planSegment.track.artist,
            albumArtUrl: planSegment.track.albumArtUrl,
          };

          finalSegments.push(segment);
          currentTimeMs += planSegment.playDurationMs;
        }
      }

      return {
        segments: finalSegments,
        totalDurationMs: currentTimeMs,
        characterCount: totalCharacterCount,
        voiceSegmentCount: voiceSegments.generated.length,
        musicSegmentCount: mixPlan.segments.filter((s) => s.type === "music")
          .length,
      };
    });

    // Step 6: Save mix to backend
    await step.run("save-mix", async () => {
      // Convert to backend segment input format
      const segmentInputs: MixSegmentInput[] = assembledMix.segments.map(
        (seg) => ({
          id: seg.id,
          type: seg.type,
          startMs: seg.startMs,
          endMs: seg.endMs,
          durationMs: seg.durationMs,
          // Music fields
          tidalTrackId: seg.tidalTrackId,
          isrc: seg.isrc,
          trackTitle: seg.trackTitle,
          artistName: seg.artistName,
          albumArtUrl: seg.albumArtUrl,
          // Voice fields
          audioUrl: seg.audioUrl,
          sourceType: seg.sourceType,
          sourceId: seg.sourceId,
          sourceTitle: seg.sourceTitle,
          sourceUrl: seg.sourceUrl,
          contentMode: seg.contentMode,
        }),
      );

      // Update segments
      await backendClient.updateMixSegments(
        mixId,
        segmentInputs,
        assembledMix.totalDurationMs,
        assembledMix.characterCount,
      );

      // Update status to READY
      await backendClient.updateMixStatus(mixId, "READY");

      return { saved: true };
    });

    // Step 7: Emit completion event
    const completionResult = await step.run("emit-completion", async () => {
      const completedAt = Date.now();
      const durationMs = completedAt - startTime;

      await inngest.send({
        name: "mix/generation.completed",
        data: {
          mixId,
          userId,
          runId,
          completedAt,
          durationMs,
          result: {
            segmentCount: assembledMix.segments.length,
            voiceSegmentCount: assembledMix.voiceSegmentCount,
            musicSegmentCount: assembledMix.musicSegmentCount,
            totalDurationMs: assembledMix.totalDurationMs,
            characterCount: assembledMix.characterCount,
          },
        },
      });

      // Flush observability data
      await flushLangfuse();

      return {
        mixId,
        runId,
        completedAt,
        durationMs,
        result: {
          segmentCount: assembledMix.segments.length,
          voiceSegmentCount: assembledMix.voiceSegmentCount,
          musicSegmentCount: assembledMix.musicSegmentCount,
          totalDurationMs: assembledMix.totalDurationMs,
          characterCount: assembledMix.characterCount,
        },
      };
    });

    return completionResult;
  },
);
