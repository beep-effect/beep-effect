/** Unchecked annotation output assembly from eyecite 2.7.6 annotate.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationPythonUnicodeStorage,
  CitationSafetyLimitExceeded,
  CitationTextBudget,
} from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as MutableList from "effect/MutableList";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationAnnotationSpanDecision, CitationAnnotationSpanProcessor } from "./AnnotationSpan.ts";
import { concatCitationPythonRanges, normalizeCitationPythonSlice } from "./PythonUnicode.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationPythonSliceLayout, CitationPythonUnicodeValue } from "./PythonUnicode.ts";

const $I = $LawPracticeServerId.create("internal/Citation/AnnotationAssembly");
/** Prepared primitive annotation. Positions use Python points; no source proof is issued.
 * @internal @category models @since 0.0.0
 */
export class CitationAnnotationReplacement extends S.Opaque<
  CitationAnnotationReplacement,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    start: S.Int,
    end: S.Int,
    before: CitationPythonUnicodeStorage,
    after: CitationPythonUnicodeStorage,
  }).pipe(
    $I.annoteSchema("CitationAnnotationReplacement", {
      description: "Native primitive annotation tuple after source-defined sorting and offset preparation.",
    })
  )
) {}
const length = (value: CitationPythonUnicodeStorage) => value.bytes.length / value.width;
/** Capture the enclosing operation's budget. The caller owns validated immutable
 * native inputs, source-defined tuple sorting and offset mapping. Without a captured span processor this executes unchecked concatenation.
 * Captured processors may withhold/adjust spans before output commitment;
 * custom annotators remain separate required composition.
 * Invoke under the enclosing admitted operation Scope and captured deadline.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationAnnotationAssembly = Effect.fn("Citation.makeAnnotationAssembly")(function* (
  limits: CitationEngineLimits
) {
  const budget = yield* CitationTextBudget;
  const processor = yield* Effect.serviceOption(CitationAnnotationSpanProcessor);
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
    const ranges = MutableList.make<{
      readonly source: CitationPythonUnicodeStorage;
      readonly start: number;
      readonly end: number;
    }>();
    const append = (value: CitationPythonUnicodeStorage, start: number, end: number) => {
      const bounds = normalizeCitationPythonSlice(value, start, end);
      MutableList.append(ranges, { source: value, ...bounds });
    };
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
      append(source.storage, lastEnd, selected.start);
      append(replacement.before, 0, length(replacement.before));
      if (CitationAnnotationSpanDecision.guards.WrapText(selected)) append(selected.text, 0, length(selected.text));
      else append(source.storage, selected.start, selected.end);
      append(replacement.after, 0, length(replacement.after));
      return selected.end;
    });
    let lastEnd = 0;
    for (const replacement of ordered) {
      yield* Effect.yieldNow;
      lastEnd = yield* apply(replacement, lastEnd);
    }
    if (lastEnd < source.pythonLength) append(source.storage, lastEnd, source.pythonLength);
    return yield* concatCitationPythonRanges(MutableList.toArray(ranges), reserveOutput(source.utf16Units));
  });
  return { assemble };
});
