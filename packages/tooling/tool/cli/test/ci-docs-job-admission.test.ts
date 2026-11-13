import { CiCommandError, decideHeavyAdmission, HeavyAdmissionEvent } from "@beep/repo-cli/commands/Ci";
import { it } from "@beep/test-runner";
import { assert } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parseWorkflowYaml, yamlAt } from "./support/WorkflowYaml.ts";

// Non-test hosted lanes also wait on Test Plan and Heavy Admission so GitHub creates them no earlier
// than the test shards, and they depend on neither result: `!cancelled()` keeps a lane running when
// either fails and the explicit Change Profile check keeps the fail-closed skip.
const afterShardsNeeds = ["change-profile", "test-plan", "admission"];
const afterShardsGuard = "${{ !cancelled() && needs.change-profile.result == 'success' }}";
const afterShardsDocsGuard =
  "${{ !cancelled() && needs.change-profile.result == 'success' && needs.change-profile.outputs.docs_only != 'true' }}";
// Lanes with a `lanes.<id>` row in the change-profile pattern data also skip, before runner
// allocation, when the profile reports them irrelevant. `!= 'false'` keeps a pinned binary that
// predates the output (empty) running the lane.
const afterShardsRelevanceGuard = (lane: string) =>
  `\${{ !cancelled() && needs.change-profile.result == 'success' && needs.change-profile.outputs.docs_only != 'true' && needs.change-profile.outputs.${lane}_relevant != 'false' }}`;
const heavyGuard =
  "${{ inputs.admitted && !inputs.producer_inspection && !inputs.producer_preparation && !inputs.producer_execution && !inputs.local_pilot_observation }}";
const heavyLaneContracts = [
  { job: "verify", id: "lint-policy", name: "Lint Policy", timeout: 50, docgen: "3", typos: "true", guard: heavyGuard },
  { job: "check", id: "check", name: "Check", timeout: 120, docgen: "3", typos: "false", guard: heavyGuard },
  { job: "docgen", id: "docgen", name: "Docgen", timeout: 60, docgen: "6", typos: "false", guard: heavyGuard },
  { job: "doctest", id: "doctest", name: "Doctest", timeout: 60, docgen: "3", typos: "false", guard: heavyGuard },
  { job: "build", id: "build", name: "Build", timeout: 40, docgen: "3", typos: "false", guard: heavyGuard },
];
const verificationLaneContracts = [
  {
    job: "verify",
    id: "repo-sanity",
    name: "Repo Sanity",
    timeout: 30,
    // No job guard: a goals_only diff skips the lane body but still runs the
    // private home path law (see the lane gate's home_paths_only output).
    guard: afterShardsGuard,
  },
  {
    job: "ecosystem",
    id: "ecosystem",
    name: "Ecosystem Contracts",
    timeout: 30,
    guard: afterShardsRelevanceGuard("ecosystem"),
  },
  {
    job: "codegen",
    id: "codegen",
    name: "Codegen Drift",
    timeout: 30,
    guard: afterShardsRelevanceGuard("codegen"),
  },
];

const aggregateCases = A.flatMap(["success", "failure", "skipped", "cancelled", ""], (classification) =>
  A.flatMap(["true", "false", "", "invalid"], (docs) =>
    A.map(["success", "failure", "skipped", "cancelled"], (result) => ({ classification, docs, result }))
  )
);
const passingStates = ["success:true:skipped", "success:false:success"];
// The test lanes also read the run's partition plan: its job result and the planned list.
const planCases = A.flatMap(["success", "failure", "skipped", "cancelled", ""], (plan) =>
  A.map(["[]", '["int-rest"]', '["unit-a","int-rest"]', "", "null", '"unit-a"'], (planned) => ({ plan, planned }))
);
const decodeWorkflowSteps = S.decodeUnknownEffect(S.Array(S.Unknown));
const isWorkflowText = S.is(S.String);
const isWorkflowTextList = S.is(S.Array(S.String));
const isWorkflowRecord = S.is(S.Record(S.String, S.Unknown));
// A mapping node's entries; anything else (an absent `outputs`, a scalar) has none.
const workflowRecord = (value: unknown): Readonly<Record<string, unknown>> => (isWorkflowRecord(value) ? value : {});
// An aggregate is skipped, before it requests a runner, only on a Change Profile that succeeded and
// reported a documentation-only diff; every other profile runs it and its script fails closed.
const aggregateGuard =
  "${{ !cancelled() && !(needs.change-profile.result == 'success' && needs.change-profile.outputs.docs_only == 'true') }}";
const sameRepository = "github.event.pull_request.head.repo.full_name == github.repository";
const docsOnlyFromThisRepository = `needs.change-profile.outputs.docs_only == 'true' && ${sameRepository}`;

