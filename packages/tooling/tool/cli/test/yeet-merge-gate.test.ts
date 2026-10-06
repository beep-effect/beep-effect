import {
  decideMergeGate,
  MERGE_GATE_REVIEW_WINDOW_SECONDS,
  MergeGateCheckRun,
  MergeGateHold,
  MergeGateRead,
  MergeGateTolerance,
  parseMergeGateTolerance,
  RepoRunContext,
  readMergeGate,
  renderMergeGateDecision,
  runMergeGate,
} from "@beep/repo-cli/test/Yeet";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import checkRunsFixture from "./fixtures/yeet-merge-gate/check-runs.json" with { type: "json" };
import commitFixture from "./fixtures/yeet-merge-gate/commit.json" with { type: "json" };
import pullFixture from "./fixtures/yeet-merge-gate/pull.json" with { type: "json" };
import rulesFixture from "./fixtures/yeet-merge-gate/rules.json" with { type: "json" };
import threadsFixture from "./fixtures/yeet-merge-gate/threads.json" with { type: "json" };
import timelineFixture from "./fixtures/yeet-merge-gate/timeline.json" with { type: "json" };
import type { MergeGateOptions } from "@beep/repo-cli/test/Yeet";

// Recorded 2026-10-06 from merged PR #1459 (head 212fe39b4f): 16 required
// contexts on main, all 33 check runs green, one ready_for_review event, zero
// review threads. No test here talks to GitHub.
const headSha = pullFixture.head.sha;
const requiredContexts = A.flatMap(rulesFixture, (rule) =>
  A.map(rule.parameters.required_status_checks, (check) => check.context)
);
const fixtureRuns = A.map(checkRunsFixture.check_runs, (run) =>
  MergeGateCheckRun.make({ id: run.id, name: run.name, status: run.status, conclusion: run.conclusion })
);
const readyAt = DateTime.makeUnsafe(timelineFixture[0]?.created_at ?? "2026-10-06T08:00:52Z");
const headCommittedAt = DateTime.makeUnsafe(commitFixture.commit.committer.date);
const windowClosed = DateTime.add(DateTime.max(readyAt, headCommittedAt), { minutes: 21 });

const read = (overrides: Partial<ConstructorParameters<typeof MergeGateRead>[0]> = {}) =>
  MergeGateRead.make({
    prNumber: pullFixture.number,
    title: pullFixture.title,
    headSha,
    draft: false,
    mergeableState: "clean",
    createdAt: DateTime.makeUnsafe(pullFixture.created_at),
    requiredContexts: O.some(requiredContexts),
    checkRuns: fixtureRuns,
    readyAt: O.some(readyAt),
    headCommittedAt: O.some(headCommittedAt),
    unresolvedThreads: O.some(0),
    readAt: windowClosed,
    ...overrides,
  });

const options = (overrides: Partial<MergeGateOptions> = {}): MergeGateOptions => ({
  wantSha: headSha.slice(0, 10),
  now: windowClosed,
  tolerate: [],
  forceWindow: false,
  windowSeconds: MERGE_GATE_REVIEW_WINDOW_SECONDS,
  ...overrides,
});

const holdReason = (decision: ReturnType<typeof decideMergeGate>) =>
  decision._tag === "hold" ? decision.reason : "merge";

const withRun = (name: string, patch: Partial<{ status: string; conclusion: string | null; id: number }>) =>
  A.map(fixtureRuns, (run) => (run.name === name ? MergeGateCheckRun.make({ ...run, ...patch }) : run));

