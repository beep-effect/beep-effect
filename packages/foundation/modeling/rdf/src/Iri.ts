/**
 * RFC 3987 IRI schemas and validation helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RdfId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

// cspell:words ireg ucschar iprivate Ucschar Iprivate Iunreserved Isegment irelative Abempty Hier hier

const $I = $RdfId.create("iri");

/**
 * RFC 3987 coverage notes:
 *
 * - The schemas below encode the generic RFC 3987 section 2.2 syntax directly.
 * - RFC 3987 section 4.1's bidi-formatting prohibition is also enforced because
 *
 * - Section 3 IRI-to-URI mapping is intentionally not performed here because it
 *
 *
 * - The remaining guidance in sections 4, 5, 6, and 8 covers bidi presentation,
 *
 *
 *
 *
 */

type ParseEnd = number | undefined;
type CodePointPredicate = (codePoint: number) => boolean;

const COLON = 0x3a;
const DOT = 0x2e;
const FORWARD_SLASH = 0x2f;
const HASH = 0x23;
const PERCENT = 0x25;
const QUESTION_MARK = 0x3f;
const AT = 0x40;

const forbiddenBidiFormattingCodePoints = [
  0x200e, // LEFT-TO-RIGHT MARK
  0x200f, // RIGHT-TO-LEFT MARK
  0x202a, // LEFT-TO-RIGHT EMBEDDING
  0x202b, // RIGHT-TO-LEFT EMBEDDING
  0x202c, // POP DIRECTIONAL FORMATTING
  0x202d, // LEFT-TO-RIGHT OVERRIDE
  0x202e, // RIGHT-TO-LEFT OVERRIDE
] as const;

const ucscharRanges = [
  [0x00a0, 0xd7ff],
  [0xf900, 0xfdcf],
  [0xfdf0, 0xffef],
  [0x10000, 0x1fffd],
  [0x20000, 0x2fffd],
  [0x30000, 0x3fffd],
  [0x40000, 0x4fffd],
  [0x50000, 0x5fffd],
  [0x60000, 0x6fffd],
  [0x70000, 0x7fffd],
  [0x80000, 0x8fffd],
  [0x90000, 0x9fffd],
  [0xa0000, 0xafffd],
  [0xb0000, 0xbfffd],
  [0xc0000, 0xcfffd],
  [0xd0000, 0xdfffd],
  [0xe1000, 0xefffd],
] as const satisfies ReadonlyArray<readonly [number, number]>;

const iprivateRanges = [
  [0xe000, 0xf8ff],
  [0xf0000, 0xffffd],
  [0x100000, 0x10fffd],
] as const satisfies ReadonlyArray<readonly [number, number]>;

const slice = (input: string, start: number, end?: number): string => pipe(input, Str.slice(start, end));

const codePointAt = (input: string, index: number): number | undefined =>
  pipe(input, Str.codePointAt(index), O.getOrUndefined);

const findAsciiCharacter = (input: string, search: string, start = 0): number | undefined => {
  let index = start;

  while (index < Str.length(input)) {
    if (input[index] === search) {
      return index;
    }

    index += 1;
  }

  return undefined;
};

const findAsciiCharacterFromEnd = (input: string, search: string): number | undefined => {
  let index = Str.length(input) - 1;

  while (index >= 0) {
    if (input[index] === search) {
      return index;
    }

    index -= 1;
  }

  return undefined;
};

const countAsciiCharacter = (input: string, search: string): number => {
  let count = 0;
  let index = 0;

  while (index < Str.length(input)) {
    if (input[index] === search) {
      count += 1;
    }

    index += 1;
  }

  return count;
};

const findDoubleColon = (input: string, start = 0): number | undefined => {
  let index = start;

  while (index + 1 < Str.length(input)) {
    if (input[index] === ":" && input[index + 1] === ":") {
      return index;
    }

    index += 1;
  }

  return undefined;
};

const isCodePointInRanges = (codePoint: number, ranges: ReadonlyArray<readonly [number, number]>): boolean =>
  pipe(
    ranges,
    A.some(([start, end]) => codePoint >= start && codePoint <= end)
  );

const isAlpha = (codePoint: number): boolean =>
  (codePoint >= 0x41 && codePoint <= 0x5a) || (codePoint >= 0x61 && codePoint <= 0x7a);

const isDigit = (codePoint: number): boolean => codePoint >= 0x30 && codePoint <= 0x39;

