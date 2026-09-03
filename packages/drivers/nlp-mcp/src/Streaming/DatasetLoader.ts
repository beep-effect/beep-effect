/**
 * Dataset loading helpers backing the streaming dataset tools.
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
import { Defect, LiteralKit, SchemaUtils } from "@beep/schema";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { Clock, Duration, Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import { readLines, readTextFile, TextEncoding } from "./TextStream.ts";

const $I = $NlpMcpId.create("Streaming/DatasetLoader");
const DEFAULT_TIMEOUT_MS = 30_000;
const NonNegativeInteger = S.Int.check(S.isGreaterThanOrEqualTo(0));
const PositiveInteger = S.Int.check(S.isGreaterThan(0));

const DatasetFormatBase = LiteralKit(["json", "jsonl", "lines", "text"]);

/**
 * Dataset formats supported by the file and URL loaders.
 *
 * **Example** (Decoding a dataset format)
 *
 * ```ts
 * import { DatasetFormat } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 *
 * const format = DatasetFormat.fromUnknown("jsonl")
 * console.log(format)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DatasetFormat = DatasetFormatBase.pipe(
  $I.annoteSchema("DatasetFormat", {
    description: "Dataset formats supported by the file and URL loaders.",
  }),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

/**
 * Type for {@link DatasetFormat}.
 *
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
 * Provenance source channels supported by dataset loaders.
 *
 * **Example** (Decoding a source type)
 *
 * ```ts
 * import { DatasetSourceType } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 *
 * const sourceType = DatasetSourceType.fromUnknown("file")
 * console.log(sourceType)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DatasetSourceType = DatasetSourceTypeBase.pipe(
  $I.annoteSchema("DatasetSourceType", {
    description: "Provenance source channels supported by dataset loaders.",
  }),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

/**
 * Type for {@link DatasetSourceType}.
 *
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
 * Provenance metadata returned alongside every loaded dataset.
 *
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
export class DatasetMeta extends S.Class<DatasetMeta>($I`DatasetMeta`)(
  {
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
    sizeBytes: S.OptionFromOptionalKey(NonNegativeInteger).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Content size in bytes when known.",
    }),
    /** Source channel: `"file"` or `"url"`. */
    sourceType: DatasetSourceType.annotateKey({
      description: 'Source channel: `"file"` or `"url"`.',
    }),
  },
  $I.annote("DatasetMeta", {
    description: "Provenance metadata returned alongside every loaded dataset.",
  })
) {}

/**
 * A loaded dataset payload paired with its {@link DatasetMeta}.
 *
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

/**
 * Options for loading a dataset as raw text.
 *
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
export class DatasetLoadTextOptions extends S.Class<DatasetLoadTextOptions>($I`DatasetLoadTextOptions`)(
  {
    encoding: TextEncoding.pipe(SchemaUtils.withKeyDefaults("utf-8")).annotateKey({
      description: 'Text decoding label applied to local file bytes (default: "utf-8").',
    }),
    timeout: PositiveInteger.pipe(SchemaUtils.withKeyDefaults(DEFAULT_TIMEOUT_MS)).annotateKey({
      description: "Remote URL load timeout in milliseconds.",
    }),
  },
  $I.annote("DatasetLoadTextOptions", {
    description: "Options for loading a dataset as raw text.",
  })
) {}

/**
 * Options for loading a dataset as text lines.
 *
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
export class DatasetLoadLinesOptions extends S.Class<DatasetLoadLinesOptions>($I`DatasetLoadLinesOptions`)(
  {
    skipEmpty: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description: "Drop empty lines after optional trimming.",
    }),
    timeout: PositiveInteger.pipe(SchemaUtils.withKeyDefaults(DEFAULT_TIMEOUT_MS)).annotateKey({
      description: "Remote URL load timeout in milliseconds.",
    }),
    trim: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description: "Trim surrounding whitespace from loaded lines.",
    }),
  },
  $I.annote("DatasetLoadLinesOptions", {
    description: "Options for loading a dataset as text lines.",
  })
) {}

/**
 * Options for loading a dataset as JSONL records.
 *
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
export class DatasetLoadJsonlOptions extends S.Class<DatasetLoadJsonlOptions>($I`DatasetLoadJsonlOptions`)(
  {
    skipInvalid: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description: "Drop malformed JSONL records instead of failing the load.",
    }),
    timeout: PositiveInteger.pipe(SchemaUtils.withKeyDefaults(DEFAULT_TIMEOUT_MS)).annotateKey({
      description: "Remote URL load timeout in milliseconds.",
    }),
  },
  $I.annote("DatasetLoadJsonlOptions", {
    description: "Options for loading a dataset as JSONL records.",
  })
) {}

/**
 * Options for loading a dataset as a single JSON document.
 *
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
export class DatasetLoadJsonOptions extends S.Class<DatasetLoadJsonOptions>($I`DatasetLoadJsonOptions`)(
  {
    timeout: PositiveInteger.pipe(SchemaUtils.withKeyDefaults(DEFAULT_TIMEOUT_MS)).annotateKey({
      description: "Remote URL load timeout in milliseconds.",
    }),
  },
  $I.annote("DatasetLoadJsonOptions", {
    description: "Options for loading a dataset as a single JSON document.",
  })
) {}

/**
 * Type for {@link DatasetResult}.
 *
 * **Example** (Typing a load result)
 *
 * ```ts
 * import type { DatasetResult } from "@beep/nlp-mcp/Streaming/DatasetLoader"
 * import * as O from "effect/Option"
 *
 * const result: DatasetResult<string> = {
 *   data: "hello",
 *   meta: { format: "text", loadedAt: 0, location: "/tmp/data.txt", sizeBytes: O.none(), sourceType: "file" }
 * }
 * console.log(result.data)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type DatasetResult<A> = S.Schema.Type<ReturnType<typeof DatasetResult<S.Schema<A>>>>;

/**
 * Structured failure raised when a remote fetch or JSON decode fails.
 *
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
export class DatasetLoadError extends S.TaggedError<DatasetLoadError>($I`DatasetLoadError`)(
  "DatasetLoadError",
  {
    cause: S.OptionFromOptionalKey(Defect({ includeStack: true }))
      .pipe(SchemaUtils.withNoneDefault)
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

const decodeJson = UnknownFromJsonString.decodeEffect;

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

/**
 * Reject hostnames that resolve to the local host or to private/internal
 * network space. This bounds the SSRF surface of the URL-backed loaders: the
 * `location` is attacker-controllable through the MCP tool parameters, so a
 * prompt-injected agent must not be able to reach loopback services, link-local
 * addresses, RFC1918/ULA private network space, or the cloud metadata endpoint
 * (`169.254.169.254`).
 */
