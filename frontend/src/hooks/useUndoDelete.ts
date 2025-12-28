import { useCallback } from 'react';
import { useUndoDeleteContext } from '../contexts/UndoDeleteContext';

interface UseUndoDeleteOptions<T> {
  itemName: string; // e.g., "Album", "Track"
  getItemLabel: (item: T) => string; // e.g., album => album.title
  onDelete: (id: string) => Promise<void>; // GraphQL mutation
}

export function useUndoDelete<T extends { id: string }>(
  options: UseUndoDeleteOptions<T>
) {
  const { itemName, getItemLabel, onDelete } = options;
  const { isDeleted, handleDelete: contextHandleDelete } = useUndoDeleteContext();

  // Wrap the context's handleDelete with type-safe item handling
  const handleDelete = useCallback(
    (item: T) => {
      const id = item.id;
      const label = getItemLabel(item);

      contextHandleDelete(id, label, itemName, async () => {
        await onDelete(id);
      });
    },
    [itemName, getItemLabel, onDelete, contextHandleDelete]
  );

  return {
    handleDelete,
    isDeleted,
  };
}
