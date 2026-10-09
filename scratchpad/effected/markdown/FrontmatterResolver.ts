// The frontmatter $schema declaration contract and the registry-backed
// resolver. Dependency-free by design: this module imports `effect` only —
// the version grammar below is the X[.Y[.Z]] contract in ~30 lines, and `@effected/semver` was consciously declined as a peer so
// a consumer who never resolves declarations never loads anything for it.
//
// Its own module (not `Frontmatter.ts`) for the same tree-shaking reason the
// codecs are free-standing: `Frontmatter.ts` stays the lean composition seam,
// and the resolution machinery loads only when a consumer names it.
//
// Resolution is EXACT version-segment equality. Prefix resolution (`skill@2`
// selecting the highest registered `2.y.z`) is not offered.

import { Effect, Result, Schema } from "effect";

/**
 * A `$schema` declaration referencing a schema by URL — any string containing
 * `://`.
 *
 * @remarks
 * Carried as data, never resolved in-package: the pure tier does no IO. An
 * external resolver implementing {@link FrontmatterSchemaResolver} may fetch
 * and interpret it.
 *
 * @public
 */
export class SchemaDeclarationByUrl extends Schema.TaggedClass<SchemaDeclarationByUrl>()("ByUrl", {
	/** The URL as written in the declaration. */
	url: Schema.String,
}) {}

/**
 * A `$schema` declaration referencing a schema by path — any string starting
 * `./`, `../` or `/` (a bundle- or file-relative reference).
 *
 * @remarks
 * Carried as data, never resolved in-package: the pure tier does no IO.
 *
 * @public
 */
export class SchemaDeclarationByPath extends Schema.TaggedClass<SchemaDeclarationByPath>()("ByPath", {
	/** The path as written in the declaration. */
	path: Schema.String,
}) {}

/**
 * A `$schema` declaration carrying an inline JSON-Schema-like document — the
 * declaration value is itself a mapping.
 *
 * @remarks
 * Carried as data: the kit deliberately ships no JSON Schema engine
 * (`@effected/json-schema` is off the roadmap), so an inline document is
 * interpretable only through an external resolver plugged into the
 * {@link FrontmatterSchemaResolver} seam.
 *
 * @public
 */
export class SchemaDeclarationInline extends Schema.TaggedClass<SchemaDeclarationInline>()("Inline", {
	/** The inline schema document, exactly as decoded from the frontmatter. */
	document: Schema.Unknown,
}) {}

/**
 * A `$schema` declaration referencing a registered schema by name — any other
 * string, with the committed `name[@version]` grammar.
 *
 * @remarks
 * The string splits at the **last** `@`, so a leading npm-style scope
 * survives: `@savvy/skill@2.1.0` is name `@savvy/skill`, version `2.1.0`.
 * The version grammar is `X[.Y[.Z]]` — one to three dot-separated
 * non-negative integers; no prerelease, no build metadata, no npm range
 * operators. The recorded cost: `@` in a name is reserved forever as the
 * version separator, except the leading scope `@`.
 *
 * @public
 */
export class SchemaDeclarationByName extends Schema.TaggedClass<SchemaDeclarationByName>()("ByName", {
	/** The name as written, scope included. */
	name: Schema.String,
	/** The version as written, when the declaration carries one. */
	version: Schema.optionalKey(Schema.String),
}) {}

/**
 * The classified `$schema` declaration union — the full grammar contract for
 * how a frontmatter block may self-describe its schema.
 *
 * @public
 */
export const SchemaDeclaration = Schema.Union([
	SchemaDeclarationByUrl,
	SchemaDeclarationByPath,
	SchemaDeclarationInline,
	SchemaDeclarationByName,
]);

/**
 * The union of all classified `$schema` declaration shapes.
 *
 * @public
 */
export type SchemaDeclaration =
	| SchemaDeclarationByUrl
	| SchemaDeclarationByPath
	| SchemaDeclarationInline
	| SchemaDeclarationByName;

/**
 * Indicates that a `$schema` value does not classify: not a string or a
 * mapping, an empty string, or a name whose version segment falls outside the
 * committed `X[.Y[.Z]]` grammar.
 *
 * @public
 */
export class SchemaDeclarationInvalidError extends Schema.TaggedError<SchemaDeclarationInvalidError>()(
	"SchemaDeclarationInvalidError",
	{
		/** Why the value failed to classify. */
		reason: Schema.String,
		/** The offending value, preserved structurally. */
		value: Schema.Defect(),
	},
) {
	override get message(): string {
		return `invalid $schema declaration: ${this.reason}`;
	}
}

/**
 * Indicates that frontmatter data carries no `$schema` declaration where one
 * is required — the `requireDeclaration` strictness knob, or a registry
 * resolver that has nothing to dispatch on.
 *
 * @public
 */
export class SchemaDeclarationMissingError extends Schema.TaggedError<SchemaDeclarationMissingError>()(
	"SchemaDeclarationMissingError",
	{},
) {
	override get message(): string {
		return "the frontmatter data carries no $schema declaration";
	}
}

