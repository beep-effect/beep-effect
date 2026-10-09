import * as S from "effect/Schema";

/**
 * Extension data specific to bun lockfiles, attached to `Lockfile.extension`
 * when the format is `"bun"`.
 *
 * @remarks
 * - `catalog` — the default (unnamed) catalog.
 * - `catalogs` — named catalog definitions.
 * - `overrides` — the version override map.
 * - `trustedDependencies` — packages allowed to run install scripts.
 *
 * @public
 */
export class BunExtension extends S.Class<BunExtension>("BunExtension")({
	_tag: S.tag("bun"),
	catalog: S.optionalKey(S.Record(S.String, S.Unknown)),
	catalogs: S.optionalKey(S.Record(S.String, S.Record(S.String, S.Unknown))),
	overrides: S.optionalKey(S.Record(S.String, S.String)),
	trustedDependencies: S.String.pipe(S.Array, S.optionalKey),
}) {}
