/**
 * Generate Mix Tool
 *
 * Feature: ALG-83
 *
 * Triggers background mix generation from chat by creating a Mix entity
 * and sending an Inngest event for the DJ agent to process.
 */

import {
  GenerateMixInputSchema,
  type GenerateMixInput,
} from "../../schemas/agentTools.js";
import type { GenerateMixOutput } from "../../types/agentTools.js";
import { createToolError } from "../../types/agentTools.js";
import { MixService } from "../mixService.js";
import {
  sendMixGenerationEvent,
  type MixGenerationRequestedEvent,
} from "../../clients/inngestClient.js";
import { logger } from "../../utils/logger.js";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Context required for generate mix tool execution
 */
export interface GenerateMixContext {
  mixService: MixService;
  userId: string;
  conversationId?: string;
}

// -----------------------------------------------------------------------------
// Tool Implementation
// -----------------------------------------------------------------------------

/**
 * Build summary message for mix generation
 */
function buildSummary(title: string, articleCount: number): string {
  const articleText =
    articleCount === 1 ? "1 article" : `${articleCount} articles`;
  return `Started generating mix '${title}' with ${articleText}. You can track progress in the Radio section.`;
}

/**
 * Execute generate mix tool
 *
 * Creates a Mix entity with "generating" status and sends an Inngest event
 * for the DJ agent to process asynchronously.
 *
 * @param input - Validated generate mix input
 * @param context - Required services and user context
 * @returns GenerateMixOutput with mixId and status
 * @throws ToolError on validation errors or service failures
 */
export async function executeGenerateMix(
  input: GenerateMixInput,
  context: GenerateMixContext,
): Promise<GenerateMixOutput> {
  const startTime = Date.now();

  logger.info("generate_mix_tool_start", {
    title: input.title.slice(0, 100),
    articleCount: input.articles.length,
    userId: context.userId,
    hasConversationId: !!context.conversationId,
    hasMusicInstructions: !!input.musicInstructions,
  });

  // Validate input
  const validationResult = GenerateMixInputSchema.safeParse(input);
  if (!validationResult.success) {
    const errorMessage = validationResult.error.issues
      .map((e) => e.message)
      .join(", ");

    logger.warn("generate_mix_validation_failed", {
      title: input.title?.slice(0, 100),
      errors: validationResult.error.issues.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });

    throw createToolError(errorMessage, false, false, "VALIDATION_ERROR");
  }

  const { title, description, articles, musicInstructions } =
    validationResult.data;

  // Create Mix entity with "generating" status
  let mixId: string;
  try {
    const mix = await context.mixService.createMix({
      userId: context.userId,
      title,
      description: description ?? undefined,
      conversationId: context.conversationId,
    });
    mixId = mix.id;

    logger.info("generate_mix_entity_created", {
      mixId,
      userId: context.userId,
      title: title.slice(0, 100),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("generate_mix_entity_creation_failed", {
      userId: context.userId,
      title: title.slice(0, 100),
      error: errorMessage,
    });

    throw createToolError(
      `Failed to create mix: ${errorMessage}`,
      true, // retryable - database might be temporarily unavailable
      false,
      "MIX_CREATION_ERROR",
    );
  }

  // Send Inngest event for DJ agent
  try {
    const eventData: MixGenerationRequestedEvent = {
      mixId,
      userId: context.userId,
      title,
      description: description ?? null,
      articles: articles.map((a) => ({
        documentId: a.documentId,
        contentMode: a.contentMode,
      })),
      musicInstructions: musicInstructions ?? null,
      conversationId: context.conversationId ?? null,
    };

    await sendMixGenerationEvent(eventData);

    logger.info("generate_mix_event_sent", {
      mixId,
      userId: context.userId,
      articleCount: articles.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Log the error but note that Mix entity was still created
    logger.error("generate_mix_event_send_failed", {
      mixId,
      userId: context.userId,
      error: errorMessage,
      note: "Mix entity was created but Inngest event failed to send",
    });

    // FR-003: Inngest send failure is retryable
    throw createToolError(
      `Mix created but failed to trigger generation: ${errorMessage}`,
      true, // retryable
      false,
      "EVENT_SEND_ERROR",
    );
  }

  const durationMs = Date.now() - startTime;
  const summary = buildSummary(title, articles.length);

  logger.info("generate_mix_tool_complete", {
    mixId,
    userId: context.userId,
    title: title.slice(0, 100),
    articleCount: articles.length,
    durationMs,
  });

  return {
    summary,
    durationMs,
    mixId,
    status: "generating",
    title,
    articleCount: articles.length,
  };
}
