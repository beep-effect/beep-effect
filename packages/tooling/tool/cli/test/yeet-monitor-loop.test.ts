import {
  detectGithubJobShapeClass,
  GithubJobRecord,
  GithubJobShapeClass,
  GithubJobStepRecord,
  githubJobShapeEvidence,
} from "@beep/repo-cli/test/SharedInternals";
import {
  detectYeetMonitorFlakeClass,
  emptyYeetMonitorRerunBudget,
  planYeetMonitorReruns,
  renderYeetMonitorJobDecision,
  stripYeetMonitorLogDecoration,
  YeetMonitorFailedJob,
  YeetMonitorFlakeClass,
  yeetMonitorRerunCommand,
  yeetMonitorRerunKey,
  yeetMonitorTerminalState,
} from "@beep/repo-cli/test/Yeet";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { HashSet } from "effect";
import * as O from "effect/Option";

// `gh run view --job <id> --log-failed` emits `<job>\t<step>\t<timestamp> <line>`
// and sometimes an `##[error]` workflow-command marker. These fixtures keep that
// decoration so the detectors are exercised on the shape they actually receive.
const ghLog = (jobName: string, stepName: string, lines: ReadonlyArray<string>): string =>
  A.join(
    A.map(
      lines,
      (line, index) => `${jobName}\t${stepName}\t2026-08-04T12:00:${`${index}`.padStart(2, "0")}.1234567Z ${line}`
    ),
    "\n"
  );

const ts2589FlakeLog = ghLog("Check", "Run bun run check", [
  "##[group]Run bun run check",
  "@beep/box:build: error TS2589: Type instantiation is excessively deep and possibly infinite.",
  "Failed:    @beep/box#build",
]);

const locatedTs2589Log = ghLog("Check", "Run bun run check", [
  "@beep/box:build: src/Box.ts(12,3): error TS2589: Type instantiation is excessively deep and possibly infinite.",
  "Failed:    @beep/box#build",
]);

const genuineTypeErrorLog = ghLog("Check", "Run bun run check", [
  "@beep/ui:check: src/Panel.tsx(3,5): error TS2322: Type 'string' is not assignable to type 'number'.",
  "Failed:    @beep/ui#check",
]);

const suiteTimeoutLog = ghLog("Test Unit", "Run vitest", [
  "FAIL packages/ontology/use-cases/test/SchemaParity.test.ts",
  "Error: Test timed out in 30000ms.",
]);

const jobTimeoutLog = ghLog("Test Unit", "Complete job", [
  "##[error]The job running on runner ubuntu-latest has exceeded the maximum execution time of 60 minutes.",
]);

const cancelledSiblingLog = ghLog("Test Unit", "Run vitest", ["##[error]The operation was canceled."]);

// Mirrors main Build job 95216658480 (2026-08-16): the torn cross-package read
// that existed while tsc -b/tsgo -b subgraph builds could rewrite a sibling's
// dist. The single-project emit law removed every cross-package writer, so
// this signature must classify as needs-code-fix, not as a rerunnable flake.
const ts2306TornReadLog = ghLog("Build", "Run bun run beep ci lane build", [
  "##[error]../../foundation/modeling/schema/src/Cuid.ts(10,27): error TS2306: File '/opt/actions-runner/_work/beep-effect/beep-effect/packages/foundation/modeling/utils/src/DateTime.ts' is not a module.",
  "##[error]../../foundation/modeling/schema/src/Cuid.ts(187,19): error TS377030: This has unknown in the requirements channel and unknown in the error channel which is not recommended.",
  "##[error]command (/opt/actions-runner/_work/beep-effect/beep-effect/packages/ontology/config) /home/ec2-user/.bun/bin/bun run build exited (2)",
  "Failed:    @beep/ontology-config#build",
]);

const failedJob = (databaseId: number, name: string, flakeClass: O.Option<YeetMonitorFlakeClass>) =>
  YeetMonitorFailedJob.make({ databaseId, name, flakeClass });

// `gh run view --json jobs` reports every step of a job, and a step that never
// reached a terminal state carries `conclusion: null`. These fixtures keep the
// nulls so the shape detectors see the record they actually receive.
const jobStep = (name: string, conclusion: string | null) => GithubJobStepRecord.make({ name, conclusion });

const jobRecord = (
  conclusion: string | null,
  steps: ReadonlyArray<GithubJobStepRecord>,
  name = "Test Unit",
  databaseId = 991
) => GithubJobRecord.make({ conclusion, databaseId, name, status: "completed", steps });

