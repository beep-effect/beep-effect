/** Original full/short HTML-to-plain name fallback from models.py/find.py.
 * Free Law Project eyecite 2.7.6, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  CitationCaseNameConfiguration,
  CitationCaseNameInput,
  citationCaseNameWordText,
  copyCitationCaseNameConfiguration,
  findCitationPlainCaseName,
} from "./CaseName.ts";
import { CitationCaseNameProcessPatch, citationUnchangedCaseNamePatch } from "./CaseNameProcess.ts";
import { CitationCaseNameScanFailure } from "./CaseNameScan.ts";
import {
  CitationHtmlCaseNameConfiguration,
  copyCitationHtmlCaseNameConfiguration,
  extractCitationHtmlCaseName,
} from "./HtmlCaseName.ts";
import { CitationHtmlTagGeometryInput } from "./HtmlTagGeometry.ts";
import { decodeCitationMetadataWordRequest, makeCitationMetadataStage } from "./MetadataComposition.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/CaseNameSelection");
const Mode = LiteralKit(["Full", "Short"]).pipe(
  $I.annoteSchema("Mode", { description: "Original caller selects defendant or antecedent as the fallback field." })
);
/** @internal @category models @since 0.0.0 */
export class CitationCaseNameSelectionConfiguration extends S.Opaque<
  CitationCaseNameSelectionConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({ plain: CitationCaseNameConfiguration, html: CitationHtmlCaseNameConfiguration }).pipe(
    $I.annoteSchema("CitationCaseNameSelectionConfiguration", {
      description: "Owned HTML and plain helper configurations under one operation authority.",
    })
  )
) {}
/** currentName is the actual pre-name defendant/antecedent field, including empty text.
 * @internal @category models @since 0.0.0
 */
export class CitationCaseNameSelectionInput extends S.Opaque<
  CitationCaseNameSelectionInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    words: S.Array(S.Struct({ ...CitationCaseNameInput.fields.words.value.fields, start: S.NullOr(S.Int) })).check(
      S.isMaxLength(CitationEngineAbsoluteMaxima.tokens)
    ),
    index: CitationCaseNameInput.fields.index,
    spanStart: CitationCaseNameInput.fields.spanStart,
    mode: Mode,
    currentName: S.NullOr(CitationPythonUnicodeStorage),
    geometry: S.Option(CitationHtmlTagGeometryInput),
  }).pipe(
    $I.annoteSchema("CitationCaseNameSelectionInput", {
      description: "Built-in token values, pre-name field and optional prepared HTML geometry; no host callbacks.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationCaseNameSelectionResult extends S.Opaque<
  CitationCaseNameSelectionResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    patch: CitationCaseNameProcessPatch,
    usedHtml: S.Boolean,
    usedPlain: S.Boolean,
    reservedUnits: S.Natural,
  }).pipe(
    $I.annoteSchema("CitationCaseNameSelectionResult", {
      description: "Atomic ordered helper patch, original fallback decisions and invocation reservations.",
    })
  )
) {}
const invalid = () => CitationCaseNameScanFailure.make({ reason: "invalid-configuration" });
const merge = (before: CitationCaseNameProcessPatch, after: CitationCaseNameProcessPatch) =>
  CitationCaseNameProcessPatch.make({
    plaintiff: O.orElse(after.plaintiff, () => before.plaintiff),
    defendant: O.orElse(after.defendant, () => before.defendant),
    antecedentGuess: O.orElse(after.antecedentGuess, () => before.antecedentGuess),
    year: O.orElse(after.year, () => before.year),
    numericYear: O.orElse(after.numericYear, () => before.numericYear),
    fullSpanStart: O.orElse(after.fullSpanStart, () => before.fullSpanStart),
  });
/** Reuse the original helper within an enclosing captured metadata operation.
 * @internal @category operations @since 0.0.0
 */
export const selectCitationCaseName = Effect.fn("Citation.selectCaseNameHelpers")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationCaseNameSelectionConfiguration,
  raw: unknown
) {
  const request = yield* decodeCitationMetadataWordRequest(limits, S.toType(CitationCaseNameSelectionInput), raw, () =>
    CitationCaseNameScanFailure.make({ reason: "invalid-input" })
  );
  const short = request.mode === "Short";
  let patch = citationUnchangedCaseNamePatch;
  if (O.isSome(request.geometry)) {
    const html = yield* extractCitationHtmlCaseName(limits, runtime, config.html, {
      words: A.map(request.words, (word) => ({
        kind: word.kind,
        data: citationCaseNameWordText(word.data),
        start: word.start,
        stopWord: O.getOrElse(R.get(word.groups, "stop_word"), () => null),
      })),
      index: request.index,
      spanStart: request.spanStart,
      short,
      geometry: request.geometry.value,
    });
    patch = CitationCaseNameProcessPatch.make({ ...patch, ...html });
    const selected = short ? patch.antecedentGuess : patch.defendant;
    // The source checks `is None`; an empty assignment or retained empty field
    // suppresses fallback just like a nonempty field.
    if (O.getOrElse(selected, () => request.currentName) !== null) return { patch, usedHtml: true, usedPlain: false };
  }
  const plain = yield* findCitationPlainCaseName(limits, runtime, config.plain, { ...request, short });
  return { patch: merge(patch, plain.patch), usedHtml: O.isSome(request.geometry), usedPlain: true };
});
/** Reuse the original helper within an enclosing captured metadata operation.
 * @internal @category operations @since 0.0.0
 */
export const copyCitationCaseNameSelectionConfiguration = Effect.fn("Citation.ownCaseNameSelection")(function* (
  limits: CitationEngineLimits,
  config: CitationCaseNameSelectionConfiguration
) {
  const plain = yield* copyCitationCaseNameConfiguration(limits, config.plain);
  const html = yield* copyCitationHtmlCaseNameConfiguration(limits, config.html);
  return CitationCaseNameSelectionConfiguration.make({ plain, html });
});
/** HTML and fallback share one operation, Scope, text budget and deadline. The
 * enclosing model supplies its actual current field; extract requires R=never.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationCaseNameSelection = makeCitationMetadataStage({
  method: "extract",
  schema: S.toType(CitationCaseNameSelectionConfiguration),
  invalid,
  own: copyCitationCaseNameSelectionConfiguration,
  prepare: selectCitationCaseName,
  project: (result, reservedUnits) => CitationCaseNameSelectionResult.make({ ...result, reservedUnits }),
});
