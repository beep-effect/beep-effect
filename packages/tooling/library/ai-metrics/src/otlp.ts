/**
 * OTLP span projections for redacted AI metrics derived storage.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, flow, pipe } from "effect";
import { dual } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  AiMetricsDeployTarget,
  AiMetricsOtlpEndpointSpec,
  AiMetricsSourceRole,
  AiMetricsTranscriptSource,
} from "./models.ts";

const $I = $RepoAiMetricsId.create("otlp");

/**
 * OTLP attributes approved for redacted AI metrics span export.
 *
 * **Example** (Use AI_METRICS_OTLP_ATTRIBUTE_ALLOWLIST)
 *
 * ```ts
 * import { AI_METRICS_OTLP_ATTRIBUTE_ALLOWLIST } from "@beep/repo-ai-metrics"
 *
 * const carriesSessionId = AI_METRICS_OTLP_ATTRIBUTE_ALLOWLIST.includes("session.id")
 * console.log(carriesSessionId)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const AI_METRICS_OTLP_ATTRIBUTE_ALLOWLIST = [
  "ai_metrics.agent_nickname_hash",
  "ai_metrics.agent_role_hash",
  "ai_metrics.config_snapshot_id",
  "ai_metrics.event_name",
  "ai_metrics.forked_from_id_hash",
  "ai_metrics.ingest_run_id",
  "ai_metrics.line_number",
  "ai_metrics.parent_session_id_hash",
  "ai_metrics.parent_thread_id_hash",
  "ai_metrics.provider",
  "ai_metrics.raw_event_hash",
  "ai_metrics.session_id_hash",
  "ai_metrics.source_kind",
  "ai_metrics.source_path_hash",
  "ai_metrics.source_role",
  "ai_metrics.thread_spawn",
  "ai_metrics.timestamp",
  "ai_metrics.tool_name",
  "ai_metrics.turn_id",
  "openinference.span.kind",
  "session.id",
  "tool.name",
] as const;

/**
 * Attribute value variants allowed on redacted AI metrics OTLP spans.
 *
 * **Example** (Narrow with AiMetricsOtlpAttributeValue)
 *
 * ```ts
 * import { AiMetricsOtlpAttributeValue } from "@beep/repo-ai-metrics"
 *
 * const isAttributeValue = AiMetricsOtlpAttributeValue.is(42)
 * console.log(isAttributeValue)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AiMetricsOtlpAttributeValue = S.Union([S.String, S.Finite, S.Boolean]).pipe(
  $I.annoteSchema("AiMetricsOtlpAttributeValue", {
    description: "Low-cardinality or hashed attribute value emitted on AI metrics OTLP spans.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link AiMetricsOtlpAttributeValue}.
 *
 * **Example** (Type a value as AiMetricsOtlpAttributeValue)
 *
 * ```ts
 * import type { AiMetricsOtlpAttributeValue } from "@beep/repo-ai-metrics"
 * const value: AiMetricsOtlpAttributeValue = "hash-only"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsOtlpAttributeValue = typeof AiMetricsOtlpAttributeValue.Type;

/**
 * Error raised by AI metrics OTLP projection or export.
 *
 * **Example** (Construct AiMetricsOtlpExportError)
 *
 * ```ts
 * import { AiMetricsOtlpExportError } from "@beep/repo-ai-metrics"
 *
 * const error = AiMetricsOtlpExportError.make({
 *   cause: "duckdb read failed",
 *   message: "Failed to read AI metrics OTLP rows."
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsOtlpExportError extends TaggedErrorClass<AiMetricsOtlpExportError>($I`AiMetricsOtlpExportError`)(
  "AiMetricsOtlpExportError",
  {
    cause: S.Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annote("AiMetricsOtlpExportError", {
    description: "Typed failure raised while projecting or exporting redacted AI metrics OTLP spans.",
  })
) {}

/**
 * Input for exporting one derived ingest run as OTLP spans.
 *
 * **Example** (Construct AiMetricsOtlpExportInput)
 *
 * ```ts
 * import { AiMetricsOtlpExportInput, AiMetricsOtlpEndpointSpec } from "@beep/repo-ai-metrics"
 *
 * const input = AiMetricsOtlpExportInput.make({
 *   duckDbPath: ".beep/ai-metrics/derived/ai-metrics.duckdb",
 *   endpoint: AiMetricsOtlpEndpointSpec.make({
 *     baseUrl: "http://127.0.0.1:6006",
 *     protocol: "http/protobuf",
 *     resourceAttributes: {},
 *     signalScope: "traces_only",
 *     traceUrl: "http://127.0.0.1:6006/v1/traces"
 *   }),
 *   target: "local"
 * })
 * console.log(input)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsOtlpExportInput extends S.Class<AiMetricsOtlpExportInput>($I`AiMetricsOtlpExportInput`)(
  {
    duckDbPath: S.String,
    endpoint: AiMetricsOtlpEndpointSpec,
    ingestRunId: S.optionalKey(S.String),
    target: AiMetricsDeployTarget,
  },
  $I.annote("AiMetricsOtlpExportInput", {
    description: "DuckDB source and OTLP endpoint for one redacted AI metrics export run.",
  })
) {}

/**
 * One span projection ready to be emitted through Effect tracing.
 *
 * **Example** (Construct AiMetricsOtlpSpanProjection)
 *
 * ```ts
 * import { AiMetricsOtlpSpanProjection } from "@beep/repo-ai-metrics"
 *
 * const projection = AiMetricsOtlpSpanProjection.make({
 *   attributes: {
 *     "ai_metrics.event_name": "codex.event_msg",
 *     "ai_metrics.line_number": 1,
 *     "openinference.span.kind": "CHAIN"
 *   },
 *   spanName: "ai_metrics.turn"
 * })
 * console.log(projection.attributes["ai_metrics.event_name"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsOtlpSpanProjection extends S.Class<AiMetricsOtlpSpanProjection>($I`AiMetricsOtlpSpanProjection`)(
  {
    attributes: S.Record(S.String, AiMetricsOtlpAttributeValue),
    spanName: S.String,
  },
  $I.annote("AiMetricsOtlpSpanProjection", {
    description: "Redacted span name and bounded attributes derived from AI metrics DuckDB storage.",
  })
) {}

/**
 * Span projection batch resolved for one derived ingest run.
 *
 * **Example** (Construct AiMetricsOtlpSpanProjectionBatch)
 *
 * ```ts
 * import {
 *   AiMetricsOtlpSpanProjection,
 *   AiMetricsOtlpSpanProjectionBatch
 * } from "@beep/repo-ai-metrics"
 *
 * const batch = AiMetricsOtlpSpanProjectionBatch.make({
 *   ingestRunId: "forwarder-1",
 *   projections: [
 *     AiMetricsOtlpSpanProjection.make({
 *       attributes: { "ai_metrics.event_name": "codex.event_msg" },
 *       spanName: "ai_metrics.turn"
 *     })
 *   ],
 *   sessionSpanCount: 0,
 *   turnIds: ["turn-1"],
 *   turnSpanCount: 1
 * })
 * console.log(batch.projections.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsOtlpSpanProjectionBatch extends S.Class<AiMetricsOtlpSpanProjectionBatch>(
  $I`AiMetricsOtlpSpanProjectionBatch`
)(
  {
    ingestRunId: S.String,
    projections: S.Array(AiMetricsOtlpSpanProjection),
    sessionSpanCount: S.Finite,
    /**
     * Turn ids backing this batch, carried so a successful export can close the
     * watermark on exactly the rows it emitted rather than on a re-evaluated
     * predicate that may have moved underneath it.
     */
    turnIds: S.Array(S.String),
    turnSpanCount: S.Finite,
  },
  $I.annote("AiMetricsOtlpSpanProjectionBatch", {
    description: "Redacted OTLP span projections grouped by one AI metrics ingest run.",
  })
) {}

