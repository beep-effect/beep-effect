/**
 * Transcript ingest helpers for AI-agent metrics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { A } from "@beep/utils";
import { Effect, flow, Order, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { firstString, metricEventName, optionalTimestamp, transcriptLines } from "./internal/transcript-utils.ts";
import {
  AgentTurn,
  AiMetricsTranscriptSource,
  ClaudeTranscriptLine,
  CodexTranscriptLine,
  OpenClawTranscriptLine,
  TranscriptIngestSummary,
} from "./models.ts";
import { hashPrivateIdentifier } from "./privacy.ts";

const $I = $RepoAiMetricsId.create("ingest");

const encodeTranscriptIngestSummaryJson = S.encodeUnknownEffect(S.fromJsonString(TranscriptIngestSummary));

/**
 * Error raised by AI metrics ingest helpers.
 *
 * **Example** (Make ingest error)
 *
 * ```ts
 * import { AiMetricsIngestError } from "@beep/repo-ai-metrics"
 *
 * const error = AiMetricsIngestError.make({
 *   cause: "invalid jsonl",
 *   message: "Failed to summarize transcript."
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsIngestError extends TaggedErrorClass<AiMetricsIngestError>($I`AiMetricsIngestError`)(
  "AiMetricsIngestError",
  {
    cause: S.Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annote("AiMetricsIngestError", {
    description: "Typed failure raised by AI metrics transcript ingest helpers.",
  })
) {}

/**
 * Input contract for summarizing one transcript text blob.
 *
 * **Example** (Make transcript text input)
 *
 * ```ts
 * import { AiMetricsTranscriptTextSummaryInput } from "@beep/repo-ai-metrics"
 *
 * const input = AiMetricsTranscriptTextSummaryInput.make({
 *   content: "{\"type\":\"event_msg\"}",
 *   sourceKind: "codex",
 *   sourcePath: "sample.jsonl"
 * })
 * console.log(input.sourceKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsTranscriptTextSummaryInput extends S.Class<AiMetricsTranscriptTextSummaryInput>(
  $I`AiMetricsTranscriptTextSummaryInput`
)(
  {
    content: S.String,
    hashSalt: S.optionalKey(S.String),
    sourceKind: AiMetricsTranscriptSource,
    sourcePath: S.String,
  },
  $I.annote("AiMetricsTranscriptTextSummaryInput", {
    description: "Schema-backed input for summarizing one in-memory transcript JSONL document.",
  })
) {}

const codexTurn = (sourcePathHash: string, lineNumber: number, line: CodexTranscriptLine): AgentTurn =>
  AgentTurn.make({
    eventName: metricEventName({
      fallback: "event",
      sourceKind: AiMetricsTranscriptSource.Enum.codex,
      value: line.type,
    }),
    lineNumber,
    sourceKind: AiMetricsTranscriptSource.Enum.codex,
    sourcePathHash,
    ...optionalTimestamp(line.timestamp),
  });

const claudeTurn = (sourcePathHash: string, lineNumber: number, line: ClaudeTranscriptLine): AgentTurn =>
  AgentTurn.make({
    eventName: metricEventName({
      fallback: "message",
      sourceKind: AiMetricsTranscriptSource.Enum.claude,
      value: line.type,
    }),
    lineNumber,
    sourceKind: AiMetricsTranscriptSource.Enum.claude,
    sourcePathHash,
    ...optionalTimestamp(line.timestamp),
  });

const openClawTurn = (sourcePathHash: string, lineNumber: number, line: OpenClawTranscriptLine): AgentTurn =>
  AgentTurn.make({
    eventName: pipe(
      firstString(line.event, line.type),
      O.map((value) =>
        metricEventName({
          fallback: "event",
          sourceKind: AiMetricsTranscriptSource.Enum.openclaw,
          value,
        })
      ),
      O.getOrElse(() => "event")
    ),
    lineNumber,
    sourceKind: AiMetricsTranscriptSource.Enum.openclaw,
    sourcePathHash,
    ...optionalTimestamp(line.timestamp),
  });

const decodeTranscriptTurn = (
  sourceKind: AiMetricsTranscriptSource,
  sourcePathHash: string,
  lineNumber: number,
  line: string
): O.Option<AgentTurn> =>
  AiMetricsTranscriptSource.$match(sourceKind, {
    codex: () =>
      pipe(
        CodexTranscriptLine.decodeJsonOption(line),
        O.map((decoded) => codexTurn(sourcePathHash, lineNumber, decoded))
      ),
    claude: () =>
      pipe(
        ClaudeTranscriptLine.decodeJsonOption(line),
        O.map((decoded) => claudeTurn(sourcePathHash, lineNumber, decoded))
      ),
    openclaw: () =>
      pipe(
        OpenClawTranscriptLine.decodeJsonOption(line),
        O.map((decoded) => openClawTurn(sourcePathHash, lineNumber, decoded))
      ),
  });

const eventNameList: (events: ReadonlyArray<AgentTurn>) => ReadonlyArray<string> = flow(
  A.map((event) => event.eventName),
  A.dedupe,
  A.sort(Order.String)
);

const timestampList: (events: ReadonlyArray<AgentTurn>) => ReadonlyArray<string> = flow(
  A.map((event) => O.fromNullishOr(event.timestamp)),
  A.getSomes,
  A.sort(Order.String)
);

const summaryTimestampFields = (
  events: ReadonlyArray<AgentTurn>
): { readonly firstTimestamp?: string; readonly lastTimestamp?: string } => {
  const timestamps = timestampList(events);
  const firstTimestamp = A.head(timestamps);
  const lastTimestamp = A.get(timestamps, A.length(timestamps) - 1);

  return {
    ...(O.isSome(firstTimestamp) ? { firstTimestamp: firstTimestamp.value } : {}),
    ...(O.isSome(lastTimestamp) ? { lastTimestamp: lastTimestamp.value } : {}),
  };
};

/**
 * Summarize JSONL transcript text into a stable ingest summary.
 *
 * **Example** (Summarize transcript with Effect)
 *
 * ```ts
 * import { summarizeTranscriptText } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const result = Effect.runPromise(
 *   summarizeTranscriptText({
 *     content: "{\"type\":\"event_msg\"}",
 *     hashSalt: "local-smoke-salt",
 *     sourceKind: "codex",
 *     sourcePath: "sample.jsonl"
 *   })
 * )
 * console.log(result)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const summarizeTranscriptText: (
  input: AiMetricsTranscriptTextSummaryInput
) => Effect.Effect<TranscriptIngestSummary, AiMetricsIngestError> = Effect.fn("AiMetrics.summarizeTranscriptText")(
  function* ({ content, hashSalt, sourceKind, sourcePath }) {
    const sourcePathHash = yield* hashPrivateIdentifier(sourcePath, hashSalt).pipe(
      Effect.mapError((cause) =>
        AiMetricsIngestError.make({
          cause,
          message: "Failed to hash transcript source path.",
        })
      )
    );
    const lines = transcriptLines(content);
    const parsed = yield* Effect.forEach(
      lines,
      (line, index) => Effect.succeed(decodeTranscriptTurn(sourceKind, sourcePathHash, index + 1, line)),
      { concurrency: 16 }
    );
    const events = A.getSomes(parsed);

    return TranscriptIngestSummary.make({
      acceptedEvents: A.length(events),
      eventNames: eventNameList(events),
      rejectedLines: A.length(lines) - A.length(events),
      sourceKind,
      sourcePathHash,
      totalLines: A.length(lines),
      ...summaryTimestampFields(events),
    });
  }
);

/**
 * Render a transcript ingest summary as JSON.
 *
 * **Example** (Encode summary to JSON)
 *
 * ```ts
 * import { TranscriptIngestSummary, summaryToJson } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 * const json = Effect.runPromise(
 *   summaryToJson(
 *     TranscriptIngestSummary.make({
 *       acceptedEvents: 1,
 *       eventNames: ["codex.event_msg"],
 *       rejectedLines: 0,
 *       sourceKind: "codex",
 *       sourcePathHash: "source-hash",
 *       totalLines: 1
 *     })
 *   )
 * )
 * console.log(json)
 * ```
 *
 * @effects Performs schema JSON encoding only; fails with `AiMetricsIngestError` if the summary cannot be encoded.
 * @category services
 * @since 0.0.0
 */
export const summaryToJson: (summary: TranscriptIngestSummary) => Effect.Effect<string, AiMetricsIngestError> =
  Effect.fn("AiMetrics.summaryToJson")(function* (summary) {
    return yield* encodeTranscriptIngestSummaryJson(summary).pipe(
      Effect.mapError((cause) =>
        AiMetricsIngestError.make({
          cause,
          message: "Failed to encode transcript ingest summary as JSON.",
        })
      )
    );
  });
