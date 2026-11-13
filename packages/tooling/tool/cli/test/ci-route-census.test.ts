import {
  ChangeAtom,
  ChangeClassifier,
  ChangeSet,
  CI_LANE_ID_VALUES,
  HostedJob,
  HostedRun,
  HostedStep,
  HostedTaskOutcome,
  RouteCensusReader,
  RouteCorpusLoaded,
  RouteCorpusReceipt,
  RouteError,
  RouteRedOrigin,
  RouteStepClass,
  routeFootprintCanonicalJson,
  VerificationRoute,
} from "@beep/repo-cli/commands/Ci";
import {
  ciLaneOfPrePushLaneId,
  ensureRouteHeads,
  hostedJobAttribution,
  hostedJobCostMs,
  hostedJobRedOrigin,
  hostedLaneJobs,
  jobNameToLane,
  missingFromBatchCheck,
  orderSelectedLanes,
  prePushLaneId,
  ROUTE_SETUP_STEP_NAMES,
  RouteCensusReaderLive,
  RouteGit,
  routeJobMinutes,
  routeRedOriginChargesLane,
  routeStepClass,
  verificationRouteLayer,
} from "@beep/repo-cli/commands/Ci/RouteCensus";
import { sha256Hex } from "@beep/repo-cli/test/Goals";
import { githubCheckPrePushLanes } from "@beep/repo-cli/test/Quality";
import { DEFAULT_GATE_ORDER_SEED, orderWaveLanes, WaveOrder } from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import { NodeCrypto } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import censusRunsJson from "./fixtures/ci-route/census/census-runs.json" with { type: "json" };
import partitionRunsJson from "./fixtures/ci-route/census/partition-runs-2026-11-12.json" with { type: "json" };
import replayRunsJson from "./fixtures/ci-route/census/replay-runs.json" with { type: "json" };
import { parseWorkflowYaml, yamlAt } from "./support/WorkflowYaml.ts";
import type {
  ChangeAtomKind,
  CiLaneId,
  RouteCensus,
  RouteLaneCost,
  RouteReplay,
  RouteTaskOutcome,
} from "@beep/repo-cli/commands/Ci";

const decodeRuns = S.decodeUnknownEffect(S.Array(HostedRun));

const atom = (kind: ChangeAtomKind, path: string): ChangeAtom => ChangeAtom.make({ kind, path, digest: "00" });

const classifierLayer = (atomsFor: (head: string) => ReadonlyArray<ChangeAtom>) =>
  Layer.succeed(
    ChangeClassifier,
    ChangeClassifier.of({
      classify: Effect.fn("ChangeClassifier.classify")(function* (input) {
        return ChangeSet.make({ base: input.base, head: input.head, changedPaths: [], atoms: atomsFor(input.head) });
      }),
    })
  );

// Fails for any head outside the table, so a test proves a head was never classified.
const strictClassifierLayer = (table: Readonly<Record<string, ReadonlyArray<ChangeAtom>>>) =>
  Layer.succeed(
    ChangeClassifier,
    ChangeClassifier.of({
      classify: Effect.fn("ChangeClassifier.classify")(function* (input) {
        const atoms = yield* Effect.fromOption(R.get(table, input.head)).pipe(
          Effect.mapError(() => RouteError.new("classify", `unexpected classify of ${input.head}`))
        );
        return ChangeSet.make({ base: input.base, head: input.head, changedPaths: [], atoms });
      }),
    })
  );

const atomsByHead =
  (table: Readonly<Record<string, ReadonlyArray<ChangeAtom>>>) =>
  (head: string): ReadonlyArray<ChangeAtom> =>
    O.getOrElse(R.get(table, head), () => A.empty<ChangeAtom>());

const allUnknown = (): ReadonlyArray<ChangeAtom> => [atom("unknown", "mystery.bin")];
const noAtoms = (): ReadonlyArray<ChangeAtom> => A.empty<ChangeAtom>();

const gitLayer = (
  mergeBases: Readonly<Record<string, string>>,
  ancestors: ReadonlyArray<readonly [ancestor: string, descendant: string]>,
  ensured: Ref.Ref<ReadonlyArray<ReadonlyArray<string>>>,
  unresolved: ReadonlyArray<string> = []
) =>
  Layer.succeed(
    RouteGit,
    RouteGit.of({
      repoRoot: Effect.succeed("/repo"),
      mergeBase: Effect.fn("RouteGit.mergeBase")(function* (head) {
        return yield* Effect.fromOption(R.get(mergeBases, head)).pipe(
          Effect.mapError(() => RouteError.new("git", `no merge base for ${head}`))
        );
      }),
      isAncestor: Effect.fn("RouteGit.isAncestor")(function* (ancestor, descendant) {
        // Like git: a commit missing from the object store fails the check.
        if (A.contains(unresolved, ancestor)) {
          return yield* RouteError.new("git", `git merge-base --is-ancestor ${ancestor} ${descendant} exited 128.`);
        }
        return A.some(ancestors, ([from, to]) => from === ancestor && to === descendant);
      }),
      ensureHeads: Effect.fn("RouteGit.ensureHeads")(function* (shas) {
        yield* Ref.update(ensured, A.append(shas));
        return A.filter(shas, (sha) => A.contains(unresolved, sha));
      }),
    })
  );

const corpusOf = (runs: ReadonlyArray<HostedRun>): RouteCorpusLoaded =>
  RouteCorpusLoaded.make({
    receipt: RouteCorpusReceipt.make({
      schemaVersion: "route-corpus/v1",
      capturedAt: "2026-10-31T00:00:00Z",
      since: "2026-09-01",
      until: "2026-10-31",
      workflows: ["Check"],
      runs: runs.length,
      heads: A.dedupe(A.map(runs, (run) => run.headSha)).length,
      path: "goals/verification-route/research/corpus/runs.json",
      sha256: "c0ffee",
    }),
    runs,
  });

const readerLayer = (
  classifier: Layer.Layer<ChangeClassifier>,
  git: Layer.Layer<RouteGit>
): Layer.Layer<RouteCensusReader, RouteError> =>
  RouteCensusReaderLive.pipe(Layer.provide(Layer.mergeAll(classifier, git, NodeCrypto.layer)));

const runCensus = (
  runs: ReadonlyArray<HostedRun>,
  classifier: Layer.Layer<ChangeClassifier>,
  git: Layer.Layer<RouteGit>
): Effect.Effect<RouteCensus, RouteError> =>
  Effect.gen(function* () {
    const reader = yield* RouteCensusReader;
    return yield* reader.census(corpusOf(runs));
  }).pipe(provideScopedLayer(readerLayer(classifier, git)));

