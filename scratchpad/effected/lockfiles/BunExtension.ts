import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/lockfiles/BunExtension");

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
export class BunExtension extends S.Class<BunExtension>($I`BunExtension`)({
	_tag: S.tag("bun").annotateKey({ description: "Identifies this extension as bun-specific lockfile data" }),
	catalog: S.optionalKey(S.Record(S.String, S.Unknown)).annotateKey({ description: "Default unnamed catalog entries preserved from the bun lockfile" }),
	catalogs: S.optionalKey(S.Record(S.String, S.Record(S.String, S.Unknown))).annotateKey({ description: "Catalog definitions preserved from the bun lockfile, keyed by catalog name" }),
	overrides: S.optionalKey(S.Record(S.String, S.String)).annotateKey({ description: "Dependency version override map preserved from the bun lockfile" }),
	trustedDependencies: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Packages the bun lockfile allows to run install scripts" }),
}, $I.annote("BunExtension", { description: "Extension data specific to bun lockfiles, attached to `Lockfile.extension` when the format is `\"bun\"`." })) {}
