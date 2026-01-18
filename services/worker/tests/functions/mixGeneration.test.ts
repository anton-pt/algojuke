/**
 * Mix Generation Function Tests
 *
 * Feature: ALG-85 - Inngest mixGeneration Function (DJ Agent)
 *
 * Tests verify:
 * - Function structure and configuration
 * - Event schema validation
 * - Mix plan schema validation
 * - DJ agent prompt generation
 * - Function registration and exports
 *
 * Note: Full execution testing is performed manually via Inngest Dev Server
 * as the function requires external services (backend, ElevenLabs, GCS).
 */

import { describe, it, expect } from "vitest";
import { mixGeneration } from "../../src/inngest/functions/mixGeneration.js";
import { inngest } from "../../src/inngest/client.js";
import {
  MixGenerationRequestedEvent,
  MixArticleSchema,
} from "../../src/inngest/events.js";
import {
  ArticleContentSchema,
  VoiceScriptSchema,
  MixMusicTrackSchema,
  VoicePlanSegmentSchema,
  MusicPlanSegmentSchema,
  MixPlanSchema,
  FinalizeMixPlanInputSchema,
  GeneratedVoiceSegmentSchema,
  FinalMixSegmentSchema,
  DJ_VOICE_SETTINGS,
  DEFAULT_DJ_VOICE_ID,
} from "../../src/schemas/mixGeneration.js";
import {
  buildDiscoverySystemPrompt,
  buildDiscoveryUserPrompt,
  buildCompositionSystemPrompt,
  buildCompositionUserPrompt,
} from "../../src/prompts/djAgentPrompt.js";

describe("mixGeneration", () => {
  /**
   * Test: Verify function is properly exported
   */
  it("should export mixGeneration function", () => {
    expect(mixGeneration).toBeDefined();
    expect(typeof mixGeneration).toBe("object");
  });

  /**
   * Test: Verify Inngest client has mix generation event schemas
   */
  it("should have Inngest client with mix generation event schemas", () => {
    expect(inngest).toBeDefined();
    // The client is configured with mixGenerationEvents schemas in client.ts
    // Schema validation happens at runtime when events are sent
  });
});

describe("MixGenerationRequestedEvent schema", () => {
  const eventDataSchema = MixGenerationRequestedEvent.shape.data;

  it("should validate valid event data", () => {
    const validEvent = {
      mixId: "550e8400-e29b-41d4-a716-446655440000",
      userId: "user_12345",
      title: "My Morning Mix",
      articles: [
        {
          documentId: "doc_abc123",
          contentMode: "summary" as const,
        },
      ],
    };

    expect(() => eventDataSchema.parse(validEvent)).not.toThrow();
  });

  it("should require mixId, userId, title, and articles", () => {
    expect(() => eventDataSchema.parse({})).toThrow();
    expect(() =>
      eventDataSchema.parse({ mixId: "550e8400-e29b-41d4-a716-446655440000" }),
    ).toThrow();
    expect(() =>
      eventDataSchema.parse({
        mixId: "550e8400-e29b-41d4-a716-446655440000",
        userId: "user_12345",
      }),
    ).toThrow();
  });

  it("should reject invalid mixId (not UUID)", () => {
    const invalidEvent = {
      mixId: "not-a-uuid",
      userId: "user_12345",
      title: "My Mix",
      articles: [{ documentId: "doc_1", contentMode: "summary" }],
    };

    expect(() => eventDataSchema.parse(invalidEvent)).toThrow();
  });

  it("should require at least one article", () => {
    const noArticles = {
      mixId: "550e8400-e29b-41d4-a716-446655440000",
      userId: "user_12345",
      title: "My Mix",
      articles: [],
    };

    expect(() => eventDataSchema.parse(noArticles)).toThrow();
  });

  it("should reject more than 10 articles", () => {
    const tooManyArticles = {
      mixId: "550e8400-e29b-41d4-a716-446655440000",
      userId: "user_12345",
      title: "My Mix",
      articles: Array.from({ length: 11 }, (_, i) => ({
        documentId: `doc_${i}`,
        contentMode: "summary",
      })),
    };

    expect(() => eventDataSchema.parse(tooManyArticles)).toThrow();
  });

  it("should validate contentMode enum", () => {
    const validModes = ["summary", "excerpt", "full"];

    for (const mode of validModes) {
      expect(() =>
        MixArticleSchema.parse({ documentId: "doc_1", contentMode: mode }),
      ).not.toThrow();
    }

    expect(() =>
      MixArticleSchema.parse({ documentId: "doc_1", contentMode: "invalid" }),
    ).toThrow();
  });

  it("should accept optional fields", () => {
    const withOptionals = {
      mixId: "550e8400-e29b-41d4-a716-446655440000",
      userId: "user_12345",
      title: "My Mix",
      description: "A great morning mix",
      articles: [{ documentId: "doc_1", contentMode: "summary" }],
      musicInstructions: "Calm piano transitions building to ambient",
      conversationId: "550e8400-e29b-41d4-a716-446655440001",
      priority: 100,
    };

    expect(() => eventDataSchema.parse(withOptionals)).not.toThrow();
  });
});

