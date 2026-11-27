/**
 * `beep schema-idioms` programs: generate, write and check the committed
 * schema index, print one slice, and print the name-tell hints of a file.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { SchemaIdiomHintInput } from "./SchemaIdiomHints.model.ts";
import { schemaIdiomHints } from "./SchemaIdiomHints.ts";
import { SchemaIdiomsError } from "./SchemaIdioms.errors.ts";
import { extractSchemaIndex } from "./SchemaIdioms.extract.ts";
import { SchemaIndexDrift } from "./SchemaIdioms.model.ts";
import {
  lookupSliceFile,
  renderSchemaIdiomHints,
  renderSchemaIndexFiles,
  SCHEMA_INDEX_DIRECTORY,
} from "./SchemaIdioms.render.ts";
import type { SchemaIdiomsLookupTopic, SchemaIndexFile } from "./SchemaIdioms.model.ts";

const byFile: Order.Order<SchemaIndexDrift> = Order.mapInput(Order.String, (drift: SchemaIndexDrift) => drift.file);

/**
 * Extract the index from the installed effect and render its files.
 *
 * **Example** (Count the generated files)
 *
 * ```ts
 * import { generateSchemaIndexFiles } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 *
 * const program = generateSchemaIndexFiles(process.cwd()).pipe(Effect.map(A.length))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @returns The eight slices and the README.
 * @category use-cases
 * @since 0.0.0
 */
export const generateSchemaIndexFiles = Effect.fn("SchemaIdioms.generateSchemaIndexFiles")(function* (
  repoRoot: string
) {
  const index = yield* extractSchemaIndex(repoRoot);
  return renderSchemaIndexFiles(index);
});

const indexDirectory = Effect.fn("SchemaIdioms.indexDirectory")(function* (repoRoot: string) {
  const path = yield* Path.Path;
  return path.join(repoRoot, SCHEMA_INDEX_DIRECTORY);
});

const committedMarkdown = Effect.fn("SchemaIdioms.committedMarkdown")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(directory)
    .pipe(SchemaIdiomsError.mapError(`could not stat ${SCHEMA_INDEX_DIRECTORY}`));
  if (!exists) {
    return A.empty<string>();
  }
  const names = yield* fs
    .readDirectory(directory)
    .pipe(SchemaIdiomsError.mapError(`could not list ${SCHEMA_INDEX_DIRECTORY}`));
  return A.filter(names, Str.endsWith(".md"));
});

/**
 * Compare the committed index directory against generated files.
 *
 * **Example** (Check the committed index)
 *
 * ```ts
 * import { diffSchemaIndexFiles } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as Effect from "effect/Effect"
 *
 * const program = diffSchemaIndexFiles(process.cwd(), [])
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @param files - The files the installed effect generates.
 * @returns Every drift, sorted by file name; empty when the directory is current.
 * @category use-cases
 * @since 0.0.0
 */
export const diffSchemaIndexFiles = Effect.fn("SchemaIdioms.diffSchemaIndexFiles")(function* (
  repoRoot: string,
  files: ReadonlyArray<SchemaIndexFile>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* indexDirectory(repoRoot);
  const committed = yield* committedMarkdown(directory);
  const generatedNames = HashSet.fromIterable(A.map(files, (file) => file.file));
  const generatedDrift = yield* Effect.forEach(
    files,
    (file) =>
      Effect.gen(function* () {
        if (!A.contains(committed, file.file)) {
          return SchemaIndexDrift.makeOption({ file: file.file, change: "missing" });
        }
        const text = yield* fs
          .readFileString(path.join(directory, file.file))
          .pipe(SchemaIdiomsError.mapError(`could not read ${file.file}`));
        return text === file.content
          ? O.none<SchemaIndexDrift>()
          : SchemaIndexDrift.makeOption({ file: file.file, change: "changed" });
      }),
    { concurrency: 1 }
  );
  const extra = A.map(
    A.filter(committed, (name) => !HashSet.has(generatedNames, name)),
    (name) => SchemaIndexDrift.make({ file: name, change: "extra" })
  );
  return A.sort(A.appendAll(A.getSomes(generatedDrift), extra), byFile);
});

