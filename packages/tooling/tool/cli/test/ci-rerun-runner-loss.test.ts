import {
  CiRerunRunnerLossInput,
  CiWorkflowJob,
  ciRerunRunnerLossCommand,
  decideRunnerLossRerun,
  RunnerLossFailedJob,
  RunnerLossHead,
  RunnerLossJobEvidence,
  RunnerLossRerunDecision,
  RunnerLossRerunInput,
  RunnerLossRerunReason,
  RunnerLossRerunReport,
  RunnerLossRun,
  renderRunnerLossRerunSummary,
  runCiRerunRunnerLoss,
  runnerLossCopiedFrom,
  runnerLossFailedJob,
  runnerLossJobReruns,
  runnerLossRerunArgs,
} from "@beep/repo-cli/commands/Ci";
import { GithubJobRecord, GithubJobStepRecord, githubJobHasFailedStep } from "@beep/repo-cli/test/SharedInternals";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, deepStrictEqual } from "@effect/vitest/utils";
import { ConfigProvider, Effect, FileSystem, flow, Layer, Path, pipe, Ref, Result, Sink, Stream } from "effect";
import * as A from "effect/Array";
import { Command } from "effect/cli";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { parseDocument } from "yaml";

const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);
const LOST_MESSAGE =
  "The self-hosted runner lost communication with the server. Verify the machine is running and has a healthy network connection.";
const SHA = "c81bbe770a2898edc2f6c62921ee14bfa339315c";
const NEWER_SHA = "d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1";

const run = (values: Partial<RunnerLossRun> = {}) =>
  RunnerLossRun.make({
    id: 36763005302,
    name: "Check",
    event: "pull_request",
    status: "completed",
    conclusion: "failure",
    run_attempt: 1,
    head_sha: SHA,
    head_branch: "refactor/literal-kit-trim",
    head_owner: "beep-effect",
    pull_requests: [1338],
    ...values,
  });
const lost = (id: number, name: string, reruns = 0) =>
  RunnerLossFailedJob.make({ id, name, runnerName: `beep-ci-i-${id}`, runnerLoss: true, reruns });
const red = (id: number, name: string) => RunnerLossFailedJob.make({ id, name, runnerName: null, runnerLoss: false });
const input = (values: Partial<RunnerLossRerunInput> = {}) =>
  RunnerLossRerunInput.make({
    run: run(),
    attempt: 1,
    failedJobs: [lost(11, "Heavy / Lint Policy")],
    head: RunnerLossHead.make({ status: "current" }),
    ...values,
  });
const step = (name: string, conclusion: string | null) => ({ name, conclusion, started_at: null, completed_at: null });
const restJob = (id: number, conclusion: string | null, steps: ReadonlyArray<ReturnType<typeof step>>) =>
  CiWorkflowJob.make({
    completed_at: "2026-09-30T20:01:54Z",
    conclusion,
    created_at: "2026-09-30T19:37:00Z",
    id,
    name: `Heavy / Job ${id}`,
    run_attempt: 1,
    run_id: 36763005302,
    runner_name: `beep-ci-i-${id}`,
    started_at: "2026-09-30T19:38:28Z",
    status: "completed",
    steps,
  });
const lostSteps = [step("Set up job", "success"), step("Run verification lane", null)];
const failedSteps = [step("Set up job", "success"), step("Run verification lane", "failure")];

const evidence = (annotations: ReadonlyArray<string>, reruns = 0) =>
  RunnerLossJobEvidence.make({ annotations, reruns });
const report = (decision: RunnerLossRerunDecision, dryRun = false) =>
  renderRunnerLossRerunSummary(RunnerLossRerunReport.make({ decision, dryRun }));
// One job of a given attempt; `startedAt` tells a job that ran apart from a copy.
const attemptJob = (
  id: number,
  name: string,
  attempt: number,
  startedAt: string,
  conclusion: string | null = "failure"
) =>
  CiWorkflowJob.make({
    ...restJob(id, conclusion, conclusion === "failure" ? lostSteps : [step("Set up job", "success")]),
    name,
    run_attempt: attempt,
    started_at: startedAt,
    completed_at: startedAt,
  });

