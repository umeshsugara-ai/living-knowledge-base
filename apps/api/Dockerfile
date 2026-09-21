# apps/api/Dockerfile — production image for @lkb/api.
#
# The whole pnpm workspace is copied in (not just apps/api) because every route ultimately
# imports sibling `workspace:*` packages (@lkb/core, @lkb/ai, @lkb/db, @lkb/ask, @lkb/index) by
# TypeScript source, run directly via tsx at request time -- there is no compiled `dist/` step
# yet, so tsx has to stay a runtime dependency, not just a dev one. This keeps the image simple
# and correct for now; compiling to plain JS ahead of time (dropping tsx + full source from the
# final image) is a real follow-up once the app is closer to a stable release, not before.
FROM node:24-slim AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# Separate stage so `pnpm install` only reruns when a package.json or the lockfile actually
# changes, not on every source edit -- every pnpm-workspace.yaml member needs its package.json
# present here or `pnpm install` fails with a missing-workspace-member error.
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ask/package.json packages/ask/package.json
COPY packages/index/package.json packages/index/package.json
COPY packages/ingest/package.json packages/ingest/package.json
COPY packages/meeting-bot/package.json packages/meeting-bot/package.json
COPY workers/transcribe/package.json workers/transcribe/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

FROM base AS runtime
ENV NODE_ENV=production
# `deps`'s pnpm install created node_modules not just at /app/node_modules but nested inside
# every workspace member too (packages/db/node_modules/@lkb -> ../../core, etc. -- pnpm's normal
# non-hoisted symlink layout). Copying only the root node_modules and then overwriting
# packages/apps from the build context (which has no node_modules, .dockerignore excludes it)
# wiped those nested symlinks out -- real bug hit live (2026-09-04) as ERR_MODULE_NOT_FOUND for
# @lkb/db at container start. Copying the whole deps output FIRST, then overlaying real source
# on top, keeps every nested node_modules intact while still getting current source in.
COPY --from=deps /app ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY config ./config

EXPOSE 3300
CMD ["npx", "tsx", "apps/api/src/index.ts"]
