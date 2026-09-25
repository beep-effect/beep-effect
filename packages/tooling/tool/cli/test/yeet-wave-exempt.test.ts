import {
  appendYeetInboxRow,
  convergeYeetInbox,
  loadYeetInboxView,
  readYeetAckState,
  writeYeetAckReceipt,
  YeetAckReceipt,
  YeetAckThreadResolution,
  YeetBaseConflictCapsule,
  YeetBaseConflictRow,
  YeetBaseDriftCapsule,
  YeetBaseDriftRow,
  YeetCheckFailedRow,
  YeetConvergeObservation,
  YeetFailureCapsule,
  YeetInboxObservedRowKind,
  YeetInboxWaveExemptRowKind,
  YeetRemediationWave,
  YeetRemediationWaveJson,
  YeetReviewThreadCapsule,
  YeetReviewThreadRow,
  YeetWatchThread,
  yeetBaseConflictRowId,
  yeetBaseDriftRowId,
  yeetDispatchStatePath,
  yeetInboxPaths,
  yeetInboxReviewThreadRowIds,
  yeetInboxRowId,
  yeetInboxRowIsWaveExempt,
  yeetInboxRowLiveness,
  yeetReviewThreadRowId,
} from "@beep/repo-cli/test/Yeet";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";

const at = "2026-09-25T00:00:00.000Z";
const oldHead = "aaaaaaa1111111";
const newHead = "bbbbbbb2222222";

const wave = (headSha: string, prNumber = 7) =>
  YeetRemediationWave.make({ capsuleIds: [], headSha, prNumber, sessionStartedAt: null, updatedAt: at });

// One row of each wave-joined kind on the old head, as the producers leave them.
const oldHeadRows = Effect.fn("waveExemptTest.oldHeadRows")(function* () {
  const threadCapsule = YeetReviewThreadCapsule.make({ headSha: oldHead, link: null, prNumber: 7, threadId: "PRRT_1" });
  const driftCapsule = YeetBaseDriftCapsule.make({ base: "origin/main", headSha: oldHead, prNumber: 7 });
  const conflictCapsule = YeetBaseConflictCapsule.make({
    base: "origin/main",
    headSha: oldHead,
    link: null,
    mergeable: "CONFLICTING",
    mergeStateStatus: "DIRTY",
    prNumber: 7,
  });
  const failedCapsule = YeetFailureCapsule.make({
    bucket: "fail",
    headSha: oldHead,
    lane: "Check",
    link: null,
    observedAt: at,
    prNumber: 7,
    state: "FAILURE",
    workflow: null,
  });
  return {
    thread: YeetReviewThreadRow.make({
      capsule: threadCapsule,
      checkout: "/repo",
      id: yield* yeetReviewThreadRowId(threadCapsule),
      severity: "P1",
      ts: at,
    }),
    drift: YeetBaseDriftRow.make({
      capsule: driftCapsule,
      checkout: "/repo",
      id: yield* yeetBaseDriftRowId(driftCapsule),
      severity: "P2",
      ts: at,
    }),
    conflict: YeetBaseConflictRow.make({
      capsule: conflictCapsule,
      checkout: "/repo",
      id: yield* yeetBaseConflictRowId(conflictCapsule),
      severity: "P0",
      ts: at,
    }),
    failed: YeetCheckFailedRow.make({
      capsule: failedCapsule,
      checkout: "/repo",
      id: yield* yeetInboxRowId(failedCapsule),
      severity: "P0",
      ts: at,
    }),
  };
});

const platform = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, NodeCrypto.layer);