/**
 * Result of a redacted AI metrics OTLP export attempt.
 *
 * **Example** (Construct AiMetricsOtlpExportResult)
 *
 * ```ts
 * import { AiMetricsOtlpExportResult } from "@beep/repo-ai-metrics"
 *
 * const result = AiMetricsOtlpExportResult.make({
 *   endpointTraceUrl: "http://127.0.0.1:6006/projects/default/traces",
 *   ingestRunId: "forwarder-1",
 *   sessionSpanCount: 2,
 *   spanCount: 12,
 *   target: "local",
 *   turnSpanCount: 10
 * })
 * console.log(result.spanCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsOtlpExportResult extends S.Class<AiMetricsOtlpExportResult>($I`AiMetricsOtlpExportResult`)(
  {
    endpointTraceUrl: S.String,
    ingestRunId: S.String,
    sessionSpanCount: S.Finite,
    spanCount: S.Finite,
    target: AiMetricsDeployTarget,
    turnSpanCount: S.Finite,
  },
  $I.annote("AiMetricsOtlpExportResult", {
    description: "Safe counts returned after emitting redacted AI metrics spans to the active tracer.",
  })
) {}

class LatestIngestRunRow extends S.Class<LatestIngestRunRow>($I`LatestIngestRunRow`)(
  {
    ingestRunId: S.String,
  },
  $I.annote("LatestIngestRunRow", {
    description: "Latest AI metrics ingest run selected from derived DuckDB storage.",
  })
) {}

class AiMetricsOtlpTurnExportRow extends S.Class<AiMetricsOtlpTurnExportRow>($I`AiMetricsOtlpTurnExportRow`)(
  {
    agentNicknameHash: S.NullOr(S.String),
    agentRoleHash: S.NullOr(S.String),
    agentSessionId: S.String,
    configSnapshotId: S.String,
    eventName: S.String,
    forkedFromIdHash: S.NullOr(S.String),
    ingestRunId: S.String,
    lineNumber: S.Finite,
    parentSessionIdHash: S.NullOr(S.String),
    parentThreadIdHash: S.NullOr(S.String),
    rawEventHash: S.String,
    sessionIdHash: S.NullOr(S.String),
    sourceKind: AiMetricsTranscriptSource,
    sourcePathHash: S.String,
    sourceRole: AiMetricsSourceRole,
    threadSpawn: S.NullOr(S.Boolean),
    timestamp: S.NullOr(S.String),
    turnId: S.String,
  },
  $I.annote("AiMetricsOtlpTurnExportRow", {
    description: "DuckDB turn row shape projected into redacted AI metrics OTLP spans.",
  })
) {}

const decodeLatestRows = S.decodeUnknownEffect(S.Array(LatestIngestRunRow));
const decodeTurnRows = S.decodeUnknownEffect(S.Array(AiMetricsOtlpTurnExportRow));
const encodeOtlpExportJson = S.encodeUnknownEffect(S.fromJsonString(AiMetricsOtlpExportResult));

const exportFailure = (message: string, cause: unknown): AiMetricsOtlpExportError =>
  AiMetricsOtlpExportError.make({ cause, message });

const unknownMetadata = "unknown";

const providerFor = (row: AiMetricsOtlpTurnExportRow): string => {
  if (row.sourceKind === AiMetricsTranscriptSource.Enum.openclaw) {
    return "openclaw";
  }

  return unknownMetadata;
};

const toolNameFor = (row: AiMetricsOtlpTurnExportRow): O.Option<string> =>
  pipe(row.eventName, Str.toLowerCase, Str.includes("tool")) ? O.some(row.eventName) : O.none();

const allowlistedAttributes: (
  attributes: Record<string, AiMetricsOtlpAttributeValue>
) => Record<string, AiMetricsOtlpAttributeValue> = flow(
  R.filter((_value, key) => A.contains(AI_METRICS_OTLP_ATTRIBUTE_ALLOWLIST as ReadonlyArray<string>, key))
);

const llmEventNameFragments = [
  "assistant",
  "message",
  "model",
  "llm",
  "api_request",
  "completion",
  "response",
] as const;

const openInferenceSpanKindFor = (row: AiMetricsOtlpTurnExportRow): string => {
  if (O.isSome(toolNameFor(row))) {
    return "TOOL";
  }

  const eventName = Str.toLowerCase(row.eventName);
  return A.some(llmEventNameFragments, (fragment) => Str.includes(fragment)(eventName)) ? "LLM" : "CHAIN";
};

const resolveIngestRunId = Effect.fn("AiMetrics.otlp.resolveIngestRunId")(function* (ingestRunId: string | undefined) {
  if (ingestRunId !== undefined && Str.trim(ingestRunId) !== "latest") {
    return ingestRunId;
  }

  const duckdb = yield* DuckDb;
  const rows = yield* duckdb
    .query(
      `SELECT ingest_run_id AS "ingestRunId"
       FROM ai_metrics_ingest_runs
       ORDER BY started_at_epoch_ms DESC
       LIMIT 1`
    )
    .pipe(Effect.mapError((cause) => exportFailure("Failed to select the latest AI metrics ingest run.", cause)));
  const decoded = yield* decodeLatestRows(rows).pipe(
    Effect.mapError((cause) => exportFailure("Failed to decode the latest AI metrics ingest run row.", cause))
  );
  const latest = A.head(decoded);

  if (O.isNone(latest)) {
    return yield* exportFailure("No AI metrics ingest runs are available for OTLP export.", {
      ingestRunId: ingestRunId ?? "latest",
    });
  }

  return latest.value.ingestRunId;
});

// Selects every turn that has not yet been exported, rather than the turns belonging
// to one ingest run. Run-scoping silently dropped work: a run that committed turns and
// then died before exporting left them attached to a run the exporter would never
// revisit. Draining on the watermark instead makes a failed export self-healing --
// the next run simply picks the turns up.
const readTurnRows = Effect.fn("AiMetrics.otlp.readTurnRows")(function* () {
  const duckdb = yield* DuckDb;
  const rows = yield* duckdb
    .query(
      `SELECT
         t.turn_id AS "turnId",
         t.ingest_run_id AS "ingestRunId",
         t.agent_session_id AS "agentSessionId",
         t.source_kind AS "sourceKind",
         t.source_path_hash AS "sourcePathHash",
         COALESCE(t.source_role, s.source_role, 'primary') AS "sourceRole",
         t.line_number AS "lineNumber",
         t.event_name AS "eventName",
         t.raw_event_hash AS "rawEventHash",
         t.timestamp AS "timestamp",
         s.session_id_hash AS "sessionIdHash",
         s.parent_session_id_hash AS "parentSessionIdHash",
         s.parent_thread_id_hash AS "parentThreadIdHash",
         s.forked_from_id_hash AS "forkedFromIdHash",
         s.thread_spawn AS "threadSpawn",
         s.agent_role_hash AS "agentRoleHash",
         s.agent_nickname_hash AS "agentNicknameHash",
         s.config_snapshot_id AS "configSnapshotId"
       FROM ai_metrics_turns t
       JOIN ai_metrics_sessions s ON s.agent_session_id = t.agent_session_id
       WHERE t.otlp_exported_at_epoch_ms IS NULL
       ORDER BY t.agent_session_id, t.line_number`
    )
    .pipe(Effect.mapError((cause) => exportFailure("Failed to read AI metrics turn rows for OTLP export.", cause)));

  return yield* decodeTurnRows(rows).pipe(
    Effect.mapError((cause) => exportFailure("Failed to decode AI metrics turn rows for OTLP export.", cause))
  );
});

const sessionProjection = (row: AiMetricsOtlpTurnExportRow): AiMetricsOtlpSpanProjection =>
  AiMetricsOtlpSpanProjection.make({
    attributes: allowlistedAttributes({
      ...O.getSomesStruct({
        "ai_metrics.agent_nickname_hash": O.fromNullishOr(row.agentNicknameHash),
        "ai_metrics.agent_role_hash": O.fromNullishOr(row.agentRoleHash),
        "ai_metrics.forked_from_id_hash": O.fromNullishOr(row.forkedFromIdHash),
        "ai_metrics.parent_session_id_hash": O.fromNullishOr(row.parentSessionIdHash),
        "ai_metrics.parent_thread_id_hash": O.fromNullishOr(row.parentThreadIdHash),
        "ai_metrics.session_id_hash": O.fromNullishOr(row.sessionIdHash),
      }),
      ...(row.threadSpawn === null ? {} : { "ai_metrics.thread_spawn": row.threadSpawn }),
      "ai_metrics.config_snapshot_id": row.configSnapshotId,
      "ai_metrics.ingest_run_id": row.ingestRunId,
      "ai_metrics.source_kind": row.sourceKind,
      "ai_metrics.source_path_hash": row.sourcePathHash,
      "ai_metrics.source_role": row.sourceRole,
      "openinference.span.kind": "AGENT",
      "session.id": row.agentSessionId,
    }),
    spanName: "ai_metrics.agent.session",
  });

const turnProjection = (row: AiMetricsOtlpTurnExportRow): AiMetricsOtlpSpanProjection => {
  const toolName = toolNameFor(row);

  return AiMetricsOtlpSpanProjection.make({
    attributes: allowlistedAttributes({
      ...O.getSomesStruct({
        "ai_metrics.timestamp": O.fromNullishOr(row.timestamp),
        "ai_metrics.tool_name": toolName,
        "tool.name": toolName,
      }),
      "ai_metrics.config_snapshot_id": row.configSnapshotId,
      "ai_metrics.event_name": row.eventName,
      "ai_metrics.ingest_run_id": row.ingestRunId,
      "ai_metrics.line_number": row.lineNumber,
      "ai_metrics.provider": providerFor(row),
      "ai_metrics.raw_event_hash": row.rawEventHash,
      "ai_metrics.source_kind": row.sourceKind,
      "ai_metrics.source_path_hash": row.sourcePathHash,
      "ai_metrics.source_role": row.sourceRole,
      "ai_metrics.turn_id": row.turnId,
      "openinference.span.kind": openInferenceSpanKindFor(row),
      "session.id": row.agentSessionId,
    }),
    spanName: "ai_metrics.agent.turn",
  });
};

const spanProjectionsFor = (
  ingestRunId: string,
  rows: ReadonlyArray<AiMetricsOtlpTurnExportRow>
): AiMetricsOtlpSpanProjectionBatch => {
  const sessionRows = pipe(
    rows,
    A.dedupeWith((left, right) => left.agentSessionId === right.agentSessionId)
  );
  const sessionProjections = A.map(sessionRows, sessionProjection);
  const turnProjections = A.map(rows, turnProjection);

  return AiMetricsOtlpSpanProjectionBatch.make({
    ingestRunId,
    projections: A.appendAll(sessionProjections, turnProjections),
    sessionSpanCount: A.length(sessionProjections),
    turnIds: A.map(rows, (row) => row.turnId),
    turnSpanCount: A.length(turnProjections),
  });
};

/**
 * Read derived DuckDB rows and build redacted OTLP span projections.
 *
 * **Example** (Construct AiMetricsOtlpExportInput)
 *
 * ```ts
 * import {
 *   AiMetricsOtlpEndpointSpec,
 *   AiMetricsOtlpExportInput,
 *   readAiMetricsOtlpSpanProjections
 * } from "@beep/repo-ai-metrics"
 * import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb"
 * import { Effect } from "effect"
 * const input = AiMetricsOtlpExportInput.make({
 *   duckDbPath: ".beep/ai-metrics/derived/ai-metrics.duckdb",
 *   endpoint: AiMetricsOtlpEndpointSpec.make({
 *     baseUrl: "http://127.0.0.1:6006",
 *     protocol: "http/protobuf",
 *     resourceAttributes: {},
 *     signalScope: "traces_only",
 *     traceUrl: "http://127.0.0.1:6006/projects/default/traces"
 *   }),
 *   target: "local"
 * })
 * const program = readAiMetricsOtlpSpanProjections(input).pipe(
 *   Effect.provide(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: input.duckDbPath })))
 * )
 * console.log(program)
 * ```
 *
 * @effects Reads derived session and turn rows from the configured DuckDB database.
 * @category services
 * @since 0.0.0
 */
