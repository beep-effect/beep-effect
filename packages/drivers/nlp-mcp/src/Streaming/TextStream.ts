/**
 * Line-oriented text streaming helpers backing the streaming file tools.
 *
 * Provides memory-efficient, line-by-line access to text files using the
 * platform {@link FileSystem.FileSystem} and {@link Path.Path} services
 * (`FileSystem.stream` -\> `Stream.decodeText` -\> `Stream.splitLines`). All
 * operations stay platform-agnostic: a node `FileSystem`/`Path` implementation
 * is provided at the entrypoint, not here.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { PathSafety } from "@beep/file-processing";
import { $NlpMcpId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import {
  Context,
  Effect,
  FileSystem,
  Layer,
  Number as Num,
  Order,
  PlatformError as PlatformErrorNs,
  pipe,
  Random,
  Stream,
} from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { Path } from "effect";
import type { PlatformError } from "effect/PlatformError";

const $I = $NlpMcpId.create("Streaming/TextStream");
const NonNegativeFinite = S.Finite.check(S.isGreaterThanOrEqualTo(0));
const NonNegativeInteger = S.Int.check(S.isGreaterThanOrEqualTo(0));
const PositiveInteger = S.Int.check(S.isGreaterThan(0));

/**
 * Configurable allow-list of directories the streaming file tools may read.
 *
 * Local reads issued by the streaming MCP tools are constrained to these roots:
 * a caller-supplied path is accepted only when it canonically resolves inside at
 * least one configured root (see {@link resolveLocalPath}). The reference
 * defaults to the process working directory, so an entrypoint that provides no
 * override keeps the original fail-closed behavior while still allowing
 * operators (or tests) to widen the allow-list to an explicit dataset directory.
 *
 * Because this is a {@link Context.Reference}, the default is used automatically
 * when no override layer is supplied; provide {@link layerAllowedRoots} to widen
 * the allow-list for a particular runtime.
 *
 * @example
 * ```ts
 * import { StreamingAllowedRoots } from "@beep/nlp-mcp/Streaming/TextStream"
 *
 * console.log(StreamingAllowedRoots.key)
 * ```
 *
 * @since 0.0.0
 * @category guards
 */
export const StreamingAllowedRoots: Context.Reference<ReadonlyArray<string>> = Context.Reference<ReadonlyArray<string>>(
  $I`StreamingAllowedRoots`,
  {
    defaultValue: (): ReadonlyArray<string> => [process.cwd()],
  }
);

/**
 * Build a layer that overrides the {@link StreamingAllowedRoots} allow-list.
 *
 * Pass one or more directories that the streaming file tools are permitted to
 * read from. Paths are resolved within these roots and any candidate that
 * escapes every root (absolute path outside the roots, `..` traversal, or a
 * symlink pointing outside) is rejected before any bytes are read.
 *
 * @example
 * ```ts
 * import { layerAllowedRoots } from "@beep/nlp-mcp/Streaming/TextStream"
 *
 * const DatasetRoots = layerAllowedRoots(["/srv/datasets"])
 * console.log(DatasetRoots)
 * ```
 *
 * @since 0.0.0
 * @category guards
 */
export const layerAllowedRoots = (roots: ReadonlyArray<string>): Layer.Layer<never> =>
  Layer.succeed(StreamingAllowedRoots)(roots);

/**
 * Resolve a caller-supplied path against the configured allowed roots, failing
 * closed before any filesystem access.
 *
 * The streaming MCP tools accept attacker-controllable path strings, so each
 * candidate is resolved against every {@link StreamingAllowedRoots} entry via
 * {@link PathSafety.resolvePathWithinRoot}: the first root that canonically
 * contains the candidate wins, and a candidate that escapes every root through
 * an absolute path, a `..` traversal, or a symlink is rejected. The fail-closed
 * `PathSafetyError` is normalized into the platform `BadArgument` channel so the
 * read helpers keep their existing `PlatformError` failure type while still
 * refusing the read before any bytes are touched.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
 * import * as NodePath from "@effect/platform-node/NodePath"
 * import { layerAllowedRoots, resolveLocalPath } from "@beep/nlp-mcp/Streaming/TextStream"
 *
 * const program = resolveLocalPath("package.json").pipe(
 *   Effect.provide(layerAllowedRoots([process.cwd()])),
 *   Effect.provide(NodeFileSystem.layer),
 *   Effect.provide(NodePath.layer),
 *   Effect.map((resolved) => resolved.endsWith("package.json"))
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @since 0.0.0
 * @category guards
 */
