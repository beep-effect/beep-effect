import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
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
  readYeetReviewWindowAsGhLogin,
  renderYeetReviewWindow,
  renderYeetReviewWindowHold,
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
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import { githubCallLine, provideLegacyGh, recordedGithub, restPullRequest } from "./support/YeetGithub.ts";
import type { YeetReviewWindow } from "@beep/repo-cli/test/Yeet";
import type { GithubAnswer } from "./support/YeetGithub.ts";

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
    assertTrue(O.some(elapsed).pipe(yeetReviewWindowElapsed));
    assertFalse(O.some(open).pipe(yeetReviewWindowElapsed));
    assertFalse(O.some(unknown).pipe(yeetReviewWindowElapsed));
    assertFalse(O.none().pipe(yeetReviewWindowElapsed));
    expect(renderYeetReviewWindow(unknown)).toBe(
      "review window unknown: timeline unreadable; unknown never counts as elapsed"
    );
  });
});

// One scripted GitHub answer, written as the lines the pre-W6 `gh api --jq`
// read printed (`<event>\t<created_at>` timeline lines, one check-suite
// instant per line, the pull request's `created_at`), a failed call, or a
// payload that does not decode (what a clipped capture was).
type Answer = string | "fail" | "clipped";
interface Answers {
  readonly pull?: Answer;
  readonly suites?: Answer;
  readonly timeline?: Answer;
}

type Endpoint = "pull" | "suites" | "timeline";

const endpointOf = (path: string): Endpoint =>
  Str.includes("/timeline")(path) ? "timeline" : Str.includes("/check-suites")(path) ? "suites" : "pull";

const linesOf = (text: string): ReadonlyArray<string> =>
  A.filter(A.map(Str.split(text, "\n"), Str.trim), Str.isNonEmpty);

// The REST payload GitHub would have sent for the printed lines.
const restBody = (endpoint: Endpoint, text: string): unknown => {
  if (endpoint === "timeline") {
    return A.map(linesOf(text), (line) => {
      const [event, createdAt] = Str.split(line, "\t");
      return { event, created_at: createdAt };
    });
  }
  if (endpoint === "suites") {
    const instants = linesOf(text);
    return { total_count: A.length(instants), check_suites: A.map(instants, (created_at) => ({ created_at })) };
  }
  return restPullRequest({ number: 42, created_at: Str.trim(text) });
};

const answerOf = (answers: Answers, endpoint: Endpoint): Answer => answers[endpoint] ?? "fail";

const restAnswer = (answer: Answer, endpoint: Endpoint): GithubAnswer =>
  answer === "fail"
    ? { status: 403, body: { message: "API rate limit exceeded" } }
    : answer === "clipped"
      ? { body: endpoint === "timeline" ? [{ event: 42 }] : { clipped: true } }
      : { body: restBody(endpoint, answer) };

const reviewGithub = (answers: Answers) =>
  recordedGithub((call) => {
    const endpoint = endpointOf(call.path);
    return restAnswer(answerOf(answers, endpoint), endpoint);
  });

const reviewReadPlatform = Layer.provideMerge(
  Git.layer,
  Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, MemoryFileSystem.layer)
);

const readWith = Effect.fn("readWith")(function* (answers: Answers) {
  const github = reviewGithub(answers);
  const window = yield* readYeetReviewWindow({ prNumber: 42, headSha }).pipe(github.provide);
  return { window, calls: A.map(github.calls, githubCallLine) };
});

