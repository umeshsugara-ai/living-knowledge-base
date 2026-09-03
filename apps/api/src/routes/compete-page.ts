/**
 * apps/api/src/routes/compete-page.ts — T-012 C4. `GET /compete`, a single plain HTML + vanilla
 * JS page (no new frontend framework/dependency, per the contract: "dont take it too much").
 * Served inline (no static-file dir needed for one page) alongside `compete.ts`'s two POST
 * routes in the same T-009 Express app. The page asks for an API key once (stored in
 * localStorage only, never sent anywhere but this tenant's own `Authorization` header) because
 * `server.ts` requires auth on every route including this one — no special-cased public page.
 */
import { Router, type Request, type Response } from "express";

const PAGE = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Compete</title>
<style>
  body { font-family: sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
  label { display: block; margin-top: 0.75rem; font-weight: bold; }
  input, textarea { width: 100%; box-sizing: border-box; padding: 0.4rem; margin-top: 0.25rem; }
  button { margin-top: 1rem; padding: 0.5rem 1rem; }
  #result, #scoreForm { display: none; margin-top: 1.5rem; border-top: 1px solid #ccc; padding-top: 1rem; }
  #status { color: #b00; margin-top: 0.5rem; }
</style>
</head>
<body>
<h1>Compete</h1>

<label>API key<input id="apiKey" type="password" /></label>
<label>Counsellor name<input id="counsellorName" /></label>
<label>Org (optional)<input id="counsellorOrg" /></label>
<label>Question<textarea id="question" rows="3"></textarea></label>
<button id="startBtn">Start</button>
<div id="status"></div>

<div id="result">
  <h2>AI answer</h2>
  <p id="aiAnswerText"></p>
  <pre id="aiSources"></pre>
</div>

<div id="scoreForm">
  <h2>Score</h2>
  <label>Counsellor's own answer<textarea id="counsellorAnswer" rows="3"></textarea></label>
  <label>AI score (1-5)<input id="aiScore" type="number" min="1" max="5" /></label>
  <label>Counsellor score (1-5)<input id="counsellorScore" type="number" min="1" max="5" /></label>
  <label>Notes (optional)<input id="notes" /></label>
  <button id="saveBtn">Save</button>
</div>

<script>
  let evalRunId = null;

  function key() {
    const stored = localStorage.getItem("competeApiKey");
    const input = document.getElementById("apiKey");
    if (input.value) { localStorage.setItem("competeApiKey", input.value); return input.value; }
    if (stored) { input.value = stored; return stored; }
    return "";
  }

  function setStatus(msg) { document.getElementById("status").textContent = msg || ""; }

  document.getElementById("startBtn").addEventListener("click", async () => {
    setStatus("");
    const body = {
      question: document.getElementById("question").value,
      counsellor: {
        name: document.getElementById("counsellorName").value,
        org: document.getElementById("counsellorOrg").value || undefined,
      },
    };
    const res = await fetch("/compete/start", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + key() },
      body: JSON.stringify(body),
    });
    if (!res.ok) { setStatus("start failed: " + res.status); return; }
    const data = await res.json();
    evalRunId = data.evalRunId;
    document.getElementById("aiAnswerText").textContent = data.aiAnswer.text || "";
    document.getElementById("aiSources").textContent = JSON.stringify(data.aiAnswer.sources || {}, null, 2);
    document.getElementById("result").style.display = "block";
    document.getElementById("scoreForm").style.display = "block";
  });

  document.getElementById("saveBtn").addEventListener("click", async () => {
    setStatus("");
    if (!evalRunId) { setStatus("start a question first"); return; }
    const body = {
      counsellorAnswer: { text: document.getElementById("counsellorAnswer").value },
      score: {
        ai: Number(document.getElementById("aiScore").value),
        counsellor: Number(document.getElementById("counsellorScore").value),
      },
      notes: document.getElementById("notes").value || undefined,
    };
    const res = await fetch("/compete/" + evalRunId + "/score", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + key() },
      body: JSON.stringify(body),
    });
    setStatus(res.ok ? "saved" : "save failed: " + res.status);
  });
</script>
</body>
</html>
`;

export function createCompetePageRouter(): Router {
  const router = Router();
  router.get("/compete", (_req: Request, res: Response) => {
    res.type("html").send(PAGE);
  });
  return router;
}
