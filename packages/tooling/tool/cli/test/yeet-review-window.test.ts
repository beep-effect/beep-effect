import {
  collectYeetStatus,
  decideYeetReviewWindow,
  deriveYeetMergeReady,
  deriveYeetReadyPendingFlip,
  GreptileSummary,
  PrCloseoutReport,
  PrCloseoutReportJson,
  RepoRunContext,
  readYeetReviewWindow,
  renderYeetReviewWindow,
  renderYeetStatusSummary,
  runArtifactPathForContext,
  YEET_REVIEW_WINDOW_DEFAULT,
  YEET_REVIEW_WINDOW_ENV,
  YeetReviewWindowElapsed,
  YeetReviewWindowOpen,
  YeetReviewWindowUnknown,
  YeetStatusArtifact,
  YeetStatusRemote,
  yeetReviewWindowDue,
  yeetReviewWindowElapsed,
} from "@beep/repo-cli/test/Yeet";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, DateTime, Duration, Effect, FileSystem, Layer, Path, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import type { YeetReviewWindow } from "@beep/repo-cli/test/Yeet";

const headSha = "abc1234def";
const instant = (iso: string) => DateTime.makeUnsafe(iso);
const millis = (iso: string) => DateTime.toEpochMillis(instant(iso));
const twentyMinutes = Duration.minutes(20);
const noOverride = Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}));

const context = RepoRunContext.make({
  base: "origin/main",
  branch: "feature/review-window",
  cwd: "/repo",
  head: "HEAD",
  originalArgv: [],
  packetDir: ".beep/yeet",
  repoRoot: "/repo",
  turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
});

describe("review window decision", () => {
  it("is open, with the minutes left, until the window has run", () => {
    const window = decideYeetReviewWindow({
      now: instant("2026-10-06T10:07:00Z"),
      pushedAt: instant("2026-10-06T10:00:00Z"),
      readyAt: instant("2026-10-06T09:00:00Z"),
      readyAnchor: "ready-for-review",
      window: twentyMinutes,
    });
    expect(window).toMatchObject({ _tag: "open", anchor: "head-push", remainingMs: 13 * 60_000 });
    expect(renderYeetReviewWindow(window)).toBe(
      "review window open: 13 min left (20 min after the last push at 2026-10-06T10:00:00.000Z)"
    );
  });

  it("has elapsed from the instant the full window has passed", () => {
    const at = (now: string) =>
      decideYeetReviewWindow({
        now: instant(now),
        pushedAt: instant("2026-10-06T10:00:00Z"),
        readyAt: instant("2026-10-06T09:00:00Z"),
        readyAnchor: "ready-for-review",
        window: twentyMinutes,
      });
    expect(at("2026-10-06T10:19:59.999Z")).toMatchObject({ _tag: "open", remainingMs: 1 });
    expect(renderYeetReviewWindow(at("2026-10-06T10:19:59.999Z"))).toContain("review window open: 1 min left");
    expect(at("2026-10-06T10:20:00Z")._tag).toBe("elapsed");
    expect(renderYeetReviewWindow(at("2026-10-06T10:45:00Z"))).toBe(
      "review window elapsed (20 min after the last push at 2026-10-06T10:00:00.000Z)"
    );
  });

  it("restarts on a new push to the head", () => {
    const pushedAt = (push: string) =>
      decideYeetReviewWindow({
        now: instant("2026-10-06T10:21:00Z"),
        pushedAt: instant(push),
        readyAt: instant("2026-10-06T09:00:00Z"),
        readyAnchor: "ready-for-review",
        window: twentyMinutes,
      });
    expect(pushedAt("2026-10-06T10:00:00Z")._tag).toBe("elapsed");
    expect(pushedAt("2026-10-06T10:15:00Z")).toMatchObject({
      _tag: "open",
      anchor: "head-push",
      remainingMs: 14 * 60_000,
    });
  });

  it("counts from the ready-for-review event when it is later than the push", () => {
    const window = decideYeetReviewWindow({
      now: instant("2026-10-06T10:25:00Z"),
      pushedAt: instant("2026-10-06T10:00:00Z"),
      readyAt: instant("2026-10-06T10:10:00Z"),
      readyAnchor: "ready-for-review",
      window: twentyMinutes,
    });
    expect(window).toMatchObject({
      _tag: "open",
      anchor: "ready-for-review",
      anchoredAt: "2026-10-06T10:10:00.000Z",
      remainingMs: 5 * 60_000,
    });
    expect(renderYeetReviewWindow(window)).toContain("5 min left (20 min after it was marked ready for review");
  });

  it("defaults to twenty minutes and only an elapsed read satisfies the gate", () => {
    expect(Duration.toMinutes(YEET_REVIEW_WINDOW_DEFAULT)).toBe(20);
    const elapsed = YeetReviewWindowElapsed.make({ anchor: "head-push", anchoredAt: "x", windowMs: 1 });
    const open = YeetReviewWindowOpen.make({ anchor: "head-push", anchoredAt: "x", remainingMs: 1, windowMs: 1 });
    const unknown = YeetReviewWindowUnknown.make({ reason: "timeline unreadable" });
    expect(yeetReviewWindowElapsed(O.some(elapsed))).toBe(true);
    expect(yeetReviewWindowElapsed(O.some(open))).toBe(false);
    expect(yeetReviewWindowElapsed(O.some(unknown))).toBe(false);
    expect(yeetReviewWindowElapsed(O.none())).toBe(false);
    expect(renderYeetReviewWindow(unknown)).toBe(
      "review window unknown: timeline unreadable; unknown never counts as elapsed"
    );
  });
});

