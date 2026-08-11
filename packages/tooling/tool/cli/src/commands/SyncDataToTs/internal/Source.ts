/**
 * Shared source acquisition and rendering helpers for sync-data-to-ts targets.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { CSV } from "@beep/schema/Csv";
import { parseCsvRows } from "@beep/schema/CsvParser";
import { ParserOptions } from "@beep/schema/ParserOptions";
import { XmlTextToUnknown } from "@beep/schema/Xml";
import { A, Str } from "@beep/utils";
import { cast } from "@beep/utils/Function";
import { Crypto, Effect, Encoding, pipe, Result } from "effect";
import { dual, flow } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { formatJsonValue } from "../../../internal/cli/Json.ts";
import { SyncDataToTsError } from "../SyncDataToTs.errors.ts";
import { SyncDataOutputFile, SyncDataSourceMetadata } from "../SyncDataToTs.schemas.ts";

const $I = $RepoCliId.create("commands/SyncDataToTs/internal/Source");

const textDecoder = new TextDecoder();
const decodeJsonText = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeJsonTextResult = S.decodeUnknownResult(S.fromJsonString(S.Json));
const decodeXmlText = S.decodeUnknownEffect(XmlTextToUnknown);
const encodeUnknownJsonResult = S.encodeUnknownResult(S.fromJsonString(S.Unknown));
const defaultCsvParserOptions = ParserOptions.new();

const ParsedCsvRecord = S.Record(S.String, S.String).pipe(
  $I.annoteSchema("ParsedCsvRecord", {
    description: "One CSV row keyed by header name with string cell values.",
  })
);
type ParsedCsvRecord = typeof ParsedCsvRecord.Type;

/**
 * Parsed CSV rows with the source header columns attached as a stable property.
 *
 * @category models
 * @since 0.0.0
 */
export type ParsedCsvRecords = Array<ParsedCsvRecord> & {
  readonly columns: ReadonlyArray<string>;
};

/**
 * Raw fetched source with stable hash metadata.
 *
 * @category models
 * @since 0.0.0
 */
export class SyncDataFetchedSource extends S.Class<SyncDataFetchedSource>($I`SyncDataFetchedSource`)(
  {
    bytes: S.Uint8Array,
    id: S.String,
    sha256: S.String,
    text: S.String,
    url: S.String,
  },
  $I.annote("SyncDataFetchedSource", {
    description: "Raw fetched source with stable hash metadata.",
  })
) {}

const attachCsvColumns = (rows: ReadonlyArray<ParsedCsvRecord>, columns: ReadonlyArray<string>): ParsedCsvRecords => {
  const records = A.fromIterable(rows);

  Reflect.defineProperty(records, "columns", {
    configurable: true,
    enumerable: true,
    value: columns,
    writable: false,
  });

  return cast<Array<ParsedCsvRecord>, ParsedCsvRecords>(records);
};

/**
 * Pretty-print a JSON value as canonical JSON with a trailing newline.
 *
 * **Details**
 *
 * A target-facing alias for the package's canonical renderer so every generated
 * data file shares one byte-for-byte formatting definition.
 *
 * **Example** (Render a canonical payload)
 *
 * ```ts
 * import { formatJson } from "@beep/repo-cli/commands/SyncDataToTs/internal/Source"
 *
 * console.log(formatJson({ ok: true }) === `{\n  "ok": true\n}\n`) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const formatJson = formatJsonValue;

/**
 * Normalize a JSON-compatible value into Effect's canonical JSON model.
 *
 * @param targetId - The sync target whose canonical payload is being normalized.
 * @param value - A value accepted by the JSON string codec.
 * @returns The plain JSON value produced by encoding and decoding the input.
 * @category formatting
 * @since 0.0.0
 */
export const normalizeJson: {
  (value: unknown): (targetId: string) => Effect.Effect<S.Json, SyncDataToTsError>;
  (targetId: string, value: unknown): Effect.Effect<S.Json, SyncDataToTsError>;
} = dual(
  2,
  (targetId: string, value: unknown): Effect.Effect<S.Json, SyncDataToTsError> =>
    pipe(
      value,
      encodeUnknownJsonResult,
      Result.flatMap(decodeJsonTextResult),
      Effect.fromResult,
      SyncDataToTsError.mapError(`Failed to normalize canonical JSON for ${targetId}`, targetId)
    )
);

