import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  byRepoPlanStepAscending,
  enforceConservativeResume,
  isConservativeResumeCandidate,
  TurboPlanTask,
  turboTaskForStep,
} from "@beep/repo-cli/test/RepoRun";
import {
  activePacketsOnBranch,
  applyHeavyAdmissionLabel,
  buildPrBody,
  buildYeetRunPlan,
  commandTextForStep,
  decideYeetReadyGate,
  defaultYeetRunOptions,
  deriveYeetMergeReady,
  ensurePullRequest,
  FinalCheckReceipt,
  findOpenPullRequest,
  isMergeCommitSubject,
  mergePr,
  mergeYeetPullRequestAtHead,
  ProofJobRecord,
  ProofJobRequest,
  ProofJobSubmitter,
  ProofJobUnit,
  ProvenanceStampOutcome,
  RepoPlanStep,
  RepoRunContext,
  RepoStepRunResult,
  recordPrCreateLane,
  recordPrProvenanceStampLane,
  runGhPullRequestView,
  runYeetReady,
  runYeetReadyGate,
  SweepGitState,
  shouldMonitorChecks,
  TurboPlanSnapshot,
  titleFromMessage,
  validateCommitMessage,
  validateMonitorBranch,
  validateMonitorGuards,
  validateOpenPullRequest,
  validateProofJobDetach,
  validateRequiredMessage,
  withYeetGithubCredentialHint,
  YeetEnsuredPullRequest,
  YeetExecutedStep,
  YeetPullRequestTitle,
  YeetReadyOptions,
  YeetReadyPullRequestRead,
  YeetRetirePlan,
  YeetStatusArtifact,
  YeetStatusRemote,
} from "@beep/repo-cli/test/Yeet";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import { githubCallLine, provideLegacyGh, recordedGithub, restPullRequest } from "./support/YeetGithub.ts";
import type { YeetRunOptions } from "@beep/repo-cli/test/Yeet";
import type { GithubAnswer } from "./support/YeetGithub.ts";

// `Git` rides beside the platform services: repo-cli's typed git readers take it from the context (W1a).
const gitLayer = Git.layer.pipe(Layer.provide(NodeServices.layer));

const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const BRANCH = "feat/coverage-restore";
const PR_URL = "https://github.com/o/r/pull/7";

const passingFinalCheck = (_context: RepoRunContext, head: string) =>
  Effect.succeedSome(
    FinalCheckReceipt.make({
      schemaVersion: "yeet-final-check/v1",
      headSha: head,
      mergeBase: Str.repeat(40)("0"),
      base: "origin/main",
      complete: true,
      verdict: "pass",
      startedAt: "2026-10-24T00:00:00.000Z",
      finishedAt: "2026-10-24T00:01:00.000Z",
      steps: [],
      expectationRewrites: [],
    })
  );

const contextAt = (repoRoot: string, branch: string = BRANCH) =>
  RepoRunContext.make({
    base: "origin/main",
    branch,
    cwd: repoRoot,
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot,
    turbo: TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }),
  });

const planStep = (id: string, args: ReadonlyArray<string>) =>
  RepoPlanStep.make({
    args,
    command: "gh",
    cwd: ".",
    id,
    label: id,
    mutability: "write",
    phase: "publish",
    resume: "never",
    scope: "repo",
  });

const createStep = planStep("publish:pr-create", ["pr", "create"]);
const draftCreateStep = planStep("publish:pr-create", ["pr", "create", "--draft"]);
const stampStep = planStep("publish:pr-provenance-stamp", ["pr", "edit"]);
const labelStep = planStep("publish:pr-ready-for-heavy-label", ["pr", "edit"]);

const prView = (
  overrides: {
    readonly headRefName?: string;
    readonly state?: string;
    readonly title?: string;
    readonly url?: string;
  } = {}
) => encodeJson({ number: 7, headRefName: BRANCH, state: "OPEN", ...overrides });

const MERGE_TITLE = `Merge remote-tracking branch 'origin/main' into ${BRANCH}`;

// The REST pull request GitHub answers a create, a title PATCH or a branch lookup with.
const restPull = (overrides: { readonly headRefName?: string; readonly draft?: boolean } = {}) =>
  restPullRequest({
    number: 7,
    html_url: PR_URL,
    draft: overrides.draft ?? false,
    head: { ref: overrides.headRefName ?? BRANCH, sha: "abc1234def" },
  });
const restPullJson = (overrides: { readonly headRefName?: string; readonly draft?: boolean } = {}) =>
  encodeJson(restPull(overrides));
const restPullListJson = (overrides: { readonly headRefName?: string } = {}) => encodeJson([restPull(overrides)]);

// The kit's REST reads and writes, as the `gh api` argv the scripted spawner sees.
const DEFAULT_BRANCH_READ = "gh api repos/{owner}/{repo}";
const defaultBranchJson = (branch: string) => encodeJson({ default_branch: branch });
const PULL_CREATE = "gh api -X POST repos/{owner}/{repo}/pulls";
const ORIGIN = "git remote get-url --push origin";
const ORIGIN_URL = "git@github.com:beep-effect/beep-effect.git";

// The kit's `Git.log` reads, as the argv the scripted spawner sees: the title read walks
// `--no-merges --reverse`, the body read asks for `%b`. Each answer is the kit's NUL record stream:
// a record opener, the six header fields and, for the body read, the raw `%b` (W7a Y54/Y55).
const TITLE_LOG = "--no-merges --reverse --end-of-options";
const BODY_LOG = "%x00%b --reverse --end-of-options";
const logHeader = (subject: string) =>
  `\u0000${Str.repeat(40)("a")}\u00002026-01-01T00:00:00Z\u00002026-01-01T00:00:00Z\u0000Ada\u0000ada@example.com\u0000${subject}`;
const titleLog = (...subjects: ReadonlyArray<string>) =>
  A.join(
    A.map(subjects, (subject) => `${logHeader(subject)}\u0000`),
    ""
  );
const bodyLog = (...commits: ReadonlyArray<readonly [subject: string, body: string]>) =>
  A.join(
    A.map(commits, ([subject, body]) => `${logHeader(subject)}\u0000${body}\u0000`),
    ""
  );

// One scripted process response, matched by a substring of the whole command
// line. The first matching reply wins; an unscripted command exits 1. A
// negative exit code scripts a command that could not be spawned at all.
type Reply = readonly [needle: string, exitCode: number, output: string];

const commandLine = ({ command, args }: { readonly command: string; readonly args: ReadonlyArray<string> }) =>
  A.join([command, ...args], " ");

const scriptedSpawner = (replies: ReadonlyArray<Reply>) =>
  ScriptedSpawner.make((command, args) => {
    const line = commandLine({ command, args });
    return O.match(
      A.findFirst(replies, ([needle]) => pipe(line, Str.includes(needle))),
      {
        onNone: () => ({ exit: 1, stdout: `unscripted: ${line}` }),
        onSome: ([, exit, output]) =>
          exit < 0
            ? PlatformError.systemError({
                _tag: "NotFound",
                module: "YeetPullRequestGuardsTest",
                method: "spawn",
                description: output,
              })
            : { exit, stdout: output },
      }
    );
  });

// Every scripted spawner one test builds, in order; the issued command lines
// are read back from their spawns.
const makeCommands = Effect.sync((): Array<ScriptedSpawner> => []);
const commandLines = (commands: ReadonlyArray<ScriptedSpawner>) =>
  A.flatMap(commands, (spawner) => A.map(spawner.spawns, commandLine));

const withProcesses = (replies: ReadonlyArray<Reply>, commands: Array<ScriptedSpawner>) => {
  const spawner = scriptedSpawner(replies);
  commands.push(spawner);
  return <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(provideLegacyGh, Effect.provideServiceEffect(Git, Git.make), provideSpawner(spawner));
};

const makeRecorder = Ref.make<ReadonlyArray<YeetExecutedStep>>([]);
const failClosedSpawnerLayer = scriptedSpawner([]).layer;
const testLayer = Layer.provideMerge(
  Git.layer,
  Layer.mergeAll(MemoryFileSystem.layer, Path.layer, NodeCrypto.layer, failClosedSpawnerLayer)
);

// A create lane carries no explicit status (the verdict derives it from the exit
// code); stamp and label lanes record theirs.
const laneRows = (executed: ReadonlyArray<YeetExecutedStep>) =>
  A.map(executed, (entry) => [entry.step.id, entry.status, entry.result.exitCode, entry.result.output]);

