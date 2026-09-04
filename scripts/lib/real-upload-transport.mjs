/**
 * scripts/lib/real-upload-transport.mjs — shared between transcribe-toc-session.mjs and
 * transcribe-long-session.mjs. Real UploadTransport — fetch()-based, reads response headers
 * (needed for the resumable upload's x-goog-upload-url handoff), which apps/api/src/
 * ai-transport.ts's httpTransport (built for the JSON-only Transport seam) does not expose.
 */
export async function realUploadTransport(req) {
  const headers = { ...req.headers };
  const isRawBytes = req.body instanceof Uint8Array;
  const res = await fetch(req.url, {
    method: req.method,
    headers,
    body: isRawBytes ? req.body : req.body !== undefined ? JSON.stringify(req.body) : undefined,
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  const respHeaders = {};
  for (const [k, v] of res.headers.entries()) respHeaders[k.toLowerCase()] = v;
  return { status: res.status, headers: respHeaders, body };
}
