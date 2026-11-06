/** Captured annotation span processing, separate from native text assembly.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationPythonUnicodeStorage, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { captureCitationAnnotationReservation } from "./AnnotationBudget.ts";
import { CitationAnnotationTemplateFailure } from "./AnnotationTemplate.ts";
import {
  findCitationPythonLiteral,
  normalizeCitationPythonSlice,
  sliceCitationPythonStorage,
} from "./PythonUnicode.ts";
import { CitationXmlKernelFailure } from "./XmlBalanceKernel.ts";
import { CitationXmlBalance } from "./XmlWorker.ts";
import { CitationXmlWorkerFailure } from "./XmlWorkerProtocol.ts";
import type { CitationAnnotationReplacement } from "./AnnotationAssembly.ts";
import type { CitationPythonUnicodeValue } from "./PythonUnicode.ts";

const $I = $LawPracticeServerId.create("internal/Citation/AnnotationSpan");
const Range = { start: S.Int, end: S.Int };
/** @internal @category models @since 0.0.0 */
export const CitationAnnotationSpanDecision = S.TaggedUnion({
  Skip: {},
  WrapSlice: Range,
  WrapText: { ...Range, text: CitationPythonUnicodeStorage },
}).pipe(
  $I.annoteSchema("CitationAnnotationSpanDecision", {
    description: "Withheld annotation or selected original/native replacement span; no source proof authority.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationAnnotationSpanDecision = typeof CitationAnnotationSpanDecision.Type;
/** @internal @category errors @since 0.0.0 */
export class CitationAnnotationMatchFailure extends S.TaggedError<
  CitationAnnotationMatchFailure,
  { readonly brand: unique symbol }
>($I`CitationAnnotationMatchFailure`)(
  "CitationAnnotationMatchFailure",
  { reason: S.Literals(["native-refused", "invalid-capture"]) },
  $I.annoteError<CitationAnnotationMatchFailure>("CitationAnnotationMatchFailure", {
    description: "Closed annotation matcher failure without native diagnostics or source values.",
  })
) {}
/** @internal @category errors @since 0.0.0 */
export const CitationAnnotationSpanFailure = S.Union([
  CitationXmlKernelFailure,
  CitationXmlWorkerFailure,
  CitationAnnotationTemplateFailure,
  CitationAnnotationMatchFailure,
  CitationSafetyLimitExceeded,
]).pipe(
  $I.annoteSchema("CitationAnnotationSpanFailure", {
    description: "Closed source-free span processing refusals; final engine translation remains separate.",
  })
);
/** @internal @category errors @since 0.0.0 */
export type CitationAnnotationSpanFailure = typeof CitationAnnotationSpanFailure.Type;
/** The enclosing owner captures policy, allocation and native dependencies.
 * No callback is encoded in a request and every method has R=never.
 * @internal @category services @since 0.0.0
 */
export class CitationAnnotationSpanProcessor extends Context.Service<
  CitationAnnotationSpanProcessor,
  {
    readonly prepare: (
      source: CitationPythonUnicodeValue,
      replacement: CitationAnnotationReplacement
    ) => Effect.Effect<CitationAnnotationSpanDecision, CitationAnnotationSpanFailure>;
  }
>()($I`CitationAnnotationSpanProcessor`) {}

/** Borrowed XML no-angle fast path shared by skip/wrap composition.
 * @internal @category operations @since 0.0.0
 */
const left = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array([60]) });
const right = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array([62]) });
export const hasCitationAnnotationAngles = Effect.fn("Citation.annotationHasAngles")(function* (
  source: CitationPythonUnicodeStorage,
  start: number,
  end: number
) {
  const opening = yield* findCitationPythonLiteral(source, left, start, end);
  if (O.isSome(opening)) return true;
  const closing = yield* findCitationPythonLiteral(source, right, start, end);
  return O.isSome(closing);
});

/** Capture the shared XML/borrowed-range path and delegate only an unbalanced
 * span to the installed strategy. The callback is trusted server composition,
 * never request data. No annotation state is committed before it succeeds.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationMarkupAnnotationSpans = Effect.fn("Citation.makeMarkupAnnotationSpans")(function* (
  unbalanced: (
    source: CitationPythonUnicodeValue,
    replacement: CitationAnnotationReplacement,
    text: CitationPythonUnicodeStorage
  ) => Effect.Effect<CitationAnnotationSpanDecision, CitationAnnotationSpanFailure>
) {
  const reserve = yield* captureCitationAnnotationReservation;
  const xml = yield* CitationXmlBalance;
  const prepare = Effect.fn("Citation.prepareMarkupAnnotationSpan")(function* (
    source: CitationPythonUnicodeValue,
    replacement: CitationAnnotationReplacement
  ) {
    const { start, end } = replacement;
    if (!(yield* hasCitationAnnotationAngles(source.storage, start, end)))
      return CitationAnnotationSpanDecision.cases.WrapSlice.make({ start, end });
    const range = normalizeCitationPythonSlice(source.storage, start, end);
    const text = yield* sliceCitationPythonStorage(source.storage, range.start, range.end, (layout) =>
      reserve(layout.utf16Units)
    );
    if (yield* xml.balance(text)) return CitationAnnotationSpanDecision.cases.WrapText.make({ start, end, text });
    return yield* unbalanced(source, replacement, text);
  });
  return CitationAnnotationSpanProcessor.of({ prepare });
});