const isHexDigit = (codePoint: number): boolean =>
  isDigit(codePoint) || (codePoint >= 0x41 && codePoint <= 0x46) || (codePoint >= 0x61 && codePoint <= 0x66);

const isAsciiUnreserved = (codePoint: number): boolean =>
  isAlpha(codePoint) ||
  isDigit(codePoint) ||
  codePoint === 0x2d ||
  codePoint === DOT ||
  codePoint === 0x5f ||
  codePoint === 0x7e;

const isSubDelim = (codePoint: number): boolean =>
  codePoint === 0x21 ||
  codePoint === 0x24 ||
  codePoint === 0x26 ||
  codePoint === 0x27 ||
  codePoint === 0x28 ||
  codePoint === 0x29 ||
  codePoint === 0x2a ||
  codePoint === 0x2b ||
  codePoint === 0x2c ||
  codePoint === 0x3b ||
  codePoint === 0x3d;

const isForbiddenBidiFormattingCodePoint = (codePoint: number): boolean =>
  pipe(
    forbiddenBidiFormattingCodePoints,
    A.some((candidate) => candidate === codePoint)
  );

const isUcschar = (codePoint: number): boolean => isCodePointInRanges(codePoint, ucscharRanges);

const isIprivate = (codePoint: number): boolean => isCodePointInRanges(codePoint, iprivateRanges);

const isIunreserved = (codePoint: number): boolean =>
  !isForbiddenBidiFormattingCodePoint(codePoint) && (isAsciiUnreserved(codePoint) || isUcschar(codePoint));

const isPctEncodedAt = (input: string, index: number): boolean => {
  const first = codePointAt(input, index + 1);
  const second = codePointAt(input, index + 2);

  return input[index] === "%" && first !== undefined && second !== undefined && isHexDigit(first) && isHexDigit(second);
};

const scanComponent = (
  input: string,
  start: number,
  allowCodePoint: CodePointPredicate,
  stopCodePoint: CodePointPredicate,
  minimumLength = 0
): ParseEnd => {
  let consumed = 0;
  let index = start;

  while (index < Str.length(input)) {
    const codePoint = codePointAt(input, index);

    /* istanbul ignore next -- loop bounds keep the code point lookup in range */
    if (codePoint === undefined) {
      return undefined;
    }

    const width = codePoint > 0xffff ? 2 : 1;

    if (stopCodePoint(codePoint)) {
      break;
    }

    if (codePoint === PERCENT) {
      if (!isPctEncodedAt(input, index)) {
        return undefined;
      }

      index += 3;
      consumed += 3;
      continue;
    }

    if (isForbiddenBidiFormattingCodePoint(codePoint)) {
      return undefined;
    }

    if (!allowCodePoint(codePoint)) {
      return undefined;
    }

    index += width;
    consumed += width;
  }

  /* istanbul ignore else -- callers gate required-empty segments before scanning */
  if (consumed >= minimumLength) {
    return index;
  }

  /* istanbul ignore next -- callers gate required-empty segments before scanning */
  return undefined;
};

const scanEntireComponent = (input: string, allowCodePoint: CodePointPredicate): boolean => {
  const end = scanComponent(input, 0, allowCodePoint, () => false);

  return end === Str.length(input);
};

const isValidPort = (input: string): boolean => scanEntireComponent(input, isDigit);

const isValidH16 = (input: string): boolean => {
  const length = Str.length(input);

  if (length < 1 || length > 4) {
    return false;
  }

  return scanEntireComponent(input, isHexDigit);
};

const isValidIPv4Octet = (input: string): boolean => {
  const length = Str.length(input);
  const firstCodePoint = codePointAt(input, 0);
  const secondCodePoint = codePointAt(input, 1);

  if (length === 1) {
    return firstCodePoint !== undefined && isDigit(firstCodePoint);
  }

  if (length === 2) {
    return input[0] >= "1" && input[0] <= "9" && secondCodePoint !== undefined && isDigit(secondCodePoint);
  }

  if (length !== 3) {
    return false;
  }

  const first = input[0];
  const second = input[1];
  const third = input[2];

  if (first === "1") {
    return second >= "0" && second <= "9" && third >= "0" && third <= "9";
  }

  if (first === "2" && second >= "0" && second <= "4") {
    return third >= "0" && third <= "9";
  }

  return first === "2" && second === "5" && third >= "0" && third <= "5";
};

const isValidIPv4Address = (input: string): boolean => {
  const octets = pipe(input, Str.split("."));

  if (octets.length !== 4) {
    return false;
  }

  return pipe(octets, A.every(isValidIPv4Octet));
};

