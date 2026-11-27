/**
 * The frontmatter `$schema` declaration contract and the registry-backed
 * resolver.
 *
 * **Details**
 *
 * Dependency-free by design: the version grammar is the `X[.Y[.Z]]`
 * contract implemented locally, so a consumer who never resolves
 * declarations loads nothing extra. Its own module, not `Frontmatter.ts`, for
 * the same tree-shaking reason the codecs are free-standing.
 *
 * Resolution is exact version-segment equality. Prefix resolution (`skill@2`
 * selecting the highest registered `2.y.z`) is not offered.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $MarkdownId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $MarkdownId.create("FrontmatterResolver");

class SchemaRegistryError extends S.TaggedError<SchemaRegistryError, { readonly brand: unique symbol }>(
  $I`SchemaRegistryError`
)(
  "SchemaRegistryError",
  {
    message: S.String,
  },
  $I.annoteError<SchemaRegistryError>("SchemaRegistryError", {
    description: "Invalid or conflicting registry configuration.",
  })
) {}

/**
 * **Details**
 *
 * Carried as data, never resolved in-package: the pure tier does no IO. An
 * external resolver implementing {@link FrontmatterSchemaResolver} may fetch
 * and interpret it.
 *
 * **Example** (Carry a schema URL)
 *
 * ```ts
 * import { SchemaDeclarationByUrl } from "@beep/markdown/FrontmatterResolver"
 *
 * const declaration = SchemaDeclarationByUrl.make({ url: "https://example.com/skill.json" })
 * console.log(declaration.url) // https://example.com/skill.json
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class SchemaDeclarationByUrl extends S.Opaque<SchemaDeclarationByUrl, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ByUrl", {
    /**
     * The URL as written in the declaration.
     *
     * @since 0.0.0
     */
    url: S.String.pipe(
      $I.annoteKey("SchemaDeclarationByUrl.url", { description: "The URL as written in the declaration." })
    ),
  }).pipe(
    $I.annoteSchema("SchemaDeclarationByUrl", {
      description: "A `$schema` declaration referencing a schema by URL — any string containing `://`.",
    })
  )
) {}

/**
 * **Details**
 *
 * Carried as data, never resolved in-package: the pure tier does no IO.
 *
 * **Example** (Carry a relative schema path)
 *
 * ```ts
 * import { SchemaDeclarationByPath } from "@beep/markdown/FrontmatterResolver"
 *
 * const declaration = SchemaDeclarationByPath.make({ path: "./skill.json" })
 * console.log(declaration.path) // ./skill.json
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class SchemaDeclarationByPath extends S.Opaque<SchemaDeclarationByPath, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ByPath", {
    /**
     * The path as written in the declaration.
     *
     * @since 0.0.0
     */
    path: S.String.pipe(
      $I.annoteKey("SchemaDeclarationByPath.path", { description: "The path as written in the declaration." })
    ),
  }).pipe(
    $I.annoteSchema("SchemaDeclarationByPath", {
      description:
        "A `$schema` declaration referencing a schema by path — any string starting `./`, `../` or `/` (a bundle- or file-relative reference).",
    })
  )
) {}

/**
 * **Details**
 *
 * Carried as data: the kit deliberately ships no JSON Schema engine
 * (`@effected/json-schema` is off the roadmap), so an inline document is
 * interpretable only through an external resolver plugged into the
 * {@link FrontmatterSchemaResolver} seam.
 *
 * **Example** (Carry an inline schema document)
 *
 * ```ts
 * import { SchemaDeclarationInline } from "@beep/markdown/FrontmatterResolver"
 *
 * const declaration = SchemaDeclarationInline.make({ document: { type: "object" } })
 * console.log(declaration._tag) // Inline
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class SchemaDeclarationInline extends S.Opaque<SchemaDeclarationInline, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Inline", {
    /**
     * The inline schema document, exactly as decoded from the frontmatter.
     *
     * @since 0.0.0
     */
    document: S.Unknown.pipe(
      $I.annoteKey("SchemaDeclarationInline.document", {
        description: "The inline schema document, exactly as decoded from the frontmatter.",
      })
    ),
  }).pipe(
    $I.annoteSchema("SchemaDeclarationInline", {
      description:
        "A `$schema` declaration carrying an inline JSON-Schema-like document — the declaration value is itself a mapping.",
    })
  )
) {}

