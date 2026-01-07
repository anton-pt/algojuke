/**
 * Gemini Embedding Client
 *
 * Feature: 043-gemini-embeddings
 *
 * Implements the EmbeddingClient interface using Google's gemini-embedding-001 model
 * via the @google/genai SDK with Vertex AI configuration.
 *
 * Configuration:
 * - GOOGLE_CLOUD_PROJECT: GCP project ID (required)
 * - GOOGLE_CLOUD_REGION: Vertex AI region (default: europe-west4)
 */

import { GoogleGenAI } from "@google/genai";
import type { EmbeddingClient, EmbeddingTaskType } from "./embedding.js";

/**
 * Gemini embedding model name
 */
const GEMINI_MODEL = "gemini-embedding-001";

/**
 * Expected embedding dimensions for gemini-embedding-001
 */
const GEMINI_DIMENSIONS = 3072;

/**
 * Create a Gemini embedding client
 *
 * Uses Vertex AI for authentication via Application Default Credentials (ADC).
 * In Cloud Run, the service account must have roles/aiplatform.user.
 *
 * @returns EmbeddingClient implementation using Gemini
 */
export function createGeminiEmbeddingClient(): EmbeddingClient {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_REGION || "europe-west4";

  if (!project) {
    throw new Error(
      "GOOGLE_CLOUD_PROJECT environment variable is required for Gemini embeddings",
    );
  }

  const ai = new GoogleGenAI({
    vertexai: true,
    project,
    location,
  });

  return {
    async embed(
      text: string,
      taskType: EmbeddingTaskType = "RETRIEVAL_DOCUMENT",
    ): Promise<number[]> {
      const response = await ai.models.embedContent({
        model: GEMINI_MODEL,
        contents: text,
        config: {
          taskType,
        },
      });

      const embedding = response.embeddings?.[0]?.values;

      if (!embedding) {
        throw new Error("No embedding returned from Gemini API");
      }

      if (embedding.length !== GEMINI_DIMENSIONS) {
        throw new Error(
          `Invalid embedding dimensions: expected ${GEMINI_DIMENSIONS}, got ${embedding.length}`,
        );
      }

      return embedding;
    },

    getDimensions(): number {
      return GEMINI_DIMENSIONS;
    },

    async isHealthy(): Promise<boolean> {
      try {
        await ai.models.embedContent({
          model: GEMINI_MODEL,
          contents: "health check",
        });
        return true;
      } catch {
        return false;
      }
    },

    getProviderName(): string {
      return "gemini";
    },

    getModelName(): string {
      return GEMINI_MODEL;
    },
  };
}