const readCheckWorkflow = Effect.map(
  Effect.tryPromise({
    try: () => Bun.file(new URL("../../../../../.github/workflows/check.yml", import.meta.url)).text(),
    catch: CiCommandError.new("Unable to read the checked-in workflow for the admission regression."),
  }),
  parseWorkflowYaml
);

const aggregateScript = (workflow: unknown, job: string): string => {
  const script = yamlAt(workflow, ["jobs", job, "steps", 0, "run"]);
  assertTrue(isWorkflowText(script));
  return script;
};

type AggregateState = {
  readonly admission: string;
  readonly classification: string;
  readonly docs: string;
  readonly plan: string;
  readonly planned: string;
  readonly result: string;
};

// Runs one aggregate's real script with every `needs` expression rendered and the plan in its env.
const aggregatePasses = (script: string, shard: string, state: AggregateState): boolean =>
  Bun.spawnSync(
    [
      "bash",
      "-c",
      pipe(
        script,
        Str.replaceAll("${{ needs.admission.result }}", state.admission),
        Str.replaceAll("${{ needs.change-profile.result }}", state.classification),
        Str.replaceAll("${{ needs.test-plan.result }}", state.plan),
        Str.replaceAll("${{ needs.change-profile.outputs.docs_only }}", state.docs),
        Str.replaceAll(`\${{ needs.${shard}.result }}`, state.result)
      ),
    ],
    { stdout: "pipe", stderr: "pipe", env: { ...Bun.env, PLANNED_PARTITIONS: state.planned } }
  ).exitCode === 0;

type PlannedLane = {
  readonly emptyPlanSkips: boolean;
  readonly isSome: (planned: string) => boolean;
  readonly job: string;
  readonly needs: ReadonlyArray<string>;
  readonly output: string;
  readonly shard: string;
};

// A planned lane passes in exactly these states: a documentation-only diff whose shards were
// skipped, a plan that allocated shards which all passed, and (Test Unit only) a plan that
// selected no partition. Test Integration always plans its catch-all, so an empty plan fails.
const plannedLanes: ReadonlyArray<PlannedLane> = [
  {
    job: "test-unit",
    shard: "test-unit-shard",
    output: "test_unit",
    needs: ["change-profile", "test-plan", "test-unit-shard"],
    emptyPlanSkips: true,
    isSome: (planned) => planned !== "[]",
  },
  {
    job: "test-integration",
    shard: "test-integration-shard",
    output: "test_integration",
    needs: ["admission", "change-profile", "test-plan", "test-integration-shard"],
    emptyPlanSkips: false,
    isSome: Str.includes('"int-rest"'),
  },
];

const plannedLaneShouldPass = (lane: PlannedLane, state: AggregateState): boolean => {
  const healthy = state.classification === "success" && state.plan === "success" && Str.startsWith("[")(state.planned);
  const stated = A.contains(
    [
      "true:skipped",
      ...(lane.isSome(state.planned) ? ["false:success"] : []),
      ...(lane.emptyPlanSkips && state.planned === "[]" ? ["false:skipped"] : []),
    ],
    `${state.docs}:${state.result}`
  );
  return healthy && stated;
};

it.effect(
  "executes the real unplanned aggregate scripts across classification and shard outcomes",
  Effect.fnUntraced(function* () {
    const workflow = yield* readCheckWorkflow;
    for (const { job, shard } of [
      { job: "lint", shard: "lint-shard" },
      { job: "property-laws", shard: "property-laws-shard" },
    ]) {
      const script = aggregateScript(workflow, job);
      for (const { classification, docs, result } of aggregateCases) {
        assert.strictEqual(
          aggregatePasses(script, shard, { admission: "", classification, docs, plan: "", planned: "", result }),
          A.contains(passingStates, `${classification}:${docs}:${result}`),
          `${job}: ${classification}/${docs}/${result}`
        );
      }
      assert.deepEqual(yamlAt(workflow, ["jobs", job, "needs"]), ["change-profile", shard]);
      assert.strictEqual(yamlAt(workflow, ["jobs", job, "if"]), aggregateGuard);
    }
    for (const job of ["lint-shard", "labs", "fallow-advisory"]) {
      assert.deepEqual(yamlAt(workflow, ["jobs", job, "needs"]), afterShardsNeeds);
      assert.strictEqual(yamlAt(workflow, ["jobs", job, "if"]), afterShardsDocsGuard);
    }
    // Property Laws is a test lane: its slices wait on what the test shards wait on, not on Heavy
    // Admission, and keep the same fail-closed condition.
    assert.deepEqual(yamlAt(workflow, ["jobs", "property-laws-shard", "needs"]), ["change-profile", "test-plan"]);
    assert.strictEqual(yamlAt(workflow, ["jobs", "property-laws-shard", "if"]), afterShardsDocsGuard);
    // Security and SAST start once Change Profile reports; a docs_only diff or an
    // irrelevant change skips them, and a failed profile (empty outputs) runs them.
    for (const lane of ["security", "sast"]) {
      assert.deepEqual(yamlAt(workflow, ["jobs", lane, "needs"]), ["change-profile"]);
      assert.strictEqual(
        yamlAt(workflow, ["jobs", lane, "if"]),
        `\${{ !cancelled() && needs.change-profile.outputs.docs_only != 'true' && needs.change-profile.outputs.${lane}_relevant != 'false' }}`
      );
    }
    // Secret scanning and commitlint read every change, prose included.
    assert.isUndefined(yamlAt(workflow, ["jobs", "secrets", "if"]));
    assert.isUndefined(yamlAt(workflow, ["jobs", "commitlint", "if"]));
  })
);

