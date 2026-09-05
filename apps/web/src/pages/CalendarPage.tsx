import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { listSessions } from "../api/sessions.js";
import { listUpcomingMeetings } from "../api/calendar.js";
import { scanGmail, listMeetingCandidates, approveMeetingCandidate, rejectMeetingCandidate } from "../api/meeting-candidates.js";
import { ApiError } from "../api/client.js";
import { ExternalLinkIcon } from "../components/icons.js";
import type { SessionSummary, UpcomingMeeting, MeetingCandidate } from "../api/types.js";

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

function formatMeetingTime(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const dateStr = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const startStr = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endStr = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dateStr} · ${startStr}–${endStr}`;
}

export function CalendarPage(): React.ReactElement {
  const { apiKey } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<UpcomingMeeting[] | null>(null);
  const [meetingsError, setMeetingsError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<MeetingCandidate[] | null>(null);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSessions(apiKey)
      .then((data) => { if (!cancelled) setSessions(data.sessions); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof ApiError ? err.message : "failed to load sessions"); });
    return () => { cancelled = true; };
  }, [apiKey]);

  useEffect(() => {
    let cancelled = false;
    // A failed real-calendar fetch (gws unauthenticated, not installed, etc.) degrades to the
    // honest "not connected" state below -- never a page-wide error, since Past sessions still
    // work independently of this.
    listUpcomingMeetings(apiKey)
      .then((data) => { if (!cancelled) setMeetings(data.meetings); })
      .catch((err: unknown) => { if (!cancelled) setMeetingsError(err instanceof ApiError ? err.message : "failed to load upcoming meetings"); });
    return () => { cancelled = true; };
  }, [apiKey]);

  function refreshCandidates(): void {
    listMeetingCandidates(apiKey)
      .then((data) => setCandidates(data.candidates))
      .catch((err: unknown) => setCandidatesError(err instanceof ApiError ? err.message : "failed to load Gmail meeting candidates"));
  }

  useEffect(() => { refreshCandidates(); }, [apiKey]);

  function handleScan(): void {
    setScanning(true);
    setScanNote(null);
    scanGmail(apiKey)
      .then((result) => {
        setScanNote(`Found ${result.created} new candidate(s), ${result.autoApproved} auto-confirmed (trusted sender).`);
        refreshCandidates();
      })
      .catch((err: unknown) => setCandidatesError(err instanceof ApiError ? err.message : "Gmail scan failed"))
      .finally(() => setScanning(false));
  }

  function handleDecision(id: string, decision: "approve" | "reject"): void {
    const action = decision === "approve" ? approveMeetingCandidate : rejectMeetingCandidate;
    action(apiKey, id)
      .then(() => refreshCandidates())
      .catch((err: unknown) => setCandidatesError(err instanceof ApiError ? err.message : "failed to record decision"));
  }

  const grouped = useMemo(() => groupByMonth(sessions ?? []), [sessions]);
  const pendingCandidates = (candidates ?? []).filter((c) => c.status === "pending");

  return (
    <>
      <div className="page-header">
        <h1>Calendar</h1>
        <p>Past sessions, chronologically, and real upcoming meetings from your connected calendar.</p>
      </div>

      <div className="section-title">Upcoming</div>
      {meetingsError && <div className="card error-note">{meetingsError}</div>}
      {!meetingsError && meetings === null && <div className="card empty-note">Loading&hellip;</div>}
      {!meetingsError && meetings && meetings.length === 0 && (
        <div className="card empty-note">
          No upcoming meetings found in the next two weeks &mdash; either your calendar is clear, or
          the calendar connection (`gws`) isn&rsquo;t reachable from this server right now.
        </div>
      )}
      {meetings && meetings.length > 0 && (
        <div className="card">
          {meetings.map((m) => (
            <div key={m.id} className="row-card">
              <div className="row-title">{m.title}</div>
              <div className="row-meta">
                {formatMeetingTime(m.startTime, m.endTime)}
                {m.organizer ? ` · ${m.organizer}` : ""}
                {m.meetingUrl && (
                  <>
                    {" · "}
                    <a href={m.meetingUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                      Join <ExternalLinkIcon className="row-meta" />
                    </a>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Needs review (from Gmail)</span>
        <button type="button" onClick={handleScan} disabled={scanning} style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem", borderRadius: 6, border: "1px solid var(--line)", background: "var(--card)", cursor: "pointer" }}>
          {scanning ? "Scanning…" : "Scan Gmail"}
        </button>
      </div>
      <p className="row-meta" style={{ marginTop: "-0.4rem", marginBottom: "0.5rem" }}>
        Meeting-shaped mail is held for your approval; once a sender has been approved 3 times, its future
        meetings auto-confirm.
      </p>
      {scanNote && <div className="card empty-note">{scanNote}</div>}
      {candidatesError && <div className="card error-note">{candidatesError}</div>}
      {!candidatesError && candidates === null && <div className="card empty-note">Loading&hellip;</div>}
      {candidates && pendingCandidates.length === 0 && !scanNote && (
        <div className="card empty-note">No meeting candidates awaiting review. Click "Scan Gmail" to check.</div>
      )}
      {pendingCandidates.length > 0 && (
        <div className="card">
          {pendingCandidates.map((c) => (
            <div key={c._id} className="row-card">
              <div className="row-title">{c.subject}</div>
              <div className="row-meta">
                {c.senderEmail}
                {c.meetingUrl ? ` · ${c.meetingUrl}` : ""}
              </div>
              <div style={{ marginTop: "0.4rem", display: "flex", gap: "0.5rem" }}>
                <button type="button" onClick={() => handleDecision(c._id, "approve")} className="badge badge-good" style={{ border: "none", cursor: "pointer" }}>
                  Approve
                </button>
                <button type="button" onClick={() => handleDecision(c._id, "reject")} className="badge badge-bad" style={{ border: "none", cursor: "pointer" }}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