/**
 * Write the generated files into the index directory and delete committed
 * Markdown files nothing generates.
 *
 * **Example** (Regenerate the index)
 *
 * ```ts
 * import { writeSchemaIndexFiles } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as Effect from "effect/Effect"
 *
 * const program = writeSchemaIndexFiles(process.cwd(), [])
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @param files - The files to write.
 * @returns The drift that was repaired.
 * @category use-cases
 * @since 0.0.0
 */
export const writeSchemaIndexFiles = Effect.fn("SchemaIdioms.writeSchemaIndexFiles")(function* (
  repoRoot: string,
  files: ReadonlyArray<SchemaIndexFile>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* indexDirectory(repoRoot);
  const drift = yield* diffSchemaIndexFiles(repoRoot, files);
  yield* fs
    .makeDirectory(directory, { recursive: true })
    .pipe(SchemaIdiomsError.mapError(`could not create ${SCHEMA_INDEX_DIRECTORY}`));
  const extra = A.filter(drift, (entry) => entry.change === "extra");
  const staleNames = HashSet.fromIterable(
    A.map(
      A.filter(drift, (entry) => entry.change !== "extra"),
      (entry) => entry.file
    )
  );
  yield* Effect.forEach(
    A.filter(files, (file) => HashSet.has(staleNames, file.file)),
    (file) =>
      fs
        .writeFileString(path.join(directory, file.file), file.content)
        .pipe(SchemaIdiomsError.mapError(`could not write ${file.file}`)),
    { concurrency: 1, discard: true }
  );
  yield* Effect.forEach(
    extra,
    (entry) =>
      fs.remove(path.join(directory, entry.file)).pipe(SchemaIdiomsError.mapError(`could not remove ${entry.file}`)),
    { concurrency: 1, discard: true }
  );
  return drift;
});

/**
 * Read the committed slice a lookup topic names.
 *
 * **Example** (Print the number slice)
 *
 * ```ts
 * import { readSchemaIndexSlice } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as Effect from "effect/Effect"
 *
 * const program = readSchemaIndexSlice(process.cwd(), "number")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @param topic - The wire type or role topic.
 * @returns The slice's Markdown text.
 * @category use-cases
 * @since 0.0.0
 */
export const readSchemaIndexSlice = Effect.fn("SchemaIdioms.readSchemaIndexSlice")(function* (
  repoRoot: string,
  topic: SchemaIdiomsLookupTopic
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = lookupSliceFile(topic);
  const directory = yield* indexDirectory(repoRoot);
  return yield* fs
    .readFileString(path.join(directory, file))
    .pipe(
      SchemaIdiomsError.mapError(
        `could not read ${SCHEMA_INDEX_DIRECTORY}/${file}; run bun run beep schema-idioms index --write`
      )
    );
});

/**
 * Read one file and render its name-tell hints as the advisory message.
 *
 * **Example** (Hint a file)
 *
 * ```ts
 * import { hintSchemaIdiomsFile } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as Effect from "effect/Effect"
 *
 * const program = hintSchemaIdiomsFile("packages/demo/src/Fleet.ts")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param file - Path of the TypeScript file, absolute or relative to the working directory.
 * @returns The message, or none when the file has no hints.
 * @category use-cases
 * @since 0.0.0
 */
export const hintSchemaIdiomsFile = Effect.fn("SchemaIdioms.hintSchemaIdiomsFile")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(file).pipe(SchemaIdiomsError.mapError(`could not read ${file}`));
  return pipe(SchemaIdiomHintInput.make({ file, text, written: O.none() }), schemaIdiomHints, renderSchemaIdiomHints);
});
