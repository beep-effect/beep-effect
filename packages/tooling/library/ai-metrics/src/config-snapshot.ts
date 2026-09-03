/**
 * Repo-local agent configuration snapshots for AI metrics attribution.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Defect, LiteralKit, SchemaUtils } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Clock, Effect, FileSystem, flow, Order, Path, pipe, Random, Ref } from "effect";
import * as S from "effect/Schema";
import { isNestedGitRoot } from "./identity-registry.ts";
import { fileSizeBytes } from "./internal/file-info.ts";
import { statOption } from "./internal/jsonl-discovery.ts";
import { ConfigSnapshot } from "./models.ts";
import { hashPublicTextSha256 } from "./privacy.ts";

const $I = $RepoAiMetricsId.create("config-snapshot");

const CONFIG_ROOTS = [".codex", ".claude", ".ai", ".aiassistant"] as const;
const AgentDocName = LiteralKit(["AGENTS.md", "CLAUDE.md"]);
const SessionScopePath = LiteralKit([
  ".claude/settings.json",
  ".claude/settings.local.json",
  ".codex/config.toml",
  "AGENTS.md",
  "CLAUDE.md",
]);
const ConfigSnapshotExcludedDirName = LiteralKit([
  ".beep",
  ".cache",
  ".git",
  ".idea",
  ".next",
  ".repos",
  ".turbo",
  ".venv",
  "build",
  "coverage",
  "dist",
  "ide",
  "logs",
  "node_modules",
  "outputs",
  "projects",
  "shell-snapshots",
  "statsig",
  "target",
  "todos",
]);
const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_MAX_FILES = 1000;
const DEFAULT_MAX_FILE_BYTES = 512 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 8 * 1024 * 1024;

/**
 * Whether a snapshotted file is per-root baseline guidance or session-effective configuration.
 *
 * **Details**
 *
 * Session scope is the small fixed set an agent session actually runs under at
 * the scan root: the two agent guides plus the Claude and Codex settings files.
 * Everything else inside the bounds — skills, agents, hooks, nested-package
 * guides — is baseline guidance for the root. Splitting them lets an attribution
 * query tell "the operator changed their settings" apart from "the repo grew a
 * skill", which the single `configHash` cannot.
 *
 * **Example** (Filtering a snapshot to session-effective files)
 *
 * ```ts
 * import { AiMetricsConfigScope } from "@beep/repo-ai-metrics"
 *
 * console.log(AiMetricsConfigScope.Enum.session) // "session"
 * console.log(AiMetricsConfigScope.is.session("baseline")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsConfigScope = LiteralKit(["baseline", "session"]).pipe(
  $I.annoteSchema("AiMetricsConfigScope", {
    description: "Whether a snapshotted config file is per-root baseline guidance or session-effective config.",
  })
);

/**
 * Decoded scope literal carried by each snapshotted configuration file.
 *
 * @see {@link AiMetricsConfigScope} for the runtime schema, its guards, and its enum keys.
 * @category models
 * @since 0.0.0
 */
export type AiMetricsConfigScope = typeof AiMetricsConfigScope.Type;

/**
 * Named stage of the config snapshot pipeline, recorded for timing attribution.
 *
 * **Gotchas**
 *
 * `write` stays in the literal domain for decode compatibility with manifests
 * persisted before the write measurement moved to
 * {@link writeAiMetricsConfigSnapshotArtifacts}; new manifests no longer emit a
 * `write` timing, because the snapshot builder writes nothing.
 *
 * **Example** (Naming a stage)
 *
 * ```ts
 * import { AiMetricsConfigSnapshotStage } from "@beep/repo-ai-metrics"
 *
 * console.log(AiMetricsConfigSnapshotStage.Enum.enumerate) // "enumerate"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsConfigSnapshotStage = LiteralKit(["enumerate", "read", "hash", "diff", "write"]).pipe(
  $I.annoteSchema("AiMetricsConfigSnapshotStage", {
    description: "Named stage of the AI metrics config snapshot pipeline.",
  })
);

/**
 * Decoded stage literal carried by each config snapshot timing row.
 *
 * @see {@link AiMetricsConfigSnapshotStage} for the runtime schema, its guards, and its enum keys.
 * @category models
 * @since 0.0.0
 */
export type AiMetricsConfigSnapshotStage = typeof AiMetricsConfigSnapshotStage.Type;

