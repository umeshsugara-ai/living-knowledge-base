/**
 * packages/meeting-bot/src/profile/user-profile.test.ts — T-011 C3 (profile half).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { resolveProfileDir } from "./user-profile.js";

const BASE = "D:\\vault\\profiles";

test("distinct users get distinct directories", () => {
  const a = resolveProfileDir("toc", "alice", BASE);
  const b = resolveProfileDir("toc", "bob", BASE);
  assert.notEqual(a, b);
});

test("the same (tenantId, userId) always resolves identically", () => {
  const first = resolveProfileDir("toc", "alice", BASE);
  const second = resolveProfileDir("toc", "alice", BASE);
  assert.equal(first, second);
  assert.equal(first, join(BASE, "toc", "alice"));
});

test("different tenants with the same userId still get distinct directories", () => {
  const a = resolveProfileDir("toc", "alice", BASE);
  const b = resolveProfileDir("guidingteens", "alice", BASE);
  assert.notEqual(a, b);
});

test("a userId containing path-traversal segments throws, never escapes baseDir", () => {
  assert.throws(() => resolveProfileDir("toc", "../../etc", BASE), /not a safe path segment/);
  assert.throws(() => resolveProfileDir("toc", "..", BASE), /not a safe path segment/);
});

test("a tenantId containing a path separator throws", () => {
  assert.throws(() => resolveProfileDir("toc/../other", "alice", BASE), /not a safe path segment/);
});

test("an absolute-path userId throws", () => {
  assert.throws(() => resolveProfileDir("toc", "C:\\Windows\\System32", BASE), /not a safe path segment/);
});

test("an empty tenantId or userId throws", () => {
  assert.throws(() => resolveProfileDir("", "alice", BASE), /must not be empty/);
  assert.throws(() => resolveProfileDir("toc", "", BASE), /must not be empty/);
});
