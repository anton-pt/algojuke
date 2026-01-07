/**
 * ToolInvocation Component Tests
 *
 * Feature: 011-agent-tools, 017-tidal-playlist-export
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import {
  ToolInvocation,
  type ToolInvocationProps,
} from "../../../src/components/chat/ToolInvocation";

const defaultProps: ToolInvocationProps = {
  toolCallId: "tc_123",
  toolName: "semanticSearch",
  input: { query: "melancholic songs", limit: 10 },
  status: "executing",
};

/**
 * Helper to render ToolInvocation with Apollo MockedProvider
 */
function renderWithProviders(props: ToolInvocationProps) {
  return render(
    <MockedProvider mocks={[]} addTypename={false}>
      <ToolInvocation {...props} />
    </MockedProvider>,
  );
}

describe("ToolInvocation", () => {
  describe("Executing state", () => {
    it('shows spinner and "Searching..." status', () => {
      renderWithProviders(defaultProps);

      expect(screen.getByText("Searching...")).toBeInTheDocument();
      expect(screen.getByText("Semantic Search")).toBeInTheDocument();
    });

    it("does not show chevron when executing", () => {
      const { container } = renderWithProviders(defaultProps);

      expect(
        container.querySelector(".tool-invocation__chevron"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Completed state", () => {
    const completedProps: ToolInvocationProps = {
      ...defaultProps,
      status: "completed",
      summary: 'Found 8 tracks matching "melancholic songs"',
      resultCount: 8,
      durationMs: 1234,
      output: {
        tracks: [
          {
            isrc: "ABC123456789",
            title: "Someone Like You",
            artist: "Adele",
            inLibrary: true,
            isIndexed: true,
          },
          {
            isrc: "DEF123456789",
            title: "Fix You",
            artist: "Coldplay",
            inLibrary: false,
            isIndexed: true,
          },
        ],
        query: "melancholic songs",
        totalFound: 8,
        summary: "Found 8 tracks",
        durationMs: 1234,
      },
    };

    it('shows "Done" status and summary', () => {
      renderWithProviders(completedProps);

      expect(screen.getByText("Done")).toBeInTheDocument();
      expect(
        screen.getByText('Found 8 tracks matching "melancholic songs"'),
      ).toBeInTheDocument();
    });

    it("shows duration", () => {
      renderWithProviders(completedProps);

      expect(screen.getByText("1.2s")).toBeInTheDocument();
    });

    it("shows chevron when results available", () => {
      const { container } = renderWithProviders(completedProps);

      expect(
        container.querySelector(".tool-invocation__chevron"),
      ).toBeInTheDocument();
    });

    it("expands to show results on click", () => {
      renderWithProviders(completedProps);

      // Results not visible initially
      expect(screen.queryByText("Someone Like You")).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(screen.getByRole("button"));

      // Results now visible
      expect(screen.getByText("Someone Like You")).toBeInTheDocument();
      expect(screen.getByText("Adele")).toBeInTheDocument();
      expect(screen.getByText("Fix You")).toBeInTheDocument();
    });

    it('shows "In Library" badge for library tracks', () => {
      renderWithProviders(completedProps);

      // Expand first
      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("In Library")).toBeInTheDocument();
    });
  });

  describe("Failed state", () => {
    const failedProps: ToolInvocationProps = {
      ...defaultProps,
      status: "failed",
      error: "Vector search service is temporarily unavailable",
    };

    it('shows "Failed" status', () => {
      renderWithProviders(failedProps);

      expect(screen.getByText("Failed")).toBeInTheDocument();
    });

    it("shows error message", () => {
      renderWithProviders(failedProps);

      expect(
        screen.getByText("Vector search service is temporarily unavailable"),
      ).toBeInTheDocument();
    });
  });

  describe("Tool name formatting", () => {
    it('formats semanticSearch as "Semantic Search"', () => {
      renderWithProviders({ ...defaultProps, toolName: "semanticSearch" });
      expect(screen.getByText("Semantic Search")).toBeInTheDocument();
    });

    it('formats tidalSearch as "Tidal Search"', () => {
      renderWithProviders({ ...defaultProps, toolName: "tidalSearch" });
      expect(screen.getByText("Tidal Search")).toBeInTheDocument();
    });

    it('formats batchMetadata as "Batch Metadata"', () => {
      renderWithProviders({ ...defaultProps, toolName: "batchMetadata" });
      expect(screen.getByText("Batch Metadata")).toBeInTheDocument();
    });

    it('formats albumTracks as "Album Tracks"', () => {
      renderWithProviders({ ...defaultProps, toolName: "albumTracks" });
      expect(screen.getByText("Album Tracks")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    const completedProps: ToolInvocationProps = {
      ...defaultProps,
      status: "completed",
      summary: "Found 5 tracks",
      resultCount: 5,
      output: {
        tracks: [
          {
            isrc: "ABC",
            title: "Test",
            artist: "Artist",
            inLibrary: false,
            isIndexed: true,
          },
        ],
      },
    };

    it('has role="button" when expandable', () => {
      renderWithProviders(completedProps);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("expands on Enter key", () => {
      renderWithProviders(completedProps);

      fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });

      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    it("expands on Space key", () => {
      renderWithProviders(completedProps);

      fireEvent.keyDown(screen.getByRole("button"), { key: " " });

      expect(screen.getByText("Test")).toBeInTheDocument();
    });
  });
});