/**
 * Wall-clock cost and volume of one config snapshot stage.
 *
 * **Example** (Reading a stage timing)
 *
 * ```ts
 * import { AiMetricsConfigSnapshotStageTiming } from "@beep/repo-ai-metrics"
 *
 * const timing = AiMetricsConfigSnapshotStageTiming.make({
 *   byteCount: 0,
 *   durationMillis: 4,
 *   fileCount: 254,
 *   stage: "enumerate"
 * })
 *
 * console.log(timing.stage) // enumerate
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsConfigSnapshotStageTiming extends S.Class<AiMetricsConfigSnapshotStageTiming>(
  $I`AiMetricsConfigSnapshotStageTiming`
)(
  {
    byteCount: S.Natural,
    durationMillis: S.Natural,
    fileCount: S.Natural,
    stage: AiMetricsConfigSnapshotStage,
  },
  $I.annote("AiMetricsConfigSnapshotStageTiming", {
    description: "Duration, file count, and byte count for one AI metrics config snapshot stage.",
  })
) {}

/**
 * Hard bounds applied to a config snapshot walk.
 *
 * **Details**
 *
 * The defaults sit at roughly four times the measured legitimate surface of a
 * beep clone: 254 files and about 2 MiB. They exist so an unbounded subtree —
 * a linked worktree carrying its own `node_modules`, a vendored checkout — can
 * never turn one snapshot into a multi-megabyte manifest again.
 *
 * **Example** (Tightening the walk for a test fixture)
 *
 * ```ts
 * import { AiMetricsConfigSnapshotBudget } from "@beep/repo-ai-metrics"
 *
 * const budget = AiMetricsConfigSnapshotBudget.make({ maxFiles: 3 })
 *
 * console.log(budget.maxDepth) // 8
 * console.log(budget.maxFiles) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsConfigSnapshotBudget extends S.Class<AiMetricsConfigSnapshotBudget>(
  $I`AiMetricsConfigSnapshotBudget`
)(
  {
    maxDepth: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(DEFAULT_MAX_DEPTH)),
      S.withDecodingDefaultKey(Effect.succeed(DEFAULT_MAX_DEPTH))
    ),
    maxFileBytes: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(DEFAULT_MAX_FILE_BYTES)),
      S.withDecodingDefaultKey(Effect.succeed(DEFAULT_MAX_FILE_BYTES))
    ),
    maxFiles: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(DEFAULT_MAX_FILES)),
      S.withDecodingDefaultKey(Effect.succeed(DEFAULT_MAX_FILES))
    ),
    maxTotalBytes: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(DEFAULT_MAX_TOTAL_BYTES)),
      S.withDecodingDefaultKey(Effect.succeed(DEFAULT_MAX_TOTAL_BYTES))
    ),
  },
  $I.annote("AiMetricsConfigSnapshotBudget", {
    description: "Depth, file-count, per-file byte, and total byte bounds applied to a config snapshot walk.",
  })
) {}

const defaultConfigSnapshotBudget = AiMetricsConfigSnapshotBudget.make({});

/**
 * Why a config snapshot walk stopped short of the full tree.
 *
 * **Example** (Naming the bound that fired)
 *
 * ```ts
 * import { AiMetricsConfigSnapshotTruncationReason } from "@beep/repo-ai-metrics"
 *
 * console.log(AiMetricsConfigSnapshotTruncationReason.Enum["max-files"]) // "max-files"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsConfigSnapshotTruncationReason = LiteralKit(["max-files", "max-total-bytes", "max-depth"]).pipe(
  $I.annoteSchema("AiMetricsConfigSnapshotTruncationReason", {
    description: "Bound that stopped an AI metrics config snapshot walk short of the full tree.",
  })
);

/**
 * Decoded truncation reason carried by a config snapshot bounds report.
 *
 * @see {@link AiMetricsConfigSnapshotTruncationReason} for the runtime schema, its guards, and its enum keys.
 * @category models
 * @since 0.0.0
 */
export type AiMetricsConfigSnapshotTruncationReason = typeof AiMetricsConfigSnapshotTruncationReason.Type;

/**
 * What the bounds actually did to one config snapshot walk.
 *
 * **Details**
 *
 * `excludedNestedRootPaths` is the audit trail for the nested-git-root boundary:
 * every path listed here is somebody else's canonical root, recorded in the
 * identity registry rather than folded into this root's snapshot.
 * `skippedOversizeFileCount` keeps oversize files visible instead of letting
 * them vanish silently.
 *
 * **Example** (An unbounded-but-clean walk)
 *
 * ```ts
 * import {
 *   AiMetricsConfigSnapshotBoundsReport,
 *   AiMetricsConfigSnapshotBudget
 * } from "@beep/repo-ai-metrics"
 *
 * const bounds = AiMetricsConfigSnapshotBoundsReport.make({
 *   budget: AiMetricsConfigSnapshotBudget.make({}),
 *   excludedNestedRootPaths: [".claude/worktrees/wt1"],
 *   skippedOversizeFileCount: 0,
 *   totalBytes: 2048,
 *   truncated: false
 * })
 *
 * console.log(bounds.truncated) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsConfigSnapshotBoundsReport extends S.Class<AiMetricsConfigSnapshotBoundsReport>(
  $I`AiMetricsConfigSnapshotBoundsReport`
)(
  {
    budget: AiMetricsConfigSnapshotBudget.pipe(
      S.withConstructorDefault(Effect.succeed(defaultConfigSnapshotBudget)),
      S.withDecodingDefaultKey(Effect.succeed(defaultConfigSnapshotBudget))
    ),
    excludedNestedRootPaths: S.Array(S.String),
    skippedOversizeFileCount: S.Natural,
    totalBytes: S.Natural,
    truncated: S.Boolean,
    truncationReason: S.OptionFromOptionalKey(AiMetricsConfigSnapshotTruncationReason).pipe(
      SchemaUtils.withNoneDefault
    ),
  },
  $I.annote("AiMetricsConfigSnapshotBoundsReport", {
    description: "Budget, nested-root exclusions, and truncation outcome for one AI metrics config snapshot walk.",
  })
) {}

const emptyConfigSnapshotBoundsReport = AiMetricsConfigSnapshotBoundsReport.make({
  budget: defaultConfigSnapshotBudget,
  excludedNestedRootPaths: [],
  skippedOversizeFileCount: 0,
  totalBytes: 0,
  truncated: false,
});

/**
 * Repo root, label, and bounds that define one agent-configuration snapshot run.
 *
 * **Details**
 *
 * `budget` and `label` carry both constructor and decoding defaults, so a caller
 * that knows only the repo root still gets the standard bounds and the
 * `repo-local-agent-config` label. `previousSnapshotPath` names the manifest the
 * run diffs against; leaving it unset makes every included file an addition.
 *
 * **Example** (Snapshotting a repo root under the default bounds)
 *
 * ```ts
 * import { AiMetricsConfigSnapshotInput } from "@beep/repo-ai-metrics"
 *
 * const input = AiMetricsConfigSnapshotInput.make({ repoRoot: "/repo" })
 *
 * console.log(input.label) // "repo-local-agent-config"
 * console.log(input.budget.maxFiles) // 1000
 * ```
 *
 * @see {@link AiMetricsConfigSnapshotBudget} for the bounds this input carries.
 * @category models
 * @since 0.0.0
 */
