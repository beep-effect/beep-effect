// biome-ignore-all lint/suspicious/noTemplateCurlyInString: the shipped fixtures are source text, and a template substitution inside one is the point
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Num from "effect/Number";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import { $ScratchpadId } from "@beep/identity/packages";
import { GlobSet } from "../glob/index.ts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as R from "effect/Record";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { codePointAt, codePointBefore, isIdentifierChar, lex, locate, references, specifierLiterals } from "./internal/sourceText.ts";

const $I = $ScratchpadId.create("effected/workspaces/SourceBoundary");

/**
 * One rule a source file must keep.
 *
 * @remarks
 * `"process"` forbids a read of the global `process`. `"node:process"` forbids
 * importing `node:process` or `process`. `"stdout-write"` forbids a
 * `stdout.write` on anything, and a `stdout.end(chunk)`, which writes its
 * chunk before closing; an `end()` with no chunk is spared. It matches the
 * name `stdout`, so a renamed receiver (`const { stdout: o } = process`) is
 * not seen: the `"process"` rule is what backstops it, so waiving `"process"`
 * for a file waives that backstop too. `"console"` forbids any reference to the
 * global `console`. `"console-stdout"` forbids a reference to the global
 * `console` except a member access to one of the methods Node's console
 * writes to stderr: `error`, `warn`, `trace` and `assert`. A bare or aliased
 * reference (`const c = console`, `f(console)`, `console[m]`) is still
 * flagged, since it can reach the stdout methods. Neither console rule flags
 * core's `Console` service. `{ forbidImports }` forbids an import whose specifier
 * equals an entry, is a subpath of one, or starts with an entry's text before a
 * trailing `*` (so `"node:*"` and `"@effect/platform*"` are prefixes).
 * `{ forbidTokens }` forbids each entry's exact text wherever it appears in
 * code (see {@link SourceBoundary.check} for how a token is matched).
 *
 * To confine a token to named files rather than forbid it everywhere, forbid
 * it and waive the rule for those files through
 * {@link ScanOptions.allowRules}: the `"forbidTokens"` key names the files, and
 * `SourceScan.waived` then reports every use inside them, so a
 * confinement that no longer matches anything shows up there. The house rule
 * "`process.env.__PACKAGE_VERSION__` only in `version.ts`" is
 * `rules: [{ forbidTokens: ["process.env.__PACKAGE_VERSION__"] }]` with
 * `allowRules: { forbidTokens: ["version.ts"] }`.
 *
 * `"node:*"` matches only the `node:` spelling: a bare built-in such as `"fs"`
 * is not caught. To forbid both, spread Node's own list from the test file,
 * `{ forbidImports: ["node:*", ...builtinModules] }` with `builtinModules`
 * from `node:module`. That also forbids npm packages that share a built-in's
 * name (`events`, `buffer`, `punycode`). No built-in list ships here: it
 * would drift with Node releases.
 *
 * @public
 */
export const BoundaryRule = S.Union([
	S.Literals(["process", "node:process", "stdout-write", "console", "console-stdout"]),
	S.Struct({ forbidImports: S.Array(S.String).annotateKey({ description: "Forbidden module names or prefixes." }) }),
	S.Struct({ forbidTokens: S.Array(S.String).annotateKey({ description: "Exact forbidden code tokens." }) }),
]).pipe($I.annoteSchema("BoundaryRule", { description: "One rule a source file must keep." }));
export type BoundaryRule = typeof BoundaryRule.Type;

/**
 * Options for the `process` rule.
 *
 * @public
 */
export interface ReferenceOptions {
	/**
	 * Exact tokens exempt from the `process` rule, each starting at the
	 * reference (`"process.env.MY_CONSTANT"`). `process.env.__PACKAGE_VERSION__`
	 * is always exempt: the bundler substitutes it at build time. To hold such a
	 * token to named files, forbid it with a `{ forbidTokens }` rule as well (see
	 * {@link BoundaryRule}).
	 */
	readonly ignoreTokens?: ReadonlyArray<string> | undefined;
}

/**
 * A snippet with the verdict one rule must reach on it.
 *
 * @public
 */
