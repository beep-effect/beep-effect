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

import { balanced } from "./balancedMatch.ts";
import { EXPANSION_MAX, GuardExceeded, MAX_NESTING_DEPTH, assertCap } from "./limits.ts";

const escSlash = `\0SLASH${Math.random()}\0`;
const escOpen = `\0OPEN${Math.random()}\0`;
const escClose = `\0CLOSE${Math.random()}\0`;
const escComma = `\0COMMA${Math.random()}\0`;
const escPeriod = `\0PERIOD${Math.random()}\0`;
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
		throw new GuardExceeded("NestingDepthExceeded", MAX_NESTING_DEPTH, depth);
	}
	if (!str) {
		return [""];
	}

	const parts: Array<string> = [];
	const m = balanced("{", "}", str);

	if (!m) {
		return str.split(",");
	}

	const { pre, body, post } = m;
	const p = pre.split(",");

	p[p.length - 1] += `{${body}}`;
	const postParts = parseCommaParts(post, depth + 1);
	if (post.length) {
		p[p.length - 1] += postParts.shift() ?? "";
		p.push(...postParts);
	}

	parts.push(...p);

	return parts;
};

export interface BraceExpansionOptions {
	readonly max?: number;
}

/**
 * Expand a brace pattern into its alternatives, Bash 4.3 style.
 *
 * Guard behavior (see the port notes above): over-deep nesting and budget
 * exhaustion throw {@link GuardExceeded}; an invalid `max` dies as a
 * `TypeError` defect.
 */
export const expand = (str: string, options: BraceExpansionOptions = {}): Array<string> => {
	if (!str) {
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

	return expand_(escapeBraces(input), max, true, 0).map(unescapeBraces);
};

const embrace = (str: string): string => `{${str}}`;

const isPadded = (el: string): boolean => /^-?0\d/.test(el);

const lte = (i: number, y: number): boolean => i <= y;

const gte = (i: number, y: number): boolean => i >= y;

// oxlint-disable-next-line func-style
function expand_(str: string, max: number, isTopInput: boolean, depth: number): Array<string> {
	if (depth > MAX_NESTING_DEPTH) {
		throw new GuardExceeded("NestingDepthExceeded", MAX_NESTING_DEPTH, depth);
	}

	const expansions: Array<string> = [];
	let current = str;
	let isTop = isTopInput;

	// The `{a},b}` rewrite below restarts expansion on a rewritten string with
	// the same `max` and `isTop = true`. Loop instead of recursing so a long run
	// of non-expanding `{}` groups can't exhaust the call stack.
	for (;;) {
		const m = balanced("{", "}", current);
		if (!m) return [current];

		// no need to expand pre, since it is guaranteed to be free of brace-sets
		const pre = m.pre;

		if (/\$$/.test(m.pre)) {
			const post: Array<string> = m.post.length ? expand_(m.post, max, false, depth + 1) : [""];
			if (post.length > max) {
				throw new GuardExceeded("ExpansionBudgetExceeded", max, post.length);
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
			if (m.post.match(/,(?!,).*\}/)) {
				current = `${m.pre}{${m.body}${escClose}${m.post}`;
				isTop = true;
				continue;
			}
			return [current];
		}

		// Only expand post once we know this brace set actually expands. Computing
		// it before the early returns above expanded post a second time on every
		// non-expanding `{}`, which is what made inputs like `a{},{},{}...` blow up
		// exponentially.
		const post: Array<string> = m.post.length ? expand_(m.post, max, false, depth + 1) : [""];

		let n: Array<string>;
		if (isSequence) {
			n = m.body.split(/\.\./);
		} else {
			n = parseCommaParts(m.body, depth + 1);
			const first = n[0];
			if (n.length === 1 && first !== undefined) {
				// x{{a,b}}y ==> x{a}y x{b}y
				n = expand_(first, max, false, depth + 1).map(embrace);
				if (n.length === 1) {
					return post.map((p) => `${m.pre}${n[0]}${p}`);
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
			const pad = n.some(isPadded);

			// Budget check up front: the member count is exactly computable, so an
			// over-budget sequence trips before any work is done (upstream
			// truncated the loop at max instead).
			const total = Math.floor(Math.abs(y - x) / Math.abs(incr)) + 1;
			if (total > max) {
				throw new GuardExceeded("ExpansionBudgetExceeded", max, total);
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
							const z = "0".repeat(need);
							c = i < 0 ? `-${z}${c.slice(1)}` : `${z}${c}`;
						}
					}
				}
				N.push(c);
			}
		} else {
			N = [];

			for (const part of n) {
				N.push(...expand_(part, max, false, depth + 1));
			}
		}

		for (let j = 0; j < N.length; j++) {
			for (let k = 0; k < post.length; k++) {
				const expansion = pre + N[j] + post[k];
				if (!isTop || isSequence || expansion) {
					if (expansions.length >= max) {
						// Budget exhausted with work remaining: the actual reported is the
						// count reached plus what remains in this group — a lower bound on
						// the full expansion size.
						throw new GuardExceeded(
							"ExpansionBudgetExceeded",
							max,
							expansions.length + (N.length - j) * post.length - k,
						);
					}
					expansions.push(expansion);
				}
			}
		}

		return expansions;
	}
}