export const resolveLocalPath: (
  filePath: string
) => Effect.Effect<string, PlatformError, FileSystem.FileSystem | Path.Path> = Effect.fn("TextStream.resolveLocalPath")(
  function* (filePath) {
    const roots = yield* StreamingAllowedRoots;
    return yield* Effect.firstSuccessOf(
      A.map(roots, (root) => PathSafety.resolvePathWithinRoot({ candidate: filePath, root }))
    ).pipe(
      Effect.mapError((cause) =>
        PlatformErrorNs.badArgument({
          cause,
          description: cause.message,
          method: "resolveLocalPath",
          module: "Streaming/TextStream",
        })
      )
    );
  }
);

const TextEncodingBase = LiteralKit(["ascii", "latin1", "utf-8"]);

/**
 * Text decoding labels accepted by the streaming text helpers.
 *
 * @example
 * ```ts
 * import { TextEncoding } from "@beep/nlp-mcp/Streaming/TextStream"
 *
 * const encoding = TextEncoding.fromUnknown("utf-8")
 * console.log(encoding)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TextEncoding = TextEncodingBase.pipe(
  $I.annoteSchema("TextEncoding", {
    description: "Text decoding labels accepted by the streaming text helpers.",
  }),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

/**
 * Type for {@link TextEncoding}.
 *
 * @example
 * ```ts
 * import type { TextEncoding } from "@beep/nlp-mcp/Streaming/TextStream"
 *
 * const encoding: TextEncoding = "latin1"
 * console.log(encoding)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type TextEncoding = typeof TextEncoding.Type;

const DEFAULT_ENCODING: TextEncoding = "utf-8";

/**
 * Per-line processing options shared by the read-oriented helpers.
 *
 * @example
 * ```ts
 * import { TextReadOptions } from "@beep/nlp-mcp/Streaming/TextStream"
 *
 * const options = TextReadOptions.make({ skipEmpty: true, trim: true })
 * console.log(options.skipEmpty)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class TextReadOptions extends S.Class<TextReadOptions>($I`TextReadOptions`)(
  {
    encoding: TextEncoding.pipe(SchemaUtils.withKeyDefaults(DEFAULT_ENCODING)).annotateKey({
      description: 'Text decoding label applied to file bytes (default: "utf-8").',
    }),
    skipEmpty: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description: "Drop lines that are empty after optional trimming (default: false).",
    }),
    trim: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description: "Trim surrounding whitespace from each line (default: false).",
    }),
  },
  $I.annote("TextReadOptions", {
    description: "Per-line processing options shared by the read-oriented helpers.",
  })
) {}

/**
 * Streaming options that extend {@link TextReadOptions} with windowing controls.
 *
 * @example
 * ```ts
 * import { TextStreamOptions } from "@beep/nlp-mcp/Streaming/TextStream"
 *
 * const options = TextStreamOptions.make({ maxLines: 10, skip: 2 })
 * console.log(options.maxLines)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class TextStreamOptions extends S.Class<TextStreamOptions>($I`TextStreamOptions`)(
  {
    ...TextReadOptions.fields,
    maxLines: PositiveInteger.pipe(SchemaUtils.withKeyDefaults(Number.MAX_SAFE_INTEGER)).annotateKey({
      description: "Maximum number of lines to emit after skipping (default: unbounded).",
    }),
    skip: NonNegativeInteger.pipe(SchemaUtils.withKeyDefaults(0)).annotateKey({
      description: "Number of leading lines to skip before emitting (default: 0).",
    }),
  },
  $I.annote("TextStreamOptions", {
    description: "Streaming options that extend TextReadOptions with windowing controls.",
  })
) {}

/**
 * Aggregate line-length and byte statistics computed for a text file.
 *
 * @example
 * ```ts
 * import { TextStreamStats } from "@beep/nlp-mcp/Streaming/TextStream"
 *
 * const stats = TextStreamStats.make({
 *   avgLineLength: 4,
 *   maxLineLength: 7,
 *   minLineLength: 1,
 *   nonEmptyLines: 2,
 *   totalBytes: 12,
 *   totalLines: 3
 * })
 * console.log(stats.totalLines)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class TextStreamStats extends S.Class<TextStreamStats>($I`TextStreamStats`)(
  {
    avgLineLength: NonNegativeFinite.annotateKey({
      description: "Mean processed line length across all counted lines.",
    }),
    maxLineLength: NonNegativeInteger.annotateKey({
      description: "Longest processed line length seen.",
    }),
    minLineLength: NonNegativeInteger.annotateKey({
      description: "Shortest processed line length seen, or 0 for an empty file.",
    }),
    nonEmptyLines: NonNegativeInteger.annotateKey({
      description: "Number of lines that were non-empty after processing.",
    }),
    totalBytes: NonNegativeInteger.annotateKey({
      description: "Total bytes attributed to processed lines, including newline separators.",
    }),
    totalLines: NonNegativeInteger.annotateKey({
      description: "Total number of processed lines.",
    }),
  },
  $I.annote("TextStreamStats", {
    description: "Aggregate line-length and byte statistics computed for a text file.",
  })
) {}

const byteLength = (value: string): number => new TextEncoder().encode(value).length;

/**
 * Stream a text file as a sequence of processed lines.
 *
 * Bytes are decoded with the requested encoding then split on line boundaries;
 * `skip` and `maxLines` window the result while `trim`/`skipEmpty` shape each
 * emitted line. The stream surfaces the platform's `PlatformError` channel and
 * requires the {@link FileSystem.FileSystem} and {@link Path.Path} services.
 *
 * @example
 * ```ts
 * import * as Stream from "effect/Stream"
 * import { streamLines } from "@beep/nlp-mcp/Streaming/TextStream"
 *
 * const lines = streamLines("/tmp/data.txt", { maxLines: 10, trim: true })
 * console.log(Stream.runCollect(lines))
 * ```
 *
 * @since 0.0.0
 * @category streams
 */