it.layer(reviewReadPlatform, { timeout: "30 seconds" })("review window read", (it) => {
  it.effect("reads the window open on the test clock, then elapsed once the clock passes it", () =>
    Effect.gen(function* () {
      const answers = {
        timeline: "ready_for_review\t2026-10-06T09:00:00Z",
        suites: "2026-10-06T10:00:05Z\n2026-10-06T10:00:00Z\n",
      };
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
});

it.layer(reviewReadPlatform, { timeout: "30 seconds" })("review window read", (it) => {
  it.effect("a new push to the head restarts a window that had elapsed", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(millis("2026-10-06T10:21:00Z"));
      const before = yield* readWith({
        timeline: "ready_for_review\t2026-10-06T09:00:00Z",
        suites: "2026-10-06T10:00:00Z",
      });
      expect(before.window._tag).toBe("elapsed");
      const after = yield* readWith({
        timeline: "ready_for_review\t2026-10-06T09:00:00Z",
        suites: "2026-10-06T10:15:00Z",
      });
      expect(after.window).toMatchObject({ _tag: "open", anchor: "head-push", remainingMs: 14 * 60_000 });
    }).pipe(noOverride)
  );

  it.effect("a force-push back to a commit GitHub already knew restarts the window", () =>
    Effect.gen(function* () {
      // Flip 10:00, A first received 10:05, B 10:10, A force-pushed again 10:30:
      // A's check suites still say 10:05, so the force-push event is the push.
      yield* TestClock.setTime(millis("2026-10-06T10:40:00Z"));
      const forced = yield* readWith({
        timeline: "ready_for_review\t2026-10-06T10:00:00Z\nhead_ref_force_pushed\t2026-10-06T10:30:00Z",
        suites: "2026-10-06T10:05:00Z",
      });
      expect(forced.window).toMatchObject({
        _tag: "open",
        anchor: "head-push",
        anchoredAt: "2026-10-06T10:30:00.000Z",
        remainingMs: 10 * 60_000,
      });
      // A force-push older than the head's first receipt never moves the push back.
      const older = yield* readWith({
        timeline: "ready_for_review\t2026-10-06T10:00:00Z\nhead_ref_force_pushed\t2026-10-06T09:50:00Z",
        suites: "2026-10-06T10:05:00Z",
      });
      expect(older.window).toMatchObject({ _tag: "elapsed", anchoredAt: "2026-10-06T10:05:00.000Z" });
      // Any other timeline event is not a push and moves nothing: the window still
      // runs from the head's first receipt.
      const other = yield* readWith({
        timeline: "ready_for_review\t2026-10-06T10:00:00Z\nlabeled\t2026-10-06T10:35:00Z",
        suites: "2026-10-06T10:05:00Z",
      });
      expect(other.window).toMatchObject({ _tag: "elapsed", anchoredAt: "2026-10-06T10:05:00.000Z" });
    }).pipe(noOverride)
  );

  it.effect("uses the latest ready-for-review event when it is later than the push", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(millis("2026-10-06T10:25:00Z"));
      const { window } = yield* readWith({
        timeline: "ready_for_review\t2026-10-06T08:00:00Z\nready_for_review\t2026-10-06T10:10:00Z",
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
      expect(A.some(calls, Str.includes("GET {repo}/pulls/42"))).toBe(true);
    }).pipe(noOverride)
  );

  it.effect.each([
    ["a failed timeline query", { suites: "2026-10-06T10:00:00Z" }, "timeline of pull request #42"],
    [
      "a timeline that does not decode",
      { timeline: "clipped", suites: "2026-10-06T10:00:00Z" },
      "timeline of pull request #42",
    ],
    // Fail closed: one event the window counts from without an instant voids the
    // read, so a push that cannot be dated never lets the window look elapsed.
    [
      "a ready event whose instant does not parse",
      { timeline: "ready_for_review\tnot-a-date", suites: "2026-10-06T10:00:00Z", pull: "2026-10-06T09:00:00Z" },
      "timeline of pull request #42",
    ],
    [
      "a force-push whose instant does not parse beside a datable flip",
      {
        timeline: "ready_for_review\t2026-10-06T09:00:00Z\nhead_ref_force_pushed\tnot-a-date",
        suites: "2026-10-06T10:00:00Z",
      },
      "timeline of pull request #42",
    ],
    [
      "a force-push with no instant at all",
      { timeline: "ready_for_review\t2026-10-06T09:00:00Z\nhead_ref_force_pushed", suites: "2026-10-06T10:00:00Z" },
      "timeline of pull request #42",
    ],
    [
      "check suites that do not decode",
      { timeline: "ready_for_review\t2026-10-06T09:00:00Z", suites: "clipped" },
      `check suites of head ${headSha}`,
    ],
    [
      "a failed check-suite query",
      { timeline: "ready_for_review\t2026-10-06T09:00:00Z" },
      `check suites of head ${headSha}`,
    ],
    [
      "a head with no check suite",
      { timeline: "ready_for_review\t2026-10-06T09:00:00Z", suites: "" },
      "no check suite yet",
    ],
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
      assertFalse(O.some(window).pipe(yeetReviewWindowElapsed));
    }).pipe(noOverride)
  );

  it.effect("honours the environment override and refuses one that is not a duration", () =>
    Effect.gen(function* () {
      const answers = { timeline: "ready_for_review\t2026-10-06T09:00:00Z", suites: "2026-10-06T10:00:00Z" };
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

describe("review window lines", () => {
  it("names a pull request opened ready, and the hold detail only when the window is the blocker", () => {
    const opened = YeetReviewWindowElapsed.make({
      anchor: "pr-opened",
      anchoredAt: "2026-10-06T10:00:00.000Z",
      windowMs: 20 * 60_000,
    });
    expect(renderYeetReviewWindow(opened)).toBe(
      "review window elapsed (20 min after it was opened ready for review at 2026-10-06T10:00:00.000Z)"
    );
    expect(renderYeetReviewWindowHold(O.some("review-window-elapsed"), O.none())).toBe(": review window not read");
    expect(renderYeetReviewWindowHold(O.some("review-window-elapsed"), O.some(opened))).toBe(
      `: ${renderYeetReviewWindow(opened)}`
    );
    expect(renderYeetReviewWindowHold(O.some("threads-resolved"), O.some(opened))).toBe("");
  });
});

// The wrapper the status and watch surfaces read the window through.
it.layer(reviewReadPlatform, { timeout: "30 seconds" })("review window read as the gh login", (it) => {
  it.effect("reads the window through the surface's gh login", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(millis("2027-01-01T00:00:00Z"));
      const github = reviewGithub({
        timeline: "ready_for_review\t2026-10-06T09:00:00Z",
        suites: "2026-10-06T10:00:00Z",
      });
      const window = yield* readYeetReviewWindowAsGhLogin(context, { prNumber: 42, headSha }).pipe(github.provide);
      expect(window._tag).toBe("elapsed");
      expect(A.length(github.calls)).toBe(2);
    }).pipe(noOverride)
  );

  it.effect("reads a login that does not build as unknown, never as elapsed", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(millis("2027-01-01T00:00:00Z"));
      const window = yield* readYeetReviewWindowAsGhLogin({ prNumber: 42, headSha })(context).pipe(
        provideSpawner(ScriptedSpawner.make(() => ({ exit: 1 })))
      );
      expect(window._tag).toBe("unknown");
      expect(renderYeetReviewWindow(window)).toContain("review window unknown: GitHub access failed (");
      expect(renderYeetReviewWindow(window)).not.toContain(".;");
    }).pipe(noOverride)
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
    assertFalse(ready.ready);
    assertSome(ready.failing, "review-window-elapsed");
    // Everything else holds, so this is the read that must take the window.
    assertTrue(yeetReviewWindowDue(ready.criteria));
  });

  it("is ready once the window has elapsed", () => {
    const ready = O.getOrThrow(deriveYeetMergeReady(boundCloseout, greenRemote({ reviewWindow: O.some(elapsed) })));
    assertTrue(ready.ready);
    assertNone(ready.failing);
  });

  it("asks a green draft for the flip, not for the review window", () => {
    const remote = YeetStatusRemote.make({ ...greenRemote({ isDraft: true }), mergeStateStatus: "DRAFT" });
    const ready = O.getOrThrow(deriveYeetMergeReady(boundCloseout, remote));
    assertSome(ready.failing, "not-draft");
    assertFalse(yeetReviewWindowDue(ready.criteria));
    assertTrue(deriveYeetReadyPendingFlip(remote, ready));
  });
});

