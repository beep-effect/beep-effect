// MEAS-03 admission gate: a committed journal whose every attempt is classified
// by hand below, with the reason, and replayed through the live loader and fold.
// The fixture rows are synthetic but use the shapes live journals carry,
// including rows written before the newer fields existed.
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { UUID } from "@beep/repo-cli/test/SharedInternals";
import {
  buildYeetEconomicsReport,
  EconomicsAttempt,
  EconomicsScope,
  EconomicsScopeRequest,
  economicsAttemptClass,
  economicsCountMix,
  YeetAttemptTerminationReason,
  YeetEconomicsSource,
} from "@beep/repo-cli/test/Yeet";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Str from "effect/String";
import type { EconomicsAttemptClass } from "@beep/repo-cli/test/Yeet";

const RUN_ID = "feat_economics-terminations-0123456789ab";
const NOW = DateTime.makeUnsafe("2026-11-13T00:00:00.000Z");
const MINUTE = 60_000;

const fixtureJournal = pipe(
  R.values(
    import.meta.glob<string>("./fixtures/yeet-economics/adjudicated-terminations.ndjson", {
      eager: true,
      import: "default",
      query: "?raw",
    })
  ),
  A.head,
  O.getOrThrow
);

const LiveSource = Layer.provideMerge(
  YeetEconomicsSource.layer,
  Layer.mergeAll(MemoryFileSystem.layer, NodePath.layer, NodeCrypto.layer)
);

const attemptId = (suffix: number): string =>
  UUID.make(`7c9f5b1e-2d4a-4f6b-9a8c-${Str.padStart(12, "0")(`${suffix}`)}`);

const adjudicate = (
  suffix: number,
  mode: string,
  attemptClass: EconomicsAttemptClass,
  actionable: string | undefined,
  why: string
) => ({ attemptId: attemptId(suffix), mode, attemptClass, actionable: O.fromUndefinedOr(actionable), why });

// Each fixture attempt, its expected class, its actionable-lane row when it is
// red, and why. A dirty-tree final-check refusal has no row: FinalCheck refuses
// it before the attempt opens (decision `final-check-attempt-journal`), so it
// can never be a red or a termination here.
const ADJUDICATED = [
  adjudicate(1, "publish", "red", "quality:check", "a failure verdict whose failing inner lane ran under its wrapper"),
  adjudicate(2, "final-check", "terminated", undefined, "interrupted: cut off, no verdict, no failure named"),
  adjudicate(3, "publish", "terminated", undefined, "signal: the proof process was killed"),
  adjudicate(4, "verify", "terminated", undefined, "timeout: systemd stopped the proof job"),
  adjudicate(5, "publish", "terminated", undefined, "owner-dead: the owner died, the reconciler closed it later"),
  adjudicate(
    6,
    "final-check",
    "red",
    "unrecorded",
    "unrecorded-failure: the run failed by itself (a defect) and kept no verdict"
  ),
  adjudicate(
    7,
    "final-check",
    "red",
    "refusal:moved-tree",
    "a handler-error refusal: the checkout changed while the gates ran"
  ),
  adjudicate(8, "final-check", "red", "final-check:check", "a red gate: step-exit naming the failed step"),
  adjudicate(9, "final-check", "green", undefined, "a passing run"),
  adjudicate(10, "verify", "terminated", undefined, "old start with no owner facts, swept as legacy-unowned-start"),
  adjudicate(
    11,
    "verify",
    "red",
    "full:01-pre-push",
    "old failure verdict with no failure kind or failed step: its first failed lane"
  ),
  adjudicate(12, "verify", "red", "unrecorded", "the first A5 writer's legacy reason `failure`: a failure, no verdict"),
  adjudicate(
    13,
    "verify",
    "terminated",
    undefined,
    "the first A5 writer's legacy reason `success`: no verdict and no failure named, so never a red"
  ),
  adjudicate(14, "verify", "green", undefined, "old success verdict"),
];

const countOf = (attemptClass: EconomicsAttemptClass): number =>
  A.length(A.filter(ADJUDICATED, (row) => row.attemptClass === attemptClass));

