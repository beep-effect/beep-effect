/** Original short/Id./supra/unknown constructors from eyecite 2.7.6 find.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { O } from "@beep/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Match from "effect/Match";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { guessCitationCaseCourt } from "./CaseMetadata.ts";
import {
  CitationCaseNameSelectionConfiguration,
  copyCitationCaseNameSelectionConfiguration,
  selectCitationCaseName,
} from "./CaseNameSelection.ts";
import {
  CitationEditionInferenceInput,
  makeCitationEditionInference,
  prepareCitationEditionInferenceInput,
} from "./EditionInference.ts";
import { CitationTokenExtractionInput, validateCitationTokenWord } from "./ExtractionContext.ts";
import { CitationFrozenEditions } from "./FrozenEditions.ts";
import {
  CitationPublicationMetadataConfiguration,
  copyCitationMetadataPatternConfiguration,
  decodeCitationMetadataRuntimeConfiguration,
  decodeCitationMetadataWordRequest,
  makeCitationMetadataOperation,
  matchCitationMetadataContext,
  prepareCitationPublicationMetadata,
} from "./MetadataComposition.ts";
import { extractCitationPinCite } from "./PinExtraction.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { CitationTokenContextInput } from "./TokenContext.ts";
import { CitationTokenDispatchBindings } from "./TokenDispatch.ts";
import { CitationTokenSeed } from "./TokenObjects.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/ReferenceTokenExtraction");
const Value = S.NullOr(CitationPythonUnicodeStorage);
const Reason = LiteralKit([
  "invalid-input",
  "invalid-configuration",
  "missing-page",
  "missing-edition",
  "missing-capture",
  "not-reference-token",
]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed built-in reference-token construction failures without source text.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationReferenceTokenFailure extends S.TaggedError<
  CitationReferenceTokenFailure,
  { readonly brand: unique symbol }
>($I`CitationReferenceTokenFailure`)(
  "CitationReferenceTokenFailure",
  { reason: Reason },
  $I.annoteError<CitationReferenceTokenFailure>("CitationReferenceTokenFailure", {
    description: "Reference-token construction refused without a partial model or nested source cause.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationReferenceTokenFailure.make({ reason });
/** @internal @category models @since 0.0.0 */
export class CitationReferenceTokenConfiguration extends S.Opaque<
  CitationReferenceTokenConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    pin: CitationPublicationMetadataConfiguration,
    names: CitationCaseNameSelectionConfiguration,
    editions: CitationTokenDispatchBindings,
    supra: S.Struct({
      pattern: CitationPythonUnicodeStorage,
      bindings: CitationPublicationMetadataConfiguration.fields.bindings,
    }),
  }).pipe(
    $I.annoteSchema("CitationReferenceTokenConfiguration", {
      description: "Owned pin/name helpers, original supra pattern and immutable edition mapping.",
    })
  )
) {}
const BaseMetadata = S.Struct({
  pinCite: Value,
  parenthetical: Value,
  pinCiteSpanStart: S.NullOr(S.Int),
  pinCiteSpanEnd: S.NullOr(S.Int),
}).pipe($I.annoteSchema("BaseMetadata", { description: "Original fresh CitationBase metadata slots." }));
const SpanState = S.Struct({
  spanEnd: S.NullOr(S.Int),
  fullSpanStart: S.NullOr(S.Int),
  fullSpanEnd: S.NullOr(S.Int),
}).pipe(
  $I.annoteSchema("SpanState", { description: "Original unverified source span overrides, preserving None and zero." })
);
/** @internal @category models @since 0.0.0 */
export const CitationReferenceTokenOutcome = S.TaggedUnion({
  ShortCaseCitation: {
    ...SpanState.fields,
    metadata: S.Struct({
      ...BaseMetadata.fields,
      plaintiff: S.optionalKey(CitationPythonUnicodeStorage),
      antecedentGuess: Value,
      court: Value,
      year: Value,
      month: Value,
      day: Value,
    }),
    year: CitationEditionInferenceInput.fields.year,
    editionGuess: CitationEditionInferenceInput.fields.prior,
  },
  IdCitation: { ...SpanState.fields, metadata: BaseMetadata },
  SupraCitation: {
    ...SpanState.fields,
    metadata: S.Struct({ ...BaseMetadata.fields, antecedentGuess: Value, volume: Value }),
  },
  UnknownCitation: { ...SpanState.fields, metadata: BaseMetadata },
}).pipe(
  $I.annoteSchema("CitationReferenceTokenOutcome", {
    description: "Complete original fresh built-in short/Id./supra/unknown model state.",
  })
);
export type CitationReferenceTokenOutcome = typeof CitationReferenceTokenOutcome.Type;
/** @internal @category models @since 0.0.0 */
export class CitationReferenceTokenResult extends S.Opaque<
  CitationReferenceTokenResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    index: CitationTokenExtractionInput.fields.index,
    token: CitationTokenSeed,
    outcome: CitationReferenceTokenOutcome,
    reservedUnits: S.Natural,
  }).pipe(
    $I.annoteSchema("CitationReferenceTokenResult", {
      description: "Atomic reference-token construction with original token/index and cumulative text accounting.",
    })
  )
) {}
const empty = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array() });
const pinMetadata = (
  pinCite: CitationPythonUnicodeStorage | null,
  parenthetical: CitationPythonUnicodeStorage | null
) => ({ pinCite, parenthetical, pinCiteSpanStart: null, pinCiteSpanEnd: null });
const prepare = Effect.fn("Citation.constructReferenceToken")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationReferenceTokenConfiguration,
  refs: HashMap.HashMap<number, CitationTokenDispatchBindings[number]["ref"]>,
  owner: CitationFrozenEditions["Service"],
  inference: Effect.Success<ReturnType<typeof makeCitationEditionInference>>,
  raw: unknown
) {
  const request = yield* decodeCitationMetadataWordRequest(limits, S.toType(CitationTokenExtractionInput), raw, () =>
    fail("invalid-input")
  );
  yield* validateCitationTokenWord(request, () => fail("invalid-input"));
  const token = CitationTokenSeed.make(request.token);
  const pin = Effect.fn("Citation.referenceTokenPin")((prefix: CitationPythonUnicodeStorage) =>
    extractCitationPinCite(limits, runtime, config.pin, { ...request, tokenEnd: token.end, prefix })
  );
  const short = Effect.fn("Citation.constructShortCase")(function* () {
    if (!token.short) return yield* fail("not-reference-token");
    const page = yield* Effect.fromOption(R.get(token.groups, "page"), () => fail("missing-page"));
    if (page === null) return yield* fail("missing-page");
    const extracted = yield* pin(CitationPythonUnicodeStorage.make(page));
    const spanEnd = extracted.pinCiteSpanEnd === null || extracted.pinCiteSpanEnd === 0 ? 0 : extracted.pinCiteSpanEnd;
    const names = yield* selectCitationCaseName(limits, runtime, config.names, {
      ...request,
      mode: "Short",
      currentName: null,
      spanStart: token.start,
    });
    const resolve = (ids: ReadonlyArray<number>) =>
      Effect.forEach(ids, (id) => Effect.fromOption(HashMap.get(refs, id), () => fail("missing-edition")), {
        concurrency: 1,
      });
    const exact = yield* resolve(token.exact);
    const variation = yield* resolve(token.variation);
    const year = O.getOrNull(names.patch.numericYear);
    const candidates = yield* prepareCitationEditionInferenceInput(limits, { exact, variation, year, prior: null });
    // The short source constructor guesses edition before court.
    const editionGuess = yield* inference.guess(candidates);
    const court = yield* guessCitationCaseCourt(limits, owner, candidates, null);
    return CitationReferenceTokenOutcome.cases.ShortCaseCitation.make({
      spanEnd,
      fullSpanStart: O.getOrNull(names.patch.fullSpanStart),
      fullSpanEnd: spanEnd > token.end ? spanEnd : token.end,
      year,
      editionGuess,
      metadata: {
        ...pinMetadata(extracted.pinCite, extracted.parenthetical),
        ...O.getSomesStruct({ plaintiff: names.patch.plaintiff }),
        antecedentGuess: O.getOrNull(names.patch.antecedentGuess),
        court,
        year: O.getOrNull(names.patch.year),
        month: null,
        day: null,
      },
    });
  });
  const id = Effect.fn("Citation.constructIdCitation")(function* () {
    const extracted = yield* pin(empty);
    return CitationReferenceTokenOutcome.cases.IdCitation.make({
      metadata: pinMetadata(extracted.pinCite, extracted.parenthetical),
      spanEnd: extracted.pinCiteSpanEnd,
      fullSpanStart: null,
      fullSpanEnd: null,
    });
  });
  const supra = Effect.fn("Citation.constructSupraCitation")(function* () {
    const extracted = yield* pin(empty);
    const matched = yield* matchCitationMetadataContext(
      limits,
      runtime,
      config.supra,
      CitationTokenContextInput.make({
        words: request.words,
        prefix: empty,
        startIndex: request.index - 1,
        forward: false,
        stringsOnly: true,
      }),
      () => fail("missing-capture")
    );
    const antecedentGuess = O.isSome(matched) ? yield* matched.value.capture("antecedent") : null;
    const volume = O.isSome(matched) ? yield* matched.value.capture("volume") : null;
    const antecedentLength = O.isSome(matched) ? matched.value.end - matched.value.start : 0;
    const spanEnd = extracted.pinCiteSpanEnd;
    return CitationReferenceTokenOutcome.cases.SupraCitation.make({
      metadata: { ...pinMetadata(extracted.pinCite, extracted.parenthetical), antecedentGuess, volume },
      spanEnd,
      fullSpanStart: token.start - antecedentLength,
      fullSpanEnd: spanEnd === null || spanEnd === 0 ? token.end : spanEnd,
    });
  });
  const outcome: CitationReferenceTokenOutcome = yield* Match.value(token.kind).pipe(
    Match.when("CitationToken", short),
    Match.when("IdToken", id),
    Match.when("SupraToken", supra),
    Match.when("SectionToken", () =>
      Effect.succeed(
        CitationReferenceTokenOutcome.cases.UnknownCitation.make({
          metadata: pinMetadata(null, null),
          spanEnd: null,
          fullSpanStart: null,
          fullSpanEnd: null,
        })
      )
    ),
    Match.orElse(() => Effect.fail(fail("not-reference-token")))
  );
  return { index: request.index, token, outcome };
});
/** Preserve the original four constructor branches under one operation, Scope,
 * captured deadline and text authority. Returned extract has R=never; no host
 * callback enters a request and no partial model escapes a failed phase.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationReferenceTokenExtraction = Effect.fn("Citation.makeReferenceTokenExtraction")(function* (
  policy: unknown,
  runtimeInput: unknown,
  configurationInput: unknown
) {
  const {
    limits,
    runtime,
    configuration: decoded,
  } = yield* decodeCitationMetadataRuntimeConfiguration(
    policy,
    runtimeInput,
    configurationInput,
    S.toType(CitationReferenceTokenConfiguration),
    () => fail("invalid-configuration")
  );
  const pin = yield* prepareCitationPublicationMetadata(
    limits,
    runtime,
    decoded.pin,
    "3d1b06d98647ef244e02b08aee15ff80a0fb3971528a8a9c97854dd35916bb3d",
    () => fail("invalid-configuration")
  );
  const names = yield* copyCitationCaseNameSelectionConfiguration(limits, decoded.names);
  const supra = yield* copyCitationMetadataPatternConfiguration(
    limits,
    S.toType(S.Struct({ pattern: CitationPythonUnicodeStorage })),
    { pattern: decoded.supra.pattern },
    decoded.supra.bindings,
    { pattern: "5e82e531e754da20a304f03d9a0ff46f1e5c89e30c9f2e661f8ec196e584e30d" },
    () => fail("invalid-configuration")
  );
  const config = CitationReferenceTokenConfiguration.make({
    pin: pin.config,
    names,
    supra: { pattern: supra.patterns.pattern, bindings: supra.bindings },
    editions: A.map(decoded.editions, (row) => ({ ...row })),
  });
  const refs = HashMap.fromIterable(A.map(config.editions, (row) => Tuple.make(row.id, row.ref)));
  if (HashMap.size(refs) !== config.editions.length) return yield* fail("invalid-configuration");
  const owner = yield* CitationFrozenEditions;
  const inference = yield* makeCitationEditionInference(limits);
  const installed = yield* makeCitationMetadataOperation(
    limits,
    (raw: unknown) => prepare(limits, runtime, config, refs, owner, inference, raw),
    () => fail("invalid-configuration")
  );
  const extract = Effect.fn("Citation.extractReferenceToken")(
    (raw: unknown) =>
      installed.operation.run(
        "extract",
        Effect.gen(function* () {
          const [result, reservedUnits] = yield* installed.run(raw);
          return CitationReferenceTokenResult.make({ ...result, reservedUnits });
        })
      ),
    installed.timing.timed
  );
  return { extract };
});
