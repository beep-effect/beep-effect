/**
 * JSON-LD document service contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SemanticWebId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { Context } from "effect";
import * as S from "effect/Schema";
import { AbsoluteIRI } from "../iri.ts";
import { JsonLdContext, JsonLdDocument, JsonLdFrame } from "../jsonld.ts";
import { Dataset } from "../rdf.ts";
import { makeSemanticSchemaMetadata } from "../semantic-schema-metadata.ts";
import type { Effect } from "effect";

const $I = $SemanticWebId.create("services/jsonld-document");

const serviceContractMetadata = (canonicalName: string, overview: string) =>
  makeSemanticSchemaMetadata({
    kind: "serviceContract",
    canonicalName,
    overview,
    status: "stable",
    specifications: [{ name: "JSON-LD 1.1", section: "Algorithms", disposition: "normative" }],
    equivalenceBasis: "Request and result wrappers compare by exact payload equality.",
    representations: [{ kind: "JSON-LD" }, { kind: "RDF/JS" }],
    canonicalizationRequired: true,
  });

/**
 * JSON-LD document error reason.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { JsonLdDocumentErrorReason } from "@beep/semantic-web/services/jsonld-document"
 *
 * const reason = S.decodeUnknownSync(JsonLdDocumentErrorReason)("loaderPolicyViolation")
 * strictEqual(reason, "loaderPolicyViolation")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JsonLdDocumentErrorReason = LiteralKit([
  "invalidNodeReference",
  "unknownPredicate",
  "bridgingFailure",
  "framingFailure",
  "loaderPolicyViolation",
  "normalizationFailure",
]).pipe(
  $I.annoteSchema("JsonLdDocumentErrorReason", {
    description: "JSON-LD document error reason.",
  })
);

/**
 * Typed JSON-LD document service error.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as O from "effect/Option"
 * import { JsonLdDocumentError } from "@beep/semantic-web/services/jsonld-document"
 *
 * const error = JsonLdDocumentError.make({
 *   reason: "loaderPolicyViolation",
 *   message: "Remote document loading is disabled for this workflow.",
 *   subject: O.none()
 * })
 * strictEqual(error.reason, "loaderPolicyViolation")
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class JsonLdDocumentError extends TaggedErrorClass<JsonLdDocumentError>($I`JsonLdDocumentError`)(
  "JsonLdDocumentError",
  {
    reason: JsonLdDocumentErrorReason,
    message: S.String,
    subject: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("JsonLdDocumentError", {
    description: "Typed JSON-LD document service error.",
    semanticSchemaMetadata: serviceContractMetadata("JsonLdDocumentError", "Typed JSON-LD document service error."),
  })
) {}

/**
 * Compact JSON-LD document request.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { CompactJsonLdDocumentRequest } from "@beep/semantic-web/services/jsonld-document"
 *
 * const request = S.decodeUnknownSync(CompactJsonLdDocumentRequest)({
 *   document: { "@graph": [] },
 *   context: { terms: { name: "https://schema.org/name" } }
 * })
 * strictEqual(request.context.terms.name, "https://schema.org/name")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CompactJsonLdDocumentRequest extends S.Class<CompactJsonLdDocumentRequest>(
  $I`CompactJsonLdDocumentRequest`
)(
  {
    document: JsonLdDocument,
    context: JsonLdContext,
  },
  $I.annote("CompactJsonLdDocumentRequest", {
    description: "Compact JSON-LD document request.",
    semanticSchemaMetadata: serviceContractMetadata(
      "CompactJsonLdDocumentRequest",
      "Request to compact a bounded JSON-LD document."
    ),
  })
) {}

/**
 * Flatten JSON-LD document request.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { FlattenJsonLdDocumentRequest } from "@beep/semantic-web/services/jsonld-document"
 *
 * const request = S.decodeUnknownSync(FlattenJsonLdDocumentRequest)({
 *   document: { "@graph": [] }
 * })
 * strictEqual(request.document["@graph"].length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FlattenJsonLdDocumentRequest extends S.Class<FlattenJsonLdDocumentRequest>(
  $I`FlattenJsonLdDocumentRequest`
)(
  {
    document: JsonLdDocument,
  },
  $I.annote("FlattenJsonLdDocumentRequest", {
    description: "Flatten JSON-LD document request.",
    semanticSchemaMetadata: serviceContractMetadata(
      "FlattenJsonLdDocumentRequest",
      "Request to flatten a bounded JSON-LD document."
    ),
  })
) {}

/**
 * Frame JSON-LD document request.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { FrameJsonLdDocumentRequest } from "@beep/semantic-web/services/jsonld-document"
 *
 * const request = S.decodeUnknownSync(FrameJsonLdDocumentRequest)({
 *   document: { "@graph": [] },
 *   frame: { "@type": "https://schema.org/Person", includeProperties: ["name"] }
 * })
 * strictEqual(request.document["@graph"].length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FrameJsonLdDocumentRequest extends S.Class<FrameJsonLdDocumentRequest>($I`FrameJsonLdDocumentRequest`)(
  {
    document: JsonLdDocument,
    frame: JsonLdFrame,
  },
  $I.annote("FrameJsonLdDocumentRequest", {
    description: "Frame JSON-LD document request.",
    semanticSchemaMetadata: serviceContractMetadata(
      "FrameJsonLdDocumentRequest",
      "Request to frame a bounded JSON-LD document."
    ),
  })
) {}

/**
 * Bounded JSON-LD document loader policy.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { JsonLdDocumentLoaderPolicy } from "@beep/semantic-web/services/jsonld-document"
 *
 * const policy = S.decodeUnknownSync(JsonLdDocumentLoaderPolicy)({
 *   allowRemoteDocuments: false,
 *   maxRemoteDocuments: 0,
 *   baseIri: "https://example.com/base/"
 * })
 * strictEqual(policy.allowRemoteDocuments, false)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsonLdDocumentLoaderPolicy extends S.Class<JsonLdDocumentLoaderPolicy>($I`JsonLdDocumentLoaderPolicy`)(
  {
    allowRemoteDocuments: S.Boolean,
    maxRemoteDocuments: S.OptionFromOptionalKey(NonNegativeInt).pipe(SchemaUtils.withNoneDefault),
    baseIri: S.OptionFromOptionalKey(AbsoluteIRI).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("JsonLdDocumentLoaderPolicy", {
    description: "Bounded JSON-LD document loader policy.",
    semanticSchemaMetadata: serviceContractMetadata(
      "JsonLdDocumentLoaderPolicy",
      "Bounded loader policy for JSON-LD document workflows."
    ),
  })
) {}

/**
 * JSON-LD document normalization profile.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { JsonLdDocumentNormalizationProfile } from "@beep/semantic-web/services/jsonld-document"
 *
 * const profile = S.decodeUnknownSync(JsonLdDocumentNormalizationProfile)("expanded-v1")
 * strictEqual(profile, "expanded-v1")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JsonLdDocumentNormalizationProfile = LiteralKit(["bounded-v1", "expanded-v1"]).pipe(
  $I.annoteSchema("JsonLdDocumentNormalizationProfile", {
    description: "JSON-LD document normalization profile.",
  })
);

/**
 * Type for {@link JsonLdDocumentNormalizationProfile}.
 *
 * @example
 * ```ts
 * import type { JsonLdDocumentNormalizationProfile } from "@beep/semantic-web/services/jsonld-document"
 *
 * const acceptJsonLdDocumentNormalizationProfile = (value: JsonLdDocumentNormalizationProfile) => value
 * console.log(acceptJsonLdDocumentNormalizationProfile)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type JsonLdDocumentNormalizationProfile = typeof JsonLdDocumentNormalizationProfile.Type;

/**
 * Expand JSON-LD document request.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { ExpandJsonLdDocumentRequest } from "@beep/semantic-web/services/jsonld-document"
 *
 * const request = S.decodeUnknownSync(ExpandJsonLdDocumentRequest)({
 *   document: { "@graph": [] },
 *   loaderPolicy: { allowRemoteDocuments: false }
 * })
 * strictEqual(request.document["@graph"].length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExpandJsonLdDocumentRequest extends S.Class<ExpandJsonLdDocumentRequest>($I`ExpandJsonLdDocumentRequest`)(
  {
    document: JsonLdDocument,
    loaderPolicy: S.OptionFromOptionalKey(JsonLdDocumentLoaderPolicy).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ExpandJsonLdDocumentRequest", {
    description: "Expand JSON-LD document request.",
    semanticSchemaMetadata: serviceContractMetadata(
      "ExpandJsonLdDocumentRequest",
      "Request to expand a bounded JSON-LD document with explicit loader policy."
    ),
  })
) {}

/**
 * Normalize JSON-LD document request.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { NormalizeJsonLdDocumentRequest } from "@beep/semantic-web/services/jsonld-document"
 *
 * const request = S.decodeUnknownSync(NormalizeJsonLdDocumentRequest)({
 *   document: { "@graph": [] },
 *   profile: "bounded-v1",
 *   safeMode: true
 * })
 * strictEqual(request.profile, "bounded-v1")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NormalizeJsonLdDocumentRequest extends S.Class<NormalizeJsonLdDocumentRequest>(
  $I`NormalizeJsonLdDocumentRequest`
)(
  {
    document: JsonLdDocument,
    profile: JsonLdDocumentNormalizationProfile,
    loaderPolicy: S.OptionFromOptionalKey(JsonLdDocumentLoaderPolicy).pipe(SchemaUtils.withNoneDefault),
    safeMode: S.OptionFromOptionalKey(S.Boolean),
  },
  $I.annote("NormalizeJsonLdDocumentRequest", {
    description: "Normalize JSON-LD document request.",
    semanticSchemaMetadata: serviceContractMetadata(
      "NormalizeJsonLdDocumentRequest",
      "Request to normalize a bounded JSON-LD document under an explicit output profile."
    ),
  })
) {}

/**
 * JSON-LD to RDF request.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { JsonLdToRdfRequest } from "@beep/semantic-web/services/jsonld-document"
 *
 * const request = S.decodeUnknownSync(JsonLdToRdfRequest)({
 *   document: { "@graph": [] }
 * })
 * strictEqual(request.document["@graph"].length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsonLdToRdfRequest extends S.Class<JsonLdToRdfRequest>($I`JsonLdToRdfRequest`)(
  {
    document: JsonLdDocument,
  },
  $I.annote("JsonLdToRdfRequest", {
    description: "JSON-LD to RDF request.",
    semanticSchemaMetadata: serviceContractMetadata(
      "JsonLdToRdfRequest",
      "Request to bridge a bounded JSON-LD document to RDF."
    ),
  })
) {}

/**
 * RDF to JSON-LD request.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { JsonLdFromRdfRequest } from "@beep/semantic-web/services/jsonld-document"
 *
 * const request = S.decodeUnknownSync(JsonLdFromRdfRequest)({
 *   dataset: { quads: [] },
 *   context: { terms: { name: "https://schema.org/name" } }
 * })
 * strictEqual(request.dataset.quads.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsonLdFromRdfRequest extends S.Class<JsonLdFromRdfRequest>($I`JsonLdFromRdfRequest`)(
  {
    dataset: Dataset,
    context: S.OptionFromOptionalKey(JsonLdContext).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("JsonLdFromRdfRequest", {
    description: "RDF to JSON-LD request.",
    semanticSchemaMetadata: serviceContractMetadata(
      "JsonLdFromRdfRequest",
      "Request to bridge RDF quads into a bounded JSON-LD document."
    ),
  })
) {}

/**
 * JSON-LD document result wrapper.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { JsonLdDocumentResult } from "@beep/semantic-web/services/jsonld-document"
 *
 * const result = S.decodeUnknownSync(JsonLdDocumentResult)({
 *   document: { "@graph": [] }
 * })
 * strictEqual(result.document["@graph"].length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsonLdDocumentResult extends S.Class<JsonLdDocumentResult>($I`JsonLdDocumentResult`)(
  {
    document: JsonLdDocument,
  },
  $I.annote("JsonLdDocumentResult", {
    description: "JSON-LD document result wrapper.",
    semanticSchemaMetadata: serviceContractMetadata("JsonLdDocumentResult", "JSON-LD document result wrapper."),
  })
) {}

/**
 * JSON-LD to RDF result wrapper.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { JsonLdToRdfResult } from "@beep/semantic-web/services/jsonld-document"
 *
 * const result = S.decodeUnknownSync(JsonLdToRdfResult)({
 *   dataset: { quads: [] }
 * })
 * strictEqual(result.dataset.quads.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsonLdToRdfResult extends S.Class<JsonLdToRdfResult>($I`JsonLdToRdfResult`)(
  {
    dataset: Dataset,
  },
  $I.annote("JsonLdToRdfResult", {
    description: "JSON-LD to RDF result wrapper.",
    semanticSchemaMetadata: serviceContractMetadata("JsonLdToRdfResult", "JSON-LD to RDF result wrapper."),
  })
) {}

/**
 * JSON-LD document service contract shape.
 *
 * @example
 * ```ts
 * import type { JsonLdDocumentServiceShape } from "@beep/semantic-web/services/jsonld-document"
 *
 * const acceptJsonLdDocumentServiceShape = (value: JsonLdDocumentServiceShape) => value
 * console.log(acceptJsonLdDocumentServiceShape)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface JsonLdDocumentServiceShape {
  readonly compact: (request: CompactJsonLdDocumentRequest) => Effect.Effect<JsonLdDocumentResult, JsonLdDocumentError>;
  readonly expand: (request: ExpandJsonLdDocumentRequest) => Effect.Effect<JsonLdDocumentResult, JsonLdDocumentError>;
  readonly flatten: (request: FlattenJsonLdDocumentRequest) => Effect.Effect<JsonLdDocumentResult, JsonLdDocumentError>;
  readonly frame: (request: FrameJsonLdDocumentRequest) => Effect.Effect<JsonLdDocumentResult, JsonLdDocumentError>;
  readonly fromRdf: (request: JsonLdFromRdfRequest) => Effect.Effect<JsonLdDocumentResult, JsonLdDocumentError>;
  readonly normalize: (
    request: NormalizeJsonLdDocumentRequest
  ) => Effect.Effect<JsonLdDocumentResult, JsonLdDocumentError>;
  readonly toRdf: (request: JsonLdToRdfRequest) => Effect.Effect<JsonLdToRdfResult, JsonLdDocumentError>;
}

/**
 * JSON-LD document service tag.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import {
 *   FlattenJsonLdDocumentRequest,
 *   JsonLdDocumentResult,
 *   JsonLdDocumentService
 * } from "@beep/semantic-web/services/jsonld-document"
 *
 * const request = S.decodeUnknownSync(FlattenJsonLdDocumentRequest)({
 *   document: { "@graph": [] }
 * })
 * const program = Effect.gen(function* () {
 *   const service = yield* JsonLdDocumentService
 *   return yield* service.flatten(request)
 * })
 *
 * const result = Effect.runSync(
 *   Effect.provideService(
 *     program,
 *     JsonLdDocumentService,
 *     JsonLdDocumentService.of({
 *       compact: () => Effect.die("not used"),
 *       expand: () => Effect.die("not used"),
 *       flatten: () => Effect.succeed(S.decodeUnknownSync(JsonLdDocumentResult)({ document: { "@graph": [] } })),
 *       frame: () => Effect.die("not used"),
 *       fromRdf: () => Effect.die("not used"),
 *       normalize: () => Effect.die("not used"),
 *       toRdf: () => Effect.die("not used")
 *     })
 *   )
 * )
 * strictEqual(result.document["@graph"].length, 0)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class JsonLdDocumentService extends Context.Service<JsonLdDocumentService, JsonLdDocumentServiceShape>()(
  $I`JsonLdDocumentService`
) {}
