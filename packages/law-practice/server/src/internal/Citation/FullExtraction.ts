/** _extract_full_citation from eyecite 2.7.6 find.py, Free Law Project, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import {
  CitationCaseMetadataConfiguration,
  CitationCaseMetadataFields,
  CitationCaseMetadataResult,
  makeCitationCaseMetadata,
} from "./CaseMetadata.ts";
import { CitationTokenExtractionInput, validateCitationTokenWord } from "./ExtractionContext.ts";
import { CitationJournalMetadataConfiguration, makeCitationJournalMetadata } from "./JournalMetadata.ts";
import {
  CitationFullLawMetadataResult,
  CitationLawMetadataConfiguration,
  CitationLawMetadataPatch,
  makeCitationFullLawMetadata,
} from "./LawMetadata.ts";
import {
  decodeCitationMetadataRuntimeConfiguration,
  decodeCitationMetadataWordRequest,
} from "./MetadataComposition.ts";
import { makeCitationRegexTiming } from "./RegexPolicy.ts";
import { CitationTokenDispatchBindings, makeCitationTokenDispatch } from "./TokenDispatch.ts";
import { CitationTokenSeed } from "./TokenObjects.ts";
import type { CitationJournalMetadataPatch, CitationJournalMetadataResult } from "./JournalMetadata.ts";

const $I = $LawPracticeServerId.create("internal/Citation/FullExtraction");
const Reason = LiteralKit(["invalid-input", "invalid-configuration", "missing-edition", "not-full-citation"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed full-citation construction failures without source payloads." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationFullExtractionFailure extends S.TaggedError<
  CitationFullExtractionFailure,
  { readonly brand: unique symbol }
>($I`CitationFullExtractionFailure`)(
  "CitationFullExtractionFailure",
  { reason: Reason },
  $I.annoteError<CitationFullExtractionFailure>("CitationFullExtractionFailure", {
    description: "Full citation construction refused without a partial model or source content.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationFullExtractionFailure.make({ reason });
/** @internal @category models @since 0.0.0 */
export class CitationFullExtractionConfiguration extends S.Opaque<
  CitationFullExtractionConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    editions: CitationTokenDispatchBindings,
    case: CitationCaseMetadataConfiguration,
    law: CitationLawMetadataConfiguration,
    journal: CitationJournalMetadataConfiguration,
  }).pipe(
    $I.annoteSchema("CitationFullExtractionConfiguration", {
      description: "Shared source edition mapping and existing case/law/journal metadata configurations.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationFullExtractionInput extends S.Opaque<
  CitationFullExtractionInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ...CitationTokenExtractionInput.fields,
    token: S.Struct({ ...CitationTokenSeed.fields, kind: S.tag("CitationToken"), short: S.tag(false) }),
  }).pipe(
    $I.annoteSchema("CitationFullExtractionInput", {
      description:
        "One actual full citation token in its original Document word context; no metadata or family supplied by the caller.",
    })
  )
) {}
const PublicationFields = S.Struct({
  pinCite: CitationLawMetadataPatch.fields.metadata.fields.pinCite,
  parenthetical: CitationLawMetadataPatch.fields.metadata.fields.parenthetical,
  year: CitationLawMetadataPatch.fields.metadata.fields.year,
  month: CitationLawMetadataPatch.fields.metadata.fields.month,
  day: CitationLawMetadataPatch.fields.metadata.fields.day,
  pinCiteSpanStart: S.NullOr(S.Int),
  pinCiteSpanEnd: S.NullOr(S.Int),
}).pipe(
  $I.annoteSchema("PublicationFields", {
    description: "Complete original fresh law/journal metadata slots before family-specific extension.",
  })
);
const PublicationResult = S.Struct({
  metadata: PublicationFields,
  year: S.NullOr(S.Int),
  fullSpanStart: S.NullOr(S.Int),
  fullSpanEnd: S.NullOr(S.Int),
  editionGuess: CitationFullLawMetadataResult.fields.editionGuess,
  reservedUnits: CitationFullLawMetadataResult.fields.reservedUnits,
}).pipe(
  $I.annoteSchema("PublicationResult", {
    description: "Completed fresh publication model state with captured allocation accounting.",
  })
);
const publication = (result: CitationFullLawMetadataResult | CitationJournalMetadataResult) => {
  const patch = O.getOrNull<CitationLawMetadataPatch | CitationJournalMetadataPatch>(result.patch);
  return {
    metadata: {
      pinCite: null,
      parenthetical: null,
      year: null,
      month: null,
      day: null,
      pinCiteSpanStart: null,
      pinCiteSpanEnd: null,
      ...(patch === null ? {} : patch.metadata),
    },
    year: patch === null ? null : patch.year,
    fullSpanStart: null,
    fullSpanEnd: patch === null ? null : patch.fullSpanEnd,
    editionGuess: result.editionGuess,
    reservedUnits: result.reservedUnits,
  };
};
/** Selected family constructs the complete original fresh built-in model state.
 * @internal @category models @since 0.0.0
 */
