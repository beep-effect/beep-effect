/**
 * Position-bounded character-class compiler for glob `[...]` expressions.
 *
 * **Details**
 *
 * POSIX classes, `!`/`^` negation, poison `$.` for empty classes, and
 * single-character `[_]` literal escapes. No recursion, no depth guard.
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
// Port notes: verbatim modulo house strictness (indexed access narrowed with
// locals). Position-bounded iteration over one [...] class — no recursion, no
// guard.

// translate the various posix character classes into unicode properties
// this works across all unicode locales

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GlobInvariantError } from "./limits.ts";

const $I = $ScratchpadId.create("glob/internal/braceExpressions");

// { <posix class>: [<translation>, /u flag required, negated]
const posixClasses: Readonly<Record<string, readonly [expression: string, unicode: boolean, negated: boolean]>> = {
	"[:alnum:]": ["\\p{L}\\p{Nl}\\p{Nd}", true, false],
	"[:alpha:]": ["\\p{L}\\p{Nl}", true, false],
	"[:ascii:]": ["\\x00-\\x7f", false, false],
	"[:blank:]": ["\\p{Zs}\\t", true, false],
	"[:cntrl:]": ["\\p{Cc}", true, false],
	"[:digit:]": ["\\p{Nd}", true, false],
	"[:graph:]": ["\\p{Z}\\p{C}", true, true],
	"[:lower:]": ["\\p{Ll}", true, false],
	"[:print:]": ["\\p{C}", true, false],
	"[:punct:]": ["\\p{P}", true, false],
	"[:space:]": ["\\p{Z}\\t\\r\\n\\v\\f", true, false],
	"[:upper:]": ["\\p{Lu}", true, false],
	"[:word:]": ["\\p{L}\\p{Nl}\\p{Nd}\\p{Pc}", true, false],
	"[:xdigit:]": ["A-Fa-f0-9", false, false],
};

// only need to escape a few things inside of brace expressions
// escapes: [ \ ] -
const braceEscape = Str.replace(/[[\]\\-]/g, "\\$&");
// escape all regexp magic characters
const regexpEscape = Str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

// everything has already been escaped, we just have to join
const rangesToString = A.join("");

/**
 * Runtime schema for the tuple returned by {@link parseClass}: regexp source,
 * whether `/u` is required, consumed character count, and magic status.
 *
 * **Example** (Decode a parsed class tuple)
 *
 * ```ts
 * import { ParseClassResult } from "../../glob/internal/braceExpressions.ts"
 * import * as S from "effect/Schema"
 *
 * const result = S.decodeUnknownSync(ParseClassResult)(["[a-z]", false, 5, true])
 * console.log(result[2]) // 5
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const ParseClassResult = S.Tuple([S.String, S.Boolean, S.Natural, S.Boolean]).pipe(
	$I.annoteSchema("ParseClassResult", {
		description: "Compiled character-class source, Unicode flag, consumed count, and magic status.",
	}),
);

/**
 * Decoded tuple produced by {@link ParseClassResult}.
 *
 * **Example** (Declare a parsed class tuple)
 *
 * ```ts
 * import type { ParseClassResult } from "../../glob/internal/braceExpressions.ts"
 *
 * const result = ["[a-z]", false, 5, true] satisfies ParseClassResult
 * console.log(result[2]) // 5
 * ```
 *
 * @see {@link ParseClassResult} for runtime validation.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type ParseClassResult = typeof ParseClassResult.Type;

/**
 * Compile a glob `[...]` class at `position` into regexp source.
 *
 * **Details**
 *
 * Returns regexp source, whether `/u` is required, consumed character count,
 * and whether the class is magic. Out-of-order ranges are dropped. An empty
 * class poisons the whole glob with `$.`.
 *
 * **Gotchas**
 *
 * Throws if `glob[position]` is not `"["`. Empty `[]` does not fail compile —
 * it matches nothing via poison `$.`. Single-character `[x]` / `[_]` is not
 * magic: it is a literal escape of glob metacharacters. `!` or `^` at class
 * start negates.
 *
 * **Example** (Compile a range class and a literal escape)
 *
 * ```ts
 * import { parseClass } from "../../glob/internal/braceExpressions.ts"
 * import { GlobInvariantError } from "../../glob/internal/limits.ts"
 *
 * console.log(parseClass("[a-z]", 0)) // ["[a-z]", false, 5, true]
 * console.log(parseClass("[_]", 0)) // ["_", false, 3, false]
 * try {
 *   parseClass("a", 0)
 * } catch (error) {
 *   console.log(error instanceof GlobInvariantError && error.detail) // "not in a brace expression"
 * }
 * ```
 *
 * @throws When `glob[position]` is not `"["`, with {@link GlobInvariantError}.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const parseClass: {
	(position: number): (glob: string) => ParseClassResult;
	(glob: string, position: number): ParseClassResult;
} = dual(2, (glob: string, position: number): ParseClassResult => {
	const pos = position;
	if (glob.charAt(pos) !== "[") {
		throw GlobInvariantError.make({ operation: "parseClass", detail: "not in a brace expression" });
	}
	const ranges: Array<string> = [];
	const negs: Array<string> = [];

	let i = pos + 1;
	let sawStart = false;
	let uflag = false;
	let escaping = false;
	let negate = false;
	let endPos = pos;
	let rangeStart = "";
	WHILE: while (i < glob.length) {
		const c = glob.charAt(i);
		if ((c === "!" || c === "^") && i === pos + 1) {
			negate = true;
			i++;
			continue;
		}

		if (c === "]" && sawStart && !escaping) {
			endPos = i + 1;
			break;
		}

		sawStart = true;
		if (c === "\\") {
			if (!escaping) {
				escaping = true;
				i++;
				continue;
			}
			// escaped \ char, fall through and treat like normal char
		}
		if (c === "[" && !escaping) {
			// either a posix class, a collation equivalent, or just a [
			for (const [cls, [unip, u, neg]] of R.toEntries(posixClasses)) {
				if (Str.startsWith(cls, i)(glob)) {
					// invalid, [a-[] is fine, but not [a-[:alpha]]
					if (rangeStart.length > 0) {
						return ["$.", false, glob.length - pos, true];
					}
					i += cls.length;
					if (neg) negs.push(unip);
					else ranges.push(unip);
					uflag = uflag || u;
					continue WHILE;
				}
			}
		}

		// now it's just a normal character, effectively
		escaping = false;
		if (rangeStart.length > 0) {
			// throw this range away if it's not valid, but others
			// can still match.
			if (c > rangeStart) {
				ranges.push(`${braceEscape(rangeStart)}-${braceEscape(c)}`);
			} else if (c === rangeStart) {
				ranges.push(braceEscape(c));
			}
			rangeStart = "";
			i++;
			continue;
		}

		// now might be the start of a range.
		// can be either c-d or c-] or c<more...>] or c] at this point
		if (Str.startsWith("-]", i + 1)(glob)) {
			ranges.push(braceEscape(`${c}-`));
			i += 2;
			continue;
		}
		if (Str.startsWith("-", i + 1)(glob)) {
			rangeStart = c;
			i += 2;
			continue;
		}

		// not the start of a range, just a single character
		ranges.push(braceEscape(c));
		i++;
	}

	if (endPos < i) {
		// didn't see the end of the class, not a valid class,
		// but might still be valid as a literal match.
		return ["", false, 0, false];
	}

	// if we got no ranges and no negates, then we have a range that
	// cannot possibly match anything, and that poisons the whole glob
	if (ranges.length === 0 && negs.length === 0) {
		return ["$.", false, glob.length - pos, true];
	}

	// if we got one positive range, and it's a single character, then that's
	// not actually a magic pattern, it's just that one literal character.
	// we should not treat that as "magic", we should just return the literal
	// character. [_] is a perfectly valid way to escape glob magic chars.
	const soleRange = ranges[0];
	if (negs.length === 0 && ranges.length === 1 && soleRange !== undefined && /^\\?.$/.test(soleRange) && !negate) {
		const r = soleRange.length === 2 ? Str.slice(-1)(soleRange) : soleRange;
		return [regexpEscape(r), false, endPos - pos, false];
	}

	const sranges = `[${negate ? "^" : ""}${rangesToString(ranges)}]`;
	const snegs = `[${negate ? "" : "^"}${rangesToString(negs)}]`;
	const comb =
		ranges.length > 0 && negs.length > 0 ? `(${sranges}|${snegs})` : ranges.length > 0 ? sranges : snegs;

	return [comb, uflag, endPos - pos, true];
});
