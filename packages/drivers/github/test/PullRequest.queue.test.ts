import { MergeQueueEntry, PullRequest, PullRequestInfo } from "@beep/github/PullRequest";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { harness } from "./support/harness.ts";

const info = PullRequestInfo.make({
  number: 3061,
  nodeId: "PR_3061",
  url: "web",
  title: "Lab entry",
  state: "open",
  head: "queue-lab-s1",
  headSha: "d0444bc",
  base: "queue-lab",
  baseSha: "013e749",
  draft: false,
  merged: false,
  mergedAt: O.none(),
});

// Shapes recorded from the merge-queue lab (goals/merge-queue-lab): a fresh
// entry has no group commits yet, a building one has both.
const queuedWire = {
  id: "MQE_1",
  state: "QUEUED",
  position: 1,
  enqueuedAt: "2026-11-10T04:54:37Z",
  estimatedTimeToMerge: null,
  jump: false,
  solo: false,
  enqueuer: { login: "beep-fleet-orchestrator" },
  headCommit: null,
  baseCommit: null,
};
const buildingWire = {
  ...queuedWire,
  state: "AWAITING_CHECKS",
  estimatedTimeToMerge: 42,
  headCommit: { oid: "01ad0c0" },
  baseCommit: { oid: "013e749" },
};

const queued = MergeQueueEntry.make({
  id: "MQE_1",
  pullRequestNumber: 3061,
  state: "QUEUED",
  position: 1,
  enqueuedAt: DateTime.makeUnsafe("2026-11-10T04:54:37Z"),
  estimatedTimeToMerge: O.none(),
  jump: false,
  solo: false,
  enqueuer: O.some("beep-fleet-orchestrator"),
  headOid: O.none(),
  baseOid: O.none(),
});

const JsonObject = S.fromJsonString(S.Record(S.String, S.Unknown));

describe("PullRequest merge queue", () => {
  const { base, script } = harness([
    { status: 200, body: { data: { enqueuePullRequest: { mergeQueueEntry: queuedWire } } } },
    { status: 200, body: { data: { enqueuePullRequest: { mergeQueueEntry: null } } } },
    { status: 200, body: { data: { repository: { pullRequest: { mergeQueueEntry: buildingWire } } } } },
    { status: 200, body: { data: { repository: { pullRequest: { mergeQueueEntry: null } } } } },
    { status: 200, body: { data: { repository: { pullRequest: null } } } },
    { status: 200, body: { data: { dequeuePullRequest: { mergeQueueEntry: queuedWire } } } },
    {
      status: 200,
      body: { data: { repository: { pullRequest: { mergeQueueEntry: { ...queuedWire, state: "SOON" } } } } },
    },
    {
      status: 200,
      body: { data: null, errors: [{ message: "Pull request is not mergeable", type: "UNPROCESSABLE" }] },
    },
  ]);
  const sent = (index: number) => S.decodeEffect(JsonObject)(script.calls[index]?.body || "{}");

  it.layer(PullRequest.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("enqueues at the read head, reads and dequeues entries", () =>
      Effect.gen(function* () {
        const pulls = yield* PullRequest;

        const entry = yield* pulls.enqueuePullRequest(info);
        assertSome(entry, queued);
        const first = yield* sent(0);
        assert.deepStrictEqual(first.variables, { pullRequestId: "PR_3061", expectedHeadOid: "d0444bc", jump: false });
        assert.match(String(first.query), /enqueuePullRequest/);

        const jumped = yield* pulls.enqueuePullRequest(info, { expectedHeadOid: "fff", jump: true });
        assertNone(jumped);
        const second = yield* sent(1);
        assert.deepStrictEqual(second.variables, { pullRequestId: "PR_3061", expectedHeadOid: "fff", jump: true });

        const building = yield* pulls.mergeQueueEntry(3061);
        assert.isTrue(O.isSome(building));
        const read = O.getOrThrow(building);
        assert.strictEqual(read.state, "AWAITING_CHECKS");
        assertSome(read.headOid, "01ad0c0");
        assertSome(read.baseOid, "013e749");
        assertSome(read.estimatedTimeToMerge, 42);
        const third = yield* sent(2);
        assert.deepStrictEqual(third.variables, { owner: "acme", name: "widget", number: 3061 });

        const notQueued = yield* pulls.mergeQueueEntry(3061);
        assertNone(notQueued);
        const missing = yield* pulls.mergeQueueEntry(9999);
        assertNone(missing);

        const removed = yield* pulls.dequeuePullRequest(queued);
        assertSome(removed, queued);
        const fifth = yield* sent(5);
        assert.deepStrictEqual(fifth.variables, { id: "MQE_1" });
        assert.match(String(fifth.query), /dequeuePullRequest/);
      })
    );

    it.effect("an unknown entry state fails decoding, a refusal fails the call", () =>
      Effect.gen(function* () {
        const pulls = yield* PullRequest;
        const unknown = yield* Effect.flip(pulls.mergeQueueEntry(3061));
        assert.strictEqual(unknown._tag, "GitHubGraphQLError");
        const refused = yield* Effect.flip(pulls.enqueuePullRequest(info));
        assert.strictEqual(refused._tag, "GitHubGraphQLError");
        assert.match(refused.message, /not mergeable/);
      })
    );
  });

  it.effect("the test double names unstubbed queue members", () =>
    Effect.sync(() => {
      const pulls = PullRequest.makeTest();
      assert.throws(() => pulls.enqueuePullRequest(info), "PullRequest.makeTest: enqueuePullRequest()");
      assert.throws(() => pulls.dequeuePullRequest(queued), "PullRequest.makeTest: dequeuePullRequest()");
      assert.throws(() => pulls.mergeQueueEntry(1), "PullRequest.makeTest: mergeQueueEntry()");
    })
  );
});