export const CitationFullExtractionOutcome = S.TaggedUnion({
  FullCaseCitation: CitationCaseMetadataResult.fields,
  FullLawCitation: {
    ...PublicationResult.fields,
    metadata: S.Struct({
      ...PublicationFields.fields,
      publisher: CitationLawMetadataPatch.fields.metadata.fields.publisher,
    }),
  },
  FullJournalCitation: PublicationResult.fields,
}).pipe(
  $I.annoteSchema("CitationFullExtractionOutcome", {
    description: "Original selected full citation class, complete fresh model state and atomically completed metadata.",
  })
);
export type CitationFullExtractionOutcome = typeof CitationFullExtractionOutcome.Type;
/** @internal @category models @since 0.0.0 */
export class CitationFullExtractionResult extends S.Opaque<
  CitationFullExtractionResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    index: CitationFullExtractionInput.fields.index,
    token: CitationTokenSeed,
    outcome: CitationFullExtractionOutcome,
  }).pipe(
    $I.annoteSchema("CitationFullExtractionResult", {
      description:
        "Constructed private full citation with original token/span and selected family metadata; no verified mention authority.",
    })
  )
) {}
/** Apply the original parallel-case assignment to newly constructed private state.
 * The extraction loop invokes this only for consecutive full cases. Existing
 * text and edition references are reused; no native text or child is produced.
 * @internal @category operations @since 0.0.0
 */
export const inheritCitationParallelCase = Effect.fn("Citation.inheritParallelCase")(function* (
  current: CitationFullExtractionResult,
  preceding: CitationFullExtractionResult
) {
  const state = current.outcome;
  const prior = preceding.outcome;
  if (state._tag !== "FullCaseCitation" || prior._tag !== "FullCaseCitation") return current;
  if (state.fullSpanStart !== prior.fullSpanStart) return current;
  return {
    ...current,
    outcome: {
      ...state,
      metadata: {
        ...state.metadata,
        plaintiff: prior.metadata.plaintiff,
        defendant: prior.metadata.defendant,
        year: prior.metadata.year,
      },
      year: prior.year,
    },
  };
});
/** Original fresh full-case defaults shared with the import-time shortcut model.
 * @internal @category models @since 0.0.0
 */
export const makeCitationEmptyCaseMetadata = () =>
  CitationCaseMetadataFields.make({
    plaintiff: null,
    defendant: null,
    antecedentGuess: null,
    court: null,
    pinCite: null,
    pinCiteSpanStart: null,
    pinCiteSpanEnd: null,
    extra: null,
    parenthetical: null,
    year: null,
    month: null,
    day: null,
    resolvedCaseName: null,
    resolvedCaseNameShort: null,
  });
/** Select the original model class, instantiate fresh built-in state and run the
 * existing family service. Exactly one selected family owns operation admission;
 * the captured outer deadline covers source selection plus metadata. Returned
 * extract requires R=never. Whole-document filtering/references remain separate.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationFullExtraction = Effect.fn("Citation.makeFullExtraction")(function* (
  policy: unknown,
  runtimeInput: unknown,
  configurationInput: unknown
) {
  const {
    limits,
    runtime,
    configuration: config,
  } = yield* decodeCitationMetadataRuntimeConfiguration(
    policy,
    runtimeInput,
    configurationInput,
    S.toType(CitationFullExtractionConfiguration),
    () => fail("invalid-configuration")
  );
  const refs = HashMap.fromIterable(A.map(config.editions, (row) => Tuple.make(row.id, row.ref)));
  const dispatch = yield* makeCitationTokenDispatch(limits, config.editions);
  const cases = yield* makeCitationCaseMetadata(limits, runtime, config.case);
  const laws = yield* makeCitationFullLawMetadata(limits, runtime, config.law);
  const journals = yield* makeCitationJournalMetadata(limits, runtime, config.journal);
  const timing = yield* makeCitationRegexTiming(limits, true);
  const resolve = Effect.fn("Citation.fullExtractionEditions")((ids: ReadonlyArray<number>) =>
    Effect.forEach(ids, (id) => Effect.fromOption(HashMap.get(refs, id), () => fail("missing-edition")), {
      concurrency: 1,
    })
  );
  const extract = Effect.fn("Citation.extractFullCitation")(function* (raw: unknown) {
    const request = yield* decodeCitationMetadataWordRequest(limits, S.toType(CitationFullExtractionInput), raw, () =>
      fail("invalid-input")
    );
    yield* validateCitationTokenWord(request, () => fail("invalid-input"));
    const token = CitationTokenSeed.make(request.token);
    const selected = yield* dispatch.classify(token);
    const exact = yield* resolve(token.exact);
    const variation = yield* resolve(token.variation);
    const common = {
      words: request.words,
      index: request.index,
      spanEnd: token.end,
      year: null,
      exact,
      variation,
      prior: null,
    };
    const outcome: CitationFullExtractionOutcome = yield* Match.value(selected).pipe(
      Match.when("FullCaseCitation", () =>
        cases
          .extract({
            ...common,
            spanStart: token.start,
            fullSpanStart: null,
            fullSpanEnd: null,
            metadata: makeCitationEmptyCaseMetadata(),
            geometry: request.geometry,
          })
          .pipe(Effect.map((metadata) => CitationFullExtractionOutcome.cases.FullCaseCitation.make(metadata)))
      ),
      Match.when("FullLawCitation", () =>
        laws.apply(common).pipe(
          Effect.map((metadata) => {
            const complete = publication(metadata);
            return CitationFullExtractionOutcome.cases.FullLawCitation.make({
              ...complete,
              metadata: { publisher: null, ...complete.metadata },
            });
          })
        )
      ),
      Match.when("FullJournalCitation", () =>
        journals
          .apply(common)
          .pipe(
            Effect.map((metadata) =>
              CitationFullExtractionOutcome.cases.FullJournalCitation.make(publication(metadata))
            )
          )
      ),
      Match.orElse(() => Effect.fail(fail("not-full-citation")))
    );
    return CitationFullExtractionResult.make({ index: request.index, token, outcome });
  }, timing.timed);
  return { extract };
});
