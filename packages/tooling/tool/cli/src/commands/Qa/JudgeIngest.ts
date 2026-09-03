/**
 * The `beep qa judge-ingest` writer.
 *
 * The judge emits JSON and nothing else; the CLI is the single writer of
 * `inventory.json` and `inventory.md`. Ingest is where an inventory earns the
 * right to exist: it must parse as the last fenced JSON block, decode as
 * `qa-inventory/v1` (which already forces `requiredCount` to agree with the
 * findings), and survive the round cross-check.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { SessionStore } from "@beep/qa-capture";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { A } from "@beep/utils";
import { Effect, FileSystem, Path } from "effect";
import { dual } from "effect/Function";
import { printLines } from "../../internal/cli/Printer.ts";
import { encodeQaInventory } from "./Inventory.schemas.ts";
import { crossCheckAgainstRound, extractLastJsonBlock, raiseCrossCheckFailure } from "./JudgeCheck.ts";
import {
  DeclaredRoundCoherentInput,
  DeclaredRoundCoherentVerdict,
  evaluateDeclaredRoundCoherent,
  evaluateJudgeOutputInventoryDecodes,
  JudgeOutputDecodeFailure,
  JudgeOutputInventoryDecodesInput,
  JudgeOutputInventoryDecodesVerdict,
} from "./JudgeContract.ts";
import { QaCommandError } from "./Qa.errors.ts";
import { renderInventoryMarkdown } from "./Qa.render.ts";
import { qaRootPath, readEventLog } from "./Qa.session.ts";
import type { RoundLayout } from "@beep/qa-capture";
import type { QaInventory } from "./Inventory.schemas.ts";
import type { QaJudgeIngestOptions } from "./Qa.schemas.ts";

/**
 * File name of the schema-validated inventory inside a round.
 *
 * **Example** (Log inventory JSON filename)
 *
 * ```ts
 * import { INVENTORY_JSON_FILE } from "@beep/repo-cli/commands/Qa/JudgeIngest"
 *
 * console.log(INVENTORY_JSON_FILE) // "inventory.json"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const INVENTORY_JSON_FILE = "inventory.json";

/**
 * File name of the rendered inventory inside a round.
 *
 * **Example** (Log inventory markdown filename)
 *
 * ```ts
 * import { INVENTORY_MARKDOWN_FILE } from "@beep/repo-cli/commands/Qa/JudgeIngest"
 *
 * console.log(INVENTORY_MARKDOWN_FILE) // "inventory.md"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const INVENTORY_MARKDOWN_FILE = "inventory.md";

/**
 * Absolute path of a round's `inventory.json`.
 *
 * **Example** (Resolve inventory JSON path)
 *
 * ```ts
 * import { RoundLayout } from "@beep/qa-capture"
 * import { inventoryJsonPath } from "@beep/repo-cli/commands/Qa/JudgeIngest"
 * import { Effect, Path } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const path = yield* Path.Path
 *   const layout = RoundLayout.make({
 *     clipsDir: "/repo/.beep/qa/round-1/clips",
 *     eventsPath: "/repo/.beep/qa/round-1/events.ndjson",
 *     framesDir: "/repo/.beep/qa/round-1/frames",
 *     reportPath: "/repo/.beep/qa/round-1/report.md",
 *     root: "/repo/.beep/qa/round-1",
 *     round: 1,
 *     sessionPath: "/repo/.beep/qa/round-1/session.json",
 *     sheetsDir: "/repo/.beep/qa/round-1/sheets",
 *     videoDir: "/repo/.beep/qa/round-1/video"
 *   })
 *   return inventoryJsonPath(path, layout)
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const inventoryJsonPath: {
  (layout: RoundLayout): (path: Path.Path) => string;
  (path: Path.Path, layout: RoundLayout): string;
} = dual(2, (path: Path.Path, layout: RoundLayout): string => path.join(layout.root, INVENTORY_JSON_FILE));

/**
 * Parse noisy judge output into a schema-valid inventory.
 *
 * **Example** (Parse non-JSON judge output)
 *
 * ```ts
 * import { parseJudgeOutput } from "@beep/repo-cli/commands/Qa/JudgeIngest"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(parseJudgeOutput("no json here"))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const parseJudgeOutput = Effect.fn("QaJudgeIngest.parseJudgeOutput")(function* (
  text: string
): Effect.fn.Return<QaInventory, QaCommandError> {
  const block = yield* Effect.fromOption(extractLastJsonBlock(text), () =>
    QaCommandError.make({
      message: "qa judge-ingest found no parseable JSON inventory object (fenced or unfenced) in the judge output.",
    })
  );
  const verdict = yield* evaluateJudgeOutputInventoryDecodes(
    JudgeOutputInventoryDecodesInput.make({ candidate: block })
  );
  return yield* JudgeOutputInventoryDecodesVerdict.match(verdict, {
    allowed: ({ audit }) => Effect.succeed(audit.detail.inventory),
    denied: ({ audit }) =>
      Effect.fail(
        QaCommandError.make({
          cause: audit.detail.issue,
          message: JudgeOutputDecodeFailure.$match(audit.detail.failure, {
            "inventory-schema-rejected": () =>
              "qa judge-ingest rejected the judge inventory. Check schemaVersion, finding ids (R<round>-<nn>), lens values, and that requiredCount equals the P0+P1 count.",
            "malformed-json": () => "qa judge-ingest could not parse the judge's final JSON block.",
          }),
        })
      ),
  });
});

/**
 * Ingest a judge transcript into a round's `inventory.json` and `inventory.md`.
 *
 * **Example** (Ingest judge transcript effect)
 *
 * ```ts
 * import { runQaJudgeIngest } from "@beep/repo-cli/commands/Qa/JudgeIngest"
 * import { QaJudgeIngestOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import { Effect } from "effect"
 *
 * const options = QaJudgeIngestOptions.make({ from: "judge-stdout.txt", round: 3 })
 * console.log(Effect.isEffect(runQaJudgeIngest("/repo", options))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runQaJudgeIngest = Effect.fn("QaJudgeIngest.run")(function* (
  cwd: string,
  options: QaJudgeIngestOptions
  // Every `beep qa` subcommand opens with the same service acquisition and
  // round-layout read; only the error wording each command owns differs.
  // fallow-ignore-next-line code-duplication -- every beep qa subcommand shares this service-acquisition and round-layout prologue; only the error wording differs
): Effect.fn.Return<QaInventory, QaCommandError, FileSystem.FileSystem | Path.Path | SessionStore> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const store = yield* SessionStore;

  const layout = store.roundLayout(qaRootPath(path, cwd), options.round);
  const raw = yield* fs
    .readFileString(path.resolve(options.from))
    .pipe(QaCommandError.mapError(`qa judge-ingest could not read the judge output at ${options.from}.`));
  const inventory = yield* parseJudgeOutput(raw);

  const roundVerdict = yield* evaluateDeclaredRoundCoherent(
    DeclaredRoundCoherentInput.make({ declaredRound: inventory.round, requestedRound: options.round })
  );
  yield* DeclaredRoundCoherentVerdict.match(roundVerdict, {
    allowed: () => Effect.void,
    denied: ({ audit }) =>
      Effect.fail(
        QaCommandError.make({
          message: `qa judge-ingest was asked for round ${audit.detail.requestedRound} but the inventory declares round ${audit.detail.declaredRound}.`,
        })
      ),
  });

  const eventLog = yield* readEventLog(layout.eventsPath);
  const check = yield* crossCheckAgainstRound(layout, inventory, eventLog);
  yield* raiseCrossCheckFailure(options.round, check);

  const encoded = yield* encodeQaInventory(inventory).pipe(
    QaCommandError.mapError("qa judge-ingest could not encode the inventory.")
  );
  const json = yield* UnknownFromJsonString.encodeEffect(encoded).pipe(
    QaCommandError.mapError("qa judge-ingest could not serialize the inventory.")
  );

  yield* Effect.all(
    [
      fs.writeFileString(inventoryJsonPath(path, layout), json),
      fs.writeFileString(path.join(layout.root, INVENTORY_MARKDOWN_FILE), renderInventoryMarkdown(inventory)),
    ],
    { concurrency: 2, discard: true }
  ).pipe(QaCommandError.mapError(`qa judge-ingest could not write into ${layout.root}.`));

  yield* printLines([
    `qa judge-ingest: round ${options.round}`,
    `  findings: ${A.length(inventory.findings)}`,
    `  inventory: ${inventoryJsonPath(path, layout)}`,
    `REQUIRED FINDINGS: ${inventory.requiredCount}`,
  ]);

  return inventory;
});
