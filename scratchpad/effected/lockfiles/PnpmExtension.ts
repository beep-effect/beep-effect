import { Schema } from "effect";

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
export class PnpmExtension extends Schema.Class<PnpmExtension>("PnpmExtension")({
	_tag: Schema.tag("pnpm"),
	catalogs: Schema.optionalKey(
		Schema.Record(
			Schema.String,
			Schema.Record(
				Schema.String,
				Schema.Union([Schema.String, Schema.Struct({ specifier: Schema.String, version: Schema.String })]),
			),
		),
	),
	overrides: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
	settings: Schema.optionalKey(
		Schema.Struct({
			autoInstallPeers: Schema.optionalKey(Schema.Boolean),
			excludeLinksFromLockfile: Schema.optionalKey(Schema.Boolean),
		}),
	),
}) {}
