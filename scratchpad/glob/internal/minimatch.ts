/**
 * Minimatch engine: compile a glob to a total string matcher.
 *
 * Platform is an explicit option defaulting to `"posix"` — there is no ambient
 * `process.platform`. `match()` is total: exceeding `maxGlobstarRecursion`
 * is an intentional false negative and never throws. Brace expansion keeps
 * the CVE-2022-3517 ReDoS-safe pre-check and throws on budget exhaustion
 * instead of truncating.
 *
 * Ported from minimatch@10.2.5. Copyright Isaac Z. Schlueter and Contributors.
 * License: BlueOak-1.0.0.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
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
//   is a wiring bug and dies as a TypeError defect). The
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

import { assertValidPattern } from "./assertValidPattern.ts";
import { AST } from "./ast.ts";
import { expand } from "./braceExpansion.ts";
import { MAX_GLOBSTAR_RECURSION, assertCap } from "./limits.ts";
import type { EngineOptions, MMRegExp, ParseReturn, ParseReturnFiltered, Platform } from "./types.ts";
import { GLOBSTAR } from "./types.ts";

export { escape } from "./escape.ts";
export type { EngineOptions, MMRegExp, ParseReturn, ParseReturnFiltered, Platform } from "./types.ts";
export { unescape } from "./unescape.ts";
export { GLOBSTAR } from "./types.ts";

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
	if (!ext) return noext;
	const lower = ext.toLowerCase();
	return (f: string) => noext(f) && f.toLowerCase().endsWith(lower);
};
const qmarksTestNocaseDot = ([$0, ext = ""]: RegExpMatchArray) => {
	const noext = qmarksTestNoExtDot([$0]);
	if (!ext) return noext;
	const lower = ext.toLowerCase();
	return (f: string) => noext(f) && f.toLowerCase().endsWith(lower);
};
const qmarksTestDot = ([$0, ext = ""]: RegExpMatchArray) => {
	const noext = qmarksTestNoExtDot([$0]);
	return !ext ? noext : (f: string) => noext(f) && f.endsWith(ext);
};
const qmarksTest = ([$0, ext = ""]: RegExpMatchArray) => {
	const noext = qmarksTestNoExt([$0]);
	return !ext ? noext : (f: string) => noext(f) && f.endsWith(ext);
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
 * Expand braces in `pattern`, or return `[pattern]` when `nobrace` is set or
 * the CVE-2022-3517-safe pre-check finds no brace set.
 *
 * **Gotchas**
 *
 * Budget exhaustion inside the expander throws {@link GuardExceeded}
 * `ExpansionBudgetExceeded` instead of silently truncating. `nobrace: true`
 * is a no-op that returns the original pattern.
 *
 * **Example** (Expand braces or skip them)
 *
 * ```ts
 * import { braceExpand } from "../../glob/internal/minimatch.ts"
 *
 * console.log(braceExpand("a{b,c}", {})) // ["ab", "ac"]
 * console.log(braceExpand("a{b,c}", { nobrace: true })) // ["a{b,c}"]
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const braceExpand = (pattern: string, options: EngineOptions = {}): Array<string> => {
	assertValidPattern(pattern);

	// Thanks to Yeting Li <https://github.com/yetingli> for
	// improving this regexp to avoid a ReDOS vulnerability.
	if (options.nobrace || !/\{(?:(?!\{).)*}/.test(pattern)) {
		// shortcut. no need to expand.
		return [pattern];
	}

	const opts = options.braceExpandMax === undefined ? {} : { max: options.braceExpandMax };
	return expand(pattern, opts);
};

// replace stuff like \* with *
const globMagic = /[?*]|[+@!]\(.*?\)|\[|]/;
const regExpEscape = (s: string): string => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

/**
 * Compiled minimatch engine: the compile/match implementation behind
 * {@link GlobPattern}.
 *
 * **Gotchas**
 *
 * Platform defaults to `"posix"` with no ambient process read. `match()` is
 * total — exceeding `maxGlobstarRecursion` (default 200) returns `false` and
 * never {@link GuardExceeded}. `noglobstar` rewrites `**` to `*`.
 *
 * **Example** (Match a recursive TypeScript glob)
 *
 * ```ts
 * import { Minimatch } from "../../glob/internal/minimatch.ts"
 *
 * const matcher = new Minimatch("**/*.ts", {})
 * console.log(matcher.match("src/index.ts")) // true
 * console.log(matcher.match("src/index.js")) // false
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class Minimatch {
	options: EngineOptions;
	set: Array<Array<ParseReturnFiltered>>;
	pattern: string;

	windowsPathsNoEscape: boolean;
	nonegate: boolean;
	negate: boolean;
	comment: boolean;
	empty: boolean;
	preserveMultipleSlashes: boolean;
	partial: boolean;
	globSet: Array<string>;
	globParts: Array<Array<string>>;
	nocase: boolean;

	isWindows: boolean;
	platform: Platform;
	windowsNoMagicRoot: boolean;
	maxGlobstarRecursion: number;

	regexp: false | null | MMRegExp;
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
		this.windowsPathsNoEscape = !!options.windowsPathsNoEscape;
		if (this.windowsPathsNoEscape) {
			this.pattern = this.pattern.replace(/\\/g, "/");
		}
		this.preserveMultipleSlashes = !!options.preserveMultipleSlashes;
		this.regexp = null;
		this.negate = false;
		this.nonegate = !!options.nonegate;
		this.comment = false;
		this.empty = false;
		this.partial = !!options.partial;
		this.nocase = !!this.options.nocase;
		this.windowsNoMagicRoot =
			options.windowsNoMagicRoot !== undefined ? options.windowsNoMagicRoot : this.isWindows && this.nocase;

		this.globSet = [];
		this.globParts = [];
		this.set = [];

		// make the set of regexps etc.
		this.make();
	}

	hasMagic(): boolean {
		if (this.options.magicalBraces && this.set.length > 1) {
			return true;
		}
		for (const pattern of this.set) {
			for (const part of pattern) {
				if (typeof part !== "string") return true;
			}
		}
		return false;
	}

	debug(..._args: Array<unknown>) {
		// no-op: the upstream debug option and its console.error wiring are
		// dropped; call sites are kept for diffability against upstream.
	}

	make() {
		const pattern = this.pattern;
		const options = this.options;

		// empty patterns and comments match nothing.
		if (!options.nocomment && pattern.charAt(0) === "#") {
			this.comment = true;
			return;
		}

		if (!pattern) {
			this.empty = true;
			return;
		}

		// step 1: figure out negation, etc.
		this.parseNegate();

		// step 2: expand braces
		this.globSet = [...new Set(this.braceExpand())];

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
				const isDrive = s[0] !== undefined && /^[a-z]:/i.test(s[0]);
				if (isUNC) {
					return [...s.slice(0, 4), ...s.slice(4).map((ss) => this.parse(ss))];
				}
				if (isDrive) {
					return [s[0] as ParseReturn, ...s.slice(1).map((ss) => this.parse(ss))];
				}
			}
			return s.map((ss) => this.parse(ss));
		});

		this.debug(this.pattern, set);

		// filter out everything that didn't compile properly.
		this.set = set.filter((s) => s.indexOf(false) === -1) as Array<Array<ParseReturnFiltered>>;

		// do not treat the ? in UNC paths as magic
		if (this.isWindows) {
			for (let i = 0; i < this.set.length; i++) {
				const p = this.set[i];
				if (
					p !== undefined &&
					p[0] === "" &&
					p[1] === "" &&
					this.globParts[i]?.[2] === "?" &&
					typeof p[3] === "string" &&
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
	preprocess(globPartsInput: Array<Array<string>>) {
		let globParts = globPartsInput;
		// if we're not in globstar mode, then turn ** into *
		if (this.options.noglobstar) {
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
	levelOneOptimize(globParts: Array<Array<string>>) {
		return globParts.map((partsInput) => {
			const parts = partsInput.reduce((set: Array<string>, part) => {
				const prev = set[set.length - 1];
				if (part === "**" && prev === "**") {
					return set;
				}
				if (part === "..") {
					if (prev && prev !== ".." && prev !== "." && prev !== "**") {
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

	levelTwoFileOptimize(partsInput: string | Array<string>) {
		const parts = Array.isArray(partsInput) ? partsInput : this.slashSplit(partsInput);
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
				if (p && p !== "." && p !== ".." && p !== "**" && !(this.isWindows && /^[a-z]:$/i.test(p))) {
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
					if (!p || p === "." || p === ".." || !p2 || p2 === "." || p2 === "..") {
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
					if (p && p !== "." && p !== ".." && p !== "**") {
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
	secondPhasePreProcess(globParts: Array<Array<string>>): Array<Array<string>> {
		for (let i = 0; i < globParts.length - 1; i++) {
			for (let j = i + 1; j < globParts.length; j++) {
				const a = globParts[i];
				const b = globParts[j];
				if (a === undefined || b === undefined) continue;
				const matched = this.partsMatch(a, b, !this.preserveMultipleSlashes);
				if (matched) {
					globParts[i] = [];
					globParts[j] = matched;
					break;
				}
			}
		}
		return globParts.filter((gs) => gs.length);
	}

	partsMatch(a: Array<string>, b: Array<string>, emptyGSMatch = false): false | Array<string> {
		let ai = 0;
		let bi = 0;
		const result: Array<string> = [];
		let which = "";
		while (ai < a.length && bi < b.length) {
			const av = a[ai] as string;
			const bv = b[bi] as string;
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
			} else if (av === "*" && bv && (this.options.dot || !bv.startsWith(".")) && bv !== "**") {
				if (which === "b") return false;
				which = "a";
				result.push(av);
				ai++;
				bi++;
			} else if (bv === "*" && av && (this.options.dot || !av.startsWith(".")) && av !== "**") {
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

	parseNegate() {
		if (this.nonegate) return;

		const pattern = this.pattern;
		let negate = false;
		let negateOffset = 0;

		for (let i = 0; i < pattern.length && pattern.charAt(i) === "!"; i++) {
			negate = !negate;
			negateOffset++;
		}

		if (negateOffset) this.pattern = pattern.slice(negateOffset);
		this.negate = negate;
	}

	// set partial to true to test if, for example,
	// "/a/b" matches the start of "/*/b/*/d"
	// Partial means, if you run out of file before you run
	// out of pattern, then that's fine, as long as all
	// the parts match.
	matchOne(fileInput: Array<string>, pattern: Array<ParseReturn>, partial = false) {
		let file = fileInput;
		let fileStartIndex = 0;
		let patternStartIndex = 0;

		// UNC paths like //?/X:/... can match X:/... and vice versa
		// Drive letters in absolute drive or unc paths are always compared
		// case-insensitively.
		if (this.isWindows) {
			const f0 = file[0];
			const fileDrive = typeof f0 === "string" && /^[a-z]:$/i.test(f0);
			const fileUNC =
				!fileDrive &&
				file[0] === "" &&
				file[1] === "" &&
				file[2] === "?" &&
				typeof file[3] === "string" &&
				/^[a-z]:$/i.test(file[3]);

			const p0 = pattern[0];
			const patternDrive = typeof p0 === "string" && /^[a-z]:$/i.test(p0);
			const patternUNC =
				!patternDrive &&
				pattern[0] === "" &&
				pattern[1] === "" &&
				pattern[2] === "?" &&
				typeof pattern[3] === "string" &&
				/^[a-z]:$/i.test(pattern[3]);

			const fdi = fileUNC ? 3 : fileDrive ? 0 : undefined;
			const pdi = patternUNC ? 3 : patternDrive ? 0 : undefined;
			if (typeof fdi === "number" && typeof pdi === "number") {
				const [fd, pd]: [string, string] = [file[fdi] as string, pattern[pdi] as string];
				// start matching at the drive letter index of each
				if (fd.toLowerCase() === pd.toLowerCase()) {
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
		if (head.length) {
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
		if (tail.length) {
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
		if (!body.length) {
			let sawSome = !!fileTailMatch;
			for (let i = fileIndex; i < file.length - fileTailMatch; i++) {
				const f = String(file[i]);
				sawSome = true;
				if (f === "." || f === ".." || (!this.options.dot && f.startsWith("."))) {
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
		const bodySegments: Array<[Array<ParseReturn>, number]> = [[[], 0]];
		let currentBody: [Array<ParseReturn>, number] = bodySegments[0] as [Array<ParseReturn>, number];
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
		let i = bodySegments.length - 1;
		const fileLength = file.length - fileTailMatch;
		for (const b of bodySegments) {
			b[1] = fileLength - ((nonGsPartsSums[i--] as number) + b[0].length);
		}

		return !!this.#matchGlobStarBodySections(file, bodySegments, fileIndex, 0, partial, 0, !!fileTailMatch);
	}

	// return false for "nope, not matching"
	// return null for "not matching, cannot keep trying"
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
		if (!bs) {
			// just make sure that there's no bad dots
			for (let i = fileIndex; i < file.length; i++) {
				sawTail = true;
				const f = file[i] as string;
				if (f === "." || f === ".." || (!this.options.dot && f.startsWith("."))) {
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
			if (f === "." || f === ".." || (f !== undefined && !this.options.dot && f.startsWith("."))) {
				return false;
			}

			fileIndex++;
		}
		// walked off. no point continuing
		return partial || null;
	}

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
			const p = pattern[pi] as ParseReturn;
			const f = file[fi] as string;

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
			if (typeof p === "string") {
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
		if (pi === pl) {
			// ran out of pattern, still have file left.
			// this is only acceptable if we're on the very last
			// empty segment of a file with a trailing slash.
			// a/* should match a/b/
			return fi === fl - 1 && file[fi] === "";
		}

		// should be unreachable.
		throw new Error("wtf?");
	}

	braceExpand() {
		return braceExpand(this.pattern, this.options);
	}

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
		const mStarDotExt = mStar ? null : pattern.match(starDotExtRE);
		const mQmarks = mStar || mStarDotExt ? null : pattern.match(qmarksRE);
		const mStarDotStar = mStar || mStarDotExt || mQmarks ? null : pattern.match(starDotStarRE);
		const mDotStar = mStar || mStarDotExt || mQmarks || mStarDotStar ? null : pattern.match(dotStarRE);
		if (mStar) {
			fastTest = options.dot ? starTestDot : starTest;
		} else if (mStarDotExt) {
			fastTest = (
				options.nocase
					? options.dot
						? starDotExtTestNocaseDot
						: starDotExtTestNocase
					: options.dot
						? starDotExtTestDot
						: starDotExtTest
			)(mStarDotExt[1] as string);
		} else if (mQmarks) {
			fastTest = (
				options.nocase
					? options.dot
						? qmarksTestNocaseDot
						: qmarksTestNocase
					: options.dot
						? qmarksTestDot
						: qmarksTest
			)(mQmarks);
		} else if (mStarDotStar) {
			fastTest = options.dot ? starDotStarTestDot : starDotStarTest;
		} else if (mDotStar) {
			fastTest = dotStarTest;
		}

		const re = AST.fromGlob(pattern, this.options).toMMPattern();
		if (fastTest && typeof re === "object") {
			// Avoids overriding in frozen environments
			Reflect.defineProperty(re, "test", { value: fastTest });
		}
		return re;
	}

	makeRe() {
		if (this.regexp || this.regexp === false) return this.regexp;

		// at this point, this.set is a 2d array of partial
		// pattern strings, or "**".
		//
		// It's better to use .match().  This function shouldn't
		// be used, really, but it's pretty convenient sometimes,
		// when you just want to work with a regex.
		const set = this.set;

		if (!set.length) {
			this.regexp = false;
			return this.regexp;
		}
		const options = this.options;

		const twoStar = options.noglobstar ? star : options.dot ? twoStarDot : twoStarNoDot;
		const flags = new Set(options.nocase ? ["i"] : []);

		// regexpify non-globstar patterns
		// if ** is only item, then we just do one twoStar
		// if ** is first, and there are more, prepend (\/|twoStar\/)? to next
		// if ** is last, append (\/twoStar|) to previous
		// if ** is in the middle, append (\/|\/twoStar\/) to previous
		// then filter out GLOBSTAR symbols
		let re = set
			.map((pattern) => {
				const pp: Array<string | typeof GLOBSTAR> = pattern.map((p) => {
					if (p instanceof RegExp) {
						for (const f of p.flags.split("")) flags.add(f);
					}
					return typeof p === "string" ? regExpEscape(p) : p === GLOBSTAR ? GLOBSTAR : (p._src as string);
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
				const filtered = pp.filter((p) => p !== GLOBSTAR) as Array<string>;

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
		let filename = ff[ff.length - 1] ?? "";
		if (!filename) {
			for (let i = ff.length - 2; !filename && i >= 0; i--) {
				filename = ff[i] ?? "";
			}
		}

		for (const pattern of set) {
			let file = ff;
			if (options.matchBase && pattern.length === 1) {
				file = [filename];
			}
			const hit = this.matchOne(file, pattern, partial);
			if (hit) {
				if (options.flipNegate) {
					return true;
				}
				return !this.negate;
			}
		}

		// didn't get any hits.  this is success if it's a negative
		// pattern, failure otherwise.
		if (options.flipNegate) {
			return false;
		}
		return this.negate;
	}
}
