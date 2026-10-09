// Strict SemVer 2.0.0 recursive-descent parser and printer.
//
// Plain synchronous code: parsing is pure and total, so an Effect wrapper would
// add ceremony without value. Failures propagate as a private exception
// carrying the failure position and are converted to `ParseResult` at the three
// entry points; the concept modules (`SemVer`, `Range`, `Comparator`) construct
// their own domain errors from that result. The same low-level parsers serve
// every entry point without threading error constructors through.
//
// Rejects `v`/`V` prefixes, `=` prefixes on versions, leading zeros on
// numeric identifiers, and unsafe integers. Input must be fully consumed.

import type { PartialParts } from "./desugar.ts";
import { desugarCaret, desugarHyphen, desugarTilde, desugarXRange } from "./desugar.ts";
import type { ComparatorOperator, ComparatorParts, VersionParts } from "./order.ts";

/**
 * Outcome of a grammar entry point: parsed value or input + failure position.
 *
 * **Details**
 *
 * On failure, `position` is a zero-based offset into `input`; narrow on `ok` to access the parsed value or diagnostic.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ParseResult<A> =
	| { readonly ok: true; readonly value: A }
	| { readonly ok: false; readonly input: string; readonly position: number };

interface ParserState {
	readonly input: string;
	pos: number;
	readonly len: number;
}

/** Private control-flow exception; never escapes the entry points. */
class ParseFailure {
	readonly position: number;

	constructor(position: number) {
		this.position = position;
	}
}

const fail = (s: ParserState, position?: number): never => {
	throw new ParseFailure(position ?? s.pos);
};

const peek = (s: ParserState): string | undefined => (s.pos < s.len ? s.input[s.pos] : undefined);

// Every caller has already checked the next character (or separator width).
const advance = (s: ParserState): string => {
	const ch = s.input.charAt(s.pos);
	s.pos++;
	return ch;
};

const isDigit = (ch: string): boolean => ch >= "0" && ch <= "9";

