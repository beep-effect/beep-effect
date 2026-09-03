import {
  attemptOnePickupSeconds,
  buildCiLaneTimingWindowReport,
  CiLaneTimingGithubClient,
  CiLaneTimingWindowOptions,
  CiWorkflowJob,
  CiWorkflowWindowRun,
  CiWorkflowWindowRunJobs,
  ciLaneTimingRow,
  ciLaneTimingsReport,
  ciRunnerClassForLabels,
  ciTimestampSpanSeconds,
  collectCiLaneTimings,
  collectCiLaneTimingWindow,
  decodeCiWorkflowJobsPage,
  renderCiLaneTimingsSummary,
  renderCiLaneTimingsTsv,
  renderCiLaneTimingWindowMarkdown,
  renderCiLaneTimingWindowTsv,
  withCiLanePeakRss,
} from "@beep/repo-cli/commands/Ci";
import { provideScopedLayer } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect, Exit, Layer, Sink, Stream } from "effect";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import type { CiLaneTimingWindowReport } from "@beep/repo-cli/commands/Ci";

// The Actions jobs endpoint returns snake_case wire fields; these fixtures keep
// them so the derivations are exercised on the shape they actually receive.
const job = (overrides: Partial<CiWorkflowJob> = {}) =>
  CiWorkflowJob.make({
    completed_at: "2026-08-06T12:10:00Z",
    conclusion: "success",
    created_at: "2026-08-06T12:00:00Z",
    id: 991,
    labels: ["self-hosted", "linux"],
    name: "Test Unit",
    run_attempt: 1,
    run_id: 42,
    runner_name: "beep-ec2-heavy-01",
    started_at: "2026-08-06T12:00:30Z",
    status: "completed",
    steps: [
      {
        completed_at: "2026-08-06T12:00:35Z",
        conclusion: "success",
        name: "Set up job",
        started_at: "2026-08-06T12:00:30Z",
      },
      {
        completed_at: "2026-08-06T12:01:35Z",
        conclusion: "success",
        name: "Bun install",
        started_at: "2026-08-06T12:00:35Z",
      },
    ],
    ...overrides,
  });

const encoder = new TextEncoder();

const stubHandle = (output: string) =>
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

const laneTimingsSpawnerLayer = Layer.effect(
  ChildProcessSpawner.ChildProcessSpawner,
  Effect.succeed(
    ChildProcessSpawner.make((command) => {
      if (!ChildProcess.isStandardCommand(command)) {
        return Effect.die("lane timings never spawns a piped command");
      }
      const rendered = A.join([command.command, ...command.args], " ");
      const output = Str.includes("actions/runs?per_page=1")(rendered)
        ? '{"workflow_runs":[{"id":42}]}'
        : Str.includes("per_page=100&page=1")(rendered)
          ? '{"jobs":[{"completed_at":"2026-08-06T12:10:00Z","conclusion":"success","created_at":"2026-08-06T12:00:00Z","id":991,"labels":["self-hosted"],"name":"Test Unit","run_attempt":1,"run_id":42,"runner_name":"runner-1","started_at":"2026-08-06T12:00:30Z","status":"completed","steps":[]}],"total_count":2}'
          : '{"jobs":[{"completed_at":"2026-08-06T12:11:00Z","conclusion":"success","created_at":"2026-08-06T12:01:00Z","id":992,"labels":["self-hosted"],"name":"Test Unit 2","run_attempt":1,"run_id":42,"runner_name":"runner-1","started_at":"2026-08-06T12:01:30Z","status":"completed","steps":[]}],"total_count":2}';
      return Effect.succeed(stubHandle(output));
    })
  )
);

const REQUIRED_CONTEXTS = [
  "Heavy / Check",
  "Codegen Drift",
  "Commitlint",
  "Heavy / Coverage Regression",
  "Heavy / Docgen",
  "Heavy / Doctest",
  "Knip",
  "Lint",
  "Heavy / Lint Policy",
  "Nix Shell",
  "Professional Desktop IPC Stdio",
  "Repo Sanity",
  "SAST",
  "Secret Scanning",
  "Security",
  "Heavy / Test Integration",
  "Test Unit",
  "JSDoc Ratchet",
];

