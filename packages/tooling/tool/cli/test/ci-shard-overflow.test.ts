import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import {
  CiCommandError,
  ciShardOverflowCommand,
  decideShardOverflow,
  isShardOverflowTrustedEvent,
  predictedHostedWaitSeconds,
  renderShardOverflowOutputs,
  renderShardOverflowSummary,
  runShardOverflow,
  SHARD_OVERFLOW_MAX_RUNS_READ,
  SHARD_OVERFLOW_RUNNER_LABEL,
  ShardOverflowDecision,
  ShardOverflowFacts,
  ShardOverflowJob,
  ShardOverflowQueue,
  shardOverflowQueueOf,
} from "@beep/repo-cli/commands/Ci";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import { parseWorkflowYaml, yamlAt } from "./support/WorkflowYaml.ts";

const REPOSITORY = "beep-effect/beep-effect";
const PLAN = ["repo-cli-1", "repo-cli-2", "law-practice-1", "unit-a"];

const facts = (overrides: Partial<ShardOverflowFacts> = {}): ShardOverflowFacts =>
  ShardOverflowFacts.make({
    enabled: true,
    callee: "pinned",
    eventName: "pull_request",
    ref: "refs/pull/1/merge",
    repository: REPOSITORY,
    headRepository: REPOSITORY,
    partitions: PLAN,
    queue: O.some(ShardOverflowQueue.make({ queuedHostedJobs: 140, overflowJobs: 0, runsRead: 12 })),
    waitLimitSeconds: O.some(600),
    poolSize: O.some(48),
    ...overrides,
  });

const busy = (queuedHostedJobs: number, overflowJobs: number) =>
  O.some(ShardOverflowQueue.make({ queuedHostedJobs, overflowJobs, runsRead: 10 }));

describe("decideShardOverflow", () => {
  it("routes the whole plan when the hosted wait passes the limit and the pool has room", () => {
    const decision = decideShardOverflow(facts());
    expect(decision.reason).toBe("routed");
    expect(decision.overflow).toStrictEqual(PLAN);
    expect(decision.hosted).toStrictEqual([]);
    assertSome(decision.predictedWaitSeconds, 770);
    assertSome(decision.freeVms, 48);
  });

  it("routes only into free VMs, in plan order, and keeps the rest hosted", () => {
    const decision = decideShardOverflow(facts({ queue: busy(140, 46) }));
    expect(decision.reason).toBe("routed");
    expect(decision.overflow).toStrictEqual(["repo-cli-1", "repo-cli-2"]);
    expect(decision.hosted).toStrictEqual(["law-practice-1", "unit-a"]);
    assertSome(decision.freeVms, 2);
  });

  it("keeps the plan hosted at or under the limit and when the pool is full", () => {
    // 109 queued jobs predict 599.5 s; 110 predict 605 s.
    expect(decideShardOverflow(facts({ queue: busy(109, 0) })).reason).toBe("below-limit");
    expect(decideShardOverflow(facts({ queue: busy(110, 0) })).reason).toBe("routed");
    expect(decideShardOverflow(facts({ queue: busy(110, 0), waitLimitSeconds: O.some(900) })).reason).toBe(
      "below-limit"
    );
    const full = decideShardOverflow(facts({ queue: busy(400, 60) }));
    expect(full.reason).toBe("pool-full");
    expect(full.hosted).toStrictEqual(PLAN);
    assertSome(full.freeVms, 0);
  });

  it("refuses every untrusted or unready run before reading the queue", () => {
    const refusals: ReadonlyArray<readonly [Partial<ShardOverflowFacts>, string]> = [
      [{ enabled: false }, "disabled"],
      [{ partitions: [] }, "no-partitions"],
      [{ headRepository: "someone/beep-effect" }, "untrusted-event"],
      [{ headRepository: "" }, "untrusted-event"],
      [{ repository: "", headRepository: "" }, "untrusted-event"],
      [{ eventName: "pull_request_target" }, "untrusted-event"],
      [{ eventName: "workflow_dispatch", headRepository: "" }, "untrusted-event"],
      [{ callee: "local" }, "callee-not-pinned"],
      [{ callee: "local", eventName: "push", ref: "refs/heads/other", headRepository: "" }, "callee-not-pinned"],
      [{ waitLimitSeconds: O.none() }, "invalid-setting"],
      [{ poolSize: O.none() }, "invalid-setting"],
      [{ queue: O.none() }, "queue-unreadable"],
    ];
    for (const [override, reason] of refusals) {
      const decision = decideShardOverflow(facts(override));
      expect(decision.reason, reason).toBe(reason);
      expect(decision.overflow, reason).toStrictEqual([]);
      expect(decision.hosted, reason).toStrictEqual(override.partitions ?? PLAN);
      assertNone(decision.predictedWaitSeconds);
    }
  });

  it("lets a local caller route a push to main", () => {
    const decision = decideShardOverflow(
      facts({ callee: "local", eventName: "push", ref: "refs/heads/main", headRepository: "" })
    );
    expect(decision.reason).toBe("routed");
  });

  it("always splits the plan into two disjoint halves that hold every partition", () => {
    for (const queued of [0, 109, 110, 500]) {
      for (const overflowJobs of [0, 1, 3, 4, 47, 48, 60]) {
        const decision = decideShardOverflow(facts({ queue: busy(queued, overflowJobs) }));
        expect(A.appendAll(decision.overflow, decision.hosted)).toStrictEqual(PLAN);
        expect(A.length(decision.overflow)).toBeLessThanOrEqual(Math.max(0, 48 - overflowJobs));
      }
    }
  });
});

