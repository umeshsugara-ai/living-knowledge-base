# Verdict — live-demo-server

Cycle checked: 1
Verdict: PASS

## Criterion-by-criterion
1. **store.ts tree lookup fix** — PASS — `createMongoTreeStore().load` (apps/api/src/store.ts:33-38) queries `{ node_id: \`tenant:${tenantId}\`, level: "tenant" }`, matching buildTree's root node_id shape. `pnpm --filter @lkb/api test` green (18/18).
2. **compete-page mounted before requireAuth** — PASS — server.ts:32-33: `app.use(createCompetePageRouter())` precedes `app.use(requireAuth(deps.keyStore))`. Real unauthenticated `curl GET /compete` against my own container returned 200. All other routes (ask, compete POST, stubs) still mounted after auth; auth-negative tests in apps/api suite (401/403 cases) pass.
3. **index.ts pathToFileURL guard** — PASS — index.ts:26 uses `import.meta.url === pathToFileURL(process.argv[1]).href`, no hand-built file:// string. Confirmed live: Docker container log shows `@lkb/api listening on :3000`.
4. **parseJsonLoose shared helper** — PASS — packages/ai/src/json.ts exports `parseJsonLoose(text): unknown`, tries JSON.parse then a fence-strip retry, returns null, never throws. Exported via packages/ai/src/index.ts:5. Grep confirms real usage (not just import) in select-nodes.ts:53, refine.ts:40, apps/api/src/score.ts:38.
5. **seed-demo-server.mjs** — PASS — ran it myself: `loaded 23 sessions, 23 session_pages for tenant "toc"`, `wrote tree_index root "tenant:toc" (1 year node(s))`, minted a fresh real API key.
6. **compete-page CSS rewrite + no innerHTML + compete.ts scored/verdict** — PASS — full CSS system present (palette, cards, verdict badges, source cards). Grep for `innerHTML` in compete-page.ts returns zero code hits (only two comment lines referencing it as what was *avoided*). All source rendering uses createElement/textContent. compete.ts:83 confirms `aiAnswer = { text, sources, scored, verdict }` — both scored and verdict present.
7. **Dockerfile/.dockerignore/docker-compose.yml** — PASS — built it myself (`docker build -f apps/api/Dockerfile -t lkb-api:checker-verify .`) exit 0. Ran container, logs showed `@lkb/api listening on :3000`, no ERR_MODULE_NOT_FOUND. `curl /compete` (no auth) → 200.
8. **No regression, full workspace test** — PASS — ran `pnpm -r test` myself: core 7/7, index 19/19, ai 54/54, ingest 34/34, ask 30/30, meeting-bot 40/40, api 18/18 = 202/202 pass, 0 fail, exit 0.

## Issues found (if any)
- [low/hygiene] The working tree also contains uncommitted, undisclosed changes to `packages/ai/src/stt/gemini-file-upload.ts` and `packages/ai/src/stt/gemini-file-upload.test.ts` (a `[H:MM:SS]` timestamp-parsing fix), plus new untracked `packages/ai/src/stt/chunk-audio.ts`/`chunk-audio.test.ts`. These are not mentioned anywhere in this manifest's "What changed" list and are not part of any of the 8 contract criteria. They appear to belong to the T-003 long-audio-chunking unit, which the contract explicitly names as a separate, out-of-scope unit — so this isn't a hidden regression inside this contract's surface, but it does mean the working tree is currently mixing two units' uncommitted work. Flagging for hygiene; does not affect this PASS.

## Real commands run + real output

### Full workspace test (fresh, this session)
```
$ pnpm -r test
packages/core test:  tests 7   pass 7   fail 0
packages/index test: tests 19  pass 19  fail 0
packages/ai test:    tests 54  pass 54  fail 0
packages/ingest test: tests 34 pass 34  fail 0
packages/ask test:   tests 30  pass 30  fail 0
packages/meeting-bot test: tests 40 pass 40 fail 0
apps/api test:        tests 18 pass 18  fail 0
$ echo $?
0
```
Total 202/202, matches manifest claim exactly.

### Docker build (fresh, my own tag)
```
$ docker build -f apps/api/Dockerfile -t lkb-api:checker-verify .
...
#23 naming to docker.io/library/lkb-api:checker-verify done
#23 DONE 0.2s
```
Exit 0.

### Docker run (my own container, port 3401)
```
$ docker run -d --name lkb-checker-verify -p 3401:3000 -e MONGO_URL="mongodb://13.202.206.101:27017" -e MONGO_DB=lkb -e GEMINI_API_KEY="AIzaSy...(redacted)" lkb-api:checker-verify
$ docker logs lkb-checker-verify
@lkb/api listening on :3000
$ curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3401/compete
200
```

### Seed script (fresh run, this session)
```
$ node scripts/seed-demo-server.mjs
loaded 23 sessions, 23 session_pages for tenant "toc"
wrote tree_index root "tenant:toc" (1 year node(s))
API key (save this, shown once): demo_05eedf0ead18d6c7aeafe8d907e8397801fa183d6fa634b0
tenantId: toc
```

### Live /ask against my own container (JSON-fence bug live-fire)
```
$ curl -X POST http://localhost:3401/ask -H "content-type: application/json" \
  -H "authorization: Bearer demo_05eedf0ead18d6c7aeafe8d907e8397801fa183d6fa634b0" \
  -d '{"query":"What did students learn about New Zealand post-study work visas?"}'

verdict: "correct"
insufficient_coverage: false
scored: [1 item] — node_id "toc/year:2026/month:07/session:2026-07-30-in-focus-3", score 1
answer: "Students learned that New Zealand offers a guaranteed 3-year post-study work visa for
Bachelor's or Master's graduates, which does not require employer sponsorship."
```
Confirms the JSON-fence fix is real, not a manifest-only claim.

### Non-goals check
```
$ ls apps/
api/
```
No `apps/web` — Phase-3 production web app honestly not built, as disclosed.

### .dockerignore check
Confirmed excludes: node_modules, **/node_modules, .git, .env, **/.env, **/.env.*,
raw/TOC/TOC-Materials/Audio, raw/TOC/TOC-Materials/Recordings.

### Cleanup
```
$ docker rm -f lkb-checker-verify
lkb-checker-verify
$ docker rmi lkb-api:checker-verify
Untagged / Deleted.
```
Did not touch `lkb-api-demo` or the maker's dev server.
