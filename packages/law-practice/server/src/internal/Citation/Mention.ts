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
  VerifiedSourceText,
  VerifySourceTextIdentityInput,
  VerifyTextAnchorAgainstVerifiedSourceInput,
  verifySourceTextIdentity,
  verifyTextAnchorAgainstVerifiedSource,
} from "@beep/provenance/VerifiedTextAnchor";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import { makeCitationMentionId } from "./MentionIdentity.ts";
import { captureCitationRestoration } from "./Snapshot.ts";
import type { TextAnchorVerificationReceipt } from "@beep/provenance/VerifiedTextAnchor";
import type * as Digest from "effect/crypto/Digest";

const CitationMentionType = S.toType(CitationMention);
const CitationMentionReceiptType = S.toType(CitationMentionReceipt);

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
const CreateInputType = S.toType(CreateInput);

const Metadata = S.Struct(
  Struct.omit(CitationMentionReceipt.fields, ["schemaVersion", "id", "anchor", "components", "footnote"])
).pipe(
  $I.annoteSchema("Metadata", {
    description: "Mutable semantic/assertion data snapshotted through its own codecs before asynchronous digest work.",
  })
);
const MetadataJson = S.fromJsonString(Metadata);
const MentionReceiptJson = S.fromJsonString(CitationMentionReceipt);
const sourceEquivalent = S.toEquivalence(SourceTextIdentity);
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
const RestoreInputType = S.toType(RestoreInput);

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
): Effect.fn.Return<CitationMention, CitationMentionFailure, Digest.Digest> {
  const decoded = yield* S.decodeUnknownEffect(CreateInputType)(input).pipe(Effect.mapError(invalid));
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
  return yield* S.decodeUnknownEffect(CitationMentionType)({
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
): Effect.fn.Return<CitationMentionReceipt, CitationMentionFailure, Digest.Digest> {
  const decoded = yield* S.decodeUnknownEffect(CitationMentionType)(input).pipe(Effect.mapError(invalid));
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
  return yield* S.decodeUnknownEffect(CitationMentionReceiptType)({
    schemaVersion: "citation-mention-receipt/v1",
    ...metadata,
    id,
    anchor,
    components,
    footnote,
  }).pipe(Effect.mapError(invalid));
});

/**
 * Capture structural evidence from an already validated runtime mention.
 * This does not check its ID or deep-copy metadata; callers must snapshot the
 * whole request before asynchronous work and validate identity before output.
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const captureCitationMentionReceiptData = (mention: CitationMention): CitationMentionReceipt =>
  CitationMentionReceipt.make({
    ...mention,
    schemaVersion: "citation-mention-receipt/v1",
    anchor: toTextAnchorVerificationReceipt(mention.anchor),
    components: A.map(mention.components, (component) =>
      CitationComponentReceipt.make({ name: component.name, anchor: toTextAnchorVerificationReceipt(component.anchor) })
    ),
    footnote: O.map(mention.footnote, (zone) =>
      CitationFootnoteReceipt.make({ label: zone.label, anchor: toTextAnchorVerificationReceipt(zone.anchor) })
    ),
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
): Effect.fn.Return<CitationMention, CitationMentionFailure, Digest.Digest> {
  const snapshot = yield* captureCitationRestoration(RestoreInputType, RestoreJson, input, invalid, () =>
    CitationMentionFailure.make({ reason: "stale-engine" })
  );
  const receipt = snapshot.receipt;
  const verifiedSource = yield* verifySourceTextIdentity(
    VerifySourceTextIdentityInput.make({
      expectedSource: snapshot.expectedSource,
      source: receipt.anchor.source,
      sourceText: snapshot.sourceText,
    })
  ).pipe(Effect.mapError(evidenceFailure));
  return yield* restoreCitationMentionAgainstVerifiedSource(receipt, verifiedSource, snapshot.expectedEngineArtifact);
});

/**
 * Restore one receipt against an already verified canonical source capability.
 * Used by whole-document restoration to avoid hashing the same source again.
 * Receipt source/engine checks and occurrence digest validation still apply.
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const restoreCitationMentionAgainstVerifiedSource: {
  (
    sourceProof: VerifiedSourceText,
    expectedEngineArtifact: Sha256Hex
  ): (input: CitationMentionReceipt) => Effect.Effect<CitationMention, CitationMentionFailure, Digest.Digest>;
  (
    input: CitationMentionReceipt,
    sourceProof: VerifiedSourceText,
    expectedEngineArtifact: Sha256Hex
  ): Effect.Effect<CitationMention, CitationMentionFailure, Digest.Digest>;
} = dual(
  3,
  Effect.fn("Citation.restoreMentionAgainstSource")(function* (
    input: CitationMentionReceipt,
    sourceProof: VerifiedSourceText,
    expectedEngineArtifact: Sha256Hex
  ): Effect.fn.Return<CitationMention, CitationMentionFailure, Digest.Digest> {
    const verifiedSource = yield* S.decodeEffect(VerifiedSourceText)(sourceProof).pipe(
      Effect.mapError(evidenceFailure)
    );
    const json = yield* S.encodeEffect(MentionReceiptJson)(input).pipe(Effect.mapError(invalid));
    const receipt = yield* S.decodeEffect(MentionReceiptJson)(json).pipe(Effect.mapError(invalid));
    if (!sourceEquivalent(receipt.anchor.source, verifiedSource.source)) return yield* evidenceFailure();
    if (receipt.engineArtifact !== expectedEngineArtifact)
      return yield* CitationMentionFailure.make({ reason: "stale-engine" });
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
  })
);
