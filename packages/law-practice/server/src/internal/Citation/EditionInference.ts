/** Edition.includes_year and ResourceCitation.guess_edition from eyecite 2.7.6.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationFrozenEditions } from "./FrozenEditions.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("internal/Citation/EditionInference");
const Reason = LiteralKit(["invalid-input", "invalid-edition", "invalid-clock"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed edition inference failures without references or payloads." })
);
const Source = LiteralKit(["reporters", "laws", "journals"]).pipe(
  $I.annoteSchema("Source", { description: "Authenticated source artifact families." })
);
const Family = LiteralKit(["case", "law", "journal"]).pipe(
  $I.annoteSchema("Family", { description: "Existing edition lookup family routing." })
);
const Year = S.FiniteFromString.check(S.isInt(), S.isBetween({ minimum: 1, maximum: 9999 })).pipe(
  $I.annoteSchema("Year", { description: "Year prefix from an authenticated Python datetime payload." })
);
const CurrentYear = S.Int.check(S.isBetween({ minimum: 1, maximum: 9999 })).pipe(
  $I.annoteSchema("CurrentYear", { description: "Supported live source calendar year." })
);
const Refs = S.Array(CitationEditionRef)
  .check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates))
  .pipe($I.annoteSchema("Refs", { description: "Ordered edition occurrences, including duplicates." }));
/** @internal @category errors @since 0.0.0 */
export class CitationEditionInferenceFailure extends S.TaggedError<
  CitationEditionInferenceFailure,
  { readonly brand: unique symbol }
>($I`CitationEditionInferenceFailure`)(
  "CitationEditionInferenceFailure",
  { reason: Reason },
  $I.annoteError<CitationEditionInferenceFailure>("CitationEditionInferenceFailure", {
    description: "Edition inference failed without source values or nested causes.",
  })
) {}
/** Source sequences preserve duplicates and exact-before-variation priority.
 * @internal @category models @since 0.0.0
 */
export class CitationEditionInferenceInput extends S.Opaque<
  CitationEditionInferenceInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({ exact: Refs, variation: Refs, year: S.NullOr(S.Int), prior: S.NullOr(CitationEditionRef) }).pipe(
    $I.annoteSchema("CitationEditionInferenceInput", {
      description: "Source citation state before guess_edition, including an existing guess.",
    })
  )
) {}
const Input = S.toType(CitationEditionInferenceInput);
const Envelope = S.Struct({ exact: S.Unknown, variation: S.Unknown, year: S.Unknown, prior: S.Unknown }).pipe(
  $I.annoteSchema("Envelope", { description: "Container-only preflight before receiving candidate arrays." })
);
const fail = (reason: typeof Reason.Type) => CitationEditionInferenceFailure.make({ reason });
const dateYear = (text: string) =>
  S.decodeEffect(Year)(Str.slice(0, 4)(text)).pipe(Effect.mapError(() => fail("invalid-edition")));
/** Decode and bound ordered candidates before any dependent stage allocates.
 * @internal @category operations @since 0.0.0
 */
export const prepareCitationEditionInferenceInput = Effect.fn("Citation.prepareEditionInferenceInput")(function* (
  limits: CitationEngineLimits,
  raw: unknown
) {
  const envelope = yield* S.decodeUnknownEffect(Envelope)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  if (!A.isArray(envelope.exact) || !A.isArray(envelope.variation)) return yield* fail("invalid-input");
  if (envelope.exact.length + envelope.variation.length > limits.candidates)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "candidates" });
  return yield* S.decodeUnknownEffect(Input)(envelope).pipe(Effect.mapError(() => fail("invalid-input")));
});
/** Capture the authenticated payload owner, Clock and zone; calendar reads stay
 * live at each includes_year call. No source module-import bound is substituted.
 * Methods have R = never. This performs selection only, not reporter correction.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationEditionInference = Effect.fn("Citation.makeEditionInference")(function* (policy: unknown) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => fail("invalid-input"));
  const editions = yield* CitationFrozenEditions;
  const zone = yield* DateTime.CurrentTimeZone;
  const timing = yield* makeCitationRegexTiming(limits, true);
  const includesYear = Effect.fn("Citation.editionIncludesYear")(function* (reference: unknown, yearInput: unknown) {
    const ref = yield* S.decodeUnknownEffect(CitationEditionRef)(reference).pipe(
      Effect.mapError(() => fail("invalid-input"))
    );
    const year = yield* S.decodeUnknownEffect(S.Int)(yearInput).pipe(Effect.mapError(() => fail("invalid-input")));
    const now = yield* DateTime.nowInCurrentZone.pipe(Effect.provideService(DateTime.CurrentTimeZone, zone));
    const current = yield* S.decodeEffect(CurrentYear)(DateTime.getPart(now, "year")).pipe(
      Effect.mapError(() => fail("invalid-clock"))
    );
    if (year > current) return false;
    const source = yield* editions.source(ref);
    const checked = yield* S.decodeUnknownEffect(Source)(source).pipe(Effect.mapError(() => fail("invalid-edition")));
    const family = Source.match(checked, {
      reporters: () => Family.Enum.case,
      laws: () => Family.Enum.law,
      journals: () => Family.Enum.journal,
    });
    const edition = yield* editions.lookup(ref, family);

    if (edition.value.start !== null && (yield* dateYear(edition.value.start)) > year) return false;
    return edition.value.end === null || (yield* dateYear(edition.value.end)) >= year;
  }, timing.timed);
  const guess = Effect.fn("Citation.guessEdition")(function* (raw: unknown) {
    const request = yield* prepareCitationEditionInferenceInput(limits, raw);
    const selected = request.exact.length > 0 ? request.exact : request.variation;
    const candidates =
      selected.length > 1 && request.year !== null && request.year !== 0
        ? yield* Effect.filter(selected, (ref) => includesYear(ref, request.year), { concurrency: 1 })
        : selected;
    return candidates.length === 1 ? A.getUnsafe(candidates, 0) : request.prior;
  }, timing.timed);
  return { includesYear, guess };
});
