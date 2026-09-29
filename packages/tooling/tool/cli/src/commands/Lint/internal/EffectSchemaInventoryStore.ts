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

const writeError =
  (name: string) =>
  (cause: unknown): EffectSchemaInventoryError =>
    EffectSchemaInventoryError.new(
      `Unable to write ${EffectSchemaInventoryFixturePath}/${name}: ${Inspectable.toStringUnknown(cause, 0)}`
    );

const isOwnedName = (name: string): boolean => Str.endsWith(".jsonl")(name) || name === INDEX_FILE;

const jsonlLines = (content: string): ReadonlyArray<string> => A.filter(Str.split(content, "\n"), Str.isNonEmpty);

/**
 * Read every fixture file this command owns (`*.jsonl` and `INDEX.md`), keyed by file name.
 *
 * **Details**
 *
 * A missing fixture directory reads as empty, so `--check` reports every file as missing rather
 * than failing on IO. `README.md` and `LICENSE` are hand-maintained and never read here.
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
  const names = yield* fs.readDirectory(directory).pipe(Effect.orElseSucceed(A.empty<string>));
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
  const content = yield* fs.readFileString(path.join(directory, name)).pipe(Effect.orElseSucceed(() => ""));
  const lines = jsonlLines(content);
  return (
    !A.isReadonlyArrayEmpty(lines) && A.every(lines, (line) => O.isSome(decodeEffectSchemaInventoryRowOption(line)))
  );
});

/**
 * Write a rendered generation into the fixture directory and remove stale rows files it owns.
 *
 * **Details**
 *
 * A `.jsonl` file outside the rendered set is removed only when every line decodes as a
 * `schema-inventory/v1` row; empty or foreign files stay, and `--check` then reports them as
 * unexpected. `README.md` and `LICENSE` are never touched.
 *
 * **Example** (Build a write)
 *
 * ```ts
 * import { EffectSchemaInventoryReceipt, EffectSchemaInventoryRendered, writeEffectSchemaInventoryFixture } from "@beep/repo-cli/commands/Lint"
 * import { Sha256Hex } from "@beep/schema"
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
  yield* Effect.forEach(
    rendered.files,
    (file) =>
      writeArtifact({
        path: path.join(directory, file.name),
        body: file.content,
        onError: writeError(file.name),
      }),
    { concurrency: 1, discard: true }
  );
  const expected = HashSet.fromIterable(A.map(rendered.files, (file) => file.name));
  const present = yield* fs.readDirectory(directory).pipe(Effect.orElseSucceed(A.empty<string>));
  yield* Effect.forEach(
    A.filter(present, (name) => Str.endsWith(".jsonl")(name) && !HashSet.has(expected, name)),
    Effect.fnUntraced(function* (name) {
      if (!(yield* isOwnedStaleRows(directory, name))) return;
      yield* fs
        .remove(path.join(directory, name), { force: true })
        .pipe(
          EffectSchemaInventoryError.mapError(`Unable to remove stale ${EffectSchemaInventoryFixturePath}/${name}`)
        );
    }),
    { concurrency: 1, discard: true }
  );
});