describe("yeet monitor flake fingerprints", () => {
  it("strips the job, step, timestamp, and workflow-command decoration from a log line", () => {
    expect(stripYeetMonitorLogDecoration("Check\tRun bun\t2026-08-04T12:00:00.1234567Z ##[error]boom")).toBe("boom");
  });

  it("recognizes the no-location TS2589 signature through GitHub log decoration", () => {
    expect(detectYeetMonitorFlakeClass(ts2589FlakeLog)).toStrictEqual(O.some("ts2589-no-location"));
  });

  it("refuses a TS2589 that carries a file location", () => {
    // A located TS2589 is a real depth problem in a real file, not the
    // scheduling-dependent instantiation-count flake.
    expect(detectYeetMonitorFlakeClass(locatedTs2589Log)).toStrictEqual(O.none());
  });

  it("refuses an ordinary type error", () => {
    expect(detectYeetMonitorFlakeClass(genuineTypeErrorLog)).toStrictEqual(O.none());
  });

  it("recognizes both suite-level and job-level timeouts", () => {
    expect(detectYeetMonitorFlakeClass(suiteTimeoutLog)).toStrictEqual(O.some("ci-timeout"));
    expect(detectYeetMonitorFlakeClass(jobTimeoutLog)).toStrictEqual(O.some("ci-timeout"));
  });

  it("refuses a bare cancellation", () => {
    // A job cancelled because a sibling failed carries no timeout evidence;
    // classifying it would spend a rerun on a fail-fast side effect.
    expect(detectYeetMonitorFlakeClass(cancelledSiblingLog)).toStrictEqual(O.none());
  });

  it("refuses the retired torn-read TS2306 signature", () => {
    // Retired with the single-project emit law: no build can tear a sibling's
    // dist anymore, so a TS2306 is a genuine defect and must not buy a rerun.
    expect(detectYeetMonitorFlakeClass(ts2306TornReadLog)).toStrictEqual(O.none());
  });
});

