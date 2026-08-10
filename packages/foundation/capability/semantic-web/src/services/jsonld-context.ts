/**
 * JSON-LD context service contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SemanticWebId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { Context } from "effect";
import * as S from "effect/Schema";
import { IRIReference } from "../iri.ts";
import { JsonLdContext } from "../jsonld.ts";
import { makeSemanticSchemaMetadata } from "../semantic-schema-metadata.ts";
import type { Effect } from "effect";

const $I = $SemanticWebId.create("services/jsonld-context");

const serviceContractMetadata = (canonicalName: string, overview: string) =>
  makeSemanticSchemaMetadata({
    kind: "serviceContract",
    canonicalName,
    overview,
    status: "stable",
    specifications: [{ name: "JSON-LD 1.1", section: "Context Processing", disposition: "normative" }],
    equivalenceBasis: "Request and result wrappers compare by exact payload equality.",
    representations: [{ kind: "JSON-LD" }],
  });

/**
 * JSON-LD context error reason.
 *
 * **Example** (Decode unknown term reason)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { JsonLdContextErrorReason } from "@beep/semantic-web/services/jsonld-context"
 *
 * const reason = S.decodeUnknownSync(JsonLdContextErrorReason)("unknownTerm")
 * strictEqual(reason, "unknownTerm")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JsonLdContextErrorReason = LiteralKit(["unknownTerm", "policyViolation", "compactionFailure"]).pipe(
  $I.annoteSchema("JsonLdContextErrorReason", {
    description: "JSON-LD context error reason.",
  })
);

/**
 * Type for {@link JsonLdContextErrorReason}.
 *
 * **Example** (Type-check unknown term reason)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { JsonLdContextErrorReason } from "@beep/semantic-web/services/jsonld-context"
 *
 * const reason: JsonLdContextErrorReason = "unknownTerm"
 * strictEqual(JsonLdContextErrorReason.is.unknownTerm(reason), true)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type JsonLdContextErrorReason = typeof JsonLdContextErrorReason.Type;

/**
 * Typed JSON-LD context service error.
 *
 * **Example** (Make context error instance)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as O from "effect/Option"
 * import { JsonLdContextError } from "@beep/semantic-web/services/jsonld-context"
 *
 * const error = JsonLdContextError.make({
 *   reason: "unknownTerm",
 *   message: "The term is not present in the active context.",
 *   subject: O.none()
 * })
 * strictEqual(error.reason, "unknownTerm")
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class JsonLdContextError extends TaggedErrorClass<JsonLdContextError>($I`JsonLdContextError`)(
  "JsonLdContextError",
  {
    reason: JsonLdContextErrorReason,
    subject: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    message: S.String,
  },
  $I.annote("JsonLdContextError", {
    description: "Typed JSON-LD context service error.",
    semanticSchemaMetadata: serviceContractMetadata("JsonLdContextError", "Typed JSON-LD context service error."),
  })
) {}

/**
 * Normalize JSON-LD context request.
 *
 * **Example** (Decode normalize context request)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { NormalizeJsonLdContextRequest } from "@beep/semantic-web/services/jsonld-context"
 *
 * const request = S.decodeUnknownSync(NormalizeJsonLdContextRequest)({
 *   context: {
 *     "@vocab": "https://schema.org/",
 *     terms: { name: "https://schema.org/name" }
 *   }
 * })
 * strictEqual(request.context.terms.name, "https://schema.org/name")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NormalizeJsonLdContextRequest extends S.Class<NormalizeJsonLdContextRequest>(
  $I`NormalizeJsonLdContextRequest`
)(
  {
    context: JsonLdContext,
  },
  $I.annote("NormalizeJsonLdContextRequest", {
    description: "Normalize JSON-LD context request.",
    semanticSchemaMetadata: serviceContractMetadata(
      "NormalizeJsonLdContextRequest",
      "Request to normalize a bounded JSON-LD context."
    ),
  })
) {}

/**
 * Expand JSON-LD term request.
 *
 * **Example** (Decode expand term request)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { ExpandJsonLdTermRequest } from "@beep/semantic-web/services/jsonld-context"
 *
 * const request = S.decodeUnknownSync(ExpandJsonLdTermRequest)({
 *   context: {
 *     terms: { name: "https://schema.org/name" }
 *   },
 *   term: "name"
 * })
 * strictEqual(request.term, "name")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExpandJsonLdTermRequest extends S.Class<ExpandJsonLdTermRequest>($I`ExpandJsonLdTermRequest`)(
  {
    context: JsonLdContext,
    term: S.NonEmptyString,
  },
  $I.annote("ExpandJsonLdTermRequest", {
    description: "Expand JSON-LD term request.",
    semanticSchemaMetadata: serviceContractMetadata(
      "ExpandJsonLdTermRequest",
      "Request to expand a bounded JSON-LD term."
    ),
  })
) {}

/**
 * Expand JSON-LD term result.
 *
 * **Example** (Decode expand term result)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { ExpandJsonLdTermResult } from "@beep/semantic-web/services/jsonld-context"
 *
 * const result = S.decodeUnknownSync(ExpandJsonLdTermResult)({
 *   term: "name",
 *   iri: "https://schema.org/name"
 * })
 * strictEqual(result.iri, "https://schema.org/name")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExpandJsonLdTermResult extends S.Class<ExpandJsonLdTermResult>($I`ExpandJsonLdTermResult`)(
  {
    term: S.NonEmptyString,
    iri: IRIReference,
  },
  $I.annote("ExpandJsonLdTermResult", {
    description: "Expand JSON-LD term result.",
    semanticSchemaMetadata: serviceContractMetadata("ExpandJsonLdTermResult", "Expanded bounded JSON-LD term result."),
  })
) {}

/**
 * Compact JSON-LD IRI request.
 *
 * **Example** (Decode compact IRI request)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { CompactJsonLdIriRequest } from "@beep/semantic-web/services/jsonld-context"
 *
 * const request = S.decodeUnknownSync(CompactJsonLdIriRequest)({
 *   context: {
 *     terms: { name: "https://schema.org/name" }
 *   },
 *   iri: "https://schema.org/name"
 * })
 * strictEqual(request.iri, "https://schema.org/name")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CompactJsonLdIriRequest extends S.Class<CompactJsonLdIriRequest>($I`CompactJsonLdIriRequest`)(
  {
    context: JsonLdContext,
    iri: IRIReference,
  },
  $I.annote("CompactJsonLdIriRequest", {
    description: "Compact JSON-LD IRI request.",
    semanticSchemaMetadata: serviceContractMetadata(
      "CompactJsonLdIriRequest",
      "Request to compact a bounded JSON-LD IRI."
    ),
  })
) {}

/**
 * Compact JSON-LD IRI result.
 *
 * **Example** (Decode compact IRI result)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { CompactJsonLdIriResult } from "@beep/semantic-web/services/jsonld-context"
 *
 * const result = S.decodeUnknownSync(CompactJsonLdIriResult)({
 *   iri: "https://schema.org/name",
 *   term: "name"
 * })
 * strictEqual(result.term, "name")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CompactJsonLdIriResult extends S.Class<CompactJsonLdIriResult>($I`CompactJsonLdIriResult`)(
  {
    iri: IRIReference,
    term: S.NonEmptyString,
  },
  $I.annote("CompactJsonLdIriResult", {
    description: "Compact JSON-LD IRI result.",
    semanticSchemaMetadata: serviceContractMetadata("CompactJsonLdIriResult", "Compacted bounded JSON-LD IRI result."),
  })
) {}

/**
 * Merge JSON-LD contexts request.
 *
 * **Example** (Decode merge contexts request)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { MergeJsonLdContextsRequest } from "@beep/semantic-web/services/jsonld-context"
 *
 * const request = S.decodeUnknownSync(MergeJsonLdContextsRequest)({
 *   left: { terms: { name: "https://schema.org/name" } },
 *   right: { terms: { knows: "https://schema.org/knows" } }
 * })
 * strictEqual(request.right.terms.knows, "https://schema.org/knows")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeJsonLdContextsRequest extends S.Class<MergeJsonLdContextsRequest>($I`MergeJsonLdContextsRequest`)(
  {
    left: JsonLdContext,
    right: JsonLdContext,
  },
  $I.annote("MergeJsonLdContextsRequest", {
    description: "Merge JSON-LD contexts request.",
    semanticSchemaMetadata: serviceContractMetadata(
      "MergeJsonLdContextsRequest",
      "Request to merge bounded JSON-LD contexts."
    ),
  })
) {}

/**
 * JSON-LD context service contract shape.
 *
 * **Example** (Accept service shape type)
 *
 * ```ts
 * import type { JsonLdContextServiceShape } from "@beep/semantic-web/services/jsonld-context"
 *
 * const acceptJsonLdContextServiceShape = (value: JsonLdContextServiceShape) => value
 * console.log(acceptJsonLdContextServiceShape)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface JsonLdContextServiceShape {
  readonly compactIri: (request: CompactJsonLdIriRequest) => Effect.Effect<CompactJsonLdIriResult, JsonLdContextError>;
  readonly expandTerm: (request: ExpandJsonLdTermRequest) => Effect.Effect<ExpandJsonLdTermResult, JsonLdContextError>;
  readonly merge: (request: MergeJsonLdContextsRequest) => Effect.Effect<JsonLdContext, JsonLdContextError>;
  readonly normalize: (request: NormalizeJsonLdContextRequest) => Effect.Effect<JsonLdContext, JsonLdContextError>;
}

/**
 * JSON-LD context service tag.
 *
 * **Example** (Provide expandTerm service mock)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import {
 *   ExpandJsonLdTermRequest,
 *   ExpandJsonLdTermResult,
 *   JsonLdContextService
 * } from "@beep/semantic-web/services/jsonld-context"
 *
 * const request = S.decodeUnknownSync(ExpandJsonLdTermRequest)({
 *   context: { terms: { name: "https://schema.org/name" } },
 *   term: "name"
 * })
 * const program = Effect.gen(function* () {
 *   const service = yield* JsonLdContextService
 *   return yield* service.expandTerm(request)
 * })
 *
 * const result = Effect.runSync(
 *   Effect.provideService(
 *     program,
 *     JsonLdContextService,
 *     JsonLdContextService.of({
 *       compactIri: () => Effect.die("not used"),
 *       expandTerm: () =>
 *         Effect.succeed(S.decodeUnknownSync(ExpandJsonLdTermResult)({ term: "name", iri: "https://schema.org/name" })),
 *       merge: () => Effect.die("not used"),
 *       normalize: () => Effect.die("not used")
 *     })
 *   )
 * )
 * strictEqual(result.iri, "https://schema.org/name")
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class JsonLdContextService extends Context.Service<JsonLdContextService, JsonLdContextServiceShape>()(
  $I`JsonLdContextService`
) {}
