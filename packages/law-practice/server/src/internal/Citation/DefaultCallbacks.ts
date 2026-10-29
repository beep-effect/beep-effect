/**
 * Default callbacks adapted from eyecite 2.7.6 resolve.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Citation, CitationComponents, CitationGroupMember, FullCitation } from "@beep/law-practice-domain/values";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import {
  CitationCallbackDictionary,
  CitationCallbackFailure,
  CitationCallbackResource,
  CitationResolutionCallbacks,
  CitationResolutionWork,
  makeCitationCallbackDictionary,
  makeCitationResolutionWork,
  runPreparedCitationCallbackSession,
} from "./CallbackSession.ts";
import { prepareCitationResolution } from "./ResolutionInput.ts";
import { hasInvalidCitationPinCite, stripCitationAntecedentPunctuation } from "./ResolverText.ts";
import type { CitationMention } from "@beep/law-practice-domain/values";
import type { CitationCallbackFull, CitationFullsCallbackInput, CitationIdCallbackInput } from "./CallbackSession.ts";
import type { PreparedCitationResolution } from "./ResolutionInput.ts";

const $I = $LawPracticeServerId.create("internal/Citation/DefaultCallbacks");
const Reporter = S.Struct({ value: S.NullOr(S.String), defined: S.Boolean, volume: S.NullOr(S.String) }).pipe(
  $I.annoteSchema("Reporter", {
    description: "Lazy corrected-reporter comparison fields preserving absent/null groups.",
  })
);
const none = () => CitationCallbackResource.cases.None.make({});
const invalid = () => CitationCallbackFailure.make({ reason: "invalid-input" });
const isFull = S.is(FullCitation);

/**
 * Capture Crypto, the verified operation's witnesses and its shared work
 * counter. Returned callbacks have R = never and no cross-operation cache.
 * This is the default behavior only; no host-object normalization is implied.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeDefaultCitationResolutionCallbacks = Effect.fn("Citation.makeDefaultCallbacks")(function* (
  prepared: PreparedCitationResolution
) {
  const crypto = yield* Crypto.Crypto;
  const work = yield* CitationResolutionWork;
  const dictionary = yield* CitationCallbackDictionary;
  if (dictionary.owner !== prepared || dictionary.work !== work) return yield* invalid();
  const editions = HashMap.fromIterable(A.map(prepared.editions, (edition) => Tuple.make(edition.edition, edition)));
  const citationOf = dictionary.citationOf;
  const currentCitation = Effect.fn("Citation.defaultCurrentSemantic")((mention: CitationMention) =>
    citationOf(CitationGroupMember.cases.Mention.make({ mentionId: mention.id }))
  );
  const selected = Effect.fn("Citation.defaultSelectedEdition")(function* (citation: Citation) {
    if (!isFull(citation) && citation.type !== "shortFormCase") return O.none();
    const edition = O.flatMap(citation.publication.selectedEdition, (id) => HashMap.get(editions, id));
    if (O.isSome(citation.publication.selectedEdition) && O.isNone(edition))
      return yield* CitationCallbackFailure.make({ reason: "identity-failed" });
    return edition;
  });
  const reporter = Effect.fn("Citation.defaultCorrectedReporter")(function* (citation: Citation) {
    const edition = yield* selected(citation);
    const groups = yield* S.encodeEffect(CitationComponents)(citation.components).pipe(Effect.mapError(invalid));
    return Reporter.make({
      value: O.isSome(edition) ? edition.value.shortName : O.getOrElse(R.get(groups, "reporter"), () => null),
      defined: O.isSome(edition) || O.isSome(R.get(groups, "reporter")),
      volume: O.getOrElse(R.get(groups, "volume"), () => null),
    });
  });
  const key = dictionary.resourceKey;
  const unique = Effect.fn("Citation.defaultUniqueResources")(function* (fulls: ReadonlyArray<CitationCallbackFull>) {
    const keys = yield* Effect.forEach(fulls, (entry) => work.step.pipe(Effect.andThen(key(entry.resource))), {
      concurrency: 1,
    });
    return A.length(A.dedupe(keys));
  });
  const choose = Effect.fn("Citation.defaultChooseResource")(function* (fulls: ReadonlyArray<CitationCallbackFull>) {
    return (yield* unique(fulls)) === 1 ? A.getUnsafe(fulls, 0).resource : none();
  });
  const partyMatches = (citation: Citation, guess: string) =>
    citation.type === "case" &&
    (O.exists(citation.metadata.plaintiff, (name) => Str.isNonEmpty(name) && Str.includes(guess)(name)) ||
      O.exists(citation.metadata.defendant, (name) => Str.isNonEmpty(name) && Str.includes(guess)(name)));
  const byParty = Effect.fn("Citation.defaultFilterParty")(function* (
    fulls: ReadonlyArray<CitationCallbackFull>,
    guess: string
  ) {
    let found = A.empty<CitationCallbackFull>();
    const stripped = stripCitationAntecedentPunctuation(guess);
    for (const entry of fulls) {
      yield* work.step;
      if (partyMatches(yield* citationOf(entry.citation), stripped)) found = A.append(found, entry);
    }
    return found;
  });
  const metadataValues = Effect.fn("Citation.defaultMetadataValues")(function* (citation: Citation) {
    const wire = yield* S.encodeEffect(Citation)(citation);
    const metadata = yield* S.decodeEffect(S.Record(S.String, S.Unknown))(wire.metadata);
    let values = A.filter(R.values(metadata), S.is(S.NonEmptyString));
    if (citation.type === "case" && O.isSome(citation.metadata.court)) {
      const court = citation.metadata.court.value;
      const name = court.status === "known" ? court.id : court.value;
      if (Str.isNonEmpty(name)) values = A.append(values, name);
    }
    return values;
  }, Effect.mapError(invalid));
  return CitationResolutionCallbacks.of({
    full: Effect.fn("Citation.defaultFullCallback")((mention: CitationMention) =>
      dictionary.canonicalResource(CitationGroupMember.cases.Mention.make({ mentionId: mention.id }))
    ),
    shortCase: Effect.fn("Citation.defaultShortCallback")(
      function* (input: CitationFullsCallbackInput) {
        const citation = yield* currentCitation(input.mention);
        if (citation.type !== "shortFormCase") return yield* invalid();
        const current = yield* reporter(citation);
        let candidates = A.empty<CitationCallbackFull>();
        for (const entry of input.fulls) {
          yield* work.step;
          const prior = yield* citationOf(entry.citation);
          if (prior.type !== "case") continue;
          const previous = yield* reporter(prior);
          if (!current.defined || !previous.defined) return yield* invalid();
          if (current.value === previous.value && current.volume === previous.volume)
            candidates = A.append(candidates, entry);
        }
        if ((yield* unique(candidates)) !== 1 && O.exists(citation.metadata.antecedentGuess, Str.isNonEmpty))
          candidates = yield* byParty(
            candidates,
            O.getOrElse(citation.metadata.antecedentGuess, () => "")
          );
        return { resource: yield* choose(candidates) };
      },
      Effect.provideService(Crypto.Crypto, crypto)
    ),
    supra: Effect.fn("Citation.defaultSupraCallback")(
      function* (input: CitationFullsCallbackInput) {
        const citation = yield* currentCitation(input.mention);
        if (citation.type !== "supra") return yield* invalid();
        const guess = citation.metadata.antecedentGuess;
        const candidates = O.exists(guess, Str.isNonEmpty)
          ? yield* byParty(
              input.fulls,
              O.getOrElse(guess, () => "")
            )
          : [];
        return { resource: yield* choose(candidates) };
      },
      Effect.provideService(Crypto.Crypto, crypto)
    ),
    reference: Effect.fn("Citation.defaultReferenceCallback")(
      function* (input: CitationFullsCallbackInput) {
        const citation = yield* currentCitation(input.mention);
        if (citation.type !== "reference") return yield* invalid();
        const names = A.filter(
          A.getSomes(R.values(Struct.pick(citation.metadata, ["plaintiff", "defendant", "shortCaseName", "caseName"]))),
          Str.isNonEmpty
        );
        let candidates = A.empty<CitationCallbackFull>();
        if (A.length(names) > 0)
          for (const entry of input.fulls) {
            yield* work.step;
            const prior = yield* citationOf(entry.citation);
            const values = yield* metadataValues(prior);
            if (A.some(names, (name) => A.contains(values, name))) candidates = A.append(candidates, entry);
          }
        return { resource: yield* choose(candidates) };
      },
      Effect.provideService(Crypto.Crypto, crypto)
    ),
    id: Effect.fn("Citation.defaultIdCallback")(
      function* (input: CitationIdCallbackInput) {
        const citation = yield* currentCitation(input.mention);
        if (citation.type !== "id") return yield* invalid();
        if (input.last._tag === "None" || !input.last.truthy) return { resource: none() };
        const list = yield* dictionary.get(input.last);
        const first = yield* Effect.fromOption(A.head(yield* dictionary.readList(list)), invalid);
        const prior = yield* citationOf(first);
        const bad = yield* hasInvalidCitationPinCite({ fullCitation: prior, idCitation: citation }).pipe(
          Effect.mapError(() => CitationCallbackFailure.make({ reason: "callback-failed" }))
        );
        return { resource: bad ? none() : input.last };
      },
      Effect.provideService(Crypto.Crypto, crypto)
    ),
  });
});

/**
 * Run a fresh default callback session after one shared input verification.
 * Work state and callbacks are allocated per operation, including concurrent
 * operations; final document diagnostics/projection remain separate.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const runDefaultCitationCallbackSession = Effect.fn("Citation.runDefaultCallbackSession")(function* (
  input: unknown
) {
  const prepared = yield* prepareCitationResolution(input).pipe(
    Effect.mapError((error) => CitationCallbackFailure.make({ reason: error.reason }))
  );
  const work = yield* makeCitationResolutionWork(prepared.limits);
  const dictionary = yield* makeCitationCallbackDictionary(prepared).pipe(
    Effect.provideService(CitationResolutionWork, work)
  );
  const callbacks = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
    Effect.provideService(CitationCallbackDictionary, dictionary),
    Effect.provideService(CitationResolutionWork, work)
  );
  return yield* runPreparedCitationCallbackSession(prepared).pipe(
    Effect.provideService(CitationResolutionCallbacks, callbacks),
    Effect.provideService(CitationCallbackDictionary, dictionary),
    Effect.provideService(CitationResolutionWork, work)
  );
});
