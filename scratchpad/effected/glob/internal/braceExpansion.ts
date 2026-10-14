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
//    programmer error and dies as a TypeError defect.

import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as Random from "effect/Random";
import * as S from "effect/Schema";
import { balanced } from "./balancedMatch.ts";
import { EXPANSION_MAX, GuardExceeded, MAX_NESTING_DEPTH, assertCap } from "./limits.ts";

const random = Random.Random.defaultValue();
const escSlash = `\0SLASH${random.nextDoubleUnsafe()}\0`;
const escOpen = `\0OPEN${random.nextDoubleUnsafe()}\0`;
const escClose = `\0CLOSE${random.nextDoubleUnsafe()}\0`;
const escComma = `\0COMMA${random.nextDoubleUnsafe()}\0`;
const escPeriod = `\0PERIOD${random.nextDoubleUnsafe()}\0`;
const escSlashPattern = new RegExp(escSlash, "g");
const escOpenPattern = new RegExp(escOpen, "g");
const escClosePattern = new RegExp(escClose, "g");
const escCommaPattern = new RegExp(escComma, "g");
const escPeriodPattern = new RegExp(escPeriod, "g");
const slashPattern = /\\\\/g;
const openPattern = /\\{/g;
const closePattern = /\\}/g;
const commaPattern = /\\,/g;
const periodPattern = /\\\./g;

const numeric = (str: string): number => (Number.isNaN(Number(str)) ? str.charCodeAt(0) : Number.parseInt(str, 10));

const escapeBraces = (str: string): string =>
	str
		.replace(slashPattern, escSlash)
		.replace(openPattern, escOpen)
		.replace(closePattern, escClose)
		.replace(commaPattern, escComma)
		.replace(periodPattern, escPeriod);

const unescapeBraces = (str: string): string =>
	str
		.replace(escSlashPattern, "\\")
		.replace(escOpenPattern, "{")
		.replace(escClosePattern, "}")
		.replace(escCommaPattern, ",")
		.replace(escPeriodPattern, ".");

/**
 * Basically just str.split(","), but handling cases where we have nested
 * braced sections, which should be treated as individual members, like
 * {a,{b,c},d}.
 */
const parseCommaParts = (str: string, depth: number): Array<string> => {
	if (depth > MAX_NESTING_DEPTH) {
		throw GuardExceeded.fromReason("NestingDepthExceeded", MAX_NESTING_DEPTH, depth);
	}
	if (str === "") {
		return [""];
	}

	const parts: Array<string> = [];
	const m = balanced("{", "}", str);

	if (m === false) {
		return str.split(",");
	}

	const { pre, body, post } = m;
	const p = pre.split(",");

	p[p.length - 1] += `{${body}}`;
	const postParts = parseCommaParts(post, depth + 1);
	if (post.length !== 0) {
		p[p.length - 1] += postParts.splice(0, 1).join("");
		p.push(...postParts);
	}

	parts.push(...p);

	return parts;
};

