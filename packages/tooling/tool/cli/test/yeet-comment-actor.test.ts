import {
  GhActor,
  GhRestIssueComment,
  GhRestReview,
  normalizeYeetMonitorIssueCommentForTesting,
  normalizeYeetMonitorReviewBodyForTesting,
  pollYeetPrCommentRows,
  RepoRunContext,
  YeetPrCommentWindow,
  yeetMonitorCommentFromBot,
  yeetPrCommentCapsule,
} from "@beep/repo-cli/test/Yeet";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

// A GitHub App can post under a login without the `[bot]` suffix: Copilot's
// pull request reviewer posts as `Copilot`, and only the REST `user.type`
// (`"Bot"`) says it is not a person. Such a comment must not become a P1
// `pr-comment` row.

const PR = 900;
const HEAD = "abc1234def";
const SUBMITTED_AT = "2026-09-25T00:00:00.000Z";
const AFTER_SUBMIT = "2026-09-25T00:05:00Z";
const POLLED_AT = "2026-09-25T00:10:00.000Z";

interface RestUser {
  readonly login: string;
  readonly type: string;
}

const copilot: RestUser = { login: "Copilot", type: "Bot" };
const person: RestUser = { login: "reviewer", type: "User" };

const issue = (id: number, user: RestUser) => ({
  body: "Consider extracting this into a helper.",
  created_at: AFTER_SUBMIT,
  html_url: `https://github.com/o/r/pull/${PR}#issuecomment-${id}`,
  id,
  user,
});

const review = (id: number, user: RestUser) => ({
  body: "Copilot reviewed 3 out of 3 changed files in this pull request and generated 2 comments.",
  html_url: `https://github.com/o/r/pull/${PR}#pullrequestreview-${id}`,
  id,
  state: "COMMENTED",
  submitted_at: AFTER_SUBMIT,
  user,
});

const window = YeetPrCommentWindow.make({ actingLogin: "operator", headSha: HEAD, prNumber: PR, since: SUBMITTED_AT });

const decodeIssue = S.decodeEffect(GhRestIssueComment);
const decodeReview = S.decodeEffect(GhRestReview);

describe("REST actor type", () => {
  it.effect("keeps the account type a REST payload carries and leaves it absent otherwise", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeIssue(issue(1, copilot));
      assertSome(
        O.flatMap(O.fromNullishOr(decoded.user), (user) => O.fromUndefinedOr(user.type)),
        "Bot"
      );
      assertNone(O.fromUndefinedOr(GhActor.make({ login: "octocat" }).type));
    })
  );

  it.effect("reads a Bot-typed author under a plain login as a bot and builds no comment capsule for it", () =>
    Effect.gen(function* () {
      const comment = normalizeYeetMonitorIssueCommentForTesting(yield* decodeIssue(issue(2, copilot)));
      strictEqual(comment.author, "Copilot");
      assertSome(comment.authorType, "Bot");
      assertTrue(yeetMonitorCommentFromBot(comment));
      assertNone(yeetPrCommentCapsule(comment, window));
    })
  );

  it.effect("reads a Bot-typed review body under a plain login as a bot", () =>
    Effect.gen(function* () {
      const body = normalizeYeetMonitorReviewBodyForTesting(yield* decodeReview(review(3, copilot)));
      assertSome(O.map(body, yeetMonitorCommentFromBot), true);
      assertNone(O.flatMap(body, (value) => yeetPrCommentCapsule(value, window)));
    })
  );

  it.effect("still reads a User-typed author as a person", () =>
    Effect.gen(function* () {
      const comment = normalizeYeetMonitorIssueCommentForTesting(yield* decodeIssue(issue(4, person)));
      assertFalse(yeetMonitorCommentFromBot(comment));
      assertSome(
        O.map(yeetPrCommentCapsule(comment, window), (capsule) => capsule.author),
        "reviewer"
      );
    })
  );
});

const handle = (output: string) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(new TextEncoder().encode(output)),
    stdout: Stream.make(new TextEncoder().encode(output)),
    stderr: Stream.empty,
    stdin: Sink.drain,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    unref: Effect.succeed(Effect.void),
  });

// `gh api --paginate --slurp` answers with one array of pages per collection:
// Copilot and a person each comment, and Copilot submits a review body.
const pagesFor = (commandLine: string): ReadonlyArray<unknown> =>
  Str.includes("/issues/")(commandLine)
    ? [issue(10, copilot), issue(11, person)]
    : Str.includes("/reviews")(commandLine)
      ? [review(12, copilot)]
      : [];

const gh = Layer.succeed(
  ChildProcessSpawner.ChildProcessSpawner,
  ChildProcessSpawner.make((command) => {
    if (!ChildProcess.isStandardCommand(command)) return Effect.die("the comment poll never pipes a command");
    return Effect.succeed(handle(JSON.stringify([pagesFor(A.join([command.command, ...command.args], " "))])));
  })
);

it.layer(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, NodeCrypto.layer, gh), { timeout: "30 seconds" })(
  "until-ready comment rows from a Bot-typed actor",
  (it) => {
    it.effect("writes a row for the person only, never for Copilot's comment or review body", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-comment-actor-" });
        const context = RepoRunContext.make({
          base: "origin/main",
          branch: "feat/comment-actor",
          cwd: root,
          head: "HEAD",
          originalArgv: [],
          packetDir: root,
          repoRoot: root,
          turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
        });

        const appended = yield* pollYeetPrCommentRows(context, window, POLLED_AT);

        deepStrictEqual(
          A.map(appended, (row) => [row.capsule.commentId, row.capsule.author, row.severity]),
          [[11, "reviewer", "P1"]]
        );
      })
    );
  }
);
