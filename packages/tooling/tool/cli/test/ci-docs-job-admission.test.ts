import { CiCommandError, decideHeavyAdmission, HeavyAdmissionEvent } from "@beep/repo-cli/commands/Ci";
import { it } from "@beep/test-runner";
import { assert } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
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
    guard: afterShardsDocsGuard,
  },
  {
    job: "shadcn-lint",
    id: "shadcn-lint",
    name: "Shadcn Lint",
    timeout: 20,
    guard: afterShardsDocsGuard,
  },
  {
    job: "codegen",
    id: "codegen",
    name: "Codegen Drift",
    timeout: 30,
    guard: afterShardsDocsGuard,
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
    assert.isUndefined(yamlAt(workflow, ["jobs", "security", "if"]));
    assert.isUndefined(yamlAt(workflow, ["jobs", "secrets", "if"]));
    assert.isUndefined(yamlAt(workflow, ["jobs", "sast", "if"]));
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
      },
      {
        file: "heavy-admit.yml",
        docsIndex: 4,
        setupIndex: 5,
        decideIndex: 6,
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
      const shortcut = yamlAt(workflow, ["jobs", "admission", "steps", caller.docsIndex, "if"]);
      assertTrue(isWorkflowText(shortcut));
      assert.strictEqual(
        shortcut,
        `${caller.profile} == 'true' && github.event.pull_request.head.repo.full_name == github.repository`
      );
      for (const index of [caller.setupIndex, caller.decideIndex]) {
        assert.strictEqual(
          yamlAt(workflow, ["jobs", "admission", "steps", index, "if"]),
          "steps.docs.outputs.verdict != 'skip-satisfied'"
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