/**
 * **Details**
 *
 * The string splits at the **last** `@`, so a leading npm-style scope
 * survives: `@savvy/skill@2.1.0` is name `@savvy/skill`, version `2.1.0`.
 * The version grammar is `X[.Y[.Z]]` — one to three dot-separated
 * non-negative integers; no prerelease, no build metadata, no npm range
 * operators. The recorded cost: `@` in a name is reserved forever as the
 * version separator, except the leading scope `@`.
 *
 * **Example** (Preserve a scoped schema name)
 *
 * ```ts
 * import { SchemaDeclarationByName } from "@beep/markdown/FrontmatterResolver"
 *
 * const declaration = SchemaDeclarationByName.make({ name: "@savvy/skill", version: "2.1.0" })
 * console.log(declaration.name) // @savvy/skill
 * console.log(declaration.version) // 2.1.0
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class SchemaDeclarationByName extends S.Opaque<SchemaDeclarationByName, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ByName", {
    /**
     * The name as written, scope included.
     *
     * @since 0.0.0
     */
    name: S.String.pipe(
      $I.annoteKey("SchemaDeclarationByName.name", { description: "The name as written, scope included." })
    ),
    /**
     * The version as written, when the declaration carries one.
     *
     * @since 0.0.0
     */
    version: S.optionalKey(S.String).pipe(
      $I.annoteKey("SchemaDeclarationByName.version", {
        description: "The version as written, when the declaration carries one.",
      })
    ),
  }).pipe(
    $I.annoteSchema("SchemaDeclarationByName", {
      description:
        "A `$schema` declaration referencing a registered schema by name — any other string, with the committed `name[@version]` grammar.",
    })
  )
) {}

