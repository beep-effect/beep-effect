/**
 * The `beep qa judge-lint` re-validation.
 *
 * Ingest validates once, at write time. Lint re-runs the same schema decode and
 * round cross-check against the file that is actually committed, which is what
 * catches an inventory edited by hand, carried into a goal packet, or left
 * behind after its evidence was pruned.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { SessionStore } from "@beep/qa-capture";
import { Unknown } from "@beep/schema/Unknown";
import { A } from "@beep/utils";
import { Effect, FileSystem, Path } from "effect";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { printLines } from "../../internal/cli/Printer.ts";
import { decodeQaInventory } from "./Inventory.schemas.ts";
import {
  crossCheckAgainstRound,
  isCrossCheckClean,
  renderCrossCheckFailure,
  requireInventoryRound,
} from "./JudgeCheck.ts";
import { inventoryJsonPath } from "./JudgeIngest.ts";
import { QaCommandError } from "./Qa.errors.ts";
import { qaRootPath, readEventLog } from "./Qa.session.ts";
import type { CliReportedExit } from "../../internal/cli/ExitCodeError.ts";
import type { QaJudgeLintOptions } from "./Qa.schemas.ts";

/**
 * Re-validate a round's committed inventory against its evidence.
 *
 * **Example** (Lint inventory for round)
 *
 * ```ts
 * import { runQaJudgeLint } from "@beep/repo-cli/commands/Qa/JudgeLint"
 * import { QaJudgeLintOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import { Effect } from "effect"
 *
 * const program = runQaJudgeLint("/repo", QaJudgeLintOptions.make({ round: 3 }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runQaJudgeLint = Effect.fn("QaJudgeLint.run")(function* (
  cwd: string,
  options: QaJudgeLintOptions
): Effect.fn.Return<void, CliReportedExit | QaCommandError, FileSystem.FileSystem | Path.Path | SessionStore> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const store = yield* SessionStore;

  const layout = store.roundLayout(qaRootPath(path, cwd), options.round);
  const inventoryPath = inventoryJsonPath(path, layout);
  const raw = yield* fs
    .readFileString(inventoryPath)
    .pipe(
      QaCommandError.mapError(
        `qa judge-lint could not read ${inventoryPath}; run \`bun run beep qa judge-ingest --round ${options.round} --from <file>\` first.`
      )
    );
  const parsed = yield* Unknown.decodeEffectFromJsonString(raw).pipe(
    QaCommandError.mapError(`qa judge-lint could not parse ${inventoryPath} as JSON.`)
  );
  const inventory = yield* decodeQaInventory(parsed).pipe(
    QaCommandError.mapError(`qa judge-lint rejected ${inventoryPath} against the qa-inventory/v1 schema.`)
  );
  // A copied inventory can pass another round's cross-check (seqs restart per
  // round, frame names repeat), so round coherence is checked explicitly.
  yield* requireInventoryRound(options.round, inventory);

  const eventLog = yield* readEventLog(layout.eventsPath);
  const check = yield* crossCheckAgainstRound(layout, inventory, eventLog);

  yield* printLines([
    `qa judge-lint: round ${options.round}`,
    `  findings: ${A.length(inventory.findings)} (required ${inventory.requiredCount})`,
    `  inventory: ${inventoryPath}`,
  ]);

  if (!isCrossCheckClean(check)) {
    yield* printLines([renderCrossCheckFailure(options.round, check)]);
    return yield* failWithReportedExit(`qa judge-lint: round ${options.round} inventory is not backed by evidence`, 1);
  }

  yield* printLines(["  cross-check: ok"]);
});
