/**
 * Strict SemVer 2.0.0 recursive-descent parser and printer.
 *
 * Parsing is pure and total: failures propagate as a private exception
 * carrying the failure position and are converted to `ParseResult` at the
 * three entry points. The concept modules (`SemVer`, `Range`, `Comparator`)
 * construct their own domain errors from that result. Rejects `v`/`V`
 * prefixes, `=` prefixes on versions, leading zeros on numeric identifiers,
 * and unsafe integers. Input must be fully consumed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { Schema } from "effect";
import type { PartialParts } from "./desugar.ts";
import { desugarCaret, desugarHyphen, desugarTilde, desugarXRange } from "./desugar.ts";
import type { ComparatorOperator, ComparatorParts, VersionParts } from "./order.ts";

const $I = $ScratchpadId.create("semver/internal/grammar");

/**
 * Outcome of a grammar entry point: parsed value or input plus failure
 * position. Domain modules wrap `ok: false` into their tagged errors;
 * `ParseFailure` itself never escapes these entry points.
 *
 * **Example** (Build a string parse-result schema)
 *
 * ```ts
 * import { ParseResult } from "../../../semver/internal/grammar.ts"
 * import { Schema } from "effect"
 *
 * const StringParseResult = ParseResult(Schema.String)
 * console.log(Schema.is(StringParseResult)({ ok: true, value: "1.2.3" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ParseResult = <Value extends Schema.Top>(value: Value) =>
  Schema.Union([
    Schema.Struct({ ok: Schema.Literal(true), value }),
    Schema.Struct({ ok: Schema.Literal(false), input: Schema.String, position: Schema.Finite }),
  ]).pipe(
    $I.annoteSchema("ParseResult", {
      description: "A successful parsed value or the original input and failure position.",
    })
  );

/**
 * Structural outcome of a SemVer grammar entry point.
 *
 * @see {@link ParseResult} for the runtime schema builder.
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

const advance = (s: ParserState): string | undefined => {
  if (s.pos < s.len) {
    const ch = s.input[s.pos];
    s.pos++;
    return ch;
  }
  return undefined;
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
    const ch = advance(s) ?? "";
    if (!isDigit(ch)) {
      hasNonDigit = true;
    }
    token += ch;
  }

  if (token.length === 0) {
    return fail(s);
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
    token += advance(s) ?? "";
  }

  if (token.length === 0) {
    return fail(s);
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
 * Parse a strict SemVer 2.0.0 version string. Rejects `v`/`V` and `=`
 * prefixes, leading zeros on numeric identifiers, unsafe integers, partial
 * versions (`1`, `1.2`), dist-tags, and leftover input. Range sugar
 * (`^`, `~`, `x`, hyphen, `||`) is not accepted — that is {@link parseRange}.
 *
 * **Gotchas**
 *
 * Surrounding whitespace is trimmed before parsing (`" 1.2.3"` succeeds),
 * matching node-semver's constructor. {@link SemVer.isValid} and
 * {@link SemVer.ExactVersionString} reject the same padded string. There is
 * no `coerce` / loose mode: `v1.2.3`, `=1.0.0`, `01.2.3`, and `1.2` all
 * fail.
 *
 * **Example** (Accept a canonical version and reject a `v` prefix)
 *
 * ```ts
 * import { parseVersion } from "../../../semver/internal/grammar.ts";
 *
 * const ok = parseVersion("1.2.3");
 * console.log(ok.ok ? ok.value.major : 0);
 * // => 1
 *
 * const prefixed = parseVersion("v1.2.3");
 * console.log(prefixed.ok);
 * // => false
 * ```
 *
 * @see {@link parseRange} when the input may contain range sugar rather than a single version.
 * @see {@link parseComparator} when the input is an operator plus a complete version.
 * @see {@link SemVer.parseResult} for the domain Result wrapper around this entry point.
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

const parseOperator = (s: ParserState): string | null => {
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
    if (atRangeEnd(s)) break;

    const next = parseSimple(s);
    for (const c of next) {
      comparators.push(c);
    }
  }

  return comparators;
};

/**
 * Parse a range expression into comparator sets (OR of ANDs). The empty
 * string parses as the match-all range.
 *
 * **Gotchas**
 *
 * Input is trimmed before parsing. `""` (and whitespace-only) is match-all
 * (`>=0.0.0`), while {@link parseVersion} rejects an empty string. Ruby `~>`
 * is rejected. Caret, tilde, X-range, hyphen, and `||` are desugared here —
 * they are not accepted by {@link parseVersion} or {@link parseComparator}.
 *
 * **Example** (Desugar a caret range and reject Ruby `~>`)
 *
 * ```ts
 * import { formatRange, parseRange } from "../../../semver/internal/grammar.ts";
 *
 * const ok = parseRange("^1.0.0");
 * console.log(ok.ok ? formatRange(ok.value) : "");
 * // => ">=1.0.0 <2.0.0-0"
 *
 * const ruby = parseRange("~>1.0.0");
 * console.log(ruby.ok);
 * // => false
 * ```
 *
 * @see {@link parseVersion} for strict versions with no range sugar.
 * @see {@link parseComparator} for a single operator plus a complete version.
 * @see {@link Range.FromString} for the schema codec that wraps this parser.
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
    operator: (operator ?? "=") as ComparatorOperator,
    version: { major, minor, patch, prerelease, build },
  };
};

/**
 * Parse a single comparator string (optional operator + complete version).
 * Wildcards and range sugar are not allowed; a missing operator means `=`.
 *
 * **Gotchas**
 *
 * Input is trimmed before parsing. `^1.2.3`, `~1.2.3`, `1.x`, and hyphen
 * ranges fail here and belong on {@link parseRange}. A missing operator is
 * stored as `=`; {@link formatComparator} omits that `=` on the way out.
 *
 * **Example** (Parse an inequality and reject range sugar)
 *
 * ```ts
 * import { parseComparator } from "../../../semver/internal/grammar.ts";
 *
 * const ok = parseComparator(">=1.2.3");
 * console.log(ok.ok ? ok.value.operator : "");
 * // => ">="
 *
 * const sugar = parseComparator("^1.2.3");
 * console.log(sugar.ok);
 * // => false
 * ```
 *
 * @see {@link parseVersion} for a version with no operator prefix.
 * @see {@link parseRange} for wildcards and range sugar.
 * @see {@link formatComparator} for the matching printer, which drops `=`.
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
 * Print a version as `major.minor.patch[-prerelease][+build]`.
 *
 * **Example** (Round-trip a prerelease with build metadata)
 *
 * ```ts
 * import { formatVersion } from "../../../semver/internal/grammar.ts";
 *
 * const printed = formatVersion({
 *   major: 1,
 *   minor: 2,
 *   patch: 3,
 *   prerelease: ["rc", 1],
 *   build: ["build"],
 * });
 * console.log(printed);
 * // => "1.2.3-rc.1+build"
 * ```
 *
 * @see {@link parseVersion} for the matching parser.
 * @see {@link SemVer.FromString} for the schema codec whose encode direction uses this printer.
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
 * Print a comparator; the `=` operator is implicit.
 *
 * **Gotchas**
 *
 * `=1.2.3` round-trips as `1.2.3`. The parse still stores `operator: "="`.
 *
 * **Example** (Drop implicit `=` and keep an inequality)
 *
 * ```ts
 * import { formatComparator } from "../../../semver/internal/grammar.ts";
 *
 * const eq = formatComparator({
 *   operator: "=",
 *   version: { major: 1, minor: 2, patch: 3, prerelease: [], build: [] },
 * });
 * console.log(eq);
 * // => "1.2.3"
 *
 * const gte = formatComparator({
 *   operator: ">=",
 *   version: { major: 1, minor: 2, patch: 3, prerelease: [], build: [] },
 * });
 * console.log(gte);
 * // => ">=1.2.3"
 * ```
 *
 * @see {@link parseComparator} for the matching parser, which treats a missing operator as `=`.
 * @category formatting
 * @since 0.0.0
 */
export const formatComparator = (c: ComparatorParts): string => {
  const op = c.operator === "=" ? "" : c.operator;
  return `${op}${formatVersion(c.version)}`;
};

/**
 * Print comparator sets as `a b || c d`.
 *
 * **Example** (Print an OR of two AND-sets)
 *
 * ```ts
 * import { formatRange } from "../../../semver/internal/grammar.ts";
 *
 * const printed = formatRange([
 *   [
 *     {
 *       operator: ">=",
 *       version: { major: 1, minor: 0, patch: 0, prerelease: [], build: [] },
 *     },
 *     {
 *       operator: "<",
 *       version: { major: 2, minor: 0, patch: 0, prerelease: [0], build: [] },
 *     },
 *   ],
 * ]);
 * console.log(printed);
 * // => ">=1.0.0 <2.0.0-0"
 * ```
 *
 * @see {@link parseRange} for the matching parser.
 * @see {@link Range.FromString} for the schema codec whose encode direction uses this printer.
 * @category formatting
 * @since 0.0.0
 */
export const formatRange = (sets: ReadonlyArray<ReadonlyArray<ComparatorParts>>): string =>
  sets.map((set) => set.map(formatComparator).join(" ")).join(" || ");
