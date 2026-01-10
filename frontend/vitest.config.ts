import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_TIDAL_CLIENT_ID": JSON.stringify("test-client-id"),
    "import.meta.env.VITE_TIDAL_REDIRECT_URI": JSON.stringify(
      "http://localhost:5173/auth/callback",
    ),
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
  },
});
