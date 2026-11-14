// The MEAS-05 cost ledger (goals/certainty-scorecard, PLAN slice 15). `fixtures/ci-cost-ledger/reference-runs.json`
// is a minimal capture of three Check runs read on 2026-11-14 (steps and runner names dropped): 43604442987, a
// push to main that allocated every partition; 43585338714, a documentation-only pull request; and 43605277972,
// a pull request whose Test Plan allocated the catch-all `int-rest` partition with no selected task.

import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  CiLedgerCapture,
  CiLedgerLanePlan,
  CiLedgerPartitionProof,
  CiLedgerReport,
  CiLedgerRun,
  CiLedgerTestPlan,
  CiWorkflowJob,
  CiWorkflowPartialRead,
  CiWorkflowWindowRun,
  ciLedgerCommand,
  decodeCiLedgerCapture,
  foldCiLedger,
  foldCiLedgerRun,
  parseCiLedgerPartitionProofs,
  parseCiLedgerTestPlan,
  renderCiLedgerMarkdown,
} from "@beep/repo-cli/commands/Ci";
import { GithubTransportFetch } from "@beep/repo-cli/test/SharedInternals";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Str from "effect/String";
import * as Terminal from "effect/Terminal";
import * as TestConsole from "effect/testing/TestConsole";
import referenceRuns from "./fixtures/ci-cost-ledger/reference-runs.json" with { type: "json" };
import { githubFetch, reply } from "./support/GithubFetch.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import type { CiLedgerRunRow } from "@beep/repo-cli/commands/Ci";
import type { GithubFetchCall } from "./support/GithubFetch.ts";

const FULL_MATRIX = 43604442987;
const DOCS_ONLY = 43585338714;
const EMPTY_PARTITION = 43605277972;

const decodeCapture = S.decodeUnknownEffect(CiLedgerCapture);
const referenceLedger = decodeCapture(referenceRuns).pipe(Effect.orDie, Effect.map(foldCiLedger));

const runRow = (report: CiLedgerReport, runId: number): CiLedgerRunRow =>
  O.getOrThrow(A.findFirst(report.runs, (row) => row.runId === runId));

const rowsMs = (row: CiLedgerRunRow): number => Num.sumAll(A.map(row.rows, (entry) => entry.ms));

const T0 = "2026-11-14T10:00:00Z";
const at = (seconds: number): string => DateTime.formatIso(DateTime.add(DateTime.makeUnsafe(T0), { seconds }));

const job = (
  id: number,
  name: string,
  startSeconds: number,
  endSeconds: number,
  overrides: Partial<{
    readonly attempt: number;
    readonly conclusion: string;
    readonly labels: ReadonlyArray<string>;
  }> = {}
): CiWorkflowJob =>
  CiWorkflowJob.make({
    completed_at: at(endSeconds),
    conclusion: overrides.conclusion ?? "success",
    created_at: at(startSeconds),
    id,
    labels: overrides.labels ?? ["ubuntu-24.04"],
    name,
    run_attempt: overrides.attempt ?? 1,
    run_id: 7,
    started_at: at(startSeconds),
    status: "completed",
  });

const windowRun = (id: number, attempt = 1): CiWorkflowWindowRun =>
  CiWorkflowWindowRun.make({
    created_at: DateTime.makeUnsafe(T0),
    event: "pull_request",
    head_sha: "0f0e0d0c0b0a09080706050403020100ffeeddcc",
    id,
    run_attempt: attempt,
  });

const lanePlan = (
  lane: "test-unit" | "test-integration",
  partitions: ReadonlyArray<string>,
  selectedTasks: O.Option<number>
): CiLedgerLanePlan => CiLedgerLanePlan.make({ lane, partitions, selectedTasks, laneTasks: O.some(24) });

