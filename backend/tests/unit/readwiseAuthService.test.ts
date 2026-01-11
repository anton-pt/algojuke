/**
 * Unit tests for readwiseAuthService
 *
 * Tests Readwise token validation with mocked axios.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import axios, { AxiosError } from "axios";
import {
  validateReadwiseToken,
  getReadwiseErrorMessage,
} from "../../src/services/readwiseAuthService.js";

// Mock axios
vi.mock("axios");
const mockedAxios = vi.mocked(axios);

describe("readwiseAuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateReadwiseToken", () => {
    it("returns valid=true for HTTP 204 response", async () => {
      mockedAxios.get.mockResolvedValue({ status: 204 });

      const result = await validateReadwiseToken("valid_token");

      expect(result).toEqual({ valid: true });
      expect(mockedAxios.get).toHaveBeenCalledWith(
        "https://readwise.io/api/v2/auth/",
        {
          headers: { Authorization: "Token valid_token" },
          timeout: 10000,
          validateStatus: expect.any(Function),
        },
      );
    });

    it("returns TOKEN_REVOKED for HTTP 401 response", async () => {
      mockedAxios.get.mockResolvedValue({ status: 401 });

      const result = await validateReadwiseToken("revoked_token");

      expect(result).toEqual({ valid: false, errorCode: "TOKEN_REVOKED" });
    });

    it("returns INVALID_TOKEN for other 4xx responses", async () => {
      mockedAxios.get.mockResolvedValue({ status: 400 });

      const result = await validateReadwiseToken("bad_token");

      expect(result).toEqual({ valid: false, errorCode: "INVALID_TOKEN" });
    });

    it("returns INVALID_TOKEN for 5xx responses", async () => {
      mockedAxios.get.mockResolvedValue({ status: 500 });

      const result = await validateReadwiseToken("some_token");

      expect(result).toEqual({ valid: false, errorCode: "INVALID_TOKEN" });
    });

    it("returns TIMEOUT for ECONNABORTED error", async () => {
      const timeoutError = new Error("timeout") as AxiosError;
      timeoutError.code = "ECONNABORTED";
      mockedAxios.get.mockRejectedValue(timeoutError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const result = await validateReadwiseToken("any_token");

      expect(result).toEqual({ valid: false, errorCode: "TIMEOUT" });
    });

    it("returns NETWORK_ERROR for other axios errors", async () => {
      const networkError = new Error("Network Error") as AxiosError;
      networkError.code = "ENOTFOUND";
      mockedAxios.get.mockRejectedValue(networkError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const result = await validateReadwiseToken("any_token");

      expect(result).toEqual({ valid: false, errorCode: "NETWORK_ERROR" });
    });

    it("returns UNKNOWN for non-axios errors", async () => {
      const genericError = new Error("Something went wrong");
      mockedAxios.get.mockRejectedValue(genericError);
      mockedAxios.isAxiosError.mockReturnValue(false);

      const result = await validateReadwiseToken("any_token");

      expect(result).toEqual({ valid: false, errorCode: "UNKNOWN" });
    });
  });

  describe("getReadwiseErrorMessage", () => {
    it("returns correct message for INVALID_TOKEN", () => {
      expect(getReadwiseErrorMessage("INVALID_TOKEN")).toBe(
        "Invalid token. Please check your token and try again.",
      );
    });

    it("returns correct message for TOKEN_REVOKED", () => {
      expect(getReadwiseErrorMessage("TOKEN_REVOKED")).toBe(
        "Token is invalid or has been revoked. Please generate a new token.",
      );
    });

    it("returns correct message for NETWORK_ERROR", () => {
      expect(getReadwiseErrorMessage("NETWORK_ERROR")).toBe(
        "Unable to verify token. Please try again later.",
      );
    });

    it("returns correct message for TIMEOUT", () => {
      expect(getReadwiseErrorMessage("TIMEOUT")).toBe(
        "Connection timed out. Please try again.",
      );
    });

    it("returns correct message for UNKNOWN", () => {
      expect(getReadwiseErrorMessage("UNKNOWN")).toBe(
        "Unable to verify token. Please try again later.",
      );
    });
  });
});