const isPrivate172 = (host: string): boolean =>
  pipe(
    Str.match(/^172\.(\d{1,3})\./)(host),
    O.flatMap(A.get(1)),
    O.map((octet) => Number.parseInt(octet, 10)),
    O.filter((n) => !Number.isNaN(n)),
    O.exists((n) => n >= 16 && n <= 31)
  );

const isInternalIpv4 = (host: string): boolean =>
  Str.startsWith("127.")(host) ||
  Str.startsWith("169.254.")(host) ||
  Str.startsWith("10.")(host) ||
  Str.startsWith("192.168.")(host) ||
  isPrivate172(host);

// Decode the IPv4 embedded in an IPv4-mapped IPv6 host. `new URL(...).hostname`
// normalizes mapped addresses to compressed hex (::ffff:c0a8:101), so the dotted
// prefixes never fire for URL input; decode hex and dotted suffixes back to IPv4
// so mapped private ranges classify like their bare form. None for non-mapped.
const extractMappedIpv4 = (host: string): O.Option<string> =>
  pipe(
    Str.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)(host),
    O.flatMap((groups) => O.all([A.get(groups, 1), A.get(groups, 2)])),
    O.map(([hi, lo]) => {
      const high = Number.parseInt(hi, 16);
      const low = Number.parseInt(lo, 16);
      return `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
    }),
    O.orElse(() => pipe(Str.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)(host), O.flatMap(A.get(1))))
  );

const isBlockedRemoteHost = (hostname: string): boolean => {
  const host = pipe(Str.toLowerCase(hostname), Str.replace(/^\[|\]$/g, ""));
  // SSRF guard duplicated with @beep/schema SafeRemoteHost.isInternalHost by
  // design: each slice owns a self-contained, independently auditable blocklist
  // rather than coupling this driver to a foundation schema's internals.
  // IPv4-mapped IPv6 is decoded back to its IPv4 form so mapped private ranges
  // classify through the same isInternalIpv4 checks.
  // fallow-ignore-next-line code-duplication -- SSRF blocklist mirrors SafeRemoteHost for independent security auditing
  return (
    host === "localhost" ||
    Str.endsWith(".localhost")(host) ||
    host === "0.0.0.0" ||
    host === "::" ||
    host === "::1" ||
    Str.startsWith("fe80:")(host) ||
    Str.startsWith("fc")(host) ||
    Str.startsWith("fd")(host) ||
    isInternalIpv4(host) ||
    O.exists(extractMappedIpv4(host), isInternalIpv4)
  );
};

const assertAllowedRemote = (location: string): Effect.Effect<void, DatasetLoadError> =>
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
  assertAllowedRemote(location).pipe(
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
    // Split on CRLF or LF so remote datasets decode identically to local files
    // (where `Stream.splitLines` already strips the trailing `\r`).
    const data = pipe(
      Str.split(/\r?\n/)(text),
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
  // Read the raw text once more so file sources report `sizeBytes` like URL
  // sources do, keeping the provenance record consistent across channels.
  const rawText = yield* readTextFile(location, "utf-8");
  return LinesDatasetResult.make({
    data,
    meta: DatasetMeta.make({
      format: "lines",
      loadedAt,
      location,
      sizeBytes: O.some(byteLength(rawText)),
      sourceType: "file",
    }),
  });
});

/**
 * Load a JSONL dataset as an array of parsed records from a file or remote URL.
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