describe("runner-loss job detection", () => {
  it("counts a failed job as lost only with the annotation and no failed step", () => {
    expect(runnerLossFailedJob(restJob(1, "failure", lostSteps), evidence([LOST_MESSAGE])).runnerLoss).toBe(true);
    expect(runnerLossFailedJob(restJob(2, "failure", failedSteps), evidence([LOST_MESSAGE])).runnerLoss).toBe(false);
    expect(
      runnerLossFailedJob(restJob(3, "failure", lostSteps), evidence(["Process completed with exit code 1."]))
        .runnerLoss
    ).toBe(false);
    expect(runnerLossFailedJob(restJob(4, "cancelled", lostSteps), evidence([LOST_MESSAGE])).runnerLoss).toBe(false);
    const hosted = "The hosted runner: GitHub Actions 12 lost communication with the server.";
    deepStrictEqual(
      runnerLossFailedJob(evidence([hosted], 2))(restJob(5, "FAILURE", lostSteps)),
      RunnerLossFailedJob.make({ id: 5, name: "Heavy / Job 5", runnerName: "beep-ci-i-5", runnerLoss: true, reruns: 2 })
    );
  });

  it("reads a failed step from a job record", () => {
    const record = (conclusion: string | null) =>
      GithubJobRecord.make({
        conclusion: "failure",
        databaseId: 1,
        name: "Heavy / Check",
        status: "completed",
        steps: [GithubJobStepRecord.make({ name: "Run verification lane", conclusion })],
      });
    expect(githubJobHasFailedStep(record("failure"))).toBe(true);
    expect(githubJobHasFailedStep(record("success"))).toBe(false);
    expect(githubJobHasFailedStep(record(null))).toBe(false);
  });
});

describe("runner-loss job lineage", () => {
  const docgen = "Heavy / Docgen";
  it("traces a copied job with blank annotations to the earliest attempt it came from", () => {
    const original = attemptJob(10, docgen, 1, "2026-09-30T20:00:00Z");
    const copies = [
      attemptJob(20, docgen, 2, "2026-09-30T20:00:00Z"),
      attemptJob(30, docgen, 3, "2026-09-30T20:00:00Z"),
    ];
    const runJobs = [copies[1]!, copies[0]!, original];
    deepStrictEqual(
      O.map(runnerLossCopiedFrom(copies[1]!, runJobs), (job) => job.id),
      O.some(10)
    );
    assertNone(runnerLossCopiedFrom(runJobs)(original));
    assertNone(runnerLossCopiedFrom(attemptJob(40, docgen, 4, "2026-09-30T23:00:00Z"), runJobs));
    const unstarted = CiWorkflowJob.make({ ...attemptJob(50, docgen, 2, "2026-09-30T20:00:00Z"), started_at: null });
    assertNone(runnerLossCopiedFrom(unstarted, [CiWorkflowJob.make({ ...original, started_at: null })]));
  });

  it("counts the attempts after the first in which a job actually ran", () => {
    const runJobs = [
      attemptJob(10, docgen, 1, "2026-09-30T20:00:00Z"),
      attemptJob(20, docgen, 2, "2026-09-30T21:00:00Z"),
      attemptJob(30, docgen, 3, "2026-09-30T21:00:00Z"),
      attemptJob(40, docgen, 4, "2026-09-30T22:00:00Z"),
      attemptJob(41, "Heavy / Check", 4, "2026-09-30T22:00:00Z"),
    ];
    expect(runnerLossJobReruns(runJobs[0]!, runJobs)).toBe(0);
    expect(runnerLossJobReruns(runJobs[2]!, runJobs)).toBe(1);
    expect(runnerLossJobReruns(runJobs)(runJobs[3]!)).toBe(2);
  });
});

