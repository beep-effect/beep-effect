import {
  decideMergeGate,
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
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Ref from "effect/Ref";
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
  readonly mergeResponse: string;
  readonly pull?: unknown;
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

// The recorded answer for each `gh` call, matched on a fragment of its argv, first match wins.
const ghAnswers = (script: GhScript): ReadonlyArray<readonly [string, ScriptedAnswer]> => [
  ["/merge", { exitCode: 0, output: script.mergeResponse }],
  // The review-window reader asks through --jq: timeline rows as `<event>\t<instant>`, suites as instants.
  [
    "/timeline",
    { exitCode: script.windowExit, output: `${timelineFixture[0]?.event ?? "ready_for_review"}\t${readyAtIso}\n` },
  ],
  ["/check-suites", { exitCode: script.windowExit, output: A.join(suiteInstants, "\n") }],
  ["graphql", { exitCode: script.threadsExit, output: JSON.stringify(script.threads ?? threadsFixture) }],
  ["rules/branches/", { exitCode: script.rulesExit, output: JSON.stringify(rulesFixture) }],
  ["/check-runs", { exitCode: 0, output: JSON.stringify([checkRunsFixture]) }],
  [`/pulls/${pullFixture.number}`, { exitCode: 0, output: JSON.stringify(script.pull ?? pullFixture) }],
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
  TestClock.setTime(DateTime.toEpochMillis(windowClosed)).pipe(
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
        { ...defaultScript, mergeResponse: JSON.stringify({ merged: false, message: "Head branch was modified" }) },
        () =>
          Effect.gen(function* () {
            const failure = yield* runMergeGate(context, {
              prNumber: pullFixture.number,
              wantSha: headSha,
              tolerate: [],
              forceWindow: false,
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
            dryRun: false,
          }).pipe(Effect.flip);
          expect(failure.message).toContain("HOLD head-moved");
          expect(failure.exitCode).toBe(1);
          expect(yield* mergeWasSent(calls)).toBe(false);
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
