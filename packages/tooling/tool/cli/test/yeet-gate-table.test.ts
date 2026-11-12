import { GithubCommitStatusRecord } from "@beep/repo-cli/test/SharedInternals";
import {
  decideGateTableRow,
  GateTableEntry,
  GateTableRead,
  GateTableReport,
  GateTableThreadsCounted,
  GateTableThreadsNotRead,
  GateTableThreadsUnknown,
  GateTableUnreadable,
  MergeGateCheckRun,
  readGateTable,
  readYeetGateTableAsGhLogin,
  renderGateTableEntry,
  renderGateTableReport,
  YeetReviewWindowElapsed,
  YeetReviewWindowOpen,
  YeetReviewWindowUnknown,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import checkRunsFixture from "./fixtures/yeet-merge-gate/check-runs.json" with { type: "json" };
import checkSuitesFixture from "./fixtures/yeet-merge-gate/check-suites.json" with { type: "json" };
import recordedPull from "./fixtures/yeet-merge-gate/pull.json" with { type: "json" };
import rulesFixture from "./fixtures/yeet-merge-gate/rules.json" with { type: "json" };
import threadsFixture from "./fixtures/yeet-merge-gate/threads.json" with { type: "json" };
import openThreadsFixture from "./fixtures/yeet-merge-gate/threads-open.json" with { type: "json" };
import timelineFixture from "./fixtures/yeet-merge-gate/timeline.json" with { type: "json" };
import { legacyGhAnswer, recordedGithub } from "./support/YeetGithub.ts";
import { rewriteWindowScenario, yeetRealGitTestLayer } from "./support/YeetHeadMove.ts";
import type { GateTableRow } from "@beep/repo-cli/test/Yeet";
import type { GithubAnswer, GithubCall } from "./support/YeetGithub.ts";

const UnknownJson = S.fromJsonString(S.Unknown);
// The 2026-10-06 recording kept only what merge.sh read; the REST record also
// decodes these keys, which GitHub always sends. The PR is replayed as open.
const pullFixture = {
  node_id: "PR_kwDOPbO_N86xxxxx",
  body: null,
  merged: false,
  merged_at: null,
  html_url: "https://github.com/beep-effect/beep-effect/pull/1459",
  labels: [],
  updated_at: "2026-10-06T08:30:00Z",
  ...recordedPull,
  state: "open",
};
const encodeJson = flow(S.encodeUnknownResult(UnknownJson), Result.getOrThrow);

// Recorded 2026-10-06 from merged PR #1459 (head 212fe39b4f): the ruleset's
// required contexts, every check run green, one ready_for_review event.
const requiredContexts = A.flatMap(rulesFixture, (rule) =>
  A.map(rule.parameters.required_status_checks, (check) => check.context)
);
const fixtureRuns = A.map(checkRunsFixture.check_runs, (run) =>
  MergeGateCheckRun.make({ id: run.id, name: run.name, status: run.status, conclusion: run.conclusion })
);
const elapsed = YeetReviewWindowElapsed.make({
  anchor: "head-push",
  anchoredAt: "2026-10-06T08:10:00Z",
  windowMs: 20 * 60 * 1000,
});

const read = (overrides: Partial<Parameters<typeof GateTableRead.make>[0]> = {}) =>
  GateTableRead.make({
    prNumber: 1459,
    draft: false,
    baseRef: "main",
    headRef: "feat/ciops-p2-projection",
    headSha: pullFixture.head.sha,
    mergeableState: "clean",
    labels: ["ready-for-heavy"],
    requiredContexts: O.some(requiredContexts),
    checkRuns: fixtureRuns,
    statuses: O.some([]),
    window: O.some(elapsed),
    threads: GateTableThreadsCounted.make({ outstanding: 0, total: 4 }),
    ...overrides,
  });

const withRun = (name: string, status: string, conclusion: string | null) =>
  A.append(fixtureRuns, MergeGateCheckRun.make({ id: Number.MAX_SAFE_INTEGER, name, status, conclusion }));

const status = (context: string, state: string) => GithubCommitStatusRecord.make({ context, state });

describe("yeet gate-table decision", () => {
  it("meets the gate when every required check is green and the window and threads are clear", () => {
    const row = decideGateTableRow(read());
    expect(row.gateMet).toBe(true);
    expect(row.requiredGreen).toBe(A.length(requiredContexts));
    expect(row.reds).toEqual([]);
    expect(row.pending).toEqual([]);
  });

  it("never meets the gate for an owner-held PR and names the hold", () => {
    const row = decideGateTableRow(read({ labels: ["ready-for-heavy", "owner-merge-hold"] }));
    expect(row.gateMet).toBe(false);
    expect(row.holds).toEqual(["owner-merge-hold"]);
    expect(renderGateTableEntry(row)).toContain("\tHOLD:owner-merge-hold\t");
  });

  it("never meets the gate for a draft, a conflict, or an unreadable ruleset", () => {
    expect(decideGateTableRow(read({ draft: true })).gateMet).toBe(false);
    expect(decideGateTableRow(read({ mergeableState: "dirty" })).gateMet).toBe(false);
    expect(decideGateTableRow(read({ requiredContexts: O.none() })).gateMet).toBe(false);
  });

  it("holds on a required check still running and names it pending", () => {
    const required = requiredContexts[0] ?? "Lint";
    const row = decideGateTableRow(read({ checkRuns: withRun(required, "in_progress", null) }));
    expect(row.gateMet).toBe(false);
    expect(row.pending).toEqual([required]);
  });

  it("holds on a required context with no run at all", () => {
    const row = decideGateTableRow(read({ requiredContexts: O.some(A.append(requiredContexts, "Never Ran")) }));
    expect(row.gateMet).toBe(false);
    expect(row.pending).toContain("Never Ran");
  });

  it("names a completed run GitHub gave no conclusion as a red", () => {
    const row = decideGateTableRow(read({ checkRuns: withRun("Heavy / Coverage Regression", "completed", null) }));
    expect(row.reds).toEqual(["Heavy / Coverage Regression=none"]);
  });

  it("holds on any red check run, required or not, and does not hold on a pending non-required one", () => {
    const red = decideGateTableRow(read({ checkRuns: withRun("Heavy / Coverage Regression", "completed", "failure") }));
    expect(red.gateMet).toBe(false);
    expect(red.reds).toEqual(["Heavy / Coverage Regression=failure"]);
    const pending = decideGateTableRow(read({ checkRuns: withRun("Heavy / Coverage Regression", "queued", null) }));
    expect(pending.gateMet).toBe(true);
  });

  it("holds on a pending commit status and on unreadable statuses, never on a failing one", () => {
    const pending = decideGateTableRow(read({ statuses: O.some([status("Vercel", "pending")]) }));
    expect(pending.gateMet).toBe(false);
    expect(pending.pending).toEqual(["status:Vercel"]);
    const unreadable = decideGateTableRow(read({ statuses: O.none() }));
    expect(unreadable.gateMet).toBe(false);
    expect(unreadable.pending).toEqual(["statuses=?"]);
    const failing = decideGateTableRow(
      read({
        statuses: O.some([status("Vercel – todox", "failure"), status("Docs", "error"), status("CI", "success")]),
      })
    );
    expect(failing.gateMet).toBe(true);
    expect(failing.statusReds).toEqual(["Docs=error", "Vercel – todox=failure"]);
  });

  it("holds while the review window is open or unknown", () => {
    const open = YeetReviewWindowOpen.make({
      anchor: elapsed.anchor,
      anchoredAt: elapsed.anchoredAt,
      windowMs: elapsed.windowMs,
      remainingMs: 61_000,
    });
    expect(decideGateTableRow(read({ window: O.some(open) })).gateMet).toBe(false);
    const unknown = YeetReviewWindowUnknown.make({ reason: "timeline unreadable" });
    expect(decideGateTableRow(read({ window: O.some(unknown) })).gateMet).toBe(false);
  });

  it("holds on outstanding or unreadable threads; a missing count is never zero", () => {
    expect(
      decideGateTableRow(read({ threads: GateTableThreadsCounted.make({ outstanding: 1, total: 4 }) })).gateMet
    ).toBe(false);
    expect(
      decideGateTableRow(read({ threads: GateTableThreadsUnknown.make({ reason: "rate limited" }) })).gateMet
    ).toBe(false);
  });
});

describe("yeet gate-table rendering", () => {
  it("prints the gate.sh columns, one tab apart", () => {
    const line = renderGateTableEntry(decideGateTableRow(read()));
    expect(Str.split(line, "\t")).toEqual([
      "#1459",
      "ready",
      "main",
      Str.slice(0, 10)(pullFixture.head.sha),
      "clean",
      `ok=${A.length(requiredContexts)}/${A.length(requiredContexts)}`,
      "threads=0/4",
      "window=ok",
      "",
      "",
      "",
      "GATE-MET",
      "",
      "branch=feat/ciops-p2-projection",
    ]);
  });

  it("prints a draft's unread columns as dashes and an unknown ruleset as ?", () => {
    const line = renderGateTableEntry(
      decideGateTableRow(
        read({
          draft: true,
          window: O.none(),
          threads: GateTableThreadsNotRead.make({}),
          requiredContexts: O.none(),
          statuses: O.some([status("Vercel", "pending"), status("Vercel – todox", "failure")]),
        })
      )
    );
    expect(Str.split(line, "\t")).toEqual([
      "#1459",
      "DRAFT",
      "main",
      Str.slice(0, 10)(pullFixture.head.sha),
      "clean",
      "ok=?/?",
      "threads=-",
      "window=-",
      "",
      "PENDING:status:Vercel",
      "STATUS-RED:Vercel – todox=failure",
      "",
      "",
      "branch=feat/ciops-p2-projection",
    ]);
  });

  it("prints an unknown review window as ?", () => {
    const unknown = YeetReviewWindowUnknown.make({ reason: "timeline unreadable" });
    expect(renderGateTableEntry(decideGateTableRow(read({ window: O.some(unknown) })))).toContain("\twindow=?\t");
  });

  it("rounds the minutes left up and prints unreadable rows with their reason", () => {
    const open = YeetReviewWindowOpen.make({
      anchor: elapsed.anchor,
      anchoredAt: elapsed.anchoredAt,
      windowMs: elapsed.windowMs,
      remainingMs: 61_000,
    });
    expect(renderGateTableEntry(decideGateTableRow(read({ window: O.some(open) })))).toContain("window=2m");
    expect(renderGateTableEntry(GateTableUnreadable.make({ prNumber: 9, reason: "pulls/9 failed" }))).toBe(
      "#9\tUNREADABLE\tpulls/9 failed"
    );
  });

  it("heads the table with the read instant and the GATE-MET count", () => {
    const report = GateTableReport.make({
      schemaVersion: "yeet-gate-table/v1",
      readAt: DateTime.makeUnsafe("2026-11-06T18:00:00Z"),
      entries: [decideGateTableRow(read()), GateTableUnreadable.make({ prNumber: 9, reason: "x" })],
    });
    expect(Str.split(renderGateTableReport(report), "\n")[0]).toBe(
      "# gate-table 2026-11-06T18:00:00.000Z: 2 open PR(s), 1 GATE-MET"
    );
  });
});

// --- Recorded read ----------------------------------------------------------

const draftSha = "d1d1d1d1d1000000000000000000000000000000";
const draftPull = { ...pullFixture, number: 1460, draft: true, head: { ...pullFixture.head, sha: draftSha } };
const brokenPull = { ...pullFixture, number: 1461, head: { ...pullFixture.head, sha: "b0b0b0b0b0" } };
// "Now" past the recorded review window: ready 08:00:52Z, head suites from 10:35:21Z.
const windowClosed = DateTime.makeUnsafe("2026-10-06T11:00:00Z");

interface Script {
  readonly detail?: unknown;
  readonly pulls: ReadonlyArray<unknown>;
  readonly rulesFail?: boolean;
  readonly statuses: unknown;
  readonly threads: unknown;
  readonly threadsFail?: boolean;
}

// Every REST path the read makes, by repository-relative path; anything else is a 404.
const restRoutes = (script: Script): Readonly<Record<string, GithubAnswer>> => ({
  "{repo}/pulls": { body: script.pulls },
  "{repo}/pulls/1459": { body: script.detail ?? pullFixture },
  "{repo}/pulls/1460": { body: draftPull },
  "{repo}/rules/branches/main": script.rulesFail === true ? { status: 500, body: {} } : { body: rulesFixture },
  [`{repo}/commits/${pullFixture.head.sha}/check-runs`]: { body: checkRunsFixture },
  [`{repo}/commits/${draftSha}/check-runs`]: { body: { total_count: 0, check_runs: [] } },
  [`{repo}/commits/${pullFixture.head.sha}/status`]: { body: script.statuses },
  [`{repo}/commits/${draftSha}/status`]: { body: script.statuses },
  "{repo}/issues/1459/timeline": { body: timelineFixture },
  [`{repo}/commits/${pullFixture.head.sha}/check-suites`]: { body: checkSuitesFixture },
});

const answer = (script: Script, call: GithubCall): GithubAnswer | undefined =>
  O.isSome(call.graphql)
    ? script.threadsFail === true
      ? { status: 502, body: { message: "Bad Gateway" } }
      : legacyGhAnswer({ call, exitCode: 0, output: encodeJson(script.threads) })
    : O.getOrUndefined(R.get(restRoutes(script), call.path));

const runRead = (script: Script) =>
  windowClosed.pipe(
    DateTime.toEpochMillis,
    TestClock.setTime,
    Effect.andThen(Effect.sync(() => recordedGithub((call) => answer(script, call)))),
    Effect.flatMap((github) => github.provide(readGateTable()).pipe(Effect.map((report) => ({ report, github }))))
  );

const noStatuses = { total_count: 0, statuses: [] };

// The decided row at an index; an unreadable entry there fails the test.
const rowAt = (report: GateTableReport, index: number): GateTableRow =>
  O.getOrThrow(O.filter(A.get(report.entries, index), GateTableEntry.guards.row));

describe("yeet gate-table recorded read", () => {
  it.effect("reads every open PR, decides each row, and reads threads only out of draft", () =>
    Effect.gen(function* () {
      const { report, github } = yield* runRead({
        pulls: [draftPull, pullFixture],
        threads: threadsFixture,
        statuses: noStatuses,
      });
      expect(A.map(report.entries, (entry) => (entry._tag === "row" ? entry.read.prNumber : entry.prNumber))).toEqual([
        1459, 1460,
      ]);
      const ready = rowAt(report, 0);
      const draft = rowAt(report, 1);
      expect(ready.gateMet).toBe(true);
      expect(ready.read.threads).toEqual(GateTableThreadsCounted.make({ outstanding: 0, total: 4 }));
      expect(draft.read.threads._tag).toBe("not-read");
      assertNone(draft.read.window);
      // One ruleset read for the one base, one thread read for the one ready PR.
      expect(A.length(A.filter(github.calls, (call) => call.path === "{repo}/rules/branches/main"))).toBe(1);
      expect(A.length(A.filter(github.calls, (call) => O.isSome(call.graphql)))).toBe(1);
    })
  );

  it.effect("counts outstanding threads with the merge gate's rule", () =>
    Effect.gen(function* () {
      const { report } = yield* runRead({ pulls: [pullFixture], threads: openThreadsFixture, statuses: noStatuses });
      const row = rowAt(report, 0);
      expect(row.read.threads).toEqual(GateTableThreadsCounted.make({ outstanding: 4, total: 4 }));
      expect(row.gateMet).toBe(false);
    })
  );

  it.effect("an unreadable ruleset prints ok=?/? and a PR whose reads fail is listed as unreadable", () =>
    Effect.gen(function* () {
      const { report } = yield* runRead({
        pulls: [pullFixture, brokenPull],
        threads: threadsFixture,
        statuses: noStatuses,
        rulesFail: true,
      });
      const row = rowAt(report, 0);
      assertNone(row.read.requiredContexts);
      expect(row.gateMet).toBe(false);
      expect(report.entries[1]?._tag).toBe("unreadable");
    })
  );

  it.effect("a pull GitHub has not computed mergeability for reads as unknown", () =>
    Effect.gen(function* () {
      const { report } = yield* runRead({
        pulls: [pullFixture],
        detail: { ...pullFixture, mergeable_state: null },
        threads: threadsFixture,
        statuses: noStatuses,
      });
      expect(rowAt(report, 0).read.mergeableState).toBe("unknown");
    })
  );

  it.effect("a failed thread read is threads=? and never zero", () =>
    Effect.gen(function* () {
      const { report } = yield* runRead({
        pulls: [pullFixture],
        threads: threadsFixture,
        statuses: noStatuses,
        threadsFail: true,
      });
      const row = rowAt(report, 0);
      expect(row.read.threads._tag).toBe("unknown");
      expect(row.gateMet).toBe(false);
      expect(renderGateTableEntry(row)).toContain("threads=?");
    })
  );

  it.effect("more status contexts than one page reads as unreadable statuses, which holds", () =>
    Effect.gen(function* () {
      const { report } = yield* runRead({
        pulls: [pullFixture],
        threads: threadsFixture,
        statuses: { total_count: 101, statuses: [{ context: "Vercel", state: "success" }] },
      });
      const row = rowAt(report, 0);
      assertNone(row.read.statuses);
      expect(row.pending).toEqual(["statuses=?"]);
    })
  );
});

it.layer(yeetRealGitTestLayer, {
  timeout: "120 seconds",
})("gate-table classifier seam", (it) => {
  it.effect("carries through the command's shared gh-login boundary", () =>
    Effect.gen(function* () {
      const scenario = yield* rewriteWindowScenario();
      yield* DateTime.makeUnsafe("2026-11-10T02:50:00Z").pipe(DateTime.toEpochMillis, TestClock.setTime);
      const report = yield* readYeetGateTableAsGhLogin(scenario.context).pipe(scenario.github.provide);
      const row = rowAt(report, 0);
      expect(O.getOrThrow(row.read.window)).toMatchObject({ _tag: "elapsed", anchor: "ready-for-review" });
    })
  );
});
