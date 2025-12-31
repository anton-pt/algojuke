/**
 * Chat Error Boundary Component
 *
 * Feature: 010-discover-chat
 *
 * Catches React errors in chat components and displays a fallback UI.
 * Allows users to recover by resetting the chat state.
 */

import { Component, ReactNode } from 'react';
import './ChatErrorBoundary.css';

interface ChatErrorBoundaryProps {
  children: ReactNode;
  /** Callback to reset chat state when user clicks retry */
  onReset?: () => void;
}

interface ChatErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ChatErrorBoundary extends Component<
  ChatErrorBoundaryProps,
  ChatErrorBoundaryState
> {
  constructor(props: ChatErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ChatErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error for debugging
    console.error('Chat component error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="chat-error-boundary">
          <div className="chat-error-boundary__content">
            <div className="chat-error-boundary__icon">⚠️</div>
            <h2 className="chat-error-boundary__title">Something went wrong</h2>
            <p className="chat-error-boundary__message">
              An error occurred in the chat interface. Please try again.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <details className="chat-error-boundary__details">
                <summary>Error details</summary>
                <pre>{this.state.error.message}</pre>
              </details>
            )}
            <button
              className="chat-error-boundary__button"
              onClick={this.handleReset}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