const pullRequestJson =
  '{"headRefOid":"abc1234def","id":"PR_window","isDraft":false,"labels":[],"mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","number":42,"reviewDecision":null,"state":"OPEN","url":"https://github.com/beep/beep/pull/42"}';
const checksJson = (bucket: "pass" | "pending") =>
  `[{"bucket":"${bucket}","completedAt":"2026-10-06T10:00:00Z","link":"","name":"Check","startedAt":"2026-10-06T10:00:00Z","state":"${bucket === "pass" ? "SUCCESS" : "QUEUED"}","workflow":"Check"}]`;
const threadsJson =
  '{"data":{"node":{"author":{"login":"author"},"reviewThreads":{"nodes":[],"pageInfo":{"endCursor":null,"hasNextPage":false}}}}}';

// The whole `gh` surface `collectYeetStatus` reads, with the REST review-window
// reads scripted separately from the GraphQL thread read.
const statusAnswers = (bucket: "pass" | "pending"): Record<string, string> => ({
  "pr view": pullRequestJson,
  "pr checks": checksJson(bucket),
  "api graphql": threadsJson,
  "run list": "[]",
});
const ghRoute = (args: ReadonlyArray<string>) => A.join(A.take(args, 2), " ");
// A kit REST read reaches the scripted `gh` as `api repos/{owner}/{repo}/<path>`;
// it prints GitHub's JSON, or fails.
const ghRestAnswer = (answers: Answers, args: ReadonlyArray<string>) => {
  const endpoint = endpointOf(O.getOrElse(A.findFirst(args, Str.startsWith("repos/")), () => ""));
  const answer = restAnswer(answerOf(answers, endpoint), endpoint);
  return answer.status === undefined
    ? { stdout: Result.getOrThrow(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(answer.body)) }
    : { stdout: "gh: API rate limit exceeded", exit: 1 };
};
const ghRunner = (answers: Answers, bucket: "pass" | "pending") =>
  ScriptedSpawner.make((command, args) =>
    command === "gh"
      ? O.match(R.get(statusAnswers(bucket), ghRoute(args)), {
          onNone: () => ghRestAnswer(answers, args),
          onSome: (stdout) => ({ stdout }),
        })
      : {}
  );
