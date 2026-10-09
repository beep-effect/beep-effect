// The `Manifest` domain model: a tolerant manifest as a `Schema.Class` — the
// four dependency fields typed, everything else preserved verbatim in a
// `rest` catch-all — plus manifest-level resolution of `catalog:` and
// `workspace:` specifiers over the resolver contracts. No IO of its own; the
// `CatalogResolver` / `WorkspaceResolver` implementations arrive in `R` and
// the application provides them at the edge.
//
// The wire codec is deliberately tolerant: mid-build manifests are arbitrary
// user records, and forcing them through a strict `Package` decode would fail
// resolution on fields this module never reads. Only the four dependency
// fields are validated; every other top-level field rides through `rest`
// untouched and flattens back to the top level on encode.

import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import type { CatalogAssemblyError } from "./CatalogAssemblyError.ts";
import { CatalogResolver } from "./CatalogResolver.ts";
import { DependencyField } from "./DependencySection.ts";
import { DependencySpecifier } from "./DependencySpecifier.ts";
import type { DependencyResolutionError } from "./WorkspaceResolver.ts";
import { WorkspaceResolver } from "./WorkspaceResolver.ts";

/**
 * Indicates that an unknown value could not be decoded into a {@link Manifest}.
 *
 * Raised by {@link Manifest.decode}. Only the four dependency fields are
 * validated — a failure means one of them is not a string→string record, or
 * the input is not a record at all. The underlying `SchemaError` is preserved
 * on the structured `cause` field (never stringified), so callers keep the
 * issue tree for diagnostics.
 *
 * @public
 */
export class ManifestDecodeError extends S.TaggedError<ManifestDecodeError>()("ManifestDecodeError", {
	/** The underlying `SchemaError`, preserved structurally rather than stringified. */
	cause: S.Defect(),
}) {
	/** Summarizes the decode failure in one line. */
	override get message(): string {
		return "Failed to decode manifest";
	}
}

/**
 * Raised when a `catalog:` or `workspace:` specifier in a manifest resolves
 * to nothing: the catalog has no entry for the dependency, or no workspace
 * package carries its name. Distinct from `DependencyResolutionError` — the
 * resolution *mechanism* worked; the answer was `Option.none()`, which at
 * the manifest level means the manifest cannot be projected to concrete
 * ranges.
 *
 * @public
 */
export class UnresolvedDependencyError extends S.TaggedError<UnresolvedDependencyError>()(
	"UnresolvedDependencyError",
	{
		/** The manifest field the dependency is declared under. */
		field: DependencyField,
		/** The dependency's package name. */
		dependency: S.String,
		/** The raw specifier that resolved to nothing. */
		specifier: S.String,
		/** Why resolution came back empty. */
		reason: S.Literals(["catalog-entry-missing", "workspace-package-missing"]),
	},
) {
	/** Renders the missing entry into a one-line message. */
	override get message(): string {
		return this.reason === "catalog-entry-missing"
			? `No catalog entry for "${this.dependency}" (declared as "${this.specifier}" in ${this.field})`
			: `No workspace package named "${this.dependency}" (declared as "${this.specifier}" in ${this.field})`;
	}
}

const RawManifest = S.Record(S.String, S.Unknown);

// The keys the wire codec partitions into typed members; everything else
// rides through `rest`.
const DEPENDENCY_FIELDS: ReadonlySet<string> = new Set(DependencyField.literals);

// Build the open-record ↔ class wire codec: on decode the four dependency
// field names become typed members and everything else lands in `rest`; on
// encode `rest` flattens back to top-level keys so the wire shape never
// carries a literal `rest` key. Mirrors `@effected/package-json`'s wire
// transform at a smaller scale, without taking the dependency.
const makeWire = (
	// biome-ignore lint/suspicious/noExplicitAny: invariant Encoded slot — a concrete type is rejected by the class-factory generics
	Class: S.Codec<Manifest, any, any, any>,
): S.Codec<Manifest, { readonly [k: string]: unknown }> => {
	const wire = RawManifest.pipe(
		S.decodeTo(
			Class,
			SchemaTransformation.transform({
				decode: (raw: { readonly [k: string]: unknown }) => {
					const known: Record<string, unknown> = {};
					const rest: Record<string, unknown> = {};
					for (const [key, value] of Object.entries(raw)) {
						if (DEPENDENCY_FIELDS.has(key)) known[key] = value;
						else rest[key] = value;
					}
					return { ...known, rest };
				},
				encode: (encoded: Record<string, unknown>) => {
					const { rest, ...known } = encoded as Record<string, unknown> & { rest?: Record<string, unknown> };
					// Typed fields win on a key collision: a hand-built Manifest whose
					// `rest` smuggles a dependency-field key must not shadow the typed
					// member on the wire.
					return { ...(rest ?? {}), ...known };
				},
			}),
		),
	);
	return wire as unknown as S.Codec<Manifest, { readonly [k: string]: unknown }>;
};

