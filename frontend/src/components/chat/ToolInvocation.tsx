/**
 * Tool Invocation Component
 *
 * Feature: 011-agent-tools
 *
 * Displays a tool invocation within a chat message.
 * Shows status, summary, and expandable results.
 */

import { useState } from 'react';
import './ToolInvocation.css';
import { PlaylistCard, type PlaylistTrack } from './PlaylistCard';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ToolInvocationProps {
  toolCallId: string;
  toolName: string;
  input: unknown;
  status: 'executing' | 'completed' | 'failed';
  summary?: string;
  resultCount?: number;
  output?: unknown;
  error?: string;
  durationMs?: number;
}

// -----------------------------------------------------------------------------
// Helper Components
// -----------------------------------------------------------------------------

/**
 * Tool icon based on tool name
 */
function ToolIcon({ toolName }: { toolName: string }) {
  const getIcon = () => {
    switch (toolName) {
      case 'semanticSearch':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
        );
      case 'tidalSearch':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        );
      case 'batchMetadata':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
          </svg>
        );
      case 'albumTracks':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z" />
          </svg>
        );
      case 'suggestPlaylist':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
          </svg>
        );
    }
  };

  return <span className="tool-invocation__icon">{getIcon()}</span>;
}

/**
 * Status badge component
 */
function StatusBadge({ status, toolName }: { status: 'executing' | 'completed' | 'failed'; toolName?: string }) {
  const getLabel = () => {
    switch (status) {
      case 'executing':
        // T038: Show "Building playlist..." for suggestPlaylist tool
        return toolName === 'suggestPlaylist' ? 'Building playlist...' : 'Searching...';
      case 'completed':
        return 'Done';
      case 'failed':
        return 'Failed';
    }
  };

  return (
    <span className={`tool-invocation__status tool-invocation__status--${status}`}>
      {status === 'executing' && <span className="tool-invocation__spinner" />}
      {getLabel()}
    </span>
  );
}

/**
 * Chevron icon for expansion
 */
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`tool-invocation__chevron ${expanded ? 'tool-invocation__chevron--expanded' : ''}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
    </svg>
  );
}

/**
 * Format tool name for display
 */
function formatToolName(toolName: string): string {
  switch (toolName) {
    case 'semanticSearch':
      return 'Semantic Search';
    case 'tidalSearch':
      return 'Tidal Search';
    case 'batchMetadata':
      return 'Batch Metadata';
    case 'albumTracks':
      return 'Album Tracks';
    case 'suggestPlaylist':
      return 'Playlist';
    default:
      return toolName;
  }
}

// -----------------------------------------------------------------------------
// Results Renderer
// -----------------------------------------------------------------------------

interface ToolResultsRendererProps {
  output: unknown;
  toolName?: string;
}

function ToolResultsRenderer({ output, toolName }: ToolResultsRendererProps) {
  if (!output || typeof output !== 'object') {
    return <div className="tool-invocation__results-empty">No results available</div>;
  }

  const data = output as Record<string, unknown>;

  // Special handling for suggestPlaylist - render PlaylistCard
  if (toolName === 'suggestPlaylist' && 'title' in data && 'tracks' in data && Array.isArray(data.tracks)) {
    const playlistTracks = data.tracks as PlaylistTrack[];
    return (
      <PlaylistCard
        title={String(data.title)}
        tracks={playlistTracks}
      />
    );
  }

  // Render tracks list if present (for other tools)
  if ('tracks' in data && Array.isArray(data.tracks)) {
    return (
      <div className="tool-invocation__results-list">
        {data.tracks.map((track: Record<string, unknown>, index: number) => (
          <div key={String(track.isrc || index)} className="tool-invocation__result-item">
            <span className="tool-invocation__result-title">
              {String(track.title || 'Unknown')}
            </span>
            <span className="tool-invocation__result-artist">
              {String(track.artist || 'Unknown Artist')}
            </span>
            {Boolean(track.inLibrary) && (
              <span className="tool-invocation__result-badge">In Library</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Render albums list if present
  if ('albums' in data && Array.isArray(data.albums)) {
    return (
      <div className="tool-invocation__results-list">
        {data.albums.map((album: Record<string, unknown>, index: number) => (
          <div key={String(album.tidalId || index)} className="tool-invocation__result-item">
            <span className="tool-invocation__result-title">
              {String(album.title || 'Unknown')}
            </span>
            <span className="tool-invocation__result-artist">
              {String(album.artist || 'Unknown Artist')}
            </span>
            {Boolean(album.inLibrary) && (
              <span className="tool-invocation__result-badge">In Library</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Fallback: render JSON
  return (
    <pre className="tool-invocation__results-json">
      {JSON.stringify(output, null, 2)}
    </pre>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function ToolInvocation({
  toolCallId,
  toolName,
  status,
  summary,
  resultCount,
  output,
  error,
  durationMs,
}: ToolInvocationProps) {
  const [expanded, setExpanded] = useState(false);

  // Playlists auto-expand and don't need manual expand/collapse
  const isPlaylist = toolName === 'suggestPlaylist';
  const canExpand = !isPlaylist && status === 'completed' && output && resultCount && resultCount > 0;
  const showResults = isPlaylist
    ? status === 'completed' && output
    : expanded && output;

  const handleToggle = () => {
    if (canExpand) {
      setExpanded(!expanded);
    }
  };

  return (
    <div
      className={`tool-invocation tool-invocation--${status} ${isPlaylist ? 'tool-invocation--playlist' : ''}`}
      data-tool-call-id={toolCallId}
    >
      <div
        className={`tool-invocation__header ${canExpand ? 'tool-invocation__header--clickable' : ''}`}
        onClick={handleToggle}
        role={canExpand ? 'button' : undefined}
        tabIndex={canExpand ? 0 : undefined}
        onKeyDown={(e) => {
          if (canExpand && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <ToolIcon toolName={toolName} />
        <span className="tool-invocation__name">{formatToolName(toolName)}</span>
        <StatusBadge status={status} toolName={toolName} />
        {summary && <span className="tool-invocation__summary">{summary}</span>}
        {durationMs !== undefined && status !== 'executing' && (
          <span className="tool-invocation__duration">{(durationMs / 1000).toFixed(1)}s</span>
        )}
        {canExpand ? <ChevronIcon expanded={expanded} /> : null}
      </div>

      {error ? (
        <div className="tool-invocation__error">
          {error}
        </div>
      ) : null}

      {showResults ? (
        <div className={`tool-invocation__results ${isPlaylist ? 'tool-invocation__results--playlist' : ''}`}>
          <ToolResultsRenderer output={output} toolName={toolName} />
        </div>
      ) : null}
    </div>
  );
}