export const readAiMetricsOtlpSpanProjections: (
  input: AiMetricsOtlpExportInput
) => Effect.Effect<AiMetricsOtlpSpanProjectionBatch, AiMetricsOtlpExportError, DuckDb> = Effect.fn(
  "AiMetrics.readAiMetricsOtlpSpanProjections"
)(function* (input) {
  const ingestRunId = yield* resolveIngestRunId(input.ingestRunId);
  const rows = yield* readTurnRows();

  return spanProjectionsFor(ingestRunId, rows);
});

/**
 * Close the OTLP export watermark on the turns a batch successfully emitted.
 *
 * **When to use**
 *
 * Use when an export attempt has already succeeded, never before it. Turns stay
 * unmarked until their spans are actually away, so a crash or a rejected export simply
 * leaves them for the next run to pick up instead of stranding them.
 *
 * **Gotchas**
 *
 * Marking is keyed on the batch's own `turnIds` rather than re-running the
 * `otlp_exported_at_epoch_ms IS NULL` predicate, so turns ingested after the batch was
 * read are not silently marked as exported.
 *
 * **Example** (Mark a batch as exported)
 *
 * ```ts
 * import { markAiMetricsOtlpTurnsExported } from "@beep/repo-ai-metrics"
 *
 * const program = markAiMetricsOtlpTurnsExported(["turn-1", "turn-2"])
 * console.log(program)
 * ```
 *
 * @effects Updates `otlp_exported_at_epoch_ms` on the named rows in the derived DuckDB store.
 * @category services
 * @since 0.0.0
 */
