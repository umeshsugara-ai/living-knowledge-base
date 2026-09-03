/**
 * apps/api/src/hash.ts — T-009 C2. `node:crypto`'s built-in `sha256` is enough here (checked:
 * no hashing helper exists anywhere else in the workspace — `grep -rn "createHash\|scrypt"
 * packages` only hits `packages/meeting-bot/src/cli.ts`, an unrelated CLI id generator — so no
 * dependency added). Deterministic hash lets `schema/api_keys.schema.json`'s `keyHash` be looked
 * up by exact Mongo equality; the raw key itself is never persisted or compared.
 */
import { createHash } from "node:crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
