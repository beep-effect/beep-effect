import * as A from "effect/Array";
import { dual, identity } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// Ported from sort-package-json@4.0.0 index.js default sortOrder (MIT).
const KEY_ORDER: ReadonlyArray<string> = [
  "$schema",
  "name",
  "displayName",
  "version",
  "stableVersion",
  "private",
  "description",
  "categories",
  "keywords",
  "homepage",
  "bugs",
  "repository",
  "funding",
  "license",
  "qna",
  "author",
  "maintainers",
  "contributors",
  "publisher",
  "sideEffects",
  "type",
  "imports",
  "exports",
  "main",
  "svelte",
  "umd:main",
  "jsdelivr",
  "unpkg",
  "module",
  "source",
  "jsnext:main",
  "browser",
  "react-native",
  "types",
  "typesVersions",
  "typings",
  "style",
  "example",
  "examplestyle",
  "assets",
  "bin",
  "man",
  "directories",
  "files",
  "workspaces",
  "binary",
  "scripts",
  "betterScripts",
  "wireit",
  "l10n",
  "contributes",
  "activationEvents",
  "husky",
  "simple-git-hooks",
  "pre-commit",
  "commitlint",
  "lint-staged",
  "nano-staged",
  "config",
  "nodemonConfig",
  "browserify",
  "babel",
  "browserslist",
  "xo",
  "prettier",
  "eslintConfig",
  "eslintIgnore",
  "npmpkgjsonlint",
  "npmPackageJsonLintConfig",
  "npmpackagejsonlint",
  "release",
  "remarkConfig",
  "stylelint",
  "ava",
  "jest",
  "jest-junit",
  "jest-stare",
  "mocha",
  "nyc",
  "c8",
  "tap",
  "oclif",
  "resolutions",
  "overrides",
  "dependencies",
  "devDependencies",
  "dependenciesMeta",
  "peerDependencies",
  "peerDependenciesMeta",
  "optionalDependencies",
  "bundledDependencies",
  "bundleDependencies",
  "extensionPack",
  "extensionDependencies",
  "flat",
  "packageManager",
  "engines",
  "engineStrict",
  "devEngines",
  "volta",
  "languageName",
  "os",
  "cpu",
  "preferGlobal",
  "publishConfig",
  "icon",
  "badges",
  "galleryBanner",
  "preview",
  "markdown",
  "pnpm",
];

const KEY_INDEX = HashMap.fromIterable(A.map(KEY_ORDER, (k, i) => [k, i] as const));

const byCodePoint = Order.String;
const byKnownIndex = Order.mapInput(Order.Number, (entry: [string, unknown, number]) => entry[2]);
const byEntryKey = Order.mapInput(byCodePoint, (entry: [string, unknown]) => entry[0]);

// decision: hashmap-field-formatting
const SORTED_MAP_KEYS = HashSet.make(
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "bundleDependencies",
  "scripts",
  "engines",
  "bin"
);

const sortMapEntries = (value: Record<string, unknown>): Record<string, unknown> =>
  R.fromEntries(A.map(A.sort(R.keys(value), byCodePoint), (key) => [key, value[key]] as const));

const isPlainObject: (value: unknown) => value is Record<string, unknown> = P.isObject;

