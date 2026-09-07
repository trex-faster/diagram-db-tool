import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Edge, Node } from "@xyflow/react";

interface DiagramRecord {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  updatedAt: string;
}

interface DiagramDB extends DBSchema {
  diagrams: {
    key: string;
    value: DiagramRecord;
    indexes: { "by-updatedAt": string };
  };
}

const DB_NAME = "db-diagram-tool";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<DiagramDB>> | null = null;

function getDb(): Promise<IDBPDatabase<DiagramDB>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB solo está disponible en el navegador."));
  }
  if (!dbPromise) {
    dbPromise = openDB<DiagramDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore("diagrams", { keyPath: "id" });
        store.createIndex("by-updatedAt", "updatedAt");
      },
    });
  }
  return dbPromise;
}

export async function saveDiagram(record: DiagramRecord): Promise<void> {
  const db = await getDb();
  await db.put("diagrams", record);
}

export async function loadDiagram(id: string): Promise<DiagramRecord | undefined> {
  const db = await getDb();
  return db.get("diagrams", id);
}

export async function listDiagrams(): Promise<DiagramRecord[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("diagrams", "by-updatedAt");
  return all.reverse(); // más reciente primero
}

export async function deleteDiagram(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("diagrams", id);
}

export type { DiagramRecord };