const RULESET_18_JSON =
  '[{"ruleset_id":10240248,"type":"required_status_checks","parameters":{"required_status_checks":[{"context":"Heavy / Check"},{"context":"Codegen Drift"},{"context":"Commitlint"},{"context":"Heavy / Coverage Regression"},{"context":"Heavy / Docgen"},{"context":"Heavy / Doctest"},{"context":"Knip"},{"context":"Lint"},{"context":"Heavy / Lint Policy"},{"context":"Nix Shell"},{"context":"Professional Desktop IPC Stdio"},{"context":"Repo Sanity"},{"context":"SAST"},{"context":"Secret Scanning"},{"context":"Security"},{"context":"Heavy / Test Integration"},{"context":"Test Unit"},{"context":"JSDoc Ratchet"}]}}]';

const windowRun = (overrides: Partial<CiWorkflowWindowRun> = {}) =>
  CiWorkflowWindowRun.make({
    created_at: DateTime.makeUnsafe("2026-09-04T00:00:00Z"),
    event: "pull_request",
    head_sha: "head-a",
    id: 100,
    run_attempt: 1,
    ...overrides,
  });

const windowRunJobs = (run: CiWorkflowWindowRun, jobs: ReadonlyArray<CiWorkflowJob>) =>
  CiWorkflowWindowRunJobs.make({ jobs, run });

const laneStat = (report: CiLaneTimingWindowReport, lane: string) =>
  O.getOrThrow(A.findFirst(report.laneStats, (stat) => stat.lane === lane));

const attributionStat = (report: CiLaneTimingWindowReport, lane: string) =>
  O.getOrThrow(A.findFirst(report.attribution, (stat) => stat.lane === lane));

const windowOptions = (overrides: Partial<CiLaneTimingWindowOptions> = {}) =>
  CiLaneTimingWindowOptions.make({
    branch: O.none(),
    event: "all",
    headSha: O.none(),
    since: DateTime.makeUnsafe("2026-09-04T00:00:00Z"),
    until: DateTime.makeUnsafe("2026-09-11T00:00:00Z"),
    workflow: "check.yml",
    ...overrides,
  });

const windowGithubLayer = (commands: Array<string>) =>
  Layer.succeed(
    CiLaneTimingGithubClient,
    CiLaneTimingGithubClient.of({
      getJson: Effect.fn("TestCiLaneTimingGithubClient.getJson")((_repoRoot, endpoint) =>
        Effect.sync(() => {
          A.appendInPlace(commands, endpoint);
          if (Str.includes("rules/branches/main")(endpoint)) {
            return RULESET_18_JSON;
          }
          if (Str.includes("/actions/runs/")(endpoint)) {
            const pageNumber = Str.includes("page=3")(endpoint) ? 3 : Str.includes("page=2")(endpoint) ? 2 : 1;
            const jobCount = pageNumber === 3 ? 1 : 100;
            return JSON.stringify({
              jobs: A.makeBy(jobCount, (index) =>
                job({
                  id: pageNumber * 1_000 + index,
                  name: `Non-required fixture ${pageNumber}-${index}`,
                  run_id: 102,
                })
              ),
              total_count: 201,
            });
          }
          if (Str.includes("event=push")(endpoint)) {
            return '{"total_count":0,"workflow_runs":[]}';
          }
          if (Str.includes("&page=1")(endpoint)) {
            return '{"total_count":3,"workflow_runs":[{"created_at":"2026-09-03T23:59:59Z","event":"pull_request","head_sha":"before","id":101,"run_attempt":1}]}';
          }
          if (Str.includes("&page=2")(endpoint)) {
            return '{"total_count":3,"workflow_runs":[{"created_at":"2026-09-04T00:00:00Z","event":"pull_request","head_sha":"included","id":102,"run_attempt":1}]}';
          }
          if (Str.includes("&page=3")(endpoint)) {
            return '{"total_count":3,"workflow_runs":[{"created_at":"2026-09-11T00:00:00Z","event":"pull_request","head_sha":"until","id":103,"run_attempt":1}]}';
          }
          return '{"total_count":0,"workflow_runs":[]}';
        })
      ),
    })
  );

