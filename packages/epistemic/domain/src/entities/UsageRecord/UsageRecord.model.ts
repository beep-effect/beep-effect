/**
 * Usage record entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicDomainId } from "@beep/identity/packages";
import { NonNegativeInt, SchemaUtils, UnknownRecord } from "@beep/schema";
import { Principal } from "@beep/shared-domain/entity/Principal";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import { OnePasswordReference } from "@beep/shared-domain/values/OnePasswordReference";
import * as S from "effect/Schema";

const $I = $EpistemicDomainId.create("entities/UsageRecord/UsageRecord.model");
const UsageRecordEntity = ProductEntity.make(Epistemic.UsageRecordId);
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
 * **Example** (Decode UsageRecord schema)
 *
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
export class UsageRecord extends UsageRecordEntity.Entity<UsageRecord>(UsageRecordEntity.tableName)(
  {
    activityId: Epistemic.ActivityId.pipe(S.OptionFromNullOr)
      .annotateKey({
        description: "Optional persisted provenance Activity link; encoded absence is SQL and JSON null.",
      })
      .pipe(UsageRecordEntity.pg.integer(), UsageRecordEntity.pg.columnName("activity_id")),
    actor: Principal.pipe(UsageRecordEntity.pg.jsonb()),
    costUsdApproxMicros: NonNegativeInt.pipe(
      S.OptionFromNullOr,
      UsageRecordEntity.pg.integer(),
      UsageRecordEntity.pg.columnName("cost_usd_approx_micros")
    ),
    credentialReference: OnePasswordReference.pipe(
      S.OptionFromNullOr,
      UsageRecordEntity.pg.text(),
      UsageRecordEntity.pg.columnName("credential_reference")
    ),
    inputTokens: NonNegativeInt.pipe(
      S.OptionFromNullOr,
      UsageRecordEntity.pg.integer(),
      UsageRecordEntity.pg.columnName("input_tokens")
    ),
    latencyMillis: NonNegativeInt.pipe(
      S.OptionFromNullOr,
      UsageRecordEntity.pg.integer(),
      UsageRecordEntity.pg.columnName("latency_millis")
    ),
    metadata: UnknownRecord.pipe(UsageRecordEntity.pg.jsonb()),
    model: UsageModelName.annotateKey({ description: "Provider model name recorded for usage attribution." }).pipe(
      UsageRecordEntity.pg.text()
    ),
    outputTokens: NonNegativeInt.pipe(
      S.OptionFromNullOr,
      UsageRecordEntity.pg.integer(),
      UsageRecordEntity.pg.columnName("output_tokens")
    ),
    provider: UsageProviderName.annotateKey({ description: "Provider name recorded for usage attribution." }).pipe(
      UsageRecordEntity.pg.text()
    ),
    totalTokens: NonNegativeInt.pipe(
      S.OptionFromNullOr,
      UsageRecordEntity.pg.integer(),
      UsageRecordEntity.pg.columnName("total_tokens")
    ),
    unitCount: NonNegativeInt.pipe(
      S.OptionFromNullOr,
      UsageRecordEntity.pg.integer(),
      UsageRecordEntity.pg.columnName("unit_count")
    ),
    ...UsageRecordEntity.identityFields,
  },
  $I.annote("UsageRecord", {
    description: "Append-only usage attribution record linked to an epistemic Activity.",
  }),
  UsageRecordEntity.entityExtras
) {}

/**
 * Boundary command for appending turn-finalization usage attribution.
 *
 * **Example** (Decode turn finalization append)
 *
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
    ...ProductEntity.fields,
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
 * **Example** (Build usage from append)
 *
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
