import { QualityTaskLaneRun, QualityTaskLaneRunReport } from "@beep/repo-cli/test/Quality";
import {
  artifactDirForContext,
  BuildYeetVerdictInput,
  buildYeetVerdictForTesting,
  failWithIssueArtifacts,
  INNER_LANE_REPORT_FILE_NAME,
  knownSubLaneHintForFirstRedLane,
  knownSubLaneRemediationForLaneId,
  knownSubLaneRemediationFromLaneOutput,
  knownSubLaneRemediationFromOutput,
  laneOutputSegment,
  laneRunsForWrapper,
  QualityIssueIndex,
  qualityIssuesFromStepResult,
  RepoPlanStep,
  RepoRunContext,
  RepoStepRunResult,
  runArtifactPathForContext,
  TurboPlanSnapshot,
  YeetCommandError,
  YeetExecutedStep,
} from "@beep/repo-cli/test/Yeet";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { YeetVerdict, YeetVerdictLane } from "@beep/repo-cli/test/Yeet";

const OSV_HINT = "Inspect the OSV finding and rerun `bun run beep quality github-checks security`.";
const CHANGESET_HINT_PREFIX = "Run `bun run beep quality changeset-status --since origin/main`.";
const GOALS_INDEX_HINT = "Run `bun run beep goals index`, inspect the update, then rerun the cheap-gates tier.";
const TYPOS_HINT =
  "Run the typos checker on the flagged files and fix the spelling, or whitelist intentional terms in `_typos.toml`.";

const wrapperStep = (id: string, label: string, tier: string): RepoPlanStep =>
  RepoPlanStep.make({
    id,
    label,
    phase: "full",
    command: "bun",
    args: ["run", "beep", "quality", "github-checks", tier],
    cwd: "/repo",
    scope: "repo",
    mutability: "readonly",
    resume: "never",
  });

const laneRun = (
  id: string,
  status: QualityTaskLaneRun["status"],
  commandText: O.Option<string> = O.none()
): QualityTaskLaneRun =>
  QualityTaskLaneRun.make({
    id,
    label: id,
    status,
    inputDigest: O.none(),
    commandText,
  });

const buildVerdict = (
  step: RepoPlanStep,
  output: string,
  lanes: ReadonlyArray<QualityTaskLaneRun>,
  exitCode = 1
): YeetVerdict =>
  buildYeetVerdictForTesting(
    BuildYeetVerdictInput.make({
      base: "origin/main",
      branch: "feat/effect-vitest-grouped-report",
      createdAt: "2026-09-12T00:00:00.000Z",
      executed: [
        YeetExecutedStep.make({
          result: RepoStepRunResult.make({
            stepId: step.id,
            commandText: "bun run beep quality github-checks pre-push",
            exitCode,
            output,
          }),
          step,
        }),
      ],
      innerLaneReports: A.isReadonlyArrayEmpty(lanes)
        ? []
        : [
            QualityTaskLaneRunReport.make({
              schemaVersion: "quality-task-lane-run/v1",
              parentLaneId: O.some(step.id),
              lanes,
            }),
          ],
      head: "HEAD",
      message: exitCode === 0 ? "yeet verification proof passed." : "yeet verification proof failed.",
      mode: "verify",
      outcome: exitCode === 0 ? "success" : "failure",
      packetPaths: [],
      planned: [step],
      proofTier: O.some("full"),
      runId: "feat/effect-vitest-grouped-report",
    })
  );

const laneById = (verdict: YeetVerdict, id: string): YeetVerdictLane =>
  O.getOrThrowWith(
    A.findFirst(verdict.lanes, (lane) => lane.id === id),
    () => new Error(`verdict has no lane ${id}`)
  );

const fullProofStep = wrapperStep("full:01-pre-push", "full:pre-push", "pre-push");
const cheapGatesStep = wrapperStep("full:00-cheap-gates", "full:cheap-gates", "cheap-gates");

