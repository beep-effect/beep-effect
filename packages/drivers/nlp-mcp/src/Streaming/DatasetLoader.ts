/**
 * Dataset loading helpers backing the streaming dataset tools.
 *
 * **Details**
 *
 * Loads text, line, JSONL, or JSON datasets from either a local file (via
 * {@link TextStream}) or a remote `http(s)` URL (via the {@link HttpClient}
 * service, provided at the entrypoint). Remote reads are bounded by
 * {@link Effect.timeout}; JSON payloads are parsed with
 * {@link S.fromJsonString} rather than raw `JSON.parse`. Each loader
 * returns the data alongside a {@link DatasetMeta} record describing provenance,
 * and the load timestamp comes from {@link Clock.currentTimeMillis}.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpMcpId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { isBlockedRemoteHost } from "@beep/schema/SafeRemoteHost";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readLines, readTextFile, TextEncoding } from "./TextStream.ts";

const $I = $NlpMcpId.create("Streaming/DatasetLoader");
const DEFAULT_TIMEOUT_MS = 30_000;
const NonNegativeInteger = S.Int.check(S.isGreaterThanOrEqualTo(0));
const PositiveInteger = S.Int.check(S.isGreaterThan(0));

const DatasetFormatBase = LiteralKit(["json", "jsonl", "lines", "text"]);

/**
 * **Example** (Decoding a dataset format)
 *
 * ```ts
 * import { DatasetFormat } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 *
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const format = yield* S.decodeUnknownEffect(DatasetFormat)("jsonl")
 *   console.log(format) // "jsonl"
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DatasetFormat = DatasetFormatBase.pipe(
  $I.annoteSchema("DatasetFormat", {
    description: "Dataset formats supported by the file and URL loaders.",
  })
);

/**
 * **Example** (Typing a dataset format)
 *
 * ```ts
 * import type { DatasetFormat } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 *
 * const format: DatasetFormat = "text"
 * console.log(format)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type DatasetFormat = typeof DatasetFormat.Type;

const DatasetSourceTypeBase = LiteralKit(["file", "url"]);

/**
 * **Example** (Decoding a source type)
 *
 * ```ts
 * import { DatasetSourceType } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 *
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const sourceType = yield* S.decodeUnknownEffect(DatasetSourceType)("file")
 *   console.log(sourceType) // "file"
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DatasetSourceType = DatasetSourceTypeBase.pipe(
  $I.annoteSchema("DatasetSourceType", {
    description: "Provenance source channels supported by dataset loaders.",
  })
);

/**
 * **Example** (Typing a source type)
 *
 * ```ts
 * import type { DatasetSourceType } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 *
 * const sourceType: DatasetSourceType = "url"
 * console.log(sourceType)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type DatasetSourceType = typeof DatasetSourceType.Type;

/**
 * **Example** (Reading dataset provenance)
 *
 * ```ts
 * import { DatasetMeta } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 *
 * const meta = DatasetMeta.make({
 *   format: "text",
 *   loadedAt: 0,
 *   location: "/tmp/data.txt",
 *   sourceType: "file"
 * })
 * console.log(meta.location)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class DatasetMeta extends S.Opaque<DatasetMeta, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Detected dataset format (`"text"`, `"lines"`, `"jsonl"`, or `"json"`). */
    format: DatasetFormat.annotateKey({
      description: 'Detected dataset format (`"text"`, `"lines"`, `"jsonl"`, or `"json"`).',
    }),
    /** Unix epoch milliseconds when the dataset was loaded. */
    loadedAt: NonNegativeInteger.annotateKey({
      description: "Unix epoch milliseconds when the dataset was loaded.",
    }),
    /** Resolved location (file path or URL) the dataset was loaded from. */
    location: S.String.annotateKey({
      description: "Resolved location (file path or URL) the dataset was loaded from.",
    }),
    /** Content size in bytes when known. */
    sizeBytes: S.OptionFromOptionalKey(NonNegativeInteger)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Content size in bytes when known.",
      }),
    /** Source channel: `"file"` or `"url"`. */
    sourceType: DatasetSourceType.annotateKey({
      description: 'Source channel: `"file"` or `"url"`.',
    }),
  }).pipe(
    $I.annoteSchema("DatasetMeta", {
      description: "Provenance metadata returned alongside every loaded dataset.",
    })
  )
) {}

