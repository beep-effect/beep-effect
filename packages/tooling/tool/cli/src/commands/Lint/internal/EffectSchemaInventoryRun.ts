/**
 * Write, check, and prompt orchestration for `beep lint effect-schema-inventory`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { Console, Effect } from "effect";
import * as O from "effect/Option";
import { EffectSchemaInventoryCheckReport, EffectSchemaInventoryRequest } from "../EffectSchemaInventory.schemas.ts";
import { EffectSchemaInventoryDriftError, EffectSchemaInventoryError } from "../Lint.errors.ts";
import { extractEffectSchemaInventory } from "./EffectSchemaInventoryExtract.ts";
import { EffectSchemaInventoryModules } from "./EffectSchemaInventoryModules.ts";
import { generateEffectSchemaInventoryPrompt } from "./EffectSchemaInventoryPrompt.ts";
import {
  diffEffectSchemaInventoryFiles,
  formatEffectSchemaInventoryDrift,
  renderEffectSchemaInventory,
} from "./EffectSchemaInventoryRender.ts";
import { EffectSchemaInventorySource } from "./EffectSchemaInventorySource.ts";
import { readEffectSchemaInventoryFixture, writeEffectSchemaInventoryFixture } from "./EffectSchemaInventoryStore.ts";
import type { EffectSchemaInventoryReceipt } from "../EffectSchemaInventory.schemas.ts";

const LOG_PREFIX = "[effect-schema-inventory]";

const describeReceipt = (receipt: EffectSchemaInventoryReceipt): string =>
  `pin=${receipt.pin} parser=${receipt.parser} modules=${receipt.modules} rows=${receipt.rows} bytes=${receipt.bytes} internal=${receipt.internalRows} deprecated=${receipt.deprecatedRows} bareStarDeclarationsOmitted=${receipt.bareStarDeclarationsOmitted} digest=${receipt.digest}`;

/**
 * Map the command flags to one request, rejecting ambiguous combinations.
 *
 * **Details**
 *
 * `--write`, `--check`, and `--prompt` are mutually exclusive; none of them means `--check`.
 * `--out` is accepted only with `--prompt`.
 *
 * **Example** (Default to check)
 *
 * ```ts
 * import { effectSchemaInventoryRequestFromFlags } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const request = effectSchemaInventoryRequestFromFlags({ write: false, check: false, prompt: O.none(), out: O.none() })
 * Effect.runPromise(request).then(({ _tag }) => console.log(_tag)) // "check"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const effectSchemaInventoryRequestFromFlags = Effect.fn("EffectSchemaInventoryRun.requestFromFlags")(
  function* (flags: {
    readonly write: boolean;
    readonly check: boolean;
    readonly prompt: O.Option<string>;
    readonly out: O.Option<string>;
  }) {
    const modes = A.filter([flags.write, flags.check, O.isSome(flags.prompt)], (selected) => selected).length;
    if (modes > 1)
      return yield* EffectSchemaInventoryError.new("Choose one of --write, --check, or --prompt <module>.");
    if (O.isSome(flags.out) && O.isNone(flags.prompt))
      return yield* EffectSchemaInventoryError.new("--out applies only to --prompt <module>.");
    if (O.isSome(flags.prompt))
      return EffectSchemaInventoryRequest.cases.prompt.make({ module: flags.prompt.value, out: flags.out });
    return flags.write
      ? EffectSchemaInventoryRequest.cases.write.make({})
      : EffectSchemaInventoryRequest.cases.check.make({});
  }
);

/**
 * Regenerate the whole fixture in memory from `.repos/effect` at the catalog pin.
 *
 * **Details**
 *
 * Reads the pin from the root `package.json` catalog, fails loud unless the reference clone
 * exists and contains that commit, and reads every source byte with `git show <pin>:<file>`.
 * The reference HEAD is never compared with the pin, so a HEAD that moved past it is fine.
 *
 * **Example** (Build a generation)
 *
 * ```ts
 * import { generateEffectSchemaInventory } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(generateEffectSchemaInventory())) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const generateEffectSchemaInventory = Effect.fn("EffectSchemaInventoryRun.generate")(function* () {
  const source = yield* EffectSchemaInventorySource;
  const pin = yield* source.readPin;
  yield* source.verifyPin(pin);
  const sources = yield* Effect.forEach(
    EffectSchemaInventoryModules,
    (module) => Effect.map(source.readPinned(pin, module.file), (text) => [module, text] as const),
    { concurrency: 4 }
  );
  const extraction = yield* extractEffectSchemaInventory(pin, sources);
  return yield* renderEffectSchemaInventory(pin, extraction);
});

/**
 * Compare a fresh in-memory generation with the committed fixture without writing anything.
 *
 * **Example** (Build a check)
 *
 * ```ts
 * import { checkEffectSchemaInventory } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(checkEffectSchemaInventory(process.cwd()))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const checkEffectSchemaInventory = Effect.fn("EffectSchemaInventoryRun.check")(function* (root: string) {
  const rendered = yield* generateEffectSchemaInventory();
  const committed = yield* readEffectSchemaInventoryFixture(root);
  return EffectSchemaInventoryCheckReport.make({
    receipt: rendered.receipt,
    drift: diffEffectSchemaInventoryFiles(rendered.files, committed),
  });
});

/**
 * Print a check report: one success line, or every drift line followed by a typed failure.
 *
 * **Example** (Report a current fixture)
 *
 * ```ts
 * import { EffectSchemaInventoryCheckReport, EffectSchemaInventoryReceipt, reportEffectSchemaInventoryCheck } from "@beep/repo-cli/commands/Lint"
 * import { Sha256Hex } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const receipt = EffectSchemaInventoryReceipt.make({
 *   pin: "df77fff9396fe31de72d1947ecb5b74f8cee89e1",
 *   parser: "6.0.2",
 *   digest: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   modules: 0, rows: 0, bytes: 0, internalRows: 0, deprecatedRows: 0, bareStarDeclarationsOmitted: 0
 * })
 * Effect.runPromise(reportEffectSchemaInventoryCheck(EffectSchemaInventoryCheckReport.make({ receipt, drift: [] })))
 * // logs "[effect-schema-inventory] fixture is byte-identical; pin=df77fff9396fe31de72d1947ecb5b74f8cee89e1 ..."
 * ```
 *
 * @param report - Receipt and drift from {@link checkEffectSchemaInventory}.
 * @returns An effect that logs the outcome and fails with the drift when any exists.
 * @category use-cases
 * @since 0.0.0
 */