// One scripted GitHub answer: the printed lines, or a failed or clipped call.
type Answer = string | "fail" | "clipped";
interface Answers {
  readonly pull?: Answer;
  readonly suites?: Answer;
  readonly timeline?: Answer;
}

const answerFor = (answers: Answers, args: ReadonlyArray<string>): Answer => {
  const endpoint = O.getOrElse(A.findFirst(args, Str.startsWith("repos/")), () => "");
  if (Str.includes("/timeline")(endpoint)) return answers.timeline ?? "fail";
  if (Str.includes("/check-suites")(endpoint)) return answers.suites ?? "fail";
  return answers.pull ?? "fail";
};

const scripted =
  (answers: Answers, calls: Ref.Ref<ReadonlyArray<string>>) => (_command: string, args: ReadonlyArray<string>) => {
    const answer = answerFor(answers, args);
    return Ref.update(calls, A.append(A.join(args, " "))).pipe(
      Effect.as({
        exitCode: answer === "fail" ? 1 : 0,
        output: answer === "fail" ? "gh: API rate limit exceeded" : answer === "clipped" ? "2026-10-06T10:" : answer,
        truncated: answer === "clipped",
      })
    );
  };

const readWith = Effect.fn("readWith")(function* (answers: Answers) {
  const calls = yield* Ref.make<ReadonlyArray<string>>([]);
  const window = yield* readYeetReviewWindow(context, { prNumber: 42, headSha }, scripted(answers, calls));
  return { window, calls: yield* Ref.get(calls) };
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("review window read", (it) => {
  it.effect("reads the window open on the test clock, then elapsed once the clock passes it", () =>
    Effect.gen(function* () {
      const answers = { timeline: "2026-10-06T09:00:00Z\n", suites: "2026-10-06T10:00:05Z\n2026-10-06T10:00:00Z\n" };
      yield* TestClock.setTime(millis("2026-10-06T10:07:00Z"));
      const first = yield* readWith(answers);
      expect(first.window).toMatchObject({ _tag: "open", anchor: "head-push", remainingMs: 13 * 60_000 });
      // A pull request with a ready-for-review event needs no creation read.
      expect(first.calls).toHaveLength(2);
      expect(A.some(first.calls, Str.includes("issues/42/timeline"))).toBe(true);
      expect(A.some(first.calls, Str.includes(`commits/${headSha}/check-suites`))).toBe(true);
      yield* TestClock.adjust(Duration.minutes(13));
      expect((yield* readWith(answers)).window).toMatchObject({ _tag: "elapsed", anchor: "head-push" });
    }).pipe(noOverride)
  );

  it.effect("a new push to the head restarts a window that had elapsed", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(millis("2026-10-06T10:21:00Z"));
      const before = yield* readWith({ timeline: "2026-10-06T09:00:00Z", suites: "2026-10-06T10:00:00Z" });
      expect(before.window._tag).toBe("elapsed");
      const after = yield* readWith({ timeline: "2026-10-06T09:00:00Z", suites: "2026-10-06T10:15:00Z" });
      expect(after.window).toMatchObject({ _tag: "open", anchor: "head-push", remainingMs: 14 * 60_000 });
    }).pipe(noOverride)
  );

  it.effect("uses the latest ready-for-review event when it is later than the push", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(millis("2026-10-06T10:25:00Z"));
      const { window } = yield* readWith({
        timeline: "2026-10-06T08:00:00Z\n2026-10-06T10:10:00Z\n",
        suites: "2026-10-06T10:00:00Z",
      });
      expect(window).toMatchObject({ _tag: "open", anchor: "ready-for-review", remainingMs: 5 * 60_000 });
    }).pipe(noOverride)
  );

  it.effect("counts a pull request opened ready from its creation", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(millis("2026-10-06T10:30:00Z"));
      const { window, calls } = yield* readWith({
        timeline: "",
        suites: "2026-10-06T10:00:00Z",
        pull: "2026-10-06T10:12:00Z\n",
      });
      expect(window).toMatchObject({ _tag: "open", anchor: "pr-opened", remainingMs: 2 * 60_000 });
      expect(A.some(calls, Str.includes("repos/{owner}/{repo}/pulls/42"))).toBe(true);
    }).pipe(noOverride)
  );

  it.effect.each([
    ["a failed timeline query", { suites: "2026-10-06T10:00:00Z" }, "timeline of pull request #42"],
    [
      "a clipped timeline query",
      { timeline: "clipped", suites: "2026-10-06T10:00:00Z" },
      "timeline of pull request #42",
    ],
    ["a timeline line that is not an instant", { timeline: "not-a-date", suites: "2026-10-06T10:00:00Z" }, "timeline"],
    ["a failed check-suite query", { timeline: "2026-10-06T09:00:00Z" }, `check suites of head ${headSha}`],
    ["a head with no check suite", { timeline: "2026-10-06T09:00:00Z", suites: "" }, "no check suite yet"],
    [
      "an unreadable creation time",
      { timeline: "", suites: "2026-10-06T10:00:00Z" },
      "creation time of pull request #42",
    ],
  ] as const)("reports %s as unknown, never as elapsed", ([, answers, reason]) =>
    Effect.gen(function* () {
      // Far past any window: only a successful read may call it elapsed.
      yield* TestClock.setTime(millis("2027-01-01T00:00:00Z"));
      const { window } = yield* readWith(answers);
      expect(window._tag).toBe("unknown");
      expect(renderYeetReviewWindow(window)).toContain(reason);
      expect(yeetReviewWindowElapsed(O.some(window))).toBe(false);
    }).pipe(noOverride)
  );

  it.effect("honours the environment override and refuses one that is not a duration", () =>
    Effect.gen(function* () {
      const answers = { timeline: "2026-10-06T09:00:00Z", suites: "2026-10-06T10:00:00Z" };
      const withWindow = (value: string) =>
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ [YEET_REVIEW_WINDOW_ENV]: value })
        );
      yield* TestClock.setTime(millis("2026-10-06T10:07:00Z"));
      expect((yield* readWith(answers).pipe(withWindow("5 minutes"))).window._tag).toBe("elapsed");
      expect((yield* readWith(answers).pipe(withWindow("30 minutes"))).window).toMatchObject({
        _tag: "open",
        remainingMs: 23 * 60_000,
      });
      const invalid = yield* readWith(answers).pipe(withWindow("soon"));
      expect(invalid.window._tag).toBe("unknown");
      expect(invalid.calls).toEqual([]);
      expect(renderYeetReviewWindow(invalid.window)).toContain(YEET_REVIEW_WINDOW_ENV);
    })
  );
});