describe("shard overflow helpers", () => {
  it("predicts 5.5 seconds of hosted wait per queued job", () => {
    expect(predictedHostedWaitSeconds(0)).toBe(0);
    expect(predictedHostedWaitSeconds(120)).toBe(660);
  });

  it("mirrors the workflow's fork guard", () => {
    expect(isShardOverflowTrustedEvent({ eventName: "push", headRepository: "", repository: REPOSITORY })).toBe(true);
    expect(
      isShardOverflowTrustedEvent({ eventName: "pull_request", headRepository: REPOSITORY, repository: REPOSITORY })
    ).toBe(true);
    expect(
      isShardOverflowTrustedEvent({ eventName: "pull_request", headRepository: "fork/repo", repository: REPOSITORY })
    ).toBe(false);
  });

  it("counts queued hosted jobs and the overflow pool's load", () => {
    const queue = shardOverflowQueueOf({
      jobs: [
        ShardOverflowJob.make({ status: "queued", labels: ["ubuntu-24.04"] }),
        ShardOverflowJob.make({ status: "queued", labels: ["windows-latest"] }),
        ShardOverflowJob.make({ status: "in_progress", labels: ["ubuntu-24.04"] }),
        ShardOverflowJob.make({ status: "completed", labels: ["ubuntu-24.04"] }),
        ShardOverflowJob.make({ status: "queued", labels: ["beep-ec2-heavy"] }),
        ShardOverflowJob.make({ status: "queued", labels: [SHARD_OVERFLOW_RUNNER_LABEL] }),
        ShardOverflowJob.make({ status: "in_progress", labels: [SHARD_OVERFLOW_RUNNER_LABEL] }),
        ShardOverflowJob.make({ status: "completed", labels: [SHARD_OVERFLOW_RUNNER_LABEL] }),
        ShardOverflowJob.make({ status: "waiting", labels: [] }),
      ],
      runsRead: 3,
    });
    expect(queue.queuedHostedJobs).toBe(2);
    expect(queue.overflowJobs).toBe(2);
    expect(queue.runsRead).toBe(3);
  });

  it("summarises a decision with and without a queue reading", () => {
    expect(
      renderShardOverflowSummary(
        ShardOverflowDecision.make({
          reason: "routed",
          hosted: ["unit-a"],
          overflow: ["repo-cli-1"],
          predictedWaitSeconds: O.some(660),
          freeVms: O.some(1),
        })
      )
    ).toBe(
      "shard-overflow: routed; 1 of 2 Test Unit partitions to beep-shard-overflow (predicted hosted wait 11m00s; 1 overflow VMs free)"
    );
    expect(
      renderShardOverflowSummary(ShardOverflowDecision.make({ reason: "disabled", hosted: ["unit-a"], overflow: [] }))
    ).toBe("shard-overflow: disabled; 0 of 1 Test Unit partitions to beep-shard-overflow");
  });
});

