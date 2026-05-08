"use client";

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "benchpilot-offline";
const STORE = "queue";

interface QueuedMutation {
  id?: number;
  kind: string;
  payload: unknown;
  createdAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB unavailable");
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

async function enqueue(m: Omit<QueuedMutation, "id" | "createdAt">) {
  const db = await getDb();
  await db.add(STORE, { ...m, createdAt: Date.now() });
}

async function drain(handler: (m: QueuedMutation) => Promise<boolean>) {
  const db = await getDb();
  const all = await db.getAll(STORE);
  for (const m of all) {
    const ok = await handler(m as QueuedMutation).catch(() => false);
    if (ok && (m as QueuedMutation).id != null) {
      await db.delete(STORE, (m as QueuedMutation).id!);
    }
  }
}

async function pendingCount(): Promise<number> {
  const db = await getDb();
  return db.count(STORE);
}

export const offlineQueue = { enqueue, drain, pendingCount };