describe("ci ledger reference runs", () => {
  it.effect("maps at least 95% of job-minutes on each reference run and conserves every minute", () =>
    Effect.gen(function* () {
      const report = yield* referenceLedger;
      deepStrictEqual(
        A.map(report.runs, (row) => [row.runId, row.jobs, row.totalMs, row.laneMs, row.supportMs, row.unknownMs]),
        [
          [FULL_MATRIX, 82, 18_423_000, 18_313_000, 110_000, 0],
          [DOCS_ONLY, 36, 427_000, 334_000, 93_000, 0],
          [EMPTY_PARTITION, 63, 12_223_000, 12_002_000, 221_000, 0],
        ]
      );
      for (const row of report.runs) {
        assertTrue(O.exists(row.mappedShare, Num.isGreaterThanOrEqualTo(0.95)));
        strictEqual(row.laneMs + row.supportMs + row.unknownMs, row.totalMs);
        // Each lane job is in exactly one row: the rows sum to the lane minutes.
        strictEqual(rowsMs(row), row.laneMs);
        strictEqual(row.rerunCopies, 0);
        strictEqual(row.wrapperJobs, 0);
      }
      // The lane share alone: a documentation-only run is mostly its support jobs.
      deepStrictEqual(
        A.map(report.runs, (row) => O.map(row.laneShare, (share) => Num.round(share, 4))),
        [O.some(0.994), O.some(0.7822), O.some(0.9819)]
      );
    })
  );

  it.effect("keeps each partition job in its own row and a skipped umbrella out of every row", () =>
    Effect.gen(function* () {
      const report = yield* referenceLedger;
      const full = runRow(report, FULL_MATRIX);
      const integration = A.filter(full.rows, (row) => row.lane === "test-integration");
      // The aggregates (`Heavy / Test Integration`, `Test Unit`, `Property Laws`, `Lint`) skip on success.
      deepStrictEqual(
        A.map(integration, (row) => `${row.grain}:${row.jobs}`),
        A.replicate("partition:1", 20)
      );
      strictEqual(full.skippedJobs, 11);
    })
  );

  it.effect("computes the empty-leg runner-minutes row on every reference run", () =>
    Effect.gen(function* () {
      const report = yield* referenceLedger;
      deepStrictEqual(
        A.map(report.runs, (row) => [row.runId, row.emptyLegMs, row.emptyLegs, row.undeterminedLegs]),
        [
          [FULL_MATRIX, O.some(0), 0, 0],
          [DOCS_ONLY, O.some(0), 0, 0],
          [EMPTY_PARTITION, O.some(118_000), 1, 0],
        ]
      );
      const empty = A.filter(runRow(report, EMPTY_PARTITION).rows, (row) => O.contains(row.legTasks, "empty"));
      deepStrictEqual(
        A.map(empty, (row) => [row.lane, row.partition, row.ms]),
        [["test-integration", O.some("int-rest"), 118_000]]
      );
      deepStrictEqual(
        A.map(report.sources, (row) => [row.source, row.status, row.runs]),
        [
          ["hosted-jobs", "present", 3],
          ["test-plan", "present", 3],
          ["turbo-tasks", "absent", 0],
          ["final-check", "absent", 0],
          ["economics", "absent", 0],
          ["psi", "absent", 0],
        ]
      );
      // Hosted rows carry no digest of either side; the two are never compared.
      assertTrue(
        A.every(report.runs, (row) =>
          A.every(row.rows, (entry) => O.isNone(entry.hostedDigest) && O.isNone(entry.localDigest))
        )
      );
    })
  );
});

