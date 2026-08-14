/**
 * Minimal engine-agnostic SPARQL query service contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SemanticWebId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { Context, Effect, Layer } from "effect";
import * as S from "effect/Schema";
import { Dataset, Term } from "../rdf.ts";
import { makeSemanticSchemaMetadata } from "../semantic-schema-metadata.ts";

const $I = $SemanticWebId.create("services/sparql-query");

const serviceContractMetadata = (canonicalName: string, overview: string) =>
  makeSemanticSchemaMetadata({
    kind: "serviceContract",
    canonicalName,
    overview,
    status: "stable",
    specifications: [{ name: "SPARQL 1.1", disposition: "informative" }],
    equivalenceBasis: "Exact query and result equality within a bounded execution envelope.",
    representations: [{ kind: "RDF/JS" }],
  });

/**
 * Minimal v1 SPARQL profile.
 *
 * **Example** (Decode ask profile)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { SparqlQueryProfile } from "@beep/semantic-web/services/sparql-query"
 *
 * const profile = S.decodeUnknownSync(SparqlQueryProfile)("ask")
 * strictEqual(profile, "ask")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SparqlQueryProfile = LiteralKit(["select", "ask", "construct"]).pipe(
  $I.annoteSchema("SparqlQueryProfile", {
    description: "Minimal v1 SPARQL profile.",
  })
);

/**
 * Type for {@link SparqlQueryProfile}.
 *
 * **Example** (Check ask profile type)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { SparqlQueryProfile } from "@beep/semantic-web/services/sparql-query"
 *
 * const profile: SparqlQueryProfile = "ask"
 * strictEqual(SparqlQueryProfile.is.ask(profile), true)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type SparqlQueryProfile = typeof SparqlQueryProfile.Type;

/**
 * SPARQL query request.
 *
 * **Example** (Decode SPARQL request)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { SparqlQueryRequest } from "@beep/semantic-web/services/sparql-query"
 *
 * const request = S.decodeUnknownSync(SparqlQueryRequest)({
 *   query: "ASK { ?s ?p ?o }",
 *   profile: "ask",
 *   dataset: { quads: [] }
 * })
 * strictEqual(request.profile, "ask")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SparqlQueryRequest extends S.Class<SparqlQueryRequest>($I`SparqlQueryRequest`)(
  {
    query: S.NonEmptyString,
    profile: SparqlQueryProfile,
    dataset: Dataset,
    timeoutMs: S.OptionFromOptionalKey(NonNegativeInt).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SparqlQueryRequest", {
    description: "SPARQL query request.",
    semanticSchemaMetadata: serviceContractMetadata("SparqlQueryRequest", "SPARQL query request."),
  })
) {}

/**
 * SPARQL select result.
 *
 * **Example** (Make empty select result)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { SparqlSelectResult } from "@beep/semantic-web/services/sparql-query"
 *
 * const result = SparqlSelectResult.make({ profile: "select", rows: [] })
 * strictEqual(result.rows.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SparqlSelectResult extends S.Class<SparqlSelectResult>($I`SparqlSelectResult`)(
  {
    profile: S.Literal("select"),
    rows: S.Array(S.Record(S.String, Term)),
  },
  $I.annote("SparqlSelectResult", {
    description: "SPARQL select result.",
    semanticSchemaMetadata: serviceContractMetadata("SparqlSelectResult", "SPARQL select result."),
  })
) {}

/**
 * SPARQL ask result.
 *
 * **Example** (Make true ask result)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { SparqlAskResult } from "@beep/semantic-web/services/sparql-query"
 *
 * const result = SparqlAskResult.make({ profile: "ask", value: true })
 * strictEqual(result.value, true)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SparqlAskResult extends S.Class<SparqlAskResult>($I`SparqlAskResult`)(
  {
    profile: S.Literal("ask"),
    value: S.Boolean,
  },
  $I.annote("SparqlAskResult", {
    description: "SPARQL ask result.",
    semanticSchemaMetadata: serviceContractMetadata("SparqlAskResult", "SPARQL ask result."),
  })
) {}

/**
 * SPARQL construct result.
 *
 * **Example** (Decode construct result)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { SparqlConstructResult } from "@beep/semantic-web/services/sparql-query"
 *
 * const result = S.decodeUnknownSync(SparqlConstructResult)({
 *   profile: "construct",
 *   dataset: { quads: [] }
 * })
 * strictEqual(result.dataset.quads.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SparqlConstructResult extends S.Class<SparqlConstructResult>($I`SparqlConstructResult`)(
  {
    profile: S.Literal("construct"),
    dataset: Dataset,
  },
  $I.annote("SparqlConstructResult", {
    description: "SPARQL construct result.",
    semanticSchemaMetadata: serviceContractMetadata("SparqlConstructResult", "SPARQL construct result."),
  })
) {}

/**
 * SPARQL result union.
 *
 * **Example** (Decode ask result union)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { SparqlQueryResult } from "@beep/semantic-web/services/sparql-query"
 *
 * const result = S.decodeUnknownSync(SparqlQueryResult)({ profile: "ask", value: false })
 * strictEqual(result.profile, "ask")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SparqlQueryResult = S.Union([SparqlSelectResult, SparqlAskResult, SparqlConstructResult]).pipe(
  S.toTaggedUnion("profile"),
  $I.annoteSchema("SparqlQueryResult", {
    description: "SPARQL result union.",
  })
);

/**
 * Type for {@link SparqlQueryResult}.
 *
 * **Example** (Accept result union type)
 *
 * ```ts
 * import type { SparqlQueryResult } from "@beep/semantic-web/services/sparql-query"
 *
 * const acceptSparqlQueryResult = (value: SparqlQueryResult) => value
 * console.log(acceptSparqlQueryResult)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SparqlQueryResult = typeof SparqlQueryResult.Type;

/**
 * SPARQL query error reason.
 *
 * **Example** (Decode unsupported profile reason)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { SparqlQueryErrorReason } from "@beep/semantic-web/services/sparql-query"
 *
 * const reason = S.decodeUnknownSync(SparqlQueryErrorReason)("unsupportedProfile")
 * strictEqual(reason, "unsupportedProfile")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SparqlQueryErrorReason = LiteralKit(["unsupportedProfile", "unimplemented"]).pipe(
  $I.annoteSchema("SparqlQueryErrorReason", {
    description: "SPARQL query error reason.",
    semanticSchemaMetadata: serviceContractMetadata("SparqlQueryErrorReason", "SPARQL query error reason."),
  })
);

/**
 * Type for {@link SparqlQueryErrorReason}.
 *
 * **Example** (Check unsupported profile reason)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { SparqlQueryErrorReason } from "@beep/semantic-web/services/sparql-query"
 *
 * const reason: SparqlQueryErrorReason = "unsupportedProfile"
 * strictEqual(SparqlQueryErrorReason.is.unsupportedProfile(reason), true)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type SparqlQueryErrorReason = typeof SparqlQueryErrorReason.Type;

/**
 * Typed SPARQL query error.
 *
 * **Example** (Make unsupported profile error)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { SparqlQueryError } from "@beep/semantic-web/services/sparql-query"
 *
 * const error = SparqlQueryError.make({
 *   reason: "unsupportedProfile",
 *   message: "The adapter only supports ASK queries."
 * })
 * strictEqual(error.reason, "unsupportedProfile")
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SparqlQueryError extends S.TaggedError<SparqlQueryError>($I`SparqlQueryError`)(
  "SparqlQueryError",
  {
    reason: SparqlQueryErrorReason,
    message: S.String,
  },
  $I.annote("SparqlQueryError", {
    description: "Typed SPARQL query error.",
    semanticSchemaMetadata: serviceContractMetadata("SparqlQueryError", "Typed SPARQL query error."),
  })
) {}

/**
 * SPARQL query service contract shape.
 *
 * **Example** (Accept service shape type)
 *
 * ```ts
 * import type { SparqlQueryServiceShape } from "@beep/semantic-web/services/sparql-query"
 *
 * const acceptSparqlQueryServiceShape = (value: SparqlQueryServiceShape) => value
 * console.log(acceptSparqlQueryServiceShape)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface SparqlQueryServiceShape {
  readonly execute: (request: SparqlQueryRequest) => Effect.Effect<SparqlQueryResult, SparqlQueryError>;
}

/**
 * SPARQL query service tag.
 *
 * **Example** (Provide and execute service)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import {
 *   SparqlAskResult,
 *   SparqlQueryRequest,
 *   SparqlQueryService
 * } from "@beep/semantic-web/services/sparql-query"
 *
 * const request = S.decodeUnknownSync(SparqlQueryRequest)({
 *   query: "ASK { ?s ?p ?o }",
 *   profile: "ask",
 *   dataset: { quads: [] }
 * })
 * const program = Effect.gen(function* () {
 *   const service = yield* SparqlQueryService
 *   return yield* service.execute(request)
 * })
 *
 * const result = Effect.runSync(
 *   Effect.provideService(
 *     program,
 *     SparqlQueryService,
 *     SparqlQueryService.of({
 *       execute: () => Effect.succeed(SparqlAskResult.make({ profile: "ask", value: true }))
 *     })
 *   )
 * )
 * strictEqual(result.profile, "ask")
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SparqlQueryService extends Context.Service<SparqlQueryService, SparqlQueryServiceShape>()(
  $I`SparqlQueryService`
) {}

/**
 * Unsupported default live layer for the minimal v1 SPARQL contract.
 *
 * **Example** (Run unimplemented live layer)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import {
 *   SparqlQueryRequest,
 *   SparqlQueryService,
 *   UnsupportedSparqlQueryServiceLive
 * } from "@beep/semantic-web/services/sparql-query"
 *
 * const request = S.decodeUnknownSync(SparqlQueryRequest)({
 *   query: "ASK { ?s ?p ?o }",
 *   profile: "ask",
 *   dataset: { quads: [] }
 * })
 * const error = Effect.runSync(
 *   Effect.gen(function* () {
 *     const service = yield* SparqlQueryService
 *     return yield* Effect.flip(service.execute(request))
 *   }).pipe(Effect.provide(UnsupportedSparqlQueryServiceLive))
 * )
 * strictEqual(error.reason, "unimplemented")
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const UnsupportedSparqlQueryServiceLive = Layer.succeed(
  SparqlQueryService,
  SparqlQueryService.of({
    execute: Effect.fn("SparqlQueryService.execute")(() =>
      Effect.fail(
        SparqlQueryError.make({
          reason: "unimplemented",
          message: "No SPARQL engine is wired into the v1 semantic-web package.",
        })
      )
    ),
  })
);
