// Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
// Copyright: Isaac Z. Schlueter and Contributors
// License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
//
// Port notes, the deliberate changes from upstream index.ts:
// - NO ambient environment detection: defaultPlatform (process.platform and
//   the __MINIMATCH_TESTING_PLATFORM__ env read) is deleted; platform is an
//   explicit option defaulting to "posix". All win32 handling (UNC, drive
//   letters, backslash splitting, windowsNoMagicRoot) is kept behind it.
// - Dropped surface: the minimatch() convenience function, filter, match,
//   defaults(), sep, the nonull option (only meaningful for match lists),
//   the debug option and its console.error wiring (the no-op debug() method
//   and its call sites are kept so the bodies diff cleanly against
//   upstream), and the deprecated allowWindowsEscape.
// - maxGlobstarRecursion is validated by assertCap (a NaN or non-integer cap
//   is a wiring bug and dies as an InvalidCap defect). The
//   #matchGlobStarBodySections limit check is kept verbatim: exceeding it is
//   upstream's intentional false negative — an acceptable break in
//   correctness for security — and must never throw; match() stays total.
// - braceExpand keeps the CVE-2022-3517 ReDoS-safe pre-check regex verbatim
//   (credit: Yeting Li). Budget exhaustion inside the expander throws the
//   typed guard signal instead of silently truncating (see
//   braceExpansion.ts).
// - The fs-walk optimizer passes (adjascentGlobstarOptimize, spelled as
//   upstream spells it, levelOneOptimize, levelTwoFileOptimize,
//   firstPhasePreProcess, secondPhasePreProcess, partsMatch) are kept
//   unchanged behind optimizationLevel.

