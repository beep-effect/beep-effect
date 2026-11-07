/**
 * Lawful structured Bluebook views for the declared U.S. Reports case profile.
 * Layout reference: pinned eyecite-ts 34133d0, MIT; identity evidence: eyecite
 * 2.7.6 / vocabulary mapping b5aca44d, BSD-2-Clause. See THIRD_PARTY_NOTICES.md.
 * **Example** (Inspect the supported form)
 * ```ts
 * import { BluebookCitation } from "@beep/law-practice-domain/values"
 * console.log(BluebookCitation.fields.form !== undefined) // true
 * ```
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import { CourtId, CourtReporterArtifactVersion, ReporterId } from "../CourtReporterVocabulary/index.ts";
import {
  CitationCaseEdition,
  CitationCasePublication,
  CitationFullCaseMetadata,
  CitationKnownCourt,
  FullCaseCitation,
} from "./Citation.case.ts";
import { FullCitation } from "./Citation.models.ts";
import { CitationComponents, CitationEditionRef } from "./Citation.resource.ts";

const $I = $LawPracticeDomainId.create("values/Citation/Citation.bluebook");
const Party = S.NonEmptyString.check(
  S.isMaxLength(256),
  S.isTrimmed(),
  S.isPattern(/^[^,()\r\n\t]+$/u),
  S.makeFilter(
    (name) => !Str.includes(" v. ")(name),
    $I.annote("PartySeparator", { description: "Party names cannot contain the profile's case separator." })
  )
).pipe(
  $I.annoteSchema("Party", { description: "A bounded, trimmed party name without ambiguous profile delimiters." })
);
const Decimal = S.String.check(S.isPattern(/^[1-9][0-9]{0,8}$/)).pipe(
  $I.annoteSchema("Decimal", {
    description: "Canonical positive decimal volume, page or pin without numeric coercion.",
  })
);
const Year = S.String.check(S.isPattern(/^[1-9][0-9]{3}$/)).pipe(
  $I.annoteSchema("Year", {
    description: "Four canonical decimal year digits without a leading zero; no historical validity claim.",
  })
);
const edition = CitationEditionRef.make("351eca5a0f8b133ce2d21530fd349f3567079fff849effe0a976efa3fdc16718");
const reporter = ReporterId.make("reporter:67d371c6acffe6c7502566ad");
const version = CourtReporterArtifactVersion.make("crv1:f353e51400a5:fad63b383b92");

/**
 * Structured named U.S. Reports case with complete reconstructible semantics.
 * The form fixes the frozen U.S. edition/reporter and known scotus identity at
 * the declared vocabulary version. Other reporters, extra components, enriched
 * metadata, ambiguous publications and non-case forms are unsupported here.
 * Party names exclude commas, parentheses and the case separator. Volume/page/
 * pin are canonical positive decimals; year has four digits. No abbreviations,
 * missing legal values or full Bluebook-manual compliance are inferred.
 * **Example** (Construct a supported view)
 * ```ts
 * import { BluebookCitation } from "@beep/law-practice-domain/values"
 * import * as O from "effect/Option"
 * const value = BluebookCitation.make({ plaintiff: "Foo", defendant: "Bar", volume: "1", page: "1", year: "2000", pinCite: O.none() })
 * console.log(value.form) // "us-reports-case"
 * ```
 * @category models
 * @since 0.0.0
 */
export class BluebookCitation extends S.Opaque<BluebookCitation, { readonly brand: unique symbol }>()(
  S.Struct({
    form: S.tag("us-reports-case"),
    plaintiff: Party,
    defendant: Party,
    volume: Decimal,
    page: Decimal,
    year: Year,
    pinCite: S.OptionFromNullOr(Decimal),
  }).pipe(
    $I.annoteSchema("BluebookCitation", {
      description:
        "Named U.S. Reports case profile with losslessly reconstructible canonical semantic fields and fixed publication/court identity.",
    })
  )
) {}
const fullFrom = (value: typeof BluebookCitation.Encoded) =>
  FullCaseCitation.make({
    components: CitationComponents.make({
      volume: O.some(value.volume),
      reporter: O.some("U.S."),
      page: O.some(value.page),
    }),
    publication: CitationCasePublication.make({
      vocabularyVersion: version,
      editions: [CitationCaseEdition.make({ edition, reporterId: reporter })],
      selectedEdition: O.some(edition),
    }),
    metadata: CitationFullCaseMetadata.make({
      plaintiff: O.some(value.plaintiff),
      defendant: O.some(value.defendant),
      year: O.some(value.year),
      pinCite: O.fromNullishOr(value.pinCite),
      court: O.some(CitationKnownCourt.make({ id: CourtId.make("scotus"), vocabularyVersion: version })),
      month: O.none(),
      day: O.none(),
      parenthetical: O.none(),
      additionalText: O.none(),
      antecedentGuess: O.none(),
      shortCaseName: O.none(),
      caseName: O.none(),
    }),
  });
const equivalent = S.toEquivalence(FullCitation);
const unsupported = (actual: unknown) =>
  new SchemaIssue.InvalidValue(
    { message: "Unsupported full citation for the lossless U.S. Reports Bluebook profile." },
    actual
  );
