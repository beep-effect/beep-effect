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

const KEY_INDEX = new Map(KEY_ORDER.map((k, i) => [k, i] as const));

/**
 * Deterministic, locale-independent string comparison by code unit. A bare
 * `localeCompare` sorts differently across ICU builds/locales; package.json key
 * order must be stable everywhere.
 */
const byCodePoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Top-level map fields whose entries are alphabetized when sorting. The
 * dependency maps for canonical presentation; `scripts` / `engines` / `bin`
 * additionally because the `Package` model carries them as `HashMap`s, whose
 * encode order is hash order — source order is already gone, so a deterministic
 * alphabetical order is strictly better. `sort-package-json` sorts `engines`
 * and `bin` identically; its `scripts` sort is a grouped sort that agrees with
 * plain code-unit order except for `pre*`/`post*` script pairing.
 */
const SORTED_MAP_KEYS: ReadonlySet<string> = new Set([
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies",
	"bundleDependencies",
	"scripts",
	"engines",
	"bin",
]);

/** Alphabetize the entries of a plain-object map field. */
const sortMapEntries = (value: Record<string, unknown>): Record<string, unknown> => {
	const result: Record<string, unknown> = {};
	for (const key of Object.keys(value).sort(byCodePoint)) {
		result[key] = value[key];
	}
	return result;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Order top-level keys canonically (known keys by {@link KEY_ORDER}, then
 * unknown public keys alphabetically, then unknown `_`-prefixed keys
 * alphabetically) and alphabetize the {@link SORTED_MAP_KEYS} map entries.
 */
export const sortKeys = (obj: Record<string, unknown>): Record<string, unknown> => {
	const known: Array<[string, unknown]> = [];
	const restPublic: Array<[string, unknown]> = [];
	const restPrivate: Array<[string, unknown]> = [];

	for (const key of Object.keys(obj)) {
		if (KEY_INDEX.has(key)) known.push([key, obj[key]]);
		else if (key.startsWith("_")) restPrivate.push([key, obj[key]]);
		else restPublic.push([key, obj[key]]);
	}

	// biome-ignore lint/style/noNonNullAssertion: keys in `known` are all present in KEY_INDEX
	known.sort((a, b) => KEY_INDEX.get(a[0])! - KEY_INDEX.get(b[0])!);
	restPublic.sort((a, b) => byCodePoint(a[0], b[0]));
	restPrivate.sort((a, b) => byCodePoint(a[0], b[0]));

	const result: Record<string, unknown> = {};
	for (const [key, value] of [...known, ...restPublic, ...restPrivate]) {
		result[key] = SORTED_MAP_KEYS.has(key) && isPlainObject(value) ? sortMapEntries(value) : value;
	}
	return result;
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

/** Remove map keys whose value is an empty object. */
export const stripEmptyDependencyMaps = (raw: Record<string, unknown>): Record<string, unknown> => {
	const result = { ...raw };
	for (const key of STRIP_EMPTY_KEYS) {
		const value = result[key];
		if (isPlainObject(value) && Object.keys(value).length === 0) {
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
 */
export const detectIndent = (source: string): string | undefined => {
	for (const line of source.split("\n")) {
		const match = /^(\t+| +)\S/.exec(line);
		if (match !== null) {
			// biome-ignore lint/style/noNonNullAssertion: the group is non-optional in a successful match
			const indent = match[1]!;
			return indent.startsWith("\t") ? "\t" : indent;
		}
	}
	return undefined;
};

/**
 * Resolve a `PackageFormatOptions.indent` value to the `JSON.stringify` indent
 * argument: `"tab"` becomes a real tab, `"preserve"` reuses the indentation
 * detected from `sourceText` (falling back to the two-space default when no
 * source text or no indented line is available), and a number passes through.
 */
export const resolveIndent = (
	indent: number | "tab" | "preserve" | undefined,
	sourceText: string | undefined,
): string | number => {
	if (indent === "tab") return "\t";
	if (indent === "preserve") {
		return sourceText === undefined ? DEFAULT_INDENT : (detectIndent(sourceText) ?? DEFAULT_INDENT);
	}
	return indent ?? DEFAULT_INDENT;
};

/**
 * Resolve the public `PackageFormatOptions` bag (mirrored structurally here —
 * this module cannot import `Package.ts` without closing a cycle) to the
 * concrete {@link renderJson} options. Shared by `Package.toJsonString` and
 * `PackageManifest.toJsonString` so the two serializers cannot drift.
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
 */
export const renderJson = (
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
	const json = JSON.stringify(record, null, options.indent);
	return options.newline ? `${json}\n` : json;
};