/**
 * **Example** (Recognize a classified declaration)
 *
 * ```ts
 * import { SchemaDeclaration, SchemaDeclarationByName } from "@beep/markdown/FrontmatterResolver"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SchemaDeclaration)(SchemaDeclarationByName.make({ name: "skill" }))) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const SchemaDeclaration = S.Union([
  SchemaDeclarationByUrl,
  SchemaDeclarationByPath,
  SchemaDeclarationInline,
  SchemaDeclarationByName,
]).pipe(
  $I.annoteSchema("SchemaDeclaration", {
    description:
      "The classified `$schema` declaration union — the full grammar contract for how a frontmatter block may self-describe its schema.",
  })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type SchemaDeclaration =
  | SchemaDeclarationByUrl
  | SchemaDeclarationByPath
  | SchemaDeclarationInline
  | SchemaDeclarationByName;

/**
 * **Example** (Describe an empty declaration)
 *
 * ```ts
 * import { SchemaDeclarationInvalidError } from "@beep/markdown/FrontmatterResolver"
 *
 * const error = SchemaDeclarationInvalidError.make({ reason: "the declaration is empty", value: "" })
 * console.log(error.message) // invalid $schema declaration: the declaration is empty
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class SchemaDeclarationInvalidError extends S.TaggedError<
  SchemaDeclarationInvalidError,
  { readonly brand: unique symbol }
>($I`SchemaDeclarationInvalidError`)(
  "SchemaDeclarationInvalidError",
  {
    /**
     * Why the value failed to classify.
     *
     * @since 0.0.0
     */
    reason: S.String.pipe(
      $I.annoteKey("SchemaDeclarationInvalidError.reason", { description: "Why the value failed to classify." })
    ),
    /**
     * The offending value, preserved structurally.
     *
     * @since 0.0.0
     */
    value: S.Defect().pipe(
      $I.annoteKey("SchemaDeclarationInvalidError.value", {
        description: "The offending value, preserved structurally.",
      })
    ),
  },
  $I.annoteError<SchemaDeclarationInvalidError>("SchemaDeclarationInvalidError", {
    description:
      "Indicates that a `$schema` value does not classify: not a string or a mapping, an empty string, or a name whose version segment falls outside the committed `X[.Y[.Z]]` grammar.",
  })
) {
  /**
   * Explains why the raw `$schema` value could not be classified.
   *
   * **Example** (Read the resolution failure message)
   *
   * ```ts
   * import { SchemaDeclarationInvalidError } from "@beep/markdown/FrontmatterResolver"
   *
   * const error = SchemaDeclarationInvalidError.make({ reason: "the declaration is empty", value: "" })
   * console.log(error.message) // invalid $schema declaration: the declaration is empty
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `invalid $schema declaration: ${this.reason}`;
  }
}

/**
 * **Example** (Describe a missing declaration)
 *
 * ```ts
 * import { SchemaDeclarationMissingError } from "@beep/markdown/FrontmatterResolver"
 *
 * console.log(SchemaDeclarationMissingError.make().message) // the frontmatter data carries no $schema declaration
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class SchemaDeclarationMissingError extends S.TaggedError<
  SchemaDeclarationMissingError,
  { readonly brand: unique symbol }
>($I`SchemaDeclarationMissingError`)(
  "SchemaDeclarationMissingError",
  {},
  $I.annoteError<SchemaDeclarationMissingError>("SchemaDeclarationMissingError", {
    description:
      "Indicates that frontmatter data carries no `$schema` declaration where one is required — the `requireDeclaration` strictness knob, or a registry resolver that has nothing to dispatch on.",
  })
) {
  /**
   * Explains that required frontmatter schema metadata is absent.
   *
   * **Example** (Read the resolution failure message)
   *
   * ```ts
   * import { SchemaDeclarationMissingError } from "@beep/markdown/FrontmatterResolver"
   *
   * console.log(SchemaDeclarationMissingError.make().message) // the frontmatter data carries no $schema declaration
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return "the frontmatter data carries no $schema declaration";
  }
}

/**
 * **Example** (Describe an unregistered schema name)
 *
 * ```ts
 * import { SchemaNameUnknownError, SchemaDeclarationByName } from "@beep/markdown/FrontmatterResolver"
 *
 * const error = SchemaNameUnknownError.make({ declaration: SchemaDeclarationByName.make({ name: "unknown" }) })
 * console.log(error.message) // the $schema declaration names no registered schema
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class SchemaNameUnknownError extends S.TaggedError<SchemaNameUnknownError, { readonly brand: unique symbol }>(
  $I`SchemaNameUnknownError`
)(
  "SchemaNameUnknownError",
  {
    /**
     * The declaration that failed to resolve, when one exists.
     *
     * @since 0.0.0
     */
    declaration: S.optionalKey(SchemaDeclaration).pipe(
      $I.annoteKey("SchemaNameUnknownError.declaration", {
        description: "The declaration that failed to resolve, when one exists.",
      })
    ),
  },
  $I.annoteError<SchemaNameUnknownError>("SchemaNameUnknownError", {
    description:
      "Indicates that a declaration named a schema the resolver does not know — an unregistered name, or a URL/path/inline declaration handed to the name-keyed registry resolver.",
  })
) {
  /**
   * Explains that the declaration identifies no registered schema.
   *
   * **Example** (Read the resolution failure message)
   *
   * ```ts
   * import { SchemaNameUnknownError, SchemaDeclarationByName } from "@beep/markdown/FrontmatterResolver"
   *
   * const error = SchemaNameUnknownError.make({ declaration: SchemaDeclarationByName.make({ name: "unknown" }) })
   * console.log(error.message) // the $schema declaration names no registered schema
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return "the $schema declaration names no registered schema";
  }
}

/**
 * **Example** (Describe an unmatched partial version)
 *
 * ```ts
 * import { SchemaVersionUnresolvableError } from "@beep/markdown/FrontmatterResolver"
 *
 * const error = SchemaVersionUnresolvableError.make({ schemaName: "skill", version: "2" })
 * console.log(error.message) // schema "skill" has no registration matching version "2" exactly
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class SchemaVersionUnresolvableError extends S.TaggedError<
  SchemaVersionUnresolvableError,
  { readonly brand: unique symbol }
>($I`SchemaVersionUnresolvableError`)(
  "SchemaVersionUnresolvableError",
  {
    /**
     * The registered name whose version could not be satisfied.
     *
     * @since 0.0.0
     */
    schemaName: S.String.pipe(
      $I.annoteKey("SchemaVersionUnresolvableError.schemaName", {
        description: "The registered name whose version could not be satisfied.",
      })
    ),
    /**
     * The requested version, when the declaration carried one.
     *
     * @since 0.0.0
     */
    version: S.optionalKey(S.String).pipe(
      $I.annoteKey("SchemaVersionUnresolvableError.version", {
        description: "The requested version, when the declaration carried one.",
      })
    ),
  },
  $I.annoteError<SchemaVersionUnresolvableError>("SchemaVersionUnresolvableError", {
    description:
      "Indicates that a declaration's name is registered but its version segments match no registration exactly — distinct from SchemaNameUnknownError by design, so a legal-but-unsatisfied partial version (`skill@2` against a `skill@2.1.0` registration) is diagnosable as a version problem, not an unknown schema.",
  })
) {
  /**
   * Distinguishes an absent version from a requested version with no exact match.
   *
   * **Example** (Read the resolution failure message)
   *
   * ```ts
   * import { SchemaVersionUnresolvableError } from "@beep/markdown/FrontmatterResolver"
   *
   * const error = SchemaVersionUnresolvableError.make({ schemaName: "skill", version: "2" })
   * console.log(error.message) // schema "skill" has no registration matching version "2" exactly
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return this.version === undefined
      ? `schema "${this.schemaName}" is registered only with versions; the declaration carries none`
      : `schema "${this.schemaName}" has no registration matching version "${this.version}" exactly`;
  }
}

/**
 * The union of everything declaration resolution can fail with.
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export type FrontmatterResolveError =
  | SchemaDeclarationMissingError
  | SchemaNameUnknownError
  | SchemaVersionUnresolvableError;

/**
 * The resolver seam: given a classified declaration **and** the whole decoded
 * frontmatter data, produce the schema to validate with, or fail typed.
 *
 * **Details**
 *
 * The whole-data second argument is the dispatch seam: because a resolver
 * sees everything the frontmatter decoded to, it need not key on `$schema`
 * at all — an OKF resolver dispatches on OKF's `type` field with zero OKF
 * code in this package. `E` widens the error channel for custom resolvers;
 * the built-in registry resolver keeps it `never`.
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export interface FrontmatterSchemaResolver<E = never> {
  /**
   * Resolve a declaration (possibly absent) against decoded frontmatter data.
   *
   * **Example** (Invoke the resolver seam)
   *
   * ```ts
   * import { SchemaResolver, SchemaDeclarationByName } from "@beep/markdown/FrontmatterResolver"
   * import * as Effect from "effect/Effect"
   * import * as S from "effect/Schema"
   *
   * const resolver = SchemaResolver.fromRegistry({ skill: S.String })
   * const schema = Effect.runSync(resolver.resolve(SchemaDeclarationByName.make({ name: "skill" }), {}))
   * console.log(schema === S.String) // true
   * ```
   *
   * @since 0.0.0
   */
  readonly resolve: {
    (declaration: SchemaDeclaration | undefined, data: unknown): Effect.Effect<S.Top, FrontmatterResolveError | E>;
    (data: unknown): (declaration: SchemaDeclaration | undefined) => Effect.Effect<S.Top, FrontmatterResolveError | E>;
  };
}

