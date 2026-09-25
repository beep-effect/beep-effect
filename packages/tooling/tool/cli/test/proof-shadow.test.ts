import { QualityTaskLaneRun, QualityTaskLaneRunReport } from "@beep/repo-cli/commands/Quality";
import {
  buildProofShadowReport,
  changedPackagesForAttempt,
  loadProofShadowReport,
  ProofChangedPackagesKnown,
  ProofChangedPackagesUnavailable,
  ProofLedger,
  ProofShadowAttemptFacts,
  ProofShadowEnforcementBar,
  ProofShadowReportInput,
  ProofShadowReportJson,
  porcelainChangedPaths,
  proofLedgerPathForCheckout,
  proofShadowAttemptFacts,
  RepoRunContext,
  readYeetChangedPathsStrict,
  recordProofShadowForAttempt,
  renderProofChangedPackages,
  renderProofShadowAttemptSummary,
  renderProofShadowReport,
  runYeetProofReport,
  runYeetProofReportCommand,
  shadowableLaneRuns,
  UNDECLARED_INPUT_DIGEST,
  YeetAttemptStarted,
  YeetProofReportOptions,
} from "@beep/repo-cli/test/Yeet";
import { UUID } from "@beep/schema/String";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect, FileSystem, Layer, Path, pipe, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const PlatformLayer = Layer.mergeAll(NodeCrypto.layer, NodeFileSystem.layer, NodePath.layer);

const facts = (overrides: Partial<ProofShadowAttemptFacts> = {}): ProofShadowAttemptFacts =>
  ProofShadowAttemptFacts.make({
    attemptId: "attempt-1",
    runId: "run-1",
    branch: "feat/example",
    headSha: "88fa371cb0",
    tier: "full",
    stage: "pre-push",
    envProfile: "local",
    ...overrides,
  });

const attemptStarted = (overrides: Partial<Parameters<typeof YeetAttemptStarted.make>[0]> = {}): YeetAttemptStarted =>
  YeetAttemptStarted.make({
    schemaVersion: "yeet-attempt-journal/v1",
    _tag: "attempt-started",
    attemptId: UUID.make("7c9f5b1e-2d4a-4f6b-9a8c-1e2d3f4a5b6c"),
    runId: "run-9",
    branch: "feat/facts",
    base: "main",
    head: "feat/facts",
    mode: "verify",
    startedAt: "2026-09-21T00:00:00.000Z",
    ...overrides,
  });

const emptyInput = (bar?: ProofShadowEnforcementBar): ProofShadowReportInput =>
  ProofShadowReportInput.make({
    generatedAt: DateTime.formatIso(DateTime.makeUnsafe("2026-09-21T00:00:00.000Z")),
    ledgerPath: "/repo/.beep/yeet/proof-ledger.ndjson",
    rows: [],
    facts: 0,
    expiredFacts: 0,
    malformedRows: 0,
    ...(bar === undefined ? {} : { bar }),
  });

const lane = (
  id: string,
  status: QualityTaskLaneRun["status"],
  inputDigest: O.Option<string>,
  durationMs = 1_000,
  inputPackages: ReadonlyArray<string> = []
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
    inputPackages,
    commandText: O.some(`bun run beep ci lane ${id}`),
  });

// The attempt's changed package set: an empty `known` set never trips the
// tripwire, so every fixture that is not about the tripwire uses it.
const changedNone = (): ProofChangedPackagesKnown =>
  ProofChangedPackagesKnown.make({ kind: "known", packages: [], paths: 0 });

const changedKnown = (packages: ReadonlyArray<string>, paths = packages.length): ProofChangedPackagesKnown =>
  ProofChangedPackagesKnown.make({ kind: "known", packages, paths });

