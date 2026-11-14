/** Original primitive annotation tuple order and left/right offset preparation.
 * Free Law Project eyecite 2.7.6 annotate.py, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationAnnotationReplacement, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import { citationPythonPointAt } from "./PythonUnicode.ts";
import { makeCitationSpanOffsets } from "./SpanOffsets.ts";
import type { CitationEngineLimits, CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import type { installCitationHtmlGeometry } from "./HtmlGeometryPreparation.ts";

// JavaScript's UTF-16 lexical order is not Python's native code-point order.
const nativeOrder = Order.make<CitationPythonUnicodeStorage>((left, right) => {
  const leftLength = left.bytes.length / left.width;
  const rightLength = right.bytes.length / right.width;
  const common = Num.min(leftLength, rightLength);
  for (let index = 0; index < common; index++) {
    const result = Num.Order(citationPythonPointAt(left, index), citationPythonPointAt(right, index));
    if (result !== 0) return result;
  }
  return Num.Order(leftLength, rightLength);
});
const tupleOrder = Order.mapInput(
  Order.Tuple([Num.Order, Num.Order, nativeOrder, nativeOrder]),
  (row: CitationAnnotationReplacement) => [row.start, row.end, row.before, row.after] as const
);
/** Prepare trusted immutable primitive tuples in original sorted order before
 * applying the captured source map. Inputs and optional map are owner-issued,
 * not request callbacks. Effect Array/Order supply the sort; no second sorting
 * implementation is introduced. Arbitrary host tuple comparisons and complete
 * sorting isolation/scaling remain separate qualification obligations.
 * @internal @category operations @since 0.0.0
 */
export const prepareCitationAnnotations = Effect.fn("Citation.prepareAnnotations")(function* (
  limits: CitationEngineLimits,
  replacements: ReadonlyArray<CitationAnnotationReplacement>,
  updater: O.Option<Pick<Effect.Success<ReturnType<typeof makeCitationSpanOffsets>>, "update">> = O.none()
) {
  if (replacements.length > limits.annotationReplacements)
    return yield* CitationSafetyLimitExceeded.make({ operation: "annotate", limit: "annotationReplacements" });
  yield* Effect.yieldNow;
  const ordered = A.sort(replacements, tupleOrder);
  if (O.isNone(updater)) return ordered;
  return yield* Effect.forEach(
    ordered,
    Effect.fn("Citation.mapAnnotationOffsets")(function* (replacement) {
      const start = yield* updater.value.update(replacement.start, "right");
      const end = yield* updater.value.update(replacement.end, "left");
      return CitationAnnotationReplacement.make({ ...replacement, start, end });
    })
  );
});

/** Build an implicit annotation source map with existing placeholder discovery,
 * exact native diff and offset indexing. Invoke only for the original changed,
 * nonempty source branch, under the enclosing operation's captured ownership.
 * A supplied updater uses prepareCitationAnnotations directly and does not run
 * this expensive branch. No backward map or emphasis scan is needed here.
 * @internal @category operations @since 0.0.0
 */
export const prepareCitationAnnotationSourceMap = Effect.fn("Citation.prepareAnnotationSourceMap")(function* (
  limits: CitationEngineLimits,
  html: Effect.Success<ReturnType<typeof installCitationHtmlGeometry>>,
  plain: CitationPythonUnicodeStorage,
  markup: CitationPythonUnicodeStorage,
  useDmp = true
) {
  const forward = yield* html.forward(markup, Effect.succeed(plain), useDmp);
  const updater = yield* makeCitationSpanOffsets(limits, forward.forward);
  return { source: forward.source.value, updater };
});
