/**
 * Resolver text behavior adapted from eyecite resolve.py and utils.strip_punct.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Citation, CitationComponents, IdCitation } from "@beep/law-practice-domain/values";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as BI from "effect/BigInt";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { citationPythonDecimalValues as decimalValues } from "./PythonDecimal.ts";
import { citationPythonTextData } from "./PythonTextData.ts";

const $I = $LawPracticeServerId.create("internal/Citation/ResolverText");
const digitSet = HashSet.fromIterable(citationPythonTextData.digits);
const Input = S.Struct({ fullCitation: Citation, idCitation: IdCitation });
const InputType = S.toType(Input);

const FailureReason = LiteralKit(["invalid-input", "canonical-page-type", "integer-conversion"]).pipe(
  $I.annoteSchema("FailureReason", {
    description:
      "Finite private representations of invalid input and canonical page/integer failures, without raw text.",
  })
);
/**
 * Private sanitized equivalent of the oracle's invalid page/integer exceptions.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationResolverTextFailure extends S.TaggedError<
  CitationResolverTextFailure,
  { readonly brand: unique symbol }
>($I`CitationResolverTextFailure`)(
  "CitationResolverTextFailure",
  { reason: FailureReason },
  $I.annoteError<CitationResolverTextFailure>("CitationResolverTextFailure", {
    description: "Resolver text evaluation failed without retaining page/pin text or underlying exceptions.",
  })
) {}

/**
 * Exact frozen Python str.isdigit behavior, including non-decimal digit forms.
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isCitationPythonDigit = (text: string): boolean =>
  Str.isNonEmpty(text) && A.every(A.fromIterable(text), (char) => HashSet.has(digitSet, char));

/**
 * Port of the pinned strip_punct substitutions and Python whitespace trim.
 * The explicit whitespace class preserves Unicode 14 semantics instead of JS
 * whitespace (which differs for NEL, separator controls and the BOM).
 * Patterns are source-backed but still need the final family safety gate.
 * @internal
 * @category transformations
 * @since 0.0.0
 */
export const stripCitationAntecedentPunctuation = (text: string): string =>
  pipe(
    text,
    Str.replace(/^["']/u, ""),
    Str.replace(/``/gu, ""),
    Str.replace(/([ ([{<])"/gu, ""),
    Str.replace(/\.\.\./gu, ""),
    Str.replace(/[,;:@#$%&]/gu, ""),
    Str.replace(
      /([^.])(\.)([\])}>"']*)[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*$/gu,
      "$1"
    ),
    Str.replace(/[?!]/gu, ""),
    Str.replace(/([^'])' /gu, ""),
    Str.replace(/[\][(){}<>]/gu, ""),
    Str.replace(/--/gu, ""),
    Str.replace(/"/gu, ""),
    Str.replace(
      /([^\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000])(''?)/gu,
      "$1"
    ),
    Str.replace(
      /^[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/gu,
      ""
    )
  );

const decimalInteger = Effect.fn("Citation.parseResolverDecimal")(function* (characters: ReadonlyArray<string>) {
  // Match the frozen Python integer conversion limit, including leading zeroes.
  if (A.length(characters) > 4300) return yield* CitationResolverTextFailure.make({ reason: "integer-conversion" });
  const values = A.map(characters, (char) => HashMap.get(decimalValues, char));
  const digits = A.map(A.getSomes(values), (digit) => `${digit}`);
  if (A.length(digits) !== A.length(characters))
    return yield* CitationResolverTextFailure.make({ reason: "integer-conversion" });
  return yield* Effect.fromOption(BI.fromString(A.join(digits, "")), () =>
    CitationResolverTextFailure.make({ reason: "integer-conversion" })
  );
});

const missingCasePage = (citation: Citation, page: O.Option<string | null>) =>
  citation.type === "case" && (O.isNone(page) || page.value === null);
/**
 * Exact default Id. pin validation, with arbitrary-precision Unicode decimals.
 * The first grouped citation can be non-full when a custom callback introduced
 * its resource; the source cast does not impose a runtime FullCitation check.
 * Source exceptions become sanitized private failures, not unresolved outcomes.
 * No regex, Python runtime or numeric coercion is used for decimal parsing.
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const hasInvalidCitationPinCite = Effect.fn("Citation.hasInvalidPinCite")(function* (
  input: unknown
): Effect.fn.Return<boolean, CitationResolverTextFailure> {
  const decoded = yield* S.decodeUnknownEffect(InputType)(input).pipe(
    Effect.mapError(() => CitationResolverTextFailure.make({ reason: "invalid-input" }))
  );
  const components = yield* S.encodeEffect(CitationComponents)(decoded.fullCitation.components).pipe(
    Effect.mapError(() => CitationResolverTextFailure.make({ reason: "invalid-input" }))
  );
  const pageEntry = R.get(components, "page");
  const page = O.getOrElse(pageEntry, () => "");
  if (missingCasePage(decoded.fullCitation, pageEntry)) return true;
  const pin = O.getOrElse(decoded.idCitation.metadata.pinCite, () => "");
  if (Str.isEmpty(pin)) return false;
  if (page === null) return yield* CitationResolverTextFailure.make({ reason: "canonical-page-type" });
  if (!isCitationPythonDigit(page)) return false;
  const pageValue = yield* decimalInteger(A.fromIterable(page));
  const pinText = Str.startsWith("at ")(pin) ? Str.slice(3)(pin) : pin;
  const prefix = A.takeWhile(A.fromIterable(pinText), (char) => HashMap.has(decimalValues, char));
  if (A.length(prefix) === 0) return true;
  const pinValue = yield* decimalInteger(prefix);
  return pinValue < pageValue || pinValue > pageValue + BigInt(150);
});