export const streamLines = (
  filePath: string,
  options: (typeof TextStreamOptions)["~type.make.in"] = {}
): Stream.Stream<string, PlatformError, FileSystem.FileSystem | Path.Path> => {
  const streamOptions = TextStreamOptions.make(options);

  return Stream.unwrap(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const resolved = yield* resolveLocalPath(filePath);

      return fs.stream(resolved).pipe(
        Stream.decodeText({ encoding: streamOptions.encoding }),
        Stream.splitLines,
        Stream.drop(streamOptions.skip),
        Stream.map((line) => (streamOptions.trim ? Str.trim(line) : line)),
        Stream.filter((line) => !streamOptions.skipEmpty || Str.isNonEmpty(line)),
        Stream.take(streamOptions.maxLines)
      );
    })
  );
};

/**
 * Collect a text file into an array of processed lines.
 *
 * Loads every emitted line into memory; prefer {@link streamLines} for large
 * inputs where incremental processing is sufficient.
 *
 * @example
 * ```ts
 * import { readLines } from "@beep/nlp-mcp/Streaming/TextStream"
 *
 * console.log(readLines("/tmp/data.txt", { skipEmpty: true }))
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const readLines = (
  filePath: string,
  options: (typeof TextStreamOptions)["~type.make.in"] = {}
): Effect.Effect<ReadonlyArray<string>, PlatformError, FileSystem.FileSystem | Path.Path> =>
  Stream.runCollect(streamLines(filePath, options));

/**
 * Read an entire text file into a single decoded string.
 *
 * @example
 * ```ts
 * import { readTextFile } from "@beep/nlp-mcp/Streaming/TextStream"
 *
 * console.log(readTextFile("/tmp/data.txt"))
 * ```
 *
 * @effects Requires `FileSystem` and `Path`, resolves the supplied file path,
 * and fails with `PlatformError` when the file cannot be read or decoded.
 *
 * @since 0.0.0
 * @category utilities
 */
