/**
 * Canonical memory evidence.
 *
 * **Details**
 *
 * This is the evidence record apply and JIT authority use. It is not the legacy
 * `memories.Evidence` row and not an import artifact.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Str from "effect/String";
import { Model, UtcTimestamp, optionalConfidence, optionalNull, pg, unitIntervalCheck } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/MemoryEvidence");

const described = <A extends S.Top>(schema: A, description: string) => schema.annotateKey({ description });

const nonBlank = S.String.check(
  S.makeFilter((value: string) => !Str.isEmpty(Str.trim(value)), {
    identifier: "NonBlankEvidenceText",
    title: "Non-blank evidence text",
    message: "evidence text must not be whitespace",
  }),
);

const literalDefault = (literals: ReadonlyArray<string>, value: string, column: string) => {
  const allowed = HashSet.fromIterable(literals);
  return S.String.check(
    S.makeFilter((input: string) => HashSet.has(allowed, input), {
      identifier: `Closed_${column}`,
      title: column,
      message: `${column} is not an allowed value`,
    }),
  ).pipe(S.withConstructorDefault(Effect.succeed(value)), pg.text(), pg.columnName(column));
};

const optionalNonBlank = (column: string, description: string) =>
  described(optionalNull(nonBlank), description).pipe(pg.text(), pg.columnName(column));

const optionalPlain = (column: string, description: string) =>
  described(optionalNull(S.String), description).pipe(pg.text(), pg.columnName(column));

const optionalInstantSchema = S.NullOr(S.String).pipe(
  S.optionalKey,
  S.decodeTo(S.Option(UtcTimestamp), {
    decode: SchemaGetter.transformOptional((present) =>
      present.pipe(
        O.flatMap((value) => (Predicate.isNull(value) ? O.none() : O.some(value))),
        O.some,
      ),
    ),
    encode: SchemaGetter.transformOptional((present) =>
      present.pipe(
        O.flatten,
        O.match({
          onNone: () => null,
          onSome: (value) => value,
        }),
        O.some,
      ),
    ),
  }),
  SchemaUtils.withNoneDefault,
);

const jsonList = (column: string) =>
  S.Array(S.JsonObject).pipe(S.withConstructorDefault(Effect.succeed([])), pg.jsonb(), pg.columnName(column));

/**
 * Whether the cited source still exists.
 *
 * **Details**
 *
 * `active` requires `sourceId` and `sourceVersion`. `missing`, `tombstoned`,
 * and `purged` require `sourceStateReason`. The reason value does not change
 * the rest of the record.
 *
 * **Example** (Decode an active source)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SourceState } from "@beep/scratchpad/beep/MemoryEvidence.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(SourceState)("active"))
 * console.log(decoded) // "active"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SourceState = LiteralKit(["active", "missing", "tombstoned", "purged"]).pipe(
  $I.annoteSchema("SourceState", {
    description: "Whether cited evidence still points at a live source.",
  }),
);

/**
 * Decoded source state.
 *
 * @see {@link SourceState} for which sibling fields each state requires.
 * @category type-level
 * @since 0.0.0
 */
export type SourceState = typeof SourceState.Type;

/**
 * Why a source is no longer active.
 *
 * **Example** (Decode a deletion reason)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SourceStateReason } from "@beep/scratchpad/beep/MemoryEvidence.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(SourceStateReason)("deleted_by_user"))
 * console.log(decoded) // "deleted_by_user"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SourceStateReason = LiteralKit([
  "ephemeral_already_missing",
  "dropped_before_copy",
  "deleted_by_user",
  "account_purged",
  "copy_failed",
  "explicit_loss",
  "not_applicable",
]).pipe(
  $I.annoteSchema("SourceStateReason", {
    description: "Why non-active evidence no longer has a live source.",
  }),
);

/**
 * Decoded source-state reason.
 *
 * @see {@link SourceStateReason} for the closed loss vocabulary.
 * @category type-level
 * @since 0.0.0
 */
export type SourceStateReason = typeof SourceStateReason.Type;