const runReplay = (
  runs: ReadonlyArray<HostedRun>,
  classifier: Layer.Layer<ChangeClassifier>,
  git: Layer.Layer<RouteGit>
): Effect.Effect<RouteReplay, RouteError> =>
  Effect.gen(function* () {
    const reader = yield* RouteCensusReader;
    return yield* reader.replay(corpusOf(runs));
  }).pipe(provideScopedLayer(readerLayer(classifier, git)));

const costOf = (costs: ReadonlyArray<RouteLaneCost>, lane: CiLaneId): O.Option<RouteLaneCost> =>
  A.findFirst(costs, (cost) => cost.lane === lane);

// Replay fixture git: a1 forks at m1 (a main run exists), b2 at m9 (no run;
// m0 is its nearest ancestor with one, m2 is newer and not an ancestor), c3 at
// zz (no ancestor run at all).
const REPLAY_MERGE_BASES = { a1: "m1", b2: "m9", c3: "zz" };
const REPLAY_ANCESTORS: ReadonlyArray<readonly [string, string]> = [["m0", "m9"]];

// Lanes a change with no atoms skips: every lane but the external security lane.
const SKIPPED_WITHOUT_ATOMS = CI_LANE_ID_VALUES.length - 1;

const LANES_WITHOUT_PRE_PUSH_TWIN: ReadonlyArray<CiLaneId> = [
  "docs-policy",
  "ecosystem",
  "fallow",
  "labs",
  "property",
  "repo-sanity",
];

describe("route joins", () => {
  it("joins hosted job names to lanes through the descriptor context", () => {
    assertSome(jobNameToLane("Heavy / Check"), "check");
    assertSome(jobNameToLane("Lint (lint-a)"), "lint");
    assertSome(jobNameToLane("Test Unit (repo-cli-1)"), "test-unit");
    assertSome(jobNameToLane("Security"), "security");
    assertNone(jobNameToLane("PR Size Label"));
  });

  it("joins Test Integration partitions and earlier or conditional context names to their lane", () => {
    assertSome(jobNameToLane("Test Integration (lps-int-1)"), "test-integration");
    assertSome(jobNameToLane("Test Integration (int-rest)"), "test-integration");
    assertSome(jobNameToLane("Heavy / Test Integration"), "test-integration");
    assertSome(jobNameToLane("Test Integration Partitions"), "test-integration");
    assertSome(jobNameToLane("Coverage Artifact Migration"), "coverage");
    assertSome(jobNameToLane("Build"), "build");
    assertSome(jobNameToLane("Property Laws (property-a)"), "property");
    assertNone(jobNameToLane("Test Integration"));
    assertNone(jobNameToLane("Test Plan"));
  });

  it("joins quality:<lane> pre-push ids to lanes both ways", () => {
    expect(prePushLaneId("docgen")).toBe("quality:docgen");
    assertSome(ciLaneOfPrePushLaneId("quality:docgen"), "docgen");
    assertNone(ciLaneOfPrePushLaneId("quality:cache-policy"));
    assertNone(ciLaneOfPrePushLaneId("repo-sanity:versions"));
  });

  it("orders twins by the given order and appends lanes without a twin in lane-id order", () => {
    const specs = githubCheckPrePushLanes("/repo", []);
    const selected = HashSet.fromIterable<CiLaneId>(["labs", "check", "lint"]);
    expect(orderSelectedLanes(selected, (lanes) => lanes, specs)).toEqual(["lint", "check", "labs"]);
    expect(orderSelectedLanes(selected, A.reverse, specs)).toEqual(["check", "lint", "labs"]);
  });

  it("reads missing commits from a batch-check report", () => {
    expect(missingFromBatchCheck(["aa", "bb", "cc", "dd"], "aa commit 250\nbb missing\ncc tree 31\n")).toEqual([
      "bb",
      "cc",
      "dd",
    ]);
  });
});

describe("route job attribution", () => {
  it.effect("maps every job of a post-#3046 Check run and conserves its machine time", () =>
    Effect.gen(function* () {
      // Check run 43322847791 (2026-11-12), every attempt-1 job: 20 Test Integration and 24 Test Unit
      // partitions, four Property Laws slices, their aggregates, Test Plan and the producer pilot.
      const runs = yield* decodeRuns(partitionRunsJson);
      const minutes = routeJobMinutes(runs);

      expect(minutes.jobs).toBe(80);
      expect(minutes.unknownJobs).toBe(0);
      expect(minutes.unknownNames).toEqual([]);
      // The guard is the literal per-class time, re-derived from the fixture's raw timestamps: 336.67 min of
      // machine time, 4 min of it support jobs, all the rest on lanes.
      const rawMs = Num.sumAll(
        A.getSomes(
          A.map(
            A.flatMap(runs, (run) => run.jobs),
            hostedJobCostMs
          )
        )
      );
      expect(rawMs).toBe(20_200_000);
      expect([minutes.totalMs, minutes.laneMs, minutes.supportMs, minutes.unknownMs]).toEqual([
        20_200_000, 19_960_000, 240_000, 0,
      ]);

      const lanes = A.map(hostedLaneJobs(runs), ([lane]) => lane);
      const jobsOf = (lane: CiLaneId): number =>
        A.filter(lanes, (candidate) => Str.Equivalence(candidate, lane)).length;
      expect(lanes.length).toBe(minutes.laneJobs);
      expect(jobsOf("test-integration")).toBe(21);
      expect(jobsOf("test-unit")).toBe(25);
      expect(jobsOf("property")).toBe(5);
      expect(jobsOf("lint")).toBe(3);
      expect(minutes.supportJobs).toBe(8);
      expect(hostedJobAttribution("Test Plan").jobClass).toBe("support");
    })
  );

  it("reports a job no rule matches as unknown, with its time, never dropped", () => {
    const run = HostedRun.make({
      runId: 7,
      workflow: "Check",
      event: "pull_request",
      headBranch: "feat/x",
      headSha: "u1",
      createdAt: "2026-10-01T00:00:00Z",
      attempt: 1,
      jobs: [
        HostedJob.make({
          name: "Knip",
          startedAt: O.some("2026-10-01T00:00:00Z"),
          completedAt: O.some("2026-10-01T00:02:00Z"),
        }),
        HostedJob.make({
          name: "Knip",
          startedAt: O.some("2026-10-01T00:00:00Z"),
          completedAt: O.some("2026-10-01T00:01:00Z"),
        }),
        HostedJob.make({
          name: "Heavy Admission",
          startedAt: O.some("2026-10-01T00:00:00Z"),
          completedAt: O.some("2026-10-01T00:00:10Z"),
        }),
        HostedJob.make({ name: "Shadcn Lint" }),
        HostedJob.make({
          name: "Test Integration (lps-int-2)",
          startedAt: O.some("2026-10-01T00:00:00Z"),
          completedAt: O.some("2026-10-01T00:05:00Z"),
        }),
      ],
    });
    const minutes = routeJobMinutes([run]);

    expect([minutes.laneJobs, minutes.supportJobs, minutes.unknownJobs, minutes.jobs]).toEqual([1, 1, 3, 5]);
    expect([minutes.laneMs, minutes.supportMs, minutes.unknownMs, minutes.totalMs]).toEqual([
      300_000, 10_000, 180_000, 490_000,
    ]);
    expect(minutes.unknownNames).toEqual(["Knip", "Shadcn Lint"]);
    assertNone(hostedJobAttribution("Knip").lane);
  });
});