describe("ci ledger fold", () => {
  it("adds the umbrella beside its partitions, measures a wrapper apart and drops rerun copies", () => {
    const row = foldCiLedgerRun(
      CiLedgerRun.make({
        jobs: [
          job(1, "Test Integration (lps-int-1)", 0, 300),
          job(2, "Test Integration (int-rest)", 0, 120),
          job(3, "Heavy / Test Integration", 300, 310),
          // Attempt 2 lists the partition it did not re-execute again, with attempt 1's timestamps.
          job(4, "Test Integration (lps-int-1)", 0, 300, { attempt: 2 }),
          // A caller with no runner, spanning the job it called on the overflow pool.
          job(5, "Test Unit (unit-a)", 0, 400, { labels: [] }),
          job(6, "Test Unit (unit-a) / Overflow", 20, 380, { labels: ["beep-shard-overflow"] }),
          job(7, "Test Plan", 0, 60),
          job(8, "Knip", 0, 30),
          job(9, "Lint", 0, 0, { conclusion: "skipped" }),
          CiWorkflowJob.make({ ...job(10, "Security", 0, 0), completed_at: null, started_at: null }),
        ],
        partitionProofs: [
          CiLedgerPartitionProof.make({
            lane: "test-integration",
            partition: "int-rest",
            partitionTasks: 3,
            selectedTasks: 4,
          }),
        ],
        run: windowRun(7, 2),
        testPlan: O.some(
          CiLedgerTestPlan.make({
            lanes: [
              lanePlan("test-integration", ["lps-int-1", "int-rest"], O.some(4)),
              lanePlan("test-unit", ["unit-a"], O.some(30)),
            ],
          })
        ),
      })
    );
    strictEqual(row.rerunCopies, 1);
    strictEqual(row.skippedJobs, 1);
    deepStrictEqual([row.wrapperJobs, row.wrapperMs], [1, 400_000]);
    deepStrictEqual([row.laneMs, row.supportMs, row.unknownMs], [(300 + 120 + 10 + 360) * 1000, 60_000, 30_000]);
    strictEqual(row.totalMs, row.laneMs + row.supportMs + row.unknownMs);
    deepStrictEqual(row.unknownNames, ["Knip"]);
    deepStrictEqual(
      A.map(
        row.rows,
        (entry) =>
          `${entry.lane} ${entry.grain} ${O.getOrElse(entry.partition, () => "-")} ${entry.ms} ${O.getOrElse(entry.legTasks, () => "-")}`
      ),
      [
        "security lane - 0 -",
        "test-integration lane - 10000 -",
        "test-integration partition int-rest 120000 selected",
        "test-integration partition lps-int-1 300000 selected",
        "test-unit partition unit-a 360000 selected",
      ]
    );
    assertSome(row.emptyLegMs, 0);
    strictEqual(row.testPlan, "present");
  });

  it("judges each leg by its own line, then by the plan, else undetermined", () => {
    const legs = (run: CiLedgerRun) =>
      A.map(foldCiLedgerRun(run).rows, (entry) => [O.getOrNull(entry.partition), O.getOrNull(entry.legTasks)]);
    const jobs = [
      job(1, "Test Integration (lps-int-2)", 0, 60),
      job(2, "Test Integration (int-rest)", 0, 60),
      job(3, "Test Unit (unit-b)", 0, 60),
    ];
    // The integration plan selected no task: every leg it allocated is empty, the catch-all included.
    const noneSelected = CiLedgerRun.make({
      jobs,
      run: windowRun(8),
      testPlan: O.some(
        CiLedgerTestPlan.make({
          lanes: [
            lanePlan("test-integration", ["lps-int-2", "int-rest"], O.some(0)),
            lanePlan("test-unit", [], O.none()),
          ],
        })
      ),
    });
    deepStrictEqual(legs(noneSelected), [
      ["int-rest", "empty"],
      ["lps-int-2", "empty"],
      ["unit-b", "undetermined"],
    ]);
    assertNone(foldCiLedgerRun(noneSelected).emptyLegMs);
    // Tasks selected, no catch-all line read: the catch-all cannot be judged from the plan.
    deepStrictEqual(
      legs(
        CiLedgerRun.make({
          jobs,
          partitionProofs: [
            CiLedgerPartitionProof.make({
              lane: "test-unit",
              partition: "unit-b",
              partitionTasks: 0,
              selectedTasks: 9,
            }),
          ],
          run: windowRun(9),
          testPlan: O.some(
            CiLedgerTestPlan.make({ lanes: [lanePlan("test-integration", ["lps-int-2", "int-rest"], O.none())] })
          ),
        })
      ),
      [
        ["int-rest", "undetermined"],
        ["lps-int-2", "selected"],
        ["unit-b", "empty"],
      ]
    );
    // No Test Plan output: nothing is judged.
    const unplanned = foldCiLedgerRun(CiLedgerRun.make({ jobs, run: windowRun(10) }));
    strictEqual(unplanned.testPlan, "absent");
    strictEqual(unplanned.undeterminedLegs, 3);
  });

  it("reports a run with no timed job without a share, and source rows by how many runs were read", () => {
    const empty = CiLedgerRun.make({ jobs: [], run: windowRun(11) });
    const partial = CiLedgerRun.make({
      jobs: [],
      partialReads: [CiWorkflowPartialRead.make({ attempt: 1, message: "HTTP 502", runId: 12 })],
      run: windowRun(12),
      testPlan: O.some(CiLedgerTestPlan.make({ lanes: [] })),
    });
    const report = foldCiLedger(
      CiLedgerCapture.make({
        capturedAt: DateTime.makeUnsafe(T0),
        runs: [empty, partial],
        schemaVersion: "ci-ledger-capture/v1",
      })
    );
    assertNone(runRow(report, 11).mappedShare);
    assertNone(runRow(report, 11).laneShare);
    assertTrue(runRow(report, 12).partial);
    deepStrictEqual(
      A.map(A.take(report.sources, 2), (row) => [row.source, row.status]),
      [
        ["hosted-jobs", "partial"],
        ["test-plan", "partial"],
      ]
    );
    const none = foldCiLedger(
      CiLedgerCapture.make({ capturedAt: DateTime.makeUnsafe(T0), runs: [], schemaVersion: "ci-ledger-capture/v1" })
    );
    assertTrue(A.every(none.sources, (row) => row.status === "absent"));
  });
});

