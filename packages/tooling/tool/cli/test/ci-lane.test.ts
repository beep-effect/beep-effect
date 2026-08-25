import {
  CI_LANE_DESCRIPTORS,
  CI_LANE_ID_VALUES,
  CiLaneRunOptions,
  CiLocalStepPlan,
  ciLaneStepsForTesting,
  ciLocalStepsForTesting,
  doctestStepForTesting,
  runCiLane,
} from "@beep/repo-cli/commands/Ci";
import { A } from "@beep/utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, Order, Path, pipe, Sink, Stream } from "effect";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const REPO_ROOT = "/repo";
const encoder = new TextEncoder();

const commandHandle = (output = "") =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(encoder.encode(output)),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: Stream.make(encoder.encode(output)),
    unref: Effect.succeed(Effect.void),
  });

const doctestCiLayer = (
  changedFiles: ReadonlyArray<string>,
  sources: ReadonlyArray<readonly [string, string]>,
  spawned: Array<string>
) => {
  const fileSystemLayer = FileSystem.layerNoop({
    exists: (file) => Effect.succeed(Str.endsWith("/.git")(file)),
    makeDirectory: () => Effect.void,
    readFileString: (file) => {
      const source = A.findFirst(sources, ([suffix]) => Str.endsWith(suffix)(file));
      return O.match(source, {
        onNone: () =>
          Effect.fail(
            PlatformError.systemError({
              _tag: "NotFound",
              module: "CiLaneTest",
              method: "readFileString",
              pathOrDescriptor: file,
            })
          ),
        onSome: ([, content]) => Effect.succeed(content),
      });
    },
    writeFileString: () => Effect.void,
  });
  const processLayer = Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      if (!ChildProcess.isStandardCommand(command)) {
        return Effect.die("the CI lane test never spawns a piped command");
      }
      const rendered = A.join([command.command, ...command.args], " ");
      spawned.push(rendered);
      return Effect.succeed(commandHandle(command.command === "git" ? A.join(changedFiles, "\n") : ""));
    })
  );
  return Layer.mergeAll(fileSystemLayer, Path.layer, processLayer, TestConsole.layer);
};

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