const parseIpv6Side = (input: string, allowIpv4Tail: boolean): number | undefined => {
  if (Str.isEmpty(input)) {
    return 0;
  }

  const segments = pipe(input, Str.split(":"));
  let count = 0;
  let index = 0;

  for (const segment of segments) {
    if (Str.isEmpty(segment)) {
      return undefined;
    }

    const isLast = index === segments.length - 1;
    const hasDot = findAsciiCharacter(segment, ".") !== undefined;

    if (hasDot) {
      if (!allowIpv4Tail || !isLast || !isValidIPv4Address(segment)) {
        return undefined;
      }

      count += 2;
      index += 1;
      continue;
    }

    if (!isValidH16(segment)) {
      return undefined;
    }

    count += 1;
    index += 1;
  }

  return count;
};

const isValidIPv6Address = (input: string): boolean => {
  const doubleColonIndex = findDoubleColon(input);

  if (doubleColonIndex === undefined) {
    const count = parseIpv6Side(input, true);

    return count === 8;
  }

  if (findDoubleColon(input, doubleColonIndex + 2) !== undefined) {
    return false;
  }

  const left = slice(input, 0, doubleColonIndex);
  const right = slice(input, doubleColonIndex + 2);
  const rightIsEmpty = Str.isEmpty(right);
  const leftCount = parseIpv6Side(left, rightIsEmpty);
  const rightCount = parseIpv6Side(right, true);

  if (leftCount === undefined || rightCount === undefined) {
    return false;
  }

  return leftCount + rightCount < 8;
};

const isValidIPvFuture = (input: string): boolean => {
  if (Str.length(input) < 4 || input[0] !== "v") {
    return false;
  }

  let index = 1;

  while (index < Str.length(input)) {
    const codePoint = codePointAt(input, index);

    if (codePoint === undefined || !isHexDigit(codePoint)) {
      break;
    }

    index += 1;
  }

  if (index === 1 || input[index] !== ".") {
    return false;
  }

  const tail = slice(input, index + 1);

  return scanEntireComponent(
    tail,
    (codePoint) => isAsciiUnreserved(codePoint) || isSubDelim(codePoint) || codePoint === COLON
  );
};

const isValidIpLiteral = (input: string): boolean => isValidIPv6Address(input) || isValidIPvFuture(input);

const isValidIRegName = (input: string): boolean =>
  scanEntireComponent(input, (codePoint) => isIunreserved(codePoint) || isSubDelim(codePoint));

const isValidIUserInfo = (input: string): boolean =>
  scanEntireComponent(input, (codePoint) => isIunreserved(codePoint) || isSubDelim(codePoint) || codePoint === COLON);

const isValidHostPort = (input: string): boolean => {
  if (input[0] === "[") {
    const closeBracketIndex = findAsciiCharacter(input, "]");

    if (closeBracketIndex === undefined) {
      return false;
    }

    const host = slice(input, 1, closeBracketIndex);
    const remainder = slice(input, closeBracketIndex + 1);

    if (!isValidIpLiteral(host)) {
      return false;
    }

    if (Str.isEmpty(remainder)) {
      return true;
    }

    return remainder[0] === ":" && isValidPort(slice(remainder, 1));
  }

  if (countAsciiCharacter(input, ":") > 1) {
    return false;
  }

  const colonIndex = findAsciiCharacterFromEnd(input, ":");
  const host = colonIndex === undefined ? input : slice(input, 0, colonIndex);
  const port = colonIndex === undefined ? undefined : slice(input, colonIndex + 1);

  if (port !== undefined && !isValidPort(port)) {
    return false;
  }

  return isValidIPv4Address(host) || isValidIRegName(host);
};

const parseAuthority = (input: string, start: number): ParseEnd => {
  let end = start;

  while (end < Str.length(input)) {
    const character = input[end];

    if (character === "/" || character === "?" || character === "#") {
      break;
    }

    end += 1;
  }

  const authority = slice(input, start, end);
  const atCount = countAsciiCharacter(authority, "@");

  if (atCount > 1) {
    return undefined;
  }

  const atIndex = findAsciiCharacter(authority, "@");
  const userInfo = atIndex === undefined ? undefined : slice(authority, 0, atIndex);
  const hostPort = atIndex === undefined ? authority : slice(authority, atIndex + 1);

  if (userInfo !== undefined && !isValidIUserInfo(userInfo)) {
    return undefined;
  }

  return isValidHostPort(hostPort) ? end : undefined;
};