import { $ScratchpadId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as MutableHashSet from "effect/MutableHashSet";
import * as S from "effect/Schema";
import * as P from "effect/Predicate";
import { assertValidPattern } from "./assertValidPattern.ts";
import { AST } from "./ast.ts";
import { expand } from "./braceExpansion.ts";
import { MAX_GLOBSTAR_RECURSION, assertCap } from "./limits.ts";
import type { EngineOptions, MMRegExp, ParseReturn, ParseReturnFiltered, Platform } from "./types.ts";
import { GLOBSTAR } from "./types.ts";
import * as A from "effect/Array";

export { escape } from "./escape.ts";
export type { EngineOptions, MMRegExp, ParseReturn, ParseReturnFiltered, Platform } from "./types.ts";
export { unescape } from "./unescape.ts";
export { GLOBSTAR };

const $I = $ScratchpadId.create("effected/glob/internal/minimatch");

/**
 * An invariant violation in the internal minimatch engine.
 *
 * **Example** (Describe an engine invariant violation)
 *
 * ```ts
 * import { MinimatchError } from "@beep/scratchpad/effected/glob/internal/minimatch"
 *
 * const error = MinimatchError.make({ message: "Unexpected matching state" })
 * console.log(error.message) // Unexpected matching state
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MinimatchError extends S.TaggedError<MinimatchError>($I`MinimatchError`)("MinimatchError", {
	message: S.String.annotateKey({ description: "Describes the internal matching invariant that was violated." }),
}, $I.annote("MinimatchError", {
	title: "Minimatch engine invariant violation",
	description: "Programmer error raised when the internal matcher reaches an impossible state while matching a path against a compiled pattern.",
})) {}

// Optimized checking for the most common glob patterns.
const starDotExtRE = /^\*+([^+@!?*[(]*)$/;
const starDotExtTest = (ext: string) => (f: string) => !f.startsWith(".") && f.endsWith(ext);
const starDotExtTestDot = (ext: string) => (f: string) => f.endsWith(ext);
const starDotExtTestNocase = (ext: string) => {
	const lower = ext.toLowerCase();
	return (f: string) => !f.startsWith(".") && f.toLowerCase().endsWith(lower);
};
const starDotExtTestNocaseDot = (ext: string) => {
	const lower = ext.toLowerCase();
	return (f: string) => f.toLowerCase().endsWith(lower);
};
const starDotStarRE = /^\*+\.\*+$/;
const starDotStarTest = (f: string) => !f.startsWith(".") && f.includes(".");
const starDotStarTestDot = (f: string) => f !== "." && f !== ".." && f.includes(".");
const dotStarRE = /^\.\*+$/;
const dotStarTest = (f: string) => f !== "." && f !== ".." && f.startsWith(".");
const starRE = /^\*+$/;
const starTest = (f: string) => f.length !== 0 && !f.startsWith(".");
const starTestDot = (f: string) => f.length !== 0 && f !== "." && f !== "..";
const qmarksRE = /^\?+([^+@!?*[(]*)?$/;
const qmarksTestNocase = ([$0, ext = ""]: RegExpMatchArray) => {
	const noext = qmarksTestNoExt([$0]);
	if (ext === "") return noext;
	const lower = ext.toLowerCase();
	return (f: string) => noext(f) && f.toLowerCase().endsWith(lower);
};
const qmarksTestNocaseDot = ([$0, ext = ""]: RegExpMatchArray) => {
	const noext = qmarksTestNoExtDot([$0]);
	if (ext === "") return noext;
	const lower = ext.toLowerCase();
	return (f: string) => noext(f) && f.toLowerCase().endsWith(lower);
};
const qmarksTestDot = ([$0, ext = ""]: RegExpMatchArray) => {
	const noext = qmarksTestNoExtDot([$0]);
	return ext === "" ? noext : (f: string) => noext(f) && f.endsWith(ext);
};
const qmarksTest = ([$0, ext = ""]: RegExpMatchArray) => {
	const noext = qmarksTestNoExt([$0]);
	return ext === "" ? noext : (f: string) => noext(f) && f.endsWith(ext);
};
const qmarksTestNoExt = ([$0]: [string]) => {
	const len = $0.length;
	return (f: string) => f.length === len && !f.startsWith(".");
};
const qmarksTestNoExtDot = ([$0]: [string]) => {
	const len = $0.length;
	return (f: string) => f.length === len && f !== "." && f !== "..";
};

// any single thing other than /
// don't need to escape / when using new RegExp()
const qmark = "[^/]";

// * => any number of characters
const star = `${qmark}*?`;

// ** when dots are allowed.  Anything goes, except .. and .
// not (^ or / followed by one or two dots followed by $ or /),
// followed by anything, any number of times.
const twoStarDot = "(?:(?!(?:\\/|^)(?:\\.{1,2})($|\\/)).)*?";

// not a ^ or / followed by a dot,
// followed by anything, any number of times.
const twoStarNoDot = "(?:(?!(?:\\/|^)\\.).)*?";

// Brace expansion:
// a{b,c}d -> abd acd
// a{b,}c -> abc ac
// a{0..3}d -> a0d a1d a2d a3d
// a{b,c{d,e}f}g -> abg acdfg acefg
// a{b,c}d{e,f}g -> abdeg acdeg abdeg abdfg
//
// Invalid sets are not expanded.
// a{2..}b -> a{2..}b
// a{b}c -> a{b}c
/**
 * Expands brace alternatives and numeric ranges into concrete glob patterns.
 *
 * **Details**
 *
 * Invalid brace sets remain unexpanded. With `nobrace`, the original pattern is returned
 * as the only result. Expansion budgets are passed to the guarded brace expander.
 *
 * **Example** (Expand file extensions)
 *
 * ```ts
 * import { braceExpand } from "@beep/scratchpad/effected/glob/internal/minimatch"
 *
 * console.log(braceExpand("file.{ts,js}").join(",")) // file.ts,file.js
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const braceExpand: {
	(options?: EngineOptions): (pattern: string) => Array<string>;
	(pattern: string, options?: EngineOptions): Array<string>;
} = dual((args) => P.isString(args[0]), (pattern: string, options: EngineOptions = {}): Array<string> => {
	assertValidPattern(pattern);

	// Thanks to Yeting Li <https://github.com/yetingli> for
	// improving this regexp to avoid a ReDOS vulnerability.
	if (options.nobrace === true || !/\{(?:(?!\{).)*}/.test(pattern)) {
		// shortcut. no need to expand.
		return [pattern];
	}

	const opts = options.braceExpandMax === undefined ? {} : { max: options.braceExpandMax };
	return expand(pattern, opts);
});

// replace stuff like \* with *
const globMagic = /[?*]|[+@!]\(.*?\)|\[|]/;
const regExpEscape = (s: string): string => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

/**
 * Compiles a glob pattern once for repeated path matching and pattern inspection.
 *
 * **Details**
 *
 * The platform defaults explicitly to `posix`; Windows path handling requires `platform: "win32"`.
 * The globstar recursion cap bounds matching work; reaching it yields a false negative
 * instead of throwing, preserving the upstream security tradeoff.
 *
 * **Example** (Match a nested TypeScript path)
 *
 * ```ts
 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
 *
 * const matcher = new Minimatch(["src", "**", "*.ts"].join("/"))
 * console.log(matcher.match("src/internal/parser.ts")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Minimatch {
	/**
	 * The engine options supplied when this matcher was constructed.
	 *
	 * **Example** (Inspect options)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("*.ts", { dot: true })
	 * console.log(matcher.options.dot) // true
	 * ```
	 *
	 * @category configuration
	 * @since 0.0.0
	 */
	options: EngineOptions;
	/**
	 * The compiled segment alternatives retained after parsing and validation.
	 *
	 * **Example** (Inspect set)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("*.ts", {})
	 * console.log(matcher.set.length) // 1
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	set: Array<Array<ParseReturnFiltered>>;
	/**
	 * The working pattern after path normalization and leading-negation parsing.
	 *
	 * **Example** (Inspect pattern)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("!file.ts", {})
	 * console.log(matcher.pattern) // file.ts
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	pattern: string;

	/**
	 * Whether backslashes in the input pattern are treated as path separators.
	 *
	 * **Example** (Inspect windowsPathsNoEscape)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("file.ts", { windowsPathsNoEscape: true })
	 * console.log(matcher.windowsPathsNoEscape) // true
	 * ```
	 *
	 * @category configuration
	 * @since 0.0.0
	 */
	windowsPathsNoEscape: boolean;
	/**
	 * Whether leading negation markers remain literal pattern content.
	 *
	 * **Example** (Inspect nonegate)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("file.ts", { nonegate: true })
	 * console.log(matcher.nonegate) // true
	 * ```
	 *
	 * @category configuration
	 * @since 0.0.0
	 */
	nonegate: boolean;
	/**
	 * Whether the parsed pattern has an odd number of leading negation markers.
	 *
	 * **Example** (Inspect negate)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("!file.ts", {})
	 * console.log(matcher.negate) // true
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	negate: boolean;
	/**
	 * Whether the pattern was recognized as a comment rather than a matching pattern.
	 *
	 * **Example** (Inspect comment)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("#comment", {})
	 * console.log(matcher.comment) // true
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	comment: boolean;
	/**
	 * Whether the matcher was initialized with an empty pattern.
	 *
	 * **Example** (Inspect empty)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("", {})
	 * console.log(matcher.empty) // true
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	empty: boolean;
	/**
	 * Whether splitting and optimization preserve repeated path separators.
	 *
	 * **Example** (Inspect preserveMultipleSlashes)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("file.ts", { preserveMultipleSlashes: true })
	 * console.log(matcher.preserveMultipleSlashes) // true
	 * ```
	 *
	 * @category configuration
	 * @since 0.0.0
	 */
	preserveMultipleSlashes: boolean;
	/**
	 * The default prefix-matching mode used by path matching.
	 *
	 * **Example** (Inspect partial)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("file.ts", { partial: true })
	 * console.log(matcher.partial) // true
	 * ```
	 *
	 * @category configuration
	 * @since 0.0.0
	 */
	partial: boolean;
	/**
	 * The deduplicated brace-expanded patterns before segment preprocessing.
	 *
	 * **Example** (Inspect globSet)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("file.{ts,js}", {})
	 * console.log(matcher.globSet.join(",")) // file.ts,file.js
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	globSet: Array<string>;
	/**
	 * The preprocessed path-segment alternatives used to build the compiled set.
	 *
	 * **Example** (Inspect globParts)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("src/file.ts", {})
	 * console.log(matcher.globParts[0]?.join("/")) // src/file.ts
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	globParts: Array<Array<string>>;
	/**
	 * Whether pattern compilation uses case-insensitive matching.
	 *
	 * **Example** (Inspect nocase)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("file.ts", { nocase: true })
	 * console.log(matcher.nocase) // true
	 * ```
	 *
	 * @category configuration
	 * @since 0.0.0
	 */
	nocase: boolean;

	/**
	 * Whether the explicitly selected platform enables Windows path handling.
	 *
	 * **Example** (Inspect isWindows)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("file.ts", { platform: "win32" })
	 * console.log(matcher.isWindows) // true
	 * ```
	 *
	 * @category configuration
	 * @since 0.0.0
	 */
	isWindows: boolean;
	/**
	 * The explicit path platform, defaulting to POSIX without ambient detection.
	 *
	 * **Example** (Inspect platform)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("file.ts", {})
	 * console.log(matcher.platform) // posix
	 * ```
	 *
	 * @category configuration
	 * @since 0.0.0
	 */
	platform: Platform;
	/**
	 * Whether Windows drive and UNC roots are kept literal during pattern compilation.
	 *
	 * **Example** (Inspect windowsNoMagicRoot)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("file.ts", { platform: "win32", nocase: true })
	 * console.log(matcher.windowsNoMagicRoot) // true
	 * ```
	 *
	 * @category configuration
	 * @since 0.0.0
	 */
	windowsNoMagicRoot: boolean;
	/**
	 * The validated recursion cap used when matching globstar body sections.
	 *
	 * **Example** (Inspect maxGlobstarRecursion)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("file.ts", { maxGlobstarRecursion: 5 })
	 * console.log(matcher.maxGlobstarRecursion) // 5
	 * ```
	 *
	 * @category configuration
	 * @since 0.0.0
	 */
	maxGlobstarRecursion: number;

	/**
	 * The cached whole-pattern regular expression, initially null and false when compilation fails.
	 *
	 * **Example** (Inspect regexp)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("file.ts", {})
	 * console.log(matcher.regexp) // null
	 * ```
	 *
	 * @category models
	 * @since 0.0.0
	 */
	regexp: false | null | MMRegExp;
	/**
	 * Validates and compiles a pattern using explicit engine options.
	 *
	 * **Example** (Construct a case-insensitive matcher)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("*.TS", { nocase: true })
	 * console.log(matcher.match("file.ts")) // true
	 * ```
	 *
	 * @category constructors
	 * @since 0.0.0
	 */
	constructor(pattern: string, options: EngineOptions = {}) {
		assertValidPattern(pattern);

		this.options = options;
		this.maxGlobstarRecursion = assertCap(
			"maxGlobstarRecursion",
			options.maxGlobstarRecursion ?? MAX_GLOBSTAR_RECURSION,
		);
		this.pattern = pattern;
		this.platform = options.platform ?? "posix";
		this.isWindows = this.platform === "win32";
		this.windowsPathsNoEscape = options.windowsPathsNoEscape === true;
		if (this.windowsPathsNoEscape) {
			this.pattern = this.pattern.replace(/\\/g, "/");
		}
		this.preserveMultipleSlashes = options.preserveMultipleSlashes === true;
		this.regexp = null;
		this.negate = false;
		this.nonegate = options.nonegate === true;
		this.comment = false;
		this.empty = false;
		this.partial = options.partial === true;
		this.nocase = this.options.nocase === true;
		this.windowsNoMagicRoot =
			options.windowsNoMagicRoot !== undefined ? options.windowsNoMagicRoot : !!(this.isWindows && this.nocase);

		this.globSet = [];
		this.globParts = [];
		this.set = [];

		// make the set of regexps etc.
		this.make();
	}

	/**
	 * Detects whether compiled path segments contain glob syntax.
	 *
	 * **Details**
	 *
	 * Brace alternatives count as magic only when `magicalBraces` is enabled.
	 *
	 * **Example** (Distinguish a literal path from a glob)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * console.log(new Minimatch("file.ts").hasMagic()) // false
	 * console.log(new Minimatch("*.ts").hasMagic()) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	hasMagic(): boolean {
		if (this.options.magicalBraces === true && this.set.length > 1) {
			return true;
		}
		for (const pattern of this.set) {
			for (const part of pattern) {
				if (!P.isString(part)) return true;
			}
		}
		return false;
	}

	/**
	 * Accepts engine diagnostic calls without producing output.
	 *
	 * **Details**
	 *
	 * The upstream debug option and console wiring are dropped; call sites remain for fidelity.
	 *
	 * **Example** (Observe the no-op diagnostic return)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("*.ts")
	 * console.log(matcher.debug("inspection")) // undefined
	 * ```
	 *
	 * @category diagnostics
	 * @since 0.0.0
	 */
	debug(..._args: Array<unknown>) {
		// no-op: the upstream debug option and its console.error wiring are
		// dropped; call sites are kept for diffability against upstream.
	}

	/**
	 * Builds the compiled alternatives and path segments used by this matcher.
	 *
	 * **Example** (Compile a replacement pattern)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("*.ts")
	 * matcher.pattern = "*.js"
	 * matcher.make()
	 * console.log(matcher.match("file.js")) // true
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 */
	make() {
		const pattern = this.pattern;
		const options = this.options;

		// empty patterns and comments match nothing.
		if (options.nocomment !== true && pattern.charAt(0) === "#") {
			this.comment = true;
			return;
		}

		if (pattern === "") {
			this.empty = true;
			return;
		}

		// step 1: figure out negation, etc.
		this.parseNegate();

		// step 2: expand braces
		this.globSet = A.dedupe(this.braceExpand());

		this.debug(this.pattern, this.globSet);

		// step 3: now we have a set, so turn each one into a series of
		// path-portion matching patterns.
		// These will be regexps, except in the case of "**", which is
		// set to the GLOBSTAR object for globstar behavior,
		// and will not contain any / characters
		//
		// First, we preprocess to make the glob pattern sets a bit simpler
		// and deduped.  There are some perf-killing patterns that can cause
		// problems with a glob walk, but we can simplify them down a bit.
		const rawGlobParts = this.globSet.map((s) => this.slashSplit(s));
		this.globParts = this.preprocess(rawGlobParts);
		this.debug(this.pattern, this.globParts);

		// glob --> regexps
		const set = this.globParts.map((s) => {
			if (this.isWindows && this.windowsNoMagicRoot) {
				// check if it's a drive or unc path.
				const isUNC =
					s[0] === "" &&
					s[1] === "" &&
					(s[2] === "?" || (s[2] !== undefined && !globMagic.test(s[2]))) &&
					s[3] !== undefined &&
					!globMagic.test(s[3]);
				const root = s[0];
				const isDrive = root !== undefined && /^[a-z]:/i.test(root);
				if (isUNC) {
					return [...s.slice(0, 4), ...s.slice(4).map((ss) => this.parse(ss))];
				}
				if (isDrive) {
					return [root, ...s.slice(1).map((ss) => this.parse(ss))];
				}
			}
			return s.map((ss) => this.parse(ss));
		});

		this.debug(this.pattern, set);

		// filter out everything that didn't compile properly.
		this.set = set.filter((s): s is Array<ParseReturnFiltered> => s.every((p) => p !== false));

		// do not treat the ? in UNC paths as magic
		if (this.isWindows) {
			for (let i = 0; i < this.set.length; i++) {
				const p = this.set[i];
				if (
					p !== undefined &&
					p[0] === "" &&
					p[1] === "" &&
					this.globParts[i]?.[2] === "?" &&
					P.isString(p[3]) &&
					/^[a-z]:$/i.test(p[3])
				) {
					p[2] = "?";
				}
			}
		}

		this.debug(this.pattern, this.set);
	}

	// various transforms to equivalent pattern sets that are
	// faster to process in a filesystem walk.  The goal is to
	// eliminate what we can, and push all ** patterns as far
	// to the right as possible, even if it increases the number
	// of patterns that we have to process.
	/**
	 * Simplifies split pattern alternatives using the configured optimization level.
	 *
	 * **Details**
	 *
	 * The transformations prepare patterns for faster filesystem walking. Some passes mutate
	 * the supplied segment arrays, and `noglobstar` replaces globstars with single stars.
	 *
	 * **Example** (Collapse adjacent globstars during preprocessing)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("*", { optimizationLevel: 0 })
	 * const parts = matcher.preprocess([["src", "**", "**", "file.ts"]])
	 * console.log(JSON.stringify(parts[0])) // ["src","**","file.ts"]
	 * ```
	 *
	 * @category normalization
	 * @since 0.0.0
	 */
	preprocess(globPartsInput: Array<Array<string>>) {
		let globParts = globPartsInput;
		// if we're not in globstar mode, then turn ** into *
		if (this.options.noglobstar === true) {
			for (const partset of globParts) {
				for (let j = 0; j < partset.length; j++) {
					if (partset[j] === "**") {
						partset[j] = "*";
					}
				}
			}
		}

		const { optimizationLevel = 1 } = this.options;

		if (optimizationLevel >= 2) {
			// aggressive optimization for the purpose of fs walking
			globParts = this.firstPhasePreProcess(globParts);
			globParts = this.secondPhasePreProcess(globParts);
		} else if (optimizationLevel >= 1) {
			// just basic optimizations to remove some .. parts
			globParts = this.levelOneOptimize(globParts);
		} else {
			// just collapse multiple ** portions into one
			globParts = this.adjascentGlobstarOptimize(globParts);
		}

		return globParts;
	}

	// just get rid of adjascent ** portions
	/**
	 * Collapses consecutive globstar segments in each pattern alternative.
	 *
	 * **Details**
	 *
	 * Segment arrays are edited in place. The method name preserves the upstream spelling.
	 *
	 * **Example** (Collapse repeated globstars)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("*")
	 * const parts = matcher.adjascentGlobstarOptimize([["**", "**", "file.ts"]])
	 * console.log(JSON.stringify(parts[0])) // ["**","file.ts"]
	 * ```
	 *
	 * @category normalization
	 * @since 0.0.0
	 */
	adjascentGlobstarOptimize(globParts: Array<Array<string>>) {
		return globParts.map((parts) => {
			let gs = parts.indexOf("**");
			while (gs !== -1) {
				let i = gs;
				while (parts[i + 1] === "**") {
					i++;
				}
				if (i !== gs) {
					parts.splice(gs, i - gs);
				}
				gs = parts.indexOf("**", gs + 1);
			}
			return parts;
		});
	}

	// get rid of adjascent ** and resolve .. portions
	/**
	 * Collapses adjacent globstars and resolves reducible parent-directory segments.
	 *
	 * **Example** (Resolve a parent segment)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("*")
	 * const parts = matcher.levelOneOptimize([["src", "internal", "..", "file.ts"]])
	 * console.log(parts[0]?.join("/")) // src/file.ts
	 * ```
	 *
	 * @category normalization
	 * @since 0.0.0
	 */
	levelOneOptimize(globParts: Array<Array<string>>) {
		return globParts.map((partsInput) => {
			const parts = partsInput.reduce((set: Array<string>, part) => {
				const prev = set[set.length - 1];
				if (part === "**" && prev === "**") {
					return set;
				}
				if (part === "..") {
					if (prev !== undefined && prev !== "" && prev !== ".." && prev !== "." && prev !== "**") {
						set.pop();
						return set;
					}
				}
				set.push(part);
				return set;
			}, []);
			return parts.length === 0 ? [""] : parts;
		});
	}

	/**
	 * Normalizes candidate path segments for level-two matching.
	 *
	 * **Details**
	 *
	 * Array inputs are mutated. UNC roots and Windows drive roots are preserved;
	 * `preserveMultipleSlashes` disables removal of interior empty and dot segments.
	 *
	 * **Example** (Normalize a candidate path)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("*")
	 * console.log(matcher.levelTwoFileOptimize("src/./internal/../file.ts").join("/")) // src/file.ts
	 * ```
	 *
	 * @category normalization
	 * @since 0.0.0
	 */
	levelTwoFileOptimize(partsInput: string | Array<string>) {
		const parts = A.isArray(partsInput) ? partsInput : this.slashSplit(partsInput);
		let didSomething = false;

		do {
			didSomething = false;
			// <pre>/<e>/<rest> -> <pre>/<rest>
			if (!this.preserveMultipleSlashes) {
				for (let i = 1; i < parts.length - 1; i++) {
					const p = parts[i];
					// don't squeeze out UNC patterns
					if (i === 1 && p === "" && parts[0] === "") continue;
					if (p === "." || p === "") {
						didSomething = true;
						parts.splice(i, 1);
						i--;
					}
				}
				if (parts[0] === "." && parts.length === 2 && (parts[1] === "." || parts[1] === "")) {
					didSomething = true;
					parts.pop();
				}
			}

			// <pre>/<p>/../<rest> -> <pre>/<rest>
			let dd = parts.indexOf("..", 1);
			while (dd !== -1) {
				const p = parts[dd - 1];
				if (p !== undefined && p !== "" && p !== "." && p !== ".." && p !== "**" && !(this.isWindows && /^[a-z]:$/i.test(p))) {
					didSomething = true;
					parts.splice(dd - 1, 2);
					dd -= 2;
				}
				dd = parts.indexOf("..", dd + 1);
			}
		} while (didSomething);
		return parts.length === 0 ? [""] : parts;
	}

	// First phase: single-pattern processing
	// <pre> is 1 or more portions
	// <rest> is 1 or more portions
	// <p> is any portion other than ., .., '', or **
	// <e> is . or ''
	//
	// **/.. is *brutal* for filesystem walking performance, because
	// it effectively resets the recursive walk each time it occurs,
	// and ** cannot be reduced out by a .. pattern part like a regexp
	// or most strings (other than .., ., and '') can be.
	//
	// <pre>/**/../<p>/<p>/<rest> -> {<pre>/../<p>/<p>/<rest>,<pre>/**/<p>/<p>/<rest>}
	// <pre>/<e>/<rest> -> <pre>/<rest>
	// <pre>/<p>/../<rest> -> <pre>/<rest>
	// **/**/<rest> -> **/<rest>
	//
	// **/*/<rest> -> */**/<rest> <== not valid because ** doesn't follow
	// this WOULD be allowed if ** did follow symlinks, or * didn't
	/**
	 * Simplifies individual pattern alternatives for aggressive filesystem-walk optimization.
	 *
	 * **Details**
	 *
	 * This pass mutates its input and can append alternatives while reducing globstar-parent combinations.
	 *
	 * **Example** (Simplify an individual pattern)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("*")
	 * const parts = matcher.firstPhasePreProcess([["src", ".", "file.ts"]])
	 * console.log(parts[0]?.join("/")) // src/file.ts
	 * ```
	 *
	 * @category normalization
	 * @since 0.0.0
	 */
	firstPhasePreProcess(globParts: Array<Array<string>>) {
		let didSomething = false;
		do {
			didSomething = false;
			// <pre>/**/../<p>/<p>/<rest> -> {<pre>/../<p>/<p>/<rest>,<pre>/**/<p>/<p>/<rest>}
			for (const parts of globParts) {
				let gs = parts.indexOf("**");
				while (gs !== -1) {
					let gss = gs;
					while (parts[gss + 1] === "**") {
						// <pre>/**/**/<rest> -> <pre>/**/<rest>
						gss++;
					}
					// eg, if gs is 2 and gss is 4, that means we have 3 **
					// parts, and can remove 2 of them.
					if (gss > gs) {
						parts.splice(gs + 1, gss - gs);
					}

					const next = parts[gs + 1];
					const p = parts[gs + 2];
					const p2 = parts[gs + 3];
					if (next !== "..") {
						gs = parts.indexOf("**", gs + 1);
						continue;
					}
					if ((p === undefined || p === "") || p === "." || p === ".." || (p2 === undefined || p2 === "") || p2 === "." || p2 === "..") {
						gs = parts.indexOf("**", gs + 1);
						continue;
					}
					didSomething = true;
					// edit parts in place, and push the new one
					parts.splice(gs, 1);
					const other = parts.slice(0);
					other[gs] = "**";
					globParts.push(other);
					gs--;
					gs = parts.indexOf("**", gs + 1);
				}

				// <pre>/<e>/<rest> -> <pre>/<rest>
				if (!this.preserveMultipleSlashes) {
					for (let i = 1; i < parts.length - 1; i++) {
						const p = parts[i];
						// don't squeeze out UNC patterns
						if (i === 1 && p === "" && parts[0] === "") continue;
						if (p === "." || p === "") {
							didSomething = true;
							parts.splice(i, 1);
							i--;
						}
					}
					if (parts[0] === "." && parts.length === 2 && (parts[1] === "." || parts[1] === "")) {
						didSomething = true;
						parts.pop();
					}
				}

				// <pre>/<p>/../<rest> -> <pre>/<rest>
				let dd = parts.indexOf("..", 1);
				while (dd !== -1) {
					const p = parts[dd - 1];
					if (p !== undefined && p !== "" && p !== "." && p !== ".." && p !== "**") {
						didSomething = true;
						const needDot = dd === 1 && parts[dd + 1] === "**";
						const splin = needDot ? ["."] : [];
						parts.splice(dd - 1, 2, ...splin);
						if (parts.length === 0) parts.push("");
						dd -= 2;
					}
					dd = parts.indexOf("..", dd + 1);
				}
			}
		} while (didSomething);

		return globParts;
	}

	// second phase: multi-pattern dedupes
	// {<pre>/*/<rest>,<pre>/<p>/<rest>} -> <pre>/*/<rest>
	// {<pre>/<rest>,<pre>/<rest>} -> <pre>/<rest>
	// {<pre>/**/<rest>,<pre>/<rest>} -> <pre>/**/<rest>
	//
	// {<pre>/**/<rest>,<pre>/**/<p>/<rest>} -> <pre>/**/<rest>
	// ^-- not valid because ** doens't follow symlinks
	/**
	 * Merges redundant pattern alternatives after individual-pattern simplification.
	 *
	 * **Details**
	 *
	 * The input alternatives are edited before the retained alternatives are returned.
	 *
	 * **Example** (Deduplicate pattern alternatives)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("*")
	 * const parts = matcher.secondPhasePreProcess([["src", "file.ts"], ["src", "file.ts"]])
	 * console.log(parts.length) // 1
	 * ```
	 *
	 * @category normalization
	 * @since 0.0.0
	 */
	secondPhasePreProcess(globParts: Array<Array<string>>): Array<Array<string>> {
		for (let i = 0; i < globParts.length - 1; i++) {
			for (let j = i + 1; j < globParts.length; j++) {
				const a = globParts[i];
				const b = globParts[j];
				if (a === undefined || b === undefined) continue;
				const matched = this.partsMatch(a, b, !this.preserveMultipleSlashes);
				if (matched !== false) {
					globParts[i] = [];
					globParts[j] = matched;
					break;
				}
			}
		}
		return globParts.filter((gs) => gs.length);
	}

	/**
	 * Finds a shared pattern that covers two compatible segment arrays.
	 *
	 * **Details**
	 *
	 * Incompatible alternatives return `false`. Empty globstar matches are considered only
	 * when `emptyGSMatch` is enabled, and the final alternatives must have equal lengths.
	 *
	 * **Example** (Cover a literal with a wildcard pattern)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("*")
	 * const parts = matcher.partsMatch(["src", "*"], ["src", "file.ts"])
	 * console.log(parts === false ? "incompatible" : parts.join("/")) // src/*
	 * ```
	 *
	 * @category normalization
	 * @since 0.0.0
	 */
	partsMatch(a: Array<string>, b: Array<string>, emptyGSMatch = false): false | Array<string> {
		let ai = 0;
		let bi = 0;
		const result: Array<string> = [];
		let which = "";
		while (ai < a.length && bi < b.length) {
			const av = a[ai];
			const bv = b[bi];
			if (av === undefined || bv === undefined) return false;
			if (av === bv) {
				result.push(which === "b" ? bv : av);
				ai++;
				bi++;
			} else if (emptyGSMatch && av === "**" && bv === a[ai + 1]) {
				result.push(av);
				ai++;
			} else if (emptyGSMatch && bv === "**" && av === b[bi + 1]) {
				result.push(bv);
				bi++;
			} else if (av === "*" && bv !== "" && (this.options.dot === true || !bv.startsWith(".")) && bv !== "**") {
				if (which === "b") return false;
				which = "a";
				result.push(av);
				ai++;
				bi++;
			} else if (bv === "*" && av !== "" && (this.options.dot === true || !av.startsWith(".")) && av !== "**") {
				if (which === "a") return false;
				which = "b";
				result.push(bv);
				ai++;
				bi++;
			} else {
				return false;
			}
		}
		// if we fall out of the loop, it means they two are identical
		// as long as their lengths match
		return a.length === b.length && result;
	}

	/**
	 * Consumes leading negation markers and records their parity.
	 *
	 * **Details**
	 *
	 * With `nonegate`, the pattern is left untouched. Otherwise the consumed markers
	 * are removed from `pattern`; each marker toggles the negation flag.
	 *
	 * **Example** (Parse a replacement negated pattern)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("file.ts")
	 * matcher.pattern = "!file.js"
	 * matcher.parseNegate()
	 * console.log(matcher.negate) // true
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 */
	parseNegate() {
		if (this.nonegate) return;

		const pattern = this.pattern;
		let negate = false;
		let negateOffset = 0;

		for (let i = 0; i < pattern.length && pattern.charAt(i) === "!"; i++) {
			negate = !negate;
			negateOffset++;
		}

		if (negateOffset !== 0) this.pattern = pattern.slice(negateOffset);
		this.negate = negate;
	}

	// set partial to true to test if, for example,
	// "/a/b" matches the start of "/*/b/*/d"
	// Partial means, if you run out of file before you run
	// out of pattern, then that's fine, as long as all
	// the parts match.
	/**
	 * Matches candidate path segments against one compiled pattern alternative.
	 *
	 * **Details**
	 *
	 * Partial matching accepts an exhausted candidate when all its segments matched,
	 * even if the pattern still has segments remaining.
	 *
	 * **Example** (Match literal path segments)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("src/file.ts")
	 * console.log(matcher.matchOne(["src", "file.ts"], ["src", "file.ts"])) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	matchOne(fileInput: Array<string>, pattern: Array<ParseReturn>, partial = false) {
		let file = fileInput;
		let fileStartIndex = 0;
		let patternStartIndex = 0;

		// UNC paths like //?/X:/... can match X:/... and vice versa
		// Drive letters in absolute drive or unc paths are always compared
		// case-insensitively.
		if (this.isWindows) {
			const f0 = file[0];
			const fileDrive = P.isString(f0) && /^[a-z]:$/i.test(f0);
			const fileUNC =
				!fileDrive &&
				file[0] === "" &&
				file[1] === "" &&
				file[2] === "?" &&
				P.isString(file[3]) &&
				/^[a-z]:$/i.test(file[3]);

			const p0 = pattern[0];
			const patternDrive = P.isString(p0) && /^[a-z]:$/i.test(p0);
			const patternUNC =
				!patternDrive &&
				pattern[0] === "" &&
				pattern[1] === "" &&
				pattern[2] === "?" &&
				P.isString(pattern[3]) &&
				/^[a-z]:$/i.test(pattern[3]);

			const fdi = fileUNC ? 3 : fileDrive ? 0 : undefined;
			const pdi = patternUNC ? 3 : patternDrive ? 0 : undefined;
			if (P.isNumber(fdi) && P.isNumber(pdi)) {
				const fd = file[fdi];
				const pd = pattern[pdi];
				// start matching at the drive letter index of each
				if (P.isString(fd) && P.isString(pd) && fd.toLowerCase() === pd.toLowerCase()) {
					pattern[pdi] = fd;
					patternStartIndex = pdi;
					fileStartIndex = fdi;
				}
			}
		}

		// resolve and reduce . and .. portions in the file as well.
		// don't need to do the second phase, because it's only one string[]
		const { optimizationLevel = 1 } = this.options;
		if (optimizationLevel >= 2) {
			file = this.levelTwoFileOptimize(file);
		}

		if (pattern.includes(GLOBSTAR)) {
			return this.#matchGlobstar(file, pattern, partial, fileStartIndex, patternStartIndex);
		}

		return this.#matchOne(file, pattern, partial, fileStartIndex, patternStartIndex);
	}

	/**
	 * Matches globstar-delimited head, body, and tail sections against candidate segments.
	 *
	 * **Example** (Match a globstar between literal segments)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch(["src", "**", "file.ts"].join("/"))
	 * console.log(matcher.match("src/internal/file.ts")) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	#matchGlobstar(
		file: Array<string>,
		pattern: Array<ParseReturn>,
		partial: boolean,
		fileIndexInput: number,
		patternIndexInput: number,
	) {
		let fileIndex = fileIndexInput;
		let patternIndex = patternIndexInput;
		// split the pattern into head, tail, and middle of ** delimited parts
		const firstgs = pattern.indexOf(GLOBSTAR, patternIndex);
		const lastgs = pattern.lastIndexOf(GLOBSTAR);

		// split the pattern up into globstar-delimited sections
		// the tail has to be at the end, and the others just have
		// to be found in order from the head.
		const [head, body, tail] = partial
			? [pattern.slice(patternIndex, firstgs), pattern.slice(firstgs + 1), []]
			: [pattern.slice(patternIndex, firstgs), pattern.slice(firstgs + 1, lastgs), pattern.slice(lastgs + 1)];

		// check the head, from the current file/pattern index.
		if (head.length !== 0) {
			const fileHead = file.slice(fileIndex, fileIndex + head.length);
			if (!this.#matchOne(fileHead, head, partial, 0, 0)) {
				return false;
			}
			fileIndex += head.length;
			patternIndex += head.length;
		}
		// now we know the head matches!

		// if the last portion is not empty, it MUST match the end
		// check the tail
		let fileTailMatch = 0;
		if (tail.length !== 0) {
			// if head + tail > file, then we cannot possibly match
			if (tail.length + fileIndex > file.length) return false;

			// try to match the tail
			let tailStart = file.length - tail.length;
			if (this.#matchOne(file, tail, partial, tailStart, 0)) {
				fileTailMatch = tail.length;
			} else {
				// affordance for stuff like a/**/* matching a/b/
				// if the last file portion is '', and there's more to the pattern
				// then try without the '' bit.
				if (file[file.length - 1] !== "" || fileIndex + tail.length === file.length) {
					return false;
				}
				tailStart--;
				if (!this.#matchOne(file, tail, partial, tailStart, 0)) {
					return false;
				}
				fileTailMatch = tail.length + 1;
			}
		}

		// now we know the tail matches!

		// the middle is zero or more portions wrapped in **, possibly
		// containing more ** sections.
		// so a/**/b/**/c/**/d has become **/b/**/c/**
		// if it's empty, it means a/**/b, just verify we have no bad dots
		// if there's no tail, so it ends on /**, then we must have *something*
		// after the head, or it's not a matc
		if (body.length === 0) {
			let sawSome = (fileTailMatch !== 0 && !Number.isNaN(fileTailMatch));
			for (let i = fileIndex; i < file.length - fileTailMatch; i++) {
				const f = String(file[i]);
				sawSome = true;
				if (f === "." || f === ".." || (this.options.dot !== true && f.startsWith("."))) {
					return false;
				}
			}
			// in partial mode, we just need to get past all file parts
			return partial || sawSome;
		}

		// now we know that there's one or more body sections, which can
		// be matched anywhere from the 0 index (because the head was pruned)
		// through to the length-fileTailMatch index.
		// split the body up into sections, and note the minimum index it can
		// be found at (start with the length of all previous segments)
		// [section, before, after]
		let currentBody: [Array<ParseReturn>, number] = [[], 0];
		const bodySegments: Array<[Array<ParseReturn>, number]> = [currentBody];
		let nonGsParts = 0;
		const nonGsPartsSums: Array<number> = [0];
		for (const b of body) {
			if (b === GLOBSTAR) {
				nonGsPartsSums.push(nonGsParts);
				currentBody = [[], 0];
				bodySegments.push(currentBody);
			} else {
				currentBody[0].push(b);
				nonGsParts++;
			}
		}
		const fileLength = file.length - fileTailMatch;
		for (const [b, before] of A.zip(bodySegments, A.reverse(nonGsPartsSums))) {
			b[1] = fileLength - (before + b[0].length);
		}

		return this.#matchGlobStarBodySections(file, bodySegments, fileIndex, 0, partial, 0, (fileTailMatch !== 0 && !Number.isNaN(fileTailMatch))) === true;
	}

	// return false for "nope, not matching"
	// return null for "not matching, cannot keep trying"
	/**
	 * Searches ordered globstar body sections within their remaining candidate bounds.
	 *
	 * **Example** (Match multiple globstar body sections)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch(["src", "**", "lib", "**", "file.ts"].join("/"))
	 * console.log(matcher.match("src/internal/lib/nested/file.ts")) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	#matchGlobStarBodySections(
		file: Array<string>,
		// pattern section, last possible position for it
		bodySegments: Array<[Array<ParseReturn>, number]>,
		fileIndexInput: number,
		bodyIndex: number,
		partial: boolean,
		globStarDepth: number,
		sawTailInput: boolean,
	): boolean | null {
		let fileIndex = fileIndexInput;
		let sawTail = sawTailInput;
		// take the first body segment, and walk from fileIndex to its "after"
		// value at the end
		// If it doesn't match at that position, we increment, until we hit
		// that final possible position, and give up.
		// If it does match, then advance and try to rest.
		// If any of them fail we keep walking forward.
		// this is still a bit recursively painful, but it's more constrained
		// than previous implementations, because we never test something that
		// can't possibly be a valid matching condition.
		const bs = bodySegments[bodyIndex];
		if (bs === undefined) {
			// just make sure that there's no bad dots
			for (let i = fileIndex; i < file.length; i++) {
				sawTail = true;
				const f = file[i];
				if (f === undefined) return false;
				if (f === "." || f === ".." || (this.options.dot !== true && f.startsWith("."))) {
					return false;
				}
			}
			return sawTail;
		}

		// have a non-globstar body section to test
		const [body, after] = bs;
		while (fileIndex <= after) {
			const m = this.#matchOne(file.slice(0, fileIndex + body.length), body, partial, fileIndex, 0);
			// if limit exceeded, no match. intentional false negative,
			// acceptable break in correctness for security.
			if (m && globStarDepth < this.maxGlobstarRecursion) {
				// match! see if the rest match. if so, we're done!
				const sub = this.#matchGlobStarBodySections(
					file,
					bodySegments,
					fileIndex + body.length,
					bodyIndex + 1,
					partial,
					globStarDepth + 1,
					sawTail,
				);
				if (sub !== false) {
					return sub;
				}
			}
			const f = file[fileIndex];
			if (f === "." || f === ".." || (f !== undefined && this.options.dot !== true && f.startsWith("."))) {
				return false;
			}

			fileIndex++;
		}
		// walked off. no point continuing
		return partial || null;
	}

	/**
	 * Compares non-globstar segments from the supplied file and pattern offsets.
	 *
	 * **Example** (Match a literal segment sequence)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch(["src", "file.ts"].join("/"))
	 * console.log(matcher.match("src/file.ts")) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	#matchOne(
		file: Array<string>,
		pattern: Array<ParseReturn>,
		partial: boolean,
		fileIndex: number,
		patternIndex: number,
	) {
		let fi: number;
		let pi: number;
		let pl: number;
		let fl: number;
		for (fi = fileIndex, pi = patternIndex, fl = file.length, pl = pattern.length; fi < fl && pi < pl; fi++, pi++) {
			this.debug("matchOne loop");
			const p = pattern[pi];
			const f = file[fi];
			if (p === undefined || f === undefined) return false;

			this.debug(pattern, p, f);

			// should be impossible.
			// some invalid regexp stuff in the set.
			if (p === false || p === GLOBSTAR) {
				return false;
			}

			// something other than **
			// non-magic patterns just have to match exactly
			// patterns with magic have been turned into regexps.
			let hit: boolean;
			if (P.isString(p)) {
				hit = f === p;
				this.debug("string match", p, f, hit);
			} else {
				hit = p.test(f);
				this.debug("pattern match", p, f, hit);
			}

			if (!hit) return false;
		}

		// Note: ending in / means that we'll get a final ""
		// at the end of the pattern.  This can only match a
		// corresponding "" at the end of the file.
		// If the file ends in /, then it can only match a
		// a pattern that ends in /, unless the pattern just
		// doesn't have any more for it. But, a/b/ should *not*
		// match "a/b/*", even though "" matches against the
		// [^/]*? pattern, except in partial mode, where it might
		// simply not be reached yet.
		// However, a/b/ should still satisfy a/*

		// now either we fell off the end of the pattern, or we're done.
		if (fi === fl && pi === pl) {
			// ran out of pattern and filename at the same time.
			// an exact hit!
			return true;
		}
		if (fi === fl) {
			// ran out of file, but still had pattern left.
			// this is ok if we're doing the match as part of
			// a glob fs traversal.
			return partial;
		}
		// The loop can only finish by exhausting file or pattern. The file
		// cases returned above, so only a trailing empty file segment can match.
		return fi === fl - 1 && file[fi] === "";
	}

	/**
	 * Expands brace alternatives using this matcher’s current pattern and options.
	 *
	 * **Example** (Expand the matcher pattern)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("file.{ts,js}")
	 * console.log(matcher.braceExpand().join(",")) // file.ts,file.js
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 */
	braceExpand() {
		return braceExpand(this.pattern, this.options);
	}

	/**
	 * Compiles one path segment into a literal, regular expression, or globstar marker.
	 *
	 * **Details**
	 *
	 * Common star and question-mark patterns receive optimized test functions.
	 * An invalid compiled segment can return `false`.
	 *
	 * **Example** (Identify a globstar segment)
	 *
	 * ```ts
	 * import { GLOBSTAR, Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("*")
	 * console.log(matcher.parse("**") === GLOBSTAR) // true
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 */
	parse(pattern: string): ParseReturn {
		assertValidPattern(pattern);

		const options = this.options;

		// shortcuts
		if (pattern === "**") return GLOBSTAR;
		if (pattern === "") return "";

		// far and away, the most common glob pattern parts are
		// *, *.*, and *.<ext>  Add a fast check method for those.
		let fastTest: null | ((f: string) => boolean) = null;
		const mStar = pattern.match(starRE);
		const mStarDotExt = mStar !== null ? null : pattern.match(starDotExtRE);
		const mQmarks = mStar !== null || mStarDotExt !== null ? null : pattern.match(qmarksRE);
		const mStarDotStar = mStar !== null || mStarDotExt !== null || mQmarks !== null ? null : pattern.match(starDotStarRE);
		const mDotStar = mStar !== null || mStarDotExt !== null || mQmarks !== null || mStarDotStar !== null ? null : pattern.match(dotStarRE);
		if (mStar !== null) {
			fastTest = options.dot === true ? starTestDot : starTest;
		} else if (mStarDotExt !== null && mStarDotExt[1] !== undefined) {
			fastTest = (
				options.nocase === true
					? options.dot === true
						? starDotExtTestNocaseDot
						: starDotExtTestNocase
					: options.dot === true
						? starDotExtTestDot
						: starDotExtTest
			)(mStarDotExt[1]);
		} else if (mQmarks !== null) {
			fastTest = (
				options.nocase === true
					? options.dot === true
						? qmarksTestNocaseDot
						: qmarksTestNocase
					: options.dot === true
						? qmarksTestDot
						: qmarksTest
			)(mQmarks);
		} else if (mStarDotStar !== null) {
			fastTest = options.dot === true ? starDotStarTestDot : starDotStarTest;
		} else if (mDotStar !== null) {
			fastTest = dotStarTest;
		}

		const re = AST.fromGlob(pattern, this.options).toMMPattern();
		if (fastTest !== null && P.isObjectKeyword(re) && !P.isFunction(re)) {
			// Avoids overriding in frozen environments
			Reflect.defineProperty(re, "test", { value: fastTest });
		}
		return re;
	}

	/**
	 * Builds and caches a regular expression for the compiled alternatives.
	 *
	 * **Details**
	 *
	 * Prefer `match` for path matching; this method is convenient when a regular
	 * expression is needed. It returns `false` when there are no compiled alternatives
	 * or regular-expression construction fails.
	 *
	 * **Example** (Test a compiled regular expression)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("*.ts")
	 * const regexp = matcher.makeRe()
	 * console.log(regexp === false ? false : regexp.test("file.ts")) // true
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 */
	makeRe() {
		if (this.regexp !== null) return this.regexp;

		// at this point, this.set is a 2d array of partial
		// pattern strings, or "**".
		//
		// It's better to use .match().  This function shouldn't
		// be used, really, but it's pretty convenient sometimes,
		// when you just want to work with a regex.
		const set = this.set;

		if (set.length === 0) {
			this.regexp = false;
			return this.regexp;
		}
		const options = this.options;

		const twoStar = options.noglobstar === true ? star : options.dot === true ? twoStarDot : twoStarNoDot;
		const flags = MutableHashSet.fromIterable(options.nocase === true ? ["i"] : []);

		// regexpify non-globstar patterns
		// if ** is only item, then we just do one twoStar
		// if ** is first, and there are more, prepend (\/|twoStar\/)? to next
		// if ** is last, append (\/twoStar|) to previous
		// if ** is in the middle, append (\/|\/twoStar\/) to previous
		// then filter out GLOBSTAR symbols
		let re = set
			.map((pattern) => {
				const pp: Array<string | typeof GLOBSTAR | undefined> = pattern.map((p) => {
					if (p instanceof RegExp) {
						for (const f of p.flags.split("")) MutableHashSet.add(flags, f);
					}
					return P.isString(p) ? regExpEscape(p) : p === GLOBSTAR ? GLOBSTAR : p._src;
				});
				pp.forEach((p, i) => {
					const next = pp[i + 1];
					const prev = pp[i - 1];
					if (p !== GLOBSTAR || prev === GLOBSTAR) {
						return;
					}
					if (prev === undefined) {
						if (next !== undefined && next !== GLOBSTAR) {
							pp[i + 1] = `(?:\\/|${twoStar}\\/)?${next}`;
						} else {
							pp[i] = twoStar;
						}
					} else if (next === undefined) {
						pp[i - 1] = `${prev}(?:\\/|\\/${twoStar})?`;
					} else if (next !== GLOBSTAR) {
						pp[i - 1] = `${prev}(?:\\/|\\/${twoStar}\\/)${next}`;
						pp[i + 1] = GLOBSTAR;
					}
				});
				const filtered = pp.filter((p) => p !== GLOBSTAR);

				// For partial matches, we need to make the pattern match
				// any prefix of the full path. We do this by generating
				// alternative patterns that match progressively longer prefixes.
				if (this.partial && filtered.length >= 1) {
					const prefixes: Array<string> = [];
					for (let i = 1; i <= filtered.length; i++) {
						prefixes.push(filtered.slice(0, i).join("/"));
					}
					return `(?:${prefixes.join("|")})`;
				}

				return filtered.join("/");
			})
			.join("|");

		// need to wrap in parens if we had more than one thing with |,
		// otherwise only the first will be anchored to ^ and the last to $
		const [open, close] = set.length > 1 ? ["(?:", ")"] : ["", ""];
		// must match entire pattern
		// ending in a * or ** will make it less strict.
		re = `^${open}${re}${close}$`;

		// In partial mode, '/' should always match as it's a valid prefix for any pattern
		if (this.partial) {
			re = `^(?:\\/|${open}${re.slice(1, -1)}${close})$`;
		}

		// can match anything, as long as it's not this.
		if (this.negate) re = `^(?!${re}).+$`;

		try {
			this.regexp = new RegExp(re, [...flags].join(""));
		} catch {
			// should be impossible
			this.regexp = false;
		}
		return this.regexp;
	}

	/**
	 * Splits a path into segments while respecting slash-preservation and Windows roots.
	 *
	 * **Details**
	 *
	 * Windows UNC paths keep their leading double slash. Other repeated slashes are
	 * coalesced unless `preserveMultipleSlashes` is enabled.
	 *
	 * **Example** (Coalesce repeated path separators)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("*")
	 * console.log(matcher.slashSplit("src//file.ts").join("/")) // src/file.ts
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 */
	slashSplit(p: string) {
		// if p starts with // on windows, we preserve that
		// so that UNC paths aren't broken.  Otherwise, any number of
		// / characters are coalesced into one, unless
		// preserveMultipleSlashes is set to true.
		if (this.preserveMultipleSlashes) {
			return p.split("/");
		}
		if (this.isWindows && /^\/\/[^/]+/.test(p)) {
			// add an extra '' for the one we lose
			return ["", ...p.split(/\/+/)];
		}
		return p.split(/\/+/);
	}

	/**
	 * Tests a candidate path against the compiled alternatives and negation options.
	 *
	 * **Details**
	 *
	 * Comment patterns reject candidates; empty patterns match only an empty candidate.
	 * Windows candidates normalize backslashes. With `matchBase`, a single-segment
	 * pattern is tested against the candidate basename; partial matching permits prefixes.
	 *
	 * **Example** (Match a TypeScript file)
	 *
	 * ```ts
	 * import { Minimatch } from "@beep/scratchpad/effected/glob/internal/minimatch"
	 *
	 * const matcher = new Minimatch("*.ts")
	 * console.log(matcher.match("file.ts")) // true
	 * console.log(matcher.match("file.js")) // false
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	match(fInput: string, partial = this.partial) {
		this.debug("match", fInput, this.pattern);
		// short-circuit in the case of busted things.
		// comments, etc.
		if (this.comment) {
			return false;
		}
		if (this.empty) {
			return fInput === "";
		}

		if (fInput === "/" && partial) {
			return true;
		}

		const options = this.options;

		// windows: need to use /, not \
		let f = fInput;
		if (this.isWindows) {
			f = f.split("\\").join("/");
		}

		// treat the test path as a set of pathparts.
		const ff = this.slashSplit(f);
		this.debug(this.pattern, "split", ff);

		// just ONE of the pattern sets in this.set needs to match
		// in order for it to be valid.  If negating, then just one
		// match means that we have failed.
		// Either way, return on the first hit.

		const set = this.set;
		this.debug(this.pattern, "set", set);

		// Find the basename of the path by looking for the last non-empty segment
		let filename = "";
		for (const segment of ff) {
			if (segment !== "") filename = segment;
		}

		for (const pattern of set) {
			let file = ff;
			if (options.matchBase === true && pattern.length === 1) {
				file = [filename];
			}
			const hit = this.matchOne(file, pattern, partial);
			if (hit) {
				if (options.flipNegate === true) {
					return true;
				}
				return !this.negate;
			}
		}

		// didn't get any hits.  this is success if it's a negative
		// pattern, failure otherwise.
		if (options.flipNegate === true) {
			return false;
		}
		return this.negate;
	}
}
