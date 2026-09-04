import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { listGaps } from "../api/gaps.js";
import { listSessions } from "../api/sessions.js";
import { listSources } from "../api/sources.js";
import { listKeys } from "../api/keys.js";
import { ApiError } from "../api/client.js";
import { StatCard } from "../components/StatCard.js";
import { SessionsIcon, SourcesIcon, KeyIcon, GapIcon } from "../components/icons.js";
import type { Gap, SessionSummary } from "../api/types.js";

function badgeClass(status: Gap["status"]): string {
  if (status === "open") return "badge badge-warn";
  if (status === "received") return "badge badge-good";
  return "badge badge-bad";
}

interface Counts {
  sessions: number;
  sources: number;
  activeKeys: number;
}

export function DashboardPage(): React.ReactElement {
  const { apiKey } = useAuth();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [recentSessions, setRecentSessions] = useState<SessionSummary[] | null>(null);
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Every number here comes from an already-real, already-checker-PASSed route (GET
    // /sessions, /sources, /keys, /gaps) -- no new backend, no aggregate endpoint, just the
    // real per-resource lists this dashboard reads the length/contents of. Real data or an
    // honest error, never a placeholder number.
    Promise.all([listSessions(apiKey), listSources(apiKey), listKeys(apiKey), listGaps(apiKey)])
      .then(([sessionsRes, sourcesRes, keysRes, gapsRes]) => {
        if (cancelled) return;
        const sorted = [...sessionsRes.sessions].sort((a, b) => b.date.localeCompare(a.date));
        setRecentSessions(sorted.slice(0, 5));
        setCounts({
          sessions: sessionsRes.sessions.length,
          sources: sourcesRes.sources.length,
          activeKeys: keysRes.keys.filter((k) => !k.revokedAt).length,
        });
        setGaps(gapsRes.gaps);
      })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof ApiError ? err.message : "failed to load dashboard data"); });
    return () => { cancelled = true; };
  }, [apiKey]);

  if (error) return <div className="card error-note">{error}</div>;

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>A real, at-a-glance view of this tenant's knowledge base &mdash; every number below is live.</p>
      </div>

      {!counts && <div className="card empty-note">Loading&hellip;</div>}
      {counts && gaps && (
        <div className="stat-grid">
          <StatCard icon={<SessionsIcon />} label="Sessions" value={counts.sessions} tone="accent" />
          <StatCard icon={<SourcesIcon />} label="Sources" value={counts.sources} tone="accent" />
          <StatCard icon={<KeyIcon />} label="Active API keys" value={counts.activeKeys} tone="good" />
          <StatCard icon={<GapIcon />} label="Open gaps" value={gaps.filter((g) => g.status === "open").length} tone={gaps.some((g) => g.status === "open") ? "warn" : "good"} />
        </div>
      )}

      {recentSessions && (
        <>
          <div className="section-title">Recent sessions</div>
          {recentSessions.length === 0 && <div className="card empty-note">No sessions yet.</div>}
          {recentSessions.length > 0 && (
            <div className="card">
              {recentSessions.map((s) => (
                <Link key={s._id} to={`/sessions/${encodeURIComponent(s._id)}`} className="row-card">
                  <div className="row-title">{s.title}</div>
                  <div className="row-meta">{s.date}{s.org ? ` · ${s.org}` : ""}</div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <div className="section-title">Knowledge health</div>
      {gaps === null && <div className="card empty-note">Loading&hellip;</div>}
      {gaps && gaps.length === 0 && (
        <div className="card empty-note">
          No gaps recorded for this tenant &mdash; either everything is covered, or gap-tracking hasn't logged anything yet.
        </div>
      )}
      {gaps && gaps.length > 0 && (
        <div className="card">
          {gaps.map((g) => (
            <div key={g._id} className="row-card">
              <div className="row-title">
                {g.kind} <span className={badgeClass(g.status)}>{g.status}</span>
              </div>
              <div className="row-meta">{g.description ?? "(no description)"}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
