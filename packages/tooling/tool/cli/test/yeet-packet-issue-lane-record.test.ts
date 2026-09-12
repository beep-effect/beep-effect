import { QualityTaskLaneRun, QualityTaskLaneRunReport } from "@beep/repo-cli/test/Quality";
import {
  artifactDirForContext,
  failWithIssueArtifacts,
  firstRedLaneRun,
  INNER_LANE_REPORT_FILE_NAME,
  laneRunsForWrapper,
  QualityIssueIndex,
  qualityIssuesFromStepResult,
  RepoPlanStep,
  RepoRunContext,
  RepoStepRunResult,
  runArtifactPathForContext,
  TurboPlanSnapshot,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { QualityIssue } from "@beep/repo-cli/test/Yeet";

const OSV_HINT = "Inspect the OSV finding and rerun `bun run beep quality github-checks security`.";
const CHANGESET_HINT_PREFIX = "Run `bun run beep quality changeset-status --since origin/main`.";
const GOALS_INDEX_HINT = "Run `bun run beep goals index`, inspect the update, then rerun the cheap-gates tier.";
const TYPOS_HINT =
  "Run the typos checker on the flagged files and fix the spelling, or whitelist intentional terms in `_typos.toml`.";

const contextForRoot = (repoRoot: string): RepoRunContext =>
  RepoRunContext.make({
    repoRoot,
    cwd: repoRoot,
    base: "origin/main",
    head: "HEAD",
    branch: "feat/record-first-packet",
    packetDir: ".beep/yeet",
    originalArgv: [],
    turbo: TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], packages: [], tasks: [] }),
  });

const context = contextForRoot("/repo");

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

const reportFor = (parentLaneId: string, lanes: ReadonlyArray<QualityTaskLaneRun>): QualityTaskLaneRunReport =>
  QualityTaskLaneRunReport.make({
    schemaVersion: "quality-task-lane-run/v1",
    parentLaneId: O.some(parentLaneId),
    lanes,
  });

const resultFor = (step: RepoPlanStep, output: string, exitCode = 1): RepoStepRunResult =>
  RepoStepRunResult.make({
    stepId: step.id,
    commandText: "bun run beep quality github-checks pre-push",
    exitCode,
    output,
  });

const onlyIssue = (issues: ReadonlyArray<QualityIssue>): QualityIssue => {
  expect(issues).toHaveLength(1);
  return O.getOrThrowWith(A.head(issues), () => new Error("expected one raw issue"));
};

const rawIssue = (step: RepoPlanStep, output: string, lanes: ReadonlyArray<QualityTaskLaneRun>): QualityIssue =>
  onlyIssue(qualityIssuesFromStepResult(context, step, resultFor(step, output), lanes));

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

const fullProofLanes: ReadonlyArray<QualityTaskLaneRun> = [
  laneRun("quality:security", "passed", O.some("bun run beep quality github-checks security")),
  laneRun("quality:coverage", "failed", O.some("bun run beep ci lane coverage")),
  laneRun("quality:docgen", "not-run-early-stop", O.some("bun run beep ci lane docgen")),
];

// Concurrent cheap tier: changeset-status launches last, so its marker is the
// latest needle inside the first failure-looking window, while goals:index-check
// is the lane that actually went red.
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

const cheapGatesLanes: ReadonlyArray<QualityTaskLaneRun> = [
  laneRun("lint:effect-imports", "passed", O.some("bun run beep laws effect-imports --check")),
  laneRun("quality:changeset-status", "passed", O.some("bun run changeset:status:since-main")),
  laneRun("goals:index-check", "failed", O.some("bun run beep goals index --check")),
];

