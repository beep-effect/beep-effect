import { CiCommandError, decideHeavyAdmission, HeavyAdmissionEvent } from "@beep/repo-cli/commands/Ci";
import { it } from "@beep/test-runner";
import { assert } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
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
// HOST-06 (goals/heavy-pool-diet): each heavy lane also skips at job level, before a runner boots,
// when Heavy Admission's `lane_skips` names it or, on a pull request, the route skips it. Lint
// Policy (ruling D11) runs after the required lanes and still reports when one fails or skips.
const heavyLaneGuard = (lane: string, afterRequiredLanes = false) =>
  `\${{ ${afterRequiredLanes ? "!cancelled() && " : ""}inputs.admitted && !inputs.producer_inspection && !inputs.producer_preparation && !inputs.producer_execution && !inputs.local_pilot_observation && !contains(format(',{0},', inputs.lane_skips), ',${lane},') && (github.event_name != 'pull_request' || !contains(format(',{0},', inputs.route_skips), ',${lane},')) }}`;
const heavyLaneContracts = [
  {
    job: "verify",
    id: "lint-policy",
    name: "Lint Policy",
    timeout: 50,
    docgen: "3",
    typos: "true",
    guard: heavyLaneGuard("lint-policy", true),
  },
  {
    job: "check",
    id: "check",
    name: "Check",
    timeout: 120,
    docgen: "3",
    typos: "false",
    guard: heavyLaneGuard("check"),
  },
  {
    job: "docgen",
    id: "docgen",
    name: "Docgen",
    timeout: 60,
    docgen: "6",
    typos: "false",
    guard: heavyLaneGuard("docgen"),
  },
  {
    job: "doctest",
    id: "doctest",
    name: "Doctest",
    timeout: 60,
    docgen: "3",
    typos: "false",
    guard: heavyLaneGuard("doctest"),
  },
  {
    job: "build",
    id: "build",
    name: "Build",
    timeout: 40,
    docgen: "3",
    typos: "false",
    guard: heavyLaneGuard("build"),
  },
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
const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);
const isWorkflowText = S.is(S.String);
const isWorkflowTextList = S.is(S.Array(S.String));
const isWorkflowRecord = S.is(S.Record(S.String, S.Unknown));
// A mapping node's entries; anything else (an absent `outputs`, a scalar) has none.
const workflowRecord = (value: unknown): Readonly<Record<string, unknown>> => (isWorkflowRecord(value) ? value : {});
// An aggregate is skipped, before it requests a runner, only in a state whose verdict is already a
// pass: a documentation diff whose shards were skipped, or a code diff whose shard matrix succeeded
// with every other job its script checks (skip on success, goals/ci-lane-economics 2026-11-13).
// Every other state runs it and its script fails closed. The tests below run each guard over every
// combination of the needs results.
const changeProfileOk = "needs.change-profile.result == 'success'";
const docsTrue = "needs.change-profile.outputs.docs_only == 'true'";
const docsFalse = "needs.change-profile.outputs.docs_only == 'false'";
const planOk = "needs.test-plan.result == 'success'";
// Test Unit's two halves (shard overflow): each succeeded, or held nothing and was skipped.
const hostedHalfOk =
  "((needs.test-plan.outputs.test_unit_hosted != '[]' && needs.test-unit-shard.result == 'success') || (needs.test-plan.outputs.test_unit_hosted == '[]' && needs.test-unit-shard.result == 'skipped'))";
const overflowHalfOk =
  "((needs.test-plan.outputs.test_unit_overflow != '[]' && needs.test-unit-overflow.result == 'success') || (needs.test-plan.outputs.test_unit_overflow == '[]' && needs.test-unit-overflow.result == 'skipped'))";
const aggregateGuards: Readonly<Record<string, string>> = {
  lint: `\${{ !cancelled() && !(${changeProfileOk} && ((${docsTrue} && needs.lint-shard.result == 'skipped') || (${docsFalse} && needs.lint-shard.result == 'success'))) }}`,
  "property-laws": `\${{ !cancelled() && !(${changeProfileOk} && ((${docsTrue} && needs.property-laws-shard.result == 'skipped') || (${docsFalse} && needs.property-laws-shard.result == 'success'))) }}`,
  "test-unit": `\${{ !cancelled() && !(${changeProfileOk} && ${planOk} && ((${docsTrue} && needs.test-plan.outputs.test_unit == '[]' && needs.test-unit-shard.result == 'skipped' && needs.test-unit-overflow.result == 'skipped') || (${docsFalse} && needs.test-plan.outputs.test_unit != '[]' && ${hostedHalfOk} && ${overflowHalfOk}))) }}`,
  "test-integration": `\${{ !cancelled() && !(${changeProfileOk} && ${planOk} && ((${docsTrue} && needs.test-plan.outputs.test_integration == '[]' && needs.test-integration-shard.result == 'skipped') || (needs.admission.result == 'success' && ${docsFalse} && contains(needs.test-plan.outputs.test_integration, '"int-rest"') && needs.test-integration-shard.result == 'success'))) }}`,
};
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
  // Test Unit's overflow half (shard overflow, 2026-11-13). Absent, the overflow step routed nothing:
  // the hosted half is the whole plan and the overflow job was skipped.
  readonly hosted?: string;
  readonly overflow?: string;
  readonly overflowResult?: string;
};
const hostedOf = (state: AggregateState): string => state.hosted ?? state.planned;
const overflowOf = (state: AggregateState): string => state.overflow ?? "[]";
const overflowResultOf = (state: AggregateState): string => state.overflowResult ?? "skipped";

// One bash process judges a batch of entries, each printing its exit status on one line, so the exhaustive
// suites below spawn once per batch instead of once per state and stay fast on a busy host.
const bashBatch = (entries: ReadonlyArray<string>): ReadonlyArray<boolean> => {
  const ran = Bun.spawnSync(["bash"], {
    stdin: new TextEncoder().encode(`${A.join(entries, "\n")}\n`),
    stdout: "pipe",
    stderr: "pipe",
  });
  const statuses = A.filter(Str.split(ran.stdout.toString(), "\n"), Str.isNonEmpty);
  assert.strictEqual(A.length(statuses), A.length(entries), "one status per batch entry");
  return A.map(statuses, (status) => status === "0");
};

// One aggregate's real script with every `needs` expression rendered, run in a subshell with the plan in its
// environment; the subshell keeps the script's `set -e` in force and prints its exit status.
const aggregateScriptEntry = (script: string, shard: string, state: AggregateState): string =>
  `( export PLANNED_PARTITIONS='${state.planned}' HOSTED_PARTITIONS='${hostedOf(state)}' OVERFLOW_PARTITIONS='${overflowOf(state)}'\n${pipe(
    script,
    Str.replaceAll("${{ needs.admission.result }}", state.admission),
    Str.replaceAll("${{ needs.change-profile.result }}", state.classification),
    Str.replaceAll("${{ needs.test-plan.result }}", state.plan),
    Str.replaceAll("${{ needs.change-profile.outputs.docs_only }}", state.docs),
    Str.replaceAll(`\${{ needs.${shard}.result }}`, state.result),
    Str.replaceAll("${{ needs.test-unit-overflow.result }}", overflowResultOf(state))
  )}\n) > /dev/null 2>&1; echo $?`;

const aggregatePasses = (script: string, shard: string, state: AggregateState): boolean =>
  O.getOrThrow(A.head(bashBatch([aggregateScriptEntry(script, shard, state)])));

type PlannedLane = {
  readonly emptyPlanSkips: boolean;
  readonly isSome: (planned: string) => boolean;
  readonly job: string;
  readonly needs: ReadonlyArray<string>;
  readonly output: string;
  // The Test Plan output the hosted shard matrix reads.
  readonly shardOutput: string;
  readonly shard: string;
  // The lane's own extra dimension over the shared states: Heavy Admission for Test Integration, the
  // overflow half for Test Unit.
  readonly expand: (state: AggregateState) => ReadonlyArray<AggregateState>;
};