it.effect(
  "executes the real planned aggregate scripts across classification, plan and shard outcomes",
  Effect.fnUntraced(function* () {
    const workflow = yield* readCheckWorkflow;
    for (const lane of plannedLanes) {
      const script = aggregateScript(workflow, lane.job);
      const states = A.flatMap(aggregateCases, (aggregateCase) =>
        A.map(planCases, (planCase): AggregateState => ({ ...aggregateCase, ...planCase, admission: "success" }))
      );
      for (const state of states) {
        assert.strictEqual(
          aggregatePasses(script, lane.shard, state),
          plannedLaneShouldPass(lane, state),
          `${lane.job}: ${state.classification}/${state.docs}/${state.result}/${state.plan}/${state.planned}`
        );
      }
      assert.deepEqual(yamlAt(workflow, ["jobs", lane.job, "needs"]), lane.needs);
      assert.strictEqual(yamlAt(workflow, ["jobs", lane.job, "if"]), aggregateGuard);
      assert.strictEqual(
        yamlAt(workflow, ["jobs", lane.job, "steps", 0, "env", "PLANNED_PARTITIONS"]),
        `\${{ needs.test-plan.outputs.${lane.output} }}`
      );
      assert.deepEqual(yamlAt(workflow, ["jobs", lane.shard, "needs"]), ["change-profile", "test-plan"]);
      assert.strictEqual(
        yamlAt(workflow, ["jobs", lane.shard, "if"]),
        `needs.change-profile.outputs.docs_only != 'true' && needs.test-plan.outputs.${lane.output} != '[]'`
      );
    }
  })
);

it.effect(
  "fails the integration aggregate closed when admission itself did not succeed",
  Effect.fnUntraced(function* () {
    const workflow = yield* readCheckWorkflow;
    const script = aggregateScript(workflow, "test-integration");
    for (const admission of ["failure", "skipped", "cancelled", ""]) {
      assert.isFalse(
        aggregatePasses(script, "test-integration-shard", {
          admission,
          classification: "success",
          docs: "false",
          plan: "success",
          planned: '["int-rest"]',
          result: "success",
        }),
        `test-integration: admission ${admission}`
      );
    }
  })
);