describe("runner-loss rerun decision", () => {
  it("does nothing for a run that is still running or did not fail", () => {
    const running = decideRunnerLossRerun(input({ run: run({ status: "in_progress", conclusion: null }) }));
    expect(running.reason).toBe("run-not-completed");
    const green = decideRunnerLossRerun(input({ run: run({ conclusion: "success" }), failedJobs: [] }));
    expect(green.rerun).toBe(false);
    expect(green.reason).toBe("run-not-failed");
    assertNone(runnerLossRerunArgs(green));
  });

  it("skips a failed run without a lost job and names its red", () => {
    const decision = decideRunnerLossRerun(input({ failedJobs: [red(12, "Heavy / Check")] }));
    expect(decision.reason).toBe("no-runner-loss");
    assertNone(runnerLossRerunArgs(decision));
    const summary = report(decision);
    expect(summary).toContain("- Left red, failed for another reason (never re-run): Heavy / Check");
    expect(summary).toContain("| Heavy / Check | `12` | unknown | failed | 0 | left red: not runner loss |");
  });

  it("re-runs only one lost job and leaves the real failure red and named", () => {
    const decision = decideRunnerLossRerun(
      input({ failedJobs: [lost(11, "Heavy / Lint Policy"), red(12, "Check"), lost(13, "Heavy / Docgen")] })
    );
    expect(decision.reason).toBe("runner-loss");
    assertSome(runnerLossRerunArgs(decision), ["run", "rerun", "--job", "11"]);
    const summary = report(decision);
    expect(summary).toContain("re-ran Heavy / Lint Policy with `gh run rerun --job 11`");
    expect(summary).toContain("- Left red, failed for another reason (never re-run): Check");
    expect(summary).toContain("| Heavy / Lint Policy | `11` | beep-ci-i-11 | runner lost | 0 | re-run requested |");
    expect(summary).toContain(
      "| Heavy / Docgen | `13` | beep-ci-i-13 | runner lost | 0 | waits for the next attempt |"
    );
    expect(summary).toContain("| Check | `12` | unknown | failed | 0 | left red: not runner loss |");
    expect(summary).not.toContain("--failed");
    expect(report(decision, true)).toContain(
      "| Heavy / Lint Policy | `11` | beep-ci-i-11 | runner lost | 0 | would re-run |"
    );
  });

  it("re-runs the lost job with the fewest reruns and stops a job at its bound", () => {
    const decision = decideRunnerLossRerun(
      input({
        run: run({ run_attempt: 4 }),
        attempt: 4,
        failedJobs: [lost(11, "Heavy / Lint Policy", 3), lost(13, "Heavy / Docgen", 2), lost(14, "Heavy / Check", 1)],
      })
    );
    assertSome(
      O.map(decision.rerunJob, (job) => job.id),
      14
    );
    const summary = report(decision);
    expect(summary).toContain("- Left red, re-run 3 times already: Heavy / Lint Policy");
    expect(summary).toContain(
      "| Heavy / Lint Policy | `11` | beep-ci-i-11 | runner lost | 3 | left red: re-run 3 times already |"
    );
    const exhausted = decideRunnerLossRerun(
      input({ run: run({ run_attempt: 4 }), attempt: 4, failedJobs: [lost(11, "Heavy / Lint Policy", 3)] })
    );
    expect(exhausted.reason).toBe("job-reruns-exhausted");
    expect(report(exhausted)).toContain("every lost job was already re-run 3 times");
  });

  it("skips an attempt that was already re-run and stops every job at the run ceiling", () => {
    expect(decideRunnerLossRerun(input({ run: run({ run_attempt: 2 }), attempt: 1 })).reason).toBe(
      "attempt-already-rerun"
    );
    expect(decideRunnerLossRerun(input({ run: run({ run_attempt: 7 }), attempt: 7 })).rerun).toBe(true);
    const ceiling = decideRunnerLossRerun(
      input({
        run: run({ run_attempt: 8 }),
        attempt: 8,
        failedJobs: [lost(11, "Heavy / Lint Policy", 1), lost(13, "Heavy / Docgen", 3)],
      })
    );
    expect(ceiling.reason).toBe("attempt-cap");
    const summary = report(ceiling);
    expect(summary).toContain("- Left red, run ceiling reached: Heavy / Lint Policy");
    expect(summary).toContain("- Left red, re-run 3 times already: Heavy / Docgen");
    expect(summary).toContain("the run reached attempt 8, the run ceiling");
  });

  it("never re-runs a superseded, closed, unsupported, or unread head", () => {
    const superseded = decideRunnerLossRerun(
      input({ head: RunnerLossHead.make({ status: "superseded", currentSha: O.some(NEWER_SHA) }) })
    );
    expect(superseded.reason).toBe("superseded-head");
    assertNone(runnerLossRerunArgs(superseded));
    const summary = report(superseded);
    expect(summary).toContain(`- Current head: \`${NEWER_SHA}\``);
    expect(summary).toContain("| Heavy / Lint Policy | `11` | beep-ci-i-11 | runner lost | 0 | not re-run |");
    const reasons = A.map(["no-open-pull-request", "unsupported-event", "unchecked"] as const, (status) =>
      decideRunnerLossRerun(input({ head: RunnerLossHead.make({ status }) }))
    );
    deepStrictEqual(
      A.map(reasons, (decision) => decision.reason),
      ["no-open-pull-request", "unsupported-event", "head-unchecked"]
    );
    expect(A.every(reasons, (decision) => !decision.rerun)).toBe(true);
  });

  it("explains every reason in the summary", () => {
    const sentences = A.map(RunnerLossRerunReason.literals, (reason) =>
      report(
        RunnerLossRerunDecision.make({
          rerun: false,
          reason,
          runId: 1,
          attempt: 8,
          maxAttempt: 8,
          maxJobReruns: 3,
          lostJobs: [],
          otherFailedJobs: [],
        })
      )
    );
    expect(A.every(sentences, (summary) => summary.includes("- Verdict: skipped ("))).toBe(true);
    expect(A.length(A.dedupe(sentences))).toBe(A.length(RunnerLossRerunReason.literals));
  });

  it("renders a skip without a job table", () => {
    const summary = report(decideRunnerLossRerun(input({ run: run({ conclusion: "success" }), failedJobs: [] })));
    expect(summary).toBe(
      "## Runner-loss rerun\n\n- Run: `36763005302`, attempt 1 (run ceiling 8, 3 reruns per job)\n- Verdict: skipped (`run-not-failed`): the run did not fail\n"
    );
  });
});

const handle = (exitCode: number, output: string) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(new TextEncoder().encode(output)),
    stdout: Stream.make(new TextEncoder().encode(output)),
    stderr: Stream.empty,
    stdin: Sink.drain,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    unref: Effect.succeed(Effect.void),
  });

