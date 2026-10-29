/**
 * Default callbacks adapted from eyecite 2.7.6 resolve.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationComponents, FullCitation } from "@beep/law-practice-domain/values";
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
import { CitationAuthorityIdentityInput } from "./AuthorityIdentity.ts";
import {
  CitationCallbackFailure,
  CitationCallbackResource,
  CitationResolutionCallbacks,
  CitationResolutionWork,
  makeCitationResolutionWork,
  runPreparedCitationCallbackSession,
} from "./CallbackSession.ts";
import { prepareCitationResolution } from "./ResolutionInput.ts";
import { hasInvalidCitationPinCite, stripCitationAntecedentPunctuation } from "./ResolverText.ts";
import { CitationResourceIdentity, makeCitationResourceAuthorityId } from "./ResourceIdentity.ts";
import type { Citation, CitationMention, CitationMentionId } from "@beep/law-practice-domain/values";
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
  const byMention = HashMap.fromIterable(A.map(prepared.mentions, (mention) => Tuple.make(mention.id, mention)));
  const editions = HashMap.fromIterable(A.map(prepared.editions, (edition) => Tuple.make(edition.edition, edition)));
  const mentionOf = Effect.fn("Citation.defaultMention")(function* (id: CitationMentionId) {
    return yield* Effect.fromOption(HashMap.get(byMention, id), invalid);
  });
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
  const key = Effect.fn("Citation.defaultResourceKey")(
    function* (resource: CitationCallbackResource) {
      if (resource._tag === "None") return "none";
      if (resource._tag === "Unhashable") return yield* CitationCallbackFailure.make({ reason: "unhashable-resource" });
      return yield* makeCitationResourceAuthorityId(resource.identity);
    },
    Effect.mapError((error) =>
      S.is(CitationCallbackFailure)(error) ? error : CitationCallbackFailure.make({ reason: "identity-failed" })
    )
  );
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
      if (partyMatches((yield* mentionOf(entry.mentionId)).citation, stripped)) found = A.append(found, entry);
    }
    return found;
  });
  const metadataValues = Effect.fn("Citation.defaultMetadataValues")(function* (citation: FullCitation) {
    const wire = yield* S.encodeEffect(FullCitation)(citation);
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
    full: Effect.fn("Citation.defaultFullCallback")(function* (mention: CitationMention) {
      if (!isFull(mention.citation)) return yield* invalid();
      const edition = yield* selected(mention.citation);
      return CitationCallbackResource.cases.Hashable.make({
        identity: CitationResourceIdentity.cases.Canonical.make({
          authority: CitationAuthorityIdentityInput.make({
            citation: mention.citation,
            mentionId: mention.id,
            selectedEdition: edition,
          }),
        }),
        truthy: true,
        value: { kind: "default", mentionId: mention.id },
      });
    }),
    shortCase: Effect.fn("Citation.defaultShortCallback")(
      function* (input: CitationFullsCallbackInput) {
        if (input.mention.citation.type !== "shortFormCase") return yield* invalid();
        const citation = input.mention.citation;
        const current = yield* reporter(citation);
        let candidates = A.empty<CitationCallbackFull>();
        for (const entry of input.fulls) {
          yield* work.step;
          const prior = (yield* mentionOf(entry.mentionId)).citation;
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
        return { resource: yield* choose(candidates), fulls: input.fulls };
      },
      Effect.provideService(Crypto.Crypto, crypto)
    ),
    supra: Effect.fn("Citation.defaultSupraCallback")(
      function* (input: CitationFullsCallbackInput) {
        if (input.mention.citation.type !== "supra") return yield* invalid();
        const guess = input.mention.citation.metadata.antecedentGuess;
        const candidates = O.exists(guess, Str.isNonEmpty)
          ? yield* byParty(
              input.fulls,
              O.getOrElse(guess, () => "")
            )
          : [];
        return { resource: yield* choose(candidates), fulls: input.fulls };
      },
      Effect.provideService(Crypto.Crypto, crypto)
    ),
    reference: Effect.fn("Citation.defaultReferenceCallback")(
      function* (input: CitationFullsCallbackInput) {
        if (input.mention.citation.type !== "reference") return yield* invalid();
        const names = A.filter(
          A.getSomes(
            R.values(
              Struct.pick(input.mention.citation.metadata, ["plaintiff", "defendant", "shortCaseName", "caseName"])
            )
          ),
          Str.isNonEmpty
        );
        let candidates = A.empty<CitationCallbackFull>();
        if (A.length(names) > 0)
          for (const entry of input.fulls) {
            yield* work.step;
            const prior = (yield* mentionOf(entry.mentionId)).citation;
            if (!isFull(prior)) return yield* invalid();
            const values = yield* metadataValues(prior);
            if (A.some(names, (name) => A.contains(values, name))) candidates = A.append(candidates, entry);
          }
        return { resource: yield* choose(candidates), fulls: input.fulls };
      },
      Effect.provideService(Crypto.Crypto, crypto)
    ),
    id: Effect.fn("Citation.defaultIdCallback")(
      function* (input: CitationIdCallbackInput) {
        if (input.mention.citation.type !== "id") return yield* invalid();
        if (input.last._tag === "None" || !input.last.truthy) return { resource: none(), groups: input.groups };
        const id = yield* key(input.last);
        for (const group of input.groups) {
          yield* work.step;
          if ((yield* key(group.resource)) !== id) continue;
          const first = yield* Effect.fromOption(A.head(group.members), invalid);
          const prior = yield* mentionOf(first);
          const bad = yield* hasInvalidCitationPinCite({
            fullCitation: prior.citation,
            idCitation: input.mention.citation,
          }).pipe(Effect.mapError(() => CitationCallbackFailure.make({ reason: "callback-failed" })));
          return { resource: bad ? none() : input.last, groups: input.groups };
        }
        return yield* invalid();
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
  const callbacks = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
    Effect.provideService(CitationResolutionWork, work)
  );
  return yield* runPreparedCitationCallbackSession(prepared).pipe(
    Effect.provideService(CitationResolutionCallbacks, callbacks),
    Effect.provideService(CitationResolutionWork, work)
  );
});
