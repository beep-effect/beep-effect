/**
 * Pure matching, masking and consumer-rendered replacement for the canonical bank.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LiteralKit } from "../LiteralKit/index.ts";
import { CredentialCategory, CredentialMatch, CredentialRule } from "./CredentialPatternBank.schema.ts";

const rule = (
  category: CredentialCategory,
  pattern: string,
  flags: "gu" | "giu",
  valueGroups: A.NonEmptyReadonlyArray<number>,
  residuePatterns: ReadonlyArray<string> = []
) => CredentialRule.make({ category, pattern, flags, valueGroups, residuePatterns, version: "v1" });

/**
 * One canonical rule per category. Consumer rendering and category selection remain local.
 * **Example** (Inspect bank size)
 * ```ts import.meta.vitest name="Inspect bank size"
 * import { credentialRules } from "@beep/schema/CredentialPatternBank"
 * console.log(credentialRules.length)
 * ```
 * @category constants
 * @since 0.0.0
 */
export const credentialRules: ReadonlyArray<CredentialRule> = [
  rule(
    "secret-assignment",
    /\b([A-Za-z0-9_-]*(?:api[_-]?key|key|token|secret|password|passwd|pass|pwd|auth|credential|session)[A-Za-z0-9_-]*)(\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s;&|]+)/
      .source,
    "giu",
    [3],
    [
      /\b[A-Za-z0-9_-]*(?:api[_-]?key|key|token|secret|password|passwd|pass|pwd|auth|credential|session)[A-Za-z0-9_-]*\s*[=:]\s*"[^"]*$/
        .source,
      /\b[A-Za-z0-9_-]*(?:api[_-]?key|key|token|secret|password|passwd|pass|pwd|auth|credential|session)[A-Za-z0-9_-]*\s*[=:]\s*'[^']*$/
        .source,
    ]
  ),
  rule("auth-header", /\b(authorization|proxy-authorization|cookie|set-cookie)(\s*:\s*)([^\n\r]+)/.source, "giu", [3]),
  rule("bearer-token", /\b(Bearer|Basic)(\s+)([A-Za-z0-9._~+/=-]{8,})/.source, "giu", [3]),
  rule("provider-key", /\bsk-[A-Za-z0-9_-]{8,}\b/.source, "gu", [0], [/\bsk-[A-Za-z0-9_-]{1,7}\b/.source]),
  rule(
    "jwt",
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/.source,
    "gu",
    [0],
    [/\beyJ[A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]*){0,2}\b/.source]
  ),
  rule("home-path", /(\/(?:home|Users)\/)([^/\s:]+)|([A-Za-z]:\\Users\\)([^\\\s:]+)/.source, "gu", [2, 4]),
  rule("private-tag", /<\/?private>/.source, "giu", [0]),
];
const RedactionMarker = LiteralKit(["[REDACTED]", "[REDACTED_SECRET]"]);
const isRedactionMarker = S.is(RedactionMarker);
const isMarker = (text: string) => isRedactionMarker(Str.replaceAll(/^["']|["']$/gu, "")(Str.trim(text)));
const rawMatches = (text: string, grammar: CredentialRule) =>
  Str.matchAll(new RegExp(grammar.pattern, grammar.flags))(text);
const categoryRule = (category: CredentialCategory) =>
  A.findFirst(credentialRules, (candidate) => candidate.category === category);
const capture = (match: RegExpMatchArray, index: number) => O.getOrElse(O.fromUndefinedOr(match[index]), () => "");
const offset = (match: RegExpMatchArray) => O.getOrElse(O.fromUndefinedOr(match.index), () => 0);
const makeMatch = (
  category: CredentialCategory,
  start: number,
  end: number,
  state: CredentialMatch["state"] = "matched"
) => CredentialMatch.make({ category, start, end, state, ruleVersion: "v1" });

const privateMatches = (text: string, grammar: CredentialRule): ReadonlyArray<CredentialMatch> => {
  let depth = 0;
  let start = 0;
  let found = A.empty<CredentialMatch>();
  for (const token of rawMatches(text, grammar)) {
    if (Str.toLowerCase(capture(token, 0)) === "<private>") {
      if (depth === 0) start = offset(token);
      depth += 1;
    } else if (depth > 0) {
      depth -= 1;
      if (depth === 0)
        found = A.append(found, makeMatch("private-tag", start, offset(token) + Str.length(capture(token, 0))));
    } else {
      // An orphan delimiter leaves the private extent unknown: mask the whole input.
      found = A.append(found, makeMatch("private-tag", 0, Str.length(text), "unresolved"));
    }
  }
  if (depth > 0) found = A.append(found, makeMatch("private-tag", start, Str.length(text), "unresolved"));
  return found;
};
const completeMatches = (text: string, grammar: CredentialRule): ReadonlyArray<CredentialMatch> => {
  if (CredentialCategory.is["private-tag"](grammar.category)) return privateMatches(text, grammar);
  return pipe(
    rawMatches(text, grammar),
    A.fromIterable,
    A.filterMap((match) => {
      const valueGroup = O.getOrElse(
        A.findFirst(grammar.valueGroups, (index) => O.isSome(O.fromUndefinedOr(match[index]))),
        () => 0
      );
      const value = capture(match, valueGroup);
      if (isMarker(value)) return Result.failVoid;
      const prefixWidth =
        valueGroup === 0
          ? 0
          : A.reduce(A.range(1, valueGroup - 1), 0, (sum, index) => sum + Str.length(capture(match, index)));
      const start = offset(match) + prefixWidth;
      return Result.succeed(makeMatch(grammar.category, start, start + Str.length(value)));
    })
  );
};

/**
 * Detect complete, unresolved and partial supported forms without retaining values.
 * **Details**
 * Coverage is bounded to these grammars on plain text, never exhaustive secret discovery.
 * **Example** (Inspect a clean input)
 * ```ts import.meta.vitest name="Inspect a clean input"
 * import { detectCredentials } from "@beep/schema/CredentialPatternBank"
 * console.log(detectCredentials("public text"))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const detectCredentials = (text: string): ReadonlyArray<CredentialMatch> =>
  A.flatMap(credentialRules, (grammar) => {
    const complete = completeMatches(text, grammar);
    const residue = A.flatMap(grammar.residuePatterns, (pattern) =>
      pipe(
        Str.matchAll(new RegExp(pattern, grammar.flags))(text),
        A.fromIterable,
        A.filterMap((match) => {
          const start = offset(match);
          const end = start + Str.length(capture(match, 0));
          return !CredentialCategory.is["secret-assignment"](grammar.category) &&
            A.some(complete, (item) => item.start <= start && item.end >= end)
            ? Result.failVoid
            : Result.succeed(makeMatch(grammar.category, start, end, "residue"));
        })
      )
    );
    return A.appendAll(complete, residue);
  });

/**
 * Count a category on raw input for legacy counted-proof consumers, including markers.
 * **Example** (Count a near miss)
 * ```ts import.meta.vitest name="Count a near miss"
 * import { countCredentialCategory } from "@beep/schema/CredentialPatternBank"
 * console.log(countCredentialCategory("public text", "auth-header"))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const countCredentialCategory: {
  (text: string, category: CredentialCategory): number;
  (category: CredentialCategory): (text: string) => number;
} = dual(2, (text: string, category: CredentialCategory) =>
  pipe(
    categoryRule(category),
    O.map((grammar) =>
      CredentialCategory.is["private-tag"](category)
        ? A.length(privateMatches(text, grammar))
        : A.length(A.fromIterable(rawMatches(text, grammar)))
    ),
    O.getOrElse(() => 0)
  )
);

/**
 * Apply the canonical grammar with a consumer-owned replacement template.
 * **Example** (Keep clean text unchanged)
 * ```ts import.meta.vitest name="Keep clean text unchanged"
 * import { replaceCredentialCategory } from "@beep/schema/CredentialPatternBank"
 * console.log(replaceCredentialCategory("public text", "auth-header", "$1: [REDACTED]"))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const replaceCredentialCategory: {
  (text: string, category: CredentialCategory, replacement: string): string;
  (category: CredentialCategory, replacement: string): (text: string) => string;
} = dual(3, (text: string, category: CredentialCategory, replacement: string) =>
  pipe(
    categoryRule(category),
    O.map((grammar) =>
      CredentialCategory.is["private-tag"](category)
        ? maskCredentialMatches(text, privateMatches(text, grammar))
        : Str.replaceAll(new RegExp(grammar.pattern, grammar.flags), replacement)(text)
    ),
    O.getOrElse(() => text)
  )
);

/**
 * Replace assignment values outside complete header lines, preserving header rendering precedence.
 *
 * **Details**
 * Assignment and header matches still count independently on raw input. This renderer avoids
 * removing a header's colon before its complete value can be redacted by the header renderer.
 *
 * **Example** (Keep public text unchanged)
 * ```ts import.meta.vitest name="Keep public text unchanged"
 * import { replaceCredentialAssignmentsOutsideHeaders } from "@beep/schema/CredentialPatternBank"
 * console.log(replaceCredentialAssignmentsOutsideHeaders("public text", "$1=[REDACTED]"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const replaceCredentialAssignmentsOutsideHeaders: {
  (text: string, replacement: string): string;
  (replacement: string): (text: string) => string;
} = dual(2, (text: string, replacement: string) => {
  const headers = O.match(categoryRule("auth-header"), {
    onNone: A.empty<RegExpMatchArray>,
    onSome: (grammar) => A.fromIterable(rawMatches(text, grammar)),
  });
  let cursor = 0;
  let output = "";
  for (const header of headers) {
    const start = offset(header);
    const end = start + Str.length(capture(header, 0));
    output += replaceCredentialCategory(Str.slice(cursor, start)(text), "secret-assignment", replacement);
    output += Str.slice(start, end)(text);
    cursor = end;
  }
  return output + replaceCredentialCategory(Str.slice(cursor)(text), "secret-assignment", replacement);
});

/**
 * Mask the union of overlapping original-coordinate spans, retaining no raw match.
 * **Example** (Mask an empty finding list)
 * ```ts import.meta.vitest name="Mask an empty finding list"
 * import { maskCredentialMatches } from "@beep/schema/CredentialPatternBank"
 * console.log(maskCredentialMatches("public text", []))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const maskCredentialMatches: {
  (text: string, matches: ReadonlyArray<CredentialMatch>): string;
  (matches: ReadonlyArray<CredentialMatch>): (text: string) => string;
} = dual(2, (text: string, matches: ReadonlyArray<CredentialMatch>) => {
  const sorted = A.sort(
    matches,
    Order.mapInput(Order.Number, (match: CredentialMatch) => match.start)
  );
  let cursor = 0;
  let end = 0;
  let output = "";
  let active = false;
  for (const match of sorted) {
    if (active && match.start <= end) {
      end = N.max(end, match.end);
      continue;
    }
    if (active) {
      output += "[REDACTED]";
      cursor = end;
    }
    output += Str.slice(cursor, match.start)(text);
    cursor = match.start;
    end = match.end;
    active = true;
  }
  if (active) {
    output += "[REDACTED]";
    cursor = end;
  }
  return output + Str.slice(cursor)(text);
});