// Sequential pre-push tier: the OSV lane passes and prints its marker, then
// coverage fails on a property flake. The whole-output scan used to pick OSV.
const fullProofOutput = [
  "[beep-cli] pre-push: running lane quality:security",
  "[beep-cli] quality:security: bun run beep quality github-checks security",
  "[github-checks] security: osv scan",
  "[beep-cli] security:osv-scan: docker run --rm ghcr.io/google/osv-scanner:latest --lockfile bun.lock",
  "No vulnerabilities found (checked 2309 packages, 2 ignored)",
  "[beep-cli] quality:security: ok in 4200ms",
  "[beep-cli] pre-push: running lane quality:coverage",
  "[beep-cli] quality:coverage: bun run beep ci lane coverage",
  "FAIL packages/acp/test/protocol.test.ts > round-trips every request",
  "Error: Property failed after 12 tests",
  "[beep-cli] quality:coverage: failed in 91000ms",
  "[beep-cli] pre-push: first red quality:coverage; skipped 1 lane(s) after red",
  '[beep-quality-task-lane-run] {"schemaVersion":"quality-task-lane-run/v1","lanes":[]}',
].join("\n");

// Concurrent cheap tier: changeset-status launches last, so its marker is the
// latest needle inside the first failure-looking window (a benign "0 errors"
// line), while goals:index-check is the lane that actually went red.
const cheapGatesOutput = [
  "[beep-cli] cheap-gates: running lane goals:index-check",
  "[beep-cli] cheap-gates: running lane lint:effect-imports",
  "[beep-cli] cheap-gates: running lane quality:changeset-status",
  "[beep-cli] goals:index-check: bun run beep goals index --check",
  "[beep-cli] lint:effect-imports: bun run beep laws effect-imports --check",
  "[beep-cli] quality:changeset-status: bun run changeset:status:since-main",
  "effect-imports: 0 errors in 412 files",
  "[beep-cli] lint:effect-imports: ok in 300ms",
  "🦋  info Changesets cover every changed package.",
  "[beep-cli] quality:changeset-status: ok in 900ms",
  "local goals/INDEX.md drifts from goals/*/ops/manifest.json; run bun run beep goals index --write",
  "[beep-cli] goals:index-check: failed in 1200ms",
  "[beep-cli] cheap-gates: first red goals:index-check; skipped 0 lane(s) after red",
  "[beep-cli] cheap-gates: failed 1 step(s)",
  "[beep-cli]   goals:index-check: exit 1",
  "[beep-cli]     command: bun run beep goals index --check",
].join("\n");

