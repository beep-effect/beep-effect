import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { GitHubError } from "../../effected/github/GitHubError.ts";
import { GitHubClient } from "../../effected/github/GitHubClient.ts";
import { GitHubIssue, IssueInfo, LinkedIssue, CommentOnceResult } from "../../effected/github/GitHubIssue.ts";
import { CommentMarker, CommentRecord } from "../../effected/github/PullRequestComment.ts";
import { PageOptions } from "../../effected/github/Rest.ts";
import type * as Rest from "../../effected/github/Rest.ts";
import { Repo } from "../../effected/github/Repo.ts";
import { REPO, harness } from "./harness.ts";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";

const marker = CommentMarker.make({ namespace: "test", key: "coverage" });
const issue = IssueInfo.make({ number: 1, title: "Bug", state: "open", labels: [], url: "web", nodeId: "node" });
const linked = LinkedIssue.make({ number: 1, title: "Bug", state: "OPEN", url: "web", nodeId: "node", userLinked: false });
const comment = CommentRecord.make({ id: 2, body: "", url: "web" });
const once = CommentOnceResult.make({ wrote: true, comment });

describe("GitHubIssue coverage", () => {
  for (const selectedBody of [marker.html, undefined]) {
    const reads: Array<string> = [];
    let selectedReads = 0;
    const metadata = {
      id: 2, node_id: "comment", url: "api", html_url: "web", user: null,
      created_at: "2026-10-09T00:00:00Z", updated_at: "2026-10-09T00:00:00Z", issue_url: "issue",
    };
    const first = deliberatelyInvalid<Rest.Item<"GET /repos/{owner}/{repo}/issues/{issue_number}/comments">>({
      ...metadata,
      get body() {
        reads.push("selected");
        selectedReads += 1;
        return selectedReads === 1 ? marker.html : selectedBody;
      },
    });
    const tail = {
      ...metadata,
      id: 3,
      get body() {
        reads.push("tail");
        return marker.html;
      },
    };
    const base = Layer.mergeAll(Repo.layer(REPO), GitHubClient.layerFixture({
      paginate: { "GET /repos/{owner}/{repo}/issues/{issue_number}/comments": Result.succeed([first, tail]) },
    }));
    it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect(`stops at the first matching comment and rereads its ${selectedBody === undefined ? "absent" : "present"} body`, () => Effect.gen(function* () {
        const service = yield* GitHubIssue;
        const result = yield* service.commentOnce(1, marker, "text");
        assert.deepStrictEqual(result, CommentOnceResult.make({
          wrote: false,
          comment: CommentRecord.make({ id: 2, body: selectedBody ?? "", url: "web" }),
        }));
        assert.deepStrictEqual(reads, ["selected", "selected"]);
      }));
    });
  }

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

