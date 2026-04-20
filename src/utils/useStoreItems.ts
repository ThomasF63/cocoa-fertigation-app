import { useCallback, useEffect, useState } from "react";
import { getAll, putOne } from "../db/repo";
import type { StoreName } from "../db/schema";

export interface UseStoreItems<T> {
  items: T[];
  loading: boolean;
  reload: () => Promise<void>;
  saveItem: (item: T) => Promise<void>;
  replaceLocal: (item: T) => void;
}

/** Load all items of a store into React state and expose a save function. */
export function useStoreItems<T>(
  store: StoreName,
  keyField: keyof T,
): UseStoreItems<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const all = await getAll<T>(store);
    setItems(all);
    setLoading(false);
  }, [store]);

  useEffect(() => { reload(); }, [reload]);

  const replaceLocal = useCallback((item: T) => {
    setItems(prev => {
      const k = item[keyField];
      const idx = prev.findIndex(p => p[keyField] === k);
      if (idx === -1) return [...prev, item];
      const next = prev.slice();
      next[idx] = item;
      return next;
    });
  }, [keyField]);

  const saveItem = useCallback(async (item: T) => {
    await putOne(store, item);
    replaceLocal(item);
  }, [store, replaceLocal]);

  return { items, loading, reload, saveItem, replaceLocal };
}

/** Debounced autosave wrapper. Returns a function with the same signature
 *  as saveItem that batches successive calls for the same key within `ms`. */
export function useDebouncedSave<T>(
  saveItem: (item: T) => Promise<void>,
  keyField: keyof T,
  ms = 400,
) {
  const [timers] = useState<Map<unknown, ReturnType<typeof setTimeout>>>(new Map());
  return useCallback((item: T) => {
    const k = item[keyField];
    const existing = timers.get(k);
    if (existing) clearTimeout(existing);
    timers.set(k, setTimeout(() => {
      saveItem(item);
      timers.delete(k);
    }, ms));
  }, [saveItem, keyField, ms, timers]);
}
