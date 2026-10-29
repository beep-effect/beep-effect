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
const Snapshot = S.Struct({ receipt: CitationDocumentReceipt, editions: Editions }).pipe(
  $I.annoteSchema("Snapshot", {
    description: "Structural document and trusted edition descriptors copied before asynchronous identity work.",
  })
);
const SnapshotJson = S.fromJsonString(Snapshot);
const ProjectInput = S.Struct({ document: CitationDocument, editions: Editions });
const RestoreInput = S.Struct({
  ...Snapshot.fields,
  expectedSource: SourceTextIdentity,
  expectedEngineArtifact: Sha256Hex,
  sourceText: S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.sourceUtf16)),
});
const RestoreJson = S.fromJsonString(RestoreInput);
const isFull = S.is(FullCitation);

const verifyAuthorities = Effect.fn("Citation.verifyDocumentAuthorities")(function* (snapshot: typeof Snapshot.Type) {
  const editions = HashMap.fromIterable(A.map(snapshot.editions, (entry) => Tuple.make(entry.edition, entry)));
  const resolutions = HashMap.fromIterable(
    A.map(snapshot.receipt.resolutions, (resolution) => Tuple.make(resolution.mentionId, resolution))
  );
  // A representative need not be full. Require a checked key witness for
  // every group; the current adapter can establish only full-member keys.
  let verified = HashSet.empty<CitationDocumentReceipt["authorities"][number]["id"]>();
  yield* Effect.forEach(
    snapshot.receipt.mentions,
    (mention) =>
      Effect.gen(function* () {
        const citation = mention.citation;
        const resolution = HashMap.get(resolutions, mention.id);
        if (!isFull(citation) || O.isNone(resolution) || resolution.value.status !== "Resolved") return;
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
 * full authority key. Snapshot all structural data before the first hash.
 * Custom resource keys are rejected until their trusted adapter is available.
 * Trusted edition descriptors still need live artifact authentication.
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const projectCitationDocumentReceipt = Effect.fn("Citation.projectDocumentReceipt")(function* (
  input: unknown
): Effect.fn.Return<CitationDocumentReceipt, CitationDocumentFailure, Crypto.Crypto> {
  const decoded = yield* S.decodeUnknownEffect(S.toType(ProjectInput))(input).pipe(Effect.mapError(invalid));
  const anchors = A.map(decoded.document.mentions, (mention) => mention.anchor);
  const data = {
    editions: decoded.editions,
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
 * and resolved full authority keys before returning a coherent runtime value.
 * Custom resource keys are rejected until their trusted adapter is available.
 * These checks do not authenticate semantic classification or short resolution.
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const restoreCitationDocument = Effect.fn("Citation.restoreDocument")(function* (
  input: unknown
): Effect.fn.Return<CitationDocument, CitationDocumentFailure, Crypto.Crypto> {
  const decoded = yield* S.decodeUnknownEffect(S.toType(RestoreInput))(input).pipe(Effect.mapError(invalid));
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
