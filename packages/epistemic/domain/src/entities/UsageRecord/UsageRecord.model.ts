/**
 * Usage record entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicDomainId } from "@beep/identity/packages";
import { NonNegativeInt, SchemaUtils, UnknownRecord } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import * as BaseEntitySchema from "@beep/shared-domain/entity/BaseEntity";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import { Principal } from "@beep/shared-domain/entity/Principal";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import { OnePasswordReference } from "@beep/shared-domain/values/OnePasswordReference";
import * as S from "effect/Schema";

const $I = $EpistemicDomainId.create("entities/UsageRecord/UsageRecord.model");
const UsageModelName = S.NonEmptyString.pipe(
  $I.annoteSchema("UsageModelName", {
    description: "Non-empty model name recorded for usage attribution.",
  }),
  SchemaUtils.withCodecStatics
);
const UsageProviderName = S.NonEmptyString.pipe(
  $I.annoteSchema("UsageProviderName", {
    description: "Non-empty provider name recorded for usage attribution.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Append-only usage attribution for model, tool, or agent work.
 *
 * @example
 * ```ts
 * import { UsageRecord } from "@beep/epistemic-domain"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const usage = S.decodeUnknownSync(UsageRecord)({
 *   activityId: 1,
 *   actor: { kind: "System", component: "Runtime" },
 *   costUsdApproxMicros: 1200,
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   credentialReference: null,
 *   entityType: Epistemic.UsageRecordId.entityType,
 *   id: 1,
 *   inputTokens: 420,
 *   latencyMillis: 900,
 *   metadata: { turnId: "turn-1" },
 *   model: "gpt-5",
 *   orgId: 1,
 *   outputTokens: 180,
 *   provider: "openai",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   totalTokens: 600,
 *   unitCount: null,
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * })
 *
 * console.log(usage.provider)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class UsageRecord extends BaseEntity.Class<UsageRecord>($I`UsageRecord`)(
  Epistemic.UsageRecordId,
  {
    fields: {
      activityId: Epistemic.ActivityId,
      actor: Principal,
      costUsdApproxMicros: NonNegativeInt.pipe(S.OptionFromNullOr),
      credentialReference: OnePasswordReference.pipe(S.OptionFromNullOr),
      inputTokens: NonNegativeInt.pipe(S.OptionFromNullOr),
      latencyMillis: NonNegativeInt.pipe(S.OptionFromNullOr),
      metadata: UnknownRecord,
      model: UsageModelName.annotateKey({ description: "Provider model name recorded for usage attribution." }),
      outputTokens: NonNegativeInt.pipe(S.OptionFromNullOr),
      provider: UsageProviderName.annotateKey({ description: "Provider name recorded for usage attribution." }),
      totalTokens: NonNegativeInt.pipe(S.OptionFromNullOr),
      unitCount: NonNegativeInt.pipe(S.OptionFromNullOr),
    },
    persisted: {
      activityId: EntitySchema.persist.entityId({
        columnName: "activity_id",
      }),
      actor: EntitySchema.persist.jsonb({
        columnName: "actor",
      }),
      costUsdApproxMicros: EntitySchema.persist.int({
        columnName: "cost_usd_approx_micros",
      }),
      credentialReference: EntitySchema.persist.text({
        columnName: "credential_reference",
      }),
      inputTokens: EntitySchema.persist.int({
        columnName: "input_tokens",
      }),
      latencyMillis: EntitySchema.persist.int({
        columnName: "latency_millis",
      }),
      metadata: EntitySchema.persist.jsonb({
        columnName: "metadata",
      }),
      model: EntitySchema.persist.text({
        columnName: "model",
      }),
      outputTokens: EntitySchema.persist.int({
        columnName: "output_tokens",
      }),
      provider: EntitySchema.persist.text({
        columnName: "provider",
      }),
      totalTokens: EntitySchema.persist.int({
        columnName: "total_tokens",
      }),
      unitCount: EntitySchema.persist.int({
        columnName: "unit_count",
      }),
    },
  },
  $I.annote("UsageRecord", {
    description: "Append-only usage attribution record linked to an epistemic Activity.",
  })
) {}

/**
 * Boundary command for appending turn-finalization usage attribution.
 *
 * @example
 * ```ts
 * import { TurnFinalizationUsageAppend } from "@beep/epistemic-domain"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const append = S.decodeUnknownSync(TurnFinalizationUsageAppend)({
 *   activityId: 1,
 *   actor: { kind: "System", component: "Runtime" },
 *   costUsdApproxMicros: 1200,
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   credentialReference: null,
 *   entityType: Epistemic.UsageRecordId.entityType,
 *   id: 1,
 *   inputTokens: 420,
 *   latencyMillis: 900,
 *   metadata: { turnId: "turn-1" },
 *   model: "gpt-5",
 *   orgId: 1,
 *   outputTokens: 180,
 *   provider: "openai",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   totalTokens: 600,
 *   unitCount: null,
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * })
 *
 * console.log(append.model)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class TurnFinalizationUsageAppend extends S.Class<TurnFinalizationUsageAppend>($I`TurnFinalizationUsageAppend`)(
  {
    ...BaseEntitySchema.fields,
    ...UsageRecord.fields,
    entityType: S.tag(Epistemic.UsageRecordId.entityType),
    id: Epistemic.UsageRecordId,
  },
  $I.annote("TurnFinalizationUsageAppend", {
    description: "Decoded append payload for a UsageRecord produced while finalizing a turn.",
  })
) {}

/**
 * Build the {@link UsageRecord} appended for a finalized turn.
 *
 * @example
 * ```ts
 * import { TurnFinalizationUsageAppend, appendTurnFinalizationUsageRecord } from "@beep/epistemic-domain"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const append = S.decodeUnknownSync(TurnFinalizationUsageAppend)({
 *   activityId: 1,
 *   actor: { kind: "System", component: "Runtime" },
 *   costUsdApproxMicros: 1200,
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   credentialReference: null,
 *   entityType: Epistemic.UsageRecordId.entityType,
 *   id: 1,
 *   inputTokens: 420,
 *   latencyMillis: 900,
 *   metadata: { turnId: "turn-1" },
 *   model: "gpt-5",
 *   orgId: 1,
 *   outputTokens: 180,
 *   provider: "openai",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   totalTokens: 600,
 *   unitCount: null,
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * })
 * const usage = appendTurnFinalizationUsageRecord(append)
 *
 * console.log(usage.model)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const appendTurnFinalizationUsageRecord = (input: TurnFinalizationUsageAppend): UsageRecord =>
  UsageRecord.make(input);
