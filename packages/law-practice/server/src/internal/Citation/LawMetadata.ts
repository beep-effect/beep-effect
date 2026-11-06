/** add_law_metadata composition from eyecite 2.7.6 helpers.py (BSD-2-Clause).
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  CitationEditionInferenceInput,
  makeCitationEditionInference,
  prepareCitationEditionInferenceInput,
} from "./EditionInference.ts";
import {
  CitationMetadataStringConfiguration,
  CitationMetadataStringFields,
  CitationPublicationMetadataConfiguration,
  citationMetadataContext,
  makeCitationMetadataOperation,
  matchCitationMetadataContext,
  prepareCitationPublicationMetadata,
  processCitationMetadataStrings,
} from "./MetadataComposition.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { CitationRegexPatternDescriptor } from "./RegexDescriptors.ts";
import { decodeCitationRegexPolicy } from "./RegexPolicy.ts";
import { CitationTokenContextInput } from "./TokenContext.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/LawMetadata");
const max = CitationEngineAbsoluteMaxima;
const Position = S.Natural.check(S.isLessThanOrEqualTo(max.sourceUtf16)).pipe(
  $I.annoteSchema("Position", { description: "Unverified source point within the input ceiling." })
);
const Reason = LiteralKit(["invalid-input", "invalid-configuration", "missing-capture"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed law metadata preparation failures without source text." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationLawMetadataFailure extends S.TaggedError<
  CitationLawMetadataFailure,
  { readonly brand: unique symbol }
>($I`CitationLawMetadataFailure`)(
  "CitationLawMetadataFailure",
  { reason: Reason },
  $I.annoteError<CitationLawMetadataFailure>("CitationLawMetadataFailure", {
    description: "Law metadata composition failed without source values or nested causes.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationLawMetadataFailure.make({ reason });
const invalidConfiguration = () => fail("invalid-configuration");
const invalidInput = () => fail("invalid-input");
/** Server installation data, including a previously captured calendar ceiling.
 * @internal @category models @since 0.0.0
 */
export class CitationLawMetadataConfiguration extends S.Opaque<
  CitationLawMetadataConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    lawPattern: CitationPythonUnicodeStorage,
    ...CitationMetadataStringConfiguration.fields,
    lawBindings: S.Array(CitationRegexPatternDescriptor).check(S.isBetweenLength(2, 2)),
  }).pipe(
    $I.annoteSchema("CitationLawMetadataConfiguration", {
      description: "Source-bound private law/year patterns, descriptors and captured calendar data.",
    })
  )
) {}
/** Source helper inputs, not the public raw-text request.
 * @internal @category models @since 0.0.0
 */
export class CitationLawMetadataInput extends S.Opaque<CitationLawMetadataInput, { readonly brand: unique symbol }>()(
  S.Struct({
    words: CitationTokenContextInput.fields.words,
    index: S.Int.check(S.isBetween({ minimum: -max.tokens, maximum: max.tokens })),
    spanEnd: Position,
    year: S.NullOr(S.Int),
  }).pipe(
    $I.annoteSchema("CitationLawMetadataInput", {
      description: "Built-in words and source citation state before add_law_metadata.",
    })
  )
) {}
const NativeValue = S.NullOr(CitationPythonUnicodeStorage).pipe(
  $I.annoteSchema("NativeValue", { description: "Source-native metadata string or Python None." })
);
/** Only the fields written by the source helper. Other citation fields are untouched.
 * Positions remain unverified Python points until document mapping.
 * @internal @category models @since 0.0.0
 */
