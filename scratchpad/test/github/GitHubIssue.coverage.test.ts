import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { GitHubIssue, IssueInfo, LinkedIssue, CommentOnceResult } from "../../effected/github/GitHubIssue.ts";
import { CommentMarker, CommentRecord } from "../../effected/github/PullRequestComment.ts";
import { PageOptions } from "../../effected/github/Rest.ts";
import { Repo } from "../../effected/github/Repo.ts";
import { REPO, harness } from "./harness.ts";

const marker = CommentMarker.make({ namespace: "test", key: "coverage" });
const issue = IssueInfo.make({ number: 1, title: "Bug", state: "open", labels: [], url: "web", nodeId: "node" });
const linked = LinkedIssue.make({ number: 1, title: "Bug", state: "OPEN", url: "web", nodeId: "node", userLinked: false });
const comment = CommentRecord.make({ id: 2, body: "", url: "web" });
const once = CommentOnceResult.make({ wrote: true, comment });

describe("GitHubIssue coverage", () => {
  it.layer(Layer.mergeAll(GitHubIssue.layerTest(), Repo.layer(REPO)), { timeout: "30 seconds" })((it) => {
  it.effect("every missing test-double member names itself and every override is honored", () => Effect.gen(function* () {
    const service = GitHubIssue.makeTest();
    const calls = [["get", () => service.get(1)], ["list", () => service.list()], ["close", () => service.close(1)], ["comment", () => service.comment(1, "text")], ["commentOnce", () => service.commentOnce(1, marker, "text")], ["linkedIssues", () => service.linkedIssues(1)], ["isCrossReferencedBy", () => service.isCrossReferencedBy(1, 2)]] as const;
    for (const [name, call] of calls) assert.throws(call, `GitHubIssue.makeTest: ${name}() was called but not stubbed`);
    const stub = GitHubIssue.makeTest({ get: () => Effect.succeed(issue), list: () => Effect.succeed([issue]), close: () => Effect.void, comment: () => Effect.succeed(2), commentOnce: () => Effect.succeed(once), linkedIssues: () => Effect.succeed([linked]), isCrossReferencedBy: () => Effect.succeed(false) });
    assert.deepStrictEqual(yield* stub.get(1), issue);
    assert.deepStrictEqual(yield* stub.list(), [issue]);
    assert.strictEqual(yield* stub.close(1), undefined);
    assert.strictEqual(yield* stub.comment(1, "text"), 2);
    assert.deepStrictEqual(yield* stub.commentOnce(1, marker, "text"), once);
    assert.deepStrictEqual(yield* stub.linkedIssues(1), [linked]);
    assert.strictEqual(yield* stub.isCrossReferencedBy(1, 2), false);
    const defaults = yield* GitHubIssue;
    assert.throws(() => defaults.get(1), "GitHubIssue.makeTest: get()");
  }));
  });

  const raw = { number: 1, title: "Bug", state: "closed", labels: ["bug", { name: "help" }, {}], html_url: "web", node_id: "node" };
  const { base, script } = harness([
    { status: 200, body: raw }, { status: 200, body: [{ ...raw, state: "unexpected" }] }, { status: 200, body: [raw] },
    { status: 200, body: [{ id: 2, body: null, html_url: "web" }] }, { status: 201, body: { id: 2, body: null, html_url: "web" } },
    { status: 200, body: { data: { repository: { issue: { timelineItems: { nodes: [{}, { source: {} }, { source: { __typename: "Issue", number: 2 } }, { source: { __typename: "PullRequest", number: 3 } }] } } } } } },
  ]);
  it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("normalizes issue state and labels, forwards list filters, and treats empty comments and other references as absent", () => Effect.gen(function* () {
      const service = yield* GitHubIssue;
      const got = yield* service.get(1);
      assert.strictEqual(got.state, "closed"); assert.deepStrictEqual(got.labels, ["bug", "help"]);
      assert.deepStrictEqual(yield* service.list(), [IssueInfo.make({ ...got, state: "open" })]);
      assert.deepStrictEqual(yield* service.list({ state: "all", labels: ["bug", "help"], page: PageOptions.make({ perPage: 5, maxPages: 1 }) }), [got]);
      assert.strictEqual(script.queryOf(2).get("labels"), "bug,help");
      assert.strictEqual(script.queryOf(2).get("state"), "all");
      assert.strictEqual(script.queryOf(2).get("per_page"), "5");
      assert.deepStrictEqual(yield* service.commentOnce(1, marker, "text"), once);
      assert.strictEqual(yield* service.isCrossReferencedBy(1, 2), false);
    }));
  });
});
