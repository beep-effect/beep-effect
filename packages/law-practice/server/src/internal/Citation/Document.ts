/**
 * Whole-document structural persistence and canonical-source restoration.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationDocument, CitationDocumentReceipt, FullCitation } from "@beep/law-practice-domain/values";
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
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { CitationAuthorityEdition, makeCitationAuthorityId } from "./AuthorityIdentity.ts";
import { restoreCitationMentionAgainstVerifiedSource } from "./Mention.ts";
import { makeCitationMentionId } from "./MentionIdentity.ts";
import { CitationResourceBinding, makeCitationResourceAuthorityId } from "./ResourceIdentity.ts";
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
        A.reduce(bindings, 0, (total, binding) => total + A.length(binding.members)) <=
        CitationEngineAbsoluteMaxima.mentions,
      $I.annote("TotalResourceBindingMembers", {
        title: "Total Resource Binding Members",
        description: "The total number of adapter-bound occurrence references cannot exceed the hard mention ceiling.",
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
  receipt: CitationDocumentReceipt,
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
  // Out-of-band bindings are trusted adapter expectations, never receipt data.
  // Each binding must cover exactly one group's members; it may override a full
  // member's default key only when that occurrence is explicitly bound.
  let custom = HashMap.empty<
    CitationDocumentReceipt["authorities"][number]["id"],
    HashSet.HashSet<CitationDocumentReceipt["mentions"][number]["id"]>
  >();
  for (const binding of snapshot.resourceBindings) {
    const id = yield* makeCitationResourceAuthorityId(binding.identity).pipe(Effect.mapError(identityFailure));
    if (HashMap.has(custom, id)) return yield* invalid();
    const members = HashSet.fromIterable(binding.members);
    for (const member of binding.members) {
      const resolution = HashMap.get(resolutions, member);
      if (O.isNone(resolution) || resolution.value.status !== "Resolved" || resolution.value.authorityId !== id)
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
      schemaVersion: "citation-document-receipt/v1",
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
  return snapshot.receipt;
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
