/**
 * Agent Tools Index
 *
 * Feature: 011-agent-tools
 *
 * Exports all agent tool implementations and types.
 */

export { executeSemanticSearch, type SemanticSearchContext } from './semanticSearchTool.js';
export { executeTidalSearch, type TidalSearchContext } from './tidalSearchTool.js';
export { executeAlbumTracks, type AlbumTracksContext } from './albumTracksTool.js';
export { executeBatchMetadata, type BatchMetadataContext } from './batchMetadataTool.js';
export { executeWithRetry, isRetryableError, getUserFriendlyMessage } from './retry.js';
export { getLibraryIsrcs, getLibraryAlbumIds } from './libraryStatus.js';
export {
  createToolSpan,
  executeToolWithTracing,
  type LangfuseTrace,
  type LangfuseSpan,
  type ToolSpanOptions,
  type ToolSpanSuccessResult,
  type ToolSpanErrorResult,
  type ToolSpanWrapper,
} from './tracing.js';
