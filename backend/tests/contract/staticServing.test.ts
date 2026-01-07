/**
 * Static Serving Contract Tests
 *
 * Tests for feature #41 - Serve Frontend SPA from Backend in Production
 *
 * These tests validate:
 * 1. Static serving is only enabled in production mode
 * 2. API routes are correctly identified and not caught by SPA fallback
 * 3. SPA fallback serves index.html with correct cache headers
 * 4. Static assets are served with long-term cache headers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express, { Express, Request, Response } from "express";
import request from "supertest";
import { join } from "path";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import {
  shouldEnableStaticServing,
  isApiRoute,
  createSpaFallbackHandler,
  applyStaticServing,
  getDefaultPublicPath,
} from "../../src/middleware/staticServing.js";

describe("Static Serving Contract Tests", () => {
  describe("shouldEnableStaticServing", () => {
    let tempDir: string;

    beforeEach(() => {
      // Create a temporary directory for testing
      tempDir = mkdtempSync(join(tmpdir(), "static-serving-test-"));
    });

    afterEach(() => {
      // Clean up temporary directory
      rmSync(tempDir, { recursive: true, force: true });
    });

    it("returns false when NODE_ENV is not production", () => {
      // Create index.html in temp dir
      writeFileSync(join(tempDir, "index.html"), "<html></html>");

      expect(shouldEnableStaticServing("development", tempDir)).toBe(false);
      expect(shouldEnableStaticServing("test", tempDir)).toBe(false);
      expect(shouldEnableStaticServing(undefined, tempDir)).toBe(false);
    });

    it("returns false when NODE_ENV is production but index.html does not exist", () => {
      // Don't create index.html
      expect(shouldEnableStaticServing("production", tempDir)).toBe(false);
    });

    it("returns true when NODE_ENV is production and index.html exists", () => {
      // Create index.html
      writeFileSync(join(tempDir, "index.html"), "<html></html>");

      expect(shouldEnableStaticServing("production", tempDir)).toBe(true);
    });

    it("handles non-existent public path gracefully", () => {
      const nonExistentPath = join(tempDir, "non-existent-subdir");
      expect(shouldEnableStaticServing("production", nonExistentPath)).toBe(
        false,
      );
    });
  });

  describe("isApiRoute", () => {
    describe("routes that should be API routes (NOT caught by SPA fallback)", () => {
      const apiRoutes = [
        "/health",
        "/graphql",
        "/api",
        "/api/",
        "/api/chat",
        "/api/chat/stream",
        "/api/auth",
        "/api/auth/status",
        "/api/some/deeply/nested/route",
      ];

      it.each(apiRoutes)("identifies %s as an API route", (route) => {
        expect(isApiRoute(route)).toBe(true);
      });
    });

    describe("routes that should NOT be API routes (caught by SPA fallback)", () => {
      const spaRoutes = [
        "/",
        "/chat",
        "/chat/abc-123",
        "/library",
        "/library/albums",
        "/discover",
        "/settings",
        "/profile",
        "/some/random/path",
        "/apidocs", // Does not match /api pattern (no slash or end)
        "/graphql-playground", // Does not match /graphql exactly
        "/healthy", // Does not match /health exactly
      ];

      it.each(spaRoutes)("identifies %s as NOT an API route", (route) => {
        expect(isApiRoute(route)).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("handles paths with trailing slashes (normalized)", () => {
        // Trailing slashes are stripped during normalization,
        // so /health/ becomes /health which matches the API pattern
        expect(isApiRoute("/health/")).toBe(true);
        expect(isApiRoute("/graphql/")).toBe(true);
        expect(isApiRoute("/api/")).toBe(true);
      });

      it("handles paths with leading slashes normalization", () => {
        expect(isApiRoute("health")).toBe(true);
        expect(isApiRoute("graphql")).toBe(true);
        expect(isApiRoute("api/chat")).toBe(true);
      });

      it("handles double slashes", () => {
        expect(isApiRoute("//health")).toBe(true);
        expect(isApiRoute("//api//chat")).toBe(true);
      });
    });
  });

  describe("createSpaFallbackHandler", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), "spa-fallback-test-"));
      writeFileSync(
        join(tempDir, "index.html"),
        "<!DOCTYPE html><html><body>SPA</body></html>",
      );
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it("creates a handler that serves index.html", async () => {
      const app = express();
      app.get("*", createSpaFallbackHandler(tempDir));

      const response = await request(app).get("/any/path");

      expect(response.status).toBe(200);
      expect(response.text).toContain("<!DOCTYPE html>");
      expect(response.text).toContain("SPA");
    });

    it("sets Cache-Control header to no-cache", async () => {
      const app = express();
      app.get("*", createSpaFallbackHandler(tempDir));

      const response = await request(app).get("/any/path");

      expect(response.headers["cache-control"]).toBe(
        "no-cache, no-store, must-revalidate",
      );
    });
  });

  describe("applyStaticServing", () => {
    let tempDir: string;
    let app: Express;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), "apply-static-test-"));
      app = express();
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it("returns false when not enabled", () => {
      const result = applyStaticServing(app, {
        publicPath: tempDir,
        enabled: false,
      });

      expect(result).toBe(false);
    });

    it("returns false when public path does not exist", () => {
      const nonExistentPath = join(tempDir, "non-existent");

      const result = applyStaticServing(app, {
        publicPath: nonExistentPath,
        enabled: true,
      });

      expect(result).toBe(false);
    });

    it("returns true and serves static files when enabled with valid path", async () => {
      // Create index.html and a static asset
      writeFileSync(
        join(tempDir, "index.html"),
        "<!DOCTYPE html><html><body>App</body></html>",
      );
      mkdirSync(join(tempDir, "assets"), { recursive: true });
      writeFileSync(
        join(tempDir, "assets", "main.js"),
        "console.log('hello');",
      );

      const result = applyStaticServing(app, {
        publicPath: tempDir,
        enabled: true,
      });

      expect(result).toBe(true);

      // Test static file serving
      const jsResponse = await request(app).get("/assets/main.js");
      expect(jsResponse.status).toBe(200);
      expect(jsResponse.text).toContain("console.log");
    });

    it("serves index.html for SPA routes (fallback)", async () => {
      writeFileSync(
        join(tempDir, "index.html"),
        "<!DOCTYPE html><html><body>SPA</body></html>",
      );

      applyStaticServing(app, {
        publicPath: tempDir,
        enabled: true,
      });

      // Test SPA fallback
      const response = await request(app).get("/chat/abc-123");
      expect(response.status).toBe(200);
      expect(response.text).toContain("SPA");
    });

    it("sets long cache for static assets", async () => {
      writeFileSync(
        join(tempDir, "index.html"),
        "<!DOCTYPE html><html></html>",
      );
      mkdirSync(join(tempDir, "assets"), { recursive: true });
      writeFileSync(join(tempDir, "assets", "style.css"), "body { }");

      applyStaticServing(app, {
        publicPath: tempDir,
        enabled: true,
      });

      const cssResponse = await request(app).get("/assets/style.css");
      expect(cssResponse.status).toBe(200);
      // maxAge: '1y' translates to approximately 31536000 seconds
      expect(cssResponse.headers["cache-control"]).toContain("max-age=");
    });
  });

  describe("getDefaultPublicPath", () => {
    it("returns path relative to dist directory", () => {
      const dirname = "/app/dist";
      const result = getDefaultPublicPath(dirname);
      expect(result).toBe("/app/public");
    });

    it("handles nested directories", () => {
      const dirname = "/home/user/project/backend/dist";
      const result = getDefaultPublicPath(dirname);
      expect(result).toBe("/home/user/project/backend/public");
    });
  });

  describe("Route Priority Integration", () => {
    let tempDir: string;
    let app: Express;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), "route-priority-test-"));
      writeFileSync(
        join(tempDir, "index.html"),
        "<!DOCTYPE html><html><body>SPA Fallback</body></html>",
      );
      app = express();
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it("API routes defined before static serving take precedence", async () => {
      // Register API routes first (mimicking server.ts order)
      app.get("/health", (_req, res) => {
        res.json({ status: "ok" });
      });

      app.get("/api/test", (_req, res) => {
        res.json({ api: "response" });
      });

      app.post("/graphql", (_req, res) => {
        res.json({ data: {} });
      });

      // Then apply static serving (like in production server.ts)
      applyStaticServing(app, {
        publicPath: tempDir,
        enabled: true,
      });

      // Verify API routes are NOT caught by SPA fallback
      const healthResponse = await request(app).get("/health");
      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body).toEqual({ status: "ok" });
      expect(healthResponse.text).not.toContain("SPA Fallback");

      const apiResponse = await request(app).get("/api/test");
      expect(apiResponse.status).toBe(200);
      expect(apiResponse.body).toEqual({ api: "response" });

      const graphqlResponse = await request(app).post("/graphql");
      expect(graphqlResponse.status).toBe(200);
      expect(graphqlResponse.body).toEqual({ data: {} });

      // Verify SPA routes ARE caught by fallback
      const spaResponse = await request(app).get("/chat/some-id");
      expect(spaResponse.status).toBe(200);
      expect(spaResponse.text).toContain("SPA Fallback");
    });

    it("serves actual static files before SPA fallback", async () => {
      // Create a static file
      mkdirSync(join(tempDir, "assets"), { recursive: true });
      writeFileSync(
        join(tempDir, "assets", "app.js"),
        "// App bundle\nconsole.log('app');",
      );

      applyStaticServing(app, {
        publicPath: tempDir,
        enabled: true,
      });

      // Actual static file should be served
      const staticResponse = await request(app).get("/assets/app.js");
      expect(staticResponse.status).toBe(200);
      expect(staticResponse.text).toContain("// App bundle");

      // Non-existent file should fall back to index.html
      const missingResponse = await request(app).get("/assets/missing.js");
      expect(missingResponse.status).toBe(200);
      expect(missingResponse.text).toContain("SPA Fallback");
    });
  });

  describe("Acceptance Scenarios from Spec", () => {
    let tempDir: string;
    let app: Express;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), "acceptance-test-"));
      writeFileSync(
        join(tempDir, "index.html"),
        '<!DOCTYPE html><html><head><title>AlgoJuke</title></head><body><div id="root"></div></body></html>',
      );
      app = express();
      app.use(express.json());
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    describe("US-001: Access Frontend Application", () => {
      it("navigating to root URL (/) shows frontend application", async () => {
        // Simulate production setup
        applyStaticServing(app, {
          publicPath: tempDir,
          enabled: true,
        });

        const response = await request(app).get("/");
        expect(response.status).toBe(200);
        expect(response.text).toContain("<!DOCTYPE html>");
        expect(response.text).toContain('<div id="root">');
      });

      it("navigating to /graphql returns API response, not frontend", async () => {
        // Register GraphQL route first
        app.post("/graphql", (_req, res) => {
          res.json({ data: { __schema: {} } });
        });

        applyStaticServing(app, {
          publicPath: tempDir,
          enabled: true,
        });

        const response = await request(app).post("/graphql");
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("data");
        expect(response.text).not.toContain("<!DOCTYPE html>");
      });

      it("navigating to /api/chat returns API response, not frontend", async () => {
        // Register API route first
        app.get("/api/chat", (_req, res) => {
          res.json({ chats: [] });
        });

        applyStaticServing(app, {
          publicPath: tempDir,
          enabled: true,
        });

        const response = await request(app).get("/api/chat");
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("chats");
        expect(response.text).not.toContain("<!DOCTYPE html>");
      });
    });

    describe("US-002: Client-Side Routing Support", () => {
      it("direct link to /chat/abc-123 serves frontend with correct route", async () => {
        applyStaticServing(app, {
          publicPath: tempDir,
          enabled: true,
        });

        const response = await request(app).get("/chat/abc-123");
        expect(response.status).toBe(200);
        expect(response.text).toContain("<!DOCTYPE html>");
        // React Router will handle the actual route on client side
      });

      it("frontend API calls to /graphql are handled by backend", async () => {
        app.use(express.json());
        app.post("/graphql", (req, res) => {
          res.json({ data: req.body });
        });

        applyStaticServing(app, {
          publicPath: tempDir,
          enabled: true,
        });

        const response = await request(app)
          .post("/graphql")
          .send({ query: "{ test }" })
          .set("Content-Type", "application/json");

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({ query: "{ test }" });
      });

      it("frontend API calls to /api/* are handled by backend", async () => {
        app.get("/api/auth/status", (_req, res) => {
          res.json({ authenticated: true });
        });

        applyStaticServing(app, {
          publicPath: tempDir,
          enabled: true,
        });

        const response = await request(app).get("/api/auth/status");
        expect(response.status).toBe(200);
        expect(response.body.authenticated).toBe(true);
      });
    });

    describe("US-003: Static Asset Caching", () => {
      it("hashed assets include long-term cache headers", async () => {
        mkdirSync(join(tempDir, "assets"), { recursive: true });
        writeFileSync(
          join(tempDir, "assets", "main.abc123.js"),
          "// hashed bundle",
        );

        applyStaticServing(app, {
          publicPath: tempDir,
          enabled: true,
        });

        const response = await request(app).get("/assets/main.abc123.js");
        expect(response.status).toBe(200);
        // Cache-Control should include max-age (1y = 31536000 seconds)
        expect(response.headers["cache-control"]).toMatch(/max-age=\d+/);
      });

      it("index.html includes no-cache headers", async () => {
        applyStaticServing(app, {
          publicPath: tempDir,
          enabled: true,
        });

        // Request index.html via SPA fallback
        const response = await request(app).get("/");
        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe(
          "no-cache, no-store, must-revalidate",
        );
      });
    });
  });

  describe("Production-Only Behavior (FR-004)", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), "prod-only-test-"));
      writeFileSync(
        join(tempDir, "index.html"),
        "<!DOCTYPE html><html></html>",
      );
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it("shouldEnableStaticServing returns false in development", () => {
      expect(shouldEnableStaticServing("development", tempDir)).toBe(false);
    });

    it("shouldEnableStaticServing returns false in test", () => {
      expect(shouldEnableStaticServing("test", tempDir)).toBe(false);
    });

    it("shouldEnableStaticServing returns true only in production", () => {
      expect(shouldEnableStaticServing("production", tempDir)).toBe(true);
    });

    it("applyStaticServing respects enabled flag", () => {
      const app = express();

      // Should not apply when disabled
      const disabledResult = applyStaticServing(app, {
        publicPath: tempDir,
        enabled: false,
      });
      expect(disabledResult).toBe(false);

      // Should apply when enabled
      const enabledResult = applyStaticServing(app, {
        publicPath: tempDir,
        enabled: true,
      });
      expect(enabledResult).toBe(true);
    });
  });
});