export class AiMetricsConfigSnapshotInput extends S.Class<AiMetricsConfigSnapshotInput>(
  $I`AiMetricsConfigSnapshotInput`
)(
  {
    budget: AiMetricsConfigSnapshotBudget.pipe(
      S.withConstructorDefault(Effect.succeed(defaultConfigSnapshotBudget)),
      S.withDecodingDefaultKey(Effect.succeed(defaultConfigSnapshotBudget))
    ),
    label: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("repo-local-agent-config")),
      S.withDecodingDefaultKey(Effect.succeed("repo-local-agent-config"))
    ),
    previousSnapshotPath: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    repoRoot: S.String,
  },
  $I.annote("AiMetricsConfigSnapshotInput", {
    description: "Repo root and label used to build an agent-facing configuration snapshot.",
  })
) {}

/**
 * Path-level difference between the current config snapshot and the previous one.
 *
 * **Details**
 *
 * The four arrays partition the union of both snapshots' paths, so a path
 * appears in exactly one of them. A path that a tightened bound stopped
 * including shows up in `removedPaths`, which is why a large `removedPaths` is
 * the expected signature of a boundary change rather than of deleted guidance.
 *
 * **Example** (Reading what changed between two snapshots)
 *
 * ```ts
 * import { AiMetricsConfigSnapshotDiff } from "@beep/repo-ai-metrics"
 *
 * const diff = AiMetricsConfigSnapshotDiff.make({
 *   addedPaths: ["AGENTS.md"],
 *   modifiedPaths: [],
 *   removedPaths: [],
 *   unchangedPaths: [".codex/config.toml"]
 * })
 *
 * console.log(diff.addedPaths) // [ "AGENTS.md" ]
 * console.log(diff.unchangedPaths.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsConfigSnapshotDiff extends S.Class<AiMetricsConfigSnapshotDiff>($I`AiMetricsConfigSnapshotDiff`)(
  {
    addedPaths: S.Array(S.String),
    modifiedPaths: S.Array(S.String),
    removedPaths: S.Array(S.String),
    unchangedPaths: S.Array(S.String),
  },
  $I.annote("AiMetricsConfigSnapshotDiff", {
    description: "Path-level before/after diff for agent-facing configuration snapshots.",
  })
) {}

const emptyConfigSnapshotDiff = AiMetricsConfigSnapshotDiff.make({
  addedPaths: [],
  modifiedPaths: [],
  removedPaths: [],
  unchangedPaths: [],
});

/**
 * One agent-configuration file included in a snapshot, with its content hash and scope.
 *
 * **Details**
 *
 * `relativePath` is relative to the scan root, so two machines snapshotting the
 * same revision produce comparable manifests. `scope` defaults to `baseline`,
 * which is what lets manifests written before the baseline/session split keep
 * decoding.
 *
 * **Example** (Recording a session-scoped guide)
 *
 * ```ts
 * import { AiMetricsConfigSnapshotFile } from "@beep/repo-ai-metrics"
 *
 * const file = AiMetricsConfigSnapshotFile.make({
 *   contentHash: "sha256:fixture",
 *   relativePath: "AGENTS.md",
 *   scope: "session",
 *   sizeBytes: 2048
 * })
 *
 * console.log(file.relativePath) // "AGENTS.md"
 * console.log(file.scope) // "session"
 * ```
 *
 * @see {@link AiMetricsConfigScope} for what separates session-effective config from baseline guidance.
 * @category models
 * @since 0.0.0
 */
export class AiMetricsConfigSnapshotFile extends S.Class<AiMetricsConfigSnapshotFile>($I`AiMetricsConfigSnapshotFile`)(
  {
    contentHash: S.String,
    relativePath: S.String,
    scope: AiMetricsConfigScope.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsConfigScope.Enum.baseline)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsConfigScope.Enum.baseline))
    ),
    sizeBytes: S.Natural,
  },
  $I.annote("AiMetricsConfigSnapshotFile", {
    description: "Repo-relative agent-facing configuration file and its deterministic content hash.",
  })
) {}

/**
 * Complete manifest of one bounded agent-configuration snapshot run.
 *
 * **Details**
 *
 * `snapshot.configHash` keeps its original meaning — a hash over the whole
 * included set — while `baselineHash` and `sessionHash` split that same set so a
 * query can tell an operator settings change apart from a repo guidance change.
 * `bounds` and `stageTimings` carry constructor and decoding defaults, so a
 * manifest written before those fields existed still decodes and simply reports
 * an empty bounds report and no timings.
 *
 * **Example** (An empty first snapshot)
 *
 * ```ts
 * import {
 *   AiMetricsConfigSnapshotDiff,
 *   AiMetricsConfigSnapshotResult,
 *   ConfigSnapshot
 * } from "@beep/repo-ai-metrics"
 *
 * const result = AiMetricsConfigSnapshotResult.make({
 *   excludedDirectoryNames: [".git", "node_modules"],
 *   diff: AiMetricsConfigSnapshotDiff.make({
 *     addedPaths: [],
 *     modifiedPaths: [],
 *     removedPaths: [],
 *     unchangedPaths: []
 *   }),
 *   fileCount: 0,
 *   files: [],
 *   snapshot: ConfigSnapshot.make({
 *     changedPaths: [],
 *     configHash: "config-hash",
 *     label: "repo-local-agent-config",
 *     snapshotId: "config-1"
 *   })
 * })
 *
 * console.log(result.fileCount) // 0
 * console.log(result.bounds.truncated) // false
 * console.log(result.stageTimings.length) // 0
 * ```
 *
 * @see {@link AiMetricsConfigSnapshotBoundsReport} for how to read a truncated walk.
 * @category models
 * @since 0.0.0
 */
