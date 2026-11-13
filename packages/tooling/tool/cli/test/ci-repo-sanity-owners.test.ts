import {
  CI_LANE_ID_VALUES,
  CiLaneRunOptions,
  ciLaneFailurePolicy,
  ciLaneStepsForTesting,
  runCiLaneSteps,
} from "@beep/repo-cli/commands/Ci";
import {
  githubCheckRepoSanityLanesForTesting,
  LintPolicyAffectedTargets,
  PREBUILT_DOCS_OXLINT_CONFIG,
  QualityTaskGroupFailed,
  QualityTaskStep,
  rootLintPolicyStagesForTesting,
} from "@beep/repo-cli/test/Quality";
import { it } from "@beep/test-runner";
import { describe, expect, layer } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeTestLayer } from "./support/CommandTest.ts";
import { parseWorkflowYaml, yamlAt } from "./support/WorkflowYaml.ts";
import type { CiLaneId } from "@beep/repo-cli/commands/Ci";

// hosted-setup-tax slice 2 (PERIH-02, PERIL-04): Repo Sanity is the one hosted
// owner of `lint:shadcn`, and the changeset graph check runs once in it.

const REPO_ROOT = "/repo";
const SHADCN_TASK = "lint:shadcn";
const SHADCN_STEP = "ci:repo-sanity:shadcn";
const MARKER_FILE = "shadcn-ran.txt";
const isQualityTaskGroupFailed = S.is(QualityTaskGroupFailed);

const checkWorkflowText = import.meta.glob<string>("../../../../../.github/workflows/check.yml", {
  eager: true,
  import: "default",
  query: "?raw",
});

const readCheckWorkflow = (): unknown => pipe(R.values(checkWorkflowText), A.head, O.getOrThrow, parseWorkflowYaml);

const isText = S.is(S.String);
const isLaneId = (value: unknown): value is CiLaneId => isText(value) && A.contains(CI_LANE_ID_VALUES, value);