export const BoundaryFixture = S.Struct({
	name: S.String.annotateKey({ description: "What the snippet exercises." }),
	source: S.String.annotateKey({ description: "The source text." }),
	rule: BoundaryRule.annotateKey({ description: "The rule it is checked against." }),
	flagged: S.Boolean.annotateKey({ description: "Whether that rule must flag it." }),
}).pipe($I.annoteSchema("BoundaryFixture", { description: "A snippet with the verdict one rule must reach on it." }));
export type BoundaryFixture = typeof BoundaryFixture.Type;

/**
 * The rule an {@link Offence} names: every string {@link BoundaryRule}, plus
 * `"forbidImports"` for any `{ forbidImports }` rule and `"forbidTokens"` for
 * any `{ forbidTokens }` rule. These are the keys of
 * {@link ScanOptions.allowRules}.
 *
 * @public
 */
export const OffenceRule = LiteralKit([
	"process", "node:process", "stdout-write", "console", "console-stdout", "forbidImports", "forbidTokens",
]).pipe($I.annoteSchema("OffenceRule", { description: "The rule an offence names, including import and token rules." }));
export type OffenceRule = typeof OffenceRule.Type;

/**
 * One place a source file breaks a {@link BoundaryRule}.
 *
 * @public
 */
export class Offence extends S.Class<Offence>($I`Offence`)({
	/** The file, relative to the scanned root, with `/` separators. */
	file: S.String.annotateKey({ description: "The file, relative to the scanned root, with `/` separators." }),
	/** The 1-based line. */
	line: S.Finite.annotateKey({ description: "The 1-based line." }),
	/** The 1-based column, in UTF-16 code units. */
	column: S.Finite.annotateKey({ description: "The 1-based column, in UTF-16 code units." }),
	/** The rule broken. */
	rule: OffenceRule.annotateKey({ description: "The rule broken." }),
	/** What matched: the identifier, the call, the import specifier, or the token. */
	detail: S.String.annotateKey({ description: "What matched: the identifier, the call, the import specifier, or the token." }),
}, $I.annote("Offence", { description: "One place a source file breaks a BoundaryRule." })) {
	/** `file:line:column rule detail`, the form an assertion message reads best in. */
	get label(): string {
		return `${this.file}:${this.line}:${this.column} ${this.rule} ${this.detail}`;
	}
}

/**
 * What a scan read and found.
 *
 * @public
 */
export class SourceScan extends S.Class<SourceScan>($I`SourceScan`)({
	/** Every source file visited, relative to the root with `/` separators, sorted. Assert it is non-empty. */
	files: S.Array(S.String).annotateKey({ description: "Every source file visited, relative to the root with `/` separators, sorted. Assert it is non-empty." }),
	/** The visited files an `allow` glob exempted from every rule. */
	allowed: S.Array(S.String).annotateKey({ description: "The visited files an `allow` glob exempted from every rule." }),
	/** Every offence, sorted by file, then line, then column. */
	offences: S.Array(Offence).annotateKey({ description: "Every offence, sorted by file, then line, then column." }),
	/**
	 * Every offence an `allowRules` glob waived, sorted like `offences`. Assert
	 * it is exactly what you meant to waive: a waiver that no longer waives
	 * anything, or waives more than intended, shows up here.
	 */
	waived: S.Array(Offence).annotateKey({ description: "Every offence an `allowRules` glob waived, sorted like `offences`. Assert it is exactly what you meant to waive: a waiver that no longer waives anything, or waives more than intended, shows up here." }),
}, $I.annote("SourceScan", { description: "What a scan read and found." })) {
	/** One `file:line:column rule detail` label per offence: `[]` means clean. */
	get violations(): ReadonlyArray<string> {
		return this.offences.map((offence) => offence.label);
	}
}

/**
 * Options for {@link SourceBoundary.scan}.
 *
 * @public
 */
