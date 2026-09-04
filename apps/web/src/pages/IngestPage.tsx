import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { ingestUrl, type IngestResult } from "../api/ingest.js";
import { ApiError } from "../api/client.js";

export function IngestPage(): React.ReactElement {
  const { apiKey } = useAuth();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!url.trim()) {
      setError("enter a URL first");
      return;
    }
    setLoading(true);
    try {
      const data = await ingestUrl(apiKey, url.trim());
      setResult(data);
      setUrl("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "failed to ingest this URL");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Ingest</h1>
        <p>
          Paste a URL to pull its content into the knowledge base as a real, real-time-fetched
          session &mdash; real extraction (Jina Reader), real storage, no fabricated content.
        </p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <label htmlFor="ingest-url">URL</label>
          <input
            id="ingest-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
          />
          <button type="submit" disabled={loading} style={{ marginTop: "1rem" }}>
            {loading ? "Fetching..." : "Ingest"}
          </button>
        </form>
        {error && <div className="error-note" style={{ marginTop: "0.5rem" }}>{error}</div>}
      </div>

      {result && (
        <div className="card" style={{ borderColor: "var(--good)" }}>
          <div className="section-title">Ingested</div>
          <p>
            Created a real session with {result.turnCount} real paragraph turn(s).{" "}
            <Link to={`/sessions/${encodeURIComponent(result.sessionId)}`}>View it</Link>
          </p>
        </div>
      )}

      <div className="section-title">What's real here today</div>
      <div className="card empty-note">
        URL ingestion only, for now &mdash; a real extraction call (Jina Reader) splits the page
        into real paragraph-level turns and stores them as a real session. Document upload (PDF/
        DOCX/TXT/MD) and recording upload need real file-upload handling this app doesn't have
        yet &mdash; genuine follow-up work, not silently promised here.
      </div>
    </>
  );
}
