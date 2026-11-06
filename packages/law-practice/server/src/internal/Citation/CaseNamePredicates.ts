/** Three case-name boundary predicates from eyecite 2.7.6 helpers.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { makeCitationPythonCharacters } from "./PythonCharacters.ts";
import { citationPythonTextData } from "./PythonTextData.ts";
import { citationPythonPointAt } from "./PythonUnicode.ts";
import type { CitationPythonUnicodeValue } from "./PythonUnicode.ts";

const $I = $LawPracticeServerId.create("internal/Citation/CaseNamePredicates");
const whitespace = HashSet.fromIterable(citationPythonTextData.whitespace);
const connectors = HashSet.fromIterable(["of", "the", "an", "and"]);
/** Source word_str[0] raises IndexError for an empty built-in string.
 * @internal @category errors @since 0.0.0
 */
export class CitationCaseNamePredicateFailure extends S.TaggedError<
  CitationCaseNamePredicateFailure,
  { readonly brand: unique symbol }
>($I`CitationCaseNamePredicateFailure`)(
  "CitationCaseNamePredicateFailure",
  { reason: S.tag("empty-word") },
  $I.annoteError<CitationCaseNamePredicateFailure>("CitationCaseNamePredicateFailure", {
    description: "Empty native word access without retaining source text or an underlying exception.",
  })
) {}
const firstPoint = Effect.fn("Citation.caseNameFirstPoint")(function* (source: CitationPythonUnicodeValue) {
  if (source.pythonLength === 0) return yield* CitationCaseNamePredicateFailure.make({});
  return citationPythonPointAt(source.storage, 0);
});
const nonblank = Effect.fn("Citation.caseNameNonblank")(function* (source: CitationPythonUnicodeValue) {
  for (let index = 0; index < source.pythonLength; index++) {
    if (index % 256 === 0) yield* Effect.yieldNow;
    const point = citationPythonPointAt(source.storage, index);
    if (!HashSet.has(whitespace, String.fromCodePoint(point))) return true;
  }
  return false;
});
/** Install shared frozen Python character predicates once for the enclosing
 * scan. Returned methods have R = never and add no native word copies.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationCaseNamePredicates = Effect.fn("Citation.makeCaseNamePredicates")(function* () {
  const characters = yield* makeCitationPythonCharacters();
  /** Source _is_lowercase_after_v_token, including is-not-None short circuit.
   * The caller supplies one validated, immutable owned word and presence of the
   * source v token. The enclosing scan owns admission/budget/captured deadline;
   * this cooperative predicate adds no native copy and has R = never.
   * @internal @category operations @since 0.0.0
   */
  const isCitationLowercaseAfterV = Effect.fn("Citation.isLowercaseAfterV")(function* (
    source: CitationPythonUnicodeValue,
    hasVToken: boolean
  ) {
    if (!hasVToken) return false;
    const point = yield* firstPoint(source);
    if (characters.upper(point)) return false;
    return (yield* nonblank(source)) && !HashSet.has(connectors, source.text);
  });
  /** Source _is_capitalized_abbreviation. Length counts Python points; uppercase
   * is the frozen one-point predicate, not titlecase or host Unicode casing.
   * @internal @category operations @since 0.0.0
   */
  const isCitationCapitalizedAbbreviation = Effect.fn("Citation.isCapitalizedAbbreviation")(function* (
    source: CitationPythonUnicodeValue,
    hasVToken: boolean,
    plaintiffLength: number
  ) {
    if (!hasVToken) return false;
    const point = yield* firstPoint(source);
    return (
      characters.upper(point) &&
      source.pythonLength > 4 &&
      citationPythonPointAt(source.storage, source.pythonLength - 1) === 46 &&
      plaintiffLength > 1
    );
  });
  /** Source _is_lowercase_without_v_token. In particular, empty input without v
   * fails before strip, and "lowercase" here means not-uppercase then alphabetic.
   * @internal @category operations @since 0.0.0
   */
  const isCitationLowercaseWithoutV = Effect.fn("Citation.isLowercaseWithoutV")(function* (
    source: CitationPythonUnicodeValue,
    hasVToken: boolean
  ) {
    if (hasVToken) return false;
    const point = yield* firstPoint(source);
    if (characters.upper(point) || !(yield* nonblank(source))) return false;
    return characters.alpha(point) && !HashSet.has(connectors, source.text);
  });

  return {
    isNonblank: nonblank,
    isAlpha: characters.alpha,
    isLower: characters.lower,
    isLowercaseAfterV: isCitationLowercaseAfterV,
    isCapitalizedAbbreviation: isCitationCapitalizedAbbreviation,
    isLowercaseWithoutV: isCitationLowercaseWithoutV,
  };
});
