/** ResourceCitation.corrected_reporter/corrected_page from eyecite 2.7.6.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationFrozenEditions, readCitationFrozenEdition } from "./FrozenEditions.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { citationPythonPointAt, makeCitationPythonUnicode, sliceCitationPythonStorage } from "./PythonUnicode.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { CitationTextBudget, makeCitationTextBudget } from "./TextBudget.ts";
import type { CitationPythonUnicodeValue } from "./PythonUnicode.ts";

const $I = $LawPracticeServerId.create("internal/Citation/ResourceCorrection");
const Reason = LiteralKit(["invalid-input", "invalid-policy", "missing-reporter"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed resource correction failures without text or references." })
);
const Correctable = LiteralKit(["NY Slip Op", "Misc. 3d"]).pipe(
  $I.annoteSchema("Correctable", { description: "Exact source REPORTERS_THAT_NEED_PAGE_CORRECTION membership." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationResourceCorrectionFailure extends S.TaggedError<
  CitationResourceCorrectionFailure,
  { readonly brand: unique symbol }
>($I`CitationResourceCorrectionFailure`)(
  "CitationResourceCorrectionFailure",
  { reason: Reason },
  $I.annoteError<CitationResourceCorrectionFailure>("CitationResourceCorrectionFailure", {
    description: "Resource correction failed without source values or nested causes.",
  })
) {}
/** Missing keys and Python None remain distinct source group states.
 * @internal @category models @since 0.0.0
 */
export class CitationResourceCorrectionInput extends S.Opaque<
  CitationResourceCorrectionInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    reporter: CitationPythonUnicodeStorage.pipe(S.NullOr, S.optionalKey),
    page: CitationPythonUnicodeStorage.pipe(S.NullOr, S.optionalKey),
    editionGuess: S.NullOr(CitationEditionRef),
  }).pipe(
    $I.annoteSchema("CitationResourceCorrectionInput", {
      description: "Built-in native resource groups and optional authenticated edition guess.",
    })
  )
) {}
const correctable = S.is(Correctable);
const Input = S.toType(CitationResourceCorrectionInput);
const fail = (reason: typeof Reason.Type) => CitationResourceCorrectionFailure.make({ reason });
const writeAscii = (view: DataView, width: 1 | 2 | 4, index: number, point: number) => {
  if (width === 1) view.setUint8(index, point);
  else if (width === 2) view.setUint16(index * width, point, true);
  else view.setUint32(index * width, point, true);
};
const sourceMarkerAt = (source: CitationPythonUnicodeStorage, index: number) => {
  const middle = citationPythonPointAt(source, index + 1);
  return (
    citationPythonPointAt(source, index) === 91 &&
    citationPythonPointAt(source, index + 2) === 93 &&
    (middle === 85 || middle === 65)
  );
};
const correctPageMarkers = Effect.fn("Citation.correctNativePageMarkers")(function* (
  source: CitationPythonUnicodeValue,
  budget: CitationTextBudget["Service"]
) {
  const output = yield* sliceCitationPythonStorage(source.storage, 0, source.pythonLength, (layout) =>
    budget.reserve(layout.utf16Units)
  );
  const view = new DataView(output.bytes.buffer, output.bytes.byteOffset, output.bytes.byteLength);
  for (let index = 0; index + 2 < source.pythonLength; index++) {
    if (index % 256 === 0) yield* Effect.yieldNow;
    if (sourceMarkerAt(source.storage, index)) {
      writeAscii(view, output.width, index, 40);
      writeAscii(view, output.width, index + 2, 41);
    }
  }
  return output;
});
/** Capture existing edition, Unicode, budget and Clock owners. Each method has
 * R = never. A standalone call gets a fresh invocation budget; installed outer
 * budgets stay authoritative. Native ASCII substitution preserves literal
 * surrogate points that a JavaScript projection would coalesce on re-encoding.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationResourceCorrection = Effect.fn("Citation.makeResourceCorrection")(function* (policy: unknown) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => fail("invalid-policy"));
  const owner = yield* CitationFrozenEditions;
  const unicode = yield* makeCitationPythonUnicode(limits);
  const timing = yield* makeCitationRegexTiming(limits, true);
  const enclosing = yield* Effect.serviceOption(CitationTextBudget);
  if (O.isSome(enclosing) && enclosing.value.maximum > limits.producedTextUtf16) return yield* fail("invalid-policy");
  const prepare = Effect.fn("Citation.prepareResourceCorrection")(function* (raw: unknown) {
    const request = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
    const budget = O.isSome(enclosing) ? enclosing.value : yield* makeCitationTextBudget(limits);
    return { request, budget };
  });
  const reporter = Effect.fn("Citation.correctedReporter")(function* (raw: unknown) {
    const { request, budget } = yield* prepare(raw);
    if (request.editionGuess !== null) {
      const edition = yield* readCitationFrozenEdition(owner, request.editionGuess);
      return (yield* unicode.fromTextReserved(edition.value.short_name, budget.reserve)).storage;
    }
    if (request.reporter === undefined) return yield* fail("missing-reporter");
    return request.reporter === null
      ? null
      : (yield* unicode.fromStorageReserved(request.reporter, budget.reserve)).storage;
  }, timing.timed);
  const page = Effect.fn("Citation.correctedPage")(function* (raw: unknown) {
    const { request, budget } = yield* prepare(raw);
    const pageInput = O.fromNullishOr(request.page);
    if (O.isNone(pageInput)) return null;
    const source = yield* unicode.fromStorageReserved(pageInput.value, budget.reserve);
    const reporterInput = O.fromNullishOr(request.reporter).pipe(O.filter((value) => value.bytes.length > 0));
    if (O.isNone(reporterInput)) return source.storage;
    const rawReporter = yield* unicode.fromStorageReserved(reporterInput.value, budget.reserve);
    let standard = "";
    if (request.editionGuess !== null)
      standard = (yield* readCitationFrozenEdition(owner, request.editionGuess)).value.short_name;
    if (!correctable(rawReporter.text) && !correctable(standard)) return source.storage;
    return yield* correctPageMarkers(source, budget);
  }, timing.timed);
  return { reporter, page };
});