// One scripted gh response: `gh api <endpoint>` matches by endpoint, any other
// gh call by its whole argument list. A negative exit code scripts a gh that
// could not be spawned at all.
type GhReply = readonly [key: string, exitCode: number, output: string];
const ghSpawner = (replies: ReadonlyArray<GhReply>, commands: Ref.Ref<ReadonlyArray<ReadonlyArray<string>>>) =>
  ChildProcessSpawner.make((command) => {
    if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
    const key = command.args[0] === "api" ? (command.args[1] ?? "") : A.join(command.args, " ");
    const reply = A.findFirst(replies, ([candidate]) => candidate === key);
    return Ref.update(commands, A.append(command.args)).pipe(
      Effect.andThen(
        O.match(reply, {
          onNone: () => Effect.succeed(handle(1, `gh: unscripted ${key} (HTTP 404)`)),
          onSome: ([, exitCode, output]) =>
            exitCode < 0
              ? Effect.fail(
                  PlatformError.systemError({
                    _tag: "NotFound",
                    module: "CiRerunRunnerLossTest",
                    method: "spawn",
                    description: output,
                  })
                )
              : Effect.succeed(handle(exitCode, output)),
        })
      )
    );
  });
const withGh = (replies: ReadonlyArray<GhReply>, commands: Ref.Ref<ReadonlyArray<ReadonlyArray<string>>>) =>
  Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, ghSpawner(replies, commands));
const withEnv = Effect.provideService(
  ConfigProvider.ConfigProvider,
  ConfigProvider.fromUnknown({ GITHUB_STEP_SUMMARY: "" })
);

const RUN_ENDPOINT = "repos/{owner}/{repo}/actions/runs/36763005302";
const jobsEndpoint = (page: number) =>
  `repos/{owner}/{repo}/actions/runs/36763005302/attempts/1/jobs?per_page=100&page=${page}`;
const annotationsEndpoint = (id: number, page = 1) =>
  `repos/{owner}/{repo}/check-runs/${id}/annotations?per_page=100&page=${page}`;
const runJson = (values: Record<string, unknown> = {}) =>
  encodeJson({
    id: 36763005302,
    name: "Check",
    event: "pull_request",
    status: "completed",
    conclusion: "failure",
    run_attempt: 1,
    head_sha: SHA,
    head_branch: "refactor/literal-kit-trim",
    head_owner: "beep-effect",
    pull_requests: [1338],
    ...values,
  });
const jobsJson = (totalCount: number, jobs: ReadonlyArray<CiWorkflowJob>) =>
  encodeJson({ total_count: totalCount, jobs });
const pullJson = (state: string, headSha: string, number = 1338, headRef = "refactor/literal-kit-trim") =>
  encodeJson({ number, state, head_sha: headSha, head_ref: headRef, head_owner: "beep-effect" });
// Page 1 holds a lost job and a genuine red; page 2 a green job.
const failedAttemptReplies: ReadonlyArray<GhReply> = [
  [jobsEndpoint(1), 0, jobsJson(3, [restJob(11, "failure", lostSteps), restJob(12, "failure", failedSteps)])],
  [jobsEndpoint(2), 0, jobsJson(3, [restJob(13, "success", [step("Set up job", "success")])])],
  [annotationsEndpoint(11), 0, encodeJson([LOST_MESSAGE])],
  [annotationsEndpoint(12), 0, encodeJson(["Process completed with exit code 1."])],
];

const platform = Layer.mergeAll(NodeServices.layer, TestConsole.layer);
const logs = TestConsole.logLines.pipe(Effect.map(A.map(String)), Effect.map(A.join("\n")));
const errors = TestConsole.errorLines.pipe(Effect.map(A.map(String)), Effect.map(A.join("\n")));
const decideRun = (runInput: CiRerunRunnerLossInput) =>
  runCiRerunRunnerLoss(runInput).pipe(Effect.map((outcome) => outcome.decision));
const runCommand = Command.runWith(ciRerunRunnerLossCommand, { version: "0.0.0" });
const endpoints = (commands: ReadonlyArray<ReadonlyArray<string>>) =>
  A.map(commands, (args) => (args[0] === "api" ? (args[1] ?? "") : A.join(args, " ")));