export interface ScanOptions extends ReferenceOptions {
	/** The directory to scan. */
	readonly root: string;
	/** The rules every non-allowed file must keep. */
	readonly rules: ReadonlyArray<BoundaryRule>;
	/** Globs, relative to `root` with `/` separators, naming files exempt from every rule. */
	readonly allow?: ReadonlyArray<string> | undefined;
	/**
	 * Globs per rule, matched like `allow`, naming files exempt from that one
	 * rule. A matching file is still checked against every other rule, and
	 * each offence a glob waives is reported in `SourceScan.waived`
	 * rather than dropped. The `"forbidImports"` key covers every
	 * `{ forbidImports }` rule, and the `"forbidTokens"` key every
	 * `{ forbidTokens }` rule, which is how a token is confined to named files.
	 * A file `allow` matches is exempt from every rule, so nothing in it is
	 * waived.
	 */
	readonly allowRules?: { readonly [R in OffenceRule]?: ReadonlyArray<string> | undefined } | undefined;
	/**
	 * File extensions to scan. Defaults to `.ts`, `.mts`, `.cts`, `.js`,
	 * `.mjs` and `.cjs`; declaration files are always skipped.
	 */
	readonly extensions?: ReadonlyArray<string> | undefined;
}

const DEFAULT_EXTENSIONS: ReadonlyArray<string> = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"];
const DECLARATION = /\.d\.[cm]?ts$/;
const byCodeUnit = Str.Order;
const byPosition = Order.combine(
	Order.mapInput(Str.Order, (o: Offence) => o.file),
	Order.combine(Order.mapInput(Num.Order, (o: Offence) => o.line), Order.mapInput(Num.Order, (o: Offence) => o.column)),
);

const EXEMPT: ReadonlyArray<string> = ["process.env.__PACKAGE_VERSION__"];
/**
 * The console methods Node writes to stderr. nodejs.org/api/console.html has
 * `error` and `trace` print to stderr and `warn` alias `error`; it names no
 * stream for `assert`, and a probe over a `Console` built on two capturing
 * streams sent a failing `assert` to stderr. Everything else that writes
 * (`log`, `info`, `debug`, `dir`, `dirxml`, `table`, `count`, `group`,
 * `time`) writes to stdout.
 */
const STDERR_METHODS = MutableHashSet.fromIterable(["error", "warn", "trace", "assert"]);
const STDOUT_WRITE = /stdout\s*(?:\?\.|\.)\s*(write|end)/gu;

/** An `end(` call that passes a final chunk, which `Writable.end` writes before closing. */
const END_WITH_CHUNK = /^\s*\(\s*[^\s)]/u;

/** Whether the reference at `at` is itself a member access (`globalThis.process`), which no ignore token exempts. */
const isMemberAccess = (code: string, at: number): boolean => {
	let j = at - 1;
	while (j >= 0 && /\s/.test(code[j] ?? "")) j--;
	return code[j] === ".";
};

const processReads = (code: string, ignoreTokens: ReadonlyArray<string>): ReadonlyArray<number> =>
	references(code, "process").filter(
		(at) =>
			isMemberAccess(code, at) ||
			!ignoreTokens.some((token) => code.startsWith(token, at) && !isIdentifierChar(codePointAt(code, at + token.length))),
	);

const stdoutWrites = (code: string): ReadonlyArray<{ readonly at: number; readonly method: string }> =>
	[...code.matchAll(STDOUT_WRITE)]
		.map((match) => ({
			at: match.index ?? 0,
			end: (match.index ?? 0) + match[0].length,
			method: match[1] ?? "write",
		}))
		.filter(({ at, end }) => !isIdentifierChar(codePointBefore(code, at)) && code[at - 1] !== "#" && !isIdentifierChar(codePointAt(code, end)))
		.filter(({ end, method }) => method === "write" || END_WITH_CHUNK.test(code.slice(end)))
		.map(({ at, method }) => ({ at, method }));

/** The member name directly after the reference at `at` (`console.log` → `"log"`, `console?.log` too), or `undefined` when it is not a named member access. */
const memberAfter = (code: string, at: number, name: string): string | undefined => {
	let j = at + name.length;
	while (j < code.length && /\s/.test(code[j] ?? "")) j++;
	if (code[j] === "?" && code[j + 1] === ".") j++;
	if (code[j] !== ".") return undefined;
	j++;
	while (j < code.length && /\s/.test(code[j] ?? "")) j++;
	let end = j;
	while (isIdentifierChar(codePointAt(code, end))) end += codePointAt(code, end)?.length ?? 1;
	return end > j ? code.slice(j, end) : undefined;
};

