import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/lockfiles/PnpmExtension");

/**
 * The pnpm `catalogs:` record shape as it appears in `pnpm-lock.yaml`:
 * catalog name → package name → pinned version string or
 * `{ specifier, version }` pair.
 *
 * **Details**
 *
 * Exported so consumers (e.g. a `CatalogSet.fromLockfileCatalogs`) can type
 * against the lockfile's own shape instead of re-declaring it.
 *
 * **Example** (Validate catalog entries)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { PnpmCatalogs } from "./PnpmExtension.ts";
 *
 * S.is(PnpmCatalogs)({ default: { effect: { specifier: "^4.0.0", version: "4.0.2" } } }); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const PnpmCatalogs = S.Record(
	S.String,
	S.mutableKey(S.Record(
		S.String,
		S.mutableKey(S.Union([
			S.String,
			S.Struct({
				specifier: S.String.annotateKey({ description: "Dependency specifier declared by the catalog entry" }),
				version: S.String.annotateKey({ description: "Pinned version resolved for the catalog entry" }),
			}),
		])),
	)),
).annotate($I.annote("PnpmCatalogs", { description: "Catalog names mapped to package versions or specifier/version pairs preserved from the pnpm lockfile" }));

/**
 * Catalog records described by {@link PnpmCatalogs}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type PnpmCatalogs = typeof PnpmCatalogs.Type;

/**
 * Extension data specific to pnpm lockfiles, attached to `Lockfile.extension`
 * when the format is `"pnpm"`.
 *
 * **Details**
 *
 * - `catalogs` — pnpm catalog definitions ({@link PnpmCatalogs}).
 * - `overrides` — the version override map recorded in the lockfile header.
 * - `settings` — pnpm settings recorded in the lockfile header.
 *
 * @public
 */
export class PnpmExtension extends S.Class<PnpmExtension>($I`PnpmExtension`)({
	_tag: S.tag("pnpm").annotateKey({ description: "Identifies extension data preserved from a pnpm lockfile" }),
	catalogs: S.optionalKey(PnpmCatalogs).annotateKey({ description: "Catalog definitions recorded in the lockfile, mapping catalog and package names to pinned versions or specifier/version pairs" }),
	overrides: S.optionalKey(S.Record(S.String, S.String)).annotateKey({ description: "Dependency version overrides recorded in the pnpm lockfile header" }),
	settings: S.optionalKey(
		S.Struct({
			autoInstallPeers: S.optionalKey(S.Boolean),
			excludeLinksFromLockfile: S.optionalKey(S.Boolean),
		}),
	).annotateKey({ description: "Peer auto-installation and link-exclusion settings recorded in the pnpm lockfile header" }),
}, $I.annote("PnpmExtension", { description: "Extension data specific to pnpm lockfiles, attached to `Lockfile.extension` when the format is `\"pnpm\"`." })) {}
