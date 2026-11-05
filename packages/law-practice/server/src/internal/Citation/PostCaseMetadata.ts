/** add_post_citation from eyecite 2.7.6 helpers.py, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CourtId } from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { makeCitationCourtLookup } from "./CourtLookup.ts";
import { CitationLawMetadataInput, CitationLawMetadataPatch, CitationLawMetadataResult } from "./LawMetadata.ts";
import {
  CitationPublicationMetadataConfiguration,
  citationMetadataContext,
  decodeCitationMetadataConfiguration,
  makeCitationMetadataOperation,
  matchCitationMetadataContext,
  prepareCitationPublicationMetadata,
} from "./MetadataComposition.ts";
import { makeCitationMetadataStrings } from "./MetadataStrings.ts";
import { makeCitationMetadataYearFromBound } from "./MetadataYear.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/PostCaseMetadata");
const Reason = LiteralKit(["invalid-input", "invalid-configuration", "missing-capture"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed post-case preparation failures without source values." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationPostCaseMetadataFailure extends S.TaggedError<
  CitationPostCaseMetadataFailure,
  { readonly brand: unique symbol }
>($I`CitationPostCaseMetadataFailure`)(
  "CitationPostCaseMetadataFailure",
  { reason: Reason },
  $I.annoteError<CitationPostCaseMetadataFailure>("CitationPostCaseMetadataFailure", {
    description: "Post-case processing failed without partial assignments or retained source causes.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationPostCaseMetadataFailure.make({ reason });
const Value = S.NullOr(CitationPythonUnicodeStorage);
/** Source-bound full-case/year patterns plus the authenticated frozen court table.
 * @internal @category models @since 0.0.0
 */
export class CitationPostCaseMetadataConfiguration extends S.Opaque<
  CitationPostCaseMetadataConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({ ...CitationPublicationMetadataConfiguration.fields, courtTable: S.String }).pipe(
    $I.annoteSchema("CitationPostCaseMetadataConfiguration", {
      description: "Private installation data; no executable function or pattern enters raw requests.",
    })
  )
) {}
/** Unverified source state before post-citation processing.
 * @internal @category models @since 0.0.0
 */
export class CitationPostCaseMetadataInput extends S.Opaque<
  CitationPostCaseMetadataInput,
  { readonly brand: unique symbol }
>()(
  S.Struct(CitationLawMetadataInput.fields).pipe(
    $I.annoteSchema("CitationPostCaseMetadataInput", {
      description: "Built-in native words, index, span end and prior numeric year.",
    })
  )
) {}
/** Conditional Option fields distinguish an untouched value from assigned None.
 * Positions are unverified Python points and grant no mention authority.
 * @internal @category models @since 0.0.0
 */
