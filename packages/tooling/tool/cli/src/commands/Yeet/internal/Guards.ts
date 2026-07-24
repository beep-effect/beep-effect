/**
 * Yeet mode/flag and commit-message guards.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { resolveLocalRepoBinary, runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { optionFromNonEmpty } from "./GitExec.ts";
import { commitMessagePathForContext, writeTextFile } from "./IssueArtifacts.ts";
import { validateOpenPullRequest } from "./PullRequest.ts";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetRunOptions } from "../Yeet.schemas.ts";

const blockedMonitorBranches: ReadonlyArray<string> = ["main", "master", "HEAD"];

/**
 * Return whether the selected Yeet mode should require PR check monitoring.
 *
 * @param options - Runtime Yeet options after CLI defaults are applied.
 * @returns `true` for explicit monitor requests and modes whose success
 * depends on PR closeout state.
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { defaultYeetRunOptions, shouldMonitorChecks } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(shouldMonitorChecks(defaultYeetRunOptions({ mode: "closeout" })), true)
 * strictEqual(shouldMonitorChecks(defaultYeetRunOptions({ mode: "verify" })), false)
 * ```
 * @category guards
 * @since 0.0.0
 */
export const shouldMonitorChecks = (options: YeetRunOptions): boolean =>
  options.monitor || options.mode === "monitor" || options.mode === "closeout";

/**
 * Require explicit PR creation consent before repository hydration can perform
 * remote base reads for start-pr-early publish.
 *
 * @param options - Runtime Yeet options after CLI defaults are applied.
 * @returns A successful Effect unless start-pr-early omits `--pr`.
 * @category guards
 * @since 0.0.0
 */
export const validateStartPrEarlyPrGuard = (options: YeetRunOptions): Effect.Effect<void, YeetCommandError> =>
  options.startPrEarly && !options.pr
    ? Effect.fail(
        YeetCommandError.make({
          message:
            "yeet publish --start-pr-early requires --pr so a PR-less branch creates its pull request before monitoring. Add `--pr` and retry.",
          exitCode: 1,
        })
      )
    : Effect.void;

/**
 * Reject monitor-like Yeet flows on branches that cannot have a PR head.
 *
 * @param context - Repo context carrying the current branch name.
 * @returns A successful Effect when the branch may be monitored.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { RepoRunContext, validateMonitorBranch } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const allowed = validateMonitorBranch(context).pipe(Effect.as("monitorable"))
 * ```
 * @category guards
 * @since 0.0.0
 */
export const validateMonitorBranch = (context: RepoRunContext): Effect.Effect<void, YeetCommandError> => {
  if (!A.contains(blockedMonitorBranches, context.branch)) {
    return Effect.void;
  }

  return Effect.fail(
    YeetCommandError.make({
      message: `yeet monitor is PR-branch-only; refusing to monitor branch "${context.branch}".`,
      command: "git rev-parse --abbrev-ref HEAD",
      exitCode: 1,
    })
  );
};

/**
 * Validate cross-flag constraints before Yeet monitor, closeout, or publish work.
 *
 * @param context - Current repository context used for branch and PR checks.
 * @param options - Runtime Yeet options whose mode-specific combinations must
 * be legal.
 * @returns An Effect that completes only when all monitor-related guard rails
 * accept the request.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { defaultYeetRunOptions, RepoRunContext, validateMonitorGuards } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const checked = validateMonitorGuards(context, defaultYeetRunOptions({ mode: "verify" })).pipe(
 *   Effect.as("guards passed")
 * )
 * ```
 * @category guards
 * @since 0.0.0
 */
