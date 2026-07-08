/**
 * Research internal Daily.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Config, Console, DateTime, Effect, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcess } from "effect/unstable/process";
import { ResearchCommandError } from "../Research.errors.js";
import {
  ResearchCognifyOptions,
  ResearchDailySummary,
  ResearchDigestOptions,
  ResearchHistorySiftOptions,
  ResearchNotionPullOptions,
} from "../Research.schemas.js";
import { cognifyImpl } from "./Cognify.js";
import { digestImpl } from "./Digest.js";
import { historySiftImpl } from "./HistorySift.js";
import { notionPullImpl } from "./NotionPullRun.js";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { ResearchDailyOptions } from "../Research.schemas.js";
import type { ResearchCommandServiceRequirements } from "../Research.service.js";

const decodeDailySummary = S.decodeUnknownEffect(ResearchDailySummary);

/**
 * Commit changed vault files when the daily pipeline is configured to commit.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { commitVault } from "@beep/repo-cli/commands/Research/internal/Daily"
 *
 * // Stage and commit the research vault; provide the process spawner to run it.
 * const program = commitVault("/repo/.research")
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category processes
 * @since 0.0.0
 */
export const commitVault = Effect.fn("Research.commitVault")(function* (
  vaultRoot: string
): Effect.fn.Return<void, ResearchCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const run = (args: ReadonlyArray<string>) =>
    Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* ChildProcess.make("git", [...args], { cwd: vaultRoot, stderr: "pipe", stdout: "pipe" });
        return yield* handle.exitCode;
      })
    ).pipe(
      ResearchCommandError.mapError(`Failed running git ${A.join(args, " ")} in the vault.`),
      Effect.filterOrFail(
        (exitCode) => exitCode === 0,
        (exitCode) =>
          ResearchCommandError.make({ message: `git ${A.join(args, " ")} exited with ${exitCode} in the vault.` })
      )
    );
  yield* run(["add", "-A"]);
  const status = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("git", ["diff", "--cached", "--quiet"], {
        cwd: vaultRoot,
        stderr: "pipe",
        stdout: "pipe",
      });
      return yield* handle.exitCode;
    })
  ).pipe(ResearchCommandError.mapError("Failed checking vault staging state."));
  if (status === 0) {
    yield* Console.log("research daily: vault clean, nothing to commit.");
    return;
  }
  const date = Str.slice(0, 10)(DateTime.formatIso(yield* DateTime.now));
  yield* run(["commit", "-q", "-m", `capture ${date}`]);
  yield* Console.log(`research daily: committed vault as "capture ${date}".`);
});

/**
 * Run the daily research pipeline steps in order.
 *
 * @example
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
      yield* S.decodeUnknownEffect(ResearchHistorySiftOptions)({
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

  const cogneeUrl = yield* Effect.orDie(Config.string("COGNEE_API_URL").pipe(Config.option));
  if (O.isNone(cogneeUrl)) {
    skipped.push("cognify (COGNEE_API_URL unset)");
  } else {
    yield* step("cognify", cognifyImpl(ResearchCognifyOptions.make({ dryRun: false, vaultRoot: options.vaultRoot })));
  }

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