const guardFailure = Effect.fnUntraced(function* (options: Partial<YeetRunOptions>) {
  const commands = yield* makeCommands;
  const error = yield* validateMonitorGuards(contextAt("/repo"), defaultYeetRunOptions(options)).pipe(
    Effect.flip,
    withProcesses([], commands)
  );
  return error.message;
});

it.layer(Layer.fresh(testLayer), { timeout: "30 seconds" })("yeet guards", (it) => {
  it.effect("rejects every illegal flag combination with the rule's own message", () =>
    Effect.gen(function* () {
      const cases: ReadonlyArray<readonly [Partial<YeetRunOptions>, string]> = [
        [{ merged: true }, "yeet --merged is only valid for verify."],
        [{ merged: true, mode: "verify", tier: "review-fix" }, "yeet verify --merged requires the full proof tier."],
        [{ ciParity: true }, "yeet --ci-parity is only valid for verify"],
        [{ ciParity: true, mode: "verify", tier: "review-fix" }, "yeet verify --ci-parity requires the full tier"],
        [{ ciParity: true, merged: true, mode: "verify" }, "yeet verify --ci-parity requires the full tier"],
        [{ mode: "verify", proveFirst: true }, "yeet --prove-first is only valid for publish."],
        [
          { proveFirst: true, pushOnly: true, reuseVerified: true },
          "--prove-first cannot be combined with --push-only",
        ],
        [{ tier: "review-fix" }, "yeet publish picks its own proof"],
        [{ noEdit: true }, "yeet publish --no-edit requires --amend."],
        [{ mode: "verify", pushOnly: true }, "yeet --push-only is only valid for publish."],
        [
          { amend: true, pushOnly: true, reuseVerified: true },
          "yeet publish --push-only cannot be combined with --amend or --no-edit.",
        ],
        [
          { message: "feat(repo-cli): ship", pushOnly: true, reuseVerified: true },
          "yeet publish --push-only does not accept --message",
        ],
        [{ mode: "verify", stagedOnly: true }, "yeet --staged-only is only valid for publish."],
        [{ reuseVerified: true, stagedOnly: true }, "yeet publish --staged-only cannot be combined"],
        [{ amend: true, stagedOnly: true }, "yeet publish --staged-only cannot be combined"],
        [{ pushOnly: true, reuseVerified: true, stagedOnly: true }, "yeet publish --staged-only cannot be combined"],
      ];
      const messages = yield* Effect.forEach(cases, ([options]) => guardFailure(options));
      A.forEach(A.zip(messages, cases), ([message, [, expected]]) => expect(message).toContain(expected));
    })
  );

  it.effect("accepts legal publish combinations without inspecting a pull request", () =>
    Effect.gen(function* () {
      const commands = yield* makeCommands;
      yield* Effect.forEach(
        [
          defaultYeetRunOptions(),
          defaultYeetRunOptions({ stagedOnly: true }),
          defaultYeetRunOptions({ pushOnly: true }),
          defaultYeetRunOptions({ pushOnly: true, reuseVerified: true }),
          defaultYeetRunOptions({ amend: true, noEdit: true }),
          defaultYeetRunOptions({ mode: "monitor", plan: true }),
          defaultYeetRunOptions({ monitor: true }),
        ],
        (options) => validateMonitorGuards(contextAt("/repo"), options),
        { discard: true }
      ).pipe(withProcesses([], commands));
      expect(commandLines(commands)).toEqual([]);
    })
  );

  it.effect("requires an open pull request for monitoring modes that do not create one", () =>
    Effect.gen(function* () {
      const commands = yield* makeCommands;
      const context = contextAt("/repo");
      yield* Effect.forEach(
        [defaultYeetRunOptions({ mode: "monitor" }), defaultYeetRunOptions({ monitor: true, pr: false })],
        (options) => validateMonitorGuards(context, options),
        { discard: true }
      ).pipe(
        withProcesses(
          [
            ["remote get-url --push origin", 0, "https://github.com/beep-effect/beep-effect.git"],
            ["gh api repos/{owner}/{repo}/pulls?per_page=100&head=", 0, restPullListJson()],
          ],
          commands
        )
      );
      // Two REST-side reads per guard (origin owner, pulls?head=), never `gh pr view`.
      expect(A.length(commandLines(commands))).toBe(4);
      expect(A.some(commandLines(commands), Str.includes("gh pr view"))).toBe(false);

      const blocked = yield* validateMonitorGuards(
        contextAt("/repo", "main"),
        defaultYeetRunOptions({ mode: "closeout" })
      ).pipe(Effect.flip, withProcesses([], commands));
      expect(blocked.message).toBe('yeet monitor is PR-branch-only; refusing to monitor branch "main".');
      expect(blocked.command).toBe("git rev-parse --abbrev-ref HEAD");
    })
  );

  it.effect("classifies monitorable modes, branches, and commit messages", () =>
    Effect.gen(function* () {
      expect(shouldMonitorChecks(defaultYeetRunOptions({ mode: "closeout" }))).toBe(true);
      expect(shouldMonitorChecks(defaultYeetRunOptions({ mode: "monitor" }))).toBe(true);
      expect(shouldMonitorChecks(defaultYeetRunOptions({ monitor: true }))).toBe(true);
      expect(shouldMonitorChecks(defaultYeetRunOptions())).toBe(false);
      yield* validateMonitorBranch(contextAt("/repo"));
      const head = yield* Effect.flip(validateMonitorBranch(contextAt("/repo", "HEAD")));
      expect(head.exitCode).toBe(1);
      assertNone(yield* validateRequiredMessage(defaultYeetRunOptions({ message: "   " })));
      assertSome(yield* validateRequiredMessage(defaultYeetRunOptions({ message: " fix: x " })), "fix: x");
    })
  );

  it.effect("writes the commit message artifact and reports the commitlint verdict", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-commitlint-" });
      const commands = yield* makeCommands;
      const context = contextAt(root);
      const messagePath = path.join(root, ".beep", "yeet", "commit-message.txt");

      yield* validateCommitMessage(context, "feat(repo-cli): accepted").pipe(
        withProcesses([["commitlint --edit", 0, ""]], commands)
      );
      expect(yield* fs.readFileString(messagePath)).toBe("feat(repo-cli): accepted\n");
      expect(commandLines(commands)).toEqual([`commitlint --edit ${messagePath}`]);

      const rejected = yield* validateCommitMessage(context, "nope").pipe(
        Effect.flip,
        withProcesses([["commitlint --edit", 3, "subject may not be empty"]], commands)
      );
      expect(rejected.message).toBe("commit message failed commitlint:\nsubject may not be empty");
      expect(rejected.exitCode).toBe(3);
      expect(rejected.command).toBe(`commitlint --edit ${messagePath}`);

      const unspawnable = yield* validateCommitMessage(context, "nope").pipe(
        Effect.flip,
        withProcesses([["commitlint --edit", -1, "commitlint is not installed"]], commands)
      );
      expect(unspawnable.message).toBe("Failed to run commitlint.");
    })
  );

  it.effect("refuses to detach a plan or a run already inside a proof job", () =>
    Effect.gen(function* () {
      const outside = Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}));
      const inside = Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({ BEEP_YEET_JOB_ID: "f8bdb3ac-2222-4aaa-8bbb-000000000002" })
      );
      yield* outside(validateProofJobDetach(false));
      const planned = yield* validateProofJobDetach(true).pipe(Effect.flip, outside);
      expect(planned.message).toBe("--detach cannot be combined with --plan.");
      const nested = yield* validateProofJobDetach(false).pipe(Effect.flip, inside);
      expect(nested.message).toBe("Cannot recursively --detach inside a proof job.");
    })
  );
});