const greenRemote = (
  overrides: Partial<{ readonly isDraft: boolean; readonly reviewWindow: O.Option<YeetReviewWindow> }> = {}
) =>
  YeetStatusRemote.make({
    available: true,
    checked: true,
    detail: "PR #42 OPEN",
    state: "OPEN",
    number: 42,
    headSha: O.some(headSha),
    isDraft: false,
    mergeable: "MERGEABLE",
    mergeStateStatus: "CLEAN",
    requiredCheckCount: 3,
    failingRequiredCheckCount: 0,
    pendingRequiredCheckCount: 0,
    unresolvedReviewThreadCount: 0,
    ...overrides,
  });
const boundCloseout = YeetStatusArtifact.make({
  detail: "closed",
  issueCount: 0,
  path: "pr-closeout.json",
  state: "present",
  reviewedHeadSha: O.some(headSha),
});

describe("merge readiness with the review window", () => {
  const open = YeetReviewWindowOpen.make({
    anchor: "ready-for-review",
    anchoredAt: "2026-10-06T10:00:00.000Z",
    remainingMs: 7 * 60_000,
    windowMs: 20 * 60_000,
  });
  const elapsed = YeetReviewWindowElapsed.make({
    anchor: "ready-for-review",
    anchoredAt: "2026-10-06T10:00:00.000Z",
    windowMs: 20 * 60_000,
  });

  it.each([
    ["an unread window", O.none<YeetReviewWindow>()],
    ["an open window", O.some<YeetReviewWindow>(open)],
    ["an unknown window", O.some<YeetReviewWindow>(YeetReviewWindowUnknown.make({ reason: "timeline unreadable" }))],
  ] as const)("is not ready on %s, even with green checks and no threads", (_name, reviewWindow) => {
    const ready = O.getOrThrow(deriveYeetMergeReady(boundCloseout, greenRemote({ reviewWindow })));
    expect(ready.ready).toBe(false);
    expect(ready.failing).toEqual(O.some("review-window-elapsed"));
    // Everything else holds, so this is the read that must take the window.
    expect(yeetReviewWindowDue(ready.criteria)).toBe(true);
  });

  it("is ready once the window has elapsed", () => {
    const ready = O.getOrThrow(deriveYeetMergeReady(boundCloseout, greenRemote({ reviewWindow: O.some(elapsed) })));
    expect(ready).toMatchObject({ ready: true, failing: O.none() });
  });

  it("asks a green draft for the flip, not for the review window", () => {
    const remote = YeetStatusRemote.make({ ...greenRemote({ isDraft: true }), mergeStateStatus: "DRAFT" });
    const ready = O.getOrThrow(deriveYeetMergeReady(boundCloseout, remote));
    expect(ready.failing).toEqual(O.some("not-draft"));
    expect(yeetReviewWindowDue(ready.criteria)).toBe(false);
    expect(deriveYeetReadyPendingFlip(remote, ready)).toBe(true);
  });
});