/**
 * Indicates that a declaration named a schema the resolver does not know —
 * an unregistered name, or a URL/path/inline declaration handed to the
 * name-keyed registry resolver.
 *
 * @public
 */
export class SchemaNameUnknownError extends Schema.TaggedError<SchemaNameUnknownError>()("SchemaNameUnknownError", {
	/** The declaration that failed to resolve, when one exists. */
	declaration: Schema.optionalKey(SchemaDeclaration),
}) {
	override get message(): string {
		return "the $schema declaration names no registered schema";
	}
}

/**
 * Indicates that a declaration's name is registered but its version segments
 * match no registration exactly — distinct from {@link SchemaNameUnknownError}
 * by design, so a legal-but-unsatisfied partial version (`skill@2` against a
 * `skill@2.1.0` registration) is diagnosable as a version problem, not an
 * unknown schema.
 *
 * @public
 */
export class SchemaVersionUnresolvableError extends Schema.TaggedError<SchemaVersionUnresolvableError>()(
	"SchemaVersionUnresolvableError",
	{
		/** The registered name whose version could not be satisfied. */
		name: Schema.String,
		/** The requested version, when the declaration carried one. */
		version: Schema.optionalKey(Schema.String),
	},
) {
	override get message(): string {
		return this.version === undefined
			? `schema "${this.name}" is registered only with versions; the declaration carries none`
			: `schema "${this.name}" has no registration matching version "${this.version}" exactly`;
	}
}

/**
 * The union of everything declaration resolution can fail with.
 *
 * @public
 */
export type FrontmatterResolveError =
	| SchemaDeclarationMissingError
	| SchemaNameUnknownError
	| SchemaVersionUnresolvableError;

/**
 * The resolver seam: given a classified declaration **and** the whole decoded
 * frontmatter data, produce the schema to validate with, or fail typed.
 *
 * @remarks
 * The whole-data second argument is the dispatch seam: because a resolver
 * sees everything the frontmatter decoded to, it need not key on `$schema`
 * at all — an OKF resolver dispatches on OKF's `type` field with zero OKF
 * code in this package. `E` widens the error channel for custom resolvers;
 * the built-in registry resolver keeps it `never`.
 *
 * @public
 */
export interface FrontmatterSchemaResolver<E = never> {
	/** Resolve a declaration (possibly absent) against decoded frontmatter data. */
	readonly resolve: (
		declaration: SchemaDeclaration | undefined,
		data: unknown,
	) => Effect.Effect<Schema.Top, FrontmatterResolveError | E>;
}

// The committed version grammar: one to three dot-separated non-negative
// integer segments. Parsed to numbers so equality is numeric — "02.1.00" and
// "2.1.0" carry the same segments ("identically written" modulo integer
// value); leading zeros are legal, npm-style prerelease/build/range syntax is
// not.
const parseVersionSegments = (version: string): ReadonlyArray<number> | undefined => {
	if (!/^\d+(\.\d+){0,2}$/.test(version)) {
		return undefined;
	}
	return version.split(".").map((segment) => Number.parseInt(segment, 10));
};

const isMapping = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The `$schema` declaration classifier and the package's one built-in
 * resolver implementation.
 *
 * @public
 */
export class SchemaResolver {
	/**
	 * Classify a raw `$schema` value into the declaration union.
	 *
	 * @remarks
	 * Total over its legal domain and typed on junk: a string containing
	 * `://` is {@link SchemaDeclarationByUrl}; a string starting `./`, `../`
	 * or `/` is {@link SchemaDeclarationByPath}; a mapping is
	 * {@link SchemaDeclarationInline}; any other non-empty string is
	 * {@link SchemaDeclarationByName} under the `name[@version]` grammar.
	 * Everything else — and a name whose version falls outside `X[.Y[.Z]]` —
	 * fails with {@link SchemaDeclarationInvalidError}.
	 *
	 * @param value - The raw `$schema` value from decoded frontmatter data.
	 * @returns The classified declaration, or the typed classification error.
	 */
	static classify(value: unknown): Result.Result<SchemaDeclaration, SchemaDeclarationInvalidError> {
		if (typeof value === "string") {
			if (value.length === 0) {
				return Result.fail(new SchemaDeclarationInvalidError({ reason: "the declaration is empty", value }));
			}
			if (value.includes("://")) {
				return Result.succeed(new SchemaDeclarationByUrl({ url: value }));
			}
			if (value.startsWith("./") || value.startsWith("../") || value.startsWith("/")) {
				return Result.succeed(new SchemaDeclarationByPath({ path: value }));
			}
			const separator = value.lastIndexOf("@");
			if (separator <= 0) {
				// No separator, or only the leading scope @ — the whole string is
				// the name.
				return Result.succeed(new SchemaDeclarationByName({ name: value }));
			}
			const name = value.slice(0, separator);
			const version = value.slice(separator + 1);
			if (parseVersionSegments(version) === undefined) {
				return Result.fail(
					new SchemaDeclarationInvalidError({
						reason: `version "${version}" is outside the X[.Y[.Z]] integer grammar`,
						value,
					}),
				);
			}
			return Result.succeed(new SchemaDeclarationByName({ name, version }));
		}
		if (isMapping(value)) {
			return Result.succeed(new SchemaDeclarationInline({ document: value }));
		}
		return Result.fail(
			new SchemaDeclarationInvalidError({ reason: "the declaration is neither a string nor a mapping", value }),
		);
	}