// Test Unit's overflow dimension: every exact split of each plan (all hosted, part routed, all routed)
// against every result of the overflow caller. A successful Test Plan publishes only an exact split (its
// settle step is executed below), so no other split exists beside one.
const routedSplits: Readonly<Record<string, ReadonlyArray<readonly [hosted: string, overflow: string]>>> = {
  '["int-rest"]': [["[]", '["int-rest"]']],
  '["unit-a","int-rest"]': [
    ['["int-rest"]', '["unit-a"]'],
    ["[]", '["unit-a","int-rest"]'],
  ],
};
const jobResults = ["success", "failure", "skipped", "cancelled"];
const overflowStates = (state: AggregateState): ReadonlyArray<AggregateState> =>
  A.flatMap(
    A.prepend(O.getOrElse(R.get(routedSplits, state.planned), A.empty), [state.planned, "[]"]),
    ([hosted, overflow]) =>
      A.map(jobResults, (overflowResult) => ({ ...state, admission: "success", hosted, overflow, overflowResult }))
  );
const admissionStates = (state: AggregateState): ReadonlyArray<AggregateState> =>
  A.map(["success", "skipped"], (admission) => ({ ...state, admission }));

// A planned lane passes in exactly these states: a documentation-only diff whose shards were
// skipped, a plan that allocated shards which all passed, and (Test Unit only) a plan that
// selected no partition. Test Integration always plans its catch-all, so an empty plan fails.
const plannedLanes: ReadonlyArray<PlannedLane> = [
  {
    job: "test-unit",
    shard: "test-unit-shard",
    output: "test_unit",
    shardOutput: "test_unit_hosted",
    needs: ["change-profile", "test-plan", "test-unit-shard", "test-unit-overflow"],
    emptyPlanSkips: true,
    isSome: (planned) => planned !== "[]",
    expand: overflowStates,
  },
  {
    job: "test-integration",
    shard: "test-integration-shard",
    output: "test_integration",
    shardOutput: "test_integration",
    needs: ["admission", "change-profile", "test-plan", "test-integration-shard"],
    emptyPlanSkips: false,
    isSome: Str.includes('"int-rest"'),
    expand: admissionStates,
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

// What one aggregate does in one state: skipped at job level by its condition (a passing required
// check), or started, when its script passes or fails.
type AggregateOutcome = "skipped" | "passed" | "failed";
const aggregateOutcomes = (
  workflow: unknown,
  job: string,
  shard: string,
  output: string,
  states: ReadonlyArray<AggregateState>
): ReadonlyArray<AggregateOutcome> => {
  const guard = yamlAt(workflow, ["jobs", job, "if"]);
  assertTrue(isWorkflowText(guard));
  const script = aggregateScript(workflow, job);
  const starts = bashBatch(
    A.map(states, (state) =>
      conditionEntry(
        renderCondition(guard, {
          "needs.admission.result": state.admission,
          "needs.change-profile.result": state.classification,
          "needs.change-profile.outputs.docs_only": state.docs,
          "needs.test-plan.result": state.plan,
          [`needs.test-plan.outputs.${output}`]: state.planned,
          [`needs.${shard}.result`]: state.result,
          "needs.test-plan.outputs.test_unit_hosted": hostedOf(state),
          "needs.test-plan.outputs.test_unit_overflow": overflowOf(state),
          "needs.test-unit-overflow.result": overflowResultOf(state),
        })
      )
    )
  );
  const passes = bashBatch(A.map(states, (state) => aggregateScriptEntry(script, shard, state)));
  return A.zipWith(
    starts,
    passes,
    (started, passed): AggregateOutcome => (started ? (passed ? "passed" : "failed") : "skipped")
  );
};

// One half of a split passed: it held partitions and succeeded, or held none and was skipped.
const halfPassed = (partitions: string, result: string): boolean =>
  partitions === "[]" ? result === "skipped" : result === "success";
// A code diff's shards all passed: each half passed and at least one of them ran. A lane without an
// overflow half reads as its whole plan hosted and an overflow half that held nothing.
const codeShardsPassed = (planned: boolean, state: AggregateState): boolean =>
  planned
    ? halfPassed(hostedOf(state), state.result) &&
      halfPassed(overflowOf(state), overflowResultOf(state)) &&
      (state.result === "success" || overflowResultOf(state) === "success")
    : state.result === "success";
const docsShardsSkipped = (state: AggregateState): boolean =>
  state.result === "skipped" && overflowResultOf(state) === "skipped";

// The fail-closed property: an aggregate is skipped only beside shards that all succeeded on a code diff
// (for Test Unit, both the hosted and the overflow half), or that were all skipped on a documentation
// diff; never beside a failed, cancelled or otherwise skipped shard of either half, an unsuccessful
// Change Profile, or (planned lanes) an unsuccessful Test Plan.
const skipIsSound = (planned: boolean, state: AggregateState): boolean =>
  state.classification === "success" &&
  (!planned || state.plan === "success") &&
  ((state.docs === "true" && docsShardsSkipped(state)) || (state.docs === "false" && codeShardsPassed(planned, state)));

it.effect(
  "skips the unplanned aggregates only on a verdict already passed, across classification and shard outcomes",
  Effect.fnUntraced(function* () {
    const workflow = yield* readCheckWorkflow;
    for (const { job, shard } of [
      { job: "lint", shard: "lint-shard" },
      { job: "property-laws", shard: "property-laws-shard" },
    ]) {
      assert.strictEqual(yamlAt(workflow, ["jobs", job, "if"]), aggregateGuards[job]);
      const states = A.map(aggregateCases, (state) => ({ ...state, admission: "", plan: "", planned: "" }));
      const outcomes = aggregateOutcomes(workflow, job, shard, "unused", states);
      A.forEach(A.zip(states, outcomes), ([state, outcome]) => {
        const label = `${job}: ${state.classification}/${state.docs}/${state.result} -> ${outcome}`;
        // The verdict is the script's, whether or not the job ran.
        assert.strictEqual(
          outcome !== "failed",
          A.contains(passingStates, `${state.classification}:${state.docs}:${state.result}`),
          label
        );
        // Every passing state takes no runner, and no failing one is skipped.
        assert.strictEqual(outcome === "skipped", skipIsSound(false, state), label);
      });
      assert.deepEqual(yamlAt(workflow, ["jobs", job, "needs"]), ["change-profile", shard]);
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

// Test Plan publishes only a JSON array its publish step validated (jq, compact output), so a malformed
// plan exists only beside an unsuccessful Test Plan; the cases pair them that way.
const validPlans = ["[]", '["int-rest"]', '["unit-a","int-rest"]'];
const plannedStates = (classifications: ReadonlyArray<string>, docsValues: ReadonlyArray<string>) =>
  A.flatMap(classifications, (classification) =>
    A.flatMap(docsValues, (docs) =>
      A.flatMap(["success", "failure", "skipped", "cancelled"], (result) =>
        A.flatMap(planCases, ({ plan, planned }) =>
          plan === "success" && !A.contains(validPlans, planned)
            ? []
            : [{ classification, docs, result, plan, planned }]
        )
      )
    )
  );

// Each lane multiplies the shared states by its own dimension: Heavy Admission's outcomes for Test
// Integration, the overflow half's splits and results for Test Unit. Every Change Profile result but
// `success` reads the same to a condition and a script, as does every docs value but `true` and `false`,
// so one of each stands for the rest.
const plannedLaneStates = (lane: PlannedLane): ReadonlyArray<AggregateState> =>
  A.flatMap(plannedStates(["success", "failure", ""], ["true", "false", "invalid"]), (state) =>
    lane.expand({ ...state, admission: "success" })
  );

// The documentation diff of #3215: Heavy Admission is skipped there by design, so the integration verdict
// passes without it.
const isDocumentationPass = (state: AggregateState): boolean =>
  state.classification === "success" &&
  state.docs === "true" &&
  state.plan === "success" &&
  state.planned === "[]" &&
  docsShardsSkipped(state);

// The hosted shards' result as the Test Unit script reads it with the overflow half folded in: an empty
// overflow half must be skipped, a routed one must succeed, and an empty hosted half beside a routed one
// was never allocated. A lane without an overflow half reads its shard result unchanged.
const foldedShardResult = (state: AggregateState): string => {
  if (overflowOf(state) === "[]") {
    return overflowResultOf(state) === "skipped" ? state.result : "failure";
  }
  if (overflowResultOf(state) !== "success") {
    return "failure";
  }
  return hostedOf(state) === "[]" && state.result === "skipped" ? "success" : state.result;
};

const plannedVerdict = (lane: PlannedLane, state: AggregateState): boolean =>
  isDocumentationPass(state) ||
  (plannedLaneShouldPass(lane, { ...state, result: foldedShardResult(state) }) &&
    (lane.job !== "test-integration" || state.admission === "success"));

// One state's outcome against its expected verdict, and a skip only where it is sound.
const assertPlannedOutcome = (lane: PlannedLane, state: AggregateState, outcome: AggregateOutcome): void => {
  const label = `${lane.job}: ${state.classification}/${state.docs}/${state.result}/${state.plan}/${state.planned}/${state.admission}/${hostedOf(state)}+${overflowOf(state)}:${overflowResultOf(state)} -> ${outcome}`;
  assert.strictEqual(outcome !== "failed", plannedVerdict(lane, state), label);
  assert.isTrue(outcome !== "skipped" || skipIsSound(true, state), label);
};

// Skip on success: a code diff whose planned shards all passed takes no aggregate runner.
const greenCodeState: AggregateState = {
  admission: "success",
  classification: "success",
  docs: "false",
  plan: "success",
  planned: '["unit-a","int-rest"]',
  result: "success",
};
// Skip on success across both Test Unit halves: part of the plan routed with both halves green, and every
// partition routed with the empty hosted half skipped.
const greenRoutedStates: ReadonlyArray<AggregateState> = [
  { ...greenCodeState, hosted: '["int-rest"]', overflow: '["unit-a"]', overflowResult: "success" },
  { ...greenCodeState, hosted: "[]", overflow: greenCodeState.planned, result: "skipped", overflowResult: "success" },
];
const greenStates = (lane: PlannedLane): ReadonlyArray<AggregateState> =>
  lane.job === "test-unit" ? [greenCodeState, ...greenRoutedStates] : [greenCodeState];

it.effect(
  "skips the planned aggregates only on a verdict already passed, across classification, plan and shard outcomes",
  Effect.fnUntraced(function* () {
    const workflow = yield* readCheckWorkflow;
    for (const lane of plannedLanes) {
      assert.strictEqual(yamlAt(workflow, ["jobs", lane.job, "if"]), aggregateGuards[lane.job]);
      const greens = greenStates(lane);
      const states = A.appendAll(plannedLaneStates(lane), greens);
      const outcomes = aggregateOutcomes(workflow, lane.job, lane.shard, lane.output, states);
      A.forEach(A.zip(states, outcomes), ([state, outcome]) => assertPlannedOutcome(lane, state, outcome));
      assert.deepEqual(
        A.takeRight(outcomes, A.length(greens)),
        A.map(greens, () => "skipped"),
        `${lane.job} on green shards`
      );
      assert.deepEqual(yamlAt(workflow, ["jobs", lane.job, "needs"]), lane.needs);
      assert.strictEqual(
        yamlAt(workflow, ["jobs", lane.job, "steps", 0, "env", "PLANNED_PARTITIONS"]),
        `\${{ needs.test-plan.outputs.${lane.output} }}`
      );
      assert.deepEqual(yamlAt(workflow, ["jobs", lane.shard, "needs"]), ["change-profile", "test-plan"]);
      assert.strictEqual(
        yamlAt(workflow, ["jobs", lane.shard, "if"]),
        `needs.change-profile.outputs.docs_only != 'true' && needs.test-plan.outputs.${lane.shardOutput} != '[]'`
      );
    }
  })
);

// Shard overflow (goals/ci-lane-economics, 2026-11-13): Test Plan may route part of the Test Unit plan to
// the self-hosted pool. The verdict passes only when the two halves hold the plan exactly once and each
// half passed or, holding nothing, was never allocated.
it.effect(
  "executes the Test Unit aggregate across the hosted and overflow halves of the plan",
  Effect.fnUntraced(function* () {
    const workflow = yield* readCheckWorkflow;
    const script = aggregateScript(workflow, "test-unit");
    const base = { admission: "", classification: "success", docs: "false", plan: "success" };
    const passes = (state: Omit<AggregateState, keyof typeof base>) =>
      aggregatePasses(script, "test-unit-shard", { ...base, ...state });
    const plan = '["repo-cli-1","unit-a"]';
    const split = { planned: plan, hosted: '["unit-a"]', overflow: '["repo-cli-1"]' };
    assert.isTrue(passes({ ...split, result: "success", overflowResult: "success" }), "both halves passed");
    assert.isTrue(
      passes({ planned: plan, hosted: "[]", overflow: plan, result: "skipped", overflowResult: "success" }),
      "every partition routed"
    );
    for (const overflowResult of ["failure", "cancelled", "skipped", ""]) {
      assert.isFalse(passes({ ...split, result: "success", overflowResult }), `overflow ${overflowResult}`);
    }
    for (const result of ["failure", "cancelled", "skipped", ""]) {
      assert.isFalse(passes({ ...split, result, overflowResult: "success" }), `hosted ${result}`);
    }
    // An empty half that reports anything but a skip, and halves that lose or repeat a partition.
    assert.isFalse(
      passes({ planned: plan, hosted: plan, overflow: "[]", result: "success", overflowResult: "success" })
    );
    assert.isFalse(
      passes({ planned: plan, hosted: '["unit-a"]', overflow: "[]", result: "success", overflowResult: "skipped" })
    );
    assert.isFalse(
      passes({ planned: plan, hosted: plan, overflow: '["unit-a"]', result: "success", overflowResult: "success" })
    );
    assert.isFalse(
      passes({
        planned: plan,
        hosted: '["unit-a"]',
        overflow: '["unit-b"]',
        result: "success",
        overflowResult: "success",
      })
    );
    assert.isFalse(passes({ ...split, hosted: "null", result: "success", overflowResult: "success" }));

    // The overflow caller: the routed half only, never for a fork, proving the whole plan.
    assert.deepEqual(yamlAt(workflow, ["jobs", "test-unit-overflow", "needs"]), ["change-profile", "test-plan"]);
    assert.strictEqual(
      yamlAt(workflow, ["jobs", "test-unit-overflow", "if"]),
      `needs.change-profile.outputs.docs_only != 'true' && needs.test-plan.outputs.test_unit_overflow != '[]' && (github.event_name == 'push' || ${sameRepository})`
    );
    assert.strictEqual(
      yamlAt(workflow, ["jobs", "test-unit-overflow", "strategy", "matrix", "partition"]),
      "${{ fromJSON(needs.test-plan.outputs.test_unit_overflow) }}"
    );
    assert.strictEqual(
      yamlAt(workflow, ["jobs", "test-unit-overflow", "with", "planned_partitions"]),
      "${{ needs.test-plan.outputs.test_unit }}"
    );
    // The halves are published by the settle step alone, which is executed below.
    assert.strictEqual(
      yamlAt(workflow, ["jobs", "test-plan", "outputs", "test_unit_hosted"]),
      "${{ steps.split.outputs.test_unit_hosted }}"
    );
    assert.strictEqual(
      yamlAt(workflow, ["jobs", "test-plan", "outputs", "test_unit_overflow"]),
      "${{ steps.split.outputs.test_unit_overflow }}"
    );
  })
);

// Test Plan's settle step: the routed split is published only when it holds the plan exactly once; anything
// else publishes every partition hosted. A successful Test Plan therefore never carries a split that drops,
// repeats or invents a partition, which the Test Unit aggregate's skip on success relies on.
const settleCases: ReadonlyArray<
  readonly [label: string, plan: string, hosted: string, overflow: string, expected: readonly [string, string]]
> = [
  ["overflow off", '["unit-a","repo-cli-1"]', "", "", ['["unit-a","repo-cli-1"]', "[]"]],
  ["nothing routed", '["unit-a","repo-cli-1"]', '["unit-a","repo-cli-1"]', "[]", ['["unit-a","repo-cli-1"]', "[]"]],
  ["part routed", '["unit-a","repo-cli-1"]', '["unit-a"]', '["repo-cli-1"]', ['["unit-a"]', '["repo-cli-1"]']],
  ["all routed", '["unit-a","repo-cli-1"]', "[]", '["unit-a","repo-cli-1"]', ["[]", '["unit-a","repo-cli-1"]']],
  ["half written", '["unit-a","repo-cli-1"]', '["unit-a"]', "", ['["unit-a","repo-cli-1"]', "[]"]],
  ["a partition dropped", '["unit-a","repo-cli-1"]', '["unit-a"]', "[]", ['["unit-a","repo-cli-1"]', "[]"]],
  [
    "a partition repeated",
    '["unit-a","repo-cli-1"]',
    '["unit-a"]',
    '["unit-a","repo-cli-1"]',
    ['["unit-a","repo-cli-1"]', "[]"],
  ],
  ["a partition invented", '["unit-a","repo-cli-1"]', '["unit-a"]', '["unit-b"]', ['["unit-a","repo-cli-1"]', "[]"]],
  ["malformed", '["unit-a","repo-cli-1"]', "unit-a", '["repo-cli-1"]', ['["unit-a","repo-cli-1"]', "[]"]],
  ["not arrays", '["unit-a","repo-cli-1"]', '{"a":1}', '"repo-cli-1"', ['["unit-a","repo-cli-1"]', "[]"]],
  ["empty plan", "[]", "", "", ["[]", "[]"]],
];

it.effect(
  "settles the Test Unit split to an exact partition of the plan or to every partition hosted",
  Effect.fnUntraced(function* () {
    const workflow = yield* readCheckWorkflow;
    const steps = yield* decodeWorkflowSteps(yamlAt(workflow, ["jobs", "test-plan", "steps"]));
    const settle = O.getOrThrow(A.findFirst(steps, (step) => yamlAt(step, ["id"]) === "split"));
    assert.deepEqual(yamlAt(settle, ["env"]), {
      PLANNED_TEST_UNIT: "${{ steps.plan.outputs.test_unit }}",
      ROUTED_HOSTED: "${{ steps.overflow.outputs.test_unit_hosted }}",
      ROUTED_OVERFLOW: "${{ steps.overflow.outputs.test_unit_overflow }}",
    });
    // It runs after the routing step, and nothing lets it fail without failing Test Plan.
    assert.isUndefined(yamlAt(settle, ["if"]));
    assert.isUndefined(yamlAt(settle, ["continue-on-error"]));
    const ids = A.map(steps, (step) => yamlAt(step, ["id"]));
    assert.isTrue(A.findFirstIndex(ids, (id) => id === "overflow") < A.findFirstIndex(ids, (id) => id === "split"));
    const script = yamlAt(settle, ["run"]);
    assertTrue(isWorkflowText(script));
    const outputs = bashBatch(
      A.map(
        settleCases,
        ([, plan, hosted, overflow, [settledHosted, settledOverflow]]) =>
          `( out="$(mktemp)"; trap 'rm -f "$out"' EXIT; export GITHUB_OUTPUT="$out" PLANNED_TEST_UNIT='${plan}' ROUTED_HOSTED='${hosted}' ROUTED_OVERFLOW='${overflow}'\n${script}\n[[ "$(cat "$out")" == "$(printf 'test_unit_hosted=%s\\ntest_unit_overflow=%s' '${settledHosted}' '${settledOverflow}')" ]] ) > /dev/null 2>&1; echo $?`
      )
    );
    A.forEach(A.zip(settleCases, outputs), ([[label], settled]) => assert.isTrue(settled, label));
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
      `\${{ !cancelled() && ((needs.admission.result == 'success' && (needs.admission.outputs.verdict == 'run' || needs.admission.outputs.verdict == 'skip-satisfied')) || (needs.admission.result == 'skipped' && needs.change-profile.result == 'success' && ${docsOnlyFromThisRepository})) }}`
    );
    assert.strictEqual(
      yamlAt(check, ["jobs", "heavy", "with", "admitted"]),
      "${{ needs.admission.outputs.verdict == 'run' }}"
    );
    // A job publishes the outputs its steps wrote even when a later step fails it, which the
    // simulation below does not model. An admission that decided and then failed (or was cancelled)
    // must not reach Heavy with the verdict it left behind; only a successful one does.
    const heavyGuard = yamlAt(check, ["jobs", "heavy", "if"]);
    assertTrue(isWorkflowText(heavyGuard));
    assert.deepEqual(
      A.filter(publishedVerdictCases, (state) => heavyStartsOnPublishedVerdict(heavyGuard, state)),
      A.filter(publishedVerdictCases, (state) => state.admission === "success")
    );
    const admissionSteps = yield* decodeWorkflowSteps(yamlAt(check, ["jobs", "admission", "steps"]));
    assert.isFalse(A.some(admissionSteps, (step) => yamlAt(step, ["id"]) === "docs"));
    for (const caller of [
      {
        file: "check.yml",
        shortcut: O.some(docsOnlyFromThisRepository),
        docsIndex: 0,
        setupIndex: 2,
        decideIndex: 3,
        stepGuard: undefined,
        profile: "needs.change-profile.outputs.docs_only",
        guard: "",
      },
      // Heavy Admit decides admission only on an admission label event; its first step re-reports.
      {
        file: "heavy-admit.yml",
        shortcut: O.none<string>(),
        docsIndex: 5,
        setupIndex: 6,
        decideIndex: 7,
        stepGuard: "env.ADMISSION_LABEL_EVENT == 'true' && steps.docs.outputs.verdict != 'skip-satisfied'",
        profile: "steps.profile.outputs.docs_only",
        guard: "env.ADMISSION_LABEL_EVENT == 'true' && ",
      },
    ]) {
      const source = yield* Effect.tryPromise({
        try: () => Bun.file(new URL(`../../../../../.github/workflows/${caller.file}`, import.meta.url)).text(),
        catch: CiCommandError.new("Unable to read the checked-in admission caller."),
      });
      const workflow = parseWorkflowYaml(source);
      assert.strictEqual(yamlAt(workflow, ["env", "BEEP_CI_PR_BASE_SHA"]), "${{ github.event.pull_request.base.sha }}");
      assert.strictEqual(yamlAt(workflow, ["env", "BEEP_CI_PR_HEAD_SHA"]), "${{ github.event.pull_request.head.sha }}");
      const shortcut = O.getOrElse(caller.shortcut, () =>
        yamlAt(workflow, ["jobs", "admission", "steps", caller.docsIndex, "if"])
      );
      assertTrue(isWorkflowText(shortcut));
      assert.strictEqual(
        shortcut,
        `${caller.guard}${caller.profile} == 'true' && github.event.pull_request.head.repo.full_name == github.repository`
      );
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
          Str.replaceAll("env.ADMISSION_LABEL_EVENT", "'true'"),
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

// A job condition rendered for bash: every context name replaced by its quoted value.
const renderCondition = (expression: string, context: Readonly<Record<string, string>>): string => {
  const rendered = pipe(
    R.toEntries(context),
    A.sortBy(([left], [right]) => (left.length === right.length ? 0 : left.length > right.length ? -1 : 1)),
    A.reduce(
      pipe(
        expression,
        Str.replaceAll("${{", ""),
        Str.replaceAll("}}", ""),
        Str.replaceAll("!cancelled()", "'ok' == 'ok'"),
        // GitHub's `contains(text, 'item')` on a string is a substring test: a bash glob match.
        Str.replaceAll(/contains\(([a-z0-9_.-]+), ('[^']*')\)/gu, "$1 == *$2*"),
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
  return rendered;
};

const conditionEntry = (rendered: string): string => `[[ ${rendered} ]]; echo $?`;

const expressionHolds = (expression: string, context: Readonly<Record<string, string>>): boolean =>
  O.getOrThrow(A.head(bashBatch([conditionEntry(renderCondition(expression, context))])));

// Every admission result paired with a verdict its `decide` step already published.
const publishedVerdictCases = A.flatMap(["run", "skip-satisfied"], (verdict) =>
  A.map(["success", "failure", "cancelled", "skipped"], (admission) => ({ admission, verdict }))
);
const heavyStartsOnPublishedVerdict = (
  guard: string,
  state: { readonly admission: string; readonly verdict: string }
): boolean =>
  expressionHolds(guard, {
    "needs.admission.result": state.admission,
    "needs.admission.outputs.verdict": state.verdict,
    "needs.change-profile.result": "success",
    "needs.change-profile.outputs.docs_only": "false",
    "github.event.pull_request.head.repo.full_name": "beep-effect/beep-effect",
    "github.repository": "beep-effect/beep-effect",
  });

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
  "test-plan.test_unit_hosted": "[]",
  "test-plan.test_unit_overflow": "[]",
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
    for (const job of [
      ...aggregateJobs,
      ...shardJobs,
      "test-unit-overflow",
      "admission",
      "coverage-regression",
      "security",
      "sast",
    ]) {
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

const codeOutputs = {
  "change-profile.docs_only": "false",
  "test-plan.test_unit": '["unit-a","repo-cli-1"]',
  "test-plan.test_unit_hosted": '["unit-a","repo-cli-1"]',
  "test-plan.test_unit_overflow": "[]",
  "test-plan.test_integration": '["int-rest"]',
  "admission.verdict": "run",
};
// The same code diff with part of the Test Unit plan, or all of it, routed to the overflow pool.
const routedOutputs = {
  ...codeOutputs,
  "test-plan.test_unit_hosted": '["unit-a"]',
  "test-plan.test_unit_overflow": '["repo-cli-1"]',
};
const allRoutedOutputs = {
  ...codeOutputs,
  "test-plan.test_unit_hosted": "[]",
  "test-plan.test_unit_overflow": '["unit-a","repo-cli-1"]',
};

// Which of the four aggregates a simulated code run starts: exactly `started`, every other one skipped.
const assertAggregatesStarted = (
  results: Readonly<Record<string, JobResult>>,
  started: ReadonlyArray<string>,
  label: string
): void =>
  A.forEach(aggregateJobs, (job) =>
    assert.strictEqual(
      R.get(results, job).pipe(O.getOrThrow),
      A.contains(started, job) ? "success" : "skipped",
      `${job} ${label}`
    )
  );

// A red shard, a failed plan or admission and an unreadable profile each start the aggregates they reach,
// whose scripts (executed above) then fail; an aggregate whose own shards and checks passed still takes no
// runner. An empty or malformed docs_only output is not a documentation diff.
const startedAggregateCases: ReadonlyArray<{
  readonly forced: Readonly<Record<string, JobResult>>;
  readonly docs: string;
  readonly started: ReadonlyArray<string>;
}> = [
  { forced: { "test-unit-shard": "failure", "lint-shard": "failure" }, docs: "false", started: ["lint", "test-unit"] },
  {
    forced: { "test-integration-shard": "failure", "property-laws-shard": "failure" },
    docs: "false",
    started: ["property-laws", "test-integration"],
  },
  { forced: { "test-plan": "failure" }, docs: "false", started: ["test-integration", "test-unit"] },
  { forced: { admission: "failure" }, docs: "false", started: ["test-integration"] },
  { forced: { "change-profile": "failure" }, docs: "false", started: aggregateJobs },
  { forced: {}, docs: "", started: aggregateJobs },
  { forced: {}, docs: "invalid", started: aggregateJobs },
];

it.effect(
  "starts an aggregate, fail-closed, unless its verdict already passed on documentation or on green shards",
  Effect.fnUntraced(function* () {
    const workflow = yield* readCheckWorkflow;
    const code = simulateJobs(workflow, { forced: {}, github: thisRepository, outputs: codeOutputs });
    // A green code diff requests every hosted job except Docs Policy and the four aggregates, whose
    // shards all passed (skip on success).
    const hosted = pipe(
      R.keys(code),
      A.filter((id) => isWorkflowText(yamlAt(workflow, ["jobs", id, "runs-on"]))),
      A.sort(Str.Order)
    );
    assert.deepEqual(
      runnerRequests(workflow, code),
      A.filter(hosted, (id) => id !== "docs-policy" && !A.contains(aggregateJobs, id))
    );
    assertAggregatesStarted(code, [], "on green shards");
    assert.strictEqual(R.get(code, "heavy").pipe(O.getOrThrow), "success");
    A.forEach(startedAggregateCases, ({ forced, docs, started }) =>
      assertAggregatesStarted(
        simulateJobs(workflow, {
          forced,
          github: thisRepository,
          outputs: { ...codeOutputs, "change-profile.docs_only": docs },
        }),
        started,
        `under ${R.keys(forced)} with docs_only=${docs}`
      )
    );
    // A failed Change Profile leaves Heavy Admission and the Heavy caller unstarted, so the heavy
    // contexts stay "Expected" and the pull request stays blocked.
    // Both Test Unit halves green, or every partition routed and green, still skip the aggregate; a routed
    // half that failed, or was skipped although it held partitions, starts it.
    for (const outputs of [routedOutputs, allRoutedOutputs]) {
      assertAggregatesStarted(simulateJobs(workflow, { forced: {}, github: thisRepository, outputs }), [], "routed");
      for (const overflow of ["failure", "skipped"] as const) {
        assertAggregatesStarted(
          simulateJobs(workflow, { forced: { "test-unit-overflow": overflow }, github: thisRepository, outputs }),
          ["test-unit"],
          `with the overflow half ${overflow}`
        );
      }
    }
    // The routed half runs only from this repository: a fork's routed plan starts no overflow caller.
    const fork = { ...thisRepository, "github.event.pull_request.head.repo.full_name": "contributor/fork" };
    const forked = simulateJobs(workflow, { forced: {}, github: fork, outputs: routedOutputs });
    assert.strictEqual(R.get(forked, "test-unit-overflow").pipe(O.getOrThrow), "skipped");
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

// #3133 (2026-11-12): the base ruleset reads only the newest Heavy Admit run's suite, so a run that
// skipped for an unrelated label hid the heavy checks an earlier admitted run reported. A later label
// on a same-repository head that carries `ready-for-heavy` therefore re-reports a passing proof
// (heavy.yml with `admitted: false`, every lane skipped before runner allocation) or skips, and never
// re-runs the matrix; fork admission stays on the event's label, so a later label never re-admits a
// fork head that changed after review.
const HEAVY_ADMIT_HEAD = "cccccccccccccccccccccccccccccccccccccccc";
const HEAVY_ADMIT_SELF = 900;
interface HeavyAdmitPriorRun {
  readonly conclusion: string | null;
  readonly createdAt: string;
  readonly id: number;
  readonly lanes: boolean;
  readonly status: string;
}
const priorRun = (
  id: number,
  createdAt: string,
  conclusion: string | null,
  lanes: boolean,
  status = "completed"
): HeavyAdmitPriorRun => ({ id, status, conclusion, createdAt, lanes });
// A Heavy Admit run's check suite, and its lane check runs' ids (run id * 10 + lane).
const priorSuite = (run: HeavyAdmitPriorRun) => 5000 + run.id;
const PRIOR_LANES = ["Heavy / Check", "Heavy / Docgen"];

/** Another check run of a heavy lane on the head, outside every Heavy Admit suite (Check's own). */
interface HeavyLaneCopy {
  readonly conclusion: string | null;
  readonly id: number;
  readonly name: string;
  readonly status: string;
}
const CHECK_WORKFLOW_SUITE = 7001;
/** The main commit every prior run called heavy.yml at, and a later one main moved to. */
const HEAVY_COMMIT = "1111111111111111111111111111111111111111";
const LATER_HEAVY_COMMIT = "2222222222222222222222222222222222222222";
// A run's referenced workflows: heavy.yml at `sha`, after another reusable workflow it does not count.
const referencedWorkflows = (sha: string) => [
  { path: "beep-effect/beep-effect/.github/workflows/heavy-producer.yml@main", sha: LATER_HEAVY_COMMIT },
  { path: "beep-effect/beep-effect/.github/workflows/heavy.yml@main", sha, ref: "refs/heads/main" },
];

/** One Heavy Admit routing row: the label event, the head's labels and runs, and the route it takes. */
interface HeavyAdmitRoutingRow {
  readonly copies?: ReadonlyArray<HeavyLaneCopy> | "unreadable";
  readonly event: string;
  readonly head: string;
  /** heavy.yml's blob at {@link LATER_HEAVY_COMMIT}: the proof's file, a changed one, or a failed read. */
  readonly heavyBlob?: "same" | "changed" | "unreadable";
  readonly labels: ReadonlyArray<string>;
  readonly route: string;
  readonly runs: ReadonlyArray<HeavyAdmitPriorRun> | "unreadable";
  /** The heavy.yml commit this run calls; every prior run called {@link HEAVY_COMMIT}. */
  readonly selfHeavy?: string | "unreadable";
}

// heavy.yml's blob at each commit, as the fake contents API serves it.
const HEAVY_BLOB = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const blobEnv = (heavyBlob: "same" | "changed" | "unreadable") => ({
  HEAVY_COMMIT_SHA: HEAVY_COMMIT,
  LATER_COMMIT_SHA: LATER_HEAVY_COMMIT,
  HEAVY_BLOB,
  LATER_BLOB:
    heavyBlob === "same" ? HEAVY_BLOB : heavyBlob === "changed" ? "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" : "",
});

// This run as the fake `gh` serves it: the heavy.yml commit it calls, or a read that fails.
const selfRunEnv = (selfHeavy: string | "unreadable") =>
  selfHeavy === "unreadable"
    ? { SELF_UNREADABLE: "1", SELF_JSON: "" }
    : {
        SELF_UNREADABLE: "",
        SELF_JSON: encodeJson({ id: HEAVY_ADMIT_SELF, referenced_workflows: referencedWorkflows(selfHeavy) }),
      };

// Run the re-report step against a fake `gh` serving `runs` for this head (and only this head and
// event), each run's jobs (a run with lanes reports `Heavy / Check` and `Heavy / Docgen`, one without
// only `Heavy`), the head's check runs (those lanes in each run's suite plus `copies`), and this run
// with the heavy.yml commit it calls.
const runReReport = (
  script: string,
  runs: ReadonlyArray<HeavyAdmitPriorRun> | "unreadable",
  copies: ReadonlyArray<HeavyLaneCopy> | "unreadable" = [],
  selfHeavy: string | "unreadable" = HEAVY_COMMIT,
  heavyBlob: "same" | "changed" | "unreadable" = "changed"
) => {
  const workflowRuns: ReadonlyArray<HeavyAdmitPriorRun> = runs === "unreadable" ? [] : runs;
  const fixture = `gh() {
  [[ "$1" == 'api' ]] || return 98
  local path=''
  for arg in "$@"; do [[ "$arg" == repos/* ]] && path="$arg"; done
  case "$path" in
    "repos/\${GH_REPO}/actions/workflows/heavy-admit.yml/runs")
      [[ "$*" == *"head_sha=\${HEAD_SHA}"* && "$*" == *'event=pull_request'* ]] || return 96
      [[ -z "\${UNREADABLE:-}" ]] || return 1
      printf '%s\\n' "$RUNS_JSON" ;;
    "repos/\${GH_REPO}/actions/runs/\${RUN_ID}")
      [[ -z "\${SELF_UNREADABLE:-}" ]] || return 1
      printf '%s\\n' "$SELF_JSON" ;;
    "repos/\${GH_REPO}/actions/runs/"*/jobs)
      local id="\${path#repos/\${GH_REPO}/actions/runs/}"
      jq -c --arg id "\${id%/jobs}" '{jobs: (.[$id] // [])}' <<< "$JOBS_JSON" ;;
    "repos/\${GH_REPO}/contents/.github/workflows/heavy.yml?ref="*)
      local ref="\${path##*ref=}"
      if [[ "$ref" == "$HEAVY_COMMIT_SHA" ]]; then printf '{"sha":"%s"}\\n' "$HEAVY_BLOB"
      elif [[ "$ref" == "$LATER_COMMIT_SHA" && -n "$LATER_BLOB" ]]; then printf '{"sha":"%s"}\\n' "$LATER_BLOB"
      else return 1
      fi ;;
    "repos/\${GH_REPO}/commits/\${HEAD_SHA}/check-runs")
      [[ "$*" == *'filter=all'* ]] || return 95
      [[ -z "\${CHECKS_UNREADABLE:-}" ]] || return 1
      printf '%s\\n' "$CHECKS_JSON" ;;
    *) return 97 ;;
  esac
}
GITHUB_OUTPUT="$(mktemp)"
export GITHUB_OUTPUT
# The step may exit early; its outputs are printed on any exit.
trap 'printf "%s\\n" "--- outputs"; cat "$GITHUB_OUTPUT"; rm -f "$GITHUB_OUTPUT"' EXIT
${script}`;
  const executed = Bun.spawnSync(["bash", "-c", fixture], {
    cwd: "/",
    env: {
      ...process.env,
      GH_REPO: "beep-effect/beep-effect",
      GH_TOKEN: "fixture",
      HEAD_SHA: HEAVY_ADMIT_HEAD,
      RUN_ID: `${HEAVY_ADMIT_SELF}`,
      UNREADABLE: runs === "unreadable" ? "1" : "",
      RUNS_JSON: encodeJson({
        total_count: A.length(workflowRuns),
        workflow_runs: [
          // This run is listed too, still going, and never reads as an earlier proof.
          { id: HEAVY_ADMIT_SELF, status: "in_progress", conclusion: null, created_at: "2026-11-12T23:59:00Z" },
          ...A.map(workflowRuns, (run) => ({
            id: run.id,
            status: run.status,
            conclusion: run.conclusion,
            created_at: run.createdAt,
            check_suite_id: priorSuite(run),
            referenced_workflows: referencedWorkflows(HEAVY_COMMIT),
          })),
        ],
      }),
      ...selfRunEnv(selfHeavy),
      ...blobEnv(heavyBlob),
      CHECKS_UNREADABLE: copies === "unreadable" ? "1" : "",
      CHECKS_JSON: encodeJson({
        check_runs: [
          ...pipe(
            workflowRuns,
            A.filter((run) => run.lanes),
            A.flatMap((run) =>
              A.map(PRIOR_LANES, (name, lane) => ({
                id: run.id * 10 + lane,
                name,
                status: run.status,
                conclusion: run.conclusion,
                check_suite: { id: priorSuite(run) },
              }))
            )
          ),
          ...A.map(copies === "unreadable" ? [] : copies, (copy) => ({
            ...copy,
            check_suite: { id: CHECK_WORKFLOW_SUITE },
          })),
        ],
      }),
      JOBS_JSON: encodeJson(
        R.fromEntries(
          A.map(workflowRuns, (run) => [
            `${run.id}`,
            run.lanes
              ? [{ name: "Heavy Admission" }, { name: "Heavy / Check" }, { name: "Heavy / Docgen" }]
              : [{ name: "Heavy Admission" }, { name: "Heavy" }],
          ])
        )
      ),
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  assert.strictEqual(executed.exitCode, 0, executed.stderr.toString());
  const outputs = pipe(
    executed.stdout.toString(),
    Str.split("--- outputs\n"),
    A.last,
    O.getOrElse(() => "")
  );
  return Str.includes("verdict=skip-satisfied\nadmitted=false")(outputs)
    ? "re-report"
    : Str.isEmpty(outputs)
      ? "skip"
      : outputs;
};

it.effect(
  "routes a Heavy Admit label event to admission, a re-report, a skip, or the fork rule",
  Effect.fnUntraced(function* () {
    const source = yield* Effect.tryPromise({
      try: () => Bun.file(new URL("../../../../../.github/workflows/heavy-admit.yml", import.meta.url)).text(),
      catch: CiCommandError.new("Unable to read the checked-in Heavy Admit workflow."),
    });
    const workflow = parseWorkflowYaml(source);
    const admits = yamlAt(workflow, ["jobs", "admission", "if"]);
    assertTrue(isWorkflowText(admits));
    // Admitting and re-reporting runs share one group, so a later label waits behind an executing matrix.
    assert.strictEqual(yamlAt(workflow, ["concurrency", "group"]), `heavy-admit-\${{ github.ref }}-\${{ ${admits} }}`);
    assert.strictEqual(yamlAt(workflow, ["concurrency", "cancel-in-progress"]), false);
    assert.deepEqual(yamlAt(workflow, ["jobs", "admission", "permissions"]), {
      contents: "read",
      actions: "read",
      checks: "read",
    });
    const labelEvent =
      "github.event.label.name == 'ready-for-heavy' || github.event.label.name == 'ready-for-heavy-fork'";
    assert.strictEqual(
      yamlAt(workflow, ["jobs", "admission", "env", "ADMISSION_LABEL_EVENT"]),
      `\${{ ${labelEvent} }}`
    );
    const steps = yield* decodeWorkflowSteps(yamlAt(workflow, ["jobs", "admission", "steps"]));
    const rereport = A.findFirst(steps, (step) => yamlAt(step, ["id"]) === "rereport").pipe(O.getOrThrow);
    assert.strictEqual(yamlAt(rereport, ["if"]), "env.ADMISSION_LABEL_EVENT != 'true'");
    assert.deepEqual(yamlAt(rereport, ["env"]), {
      GH_TOKEN: "${{ github.token }}",
      GH_REPO: "${{ github.repository }}",
      HEAD_SHA: "${{ github.event.pull_request.head.sha }}",
      RUN_ID: "${{ github.run_id }}",
    });
    // Every other step (checkout, setup, the admission decision) runs only on an admission label event.
    for (const step of A.filter(steps, (step) => step !== rereport)) {
      const guard = yamlAt(step, ["if"]);
      assertTrue(isWorkflowText(guard));
      assertTrue(Str.startsWith("env.ADMISSION_LABEL_EVENT == 'true'")(guard), `${yamlAt(step, ["name"])}`);
    }
    for (const output of ["verdict", "admitted"]) {
      assert.strictEqual(
        yamlAt(workflow, ["jobs", "admission", "outputs", output]),
        `\${{ steps.decide.outputs.${output} || steps.docs.outputs.${output} || steps.rereport.outputs.${output} }}`
      );
    }
    // A re-report's `skip-satisfied` calls the heavy caller with `admitted: false`: every lane skipped, no runner.
    assert.strictEqual(
      yamlAt(workflow, ["jobs", "heavy", "if"]),
      "${{ needs.admission.outputs.verdict == 'run' || needs.admission.outputs.verdict == 'skip-satisfied' }}"
    );
    assert.strictEqual(
      yamlAt(workflow, ["jobs", "heavy", "with", "admitted"]),
      "${{ needs.admission.outputs.verdict == 'run' }}"
    );
    const script = yamlAt(rereport, ["run"]);
    assertTrue(isWorkflowText(script));

    const same = "beep-effect/beep-effect";
    const fork = "contributor/fork";
    const both = ["ready-for-heavy", "ready-for-heavy-fork"];
    const admitted = priorRun(101, "2026-11-12T23:27:45Z", "success", true);
    // Check-suite copies of a lane, older (id 900) or newer (2000s) than the admitted run's (1010, 1011).
    const laneCopy = (id: number, name: string, status: string, conclusion: string | null): HeavyLaneCopy => ({
      id,
      name,
      status,
      conclusion,
    });
    const reopened = {
      head: same,
      event: "unblocks-main",
      labels: ["ready-for-heavy", "unblocks-main"],
      runs: [admitted],
    };
    const rows: ReadonlyArray<HeavyAdmitRoutingRow> = [
      // Admission label: the full decision, exactly as before.
      { head: same, event: "ready-for-heavy", labels: ["ready-for-heavy"], runs: [], route: "run" },
      // Re-report: the newest earlier run that reported lanes succeeded; a newer run with no lane
      // (a skip, or a pending run the group replaced) is read past.
      {
        head: same,
        event: "unblocks-main",
        labels: ["ready-for-heavy", "unblocks-main"],
        runs: [admitted],
        route: "re-report",
      },
      {
        head: same,
        event: "owner-merge-hold",
        labels: ["ready-for-heavy", "owner-merge-hold"],
        runs: [
          admitted,
          priorRun(102, "2026-11-12T23:28:51Z", "skipped", false),
          priorRun(103, "2026-11-12T23:30:00Z", "cancelled", false),
        ],
        route: "re-report",
      },
      // Skip: no proof on the head, a red or cancelled matrix newer than a green one, a run still
      // going, or an unreadable listing. A red is never re-reported as skipped.
      { head: same, event: "unblocks-main", labels: ["ready-for-heavy", "unblocks-main"], runs: [], route: "skip" },
      {
        head: same,
        event: "unblocks-main",
        labels: ["ready-for-heavy", "unblocks-main"],
        runs: [
          admitted,
          priorRun(104, "2026-11-12T23:31:00Z", "failure", true),
          priorRun(105, "2026-11-12T23:32:00Z", "success", false),
        ],
        route: "skip",
      },
      {
        head: same,
        event: "unblocks-main",
        labels: ["ready-for-heavy", "unblocks-main"],
        runs: [admitted, priorRun(106, "2026-11-12T23:33:00Z", null, false, "in_progress")],
        route: "skip",
      },
      {
        head: same,
        event: "unblocks-main",
        labels: ["ready-for-heavy", "unblocks-main"],
        runs: "unreadable",
        route: "skip",
      },
      // A reopened head: Check's own suite re-ran the heavy lanes after the proof. A newer copy that is
      // red or unfinished, or a check-run read that fails, skips, so the re-report masks nothing; an
      // older copy, a newer one that passed, or a lane the re-report never emits does not block it.
      { ...reopened, copies: [laneCopy(2001, "Heavy / Check", "completed", "failure")], route: "skip" },
      { ...reopened, copies: [laneCopy(2002, "Heavy / Docgen", "in_progress", null)], route: "skip" },
      { ...reopened, copies: "unreadable", route: "skip" },
      // The proof ran another heavy.yml commit whose file changed (perhaps adding a lane), the file
      // cannot be compared, or this run's own heavy.yml commit cannot be read: skip, since the
      // re-report would emit lanes the proof never ran. A later main commit that left heavy.yml
      // alone still re-reports.
      { ...reopened, selfHeavy: LATER_HEAVY_COMMIT, route: "skip" },
      { ...reopened, selfHeavy: LATER_HEAVY_COMMIT, heavyBlob: "unreadable", route: "skip" },
      { ...reopened, selfHeavy: LATER_HEAVY_COMMIT, heavyBlob: "same", route: "re-report" },
      { ...reopened, selfHeavy: "unreadable", route: "skip" },
      {
        ...reopened,
        copies: [
          laneCopy(900, "Heavy / Check", "completed", "failure"),
          laneCopy(2003, "Heavy / Check", "completed", "success"),
          laneCopy(2004, "Heavy / Docgen", "completed", "neutral"),
          laneCopy(2005, "Heavy / Test Integration", "completed", "failure"),
        ],
        route: "re-report",
      },
      // Without `ready-for-heavy` a later label skips at job level, as before.
      { head: same, event: "unblocks-main", labels: ["unblocks-main"], runs: [admitted], route: "job-skipped" },
      // Fork: event label only. A later label never re-admits or re-reports a fork head.
      { head: fork, event: "unblocks-main", labels: both, runs: [admitted], route: "job-skipped" },
      { head: fork, event: "ready-for-heavy-fork", labels: both, runs: [], route: "run" },
      { head: fork, event: "ready-for-heavy", labels: ["ready-for-heavy"], runs: [], route: "hold" },
    ];
    for (const row of rows) {
      const evaluate = (expression: string) =>
        pipe(
          expression,
          Str.replaceAll(
            "contains(github.event.pull_request.labels.*.name, 'ready-for-heavy')",
            `'${A.contains(row.labels, "ready-for-heavy")}' == 'true'`
          ),
          Str.replaceAll("github.event.pull_request.head.repo.full_name", `'${row.head}'`),
          Str.replaceAll("github.event.label.name", `'${row.event}'`),
          Str.replaceAll("github.repository", `'${same}'`),
          (rendered) => {
            assert.notInclude(rendered, "github.");
            return (
              Bun.spawnSync(["bash", "-c", `[[ ${rendered} ]]`], { stdout: "pipe", stderr: "pipe" }).exitCode === 0
            );
          }
        );
      const route = !evaluate(admits)
        ? "job-skipped"
        : evaluate(labelEvent)
          ? decideHeavyAdmission(
              HeavyAdmissionEvent.make({
                eventName: "pull_request",
                headRepository: row.head,
                labels: row.labels,
                changedPaths: ["packages/a/src/index.ts"],
              })
            ).verdict
          : runReReport(script, row.runs, row.copies, row.selfHeavy, row.heavyBlob);
      assert.strictEqual(route, row.route, `${row.head} ${row.event} ${encodeJson([row.runs, row.copies])}`);
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
    const same = "beep-effect/beep-effect";
    const warning = "::warning::Could not list this branch's Heavy Admit runs; a superseded run may keep running.\n";
    const cancels =
      "cancelling superseded Heavy Admit run 101\ncancelled:101\ncancelling superseded Heavy Admit run 115\ncancelled:115\n" +
      "cancelling superseded Heavy Admit run 112\ncancelled:112\n";
    // `listing` is what the fake serves; `listings` how many times the step listed the branch's runs.
    for (const row of [
      { event: "pull_request", head: same, repo: same, listing: "ok", stdout: cancels, listings: 2, resolved: true },
      {
        event: "pull_request",
        head: "contributor/fork",
        repo: same,
        listing: "ok",
        stdout: "",
        listings: 0,
        resolved: false,
      },
      { event: "pull_request", head: "", repo: same, listing: "ok", stdout: "", listings: 0, resolved: false },
      { event: "push", head: same, repo: same, listing: "ok", stdout: "", listings: 0, resolved: false },
      // Cancelling is an optimisation: a listing that fails (an unresolved repo, a 5xx, a spent
      // GITHUB_TOKEN budget) is a warning, the step succeeds, and a pass that cancelled nothing is
      // never repeated.
      { event: "pull_request", head: same, repo: "", listing: "ok", stdout: warning, listings: 0, resolved: false },
      { event: "pull_request", head: same, repo: same, listing: "fails", stdout: warning, listings: 1, resolved: true },
      { event: "pull_request", head: same, repo: same, listing: "empty", stdout: "", listings: 1, resolved: true },
    ]) {
      const condition = pipe(
        guard,
        Str.replaceAll("github.event_name", `'${row.event}'`),
        Str.replaceAll("github.event.pull_request.head.repo.full_name", `'${row.head}'`),
        Str.replaceAll("github.repository", "'beep-effect/beep-effect'")
      );
      // One paginated listing per pass, two pages on the first: the superseded runs wait `pending` or
      // `queued` (a finished one is left alone); cancelling the executing one then promotes run 112,
      // which the second pass finds `in_progress`.
      const script = `STATE="$(mktemp -d)"
trap 'rm -rf "$STATE"' EXIT
gh() {
  [[ "$GH_REPO" == 'beep-effect/beep-effect' ]] || return 97
  if [[ "$1" == 'api' ]]; then
    printf 'repo-resolved\\n' >&2
    for arg in "$@"; do [[ "$arg" != status=* ]] || return 96; done
    [[ "$*" == *'--paginate'* && "$*" == *'branch=main'* ]] || return 95
    printf 'listed\\n' >&2
    [[ "$LISTING" != 'fails' ]] || return 1
    if [[ "$LISTING" == 'empty' ]]; then
      printf '{"workflow_runs":[]}\\n'
    elif [[ ! -e "$STATE/listed" ]]; then
      : > "$STATE/listed"
      cat <<'RUNS'
{"workflow_runs":[
  {"id":101,"status":"pending","head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
  {"id":102,"status":"pending","head_repository":{"full_name":"contributor/fork"},"pull_requests":[{"number":2935}],"head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
  {"id":103,"status":"in_progress","head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":99}],"head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
  {"id":104,"status":"queued","head_repository":{"full_name":"beep-effect/beep-effect"},"head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
  {"id":105,"status":"queued","pull_requests":[{"number":2935}],"head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
  {"id":106,"status":"in_progress","head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
  {"id":107,"status":"queued","head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}]},
  {"id":108,"status":"queued","head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":""},
  {"id":109,"status":"queued","head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":null},
  {"id":110,"status":"queued","head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":123},
  {"id":111,"status":"queued","head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":"malformed"},
  {"id":113,"status":"completed","head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
  {"id":114,"head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
  {"status":"queued","head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}
]}
{"workflow_runs":[
  {"id":115,"status":"queued","head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}
]}
RUNS
    else
      printf '{"workflow_runs":[%s,%s,%s]}\\n' \\
        '{"id":101,"status":"completed","head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}' \\
        '{"id":115,"status":"completed","head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}' \\
        '{"id":112,"status":"in_progress","head_repository":{"full_name":"beep-effect/beep-effect"},"pull_requests":[{"number":2935}],"head_sha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}'
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
          LISTING: row.listing,
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      const stderr = executed.stderr.toString();
      assert.strictEqual(executed.exitCode, 0, stderr);
      assert.strictEqual(executed.stdout.toString(), row.stdout);
      assert.strictEqual(pipe(stderr, Str.includes("repo-resolved")), row.resolved);
      // Each pass lists once, with no per-status call; the second pass runs only after a cancel.
      assert.strictEqual(pipe(stderr, Str.split("\n"), A.filter(Str.startsWith("listed")), A.length), row.listings);
    }
  })
);