it.layer(Layer.fresh(testLayer), { timeout: "30 seconds" })("yeet pull request lifecycle", (it) => {
  describe("gh pr view", () => {
    it.effect("maps each gh failure mode to its own command error", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const context = contextAt("/repo");
        const view = yield* runGhPullRequestView(context).pipe(
          withProcesses([["gh pr view", 0, prView({ url: PR_URL })]], commands)
        );
        expect(view.number).toBe(7);
        expect(view.url).toBe(PR_URL);

        const missing = yield* runGhPullRequestView(context).pipe(
          Effect.flip,
          withProcesses([["gh pr view", 4, "no pull requests found"]], commands)
        );
        expect(missing.message).toContain("yeet monitor requires an open pull request for the current branch.");
        expect(missing.exitCode).toBe(4);

        const unspawnable = yield* runGhPullRequestView(context).pipe(
          Effect.flip,
          withProcesses([["gh pr view", -1, "gh is not installed"]], commands)
        );
        expect(unspawnable.message).toBe("Failed to inspect current branch pull request.");

        const truncated = yield* runGhPullRequestView(context).pipe(
          Effect.flip,
          withProcesses([["gh pr view", 0, pipe("x", Str.repeat(600 * 1024))]], commands)
        );
        expect(truncated.message).toBe("gh pr view output exceeded the repo-run capture limit.");

        const undecodable = yield* runGhPullRequestView(context).pipe(
          Effect.flip,
          withProcesses([["gh pr view", 0, "not json"]], commands)
        );
        expect(undecodable.message).toBe("Failed to decode gh pr view JSON.");
      })
    );

    it.effect("finds only an open pull request that heads the current branch", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const context = contextAt("/repo");
        const found = (replies: ReadonlyArray<Reply>) =>
          findOpenPullRequest(context).pipe(withProcesses(replies, commands));

        assertSome(
          O.map(yield* found([["gh pr view", 0, prView()]]), (view) => view.number),
          7
        );
        assertNone(yield* found([["gh pr view", 0, prView({ state: "MERGED" })]]));
        assertNone(yield* found([["gh pr view", 0, prView({ headRefName: "feat/other" })]]));
        assertNone(yield* found([["gh pr view", 1, "no pull requests found"]]));
        assertNone(yield* found([["gh pr view", 0, pipe("x", Str.repeat(600 * 1024))]]));

        const unspawnable = yield* Effect.flip(found([["gh pr view", -1, "gh is not installed"]]));
        expect(unspawnable.message).toBe("Failed to inspect current branch pull request.");
        const undecodable = yield* Effect.flip(found([["gh pr view", 0, "not json"]]));
        expect(undecodable.message).toBe("Failed to decode gh pr view JSON.");
      })
    );

    it.effect("uses REST to discover the branch PR when GraphQL is rate limited", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const context = contextAt("/repo");
        const replies: ReadonlyArray<Reply> = [
          ["gh pr view", 1, "GraphQL: API rate limit exceeded"],
          ["git remote get-url --push origin", 0, "git@github.com:beep-effect/beep-effect.git"],
          [
            "gh api repos/{owner}/{repo}/pulls?per_page=100&head=beep-effect%3Afeat%2Fcoverage-restore&state=open",
            0,
            restPullListJson(),
          ],
        ];
        const view = yield* runGhPullRequestView(context).pipe(withProcesses(replies, commands));
        expect(view.number).toBe(7);
        const found = yield* findOpenPullRequest(context).pipe(withProcesses(replies, commands));
        assertSome(
          O.map(found, (pr) => pr.number),
          7
        );
      })
    );

    it.effect("uses the pushed fork owner and protects branch prefixes from gh placeholders", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const branch = "repo-cli/fix";
        const context = contextAt("/repo", branch);
        const view = yield* runGhPullRequestView(context).pipe(
          withProcesses(
            [
              ["gh pr view", 1, "GraphQL: API rate limit exceeded"],
              ["git remote get-url --push origin", 0, "https://github.com/fork-owner/beep-effect.git"],
              [
                "gh api repos/{owner}/{repo}/pulls?per_page=100&head=fork-owner%3Arepo-cli%2Ffix&state=open",
                0,
                restPullListJson({ headRefName: branch }),
              ],
            ],
            commands
          )
        );
        expect(view.headRefName).toBe(branch);
        expect(A.some(commandLines(commands), Str.includes("head=fork-owner%3Arepo-cli%2Ffix"))).toBe(true);
      })
    );

    it.effect("distinguishes a missing REST PR from a failed REST lookup", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const context = contextAt("/repo");
        const absent = (restExit: number, restOutput: string) =>
          findOpenPullRequest(context).pipe(
            withProcesses(
              [
                ["gh pr view", 1, "GraphQL: API rate limit already exceeded"],
                ["git remote get-url --push origin", 0, "git@github.com:beep-effect/beep-effect.git"],
                ["gh api repos/{owner}/{repo}/pulls?per_page=100&head=", restExit, restOutput],
              ],
              commands
            )
          );
        assertNone(yield* absent(0, "[]"));
        const failed = yield* Effect.flip(absent(1, "GitHub REST unavailable"));
        expect(failed.message).toContain("Failed to inspect current branch pull request through GitHub REST: ");
        expect(failed.message).toContain("GitHub REST unavailable");
      })
    );

    it.effect("validates that the branch pull request is open and heads the branch", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const context = contextAt("/repo");
        const validated = (output: string) =>
          validateOpenPullRequest(context).pipe(withProcesses([["gh pr view", 0, output]], commands));

        yield* validated(prView());
        const closed = yield* Effect.flip(validated(prView({ state: "CLOSED" })));
        expect(closed.message).toBe("yeet monitor requires an open pull request; current branch PR #7 is CLOSED.");
        const foreign = yield* Effect.flip(validated(prView({ headRefName: "feat/other" })));
        expect(foreign.message).toBe(`yeet monitor expected PR head "${BRANCH}" but gh reported "feat/other".`);
      })
    );
  });

  describe("pull request body and recorder lanes", () => {
    const executedStep = (exitCode: number) =>
      YeetExecutedStep.make({
        result: RepoStepRunResult.make({ stepId: createStep.id, commandText: "bun run check", exitCode, output: "" }),
        step: planStep(exitCode === 0 ? "full:cheap-gates" : "full:pre-push", []),
      });

    it.effect("lists the recorded proof lanes over the merge-base commit range", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>([executedStep(0), executedStep(1)]);
        const body = yield* buildPrBody(contextAt("/repo"), recorder).pipe(
          withProcesses(
            [
              ["merge-base", 0, "abc123\n"],
              [BODY_LOG, 0, bodyLog(["feat(repo-cli): ship", "body text\n"])],
            ],
            commands
          )
        );
        expect(body).toContain("## feat(repo-cli): ship\n\nbody text\n\n## Local proof\n\n");
        expect(body).toContain("- full:cheap-gates: passed\n- full:pre-push: failed\n\nVerdict: .beep/yeet/runs/");
        expect(A.some(commandLines(commands), Str.endsWith("--end-of-options abc123..HEAD --"))).toBe(true);
      })
    );

    it.effect("falls back to HEAD and names hosted CI when nothing ran locally", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        const body = yield* buildPrBody(contextAt("/repo"), recorder).pipe(
          withProcesses([[BODY_LOG, 0, bodyLog(["docs: note", ""])]], commands)
        );
        expect(body).toContain("- no local proof lane ran before the push; hosted CI is the authoritative proof");
        expect(A.some(commandLines(commands), Str.endsWith("--end-of-options HEAD --"))).toBe(true);
      })
    );

    it.effect("records nothing for a lane the plan did not carry", () =>
      Effect.gen(function* () {
        const recorder = yield* makeRecorder;
        const current = ProvenanceStampOutcome.make({ status: "current", message: "provenance footer current" });
        yield* recordPrCreateLane(recorder, O.none(), PR_URL);
        yield* recordPrProvenanceStampLane(recorder, O.none(), O.some(7), current);
        expect(yield* Ref.get(recorder)).toEqual([]);
        yield* recordPrCreateLane(recorder, O.some(createStep), PR_URL);
        expect(laneRows(yield* Ref.get(recorder))).toEqual([[createStep.id, undefined, 0, PR_URL]]);
      })
    );
  });

  describe("ensurePullRequest", () => {
    it.effect("creates a ready pull request through REST and keeps going when provenance is unavailable", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-create-" });
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        const pullRequest = yield* ensurePullRequest(contextAt(root), recorder, O.some(createStep), O.some(stampStep), {
          findOpen: () => Effect.succeedNone,
        }).pipe(
          withProcesses(
            [
              [TITLE_LOG, 0, titleLog("feat(repo-cli): ship")],
              [BODY_LOG, 0, bodyLog(["feat(repo-cli): ship", ""])],
              [ORIGIN, 0, ORIGIN_URL],
              [PULL_CREATE, 0, restPullJson()],
              [DEFAULT_BRANCH_READ, 0, defaultBranchJson("main")],
            ],
            commands
          )
        );
        expect(pullRequest.number).toBe(7);
        expect(pullRequest.created).toBe(true);
        assertSome(pullRequest.url, PR_URL);
        const create = A.findFirst(commandLines(commands), Str.startsWith(PULL_CREATE));
        assertSome(
          O.map(
            create,
            Str.startsWith(`${PULL_CREATE} title=feat(repo-cli): ship head=beep-effect:${BRANCH} base=main body=`)
          ),
          true
        );
        expect(O.exists(create, Str.endsWith("draft=false"))).toBe(true);
        expect(A.some(commandLines(commands), Str.startsWith("gh pr create"))).toBe(false);
        expect(laneRows(yield* Ref.get(recorder))).toEqual([
          [createStep.id, undefined, 0, PR_URL],
          [
            stampStep.id,
            "failed",
            1,
            "[yeet] provenance footer stamp skipped for PR #7: session recording was unavailable",
          ],
        ]);
      })
    );

    it.effect("opens a draft and keeps the URL the REST create returns", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-draft-" });
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        const pullRequest = yield* ensurePullRequest(contextAt(root), recorder, O.some(draftCreateStep), O.none(), {
          findOpen: () => Effect.succeedNone,
        }).pipe(
          withProcesses(
            [
              [TITLE_LOG, 0, titleLog("feat(repo-cli): ship")],
              [BODY_LOG, 0, bodyLog(["feat(repo-cli): ship", ""])],
              [ORIGIN, 0, ORIGIN_URL],
              [PULL_CREATE, 0, restPullJson({ draft: true })],
              [DEFAULT_BRANCH_READ, 0, defaultBranchJson("main")],
            ],
            commands
          )
        );
        assertSome(pullRequest.url, PR_URL);
        expect(A.some(commandLines(commands), Str.includes("draft=true"))).toBe(true);
        expect(laneRows(yield* Ref.get(recorder))).toEqual([[draftCreateStep.id, undefined, 0, PR_URL]]);
      })
    );

    it.effect("creates a fork-head draft through REST from the pushed origin owner", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-rest-" });
        const branch = "repo-cli/fix";
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        const pullRequest = yield* ensurePullRequest(
          contextAt(root, branch),
          recorder,
          O.some(draftCreateStep),
          O.none(),
          {
            findOpen: () => Effect.succeedNone,
          }
        ).pipe(
          withProcesses(
            [
              [TITLE_LOG, 0, titleLog("feat(repo-cli): ship")],
              [BODY_LOG, 0, bodyLog(["feat(repo-cli): ship", ""])],
              [ORIGIN, 0, "git@github.com:fork-owner/beep-effect.git"],
              [PULL_CREATE, 0, restPullJson({ headRefName: branch, draft: true })],
              [DEFAULT_BRANCH_READ, 0, defaultBranchJson("main")],
            ],
            commands
          )
        );
        expect(pullRequest.created).toBe(true);
        assertSome(pullRequest.url, PR_URL);
        expect(A.some(commandLines(commands), Str.includes("draft=true"))).toBe(true);
        expect(A.some(commandLines(commands), Str.includes("base=main"))).toBe(true);
        expect(A.some(commandLines(commands), Str.includes("head=fork-owner:repo-cli/fix"))).toBe(true);
        expect(A.some(commandLines(commands), Str.includes("body=## feat(repo-cli): ship"))).toBe(true);
        const recorded = yield* Ref.get(recorder);
        expect(recorded[0]?.result.commandText).toBe("gh api -X POST repos/{owner}/{repo}/pulls");
      })
    );

    it.effect("opens the pull request on the default branch, not the --base planning ref", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-rest-default-" });
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        const context = RepoRunContext.make({ ...contextAt(root), base: "origin/goals/push-first-publish" });
        const pullRequest = yield* ensurePullRequest(context, recorder, O.some(createStep), O.none(), {
          findOpen: () => Effect.succeedNone,
        }).pipe(
          withProcesses(
            [
              [TITLE_LOG, 0, titleLog("feat(repo-cli): ship")],
              [BODY_LOG, 0, bodyLog(["feat(repo-cli): ship", ""])],
              [ORIGIN, 0, ORIGIN_URL],
              [PULL_CREATE, 0, restPullJson()],
              [DEFAULT_BRANCH_READ, 0, defaultBranchJson("trunk")],
            ],
            commands
          )
        );
        expect(pullRequest.created).toBe(true);
        const issued = commandLines(commands);
        expect(A.some(issued, Str.includes("base=trunk"))).toBe(true);
        expect(A.some(issued, Str.includes("base=goals/push-first-publish"))).toBe(false);
      })
    );

    it.effect("fails PR creation before the REST create when the default branch read fails", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-no-default-" });
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        const error = yield* ensurePullRequest(contextAt(root), recorder, O.some(createStep), O.none(), {
          findOpen: () => Effect.succeedNone,
        }).pipe(
          Effect.flip,
          withProcesses(
            [
              [TITLE_LOG, 0, titleLog("feat(repo-cli): ship")],
              [BODY_LOG, 0, bodyLog(["feat(repo-cli): ship", ""])],
              [DEFAULT_BRANCH_READ, 1, "HTTP 502: Bad Gateway"],
            ],
            commands
          )
        );
        expect(error.message).toContain("GitHub REST default branch read failed:\n");
        expect(error.message).toContain("HTTP 502: Bad Gateway");
        expect(error.exitCode).toBe(1);
        const issued = commandLines(commands);
        expect(A.some(issued, Str.startsWith("gh pr create"))).toBe(false);
        expect(A.some(issued, Str.includes("-X POST"))).toBe(false);
      })
    );

    it.effect("fails PR creation with a nonzero exit when the default branch read names no branch", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-empty-default-" });
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        const error = yield* ensurePullRequest(contextAt(root), recorder, O.some(createStep), O.none(), {
          findOpen: () => Effect.succeedNone,
        }).pipe(
          Effect.flip,
          withProcesses(
            [
              [TITLE_LOG, 0, titleLog("feat(repo-cli): ship")],
              [BODY_LOG, 0, bodyLog(["feat(repo-cli): ship", ""])],
              [DEFAULT_BRANCH_READ, 0, defaultBranchJson(" ")],
            ],
            commands
          )
        );
        expect(error.message).toBe("GitHub REST default branch read returned no branch.");
        expect(error.exitCode).toBe(1);
        expect(A.some(commandLines(commands), Str.includes("-X POST"))).toBe(false);
      })
    );

    it.effect("fails PR creation before the REST create without a pushed origin owner", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-no-owner-" });
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        const error = yield* ensurePullRequest(contextAt(root), recorder, O.some(createStep), O.none(), {
          findOpen: () => Effect.succeedNone,
        }).pipe(
          Effect.flip,
          withProcesses(
            [
              [TITLE_LOG, 0, titleLog("feat(repo-cli): ship")],
              [BODY_LOG, 0, bodyLog(["feat(repo-cli): ship", ""])],
              [ORIGIN, 0, "/srv/git/beep-effect.git"],
              [DEFAULT_BRANCH_READ, 0, defaultBranchJson("main")],
            ],
            commands
          )
        );
        expect(error.message).toBe(
          "Failed to identify the pushed origin repository owner for GitHub REST pull request lookup."
        );
        expect(A.some(commandLines(commands), Str.includes("-X POST"))).toBe(false);
      })
    );

    it.effect("fails the publish when the REST create is refused", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-refused-" });
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        const error = yield* ensurePullRequest(contextAt(root), recorder, O.none(), O.none(), {
          findOpen: () => Effect.succeedNone,
        }).pipe(
          Effect.flip,
          withProcesses(
            [
              [TITLE_LOG, 0, titleLog("feat(repo-cli): ship")],
              [BODY_LOG, 0, bodyLog(["feat(repo-cli): ship", ""])],
              [ORIGIN, 0, ORIGIN_URL],
              [PULL_CREATE, 1, "a pull request for this branch already exists"],
              [DEFAULT_BRANCH_READ, 0, defaultBranchJson("main")],
            ],
            commands
          )
        );
        expect(error.message).toContain("GitHub REST pull request creation failed:\n");
        expect(error.message).toContain("a pull request for this branch already exists");
        expect(error.exitCode).toBe(1);
        expect(yield* Ref.get(recorder)).toEqual([]);
      })
    );

    it.effect("keeps the open pull request gh already reports for the branch", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        const pullRequest = yield* ensurePullRequest(contextAt("/repo"), recorder, O.some(createStep)).pipe(
          withProcesses([["gh pr view", 0, prView({ url: PR_URL })]], commands)
        );
        expect(pullRequest.created).toBe(false);
        assertSome(pullRequest.url, PR_URL);
        expect(laneRows(yield* Ref.get(recorder))).toEqual([
          [createStep.id, undefined, 0, "skipped: open pull request #7 already exists"],
        ]);
        expect(A.some(commandLines(commands), Str.startsWith("gh pr create"))).toBe(false);
      })
    );

    it.effect("titles the pull request from the --message first line, never the head commit", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-title-message-" });
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        const pullRequest = yield* ensurePullRequest(
          contextAt(root),
          recorder,
          O.some(draftCreateStep),
          O.none(),
          { findOpen: () => Effect.succeedNone },
          O.some("feat(repo-cli): title from message\n\nA body paragraph the title must not include.")
        ).pipe(
          withProcesses(
            [
              [BODY_LOG, 0, bodyLog([MERGE_TITLE, ""])],
              [ORIGIN, 0, ORIGIN_URL],
              [PULL_CREATE, 0, restPullJson({ draft: true })],
              [DEFAULT_BRANCH_READ, 0, defaultBranchJson("main")],
            ],
            commands
          )
        );
        expect(pullRequest.created).toBe(true);
        const lines = commandLines(commands);
        const create = A.findFirst(lines, Str.startsWith(PULL_CREATE));
        assertSome(
          O.map(create, Str.startsWith(`${PULL_CREATE} title=feat(repo-cli): title from message head=`)),
          true
        );
        expect(A.some(lines, Str.includes(TITLE_LOG))).toBe(false);
      })
    );

    it.effect("titles the pull request from the first non-merge commit when no message is given", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-title-history-" });
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        yield* ensurePullRequest(contextAt(root), recorder, O.some(createStep), O.none(), {
          findOpen: () => Effect.succeedNone,
        }).pipe(
          withProcesses(
            [
              [TITLE_LOG, 0, titleLog("feat(repo-cli): first real change", "fix(repo-cli): follow-up")],
              [BODY_LOG, 0, bodyLog(["feat(repo-cli): first real change", ""], [MERGE_TITLE, ""])],
              [ORIGIN, 0, ORIGIN_URL],
              [PULL_CREATE, 0, restPullJson()],
              [DEFAULT_BRANCH_READ, 0, defaultBranchJson("main")],
            ],
            commands
          )
        );
        const lines = commandLines(commands);
        expect(A.some(lines, Str.includes(`${TITLE_LOG} HEAD --`))).toBe(true);
        expect(A.some(lines, Str.includes("log -1 --pretty=%s"))).toBe(false);
        const create = A.findFirst(lines, Str.startsWith(PULL_CREATE));
        assertSome(O.map(create, Str.startsWith(`${PULL_CREATE} title=feat(repo-cli): first real change head=`)), true);
      })
    );

    it.effect("fails with the --message remedy when the branch carries only merge commits", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-title-merges-only-" });
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        const error = yield* ensurePullRequest(contextAt(root), recorder, O.some(createStep), O.none(), {
          findOpen: () => Effect.succeedNone,
        }).pipe(Effect.flip, withProcesses([[TITLE_LOG, 0, titleLog("")]], commands));
        expect(error.message).toContain("no non-merge commit in HEAD");
        expect(error.message).toContain('pass --message "<conventional subject>"');
        expect(A.some(commandLines(commands), Str.includes("-X POST"))).toBe(false);
        expect(yield* Ref.get(recorder)).toEqual([]);
      })
    );

    it.effect("renames an existing pull request whose title is a merge-commit subject", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        const pullRequest = yield* ensurePullRequest(
          contextAt("/repo"),
          recorder,
          O.some(createStep),
          O.none(),
          {},
          O.some("feat(repo-cli): ship")
        ).pipe(
          withProcesses(
            [
              ["gh pr view", 0, prView({ url: PR_URL, title: MERGE_TITLE })],
              ["gh api -X PATCH repos/{owner}/{repo}/pulls/7", 0, restPullJson()],
            ],
            commands
          )
        );
        expect(pullRequest.created).toBe(false);
        expect(commandLines(commands)).toContain(
          "gh api -X PATCH repos/{owner}/{repo}/pulls/7 title=feat(repo-cli): ship"
        );
        expect(laneRows(yield* Ref.get(recorder))).toEqual([
          [
            createStep.id,
            undefined,
            0,
            "skipped: open pull request #7 already exists; replaced the merge-commit subject on pull request #7 with: feat(repo-cli): ship",
          ],
        ]);
      })
    );

    it.effect("resolves the replacement title from history when the re-publish has no message", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        yield* ensurePullRequest(contextAt("/repo"), recorder, O.some(createStep)).pipe(
          withProcesses(
            [
              ["gh pr view", 0, prView({ title: MERGE_TITLE })],
              [TITLE_LOG, 0, titleLog("feat(repo-cli): from history")],
              ["gh api -X PATCH repos/{owner}/{repo}/pulls/7", 0, restPullJson()],
            ],
            commands
          )
        );
        expect(commandLines(commands)).toContain(
          "gh api -X PATCH repos/{owner}/{repo}/pulls/7 title=feat(repo-cli): from history"
        );
      })
    );

    it.effect("keeps an existing pull request title that is not a merge-commit subject", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        yield* ensurePullRequest(
          contextAt("/repo"),
          recorder,
          O.some(createStep),
          O.none(),
          {},
          O.some("feat(repo-cli): a newer message")
        ).pipe(withProcesses([["gh pr view", 0, prView({ title: "feat(repo-cli): merge strategy" })]], commands));
        expect(A.some(commandLines(commands), Str.includes("--title"))).toBe(false);
        expect(laneRows(yield* Ref.get(recorder))).toEqual([
          [createStep.id, undefined, 0, "skipped: open pull request #7 already exists"],
        ]);
      })
    );

    it.effect("patches the title through REST and never through the GraphQL gh pr edit", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        yield* ensurePullRequest(contextAt("/repo"), recorder, O.some(createStep), O.none(), {}, O.some("fix: x")).pipe(
          withProcesses(
            [
              ["gh pr view", 0, prView({ title: MERGE_TITLE })],
              ["gh pr edit 7 --title", 1, "GraphQL: API rate limit exceeded"],
              ["gh api -X PATCH repos/{owner}/{repo}/pulls/7", 0, restPullJson()],
            ],
            commands
          )
        );
        expect(commandLines(commands)).toContain("gh api -X PATCH repos/{owner}/{repo}/pulls/7 title=fix: x");
        expect(A.some(commandLines(commands), Str.startsWith("gh pr edit"))).toBe(false);
        expect(laneRows(yield* Ref.get(recorder))).toEqual([
          [
            createStep.id,
            undefined,
            0,
            "skipped: open pull request #7 already exists; replaced the merge-commit subject on pull request #7 with: fix: x",
          ],
        ]);
      })
    );

    it.effect("reports a refused rename without failing the publish", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        const pullRequest = yield* ensurePullRequest(
          contextAt("/repo"),
          recorder,
          O.some(createStep),
          O.none(),
          {},
          O.some("fix: $(printf UNSAFE)")
        ).pipe(
          withProcesses(
            [
              ["gh pr view", 0, prView({ title: MERGE_TITLE })],
              ["gh api -X PATCH repos/{owner}/{repo}/pulls/7", 1, "HTTP 403: Resource not accessible"],
            ],
            commands
          )
        );
        expect(pullRequest.number).toBe(7);
        const rows = laneRows(yield* Ref.get(recorder));
        expect(rows).toHaveLength(1);
        expect(rows[0]?.[3]).toContain("could not replace the merge-commit subject on pull request #7");
        expect(rows[0]?.[3]).toContain("review and edit its title in GitHub");
        expect(rows[0]?.[3]).not.toContain("$(printf UNSAFE)");
      })
    );
  });

  describe("pull request title helpers", () => {
    it.each([
      ["Merge branch 'main' into feat/x", true],
      ["Merge branches 'a' and 'b' into main", true],
      [MERGE_TITLE, true],
      ["Merge pull request #12 from o/branch", true],
      ["Merge commit 'abc123' into main", true],
      ["Merge tag 'v1.2.0' into main", true],
      ["feat(repo-cli): merge strategy", false],
      ["Merged the queue", false],
      ["chore: Merge branch tooling", false],
    ])("isMergeCommitSubject(%j) is %s", (subject, expected) => {
      expect(isMergeCommitSubject(subject)).toBe(expected);
    });

    it("takes the first non-empty trimmed line of a message", () => {
      assertSome(titleFromMessage("  feat(repo-cli): ship  \n\nbody"), "feat(repo-cli): ship");
      assertSome(titleFromMessage("\n\nfix: late subject\n"), "fix: late subject");
      assertNone(titleFromMessage(" \n \n"));
    });

    it("decodes a title as one trimmed non-empty line", () => {
      const decode = S.decodeUnknownOption(YeetPullRequestTitle);
      assertSome(decode("  feat(repo-cli): ship  "), "feat(repo-cli): ship");
      assertNone(decode("   "));
      assertNone(decode("feat: a\nfix: b"));
    });
  });

  describe("applyHeavyAdmissionLabel", () => {
    const created = YeetEnsuredPullRequest.make({ number: 7, url: O.some(PR_URL), created: true });
    const existing = YeetEnsuredPullRequest.make({ number: 7, url: O.some(PR_URL), created: false });
    const labelCommand = 'gh api -X POST repos/{owner}/{repo}/issues/7/labels labels=["ready-for-heavy"]';

    it.effect("skips the edit without a planned step, for an existing pull request, and for a docs-only diff", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        const context = contextAt("/repo");
        yield* Effect.all(
          [
            applyHeavyAdmissionLabel(context, recorder, O.none(), created),
            applyHeavyAdmissionLabel(context, recorder, O.some(labelStep), existing),
            applyHeavyAdmissionLabel(context, recorder, O.some(labelStep), created, {
              changedPaths: () => Effect.succeed(["docs/runbooks/ci.md", "README.md"]),
            }),
          ],
          { discard: true }
        ).pipe(withProcesses([], commands));
        expect(commandLines(commands)).toEqual([]);
        expect(laneRows(yield* Ref.get(recorder))).toEqual([
          [labelStep.id, "skipped", 0, "skipped: pull request #7 already existed and keeps its labels"],
          [labelStep.id, "skipped", 0, "skipped: docs-only diff needs no heavy matrix"],
        ]);
      })
    );

    it.effect("labels a created pull request whose branch diff carries code", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        yield* applyHeavyAdmissionLabel(contextAt("/repo"), recorder, O.some(labelStep), created).pipe(
          withProcesses(
            [
              [
                "diff --name-only -z --no-relative origin/main...HEAD",
                0,
                "docs/a.md\0packages/tooling/tool/cli/src/bin.ts\0",
              ],
              [labelCommand, 0, encodeJson([{ name: "ready-for-heavy" }, { name: "documentation" }])],
            ],
            commands
          )
        );
        assertSome(A.last(commandLines(commands)), labelCommand);
        expect(laneRows(yield* Ref.get(recorder))).toEqual([
          [labelStep.id, "passed", 0, "ready-for-heavy,documentation"],
        ]);
      })
    );

    it.effect("records a failed label edit without failing the publish, even for an empty diff", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        yield* applyHeavyAdmissionLabel(contextAt("/repo"), recorder, O.some(labelStep), created, {
          changedPaths: () => Effect.succeed([]),
        }).pipe(withProcesses([[labelCommand, 1, "label not found"]], commands));
        expect(commandLines(commands)).toEqual([labelCommand]);
        const rows = laneRows(yield* Ref.get(recorder));
        expect(A.map(rows, A.take(3))).toEqual([[labelStep.id, "failed", 1]]);
        expect(rows[0]?.[3]).toContain("label not found");
      })
    );
  });
});