const parseIsegment = (input: string, start: number, minimumLength = 0, allowColon = true): ParseEnd =>
  scanComponent(
    input,
    start,
    (codePoint) =>
      isIunreserved(codePoint) || isSubDelim(codePoint) || codePoint === AT || (allowColon && codePoint === COLON),
    (codePoint) => codePoint === FORWARD_SLASH || codePoint === QUESTION_MARK || codePoint === HASH,
    minimumLength
  );

const parseIPathAbempty = (input: string, start: number): ParseEnd => {
  let index = start;

  while (index < Str.length(input) && input[index] === "/") {
    const segmentEnd = parseIsegment(input, index + 1);

    if (segmentEnd === undefined) {
      return undefined;
    }

    index = segmentEnd;
  }

  return index;
};

const parseIPathAbsolute = (input: string, start: number): ParseEnd => {
  let index = start + 1;

  if (index < Str.length(input) && input[index] !== "/" && input[index] !== "?" && input[index] !== "#") {
    const firstSegmentEnd = parseIsegment(input, index, 1);

    if (firstSegmentEnd === undefined) {
      return undefined;
    }

    index = firstSegmentEnd;

    while (index < Str.length(input) && input[index] === "/") {
      const segmentEnd = parseIsegment(input, index + 1);

      if (segmentEnd === undefined) {
        return undefined;
      }

      index = segmentEnd;
    }
  }

  return index;
};

const parseIPathRootless = (input: string, start: number): ParseEnd => {
  const firstSegmentEnd = parseIsegment(input, start, 1);

  if (firstSegmentEnd === undefined) {
    return undefined;
  }

  let index = firstSegmentEnd;

  while (index < Str.length(input) && input[index] === "/") {
    const segmentEnd = parseIsegment(input, index + 1);

    if (segmentEnd === undefined) {
      return undefined;
    }

    index = segmentEnd;
  }

  return index;
};

const parseIPathNoScheme = (input: string, start: number): ParseEnd => {
  const firstSegmentEnd = parseIsegment(input, start, 1, false);

  if (firstSegmentEnd === undefined) {
    return undefined;
  }

  let index = firstSegmentEnd;

  while (index < Str.length(input) && input[index] === "/") {
    const segmentEnd = parseIsegment(input, index + 1);

    if (segmentEnd === undefined) {
      return undefined;
    }

    index = segmentEnd;
  }

  return index;
};

const parseIQuery = (input: string, start: number): ParseEnd =>
  scanComponent(
    input,
    start,
    (codePoint) =>
      isIunreserved(codePoint) ||
      isSubDelim(codePoint) ||
      codePoint === COLON ||
      codePoint === AT ||
      codePoint === FORWARD_SLASH ||
      codePoint === QUESTION_MARK ||
      isIprivate(codePoint),
    (codePoint) => codePoint === HASH
  );

const parseIFragment = (input: string, start: number): ParseEnd =>
  scanComponent(
    input,
    start,
    (codePoint) =>
      isIunreserved(codePoint) ||
      isSubDelim(codePoint) ||
      codePoint === COLON ||
      codePoint === AT ||
      codePoint === FORWARD_SLASH ||
      codePoint === QUESTION_MARK,
    () => false
  );

const parseIHierPart = (input: string, start: number): ParseEnd => {
  if (input[start] === "/" && input[start + 1] === "/") {
    const authorityEnd = parseAuthority(input, start + 2);

    return authorityEnd === undefined ? undefined : parseIPathAbempty(input, authorityEnd);
  }

  if (input[start] === "/") {
    return parseIPathAbsolute(input, start);
  }

  if (start === Str.length(input) || input[start] === "?" || input[start] === "#") {
    return start;
  }

  return parseIPathRootless(input, start);
};

const parseIRelativePart = (input: string, start: number): ParseEnd => {
  if (input[start] === "/" && input[start + 1] === "/") {
    const authorityEnd = parseAuthority(input, start + 2);

    return authorityEnd === undefined ? undefined : parseIPathAbempty(input, authorityEnd);
  }

  if (input[start] === "/") {
    return parseIPathAbsolute(input, start);
  }

  if (start === Str.length(input) || input[start] === "?" || input[start] === "#") {
    return start;
  }

  return parseIPathNoScheme(input, start);
};