/**
 * How an artifact was kept or lost.
 *
 * **Details**
 *
 * `preserved` is the success case. The other members match {@link SourceStateReason}
 * but this is not that type: preservation has no `active` member.
 *
 * **Example** (Decode a preserved artifact)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ArtifactPreservationState } from "@beep/scratchpad/beep/MemoryEvidence.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ArtifactPreservationState)("preserved"))
 * console.log(decoded) // "preserved"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ArtifactPreservationState = LiteralKit([
  "preserved",
  "ephemeral_already_missing",
  "dropped_before_copy",
  "deleted_by_user",
  "account_purged",
  "copy_failed",
  "explicit_loss",
  "not_applicable",
]).pipe(
  $I.annoteSchema("ArtifactPreservationState", {
    description: "Whether a cited artifact was preserved or how it was lost.",
  }),
);

/**
 * Decoded artifact preservation.
 *
 * @see {@link ArtifactPreservationState} for the closed vocabulary.
 * @category type-level
 * @since 0.0.0
 */
export type ArtifactPreservationState = typeof ArtifactPreservationState.Type;

/**
 * How much of the provenance a caller may see.
 *
 * **Example** (Decode redacted provenance)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ProvenanceVisibility } from "@beep/scratchpad/beep/MemoryEvidence.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ProvenanceVisibility)("redacted"))
 * console.log(decoded) // "redacted"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProvenanceVisibility = LiteralKit(["visible", "redacted", "hidden"]).pipe(
  $I.annoteSchema("ProvenanceVisibility", {
    description: "Caller-visible provenance: visible, redacted, or hidden.",
  }),
);

/**
 * Decoded provenance visibility.
 *
 * @see {@link ProvenanceVisibility} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type ProvenanceVisibility = typeof ProvenanceVisibility.Type;

/**
 * Redaction lifecycle for an evidence row.
 *
 * **Gotchas**
 *
 * This is not the import artifact's free-string `redacted_or_summary` default,
 * and it is not legacy `Evidence.redaction_status`.
 *
 * **Example** (Decode an active redaction status)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { RedactionStatus } from "@beep/scratchpad/beep/MemoryEvidence.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(RedactionStatus)("active"))
 * console.log(decoded) // "active"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RedactionStatus = LiteralKit(["active", "redacted", "tombstoned", "purged"]).pipe(
  $I.annoteSchema("RedactionStatus", {
    description: "Evidence redaction lifecycle. Independent of import redaction strings.",
  }),
);

/**
 * Decoded redaction status.
 *
 * @see {@link RedactionStatus} for why this is not the import default.
 * @category type-level
 * @since 0.0.0
 */
export type RedactionStatus = typeof RedactionStatus.Type;

