/** Built-in corrected_citation_full/formatted behavior from eyecite 2.7.6.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as MutableList from "effect/MutableList";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationFrozenEditions } from "./FrozenEditions.ts";
import { CitationMetadataStringFields } from "./MetadataComposition.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { concatCitationPythonRanges, makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { CitationResourceCitationCorrectionInput, makeCitationResourceCorrection } from "./ResourceCorrection.ts";
import { CitationTextBudget, makeCitationTextBudget } from "./TextBudget.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("internal/Citation/Rendering");
const Value = CitationPythonUnicodeStorage.pipe(S.NullOr);
const Common = CitationMetadataStringFields.fields;
const Resource = CitationResourceCitationCorrectionInput.fields;
const Reason = LiteralKit(["invalid-input", "invalid-policy"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed rendering failures without source text or nested causes." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationRenderingFailure extends S.TaggedError<
  CitationRenderingFailure,
  { readonly brand: unique symbol }
>($I`CitationRenderingFailure`)(
  "CitationRenderingFailure",
  { reason: Reason },
  $I.annoteError<CitationRenderingFailure>("CitationRenderingFailure", {
    description: "Built-in citation rendering failed without publishing partial text.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationRenderingFailure.make({ reason });
/** @internal @category models @since 0.0.0 */
export class CitationMatchedRendering extends S.Opaque<CitationMatchedRendering, { readonly brand: unique symbol }>()(
  S.Struct({ mode: S.tag("matched"), matchedText: CitationPythonUnicodeStorage }).pipe(
    $I.annoteSchema("CitationMatchedRendering", {
      description:
        "Inherited corrected_citation_full returns matched text without resource correction or metadata reads.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationLawRendering extends S.Opaque<CitationLawRendering, { readonly brand: unique symbol }>()(
  S.Struct({
    ...Resource,
    mode: S.tag("law"),
    metadata: S.Struct({ ...Common, publisher: Value, month: Value, day: Value }),
  }).pipe(
    $I.annoteSchema("CitationLawRendering", {
      description: "Source full-law correction, pin and publisher/date metadata.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationJournalRendering extends S.Opaque<CitationJournalRendering, { readonly brand: unique symbol }>()(
  S.Struct({ ...Resource, mode: S.tag("journal"), metadata: S.Struct(Common) }).pipe(
    $I.annoteSchema("CitationJournalRendering", {
      description: "Source full-journal correction, pin, year and parenthetical.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationCaseRendering extends S.Opaque<CitationCaseRendering, { readonly brand: unique symbol }>()(
  S.Struct({
    ...Resource,
    mode: S.tag("case"),
    metadata: S.Struct({ ...Common, plaintiff: Value, defendant: Value, extra: Value, court: Value }),
  }).pipe(
    $I.annoteSchema("CitationCaseRendering", {
      description: "Source full-case correction with independent party names and court/year metadata.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationShortRendering extends S.Opaque<CitationShortRendering, { readonly brand: unique symbol }>()(
  S.Struct({ ...Resource, mode: S.tag("short"), metadata: S.Struct({ antecedentGuess: Value }) }).pipe(
    $I.annoteSchema("CitationShortRendering", {
      description: "Source short-case antecedent prefix and corrected resource text.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationSupraRendering extends S.Opaque<CitationSupraRendering, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: S.tag("supra"),
    metadata: S.Struct({ antecedentGuess: Value, volume: Value, pinCite: Value }),
  }).pipe(
    $I.annoteSchema("CitationSupraRendering", {
      description: "SupraCitation.formatted uses metadata and literal supra, independently of matched text.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationIdRendering extends S.Opaque<CitationIdRendering, { readonly brand: unique symbol }>()(
  S.Struct({ mode: S.tag("id"), metadata: S.Struct({ pinCite: Value }) }).pipe(
    $I.annoteSchema("CitationIdRendering", {
      description: "IdCitation.formatted uses literal id. and optional native pin metadata.",
    })
  )
) {}
/** Closed private built-in rendering operations; executable composition stays in the server.
 * @internal @category models @since 0.0.0
 */
export const CitationRenderingInput = S.Union([
  CitationMatchedRendering,
  CitationLawRendering,
  CitationJournalRendering,
  CitationCaseRendering,
  CitationShortRendering,
  CitationSupraRendering,
  CitationIdRendering,
]).pipe(
  S.toTaggedUnion("mode"),
  $I.annoteSchema("CitationRenderingInput", {
    description: "Distinct source rendering methods with only the native fields each method reads.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationRenderingInput = typeof CitationRenderingInput.Type;
const Input = S.toType(CitationRenderingInput);
const nonempty = (value: CitationPythonUnicodeStorage | null): value is CitationPythonUnicodeStorage =>
  value !== null && value.bytes.length > 0;
const makeParts = Effect.fn("Citation.makeRenderingParts")(function* (
  limits: CitationEngineLimits,
  budget: CitationTextBudget["Service"]
) {
  const unicode = yield* makeCitationPythonUnicode(limits);
  const ranges = MutableList.make<{
    readonly source: CitationPythonUnicodeStorage;
    readonly start: number;
    readonly end: number;
  }>();
  const owned = (source: CitationPythonUnicodeStorage) =>
    MutableList.append(ranges, { source, start: 0, end: source.bytes.length / source.width });
  const literal = Effect.fn("Citation.appendRenderingLiteral")(function* (text: string) {
    if (text.length > 0) {
      const native = yield* unicode.fromTextReserved(text, budget.reserve);
      owned(native.storage);
    }
  });
  const value = Effect.fn("Citation.appendRenderingValue")(function* (
    source: CitationPythonUnicodeStorage | null,
    prefix = "",
    suffix = ""
  ) {
    if (!nonempty(source)) return;
    const native = yield* unicode.fromStorageReserved(source, budget.reserve);
    yield* literal(prefix);
    owned(native.storage);
    yield* literal(suffix);
  });
  const date = Effect.fn("Citation.appendRenderingDate")(function* (
    inputs: ReadonlyArray<CitationPythonUnicodeStorage | null>
  ) {
    const values = A.filter(inputs, nonempty);
    if (values.length === 0) return;
    yield* literal(" (");
    for (let index = 0; index < values.length; index++) {
      if (index > 0) yield* literal(" ");
      const item = A.getUnsafe(values, index);
      yield* value(item);
    }
    yield* literal(")");
  });
  const finish = () =>
    concatCitationPythonRanges(MutableList.takeAll(ranges), (layout) => budget.reserve(layout.utf16Units));
  return { owned, literal, value, date, finish };
});
/** Capture existing frozen editions and timing, then compose original correction
 * and native metadata assembly under one fresh or installed invocation budget.
 * Methods have R = never. Matched-only, Id. and supra methods never consult an
 * edition or resource group. Only a complete owned native result is returned.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationRendering = Effect.fn("Citation.makeRendering")(function* (policy: unknown) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => fail("invalid-policy"));
  const owner = yield* CitationFrozenEditions;
  const enclosing = yield* Effect.serviceOption(CitationTextBudget);
  if (O.isSome(enclosing) && enclosing.value.maximum > limits.producedTextUtf16) return yield* fail("invalid-policy");
  const timing = yield* makeCitationRegexTiming(limits, true);
  const render = Effect.fn("Citation.renderBuiltInCitation")(function* (raw: unknown) {
    const request = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
    const budget = O.isSome(enclosing) ? enclosing.value : yield* makeCitationTextBudget(limits);
    const parts = yield* makeParts(limits, budget);
    const correction = yield* makeCitationResourceCorrection(limits).pipe(
      Effect.provideService(CitationFrozenEditions, owner),
      Effect.provideService(CitationTextBudget, budget)
    );
    const corrected = Effect.fn("Citation.appendCorrectedRendering")(function* (input: unknown) {
      const value = yield* correction.citation(input);
      parts.owned(value);
    });
    yield* CitationRenderingInput.match(request, {
      matched: Effect.fn("Citation.renderMatched")(function* (input) {
        yield* parts.value(input.matchedText);
      }),
      law: Effect.fn("Citation.renderLaw")(function* (input) {
        const m = input.metadata;
        yield* corrected(input);
        yield* parts.value(m.pinCite);
        yield* parts.date([m.publisher, m.month, m.day, m.year]);
        yield* parts.value(m.parenthetical, " (", ")");
      }),
      journal: Effect.fn("Citation.renderJournal")(function* (input) {
        const m = input.metadata;
        yield* corrected(input);
        yield* parts.value(m.pinCite, ", ");
        yield* parts.date([m.year]);
        yield* parts.value(m.parenthetical, " (", ")");
      }),
      case: Effect.fn("Citation.renderCase")(function* (input) {
        const m = input.metadata;
        yield* parts.value(m.plaintiff, "", " v. ");
        yield* parts.value(m.defendant, "", ", ");
        yield* corrected(input);
        yield* parts.value(m.pinCite, ", ");
        yield* parts.value(m.extra);
        yield* parts.date([m.court, m.year]);
        yield* parts.value(m.parenthetical, " (", ")");
      }),
      short: Effect.fn("Citation.renderShort")(function* (input) {
        yield* parts.value(input.metadata.antecedentGuess, "", ", ");
        yield* corrected(input);
      }),
      supra: Effect.fn("Citation.renderSupra")(function* (input) {
        yield* parts.value(input.metadata.antecedentGuess, "", ", ");
        yield* parts.value(input.metadata.volume, "", " ");
        yield* parts.literal("supra");
        yield* parts.value(input.metadata.pinCite, ", ");
      }),
      id: Effect.fn("Citation.renderId")(function* (input) {
        yield* parts.literal("id.");
        yield* parts.value(input.metadata.pinCite, ", ");
      }),
    });
    return yield* parts.finish();
  }, timing.timed);
  return { render };
});
