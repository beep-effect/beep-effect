/**
 * Research internal Daily.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Console, DateTime, Effect, Match, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runToExit } from "../../../internal/process/StepExec.ts";
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
import type { ChildProcessSpawner } from "effect/unstable/process";
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
 * **Example** (Commit vault git changes)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { commitVault } from "@beep/repo-cli/commands/Research/internal/Daily"
 *
 * // Stage and commit the research vault; provide the process spawner to run it.
 * const program = commitVault("/repo/.research")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category processes
 * @since 0.0.0
 */
export const commitVault = Effect.fn("Research.commitVault")(function* (
  vaultRoot: string
): Effect.fn.Return<void, ResearchCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const git = (args: ReadonlyArray<string>) =>
    runToExit({
      command: "git",
      args,
      cwd: vaultRoot,
      stdio: "ignore",
    }).pipe(ResearchCommandError.mapError(`Failed running git ${A.join(args, " ")} in the vault.`));
  const run = (args: ReadonlyArray<string>) =>
    git(args).pipe(
      Effect.filterOrFail(
        (exitCode) => exitCode === 0,
        (exitCode) =>
          ResearchCommandError.make({ message: `git ${A.join(args, " ")} exited with ${exitCode} in the vault.` })
      )
    );
  const pathspecs = yield* git(["check-ignore", "-q", VAULT_DIRS.state]).pipe(Effect.flatMap(stagePathspecs));
  yield* run(["add", "-A", "--", ...pathspecs]);
  const status = yield* runToExit({
    command: "git",
    args: ["diff", "--cached", "--quiet"],
    cwd: vaultRoot,
    stdio: "ignore",
  }).pipe(ResearchCommandError.mapError("Failed checking vault staging state."));
  if (status === 0) {
    yield* Console.log("research daily: vault clean, nothing to commit.");
    return;
  }
  if (status !== 1) {
    return yield* ResearchCommandError.make({
      message: `git diff --cached --quiet exited with ${status} in the vault.`,
    });
  }
  const date = Str.slice(0, 10)(DateTime.formatIso(yield* DateTime.now));
  yield* run(["commit", "-q", "-m", `capture ${date}`]);
  yield* Console.log(`research daily: committed vault as "capture ${date}".`);
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
 * import { Effect } from "effect"
 * import { dailyImpl } from "@beep/repo-cli/commands/Research/internal/Daily"
 * import { ResearchDailyOptions } from "@beep/repo-cli/commands/Research"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const program = dailyImpl(
 *   ResearchDailyOptions.make({
 *     browser: "all",
 *     commit: false,
 *     sinceDays: NonNegativeInt.make(7),
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
): Effect.fn.Return<ResearchDailySummary, ResearchCommandError, ResearchCommandServiceRequirements> {
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

  yield* step(
    "history-sift",
    historySiftImpl(
      yield* decodeResearchHistorySiftOptions({
        browser: options.browser,
        sinceDays: options.sinceDays,
        vaultRoot: options.vaultRoot,
      }).pipe(ResearchCommandError.mapError("Invalid daily history-sift options."))
    )
  );

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