/**
 * Every offset where `token` appears in `code` as whole text: a token that
 * starts with an identifier character must not continue one (nor follow `#`),
 * and one that ends with an identifier character must not run into another.
 */
const tokenOccurrences = (code: string, token: string): ReadonlyArray<number> => {
	if (token.length === 0) return [];
	const guardStart = isIdentifierChar(codePointAt(token, 0));
	const guardEnd = isIdentifierChar(codePointBefore(token, token.length));
	const found: Array<number> = [];
	for (let at = code.indexOf(token); at !== -1; at = code.indexOf(token, at + 1)) {
		if (guardStart && (isIdentifierChar(codePointBefore(code, at)) || code[at - 1] === "#")) continue;
		if (guardEnd && isIdentifierChar(codePointAt(code, at + token.length))) continue;
		found.push(at);
	}
	return found;
};

const forbids = (entry: string, specifier: string): boolean =>
	entry.endsWith("*")
		? specifier.startsWith(entry.slice(0, -1))
		: specifier === entry || specifier.startsWith(`${entry}/`);

const isNodeModule = (specifier: string, module: string): boolean =>
	[module, `node:${module}`].some((name) => specifier === name || specifier.startsWith(`${name}/`));

const FIXTURES: ReadonlyArray<BoundaryFixture> = [
	{ name: "node:process: an escaped import", source: 'import p from "\\u006eode:process";', rule: "node:process", flagged: true },
	{ name: "process: astral identifier prefix", source: "const 𝒙process = 1; 𝒙process;", rule: "process", flagged: false },
	{ name: "process: astral identifier suffix", source: "const process𝒙 = 1; process𝒙;", rule: "process", flagged: false },
	{ name: "process: after a CR line comment", source: "// harmless\rprocess.touch();", rule: "process", flagged: true },
	{ name: "process: after a line-separator comment", source: "// harmless\u2028process.touch();", rule: "process", flagged: true },
	{ name: "process: after a paragraph-separator comment", source: "// harmless\u2029process.touch();", rule: "process", flagged: true },

	{ name: "process: destructuring", source: "const { env } = process;", rule: "process", flagged: true },
	{ name: "process: bracket access", source: 'const env = process["env"];', rule: "process", flagged: true },
	{
		name: "process: a member of globalThis",
		source: "const cwd = globalThis.process?.cwd();",
		rule: "process",
		flagged: true,
	},
	{
		name: "process: a template substitution",
		source: "const where = `cwd: ${process.cwd()}`;",
		rule: "process",
		flagged: true,
	},
	{
		name: "process: after a string holding a comment opener",
		source: 'const open = "/*"; const argv = process.argv; const close = "*/";',
		rule: "process",
		flagged: true,
	},
	{
		name: "process: after a regex holding a quote",
		source: 'const re = /"/; const argv = process.argv; const q = "x";',
		rule: "process",
		flagged: true,
	},
	{
		name: "process: after a division",
		source: "const half = total / 2; const argv = process.argv; const r = 1 / 4;",
		rule: "process",
		flagged: true,
	},
	{ name: "process: a comment", source: "// process.exit(1)\n/* process.cwd() */", rule: "process", flagged: false },
	{ name: "process: a string", source: 'const label = "process.env";', rule: "process", flagged: false },
	{
		name: "process: template text",
		source: "const help = `run process.exit to quit`;",
		rule: "process",
		flagged: false,
	},
	{ name: "process: a regex literal", source: "const re = /process\\.env/g;", rule: "process", flagged: false },
	{
		name: "process: a member of another object",
		source: "const pid = child.process;",
		rule: "process",
		flagged: false,
	},
	{
		name: "process: the build-time version constant",
		source: "const version = process.env.__PACKAGE_VERSION__;",
		rule: "process",
		flagged: false,
	},
	// The lexer-ambiguity corpus: each snippet once hid a real read (or invented one).
	{
		name: "process: the version constant reached through globalThis",
		source: "const version = globalThis.process.env.__PACKAGE_VERSION__;",
		rule: "process",
		flagged: true,
	},
	{
		name: "process: after a non-null assertion divided",
		source: "const y = x! / 2; const a = process.argv; const b = 1 / 4;",
		rule: "process",
		flagged: true,
	},
	{
		name: "process: after a postfix increment divided",
		source: "const y = i++ / 2; const a = process.argv; const b = 1 / 4;",
		rule: "process",
		flagged: true,
	},
	{
		name: "process: after a call divided",
		source: "const y = f(x) / 2; const a = process.argv; const b = 1 / 4;",
		rule: "process",
		flagged: true,
	},
	{
		name: "process: after a regex that follows an if condition",
		source: "if (x) /\\/*/.test(s);\nconst a = process.argv;\n/* c */",
		rule: "process",
		flagged: true,
	},
	{ name: "process: a ternary branch", source: "const p = ok ? process : fallback;", rule: "process", flagged: true },
	{ name: "process: an object-literal key", source: "const o = { process: 1 };", rule: "process", flagged: false },
	{ name: "process: a type member", source: "interface I { process?: string }", rule: "process", flagged: false },
	{
		name: "node:process: a static import",
		source: 'import { env } from "node:process";',
		rule: "node:process",
		flagged: true,
	},
	{
		name: "node:process: a dynamic import",
		source: 'const p = await import("process");',
		rule: "node:process",
		flagged: true,
	},
	{
		name: "node:process: a string that is not a specifier",
		source: 'const s = "node:process";',
		rule: "node:process",
		flagged: false,
	},
	{
		name: "node:process: an unrelated specifier",
		source: 'import { ChildProcess } from "effect/process";',
		rule: "node:process",
		flagged: false,
	},
	{ name: "stdout-write: a direct write", source: 'process.stdout.write("x");', rule: "stdout-write", flagged: true },
	{
		name: "stdout-write: an end with a chunk",
		source: 'process.stdout.end("x");',
		rule: "stdout-write",
		flagged: true,
	},
	{
		name: "stdout-write: an end without a chunk",
		source: "process.stdout.end();",
		rule: "stdout-write",
		flagged: false,
	},
	{ name: "stdout-write: a string", source: 'const s = "stdout.write";', rule: "stdout-write", flagged: false },
	{ name: "console: console.log", source: 'console.log("x");', rule: "console", flagged: true },
	{ name: "console: console.error", source: "console.error(e);", rule: "console", flagged: true },
	{
		name: "console: the Console service",
		source: "const current = yield* Console.Console;",
		rule: "console",
		flagged: false,
	},
	{ name: "console-stdout: console.log", source: 'console.log("x");', rule: "console-stdout", flagged: true },
	{ name: "console-stdout: a bare alias", source: "const c = console;", rule: "console-stdout", flagged: true },
	{ name: "console-stdout: console.error", source: "console.error(e);", rule: "console-stdout", flagged: false },
	{
		name: "console-stdout: a stderr method through globalThis",
		source: 'globalThis.console.warn("x");',
		rule: "console-stdout",
		flagged: false,
	},
	{
		name: "console-stdout: the Console service",
		source: "const current = yield* Console.Console;",
		rule: "console-stdout",
		flagged: false,
	},
	{
		name: "forbidImports: a platform package",
		source: 'import { NodeServices } from "@effect/platform-node";',
		rule: { forbidImports: ["@effect/platform*"] },
		flagged: true,
	},
	{
		name: "forbidImports: a commented-out import",
		source: '// import { NodeServices } from "@effect/platform-node";',
		rule: { forbidImports: ["@effect/platform*"] },
		flagged: false,
	},
	{
		name: "forbidTokens: the build-time version constant",
		source: "export const version = process.env.__PACKAGE_VERSION__;",
		rule: { forbidTokens: ["process.env.__PACKAGE_VERSION__"] },
		flagged: true,
	},
	{
		name: "forbidTokens: the token reached through globalThis",
		source: "const version = globalThis.process.env.__PACKAGE_VERSION__;",
		rule: { forbidTokens: ["process.env.__PACKAGE_VERSION__"] },
		flagged: true,
	},
	{
		name: "forbidTokens: a string and a comment",
		source: 'const s = "process.env.__PACKAGE_VERSION__"; // process.env.__PACKAGE_VERSION__',
		rule: { forbidTokens: ["process.env.__PACKAGE_VERSION__"] },
		flagged: false,
	},
	{
		name: "forbidTokens: a longer identifier",
		source: "const v = process.env.__PACKAGE_VERSION__X;",
		rule: { forbidTokens: ["process.env.__PACKAGE_VERSION__"] },
		flagged: false,
	},
	{
		name: "forbidTokens: the tail of a longer identifier",
		source: "const v = xprocess.env.__PACKAGE_VERSION__;",
		rule: { forbidTokens: ["process.env.__PACKAGE_VERSION__"] },
		flagged: false,
	},
	{
		name: "forbidTokens: after a variable named of, divided",
		source: "const of = 8; const x = of / 2; const v = process.env.__PACKAGE_VERSION__; const y = 8 / 2;",
		rule: { forbidTokens: ["process.env.__PACKAGE_VERSION__"] },
		flagged: true,
	},
	{
		name: "forbidTokens: a private field",
		source: "const v = this.#process.env.__PACKAGE_VERSION__;",
		rule: { forbidTokens: ["process.env.__PACKAGE_VERSION__"] },
		flagged: false,
	},
];