// The REST review-window reads: every `gh` call outside the status surface.
const restCallsOf = (spawner: ScriptedSpawner, bucket: "pass" | "pending") =>
  A.map(
    A.filter(spawner.spawns, (spawn) => spawn.command === "gh" && !R.has(statusAnswers(bucket), ghRoute(spawn.args))),
    (spawn) => A.join(spawn.args, " ")
  );

const statusPlatform = Layer.mergeAll(
  MemoryFileSystem.layer,
  Path.layer,
  BunCrypto.layer,
  ScriptedSpawner.make(() => ({})).layer
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
  const spawner = ghRunner(answers, bucket);
  const snapshot = yield* collectYeetStatus(context, true).pipe(
    provideLegacyGh,
    Effect.provideServiceEffect(Git, Git.make),
    provideSpawner(spawner)
  );
  return { snapshot, restCalls: restCallsOf(spawner, bucket) };
});

it.layer(statusPlatform, { timeout: "30 seconds" })("status read with the review window", (it) => {
  it.effect("holds a green, thread-free pull request until its review window has elapsed", () =>
    Effect.gen(function* () {
      yield* writeBoundCloseout;
      const answers = { timeline: "ready_for_review\t2026-10-06T10:00:00Z", suites: "2026-10-06T09:30:00Z" };
      yield* TestClock.setTime(millis("2026-10-06T10:07:00Z"));
      const held = yield* statusWith(answers);
      assertFalse(O.getOrThrow(held.snapshot.mergeReady).ready);
      assertSome(O.getOrThrow(held.snapshot.mergeReady).failing, "review-window-elapsed");
      expect(renderYeetStatusSummary(held.snapshot)).toContain(
        "merge-ready: no, blocked on review-window-elapsed: review window open: 13 min left"
      );
      expect(held.snapshot.nextCommand).toContain("wait for the review window");
      yield* TestClock.adjust(Duration.minutes(13));
      const ready = yield* statusWith(answers);
      assertTrue(O.getOrThrow(ready.snapshot.mergeReady).ready);
      expect(renderYeetStatusSummary(ready.snapshot)).toContain("merge-ready: yes");
      expect(ready.snapshot.nextCommand).toContain("re-read the review threads");
    }).pipe(noOverride)
  );
});

it.layer(statusPlatform, { timeout: "30 seconds" })("status read with the review window", (it) => {
  it.effect("reads a failed timeline query as unknown and stays not ready", () =>
    Effect.gen(function* () {
      yield* writeBoundCloseout;
      yield* TestClock.setTime(millis("2027-01-01T00:00:00Z"));
      const { snapshot } = yield* statusWith({ timeline: "fail", suites: "2026-10-06T09:30:00Z" });
      assertFalse(O.getOrThrow(snapshot.mergeReady).ready);
      assertSome(O.getOrThrow(snapshot.mergeReady).failing, "review-window-elapsed");
      assertSome(
        O.map(snapshot.remote.reviewWindow, (window) => window._tag),
        "unknown"
      );
      expect(renderYeetStatusSummary(snapshot)).toContain("review window unknown: the timeline of pull request #42");
    }).pipe(noOverride)
  );

  it.effect("does not spend the REST reads while another criterion still blocks", () =>
    Effect.gen(function* () {
      yield* writeBoundCloseout;
      const { snapshot, restCalls } = yield* statusWith(
        { timeline: "ready_for_review\t2026-10-06T10:00:00Z" },
        "pending"
      );
      assertSome(O.getOrThrow(snapshot.mergeReady).failing, "required-checks-green");
      assertNone(snapshot.remote.reviewWindow);
      expect(restCalls).toEqual([]);
    }).pipe(noOverride)
  );
});