// `mergePr` reads the branch's pull request (`gh pr view <branch>`, KEEP) and refuses before the
// reviewer gate, the squash merge and its REST confirmation.
it.layer(Layer.fresh(testLayer), { timeout: "30 seconds" })("yeet merge refusals", (it) => {
  const mergeView = (overrides: {
    readonly headRefName?: string;
    readonly state?: string;
    readonly headRefOid?: string;
  }) => encodeJson({ number: 7, headRefName: BRANCH, state: "OPEN", ...overrides });

  it.effect("refuses an option-like branch before reading GitHub", () =>
    Effect.gen(function* () {
      const commands = yield* makeCommands;
      const error = yield* mergePr(contextAt("/repo", "--delete")).pipe(Effect.flip, withProcesses([], commands));
      expect(error.message).toBe('yeet merge refuses an option-like branch name "--delete".');
      expect(commandLines(commands)).toEqual([]);
    })
  );

  it.effect("refuses a foreign head, a pull request that is not open, and one without a head to pin", () =>
    Effect.gen(function* () {
      const commands = yield* makeCommands;
      const refusal = (output: string) =>
        mergePr(contextAt("/repo")).pipe(Effect.flip, withProcesses([["gh pr view", 0, output]], commands));
      const foreign = yield* refusal(mergeView({ headRefName: "feat/other", headRefOid: "abc" }));
      expect(foreign.message).toBe(`yeet merge expected PR head "${BRANCH}" but gh reported "feat/other".`);
      const closed = yield* refusal(mergeView({ state: "CLOSED", headRefOid: "abc" }));
      expect(closed.message).toBe("yeet merge requires an open pull request; #7 is CLOSED.");
      const unpinned = yield* refusal(mergeView({}));
      expect(unpinned.message).toBe("yeet merge refuses to merge #7 without a head oid to pin the merge to.");
      const unreadable = yield* refusal("not json");
      expect(unreadable.message).toBe(`Failed to decode gh pr view JSON for "${BRANCH}".`);
      expect(A.some(commandLines(commands), Str.includes("-X PUT"))).toBe(false);
    })
  );
});