export const markAiMetricsOtlpTurnsExported: (
  turnIds: ReadonlyArray<string>
) => Effect.Effect<void, AiMetricsOtlpExportError, DuckDb> = Effect.fn("AiMetrics.markAiMetricsOtlpTurnsExported")(
  function* (turnIds) {
    if (!A.isReadonlyArrayNonEmpty(turnIds)) {
      return;
    }
    const duckdb = yield* DuckDb;
    const exportedAtEpochMillis = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
    // DuckDB parameters are scalars, so the id list becomes numbered placeholders.
    // Chunked because a run can carry tens of thousands of turns and a single
    // statement with that many bindings is not worth risking.
    yield* Effect.forEach(
      A.chunksOf(turnIds, 500),
      Effect.fnUntraced(function* (chunk) {
        const placeholders = A.map(chunk, (_, index) => `$turnId${index}`);
        const bindings = R.fromEntries(A.map(chunk, (turnId, index) => [`turnId${index}`, turnId] as const));
        yield* duckdb
          .run(
            `UPDATE ai_metrics_turns
         SET otlp_exported_at_epoch_ms = $exportedAtEpochMillis
         WHERE turn_id IN (${A.join(placeholders, ", ")})`,
            { exportedAtEpochMillis, ...bindings }
          )
          .pipe(
            Effect.mapError((cause) =>
              AiMetricsOtlpExportError.make({
                cause,
                message: "Failed to record the AI metrics OTLP export watermark.",
              })
            )
          );
      }),
      { discard: true }
    );
  }
);