const parseScheme = (input: string, start: number): ParseEnd => {
  const first = codePointAt(input, start);

  if (first === undefined || !isAlpha(first)) {
    return undefined;
  }

  let index = start + 1;

  while (index < Str.length(input)) {
    const character = input[index];

    if (character === ":") {
      return index;
    }

    const codePoint = codePointAt(input, index);

    if (
      codePoint === undefined ||
      (!isAlpha(codePoint) && !isDigit(codePoint) && character !== "+" && character !== "-" && character !== ".")
    ) {
      return undefined;
    }

    index += 1;
  }

  return undefined;
};

const parseAbsoluteIriEnd = (input: string): ParseEnd => {
  const schemeEnd = parseScheme(input, 0);

  if (schemeEnd === undefined) {
    return undefined;
  }

  let index = schemeEnd + 1;
  const hierPartEnd = parseIHierPart(input, index);

  if (hierPartEnd === undefined) {
    return undefined;
  }

  index = hierPartEnd;

  if (input[index] === "?") {
    const queryEnd = parseIQuery(input, index + 1);

    if (queryEnd === undefined) {
      return undefined;
    }

    index = queryEnd;
  }

  return index;
};

const parseIriEnd = (input: string): ParseEnd => {
  let index = parseAbsoluteIriEnd(input);

  if (index === undefined) {
    return undefined;
  }

  if (input[index] === "#") {
    const fragmentEnd = parseIFragment(input, index + 1);

    if (fragmentEnd === undefined) {
      return undefined;
    }

    index = fragmentEnd;
  }

  return index;
};

const parseRelativeIriReferenceEnd = (input: string): ParseEnd => {
  let index = parseIRelativePart(input, 0);

  if (index === undefined) {
    return undefined;
  }

  if (input[index] === "?") {
    const queryEnd = parseIQuery(input, index + 1);

    if (queryEnd === undefined) {
      return undefined;
    }

    index = queryEnd;
  }

  if (input[index] === "#") {
    const fragmentEnd = parseIFragment(input, index + 1);

    if (fragmentEnd === undefined) {
      return undefined;
    }

    index = fragmentEnd;
  }

  return index;
};

const isAbsoluteIri = (input: string): boolean => parseAbsoluteIriEnd(input) === Str.length(input);

const isIri = (input: string): boolean => parseIriEnd(input) === Str.length(input);

const isRelativeIriReference = (input: string): boolean => parseRelativeIriReferenceEnd(input) === Str.length(input);

const isIriReference = (input: string): boolean => isIri(input) || isRelativeIriReference(input);

const makeTrimmedSyntaxChecks = (
  identifier: string,
  title: string,
  description: string,
  message: string,
  predicate: (value: string) => boolean
) =>
  [
    S.isTrimmed({
      identifier: $I.create(identifier).make("TrimmedCheck"),
      title: `${title} Trimmed`,
      description: `${description} without leading or trailing whitespace.`,
      message: `${title} values must not contain leading or trailing whitespace`,
    }),
    S.makeFilter(predicate, {
      identifier: $I.create(identifier).make("SyntaxCheck"),
      title: `${title} Syntax`,
      description,
      message,
    }),
  ] as const;

const makeReferenceChecks = (
  identifier: string,
  title: string,
  description: string,
  message: string,
  predicate: (value: string) => boolean
) =>
  S.makeFilterGroup(makeTrimmedSyntaxChecks(identifier, title, description, message, predicate), {
    identifier: $I.create(identifier).make("Checks"),
    title,
    description,
  });

const makeNonEmptyReferenceChecks = (
  identifier: string,
  title: string,
  description: string,
  message: string,
  predicate: (value: string) => boolean
) =>
  S.makeFilterGroup(
    [
      S.isNonEmpty({
        identifier: $I.create(identifier).make("NonEmptyCheck"),
        title: `${title} Non Empty`,
        description: `${description} that is not empty.`,
        message: `${title} values must not be empty`,
      }),
      ...makeTrimmedSyntaxChecks(identifier, title, description, message, predicate),
    ],
    {
      identifier: $I.create(identifier).make("Checks"),
      title,
      description,
    }
  );

const iriReferenceChecks = makeReferenceChecks(
  "IRIReference",
  "IRI Reference",
  "An RFC 3987 IRI reference.",
  "Expected a valid RFC 3987 IRI reference",
  isIriReference
);

const relativeIriReferenceChecks = makeReferenceChecks(
  "RelativeIRIReference",
  "Relative IRI Reference",
  "An RFC 3987 relative IRI reference.",
  "Expected a valid RFC 3987 relative IRI reference",
  isRelativeIriReference
);