describe("yeet merge-gate decision", () => {
  it("merges the recorded green PR once the window elapsed and threads are zero", () => {
    const decision = decideMergeGate({ read: read(), options: options() });
    expect(decision._tag).toBe("merge");
    if (decision._tag === "merge") {
      expect(decision.headSha).toBe(headSha);
      expect(decision.commitTitle).toBe(`${pullFixture.title} (#${pullFixture.number})`);
      expect(decision.windowAgeSeconds).toBeGreaterThanOrEqual(MERGE_GATE_REVIEW_WINDOW_SECONDS);
      expect(decision.tolerated).toHaveLength(0);
    }
  });

  it("refuses when the head moved since the caller looked", () => {
    expect(holdReason(decideMergeGate({ read: read(), options: options({ wantSha: "0000000000" }) }))).toBe(
      "head-moved"
    );
  });

  it("refuses a draft and a conflicting PR before reading any check", () => {
    expect(holdReason(decideMergeGate({ read: read({ draft: true }), options: options() }))).toBe("draft");
    expect(holdReason(decideMergeGate({ read: read({ mergeableState: "dirty" }), options: options() }))).toBe(
      "conflicting"
    );
  });

  it("fails closed when the base ruleset could not be read", () => {
    expect(holdReason(decideMergeGate({ read: read({ requiredContexts: O.none() }), options: options() }))).toBe(
      "required-contexts-unknown"
    );
  });

  it("holds while a required context is unregistered, pending, or red", () => {
    const unregistered = A.filter(fixtureRuns, (run) => run.name !== "Lint");
    expect(holdReason(decideMergeGate({ read: read({ checkRuns: unregistered }), options: options() }))).toBe(
      "required-pending"
    );
    expect(
      holdReason(
        decideMergeGate({
          read: read({ checkRuns: withRun("Lint", { status: "in_progress", conclusion: null }) }),
          options: options(),
        })
      )
    ).toBe("required-pending");
    expect(
      holdReason(
        decideMergeGate({ read: read({ checkRuns: withRun("Lint", { conclusion: "failure" }) }), options: options() })
      )
    ).toBe("required-red");
  });

  it("reads the newest run per check name so a superseded red does not hold", () => {
    const lint = A.findFirst(fixtureRuns, (run) => run.name === "Lint");
    expect(O.isSome(lint)).toBe(true);
    if (O.isNone(lint)) return;
    const superseded = MergeGateCheckRun.make({ ...lint.value, id: lint.value.id - 1, conclusion: "failure" });
    expect(
      decideMergeGate({ read: read({ checkRuns: A.append(fixtureRuns, superseded) }), options: options() })._tag
    ).toBe("merge");
  });

  it("never tolerates a non-required red or pending check by name alone", () => {
    const coverage = "Heavy / Coverage Regression";
    expect(requiredContexts).not.toContain(coverage);
    expect(
      holdReason(
        decideMergeGate({ read: read({ checkRuns: withRun(coverage, { conclusion: "failure" }) }), options: options() })
      )
    ).toBe("red");
    expect(
      holdReason(
        decideMergeGate({
          read: read({ checkRuns: withRun(coverage, { status: "queued", conclusion: null }) }),
          options: options(),
        })
      )
    ).toBe("pending");
  });

  it("merges over an attributed non-required red and echoes the attribution", () => {
    const coverage = "Heavy / Coverage Regression";
    const tolerance = MergeGateTolerance.make({
      check: coverage,
      attribution: "inherited: red on main since 2c1cb448ba",
    });
    const decision = decideMergeGate({
      read: read({ checkRuns: withRun(coverage, { conclusion: "failure" }) }),
      options: options({ tolerate: [tolerance] }),
    });
    expect(decision._tag).toBe("merge");
    if (decision._tag === "merge") expect(decision.tolerated).toEqual([tolerance]);
    expect(renderMergeGateDecision(decision)).toContain("inherited: red on main since 2c1cb448ba");
  });

  it("an attributed tolerance never covers a required context", () => {
    const tolerance = MergeGateTolerance.make({ check: "Lint", attribution: "flake" });
    expect(
      holdReason(
        decideMergeGate({
          read: read({ checkRuns: withRun("Lint", { conclusion: "failure" }) }),
          options: options({ tolerate: [tolerance] }),
        })
      )
    ).toBe("required-red");
  });

  it("holds inside the review window measured from the later of ready and head commit", () => {
    const start = DateTime.max(readyAt, headCommittedAt);
    const inside = DateTime.add(start, { minutes: 19 });
    const decision = decideMergeGate({ read: read(), options: options({ now: inside }) });
    expect(holdReason(decision)).toBe("review-window-open");
    expect(renderMergeGateDecision(decision)).toContain("min left");
    const laterPush = DateTime.add(readyAt, { hours: 2 });
    expect(
      holdReason(
        decideMergeGate({
          read: read({ headCommittedAt: O.some(laterPush) }),
          options: options({ now: DateTime.add(laterPush, { minutes: 5 }) }),
        })
      )
    ).toBe("review-window-open");
    expect(
      decideMergeGate({ read: read(), options: options({ now: DateTime.add(start, { minutes: 20 }) }) })._tag
    ).toBe("merge");
  });

  it("falls back to the PR creation time when no ready_for_review event exists", () => {
    const createdAt = DateTime.makeUnsafe(pullFixture.created_at);
    const start = DateTime.max(createdAt, headCommittedAt);
    expect(
      holdReason(
        decideMergeGate({
          read: read({ readyAt: O.none() }),
          options: options({ now: DateTime.add(start, { minutes: 1 }) }),
        })
      )
    ).toBe("review-window-open");
    expect(
      decideMergeGate({
        read: read({ readyAt: O.none() }),
        options: options({ now: DateTime.add(start, { minutes: 20 }) }),
      })._tag
    ).toBe("merge");
  });

  it("the window override merges inside the window but still re-reads threads", () => {
    const inside = DateTime.add(DateTime.max(readyAt, headCommittedAt), { minutes: 1 });
    expect(decideMergeGate({ read: read(), options: options({ now: inside, forceWindow: true }) })._tag).toBe("merge");
    expect(
      holdReason(
        decideMergeGate({
          read: read({ unresolvedThreads: O.some(2) }),
          options: options({ now: inside, forceWindow: true }),
        })
      )
    ).toBe("threads-unresolved");
  });

  it("holds when the head commit time or the thread count is unknown", () => {
    expect(holdReason(decideMergeGate({ read: read({ headCommittedAt: O.none() }), options: options() }))).toBe(
      "head-time-unknown"
    );
    expect(holdReason(decideMergeGate({ read: read({ unresolvedThreads: O.none() }), options: options() }))).toBe(
      "threads-unknown"
    );
  });

  it("parses --tolerate as <check>=<attribution> and rejects the rest", () => {
    expect(O.isSome(parseMergeGateTolerance("Heavy / Coverage Regression=inherited: main red"))).toBe(true);
    expect(O.isNone(parseMergeGateTolerance("Heavy / Coverage Regression"))).toBe(true);
    expect(O.isNone(parseMergeGateTolerance("=no check"))).toBe(true);
    expect(O.isNone(parseMergeGateTolerance("Lint="))).toBe(true);
    const parsed = parseMergeGateTolerance("Vercel - app=rate limited: 'Deployment rate limited - retry in 2 hours'");
    expect(O.map(parsed, (tolerance) => tolerance.attribution)).toEqual(
      O.some("rate limited: 'Deployment rate limited - retry in 2 hours'")
    );
  });

  it("renders holds and merges as one hand-off line", () => {
    expect(renderMergeGateDecision(MergeGateHold.make({ prNumber: 7, reason: "draft", detail: "still draft" }))).toBe(
      "#7 HOLD draft: still draft"
    );
    expect(renderMergeGateDecision(decideMergeGate({ read: read(), options: options() }))).toMatch(
      /^#1459 GATE-MET at 212fe39b4f/u
    );
  });
});