describe("yeet monitor job-shape fingerprints", () => {
  it("recognizes a control-plane setup failure from the job record alone", () => {
    // "Set up job" is GitHub's implicit setup step. When it concludes failure,
    // action download info never resolved and zero repo commands ran, so a
    // rerun cannot paper over branch state.
    const job = jobRecord("failure", [jobStep("Set up job", "failure"), jobStep("Run bun run test", null)]);

    expect(detectGithubJobShapeClass(job)).toStrictEqual(O.some("setup-5xx"));
  });

  it("recognizes the setup failure under the runner-setup step name too", () => {
    expect(detectGithubJobShapeClass(jobRecord("failure", [jobStep("Set up runner", "failure")]))).toStrictEqual(
      O.some("setup-5xx")
    );
  });

  it("recognizes runner loss when the job failed and no step ever concluded", () => {
    const job = jobRecord("failure", [jobStep("Set up job", null), jobStep("Run bun run test", null)]);

    expect(detectGithubJobShapeClass(job)).toStrictEqual(O.some("runner-loss"));
  });

  it("refuses runner loss when any step reached a conclusion", () => {
    // A job whose setup succeeded and whose lane then failed is an ordinary
    // red: the runner was present for the whole job.
    const job = jobRecord("failure", [jobStep("Set up job", "success"), jobStep("Run bun run test", "failure")]);

    expect(detectGithubJobShapeClass(job)).toStrictEqual(O.none());
  });

  it("refuses a job with no steps rather than reading absent evidence as runner loss", () => {
    // An empty `steps` list is missing evidence, not evidence of absence.
    expect(detectGithubJobShapeClass(jobRecord("failure", []))).toStrictEqual(O.none());
  });

  it("refuses a cancelled job, whose steps are null for a reason that is not runner loss", () => {
    // Fail-fast cancellation leaves exactly the runner-loss step shape, so the
    // job-level conclusion is what separates them.
    const job = jobRecord("cancelled", [jobStep("Set up job", null), jobStep("Run bun run test", null)]);

    expect(detectGithubJobShapeClass(job)).toStrictEqual(O.none());
  });

  it("refuses a job that has not concluded at all", () => {
    expect(detectGithubJobShapeClass(jobRecord(null, [jobStep("Set up job", null)]))).toStrictEqual(O.none());
  });

  it("prefers the setup class when a failed setup step coexists with unconcluded steps", () => {
    // Both shapes are present; the setup step is the more specific evidence and
    // names the actual remedy in the operator line.
    const job = jobRecord("failure", [jobStep("Set up job", "failure"), jobStep("Complete job", null)]);

    expect(detectGithubJobShapeClass(job)).toStrictEqual(O.some("setup-5xx"));
  });

  it("recognizes an install step that failed before any lane ran", () => {
    // Live instance: keytar's prebuild download timed out, node-gyp took over,
    // and the source build died on absent libsecret-1-dev headers. The trigger
    // is a network flake; the environment gap only converts it to red.
    const job = jobRecord("failure", [
      jobStep("Set up job", "success"),
      jobStep("Install dependencies", "failure"),
      jobStep("Run bun run codegen", null),
    ]);

    expect(detectGithubJobShapeClass(job)).toStrictEqual(O.some("install-failure"));
  });

  it("still recognizes an install failure past GitHub's own cleanup steps", () => {
    // `Post <action>` unwinds and `Complete job` conclude success even on a job
    // that died at install, so treating them as "a later step ran" would refuse
    // every real install failure.
    const job = jobRecord("failure", [
      jobStep("Install dependencies", "failure"),
      jobStep("Run bun run codegen", "skipped"),
      jobStep("Post Set up job", "success"),
      jobStep("Complete job", "success"),
    ]);

    expect(detectGithubJobShapeClass(job)).toStrictEqual(O.some("install-failure"));
  });

  it("refuses an install failure when a lane afterwards actually ran", () => {
    // If a lane concluded after the install step, the job got past install and
    // the red belongs to that lane, not to the installer.
    const job = jobRecord("failure", [
      jobStep("Install dependencies", "failure"),
      jobStep("Run bun run codegen", "failure"),
    ]);

    expect(detectGithubJobShapeClass(job)).toStrictEqual(O.none());
  });

  it("prefers the setup class over the install class when setup is what failed", () => {
    // A setup failure leaves install null, so an unordered check would let the
    // vaguer class shadow the precise one.
    const job = jobRecord("failure", [jobStep("Set up job", "failure"), jobStep("Install dependencies", null)]);

    expect(detectGithubJobShapeClass(job)).toStrictEqual(O.some("setup-5xx"));
  });

  it("carries every shape class into the rerun plan with its evidence", () => {
    const plan = planYeetMonitorReruns(emptyYeetMonitorRerunBudget, "abc123", [
      failedJob(991, "Test Unit", O.some("setup-5xx")),
      failedJob(992, "Check", O.some("runner-loss")),
      failedJob(993, "Codegen Drift", O.some("install-failure")),
    ]);
    const rendered = A.map(plan.decisions, renderYeetMonitorJobDecision);

    expect(A.map(plan.decisions, (decision) => decision.status)).toStrictEqual(["rerun", "rerun", "rerun"]);
    expect(rendered[0]).toContain("setup-5xx flake fingerprint matched");
    expect(rendered[1]).toContain("runner-loss flake fingerprint matched");
    expect(rendered[2]).toContain("install-failure flake fingerprint matched");
    // Shape classes carry the observed mechanism, because the class name alone
    // does not tell an operator whether to investigate or wait out the rerun.
    expect(rendered[2]).toContain("keytar prebuild download timeout");
    expect(githubJobShapeEvidence("runner-loss")).toContain("stopped reporting");
  });

  it("leaves a log fingerprint's operator line free of shape evidence", () => {
    const plan = planYeetMonitorReruns(emptyYeetMonitorRerunBudget, "abc123", [
      failedJob(991, "Check", O.some("ts2589-no-location")),
    ]);

    expect(renderYeetMonitorJobDecision(plan.decisions[0]!)).toBe(
      "[yeet] Check: ts2589-no-location flake fingerprint matched; rerunning once -> gh run rerun --job 991"
    );
  });

  it("keeps every fingerprint the loop knows in one domain", () => {
    expect(YeetMonitorFlakeClass.Options).toStrictEqual([
      "ts2589-no-location",
      "ci-timeout",
      "setup-5xx",
      "runner-loss",
      "install-failure",
    ]);
    // Every shape class the shared detector can return must be a class the loop
    // can act on, or a match would decode into a domain that rejects it.
    expect(A.every(GithubJobShapeClass.Options, (option) => A.contains(YeetMonitorFlakeClass.Options, option))).toBe(
      true
    );
  });
});

