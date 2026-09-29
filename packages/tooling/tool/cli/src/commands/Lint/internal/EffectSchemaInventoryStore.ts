/**
 * Fixture persistence for `beep lint effect-schema-inventory`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { Effect, FileSystem, HashMap, HashSet, Inspectable, Path } from "effect";
import * as O from "effect/Option";
import { writeArtifact } from "../../../internal/artifacts/index.ts";
import {
  decodeEffectSchemaInventoryRowJson,
  decodeEffectSchemaInventoryRowOption,
  EffectSchemaInventoryFixturePath,
} from "../EffectSchemaInventory.schemas.ts";
import { EffectSchemaInventoryError } from "../Lint.errors.ts";
import { effectSchemaInventoryJsonlName } from "./EffectSchemaInventoryRender.ts";
import type { EffectSchemaInventoryModule, EffectSchemaInventoryRendered } from "../EffectSchemaInventory.schemas.ts";

const INDEX_FILE = "INDEX.md";

/** Mode given to a freshly created fixture directory when there is no previous one to copy. */
const DIRECTORY_MODE = 0o755;

const fixtureError =
  (action: string, name: string) =>
  (cause: unknown): EffectSchemaInventoryError =>
    EffectSchemaInventoryError.new(
      `${action} ${EffectSchemaInventoryFixturePath}/${name}: ${Inspectable.toStringUnknown(cause, 0)}`
    );

// A missing directory lists as empty; any other listing failure fails loud instead of reading as empty.
const listFixtureDirectory = Effect.fn("EffectSchemaInventoryStore.listFixtureDirectory")(function* (
  directory: string
) {
  const fs = yield* FileSystem.FileSystem;
  const present = yield* fs.exists(directory).pipe(Effect.mapError(fixtureError("Unable to stat", ".")));
  if (!present) return A.empty<string>();
  return yield* fs.readDirectory(directory).pipe(Effect.mapError(fixtureError("Unable to list", ".")));
});

const isOwnedName = (name: string): boolean => Str.endsWith(".jsonl")(name) || name === INDEX_FILE;

const jsonlLines = (content: string): ReadonlyArray<string> => A.filter(Str.split(content, "\n"), Str.isNonEmpty);

