/** Source edition candidate set merge, eyecite 2.7.6 / CPython 3.11.15.
 * BSD-2-Clause / PSF-2.0; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import {
  CitationRuntimeDictionaryComparison,
  CitationRuntimeDictionaryFailure,
  CitationRuntimeDictionaryKey,
} from "./RuntimeDictionary.ts";
import { makeCitationRuntimeSet } from "./RuntimeSet.ts";
import { CitationTokenAssemblyFailure } from "./TokenAssembly.ts";

const $I = $LawPracticeServerId.create("internal/Citation/TokenEditions");
/** @internal @category models @since 0.0.0 */
export class CitationTokenEditionBinding extends S.Opaque<
  CitationTokenEditionBinding,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    id: S.Natural,
    hash: CitationRuntimeDictionaryKey.fields.hash,
    equalityClass: S.Natural,
    reporterShortName: S.String.check(S.isMaxLength(1024)),
  }).pipe(
    $I.annoteSchema("CitationTokenEditionBinding", {
      description:
        "Trusted immutable source edition identity/hash/equality facts and nominative name; not raw-request authority.",
    })
  )
) {}
const Bindings = CitationTokenEditionBinding.pipe(S.toType, S.Array)
  .check(S.isMaxLength(2533))
  .pipe($I.annoteSchema("Bindings", { description: "At most the canonical source's 2533 immutable edition facts." }));
const Ids = S.Array(S.Natural)
  .check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates))
  .pipe($I.annoteSchema("Ids", { description: "Candidate occurrences before source set deduplication." }));
const nominativeNames = HashSet.fromIterable([
  "Thompson",
  "Cooke",
  "Holmes",
  "Olcott",
  "Chase",
  "Gilmer",
  "Bee",
  "Deady",
  "Taney",
]);
const failure = () => CitationTokenAssemblyFailure.make({ reason: "host-failed" });
const probeFailure = (error: CitationRuntimeDictionaryFailure) =>
  error.reason === "limit-exceeded"
    ? CitationSafetyLimitExceeded.make({ operation: "extract", limit: "patternEvaluations" })
    : failure();

/** Capture a frozen source edition hash profile. Python None/date hashes are
 * runtime facts; this adapter does not invent a universal process hash or
 * normalize intermediate set order. It reuses the existing CPython set owner.
 * Dynamic hash/equality protocols and custom edition populations remain open.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationTokenEditions = Effect.fn("Citation.makeTokenEditions")(function* (
  policy: unknown,
  input: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, failure);
  const timing = yield* makeCitationRegexTiming(limits, true);
  const bindings = yield* S.decodeUnknownEffect(Bindings)(input).pipe(Effect.mapError(failure));
  const rows = HashMap.fromIterable(
    A.map(bindings, (row) => Tuple.make(row.id, CitationTokenEditionBinding.make({ ...row })))
  );
  if (HashMap.size(rows) !== bindings.length) return yield* failure();
  const read = Effect.fn("Citation.tokenEditionFact")((id: number) =>
    Effect.fromOption(HashMap.get(rows, id)).pipe(Effect.mapError(failure))
  );
  const decode = Effect.fn("Citation.tokenEditionOccurrences")(function* (input: unknown) {
    const ids = yield* S.decodeUnknownEffect(Ids)(input).pipe(Effect.mapError(failure));
    if (ids.length > limits.candidates)
      return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "candidates" });
    return A.map(ids, (id) => id);
  });
  const comparison = CitationRuntimeDictionaryComparison.of({
    step: Effect.yieldNow,
    equal: Effect.fn("Citation.equalFrozenEditions")(
      function* (left: number, right: number) {
        const a = yield* read(left);
        const b = yield* read(right);
        return a.equalityClass === b.equalityClass;
      },
      Effect.mapError(() => CitationRuntimeDictionaryFailure.make({ reason: "comparison-failed" }))
    ),
  });
  const deduplicate = Effect.fn("Citation.deduplicateTokenEditions")(function* (input: unknown) {
    const ids = yield* decode(input);
    const result = yield* makeCitationRuntimeSet({
      entries: bindings.length > 0 ? bindings.length : 1,
      iterations: limits.patternEvaluations,
    }).pipe(Effect.provideService(CitationRuntimeDictionaryComparison, comparison), Effect.mapError(probeFailure));
    for (const id of ids) {
      const row = yield* read(id);
      yield* result
        .add(CitationRuntimeDictionaryKey.make({ objectId: id, hash: row.hash }))
        .pipe(Effect.mapError(probeFailure));
    }
    return A.map(yield* result.read, (key) => key.objectId);
  }, timing.timed);
  const nominative = Effect.fn("Citation.tokenIsNominative")(function* (exact: unknown, variation: unknown) {
    const a = yield* decode(exact);
    const b = yield* decode(variation);
    const chosen = a.length > 0 ? a : b;
    const first = yield* Effect.fromOption(A.head(chosen)).pipe(Effect.mapError(failure));
    return HashSet.has(nominativeNames, (yield* read(first)).reporterShortName);
  }, timing.timed);
  return { deduplicate, nominative };
});
