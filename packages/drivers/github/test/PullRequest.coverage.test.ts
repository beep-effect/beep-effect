import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { PullRequest, PullRequestInfo, UpsertedPullRequest } from "@beep/github/PullRequest";
import { Repo } from "@beep/github/Repo";
import { PageOptions } from "@beep/github/Rest";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { harness, REPO } from "./support/harness.ts";

const info = PullRequestInfo.make({
  number: 7,
  nodeId: "PR_7",
  url: "web",
  title: "Fix",
  state: "open",
  head: "fix",
  headSha: "abc",
  base: "main",
  baseSha: "def",
  draft: false,
  merged: false,
  mergedAt: O.none(),
});
const raw = {
  number: 7,
  node_id: "PR_7",
  html_url: "web",
  title: "Fix",
  state: "open",
  head: { ref: "fix", sha: "abc" },
  base: { ref: "main", sha: "def" },
};
const input = { title: "Fix", head: "fix", base: "main" };
const JsonObject = S.fromJsonString(S.Record(S.String, S.Unknown));
const page = PageOptions.make({ perPage: 3, maxPages: 1 });

describe("PullRequest coverage", () => {
  it.layer(Layer.mergeAll(PullRequest.layerTest(), Repo.layer(REPO)), { timeout: "30 seconds" })((it) => {
    it.effect("unstubbed members name themselves and every override is retained", () =>
      Effect.gen(function* () {
        const service = PullRequest.makeTest();
        const calls = [
          ["get", () => service.get(7)],
          ["list", () => service.list()],
          ["listFiles", () => service.listFiles(7)],
          ["listAssociatedWithCommit", () => service.listAssociatedWithCommit("abc")],
          ["create", () => service.create(input)],
          ["update", () => service.update(7, {})],
          ["upsert", () => service.upsert(input)],
          ["merge", () => service.merge(7)],
          ["addLabels", () => service.addLabels(7, [])],
          ["requestReviewers", () => service.requestReviewers(7, {})],
          ["setAutoMerge", () => service.setAutoMerge(info, "off")],
        ] as const;
        for (const [name, call] of calls)
          assert.throws(call, `PullRequest.makeTest: ${name}() was called but not stubbed`);
        const defaults = yield* PullRequest;
        assert.throws(() => defaults.get(7), "PullRequest.makeTest: get()");
        const stub = PullRequest.makeTest({
          get: () => Effect.succeed(info),
          list: () => Effect.succeed([info]),
          listFiles: dual(
            (args) => P.isNumber(args[0]),
            (_number: number, _options?: object) => Effect.succeed([])
          ),
          listAssociatedWithCommit: dual(
            (args) => P.isString(args[0]),
            (_sha: string, _options?: object) => Effect.succeed([info])
          ),
          create: () => Effect.succeed(info),
          update: dual(2, (_number: number, _patch: object) => Effect.succeed(info)),
          upsert: () => Effect.succeed(UpsertedPullRequest.make({ pullRequest: info, created: true })),
          merge: dual(
            (args) => P.isNumber(args[0]),
            (_number: number, _options?: object) => Effect.succeed("sha")
          ),
          addLabels: dual(2, (_number: number, _labels: ReadonlyArray<string>) => Effect.void),
          requestReviewers: dual(2, (_number: number, _reviewers: object) => Effect.void),
          setAutoMerge: dual(2, (_pullRequest: PullRequestInfo, _method: string) => Effect.void),
        });
        const got = yield* stub.get(7);
        assert.deepStrictEqual(got, info);
        const list1 = yield* stub.list();
        assert.deepStrictEqual(list1, [info]);
        const listFiles2 = yield* stub.listFiles(7);
        assert.deepStrictEqual(listFiles2, []);
        const listAssociatedWithCommit3 = yield* stub.listAssociatedWithCommit("abc");
        assert.deepStrictEqual(listAssociatedWithCommit3, [info]);
        const created4 = yield* stub.create(input);
        assert.deepStrictEqual(created4, info);
        const update5 = yield* stub.update(7, {});
        assert.deepStrictEqual(update5, info);
        const upsert6 = yield* stub.upsert(input);
        assert.deepStrictEqual(upsert6, UpsertedPullRequest.make({ pullRequest: info, created: true }));
        const merge7 = yield* stub.merge(7);
        assert.strictEqual(merge7, "sha");
        const addLabels8 = yield* stub.addLabels(7, []);
        assert.strictEqual(addLabels8, undefined);
        const requestReviewers9 = yield* stub.requestReviewers(7, {});
        assert.strictEqual(requestReviewers9, undefined);
        const setAutoMerge10 = yield* stub.setAutoMerge(info, "off");
        assert.strictEqual(setAutoMerge10, undefined);
      })
    );
  });
  it.layer(
    Layer.mergeAll(
      PullRequest.layerTest({
        merge: dual(
          (args) => P.isNumber(args[0]),
          (_number: number, _options?: object) => Effect.succeed("layer-sha")
        ),
      }),
      Repo.layer(REPO)
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("layerTest forwards supplied overrides", () =>
      Effect.gen(function* () {
        const merge11 = yield* (yield* PullRequest).merge(7);
        assert.strictEqual(merge11, "layer-sha");
      })
    );
  });

  const { base, script } = harness([
    { status: 200, body: raw },
    {
      status: 200,
      body: {
        ...raw,
        state: "closed",
        draft: true,
        merged: false,
        merged_at: "2024-01-02T00:00:00Z",
        body: "",
        merge_commit_sha: "merge-sha",
      },
    },
    { status: 200, body: { ...raw, merged_at: "2024-01-02T00:00:00Z" } },
    { status: 200, body: { ...raw, merged_at: "invalid" } },
    { status: 200, body: [raw] },
    { status: 200, body: [raw] },
    { status: 200, body: [raw] },
    { status: 200, body: [{ filename: "a.ts", status: "modified", additions: 1, deletions: 2, changes: 3 }] },
    { status: 200, body: [] },
    { status: 200, body: [raw] },
    { status: 200, body: [] },
    { status: 201, body: raw },
    { status: 201, body: raw },
    { status: 200, body: raw },
    { status: 200, body: raw },
    { status: 200, body: [] },
    { status: 201, body: raw },
    { status: 200, body: [raw] },
    { status: 200, body: raw },
    { status: 200, body: { sha: "merged-sha", merged: true, message: "merged" } },
    { status: 200, body: { sha: "merged-sha", merged: true, message: "merged" } },
    { status: 200, body: [] },
    { status: 201, body: raw },
    { status: 201, body: raw },
    { status: 200, body: { data: {} } },
    { status: 200, body: { data: {} } },
  ]);
  // An empty or missing request body reads as `{}`.
  const sentBody = (index: number) => S.decodeEffect(JsonObject)(script.calls[index]?.body || "{}");
  it.layer(PullRequest.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("projects REST responses and sends only present parameters", () =>
      Effect.gen(function* () {
        const service = yield* PullRequest;
        const got12 = yield* service.get(7);
        assert.deepStrictEqual(got12, info);
        const closed = yield* service.get(7);
        assert.strictEqual(closed.state, "closed");
        assert.strictEqual(closed.draft, true);
        assert.strictEqual(closed.merged, false);
        assert.strictEqual(closed.body, "");
        assert.strictEqual(closed.mergeCommitSha, "merge-sha");
        assertSome(closed.mergedAt, DateTime.makeUnsafe("2024-01-02T00:00:00Z"));
        assert.strictEqual((yield* service.get(7)).merged, true);
        const result13 = yield* Effect.result(service.get(7));
        assertFailure(
          Result.mapError(result13, (error) => error.kind),
          "decode"
        );
        const list14 = yield* service.list();
        assert.deepStrictEqual(list14, [info]);
        assert.strictEqual(script.queryOf(4).has("head"), false);
        assert.strictEqual(script.queryOf(4).has("base"), false);
        assert.strictEqual(script.queryOf(4).has("state"), false);
        const list15 = yield* service.list({ head: "fix", base: "main", state: "closed", page });
        assert.deepStrictEqual(list15, [info]);
        assert.strictEqual(script.queryOf(5).get("head"), "acme:fix");
        assert.strictEqual(script.queryOf(5).get("base"), "main");
        assert.strictEqual(script.queryOf(5).get("state"), "closed");
        assert.strictEqual(script.queryOf(5).get("per_page"), "3");
        yield* service.list({ head: "fork:fix" });
        assert.strictEqual(script.queryOf(6).get("head"), "fork:fix");
        const files = yield* service.listFiles(7);
        assert.strictEqual(files[0]?.path, "a.ts");
        const listFiles16 = yield* service.listFiles(7, { page });
        assert.deepStrictEqual(listFiles16, []);
        assert.strictEqual(script.queryOf(8).get("per_page"), "3");
        const listAssociatedWithCommit17 = yield* service.listAssociatedWithCommit("abc");
        assert.deepStrictEqual(listAssociatedWithCommit17, [info]);
        const listAssociatedWithCommit18 = yield* service.listAssociatedWithCommit("abc", { page });
        assert.deepStrictEqual(listAssociatedWithCommit18, []);
        assert.strictEqual(script.queryOf(10).get("per_page"), "3");
        const created19 = yield* service.create(input);
        assert.deepStrictEqual(created19, info);
        const sentBody20 = yield* sentBody(11);
        assert.deepStrictEqual(sentBody20, input);
        const created21 = yield* service.create({ ...input, body: "", draft: false });
        assert.deepStrictEqual(created21, info);
        const sentBody22 = yield* sentBody(12);
        assert.deepStrictEqual(sentBody22, {
          title: "Fix",
          head: "fix",
          base: "main",
          body: "",
          draft: false,
        });
        yield* service.update(7, {});
        const sentBody23 = yield* sentBody(13);
        assert.deepStrictEqual(sentBody23, {});
        yield* service.update(7, { title: "New", body: "", state: "closed", base: "next" });
        const sentBody24 = yield* sentBody(14);
        assert.deepStrictEqual(sentBody24, {
          title: "New",
          body: "",
          state: "closed",
          base: "next",
        });
        const upsert25 = yield* service.upsert(input);
        assert.deepStrictEqual(upsert25, UpsertedPullRequest.make({ pullRequest: info, created: true }));
        const upsert26 = yield* service.upsert({ ...input, body: "Notes", draft: true });
        assert.deepStrictEqual(upsert26, UpsertedPullRequest.make({ pullRequest: info, created: false }));
        const sentBody27 = yield* sentBody(18);
        assert.deepStrictEqual(sentBody27, {
          title: "Fix",
          body: "Notes",
        });
        const merge28 = yield* service.merge(7);
        assert.strictEqual(merge28, "merged-sha");
        const sentBody29 = yield* sentBody(19);
        assert.deepStrictEqual(sentBody29, {});
        const merge30 = yield* service.merge(7, { method: "squash", commitTitle: "Title", commitMessage: "Message" });
        assert.strictEqual(merge30, "merged-sha");
        const sentBody31 = yield* sentBody(20);
        assert.deepStrictEqual(sentBody31, {
          merge_method: "squash",
          commit_title: "Title",
          commit_message: "Message",
        });
        yield* service.addLabels(7, ["bug"]);
        const sentBody32 = yield* sentBody(21);
        assert.deepStrictEqual(sentBody32, { labels: ["bug"] });
        yield* service.requestReviewers(7, {});
        const sentBody33 = yield* sentBody(22);
        assert.deepStrictEqual(sentBody33, {});
        yield* service.requestReviewers(7, { users: ["alice"], teams: ["core"] });
        const sentBody34 = yield* sentBody(23);
        assert.deepStrictEqual(sentBody34, {
          reviewers: ["alice"],
          team_reviewers: ["core"],
        });
        yield* service.setAutoMerge(info, "off");
        const disabled = yield* sentBody(24);
        assert.deepStrictEqual(disabled.variables, { pullRequestId: "PR_7" });
        assert.match(String(disabled.query), /disablePullRequestAutoMerge/);
        yield* service.setAutoMerge(info, "rebase");
        const mutation = yield* sentBody(25);
        assert.deepStrictEqual(mutation.variables, { pullRequestId: "PR_7", mergeMethod: "REBASE" });
        assertNone(info.mergedAt);
      })
    );
  });
});

it.effect.prop(
  "UpsertedPullRequest preserves every encoded value",
  [Arbitrary.schema(UpsertedPullRequest)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(UpsertedPullRequest)(value);
      const decoded = yield* S.decodeEffect(UpsertedPullRequest)(encoded);
      assert.isTrue(S.toEquivalence(UpsertedPullRequest)(decoded, value));
      const value35 = yield* S.encodeEffect(UpsertedPullRequest)(decoded);
      assert.deepStrictEqual(value35, encoded);
    }),
  { arbitrary: fcRuns(100) }
);
