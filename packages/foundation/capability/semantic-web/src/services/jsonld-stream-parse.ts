/**
 * JSON-LD streaming parse service contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SemanticWebId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { Context } from "effect";
import * as S from "effect/Schema";
import { Dataset } from "../rdf.ts";
import { makeSemanticSchemaMetadata } from "../semantic-schema-metadata.ts";
import { JsonLdDocumentLoaderPolicy } from "./jsonld-document.ts";
import type { Effect } from "effect";

const $I = $SemanticWebId.create("services/jsonld-stream-parse");

const serviceContractMetadata = (canonicalName: string, overview: string) =>
  makeSemanticSchemaMetadata({
    kind: "serviceContract",
    canonicalName,
    overview,
    status: "stable",
    specifications: [{ name: "JSON-LD 1.1", section: "Streaming Parse", disposition: "informative" }],
    equivalenceBasis: "Request and result wrappers compare by exact payload equality.",
    representations: [{ kind: "JSON-LD" }, { kind: "RDF/JS" }],
    canonicalizationRequired: false,
    implementationNotes: [
      "The initial adapter may report buffered-fallback mode instead of true streaming.",
      "Remote context loading remains policy-controlled and may be rejected by bounded adapters.",
    ],
  });

/**
 * Streaming adapter mode.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { JsonLdStreamMode } from "@beep/semantic-web/services/jsonld-stream-parse"
 *
 * const mode = S.decodeUnknownSync(JsonLdStreamMode)("buffered-fallback")
 * strictEqual(mode, "buffered-fallback")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JsonLdStreamMode = LiteralKit(["true-streaming", "buffered-fallback"]).pipe(
  $I.annoteSchema("JsonLdStreamMode", {
    description: "Streaming adapter mode.",
  })
);

/**
 * Type for {@link JsonLdStreamMode}.
 *
 * @example
 * ```ts
 * import type { JsonLdStreamMode } from "@beep/semantic-web/services/jsonld-stream-parse"
 *
 * const acceptJsonLdStreamMode = (value: JsonLdStreamMode) => value
 * console.log(acceptJsonLdStreamMode)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type JsonLdStreamMode = typeof JsonLdStreamMode.Type;

/**
 * JSON-LD UTF-8 text chunk stream.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { JsonLdTextChunkStream } from "@beep/semantic-web/services/jsonld-stream-parse"
 *
 * const input = S.decodeUnknownSync(JsonLdTextChunkStream)({
 *   kind: "text",
 *   encoding: "utf-8",
 *   chunks: ["{\"@graph\":[]}"]
 * })
 * strictEqual(input.chunks.length, 1)
 * ```
 *
 * @category streams
 * @since 0.0.0
 */
export class JsonLdTextChunkStream extends S.Class<JsonLdTextChunkStream>($I`JsonLdTextChunkStream`)(
  {
    kind: S.Literal("text"),
    encoding: S.Literal("utf-8"),
    chunks: S.NonEmptyArray(S.String),
  },
  $I.annote("JsonLdTextChunkStream", {
    description: "JSON-LD UTF-8 text chunk stream.",
    semanticSchemaMetadata: serviceContractMetadata(
      "JsonLdTextChunkStream",
      "Bounded UTF-8 text chunks used as a JSON-LD streaming parse input."
    ),
  })
) {}

/**
 * JSON-LD UTF-8 byte chunk stream.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { JsonLdByteChunkStream } from "@beep/semantic-web/services/jsonld-stream-parse"
 *
 * const input = S.decodeUnknownSync(JsonLdByteChunkStream)({
 *   kind: "bytes",
 *   encoding: "utf-8",
 *   chunks: [new TextEncoder().encode("{\"@graph\":[]}")]
 * })
 * strictEqual(input.encoding, "utf-8")
 * ```
 *
 * @category streams
 * @since 0.0.0
 */
export class JsonLdByteChunkStream extends S.Class<JsonLdByteChunkStream>($I`JsonLdByteChunkStream`)(
  {
    kind: S.Literal("bytes"),
    encoding: S.Literal("utf-8"),
    chunks: S.NonEmptyArray(S.Uint8Array),
  },
  $I.annote("JsonLdByteChunkStream", {
    description: "JSON-LD UTF-8 byte chunk stream.",
    semanticSchemaMetadata: serviceContractMetadata(
      "JsonLdByteChunkStream",
      "Bounded UTF-8 byte chunks used as a JSON-LD streaming parse input."
    ),
  })
) {}

