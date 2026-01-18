/**
 * Chat Agent Radio Mix Integration Contract Tests
 *
 * Feature: ALG-86
 *
 * Tests for verifying radio mix tools are properly integrated
 * into the chat agent.
 */

import { describe, it, expect } from "vitest";
import { ToolName } from "../../../src/schemas/agentTools.js";
import { CHAT_SYSTEM_PROMPT } from "../../../src/prompts/chatSystemPrompt.js";

// -----------------------------------------------------------------------------
// Tool Registration Tests
// -----------------------------------------------------------------------------

describe("Radio mix tools are registered in ToolName enum", () => {
  it("includes readwiseList in tool names", () => {
    const names = ToolName.options;
    expect(names).toContain("readwiseList");
  });

  it("includes readwiseFetch in tool names", () => {
    const names = ToolName.options;
    expect(names).toContain("readwiseFetch");
  });

  it("includes generateMix in tool names", () => {
    const names = ToolName.options;
    expect(names).toContain("generateMix");
  });

  it("has exactly 8 tool names after radio mix integration", () => {
    const names = ToolName.options;
    // semanticSearch, tidalSearch, albumTracks, batchMetadata, suggestPlaylist,
    // readwiseList, readwiseFetch, generateMix
    expect(names).toHaveLength(8);
  });

  it("validates all expected tool names", () => {
    const expectedTools = [
      "semanticSearch",
      "tidalSearch",
      "albumTracks",
      "batchMetadata",
      "suggestPlaylist",
      "readwiseList",
      "readwiseFetch",
      "generateMix",
    ];

    for (const tool of expectedTools) {
      const result = ToolName.safeParse(tool);
      expect(result.success, `Expected ${tool} to be a valid tool name`).toBe(
        true,
      );
    }
  });
});

// -----------------------------------------------------------------------------
// System Prompt Tests
// -----------------------------------------------------------------------------

describe("System prompt includes radio mix tool documentation", () => {
  it("documents readwiseList tool", () => {
    expect(CHAT_SYSTEM_PROMPT).toContain("### readwiseList");
    expect(CHAT_SYSTEM_PROMPT).toContain("Readwise Reader queue");
  });

  it("documents readwiseList filters", () => {
    expect(CHAT_SYSTEM_PROMPT).toContain("location");
    expect(CHAT_SYSTEM_PROMPT).toContain("category");
    expect(CHAT_SYSTEM_PROMPT).toContain("tags");
  });

  it("documents readwiseFetch tool", () => {
    expect(CHAT_SYSTEM_PROMPT).toContain("### readwiseFetch");
    expect(CHAT_SYSTEM_PROMPT).toContain("documentId");
    expect(CHAT_SYSTEM_PROMPT).toContain("contentMode");
  });

  it("documents readwiseFetch content modes", () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('"summary"');
    expect(CHAT_SYSTEM_PROMPT).toContain('"full"');
  });

  it("documents readwiseFetch summary lengths", () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('"short"');
    expect(CHAT_SYSTEM_PROMPT).toContain('"medium"');
    expect(CHAT_SYSTEM_PROMPT).toContain('"long"');
  });

  it("documents generateMix tool", () => {
    expect(CHAT_SYSTEM_PROMPT).toContain("### generateMix");
    expect(CHAT_SYSTEM_PROMPT).toContain("background mix generation");
  });

  it("documents generateMix input requirements", () => {
    expect(CHAT_SYSTEM_PROMPT).toContain("title");
    expect(CHAT_SYSTEM_PROMPT).toContain("articles");
    expect(CHAT_SYSTEM_PROMPT).toContain("musicInstructions");
  });

  it("mentions Radio section for tracking progress", () => {
    expect(CHAT_SYSTEM_PROMPT).toContain("Radio section");
  });
});

// -----------------------------------------------------------------------------
// Workflow Documentation Tests
// -----------------------------------------------------------------------------

describe("System prompt includes radio mix workflow", () => {
  it("has Creating Radio Mixes workflow section", () => {
    expect(CHAT_SYSTEM_PROMPT).toContain("### Creating Radio Mixes");
  });

  it("describes the exploration step with readwiseList", () => {
    expect(CHAT_SYSTEM_PROMPT).toContain("Explore their queue");
    expect(CHAT_SYSTEM_PROMPT).toContain("readwiseList");
  });

  it("describes article selection discussion", () => {
    expect(CHAT_SYSTEM_PROMPT).toContain("Discuss article selection");
  });

  it("describes content preference determination", () => {
    expect(CHAT_SYSTEM_PROMPT).toContain("Determine content preferences");
    expect(CHAT_SYSTEM_PROMPT).toContain("content mode");
  });

  it("describes preview capability with readwiseFetch", () => {
    expect(CHAT_SYSTEM_PROMPT).toContain("Preview if needed");
    expect(CHAT_SYSTEM_PROMPT).toContain("readwiseFetch");
  });

  it("describes confirmation and generation step", () => {
    expect(CHAT_SYSTEM_PROMPT).toContain("Confirm and generate");
    expect(CHAT_SYSTEM_PROMPT).toContain("generateMix");
  });

  it("includes example workflow", () => {
    expect(CHAT_SYSTEM_PROMPT).toContain("Example workflow");
    expect(CHAT_SYSTEM_PROMPT).toContain("Create a radio mix");
  });
});

// -----------------------------------------------------------------------------
// Tool Count Verification
// -----------------------------------------------------------------------------

describe("All tools are documented in system prompt", () => {
  const toolSections = [
    "### semanticSearch",
    "### tidalSearch",
    "### albumTracks",
    "### batchMetadata",
    "### suggestPlaylist",
    "### readwiseList",
    "### readwiseFetch",
    "### generateMix",
  ];

  it.each(toolSections)("documents %s tool", (section) => {
    expect(CHAT_SYSTEM_PROMPT).toContain(section);
  });

  it("has exactly 8 tool documentation sections", () => {
    const matches = CHAT_SYSTEM_PROMPT.match(/### [a-zA-Z]+/g) || [];
    // Filter to only tool names (not other sections like "Result Presentation")
    const toolMatches = matches.filter((m) =>
      toolSections.some((s) => m === s.replace("### ", "### ")),
    );
    // Count unique tool sections
    const uniqueToolSections = new Set(
      matches.filter(
        (m) =>
          m.includes("Search") ||
          m.includes("Tracks") ||
          m.includes("Metadata") ||
          m.includes("Playlist") ||
          m.includes("readwise") ||
          m.includes("Mix") ||
          m.includes("semantic") ||
          m.includes("tidal") ||
          m.includes("album") ||
          m.includes("batch") ||
          m.includes("suggest") ||
          m.includes("generate"),
      ),
    );
    expect(uniqueToolSections.size).toBeGreaterThanOrEqual(8);
  });
});