export class CitationPostCaseMetadataPatch extends S.Opaque<
  CitationPostCaseMetadataPatch,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    fullSpanEnd: CitationLawMetadataPatch.fields.fullSpanEnd,
    year: S.NullOr(S.Int),
    metadata: S.Struct({
      pinCite: Value,
      extra: Value,
      parenthetical: Value,
      year: Value,
      month: Value,
      day: Value,
      pinCiteSpanEnd: S.Option(S.Int),
      court: CourtId.pipe(S.NullOr, S.Option),
    }),
  }).pipe(
    $I.annoteSchema("CitationPostCaseMetadataPatch", {
      description: "Complete source post-citation writes, with untouched court/pin-end represented explicitly.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationPostCaseMetadataResult extends S.Opaque<
  CitationPostCaseMetadataResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    patch: S.Option(CitationPostCaseMetadataPatch),
    reservedUnits: CitationLawMetadataResult.fields.reservedUnits,
  }).pipe(
    $I.annoteSchema("CitationPostCaseMetadataResult", {
      description: "Atomic post-case patch or no match and cumulative text reservation.",
    })
  )
) {}
const Input = S.toType(CitationPostCaseMetadataInput);
const Config = S.toType(CitationPostCaseMetadataConfiguration);
const pointLength = (word: CitationPythonUnicodeStorage | null) => (word === null ? 0 : word.bytes.length / word.width);
const prepare = Effect.fn("Citation.preparePostCaseMetadata")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationPublicationMetadataConfiguration,
  courtTable: string,
  raw: unknown
) {
  const request = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  const context = citationMetadataContext({ ...request, forward: true });
  const owned = yield* matchCitationMetadataContext(limits, runtime, config, { ...context, stringsOnly: false }, () =>
    fail("missing-capture")
  );
  if (O.isNone(owned)) return O.none<CitationPostCaseMetadataPatch>();
  const capture = owned.value.capture;
  const rawPin = yield* capture("pin_cite");
  const strings = yield* makeCitationMetadataStrings(limits, runtime, config.yearPattern, config.yearBindings);
  const cleanedPin = yield* strings.cleanPinCite(rawPin);
  const rawExtra = yield* capture("extra");
  const extra = yield* strings.stripWhitespace(rawExtra);
  const rawParenthetical = yield* capture("parenthetical");
  const parenthetical = yield* strings.parenthetical(rawParenthetical);
  let fullSpanEnd = request.spanEnd + owned.value.end;
  if (fullSpanEnd !== 0 && rawParenthetical !== null && parenthetical !== null)
    fullSpanEnd -= pointLength(rawParenthetical) - pointLength(parenthetical);
  const year = yield* capture("year");
  const month = yield* capture("month");
  const day = yield* capture("day");
  let numericYear = request.year;
  if (pointLength(year) > 0) {
    const years = yield* makeCitationMetadataYearFromBound(limits, config.highestValidYear);
    const parsedYear = yield* years.getYear(year);
    numericYear = O.getOrNull(parsedYear);
  }
  const rawCourt = yield* capture("court");
  let court = O.none<CourtId | null>();
  if (pointLength(rawCourt) > 0) {
    const courts = yield* makeCitationCourtLookup(limits, courtTable);
    const selected = yield* courts.lookup(rawCourt);
    court = selected.court.pipe(O.getOrNull, O.some);
  }
  return O.some(
    CitationPostCaseMetadataPatch.make({
      fullSpanEnd,
      year: numericYear,
      metadata: {
        pinCite: pointLength(cleanedPin) === 0 ? null : cleanedPin,
        extra,
        parenthetical,
        year,
        month,
        day,
        pinCiteSpanEnd: pointLength(rawPin) > 0 ? O.some(request.spanEnd + pointLength(rawPin)) : O.none(),
        court,
      },
    })
  );
});
/** Capture the source helper's owners without running later name, pre-citation,
 * court-guessing or superclass phases out of order. Methods have R = never.
 * Each invocation shares one budget/admission/deadline and owns its native Scope.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationPostCaseMetadata = Effect.fn("Citation.makePostCaseMetadata")(function* (
  policy: unknown,
  runtimeInput: unknown,
  configurationInput: unknown
) {
  const { limits, configuration: decoded } = yield* decodeCitationMetadataConfiguration(
    policy,
    configurationInput,
    Config,
    () => fail("invalid-configuration")
  );
  // Installation authenticates even when later input has no raw court capture.
  yield* makeCitationCourtLookup(limits, decoded.courtTable);
  const { runtime, config } = yield* prepareCitationPublicationMetadata(
    limits,
    runtimeInput,
    decoded,
    "173f538b2d3f8f2522eeb298388114e59bca173d00e03ac7f7b844f02c1be040",
    () => fail("invalid-configuration")
  );
  const installed = yield* makeCitationMetadataOperation(
    limits,
    (raw: unknown) => prepare(limits, runtime, config, decoded.courtTable, raw),
    () => fail("invalid-configuration")
  );
  const apply = Effect.fn("Citation.addPostCaseMetadata")(
    (raw: unknown) =>
      installed.operation.run(
        "extract",
        Effect.gen(function* () {
          const [patch, reservedUnits] = yield* installed.run(raw);
          return CitationPostCaseMetadataResult.make({ patch, reservedUnits });
        })
      ),
    installed.timing.timed
  );
  return { apply };
});