it.layer(platform, { timeout: "30 seconds" })("ci rerun-runner-loss", (layerIt) => {
  layerIt.effect("re-runs the lost job of a current pull-request head and writes the step summary", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "ci-rerun-runner-loss-" });
      const summaryPath = `${root}/summary.md`;
      const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const replies: ReadonlyArray<GhReply> = [
        [RUN_ENDPOINT, 0, runJson()],
        ...failedAttemptReplies,
        ["repos/{owner}/{repo}/pulls/1338", 0, pullJson("open", SHA)],
        ["run rerun --job 11", 0, "✓ Requested rerun of job 11"],
      ];
      const outcome = yield* runCiRerunRunnerLoss(
        CiRerunRunnerLossInput.make({ runId: 36763005302, stepSummaryPath: O.some(summaryPath), cwd: root })
      ).pipe(withGh(replies, commands));
      expect(outcome.decision.reason).toBe("runner-loss");
      expect(outcome.dryRun).toBe(false);
      deepStrictEqual(endpoints(yield* Ref.get(commands)), [
        RUN_ENDPOINT,
        jobsEndpoint(1),
        jobsEndpoint(2),
        annotationsEndpoint(11),
        annotationsEndpoint(12),
        "repos/{owner}/{repo}/pulls/1338",
        "run rerun --job 11",
      ]);
      const summary = yield* fs.readFileString(summaryPath);
      expect(summary).toContain("re-ran Heavy / Job 11 with `gh run rerun --job 11`");
      expect(summary).toContain("| Heavy / Job 12 | `12` | beep-ci-i-12 | failed | 0 | left red: not runner loss |");
      expect(yield* logs).toContain("## Runner-loss rerun");
    })
  );

  layerIt.effect("reads the head only after every earlier gate passed", () =>
    Effect.gen(function* () {
      const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const green = yield* decideRun(CiRerunRunnerLossInput.make({ runId: 36763005302, cwd: "." })).pipe(
        withGh([[RUN_ENDPOINT, 0, runJson({ conclusion: "success" })]], commands)
      );
      expect(green.reason).toBe("run-not-failed");
      deepStrictEqual(endpoints(yield* Ref.get(commands)), [RUN_ENDPOINT]);

      yield* Ref.set(commands, []);
      const capped = yield* decideRun(
        CiRerunRunnerLossInput.make({ runId: 36763005302, attempt: O.some(1), maxAttempt: 1, cwd: "." })
      ).pipe(withGh([[RUN_ENDPOINT, 0, runJson()], ...failedAttemptReplies], commands));
      expect(capped.reason).toBe("attempt-cap");
      expect(A.contains(endpoints(yield* Ref.get(commands)), "repos/{owner}/{repo}/pulls/1338")).toBe(false);
    })
  );

  layerIt.effect("skips superseded and closed pull-request heads without requesting a rerun", () =>
    Effect.gen(function* () {
      const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const decide = (replies: ReadonlyArray<GhReply>) =>
        decideRun(CiRerunRunnerLossInput.make({ runId: 36763005302, cwd: "." })).pipe(
          withGh([[RUN_ENDPOINT, 0, runJson()], ...failedAttemptReplies, ...replies], commands)
        );
      const superseded = yield* decide([["repos/{owner}/{repo}/pulls/1338", 0, pullJson("open", NEWER_SHA)]]);
      expect(superseded.reason).toBe("superseded-head");
      assertSome(
        O.flatMap(superseded.head, (head) => head.currentSha),
        NEWER_SHA
      );
      const closed = yield* decide([["repos/{owner}/{repo}/pulls/1338", 0, pullJson("closed", SHA)]]);
      expect(closed.reason).toBe("no-open-pull-request");
      expect(A.some(yield* Ref.get(commands), (args) => args[0] === "run")).toBe(false);
    })
  );

  layerIt.effect("judges a run only by the pull request whose branch it ran on", () =>
    Effect.gen(function* () {
      const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      // PR 1338 (branch refactor/literal-kit-trim) advanced; PR 1339 (branch
      // other/branch) still points at the run's SHA.
      const pulls: ReadonlyArray<GhReply> = [
        ["repos/{owner}/{repo}/pulls/1338", 0, pullJson("open", NEWER_SHA)],
        ["repos/{owner}/{repo}/pulls/1339", 0, pullJson("open", SHA, 1339, "other/branch")],
      ];
      const decide = (runValues: Record<string, unknown>) =>
        decideRun(CiRerunRunnerLossInput.make({ runId: 36763005302, cwd: "." })).pipe(
          withGh(
            [
              [RUN_ENDPOINT, 0, runJson({ pull_requests: [1339, 1338], ...runValues })],
              ...failedAttemptReplies,
              ...pulls,
              ["run rerun --job 11", 0, "✓ Requested"],
            ],
            commands
          )
        );
      const runOfA = yield* decide({});
      expect(runOfA.reason).toBe("superseded-head");
      expect(A.some(yield* Ref.get(commands), (args) => args[0] === "run")).toBe(false);
      const runOfB = yield* decide({ head_branch: "other/branch" });
      expect(runOfB.reason).toBe("runner-loss");
      expect(A.contains(endpoints(yield* Ref.get(commands)), "run rerun --job 11")).toBe(true);
    })
  );

  layerIt.effect("reads every annotation page before judging a job", () =>
    Effect.gen(function* () {
      const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const noise = A.makeBy(100, (index) => `warning ${index}`);
      const decision = yield* decideRun(
        CiRerunRunnerLossInput.make({ runId: 36763005302, dryRun: true, cwd: "." })
      ).pipe(
        withGh(
          [
            [RUN_ENDPOINT, 0, runJson()],
            [jobsEndpoint(1), 0, jobsJson(1, [restJob(11, "failure", lostSteps)])],
            [annotationsEndpoint(11, 1), 0, encodeJson(noise)],
            [annotationsEndpoint(11, 2), 0, encodeJson([LOST_MESSAGE])],
            ["repos/{owner}/{repo}/pulls/1338", 0, pullJson("open", SHA)],
          ],
          commands
        )
      );
      expect(decision.reason).toBe("runner-loss");
      expect(A.contains(endpoints(yield* Ref.get(commands)), annotationsEndpoint(11, 2))).toBe(true);
    })
  );

  layerIt.effect("finds a fork pull request by its head label", () =>
    Effect.gen(function* () {
      const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const forkLookup = `repos/{owner}/{repo}/pulls?state=open&per_page=10&head=${encodeURIComponent("contributor:refactor/literal-kit-trim")}`;
      const decide = (runValues: Record<string, unknown>, replies: ReadonlyArray<GhReply>) =>
        decideRun(CiRerunRunnerLossInput.make({ runId: 36763005302, dryRun: true, cwd: "." })).pipe(
          withGh([[RUN_ENDPOINT, 0, runJson(runValues)], ...failedAttemptReplies, ...replies], commands)
        );
      const fork = yield* decide({ pull_requests: [], head_owner: "contributor" }, [
        [
          forkLookup,
          0,
          encodeJson([
            {
              number: 7,
              state: "open",
              head_sha: SHA,
              head_ref: "refactor/literal-kit-trim",
              head_owner: "contributor",
            },
            { number: 8, state: "open", head_sha: NEWER_SHA, head_ref: "other/branch", head_owner: "contributor" },
          ]),
        ],
      ]);
      expect(fork.reason).toBe("runner-loss");
      expect(A.contains(endpoints(yield* Ref.get(commands)), forkLookup)).toBe(true);
      const movedFork = yield* decide({ pull_requests: [], head_owner: "contributor" }, [
        [
          forkLookup,
          0,
          encodeJson([
            {
              number: 7,
              state: "open",
              head_sha: NEWER_SHA,
              head_ref: "refactor/literal-kit-trim",
              head_owner: "contributor",
            },
          ]),
        ],
      ]);
      expect(movedFork.reason).toBe("superseded-head");
      assertSome(
        O.flatMap(movedFork.head, (head) => head.currentSha),
        NEWER_SHA
      );
      const ownerless = yield* decide({ pull_requests: [], head_owner: null }, []);
      expect(ownerless.reason).toBe("no-open-pull-request");
    })
  );

  layerIt.effect("re-runs a fork pull request's lost job and fails visibly when gh cannot start", () =>
    Effect.gen(function* () {
      const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const forkLookup = `repos/{owner}/{repo}/pulls?state=open&per_page=10&head=${encodeURIComponent("contributor:refactor/literal-kit-trim")}`;
      const forkPull = encodeJson([
        { number: 7, state: "open", head_sha: SHA, head_ref: "refactor/literal-kit-trim", head_owner: "contributor" },
      ]);
      const rerun = (rerunReply: GhReply) =>
        decideRun(CiRerunRunnerLossInput.make({ runId: 36763005302, cwd: "." })).pipe(
          withGh(
            [
              [RUN_ENDPOINT, 0, runJson({ pull_requests: [], head_owner: "contributor" })],
              ...failedAttemptReplies,
              [forkLookup, 0, forkPull],
              rerunReply,
            ],
            commands
          )
        );
      const requested = yield* rerun(["run rerun --job 11", 0, "✓ Requested"]);
      expect(requested.reason).toBe("runner-loss");
      expect(A.contains(endpoints(yield* Ref.get(commands)), "run rerun --job 11")).toBe(true);
      const unspawned = yield* rerun(["run rerun --job 11", -1, "gh: command not found"]).pipe(Effect.flip);
      expect(unspawned.message).toBe("gh run rerun --job 11 failed (spawn).");
    })
  );

  layerIt.effect("compares a push run with its branch tip and refuses other events", () =>
    Effect.gen(function* () {
      const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const decide = (runValues: Record<string, unknown>, replies: ReadonlyArray<GhReply>) =>
        decideRun(CiRerunRunnerLossInput.make({ runId: 36763005302, dryRun: true, cwd: "." })).pipe(
          withGh([[RUN_ENDPOINT, 0, runJson(runValues)], ...failedAttemptReplies, ...replies], commands)
        );
      const push = { event: "push", head_branch: "main", pull_requests: [] };
      const tip = "repos/{owner}/{repo}/git/ref/heads/main";
      const current = yield* decide(push, [[tip, 0, encodeJson({ sha: SHA })]]);
      expect(current.reason).toBe("runner-loss");
      const moved = yield* decide(push, [[tip, 0, encodeJson({ sha: NEWER_SHA })]]);
      expect(moved.reason).toBe("superseded-head");
      const scheduled = yield* decide({ event: "schedule" }, []);
      expect(scheduled.reason).toBe("unsupported-event");
      const branchless = yield* decide({ event: "push", head_branch: null }, []);
      expect(branchless.reason).toBe("unsupported-event");
      expect(A.some(yield* Ref.get(commands), (args) => args[0] === "run")).toBe(false);
    })
  );

  layerIt.effect("fails on unreadable GitHub state and on a refused rerun", () =>
    Effect.gen(function* () {
      const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const decide = (replies: ReadonlyArray<GhReply>) =>
        decideRun(CiRerunRunnerLossInput.make({ runId: 36763005302, cwd: "." })).pipe(
          withGh(replies, commands),
          Effect.flip
        );
      const missing = yield* decide([]);
      expect(missing.message).toContain("HTTP 404");
      const garbled = yield* decide([[RUN_ENDPOINT, 0, "{}"]]);
      expect(garbled.message).toContain("Failed to decode workflow run 36763005302.");
      const refused = yield* decide([
        [RUN_ENDPOINT, 0, runJson()],
        ...failedAttemptReplies,
        ["repos/{owner}/{repo}/pulls/1338", 0, pullJson("open", SHA)],
        ["run rerun --job 11", 1, "run 36763005302 cannot be rerun; its workflow is already running"],
      ]);
      expect(refused.message).toContain("gh run rerun --job 11 exited 1");
    })
  );

  // Drives the command through successive attempts of one run. Each attempt
  // lists its jobs; a job that was not re-run is a copy with the original's
  // timestamps and blank annotations, exactly as GitHub reports it.
  const evaluate = (
    attempts: ReadonlyArray<ReadonlyArray<CiWorkflowJob>>,
    lostIds: ReadonlyArray<number>,
    commands: Ref.Ref<ReadonlyArray<ReadonlyArray<string>>>
  ) => {
    const attempt = A.length(attempts);
    const replies: ReadonlyArray<GhReply> = [
      [RUN_ENDPOINT, 0, runJson({ run_attempt: attempt })],
      ...A.map(
        attempts,
        (jobs, index): GhReply => [
          `repos/{owner}/{repo}/actions/runs/36763005302/attempts/${index + 1}/jobs?per_page=100&page=1`,
          0,
          jobsJson(A.length(jobs), jobs),
        ]
      ),
      ...A.map(
        A.flatten(attempts),
        (job): GhReply => [
          annotationsEndpoint(job.id),
          0,
          encodeJson(A.contains(lostIds, job.id) ? [LOST_MESSAGE] : []),
        ]
      ),
      ["repos/{owner}/{repo}/pulls/1338", 0, pullJson("open", SHA)],
      ...A.map(A.flatten(attempts), (job): GhReply => [`run rerun --job ${job.id}`, 0, "✓ Requested"]),
    ];
    return decideRun(CiRerunRunnerLossInput.make({ runId: 36763005302, attempt: O.some(attempt), cwd: "." })).pipe(
      withGh(replies, commands)
    );
  };
  const reruns = (commands: ReadonlyArray<ReadonlyArray<string>>) =>
    A.filter(endpoints(commands), (entry) => entry.startsWith("run rerun"));
  const LINT = "Heavy / Lint Policy";
  const COVERAGE = "Heavy / Coverage Regression";
  const DOCGEN = "Heavy / Docgen";
  const T1 = "2026-09-30T20:00:00Z";

  layerIt.effect("retries three jobs lost in one attempt one at a time across attempts 2 to 4", () =>
    Effect.gen(function* () {
      const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const attempt1 = [attemptJob(11, LINT, 1, T1), attemptJob(12, COVERAGE, 1, T1), attemptJob(13, DOCGEN, 1, T1)];
      const lostIds = [11, 12, 13];
      const first = yield* evaluate([attempt1], lostIds, commands);
      assertSome(
        O.map(first.rerunJob, (job) => job.id),
        11
      );
      // Attempt 2 re-ran Lint Policy (green); the other two are copies whose
      // own annotations are blank, so their verdict comes from attempt 1.
      const attempt2 = [
        attemptJob(21, LINT, 2, "2026-09-30T21:00:00Z", "success"),
        attemptJob(22, COVERAGE, 2, T1),
        attemptJob(23, DOCGEN, 2, T1),
      ];
      const second = yield* evaluate([attempt1, attempt2], lostIds, commands);
      deepStrictEqual(
        A.map(second.lostJobs, (job) => job.id),
        [22, 23]
      );
      assertSome(
        O.map(second.rerunJob, (job) => job.id),
        22
      );
      const attempt3 = [
        attemptJob(31, LINT, 3, "2026-09-30T21:00:00Z", "success"),
        attemptJob(32, COVERAGE, 3, "2026-09-30T22:00:00Z", "success"),
        attemptJob(33, DOCGEN, 3, T1),
      ];
      const third = yield* evaluate([attempt1, attempt2, attempt3], lostIds, commands);
      assertSome(
        O.map(third.rerunJob, (job) => job.id),
        33
      );
      deepStrictEqual(reruns(yield* Ref.get(commands)), [
        "run rerun --job 11",
        "run rerun --job 22",
        "run rerun --job 33",
      ]);
      const called = endpoints(yield* Ref.get(commands));
      expect(A.contains(called, annotationsEndpoint(13))).toBe(true);
    })
  );

  layerIt.effect("stops a job lost three times after its three reruns", () =>
    Effect.gen(function* () {
      const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const attempts = [
        [attemptJob(11, LINT, 1, "2026-09-30T20:00:00Z")],
        [attemptJob(21, LINT, 2, "2026-09-30T21:00:00Z")],
        [attemptJob(31, LINT, 3, "2026-09-30T22:00:00Z")],
        [attemptJob(41, LINT, 4, "2026-09-30T23:00:00Z")],
      ];
      const third = yield* evaluate(A.take(attempts, 3), [11, 21, 31, 41], commands);
      expect(third.reason).toBe("runner-loss");
      expect(A.map(third.lostJobs, (job) => job.reruns)).toEqual([2]);
      const fourth = yield* evaluate(attempts, [11, 21, 31, 41], commands);
      expect(fourth.reason).toBe("job-reruns-exhausted");
      deepStrictEqual(reruns(yield* Ref.get(commands)), ["run rerun --job 31"]);
    })
  );

  layerIt.effect("stops every job at the run ceiling", () =>
    Effect.gen(function* () {
      const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const attempts = A.makeBy(8, (index) => [
        attemptJob(10 * (index + 1) + 1, index === 7 ? DOCGEN : LINT, index + 1, `2026-09-30T1${index}:00:00Z`),
      ]);
      const capped = yield* evaluate(
        attempts,
        A.map(A.flatten(attempts), (job) => job.id),
        commands
      );
      expect(capped.reason).toBe("attempt-cap");
      deepStrictEqual(reruns(yield* Ref.get(commands)), []);
    })
  );

  layerIt.effect("runs through the command with flags and fails visibly on errors", () =>
    Effect.gen(function* () {
      const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      yield* runCommand(["--run-id", "36763005302", "--attempt", "1", "--max-attempt", "2", "--dry-run"]).pipe(
        withGh(
          [
            [RUN_ENDPOINT, 0, runJson()],
            ...failedAttemptReplies,
            ["repos/{owner}/{repo}/pulls/1338", 0, pullJson("open", SHA)],
          ],
          commands
        ),
        withEnv
      );
      expect(yield* logs).toContain("attempt 1 (run ceiling 2, 3 reruns per job)");
      expect(A.some(yield* Ref.get(commands), (args) => args[0] === "run")).toBe(false);

      const exit = yield* runCommand(["--run-id", "1"]).pipe(withGh([], commands), withEnv, Effect.exit);
      expect(exit._tag).toBe("Failure");
      expect(yield* errors).toContain("[ci] gh api repos/{owner}/{repo}/actions/runs/1 exited 1");
    })
  );
  // The workflow runs on `workflow_run`, whose token can write Actions state
  // for any run. It must stay on a hosted runner, read the triggering run only
  // through the API, never check out or execute pull-request code, and
  // receive no secrets.
  layerIt.effect("keeps the workflow on default-branch code with least privilege", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const readYaml = (relative: string) =>
        fs.readFileString(path.join(repoRoot, relative)).pipe(
          Effect.map((text) => {
            const document = parseDocument(text);
            expect(document.errors).toEqual([]);
            return { text, value: document.toJS() };
          })
        );
      const workflow = yield* readYaml(".github/workflows/rerun-runner-loss.yml");
      const check = yield* readYaml(".github/workflows/check.yml");
      const heavyAdmit = yield* readYaml(".github/workflows/heavy-admit.yml");
      expect(workflow.value.on).toEqual({
        workflow_run: { workflows: [check.value.name, heavyAdmit.value.name], types: ["completed"] },
      });
      expect(workflow.value.permissions).toEqual({});
      expect(workflow.value.concurrency["cancel-in-progress"]).toBe(false);
      const job = workflow.value.jobs.rerun;
      expect(job["runs-on"]).toBe("ubuntu-24.04");
      expect(job.if).toContain("github.event.workflow_run.conclusion == 'failure'");
      expect(job.if).toContain("vars.BEEP_RERUN_RUNNER_LOSS != 'false'");
      expect(job.permissions).toEqual({
        actions: "write",
        checks: "read",
        contents: "read",
        "pull-requests": "read",
      });
      expect(job.steps[0].with).toEqual({
        ref: "${{ github.event.repository.default_branch }}",
        "persist-credentials": false,
      });
      expect(job.steps[2].run).toBe('bun run beep ci rerun-runner-loss --run-id "$RUN_ID" --attempt "$RUN_ATTEMPT"');
      const code = pipe(
        Str.split(workflow.text, "\n"),
        A.filter((line) => !Str.startsWith("#")(Str.trim(line))),
        A.join("\n")
      );
      expect(code).not.toContain("secrets.");
      expect(code).not.toContain("workflow_run.head_");
      expect(code).not.toContain("beep-ec2-heavy");
    })
  );
});