export const readTextFile = Effect.fn("TextStream.readTextFile")(function* (
  filePath: string,
  encoding: TextEncoding = DEFAULT_ENCODING
) {
  const fs = yield* FileSystem.FileSystem;
  const resolved = yield* resolveLocalPath(filePath);
  return yield* fs.readFileString(resolved, encoding);
});

/**
 * Read the first `n` processed lines of a text file.
 *
 * @example
 * ```ts
 * import { head } from "@beep/nlp-mcp/Streaming/TextStream"
 *
 * console.log(head("/tmp/data.txt", { n: 5 }))
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const head: {
  (
    filePath: string,
    options: (typeof TextReadOptions)["~type.make.in"] & { readonly n: number }
  ): Effect.Effect<ReadonlyArray<string>, PlatformError, FileSystem.FileSystem | Path.Path>;
  (
    options: (typeof TextReadOptions)["~type.make.in"] & { readonly n: number }
  ): (filePath: string) => Effect.Effect<ReadonlyArray<string>, PlatformError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  (
    filePath: string,
    options: (typeof TextReadOptions)["~type.make.in"] & { readonly n: number }
  ): Effect.Effect<ReadonlyArray<string>, PlatformError, FileSystem.FileSystem | Path.Path> => {
    const { n, ...rest } = options;
    return readLines(filePath, { ...rest, maxLines: n });
  }
);

/**
 * Read the last `n` processed lines of a text file.
 *
 * @example
 * ```ts
 * import { tail } from "@beep/nlp-mcp/Streaming/TextStream"
 *
 * console.log(tail("/tmp/data.txt", { n: 5 }))
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const tail: {
  (
    filePath: string,
    options: (typeof TextReadOptions)["~type.make.in"] & { readonly n: number }
  ): Effect.Effect<ReadonlyArray<string>, PlatformError, FileSystem.FileSystem | Path.Path>;
  (
    options: (typeof TextReadOptions)["~type.make.in"] & { readonly n: number }
  ): (filePath: string) => Effect.Effect<ReadonlyArray<string>, PlatformError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  (
    filePath: string,
    options: (typeof TextReadOptions)["~type.make.in"] & { readonly n: number }
  ): Effect.Effect<ReadonlyArray<string>, PlatformError, FileSystem.FileSystem | Path.Path> => {
    const { n, ...rest } = options;
    return Effect.map(readLines(filePath, rest), A.takeRight(n));
  }
);

/**
 * Sample up to `sampleSize` processed lines uniformly at random.
 *
 * When the file has at most `sampleSize` processed lines they are returned in
 * order; otherwise a deterministic-by-{@link Random} shuffle selects the sample,
 * which is then re-sorted into original document order.
 *
 * @example
 * ```ts
 * import { sampleLines } from "@beep/nlp-mcp/Streaming/TextStream"
 *
 * console.log(sampleLines("/tmp/data.txt", 3))
 * ```
 *
 * @effects Reads processed lines through {@link readLines} and uses the Effect
 * `Random` service to choose sample indices when the file contains more than
 * `sampleSize` lines.
 *
 * @since 0.0.0
 * @category utilities
 */
export const sampleLines = Effect.fn("TextStream.sampleLines")(function* (
  filePath: string,
  sampleSize: number,
  options: (typeof TextReadOptions)["~type.make.in"] = {}
) {
  const lines = yield* readLines(filePath, options);
  if (A.length(lines) <= sampleSize) {
    return lines;
  }
  const indices = yield* Random.shuffle(A.makeBy(A.length(lines), (index) => index));
  return pipe(
    indices,
    A.take(sampleSize),
    A.sort(Order.Number),
    A.map((index) => A.get(lines, index)),
    A.getSomes
  );
});