const fromFull = Effect.fn("Bluebook.fromFull")(function* (citation: FullCitation) {
  if (citation.type !== "case") return yield* Effect.fail(unsupported(citation));
  const components = yield* S.encodeEffect(CitationComponents)(citation.components).pipe(
    Effect.mapError((error) => error.issue)
  );
  const value = yield* S.decodeUnknownEffect(BluebookCitation)({
    form: "us-reports-case",
    plaintiff: O.getOrNull(citation.metadata.plaintiff),
    defendant: O.getOrNull(citation.metadata.defendant),
    volume: components.volume,
    page: components.page,
    year: O.getOrNull(citation.metadata.year),
    pinCite: O.getOrNull(citation.metadata.pinCite),
  }).pipe(Effect.mapError((error) => error.issue));
  const wire = yield* S.encodeEffect(BluebookCitation)(value).pipe(Effect.mapError((error) => error.issue));
  if (!equivalent(citation, fullFrom(wire))) return yield* Effect.fail(unsupported(citation));
  return wire;
});
/**
 * Full semantic citation to the supported structured Bluebook profile.
 * **Laws** Information: canonicalizing. Decode: partial. Encode: total for valid
 * BluebookCitation values. Every supported decode/encode preserves FullCitation
 * semantic equality. No unrelated components, metadata or identity are dropped.
 * Unsupported forms fail with a typed schema issue; no fallback citation is made.
 * **Example** (Use the exact decoded citation as input)
 * ```ts
 * import { BluebookCitation, BluebookFromFullCitation } from "@beep/law-practice-domain/values"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * const value = BluebookCitation.make({ plaintiff: "Foo", defendant: "Bar", volume: "1", page: "1", year: "2000", pinCite: O.none() })
 * const result = S.encodeEffect(BluebookFromFullCitation)(value).pipe(Effect.flatMap((citation) => S.decodeEffect(BluebookFromFullCitation)(citation)))
 * console.log(result !== undefined) // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const BluebookFromFullCitation: S.Codec<BluebookCitation, FullCitation.Type> = S.toType(FullCitation).pipe(
  S.decodeTo(
    BluebookCitation,
    SchemaTransformation.transformEffect<typeof BluebookCitation.Encoded, FullCitation.Type>({
      decode: fromFull,
      encode: (value) => Effect.sync(() => fullFrom(value)),
    })
  ),
  $I.annoteSchema("BluebookFromFullCitation", {
    description:
      "Canonicalizing; partial decode from exact FullCitation.Type, total encode of the declared supported form.",
  })
);
/**
 * Bounded candidate/rendered Bluebook text; parsing may reject unsupported forms.
 * **Example** (Retain text for supported-grammar parsing)
 * ```ts
 * import { BluebookText } from "@beep/law-practice-domain/values"
 * console.log(BluebookText.make("Foo v. Bar, 1 U.S. 1 (2000)"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const BluebookText = S.NonEmptyString.check(S.isMaxLength(640)).pipe(
  S.brand("BluebookText"),
  $I.annoteSchema("BluebookText", {
    description: "Bounded Bluebook text, with partial parsing rather than an assertion of manual compliance.",
  })
);
/** Schema-derived bounded text.
 * @category models
 * @since 0.0.0
 */
export type BluebookText = typeof BluebookText.Type;
const WithPin = S.TemplateLiteralParser([
  Party,
  " v. ",
  Party,
  ", ",
  Decimal,
  " U.S. ",
  Decimal,
  ", ",
  Decimal,
  " (",
  Year,
  ")",
]);
const WithoutPin = S.TemplateLiteralParser([Party, " v. ", Party, ", ", Decimal, " U.S. ", Decimal, " (", Year, ")"]);
const TextGrammar = S.Union([WithPin, WithoutPin]);
const parse = Effect.fn("Bluebook.parseText")(function* (text: string) {
  const commas = Str.split(text, ", ").length;
  if (Str.split(text, " v. ").length !== 2 || commas < 2 || commas > 3)
    return yield* Effect.fail(
      new SchemaIssue.InvalidValue({ message: "Unsupported or ambiguous Bluebook text grammar." }, text)
    );
  const parts = yield* S.decodeUnknownEffect(TextGrammar)(text).pipe(Effect.mapError((error) => error.issue));
  return BluebookCitation.make({
    plaintiff: parts[0],
    defendant: parts[2],
    volume: parts[4],
    page: parts[6],
    pinCite: parts.length === 12 ? O.some(parts[8]) : O.none(),
    year: parts.length === 12 ? parts[10] : parts[8],
  });
});
const render = (value: BluebookCitation) => {
  const pin = value.pinCite.pipe(
    O.map((pin) => `, ${pin}`),
    O.getOrElse(() => "")
  );
  return `${value.plaintiff} v. ${value.defendant}, ${value.volume} U.S. ${value.page}${pin} (${value.year})`;
};
/**
 * Render on decode; parse the documented canonical U.S. Reports grammar on encode.
 * **Laws** Information: canonicalizing. Decode: total structured rendering.
 * Encode: partial parsing. Supported text parse/render converges exactly; the
 * structured text round trip preserves every supported field and fixed identity.
 * Parsing uses Effect TemplateLiteralParser under the bounded text schema.
 * **Example** (Render a structured citation)
 * ```ts
 * import { BluebookCitation, BluebookTextFromBluebookCitation } from "@beep/law-practice-domain/values"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * const value = BluebookCitation.make({ plaintiff: "Foo", defendant: "Bar", volume: "1", page: "1", year: "2000", pinCite: O.none() })
 * const text = S.decodeEffect(BluebookTextFromBluebookCitation)(value)
 * console.log(text !== undefined) // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const BluebookTextFromBluebookCitation: S.Codec<BluebookText, BluebookCitation> = S.toType(
  BluebookCitation
).pipe(
  S.decodeTo(
    BluebookText,
    SchemaTransformation.transformEffect({ decode: (value) => Effect.succeed(render(value)), encode: parse })
  ),
  $I.annoteSchema("BluebookTextFromBluebookCitation", {
    description:
      "Canonicalizing; total structured rendering on decode and partial parsing on encode for the declared U.S. Reports grammar.",
  })
);
