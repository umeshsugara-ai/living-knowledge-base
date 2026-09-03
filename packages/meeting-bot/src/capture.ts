/**
 * packages/meeting-bot/src/capture.ts — T-024 C4. Composes `detectPlatform -> selectJoinStrategy
 * -> Joiner.join -> packages/ingest's recording adapter (fetch/toTurns) -> assertProvidedFirst`.
 *
 * Dependency-rule note (ARCHITECTURE §5: `meeting-bot -> ingest (source interface), core`,
 * enforced by `.dependency-cruiser.cjs`'s `meeting-bot-only-ingest-core` rule): this file imports
 * only from `@lkb/ingest` and `@lkb/core`. It never imports a concrete `Joiner` implementation
 * (`joiners/*.ts`) or `@lkb/ai` directly — every joiner and the already-wired ingest `Source`
 * adapter (its `transcribe`/`hasher`/`reader` are the CALLER's concern, e.g. cli.ts) arrive via
 * `deps`.
 *
 * D-008 ordering: `assertProvidedFirst` runs BEFORE `Joiner.join` — a silent capture without
 * confirmation is warned about before any join is attempted, not after.
 *
 * TODO(T-024b): a real joiner's `mediaStream` will need to be persisted to a path the ingest
 * `recording` adapter's injected `reader` can read. For now `sessionHandle` doubles as that path
 * — every T-024 joiner is a stub that returns a fixture-resolvable handle, and the caller's
 * injected `reader` (fake in tests, real file reader in the CLI) is expected to resolve it.
 */
import type { Sessions } from "@lkb/core";
import type { ConsentContext, Source, SourceDoc, Turn } from "@lkb/ingest";
import { assertProvidedFirst } from "@lkb/ingest";

import { detectPlatform } from "./platform.js";
import { selectJoinStrategy, type JoinStrategy } from "./strategy.js";
import type { Joiner } from "./joiner.js";

export interface CaptureOpts {
  tenantId: string;
  consent: ConsentContext;
  title?: string;
  /** ISO date (YYYY-MM-DD); defaults to `deps.now()`'s date. */
  date?: string;
}

export interface CaptureDeps {
  /** One Joiner per strategy — capture.ts never imports a concrete joiner (see file header). */
  joiners: Record<JoinStrategy, Joiner>;
  /** Already-wired `recording` Source adapter (transcribe/hasher/reader supplied by the caller). */
  ingestSource: Source;
  now?: () => string;
  sessionId?: (source: SourceDoc) => string;
}

export interface CaptureResult {
  source: SourceDoc;
  session: Sessions;
  turns: Turn[];
  warnings: string[];
}

export async function capture(url: string, opts: CaptureOpts, deps: CaptureDeps): Promise<CaptureResult> {
  const warnings: string[] = [];

  // D-008 provided-first soft gate — runs BEFORE join.
  const providedFirstWarning = assertProvidedFirst(opts.consent);
  if (providedFirstWarning) warnings.push(providedFirstWarning);

  const platform = detectPlatform(url);
  const strategy = selectJoinStrategy(platform);
  const joiner = deps.joiners[strategy];
  if (!joiner) {
    throw new Error(`capture: no Joiner injected for strategy '${strategy}' (platform '${platform}')`);
  }

  const { sessionHandle } = await joiner.join(url, {
    tenantId: opts.tenantId,
    consentNote: opts.consent.note,
  });

  try {
    const { source } = await deps.ingestSource.fetch(
      { kind: "recording", path: sessionHandle, tenantId: opts.tenantId },
      opts.consent,
    );
    const turns = await deps.ingestSource.toTurns(source);

    const now = deps.now ?? (() => new Date().toISOString());
    const nowIso = now();
    const session: Sessions = {
      _id: deps.sessionId ? deps.sessionId(source) : `${source._id}-session`,
      tenantId: opts.tenantId,
      sourceId: source._id,
      title: opts.title ?? `${platform} capture — ${url}`,
      date: opts.date ?? nowIso.slice(0, 10),
      status: { transcribe: "done", index: "pending" },
    };

    return { source, session, turns, warnings };
  } finally {
    await joiner.stop(sessionHandle);
  }
}
