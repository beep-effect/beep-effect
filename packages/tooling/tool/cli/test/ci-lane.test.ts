import {
  CI_LANE_DESCRIPTORS,
  CI_LANE_ID_VALUES,
  CiLaneRunOptions,
  CiLocalStepPlan,
  ciLaneStepsForTesting,
  ciLocalStepsForTesting,
} from "@beep/repo-cli/commands/Ci";
import { A } from "@beep/utils";
import { Order, pipe } from "effect";
import * as O from "effect/Option";
import { describe, expect, it } from "vitest";

const REPO_ROOT = "/repo";

const firstOf = <T>(items: ReadonlyArray<T>): T => O.getOrThrow(A.head(items));
const lastOf = <T>(items: ReadonlyArray<T>): T => O.getOrThrow(A.last(items));

const baseOptions = CiLaneRunOptions.make({
  affected: false,
  base: "origin/main",
  head: "HEAD",
  summarize: false,
  mode: "affected",
  to: "HEAD",
  last: false,
  changesetStatus: false,
  validateEnvelopes: false,
});

const prShapeOptions = CiLaneRunOptions.make({
  ...baseOptions,
  affected: true,
  summarize: true,
});

// The 17 required-check context names frozen by ruleset 10240248.
const REQUIRED_CONTEXT_NAMES = [
  "Check",
  "Codegen Drift",
  "Commitlint",
  "Coverage Regression",
  "Docgen",
  "JSDoc Ratchet",
  "Knip",
  "Lint",
  "Lint Policy",
  "Nix Shell",
  "Professional Desktop IPC Stdio",
  "Repo Sanity",
  "SAST",
  "Secret Scanning",
  "Security",
  "Test Integration",
  "Test Unit",
];

describe("CI lane descriptors", () => {
  it("enumerates every check.yml lane exactly once", () => {
    const ids = A.map(CI_LANE_DESCRIPTORS, (descriptor) => descriptor.id);
    expect(A.length(A.dedupe(ids))).toBe(A.length(ids));
    expect(A.length(CI_LANE_DESCRIPTORS)).toBe(22);
  });

  it("covers every runnable lane id", () => {
    const descriptorIds = A.map(CI_LANE_DESCRIPTORS, (descriptor) => descriptor.id);
    const missing = A.filter(CI_LANE_ID_VALUES, (laneId) => !A.contains(descriptorIds, laneId));
    expect(missing).toEqual([]);
  });

  it("matches the frozen required-check context set", () => {
    const requiredContexts = pipe(
      CI_LANE_DESCRIPTORS,
      A.filter((descriptor) => descriptor.required),
      A.map((descriptor) => descriptor.contextName),
      A.dedupe,
      A.sort(Order.String)
    );
    expect(requiredContexts).toEqual(REQUIRED_CONTEXT_NAMES);
  });

  it("marks the CI-only residue as unreplayable", () => {
    const residue = pipe(
      CI_LANE_DESCRIPTORS,
      A.filter((descriptor) => descriptor.replay === "none"),
      A.map((descriptor) => descriptor.id),
      A.sort(Order.String)
    );
    expect(residue).toEqual(["dependency-review", "pr-size"]);
  });
});