export const reportEffectSchemaInventoryCheck = (
  report: EffectSchemaInventoryCheckReport
): Effect.Effect<void, EffectSchemaInventoryDriftError> =>
  A.match(report.drift, {
    onEmpty: () => Console.log(`${LOG_PREFIX} fixture is byte-identical; ${describeReceipt(report.receipt)}`),
    onNonEmpty: (drift) =>
      Effect.forEach(drift, (entry) => Console.error(formatEffectSchemaInventoryDrift(entry)), { discard: true }).pipe(
        Effect.andThen(
          Effect.fail(
            EffectSchemaInventoryDriftError.make({
              message: `${drift.length} inventory fixture file(s) drift from inventoryPin ${report.receipt.pin}; regenerate with lint effect-schema-inventory --write and review the diff.`,
              drift,
            })
          )
        )
      ),
  });

/**
 * Run one command request: write the fixture, check it, or write a lane prompt.
 *
 * **Details**
 *
 * `check` prints every drift line and fails with {@link EffectSchemaInventoryDriftError} when
 * any file is missing, stale, or unexpected.
 *
 * **Example** (Build a check run)
 *
 * ```ts
 * import { EffectSchemaInventoryRequest, runEffectSchemaInventory } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 *
 * const request = EffectSchemaInventoryRequest.cases.check.make({})
 * console.log(Effect.isEffect(runEffectSchemaInventory(process.cwd(), request))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runEffectSchemaInventory = Effect.fn("EffectSchemaInventoryRun.run")(function* (
  root: string,
  request: EffectSchemaInventoryRequest
) {
  return yield* EffectSchemaInventoryRequest.match(request, {
    write: Effect.fnUntraced(function* () {
      const rendered = yield* generateEffectSchemaInventory();
      yield* writeEffectSchemaInventoryFixture(root, rendered);
      yield* Console.log(`${LOG_PREFIX} wrote ${rendered.files.length} files; ${describeReceipt(rendered.receipt)}`);
    }),
    check: () => Effect.flatMap(checkEffectSchemaInventory(root), reportEffectSchemaInventoryCheck),
    prompt: Effect.fnUntraced(function* ({ module, out }) {
      const receipt = yield* generateEffectSchemaInventoryPrompt(root, module, out);
      yield* Console.log(
        `${LOG_PREFIX} wrote ${receipt.target} for ${receipt.module} (${receipt.rows} rows; graft ${receipt.graftAvailable ? "available" : "unavailable"})`
      );
    }),
  });
});