// The gh calls the command spawns, answered from a table keyed by the call's endpoint.
type GhAnswer = { readonly stdout: string } | { readonly exit: number };
const ghScript =
  (answers: Readonly<Record<string, GhAnswer>>) =>
  (command: string, args: ReadonlyArray<string>): { stdout?: string; exit?: number; stderr?: string } => {
    if (command !== "gh") return { exit: 127, stderr: `unexpected ${command}` };
    const endpoint = O.getOrElse(
      A.findFirst(args, (arg) => Str.startsWith("repos/")(arg)),
      () => ""
    );
    const status = O.getOrElse(
      A.findFirst(args, (arg) => Str.startsWith("status=")(arg)),
      () => ""
    );
    const key = Str.isNonEmpty(status) ? `${endpoint}?${status}` : endpoint;
    return O.getOrElse(R.get(answers, key), () => ({ exit: 1, stderr: `unscripted ${key}` }));
  };
const runsAnswer = (ids: ReadonlyArray<number>): GhAnswer => ({ stdout: A.join(A.map(ids, String), "\n") });
const jobsAnswer = (jobs: ReadonlyArray<readonly [string, string]>): GhAnswer => ({
  stdout: A.join(
    A.map(jobs, ([status, label]) => `{"status":"${status}","labels":["${label}"]}`),
    "\n"
  ),
});
const queuedHosted = (count: number) => A.replicate(["queued", "ubuntu-24.04"] as const, count);

const environment = (values: Readonly<Record<string, string>>) =>
  Effect.provideService(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromUnknown({
      BEEP_SHARD_OVERFLOW: "on",
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_REF: "refs/pull/7/merge",
      GITHUB_REPOSITORY: REPOSITORY,
      BEEP_CI_HEAD_REPOSITORY: REPOSITORY,
      ...values,
    })
  );