const step = (name: string, conclusion?: string): HostedStep =>
  HostedStep.make({ name, conclusion: O.fromUndefinedOr(conclusion) });

const tasks = (...outcomes: ReadonlyArray<RouteTaskOutcome>): O.Option<ReadonlyArray<HostedTaskOutcome>> =>
  O.some(A.map(outcomes, (outcome, index) => HostedTaskOutcome.make({ task: `@beep/pkg-${index}#test`, outcome })));

const failedJob = (
  name: string,
  steps: O.Option<ReadonlyArray<HostedStep>>,
  outcomes: O.Option<ReadonlyArray<HostedTaskOutcome>> = O.none()
): HostedJob => HostedJob.make({ name, conclusion: O.some("failure"), steps, tasks: outcomes });

// A job that failed while installing dependencies, before its lane ran.
const SETUP_FAILURE: ReadonlyArray<HostedStep> = [
  step("Set up job", "success"),
  step("Checkout repository", "success"),
  step("Setup monorepo CI", "failure"),
  step("Run verification lane", "skipped"),
  step("Complete job", "success"),
];

describe("route red origins", () => {
  it("classes steps as setup, aggregate or the lane's own work", () => {
    expect(
      A.map(
        [
          "Set up job",
          "Checkout repository",
          "Setup monorepo CI",
          "Determine lane execution",
          "Require every planned Test Unit shard",
          "Require every Lint shard",
          "Require independent frozen trial selection",
          "Run Test Unit shard",
          "Post Run actions/checkout",
        ],
        routeStepClass
      )
    ).toEqual(["setup", "setup", "setup", "setup", "aggregate", "aggregate", "task", "task", "task"]);
  });

  it("reads a failed job's red origin from the step it stopped in and its tasks", () => {
    const originOf = (job: HostedJob): string => O.getOrElse(hostedJobRedOrigin(job), () => "none");
    const lane = step("Run Test Unit shard", "failure");
    expect(
      A.map(
        [
          HostedJob.make({ name: "Lint", conclusion: O.some("success") }),
          HostedJob.make({ name: "Lint", conclusion: O.some("cancelled"), steps: O.some(SETUP_FAILURE) }),
          failedJob("Heavy / Check", O.none()),
          failedJob("Heavy / Check", O.some([])),
          failedJob("Heavy / Check", O.some([step("Set up job", "success"), step("Run verification lane", "success")])),
          failedJob("Heavy / Check", O.some(SETUP_FAILURE)),
          failedJob(
            "Test Unit",
            O.some([step("Set up job", "success"), step("Require every planned Test Unit shard", "failure")])
          ),
          failedJob(
            "Test Unit (unit-a)",
            O.some([step("Set up job", "success"), lane, step("Complete job", "success")])
          ),
          // A timeout or a lost runner: the step running at the time never concluded.
          failedJob("Heavy / Check", O.some([step("Set up job", "success"), step("Run verification lane")])),
          failedJob("Heavy / Check", O.some([step("Set up job"), step("Checkout repository")])),
          failedJob("Heavy / Docgen", O.some([step("Set up job", "success"), step("Setup monorepo CI", "cancelled")])),
          // The failed step decides over an earlier one that was cancelled.
          failedJob(
            "Heavy / Docgen",
            O.some([step("Restore main Docgen Turbo cache", "cancelled"), step("Run verification lane", "failure")])
          ),
          // A failed task decides; every task passing moves a lane-step red to the harness.
          failedJob("Test Unit (unit-a)", O.some(SETUP_FAILURE), tasks("pass", "fail")),
          failedJob("Test Unit (unit-a)", O.some([lane]), tasks("pass", "pass")),
          failedJob("Test Unit (unit-a)", O.none(), tasks("pass")),
          failedJob("Test Unit (unit-a)", O.some([lane]), tasks("pass", "not-run")),
          failedJob("Test Unit (unit-a)", O.none(), tasks("unknown")),
          failedJob("Test Unit (unit-a)", O.some(SETUP_FAILURE), tasks("pass")),
        ],
        originOf
      )
    ).toEqual([
      "none",
      "none",
      "unattributed",
      "unattributed",
      "unattributed",
      "setup",
      "aggregate",
      "task",
      "task",
      "setup",
      "setup",
      "task",
      "task",
      "harness",
      "harness",
      "task",
      "unattributed",
      "setup",
    ]);
  });

  it("charges only task and unattributed reds to the lane", () => {
    expect(A.map(RouteRedOrigin.literals, (origin) => [origin, routeRedOriginChargesLane(origin)])).toEqual([
      ["task", true],
      ["aggregate", false],
      ["setup", false],
      ["harness", false],
      ["unattributed", true],
    ]);
  });
});

// The step-class contract reads the workflows the way GitHub lists their jobs. GitHub lists a job's own steps
// only: a composite action's steps (setup-monorepo-ci, fetch-beep-ci) run inside the step that calls it and are
// never listed, so the workflow files hold every step name the jobs API can report. A job of a reusable workflow
// reports as `<caller> / <job>`.
const WorkflowStepDoc = S.Struct({
  name: S.String.pipe(S.optionalKey),
  uses: S.String.pipe(S.optionalKey),
  run: S.String.pipe(S.optionalKey),
});
type WorkflowStepDoc = typeof WorkflowStepDoc.Type;
const WorkflowJobDoc = S.Struct({
  name: S.String.pipe(S.optionalKey),
  uses: S.String.pipe(S.optionalKey),
  steps: WorkflowStepDoc.pipe(S.Array, S.optionalKey),
});
const decodeWorkflowJobs = S.decodeUnknownEffect(S.Record(S.String, WorkflowJobDoc));

