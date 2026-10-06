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
  findOpenPullRequest,
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
  validateCommitMessage,
  validateMonitorBranch,
  validateMonitorGuards,
  validateOpenPullRequest,
  validateProofJobDetach,
  validateRequiredMessage,
  YeetEnsuredPullRequest,
  YeetExecutedStep,
  YeetReadyOptions,
  YeetReadyPullRequestRead,
  YeetRetirePlan,
  YeetStatusArtifact,
  YeetStatusRemote,
} from "@beep/repo-cli/test/Yeet";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { ConfigProvider, Effect, FileSystem, flow, Layer, Path, pipe, Ref, Result, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { YeetRunOptions } from "@beep/repo-cli/test/Yeet";

const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const BRANCH = "feat/coverage-restore";
const PR_URL = "https://github.com/o/r/pull/7";

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

const prView = (overrides: { readonly headRefName?: string; readonly state?: string; readonly url?: string } = {}) =>
  encodeJson({ number: 7, headRefName: BRANCH, state: "OPEN", ...overrides });

const handle = (exitCode: number, output: string) =>
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

// One scripted process response, matched by a substring of the whole command
// line. The first matching reply wins; an unscripted command exits 1. A
// negative exit code scripts a command that could not be spawned at all.
type Reply = readonly [needle: string, exitCode: number, output: string];

const scriptedSpawner = (replies: ReadonlyArray<Reply>, commands: Ref.Ref<ReadonlyArray<string>>) =>
  ChildProcessSpawner.make((command) => {
    if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
    const line = A.join([command.command, ...command.args], " ");
    const reply = A.findFirst(replies, ([needle]) => pipe(line, Str.includes(needle)));
    return Ref.update(commands, A.append(line)).pipe(
      Effect.andThen(
        O.match(reply, {
          onNone: () => Effect.succeed(handle(1, `unscripted: ${line}`)),
          onSome: ([, exitCode, output]) =>
            exitCode < 0
              ? Effect.fail(
                  PlatformError.systemError({
                    _tag: "NotFound",
                    module: "YeetPullRequestGuardsTest",
                    method: "spawn",
                    description: output,
                  })
                )
              : Effect.succeed(handle(exitCode, output)),
        })
      )
    );
  });

const withProcesses =
  (replies: ReadonlyArray<Reply>, commands: Ref.Ref<ReadonlyArray<string>>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, scriptedSpawner(replies, commands)));

