/**
 * Shared transcript metadata helpers for AI metrics ingest and privacy projections.
 *
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { flow, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import {
  AiMetricsTranscriptSource,
  ClaudeTranscriptEventName,
  CodexTranscriptEventName,
  OpenClawTranscriptEventName,
} from "../models.ts";
import { repoPathToClaudeProjectName } from "../shell.ts";
import type { AiMetricsTranscriptEventName } from "../models.ts";

export { repoPathToClaudeProjectName };

import type { Path } from "effect";

const isEventNameForSource = (
  sourceKind: AiMetricsTranscriptSource,
  value: unknown
): value is AiMetricsTranscriptEventName =>
  AiMetricsTranscriptSource.$match(sourceKind, {
    claude: () => ClaudeTranscriptEventName.isAny(value),
    codex: () => CodexTranscriptEventName.isAny(value),
    openclaw: () => OpenClawTranscriptEventName.isAny(value),
  });

type TranscriptSourceRootInput = {
  readonly claudeProjectsRoot: O.Option<string>;
  readonly codexSessionsRoot: O.Option<string>;
  readonly homeDir: string;
  readonly repoRoot: string;
};

type TranscriptSourceRoots = {
  readonly claudeRoot: string;
  readonly codexRoot: string;
  readonly homeDir: string;
  readonly repoRoot: string;
};

/**
 * Resolve the canonical local roots shared by transcript discovery workflows.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const resolveTranscriptSourceRoots: {
  (input: TranscriptSourceRootInput, pathApi: Path.Path): TranscriptSourceRoots;
  (pathApi: Path.Path): (input: TranscriptSourceRootInput) => TranscriptSourceRoots;
} = dual(2, (input: TranscriptSourceRootInput, pathApi: Path.Path): TranscriptSourceRoots => {
  const repoRoot = pathApi.resolve(input.repoRoot);
  const homeDir = pathApi.resolve(input.homeDir);

  return {
    claudeRoot: O.getOrElse(input.claudeProjectsRoot, () =>
      pathApi.join(homeDir, ".claude/projects", repoPathToClaudeProjectName(repoRoot))
    ),
    codexRoot: O.getOrElse(input.codexSessionsRoot, () => pathApi.join(homeDir, ".codex/sessions")),
    homeDir,
    repoRoot,
  };
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
 * Normalize a source path relative to a root with POSIX separators.
 *
 * @category utilities
 * @since 0.0.0
 */
export const normalizedRelativePath: {
  (filePath: string, options: { readonly pathApi: Path.Path; readonly root: string }): string;
  (options: { readonly pathApi: Path.Path; readonly root: string }): (filePath: string) => string;
} = dual(2, (filePath: string, options: { readonly pathApi: Path.Path; readonly root: string }): string =>
  pipe(options.pathApi.relative(options.root, filePath), Str.replace(/\\/gu, "/"))
);

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
  readonly fallback: AiMetricsTranscriptEventName;
  readonly sourceKind: AiMetricsTranscriptSource;
  readonly value: O.Option<string>;
}): AiMetricsTranscriptEventName =>
  pipe(
    value,
    O.filter((eventName) => isEventNameForSource(sourceKind, eventName)),
    O.getOrElse(() => fallback)
  );