	/**
	 * Extract and classify the `$schema` declaration from decoded frontmatter
	 * data.
	 *
	 * @remarks
	 * Non-mapping data and a mapping without a `$schema` key both carry no
	 * declaration: the result succeeds with `undefined` by default, or fails
	 * with {@link SchemaDeclarationMissingError} under `requireDeclaration`.
	 *
	 * @param data - The decoded frontmatter data.
	 * @param options - `requireDeclaration` makes a missing `$schema` a typed
	 *   error.
	 * @returns The classified declaration, `undefined` when absent and
	 *   tolerated, or the typed error.
	 */
	static declarationOf(
		data: unknown,
		options?: { readonly requireDeclaration?: boolean },
	): Result.Result<SchemaDeclaration | undefined, SchemaDeclarationInvalidError | SchemaDeclarationMissingError> {
		if (!isMapping(data) || !Object.hasOwn(data, "$schema")) {
			return options?.requireDeclaration === true
				? Result.fail(new SchemaDeclarationMissingError())
				: Result.succeed(undefined);
		}
		return SchemaResolver.classify(data.$schema);
	}

	/**
	 * The package's one built-in resolver: a name-keyed registry with
	 * exact version-segment resolution.
	 *
	 * @remarks
	 * Registration keys use the same `name[@version]` grammar as declarations
	 * — carrying a concrete version or none — and are validated eagerly: a key
	 * outside the grammar, or two keys whose version segments collide
	 * numerically, throws at construction (programmer error, not input).
	 *
	 * Resolution is exact: a declaration resolves only against an identically
	 * written registration (version segments compared numerically), a
	 * versionless declaration only against a versionless registration, and a
	 * legal-but-unsatisfied version fails with the dedicated
	 * {@link SchemaVersionUnresolvableError}, distinct from
	 * {@link SchemaNameUnknownError}. URL, path and inline declarations are
	 * never resolvable here — those belong to external resolvers plugged into
	 * the same seam. A registry cannot dispatch without a declaration, so an
	 * absent one fails with {@link SchemaDeclarationMissingError}.
	 *
	 * @param registrations - Schemas keyed by `name[@version]`.
	 * @returns The registry-backed resolver.
	 */
	static fromRegistry(registrations: Readonly<Record<string, Schema.Top>>): FrontmatterSchemaResolver {
		// A real Map keyed by name: registration names are configuration, not
		// attacker data, but the prototype-pollution guard costs nothing here.
		const byName = new Map<string, { versionless?: Schema.Top; versions: Map<string, Schema.Top> }>();
		for (const [key, schema] of Object.entries(registrations)) {
			const classified = SchemaResolver.classify(key);
			if (Result.isFailure(classified) || !(classified.success instanceof SchemaDeclarationByName)) {
				throw new Error(`SchemaResolver.fromRegistry: registration key "${key}" is outside the name[@version] grammar`);
			}
			const declaration = classified.success;
			const entry = byName.get(declaration.name) ?? { versions: new Map<string, Schema.Top>() };
			if (declaration.version === undefined) {
				if (entry.versionless !== undefined) {
					throw new Error(`SchemaResolver.fromRegistry: duplicate versionless registration for "${declaration.name}"`);
				}
				entry.versionless = schema;
			} else {
				const segments = parseVersionSegments(declaration.version);
				if (segments === undefined) {
					throw new Error(`SchemaResolver.fromRegistry: registration key "${key}" carries an illegal version`);
				}
				const canonical = segments.join(".");
				if (entry.versions.has(canonical)) {
					throw new Error(
						`SchemaResolver.fromRegistry: registrations for "${declaration.name}" collide on version ${canonical}`,
					);
				}
				entry.versions.set(canonical, schema);
			}
			byName.set(declaration.name, entry);
		}
		return {
			resolve: (declaration, _data) => {
				if (declaration === undefined) {
					return Effect.fail(new SchemaDeclarationMissingError());
				}
				if (!(declaration instanceof SchemaDeclarationByName)) {
					return Effect.fail(new SchemaNameUnknownError({ declaration }));
				}
				const entry = byName.get(declaration.name);
				if (entry === undefined) {
					return Effect.fail(new SchemaNameUnknownError({ declaration }));
				}
				if (declaration.version === undefined) {
					return entry.versionless === undefined
						? Effect.fail(new SchemaVersionUnresolvableError({ name: declaration.name }))
						: Effect.succeed(entry.versionless);
				}
				const segments = parseVersionSegments(declaration.version);
				const match = segments === undefined ? undefined : entry.versions.get(segments.join("."));
				return match === undefined
					? Effect.fail(new SchemaVersionUnresolvableError({ name: declaration.name, version: declaration.version }))
					: Effect.succeed(match);
			},
		};
	}
}