describe("ci lane timings attempt filter", () => {
  it.effect("collects every page of all-attempt jobs", () =>
    Effect.gen(function* () {
      const report = yield* collectCiLaneTimings(".", 1);

      expect(report.jobCount).toBe(2);
      expect(A.map(report.rows, (row) => row.jobId)).toStrictEqual([991, 992]);
    }).pipe(provideScopedLayer(laneTimingsSpawnerLayer))
  );

  it("reports job-level pickup latency on the first attempt", () => {
    expect(attemptOnePickupSeconds(job())).toStrictEqual(O.some(30));
  });

  it("refuses pickup latency for any later attempt", () => {
    // `run_started_at` is rewritten on re-dispatch, so a later attempt's
    // latency measures how long a human took to click rerun. During the Actions
    // outage that read 18-21 minutes while real pickup was 19-67 seconds.
    const redispatched = job({ run_attempt: 2, started_at: "2026-08-06T12:18:00Z" });

    expect(attemptOnePickupSeconds(redispatched)).toStrictEqual(O.none());
    expect(ciLaneTimingRow(redispatched).pickupSeconds).toStrictEqual(O.none());
  });

  it("keeps the filter out of the aggregate's reach", () => {
    // The aggregate reads the already-filtered column, so a reader cannot
    // reintroduce the artifact by forgetting the attempt filter.
    const report = ciLaneTimingsReport([
      ciLaneTimingRow(job()),
      ciLaneTimingRow(job({ id: 992, run_attempt: 3, started_at: "2026-08-06T12:20:00Z" })),
    ]);

    expect(report.jobCount).toBe(2);
    expect(report.attemptOneJobCount).toBe(1);
    expect(report.medianAttemptOnePickupSeconds).toStrictEqual(O.some(30));
  });

  it("computes the midpoint for an even number of pickup samples", () => {
    const report = ciLaneTimingsReport([
      ciLaneTimingRow(job({ id: 991, started_at: "2026-08-06T12:00:01Z" })),
      ciLaneTimingRow(job({ id: 992, started_at: "2026-08-06T12:01:39Z" })),
    ]);

    expect(report.medianAttemptOnePickupSeconds).toStrictEqual(O.some(50));
  });

  it.effect("rejects a jobs payload that omits run_attempt", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        decodeCiWorkflowJobsPage(
          '{"jobs":[{"completed_at":null,"conclusion":null,"created_at":"2026-08-06T12:00:00Z","id":991,"name":"Test Unit","run_id":42,"started_at":null,"status":"queued"}]}'
        )
      );

      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it("renders an absent pickup as an empty TSV cell, never as zero", () => {
    // A zero would drag a spreadsheet average toward zero; an empty cell is
    // skipped, so the filter survives to the last consumer.
    const rendered = renderCiLaneTimingsTsv([ciLaneTimingRow(job({ run_attempt: 2 }))]);
    const header = rendered.split("\n")[0]?.split("\t") ?? [];
    const cells = rendered.split("\n")[1]?.split("\t") ?? [];

    expect(cells[header.indexOf("pickupSeconds")]).toBe("");
    expect(cells[header.indexOf("durationSeconds")]).not.toBe("");
  });

  it("neutralizes formula-leading job names for spreadsheet import", () => {
    const cells = Str.split("\t")(
      Str.split("\n")(renderCiLaneTimingsTsv([ciLaneTimingRow(job({ name: "=1+1" }))]))[1] ?? ""
    );

    expect(cells[3]).toBe("'=1+1");
  });

  it("replaces embedded tabs in string cells", () => {
    const cells = Str.split("\t")(
      Str.split("\n")(renderCiLaneTimingsTsv([ciLaneTimingRow(job({ name: "Test\tUnit" }))]))[1] ?? ""
    );

    expect(cells).toHaveLength(12);
    expect(cells[3]).toBe("Test Unit");
  });

  it("replaces embedded newlines in string cells", () => {
    const lines = Str.split("\n")(renderCiLaneTimingsTsv([ciLaneTimingRow(job({ name: "Test\nUnit" }))]));

    expect(lines).toHaveLength(2);
    expect(Str.split("\t")(lines[1] ?? "")[3]).toBe("Test Unit");
  });
});

