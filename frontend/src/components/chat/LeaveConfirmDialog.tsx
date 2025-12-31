/**
 * Leave Confirmation Dialog
 *
 * Feature: 010-discover-chat
 *
 * Modal dialog shown when user attempts to navigate away during active streaming.
 * Provides stay/leave options.
 */

import { useEffect, useRef } from 'react';
import './LeaveConfirmDialog.css';

interface LeaveConfirmDialogProps {
  /** Whether the dialog is visible */
  isOpen: boolean;
  /** Called when user chooses to stay */
  onStay: () => void;
  /** Called when user chooses to leave */
  onLeave: () => void;
}

export function LeaveConfirmDialog({ isOpen, onStay, onLeave }: LeaveConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const stayButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management and keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    // Focus the stay button when dialog opens
    stayButtonRef.current?.focus();

    // Handle escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onStay();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onStay]);

  // Trap focus within dialog
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;

    const dialog = dialogRef.current;
    const focusableElements = dialog.querySelectorAll<HTMLElement>(
      'button, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="leave-confirm-overlay" onClick={onStay} role="presentation">
      <div
        ref={dialogRef}
        className="leave-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="leave-confirm-title"
        aria-describedby="leave-confirm-description"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="leave-confirm-title" className="leave-confirm-title">
          Leave this page?
        </h2>
        <p id="leave-confirm-description" className="leave-confirm-description">
          A response is being generated. If you leave now, the response will be lost.
        </p>
        <div className="leave-confirm-actions">
          <button
            ref={stayButtonRef}
            className="leave-confirm-button leave-confirm-button--stay"
            onClick={onStay}
          >
            Stay
          </button>
          <button
            className="leave-confirm-button leave-confirm-button--leave"
            onClick={onLeave}
          >
            Leave anyway
          </button>
        </div>
      </div>
    </div>
  );
}
