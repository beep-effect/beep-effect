import {
  acknowledgeYeetMonitorComments,
  collectNewYeetMonitorComments,
  loadYeetMonitorCommentWatermark,
  openYeetMonitorCommentStream,
  pollYeetPrCommentRows,
  RepoRunContext,
  replayYeetMonitorComments,
  YEET_MONITOR_COMMENT_EXCERPT_LENGTH,
  YeetInboxRowJson,
  YeetMonitorCommentConsumer,
  YeetMonitorCommentCursor,
  YeetMonitorCommentState,
  YeetMonitorCommentStateJson,
  YeetMonitorCommentWatermark,
  YeetMonitorIssueComment,
  YeetMonitorReviewComment,
  YeetPrCommentCapsule,
  YeetPrCommentWindow,
  yeetMonitorCommentStateFileName,
  yeetMonitorCommentStatePath,
  yeetPrCommentCapsule,
  yeetPrCommentRowId,
} from "@beep/repo-cli/test/Yeet";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Path, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import type { YeetPrCommentRow } from "@beep/repo-cli/test/Yeet";

// pr-event-awareness W4 (D13/D21/D32/D33): the `--until-ready` merge loop turns
// top-level comments from people other than the acting login into P1
// `pr-comment` rows, from its own comment watermark, bounded to comments
// created after the monitor job was submitted.

const PR = 900;
const HEAD = "abc1234def";
const ACTING = "operator";
// The shared position an earlier `--watch` or `yeet monitor` left behind.
const SHARED_AT = "2026-09-20T00:00:00.000Z";
// A comment posted after that position but before this job was submitted.
const BEFORE_SUBMIT = "2026-09-24T12:00:00Z";
const SUBMITTED_AT = "2026-09-25T00:00:00.000Z";
const AFTER_SUBMIT = "2026-09-25T00:05:00Z";
const LATER = "2026-09-25T00:09:00Z";
const POLLED_AT = "2026-09-25T00:10:00.000Z";
const encoder = new TextEncoder();

type Endpoint = "issues" | "reviews" | "review-comments";
type Payloads = Readonly<Record<Endpoint, ReadonlyArray<unknown>>>;

const noPayloads: Payloads = { issues: [], reviews: [], "review-comments": [] };

const endpointOf = (commandLine: string): Endpoint =>
  Str.includes("/issues/")(commandLine)
    ? "issues"
    : Str.includes("/reviews")(commandLine)
      ? "reviews"
      : "review-comments";

const stubHandle = (output: string) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(encoder.encode(output)),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
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

// `gh api --paginate --slurp` answers with one array of pages; the stub serves
// whatever the test last put in `payloads` for the endpoint and records the call.
const ghSpawner = (payloads: Ref.Ref<Payloads>, commands: Ref.Ref<ReadonlyArray<string>>) =>
  ChildProcessSpawner.make((command) => {
    if (!ChildProcess.isStandardCommand(command)) return Effect.die("the comment poll never pipes a command");
    const line = A.join([command.command, ...command.args], " ");
    return Ref.update(commands, A.append(line)).pipe(
      Effect.andThen(Ref.get(payloads)),
      Effect.map((current) => stubHandle(JSON.stringify([current[endpointOf(line)]])))
    );
  });

const issue = (id: number, login: string | null, createdAt: string, body = "Please rebase onto main.") => ({
  body,
  created_at: createdAt,
  html_url: `https://github.com/o/r/pull/${PR}#issuecomment-${id}`,
  id,
  user: login === null ? null : { login },
});

const inline = (id: number, login: string, createdAt: string) => ({
  body: "Nit: rename this.",
  created_at: createdAt,
  html_url: `https://github.com/o/r/pull/${PR}#discussion_r${id}`,
  id,
  line: 12,
  original_line: 12,
  path: "src/Monitor.ts",
  user: { login },
});

const review = (id: number, login: string, submittedAt: string, body: string) => ({
  body,
  html_url: `https://github.com/o/r/pull/${PR}#pullrequestreview-${id}`,
  id,
  state: "COMMENTED",
  submitted_at: submittedAt,
  user: { login },
});

const contextFor = (root: string) =>
  RepoRunContext.make({
    base: "origin/main",
    branch: "feat/comment-rows",
    cwd: root,
    head: "HEAD",
    originalArgv: [],
    packetDir: root,
    repoRoot: root,
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });

const windowFor = (since = SUBMITTED_AT, headSha = HEAD) =>
  YeetPrCommentWindow.make({ actingLogin: ACTING, headSha, prNumber: PR, since });

const stateAt = (createdAt: string, id: number) => {
  const cursor = YeetMonitorCommentCursor.make({ createdAt, id });
  return YeetMonitorCommentState.make({
    schemaVersion: "yeet-monitor-comments/v2",
    prNumber: PR,
    updatedAt: createdAt,
    watermark: YeetMonitorCommentWatermark.make({ issue: cursor, review: cursor, reviewBody: cursor }),
  });
};

