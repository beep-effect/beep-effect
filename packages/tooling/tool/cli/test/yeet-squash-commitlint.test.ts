import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  COMMITLINT_MAX_LINE_LENGTH,
  CommitlintRun,
  classifyCommitlintRun,
  GITHUB_SQUASH_BULLET_SEPARATOR,
  GitHubSquashDefaults,
  lintSquashCommitMessage,
  predictSquashCommitMessage,
  RepoRunContext,
  readSquashCommitlint,
  readSquashCommitlintForPullRequest,
  renderSquashCommitlintVerdict,
  renderSquashCommitMessage,
  SQUASH_COMMIT_SUBJECT_MAX_LENGTH,
  SquashCommitlintFail,
  SquashCommitlintOffendingLine,
  SquashCommitMessage,
  SquashMessageSource,
  SquashPullRequestFacts,
  squashCommitlintOffendingLines,
  squashPullRequestTitleMaxLength,
} from "@beep/repo-cli/test/Yeet";
import { NodeChildProcessSpawner, NodeCrypto } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { commandArgs } from "./support/commandArgs.ts";

const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

// This repository's recorded settings (`gh api repos/{owner}/{repo}`, 2026-10-18).
const repoDefaults = GitHubSquashDefaults.make({ title: "COMMIT_OR_PR_TITLE", message: "COMMIT_MESSAGES" });

// The round-2 subject of PR #1913 (ep47): 100 characters, a 102-character bullet after squash.
const longSubject =
  "docs(agent-pool-doctrine): gate the Claude chain Codex step on ordinaryUsageAllowed (review round 2)";
const trailer = "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>";

const commit = (subject: string, body = "") => A.join(A.filter([subject, body, trailer], Str.isNonEmpty), "\n\n");

const source = (
  commitMessages: ReadonlyArray<string>,
  overrides: Partial<Parameters<typeof SquashMessageSource.make>[0]> = {}
) =>
  SquashMessageSource.make({
    prNumber: 1913,
    title: "docs(agent-pool-doctrine): admit Codex as step 2 of the Claude Code fallback chain (R11)",
    body: "## Summary\n\nThe pull request description.",
    commitMessages,
    defaults: repoDefaults,
    commitTitle: O.none(),
    ...overrides,
  });

