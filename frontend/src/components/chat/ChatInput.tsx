/**
 * Chat Input Component
 *
 * Feature: 010-discover-chat
 *
 * Text area with send button for composing chat messages.
 * Includes validation and disable state during streaming.
 */

import { useState, useCallback, useRef, KeyboardEvent } from 'react';
import './ChatInput.css';

interface ChatInputProps {
  /** Callback when user submits a message */
  onSend: (message: string) => void;
  /** Whether input should be disabled (e.g., during streaming) */
  disabled?: boolean;
  /** Whether a response is currently streaming */
  isStreaming?: boolean;
  /** Callback to cancel streaming */
  onCancel?: () => void;
  /** Placeholder text */
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  isStreaming = false,
  onCancel,
  placeholder = 'Describe the mood or feeling you\'re looking for...',
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [showValidationError, setShowValidationError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check if input is valid (non-empty after trim)
  const isValid = value.trim().length > 0;

  // Handle submit
  const handleSubmit = useCallback(() => {
    const trimmedValue = value.trim();

    // Show validation error if empty (FR-004)
    if (!trimmedValue) {
      setShowValidationError(true);
      return;
    }

    if (disabled || isStreaming) return;

    onSend(trimmedValue);
    setValue('');
    setShowValidationError(false);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, isStreaming, onSend]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Enter (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }

      // Cancel streaming on Escape
      if (e.key === 'Escape' && isStreaming && onCancel) {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSubmit, isStreaming, onCancel]
  );

  // Auto-resize textarea
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setValue(textarea.value);

    // Clear validation error when user starts typing
    if (showValidationError && textarea.value.trim().length > 0) {
      setShowValidationError(false);
    }

    // Reset height to auto to calculate new height
    textarea.style.height = 'auto';
    // Set height to scrollHeight (capped at max)
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [showValidationError]);

  return (
    <div className="chat-input">
      <div className="chat-input__container">
        <textarea
          ref={textareaRef}
          className="chat-input__textarea"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isStreaming}
          rows={1}
          aria-label="Chat message input"
        />
        <div className="chat-input__actions">
          {isStreaming ? (
            <button
              className="chat-input__button chat-input__button--cancel"
              onClick={onCancel}
              type="button"
              aria-label="Stop generating"
            >
              <span className="chat-input__button-icon">⏹</span>
              <span className="chat-input__button-text">Stop</span>
            </button>
          ) : (
            <button
              className="chat-input__button chat-input__button--send"
              onClick={handleSubmit}
              disabled={!isValid || disabled}
              type="button"
              aria-label="Send message"
            >
              <span className="chat-input__button-icon">↑</span>
            </button>
          )}
        </div>
      </div>
      {showValidationError && (
        <p className="chat-input__error" role="alert">
          Please enter a message before sending.
        </p>
      )}
      <p className="chat-input__hint">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
