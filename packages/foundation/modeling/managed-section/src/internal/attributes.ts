// The marker attribute grammar, shared by the renderer and the scanner so the
// two can never disagree about what an attribute run is.
//
// A BEGIN marker may carry `name="value"` pairs between the phrase and the
// closing rule. Names are `[A-Za-z][A-Za-z0-9_-]*`; values are double-quoted
// and may not contain `"` or any line break — there is no escaping mechanism,
// by design: an escape grammar is a second parser hiding inside the first, and
// every value this package refuses is one it could not have read back
// verbatim.

import { $ManagedSectionId } from "@beep/identity/packages";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $ManagedSectionId.create("internal/attributes");

/**
 * The attribute name grammar. No leading digit, underscore or dash.
 *
 * **Example** (Check the first character of an attribute name)
 *
 * ```ts
 * import { ATTRIBUTE_NAME_PATTERN } from "@beep/managed-section/internal/attributes";
 *
 * console.log(ATTRIBUTE_NAME_PATTERN.test("owner-id")) // true
 * console.log(ATTRIBUTE_NAME_PATTERN.test("_owner")) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ATTRIBUTE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

/**
 * Attribute names retain the original JavaScript dollar-anchor semantics.
 *
 * **Example** (Validate an attribute name with its schema)
 *
 * ```ts
 * import { AttributeName } from "@beep/managed-section/internal/attributes";
 * import * as S from "effect/Schema";
 *
 * const valid = S.is(AttributeName);
 * console.log(valid("owner-id")) // true
 * console.log(valid("9owner")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AttributeName = S.String.pipe(
  $I.annoteSchema("AttributeName", {
    description: "An attribute name accepted by the existing marker renderer grammar.",
  })
).check(
  S.isPattern(
    ATTRIBUTE_NAME_PATTERN,
    $I.annote("AttributeNameCheck", {
      description:
        "An ASCII letter followed by ASCII letters, digits, underscores or hyphens, with JavaScript dollar-anchor semantics.",
      message:
        "Expected an attribute name starting with an ASCII letter, followed by ASCII letters, digits, underscores or hyphens",
    })
  )
);
/**
 * The string type validated by {@link AttributeName}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AttributeName = typeof AttributeName.Type;

/**
 * Values may contain neither a double quote nor CR or LF, with no escaping.
 *
 * **Example** (Validate values that render verbatim)
 *
 * ```ts
 * import { AttributeValue } from "@beep/managed-section/internal/attributes";
 * import * as S from "effect/Schema";
 *
 * const valid = S.is(AttributeValue);
 * console.log(valid("Ada")) // true
 * console.log(valid('Ada"')) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AttributeValue = S.String.pipe(
  $I.annoteSchema("AttributeValue", {
    description: "An attribute value that can be rendered verbatim inside double quotes.",
  })
).check(
  S.isPattern(
    /^(?![\s\S]*["\r\n])/,
    $I.annote("AttributeValueCheck", {
      description:
        "Text rendered verbatim inside double quotes, excluding double quotes, carriage returns and line feeds.",
      message: "Expected an attribute value without double quotes, carriage returns or line feeds",
    })
  )
);
/**
 * The string type validated by {@link AttributeValue}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AttributeValue = typeof AttributeValue.Type;

/**
 * True when a name satisfies the renderer's original grammar.
 *
 * **Example** (Reject a leading dash in an attribute name)
 *
 * ```ts
 * import { isValidAttributeName } from "@beep/managed-section/internal/attributes";
 *
 * console.log(isValidAttributeName("owner-id")) // true
 * console.log(isValidAttributeName("-owner")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isValidAttributeName = S.is(AttributeName);

/**
 * True when a value can appear inside an attribute's double quotes verbatim.
 *
 * **Example** (Reject a line break in an attribute value)
 *
 * ```ts
 * import { isValidAttributeValue } from "@beep/managed-section/internal/attributes";
 *
 * console.log(isValidAttributeValue("Ada")) // true
 * console.log(isValidAttributeValue("Ada\nLovelace")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isValidAttributeValue = S.is(AttributeValue);

const isNameStart = (char: string | undefined): boolean =>
  char !== undefined && ((char >= "A" && char <= "Z") || (char >= "a" && char <= "z"));

const isNameChar = (char: string | undefined): boolean =>
  isNameStart(char) || (char !== undefined && char >= "0" && char <= "9") || char === "_" || char === "-";

const isSeparator = (char: string | undefined): boolean => char === " " || char === "\t";

/** The index a walk step returns when the run is refused. */
const REFUSED = -1;

