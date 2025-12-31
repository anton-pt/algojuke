/**
 * Discover Navigation Component
 *
 * Feature: 010-discover-chat
 *
 * Navigation tabs for switching between Search and Chat in Discover section.
 * Styled consistently with LibraryNav.
 * Blocks navigation during active streaming with confirmation dialog.
 */

import { useState, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useStreaming } from '../../contexts/StreamingContext';
import { LeaveConfirmDialog } from './LeaveConfirmDialog';
import './DiscoverNav.css';

export function DiscoverNav() {
  const streaming = useStreaming();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const isOnChatPage = location.pathname === '/discover/chat';
  const shouldBlock = streaming?.isStreaming && isOnChatPage;

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
      // Only block when streaming on chat page and navigating away
      if (shouldBlock && path !== '/discover/chat') {
        e.preventDefault();
        setPendingPath(path);
      }
    },
    [shouldBlock]
  );

  const handleStay = useCallback(() => {
    setPendingPath(null);
  }, []);

  const handleLeave = useCallback(() => {
    if (pendingPath) {
      navigate(pendingPath);
      setPendingPath(null);
    }
  }, [pendingPath, navigate]);

  return (
    <>
      <nav className="discover-nav">
        <NavLink
          to="/discover/search"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          onClick={(e) => handleNavClick(e, '/discover/search')}
        >
          Search
        </NavLink>
        <NavLink
          to="/discover/chat"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          onClick={(e) => handleNavClick(e, '/discover/chat')}
        >
          Chat
        </NavLink>
      </nav>
      <LeaveConfirmDialog
        isOpen={pendingPath !== null}
        onStay={handleStay}
        onLeave={handleLeave}
      />
    </>
  );
}
