/**
 * Shared data-file codecs and jsonl IO for the JSDoc carrier migration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import { A, Str, thunkFalse } from "@beep/utils";
import { Effect, FileSystem, MutableHashMap, Path } from "effect";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { QualityScriptCommandError } from "../Quality.errors.ts";
import {
  JSDocMigrateExtractRecord,
  JSDocMigrateOverrideRecord,
  JSDocMigrateTitleRecord,
} from "./JSDocMigrate.schemas.ts";
import type * as S from "effect/Schema";

/**
 * JSON-line codec for {@link JSDocMigrateExtractRecord} rows.
 *
 * **Example** (Round-trip an extract row)
 *
 * ```ts
 * import { jsdocMigrateExtractCodec } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(jsdocMigrateExtractCodec.decode("{}"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const jsdocMigrateExtractCodec = JsonStringCodec(JSDocMigrateExtractRecord);

/**
 * JSON-line codec for {@link JSDocMigrateTitleRecord} rows.
 *
 * **Example** (Round-trip a title row)
 *
 * ```ts
 * import { jsdocMigrateTitleCodec } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(jsdocMigrateTitleCodec.decode("{}"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const jsdocMigrateTitleCodec = JsonStringCodec(JSDocMigrateTitleRecord);

/**
 * JSON-line codec for {@link JSDocMigrateOverrideRecord} rows.
 *
 * **Example** (Round-trip an override row)
 *
 * ```ts
 * import { jsdocMigrateOverrideCodec } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(jsdocMigrateOverrideCodec.decode("{}"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const jsdocMigrateOverrideCodec = JsonStringCodec(JSDocMigrateOverrideRecord);

/**
 * Resolve the repo root and platform services every migration stage starts from.
 *
 * **Example** (Build the run-context Effect)
 *
 * ```ts
 * import { jsdocMigrateRunContext } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(jsdocMigrateRunContext())) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const jsdocMigrateRunContext = Effect.fn("JSDocMigrateData.runContext")(function* (): Effect.fn.Return<
  {
    readonly repoRoot: string;
    readonly path: Path.Path;
    readonly fs: FileSystem.FileSystem;
  },
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  return { repoRoot, path, fs };
});

/**
 * Read one migration jsonl data file, treating a missing file as empty.
 *
 * **Example** (Build a jsonl reader Effect)
 *
 * ```ts
 * import { jsdocMigrateTitleCodec, readJSDocMigrateJsonl } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * const program = readJSDocMigrateJsonl("/tmp/none.jsonl", jsdocMigrateTitleCodec.decode, "titles.jsonl")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const readJSDocMigrateJsonl = Effect.fn("JSDocMigrateData.readJsonl")(function* <T>(
  absolutePath: string,
  decodeLine: (line: string) => Effect.Effect<T, S.SchemaError>,
  label: string
): Effect.fn.Return<ReadonlyArray<T>, QualityScriptCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(absolutePath).pipe(Effect.orElseSucceed(thunkFalse));
  if (!exists) {
    return [];
  }
  const content = yield* fs
    .readFileString(absolutePath)
    .pipe(Effect.mapError((cause) => QualityScriptCommandError.new(cause, `Failed to read ${label}.`)));
  const jsonLines = A.filter(A.map(Str.split(/\r?\n/)(content), Str.trim), Str.isNonEmpty);
  return yield* Effect.forEach(jsonLines, (line, index) =>
    decodeLine(line).pipe(
      Effect.mapError((cause) => QualityScriptCommandError.new(cause, `Failed to decode ${label} line ${index + 1}.`))
    )
  );
});

/**
 * Read the frozen extract, failing when it is missing or empty.
 *
 * **Example** (Build the required-extract Effect)
 *
 * ```ts
 * import { readJSDocMigrateExtractRequired } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(readJSDocMigrateExtractRequired("/tmp/none.jsonl"))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const readJSDocMigrateExtractRequired = Effect.fn("JSDocMigrateData.readExtractRequired")(function* (
  absolutePath: string
): Effect.fn.Return<ReadonlyArray<JSDocMigrateExtractRecord>, QualityScriptCommandError, FileSystem.FileSystem> {
  const records = yield* readJSDocMigrateJsonl(absolutePath, jsdocMigrateExtractCodec.decode, "extract.jsonl");
  if (A.isReadonlyArrayEmpty(records)) {
    return yield* QualityScriptCommandError.make({
      message: `A non-empty extract is required at ${absolutePath}; run jsdoc-migrate extract first.`,
      command: "bun run beep quality jsdoc-migrate",
      exitCode: 1,
    });
  }
  return records;
});

/**
 * Index anchored records by anchor; later rows win on duplicates.
 *
 * **Details**
 *
 * Later-wins matches the append-only retry semantics of `titles.jsonl`: a
 * re-titled anchor appends a fresh row rather than editing history.
 *
 * **Example** (Index two records)
 *
 * ```ts
 * import { indexJSDocMigrateByAnchor } from "@beep/repo-cli/test/Quality"
 * import { MutableHashMap } from "effect"
 *
 * const index = indexJSDocMigrateByAnchor([{ anchor: "a#x#0" }, { anchor: "b#y#0" }])
 * console.log(MutableHashMap.size(index)) // 2
 * ```
 *
 * @param records - Anchored records to index.
 * @returns Mutable map from anchor to the last record carrying it.
 * @category use-cases
 * @since 0.0.0
 */
export const indexJSDocMigrateByAnchor = <T extends { readonly anchor: string }>(
  records: ReadonlyArray<T>
): MutableHashMap.MutableHashMap<string, T> =>
  MutableHashMap.fromIterable(A.map(records, (record): readonly [string, T] => [record.anchor, record]));