describe("yeet verdict lane repair commands", () => {
  it("documents the whole-output scan trap the lane-run record replaces", () => {
    expect(O.getOrUndefined(knownSubLaneRemediationFromOutput(fullProofOutput))).toBe(OSV_HINT);
    expect(O.getOrUndefined(knownSubLaneRemediationFromOutput(cheapGatesOutput))).toContain(CHANGESET_HINT_PREFIX);
  });

  it("gives the tier lane and the red coverage lane coverage's own command instead of the passing OSV marker", () => {
    const verdict = buildVerdict(fullProofStep, fullProofOutput, [
      laneRun("quality:security", "passed", O.some("bun run beep quality github-checks security")),
      laneRun("quality:coverage", "failed", O.some("bun run beep ci lane coverage")),
      laneRun("quality:docgen", "not-run-early-stop", O.some("bun run beep ci lane docgen")),
    ]);

    expect(laneById(verdict, fullProofStep.id)).toMatchObject({
      status: "failed",
      repairCommand: "bun run beep ci lane coverage",
    });
    expect(laneById(verdict, "quality:coverage")).toMatchObject({
      status: "failed",
      repairCommand: "bun run beep ci lane coverage",
    });
    expect(laneById(verdict, "quality:security").repairCommand).toBeUndefined();
    expect(laneById(verdict, "quality:docgen").repairCommand).toBeUndefined();
  });

  it("gives the cheap-gates tier lane the red goals index hint while changeset-status passed", () => {
    const verdict = buildVerdict(cheapGatesStep, cheapGatesOutput, [
      laneRun("lint:effect-imports", "passed", O.some("bun run beep laws effect-imports --check")),
      laneRun("quality:changeset-status", "passed", O.some("bun run changeset:status:since-main")),
      laneRun("goals:index-check", "failed", O.some("bun run beep goals index --check")),
    ]);

    expect(laneById(verdict, cheapGatesStep.id).repairCommand).toBe(GOALS_INDEX_HINT);
    expect(laneById(verdict, "goals:index-check").repairCommand).toBe(GOALS_INDEX_HINT);
    expect(laneById(verdict, "quality:changeset-status").repairCommand).toBeUndefined();
    expect(laneById(verdict, "lint:effect-imports").repairCommand).toBeUndefined();
  });

  it("keeps a sub-lane marker found inside the red lane's own segment over its launch command", () => {
    const output = [
      "[beep-cli] pre-push: running lane quality:security",
      "[beep-cli] quality:security: bun run beep quality github-checks security",
      "[beep-cli] security:osv-scan: docker run --rm ghcr.io/google/osv-scanner:latest",
      "No vulnerabilities found (checked 2309 packages, 2 ignored)",
      "[beep-cli] quality:security: ok in 4200ms",
      "[beep-cli] pre-push: running lane quality:lint-policy",
      "[beep-cli] quality:lint-policy: bun run beep ci lane lint-policy",
      "[beep-cli] lint:typos: typos",
      "error: misspelling found in packages/acp/README.md",
      "[beep-cli] lint:typos: failed in 12ms",
      "[beep-cli] quality:lint-policy: failed in 40ms",
      "[beep-cli] pre-push: first red quality:lint-policy; skipped 2 lane(s) after red",
    ].join("\n");
    const verdict = buildVerdict(fullProofStep, output, [
      laneRun("quality:security", "passed", O.some("bun run beep quality github-checks security")),
      laneRun("quality:lint-policy", "failed", O.some("bun run beep ci lane lint-policy")),
    ]);

    expect(laneById(verdict, fullProofStep.id).repairCommand).toBe(TYPOS_HINT);
    expect(laneById(verdict, "quality:lint-policy").repairCommand).toBe(TYPOS_HINT);
  });

  it("follows the first red lane in record order when several lanes failed", () => {
    const verdict = buildVerdict(fullProofStep, "", [
      laneRun("quality:check", "failed", O.some("bun run beep ci lane check")),
      laneRun("quality:coverage", "failed", O.some("bun run beep ci lane coverage")),
    ]);

    expect(laneById(verdict, fullProofStep.id).repairCommand).toBe("bun run beep ci lane check");
    expect(laneById(verdict, "quality:check").repairCommand).toBe("bun run beep ci lane check");
    expect(laneById(verdict, "quality:coverage").repairCommand).toBe("bun run beep ci lane coverage");
  });

  it("keeps the whole-output scan and wrapper command fallbacks for wrappers without a lane-run record", () => {
    const withMarker = buildVerdict(fullProofStep, "[beep-cli] lint:typos: typos\nerror: misspelling found", []);
    const withoutMarker = buildVerdict(fullProofStep, "segmentation fault", []);

    expect(laneById(withMarker, fullProofStep.id).repairCommand).toBe(TYPOS_HINT);
    expect(laneById(withoutMarker, fullProofStep.id).repairCommand).toBe("bun run beep quality github-checks pre-push");
    expect(withMarker.lanes).toHaveLength(1);
  });

  it("leaves passing wrappers and lanes without repair commands", () => {
    const verdict = buildVerdict(
      fullProofStep,
      fullProofOutput,
      [laneRun("quality:security", "passed", O.some("bun run beep quality github-checks security"))],
      0
    );

    expect(laneById(verdict, fullProofStep.id).repairCommand).toBeUndefined();
    expect(laneById(verdict, "quality:security").repairCommand).toBeUndefined();
  });
});

