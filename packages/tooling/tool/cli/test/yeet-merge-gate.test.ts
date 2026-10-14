import {
  decideMergeGate,
  MERGE_GATE_S11_DEFAULT_ATTRIBUTION,
  MergeGateCheckAtMerge,
  MergeGateCheckRun,
  MergeGateCommandOptions,
  MergeGateHold,
  MergeGateRead,
  MergeGateTolerance,
  parseMergeGateTolerance,
  RepoRunContext,
  readMergeGate,
  renderMergeGateDecision,
  runMergeGate,
  runYeetMergeGate,
  YeetReviewWindowElapsed,
  YeetReviewWindowOpen,
  YeetReviewWindowUnknown,
} from "@beep/repo-cli/test/Yeet";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import checkRunsFixture from "./fixtures/yeet-merge-gate/check-runs.json" with { type: "json" };
import checkSuitesFixture from "./fixtures/yeet-merge-gate/check-suites.json" with { type: "json" };
import pullFixture from "./fixtures/yeet-merge-gate/pull.json" with { type: "json" };
import rulesFixture from "./fixtures/yeet-merge-gate/rules.json" with { type: "json" };
import threadsFixture from "./fixtures/yeet-merge-gate/threads.json" with { type: "json" };
import openThreadsFixture from "./fixtures/yeet-merge-gate/threads-open.json" with { type: "json" };
import timelineFixture from "./fixtures/yeet-merge-gate/timeline.json" with { type: "json" };
import type { MergeGateOptions } from "@beep/repo-cli/test/Yeet";

const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

// Recorded 2026-10-06 from merged PR #1459 (head 212fe39b4f): 16 required
// contexts on main, all 33 check runs green, one ready_for_review event, the
// head's check suites, zero review threads. No test here talks to GitHub.
const headSha = pullFixture.head.sha;
const requiredContexts = A.flatMap(rulesFixture, (rule) =>
  A.map(rule.parameters.required_status_checks, (check) => check.context)
);
const fixtureRuns = A.map(checkRunsFixture.check_runs, (run) =>
  MergeGateCheckRun.make({ id: run.id, name: run.name, status: run.status, conclusion: run.conclusion })
);
const readyAtIso = timelineFixture[0]?.created_at ?? "2026-10-06T08:00:52Z";
const suiteInstants = A.map(checkSuitesFixture.check_suites, (suite) => suite.created_at);
const pushedAtIso = A.sort(suiteInstants, Str.Order)[0] ?? readyAtIso;
const anchoredAt = DateTime.makeUnsafe(pushedAtIso > readyAtIso ? pushedAtIso : readyAtIso);
const windowMs = 20 * 60 * 1000;
const elapsedWindow = YeetReviewWindowElapsed.make({
  anchor: "head-push",
  anchoredAt: DateTime.formatIso(anchoredAt),
  windowMs,
});
const openWindow = YeetReviewWindowOpen.make({
  anchor: "head-push",
  anchoredAt: DateTime.formatIso(anchoredAt),
  remainingMs: 5 * 60 * 1000,
  windowMs,
});
const windowClosed = DateTime.add(anchoredAt, { minutes: 21 });

const read = (overrides: Partial<ConstructorParameters<typeof MergeGateRead>[0]> = {}) =>
  MergeGateRead.make({
    prNumber: pullFixture.number,
    title: pullFixture.title,
    headSha,
    draft: false,
    mergeableState: "clean",
    requiredContexts: O.some(requiredContexts),
    checkRuns: fixtureRuns,
    window: elapsedWindow,
    unresolvedThreads: O.some(0),
    readAt: windowClosed,
    ...overrides,
  });