export class CitationLawMetadataPatch extends S.Opaque<CitationLawMetadataPatch, { readonly brand: unique symbol }>()(
  S.Struct({
    fullSpanEnd: S.Natural.check(S.isLessThanOrEqualTo(max.sourceUtf16 + 300)),
    year: S.NullOr(S.Int),
    metadata: S.Struct({
      pinCite: NativeValue,
      publisher: NativeValue,
      day: NativeValue,
      month: NativeValue,
      parenthetical: NativeValue,
      year: NativeValue,
    }),
  }).pipe(
    $I.annoteSchema("CitationLawMetadataPatch", {
      description:
        "Complete owned source-native law metadata field updates, without edition inference or document authority.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationLawMetadataResult extends S.Opaque<CitationLawMetadataResult, { readonly brand: unique symbol }>()(
  S.Struct({
    patch: S.Option(CitationLawMetadataPatch),
    reservedUnits: S.Natural.check(S.isLessThanOrEqualTo(max.producedTextUtf16)),
  }).pipe(
    $I.annoteSchema("CitationLawMetadataResult", {
      description: "Complete source patch or no match, with source-free invocation reservation accounting.",
    })
  )
) {}
const Config = S.toType(CitationLawMetadataConfiguration);
const Input = S.toType(CitationLawMetadataInput);
const prepareConfiguration = Effect.fn("Citation.prepareLawMetadataConfiguration")(function* (
  limits: CitationEngineLimits,
  runtimeInput: unknown,
  configurationInput: unknown
) {
  const decoded = yield* S.decodeUnknownEffect(Config)(configurationInput).pipe(Effect.mapError(invalidConfiguration));
  const prepared = yield* prepareCitationPublicationMetadata(
    limits,
    runtimeInput,
    { ...decoded, pattern: decoded.lawPattern, bindings: decoded.lawBindings },
    "bcfd81892211f7373d1a515cebf32c58ad43da653d5f20dab85df00dbcc6edef",
    invalidConfiguration
  );
  return {
    runtime: prepared.runtime,
    config: CitationLawMetadataConfiguration.make({
      ...prepared.config,
      lawPattern: prepared.config.pattern,
      lawBindings: prepared.config.bindings,
    }),
  };
});
const preparePatch = Effect.fn("Citation.prepareLawMetadataPatch")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationLawMetadataConfiguration,
  request: CitationLawMetadataInput
) {
  const owned = yield* matchCitationMetadataContext(
    limits,
    runtime,
    CitationPublicationMetadataConfiguration.make({
      ...config,
      pattern: config.lawPattern,
      bindings: config.lawBindings,
    }),
    citationMetadataContext({ ...request, forward: true }),
    () => fail("missing-capture")
  );
  if (O.isNone(owned)) return O.none<CitationLawMetadataPatch>();
  const pin = yield* owned.value.capture("pin_cite");
  const publisher = yield* owned.value.capture("publisher");
  const day = yield* owned.value.capture("day");
  const month = yield* owned.value.capture("month");
  const parenthetical = yield* owned.value.capture("parenthetical");
  const rawYear = yield* owned.value.capture("year");
  const common = yield* processCitationMetadataStrings(
    limits,
    runtime,
    CitationMetadataStringConfiguration.make(config),
    CitationMetadataStringFields.make({ pinCite: pin, parenthetical, year: rawYear }),
    request.year
  );
  const patch = CitationLawMetadataPatch.make({
    fullSpanEnd: request.spanEnd + owned.value.end,
    year: common.numericYear,
    metadata: {
      pinCite: common.pinCite,
      publisher,
      day,
      month,
      parenthetical: common.parenthetical,
      year: common.year,
    },
  });
  return O.some(patch);
});
const installLawMetadata = Effect.fn("Citation.installLawMetadata")(function* (
  policy: unknown,
  runtimeInput: unknown,
  configurationInput: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, invalidConfiguration);
  const { runtime, config } = yield* prepareConfiguration(limits, runtimeInput, configurationInput);
  const installed = yield* makeCitationMetadataOperation(
    limits,
    (request: CitationLawMetadataInput) => preparePatch(limits, runtime, config, request),
    invalidConfiguration
  );
  const run = Effect.fn("Citation.runLawMetadata")(function* (request: CitationLawMetadataInput) {
    const [patch, reservedUnits] = yield* installed.run(request);
    return CitationLawMetadataResult.make({ patch, reservedUnits });
  });
  return { ...installed, limits, run };
});
/** Install immutable source configuration and shared admission. Each call uses
 * a fresh Scope and captures no outer Scope in its dependency Context. An
 * enclosing installed budget is retained, otherwise calls get fresh owners.
 * Methods have R = never and never return partially assigned metadata.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationLawMetadata = Effect.fn("Citation.makeLawMetadata")(function* (
  policy: unknown,
  runtimeInput: unknown,
  configurationInput: unknown
) {
  const installed = yield* installLawMetadata(policy, runtimeInput, configurationInput);
  const apply = Effect.fn("Citation.addLawMetadata")(
    (raw: unknown) =>
      installed.operation.run(
        "extract",
        Effect.gen(function* () {
          const request = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(invalidInput));
          return yield* installed.run(request);
        })
      ),
    installed.timing.timed
  );
  return { apply };
});
/** Built-in full-law state before metadata and superclass edition selection.
 * @internal @category models @since 0.0.0
 */
export class CitationFullLawMetadataInput extends S.Opaque<
  CitationFullLawMetadataInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({ ...CitationLawMetadataInput.fields, ...CitationEditionInferenceInput.fields }).pipe(
    $I.annoteSchema("CitationFullLawMetadataInput", {
      description: "One source year shared by law metadata and edition selection.",
    })
  )
) {}
/** Complete helper patch and resulting superclass guess, published together.
 * @internal @category models @since 0.0.0
 */
export class CitationFullLawMetadataResult extends S.Opaque<
  CitationFullLawMetadataResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({ ...CitationLawMetadataResult.fields, editionGuess: S.NullOr(CitationEditionRef) }).pipe(
    $I.annoteSchema("CitationFullLawMetadataResult", {
      description: "Atomic observable full-law metadata and superclass selection result.",
    })
  )
) {}
/** Preserve FullLawCitation.add_metadata order inside one captured admission
 * and deadline. The helper's updated year drives superclass inference; a late
 * failure publishes no patch or guess. Existing owners perform all work.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationFullLawMetadata = Effect.fn("Citation.makeFullLawMetadata")(function* (
  policy: unknown,
  runtimeInput: unknown,
  configurationInput: unknown
) {
  const installed = yield* installLawMetadata(policy, runtimeInput, configurationInput);
  const inference = yield* makeCitationEditionInference(installed.limits);
  const apply = Effect.fn("Citation.addFullLawMetadata")(
    (raw: unknown) =>
      installed.operation.run(
        "extract",
        Effect.gen(function* () {
          const selection = yield* prepareCitationEditionInferenceInput(installed.limits, raw);
          const request = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(invalidInput));
          const result = yield* installed.run(request);
          const year = O.match(result.patch, { onNone: () => request.year, onSome: (patch) => patch.year });
          const editionGuess = yield* inference.guess({ ...selection, year });
          return CitationFullLawMetadataResult.make({ ...result, editionGuess });
        })
      ),
    installed.timing.timed
  );
  return { apply };
});