describe("ciLaneStepsForTesting", () => {
  it("builds the PR-shape lint lane with TURBO_SCM_BASE", () => {
    const steps = ciLaneStepsForTesting(REPO_ROOT, "lint", prShapeOptions);
    expect(A.length(steps)).toBe(1);
    const step = firstOf(steps);
    expect(step.command).toBe("bun");
    expect([...step.args]).toEqual(["run", "lint", "--", "--affected", "--summarize"]);
    expect(step.env).toEqual({ TURBO_SCM_BASE: "origin/main" });
  });

  it("builds the push-shape lint lane without turbo args", () => {
    const step = firstOf(ciLaneStepsForTesting(REPO_ROOT, "lint", baseOptions));
    expect([...step.args]).toEqual(["run", "lint"]);
    expect(step.env).toBeUndefined();
  });

  it("splits the test lanes into CI's unit and integration shapes", () => {
    const unit = firstOf(ciLaneStepsForTesting(REPO_ROOT, "test-unit", prShapeOptions));
    expect([...unit.args]).toEqual(["run", "test", "--", "--unit", "--types", "--affected", "--summarize"]);

    const integration = firstOf(ciLaneStepsForTesting(REPO_ROOT, "test-integration", prShapeOptions));
    expect([...integration.args]).toEqual(["run", "test", "--", "--integration", "--affected", "--summarize"]);
  });

  it("runs jsdoc-inventory before jsdoc-ratchet, matching hosted CI", () => {
    const steps = ciLaneStepsForTesting(REPO_ROOT, "jsdoc-ratchet", baseOptions);
    const labels = A.map(steps, (step) => step.label);
    expect(labels).toEqual(["ci:jsdoc-ratchet:inventory", "ci:jsdoc-ratchet:ratchet"]);
    expect(steps[0]?.args).toEqual([
      "run",
      "beep",
      "quality",
      "jsdoc-inventory",
      "--output-json",
      ".beep/ci/jsdoc-documentation.inventory.jsonc",
      "--output-markdown",
      ".beep/ci/jsdoc-documentation.inventory.md",
    ]);
    expect(steps[1]?.args).toEqual([
      "run",
      "beep",
      "quality",
      "jsdoc-ratchet",
      "--inventory",
      ".beep/ci/jsdoc-documentation.inventory.jsonc",
    ]);
  });

  it("builds the codegen drift lane as generate-then-diff", () => {
    const steps = ciLaneStepsForTesting(REPO_ROOT, "codegen", baseOptions);
    expect(A.map(steps, (step) => step.command)).toEqual(["bun", "git"]);
    const drift = lastOf(steps);
    expect([...drift.args]).toEqual([
      "diff",
      "--exit-code",
      "--",
      "packages/drivers/ecfr/src/_generated",
      "packages/drivers/ecfr/openapi.json",
    ]);
  });

  it("builds commitlint range and last shapes", () => {
    const range = firstOf(
      ciLaneStepsForTesting(
        REPO_ROOT,
        "commitlint",
        CiLaneRunOptions.make({ ...baseOptions, from: "abc123", to: "def456" })
      )
    );
    expect([...range.args]).toEqual(["commitlint", "--from", "abc123", "--to", "def456", "--verbose"]);

    const last = firstOf(
      ciLaneStepsForTesting(REPO_ROOT, "commitlint", CiLaneRunOptions.make({ ...baseOptions, last: true }))
    );
    expect([...last.args]).toEqual(["commitlint", "--last", "--verbose"]);

    const defaulted = firstOf(ciLaneStepsForTesting(REPO_ROOT, "commitlint", baseOptions));
    expect([...defaulted.args]).toEqual(["commitlint", "--from", "origin/main", "--to", "HEAD", "--verbose"]);
  });

  it("builds docgen lanes per workflow lane-gate mode", () => {
    expect(ciLaneStepsForTesting(REPO_ROOT, "docgen", CiLaneRunOptions.make({ ...baseOptions, mode: "none" }))).toEqual(
      []
    );

    const affected = firstOf(
      ciLaneStepsForTesting(REPO_ROOT, "docgen", CiLaneRunOptions.make({ ...baseOptions, mode: "affected" }))
    );
    expect([...affected.args]).toEqual([
      "run",
      "docgen:local",
      "--",
      "--base",
      "origin/main",
      "--head",
      "HEAD",
      "--parallel=3",
    ]);

    const full = firstOf(
      ciLaneStepsForTesting(REPO_ROOT, "docgen", CiLaneRunOptions.make({ ...baseOptions, mode: "full" }))
    );
    expect([...full.args]).toEqual(["run", "docgen"]);
  });

  it("appends the changeset status step to repo-sanity on request", () => {
    const withoutFlag = ciLaneStepsForTesting(REPO_ROOT, "repo-sanity", baseOptions);
    expect(A.map(withoutFlag, (step) => step.label)).toEqual(["ci:repo-sanity"]);

    const withFlag = ciLaneStepsForTesting(
      REPO_ROOT,
      "repo-sanity",
      CiLaneRunOptions.make({ ...baseOptions, changesetStatus: true })
    );
    expect(A.map(withFlag, (step) => step.label)).toEqual(["ci:repo-sanity", "ci:repo-sanity:changeset-status"]);
  });

  it("plans the fallow lane as promoted blocking, advisory, then optional validation", () => {
    const runPhase = A.map(ciLaneStepsForTesting(REPO_ROOT, "fallow", baseOptions), (step) => step.label);
    expect(runPhase).toEqual([
      "ci:fallow:audit",
      "ci:fallow:dead-code",
      "ci:fallow:health",
      "ci:fallow:boundaries",
      "ci:fallow:flags",
      "ci:fallow:security",
      "ci:fallow:fix-preview",
    ]);

    const validated = ciLaneStepsForTesting(
      REPO_ROOT,
      "fallow",
      CiLaneRunOptions.make({ ...baseOptions, validateEnvelopes: true })
    );
    expect(A.length(validated)).toBe(14);
    const lastLabel = lastOf(validated).label;
    expect(lastLabel).toBe("ci:fallow:envelope-check:dead-code");
  });

  it("builds the property lane with the 400-run floor, fixed seed, and cache-partitioning env", () => {
    const step = firstOf(ciLaneStepsForTesting(REPO_ROOT, "property", prShapeOptions));
    expect(step.command).toBe("bunx");
    expect([...step.args]).toEqual(["turbo", "run", "test:property", "--affected", "--summarize"]);
    expect(step.env).toEqual({ BEEP_FC_NUM_RUNS: "400", BEEP_FC_SEED: "20260708", TURBO_SCM_BASE: "origin/main" });

    const deep = firstOf(
      ciLaneStepsForTesting(REPO_ROOT, "property", CiLaneRunOptions.make({ ...baseOptions, runs: "1000" }))
    );
    expect(deep.env).toEqual({ BEEP_FC_NUM_RUNS: "1000", BEEP_FC_SEED: "20260708" });

    // A blank or whitespace-only --runs must fall back to the 400 floor,
    // never reach the lane as BEEP_FC_NUM_RUNS="" (which parsers read as
    // absent, silently dropping to fast-check's 100-run default).
    for (const blank of ["", "   "]) {
      const step = firstOf(
        ciLaneStepsForTesting(REPO_ROOT, "property", CiLaneRunOptions.make({ ...baseOptions, runs: blank }))
      );
      expect(step.env).toEqual({ BEEP_FC_NUM_RUNS: "400", BEEP_FC_SEED: "20260708" });
    }

    // --seed overrides the deterministic default; blank/whitespace falls back
    // to the fixed seed so the PR lane can never silently go non-deterministic.
    const seeded = firstOf(
      ciLaneStepsForTesting(REPO_ROOT, "property", CiLaneRunOptions.make({ ...baseOptions, seed: "12345" }))
    );
    expect(seeded.env).toEqual({ BEEP_FC_NUM_RUNS: "400", BEEP_FC_SEED: "12345" });
    for (const blank of ["", "   "]) {
      const fallback = firstOf(
        ciLaneStepsForTesting(REPO_ROOT, "property", CiLaneRunOptions.make({ ...baseOptions, seed: blank }))
      );
      expect(fallback.env).toEqual({ BEEP_FC_NUM_RUNS: "400", BEEP_FC_SEED: "20260708" });
    }
  });

  it("keeps the build lane's --summarize flag-driven", () => {
    const plain = firstOf(ciLaneStepsForTesting(REPO_ROOT, "build", baseOptions));
    expect([...plain.args]).toEqual(["run", "build"]);

    const summarized = firstOf(
      ciLaneStepsForTesting(REPO_ROOT, "build", CiLaneRunOptions.make({ ...baseOptions, summarize: true }))
    );
    expect([...summarized.args]).toEqual(["run", "build", "--", "--summarize"]);
  });
});

