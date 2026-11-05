/** Static source extractor ordering using the existing CPython compatibility set.
 * eyecite 2.7.6, BSD-2-Clause; CPython 3.11.15, PSF-2.0.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { CitationExtractorSelectionBinding, makeCitationExtractorSelection } from "./ExtractorSelection.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import {
  CitationRuntimeDictionaryComparison,
  CitationRuntimeDictionaryFailure,
  CitationRuntimeDictionaryKey,
} from "./RuntimeDictionary.ts";
import { makeCitationRuntimeSet } from "./RuntimeSet.ts";

const $I = $LawPracticeServerId.create("internal/Citation/ExtractorOrdering");
/** @internal @category models @since 0.0.0 */
export class CitationExtractorOrderingBinding extends S.Opaque<
  CitationExtractorOrderingBinding,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ...CitationExtractorSelectionBinding.fields,
    hash: CitationRuntimeDictionaryKey.fields.hash,
    equalityClass: CitationExtractorSelectionBinding.fields.id,
  }).pipe(
    $I.annoteSchema("CitationExtractorOrderingBinding", {
      description: "Trusted frozen extractor hash and equality class at that hash; not raw-request authority.",
    })
  )
) {}
const Bindings = S.toType(
  S.Array(CitationExtractorOrderingBinding).check(S.isMaxLength(CitationEngineAbsoluteMaxima.patterns))
).pipe($I.annoteSchema("Bindings", { description: "Bounded decoded frozen extractor ordering metadata." }));
const Reason = LiteralKit(["invalid-policy", "invalid-bindings", "set-failed"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed static ordering failure without source words or causes." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationExtractorOrderingFailure extends S.TaggedError<
  CitationExtractorOrderingFailure,
  { readonly brand: unique symbol }
>($I`CitationExtractorOrderingFailure`)(
  "CitationExtractorOrderingFailure",
  { reason: Reason },
  $I.annoteError<CitationExtractorOrderingFailure>("CitationExtractorOrderingFailure", {
    description: "Frozen extractor ordering failed closed.",
  })
) {}
/** @internal @category models @since 0.0.0 */
export class CitationOrderedExtractors extends S.Opaque<CitationOrderedExtractors, { readonly brand: unique symbol }>()(
  S.Struct({
    indices: S.Array(CitationExtractorSelectionBinding.fields.id).check(
      S.isMaxLength(CitationEngineAbsoluteMaxima.patterns)
    ),
    prefixQueries: S.Natural,
    matchedKeys: S.Natural,
  }).pipe(
    $I.annoteSchema("CitationOrderedExtractors", {
      description: "Static extractor indices in source set bucket order, with selector work diagnostics.",
    })
  )
) {}
const fail = (reason: typeof Reason.Type) => CitationExtractorOrderingFailure.make({ reason });
const missing = () => CitationRuntimeDictionaryFailure.make({ reason: "invalid-input" });
const setFailure = (failure: CitationRuntimeDictionaryFailure) =>
  failure.reason === "limit-exceeded"
    ? CitationSafetyLimitExceeded.make({ operation: "extract", limit: "patternEvaluations" })
    : fail("set-failed");

/** Capture decoded trusted hash metadata and construct the source unfiltered
 * set. Each request copies that set and inserts each object's first match in
 * source event order. Hash/equality metadata is immutable for this profile;
 * dynamic host-object mutation remains a separate adapter obligation.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationExtractorOrdering = Effect.fn("Citation.makeExtractorOrdering")(function* (
  policy: unknown,
  input: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => fail("invalid-policy"));
  const timing = yield* makeCitationRegexTiming(limits, true);
  const bindings = yield* S.decodeUnknownEffect(Bindings)(input).pipe(Effect.mapError(() => fail("invalid-bindings")));
  const keys = HashMap.fromIterable(
    A.map(bindings, (binding) =>
      Tuple.make(binding.id, CitationRuntimeDictionaryKey.make({ objectId: binding.id, hash: binding.hash }))
    )
  );
  const classes = HashMap.fromIterable(A.map(bindings, (binding) => Tuple.make(binding.id, binding.equalityClass)));
  const unfiltered = pipe(
    bindings,
    A.filter((binding) => binding.strings.length === 0),
    A.map((binding) => binding.id)
  );
  const selector = yield* makeCitationExtractorSelection(limits, bindings);
  const keyFor = Effect.fn("Citation.extractorOrderKey")((id: number) =>
    Effect.fromOption(HashMap.get(keys, id)).pipe(Effect.mapError(() => fail("invalid-bindings")))
  );
  const comparison = CitationRuntimeDictionaryComparison.of({
    step: Effect.yieldNow,
    equal: Effect.fn("Citation.compareExtractorClass")(function* (left: number, right: number) {
      const a = yield* Effect.fromOption(HashMap.get(classes, left));
      const b = yield* Effect.fromOption(HashMap.get(classes, right));
      return a === b;
    }, Effect.mapError(missing)),
  });
  const initial = yield* makeCitationRuntimeSet({
    entries: limits.patterns,
    iterations: limits.patternEvaluations,
  }).pipe(Effect.provideService(CitationRuntimeDictionaryComparison, comparison), Effect.mapError(setFailure));
  for (const id of unfiltered) {
    const key = yield* keyFor(id);
    yield* initial.add(key).pipe(Effect.mapError(setFailure));
  }
  const ordered = Effect.fn("Citation.orderSelectedExtractors")(function* (source: unknown) {
    const selected = yield* selector.select(source);
    const result = yield* initial.copy.pipe(Effect.mapError(setFailure));
    for (const id of selected.insertions) {
      const key = yield* keyFor(id);
      yield* result.add(key).pipe(Effect.mapError(setFailure));
    }
    const citationResult1 = yield* result.read;
    return CitationOrderedExtractors.make({
      indices: A.map(citationResult1, (key) => key.objectId),
      prefixQueries: selected.prefixQueries,
      matchedKeys: selected.matchedKeys,
    });
  }, timing.timed);
  return { ordered };
});