describe("ci lane timings derivations", () => {
  it("refuses a negative span rather than clamping a garbled record to zero", () => {
    // Job payloads with a `created_at` postdating their own `completed_at` were
    // observed live. Missing data must not read as a fast job.
    expect(ciTimestampSpanSeconds("2026-08-06T12:10:00Z", "2026-08-06T12:00:00Z")).toStrictEqual(O.none());
    expect(ciTimestampSpanSeconds(null, "2026-08-06T12:00:00Z")).toStrictEqual(O.none());
  });

  it("sums setup and install seconds from the step timings", () => {
    const row = ciLaneTimingRow(job());

    expect(row.setupSeconds).toStrictEqual(O.some(5));
    expect(row.installSeconds).toStrictEqual(O.some(60));
  });

  it("classifies runner pools from labels and refuses to guess", () => {
    expect(ciRunnerClassForLabels(["self-hosted", "linux"])).toBe("managed");
    expect(ciRunnerClassForLabels(["beep-ec2-heavy"])).toBe("managed");
    expect(ciRunnerClassForLabels(["ubuntu-latest"])).toBe("github-hosted");
    // An unlabelled job is excluded from the rate rather than bucketed into
    // whichever side would look better.
    expect(ciRunnerClassForLabels([])).toBe("unknown");
  });

  it("counts an infrastructure failure using the shared job-shape rule", () => {
    // The job failed with its setup step failed: zero repo commands ran, so it
    // is an infra failure and not a lane failure.
    const infra = job({
      conclusion: "failure",
      steps: [{ completed_at: null, conclusion: "failure", name: "Set up job", started_at: null }],
    });

    expect(ciLaneTimingRow(infra).infraFailure).toBe(true);
    expect(ciLaneTimingRow(job({ conclusion: "failure" })).infraFailure).toBe(false);
  });

  it("counts an install-step failure as infrastructure, not as a lane failure", () => {
    // Sharing the classifier with the merge loop is what keeps the collector's
    // infra-success rate and the loop's rerun policy talking about the same set.
    const installFlake = job({
      conclusion: "failure",
      steps: [
        {
          completed_at: "2026-08-06T12:00:35Z",
          conclusion: "success",
          name: "Set up job",
          started_at: "2026-08-06T12:00:30Z",
        },
        {
          completed_at: "2026-08-06T12:03:00Z",
          conclusion: "failure",
          name: "Install dependencies",
          started_at: "2026-08-06T12:00:35Z",
        },
        { completed_at: null, conclusion: null, name: "Run bun run codegen", started_at: null },
      ],
    });

    expect(ciLaneTimingRow(installFlake).infraFailure).toBe(true);
  });

  it("computes the managed-runner infra-success rate over managed jobs only", () => {
    const managedInfra = job({
      conclusion: "failure",
      id: 992,
      steps: [{ completed_at: null, conclusion: "failure", name: "Set up job", started_at: null }],
    });
    const hosted = job({ id: 993, labels: ["ubuntu-latest"] });
    const report = ciLaneTimingsReport(A.map([job(), managedInfra, hosted], ciLaneTimingRow));

    expect(report.managedJobCount).toBe(2);
    expect(report.managedInfraFailureCount).toBe(1);
    expect(report.managedInfraSuccessRate).toStrictEqual(O.some(0.5));
  });

  it("reports no rate rather than zero when no managed job was collected", () => {
    // A rate over zero jobs is not zero, and a zero here would read as a
    // catastrophic fleet failure.
    const report = ciLaneTimingsReport([ciLaneTimingRow(job({ labels: ["ubuntu-latest"] }))]);

    expect(report.managedInfraSuccessRate).toStrictEqual(O.none());
    expect(renderCiLaneTimingsSummary(report)).toContain("no managed-runner jobs collected");
  });

  it("leaves peak RSS absent until an out-of-band report supplies it", () => {
    // No Actions API reports peak RSS, so `None` is the honest value.
    const rows = [ciLaneTimingRow(job())];

    expect(rows[0]?.peakRssBytes).toStrictEqual(O.none());
    expect(withCiLanePeakRss(rows, { "Test Unit": 25_000_000_000 })[0]?.peakRssBytes).toStrictEqual(
      O.some(25_000_000_000)
    );
    expect(withCiLanePeakRss(rows, { Coverage: 1 })[0]?.peakRssBytes).toStrictEqual(O.none());
  });
});

