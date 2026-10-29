/**
 * Private verified mention production and canonical-source receipt restoration.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationComponentAnchor,
  CitationComponentReceipt,
  CitationFootnoteReceipt,
  CitationFootnoteZone,
  CitationMention,
  CitationMentionReceipt,
} from "@beep/law-practice-domain/values";
import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import {
  toTextAnchorVerificationReceipt,
  VerifySourceTextIdentityInput,
  VerifyTextAnchorAgainstVerifiedSourceInput,
  verifySourceTextIdentity,
  verifyTextAnchorAgainstVerifiedSource,
} from "@beep/provenance/VerifiedTextAnchor";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import { makeCitationMentionId } from "./MentionIdentity.ts";
import type { TextAnchorVerificationReceipt, VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import type * as Crypto from "effect/Crypto";

const $I = $LawPracticeServerId.create("internal/Citation/Mention");
const FailureReason = LiteralKit([
  "invalid-input",
  "unverifiable-evidence",
  "identity-failed",
  "stale-identity",
  "stale-engine",
]).pipe(
  $I.annoteSchema("FailureReason", {
    description: "Finite private mention-production/restore failure reasons, without raw input or nested causes.",
  })
);

/**
 * Sanitized private failure mapped into the future engine boundary error union.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationMentionFailure extends S.TaggedError<CitationMentionFailure, { readonly brand: unique symbol }>(
  $I`CitationMentionFailure`
)(
  "CitationMentionFailure",
  { reason: FailureReason },
  $I.annoteError<CitationMentionFailure>("CitationMentionFailure", {
    description:
      "Mention production/restoration failed without retaining source text, schema issues or adapter causes.",
  })
) {}
const invalid = () => CitationMentionFailure.make({ reason: "invalid-input" });
const evidenceFailure = () => CitationMentionFailure.make({ reason: "unverifiable-evidence" });
const identityFailure = () => CitationMentionFailure.make({ reason: "identity-failed" });

const CreateInput = S.Struct(Struct.omit(CitationMention.fields, ["id"])).pipe(
  $I.annoteSchema("CreateInput", {
    description: "Decoded semantic data and existing verified occurrence evidence; the producer assigns the ID.",
  })
);
const Metadata = S.Struct(
  Struct.omit(CitationMentionReceipt.fields, ["schemaVersion", "id", "anchor", "components", "footnote"])
).pipe(
  $I.annoteSchema("Metadata", {
    description: "Mutable semantic/assertion data snapshotted through its own codecs before asynchronous digest work.",
  })
);
const MetadataJson = S.fromJsonString(Metadata);
const RestoreInput = S.Struct({
  receipt: CitationMentionReceipt,
  expectedSource: SourceTextIdentity,
  expectedEngineArtifact: Sha256Hex,
  sourceText: S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.sourceUtf16)),
}).pipe(
  $I.annoteSchema("RestoreInput", {
    description: "Persisted mention, trusted expected source/engine identity and canonical raw text.",
  })
);
const RestoreJson = S.fromJsonString(RestoreInput);

const snapshotMetadata = Effect.fn("Citation.snapshotMentionMetadata")(function* (value: typeof Metadata.Type) {
  const json = yield* S.encodeEffect(MetadataJson)(value);
  return yield* S.decodeEffect(MetadataJson)(json);
}, Effect.mapError(invalid));

/**
 * Assign an occurrence ID to existing verified anchors and semantic data.
 * Input is decoded from self because opaque proofs cannot come from wire data.
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const makeCitationMention = Effect.fn("Citation.makeMention")(function* (
  input: unknown
): Effect.fn.Return<CitationMention, CitationMentionFailure, Crypto.Crypto> {
  const decoded = yield* S.decodeUnknownEffect(S.toType(CreateInput))(input).pipe(Effect.mapError(invalid));
  const metadata = yield* snapshotMetadata(decoded);
  const anchor = decoded.anchor;
  const components = A.map(decoded.components, (component) =>
    CitationComponentAnchor.make({ name: component.name, anchor: component.anchor })
  );
  const footnote = O.map(decoded.footnote, (zone) =>
    CitationFootnoteZone.make({ label: O.map(zone.label, (label) => label), anchor: zone.anchor })
  );
  const id = yield* makeCitationMentionId({
    anchor,
    engineArtifact: metadata.engineArtifact,
    semanticKind: metadata.citation.type,
  }).pipe(Effect.mapError(identityFailure));
  return yield* S.decodeUnknownEffect(S.toType(CitationMention))({
    ...metadata,
    id,
    anchor,
    components,
    footnote,
  }).pipe(Effect.mapError(invalid));
});

/**
 * Project verified mention data to a persistable structural receipt.
 * The projector checks the occurrence ID before persisting the snapshot.
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const projectCitationMentionReceipt = Effect.fn("Citation.projectMentionReceipt")(function* (
  input: unknown
): Effect.fn.Return<CitationMentionReceipt, CitationMentionFailure, Crypto.Crypto> {
  const decoded = yield* S.decodeUnknownEffect(S.toType(CitationMention))(input).pipe(Effect.mapError(invalid));
  const metadata = yield* snapshotMetadata(decoded);
  const id = decoded.id;
  const anchorProof = decoded.anchor;
  const anchor = toTextAnchorVerificationReceipt(anchorProof);
  const components = A.map(decoded.components, (component) =>
    CitationComponentReceipt.make({ name: component.name, anchor: toTextAnchorVerificationReceipt(component.anchor) })
  );
  const footnote = O.map(decoded.footnote, (zone) =>
    CitationFootnoteReceipt.make({
      label: O.map(zone.label, (label) => label),
      anchor: toTextAnchorVerificationReceipt(zone.anchor),
    })
  );
  const expected = yield* makeCitationMentionId({
    anchor: anchorProof,
    engineArtifact: metadata.engineArtifact,
    semanticKind: metadata.citation.type,
  }).pipe(Effect.mapError(identityFailure));
  if (id !== expected) return yield* CitationMentionFailure.make({ reason: "stale-identity" });
  return yield* S.decodeUnknownEffect(S.toType(CitationMentionReceipt))({
    schemaVersion: "citation-mention-receipt/v1",
    ...metadata,
    id,
    anchor,
    components,
    footnote,
  }).pipe(Effect.mapError(invalid));
});

const reverify = Effect.fn("Citation.reverifyMentionAnchor")(function* (
  verifiedSource: VerifiedSourceText,
  receipt: TextAnchorVerificationReceipt
) {
  return yield* verifyTextAnchorAgainstVerifiedSource(
    VerifyTextAnchorAgainstVerifiedSourceInput.make({ verifiedSource, anchor: receipt.anchor })
  ).pipe(Effect.mapError(evidenceFailure));
});

/**
 * Restore runtime evidence only after canonical source and engine checks.
 * Hash the raw source once, reverify every anchor, then recompute the mention ID.
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const restoreCitationMention = Effect.fn("Citation.restoreMention")(function* (
  input: unknown
): Effect.fn.Return<CitationMention, CitationMentionFailure, Crypto.Crypto> {
  const decoded = yield* S.decodeUnknownEffect(S.toType(RestoreInput))(input).pipe(Effect.mapError(invalid));
  // Copy all structural input before the first asynchronous hash. Receipts are
  // data, and caller-owned objects cannot be allowed to change mid-verification.
  const json = yield* S.encodeEffect(RestoreJson)(decoded).pipe(Effect.mapError(invalid));
  const snapshot = yield* S.decodeEffect(RestoreJson)(json).pipe(Effect.mapError(invalid));
  const receipt = snapshot.receipt;
  if (receipt.engineArtifact !== snapshot.expectedEngineArtifact)
    return yield* CitationMentionFailure.make({ reason: "stale-engine" });
  const verifiedSource = yield* verifySourceTextIdentity(
    VerifySourceTextIdentityInput.make({
      expectedSource: snapshot.expectedSource,
      source: receipt.anchor.source,
      sourceText: snapshot.sourceText,
    })
  ).pipe(Effect.mapError(evidenceFailure));
  const anchor = yield* reverify(verifiedSource, receipt.anchor);
  const components = yield* Effect.forEach(
    receipt.components,
    (component) =>
      reverify(verifiedSource, component.anchor).pipe(
        Effect.map((proof) => CitationComponentAnchor.make({ name: component.name, anchor: proof }))
      ),
    { concurrency: 1 }
  );
  const footnote = yield* O.match(receipt.footnote, {
    onNone: () => Effect.succeedNone,
    onSome: (zone) =>
      reverify(verifiedSource, zone.anchor).pipe(
        Effect.map((proof) => O.some(CitationFootnoteZone.make({ label: zone.label, anchor: proof })))
      ),
  });
  const restored = yield* makeCitationMention({
    citation: receipt.citation,
    engineArtifact: receipt.engineArtifact,
    signal: receipt.signal,
    warnings: receipt.warnings,
    evidenceConfidence: receipt.evidenceConfidence,
    anchor,
    components,
    footnote,
  });
  if (restored.id !== receipt.id) return yield* CitationMentionFailure.make({ reason: "stale-identity" });
  return restored;
});
