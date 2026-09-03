/**
 * apps/api/src/auth.ts — T-009 C2. API-key auth middleware. Reads `Authorization: Bearer
 * <key>`, verifies via an injected `ApiKeyStore` (matches `schema/api_keys.schema.json`'s
 * `keyHash`/`scopes`/`revokedAt` shape — the store itself hashes and compares, this file never
 * sees a raw key past the request). 401 on missing/malformed/invalid/revoked key; a separate
 * `requireScope` 403s if the route's required scope isn't in the key's `scopes` — kept as two
 * middlewares so "unauthorized" and "forbidden" are never conflated into one status code.
 */
import type { NextFunction, Request, RequestHandler, Response } from "express";

export interface VerifiedKey {
  tenantId: string;
  scopes: string[];
}

/** Injected dependency (C2) — production impl in `store.ts` is Mongo-backed; tests use a fake. */
export interface ApiKeyStore {
  verify(key: string): Promise<VerifiedKey | null>;
}

declare global {
  namespace Express {
    interface Request {
      auth?: VerifiedKey;
    }
  }
}

const BEARER = /^Bearer\s+(.+)$/i;

export function requireAuth(store: ApiKeyStore): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.header("authorization") ?? "";
    const match = BEARER.exec(header);
    if (!match) {
      res.status(401).json({ error: "unauthorized", message: "missing or malformed Authorization: Bearer <key> header" });
      return;
    }
    const verified = await store.verify(match[1]!);
    if (!verified) {
      res.status(401).json({ error: "unauthorized", message: "invalid or revoked API key" });
      return;
    }
    req.auth = verified;
    next();
  };
}

export function requireScope(scope: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !req.auth.scopes.includes(scope)) {
      res.status(403).json({ error: "forbidden", message: `this key is missing the required "${scope}" scope` });
      return;
    }
    next();
  };
}