describe("ArticleContent schema", () => {
  it("should validate valid article content", () => {
    const valid = {
      documentId: "doc_abc123",
      title: "How to Build Better Habits",
      author: "James Clear",
      url: "https://example.com/article",
      content: "Here is the processed article content...",
      contentMode: "summary",
    };

    expect(() => ArticleContentSchema.parse(valid)).not.toThrow();
  });

  it("should allow null author", () => {
    const nullAuthor = {
      documentId: "doc_abc123",
      title: "Article Title",
      author: null,
      url: "https://example.com/article",
      content: "Content here",
      contentMode: "full",
    };

    expect(() => ArticleContentSchema.parse(nullAuthor)).not.toThrow();
  });

  it("should require valid URL", () => {
    const invalidUrl = {
      documentId: "doc_abc123",
      title: "Article Title",
      author: "Author",
      url: "not-a-url",
      content: "Content here",
      contentMode: "summary",
    };

    expect(() => ArticleContentSchema.parse(invalidUrl)).toThrow();
  });
});

describe("VoiceScript schema", () => {
  it("should validate valid voice script", () => {
    const valid = {
      text: 'Welcome back, music lovers! <break time="0.8s" /> THIS next article is INCREDIBLE.',
      characterCount: 75,
      sourceArticle: {
        documentId: "doc_123",
        title: "Article Title",
        url: "https://example.com/article",
      },
    };

    expect(() => VoiceScriptSchema.parse(valid)).not.toThrow();
  });

  it("should allow null sourceArticle (for intro/outro)", () => {
    const noSource = {
      text: "Thanks for listening!",
      characterCount: 21,
      sourceArticle: null,
    };

    expect(() => VoiceScriptSchema.parse(noSource)).not.toThrow();
  });

  it("should require positive characterCount", () => {
    const zeroCount = {
      text: "Some text",
      characterCount: 0,
      sourceArticle: null,
    };

    expect(() => VoiceScriptSchema.parse(zeroCount)).toThrow();
  });
});

describe("MixMusicTrack schema", () => {
  it("should validate valid music track", () => {
    const valid = {
      isrc: "USRC11700001",
      tidalTrackId: "123456789",
      title: "Bohemian Rhapsody",
      artist: "Queen",
      album: "A Night at the Opera",
      albumArtUrl: "https://example.com/art.jpg",
      durationMs: 354000,
      selectionReason: "Matches the epic theme of the article",
    };

    expect(() => MixMusicTrackSchema.parse(valid)).not.toThrow();
  });

  it("should require 12-character ISRC", () => {
    const shortIsrc = {
      isrc: "SHORT",
      title: "Track",
      artist: "Artist",
      durationMs: 180000,
    };

    expect(() => MixMusicTrackSchema.parse(shortIsrc)).toThrow();

    const longIsrc = {
      isrc: "TOOLONGISRC12345",
      title: "Track",
      artist: "Artist",
      durationMs: 180000,
    };

    expect(() => MixMusicTrackSchema.parse(longIsrc)).toThrow();
  });

  it("should require positive durationMs", () => {
    const negDuration = {
      isrc: "USRC11700001",
      title: "Track",
      artist: "Artist",
      durationMs: -1000,
    };

    expect(() => MixMusicTrackSchema.parse(negDuration)).toThrow();
  });
});