describe("ci ledger log lines", () => {
  it("reads a pull-request plan with its step counts and a push plan without them", () => {
    const pullRequest = A.join(
      [
        "2026-11-14T14:32:20.1Z [ci] test-unit plan: 1 partition(s) for 3 selected task(s) of 201: unit-a",
        "2026-11-14T14:32:20.2Z [ci] test-integration plan: 1 partition(s) for 0 selected task(s) of 24: int-rest",
        "2026-11-14T14:32:21.0Z test_unit: 1 of 24 partitions: unit-a",
        "2026-11-14T14:32:21.1Z test_integration: 1 of 20 partitions: int-rest",
      ],
      "\n"
    );
    assertSome(
      parseCiLedgerTestPlan(pullRequest),
      CiLedgerTestPlan.make({
        lanes: [
          CiLedgerLanePlan.make({
            lane: "test-unit",
            laneTasks: O.some(201),
            partitions: ["unit-a"],
            selectedTasks: O.some(3),
          }),
          CiLedgerLanePlan.make({
            lane: "test-integration",
            laneTasks: O.some(24),
            partitions: ["int-rest"],
            selectedTasks: O.some(0),
          }),
        ],
      })
    );
    assertSome(
      parseCiLedgerTestPlan("2026-11-14T14:22:00Z test_unit: 0 of 24 partitions: "),
      CiLedgerTestPlan.make({ lanes: [CiLedgerLanePlan.make({ lane: "test-unit", partitions: [] })] })
    );
    assertNone(parseCiLedgerTestPlan('echo "${name}: $(jq --raw-output length) of partitions"'));
  });

  it("reads a partition's selection line", () => {
    deepStrictEqual(
      parseCiLedgerPartitionProofs(
        "x\n2026-11-14T14:35:00Z [ci] test-integration partition union proved: 24 executable tasks, 0 selected, 0 in int-rest.\n"
      ),
      [
        CiLedgerPartitionProof.make({
          lane: "test-integration",
          partition: "int-rest",
          partitionTasks: 0,
          selectedTasks: 0,
        }),
      ]
    );
  });
});

describe("ci ledger markdown", () => {
  it.effect("renders the source table and one census line per run", () =>
    Effect.gen(function* () {
      const report = yield* referenceLedger;
      const markdown = renderCiLedgerMarkdown(report);
      expect(markdown).toContain("| turbo-tasks | absent | 0 |");
      expect(markdown).toContain(
        "| 43605277972 | pull_request | 1 | 63 | 203.7 | 200 | 3.7 | 0 | 100% | 98.19% | 2 | |"
      );
    })
  );

  it("marks a partial read, an undetermined leg, a run with no time and its unknown jobs", () => {
    const markdown = renderCiLedgerMarkdown(
      foldCiLedger(
        CiLedgerCapture.make({
          capturedAt: DateTime.makeUnsafe(T0),
          runs: [
            CiLedgerRun.make({
              jobs: [job(1, "Test Integration (int-rest)", 0, 60), job(2, "Knip", 0, 30)],
              partialReads: [CiWorkflowPartialRead.make({ attempt: 1, message: "HTTP 502", runId: 13 })],
              run: windowRun(13),
            }),
            CiLedgerRun.make({ jobs: [], run: windowRun(14) }),
          ],
          schemaVersion: "ci-ledger-capture/v1",
        })
      )
    );
    expect(markdown).toContain(
      "| 13 | pull_request | 1 | 2 | 1.5 | 1 | 0 | 0.5 | 66.67% | 66.67% | undetermined (1 legs) | partial |"
    );
    expect(markdown).toContain("| 14 | pull_request | 1 | 0 | 0 | 0 | 0 | 0 | n/a | n/a | 0 | |");
    expect(markdown).toContain("- run 13 unknown jobs: Knip");
  });
});