describe("yeet packet issue lane record", () => {
  it("documents the whole-output scan trap for wrappers without a lane-run record", () => {
    expect(rawIssue(fullProofStep, fullProofOutput, [])).toMatchObject({
      category: "security-audit",
      subCategory: "security",
      message: "full:pre-push failed in security with exit code 1.",
      remediation: OSV_HINT,
    });
    const cheap = rawIssue(cheapGatesStep, cheapGatesOutput, []);
    expect(cheap).toMatchObject({ category: "changeset-policy", subCategory: "changeset-status" });
    expect(cheap.remediation).toContain(CHANGESET_HINT_PREFIX);
  });

  it("names the red coverage lane instead of the passing OSV marker", () => {
    const issue = rawIssue(fullProofStep, fullProofOutput, fullProofLanes);

    expect(issue).toMatchObject({
      category: "command-failure",
      subCategory: "quality:coverage",
      message: "full:pre-push failed in quality:coverage with exit code 1.",
      remediation: "bun run beep ci lane coverage",
      confidence: "raw",
      label: "full:pre-push",
    });
    expect(A.map(issue.routing, (route) => route.skill)).toEqual(["quality-review-fix-loop"]);
  });

  it("gives the cheap-gates issue the red goals index hint while changeset-status passed", () => {
    expect(rawIssue(cheapGatesStep, cheapGatesOutput, cheapGatesLanes)).toMatchObject({
      category: "repo-law",
      subCategory: "goals-index",
      message: "full:cheap-gates failed in goals-index with exit code 1.",
      remediation: GOALS_INDEX_HINT,
    });
  });

  it("keeps a marker found inside the red lane's own segment", () => {
    const output = [
      "[beep-cli] pre-push: running lane quality:security",
      "[beep-cli] quality:security: bun run beep quality github-checks security",
      "[beep-cli] security:osv-scan: docker run --rm ghcr.io/google/osv-scanner:latest",
      "No vulnerabilities found (checked 2309 packages, 2 ignored)",
      "[beep-cli] quality:security: ok in 4200ms",
      "[beep-cli] pre-push: running lane quality:lint-policy",
      "[beep-cli] quality:lint-policy: bun run beep ci lane lint-policy",
      "[beep-cli] lint:typos: typos",
      "error: misspelling found in docs/README.md",
      "[beep-cli] lint:typos: failed in 12ms",
      "[beep-cli] quality:lint-policy: failed in 40ms",
      "[beep-cli] pre-push: first red quality:lint-policy; skipped 2 lane(s) after red",
    ].join("\n");

    expect(
      rawIssue(fullProofStep, output, [
        laneRun("quality:security", "passed", O.some("bun run beep quality github-checks security")),
        laneRun("quality:lint-policy", "failed", O.some("bun run beep ci lane lint-policy")),
      ])
    ).toMatchObject({
      category: "lint-tool",
      subCategory: "typos",
      message: "full:pre-push failed in typos with exit code 1.",
      remediation: TYPOS_HINT,
    });
  });

  it("classifies a red lane by its own label when no catalog hint applies", () => {
    const output = [
      "[beep-cli] quality:security: bun run beep quality github-checks security",
      "[beep-cli] security:osv-scan: docker run --rm ghcr.io/google/osv-scanner:latest",
      "[beep-cli] quality:security: ok in 4200ms",
      "[beep-cli] quality:test: bun run beep ci lane test",
      "FAIL packages/acp/test/protocol.test.ts",
      "[beep-cli] quality:test: failed in 3000ms",
    ].join("\n");

    expect(
      rawIssue(fullProofStep, output, [
        laneRun("quality:security", "passed", O.some("bun run beep quality github-checks security")),
        laneRun("quality:test", "failed", O.some("bun run beep ci lane test")),
      ])
    ).toMatchObject({
      category: "test",
      subCategory: "quality:test",
      message: "full:pre-push failed in quality:test with exit code 1.",
      remediation: "bun run beep ci lane test",
    });
  });

  it("follows the first red lane in record order when several lanes failed", () => {
    expect(
      rawIssue(fullProofStep, "", [
        laneRun("quality:check", "failed", O.some("bun run beep ci lane check")),
        laneRun("quality:coverage", "failed", O.some("bun run beep ci lane coverage")),
      ])
    ).toMatchObject({
      subCategory: "quality:check",
      message: "full:pre-push failed in quality:check with exit code 1.",
      remediation: "bun run beep ci lane check",
    });
  });

  it("leaves a red lane without a hint or command as a bare lane attribution", () => {
    const issue = rawIssue(fullProofStep, fullProofOutput, [laneRun("quality:coverage", "failed")]);

    expect(issue).toMatchObject({
      category: "command-failure",
      subCategory: "quality:coverage",
      message: "full:pre-push failed in quality:coverage with exit code 1.",
    });
    expect(issue.remediation).toBeUndefined();
  });

  // Parity with the verdict: a record that names no red lane means the wrapper
  // failed outside its lanes, and the whole-output scan is the only signal left.
  it("falls back to the whole-output scan when the record names no red lane", () => {
    expect(
      rawIssue(fullProofStep, fullProofOutput, [
        laneRun("quality:security", "passed", O.some("bun run beep quality github-checks security")),
        laneRun("quality:coverage", "passed", O.some("bun run beep ci lane coverage")),
      ])
    ).toMatchObject({ category: "security-audit", subCategory: "security", remediation: OSV_HINT });
  });

  it("produces no issues for a passing wrapper even when the record has a red lane", () => {
    expect(
      qualityIssuesFromStepResult(context, fullProofStep, resultFor(fullProofStep, "", 0), fullProofLanes)
    ).toEqual([]);
  });
});

