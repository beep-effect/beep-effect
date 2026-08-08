/**
 * JSON-LD streaming serialize service contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SemanticWebId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, PosInt, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { Context } from "effect";
import * as S from "effect/Schema";
import { JsonLdContext } from "../jsonld.ts";
import { Dataset } from "../rdf.ts";
import { makeSemanticSchemaMetadata } from "../semantic-schema-metadata.ts";
import { JsonLdStreamMode } from "./jsonld-stream-parse.ts";
import type { Effect } from "effect";

const $I = $SemanticWebId.create("services/jsonld-stream-serialize");

const serviceContractMetadata = (canonicalName: string, overview: string) =>
  makeSemanticSchemaMetadata({
    kind: "serviceContract",
    canonicalName,
    overview,
    status: "stable",
    specifications: [{ name: "JSON-LD 1.1", section: "Streaming Serialize", disposition: "informative" }],
    equivalenceBasis: "Request and result wrappers compare by exact payload equality.",
    representations: [{ kind: "RDF/JS" }, { kind: "JSON-LD" }],
    canonicalizationRequired: false,
    implementationNotes: [
      "The initial adapter may report buffered-fallback mode instead of true streaming.",
      "Whole-document behaviors such as RDF list recovery or global deduplication remain out of scope for this seam.",
    ],
  });

/**
 * Streaming serialize request.
 *
 * **Example** (Decode serialize request)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { JsonLdStreamSerializeRequest } from "@beep/semantic-web/services/jsonld-stream-serialize"
 *
 * const request = S.decodeUnknownSync(JsonLdStreamSerializeRequest)({
 *   dataset: { quads: [] },
 *   context: { terms: { name: "https://schema.org/name" } },
 *   maxChunkCharacters: 128
 * })
 * strictEqual(request.dataset.quads.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsonLdStreamSerializeRequest extends S.Class<JsonLdStreamSerializeRequest>(
  $I`JsonLdStreamSerializeRequest`
)(
  {
    dataset: Dataset,
    context: S.OptionFromOptionalKey(JsonLdContext).pipe(SchemaUtils.withNoneDefault),
    maxChunkCharacters: S.OptionFromOptionalKey(PosInt).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("JsonLdStreamSerializeRequest", {
    description: "Streaming serialize request.",
    semanticSchemaMetadata: serviceContractMetadata(
      "JsonLdStreamSerializeRequest",
      "Request to serialize a bounded RDF dataset into JSON-LD text chunks."
    ),
  })
) {}

/**
 * Streaming serialize result.
 *
 * **Example** (Decode serialize result)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { JsonLdStreamSerializeResult } from "@beep/semantic-web/services/jsonld-stream-serialize"
 *
 * const result = S.decodeUnknownSync(JsonLdStreamSerializeResult)({
 *   chunks: ["{\"@graph\":[]}"],
 *   mode: "buffered-fallback",
 *   chunkCount: 1
 * })
 * strictEqual(result.chunks.length, 1)
 * ```
 *
 * @category streams
 * @since 0.0.0
 */
export class JsonLdStreamSerializeResult extends S.Class<JsonLdStreamSerializeResult>($I`JsonLdStreamSerializeResult`)(
  {
    chunks: S.NonEmptyArray(S.String),
    mode: JsonLdStreamMode,
    chunkCount: NonNegativeInt,
  },
  $I.annote("JsonLdStreamSerializeResult", {
    description: "Streaming serialize result.",
    semanticSchemaMetadata: serviceContractMetadata(
      "JsonLdStreamSerializeResult",
      "Bounded streaming serialize result containing JSON-LD text chunks and adapter mode."
    ),
  })
) {}

