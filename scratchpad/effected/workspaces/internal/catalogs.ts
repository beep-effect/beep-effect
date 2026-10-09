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
	if (raw === null || typeof raw !== "object") return {};
	const entries: CatalogEntries = {};
	for (const [catalogName, catalog] of Object.entries(raw as Record<string, unknown>)) {
		if (catalog === null || typeof catalog !== "object") continue;
		const clean: Record<string, string> = {};
		for (const [dependency, value] of Object.entries(catalog as Record<string, unknown>)) {
			if (typeof value === "string") {
				// `__proto__` as a plain assignment would mutate the prototype; route
				// every key through defineProperty, matching JSON.parse semantics.
				define(clean, dependency, value);
			} else if (value !== null && typeof value === "object" && "specifier" in value) {
				// A pnpm LOCKFILE catalog entry is `{ specifier, version }`; the
				// specifier is the declared range, which is what a catalog resolves to.
				const specifier = (value as { readonly specifier: unknown }).specifier;
				if (typeof specifier === "string") define(clean, dependency, specifier);
			}
		}
		define(entries as Record<string, unknown>, catalogName, clean);
	}
	return entries;
};

const define = (target: Record<string, unknown>, key: string, value: unknown): void => {
	if (key === "__proto__") {
		Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
	} else {
		target[key] = value;
	}
};

/**
 * Resolve one `catalog:` specifier against an assembled catalog set.
 *
 * Returns the range on a hit, `undefined` on a miss (the specifier names no
 * catalog entry — an ordinary `Option.none()` to the caller), and a
 * `CatalogMisconfiguration` when pnpm reports the catalog itself is malformed.
 */
export const rangeOf = (
	catalogs: Catalogs,
	dependency: string,
	specifier: string,
): string | undefined | CatalogMisconfiguration => {
	if (catalogNameOf(specifier) === null) return undefined;
	const result = resolveFromCatalog(catalogs, { alias: dependency, bareSpecifier: specifier });
	return matchCatalogResolveResult<string | undefined | CatalogMisconfiguration>(result, {
		found: (hit) => hit.resolution.specifier,
		misconfiguration: (bad) => ({ catalogName: bad.catalogName, detail: bad.error.message }),
		unused: () => undefined,
	});
};
