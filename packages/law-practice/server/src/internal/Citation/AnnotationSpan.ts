/** Captured annotation span processing, separate from native text assembly.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationPythonUnicodeStorage, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import { CitationXmlKernelFailure } from "./XmlBalanceKernel.ts";
import { CitationXmlWorkerFailure } from "./XmlWorkerProtocol.ts";
import type * as Effect from "effect/Effect";
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
export const CitationAnnotationSpanFailure = S.Union([
  CitationXmlKernelFailure,
  CitationXmlWorkerFailure,
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