it.effect(
  "pins label classification and preserves normal fork admission when the docs shortcut is unavailable",
  Effect.fnUntraced(function* () {
    // check.yml takes the same shortcut one level up: its admission job is skipped before a runner is
    // requested and the Heavy caller passes `admitted: false` itself (the runner-request cases below
    // simulate it). Both guards are that shortcut, so the rows below judge them as well.
    const check = yield* readCheckWorkflow;
    assert.strictEqual(
      yamlAt(check, ["jobs", "admission", "if"]),
      `\${{ needs.change-profile.result == 'success' && !(${docsOnlyFromThisRepository}) }}`
    );
    assert.strictEqual(
      yamlAt(check, ["jobs", "heavy", "if"]),
      `\${{ !cancelled() && (needs.admission.outputs.verdict == 'run' || needs.admission.outputs.verdict == 'skip-satisfied' || (needs.admission.result == 'skipped' && needs.change-profile.result == 'success' && ${docsOnlyFromThisRepository})) }}`
    );
    assert.strictEqual(
      yamlAt(check, ["jobs", "heavy", "with", "admitted"]),
      "${{ needs.admission.outputs.verdict == 'run' }}"
    );
    const admissionSteps = yield* decodeWorkflowSteps(yamlAt(check, ["jobs", "admission", "steps"]));
    assert.isFalse(A.some(admissionSteps, (step) => yamlAt(step, ["id"]) === "docs"));
    for (const caller of [
      {
        file: "check.yml",
        shortcut: O.some(docsOnlyFromThisRepository),
        setupIndex: 2,
        decideIndex: 3,
        stepGuard: undefined,
        profile: "needs.change-profile.outputs.docs_only",
      },
      {
        file: "heavy-admit.yml",
        shortcut: O.none<string>(),
        setupIndex: 5,
        decideIndex: 6,
        stepGuard: "steps.docs.outputs.verdict != 'skip-satisfied'",
        profile: "steps.profile.outputs.docs_only",
      },
    ]) {
      const source = yield* Effect.tryPromise({
        try: () => Bun.file(new URL(`../../../../../.github/workflows/${caller.file}`, import.meta.url)).text(),
        catch: CiCommandError.new("Unable to read the checked-in admission caller."),
      });
      const workflow = parseWorkflowYaml(source);
      assert.strictEqual(yamlAt(workflow, ["env", "BEEP_CI_PR_BASE_SHA"]), "${{ github.event.pull_request.base.sha }}");
      assert.strictEqual(yamlAt(workflow, ["env", "BEEP_CI_PR_HEAD_SHA"]), "${{ github.event.pull_request.head.sha }}");
      const shortcut = O.getOrElse(caller.shortcut, () => yamlAt(workflow, ["jobs", "admission", "steps", 4, "if"]));
      assertTrue(isWorkflowText(shortcut));
      assert.strictEqual(shortcut, `${caller.profile} == 'true' && ${sameRepository}`);
      assert.strictEqual(
        yamlAt(workflow, ["jobs", "admission", "steps", caller.setupIndex, "uses"]),
        "./.github/actions/setup-monorepo-ci"
      );
      assert.strictEqual(yamlAt(workflow, ["jobs", "admission", "steps", caller.decideIndex, "id"]), "decide");
      for (const index of [caller.setupIndex, caller.decideIndex]) {
        assert.strictEqual(yamlAt(workflow, ["jobs", "admission", "steps", index, "if"]), caller.stepGuard);
      }
      for (const row of [
        { docs: "true", head: "beep-effect/beep-effect", labels: [], paths: ["README.md"], verdict: "skip-satisfied" },
        { docs: "true", head: "contributor/fork", labels: [], paths: ["README.md"], verdict: "hold" },
        { docs: "true", head: "contributor/fork", labels: ["ready-for-heavy"], paths: ["README.md"], verdict: "hold" },
        {
          docs: "true",
          head: "contributor/fork",
          labels: ["ready-for-heavy", "ready-for-heavy-fork"],
          paths: ["README.md"],
          verdict: "run",
        },
        { docs: "false", head: "beep-effect/beep-effect", labels: [], paths: [], verdict: "hold" },
        { docs: "false", head: "beep-effect/beep-effect", labels: ["ready-for-heavy"], paths: [], verdict: "run" },
      ]) {
        const rendered = pipe(
          shortcut,
          Str.replaceAll(caller.profile, `'${row.docs}'`),
          Str.replaceAll("github.event.pull_request.head.repo.full_name", `'${row.head}'`),
          Str.replaceAll("github.repository", "'beep-effect/beep-effect'")
        );
        const taken = Bun.spawnSync(["bash", "-c", `[[ ${rendered} ]]`], { stdout: "pipe", stderr: "pipe" });
        const admission = decideHeavyAdmission(
          HeavyAdmissionEvent.make({
            eventName: "pull_request",
            headRepository: row.head,
            labels: row.labels,
            changedPaths: row.paths,
          })
        );
        assert.strictEqual(taken.exitCode === 0 ? "skip-satisfied" : admission.verdict, row.verdict);
      }
    }
  })
);

// Runner-request simulation. Each check.yml job's real `if` is rendered with its `needs` and `github`
// contexts and judged by bash, the way the aggregate scripts above are. A job with no status function
// in its `if` is skipped when a needed job did not succeed (GitHub's implicit `success()`), and a
// skipped job publishes no outputs. A job that starts is taken to succeed unless the scenario forces
// its result.
type JobResult = "success" | "failure" | "skipped";
type RunnerScenario = {
  readonly forced: Readonly<Record<string, JobResult>>;
  readonly github: Readonly<Record<string, string>>;
  readonly outputs: Readonly<Record<string, string>>;
};

const jobNeeds = (job: unknown): ReadonlyArray<string> => {
  const needs = yamlAt(job, ["needs"]);
  return isWorkflowTextList(needs) ? needs : isWorkflowText(needs) ? [needs] : [];
};

const expressionHolds = (expression: string, context: Readonly<Record<string, string>>): boolean => {
  const rendered = pipe(
    R.toEntries(context),
    A.sortBy(([left], [right]) => (left.length === right.length ? 0 : left.length > right.length ? -1 : 1)),
    A.reduce(
      pipe(
        expression,
        Str.replaceAll("${{", ""),
        Str.replaceAll("}}", ""),
        Str.replaceAll("!cancelled()", "'ok' == 'ok'"),
        Str.replaceAll("!(", "! ("),
        Str.trim
      ),
      (text, [name, value]) => Str.replaceAll(name, `'${value}'`)(text)
    )
  );
  // Every context the expression reads must be one the simulation supplies.
  for (const unresolved of ["needs.", "github.", "inputs.", "()"]) {
    assert.isFalse(Str.includes(unresolved)(rendered), `unresolved ${unresolved} in: ${rendered}`);
  }
  return Bun.spawnSync(["bash", "-c", `[[ ${rendered} ]]`], { stdout: "pipe", stderr: "pipe" }).exitCode === 0;
};