/**
 * Configures the maximum number of alternatives produced by brace expansion.
 *
 * **Gotchas**
 *
 * An invalid `max` raises a `TypeError`; exhausting a valid budget raises
 * {@link GuardExceeded} rather than silently truncating the alternatives.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface BraceExpansionOptions {
	readonly max?: number;
}

/**
 * Expand a brace pattern into its alternatives, Bash 4.3 style.
 *
 * **Gotchas**
 *
 * Guard behavior (see the port notes above): over-deep nesting and budget
 * exhaustion throw {@link GuardExceeded}; an invalid `max` dies as a
 * `TypeError` defect.
 *
 * **Example** (Expand alternatives and a padded sequence)
 *
 * ```ts
 * import { expand } from "@beep/scratchpad/effected/glob/internal/braceExpansion"
 *
 * console.log(expand("file.{ts,js}").join(",")) // file.ts,file.js
 * console.log(expand("part{01..03}").join(",")) // part01,part02,part03
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const expand: {
	(options?: BraceExpansionOptions): (str: string) => Array<string>;
	(str: string, options?: BraceExpansionOptions): Array<string>;
} = dual((args) => P.isString(args[0]), (str: string, options: BraceExpansionOptions = {}): Array<string> => {
	if (str === "") {
		return [];
	}

	const max = assertCap("braceExpandMax", options.max ?? EXPANSION_MAX);

	// I don't know why Bash 4.3 does this, but it does.
	// Anything starting with {} will have the first two bytes preserved
	// but *only* at the top level, so {},a}b will not expand to anything,
	// but a{},b}c will be expanded to [a}c,abc].
	// One could argue that this is a bug in Bash, but since the goal of
	// this module is to match Bash's rules, we escape a leading {}
	let input = str;
	if (input.slice(0, 2) === "{}") {
		input = `\\{\\}${input.slice(2)}`;
	}

	const result: Array<string> = [];
	for (const member of expand_(escapeBraces(input), max, true, 0)) {
		if (result.length >= max) {
			throw GuardExceeded.fromReason("ExpansionBudgetExceeded", max, result.length + 1);
		}
		result.push(unescapeBraces(member));
	}
	return result;
});

const embrace = (str: string): string => `{${str}}`;

const isPadded = (el: string): boolean => /^-?0\d/.test(el);

const lte = (i: number, y: number): boolean => i <= y;

const gte = (i: number, y: number): boolean => i >= y;

function* expand_(str: string, max: number, isTopInput: boolean, depth: number): Generator<string> {
	if (depth > MAX_NESTING_DEPTH) {
		throw GuardExceeded.fromReason("NestingDepthExceeded", MAX_NESTING_DEPTH, depth);
	}

	let current = str;
	let isTop = isTopInput;

	// The `{a},b}` rewrite below restarts expansion on a rewritten string with
	// the same `max` and `isTop = true`. Loop instead of recursing so a long run
	// of non-expanding `{}` groups can't exhaust the call stack.
	for (;;) {
		const m = balanced("{", "}", current);
		if (m === false) { yield current; return; }

		// no need to expand pre, since it is guaranteed to be free of brace-sets
		const pre = m.pre;

		if (/\$$/.test(m.pre)) {
			const post = () => m.post.length !== 0 ? expand_(m.post, max, false, depth + 1) : [""];
			for (const p of post()) yield `${pre}{${m.body}}${p}`;
			return;
		}

		const isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
		const isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
		const isSequence = isNumericSequence || isAlphaSequence;
		const isOptions = m.body.indexOf(",") >= 0;
		if (!isSequence && !isOptions) {
			// {a},b}
			if (m.post.match(/,(?!,).*}/) !== null) {
				current = `${m.pre}{${m.body}${escClose}${m.post}`;
				isTop = true;
				continue;
			}
			yield current;
			return;
		}

		// Only expand post once we know this brace set actually expands. Computing
		// it before the early returns above expanded post a second time on every
		// non-expanding `{}`, which is what made inputs like `a{},{},{}...` blow up
		// exponentially.
		const post = () => m.post.length !== 0 ? expand_(m.post, max, false, depth + 1) : [""];

		const n = isSequence ? m.body.split(/\.\./) : parseCommaParts(m.body, depth + 1);
		const emit = function* (members: Iterable<string>): Generator<string> {
			for (const member of members) {
				for (const suffix of post()) {
					const expansion = pre + member + suffix;
					if (!isTop || isSequence || expansion !== "") yield expansion;
				}
			}
		};

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
			const pad = n.some(isPadded);

			// Validate the count before generating members. Overflow can produce
			// Infinity or NaN; both exceed the budget, measured as positive infinity.
			const count = Math.floor(Math.abs(y - x) / Math.abs(incr)) + 1;
			const total = S.is(S.Finite)(count) ? count : Infinity;
			if (total > max) {
				throw GuardExceeded.fromReason("ExpansionBudgetExceeded", max, total);
			}

			// Advancing arithmetic follows the endpoint, even when rounding makes
			// the actual increment smaller than the declared step. A stalled
			// addition retains the round-2 bounded duplicate-member behavior.
			for (let i = x, member = 0; test(i, y); member++) {
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
							const z = "0".repeat(need);
							c = i < 0 ? `-${z}${c.slice(1)}` : `${z}${c}`;
						}
					}
				}
				yield* emit([c]);
				const next = i + incr;
				if (next === i && member + 1 >= total) break;
				i = next;
			}
		} else if (n.length === 1 && n[0] !== undefined) {
			// The doubled-brace form wraps each expanded inner alternative. Its
			// singleton form bypasses top-level empty-member filtering upstream.
			let first = "";
			let count = 0;
			for (const member of expand_(n[0], max, false, depth + 1)) {
				if (count === 0) first = member;
				else {
					if (count === 1) yield* emit([embrace(first)]);
					yield* emit([embrace(member)]);
				}
				count++;
			}
			if (count === 1) {
				for (const suffix of post()) yield pre + embrace(first) + suffix;
			}
		} else {
			for (const part of n) yield* emit(expand_(part, max, false, depth + 1));
		}
		return;
	}
}
