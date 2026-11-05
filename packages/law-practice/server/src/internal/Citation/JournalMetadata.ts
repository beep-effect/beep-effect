/** FullJournalCitation.add_metadata from eyecite 2.7.6 models.py/helpers.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { makeCitationEditionInference, prepareCitationEditionInferenceInput } from "./EditionInference.ts";
import { CitationFullLawMetadataInput, CitationLawMetadataPatch, CitationLawMetadataResult } from "./LawMetadata.ts";
import {
  CitationMetadataStringConfiguration,
  CitationMetadataStringFields,
  citationMetadataContext,
  makeCitationMetadataOperation,
  matchCitationMetadataContext,
  prepareCitationPublicationMetadata,
  processCitationMetadataStrings,
} from "./MetadataComposition.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { CitationRegexPatternDescriptor } from "./RegexDescriptors.ts";
import { decodeCitationRegexPolicy } from "./RegexPolicy.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationPublicationMetadataConfiguration } from "./MetadataComposition.ts";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/JournalMetadata");
const Reason = LiteralKit(["invalid-input", "invalid-configuration", "missing-capture"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed journal metadata errors without text or edition references." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationJournalMetadataFailure extends S.TaggedError<
  CitationJournalMetadataFailure,
  { readonly brand: unique symbol }
>($I`CitationJournalMetadataFailure`)(
  "CitationJournalMetadataFailure",
  { reason: Reason },
  $I.annoteError<CitationJournalMetadataFailure>("CitationJournalMetadataFailure", {
    description: "Journal composition failed without source payload or nested causes.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationJournalMetadataFailure.make({ reason });
/** Source-bound journal patterns and captured calendar state.
 * @internal @category models @since 0.0.0
 */
export class CitationJournalMetadataConfiguration extends S.Opaque<
  CitationJournalMetadataConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ...CitationMetadataStringConfiguration.fields,
    journalPattern: CitationPythonUnicodeStorage,
    journalBindings: S.Array(CitationRegexPatternDescriptor).check(S.isBetweenLength(2, 2)),
  }).pipe(
    $I.annoteSchema("CitationJournalMetadataConfiguration", {
      description: "Private journal/year pattern installation; raw requests contain no executable configuration.",
    })
  )
) {}
/** Shared built-in full-resource state; source family field assignment stays distinct.
 * @internal @category models @since 0.0.0
 */
export class CitationJournalMetadataInput extends S.Opaque<
  CitationJournalMetadataInput,
  { readonly brand: unique symbol }
>()(
  S.Struct(CitationFullLawMetadataInput.fields).pipe(
    $I.annoteSchema("CitationJournalMetadataInput", {
      description: "Native words, prior numeric year and ordered edition state before full journal metadata.",
    })
  )
) {}
/** Only fields written by the journal helper; positions are unverified Python points.
 * @internal @category models @since 0.0.0
 */
export class CitationJournalMetadataPatch extends S.Opaque<
  CitationJournalMetadataPatch,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    fullSpanEnd: CitationLawMetadataPatch.fields.fullSpanEnd,
    year: S.NullOr(S.Int),
    metadata: CitationMetadataStringFields,
  }).pipe(
    $I.annoteSchema("CitationJournalMetadataPatch", {
      description: "Owned journal metadata patch, excluding untouched inherited month/day and mention fields.",
    })
  )
) {}
/** Complete journal helper and superclass selection output, published together.
 * @internal @category models @since 0.0.0
 */
export class CitationJournalMetadataResult extends S.Opaque<
  CitationJournalMetadataResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    patch: S.Option(CitationJournalMetadataPatch),
    editionGuess: S.NullOr(CitationEditionRef),
    reservedUnits: CitationLawMetadataResult.fields.reservedUnits,
  }).pipe(
    $I.annoteSchema("CitationJournalMetadataResult", {
      description: "Complete source journal changes and selected edition with invocation accounting.",
    })
  )
) {}
const Input = S.toType(CitationJournalMetadataInput);
const Config = S.toType(CitationJournalMetadataConfiguration);
const preparePatch = Effect.fn("Citation.prepareJournalMetadataPatch")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationPublicationMetadataConfiguration,
  request: CitationJournalMetadataInput
) {
  const owned = yield* matchCitationMetadataContext(
    limits,
    runtime,
    config,
    citationMetadataContext({ ...request, forward: true }),
    () => fail("missing-capture")
  );
  if (O.isNone(owned)) return O.none<CitationJournalMetadataPatch>();
  const pinCite = yield* owned.value.capture("pin_cite");
  const parenthetical = yield* owned.value.capture("parenthetical");
  const year = yield* owned.value.capture("year");
  const common = yield* processCitationMetadataStrings(
    limits,
    runtime,
    CitationMetadataStringConfiguration.make(config),
    CitationMetadataStringFields.make({ pinCite, parenthetical, year }),
    request.year
  );
  return O.some(
    CitationJournalMetadataPatch.make({
      fullSpanEnd: request.spanEnd + owned.value.end,
      year: common.numericYear,
      metadata: CitationMetadataStringFields.make({
        pinCite: common.pinCite,
        parenthetical: common.parenthetical,
        year: common.year,
      }),
    })
  );
});
/** Compose source journal helper and superclass inference under shared owners.
 * Each native call owns a fresh Scope; one admission/deadline covers both stages.
 * Configuration is snapshotted once and returned methods have R = never.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationJournalMetadata = Effect.fn("Citation.makeJournalMetadata")(function* (
  policy: unknown,
  runtimeInput: unknown,
  configurationInput: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => fail("invalid-configuration"));
  const decoded = yield* S.decodeUnknownEffect(Config)(configurationInput).pipe(
    Effect.mapError(() => fail("invalid-configuration"))
  );
  const { runtime, config } = yield* prepareCitationPublicationMetadata(
    limits,
    runtimeInput,
    { ...decoded, pattern: decoded.journalPattern, bindings: decoded.journalBindings },
    "1b0484f822d2762ae3517e7a1152feea80d96791582a126e0bd3f8789cb66200",
    () => fail("invalid-configuration")
  );
  const installed = yield* makeCitationMetadataOperation(
    limits,
    (request: CitationJournalMetadataInput) => preparePatch(limits, runtime, config, request),
    () => fail("invalid-configuration")
  );
  const inference = yield* makeCitationEditionInference(limits);
  const apply = Effect.fn("Citation.addJournalMetadata")(
    (raw: unknown) =>
      installed.operation.run(
        "extract",
        Effect.gen(function* () {
          const selection = yield* prepareCitationEditionInferenceInput(limits, raw);
          const request = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
          const [patch, reservedUnits] = yield* installed.run(request);
          const year = O.match(patch, { onNone: () => request.year, onSome: (value) => value.year });
          const editionGuess = yield* inference.guess({ ...selection, year });
          return CitationJournalMetadataResult.make({ patch, editionGuess, reservedUnits });
        })
      ),
    installed.timing.timed
  );
  return { apply };
});