/**
 * Source-text boundary checks: which files read `process`, import a forbidden
 * module, or write to stdout or the console.
 *
 * @remarks
 * Every check runs over one lexer pass that separates code from comments,
 * strings, template text and regex bodies, so `process` in prose, in a string
 * or in an embedded script's template text never counts, and a `/*` inside a
 * string never hides the code behind it. A `/` after an operand divides (an
 * identifier, `)`, `]`, a postfix `++`/`--` or a non-null `!`), while one after
 * an operator, a keyword or the `)` of an `if`/`while`/`for`/`with` condition
 * opens a regex. An object-literal key or type member named `process`
 * (`{ process: 1 }`) is not a read.
 *
 * It is a lexer, not a type checker, and these misses are known:
 *
 * - there is no scope analysis, so ANY local binding named `process` or
 *   `console` is flagged like the global: a parameter
 *   (`(process: Handle) => process.kill()`), a variable, a label, or an
 *   unannotated class field (`process = 1`). An annotated class field
 *   (`process: T`) reads as a type member and is spared. Prefer renaming the
 *   binding; otherwise waive that one rule for the file with an
 *   `allowRules` glob, which leaves every other rule in force and reports
 *   what it waived. An `allow` glob exempts the file from every rule;
 *
 * - a computed access through a string key (`globalThis["process"]`) and a
 *   destructuring of a global (`const { process: p } = globalThis`) are not seen;
 *
 * - a regex literal directly after a block-closing `}` reads as a division, so
 *   a quote or `/*` inside it can hide the code after it;
 *
 * - JSX text reads as code;
 *
 * - a variable named `yield` or `await` in a sloppy-mode script reads as the
 *   keyword, so a `/` after it opens a regex (module and strict code reserve
 *   both words);
 *
 * - `forbidImports: ["node:*"]` does not catch a bare built-in such as
 *   `"fs"` (see {@link BoundaryRule}).
 *
 * Assert on {@link SourceBoundary.verifyFixtures} beside your own scan: it
 * proves the scanner you are trusting still flags what it must and spares
 * what it must.
 *
 * @example
 * ```ts
 * import { SourceBoundary } from "./testing.ts";
 *
 * const offences = SourceBoundary.check("src/a.ts", "const { env } = process;", ["process"]);
 * const clean = SourceBoundary.verifyFixtures().length === 0;
 * console.log(offences.map((offence) => offence.label), clean);
 * // => [ 'src/a.ts:1:17 process process' ] true
 * ```
 *
 * @public
 */