/**
 * **Example** (Wrapping a loaded payload)
 *
 * ```ts
 * import { DatasetMeta, DatasetResult } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 * import * as S from "effect/Schema"
 *
 * const TextDataset = DatasetResult(S.String)
 * const result = TextDataset.make({
 *   data: "hello",
 *   meta: DatasetMeta.make({ format: "text", loadedAt: 0, location: "/tmp/data.txt", sourceType: "file" })
 * })
 * console.log(result.data)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const DatasetResult = <Data extends S.Top>(data: Data) =>
  S.Class<{
    readonly data: Data["Type"];
    readonly meta: DatasetMeta;
  }>($I`DatasetResult`)(
    {
      data: data.annotateKey({
        description: "The loaded dataset value.",
      }),
      meta: DatasetMeta.annotateKey({
        description: "Provenance metadata for the load.",
      }),
    },
    $I.annote("DatasetResult", {
      description: "A loaded dataset payload paired with its provenance metadata.",
    })
  );

const remoteLoadTimeoutFields = {
  timeout: PositiveInteger.pipe(
    S.withConstructorDefault(Effect.succeed(DEFAULT_TIMEOUT_MS)),
    S.annotateKey({
      description: "Remote URL load timeout in milliseconds.",
    }),
    S.withDecodingDefaultTypeKey(Effect.succeed(DEFAULT_TIMEOUT_MS))
  ),
};

/**
 * **Example** (Configuring a text load)
 *
 * ```ts
 * import { DatasetLoadTextOptions } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 *
 * const options = DatasetLoadTextOptions.make({ encoding: "utf-8" })
 * console.log(options.timeout)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class DatasetLoadTextOptions extends S.Opaque<DatasetLoadTextOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    encoding: TextEncoding.pipe(
      S.withConstructorDefault(Effect.succeed("utf-8" as const)),
      S.annotateKey({
        description: 'Text decoding label applied to local file bytes (default: "utf-8").',
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed("utf-8" as const))
    ),
    ...remoteLoadTimeoutFields,
  }).pipe(
    $I.annoteSchema("DatasetLoadTextOptions", {
      description: "Options for loading a dataset as raw text.",
    })
  )
) {}

/**
 * **Example** (Configuring a line load)
 *
 * ```ts
 * import { DatasetLoadLinesOptions } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 *
 * const options = DatasetLoadLinesOptions.make({ skipEmpty: true, trim: true })
 * console.log(options.timeout)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class DatasetLoadLinesOptions extends S.Opaque<DatasetLoadLinesOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    skipEmpty: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description: "Drop empty lines after optional trimming.",
    }),
    ...remoteLoadTimeoutFields,
    trim: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description: "Trim surrounding whitespace from loaded lines.",
    }),
  }).pipe(
    $I.annoteSchema("DatasetLoadLinesOptions", {
      description: "Options for loading a dataset as text lines.",
    })
  )
) {}

/**
 * **Example** (Configuring a JSONL load)
 *
 * ```ts
 * import { DatasetLoadJsonlOptions } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 *
 * const options = DatasetLoadJsonlOptions.make({ skipInvalid: true })
 * console.log(options.timeout)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class DatasetLoadJsonlOptions extends S.Opaque<DatasetLoadJsonlOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    skipInvalid: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description: "Drop malformed JSONL records instead of failing the load.",
    }),
    ...remoteLoadTimeoutFields,
  }).pipe(
    $I.annoteSchema("DatasetLoadJsonlOptions", {
      description: "Options for loading a dataset as JSONL records.",
    })
  )
) {}

/**
 * **Example** (Configuring a JSON load)
 *
 * ```ts
 * import { DatasetLoadJsonOptions } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 *
 * const options = DatasetLoadJsonOptions.make({})
 * console.log(options.timeout)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class DatasetLoadJsonOptions extends S.Opaque<DatasetLoadJsonOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    ...remoteLoadTimeoutFields,
  }).pipe(
    $I.annoteSchema("DatasetLoadJsonOptions", {
      description: "Options for loading a dataset as a single JSON document.",
    })
  )
) {}

/**
 * **Example** (Typing a load result)
 *
 * ```ts
 * import { DatasetMeta } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 * import type { DatasetResult } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 * import * as O from "effect/Option"
 *
 * const result: DatasetResult<string> = {
 *   data: "hello",
 *   meta: DatasetMeta.make({
 *     format: "text",
 *     loadedAt: 0,
 *     location: "/tmp/data.txt",
 *     sizeBytes: O.none(),
 *     sourceType: "file"
 *   })
 * }
 * console.log(result.data)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type DatasetResult<A> = S.Schema.Type<ReturnType<typeof DatasetResult<S.Schema<A>>>>;

/**
 * **Example** (Handling a load failure)
 *
 * ```ts
 * import { DatasetLoadError } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 *
 * const error = DatasetLoadError.make({ location: "https://example.com/data.json", message: "failed" })
 * console.log(error._tag)
 * ```
 *
 * @since 0.0.0
 * @category errors
 */