describe("inner-lane report selectors", () => {
  it("selects only the wrapper's own lanes, in append order across reports", () => {
    const reports = [
      reportFor("full:other", [laneRun("security:osv-scan", "failed")]),
      reportFor(fullProofStep.id, [laneRun("quality:security", "passed")]),
      reportFor(fullProofStep.id, [laneRun("quality:coverage", "failed")]),
    ];

    expect(A.map(laneRunsForWrapper(reports, fullProofStep.id), (lane) => lane.id)).toEqual([
      "quality:security",
      "quality:coverage",
    ]);
    expect(laneRunsForWrapper(reports, "full:unknown")).toEqual([]);
  });

  it("finds the first red lane and none when every lane passed", () => {
    expect(O.map(firstRedLaneRun(fullProofLanes), (lane) => lane.id)).toEqual(O.some("quality:coverage"));
    expect(O.isNone(firstRedLaneRun([laneRun("quality:security", "passed")]))).toBe(true);
  });
});

const encodeReport = S.encodeEffect(S.fromJsonString(QualityTaskLaneRunReport));
const decodeIndex = S.decodeEffect(S.fromJsonString(QualityIssueIndex));

const withTempRepo = <Result, Error, Requirements>(
  use: (repoRoot: string) => Effect.Effect<Result, Error, Requirements>
) =>
  Effect.acquireUseRelease(
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory()),
    use,
    (repoRoot) =>
      Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(repoRoot, { recursive: true }).pipe(Effect.orDie))
  ).pipe(provideScopedLayer(NodeServices.layer));

const readIssueIndex = (repoContext: RepoRunContext) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const artifactDir = yield* artifactDirForContext(repoContext);
    const index = yield* fs
      .readFileString(path.join(artifactDir, "quality-issue-index.json"))
      .pipe(Effect.flatMap(decodeIndex));
    return { artifactDir, index };
  });

describe("failWithIssueArtifacts", () => {
  it.effect("threads the run's durable lane-run record into the failure packet", () =>
    withTempRepo((repoRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoContext = contextForRoot(repoRoot);
        const reportPath = yield* runArtifactPathForContext(repoContext, INNER_LANE_REPORT_FILE_NAME);
        yield* fs.makeDirectory(path.dirname(reportPath), { recursive: true });
        const lines = yield* Effect.forEach(
          [
            reportFor(fullProofStep.id, A.take(fullProofLanes, 1)),
            // A red OSV lane recorded under a different wrapper must not leak in.
            reportFor("full:other", [laneRun("security:osv-scan", "failed", O.some("docker run osv-scanner"))]),
            reportFor(fullProofStep.id, A.drop(fullProofLanes, 1)),
          ],
          encodeReport
        );
        yield* fs.writeFileString(reportPath, `${A.join(lines, "\n")}\n`);

        const error = yield* failWithIssueArtifacts(
          repoContext,
          [fullProofStep],
          [resultFor(fullProofStep, fullProofOutput)],
          "yeet verification proof failed."
        ).pipe(Effect.flip);
        expect(error.exitCode).toBe(1);
        expect(error.command).toBe("bun run beep quality github-checks pre-push");

        const { artifactDir, index } = yield* readIssueIndex(repoContext);
        expect(onlyIssue(index.issues)).toMatchObject({
          category: "command-failure",
          subCategory: "quality:coverage",
          message: "full:pre-push failed in quality:coverage with exit code 1.",
          remediation: "bun run beep ci lane coverage",
        });

        const packetFiles = yield* fs.readDirectory(path.join(artifactDir, "packets"));
        expect(packetFiles).toHaveLength(1);
        const packet = yield* fs.readFileString(path.join(artifactDir, "packets", ...A.take(packetFiles, 1)));
        expect(packet).toContain("bun run beep ci lane coverage");
        expect(packet).not.toContain(OSV_HINT);
      })
    )
  );

  it.effect("keeps the whole-output scan for runs that recorded no lane-run report", () =>
    withTempRepo((repoRoot) =>
      Effect.gen(function* () {
        const repoContext = contextForRoot(repoRoot);
        yield* failWithIssueArtifacts(
          repoContext,
          [fullProofStep],
          [resultFor(fullProofStep, fullProofOutput)],
          "yeet verification proof failed."
        ).pipe(Effect.flip);

        const { index } = yield* readIssueIndex(repoContext);
        expect(onlyIssue(index.issues)).toMatchObject({ subCategory: "security", remediation: OSV_HINT });
      })
    )
  );
});