// The merge step below the reviewer gate: one REST squash PUT pinned to the head, then
// the REST confirmation poll (W6). The sweep tail of `mergePr` is not part of it.
it.layer(Layer.fresh(testLayer), { timeout: "30 seconds" })("yeet merge at the pinned head", (it) => {
  const HEAD_SHA = Str.repeat(40)("a");
  const MERGE_COMMAND = `gh pr merge 7 --squash --match-head-commit ${HEAD_SHA}`;
  const noWait = { pollAttempts: 1, pollInterval: Duration.zero };
  const mergedPull = restPullRequest({ number: 7, state: "closed", merged: true, merged_at: "2026-11-02T10:00:00Z" });
  const mergeGithub = (merge: GithubAnswer, pulls: ReadonlyArray<GithubAnswer> = [{ body: mergedPull }]) => {
    let reads = 0;
    return recordedGithub((call) => {
      if (call.method === "PUT") return merge;
      reads = reads + 1;
      return pulls[Math.min(reads, pulls.length) - 1];
    });
  };

  it.effect("squash-merges once at the pinned head with GitHub's own subject and body, then confirms", () =>
    Effect.gen(function* () {
      const github = mergeGithub({
        body: { merged: true, sha: Str.repeat(40)("b"), message: "Pull Request successfully merged" },
      });
      const confirmed = yield* mergeYeetPullRequestAtHead(7, HEAD_SHA, noWait).pipe(github.provide);
      expect([confirmed.number, confirmed.state]).toEqual([7, "MERGED"]);
      expect(A.map(github.calls, githubCallLine)).toEqual(["PUT {repo}/pulls/7/merge", "GET {repo}/pulls/7"]);
      const put = github.calls[0];
      expect(put?.body).toEqual({ sha: HEAD_SHA, merge_method: "squash" });
      expect(P.hasProperty(put?.body, "commit_message")).toBe(false);
      expect(P.hasProperty(put?.body, "commit_title")).toBe(false);
    })
  );

  it.effect.each([
    ["a head that moved (409)", 409, "Head branch was modified. Review and try the merge again."],
    ["a pull request that is not mergeable (405)", 405, "Pull Request is not mergeable"],
  ] as const)("fails %s with the merge command's wording and never confirms", ([, status, reason]) =>
    Effect.gen(function* () {
      const github = mergeGithub({ status, body: { message: reason } });
      const error = yield* mergeYeetPullRequestAtHead(7, HEAD_SHA, noWait).pipe(Effect.flip, github.provide);
      expect(error.message).toContain(`${MERGE_COMMAND} failed:\n`);
      expect(error.message).toContain(`(${status})`);
      expect(error.message).toContain(reason);
      expect(error.command).toBe(MERGE_COMMAND);
      expect(error.exitCode).toBe(1);
      expect(A.map(github.calls, githubCallLine)).toEqual(["PUT {repo}/pulls/7/merge"]);
    })
  );

  it.effect("names the missing workflows permission when GitHub refuses an App token's merge", () =>
    Effect.gen(function* () {
      const reason =
        "refusing to allow a GitHub App to create or update workflow `.github/workflows/heavy.yml` without `workflows` permission";
      const github = mergeGithub({ status: 403, body: { message: reason } });
      const error = yield* mergeYeetPullRequestAtHead(7, HEAD_SHA, noWait).pipe(Effect.flip, github.provide);
      expect(error.message).toContain(reason);
      expect(error.message).toContain("without the `workflows` permission");
      expect(error.message).toContain("`workflow` scope (`gh auth refresh -s workflow`)");
      expect(error.exitCode).toBe(1);
      expect(A.map(github.calls, githubCallLine)).toEqual(["PUT {repo}/pulls/7/merge"]);
    })
  );

  it("leaves any other GitHub failure message unchanged", () => {
    expect(withYeetGithubCredentialHint("Pull Request is not mergeable")).toBe("Pull Request is not mergeable");
  });

  it.effect("polls the confirmation within its budget and refuses a merge it cannot confirm", () =>
    Effect.gen(function* () {
      const merged = { body: { merged: true, sha: Str.repeat(40)("b"), message: "merged" } };
      const open = { body: restPullRequest({ number: 7 }) };
      const lagging = mergeGithub(merged, [open, { body: mergedPull }]);
      const confirmed = yield* mergeYeetPullRequestAtHead(7, HEAD_SHA, noWait).pipe(lagging.provide);
      expect(confirmed.state).toBe("MERGED");
      expect(A.length(lagging.calls)).toBe(3);
      const stuck = mergeGithub(merged, [open]);
      const error = yield* mergeYeetPullRequestAtHead(7, HEAD_SHA, noWait).pipe(Effect.flip, stuck.provide);
      expect(error.message).toBe("pull request #7 reports state OPEN, not MERGED.");
      expect(A.length(stuck.calls)).toBe(3);
      const unreadable = mergeGithub(merged, [{ status: 502, body: { message: "Bad Gateway" } }]);
      const readError = yield* mergeYeetPullRequestAtHead(7, HEAD_SHA, noWait).pipe(Effect.flip, unreadable.provide);
      expect(readError.message).toContain('Failed to read pull request "7" (');
      expect(readError.message).toContain("Bad Gateway");
    })
  );
});

