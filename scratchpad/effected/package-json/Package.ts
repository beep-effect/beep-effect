// The core `Package` model: a rich `Schema.Class` for a package.json document
// with computed getters, dual-signature immutable-mutation statics, a
// derived-patch `copyWith`, the `rest` catch-all with its wire transform /
// `.extend()` story (`Package.schema`, `Package.wireFor`), the pure
// `Package.toJsonString` serializer, and `Package.resolve` over the
// `@effected/npm` resolver contracts.

import { CatalogResolver, DependencySpecifier, WorkspaceResolver } from "../npm/index.ts";
import type { InvalidVersionError } from "../semver/index.ts";
import { SemVer } from "../semver/index.ts";
import { Effect, Function as Fn, HashMap, Option, Pipeable, Schema, SchemaTransformation } from "effect";
import { Dependency } from "./Dependency.ts";
import { DevEnginesSchema } from "./DevEngines.ts";
import { Funding } from "./Funding.ts";
import { renderJson, resolveFormatOptions } from "./internal/format.ts";
import { makeWire } from "./internal/wire.ts";
import { InvalidSpdxLicenseError, SpdxLicense, isValidSpdx } from "./License.ts";
import { PackageManager } from "./PackageManager.ts";
import { InvalidPackageNameError, PackageName } from "./PackageName.ts";
import { Person } from "./Person.ts";
import { Bugs, Repository } from "./Repository.ts";

// ── Field codecs ────────────────────────────────────────────────────────────
// Exported @public as reusable field schemas: they compose the `Package` model
// and are available for `.extend()`ed subclasses. Reach for `Package` and its
// fields directly for ordinary use.

const toHashMap = SchemaTransformation.transform({
	decode: (record: { readonly [x: string]: string }) => HashMap.fromIterable(Object.entries(record)),
	encode: (map: HashMap.HashMap<string, string>) => Object.fromEntries(HashMap.toEntries(map)),
});

/**
 * A string→string map field decoding a plain JSON object to a `HashMap`,
 * defaulting to an empty map when the key is absent. Backs the four dependency
 * maps and `scripts`. Not meant to be referenced directly.
 *
 * @public
 */
export const DependencyMapField = Schema.Record(Schema.String, Schema.String).pipe(
	Schema.withDecodingDefaultKey(Effect.succeed({} as { readonly [x: string]: string })),
	Schema.decodeTo(Schema.HashMap(Schema.String, Schema.String), toHashMap),
);

/**
 * A string→string map field decoding a plain JSON object to a `HashMap`,
 * with no default (an absent key stays absent). Backs `engines`. Not meant to
 * be referenced directly.
 *
 * @public
 */
export const StringMapField = Schema.Record(Schema.String, Schema.String).pipe(
	Schema.decodeTo(Schema.HashMap(Schema.String, Schema.String), toHashMap),
);

/**
 * The `bin` field: a single string path or a name→path map. Not meant to be
 * referenced directly.
 *
 * @public
 */
export const BinField = Schema.Union([Schema.String, StringMapField]);

/**
 * The `exports` field: a single string entry point or an open object of
 * conditional exports. Not meant to be referenced directly.
 *
 * @public
 */
export const ExportsField = Schema.Union([Schema.String, Schema.Record(Schema.String, Schema.Unknown)]);

/**
 * The `publishConfig` field: an open record preserving known npm keys
 * (`access`, `directory`, ...) plus extensions like `targets`. Not meant to be
 * referenced directly.
 *
 * @public
 */
export const PublishConfigField = Schema.Record(Schema.String, Schema.Unknown);

/**
 * The `peerDependenciesMeta` field: a map of package name to `{ optional? }`.
 * Not meant to be referenced directly.
 *
 * @public
 */
export const PeerDependenciesMetaField = Schema.Record(
	Schema.String,
	Schema.Struct({ optional: Schema.optionalKey(Schema.Boolean) }),
);