/**
 * One stored artifact pointer on an evidence row.
 *
 * **Details**
 *
 * Present `artifactId`, `uri`, and `checksum` must contain a non-whitespace
 * character. Whitespace is rejected, not stripped. `sizeBytes` has no lower bound.
 *
 * **Example** (Decode a null checksum)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ArtifactRef } from "@beep/scratchpad/beep/MemoryEvidence.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ArtifactRef)({ preservation: "preserved", checksum: null }),
 * )
 * console.log(O.isNone(decoded.checksum)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArtifactRef extends Model<ArtifactRef>("ArtifactRef")(
  {
    artifactId: optionalNonBlank("artifact_id", "Stored artifact id, when the copy has one."),
    uri: optionalNonBlank("uri", "Artifact URI, when the copy has one."),
    checksum: optionalNonBlank("checksum", "Artifact checksum, when the copy has one."),
    sizeBytes: described(optionalNull(S.Int), "Artifact size in bytes. No lower bound is declared.").pipe(
      pg.integer(),
      pg.columnName("size_bytes"),
    ),
    preservation: described(ArtifactPreservationState, "How this artifact was preserved or lost.").pipe(
      pg.text(),
      pg.columnName("preservation"),
    ),
  },
  $I.annote("ArtifactRef", {
    description: "Pointer to one source artifact cited by memory evidence.",
  }),
) {}

/**
 * Encoded form of {@link ArtifactRef}.
 *
 * @see {@link ArtifactRef} for the runtime pointer.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ArtifactRef {
  export type Encoded = S.Codec.Encoded<typeof ArtifactRef>;
}

const active = "active";
const visible = "visible";

/**
 * Canonical evidence row used by memory apply.
 *
 * **Details**
 *
 * Active evidence must name a source id and source version. Missing, tombstoned,
 * and purged evidence must name a {@link SourceStateReason}. When `sourceType`
 * is `conversation` and both conversation and source ids are present, they must
 * be equal. Every artifact's preservation must equal `artifactPreservation`.
 *
 * **Gotchas**
 *
 * `clientDeviceId` is optional provenance. Absent means the capture device is
 * unknown. It is not an input to the evidence id. `encryptionOrRedactionStatus`
 * is a second {@link RedactionStatus}, not a copy of `redactionStatus`. Missing
 * `capturedAt` means the capture time is unknown, not that the user authored it.
 *
 * **Example** (Require a source id while the source is active)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CheckedMemoryEvidence } from "@beep/scratchpad/beep/MemoryEvidence.ts"
 *
 * const exit = Effect.runSyncExit(
 *   S.decodeUnknownEffect(CheckedMemoryEvidence)({
 *     evidenceId: "ev-1",
 *     sourceType: "conversation",
 *     artifactPreservation: "preserved",
 *   }),
 * )
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryEvidence extends Model<MemoryEvidence>("MemoryEvidence")(
  {
    evidenceId: described(nonBlank, "Stable evidence id. Not derived from the device id.").pipe(
      pg.text(),
      pg.columnName("evidence_id"),
    ),
    sourceType: described(nonBlank, "Free source type, such as conversation. Not a closed union.").pipe(
      pg.text(),
      pg.columnName("source_type"),
    ),
    sourceId: optionalNonBlank("source_id", "Source id. Required while sourceState is active."),
    sourceVersion: optionalNonBlank("source_version", "Source version. Required while sourceState is active."),
    conversationId: optionalNonBlank(
      "conversation_id",
      "Upstream Conversation id. Must match sourceId when sourceType is conversation.",
    ),
    artifactRefs: S.Array(ArtifactRef).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      pg.jsonb(),
      pg.columnName("artifact_refs"),
    ),
    artifactPreservation: described(
      ArtifactPreservationState,
      "Preservation shared by this row and every artifact ref.",
    ).pipe(pg.text(), pg.columnName("artifact_preservation")),
    quoteRefs: jsonList("quote_refs"),
    contentHash: optionalNonBlank("content_hash", "Content hash of the cited source, when known."),
    lineageId: optionalNonBlank("lineage_id", "Lineage id shared by derived evidence, when known."),
    sourceState: literalDefault(["active", "missing", "tombstoned", "purged"], active, "source_state"),
    sourceStateReason: described(
      optionalNull(SourceStateReason),
      "Required when sourceState is missing, tombstoned, or purged.",
    ).pipe(pg.text(), pg.columnName("source_state_reason")),
    provenanceVisibility: literalDefault(["visible", "redacted", "hidden"], visible, "provenance_visibility"),
    redactionStatus: literalDefault(["active", "redacted", "tombstoned", "purged"], active, "redaction_status"),
    encryptionOrRedactionStatus: literalDefault(["active", "redacted", "tombstoned", "purged"], active, "encryption_or_redaction_status"),
    patchId: optionalPlain("patch_id", "Patch that produced this evidence, when known."),
    commitId: optionalPlain("commit_id", "Commit that admitted this evidence, when known."),
    clientDeviceId: described(
      optionalNull(nonBlank),
      "Optional capture device. Absent means unknown device. Not hashed into evidenceId.",
    ).pipe(pg.text(), pg.columnName("client_device_id")),
    capturedAt: described(
      optionalInstantSchema,
      "Capture time. Missing metadata is unknown, never proof the user authored the capture.",
    ).pipe(pg.timestamp({ mode: "string", withTimezone: true }), pg.columnName("captured_at")),
    sourceSignal: optionalPlain("source_signal", "Signal that produced the evidence, when known."),
    extractorId: optionalPlain("extractor_id", "Extractor that emitted the evidence, when known."),
    extractorVersion: optionalPlain("extractor_version", "Extractor version, when known."),
    captureConfidence: optionalConfidence("capture_confidence"),
    independenceGroup: optionalPlain("independence_group", "Independence group for corroboration, when set."),
    attribution: optionalPlain("attribution", "Free-string attribution. Not a closed speaker union."),
  },
  $I.annote("MemoryEvidence", {
    description: "Canonical evidence record. Active sources must name an id and version.",
  }),
  (columns) => [unitIntervalCheck("capture_confidence")(columns.captureConfidence)],
) {}

/**
 * Encoded form of {@link MemoryEvidence}.
 *
 * @see {@link MemoryEvidence} for the runtime row and source-state rules.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryEvidence {
  export type Encoded = S.Codec.Encoded<typeof MemoryEvidence>;
}

const someText = (value: O.Option<string>): boolean => O.isSome(value) && !Str.isEmpty(Str.trim(value.value));

/**
 * Explain why evidence fails the source-identity rules, if it does.
 *
 * **Details**
 *
 * Active evidence needs a source id and source version. Non-active evidence
 * needs a reason. Conversation evidence cannot disagree with its source id.
 * Artifact preservation must match the row.
 *
 * **Example** (Flag a conversation id mismatch)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { MemoryEvidence, memoryEvidenceIssue } from "@beep/scratchpad/beep/MemoryEvidence.ts"
 *
 * const row = MemoryEvidence.make({
 *   evidenceId: "ev-1",
 *   sourceType: "conversation",
 *   sourceId: O.some("source-1"),
 *   sourceVersion: O.some("v1"),
 *   conversationId: O.some("other"),
 *   artifactPreservation: "preserved",
 * })
 * console.log(memoryEvidenceIssue(row)) // "conversation_id must match source_id for conversation evidence"
 * ```
 *
 * @see {@link CheckedMemoryEvidence} for the same rule on decode.
 * @category predicates
 * @since 0.0.0
 */