describe("GitHubIssue response decoding", () => {
  const raw = { number: 1, title: "Bug", state: "closed", labels: ["bug", { name: "help" }, {}], html_url: "web", node_id: "node" };
  for (const [field, invalid] of [
    ["fractional number", { ...raw, number: 1.5 }],
    ["null label", { ...raw, labels: [null] }],
    ["null label name", { ...raw, labels: [{ name: null }] }],
  ] as const) {
    for (const operation of ["get", "list"] as const) {
      const { base } = harness([{ status: 200, body: operation === "get" ? invalid : [raw, invalid] }]);
      it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
        it.effect(`${operation} reports ${field} in the typed decode channel`, () => Effect.gen(function* () {
          const service = yield* GitHubIssue;
          const exit = yield* Effect.exit(operation === "get" ? Effect.asVoid(service.get(1)) : Effect.asVoid(service.list()));
          assert.strictEqual(Exit.hasFails(exit), true);
          assert.strictEqual(Exit.hasDies(exit), false);
          const error = exit.pipe(Exit.findError, Result.getOrThrow);
          assert.instanceOf(error, GitHubError);
          assert.strictEqual(error.kind, "decode");
          assert.strictEqual(error.operation, `GitHubIssue.${operation}`);
        }));
      });
    }
  }

  for (const [field, invalid] of [
    ["body", { id: 2, body: {}, html_url: "web" }],
    ["fractional id", { id: 2.5, body: marker.html, html_url: "web" }],
    ["URL", { id: 2, body: marker.html, html_url: null }],
  ] as const) {
    for (const phase of ["listed", "created"] as const) {
      const { base, script } = harness(phase === "listed"
        ? [{ status: 200, body: [invalid] }]
        : [{ status: 200, body: [] }, { status: 201, body: invalid }]);
      it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
        it.effect(`commentOnce reports a malformed ${phase} ${field} as a typed decode failure`, () => Effect.gen(function* () {
          const service = yield* GitHubIssue;
          const exit = yield* Effect.exit(service.commentOnce(1, marker, "text"));
          assert.strictEqual(Exit.hasFails(exit), true);
          assert.strictEqual(Exit.hasDies(exit), false);
          const error = exit.pipe(Exit.findError, Result.getOrThrow);
          assert.instanceOf(error, GitHubError);
          assert.strictEqual(error.kind, "decode");
          assert.strictEqual(error.operation, "GitHubIssue.commentOnce");
          assert.strictEqual(script.count(), phase === "listed" ? 1 : 2);
        }));
      });
    }
  }

  const { base, script } = harness([{ status: 200, body: [
    { id: null, body: null, html_url: null },
    { id: 2, body: marker.html, html_url: "web" },
    { id: 3.5, body: {}, html_url: null },
  ] }]);
  it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("decodes only inspected bodies and the first matching record, leaving a malformed tail untouched", () => Effect.gen(function* () {
      const service = yield* GitHubIssue;
      assert.deepStrictEqual(yield* service.commentOnce(1, marker, "text"), CommentOnceResult.make({
        wrote: false, comment: CommentRecord.make({ id: 2, body: marker.html, url: "web" }),
      }));
      assert.strictEqual(script.count(), 1);
    }));
  });

  const ordered = harness([{ status: 200, body: [raw, { ...raw, number: 2, state: "unexpected", labels: [{ name: undefined }, "second", { name: "third" }] }] }]);
  it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(ordered.base)), { timeout: "30 seconds" })((it) => {
    it.effect("effectful list projection preserves issue and label order, omitted names, and state normalization", () => Effect.gen(function* () {
      const service = yield* GitHubIssue;
      assert.deepStrictEqual(yield* service.list(), [
        IssueInfo.make({ number: 1, title: "Bug", state: "closed", labels: ["bug", "help"], url: "web", nodeId: "node" }),
        IssueInfo.make({ number: 2, title: "Bug", state: "open", labels: ["second", "third"], url: "web", nodeId: "node" }),
      ]);
    }));
  });

  let selectedReads = 0;
  const selected = deliberatelyInvalid<Rest.Item<"GET /repos/{owner}/{repo}/issues/{issue_number}/comments">>({
    id: 2, html_url: "web",
    get body() {
      selectedReads += 1;
      return selectedReads === 1 ? marker.html : {};
    },
  });
  const changing = Layer.mergeAll(Repo.layer(REPO), GitHubClient.layerFixture({
    paginate: { "GET /repos/{owner}/{repo}/issues/{issue_number}/comments": Result.succeed([selected]) },
  }));
  it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(changing)), { timeout: "30 seconds" })((it) => {
    it.effect("validates a selected body's second read in the typed channel", () => Effect.gen(function* () {
      const service = yield* GitHubIssue;
      const exit = yield* Effect.exit(service.commentOnce(1, marker, "text"));
      assert.strictEqual(Exit.hasFails(exit), true);
      assert.strictEqual(Exit.hasDies(exit), false);
      const error = exit.pipe(Exit.findError, Result.getOrThrow);
      assert.instanceOf(error, GitHubError);
      assert.strictEqual(error.kind, "decode");
      assert.strictEqual(error.operation, "GitHubIssue.commentOnce");
      assert.strictEqual(selectedReads, 2);
    }));
  });
});

describe("GitHubIssue cross-reference pagination", () => {
  const TimelineRequest = S.fromJsonString(S.Struct({
    query: S.String,
    variables: S.Struct({ before: S.optionalKey(S.String) }),
  }));
  const PreviousTimelineRequest = S.fromJsonString(S.Struct({ variables: S.Struct({ before: S.String }) }));
  for (const matchingPage of [1, 2, 0]) {
    const timeline = (page: number) => ({ data: { repository: { issue: { timelineItems: {
      pageInfo: { hasPreviousPage: page === 1 || page === matchingPage, startCursor: `page-${page}` },
      nodes: A.makeBy(page === 1 ? 50 : 1, () => ({ source: { __typename: "PullRequest", number: page === matchingPage ? 2 : 3 } })),
    } } } } });
    const { base, script } = harness([{ status: 200, body: timeline(1) }, { status: 200, body: timeline(2) }]);
    it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect(`walks previous timeline pages until ${matchingPage === 0 ? "exhaustion" : `a match on page ${matchingPage}`}`, () => Effect.gen(function* () {
        const service = yield* GitHubIssue;
        assert.strictEqual(yield* service.isCrossReferencedBy(1, 2), matchingPage !== 0);
        assert.strictEqual(script.count(), matchingPage === 1 ? 1 : 2);
        const request = yield* S.decodeUnknownEffect(TimelineRequest)(script.calls[0]?.body);
        assert.include(request.query, "itemTypes: CROSS_REFERENCED_EVENT");
        assert.include(request.query, "before: $before");
        assert.include(request.query, "pageInfo { hasPreviousPage startCursor }");
        assert.strictEqual(request.variables.before, undefined);
        if (matchingPage !== 1) {
          const previous = yield* S.decodeUnknownEffect(PreviousTimelineRequest)(script.calls[1]?.body);
          assert.strictEqual(previous.variables.before, "page-1");
        }
      }));
    });
  }

  const { base, script } = harness([{ status: 200, body: { data: { repository: { issue: { timelineItems: {
    pageInfo: { hasPreviousPage: true, startCursor: null }, nodes: [],
  } } } } } }]);
  it.layer(GitHubIssue.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("stops when an empty timeline supplies no previous cursor", () => Effect.gen(function* () {
      const service = yield* GitHubIssue;
      assert.strictEqual(yield* service.isCrossReferencedBy(1, 2), false);
      assert.strictEqual(script.count(), 1);
    }));
  });
});
