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
import { SpanKind, SpanStatusCode, TraceFlags } from "@opentelemetry/api";
import { ExportResultCode } from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { Context, Effect, flow, Layer, pipe } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ensureAiMetricsDerivedStorage } from "./derived-storage.ts";
import {
  AiMetricsDeployTarget,
  AiMetricsOtlpEndpointSpec,
  AiMetricsSourceRole,
  AiMetricsTranscriptSource,
} from "./models.ts";
import { hashPublicTextSha256 } from "./privacy.ts";
import type { HrTime } from "@opentelemetry/api";
import type { Resource } from "@opentelemetry/resources";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";

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
 * Input for exporting every derived turn still awaiting OTLP export.
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
    target: AiMetricsDeployTarget,
  },
  $I.annote("AiMetricsOtlpExportInput", {
    description: "DuckDB source and OTLP endpoint for one redacted AI metrics export run.",
  })
) {}

/**
 * One span projection ready to be delivered to an OTLP collector.
 *
 * **Details**
 *
 * The trace and span ids are content-addressed rather than random, so the same
 * derived row always projects to the same span identity. That is what makes
 * re-delivery harmless: a collector enforcing span-id uniqueness — Phoenix has
 * `uq_spans_span_id` — collapses a repeat send into the row it already stored.
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
 *   spanId: "1122334455667788",
 *   spanName: "ai_metrics.turn",
 *   traceId: "0123456789abcdef0123456789abcdef"
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
    /**
     * Set on turn spans to the enclosing session span, absent on session spans
     * themselves, so one agent session arrives as one trace instead of as many
     * unrelated roots.
     */
    parentSpanId: S.optionalKey(S.String),
    spanId: S.String,
    spanName: S.String,
    traceId: S.String,
  },
  $I.annote("AiMetricsOtlpSpanProjection", {
    description: "Redacted span identity, name, and bounded attributes derived from AI metrics DuckDB storage.",
  })
) {}

