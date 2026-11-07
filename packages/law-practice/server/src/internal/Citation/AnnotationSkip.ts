/** Original annotate_citations(unbalanced_tags="skip") span selection.
 * Free Law Project eyecite 2.7.6, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Effect from "effect/Effect";
import {
  CitationAnnotationSpanDecision,
  hasCitationAnnotationAngles,
  makeCitationMarkupAnnotationSpans,
} from "./AnnotationSpan.ts";
import { makeCitationStyleTagBalancer } from "./AnnotationStyle.ts";
import { CitationXmlBalance } from "./XmlWorker.ts";
import type { CitationAnnotationReplacement, CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import type { CitationPythonUnicodeValue } from "./PythonUnicode.ts";

/** Capture the existing XML and style capabilities within one operation. The
 * no-angle fast path borrows the original range and starts no parser process.
 * Failed initial XML checks attempt style expansion, check again, then skip
 * without advancing assembly state if still unbalanced. No raw text is logged.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationSkipAnnotationSpans = Effect.fn("Citation.makeSkipAnnotationSpans")(function* () {
  const xml = yield* CitationXmlBalance;
  const styles = yield* makeCitationStyleTagBalancer();
  const balanced = Effect.fn("Citation.checkExpandedAnnotationSpan")(function* (text: CitationPythonUnicodeStorage) {
    if (!(yield* hasCitationAnnotationAngles(text, 0, text.bytes.length / text.width))) return true;
    return yield* xml.balance(text);
  });
  const prepare = Effect.fn("Citation.prepareSkippedAnnotationSpan")(function* (
    source: CitationPythonUnicodeValue,
    replacement: CitationAnnotationReplacement
  ) {
    const { start, end } = replacement;
    const expanded = yield* styles.balance(source, start, end);
    if (yield* balanced(expanded.text)) return CitationAnnotationSpanDecision.cases.WrapText.make(expanded);
    yield* Effect.logWarning("Citation annotation skipped an unbalanced span").pipe(
      Effect.annotateLogs({ operation: "annotate" })
    );
    return CitationAnnotationSpanDecision.cases.Skip.make({});
  });
  return yield* makeCitationMarkupAnnotationSpans(prepare);
});