it.layer(Layer.fresh(testLayer), { timeout: "30 seconds" })("yeet retire packet advisories", (it) => {
  it.effect("names the unexplained active packets from the branch diff when gh cannot list the files", () =>
    Effect.gen(function* () {
      const commands = yield* makeCommands;
      const plan = YeetRetirePlan.make({
        worktreePath: "/repo/lane",
        owningClone: "/repo",
        name: "lane",
        branch: "claude/lane",
      });
      const state = SweepGitState.make({
        branch: "claude/lane",
        mainBranch: "main",
        headBranch: "claude/lane",
        worktreeDirty: false,
        mainCheckedOutElsewhere: false,
        branchCheckedOutElsewhere: false,
        branchMergedIntoBase: true,
        lockfileMovedOnMainUpdate: false,
        statusProbeUnreliable: false,
        worktreeProbeUnreliable: false,
      });
      const manifest = (slug: string) => `show HEAD:goals/${slug}/ops/manifest.json`;
      // A packet stays open on purpose when it names what blocks it; an empty
      // blockedBy explains nothing, so that packet is still an advisory.
      const slugs = yield* activePacketsOnBranch(plan, state).pipe(
        withProcesses(
          [
            ["gh pr view claude/lane --json files", 1, "no pull requests found"],
            ["merge-base main HEAD", 0, "abc123\n"],
            [
              "diff --name-only -z --no-relative abc123 HEAD -- goals/",
              0,
              "goals/open/ops/manifest.json\0goals/blocked/SPEC.md\0goals/unblocked/SPEC.md\0goals/INDEX.md\0",
            ],
            [manifest("open"), 0, encodeJson({ lifecycle: "active" })],
            [manifest("blocked"), 0, encodeJson({ lifecycle: "active", blockedBy: ["operator gate"] })],
            [manifest("unblocked"), 0, encodeJson({ lifecycle: "active", blockedBy: [] })],
          ],
          commands
        )
      );
      expect(slugs).toEqual(["open", "unblocked"]);
      expect(A.some(commandLines(commands), Str.startsWith("gh pr view claude/lane --json files"))).toBe(true);
    })
  );
});

