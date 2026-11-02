/**
 * Default callbacks adapted from eyecite 2.7.6 resolve.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationComponents, CitationGroupMember, FullCitation } from "@beep/law-practice-domain/values";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import { CitationDefaultObservation, issueCitationDefaultNone } from "./CallbackObservations.ts";
import { CitationCallbackResult } from "./CallbackResource.ts";
import {
  CitationCallbackDictionary,
  CitationCallbackFailure,
  CitationResolutionCallbacks,
  CitationResolutionWork,
  makeCitationCallbackDictionary,
  makeCitationResolutionWork,
  runPreparedCitationCallbackSession,
} from "./CallbackSession.ts";
import { citationMetadataValues } from "./MetadataValues.ts";
import { prepareCitationResolution } from "./ResolutionInput.ts";
import { hasInvalidCitationPinCite, stripCitationAntecedentPunctuation } from "./ResolverText.ts";
import type { Citation, CitationMention, CitationMentionId } from "@beep/law-practice-domain/values";
import type { CitationCallbackFull, CitationFullsCallbackInput, CitationIdCallbackInput } from "./CallbackSession.ts";
import type { PreparedCitationResolution } from "./ResolutionInput.ts";

const $I = $LawPracticeServerId.create("internal/Citation/DefaultCallbacks");
const Reporter = S.Struct({ value: S.NullOr(S.String), defined: S.Boolean, volume: S.NullOr(S.String) }).pipe(
  $I.annoteSchema("Reporter", {
    description: "Lazy corrected-reporter comparison fields preserving absent/null groups.",
  })
);
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
  const crypto = yield* Digest.Digest;
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
  const unique = Effect.fn("Citation.defaultUniqueResources")((fulls: ReadonlyArray<CitationCallbackFull>) =>
    dictionary.uniqueResourceCount(A.map(fulls, (entry) => entry.resource))
  );
  const unresolved = Effect.fn("Citation.defaultUnresolved")(
    (
      mentionId: CitationMentionId,
      reason: Extract<CitationDefaultObservation, { readonly _tag: "Unresolved" }>["reason"]
    ) => issueCitationDefaultNone(CitationDefaultObservation.cases.Unresolved.make({ mentionId, reason }))
  );
  const rejectedCandidates = Effect.fn("Citation.defaultRejectedCandidates")(
    (mentionId: CitationMentionId, fulls: ReadonlyArray<CitationCallbackFull>, count: number) =>
      count === 0
        ? unresolved(mentionId, "no-matching-authority")
        : issueCitationDefaultNone(
            CitationDefaultObservation.cases.Ambiguous.make({
              mentionId,
              distinctCount: count,
              resources: A.map(fulls, (entry) => entry.resource),
            })
          )
  );
  const choose = Effect.fn("Citation.defaultChooseResource")(function* (
    fulls: ReadonlyArray<CitationCallbackFull>,
    mentionId: CitationMentionId
  ) {
    const count = yield* unique(fulls);
    return count === 1
      ? CitationCallbackResult.make({ resource: A.getUnsafe(fulls, 0).resource })
      : yield* rejectedCandidates(mentionId, fulls, count);
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
        const count = yield* unique(candidates);
        if (count === 1) return CitationCallbackResult.make({ resource: A.getUnsafe(candidates, 0).resource });
        if (O.exists(citation.metadata.antecedentGuess, Str.isNonEmpty)) {
          candidates = yield* byParty(
            candidates,
            O.getOrElse(citation.metadata.antecedentGuess, () => "")
          );
          return yield* choose(candidates, input.mention.id);
        }
        return yield* rejectedCandidates(input.mention.id, candidates, count);
      },
      Effect.provideService(Digest.Digest, crypto)
    ),
    supra: Effect.fn("Citation.defaultSupraCallback")(
      function* (input: CitationFullsCallbackInput) {
        const citation = yield* currentCitation(input.mention);
        if (citation.type !== "supra") return yield* invalid();
        const guess = citation.metadata.antecedentGuess;
        if (!O.exists(guess, Str.isNonEmpty)) return yield* unresolved(input.mention.id, "missing-antecedent");
        const candidates = yield* byParty(
          input.fulls,
          O.getOrElse(guess, () => "")
        );
        return yield* choose(candidates, input.mention.id);
      },
      Effect.provideService(Digest.Digest, crypto)
    ),
    reference: Effect.fn("Citation.defaultReferenceCallback")(
      function* (input: CitationFullsCallbackInput) {
        const citation = yield* currentCitation(input.mention);
        if (citation.type !== "reference") return yield* invalid();
        const names = A.filter(
          A.getSomes(R.values(Struct.pick(citation.metadata, ["plaintiff", "defendant", "shortCaseName", "caseName"]))),
          Str.isNonEmpty
        );
        if (A.length(names) === 0) return yield* unresolved(input.mention.id, "missing-antecedent");
        let candidates = A.empty<CitationCallbackFull>();
        if (A.length(names) > 0)
          for (const entry of input.fulls) {
            yield* work.step;
            const prior = yield* citationOf(entry.citation);
            const values = yield* citationMetadataValues(prior).pipe(Effect.mapError(invalid));
            if (A.some(names, (name) => A.contains(values, name))) candidates = A.append(candidates, entry);
          }
        return yield* choose(candidates, input.mention.id);
      },
      Effect.provideService(Digest.Digest, crypto)
    ),
    id: Effect.fn("Citation.defaultIdCallback")(
      function* (input: CitationIdCallbackInput) {
        const citation = yield* currentCitation(input.mention);
        if (citation.type !== "id") return yield* invalid();
        if (!(yield* dictionary.isTruthy(input.last)))
          return yield* unresolved(input.mention.id, "no-previous-authority");
        const list = yield* dictionary.get(input.last);
        const first = yield* Effect.fromOption(A.head(yield* dictionary.readList(list)), invalid);
        const prior = yield* citationOf(first);
        const bad = yield* hasInvalidCitationPinCite({ fullCitation: prior, idCitation: citation }).pipe(
          Effect.mapError(() => CitationCallbackFailure.make({ reason: "callback-failed" }))
        );
        return bad
          ? yield* unresolved(input.mention.id, "invalid-pin-cite")
          : CitationCallbackResult.make({ resource: input.last });
      },
      Effect.provideService(Digest.Digest, crypto)
    ),
  });
});

/**
 * Execute prepared default callbacks with the caller's operation work counter.
 * Closing covers callback construction as well as dispatch failures.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const runPreparedDefaultCitationCallbackSession = Effect.fn("Citation.runPreparedDefaultCallbackSession")(
  function* (prepared: PreparedCitationResolution) {
    const work = yield* CitationResolutionWork;
    const dictionary = yield* makeCitationCallbackDictionary(prepared);
    return yield* Effect.gen(function* () {
      const callbacks = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
        Effect.provideService(CitationCallbackDictionary, dictionary)
      );
      return yield* runPreparedCitationCallbackSession(prepared).pipe(
        Effect.provideService(CitationResolutionCallbacks, callbacks),
        Effect.provideService(CitationCallbackDictionary, dictionary),
        Effect.provideService(CitationResolutionWork, work)
      );
    }).pipe(Effect.ensuring(dictionary.close));
  }
);

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
  return yield* runPreparedDefaultCitationCallbackSession(prepared).pipe(
    Effect.provideService(CitationResolutionWork, work)
  );
});