// A scripted `gh` whose answers are the recorded fixtures, routed by argv; the
// merge PUT is captured so the test proves what would have been sent.
const encoder = new TextEncoder();

const stubHandle = (exitCode: number, output: string) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(encoder.encode(output)),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
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

interface GhScript {
  readonly mergeResponse: string;
  readonly rulesExit: number;
  readonly threadsExit: number;
}

const defaultScript: GhScript = {
  threadsExit: 0,
  rulesExit: 0,
  mergeResponse: JSON.stringify({ merged: true, sha: "feedfacefeedfacefeedfacefeedfacefeedface", message: "ok" }),
};

const context = RepoRunContext.make({
  base: "origin/main",
  branch: "feat/gate",
  cwd: ".",
  head: "HEAD",
  originalArgv: [],
  packetDir: ".beep/yeet",
  repoRoot: ".",
  turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
});

const scriptedGh = (script: GhScript, calls: Ref.Ref<ReadonlyArray<string>>) =>
  Layer.mergeAll(
    BunCrypto.layer,
    TestConsole.layer,
    Layer.succeed(
      ChildProcessSpawner.ChildProcessSpawner,
      ChildProcessSpawner.make((command) => {
        if (!ChildProcess.isStandardCommand(command)) return Effect.die("the gate never spawns a piped command");
        const line = A.join([command.command, ...command.args], " ");
        return Ref.update(calls, A.append(line)).pipe(
          Effect.map(() => {
            if (Str.includes("/merge")(line)) return stubHandle(0, script.mergeResponse);
            if (Str.includes("graphql")(line)) return stubHandle(script.threadsExit, JSON.stringify(threadsFixture));
            if (Str.includes("rules/branches/")(line))
              return stubHandle(script.rulesExit, JSON.stringify(rulesFixture));
            if (Str.includes("/check-runs")(line)) return stubHandle(0, JSON.stringify([checkRunsFixture]));
            if (Str.includes("/timeline")(line)) return stubHandle(0, JSON.stringify([timelineFixture]));
            if (Str.includes(`/commits/${headSha}`)(line)) return stubHandle(0, JSON.stringify(commitFixture));
            if (Str.includes(`/pulls/${pullFixture.number}`)(line)) return stubHandle(0, JSON.stringify(pullFixture));
            return stubHandle(1, `unexpected command: ${line}`);
          })
        );
      })
    )
  );

