import { assert, describe, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { CommitComparison, CommitSummary, GitHubCommit } from "../../effected/github/GitHubCommit.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";
import { harness } from "./harness.ts";

const summary = CommitSummary.make({ sha: "c", message: "", author: "Unknown", url: "u", parents: [] });
const comparison = CommitComparison.make({ status: "identical", aheadBy: 0, behindBy: 0, commits: [], files: [] });
const raw = (extra: Record<string, unknown> = {}) => ({
  sha: "c", html_url: "u", commit: { message: "" }, parents: [], ...extra,
});

for (const [name, invalid] of [
  ["message", raw({ commit: { message: 42 } })],
  ["login", raw({ author: { login: null } })],
  ["missing commit", { sha: "c", html_url: "u", parents: [] }],
  ["null commit", raw({ commit: null })],
  ["parent sha", raw({ parents: [{ sha: null }] })],
] as const) {
  const { base } = harness([
    { status: 200, body: invalid },
    { status: 200, body: [raw(), invalid] },
    { status: 200, body: { status: "ahead", ahead_by: 1, behind_by: 0, commits: [raw(), invalid] } },
  ]);
  it.layer(GitHubCommit.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect(`returns typed get/list/compare decode failures for invalid ${name}`, () => Effect.gen(function* () {
      const service = yield* GitHubCommit;
      assertFailure(Result.mapError(yield* Effect.result(service.get("c")), (error) => ({
        tag: error._tag, kind: error.kind, operation: error.operation,
      })), { tag: "GitHubError", kind: "decode", operation: "GitHubCommit.get" });
      assertFailure(Result.mapError(yield* Effect.result(service.list()), (error) => ({
        tag: error._tag, kind: error.kind, operation: error.operation,
      })), { tag: "GitHubError", kind: "decode", operation: "GitHubCommit.list" });
      assertFailure(Result.mapError(yield* Effect.result(service.compare("a", "b")), (error) => ({
        tag: error._tag, kind: error.kind, operation: error.operation,
      })), { tag: "GitHubError", kind: "decode", operation: "GitHubCommit.compare" });
    }));
  });
}

for (const [field, value] of [
  ["status", "unknown"],
  ["ahead_by", 1.5],
  ["behind_by", 1.5],
  ["commits", null],
  ["files", [null]],
] as const) {
  const { base } = harness([{ status: 200, body: {
    status: "identical", ahead_by: 0, behind_by: 0, commits: [], [field]: value,
  } }]);
  it.layer(GitHubCommit.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect(`returns a typed comparison decode failure for invalid ${field}`, () => Effect.gen(function* () {
      const service = yield* GitHubCommit;
      assertFailure(Result.mapError(yield* Effect.result(service.compare("a", "b")), (error) => ({
        tag: error._tag, kind: error.kind, operation: error.operation,
      })), { tag: "GitHubError", kind: "decode", operation: "GitHubCommit.compare" });
    }));
  });
}

describe("GitHubCommit coverage", () => {
  for (const { name, message, subject } of [
    { name: "empty", message: "", subject: "" },
    { name: "without a newline", message: "  subject  ", subject: "  subject  " },
    { name: "multiline", message: "subject\n\nbody\nmore body", subject: "subject" },
    { name: "with a long body", message: `subject\n${Str.repeat(200_000)("body\n")}`, subject: "subject" },
  ]) {
    it.effect(`extracts the first line of a message ${name}`, () => Effect.sync(() => {
      const commit = CommitSummary.make({ sha: "c", message, author: "Unknown", url: "u", parents: [] });
      assert.strictEqual(commit.subject, subject);
      assert.strictEqual(commit.message, message);
    }));
  }

  it.effect("unstubbed members name the missing override", () => Effect.sync(() => {
    const commits = GitHubCommit.makeTest();
    assert.throws(() => commits.get("c"), /get\(\) was called but not stubbed/);
    assert.throws(() => commits.list(), /list\(\) was called but not stubbed/);
    assert.throws(() => commits.compare("a", "b"), /compare\(\) was called but not stubbed/);
    assert.throws(() => commits.changedFiles("c"), /changedFiles\(\) was called but not stubbed/);
    assert.strictEqual(summary.subject, "");
  }));

  it.layer(Layer.merge(GitHubCommit.layerTest({
    get: () => Effect.succeed(summary), list: () => Effect.succeed([summary]),
    compare: () => Effect.succeed(comparison), changedFiles: () => Effect.succeed([]),
  }), Repo.layer(RepoRef.make({ owner: "o", repo: "r" }))), { timeout: "30 seconds" })((it) => {
  it.effect("test layer preserves every override", () => Effect.gen(function* () {
    const commits = yield* GitHubCommit;
    assert.strictEqual(yield* commits.get("c"), summary);
    assert.deepStrictEqual(yield* commits.list(), [summary]);
    assert.strictEqual(yield* commits.compare("a", "b"), comparison);
    assert.deepStrictEqual(yield* commits.changedFiles("c"), []);
  }));
  });

  it.layer(Layer.merge(GitHubCommit.layerTest(), Repo.layer(RepoRef.make({ owner: "o", repo: "r" }))), { timeout: "30 seconds" })((it) => {
  it.effect("default test layer leaves reads unstubbed", () => Effect.gen(function* () {
    const commits = yield* GitHubCommit;
    assert.throws(() => commits.list(), /list/);
  }));
  });

  const { script, base } = harness([
    { status: 200, body: [raw(), raw({ author: null, commit: { message: "subject\nbody", author: { name: null } } })] },
    { status: 200, body: [raw({ author: { login: "ada" }, commit: { message: "s", author: { name: "Ada" } } })] },
    { status: 200, body: [raw()] },
    { status: 200, body: { status: "identical", ahead_by: 0, behind_by: 0, commits: [raw()] } },
    { status: 200, body: raw() },
    { status: 200, body: raw({ files: [{ filename: "a", status: "modified", additions: 1, deletions: 0 }] }) },
    { status: 200, body: raw({ files: [] }) },
  ]);
  it.layer(GitHubCommit.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("lists optional filters, defaults absent author data, and ends absent file pages", () => Effect.gen(function* () {
      const commits = yield* GitHubCommit;
      const listed = yield* commits.list();
      assert.strictEqual(listed.length, 2);
      assert.strictEqual(listed[0]?.author, "Unknown");
      assert.strictEqual(listed[1]?.subject, "subject");
      assert.strictEqual(listed[1]?.authorLogin, undefined);
      const filtered = yield* commits.list({ ref: "topic", path: "src", page: { perPage: 2, maxPages: 1 } });
      assert.strictEqual(filtered[0]?.author, "Ada");
      assert.strictEqual(script.queryOf(1).get("sha"), "topic");
      assert.strictEqual(script.queryOf(1).get("path"), "src");
      assert.strictEqual(script.queryOf(1).get("per_page"), "2");
      assert.strictEqual((yield* commits.list({})).length, 1);
      const compared = yield* commits.compare("a", "b");
      assert.deepStrictEqual(compared.files, []);
      assert.strictEqual(compared.commits[0]?.author, "Unknown");
      assert.deepStrictEqual(yield* commits.changedFiles("c"), []);
      const files = yield* commits.changedFiles("c", { page: { perPage: 1 } });
      assert.strictEqual(files[0]?.path, "a");
      assert.strictEqual(script.queryOf(5).get("page"), "1");
      assert.strictEqual(script.queryOf(6).get("page"), "2");
    }));
  });
});