const simulateJobs = (workflow: unknown, scenario: RunnerScenario): Readonly<Record<string, JobResult>> => {
  const jobs = workflowRecord(yamlAt(workflow, ["jobs"]));
  const resultOf = (id: string): JobResult => {
    const forced = R.get(scenario.forced, id);
    if (O.isSome(forced)) {
      return forced.value;
    }
    const job = R.get(jobs, id).pipe(O.getOrThrow);
    const needs = jobNeeds(job);
    const needed = A.map(needs, (need) => ({ need, result: resultOf(need) }));
    const guard = yamlAt(job, ["if"]);
    if (!isWorkflowText(guard)) {
      return A.every(needed, ({ result }) => result === "success") ? "success" : "skipped";
    }
    if (!Str.includes("cancelled()")(guard) && A.some(needed, ({ result }) => result !== "success")) {
      return "skipped";
    }
    const context = R.fromEntries([
      ...R.toEntries(scenario.github),
      ...A.flatMap(needed, ({ need, result }) => [
        [`needs.${need}.result`, result] as const,
        ...A.map(
          R.keys(workflowRecord(yamlAt(jobs, [need, "outputs"]))),
          (output) =>
            [
              `needs.${need}.outputs.${output}`,
              result === "success" ? O.getOrElse(R.get(scenario.outputs, `${need}.${output}`), () => "") : "",
            ] as const
        ),
      ]),
    ]);
    return expressionHolds(guard, context) ? "success" : "skipped";
  };
  return R.fromEntries(A.map(R.keys(jobs), (id) => [id, resultOf(id)] as const));
};

// The jobs that asked GitHub for a runner: they started and they declare `runs-on`.
const runnerRequests = (workflow: unknown, results: Readonly<Record<string, JobResult>>): ReadonlyArray<string> =>
  pipe(
    R.keys(results),
    A.filter((id) => R.get(results, id).pipe(O.getOrThrow) !== "skipped"),
    A.filter((id) => isWorkflowText(yamlAt(workflow, ["jobs", id, "runs-on"]))),
    A.sort(Str.Order)
  );

const thisRepository = {
  "github.event_name": "pull_request",
  "github.event.pull_request.head.repo.full_name": "beep-effect/beep-effect",
  "github.repository": "beep-effect/beep-effect",
};
const docsOutputs = {
  "change-profile.docs_only": "true",
  "test-plan.test_unit": "[]",
  "test-plan.test_integration": "[]",
};
// What a documentation diff can fail, plus the three jobs that classify or label every pull request.
const docsRunnerJobs = ["change-profile", "commitlint", "docs-policy", "pr-size", "secrets", "test-plan", "verify"];
const aggregateJobs = ["lint", "property-laws", "test-integration", "test-unit"];
const shardJobs = ["lint-shard", "property-laws-shard", "test-integration-shard", "test-unit-shard"];

it.effect(
  "requests no test, lint or heavy runner for a documentation-only pull request",
  Effect.fnUntraced(function* () {
    const workflow = yield* readCheckWorkflow;
    const results = simulateJobs(workflow, { forced: {}, github: thisRepository, outputs: docsOutputs });

    assert.deepEqual(runnerRequests(workflow, results), docsRunnerJobs);
    // The required aggregates and Heavy Admission are skipped at job level: no runner, no queue slot,
    // and GitHub reports a job-level skip as a passing required check.
    for (const job of [...aggregateJobs, ...shardJobs, "admission", "coverage-regression", "security", "sast"]) {
      assert.strictEqual(R.get(results, job).pipe(O.getOrThrow), "skipped", job);
    }
    // The Heavy caller still starts, with `admitted: false`, so every `Heavy / <lane>` context exists
    // and reports skipped (each lane's guard in heavy.yml begins with `inputs.admitted`, pinned below).
    assert.strictEqual(R.get(results, "heavy").pipe(O.getOrThrow), "success");
    assert.isUndefined(yamlAt(workflow, ["jobs", "heavy", "runs-on"]));
    const admitted = yamlAt(workflow, ["jobs", "heavy", "with", "admitted"]);
    assertTrue(isWorkflowText(admitted));
    assert.isFalse(expressionHolds(admitted, { "needs.admission.outputs.verdict": "" }));
    // Repo Sanity, the required documentation gate, waits on nothing that queues for a runner after
    // Change Profile: Heavy Admission is skipped, and Test Plan starts with the run.
    assert.deepEqual(jobNeeds(yamlAt(workflow, ["jobs", "verify"])), ["change-profile", "test-plan", "admission"]);
    assert.deepEqual(jobNeeds(yamlAt(workflow, ["jobs", "test-plan"])), []);
  })
);