// The 16 required-check context names read from ruleset 10240248 on 2026-08-13.
const REQUIRED_CONTEXT_NAMES = [
  "Check",
  "Codegen Drift",
  "Commitlint",
  "Coverage Regression",
  "Docgen",
  "Doctest",
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
    expect(A.length(CI_LANE_DESCRIPTORS)).toBe(25);
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

  it("keeps the ecosystem contracts context visible but non-required", () => {
    const descriptor = O.getOrThrow(A.findFirst(CI_LANE_DESCRIPTORS, (candidate) => candidate.id === "ecosystem"));
    expect(descriptor.contextName).toBe("Ecosystem Contracts");
    expect(descriptor.required).toBe(false);
  });

  it("keeps the JSDoc ratchet visible but non-required", () => {
    const descriptor = O.getOrThrow(A.findFirst(CI_LANE_DESCRIPTORS, (candidate) => candidate.id === "jsdoc-ratchet"));
    expect(descriptor.contextName).toBe("JSDoc Ratchet");
    expect(descriptor.required).toBe(false);
  });

  // lab-apps-lifecycle P2 (ratified row 10): the labs lane is PERMANENTLY
  // non-required — its context must never join ruleset 10240248.
  it("keeps the labs lane visible, workflow-gated, and permanently non-required", () => {
    const descriptor = O.getOrThrow(A.findFirst(CI_LANE_DESCRIPTORS, (candidate) => candidate.id === "labs"));
    expect(descriptor.contextName).toBe("Labs");
    expect(descriptor.required).toBe(false);
    expect(descriptor.laneClass).toBe("workflow-gated");
    expect(A.contains(REQUIRED_CONTEXT_NAMES, descriptor.contextName)).toBe(false);
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
  it("serializes the PR-shape check lane on fleet workers", () => {
    const step = firstOf(ciLaneStepsForTesting(REPO_ROOT, "check", prShapeOptions));
    expect([...step.args]).toEqual(["run", "check", "--", "--concurrency=1", "--affected", "--summarize"]);
    expect(step.env).toEqual({ TURBO_SCM_BASE: "origin/main" });
  });

  it("builds the PR-shape package lint graph with TURBO_SCM_BASE", () => {
    const steps = ciLaneStepsForTesting(REPO_ROOT, "lint", prShapeOptions);
    expect(A.length(steps)).toBe(1);
    const step = firstOf(steps);
    expect(step.command).toBe("bunx");
    expect([...step.args]).toEqual([
      "turbo",
      "run",
      "lint",
      "--concurrency=2",
      "--filter=!./apps/labs/**",
      "--affected",
      "--summarize",
    ]);
    expect(step.env).toEqual({ TURBO_SCM_BASE: "origin/main" });
  });

  it("builds the push-shape lint lane with the hosted-runner turbo cap", () => {
    const step = firstOf(ciLaneStepsForTesting(REPO_ROOT, "lint", baseOptions));
    expect([...step.args]).toEqual(["turbo", "run", "lint", "--concurrency=2", "--filter=!./apps/labs/**"]);
    expect(step.env).toBeUndefined();
  });

  // lab-apps-lifecycle P2 (ratified row 10): one bundled positively-filtered
  // turbo run, never --affected (turbo unions filter selectors), never
  // TURBO_SCM_BASE — the workflow path gate provides PR scoping.
  it("bundles the labs lane as one positively-filtered turbo run without --affected", () => {
    const steps = ciLaneStepsForTesting(REPO_ROOT, "labs", baseOptions);
    expect(A.length(steps)).toBe(1);
    const step = firstOf(steps);
    expect(step.label).toBe("ci:labs");
    expect(step.command).toBe("bunx");
    expect([...step.args]).toEqual([
      "turbo",
      "run",
      "check",
      "lint",
      "test",
      "--filter=./apps/labs/**",
      "--concurrency=2",
    ]);
    expect(step.env).toBeUndefined();

    const prShaped = firstOf(ciLaneStepsForTesting(REPO_ROOT, "labs", prShapeOptions));
    expect([...prShaped.args]).toEqual([
      "turbo",
      "run",
      "check",
      "lint",
      "test",
      "--filter=./apps/labs/**",
      "--concurrency=2",
      "--summarize",
    ]);
    expect(prShaped.args).not.toContain("--affected");
    expect(prShaped.env).toBeUndefined();
  });

  it("splits the test lanes into CI's unit and integration shapes", () => {
    const unit = firstOf(ciLaneStepsForTesting(REPO_ROOT, "test-unit", prShapeOptions));
    expect([...unit.args]).toEqual(["run", "test", "--", "--unit", "--concurrency=2", "--affected", "--summarize"]);

    const integration = firstOf(ciLaneStepsForTesting(REPO_ROOT, "test-integration", prShapeOptions));
    expect([...integration.args]).toEqual(["run", "test", "--", "--integration", "--affected", "--summarize"]);
  });

  it("states the lint-policy full sweep in argv instead of inheriting CI=true", () => {
    const step = firstOf(ciLaneStepsForTesting(REPO_ROOT, "lint-policy", baseOptions));
    expect([...step.args]).toEqual(["run", "beep", "lint", "policy", "--full"]);
  });

  it("runs the first ecosystem member's type and bundle contracts explicitly", () => {
    const steps = ciLaneStepsForTesting(REPO_ROOT, "ecosystem", baseOptions);
    expect(A.map(steps, (step) => step.command)).toEqual(["bun", "bun"]);
    expect(A.map(steps, (step) => [...step.args])).toEqual([
      ["run", "--cwd", "packages/ecosystem/effect-drizzle", "beep:type-test"],
      ["run", "--cwd", "packages/ecosystem/effect-drizzle", "beep:bundle-probe"],
    ]);
  });

  it("matches coverage baseline regeneration concurrency", () => {
    const coverage = firstOf(ciLaneStepsForTesting(REPO_ROOT, "coverage", prShapeOptions));
    expect([...coverage.args]).toEqual(["run", "coverage", "--", "--concurrency=3", "--affected", "--summarize"]);
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

  it("builds the codegen drift lane as generate-then-diff-then-bundle-check", () => {
    const steps = ciLaneStepsForTesting(REPO_ROOT, "codegen", baseOptions);
    expect(A.map(steps, (step) => step.command)).toEqual(["bun", "git", "bun"]);
    expect(steps[1]?.args).toEqual([
      "diff",
      "--exit-code",
      "--",
      "packages/drivers/ecfr/src/_generated",
      "packages/drivers/ecfr/openapi.json",
    ]);
    const bundleCheck = lastOf(steps);
    expect([...bundleCheck.args]).toEqual(["run", "--cwd", "apps/professional-desktop", "codegen:check"]);
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
    expect([...affected.args]).toEqual(["run", "docgen:local", "--", "--base", "origin/main", "--head", "HEAD"]);

    const full = firstOf(
      ciLaneStepsForTesting(REPO_ROOT, "docgen", CiLaneRunOptions.make({ ...baseOptions, mode: "full" }))
    );
    expect([...full.args]).toEqual(["run", "docgen"]);
  });

  it("builds exact full and affected Doctest argv", () => {
    const full = firstOf(doctestStepForTesting(REPO_ROOT, undefined));
    expect(full.command).toBe("bunx");
    expect([...full.args]).toEqual(["vitest", "run", "--config", "vitest.docs.ts"]);

    const affected = firstOf(doctestStepForTesting(REPO_ROOT, ["apps/a/src/index.ts", "packages/z/src/index.ts"]));
    expect([...affected.args]).toEqual([
      "vitest",
      "run",
      "--config",
      "vitest.docs.ts",
      "apps/a/src/index.ts",
      "packages/z/src/index.ts",
    ]);
    expect(doctestStepForTesting(REPO_ROOT, [])).toEqual([]);
  });

  it("always runs the changeset graph and appends changeset status on request", () => {
    const withoutFlag = ciLaneStepsForTesting(REPO_ROOT, "repo-sanity", baseOptions);
    expect(A.map(withoutFlag, (step) => step.label)).toEqual(["ci:repo-sanity:changeset-graph", "ci:repo-sanity"]);
    expect([...firstOf(withoutFlag).args]).toEqual(["run", "beep", "quality", "changeset-graph"]);

    const withFlag = ciLaneStepsForTesting(
      REPO_ROOT,
      "repo-sanity",
      CiLaneRunOptions.make({ ...baseOptions, changesetStatus: true })
    );
    expect(A.map(withFlag, (step) => step.label)).toEqual([
      "ci:repo-sanity:changeset-graph",
      "ci:repo-sanity",
      "ci:repo-sanity:changeset-status",
    ]);
    // lab-apps-lifecycle P2 (ratified row 8): CI's changeset gate routes
    // through the path-aware wrapper so lab-only changes are ceremony-exempt.
    expect([...lastOf(withFlag).args]).toEqual([
      "run",
      "beep",
      "quality",
      "changeset-status",
      "--since",
      "origin/main",
    ]);
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
    expect([...step.args]).toEqual(["turbo", "run", "test:property", "--concurrency=4", "--affected", "--summarize"]);
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

  it("dispatches the labs lane bare, without affected shaping", () => {
    const affectedPlan = CiLocalStepPlan.make({ ...branchPlan, affected: true });
    const step = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["labs"], affectedPlan));
    expect([...step.args]).toEqual(["run", "beep", "ci", "lane", "labs"]);
  });

  it("keeps --summarize on turbo-backed lanes even without the affected shape", () => {
    const check = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["check"], branchPlan));
    expect([...check.args]).toEqual(["run", "beep", "ci", "lane", "check", "--summarize"]);
  });

  it("forwards the affected shape to turbo-backed lanes", () => {
    const affectedPlan = CiLocalStepPlan.make({ ...branchPlan, affected: true });
    const lint = firstOf(ciLocalStepsForTesting(REPO_ROOT, ["lint"], affectedPlan));
    expect([...lint.args]).toEqual([
      "run",
      "beep",
      "ci",
      "lane",
      "lint",
      "--affected",
      "--base",
      "origin/main",
      "--summarize",
    ]);

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

const affectedDoctestCommands = A.empty<string>();
const affectedDoctestFiles = [
  "packages/example/src/unmarked.ts",
  "packages/example/src/marked.ts",
  "packages/example/src/deleted.ts",
  "packages/example/src/view.tsx",
  "packages/example/src/value.d.ts",
  "packages/example/src/test/fixtures/fixture.ts",
  "packages/example/src/node_modules/generated.ts",
  "apps\\demo\\src\\marked.ts",
  "packages/example/src/marked.ts",
];
const affectedDoctestSources: ReadonlyArray<readonly [string, string]> = [
  ["packages/example/src/marked.ts", "const marked = import.meta.vitest;"],
  ["packages/example/src/unmarked.ts", "export const unmarked = true;"],
  ["apps/demo/src/marked.ts", "if (import.meta.vitest) {}"],
];

layer(doctestCiLayer(affectedDoctestFiles, affectedDoctestSources, affectedDoctestCommands))(
  "affected Doctest CI lane",
  (it) => {
    it.effect("resolves only existing marked TypeScript source files and runs their exact argv", () =>
      Effect.gen(function* () {
        yield* runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "affected" }));

        expect(affectedDoctestCommands).toHaveLength(2);
        expect(affectedDoctestCommands[0]).toBe("git diff --name-only origin/main...HEAD -- packages apps");
        expect(affectedDoctestCommands[1]).toContain(
          "bunx vitest run --config vitest.docs.ts apps/demo/src/marked.ts packages/example/src/marked.ts"
        );
      })
    );
  }
);

const emptyAffectedDoctestCommands = A.empty<string>();

layer(
  doctestCiLayer(
    ["packages/example/src/unmarked.ts", "packages/example/src/deleted.ts", "packages/example/src/view.tsx"],
    [["packages/example/src/unmarked.ts", "export const unmarked = true;"]],
    emptyAffectedDoctestCommands
  )
)("empty affected Doctest CI lane", (it) => {
  it.effect("logs the early exit without spawning Vitest", () =>
    Effect.gen(function* () {
      yield* runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "affected" }));

      expect(emptyAffectedDoctestCommands).toEqual(["git diff --name-only origin/main...HEAD -- packages apps"]);
      expect(A.join(A.filter(yield* TestConsole.logLines, P.isString), "\n")).toContain(
        "[ci] doctest: no marked affected source files (skipped)"
      );
    })
  );
});