const writeState = Effect.fnUntraced(function* (
  context: RepoRunContext,
  consumer: YeetMonitorCommentConsumer,
  state: YeetMonitorCommentState
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const statePath = yield* yeetMonitorCommentStatePath(context, consumer);
  yield* fs.makeDirectory(path.dirname(statePath), { recursive: true });
  yield* fs.writeFileString(statePath, yield* YeetMonitorCommentStateJson.encode(state));
});

const issueCursor = (context: RepoRunContext, consumer: YeetMonitorCommentConsumer) =>
  loadYeetMonitorCommentWatermark(context, PR, consumer).pipe(
    Effect.map(O.map((watermark) => [watermark.issue.createdAt, watermark.issue.id] as const))
  );

const commentRows = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = `${root}/.beep/inbox/failures.ndjson`;
  if (!(yield* fs.exists(path))) return A.empty<YeetPrCommentRow>();
  const text = yield* fs.readFileString(path);
  return A.filter(
    A.flatMap(Str.split(text, "\n"), (line) => O.toArray(YeetInboxRowJson.decodeOption(line))),
    (row): row is YeetPrCommentRow => row.kind === "pr-comment"
  );
});

// A shared-position consumer's poll, as `--watch` runs it: collect, then acknowledge.
const pollAndAcknowledgeShared = Effect.fnUntraced(function* (
  context: RepoRunContext,
  watermark: Ref.Ref<YeetMonitorCommentWatermark>
) {
  const comments = yield* collectNewYeetMonitorComments(context, PR, watermark);
  yield* acknowledgeYeetMonitorComments(context, PR, watermark, comments);
  return A.map(comments, (comment) => comment.id);
});

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, NodeCrypto.layer);

// A fresh checkout and `gh` stub per test; the platform comes from `it.layer`
// and the temp checkout lives in the test's own scope.
const withCheckout = Effect.fnUntraced(function* <Value, Failure, Requirements>(
  use: (
    root: string,
    payloads: Ref.Ref<Payloads>,
    commands: Ref.Ref<ReadonlyArray<string>>
  ) => Effect.Effect<Value, Failure, Requirements>
) {
  const payloads = yield* Ref.make(noPayloads);
  const commands = yield* Ref.make<ReadonlyArray<string>>(A.empty());
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-comment-rows-" });
  return yield* use(root, payloads, commands).pipe(
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, ghSpawner(payloads, commands))
  );
});

describe("pr-comment capsule", () => {
  const comment = (author: string, createdAt = AFTER_SUBMIT, body = "Please rebase onto main.") =>
    YeetMonitorIssueComment.make({
      author,
      body,
      createdAt,
      id: 44,
      url: `https://github.com/o/r/pull/${PR}#issuecomment-44`,
    });

  it("carries the URL, the author and the head observed, keyed on the comment id", () => {
    assertSome(
      yeetPrCommentCapsule(comment("reviewer"), windowFor()),
      YeetPrCommentCapsule.make({
        author: "reviewer",
        commentId: 44,
        createdAt: AFTER_SUBMIT,
        excerpt: "Please rebase onto main.",
        headSha: HEAD,
        link: `https://github.com/o/r/pull/${PR}#issuecomment-44`,
        prNumber: PR,
        source: "issue",
      })
    );
  });

  it("writes no row for a bot, the acting login, a deleted account, or an inline review comment", () => {
    const refused = [
      comment("github-actions[bot]"),
      // A review bot posting under a login without the suffix reads as a bot by
      // the review-body signal rules.
      comment("greptile-apps"),
      comment("Operator"),
      comment("unknown"),
      YeetMonitorReviewComment.make({
        author: "reviewer",
        body: "Nit: rename this.",
        createdAt: AFTER_SUBMIT,
        id: 45,
        line: O.some(12),
        path: "src/Monitor.ts",
        url: `https://github.com/o/r/pull/${PR}#discussion_r45`,
      }),
    ];
    expect(A.map(refused, (value) => O.isNone(yeetPrCommentCapsule(value, windowFor())))).toStrictEqual(
      A.map(refused, () => true)
    );
  });

  it("compares the window by instant: a comment in the submit second but before it is outside", () => {
    // GitHub stamps whole seconds; the window start carries milliseconds.
    const window = windowFor("2026-09-25T00:05:00.500Z");
    assertNone(yeetPrCommentCapsule(comment("reviewer", "2026-09-25T00:05:00Z"), window));
    assertSome(
      O.map(yeetPrCommentCapsule(comment("reviewer", "2026-09-25T00:05:01Z"), window), (value) => value.createdAt),
      "2026-09-25T00:05:01Z"
    );
  });

  it("bounds the excerpt to about 200 characters, whitespace collapsed, with an ellipsis", () => {
    const body = `First line.\n\n   Second   line.  ${"x".repeat(400)}`;
    const excerpt = O.map(
      yeetPrCommentCapsule(comment("reviewer", AFTER_SUBMIT, body), windowFor()),
      (value) => value.excerpt
    );
    assertSome(O.map(excerpt, Str.startsWith("First line. Second line. xxx")), true);
    assertSome(O.map(excerpt, Str.endsWith("…")), true);
    assertSome(O.map(excerpt, Str.length), YEET_MONITOR_COMMENT_EXCERPT_LENGTH + 1);
    assertSome(
      O.map(
        yeetPrCommentCapsule(comment("reviewer", AFTER_SUBMIT, "short\nbody"), windowFor()),
        (value) => value.excerpt
      ),
      "short body"
    );
  });
});

