import { Schema } from "effect";

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
export class BunExtension extends Schema.Class<BunExtension>("BunExtension")({
	_tag: Schema.tag("bun"),
	catalog: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
	catalogs: Schema.optionalKey(Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Unknown))),
	overrides: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
	trustedDependencies: Schema.optionalKey(Schema.Array(Schema.String)),
}) {}