// The hosted shapes check.yml passes `ci lane repo-sanity`: `--changeset-status`
// on pull requests, no flags on pushes to main.
const pushOptions = CiLaneRunOptions.make({
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
const pullRequestOptions = CiLaneRunOptions.make({ ...pushOptions, changesetStatus: true });

const runsShadcn = (step: QualityTaskStep): boolean => A.contains(step.args, SHADCN_TASK);

type HostedOwner = { readonly owner: string; readonly event: string };

// Every place a hosted job could run `lint:shadcn`: a check.yml job's CiLane
// body (per event shape) or a literal `run:` script naming the task.
const checkWorkflowOwners = (workflow: unknown): ReadonlyArray<HostedOwner> => {
  const jobs = yamlAt(workflow, ["jobs"]);
  assertTrue(P.isObject(jobs));
  return A.flatMap(R.keys(jobs as Record<string, unknown>), (job) => {
    const laneId = yamlAt(workflow, ["jobs", job, "env", "BEEP_CI_LANE_ID"]);
    const laneOwners = isLaneId(laneId)
      ? A.flatMap(
          [
            ["pull_request", pullRequestOptions],
            ["push", pushOptions],
          ] as const,
          ([event, options]) =>
            A.some(ciLaneStepsForTesting(REPO_ROOT, laneId, options), runsShadcn)
              ? [{ owner: `check.yml#${job}`, event }]
              : []
        )
      : [];
    const steps = yamlAt(workflow, ["jobs", job, "steps"]);
    const scriptOwners = A.some(A.isArray(steps) ? steps : [], (step) => {
      const script = yamlAt(step, ["run"]);
      return isText(script) && Str.includes(SHADCN_TASK)(script);
    })
      ? [{ owner: `check.yml#${job}:run`, event: "any" }]
      : [];
    return [...laneOwners, ...scriptOwners];
  });
};

const turboTaskNames = (step: QualityTaskStep): ReadonlyArray<string> =>
  A.takeWhile(A.drop(step.args, 2), (arg) => !Str.startsWith("--")(arg));

// The hosted Lint Policy plan in both scopes: full (no targets) and changed.
const lintPolicyOwners = (): ReadonlyArray<HostedOwner> =>
  A.flatMap(
    [
      ["full", undefined],
      ["changed", LintPolicyAffectedTargets.make({ jsdoc: ["packages/a"], deprecatedApis: ["packages/a"] })],
    ] as const,
    ([scope, targets]) =>
      A.some(
        A.flatten(
          rootLintPolicyStagesForTesting(REPO_ROOT, {
            base: "origin/main",
            hosted: true,
            docsConfig: PREBUILT_DOCS_OXLINT_CONFIG,
            ...(targets === undefined ? {} : { targets }),
          })
        ),
        (step) => A.contains(turboTaskNames(step), SHADCN_TASK) || runsShadcn(step)
      )
        ? [{ owner: `lint-policy:${scope}`, event: "any" }]
        : []
  );

describe("one hosted lint:shadcn owner (PERIH-02)", () => {
  it("runs lint:shadcn in exactly one hosted job, Repo Sanity, on pull requests and pushes", () => {
    const workflow = readCheckWorkflow();
    const owners = [...checkWorkflowOwners(workflow), ...lintPolicyOwners()];
    expect(owners).toEqual([
      { owner: "check.yml#verify", event: "pull_request" },
      { owner: "check.yml#verify", event: "push" },
    ]);
    expect(yamlAt(workflow, ["jobs", "verify", "name"])).toBe("Repo Sanity");
    expect(yamlAt(workflow, ["jobs", "verify", "env", "BEEP_CI_LANE_ID"])).toBe("repo-sanity");
  });

  it("keeps no Shadcn Lint job or lane arm in check.yml", () => {
    const workflow = readCheckWorkflow();
    expect(yamlAt(workflow, ["jobs", "shadcn-lint"])).toBeUndefined();
    const steps = yamlAt(workflow, ["jobs", "verify", "steps"]);
    assertTrue(A.isArray(steps));
    const scripts = A.filter(
      A.map(steps, (step) => yamlAt(step, ["run"])),
      isText
    );
    expect(A.some(scripts, Str.includes("shadcn-lint"))).toBe(false);
  });

  // A separate check.yml step that fails before "Run verification lane" skips
  // the whole lane body. Workflow policy therefore runs inside the body.
  it("runs workflow policy inside the Repo Sanity body, ahead of the shadcn step", () => {
    const workflow = readCheckWorkflow();
    const steps = yamlAt(workflow, ["jobs", "verify", "steps"]);
    assertTrue(A.isArray(steps));
    const scripts = A.filter(
      A.map(steps, (step) => yamlAt(step, ["run"])),
      isText
    );
    expect(A.some(scripts, Str.includes("ci workflow-lint"))).toBe(false);
    A.forEach([pullRequestOptions, pushOptions], (options) => {
      const labels = A.map(ciLaneStepsForTesting(REPO_ROOT, "repo-sanity", options), (step) => step.label);
      assertSome(
        A.findFirstIndex(labels, (label) => label === "ci:repo-sanity:workflow-lint"),
        0
      );
      expect(A.contains(labels, SHADCN_STEP)).toBe(true);
    });
  });

  it("runs the Repo Sanity body under the collecting policy", () => {
    expect(ciLaneFailurePolicy("repo-sanity")).toBe("collect-all");
    expect(ciLaneFailurePolicy("jsdoc-ratchet")).toBe("fail-fast");
  });
});

describe("one changeset-graph execution in Repo Sanity (PERIL-04)", () => {
  // Repo Sanity's plan is its CiLane body plus the `audit:github repo-sanity`
  // collector that body runs. The graph check must appear exactly once.
  it("plans the changeset graph check once, as the repo-sanity:changeset-graph lane", () => {
    A.forEach([pullRequestOptions, pushOptions], (options) => {
      const body = ciLaneStepsForTesting(REPO_ROOT, "repo-sanity", options);
      expect(
        A.some(body, (step) => A.contains(step.args, "audit:github") && A.contains(step.args, "repo-sanity"))
      ).toBe(true);
      const labels = [
        ...A.map(body, (step) => step.label),
        ...A.map(githubCheckRepoSanityLanesForTesting(REPO_ROOT), (lane) => lane.id),
      ];
      expect(A.filter(labels, Str.includes("changeset-graph"))).toEqual(["repo-sanity:changeset-graph"]);
      expect(A.some(body, (step) => A.contains(step.args, "changeset-graph"))).toBe(false);
    });
    const lane = O.getOrThrow(
      A.findFirst(
        githubCheckRepoSanityLanesForTesting(REPO_ROOT),
        (entry) => entry.id === "repo-sanity:changeset-graph"
      )
    );
    // The remaining lane runs the same command whose corrupt-fixture cases
    // stay red in changeset-graph.test.ts.
    expect([...lane.step.args]).toEqual(["run", "beep", "quality", "changeset-graph"]);
  });
});

const testLayer = Layer.mergeAll(NodeTestLayer, TestConsole.layer);

layer(testLayer, { timeout: "60 seconds" })("Repo Sanity step masking (PERIH-02)", (it) => {
  // `beep ci lane repo-sanity` hands its planned body to runCiLaneSteps.
  // Replay the real body's labels through that runner with every step before
  // the shadcn step red and prove the shadcn step still ran.
  it.effect("runs the shadcn step after every earlier Repo Sanity step fails", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "repo-sanity-mask-" });
      const marker = path.join(dir, MARKER_FILE);
      const body = ciLaneStepsForTesting(REPO_ROOT, "repo-sanity", pullRequestOptions);
      const shadcnIndex = O.getOrThrow(A.findFirstIndex(body, (step) => step.label === SHADCN_STEP));
      expect(shadcnIndex).toBeGreaterThan(0);
      const replay = A.map(A.take(body, shadcnIndex + 1), (step, index) =>
        QualityTaskStep.make({
          label: step.label,
          command: "bun",
          // Each step runs in `dir`, so the marker is written by relative path.
          args: ["-e", index === shadcnIndex ? `await Bun.write("${MARKER_FILE}", "yes")` : "process.exit(3)"],
          cwd: dir,
        })
      );
      const exit = yield* Effect.exit(runCiLaneSteps("repo-sanity", replay));
      const shadcnRan = yield* fs.exists(marker);
      expect(shadcnRan).toBe(true);
      // A success leaves no failure, which the guard below rejects.
      const failure = exit.pipe(Exit.match({ onSuccess: () => undefined, onFailure: Cause.squash }));
      assertTrue(isQualityTaskGroupFailed(failure));
      expect(A.map(failure.failures, (step) => step.label)).toEqual(
        A.map(A.take(body, shadcnIndex), (step) => step.label)
      );
    })
  );

  // The contrast: the same runner stops a fail-fast lane at its first red, so
  // the collecting result above comes from Repo Sanity's policy, not the runner.
  it.effect("stops a fail-fast lane at its first red step", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "jsdoc-ratchet-stop-" });
      const steps = [
        QualityTaskStep.make({ label: "scan", command: "bun", args: ["-e", "process.exit(3)"], cwd: dir }),
        QualityTaskStep.make({
          label: "compare",
          command: "bun",
          args: ["-e", `await Bun.write("${MARKER_FILE}", "yes")`],
          cwd: dir,
        }),
      ];
      const exit = yield* Effect.exit(runCiLaneSteps("jsdoc-ratchet", steps));
      const failed = Exit.isFailure(exit);
      assertTrue(failed);
      const compareRan = yield* fs.exists(path.join(dir, MARKER_FILE));
      expect(compareRan).toBe(false);
    })
  );
});
