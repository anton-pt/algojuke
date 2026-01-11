/**
 * TidalConnectionSection Tests
 *
 * Feature: ALG-33 - Readwise Reader API Token Integration
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TidalConnectionSection } from "../TidalConnectionSection";

describe("TidalConnectionSection", () => {
  describe("connected state", () => {
    it("displays connected status when isConnected is true", () => {
      render(
        <TidalConnectionSection
          isConnected={true}
          connectedAt="2026-01-10T12:00:00.000Z"
          loading={false}
        />,
      );

      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    it("displays connection date when connected", () => {
      render(
        <TidalConnectionSection
          isConnected={true}
          connectedAt="2026-01-10T12:00:00.000Z"
          loading={false}
        />,
      );

      expect(screen.getByText(/Connected on/)).toBeInTheDocument();
    });
  });

  describe("disconnected state", () => {
    it("displays not connected status when isConnected is false", () => {
      render(
        <TidalConnectionSection
          isConnected={false}
          connectedAt={null}
          loading={false}
        />,
      );

      expect(screen.getByText("Not connected")).toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("displays loading text when loading is true", () => {
      render(
        <TidalConnectionSection
          isConnected={false}
          connectedAt={null}
          loading={true}
        />,
      );

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  describe("content", () => {
    it("displays Tidal title", () => {
      render(
        <TidalConnectionSection
          isConnected={false}
          connectedAt={null}
          loading={false}
        />,
      );

      expect(screen.getByText("Tidal")).toBeInTheDocument();
    });

    it("displays description", () => {
      render(
        <TidalConnectionSection
          isConnected={false}
          connectedAt={null}
          loading={false}
        />,
      );

      expect(
        screen.getByText("Your music streaming service"),
      ).toBeInTheDocument();
    });
  });
});