/**
 * Order top-level keys canonically (known keys by {@link KEY_ORDER}, then
 * unknown public keys alphabetically, then unknown `_`-prefixed keys
 * alphabetically) and alphabetize the {@link SORTED_MAP_KEYS} map entries.
 *
 * **Example** (Order known and unknown package keys)
 *
 * ```ts
 * import { sortKeys } from "@beep/package-json/internal/format";
 *
 * console.log(Object.keys(sortKeys({ z: 1, version: "1.0.0", name: "p", _a: 2 })).join(",")); // name,version,z,_a
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const sortKeys = (obj: Record<string, unknown>): Record<string, unknown> => {
  const known: Array<[string, unknown, number]> = [];
  const restPublic: Array<[string, unknown]> = [];
  const restPrivate: Array<[string, unknown]> = [];

  for (const key of R.keys(obj)) {
    const index = O.getOrUndefined(HashMap.get(KEY_INDEX, key));
    if (index !== undefined) known.push([key, obj[key], index]);
    else if (Str.startsWith("_")(key)) restPrivate.push([key, obj[key]]);
    else restPublic.push([key, obj[key]]);
  }

  const entries = [
    ...A.sort(known, byKnownIndex),
    ...A.sort(restPublic, byEntryKey),
    ...A.sort(restPrivate, byEntryKey),
  ];
  return R.fromEntries(
    A.map(
      entries,
      ([key, value]) =>
        [key, HashSet.has(SORTED_MAP_KEYS, key) && isPlainObject(value) ? sortMapEntries(value) : value] as const
    )
  );
};

// decision: hashmap-field-formatting
const STRIP_EMPTY_KEYS: ReadonlyArray<string> = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "scripts",
];

/**
 * Remove map keys whose value is an empty object.
 *
 * **Example** (Remove empty defaulted maps)
 *
 * ```ts
 * import { stripEmptyDependencyMaps } from "@beep/package-json/internal/format";
 *
 * console.log(JSON.stringify(stripEmptyDependencyMaps({ name: "p", scripts: {}, dependencies: {} }))); // {"name":"p"}
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const stripEmptyDependencyMaps = (raw: Record<string, unknown>): Record<string, unknown> => {
  const result = { ...raw };
  for (const key of STRIP_EMPTY_KEYS) {
    const value = result[key];
    if (isPlainObject(value) && R.isEmptyRecord(value)) {
      delete result[key];
    }
  }
  return result;
};

const DEFAULT_INDENT = 2;

/**
 * Detect the indentation of a JSON source text from its first indented line:
 * `"\t"` for tab indentation, otherwise the leading run of spaces. Returns
 * `Option.none()` when no line is indented.
 *
 * **Example** (Inspect a four-space indent)
 *
 * ```ts
 * import { detectIndent } from "@beep/package-json/internal/format";
 * import * as O from "effect/Option";
 *
 * console.log(O.map(detectIndent('{\n    "name": "p"\n}'), (indent) => indent.length)); // { _id: 'Option', _tag: 'Some', value: 4 }
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const detectIndent = (source: string): O.Option<string> =>
  A.findFirst(Str.split(source, "\n"), (line) =>
    O.map(O.fromNullishOr(/^(\t+| +)\S/.exec(line)?.[1]), (indent) => (Str.startsWith("\t")(indent) ? "\t" : indent))
  );

/**
 * Resolve a `PackageFormatOptions.indent` value to the `JSON.stringify` indent
 * argument: `"tab"` becomes a real tab, `"preserve"` reuses the indentation
 * detected from `sourceText` (falling back to the two-space default when no
 * source text or no indented line is available), and a number passes through.
 *
 * **Example** (Preserve indent or use the default)
 *
 * ```ts
 * import { resolveIndent } from "@beep/package-json/internal/format";
 *
 * console.log(String(resolveIndent("preserve", '{\n    "name": "p"\n}')).length); // 4
 * console.log(resolveIndent("preserve", undefined)); // 2
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const resolveIndent: {
  (sourceText: string | undefined): (indent: number | "tab" | "preserve" | undefined) => string | number;
  (indent: number | "tab" | "preserve" | undefined, sourceText: string | undefined): string | number;
} = dual(2, (indent: number | "tab" | "preserve" | undefined, sourceText: string | undefined): string | number => {
  if (indent === "tab") return "\t";
  if (indent === "preserve") {
    return sourceText === undefined ? DEFAULT_INDENT : O.getOrElse(detectIndent(sourceText), () => DEFAULT_INDENT);
  }
  return indent ?? DEFAULT_INDENT;
});

/**
 * Resolve the public `PackageFormatOptions` bag (mirrored structurally here —
 * this module cannot import `Package.ts` without closing a cycle) to the
 * concrete {@link renderJson} options. Shared by `Package.toJsonString` and
 * `PackageManifest.toJsonString` so the two serializers cannot drift.
 *
 * **Example** (Resolve default formatting options)
 *
 * ```ts
 * import { resolveFormatOptions } from "@beep/package-json/internal/format";
 *
 * console.log(JSON.stringify(resolveFormatOptions())); // {"indent":2,"sort":true,"stripEmpty":true,"newline":true}
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const resolveFormatOptions = (options?: {
  readonly indent?: number | "tab" | "preserve";
  readonly sourceText?: string;
  readonly sort?: boolean;
  readonly stripEmpty?: boolean;
  readonly newline?: boolean;
}): {
  readonly indent: string | number;
  readonly sort: boolean;
  readonly stripEmpty: boolean;
  readonly newline: boolean;
} => ({
  indent: resolveIndent(options?.indent, options?.sourceText),
  sort: options?.sort ?? true,
  stripEmpty: options?.stripEmpty ?? true,
  newline: options?.newline ?? true,
});

/**
 * Render an already-encoded package.json record to a JSON string, applying the
 * empty-map strip, canonical key ordering and a trailing newline unless the
 * corresponding options opt out.
 *
 * **Example** (Render sorted compact package text)
 *
 * ```ts
 * import { renderJson, resolveFormatOptions } from "@beep/package-json/internal/format";
 *
 * const text = renderJson({ version: "1.0.0", name: "p", scripts: {} }, resolveFormatOptions({ indent: 0, newline: false }));
 * console.log(text); // {"name":"p","version":"1.0.0"}
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderJson: {
  (options: ReturnType<typeof resolveFormatOptions>): (raw: Record<string, unknown>) => string;
  (raw: Record<string, unknown>, options: ReturnType<typeof resolveFormatOptions>): string;
} = dual(
  2,
  (
    raw: Record<string, unknown>,
    options: {
      readonly indent: string | number;
      readonly sort: boolean;
      readonly stripEmpty: boolean;
      readonly newline: boolean;
    }
  ): string => {
    let record = options.stripEmpty ? stripEmptyDependencyMaps(raw) : raw;
    if (options.sort) record = sortKeys(record);
    const json = Result.getOrThrowWith(
      S.encodeResult(S.fromJsonString(S.Unknown, { space: options.indent }))(record),
      identity
    );
    return options.newline ? `${json}\n` : json;
  }
);