/**
 * The `repository` field's raw wire shape: a shorthand string or an object.
 *
 * @deprecated Superseded by {@link Repository.FromValue}, which decodes both
 * encodings into a typed {@link Repository} with normalization getters and
 * round-trips the original form. Retained only as a name for the raw union;
 * `Package.repository` is a {@link Repository}.
 *
 * @public
 */
export const RepositoryField = Schema.Union([Schema.String, Schema.Record(Schema.String, Schema.Unknown)]);

// ── Errors ──────────────────────────────────────────────────────────────────

/**
 * Indicates that a JSON value could not be decoded into a valid {@link Package}.
 *
 * Raised by {@link Package.decode}. The underlying `SchemaError` is preserved on
 * the structured `cause` field (never stringified), so callers keep the issue
 * tree for diagnostics.
 *
 * @public
 */
export class PackageDecodeError extends Schema.TaggedError<PackageDecodeError>()("PackageDecodeError", {
	/** The underlying `SchemaError`, preserved structurally rather than stringified. */
	cause: Schema.Defect(),
}) {
	override get message(): string {
		return "Failed to decode package.json";
	}
}

// ── Formatting options ──────────────────────────────────────────────────────

/**
 * Indentation for serialized package.json output: a spaces count, `"tab"` for
 * real tab indentation, or `"preserve"` to reuse the indentation detected from
 * the original source text (falling back to the two-space default when no
 * source text is available).
 *
 * @public
 */
export type PackageIndent = number | "tab" | "preserve";

/**
 * Options for {@link Package.toJsonString} and `PackageJsonFile.write`.
 *
 * @public
 */
export interface PackageFormatOptions {
	/** Indentation: a spaces count, `"tab"`, or `"preserve"` (default `2`). */
	readonly indent?: PackageIndent;
	/**
	 * The original source text backing `indent: "preserve"`: its indentation
	 * (tab vs N spaces, detected from the first indented line) is reused.
	 * Ignored for other `indent` values. When absent, `PackageJsonFile.write`
	 * supplies the existing file's text automatically; the pure
	 * {@link Package.toJsonString} falls back to the default indentation.
	 */
	readonly sourceText?: string;
	/** Order top-level keys canonically and alphabetize dependency maps (default `true`). */
	readonly sort?: boolean;
	/** Strip empty dependency-map keys (default `true`). */
	readonly stripEmpty?: boolean;
	/** Append a trailing newline (default `true`). */
	readonly newline?: boolean;
}

// ── Model ───────────────────────────────────────────────────────────────────

/**
 * A patch over {@link Package}'s modeled fields — every field optional,
 * derived from the schema so it never drifts from the model.
 *
 * @public
 */
export type PackagePatch = Partial<{
	readonly [K in keyof (typeof Package)["fields"]]: (typeof Package)["fields"][K]["Type"];
}>;

/**
 * A package.json document as a rich `Schema.Class`: typed known fields, a
 * `rest` catch-all preserving unknown top-level fields across a read/edit/write
 * cycle, computed getters, and immutable mutation statics.
 *
 * @example
 * ```ts
 * import { Package } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const pkg = yield* Package.decode({ name: "my-pkg", version: "1.0.0" });
 *   const next = yield* Package.setVersion(pkg, "1.1.0");
 *   console.log(next.toJsonString());
 * });
 * ```
 *
 * @public
 */