describe("MixPlan schema", () => {
  it("should validate valid mix plan", () => {
    const valid = {
      mixId: "550e8400-e29b-41d4-a716-446655440000",
      title: "Morning Mix",
      theme: "Calm and inspiring",
      segments: [
        {
          type: "voice" as const,
          id: "550e8400-e29b-41d4-a716-446655440001",
          order: 0,
          script: {
            text: "Welcome!",
            characterCount: 8,
            sourceArticle: null,
          },
        },
        {
          type: "music" as const,
          id: "550e8400-e29b-41d4-a716-446655440002",
          order: 1,
          track: {
            isrc: "USRC11700001",
            title: "Opener",
            artist: "Artist",
            durationMs: 60000,
          },
          playDurationMs: 30000,
          fadeIn: true,
          fadeOut: true,
        },
      ],
      articleCount: 1,
      estimatedTotalDurationMs: 38000,
    };

    expect(() => MixPlanSchema.parse(valid)).not.toThrow();
  });

  it("should require at least one segment", () => {
    const noSegments = {
      mixId: "550e8400-e29b-41d4-a716-446655440000",
      title: "Empty Mix",
      segments: [],
      articleCount: 1,
      estimatedTotalDurationMs: 0,
    };

    expect(() => MixPlanSchema.parse(noSegments)).toThrow();
  });

  it("should validate segment type discriminator", () => {
    const validVoice = {
      type: "voice" as const,
      id: "550e8400-e29b-41d4-a716-446655440001",
      order: 0,
      script: { text: "Hello", characterCount: 5, sourceArticle: null },
    };

    const validMusic = {
      type: "music" as const,
      id: "550e8400-e29b-41d4-a716-446655440002",
      order: 1,
      track: {
        isrc: "USRC11700001",
        title: "Track",
        artist: "Artist",
        durationMs: 180000,
      },
      playDurationMs: 45000,
      fadeIn: false,
      fadeOut: false,
    };

    expect(() => VoicePlanSegmentSchema.parse(validVoice)).not.toThrow();
    expect(() => MusicPlanSegmentSchema.parse(validMusic)).not.toThrow();
  });
});

describe("FinalizeMixPlanInput schema", () => {
  it("should validate finalize input from agent", () => {
    const valid = {
      theme: "Energetic and inspiring",
      segments: [
        {
          type: "voice" as const,
          voiceScript: "Welcome to the show!",
        },
        {
          type: "music" as const,
          isrc: "USRC11700001",
          trackTitle: "Opening Track",
          artistName: "Artist",
          trackDurationMs: 180000,
          playDurationMs: 45000,
          fadeIn: true,
          fadeOut: true,
        },
      ],
    };

    expect(() => FinalizeMixPlanInputSchema.parse(valid)).not.toThrow();
  });

  it("should require at least one segment", () => {
    const noSegments = {
      theme: "Theme",
      segments: [],
    };

    expect(() => FinalizeMixPlanInputSchema.parse(noSegments)).toThrow();
  });
});

describe("GeneratedVoiceSegment schema", () => {
  it("should validate generated segment", () => {
    const valid = {
      segmentId: "550e8400-e29b-41d4-a716-446655440001",
      gcsPath: "mixes/abc123/voice/segment1.mp3",
      durationMs: 15000,
      characterCount: 250,
      sourceArticle: {
        documentId: "doc_123",
        title: "Article",
        url: "https://example.com",
      },
    };

    expect(() => GeneratedVoiceSegmentSchema.parse(valid)).not.toThrow();
  });
});

describe("FinalMixSegment schema", () => {
  it("should validate voice segment", () => {
    const voiceSegment = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      type: "VOICE" as const,
      startMs: 0,
      endMs: 15000,
      durationMs: 15000,
      audioUrl: "mixes/abc123/voice/segment1.mp3",
      sourceType: "readwise",
      sourceId: "doc_123",
      sourceTitle: "Article Title",
      sourceUrl: "https://example.com",
      contentMode: "summary",
    };

    expect(() => FinalMixSegmentSchema.parse(voiceSegment)).not.toThrow();
  });

  it("should validate music segment", () => {
    const musicSegment = {
      id: "550e8400-e29b-41d4-a716-446655440002",
      type: "MUSIC" as const,
      startMs: 15000,
      endMs: 60000,
      durationMs: 45000,
      tidalTrackId: "123456789",
      isrc: "USRC11700001",
      trackTitle: "Track Name",
      artistName: "Artist Name",
      albumArtUrl: "https://example.com/art.jpg",
    };

    expect(() => FinalMixSegmentSchema.parse(musicSegment)).not.toThrow();
  });
});

describe("DJ Voice Settings", () => {
  it("should have correct voice settings for DJ style", () => {
    expect(DJ_VOICE_SETTINGS).toEqual({
      stability: 0.45,
      similarityBoost: 0.75,
      style: 0.3,
      useSpeakerBoost: true,
    });
  });

  it("should have default DJ voice ID", () => {
    expect(DEFAULT_DJ_VOICE_ID).toBeDefined();
    expect(typeof DEFAULT_DJ_VOICE_ID).toBe("string");
    expect(DEFAULT_DJ_VOICE_ID.length).toBeGreaterThan(0);
  });
});

