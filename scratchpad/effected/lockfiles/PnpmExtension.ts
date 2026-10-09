import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/lockfiles/PnpmExtension");

/**
 * The pnpm `catalogs:` record shape as it appears in `pnpm-lock.yaml`:
 * catalog name → package name → pinned version string or
 * `{ specifier, version }` pair.
 *
 * @remarks
 * Exported so consumers (e.g. a `CatalogSet.fromLockfileCatalogs`) can type
 * against the lockfile's own shape instead of re-declaring it.
 *
 * @public
 */
export type PnpmCatalogs = Record<
	string,
	Record<string, string | { readonly specifier: string; readonly version: string }>
>;

/**
 * Extension data specific to pnpm lockfiles, attached to `Lockfile.extension`
 * when the format is `"pnpm"`.
 *
 * @remarks
 * - `catalogs` — pnpm catalog definitions ({@link PnpmCatalogs}).
 * - `overrides` — the version override map recorded in the lockfile header.
 * - `settings` — pnpm settings recorded in the lockfile header.
 *
 * @public
 */
export class PnpmExtension extends S.Class<PnpmExtension>($I`PnpmExtension`)({
	_tag: S.tag("pnpm").annotateKey({ description: "Identifies extension data preserved from a pnpm lockfile" }),
	catalogs: S.optionalKey(
		S.Record(
			S.String,
			S.Record(
				S.String,
				S.Union([S.String, S.Struct({ specifier: S.String, version: S.String })]),
			),
		),
	).annotateKey({ description: "Catalog definitions recorded in the lockfile, mapping catalog and package names to pinned versions or specifier/version pairs" }),
	overrides: S.optionalKey(S.Record(S.String, S.String)).annotateKey({ description: "Dependency version overrides recorded in the pnpm lockfile header" }),
	settings: S.optionalKey(
		S.Struct({
			autoInstallPeers: S.optionalKey(S.Boolean),
			excludeLinksFromLockfile: S.optionalKey(S.Boolean),
		}),
	).annotateKey({ description: "Peer auto-installation and link-exclusion settings recorded in the pnpm lockfile header" }),
}, $I.annote("PnpmExtension", { description: "Extension data specific to pnpm lockfiles, attached to `Lockfile.extension` when the format is `\"pnpm\"`." })) {}