const changedUnavailable = (reason: string): ProofChangedPackagesUnavailable =>
  ProofChangedPackagesUnavailable.make({ kind: "unavailable", reason });

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
  it("resolves attempt facts with pre-push defaults and prefers the resolved head", () => {
    const defaults = proofShadowAttemptFacts(attemptStarted());
    expect(defaults).toStrictEqual(
      ProofShadowAttemptFacts.make({
        attemptId: "7c9f5b1e-2d4a-4f6b-9a8c-1e2d3f4a5b6c",
        runId: "run-9",
        branch: "feat/facts",
        headSha: "feat/facts",
        tier: "full",
        stage: "pre-push",
        envProfile: "local",
      })
    );
    const resolved = proofShadowAttemptFacts(
      attemptStarted({
        resolvedHeadSha: O.some("88fa371cb0"),
        proofTier: O.some("cheap-gates"),
        stage: O.some("merged-preview"),
        envProfile: O.some("pr-posture"),
      })
    );
    expect(resolved).toMatchObject({
      headSha: "88fa371cb0",
      tier: "cheap-gates",
      stage: "merged-preview",
      envProfile: "pr-posture",
    });
  });

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
        const summary = yield* recordProofShadowForAttempt(root, facts(), [report([])], changedNone());
        expect(summary).toMatchObject({ recorded: 0, wouldReuse: 0, disagreements: 0, undeclared: 0 });
        expect(yield* fs.exists(yield* proofLedgerPathForCheckout(root))).toBe(false);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("shadows a first attempt as misses and records one fact per lane", () =>
    inTempCheckout((root) =>
      Effect.gen(function* () {
        const summary = yield* recordProofShadowForAttempt(
          root,
          facts(),
          [
            report([
              lane("quality:coverage", "passed", O.some("digest-a"), 600_000),
              lane("quality:check", "failed", O.some("digest-b")),
              QualityTaskLaneRun.make({
                id: "quality:labs",
                label: "labs",
                status: "passed",
                inputDigest: O.none(),
                commandText: O.some("bun run beep ci lane labs"),
              }),
            ]),
          ],
          changedNone()
        );
        expect(summary).toMatchObject({ recorded: 3, wouldReuse: 0, disagreements: 0, undeclared: 1 });

        const ledger = yield* ProofLedger.make(root);
        const rows = yield* ledger.shadowRows;
        expect(A.map(rows, (row) => row.decision.kind)).toStrictEqual(["miss", "miss", "miss"]);
        expect(
          A.map(rows, (row) => (row.decision.kind === "miss" ? row.decision.reason : row.decision.kind))
        ).toStrictEqual(["no-fact", "no-fact", "undeclared-inputs"]);
        expect(A.map(rows, (row) => row.laneId)).toStrictEqual(["quality:coverage", "quality:check", "quality:labs"]);
        expect(A.every(rows, (row) => row.branch === "feat/example" && row.stage === "pre-push")).toBe(true);
        expect(A.map(rows, (row) => row.durationMs)).toStrictEqual([600_000, 1_000, 0]);
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
        yield* recordProofShadowForAttempt(root, facts(), [report(lanes)], changedNone());

        const second = yield* recordProofShadowForAttempt(
          root,
          facts({ attemptId: "attempt-2", branch: "fix/review" }),
          [
            report([
              lane("quality:coverage", "failed", O.some("digest-a"), 610_000),
              lane("quality:check", "passed", O.some("digest-b")),
              lane("quality:lint", "passed", O.some("digest-c"), 118_000),
            ]),
          ],
          changedNone()
        );
        expect(second).toMatchObject({ recorded: 3, wouldReuse: 2, disagreements: 1, undeclared: 0 });
        expect(renderProofShadowAttemptSummary(second)).toBe(
          "proof shadow: 3 lane(s) recorded; would reuse 2; disagreements 1; undeclared inputs 0; tripwire 0"
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
        yield* recordProofShadowForAttempt(root, facts(), [report(undeclared)], changedNone());
        const second = yield* recordProofShadowForAttempt(
          root,
          facts({ attemptId: "attempt-2" }),
          [report(undeclared)],
          changedNone()
        );
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

  // C5 must-fail fixture (ruling 4): a lockfile change starts a new epoch, and a
  // passed fact from the old epoch never satisfies the same lane again.
  it.live("must fail: an epoch change refuses the passed fact it would otherwise reuse", () =>
    inTempCheckout((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const lanes = [lane("quality:coverage", "passed", O.some("digest-a"), 600_000)];
        yield* recordProofShadowForAttempt(root, facts(), [report(lanes)], changedNone());
        const sameEpoch = yield* recordProofShadowForAttempt(
          root,
          facts({ attemptId: "attempt-2" }),
          [report(lanes)],
          changedNone()
        );
        expect(sameEpoch).toMatchObject({ recorded: 1, wouldReuse: 1 });

        yield* fs.writeFileString(path.join(root, "bun.lock"), "lockfile after a deps bump\n");
        const newEpoch = yield* recordProofShadowForAttempt(
          root,
          facts({ attemptId: "attempt-3" }),
          [report(lanes)],
          changedNone()
        );
        expect(newEpoch).toMatchObject({ recorded: 1, wouldReuse: 0, disagreements: 0 });

        const ledger = yield* ProofLedger.make(root);
        const rows = yield* ledger.shadowRows;
        expect(
          A.map(rows, (row) => (row.decision.kind === "miss" ? row.decision.reason : row.decision.kind))
        ).toStrictEqual(["no-fact", "hit", "epoch-changed"]);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  // C5 must-fail fixture (rulings 1, 2, 63): a merged-preview fact recorded under the
  // PR posture never satisfies the same lane in pre-push under the local profile.
  it.live("must fail: a fact from another env profile never satisfies the pre-push lookup", () =>
    inTempCheckout((root) =>
      Effect.gen(function* () {
        const lanes = [lane("quality:coverage", "passed", O.some("digest-a"), 600_000)];
        yield* recordProofShadowForAttempt(
          root,
          facts({ stage: "merged-preview", envProfile: "pr-posture" }),
          [report(lanes)],
          changedNone()
        );
        const crossProfile = yield* recordProofShadowForAttempt(
          root,
          facts({ attemptId: "attempt-2" }),
          [report(lanes)],
          changedNone()
        );
        expect(crossProfile).toMatchObject({ recorded: 1, wouldReuse: 0, disagreements: 0 });

        const ledger = yield* ProofLedger.make(root);
        const rows = yield* ledger.shadowRows;
        expect(
          A.map(rows, (row) => (row.decision.kind === "miss" ? row.decision.reason : row.decision.kind))
        ).toStrictEqual(["no-fact", "profile-mismatch"]);
        expect(A.map(rows, (row) => `${row.stage}/${row.envProfile}`)).toStrictEqual([
          "merged-preview/pr-posture",
          "pre-push/local",
        ]);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  // C5 must-fail fixture (ruling 70): a lane whose package scope intersects the attempt's
  // changed packages is refused before any fact is read, even though its digest, epoch,
  // command and profile all still match the fact recorded a moment earlier.
  it.live("must fail: a changed package in a lane's scope refuses the digest that would have matched", () =>
    inTempCheckout((root) =>
      Effect.gen(function* () {
        const lanes = [lane("quality:check", "passed", O.some("d1"), 300_000, ["@beep/x"])];
        const first = yield* recordProofShadowForAttempt(root, facts(), [report(lanes)], changedKnown([]));
        expect(first).toMatchObject({ recorded: 1, wouldReuse: 0, tripped: 0 });

        const tripped = yield* recordProofShadowForAttempt(
          root,
          facts({ attemptId: "attempt-2" }),
          [report(lanes)],
          changedKnown(["@beep/x"], 3)
        );
        expect(tripped).toMatchObject({ recorded: 1, wouldReuse: 0, disagreements: 0, tripped: 1 });

        // The control: the same digest with a package the lane never verified still hits.
        const control = yield* recordProofShadowForAttempt(
          root,
          facts({ attemptId: "attempt-3" }),
          [report(lanes)],
          changedKnown(["@beep/y"], 1)
        );
        expect(control).toMatchObject({ recorded: 1, wouldReuse: 1, tripped: 0 });

        const ledger = yield* ProofLedger.make(root);
        const rows = yield* ledger.shadowRows;
        expect(
          A.map(rows, (row) => (row.decision.kind === "miss" ? row.decision.reason : row.decision.kind))
        ).toStrictEqual(["no-fact", "changed-package-tripwire", "hit"]);

        // The disagreement report counts the tripwire under misses by reason (ruling 64).
        const shadow = yield* loadProofShadowReport(root);
        expect(A.map(shadow.misses, (miss) => [miss.reason, miss.count])).toStrictEqual([
          ["no-fact", 1],
          ["changed-package-tripwire", 1],
        ]);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  // C5 fixture (ruling 70): a root-task-only lane records no package scope, so its digest
  // decides alone — a repo-wide lane is not refused just because some package changed.
  it.live("keeps a root-task-only lane decided by its digest while packages change around it", () =>
    inTempCheckout((root) =>
      Effect.gen(function* () {
        const lanes = [lane("cheap-gates:lint-policy", "passed", O.some("d-root"), 5_000)];
        yield* recordProofShadowForAttempt(root, facts(), [report(lanes)], changedKnown(["@beep/x"]));
        const second = yield* recordProofShadowForAttempt(
          root,
          facts({ attemptId: "attempt-2" }),
          [report(lanes)],
          changedKnown(["@beep/x"], 4)
        );
        expect(second).toMatchObject({ recorded: 1, wouldReuse: 1, tripped: 0 });
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  // C5 fixture (ruling 70): the ledger refuses an undeclared lane before the tripwire runs,
  // so a scoped-but-undeclared lane is named `undeclared-inputs`, never the tripwire.
  it.live("names an undeclared lane's own refusal rather than the tripwire", () =>
    inTempCheckout((root) =>
      Effect.gen(function* () {
        const lanes = [lane("quality:labs", "passed", O.none(), 1_000, ["@beep/x"])];
        yield* recordProofShadowForAttempt(root, facts(), [report(lanes)], changedKnown(["@beep/x"]));
        const second = yield* recordProofShadowForAttempt(
          root,
          facts({ attemptId: "attempt-2" }),
          [report(lanes)],
          changedKnown(["@beep/x"], 2)
        );
        expect(second).toMatchObject({ recorded: 1, wouldReuse: 0, undeclared: 1, tripped: 0 });

        const rows = yield* (yield* ProofLedger.make(root)).shadowRows;
        expect(
          A.map(rows, (row) => (row.decision.kind === "miss" ? row.decision.reason : row.decision.kind))
        ).toStrictEqual(["undeclared-inputs", "undeclared-inputs"]);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  // Review round 1, kriegcloud P2: a failed lane resolves no Turbo digest, so it
  // carries no package scope either. That costs the tripwire nothing, because the
  // ledger refuses an undeclared key before the tripwire is ever consulted.
  it.live("refuses a failed scoped lane as undeclared-inputs rather than the tripwire", () =>
    inTempCheckout((root) =>
      Effect.gen(function* () {
        const lanes = [lane("quality:check", "failed", O.none(), 1_000, ["@beep/x"])];
        const summary = yield* recordProofShadowForAttempt(
          root,
          facts(),
          [report(lanes)],
          changedKnown(["@beep/x"], 2)
        );
        expect(summary).toMatchObject({ recorded: 1, wouldReuse: 0, undeclared: 1, tripped: 0 });

        const rows = yield* (yield* ProofLedger.make(root)).shadowRows;
        expect(
          A.map(rows, (row) => (row.decision.kind === "miss" ? row.decision.reason : row.decision.kind))
        ).toStrictEqual(["undeclared-inputs"]);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  // C5 fixture (ruling 69): an unreadable changed set fails the tripwire closed — every
  // scoped lane is refused, and only a lane with no scope at all is still decided by
  // its digest.
  it.live("fails the tripwire closed when the changed package set is unavailable", () =>
    inTempCheckout((root) =>
      Effect.gen(function* () {
        const lanes = [
          lane("quality:check", "passed", O.some("d1"), 300_000, ["@beep/x"]),
          lane("cheap-gates:lint-policy", "passed", O.some("d-root"), 5_000),
        ];
        yield* recordProofShadowForAttempt(root, facts(), [report(lanes)], changedNone());
        const unavailable = yield* recordProofShadowForAttempt(
          root,
          facts({ attemptId: "attempt-2" }),
          [report(lanes)],
          changedUnavailable("git status exited with code 128")
        );
        expect(unavailable).toMatchObject({ recorded: 2, wouldReuse: 1, tripped: 1 });

        const rows = yield* (yield* ProofLedger.make(root)).shadowRows;
        expect(
          A.map(rows, (row) => (row.decision.kind === "miss" ? row.decision.reason : row.decision.kind))
        ).toStrictEqual(["no-fact", "no-fact", "changed-package-tripwire", "hit"]);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it("declares enforcement ready only when the bar is met with zero disagreements", () => {
    const empty = buildProofShadowReport(emptyInput());
    expect(empty.bar).toStrictEqual(ProofShadowEnforcementBar.ratified);
    expect(empty.enforcementReady).toBe(false);

    const lowered = buildProofShadowReport(
      emptyInput(ProofShadowEnforcementBar.make({ attempts: 0, branches: 0, disagreements: 0 }))
    );
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
          [report(lanes)],
          changedNone()
        );
        yield* recordProofShadowForAttempt(
          root,
          facts({ attemptId: "preview-2", branch: "feat/b", stage: "merged-preview", envProfile: "pr-posture" }),
          [report(lanes)],
          changedNone()
        );
        expect((yield* loadProofShadowReport(root)).enforcementReady).toBe(false);
        const bar = ProofShadowEnforcementBar.make({ attempts: 2, branches: 2, disagreements: 0 });
        const judged = buildProofShadowReport(
          ProofShadowReportInput.make({
            ...emptyInput(bar),
            rows: yield* (yield* ProofLedger.make(root)).shadowRows,
          })
        );
        expect(judged).toMatchObject({
          attempts: 2,
          branches: 2,
          barAttempts: 0,
          barBranches: 0,
          enforcementReady: false,
        });

        yield* recordProofShadowForAttempt(
          root,
          facts({ attemptId: "push-1", branch: "feat/a" }),
          [report(lanes)],
          changedNone()
        );
        yield* recordProofShadowForAttempt(
          root,
          facts({ attemptId: "push-2", branch: "feat/b" }),
          [report(lanes)],
          changedNone()
        );
        const mixed = buildProofShadowReport(
          ProofShadowReportInput.make({
            ...emptyInput(bar),
            rows: yield* (yield* ProofLedger.make(root)).shadowRows,
          })
        );
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

  it.live("prints the report as text or JSON from the checkout the locator names", () =>
    inTempCheckout((root) =>
      Effect.gen(function* () {
        yield* recordProofShadowForAttempt(
          root,
          facts(),
          [report([lane("quality:coverage", "passed", O.some("digest-a"))])],
          changedNone()
        );
        yield* runYeetProofReport(YeetProofReportOptions.make({ json: false }), Effect.succeed(root));
        yield* runYeetProofReport(YeetProofReportOptions.make({ json: true }), Effect.succeed(root));
        const lines = yield* TestConsole.logLines;
        expect(A.length(lines)).toBe(2);
        expect(Effect.isEffect(runYeetProofReportCommand({ json: false }))).toBe(true);
        expect(Str.startsWith("proof shadow report")(String(lines[0]))).toBe(true);
        const decoded = yield* ProofShadowReportJson.decode(String(lines[1]));
        expect(decoded).toMatchObject({ shadowRows: 1, attempts: 1, branches: 1, enforcementReady: false });
      })
    ).pipe(provideScopedLayer(Layer.mergeAll(PlatformLayer, TestConsole.layer)))
  );
});

// C5 (ruling 69): the attempt's changed package set is the branch's own diff against its
// base unioned with one working-tree snapshot, mapped onto workspaces. Both git reads run
// through the injected capture, so these fixtures script them.
describe("proof shadow changed packages", () => {
  const context = (repoRoot: string): RepoRunContext =>
    RepoRunContext.make({
      base: "origin/main",
      branch: "feat/tripwire",
      cwd: repoRoot,
      head: "HEAD",
      originalArgv: [],
      packetDir: ".beep/yeet",
      repoRoot,
      turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
    });

  type GitAnswer = {
    readonly exitCode?: number;
    readonly output: string;
    readonly truncated?: boolean;
  };

  const gitStub = (diff: GitAnswer, status: GitAnswer) =>
    Effect.fn("ProofShadowTest.gitStub")(function* (command: string, args: ReadonlyArray<string>, cwd: string) {
      expect(command).toBe("git");
      expect(Str.isNonEmpty(cwd)).toBe(true);
      const answer = A.contains(args, "diff") ? diff : status;
      return { exitCode: answer.exitCode ?? 0, output: answer.output, truncated: answer.truncated ?? false };
    });

  // Two workspaces are the smallest repository in which "deepest containing workspace"
  // and "outside every workspace" are both observable.
  // Bun's spawnSync keeps the repository setup synchronous and out of the capture seam the
  // fixture is measuring.
  const runGit = (cwd: string, args: ReadonlyArray<string>) =>
    Effect.sync(() => {
      const result = Bun.spawnSync(["git", ...args], { cwd, stderr: "pipe", stdout: "pipe" });
      if (result.exitCode !== 0) {
        throw new Error(`git ${A.join(args, " ")} failed: ${result.stderr.toString()}`);
      }
    });

  const seedWorkspaces = Effect.fn("ProofShadowTest.seedWorkspaces")(function* (root: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* fs.writeFileString(
      path.join(root, "package.json"),
      '{"name":"tripwire-root","private":true,"workspaces":["packages/*"]}\n'
    );
    for (const name of ["x", "y"]) {
      yield* fs.makeDirectory(path.join(root, "packages", name, "src"), { recursive: true });
      yield* fs.writeFileString(
        path.join(root, "packages", name, "package.json"),
        `{"name":"@beep/${name}","private":true}\n`
      );
    }
  });

  const inTempRoot = Effect.fn("ProofShadowTest.inTempRoot")(function* <Value, Failure, Requirements>(
    use: (root: string) => Effect.Effect<Value, Failure, Requirements>
  ) {
    const fs = yield* FileSystem.FileSystem;
    return yield* Effect.acquireUseRelease(
      // The workspace reader canonicalises every directory it returns, so a temp
      // root reached through a symlinked `TMPDIR` would not compare equal to it.
      fs.makeTempDirectory().pipe(Effect.flatMap((created) => fs.realPath(created))),
      use,
      (root) => Effect.ignore(fs.remove(root, { recursive: true }))
    );
  });

  const inWorkspaceCheckout = Effect.fn("ProofShadowTest.inWorkspaceCheckout")(function* <Value, Failure, Requirements>(
    use: (root: string) => Effect.Effect<Value, Failure, Requirements>
  ) {
    return yield* inTempRoot((root) => Effect.flatMap(seedWorkspaces(root), () => use(root)));
  });

  it("parses porcelain entries, keeping both sides of a rename and paths with spaces", () => {
    expect(
      porcelainChangedPaths(
        " M packages/x/src/a.ts\0R  packages/y/src/new.ts\0packages/x/src/old.ts\0?? packages/y/src/with space.ts\0"
      )
    ).toStrictEqual([
      "packages/x/src/a.ts",
      "packages/y/src/new.ts",
      "packages/x/src/old.ts",
      "packages/y/src/with space.ts",
    ]);
    // A capture that carried a stray line instead of a status entry contributes nothing.
    expect(porcelainChangedPaths("warning: something\0")).toStrictEqual([]);
    expect(porcelainChangedPaths("")).toStrictEqual([]);
  });

  it.effect("unions the committed diff with the working tree and maps both onto workspaces", () =>
    inWorkspaceCheckout((root) =>
      Effect.gen(function* () {
        const changed = yield* changedPackagesForAttempt(
          context(root),
          gitStub(
            { output: "packages/x/src/a.ts\0" },
            {
              output:
                " M packages/x/src/a.ts\0" +
                "R  packages/y/src/new.ts\0packages/x/src/old.ts\0" +
                "?? packages/y/src/untracked.ts\0" +
                "?? packages/y/src/with space.ts\0" +
                "?? README.md\0",
            }
          )
        );
        expect(changed).toMatchObject({ kind: "known", packages: ["@beep/x", "@beep/y"] });
        // Six distinct paths: the diff's one is also the porcelain's first entry.
        expect(changed.kind === "known" ? changed.paths : -1).toBe(6);
        expect(renderProofChangedPackages(changed)).toBe("proof shadow changed packages: @beep/x, @beep/y (6 path(s))");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("reports a clean tree under no workspace as no changed packages", () =>
    inWorkspaceCheckout((root) =>
      Effect.gen(function* () {
        const changed = yield* changedPackagesForAttempt(
          context(root),
          gitStub({ output: "docs/README.md\0" }, { output: "" })
        );
        expect(changed).toMatchObject({ kind: "known", packages: [], paths: 1 });
        expect(renderProofChangedPackages(changed)).toBe("proof shadow changed packages: none (1 path(s))");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("reports a failed or truncated git read as unavailable rather than an empty change", () =>
    inWorkspaceCheckout((root) =>
      Effect.gen(function* () {
        const statusFailed = yield* changedPackagesForAttempt(
          context(root),
          gitStub({ output: "packages/x/src/a.ts\0" }, { exitCode: 128, output: "fatal: not a git repository" })
        );
        expect(statusFailed).toMatchObject({ kind: "unavailable" });
        expect(
          Str.includes("exited with code 128")(statusFailed.kind === "unavailable" ? statusFailed.reason : "")
        ).toBe(true);
        expect(Str.includes("tripwire fails closed")(renderProofChangedPackages(statusFailed))).toBe(true);

        const diffTruncated = yield* changedPackagesForAttempt(
          context(root),
          gitStub({ output: "packages/x/src/a.ts\0", truncated: true }, { output: "" })
        );
        expect(diffTruncated).toMatchObject({ kind: "unavailable" });
        expect(
          Str.includes("more output than the capture bound")(
            diffTruncated.kind === "unavailable" ? diffTruncated.reason : ""
          )
        ).toBe(true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  // Review round 1, CodeRabbit Major: `resolveWorkspaceDirs` canonicalises every
  // directory it returns, so a checkout reached through a symlink used to compare
  // symlinked paths against canonical workspace directories and map nothing —
  // `known []`, a silent fail-open for every lane.
  it.effect("maps a changed path to its package when the checkout is reached through a symlink", () =>
    inTempRoot((base) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const real = path.join(base, "real");
        const link = path.join(base, "link");
        yield* fs.makeDirectory(real, { recursive: true });
        yield* seedWorkspaces(real);
        yield* fs.symlink(real, link);

        const changed = yield* changedPackagesForAttempt(
          context(link),
          gitStub({ output: "packages/x/src/a.ts\0" }, { output: "" })
        );
        expect(changed).toMatchObject({ kind: "known", packages: ["@beep/x"], paths: 1 });
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  // Review round 1, kriegcloud P2: a workspace catalog that read cleanly but names
  // nothing maps every path to nothing, which reads exactly like "nothing changed".
  it.effect("reports an empty workspace list as unavailable rather than no changed packages", () =>
    inTempRoot((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        // A root that declares workspaces but ships none: the read succeeds and is empty.
        yield* fs.writeFileString(
          path.join(root, "package.json"),
          '{"name":"tripwire-root","private":true,"workspaces":["packages/*"]}\n'
        );
        const changed = yield* changedPackagesForAttempt(
          context(root),
          gitStub({ output: "packages/x/src/a.ts\0" }, { output: "" })
        );
        expect(changed).toStrictEqual(
          ProofChangedPackagesUnavailable.make({ kind: "unavailable", reason: "workspace list was empty" })
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  // Review round 1, CodeRabbit Minor: without `-z` git applies `core.quotePath` and a
  // path carrying a space, a quote or a non-ASCII byte comes back C-quoted; without
  // `--no-renames` only the destination of a rename is reported.
  it.effect("reads the committed diff NUL-separated and rename-free, keeping paths verbatim", () =>
    inWorkspaceCheckout((root) =>
      Effect.gen(function* () {
        const invocations = yield* Ref.make(A.empty<ReadonlyArray<string>>());
        const recordingStub = Effect.fn("ProofShadowTest.recordingStub")(function* (
          _command: string,
          args: ReadonlyArray<string>
        ) {
          yield* Ref.update(invocations, A.append(args));
          return {
            exitCode: 0,
            truncated: false,
            output: A.contains(args, "diff") ? "packages/y/src/with space.ts\0packages/x/src/caf\u00e9.ts\0" : "",
          };
        });

        const changed = yield* changedPackagesForAttempt(context(root), recordingStub);
        expect(changed).toMatchObject({ kind: "known", packages: ["@beep/x", "@beep/y"], paths: 2 });

        const diffArgs = pipe(
          yield* Ref.get(invocations),
          A.findFirst((args) => A.contains(args, "diff")),
          O.getOrThrow
        );
        expect(diffArgs).toStrictEqual(["diff", "--name-only", "--no-renames", "-z", "origin/main...HEAD"]);

        // The package set above only observes directory prefixes, so a per-path trim
        // would leave it green. Read the strict reader directly and compare the exact
        // strings, including the leading and trailing spaces that belong to a name.
        const verbatim = yield* readYeetChangedPathsStrict(
          context(root),
          Effect.fn("ProofShadowTest.spacedPaths")(function* () {
            return {
              exitCode: 0,
              truncated: false,
              output: " packages/x/src/leading.ts\0packages/y/src/with space.ts\0packages/x/src/trailing.ts \0",
            };
          })
        );
        expect(verbatim).toStrictEqual([
          " packages/x/src/leading.ts",
          "packages/y/src/with space.ts",
          "packages/x/src/trailing.ts ",
        ]);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  // Review round 2: every other fixture here replaces `runRepoCommandCapture`, so none of
  // them can see what the capture itself does to the bytes. This one drives both readers
  // through the real capture against a real repository. The default capture trims the whole
  // buffer and merges stderr; a NUL is not whitespace, so the leading space of the first
  // `-z` status record — which is how git spells an unstaged-only change, ` M path` — used
  // to be eaten, and that record was then dropped silently while the result still read
  // `known`.
  it.effect("reads real git output through the real capture without losing the first record", () =>
    inTempRoot((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* seedWorkspaces(root);
        const src = path.join(root, "packages", "x", "src");
        yield* fs.writeFileString(path.join(src, "a.ts"), "export const a = 1;\n");
        yield* fs.writeFileString(path.join(src, "renamed from.ts"), "export const b = 2;\n");
        yield* runGit(root, ["init", "--quiet", "--initial-branch=main"]);
        yield* runGit(root, ["config", "user.email", "lane@example.invalid"]);
        yield* runGit(root, ["config", "user.name", "Lane"]);
        yield* runGit(root, ["config", "commit.gpgsign", "false"]);
        yield* runGit(root, ["add", "."]);
        yield* runGit(root, ["commit", "--quiet", "-m", "base"]);
        // The base ref the reader diffs against is this commit.
        yield* runGit(root, ["branch", "--force", "base-ref"]);
        // Committed on top of the base: a rename whose source carries a space.
        yield* runGit(root, ["mv", "packages/x/src/renamed from.ts", "packages/x/src/renamed to.ts"]);
        yield* runGit(root, ["commit", "--quiet", "-m", "rename"]);
        // Left unstaged, so its porcelain record begins with a space.
        yield* fs.writeFileString(path.join(src, "a.ts"), "export const a = 2;\n");

        const changed = yield* changedPackagesForAttempt(
          RepoRunContext.make({
            base: "base-ref",
            branch: "feat/transport",
            cwd: root,
            head: "HEAD",
            originalArgv: [],
            packetDir: ".beep/yeet",
            repoRoot: root,
            turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
          })
        );

        // The unstaged `a.ts` plus both sides of the rename, deduped: three paths, one package.
        expect(changed).toStrictEqual(
          ProofChangedPackagesKnown.make({ kind: "known", packages: ["@beep/x"], paths: 3 })
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("reports an unreadable workspace list as unavailable", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "tripwire-no-root-" });
      const changed = yield* changedPackagesForAttempt(context(root), gitStub({ output: "" }, { output: "" }));
      expect(changed).toMatchObject({ kind: "unavailable" });
      expect(Str.includes("workspace list")(changed.kind === "unavailable" ? changed.reason : "")).toBe(true);
    }).pipe(provideScopedLayer(NodeServices.layer))
  );
});