it.layer(NodeServices.layer, { timeout: "30 seconds" })("ci shard-overflow", (it) => {
  it.effect("reads the queue, routes into the free VMs and appends the split to GITHUB_OUTPUT", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* fs.makeTempDirectoryScoped();
      const output = path.join(directory, "github-output");
      const spawner = ScriptedSpawner.make(
        ghScript({
          "repos/{owner}/{repo}/actions/runs?status=in_progress": runsAnswer([11, 12]),
          "repos/{owner}/{repo}/actions/runs?status=queued": runsAnswer([12, 13]),
          "repos/{owner}/{repo}/actions/runs/11/jobs": jobsAnswer([
            ...queuedHosted(70),
            ["in_progress", "beep-shard-overflow"],
          ]),
          "repos/{owner}/{repo}/actions/runs/12/jobs": jobsAnswer(queuedHosted(50)),
          "repos/{owner}/{repo}/actions/runs/13/jobs": jobsAnswer(
            A.replicate(["queued", "beep-shard-overflow"] as const, 45)
          ),
        })
      );
      const decision = yield* runShardOverflow({
        partitions: '["repo-cli-1","repo-cli-2","unit-a"]',
        callee: "pinned",
      }).pipe(provideSpawner(spawner), environment({ GITHUB_OUTPUT: output, BEEP_SHARD_OVERFLOW_POOL_SIZE: "48" }));
      expect(decision.reason).toBe("routed");
      expect(decision.overflow).toStrictEqual(["repo-cli-1", "repo-cli-2"]);
      expect(decision.hosted).toStrictEqual(["unit-a"]);
      const written = yield* fs.readFileString(output);
      expect(written).toBe(
        'test_unit_hosted=["unit-a"]\ntest_unit_overflow=["repo-cli-1","repo-cli-2"]\nshard_overflow_reason=routed\n'
      );
      // Two run listings and one jobs listing per distinct run.
      expect(A.length(spawner.spawns)).toBe(5);
    })
  );

  it.effect("makes no API call when a cheaper gate refuses", () =>
    Effect.gen(function* () {
      for (const values of [
        { BEEP_SHARD_OVERFLOW: "" },
        { BEEP_SHARD_OVERFLOW: "off" },
        { BEEP_CI_HEAD_REPOSITORY: "someone/beep-effect" },
        { BEEP_SHARD_OVERFLOW_WAIT_SECONDS: "ten minutes" },
        { BEEP_SHARD_OVERFLOW_POOL_SIZE: "0" },
        { BEEP_SHARD_OVERFLOW_POOL_SIZE: "-3" },
      ]) {
        const spawner = ScriptedSpawner.make(ghScript({}));
        const decision = yield* runShardOverflow({ partitions: '["unit-a"]', callee: "pinned" }).pipe(
          provideSpawner(spawner),
          environment(values)
        );
        expect(decision.overflow).toStrictEqual([]);
        expect(spawner.spawns).toStrictEqual([]);
      }
      const local = yield* runShardOverflow({ partitions: '["unit-a"]', callee: "local" }).pipe(
        provideSpawner(ScriptedSpawner.make(ghScript({}))),
        environment({})
      );
      expect(local.reason).toBe("callee-not-pinned");
    })
  );

  it.effect("stays hosted when the queue cannot be read", () =>
    Effect.gen(function* () {
      const failing = [
        ghScript({}),
        ghScript({
          "repos/{owner}/{repo}/actions/runs?status=in_progress": { stdout: "not-a-run-id" },
          "repos/{owner}/{repo}/actions/runs?status=queued": runsAnswer([]),
        }),
        ghScript({
          "repos/{owner}/{repo}/actions/runs?status=in_progress": runsAnswer([11]),
          "repos/{owner}/{repo}/actions/runs?status=queued": runsAnswer([]),
          "repos/{owner}/{repo}/actions/runs/11/jobs": { stdout: "{broken" },
        }),
      ];
      for (const script of failing) {
        const decision = yield* runShardOverflow({ partitions: '["unit-a"]', callee: "pinned" }).pipe(
          provideSpawner(ScriptedSpawner.make(script)),
          environment({})
        );
        expect(decision.reason).toBe("queue-unreadable");
        expect(decision.hosted).toStrictEqual(["unit-a"]);
      }
    })
  );

  it.effect("reads at most the newest runs and reports a short queue as below the limit", () =>
    Effect.gen(function* () {
      const ids = A.makeBy(SHARD_OVERFLOW_MAX_RUNS_READ + 5, (index) => 100 + index);
      const answers = R.fromEntries([
        ["repos/{owner}/{repo}/actions/runs?status=in_progress", runsAnswer(ids)] as const,
        ["repos/{owner}/{repo}/actions/runs?status=queued", runsAnswer([])] as const,
        ...A.map(
          ids,
          (id) => [`repos/{owner}/{repo}/actions/runs/${id}/jobs`, jobsAnswer([["queued", "ubuntu-24.04"]])] as const
        ),
      ]);
      const spawner = ScriptedSpawner.make(ghScript(answers));
      const decision = yield* runShardOverflow({ partitions: '["unit-a"]', callee: "pinned" }).pipe(
        provideSpawner(spawner),
        environment({ BEEP_SHARD_OVERFLOW_WAIT_SECONDS: "" })
      );
      expect(decision.reason).toBe("below-limit");
      assertSome(decision.predictedWaitSeconds, SHARD_OVERFLOW_MAX_RUNS_READ * 5.5);
      expect(A.length(spawner.spawns)).toBe(2 + SHARD_OVERFLOW_MAX_RUNS_READ);
    })
  );

  it.effect("fails on a plan that is not a list of unique partition ids", () =>
    Effect.gen(function* () {
      for (const partitions of ["", "null", '"unit-a"', '[""]', '["unit-a","unit-a"]']) {
        const error = yield* Effect.flip(
          runShardOverflow({ partitions, callee: "pinned" }).pipe(
            provideSpawner(ScriptedSpawner.make(ghScript({}))),
            environment({})
          )
        );
        assertInstanceOf(error, CiCommandError);
      }
    })
  );

  it.effect("reports an output file it cannot append to", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped();
      const error = yield* Effect.flip(
        runShardOverflow({ partitions: '["unit-a"]', callee: "pinned" }).pipe(
          provideSpawner(ScriptedSpawner.make(ghScript({}))),
          environment({ BEEP_SHARD_OVERFLOW: "", GITHUB_OUTPUT: directory })
        )
      );
      assertInstanceOf(error, CiCommandError);
    })
  );

  it.effect("renders the outputs check.yml reads", () =>
    Effect.gen(function* () {
      const rendered = yield* renderShardOverflowOutputs(
        ShardOverflowDecision.make({ reason: "below-limit", hosted: ["unit-a"], overflow: [] })
      );
      expect(rendered).toBe('test_unit_hosted=["unit-a"]\ntest_unit_overflow=[]\nshard_overflow_reason=below-limit\n');
    })
  );

  it.effect("runs as `beep ci shard-overflow` with its two flags", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* fs.makeTempDirectoryScoped();
      const output = path.join(directory, "github-output");
      const spawner = ScriptedSpawner.make(ghScript({}));
      yield* Command.runWith(ciShardOverflowCommand, { version: "0.0.0" })([
        "--partitions",
        '["unit-a"]',
        "--callee",
        "local",
      ]).pipe(provideSpawner(spawner), environment({ GITHUB_OUTPUT: output }));
      const written = yield* fs.readFileString(output);
      expect(written).toBe(
        'test_unit_hosted=["unit-a"]\ntest_unit_overflow=[]\nshard_overflow_reason=callee-not-pinned\n'
      );
      expect(spawner.spawns).toStrictEqual([]);
    })
  );

  // ---- Workflow contracts -------------------------------------------------------------------------

  const readWorkflow = Effect.fnUntraced(function* (file: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* findRepoRoot();
    const text = yield* fs.readFileString(path.join(root, ".github/workflows", file));
    return { text, document: parseWorkflowYaml(text) };
  });
  const isText = S.is(S.String);
  const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
  const decodeJobs = S.decodeUnknownOption(S.Record(S.String, S.Unknown));
  const FORK_GUARD =
    "github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository";

  // `file:job:label` for every job whose runner is not a GitHub-hosted image.
  const jobsOf = (document: unknown): Readonly<Record<string, unknown>> =>
    O.getOrElse(decodeJobs(yamlAt(document, ["jobs"])), () => ({}));
  const selfHostedJobs = (file: string, document: unknown): ReadonlyArray<string> =>
    A.filterMap(R.toEntries(jobsOf(document)), ([id, job]) => {
      const runsOn = yamlAt(job, ["runs-on"]);
      return isText(runsOn) && !/^(?:ubuntu|windows|macos)-/u.test(runsOn)
        ? Result.succeed(`${file}:${id}:${runsOn}`)
        : Result.failVoid;
    });

  it.effect("admits the overflow label only to shard-overflow.yml and every other self-hosted label to its pool", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* findRepoRoot();
      const entries = yield* fs.readDirectory(path.join(root, ".github/workflows"));
      const files = A.filter(entries, Str.endsWith(".yml"));
      const workflows = yield* Effect.forEach(A.sort(files, Str.Order), (file) =>
        Effect.map(readWorkflow(file), ({ document }) => ({ file, document }))
      );
      const selfHosted = A.flatMap(workflows, ({ file, document }) => selfHostedJobs(file, document));
      // Every runner that is not a GitHub-hosted image, by file, job and label. A new self-hosted job
      // must be added here on purpose; check.yml reaches the overflow pool only through shard-overflow.yml.
      expect(selfHosted).toStrictEqual([
        "cache-warm.yml:warm:beep-ec2-heavy",
        "fleet-lane-probe.yml:lane-probe:${{ inputs.target_label }}",
        "fleet-shadow-check.yml:shadow-probe:beep-ec2-heavy",
        "heavy.yml:verify:beep-ec2-heavy",
        "heavy.yml:check:beep-ec2-heavy",
        "heavy.yml:docgen:beep-ec2-heavy",
        "heavy.yml:doctest:beep-ec2-heavy",
        "heavy.yml:build:beep-ec2-heavy",
        "heavy.yml:producer-inspect:beep-ec2-heavy",
        "heavy.yml:producer-prepare:beep-ec2-heavy",
        "heavy.yml:producer-execute:beep-ec2-heavy",
        "heavy.yml:local-pilot-observe:beep-ec2-heavy",
        "release-desktop.yml:release-desktop:${{ matrix.os }}",
        `shard-overflow.yml:test-unit-shard:${SHARD_OVERFLOW_RUNNER_LABEL}`,
      ]);
    })
  );

  it.effect("guards the overflow job against forks at main and in the caller", () =>
    Effect.gen(function* () {
      const { document: overflow } = yield* readWorkflow("shard-overflow.yml");
      const { document: check } = yield* readWorkflow("check.yml");
      expect(yamlAt(overflow, ["on", "workflow_call", "inputs"])).toBeDefined();
      expect(yamlAt(overflow, ["on", "pull_request"])).toBeUndefined();
      expect(yamlAt(overflow, ["on", "push"])).toBeUndefined();
      expect(yamlAt(overflow, ["jobs", "test-unit-shard", "if"])).toBe(FORK_GUARD);
      expect(yamlAt(overflow, ["jobs", "test-unit-shard", "runs-on"])).toBe(SHARD_OVERFLOW_RUNNER_LABEL);
      expect(yamlAt(overflow, ["permissions"])).toStrictEqual({ contents: "read" });
      const caller = yamlAt(check, ["jobs", "test-unit-overflow", "if"]);
      assertTrue(isText(caller));
      expect(caller).toContain(`(${FORK_GUARD})`);
      expect(yamlAt(check, ["jobs", "test-unit-overflow", "runs-on"])).toBeUndefined();
      expect(yamlAt(check, ["jobs", "test-unit-overflow", "permissions"])).toStrictEqual({ contents: "read" });
    })
  );

  it.effect("keeps the overflow shard identical to the hosted shard but for its runner", () =>
    Effect.gen(function* () {
      const { document: overflow, text: overflowText } = yield* readWorkflow("shard-overflow.yml");
      const { document: check } = yield* readWorkflow("check.yml");
      const asHosted = Str.replaceAll("inputs.partition", "matrix.partition");
      const hostedJob = ["jobs", "test-unit-shard"];
      const overflowSteps = yield* encodeJson(yamlAt(overflow, [...hostedJob, "steps"]));
      const hostedSteps = yield* encodeJson(yamlAt(check, [...hostedJob, "steps"]));
      expect(
        pipe(
          overflowSteps,
          asHosted,
          Str.replaceAll("inputs.planned_partitions", "needs.test-plan.outputs.test_unit"),
          Str.replaceAll("inputs.docs_only", "needs.change-profile.outputs.docs_only")
        )
      ).toBe(hostedSteps);
      for (const key of ["timeout-minutes", "environment", "permissions"]) {
        expect(yamlAt(overflow, [...hostedJob, key]), key).toStrictEqual(yamlAt(check, [...hostedJob, key]));
      }
      // The workflow-level coverage and pull-request pins reach the called job too.
      expect(yamlAt(overflow, ["env"])).toStrictEqual(yamlAt(check, ["env"]));
      // No secret beyond the hosted shard's: the same names, through the same push guards.
      const secretNames = (text: string) =>
        A.sort(A.dedupe(O.getOrElse(Str.match(/secrets\.[A-Z0-9_]+/gu)(text), () => A.empty<string>())), Str.Order);
      const hostedText = yield* encodeJson(yamlAt(check, hostedJob));
      expect(secretNames(overflowText)).toStrictEqual(secretNames(hostedText));
    })
  );

  it.effect("routes only while the switch is on, and only as far as the overflow call is pinned", () =>
    Effect.gen(function* () {
      const { document: check } = yield* readWorkflow("check.yml");
      const steps = yamlAt(check, ["jobs", "test-plan", "steps"]);
      assertTrue(S.is(S.Array(S.Unknown))(steps));
      const route = yield* Effect.fromOption(A.findFirst(steps, (step) => yamlAt(step, ["id"]) === "overflow"));
      expect(yamlAt(route, ["if"])).toBe("vars.BEEP_SHARD_OVERFLOW == 'on' && steps.plan.outputs.test_unit != '[]'");
      expect(yamlAt(route, ["continue-on-error"])).toBe(true);
      expect(yamlAt(route, ["env", "BEEP_SHARD_OVERFLOW"])).toBe("${{ vars.BEEP_SHARD_OVERFLOW }}");
      expect(yamlAt(check, ["jobs", "test-plan", "permissions"])).toStrictEqual({ contents: "read", actions: "read" });
      const run = yamlAt(route, ["run"]);
      assertTrue(isText(run));
      const callee = O.getOrElse(
        O.flatMap(O.fromNullishOr(/--callee (local|pinned)/u.exec(run)), (match) => O.fromUndefinedOr(match[1])),
        () => ""
      );
      // A local call resolves to main only on a push, so the command may route pushes only; the cutover
      // to the pinned reference changes both lines together.
      const expectedUses =
        callee === "pinned"
          ? "beep-effect/beep-effect/.github/workflows/shard-overflow.yml@main"
          : "./.github/workflows/shard-overflow.yml";
      expect(["local", "pinned"]).toContain(callee);
      expect(yamlAt(check, ["jobs", "test-unit-overflow", "uses"])).toBe(expectedUses);
      expect(yamlAt(check, ["jobs", "test-unit-overflow", "secrets"])).toBe("inherit");
    })
  );
});
