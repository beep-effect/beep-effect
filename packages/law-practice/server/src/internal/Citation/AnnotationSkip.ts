/** Original annotate_citations(unbalanced_tags="skip") span selection.
 * Free Law Project eyecite 2.7.6, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import {
  CitationPythonUnicodeStorage,
  CitationSafetyLimitExceeded,
  CitationTextBudget,
} from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { CitationAnnotationSpanDecision, CitationAnnotationSpanProcessor } from "./AnnotationSpan.ts";
import { makeCitationStyleTagBalancer } from "./AnnotationStyle.ts";
import {
  findCitationPythonLiteral,
  normalizeCitationPythonSlice,
  sliceCitationPythonStorage,
} from "./PythonUnicode.ts";
import { CitationXmlBalance } from "./XmlWorker.ts";
import type { CitationAnnotationReplacement } from "./AnnotationAssembly.ts";
import type { CitationPythonUnicodeValue } from "./PythonUnicode.ts";

const left = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array([60]) });
const right = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array([62]) });
const hasAngles = Effect.fn("Citation.annotationHasAngles")(function* (
  source: CitationPythonUnicodeStorage,
  start: number,
  end: number
) {
  const opening = yield* findCitationPythonLiteral(source, left, start, end);
  if (O.isSome(opening)) return true;
  const closing = yield* findCitationPythonLiteral(source, right, start, end);
  return O.isSome(closing);
});
/** Capture the existing XML and style capabilities within one operation. The
 * no-angle fast path borrows the original range and starts no parser process.
 * Failed initial XML checks attempt style expansion, check again, then skip
 * without advancing assembly state if still unbalanced. No raw text is logged.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationSkipAnnotationSpans = Effect.fn("Citation.makeSkipAnnotationSpans")(function* () {
  const budget = yield* CitationTextBudget;
  const xml = yield* CitationXmlBalance;
  const styles = yield* makeCitationStyleTagBalancer();
  const reserve = (units: number) =>
    budget
      .reserve(units)
      .pipe(
        Effect.mapError((error) => CitationSafetyLimitExceeded.make({ operation: "annotate", limit: error.limit }))
      );
  const balanced = Effect.fn("Citation.checkExpandedAnnotationSpan")(function* (text: CitationPythonUnicodeStorage) {
    if (!(yield* hasAngles(text, 0, text.bytes.length / text.width))) return true;
    return yield* xml.balance(text);
  });
  const prepare = Effect.fn("Citation.prepareSkippedAnnotationSpan")(function* (
    source: CitationPythonUnicodeValue,
    replacement: CitationAnnotationReplacement
  ) {
    const { start, end } = replacement;
    if (!(yield* hasAngles(source.storage, start, end)))
      return CitationAnnotationSpanDecision.cases.WrapSlice.make({ start, end });
    const range = normalizeCitationPythonSlice(source.storage, start, end);
    const text = yield* sliceCitationPythonStorage(source.storage, range.start, range.end, (layout) =>
      reserve(layout.utf16Units)
    );
    if (yield* xml.balance(text)) return CitationAnnotationSpanDecision.cases.WrapText.make({ start, end, text });
    const expanded = yield* styles.balance(source, start, end);
    if (yield* balanced(expanded.text)) return CitationAnnotationSpanDecision.cases.WrapText.make(expanded);
    yield* Effect.logWarning("Citation annotation skipped an unbalanced span").pipe(
      Effect.annotateLogs({ operation: "annotate" })
    );
    return CitationAnnotationSpanDecision.cases.Skip.make({});
  });
  return CitationAnnotationSpanProcessor.of({ prepare });
});