const fakeHandle = (output: string, exitCode = 0) =>
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

const pullRequestJson =
  '{"headRefOid":"abc1234def","id":"PR_window","isDraft":false,"labels":[],"mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","number":42,"reviewDecision":null,"state":"OPEN","url":"https://github.com/beep/beep/pull/42"}';
const checksJson = (bucket: "pass" | "pending") =>
  `[{"bucket":"${bucket}","completedAt":"2026-10-06T10:00:00Z","link":"","name":"Check","startedAt":"2026-10-06T10:00:00Z","state":"${bucket === "pass" ? "SUCCESS" : "QUEUED"}","workflow":"Check"}]`;
const threadsJson =
  '{"data":{"node":{"author":{"login":"author"},"reviewThreads":{"nodes":[],"pageInfo":{"endCursor":null,"hasNextPage":false}}}}}';

// The whole `gh` surface `collectYeetStatus` reads, with the REST review-window
// reads scripted separately from the GraphQL thread read.
const ghRunner = (answers: Answers, bucket: "pass" | "pending", restCalls: Ref.Ref<ReadonlyArray<string>>) =>
  ChildProcessSpawner.make((command) => {
    if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
    if (command.command !== "gh") return Effect.succeed(fakeHandle(""));
    const route = A.join(A.take(command.args, 2), " ");
    if (route === "pr view") return Effect.succeed(fakeHandle(pullRequestJson));
    if (route === "pr checks") return Effect.succeed(fakeHandle(checksJson(bucket)));
    if (route === "api graphql") return Effect.succeed(fakeHandle(threadsJson));
    if (route === "run list") return Effect.succeed(fakeHandle("[]"));
    const answer = answerFor(answers, command.args);
    return Ref.update(restCalls, A.append(A.join(command.args, " "))).pipe(
      Effect.as(answer === "fail" ? fakeHandle("gh: API rate limit exceeded", 1) : fakeHandle(answer))
    );
  });

