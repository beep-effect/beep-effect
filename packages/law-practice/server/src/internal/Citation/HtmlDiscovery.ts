/** Original placeholder/emphasis discovery from eyecite 2.7.6 utils/models.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md. A fixed finite
 * lowering preserves CPython closing-tag backreferences; no DOM is consulted.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationHtmlEmphasis } from "./HtmlTagGeometry.ts";
import { copyCitationMetadataPatternConfiguration, makeCitationMetadataStage } from "./MetadataComposition.ts";
import { citationMetadataWhitespaceBoundary, trimCitationMetadataBoundary } from "./MetadataStrings.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { citationPythonPointAt, concatCitationPythonRanges } from "./PythonUnicode.ts";
import { CitationRegexPatternDescriptor } from "./RegexDescriptors.ts";
import { makeCitationRegexWorker } from "./RegexWorker.ts";
import { CitationTextBudget } from "./TextBudget.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";
import type { CitationRegexCapturedRange } from "./RegexResult.ts";

const $I = $LawPracticeServerId.create("internal/Citation/HtmlDiscovery");
const Patterns = S.Struct({ placeholder: CitationPythonUnicodeStorage, emphasis: CitationPythonUnicodeStorage }).pipe(
  $I.annoteSchema("Patterns", { description: "Two fixed, source-bound discovery programs installed by the server." })
);
const fingerprints = {
  placeholder: "23152cbb5e43a7b5a489fc28ffdbc537e40655b856479299ecb4723f2b1835ed",
  emphasis: "f70a1c7a8d796740c9e2a9c6c53d904ca7824b915a2df6f4f898d1d15df14f2f",
};
const Reason = LiteralKit(["invalid-configuration", "invalid-match"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed discovery failures without markup, captures or partial output." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationHtmlDiscoveryFailure extends S.TaggedError<
  CitationHtmlDiscoveryFailure,
  { readonly brand: unique symbol }
>($I`CitationHtmlDiscoveryFailure`)(
  "CitationHtmlDiscoveryFailure",
  { reason: Reason },
  $I.annoteError<CitationHtmlDiscoveryFailure>("CitationHtmlDiscoveryFailure", {
    description: "Fixed HTML discovery failed without retaining source data.",
  })
) {}
/** @internal @category models @since 0.0.0 */
export class CitationHtmlDiscoveryConfiguration extends S.Opaque<
  CitationHtmlDiscoveryConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    patterns: Patterns,
    bindings: S.Array(CitationRegexPatternDescriptor).check(S.isBetweenLength(2, 2)),
  }).pipe(
    $I.annoteSchema("CitationHtmlDiscoveryConfiguration", {
      description: "Authenticated fixed patterns and independently captured profiles, never request fields.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationHtmlDiscoveryResult extends S.Opaque<
  CitationHtmlDiscoveryResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    placeholder: CitationPythonUnicodeStorage,
    tags: S.Array(CitationHtmlEmphasis).check(S.isMaxLength(CitationEngineAbsoluteMaxima.tokens)),
    reservedUnits: S.Natural.check(S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.producedTextUtf16)),
  }).pipe(
    $I.annoteSchema("CitationHtmlDiscoveryResult", {
      description: "Atomic native placeholder and stripped original emphasis tuples under one text reservation owner.",
    })
  )
) {}
const fail = (reason: typeof Reason.Type) => CitationHtmlDiscoveryFailure.make({ reason });
type Evaluation = Effect.Success<ReturnType<Effect.Success<ReturnType<typeof makeCitationRegexWorker>>["evaluate"]>>;
const matchAt = Effect.fn("Citation.htmlDiscoveryMatch")(function* (evaluated: Evaluation, ordinal: number) {
  const match = yield* evaluated.result.capture(ordinal, 0);
  if (match._tag === "Unmatched" || match.start === match.end) return yield* fail("invalid-match");
  return match;
});
const placeholderText = Effect.fn("Citation.makeHtmlPlaceholder")(function* (evaluated: Evaluation) {
  const budget = yield* CitationTextBudget;
  const source = evaluated.source.value.storage;
  let maximum = 0;
  const begin = (match: CitationRegexCapturedRange) =>
    match.start + (citationPythonPointAt(source, match.start + 1) === 47 ? 2 : 1);
  for (let index = 0; index < evaluated.result.matches; index++) {
    const match = yield* matchAt(evaluated, index);
    maximum = Num.max(maximum, match.end - 1 - begin(match));
  }
  yield* budget.reserve(maximum);
  const xs = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array(maximum).fill(88) });
  const ranges: Array<{ source: CitationPythonUnicodeStorage; start: number; end: number }> = [];
  let cursor = 0;
  for (let index = 0; index < evaluated.result.matches; index++) {
    const match = yield* matchAt(evaluated, index);
    const prefix = begin(match);
    ranges.push({ source, start: cursor, end: prefix }, { source: xs, start: 0, end: match.end - 1 - prefix });
    cursor = match.end - 1;
  }
  ranges.push({ source, start: cursor, end: evaluated.source.value.pythonLength });
  return yield* concatCitationPythonRanges(ranges, (layout) => budget.reserve(layout.utf16Units));
});
const emphasisBody = Effect.fn("Citation.htmlEmphasisBody")(function* (evaluated: Evaluation, ordinal: number) {
  let selected = O.none<CitationRegexCapturedRange>();
  for (let group = 1; group <= 3; group++) {
    const capture = yield* evaluated.result.capture(ordinal, group);
    if (capture._tag === "Unmatched") continue;
    if (O.isSome(selected)) return yield* fail("invalid-match");
    selected = O.some(capture);
  }
  return yield* Effect.fromOption(selected, () => fail("invalid-match"));
});
const emphasisTags = Effect.fn("Citation.discoverHtmlEmphasis")(function* (
  limits: CitationEngineLimits,
  evaluated: Evaluation
) {
  if (evaluated.result.matches > limits.tokens)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "tokens" });
  const tags: Array<CitationHtmlEmphasis> = [];
  for (let index = 0; index < evaluated.result.matches; index++) {
    const whole = yield* matchAt(evaluated, index);
    const body = yield* emphasisBody(evaluated, index);
    const value = evaluated.source.value;
    const start = yield* trimCitationMetadataBoundary(
      value,
      body.start,
      body.end,
      1,
      citationMetadataWhitespaceBoundary
    );
    const end =
      1 + (yield* trimCitationMetadataBoundary(value, body.end - 1, start - 1, -1, citationMetadataWhitespaceBoundary));
    const text = yield* evaluated.source.slice({ start, end }, () => Effect.void);
    tags.push(CitationHtmlEmphasis.make({ text, start: whole.start, end: whole.end }));
  }
  return tags;
});
const discover = Effect.fn("Citation.prepareHtmlDiscovery")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationHtmlDiscoveryConfiguration,
  raw: unknown
) {
  const worker = yield* makeCitationRegexWorker(limits, runtime, config.bindings);
  const masked = yield* worker.evaluate(config.patterns.placeholder, raw, 0);
  const placeholder = yield* placeholderText(masked);
  const emphasized = yield* worker.evaluate(config.patterns.emphasis, masked.source.value.storage, 2);
  const tags = yield* emphasisTags(limits, emphasized);
  return { placeholder, tags };
});
/** Reuse captured operation admission, Clock, text budget, Effect RPC and owned
 * regex retirement. Both fixed jobs complete and retire before publication.
 * Native source identity and Python coordinates survive all transformations;
 * general backreferences/DOTALL remain unqualified. Method has R=never.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationHtmlDiscovery = makeCitationMetadataStage({
  method: "discover",
  schema: S.toType(CitationHtmlDiscoveryConfiguration),
  invalid: () => fail("invalid-configuration"),
  own: (limits, config) =>
    copyCitationMetadataPatternConfiguration(limits, Patterns, config.patterns, config.bindings, fingerprints, () =>
      fail("invalid-configuration")
    ).pipe(Effect.map(CitationHtmlDiscoveryConfiguration.make)),
  prepare: discover,
  project: (patch, reservedUnits) => CitationHtmlDiscoveryResult.make({ ...patch, reservedUnits }),
});
