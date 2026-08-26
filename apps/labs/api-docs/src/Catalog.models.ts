import { $ApiDocsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Data } from "effect";
import * as S from "effect/Schema";
import type { SpecDialect } from "@beep/codegen-kit/CodegenKit.models";
import type { HttpApi, HttpApiGroup } from "effect/unstable/httpapi";

const $I = $ApiDocsId.create("Catalog.models");

/** Catalog grouping for APIs hosted by this repository and APIs it consumes. */
export const ApiAudience = LiteralKit(["served", "consumed"]).annotate(
  $I.annote("ApiAudience", {
    description: "Whether this repository serves an API or consumes an external API.",
  })
);

/** On-disk serialization format for a committed specification. */
const SpecFormat = LiteralKit(["json", "yaml"]).annotate(
  $I.annote("SpecFormat", {
    description: "Serialization format preserved when the lab serves a committed specification.",
  })
);

/** Runtime format represented by {@link SpecFormat}. */
export type SpecFormat = typeof SpecFormat.Type;

const catalogSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** Branded lowercase kebab-case identifier used in catalog routes. */
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

/** Runtime slug represented by {@link CatalogSlug}. */
export type CatalogSlug = typeof CatalogSlug.Type;

/** Human-readable metadata shared by contract and committed-spec entries. */
export class CatalogEntryMeta extends S.Class<CatalogEntryMeta>($I`CatalogEntryMeta`)(
  {
    slug: CatalogSlug,
    title: S.NonEmptyString,
    description: S.NonEmptyString,
    audience: ApiAudience,
  },
  $I.annote("CatalogEntryMeta", {
    description: "Route identity and index-page copy for one API docs catalog entry.",
  })
) {}

/** Runtime-only source variants. HttpApi values cannot be represented by Schema. */
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

/** Constructors and matchers for runtime catalog sources. */
export const CatalogSource = Data.taggedEnum<CatalogSource>();

/** Preserve a concrete HttpApi type behind the heterogeneous catalog boundary. */
export const makeContractSource = <Id extends string, Groups extends HttpApiGroup.Constraint>(
  api: HttpApi.HttpApi<Id, Groups>
): Extract<CatalogSource, { readonly _tag: "ContractSource" }> =>
  CatalogSource.ContractSource({
    api,
    withApi: (f) => f(api),
  });

/** One catalog entry pairing schema-backed metadata with a runtime source. */
export class CatalogEntry extends Data.Class<{
  readonly meta: CatalogEntryMeta;
  readonly source: CatalogSource;
}> {}
