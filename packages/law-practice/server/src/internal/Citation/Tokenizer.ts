/** Owned native tokenizer composition, eyecite 2.7.6 (BSD-2-Clause).
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Bytes from "effect/Bytes";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as MutableList from "effect/MutableList";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import * as TxRef from "effect/TxRef";
import { CitationOperationAdmission } from "./Admission.ts";
import { CitationExtractorOrderingBinding, makeCitationExtractorOrdering } from "./ExtractorOrdering.ts";
import {
  CitationExtractorEditionId,
  CitationExtractorRecipe,
  makeCitationExtractorRecipes,
} from "./ExtractorRecipes.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { CitationRegexPatternDescriptor, CitationRegexPatternProfile } from "./RegexDescriptors.ts";
import { makeCitationRegexInput } from "./RegexInput.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { makeCitationRegexWorker } from "./RegexWorker.ts";
import {
  CitationAssemblyResult,
  CitationTokenAssemblyFailure,
  CitationTokenAssemblyHost,
  makeCitationTokenAssembly,
} from "./TokenAssembly.ts";
import { CitationTokenCaptureRuntime, makeCitationTokenCapture } from "./TokenCapture.ts";
import { CitationTokenEditionBinding } from "./TokenEditions.ts";
import { CitationTokenSeed, makeCitationTokenObjects } from "./TokenObjects.ts";
import { makeCitationTokenText } from "./TokenText.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("internal/Citation/Tokenizer");
/** Trusted source metadata, not raw-request execution authority.
 * @internal @category models @since 0.0.0
 */
export class CitationTokenizerExtractor extends S.Opaque<
  CitationTokenizerExtractor,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ordering: CitationExtractorOrderingBinding,
    recipe: CitationExtractorRecipe,
    pattern: CitationPythonUnicodeStorage,
    descriptor: CitationRegexPatternDescriptor,
  })
    .check(
      S.makeFilter(
        (row) =>
          row.ordering.id === row.recipe.id &&
          row.ordering.flags === row.recipe.flags &&
          row.recipe.flags === row.descriptor.flags &&
          row.recipe.patternSha256 === row.descriptor.patternSha256,
        $I.annote("ExtractorIdentity", {
          description:
            "Require coherent source ordinal, flags and pattern identity across all captured extractor metadata.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("CitationTokenizerExtractor", {
        description: "One bound source extractor, native pattern and independently reviewed compiler profile.",
      })
    )
) {}
/** Frozen edition facts and the same local identity used by constructor recipes.
 * @internal @category models @since 0.0.0
 */
export class CitationTokenizerEdition extends S.Opaque<CitationTokenizerEdition, { readonly brand: unique symbol }>()(
  S.Struct({ ...CitationTokenEditionBinding.fields, ref: CitationExtractorEditionId.fields.ref }).pipe(
    $I.annoteSchema("CitationTokenizerEdition", {
      description: "Existing token edition-owner facts plus their immutable source reference.",
    })
  )
) {}
/** Decoded immutable native installation, independently owned by the tokenizer.
 * @internal @category models @since 0.0.0
 */
