/**
 * `beep schema-idioms` command group: `index` regenerates or checks the
 * committed effect/Schema index, `lookup` prints one slice of it, and `hint`
 * prints the advisory name-tell hints of a file.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { failWithPrintedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { printLines } from "@beep/repo-cli-kit/cli/Printer";
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { SchemaIdiomsLookupTopic } from "./SchemaIdioms.model.ts";
import { SCHEMA_INDEX_DIRECTORY } from "./SchemaIdioms.render.ts";
import {
  diffSchemaIndexFiles,
  generateSchemaIndexFiles,
  hintSchemaIdiomsFile,
  readSchemaIndexSlice,
  writeSchemaIndexFiles,
} from "./SchemaIdioms.ts";
import type { SchemaIndexDrift, SchemaIndexFile } from "./SchemaIdioms.model.ts";

const driftLine = (drift: SchemaIndexDrift): string => `${drift.change}: ${SCHEMA_INDEX_DIRECTORY}/${drift.file}`;

const summaryLines = (files: ReadonlyArray<SchemaIndexFile>): ReadonlyArray<string> =>
  A.map(
    A.filter(files, (file) => file.file !== "README.md"),
    (file) => `${file.file}: ${file.entries} entries`
  );

const schemaIdiomsIndexCommand = Command.make(
  "index",
  {
    write: Flag.Boolean("write").pipe(
      Flag.withDefault(false),
      Flag.withDescription(`Regenerate ${SCHEMA_INDEX_DIRECTORY}`)
    ),
    check: Flag.Boolean("check").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Exit non-zero when the committed index differs from the installed effect")
    ),
  },
  Effect.fn(function* ({ write, check }) {
    if (write && check) {
      return yield* failWithPrintedExit("beep schema-idioms index: pass --write or --check, not both.");
    }
    const repoRoot = yield* findRepoRoot();
    const files = yield* generateSchemaIndexFiles(repoRoot);
    if (write) {
      const repaired = yield* writeSchemaIndexFiles(repoRoot, files);
      return yield* printLines(
        A.isReadonlyArrayNonEmpty(repaired)
          ? [...A.map(repaired, driftLine), `schema-idioms index: wrote ${A.length(repaired)} file(s).`]
          : ["schema-idioms index: already current."]
      );
    }
    if (check) {
      const drift = yield* diffSchemaIndexFiles(repoRoot, files);
      if (A.isReadonlyArrayNonEmpty(drift)) {
        yield* printLines(A.map(drift, driftLine));
        return yield* failWithPrintedExit(
          "beep schema-idioms index --check: the committed index differs from the installed effect; run bun run beep schema-idioms index --write"
        );
      }
      return yield* printLines(["schema-idioms index: current."]);
    }
    return yield* printLines(summaryLines(files));
  })
).pipe(
  Command.withDescription(
    "Summarise, regenerate (--write) or check (--check) the generated effect/Schema index under the schema-first skill"
  )
);

const schemaIdiomsLookupCommand = Command.make(
  "lookup",
  {
    topic: Argument.Literals("topic", SchemaIdiomsLookupTopic.literals).pipe(
      Argument.withDescription("Wire type (string, number, bigint, date, other) or collections, constructors, getters")
    ),
  },
  Effect.fn(function* ({ topic }) {
    const repoRoot = yield* findRepoRoot();
    const slice = yield* readSchemaIndexSlice(repoRoot, topic);
    yield* Console.log(slice);
  })
).pipe(Command.withDescription("Print the effect/Schema index slice for a wire type or role"));

const schemaIdiomsHintCommand = Command.make(
  "hint",
  {
    file: Argument.String("file").pipe(Argument.withDescription("TypeScript file to read")),
  },
  Effect.fn(function* ({ file }) {
    const message = yield* hintSchemaIdiomsFile(file);
    yield* Console.log(O.getOrElse(message, () => "[schema-idiom] No hints."));
  })
).pipe(
  Command.withDescription(
    "Print advisory hints for schema fields whose name reads as a richer value; hints never fail the command"
  )
);

/**
 * `beep schema-idioms` command group.
 *
 * **Example** (Confirm the subcommands)
 *
 * ```ts
 * import { schemaIdiomsCommand } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as A from "effect/Array"
 *
 * const names = A.flatMap(schemaIdiomsCommand.subcommands, (group) => A.map(group.commands, (command) => command.name))
 * console.log(names) // ["index", "lookup", "hint"]
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const schemaIdiomsCommand = Command.make("schema-idioms", {}, () =>
  printLines([
    "effect/Schema idiom commands:",
    "- bun run beep schema-idioms index [--write | --check]",
    "- bun run beep schema-idioms lookup <string|number|bigint|date|other|collections|constructors|getters>",
    "- bun run beep schema-idioms hint <file>",
  ])
).pipe(
  Command.withDescription("The generated effect/Schema index and advisory schema field hints (index, lookup, hint)"),
  Command.withSubcommands([schemaIdiomsIndexCommand, schemaIdiomsLookupCommand, schemaIdiomsHintCommand])
) as Command.Command<"schema-idioms", {}, {}, never, never>;
