/**
 * Zod schemas for Mix Generation Pipeline
 *
 * Feature: ALG-85 - Inngest mixGeneration Function (DJ Agent)
 *
 * Defines schemas for:
 * - Article content fetched from Readwise
 * - Mix plan structure with voice and music segments
 * - Voice script with SSML annotations
 * - Generated segment metadata
 */

import { z } from "zod/v3";

// =============================================================================
// Article Content Schemas
// =============================================================================

/**
 * Article content fetched from Readwise via backend GraphQL
 */
export const ArticleContentSchema = z.object({
  /**
   * Readwise document ID
   */
  documentId: z.string().min(1),

  /**
   * Article title
   */
  title: z.string().min(1),

  /**
   * Article author (may be null)
   */
  author: z.string().nullable(),

  /**
   * Original article URL
   */
  url: z.string().url(),

  /**
   * Processed content (summary, excerpt, or full based on contentMode)
   */
  content: z.string(),

  /**
   * Content mode used for processing
   */
  contentMode: z.enum(["summary", "excerpt", "full"]),
});

export type ArticleContent = z.infer<typeof ArticleContentSchema>;

// =============================================================================
// Voice Script Schemas
// =============================================================================

/**
 * Voice script with SSML annotations for Eleven Multilingual v2
 *
 * Supported SSML elements:
 * - <break time="x.xs" /> for pauses
 * - ALL CAPS for emphasis
 * - Punctuation for pacing
 *
 * @example
 * "Welcome back, music lovers!
 * <break time="0.8s" />
 * THIS next article... it's INCREDIBLE."
 */
export const VoiceScriptSchema = z.object({
  /**
   * Voice script text with SSML annotations
   */
  text: z.string().min(1),

  /**
   * Estimated duration in milliseconds (calculated by LLM or post-hoc)
   */
  estimatedDurationMs: z.number().int().nonnegative().optional(),

  /**
   * Character count for billing estimation
   */
  characterCount: z.number().int().min(1),

  /**
   * Source article this script introduces/discusses
   */
  sourceArticle: z
    .object({
      documentId: z.string(),
      title: z.string(),
      url: z.string(),
    })
    .nullable(),
});

export type VoiceScript = z.infer<typeof VoiceScriptSchema>;

// =============================================================================
// Music Track Schema
// =============================================================================

/**
 * Music track selected by the DJ agent
 */
export const MixMusicTrackSchema = z.object({
  /**
   * ISRC (International Standard Recording Code)
   */
  isrc: z.string().length(12),

  /**
   * Tidal track ID (if available)
   */
  tidalTrackId: z.string().optional(),

  /**
   * Track title
   */
  title: z.string(),

  /**
   * Artist name
   */
  artist: z.string(),

  /**
   * Album name
   */
  album: z.string().optional(),

  /**
   * Album artwork URL
   */
  albumArtUrl: z.string().url().optional(),

  /**
   * Track duration in milliseconds
   */
  durationMs: z.number().int().min(1),

  /**
   * DJ's reasoning for selecting this track
   */
  selectionReason: z.string().optional(),
});

export type MixMusicTrack = z.infer<typeof MixMusicTrackSchema>;

// =============================================================================
// Mix Segment Schemas
// =============================================================================

/**
 * Base segment properties
 */
const BaseSegmentSchema = z.object({
  /**
   * Unique segment ID (UUID)
   */
  id: z.string().uuid(),

  /**
   * Order index in the mix
   */
  order: z.number().int().nonnegative(),
});

/**
 * Voice segment in the mix plan
 */
export const VoicePlanSegmentSchema = BaseSegmentSchema.extend({
  type: z.literal("voice"),

  /**
   * Voice script for this segment
   */
  script: VoiceScriptSchema,
});

export type VoicePlanSegment = z.infer<typeof VoicePlanSegmentSchema>;

/**
 * Music segment in the mix plan
 */
export const MusicPlanSegmentSchema = BaseSegmentSchema.extend({
  type: z.literal("music"),

  /**
   * Selected music track
   */
  track: MixMusicTrackSchema,

  /**
   * Portion of track to play (for fading in/out)
   */
  playDurationMs: z.number().int().min(1),

  /**
   * Whether to fade in at start
   */
  fadeIn: z.boolean().default(false),

  /**
   * Whether to fade out at end
   */
  fadeOut: z.boolean().default(false),
});

export type MusicPlanSegment = z.infer<typeof MusicPlanSegmentSchema>;

/**
 * Union of all segment types in the mix plan
 */
export const MixPlanSegmentSchema = z.discriminatedUnion("type", [
  VoicePlanSegmentSchema,
  MusicPlanSegmentSchema,
]);

export type MixPlanSegment = z.infer<typeof MixPlanSegmentSchema>;

// =============================================================================
// Mix Plan Schema
// =============================================================================

/**
 * Complete mix plan generated by the DJ agent
 *
 * Contains ordered sequence of voice and music segments
 * with all metadata needed for audio generation
 */