it.layer(platform, { timeout: "30 seconds" })("wave-exempt row kinds", (test) => {
  test.effect("name review threads and pull request comments, apart from the observed kinds", () =>
    Effect.gen(function* () {
      const { conflict, drift, failed, thread } = yield* oldHeadRows();
      expect(YeetInboxWaveExemptRowKind.Options).toStrictEqual(["review-thread", "pr-comment"]);
      expect(YeetInboxWaveExemptRowKind.is["pr-comment"]("pr-comment")).toBe(true);
      expect(A.intersection(YeetInboxWaveExemptRowKind.Options, YeetInboxObservedRowKind.Options)).toStrictEqual([]);
      expect(A.map([thread, drift, conflict, failed], yeetInboxRowIsWaveExempt)).toStrictEqual([
        true,
        false,
        false,
        false,
      ]);
    })
  );

  test.effect("keep review threads live across a push while drift, conflicts and reds are superseded", () =>
    Effect.gen(function* () {
      const { conflict, drift, failed, thread } = yield* oldHeadRows();
      const pushed = O.some(wave(newHead));
      expect(yeetInboxRowLiveness(thread, pushed)).toBe("live");
      expect(yeetInboxRowLiveness(thread, O.none())).toBe("live");
      expect(yeetInboxRowLiveness(drift, pushed)).toBe("superseded");
      expect(yeetInboxRowLiveness(conflict, pushed)).toBe("superseded");
      expect(yeetInboxRowLiveness(failed, pushed)).toBe("superseded");
      // Before the push, every wave-joined kind is live on its own head.
      const current = O.some(wave(oldHead));
      expect(A.map([drift, conflict, failed], (row) => yeetInboxRowLiveness(row, current))).toStrictEqual([
        "live",
        "live",
        "live",
      ]);
      expect(yeetInboxRowLiveness(conflict, O.none())).toBe("unknown");
    })
  );

  test.effect("hold in the joined inbox view after the wave record moves to the new head", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-wave-exempt-" });
      const { conflict, drift, failed, thread } = yield* oldHeadRows();
      yield* Effect.forEach([failed, thread, drift, conflict], (row) => appendYeetInboxRow(root, row), {
        discard: true,
      });
      const paths = yield* yeetInboxPaths(root);
      yield* fs.makeDirectory(paths.dir, { recursive: true });
      yield* fs.writeFileString(
        yield* yeetDispatchStatePath(root),
        `${yield* YeetRemediationWaveJson.encode(wave(newHead))}\n`
      );
      const view = yield* loadYeetInboxView(root);
      expect(A.map(view.entries, (entry) => [entry.row.kind, entry.liveness])).toStrictEqual([
        ["check-failed", "superseded"],
        ["review-thread", "live"],
        ["base-drift", "superseded"],
        ["base-conflict", "superseded"],
      ]);
    })
  );
});

it.layer(platform, { timeout: "30 seconds" })("wave-exempt review-thread rows under convergence", (test) => {
  test.effect("keep one live row per outstanding thread across pushes until it is acknowledged", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-wave-exempt-converge-" });
      const context = { base: "origin/main", repoRoot: root };
      const observe = (headSha: string) =>
        YeetConvergeObservation.make({
          checks: [],
          headSha,
          mergeStateStatus: "CLEAN",
          prNumber: 7,
          threads: [YeetWatchThread.make({ id: "PRRT_1", state: "unresolved" })],
        });
      const pinWave = Effect.fnUntraced(function* (headSha: string) {
        yield* fs.makeDirectory((yield* yeetInboxPaths(root)).dir, { recursive: true });
        yield* fs.writeFileString(
          yield* yeetDispatchStatePath(root),
          `${yield* YeetRemediationWaveJson.encode(wave(headSha))}\n`
        );
      });
      // The head each live, unacknowledged review-thread row was written on.
      const liveThreadHeads = Effect.gen(function* () {
        const view = yield* loadYeetInboxView(root);
        return A.flatMap(view.entries, ({ ack, liveness, row }) =>
          row.kind === "review-thread" && liveness === "live" && !ack.acked ? [row.capsule.headSha] : []
        );
      });

      // Head A writes the thread's row; the push to head B still shows the
      // thread outstanding, and the earlier row, live across the push, carries it.
      yield* pinWave(oldHead);
      yield* convergeYeetInbox(context, observe(oldHead), at);
      yield* pinWave(newHead);
      yield* convergeYeetInbox(context, observe(newHead), at);
      const held = yield* yeetInboxReviewThreadRowIds(root, 7, "PRRT_1");
      expect(held).toHaveLength(1);
      expect(yield* liveThreadHeads).toStrictEqual([oldHead]);

      // Once that row is acknowledged, a thread still outstanding on the next
      // head gets a fresh row.
      const first = A.getUnsafe(held, 0);
      yield* writeYeetAckReceipt(
        root,
        YeetAckReceipt.make({
          ackedAt: at,
          id: first,
          resolution: YeetAckThreadResolution.make({ url: "https://github.com/beep/repo/pull/7#discussion_r1" }),
        })
      );
      expect((yield* readYeetAckState(root, first)).acked).toBe(true);
      const thirdHead = "ccccccc3333333";
      yield* pinWave(thirdHead);
      yield* convergeYeetInbox(context, observe(thirdHead), at);
      expect(yield* liveThreadHeads).toStrictEqual([thirdHead]);
    })
  );
});