export class DatasetLoadError extends S.TaggedError<DatasetLoadError, { readonly brand: unique symbol }>(
  $I`DatasetLoadError`
)(
  "DatasetLoadError",
  {
    cause: S.OptionFromOptionalKey(
      S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))
    )
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Underlying platform, HTTP, timeout, or schema failure when available.",
      }),
    message: S.String.annotateKey({
      description: "Safe diagnostic message for the dataset load failure.",
    }),
    location: S.String.annotateKey({
      description: "File path or URL that failed to load or decode.",
    }),
  },
  $I.annoteError<DatasetLoadError>("DatasetLoadError", {
    description: "Structured failure raised when a remote fetch or JSON decode fails.",
  })
) {}

const TextDatasetResult = DatasetResult(S.String);
const LinesDatasetResult = DatasetResult(S.String.pipe(S.Array));
const JsonDatasetResult = DatasetResult(S.Unknown);
const JsonlDatasetResult = DatasetResult(S.Unknown.pipe(S.Array));

const decodeJson = S.decodeEffect(S.fromJsonString(S.Unknown));

const byteLength = (value: string): number => new TextEncoder().encode(value).length;

/**
 * Report whether a location should be treated as a remote `http(s)` URL.
 *
 * **Example** (Detecting a remote location)
 *
 * ```ts
 * import { isUrl } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 *
 * console.log(isUrl("https://example.com/data.txt"))
 * ```
 *
 * @since 0.0.0
 * @category predicates
 */
export const isUrl = (location: string): boolean =>
  Str.startsWith("http://")(location) || Str.startsWith("https://")(location);

const lineBreakLikeSplitLines = /\r?\n/;

const refuseInternalRemoteHost = (location: string): Effect.Effect<void, DatasetLoadError> =>
  Effect.try({
    catch: () => DatasetLoadError.make({ location, message: `Invalid URL: ${location}` }),
    try: () => new URL(location).hostname,
  }).pipe(
    Effect.flatMap((hostname) =>
      isBlockedRemoteHost(hostname)
        ? Effect.fail(
            DatasetLoadError.make({
              location,
              message: `Refusing to load from a loopback, link-local, or private host: ${hostname}`,
            })
          )
        : Effect.void
    )
  );

const fetchText = (
  location: string,
  timeoutMs: number
): Effect.Effect<string, DatasetLoadError, HttpClient.HttpClient> =>
  refuseInternalRemoteHost(location).pipe(
    Effect.andThen(
      HttpClient.get(location).pipe(
        Effect.flatMap(HttpClientResponse.filterStatusOk),
        Effect.flatMap((response) => response.text),
        Effect.timeout(Duration.millis(timeoutMs)),
        Effect.mapError((cause) =>
          DatasetLoadError.make({
            cause: O.some(cause),
            location,
            message: String(cause),
          })
        )
      )
    )
  );

const parseJson = (value: string, location: string): Effect.Effect<unknown, DatasetLoadError> =>
  decodeJson(value).pipe(
    Effect.mapError((cause) =>
      DatasetLoadError.make({
        cause: O.some(cause),
        location,
        message: String(cause),
      })
    )
  );

/**
 * Load raw text from a file or remote URL.
 *
 * **Example** (Loading a text dataset)
 *
 * ```ts
 * import { loadText } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 *
 * console.log(loadText("/tmp/data.txt"))
 * ```
 *
 * @effects Reads the Effect `Clock`; local locations require `FileSystem` and
 * `Path`, while URL locations require `HttpClient` and fail with
 * `DatasetLoadError` on HTTP, timeout, or remote allow-list failures.
 *
 * @since 0.0.0
 * @category constructors
 */
export const loadText = Effect.fn("DatasetLoader.loadText")(function* (
  location: string,
  options: (typeof DatasetLoadTextOptions)["~type.make.in"] = {}
) {
  const loadOptions = DatasetLoadTextOptions.make(options);
  const loadedAt = yield* Clock.currentTimeMillis;
  if (isUrl(location)) {
    const data = yield* fetchText(location, loadOptions.timeout);
    return TextDatasetResult.make({
      data,
      meta: DatasetMeta.make({
        format: "text",
        loadedAt,
        location,
        sizeBytes: O.some(byteLength(data)),
        sourceType: "url",
      }),
    });
  }
  const data = yield* readTextFile(location, loadOptions.encoding);
  return TextDatasetResult.make({
    data,
    meta: DatasetMeta.make({
      format: "text",
      loadedAt,
      location,
      sizeBytes: O.some(byteLength(data)),
      sourceType: "file",
    }),
  });
});

/**
 * Load a dataset as an array of lines from a file or remote URL.
 *
 * **Example** (Loading a line dataset)
 *
 * ```ts
 * import { loadLines } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 *
 * console.log(loadLines("/tmp/data.txt", { skipEmpty: true }))
 * ```
 *
 * @effects Reads the Effect `Clock`; local locations require `FileSystem` and
 * `Path`, while URL locations require `HttpClient` and fail with
 * `DatasetLoadError` on HTTP, timeout, or remote allow-list failures.
 *
 * @since 0.0.0
 * @category constructors
 */