/**
 * A tolerant manifest as a domain model: the four dependency fields typed as
 * string→string records, everything else preserved verbatim in `rest`.
 *
 * This is deliberately NOT a strict package.json model — the input to
 * manifest-level resolution is an arbitrary user manifest mid-build, and a
 * strict decode would reject manifests this module has no business
 * validating. Use `@effected/package-json`'s `Package` when you want the
 * strict model.
 *
 * {@link Manifest.decode} decodes any unknown record through the tolerant
 * wire codec ({@link Manifest.schema}); {@link Manifest.needsResolution} is
 * the pure fast-path predicate (does any dependency field carry a `catalog:`
 * or `workspace:` specifier?); {@link Manifest.resolve} projects every such
 * specifier to a concrete range through the {@link CatalogResolver} /
 * {@link WorkspaceResolver} contracts, returning a new `Manifest`;
 * {@link Manifest.toRecord} encodes back to the wire shape with `rest`
 * flattened to the top level.
 *
 * @example
 * ```ts
 * import { Default, Manifest } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const manifest = yield* Manifest.decode({ name: "app", dependencies: { effect: "^4.0.0" } });
 *   const resolved = manifest.needsResolution ? yield* manifest.resolve() : manifest;
 *   return resolved.toRecord();
 * });
 *
 * Effect.runPromise(Effect.provide(program, Default)).then(console.log);
 * // => { name: "app", dependencies: { effect: "^4.0.0" } }
 * ```
 *
 * @public
 */