describe("DJ Agent Prompts", () => {
  describe("Discovery Phase", () => {
    it("should generate discovery system prompt", () => {
      const prompt = buildDiscoverySystemPrompt();

      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(100);

      // Should contain key instructions for discovery
      expect(prompt).toContain("music");
      expect(prompt).toContain("discovery");
      expect(prompt).toContain("semanticSearch");
      expect(prompt).toContain("tidalSearch");
      expect(prompt).toContain("batchMetadata");
    });

    it("should generate discovery user prompt with articles", () => {
      const articles = [
        {
          documentId: "doc_1",
          title: "The Power of Habits",
          author: "James Clear",
          url: "https://example.com/article1",
          content: "Article content about habits...",
          contentMode: "summary",
        },
        {
          documentId: "doc_2",
          title: "Mindfulness in Tech",
          author: null,
          url: "https://example.com/article2",
          content: "Article about mindfulness...",
          contentMode: "excerpt",
        },
      ];

      const prompt = buildDiscoveryUserPrompt("Morning Inspiration", articles);

      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");

      // Should contain mix title
      expect(prompt).toContain("Morning Inspiration");

      // Should contain article details
      expect(prompt).toContain("The Power of Habits");
      expect(prompt).toContain("James Clear");
      expect(prompt).toContain("Mindfulness in Tech");
      expect(prompt).toContain("Unknown"); // For null author

      // Should contain article count
      expect(prompt).toContain("2");
    });

    it("should include music instructions in discovery prompt when provided", () => {
      const articles = [
        {
          documentId: "doc_1",
          title: "Article",
          author: "Author",
          url: "https://example.com",
          content: "Content",
          contentMode: "summary",
        },
      ];

      const promptWithInstructions = buildDiscoveryUserPrompt(
        "Mix",
        articles,
        "Calm piano transitions building to ambient",
      );

      expect(promptWithInstructions).toContain("Music Instructions");
      expect(promptWithInstructions).toContain("Calm piano transitions");
    });

    it("should not include music instructions section when null", () => {
      const articles = [
        {
          documentId: "doc_1",
          title: "Article",
          author: "Author",
          url: "https://example.com",
          content: "Content",
          contentMode: "summary",
        },
      ];

      const promptWithoutInstructions = buildDiscoveryUserPrompt(
        "Mix",
        articles,
        null,
      );

      expect(promptWithoutInstructions).not.toContain("Music Instructions");
    });
  });

  describe("Composition Phase", () => {
    it("should generate composition system prompt", () => {
      const prompt = buildCompositionSystemPrompt();

      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(100);

      // Should contain key instructions for composition
      expect(prompt).toContain("DJ");
      expect(prompt).toContain("voice");
      expect(prompt).toContain("SSML");
      expect(prompt).toContain("break time");
    });

    it("should generate composition user prompt with articles and discovered music", () => {
      const articles = [
        {
          documentId: "doc_1",
          title: "The Power of Habits",
          author: "James Clear",
          url: "https://example.com/article1",
          content: "Article content about habits...",
          contentMode: "summary",
        },
      ];

      const discoveredMusic = JSON.stringify([
        { isrc: "USRC11700001", title: "Track 1", artist: "Artist 1" },
      ]);

      const prompt = buildCompositionUserPrompt(
        "Morning Inspiration",
        articles,
        discoveredMusic,
      );

      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");

      // Should contain mix title
      expect(prompt).toContain("Morning Inspiration");

      // Should contain article details
      expect(prompt).toContain("The Power of Habits");
      expect(prompt).toContain("James Clear");

      // Should contain discovered music
      expect(prompt).toContain("USRC11700001");
      expect(prompt).toContain("Track 1");
    });

    it("should include music instructions in composition prompt when provided", () => {
      const articles = [
        {
          documentId: "doc_1",
          title: "Article",
          author: "Author",
          url: "https://example.com",
          content: "Content",
          contentMode: "summary",
        },
      ];

      const promptWithInstructions = buildCompositionUserPrompt(
        "Mix",
        articles,
        "[]",
        "Calm piano transitions building to ambient",
      );

      expect(promptWithInstructions).toContain("Music Instructions");
      expect(promptWithInstructions).toContain("Calm piano transitions");
    });
  });
});
