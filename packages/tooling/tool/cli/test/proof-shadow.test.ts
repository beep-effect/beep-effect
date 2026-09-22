import { QualityTaskLaneRun, QualityTaskLaneRunReport } from "@beep/repo-cli/commands/Quality";
import {
  buildProofShadowReport,
  loadProofShadowReport,
  ProofLedger,
  ProofShadowEnforcementBar,
  proofLedgerPathForCheckout,
  recordProofShadowForAttempt,
  renderProofShadowAttemptSummary,
  renderProofShadowReport,
  shadowableLaneRuns,
  UNDECLARED_INPUT_DIGEST,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { ProofShadowAttemptFacts } from "@beep/repo-cli/test/Yeet";

const PlatformLayer = Layer.mergeAll(NodeCrypto.layer, NodeFileSystem.layer, NodePath.layer);

const facts = (overrides: Partial<ProofShadowAttemptFacts> = {}): ProofShadowAttemptFacts => ({
  attemptId: "attempt-1",
  runId: "run-1",
  branch: "feat/example",
  headSha: "88fa371cb0",
  tier: "full",
  stage: "pre-push",
  envProfile: "local",
  ...overrides,
});

const lane = (
  id: string,
  status: QualityTaskLaneRun["status"],
  inputDigest: O.Option<string>,
  durationMs = 1_000
): QualityTaskLaneRun =>
  QualityTaskLaneRun.make({
    id,
    label: id,
    status,
    startedAt: O.some("2026-09-21T00:00:00.000Z"),
    endedAt: O.some("2026-09-21T00:00:01.000Z"),
    durationMs: O.some(durationMs),
    exitCode: O.some(status === "failed" ? 1 : 0),
    inputDigest,
    commandText: O.some(`bun run beep ci lane ${id}`),
  });

const report = (lanes: ReadonlyArray<QualityTaskLaneRun>): QualityTaskLaneRunReport =>
  QualityTaskLaneRunReport.make({
    schemaVersion: "quality-task-lane-run/v1",
    parentLaneId: O.some("full:pre-push"),
    lanes,
  });

// The epoch collector reads six root files; a temp checkout carrying them is the
// smallest repo the shadow pass can run against.
const inTempCheckout = Effect.fn("ProofShadowTest.inTempCheckout")(function* <Value, Failure, Requirements>(
  use: (root: string) => Effect.Effect<Value, Failure, Requirements>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* Effect.acquireUseRelease(
    fs.makeTempDirectory().pipe(
      Effect.tap((root) =>
        Effect.gen(function* () {
          const policyPackDir = path.join(root, "packages", "tooling", "policy-pack", "lint-rules");
          yield* fs.makeDirectory(policyPackDir, { recursive: true });
          yield* fs.writeFileString(path.join(root, "bun.lock"), "lockfile\n");
          yield* fs.writeFileString(path.join(root, ".bun-version"), "1.4.0\n");
          yield* fs.writeFileString(path.join(root, ".nvmrc"), "24\n");
          yield* fs.writeFileString(path.join(root, "turbo.json"), "{}\n");
          yield* fs.writeFileString(path.join(root, "tsconfig.base.json"), "{}\n");
          yield* fs.writeFileString(path.join(policyPackDir, "package.json"), '{"version":"9.8.7"}\n');
        })
      )
    ),
    use,
    (root) => Effect.ignore(fs.remove(root, { recursive: true }))
  );
});

describe("proof shadow mode", () => {
  it("selects only lanes that ran to a terminal outcome with a command line", () => {
    const selected = shadowableLaneRuns([
      report([
        lane("quality:coverage", "passed", O.some("digest-a")),
        lane("quality:check", "failed", O.some("digest-b")),
        lane("quality:knip", "reused", O.some("digest-c")),
        lane("quality:docgen", "not-run-early-stop", O.none()),
        QualityTaskLaneRun.make({
          id: "quality:lint",
          label: "lint",
          status: "passed",
          inputDigest: O.some("digest-d"),
          commandText: O.none(),
        }),
      ]),
    ]);
    expect(A.map(selected, (entry) => entry.lane.id)).toStrictEqual(["quality:coverage", "quality:check"]);
    expect(A.map(selected, (entry) => entry.observed)).toStrictEqual(["passed", "failed"]);
  });

  it.live("records nothing and touches no ledger when the attempt has no shadowable lanes", () =>
    inTempCheckout((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const summary = yield* recordProofShadowForAttempt(root, facts(), [report([])]);
        expect(summary).toMatchObject({ recorded: 0, wouldReuse: 0, disagreements: 0, undeclared: 0 });
        expect(yield* fs.exists(yield* proofLedgerPathForCheckout(root))).toBe(false);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("shadows a first attempt as misses and records one fact per lane", () =>
    inTempCheckout((root) =>
      Effect.gen(function* () {
        const summary = yield* recordProofShadowForAttempt(root, facts(), [
          report([
            lane("quality:coverage", "passed", O.some("digest-a"), 600_000),
            lane("quality:check", "failed", O.some("digest-b")),
            lane("quality:labs", "passed", O.none()),
          ]),
        ]);
        expect(summary).toMatchObject({ recorded: 3, wouldReuse: 0, disagreements: 0, undeclared: 1 });

        const ledger = yield* ProofLedger.make(root);
        const rows = yield* ledger.shadowRows;
        expect(A.map(rows, (row) => row.decision.kind)).toStrictEqual(["miss", "miss", "miss"]);
        expect(
          A.map(rows, (row) => (row.decision.kind === "miss" ? row.decision.reason : row.decision.kind))
        ).toStrictEqual(["no-fact", "no-fact", "undeclared-inputs"]);
        expect(A.map(rows, (row) => row.laneId)).toStrictEqual(["quality:coverage", "quality:check", "quality:labs"]);
        expect(A.every(rows, (row) => row.branch === "feat/example" && row.stage === "pre-push")).toBe(true);
        expect(yield* ledger.facts).toBe(3);
        expect(yield* ledger.malformedRows).toBe(0);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("reports a would-reuse hit on the next attempt and a disagreement when that lane fails", () =>
    inTempCheckout((root) =>
      Effect.gen(function* () {
        const lanes = [
          lane("quality:coverage", "passed", O.some("digest-a"), 600_000),
          lane("quality:check", "failed", O.some("digest-b")),
          lane("quality:lint", "passed", O.some("digest-c"), 120_000),
        ];
        yield* recordProofShadowForAttempt(root, facts(), [report(lanes)]);

        const second = yield* recordProofShadowForAttempt(
          root,
          facts({ attemptId: "attempt-2", branch: "fix/review" }),
          [
            report([
              lane("quality:coverage", "failed", O.some("digest-a"), 610_000),
              lane("quality:check", "passed", O.some("digest-b")),
              lane("quality:lint", "passed", O.some("digest-c"), 118_000),
            ]),
          ]
        );
        expect(second).toMatchObject({ recorded: 3, wouldReuse: 2, disagreements: 1, undeclared: 0 });
        expect(renderProofShadowAttemptSummary(second)).toBe(
          "proof shadow: 3 lane(s) recorded; would reuse 2; disagreements 1; undeclared inputs 0"
        );

        const shadow = yield* loadProofShadowReport(root);
        expect(shadow).toMatchObject({
          shadowRows: 6,
          attempts: 2,
          branches: 2,
          wouldReuse: 2,
          reusableMs: 118_000,
          facts: 6,
          expiredFacts: 0,
          malformedRows: 0,
          barStage: "pre-push",
          barEnvProfile: "local",
          barAttempts: 2,
          barBranches: 2,
          barDisagreements: 1,
          enforcementReady: false,
        });
        expect(A.map(shadow.misses, (miss) => [miss.reason, miss.count])).toStrictEqual([
          ["no-fact", 3],
          ["prior-failed", 1],
        ]);
        expect(A.map(shadow.disagreements, (row) => [row.attemptId, row.laneId, row.branch])).toStrictEqual([
          ["attempt-2", "quality:coverage", "fix/review"],
        ]);
        const ledger = yield* ProofLedger.make(root);
        expect(yield* ledger.disagreements).toHaveLength(1);

        const text = renderProofShadowReport(shadow);
        expect(Str.includes("shadow rows: 6 across 2 attempt(s) on 2 branch(es)")(text)).toBe(true);
        expect(Str.includes("would reuse: 2 lane run(s), 2.0 min of passed lane time")(text)).toBe(true);
        expect(Str.includes("quality:coverage on fix/review (pre-push, attempt attempt-2)")(text)).toBe(true);
        expect(
          Str.includes("pre-push, local): not ready — attempts 2/200, branches 2/10, disagreements 1/0")(text)
        ).toBe(true);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("keeps a lane with undeclared inputs from ever becoming a hit", () =>
    inTempCheckout((root) =>
      Effect.gen(function* () {
        const undeclared = [lane("quality:labs", "passed", O.none())];
        yield* recordProofShadowForAttempt(root, facts(), [report(undeclared)]);
        const second = yield* recordProofShadowForAttempt(root, facts({ attemptId: "attempt-2" }), [
          report(undeclared),
        ]);
        expect(second).toMatchObject({ recorded: 1, wouldReuse: 0, undeclared: 1 });

        const ledger = yield* ProofLedger.make(root);
        const rows = yield* ledger.shadowRows;
        expect(
          A.every(rows, (row) => row.decision.kind === "miss" && row.decision.reason === "undeclared-inputs")
        ).toBe(true);
        const ledgerPath = yield* proofLedgerPathForCheckout(root);
        const contents = yield* (yield* FileSystem.FileSystem).readFileString(ledgerPath);
        expect(Str.includes(`"inputDigest":"${UNDECLARED_INPUT_DIGEST}"`)(contents)).toBe(true);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it("declares enforcement ready only when the bar is met with zero disagreements", () => {
    const empty = buildProofShadowReport({
      generatedAt: DateTime.formatIso(DateTime.makeUnsafe("2026-09-21T00:00:00.000Z")),
      ledgerPath: "/repo/.beep/yeet/proof-ledger.ndjson",
      rows: [],
      facts: 0,
      expiredFacts: 0,
      malformedRows: 0,
    });
    expect(empty.bar).toStrictEqual(ProofShadowEnforcementBar.ratified);
    expect(empty.enforcementReady).toBe(false);

    const lowered = buildProofShadowReport({
      generatedAt: empty.generatedAt,
      ledgerPath: empty.ledgerPath,
      rows: [],
      facts: 0,
      expiredFacts: 0,
      malformedRows: 0,
      bar: ProofShadowEnforcementBar.make({ attempts: 0, branches: 0, disagreements: 0 }),
    });
    expect(lowered.enforcementReady).toBe(true);
    expect(
      Str.includes("enforcement (attempt-to-attempt, pre-push, local): ready")(renderProofShadowReport(lowered))
    ).toBe(true);
  });

  it.live("never lets merged-preview rows satisfy the pre-push bar", () =>
    inTempCheckout((root) =>
      Effect.gen(function* () {
        const lanes = [lane("quality:coverage", "passed", O.some("digest-a"))];
        yield* recordProofShadowForAttempt(
          root,
          facts({ attemptId: "preview-1", branch: "feat/a", stage: "merged-preview", envProfile: "pr-posture" }),
          [report(lanes)]
        );
        yield* recordProofShadowForAttempt(
          root,
          facts({ attemptId: "preview-2", branch: "feat/b", stage: "merged-preview", envProfile: "pr-posture" }),
          [report(lanes)]
        );
        const previewOnly = yield* loadProofShadowReport(root);
        const bar = ProofShadowEnforcementBar.make({ attempts: 2, branches: 2, disagreements: 0 });
        const judged = buildProofShadowReport({
          ...previewOnly,
          rows: yield* (yield* ProofLedger.make(root)).shadowRows,
          bar,
        });
        expect(judged).toMatchObject({
          attempts: 2,
          branches: 2,
          barAttempts: 0,
          barBranches: 0,
          enforcementReady: false,
        });

        yield* recordProofShadowForAttempt(root, facts({ attemptId: "push-1", branch: "feat/a" }), [report(lanes)]);
        yield* recordProofShadowForAttempt(root, facts({ attemptId: "push-2", branch: "feat/b" }), [report(lanes)]);
        const mixed = buildProofShadowReport({
          ...previewOnly,
          rows: yield* (yield* ProofLedger.make(root)).shadowRows,
          bar,
        });
        expect(mixed).toMatchObject({
          attempts: 4,
          branches: 2,
          barAttempts: 2,
          barBranches: 2,
          barDisagreements: 0,
          enforcementReady: true,
        });
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );
});
