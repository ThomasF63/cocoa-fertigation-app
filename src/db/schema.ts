import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { Plot, Tree } from "../types/design";
import type { SoilSample, BDRing, LeafComposite, NminSample } from "../types/samples";
import type { TreeMeasurement } from "../types/measurements";
import type { SoilAnalytics, LeafAnalytics } from "../types/analytics";

export const DB_NAME = "mccs-fertigation-app";
export const DB_VERSION = 1;

export interface MccsDB extends DBSchema {
  plots:                   { key: string; value: Plot };
  trees:                   { key: string; value: Tree };
  soil_samples:            { key: string; value: SoilSample };
  bd_rings:                { key: string; value: BDRing };
  leaf_composites:         { key: string; value: LeafComposite };
  nmin_samples:            { key: string; value: NminSample };
  tree_measurements:       { key: string; value: TreeMeasurement };
  soil_analytics:          { key: string; value: SoilAnalytics };
  leaf_analytics:          { key: string; value: LeafAnalytics };
}

export type StoreName = keyof MccsDB;

export const ALL_STORES: StoreName[] = [
  "plots",
  "trees",
  "soil_samples",
  "bd_rings",
  "leaf_composites",
  "nmin_samples",
  "tree_measurements",
  "soil_analytics",
  "leaf_analytics",
];

export async function getDB(): Promise<IDBPDatabase<MccsDB>> {
  return openDB<MccsDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("plots"))             db.createObjectStore("plots",             { keyPath: "plot_id" });
      if (!db.objectStoreNames.contains("trees"))             db.createObjectStore("trees",             { keyPath: "tree_id" });
      if (!db.objectStoreNames.contains("soil_samples"))      db.createObjectStore("soil_samples",      { keyPath: "sample_id" });
      if (!db.objectStoreNames.contains("bd_rings"))          db.createObjectStore("bd_rings",          { keyPath: "ring_id" });
      if (!db.objectStoreNames.contains("leaf_composites"))   db.createObjectStore("leaf_composites",   { keyPath: "sample_id" });
      if (!db.objectStoreNames.contains("nmin_samples"))      db.createObjectStore("nmin_samples",      { keyPath: "sample_id" });
      if (!db.objectStoreNames.contains("tree_measurements")) db.createObjectStore("tree_measurements", { keyPath: "tree_id" });
      if (!db.objectStoreNames.contains("soil_analytics"))    db.createObjectStore("soil_analytics",    { keyPath: "sample_id" });
      if (!db.objectStoreNames.contains("leaf_analytics"))    db.createObjectStore("leaf_analytics",    { keyPath: "sample_id" });
    },
  });
}
