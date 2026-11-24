import { $RepoWorkspacesId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
// The ONLY module that imports `@pnpm/catalogs.*`.
//
// Those four packages are what make this package integrated tier: they are
// pnpm's catalog semantics, versioned to pnpm majors, and reimplementing them
// would mean owning a moving spec with no oracle. Containing them behind one
// module keeps the tier-3 blast radius to one file — if the quartet ever has to
// be replaced or vendored, this is what changes.

import { getCatalogsFromWorkspaceManifest, mergeCatalogs } from "@pnpm/catalogs.config";
import { parseCatalogProtocol } from "@pnpm/catalogs.protocol-parser";
import { matchCatalogResolveResult, resolveFromCatalog } from "@pnpm/catalogs.resolver";
import type { Catalogs } from "@pnpm/catalogs.types";

export type { Catalogs };

const $I = $RepoWorkspacesId.create("internal/catalogs");

/**
 * The normalized entries shape: catalog name → dependency → range.
 * @category type-level
 * @since 0.0.0
 */
export type CatalogEntries = Record<string, Record<string, string>>;

/**
 * Why a catalog specifier could not be resolved. Raw record; the facade types it.
 * **Example** (Recognize a catalog resolution failure)
 *
 * ```ts
 * import { CatalogMisconfiguration } from "@beep/repo-workspaces/internal/catalogs";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(CatalogMisconfiguration)({ catalogName: "default", detail: "missing dependency" })); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CatalogMisconfiguration extends S.Opaque<CatalogMisconfiguration, { readonly brand: unique symbol }>()(
  S.Struct({
    catalogName: S.String.pipe(
      $I.annoteKey("CatalogMisconfiguration.catalogName", {
        description: "The catalog containing the unresolved dependency.",
      })
    ),
    detail: S.String.pipe(
      $I.annoteKey("CatalogMisconfiguration.detail", { description: "The catalog resolver's original diagnostic." })
    ),
  }).pipe(
    $I.annoteSchema("CatalogMisconfiguration", {
      description: "A plain catalog misconfiguration record reported by the resolver.",
    })
  )
) {}
/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CatalogMisconfiguration {
  /**
   * The plain, unbranded encoded shape of a {@link CatalogMisconfiguration}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CatalogMisconfiguration.Encoded;
}

/**
 * The `catalog` / `catalogs` blocks of a workspace manifest, already shaped
 * as name-to-range records.
 *
 * **Example** (Check a manifest's catalog blocks)
 *
 * ```ts
 * import { InlineCatalogBlocks } from "@beep/repo-workspaces/internal/catalogs";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(InlineCatalogBlocks)({ catalog: { effect: "^4.0.0" } })); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class InlineCatalogBlocks extends S.Opaque<InlineCatalogBlocks, { readonly brand: unique symbol }>()(
  S.Struct({
    catalog: S.Record(S.String, S.String).pipe(
      S.UndefinedOr,
      S.optionalKey,
      $I.annoteKey("InlineCatalogBlocks.catalog", { description: "The default catalog block, when declared." })
    ),
    catalogs: S.Record(S.String, S.Record(S.String, S.String)).pipe(
      S.UndefinedOr,
      S.optionalKey,
      $I.annoteKey("InlineCatalogBlocks.catalogs", { description: "The named catalog blocks, when declared." })
    ),
  }).pipe(
    $I.annoteSchema("InlineCatalogBlocks", {
      description: "A workspace manifest's default and named catalog blocks as name-to-range records.",
    })
  )
) {}
/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace InlineCatalogBlocks {
  /**
   * The plain, unbranded encoded shape of an {@link InlineCatalogBlocks}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof InlineCatalogBlocks.Encoded;
}

/**
 * Project a pnpm-workspace manifest's `catalog` / `catalogs` fields into a `Catalogs` map.
 *
 * **Example** (Read the default inline catalog)
 *
 * ```ts
 * import { inlineCatalogs } from "@beep/repo-workspaces/internal/catalogs";
 *
 * const catalogs = inlineCatalogs({ catalog: { effect: "^4.0.0" } });
 * console.log(catalogs.default?.effect) // ^4.0.0
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const inlineCatalogs = (manifest: InlineCatalogBlocks.Encoded): Catalogs => {
  if (manifest.catalog === undefined && manifest.catalogs === undefined) return {};
  // pnpm throws when the default catalog is defined twice (a top-level
  // `catalog:` *and* a `catalogs.default`). That is a malformed workspace file,
  // which is a data condition, so it must not escape as a defect.
  return Result.getOrElse(
    Result.try(() => getCatalogsFromWorkspaceManifest({ catalog: manifest.catalog, catalogs: manifest.catalogs })),
    () => ({})
  );
};

/**
 * Merge catalog sources; later sources win per dependency within a catalog.
 *
 * **Example** (Override a dependency with a later catalog source)
 *
 * ```ts
 * import { merge } from "@beep/repo-workspaces/internal/catalogs";
 *
 * const catalogs = merge({ default: { effect: "^3.0.0" } }, { default: { effect: "^4.0.0" } });
 * console.log(catalogs.default?.effect) // ^4.0.0
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const merge = (...sources: ReadonlyArray<Catalogs | undefined>): Catalogs => mergeCatalogs(...sources);

/**
 * Whether `specifier` is a `catalog:` protocol reference, and which catalog it names.
 *
 * **Example** (Distinguish named catalogs from other protocols)
 *
 * ```ts
 * import { catalogNameOf } from "@beep/repo-workspaces/internal/catalogs";
 *
 * import * as O from "effect/Option";
 *
 * console.log(O.getOrUndefined(catalogNameOf("catalog:tools"))) // tools
 * console.log(O.isNone(catalogNameOf("workspace:*"))) // true
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const catalogNameOf = (specifier: string): O.Option<string> => O.fromNullishOr(parseCatalogProtocol(specifier));

/**
 * Normalize the arbitrary shape of a catalog map into `CatalogEntries`, dropping anything unusable.
 *
 * **Example** (Normalize string and lockfile catalog entries)
 *
 * ```ts
 * import { normalize } from "@beep/repo-workspaces/internal/catalogs";
 *
 * const catalogs = normalize({ default: { effect: { specifier: "^4.0.0" }, invalid: 42 } });
 * console.log(catalogs.default?.effect) // ^4.0.0
 * console.log(catalogs.default?.invalid) // undefined
 * ```
 * @category normalization
 * @since 0.0.0
 */
export const normalize = (raw: unknown): CatalogEntries => {
  if (!P.isObjectOrArray(raw)) return {};
  return R.fromEntries(
    A.flatMap(ownEntries(raw), ([catalogName, catalog]) =>
      P.isObjectOrArray(catalog) ? [[catalogName, usableEntries(catalog)] as const] : []
    )
  );
};

/** An object's or array's own enumerable entries, keyed by property name. */
const ownEntries = (value: object): ReadonlyArray<readonly [string, unknown]> => R.toEntries({ ...value });

/** The range a catalog entry declares: the string itself, or a lockfile entry's `specifier`. */
const rangeOfEntry = (value: unknown): O.Option<string> => {
  if (P.isString(value)) return O.some(value);
  // Lockfile entries carry the declared range in `specifier`.
  const specifier =
    P.isObjectKeyword(value) && !P.isFunction(value) && "specifier" in value ? value.specifier : undefined;
  return P.isString(specifier) ? O.some(specifier) : O.none();
};

/** One catalog's usable `dependency → range` entries, in order. */
const usableEntries = (catalog: object): Record<string, string> =>
  R.fromEntries(
    A.getSomes(
      A.map(ownEntries(catalog), ([dependency, value]) =>
        O.map(rangeOfEntry(value), (range) => [dependency, range] as const)
      )
    )
  );

/**
 * Resolve one `catalog:` specifier against an assembled catalog set.
 *
 * **Details**
 *
 * Returns the range on a hit, `undefined` on a miss (the specifier names no
 * catalog entry — an ordinary `Option.none()` to the caller), and a
 * `CatalogMisconfiguration` when pnpm reports the catalog itself is malformed.
 *
 * **Example** (Resolve a catalog entry and inspect a miss)
 *
 * ```ts
 * import { rangeOf } from "@beep/repo-workspaces/internal/catalogs";
 *
 * const catalogs = { default: { effect: "^4.0.0" } };
 * console.log(rangeOf(catalogs, "effect", "catalog:")) // ^4.0.0
 * console.log(rangeOf(catalogs, "missing", "catalog:")) // undefined
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const rangeOf: {
  (dependency: string, specifier: string): (catalogs: Catalogs) => string | undefined | CatalogMisconfiguration;
  (catalogs: Catalogs, dependency: string, specifier: string): string | undefined | CatalogMisconfiguration;
} = dual(
  3,
  (catalogs: Catalogs, dependency: string, specifier: string): string | undefined | CatalogMisconfiguration => {
    const catalogName = catalogNameOf(specifier);
    if (O.isSome(catalogName)) {
      const catalog = O.flatMap(R.get<string, Catalogs[string]>(catalogs, catalogName.value), O.fromUndefinedOr);
      if (O.isNone(catalog) || !R.has<string, string | undefined>(catalog.value, dependency)) return undefined;
    }
    const result = resolveFromCatalog(catalogs, { alias: dependency, bareSpecifier: specifier });
    return matchCatalogResolveResult<string | undefined | CatalogMisconfiguration>(result, {
      found: (hit) => hit.resolution.specifier,
      misconfiguration: (bad) =>
        CatalogMisconfiguration.make({ catalogName: bad.catalogName, detail: bad.error.message }),
      unused: () => undefined,
    });
  }
);