it.layer(LiveSource, { timeout: "30 seconds" })("yeet economics adjudicated terminations", (it) => {
  it.effect(
    "classifies every fixture attempt as adjudicated and states the denominator change",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "economics-adjudicated-" });
      const runDirectory = path.join(root, ".beep/yeet/runs", RUN_ID);
      yield* fs.makeDirectory(runDirectory, { recursive: true });
      yield* fs.writeFileString(path.join(runDirectory, "attempts.ndjson"), fixtureJournal);
      const journals = yield* YeetEconomicsSource.use((source) =>
        source.read(EconomicsScopeRequest.make({ repoRoot: root, branch: O.none(), fleet: false }))
      );
      const attempts = A.flatMap(journals, (journal) => journal.attempts);

      // Every row decodes, old ones included, and every attempt is adjudicated once.
      expect(A.map(journals, (journal) => [journal.diagnostics.invalidRows, journal.diagnostics.starts])).toEqual([
        [0, 14],
      ]);
      expect(
        A.sort(
          A.map(attempts, (attempt) => attempt.attemptId),
          Str.Order
        )
      ).toEqual(A.map(ADJUDICATED, (row) => row.attemptId));
      // Each row carries its reason on both sides, so a mismatch prints why the class was expected.
      const observed = A.map(ADJUDICATED, (row) =>
        pipe(
          A.findFirst(attempts, (attempt) => attempt.attemptId === row.attemptId),
          O.map((found) => [row.why, O.getOrUndefined(found.mode), economicsAttemptClass(found)])
        )
      );
      deepStrictEqual(
        observed,
        A.map(ADJUDICATED, (row) => O.some([row.why, row.mode, row.attemptClass]))
      );
      expect(A.some(attempts, (attempt) => Str.includes("the tree has uncommitted changes")(attempt.message))).toBe(
        false
      );

      const report = buildYeetEconomicsReport(
        journals,
        EconomicsScope.make({ kind: "checkout", checkouts: [root], branch: O.none() }),
        NOW,
        []
      );
      const failure = report.firstFailure;
      // The denominator: v3 counts the 6 reds; v2 counted every attempt that was
      // not green, the 6 terminations too (12). The actionable-lane and
      // receipt-proxy totals still equal the red count.
      expect(report.attempts.all.classMix).toEqual([
        { key: "red", count: countOf("red") },
        { key: "terminated", count: countOf("terminated") },
        { key: "green", count: countOf("green") },
      ]);
      expect(failure.redAttempts).toBe(6);
      expect(failure.redAttempts + countOf("terminated")).toBe(
        A.length(A.filter(attempts, (attempt) => !O.exists(attempt.outcome, (outcome) => outcome === "success")))
      );
      expect(Num.sumAll(A.map(failure.actionableLaneMix, (row) => row.count))).toBe(failure.redAttempts);
      expect(Num.sumAll(A.map(failure.receiptProxyMix, (row) => row.count))).toBe(failure.redAttempts);
      expect(failure.actionableLaneMix).toEqual(
        economicsCountMix(A.getSomes(A.map(ADJUDICATED, (row) => row.actionable)))
      );
      expect(report.attempts.all.failureKindMix).toEqual([
        { key: "unknown", count: 3 },
        { key: "step-exit", count: 2 },
        { key: "handler-error", count: 1 },
      ]);
      // The terminations section still lists every terminal reason, the two
      // that name a failure (red) beside the six terminations.
      expect(report.terminations.reasonMix).toEqual(
        economicsCountMix([
          "interrupted",
          "signal",
          "timeout",
          "owner-dead",
          "unrecorded-failure",
          "legacy-unowned-start",
          "failure",
          "success",
        ])
      );

      // Per-mode durations: green and red attempts are the sample; a terminated
      // attempt (the 30-minute final-check interrupt, the 40-minute timeout) is
      // counted beside it. The final-check sample is 3, 6.3, 12 and 50 minutes.
      deepStrictEqual(
        A.map(report.modeDurations, (row) => [
          row.mode,
          row.attempts,
          row.redAttempts,
          row.terminatedAttempts,
          row.measuredAttempts,
          row.p50ElapsedMs,
          row.p95ElapsedMs,
        ]),
        [
          ["verify", 6, 2, 3, 3, O.some(10 * MINUTE), O.some(12 * MINUTE)],
          ["final-check", 5, 3, 1, 4, O.some(378_000), O.some(50 * MINUTE)],
          ["publish", 3, 1, 2, 1, O.some(14 * MINUTE), O.some(14 * MINUTE)],
        ]
      );
    })
  );
});

describe("yeet economics attempt class", () => {
  const verdictless = (reason: YeetAttemptTerminationReason) =>
    EconomicsAttempt.make({
      checkout: "beep-effect",
      runId: RUN_ID,
      attemptId: reason,
      branch: "feat/economics-terminations",
      mode: O.some("verify"),
      outcome: O.none(),
      failureKind: O.none(),
      failedStepId: O.none(),
      message: "",
      startedAt: O.none(),
      endedAt: O.none(),
      elapsedMs: O.none(),
      diffFingerprint: O.none(),
      terminationReason: O.some(reason),
      verdictSchemaVersion: O.none(),
      lanes: [],
    });

  it("classes every termination reason: only a named failure is red", () => {
    expect(
      A.map(YeetAttemptTerminationReason.literals, (reason) => [reason, economicsAttemptClass(verdictless(reason))])
    ).toEqual(
      A.map(YeetAttemptTerminationReason.literals, (reason) => [
        reason,
        reason === "failure" || reason === "unrecorded-failure" ? "red" : "terminated",
      ])
    );
  });

  it("lets a verdict decide over a reason, and keeps an attempt with neither red", () => {
    const interrupted = verdictless("interrupted");
    expect(economicsAttemptClass(EconomicsAttempt.make({ ...interrupted, outcome: O.some("success") }))).toBe("green");
    expect(economicsAttemptClass(EconomicsAttempt.make({ ...interrupted, outcome: O.some("failure") }))).toBe("red");
    expect(economicsAttemptClass(EconomicsAttempt.make({ ...interrupted, terminationReason: O.none() }))).toBe("red");
  });
});
