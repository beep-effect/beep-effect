/**
 * Runtime models for API documentation catalog entries and sources.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ApiDocsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Data, Tuple } from "effect";
import * as S from "effect/Schema";
import type { SpecDialect } from "@beep/codegen-kit/CodegenKit.models";
import type { HttpApi, HttpApiGroup } from "effect/unstable/httpapi";

const $I = $ApiDocsId.create("Catalog.models");

/**
 * Literal domain that separates APIs served by this repository from external APIs it consumes.
 *
 * **Example** (Identify a served API)
 *
 * ```ts
 * import { ApiAudience } from "@beep/api-docs/src/Catalog.models"
 *
 * console.log(ApiAudience.is.served("served")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ApiAudience = LiteralKit(["served", "consumed"]).pipe(
  $I.annoteSchema("ApiAudience", {
    description: "Whether this repository serves an API or consumes an external API.",
  }),
  SchemaUtils.withStatics((schema) => ({
    makeCatalogEntryMetaMember: <T extends typeof schema.Type>({ literal }: S.Literal<T>) =>
      S.Struct({
        audience: S.tag(literal),
        slug: CatalogSlug,
        title: S.NonEmptyString,
        description: S.NonEmptyString,
      }),
  }))
);

/** On-disk serialization format for a committed specification. */
const SpecFormat = LiteralKit(["json", "yaml"]).annotate(
  $I.annote("SpecFormat", {
    description: "Serialization format preserved when the lab serves a committed specification.",
  })
);

/**
 * JSON or YAML serialization format accepted by committed specification entries.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SpecFormat = typeof SpecFormat.Type;

const catalogSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/**
 * Branded lowercase kebab-case identifier used to build catalog route paths.
 *
 * **Example** (Create a catalog slug)
 *
 * ```ts
 * import { CatalogSlug } from "@beep/api-docs/src/Catalog.models"
 *
 * const slug = CatalogSlug.make("qa-collector")
 *
 * console.log(slug) // "qa-collector"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CatalogSlug = S.String.check(
  S.isPattern(catalogSlugPattern, {
    identifier: $I`CatalogSlugPattern`,
    title: "Catalog slug syntax",
    description: "A non-empty lowercase kebab-case API catalog identifier.",
    message: "Catalog slugs must use lowercase kebab-case syntax.",
  })
).pipe(
  S.brand("CatalogSlug"),
  $I.annoteSchema("CatalogSlug", {
    description: "Branded lowercase kebab-case identifier used in API docs routes.",
  })
);

/**
 * Decoded branded route identifier produced by {@link CatalogSlug}.
 *
 * @see {@link CatalogSlug} for validation and construction.
 * @category type-level
 * @since 0.0.0
 */
export type CatalogSlug = typeof CatalogSlug.Type;

/**
 * Route identity and index-page copy shared by contract and committed-spec entries.
 *
 * **Example** (Describe a catalog entry)
 *
 * ```ts
 * import { CatalogEntryMeta, CatalogSlug } from "@beep/api-docs/src/Catalog.models"
 *
 * const meta = CatalogEntryMeta.cases.served.make({
 *   slug: CatalogSlug.make("example-api"),
 *   title: "Example API",
 *   description: "Example contract used in API documentation."
 * })
 *
 * console.log(meta.title) // "Example API"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CatalogEntryMeta = ApiAudience.mapMembers(
  Tuple.evolve([ApiAudience.makeCatalogEntryMetaMember, ApiAudience.makeCatalogEntryMetaMember])
).pipe(
  S.toTaggedUnion("audience"),
  $I.annoteSchema("CatalogEntryMeta", {
    description: "Route identity and index-page copy for one API docs catalog entry.",
  })
);

/**
 * Decoded route metadata produced by {@link CatalogEntryMeta}.
 *
 * @see {@link CatalogEntryMeta} for validation and construction.
 * @category type-level
 * @since 0.0.0
 */
export type CatalogEntryMeta = typeof CatalogEntryMeta.Type;

/**
 * Runtime source variants for generated `HttpApi` contracts and committed specification files.
 *
 * **Details**
 *
 * The contract variant retains its concrete `HttpApi` type through `withApi`; `HttpApi` values cannot be modeled by Schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CatalogSource = Data.TaggedEnum<{
  readonly ContractSource: {
    readonly api: HttpApi.Constraint;
    readonly withApi: <A>(
      f: <Id extends string, Groups extends HttpApiGroup.Constraint>(api: HttpApi.HttpApi<Id, Groups>) => A
    ) => A;
  };
  readonly SpecSource: {
    readonly specPath: string;
    readonly dialect: SpecDialect;
    readonly format: SpecFormat;
  };
}>;

/**
 * Tagged constructors and exhaustive matchers for runtime catalog sources.
 *
 * **Example** (Describe a committed specification)
 *
 * ```ts
 * import { CatalogSource } from "@beep/api-docs/src/Catalog.models"
 *
 * const source = CatalogSource.SpecSource({
 *   specPath: "packages/example/openapi.json",
 *   dialect: "openapi-3.0",
 *   format: "json"
 * })
 *
 * console.log(source._tag) // "SpecSource"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const CatalogSource = Data.taggedEnum<CatalogSource>();

/**
 * Wraps a concrete `HttpApi` while preserving its identifier and group types behind the heterogeneous catalog boundary.
 *
 * **Example** (Wrap an HttpApi contract)
 *
 * ```ts
 * import { makeContractSource } from "@beep/api-docs/src/Catalog.models"
 * import { HttpApi } from "effect/unstable/httpapi"
 *
 * const source = makeContractSource(HttpApi.make("example-api"))
 *
 * console.log(source._tag) // "ContractSource"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeContractSource = <Id extends string, Groups extends HttpApiGroup.Constraint>(
  api: HttpApi.HttpApi<Id, Groups>
): Extract<CatalogSource, { readonly _tag: "ContractSource" }> =>
  CatalogSource.ContractSource({
    api,
    withApi: (f) => f(api),
  });

/**
 * Pairs schema-backed metadata with the runtime contract or file that supplies its specification.
 *
 * **Example** (Create a file-backed entry)
 *
 * ```ts
 * import {
 *   CatalogEntry,
 *   CatalogEntryMeta,
 *   CatalogSlug,
 *   CatalogSource
 * } from "@beep/api-docs/src/Catalog.models"
 *
 * const entry = new CatalogEntry({
 *   meta: CatalogEntryMeta.cases.consumed.make({
 *     slug: CatalogSlug.make("example-api"),
 *     title: "Example API",
 *     description: "Committed API specification."
 *   }),
 *   source: CatalogSource.SpecSource({
 *     specPath: "packages/example/openapi.json",
 *     dialect: "openapi-3.0",
 *     format: "json"
 *   })
 * })
 *
 * console.log(entry.meta.slug) // "example-api"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CatalogEntry extends Data.Class<{
  readonly meta: CatalogEntryMeta;
  readonly source: CatalogSource;
}> {}
