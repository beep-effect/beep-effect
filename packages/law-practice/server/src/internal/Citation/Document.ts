/**
 * Whole-document structural persistence and canonical-source restoration.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationDocument,
  CitationDocumentReceipt,
  CitationGroupMember,
  CitationMemberList,
  CitationMemberListId,
  CitationResourceGroupId,
  FullCitation,
} from "@beep/law-practice-domain/values";
import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import {
  toTextAnchorVerificationReceipt,
  VerifySourceTextIdentityInput,
  verifySourceTextIdentity,
} from "@beep/provenance/VerifiedTextAnchor";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { CitationAuthorityEdition, makeCitationAuthorityId } from "./AuthorityIdentity.ts";
import { restoreCitationMentionAgainstVerifiedSource } from "./Mention.ts";
import { makeCitationMentionId } from "./MentionIdentity.ts";
import { CitationResourceBinding, makeCitationResourceAuthorityId } from "./ResourceIdentity.ts";
import type { CitationAuthorityId, CitationResourceGroup } from "@beep/law-practice-domain/values";
import type * as Crypto from "effect/Crypto";

const $I = $LawPracticeServerId.create("internal/Citation/Document");
const FailureReason = LiteralKit([
  "invalid-input",
  "unverifiable-evidence",
  "stale-engine",
  "stale-mention",
  "stale-authority",
  "identity-failed",
  "authority-key-unavailable",
]).pipe(
  $I.annoteSchema("FailureReason", {
    description: "Finite private document persistence failures without source text or nested causes.",
  })
);
/**
 * Private sanitized error for later mapping into the closed engine boundary.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationDocumentFailure extends S.TaggedError<CitationDocumentFailure, { readonly brand: unique symbol }>(
  $I`CitationDocumentFailure`
)(
  "CitationDocumentFailure",
  { reason: FailureReason },
  $I.annoteError<CitationDocumentFailure>("CitationDocumentFailure", {
    description: "Document persistence failed without retaining raw input, schema issues or adapter causes.",
  })
) {}
const invalid = () => CitationDocumentFailure.make({ reason: "invalid-input" });
const identityFailure = () => CitationDocumentFailure.make({ reason: "identity-failed" });
const Editions = S.Array(CitationAuthorityEdition).check(
  S.makeFilter(
    (entries) =>
      HashMap.size(HashMap.fromIterable(A.map(entries, (entry) => Tuple.make(entry.edition, entry)))) ===
      A.length(entries),
    $I.annote("UniqueEditionDescriptors", {
      description: "The trusted artifact adapter supplies at most one spelling per edition reference.",
      message: "Duplicate edition descriptor.",
    })
  )
);
const ResourceBindings = S.Array(CitationResourceBinding)
  .check(
    S.isMaxLength(CitationEngineAbsoluteMaxima.authorities),
    S.makeFilter(
      (bindings) =>
        A.reduce(
          bindings,
          0,
          (total, binding) =>
            total +
            A.length(binding.decisions) +
            A.length(O.getOrElse(O.fromUndefinedOr(binding.candidates), A.empty)) +
            A.reduce(binding.groups, 0, (count, group) => count + A.length(group.list.members))
        ) <= CitationEngineAbsoluteMaxima.resolutionEdges &&
        A.reduce(bindings, 0, (count, binding) => count + A.length(binding.groups)) <=
          CitationEngineAbsoluteMaxima.authorities,
      $I.annote("TotalResourceBindingMembers", {
        title: "Total Resource Binding Members",
        description:
          "Adapter-bound chosen/candidate decisions and group references share the hard resolution edge ceiling.",
        message: "Too many resource binding members.",
      })
    )
  )
  .pipe(
    $I.annoteSchema("ResourceBindings", {
      description: "Bounded expected resource identities supplied by a trusted adapter, separately from the document.",
    })
  );
const Snapshot = S.Struct({
  receipt: CitationDocumentReceipt.check(
    S.makeFilter(
      (receipt) =>
        A.length(receipt.mentions) + A.length(receipt.detachedCitations) <= CitationEngineAbsoluteMaxima.mentions &&
        A.length(receipt.authorities) <= CitationEngineAbsoluteMaxima.authorities &&
        A.length(receipt.memberLists) <= CitationEngineAbsoluteMaxima.authorities &&
        A.length(receipt.groups) <= CitationEngineAbsoluteMaxima.authorities &&
        A.reduce(receipt.memberLists, 0, (total, list) => total + A.length(list.members)) +
          A.reduce(
            receipt.resolutions,
            0,
            (total, resolution) =>
              total + (resolution.status === "Ambiguous" ? A.length(resolution.candidateAuthorityIds) : 0)
          ) <=
          CitationEngineAbsoluteMaxima.resolutionEdges,
      $I.annote("DocumentGraphCeilings", {
        title: "Document Graph Ceilings",
        description:
          "All occurrence/object nodes, catalog/list nodes, ordered memberships and candidate edges fit hard engine maxima.",
        message: "Document graph exceeds hard limits.",
      })
    )
  ),
  editions: Editions,
  resourceBindings: ResourceBindings,
}).pipe(
  $I.annoteSchema("Snapshot", {
    description: "Structural document and trusted edition descriptors copied before asynchronous identity work.",
  })
);
const SnapshotJson = S.fromJsonString(Snapshot);
const DefaultBindings = S.toType(ResourceBindings).pipe(
  S.withDecodingDefaultKey(Effect.succeed(A.empty<CitationResourceBinding>()))
);
const ProjectInput = S.Struct({
  document: S.toType(CitationDocument),
  editions: S.toType(Editions),
  resourceBindings: DefaultBindings,
});
const RestoreInput = S.Struct({
  ...Snapshot.fields,
  expectedSource: SourceTextIdentity,
  expectedEngineArtifact: Sha256Hex,
  sourceText: S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.sourceUtf16)),
});
const RestoreJson = S.fromJsonString(RestoreInput);
const RestoreBoundary = S.Struct({
  receipt: S.toType(CitationDocumentReceipt),
  editions: S.toType(Editions),
  expectedSource: S.toType(SourceTextIdentity),
  expectedEngineArtifact: Sha256Hex,
  sourceText: RestoreInput.fields.sourceText,
  resourceBindings: DefaultBindings,
});
const isFull = S.is(FullCitation);

const verifyAuthorities = Effect.fn("Citation.verifyDocumentAuthorities")(function* (snapshot: typeof Snapshot.Type) {
  const editions = HashMap.fromIterable(A.map(snapshot.editions, (entry) => Tuple.make(entry.edition, entry)));
  const resolutions = HashMap.fromIterable(
    A.map(snapshot.receipt.resolutions, (resolution) => Tuple.make(resolution.mentionId, resolution))
  );
  const groupsByAuthority = A.groupBy(snapshot.receipt.groups, (group) => group.authorityId);
  const groupsFor = (id: CitationAuthorityId) =>
    O.getOrElse(R.get(groupsByAuthority, id), A.empty<CitationResourceGroup>);
  const listById = HashMap.fromIterable(A.map(snapshot.receipt.memberLists, (list) => Tuple.make(list.id, list)));
  const listEquivalent = S.toEquivalence(CitationMemberList);
  const memberEquivalent = S.toEquivalence(S.Array(CitationGroupMember));
  const candidatesByAuthority = A.groupBy(
    A.flatMap(snapshot.receipt.resolutions, (resolution) =>
      resolution.status === "Ambiguous"
        ? A.map(resolution.candidateAuthorityIds, (authorityId) => ({ authorityId, mentionId: resolution.mentionId }))
        : []
    ),
    (candidate) => candidate.authorityId
  );
  // Out-of-band bindings are trusted adapter expectations, never receipt data.
  // Each binding fixes decision ownership separately from optional group/list
  // data. Only explicitly bound decisions may override a full default key.
  let custom = HashMap.empty<
    CitationDocumentReceipt["authorities"][number]["id"],
    HashSet.HashSet<CitationDocumentReceipt["mentions"][number]["id"]>
  >();
  for (const binding of snapshot.resourceBindings) {
    const id = yield* makeCitationResourceAuthorityId(binding.identity).pipe(Effect.mapError(identityFailure));
    if (HashMap.has(custom, id)) return yield* invalid();
    if (!A.some(snapshot.receipt.authorities, (authority) => authority.id === id))
      return yield* CitationDocumentFailure.make({ reason: "stale-authority" });
    const members = HashSet.fromIterable(binding.decisions);
    for (const member of binding.decisions) {
      const resolution = HashMap.get(resolutions, member);
      if (O.isNone(resolution) || resolution.value.status !== "Resolved" || resolution.value.authorityId !== id)
        return yield* CitationDocumentFailure.make({ reason: "stale-authority" });
    }
    const expectedCandidates = O.getOrElse(O.fromUndefinedOr(binding.candidates), A.empty);
    const actualCandidates = O.getOrElse(R.get(candidatesByAuthority, id), A.empty);
    if (A.length(expectedCandidates) !== A.length(actualCandidates))
      return yield* CitationDocumentFailure.make({ reason: "stale-authority" });
    for (const candidate of expectedCandidates) {
      const resolution = HashMap.get(resolutions, candidate.mentionId);
      if (
        O.isNone(resolution) ||
        resolution.value.status !== "Ambiguous" ||
        O.getOrElse(A.get(resolution.value.candidateAuthorityIds, candidate.position), () => "") !== id
      )
        return yield* CitationDocumentFailure.make({ reason: "stale-authority" });
    }
    const actual = groupsFor(id);
    if (
      A.length(actual) !== A.length(binding.groups) ||
      HashSet.size(HashSet.fromIterable(A.map(binding.groups, (group) => group.id))) !== A.length(binding.groups)
    )
      return yield* CitationDocumentFailure.make({ reason: "stale-authority" });
    for (const expected of binding.groups) {
      const group = A.get(snapshot.receipt.groups, expected.position);
      const list = O.flatMap(group, (value) => HashMap.get(listById, value.memberListId));
      if (
        O.isNone(group) ||
        group.value.id !== expected.id ||
        group.value.authorityId !== id ||
        O.isNone(list) ||
        !listEquivalent(list.value, expected.list)
      )
        return yield* CitationDocumentFailure.make({ reason: "stale-authority" });
    }
    custom = HashMap.set(custom, id, members);
  }
  let verified = custom.pipe(HashMap.keys, HashSet.fromIterable);
  yield* Effect.forEach(
    snapshot.receipt.mentions,
    (mention) =>
      Effect.gen(function* () {
        const citation = mention.citation;
        const resolution = HashMap.get(resolutions, mention.id);
        if (O.isNone(resolution) || resolution.value.status !== "Resolved") return;
        const binding = HashMap.get(custom, resolution.value.authorityId);
        if (O.isSome(binding)) {
          if (!HashSet.has(binding.value, mention.id))
            return yield* CitationDocumentFailure.make({ reason: "stale-authority" });
          return;
        }
        if (!isFull(citation)) return;
        const selectedEdition = O.flatMap(citation.publication.selectedEdition, (id) => HashMap.get(editions, id));
        const expected = yield* makeCitationAuthorityId({ citation, mentionId: mention.id, selectedEdition }).pipe(
          Effect.mapError(identityFailure)
        );
        if (expected !== resolution.value.authorityId)
          return yield* CitationDocumentFailure.make({ reason: "stale-authority" });
        verified = HashSet.add(verified, expected);
      }),
    { concurrency: 1, discard: true }
  );
  if (!A.every(snapshot.receipt.authorities, (authority) => HashSet.has(verified, authority.id)))
    return yield* CitationDocumentFailure.make({ reason: "authority-key-unavailable" });
  // Unbound default groups must exactly reflect decisions in occurrence order.
  // A callback-produced order, multiplicity, empty group or alias requires a binding.
  for (const authority of snapshot.receipt.authorities) {
    if (HashMap.has(custom, authority.id)) continue;
    const expected = A.map(
      A.filter(snapshot.receipt.mentions, (mention) =>
        O.exists(
          HashMap.get(resolutions, mention.id),
          (resolution) => resolution.status === "Resolved" && resolution.authorityId === authority.id
        )
      ),
      (mention) => CitationGroupMember.cases.Mention.make({ mentionId: mention.id })
    );
    const actual = groupsFor(authority.id);
    const group = A.head(actual);
    const list = O.flatMap(group, (value) => HashMap.get(listById, value.memberListId));
    const expectedListId = CitationMemberListId.make(`cl1:${Str.slice(4)(authority.id)}`);
    const expectedGroupId = CitationResourceGroupId.make(`cg1:${Str.slice(4)(authority.id)}`);
    if (
      A.length(actual) > 1 ||
      (O.isSome(group) && group.value.id !== expectedGroupId) ||
      (A.isArrayEmpty(expected)
        ? O.isSome(group)
        : O.isNone(list) || list.value.id !== expectedListId || !memberEquivalent(list.value.members, expected))
    )
      return yield* CitationDocumentFailure.make({ reason: "stale-authority" });
  }
  // Every persisted list must be attached to a verified or bound group.
  if (
    !A.every(snapshot.receipt.memberLists, (list) =>
      A.some(snapshot.receipt.groups, (group) => group.memberListId === list.id)
    )
  )
    return yield* invalid();
});

/**
 * Project a runtime document only after checking every occurrence and resolved
 * full authority key unless a trusted binding supplies its resource identity.
 * Snapshot all structural data before the first hash.
 * Custom groups require exact out-of-band bindings from the trusted adapter.
 * Trusted edition descriptors still need live artifact authentication.
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const projectCitationDocumentReceipt = Effect.fn("Citation.projectDocumentReceipt")(function* (
  input: unknown
): Effect.fn.Return<CitationDocumentReceipt, CitationDocumentFailure, Crypto.Crypto> {
  const decoded = yield* S.decodeUnknownEffect(ProjectInput)(input).pipe(Effect.mapError(invalid));
  const anchors = A.map(decoded.document.mentions, (mention) => mention.anchor);
  const data = {
    editions: decoded.editions,
    resourceBindings: decoded.resourceBindings,
    receipt: {
      ...decoded.document,
      schemaVersion: "citation-document-receipt/v3",
      mentions: A.map(decoded.document.mentions, (mention) => ({
        ...mention,
        schemaVersion: "citation-mention-receipt/v1",
        anchor: toTextAnchorVerificationReceipt(mention.anchor),
        components: A.map(mention.components, (component) => ({
          name: component.name,
          anchor: toTextAnchorVerificationReceipt(component.anchor),
        })),
        footnote: O.map(mention.footnote, (zone) => ({
          label: zone.label,
          anchor: toTextAnchorVerificationReceipt(zone.anchor),
        })),
      })),
    },
  };
  const parsed = yield* S.decodeUnknownEffect(S.toType(Snapshot))(data).pipe(Effect.mapError(invalid));
  const json = yield* S.encodeEffect(SnapshotJson)(parsed).pipe(Effect.mapError(invalid));
  const snapshot = yield* S.decodeEffect(SnapshotJson)(json).pipe(Effect.mapError(invalid));
  yield* Effect.forEach(
    A.zip(snapshot.receipt.mentions, anchors),
    ([mention, anchor]) =>
      Effect.gen(function* () {
        const expected = yield* makeCitationMentionId({
          anchor,
          engineArtifact: mention.engineArtifact,
          semanticKind: mention.citation.type,
        }).pipe(Effect.mapError(identityFailure));
        if (expected !== mention.id) return yield* CitationDocumentFailure.make({ reason: "stale-mention" });
      }),
    { concurrency: 1, discard: true }
  );
  yield* verifyAuthorities(snapshot);
  return CitationDocumentReceipt.make(snapshot.receipt);
});

/**
 * Restore a receipt against trusted source/engine identity, hashing its raw
 * source once for every mention/component/zone. Recompute all occurrence IDs
 * and unbound full authority keys before returning a coherent runtime value.
 * Custom groups require exact out-of-band bindings from the trusted adapter.
 * These checks do not authenticate semantic classification or short resolution.
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const restoreCitationDocument = Effect.fn("Citation.restoreDocument")(function* (
  input: unknown
): Effect.fn.Return<CitationDocument, CitationDocumentFailure, Crypto.Crypto> {
  const decoded = yield* S.decodeUnknownEffect(RestoreBoundary)(input).pipe(Effect.mapError(invalid));
  const json = yield* S.encodeEffect(RestoreJson)(decoded).pipe(Effect.mapError(invalid));
  const snapshot = yield* S.decodeEffect(RestoreJson)(json).pipe(Effect.mapError(invalid));
  const receipt = snapshot.receipt;
  if (receipt.engineArtifact !== snapshot.expectedEngineArtifact)
    return yield* CitationDocumentFailure.make({ reason: "stale-engine" });
  const source = yield* verifySourceTextIdentity(
    VerifySourceTextIdentityInput.make({
      expectedSource: snapshot.expectedSource,
      source: receipt.source,
      sourceText: snapshot.sourceText,
    })
  ).pipe(Effect.mapError(() => CitationDocumentFailure.make({ reason: "unverifiable-evidence" })));
  const mentions = yield* Effect.forEach(
    receipt.mentions,
    (mention) =>
      restoreCitationMentionAgainstVerifiedSource(mention, source, snapshot.expectedEngineArtifact).pipe(
        Effect.mapError((error) =>
          CitationDocumentFailure.make({ reason: error.reason === "stale-identity" ? "stale-mention" : error.reason })
        )
      ),
    { concurrency: 1 }
  );
  yield* verifyAuthorities(snapshot);
  return yield* S.decodeUnknownEffect(S.toType(CitationDocument))({ ...receipt, mentions }).pipe(
    Effect.mapError(invalid)
  );
});
