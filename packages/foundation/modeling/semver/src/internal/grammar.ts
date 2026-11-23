import * as A from "effect/Array";
import { dual, flow, identity, pipe } from "effect/Function";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { desugarCaret, desugarHyphen, desugarTilde, desugarXRange } from "./desugar.ts";
import { ComparatorParts, VersionParts } from "./order.ts";
import type { PartialParts } from "./desugar.ts";
import type { ComparatorOperator } from "./order.ts";

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
  readonly len: number;
  pos: number;
}

// decision: grammar-private-parse-failure
class ParseFailure {
  readonly position: number;

  constructor(position: number) {
    this.position = position;
  }
}

const fail: {
  (s: ParserState, position?: number): never;
  (position?: number): (s: ParserState) => never;
} = dual(
  (args) => P.isObjectKeyword(args[0]),
  (s: ParserState, position?: number): never => {
    throw new ParseFailure(position ?? s.pos);
  }
);

const peek = (s: ParserState): string | undefined => (s.pos < s.len ? s.input[s.pos] : undefined);

const advanceCheckedChar = (s: ParserState): string => {
  const ch = Str.slice(s.pos, s.pos + 1)(s.input);
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

const accept = (s: ParserState, ch: string): boolean => {
  if (peek(s) !== ch) return false;
  s.pos++;
  return true;
};

const toNumericIdentifier = (s: ParserState, start: number, digits: string): number => {
  const value = Number(digits);
  if ((digits.length > 1 && digits[0] === "0") || !Number.isSafeInteger(value)) {
    s.pos = start;
    return fail(s, start);
  }
  return value;
};

const scanIdentifier = (s: ParserState): string => {
  if (!peekIdentChar(s)) {
    return fail(s);
  }
  let token = "";
  while (peekIdentChar(s)) {
    token += advanceCheckedChar(s);
  }
  return token;
};

const nonDigitPattern = /[^0-9]/;

const parseNumericIdentifier = (s: ParserState): number => {
  const start = s.pos;
  if (!peekDigit(s)) {
    return fail(s);
  }

  let digits = "";
  while (peekDigit(s)) {
    digits += advanceCheckedChar(s);
  }

  return toNumericIdentifier(s, start, digits);
};

const parsePrereleaseIdentifier = (s: ParserState): string | number => {
  const start = s.pos;
  const token = scanIdentifier(s);
  return nonDigitPattern.test(token) ? token : toNumericIdentifier(s, start, token);
};

const parseBuildIdentifier = scanIdentifier;

const parsePreRelease = (s: ParserState): Array<string | number> => {
  const identifiers: Array<string | number> = [];

  identifiers.push(parsePrereleaseIdentifier(s));

  while (!atEnd(s) && peek(s) === ".") {
    advanceCheckedChar(s);
    identifiers.push(parsePrereleaseIdentifier(s));
  }

  return identifiers;
};

const parseBuild = (s: ParserState): Array<string> => {
  const identifiers: Array<string> = [];

  identifiers.push(parseBuildIdentifier(s));

  while (!atEnd(s) && peek(s) === ".") {
    advanceCheckedChar(s);
    identifiers.push(parseBuildIdentifier(s));
  }

  return identifiers;
};

const parseVersionBody = (s: ParserState): VersionParts => {
  const major = parseNumericIdentifier(s);

  if (peek(s) !== ".") {
    return fail(s);
  }
  advanceCheckedChar(s);

  const minor = parseNumericIdentifier(s);

  if (peek(s) !== ".") {
    return fail(s);
  }
  advanceCheckedChar(s);

  const patch = parseNumericIdentifier(s);

  let prerelease: Array<string | number> = [];
  if (!atEnd(s) && peek(s) === "-") {
    advanceCheckedChar(s);
    prerelease = parsePreRelease(s);
  }

  let build: Array<string> = [];
  if (!atEnd(s) && peek(s) === "+") {
    advanceCheckedChar(s);
    build = parseBuild(s);
  }

  if (!atEnd(s)) {
    return fail(s);
  }

  return VersionParts.make({ major, minor, patch, prerelease, build });
};

const catchParseFailureAtEntryPoint = <A>(trimmed: string, core: (s: ParserState) => A): ParseResult<A> => {
  const s: ParserState = { input: trimmed, pos: 0, len: trimmed.length };
  return Result.getOrElse(
    Result.try((): ParseResult<A> => ({ ok: true, value: core(s) })),
    (failure): ParseResult<A> => {
      if (failure instanceof ParseFailure) {
        return { ok: false, input: trimmed, position: failure.position };
      }
      throw failure;
    }
  );
};

const parseVersionCore = (s: ParserState): VersionParts => {
  const first = peek(s);
  if (first === "v" || first === "V" || first === "=") {
    return fail(s, 0);
  }

  return parseVersionBody(s);
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
 * import { parseVersion } from "@beep/semver/internal/grammar"
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
  const trimmed = Str.trim(raw);

  if (trimmed.length === 0) {
    return { ok: false, input: raw, position: 0 };
  }

  return catchParseFailureAtEntryPoint(trimmed, parseVersionCore);
};

const parseXR = (s: ParserState): number | null => {
  const ch = peek(s);
  if (ch === "x" || ch === "X" || ch === "*") {
    advanceCheckedChar(s);
    return null;
  }
  return parseNumericIdentifier(s);
};

const finishPartial = (
  s: ParserState,
  major: number | null,
  minor: number | null,
  patch: number | null
): PartialParts =>
  patch === null
    ? { major, minor, patch, prerelease: [], build: [] }
    : {
        major,
        minor,
        patch,
        prerelease: accept(s, "-") ? parsePreRelease(s) : [],
        build: accept(s, "+") ? parseBuild(s) : [],
      };

const parsePartial = (s: ParserState): PartialParts => {
  const major = parseXR(s);
  if (!accept(s, ".")) {
    return finishPartial(s, major, null, null);
  }
  const minor = parseXR(s);
  return finishPartial(s, major, minor, accept(s, ".") ? parseXR(s) : null);
};

const parseRelation = (
  s: ParserState,
  strict: ComparatorOperator,
  inclusive: ComparatorOperator
): ComparatorOperator => (accept(s, "=") ? inclusive : strict);

const parseOperator = (s: ParserState): ComparatorOperator | null => {
  if (accept(s, ">")) return parseRelation(s, ">", ">=");
  if (accept(s, "<")) return parseRelation(s, "<", "<=");
  return accept(s, "=") ? "=" : null;
};

const skipSpaces = (s: ParserState): void => {
  while (!atEnd(s) && peek(s) === " ") {
    advanceCheckedChar(s);
  }
};

const isHyphenRange = (s: ParserState): boolean =>
  s.pos + 2 < s.len && s.input[s.pos] === " " && s.input[s.pos + 1] === "-" && s.input[s.pos + 2] === " ";

const isOrSeparator = (s: ParserState): boolean => {
  let pos = s.pos;
  while (pos < s.len && s.input[pos] === " ") {
    pos++;
  }
  return pos + 1 < s.len && s.input[pos] === "|" && s.input[pos + 1] === "|";
};

const consumeOrSeparator = (s: ParserState): void => {
  skipSpaces(s);
  advanceCheckedChar(s);
  advanceCheckedChar(s);
  skipSpaces(s);
};

const isMalformedPartial = (partial: PartialParts): boolean =>
  (partial.major === null && (partial.minor !== null || partial.patch !== null)) ||
  (partial.minor === null && partial.patch !== null);

const parsePrimitive = (s: ParserState): ReadonlyArray<ComparatorParts> => {
  const operator = parseOperator(s);
  const partial = parsePartial(s);
  return isMalformedPartial(partial) ? fail(s) : desugarXRange(operator, partial);
};

const parseTilde = (s: ParserState): ReadonlyArray<ComparatorParts> =>
  peek(s) === ">" ? fail(s) : desugarTilde(parsePartial(s));

const parseSimple = (s: ParserState): ReadonlyArray<ComparatorParts> => {
  if (accept(s, "~")) return parseTilde(s);
  if (accept(s, "^")) return desugarCaret(parsePartial(s));
  return parsePrimitive(s);
};

const atRangeEnd = (s: ParserState): boolean => atEnd(s) || isOrSeparator(s);

const parseRangeComparators = (s: ParserState): ReadonlyArray<ComparatorParts> => {
  skipSpaces(s);

  const posBeforeHyphenAttempt = s.pos;
  const hyphenAttempt = Result.try(() => {
    const lower = parsePartial(s);
    if (!isHyphenRange(s)) {
      return fail(s);
    }
    advanceCheckedChar(s);
    advanceCheckedChar(s);
    advanceCheckedChar(s);
    const upper = parsePartial(s);
    return desugarHyphen(lower, upper);
  });
  if (Result.isSuccess(hyphenAttempt)) return hyphenAttempt.success;
  if (!(hyphenAttempt.failure instanceof ParseFailure)) {
    return Result.getOrThrowWith(hyphenAttempt, identity);
  }
  s.pos = posBeforeHyphenAttempt;

  const comparators: Array<ComparatorParts> = [];

  const first = parseSimple(s);
  for (const c of first) {
    comparators.push(c);
  }

  while (!atRangeEnd(s)) {
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
 * import { parseRange, formatRange } from "@beep/semver/internal/grammar"
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
  const trimmed = Str.trim(raw);

  if (Str.isEmpty(trimmed)) {
    return {
      ok: true,
      value: [desugarXRange(null, { major: null, minor: null, patch: null, prerelease: [], build: [] })],
    };
  }

  return catchParseFailureAtEntryPoint(trimmed, (s): ReadonlyArray<ReadonlyArray<ComparatorParts>> => {
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

    return sets;
  });
};

const parseComparatorCore = (s: ParserState): ComparatorParts => {
  const operator = parseOperator(s);

  const ch = peek(s);
  if (ch === ">" || ch === "<" || ch === "=") {
    return fail(s);
  }

  const version = parseVersionBody(s);

  return ComparatorParts.make({ operator: operator ?? "=", version });
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
 * import { parseComparator } from "@beep/semver/internal/grammar"
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
  const trimmed = Str.trim(raw);

  if (trimmed.length === 0) {
    return { ok: false, input: raw, position: 0 };
  }

  return catchParseFailureAtEntryPoint(trimmed, parseComparatorCore);
};

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
 * import { formatVersion } from "@beep/semver/internal/grammar"
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
export const formatVersion = (v: typeof VersionParts.Encoded): string => {
  let s = `${v.major}.${v.minor}.${v.patch}`;
  if (v.prerelease.length > 0) {
    s += `-${pipe(v.prerelease, A.map(String), A.join("."))}`;
  }
  if (v.build.length > 0) {
    s += `+${A.join(v.build, ".")}`;
  }
  return s;
};

/**
 * Prints a comparator with its version, leaving the `=` operator implicit.
 *
 * **Example** (Print equality without an operator)
 *
 * ```ts
 * import { formatComparator } from "@beep/semver/internal/grammar"
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
export const formatComparator = (c: typeof ComparatorParts.Encoded): string => {
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
 * import { formatRange, parseRange } from "@beep/semver/internal/grammar"
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
export const formatRange: (sets: ReadonlyArray<ReadonlyArray<typeof ComparatorParts.Encoded>>) => string = flow(
  A.map(flow(A.map(formatComparator), A.join(" "))),
  A.join(" || ")
);
