/**
 * Research internal Daily.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { formatCommandLine } from "@beep/repo-cli-kit/process/StepExec";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { adaptGitKitError } from "../../../internal/repo-run/GitExec.ts";
import { ResearchCommandError } from "../Research.errors.ts";
import {
  ResearchCognifyOptions,
  ResearchDailySummary,
  ResearchDigestOptions,
  ResearchHistorySiftOptions,
  ResearchNotionPullOptions,
} from "../Research.schemas.ts";
import { COGNEE_CREDENTIALS_MISSING, readCogneeSettings } from "./CogneeClient.ts";
import { cognifyImpl } from "./Cognify.ts";
import { digestImpl } from "./Digest.ts";
import { historySiftImpl } from "./HistorySift.ts";
import { notionPullImpl } from "./NotionPullRun.ts";
import { VAULT_DIRS } from "./Vault.ts";
import type { GitInvocation } from "@beep/git/GitCommand";
import type { GitKitError } from "../../../internal/repo-run/GitExec.ts";
import type { ResearchDailyOptions } from "../Research.schemas.ts";
import type { ResearchCommandServiceRequirements } from "../Research.service.ts";

const decodeResearchHistorySiftOptions = S.decodeEffect(ResearchHistorySiftOptions);

const decodeDailySummary = S.decodeUnknownEffect(ResearchDailySummary);

/**
 * Pathspecs that stage the vault without its machine-state directory, chosen
 * from the `git check-ignore -q <state dir>` exit code.
 *
 * A vault whose `.gitignore` already ignores the state directory must not name
 * it in an `:(exclude)` pathspec: git treats that as an ignored path named on
 * the command line and exits 1 ("The following paths are ignored by one of
 * your .gitignore files"), independent of `advice.addIgnoredFile`. When the
 * vault does not ignore it, the exclude pathspec is what keeps it out.
 *
 * @param checkIgnoreExit - Exit code of `git check-ignore -q <state dir>` in the vault.
 * @returns Pathspecs for `git add -A --`, or a typed failure for an unexpected exit code.
 */
const stagePathspecs = (checkIgnoreExit: number): Effect.Effect<ReadonlyArray<string>, ResearchCommandError> =>
  Match.value(checkIgnoreExit).pipe(
    Match.when(0, () => Effect.succeed(["."])),
    Match.when(1, () => Effect.succeed([".", `:(exclude)${VAULT_DIRS.state}/**`])),
    Match.orElse((exitCode) =>
      Effect.fail(
        ResearchCommandError.make({
          message: `git check-ignore -q ${VAULT_DIRS.state} exited with ${exitCode} in the vault.`,
        })
      )
    )
  );

/**
 * Commit changed vault files when the daily pipeline is configured to commit.
 *
 * **Details**
 *
 * The vault's machine-state directory (`.beep`) never enters the commit: when
 * the vault's `.gitignore` already ignores it a plain `git add -A` leaves it
 * out, and otherwise an `:(exclude)` pathspec does. The two cases are told
 * apart with `git check-ignore`, because naming an ignored path in the
 * exclude pathspec makes `git add` exit 1.
 *
 * The capture commit is made with `--no-gpg-sign`: the systemd user
 * unit has no desktop signing agent, so a globally configured SSH signer (for
 * example the 1Password helper) fails there with "failed to write commit
 * object", and a machine-generated capture of a private vault needs no
 * signature.
 *
 * **Example** (Commit vault git changes)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { commitVault } from "@beep/repo-cli/commands/Research/internal/Daily"
 *
 * // Stage and commit the research vault; provide `Git` to run it.
 * const program = commitVault("/repo/.research")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category processes
 * @since 0.0.0
 */
