/**
 * Bash 4.3-style brace expansion with a depth guard and a throwing budget.
 *
 * **Details**
 *
 * Over-deep nesting throws `NestingDepthExceeded`. Budget exhaustion throws
 * `ExpansionBudgetExceeded` instead of silently truncating. Invalid `max` is
 * a schema-backed invariant defect via `assertCap`.
 *
 * Ported from brace-expansion@5.0.7.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
// Ported from brace-expansion@5.0.7 (https://github.com/juliangruber/brace-expansion)
// Copyright (c) 2013 Julian Gruber <julian@juliangruber.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of
// this software and associated documentation files (the "Software"), to deal in
// the Software without restriction, including without limitation the rights to
// use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
// of the Software, and to permit persons to whom the Software is furnished to do
// so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// Port notes, three deliberate changes from upstream:
// 1. Depth guard on expand_ at MAX_NESTING_DEPTH — comma-bearing nesting
//    descends one frame per level; the guard throws GuardExceeded
//    ("NestingDepthExceeded") instead of overflowing the stack. The upstream
//    {a},b} for-loop rewrite and the lazy post evaluation (both load-bearing
//    DoS fixes; their upstream comments are preserved below) are kept exactly.
// 2. Depth guard on parseCommaParts — self-recursive on the post side;
//    upstream relies only on the 64KB pattern-length cap.
// 3. Budget exhaustion THROWS GuardExceeded("ExpansionBudgetExceeded") where
//    upstream silently truncates the expansion list at max — silent truncation
//    silently changes match semantics; the typed signal is the honest surface.
//    The max cap itself is validated by assertCap: a NaN or non-integer max is
//    programmer error and dies as a schema-backed invariant defect.

import { $ScratchpadId } from "@beep/identity/packages";
import { dual, flow, pipe } from "effect/Function";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { balanced } from "./balancedMatch.ts";
import { EXPANSION_MAX, GuardExceeded, MAX_NESTING_DEPTH, assertCap } from "./limits.ts";

const $I = $ScratchpadId.create("glob/internal/braceExpansion");

class BraceEscapeTokens extends S.Class<BraceEscapeTokens>($I`BraceEscapeTokens`)(
	{
		slash: S.NonEmptyString,
		open: S.NonEmptyString,
		close: S.NonEmptyString,
		comma: S.NonEmptyString,
		period: S.NonEmptyString,
	},
	$I.annote("BraceEscapeTokens", {
		description: "Collision-free deterministic sentinels used during one brace expansion.",
	}),
) {
	static forInput(input: string): BraceEscapeTokens {
		let nonce = 0;
		let prefix = `\0GLOB_ESCAPE_${nonce}_`;
		// Collision freedom depends on the whole input, so advance the deterministic
		// prefix until it is absent before constructing the token set.
		while (Str.includes(prefix)(input)) {
			nonce += 1;
			prefix = `\0GLOB_ESCAPE_${nonce}_`;
		}
		return BraceEscapeTokens.make({
			slash: `${prefix}SLASH\0`,
			open: `${prefix}OPEN\0`,
			close: `${prefix}CLOSE\0`,
			comma: `${prefix}COMMA\0`,
			period: `${prefix}PERIOD\0`,
		});
	}
}

const slashPattern = /\\\\/g;
const openPattern = /\\{/g;
const closePattern = /\\}/g;
const commaPattern = /\\,/g;
const periodPattern = /\\\./g;

const decodeFinite = S.decodeUnknownOption(S.FiniteFromString);
const numeric = (str: string): number =>
	O.getOrElse(decodeFinite(str), () => O.getOrElse(Str.charCodeAt(str, 0), () => 0));

const escapeBraces = (str: string, tokens: BraceEscapeTokens): string =>
	pipe(
		str,
		Str.replace(slashPattern, tokens.slash),
		Str.replace(openPattern, tokens.open),
		Str.replace(closePattern, tokens.close),
		Str.replace(commaPattern, tokens.comma),
		Str.replace(periodPattern, tokens.period),
	);

const unescapeBraces = (tokens: BraceEscapeTokens) =>
	flow(
		Str.replaceAll(tokens.slash, "\\"),
		Str.replaceAll(tokens.open, "{"),
		Str.replaceAll(tokens.close, "}"),
		Str.replaceAll(tokens.comma, ","),
		Str.replaceAll(tokens.period, "."),
	);

/**
 * Basically just str.split(","), but handling cases where we have nested
 * braced sections, which should be treated as individual members, like
 * {a,{b,c},d}.
 */