describe("yeet plan step models", () => {
  const feedbackStep = (id: string, overrides: Partial<RepoPlanStep> = {}) =>
    RepoPlanStep.make({
      args: ["run", "check"],
      command: "bun",
      cwd: "/repo",
      id,
      label: id,
      mutability: "readonly",
      phase: "feedback",
      resume: "fingerprint-match",
      scope: "package",
      ...overrides,
    });

  it("plans the default publish identically in either call form", () => {
    const context = contextAt("/repo");
    const message = O.some("feat(repo-cli): ship");
    const plan = buildYeetRunPlan(context, message);
    expect(pipe(context, buildYeetRunPlan(message)).steps).toEqual(plan.steps);
    expect(A.some(plan.steps, (step) => step.label === "publish:git:push")).toBe(true);
  });

  it("orders steps by phase before identifier", () => {
    const ordered = A.sort(
      [
        feedbackStep("publish:b", { phase: "publish" }),
        feedbackStep("feedback:b"),
        feedbackStep("prepare:a", { phase: "prepare" }),
        feedbackStep("feedback:a"),
      ],
      byRepoPlanStepAscending
    );
    expect(A.map(ordered, (step) => step.id)).toEqual(["prepare:a", "feedback:a", "feedback:b", "publish:b"]);
    expect(byRepoPlanStepAscending(feedbackStep("feedback:b"))(feedbackStep("feedback:a"))).toBe(-1);
  });

  it("keeps resume metadata only on read-only package feedback steps", () => {
    const candidate = feedbackStep("feedback:check");
    expect(isConservativeResumeCandidate(candidate)).toBe(true);
    expect(enforceConservativeResume(candidate).resume).toBe("fingerprint-match");
    const unsafe = [
      feedbackStep("full:check", { phase: "full" }),
      feedbackStep("feedback:repo", { scope: "repo" }),
      feedbackStep("feedback:write", { mutability: "write" }),
    ];
    expect(A.map(unsafe, isConservativeResumeCandidate)).toEqual([false, false, false]);
    expect(A.map(unsafe, (step) => enforceConservativeResume(step).resume)).toEqual(["never", "never", "never"]);
  });

  it("quotes empty and shell-sensitive arguments in the rendered command", () => {
    const step = feedbackStep("commit", { command: "git", args: ["commit", "-m", "it's done", "", "--no-edit"] });
    expect(commandTextForStep(step)).toBe("git commit -m 'it'\\''s done' '' --no-edit");
  });

  it("resolves a step's Turbo task by task name, task id, then step id", () => {
    const byName = TurboPlanTask.make({ taskId: "@beep/schema#check", task: "check" });
    const byId = TurboPlanTask.make({ taskId: "@beep/utils#lint" });
    const byStepId = TurboPlanTask.make({ taskId: "feedback:test" });
    const context = RepoRunContext.make({
      ...contextAt("/repo"),
      turbo: TurboPlanSnapshot.make({
        graphHealthStatus: "ok",
        graphHealthWarnings: [],
        tasks: [byName, byId, byStepId],
      }),
    });
    assertSome(turboTaskForStep(context, feedbackStep("feedback:check", { task: "check" })), byName);
    assertSome(pipe(context, turboTaskForStep(feedbackStep("feedback:lint", { task: "@beep/utils#lint" }))), byId);
    assertSome(turboTaskForStep(context, feedbackStep("feedback:test")), byStepId);
    assertSome(turboTaskForStep(context, feedbackStep("feedback:test", { task: "unknown" })), byStepId);
    assertNone(turboTaskForStep(context, feedbackStep("feedback:missing")));
  });
});