describe("yeet monitor rerun budget", () => {
  it("approves the first rerun and refuses the second for the same job at the same SHA", () => {
    const job = failedJob(991, "Check", O.some("ts2589-no-location"));
    const first = planYeetMonitorReruns(emptyYeetMonitorRerunBudget, "abc123", [job]);
    const second = planYeetMonitorReruns(first.budget, "abc123", [job]);

    expect(first.decisions).toHaveLength(1);
    expect(first.decisions[0]?.status).toBe("rerun");
    expect(second.decisions[0]?.status).toBe("rerun-spent");
  });

  it("scopes the rerun command to the job so coexisting genuine reds are never re-executed", () => {
    const plan = planYeetMonitorReruns(emptyYeetMonitorRerunBudget, "abc123", [
      failedJob(991, "Check", O.some("ci-timeout")),
    ]);
    const decision = plan.decisions[0];

    expect(decision?.status).toBe("rerun");
    expect(decision?.status === "rerun" ? decision.command : "").toBe("gh run rerun --job 991");
    expect(decision?.status === "rerun" ? decision.command : "").not.toContain("--failed");
  });

  it("refuses the rerun's own attempt, which reports the same job under a new databaseId", () => {
    // `gh run rerun --job <id>` starts a new workflow-run attempt, and job
    // records are per-attempt: the same logical job comes back with a fresh
    // `databaseId` at the unchanged head SHA. Keyed on the id the budget would
    // miss here and approve reruns forever, so the key is the job name.
    const firstAttempt = failedJob(991, "Check", O.some("ts2589-no-location"));
    const secondAttempt = failedJob(1042, "Check", O.some("ts2589-no-location"));
    const first = planYeetMonitorReruns(emptyYeetMonitorRerunBudget, "abc123", [firstAttempt]);
    const second = planYeetMonitorReruns(first.budget, "abc123", [secondAttempt]);

    expect(first.decisions[0]?.status).toBe("rerun");
    expect(second.decisions[0]?.status).toBe("rerun-spent");
    // The refusal still names the id it saw, so the operator can find the job.
    expect(second.decisions[0]?.databaseId).toBe(1042);
    expect(HashSet.size(second.budget)).toBe(1);
  });

  it("keeps distinct job names on separate allowances across attempts", () => {
    // Name-keying must not over-collapse: a different red job at the same SHA
    // still gets its own single rerun even when its id happens to be adjacent.
    const first = planYeetMonitorReruns(emptyYeetMonitorRerunBudget, "abc123", [
      failedJob(991, "Check", O.some("ts2589-no-location")),
    ]);
    const second = planYeetMonitorReruns(first.budget, "abc123", [failedJob(1042, "Test Unit", O.some("ci-timeout"))]);

    expect(second.decisions[0]?.status).toBe("rerun");
    expect(HashSet.size(second.budget)).toBe(2);
  });

  it("spends one rerun per job rather than one per wave", () => {
    const plan = planYeetMonitorReruns(emptyYeetMonitorRerunBudget, "abc123", [
      failedJob(991, "Check", O.some("ts2589-no-location")),
      failedJob(992, "Test Unit", O.some("ci-timeout")),
    ]);

    expect(A.map(plan.decisions, (decision) => decision.status)).toStrictEqual(["rerun", "rerun"]);
  });

  it("grants a fresh allowance to the same job after a new head SHA lands", () => {
    const job = failedJob(991, "Check", O.some("ci-timeout"));
    const spent = planYeetMonitorReruns(emptyYeetMonitorRerunBudget, "abc123", [job]);
    const afterPush = planYeetMonitorReruns(spent.budget, "def456", [job]);

    expect(afterPush.decisions[0]?.status).toBe("rerun");
  });

  it("reports an unfingerprinted red as needing a code fix and never spends budget on it", () => {
    const job = failedJob(993, "Check", O.none());
    const first = planYeetMonitorReruns(emptyYeetMonitorRerunBudget, "abc123", [job]);
    const second = planYeetMonitorReruns(first.budget, "abc123", [job]);

    expect(first.decisions[0]?.status).toBe("needs-code-fix");
    expect(second.decisions[0]?.status).toBe("needs-code-fix");
    expect(first.budget).toStrictEqual(emptyYeetMonitorRerunBudget);
  });

  it("keys the budget on the SHA and job name while the command stays id-scoped", () => {
    // Idempotency key and execution target are deliberately different
    // identifiers: the name survives a rerun's new attempt, the id is the only
    // thing `gh run rerun --job` accepts.
    expect(yeetMonitorRerunKey("abc123", "Check")).toBe("abc123#Check");
    expect(yeetMonitorRerunKey("abc123", "Check")).not.toContain("991");
    expect(yeetMonitorRerunCommand(991)).toBe("gh run rerun --job 991");
  });
});

describe("yeet monitor loop control", () => {
  it("reads the terminal state out of a gh pr view state string", () => {
    expect(yeetMonitorTerminalState(O.some("MERGED"))).toStrictEqual(O.some("merged"));
    expect(yeetMonitorTerminalState(O.some("closed"))).toStrictEqual(O.some("closed"));
    expect(yeetMonitorTerminalState(O.some("OPEN"))).toStrictEqual(O.none());
    expect(yeetMonitorTerminalState(O.none())).toStrictEqual(O.none());
  });

  it("renders each decision so the operator sees the classification, not a bare exit", () => {
    const plan = planYeetMonitorReruns(emptyYeetMonitorRerunBudget, "abc123", [
      failedJob(991, "Check", O.some("ts2589-no-location")),
      failedJob(993, "Coverage", O.none()),
    ]);
    const rendered = A.map(plan.decisions, renderYeetMonitorJobDecision);

    expect(rendered[0]).toContain("ts2589-no-location flake fingerprint matched");
    expect(rendered[0]).toContain("gh run rerun --job 991");
    expect(rendered[1]).toContain("needs code fix");
  });
});
