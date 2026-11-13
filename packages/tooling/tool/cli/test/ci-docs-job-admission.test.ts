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
const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);
const isWorkflowText = S.is(S.String);

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
    for (const caller of [
      {
        file: "check.yml",
        docsIndex: 0,
        setupIndex: 3,
        decideIndex: 4,
        profile: "needs.change-profile.outputs.docs_only",
        guard: "",
      },
      // Heavy Admit decides admission only on an admission label event; its first step re-reports.
      {
        file: "heavy-admit.yml",
        docsIndex: 5,
        setupIndex: 6,
        decideIndex: 7,
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
      const shortcut = yamlAt(workflow, ["jobs", "admission", "steps", caller.docsIndex, "if"]);
      assertTrue(isWorkflowText(shortcut));
      assert.strictEqual(
        shortcut,
        `${caller.guard}${caller.profile} == 'true' && github.event.pull_request.head.repo.full_name == github.repository`
      );
      for (const index of [caller.setupIndex, caller.decideIndex]) {
        assert.strictEqual(
          yamlAt(workflow, ["jobs", "admission", "steps", index, "if"]),
          `${caller.guard}steps.docs.outputs.verdict != 'skip-satisfied'`
        );
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
  readonly labels: ReadonlyArray<string>;
  readonly route: string;
  readonly runs: ReadonlyArray<HeavyAdmitPriorRun> | "unreadable";
  /** The heavy.yml commit this run calls; every prior run called {@link HEAVY_COMMIT}. */
  readonly selfHeavy?: string | "unreadable";
}

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
  selfHeavy: string | "unreadable" = HEAVY_COMMIT
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
      // The proof ran another heavy.yml commit (main moved since, perhaps adding a lane), or this run's
      // own heavy.yml commit cannot be read: skip, since the re-report would emit lanes the proof never ran.
      { ...reopened, selfHeavy: LATER_HEAVY_COMMIT, route: "skip" },
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
          : runReReport(script, row.runs, row.copies, row.selfHeavy);
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