export const MixPlanSchema = z.object({
  /**
   * Mix ID (from input event)
   */
  mixId: z.string().uuid(),

  /**
   * Mix title
   */
  title: z.string(),

  /**
   * Ordered list of segments
   */
  segments: z.array(MixPlanSegmentSchema).min(1),

  /**
   * DJ agent's overall narrative theme/concept
   */
  theme: z.string().optional(),

  /**
   * Number of articles covered
   */
  articleCount: z.number().int().min(1),

  /**
   * Estimated total duration in milliseconds
   */
  estimatedTotalDurationMs: z.number().int().min(1),
});

export type MixPlan = z.infer<typeof MixPlanSchema>;

// =============================================================================
// Generated Segment Schemas
// =============================================================================

/**
 * Result of generating a voice segment via TTS
 */
export const GeneratedVoiceSegmentSchema = z.object({
  /**
   * Segment ID (matches plan segment ID)
   */
  segmentId: z.string().uuid(),

  /**
   * GCS path to uploaded audio file
   */
  gcsPath: z.string(),

  /**
   * Actual duration from MP3 parsing (milliseconds)
   */
  durationMs: z.number().int().min(1),

  /**
   * Character count (for billing)
   */
  characterCount: z.number().int().min(1),

  /**
   * Source article metadata
   */
  sourceArticle: z
    .object({
      documentId: z.string(),
      title: z.string(),
      url: z.string(),
    })
    .nullable(),
});

export type GeneratedVoiceSegment = z.infer<typeof GeneratedVoiceSegmentSchema>;

// =============================================================================
// Final Mix Segment Schema
// =============================================================================

/**
 * Final mix segment with timeline positions
 */
export const FinalMixSegmentSchema = z.object({
  /**
   * Segment ID
   */
  id: z.string().uuid(),

  /**
   * Segment type
   */
  type: z.enum(["MUSIC", "VOICE"]),

  /**
   * Start position in timeline (milliseconds)
   */
  startMs: z.number().int().nonnegative(),

  /**
   * End position in timeline (milliseconds)
   */
  endMs: z.number().int().min(1),

  /**
   * Duration (milliseconds)
   */
  durationMs: z.number().int().min(1),

  // Music segment fields
  tidalTrackId: z.string().optional(),
  isrc: z.string().optional(),
  trackTitle: z.string().optional(),
  artistName: z.string().optional(),
  albumArtUrl: z.string().optional(),

  // Voice segment fields
  audioUrl: z.string().optional(),
  sourceType: z.string().optional(),
  sourceId: z.string().optional(),
  sourceTitle: z.string().optional(),
  sourceUrl: z.string().optional(),
  contentMode: z.string().optional(),
});

export type FinalMixSegment = z.infer<typeof FinalMixSegmentSchema>;

// =============================================================================
// Tool Schemas (for DJ Agent)
// =============================================================================

/**
 * Input schema for the finalizeMixPlan tool
 * Used by the DJ agent to output the final mix structure
 */
export const FinalizeMixPlanInputSchema = z.object({
  /**
   * Overall theme/narrative for the mix
   */
  theme: z.string().optional(),

  /**
   * Ordered segments with voice scripts and music selections
   */
  segments: z
    .array(
      z.object({
        type: z.enum(["voice", "music"]),

        // Voice segment fields
        voiceScript: z.string().optional(),
        sourceDocumentId: z.string().optional(),
        sourceTitle: z.string().optional(),
        sourceUrl: z.string().optional(),

        // Music segment fields
        isrc: z.string().optional(),
        tidalTrackId: z.string().optional(),
        trackTitle: z.string().optional(),
        artistName: z.string().optional(),
        albumName: z.string().optional(),
        albumArtUrl: z.string().optional(),
        trackDurationMs: z.number().int().optional(),
        playDurationMs: z.number().int().optional(),
        fadeIn: z.boolean().optional(),
        fadeOut: z.boolean().optional(),
        selectionReason: z.string().optional(),
      }),
    )
    .min(1),
});

export type FinalizeMixPlanInput = z.infer<typeof FinalizeMixPlanInputSchema>;

// =============================================================================
// ElevenLabs Voice Settings
// =============================================================================

/**
 * DJ voice settings for ElevenLabs Eleven Multilingual v2
 *
 * Optimized for energetic, engaging DJ delivery:
 * - Lower stability = more emotional range/energy
 * - High similarity boost = maintain voice consistency
 * - Moderate style = expressiveness without overdoing it
 * - Speaker boost = clarity and presence
 */
export const DJ_VOICE_SETTINGS = {
  stability: 0.45,
  similarityBoost: 0.75,
  style: 0.3,
  useSpeakerBoost: true,
} as const;

/**
 * Default voice ID (can be overridden via environment)
 * Using "Josh" - a natural, energetic male voice good for DJ content
 */
export const DEFAULT_DJ_VOICE_ID =
  process.env.ELEVENLABS_DJ_VOICE_ID ?? "TxGEqnHWrfWFTfGW9XjX";