it.layer(PlatformLayer, { timeout: "30 seconds" })("per-consumer comment watermark", (it) => {
  it.effect("names one position file per consumer, and every shared surface keeps the original", () =>
    withCheckout((root) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const context = contextFor(root);
        expect(A.map(YeetMonitorCommentConsumer.Options, yeetMonitorCommentStateFileName)).toStrictEqual([
          "monitor-comments.json",
          "monitor-comments.until-ready.json",
          "monitor-comments.until-merged.json",
        ]);
        const shared = yield* yeetMonitorCommentStatePath(context);
        const untilReady = yield* yeetMonitorCommentStatePath(context, "until-ready");
        expect(shared).toBe(yield* yeetMonitorCommentStatePath(context, "shared"));
        expect(path.basename(shared)).toBe("monitor-comments.json");
        expect(path.dirname(untilReady)).toBe(path.dirname(shared));
        expect(untilReady).not.toBe(shared);
      })
    )
  );

  it.effect("keeps separate watermarks for --watch and --until-ready on one branch", () =>
    withCheckout((root, payloads) =>
      Effect.gen(function* () {
        const context = contextFor(root);
        yield* writeState(context, "shared", stateAt(SHARED_AT, 1));
        yield* Ref.set(payloads, { ...noPayloads, issues: [issue(50, "reviewer", AFTER_SUBMIT)] });

        // The until-ready consumer reads and advances only its own position.
        yield* pollYeetPrCommentRows(context, windowFor(), POLLED_AT);
        assertSome(yield* issueCursor(context, "until-ready"), [AFTER_SUBMIT, 50]);
        assertSome(yield* issueCursor(context, "shared"), [SHARED_AT, 1]);

        // A `--watch` on the same branch still sees the comment the rows consumed,
        // and acknowledging it there leaves the until-ready position alone.
        yield* Ref.set(payloads, {
          ...noPayloads,
          issues: [issue(50, "reviewer", AFTER_SUBMIT), issue(51, "reviewer", LATER)],
        });
        const watch = yield* openYeetMonitorCommentStream(context, PR);
        const seen = yield* pollAndAcknowledgeShared(context, watch);
        expect(seen).toStrictEqual([50, 51]);
        assertSome(yield* issueCursor(context, "shared"), [LATER, 51]);
        assertSome(yield* issueCursor(context, "until-ready"), [AFTER_SUBMIT, 50]);
      })
    )
  );

  it.effect("replays no history as rows on the first namespaced run, and none as lines either", () =>
    withCheckout((root, payloads, commands) =>
      Effect.gen(function* () {
        const context = contextFor(root);
        // An unnamespaced position from before the split, and a person's comment
        // after it that no run has printed yet.
        yield* writeState(context, "shared", stateAt(SHARED_AT, 1));
        yield* Ref.set(payloads, { ...noPayloads, issues: [issue(60, "reviewer", BEFORE_SUBMIT)] });

        expect(yield* pollYeetPrCommentRows(context, windowFor(), POLLED_AT)).toStrictEqual([]);
        expect(yield* commentRows(root)).toStrictEqual([]);
        assertSome(yield* issueCursor(context, "until-ready"), [SUBMITTED_AT, 0]);

        // The until-merged replay's first namespaced run prints only its start
        // line and makes no GitHub read. The block shares one TestConsole, so
        // read only the lines the replay printed.
        const before = A.length(yield* Ref.get(commands));
        const logged = A.length(yield* TestConsole.logLines);
        yield* replayYeetMonitorComments(context, PR, "until-merged");
        expect(A.length(yield* Ref.get(commands))).toBe(before);
        const printed = A.join(A.map(A.drop(yield* TestConsole.logLines, logged), String), "\n");
        expect(printed).toContain(`[yeet] comment replay: no watermark for #${PR}`);
        expect(printed).not.toContain("Please rebase onto main.");
        assertSome(yield* issueCursor(context, "shared"), [SHARED_AT, 1]);
      })
    )
  );

  it.effect("seeds from the shared position when it is later than the window start", () =>
    withCheckout((root, payloads) =>
      Effect.gen(function* () {
        const context = contextFor(root);
        // A `--watch` already printed everything up to LATER on this branch.
        yield* writeState(context, "shared", stateAt(LATER, 70));
        yield* Ref.set(payloads, { ...noPayloads, issues: [issue(69, "reviewer", AFTER_SUBMIT)] });

        expect(yield* pollYeetPrCommentRows(context, windowFor(), POLLED_AT)).toStrictEqual([]);
        assertSome(yield* issueCursor(context, "until-ready"), [LATER, 70]);
      })
    )
  );
});