describe("squash commit message prediction", () => {
  it("a one-commit PR squashes to the commit subject (#n) over the commit body alone", () => {
    const message = predictSquashCommitMessage(
      source([commit("fix(practice-kg-mcp,palantiri): give the test fixtures a tsconfig owner", "The root tsconfig.")])
    );
    expect(message.header).toBe("fix(practice-kg-mcp,palantiri): give the test fixtures a tsconfig owner (#1913)");
    expect(message.body).toBe(`The root tsconfig.\n\n${trailer}`);
    expect(renderSquashCommitMessage(message)).toBe(`${message.header}\n\n${message.body}`);
  });

  it("a three-commit PR squashes to the PR title (#n) over one full-message bullet per commit", () => {
    const commits = [
      commit("docs(agent-pool-doctrine): admit Codex as step 2", "Operator ruling 2026-10-18."),
      commit("chore(doctrine): re-request beep-reviewer for #1913"),
      commit(longSubject, "Every Codex selection point."),
    ];
    const message = predictSquashCommitMessage(source(commits));
    expect(message.header).toBe(
      "docs(agent-pool-doctrine): admit Codex as step 2 of the Claude Code fallback chain (R11) (#1913)"
    );
    expect(message.body).toBe(
      A.join([...A.map(commits, (text) => `* ${text}`), GITHUB_SQUASH_BULLET_SEPARATOR], "\n\n")
    );
    // 5 + 3 + 5 bullet lines, two blank separators, a blank line and the separator.
    expect(A.length(Str.split("\n")(message.body))).toBe(17);
  });

  it("a pinned commit_title overrides the title default, as the merge gate pins it", () => {
    const pinned = predictSquashCommitMessage(
      source([commit("fix(x): one")], { commitTitle: O.some("feat(y): pinned by the gate (#1913)") })
    );
    expect(pinned.header).toBe("feat(y): pinned by the gate (#1913)");
    const prTitle = predictSquashCommitMessage(
      source([commit("fix(x): one")], { defaults: GitHubSquashDefaults.make({ ...repoDefaults, title: "PR_TITLE" }) })
    );
    expect(prTitle.header).toMatch(/^docs\(agent-pool-doctrine\): admit Codex .* \(#1913\)$/u);
  });

  it("mirrors PR_BODY and BLANK message defaults", () => {
    const prBody = predictSquashCommitMessage(
      source([commit("fix(x): one"), commit("fix(x): two")], {
        defaults: GitHubSquashDefaults.make({ ...repoDefaults, message: "PR_BODY" }),
      })
    );
    expect(prBody.body).toBe("## Summary\n\nThe pull request description.");
    const blank = predictSquashCommitMessage(
      source([commit("fix(x): one")], { defaults: GitHubSquashDefaults.make({ ...repoDefaults, message: "BLANK" }) })
    );
    expect(blank.body).toBe("");
    expect(renderSquashCommitMessage(blank)).toBe(blank.header);
  });

  it("never predicts an empty header or an empty-commit body", () => {
    const empty = predictSquashCommitMessage(source([], { title: "" }));
    expect(empty.header).toBe("(#1913)");
    expect(empty.body).toBe("");
  });

  it("finds the lines over the commitlint limit, 1-based, in the rendered text", () => {
    const message = predictSquashCommitMessage(
      source([commit("fix(x): one"), commit(longSubject)], { commitTitle: O.some("fix(x): y (#1913)") })
    );
    const offending = squashCommitlintOffendingLines(message);
    expect(A.map(offending, (line) => [line.line, line.length])).toEqual([[7, COMMITLINT_MAX_LINE_LENGTH + 2]]);
    expect(offending[0]?.text).toBe(`* ${longSubject}`);
    expect(SQUASH_COMMIT_SUBJECT_MAX_LENGTH).toBe(98);
  });

  it("picks the remedy by rule family, then by offending line", () => {
    const over = (line: number) =>
      SquashCommitlintOffendingLine.make({ line, length: 116, text: Str.repeat(116)("x") });
    const render = (rules: ReadonlyArray<string>, lines: ReadonlyArray<SquashCommitlintOffendingLine>) =>
      renderSquashCommitlintVerdict(
        SquashCommitlintFail.make({
          rules: A.isReadonlyArrayNonEmpty(rules) ? rules : ["x-rule"],
          offendingLines: lines,
        })
      );
    // Header-family rules point at the PR title, even with no line over the limit.
    for (const rule of ["subject-case", "type-enum", "header-full-stop", "scope-empty", "header-max-length"]) {
      const line = render([rule], []);
      expect(line).toContain("PR title");
      expect(line).not.toContain("reword commit subjects");
    }
    // Body and footer rules point at the commits.
    const footer = render(["footer-max-line-length"], [over(7)]);
    expect(footer).not.toContain("PR title");
    expect(footer).toContain("reword commit subjects to 98 chars or fewer");
    // Line numbers back an unrecognised length rule, and both families can offend at once.
    expect(render(["x-rule"], [over(1)])).toContain("PR title");
    expect(render(["x-rule"], [over(1)])).not.toContain("reword commit subjects");
    const both = render(["header-max-length", "body-max-line-length"], [over(1), over(7)]);
    expect(both).toContain("PR title");
    expect(both).toContain("reword commit subjects");
    // Nothing recognised and nothing over the limit: both remedies.
    const unknown = render(["x-rule"], []);
    expect(unknown).toContain("PR title");
    expect(unknown).toContain("reword commit subjects");
  });

  it("exempts body URL lines while still reporting an overlong URL header", () => {
    const url = `* docs: see https://github.com/beep-effect/beep-effect/pull/1915#issuecomment-${Str.repeat(80)("9")}`;
    expect(Str.length(url)).toBeGreaterThan(COMMITLINT_MAX_LINE_LENGTH);
    const message = SquashCommitMessage.make({ header: `fix(docs): ${url} (#7)`, body: `${url}\n\n* ${longSubject}` });
    expect(A.map(squashCommitlintOffendingLines(message), (line) => line.line)).toEqual([1, 5]);
  });

  it("budgets the PR title at the line limit minus its (#n) suffix", () => {
    expect(squashPullRequestTitleMaxLength(1915)).toBe(92);
    expect(squashPullRequestTitleMaxLength(7)).toBe(95);
    expect(SQUASH_COMMIT_SUBJECT_MAX_LENGTH).toBe(98);
  });

  it("classifies a commitlint run: exit 0 passes, a named rule fails, anything else is no verdict", () => {
    const message = SquashCommitMessage.make({ header: "fix(x): y (#7)", body: `* ${longSubject}` });
    expect(
      classifyCommitlintRun(CommitlintRun.make({ exitCode: 0, output: "✔   found 0 problems, 0 warnings", message }))
        ._tag
    ).toBe("pass");
    const failed = classifyCommitlintRun(
      CommitlintRun.make({
        exitCode: 1,
        output:
          "⧗   input: ...\n✖   footer's lines must not be longer than 100 characters [footer-max-line-length]\n✖   found 1 problems, 0 warnings",
        message,
      })
    );
    expect(failed._tag).toBe("fail");
    if (failed._tag === "fail") {
      expect(failed.rules).toEqual(["footer-max-line-length"]);
      expect(A.map(failed.offendingLines, (line) => line.length)).toEqual([102]);
    }
    expect(renderSquashCommitlintVerdict(failed)).toMatch(/^footer-max-line-length at line 3 \(102 chars\): "\* docs/u);
    expect(renderSquashCommitlintVerdict(failed)).toContain("98 chars or fewer");
    const crashed = classifyCommitlintRun(
      CommitlintRun.make({ exitCode: 127, output: "bunx: command not found", message })
    );
    expect(crashed._tag).toBe("unavailable");
    expect(renderSquashCommitlintVerdict(crashed)).toContain("never a pass");
  });
});

// A scripted process spawner: `gh` answers from recorded payloads routed by
// argv; `bunx commitlint` is either scripted or passed through to the real
// binary so the lint tests prove the repo's own config.
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

// The real commitlint needs the repo root (commitlint.config.ts) as its cwd.
const contextAt = (repoRoot: string) =>
  RepoRunContext.make({
    base: "origin/main",
    branch: "feat/squash",
    cwd: repoRoot,
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot,
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });

interface GhScript {
  readonly commitlint?: { readonly exitCode: number; readonly output: string };
  readonly commits: ReadonlyArray<string>;
  readonly settings?: Record<string, unknown>;
  readonly settingsExit?: number;
}

const pullFacts = SquashPullRequestFacts.make({
  number: 1913,
  title: "docs(agent-pool-doctrine): admit Codex as step 2 of the Claude Code fallback chain (R11)",
  body: O.some("## Summary"),
});

const ghAnswers = (script: GhScript): ReadonlyArray<readonly [string, { exitCode: number; output: string }]> => [
  [
    "/pulls/1913/commits",
    // Two pages, as `--paginate --slurp` returns them.
    {
      exitCode: 0,
      output: encodeJson(
        A.map(A.chunksOf(2)(A.map(script.commits, (message) => ({ commit: { message } }))), (page) => page)
      ),
    },
  ],
  ["/pulls/1913", { exitCode: 0, output: encodeJson({ number: 1913, title: pullFacts.title, body: "## Summary" }) }],
  [
    "repos/{owner}/{repo}",
    {
      exitCode: script.settingsExit ?? 0,
      output: encodeJson(
        script.settings ?? {
          squash_merge_commit_title: "COMMIT_OR_PR_TITLE",
          squash_merge_commit_message: "COMMIT_MESSAGES",
        }
      ),
    },
  ],
];

const scriptedSpawner = (
  script: GhScript,
  calls: Ref.Ref<ReadonlyArray<string>>,
  real: ChildProcessSpawner.ChildProcessSpawner["Service"]
) =>
  ChildProcessSpawner.make((command) => {
    if (!ChildProcess.isStandardCommand(command)) return Effect.die("the squash reader never spawns a piped command");
    const line = A.join([command.command, ...commandArgs(command)], " ");
    const record = Ref.update(calls, A.append(line));
    if (command.command === "bunx") {
      return script.commitlint === undefined
        ? record.pipe(Effect.andThen(real.spawn(command)))
        : record.pipe(Effect.as(stubHandle(script.commitlint.exitCode, script.commitlint.output)));
    }
    const answer = A.findFirst(ghAnswers(script), ([fragment]) => Str.includes(fragment)(line)).pipe(
      O.map(([, found]) => found),
      O.getOrElse(() => ({ exitCode: 1, output: `unexpected command: ${line}` }))
    );
    return record.pipe(Effect.as(stubHandle(answer.exitCode, answer.output)));
  });

// The Node spawner only asks the filesystem whether `cwd` exists (`fs.access`), so the
// in-memory filesystem stands in once the repo root is created there; the spawned
// commitlint itself is real, against the repo's own config.
const withScripted = Effect.fn("withScripted")(function* <A, E, R>(
  script: GhScript,
  use: (calls: Ref.Ref<ReadonlyArray<string>>, context: RepoRunContext) => Effect.Effect<A, E, R>
) {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  // test/ -> cli -> tool -> tooling -> packages -> repo root, wherever vitest was started.
  const repoRoot = path.resolve(import.meta.dirname, "../../../../..");
  yield* fs.makeDirectory(repoRoot, { recursive: true });
  const real = yield* ChildProcessSpawner.ChildProcessSpawner;
  const calls = yield* Ref.make<ReadonlyArray<string>>(A.empty());
  return yield* use(calls, contextAt(repoRoot)).pipe(
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, scriptedSpawner(script, calls, real))
  );
});

const fileSystem = Layer.merge(MemoryFileSystem.layer, Path.layer);
const platform = Layer.mergeAll(
  NodeCrypto.layer,
  fileSystem,
  NodeChildProcessSpawner.layer.pipe(Layer.provide(fileSystem))
);

it.layer(platform, { timeout: "60 seconds" })("squash commitlint against the repo's commitlint", (it) => {
  it.effect("a clean PR passes the real commitlint", () =>
    withScripted(
      { commits: [commit("docs(doctrine): admit Codex", "Why."), commit("chore(doctrine): re-request review")] },
      (calls, context) =>
        Effect.gen(function* () {
          const report = yield* readSquashCommitlint(context, pullFacts);
          expect(report.verdict._tag).toBe("pass");
          expect(report.message.header).toBe(`${pullFacts.title} (#1913)`);
          expect(report.message.body).toContain("* docs(doctrine): admit Codex\n\nWhy.");
          const spawned = yield* Ref.get(calls);
          expect(A.some(spawned, Str.startsWith("gh api repos/{owner}/{repo}/pulls/1913/commits"))).toBe(true);
          expect(A.some(spawned, Str.startsWith("bunx commitlint --verbose"))).toBe(true);
        })
    )
  );

  it.effect("honors the repo's 150-character footer budget for squash bullets", () =>
    Effect.forEach(
      [
        { subject: longSubject, expected: "pass" },
        { subject: `${longSubject} ${longSubject}`, expected: "fail" },
      ],
      ({ subject, expected }) =>
        withScripted(
          {
            commits: [
              commit("docs(doctrine): admit Codex", "Why."),
              commit("chore(doctrine): re-request review"),
              commit(subject, "Every Codex selection point."),
            ],
          },
          (_calls, context) =>
            Effect.gen(function* () {
              const report = yield* readSquashCommitlint(context, pullFacts);
              expect(report.verdict._tag).toBe(expected);
              if (report.verdict._tag === "fail") {
                expect(report.verdict.rules).toEqual(["footer-max-line-length"]);
                expect(A.map(report.verdict.offendingLines, (line) => [line.length, line.text])).toEqual([
                  [Str.length(subject) + 2, `* ${subject}`],
                ]);
                expect(renderSquashCommitlintVerdict(report.verdict)).toContain(`"* ${subject}"`);
              }
            })
        )
    )
  );

  it.effect("reads the pull request first when given only a number", () =>
    withScripted(
      { commits: [commit("fix(x): one", "Body.")], commitlint: { exitCode: 0, output: "" } },
      (calls, context) =>
        Effect.gen(function* () {
          const report = yield* readSquashCommitlintForPullRequest(context, 1913);
          expect(report.message.header).toBe(`${pullFacts.title} (#1913)`);
          expect(report.message.body).toBe(`Body.\n\n${trailer}`);
          expect(A.some(yield* Ref.get(calls), Str.startsWith("gh api repos/{owner}/{repo}/pulls/1913 "))).toBe(false);
          expect(A.some(yield* Ref.get(calls), (line) => line === "gh api repos/{owner}/{repo}/pulls/1913")).toBe(true);
        })
    )
  );

  it.effect("falls back to GitHub's default settings when the repository omits them", () =>
    withScripted(
      {
        commits: [commit("fix(x): one"), commit("fix(x): two")],
        settings: { squash_merge_commit_message: null },
        commitlint: { exitCode: 0, output: "" },
      },
      (_calls, context) =>
        Effect.gen(function* () {
          const report = yield* readSquashCommitlint(context, pullFacts);
          expect(report.message.body).toContain("* fix(x): one");
        })
    )
  );

  it.effect("a commitlint that cannot run is an unavailable verdict, never a pass", () =>
    withScripted(
      { commits: [commit("fix(x): one")], commitlint: { exitCode: 127, output: "bunx: command not found" } },
      (_calls, context) =>
        Effect.gen(function* () {
          const report = yield* readSquashCommitlint(context, pullFacts);
          expect(report.verdict._tag).toBe("unavailable");
          expect(renderSquashCommitlintVerdict(report.verdict)).toContain("command not found");
        })
    )
  );

  it.effect("a failed settings read is a command error, not a prediction", () =>
    withScripted({ commits: [commit("fix(x): one")], settingsExit: 1 }, (_calls, context) =>
      Effect.gen(function* () {
        const error = yield* readSquashCommitlint(context, pullFacts).pipe(Effect.flip);
        expect(error._tag).toBe("YeetCommandError");
        expect(error.message).toContain("gh api repos failed");
      })
    )
  );

  it.effect("lints a hand-built message through the same spawner", () =>
    withScripted(
      {
        commits: [],
        commitlint: {
          exitCode: 1,
          output: "✖   subject may not be empty [subject-empty]\n✖   type may not be empty [type-empty]",
        },
      },
      (_calls, context) =>
        Effect.gen(function* () {
          const report = yield* lintSquashCommitMessage(
            context,
            SquashCommitMessage.make({ header: "not conventional (#1)", body: "" })
          );
          expect(report.verdict._tag === "fail" ? report.verdict.rules : []).toEqual(["subject-empty", "type-empty"]);
        })
    )
  );
});