const statusPlatform = Layer.mergeAll(
  MemoryFileSystem.layer,
  Path.layer,
  BunCrypto.layer,
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.succeed(fakeHandle("")))
  )
);

const writeBoundCloseout = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const closeoutPath = yield* runArtifactPathForContext(context, "pr-closeout.json");
  yield* fs.makeDirectory(path.dirname(closeoutPath), { recursive: true });
  const json = yield* PrCloseoutReportJson.encode(
    PrCloseoutReport.make({
      actionableReviewThreadCount: 0,
      botCommentCount: 0,
      greptile: GreptileSummary.make({ issueCount: 0, score: "5/5" }),
      issueCount: 0,
      issues: [],
      prNumber: 42,
      prUrl: "https://github.com/beep/beep/pull/42",
      reviewedHeadSha: O.some(headSha),
      retriggeredGreptile: false,
      schemaVersion: "yeet-pr-closeout/v1",
    })
  );
  yield* fs.writeFileString(closeoutPath, json);
});

const statusWith = Effect.fn("statusWith")(function* (answers: Answers, bucket: "pass" | "pending" = "pass") {
  const restCalls = yield* Ref.make<ReadonlyArray<string>>([]);
  const snapshot = yield* collectYeetStatus(context, true).pipe(
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, ghRunner(answers, bucket, restCalls))
  );
  return { snapshot, restCalls: yield* Ref.get(restCalls) };
});

it.layer(statusPlatform, { timeout: "30 seconds" })("status read with the review window", (it) => {
  it.effect("holds a green, thread-free pull request until its review window has elapsed", () =>
    Effect.gen(function* () {
      yield* writeBoundCloseout;
      const answers = { timeline: "2026-10-06T10:00:00Z", suites: "2026-10-06T09:30:00Z" };
      yield* TestClock.setTime(millis("2026-10-06T10:07:00Z"));
      const held = yield* statusWith(answers);
      expect(O.getOrThrow(held.snapshot.mergeReady)).toMatchObject({
        ready: false,
        failing: O.some("review-window-elapsed"),
      });
      expect(renderYeetStatusSummary(held.snapshot)).toContain(
        "merge-ready: no, blocked on review-window-elapsed: review window open: 13 min left"
      );
      expect(held.snapshot.nextCommand).toContain("wait for the review window");
      yield* TestClock.adjust(Duration.minutes(13));
      const ready = yield* statusWith(answers);
      expect(O.getOrThrow(ready.snapshot.mergeReady).ready).toBe(true);
      expect(renderYeetStatusSummary(ready.snapshot)).toContain("merge-ready: yes");
      expect(ready.snapshot.nextCommand).toContain("re-read the review threads");
    }).pipe(noOverride)
  );

  it.effect("reads a failed timeline query as unknown and stays not ready", () =>
    Effect.gen(function* () {
      yield* writeBoundCloseout;
      yield* TestClock.setTime(millis("2027-01-01T00:00:00Z"));
      const { snapshot } = yield* statusWith({ timeline: "fail", suites: "2026-10-06T09:30:00Z" });
      expect(O.getOrThrow(snapshot.mergeReady)).toMatchObject({
        ready: false,
        failing: O.some("review-window-elapsed"),
      });
      expect(O.map(snapshot.remote.reviewWindow, (window) => window._tag)).toEqual(O.some("unknown"));
      expect(renderYeetStatusSummary(snapshot)).toContain("review window unknown: the timeline of pull request #42");
    }).pipe(noOverride)
  );

  it.effect("does not spend the REST reads while another criterion still blocks", () =>
    Effect.gen(function* () {
      yield* writeBoundCloseout;
      const { snapshot, restCalls } = yield* statusWith({ timeline: "2026-10-06T10:00:00Z" }, "pending");
      expect(O.getOrThrow(snapshot.mergeReady).failing).toEqual(O.some("required-checks-green"));
      expect(O.isNone(snapshot.remote.reviewWindow)).toBe(true);
      expect(restCalls).toEqual([]);
    }).pipe(noOverride)
  );
});