export class Manifest extends S.Class<Manifest>("Manifest")({
	/** Production dependencies, when present. */
	dependencies: S.optionalKey(S.Record(S.String, S.String)),
	/** Development dependencies, when present. */
	devDependencies: S.optionalKey(S.Record(S.String, S.String)),
	/** Peer dependencies, when present. */
	peerDependencies: S.optionalKey(S.Record(S.String, S.String)),
	/** Optional dependencies, when present. */
	optionalDependencies: S.optionalKey(S.Record(S.String, S.String)),
	/** Every non-dependency top-level field, preserved verbatim for round-trip fidelity. */
	rest: S.optionalKey(S.Record(S.String, S.Unknown)),
}) {
	/**
	 * The tolerant wire codec: an open record ↔ a {@link Manifest} instance,
	 * partitioning the four dependency field names into typed members and
	 * everything else into `rest`, flattened back to the top level on encode.
	 */
	static readonly schema: S.Codec<Manifest, { readonly [k: string]: unknown }> = makeWire(Manifest);

	/**
	 * Decode an unknown value into a {@link Manifest}, normalizing any
	 * `SchemaError` to a typed {@link ManifestDecodeError} at the boundary.
	 *
	 * @param input - the parsed manifest value (e.g. from `JSON.parse`)
	 * @returns an Effect resolving to the decoded `Manifest`, failing with
	 * {@link ManifestDecodeError} when a dependency field is not a
	 * string→string record, or the input is not a record at all
	 */
	static readonly decode = Effect.fn("Manifest.decode")(function* (input: unknown) {
		return yield* S.decodeUnknownEffect(Manifest.schema)(input).pipe(
			Effect.catchTag("SchemaError", (cause) => ManifestDecodeError.make({ cause })),
		);
	});

	/**
	 * Whether any of the four dependency fields carries a `catalog:` or
	 * `workspace:` specifier. Pure — callers use it to skip catalog assembly
	 * entirely for manifests with nothing to resolve.
	 */
	get needsResolution(): boolean {
		return DependencyField.literals.some((field) => {
			const section = this[field];
			return (
				section !== undefined &&
				Object.values(section).some(
					(specifier) => DependencySpecifier.isCatalog(specifier) || DependencySpecifier.isWorkspace(specifier),
				)
			);
		});
	}

	/**
	 * Project the whole manifest: every `catalog:` specifier resolves through
	 * {@link CatalogResolver}, every `workspace:` specifier through
	 * {@link WorkspaceResolver} followed by the pnpm publish-time projection
	 * (`DependencySpecifier.resolveWorkspace`), and everything else — other
	 * specifier forms, non-dependency fields — passes through untouched. The
	 * alias form (`workspace:<name>@<range>`) resolves the TARGET package's
	 * version and projects to the `npm:<name>@<range>` alias pnpm publishes.
	 * This instance is never mutated; a new `Manifest` is returned with `rest`
	 * carried over unchanged. A specifier the resolvers cannot answer fails
	 * typed as {@link UnresolvedDependencyError}; mechanism failures surface
	 * as the resolver contracts' own {@link CatalogAssemblyError} /
	 * {@link DependencyResolutionError}. Requires {@link CatalogResolver} and
	 * {@link WorkspaceResolver} in `R`.
	 *
	 * @remarks
	 * Fails typed on unresolvable entries. For the leave-unchanged policy over
	 * the strict package.json model, see `@effected/package-json`'s
	 * `Package#resolve`.
	 *
	 * @returns an Effect resolving to a new `Manifest` with concrete ranges
	 */
	resolve(): Effect.Effect<
		Manifest,
		CatalogAssemblyError | DependencyResolutionError | UnresolvedDependencyError,
		CatalogResolver | WorkspaceResolver
	> {
		return resolveManifest(this);
	}

	/**
	 * Encode back to the wire shape: the dependency fields as plain records
	 * and `rest` flattened to the top level (no literal `rest` key).
	 *
	 * @returns the manifest as an open record
	 */
	toRecord(): Record<string, unknown> {
		return Result.getOrThrow(S.encodeUnknownResult(Manifest.schema)(this));
	}
}

// The resolution walk behind `Manifest.resolve`, module-private so the
// instance method carries a named span (`Effect.fn` wraps functions; the
// method delegates — the Package.ts house pattern).
const resolveManifest = Effect.fn("Manifest.resolve")(function* (manifest: Manifest) {
	const catalogs = yield* CatalogResolver;
	const workspaces = yield* WorkspaceResolver;
	// Only the fields present on the input land on the output — an optionalKey
	// field must never be spread in as an explicit `undefined`.
	const output: { [K in DependencyField]?: Record<string, string> } = {};
	for (const field of DependencyField.literals) {
		const section = manifest[field];
		if (section === undefined) continue;
		const resolved: Record<string, string> = {};
		for (const [dependency, specifier] of Object.entries(section)) {
			if (DependencySpecifier.isCatalog(specifier)) {
				const range = yield* catalogs.rangeOf(dependency, DependencySpecifier.catalogNameOf(specifier));
				if (O.isNone(range)) {
					return yield* UnresolvedDependencyError.make({ field, dependency, specifier, reason: "catalog-entry-missing" });
				}
				resolved[dependency] = range.value;
				continue;
			}
			if (DependencySpecifier.isWorkspace(specifier)) {
				// pnpm's alias form (`workspace:<name>@<range>`) resolves the TARGET
				// package's version; the plain form resolves the map key's. The error
				// names whichever package the lookup actually missed, with the
				// original specifier preserved.
				const target = O.getOrElse(DependencySpecifier.workspaceTargetOf(specifier), () => dependency);
				const version = yield* workspaces.versionOf(target);
				if (O.isNone(version)) {
					return yield* UnresolvedDependencyError.make({
							field,
							dependency: target,
							specifier,
							reason: "workspace-package-missing",
						});
				}
				resolved[dependency] = DependencySpecifier.resolveWorkspace(specifier, version.value);
				continue;
			}
			resolved[dependency] = specifier;
		}
		output[field] = resolved;
	}
	return Manifest.make({
		...output,
		...(manifest.rest !== undefined ? { rest: manifest.rest } : {}),
	});
});