const emitSpanProjection = Effect.fn("AiMetrics.otlp.emitSpanProjection")((projection: AiMetricsOtlpSpanProjection) =>
  Effect.void.pipe(
    Effect.withSpan(projection.spanName, {
      attributes: projection.attributes,
    })
  )
);

const withOtlpExportSpan =
  (input: AiMetricsOtlpExportInput) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    effect.pipe(
      Effect.withSpan("repo_ai_metrics.otlp.export", {
        attributes: {
          "ai_metrics.otlp.signal_scope": input.endpoint.signalScope,
          "ai_metrics.otlp.trace_url": input.endpoint.traceUrl,
          "ai_metrics.target": input.target,
        },
      })
    );

const runAiMetricsOtlpProjectionBatchExportUntraced: (
  input: AiMetricsOtlpExportInput,
  batch: AiMetricsOtlpSpanProjectionBatch
) => Effect.Effect<AiMetricsOtlpExportResult> = Effect.fn("AiMetrics.runAiMetricsOtlpProjectionBatchExport.untraced")(
  function* (input, batch) {
    yield* Effect.forEach(batch.projections, emitSpanProjection, { discard: true, concurrency: 8 });

    return AiMetricsOtlpExportResult.make({
      endpointTraceUrl: input.endpoint.traceUrl,
      ingestRunId: batch.ingestRunId,
      sessionSpanCount: batch.sessionSpanCount,
      spanCount: A.length(batch.projections),
      target: input.target,
      turnSpanCount: batch.turnSpanCount,
    });
  }
);

