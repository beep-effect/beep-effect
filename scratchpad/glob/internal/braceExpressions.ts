/**
 * Position-bounded character-class compiler for glob `[...]` expressions.
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

// { <posix class>: [<translation>, /u flag required, negated]
const posixClasses: { [k: string]: [e: string, u: boolean, n?: boolean] } = {
	"[:alnum:]": ["\\p{L}\\p{Nl}\\p{Nd}", true],
	"[:alpha:]": ["\\p{L}\\p{Nl}", true],
	"[:ascii:]": ["\\x00-\\x7f", false],
	"[:blank:]": ["\\p{Zs}\\t", true],
	"[:cntrl:]": ["\\p{Cc}", true],
	"[:digit:]": ["\\p{Nd}", true],
	"[:graph:]": ["\\p{Z}\\p{C}", true, true],
	"[:lower:]": ["\\p{Ll}", true],
	"[:print:]": ["\\p{C}", true],
	"[:punct:]": ["\\p{P}", true],
	"[:space:]": ["\\p{Z}\\t\\r\\n\\v\\f", true],
	"[:upper:]": ["\\p{Lu}", true],
	"[:word:]": ["\\p{L}\\p{Nl}\\p{Nd}\\p{Pc}", true],
	"[:xdigit:]": ["A-Fa-f0-9", false],
};

// only need to escape a few things inside of brace expressions
// escapes: [ \ ] -
const braceEscape = (s: string): string => s.replace(/[[\]\\-]/g, "\\$&");
// escape all regexp magic characters
const regexpEscape = (s: string): string => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

// everything has already been escaped, we just have to join
const rangesToString = (ranges: Array<string>): string => ranges.join("");

/**
 * Tuple returned by {@link parseClass}: regexp source, whether `/u` is
 * required, how many characters were consumed, and whether the class is magic.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type ParseClassResult = [src: string, uFlag: boolean, consumed: number, hasMagic: boolean];

/**
 * Compile a glob `[...]` class at `position` into regexp source.
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
 *
 * console.log(parseClass("[a-z]", 0)) // ["[a-z]", false, 5, true]
 * console.log(parseClass("[_]", 0)) // ["_", false, 3, false]
 * try {
 *   parseClass("a", 0)
 * } catch (error) {
 *   console.log(error instanceof Error && error.message) // "not in a brace expression"
 * }
 * ```
 *
 * @throws `Error` with message `not in a brace expression` when `glob[position]` is not `"["`.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const parseClass = (glob: string, position: number): ParseClassResult => {
	const pos = position;
	if (glob.charAt(pos) !== "[") {
		throw new Error("not in a brace expression");
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
			for (const [cls, [unip, u, neg]] of Object.entries(posixClasses)) {
				if (glob.startsWith(cls, i)) {
					// invalid, [a-[] is fine, but not [a-[:alpha]]
					if (rangeStart) {
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
		if (rangeStart) {
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
		if (glob.startsWith("-]", i + 1)) {
			ranges.push(braceEscape(`${c}-`));
			i += 2;
			continue;
		}
		if (glob.startsWith("-", i + 1)) {
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
	if (!ranges.length && !negs.length) {
		return ["$.", false, glob.length - pos, true];
	}

	// if we got one positive range, and it's a single character, then that's
	// not actually a magic pattern, it's just that one literal character.
	// we should not treat that as "magic", we should just return the literal
	// character. [_] is a perfectly valid way to escape glob magic chars.
	const soleRange = ranges[0];
	if (negs.length === 0 && ranges.length === 1 && soleRange !== undefined && /^\\?.$/.test(soleRange) && !negate) {
		const r = soleRange.length === 2 ? soleRange.slice(-1) : soleRange;
		return [regexpEscape(r), false, endPos - pos, false];
	}

	const sranges = `[${negate ? "^" : ""}${rangesToString(ranges)}]`;
	const snegs = `[${negate ? "" : "^"}${rangesToString(negs)}]`;
	const comb = ranges.length && negs.length ? `(${sranges}|${snegs})` : ranges.length ? sranges : snegs;

	return [comb, uflag, endPos - pos, true];
};