const parseCommaParts = (str: string, depth: number): Array<string> => {
	if (depth > MAX_NESTING_DEPTH) {
		throw GuardExceeded.make({ reason: "NestingDepthExceeded", limit: MAX_NESTING_DEPTH, actual: depth });
	}
	if (str.length === 0) {
		return [""];
	}

	const parts: Array<string> = [];
	const m = balanced(str, "{", "}");

	if (m === false) {
		return Str.split(str, ",");
	}

	const { pre, body, post } = m;
	const p = Str.split(pre, ",");

	p[p.length - 1] += `{${body}}`;
	const postParts = parseCommaParts(post, depth + 1);
	if (post.length > 0) {
		p[p.length - 1] += postParts.shift() ?? "";
		p.push(...postParts);
	}

	parts.push(...p);

	return parts;
};

// Internal refinement reused by the exported options schema.
const PositiveExpansionMax = S.Int.check(S.isGreaterThan(0)).pipe(
	$I.annoteSchema("PositiveExpansionMax", {
		description: "Positive safe integer bounding brace-expansion output cardinality.",
	}),
);

/**
 * Runtime schema for {@link expand} options. `max` is a positive integer that
 * can tighten, but never raise, the default expansion budget.
 *
 * **Example** (Decode an expansion budget)
 *
 * ```ts
 * import { BraceExpansionOptions } from "../../glob/internal/braceExpansion.ts"
 * import * as S from "effect/Schema"
 *
 * const options = S.decodeUnknownSync(BraceExpansionOptions)({ max: 32 })
 * console.log(options.max) // 32
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const BraceExpansionOptions = S.Struct({
	max: S.optionalKey(PositiveExpansionMax),
}).pipe(
	$I.annoteSchema("BraceExpansionOptions", {
		description: "Optional tighten-only output budget for brace expansion.",
	}),
);

/**
 * Decoded option bag produced by {@link BraceExpansionOptions}.
 *
 * **Example** (Declare an expansion budget)
 *
 * ```ts
 * import type { BraceExpansionOptions } from "../../glob/internal/braceExpansion.ts"
 *
 * const options = { max: 32 } satisfies BraceExpansionOptions
 * console.log(options.max) // 32
 * ```
 *
 * @see {@link BraceExpansionOptions} for runtime validation.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type BraceExpansionOptions = typeof BraceExpansionOptions.Type;

const expandImpl = (str: string, options: BraceExpansionOptions = {}): Array<string> => {
	if (str.length === 0) {
		return [];
	}

	const max = assertCap(options.max ?? EXPANSION_MAX, "braceExpandMax");

	// I don't know why Bash 4.3 does this, but it does.
	// Anything starting with {} will have the first two bytes preserved
	// but *only* at the top level, so {},a}b will not expand to anything,
	// but a{},b}c will be expanded to [a}c,abc].
	// One could argue that this is a bug in Bash, but since the goal of
	// this module is to match Bash's rules, we escape a leading {}
	let input = str;
	if (Str.slice(0, 2)(input) === "{}") {
		input = `\\{\\}${Str.slice(2)(input)}`;
	}

	const tokens = BraceEscapeTokens.forInput(input);
	return A.map(expand_(escapeBraces(input, tokens), max, true, 0, tokens), unescapeBraces(tokens));
};

/**
 * Expand a brace pattern into its alternatives, Bash 4.3 style.
 *
 * **Gotchas**
 *
 * Budget exhaustion and nesting past {@link MAX_NESTING_DEPTH} throw
 * {@link GuardExceeded}; invalid caps are internal invariant defects. A
 * leading `{}` is escaped only at the top level, matching Bash 4.3.
 *
 * **Example** (Expand alternatives and trip the budget)
 *
 * ```ts
 * import { expand } from "../../glob/internal/braceExpansion.ts"
 * import { GuardExceeded } from "../../glob/internal/limits.ts"
 *
 * console.log(expand("a{b,c}d")) // ["abd", "acd"]
 * console.log(expand({})("a{b,c}d")) // ["abd", "acd"]
 * try {
 *   expand("{0..2}", { max: 2 })
 * } catch (error) {
 *   console.log(error instanceof GuardExceeded && error.reason === "ExpansionBudgetExceeded") // true
 * }
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const expand: {
	(): (str: string) => Array<string>;
	(str: string): Array<string>;
	(options: BraceExpansionOptions): (str: string) => Array<string>;
	(str: string, options: BraceExpansionOptions): Array<string>;
} = dual((args) => P.isString(args[0]), expandImpl);

const embrace = (str: string): string => `{${str}}`;

const isPadded = (el: string): boolean => /^-?0\d/.test(el);

const lte = (i: number, y: number): boolean => i <= y;

const gte = (i: number, y: number): boolean => i >= y;

// oxlint-disable-next-line func-style
function expand_(
	str: string,
	max: number,
	isTopInput: boolean,
	depth: number,
	tokens: BraceEscapeTokens,
): Array<string> {
	if (depth > MAX_NESTING_DEPTH) {
		throw GuardExceeded.make({ reason: "NestingDepthExceeded", limit: MAX_NESTING_DEPTH, actual: depth });
	}

	const expansions: Array<string> = [];
	let current = str;
	let isTop = isTopInput;

	// The `{a},b}` rewrite below restarts expansion on a rewritten string with
	// the same `max` and `isTop = true`. Loop instead of recursing so a long run
	// of non-expanding `{}` groups can't exhaust the call stack.
	for (;;) {
		const m = balanced(current, "{", "}");
		if (m === false) return [current];

		// no need to expand pre, since it is guaranteed to be free of brace-sets
		const pre = m.pre;

		if (/\$$/.test(m.pre)) {
			const post: Array<string> = m.post.length > 0 ? expand_(m.post, max, false, depth + 1, tokens) : [""];
			if (post.length > max) {
				throw GuardExceeded.make({ reason: "ExpansionBudgetExceeded", limit: max, actual: post.length });
			}
			for (const p of post) {
				expansions.push(`${pre}{${m.body}}${p}`);
			}
			return expansions;
		}

		const isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
		const isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
		const isSequence = isNumericSequence || isAlphaSequence;
		const isOptions = m.body.indexOf(",") >= 0;
		if (!isSequence && !isOptions) {
			// {a},b}
			if (/,(?!,).*\}/.test(m.post)) {
				current = `${m.pre}{${m.body}${tokens.close}${m.post}`;
				isTop = true;
				continue;
			}
			return [current];
		}

		// Only expand post once we know this brace set actually expands. Computing
		// it before the early returns above expanded post a second time on every
		// non-expanding `{}`, which is what made inputs like `a{},{},{}...` blow up
		// exponentially.
		const post: Array<string> = m.post.length > 0 ? expand_(m.post, max, false, depth + 1, tokens) : [""];

		let n: Array<string>;
		if (isSequence) {
			n = m.body.split(/\.\./);
		} else {
			n = parseCommaParts(m.body, depth + 1);
			const first = n[0];
			if (n.length === 1 && first !== undefined) {
				// x{{a,b}}y ==> x{a}y x{b}y
				n = A.map(expand_(first, max, false, depth + 1, tokens), embrace);
				if (n.length === 1) {
					return A.map(post, (p) => `${m.pre}${n[0]}${p}`);
				}
			}
		}

		// at this point, n is the parts, and we know it's not a comma set
		// with a single entry.
		let N: Array<string>;

		const n0 = n[0];
		const n1 = n[1];
		if (isSequence && n0 !== undefined && n1 !== undefined) {
			const x = numeric(n0);
			const y = numeric(n1);
			const width = Math.max(n0.length, n1.length);
			const n2 = n[2];
			let incr = n.length === 3 && n2 !== undefined ? Math.max(Math.abs(numeric(n2)), 1) : 1;
			let test = lte;
			const reverse = y < x;
			if (reverse) {
				incr *= -1;
				test = gte;
			}
			const pad = A.some(n, isPadded);

			// Budget check up front: the member count is exactly computable, so an
			// over-budget sequence trips before any work is done (upstream
			// truncated the loop at max instead).
			const total = Math.floor(Math.abs(y - x) / Math.abs(incr)) + 1;
			if (total > max) {
				throw GuardExceeded.make({ reason: "ExpansionBudgetExceeded", limit: max, actual: total });
			}

			N = [];

			for (let i = x; test(i, y); i += incr) {
				let c: string;
				if (isAlphaSequence) {
					c = String.fromCharCode(i);
					if (c === "\\") {
						c = "";
					}
				} else {
					c = String(i);
					if (pad) {
						const need = width - c.length;
						if (need > 0) {
						const z = Str.repeat(need)("0");
						c = i < 0 ? `-${z}${Str.slice(1)(c)}` : `${z}${c}`;
						}
					}
				}
				N.push(c);
			}
		} else {
			N = [];

			for (const part of n) {
				N.push(...expand_(part, max, false, depth + 1, tokens));
			}
		}

		for (let j = 0; j < N.length; j++) {
			for (let k = 0; k < post.length; k++) {
				const expansion = pre + N[j] + post[k];
			if (!isTop || isSequence || expansion.length > 0) {
					if (expansions.length >= max) {
						// Budget exhausted with work remaining: the actual reported is the
						// count reached plus what remains in this group — a lower bound on
						// the full expansion size.
					throw GuardExceeded.make({
						reason: "ExpansionBudgetExceeded",
						limit: max,
						actual: expansions.length + (N.length - j) * post.length - k,
					});
					}
					expansions.push(expansion);
				}
			}
		}

		return expansions;
	}
}