/**
 * Emit a pre-resolved redacted AI metrics OTLP span projection batch.
 *
 * **Example** (Construct AiMetricsOtlpExportInput)
 *
 * ```ts
 * import {
 *   AiMetricsOtlpEndpointSpec,
 *   AiMetricsOtlpExportInput,
 *   AiMetricsOtlpSpanProjectionBatch,
 *   runAiMetricsOtlpProjectionBatchExport
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const input = AiMetricsOtlpExportInput.make({
 *   duckDbPath: ".beep/ai-metrics/derived/ai-metrics.duckdb",
 *   endpoint: AiMetricsOtlpEndpointSpec.make({
 *     baseUrl: "http://127.0.0.1:6006",
 *     protocol: "http/protobuf",
 *     resourceAttributes: {},
 *     signalScope: "traces_only",
 *     traceUrl: "http://127.0.0.1:6006/projects/default/traces"
 *   }),
 *   target: "local"
 * })
 * const batch = AiMetricsOtlpSpanProjectionBatch.make({
 *   ingestRunId: "forwarder-1",
 *   projections: [],
 *   sessionSpanCount: 0,
 *   turnIds: [],
 *   turnSpanCount: 0
 * })
 * const exported = Effect.runPromise(runAiMetricsOtlpProjectionBatchExport(input, batch))
 * console.log(exported)
 * ```
 *
 * @effects Emits one Effect span per projection into the active tracer.
 * @category services
 * @since 0.0.0
 */
