import {
  CI_RUN_GATE,
  CiRunGateInput,
  CiRunJob,
  CiRunStep,
  CiRunView,
  ciJobIsRed,
  ciRunGateReport,
} from "@beep/repo-cli/commands/Ci";
import { describe, it } from "@effect/vitest";
import { assertNone, assertSome, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import recordedJobs from "./fixtures/ci-gate-reports/run-jobs.json" with { type: "json" };

const decodeJobs = S.decodeUnknownEffect(S.Array(CiRunJob));

const run = CiRunView.make({
  id: 45042229032,
  attempt: 1,
  workflow: "Check",
  headSha: "4e3343774cc0000000000000000000000000beef",
  branch: O.some("main"),
  createdAt: "2026-11-22T10:00:00Z",
});

const step = (name: string, conclusion: string | null, number = 1) =>
  CiRunStep.make({ name, status: conclusion === null ? "in_progress" : "completed", conclusion, number });

const job = (id: number, conclusion: string | null, steps: ReadonlyArray<CiRunStep> | null) =>
  CiRunJob.make({ id, name: `job-${id}`, status: "completed", conclusion, steps });

const itemsOf = (report: ReturnType<typeof ciRunGateReport>, unit: string) =>
  A.filter(report.items, (item) => item.unit === unit);

describe("CI-job adapter", () => {
  it.effect("reads a recorded jobs response: gate run, unit job, item step, honest counts", () =>
    Effect.gen(function* () {
      const jobs = yield* decodeJobs(recordedJobs.jobs);
      const report = ciRunGateReport(
        CiRunGateInput.make({ run, jobs, details: HashMap.make([102, "test @beep/repo-cli: FAILED, 1 failed"]) })
      );
      strictEqual(report.gate, CI_RUN_GATE);
      strictEqual(report.subject, "Check #45042229032");
      strictEqual(report.runId, "45042229032-1");
      strictEqual(report.itemKind, "step");
      assertSome(report.head, run.headSha);
      assertSome(report.branch, "main");
      deepStrictEqual(
        A.map(report.units, (unit) => [unit.id, unit.kind]),
        A.map(jobs, (found) => [found.name, "job"])
      );
      const unit = itemsOf(report, "Test Unit (repo-cli-8)");
      deepStrictEqual(
        A.map(unit, (item) => [item.name, item.outcome]),
        [
          ["Set up job", "passed"],
          ["Run lane", "failed"],
          ["Upload task outcomes", "passed"],
          ["Append summary", "skipped"],
        ]
      );
      assertSome(
        O.map(unit[1]!.detail, (detail) => detail.message),
        "test @beep/repo-cli: FAILED, 1 failed"
      );
      assertNone(unit[0]!.detail);
      const cancelled = itemsOf(report, "Lint (lint-2)")[1]!;
      strictEqual(cancelled.outcome, "failed");
      assertSome(cancelled.failureKind, "unhandled");
      assertSome(
        O.map(cancelled.detail, (detail) => detail.message),
        "step cancelled"
      );
      const timedOut = itemsOf(report, "Test Integration (integration-1)");
      assertSome(timedOut[1]!.failureKind, "timeout");
      strictEqual(timedOut[2]!.outcome, "skipped");
      const noSteps = itemsOf(report, "Nix Shell");
      deepStrictEqual(
        A.map(noSteps, (item) => [item.key._tag, item.outcome]),
        [["FaultKey", "failed"]]
      );
      assertSome(
        O.map(noSteps[0]!.detail, (detail) => detail.message),
        "job success with no steps"
      );
      strictEqual(itemsOf(report, "Docs Policy")[1]!.outcome, "failed");
      strictEqual(report.totals.failed, 2);
      strictEqual(report.totals.timedOut, 1);
      strictEqual(report.totals.unhandled, 1);
      strictEqual(report.totals.errored, 1);
      strictEqual(report.totals.skipped, 2);
      strictEqual(report.totals.collected, report.items.length);
      strictEqual(report.reason, "failed");
      strictEqual(report.outcome, "some-fail");
      strictEqual(DateTime.formatIso(report.startedAt), "2026-11-22T10:00:00.000Z");
    })
  );

  it("reads a green run as passed and an absent step list as no steps", () => {
    const green = ciRunGateReport(
      CiRunGateInput.make({ run, jobs: [job(1, "success", [step("Run lane", "success")])] })
    );
    strictEqual(green.reason, "passed");
    strictEqual(green.outcome, "all-pass");
    const stepless = ciRunGateReport(
      CiRunGateInput.make({
        run,
        jobs: [job(2, null, null), CiRunJob.make({ id: 3, name: "job-3", status: "completed", conclusion: null })],
      })
    );
    deepStrictEqual(
      A.map(stepless.items, (item) => O.map(item.detail, (detail) => detail.message)),
      [O.some("job completed with no steps"), O.some("job completed with no steps")]
    );
    strictEqual(stepless.outcome, "some-fail");
  });

  it("reads a stepless job GitHub skipped or has not started as skipped, not as a fault", () => {
    const report = ciRunGateReport(
      CiRunGateInput.make({
        run,
        jobs: [
          job(1, "success", [step("Run lane", "success")]),
          job(2, "skipped", []),
          CiRunJob.make({ id: 3, name: "job-3", status: "queued", conclusion: null, steps: [] }),
        ],
      })
    );
    deepStrictEqual(
      A.map(report.items, (item) => [item.unit, item.key._tag, item.outcome]),
      [
        ["job-1", "TestKey", "passed"],
        ["job-2", "TestKey", "skipped"],
        ["job-3", "TestKey", "skipped"],
      ]
    );
    strictEqual(report.totals.errored, 0);
    strictEqual(report.totals.skipped, 2);
    strictEqual(report.reason, "passed");
  });

  it("gives a red job with no failed step a fault item, with the job's detail when it has one", () => {
    const report = ciRunGateReport(
      CiRunGateInput.make({
        run,
        jobs: [
          job(4, "failure", [step("Set up job", "success")]),
          job(5, "cancelled", [step("Set up job", "success")]),
          job(6, null, [step("Run", "failure")]),
        ],
        details: HashMap.make([5, "region"]),
      })
    );
    deepStrictEqual(
      A.map(report.items, (item) => [
        item.unit,
        item.name,
        O.getOrNull(O.map(item.detail, (detail) => detail.message)),
      ]),
      [
        ["job-4", "Set up job", null],
        ["job-4", "job", "job failure with no failed step"],
        ["job-5", "Set up job", null],
        ["job-5", "job", "region"],
        ["job-6", "Run", "step failure"],
      ]
    );
  });

  it("reads a run whose creation time is not an instant at the epoch, and no branch as none", () => {
    const report = ciRunGateReport(
      CiRunGateInput.make({
        run: CiRunView.make({ ...run, branch: O.none(), createdAt: "not a time" }),
        jobs: [job(7, "success", [step("Run", "success")])],
      })
    );
    strictEqual(DateTime.toEpochMillis(report.startedAt), 0);
    assertNone(report.branch);
  });

  it("calls failure, timed_out and cancelled jobs red, and nothing else", () => {
    deepStrictEqual(
      A.map(["failure", "timed_out", "cancelled", "success", "skipped", null], (conclusion) =>
        ciJobIsRed(job(8, conclusion, []))
      ),
      [true, true, true, false, false, false]
    );
  });
});
