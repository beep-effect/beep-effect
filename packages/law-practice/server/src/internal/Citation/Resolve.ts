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
  CitationMention,
  CitationMentionReceipt,
  CitationResolved,
  CitationUnresolved,
  FullCitation,
} from "@beep/law-practice-domain/values";
import { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Chunk from "effect/Chunk";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import { CitationAuthorityEdition, makeCitationAuthorityId } from "./AuthorityIdentity.ts";
import { captureCitationMentionReceiptData, restoreCitationMentionAgainstVerifiedSource } from "./Mention.ts";
import { hasInvalidCitationPinCite, stripCitationAntecedentPunctuation } from "./ResolverText.ts";
import type { CitationResolution } from "@beep/law-practice-domain/values";
import type * as Crypto from "effect/Crypto";

const $I = $LawPracticeServerId.create("internal/Citation/Resolve");
const SourceProof: S.Codec<VerifiedSourceText> = VerifiedSourceText;
const Input = S.Struct({
  verifiedSource: SourceProof,
  engineArtifact: Sha256Hex,
  mentions: S.Array(CitationMention),
  editions: S.Array(CitationAuthorityEdition),
  limits: CitationEngineLimits,
}).pipe(
  $I.annoteSchema("Input", {
    description:
      "Genuine canonical source capability, verified ordered mentions, trusted edition data and explicit decoded limits.",
  })
);
const Snapshot = S.Struct({
  source: SourceTextIdentity,
  engineArtifact: Sha256Hex,
  mentions: S.Array(CitationMentionReceipt),
  editions: S.Array(CitationAuthorityEdition),
  limits: CitationEngineLimits,
}).pipe(
  $I.annoteSchema("Snapshot", {
    description:
      "Structural legal/assertion data copied before asynchronous verification; source proof remains a separate capability.",
  })
);
const SnapshotJson = S.fromJsonString(Snapshot);
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
): Effect.fn.Return<CitationDocument, CitationResolveFailure, Crypto.Crypto> {
  const decoded = yield* S.decodeUnknownEffect(S.toType(Input))(input).pipe(Effect.mapError(invalid));
  const verifiedSource = decoded.verifiedSource;
  const json = yield* S.encodeEffect(SnapshotJson)({
    source: verifiedSource.source,
    engineArtifact: decoded.engineArtifact,
    mentions: A.map(decoded.mentions, captureCitationMentionReceiptData),
    editions: decoded.editions,
    limits: decoded.limits,
  }).pipe(Effect.mapError(invalid));
  const snapshot = yield* S.decodeEffect(SnapshotJson)(json).pipe(Effect.mapError(invalid));
  const limits = snapshot.limits;
  const editions = HashMap.fromIterable(A.map(snapshot.editions, (edition) => Tuple.make(edition.edition, edition)));
  if (HashMap.size(editions) !== A.length(snapshot.editions)) return yield* invalid();
  if (A.length(snapshot.mentions) > limits.mentions || Str.length(verifiedSource.sourceText) > limits.sourceUtf16)
    return yield* exceeded();
  const mentions = yield* Effect.forEach(
    snapshot.mentions,
    (mention) =>
      restoreCitationMentionAgainstVerifiedSource(mention, verifiedSource, snapshot.engineArtifact).pipe(
        Effect.mapError(() => CitationResolveFailure.make({ reason: "evidence-failed" }))
      ),
    { concurrency: 1 }
  );
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
  for (const mention of mentions) {
    yield* step;
    const citation = mention.citation;
    let resolution: CitationResolution;
    if (isFull(citation)) {
      const selectedEdition = O.flatMap(citation.publication.selectedEdition, (id) => HashMap.get(editions, id));
      if (O.isSome(citation.publication.selectedEdition) && O.isNone(selectedEdition))
        return yield* CitationResolveFailure.make({ reason: "edition-missing" });
      const id = yield* makeCitationAuthorityId({ citation, mentionId: mention.id, selectedEdition }).pipe(
        Effect.mapError(() => CitationResolveFailure.make({ reason: "identity-failed" }))
      );
      if (!HashMap.has(representatives, id)) {
        if (Chunk.size(authorities) >= limits.authorities) return yield* exceeded();
        representatives = HashMap.set(representatives, id, citation);
        authorities = Chunk.append(authorities, CitationAuthority.make({ id, fullMentionId: mention.id }));
      }
      const wire = yield* S.encodeEffect(FullCitation)(citation).pipe(Effect.mapError(invalid));
      const metadata = yield* S.decodeEffect(S.Record(S.String, S.Unknown))(wire.metadata).pipe(
        Effect.mapError(invalid)
      );
      let values = A.filter(R.values(metadata), S.is(S.NonEmptyString));
      if (citation.type === "case" && O.isSome(citation.metadata.court)) {
        const court = citation.metadata.court.value;
        const value = court.status === "known" ? court.id : court.value;
        if (Str.isNonEmpty(value)) values = A.append(values, value);
      }
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
      resolution = CitationResolved.make({ mentionId: mention.id, authorityId: id, confidence: O.none() });
    } else if (citation.type === "id") {
      if (O.isNone(last))
        resolution = CitationUnresolved.make({ mentionId: mention.id, reason: "no-previous-authority" });
      else {
        const full = yield* Effect.fromOption(HashMap.get(representatives, last.value), invalid);
        const invalidPin = yield* hasInvalidCitationPinCite({ fullCitation: full, idCitation: citation }).pipe(
          Effect.mapError(() => CitationResolveFailure.make({ reason: "text-failed" }))
        );
        if (invalidPin) resolution = CitationUnresolved.make({ mentionId: mention.id, reason: "invalid-pin-cite" });
        else {
          if (edges >= limits.resolutionEdges) return yield* exceeded();
          edges += 1;
          resolution = CitationResolved.make({ mentionId: mention.id, authorityId: last.value, confidence: O.none() });
        }
      }
    } else if (citation.type === "unknown")
      resolution = CitationUnresolved.make({ mentionId: mention.id, reason: "unsupported-citation" });
    else {
      let candidates = Chunk.empty<typeof Entry.Type>();
      let missingAntecedent = false;
      if (citation.type === "shortFormCase") {
        const groups = yield* S.encodeEffect(CitationComponents)(citation.components).pipe(Effect.mapError(invalid));
        const selectedEdition = O.flatMap(citation.publication.selectedEdition, (id) => HashMap.get(editions, id));
        if (O.isSome(citation.publication.selectedEdition) && O.isNone(selectedEdition))
          return yield* CitationResolveFailure.make({ reason: "edition-missing" });
        const reporter = O.isSome(selectedEdition)
          ? selectedEdition.value.shortName
          : O.getOrElse(R.get(groups, "reporter"), () => null);
        const volume = O.getOrElse(R.get(groups, "volume"), () => null);
        for (const entry of fulls) {
          yield* step;
          if (entry.citation.type === "case") {
            if ((!O.isSome(selectedEdition) && O.isNone(R.get(groups, "reporter"))) || !entry.reporterDefined)
              return yield* invalid();
            if (entry.reporter === reporter && entry.volume === volume) candidates = Chunk.append(candidates, entry);
          }
        }
        if (
          candidates.pipe(A.fromIterable, idsOf, A.length) !== 1 &&
          O.exists(citation.metadata.antecedentGuess, Str.isNonEmpty)
        ) {
          const guess = stripCitationAntecedentPunctuation(O.getOrElse(citation.metadata.antecedentGuess, () => ""));
          const unrefined = candidates;
          candidates = Chunk.empty();
          for (const entry of unrefined) {
            yield* step;
            if (matchesParty(entry, guess)) candidates = Chunk.append(candidates, entry);
          }
        }
      } else if (citation.type === "supra") {
        if (O.exists(citation.metadata.antecedentGuess, Str.isNonEmpty)) {
          const guess = stripCitationAntecedentPunctuation(O.getOrElse(citation.metadata.antecedentGuess, () => ""));
          for (const entry of fulls) {
            yield* step;
            if (matchesParty(entry, guess)) candidates = Chunk.append(candidates, entry);
          }
        } else missingAntecedent = true;
      } else {
        const names = A.filter(
          A.getSomes(R.values(Struct.pick(citation.metadata, ["plaintiff", "defendant", "shortCaseName", "caseName"]))),
          Str.isNonEmpty
        );
        if (A.length(names) === 0) missingAntecedent = true;
        else
          for (const entry of fulls) {
            yield* step;
            if (A.some(names, (name) => A.contains(entry.metadataValues, name)))
              candidates = Chunk.append(candidates, entry);
          }
      }
      resolution = yield* select(A.fromIterable(candidates), mention);
      if (resolution.status === "Unresolved" && missingAntecedent)
        resolution = CitationUnresolved.make({ mentionId: mention.id, reason: "missing-antecedent" });
    }
    last = resolution.status === "Resolved" ? O.some(resolution.authorityId) : O.none();
    resolutions = Chunk.append(resolutions, resolution);
  }
  return yield* S.decodeUnknownEffect(S.toType(CitationDocument))({
    source: snapshot.source,
    engineArtifact: snapshot.engineArtifact,
    mentions,
    authorities: A.fromIterable(authorities),
    resolutions: A.fromIterable(resolutions),
  }).pipe(Effect.mapError(invalid));
});