it.layer(Layer.fresh(testLayer), { timeout: "30 seconds" })("yeet ready gate over gh", (it) => {
  const HEAD_SHA = "c051bba853c051bba853c051bba853c051bba853";
  const passingCheck = {
    bucket: "pass",
    completedAt: "2026-10-05T18:15:00Z",
    link: "https://github.com/o/r/actions/runs/77/job/3",
    name: "Check / Lint",
    startedAt: "2026-10-05T18:10:00Z",
    state: "SUCCESS",
    workflow: "Check",
  };
  // What `gh` prints for a draft pull request whose required checks are green
  // and whose review threads are all answered: the D10 gate holds.
  const greenDraft: ReadonlyArray<Reply> = [
    [
      "gh pr view --json id,number",
      0,
      encodeJson({
        headRefOid: HEAD_SHA,
        id: "PR_ready",
        isDraft: true,
        labels: [{ name: "ready-for-heavy" }],
        mergeable: "MERGEABLE",
        mergeStateStatus: "DRAFT",
        number: 7,
        reviewDecision: null,
        state: "OPEN",
        url: PR_URL,
      }),
    ],
    ["gh pr checks", 0, encodeJson([passingCheck])],
    [
      "gh api graphql",
      0,
      encodeJson({
        data: {
          node: {
            author: { login: "author" },
            reviewThreads: { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } },
          },
        },
      }),
    ],
    ["gh run list", 0, "[]"],
    ["git ", 0, ""],
  ];

  const remoteOf = (overrides: Partial<YeetStatusRemote> = {}) =>
    YeetStatusRemote.make({
      available: true,
      checked: true,
      detail: "PR #7 OPEN",
      state: "OPEN",
      number: 7,
      headSha: O.some(HEAD_SHA),
      isDraft: true,
      mergeable: "MERGEABLE",
      mergeStateStatus: "DRAFT",
      requiredCheckCount: 1,
      failingRequiredCheckCount: 0,
      pendingRequiredCheckCount: 0,
      unresolvedReviewThreadCount: 0,
      ...overrides,
    });
  const closeout = YeetStatusArtifact.make({
    detail: "closed",
    issueCount: 0,
    path: "pr-closeout.json",
    state: "present",
    reviewedHeadSha: O.some(HEAD_SHA),
  });
  const readOf = (remote: YeetStatusRemote, shown: YeetStatusRemote = remote) =>
    YeetReadyPullRequestRead.make({ remote: shown, mergeReady: deriveYeetMergeReady(closeout, remote) });
  const readTwice = Effect.fnUntraced(function* (first: YeetReadyPullRequestRead, later: YeetReadyPullRequestRead) {
    const count = yield* Ref.make(0);
    return () => Ref.getAndUpdate(count, (n) => n + 1).pipe(Effect.map((n) => (n === 0 ? first : later)));
  });

  it("names what the read could not show in a blocker", () => {
    const numberless = remoteOf({ state: "CLOSED" });
    expect(
      decideYeetReadyGate(
        YeetReadyPullRequestRead.make({
          remote: YeetStatusRemote.make({ available: true, checked: true, detail: "PR CLOSED", state: "CLOSED" }),
          mergeReady: deriveYeetMergeReady(closeout, numberless),
        })
      )
    ).toMatchObject({ _tag: "blocked", blocker: "pr-open", detail: "pull request #? is CLOSED" });
    // A pending required check never holds the content-final flip (D11).
    expect(decideYeetReadyGate(readOf(remoteOf({ headSha: O.none(), pendingRequiredCheckCount: 1 })))._tag).toBe(
      "flip"
    );
    expect(decideYeetReadyGate(readOf(remoteOf({ headSha: O.none(), failingRequiredCheckCount: 1 })))).toMatchObject({
      _tag: "blocked",
      blocker: "no-required-red",
      detail:
        '1 required check(s) are failing on head unknown; a red required check means the content is not final. Pending checks and optional lanes do not hold the flip; under S11, attribute a red inherited from main with --inherited "<check>=<attribution>"',
    });
    // Every criterion holds, yet the read carries no pull request number to
    // flip: the gate refuses on its first criterion instead of guessing one.
    expect(
      decideYeetReadyGate(
        readOf(remoteOf(), YeetStatusRemote.make({ available: false, checked: true, detail: "no number" }))
      )
    ).toMatchObject({
      _tag: "blocked",
      blocker: "pr-open",
      detail: "no open pull request was found for this branch",
    });
  });

  it.effect("flips the draft after three status reads with an injected body recorder", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-ready-flip-" });
      const commands = yield* makeCommands;
      const flips = yield* Ref.make<ReadonlyArray<number>>([]);
      const decision = yield* runYeetReadyGate(contextAt(root), {
        finalCheck: passingFinalCheck,
        recordInherited: () => Effect.void,
        markReady: (prNumber) => Ref.update(flips, A.append(prNumber)),
      }).pipe(withProcesses(greenDraft, commands));
      expect(decision).toMatchObject({ _tag: "flip", prNumber: 7 });
      const ran = commandLines(commands);
      expect(A.length(A.filter(ran, Str.startsWith("gh pr view --json id,number")))).toBe(3);
      expect(yield* Ref.get(flips)).toEqual([7]);
    })
  );

  it.effect("still flips when the job registry cannot be listed", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-ready-registry-" });
      // The registry directory is a file here, so listing it fails.
      yield* fs.makeDirectory(path.join(root, ".beep", "yeet"), { recursive: true });
      yield* fs.writeFileString(path.join(root, ".beep", "yeet", "jobs"), "not a directory");
      const commands = yield* makeCommands;
      const decision = yield* runYeetReadyGate(contextAt(root), {
        finalCheck: passingFinalCheck,
        recordInherited: () => Effect.void,
        markReady: () => Effect.void,
        read: () => Effect.succeed(readOf(remoteOf())),
      }).pipe(withProcesses([], commands));
      expect(decision._tag).toBe("flip");
    })
  );

  it.effect("names the live readiness monitor after the flip", () =>
    Effect.gen(function* () {
      const jobId = "cc5d6bd3-1111-4aaa-8bbb-000000000001";
      const monitor = ProofJobRecord.make({
        jobId,
        phase: "running",
        submittedAt: "2026-10-05T10:00:00.000Z",
        request: ProofJobRequest.make({
          mode: "monitor",
          argv: ["monitor", "--until-ready", "--json"],
          checkout: "/repo",
          branch: BRANCH,
          base: "origin/main",
          head: HEAD_SHA,
          forwardedEnvNames: [],
        }),
        submitter: ProofJobSubmitter.make({ pid: 4242, procStart: O.none(), cwd: "/repo", harness: O.none() }),
        unit: ProofJobUnit.make({
          unitName: `beep-proof-${jobId}.service`,
          slice: "agent-runs.slice",
          description: "beep-yeet-job",
          logPath: `/repo/.beep/yeet/jobs/${jobId}.log`,
          execStart: ["/opt/bun"],
          execStopPost: ["/opt/bun"],
          maxRuntimeSeconds: O.none(),
          invocationId: O.none(),
        }),
        runner: O.none(),
        outcome: O.none(),
        systemd: O.none(),
        terminationReason: O.none(),
        cancelRequestedAt: O.none(),
        prNumber: O.some(7),
      });
      const asked = yield* Ref.make<ReadonlyArray<number>>([]);
      const decision = yield* runYeetReadyGate(contextAt("/repo"), {
        finalCheck: passingFinalCheck,
        recordInherited: () => Effect.void,
        markReady: () => Effect.void,
        findMonitor: (_context, prNumber) => Ref.update(asked, A.append(prNumber)).pipe(Effect.as(O.some(monitor))),
        read: () => Effect.succeed(readOf(remoteOf())),
      });
      expect(decision._tag).toBe("flip");
      expect(yield* Ref.get(asked)).toEqual([7]);
    })
  );

  it.effect("refuses the flip when the confirming read differs from the gate read", () =>
    Effect.gen(function* () {
      const headless = readOf(remoteOf({ headSha: O.none() }));
      const refusal = Effect.fnUntraced(function* (first: YeetReadyPullRequestRead, later: YeetReadyPullRequestRead) {
        const error = yield* runYeetReadyGate(contextAt("/repo"), {
          finalCheck: passingFinalCheck,
          markReady: () => Effect.die("the flip must not run"),
          read: yield* readTwice(first, later),
        }).pipe(Effect.flip);
        return error.message;
      });
      expect(yield* refusal(readOf(remoteOf()), readOf(remoteOf({ isDraft: false })))).toContain(
        "the pull request changed between the gate read and the flip; it is already ready for review."
      );
      // Without a head on either read the gate cannot prove they match.
      expect(yield* refusal(headless, headless)).toContain("the head moved (gate unknown, live unknown)");
    })
  );
});

// runYeetReady locates the checked-out repository from process.cwd(), so this
// single integration case needs the host filesystem; the scripted gh process
// still prevents any real GitHub command.
it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer), { timeout: "30 seconds" })(
  "yeet ready native repo root",
  (it) => {
    it.effect("runs the gate for the checked-out branch and refuses when it has no pull request", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const packetDir = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-ready-command-" });
        const commands = yield* makeCommands;
        const error = yield* runYeetReady(
          YeetReadyOptions.make({ base: "origin/main", head: "HEAD", packetDir, inherited: [] })
        ).pipe(
          Effect.flip,
          withProcesses(
            [
              ["gh pr view", 1, "no pull requests found"],
              ["rev-parse --abbrev-ref HEAD", 0, `${BRANCH}\n`],
              ["git ", 0, ""],
            ],
            commands
          )
        );
        expect(error).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "pr-open" });
        expect(A.some(commandLines(commands), Str.startsWith("gh pr ready"))).toBe(false);
      })
    );
  }
);