const options = (overrides: Partial<MergeGateOptions> = {}): MergeGateOptions => ({
  wantSha: headSha.slice(0, 10),
  now: windowClosed,
  tolerate: [],
  forceWindow: false,
  relaxed: false,
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
      expect(decision.windowAgeSeconds).toBeGreaterThanOrEqual(20 * 60);
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

  it("fails closed when the ruleset requires no checks, even with no check runs at all", () => {
    for (const checkRuns of [fixtureRuns, []]) {
      const decision = decideMergeGate({ read: read({ requiredContexts: O.some([]), checkRuns }), options: options() });
      expect(holdReason(decision)).toBe("required-contexts-unknown");
      expect(renderMergeGateDecision(decision)).toContain("no CI evidence");
    }
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

  it("holds while the review window is open and prints the time left", () => {
    const decision = decideMergeGate({ read: read({ window: openWindow }), options: options() });
    expect(holdReason(decision)).toBe("review-window-open");
    expect(renderMergeGateDecision(decision)).toMatch(/min/u);
  });

  it("holds when the review window could not be established", () => {
    const unknown = YeetReviewWindowUnknown.make({ reason: "the timeline could not be read" });
    const decision = decideMergeGate({ read: read({ window: unknown }), options: options() });
    expect(holdReason(decision)).toBe("review-window-unknown");
    expect(renderMergeGateDecision(decision)).toContain("timeline could not be read");
  });

  it("the window override merges inside the window but still re-reads threads and never an unknown window", () => {
    expect(decideMergeGate({ read: read({ window: openWindow }), options: options({ forceWindow: true }) })._tag).toBe(
      "merge"
    );
    expect(
      holdReason(
        decideMergeGate({
          read: read({ window: openWindow, unresolvedThreads: O.some(2) }),
          options: options({ forceWindow: true }),
        })
      )
    ).toBe("threads-unresolved");
    const unknown = YeetReviewWindowUnknown.make({ reason: "no check suite yet" });
    expect(
      holdReason(decideMergeGate({ read: read({ window: unknown }), options: options({ forceWindow: true }) }))
    ).toBe("review-window-unknown");
  });

  it("a forced merge over a window with an unparseable anchor reports a zero age", () => {
    const decision = decideMergeGate({
      read: read({ window: YeetReviewWindowOpen.make({ ...openWindow, anchoredAt: "not-an-instant" }) }),
      options: options({ forceWindow: true }),
    });
    expect(decision._tag === "merge" ? decision.windowAgeSeconds : -1).toBe(0);
  });

  it("holds when the thread count is unknown", () => {
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

describe("yeet merge-gate --relaxed decision (S11)", () => {
  const coverage = "Heavy / Coverage Regression";
  const relaxed = (overrides: Partial<MergeGateOptions> = {}) => options({ relaxed: true, ...overrides });
  const atMergeOf = (decision: ReturnType<typeof decideMergeGate>) =>
    decision._tag === "merge" ? decision.atMerge : [];

  it("merges over a required red and records it with the default attribution", () => {
    const decision = decideMergeGate({
      read: read({ checkRuns: withRun("Lint", { conclusion: "failure" }) }),
      options: relaxed(),
    });
    expect(decision._tag).toBe("merge");
    if (decision._tag === "merge") expect(decision.relaxed).toBe(true);
    expect(atMergeOf(decision)).toEqual([
      MergeGateCheckAtMerge.make({
        check: "Lint",
        state: "red",
        required: true,
        attribution: MERGE_GATE_S11_DEFAULT_ATTRIBUTION,
      }),
    ]);
  });

  it("uses the --tolerate attribution for a required red", () => {
    const attribution = "inherited: red on main since 2c1cb448ba, fix in #1477";
    const decision = decideMergeGate({
      read: read({ checkRuns: withRun("Lint", { conclusion: "failure" }) }),
      options: relaxed({ tolerate: [MergeGateTolerance.make({ check: "Lint", attribution })] }),
    });
    expect(A.map(atMergeOf(decision), (entry) => entry.attribution)).toEqual([attribution]);
  });

  it("records a pending and an unregistered required context as pending", () => {
    const runs = A.filter(withRun("Lint", { status: "in_progress", conclusion: null }), (run) => run.name !== "Knip");
    expect(requiredContexts).toContain("Knip");
    const decision = decideMergeGate({ read: read({ checkRuns: runs }), options: relaxed() });
    expect(decision._tag).toBe("merge");
    expect(A.map(atMergeOf(decision), (entry) => [entry.check, entry.state, entry.required])).toEqual([
      ["Knip", "pending", true],
      ["Lint", "pending", true],
    ]);
  });

  it("orders required checks first, then by name, and keeps optional ones", () => {
    const runs = A.map(withRun(coverage, { conclusion: "failure" }), (run) =>
      run.name === "Lint" ? MergeGateCheckRun.make({ ...run, conclusion: "failure" }) : run
    );
    const decision = decideMergeGate({ read: read({ checkRuns: runs }), options: relaxed() });
    expect(A.map(atMergeOf(decision), (entry) => [entry.check, entry.required])).toEqual([
      ["Lint", true],
      [coverage, false],
    ]);
  });

  it("still holds when not one required context has run on the head (no CI evidence)", () => {
    const decision = decideMergeGate({ read: read({ checkRuns: [] }), options: relaxed() });
    expect(holdReason(decision)).toBe("required-pending");
    if (decision._tag === "hold") expect(decision.detail).toContain("never without CI evidence");
  });

  it("records nothing when every check is green, and nothing outside relaxed mode", () => {
    expect(atMergeOf(decideMergeGate({ read: read(), options: relaxed() }))).toEqual([]);
    const strict = decideMergeGate({
      read: read({ checkRuns: withRun(coverage, { conclusion: "failure" }) }),
      options: options({ tolerate: [MergeGateTolerance.make({ check: coverage, attribution: "inherited" })] }),
    });
    expect(strict._tag === "merge" ? [strict.relaxed, strict.atMerge] : []).toEqual([false, []]);
  });

  it.each([
    ["a moved head", "head-moved", read(), { wantSha: "0000000000" }],
    ["a draft", "draft", read({ draft: true }), {}],
    ["a base conflict", "conflicting", read({ mergeableState: "dirty" }), {}],
    ["an unreadable ruleset", "required-contexts-unknown", read({ requiredContexts: O.none() }), {}],
    ["a ruleset with no required checks", "required-contexts-unknown", read({ requiredContexts: O.some([]) }), {}],
    ["an open review window", "review-window-open", read({ window: openWindow }), {}],
    [
      "an unknown review window",
      "review-window-unknown",
      read({ window: YeetReviewWindowUnknown.make({ reason: "not read" }) }),
      {},
    ],
    ["an unresolved thread", "threads-unresolved", read({ unresolvedThreads: O.some(1) }), {}],
    ["an unknown thread count", "threads-unknown", read({ unresolvedThreads: O.none() }), {}],
  ] as const)("still holds on %s", (_name, reason, gateRead, overrides) => {
    const redRead = MergeGateRead.make({ ...gateRead, checkRuns: withRun("Lint", { conclusion: "failure" }) });
    expect(holdReason(decideMergeGate({ read: redRead, options: relaxed(overrides) }))).toBe(reason);
  });

  it("renders a relaxed merge with its reds and pending checks", () => {
    const runs = A.filter(
      A.map(withRun("Lint", { conclusion: "failure" }), (run) =>
        run.name === coverage ? MergeGateCheckRun.make({ ...run, status: "queued", conclusion: null }) : run
      ),
      (run) => run.name !== "Knip"
    );
    const line = renderMergeGateDecision(
      decideMergeGate({
        read: read({ checkRuns: runs }),
        options: relaxed({ tolerate: [MergeGateTolerance.make({ check: coverage, attribution: "rate limited" })] }),
      })
    );
    expect(line).toMatch(/^#1459 GATE-MET \(S11\) at 212fe39b4f \(window \d+s\)/u);
    expect(line).toContain(` reds at merge: Lint [${MERGE_GATE_S11_DEFAULT_ATTRIBUTION}]`);
    expect(line).toContain(
      ` pending at merge: Knip [${MERGE_GATE_S11_DEFAULT_ATTRIBUTION}]; ${coverage} [rate limited]`
    );
    expect(line).not.toContain("tolerated:");
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

interface ScriptedAnswer {
  readonly exitCode: number;
  readonly output: string;
}

interface GhScript {
  readonly additionalActiveRuns?: boolean;
  readonly cancelFailId?: number;
  readonly checkRuns?: unknown;
  readonly commentExit?: number;
  readonly mergeResponse: string;
  readonly pull?: unknown;
  readonly queuedExit?: number;
  readonly rulesExit: number;
  readonly spawnFails?: boolean;
  readonly threads?: unknown;
  readonly threadsExit: number;
  readonly windowExit: number;
}

const defaultScript: GhScript = {
  threadsExit: 0,
  windowExit: 0,
  rulesExit: 0,
  mergeResponse: encodeJson({ merged: true, sha: "feedfacefeedfacefeedfacefeedfacefeedface", message: "ok" }),
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

const workflowRunPages = (additionalActiveRuns: GhScript["additionalActiveRuns"]) => [
  {
    workflow_runs: [
      { id: 11, head_sha: pullFixture.head.sha, status: "queued" },
      { id: 12, head_sha: pullFixture.head.sha, status: "in_progress" },
      { id: 12, head_sha: pullFixture.head.sha, status: "in_progress" },
      { id: 13, head_sha: pullFixture.head.sha, status: "in_progress" },
      { id: 14, head_sha: "0".repeat(40), status: "waiting" },
      { id: 19, head_sha: pullFixture.head.sha, status: "completed" },
    ],
  },
  ...(additionalActiveRuns === true
    ? [
        {
          workflow_runs: A.map(["waiting", "requested", "pending", "future_status"], (status, index) => ({
            id: 15 + index,
            head_sha: pullFixture.head.sha,
            status,
          })),
        },
      ]
    : []),
];

// The recorded answer for each `gh` call, matched on a fragment of its argv, first match wins.
const ghAnswers = (script: GhScript): ReadonlyArray<readonly [string, ScriptedAnswer]> => [
  ["/merge", { exitCode: 0, output: script.mergeResponse }],
  // S11 post-merge steps: the PR comment, the leftover-run listings, and each cancel.
  [`/issues/${pullFixture.number}/comments`, { exitCode: script.commentExit ?? 0, output: "{}" }],
  // Run 14 belongs to another head; the server-side filter should not return it, and the gate never cancels it.
  [
    "/actions/runs?",
    {
      exitCode: script.queuedExit ?? 0,
      output: encodeJson(workflowRunPages(script.additionalActiveRuns)),
    },
  ],
  [`/runs/${script.cancelFailId ?? -1}/cancel`, { exitCode: 1, output: "cancel refused" }],
  ["/cancel", { exitCode: 0, output: "" }],
  // The review-window reader asks through --jq: timeline rows as `<event>\t<instant>`, suites as instants.
  [
    "/timeline",
    { exitCode: script.windowExit, output: `${timelineFixture[0]?.event ?? "ready_for_review"}\t${readyAtIso}\n` },
  ],
  ["/check-suites", { exitCode: script.windowExit, output: A.join(suiteInstants, "\n") }],
  ["graphql", { exitCode: script.threadsExit, output: encodeJson(script.threads ?? threadsFixture) }],
  ["rules/branches/", { exitCode: script.rulesExit, output: encodeJson(rulesFixture) }],
  ["/check-runs", { exitCode: 0, output: encodeJson([script.checkRuns ?? checkRunsFixture]) }],
  [`/pulls/${pullFixture.number}`, { exitCode: 0, output: encodeJson(script.pull ?? pullFixture) }],
];

const answerFor = (script: GhScript, command: string, line: string): ScriptedAnswer =>
  command === "git"
    ? { exitCode: 0, output: "feat/gate\n" }
    : A.findFirst(ghAnswers(script), ([fragment]) => Str.includes(fragment)(line)).pipe(
        O.map(([, answer]) => answer),
        O.getOrElse(() => ({ exitCode: 1, output: `unexpected command: ${line}` }))
      );

const scriptedGh = (script: GhScript, calls: Ref.Ref<ReadonlyArray<string>>) =>
  ChildProcessSpawner.make((command) => {
    if (!ChildProcess.isStandardCommand(command)) return Effect.die("the gate never spawns a piped command");
    const line = A.join([command.command, ...command.args], " ");
    if (script.spawnFails === true && command.command === "gh") {
      return Effect.fail(
        PlatformError.systemError({
          _tag: "NotFound",
          module: "MergeGateTest",
          method: "spawn",
          pathOrDescriptor: "gh",
        })
      );
    }
    const answer = answerFor(script, command.command, line);
    return Ref.update(calls, A.append(line)).pipe(Effect.as(stubHandle(answer.exitCode, answer.output)));
  });

// Every scripted run records the argv it was asked for, so a test can prove the merge was or was not sent.
const withScriptedGh = <A, E, R>(
  script: GhScript,
  use: (calls: Ref.Ref<ReadonlyArray<string>>) => Effect.Effect<A, E, R>
) =>
  // The test clock starts at the epoch; put "now" a minute past the recorded window.
  windowClosed.pipe(
    DateTime.toEpochMillis,
    TestClock.setTime,
    Effect.andThen(Ref.make<ReadonlyArray<string>>(A.empty())),
    Effect.flatMap((calls) =>
      use(calls).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, scriptedGh(script, calls)))
    )
  );

const mergeWasSent = (calls: Ref.Ref<ReadonlyArray<string>>) =>
  Ref.get(calls).pipe(Effect.map(A.some(Str.includes("/merge"))));

const commandOptions = (overrides: Partial<ConstructorParameters<typeof MergeGateCommandOptions>[0]> = {}) =>
  MergeGateCommandOptions.make({
    base: "origin/main",
    head: "HEAD",
    packetDir: ".beep/yeet",
    pr: pullFixture.number,
    sha: headSha,
    tolerate: [],
    forceWindow: false,
    relaxed: false,
    dryRun: true,
    ...overrides,
  });

it.layer(Layer.mergeAll(NodeServices.layer, TestConsole.layer), { timeout: "30 seconds" })(
  "yeet merge-gate against recorded gh payloads",
  (it) => {
    it.effect("reads the PR, check runs, review window, threads and ruleset into one read", () =>
      withScriptedGh(defaultScript, (calls) =>
        Effect.gen(function* () {
          const result = yield* readMergeGate(context, pullFixture.number);
          expect(result.headSha).toBe(headSha);
          expect(result.draft).toBe(false);
          expect(result.checkRuns).toHaveLength(checkRunsFixture.check_runs.length);
          expect(O.map(result.requiredContexts, A.length)).toEqual(O.some(16));
          expect(result.window._tag).toBe("elapsed");
          if (result.window._tag === "elapsed") expect(result.window.anchoredAt).toBe(DateTime.formatIso(anchoredAt));
          expect(result.unresolvedThreads).toEqual(O.some(0));
          expect(yield* mergeWasSent(calls)).toBe(false);
        })
      )
    );

    it.effect("counts the recorded unresolved threads of #1488 as outstanding", () =>
      withScriptedGh({ ...defaultScript, threads: openThreadsFixture }, () =>
        Effect.gen(function* () {
          const result = yield* readMergeGate(context, pullFixture.number);
          expect(result.unresolvedThreads).toEqual(O.some(4));
        })
      )
    );

    it.effect("an author-resolved thread holds when a human spoke last, and not when a bot did", () =>
      Effect.gen(function* () {
        // #1459's four threads are resolved by the PR author, who also commented last.
        const resolved = threadsFixture.data.repository.pullRequest.reviewThreads;
        const withLastAuthor = (author: { readonly __typename: string; readonly login: string }) => ({
          data: {
            repository: {
              pullRequest: {
                reviewThreads: {
                  ...resolved,
                  nodes: A.map(resolved.nodes, (node, index) =>
                    index === 0
                      ? { ...node, comments: { nodes: [{ createdAt: "2026-10-06T09:00:00Z", author }] } }
                      : node
                  ),
                },
              },
            },
          },
        });
        const count = (threads: unknown) =>
          withScriptedGh({ ...defaultScript, threads }, () =>
            readMergeGate(context, pullFixture.number).pipe(Effect.map((read) => read.unresolvedThreads))
          );
        expect(yield* count(threadsFixture)).toEqual(O.some(0));
        expect(yield* count(withLastAuthor({ __typename: "User", login: "reviewer" }))).toEqual(O.some(1));
        expect(yield* count(withLastAuthor({ __typename: "Bot", login: "greptile-apps" }))).toEqual(O.some(0));
      })
    );

    it.effect("more threads than one page is an unknown count, never a lower bound", () =>
      withScriptedGh(
        {
          ...defaultScript,
          threads: {
            data: { repository: { pullRequest: { reviewThreads: { totalCount: 101, nodes: [] } } } },
          },
        },
        () =>
          readMergeGate(context, pullFixture.number).pipe(
            Effect.map((result) => expect(result.unresolvedThreads).toEqual(O.none()))
          )
      )
    );

    it.effect("a pull request with no mergeable state yet reads as unknown, not clean", () =>
      withScriptedGh({ ...defaultScript, pull: { ...pullFixture, mergeable_state: null } }, () =>
        readMergeGate(context, pullFixture.number).pipe(
          Effect.map((result) => expect(result.mergeableState).toBe("unknown"))
        )
      )
    );

    it.effect("a gh that cannot start is a typed failure naming the read", () =>
      withScriptedGh({ ...defaultScript, spawnFails: true }, () =>
        Effect.gen(function* () {
          const failure = yield* readMergeGate(context, pullFixture.number).pipe(Effect.flip);
          expect(failure.message).toContain(`gh api pulls/${pullFixture.number} failed (spawn)`);
        })
      )
    );

    it.effect("a decline without a message, and a merge without a sha, are still reported", () =>
      Effect.gen(function* () {
        const declined = yield* withScriptedGh({ ...defaultScript, mergeResponse: '{"merged":false}' }, () =>
          runMergeGate(context, {
            prNumber: pullFixture.number,
            wantSha: headSha,
            tolerate: [],
            forceWindow: false,
            relaxed: false,
            dryRun: false,
          }).pipe(Effect.flip)
        );
        expect(declined.message).toContain("no message");
        const decision = yield* withScriptedGh({ ...defaultScript, mergeResponse: '{"merged":true}' }, () =>
          runMergeGate(context, {
            prNumber: pullFixture.number,
            wantSha: headSha,
            tolerate: [],
            forceWindow: true,
            relaxed: false,
            dryRun: false,
          })
        );
        expect(decision._tag).toBe("merge");
      })
    );

    it.effect("a failed thread read becomes an unknown count, and the gate holds on it", () =>
      withScriptedGh({ ...defaultScript, threadsExit: 1 }, () =>
        Effect.gen(function* () {
          const result = yield* readMergeGate(context, pullFixture.number);
          expect(result.unresolvedThreads).toEqual(O.none());
          expect(holdReason(decideMergeGate({ read: result, options: options({ now: result.readAt }) }))).toBe(
            "threads-unknown"
          );
        })
      )
    );

    it.effect("a failed window read becomes an unknown window, which holds even when forced", () =>
      withScriptedGh({ ...defaultScript, windowExit: 1 }, () =>
        Effect.gen(function* () {
          const result = yield* readMergeGate(context, pullFixture.number);
          expect(result.window._tag).toBe("unknown");
          expect(
            holdReason(decideMergeGate({ read: result, options: options({ now: result.readAt, forceWindow: true }) }))
          ).toBe("review-window-unknown");
        })
      )
    );

    it.effect("an unreadable ruleset becomes unknown required contexts", () =>
      withScriptedGh({ ...defaultScript, rulesExit: 1 }, () =>
        Effect.gen(function* () {
          const result = yield* readMergeGate(context, pullFixture.number);
          expect(result.requiredContexts).toEqual(O.none());
        })
      )
    );

    it.effect("--dry-run decides without sending the merge", () =>
      withScriptedGh(defaultScript, (calls) =>
        Effect.gen(function* () {
          const decision = yield* runMergeGate(context, {
            prNumber: pullFixture.number,
            wantSha: headSha.slice(0, 10),
            tolerate: [],
            forceWindow: false,
            relaxed: false,
            dryRun: true,
          });
          expect(decision._tag).toBe("merge");
          expect(yield* mergeWasSent(calls)).toBe(false);
        })
      )
    );

    it.effect("a met gate squash-merges at the pinned head with `<title> (#n)`", () =>
      withScriptedGh(defaultScript, (calls) =>
        Effect.gen(function* () {
          yield* runMergeGate(context, {
            prNumber: pullFixture.number,
            wantSha: headSha,
            tolerate: [],
            forceWindow: false,
            relaxed: false,
            dryRun: false,
          });
          const merge = A.findFirst(yield* Ref.get(calls), Str.includes("/merge"));
          expect(O.isSome(merge)).toBe(true);
          if (O.isSome(merge)) {
            expect(merge.value).toContain("-X PUT");
            expect(merge.value).toContain("merge_method=squash");
            expect(merge.value).toContain(`sha=${headSha}`);
            expect(merge.value).toContain(`commit_title=${pullFixture.title} (#${pullFixture.number})`);
          }
        })
      )
    );

    it.effect("GitHub declining the merge is a failure, never a silent pass", () =>
      withScriptedGh(
        { ...defaultScript, mergeResponse: encodeJson({ merged: false, message: "Head branch was modified" }) },
        () =>
          Effect.gen(function* () {
            const failure = yield* runMergeGate(context, {
              prNumber: pullFixture.number,
              wantSha: headSha,
              tolerate: [],
              forceWindow: false,
              relaxed: false,
              dryRun: false,
            }).pipe(Effect.flip);
            expect(failure.message).toContain("Head branch was modified");
          })
      )
    );

    it.effect("a hold exits non-zero with the routed reason and never merges", () =>
      withScriptedGh(defaultScript, (calls) =>
        Effect.gen(function* () {
          const failure = yield* runMergeGate(context, {
            prNumber: pullFixture.number,
            wantSha: "0000000000",
            tolerate: [],
            forceWindow: false,
            relaxed: false,
            dryRun: false,
          }).pipe(Effect.flip);
          expect(failure.message).toContain("HOLD head-moved");
          expect(failure.exitCode).toBe(1);
          expect(yield* mergeWasSent(calls)).toBe(false);
        })
      )
    );

    const lintRed = {
      check_runs: A.map(checkRunsFixture.check_runs, (run) =>
        run.name === "Lint" ? { ...run, conclusion: "failure" } : run
      ),
    };
    const relaxedRun = (dryRun: boolean, forceWindow = false) =>
      runMergeGate(context, {
        prNumber: pullFixture.number,
        wantSha: headSha,
        tolerate: [],
        forceWindow,
        relaxed: true,
        dryRun,
      });
    const indexOf = (lines: ReadonlyArray<string>, fragment: string) =>
      O.getOrElse(A.findFirstIndex(lines, Str.includes(fragment)), () => -1);

    it.effect("a relaxed merge comments with the reds and cancels the head's leftover runs after merging", () =>
      withScriptedGh({ ...defaultScript, checkRuns: lintRed }, (calls) =>
        Effect.gen(function* () {
          expect((yield* relaxedRun(false))._tag).toBe("merge");
          const lines = yield* Ref.get(calls);
          const mergeAt = indexOf(lines, "/merge");
          const commentAt = indexOf(lines, `/issues/${pullFixture.number}/comments`);
          expect(mergeAt).toBeGreaterThanOrEqual(0);
          expect(commentAt).toBeGreaterThan(mergeAt);
          const comment = lines[commentAt] ?? "";
          expect(comment).toContain("-X POST");
          expect(comment).toContain("yeet merge-gate (S11): merged 212fe39b4f as feedfacefe.");
          expect(comment).toContain(`reds at merge: Lint [${MERGE_GATE_S11_DEFAULT_ATTRIBUTION}]`);
          expect(comment).toContain('Merged under operator ruling S11 (AGENTS.md "Mergeable")');
          expect(indexOf(lines, `head_sha=${headSha}&per_page=100`)).toBeGreaterThan(mergeAt);
          // A duplicate run in the listing is cancelled once.
          expect(A.filter(lines, Str.includes("/cancel"))).toEqual(
            A.map([11, 12, 13], (id) => `gh api -X POST repos/{owner}/{repo}/actions/runs/${id}/cancel`)
          );
          expect(comment).toContain("review window elapsed");
          const printed = A.join(A.map(yield* TestConsole.logLines, String), "\n");
          expect(printed).toContain("GATE-MET (S11)");
          expect(printed).toContain("cancelled 3 of 3 active workflow run(s) on 212fe39b4f");
        })
      )
    );

    it.effect("cancels every active status across pages while retaining the head guard", () =>
      withScriptedGh({ ...defaultScript, additionalActiveRuns: true }, (calls) =>
        Effect.gen(function* () {
          expect((yield* relaxedRun(false))._tag).toBe("merge");
          const lines = yield* Ref.get(calls);
          const listings = A.filter(lines, Str.includes("/actions/runs?"));
          expect(listings).toHaveLength(1);
          expect(listings[0]).toContain("per_page=100");
          expect(A.every(listings, Str.includes("--paginate --slurp"))).toBe(true);
          expect(A.filter(lines, Str.includes("/cancel"))).toEqual(
            A.map([11, 12, 13, 15, 16, 17, 18], (id) => `gh api -X POST repos/{owner}/{repo}/actions/runs/${id}/cancel`)
          );
        })
      )
    );

    it.effect("a relaxed merge with a forced window says so in the lasting comment", () =>
      withScriptedGh({ ...defaultScript, checkRuns: lintRed }, (calls) =>
        Effect.gen(function* () {
          expect((yield* relaxedRun(false, true))._tag).toBe("merge");
          const lines = yield* Ref.get(calls);
          const comment = lines[indexOf(lines, `/issues/${pullFixture.number}/comments`)] ?? "";
          expect(comment).toContain("review window forced (a fix that unblocks main)");
          expect(comment).not.toContain("review window elapsed");
        })
      )
    );

    it.effect("a failed paginated run listing only warns after the merge", () =>
      withScriptedGh({ ...defaultScript, checkRuns: lintRed, queuedExit: 1 }, (calls) =>
        Effect.gen(function* () {
          expect((yield* relaxedRun(false))._tag).toBe("merge");
          const lines = yield* Ref.get(calls);
          expect(A.filter(lines, Str.includes("/cancel"))).toEqual([]);
          const warned = A.join(A.map(yield* TestConsole.errorLines, String), "\n");
          expect(warned).toContain("[yeet] warning: listing the merged head's workflow runs failed after the merge");
          const printed = A.join(A.map(yield* TestConsole.logLines, String), "\n");
          expect(printed).toContain("cancelled 0 of 0 active workflow run(s)");
        })
      )
    );

    it.effect("one failed cancel only warns; the other runs are still cancelled and the count says so", () =>
      withScriptedGh({ ...defaultScript, checkRuns: lintRed, cancelFailId: 12 }, (calls) =>
        Effect.gen(function* () {
          expect((yield* relaxedRun(false))._tag).toBe("merge");
          const lines = yield* Ref.get(calls);
          expect(A.filter(lines, Str.includes("/cancel"))).toHaveLength(3);
          expect(A.some(lines, Str.includes("/runs/14/cancel"))).toBe(false);
          const warned = A.join(A.map(yield* TestConsole.errorLines, String), "\n");
          expect(warned).toContain("[yeet] warning: cancelling a leftover workflow run failed after the merge");
          const printed = A.join(A.map(yield* TestConsole.logLines, String), "\n");
          expect(printed).toContain("cancelled 2 of 3 active workflow run(s)");
        })
      )
    );

    it.effect("a failed S11 comment only warns: the merge already happened and the runs are still cancelled", () =>
      withScriptedGh({ ...defaultScript, commentExit: 1 }, (calls) =>
        Effect.gen(function* () {
          expect((yield* relaxedRun(false))._tag).toBe("merge");
          const lines = yield* Ref.get(calls);
          expect(A.filter(lines, Str.includes("/cancel"))).toHaveLength(3);
          const warned = A.join(A.map(yield* TestConsole.errorLines, String), "\n");
          expect(warned).toContain("[yeet] warning: the S11 merge comment failed after the merge");
        })
      )
    );

    it.effect("a relaxed dry run, and a strict merge, neither comment nor cancel", () =>
      Effect.gen(function* () {
        const postMerge = (lines: ReadonlyArray<string>) =>
          A.filter(lines, (line) => Str.includes("/comments")(line) || Str.includes("actions/runs")(line));
        const dryRun = yield* withScriptedGh({ ...defaultScript, checkRuns: lintRed }, (calls) =>
          relaxedRun(true).pipe(Effect.andThen(Ref.get(calls)))
        );
        expect(A.some(dryRun, Str.includes("/merge"))).toBe(false);
        expect(postMerge(dryRun)).toEqual([]);
        const strict = yield* withScriptedGh(defaultScript, (calls) =>
          runMergeGate(context, {
            prNumber: pullFixture.number,
            wantSha: headSha,
            tolerate: [],
            forceWindow: false,
            relaxed: false,
            dryRun: false,
          }).pipe(Effect.andThen(Ref.get(calls)))
        );
        expect(A.some(strict, Str.includes("/merge"))).toBe(true);
        expect(postMerge(strict)).toEqual([]);
      })
    );

    it.effect("the command passes --relaxed through to the gate", () =>
      withScriptedGh({ ...defaultScript, checkRuns: lintRed }, () =>
        Effect.gen(function* () {
          yield* runYeetMergeGate(commandOptions({ relaxed: true, tolerate: ["Lint=inherited: red on main"] }));
          const printed = A.join(A.map(yield* TestConsole.logLines, String), "\n");
          expect(printed).toContain("GATE-MET (S11)");
          expect(printed).toContain("reds at merge: Lint [inherited: red on main]");
        })
      )
    );

    it.effect("the command refuses a malformed --tolerate before reading anything", () =>
      withScriptedGh(defaultScript, (calls) =>
        Effect.gen(function* () {
          const failure = yield* runYeetMergeGate(commandOptions({ tolerate: ["Heavy / Coverage Regression"] })).pipe(
            Effect.flip
          );
          expect(failure.message).toContain('--tolerate needs "<check name>=<attribution>"');
          expect(yield* Ref.get(calls)).toHaveLength(0);
        })
      )
    );

    it.effect("the command decodes tolerances, resolves the repo and runs the gate", () =>
      withScriptedGh(defaultScript, (calls) =>
        Effect.gen(function* () {
          yield* runYeetMergeGate(commandOptions({ tolerate: ["Heavy / Coverage Regression=inherited: red on main"] }));
          const lines = yield* Ref.get(calls);
          expect(A.some(lines, Str.includes(`/pulls/${pullFixture.number}`))).toBe(true);
          expect(yield* mergeWasSent(calls)).toBe(false);
        })
      )
    );
  }
);