/**
 * Streaming parse input union.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { JsonLdStreamParseInput } from "@beep/semantic-web/services/jsonld-stream-parse"
 *
 * const input = S.decodeUnknownSync(JsonLdStreamParseInput)({
 *   kind: "text",
 *   encoding: "utf-8",
 *   chunks: ["{\"@graph\":[]}"]
 * })
 * strictEqual(input.kind, "text")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JsonLdStreamParseInput = S.Union([JsonLdTextChunkStream, JsonLdByteChunkStream]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("JsonLdStreamParseInput", {
    description: "Streaming parse input union.",
  })
);

/**
 * Type for {@link JsonLdStreamParseInput}.
 *
 * @example
 * ```ts
 * import type { JsonLdStreamParseInput } from "@beep/semantic-web/services/jsonld-stream-parse"
 *
 * const acceptJsonLdStreamParseInput = (value: JsonLdStreamParseInput) => value
 * console.log(acceptJsonLdStreamParseInput)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type JsonLdStreamParseInput = typeof JsonLdStreamParseInput.Type;

/**
 * Streaming parse request.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { JsonLdStreamParseRequest } from "@beep/semantic-web/services/jsonld-stream-parse"
 *
 * const request = S.decodeUnknownSync(JsonLdStreamParseRequest)({
 *   input: {
 *     kind: "text",
 *     encoding: "utf-8",
 *     chunks: ["{\"@graph\":[]}"]
 *   },
 *   loaderPolicy: { allowRemoteDocuments: false }
 * })
 * strictEqual(request.input.kind, "text")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsonLdStreamParseRequest extends S.Class<JsonLdStreamParseRequest>($I`JsonLdStreamParseRequest`)(
  {
    input: JsonLdStreamParseInput,
    loaderPolicy: S.OptionFromOptionalKey(JsonLdDocumentLoaderPolicy).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("JsonLdStreamParseRequest", {
    description: "Streaming parse request.",
    semanticSchemaMetadata: serviceContractMetadata(
      "JsonLdStreamParseRequest",
      "Request to parse a bounded JSON-LD text or byte stream into RDF data."
    ),
  })
) {}

/**
 * Streaming parse result.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { JsonLdStreamParseResult } from "@beep/semantic-web/services/jsonld-stream-parse"
 *
 * const result = S.decodeUnknownSync(JsonLdStreamParseResult)({
 *   dataset: { quads: [] },
 *   mode: "buffered-fallback",
 *   chunkCount: 1
 * })
 * strictEqual(result.chunkCount, 1)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsonLdStreamParseResult extends S.Class<JsonLdStreamParseResult>($I`JsonLdStreamParseResult`)(
  {
    dataset: Dataset,
    mode: JsonLdStreamMode,
    chunkCount: NonNegativeInt,
  },
  $I.annote("JsonLdStreamParseResult", {
    description: "Streaming parse result.",
    semanticSchemaMetadata: serviceContractMetadata(
      "JsonLdStreamParseResult",
      "Bounded streaming parse result containing RDF data and adapter mode."
    ),
  })
) {}

/**
 * Streaming parse error reason.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { JsonLdStreamParseErrorReason } from "@beep/semantic-web/services/jsonld-stream-parse"
 *
 * const reason = S.decodeUnknownSync(JsonLdStreamParseErrorReason)("parseFailure")
 * strictEqual(reason, "parseFailure")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JsonLdStreamParseErrorReason = LiteralKit([
  "parseFailure",
  "loaderPolicyViolation",
  "unsupportedEncoding",
]).pipe(
  $I.annoteSchema("JsonLdStreamParseErrorReason", {
    description: "Streaming parse error reason.",
  })
);

/**
 * Typed streaming parse error.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { JsonLdStreamParseError } from "@beep/semantic-web/services/jsonld-stream-parse"
 *
 * const error = JsonLdStreamParseError.make({
 *   reason: "unsupportedEncoding",
 *   message: "Only UTF-8 chunks are accepted."
 * })
 * strictEqual(error.reason, "unsupportedEncoding")
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class JsonLdStreamParseError extends TaggedErrorClass<JsonLdStreamParseError>($I`JsonLdStreamParseError`)(
  "JsonLdStreamParseError",
  {
    reason: JsonLdStreamParseErrorReason,
    message: S.String,
  },
  $I.annote("JsonLdStreamParseError", {
    description: "Typed streaming parse error.",
    semanticSchemaMetadata: serviceContractMetadata(
      "JsonLdStreamParseError",
      "Typed streaming parse error for bounded JSON-LD stream parsing."
    ),
  })
) {}

/**
 * JSON-LD streaming parse service contract shape.
 *
 * @example
 * ```ts
 * import type { JsonLdStreamParseServiceShape } from "@beep/semantic-web/services/jsonld-stream-parse"
 *
 * const acceptJsonLdStreamParseServiceShape = (value: JsonLdStreamParseServiceShape) => value
 * console.log(acceptJsonLdStreamParseServiceShape)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface JsonLdStreamParseServiceShape {
  readonly parse: (request: JsonLdStreamParseRequest) => Effect.Effect<JsonLdStreamParseResult, JsonLdStreamParseError>;
}

/**
 * JSON-LD streaming parse service tag.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import {
 *   JsonLdStreamParseRequest,
 *   JsonLdStreamParseResult,
 *   JsonLdStreamParseService
 * } from "@beep/semantic-web/services/jsonld-stream-parse"
 *
 * const request = S.decodeUnknownSync(JsonLdStreamParseRequest)({
 *   input: { kind: "text", encoding: "utf-8", chunks: ["{\"@graph\":[]}"] }
 * })
 * const program = Effect.gen(function* () {
 *   const service = yield* JsonLdStreamParseService
 *   return yield* service.parse(request)
 * })
 *
 * const result = Effect.runSync(
 *   Effect.provideService(
 *     program,
 *     JsonLdStreamParseService,
 *     JsonLdStreamParseService.of({
 *       parse: () =>
 *         Effect.succeed(
 *           S.decodeUnknownSync(JsonLdStreamParseResult)({
 *             dataset: { quads: [] },
 *             mode: "buffered-fallback",
 *             chunkCount: 1
 *           })
 *         )
 *     })
 *   )
 * )
 * strictEqual(result.mode, "buffered-fallback")
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class JsonLdStreamParseService extends Context.Service<
  JsonLdStreamParseService,
  JsonLdStreamParseServiceShape
>()($I`JsonLdStreamParseService`) {}
