/** Original wrap_html_tags and annotate_citations(unbalanced_tags="wrap").
 * Free Law Project eyecite 2.7.6, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import {
  CitationAnnotationMatchFailure,
  CitationAnnotationSpanDecision,
  makeCitationMarkupAnnotationSpans,
} from "./AnnotationSpan.ts";
import { makeCitationAnnotationTemplates } from "./AnnotationTemplate.ts";
import { CitationPythonSliceBounds } from "./PythonUnicode.ts";
import { CitationRegexPatternDescriptor, CitationRegexPatternProfile } from "./RegexDescriptors.ts";
import { CitationRegexOperation } from "./RegexPolicy.ts";
import { installCitationRegexEvaluator } from "./RegexWorker.ts";
import type {
  CitationAnnotationReplacement,
  CitationEngineLimits,
  CitationPythonUnicodeStorage,
} from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";
import type { CitationPythonUnicodeValue } from "./PythonUnicode.ts";

const pattern = { width: 1, bytes: new TextEncoder().encode("(<[^>]+>)") };
const bindings = [
  CitationRegexPatternDescriptor.make({
    patternSha256: Sha256Hex.make("309a84eea285d876e0a32e0840a49ce6b826bf0a12bec8eae4e74e32cc67dad9"),
    flags: 0,
    profile: CitationRegexPatternProfile.make({
      groups: 1,
      names: {},
      minimumWidthFloor: 3,
      repeatedCaptures: false,
      nullableMultiRepeat: false,
    }),
  }),
];
const invalidCapture = () => CitationAnnotationMatchFailure.make({ reason: "invalid-capture" });
const nativeFailure = () => CitationAnnotationMatchFailure.make({ reason: "native-refused" });
const queryFailure = (error: { readonly _tag: string }) =>
  S.is(CitationSafetyLimitExceeded)(error)
    ? CitationSafetyLimitExceeded.make({ operation: "annotate", limit: error.limit })
    : nativeFailure();
/** Install the native regex evaluator with annotation timing, the original
 * fixed pattern and native template adapter once. No alternate matcher or process
 * owner is introduced. Returned methods read CitationInvocation at call time.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationAnnotationWrap = Effect.fn("Citation.makeAnnotationWrap")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime
) {
  const worker = yield* installCitationRegexEvaluator(limits, runtime, bindings, "python-re").pipe(
    Effect.provideService(CitationRegexOperation, "annotate")
  );
  const wrap = Effect.fn("Citation.wrapAnnotationTags")(function* (
    template: Effect.Success<ReturnType<typeof makeCitationAnnotationTemplates>>,
    source: CitationPythonUnicodeStorage,
    before: CitationPythonUnicodeStorage,
    after: CitationPythonUnicodeStorage
  ) {
    const plan = yield* template.compile(before, after);
    const evaluated = yield* worker.evaluate(pattern, source, 0).pipe(Effect.mapError(queryFailure));
    const matches = A.empty<CitationPythonSliceBounds>();
    for (let i = 0; i < evaluated.result.matches; i++) {
      const whole = yield* evaluated.result.capture(i, 0).pipe(Effect.mapError(nativeFailure));
      const tag = yield* evaluated.result.capture(i, 1).pipe(Effect.mapError(nativeFailure));
      if (whole._tag === "Unmatched" || tag._tag === "Unmatched") return yield* invalidCapture();
      if (whole.start !== tag.start || whole.end !== tag.end) return yield* invalidCapture();
      matches.push(CitationPythonSliceBounds.make({ start: whole.start, end: whole.end }));
    }
    return yield* template.substitute(plan, evaluated.source.value.storage, matches);
  });
  return { wrap };
});
/** Compose original XML fast paths and reverse after/before tag wrapping before
 * the existing assembly inserts the outer annotation. The tag wrapper is
 * installed once by the caller and passed as the effect that yields it (its
 * install `Exit`, or the install itself). Per request, the templates are built
 * first (they capture the request's reservation), then the installed wrapper is
 * yielded, in the order the original built them.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationWrapAnnotationSpans = Effect.fn("Citation.makeWrapAnnotationSpans")(function* <E, R>(
  limits: CitationEngineLimits,
  installed: Effect.Effect<Effect.Success<ReturnType<typeof makeCitationAnnotationWrap>>, E, R>
) {
  const templates = yield* makeCitationAnnotationTemplates(limits);
  const tags = yield* installed;
  const prepare = Effect.fn("Citation.wrapUnbalancedAnnotationSpan")(function* (
    _source: CitationPythonUnicodeValue,
    replacement: CitationAnnotationReplacement,
    text: CitationPythonUnicodeStorage
  ) {
    const selected = yield* tags.wrap(templates, text, replacement.after, replacement.before);
    return CitationAnnotationSpanDecision.cases.WrapText.make({
      start: replacement.start,
      end: replacement.end,
      text: selected,
    });
  });
  return yield* makeCitationMarkupAnnotationSpans(prepare);
});
