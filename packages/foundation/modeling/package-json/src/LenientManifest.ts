/**
 * The shape-lenient discovery tier: `LenientManifest` decodes arbitrary
 * real-world package.json JSON without ever failing the document over one
 * malformed field. Every top-level field shares its name with `Package`, but
 * is typed as its plain permissive JSON shape (any string, not the branded
 * npm grammar; a plain record, not a `HashMap`); a present field that is not
 * even that shape degrades to absence, is preserved verbatim in `rest`, and
 * is reported on `issues`. Leniency is per-field, never per-syntax: input
 * that is not a JSON object at all stays a typed error.
 *
 * **Details**
 *
 * The kit's tolerance ladder (see PackageManifest.ts for the full comment):
 * Package         — strict, publishable.
 * PackageManifest — presence-lenient, shape-on-presence strict.
 * LenientManifest — shape-lenient discovery/sniffing (this module).
 * `@beep/npm-spec` Manifest — shape-blind outside the four dependency fields.
 * PackageJsonFormat — decode-free text path.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PackageJsonId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { BooleanOrStringListField, ManField, StringListField } from "./ManifestFields.ts";
import { ExportsField, PackageDecodeError, PublishConfigField } from "./Package.ts";
import { PackageJsonSyntaxError } from "./PackageJsonFormat.ts";

const $I = $PackageJsonId.create("LenientManifest");

/**
 * One degraded field from a lenient decode: the top-level `field` that did not
 * match its permissive shape, a human-readable description of the `expected`
 * shape, and the raw `value` found there (also preserved verbatim under
 * `LenientManifest.rest[field]`).
 *
 * **Details**
 *
 * A value, not an error — the decode still succeeds; issues exist so callers
 * can report what degraded.
 *
 * **Example** (Constructing a field issue)
 *
 * ```ts
 * import { LenientFieldIssue } from "@beep/package-json/LenientManifest";
 * import * as S from "effect/Schema";
 *
 * const issue = LenientFieldIssue.make({ field: "name", expected: "a string", value: 42 });
 * console.log(S.is(LenientFieldIssue)(issue)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class LenientFieldIssue extends S.Opaque<LenientFieldIssue, { readonly brand: unique symbol }>()(
  S.Struct({
    field: S.String.pipe(
      $I.annoteKey("LenientFieldIssue.field", { description: "The top-level field name that degraded." })
    ),
    expected: S.String.pipe(
      $I.annoteKey("LenientFieldIssue.expected", { description: "The permissive shape the field required." })
    ),
    value: S.Unknown.pipe(
      $I.annoteKey("LenientFieldIssue.value", {
        description: "The raw value found on the wire, preserved for reporting.",
      })
    ),
  }).pipe(
    $I.annoteSchema("LenientFieldIssue", {
      description: "A field whose raw value did not match its permissive manifest shape.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LenientFieldIssue {
  /**
   * The plain object a {@link LenientFieldIssue} encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof LenientFieldIssue.Encoded;
}

const StringRecord = S.Record(S.String, S.String);
const UnknownRecord = S.Record(S.String, S.Unknown);
const StringOrRecord = S.Union([S.String, UnknownRecord]);

const isString = P.isString;
const isBoolean = P.isBoolean;
const isPlainRecord: (value: unknown) => value is Record<string, unknown> = P.isObject;
const isStringRecord = (value: unknown): value is Record<string, string> =>
  isPlainRecord(value) && A.every(R.values(value), isString);
const isStringArray = S.is(StringListField);
const isStringOrRecord = (value: unknown): value is string | Record<string, unknown> =>
  isString(value) || isPlainRecord(value);
const isStringOrRecordArray = (value: unknown): value is ReadonlyArray<string | Record<string, unknown>> =>
  A.isArray(value) && A.every(value, isStringOrRecord);

interface FieldGuard {
  readonly expected: string;
  readonly test: (value: unknown) => boolean;
}

const stringGuard: FieldGuard = { expected: "a string", test: isString };
const stringRecordGuard: FieldGuard = { expected: "an object of string values", test: isStringRecord };
const stringOrRecordGuard: FieldGuard = { expected: "a string or an object", test: isStringOrRecord };
const recordGuard: FieldGuard = { expected: "an object", test: isPlainRecord };
const booleanGuard: FieldGuard = { expected: "a boolean", test: isBoolean };
const stringArrayGuard: FieldGuard = { expected: "an array of strings", test: isStringArray };
const booleanOrStringArrayGuard: FieldGuard = {
  expected: "a boolean or an array of strings",
  test: S.is(BooleanOrStringListField),
};

// decision: rest-keys-stored-as-own-data
const FIELD_GUARDS = HashMap.fromIterable<string, FieldGuard>([
  ["name", stringGuard],
  ["version", stringGuard],
  ["description", stringGuard],
  ["private", booleanGuard],
  ["type", stringGuard],
  ["main", stringGuard],
  ["license", stringGuard],
  ["author", stringOrRecordGuard],
  ["contributors", { expected: "an array of strings or objects", test: isStringOrRecordArray }],
  ["maintainers", { expected: "an array of strings or objects", test: isStringOrRecordArray }],
  ["keywords", stringArrayGuard],
  ["repository", stringOrRecordGuard],
  ["bugs", stringOrRecordGuard],
  [
    "funding",
    {
      expected: "a string, an object, or an array of either",
      test: (value) => isStringOrRecord(value) || isStringOrRecordArray(value),
    },
  ],
  ["homepage", stringGuard],
  ["dependencies", stringRecordGuard],
  ["devDependencies", stringRecordGuard],
  ["peerDependencies", stringRecordGuard],
  ["optionalDependencies", stringRecordGuard],
  ["peerDependenciesMeta", recordGuard],
  ["scripts", stringRecordGuard],
  ["bin", { expected: "a string or an object of string values", test: (v) => isString(v) || isStringRecord(v) }],
  ["engines", stringRecordGuard],
  ["exports", stringOrRecordGuard],
  ["publishConfig", recordGuard],
  ["packageManager", stringGuard],
  ["devEngines", recordGuard],
  ["files", stringArrayGuard],
  ["imports", recordGuard],
  ["module", stringGuard],
  ["browser", stringOrRecordGuard],
  ["man", { expected: "a string or an array of strings", test: S.is(ManField) }],
  ["directories", stringRecordGuard],
  ["config", recordGuard],
  ["bundleDependencies", booleanOrStringArrayGuard],
  ["bundledDependencies", booleanOrStringArrayGuard],
  ["overrides", recordGuard],
  ["engineStrict", booleanGuard],
  ["os", stringArrayGuard],
  ["cpu", stringArrayGuard],
  ["libc", stringArrayGuard],
  ["preferGlobal", booleanGuard],
  ["workspaces", { expected: "an array of strings or an object", test: P.or(isStringArray, isPlainRecord) }],
  ["sideEffects", booleanOrStringArrayGuard],
  ["types", stringGuard],
  ["typings", stringGuard],
  ["typesVersions", recordGuard],
  ["resolutions", stringRecordGuard],
  ["patchedDependencies", stringRecordGuard],
  ["trustedDependencies", stringArrayGuard],
  ["catalog", stringRecordGuard],
  ["readme", stringGuard],
]);

const sift = (raw: Record<string, unknown>): LenientManifest => {
  const known: Record<string, unknown> = {};
  // decision: rest-keys-stored-as-own-data
  const rest: Record<string, unknown> = { __proto__: null };
  const issues: Array<LenientFieldIssue> = [];
  for (const [key, value] of R.toEntries(raw)) {
    const guard = O.getOrUndefined(HashMap.get(FIELD_GUARDS, key));
    if (guard === undefined) {
      rest[key] = value;
    } else if (guard.test(value)) {
      known[key] = value;
    } else {
      rest[key] = value;
      issues.push(LenientFieldIssue.make({ field: key, expected: guard.expected, value }));
    }
  }
  // The guards above are exactly the field schemas' permissive shapes, so the
  // sifted knowns satisfy `make`'s validation.
  return LenientManifest.make({ ...known, rest, issues });
};

const decodeRecord = S.decodeUnknownExit(UnknownRecord);
const decodeJson = S.decodeUnknownResult(S.fromJsonString(S.Unknown));

/**
 * **Details**
 *
 * **This is the discovery tier, not a validation bypass.** Every field shares
 * its name with the strict `Package` model, but is typed as its plain permissive JSON
 * shape: `name` and `version` are unrestricted strings (a legacy uppercase name or a
 * non-semver `"1.0"` is recovered, not rejected), `license` is an unrestricted string (no
 * SPDX check), the dependency maps and `scripts` are plain string→string
 * records rather than `HashMap`s. A present field that is not even that shape
 * **degrades to absence** rather than failing the document: the raw value is
 * preserved verbatim in `rest` and the degradation is reported on `issues`,
 * so callers can surface what was ignored. Degradation granularity is the
 * top-level field — one junk entry degrades its whole map, with the raw map
 * still in `rest`.
 *
 * Leniency is per-field, never per-syntax: text that is not valid JSON fails
 * {@link LenientManifest.parseResult} as a typed
 * {@link PackageJsonSyntaxError}, and a value that is not a JSON object fails
 * {@link LenientManifest.decodeResult} as a typed {@link PackageDecodeError}.
 *
 * An empty `issues` array does **not** mean the strict tiers would accept the
 * document — the permissive shapes check JSON shape, not npm semantics. The
 * upgrade path is to decode the *original* input through
 * `PackageManifest.decode` (presence-lenient, shape-strict) or
 * `Package.decode` (strict, publishable) when validation is actually
 * wanted. This class deliberately carries no mutation statics and no write
 * path; editing belongs to the strict tiers and to
 * `PackageJsonFormat.modifyToString` / `PackageJsonFile.modify`.
 *
 * **Example** (Recover malformed manifest fields with diagnostic issues)
 *
 * ```ts
 * import { LenientManifest } from "@beep/package-json/LenientManifest";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const sniffed = yield* LenientManifest.decode({ name: "JSONStream", version: "1.0", license: 42 });
 *   console.log(sniffed.name, sniffed.version); // JSONStream 1.0
 *   console.log(sniffed.issues[0]?.field); // license
 *   console.log(sniffed.issues[0]?.expected); // a string
 *   // Degraded, preserved verbatim.
 *   console.log(sniffed.rest?.license); // 42
 * });
 * Effect.runSync(program);
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LenientManifest extends S.Class<LenientManifest, { readonly brand: unique symbol }>($I`LenientManifest`)(
  {
    name: S.optionalKey(S.String).pipe(
      $I.annoteKey("LenientManifest.name", {
        description: "The package identifier from the manifest, preserved without npm name validation",
      })
    ),
    version: S.optionalKey(S.String).pipe(
      $I.annoteKey("LenientManifest.version", {
        description: "The declared package release, preserved without semver validation",
      })
    ),
    description: S.optionalKey(S.String).pipe(
      $I.annoteKey("LenientManifest.description", {
        description: "A human-readable summary of the package from the manifest",
      })
    ),
    private: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("LenientManifest.private", {
        description: "Whether the manifest marks the package as private; absence reads as false through `isPrivate`",
      })
    ),
    type: S.optionalKey(S.String).pipe(
      $I.annoteKey("LenientManifest.type", {
        description: "The declared module format; only the exact value `module` makes `isESM` true",
      })
    ),
    main: S.optionalKey(S.String).pipe(
      $I.annoteKey("LenientManifest.main", { description: "The package's declared primary entry-point path" })
    ),
    license: S.optionalKey(S.String).pipe(
      $I.annoteKey("LenientManifest.license", {
        description: "The declared licensing terms, preserved without SPDX validation",
      })
    ),
    author: S.optionalKey(StringOrRecord).pipe(
      $I.annoteKey("LenientManifest.author", {
        description: "The package creator's details, preserved in the manifest's original form",
      })
    ),
    contributors: StringOrRecord.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("LenientManifest.contributors", {
        description:
          "Details of people credited with contributing to the package, preserved without parsing individual entries",
      })
    ),
    maintainers: StringOrRecord.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("LenientManifest.maintainers", {
        description:
          "Details of people listed as maintaining the package, preserved without parsing individual entries",
      })
    ),
    keywords: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("LenientManifest.keywords", {
        description: "Search terms associated with the package in its manifest",
      })
    ),
    repository: S.optionalKey(StringOrRecord).pipe(
      $I.annoteKey("LenientManifest.repository", {
        description: "The source repository reference, preserved without normalization or validation of its details",
      })
    ),
    bugs: S.optionalKey(StringOrRecord).pipe(
      $I.annoteKey("LenientManifest.bugs", {
        description:
          "Issue-reporting contact details, preserved without validation of URLs, email addresses, or object contents",
      })
    ),
    funding: S.optionalKey(S.Union([StringOrRecord, S.Array(StringOrRecord)])).pipe(
      $I.annoteKey("LenientManifest.funding", {
        description:
          "Declared funding destinations, preserved without validating individual entries or normalizing their original form",
      })
    ),
    homepage: S.optionalKey(S.String).pipe(
      $I.annoteKey("LenientManifest.homepage", {
        description: "The package's declared homepage address, preserved without URL validation",
      })
    ),
    dependencies: S.optionalKey(StringRecord).pipe(
      $I.annoteKey("LenientManifest.dependencies", {
        description:
          "Package names mapped to declared runtime dependency specifiers, preserved without specifier validation",
      })
    ),
    devDependencies: S.optionalKey(StringRecord).pipe(
      $I.annoteKey("LenientManifest.devDependencies", {
        description:
          "Package names mapped to declared development dependency specifiers, preserved without specifier validation",
      })
    ),
    peerDependencies: S.optionalKey(StringRecord).pipe(
      $I.annoteKey("LenientManifest.peerDependencies", {
        description:
          "Package names mapped to dependency requirements expected from the consuming project, preserved without specifier validation",
      })
    ),
    optionalDependencies: S.optionalKey(StringRecord).pipe(
      $I.annoteKey("LenientManifest.optionalDependencies", {
        description:
          "Package names mapped to dependency specifiers whose installation may fail without failing the overall install",
      })
    ),
    peerDependenciesMeta: S.optionalKey(UnknownRecord).pipe(
      $I.annoteKey("LenientManifest.peerDependenciesMeta", {
        description:
          "Additional peer dependency metadata, such as optional status, preserved without validating individual entries",
      })
    ),
    scripts: S.optionalKey(StringRecord).pipe(
      $I.annoteKey("LenientManifest.scripts", {
        description: "Lifecycle or task names mapped to command text declared in the manifest",
      })
    ),
    bin: S.optionalKey(S.Union([S.String, StringRecord])).pipe(
      $I.annoteKey("LenientManifest.bin", {
        description: "Executable entry-point paths, declared as a single path or a mapping from command names to paths",
      })
    ),
    engines: S.optionalKey(StringRecord).pipe(
      $I.annoteKey("LenientManifest.engines", {
        description:
          "Runtime and tool names mapped to declared version requirements, preserved without range validation",
      })
    ),
    exports: S.optionalKey(ExportsField).pipe(
      $I.annoteKey("LenientManifest.exports", {
        description:
          "The declared package entry point or export mappings, preserving object contents without validating individual targets",
      })
    ),
    publishConfig: S.optionalKey(PublishConfigField).pipe(
      $I.annoteKey("LenientManifest.publishConfig", {
        description:
          "Publishing configuration from the manifest, preserving npm settings and extensions without validating their values",
      })
    ),
    packageManager: S.optionalKey(S.String).pipe(
      $I.annoteKey("LenientManifest.packageManager", {
        description:
          "The declared package-manager selection, preserved without parsing its name, version, or integrity component",
      })
    ),
    devEngines: S.optionalKey(UnknownRecord).pipe(
      $I.annoteKey("LenientManifest.devEngines", {
        description:
          "Development environment constraints from the manifest, preserved without validating individual engine entries",
      })
    ),
    files: S.optionalKey(StringListField).pipe(
      $I.annoteKey("LenientManifest.files", {
        description: "File globs included when the package is packed, preserved without glob validation",
      })
    ),
    imports: S.optionalKey(UnknownRecord).pipe(
      $I.annoteKey("LenientManifest.imports", {
        description: "Node subpath imports, preserving object contents without validating keys or targets",
      })
    ),
    module: S.optionalKey(S.String).pipe(
      $I.annoteKey("LenientManifest.module", {
        description: "The bundler ESM entry-point path declared in the manifest",
      })
    ),
    browser: S.optionalKey(StringOrRecord).pipe(
      $I.annoteKey("LenientManifest.browser", {
        description: "The browser entry point or module replacement map, preserved without validating targets",
      })
    ),
    man: S.optionalKey(ManField).pipe(
      $I.annoteKey("LenientManifest.man", { description: "Man page paths, declared as one path or a list of paths" })
    ),
    directories: S.optionalKey(StringRecord).pipe(
      $I.annoteKey("LenientManifest.directories", {
        description: "Package layout directory names mapped to paths, preserved without path validation",
      })
    ),
    config: S.optionalKey(UnknownRecord).pipe(
      $I.annoteKey("LenientManifest.config", {
        description: "Script configuration values, preserved without validating their contents",
      })
    ),
    bundleDependencies: S.optionalKey(BooleanOrStringListField).pipe(
      $I.annoteKey("LenientManifest.bundleDependencies", {
        description: "Bundled dependency names, or a flag bundling every dependency",
      })
    ),
    bundledDependencies: S.optionalKey(BooleanOrStringListField).pipe(
      $I.annoteKey("LenientManifest.bundledDependencies", {
        description: "The `bundledDependencies` alias for bundled dependency names or the bundle-everything flag",
      })
    ),
    overrides: S.optionalKey(UnknownRecord).pipe(
      $I.annoteKey("LenientManifest.overrides", {
        description: "Dependency overrides, preserving nested override objects without validating specifiers",
      })
    ),
    engineStrict: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("LenientManifest.engineStrict", {
        description: "The deprecated npm flag making engine mismatches fatal",
      })
    ),
    os: S.optionalKey(StringListField).pipe(
      $I.annoteKey("LenientManifest.os", {
        description: "Operating systems the package declares support for, preserved without validating names",
      })
    ),
    cpu: S.optionalKey(StringListField).pipe(
      $I.annoteKey("LenientManifest.cpu", {
        description: "CPU architectures the package declares support for, preserved without validating names",
      })
    ),
    libc: S.optionalKey(StringListField).pipe(
      $I.annoteKey("LenientManifest.libc", {
        description: "C standard libraries the package declares support for, preserved without validating names",
      })
    ),
    preferGlobal: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("LenientManifest.preferGlobal", {
        description: "The deprecated npm hint that the package prefers a global install",
      })
    ),
    workspaces: S.optionalKey(S.Union([StringListField, UnknownRecord])).pipe(
      $I.annoteKey("LenientManifest.workspaces", {
        description: "Workspace globs as a list, or the workspaces object preserved without validating its keys",
      })
    ),
    sideEffects: S.optionalKey(BooleanOrStringListField).pipe(
      $I.annoteKey("LenientManifest.sideEffects", {
        description: "The bundler side-effect flag or the side-effectful file globs",
      })
    ),
    types: S.optionalKey(S.String).pipe(
      $I.annoteKey("LenientManifest.types", {
        description: "The TypeScript declaration entry-point path declared in the manifest",
      })
    ),
    typings: S.optionalKey(S.String).pipe(
      $I.annoteKey("LenientManifest.typings", {
        description: "The `typings` alias for the TypeScript declaration entry-point path",
      })
    ),
    typesVersions: S.optionalKey(UnknownRecord).pipe(
      $I.annoteKey("LenientManifest.typesVersions", {
        description: "TypeScript version redirects, preserved without validating ranges or path lists",
      })
    ),
    resolutions: S.optionalKey(StringRecord).pipe(
      $I.annoteKey("LenientManifest.resolutions", {
        description: "Forced dependency resolutions mapped to specifiers, preserved without specifier validation",
      })
    ),
    patchedDependencies: S.optionalKey(StringRecord).pipe(
      $I.annoteKey("LenientManifest.patchedDependencies", {
        description: "Patched package specifiers mapped to patch file paths",
      })
    ),
    trustedDependencies: S.optionalKey(StringListField).pipe(
      $I.annoteKey("LenientManifest.trustedDependencies", {
        description: "Package names allowed to run lifecycle scripts at install",
      })
    ),
    catalog: S.optionalKey(StringRecord).pipe(
      $I.annoteKey("LenientManifest.catalog", {
        description: "Default catalog package names mapped to specifiers, preserved without specifier validation",
      })
    ),
    readme: S.optionalKey(S.String).pipe(
      $I.annoteKey("LenientManifest.readme", { description: "README text as stored in a published manifest" })
    ),
    /**
     * Unknown top-level keys, plus every degraded known field's raw value,
     * verbatim. Always present after a lenient decode (possibly empty).
     */
    rest: S.optionalKey(UnknownRecord).pipe(
      $I.annoteKey("LenientManifest.rest", {
        description:
          "Unknown top-level keys, plus every degraded known field's raw value, verbatim. Always present after a lenient decode (possibly empty).",
      })
    ),
    /** The degradations collected by the decode — empty when nothing degraded. */
    issues: S.Array(LenientFieldIssue).pipe(
      $I.annoteKey("LenientManifest.issues", {
        description: "The degradations collected by the decode — empty when nothing degraded.",
      })
    ),
  },
  $I.annote("LenientManifest", {
    description:
      "The shape-lenient view of a package.json document, for discovery and sniffing — probing a fetched tarball's manifest, walking a `node_modules` tree, listing candidate packages — where the document is other people's data and one malformed field must not fail the read.",
  })
) {
  /**
   * Decode an unknown JSON value leniently, degrading malformed fields instead
   * of failing the document. The sync primitive backing
   * {@link LenientManifest.decode}.
   *
   * **Example** (Recover a malformed license synchronously)
   *
   * ```ts
   * import { LenientManifest } from "@beep/package-json/LenientManifest";
   * import * as Result from "effect/Result";
   *
   * const manifest = Result.getOrThrow(LenientManifest.decodeResult({ license: 42 }));
   * console.log(manifest.issues[0]?.field) // license
   * ```
   *
   * @param input - the parsed package.json JSON value (e.g. from `JSON.parse`)
   * @returns the lenient manifest, or a {@link PackageDecodeError} when
   * `input` is not a JSON object at all (`null`, an array or a scalar) — the
   * one failure leniency does not cover
   * @category decoding
   * @since 0.0.0
   */
  static decodeResult(input: unknown): Result.Result<LenientManifest, PackageDecodeError> {
    const exit = decodeRecord(input);
    if (Exit.isFailure(exit)) {
      return Result.fail(PackageDecodeError.make({ cause: Cause.squash(exit.cause) }));
    }
    return Result.succeed(sift(exit.value));
  }

  /**
   * Decode an unknown JSON value leniently, degrading malformed fields instead
   * of failing the document. The `Effect` form of
   * {@link LenientManifest.decodeResult}, adding the tracing span.
   *
   * **Example** (Decode a discovery manifest with an effect)
   *
   * ```ts
   * import { LenientManifest } from "@beep/package-json/LenientManifest";
   * import * as Effect from "effect/Effect";
   *
   * const manifest = Effect.runSync(LenientManifest.decode({ name: "JSONStream" }));
   * console.log(manifest.name) // JSONStream
   * ```
   *
   * @param input - the parsed package.json JSON value (e.g. from `JSON.parse`)
   * @returns an Effect resolving to the decoded {@link LenientManifest},
   * failing with {@link PackageDecodeError} when `input` is not a JSON object
   * @category decoding
   * @since 0.0.0
   */
  static readonly decode = Effect.fn("LenientManifest.decode")((input: unknown) =>
    Effect.fromResult(LenientManifest.decodeResult(input))
  );

  /**
   * Parse package.json text and decode it leniently. The sync primitive
   * backing {@link LenientManifest.parse}.
   *
   * **Example** (Distinguish invalid JSON from field degradation)
   *
   * ```ts
   * import { LenientManifest } from "@beep/package-json/LenientManifest";
   * import * as Result from "effect/Result";
   *
   * console.log(Result.isFailure(LenientManifest.parseResult("{"))) // true
   * const manifest = Result.getOrThrow(LenientManifest.parseResult('{"license":42}'));
   * console.log(manifest.rest?.license) // 42
   * ```
   *
   * @param text - the package.json source text
   * @returns the lenient manifest, or a {@link PackageJsonSyntaxError} when
   * the text is not valid JSON (`"invalid-json"`) or parses to something
   * other than a JSON object (`"not-an-object"`) — leniency is per-field,
   * never per-syntax
   * @category parsing
   * @since 0.0.0
   */
  static parseResult(text: string): Result.Result<LenientManifest, PackageJsonSyntaxError> {
    const decoded = decodeJson(text);
    if (Result.isFailure(decoded)) {
      return Result.fail(PackageJsonSyntaxError.make({ reason: "invalid-json", cause: decoded.failure }));
    }
    const raw = decoded.success;
    if (!isPlainRecord(raw)) {
      return Result.fail(PackageJsonSyntaxError.make({ reason: "not-an-object" }));
    }
    return Result.succeed(sift(raw));
  }

  /**
   * Parse package.json text and decode it leniently. The `Effect` form of
   * {@link LenientManifest.parseResult}, adding the tracing span.
   *
   * **Example** (Parse a discovery manifest with an effect)
   *
   * ```ts
   * import { LenientManifest } from "@beep/package-json/LenientManifest";
   * import * as Effect from "effect/Effect";
   *
   * const manifest = Effect.runSync(LenientManifest.parse('{"name":"JSONStream"}'));
   * console.log(manifest.name) // JSONStream
   * ```
   *
   * @param text - the package.json source text
   * @returns an Effect resolving to the decoded {@link LenientManifest},
   * failing with {@link PackageJsonSyntaxError} when the text is not valid JSON
   * or is not a JSON object
   * @category parsing
   * @since 0.0.0
   */
  static readonly parse = Effect.fn("LenientManifest.parse")((text: string) =>
    Effect.fromResult(LenientManifest.parseResult(text))
  );

  /**
   *  Whether the manifest is marked private.
   *
   * **Example** (Read the default privacy flag)
   *
   * ```ts
   * import { LenientManifest } from "@beep/package-json/LenientManifest";
   * import * as Result from "effect/Result";
   *
   * const manifest = Result.getOrThrow(LenientManifest.decodeResult({}));
   * console.log(manifest.isPrivate) // false
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get isPrivate(): boolean {
    return this.private ?? false;
  }

  /**
   *  Whether the manifest declares ESM (`"type": "module"`, exact comparison).
   *
   * **Example** (Recognize the exact module type)
   *
   * ```ts
   * import { LenientManifest } from "@beep/package-json/LenientManifest";
   * import * as Result from "effect/Result";
   *
   * const manifest = Result.getOrThrow(LenientManifest.decodeResult({ type: "module" }));
   * console.log(manifest.isESM) // true
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get isESM(): boolean {
    return this.type === "module";
  }
}
