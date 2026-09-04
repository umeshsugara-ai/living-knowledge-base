import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.js";
import { listSources } from "../api/sources.js";
import { ApiError } from "../api/client.js";
import type { Source } from "../api/types.js";

export function SourcesPage(): React.ReactElement {
  const { apiKey } = useAuth();
  const [sources, setSources] = useState<Source[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSources(apiKey)
      .then((data) => { if (!cancelled) setSources(data.sources); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof ApiError ? err.message : "failed to load sources"); });
    return () => { cancelled = true; };
  }, [apiKey]);

  return (
    <>
      <div className="page-header">
        <h1>Sources</h1>
        <p>Every raw source that has been ingested into the knowledge base.</p>
      </div>
      {error && <div className="card error-note">{error}</div>}
      {!error && sources === null && <div className="card empty-note">Loading&hellip;</div>}
      {sources && sources.length === 0 && <div className="card empty-note">No sources recorded for this tenant yet.</div>}
      {sources && sources.length > 0 && (
        <div className="card">
          {sources.map((s) => (
            <div key={s._id} className="row-card">
              <div className="row-title">{s.kind} &middot; {s.captureMode}</div>
              <div className="row-meta">{s.url ?? s.path ?? "(no location recorded)"} &middot; {s.createdAt}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