const absoluteIriChecks = makeNonEmptyReferenceChecks(
  "AbsoluteIRI",
  "Absolute IRI",
  "An RFC 3987 absolute IRI without a fragment component.",
  "Expected a valid RFC 3987 absolute IRI",
  isAbsoluteIri
);

const iriChecks = makeNonEmptyReferenceChecks("IRI", "IRI", "An RFC 3987 IRI.", "Expected a valid RFC 3987 IRI", isIri);

/**
 * RFC 3987 `IRI-reference` schema, including absolute and relative forms.
 *
 * @example
 * ```typescript
 * import * as S from "effect/Schema"
 * import { IRIReference } from "@beep/rdf"
 *
 * const decoded = S.decodeUnknownSync(IRIReference)("https://example.org/resource")
 * console.log(decoded) // "https://example.org/resource"
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const IRIReference = S.String.check(iriReferenceChecks).pipe(
  S.brand("IRIReference"),
  $I.annoteSchema("IRIReference", {
    description: "RFC 3987 IRI reference syntax, including both absolute and relative forms.",
  })
);

/**
 * RFC 3987 `IRI-reference` syntax, including absolute and relative forms.
 *
 * @example
 * ```ts
 * import type { IRIReference } from "@beep/rdf/Iri"
 *
 * const acceptIRIReference = (value: IRIReference) => value
 * console.log(acceptIRIReference)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type IRIReference = typeof IRIReference.Type;

/**
 * RFC 3987 `irelative-ref` schema.
 *
 * @example
 * ```typescript
 * import * as S from "effect/Schema"
 * import { RelativeIRIReference } from "@beep/rdf"
 *
 * const decoded = S.decodeUnknownSync(RelativeIRIReference)("/path/to/resource")
 * console.log(decoded) // "/path/to/resource"
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const RelativeIRIReference = S.String.check(relativeIriReferenceChecks).pipe(
  S.brand("RelativeIRIReference"),
  $I.annoteSchema("RelativeIRIReference", {
    description: "RFC 3987 relative IRI reference syntax (`irelative-ref`).",
  })
);

/**
 * RFC 3987 `irelative-ref` syntax.
 *
 * @example
 * ```ts
 * import type { RelativeIRIReference } from "@beep/rdf/Iri"
 *
 * const acceptRelativeIRIReference = (value: RelativeIRIReference) => value
 * console.log(acceptRelativeIRIReference)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type RelativeIRIReference = typeof RelativeIRIReference.Type;

/**
 * RFC 3987 `absolute-IRI` schema without a fragment component.
 *
 * @example
 * ```typescript
 * import * as S from "effect/Schema"
 * import { AbsoluteIRI } from "@beep/rdf"
 *
 * const decoded = S.decodeUnknownSync(AbsoluteIRI)("https://example.org")
 * console.log(decoded) // "https://example.org"
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const AbsoluteIRI = S.String.check(absoluteIriChecks).pipe(
  S.brand("AbsoluteIRI"),
  $I.annoteSchema("AbsoluteIRI", {
    description: "RFC 3987 absolute IRI syntax without a fragment component.",
  })
);

/**
 * RFC 3987 `absolute-IRI` syntax without a fragment component.
 *
 * @example
 * ```ts
 * import type { AbsoluteIRI } from "@beep/rdf/Iri"
 *
 * const acceptAbsoluteIRI = (value: AbsoluteIRI) => value
 * console.log(acceptAbsoluteIRI)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type AbsoluteIRI = typeof AbsoluteIRI.Type;

/**
 * RFC 3987 `IRI` schema.
 *
 * @example
 * ```typescript
 * import * as S from "effect/Schema"
 * import { IRI } from "@beep/rdf"
 *
 * const decoded = S.decodeUnknownSync(IRI)("https://example.org/page#section")
 * console.log(decoded) // "https://example.org/page#section"
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const IRI = S.String.check(iriChecks).pipe(
  S.brand("IRI"),
  $I.annoteSchema("IRI", {
    description: "RFC 3987 IRI syntax.",
  })
);

/**
 * RFC 3987 `IRI` syntax.
 *
 * @example
 * ```ts
 * import type { IRI } from "@beep/rdf/Iri"
 *
 * const acceptIRI = (value: IRI) => value
 * console.log(acceptIRI)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type IRI = typeof IRI.Type;
