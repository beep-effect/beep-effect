import { QualityTaskLaneRun, QualityTaskLaneRunReport } from "@beep/repo-cli/test/Quality";
import {
  BuildYeetVerdictInput,
  buildYeetVerdictForTesting,
  knownSubLaneRemediationForLaneId,
  knownSubLaneRemediationFromLaneOutput,
  knownSubLaneRemediationFromOutput,
  laneOutputSegment,
  RepoPlanStep,
  RepoStepRunResult,
  YeetExecutedStep,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
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

// Concurrent pre-push tier: security launches first, lint-policy launches
// second, security finishes after lint-policy launched, and only then does
// lint-policy print its typos marker and fail. A sibling outcome line used to
// end lint-policy's segment before the marker.
const concurrentTypoOutput = [
  "[beep-cli] pre-push: running lane quality:security",
  "[beep-cli] pre-push: running lane quality:lint-policy",
  "[beep-cli] quality:security: bun run beep quality github-checks security",
  "[beep-cli] quality:lint-policy: bun run beep ci lane lint-policy",
  "No vulnerabilities found (checked 2309 packages, 2 ignored)",
  "[beep-cli] quality:security: ok in 4200ms",
  "[beep-cli] lint:typos: typos",
  "error: misspelling found in docs/README.md",
  "[beep-cli] lint:typos: failed in 12ms",
  "[beep-cli] quality:lint-policy: failed in 40ms",
  "[beep-cli] pre-push: first red quality:lint-policy; skipped 0 lane(s) after red",
].join("\n");

describe("yeet verdict lane repair commands", () => {
  it("documents the whole-output scan trap the lane-run record replaces", () => {
    assertSome(knownSubLaneRemediationFromOutput(fullProofOutput), OSV_HINT);
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
      "error: misspelling found in docs/README.md",
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

  it("gives the tier lane the wrapper's own command when the red lane carries no repair command", () => {
    // `commandText` is optional in `quality-task-lane-run/v1`. A red lane with
    // neither a catalog hint nor a launch command must not send the tier lane
    // back to the whole-output scan, where the passing OSV marker wins.
    const verdict = buildVerdict(fullProofStep, fullProofOutput, [
      laneRun("quality:security", "passed", O.some("bun run beep quality github-checks security")),
      laneRun("quality:coverage", "failed"),
    ]);

    expect(laneById(verdict, fullProofStep.id).repairCommand).toBe("bun run beep quality github-checks pre-push");
    expect(laneById(verdict, "quality:coverage").repairCommand).toBeUndefined();
    expect(laneById(verdict, "quality:security").repairCommand).toBeUndefined();
  });

  it("still finds the red lane's marker when a concurrent sibling finished after the lane launched", () => {
    const verdict = buildVerdict(fullProofStep, concurrentTypoOutput, [
      laneRun("quality:security", "passed", O.some("bun run beep quality github-checks security")),
      laneRun("quality:lint-policy", "failed", O.some("bun run beep ci lane lint-policy")),
    ]);

    expect(laneById(verdict, fullProofStep.id).repairCommand).toBe(TYPOS_HINT);
    expect(laneById(verdict, "quality:lint-policy").repairCommand).toBe(TYPOS_HINT);
    expect(laneById(verdict, "quality:security").repairCommand).toBeUndefined();
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
    assertSome(knownSubLaneRemediationForLaneId("goals:index-check"), GOALS_INDEX_HINT);
    assertNone(knownSubLaneRemediationForLaneId("quality:coverage"));
    assertNone(knownSubLaneRemediationForLaneId("repo-sanity:changeset-graph"));
  });

  it("slices one lane's segment between its launch line and its outcome line", () => {
    const siblings = HashSet.make("quality:security", "quality:coverage");
    assertSome(
      laneOutputSegment(fullProofOutput, "quality:coverage", siblings),
      [
        "[beep-cli] quality:coverage: bun run beep ci lane coverage",
        "FAIL packages/acp/test/protocol.test.ts > round-trips every request",
        "Error: Property failed after 12 tests",
        "[beep-cli] quality:coverage: failed in 91000ms",
      ].join("\n")
    );
    assertSome(
      laneOutputSegment(fullProofOutput, "quality:security", siblings),
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

    assertSome(
      laneOutputSegment(output, "goals:index-check", siblings),
      [
        "[beep-cli] goals:index-check: bun run beep goals index --check",
        "local goals/INDEX.md drifts from goals/*/ops/manifest.json",
      ].join("\n")
    );
  });

  it("lets a sibling's later outcome line through the segment but drops it from the text", () => {
    const siblings = HashSet.make("quality:security", "quality:lint-policy");

    assertSome(
      laneOutputSegment(concurrentTypoOutput, "quality:lint-policy", siblings),
      [
        "[beep-cli] quality:lint-policy: bun run beep ci lane lint-policy",
        "No vulnerabilities found (checked 2309 packages, 2 ignored)",
        "[beep-cli] lint:typos: typos",
        "error: misspelling found in docs/README.md",
        "[beep-cli] lint:typos: failed in 12ms",
        "[beep-cli] quality:lint-policy: failed in 40ms",
      ].join("\n")
    );
    assertSome(
      knownSubLaneRemediationFromLaneOutput(concurrentTypoOutput, "quality:lint-policy", siblings),
      TYPOS_HINT
    );
  });

  it("keeps a passing sibling's outcome label from naming the hint", () => {
    // `docgen` is a catalog needle; the docgen lane passing inside coverage's
    // window must not turn a coverage failure into a docgen hint.
    const output = [
      "[beep-cli] quality:docgen: bun run beep ci lane docgen",
      "[beep-cli] quality:coverage: bun run beep ci lane coverage",
      "[beep-cli] quality:docgen: ok in 3000ms",
      "FAIL packages/acp/test/protocol.test.ts > round-trips every request",
      "[beep-cli] quality:coverage: failed in 91000ms",
    ].join("\n");
    const siblings = HashSet.make("quality:docgen", "quality:coverage");

    assertSome(
      laneOutputSegment(output, "quality:coverage", siblings),
      [
        "[beep-cli] quality:coverage: bun run beep ci lane coverage",
        "FAIL packages/acp/test/protocol.test.ts > round-trips every request",
        "[beep-cli] quality:coverage: failed in 91000ms",
      ].join("\n")
    );
    assertNone(knownSubLaneRemediationFromLaneOutput(output, "quality:coverage", siblings));
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
    assertSome(knownSubLaneRemediationFromLaneOutput(fullProofOutput, "quality:security", siblings), OSV_HINT);
  });
});