const makeCommands = Ref.make<ReadonlyArray<string>>([]);
const makeRecorder = Ref.make<ReadonlyArray<YeetExecutedStep>>([]);
const failClosedSpawnerLayer = Layer.effect(
  ChildProcessSpawner.ChildProcessSpawner,
  makeCommands.pipe(Effect.map((commands) => scriptedSpawner([], commands)))
);
const testLayer = Layer.mergeAll(MemoryFileSystem.layer, Path.layer, NodeCrypto.layer, failClosedSpawnerLayer);

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
        [{ pushOnly: true }, "yeet publish --push-only requires --reuse-verified."],
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
          defaultYeetRunOptions({ pushOnly: true, reuseVerified: true }),
          defaultYeetRunOptions({ amend: true, noEdit: true }),
          defaultYeetRunOptions({ mode: "monitor", plan: true }),
          defaultYeetRunOptions({ monitor: true }),
        ],
        (options) => validateMonitorGuards(contextAt("/repo"), options),
        { discard: true }
      ).pipe(withProcesses([], commands));
      expect(yield* Ref.get(commands)).toEqual([]);
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
      ).pipe(withProcesses([["gh pr view", 0, prView()]], commands));
      expect(A.length(yield* Ref.get(commands))).toBe(2);

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
      expect(yield* Ref.get(commands)).toEqual([`commitlint --edit ${messagePath}`]);

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
            "gh api repos/{owner}/{repo}/pulls?head=beep-effect%3Afeat%2Fcoverage-restore&state=open",
            0,
            `[${prView()}]`,
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
                "gh api repos/{owner}/{repo}/pulls?head=fork-owner%3Arepo-cli%2Ffix&state=open",
                0,
                `[${prView({ headRefName: branch })}]`,
              ],
            ],
            commands
          )
        );
        expect(view.headRefName).toBe(branch);
        expect(A.some(yield* Ref.get(commands), Str.includes("head=fork-owner%3Arepo-cli%2Ffix"))).toBe(true);
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
                ["gh api repos/{owner}/{repo}/pulls?head=", restExit, restOutput],
              ],
              commands
            )
          );
        assertNone(yield* absent(0, "[]"));
        const failed = yield* Effect.flip(absent(1, "GitHub REST unavailable"));
        expect(failed.message).toBe("Failed to inspect current branch pull request through GitHub REST.");
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
              ["log --reverse", 0, "## feat(repo-cli): ship\n\nbody text\n"],
            ],
            commands
          )
        );
        expect(body).toContain("## feat(repo-cli): ship\n\nbody text\n\n## Local proof\n\n");
        expect(body).toContain("- full:cheap-gates: passed\n- full:pre-push: failed\n\nVerdict: .beep/yeet/runs/");
        expect(A.some(yield* Ref.get(commands), Str.endsWith("abc123..HEAD"))).toBe(true);
      })
    );

    it.effect("falls back to HEAD and names hosted CI when nothing ran locally", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        const body = yield* buildPrBody(contextAt("/repo"), recorder).pipe(
          withProcesses([["log --reverse", 0, "## docs: note\n"]], commands)
        );
        expect(body).toContain("- no local proof lane ran before the push; hosted CI is the authoritative proof");
        expect(A.some(yield* Ref.get(commands), Str.endsWith(" HEAD"))).toBe(true);
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
    it.effect("creates a ready pull request through gh and keeps going when provenance is unavailable", () =>
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
              ["log -1", 0, "feat(repo-cli): ship\n"],
              ["log --reverse", 0, "## feat(repo-cli): ship\n"],
              ["gh pr create", 0, `${PR_URL}\n`],
              ["gh pr view", 0, prView()],
            ],
            commands
          )
        );
        expect(pullRequest.number).toBe(7);
        expect(pullRequest.created).toBe(true);
        assertSome(pullRequest.url, PR_URL);
        const create = A.findFirst(yield* Ref.get(commands), Str.startsWith("gh pr create"));
        assertSome(O.map(create, Str.startsWith("gh pr create --title feat(repo-cli): ship --body-file ")), true);
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

    it.effect("opens a draft and falls back to the viewed URL when gh prints none", () =>
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
              ["log -1", 0, "feat(repo-cli): ship\n"],
              ["log --reverse", 0, "## feat(repo-cli): ship\n"],
              ["gh pr create --draft", 0, ""],
              ["gh pr view", 0, prView({ url: PR_URL })],
            ],
            commands
          )
        );
        assertSome(pullRequest.url, PR_URL);
        expect(laneRows(yield* Ref.get(recorder))).toEqual([[draftCreateStep.id, undefined, 0, ""]]);
      })
    );

    it.effect("creates a fork-head draft through REST after GraphQL rate limiting and a confirmed absent PR", () =>
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
              ["log -1", 0, "feat(repo-cli): ship\n"],
              ["log --reverse", 0, "## feat(repo-cli): ship\n"],
              ["gh pr create", 1, "GraphQL: API rate limit exceeded"],
              ["git remote get-url --push origin", 0, "git@github.com:fork-owner/beep-effect.git"],
              ["gh api repos/{owner}/{repo}/pulls?head=", 0, "[]"],
              ["gh api -X POST repos/{owner}/{repo}/pulls", 0, `${PR_URL}\n`],
              ["gh pr view", 0, prView({ headRefName: branch })],
            ],
            commands
          )
        );
        expect(pullRequest.created).toBe(true);
        assertSome(pullRequest.url, PR_URL);
        expect(A.some(yield* Ref.get(commands), Str.includes("draft=true"))).toBe(true);
        expect(A.some(yield* Ref.get(commands), Str.includes("base=main"))).toBe(true);
        expect(A.some(yield* Ref.get(commands), Str.includes("head=fork-owner:repo-cli/fix"))).toBe(true);
        expect(A.some(yield* Ref.get(commands), Str.includes("body=@"))).toBe(true);
        const recorded = yield* Ref.get(recorder);
        expect(recorded[0]?.result.commandText).toBe("gh api -X POST repos/{owner}/{repo}/pulls");
      })
    );

    it.effect("reuses the existing PR when REST finds one after a GraphQL creation failure", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-rest-existing-" });
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        const pullRequest = yield* ensurePullRequest(contextAt(root), recorder, O.some(createStep), O.none(), {
          findOpen: () => Effect.succeedNone,
        }).pipe(
          withProcesses(
            [
              ["log -1", 0, "feat(repo-cli): ship\n"],
              ["log --reverse", 0, "## feat(repo-cli): ship\n"],
              ["gh pr create", 1, "GraphQL: API rate limit already exceeded"],
              ["git remote get-url --push origin", 0, "git@github.com:beep-effect/beep-effect.git"],
              ["gh api repos/{owner}/{repo}/pulls?head=", 0, `[${prView({ url: PR_URL })}]`],
            ],
            commands
          )
        );
        expect(pullRequest.created).toBe(false);
        expect(A.some(yield* Ref.get(commands), Str.includes("-X POST"))).toBe(false);
      })
    );

    it.effect("fails the publish when gh pr create exits nonzero", () =>
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
              ["log -1", 0, "feat(repo-cli): ship\n"],
              ["log --reverse", 0, "## feat(repo-cli): ship\n"],
              ["gh pr create", 1, "a pull request for this branch already exists"],
            ],
            commands
          )
        );
        expect(error.message).toBe("gh pr create failed:\na pull request for this branch already exists");
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
        expect(A.some(yield* Ref.get(commands), Str.startsWith("gh pr create"))).toBe(false);
      })
    );
  });

  describe("applyHeavyAdmissionLabel", () => {
    const created = YeetEnsuredPullRequest.make({ number: 7, url: O.some(PR_URL), created: true });
    const existing = YeetEnsuredPullRequest.make({ number: 7, url: O.some(PR_URL), created: false });
    const labelCommand = "gh pr edit 7 --add-label ready-for-heavy";

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
        expect(yield* Ref.get(commands)).toEqual([]);
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
              ["diff --name-only -z origin/main...HEAD", 0, "docs/a.md\0packages/tooling/tool/cli/src/bin.ts\0"],
              [labelCommand, 0, `${PR_URL}\n`],
            ],
            commands
          )
        );
        assertSome(A.last(yield* Ref.get(commands)), labelCommand);
        expect(laneRows(yield* Ref.get(recorder))).toEqual([[labelStep.id, "passed", 0, PR_URL]]);
      })
    );

    it.effect("records a failed label edit without failing the publish, even for an empty diff", () =>
      Effect.gen(function* () {
        const commands = yield* makeCommands;
        const recorder = yield* makeRecorder;
        const captured = yield* makeCommands;
        yield* applyHeavyAdmissionLabel(contextAt("/repo"), recorder, O.some(labelStep), created, {
          capture: (command, args) =>
            Ref.update(captured, A.append(A.join([command, ...args], " "))).pipe(
              Effect.as({ exitCode: 1, output: "label not found", truncated: false })
            ),
          changedPaths: () => Effect.succeed([]),
        }).pipe(withProcesses([], commands));
        expect(yield* Ref.get(captured)).toEqual([labelCommand]);
        expect(laneRows(yield* Ref.get(recorder))).toEqual([[labelStep.id, "failed", 1, "label not found"]]);
      })
    );
  });
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
              "diff --name-only abc123 HEAD -- goals/",
              0,
              "goals/open/ops/manifest.json\ngoals/blocked/SPEC.md\ngoals/unblocked/SPEC.md\ngoals/INDEX.md\n",
            ],
            [manifest("open"), 0, encodeJson({ lifecycle: "active" })],
            [manifest("blocked"), 0, encodeJson({ lifecycle: "active", blockedBy: ["operator gate"] })],
            [manifest("unblocked"), 0, encodeJson({ lifecycle: "active", blockedBy: [] })],
          ],
          commands
        )
      );
      expect(slugs).toEqual(["open", "unblocked"]);
      expect(A.some(yield* Ref.get(commands), Str.startsWith("gh pr view claude/lane --json files"))).toBe(true);
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
  const flipped = { exitCode: 0, output: "", truncated: false };

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
    expect(decideYeetReadyGate(readOf(remoteOf({ headSha: O.none(), pendingRequiredCheckCount: 1 })))).toMatchObject({
      _tag: "blocked",
      blocker: "required-checks-green",
      detail: "required checks are not green on head unknown: 0 failing, 1 pending of 1 required",
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

  it.effect("flips the draft through gh when its own status read holds the gate, twice", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-ready-flip-" });
      const commands = yield* makeCommands;
      const decision = yield* runYeetReadyGate(contextAt(root)).pipe(
        withProcesses([["gh pr ready 7", 0, ""], ...greenDraft], commands)
      );
      expect(decision).toMatchObject({ _tag: "flip", prNumber: 7 });
      const ran = yield* Ref.get(commands);
      expect(A.length(A.filter(ran, Str.startsWith("gh pr view --json id,number")))).toBe(2);
      assertSome(A.findFirst(ran, Str.startsWith("gh pr ready")), "gh pr ready 7");
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
        capture: () => Effect.succeed(flipped),
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
        capture: () => Effect.succeed(flipped),
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
          capture: () => Effect.die("gh must not run"),
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
it.layer(NodeServices.layer, { timeout: "30 seconds" })("yeet ready native repo root", (it) => {
  it.effect("runs the gate for the checked-out branch and refuses when it has no pull request", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const packetDir = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-ready-command-" });
      const commands = yield* makeCommands;
      const error = yield* runYeetReady(YeetReadyOptions.make({ base: "origin/main", head: "HEAD", packetDir })).pipe(
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
      expect(A.some(yield* Ref.get(commands), Str.startsWith("gh pr ready"))).toBe(false);
    })
  );
});