export const commitVault = Effect.fn("Research.commitVault")(function* (
  vaultRoot: string
): Effect.fn.Return<void, ResearchCommandError, Git> {
  const git = yield* Git;
  // A kit failure as the exit code git ran with; a git that never ran keeps the capture's wording.
  const exitCodeOf = <A>(
    invocation: GitInvocation,
    onExit: (exitCode: number) => Effect.Effect<A, ResearchCommandError>
  ) =>
    Effect.catch((error: GitKitError) =>
      adaptGitKitError<Effect.Effect<A, ResearchCommandError>>(error, invocation, {
        onSpawnFailure: (commandLine) =>
          flow(ResearchCommandError.new(`Failed running ${commandLine} in the vault.`), Effect.fail),
        onNonZeroExit: ({ exitCode }) => onExit(exitCode),
        onTruncated: O.none(),
      })
    );
  const exitedWith = (invocation: GitInvocation) => (exitCode: number) =>
    Effect.fail(
      ResearchCommandError.make({
        message: `${formatCommandLine("git", invocation.redactedArgs)} exited with ${exitCode} in the vault.`,
      })
    );
  const stateDir = [VAULT_DIRS.state];
  // `check-ignore` lists the state directory when the vault ignores it: exit 0, as `-q` answered; empty is exit 1.
  const pathspecs = yield* git.checkIgnore(vaultRoot, stateDir).pipe(
    Effect.map((ignored) => (A.isReadonlyArrayNonEmpty(ignored) ? 0 : 1)),
    exitCodeOf(GitCommand.checkIgnore(stateDir), Effect.succeed),
    Effect.flatMap(stagePathspecs)
  );
  // git 2.x stages removals under a pathspec, so `add -- <pathspecs>` is `add -A -- <pathspecs>`.
  const add = GitCommand.add(pathspecs);
  yield* git.add(vaultRoot, pathspecs).pipe(exitCodeOf(add, exitedWith(add)));
  const staged = yield* git.stagedChanges(vaultRoot).pipe(
    Effect.catch((error) =>
      adaptGitKitError<Effect.Effect<ReadonlyArray<string>, ResearchCommandError>>(error, GitCommand.stagedChanges(), {
        onSpawnFailure: () => flow(ResearchCommandError.new("Failed checking vault staging state."), Effect.fail),
        onNonZeroExit: ({ exitCode }) =>
          Effect.fail(
            ResearchCommandError.make({ message: `git diff --cached --quiet exited with ${exitCode} in the vault.` })
          ),
        onTruncated: O.none(),
      })
    )
  );
  if (A.isReadonlyArrayEmpty(staged)) {
    yield* Console.log("research daily: vault clean, nothing to commit.");
    return;
  }
  const date = (yield* DateTime.now).pipe(DateTime.formatIso, Str.slice(0, 10));
  const message = `capture ${date}`;
  // `--no-gpg-sign` overrides `commit.gpgSign`, as `-c commit.gpgsign=false` did.
  const commit = GitCommand.commit(message, false, false, false, undefined, false, false, true);
  yield* git.commit(vaultRoot, message, { noGpgSign: true }).pipe(exitCodeOf(commit, exitedWith(commit)));
  yield* Console.log(`research daily: committed vault as "${message}".`);
});

/**
 * Run the daily research pipeline steps in order.
 *
 * **Details**
 *
 * Cognify runs only when Cognee credentials are configured; otherwise the step
 * is reported as skipped with the EnvironmentFile that should carry them, so
 * an unconfigured machine does not log a failed login every night.
 *
 * **Example** (Daily pipeline with options)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect";
 * import { dailyImpl } from "@beep/repo-cli/commands/Research/internal/Daily"
 * import { ResearchDailyOptions } from "@beep/repo-cli/commands/Research"
 *
 * const program = dailyImpl(
 *   ResearchDailyOptions.make({
 *     browser: "all",
 *     commit: false,
 *     sinceDays: S.Natural.make(7),
 *     vaultRoot: "/repo/.research"
 *   })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const dailyImpl = Effect.fn("Research.dailyImpl")(function* (
  options: ResearchDailyOptions
): Effect.fn.Return<ResearchDailySummary, ResearchCommandError, ResearchCommandServiceRequirements | Git> {
  const ran: Array<string> = [];
  const skipped: Array<string> = [];
  const failed: Array<string> = [];

  const step: (
    name: string,
    work: Effect.Effect<unknown, ResearchCommandError, ResearchCommandServiceRequirements>
  ) => Effect.Effect<void, never, ResearchCommandServiceRequirements> = Effect.fnUntraced(function* (name, work) {
    const result = yield* Effect.result(work);
    if (Result.isFailure(result)) {
      failed.push(name);
      yield* Console.log(`research daily: step "${name}" failed: ${result.failure.message}`);
    } else {
      ran.push(name);
    }
  });

  const pipe1 = yield* decodeResearchHistorySiftOptions({
    browser: options.browser,
    sinceDays: options.sinceDays,
    vaultRoot: options.vaultRoot,
  }).pipe(ResearchCommandError.mapError("Invalid daily history-sift options."));
  yield* step("history-sift", historySiftImpl(pipe1));

  if (options.notionPage === undefined) {
    skipped.push("notion-pull (no --page)");
  } else {
    yield* step(
      "notion-pull",
      notionPullImpl(
        ResearchNotionPullOptions.make({
          database: "Awesome X Posts",
          pageId: options.notionPage,
          vaultRoot: options.vaultRoot,
        })
      )
    );
  }

  // Unset credentials skip cognify; present-but-invalid ones are a failed step,
  // never an aborted pipeline.
  yield* readCogneeSettings.pipe(
    Effect.result,
    Effect.flatMap(
      Result.match({
        onFailure: (error) => step("cognify", Effect.fail(error)),
        onSuccess: O.match({
          onNone: () =>
            Effect.sync(() => {
              skipped.push(`cognify (${COGNEE_CREDENTIALS_MISSING})`);
            }),
          onSome: () =>
            step("cognify", cognifyImpl(ResearchCognifyOptions.make({ dryRun: false, vaultRoot: options.vaultRoot }))),
        }),
      })
    )
  );

  yield* step("digest", digestImpl(ResearchDigestOptions.make({ vaultRoot: options.vaultRoot })));

  if (options.commit) {
    yield* step("commit", commitVault(options.vaultRoot));
  }

  yield* Console.log(
    `research daily: ran=[${A.join(ran, ", ")}] skipped=[${A.join(skipped, ", ")}] failed=[${A.join(failed, ", ")}]`
  );
  return yield* decodeDailySummary({ failed, ran, skipped }).pipe(
    ResearchCommandError.mapError("Daily summary failed schema validation.")
  );
});