it.layer(PlatformLayer, { timeout: "30 seconds" })("until-ready comment rows", (it) => {
  it.effect("bounds the backlog to comments created after the job's submit time", () =>
    withCheckout((root, payloads) =>
      Effect.gen(function* () {
        const context = contextFor(root);
        // A previous run's position, older than this job: the comment between
        // it and the submit is the accepted miss, read once and never a row.
        yield* writeState(context, "until-ready", stateAt(SHARED_AT, 1));
        yield* Ref.set(payloads, {
          issues: [issue(80, "reviewer", BEFORE_SUBMIT), issue(81, "reviewer", AFTER_SUBMIT)],
          reviews: [review(82, "maintainer", LATER, "Looks close; one question on the retry path.")],
          "review-comments": [],
        });

        const appended = yield* pollYeetPrCommentRows(context, windowFor(), POLLED_AT);

        expect(A.map(appended, (row) => [row.capsule.commentId, row.capsule.source, row.severity])).toStrictEqual([
          [81, "issue", "P1"],
          [82, "review-body", "P1"],
        ]);
        expect(A.map(yield* commentRows(root), (row) => row.id)).toStrictEqual(A.map(appended, (row) => row.id));
        const [first] = appended;
        expect(first?.capsule.link).toBe(`https://github.com/o/r/pull/${PR}#issuecomment-81`);
        expect(first?.capsule.headSha).toBe(HEAD);
        expect(first?.ts).toBe(POLLED_AT);
        // Every collection advanced past everything it read, rows or not.
        assertSome(yield* issueCursor(context, "until-ready"), [AFTER_SUBMIT, 81]);
      })
    )
  );

  it.effect("writes no row for bots, the acting login, deleted accounts, inline comments or replies", () =>
    withCheckout((root, payloads) =>
      Effect.gen(function* () {
        const context = contextFor(root);
        yield* Ref.set(payloads, {
          issues: [
            issue(90, "github-actions[bot]", AFTER_SUBMIT),
            issue(91, "OPERATOR", AFTER_SUBMIT),
            issue(92, null, AFTER_SUBMIT),
            issue(93, "reviewer", LATER),
          ],
          reviews: [review(94, "coderabbitai[bot]", LATER, "**Actionable comments posted: 2**")],
          // A thread-opening inline comment and a reply in the thread: both belong
          // to review threads, which have their own row.
          "review-comments": [inline(95, "reviewer", AFTER_SUBMIT), inline(96, "maintainer", LATER)],
        });

        const appended = yield* pollYeetPrCommentRows(context, windowFor(), POLLED_AT);

        expect(A.map(appended, (row) => [row.capsule.commentId, row.capsule.author])).toStrictEqual([[93, "reviewer"]]);
      })
    )
  );

  it.effect("keeps one row per comment across polls and across a push", () =>
    withCheckout((root, payloads) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const context = contextFor(root);
        yield* Ref.set(payloads, { ...noPayloads, issues: [issue(100, "reviewer", AFTER_SUBMIT)] });

        const [row] = yield* pollYeetPrCommentRows(context, windowFor(), POLLED_AT);
        if (row === undefined) return yield* Effect.die("expected one comment row");
        expect(row.id).toBe(yield* yeetPrCommentRowId(row.capsule));

        // The next poll reads nothing new past the watermark.
        expect(yield* pollYeetPrCommentRows(context, windowFor(), POLLED_AT)).toStrictEqual([]);
        // Losing the position re-reads the comment, and a push moved the head:
        // the id is keyed on the comment, not the head, so nothing is appended.
        yield* fs.remove(yield* yeetMonitorCommentStatePath(context, "until-ready"));
        expect(yield* pollYeetPrCommentRows(context, windowFor(SUBMITTED_AT, "fedcba9876"), POLLED_AT)).toStrictEqual(
          []
        );
        expect(A.map(yield* commentRows(root), (value) => value.id)).toStrictEqual([row.id]);
      })
    )
  );
});