/**
 * Span projections for every derived turn still awaiting OTLP export.
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
 *   projections: [
 *     AiMetricsOtlpSpanProjection.make({
 *       attributes: { "ai_metrics.event_name": "codex.event_msg" },
 *       spanId: "1122334455667788",
 *       spanName: "ai_metrics.turn",
 *       traceId: "0123456789abcdef0123456789abcdef"
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
    description: "Redacted OTLP span projections for every AI metrics turn still awaiting export.",
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
    sessionSpanCount: S.Finite,
    spanCount: S.Finite,
    target: AiMetricsDeployTarget,
    turnSpanCount: S.Finite,
  },
  $I.annote("AiMetricsOtlpExportResult", {
    description: "Safe counts returned after emitting redacted AI metrics spans to the active tracer.",
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

const OTLP_TRACE_ID_HEX_LENGTH = 32;
const OTLP_SPAN_ID_HEX_LENGTH = 16;

// The OTLP wire format spells "no id" as all zero bytes, so a span carrying an
// all-zero trace or span id is discarded by the collector rather than stored. A
// SHA-256 prefix will not realistically be all zeros, but a span that vanishes
// without an error is not a failure mode worth leaving open.
const otlpIdFrom = (digest: string, hexLength: number): string => {
  const candidate = Str.takeLeft(digest, hexLength);
  return candidate === Str.repeat(hexLength)("0") ? `${Str.repeat(hexLength - 1)("0")}1` : candidate;
};

const otlpIdFor = Effect.fnUntraced(function* (seed: string, hexLength: number) {
  const digest = yield* hashPublicTextSha256(seed).pipe(
    Effect.mapError((cause) => exportFailure("Failed to derive a deterministic AI metrics OTLP span id.", cause))
  );

  return otlpIdFrom(digest, hexLength);
});

// Seeded from the transcript, NOT read off `agent_session_id`. That column is now
// content-addressed too, but a store migrated in place is not guaranteed to be uniform:
// until `ai-metrics-agent-session-id-v2` has run, rows still carry per-run ids. Deriving
// trace identity from the transcript keeps a half-migrated store tracing correctly, and
// keeps trace ids stable across the migration itself.
//
// This seed also carries `sourceRole`, which the session row key deliberately does not.
// They are allowed to diverge: dropping it here would change the trace id of every
// transcript and detach future spans from traces Phoenix already holds, which costs far
// more than the rare role flip it would tidy up.
const sessionSeed = (row: AiMetricsOtlpTurnExportRow): string =>
  `${row.sourceKind}\u0000${row.sourceRole}\u0000${row.sourcePathHash}`;

// Seeds are prefixed so a session seed and a turn id that happen to share text cannot
// collide across id kinds, and so a trace id is never the same digest as a span id.
const traceIdFor = (row: AiMetricsOtlpTurnExportRow) =>
  otlpIdFor(`trace:${sessionSeed(row)}`, OTLP_TRACE_ID_HEX_LENGTH);
const sessionSpanIdFor = (row: AiMetricsOtlpTurnExportRow) =>
  otlpIdFor(`session:${sessionSeed(row)}`, OTLP_SPAN_ID_HEX_LENGTH);
const turnSpanIdFor = (turnId: string) => otlpIdFor(`turn:${turnId}`, OTLP_SPAN_ID_HEX_LENGTH);

type AiMetricsOtlpSessionIdentity = {
  readonly sessionSpanId: string;
  readonly traceId: string;
};

const sessionProjection = (
  row: AiMetricsOtlpTurnExportRow,
  identity: AiMetricsOtlpSessionIdentity
): AiMetricsOtlpSpanProjection =>
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
    spanId: identity.sessionSpanId,
    spanName: "ai_metrics.agent.session",
    traceId: identity.traceId,
  });

const turnProjection = Effect.fnUntraced(function* (
  row: AiMetricsOtlpTurnExportRow,
  identity: AiMetricsOtlpSessionIdentity
) {
  const toolName = toolNameFor(row);
  const spanId = yield* turnSpanIdFor(row.turnId);

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
    parentSpanId: identity.sessionSpanId,
    spanId,
    spanName: "ai_metrics.agent.turn",
    traceId: identity.traceId,
  });
});

const sessionGroupProjections = Effect.fnUntraced(function* (
  rows: A.NonEmptyReadonlyArray<AiMetricsOtlpTurnExportRow>
) {
  const head = A.headNonEmpty(rows);
  const identity: AiMetricsOtlpSessionIdentity = {
    sessionSpanId: yield* sessionSpanIdFor(head),
    traceId: yield* traceIdFor(head),
  };

  return {
    session: sessionProjection(head, identity),
    turns: yield* Effect.forEach(rows, (row) => turnProjection(row, identity)),
  };
});

// Grouped by transcript rather than mapped row-by-row so each session's trace and span
// ids are digested once and shared by every turn beneath it. A run can carry tens of
// thousands of turns, and `crypto.subtle` is not free.
//
// The key is the content seed, not `agent_session_id`. Grouping must not depend on that
// column, because a store migrated in place can still hold legacy per-run ids alongside
// content-addressed ones until `ai-metrics-agent-session-id-v2` has run. On such a store,
// grouping by the column would emit one session projection per legacy row, all carrying
// the same content-addressed span id -- and a single OTLP request containing a duplicate
// span id is one the collector may reject outright rather than deduplicate.
const spanProjectionsFor = Effect.fnUntraced(function* (rows: ReadonlyArray<AiMetricsOtlpTurnExportRow>) {
  const groups = yield* Effect.forEach(R.values(A.groupBy(rows, sessionSeed)), sessionGroupProjections);
  const sessionProjections = A.map(groups, (group) => group.session);
  const turnProjections = A.flatMap(groups, (group) => group.turns);

  return AiMetricsOtlpSpanProjectionBatch.make({
    // Keep each session next to its turns. If all session roots lead the array, a
    // backlog with 512+ sessions can acknowledge a session-only chunk without closing
    // a single turn watermark, so every retry starts from the same prefix.
    projections: A.flatMap(groups, (group) => A.prepend(group.turns, group.session)),
    sessionSpanCount: A.length(sessionProjections),
    turnIds: A.map(rows, (row) => row.turnId),
    turnSpanCount: A.length(turnProjections),
  });
});

/**
 * Read derived DuckDB rows and build redacted OTLP span projections.
 *
 * **Example** (Read every pending projection)
 *
 * ```ts
 * import { readAiMetricsOtlpSpanProjections } from "@beep/repo-ai-metrics"
 * import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb"
 * import { Effect } from "effect"
 * const program = readAiMetricsOtlpSpanProjections.pipe(
 *   Effect.provide(
 *     DuckDb.makeNodeLayer(
 *       DuckDbConnectionOptions.make({ databasePath: ".beep/ai-metrics/derived/ai-metrics.duckdb" })
 *     )
 *   )
 * )
 * console.log(program)
 * ```
 *
 * @effects Reads derived session and turn rows from the configured DuckDB database.
 * @category services
 * @since 0.0.0
 */