const VersionString = S.String.check(S.isPattern(/^\d+(\.\d+){0,2}$/)).pipe(
  $I.annoteSchema("VersionString", {
    description:
      "One to three dot-separated non-negative integer segments, with leading zeros allowed and no prerelease, build or range syntax; versions compare as canonical decimal strings, so `02.1.00` equals `2.1.0` and large segments never round.",
  })
);
const isVersionString = S.is(VersionString);
const canonicalSegments = (version: string): ReadonlyArray<string> =>
  A.map(Str.split(version, "."), Str.replace(/^0+(?=\d)/, ""));

const isMapping = (value: unknown): value is Record<string, unknown> =>
  P.isObjectKeyword(value) && !P.isFunction(value) && !A.isArray(value);

const PATH_REFERENCE = /^(?:\.\.?)?\//;

const isUrlReference = Str.includes("://");

const canonicalVersion = (version: string): string => A.join(canonicalSegments(version), ".");

const classifyName = (value: string): Result.Result<SchemaDeclaration, SchemaDeclarationInvalidError> => {
  const versionSeparatorAfterScope = O.filter(Str.lastIndexOf("@")(value), (separator) => separator > 0);
  return O.match(versionSeparatorAfterScope, {
    onNone: () => Result.succeed(SchemaDeclarationByName.make({ name: value })),
    onSome: (separator) => {
      const version = Str.slice(separator + 1)(value);
      return isVersionString(version)
        ? Result.succeed(SchemaDeclarationByName.make({ name: Str.slice(0, separator)(value), version }))
        : Result.fail(
            SchemaDeclarationInvalidError.make({
              reason: `version "${version}" is outside the X[.Y[.Z]] integer grammar`,
              value,
            })
          );
    },
  });
};

