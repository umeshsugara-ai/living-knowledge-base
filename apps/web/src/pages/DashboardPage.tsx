import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.js";
import { listGaps } from "../api/gaps.js";
import { ApiError } from "../api/client.js";
import type { Gap } from "../api/types.js";

function badgeClass(status: Gap["status"]): string {
  if (status === "open") return "badge badge-warn";
  if (status === "received") return "badge badge-good";
  return "badge badge-bad";
}

export function DashboardPage(): React.ReactElement {
  const { apiKey } = useAuth();
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listGaps(apiKey)
      .then((data) => { if (!cancelled) setGaps(data.gaps); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof ApiError ? err.message : "failed to load gaps"); });
    return () => { cancelled = true; };
  }, [apiKey]);

  return (
    <>
      <div className="page-header">
        <h1>Knowledge health</h1>
        <p>Open gaps the system knows about &mdash; real data, may be genuinely empty today.</p>
      </div>
      {error && <div className="card error-note">{error}</div>}
      {!error && gaps === null && <div className="card empty-note">Loading&hellip;</div>}
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
