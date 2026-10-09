// The presence-lenient manifest model: `PackageManifest` is `Package` with the
// publishability requirements relaxed — `name` and `version` may be absent,
// and `packageManager` accepts the range spelling — while every field that IS
// present still decodes through the same typed codecs.
//
// npm itself draws this line: `name` and `version` are required only for a
// package that will be PUBLISHED. The idiomatic monorepo root manifest —
// `{ "private": true, "packageManager": "pnpm@11.2.0", "devEngines": {...} }` —
// has neither and is entirely valid, and a tool that edits other people's
// manifests meets that shape as its primary target.
//
// The kit's tolerance ladder, so nothing here duplicates a sibling:
//   Package            — strict, publishable: name+version required.
//   PackageManifest    — presence-lenient: absence allowed, shape-on-presence
//                        still validated (this module).
//   LenientManifest    — shape-lenient discovery/sniffing: malformed fields
//                        degrade to absence (kept in `rest`, reported on
//                        `issues`) instead of failing the document.
//   @effected/npm Manifest — shape-blind outside the four dependency fields,
//                        for mid-build resolution.
//   PackageJsonFormat  — decode-free text path: anything syntactically JSON.

import { $ScratchpadId } from "@beep/identity/packages";
import { SemVer } from "../semver/index.ts";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { renderJson, resolveFormatOptions } from "./internal/format.ts";
import { makeWire } from "./internal/wire.ts";
import type { PackageFormatOptions } from "./Package.ts";
import { Package, PackageDecodeError } from "./Package.ts";
import { PackageManagerRange } from "./PackageManagerRange.ts";
import { PackageName } from "./PackageName.ts";

const $I = $ScratchpadId.create("effected/package-json/PackageManifest");

/**
 * A package.json document as it exists on disk, publishable or not: every
 * field of {@link Package} with `name` and `version` optional and
 * `packageManager` accepting the range spelling.
 *
 * @remarks
 * **Lenient about absence, strict about shape.** npm requires `name` and
 * `version` only for a package that will be published; the idiomatic private
 * workspace root (`{ "private": true, "packageManager": "pnpm@11.2.0" }`)
 * carries neither, and {@link Package.decode} rightly rejects it — the strict
 * model's contract is publishability. This class decodes that shape, and any
 * other manifest, so long as every field that IS present satisfies its typed
 * codec: a present `version` must still be strict semver (`"1.0"` fails
 * typed), a present `name` must still satisfy the npm grammar, a present
 * `packageManager` must still parse — though here the version position may be
 * a semver range (`pnpm@^11.20.0`), decoded as {@link PackageManagerRange}.
 * For tolerance of malformed fields, use the shape-lenient `LenientManifest`
 * discovery tier — which degrades them to absence, preserved in `rest` and
 * reported on `issues` — or the decode-free {@link PackageJsonFormat} text
 * path (or `@effected/npm`'s shape-blind `Manifest`); here, silently carrying
 * a value the type claims to have validated would be a lie, and silently
 * dropping it would break round-trip fidelity.
 *
 * The model is deliberately lean — fields, the `rest` catch-all wire codec,
 * {@link PackageManifest.decode} and {@link PackageManifest.toJsonString} —
 * because the write half of a manifest-editing tool is the surgical
 * {@link PackageJsonFormat.modifyToString} / `PackageJsonFile.modify` path,
 * which never goes through a model at all. Mutation statics live on the
 * strict {@link Package}.
 *
 * @example
 * ```ts
 * import { PackageManifest } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const root = yield* PackageManifest.decode({ private: true, packageManager: "pnpm@^11.20.0" });
 *   console.log(root.isPrivate); // => true
 * });
 * ```
 *
 * @public
 */
export class PackageManifest extends S.Class<PackageManifest>($I`PackageManifest`)({
	...Package.fields,
	name: S.optionalKey(PackageName).annotateKey({ description: "Optional package identifier that must satisfy npm naming rules when present" }),
	version: S.optionalKey(SemVer.FromString).annotateKey({ description: "Optional package release version that must satisfy strict semantic versioning when present" }),
	packageManager: S.optionalKey(PackageManagerRange.FromString).annotateKey({ description: "Package-manager declaration accepting an exact version or semver range, with optional integrity hash and original range spelling preserved" }),
}, $I.annote("PackageManifest", { description: "A package.json document as it exists on disk, publishable or not: every field of Package with `name` and `version` optional and `packageManager` accepting the range spelling." })) {
	/**
	 * The wire codec: an open JSON object ↔ a {@link PackageManifest} instance,
	 * partitioning unknown keys into `rest` and flattening them back on encode —
	 * the same transform {@link Package.schema} uses, over this class's fields.
	 */
	static readonly schema: S.Codec<PackageManifest, { readonly [k: string]: unknown }> = makeWire(PackageManifest);

	/**
	 * Decode an unknown JSON value into a {@link PackageManifest}, normalizing
	 * any `SchemaError` to a typed {@link PackageDecodeError} at the boundary.
	 *
	 * @param input - the parsed package.json JSON value (e.g. from `JSON.parse`)
	 * @returns an Effect resolving to the decoded `PackageManifest`, failing with
	 * {@link PackageDecodeError} when a present field does not satisfy its codec
	 */
	static readonly decode = Effect.fn("PackageManifest.decode")(function* (input: unknown) {
		return yield* S.decodeUnknownEffect(PackageManifest.schema)(input).pipe(
			Effect.catchTag("SchemaError", (cause) => PackageDecodeError.make({ cause })),
		);
	});

	/** Whether the manifest is marked private. */
	get isPrivate(): boolean {
		return this.private ?? false;
	}

	/**
	 * Serialize to a formatted package.json string: encode through the wire
	 * codec (flattening `rest`), then apply the canonical key order, dependency
	 * sorting and empty-map stripping unless the options opt out. Pure, and
	 * shared with `Package.toJsonString` down to the same internal renderer.
	 * Absent `name` / `version` keys stay absent — nothing is invented.
	 */
	toJsonString(options?: PackageFormatOptions): string {
		const raw = Result.getOrThrowWith(S.encodeUnknownResult(PackageManifest.schema)(this), (error) => error);
		return renderJson(raw, resolveFormatOptions(options));
	}
}
