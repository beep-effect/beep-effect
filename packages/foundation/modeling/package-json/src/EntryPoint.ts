/**
 * Root entry-point resolution from a manifest's `exports` / `main` fields:
 * `resolveEntryPoint`, its `EntryPointManifest` and `ResolveEntryPointOptions`
 * inputs, and the discriminated `UnresolvedEntryPointError`. Pure and IO-free.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PackageJsonId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual, identity } from "effect/Function";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $PackageJsonId.create("EntryPoint");

const ConditionsJson = S.fromJsonString(S.Unknown);

/**
 * **Details**
 *
 * `conditions` lists the export conditions to honour, in priority order
 * (default `["import", "default"]`). The first condition present in the
 * manifest wins, so the order is the policy — `["require", "import"]` and
 * `["import", "require"]` resolve the same manifest to different files, on
 * purpose. `exports` and `main` are reserved for manifest arguments, so
 * one-argument calls are unambiguous.
 *
 * **Example** (Construct resolution options)
 *
 * ```ts
 * import { ResolveEntryPointOptions } from "@beep/package-json/EntryPoint";
 *
 * const options = ResolveEntryPointOptions.make({ conditions: ["require"] });
 * console.log(options.conditions) // [ 'require' ]
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ResolveEntryPointOptions extends S.Opaque<ResolveEntryPointOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    conditions: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("ResolveEntryPointOptions.conditions", {
        description: "The export conditions to honour, in priority order; defaults to import, then default.",
      })
    ),
    exports: S.optionalKey(S.Never).pipe(
      $I.annoteKey("ResolveEntryPointOptions.exports", {
        description: "Reserved for manifest arguments, so one-argument calls are unambiguous.",
      })
    ),
    main: S.optionalKey(S.Never).pipe(
      $I.annoteKey("ResolveEntryPointOptions.main", {
        description: "Reserved for manifest arguments, so one-argument calls are unambiguous.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ResolveEntryPointOptions", {
      description: "Controls condition priority when resolveEntryPoint selects a package's root export.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ResolveEntryPointOptions {
  /**
   * The plain options object {@link resolveEntryPoint} accepts: a constructed
   * {@link ResolveEntryPointOptions} or an object literal with the same fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ResolveEntryPointOptions.Encoded;
}

/**
 * **Details**
 *
 * The reason is discriminated rather than a bare "not found" because the three
 * shapes call for different responses, and a caller needs to know which one it
 * hit.
 *
 * **Example** (Inspect a condition mismatch)
 *
 * ```ts
 * import { UnresolvedEntryPointError } from "@beep/package-json/EntryPoint";
 *
 * const error = UnresolvedEntryPointError.make({ reason: "noConditionMatched", conditions: ["import"] });
 * console.log(error.reason) // noConditionMatched
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class UnresolvedEntryPointError extends S.TaggedError<
  UnresolvedEntryPointError,
  { readonly brand: unique symbol }
>($I`UnresolvedEntryPointError`)(
  "UnresolvedEntryPointError",
  {
    /**
     * `noRootExport` — `exports` is a subpath map with no `"."` entry, so the
     * package exports subpaths but no root. `noConditionMatched` — a root
     * entry exists but none of the requested conditions are present, e.g. a
     * `require`-only package read with `["import"]`.
     * `unsupportedExportsForm` — an array fallback list, or another shape this
     * resolver does not implement.
     */
    reason: S.Literals(["noRootExport", "noConditionMatched", "unsupportedExportsForm"]).pipe(
      $I.annoteKey("UnresolvedEntryPointError.reason", {
        description:
          '`noRootExport` — `exports` is a subpath map with no `"."` entry, so the package exports subpaths but no root. `noConditionMatched` — a root entry exists but none of the requested conditions are present, e.g. a `require`-only package read with `["import"]`. `unsupportedExportsForm` — an array fallback list, or another shape this resolver does not implement.',
      })
    ),
    /** The conditions that were tried, for `noConditionMatched`. */
    conditions: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("UnresolvedEntryPointError.conditions", {
        description: "The conditions that were tried, for `noConditionMatched`.",
      })
    ),
  },
  $I.annoteError<UnresolvedEntryPointError>("UnresolvedEntryPointError", {
    description: "Raised when a manifest resolves no root entry point.",
  })
) {
  /**
   * Explains the unresolved export shape, including the tried conditions for a condition mismatch.
   *
   * **Example** (Read an unsupported-form diagnostic)
   *
   * ```ts
   * import { UnresolvedEntryPointError } from "@beep/package-json/EntryPoint";
   *
   * const error = UnresolvedEntryPointError.make({ reason: "unsupportedExportsForm" });
   * console.log(error.message) // The manifest's "exports" uses a form this resolver does not implement
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return Match.value(this.reason).pipe(
      Match.when(
        "noRootExport",
        () => 'The manifest\'s "exports" declares subpaths but no "." entry, so it has no root entry point'
      ),
      Match.when(
        "noConditionMatched",
        () =>
          `The manifest's "exports" matched none of the conditions ${Result.getOrThrowWith(S.encodeResult(ConditionsJson)(this.conditions ?? []), identity)}`
      ),
      Match.orElse(() => 'The manifest\'s "exports" uses a form this resolver does not implement')
    );
  }
}

/**
 * **Details**
 *
 * Deliberately structural rather than the full {@link PackageManifest}, so a
 * caller can resolve an entry point from an arbitrary object carrying these two fields —
 * a manifest parsed straight from a tarball, for instance, with nothing else
 * validated yet. `exports` is read in each of its legal shapes; `main` is
 * consulted only when `exports` is absent.
 *
 * **Example** (Construct an entry-point manifest)
 *
 * ```ts
 * import { EntryPointManifest, resolveEntryPoint } from "@beep/package-json/EntryPoint";
 * import * as Result from "effect/Result";
 *
 * const manifest = EntryPointManifest.make({ main: "./lib.js" });
 * console.log(Result.getOrThrow(resolveEntryPoint(manifest, undefined))) // ./lib.js
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class EntryPointManifest extends S.Opaque<EntryPointManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    exports: S.optionalKey(S.Unknown).pipe(
      $I.annoteKey("EntryPointManifest.exports", { description: "The `exports` field, in each of its legal shapes." })
    ),
    main: S.optionalKey(S.Unknown).pipe(
      $I.annoteKey("EntryPointManifest.main", {
        description: "The `main` field; consulted only when `exports` is absent.",
      })
    ),
  }).pipe(
    $I.annoteSchema("EntryPointManifest", {
      description: "The structural manifest fields entry resolution reads: `exports` and `main`.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace EntryPointManifest {
  /**
   * The plain manifest object {@link resolveEntryPoint} accepts: any object
   * carrying the optional `exports` and `main` fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof EntryPointManifest.Encoded;
}

const DEFAULT_CONDITIONS: ReadonlyArray<string> = ["import", "default"];

const isPlainObject: (value: unknown) => value is Record<string, unknown> = P.isObject;

const isRootConditions = (exportsObject: Record<string, unknown>): boolean => {
  const keys = R.keys(exportsObject);
  return keys.length > 0 && !A.some(keys, Str.startsWith("."));
};

const resolveConditions: {
  (conditionsObject: Record<string, unknown>, conditions: ReadonlyArray<string>): string | undefined;
  (conditions: ReadonlyArray<string>): (conditionsObject: Record<string, unknown>) => string | undefined;
} = dual(2, (conditionsObject: Record<string, unknown>, conditions: ReadonlyArray<string>): string | undefined => {
  for (const condition of conditions) {
    const matched = conditionsObject[condition];
    if (P.isString(matched)) {
      return matched;
    }
    if (isPlainObject(matched)) {
      const nested = resolveConditions(matched, conditions);
      if (nested !== undefined) {
        return nested;
      }
    }
  }
  return undefined;
});

const resolveConditionsResult = (
  conditionsObject: Record<string, unknown>,
  conditions: ReadonlyArray<string>
): Result.Result<string, UnresolvedEntryPointError> => {
  const resolved = resolveConditions(conditionsObject, conditions);
  return resolved === undefined
    ? Result.fail(UnresolvedEntryPointError.make({ reason: "noConditionMatched", conditions }))
    : Result.succeed(resolved);
};

const resolveSubpathMap = (
  exportsObject: Record<string, unknown>,
  conditions: ReadonlyArray<string>
): Result.Result<string, UnresolvedEntryPointError> => {
  const dot = exportsObject["."];
  if (P.isString(dot)) {
    return Result.succeed(dot);
  }
  return isPlainObject(dot)
    ? resolveConditionsResult(dot, conditions)
    : Result.fail(UnresolvedEntryPointError.make({ reason: "noRootExport" }));
};

const resolveExports = (
  exportsField: unknown,
  conditions: ReadonlyArray<string>
): Result.Result<string, UnresolvedEntryPointError> => {
  if (P.isString(exportsField)) {
    return Result.succeed(exportsField);
  }
  if (!isPlainObject(exportsField)) {
    return Result.fail(UnresolvedEntryPointError.make({ reason: "unsupportedExportsForm" }));
  }
  return isRootConditions(exportsField)
    ? resolveConditionsResult(exportsField, conditions)
    : resolveSubpathMap(exportsField, conditions);
};

/**
 * Resolve a package's root entry point from its manifest.
 *
 * **Details**
 *
 * Answers "given a manifest, which file is the package's `"."` entry?". It is
 * pure and IO-free by design — nothing here touches a filesystem, so it works
 * on plain manifest objects with no package on disk, and it composes with a
 * directory regardless of its arrival route.
 *
 * All three legal `exports` spellings are honoured, because all three appear in
 * real published packages:
 *
 * - **String shorthand** — `"exports": "./index.js"`, sugar for `{ ".": … }`.
 * - **Subpath map** — `{ ".": "./index.js" }`, or `{ ".": { import, … } }`.
 * - **Root conditions** — `{ "import": "./index.js", "default": "./index.cjs" }`,
 *   conditions at the root with no `"."` key.
 *
 * A one-argument object with `exports` or `main` is a manifest. Other
 * one-argument objects are options for the pipeable form. Pass `undefined`
 * as the second argument to resolve an empty or extension-only manifest.
 * `resolveEntryPoint()` selects the default conditions for piping.
 *
 * **Gotchas**
 *
 * **`exports` encapsulates the package.** When it is present but nothing
 * matches, the answer is a typed failure and `main` is **not** consulted — that
 * is Node's rule, and the lenient reading (falling through to `main`, then to
 * `index.js`) is the subtly wrong one: it answers a file the package
 * deliberately does not export, which loads and behaves plausibly instead of
 * failing. Only when `exports` is **absent** does `main`, and then the legacy
 * `index.js` default, apply.
 *
 * A failure is also the answer for an `exports` form this resolver does not
 * implement — an array fallback list, or a subpath map with no `"."` entry
 * (an empty `{}` included).
 * Both are honest "this resolver cannot tell you", never a guess, and each
 * carries its own {@link UnresolvedEntryPointError} reason so a caller can log
 * which shape a package actually had rather than a flat "could not resolve".
 *
 * **Example** (Resolve conditions without falling through to main)
 *
 * ```ts
 * import { resolveEntryPoint } from "@beep/package-json/EntryPoint";
 * import * as Result from "effect/Result";
 *
 * console.log(Result.getOrThrow(resolveEntryPoint({ exports: { import: "./esm.js", require: "./cjs.js" } }))) // ./esm.js
 * console.log(Result.getOrThrow(resolveEntryPoint({ exports: { require: "./cjs.js" } }, { conditions: ["require"] }))) // ./cjs.js
 * const unresolved = resolveEntryPoint({ exports: { require: "./cjs.js" }, main: "./legacy.js" });
 * console.log(Result.isFailure(unresolved)) // true
 * ```
 *
 * @param manifest - A package manifest, or an arbitrary object carrying `exports`/`main`.
 * @param options - Which conditions to honour, in priority order.
 * @returns The entry path as written in the manifest, relative to the package
 *   root, or a typed {@link UnresolvedEntryPointError} naming which shape
 *   blocked resolution.
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export const resolveEntryPoint: {
  (
    manifest: EntryPointManifest.Encoded & { readonly exports: unknown }
  ): Result.Result<string, UnresolvedEntryPointError>;
  (manifest: EntryPointManifest.Encoded & { readonly main: unknown }): Result.Result<string, UnresolvedEntryPointError>;
  (
    options: ResolveEntryPointOptions.Encoded | undefined
  ): (manifest: EntryPointManifest.Encoded) => Result.Result<string, UnresolvedEntryPointError>;
  (): (manifest: EntryPointManifest.Encoded) => Result.Result<string, UnresolvedEntryPointError>;
  (
    manifest: EntryPointManifest.Encoded,
    options: ResolveEntryPointOptions.Encoded | undefined
  ): Result.Result<string, UnresolvedEntryPointError>;
} = dual(
  (args) => args.length >= 2 || P.hasProperty(args[0], "exports") || P.hasProperty(args[0], "main"),
  (
    manifest: EntryPointManifest.Encoded,
    options?: ResolveEntryPointOptions.Encoded
  ): Result.Result<string, UnresolvedEntryPointError> => {
    const exportsField = manifest.exports;
    if (exportsField !== undefined) {
      return resolveExports(exportsField, options?.conditions ?? DEFAULT_CONDITIONS);
    }
    return Result.succeed(P.isString(manifest.main) && manifest.main !== "" ? manifest.main : "index.js");
  }
);