export class SourceBoundary {
	private constructor() {}

	/** `text` with every comment blanked to spaces; strings, templates and regexes untouched, length and line breaks kept. */
	static readonly stripComments = (text: string): string => lex(text).withoutComments;

	/** Whether `text` reads the global `process` in code (see {@link BoundaryRule}). */
	static readonly referencesProcess = (text: string, options?: ReferenceOptions): boolean =>
		processReads(lex(text).code, [...EXEMPT, ...(options?.ignoreTokens ?? [])]).length > 0;

	/** Every module specifier `text` imports: static, side-effect, re-export, type-only, `import(...)` with a literal, and `require(...)`. */
	static readonly importSpecifiers = (text: string): ReadonlyArray<string> =>
		specifierLiterals(lex(text)).map((literal) => literal.value);

	/** Whether `text` imports the Node built-in `module`, in either its `node:` or bare form. */
	static readonly importsNode = (text: string, module: string): boolean =>
		SourceBoundary.importSpecifiers(text).some((specifier) => isNodeModule(specifier, module));

	/**
	 * Every place `text` breaks one of `rules`, in source order, attributed to `file`.
	 *
	 * @remarks
	 * A `{ forbidTokens }` entry matches its exact text in code only: comments,
	 * strings, template text and regex bodies are blanked first, so a token that
	 * itself contains a string literal never matches, and whitespace inside a
	 * token must match byte for byte. A token that starts with an identifier
	 * character does not match inside a longer identifier or after `#`, and one
	 * that ends with one does not match when an identifier character follows.
	 * A member access is still a match: `globalThis.process.env.X` contains the
	 * token `process.env.X`. A token listed twice is reported once. A token with
	 * no identifier character at either end (`"=>"`, `"?."`) has no edge guard,
	 * so it matches inside longer punctuation, and consecutive matches of it can
	 * overlap.
	 */
	static readonly check = (
		file: string,
		text: string,
		rules: ReadonlyArray<BoundaryRule>,
		options?: ReferenceOptions,
	): ReadonlyArray<Offence> => {
		const lexed = lex(text);
		const at = locate(text);
		const specifiers = specifierLiterals(lexed);
		const found: Array<{ readonly offset: number; readonly rule: Offence["rule"]; readonly detail: string }> = [];
		for (const rule of rules) {
			if (rule === "process") {
				for (const offset of processReads(lexed.code, [...EXEMPT, ...(options?.ignoreTokens ?? [])])) {
					found.push({ offset, rule, detail: "process" });
				}
			} else if (rule === "node:process") {
				for (const literal of specifiers) {
					if (isNodeModule(literal.value, "process"))
						found.push({ offset: literal.start, rule, detail: literal.value });
				}
			} else if (rule === "stdout-write") {
				for (const { at, method } of stdoutWrites(lexed.code))
					found.push({ offset: at, rule, detail: `stdout.${method}` });
			} else if (rule === "console") {
				for (const offset of references(lexed.code, "console")) found.push({ offset, rule, detail: "console" });
			} else if (rule === "console-stdout") {
				for (const offset of references(lexed.code, "console")) {
					const member = memberAfter(lexed.code, offset, "console");
					if (member !== undefined && MutableHashSet.has(STDERR_METHODS, member)) continue;
					found.push({ offset, rule, detail: member === undefined ? "console" : `console.${member}` });
				}
			} else if ("forbidTokens" in rule) {
				for (const token of MutableHashSet.fromIterable(rule.forbidTokens)) {
					for (const offset of tokenOccurrences(lexed.code, token))
						found.push({ offset, rule: "forbidTokens", detail: token });
				}
			} else {
				for (const literal of specifiers) {
					if (rule.forbidImports.some((entry) => forbids(entry, literal.value))) {
						found.push({ offset: literal.start, rule: "forbidImports", detail: literal.value });
					}
				}
			}
		}
		return A.sort(found, Order.mapInput(Num.Order, (f: (typeof found)[number]) => f.offset))
			.map(({ offset, rule, detail }) => Offence.make({ file, ...at(offset), rule, detail }));
	};