it.effect(
  "keeps a fork's documentation diff on the admission decision and a held Heavy caller",
  Effect.fnUntraced(function* () {
    const workflow = yield* readCheckWorkflow;
    const fork = { ...thisRepository, "github.event.pull_request.head.repo.full_name": "contributor/fork" };
    const held = simulateJobs(workflow, {
      forced: {},
      github: fork,
      outputs: { ...docsOutputs, "admission.verdict": "hold" },
    });
    assert.strictEqual(R.get(held, "admission").pipe(O.getOrThrow), "success");
    // `hold` never reaches the reusable workflow, so the heavy contexts stay "Expected".
    assert.strictEqual(R.get(held, "heavy").pipe(O.getOrThrow), "skipped");
    const labelled = simulateJobs(workflow, {
      forced: {},
      github: fork,
      outputs: { ...docsOutputs, "admission.verdict": "run" },
    });
    assert.strictEqual(R.get(labelled, "heavy").pipe(O.getOrThrow), "success");
  })
);

it.effect(
  "runs every aggregate, fail-closed, unless Change Profile succeeded and reported documentation only",
  Effect.fnUntraced(function* () {
    const workflow = yield* readCheckWorkflow;
    const codeOutputs = {
      "change-profile.docs_only": "false",
      "test-plan.test_unit": '["unit-a"]',
      "test-plan.test_integration": '["int-rest"]',
      "admission.verdict": "run",
    };
    const code = simulateJobs(workflow, { forced: {}, github: thisRepository, outputs: codeOutputs });
    // A code diff requests every hosted job except Docs Policy.
    const hosted = pipe(
      R.keys(code),
      A.filter((id) => isWorkflowText(yamlAt(workflow, ["jobs", id, "runs-on"]))),
      A.sort(Str.Order)
    );
    assert.deepEqual(
      runnerRequests(workflow, code),
      A.filter(hosted, (id) => id !== "docs-policy")
    );
    assert.strictEqual(R.get(code, "heavy").pipe(O.getOrThrow), "success");

    // A red shard, a failed plan and an unreadable profile each still start the aggregate, whose
    // script (executed above) then fails.
    const forcedCases: ReadonlyArray<Readonly<Record<string, JobResult>>> = [
      { "test-unit-shard": "failure", "lint-shard": "failure" },
      { "test-plan": "failure" },
      { "change-profile": "failure" },
    ];
    for (const forced of forcedCases) {
      const results = simulateJobs(workflow, { forced, github: thisRepository, outputs: codeOutputs });
      for (const job of aggregateJobs) {
        assert.strictEqual(R.get(results, job).pipe(O.getOrThrow), "success", `${job} under ${R.keys(forced)}`);
      }
    }
    // An empty or malformed docs_only output is not a documentation diff.
    for (const docs of ["", "invalid"]) {
      const results = simulateJobs(workflow, {
        forced: {},
        github: thisRepository,
        outputs: { ...codeOutputs, "change-profile.docs_only": docs },
      });
      for (const job of aggregateJobs) {
        assert.strictEqual(R.get(results, job).pipe(O.getOrThrow), "success", `${job} for docs_only=${docs}`);
      }
    }
    // A failed Change Profile leaves Heavy Admission and the Heavy caller unstarted, so the heavy
    // contexts stay "Expected" and the pull request stays blocked.
    const unknown = simulateJobs(workflow, {
      forced: { "change-profile": "failure" },
      github: thisRepository,
      outputs: codeOutputs,
    });
    assert.strictEqual(R.get(unknown, "admission").pipe(O.getOrThrow), "skipped");
    assert.strictEqual(R.get(unknown, "heavy").pipe(O.getOrThrow), "skipped");
  })
);

const readRepositoryFile = (path: string) =>
  Effect.tryPromise({
    try: () => Bun.file(new URL(`../../../../../${path}`, import.meta.url)).text(),
    catch: CiCommandError.new(`Unable to read ${path} for the workflow path-filter contract.`),
  });
// JSON is YAML, so the manifests and the VERCEL_APPS table read through the same parser and guards.
const isWorkflowList = S.is(S.Array(S.Unknown));

it.effect(
  "creates the Vercel workflow on a pull request only for the app roots its plan deploys",
  Effect.fnUntraced(function* () {
    const source = yield* readRepositoryFile(".github/workflows/vercel-deploy.yml");
    const workflow = parseWorkflowYaml(source);
    const table = yamlAt(workflow, ["env", "VERCEL_APPS"]);
    assertTrue(isWorkflowText(table));
    const apps = parseWorkflowYaml(table);
    assertTrue(isWorkflowList(apps));
    const roots = pipe(
      A.filter(apps, (app) => yamlAt(app, ["auto"]) === true),
      A.map((app) => `${String(yamlAt(app, ["root"]))}/**`),
      A.dedupe
    );
    assert.strictEqual(roots.length, 2);
    assert.deepEqual(yamlAt(workflow, ["on", "pull_request", "paths"]), [
      ...roots,
      ".github/workflows/vercel-deploy.yml",
    ]);
    // Main pushes diff against the last production deployment, not the push: never filtered.
    assert.deepEqual(yamlAt(workflow, ["on", "push"]), { branches: ["main"] });
  })
);

