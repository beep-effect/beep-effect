/**
 * Wire shapes for `/memory/admin/*`.
 *
 * Routers build dicts that match these fields. They are response models, not
 * the memory write path. Conversation remains upstream of memory, and the
 * short-term lifecycle report counts Workflow-adjacent adjudication of
 * Short-term rows. It does not store a memory layer.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import { Model, bool, optionalText, pg, userId } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/MemoryAdmin");

const describedBool = (column: string, description: string) =>
  S.Boolean.annotateKey({ description }).pipe(pg.boolean(), pg.columnName(column));

const describedText = (column: string, description: string) =>
  S.String.annotateKey({ description }).pipe(pg.text(), pg.columnName(column));

const describedInt = (column: string, description: string) =>
  S.Int.annotateKey({ description }).pipe(pg.integer(), pg.columnName(column));

/**
 * Raw memory default-read rollout capability flags for one consumer.
 *
 * **Details**
 *
 * Every flag is required. There is no default, so a missing flag is not a
 * hidden false.
 *
 * **Example** (Decode legacy-only capabilities)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ReadRolloutCapabilities } from "@beep/scratchpad/beep/MemoryAdmin"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ReadRolloutCapabilities)({
 *     legacyOnly: true,
 *     shadowArtifactsEnabled: false,
 *     memoryWritesEnabled: false,
 *     memoryReadsEnabled: false,
 *     legacyReadsAuthoritative: true,
 *   }),
 * )
 * console.log(decoded.legacyOnly) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ReadRolloutCapabilities extends Model<ReadRolloutCapabilities>("ReadRolloutCapabilities")(
  {
    legacyOnly: describedBool("legacy_only", "Whether the consumer is legacy-only (no default memory)."),
    shadowArtifactsEnabled: describedBool("shadow_artifacts_enabled", "Whether shadow artifacts are enabled."),
    memoryWritesEnabled: describedBool("memory_writes_enabled", "Whether memory writes are enabled."),
    memoryReadsEnabled: describedBool("memory_reads_enabled", "Whether memory reads are enabled."),
    legacyReadsAuthoritative: describedBool(
      "legacy_reads_authoritative",
      "Whether legacy reads remain authoritative.",
    ),
  },
  $I.annote("ReadRolloutCapabilities", {
    description: "Raw memory default-read rollout capability flags for one consumer.",
  }),
) {}

/**
 * Encoded rollout capability flags.
 *
 * @see {@link ReadRolloutCapabilities} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ReadRolloutCapabilities {
  export type Encoded = S.Codec.Encoded<typeof ReadRolloutCapabilities>;
}

/**
 * Per-consumer default-read rollout observability.
 *
 * **Details**
 *
 * Produced by `build_default_read_rollout_observability`. The admin rollout
 * report stores these as `consumers` map values. Product routes reuse the
 * same shape and extend it elsewhere. `fallbackReason` is present only when
 * reads are not enabled.
 *
 * **Gotchas**
 *
 * `consumer` is documented as `mcp`, `developer_api`, or `omi_chat`, and
 * `readDecision` is documented as `USE_MEMORY` or `DENY_MEMORY`. Neither set
 * is enforced. `mode` is a free string. `archiveDefaultVisible` is documented
 * as always false, but the schema does not reject true.
 *
 * **Example** (Decode a denied consumer)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ReadRolloutConsumerObservability } from "@beep/scratchpad/beep/MemoryAdmin"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ReadRolloutConsumerObservability)({
 *     consumer: "omi_chat",
 *     enabled: false,
 *     reason: "rollout off",
 *     readDecision: "DENY_MEMORY",
 *     mode: "legacy",
 *     memoryReadsEnabled: false,
 *     legacyReadsAuthoritative: true,
 *     defaultMemoryGrant: false,
 *     archiveDefaultVisible: false,
 *     archiveCapability: false,
 *     fallbackReason: "rollout off",
 *     capabilities: {
 *       legacyOnly: true,
 *       shadowArtifactsEnabled: false,
 *       memoryWritesEnabled: false,
 *       memoryReadsEnabled: false,
 *       legacyReadsAuthoritative: true,
 *     },
 *   }),
 * )
 * console.log(O.isSome(decoded.fallbackReason)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ReadRolloutConsumerObservability extends Model<ReadRolloutConsumerObservability>(
  "ReadRolloutConsumerObservability",
)(
  {
    consumer: describedText("consumer", "Memory consumer (mcp, developer_api, omi_chat)."),
    enabled: describedBool("enabled", "Whether default memory reads are enabled for this consumer."),
    reason: describedText("reason", "Effective reason (fallback_reason when present, else the decision reason)."),
    readDecision: describedText("read_decision", "Server read decision value (USE_MEMORY or DENY_MEMORY)."),
    mode: describedText("mode", "Rollout capabilities mode value."),
    memoryReadsEnabled: describedBool("memory_reads_enabled", "Whether memory reads are enabled by capabilities."),
    legacyReadsAuthoritative: describedBool(
      "legacy_reads_authoritative",
      "Whether legacy reads remain authoritative.",
    ),
    defaultMemoryGrant: describedBool("default_memory_grant", "Whether the app holds the default-memory grant."),
    archiveDefaultVisible: describedBool(
      "archive_default_visible",
      "Always false in the producer; Archive is never default-visible.",
    ),
    archiveCapability: describedBool("archive_capability", "Persisted Archive capability flag for the consumer."),
    fallbackReason: optionalText("fallback_reason"),
    capabilities: ReadRolloutCapabilities.annotateKey({ description: "Raw rollout capability flags." }).pipe(
      pg.jsonb(),
      pg.columnName("capabilities"),
    ),
  },
  $I.annote("ReadRolloutConsumerObservability", {
    description: "Per-consumer default-read rollout decision observability shared by admin and product routes.",
  }),
) {}

/**
 * Encoded consumer rollout observability.
 *
 * @see {@link ReadRolloutConsumerObservability} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ReadRolloutConsumerObservability {
  export type Encoded = S.Codec.Encoded<typeof ReadRolloutConsumerObservability>;
}

/**
 * Counts from one Short-term lifecycle worker run.
 *
 * **Details**
 *
 * Returned by `POST /memory/admin/users/{uid}/short-term-lifecycle/run`.
 * `evaluatedAt` is an ISO-8601 UTC string, not a datetime column decoded into
 * `DateTime`. `skippedMemoryIds` has no default: an empty list must be sent.
 * Short-term here is the product layer being adjudicated. The report is not
 * itself a memory, and action items or goals are not part of this payload.
 *
 * **Gotchas**
 *
 * `defaultAccessAllowed` and `archiveDefaultVisible` are documented as always
 * false for this report. The schema still accepts true because the Python
 * model does not check them.
 *
 * **Example** (Decode an empty skip list)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ShortTermLifecycleRunResponse } from "@beep/scratchpad/beep/MemoryAdmin"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ShortTermLifecycleRunResponse)({
 *     uid: "user-1",
 *     runId: "run-1",
 *     evaluatedAt: "2020-01-02T03:04:05.000Z",
 *     evaluatedCount: 1,
 *     createdCount: 0,
 *     existingCount: 0,
 *     skippedCount: 1,
 *     transitionCount: 0,
 *     skippedMemoryIds: [],
 *     defaultAccessAllowed: false,
 *     archiveDefaultVisible: false,
 *   }),
 * )
 * console.log(decoded.skippedMemoryIds.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ShortTermLifecycleRunResponse extends Model<ShortTermLifecycleRunResponse>(
  "ShortTermLifecycleRunResponse",
)(
  {
    uid: userId("uid"),
    runId: describedText("run_id", "Idempotency/run id supplied by the caller."),
    evaluatedAt: describedText("evaluated_at", "ISO-8601 timestamp the run was evaluated at (UTC)."),
    evaluatedCount: describedInt("evaluated_count", "Total items evaluated (created + existing + skipped)."),
    createdCount: describedInt("created_count", "Newly persisted lifecycle transition records."),
    existingCount: describedInt("existing_count", "Already-persisted transition records observed."),
    skippedCount: describedInt("skipped_count", "Items skipped (no transition required)."),
    transitionCount: describedInt("transition_count", "Items that produced a transition (created + existing)."),
    skippedMemoryIds: S.Array(S.String)
      .annotateKey({ description: "Memory ids that were skipped." })
      .pipe(pg.array(S.String.pipe(pg.text())), pg.columnName("skipped_memory_ids")),
    defaultAccessAllowed: describedBool(
      "default_access_allowed",
      "Whether default access was allowed (always false for this admin report).",
    ),
    archiveDefaultVisible: bool("archive_default_visible"),
  },
  $I.annote("ShortTermLifecycleRunResponse", {
    description: "Counts and outcome of a Short-term lifecycle worker run for one user.",
  }),
) {}

/**
 * Encoded short-term lifecycle run report.
 *
 * @see {@link ShortTermLifecycleRunResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ShortTermLifecycleRunResponse {
  export type Encoded = S.Codec.Encoded<typeof ShortTermLifecycleRunResponse>;
}