/**
 * Streaming serialize error reason.
 *
 * **Example** (Decode error reason)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { JsonLdStreamSerializeErrorReason } from "@beep/semantic-web/services/jsonld-stream-serialize"
 *
 * const reason = S.decodeUnknownSync(JsonLdStreamSerializeErrorReason)("invalidChunkSize")
 * strictEqual(reason, "invalidChunkSize")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JsonLdStreamSerializeErrorReason = LiteralKit(["serializeFailure", "invalidChunkSize"]).pipe(
  $I.annoteSchema("JsonLdStreamSerializeErrorReason", {
    description: "Streaming serialize error reason.",
  })
);

/**
 * Type for {@link JsonLdStreamSerializeErrorReason}.
 *
 * **Example** (Check reason type guard)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { JsonLdStreamSerializeErrorReason } from "@beep/semantic-web/services/jsonld-stream-serialize"
 *
 * const reason: JsonLdStreamSerializeErrorReason = "invalidChunkSize"
 * strictEqual(JsonLdStreamSerializeErrorReason.is.invalidChunkSize(reason), true)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type JsonLdStreamSerializeErrorReason = typeof JsonLdStreamSerializeErrorReason.Type;

/**
 * Typed streaming serialize error.
 *
 * **Example** (Make serialize error)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { JsonLdStreamSerializeError } from "@beep/semantic-web/services/jsonld-stream-serialize"
 *
 * const error = JsonLdStreamSerializeError.make({
 *   reason: "invalidChunkSize",
 *   message: "maxChunkCharacters must be positive."
 * })
 * strictEqual(error.reason, "invalidChunkSize")
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class JsonLdStreamSerializeError extends TaggedErrorClass<JsonLdStreamSerializeError>(
  $I`JsonLdStreamSerializeError`
)(
  "JsonLdStreamSerializeError",
  {
    reason: JsonLdStreamSerializeErrorReason,
    message: S.String,
  },
  $I.annote("JsonLdStreamSerializeError", {
    description: "Typed streaming serialize error.",
    semanticSchemaMetadata: serviceContractMetadata(
      "JsonLdStreamSerializeError",
      "Typed streaming serialize error for bounded JSON-LD stream serialization."
    ),
  })
) {}

/**
 * JSON-LD streaming serialize service contract shape.
 *
 * **Example** (Accept service shape)
 *
 * ```ts
 * import type { JsonLdStreamSerializeServiceShape } from "@beep/semantic-web/services/jsonld-stream-serialize"
 *
 * const acceptJsonLdStreamSerializeServiceShape = (value: JsonLdStreamSerializeServiceShape) => value
 * console.log(acceptJsonLdStreamSerializeServiceShape)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface JsonLdStreamSerializeServiceShape {
  readonly serialize: (
    request: JsonLdStreamSerializeRequest
  ) => Effect.Effect<JsonLdStreamSerializeResult, JsonLdStreamSerializeError>;
}

/**
 * JSON-LD streaming serialize service tag.
 *
 * **Example** (Provide mock serialize service)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import {
 *   JsonLdStreamSerializeRequest,
 *   JsonLdStreamSerializeResult,
 *   JsonLdStreamSerializeService
 * } from "@beep/semantic-web/services/jsonld-stream-serialize"
 *
 * const request = S.decodeUnknownSync(JsonLdStreamSerializeRequest)({
 *   dataset: { quads: [] },
 *   maxChunkCharacters: 128
 * })
 * const program = Effect.gen(function* () {
 *   const service = yield* JsonLdStreamSerializeService
 *   return yield* service.serialize(request)
 * })
 *
 * const result = Effect.runSync(
 *   Effect.provideService(
 *     program,
 *     JsonLdStreamSerializeService,
 *     JsonLdStreamSerializeService.of({
 *       serialize: () =>
 *         Effect.succeed(
 *           S.decodeUnknownSync(JsonLdStreamSerializeResult)({
 *             chunks: ["{\"@graph\":[]}"],
 *             mode: "buffered-fallback",
 *             chunkCount: 1
 *           })
 *         )
 *     })
 *   )
 * )
 * strictEqual(result.chunkCount, 1)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class JsonLdStreamSerializeService extends Context.Service<
  JsonLdStreamSerializeService,
  JsonLdStreamSerializeServiceShape
>()($I`JsonLdStreamSerializeService`) {}