describe("ci lane timing admission window", () => {
  it.effect("keeps effective spans, pickup, and excluded outcomes in separate schema populations", () =>
    Effect.gen(function* () {
      const run = windowRun();
      const report = yield* buildCiLaneTimingWindowReport(REQUIRED_CONTEXTS, [
        windowRunJobs(run, [
          job({
            completed_at: "2026-09-04T00:00:10Z",
            created_at: "2026-09-04T00:00:00Z",
            id: 1,
            name: "Heavy / Check",
            run_id: run.id,
            started_at: "2026-09-04T00:00:00Z",
          }),
          job({ conclusion: "failure", id: 2, name: "Heavy / Docgen", run_id: run.id }),
          job({ conclusion: "cancelled", id: 3, name: "Heavy / Doctest", run_id: run.id }),
          job({ id: 4, name: "Knip", run_attempt: 2, run_id: run.id }),
          job({
            completed_at: "2026-09-04T00:12:00Z",
            created_at: "2026-09-04T00:00:00Z",
            id: 5,
            name: "Lint (lint-a)",
            run_id: run.id,
            started_at: "2026-09-04T00:06:00Z",
          }),
          job({
            completed_at: "2026-09-04T00:11:00Z",
            created_at: "2026-09-04T00:00:00Z",
            id: 6,
            name: "Lint (lint-b)",
            run_id: run.id,
            started_at: "2026-09-04T00:07:00Z",
          }),
          job({
            completed_at: "2026-09-04T00:16:00Z",
            created_at: "2026-09-04T00:00:00Z",
            id: 7,
            name: "Lint",
            run_id: run.id,
            started_at: "2026-09-04T00:12:00Z",
          }),
          job({
            completed_at: "2026-09-04T00:09:00Z",
            created_at: "2026-09-04T00:00:00Z",
            id: 8,
            name: "Test Unit (repo-cli)",
            run_id: run.id,
            started_at: "2026-09-04T00:01:00Z",
          }),
          job({
            completed_at: "2026-09-04T00:10:00Z",
            created_at: "2026-09-04T00:00:00Z",
            id: 9,
            name: "Test Unit (unit-a)",
            run_id: run.id,
            started_at: "2026-09-04T00:02:00Z",
          }),
          job({
            completed_at: "2026-09-04T00:13:00Z",
            id: 10,
            name: "Test Unit",
            run_id: run.id,
            started_at: "2026-09-04T00:11:00Z",
          }),
        ]),
      ]);

      expect(report.contextCount).toBe(18);
      expect(laneStat(report, "Check").n).toBe(1);
      expect(laneStat(report, "Check").p95Seconds).toStrictEqual(O.some(10));
      expect(laneStat(report, "Lint").n).toBe(1);
      expect(laneStat(report, "Lint").p95Seconds).toStrictEqual(O.some(600));
      expect(laneStat(report, "Test Unit").n).toBe(0);
      expect(attributionStat(report, "Test Unit").incompleteEffectiveSpans).toBe(1);
      expect(attributionStat(report, "Docgen").failures).toBe(1);
      expect(attributionStat(report, "Doctest").cancellations).toBe(1);
      expect(attributionStat(report, "Knip").laterAttempts).toBe(1);
      expect(attributionStat(report, "Knip").laterSuccesses).toBe(1);
      expect(report.pickup.n).toBe(4);
      expect(report.pickup.p95Seconds).toStrictEqual(O.some(420));
      expect(report.pickup.breached).toBe(true);

      const markdown = renderCiLaneTimingWindowMarkdown(report);
      expect(markdown).toContain("| Required lane | n | PR | Push | p50 | p95 | Max | P3 state |");
      expect(markdown).toContain("| Lint | 1 | 1 | 0 | 10m00s | 10m00s | 10m00s | Pass |");
      expect(markdown).toContain("Queue tripwire: Breach — shard pickup p95 7m00s > 5m00s");

      const tsv = renderCiLaneTimingWindowTsv(report);
      expect(tsv).toContain("head-a");
      expect(tsv).toContain("pickup\tLint");
      expect(tsv).toContain("attribution\tTest Unit");
    })
  );

  it.effect("admits an effective Test Unit span only when every shard and the aggregator are green", () =>
    Effect.gen(function* () {
      const run = windowRun({ id: 200 });
      const report = yield* buildCiLaneTimingWindowReport(REQUIRED_CONTEXTS, [
        windowRunJobs(run, [
          job({
            completed_at: "2026-09-04T00:12:00Z",
            id: 21,
            name: "Test Unit (repo-cli)",
            run_id: run.id,
            started_at: "2026-09-04T00:02:00Z",
          }),
          job({
            completed_at: "2026-09-04T00:10:00Z",
            id: 22,
            name: "Test Unit (unit-a)",
            run_id: run.id,
            started_at: "2026-09-04T00:03:00Z",
          }),
          job({
            completed_at: "2026-09-04T00:11:00Z",
            id: 23,
            name: "Test Unit (unit-b)",
            run_id: run.id,
            started_at: "2026-09-04T00:04:00Z",
          }),
          job({
            completed_at: "2026-09-04T00:15:00Z",
            id: 24,
            name: "Test Unit",
            run_id: run.id,
            started_at: "2026-09-04T00:01:00Z",
          }),
        ]),
      ]);

      expect(laneStat(report, "Test Unit").n).toBe(1);
      expect(laneStat(report, "Test Unit").p95Seconds).toStrictEqual(O.some(780));
      expect(laneStat(report, "Test Unit").state).toBe("Pass");
    })
  );

  it.effect("uses nearest rank for small p50 and p95 populations", () =>
    Effect.gen(function* () {
      const durations = [10, 20, 30];
      const runs = A.map(durations, (duration, index) => {
        const run = windowRun({ id: 300 + index });
        return windowRunJobs(run, [
          job({
            completed_at: `2026-09-04T00:00:${Str.padStart(2, "0")(`${duration}`)}Z`,
            created_at: "2026-09-04T00:00:00Z",
            id: 30 + index,
            name: "Heavy / Check",
            run_id: run.id,
            started_at: "2026-09-04T00:00:00Z",
          }),
        ]);
      });
      const report = yield* buildCiLaneTimingWindowReport(REQUIRED_CONTEXTS, runs);

      expect(laneStat(report, "Check").p50Seconds).toStrictEqual(O.some(20));
      expect(laneStat(report, "Check").p95Seconds).toStrictEqual(O.some(30));
      expect(laneStat(report, "Check").maxSeconds).toStrictEqual(O.some(30));
    })
  );

  it.effect("fails closed when ruleset 10240248 does not normalize to exactly 18 contexts", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(buildCiLaneTimingWindowReport(A.append(REQUIRED_CONTEXTS, "Extra Context"), []));

      expect(Exit.isFailure(exit)).toBe(true);
      expect(Exit.isFailure(exit) ? exit.cause.toString() : "").toContain("exactly 18 required contexts; observed 19");
    })
  );

  it.effect("paginates three run pages and reapplies the half-open boundary before fetching jobs", () => {
    const commands = A.empty<string>();
    return Effect.gen(function* () {
      const report = yield* collectCiLaneTimingWindow(".", windowOptions({ headSha: O.some("included") }));

      expect(report.runCount).toBe(1);
      const runPageCommands = A.filter(commands, (command) => Str.includes("/actions/workflows/")(command));
      expect(runPageCommands).toHaveLength(4);
      expect(
        A.some(
          runPageCommands,
          (command) => Str.includes("event=pull_request")(command) && Str.includes("page=3")(command)
        )
      ).toBe(true);
      expect(
        A.some(
          runPageCommands,
          (command) => Str.includes("event=push")(command) && Str.includes("branch=main")(command)
        )
      ).toBe(true);
      expect(
        A.some(commands, (command) => Str.includes("/actions/runs/102/jobs?filter=all&per_page=100")(command))
      ).toBe(true);
      const jobPageCommands = A.filter(commands, (command) => Str.includes("/actions/runs/102/jobs")(command));
      expect(jobPageCommands).toHaveLength(3);
      expect(A.some(jobPageCommands, (command) => Str.includes("page=3")(command))).toBe(true);
      expect(A.some(commands, (command) => Str.includes("/actions/runs/101/jobs")(command))).toBe(false);
      expect(A.some(commands, (command) => Str.includes("/actions/runs/103/jobs")(command))).toBe(false);
    }).pipe(provideScopedLayer(windowGithubLayer(commands)));
  });
});
