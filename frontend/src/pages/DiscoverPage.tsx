import { Routes, Route, Navigate } from "react-router-dom";
import { StreamingProvider } from "../contexts/StreamingContext";
import { DiscoverNav } from "../components/chat/DiscoverNav";
import { DiscoverSearchView } from "./DiscoverSearchView";
import { DiscoverChatView } from "./DiscoverChatView";
import "./DiscoverPage.css";

/**
 * Discover page with tabs for semantic search and chat
 *
 * Features:
 * - 009-semantic-discovery-search: Semantic search tab
 * - 010-discover-chat: AI chat assistant tab
 */

export function DiscoverPage() {
  return (
    <StreamingProvider>
      <div className="discover-page">
        <DiscoverNav />

        <div className="discover-content">
          <Routes>
            <Route path="/" element={<Navigate to="chat" replace />} />
            <Route path="search" element={<DiscoverSearchView />} />
            <Route path="chat" element={<DiscoverChatView />} />
          </Routes>
        </div>
      </div>
    </StreamingProvider>
  );
}
