import {
  attemptOnePickupSeconds,
  CiWorkflowJob,
  ciLaneTimingRow,
  ciLaneTimingsReport,
  ciRunnerClassForLabels,
  ciTimestampSpanSeconds,
  collectCiLaneTimings,
  decodeCiWorkflowJobsPage,
  renderCiLaneTimingsSummary,
  renderCiLaneTimingsTsv,
  withCiLanePeakRss,
} from "@beep/repo-cli/commands/Ci";
import { provideScopedLayer } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Layer, Sink, Stream } from "effect";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

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
