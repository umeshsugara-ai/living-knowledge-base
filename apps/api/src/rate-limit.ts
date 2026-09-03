/**
 * apps/api/src/rate-limit.ts — T-009 C6. Per-key fixed-window limiter. `sources/whatsapp_msg`
 * already carries `express-rate-limit@8.6.2` as a proven dependency for this exact stack
 * (checked `sources/whatsapp_msg/package.json` first, per the contract) — reused here rather
 * than hand-rolled. Keyed on the verified tenantId (this middleware is mounted after
 * `requireAuth`, so `req.auth` is always set by the time it runs) so one caller's key can't be
 * starved by another's traffic.
 */
import rateLimit, { ipKeyGenerator, type RateLimitRequestHandler } from "express-rate-limit";

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

export function createRateLimiter(opts: RateLimitOptions = {}): RateLimitRequestHandler {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 60;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // `ipKeyGenerator` normalizes IPv6 addresses (subnet-aware) per express-rate-limit's own
    // guidance — a raw `req.ip` fallback would let IPv6 callers dodge the per-key limit.
    keyGenerator: (req) => req.auth?.tenantId ?? ipKeyGenerator(req.ip ?? "anonymous"),
    handler: (_req, res) => {
      res.setHeader("Retry-After", Math.ceil(windowMs / 1000).toString());
      res.status(429).json({ error: "rate_limited", message: "too many requests — slow down and retry after the window" });
    },
  });
}