// Every workflow, read as text at import time, keyed by its path relative to this file.
const WORKFLOW_TEXTS = import.meta.glob<string>("../../../../../.github/workflows/*.yml", {
  eager: true,
  import: "default",
  query: "?raw",
});
const CHECK_WORKFLOW = ".github/workflows/check.yml";
const REUSABLE_WORKFLOW = /\.github\/workflows\/[^@\s]+/u;
const MATRIX_EXPRESSION = /\$\{\{\s*matrix\.[^}]*\}\}/gu;
const QUOTED_LITERAL = /'([^']*)'/gu;

// GitHub adds these steps itself; no workflow names them.
const GITHUB_IMPLICIT_STEPS: ReadonlyArray<string> = ["Set up job", "Set up runner"];
// The step that starts each lane's own work; an aggregate job's `Require every …` step starts it too.
const LANE_WORK_ENTRY_STEPS: ReadonlyArray<string> = [
  "Compare coverage evidence",
  "Gitleaks",
  "OSV vulnerability scan",
  "Run JSDoc inventory ratchet",
  "Run Fallow envelopes",
  "Run Labs lane",
  "Run Lint shard",
  "Run Nix checks",
  "Run SAST",
  "Run Test Integration partition",
  "Run Test Unit shard",
  "Run commitlint",
  "Run desktop IPC stdio proof",
  "Run docs policy lane",
  "Run property laws lane",
  "Run verification lane",
];
// Steps that run before a lane's entry step and are classified as the lane's own work on purpose, so their reds
// stay on the lane: Repo Sanity's documentation and merge-driver checks, and the coverage comparison's
// evidence authentication and download (missing evidence is that lane's verdict).
const LANE_WORK_PRELUDE_STEPS: ReadonlyArray<string> = [
  "Authenticate latest Labs execution",
  "Check documentation sanity",
  "Download coverage evidence",
  "Verify regenerate merge-driver bootstrap",
];

type ContractJob = {
  readonly job: string;
  readonly lanes: ReadonlyArray<CiLaneId>;
  readonly steps: ReadonlyArray<string>;
};

// An unnamed step is listed as `Run <action>` or `Run <first command line>`.
const listedStepName = (step: WorkflowStepDoc): string =>
  O.getOrElse(
    O.fromUndefinedOr(step.name),
    () =>
      `Run ${O.getOrElse(O.fromUndefinedOr(step.uses), () =>
        A.headNonEmpty(
          Str.split(
            O.getOrElse(O.fromUndefinedOr(step.run), () => ""),
            "\n"
          )
        )
      )}`
  );

// A matrix leg reports its partition (`p` stands in); a conditional name reports one of the literals it quotes.
const hostedNamesOf = (prefix: string, name: string): ReadonlyArray<string> => {
  const expanded = Str.replace(MATRIX_EXPRESSION, "p")(name);
  const names = Str.includes("${{")(expanded)
    ? A.getSomes(A.map(A.fromIterable(Str.matchAll(QUOTED_LITERAL)(expanded)), (match) => O.fromUndefinedOr(match[1])))
    : [expanded];
  return A.map(names, (candidate) => `${prefix}${candidate}`);
};

const contractJobsOf = (
  workflow: string,
  prefix: string,
  jobs: Readonly<Record<string, typeof WorkflowJobDoc.Type>>
): ReadonlyArray<ContractJob> =>
  A.map(R.toEntries(jobs), ([key, job]) => ({
    job: `${workflow}#${key}`,
    lanes: A.dedupe(
      A.getSomes(
        A.map(
          hostedNamesOf(
            prefix,
            O.getOrElse(O.fromUndefinedOr(job.name), () => key)
          ),
          (name) => hostedJobAttribution(name).lane
        )
      )
    ),
    steps: A.map(O.getOrElse(O.fromUndefinedOr(job.steps), A.empty<WorkflowStepDoc>), listedStepName),
  }));

const readWorkflowJobs = Effect.fnUntraced(function* (file: string) {
  const text = yield* Effect.fromOption(
    O.map(
      A.findFirst(R.toEntries(WORKFLOW_TEXTS), ([key]) => Str.endsWith(file)(key)),
      ([, workflow]) => workflow
    )
  );
  return yield* decodeWorkflowJobs(yamlAt(parseWorkflowYaml(text), ["jobs"]));
});

// Every lane job of check.yml and of each reusable workflow a check.yml job calls (heavy.yml).
const workflowLaneJobs = Effect.fnUntraced(function* () {
  const check = yield* readWorkflowJobs(CHECK_WORKFLOW);
  const callers = A.getSomes(
    A.map(R.toEntries(check), ([key, job]) =>
      pipe(
        O.fromUndefinedOr(job.uses),
        O.flatMap(Str.match(REUSABLE_WORKFLOW)),
        O.map((match) => [`${O.getOrElse(O.fromUndefinedOr(job.name), () => key)} / `, match[0]] as const)
      )
    )
  );
  const called = yield* Effect.forEach(callers, ([prefix, file]) =>
    Effect.map(readWorkflowJobs(file), (jobs) => contractJobsOf(file, prefix, jobs))
  );
  return A.filter(A.appendAll(contractJobsOf(CHECK_WORKFLOW, "", check), A.flatten(called)), (job) =>
    A.isReadonlyArrayNonEmpty(job.lanes)
  );
});

const startsLaneWork = (name: string): boolean =>
  RouteStepClass.is.aggregate(routeStepClass(name)) || A.contains(LANE_WORK_ENTRY_STEPS, name);
const isSetupStep = (name: string): boolean => RouteStepClass.is.setup(routeStepClass(name));

// Every step before a lane job's own work is a setup step or declared lane work, and no setup step follows it,
// so a renamed or new setup step fails here instead of charging the lane in silence.
const stepContractViolations = (job: ContractJob): ReadonlyArray<string> =>
  O.match(A.findFirstIndex(job.steps, startsLaneWork), {
    onNone: () => [`${job.job}: no step starts the lane's own work`],
    onSome: (entry) =>
      A.appendAll(
        A.map(
          A.filter(
            A.take(job.steps, entry),
            (name) => !isSetupStep(name) && !A.contains(LANE_WORK_PRELUDE_STEPS, name)
          ),
          (name) => `${job.job}: "${name}" runs before the lane's work and is neither setup nor declared lane work`
        ),
        A.map(
          A.filter(A.drop(job.steps, entry + 1), isSetupStep),
          (name) => `${job.job}: setup step "${name}" runs after the lane's work`
        )
      ),
  });