describe("yeet merge-gate against recorded gh payloads", () => {
  it.live("reads the PR, check runs, timeline, head commit, threads and ruleset into one read", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make(A.empty<string>());
      const result = yield* readMergeGate(context, pullFixture.number).pipe(
        Effect.provide(scriptedGh(defaultScript, calls))
      );
      expect(result.headSha).toBe(headSha);
      expect(result.draft).toBe(false);
      expect(result.checkRuns).toHaveLength(checkRunsFixture.check_runs.length);
      expect(O.map(result.requiredContexts, A.length)).toEqual(O.some(16));
      expect(O.map(result.readyAt, DateTime.formatIso)).toEqual(O.some(DateTime.formatIso(readyAt)));
      expect(O.map(result.headCommittedAt, DateTime.formatIso)).toEqual(O.some(DateTime.formatIso(headCommittedAt)));
      expect(result.unresolvedThreads).toEqual(O.some(0));
      const lines = yield* Ref.get(calls);
      expect(A.some(lines, Str.includes("/merge"))).toBe(false);
    })
  );

  it.live("a failed thread read becomes an unknown count, and the gate holds on it", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make(A.empty<string>());
      const result = yield* readMergeGate(context, pullFixture.number).pipe(
        Effect.provide(scriptedGh({ ...defaultScript, threadsExit: 1 }, calls))
      );
      expect(result.unresolvedThreads).toEqual(O.none());
      expect(holdReason(decideMergeGate({ read: result, options: options({ now: result.readAt }) }))).toBe(
        "threads-unknown"
      );
    })
  );

  it.live("an unreadable ruleset becomes unknown required contexts", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make(A.empty<string>());
      const result = yield* readMergeGate(context, pullFixture.number).pipe(
        Effect.provide(scriptedGh({ ...defaultScript, rulesExit: 1 }, calls))
      );
      expect(result.requiredContexts).toEqual(O.none());
    })
  );

  it.live("--dry-run decides without sending the merge", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make(A.empty<string>());
      const decision = yield* runMergeGate(context, {
        prNumber: pullFixture.number,
        wantSha: headSha.slice(0, 10),
        tolerate: [],
        forceWindow: false,
        dryRun: true,
      }).pipe(Effect.provide(scriptedGh(defaultScript, calls)));
      expect(decision._tag).toBe("merge");
      expect(A.some(yield* Ref.get(calls), Str.includes("/merge"))).toBe(false);
    })
  );

  it.live("a met gate squash-merges at the pinned head with `<title> (#n)`", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make(A.empty<string>());
      yield* runMergeGate(context, {
        prNumber: pullFixture.number,
        wantSha: headSha,
        tolerate: [],
        forceWindow: false,
        dryRun: false,
      }).pipe(Effect.provide(scriptedGh(defaultScript, calls)));
      const merge = A.findFirst(yield* Ref.get(calls), Str.includes("/merge"));
      expect(O.isSome(merge)).toBe(true);
      if (O.isSome(merge)) {
        expect(merge.value).toContain("-X PUT");
        expect(merge.value).toContain("merge_method=squash");
        expect(merge.value).toContain(`sha=${headSha}`);
        expect(merge.value).toContain(`commit_title=${pullFixture.title} (#${pullFixture.number})`);
      }
    })
  );

  it.live("a hold exits non-zero with the routed reason and never merges", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make(A.empty<string>());
      const failure = yield* runMergeGate(context, {
        prNumber: pullFixture.number,
        wantSha: "0000000000",
        tolerate: [],
        forceWindow: false,
        dryRun: false,
      }).pipe(Effect.provide(scriptedGh(defaultScript, calls)), Effect.flip);
      expect(failure.message).toContain("HOLD head-moved");
      expect(failure.exitCode).toBe(1);
      expect(A.some(yield* Ref.get(calls), Str.includes("/merge"))).toBe(false);
    })
  );
});