describe("lane-run hint helpers", () => {
  it("matches catalog hints by exact lane id only", () => {
    expect(O.getOrUndefined(knownSubLaneRemediationForLaneId("goals:index-check"))).toBe(GOALS_INDEX_HINT);
    assertNone(knownSubLaneRemediationForLaneId("quality:coverage"));
    assertNone(knownSubLaneRemediationForLaneId("repo-sanity:changeset-graph"));
  });

  it("slices one lane's segment between its launch line and its outcome line", () => {
    const siblings = HashSet.make("quality:security", "quality:coverage");
    const segment = O.getOrUndefined(laneOutputSegment(fullProofOutput, "quality:coverage", siblings));

    expect(segment).toBe(
      [
        "[beep-cli] quality:coverage: bun run beep ci lane coverage",
        "FAIL packages/acp/test/protocol.test.ts > round-trips every request",
        "Error: Property failed after 12 tests",
        "[beep-cli] quality:coverage: failed in 91000ms",
      ].join("\n")
    );
    expect(O.getOrUndefined(laneOutputSegment(fullProofOutput, "quality:security", siblings))).toBe(
      [
        "[beep-cli] quality:security: bun run beep quality github-checks security",
        "[github-checks] security: osv scan",
        "[beep-cli] security:osv-scan: docker run --rm ghcr.io/google/osv-scanner:latest --lockfile bun.lock",
        "No vulnerabilities found (checked 2309 packages, 2 ignored)",
        "[beep-cli] quality:security: ok in 4200ms",
      ].join("\n")
    );
    assertNone(laneOutputSegment(fullProofOutput, "quality:docgen", siblings));
  });

  it("cuts a segment at a sibling launch line when the lane never printed an outcome", () => {
    const output = [
      "[beep-cli] goals:index-check: bun run beep goals index --check",
      "local goals/INDEX.md drifts from goals/*/ops/manifest.json",
      "[beep-cli] quality:changeset-status: bun run changeset:status:since-main",
      "🦋  info Changesets cover every changed package.",
    ].join("\n");
    const siblings = HashSet.make("goals:index-check", "quality:changeset-status");

    expect(O.getOrUndefined(laneOutputSegment(output, "goals:index-check", siblings))).toBe(
      [
        "[beep-cli] goals:index-check: bun run beep goals index --check",
        "local goals/INDEX.md drifts from goals/*/ops/manifest.json",
      ].join("\n")
    );
  });

  it("scans only tagged lines inside the lane segment for markers", () => {
    const siblings = HashSet.make("quality:security", "quality:coverage");
    const unixNoise = [
      "[beep-cli] quality:coverage: bun run beep ci lane coverage",
      "Error: spawn failed on unix socket /tmp/docgen.sock",
      "[beep-cli] quality:coverage: failed in 91000ms",
    ].join("\n");

    assertNone(knownSubLaneRemediationFromLaneOutput(fullProofOutput, "quality:coverage", siblings));
    assertNone(knownSubLaneRemediationFromLaneOutput(unixNoise, "quality:coverage", siblings));
    expect(O.getOrUndefined(knownSubLaneRemediationFromLaneOutput(fullProofOutput, "quality:security", siblings))).toBe(
      OSV_HINT
    );
  });
});

const runContext = RepoRunContext.make({
  repoRoot: "/repo",
  cwd: "/repo",
  base: "origin/main",
  head: "HEAD",
  branch: "feat/effect-vitest-grouped-report",
  packetDir: ".beep/yeet",
  originalArgv: [],
  turbo: TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], packages: [], tasks: [] }),
});

const stepResult = (step: RepoPlanStep, output: string): RepoStepRunResult =>
  RepoStepRunResult.make({
    stepId: step.id,
    commandText: "bun run beep quality github-checks pre-push",
    exitCode: 1,
    output,
  });

const reportFor = (wrapperLaneId: string, lanes: ReadonlyArray<QualityTaskLaneRun>): QualityTaskLaneRunReport =>
  QualityTaskLaneRunReport.make({
    schemaVersion: "quality-task-lane-run/v1",
    parentLaneId: O.some(wrapperLaneId),
    lanes,
  });

const fullProofLanes: ReadonlyArray<QualityTaskLaneRun> = [
  laneRun("quality:security", "passed", O.some("bun run beep quality github-checks security")),
  laneRun("quality:coverage", "failed", O.some("bun run beep ci lane coverage")),
  laneRun("quality:docgen", "not-run-early-stop", O.some("bun run beep ci lane docgen")),
];

const cheapGatesLanes: ReadonlyArray<QualityTaskLaneRun> = [
  laneRun("lint:effect-imports", "passed", O.some("bun run beep laws effect-imports --check")),
  laneRun("quality:changeset-status", "passed", O.some("bun run changeset:status:since-main")),
  laneRun("goals:index-check", "failed", O.some("bun run beep goals index --check")),
];

