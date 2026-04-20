import { ALL_STORES, getDB, type StoreName } from "./schema";

// idb's generic types are narrow to literal keys; using generics with
// `S extends StoreName` refuses to propagate the narrowing through the API.
// Cast through `any` at call sites; callers are typed at the boundary.

export async function getAll<T = unknown>(store: StoreName): Promise<T[]> {
  const db = await getDB();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await (db as any).getAll(store)) as T[];
}

export async function count(store: StoreName): Promise<number> {
  const db = await getDB();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db as any).count(store);
}

export async function getOne<T = unknown>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await getDB();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await (db as any).get(store, key)) as T | undefined;
}

export async function putOne(store: StoreName, value: unknown): Promise<void> {
  const db = await getDB();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).put(store, value);
}

export async function bulkPut(store: StoreName, values: unknown[]): Promise<void> {
  if (!values.length) return;
  const db = await getDB();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = (db as any).transaction(store, "readwrite");
  for (const v of values) await tx.store.put(v);
  await tx.done;
}

export async function clearStore(store: StoreName): Promise<void> {
  const db = await getDB();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).clear(store);
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = (db as any).transaction(ALL_STORES, "readwrite");
  await Promise.all(ALL_STORES.map(s => tx.objectStore(s).clear()));
  await tx.done;
}

export async function countsByStore(): Promise<Record<StoreName, number>> {
  const db = await getDB();
  const entries = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ALL_STORES.map(async s => [s, await (db as any).count(s)] as const),
  );
  return Object.fromEntries(entries) as Record<StoreName, number>;
}
