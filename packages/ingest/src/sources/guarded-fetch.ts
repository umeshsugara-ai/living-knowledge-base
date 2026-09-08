/**
 * packages/ingest/src/sources/guarded-fetch.ts — a `UrlFetcher` that refuses to reach inside the
 * network. ISS-C-UNRUN-WRITERS-002 (high); contract invariant [I3] of watched-sources-entrypoint.
 *
 * Watched Sources fetches a stored URL on a timer, unattended, from inside the perimeter. That is
 * a textbook SSRF surface, and the cycle-1 checker ruled on where the control belongs and why:
 *
 *   NOT at registration. A store-time hostname check cannot survive DNS rebinding -- a name that
 *   resolved to a public address when a user registered it can resolve to 169.254.169.254 by the
 *   time the timer fires. Blocking a literal metadata IP in the route would LOOK like a control
 *   while leaving the actual path open, which is worse than having none.
 *
 * So the check is here, on the RESOLVED ADDRESS, immediately before each request, and every
 * redirect hop is re-resolved and re-checked. `lookup` and `request` are injected so the whole
 * thing is testable without a network, and so the resolution the guard checks is the same one the
 * caller will use.
 *
 * It fails CLOSED throughout: an address that cannot be parsed is treated as blocked, because the
 * alternative is a parser disagreement becoming an exfiltration path.
 */

export interface GuardedFetchDeps {
  /** Resolve a hostname to a single IP string. Injected so the guard and the request agree. */
  lookup(hostname: string): Promise<string>;
  request(url: string): Promise<{ status: number; location: string | null; body: string }>;
  maxRedirects?: number;
  maxBytes?: number;
}

const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_BYTES = 5_000_000;

function parseIpv4(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    octets.push(n);
  }
  return octets;
}

function blockedIpv4(o: number[]): boolean {
  const [a, b] = o as [number, number, number, number];
  if (a === 0) return true;                               // 0.0.0.0/8 unspecified
  if (a === 10) return true;                              // private
  if (a === 127) return true;                             // loopback
  if (a === 169 && b === 254) return true;                // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;       // private
  if (a === 192 && b === 168) return true;                // private
  if (a === 192 && o[1] === 0 && o[2] === 0) return true;  // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true;      // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true;   // benchmarking
  if (a >= 224) return true;                              // multicast + reserved + broadcast
  return false;
}

/**
 * Is this address one we refuse to talk to?
 *
 * Exported because the honesty of this module depends on it being inspectable and testable on its
 * own. **Anything unparseable returns `true`** -- fail closed.
 */
export function isBlockedAddress(address: string): boolean {
  const value = address.trim().toLowerCase();
  if (value === "") return true;

  const v4 = parseIpv4(value);
  if (v4) return blockedIpv4(v4);

  if (!value.includes(":")) return true; // not v4, not v6 -> unparseable -> blocked

  // IPv4-mapped / -compatible IPv6 (::ffff:127.0.0.1) must be judged on the embedded v4 address,
  // or loopback walks straight through the v6 branch.
  const tail = value.slice(value.lastIndexOf(":") + 1);
  const embedded = parseIpv4(tail);
  if (embedded) return blockedIpv4(embedded);

  if (value === "::" || value === "::1") return true;      // unspecified, loopback
  if (/^f[cd][0-9a-f]{0,2}:/.test(value)) return true;      // fc00::/7 unique-local
  if (/^fe[89ab][0-9a-f]?:/.test(value)) return true;       // fe80::/10 link-local
  if (/^ff[0-9a-f]{0,2}:/.test(value)) return true;         // ff00::/8 multicast
  if (!/^[0-9a-f:]+$/.test(value)) return true;             // not a v6 literal -> blocked
  return false;
}

function httpUrlOrNull(value: string, base?: string): URL | null {
  try {
    const u = base ? new URL(value, base) : new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

/** A `UrlFetcher` that resolves and checks every hop before issuing it. */
export function createGuardedFetcher(deps: GuardedFetchDeps): (url: string) => Promise<string> {
  const maxRedirects = deps.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = deps.maxBytes ?? DEFAULT_MAX_BYTES;

  return async function guardedFetch(startUrl: string): Promise<string> {
    let current = httpUrlOrNull(startUrl);
    if (!current) throw new Error(`guarded-fetch: not an http(s) url: ${startUrl}`);

    for (let hop = 0; hop <= maxRedirects; hop++) {
      // Resolve and check IMMEDIATELY before the request, every hop, no caching. Caching the
      // verdict is what reintroduces the rebinding window this guard exists to close.
      let address: string;
      try {
        address = await deps.lookup(current.hostname);
      } catch (err) {
        throw new Error(`guarded-fetch: cannot resolve ${current.hostname}: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (isBlockedAddress(address)) {
        throw new Error(`guarded-fetch: blocked -- ${current.hostname} resolves to a private or reserved address (${address})`);
      }

      const res = await deps.request(current.href);

      if (res.status >= 300 && res.status < 400 && res.location) {
        const next = httpUrlOrNull(res.location, current.href);
        if (!next) throw new Error(`guarded-fetch: blocked redirect to a non-http(s) scheme: ${res.location}`);
        current = next;
        continue;
      }

      if (res.body.length > maxBytes) {
        throw new Error(`guarded-fetch: response too large (${res.body.length} > ${maxBytes} bytes)`);
      }
      return res.body;
    }

    throw new Error(`guarded-fetch: too many redirects (> ${maxRedirects})`);
  };
}