describe("route step contract", () => {
  it("names a step that breaks the contract", () => {
    const job = (steps: ReadonlyArray<string>): ContractJob => ({
      job: "check.yml#lint-shard",
      lanes: ["lint"],
      steps,
    });
    expect(
      A.flatMap(
        [
          job(["Checkout repository", "Setup monorepo CI", "Run Lint shard", "Skip lane"]),
          job(["Checkout repository", "Setup Python", "Run Lint shard"]),
          job(["Checkout repository", "Prepare monorepo CI"]),
          job(["Run Lint shard", "Setup monorepo CI"]),
        ],
        stepContractViolations
      )
    ).toEqual([
      'check.yml#lint-shard: "Setup Python" runs before the lane\'s work and is neither setup nor declared lane work',
      "check.yml#lint-shard: no step starts the lane's own work",
      'check.yml#lint-shard: setup step "Setup monorepo CI" runs after the lane\'s work',
    ]);
  });
});

describe("route step contract over the workflows", () => {
  it.effect("keeps the setup step names in step with the lane jobs of check.yml and the workflows it calls", () =>
    Effect.gen(function* () {
      const jobs = yield* workflowLaneJobs();
      const listed = HashSet.fromIterable(A.flatMap(jobs, (job) => job.steps));
      const covered = HashSet.fromIterable(A.flatMap(jobs, (job) => job.lanes));
      // The reusable heavy.yml call, the shards and their aggregates are all read.
      assertTrue(
        A.every(["check", "lint-policy", "lint", "test-unit", "test-integration", "property", "coverage"], (lane) =>
          HashSet.has(covered, lane)
        )
      );
      // Every listed setup name is GitHub's own or still a step of a lane job.
      expect(
        A.filter(
          ROUTE_SETUP_STEP_NAMES,
          (name) => !A.contains(GITHUB_IMPLICIT_STEPS, name) && !HashSet.has(listed, name)
        )
      ).toEqual([]);
      expect(A.filter(GITHUB_IMPLICIT_STEPS, (name) => !A.contains(ROUTE_SETUP_STEP_NAMES, name))).toEqual([]);
      // The declared lane work exists and is classed as the lane's own.
      expect(
        A.filter(
          A.appendAll(LANE_WORK_ENTRY_STEPS, LANE_WORK_PRELUDE_STEPS),
          (name) => !HashSet.has(listed, name) || !RouteStepClass.is.task(routeStepClass(name))
        )
      ).toEqual([]);
      expect(A.flatMap(jobs, stepContractViolations)).toEqual([]);
    })
  );
});

describe("route head fetch", () => {
  it.effect("fetches only when a head is missing, then each head still missing by sha, and returns the rest", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<string>>([]);
      const present = yield* Ref.make(HashSet.fromIterable(["a1", "c3"]));
      const record = (call: string) => Ref.update(calls, A.append(call));
      const ensure = ensureRouteHeads({
        fetchCommit: Effect.fn("RouteGit.fetchCommit")(function* (sha) {
          yield* record(`fetch ${sha}`);
          // The remote still serves b2 by sha; d4 is gone.
          if (sha === "b2") {
            yield* Ref.update(present, HashSet.add(sha));
          }
        }),
        fetchPullHeads: record("fetch pull refs"),
        missingCommits: Effect.fn("RouteGit.missingCommits")(function* (shas) {
          yield* record(`check ${A.join(shas, ",")}`);
          const have = yield* Ref.get(present);
          return A.filter(shas, (sha) => !HashSet.has(have, sha));
        }),
      });

      const ensure1 = yield* ensure(["a1", "b2", "c3", "d4"]);
      expect(ensure1).toEqual(["d4"]);
      const log = yield* Ref.get(calls);
      expect(A.take(log, 3)).toEqual(["check a1,b2,c3,d4", "fetch pull refs", "check a1,b2,c3,d4"]);
      expect(
        A.sort(
          A.filter(log, (call) => Str.startsWith("fetch ")(call) && call !== "fetch pull refs"),
          Str.Order
        )
      ).toEqual(["fetch b2", "fetch d4"]);
      assertSome(A.last(log), "check b2,d4");
      expect(log).toHaveLength(6);

      // Every head already local: one object-store check, no network.
      yield* Ref.set(calls, []);
      const ensure2 = yield* ensure(["a1", "b2", "c3"]);
      expect(ensure2).toEqual([]);
      const got = yield* Ref.get(calls);
      expect(got).toEqual(["check a1,b2,c3"]);

      yield* Ref.set(calls, []);
      const ensure3 = yield* ensure([]);
      expect(ensure3).toEqual([]);
      const got4 = yield* Ref.get(calls);
      expect(got4).toEqual([]);
    })
  );
});

const planLayer = Layer.mergeAll(
  verificationRouteLayer((base, head) => Effect.succeed([`${base}:affected`, `${head}:affected`])).pipe(
    Layer.provide(Layer.mergeAll(WaveOrder.Default, NodeCrypto.layer))
  ),
  NodeCrypto.layer
);

it.layer(planLayer, { timeout: "30 seconds" })("verification route plan", (it) => {
  it.effect("selects every lane in wave order at all-unknown and skips none", () =>
    Effect.gen(function* () {
      const route = yield* VerificationRoute;
      const plan = yield* route.plan(
        ChangeSet.make({ base: "base", head: "head", changedPaths: ["mystery.bin"], atoms: allUnknown() })
      );

      const waved = A.flatMap(orderWaveLanes(DEFAULT_GATE_ORDER_SEED, githubCheckPrePushLanes("/repo", [])), (spec) =>
        A.filter(CI_LANE_ID_VALUES, (lane) => spec.id === `quality:${lane}`)
      );
      const lanes = A.map(plan.selected, (selection) => selection.lane);
      expect(lanes).toEqual(A.appendAll(waved, LANES_WITHOUT_PRE_PUSH_TWIN));
      expect(lanes).toHaveLength(CI_LANE_ID_VALUES.length);
      expect(A.every(CI_LANE_ID_VALUES, (lane) => A.contains(lanes, lane))).toBe(true);
      expect(A.every(plan.selected, (selection) => A.contains(selection.selectedBy, "unknown"))).toBe(true);
      expect(plan.skipped).toEqual([]);
      expect(plan.affectedPackages).toEqual(["base:affected", "head:affected"]);
      const expectation = expect(plan.footprintDigest);
      const sha256Hex1 = yield* sha256Hex(routeFootprintCanonicalJson());
      expectation.toBe(sha256Hex1);
    })
  );

  it.effect("selects only the external lanes for a change with no atoms", () =>
    Effect.gen(function* () {
      const route = yield* VerificationRoute;
      const plan = yield* route.plan(ChangeSet.make({ base: "base", head: "head", changedPaths: [], atoms: [] }));
      expect(A.map(plan.selected, (selection) => [selection.lane, selection.selectedBy])).toEqual([["security", []]]);
      expect(plan.skipped).toEqual(A.filter(CI_LANE_ID_VALUES, (lane) => lane !== "security"));
    })
  );
});

