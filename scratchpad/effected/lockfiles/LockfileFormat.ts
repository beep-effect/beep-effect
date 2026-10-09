import { Option, Schema } from "effect";

/**
 * The lockfile formats this package parses: bun's `bun.lock` (JSONC), npm's
 * `package-lock.json` (JSON), pnpm's `pnpm-lock.yaml` and yarn Berry's
 * `yarn.lock` (both YAML).
 *
 * @remarks
 * The literal names the *lockfile format*, not the package manager that
 * happens to write it — this package models lockfiles. Yarn support is
 * Berry only; classic (v1) `yarn.lock` is not YAML and fails
 * `Lockfile.parse` with a typed `LockfileParseError`.
 *
 * The format literal says nothing about which *versions* of that format are
 * supported: pnpm `lockfileVersion` 9+ and npm `lockfileVersion` 3+ parse,
 * and older ones fail typed. See `Lockfile.parse`.
 *
 * @public
 */
export const LockfileFormat = Schema.Literals(["bun", "npm", "pnpm", "yarn"]);

/**
 * The union of supported lockfile format names.
 *
 * @public
 */
export type LockfileFormat = typeof LockfileFormat.Type;

// Primary first — filenameFor and fromFilename both read element zero, so the
// primary spelling has exactly one home.
const FILENAMES: Readonly<Record<LockfileFormat, readonly [string, ...ReadonlyArray<string>]>> = {
	bun: ["bun.lock", "bun.lockb"],
	npm: ["package-lock.json", "npm-shrinkwrap.json"],
	pnpm: ["pnpm-lock.yaml"],
	yarn: ["yarn.lock"],
};

/**
 * The conventional lockfile filename for a format: `"bun.lock"`,
 * `"package-lock.json"`, `"pnpm-lock.yaml"` or `"yarn.lock"`.
 *
 * @remarks
 * The primary name only — the first element of {@link filenamesFor}, which is
 * what detection that must also see the genuine alternates should use.
 *
 * @public
 */
export const filenameFor = (format: LockfileFormat): string => FILENAMES[format][0];

/**
 * Every filename a format is genuinely written under, primary first.
 *
 * @remarks
 * Real detection needs more than the conventional name: npm honours
 * `npm-shrinkwrap.json` (and prefers it over `package-lock.json` when both
 * exist — the ordering here is conventional-name-first, not npm's own
 * precedence), and bun has shipped two formats, the current text `bun.lock`
 * and the older **binary** `bun.lockb`. pnpm and yarn each have exactly one.
 *
 * Only genuine *lockfile* spellings appear here. Files that merely influence
 * what an install resolves to — `pnpm-workspace.yaml`, `.pnpmfile.cjs`, yarn's
 * PnP artifacts — are a consumer's cache policy, not alternates of the
 * lockfile.
 *
 * Two deliberate asymmetries with the rest of this module: `bun.lockb` is a
 * detection alternate but not a parse target (`Lockfile.parse` takes text; the
 * binary format fails typed), and {@link fromFilename} keeps answering for the
 * primary names only.
 *
 * @public
 */
export const filenamesFor = (format: LockfileFormat): readonly [string, ...ReadonlyArray<string>] => FILENAMES[format];

/**
 * The format a lockfile filename identifies, if any.
 *
 * @remarks
 * Matches exact conventional filenames only (`"bun.lock"`,
 * `"package-lock.json"`, `"pnpm-lock.yaml"`, `"yarn.lock"`) — paths, other
 * spellings and the {@link filenamesFor} alternates return `Option.none()`.
 *
 * @public
 */
export const fromFilename = (name: string): Option.Option<LockfileFormat> => {
	for (const format of LockfileFormat.literals) {
		if (FILENAMES[format][0] === name) return Option.some(format);
	}
	return Option.none();
};