describe("failure packet issues", () => {
  it("classifies the raw pre-push failure by the red coverage lane, not the passing OSV marker", () => {
    const issues = qualityIssuesFromStepResult(
      runContext,
      fullProofStep,
      stepResult(fullProofStep, fullProofOutput),
      fullProofLanes
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      category: "test",
      subCategory: "quality:coverage",
      remediation: "bun run beep ci lane coverage",
      message: "full:pre-push failed in quality:coverage with exit code 1.",
    });
  });

  it("classifies the raw cheap-gates failure by the red goals index gate", () => {
    const issues = qualityIssuesFromStepResult(
      runContext,
      cheapGatesStep,
      stepResult(cheapGatesStep, cheapGatesOutput),
      cheapGatesLanes
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      category: "repo-law",
      subCategory: "goals-index",
      remediation: GOALS_INDEX_HINT,
      message: "full:cheap-gates failed in goals-index with exit code 1.",
    });
  });

  it("keeps the whole-output scan when the wrapper recorded no lanes", () => {
    const issues = qualityIssuesFromStepResult(runContext, fullProofStep, stepResult(fullProofStep, fullProofOutput));

    expect(issues[0]).toMatchObject({ category: "security-audit", subCategory: "security", remediation: OSV_HINT });
  });

  it("accepts the data-last form with recorded lanes", () => {
    const dataLast = qualityIssuesFromStepResult(
      cheapGatesStep,
      stepResult(cheapGatesStep, cheapGatesOutput),
      cheapGatesLanes
    )(runContext);
    const dataFirst = qualityIssuesFromStepResult(
      runContext,
      cheapGatesStep,
      stepResult(cheapGatesStep, cheapGatesOutput),
      cheapGatesLanes
    );

    expect(dataLast).toStrictEqual(dataFirst);
  });
});

describe("inner-lane reports", () => {
  it("selects the lane runs recorded under one wrapper", () => {
    const reports = [reportFor(fullProofStep.id, fullProofLanes), reportFor(cheapGatesStep.id, cheapGatesLanes)];

    expect(A.map(laneRunsForWrapper(reports, cheapGatesStep.id), (lane) => lane.id)).toStrictEqual([
      "lint:effect-imports",
      "quality:changeset-status",
      "goals:index-check",
    ]);
    expect(A.isReadonlyArrayEmpty(laneRunsForWrapper(reports, "full:99-unknown"))).toBe(true);
  });

  it("resolves the first red lane's hint from the record", () => {
    const hint = knownSubLaneHintForFirstRedLane(fullProofLanes, fullProofOutput);

    assertSome(
      O.map(hint, (value) => value.subCategory),
      "quality:coverage"
    );
    assertNone(knownSubLaneHintForFirstRedLane([], fullProofOutput));
  });
});

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const encodeLaneRunReport = S.encodeSync(S.fromJsonString(QualityTaskLaneRunReport));
const decodeIssueIndex = S.decodeSync(S.fromJsonString(QualityIssueIndex));

it.layer(PlatformLayer, { timeout: "30 seconds" })("failure packets on disk", (it) => {
  it.effect("writes the red lane's remediation into the issue index from the recorded side channel", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = yield* fs.makeTempDirectoryScoped();
      const context = RepoRunContext.make({ ...runContext, repoRoot: tmpDir, cwd: tmpDir });
      const reportPath = yield* runArtifactPathForContext(context, INNER_LANE_REPORT_FILE_NAME);
      yield* fs.makeDirectory(path.dirname(reportPath), { recursive: true });
      yield* fs.writeFileString(reportPath, `${encodeLaneRunReport(reportFor(fullProofStep.id, fullProofLanes))}\n`);

      const error = yield* Effect.flip(
        failWithIssueArtifacts(
          context,
          [fullProofStep],
          [stepResult(fullProofStep, fullProofOutput)],
          "yeet verification proof failed."
        )
      );
      assertInstanceOf(error, YeetCommandError);

      const indexPath = path.join(yield* artifactDirForContext(context), "quality-issue-index.json");
      const index = decodeIssueIndex(yield* fs.readFileString(indexPath));
      expect(index.issues).toHaveLength(1);
      expect(index.issues[0]).toMatchObject({
        subCategory: "quality:coverage",
        remediation: "bun run beep ci lane coverage",
      });
    })
  );
});