/**
 * Count the processed lines in a text file without buffering them.
 *
 * @example
 * ```ts
 * import { countLines } from "@beep/nlp-mcp/Streaming/TextStream"
 *
 * console.log(countLines("/tmp/data.txt"))
 * ```
 *
 * @since 0.0.0
 * @category diagnostics
 */
export const countLines = (
  filePath: string,
  options: (typeof TextReadOptions)["~type.make.in"] = {}
): Effect.Effect<number, PlatformError, FileSystem.FileSystem | Path.Path> =>
  Stream.runCount(streamLines(filePath, options));

/**
 * Report whether a path exists.
 *
 * @example
 * ```ts
 * import { fileExists } from "@beep/nlp-mcp/Streaming/TextStream"
 *
 * console.log(fileExists("/tmp/data.txt"))
 * ```
 *
 * @effects Requires `FileSystem` and `Path`, resolves the supplied file path,
 * and queries the platform file system for path existence.
 *
 * @since 0.0.0
 * @category diagnostics
 */
export const fileExists = Effect.fn("TextStream.fileExists")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const resolved = yield* resolveLocalPath(filePath);
  return yield* fs.exists(resolved);
});

/**
 * Report the size of a file in bytes.
 *
 * @example
 * ```ts
 * import { getFileSize } from "@beep/nlp-mcp/Streaming/TextStream"
 *
 * console.log(getFileSize("/tmp/data.txt"))
 * ```
 *
 * @effects Requires `FileSystem` and `Path`, resolves the supplied file path,
 * and fails with `PlatformError` when the file cannot be statted.
 *
 * @since 0.0.0
 * @category diagnostics
 */
export const getFileSize = Effect.fn("TextStream.getFileSize")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const resolved = yield* resolveLocalPath(filePath);
  const info = yield* fs.stat(resolved);
  return Num.Number(info.size);
});

/**
 * Compute aggregate line-length and byte statistics for a text file.
 *
 * The accumulator runs in a single streaming pass; `totalBytes` charges each
 * processed line its UTF-8 byte length plus one newline separator.
 *
 * @example
 * ```ts
 * import { computeStats } from "@beep/nlp-mcp/Streaming/TextStream"
 *
 * console.log(computeStats("/tmp/data.txt", { trim: true }))
 * ```
 *
 * @since 0.0.0
 * @category diagnostics
 */
export const computeStats = (
  filePath: string,
  options: (typeof TextReadOptions)["~type.make.in"] = {}
): Effect.Effect<TextStreamStats, PlatformError, FileSystem.FileSystem | Path.Path> =>
  streamLines(filePath, options).pipe(
    Stream.runFold(
      (): {
        maxLineLength: number;
        minLineLength: number;
        nonEmptyLines: number;
        totalBytes: number;
        totalLength: number;
        totalLines: number;
      } => ({
        maxLineLength: 0,
        minLineLength: Number.MAX_SAFE_INTEGER,
        nonEmptyLines: 0,
        totalBytes: 0,
        totalLength: 0,
        totalLines: 0,
      }),
      (acc, line) => ({
        maxLineLength: Num.max(acc.maxLineLength, Str.length(line)),
        minLineLength: Num.min(acc.minLineLength, Str.length(line)),
        nonEmptyLines: acc.nonEmptyLines + (Str.isNonEmpty(line) ? 1 : 0),
        totalBytes: acc.totalBytes + byteLength(line) + 1,
        totalLength: acc.totalLength + Str.length(line),
        totalLines: acc.totalLines + 1,
      })
    ),
    Effect.map(
      (acc): TextStreamStats =>
        TextStreamStats.make({
          avgLineLength: acc.totalLines > 0 ? acc.totalLength / acc.totalLines : 0,
          maxLineLength: acc.maxLineLength,
          minLineLength: acc.totalLines > 0 ? acc.minLineLength : 0,
          nonEmptyLines: acc.nonEmptyLines,
          totalBytes: acc.totalBytes,
          totalLines: acc.totalLines,
        })
    )
  );
