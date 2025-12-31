/**
 * Streaming Context
 *
 * Feature: 010-discover-chat
 *
 * Provides streaming state to components that need to block navigation
 * during active chat streaming.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface StreamingContextValue {
  /** Whether a chat stream is currently active */
  isStreaming: boolean;
  /** Set streaming state (called by ChatView) */
  setStreaming: (streaming: boolean) => void;
}

const StreamingContext = createContext<StreamingContextValue | null>(null);

interface StreamingProviderProps {
  children: ReactNode;
}

export function StreamingProvider({ children }: StreamingProviderProps) {
  const [isStreaming, setIsStreaming] = useState(false);

  const setStreaming = useCallback((streaming: boolean) => {
    setIsStreaming(streaming);
  }, []);

  return (
    <StreamingContext.Provider value={{ isStreaming, setStreaming }}>
      {children}
    </StreamingContext.Provider>
  );
}

/**
 * Hook to access streaming state
 * Returns null if used outside StreamingProvider (graceful degradation)
 */
export function useStreaming(): StreamingContextValue | null {
  return useContext(StreamingContext);
}