const classifyString = (value: string): Result.Result<SchemaDeclaration, SchemaDeclarationInvalidError> => {
  if (value.length === 0) {
    return Result.fail(SchemaDeclarationInvalidError.make({ reason: "the declaration is empty", value }));
  }
  if (isUrlReference(value)) {
    return Result.succeed(SchemaDeclarationByUrl.make({ url: value }));
  }
  return PATH_REFERENCE.test(value)
    ? Result.succeed(SchemaDeclarationByPath.make({ path: value }))
    : classifyName(value);
};

interface RegistryEntry {
  versionless: O.Option<S.Top>;
  readonly versions: MutableHashMap.MutableHashMap<string, S.Top>;
}

const register = (byName: MutableHashMap.MutableHashMap<string, RegistryEntry>, key: string, schema: S.Top): void => {
  const classified = classifyString(key);
  if (Result.isFailure(classified) || !S.is(SchemaDeclarationByName)(classified.success)) {
    throw SchemaRegistryError.make({
      message: `SchemaResolver.fromRegistry: registration key "${key}" is outside the name[@version] grammar`,
    });
  }
  const declaration = classified.success;
  const entry = O.getOrElse(
    MutableHashMap.get(byName, declaration.name),
    (): RegistryEntry => ({ versionless: O.none(), versions: MutableHashMap.empty<string, S.Top>() })
  );
  if (declaration.version === undefined) {
    entry.versionless = O.some(schema);
  } else {
    const canonical = canonicalVersion(declaration.version);
    if (MutableHashMap.has(entry.versions, canonical)) {
      throw SchemaRegistryError.make({
        message: `SchemaResolver.fromRegistry: registrations for "${declaration.name}" collide on version ${canonical}`,
      });
    }
    MutableHashMap.set(entry.versions, canonical, schema);
  }
  MutableHashMap.set(byName, declaration.name, entry);
};

const resolveVersion = (
  declaration: SchemaDeclarationByName,
  entry: RegistryEntry
): Effect.Effect<S.Top, FrontmatterResolveError> => {
  const version = declaration.version;
  const match =
    version === undefined
      ? entry.versionless
      : isVersionString(version)
        ? MutableHashMap.get(entry.versions, canonicalVersion(version))
        : O.none();
  return Effect.fromOption(match).pipe(
    Effect.mapError(() =>
      version === undefined
        ? SchemaVersionUnresolvableError.make({ schemaName: declaration.name })
        : SchemaVersionUnresolvableError.make({ schemaName: declaration.name, version })
    )
  );
};

const resolveFrom =
  (byName: MutableHashMap.MutableHashMap<string, RegistryEntry>) =>
  (declaration: SchemaDeclaration | undefined): Effect.Effect<S.Top, FrontmatterResolveError> => {
    if (declaration === undefined) {
      return Effect.fail(SchemaDeclarationMissingError.make());
    }
    if (!S.is(SchemaDeclarationByName)(declaration)) {
      return Effect.fail(SchemaNameUnknownError.make({ declaration }));
    }
    return O.match(MutableHashMap.get(byName, declaration.name), {
      onNone: () => Effect.fail(SchemaNameUnknownError.make({ declaration })),
      onSome: (entry) => resolveVersion(declaration, entry),
    });
  };

