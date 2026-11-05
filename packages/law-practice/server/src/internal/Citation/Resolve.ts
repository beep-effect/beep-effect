/**
 * Default resolver adapted from eyecite 2.7.6 resolve.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationAmbiguous,
  CitationAuthority,
  CitationAuthorityId,
  CitationComponents,
  CitationDocument,
  CitationGroupMember,
  CitationMemberList,
  CitationMemberListId,
  CitationResolved,
  CitationResourceGroup,
  CitationResourceGroupId,
  CitationUnresolved,
  FullCitation,
} from "@beep/law-practice-domain/values";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Chunk from "effect/Chunk";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { makeCitationAuthorityId } from "./AuthorityIdentity.ts";
import { prepareCitationResolution } from "./ResolutionInput.ts";
import { hasInvalidCitationPinCite, stripCitationAntecedentPunctuation } from "./ResolverText.ts";
import type {
  CitationMention,
  CitationResolution,
  IdCitation,
  ReferenceCitation,
  ShortFormCaseCitation,
  SupraCitation,
} from "@beep/law-practice-domain/values";
import type * as Digest from "effect/crypto/Digest";

const CitationDocumentType = S.toType(CitationDocument);

import { citationMetadataValues, citationReferenceNames } from "./MetadataValues.ts";

const $I = $LawPracticeServerId.create("internal/Citation/Resolve");
const Entry = S.Struct({
  citation: FullCitation,
  authorityId: CitationAuthorityId,
  reporter: S.NullOr(S.String),
  reporterDefined: S.Boolean,
  volume: S.NullOr(S.String),
  metadataValues: S.Array(S.String),
}).pipe(
  $I.annoteSchema("Entry", {
    description:
      "Private prior-full-citation witness with resource identity and source-preserving lookup caches; not a public citation model.",
  })
);
const FailureReason = LiteralKit([
  "invalid-input",
  "evidence-failed",
  "identity-failed",
  "edition-missing",
  "text-failed",
  "limit-exceeded",
]).pipe(
  $I.annoteSchema("FailureReason", {
    description: "Finite private default resolution failures without source text or nested causes.",
  })
);
/**
 * Sanitized private resolver failure for later closed boundary mapping.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationResolveFailure extends S.TaggedError<CitationResolveFailure, { readonly brand: unique symbol }>(
  $I`CitationResolveFailure`
)(
  "CitationResolveFailure",
  { reason: FailureReason },
  $I.annoteError<CitationResolveFailure>("CitationResolveFailure", {
    description: "Default resolution failed without retaining caller data or nested causes.",
  })
) {}
const invalid = () => CitationResolveFailure.make({ reason: "invalid-input" });
const exceeded = () => CitationResolveFailure.make({ reason: "limit-exceeded" });
const isFull = S.is(FullCitation);
const idsOf = (entries: ReadonlyArray<typeof Entry.Type>) => A.dedupe(A.map(entries, (entry) => entry.authorityId));
const matchesParty = (entry: typeof Entry.Type, name: string): boolean =>
  entry.citation.type === "case" &&
  (O.exists(entry.citation.metadata.defendant, (value) => Str.isNonEmpty(value) && Str.includes(name)(value)) ||
    O.exists(entry.citation.metadata.plaintiff, (value) => Str.isNonEmpty(value) && Str.includes(name)(value)));

/**
 * Resolve a verified ordered mention sequence with the pinned default rules.
 * Source verification is supplied once by the caller. Semantic/assertion data
 * is snapshotted and every mention reverified before grouping. Custom resource
 * ports, full runtime deadlines/isolation and the final service are separate.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const resolveCitationMentions = Effect.fn("Citation.resolveMentions")(function* (
  input: unknown
): Effect.fn.Return<CitationDocument, CitationResolveFailure, Digest.Digest> {
  const snapshot = yield* prepareCitationResolution(input).pipe(
    Effect.mapError((error) => CitationResolveFailure.make({ reason: error.reason }))
  );
  const limits = snapshot.limits;
  const mentions = snapshot.mentions;
  const editions = HashMap.fromIterable(A.map(snapshot.editions, (edition) => Tuple.make(edition.edition, edition)));
  let fulls = Chunk.empty<typeof Entry.Type>();
  let authorities = Chunk.empty<CitationAuthority>();
  let resolutions = Chunk.empty<CitationResolution>();
  let representatives = HashMap.empty<CitationAuthorityId, FullCitation>();
  let last: O.Option<CitationAuthorityId> = O.none();
  let iterations = 0;
  let edges = 0;
  const step = Effect.suspend(() => {
    if (iterations >= limits.resolutionIterations) return Effect.fail(exceeded());
    iterations += 1;
    return Effect.void;
  });
  const select = Effect.fn("Citation.selectResolutionCandidates")(function* (
    candidates: ReadonlyArray<typeof Entry.Type>,
    mention: CitationMention
  ) {
    if (edges + A.length(candidates) > limits.resolutionEdges) return yield* exceeded();
    edges += A.length(candidates);
    const ids = idsOf(candidates);
    if (A.length(ids) === 1)
      return CitationResolved.make({ mentionId: mention.id, authorityId: A.getUnsafe(ids, 0), confidence: O.none() });
    if (A.length(ids) > 1)
      return CitationAmbiguous.make({ mentionId: mention.id, candidateAuthorityIds: ids, confidence: O.none() });
    return CitationUnresolved.make({ mentionId: mention.id, reason: "no-matching-authority" });
  });
  const selectedEditionOf = Effect.fnUntraced(function* (citation: FullCitation | ShortFormCaseCitation) {
    const selectedEdition = O.flatMap(citation.publication.selectedEdition, (id) => HashMap.get(editions, id));
    if (O.isSome(citation.publication.selectedEdition) && O.isNone(selectedEdition))
      return yield* CitationResolveFailure.make({ reason: "edition-missing" });
    return selectedEdition;
  });
  const resolveFull = Effect.fn("Citation.resolveFullMention")(function* (
    mention: CitationMention,
    citation: FullCitation
  ) {
    const selectedEdition = yield* selectedEditionOf(citation);
    const id = yield* makeCitationAuthorityId({ citation, mentionId: mention.id, selectedEdition }).pipe(
      Effect.mapError(() => CitationResolveFailure.make({ reason: "identity-failed" }))
    );
    if (!HashMap.has(representatives, id)) {
      if (Chunk.size(authorities) >= limits.authorities) return yield* exceeded();
      representatives = HashMap.set(representatives, id, citation);
      authorities = Chunk.append(
        authorities,
        CitationAuthority.make({
          id,
          representative: O.some(CitationGroupMember.cases.Mention.make({ mentionId: mention.id })),
        })
      );
    }
    const values = yield* citationMetadataValues(citation).pipe(Effect.mapError(invalid));
    const groups = yield* S.encodeEffect(CitationComponents)(citation.components).pipe(Effect.mapError(invalid));
    const reporter = O.isSome(selectedEdition)
      ? selectedEdition.value.shortName
      : O.getOrElse(R.get(groups, "reporter"), () => null);
    fulls = Chunk.append(
      fulls,
      Entry.make({
        citation,
        authorityId: id,
        reporter,
        reporterDefined: O.isSome(selectedEdition) || O.isSome(R.get(groups, "reporter")),
        volume: O.getOrElse(R.get(groups, "volume"), () => null),
        metadataValues: values,
      })
    );
    if (edges >= limits.resolutionEdges) return yield* exceeded();
    edges += 1;
    return CitationResolved.make({ mentionId: mention.id, authorityId: id, confidence: O.none() });
  });
  const resolveId = Effect.fn("Citation.resolveIdMention")(function* (mention: CitationMention, citation: IdCitation) {
    if (O.isNone(last)) return CitationUnresolved.make({ mentionId: mention.id, reason: "no-previous-authority" });
    const full = yield* Effect.fromOption(HashMap.get(representatives, last.value), invalid);
    const invalidPin = yield* hasInvalidCitationPinCite({ fullCitation: full, idCitation: citation }).pipe(
      Effect.mapError(() => CitationResolveFailure.make({ reason: "text-failed" }))
    );
    if (invalidPin) return CitationUnresolved.make({ mentionId: mention.id, reason: "invalid-pin-cite" });
    if (edges >= limits.resolutionEdges) return yield* exceeded();
    edges++;
    return CitationResolved.make({ mentionId: mention.id, authorityId: last.value, confidence: O.none() });
  });
  const partyCandidates = Effect.fn("Citation.partyCandidates")(function* (
    entries: Chunk.Chunk<typeof Entry.Type>,
    guess: string
  ) {
    let found = Chunk.empty<typeof Entry.Type>();
    for (const entry of entries) {
      yield* step;
      if (matchesParty(entry, guess)) found = Chunk.append(found, entry);
    }
    return found;
  });
  const matchesShortPublication = Effect.fn("Citation.matchesShortPublication")(function* (
    entry: typeof Entry.Type,
    reporter: string | null,
    volume: string | null,
    defined: boolean
  ) {
    if (entry.citation.type !== "case") return false;
    if (!defined || !entry.reporterDefined) return yield* invalid();
    return entry.reporter === reporter && entry.volume === volume;
  });
  const refineShortCandidates = Effect.fn("Citation.refineShortCandidates")(function* (
    candidates: Chunk.Chunk<typeof Entry.Type>,
    citation: ShortFormCaseCitation
  ) {
    if (
      candidates.pipe(A.fromIterable, idsOf, A.length) !== 1 &&
      O.exists(citation.metadata.antecedentGuess, Str.isNonEmpty)
    ) {
      const guess = stripCitationAntecedentPunctuation(O.getOrElse(citation.metadata.antecedentGuess, () => ""));
      return yield* partyCandidates(candidates, guess);
    }
    return candidates;
  });
  const resolveShort = Effect.fn("Citation.resolveShortMention")(function* (
    mention: CitationMention,
    citation: ShortFormCaseCitation
  ) {
    let candidates = Chunk.empty<typeof Entry.Type>();
    const groups = yield* S.encodeEffect(CitationComponents)(citation.components).pipe(Effect.mapError(invalid));
    const selectedEdition = yield* selectedEditionOf(citation);
    const reporter = O.isSome(selectedEdition)
      ? selectedEdition.value.shortName
      : O.getOrElse(R.get(groups, "reporter"), () => null);
    const volume = O.getOrElse(R.get(groups, "volume"), () => null);
    for (const entry of fulls) {
      yield* step;
      if (
        yield* matchesShortPublication(
          entry,
          reporter,
          volume,
          O.isSome(selectedEdition) || O.isSome(R.get(groups, "reporter"))
        )
      )
        candidates = Chunk.append(candidates, entry);
    }
    candidates = yield* refineShortCandidates(candidates, citation);
    return yield* select(A.fromIterable(candidates), mention);
  });
  const missingAntecedent = Effect.fn("Citation.missingResolutionAntecedent")(function* (mention: CitationMention) {
    const resolution = yield* select([], mention);
    return resolution.status === "Unresolved"
      ? CitationUnresolved.make({ mentionId: mention.id, reason: "missing-antecedent" })
      : resolution;
  });
  const resolveSupra = Effect.fn("Citation.resolveSupraMention")(function* (
    mention: CitationMention,
    citation: SupraCitation
  ) {
    if (!O.exists(citation.metadata.antecedentGuess, Str.isNonEmpty)) return yield* missingAntecedent(mention);
    const guess = stripCitationAntecedentPunctuation(O.getOrElse(citation.metadata.antecedentGuess, () => ""));
    const citationResult1 = yield* partyCandidates(fulls, guess);
    return yield* select(A.fromIterable(citationResult1), mention);
  });
  const resolveReference = Effect.fn("Citation.resolveReferenceMention")(function* (
    mention: CitationMention,
    citation: ReferenceCitation
  ) {
    const names = citationReferenceNames(citation.metadata);
    if (A.length(names) === 0) return yield* missingAntecedent(mention);
    let candidates = Chunk.empty<typeof Entry.Type>();
    for (const entry of fulls) {
      yield* step;
      if (A.some(names, (name) => A.contains(entry.metadataValues, name))) candidates = Chunk.append(candidates, entry);
    }
    return yield* select(A.fromIterable(candidates), mention);
  });
  const resolveOne = Effect.fn("Citation.resolveMentionKind")(function* (mention: CitationMention) {
    const citation = mention.citation;
    if (isFull(citation)) return yield* resolveFull(mention, citation);
    if (citation.type === "id") return yield* resolveId(mention, citation);
    if (citation.type === "unknown")
      return CitationUnresolved.make({ mentionId: mention.id, reason: "unsupported-citation" });
    if (citation.type === "shortFormCase") return yield* resolveShort(mention, citation);
    if (citation.type === "supra") return yield* resolveSupra(mention, citation);
    return yield* resolveReference(mention, citation);
  });
  for (const mention of mentions) {
    yield* step;
    const resolution = yield* resolveOne(mention);
    last = resolution.status === "Resolved" ? O.some(resolution.authorityId) : O.none();
    resolutions = Chunk.append(resolutions, resolution);
  }
  return yield* S.decodeUnknownEffect(CitationDocumentType)({
    source: snapshot.source,
    engineArtifact: snapshot.engineArtifact,
    mentions,
    authorities: A.fromIterable(authorities),
    resolutions: A.fromIterable(resolutions),
    detachedCitations: [],
    groups: A.map(A.fromIterable(authorities), (authority) =>
      CitationResourceGroup.make({
        id: CitationResourceGroupId.make(`cg1:${Str.slice(4)(authority.id)}`),
        authorityId: authority.id,
        memberListId: CitationMemberListId.make(`cl1:${Str.slice(4)(authority.id)}`),
      })
    ),
    memberLists: A.map(A.fromIterable(authorities), (authority) =>
      CitationMemberList.make({
        id: CitationMemberListId.make(`cl1:${Str.slice(4)(authority.id)}`),
        members: A.map(
          A.filter(
            A.fromIterable(resolutions),
            (resolution) => resolution.status === "Resolved" && resolution.authorityId === authority.id
          ),
          (resolution) => CitationGroupMember.cases.Mention.make({ mentionId: resolution.mentionId })
        ),
      })
    ),
  }).pipe(Effect.mapError(invalid));
});