const fullDoctestCommands = A.empty<string>();

layer(doctestCiLayer([], [], fullDoctestCommands))("full Doctest CI lane", (it) => {
  it.effect("runs the complete documentation Vitest corpus without Git discovery", () =>
    Effect.gen(function* () {
      yield* runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "full" }));

      expect(fullDoctestCommands).toHaveLength(1);
      expect(fullDoctestCommands[0]).toContain("bunx vitest run --config vitest.docs.ts");
    })
  );
});

const disabledDoctestCommands = A.empty<string>();

layer(doctestCiLayer([], [], disabledDoctestCommands))("disabled Doctest CI lane", (it) => {
  it.effect("takes the no-step branch without Git discovery or Vitest", () =>
    Effect.gen(function* () {
      yield* runCiLane("doctest", CiLaneRunOptions.make({ ...baseOptions, mode: "none" }));

      expect(disabledDoctestCommands).toEqual([]);
      expect(A.join(A.filter(yield* TestConsole.logLines, P.isString), "\n")).toContain(
        "[ci] doctest: no marked affected source files (skipped)"
      );
    })
  );
});

const fallowCommands = A.empty<string>();
const fallowReports: ReadonlyArray<readonly [string, string]> = [
  [".beep/fallow/audit.check.json", "{}"],
  [".beep/fallow/dead-code.check.json", "{}"],
];

layer(doctestCiLayer([], fallowReports, fallowCommands))("Fallow CI lane execution", (it) => {
  it.effect("runs blocking and advisory sublanes before validating blocking envelopes", () =>
    Effect.gen(function* () {
      yield* runCiLane("fallow", CiLaneRunOptions.make({ ...baseOptions, validateEnvelopes: true }));

      expect(fallowCommands).toHaveLength(14);
      expect(fallowCommands[0]).toContain("beep quality fallow audit --check");
      expect(fallowCommands[1]).toContain("beep quality fallow dead-code --check");
      expect(fallowCommands[2]).toContain("beep quality fallow health --advisory");
      expect(fallowCommands[12]).toContain("fallow envelope-check .beep/fallow/audit.check.json");
      expect(fallowCommands[13]).toContain("fallow envelope-check .beep/fallow/dead-code.check.json");
    })
  );
});
