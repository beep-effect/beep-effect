import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as O from "effect/Option";
import * as R from "effect/Record";
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

/** The normalized entries shape: catalog name → dependency → range. */
export type CatalogEntries = Record<string, Record<string, string>>;

/** Why a catalog specifier could not be resolved. Raw record; the facade types it. */
export interface CatalogMisconfiguration {
	readonly catalogName: string;
	readonly detail: string;
}

/** Project a pnpm-workspace manifest's `catalog` / `catalogs` fields into a `Catalogs` map. */
export const inlineCatalogs = (manifest: {
	readonly catalog?: Record<string, string> | undefined;
	readonly catalogs?: Record<string, Record<string, string>> | undefined;
}): Catalogs => {
	if (manifest.catalog === undefined && manifest.catalogs === undefined) return {};
	// pnpm throws when the default catalog is defined twice (a top-level
	// `catalog:` *and* a `catalogs.default`). That is a malformed workspace file,
	// which is a data condition, so it must not escape as a defect.
	try {
		return getCatalogsFromWorkspaceManifest({ catalog: manifest.catalog, catalogs: manifest.catalogs });
	} catch {
		return {};
	}
};

/** Merge catalog sources; later sources win per dependency within a catalog. */
export const merge = (...sources: ReadonlyArray<Catalogs | undefined>): Catalogs => mergeCatalogs(...sources);

/** Whether `specifier` is a `catalog:` protocol reference, and which catalog it names. */
export const catalogNameOf = (specifier: string): string | null => parseCatalogProtocol(specifier);

/** Normalize the arbitrary shape of a catalog map into `CatalogEntries`, dropping anything unusable. */
export const normalize = (raw: unknown): CatalogEntries => {
	if (!P.isObjectOrArray(raw)) return {};
	const entries: Array<readonly [string, Record<string, string>]> = [];
	for (const [catalogName, catalog] of P.isObject(raw) ? R.toEntries(raw) : R.toEntries<keyof typeof raw & string, unknown>(raw)) {
		if (!P.isObjectOrArray(catalog)) continue;
		const clean: Array<readonly [string, string]> = [];
		for (const [dependency, value] of P.isObject(catalog) ? R.toEntries(catalog) : R.toEntries<keyof typeof catalog & string, unknown>(catalog)) {
			if (P.isString(value)) {
				clean.push([dependency, value]);
			} else if (P.isObjectKeyword(value) && !P.isFunction(value) && "specifier" in value) {
				// Lockfile entries carry the declared range in `specifier`.
				const specifier = value.specifier;
				if (P.isString(specifier)) clean.push([dependency, specifier]);
			}
		}
		entries.push([catalogName, R.fromEntries(clean)]);
	}
	return R.fromEntries(entries);
};

/**
 * Resolve one `catalog:` specifier against an assembled catalog set.
 *
 * Returns the range on a hit, `undefined` on a miss (the specifier names no
 * catalog entry — an ordinary `Option.none()` to the caller), and a
 * `CatalogMisconfiguration` when pnpm reports the catalog itself is malformed.
 */
export const rangeOf: {
	(dependency: string, specifier: string): (catalogs: Catalogs) => string | undefined | CatalogMisconfiguration;
	(catalogs: Catalogs, dependency: string, specifier: string): string | undefined | CatalogMisconfiguration;
} = dual(3, (
	catalogs: Catalogs,
	dependency: string,
	specifier: string,
): string | undefined | CatalogMisconfiguration => {
	const catalogName = catalogNameOf(specifier);
	if (catalogName === null) return undefined;
	const catalog = O.flatMap(R.get<string, Catalogs[string]>(catalogs, catalogName), O.fromUndefinedOr);
	if (O.isNone(catalog) || !R.has<string, string | undefined>(catalog.value, dependency)) return undefined;
	const result = resolveFromCatalog(catalogs, { alias: dependency, bareSpecifier: specifier });
	return matchCatalogResolveResult<string | undefined | CatalogMisconfiguration>(result, {
		found: (hit) => hit.resolution.specifier,
		misconfiguration: (bad) => ({ catalogName: bad.catalogName, detail: bad.error.message }),
		unused: () => undefined,
	});
});
