/** Bound built-in constructor recipes from eyecite 2.7.6 (BSD-2-Clause).
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { CitationRegexPatternDescriptor } from "./RegexDescriptors.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { CitationTokenSeed } from "./TokenObjects.ts";

const $I = $LawPracticeServerId.create("internal/Citation/ExtractorRecipes");
const References = S.Array(Sha256Hex).check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates));
/** The inherited function name alone loses the bound token class. Preserve the
 * independently observed class and original edition-list order explicitly.
 * This metadata is not regex execution authority or a source-family approval.
 * @internal @category models @since 0.0.0
 */
export class CitationExtractorRecipe extends S.Opaque<CitationExtractorRecipe, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Natural,
    patternSha256: CitationRegexPatternDescriptor.fields.patternSha256,
    flags: CitationRegexPatternDescriptor.fields.flags,
    kind: CitationTokenSeed.fields.kind,
    exact: References,
    variation: References,
    short: S.Boolean,
  }).pipe(
    $I.annoteSchema("CitationExtractorRecipe", {
      description: "Source-bound constructor class and ordered edition references.",
    })
  )
) {}
/** Operation-local edition identity assigned by the existing edition owner.
 * @internal @category models @since 0.0.0
 */
export class CitationExtractorEditionId extends S.Opaque<
  CitationExtractorEditionId,
  { readonly brand: unique symbol }
>()(
  S.Struct({ ref: Sha256Hex, id: S.Natural }).pipe(
    $I.annoteSchema("CitationExtractorEditionId", {
      description: "One frozen edition reference and its local token-store identity.",
    })
  )
) {}
const Recipes = CitationExtractorRecipe.pipe(S.toType, S.Array).check(
  S.isMaxLength(CitationEngineAbsoluteMaxima.patterns)
);
const Editions = CitationExtractorEditionId.pipe(S.toType, S.Array).check(S.isMaxLength(2533));
const Reason = LiteralKit(["invalid-bindings", "unknown-extractor", "program-mismatch"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed source recipe binding failures." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationExtractorRecipeFailure extends S.TaggedError<
  CitationExtractorRecipeFailure,
  { readonly brand: unique symbol }
>($I`CitationExtractorRecipeFailure`)(
  "CitationExtractorRecipeFailure",
  { reason: Reason },
  $I.annoteError<CitationExtractorRecipeFailure>("CitationExtractorRecipeFailure", {
    description: "Recipe binding failed without source values, references or nested causes.",
  })
) {}
const failure = (reason: typeof Reason.Type) => CitationExtractorRecipeFailure.make({ reason });
/** Capture immutable recipes and the existing owner's edition identities. Bind
 * only against the worker's returned descriptor; return fresh constructor extras.
 * Calls have R = never and enforce the captured deadline. General Python extras
 * and dynamically changed extractor configuration remain separate obligations.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationExtractorRecipes = Effect.fn("Citation.makeExtractorRecipes")(function* (
  policy: unknown,
  recipeInput: unknown,
  editionInput: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => failure("invalid-bindings"));
  const timing = yield* makeCitationRegexTiming(limits, true);
  const recipes = yield* S.decodeUnknownEffect(Recipes)(recipeInput).pipe(
    Effect.mapError(() => failure("invalid-bindings"))
  );
  const editions = yield* S.decodeUnknownEffect(Editions)(editionInput).pipe(
    Effect.mapError(() => failure("invalid-bindings"))
  );
  if (recipes.length > limits.patterns)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "patterns" });
  const editionIds = HashMap.fromIterable(A.map(editions, (row) => Tuple.make(row.ref, row.id)));
  if (
    HashMap.size(editionIds) !== editions.length ||
    HashSet.size(HashSet.fromIterable(A.map(editions, (row) => row.id))) !== editions.length
  )
    return yield* failure("invalid-bindings");
  const resolve = Effect.fn("Citation.resolveRecipeEditions")((refs: ReadonlyArray<Sha256Hex>) =>
    Effect.forEach(
      refs,
      (ref) => Effect.fromOption(HashMap.get(editionIds, ref)).pipe(Effect.mapError(() => failure("invalid-bindings"))),
      { concurrency: 1 }
    )
  );
  const entries = yield* Effect.forEach(
    recipes,
    Effect.fn("Citation.prepareExtractorRecipe")(function* (row) {
      if (row.exact.length + row.variation.length > limits.candidates)
        return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "candidates" });
      if (row.kind !== "CitationToken" && (row.exact.length > 0 || row.variation.length > 0 || row.short))
        return yield* failure("invalid-bindings");
      const exact = yield* resolve(row.exact);
      const variation = yield* resolve(row.variation);
      return Tuple.make(row.id, {
        patternSha256: row.patternSha256,
        flags: row.flags,
        kind: row.kind,
        exact,
        variation,
        short: row.short,
      });
    }),
    { concurrency: 1 }
  );
  const rows = HashMap.fromIterable(entries);
  if (HashMap.size(rows) !== entries.length) return yield* failure("invalid-bindings");
  const bind = Effect.fn("Citation.bindExtractorRecipe")(function* (idInput: unknown, descriptorInput: unknown) {
    const id = yield* S.decodeUnknownEffect(S.Natural)(idInput).pipe(
      Effect.mapError(() => failure("unknown-extractor"))
    );
    const row = yield* Effect.fromOption(HashMap.get(rows, id)).pipe(
      Effect.mapError(() => failure("unknown-extractor"))
    );
    const descriptor = yield* S.decodeUnknownEffect(CitationRegexPatternDescriptor)(descriptorInput).pipe(
      Effect.mapError(() => failure("program-mismatch"))
    );
    if (row.patternSha256 !== descriptor.patternSha256 || row.flags !== descriptor.flags)
      return yield* failure("program-mismatch");
    return {
      kind: row.kind,
      extra:
        row.kind === "CitationToken"
          ? { exact_editions: A.copy(row.exact), variation_editions: A.copy(row.variation), short: row.short }
          : {},
    };
  }, timing.timed);
  return { bind };
});
