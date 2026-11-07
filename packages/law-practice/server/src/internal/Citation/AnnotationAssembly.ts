/** Unchecked annotation output assembly from eyecite 2.7.6 annotate.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import {
  CitationAnnotationReplacement,
  CitationSafetyLimitExceeded,
  CitationTextBudget,
} from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as MutableList from "effect/MutableList";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import { captureCitationAnnotationReservation } from "./AnnotationBudget.ts";
import {
  CitationAnnotationCallbackFailure,
  CitationAnnotationCallbackResult,
  captureCitationAnnotationCallback,
} from "./AnnotationCallback.ts";
import { CitationAnnotationSpanDecision, CitationAnnotationSpanProcessor } from "./AnnotationSpan.ts";
import {
  concatCitationPythonRanges,
  normalizeCitationPythonSlice,
  sliceCitationPythonStorage,
} from "./PythonUnicode.ts";
import type { CitationEngineLimits, CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import type { CitationPythonSliceLayout, CitationPythonUnicodeValue } from "./PythonUnicode.ts";

const length = (value: CitationPythonUnicodeStorage) => value.bytes.length / value.width;
/** Capture the enclosing operation's budget. The caller owns validated immutable
 * native inputs, source-defined tuple sorting and offset mapping. Without a captured span processor this executes unchecked concatenation.
 * Captured processors may withhold/adjust spans before output commitment;
 * a captured native annotator replaces the complete annotated span.
 * Invoke under the enclosing admitted operation Scope and captured deadline.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationAnnotationAssembly = Effect.fn("Citation.makeAnnotationAssembly")(function* (
  limits: CitationEngineLimits
) {
  const budget = yield* CitationTextBudget;
  const processor = yield* Effect.serviceOption(CitationAnnotationSpanProcessor);
  const callback = yield* captureCitationAnnotationCallback(limits);
  const reserve = yield* captureCitationAnnotationReservation;
  const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
    CitationSafetyLimitExceeded.make({ operation: "annotate", limit });
  const reserveOutput = (sourceUnits: number) => (layout: CitationPythonSliceLayout) => {
    if (layout.utf16Units > limits.annotationOutputUtf16) return Effect.fail(safety("annotationOutputUtf16"));
    if (layout.utf16Units - sourceUnits > limits.annotationGrowthUtf16)
      return Effect.fail(safety("annotationGrowthUtf16"));
    return budget.reserve(layout.utf16Units).pipe(Effect.mapError((error) => safety(error.limit)));
  };
  const assemble = Effect.fn("Citation.assembleUncheckedAnnotations")(function* (
    source: CitationPythonUnicodeValue,
    ordered: ReadonlyArray<CitationAnnotationReplacement>
  ) {
    if (source.utf16Units > limits.sourceUtf16) return yield* safety("sourceUtf16");
    if (ordered.length > limits.annotationReplacements) return yield* safety("annotationReplacements");
    let nonText = false;
    const ranges = MutableList.make<{
      readonly source: CitationPythonUnicodeStorage;
      readonly start: number;
      readonly end: number;
    }>();
    const append = (value: CitationPythonUnicodeStorage, start: number, end: number) => {
      const bounds = normalizeCitationPythonSlice(value, start, end);
      MutableList.append(ranges, { source: value, ...bounds });
    };
    const readSpan = Effect.fn("Citation.readAnnotationCallbackSpan")(function* (
      selected: Exclude<CitationAnnotationSpanDecision, { _tag: "Skip" }>
    ) {
      const bounds = normalizeCitationPythonSlice(source.storage, selected.start, selected.end);
      return yield* sliceCitationPythonStorage(source.storage, bounds.start, bounds.end, (layout) =>
        reserve(layout.utf16Units)
      );
    });
    const emitDefault = (
      replacement: CitationAnnotationReplacement,
      selected: Exclude<CitationAnnotationSpanDecision, { _tag: "Skip" }>,
      lastEnd: number
    ) => {
      append(source.storage, lastEnd, selected.start);
      append(replacement.before, 0, length(replacement.before));
      if (CitationAnnotationSpanDecision.guards.WrapText(selected)) append(selected.text, 0, length(selected.text));
      else append(source.storage, selected.start, selected.end);
      append(replacement.after, 0, length(replacement.after));
      return false;
    };
    const emit = Effect.fn("Citation.emitAnnotationSpan")(function* (
      replacement: CitationAnnotationReplacement,
      selected: Exclude<CitationAnnotationSpanDecision, { _tag: "Skip" }>,
      lastEnd: number
    ) {
      if (O.isNone(callback)) return emitDefault(replacement, selected, lastEnd);
      const span = CitationAnnotationSpanDecision.guards.WrapText(selected) ? selected.text : yield* readSpan(selected);
      const rendered = yield* callback.value.render(replacement.before, span, replacement.after);
      append(source.storage, lastEnd, selected.start);
      if (CitationAnnotationCallbackResult.guards.NonText(rendered)) return true;
      append(rendered.text, 0, length(rendered.text));
      return false;
    });
    const apply = Effect.fn("Citation.applyAnnotationSpan")(function* (
      replacement: CitationAnnotationReplacement,
      lastEnd: number
    ) {
      const start = Num.max(replacement.start, lastEnd);
      const end = replacement.end;
      if (replacement.start < lastEnd && start >= end) return lastEnd;
      const selected = O.isSome(processor)
        ? yield* processor.value.prepare(source, CitationAnnotationReplacement.make({ ...replacement, start }))
        : CitationAnnotationSpanDecision.cases.WrapSlice.make({ start, end });
      if (CitationAnnotationSpanDecision.guards.Skip(selected)) return lastEnd;
      nonText = (yield* emit(replacement, selected, lastEnd)) || nonText;
      return selected.end;
    });
    let lastEnd = 0;
    for (const replacement of ordered) {
      yield* Effect.yieldNow;
      lastEnd = yield* apply(replacement, lastEnd);
    }
    if (nonText) return yield* CitationAnnotationCallbackFailure.make({ reason: "invalid-result" });
    if (lastEnd < source.pythonLength) append(source.storage, lastEnd, source.pythonLength);
    return yield* concatCitationPythonRanges(MutableList.toArray(ranges), reserveOutput(source.utf16Units));
  });
  return { assemble };
});