	/**
	 * Check every source file under `root` against `rules`.
	 *
	 * @remarks
	 * Walks with an explicit stack and real-directory ancestry (via
	 * `realPath`), so ancestor symlink cycles terminate while distinct logical
	 * paths are each scanned with their own waiver policy. `node_modules` is never entered. Paths come back relative
	 * and `/`-separated whatever the platform's separator, and that is also
	 * what `allow` globs match against. A missing root fails; it never scans
	 * nothing. A dangling symlink under the root is skipped, having nothing to
	 * scan; any other entry that cannot be read fails the scan.
	 *
	 * @example
	 * ```ts
	 * import { NodeServices } from "@effect/platform-node";
	 * import { SourceBoundary } from "./testing.ts";
	 * import * as Effect from "effect/Effect";
	 *
	 * const scan = SourceBoundary.scan({
	 *   root: "/repo/packages/engine/src",
	 *   rules: ["process", "node:process", { forbidImports: ["node:*", "@effect/platform*"] }],
	 * }).pipe(Effect.provide(NodeServices.layer));
	 * ```
	 */
	static readonly scan = Effect.fn("SourceBoundary.scan")(function* (options: ScanOptions) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const allow = yield* GlobSet.compile(options.allow ?? []);
		const allowRules = MutableHashMap.empty<string, GlobSet>();
		for (const [rule, patterns] of R.toEntries<string, ReadonlyArray<string> | undefined>(options.allowRules ?? {})) {
			if (patterns !== undefined) MutableHashMap.set(allowRules, rule, yield* GlobSet.compile(patterns));
		}
		const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
		const posix = (relative: string): string => relative.split(path.sep).join("/");
		const files: Array<string> = [];
		const allowed: Array<string> = [];
		const offences: Array<Offence> = [];
		const waived: Array<Offence> = [];
		const pending: Array<{ readonly directory: string; readonly ancestors: ReadonlyArray<string> }> = [
			{ directory: options.root, ancestors: [] },
		];
		while (pending.length > 0) {
			const next = pending.pop();
			if (next === undefined) break;
			const { directory, ancestors } = next;
			const real = yield* fs.realPath(directory);
			if (A.some(ancestors, (ancestor) => ancestor === real)) continue;
			const ancestry = A.append(ancestors, real);
			for (const name of yield* fs.readDirectory(directory)) {
				const full = path.join(directory, name);
				// stat follows links, so a dangling one fails NotFound; it has nothing to scan, so skip it.
				// A NotFound on an entry that is not a link still fails: nothing may drop out of the scan silently.
				const found = yield* fs.stat(full).pipe(
					Effect.asSome,
					Effect.catchIf((error) => error.reason._tag === "NotFound", (error) =>
						fs.readLink(full).pipe(
									Effect.as(O.none<FileSystem.File.Info>()),
									Effect.mapError(() => error),
							),
					),
				);
				if (O.isNone(found)) continue;
				const info = found.value;
				if (info.type === "Directory") {
					if (name !== "node_modules") pending.push({ directory: full, ancestors: ancestry });
					continue;
				}
				if (
					info.type !== "File" ||
					DECLARATION.test(name) ||
					!extensions.some((extension) => name.endsWith(extension))
				) {
					continue;
				}
				const file = posix(path.relative(options.root, full));
				files.push(file);
				if (allow.matches(file)) {
					allowed.push(file);
					continue;
				}
				for (const offence of SourceBoundary.check(file, yield* fs.readFileString(full), options.rules, options)) {
					(O.getOrUndefined(MutableHashMap.get(allowRules, offence.rule))?.matches(file) === true ? waived : offences).push(offence);
				}
			}
		}
		return SourceScan.make({
			files: A.sort(files, byCodeUnit),
			allowed: A.sort(allowed, byCodeUnit),
			offences: A.sort(offences, byPosition),
			waived: A.sort(waived, byPosition),
		});
	});

	/** The shipped positive- and negative-control snippets, at least one of each per rule kind. */
	static readonly fixtures: ReadonlyArray<BoundaryFixture> = FIXTURES;

	/** The names of shipped fixtures the scanner gets wrong; `[]` means it still flags and spares what it must. */
	static readonly verifyFixtures = (): ReadonlyArray<string> =>
		FIXTURES.filter(
			(fixture) => SourceBoundary.check("fixture.ts", fixture.source, [fixture.rule]).length > 0 !== fixture.flagged,
		).map((fixture) => `${fixture.flagged ? "missed" : "false positive"}: ${fixture.name}`);
}