/**
 * The `$schema` declaration classifier and the package's one built-in
 * resolver implementation.
 *
 * **Example** (Classify a named schema declaration)
 *
 * ```ts
 * import { SchemaResolver } from "@beep/markdown/FrontmatterResolver"
 * import * as Result from "effect/Result"
 *
 * console.log(Result.isSuccess(SchemaResolver.classify("skill@2.1.0"))) // true
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class SchemaResolver {
  /**
   * Classify a raw `$schema` value into the declaration union.
   *
   * **Details**
   *
   * Total over its legal domain and typed on junk: a string containing
   * `://` is {@link SchemaDeclarationByUrl}; a string starting `./`, `../`
   * or `/` is {@link SchemaDeclarationByPath}; a mapping is
   * {@link SchemaDeclarationInline}; any other non-empty string is
   * {@link SchemaDeclarationByName} under the `name[@version]` grammar.
   * Everything else — and a name whose version falls outside `X[.Y[.Z]]` —
   * fails with {@link SchemaDeclarationInvalidError}.
   *
   * **Example** (Reject an invalid version)
   *
   * ```ts
   * import { SchemaResolver } from "@beep/markdown/FrontmatterResolver"
   * import * as Result from "effect/Result"
   *
   * console.log(Result.isFailure(SchemaResolver.classify("skill@^2"))) // true
   * ```
   *
   * @param value - The raw `$schema` value from decoded frontmatter data.
   * @returns The classified declaration, or the typed classification error.
   * @category parsing
   * @since 0.0.0
   */
  static classify(value: unknown): Result.Result<SchemaDeclaration, SchemaDeclarationInvalidError> {
    if (P.isString(value)) {
      return classifyString(value);
    }
    return isMapping(value)
      ? Result.succeed(SchemaDeclarationInline.make({ document: value }))
      : Result.fail(
          SchemaDeclarationInvalidError.make({ reason: "the declaration is neither a string nor a mapping", value })
        );
  }

  /**
   * Extract and classify the `$schema` declaration from decoded frontmatter
   * data.
   *
   * **Details**
   *
   * Non-mapping data and a mapping without a `$schema` key both carry no
   * declaration: the result succeeds with `undefined` by default, or fails
   * with {@link SchemaDeclarationMissingError} under `requireDeclaration`.
   *
   * **Example** (Compare optional and required declarations)
   *
   * ```ts
   * import { SchemaResolver } from "@beep/markdown/FrontmatterResolver"
   * import * as Result from "effect/Result"
   *
   * console.log(Result.getOrThrow(SchemaResolver.declarationOf({}))) // undefined
   * console.log(Result.isFailure(SchemaResolver.declarationOf({}, { requireDeclaration: true }))) // true
   * ```
   *
   * @param data - The decoded frontmatter data.
   * @param options - `requireDeclaration` makes a missing `$schema` a typed
   *   error.
   * @returns The classified declaration, `undefined` when absent and
   *   tolerated, or the typed error.
   * @category parsing
   * @since 0.0.0
   */
  static declarationOf(
    data: unknown,
    options?: { readonly requireDeclaration?: boolean }
  ): Result.Result<SchemaDeclaration | undefined, SchemaDeclarationInvalidError | SchemaDeclarationMissingError> {
    if (!isMapping(data) || !R.has(data, "$schema")) {
      return options?.requireDeclaration === true
        ? Result.fail(SchemaDeclarationMissingError.make())
        : Result.succeed(undefined);
    }
    return SchemaResolver.classify(data.$schema);
  }

  /**
   * The package's one built-in resolver: a name-keyed registry with
   * exact version-segment resolution.
   *
   * **Details**
   *
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
   * **Example** (Resolve equivalent numeric version segments)
   *
   * ```ts
   * import { SchemaResolver, SchemaDeclarationByName } from "@beep/markdown/FrontmatterResolver"
   * import * as Effect from "effect/Effect"
   * import * as S from "effect/Schema"
   *
   * const resolver = SchemaResolver.fromRegistry({ "skill@2.1.0": S.String })
   * const declaration = SchemaDeclarationByName.make({ name: "skill", version: "02.1.00" })
   * const schema = Effect.runSync(resolver.resolve(declaration, {}))
   * console.log(schema === S.String) // true
   * ```
   *
   * @param registrations - Schemas keyed by `name[@version]`.
   * @returns The registry-backed resolver.
   * @category constructors
   * @since 0.0.0
   */
  static fromRegistry(registrations: Readonly<Record<string, S.Top>>): FrontmatterSchemaResolver {
    const byName = MutableHashMap.empty<string, RegistryEntry>();
    for (const [key, schema] of R.toEntries(registrations)) {
      register(byName, key, schema);
    }
    const resolve = resolveFrom(byName);
    return {
      resolve: dual(
        2,
        Effect.fn("resolve")(
          (declaration: SchemaDeclaration | undefined, _data: unknown): Effect.Effect<S.Top, FrontmatterResolveError> =>
            resolve(declaration)
        )
      ),
    };
  }
}
