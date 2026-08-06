import {
  detectYeetMonitorFlakeClass,
  emptyYeetMonitorRerunBudget,
  planYeetMonitorReruns,
  renderYeetMonitorJobDecision,
  stripYeetMonitorLogDecoration,
  YeetMonitorFailedJob,
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

const failedJob = (databaseId: number, name: string, flakeClass: O.Option<"ts2589-no-location" | "ci-timeout">) =>
  YeetMonitorFailedJob.make({ databaseId, name, flakeClass });

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