describe("ciLocalStepsForTesting", () => {
  const branchPlan = CiLocalStepPlan.make({ affected: false, base: "origin/main", onMainBranch: false });

  it("dispatches each lane through beep ci lane", () => {
    const step = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["knip"], branchPlan));
    expect([...step.args]).toEqual(["run", "beep", "ci", "lane", "knip"]);
  });

  it("forwards the affected shape to turbo-backed lanes", () => {
    const affectedPlan = CiLocalStepPlan.make({ ...branchPlan, affected: true });
    const lint = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["lint"], affectedPlan));
    expect([...lint.args]).toEqual(["run", "beep", "ci", "lane", "lint", "--affected", "--base", "origin/main"]);

    const docgen = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["docgen"], affectedPlan));
    expect([...docgen.args]).toEqual([
      "run",
      "beep",
      "ci",
      "lane",
      "docgen",
      "--mode",
      "affected",
      "--base",
      "origin/main",
    ]);
  });

  it("replays fallow with envelope validation locally", () => {
    const fallow = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["fallow"], branchPlan));
    expect([...fallow.args]).toEqual([
      "run",
      "beep",
      "ci",
      "lane",
      "fallow",
      "--base",
      "origin/main",
      "--validate-envelopes",
    ]);
  });

  it("skips the changeset status flag on main", () => {
    const mainPlan = CiLocalStepPlan.make({ ...branchPlan, onMainBranch: true });
    const onMain = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["repo-sanity"], mainPlan));
    expect([...onMain.args]).toEqual(["run", "beep", "ci", "lane", "repo-sanity"]);

    const onBranch = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["repo-sanity"], branchPlan));
    expect([...onBranch.args]).toEqual(["run", "beep", "ci", "lane", "repo-sanity", "--changeset-status"]);
  });
});