// ---------------------------------------------------------------------------------------------
// The command, replayed and live against a fake GitHub
// ---------------------------------------------------------------------------------------------

const LIVE_RUN = 501;
const LIVE_RUN_WITHOUT_PLAN = 502;

const restJob = (id: number, runId: number, name: string, seconds: number, attempt = 1) => ({
  completed_at: at(seconds),
  conclusion: "success",
  created_at: T0,
  id,
  labels: ["ubuntu-24.04"],
  name,
  run_attempt: attempt,
  run_id: runId,
  started_at: attempt === 1 ? T0 : at(600),
  status: "completed",
  steps: [],
});

const restRun = (id: number) => ({
  created_at: T0,
  event: "pull_request",
  head_sha: "0f0e0d0c0b0a09080706050403020100ffeeddcc",
  id,
  run_attempt: id === LIVE_RUN ? 2 : 1,
});

// Run 501 was re-run once: attempt 2 re-executed Test Plan (job 5) and lists the other jobs again as copies.
const JOBS: Readonly<Record<string, ReadonlyArray<ReturnType<typeof restJob>>>> = {
  [`${LIVE_RUN}/1`]: [
    restJob(1, LIVE_RUN, "Test Plan", 60),
    restJob(2, LIVE_RUN, "Test Integration (int-rest)", 120),
    restJob(3, LIVE_RUN, "Lint", 90),
  ],
  [`${LIVE_RUN}/2`]: [
    restJob(5, LIVE_RUN, "Test Plan", 660, 2),
    { ...restJob(6, LIVE_RUN, "Test Integration (int-rest)", 120), run_attempt: 2 },
    { ...restJob(7, LIVE_RUN, "Lint", 90), run_attempt: 2 },
  ],
  [`${LIVE_RUN_WITHOUT_PLAN}/1`]: [restJob(4, LIVE_RUN_WITHOUT_PLAN, "Test Integration (int-rest)", 120)],
};

const LOGS: Readonly<Record<string, string>> = {
  "5": "2026-11-14T10:10:30Z [ci] test-integration plan: 1 partition(s) for 0 selected task(s) of 24: int-rest\n2026-11-14T10:00:31Z test_integration: 1 of 20 partitions: int-rest\n",
  "2": "2026-11-14T10:01:00Z [ci] test-integration partition union proved: 24 executable tasks, 0 selected, 0 in int-rest.\n",
};

const liveGithub = (call: GithubFetchCall): unknown => {
  const path = call.url.pathname;
  const runMatch = Str.match(/\/actions\/runs\/(\d+)$/)(path);
  const jobsMatch = Str.match(/\/actions\/runs\/(\d+)\/attempts\/(\d+)\/jobs$/)(path);
  const logMatch = Str.match(/\/actions\/jobs\/(\d+)\/logs$/)(path);
  if (O.isSome(runMatch)) {
    return restRun(Number(runMatch.value[1]));
  }
  if (O.isSome(jobsMatch)) {
    const jobs = JOBS[`${jobsMatch.value[1]}/${jobsMatch.value[2]}`] ?? [];
    return { jobs, total_count: jobs.length };
  }
  return O.match(
    O.flatMap(logMatch, (groups) => O.fromUndefinedOr(LOGS[groups[1] ?? ""])),
    { onNone: () => reply(404)({ message: "Not Found" }), onSome: (log) => log }
  );
};

const withLiveGithub =
  (calls: Array<GithubFetchCall>) =>
  <A, E, R>(program: Effect.Effect<A, E, R>) =>
    program.pipe(
      Effect.provideService(
        GithubTransportFetch,
        O.some(
          githubFetch((call) => {
            calls.push(call);
            return liveGithub(call);
          }).fetch
        )
      ),
      provideSpawner(
        ScriptedSpawner.make((command, args) =>
          A.join([command, ...args], " ") === "gh auth token"
            ? { stdout: "ghs_fixture\n" }
            : { exit: 1, stderr: "the ledger spawns only gh auth token" }
        )
      ),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({ GH_REPO: "beep-effect/beep-effect" })
      )
    );

