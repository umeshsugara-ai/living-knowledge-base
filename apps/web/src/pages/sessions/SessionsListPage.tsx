import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.js";
import { listSessions } from "../../api/sessions.js";
import { ApiError } from "../../api/client.js";
import type { SessionSummary } from "../../api/types.js";

export function SessionsListPage(): React.ReactElement {
  const { apiKey } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSessions(apiKey)
      .then((data) => { if (!cancelled) setSessions(data.sessions); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof ApiError ? err.message : "failed to load sessions"); });
    return () => { cancelled = true; };
  }, [apiKey]);

  return (
    <>
      <div className="page-header">
        <h1>Sessions</h1>
        <p>Every real ingested session. Click one for its summary, claims, and transcript.</p>
      </div>
      {error && <div className="card error-note">{error}</div>}
      {!error && sessions === null && <div className="card empty-note">Loading&hellip;</div>}
      {sessions && sessions.length === 0 && <div className="card empty-note">No sessions found for this tenant.</div>}
      {sessions && sessions.length > 0 && (
        <div className="card">
          {sessions.map((s) => (
            <Link key={s._id} to={`/sessions/${encodeURIComponent(s._id)}`} className="row-card">
              <div className="row-title">{s.title}</div>
              <div className="row-meta">
                {s.date}{s.org ? ` · ${s.org}` : ""} &middot; index: {s.status?.index ?? "unknown"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