export class AiMetricsConfigSnapshotResult extends S.Class<AiMetricsConfigSnapshotResult>(
  $I`AiMetricsConfigSnapshotResult`
)(
  {
    baselineHash: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    bounds: AiMetricsConfigSnapshotBoundsReport.pipe(SchemaUtils.withKeyDefaults(emptyConfigSnapshotBoundsReport)),
    excludedDirectoryNames: S.Array(ConfigSnapshotExcludedDirName),
    diff: AiMetricsConfigSnapshotDiff.pipe(S.withDecodingDefaultKey(Effect.succeed(emptyConfigSnapshotDiff))),
    fileCount: S.Natural,
    files: S.Array(AiMetricsConfigSnapshotFile),
    previousSnapshotId: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    sessionHash: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    snapshot: ConfigSnapshot,
    stageTimings: S.Array(AiMetricsConfigSnapshotStageTiming).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<AiMetricsConfigSnapshotStageTiming>())),
      S.withDecodingDefaultKey(Effect.succeed(A.empty<AiMetricsConfigSnapshotStageTiming>()))
    ),
  },
  $I.annote("AiMetricsConfigSnapshotResult", {
    description: "Config snapshot manifest used to attribute AI-agent metrics to repo guidance changes.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(AiMetricsConfigSnapshotResult));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(AiMetricsConfigSnapshotResult));
}

/**
 * Typed failure raised while enumerating, reading, or persisting a config snapshot.
 *
 * **Details**
 *
 * The snapshot walk never swallows a filesystem failure into a partial manifest:
 * a manifest that silently lost files would be indistinguishable from one whose
 * guidance was deleted, and attribution would blame the wrong change.
 *
 * **Example** (Constructing the failure)
 *
 * ```ts
 * import { AiMetricsConfigSnapshotError } from "@beep/repo-ai-metrics"
 *
 * const error = AiMetricsConfigSnapshotError.make({
 *   cause: "read failed",
 *   message: "Failed to read agent guidance file."
 * })
 *
 * console.log(error._tag) // "AiMetricsConfigSnapshotError"
 * console.log(error.message) // "Failed to read agent guidance file."
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsConfigSnapshotError extends S.TaggedError<AiMetricsConfigSnapshotError>(
  $I`AiMetricsConfigSnapshotError`
)(
  "AiMetricsConfigSnapshotError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annoteError<AiMetricsConfigSnapshotError>("AiMetricsConfigSnapshotError", {
    description: "Typed failure raised while building an AI metrics config snapshot.",
  })
) {}

const byRelativePathAscending: Order.Order<AiMetricsConfigSnapshotFile> = Order.mapInput(
  Order.String,
  (file) => file.relativePath
);

const normalizeRepoPath = (pathApi: Path.Path, repoRoot: string, filePath: string): string =>
  pipe(pathApi.relative(repoRoot, filePath), Str.replace(/\\/gu, "/"));

const isExcludedDirectoryName = S.is(ConfigSnapshotExcludedDirName);

const isAgentDocName = S.is(AgentDocName);

interface ConfigSnapshotEnumeration {
  readonly excludedNestedRootPaths: ReadonlyArray<string>;
  readonly paths: ReadonlyArray<string>;
  readonly truncationReason: O.Option<AiMetricsConfigSnapshotTruncationReason>;
}

interface ConfigSnapshotReadFile {
  readonly content: string;
  readonly relativePath: string;
  readonly sizeBytes: number;
}

interface ConfigSnapshotRead {
  readonly files: ReadonlyArray<ConfigSnapshotReadFile>;
  readonly skippedOversizeFileCount: number;
  readonly totalBytes: number;
  readonly truncationReason: O.Option<AiMetricsConfigSnapshotTruncationReason>;
}

const isSessionScopePath = S.is(SessionScopePath);

const scopeFor = (relativePath: string): AiMetricsConfigScope =>
  isSessionScopePath(relativePath) ? AiMetricsConfigScope.Enum.session : AiMetricsConfigScope.Enum.baseline;

const enumerateSnapshotPaths = Effect.fn("AiMetrics.enumerateConfigSnapshotPaths")(function* (
  repoRoot: string,
  budget: AiMetricsConfigSnapshotBudget
): Effect.fn.Return<ConfigSnapshotEnumeration, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  const pathsRef = yield* Ref.make(A.empty<string>());
  const excludedRef = yield* Ref.make(A.empty<string>());
  const truncationRef = yield* Ref.make(O.none<AiMetricsConfigSnapshotTruncationReason>());
  const markTruncated = (reason: AiMetricsConfigSnapshotTruncationReason) =>
    Ref.update(
      truncationRef,
      O.orElse(() => O.some(reason))
    );

  const walk = Effect.fnUntraced(function* (
    currentPath: string,
    depth: number,
    includeFile: (basename: string) => boolean
  ): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
    if (A.length(yield* Ref.get(pathsRef)) >= budget.maxFiles) {
      return yield* markTruncated(AiMetricsConfigSnapshotTruncationReason.Enum["max-files"]);
    }

    const info = yield* statOption(currentPath);
    if (O.isNone(info)) {
      return;
    }

    // A `File` the filter rejects falls through to the directory guard below, which
    // returns for any non-`Directory` type — the same early exit the collected branch takes.
    if (info.value.type === "File" && includeFile(pathApi.basename(currentPath))) {
      return yield* Ref.update(pathsRef, (paths) => A.append(paths, currentPath));
    }

    if (info.value.type !== "Directory") {
      return;
    }

    if (depth >= budget.maxDepth) {
      return yield* markTruncated(AiMetricsConfigSnapshotTruncationReason.Enum["max-depth"]);
    }

    const entries = pipe(
      yield* fs.readDirectory(currentPath).pipe(Effect.orElseSucceed(A.empty<string>)),
      A.sort(Order.String)
    );
    yield* Effect.forEach(entries, (entry) => walkEntry(currentPath, entry, depth, includeFile), { discard: true });
  });

  // Split out of `walk` so the per-entry decision — excluded name, nested repo root, or
  // recurse — carries its own nesting budget instead of compounding the loop's.
  const walkEntry = Effect.fnUntraced(function* (
    parentPath: string,
    entry: string,
    depth: number,
    includeFile: (basename: string) => boolean
  ): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
    if (isExcludedDirectoryName(entry)) {
      return;
    }

    const childPath = pathApi.join(parentPath, entry);
    if (yield* isNestedGitRoot({ dirPath: childPath, scanRoot: repoRoot })) {
      return yield* Ref.update(excludedRef, (paths) =>
        A.append(paths, normalizeRepoPath(pathApi, repoRoot, childPath))
      );
    }

    return yield* walk(childPath, depth + 1, includeFile);
  });

  // Repo-root agent docs are enumerated before the config roots, and the order is load-bearing.
  // `walk` short-circuits on `maxFiles` up front and the collected paths are only sorted at the
  // end, so whatever is walked last is what a full budget drops. A single pathological directory
  // under a config root — a non-git leftover beneath `.claude/worktrees`, say — could therefore
  // exhaust the budget and starve `AGENTS.md`/`CLAUDE.md` out of the snapshot entirely. That is
  // worse than truncation: both are session-scope paths, so losing them silently changes the
  // session/baseline split and corrupts `sessionHash` rather than merely shrinking the snapshot.
  yield* walk(repoRoot, 0, isAgentDocName);
  yield* Effect.forEach(CONFIG_ROOTS, (rootName) => walk(pathApi.join(repoRoot, rootName), 0, () => true), {
    discard: true,
  });

  return {
    excludedNestedRootPaths: pipe(yield* Ref.get(excludedRef), A.dedupe, A.sort(Order.String)),
    paths: pipe(yield* Ref.get(pathsRef), A.dedupe, A.sort(Order.String)),
    truncationReason: yield* Ref.get(truncationRef),
  };
});

const readSnapshotFiles = Effect.fn("AiMetrics.readConfigSnapshotFiles")(function* (
  repoRoot: string,
  paths: ReadonlyArray<string>,
  budget: AiMetricsConfigSnapshotBudget
): Effect.fn.Return<ConfigSnapshotRead, AiMetricsConfigSnapshotError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  const candidates = yield* Effect.forEach(
    paths,
    Effect.fnUntraced(function* (filePath) {
      const info = yield* fs
        .stat(filePath)
        .pipe(Effect.mapError((cause) => configSnapshotFailure("Failed to stat config snapshot file.", cause)));
      return { filePath, sizeBytes: fileSizeBytes(info) };
    }),
    { concurrency: 16 }
  );
  const selected = A.reduce(
    candidates,
    {
      included: A.empty<{ readonly filePath: string; readonly sizeBytes: number }>(),
      skippedOversizeFileCount: 0,
      totalBytes: 0,
      truncationReason: O.none<AiMetricsConfigSnapshotTruncationReason>(),
    },
    (state, candidate) => {
      if (O.isSome(state.truncationReason)) return state;
      if (candidate.sizeBytes > budget.maxFileBytes) {
        return { ...state, skippedOversizeFileCount: state.skippedOversizeFileCount + 1 };
      }
      if (state.totalBytes + candidate.sizeBytes > budget.maxTotalBytes) {
        return {
          ...state,
          truncationReason: O.some(AiMetricsConfigSnapshotTruncationReason.Enum["max-total-bytes"]),
        };
      }
      return {
        ...state,
        included: A.prepend(state.included, candidate),
        totalBytes: state.totalBytes + candidate.sizeBytes,
      };
    }
  );
  const files = yield* Effect.forEach(
    A.reverse(selected.included),
    Effect.fnUntraced(function* ({ filePath, sizeBytes }) {
      const content = yield* fs
        .readFileString(filePath)
        .pipe(Effect.mapError((cause) => configSnapshotFailure("Failed to read config snapshot file.", cause)));
      return { content, relativePath: normalizeRepoPath(pathApi, repoRoot, filePath), sizeBytes };
    }),
    { concurrency: 16 }
  );

  return {
    files,
    skippedOversizeFileCount: selected.skippedOversizeFileCount,
    totalBytes: selected.totalBytes,
    truncationReason: selected.truncationReason,
  };
});

const hashSnapshotFiles = Effect.fn("AiMetrics.hashConfigSnapshotFiles")(function* (
  files: ReadonlyArray<ConfigSnapshotReadFile>
) {
  return pipe(
    yield* Effect.forEach(
      files,
      Effect.fnUntraced(function* (file: ConfigSnapshotReadFile) {
        return AiMetricsConfigSnapshotFile.make({
          contentHash: yield* hashPublicTextSha256(file.content),
          relativePath: file.relativePath,
          scope: scopeFor(file.relativePath),
          sizeBytes: file.sizeBytes,
        });
      }),
      { concurrency: 16 }
    ),
    A.sort(byRelativePathAscending)
  );
});

const snapshotHashInput: (files: ReadonlyArray<AiMetricsConfigSnapshotFile>) => string = flow(
  A.map((file) => `${file.relativePath}\u0000${file.contentHash}`),
  A.join("\n")
);

const scopedSnapshotHash = Effect.fn("AiMetrics.scopedConfigSnapshotHash")(function* (
  prefix: string,
  files: ReadonlyArray<AiMetricsConfigSnapshotFile>,
  scope: AiMetricsConfigScope
) {
  return yield* hashPublicTextSha256(
    `${prefix}\n${snapshotHashInput(A.filter(files, (file) => file.scope === scope))}`
  );
});

const elapsedSince = (startedAtMillis: number): Effect.Effect<number> =>
  Effect.map(Clock.currentTimeMillis, (nowMillis) => nowMillis - startedAtMillis);

const stageTiming = (
  stage: AiMetricsConfigSnapshotStage,
  durationMillis: number,
  fileCount: number,
  byteCount: number
): AiMetricsConfigSnapshotStageTiming =>
  AiMetricsConfigSnapshotStageTiming.make({ byteCount, durationMillis, fileCount, stage });

const fileByRelativePath = (
  files: ReadonlyArray<AiMetricsConfigSnapshotFile>,
  relativePath: string
): O.Option<AiMetricsConfigSnapshotFile> => A.findFirst(files, (file) => file.relativePath === relativePath);

const snapshotDiff = (
  files: ReadonlyArray<AiMetricsConfigSnapshotFile>,
  previousFiles: ReadonlyArray<AiMetricsConfigSnapshotFile>
): AiMetricsConfigSnapshotDiff => {
  const currentPaths = pipe(
    A.map(files, (file) => file.relativePath),
    A.sort(Order.String)
  );
  const previousPaths = pipe(
    A.map(previousFiles, (file) => file.relativePath),
    A.sort(Order.String)
  );
  const addedPaths = pipe(
    currentPaths,
    A.filter((relativePath) => O.isNone(fileByRelativePath(previousFiles, relativePath))),
    A.sort(Order.String)
  );
  const removedPaths = pipe(
    previousPaths,
    A.filter((relativePath) => O.isNone(fileByRelativePath(files, relativePath))),
    A.sort(Order.String)
  );
  const modifiedPaths = pipe(
    files,
    A.filter((file) =>
      pipe(
        fileByRelativePath(previousFiles, file.relativePath),
        O.exists((previousFile) => previousFile.contentHash !== file.contentHash)
      )
    ),
    A.map((file) => file.relativePath),
    A.sort(Order.String)
  );
  const unchangedPaths = pipe(
    files,
    A.filter((file) =>
      pipe(
        fileByRelativePath(previousFiles, file.relativePath),
        O.exists((previousFile) => previousFile.contentHash === file.contentHash)
      )
    ),
    A.map((file) => file.relativePath),
    A.sort(Order.String)
  );

  return AiMetricsConfigSnapshotDiff.make({
    addedPaths,
    modifiedPaths,
    removedPaths,
    unchangedPaths,
  });
};

const changedPathsFor = (diff: AiMetricsConfigSnapshotDiff): ReadonlyArray<string> =>
  pipe(
    A.appendAll(A.appendAll(diff.addedPaths, diff.modifiedPaths), diff.removedPaths),
    A.dedupe,
    A.sort(Order.String)
  );

const configSnapshotFailure = (message: string, cause: unknown): AiMetricsConfigSnapshotError =>
  AiMetricsConfigSnapshotError.make({ cause, message });

const readPreviousSnapshotAt = Effect.fn("AiMetrics.readPreviousConfigSnapshotAt")(function* (
  previousSnapshotPath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(previousSnapshotPath)
    .pipe(
      Effect.mapError((cause) =>
        configSnapshotFailure("Failed to inspect previous AI metrics config snapshot artifact.", cause)
      )
    );
  if (!exists) {
    return O.none<AiMetricsConfigSnapshotResult>();
  }

  const content = yield* fs
    .readFileString(previousSnapshotPath)
    .pipe(
      Effect.mapError((cause) =>
        configSnapshotFailure("Failed to read previous AI metrics config snapshot artifact.", cause)
      )
    );

  return yield* AiMetricsConfigSnapshotResult.decodeJsonEffect(content).pipe(
    Effect.asSome,
    Effect.mapError((cause) =>
      configSnapshotFailure("Failed to decode previous AI metrics config snapshot artifact.", cause)
    )
  );
});

const readPreviousSnapshot = (previousSnapshotPath: O.Option<string>) =>
  O.match(previousSnapshotPath, {
    onNone: () => Effect.succeed(O.none<AiMetricsConfigSnapshotResult>()),
    onSome: readPreviousSnapshotAt,
  });

/**
 * Build a deterministic, bounded snapshot of repo-owned agent-facing configuration.
 *
 * **Details**
 *
 * The walk stops at every nested git root it meets, so a linked worktree living
 * inside the scan root is recorded as an exclusion rather than folded into this
 * root's manifest. Depth, file-count, per-file byte, and total byte budgets from
 * {@link AiMetricsConfigSnapshotBudget} bound what survives the boundary, and
 * every included file is tagged `session` or `baseline` so attribution can tell
 * an operator settings change apart from repo guidance drift.
 *
 * **Gotchas**
 *
 * The first bounded snapshot taken after an unbounded one reports every file the
 * old walk wrongly included as removed, and produces a new `configHash`. That is
 * the bound landing, not data loss. Enumeration is sorted before truncation, so
 * a truncated snapshot is deterministic rather than filesystem-order dependent.
 *
 * **Example** (Snapshotting a repo root)
 *
 * ```ts
 * import { AiMetricsConfigSnapshotInput, makeAiMetricsConfigSnapshot } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 *
 * const program = makeAiMetricsConfigSnapshot(
 *   AiMetricsConfigSnapshotInput.make({ repoRoot: "/repo" })
 * ).pipe(Effect.provide(NodeServices.layer))
 *
 * console.log(program)
 * ```
 *
 * @param input - Repo root, label, budget, and optional previous snapshot pointer.
 * @returns The snapshot manifest, its bounds report, and per-stage timings.
 * @category services
 * @since 0.0.0
 */
export const makeAiMetricsConfigSnapshot = Effect.fn("AiMetrics.makeAiMetricsConfigSnapshot")(
  function* (input: AiMetricsConfigSnapshotInput) {
    const pathApi = yield* Path.Path;
    const repoRoot = pathApi.resolve(input.repoRoot);

    const enumerateStartedAt = yield* Clock.currentTimeMillis;
    const enumeration = yield* enumerateSnapshotPaths(repoRoot, input.budget);
    const enumerateMillis = yield* elapsedSince(enumerateStartedAt);

    const readStartedAt = yield* Clock.currentTimeMillis;
    const read = yield* readSnapshotFiles(repoRoot, enumeration.paths, input.budget);
    const readMillis = yield* elapsedSince(readStartedAt);

    const hashStartedAt = yield* Clock.currentTimeMillis;
    const files = yield* hashSnapshotFiles(read.files);
    const snapshotHash = yield* hashPublicTextSha256(`ai-metrics-config-snapshot-v1\n${snapshotHashInput(files)}`);
    const baselineHash = yield* scopedSnapshotHash(
      "ai-metrics-config-baseline-v1",
      files,
      AiMetricsConfigScope.Enum.baseline
    );
    const sessionHash = yield* scopedSnapshotHash(
      "ai-metrics-config-session-v1",
      files,
      AiMetricsConfigScope.Enum.session
    );
    const hashMillis = yield* elapsedSince(hashStartedAt);

    const diffStartedAt = yield* Clock.currentTimeMillis;
    const previous = yield* readPreviousSnapshot(input.previousSnapshotPath);
    const previousFiles = pipe(
      previous,
      O.map((snapshot) => snapshot.files),
      O.getOrElse(A.empty<AiMetricsConfigSnapshotFile>)
    );
    const diff = snapshotDiff(files, previousFiles);
    const diffMillis = yield* elapsedSince(diffStartedAt);

    const relativePaths = A.map(files, (file) => file.relativePath);
    const changedPaths = changedPathsFor(diff);
    const previousSnapshotId = pipe(
      previous,
      O.map((snapshot) => snapshot.snapshot.snapshotId)
    );
    const truncationReason = O.orElse(enumeration.truncationReason, () => read.truncationReason);
    const bounds = AiMetricsConfigSnapshotBoundsReport.make({
      budget: input.budget,
      excludedNestedRootPaths: enumeration.excludedNestedRootPaths,
      skippedOversizeFileCount: read.skippedOversizeFileCount,
      totalBytes: read.totalBytes,
      truncated: O.isSome(truncationReason),
      truncationReason,
    });

    return AiMetricsConfigSnapshotResult.make({
      baselineHash,
      bounds,
      excludedDirectoryNames: ConfigSnapshotExcludedDirName.Options,
      diff,
      fileCount: A.length(files),
      files,
      previousSnapshotId,
      sessionHash,
      snapshot: ConfigSnapshot.make({
        changedPaths,
        configHash: snapshotHash,
        includedPaths: relativePaths,
        label: input.label,
        previousSnapshotId,
        snapshotId: `config-${snapshotHash}`,
      }),
      // The `write` stage is deliberately absent: this function writes nothing.
      // The artifact writes are measured where they happen, in
      // `writeAiMetricsConfigSnapshotArtifacts`, which cannot fold its own
      // duration back into the manifest it is writing.
      stageTimings: [
        stageTiming(AiMetricsConfigSnapshotStage.Enum.enumerate, enumerateMillis, A.length(enumeration.paths), 0),
        stageTiming(AiMetricsConfigSnapshotStage.Enum.read, readMillis, A.length(read.files), read.totalBytes),
        stageTiming(AiMetricsConfigSnapshotStage.Enum.hash, hashMillis, A.length(files), read.totalBytes),
        stageTiming(AiMetricsConfigSnapshotStage.Enum.diff, diffMillis, A.length(files), 0),
      ],
    });
  },
  (effect, input) =>
    effect.pipe(
      Effect.tap((result) =>
        Effect.annotateCurrentSpan({
          "ai_metrics.config_snapshot.excluded_nested_root_count": A.length(result.bounds.excludedNestedRootPaths),
          "ai_metrics.config_snapshot.file_count": result.fileCount,
          "ai_metrics.config_snapshot.total_bytes": result.bounds.totalBytes,
          "ai_metrics.config_snapshot.truncated": result.bounds.truncated,
        })
      ),
      Effect.withSpan("repo_ai_metrics.config_snapshot.make", {
        attributes: {
          "ai_metrics.config_snapshot.max_files": input.budget.maxFiles,
          "ai_metrics.config_snapshot.max_total_bytes": input.budget.maxTotalBytes,
        },
      })
    )
);

/**
 * Persist a config snapshot manifest and latest pointer for future diff attribution.
 *
 * **Details**
 *
 * The manifest is named by `snapshotId` and kept forever; `latest.json` is the
 * moving pointer the next run diffs against. The pointer is written to a
 * writer-unique `.tmp` sibling and promoted with a rename, so a crash mid-write
 * leaves the previous pointer intact rather than a half-written one that fails
 * to decode. The `.tmp` name carries a per-writer token — the same idiom as the
 * identity registry — because a single fixed `latest.json.tmp` lets two
 * shared-root runs interleave: one writer renames the other's bytes and the
 * second rename fails with `NotFound` after its derived rows already landed.
 *
 * The write duration is measured here, around the real filesystem work, and
 * annotated on the current span — it cannot ride inside the manifest, which is
 * one of the files being written.
 *
 * **Gotchas**
 *
 * Pass `commitLatest: false` to archive a manifest without moving the diff
 * baseline — a dry run that promotes the pointer makes the following real run
 * report an empty diff.
 *
 * **Example** (Writing a manifest and promoting the pointer)
 *
 * ```ts
 * import {
 *   AiMetricsConfigSnapshotDiff,
 *   AiMetricsConfigSnapshotResult,
 *   ConfigSnapshot,
 *   writeAiMetricsConfigSnapshotArtifacts
 * } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 *
 * const result = AiMetricsConfigSnapshotResult.make({
 *   excludedDirectoryNames: [],
 *   diff: AiMetricsConfigSnapshotDiff.make({
 *     addedPaths: [],
 *     modifiedPaths: [],
 *     removedPaths: [],
 *     unchangedPaths: []
 *   }),
 *   fileCount: 0,
 *   files: [],
 *   snapshot: ConfigSnapshot.make({
 *     changedPaths: [],
 *     configHash: "config-hash",
 *     label: "repo-local-agent-config",
 *     snapshotId: "config-1"
 *   })
 * })
 *
 * const program = writeAiMetricsConfigSnapshotArtifacts({
 *   outputDir: "/home/dev/.local/state/beep/ai-metrics/config-snapshots",
 *   result
 * }).pipe(Effect.provide(NodeServices.layer))
 *
 * Effect.runPromise(program).then((paths) => console.log(paths.manifestPath))
 * // /home/dev/.local/state/beep/ai-metrics/config-snapshots/config-1.json
 * ```
 *
 * @effects
 * - Creates the config snapshot output directory when missing.
 * - Writes a versioned manifest named by `snapshotId`.
 * - Writes and atomically promotes `latest.json` when `commitLatest` is true.
 * @category services
 * @since 0.0.0
 */
export const writeAiMetricsConfigSnapshotArtifacts = Effect.fn("AiMetrics.writeAiMetricsConfigSnapshotArtifacts")(
  function* ({
    commitLatest = true,
    outputDir,
    result,
  }: {
    readonly commitLatest?: boolean;
    readonly outputDir: string;
    readonly result: AiMetricsConfigSnapshotResult;
  }) {
    const fs = yield* FileSystem.FileSystem;
    const pathApi = yield* Path.Path;
    const writeStartedAt = yield* Clock.currentTimeMillis;
    const content = yield* configSnapshotToJson(result);
    const manifestPath = pathApi.join(outputDir, `${result.snapshot.snapshotId}.json`);
    const latestPath = pathApi.join(outputDir, "latest.json");
    const writerEntropy = yield* Random.nextIntBetween(0, 0xffffffff);
    const latestTmpPath = pathApi.join(outputDir, `latest.json.${writeStartedAt}-${writerEntropy.toString(16)}.tmp`);
    yield* fs
      .makeDirectory(outputDir, { recursive: true })
      .pipe(
        Effect.mapError((cause) =>
          configSnapshotFailure("Failed to create AI metrics config snapshot artifact directory.", cause)
        )
      );
    yield* fs
      .writeFileString(manifestPath, content)
      .pipe(
        Effect.mapError((cause) => configSnapshotFailure("Failed to write AI metrics config snapshot manifest.", cause))
      );
    if (commitLatest) {
      yield* fs
        .writeFileString(latestTmpPath, content)
        .pipe(
          Effect.mapError((cause) =>
            configSnapshotFailure("Failed to write AI metrics latest config snapshot temporary pointer.", cause)
          )
        );
      yield* fs
        .rename(latestTmpPath, latestPath)
        .pipe(
          Effect.mapError((cause) =>
            configSnapshotFailure("Failed to promote AI metrics latest config snapshot pointer.", cause)
          )
        );
    }
    const writeMillis = yield* elapsedSince(writeStartedAt);
    yield* Effect.annotateCurrentSpan({ "ai_metrics.config_snapshot.write_millis": writeMillis });

    return { latestPath, manifestPath, writeMillis };
  }
);

/**
 * Encode a config snapshot manifest as the JSON text written to disk.
 *
 * **Details**
 *
 * Encoding goes through the schema rather than `JSON.stringify`, so the text is
 * exactly what {@link AiMetricsConfigSnapshotResult} decodes back and optional
 * keys that are absent stay absent instead of becoming `undefined`.
 *
 * **Example** (Encoding a manifest before writing it)
 *
 * ```ts
 * import {
 *   AiMetricsConfigSnapshotDiff,
 *   AiMetricsConfigSnapshotResult,
 *   ConfigSnapshot,
 *   configSnapshotToJson
 * } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const result = AiMetricsConfigSnapshotResult.make({
 *   excludedDirectoryNames: [],
 *   diff: AiMetricsConfigSnapshotDiff.make({
 *     addedPaths: [],
 *     modifiedPaths: [],
 *     removedPaths: [],
 *     unchangedPaths: []
 *   }),
 *   fileCount: 0,
 *   files: [],
 *   snapshot: ConfigSnapshot.make({
 *     changedPaths: [],
 *     configHash: "config-hash",
 *     label: "repo-local-agent-config",
 *     snapshotId: "config-1"
 *   })
 * })
 *
 * const json = Effect.runSync(configSnapshotToJson(result))
 *
 * console.log(json.includes("config-hash")) // true
 * ```
 *
 * @see {@link writeAiMetricsConfigSnapshotArtifacts} for the writer that persists this text.
 * @category utilities
 * @since 0.0.0
 */
export const configSnapshotToJson: (
  result: AiMetricsConfigSnapshotResult
) => Effect.Effect<string, AiMetricsConfigSnapshotError> = Effect.fn("AiMetrics.configSnapshotToJson")(
  function* (result) {
    return yield* AiMetricsConfigSnapshotResult.encodeJsonEffect(result).pipe(
      Effect.mapError((cause) => configSnapshotFailure("Failed to encode AI metrics config snapshot as JSON.", cause))
    );
  }
);
