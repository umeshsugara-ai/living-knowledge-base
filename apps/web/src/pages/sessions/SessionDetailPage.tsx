import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.js";
import { getSession } from "../../api/sessions.js";
import { ApiError } from "../../api/client.js";
import type { SessionDetail } from "../../api/types.js";

const MAX_TURNS_SHOWN = 200;

// Real gap found live (2026-09-04) testing Ingest end-to-end: `tStart`/`tEnd` mean different
// units depending on how a turn was produced -- real seconds for an audio transcript, but a
// character OFFSET into the extracted text for a document/URL ingestion
// (packages/ingest/src/sources/document.ts's own `splitIntoParagraphTurns` docs this). Labeling
// both as "s" made an ingested Wikipedia page's turns read as "0s-28s" when that's actually
// characters 0-28, not seconds. `speakerRef` is the only signal available here to tell which.
function timeUnitLabel(speakerRef: string): string {
  return speakerRef === "url" || speakerRef === "document" ? "chars" : "s";
}

export function SessionDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const { apiKey } = useAuth();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    getSession(apiKey, id)
      .then((data) => { if (!cancelled) setDetail(data); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof ApiError ? err.message : "failed to load session"); });
    return () => { cancelled = true; };
  }, [apiKey, id]);

  if (error) return <div className="card error-note">{error}</div>;
  if (!detail) return <div className="card empty-note">Loading&hellip;</div>;

  return (
    <>
      <div className="page-header">
        <h1>{detail.session.title}</h1>
        <p>{detail.session.date}{detail.session.org ? ` · ${detail.session.org}` : ""}</p>
      </div>

      <div className="card">
        <div className="section-title">Overview</div>
        <p>{detail.page ? detail.page.summary : "(no summary yet)"}</p>
      </div>

      <div className="card">
        <div className="section-title">Claims ({detail.claims.length})</div>
        {detail.claims.length === 0 && <div className="empty-note">No claims extracted yet.</div>}
        {detail.claims.map((c) => (
          <div key={c._id} className="row-card">
            <div className="row-title">{c.text}</div>
            <div className="row-meta">status: {c.status}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="section-title">Transcript ({detail.turns.length} turns)</div>
        {detail.turns.length === 0 && <div className="empty-note">No turns for this session.</div>}
        {detail.turns.slice(0, MAX_TURNS_SHOWN).map((t) => {
          const unit = timeUnitLabel(t.speakerRef);
          return (
            <div key={t._id} className="row-card">
              <div className="row-title">{t.speakerRef} &middot; {t.tStart}{unit}&ndash;{t.tEnd}{unit}</div>
              <div>{t.text}</div>
            </div>
          );
        })}
        {detail.turns.length > MAX_TURNS_SHOWN && (
          <div className="empty-note">&hellip; and {detail.turns.length - MAX_TURNS_SHOWN} more turns (truncated for this view).</div>
        )}
      </div>
    </>
  );
}
