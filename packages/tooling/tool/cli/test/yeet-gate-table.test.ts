import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import { GithubCommitStatusRecord } from "@beep/repo-cli/test/SharedInternals";
import {
  decideGateTableRow,
  GateTableCommandOptions,
  GateTableRead,
  GateTableReport,
  GateTableReportJson,
  GateTableThreadsCounted,
  GateTableThreadsNotRead,
  GateTableThreadsUnknown,
  GateTableUnreadable,
  MergeGateCheckRun,
  readGateTable,
  renderGateTableEntry,
  renderGateTableReport,
  runYeetGateTable,
  YeetReviewWindowElapsed,
  YeetReviewWindowOpen,
  YeetReviewWindowUnknown,
} from "@beep/repo-cli/test/Yeet";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import checkRunsFixture from "./fixtures/yeet-merge-gate/check-runs.json" with { type: "json" };
import checkSuitesFixture from "./fixtures/yeet-merge-gate/check-suites.json" with { type: "json" };
import recordedPull from "./fixtures/yeet-merge-gate/pull.json" with { type: "json" };
import rulesFixture from "./fixtures/yeet-merge-gate/rules.json" with { type: "json" };
import threadsFixture from "./fixtures/yeet-merge-gate/threads.json" with { type: "json" };
import openThreadsFixture from "./fixtures/yeet-merge-gate/threads-open.json" with { type: "json" };
import timelineFixture from "./fixtures/yeet-merge-gate/timeline.json" with { type: "json" };
import { provideSpawner } from "./support/ScriptedProcess.ts";
import { legacyGhAnswer, recordedGithub } from "./support/YeetGithub.ts";
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
  readonly pulls: ReadonlyArray<unknown>;
  readonly rulesFail?: boolean;
  readonly statuses: unknown;
  readonly threads: unknown;
}

const answer = (script: Script, call: GithubCall): GithubAnswer | undefined => {
  if (O.isSome(call.graphql)) {
    return legacyGhAnswer({ call, exitCode: 0, output: encodeJson(script.threads) });
  }
  const path = call.path;
  if (path === "{repo}/pulls") return { body: script.pulls };
  if (path === "{repo}/pulls/1459") return { body: pullFixture };
  if (path === "{repo}/pulls/1460") return { body: draftPull };
  if (path === "{repo}/rules/branches/main")
    return script.rulesFail === true ? { status: 500, body: {} } : { body: rulesFixture };
  if (path === `{repo}/commits/${pullFixture.head.sha}/check-runs`) return { body: checkRunsFixture };
  if (path === `{repo}/commits/${draftSha}/check-runs`) return { body: { total_count: 0, check_runs: [] } };
  if (Str.endsWith("/status")(path)) return { body: script.statuses };
  if (path === "{repo}/issues/1459/timeline") return { body: timelineFixture };
  if (path === `{repo}/commits/${pullFixture.head.sha}/check-suites`) return { body: checkSuitesFixture };
  return undefined;
};

const runRead = (script: Script) =>
  windowClosed.pipe(
    DateTime.toEpochMillis,
    TestClock.setTime,
    Effect.andThen(Effect.sync(() => recordedGithub((call) => answer(script, call)))),
    Effect.flatMap((github) => github.provide(readGateTable()).pipe(Effect.map((report) => ({ report, github }))))
  );

const noStatuses = { total_count: 0, statuses: [] };

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
      const [ready, draft] = report.entries;
      expect(ready?._tag === "row" && ready.gateMet).toBe(true);
      expect(ready?._tag === "row" && ready.read.threads).toEqual(
        GateTableThreadsCounted.make({ outstanding: 0, total: 4 })
      );
      expect(draft?._tag === "row" && draft.read.threads._tag).toBe("not-read");
      expect(draft?._tag === "row" && O.isNone(draft.read.window)).toBe(true);
      // One ruleset read for the one base, one thread read for the one ready PR.
      expect(A.length(A.filter(github.calls, (call) => call.path === "{repo}/rules/branches/main"))).toBe(1);
      expect(A.length(A.filter(github.calls, (call) => O.isSome(call.graphql)))).toBe(1);
    })
  );

  it.effect("counts outstanding threads with the merge gate's rule", () =>
    Effect.gen(function* () {
      const { report } = yield* runRead({ pulls: [pullFixture], threads: openThreadsFixture, statuses: noStatuses });
      const [row] = report.entries;
      expect(row?._tag === "row" && row.read.threads).toEqual(
        GateTableThreadsCounted.make({ outstanding: 4, total: 4 })
      );
      expect(row?._tag === "row" && row.gateMet).toBe(false);
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
      const [row, broken] = report.entries;
      expect(row?._tag === "row" && O.isNone(row.read.requiredContexts)).toBe(true);
      expect(row?._tag === "row" && row.gateMet).toBe(false);
      expect(broken?._tag).toBe("unreadable");
    })
  );

  it.effect("more status contexts than one page reads as unreadable statuses, which holds", () =>
    Effect.gen(function* () {
      const { report } = yield* runRead({
        pulls: [pullFixture],
        threads: threadsFixture,
        statuses: { total_count: 101, statuses: [{ context: "Vercel", state: "success" }] },
      });
      const [row] = report.entries;
      expect(row?._tag === "row" && O.isNone(row.read.statuses)).toBe(true);
      expect(row?._tag === "row" && row.pending).toEqual(["statuses=?"]);
    })
  );
});

// `Git` rides beside the platform services: the read-only context resolves the repo root through it.
const gitLayer = Git.layer.pipe(Layer.provide(NodeServices.layer));
// Every git probe the read-only context makes answers as a clean feature branch.
const scriptedGit = ScriptedSpawner.make(() => ({ stdout: "feat/gate\n", exit: 0 }));

const runCommand = (json: boolean) =>
  windowClosed.pipe(
    DateTime.toEpochMillis,
    TestClock.setTime,
    Effect.andThen(
      runYeetGateTable(
        GateTableCommandOptions.make({ base: "origin/main", head: "HEAD", packetDir: ".beep/yeet", json })
      ).pipe(
        recordedGithub((call) => answer({ pulls: [pullFixture], threads: threadsFixture, statuses: noStatuses }, call))
          .provide,
        Effect.provideServiceEffect(Git, Git.make),
        provideSpawner(scriptedGit)
      )
    ),
    Effect.andThen(TestConsole.logLines),
    Effect.map((lines) => A.join(A.map(lines, String), "\n"))
  );

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer, TestConsole.layer), { timeout: "30 seconds" })(
  "yeet gate-table command",
  (it) => {
    it.effect("prints the table under the recorded login", () =>
      runCommand(false).pipe(
        Effect.map((printed) => {
          expect(printed).toContain("# gate-table 2026-10-06T11:00:00.000Z: 1 open PR(s), 1 GATE-MET");
          expect(printed).toContain("#1459\tready\tmain");
        })
      )
    );

    it.effect("emits the yeet-gate-table/v1 report with --json", () =>
      runCommand(true).pipe(
        // The layer's console keeps earlier tests' lines; the report is the last one.
        Effect.flatMap((printed) => GateTableReportJson.decode(A.lastNonEmpty(Str.split(printed, "\n")))),
        Effect.map((report) => expect(A.length(report.entries)).toBe(1))
      )
    );
  }
);