export const loadLines = Effect.fn("DatasetLoader.loadLines")(function* (
  location: string,
  options: (typeof DatasetLoadLinesOptions)["~type.make.in"] = {}
) {
  const loadOptions = DatasetLoadLinesOptions.make(options);
  const loadedAt = yield* Clock.currentTimeMillis;
  if (isUrl(location)) {
    const text = yield* fetchText(location, loadOptions.timeout);
    const data = pipe(
      Str.split(lineBreakLikeSplitLines)(text),
      A.map((line) => (loadOptions.trim ? Str.trim(line) : line)),
      A.filter((line) => !loadOptions.skipEmpty || Str.isNonEmpty(line))
    );
    return LinesDatasetResult.make({
      data,
      meta: DatasetMeta.make({
        format: "lines",
        loadedAt,
        location,
        sizeBytes: O.some(byteLength(text)),
        sourceType: "url",
      }),
    });
  }
  const data = yield* readLines(location, { skipEmpty: loadOptions.skipEmpty, trim: loadOptions.trim });
  const rawTextForSizeBytes = yield* readTextFile(location, "utf-8");
  return LinesDatasetResult.make({
    data,
    meta: DatasetMeta.make({
      format: "lines",
      loadedAt,
      location,
      sizeBytes: O.some(byteLength(rawTextForSizeBytes)),
      sourceType: "file",
    }),
  });
});

/**
 * Load a JSONL dataset as an array of parsed records from a file or remote URL.
 *
 * **Details**
 *
 * Blank lines are skipped. When `skipInvalid` is `true` lines that fail to parse
 * are dropped; otherwise the first malformed line fails the effect.
 *
 * **Example** (Loading a JSONL dataset)
 *
 * ```ts
 * import { loadJsonl } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 *
 * console.log(loadJsonl("/tmp/data.jsonl", { skipInvalid: true }))
 * ```
 *
 * @effects Reads the Effect `Clock`, loads text through either `FileSystem` and
 * `Path` or `HttpClient`, then decodes each JSONL line with the schema JSON
 * codec and reports malformed records through `DatasetLoadError` unless
 * `skipInvalid` drops them.
 *
 * @since 0.0.0
 * @category constructors
 */
export const loadJsonl = Effect.fn("DatasetLoader.loadJsonl")(function* (
  location: string,
  options: (typeof DatasetLoadJsonlOptions)["~type.make.in"] = {}
) {
  const loadOptions = DatasetLoadJsonlOptions.make(options);
  const loadedAt = yield* Clock.currentTimeMillis;
  const sourceType: DatasetSourceType = isUrl(location) ? "url" : "file";
  const text =
    sourceType === "url" ? yield* fetchText(location, loadOptions.timeout) : yield* readTextFile(location, "utf-8");

  const lines = pipe(Str.split(/\r?\n/)(text), A.map(Str.trim), A.filter(Str.isNonEmpty));
  const records = yield* Effect.forEach(
    lines,
    (line) =>
      loadOptions.skipInvalid ? Effect.option(parseJson(line, location)) : Effect.asSome(parseJson(line, location)),
    { concurrency: 1 }
  ).pipe(Effect.map(A.getSomes));

  return JsonlDatasetResult.make({
    data: records,
    meta: DatasetMeta.make({
      format: "jsonl",
      loadedAt,
      location,
      sizeBytes: O.some(byteLength(text)),
      sourceType,
    }),
  });
});

/**
 * Load and parse a single JSON document from a file or remote URL.
 *
 * **Example** (Loading a JSON dataset)
 *
 * ```ts
 * import { loadJson } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 *
 * console.log(loadJson("/tmp/data.json"))
 * ```
 *
 * @effects Delegates text loading to {@link loadText}, then decodes the JSON
 * document with the schema JSON codec and fails with `DatasetLoadError` when
 * the document is malformed or the upstream text load fails.
 *
 * @since 0.0.0
 * @category constructors
 */
export const loadJson = Effect.fn("DatasetLoader.loadJson")(function* (
  location: string,
  options: (typeof DatasetLoadJsonOptions)["~type.make.in"] = {}
) {
  const result = yield* loadText(location, options);
  const data = yield* parseJson(result.data, location);
  return JsonDatasetResult.make({
    data,
    meta: DatasetMeta.make({
      format: "json",
      loadedAt: result.meta.loadedAt,
      location: result.meta.location,
      sizeBytes: result.meta.sizeBytes,
      sourceType: result.meta.sourceType,
    }),
  });
});