export const readAiMetricsOtlpSpanProjections: Effect.Effect<
  AiMetricsOtlpSpanProjectionBatch,
  AiMetricsOtlpExportError,
  DuckDb
> = Effect.gen(function* () {
  // The export path has to migrate the store itself. It reads
  // `otlp_exported_at_epoch_ms`, a column added by the schema migration rather than by
  // the base DDL, and the only other caller of the migration is the ingest write. A
  // store written by an earlier release therefore fails this query with a bare DuckDB
  // binder error until some unrelated forwarder run happens to migrate it.
  yield* ensureAiMetricsDerivedStorage.pipe(
    Effect.mapError((cause) =>
      exportFailure(
        "Failed to prepare the AI metrics derived DuckDB store for OTLP export; run an ingest first if it does not exist yet.",
        cause
      )
    )
  );
  const rows = yield* readTurnRows();

  return yield* spanProjectionsFor(rows);
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

const AI_METRICS_OTLP_SCOPE_NAME = "@beep/repo-ai-metrics";
const AI_METRICS_OTLP_SERVICE_NAME = "beep-ai-metrics";
const AI_METRICS_OTLP_SERVICE_VERSION = "0.0.0";
// The OpenTelemetry SDK's own default batch size. Nothing here needs a different one,
// and matching it keeps request sizes in territory collectors are tuned for.
const AI_METRICS_OTLP_MAX_EXPORT_BATCH_SIZE = 512;

// Mirrors what `layerNodeSdkServerTraces` used to put on the wire for this exporter,
// so the resource identity Phoenix already groups these spans under does not move.
const resourceFor = (input: AiMetricsOtlpExportInput): Resource =>
  resourceFromAttributes({
    deployment_environment: input.target,
    ...input.endpoint.resourceAttributes,
    "service.name": AI_METRICS_OTLP_SERVICE_NAME,
    "service.version": AI_METRICS_OTLP_SERVICE_VERSION,
  });

const hrTimeFrom = (epochMillis: number): HrTime => [
  Math.trunc(epochMillis / 1000),
  Math.round((epochMillis % 1000) * 1_000_000),
];

const readableSpanFor =
  (resource: Resource, timestamp: HrTime) =>
  (projection: AiMetricsOtlpSpanProjection): ReadableSpan => ({
    attributes: projection.attributes,
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
    duration: [0, 0],
    ended: true,
    endTime: timestamp,
    events: [],
    instrumentationScope: { name: AI_METRICS_OTLP_SCOPE_NAME, version: AI_METRICS_OTLP_SERVICE_VERSION },
    kind: SpanKind.INTERNAL,
    links: [],
    name: projection.spanName,
    ...O.getSomesStruct({
      parentSpanContext: pipe(
        O.fromUndefinedOr(projection.parentSpanId),
        O.map((parentSpanId) => ({
          spanId: parentSpanId,
          traceFlags: TraceFlags.SAMPLED,
          traceId: projection.traceId,
        }))
      ),
    }),
    resource,
    spanContext: () => ({
      spanId: projection.spanId,
      traceFlags: TraceFlags.SAMPLED,
      traceId: projection.traceId,
    }),
    startTime: timestamp,
    status: { code: SpanStatusCode.UNSET },
  });

// The exporter callback is the only real delivery confirmation available. Effect
// tracing cannot supply one: span emission there is asynchronous and fire-and-forget,
// so a batch the collector rejected is indistinguishable from one it stored.
const deliverSpans = (
  exporter: OTLPTraceExporter,
  spans: ReadonlyArray<ReadableSpan>
): Effect.Effect<void, AiMetricsOtlpExportError> =>
  Effect.callback<void, AiMetricsOtlpExportError>((resume) => {
    exporter.export([...spans], (result) =>
      resume(
        result.code === ExportResultCode.SUCCESS
          ? Effect.void
          : Effect.fail(
              exportFailure(
                "The AI metrics OTLP collector did not accept the exported spans.",
                result.error ?? { exportResultCode: result.code }
              )
            )
      )
    );
  });

const sendThroughOtlpProtoExporter = Effect.fnUntraced(function* (
  input: AiMetricsOtlpExportInput,
  projections: ReadonlyArray<AiMetricsOtlpSpanProjection>
) {
  if (!A.isReadonlyArrayNonEmpty(projections)) {
    return;
  }

  const resource = resourceFor(input);
  const timestamp = hrTimeFrom(yield* Effect.clockWith((clock) => clock.currentTimeMillis));
  const toReadableSpan = readableSpanFor(resource, timestamp);

  yield* Effect.acquireUseRelease(
    // Protobuf, not JSON: Phoenix answers OTLP/JSON with HTTP 415
    // ("Unsupported content type: application/json").
    Effect.sync(() => new OTLPTraceExporter({ url: input.endpoint.traceUrl })),
    (exporter) => deliverSpans(exporter, A.map(projections, toReadableSpan)),
    (exporter) => Effect.promise(() => exporter.shutdown()).pipe(Effect.ignore)
  );
});

/**
 * Delivery contract for redacted AI metrics OTLP spans.
 *
 * **Example** (Type a stub sender)
 *
 * ```ts
 * import type { AiMetricsOtlpSpanSenderShape } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const sender: AiMetricsOtlpSpanSenderShape = { send: () => Effect.void }
 * console.log(sender)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface AiMetricsOtlpSpanSenderShape {
  readonly send: (
    input: AiMetricsOtlpExportInput,
    projections: ReadonlyArray<AiMetricsOtlpSpanProjection>
  ) => Effect.Effect<void, AiMetricsOtlpExportError>;
}

/**
 * Effect service that delivers redacted AI metrics spans to an OTLP collector.
 *
 * **When to use**
 *
 * Use when a caller needs delivery confirmation rather than best-effort emission.
 * Failure is a typed error, so the export watermark can only close on a batch the
 * collector actually acknowledged.
 *
 * **Details**
 *
 * Delivery is at-least-once. Span ids are content-addressed, so a redelivered span
 * carries the id the collector already holds and is collapsed on arrival — Phoenix
 * enforces `uq_spans_span_id`. Correctness therefore does not depend on the
 * watermark being perfectly accurate; the watermark only keeps redundant sends rare.
 *
 * **Example** (Provide the live sender)
 *
 * ```ts
 * import { AiMetricsOtlpSpanSender } from "@beep/repo-ai-metrics"
 *
 * const layer = AiMetricsOtlpSpanSender.layer
 * console.log(layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class AiMetricsOtlpSpanSender extends Context.Service<AiMetricsOtlpSpanSender, AiMetricsOtlpSpanSenderShape>()(
  $I`AiMetricsOtlpSpanSender`
) {
  /**
   * Live sender backed by the OTLP protobuf trace exporter.
   *
   * **Example** (Provide the live sender)
   *
   * ```ts
   * import { AiMetricsOtlpSpanSender } from "@beep/repo-ai-metrics"
   *
   * const layer = AiMetricsOtlpSpanSender.layer
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<AiMetricsOtlpSpanSender> = Layer.succeed(AiMetricsOtlpSpanSender)(
    AiMetricsOtlpSpanSender.of({ send: sendThroughOtlpProtoExporter })
  );
}

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
  batch: AiMetricsOtlpSpanProjectionBatch,
  onChunkDelivered: (
    projections: ReadonlyArray<AiMetricsOtlpSpanProjection>
  ) => Effect.Effect<void, AiMetricsOtlpExportError>
) => Effect.Effect<AiMetricsOtlpExportResult, AiMetricsOtlpExportError, AiMetricsOtlpSpanSender> = Effect.fn(
  "AiMetrics.runAiMetricsOtlpProjectionBatchExport.untraced"
)(function* (input, batch, onChunkDelivered) {
  const sender = yield* AiMetricsOtlpSpanSender;
  // The orchestrator owns both the chunk boundary and its durable acknowledgement.
  // A pluggable sender therefore cannot report success while silently ignoring the
  // checkpoint callback: successful delivery returns here before the watermark closes.
  yield* Effect.forEach(
    A.chunksOf(batch.projections, AI_METRICS_OTLP_MAX_EXPORT_BATCH_SIZE),
    Effect.fnUntraced(function* (chunk) {
      yield* sender.send(input, chunk);
      yield* onChunkDelivered(chunk);
    }),
    { discard: true }
  );

  return AiMetricsOtlpExportResult.make({
    endpointTraceUrl: input.endpoint.traceUrl,
    sessionSpanCount: batch.sessionSpanCount,
    spanCount: A.length(batch.projections),
    target: input.target,
    turnSpanCount: batch.turnSpanCount,
  });
});

/**
 * Deliver a pre-resolved redacted AI metrics OTLP span projection batch.
 *
 * **Gotchas**
 *
 * This does not close the export watermark. Callers that read their own batch own
 * the marking too; prefer {@link runAiMetricsOtlpExport}, which reads, delivers, and
 * marks as one unit and cannot be half-used.
 *
 * **Example** (Construct AiMetricsOtlpExportInput)
 *
 * ```ts
 * import {
 *   AiMetricsOtlpEndpointSpec,
 *   AiMetricsOtlpExportInput,
 *   AiMetricsOtlpSpanProjectionBatch,
 *   AiMetricsOtlpSpanSender,
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
 *   projections: [],
 *   sessionSpanCount: 0,
 *   turnIds: [],
 *   turnSpanCount: 0
 * })
 * const exported = Effect.runPromise(
 *   runAiMetricsOtlpProjectionBatchExport(input, batch).pipe(Effect.provide(AiMetricsOtlpSpanSender.layer))
 * )
 * console.log(exported)
 * ```
 *
 * @effects Delivers the batch to the configured OTLP collector over protobuf.
 * @category services
 * @since 0.0.0
 */
export const runAiMetricsOtlpProjectionBatchExport: {
  (
    input: AiMetricsOtlpExportInput,
    batch: AiMetricsOtlpSpanProjectionBatch
  ): Effect.Effect<AiMetricsOtlpExportResult, AiMetricsOtlpExportError, AiMetricsOtlpSpanSender>;
  (
    batch: AiMetricsOtlpSpanProjectionBatch
  ): (
    input: AiMetricsOtlpExportInput
  ) => Effect.Effect<AiMetricsOtlpExportResult, AiMetricsOtlpExportError, AiMetricsOtlpSpanSender>;
} = dual(2, (input: AiMetricsOtlpExportInput, batch: AiMetricsOtlpSpanProjectionBatch) =>
  runAiMetricsOtlpProjectionBatchExportUntraced(input, batch, () => Effect.void).pipe(withOtlpExportSpan(input))
);

const turnIdsFor: (projections: ReadonlyArray<AiMetricsOtlpSpanProjection>) => ReadonlyArray<string> = flow(
  A.map((projection) => pipe(O.fromNullishOr(projection.attributes["ai_metrics.turn_id"]), O.filter(P.isString))),
  A.getSomes
);

/**
 * Read, deliver, and mark every AI metrics turn still awaiting OTLP export.
 *
 * **When to use**
 *
 * Use as the entry point for any export, standalone or forwarder-driven. It reads,
 * delivers, and closes the watermark as one unit, so no caller can deliver spans and
 * then forget to record that it did — the failure that let every forwarder run
 * re-emit the entire store.
 *
 * **Details**
 *
 * Delivery is at-least-once. The watermark closes only on an acknowledged export, so
 * a rejected or crashed run leaves its turns pending and the next run picks them up.
 * A turn sent twice is not a duplicate in the collector: its span id is derived from
 * its content, and Phoenix's `uq_spans_span_id` collapses the repeat.
 *
 * **Example** (Construct AiMetricsOtlpExportInput)
 *
 * ```ts
 * import {
 *   AiMetricsOtlpEndpointSpec,
 *   AiMetricsOtlpExportInput,
 *   AiMetricsOtlpSpanSender,
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
 *   Effect.provide(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: input.duckDbPath }))),
 *   Effect.provide(AiMetricsOtlpSpanSender.layer)
 * )
 * console.log(program)
 * ```
 *
 * @effects Reads derived DuckDB rows, delivers redacted spans over OTLP, and closes the export watermark.
 * @category services
 * @since 0.0.0
 */
export const runAiMetricsOtlpExport: (
  input: AiMetricsOtlpExportInput
) => Effect.Effect<AiMetricsOtlpExportResult, AiMetricsOtlpExportError, AiMetricsOtlpSpanSender | DuckDb> = Effect.fn(
  "AiMetrics.runAiMetricsOtlpExport"
)(
  function* (input) {
    const batch = yield* readAiMetricsOtlpSpanProjections;
    const duckdb = yield* DuckDb;
    // Ordering is the whole point: each chunk is delivered first, then only that
    // acknowledged chunk reaches the mark. A rejected chunk fails before its checkpoint,
    // while earlier chunks stay closed so a retry resumes instead of replaying the prefix.
    const result = yield* runAiMetricsOtlpProjectionBatchExportUntraced(input, batch, (projections) =>
      markAiMetricsOtlpTurnsExported(turnIdsFor(projections)).pipe(Effect.provideService(DuckDb, duckdb))
    );

    return result;
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
