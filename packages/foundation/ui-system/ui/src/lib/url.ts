/**
 * URL sanitization helpers for UI navigation.
 *
 * **Example** (Import sanitizeAnchorHref helper)
 *
 * ```ts
 * import { sanitizeAnchorHref } from "@beep/ui/lib/url"
 *
 * console.log(sanitizeAnchorHref)
 * ```
 *
 * @packageDocumentation
 * @category utilities
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { flow, Match } from "effect";
import * as P from "effect/Predicate";

const unsafeHrefProtocolPattern = /^(?:javascript|vbscript|data):/i;
const ignoredProtocolCharactersPattern = /[\u0000-\u001f\u007f\s]+/g;
const htmlCharacterReferencePattern = /&(?:#(\d+);?|#x([\da-f]+);?|(colon|tab|newline);?)/gi;
const percentEncodedBytePattern = /%([0-9a-f]{2})/gi;
const maxUnicodeCodePoint = 0x10ffff;
const maxDecodePasses = 4;

const isValidCodePoint = (codePoint: number): boolean => codePoint >= 0 && codePoint <= maxUnicodeCodePoint;

const toCodePointString = (codePoint: number): string =>
  isValidCodePoint(codePoint) ? globalThis.String.fromCodePoint(codePoint) : "";

const decodeHtmlCharacterReferences = (value: string): string =>
  Str.replaceWith(value, htmlCharacterReferencePattern, (match: string, ...args: ReadonlyArray<unknown>) => {
    const [decimal, hexadecimal, named] = args;
    if (P.isString(named)) {
      const normalizedNamed = Str.toLowerCase(named);
      const namedCodePoint = Match.value(normalizedNamed).pipe(
        Match.when("tab", () => 9),
        Match.when("newline", () => 10),
        Match.orElse(() => 58)
      );
      return toCodePointString(namedCodePoint);
    }

    const numericValue = P.isString(hexadecimal) ? hexadecimal : decimal;
    if (!P.isString(numericValue)) {
      return match;
    }

    const radix = P.isString(hexadecimal) ? 16 : 10;
    const codePoint = globalThis.Number.parseInt(numericValue, radix);

    return isValidCodePoint(codePoint) ? globalThis.String.fromCodePoint(codePoint) : match;
  });

// ASCII-oriented decoding is enough for protocol detection because the blocked
// scheme names are ASCII-only. We intentionally normalize obfuscated prefixes
// rather than fully decode arbitrary UTF-8 payloads here.
const decodePercentEncodedBytes = (value: string): string => {
  let decoded = value;

  for (let pass = 0; pass < maxDecodePasses; pass++) {
    const next = Str.replaceWith(
      decoded,
      percentEncodedBytePattern,
      (match: string, ...args: ReadonlyArray<unknown>) => {
        const [hex] = args;
        return P.isString(hex) ? globalThis.String.fromCodePoint(globalThis.Number.parseInt(hex, 16)) : match;
      }
    );

    if (next === decoded) {
      return next;
    }

    decoded = next;
  }

  return decoded;
};

const normalizeHrefProtocolCandidate: (value: string) => string = flow(
  Str.trim,
  Str.replace(ignoredProtocolCharactersPattern, ""),
  Str.toLowerCase
);

/**
 * Sanitize anchor href export.
 *
 * **Example** (Import sanitizeAnchorHref)
 *
 * ```ts
 * import { sanitizeAnchorHref } from "@beep/ui/lib/url"
 *
 * console.log(sanitizeAnchorHref)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sanitizeAnchorHref = (href: string): string => {
  const decodedHtml = decodeHtmlCharacterReferences(href);
  const decodedPercent = decodePercentEncodedBytes(href);
  const decodedHtmlAndPercent = decodePercentEncodedBytes(decodedHtml);
  const decodedPercentAndHtml = decodeHtmlCharacterReferences(decodedPercent);
  const candidates = [href, decodedHtml, decodedPercent, decodedHtmlAndPercent, decodedPercentAndHtml];

  return A.some(candidates, (candidate) => unsafeHrefProtocolPattern.test(normalizeHrefProtocolCandidate(candidate)))
    ? "#"
    : href;
};