export class Package extends Schema.Class<Package>("Package")({
	name: PackageName,
	version: SemVer.FromString,
	description: Schema.optionalKey(Schema.String),
	private: Schema.optionalKey(Schema.Boolean),
	type: Schema.optionalKey(Schema.Literals(["module", "commonjs"])),
	main: Schema.optionalKey(Schema.String),
	license: Schema.optionalKey(SpdxLicense),
	author: Schema.optionalKey(Person.FromValue),
	contributors: Schema.optionalKey(Schema.Array(Person.FromValue)),
	maintainers: Schema.optionalKey(Schema.Array(Person.FromValue)),
	keywords: Schema.optionalKey(Schema.Array(Schema.String)),
	repository: Schema.optionalKey(Repository.FromValue),
	bugs: Schema.optionalKey(Bugs.FromValue),
	funding: Schema.optionalKey(Funding.FromField),
	homepage: Schema.optionalKey(Schema.String),
	dependencies: DependencyMapField,
	devDependencies: DependencyMapField,
	peerDependencies: DependencyMapField,
	optionalDependencies: DependencyMapField,
	peerDependenciesMeta: Schema.optionalKey(PeerDependenciesMetaField),
	scripts: DependencyMapField,
	bin: Schema.optionalKey(BinField),
	engines: Schema.optionalKey(StringMapField),
	exports: Schema.optionalKey(ExportsField),
	publishConfig: Schema.optionalKey(PublishConfigField),
	packageManager: Schema.optionalKey(PackageManager.FromString),
	devEngines: Schema.optionalKey(DevEnginesSchema),
	rest: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
}) {
	// ── Pipeable ──────────────────────────────────────────────────────────
	// `Schema.Class` instances are not `Pipeable` out of the box, so this manual
	// overload block makes `pkg.pipe(Package.setVersion(v))` work alongside the
	// dual statics' data-first and curried call styles.

	pipe<A>(this: A): A;
	pipe<A, B>(this: A, ab: (_: A) => B): B;
	pipe<A, B, C>(this: A, ab: (_: A) => B, bc: (_: B) => C): C;
	pipe<A, B, C, D>(this: A, ab: (_: A) => B, bc: (_: B) => C, cd: (_: C) => D): D;
	pipe<A, B, C, D, E>(this: A, ab: (_: A) => B, bc: (_: B) => C, cd: (_: C) => D, de: (_: D) => E): E;
	pipe(this: unknown): unknown {
		// biome-ignore lint/complexity/noArguments: Pipeable.pipeArguments requires the arguments object
		return Pipeable.pipeArguments(this, arguments);
	}

	// ── Schema / wire transform ───────────────────────────────────────────

	/**
	 * The default wire codec: an open JSON object ↔ a {@link Package} instance,
	 * partitioning unknown keys into `rest` and flattening them back on encode.
	 */
	static readonly schema: Schema.Codec<Package, { readonly [k: string]: unknown }> = makeWire(Package);

	/**
	 * Build the wire codec for a `.extend()`ed subclass, so its custom fields
	 * decode as typed members and are excluded from `rest`.
	 *
	 * @param Class - the extended `Schema.Class`, carrying its own `fields`
	 * @returns a codec between an open JSON object and `Class` instances
	 */
	static wireFor<Self extends Package>(
		// biome-ignore lint/suspicious/noExplicitAny: invariant Encoded slot — see makeWire
		Class: Schema.Codec<Self, any, any, any> & { readonly fields: Record<string, unknown> },
	): Schema.Codec<Self, { readonly [k: string]: unknown }> {
		return makeWire(Class);
	}

	// ── Construction ──────────────────────────────────────────────────────

	/**
	 * Decode an unknown JSON value into a {@link Package}, normalizing any
	 * `SchemaError` to a typed {@link PackageDecodeError} at the boundary.
	 *
	 * @param input - the parsed package.json JSON value (e.g. from `JSON.parse`)
	 * @returns an Effect resolving to the decoded `Package`, failing with
	 * {@link PackageDecodeError} when `input` does not satisfy the schema
	 */
	static readonly decode = Effect.fn("Package.decode")(function* (input: unknown) {
		return yield* Schema.decodeUnknownEffect(Package.schema)(input).pipe(
			Effect.catchTag("SchemaError", (cause) => PackageDecodeError.make({ cause })),
		);
	});

	// ── Computed getters ──────────────────────────────────────────────────

	/** Whether the package is marked private. */
	get isPrivate(): boolean {
		return this.private ?? false;
	}

	/** Whether the package name is scoped (`@scope/name`). */
	get isScoped(): boolean {
		return PackageName.isScoped(this.name);
	}

	/** Whether the package is ESM (`"type": "module"`). */
	get isESM(): boolean {
		return this.type === "module";
	}

	/** Whether any dependency map contains `name`. */
	hasDependency(name: string): boolean {
		return (
			HashMap.has(this.dependencies, name) ||
			HashMap.has(this.devDependencies, name) ||
			HashMap.has(this.peerDependencies, name) ||
			HashMap.has(this.optionalDependencies, name)
		);
	}

	/** The `dependencies` map as {@link Dependency} instances (`kind: "prod"`). */
	getDependencies(): HashMap.HashMap<string, Dependency> {
		return HashMap.map(this.dependencies, (specifier, name) => Dependency.make({ name, specifier, kind: "prod" }));
	}

	/** The `devDependencies` map as {@link Dependency} instances (`kind: "dev"`). */
	getDevDependencies(): HashMap.HashMap<string, Dependency> {
		return HashMap.map(this.devDependencies, (specifier, name) => Dependency.make({ name, specifier, kind: "dev" }));
	}

	/** The `peerDependencies` map as {@link Dependency} instances (`kind: "peer"`), carrying `isOptional` from `peerDependenciesMeta`. */
	getPeerDependencies(): HashMap.HashMap<string, Dependency> {
		const meta = this.peerDependenciesMeta;
		return HashMap.map(this.peerDependencies, (specifier, name) =>
			Dependency.make({ name, specifier, kind: "peer", isOptional: meta?.[name]?.optional ?? false }),
		);
	}

	/** The `optionalDependencies` map as {@link Dependency} instances (`kind: "optional"`). */
	getOptionalDependencies(): HashMap.HashMap<string, Dependency> {
		return HashMap.map(this.optionalDependencies, (specifier, name) =>
			Dependency.make({ name, specifier, kind: "optional" }),
		);
	}

	// ── Immutable mutation ────────────────────────────────────────────────

	/** Return a new {@link Package} with the given fields replaced. */
	copyWith(patch: PackagePatch): Package {
		return Package.make({ ...this, ...patch });
	}

	/** Set the version from a string. Fails with `InvalidVersionError`. Dual API. */
	static readonly setVersion: {
		(version: string): (pkg: Package) => Effect.Effect<Package, InvalidVersionError>;
		(pkg: Package, version: string): Effect.Effect<Package, InvalidVersionError>;
	} = Fn.dual(
		2,
		Effect.fn("Package.setVersion")(function* (pkg: Package, version: string) {
			const semver = yield* SemVer.parse(version);
			return pkg.copyWith({ version: semver });
		}),
	);

	/** Set the package name. Fails with `InvalidPackageNameError`. Dual API. */
	static readonly setName: {
		(name: string): (pkg: Package) => Effect.Effect<Package, InvalidPackageNameError>;
		(pkg: Package, name: string): Effect.Effect<Package, InvalidPackageNameError>;
	} = Fn.dual(
		2,
		Effect.fn("Package.setName")(function* (pkg: Package, name: string) {
			if (!PackageName.isValid(name)) {
				return yield* InvalidPackageNameError.make({ input: name });
			}
			return pkg.copyWith({ name: name as PackageName });
		}),
	);

	/** Set the license from an SPDX string. Fails with `InvalidSpdxLicenseError`. Dual API. */
	static readonly setLicense: {
		(license: string): (pkg: Package) => Effect.Effect<Package, InvalidSpdxLicenseError>;
		(pkg: Package, license: string): Effect.Effect<Package, InvalidSpdxLicenseError>;
	} = Fn.dual(
		2,
		Effect.fn("Package.setLicense")(function* (pkg: Package, license: string) {
			if (!isValidSpdx(license)) {
				return yield* InvalidSpdxLicenseError.make({ input: license });
			}
			return pkg.copyWith({ license: license as SpdxLicense });
		}),
	);

	/** Add or replace a `dependencies` entry. Dual API. */
	static readonly addDependency: {
		(name: string, specifier: string): (pkg: Package) => Package;
		(pkg: Package, name: string, specifier: string): Package;
	} = Fn.dual(3, (pkg: Package, name: string, specifier: string) =>
		pkg.copyWith({ dependencies: HashMap.set(pkg.dependencies, name, specifier) }),
	);

	/** Remove a `dependencies` entry. Dual API. */
	static readonly removeDependency: {
		(name: string): (pkg: Package) => Package;
		(pkg: Package, name: string): Package;
	} = Fn.dual(2, (pkg: Package, name: string) =>
		pkg.copyWith({ dependencies: HashMap.remove(pkg.dependencies, name) }),
	);

	/** Add or replace a `devDependencies` entry. Dual API. */
	static readonly addDevDependency: {
		(name: string, specifier: string): (pkg: Package) => Package;
		(pkg: Package, name: string, specifier: string): Package;
	} = Fn.dual(3, (pkg: Package, name: string, specifier: string) =>
		pkg.copyWith({ devDependencies: HashMap.set(pkg.devDependencies, name, specifier) }),
	);

	/** Remove a `devDependencies` entry. Dual API. */
	static readonly removeDevDependency: {
		(name: string): (pkg: Package) => Package;
		(pkg: Package, name: string): Package;
	} = Fn.dual(2, (pkg: Package, name: string) =>
		pkg.copyWith({ devDependencies: HashMap.remove(pkg.devDependencies, name) }),
	);

	/** Add or replace a `peerDependencies` entry. Dual API. */
	static readonly addPeerDependency: {
		(name: string, specifier: string): (pkg: Package) => Package;
		(pkg: Package, name: string, specifier: string): Package;
	} = Fn.dual(3, (pkg: Package, name: string, specifier: string) =>
		pkg.copyWith({ peerDependencies: HashMap.set(pkg.peerDependencies, name, specifier) }),
	);

	/** Remove a `peerDependencies` entry. Dual API. */
	static readonly removePeerDependency: {
		(name: string): (pkg: Package) => Package;
		(pkg: Package, name: string): Package;
	} = Fn.dual(2, (pkg: Package, name: string) =>
		pkg.copyWith({ peerDependencies: HashMap.remove(pkg.peerDependencies, name) }),
	);

	/** Add or replace an `optionalDependencies` entry. Dual API. */
	static readonly addOptionalDependency: {
		(name: string, specifier: string): (pkg: Package) => Package;
		(pkg: Package, name: string, specifier: string): Package;
	} = Fn.dual(3, (pkg: Package, name: string, specifier: string) =>
		pkg.copyWith({ optionalDependencies: HashMap.set(pkg.optionalDependencies, name, specifier) }),
	);

	/** Remove an `optionalDependencies` entry. Dual API. */
	static readonly removeOptionalDependency: {
		(name: string): (pkg: Package) => Package;
		(pkg: Package, name: string): Package;
	} = Fn.dual(2, (pkg: Package, name: string) =>
		pkg.copyWith({ optionalDependencies: HashMap.remove(pkg.optionalDependencies, name) }),
	);

	/** Add or replace a `scripts` entry. Dual API. */
	static readonly setScript: {
		(name: string, command: string): (pkg: Package) => Package;
		(pkg: Package, name: string, command: string): Package;
	} = Fn.dual(3, (pkg: Package, name: string, command: string) =>
		pkg.copyWith({ scripts: HashMap.set(pkg.scripts, name, command) }),
	);

	/** Remove a `scripts` entry. Dual API. */
	static readonly removeScript: {
		(name: string): (pkg: Package) => Package;
		(pkg: Package, name: string): Package;
	} = Fn.dual(2, (pkg: Package, name: string) => pkg.copyWith({ scripts: HashMap.remove(pkg.scripts, name) }));

	// ── Resolution ────────────────────────────────────────────────────────

	/**
	 * Resolve `catalog:` and `workspace:` specifiers across all four dependency
	 * maps using the `CatalogResolver` and `WorkspaceResolver` from context,
	 * returning a new `Package`. This is the explicit resolution step —
	 * `PackageJsonFile.write` never resolves.
	 *
	 * @remarks
	 * Classification and projection go through `@effected/npm`'s
	 * `DependencySpecifier` statics: `workspace:` uses the pnpm publish-time
	 * projection, and the alias form `workspace:<name>@<range>` resolves the
	 * TARGET package's version and becomes the published `npm:<name>@<range>`
	 * alias. Specifiers the resolvers answer `Option.none()` for are left
	 * unchanged — resolution still succeeds. Fails with `@effected/npm`'s
	 * `CatalogAssemblyError` when catalog assembly failed, or
	 * `DependencyResolutionError` when a resolver's mechanism failed; requires
	 * `CatalogResolver` and `WorkspaceResolver` in `R`. For fail-typed
	 * resolution over the tolerant model, see `@effected/npm`'s
	 * `Manifest#resolve`.
	 *
	 * @example
	 * ```ts
	 * import { Default } from "../npm/index.ts";
	 * import { Package } from "./index.ts";
	 * import { Effect } from "effect";
	 *
	 * const program = Effect.gen(function* () {
	 *   const pkg = yield* Package.decode({
	 *     name: "my-pkg",
	 *     version: "1.0.0",
	 *     dependencies: { effect: "catalog:" },
	 *   });
	 *   return yield* Package.resolve(pkg);
	 * }).pipe(Effect.provide(Default)); // the no-op resolvers leave `catalog:` unchanged
	 * ```
	 *
	 * @param pkg - the package whose specifiers to resolve
	 */
	static readonly resolve = Effect.fn("Package.resolve")(function* (pkg: Package) {
		const workspace = yield* WorkspaceResolver;
		const catalog = yield* CatalogResolver;

		const resolveMap = Effect.fn("Package.resolve.map")(function* (map: HashMap.HashMap<string, string>) {
			let next = map;
			for (const [name, specifier] of HashMap.entries(map)) {
				if (DependencySpecifier.isWorkspace(specifier)) {
					// The alias form resolves the TARGET package's version; the plain
					// form resolves the map key's.
					const target = Option.getOrElse(DependencySpecifier.workspaceTargetOf(specifier), () => name);
					const version = yield* workspace.versionOf(target);
					if (Option.isSome(version)) {
						next = HashMap.set(next, name, DependencySpecifier.resolveWorkspace(specifier, version.value));
					}
				} else if (DependencySpecifier.isCatalog(specifier)) {
					const range = yield* catalog.rangeOf(name, DependencySpecifier.catalogNameOf(specifier));
					if (Option.isSome(range)) {
						next = HashMap.set(next, name, range.value);
					}
				}
			}
			return next;
		});

		return pkg.copyWith({
			dependencies: yield* resolveMap(pkg.dependencies),
			devDependencies: yield* resolveMap(pkg.devDependencies),
			peerDependencies: yield* resolveMap(pkg.peerDependencies),
			optionalDependencies: yield* resolveMap(pkg.optionalDependencies),
		});
	});

	// ── Serialization ─────────────────────────────────────────────────────

	/**
	 * Serialize to a formatted package.json string: encode through the wire
	 * codec (flattening `rest`), then apply the canonical key order, dependency
	 * sorting and empty-map stripping unless the options opt out. Pure.
	 */
	toJsonString(options?: PackageFormatOptions): string {
		const raw = Schema.encodeUnknownSync(Package.schema)(this) as Record<string, unknown>;
		return renderJson(raw, resolveFormatOptions(options));
	}
}