it.layer(NodeCrypto.layer)("route census", (it) => {
  const censusAtoms = atomsByHead({
    p1: [atom("pkg:catalog", "package.json")],
    x2: [atom("pkg:catalog", "package.json"), atom("docs:markdown", "README.md"), atom("unknown", "mystery.bin")],
  });

  it.effect("splits lane machine time into pure and mixed rows by atom kind", () =>
    Effect.gen(function* () {
      const runs = yield* decodeRuns(censusRunsJson);
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const census = yield* runCensus(
        runs,
        classifierLayer(censusAtoms),
        gitLayer({ p1: "m1", x2: "m1" }, [], ensured)
      );

      const got5 = yield* Ref.get(ensured);
      expect(got5).toEqual([["p1", "x2"]]);
      expect(census.heads).toBe(2);
      expect(census.classifiedHeads).toBe(2);
      expect(census.unknownAtomShare).toBe(0.25);
      expect(census.unresolvedHeads).toBe(0);
      expect(census.corpusSha256).toBe("c0ffee");
      const expectation1 = expect(census.footprintDigest);
      const sha256Hex2 = yield* sha256Hex(routeFootprintCanonicalJson());
      expectation1.toBe(sha256Hex2);
      // p1 (pure pkg:catalog): lint 60 s + 30 s shards, check 120 s; the PR Size
      // Label job has no lane and the untimed Test Unit shard has no cost.
      // x2 (mixed): lint 40 s + 10 s over two attempts (one head), check 90 s.
      expect(
        A.map(census.rows, (row) => [row.kind, row.lane, row.pureHeads, row.pureMs, row.mixedHeads, row.mixedMs])
      ).toEqual([
        ["pkg:catalog", "check", 1, 120_000, 1, 90_000],
        ["pkg:catalog", "lint", 1, 90_000, 1, 50_000],
        ["docs:markdown", "check", 0, 0, 1, 90_000],
        ["unknown", "check", 0, 0, 1, 90_000],
        ["docs:markdown", "lint", 0, 0, 1, 50_000],
        ["unknown", "lint", 0, 0, 1, 50_000],
      ]);
      // Every corpus job, the main push run's included: PR Size Label is support, the untimed
      // Test Unit shard counts with no time.
      expect(census.jobMinutes).toMatchObject({
        jobs: 10,
        laneJobs: 9,
        supportJobs: 1,
        unknownJobs: 0,
        totalMs: 390_000,
        laneMs: 385_000,
        supportMs: 5_000,
        unknownMs: 0,
        unknownNames: [],
      });
    })
  );

  it.effect("costs lint from the gate-order seed, property from the corpus, and labs from nothing", () =>
    Effect.gen(function* () {
      const runs = yield* decodeRuns(censusRunsJson);
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const census = yield* runCensus(
        runs,
        classifierLayer(censusAtoms),
        gitLayer({ p1: "m1", x2: "m1" }, [], ensured)
      );
      const seedLint = yield* Effect.fromOption(
        A.findFirst(DEFAULT_GATE_ORDER_SEED.lanes, (row) => row.laneId === "quality:lint")
      );

      expect(census.costs).toHaveLength(CI_LANE_ID_VALUES.length);
      const lint = yield* Effect.fromOption(costOf(census.costs, "lint"));
      expect(lint.basis).toBe("gate-order-seed");
      assertSome(lint.p50Ms, Math.round(seedLint.costP50Seconds * 1000));
      assertSome(lint.source, seedLint.durationPointer);

      const property = yield* Effect.fromOption(costOf(census.costs, "property"));
      expect(property.basis).toBe("hosted-median");
      assertSome(property.p50Ms, 20_000);

      const labs = yield* Effect.fromOption(costOf(census.costs, "labs"));
      expect(labs.basis).toBe("none");
      assertNone(labs.p50Ms);
      assertNone(labs.source);
    })
  );

  it.effect("counts a head missing after ensureHeads as one unknown atom without classifying it", () =>
    Effect.gen(function* () {
      const runs = yield* decodeRuns(censusRunsJson);
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      // x2 stays missing after ensureHeads; neither the classifier nor mergeBase knows it.
      const census = yield* runCensus(
        runs,
        strictClassifierLayer({ p1: [atom("pkg:catalog", "package.json")] }),
        gitLayer({ p1: "m1" }, [], ensured, ["x2"])
      );

      const got6 = yield* Ref.get(ensured);
      expect(got6).toEqual([["p1", "x2"]]);
      expect(census.heads).toBe(2);
      expect(census.unresolvedHeads).toBe(1);
      expect(census.unknownAtomShare).toBe(0.5);
      // x2's only kind is the unknown atom, so its lane time is pure unknown time.
      expect(
        A.map(census.rows, (row) => [row.kind, row.lane, row.pureHeads, row.pureMs, row.mixedHeads, row.mixedMs])
      ).toEqual([
        ["pkg:catalog", "check", 1, 120_000, 0, 0],
        ["pkg:catalog", "lint", 1, 90_000, 0, 0],
        ["unknown", "check", 1, 90_000, 0, 0],
        ["unknown", "lint", 1, 50_000, 0, 0],
      ]);
    })
  );

  it.effect("judges purity over tree kinds, so commits metadata alone is pure only on an empty-tree head", () =>
    Effect.gen(function* () {
      const runs = yield* decodeRuns(censusRunsJson);
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const census = yield* runCensus(
        runs,
        strictClassifierLayer({
          p1: [atom("packet", "goals/x/PLAN.md"), atom("commits", "base..head")],
          x2: [atom("commits", "base..head")],
        }),
        gitLayer({ p1: "m1", x2: "m1" }, [], ensured)
      );

      // p1 {packet, commits}: pure for packet, mixed for commits (it has a tree kind).
      // x2 {commits}: an empty-tree head, pure for commits.
      expect(
        A.map(census.rows, (row) => [row.kind, row.lane, row.pureHeads, row.pureMs, row.mixedHeads, row.mixedMs])
      ).toEqual([
        ["packet", "check", 1, 120_000, 0, 0],
        ["commits", "check", 1, 90_000, 1, 120_000],
        ["packet", "lint", 1, 90_000, 0, 0],
        ["commits", "lint", 1, 50_000, 1, 90_000],
      ]);
    })
  );

  it.effect("counts unclassified heads without rows", () =>
    Effect.gen(function* () {
      const runs = yield* decodeRuns(replayRunsJson);
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const census = yield* runCensus(
        runs,
        classifierLayer(noAtoms),
        gitLayer(REPLAY_MERGE_BASES, REPLAY_ANCESTORS, ensured)
      );
      expect(census.heads).toBe(3);
      expect(census.classifiedHeads).toBe(0);
      expect(census.unknownAtomShare).toBe(0);
      expect(census.rows).toEqual([]);
    })
  );
});