export const memoryEvidenceIssue = (evidence: MemoryEvidence): string | undefined => {
  if (Equal.equals(evidence.sourceState, "active")) {
    if (!someText(evidence.sourceId)) return "active evidence requires source_id";
    if (!someText(evidence.sourceVersion)) return "active evidence requires source_version";
  }
  if (
    (Equal.equals(evidence.sourceState, "missing") ||
      Equal.equals(evidence.sourceState, "tombstoned") ||
      Equal.equals(evidence.sourceState, "purged")) &&
    O.isNone(evidence.sourceStateReason)
  ) {
    return "non-active source evidence requires source_state_reason";
  }
  if (
    O.isSome(evidence.conversationId) &&
    Equal.equals(evidence.sourceType, "conversation") &&
    O.isSome(evidence.sourceId) &&
    !Equal.equals(evidence.conversationId.value, evidence.sourceId.value)
  ) {
    return "conversation_id must match source_id for conversation evidence";
  }
  if (
    A.some(evidence.artifactRefs, (artifact: ArtifactRef) => !Equal.equals(artifact.preservation, evidence.artifactPreservation))
  ) {
    return "artifact_refs preservation must match evidence artifact_preservation";
  }
  return undefined;
};

/**
 * {@link MemoryEvidence} decoder that enforces source identity.
 *
 * **Example** (Accept active conversation evidence)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CheckedMemoryEvidence } from "@beep/scratchpad/beep/MemoryEvidence.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(CheckedMemoryEvidence)({
 *     evidenceId: "ev-1",
 *     sourceType: "conversation",
 *     sourceId: "conv-1",
 *     sourceVersion: "v1",
 *     conversationId: "conv-1",
 *     artifactPreservation: "preserved",
 *   }),
 * )
 * console.log(decoded.sourceState) // "active"
 * ```
 *
 * @see {@link memoryEvidenceIssue} for the predicate the check runs.
 * @category schemas
 * @since 0.0.0
 */
export const CheckedMemoryEvidence = MemoryEvidence.check(
  S.makeFilter((evidence: MemoryEvidence) => memoryEvidenceIssue(evidence), {
    identifier: "MemoryEvidenceSourceIdentity",
    title: "Memory evidence source identity",
    message: "evidence source identity is illegal",
  }),
);

/**
 * Decoded evidence that satisfies source identity.
 *
 * @see {@link CheckedMemoryEvidence} for the checked decoder.
 * @category type-level
 * @since 0.0.0
 */
export type CheckedMemoryEvidence = typeof CheckedMemoryEvidence.Type;
