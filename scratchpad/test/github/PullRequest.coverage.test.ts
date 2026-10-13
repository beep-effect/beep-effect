import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSome } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { PullRequest, PullRequestInfo } from "../../effected/github/PullRequest.ts";
import { Repo } from "../../effected/github/Repo.ts";
import { PageOptions } from "../../effected/github/Rest.ts";
import { harness, REPO } from "./harness.ts";

const info = PullRequestInfo.make({ number: 7, nodeId: "PR_7", url: "web", title: "Fix", state: "open", head: "fix", headSha: "abc", base: "main", baseSha: "def", draft: false, merged: false, mergedAt: O.none() });
const raw = { number: 7, node_id: "PR_7", html_url: "web", title: "Fix", state: "open", head: { ref: "fix", sha: "abc" }, base: { ref: "main", sha: "def" } };
const input = { title: "Fix", head: "fix", base: "main" };
const JsonObject = S.fromJsonString(S.Record(S.String, S.Unknown));
const page = PageOptions.make({ perPage: 3, maxPages: 1 });

describe("PullRequest coverage", () => {
  it.layer(Layer.mergeAll(PullRequest.layerTest(), Repo.layer(REPO)), { timeout: "30 seconds" })((it) => {
    it.effect("unstubbed members name themselves and every override is retained", () => Effect.gen(function* () {
      const service = PullRequest.makeTest();
      const calls = [
        ["get", () => service.get(7)], ["list", () => service.list()],
        ["listFiles", () => service.listFiles(7)], ["listAssociatedWithCommit", () => service.listAssociatedWithCommit("abc")],
        ["create", () => service.create(input)], ["update", () => service.update(7, {})],
        ["upsert", () => service.upsert(input)], ["merge", () => service.merge(7)],
        ["addLabels", () => service.addLabels(7, [])], ["requestReviewers", () => service.requestReviewers(7, {})],
        ["setAutoMerge", () => service.setAutoMerge(info, "off")],
      ] as const;
      for (const [name, call] of calls) assert.throws(call, `PullRequest.makeTest: ${name}() was called but not stubbed`);
      const defaults = yield* PullRequest;
      assert.throws(() => defaults.get(7), "PullRequest.makeTest: get()");
      const stub = PullRequest.makeTest({ get: () => Effect.succeed(info), list: () => Effect.succeed([info]), listFiles: () => Effect.succeed([]), listAssociatedWithCommit: () => Effect.succeed([info]), create: () => Effect.succeed(info), update: () => Effect.succeed(info), upsert: () => Effect.succeed({ pullRequest: info, created: true }), merge: () => Effect.succeed("sha"), addLabels: () => Effect.void, requestReviewers: () => Effect.void, setAutoMerge: () => Effect.void });
      assert.deepStrictEqual(yield* stub.get(7), info);
      assert.deepStrictEqual(yield* stub.list(), [info]);
      assert.deepStrictEqual(yield* stub.listFiles(7), []);
      assert.deepStrictEqual(yield* stub.listAssociatedWithCommit("abc"), [info]);
      assert.deepStrictEqual(yield* stub.create(input), info);
      assert.deepStrictEqual(yield* stub.update(7, {}), info);
      assert.deepStrictEqual(yield* stub.upsert(input), { pullRequest: info, created: true });
      assert.strictEqual(yield* stub.merge(7), "sha");
      assert.strictEqual(yield* stub.addLabels(7, []), undefined);
      assert.strictEqual(yield* stub.requestReviewers(7, {}), undefined);
      assert.strictEqual(yield* stub.setAutoMerge(info, "off"), undefined);
    }));
  });
  it.layer(Layer.mergeAll(PullRequest.layerTest({ merge: () => Effect.succeed("layer-sha") }), Repo.layer(REPO)), { timeout: "30 seconds" })((it) => {
    it.effect("layerTest forwards supplied overrides", () => Effect.gen(function* () {
      assert.strictEqual(yield* (yield* PullRequest).merge(7), "layer-sha");
    }));
  });

  const { base, script } = harness([
    { status: 200, body: raw },
    { status: 200, body: { ...raw, state: "closed", draft: true, merged: false, merged_at: "2024-01-02T00:00:00Z", body: "", merge_commit_sha: "merge-sha" } },
    { status: 200, body: { ...raw, merged_at: "2024-01-02T00:00:00Z" } },
    { status: 200, body: { ...raw, merged_at: "invalid" } },
    { status: 200, body: [raw] }, { status: 200, body: [raw] }, { status: 200, body: [raw] },
    { status: 200, body: [{ filename: "a.ts", status: "modified", additions: 1, deletions: 2, changes: 3 }] },
    { status: 200, body: [] }, { status: 200, body: [raw] }, { status: 200, body: [] },
    { status: 201, body: raw }, { status: 201, body: raw },
    { status: 200, body: raw }, { status: 200, body: raw },
    { status: 200, body: [] }, { status: 201, body: raw },
    { status: 200, body: [raw] }, { status: 200, body: raw },
    { status: 200, body: { sha: "merged-sha", merged: true, message: "merged" } },
    { status: 200, body: { sha: "merged-sha", merged: true, message: "merged" } },
    { status: 200, body: [] }, { status: 201, body: raw }, { status: 201, body: raw },
    { status: 200, body: { data: {} } }, { status: 200, body: { data: {} } },
  ]);
  it.layer(PullRequest.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("projects REST responses and sends only present parameters", () => Effect.gen(function* () {
      const service = yield* PullRequest;
      assert.deepStrictEqual(yield* service.get(7), info);
      const closed = yield* service.get(7);
      assert.strictEqual(closed.state, "closed"); assert.strictEqual(closed.draft, true);
      assert.strictEqual(closed.merged, false); assert.strictEqual(closed.body, ""); assert.strictEqual(closed.mergeCommitSha, "merge-sha");
      assertSome(closed.mergedAt, DateTime.makeUnsafe("2024-01-02T00:00:00Z"));
      assert.strictEqual((yield* service.get(7)).merged, true);
      assertFailure(Result.mapError(yield* Effect.result(service.get(7)), (error) => error.kind), "decode");
      assert.deepStrictEqual(yield* service.list(), [info]);
      assert.strictEqual(script.queryOf(4).has("head"), false);
      assert.strictEqual(script.queryOf(4).has("base"), false);
      assert.strictEqual(script.queryOf(4).has("state"), false);
      assert.deepStrictEqual(yield* service.list({ head: "fix", base: "main", state: "closed", page }), [info]);
      assert.strictEqual(script.queryOf(5).get("head"), "acme:fix");
      assert.strictEqual(script.queryOf(5).get("base"), "main");
      assert.strictEqual(script.queryOf(5).get("state"), "closed");
      assert.strictEqual(script.queryOf(5).get("per_page"), "3");
      yield* service.list({ head: "fork:fix" });
      assert.strictEqual(script.queryOf(6).get("head"), "fork:fix");
      const files = yield* service.listFiles(7);
      assert.strictEqual(files[0]?.path, "a.ts");
      assert.deepStrictEqual(yield* service.listFiles(7, { page }), []);
      assert.strictEqual(script.queryOf(8).get("per_page"), "3");
      assert.deepStrictEqual(yield* service.listAssociatedWithCommit("abc"), [info]);
      assert.deepStrictEqual(yield* service.listAssociatedWithCommit("abc", { page }), []);
      assert.strictEqual(script.queryOf(10).get("per_page"), "3");
      assert.deepStrictEqual(yield* service.create(input), info);
      assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[11]?.body ?? "{}"), input);
      assert.deepStrictEqual(yield* service.create({ ...input, body: "", draft: false }), info);
      assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[12]?.body ?? "{}"), { title: "Fix", head: "fix", base: "main", body: "", draft: false });
      yield* service.update(7, {});
      assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[13]?.body || "{}"), {});
      yield* service.update(7, { title: "New", body: "", state: "closed", base: "next" });
      assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[14]?.body ?? "{}"), { title: "New", body: "", state: "closed", base: "next" });
      assert.deepStrictEqual(yield* service.upsert(input), { pullRequest: info, created: true });
      assert.deepStrictEqual(yield* service.upsert({ ...input, body: "Notes", draft: true }), { pullRequest: info, created: false });
      assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[18]?.body ?? "{}"), { title: "Fix", body: "Notes" });
      assert.strictEqual(yield* service.merge(7), "merged-sha");
      assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[19]?.body || "{}"), {});
      assert.strictEqual(yield* service.merge(7, { method: "squash", commitTitle: "Title", commitMessage: "Message" }), "merged-sha");
      assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[20]?.body ?? "{}"), { merge_method: "squash", commit_title: "Title", commit_message: "Message" });
      yield* service.addLabels(7, ["bug"]);
      assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[21]?.body ?? "{}"), { labels: ["bug"] });
      yield* service.requestReviewers(7, {});
      assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[22]?.body || "{}"), {});
      yield* service.requestReviewers(7, { users: ["alice"], teams: ["core"] });
      assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[23]?.body ?? "{}"), { reviewers: ["alice"], team_reviewers: ["core"] });
      yield* service.setAutoMerge(info, "off");
      const disabled = yield* S.decodeEffect(JsonObject)(script.calls[24]?.body ?? "{}");
      assert.deepStrictEqual(disabled.variables, { pullRequestId: "PR_7" });
      assert.match(String(disabled.query), /disablePullRequestAutoMerge/);
      yield* service.setAutoMerge(info, "rebase");
      const mutation = yield* S.decodeEffect(JsonObject)(script.calls[25]?.body ?? "{}");
      assert.deepStrictEqual(mutation.variables, { pullRequestId: "PR_7", mergeMethod: "REBASE" });
      assertNone(info.mergedAt);
    }));
  });
});
