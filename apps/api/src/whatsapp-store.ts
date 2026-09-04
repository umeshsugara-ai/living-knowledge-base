/**
 * apps/api/src/whatsapp-store.ts — T-007 first slice. A REAL, READ-ONLY connection to
 * `sources/whatsapp_msg`'s OWN, separate Mongo database (its own container, port 27018 by
 * default — confirmed live: `docker ps` shows `whatsapp-msg-mongo`). That submodule keeps its
 * own governance per this repo's CLAUDE.md ("do not duplicate its governance here, reference it
 * instead") — this file only ever reads, never writes, and never imports its source code, only
 * its documented collection shapes (`src/db/types.ts` there: `PersonDoc`/`MessageDoc`/`GroupDoc`).
 */
import { randomUUID } from "node:crypto";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { getDb as getAppDb } from "@lkb/db";
import type { Sources, Sessions, Turns } from "@lkb/core";
import { createWhatsAppSource, type WhatsAppFetcher, type WhatsAppMessage, type ConsentContext, type Turn } from "@lkb/ingest";
import type { WhatsAppRouteDeps, WhatsAppGroup, WhatsAppIngestResult } from "./routes/whatsapp.js";
import { sha256Hex } from "./hash.js";
import type { BoundIndexer } from "./indexing.js";

let client: MongoClient | null = null;
let db: Db | null = null;

async function getWhatsAppDb(): Promise<Db> {
  if (db) return db;
  const url = process.env.WHATSAPP_MONGO_URL ?? "mongodb://127.0.0.1:27018";
  const dbName = process.env.WHATSAPP_MONGO_DB ?? "whatsapp_msg";
  client = new MongoClient(url);
  await client.connect();
  db = client.db(dbName);
  return db;
}

interface PersonDoc { _id: ObjectId; displayName: string | null; savedName: string | null; pushName: string | null; }
interface MessageDoc { personId: ObjectId; text: string | null; ts: Date; deletedAt: Date | null; }
interface GroupDoc { _id: ObjectId; jid: string; subject: string; ownerUserId: ObjectId; isTracked: boolean; }

function displayNameOf(p: PersonDoc | undefined, fallback: string): string {
  return p?.displayName ?? p?.savedName ?? p?.pushName ?? fallback;
}

/** The real `WhatsAppFetcher` `@lkb/ingest`'s whatsapp adapter needs. Deleted messages and
 * media-only messages (no `text`) are excluded — a claims pipeline has nothing to extract from
 * either, and a deleted message being silently un-deleted into the KB would be a real bug. */
export const fetchWhatsAppMessages: WhatsAppFetcher = async (groupJid, ownerUserId) => {
  const wadb = await getWhatsAppDb();
  const messages = await wadb.collection<MessageDoc>("messages")
    .find({ groupJid, ownerUserId: new ObjectId(ownerUserId), deletedAt: null, text: { $ne: null } })
    .sort({ ts: 1 })
    .toArray();

  const personIds = [...new Set(messages.map((m) => m.personId.toString()))].map((id) => new ObjectId(id));
  const people = await wadb.collection<PersonDoc>("people").find({ _id: { $in: personIds } }).toArray();
  const peopleById = new Map(people.map((p) => [p._id.toString(), p]));

  return messages.map((m): WhatsAppMessage => ({
    personId: m.personId.toString(),
    displayName: displayNameOf(peopleById.get(m.personId.toString()), m.personId.toString()),
    text: m.text ?? "",
    ts: m.ts.toISOString(),
  }));
};

export interface TrackableGroup {
  groupJid: string;
  ownerUserId: string;
  subject: string;
  trackedPersonCount: number;
}

/** Real, live-queried list of groups the archiver is actually tracking, so a caller can see
 * what's really capturable before ingesting anything — never a hardcoded/fixture list. */
export async function listTrackableGroups(): Promise<TrackableGroup[]> {
  const wadb = await getWhatsAppDb();
  const groups = await wadb.collection<GroupDoc>("groups").find({ isTracked: true }).toArray();
  const tracking = await wadb.collection<{ groupJid: string }>("tracking").find({}).toArray();

  const countByGroup = new Map<string, number>();
  for (const t of tracking) countByGroup.set(t.groupJid, (countByGroup.get(t.groupJid) ?? 0) + 1);

  return groups.map((g) => ({
    groupJid: g.jid,
    ownerUserId: g.ownerUserId.toString(),
    subject: g.subject,
    trackedPersonCount: countByGroup.get(g.jid) ?? 0,
  }));
}

/** Real `WhatsAppRouteDeps` (routes/whatsapp.ts). Same persist shape `ingest-store.ts` writes
 * for a URL ingest (sources + sessions + turns), reusing the already-real `GET /sessions/:id`
 * view — no second "ingested content" viewer built for this source kind either. */
export function createMongoWhatsAppDeps(indexSession?: BoundIndexer): WhatsAppRouteDeps {
  const whatsAppSource = createWhatsAppSource({ hasher: sha256Hex, fetcher: fetchWhatsAppMessages });

  return {
    listGroups: listTrackableGroups,

    async ingestGroup(tenantId, groupJid, ownerUserId): Promise<WhatsAppIngestResult> {
      // The archiver only captures a sender the account owner explicitly selected for tracking
      // (its own D-002/D-005) -- a deliberate, informed choice, never a background silent
      // capture (D-008 provided-first ordering).
      const consent: ConsentContext = { captureMode: "provided", given: true, recordedBy: `whatsapp-owner:${ownerUserId}` };
      const { source } = await whatsAppSource.fetch({ kind: "whatsapp", groupJid, ownerUserId, tenantId }, consent);
      await getAppDb().collection<Sources>("sources").insertOne(source);

      const turns = await whatsAppSource.toTurns(source);

      const sessionId = randomUUID();
      const session: Sessions = {
        _id: sessionId,
        tenantId,
        sourceId: source._id,
        title: `WhatsApp: ${groupJid}`,
        date: new Date().toISOString().slice(0, 10),
        status: { transcribe: "done", index: "pending" },
      };
      await getAppDb().collection<Sessions>("sessions").insertOne(session);

      const turnDocs: Turns[] = turns.map((t: Turn, i: number) => ({
        _id: `${sessionId}-t${String(i + 1).padStart(3, "0")}`,
        tenantId,
        sessionId,
        speakerRef: t.speakerRef,
        tStart: t.tStart,
        tEnd: t.tEnd,
        text: t.text,
      }));
      if (turnDocs.length > 0) await getAppDb().collection<Turns>("turns").insertMany(turnDocs);

      if (indexSession) {
        try {
          await indexSession(tenantId, sessionId);
        } catch (err) {
          console.error(`ingestGroup: indexing failed for session ${sessionId} (raw content still stored):`, err);
        }
      }

      return { sessionId, sourceId: source._id, turnCount: turnDocs.length };
    },
  };
}