it.effect(
  "ignores for Storybook only pull-request roots that hold no workspace package and no global Turbo input",
  Effect.fnUntraced(function* () {
    const source = yield* readRepositoryFile(".github/workflows/storybook.yml");
    const workflow = parseWorkflowYaml(source);
    const ignoredRoots = ["docs", "goals", "explorations", "research"];
    assert.deepEqual(
      yamlAt(workflow, ["on", "pull_request", "paths-ignore"]),
      A.map(ignoredRoots, (root) => `${root}/**`)
    );
    assert.deepEqual(yamlAt(workflow, ["on", "push"]), { branches: ["main"] });
    const manifestSource = yield* readRepositoryFile("package.json");
    const manifest = parseWorkflowYaml(manifestSource);
    const workspaces = yamlAt(manifest, ["workspaces"]);
    assertTrue(isWorkflowTextList(workspaces));
    const turboSource = yield* readRepositoryFile("turbo.json");
    const turbo = parseWorkflowYaml(turboSource);
    const globalInputs = yamlAt(turbo, ["globalDependencies"]) ?? [];
    assertTrue(isWorkflowTextList(globalInputs));
    for (const root of ignoredRoots) {
      for (const glob of [...workspaces, ...globalInputs]) {
        assert.isFalse(Str.startsWith(`${root}/`)(glob) || glob === root, `${glob} lives under ${root}/`);
      }
    }
  })
);

it.effect(
  "keeps trusted summary artifact names stable when verification jobs split",
  Effect.fnUntraced(function* () {
    for (const file of ["check.yml", "heavy.yml"]) {
      const source = yield* Effect.tryPromise({
        try: () => Bun.file(new URL(`../../../../../.github/workflows/${file}`, import.meta.url)).text(),
        catch: CiCommandError.new("Unable to read the trusted artifact naming contract."),
      });
      const workflow = parseWorkflowYaml(source);
      const steps = yield* decodeWorkflowSteps(yamlAt(workflow, ["jobs", "verify", "steps"]));
      const uploads = A.filter(steps, (step) => yamlAt(step, ["name"]) === "Upload trusted Turbo summaries");
      assert.strictEqual(uploads.length, 1);
      const artifact = yamlAt(A.head(uploads).pipe(O.getOrThrow), ["with", "name"]);
      assertTrue(isWorkflowText(artifact));
      assert.strictEqual(artifact, "turbo-summary-verify-${{ env.BEEP_CI_LANE_ID }}");
      const contracts = file === "heavy.yml" ? heavyLaneContracts : verificationLaneContracts;
      for (const contract of contracts) {
        assert.isUndefined(yamlAt(workflow, ["jobs", contract.job, "strategy"]));
        assert.strictEqual(yamlAt(workflow, ["jobs", contract.job, "name"]), contract.name);
        assert.strictEqual(yamlAt(workflow, ["jobs", contract.job, "if"]), contract.guard);
        assert.strictEqual(yamlAt(workflow, ["jobs", contract.job, "timeout-minutes"]), contract.timeout);
        assert.strictEqual(
          yamlAt(workflow, ["jobs", contract.job, "runs-on"]),
          file === "heavy.yml" ? "beep-ec2-heavy" : "ubuntu-24.04"
        );
        assert.deepEqual(yamlAt(workflow, ["jobs", contract.job, "permissions"]), { contents: "read" });
        assert.deepEqual(yamlAt(workflow, ["jobs", contract.job, "steps"]), steps);
        assert.strictEqual(yamlAt(workflow, ["jobs", contract.job, "env", "BEEP_CI_LANE_ID"]), contract.id);
        assert.strictEqual(yamlAt(workflow, ["jobs", contract.job, "env", "BEEP_CI_LANE_NAME"]), contract.name);
        assert.strictEqual(
          pipe(artifact, Str.replaceAll("${{ env.BEEP_CI_LANE_ID }}", contract.id)),
          `turbo-summary-verify-${contract.id}`
        );
      }
    }
  })
);

