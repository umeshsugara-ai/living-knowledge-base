/**
 * apps/api/src/ingest-store.ts — real `IngestDeps` (routes/ingest.ts) for `POST /ingest`.
 * Separate file from `store.ts` (which documents itself as the simple read/verify composition
 * root) since this one does real write orchestration: fetch real content via Jina Reader
 * (`https://r.jina.ai/<url>`, works anonymously, uses `JINA_API_KEY` as a Bearer token when
 * set for higher rate limits — neither required nor assumed), run it through `@lkb/ingest`'s
 * already-real `url` adapter, and persist a `sources` + `sessions` + `turns` doc set. The
 * created session is immediately visible through the already-real `GET /sessions/:id` route —
 * no second "ingested content" view is built, the existing one is reused.
 */
import { randomUUID } from "node:crypto";
import { getDb } from "@lkb/db";
import type { Sources, Sessions, Turns } from "@lkb/core";
import { createUrlSource, type ConsentContext, type Turn } from "@lkb/ingest";
import type { IngestDeps, IngestResult } from "./routes/ingest.js";
import { sha256Hex } from "./hash.js";

async function jinaReaderFetch(url: string): Promise<string> {
  const apiKey = process.env.JINA_API_KEY;
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
  });
  if (!res.ok) throw new Error(`Jina Reader could not fetch this URL (HTTP ${res.status})`);
  return res.text();
}

export function createMongoIngestDeps(): IngestDeps {
  const urlSource = createUrlSource({ hasher: sha256Hex, fetcher: jinaReaderFetch });

  return {
    async ingestUrl(tenantId, url): Promise<IngestResult> {
      // A self-served "paste a URL" ingestion is public web content by construction, never the
      // D-008 "silent" last-resort mode -- the caller explicitly handed us this URL to fetch.
      const consent: ConsentContext = { captureMode: "public", given: true, recordedBy: "web-ingest" };
      const { source } = await urlSource.fetch({ kind: "url", url, tenantId }, consent);
      await getDb().collection<Sources>("sources").insertOne(source);

      const turns = await urlSource.toTurns(source);

      const sessionId = randomUUID();
      const session: Sessions = {
        _id: sessionId,
        tenantId,
        sourceId: source._id,
        title: url,
        date: new Date().toISOString().slice(0, 10),
        status: { transcribe: "done", index: "pending" },
      };
      await getDb().collection<Sessions>("sessions").insertOne(session);

      const turnDocs: Turns[] = turns.map((t: Turn, i: number) => ({
        _id: `${sessionId}-t${String(i + 1).padStart(3, "0")}`,
        tenantId,
        sessionId,
        speakerRef: t.speakerRef,
        tStart: t.tStart,
        tEnd: t.tEnd,
        text: t.text,
      }));
      if (turnDocs.length > 0) await getDb().collection<Turns>("turns").insertMany(turnDocs);

      return { sessionId, sourceId: source._id, turnCount: turnDocs.length };
    },
  };
}
