import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';

interface PendingDeletion {
  timeoutId: ReturnType<typeof setTimeout>;
  onFinalize: () => Promise<void>;
  label: string;
  itemName: string;
}

interface UndoDeleteContextValue {
  isDeleted: (id: string) => boolean;
  handleDelete: (
    id: string,
    label: string,
    itemName: string,
    onFinalize: () => Promise<void>
  ) => void;
  handleUndo: (id: string) => void;
}

const UndoDeleteContext = createContext<UndoDeleteContextValue | undefined>(undefined);

export function UndoDeleteProvider({ children }: { children: ReactNode }) {
  // Global state for deleted IDs - persists across navigation
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Track pending deletions with their finalization callbacks
  const pendingDeletionsRef = useRef<Map<string, PendingDeletion>>(new Map());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear all pending timeouts
      pendingDeletionsRef.current.forEach((deletion) => {
        clearTimeout(deletion.timeoutId);
      });
      pendingDeletionsRef.current.clear();
    };
  }, []);

  // Check if item is deleted
  const isDeleted = useCallback((id: string): boolean => {
    return deletedIds.has(id);
  }, [deletedIds]);

  // Finalize deletion (call the deletion callback)
  const finalizeDelete = useCallback(async (id: string) => {
    const pending = pendingDeletionsRef.current.get(id);
    if (!pending) return;

    try {
      await pending.onFinalize();
      pendingDeletionsRef.current.delete(id);
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (error) {
      // If finalize fails, restore the item
      console.error('Failed to finalize delete:', error);
      toast.error(`Failed to remove ${pending.itemName.toLowerCase()}`);
      pendingDeletionsRef.current.delete(id);
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  // Handle delete with undo functionality
  const handleDelete = useCallback(
    (
      id: string,
      label: string,
      itemName: string,
      onFinalize: () => Promise<void>
    ) => {
      // Optimistic removal - hide immediately
      setDeletedIds((prev) => new Set(prev).add(id));

      // Set up finalization after 10 seconds
      const timeoutId = setTimeout(() => {
        finalizeDelete(id);
      }, 10000);

      // Store pending deletion data
      pendingDeletionsRef.current.set(id, {
        timeoutId,
        onFinalize,
        label,
        itemName,
      });

      // Show toast with undo button
      toast.success(`${itemName} removed`, {
        description: label,
        action: {
          label: 'Undo',
          onClick: () => handleUndo(id),
        },
        duration: 10000,
      });
    },
    [finalizeDelete]
  );

  // Handle undo
  const handleUndo = useCallback((id: string) => {
    const pending = pendingDeletionsRef.current.get(id);
    if (!pending) return;

    // Cancel the timeout
    clearTimeout(pending.timeoutId);

    // Remove from deleted state
    pendingDeletionsRef.current.delete(id);
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    // Show restored toast
    toast.success(`${pending.itemName} restored`, {
      description: pending.label,
    });
  }, []);

  return (
    <UndoDeleteContext.Provider value={{ isDeleted, handleDelete, handleUndo }}>
      {children}
    </UndoDeleteContext.Provider>
  );
}

export function useUndoDeleteContext() {
  const context = useContext(UndoDeleteContext);
  if (!context) {
    throw new Error('useUndoDeleteContext must be used within UndoDeleteProvider');
  }
  return context;
}
