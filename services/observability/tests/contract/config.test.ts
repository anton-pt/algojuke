/**
 * Contract tests for Observability Configuration
 *
 * TDD: These tests are written FIRST and should FAIL until config.ts is implemented.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// Import will fail until implementation exists
import {
  LangfuseEnvConfigSchema,
  ObservabilityConfigSchema,
  loadConfig,
  type LangfuseEnvConfig,
  type ObservabilityConfig,
} from "../../src/config.js";

describe("LangfuseEnvConfigSchema", () => {
  it("should validate valid environment configuration", () => {
    const validConfig = {
      LANGFUSE_BASE_URL: "http://localhost:3000",
      LANGFUSE_PUBLIC_KEY: "pk-lf-local-dev",
      LANGFUSE_SECRET_KEY: "sk-lf-local-dev",
      LANGFUSE_ENABLED: "true",
    };

    const result = LangfuseEnvConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.LANGFUSE_BASE_URL).toBe("http://localhost:3000");
      expect(result.data.LANGFUSE_PUBLIC_KEY).toBe("pk-lf-local-dev");
      expect(result.data.LANGFUSE_SECRET_KEY).toBe("sk-lf-local-dev");
      expect(result.data.LANGFUSE_ENABLED).toBe(true);
    }
  });

  it("should use default values when optional fields are missing", () => {
    const minimalConfig = {
      LANGFUSE_PUBLIC_KEY: "pk-lf-test",
      LANGFUSE_SECRET_KEY: "sk-lf-test",
    };

    const result = LangfuseEnvConfigSchema.safeParse(minimalConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.LANGFUSE_BASE_URL).toBe("http://localhost:3000");
      expect(result.data.LANGFUSE_ENABLED).toBe(true);
    }
  });

  it("should reject missing required public key", () => {
    const invalidConfig = {
      LANGFUSE_SECRET_KEY: "sk-lf-test",
    };

    const result = LangfuseEnvConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it("should reject missing required secret key", () => {
    const invalidConfig = {
      LANGFUSE_PUBLIC_KEY: "pk-lf-test",
    };

    const result = LangfuseEnvConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it("should reject invalid URL format", () => {
    const invalidConfig = {
      LANGFUSE_BASE_URL: "not-a-url",
      LANGFUSE_PUBLIC_KEY: "pk-lf-test",
      LANGFUSE_SECRET_KEY: "sk-lf-test",
    };

    const result = LangfuseEnvConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it("should transform LANGFUSE_ENABLED string to boolean", () => {
    const configTrue = {
      LANGFUSE_PUBLIC_KEY: "pk-lf-test",
      LANGFUSE_SECRET_KEY: "sk-lf-test",
      LANGFUSE_ENABLED: "true",
    };

    const configFalse = {
      LANGFUSE_PUBLIC_KEY: "pk-lf-test",
      LANGFUSE_SECRET_KEY: "sk-lf-test",
      LANGFUSE_ENABLED: "false",
    };

    const resultTrue = LangfuseEnvConfigSchema.safeParse(configTrue);
    const resultFalse = LangfuseEnvConfigSchema.safeParse(configFalse);

    expect(resultTrue.success).toBe(true);
    expect(resultFalse.success).toBe(true);
    if (resultTrue.success) expect(resultTrue.data.LANGFUSE_ENABLED).toBe(true);
    if (resultFalse.success)
      expect(resultFalse.data.LANGFUSE_ENABLED).toBe(false);
  });
});

describe("ObservabilityConfigSchema", () => {
  it("should validate valid runtime configuration", () => {
    const validConfig = {
      flushIntervalMs: 500,
      exportMode: "batched" as const,
    };

    const result = ObservabilityConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.flushIntervalMs).toBe(500);
      expect(result.data.exportMode).toBe("batched");
    }
  });

  it("should use default values for optional runtime config", () => {
    const result = ObservabilityConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.flushIntervalMs).toBe(1000);
      expect(result.data.exportMode).toBe("batched");
    }
  });

  it("should reject invalid export mode", () => {
    const invalidConfig = {
      exportMode: "invalid",
    };

    const result = ObservabilityConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it("should reject non-positive flush interval", () => {
    const invalidConfig = {
      flushIntervalMs: 0,
    };

    const result = ObservabilityConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it("should accept immediate export mode", () => {
    const config = {
      exportMode: "immediate" as const,
    };

    const result = ObservabilityConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.exportMode).toBe("immediate");
    }
  });
});

describe("loadConfig", () => {
  it("should load configuration from environment variables", () => {
    // Set test environment variables
    process.env.LANGFUSE_BASE_URL = "http://localhost:3000";
    process.env.LANGFUSE_PUBLIC_KEY = "pk-lf-test";
    process.env.LANGFUSE_SECRET_KEY = "sk-lf-test";
    process.env.LANGFUSE_ENABLED = "true";

    const config = loadConfig();

    expect(config.env.LANGFUSE_BASE_URL).toBe("http://localhost:3000");
    expect(config.env.LANGFUSE_PUBLIC_KEY).toBe("pk-lf-test");
    expect(config.env.LANGFUSE_SECRET_KEY).toBe("sk-lf-test");
    expect(config.env.LANGFUSE_ENABLED).toBe(true);
    expect(config.options.flushIntervalMs).toBe(1000);
    expect(config.options.exportMode).toBe("batched");

    // Clean up
    delete process.env.LANGFUSE_BASE_URL;
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_ENABLED;
  });

  it("should accept custom runtime options", () => {
    process.env.LANGFUSE_PUBLIC_KEY = "pk-lf-test";
    process.env.LANGFUSE_SECRET_KEY = "sk-lf-test";

    const config = loadConfig({
      flushIntervalMs: 500,
      exportMode: "immediate",
    });

    expect(config.options.flushIntervalMs).toBe(500);
    expect(config.options.exportMode).toBe("immediate");

    // Clean up
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
  });

  it("should throw error when required env vars are missing", () => {
    // Ensure env vars are not set
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;

    expect(() => loadConfig()).toThrow();
  });
});
