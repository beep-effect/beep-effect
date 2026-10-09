import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/lockfiles/BunExtension");

// Recursive annotation is required to tie the suspended schema's type knot.
type OverrideValue = string | { readonly [dependency: string]: OverrideValue };

const OverrideValue: S.Codec<OverrideValue> = S.Union([
	S.String,
	S.Record(S.String, S.suspend((): S.Codec<OverrideValue> => OverrideValue)),
]).annotate($I.annote("OverrideValue", { description: "A dependency specifier or nested npm-style override rules, including the self rule '.'" }));

/**
 * Extension data specific to bun lockfiles, attached to `Lockfile.extension`
 * when the format is `"bun"`.
 *
 * **Details**
 * - `catalog` — the default (unnamed) catalog.
 * - `catalogs` — named catalog definitions.
 * - `overrides` — dependency specifiers and nested npm-style override rules.
 * - `trustedDependencies` — packages allowed to run install scripts.
 *
 * **Example** (Preserve a parent-scoped override)
 *
 * ```ts
 * import { BunExtension } from "./BunExtension.ts";
 *
 * const extension = BunExtension.make({ overrides: { parent: { child: "^2.0.0" } } });
 * extension.overrides; // { parent: { child: "^2.0.0" } }
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class BunExtension extends S.Class<BunExtension>($I`BunExtension`)({
	_tag: S.tag("bun").annotateKey({ description: "Identifies this extension as bun-specific lockfile data" }),
	catalog: S.optionalKey(S.Record(S.String, S.Unknown)).annotateKey({ description: "Default unnamed catalog entries preserved from the bun lockfile" }),
	catalogs: S.optionalKey(S.Record(S.String, S.Record(S.String, S.Unknown))).annotateKey({ description: "Catalog definitions preserved from the bun lockfile, keyed by catalog name" }),
	overrides: S.optionalKey(S.Record(S.String, OverrideValue)).annotateKey({ description: "Dependency override rules preserved from the bun lockfile, including nested and version-scoped rules" }),
	trustedDependencies: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Packages the bun lockfile allows to run install scripts" }),
}, $I.annote("BunExtension", { description: "Extension data specific to bun lockfiles, attached to `Lockfile.extension` when the format is `\"bun\"`." })) {}
