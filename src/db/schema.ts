import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { Plot, Tree } from "../types/design";
import type { SoilSample, BDRing } from "../types/samples";
import type { TreeMeasurement } from "../types/measurements";
import type { SoilAnalytics } from "../types/analytics";

export const DB_NAME = "mccs-fertigation-app";
// v2: nmin_samples store removed; N-min lives in soil_analytics as a set
// of measurement columns on the existing sample rows.
export const DB_VERSION = 2;

export interface MccsDB extends DBSchema {
  plots:                   { key: string; value: Plot };
  trees:                   { key: string; value: Tree };
  soil_samples:            { key: string; value: SoilSample };
  bd_rings:                { key: string; value: BDRing };
  tree_measurements:       { key: string; value: TreeMeasurement };
  soil_analytics:          { key: string; value: SoilAnalytics };
}

export type StoreName = keyof MccsDB;

export const ALL_STORES: StoreName[] = [
  "plots",
  "trees",
  "soil_samples",
  "bd_rings",
  "tree_measurements",
  "soil_analytics",
];

export async function getDB(): Promise<IDBPDatabase<MccsDB>> {
  return openDB<MccsDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("plots"))             db.createObjectStore("plots",             { keyPath: "plot_id" });
      if (!db.objectStoreNames.contains("trees"))             db.createObjectStore("trees",             { keyPath: "tree_id" });
      if (!db.objectStoreNames.contains("soil_samples"))      db.createObjectStore("soil_samples",      { keyPath: "sample_id" });
      if (!db.objectStoreNames.contains("bd_rings"))          db.createObjectStore("bd_rings",          { keyPath: "ring_id" });
      if (!db.objectStoreNames.contains("tree_measurements")) db.createObjectStore("tree_measurements", { keyPath: "tree_id" });
      if (!db.objectStoreNames.contains("soil_analytics"))    db.createObjectStore("soil_analytics",    { keyPath: "sample_id" });
      // v2 cleanup — drop the former standalone nmin_samples store if it
      // exists from an older install. Any data there is abandoned; users
      // re-import N-min columns via soil_analytics.csv. The idb strongly-
      // typed methods only accept current store names, so we treat the
      // IDBDatabase as an untyped handle for this one legacy drop.
      const rawDb = db as unknown as IDBDatabase;
      if (rawDb.objectStoreNames.contains("nmin_samples")) {
        rawDb.deleteObjectStore("nmin_samples");
      }
    },
  });
}
