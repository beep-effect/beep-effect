/**
 * Type-directed schema-parity codemod command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect } from "effect";
import { Command, Flag } from "effect/cli";
import { SchemaParityCodemodOptions, SchemaParityCodemodRuleId } from "./internal/SchemaParityCodemod.schemas.ts";
import { SchemaParityCodemod, SchemaParityCodemodLive } from "./internal/SchemaParityCodemodEngine.ts";
import { SchemaParityCodemodError } from "./Lint.errors.ts";

/**
 * Dry-run or apply a registered schema-parity codemod rule.
 *
 * **Details**
 *
 * `--rule` selects registered rules (repeatable). `--path` narrows the scan to
 * repo-relative roots (repeatable; default `packages` and `apps`). Without
 * `--write` the run only reports rewritten sites, residue and quarantined
 * files. With `--write` it writes the planned files and runs biome's formatter
 * and import organizer over them unless `--skip-format` is set.
 *
 * **Example** (Build the codemod command runner)
 *
 * ```ts
 * import { lintSchemaParityCodemodCommand } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect"
 * import { Command } from "effect/cli"
 *
 * const run = Command.run(lintSchemaParityCodemodCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const lintSchemaParityCodemodCommand = Command.make(
  "schema-parity-codemod",
  {
    rule: Flag.Literals("rule", SchemaParityCodemodRuleId.literals).pipe(
      Flag.atLeast(1),
      Flag.withDescription("Registered codemod rule to run; repeat for several")
    ),
    path: Flag.String("path").pipe(
      Flag.atLeast(0),
      Flag.withDescription("Repo-relative root to scan; repeat for several (default: packages and apps)")
    ),
    write: Flag.Boolean("write").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Write the planned rewrites (default: dry run)")
    ),
    skipFormat: Flag.Boolean("skip-format").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Skip the biome format and import-organize pass over written files")
    ),
    tsconfig: Flag.String("tsconfig").pipe(
      Flag.withDefault("tsconfig.json"),
      Flag.withDescription("Repo-relative tsconfig whose compiler options drive type resolution")
    ),
    report: Flag.String("report").pipe(
      Flag.optional,
      Flag.withDescription("Write the run report as JSONC to this repo-relative path")
    ),
  },
  Effect.fn("SchemaParityCodemod.command")(function* ({ path, report, rule, skipFormat, tsconfig, write }) {
    if (!A.isReadonlyArrayNonEmpty(rule)) {
      return yield* SchemaParityCodemodError.new("Pass at least one --rule.");
    }
    const codemod = yield* SchemaParityCodemod;
    yield* codemod.run(
      SchemaParityCodemodOptions.make({
        rules: rule,
        write,
        tsconfig,
        format: !skipFormat,
        ...O.getSomesStruct({ report, paths: O.liftPredicate(path, A.isReadonlyArrayNonEmpty) }),
      })
    );
  })
).pipe(
  Command.withDescription("Type-directed codemod that rewrites consumers of retired schema-parity surfaces"),
  Command.provide(SchemaParityCodemodLive)
);
