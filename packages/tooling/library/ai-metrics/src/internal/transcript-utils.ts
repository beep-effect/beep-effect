/**
 * Shared transcript metadata helpers for AI metrics ingest and privacy projections.
 *
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { flow, pipe } from "effect";
import * as O from "effect/Option";
import { AiMetricsTranscriptSource } from "../models.ts";
import type { Path } from "effect";

const codexEventNames = [
  "assistant_message",
  "event",
  "event_msg",
  "response_item",
  "session_meta",
  "turn_context",
  "user_message",
] as const;

const claudeEventNames = ["assistant", "message", "summary", "system", "tool_result", "tool_use", "user"] as const;

const openClawEventNames = [
  "event",
  "gateway_request",
  "gateway_response",
  "message",
  "request",
  "response",
  "session",
  "tool_call",
  "tool_result",
] as const;

const eventNamesForSource = (sourceKind: AiMetricsTranscriptSource): ReadonlyArray<string> =>
  AiMetricsTranscriptSource.$match(sourceKind, {
    claude: () => claudeEventNames,
    codex: () => codexEventNames,
    openclaw: () => openClawEventNames,
  });

/**
 * Trim transcript JSONL text into non-empty lines.
 *
 * @category utilities
 * @since 0.0.0
 */
export const transcriptLines: (content: string) => ReadonlyArray<string> = flow(
  Str.split("\n"),
  A.map(Str.trim),
  A.filter(Str.isNonEmpty)
);

/**
 * Return the first defined string from a small candidate list.
 *
 * @category utilities
 * @since 0.0.0
 */
export const firstString = (...values: ReadonlyArray<string | undefined>): O.Option<string> =>
  pipe(values, A.map(O.fromNullishOr), A.getSomes, A.head);

/**
 * Convert a repository path into Claude's project-directory name.
 *
 * @category utilities
 * @since 0.0.0
 */
export const repoPathToClaudeProjectName: (repoRoot: string) => string = Str.replace(/[/\\]/gu, "-");

/**
 * Normalize a source path relative to a root with POSIX separators.
 *
 * @category utilities
 * @since 0.0.0
 */
export const normalizedRelativePath = (pathApi: Path.Path, root: string, filePath: string): string =>
  pipe(pathApi.relative(root, filePath), Str.replace(/\\/gu, "/"));

/**
 * Build an optional timestamp object for schema class constructors.
 *
 * @category utilities
 * @since 0.0.0
 */
export const optionalTimestamp = (timestamp: string | undefined): { readonly timestamp?: string } =>
  timestamp === undefined ? {} : { timestamp };

/**
 * Normalize transcript metadata into a bounded, source-specific metric event name.
 *
 * @category utilities
 * @since 0.0.0
 */
export const metricEventName = ({
  fallback,
  sourceKind,
  value,
}: {
  readonly fallback: string;
  readonly sourceKind: AiMetricsTranscriptSource;
  readonly value: string | undefined;
}): string =>
  pipe(
    O.fromNullishOr(value),
    O.filter((eventName) => A.contains(eventNamesForSource(sourceKind), eventName)),
    O.getOrElse(() => fallback)
  );