/**
 * Read every fixture file this command owns (`*.jsonl` and `INDEX.md`), keyed by file name.
 *
 * **Details**
 *
 * A missing fixture directory reads as empty, so `--check` reports every file as missing; a
 * directory that exists but cannot be listed fails. `README.md` is hand-maintained and never
 * read here.
 *
 * **Example** (Build a fixture read)
 *
 * ```ts
 * import { readEffectSchemaInventoryFixture } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(readEffectSchemaInventoryFixture(process.cwd()))) // true
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export const readEffectSchemaInventoryFixture = Effect.fn("EffectSchemaInventoryStore.readFixture")(function* (
  root: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(root, EffectSchemaInventoryFixturePath);
  const names = yield* listFixtureDirectory(directory);
  const entries = yield* Effect.forEach(A.filter(names, isOwnedName), (name) =>
    fs.readFileString(path.join(directory, name)).pipe(
      Effect.map((content) => [name, content] as const),
      EffectSchemaInventoryError.mapError(`Unable to read ${EffectSchemaInventoryFixturePath}/${name}`)
    )
  );
  return HashMap.fromIterable(entries);
});

/**
 * Read and schema-decode one module's committed rows.
 *
 * **Example** (Build a module read)
 *
 * ```ts
 * import { EffectSchemaInventoryModules, readEffectSchemaInventoryModuleRows } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 *
 * const module = EffectSchemaInventoryModules[0]
 * console.log(module !== undefined && Effect.isEffect(readEffectSchemaInventoryModuleRows(process.cwd(), module))) // true
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export const readEffectSchemaInventoryModuleRows = Effect.fn("EffectSchemaInventoryStore.readModuleRows")(function* (
  root: string,
  module: EffectSchemaInventoryModule
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const name = effectSchemaInventoryJsonlName(module.slug);
  const content = yield* fs
    .readFileString(path.join(root, EffectSchemaInventoryFixturePath, name))
    .pipe(EffectSchemaInventoryError.mapError(`Unable to read ${EffectSchemaInventoryFixturePath}/${name}`));
  return yield* Effect.forEach(jsonlLines(content), (line, index) =>
    decodeEffectSchemaInventoryRowJson(line).pipe(
      EffectSchemaInventoryError.mapError(`Unable to decode ${name} line ${index + 1}`)
    )
  );
});

const isOwnedStaleRows = Effect.fn("EffectSchemaInventoryStore.isOwnedStaleRows")(function* (
  directory: string,
  name: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const content = yield* fs
    .readFileString(path.join(directory, name))
    .pipe(Effect.mapError(fixtureError("Unable to read", name)));
  const lines = jsonlLines(content);
  return (
    !A.isReadonlyArrayEmpty(lines) && A.every(lines, (line) => O.isSome(decodeEffectSchemaInventoryRowOption(line)))
  );
});

// Entries the new directory keeps: everything except files the generation replaces and `.jsonl`
// files it owns (every line decodes as a row) but no longer renders.
const carriedEntries = Effect.fn("EffectSchemaInventoryStore.carriedEntries")(function* (
  directory: string,
  present: ReadonlyArray<string>,
  rendered: EffectSchemaInventoryRendered
) {
  const replaced = HashSet.fromIterable(A.map(rendered.files, (file) => file.name));
  return yield* Effect.filter(
    A.filter(present, (name) => !HashSet.has(replaced, name)),
    (name) =>
      Str.endsWith(".jsonl")(name)
        ? Effect.map(isOwnedStaleRows(directory, name), (owned) => !owned)
        : Effect.succeed(true)
  );
});

const stageFixture = Effect.fn("EffectSchemaInventoryStore.stageFixture")(function* (
  staging: string,
  directory: string,
  carried: ReadonlyArray<string>,
  rendered: EffectSchemaInventoryRendered
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* Effect.forEach(
    carried,
    (name) =>
      fs
        .copy(path.join(directory, name), path.join(staging, name))
        .pipe(Effect.mapError(fixtureError("Unable to copy", name))),
    { concurrency: 1, discard: true }
  );
  yield* Effect.forEach(
    rendered.files,
    (file) =>
      writeArtifact({
        path: path.join(staging, file.name),
        body: file.content,
        onError: fixtureError("Unable to write", file.name),
      }),
    { concurrency: 1, discard: true }
  );
});

// Two renames replace the directory: the previous one moves aside, the staged one takes its name,
// and the previous one is restored if that second rename fails.
const swapFixture = Effect.fn("EffectSchemaInventoryStore.swapFixture")(function* (staging: string, directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const previous = `${staging}-previous`;
  const existed = yield* fs.exists(directory).pipe(Effect.mapError(fixtureError("Unable to stat", ".")));
  if (existed) yield* fs.rename(directory, previous).pipe(Effect.mapError(fixtureError("Unable to move aside", ".")));
  yield* fs.rename(staging, directory).pipe(
    Effect.mapError(fixtureError("Unable to move the staged fixture into", ".")),
    Effect.tapError(() => (existed ? Effect.ignore(fs.rename(previous, directory)) : Effect.void))
  );
  if (existed)
    yield* fs
      .remove(previous, { recursive: true })
      .pipe(Effect.mapError(fixtureError("Unable to remove the previous copy of", ".")));
});

/**
 * Replace the fixture directory with a rendered generation in one swap.
 *
 * **Details**
 *
 * The generation is staged in a sibling temporary directory: entries that stay (`README.md`,
 * foreign files, `.jsonl` files that do not decode as rows) are copied in, the rendered files are
 * written, and the staged directory is renamed into place. A failure before the swap leaves the
 * committed fixture untouched and the staging directory is removed. A fixture directory that
 * exists but cannot be listed, or a stale `.jsonl` that cannot be read, fails the write.
 *
 * **Example** (Build a write)
 *
 * ```ts
 * import { EffectSchemaInventoryReceipt, EffectSchemaInventoryRendered, writeEffectSchemaInventoryFixture } from "@beep/repo-cli/commands/Lint"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { Effect } from "effect"
 *
 * const receipt = EffectSchemaInventoryReceipt.make({
 *   pin: "df77fff9396fe31de72d1947ecb5b74f8cee89e1",
 *   parser: "6.0.2",
 *   digest: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   modules: 0, rows: 0, bytes: 0, internalRows: 0, deprecatedRows: 0, bareStarDeclarationsOmitted: 0
 * })
 * const write = writeEffectSchemaInventoryFixture("/tmp/repo", EffectSchemaInventoryRendered.make({ receipt, files: [] }))
 * console.log(Effect.isEffect(write)) // true
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export const writeEffectSchemaInventoryFixture = Effect.fn("EffectSchemaInventoryStore.writeFixture")(function* (
  root: string,
  rendered: EffectSchemaInventoryRendered
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(root, EffectSchemaInventoryFixturePath);
  const parent = path.dirname(directory);
  const present = yield* listFixtureDirectory(directory);
  const carried = yield* carriedEntries(directory, present, rendered);
  const mode = A.isReadonlyArrayEmpty(present)
    ? DIRECTORY_MODE
    : (yield* fs.stat(directory).pipe(Effect.mapError(fixtureError("Unable to stat", ".")))).mode;
  yield* fs.makeDirectory(parent, { recursive: true }).pipe(Effect.mapError(fixtureError("Unable to create", "..")));
  yield* Effect.acquireUseRelease(
    fs
      .makeTempDirectory({ directory: parent, prefix: ".inventory-write-" })
      .pipe(Effect.mapError(fixtureError("Unable to stage beside", "."))),
    Effect.fnUntraced(function* (staging) {
      yield* fs.chmod(staging, mode).pipe(Effect.mapError(fixtureError("Unable to set the mode of the staged", ".")));
      yield* stageFixture(staging, directory, carried, rendered);
      yield* swapFixture(staging, directory);
    }),
    (staging) => Effect.ignore(fs.remove(staging, { recursive: true, force: true }))
  );
});