/** The first index at or after `index` whose character fails `accepts`. */
const skipWhile = (run: string, index: number, accepts: (char: string | undefined) => boolean): number => {
  let cursor = index;
  while (cursor < run.length && accepts(run[cursor])) {
    cursor += 1;
  }
  return cursor;
};

/** Past the separator run between pairs: one or more spaces/tabs, never trailing. */
const separatorEnd = (run: string, index: number): number => {
  if (!isSeparator(run[index])) {
    return REFUSED;
  }
  const end = skipWhile(run, index, isSeparator);
  // A trailing separator is not part of a valid captured run.
  return end >= run.length ? REFUSED : end;
};

/** Past a name `[A-Za-z][A-Za-z0-9_-]*` starting at `index`. */
const nameEnd = (run: string, index: number): number =>
  isNameStart(run[index]) ? skipWhile(run, index + 1, isNameChar) : REFUSED;

/** True when `="` opens a value at `index`. */
const opensValue = (run: string, index: number): boolean =>
  index + 1 < run.length && run[index] === "=" && run[index + 1] === '"';

/**
 * The closing quote of a value starting at `index`. The scanner only hands
 * the walk single-line text, but a stray CR/LF is refused regardless so the
 * grammar cannot drift from the renderer's refusal.
 */
const valueEnd = (run: string, index: number): number => {
  for (let cursor = index; cursor < run.length; cursor += 1) {
    const char = run[cursor];
    if (char === '"') {
      return cursor;
    }
    if (char === "\n" || char === "\r") {
      return REFUSED;
    }
  }
  // Unterminated value.
  return REFUSED;
};

/** Reads one `name="value"` pair into `attributes`; the index after it, or {@link REFUSED}. */
const readPair = (run: string, index: number, attributes: Record<string, string>): number => {
  const end = nameEnd(run, index);
  if (end === REFUSED || !opensValue(run, end)) {
    return REFUSED;
  }
  const close = valueEnd(run, end + 2);
  if (close === REFUSED) {
    return REFUSED;
  }
  const name = Str.slice(index, end)(run);
  if (R.has(attributes, name)) {
    return REFUSED;
  }
  attributes[name] = Str.slice(end + 2, close)(run);
  return close + 1; // consume the closing quote
};

/** The index after the separator and pair that follow `index`, or {@link REFUSED}. */
const readNextPair = (run: string, index: number, attributes: Record<string, string>): number => {
  const start = separatorEnd(run, index);
  return start === REFUSED ? REFUSED : readPair(run, start, attributes);
};

/** The single-pass walk behind {@link parseAttributeRun}; `undefined` refuses the run. */
const walkAttributeRun = (run: string): Record<string, string> | undefined => {
  // An empty run is not a run — the marker regex only captures non-empty text,
  // but keep the contract honest for direct callers.
  if (run.length === 0) {
    return undefined;
  }
  const attributes: Record<string, string> = {};
  let index = readPair(run, 0, attributes);
  while (index !== REFUSED && index < run.length) {
    index = readNextPair(run, index, attributes);
  }
  return index === REFUSED ? undefined : attributes;
};

/**
 * Parse a captured attribute run, or refuse it.
 *
 * **Details**
 *
 * `none` means the run is not a valid attribute run and the line carrying
 * it is **not a marker** — it is ordinary content. That covers a mangled pair
 * and a name declared twice: two values for one name is two intentions for one
 * attribute, and any choice between them would be a guess.
 *
 * Document order is preserved: the returned record's insertion order is the
 * order the pairs appear in the marker.
 *
 * A hand-rolled single pass rather than a validating regex: the run comes off
 * an untrusted document line, and the natural `(pair)(sep pair)*$` pattern
 * backtracks polynomially on hostile near-misses. This walk touches each
 * character exactly once, so a megabyte of adversarial line costs a megabyte
 * of work.
 *
 * **Example** (Read attribute pairs and refuse duplicate names)
 *
 * ```ts
 * import { parseAttributeRun } from "@beep/managed-section/internal/attributes";
 * import * as O from "effect/Option";
 *
 * const attributes = parseAttributeRun('owner="Ada" mode="strict"');
 * console.log(O.getOrThrow(attributes).owner) // Ada
 * console.log(O.isNone(parseAttributeRun('owner="Ada" owner="Grace"'))) // true
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const parseAttributeRun = (run: string): O.Option<Record<string, string>> =>
  O.fromUndefinedOr(walkAttributeRun(run));
