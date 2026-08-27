/**
 * Iterative balanced-delimiter search for brace expansion.
 *
 * Fully iterative: this module has no recursion surface and therefore no
 * depth guard. Do not add one.
 *
 * Ported from balanced-match@4.0.4.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
// Ported from balanced-match@4.0.4 (https://github.com/juliangruber/balanced-match)
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
// Port notes: adapted to house TypeScript strictness (explicit result typing,
// single-variable declarations). Fully ITERATIVE — this module has NO recursion
// surface and therefore NO depth guard. Do not add one.

import { $ScratchpadId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("glob/internal/balancedMatch");

/**
 * The balanced section found by {@link balanced}: delimiter offsets and the
 * text before, inside, and after the pair.
 *
 * **Example** (Describe a balanced section)
 *
 * ```ts
 * import { BalancedResult } from "../../glob/internal/balancedMatch.ts"
 *
 * const result = BalancedResult.make({ start: 1, end: 5, pre: "a", body: "b,c", post: "d" })
 * console.log(result.body) // "b,c"
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class BalancedResult extends S.Class<BalancedResult>($I`BalancedResult`)(
	{
		start: S.Natural,
		end: S.Natural,
		pre: S.String,
		body: S.String,
		post: S.String,
	},
	$I.annote("BalancedResult", {
		description: "Offsets and text partitions for one balanced delimiter pair.",
	}),
) {}

const maybeMatch = (reg: RegExp, str: string): O.Option<string> => O.fromNullishOr(str.match(reg)?.[0]);

/**
 * The first balanced `a ... b` section of `str`: its delimiter offsets and the
 * text before, inside and after it. `false` when no balanced pair exists.
 *
 * **Example** (Split a brace body)
 *
 * ```ts
 * import { balanced } from "../../glob/internal/balancedMatch.ts"
 *
 * const found = balanced("a{b,c}d", "{", "}")
 * console.log(found !== false && found.pre) // "a"
 * console.log(found !== false && found.body) // "b,c"
 * console.log(found !== false && found.post) // "d"
 * console.log(balanced("abc", "{", "}")) // false
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const balanced: {
	(a: string | RegExp, b: string | RegExp): (str: string) => BalancedResult | false;
	(str: string, a: string | RegExp, b: string | RegExp): BalancedResult | false;
} = dual(3, (str: string, a: string | RegExp, b: string | RegExp): BalancedResult | false => {
	const ma = P.isRegExp(a) ? maybeMatch(a, str) : O.some(a);
	const mb = P.isRegExp(b) ? maybeMatch(b, str) : O.some(b);

	if (O.isNone(ma) || O.isNone(mb)) return false;
	const r = range(str, ma.value, mb.value);
	if (r === undefined) return false;

	return BalancedResult.make({
		start: r[0],
		end: r[1],
		pre: str.slice(0, r[0]),
		body: str.slice(r[0] + ma.value.length, r[1]),
		post: str.slice(r[1] + mb.value.length),
	});
});

/**
 * Offsets of the first balanced `a ... b` pair in `str`, or `undefined`.
 *
 * **Example** (Locate a balanced delimiter pair)
 *
 * ```ts
 * import { range } from "../../glob/internal/balancedMatch.ts"
 *
 * console.log(range("a{b,c}d", "{", "}")) // [1, 5]
 * console.log(range("abc", "{", "}")) // undefined
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const range: {
	(a: string, b: string): (str: string) => undefined | [number, number];
	(str: string, a: string, b: string): undefined | [number, number];
} = dual(3, (str: string, a: string, b: string): undefined | [number, number] => {
	let beg: number | undefined;
	let left: number;
	let right: number | undefined;
	let result: undefined | [number, number];
	let ai = str.indexOf(a);
	let bi = str.indexOf(b, ai + 1);
	let i = ai;

	if (ai >= 0 && bi > 0) {
		if (a === b) {
			return [ai, bi];
		}
		const begs: Array<number> = [];
		left = str.length;

		while (i >= 0 && result === undefined) {
			if (i === ai) {
				begs.push(i);
				ai = str.indexOf(a, i + 1);
			} else if (begs.length === 1) {
				const r = begs.pop();
				if (r !== undefined) result = [r, bi];
			} else {
				beg = begs.pop();
				if (beg !== undefined && beg < left) {
					left = beg;
					right = bi;
				}

				bi = str.indexOf(b, i + 1);
			}

			i = ai < bi && ai >= 0 ? ai : bi;
		}

		if (begs.length > 0 && right !== undefined) {
			result = [left, right];
		}
	}

	return result;
});