export const runAiMetricsOtlpProjectionBatchExport: {
  (input: AiMetricsOtlpExportInput, batch: AiMetricsOtlpSpanProjectionBatch): Effect.Effect<AiMetricsOtlpExportResult>;
  (
    batch: AiMetricsOtlpSpanProjectionBatch
  ): (input: AiMetricsOtlpExportInput) => Effect.Effect<AiMetricsOtlpExportResult>;
} = dual(2, (input: AiMetricsOtlpExportInput, batch: AiMetricsOtlpSpanProjectionBatch) =>
  runAiMetricsOtlpProjectionBatchExportUntraced(input, batch).pipe(withOtlpExportSpan(input))
);

/**
 * Emit redacted AI metrics derived spans through the active Effect tracer.
 *
 * **Example** (Construct AiMetricsOtlpExportInput)
 *
 * ```ts
 * import {
 *   AiMetricsOtlpEndpointSpec,
 *   AiMetricsOtlpExportInput,
 *   runAiMetricsOtlpExport
 * } from "@beep/repo-ai-metrics"
 * import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb"
 * import { Effect } from "effect"
 * const input = AiMetricsOtlpExportInput.make({
 *   duckDbPath: ".beep/ai-metrics/derived/ai-metrics.duckdb",
 *   endpoint: AiMetricsOtlpEndpointSpec.make({
 *     baseUrl: "http://127.0.0.1:6006",
 *     protocol: "http/protobuf",
 *     resourceAttributes: {},
 *     signalScope: "traces_only",
 *     traceUrl: "http://127.0.0.1:6006/projects/default/traces"
 *   }),
 *   target: "local"
 * })
 * const program = runAiMetricsOtlpExport(input).pipe(
 *   Effect.provide(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: input.duckDbPath })))
 * )
 * console.log(program)
 * ```
 *
 * @effects Reads derived DuckDB rows and emits redacted Effect spans into the active tracer.
 * @category services
 * @since 0.0.0
 */
export const runAiMetricsOtlpExport: (
  input: AiMetricsOtlpExportInput
) => Effect.Effect<AiMetricsOtlpExportResult, AiMetricsOtlpExportError, DuckDb> = Effect.fn(
  "AiMetrics.runAiMetricsOtlpExport"
)(
  function* (input) {
    const batch = yield* readAiMetricsOtlpSpanProjections(input);

    return yield* runAiMetricsOtlpProjectionBatchExportUntraced(input, batch);
  },
  (effect, input) => effect.pipe(withOtlpExportSpan(input))
);

/**
 * Render an OTLP export result as JSON.
 *
 * **Example** (Construct AiMetricsOtlpExportResult)
 *
 * ```ts
 * import { AiMetricsOtlpExportResult, otlpExportResultToJson } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const json = Effect.runPromise(
 *   otlpExportResultToJson(
 *     AiMetricsOtlpExportResult.make({
 *       endpointTraceUrl: "http://127.0.0.1:6006/projects/default/traces",
 *       ingestRunId: "forwarder-1",
 *       sessionSpanCount: 0,
 *       spanCount: 0,
 *       target: "local",
 *       turnSpanCount: 0
 *     })
 *   )
 * )
 * console.log(json)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const otlpExportResultToJson: (
  result: AiMetricsOtlpExportResult
) => Effect.Effect<string, AiMetricsOtlpExportError> = Effect.fn("AiMetrics.otlpExportResultToJson")(
  function* (result) {
    return yield* encodeOtlpExportJson(result).pipe(
      Effect.mapError((cause) => exportFailure("Failed to encode AI metrics OTLP export result as JSON.", cause))
    );
  }
);
