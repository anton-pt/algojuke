/**
 * ReadwiseConnectionSection Tests
 *
 * Feature: ALG-33 - Readwise Reader API Token Integration
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { ReadwiseConnectionSection } from "../ReadwiseConnectionSection";
import {
  CONNECT_READWISE,
  DISCONNECT_READWISE,
} from "../../../graphql/settings";

const mockOnConnectionChange = vi.fn();

const renderWithProvider = (
  component: React.ReactNode,
  mocks: MockedResponse[] = [],
) => {
  return render(<MockedProvider mocks={mocks}>{component}</MockedProvider>);
};

describe("ReadwiseConnectionSection", () => {
  beforeEach(() => {
    mockOnConnectionChange.mockClear();
  });

  describe("disconnected state", () => {
    it("displays not connected status", () => {
      renderWithProvider(
        <ReadwiseConnectionSection
          isConnected={false}
          connectedAt={null}
          loading={false}
          onConnectionChange={mockOnConnectionChange}
        />,
      );

      expect(screen.getByText("Not connected")).toBeInTheDocument();
    });

    it("displays token input form", () => {
      renderWithProvider(
        <ReadwiseConnectionSection
          isConnected={false}
          connectedAt={null}
          loading={false}
          onConnectionChange={mockOnConnectionChange}
        />,
      );

      expect(screen.getByLabelText("Access Token")).toBeInTheDocument();
    });

    it("displays link to get access token", () => {
      renderWithProvider(
        <ReadwiseConnectionSection
          isConnected={false}
          connectedAt={null}
          loading={false}
          onConnectionChange={mockOnConnectionChange}
        />,
      );

      const link = screen.getByText("Get your access token");
      expect(link).toHaveAttribute("href", "https://readwise.io/access_token");
      expect(link).toHaveAttribute("target", "_blank");
    });

    it("displays subscription note", () => {
      renderWithProvider(
        <ReadwiseConnectionSection
          isConnected={false}
          connectedAt={null}
          loading={false}
          onConnectionChange={mockOnConnectionChange}
        />,
      );

      expect(
        screen.getByText(/Readwise requires a paid subscription/),
      ).toBeInTheDocument();
    });

    it("disables connect button when token is empty", () => {
      renderWithProvider(
        <ReadwiseConnectionSection
          isConnected={false}
          connectedAt={null}
          loading={false}
          onConnectionChange={mockOnConnectionChange}
        />,
      );

      const button = screen.getByRole("button", { name: "Connect" });
      expect(button).toBeDisabled();
    });

    it("enables connect button when token is entered", () => {
      renderWithProvider(
        <ReadwiseConnectionSection
          isConnected={false}
          connectedAt={null}
          loading={false}
          onConnectionChange={mockOnConnectionChange}
        />,
      );

      const input = screen.getByLabelText("Access Token");
      fireEvent.change(input, { target: { value: "test-token" } });

      const button = screen.getByRole("button", { name: "Connect" });
      expect(button).not.toBeDisabled();
    });
  });

  describe("connected state", () => {
    it("displays connected status", () => {
      renderWithProvider(
        <ReadwiseConnectionSection
          isConnected={true}
          connectedAt="2026-01-10T12:00:00.000Z"
          loading={false}
          onConnectionChange={mockOnConnectionChange}
        />,
      );

      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    it("displays connection date", () => {
      renderWithProvider(
        <ReadwiseConnectionSection
          isConnected={true}
          connectedAt="2026-01-10T12:00:00.000Z"
          loading={false}
          onConnectionChange={mockOnConnectionChange}
        />,
      );

      expect(screen.getByText(/Connected on/)).toBeInTheDocument();
    });

    it("displays disconnect button", () => {
      renderWithProvider(
        <ReadwiseConnectionSection
          isConnected={true}
          connectedAt="2026-01-10T12:00:00.000Z"
          loading={false}
          onConnectionChange={mockOnConnectionChange}
        />,
      );

      expect(
        screen.getByRole("button", { name: "Disconnect" }),
      ).toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("displays loading text", () => {
      renderWithProvider(
        <ReadwiseConnectionSection
          isConnected={false}
          connectedAt={null}
          loading={true}
          onConnectionChange={mockOnConnectionChange}
        />,
      );

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  describe("connect flow", () => {
    it("shows error when submitting empty token", async () => {
      renderWithProvider(
        <ReadwiseConnectionSection
          isConnected={false}
          connectedAt={null}
          loading={false}
          onConnectionChange={mockOnConnectionChange}
        />,
      );

      // Enter whitespace-only token
      const input = screen.getByLabelText("Access Token");
      fireEvent.change(input, { target: { value: "   " } });

      const form = input.closest("form");
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText("Token is required")).toBeInTheDocument();
      });
    });

    it("calls mutation with token on submit", async () => {
      const mocks = [
        {
          request: {
            query: CONNECT_READWISE,
            variables: { accessToken: "valid-token" },
          },
          result: {
            data: {
              connectReadwise: {
                __typename: "ReadwiseConnectionSuccess",
                connectedAt: "2026-01-11T12:00:00.000Z",
              },
            },
          },
        },
      ];

      renderWithProvider(
        <ReadwiseConnectionSection
          isConnected={false}
          connectedAt={null}
          loading={false}
          onConnectionChange={mockOnConnectionChange}
        />,
        mocks,
      );

      const input = screen.getByLabelText("Access Token");
      fireEvent.change(input, { target: { value: "valid-token" } });

      const button = screen.getByRole("button", { name: "Connect" });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOnConnectionChange).toHaveBeenCalled();
      });
    });

    it("displays validation error from server", async () => {
      const mocks = [
        {
          request: {
            query: CONNECT_READWISE,
            variables: { accessToken: "invalid-token" },
          },
          result: {
            data: {
              connectReadwise: {
                __typename: "ReadwiseValidationError",
                message: "Token is invalid or has been revoked.",
                code: "TOKEN_REVOKED",
              },
            },
          },
        },
      ];

      renderWithProvider(
        <ReadwiseConnectionSection
          isConnected={false}
          connectedAt={null}
          loading={false}
          onConnectionChange={mockOnConnectionChange}
        />,
        mocks,
      );

      const input = screen.getByLabelText("Access Token");
      fireEvent.change(input, { target: { value: "invalid-token" } });

      const button = screen.getByRole("button", { name: "Connect" });
      fireEvent.click(button);

      await waitFor(() => {
        expect(
          screen.getByText("Token is invalid or has been revoked."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("disconnect flow", () => {
    it("shows confirmation dialog when disconnect clicked", () => {
      renderWithProvider(
        <ReadwiseConnectionSection
          isConnected={true}
          connectedAt="2026-01-10T12:00:00.000Z"
          loading={false}
          onConnectionChange={mockOnConnectionChange}
        />,
      );

      const disconnectButton = screen.getByRole("button", {
        name: "Disconnect",
      });
      fireEvent.click(disconnectButton);

      expect(screen.getByText("Disconnect Readwise?")).toBeInTheDocument();
    });

    it("hides dialog when cancel clicked", () => {
      renderWithProvider(
        <ReadwiseConnectionSection
          isConnected={true}
          connectedAt="2026-01-10T12:00:00.000Z"
          loading={false}
          onConnectionChange={mockOnConnectionChange}
        />,
      );

      const disconnectButton = screen.getByRole("button", {
        name: "Disconnect",
      });
      fireEvent.click(disconnectButton);

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButton);

      expect(
        screen.queryByText("Disconnect Readwise?"),
      ).not.toBeInTheDocument();
    });

    it("calls disconnect mutation when confirmed", async () => {
      const mocks = [
        {
          request: {
            query: DISCONNECT_READWISE,
          },
          result: {
            data: {
              disconnectReadwise: {
                __typename: "ReadwiseDisconnectSuccess",
                success: true,
              },
            },
          },
        },
      ];

      renderWithProvider(
        <ReadwiseConnectionSection
          isConnected={true}
          connectedAt="2026-01-10T12:00:00.000Z"
          loading={false}
          onConnectionChange={mockOnConnectionChange}
        />,
        mocks,
      );

      // Click disconnect to show dialog
      const disconnectButton = screen.getByRole("button", {
        name: "Disconnect",
      });
      fireEvent.click(disconnectButton);

      // Click confirm disconnect in dialog
      const confirmButtons = screen.getAllByRole("button", {
        name: "Disconnect",
      });
      // The second "Disconnect" button is in the dialog
      fireEvent.click(confirmButtons[1]);

      await waitFor(() => {
        expect(mockOnConnectionChange).toHaveBeenCalled();
      });
    });
  });

  describe("content", () => {
    it("displays Readwise title", () => {
      renderWithProvider(
        <ReadwiseConnectionSection
          isConnected={false}
          connectedAt={null}
          loading={false}
          onConnectionChange={mockOnConnectionChange}
        />,
      );

      expect(screen.getByText("Readwise")).toBeInTheDocument();
    });

    it("displays description", () => {
      renderWithProvider(
        <ReadwiseConnectionSection
          isConnected={false}
          connectedAt={null}
          loading={false}
          onConnectionChange={mockOnConnectionChange}
        />,
      );

      expect(
        screen.getByText("Import highlights from your reading"),
      ).toBeInTheDocument();
    });
  });
});
