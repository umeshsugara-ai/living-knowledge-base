import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { listSessions } from "../api/sessions.js";
import { ApiError } from "../api/client.js";
import type { SessionSummary } from "../api/types.js";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function groupByMonth(sessions: SessionSummary[]): Map<string, SessionSummary[]> {
  const groups = new Map<string, SessionSummary[]>();
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    const key = s.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return groups;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const idx = Number(month) - 1;
  return `${MONTH_NAMES[idx] ?? month} ${year}`;
}

export function CalendarPage(): React.ReactElement {
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

  const grouped = useMemo(() => groupByMonth(sessions ?? []), [sessions]);

  return (
    <>
      <div className="page-header">
        <h1>Calendar</h1>
        <p>Past sessions, chronologically, and upcoming events (a real, honest empty state today).</p>
      </div>

      <div className="section-title">Upcoming</div>
      <div className="card empty-note">
        No upcoming events are tracked yet. Real calendar sync (meeting-bot's Google Calendar
        integration) and gap due-dates aren't wired to a live data source yet &mdash; this section
        will populate once one of those ships, not before.
      </div>

      <div className="section-title">Past</div>
      {error && <div className="card error-note">{error}</div>}
      {!error && sessions === null && <div className="card empty-note">Loading&hellip;</div>}
      {sessions && sessions.length === 0 && <div className="card empty-note">No past sessions recorded.</div>}
      {[...grouped.entries()].reverse().map(([monthKey, monthSessions]) => (
        <div key={monthKey} className="card">
          <div className="row-title" style={{ marginBottom: "0.5rem" }}>{monthLabel(monthKey)}</div>
          {monthSessions.map((s) => (
            <Link key={s._id} to={`/sessions/${encodeURIComponent(s._id)}`} className="row-card">
              <div className="row-title">{s.title}</div>
              <div className="row-meta">{s.date}{s.org ? ` · ${s.org}` : ""}</div>
            </Link>
          ))}
        </div>
      ))}
    </>
  );
}
