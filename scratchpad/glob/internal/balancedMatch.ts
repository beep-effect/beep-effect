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

/** The balanced section found by {@link balanced}. */
export interface BalancedResult {
	readonly start: number;
	readonly end: number;
	readonly pre: string;
	readonly body: string;
	readonly post: string;
}

const maybeMatch = (reg: RegExp, str: string): string | null => {
	const m = str.match(reg);
	return m ? m[0] : null;
};

/**
 * The first balanced `a ... b` section of `str`: its delimiter offsets and the
 * text before, inside and after it. `false` when no balanced pair exists.
 */
export const balanced = (a: string | RegExp, b: string | RegExp, str: string): BalancedResult | false => {
	const ma = a instanceof RegExp ? maybeMatch(a, str) : a;
	const mb = b instanceof RegExp ? maybeMatch(b, str) : b;

	if (ma === null || mb === null) return false;
	const r = range(ma, mb, str);
	if (r === undefined) return false;

	return {
		start: r[0],
		end: r[1],
		pre: str.slice(0, r[0]),
		body: str.slice(r[0] + ma.length, r[1]),
		post: str.slice(r[1] + mb.length),
	};
};

/** Offsets of the first balanced `a ... b` pair in `str`, or `undefined`. */
export const range = (a: string, b: string, str: string): undefined | [number, number] => {
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

		while (i >= 0 && !result) {
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

		if (begs.length && right !== undefined) {
			result = [left, right];
		}
	}

	return result;
};
