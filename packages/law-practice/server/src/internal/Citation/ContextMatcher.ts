/** match_on_tokens composition from eyecite 2.7.6 helpers.py (BSD-2-Clause).
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationPythonUnicodeStorage, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { concatCitationPythonRanges } from "./PythonUnicode.ts";
import { citationUnaccountedText, makeCitationRegexInput } from "./RegexInput.ts";
import { makeCitationRegexTiming } from "./RegexPolicy.ts";
import { CitationRegexCapture } from "./RegexResult.ts";
import { installCitationRegexEvaluator } from "./RegexWorker.ts";
import { makeCitationTokenContext } from "./TokenContext.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";
import type { CitationRegexPatternDescriptor } from "./RegexDescriptors.ts";
import type { CitationRegexSourceFlags } from "./RegexEngine.ts";

const $I = $LawPracticeServerId.create("internal/Citation/ContextMatcher");
const Reason = LiteralKit(["invalid-configuration"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed context matcher installation failures." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationContextMatcherFailure extends S.TaggedError<
  CitationContextMatcherFailure,
  { readonly brand: unique symbol }
>($I`CitationContextMatcherFailure`)(
  "CitationContextMatcherFailure",
  { reason: Reason },
  $I.annoteError<CitationContextMatcherFailure>("CitationContextMatcherFailure", {
    description: "Context matcher installation failed without source text or nested causes.",
  })
) {}
/** @internal @category models @since 0.0.0 */
export class CitationContextMatch extends S.Opaque<CitationContextMatch, { readonly brand: unique symbol }>()(
  S.Struct({
    context: CitationPythonUnicodeStorage,
    match: S.NullOr(
      S.Struct({
        captures: S.Array(CitationRegexCapture).check(S.isMaxLength(11)),
        names: S.Record(S.String, S.Natural),
      })
    ),
  }).pipe(
    $I.annoteSchema("CitationContextMatch", {
      description: "Owned native context and complete source-point captures, including whole/empty/unmatched groups.",
    })
  )
) {}
const budget = (limit: "patternUtf16" | "producedTextUtf16") =>
  CitationSafetyLimitExceeded.make({ operation: "extract", limit });
const ascii = (text: string) => CitationPythonUnicodeStorage.make({ width: 1, bytes: new TextEncoder().encode(text) });
/** Capture one installed source pattern and its independently observed wrapped
 * descriptors once per stage install. No function is request data. Methods read
 * CitationInvocation at call time and reuse
 * the existing physical owner, shared admission, typed RPC and capture codec.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationContextMatcher = Effect.fn("Citation.makeContextMatcher")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  patternInput: CitationPythonUnicodeStorage,
  flags: typeof CitationRegexSourceFlags.Type,
  bindings: ReadonlyArray<CitationRegexPatternDescriptor>
) {
  const timing = yield* makeCitationRegexTiming(limits, true);
  const input = yield* makeCitationRegexInput(limits, citationUnaccountedText, "pattern");
  const pattern = (yield* input.prepareUnicode(patternInput, () => Effect.void)).value;
  const wrap = Effect.fn("Citation.wrapContextPattern")(function* (prefix: string, suffix: string) {
    const first = ascii(prefix);
    const last = ascii(suffix);
    return yield* concatCitationPythonRanges(
      [
        { source: first, start: 0, end: first.bytes.length },
        { source: pattern.storage, start: 0, end: pattern.pythonLength },
        { source: last, start: 0, end: last.bytes.length },
      ],
      (layout) => (layout.utf16Units > limits.patternUtf16 ? Effect.fail(budget("patternUtf16")) : Effect.void)
    );
  });
  const forward = yield* wrap("^(?:", ")");
  const backward = yield* wrap("(?:", ")$");
  const context = yield* makeCitationTokenContext(limits);
  const worker = yield* installCitationRegexEvaluator(limits, runtime, bindings, "python-regex-v0");
  const search = Effect.fn("Citation.matchOnTokens")(function* (request: unknown) {
    const prepared = yield* context.plan(request);
    if (prepared.allocatedUnits + prepared.contextUnits > limits.producedTextUtf16)
      return yield* budget("producedTextUtf16");
    const matched = yield* worker.evaluate(
      prepared.anchor === "start" ? forward : backward,
      prepared.source,
      flags,
      1,
      "search"
    );
    if (matched.result.matches === 0)
      return CitationContextMatch.make({ context: matched.source.value.storage, match: null });
    const captures = yield* Effect.forEach(A.range(0, matched.descriptor.profile.groups), (group) =>
      matched.result.capture(0, group)
    );
    return CitationContextMatch.make({
      context: matched.source.value.storage,
      match: { captures, names: R.map(matched.descriptor.profile.names, identity) },
    });
  }, timing.timed);
  return { search };
});