describe("route replay", () => {
  for (const missing of [true, false]) {
    it.effect(`counts skipped failures against ${missing ? "missing" : "cancelled"} base lane results`, () =>
      Effect.gen(function* () {
        const original = yield* decodeRuns(replayRunsJson);
        const runs = A.map(original, (run) =>
          run.headSha === "m1"
            ? HostedRun.make({
                ...run,
                jobs: missing
                  ? A.filter(run.jobs, (job) => job.name !== "Heavy / Check")
                  : A.map(run.jobs, (job) =>
                      job.name === "Heavy / Check" ? HostedJob.make({ ...job, conclusion: O.some("cancelled") }) : job
                    ),
              })
            : run
        );
        const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const replay = yield* runReplay(
          runs,
          classifierLayer(noAtoms),
          gitLayer(REPLAY_MERGE_BASES, REPLAY_ANCESTORS, ensured)
        );
        const head = yield* Effect.fromOption(A.findFirst(replay.perHead, (row) => row.headSha === "a1"));
        expect(head.skippedReds).toEqual(["check"]);
        expect(head.baseUnknown).toBe(true);
        expect(replay.baseUnknownHeads).toBe(2);
        expect(replay.skippedReds).toBe(3);
      })
    );
  }

  it.effect("marks recall uncertain when a skipping head has a failed job no rule maps", () =>
    Effect.gen(function* () {
      const original = yield* decodeRuns(replayRunsJson);
      // A renamed check job fails on a1, whose route skips check: the replay cannot see it as a skipped red.
      const runs = A.map(original, (run) =>
        run.headSha === "a1"
          ? HostedRun.make({
              ...run,
              jobs: A.append(run.jobs, HostedJob.make({ name: "Heavy / Typecheck", conclusion: O.some("failure") })),
            })
          : run
      );
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const clean = yield* runReplay(
        original,
        classifierLayer(noAtoms),
        gitLayer(REPLAY_MERGE_BASES, REPLAY_ANCESTORS, ensured)
      );
      const marked = yield* runReplay(
        runs,
        classifierLayer(noAtoms),
        gitLayer(REPLAY_MERGE_BASES, REPLAY_ANCESTORS, ensured)
      );
      expect([clean.recallCertain, clean.unknownRedHeads]).toEqual([true, 0]);
      expect([marked.recallCertain, marked.unknownRedHeads, marked.unknownRedJobNames]).toEqual([
        false,
        1,
        ["Heavy / Typecheck"],
      ]);
      expect(marked.recall).toBe(clean.recall);
    })
  );

  it.effect("charges a skipped lane's setup or aggregate red to no lane and reports it as unknown", () =>
    Effect.gen(function* () {
      const original = yield* decodeRuns(replayRunsJson);
      const jobsOf = (headSha: string, jobs: ReadonlyArray<HostedJob>): ReadonlyArray<HostedJob> =>
        Match.value(headSha).pipe(
          // a1's check failed while installing.
          Match.when("a1", () =>
            A.map(jobs, (job) => (job.name === "Heavy / Check" ? failedJob(job.name, O.some(SETUP_FAILURE)) : job))
          ),
          // b2's sast red stays charged, and codegen is red on its base: neither setup red can hide a skip.
          Match.when("b2", () =>
            A.appendAll(jobs, [
              failedJob("SAST", O.some(SETUP_FAILURE)),
              failedJob("Codegen Drift", O.some(SETUP_FAILURE)),
            ])
          ),
          // c3's only lint red is the aggregate's: its shard was cancelled, not failed.
          Match.when("c3", () => [
            HostedJob.make({ name: "Lint (lint-a)", conclusion: O.some("cancelled") }),
            failedJob("Lint", O.some([step("Set up job", "success"), step("Require every Lint shard", "failure")])),
          ]),
          Match.orElse(() => jobs)
        );
      const runs = A.map(original, (run) => HostedRun.make({ ...run, jobs: jobsOf(run.headSha, run.jobs) }));
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const replay = yield* runReplay(
        runs,
        classifierLayer(noAtoms),
        gitLayer(REPLAY_MERGE_BASES, REPLAY_ANCESTORS, ensured)
      );

      expect(
        A.map(replay.perHead, (head) => [head.headSha, head.skippedReds, head.unknownReds, head.baseUnknown])
      ).toEqual([
        ["a1", [], ["check"], false],
        ["b2", ["sast"], [], false],
        ["c3", [], ["lint"], true],
      ]);
      expect(replay.skippedReds).toBe(1);
      expect(replay.recall).toBe(1 - 1 / (3 * SKIPPED_WITHOUT_ATOMS));
      expect([replay.recallCertain, replay.unknownRedHeads, replay.unknownRedJobNames]).toEqual([
        false,
        2,
        ["Heavy / Check", "Lint"],
      ]);
    })
  );

  it.effect("judges the base by charged reds, so a setup red on the base excuses no head red", () =>
    Effect.gen(function* () {
      const original = yield* decodeRuns(replayRunsJson);
      // m1, a1's base, fails Heavy / Check: with no steps the red is check's, while installing it is no one's.
      const withBaseCheck = (job: HostedJob) =>
        A.map(original, (run) =>
          run.headSha === "m1"
            ? HostedRun.make({
                ...run,
                jobs: A.map(run.jobs, (candidate) => (candidate.name === "Heavy / Check" ? job : candidate)),
              })
            : run
        );
      const replayA1 = Effect.fnUntraced(function* (runs: ReadonlyArray<HostedRun>) {
        const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const replay = yield* runReplay(
          runs,
          classifierLayer(noAtoms),
          gitLayer(REPLAY_MERGE_BASES, REPLAY_ANCESTORS, ensured)
        );
        const a1 = yield* Effect.fromOption(A.findFirst(replay.perHead, (head) => head.headSha === "a1"));
        return [a1.skippedReds, a1.unknownReds, a1.baseUnknown] as const;
      });

      const inherited = yield* replayA1(withBaseCheck(failedJob("Heavy / Check", O.none())));
      const uncharged = yield* replayA1(withBaseCheck(failedJob("Heavy / Check", O.some(SETUP_FAILURE))));
      expect(inherited).toEqual([[], [], false]);
      expect(uncharged).toEqual([["check"], [], true]);
    })
  );

  it.effect("has recall 1 at all-unknown", () =>
    Effect.gen(function* () {
      const runs = yield* decodeRuns(replayRunsJson);
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const replay = yield* runReplay(
        runs,
        classifierLayer(allUnknown),
        gitLayer(REPLAY_MERGE_BASES, REPLAY_ANCESTORS, ensured)
      );

      // Pull-request heads first, then the main candidates for base evidence.
      const got7 = yield* Ref.get(ensured);
      expect(got7).toEqual([
        ["a1", "b2", "c3"],
        ["m2", "m1", "m0"],
      ]);
      expect(replay.recall).toBe(1);
      expect(replay.skippedLaneRuns).toBe(0);
      expect(replay.skippedReds).toBe(0);
      expect(replay.baseUnknownHeads).toBe(1);
      expect(A.map(replay.perHead, (head) => head.headSha)).toEqual(["a1", "b2", "c3"]);
      expect(A.every(replay.perHead, (head) => head.selected.length === CI_LANE_ID_VALUES.length)).toBe(true);
      expect(A.every(replay.perHead, (head) => A.isReadonlyArrayEmpty(head.skipped))).toBe(true);
    })
  );

  it.effect(
    "counts a skipped red only when the lane was green on the base, and every red when the base is unknown",
    () =>
      Effect.gen(function* () {
        const runs = yield* decodeRuns(replayRunsJson);
        const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const replay = yield* runReplay(
          runs,
          classifierLayer(noAtoms),
          gitLayer(REPLAY_MERGE_BASES, REPLAY_ANCESTORS, ensured)
        );

        // With no atoms only the external security lane is selected.
        // a1: check red and green on m1 (counts).
        // b2: base is m0, the newest main run that is an ancestor of m9 (m2 is not,
        // and the feat/not-main push of m0 is no base); sast green there
        // (counts), codegen red there (inherited).
        // c3: no base run, so its lint red counts (fail-closed).
        expect(
          A.map(replay.perHead, (head) => [head.headSha, head.mergeBase, head.skippedReds, head.baseUnknown])
        ).toEqual([
          ["a1", "m1", ["check"], false],
          ["b2", "m9", ["sast"], false],
          ["c3", "zz", ["lint"], true],
        ]);
        expect(A.every(replay.perHead, (head) => A.contains(head.selected, "security"))).toBe(true);
        expect(A.every(replay.perHead, (head) => head.selected.length === 1)).toBe(true);
        expect(A.every(replay.perHead, (head) => head.skipped.length === SKIPPED_WITHOUT_ATOMS)).toBe(true);
        expect(replay.heads).toBe(3);
        expect(replay.skippedLaneRuns).toBe(3 * SKIPPED_WITHOUT_ATOMS);
        expect(replay.skippedReds).toBe(3);
        expect(replay.baseUnknownHeads).toBe(1);
        expect(replay.unresolvedHeads).toBe(0);
        expect(replay.recall).toBe(1 - 3 / (3 * SKIPPED_WITHOUT_ATOMS));
        expect(replay.corpusSha256).toBe("c0ffee");
        // Rows without steps or tasks keep every red on its lane: nothing is unknown.
        assertTrue(A.every(replay.perHead, (head) => A.isReadonlyArrayEmpty(head.unknownReds)));
        expect([replay.recallCertain, replay.unknownRedHeads]).toEqual([true, 0]);
      })
  );

  it.effect("skips a main candidate that stays missing instead of failing the replay", () =>
    Effect.gen(function* () {
      const runs = yield* decodeRuns(replayRunsJson);
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      // m2, the newest main run, cannot be fetched; asking git about it would fail.
      const replay = yield* runReplay(
        runs,
        classifierLayer(noAtoms),
        gitLayer(REPLAY_MERGE_BASES, REPLAY_ANCESTORS, ensured, ["m2"])
      );

      expect(
        A.map(replay.perHead, (head) => [head.headSha, head.mergeBase, head.skippedReds, head.baseUnknown])
      ).toEqual([
        ["a1", "m1", ["check"], false],
        ["b2", "m9", ["sast"], false],
        ["c3", "zz", ["lint"], true],
      ]);
    })
  );

  it.effect("selects every lane for an unresolved head and marks its base unknown", () =>
    Effect.gen(function* () {
      const runs = yield* decodeRuns(replayRunsJson);
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      // b2 stays missing after ensureHeads; neither the classifier nor mergeBase knows it.
      const replay = yield* runReplay(
        runs,
        strictClassifierLayer({ a1: [], c3: [] }),
        gitLayer({ a1: "m1", c3: "zz" }, REPLAY_ANCESTORS, ensured, ["b2"])
      );

      expect(
        A.map(replay.perHead, (head) => [head.headSha, head.mergeBase, head.skippedReds, head.baseUnknown])
      ).toEqual([
        ["a1", "m1", ["check"], false],
        ["b2", "<unresolved>", [], true],
        ["c3", "zz", ["lint"], true],
      ]);
      const b2 = yield* Effect.fromOption(A.findFirst(replay.perHead, (head) => head.headSha === "b2"));
      expect(b2.selected).toEqual(CI_LANE_ID_VALUES);
      expect(b2.skipped).toEqual([]);
      expect(replay.unresolvedHeads).toBe(1);
      expect(replay.baseUnknownHeads).toBe(2);
      expect(replay.skippedLaneRuns).toBe(2 * SKIPPED_WITHOUT_ATOMS);
      expect(replay.skippedReds).toBe(2);
      expect(replay.recall).toBe(1 - 2 / (2 * SKIPPED_WITHOUT_ATOMS));
    })
  );

  it.effect("does not count a red on an external lane as a skipped red, even when the base was green", () =>
    Effect.gen(function* () {
      const runs = yield* decodeRuns(replayRunsJson);
      const ensured = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const replay = yield* runReplay(
        runs,
        classifierLayer(noAtoms),
        gitLayer(REPLAY_MERGE_BASES, REPLAY_ANCESTORS, ensured)
      );

      // a1 has no atoms and is red on Security while m1, its base, is green there:
      // the external lane is selected for every change, so the red is not a miss.
      const a1 = yield* Effect.fromOption(A.findFirst(replay.perHead, (head) => head.headSha === "a1"));
      expect(a1.baseUnknown).toBe(false);
      expect(a1.selected).toEqual(["security"]);
      expect(A.contains(a1.skipped, "security")).toBe(false);
      expect(A.contains(a1.skippedReds, "security")).toBe(false);
      expect(a1.skippedReds).toEqual(["check"]);
    })
  );
});