export const validateMonitorGuards = Effect.fn("Yeet.validateMonitorGuards")(function* (
  context: RepoRunContext,
  options: YeetRunOptions
): Effect.fn.Return<void, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  yield* validateStartPrEarlyPrGuard(options);

  if (options.fast && options.mode !== "publish") {
    return yield* YeetCommandError.make({
      message: "yeet --fast is only valid for publish.",
      exitCode: 1,
    });
  }

  if (options.fast && !options.monitor) {
    return yield* YeetCommandError.make({
      message: "yeet publish --fast requires --monitor so hosted PR checks remain explicit.",
      exitCode: 1,
    });
  }

  if (options.startPrEarly && options.mode !== "publish") {
    return yield* YeetCommandError.make({
      message: "yeet --start-pr-early is only valid for publish.",
      exitCode: 1,
    });
  }

  if (options.startPrEarly && !options.monitor) {
    return yield* YeetCommandError.make({
      message:
        "yeet publish --start-pr-early requires --monitor so hosted PR checks are watched while local proof runs.",
      exitCode: 1,
    });
  }

  if (
    options.startPrEarly &&
    (options.fast || options.pushOnly || options.reuseVerified || options.amend || options.noEdit)
  ) {
    return yield* YeetCommandError.make({
      message:
        "yeet publish --start-pr-early cannot be combined with --fast, --push-only, --reuse-verified, --amend, or --no-edit.",
      exitCode: 1,
    });
  }

  if (options.mode === "publish" && options.tier !== "full") {
    return yield* YeetCommandError.make({
      message: "yeet publish always uses the full local proof. Use `yeet verify --tier review-fix` for review loops.",
      exitCode: 1,
    });
  }

  if (options.noEdit && !options.amend) {
    return yield* YeetCommandError.make({
      message: "yeet publish --no-edit requires --amend.",
      exitCode: 1,
    });
  }

  if (options.pushOnly && options.mode !== "publish") {
    return yield* YeetCommandError.make({
      message: "yeet --push-only is only valid for publish.",
      exitCode: 1,
    });
  }

  if (options.pushOnly && !options.reuseVerified) {
    return yield* YeetCommandError.make({
      message: "yeet publish --push-only requires --reuse-verified.",
      exitCode: 1,
    });
  }

  if (options.pushOnly && (options.amend || options.noEdit || options.fast)) {
    return yield* YeetCommandError.make({
      message: "yeet publish --push-only cannot be combined with --amend, --no-edit, or --fast.",
      exitCode: 1,
    });
  }

  if (options.pushOnly && O.isSome(optionFromNonEmpty(options.message))) {
    return yield* YeetCommandError.make({
      message: "yeet publish --push-only does not accept --message because it never creates a commit.",
      exitCode: 1,
    });
  }

  if (options.pr && options.mode !== "publish") {
    return yield* YeetCommandError.make({
      message: "yeet --pr is only valid for publish.",
      exitCode: 1,
    });
  }

  if (options.stagedOnly && options.mode !== "publish") {
    return yield* YeetCommandError.make({
      message: "yeet --staged-only is only valid for publish.",
      exitCode: 1,
    });
  }

  if (options.stagedOnly && (options.pushOnly || options.reuseVerified || options.amend)) {
    return yield* YeetCommandError.make({
      message:
        "yeet publish --staged-only cannot be combined with --push-only, --reuse-verified, or --amend; those modes never create a fresh reviewed commit to scope.",
      exitCode: 1,
    });
  }

  if (!shouldMonitorChecks(options)) {
    return;
  }

  yield* validateMonitorBranch(context);
  if (!options.plan && !options.pr) {
    yield* validateOpenPullRequest(context);
  }
});

/**
 * Require an explicit conventional commit message for publish modes that create
 * a commit.
 *
 * @param options - Runtime Yeet options after command-line parsing.
 * @returns The trimmed commit message when one is required and present, or
 * `None` for modes that do not create a commit.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { defaultYeetRunOptions, validateRequiredMessage } from "@beep/repo-cli/test/Yeet"
 *
 * const message = validateRequiredMessage(
 *   defaultYeetRunOptions({ message: "feat: ship yeet closeout", mode: "publish" })
 * ).pipe(Effect.map((value) => O.getOrThrow(value)))
 * ```
 * @category guards
 * @since 0.0.0
 */
export const validateRequiredMessage = (options: YeetRunOptions): Effect.Effect<O.Option<string>, YeetCommandError> => {
  const message = optionFromNonEmpty(options.message);
  if (
    options.plan ||
    options.mode !== "publish" ||
    O.isSome(message) ||
    (options.amend && options.noEdit) ||
    options.pushOnly
  ) {
    return Effect.succeed(message);
  }
  return Effect.fail(
    YeetCommandError.make({
      message: "yeet publish requires --message with a conventional commit message unless --plan is used.",
      exitCode: 1,
    })
  );
};

/**
 * Run commitlint against Yeet's generated commit-message artifact.
 *
 * @param context - Repo context that determines the artifact directory and
 * command working directory.
 * @param message - Conventional commit message text to validate.
 * @returns An Effect that completes after commitlint accepts the message.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { RepoRunContext, validateCommitMessage } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const checked = validateCommitMessage(context, "feat: ship yeet closeout").pipe(
 *   Effect.as("commit message accepted")
 * )
 * ```
 * @category guards
 * @since 0.0.0
 */
export const validateCommitMessage = Effect.fn("Yeet.validateCommitMessage")(function* (
  context: RepoRunContext,
  message: string
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const commitlint = yield* resolveLocalRepoBinary(context.repoRoot, "commitlint");
  const messagePath = yield* commitMessagePathForContext(context);
  yield* writeTextFile(messagePath, `${message}\n`);
  const result = yield* runRepoCommandCapture(commitlint, ["--edit", messagePath], context.repoRoot).pipe(
    Effect.mapError(YeetCommandError.new("Failed to run commitlint."))
  );
  if (result.exitCode !== 0) {
    return yield* YeetCommandError.make({
      message: `commit message failed commitlint:\n${result.output}`,
      command: `${commitlint} --edit ${messagePath}`,
      exitCode: result.exitCode,
    });
  }
});