export class CitationTokenizerConfiguration extends S.Opaque<
  CitationTokenizerConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    extractors: S.Array(CitationTokenizerExtractor).check(S.isMaxLength(CitationEngineAbsoluteMaxima.patterns)),
    editions: S.Array(CitationTokenizerEdition).check(S.isMaxLength(2533)),
  }).pipe(
    $I.annoteSchema("CitationTokenizerConfiguration", {
      description: "Trusted bounded native tokenizer installation; decoding does not grant execution authority.",
    })
  )
) {}
const Configuration = S.toType(CitationTokenizerConfiguration);
const Reason = LiteralKit(["invalid-configuration", "invalid-source", "stage-failed"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed private tokenizer composition failures." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationTokenizerFailure extends S.TaggedError<
  CitationTokenizerFailure,
  { readonly brand: unique symbol }
>($I`CitationTokenizerFailure`)(
  "CitationTokenizerFailure",
  { reason: Reason },
  $I.annoteError<CitationTokenizerFailure>("CitationTokenizerFailure", {
    description: "Tokenizer composition failed without source payloads, patterns or causes.",
  })
) {}
const failure = (reason: typeof Reason.Type) => CitationTokenizerFailure.make({ reason });
const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
  CitationSafetyLimitExceeded.make({ operation: "extract", limit });
const preserveSafety = (error: unknown) => (S.is(CitationSafetyLimitExceeded)(error) ? error : failure("stage-failed"));
const sameDescriptor = S.toEquivalence(CitationRegexPatternDescriptor);

const prepareTokenizerConfiguration = Effect.fn("Citation.prepareTokenizerConfiguration")(function* (
  limits: CitationEngineLimits,
  configurationInput: unknown
) {
  const config = yield* S.decodeUnknownEffect(Configuration)(configurationInput).pipe(
    Effect.mapError(() => failure("invalid-configuration"))
  );
  if (config.extractors.length > limits.patterns) return yield* safety("patterns");
  const installed = A.map(config.extractors, (row) => ({
    ordering: CitationExtractorOrderingBinding.make({
      ...row.ordering,
      strings: A.map(row.ordering.strings, (value) =>
        CitationPythonUnicodeStorage.make({ width: value.width, bytes: Bytes.concat([value.bytes]) })
      ),
    }),
    recipe: CitationExtractorRecipe.make({
      ...row.recipe,
      exact: A.copy(row.recipe.exact),
      variation: A.copy(row.recipe.variation),
    }),
    descriptor: CitationRegexPatternDescriptor.make({
      ...row.descriptor,
      profile: CitationRegexPatternProfile.make({
        ...row.descriptor.profile,
        names: { ...row.descriptor.profile.names },
      }),
    }),
    pattern: CitationPythonUnicodeStorage.make({ width: row.pattern.width, bytes: Bytes.concat([row.pattern.bytes]) }),
  }));
  const editionRows = A.map(config.editions, (row) => CitationTokenizerEdition.make({ ...row }));
  const entries = HashMap.fromIterable(A.map(installed, (row) => Tuple.make(row.recipe.id, row)));
  if (HashMap.size(entries) !== installed.length) return yield* failure("invalid-configuration");
  let descriptors = HashMap.empty<string, CitationRegexPatternDescriptor>();
  for (const row of installed) {
    const key = `${row.descriptor.flags}:${row.descriptor.patternSha256}`;
    const previous = HashMap.get(descriptors, key);
    if (O.isSome(previous) && !sameDescriptor(previous.value, row.descriptor))
      return yield* failure("invalid-configuration");
    descriptors = HashMap.set(descriptors, key, row.descriptor);
  }
  return { installed, editionRows, entries, descriptors };
});

/** Owned private output plan. Plain text spans refer to the native source;
 * special-token snapshots retain their operation-local ids and native words.
 * @internal @category models @since 0.0.0
 */
export class CitationTokenizerResult extends S.Opaque<CitationTokenizerResult, { readonly brand: unique symbol }>()(
  S.Struct({
    source: CitationPythonUnicodeStorage,
    assembly: CitationAssemblyResult,
    tokens: S.Array(S.Struct({ id: S.Natural, seed: CitationTokenSeed })).check(
      S.isMaxLength(CitationEngineAbsoluteMaxima.tokens)
    ),
  }).pipe(
    $I.annoteSchema("CitationTokenizerResult", {
      description: "Complete native tokenizer plan with no partial-result success path or verified mention authority.",
    })
  )
) {}

/** Compose existing owners under one admitted, timed operation. Native matching
 * remains in the existing isolated worker and acknowledged retirement precedes
 * capture consumption. One transactional produced-text counter covers all token
 * fields and text gaps; assembly owns the combined output-token ceiling.
 * Methods have R = never. Frozen hash facts, current native regex profiles and
 * immutable built-in token semantics retain their explicit proof boundaries.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationTokenizer = Effect.fn("Citation.makeTokenizer")(function* (
  policy: unknown,
  runtime: unknown,
  configurationInput: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => failure("invalid-configuration"));
  const timing = yield* makeCitationRegexTiming(limits, true);
  const admission = yield* CitationOperationAdmission;
  const { installed, editionRows, entries, descriptors } = yield* prepareTokenizerConfiguration(
    limits,
    configurationInput
  );
  const ordering = yield* makeCitationExtractorOrdering(
    limits,
    A.map(installed, (row) => row.ordering)
  ).pipe(Effect.mapError(preserveSafety));
  const recipes = yield* makeCitationExtractorRecipes(
    limits,
    A.map(installed, (row) => row.recipe),
    editionRows
  ).pipe(Effect.mapError(preserveSafety));
  const editions = A.map(editionRows, (row) => CitationTokenEditionBinding.make({ ...row }));
  const worker = yield* makeCitationRegexWorker(limits, runtime, descriptors.pipe(HashMap.values, A.fromIterable)).pipe(
    Effect.mapError(preserveSafety)
  );
  const input = yield* makeCitationRegexInput(limits, "source");
  const text = yield* makeCitationTokenText(limits).pipe(Effect.mapError(preserveSafety));
  const tokenize = Effect.fn("Citation.tokenizeNativeSource")(function* (sourceInput: unknown) {
    const source = yield* input
      .prepareUnicode(sourceInput, () => Effect.void)
      .pipe(Effect.mapError((error) => (S.is(CitationSafetyLimitExceeded)(error) ? error : failure("invalid-source"))));
    const selected = yield* ordering.ordered(source.value.storage).pipe(Effect.mapError(preserveSafety));
    if (selected.indices.length > limits.patternEvaluations) return yield* safety("patternEvaluations");
    const objects = yield* makeCitationTokenObjects(limits, editions).pipe(Effect.mapError(preserveSafety));
    const gaps = yield* text.prepare(source.value.storage).pipe(Effect.mapError(preserveSafety));
    const produced = yield* TxRef.make(0);
    const reserve = Effect.fn("Citation.reserveTokenizerText")(function* (units: number) {
      const used = yield* TxRef.get(produced);
      if (units > limits.producedTextUtf16 - used) return yield* safety("producedTextUtf16");
      yield* TxRef.set(produced, used + units);
    }, Effect.tx);
    const ids = MutableList.make<number>();
    let rawMatches = 0;
    for (const id of selected.indices) {
      const row = yield* Effect.fromOption(HashMap.get(entries, id)).pipe(
        Effect.mapError(() => failure("invalid-configuration"))
      );
      const remainingMatches = limits.patternMatches - rawMatches;
      const remainingCandidates = limits.candidates - ids.length;
      const maximum = Num.min(remainingMatches, remainingCandidates);
      const evaluated = yield* worker
        .evaluate(row.pattern, source.value.storage, row.recipe.flags, maximum)
        .pipe(
          Effect.mapError((error) =>
            S.is(CitationSafetyLimitExceeded)(error) &&
            error.limit === "patternMatches" &&
            remainingCandidates < remainingMatches
              ? safety("candidates")
              : preserveSafety(error)
          )
        );
      rawMatches += evaluated.result.matches;
      const recipe = yield* recipes.bind(id, evaluated.descriptor).pipe(Effect.mapError(preserveSafety));
      const binding = yield* makeCitationTokenCapture(limits, {
        groups: evaluated.descriptor.profile.groups,
        names: evaluated.descriptor.profile.names,
      }).pipe(
        Effect.provideService(CitationTokenCaptureRuntime, {
          source: evaluated.source,
          result: evaluated.result,
          construct: objects.constructFrom,
          beforeAllocate: (layout) => reserve(layout.utf16Units),
        }),
        Effect.mapError(preserveSafety)
      );
      for (let match = 0; match < evaluated.result.matches; match++) {
        const token = yield* binding.build(match, recipe).pipe(Effect.mapError(preserveSafety));
        MutableList.append(ids, token);
      }
    }
    const assembly = yield* makeCitationTokenAssembly(limits).pipe(
      Effect.provideService(CitationTokenAssemblyHost, {
        read: objects.read,
        merge: objects.mergeTruthy,
        nominative: objects.nominative,
        text: Effect.fn("Citation.tokenizerTextGap")(
          function* (start: number, end: number) {
            const layout = yield* source.measure({ start, end });
            yield* reserve(layout.utf16Units);
            return yield* gaps.range({ start, end });
          },
          Effect.mapError((error) =>
            S.is(CitationSafetyLimitExceeded)(error)
              ? error
              : CitationTokenAssemblyFailure.make({ reason: "host-failed" })
          )
        ),
      }),
      Effect.mapError(preserveSafety)
    );
    const result = yield* assembly
      .assemble({ length: source.layout.pythonLength, ids: MutableList.takeAll(ids) })
      .pipe(Effect.mapError(preserveSafety));
    const tokens = yield* Effect.forEach(
      result.citations,
      ([, id]) =>
        objects.snapshot(id).pipe(Effect.mapBoth({ onSuccess: (seed) => ({ id, seed }), onFailure: preserveSafety })),
      { concurrency: 1 }
    );
    return CitationTokenizerResult.make({ source: source.value.storage, assembly: result, tokens });
  }, timing.timed);
  return {
    run: Effect.fn("Citation.runAdmittedTokenizer")((source: unknown) => admission.run("extract", tokenize(source))),
    snapshot: worker.snapshot,
    reap: worker.reap,
  };
});
