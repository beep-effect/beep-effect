import { dual, identity } from "effect/Function";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// Pure package.json serialization helpers: canonical top-level key ordering
// (the `sort-package-json` order), map-field alphabetization and
// empty-map stripping. These are pure `Record → Record` steps, surfaced
// through `Package.toJsonString` and `PackageJsonFile.write` options.
//
// Private implementation module — never re-exported from `index.ts`.

/**
 * Canonical top-level key order — `sort-package-json@4.0.0`'s default
 * `sortOrder`, taken verbatim so the kit's formatter byte-agrees with the
 * ecosystem tool on top-level placement (notably: `packageManager` before
 * `engines` / `devEngines`, and `sideEffects` after `publisher`, before
 * `type`). Keys not listed append after the known keys — public keys
 * alphabetically, then `_`-prefixed keys alphabetically — matching
 * `sort-package-json`'s unknown-key behavior.
 */
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

/**
 * Deterministic, locale-independent string comparison by code unit. A bare
 * `localeCompare` sorts differently across ICU builds/locales; package.json key
 * order must be stable everywhere.
 */
const byCodePoint = Order.make<string>((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const byKnownIndex = Order.mapInput(Order.Number, (entry: [string, unknown, number]) => entry[2]);
const byEntryKey = Order.mapInput(byCodePoint, (entry: [string, unknown]) => entry[0]);

/**
 * Top-level map fields whose entries are alphabetized when sorting. The
 * dependency maps for canonical presentation; `scripts` / `engines` / `bin`
 * additionally because the `Package` model carries them as `HashMap`s, whose
 * encode order is hash order — source order is already gone, so a deterministic
 * alphabetical order is strictly better. `sort-package-json` sorts `engines`
 * and `bin` identically; its `scripts` sort is a grouped sort that agrees with
 * plain code-unit order except for `pre*`/`post*` script pairing.
 */
const SORTED_MAP_KEYS = HashSet.make(
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies",
	"bundleDependencies",
	"scripts",
	"engines",
	"bin",
);

/** Alphabetize the entries of a plain-object map field. */
const sortMapEntries = (value: Record<string, unknown>): Record<string, unknown> =>
	R.fromEntries(A.map(A.sort(R.keys(value), byCodePoint), (key) => [key, value[key]] as const));

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	P.isObjectKeyword(value) && !P.isFunction(value) && !A.isArray(value);

/**
 * Order top-level keys canonically (known keys by {@link KEY_ORDER}, then
 * unknown public keys alphabetically, then unknown `_`-prefixed keys
 * alphabetically) and alphabetize the {@link SORTED_MAP_KEYS} map entries.
 *
 * **Example** (Order known and unknown package keys)
 *
 * ```ts
 * import { sortKeys } from "@beep/scratchpad/effected/package-json/internal/format";
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

	const entries = [...A.sort(known, byKnownIndex), ...A.sort(restPublic, byEntryKey), ...A.sort(restPrivate, byEntryKey)];
	return R.fromEntries(A.map(entries, ([key, value]) => [
		key,
		HashSet.has(SORTED_MAP_KEYS, key) && isPlainObject(value) ? sortMapEntries(value) : value,
	] as const));
};

// `scripts` joins the dependency maps here because the model decodes it with
// the same empty-map default: an absent key would otherwise materialize as
// `"scripts": {}` on encode.
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
 * import { stripEmptyDependencyMaps } from "@beep/scratchpad/effected/package-json/internal/format";
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
		if (isPlainObject(value) && R.keys(value).length === 0) {
			delete result[key];
		}
	}
	return result;
};

const DEFAULT_INDENT = 2;

/**
 * Detect the indentation of a JSON source text from its first indented line:
 * `"\t"` for tab indentation, otherwise the leading run of spaces. Returns
 * `undefined` when no line is indented.
 *
 * **Example** (Inspect a four-space indent)
 *
 * ```ts
 * import { detectIndent } from "@beep/scratchpad/effected/package-json/internal/format";
 *
 * console.log(detectIndent('{\n    "name": "p"\n}')?.length); // 4
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const detectIndent = (source: string): string | undefined => {
	for (const line of Str.split(source, "\n")) {
		const match = /^(\t+| +)\S/.exec(line);
		const indent = match?.[1];
		if (indent !== undefined) {
			return Str.startsWith("\t")(indent) ? "\t" : indent;
		}
	}
	return undefined;
};

/**
 * Resolve a `PackageFormatOptions.indent` value to the `JSON.stringify` indent
 * argument: `"tab"` becomes a real tab, `"preserve"` reuses the indentation
 * detected from `sourceText` (falling back to the two-space default when no
 * source text or no indented line is available), and a number passes through.
 *
 * **Example** (Preserve indent or use the default)
 *
 * ```ts
 * import { resolveIndent } from "@beep/scratchpad/effected/package-json/internal/format";
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
} = dual(2, (
	indent: number | "tab" | "preserve" | undefined,
	sourceText: string | undefined,
): string | number => {
	if (indent === "tab") return "\t";
	if (indent === "preserve") {
		return sourceText === undefined ? DEFAULT_INDENT : (detectIndent(sourceText) ?? DEFAULT_INDENT);
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
 * import { resolveFormatOptions } from "@beep/scratchpad/effected/package-json/internal/format";
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
 * import { renderJson, resolveFormatOptions } from "@beep/scratchpad/effected/package-json/internal/format";
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
} = dual(2, (
	raw: Record<string, unknown>,
	options: {
		readonly indent: string | number;
		readonly sort: boolean;
		readonly stripEmpty: boolean;
		readonly newline: boolean;
	},
): string => {
	let record = options.stripEmpty ? stripEmptyDependencyMaps(raw) : raw;
	if (options.sort) record = sortKeys(record);
	const json = Result.getOrThrowWith(
		S.encodeResult(S.fromJsonString(S.Unknown, { space: options.indent }))(record),
		identity,
	);
	return options.newline ? `${json}\n` : json;
});
