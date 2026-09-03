// packages/db/src/client.ts — connect/close, mirroring sources/whatsapp_msg/src/db/mongo.ts
// (the existing accessor pattern this repo mirrors — ARCHITECTURE §5, D-003 H5).
import { MongoClient, type Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connect(url: string, dbName: string): Promise<Db> {
  if (db) return db;
  client = new MongoClient(url);
  await client.connect();
  db = client.db(dbName);
  return db;
}

export async function close(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
}

export function getDb(): Db {
  if (!db) throw new Error("Mongo not connected — call connect() first");
  return db;
}