it.effect(
  "preserves each Heavy lane's effective toolchain, cache writer, and producer isolation parameters",
  Effect.fnUntraced(function* () {
    const source = yield* Effect.tryPromise({
      try: () => Bun.file(new URL("../../../../../.github/workflows/heavy.yml", import.meta.url)).text(),
      catch: CiCommandError.new("Unable to read the Heavy parameter contract."),
    });
    const workflow = parseWorkflowYaml(source);
    for (const contract of heavyLaneContracts) {
      assert.deepEqual(yamlAt(workflow, ["jobs", contract.job, "env"]), {
        BEEP_CI_LANE_ID: contract.id,
        BEEP_CI_LANE_NAME: contract.name,
        BEEP_CI_LANE_USES_TURBO: "true",
        BEEP_CI_LANE_INSTALL_TYPOS: contract.typos,
        BEEP_DOCGEN_CONCURRENCY: contract.docgen,
      });
      assert.strictEqual(
        yamlAt(workflow, ["jobs", contract.job, "environment"]),
        "${{ github.event_name == 'push' && inputs.admitted && 'turbo-cache-write' || null }}"
      );
    }
  })
);

it.effect(
  "resolves cancellation without checkout and never cancels by a fork's colliding branch name",
  Effect.fnUntraced(function* () {
    const source = yield* Effect.tryPromise({
      try: () => Bun.file(new URL("../../../../../.github/workflows/check.yml", import.meta.url)).text(),
      catch: CiCommandError.new("Unable to read the no-checkout cancellation contract."),
    });
    const workflow = parseWorkflowYaml(source);
    const steps = yield* decodeWorkflowSteps(yamlAt(workflow, ["jobs", "admission", "steps"]));
    const cancel = A.findFirst(steps, (step) => yamlAt(step, ["name"]) === "Cancel superseded Heavy Admit runs").pipe(
      O.getOrThrow
    );
    assert.strictEqual(yamlAt(cancel, ["env", "GH_REPO"]), "${{ github.repository }}");
    assert.strictEqual(yamlAt(cancel, ["env", "GH_TOKEN"]), "${{ github.token }}");
    assert.strictEqual(yamlAt(cancel, ["env", "PR_NUMBER"]), "${{ github.event.pull_request.number }}");
    const guard = yamlAt(cancel, ["if"]);
    const run = yamlAt(cancel, ["run"]);
    assertTrue(isWorkflowText(guard));
    assertTrue(isWorkflowText(run));
    assert.strictEqual(
      guard,
      "github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository"
    );
    for (const row of [
      {
        event: "pull_request",
        head: "beep-effect/beep-effect",
        repo: "beep-effect/beep-effect",
        success: true,
        executes: true,
      },
      {
        event: "pull_request",
        head: "contributor/fork",
        repo: "beep-effect/beep-effect",
        success: true,
        executes: false,
      },
      { event: "pull_request", head: "", repo: "beep-effect/beep-effect", success: true, executes: false },
      {
        event: "push",
        head: "beep-effect/beep-effect",
        repo: "beep-effect/beep-effect",
        success: true,
        executes: false,
      },
      { event: "pull_request", head: "beep-effect/beep-effect", repo: "", success: false, executes: false },
    ]) {
      const condition = pipe(
        guard,
        Str.replaceAll("github.event_name", `'${row.event}'`),
        Str.replaceAll("github.event.pull_request.head.repo.full_name", `'${row.head}'`),
        Str.replaceAll("github.repository", "'beep-effect/beep-effect'")
      );
      const script = `gh() {
  [[ "$GH_REPO" == 'beep-effect/beep-effect' ]] || return 97
  if [[ "$1" == 'api' ]]; then
    printf 'repo-resolved\\n' >&2
    if [[ "$*" == *'status=queued'* ]]; then
      cat <<'RUNS'
{"workflow_runs":[
  {"id":101,"head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
  {"id":102,"head_repository":{"full_name":"contributor/fork"},"pull_requests":[{"number":2935}],"head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
  {"id":103,"head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":99}],"head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
  {"id":104,"head_repository":{"full_name":"beep-effect/beep-effect"},"head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
  {"id":105,"pull_requests":[{"number":2935}],"head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
  {"id":106,"head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
  {"id":107,"head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}]},
  {"id":108,"head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":""},
  {"id":109,"head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":null},
  {"id":110,"head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":123},
  {"id":111,"head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":"malformed"},
  {"head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}
]}
RUNS
    else
      printf '{"workflow_runs":[]}\\n'
    fi
  elif [[ "$1 $2" == 'run cancel' ]]; then
    printf 'cancelled:%s\\n' "$3"
  else
    return 98
  fi
}
if [[ ${condition} ]]; then
${run}
fi`;
      const executed = Bun.spawnSync(["bash", "-c", script], {
        cwd: "/",
        env: {
          ...process.env,
          GH_REPO: row.repo,
          GH_TOKEN: "fixture",
          HEAD_REF: "main",
          PR_NUMBER: "2935",
          HEAD_SHA: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      assert.strictEqual(executed.exitCode === 0, row.success);
      assert.strictEqual(
        executed.stdout.toString(),
        row.executes ? "cancelling superseded Heavy Admit run 101\ncancelled:101\n" : ""
      );
      assert.strictEqual(pipe(executed.stderr.toString(), Str.includes("repo-resolved")), row.executes);
    }
  })
);
