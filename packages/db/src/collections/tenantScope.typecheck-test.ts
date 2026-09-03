// packages/db/src/collections/tenantScope.typecheck-test.ts — T-018 C6. Not a runtime test
// (no assertions run); its only job is to fail `tsc` if the tenant-less call below ever
// stops being a compile error. `pnpm -r typecheck` must stay clean with this file present —
// a real error here (any error other than the expected one) fails the build.
import { claims } from "./claims.js";
import { sessions } from "./sessions.js";
import { sources } from "./sources.js";
import { turns } from "./turns.js";
import { gaps } from "./gaps.js";

// @ts-expect-error — tenantId is required; calling coll() with no argument must not compile.
sources();
// @ts-expect-error — tenantId is required; calling coll() with no argument must not compile.
sessions();
// @ts-expect-error — tenantId is required; calling coll() with no argument must not compile.
turns();
// @ts-expect-error — tenantId is required; calling coll() with no argument must not compile.
claims();
// @ts-expect-error — tenantId is required; calling coll() with no argument must not compile.
gaps();

// The valid form typechecks fine (proves the accessors work, not just that they reject).
export const validCalls = () => {
  sources("toc");
  sessions("toc");
  turns("toc");
  claims("toc");
  gaps("toc");
};
