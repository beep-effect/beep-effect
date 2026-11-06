/** Built-in extraction dispatch from eyecite 2.7.6 find.py (BSD-2-Clause).
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { CitationFrozenEditions } from "./FrozenEditions.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { CitationTokenizerResult } from "./Tokenizer.ts";
import { CitationTokenSeed } from "./TokenObjects.ts";

const $I = $LawPracticeServerId.create("internal/Citation/TokenDispatch");
const Action = LiteralKit([
  "FullCaseCitation",
  "FullLawCitation",
  "FullJournalCitation",
  "ShortCaseCitation",
  "IdCitation",
  "SupraCitation",
  "UnknownCitation",
  "Skip",
]).pipe(
  $I.annoteSchema("Action", { description: "Exact built-in extraction branch; not a completed semantic citation." })
);
/** Frozen source token edition ordinals and authenticated artifact references.
 * @internal @category models @since 0.0.0
 */
export class CitationTokenDispatchBinding extends S.Opaque<
  CitationTokenDispatchBinding,
  { readonly brand: unique symbol }
>()(
  S.Struct({ id: S.Natural, ref: CitationEditionRef }).pipe(
    $I.annoteSchema("CitationTokenDispatchBinding", { description: "One authenticated source-token edition identity." })
  )
) {}
/** @internal @category models @since 0.0.0 */
export const CitationTokenDispatchBindings = S.Array(CitationTokenDispatchBinding)
  .check(S.isMaxLength(2533))
  .pipe(
    $I.annoteSchema("CitationTokenDispatchBindings", {
      description: "Shared immutable token-to-model edition identity mapping.",
    })
  );
export type CitationTokenDispatchBindings = typeof CitationTokenDispatchBindings.Type;
const Seed = S.toType(CitationTokenSeed);
const Input = S.toType(CitationTokenizerResult);
const Reason = LiteralKit(["invalid-input", "invalid-bindings", "missing-edition", "unknown-source"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed extraction branch selection failures." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationTokenDispatchFailure extends S.TaggedError<
  CitationTokenDispatchFailure,
  { readonly brand: unique symbol }
>($I`CitationTokenDispatchFailure`)(
  "CitationTokenDispatchFailure",
  { reason: Reason },
  $I.annoteError<CitationTokenDispatchFailure>("CitationTokenDispatchFailure", {
    description: "Extraction dispatch failed without tokens, references, source labels or nested causes.",
  })
) {}
/** @internal @category models @since 0.0.0 */
export class CitationTokenDispatchPlan extends S.Opaque<CitationTokenDispatchPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    decisions: S.Array(S.Struct({ index: S.Natural, id: S.Natural, action: Action })).check(
      S.isMaxLength(CitationEngineAbsoluteMaxima.tokens)
    ),
  }).pipe(
    $I.annoteSchema("CitationTokenDispatchPlan", {
      description: "Ordered source token-to-extractor decisions, retaining skips and mixed-output indices.",
    })
  )
) {}
const fail = (reason: typeof Reason.Type) => CitationTokenDispatchFailure.make({ reason });
const overflow = () => CitationSafetyLimitExceeded.make({ operation: "extract", limit: "candidates" });

/** Capture the authenticated edition owner and operation-local reference map.
 * Exact candidates take precedence; reporters outrank laws, which outrank
 * journals. Inspect every chosen occurrence before selecting a class, preserving
 * source evaluation order. Short citations bypass full-class source lookup.
 * This exact-built-in profile does not extract metadata, references, parallel
 * citations, filtering or custom subclasses. Methods have R = never.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationTokenDispatch = Effect.fn("Citation.makeTokenDispatch")(function* (
  policy: unknown,
  bindingsInput: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => fail("invalid-input"));
  const timing = yield* makeCitationRegexTiming(limits, true);
  const editions = yield* CitationFrozenEditions;
  const bindings: CitationTokenDispatchBindings = yield* S.decodeUnknownEffect(CitationTokenDispatchBindings)(
    bindingsInput
  ).pipe(Effect.mapError(() => fail("invalid-bindings")));
  const rows = HashMap.fromIterable(A.map(bindings, (row) => Tuple.make(row.id, row.ref)));
  if (HashMap.size(rows) !== bindings.length) return yield* fail("invalid-bindings");
  const full = Effect.fn("Citation.selectFullCitationClass")(function* (seed: CitationTokenSeed) {
    if (seed.short) return Action.Enum.ShortCaseCitation;
    if (seed.exact.length + seed.variation.length > limits.candidates) return yield* overflow();
    const chosen = seed.exact.length > 0 ? seed.exact : seed.variation;
    const values = yield* Effect.forEach(
      chosen,
      Effect.fn("Citation.readDispatchEditionSource")(
        function* (id: number) {
          const ref = yield* Effect.fromOption(HashMap.get(rows, id));
          return yield* editions.source(ref);
        },
        Effect.mapError(() => fail("missing-edition"))
      ),
      { concurrency: 1 }
    );
    const sources = HashSet.fromIterable(values);
    if (HashSet.has(sources, "reporters")) return Action.Enum.FullCaseCitation;
    if (HashSet.has(sources, "laws")) return Action.Enum.FullLawCitation;
    if (HashSet.has(sources, "journals")) return Action.Enum.FullJournalCitation;
    return yield* fail("unknown-source");
  });
  const classify = Effect.fn("Citation.classifyBuiltInToken")(function* (input: unknown) {
    const seed = yield* S.decodeUnknownEffect(Seed)(input).pipe(Effect.mapError(() => fail("invalid-input")));
    return yield* CitationTokenSeed.fields.kind.match(seed.kind, {
      CitationToken: () => full(seed),
      IdToken: () => Effect.succeed(Action.Enum.IdCitation),
      SupraToken: () => Effect.succeed(Action.Enum.SupraCitation),
      SectionToken: () => Effect.succeed(Action.Enum.UnknownCitation),
      Token: () => Effect.succeed(Action.Enum.Skip),
      ParagraphToken: () => Effect.succeed(Action.Enum.Skip),
      StopWordToken: () => Effect.succeed(Action.Enum.Skip),
      PlaceholderCitationToken: () => Effect.succeed(Action.Enum.Skip),
      CaseReferenceToken: () => Effect.succeed(Action.Enum.Skip),
    });
  }, timing.timed);
  const plan = Effect.fn("Citation.planExtractionDispatch")(function* (input: unknown) {
    const result = yield* S.decodeUnknownEffect(Input)(input).pipe(Effect.mapError(() => fail("invalid-input")));
    if (result.tokens.length > limits.candidates) return yield* overflow();
    const tokens = HashMap.fromIterable(A.map(result.tokens, (row) => Tuple.make(row.id, row.seed)));
    if (HashMap.size(tokens) !== result.tokens.length) return yield* fail("invalid-input");
    const decisions = yield* Effect.forEach(
      result.assembly.citations,
      Effect.fn("Citation.dispatchTokenizerItem")(function* ([index, id]) {
        const item = yield* Effect.fromOption(A.get(result.assembly.items, index)).pipe(
          Effect.mapError(() => fail("invalid-input"))
        );
        if (item._tag !== "Token" || item.id !== id) return yield* fail("invalid-input");
        const seed = yield* Effect.fromOption(HashMap.get(tokens, id)).pipe(
          Effect.mapError(() => fail("invalid-input"))
        );
        const action = yield* classify(seed);
        return { index, id, action };
      }),
      { concurrency: 1 }
    );
    return CitationTokenDispatchPlan.make({ decisions });
  }, timing.timed);
  return { classify, plan };
});
