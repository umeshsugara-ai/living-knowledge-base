/**
 * packages/ingest/src/sources/node-transport.ts — the real transport behind `createGuardedFetcher`.
 *
 * Everything in `guarded-fetch.ts` was injected seams until now, which is why A13 could not move:
 * the guard was correct and nothing could actually fetch. This supplies `lookup` and `request` for
 * real, and it is deliberately the ONLY place in the feature that touches the network.
 *
 * Three properties the guard depends on and this must not weaken:
 *   - `lookup` returns **every** address (`all: true`). Returning one would reinstate the coin-flip
 *     bypass ISS-C-UNRUN-WRITERS-007 closed — a host publishing one public and one private record.
 *   - `request` does NOT follow redirects itself (`redirect: "manual"`). Following them here would
 *     step past the guard, which re-resolves and re-checks every hop. This is the whole control.
 *   - `request` honours its `timeoutMs` and `maxBytes` rather than leaving them to the caller:
 *     an `AbortSignal` actually cancels the request (ISS-015), and the body is read in chunks so an
 *     oversized response is abandoned mid-stream rather than allocated and then measured.
 */
import { lookup as dnsLookup } from "node:dns/promises";

/** Every address a hostname currently answers with. */
export async function resolveAll(hostname: string): Promise<string[]> {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

export interface HttpTransportResponse {
  status: number;
  location: string | null;
  body: string;
}

/**
 * One HTTP request, bounded in time and size, never following redirects.
 *
 * `AbortSignal.timeout` genuinely cancels the in-flight request, so the abandoned-handle leak the
 * guard could not close on its own (ISS-015) is closed here, at the layer that owns the socket.
 */
export async function httpRequest(
  url: string,
  opts: { maxBytes: number; timeoutMs: number },
): Promise<HttpTransportResponse> {
  const res = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(opts.timeoutMs),
    headers: { accept: "text/html,text/plain,*/*" },
  });

  const location = res.headers.get("location");
  if (res.status >= 300 && res.status < 400) {
    // Do not read a redirect's body at all: the guard has not vetted the next hop yet.
    return { status: res.status, location, body: "" };
  }

  // Read in chunks and stop at the cap, so an oversized response is abandoned mid-stream rather
  // than fully allocated and then measured after the fact.
  const reader = res.body?.getReader();
  if (!reader) return { status: res.status, location, body: "" };

  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > opts.maxBytes) {
      await reader.cancel();
      throw new Error(`node-transport: response too large (> ${opts.maxBytes} bytes)`);
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return { status: res.status, location, body: text };
}