/**
 * Pretty-print a JSON-compatible value as a TypeScript literal.
 *
 * @param value - The JSON-compatible value to render.
 * @returns The value rendered as a TypeScript object literal.
 * @category formatting
 * @since 0.0.0
 */
export const formatTsLiteral = (value: unknown): string =>
  pipe(formatJson(value).trimEnd(), Str.replaceAll(/"([A-Za-z_$][A-Za-z0-9_$]*)":/g, "$1:"));

/**
 * Render untrusted source metadata as a single safe JSDoc block-comment line.
 *
 * @param value - The upstream string to include in a generated comment.
 * @returns A line-safe string that cannot terminate the surrounding comment.
 * @category formatting
 * @since 0.0.0
 */
export const formatTsDocCommentValue: (value: string) => string = flow(
  Str.replaceAll(/\*\//gu, "* /"),
  Str.replaceAll(/\r?\n/gu, " ")
);

/**
 * Create a generated output file value.
 *
 * @param path - The repo-relative output path for the generated file.
 * @param content - The generated file content.
 * @returns The generated output file value.
 * @category constructors
 * @since 0.0.0
 */
export const outputFile: {
  (content: string): (path: string) => SyncDataOutputFile;
  (path: string, content: string): SyncDataOutputFile;
} = dual(2, (path: string, content: string): SyncDataOutputFile => SyncDataOutputFile.make({ path, content }));

type SourceMetadataExtras = Partial<Pick<SyncDataSourceMetadata, "version" | "published">>;

/**
 * Create stable source metadata.
 *
 * **Gotchas**
 *
 * `extras` is required so the helper stays arity-dispatched: pass `{}` when the
 * source carries no version or published date.
 *
 * @param source - The fetched source to describe.
 * @param extras - Version and published-date metadata, possibly empty.
 * @returns Stable source metadata for the fetched source.
 * @category constructors
 * @since 0.0.0
 */
export const sourceMetadata: {
  (extras: SourceMetadataExtras): (source: SyncDataFetchedSource) => SyncDataSourceMetadata;
  (source: SyncDataFetchedSource, extras: SourceMetadataExtras): SyncDataSourceMetadata;
} = dual(
  2,
  (source: SyncDataFetchedSource, extras: SourceMetadataExtras): SyncDataSourceMetadata =>
    SyncDataSourceMetadata.make({
      id: source.id,
      url: source.url,
      sha256: source.sha256,
      ...extras,
    })
);

type FetchSourceOptions = {
  readonly headers?: Readonly<Record<string, string>>;
  readonly publicUrl?: string;
};

const readResponseBytes = Effect.fn("SyncDataToTs.readResponseBytes")(function* (
  response: HttpClientResponse.HttpClientResponse,
  targetId: string,
  url: string
) {
  const buffer = yield* response.arrayBuffer.pipe(
    SyncDataToTsError.mapError(`Failed to read response body from ${url}`, targetId)
  );
  return new Uint8Array(buffer);
});

const sha256Hex = Effect.fn("SyncDataToTs.sha256Hex")(function* (bytes: Uint8Array, targetId: string, url: string) {
  const crypto = yield* Crypto.Crypto;
  const digest = yield* crypto
    .digest("SHA-256", bytes)
    .pipe(SyncDataToTsError.mapError(`Failed to compute SHA-256 digest for ${url}`, targetId));
  return Encoding.encodeHex(digest);
});

/**
 * Fetch a source URL as bytes and text while computing a stable SHA-256 hash.
 *
 * @category getters
 * @since 0.0.0
 */
export const fetchSource = Effect.fn("SyncDataToTs.fetchSource")(function* (
  targetId: string,
  id: string,
  url: string,
  options: FetchSourceOptions = {}
): Effect.fn.Return<SyncDataFetchedSource, SyncDataToTsError, HttpClient.HttpClient | Crypto.Crypto> {
  const publicUrl = options.publicUrl ?? url;
  const response = yield* HttpClient.get(url, { headers: options.headers ?? {} }).pipe(
    SyncDataToTsError.mapError(`Failed to fetch ${publicUrl}`, targetId),
    Effect.flatMap((response) => HttpClientResponse.filterStatusOk(response)),
    SyncDataToTsError.mapError(`Received a non-2xx response from ${publicUrl}`, targetId)
  );
  const bytes = yield* readResponseBytes(response, targetId, publicUrl);
  const sha256 = yield* sha256Hex(bytes, targetId, publicUrl);

  return {
    id,
    url: publicUrl,
    bytes,
    text: textDecoder.decode(bytes),
    sha256,
  };
});

/**
 * Parse a fetched source as JSON.
 *
 * @param targetId - The sync target identifier used in error messages.
 * @param source - The fetched source to parse.
 * @returns The decoded JSON value.
 * @category parsing
 * @since 0.0.0
 */
export const parseJsonSource: {
  (targetId: string, source: SyncDataFetchedSource): Effect.Effect<unknown, SyncDataToTsError>;
  (source: SyncDataFetchedSource): (targetId: string) => Effect.Effect<unknown, SyncDataToTsError>;
} = dual(
  2,
  (targetId: string, source: SyncDataFetchedSource): Effect.Effect<unknown, SyncDataToTsError> =>
    decodeJsonText(source.text).pipe(
      SyncDataToTsError.mapError(`Failed to parse JSON payload for ${targetId}`, targetId)
    )
);

/**
 * Parse a fetched source as XML.
 *
 * @param targetId - The sync target identifier used in error messages.
 * @param source - The fetched source to parse.
 * @returns The decoded XML value.
 * @category parsing
 * @since 0.0.0
 */
export const parseXmlSource: {
  (targetId: string, source: SyncDataFetchedSource): Effect.Effect<unknown, SyncDataToTsError>;
  (source: SyncDataFetchedSource): (targetId: string) => Effect.Effect<unknown, SyncDataToTsError>;
} = dual(
  2,
  (targetId: string, source: SyncDataFetchedSource): Effect.Effect<unknown, SyncDataToTsError> =>
    decodeXmlText(source.text).pipe(SyncDataToTsError.mapError(`Failed to parse XML payload for ${targetId}`, targetId))
);

const decodeCsvText = Effect.fn("SyncDataToTs.decodeCsvText")(function* (content: string) {
  const rawRows = yield* parseCsvRows(content, defaultCsvParserOptions);

  return yield* A.match(rawRows, {
    onEmpty: () => Effect.succeed(attachCsvColumns([], [])),
    onNonEmpty: ([headerRow]) => {
      const rowFields: Record<string, typeof S.String> = pipe(
        headerRow,
        A.map((header) => [header, S.String] as const),
        R.fromEntries
      );

      class ParsedCsvRow extends S.Class<ParsedCsvRow>($I`ParsedCsvRow`)(
        rowFields,
        $I.annote("ParsedCsvRow", {
          description: "CSV row decoded with the runtime header columns from the source document.",
        })
      ) {}

      return S.decodeEffect(CSV({})(ParsedCsvRow))(content).pipe(
        Effect.map((rows) => attachCsvColumns(rows as ReadonlyArray<ParsedCsvRecord>, headerRow))
      );
    },
  });
});

/**
 * Parse a fetched source as CSV.
 *
 * @param targetId - The sync target identifier used in error messages.
 * @param source - The fetched source to parse.
 * @returns The parsed CSV records with their header columns attached.
 * @category parsing
 * @since 0.0.0
 */
export const parseCsvSource: {
  (targetId: string, source: SyncDataFetchedSource): Effect.Effect<ParsedCsvRecords, SyncDataToTsError>;
  (source: SyncDataFetchedSource): (targetId: string) => Effect.Effect<ParsedCsvRecords, SyncDataToTsError>;
} = dual(
  2,
  (targetId: string, source: SyncDataFetchedSource): Effect.Effect<ParsedCsvRecords, SyncDataToTsError> =>
    decodeCsvText(source.text).pipe(SyncDataToTsError.mapError(`Failed to parse CSV payload for ${targetId}`, targetId))
);