const CommandLayer = Layer.mergeAll(
  MemoryFileSystem.layer,
  Path.layer,
  Stdio.layerTest({ stdinIsTerminal: Effect.succeed(false), stdoutIsTerminal: Effect.succeed(false) }),
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(80),
      rows: Effect.succeed(24),
      size: Effect.die("unused"),
      readInput: Effect.die("unused"),
      readLine: Effect.die("unused"),
      display: () => Effect.void,
    })
  ),
  TestConsole.layer
);

const decodeReportJson = S.decodeUnknownEffect(S.fromJsonString(CiLedgerReport));
const encodeReferenceRuns = S.encodeUnknownEffect(S.fromJsonString(S.Unknown))(referenceRuns);
const refusingSpawner = provideSpawner(ScriptedSpawner.make(() => ({ exit: 1, stderr: "a replay spawns nothing" })));

const runLedgerCommand = Command.runWith(ciLedgerCommand, { version: "0.0.0" });

const lastLog = Effect.gen(function* () {
  const lines = yield* TestConsole.logLines;
  return O.getOrElse(A.last(A.filter(lines, P.isString)), () => "");
});

describe("ci ledger command", () => {
  it.layer(CommandLayer, { timeout: "30 seconds" })((it) => {
    it.effect("replays a capture file as Markdown and as JSON", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* encodeReferenceRuns.pipe(Effect.flatMap((text) => fs.writeFileString("/capture.json", text)));
        yield* runLedgerCommand(["--capture", "/capture.json"]);
        const markdown = yield* lastLog;
        expect(markdown).toContain("| 43604442987 | push | 1 | 82 | 307.1 |");
        yield* runLedgerCommand(["--capture", "/capture.json", "--json"]);
        const json = yield* lastLog;
        const report = yield* decodeReportJson(json);
        strictEqual(report.runs.length, 3);
      }).pipe(refusingSpawner)
    );

    it.effect("refuses --capture with --run, and a call with neither", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* encodeReferenceRuns.pipe(Effect.flatMap((text) => fs.writeFileString("/capture.json", text)));
        const combined = yield* runLedgerCommand(["--capture", "/capture.json", "--run", "1"]).pipe(Effect.flip);
        expect(combined).toMatchObject({ message: expect.stringContaining("cannot be combined with --run") });
        const neither = yield* runLedgerCommand([]).pipe(Effect.flip);
        expect(neither).toMatchObject({ message: expect.stringContaining("Pass at least one --run <id>") });
      }).pipe(withLiveGithub(A.empty()))
    );

    it.effect("captures runs live, joins the Test Plan and catch-all logs, and writes the capture", () => {
      const calls = A.empty<GithubFetchCall>();
      return Effect.gen(function* () {
        yield* runLedgerCommand([
          "--run",
          `${LIVE_RUN}`,
          "--run",
          `${LIVE_RUN_WITHOUT_PLAN}`,
          "--write-capture",
          "/live.json",
        ]);
        const fs = yield* FileSystem.FileSystem;
        const capture = yield* fs.readFileString("/live.json").pipe(Effect.flatMap(decodeCiLedgerCapture));
        const [planned, unplanned] = capture.runs;
        assertSome(
          O.map(O.fromUndefinedOr(planned), (run) => run.partitionProofs.length),
          1
        );
        assertTrue(O.exists(O.fromUndefinedOr(planned), (run) => O.isSome(run.testPlan)));
        // No Test Plan job, and the catch-all log is not served: both joins stay absent.
        assertTrue(
          O.exists(
            O.fromUndefinedOr(unplanned),
            (run) => O.isNone(run.testPlan) && A.isReadonlyArrayEmpty(run.partitionProofs)
          )
        );
        const report = foldCiLedger(capture);
        assertSome(runRow(report, LIVE_RUN).emptyLegMs, 120_000);
        strictEqual(runRow(report, LIVE_RUN).rerunCopies, 2);
        strictEqual(runRow(report, LIVE_RUN_WITHOUT_PLAN).undeterminedLegs, 1);
        const markdown = yield* lastLog;
        expect(markdown).toContain("| test-plan | partial | 1 |");
        // The re-executed Test Plan is read, not the attempt it replaced.
        const paths = A.map(calls, (call) => call.url.pathname);
        expect(paths).toContain("/repos/beep-effect/beep-effect/actions/jobs/5/logs");
        expect(paths).not.toContain("/repos/beep-effect/beep-effect/actions/jobs/1/logs");
      }).pipe(withLiveGithub(calls));
    });
  });
});