const isLetter = (ch: string): boolean => (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");

const isIdentChar = (ch: string): boolean => isDigit(ch) || isLetter(ch) || ch === "-";

const atEnd = (s: ParserState): boolean => s.pos >= s.len;

const peekDigit = (s: ParserState): boolean => {
	const ch = peek(s);
	return ch !== undefined && isDigit(ch);
};

const peekIdentChar = (s: ParserState): boolean => {
	const ch = peek(s);
	return ch !== undefined && isIdentChar(ch);
};

// ---------------------------------------------------------------------------
// Low-level token parsers
// ---------------------------------------------------------------------------

const parseNumericIdentifier = (s: ParserState): number => {
	const start = s.pos;
	const first = peek(s);
	if (first === undefined || !isDigit(first)) {
		return fail(s);
	}

	let digits = "";
	while (peekDigit(s)) {
		digits += advance(s);
	}

	// Reject leading zeros (except "0" itself)
	if (digits.length > 1 && digits[0] === "0") {
		s.pos = start;
		return fail(s, start);
	}

	const value = Number(digits);
	if (!Number.isSafeInteger(value)) {
		s.pos = start;
		return fail(s, start);
	}

	return value;
};

const parsePrereleaseIdentifier = (s: ParserState): string | number => {
	const start = s.pos;
	let token = "";
	let hasNonDigit = false;

	const first = peek(s);
	if (first === undefined || !isIdentChar(first)) {
		return fail(s);
	}

	while (peekIdentChar(s)) {
		const ch = advance(s);
		if (!isDigit(ch)) {
			hasNonDigit = true;
		}
		token += ch;
	}

	if (hasNonDigit) {
		// Alphanumeric identifier — no leading zero restriction
		return token;
	}

	// All digits — numeric identifier, check leading zeros
	if (token.length > 1 && token[0] === "0") {
		s.pos = start;
		return fail(s, start);
	}

	const value = Number(token);
	if (!Number.isSafeInteger(value)) {
		s.pos = start;
		return fail(s, start);
	}

	return value;
};

const parseBuildIdentifier = (s: ParserState): string => {
	let token = "";

	const first = peek(s);
	if (first === undefined || !isIdentChar(first)) {
		return fail(s);
	}

	while (peekIdentChar(s)) {
		token += advance(s);
	}

	// Build identifiers allow leading zeros — just return as string
	return token;
};

const parsePreRelease = (s: ParserState): Array<string | number> => {
	const identifiers: Array<string | number> = [];

	identifiers.push(parsePrereleaseIdentifier(s));

	while (!atEnd(s) && peek(s) === ".") {
		advance(s); // consume '.'
		identifiers.push(parsePrereleaseIdentifier(s));
	}

	return identifiers;
};

const parseBuild = (s: ParserState): Array<string> => {
	const identifiers: Array<string> = [];

	identifiers.push(parseBuildIdentifier(s));

	while (!atEnd(s) && peek(s) === ".") {
		advance(s); // consume '.'
		identifiers.push(parseBuildIdentifier(s));
	}

	return identifiers;
};

// ---------------------------------------------------------------------------
// Version entry point
// ---------------------------------------------------------------------------

const parseVersionCore = (s: ParserState): VersionParts => {
	// Reject v/V prefix and = prefix
	const first = peek(s);
	if (first === "v" || first === "V" || first === "=") {
		return fail(s, 0);
	}

	const major = parseNumericIdentifier(s);

	if (peek(s) !== ".") {
		return fail(s);
	}
	advance(s); // consume '.'

	const minor = parseNumericIdentifier(s);

	if (peek(s) !== ".") {
		return fail(s);
	}
	advance(s); // consume '.'

	const patch = parseNumericIdentifier(s);

	// Optional prerelease
	let prerelease: Array<string | number> = [];
	if (!atEnd(s) && peek(s) === "-") {
		advance(s); // consume '-'
		prerelease = parsePreRelease(s);
	}

	// Optional build
	let build: Array<string> = [];
	if (!atEnd(s) && peek(s) === "+") {
		advance(s); // consume '+'
		build = parseBuild(s);
	}

	// Verify entire input consumed
	if (!atEnd(s)) {
		return fail(s);
	}

	return { major, minor, patch, prerelease, build };
};

/**
 * Parses a strict SemVer 2.0.0 version string into structural version parts.
 *
 * **Details**
 *
 * Surrounding whitespace is trimmed. A nonempty failing input reports its position in the trimmed string; an empty input reports the original string and position zero.
 *
 * **Gotchas**
 *
 * The entire trimmed input must be consumed. Version prefixes `v`, `V`, and `=` are rejected, as are leading zeros in numeric identifiers and integers outside the safe range. Build identifiers may contain leading zeros.
 *
 * **Example** (Accept a strict version and reject a prefix)
 *
 * ```ts
 * import { parseVersion } from "@beep/scratchpad/effected/semver/internal/grammar"
 *
 * const parsed = parseVersion(" 1.2.3-alpha.1+build.01 ")
 * if (parsed.ok) {
 *   console.log(parsed.value.prerelease.join(".")) // alpha.1
 * }
 * console.log(parseVersion("v1.2.3").ok) // false
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseVersion = (raw: string): ParseResult<VersionParts> => {
	const trimmed = raw.trim();

	if (trimmed.length === 0) {
		return { ok: false, input: raw, position: 0 };
	}

	const s: ParserState = { input: trimmed, pos: 0, len: trimmed.length };
	try {
		return { ok: true, value: parseVersionCore(s) };
	} catch (failure) {
		if (failure instanceof ParseFailure) {
			return { ok: false, input: trimmed, position: failure.position };
		}
		throw failure;
	}
};

// ---------------------------------------------------------------------------
// Range parsing
// ---------------------------------------------------------------------------

const parseXR = (s: ParserState): number | null => {
	const ch = peek(s);
	if (ch === "x" || ch === "X" || ch === "*") {
		advance(s);
		return null;
	}
	return parseNumericIdentifier(s);
};

const parsePartial = (s: ParserState): PartialParts => {
	const major = parseXR(s);

	let minor: number | null = null;
	let patch: number | null = null;
	let prerelease: Array<string | number> = [];
	let build: Array<string> = [];

	if (!atEnd(s) && peek(s) === ".") {
		advance(s);
		minor = parseXR(s);

		if (!atEnd(s) && peek(s) === ".") {
			advance(s);
			patch = parseXR(s);

			// Optional prerelease (only if patch is numeric, not wildcard)
			if (patch !== null && !atEnd(s) && peek(s) === "-") {
				advance(s);
				prerelease = parsePreRelease(s);
			}

			// Optional build
			if (patch !== null && !atEnd(s) && peek(s) === "+") {
				advance(s);
				build = parseBuild(s);
			}
		}
	}

	return { major, minor, patch, prerelease, build };
};

const parseOperator = (s: ParserState): ComparatorOperator | null => {
	const ch = peek(s);
	if (ch === ">") {
		advance(s);
		if (peek(s) === "=") {
			advance(s);
			return ">=";
		}
		return ">";
	}
	if (ch === "<") {
		advance(s);
		if (peek(s) === "=") {
			advance(s);
			return "<=";
		}
		return "<";
	}
	if (ch === "=") {
		advance(s);
		return "=";
	}
	return null;
};

const skipSpaces = (s: ParserState): void => {
	while (!atEnd(s) && peek(s) === " ") {
		advance(s);
	}
};

const isHyphenRange = (s: ParserState): boolean =>
	s.pos + 2 < s.len && s.input[s.pos] === " " && s.input[s.pos + 1] === "-" && s.input[s.pos + 2] === " ";

const isOrSeparator = (s: ParserState): boolean => {
	// Skip optional leading spaces, then check for ||
	let pos = s.pos;
	while (pos < s.len && s.input[pos] === " ") {
		pos++;
	}
	return pos + 1 < s.len && s.input[pos] === "|" && s.input[pos + 1] === "|";
};

const consumeOrSeparator = (s: ParserState): void => {
	while (!atEnd(s) && peek(s) === " ") {
		advance(s);
	}
	advance(s); // first |
	advance(s); // second |
	while (!atEnd(s) && peek(s) === " ") {
		advance(s);
	}
};

const parseSimple = (s: ParserState): ReadonlyArray<ComparatorParts> => {
	const ch = peek(s);

	if (ch === "~") {
		advance(s);
		// Reject ~> (Ruby-style)
		if (peek(s) === ">") {
			return fail(s);
		}
		const partial = parsePartial(s);
		return desugarTilde(partial);
	}

	if (ch === "^") {
		advance(s);
		const partial = parsePartial(s);
		return desugarCaret(partial);
	}

	// Primitive: optional operator + partial
	const operator = parseOperator(s);
	const partial = parsePartial(s);
	return desugarXRange(operator, partial);
};

const atRangeEnd = (s: ParserState): boolean => {
	if (atEnd(s)) return true;
	// Check if we're at || separator
	let pos = s.pos;
	while (pos < s.len && s.input[pos] === " ") {
		pos++;
	}
	return pos + 1 < s.len && s.input[pos] === "|" && s.input[pos + 1] === "|";
};

const parseRangeComparators = (s: ParserState): ReadonlyArray<ComparatorParts> => {
	skipSpaces(s);

	// Try hyphen range first, backtracking on failure
	const savedPos = s.pos;
	try {
		const lower = parsePartial(s);
		if (!isHyphenRange(s)) {
			return fail(s);
		}
		advance(s); // space
		advance(s); // -
		advance(s); // space
		const upper = parsePartial(s);
		return desugarHyphen(lower, upper);
	} catch (failure) {
		if (!(failure instanceof ParseFailure)) {
			throw failure;
		}
		// Not a hyphen range — reset and parse space-separated simples
		s.pos = savedPos;
	}

	const comparators: Array<ComparatorParts> = [];

	const first = parseSimple(s);
	for (const c of first) {
		comparators.push(c);
	}

	while (!atRangeEnd(s)) {
		// Expect at least one space between simples
		if (peek(s) !== " ") {
			break;
		}
		skipSpaces(s);

		const next = parseSimple(s);
		for (const c of next) {
			comparators.push(c);
		}
	}

	return comparators;
};

/**
 * Parses a range expression into comparator sets (OR of ANDs).
 *
 * **Details**
 *
 * The empty string parses as the match-all range. Surrounding whitespace is trimmed; caret, tilde, wildcard, and hyphen sugar expand into primitive comparators. Each inner set is a conjunction, and the outer array is a disjunction.
 *
 * **Gotchas**
 *
 * The entire trimmed input must be consumed. Spaces separate comparators within a set; Ruby-style `~>` is rejected.
 *
 * **Example** (Expand caret sugar and an empty range)
 *
 * ```ts
 * import { parseRange, formatRange } from "@beep/scratchpad/effected/semver/internal/grammar"
 *
 * const parsed = parseRange("^1.2.3")
 * if (parsed.ok) {
 *   console.log(formatRange(parsed.value)) // >=1.2.3 <2.0.0-0
 * }
 * const empty = parseRange("")
 * if (empty.ok) {
 *   console.log(empty.value.length) // 1
 *   console.log(empty.value[0]?.length) // 1
 * }
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseRange = (raw: string): ParseResult<ReadonlyArray<ReadonlyArray<ComparatorParts>>> => {
	const trimmed = raw.trim();

	if (trimmed.length === 0) {
		// Empty string = match all
		return {
			ok: true,
			value: [desugarXRange(null, { major: null, minor: null, patch: null, prerelease: [], build: [] })],
		};
	}

	const s: ParserState = { input: trimmed, pos: 0, len: trimmed.length };
	try {
		const sets: Array<ReadonlyArray<ComparatorParts>> = [];

		sets.push(parseRangeComparators(s));

		while (!atEnd(s)) {
			if (isOrSeparator(s)) {
				consumeOrSeparator(s);
				sets.push(parseRangeComparators(s));
			} else {
				break;
			}
		}

		if (!atEnd(s)) {
			return fail(s);
		}

		return { ok: true, value: sets };
	} catch (failure) {
		if (failure instanceof ParseFailure) {
			return { ok: false, input: trimmed, position: failure.position };
		}
		throw failure;
	}
};

// ---------------------------------------------------------------------------
// Comparator entry point
// ---------------------------------------------------------------------------

const parseComparatorCore = (s: ParserState): ComparatorParts => {
	const operator = parseOperator(s);

	// Reject things like >> or <>
	const ch = peek(s);
	if (ch === ">" || ch === "<" || ch === "=") {
		return fail(s);
	}

	// Parse full version (major.minor.patch required, no wildcards)
	const major = parseNumericIdentifier(s);

	if (peek(s) !== ".") {
		return fail(s);
	}
	advance(s);

	const minor = parseNumericIdentifier(s);

	if (peek(s) !== ".") {
		return fail(s);
	}
	advance(s);

	const patch = parseNumericIdentifier(s);

	let prerelease: Array<string | number> = [];
	if (!atEnd(s) && peek(s) === "-") {
		advance(s);
		prerelease = parsePreRelease(s);
	}

	let build: Array<string> = [];
	if (!atEnd(s) && peek(s) === "+") {
		advance(s);
		build = parseBuild(s);
	}

	if (!atEnd(s)) {
		return fail(s);
	}

	return {
		operator: operator ?? "=",
		version: { major, minor, patch, prerelease, build },
	};
};

/**
 * Parses a single comparator string (optional operator + complete version).
 *
 * **Details**
 *
 * A missing operator means `=`. Surrounding whitespace is trimmed.
 *
 * **Gotchas**
 *
 * Wildcards and range sugar are not allowed; all three numeric version components are required, and the entire trimmed input must be consumed.
 *
 * **Example** (Default to equality and reject wildcards)
 *
 * ```ts
 * import { parseComparator } from "@beep/scratchpad/effected/semver/internal/grammar"
 *
 * const parsed = parseComparator("1.2.3")
 * if (parsed.ok) {
 *   console.log(parsed.value.operator) // =
 * }
 * console.log(parseComparator(">=1.2.x").ok) // false
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseComparator = (raw: string): ParseResult<ComparatorParts> => {
	const trimmed = raw.trim();

	if (trimmed.length === 0) {
		return { ok: false, input: raw, position: 0 };
	}

	const s: ParserState = { input: trimmed, pos: 0, len: trimmed.length };
	try {
		return { ok: true, value: parseComparatorCore(s) };
	} catch (failure) {
		if (failure instanceof ParseFailure) {
			return { ok: false, input: trimmed, position: failure.position };
		}
		throw failure;
	}
};

// ---------------------------------------------------------------------------
// Printers (the encode direction of the FromString schemas)
// ---------------------------------------------------------------------------

/**
 * Prints a version as `major.minor.patch[-prerelease][+build]`.
 *
 * **Details**
 *
 * Prerelease and build identifiers are dot-separated; their suffixes are omitted when the corresponding arrays are empty.
 *
 * **Example** (Print prerelease and build identifiers)
 *
 * ```ts
 * import { formatVersion } from "@beep/scratchpad/effected/semver/internal/grammar"
 *
 * console.log(formatVersion({
 *   major: 1, minor: 2, patch: 3,
 *   prerelease: ["alpha", 1], build: ["build", "01"]
 * })) // 1.2.3-alpha.1+build.01
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const formatVersion = (v: VersionParts): string => {
	let s = `${v.major}.${v.minor}.${v.patch}`;
	if (v.prerelease.length > 0) {
		s += `-${v.prerelease.join(".")}`;
	}
	if (v.build.length > 0) {
		s += `+${v.build.join(".")}`;
	}
	return s;
};

/**
 * Prints a comparator with its version, leaving the `=` operator implicit.
 *
 * **Example** (Print equality without an operator)
 *
 * ```ts
 * import { formatComparator } from "@beep/scratchpad/effected/semver/internal/grammar"
 *
 * console.log(formatComparator({
 *   operator: "=",
 *   version: { major: 1, minor: 2, patch: 3, prerelease: [], build: [] }
 * })) // 1.2.3
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const formatComparator = (c: ComparatorParts): string => {
	const op = c.operator === "=" ? "" : c.operator;
	return `${op}${formatVersion(c.version)}`;
};

/**
 * Prints comparator sets as `a b || c d`.
 *
 * **Details**
 *
 * Comparators within a set are space-separated, and sets are separated by ` || `. An empty comparator set prints as an empty string.
 *
 * **Example** (Print a disjunction of comparator sets)
 *
 * ```ts
 * import { formatRange, parseRange } from "@beep/scratchpad/effected/semver/internal/grammar"
 *
 * const parsed = parseRange(">=1.2.3 <2.0.0 || 3.0.0")
 * if (parsed.ok) {
 *   console.log(formatRange(parsed.value)) // >=1.2.3 <2.0.0 || 3.0.0
 * }
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const formatRange = (sets: ReadonlyArray<ReadonlyArray<ComparatorParts>>): string =>
	sets.map((set) => set.map(formatComparator).join(" ")).join(" || ");
