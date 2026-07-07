/**
 * Source discovery for repo AI metrics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Clock, Effect, FileSystem, flow, Order, Path, pipe, Stream } from "effect";
import * as S from "effect/Schema";
import { fileSizeBytes } from "./internal/file-info.ts";
import { collectJsonlFiles, statOption } from "./internal/jsonl-discovery.ts";
import { normalizedRelativePath, repoPathToClaudeProjectName, transcriptLines } from "./internal/transcript-utils.ts";
import {
  AiMetricsDeployTarget,
  AiMetricsSourceRole,
  AiMetricsTranscriptSource,
  CodexTranscriptLine,
} from "./models.ts";
import {
  AiMetricsHashSaltStatus,
  hashPrivateIdentifier,
  makeAiMetricsSourceAttribution,
  resolveAiMetricsHashSaltStatus,
} from "./privacy.ts";

const $I = $RepoAiMetricsId.create("source-discovery");

const DEFAULT_MAX_FILES = 200;

/**
 * P1 source discovery availability status.
 *
 * @example
 * ```ts
 * import { AiMetricsSourceStatus } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsSourceStatus.Enum.available)
 * ```
 * @category models
 * @since 0.0.0
 */
export const AiMetricsSourceStatus = LiteralKit(["available", "missing", "unavailable"]).pipe(
  $I.annoteSchema("AiMetricsSourceStatus", {
    description: "Availability status for a discovered AI metrics source root.",
  })
);

/**
 * Runtime type for {@link AiMetricsSourceStatus}.
 *
 * @example
 * ```ts
 * import type { AiMetricsSourceStatus } from "@beep/repo-ai-metrics"
 * const status: AiMetricsSourceStatus = "available"
 * console.log(status)
 * ```
 * @category models
 * @since 0.0.0
 */
export type AiMetricsSourceStatus = typeof AiMetricsSourceStatus.Type;

/**
 * Input for local AI metrics source discovery.
 *
 * @example
 * ```ts
 * import { AiMetricsSourceDiscoveryInput } from "@beep/repo-ai-metrics"
 *
 * const input = AiMetricsSourceDiscoveryInput.make({
 *   hashSalt: "salt",
 *   homeDir: "/home/me",
 *   maxFiles: 25,
 *   repoRoot: "/repo"
 * })
 * console.log(input.target)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AiMetricsSourceDiscoveryInput extends S.Class<AiMetricsSourceDiscoveryInput>(
  $I`AiMetricsSourceDiscoveryInput`
)(
  {
    claudeProjectsRoot: S.optionalKey(S.String),
    codexSessionsRoot: S.optionalKey(S.String),
    hashSalt: S.optionalKey(S.String),
    homeDir: S.String,
    includeAll: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
    maxFiles: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(DEFAULT_MAX_FILES)),
      S.withDecodingDefaultKey(Effect.succeed(DEFAULT_MAX_FILES))
    ),
    maxFileBytes: S.optionalKey(S.Finite),
    openClawUnitPath: S.optionalKey(S.String),
    repoRoot: S.String,
    sinceEpochMillis: S.optionalKey(S.Finite),
    target: AiMetricsDeployTarget.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsDeployTarget.Enum.local)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsDeployTarget.Enum.local))
    ),
  },
  $I.annote("AiMetricsSourceDiscoveryInput", {
    description: "Configurable roots and scan bounds for local AI metrics source discovery.",
  })
) {}

/**
 * One transcript or source metadata file discovered for AI metrics.
 *
 * @example
 * ```ts
 * import { AiMetricsDiscoveredTranscriptFile } from "@beep/repo-ai-metrics"
 *
 * const file = AiMetricsDiscoveredTranscriptFile.make({
 *   modifiedAtMillis: 1_717_000_000_000,
 *   sessionIdHash: "session-hash",
 *   sizeBytes: 4096,
 *   sourceKind: "codex",
 *   sourcePathHash: "source-hash",
 *   sourceRole: "primary"
 * })
 * console.log(file.sizeBytes)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AiMetricsDiscoveredTranscriptFile extends S.Class<AiMetricsDiscoveredTranscriptFile>(
  $I`AiMetricsDiscoveredTranscriptFile`
)(
  {
    agentNicknameHash: S.optionalKey(S.String),
    agentRoleHash: S.optionalKey(S.String),
    forkedFromIdHash: S.optionalKey(S.String),
    modifiedAtMillis: S.Finite,
    parentSessionIdHash: S.optionalKey(S.String),
    parentThreadIdHash: S.optionalKey(S.String),
    sessionIdHash: S.optionalKey(S.String),
    sizeBytes: S.Finite,
    sourceKind: AiMetricsTranscriptSource,
    sourcePathHash: S.String,
    sourceRole: AiMetricsSourceRole,
    threadSpawn: S.optionalKey(S.Boolean),
  },
  $I.annote("AiMetricsDiscoveredTranscriptFile", {
    description: "Discovered local source file with private identifiers represented by salted hashes.",
  })
) {}

/**
 * Source-level discovery summary.
 *
 * @example
 * ```ts
 * import { AiMetricsDiscoveredSource } from "@beep/repo-ai-metrics"
 *
 * const source = AiMetricsDiscoveredSource.make({
 *   fileCount: 0,
 *   files: [],
 *   rootPathHash: "root-hash",
 *   sourceKind: "claude",
 *   status: "missing"
 * })
 * console.log(source.fileCount)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AiMetricsDiscoveredSource extends S.Class<AiMetricsDiscoveredSource>($I`AiMetricsDiscoveredSource`)(
  {
    candidateFileCount: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    fileCount: S.Finite,
    files: S.Array(AiMetricsDiscoveredTranscriptFile),
    includedFileCount: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    limitedByMaxFiles: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
    message: S.optionalKey(S.String),
    newestModifiedAtMillis: S.optionalKey(S.Finite),
    rootPathHash: S.String,
    sizeExcludedFileCount: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    sourceKind: AiMetricsTranscriptSource,
    status: AiMetricsSourceStatus,
  },
  $I.annote("AiMetricsDiscoveredSource", {
    description: "Discovery summary for one local AI-agent transcript source.",
  })
) {}

/**
 * Complete P1 source discovery result.
 *
 * @example
 * ```ts
 * import { AiMetricsSourceDiscoveryResult } from "@beep/repo-ai-metrics"
 *
 * const result = AiMetricsSourceDiscoveryResult.make({
 *   discoveredFileCount: 0,
 *   generatedAtEpochMillis: 1_717_000_000_000,
 *   hashSaltStatus: "provided",
 *   homeDirHash: "home-hash",
 *   includeAll: false,
 *   maxFiles: 200,
 *   repoRootHash: "repo-hash",
 *   sources: [],
 *   target: "local"
 * })
 * console.log(result.hashSaltStatus)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AiMetricsSourceDiscoveryResult extends S.Class<AiMetricsSourceDiscoveryResult>(
  $I`AiMetricsSourceDiscoveryResult`
)(
  {
    discoveredFileCount: S.Finite,
    generatedAtEpochMillis: S.Finite,
    hashSaltStatus: AiMetricsHashSaltStatus,
    homeDirHash: S.String,
    includeAll: S.Boolean,
    maxFiles: S.Finite,
    maxFileBytes: S.optionalKey(S.Finite),
    repoRootHash: S.String,
    sinceEpochMillis: S.optionalKey(S.Finite),
    sources: S.Array(AiMetricsDiscoveredSource),
    target: AiMetricsDeployTarget,
  },
  $I.annote("AiMetricsSourceDiscoveryResult", {
    description: "Machine-readable source discovery output for the AI metrics local smoke target.",
  })
) {}

/**
 * Error raised by source discovery.
 *
 * @example
 * ```ts
 * import { AiMetricsSourceDiscoveryError } from "@beep/repo-ai-metrics"
 *
 * const error = AiMetricsSourceDiscoveryError.make({
 *   cause: "stat failed",
 *   message: "Failed to stat AI metrics source file."
 * })
 * console.log(error.message)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsSourceDiscoveryError extends TaggedErrorClass<AiMetricsSourceDiscoveryError>(
  $I`AiMetricsSourceDiscoveryError`
)(
  "AiMetricsSourceDiscoveryError",
  {
    cause: S.Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annote("AiMetricsSourceDiscoveryError", {
    description: "Typed failure raised by AI metrics source discovery.",
  })
) {}

const encodeSourceDiscoveryJson = S.encodeUnknownEffect(S.fromJsonString(AiMetricsSourceDiscoveryResult));

const byPathHashAscending: Order.Order<AiMetricsDiscoveredTranscriptFile> = Order.mapInput(
  Order.String,
  (file) => file.sourcePathHash
);
const byModifiedDescending: Order.Order<AiMetricsDiscoveredTranscriptFile> = Order.mapInput(
  Order.Number,
  (file) => -file.modifiedAtMillis
);

type SourceCandidateFile = {
  readonly modifiedAtMillis: number;
  readonly sourcePath: string;
};

const byCandidatePathAscending: Order.Order<SourceCandidateFile> = Order.mapInput(
  Order.String,
  (file) => file.sourcePath
);
const byCandidateModifiedDescending: Order.Order<SourceCandidateFile> = Order.mapInput(
  Order.Number,
  (file) => -file.modifiedAtMillis
);

const fileSystemFailure = (message: string, cause: unknown): AiMetricsSourceDiscoveryError =>
  AiMetricsSourceDiscoveryError.make({ cause, message });

const contentHasCodexSessionMetaLine: (content: string) => boolean = flow(
  transcriptLines,
  A.some((line) =>
    pipe(
      CodexTranscriptLine.decodeJsonOption(line),
      O.exists((decoded) => decoded.type === "session_meta")
    )
  )
);

const readAttributionContent = (
  fs: FileSystem.FileSystem,
  sourceKind: AiMetricsTranscriptSource,
  sourcePath: string
) => {
  if (sourceKind !== AiMetricsTranscriptSource.Enum.codex) {
    return Effect.succeed("");
  }

  return fs.stream(sourcePath, { chunkSize: 64 * 1024 }).pipe(
    Stream.decodeText(),
    Stream.scan("", (content, chunk) => `${content}${chunk}`),
    Stream.takeUntil(contentHasCodexSessionMetaLine),
    Stream.runLast,
    Effect.map(O.getOrElse(() => ""))
  );
};

const optionalModifiedAtMillis = (info: FileSystem.File.Info): O.Option<number> =>
  pipe(
    info.mtime,
    O.map((mtime) => mtime.getTime())
  );

const modifiedAtMillis = (info: FileSystem.File.Info): number =>
  pipe(
    optionalModifiedAtMillis(info),
    O.getOrElse(() => 0)
  );

const isWithinModifiedTimeWindow =
  (input: AiMetricsSourceDiscoveryInput) =>
  (info: FileSystem.File.Info): boolean =>
    input.includeAll || input.sinceEpochMillis === undefined || modifiedAtMillis(info) >= input.sinceEpochMillis;

const isWithinSizeWindow =
  (input: AiMetricsSourceDiscoveryInput) =>
  (info: FileSystem.File.Info): boolean =>
    input.maxFileBytes === undefined || fileSizeBytes(info) <= input.maxFileBytes;

const sessionIdFromPath = (pathApi: Path.Path, sourcePath: string): string =>
  pipe(pathApi.basename(sourcePath), Str.replace(/\.jsonl$/u, ""));

const makeDiscoveredTranscriptFile = Effect.fn("AiMetrics.makeDiscoveredTranscriptFile")(function* ({
  hashSalt,
  root,
  sourceKind,
  sourcePath,
}: {
  readonly hashSalt?: string;
  readonly root: string;
  readonly sourceKind: AiMetricsTranscriptSource;
  readonly sourcePath: string;
}) {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  const info = yield* fs
    .stat(sourcePath)
    .pipe(Effect.mapError((cause) => fileSystemFailure("Failed to stat AI metrics source file.", cause)));
  const content = yield* readAttributionContent(fs, sourceKind, sourcePath).pipe(
    Effect.mapError((cause) => fileSystemFailure("Failed to read AI metrics source file.", cause))
  );
  const relativePath = normalizedRelativePath(pathApi, root, sourcePath);
  const attribution = yield* makeAiMetricsSourceAttribution({
    content,
    ...O.getSomesStruct({ hashSalt: O.fromUndefinedOr(hashSalt) }),
    relativePath,
    sourceKind,
    sourcePath,
  }).pipe(Effect.mapError((cause) => fileSystemFailure("Failed to derive AI metrics source attribution.", cause)));
  const fallbackSessionIdHash = yield* hashPrivateIdentifier(sessionIdFromPath(pathApi, sourcePath), hashSalt);

  return AiMetricsDiscoveredTranscriptFile.make({
    ...O.getSomesStruct({ agentNicknameHash: O.fromUndefinedOr(attribution.agentNicknameHash) }),
    ...O.getSomesStruct({ agentRoleHash: O.fromUndefinedOr(attribution.agentRoleHash) }),
    ...O.getSomesStruct({ forkedFromIdHash: O.fromUndefinedOr(attribution.forkedFromIdHash) }),
    modifiedAtMillis: modifiedAtMillis(info),
    ...O.getSomesStruct({ parentSessionIdHash: O.fromUndefinedOr(attribution.parentSessionIdHash) }),
    ...O.getSomesStruct({ parentThreadIdHash: O.fromUndefinedOr(attribution.parentThreadIdHash) }),
    sessionIdHash: attribution.sessionIdHash ?? fallbackSessionIdHash,
    sizeBytes: fileSizeBytes(info),
    sourceKind,
    sourcePathHash: yield* hashPrivateIdentifier(sourcePath, hashSalt),
    sourceRole: attribution.sourceRole,
    ...O.getSomesStruct({ threadSpawn: O.fromUndefinedOr(attribution.threadSpawn) }),
  });
});

const newestModifiedAtFields = (
  files: ReadonlyArray<AiMetricsDiscoveredTranscriptFile>
): { readonly newestModifiedAtMillis?: number } => {
  const newest = pipe(
    files,
    A.map((file) => file.modifiedAtMillis),
    A.sort(Order.mapInput(Order.Number, (value: number) => -value)),
    A.head
  );

  return O.isSome(newest) ? { newestModifiedAtMillis: newest.value } : {};
};

const discoverJsonlSource = Effect.fn("AiMetrics.discoverJsonlSource")(function* ({
  input,
  root,
  sourceKind,
}: {
  readonly input: AiMetricsSourceDiscoveryInput;
  readonly root: string;
  readonly sourceKind: AiMetricsTranscriptSource;
}) {
  const rootInfo = yield* statOption(root);
  const rootPathHash = yield* hashPrivateIdentifier(root, input.hashSalt);

  if (O.isNone(rootInfo)) {
    return AiMetricsDiscoveredSource.make({
      fileCount: 0,
      files: [],
      message: "source root does not exist",
      rootPathHash,
      sourceKind,
      status: AiMetricsSourceStatus.Enum.missing,
    });
  }

  if (rootInfo.value.type !== "Directory") {
    return AiMetricsDiscoveredSource.make({
      fileCount: 0,
      files: [],
      message: "source root is not a directory",
      rootPathHash,
      sourceKind,
      status: AiMetricsSourceStatus.Enum.unavailable,
    });
  }

  const fs = yield* FileSystem.FileSystem;
  const allFiles = yield* collectJsonlFiles(root);
  const scannedFiles = yield* Effect.forEach(
    allFiles,
    Effect.fnUntraced(function* (sourcePath) {
      const info = yield* fs.stat(sourcePath).pipe(Effect.option);
      if (O.isNone(info) || info.value.type !== "File" || !isWithinModifiedTimeWindow(input)(info.value)) {
        return { candidate: O.none<SourceCandidateFile>(), excludedByMaxFileBytes: false };
      }

      if (!isWithinSizeWindow(input)(info.value)) {
        return { candidate: O.none<SourceCandidateFile>(), excludedByMaxFileBytes: true };
      }

      return {
        candidate: O.some({ modifiedAtMillis: modifiedAtMillis(info.value), sourcePath }),
        excludedByMaxFileBytes: false,
      };
    }),
    { concurrency: 16 }
  );
  const candidates = pipe(
    scannedFiles,
    A.map((scan) => scan.candidate),
    A.getSomes,
    A.sort(byCandidatePathAscending),
    A.sort(byCandidateModifiedDescending)
  );
  const sizeExcludedFileCount = pipe(
    scannedFiles,
    A.filter((scan) => scan.excludedByMaxFileBytes),
    A.length
  );
  const includedCandidates = A.take(candidates, input.maxFiles);
  const files = pipe(
    yield* Effect.forEach(
      includedCandidates,
      (candidate) =>
        makeDiscoveredTranscriptFile({
          root,
          sourceKind,
          sourcePath: candidate.sourcePath,
          ...O.getSomesStruct({ hashSalt: O.fromUndefinedOr(input.hashSalt) }),
        }).pipe(Effect.option),
      { concurrency: 16 }
    ),
    A.getSomes
  );
  const includedFiles = pipe(files, A.sort(byPathHashAscending), A.sort(byModifiedDescending));

  return AiMetricsDiscoveredSource.make({
    candidateFileCount: A.length(candidates),
    fileCount: A.length(includedFiles),
    files: includedFiles,
    includedFileCount: A.length(includedFiles),
    limitedByMaxFiles: A.length(candidates) > A.length(includedCandidates),
    rootPathHash,
    sizeExcludedFileCount,
    sourceKind,
    status: AiMetricsSourceStatus.Enum.available,
    ...newestModifiedAtFields(includedFiles),
  });
});

const discoverOpenClawSource = Effect.fn("AiMetrics.discoverOpenClawSource")(function* (
  input: AiMetricsSourceDiscoveryInput
) {
  const pathApi = yield* Path.Path;
  const unitPath =
    input.openClawUnitPath ?? pathApi.join(input.homeDir, ".config/systemd/user/openclaw-gateway.service");
  const unitInfo = yield* statOption(unitPath);
  const rootPathHash = yield* hashPrivateIdentifier(unitPath, input.hashSalt);

  if (O.isNone(unitInfo)) {
    return AiMetricsDiscoveredSource.make({
      fileCount: 0,
      files: [],
      message: "OpenClaw user systemd gateway unit was not found",
      rootPathHash,
      sourceKind: AiMetricsTranscriptSource.Enum.openclaw,
      status: AiMetricsSourceStatus.Enum.missing,
    });
  }

  if (unitInfo.value.type !== "File") {
    return AiMetricsDiscoveredSource.make({
      fileCount: 0,
      files: [],
      message: "OpenClaw user systemd gateway path is not a file",
      rootPathHash,
      sourceKind: AiMetricsTranscriptSource.Enum.openclaw,
      status: AiMetricsSourceStatus.Enum.unavailable,
    });
  }

  if (!isWithinModifiedTimeWindow(input)(unitInfo.value)) {
    return AiMetricsDiscoveredSource.make({
      candidateFileCount: 0,
      fileCount: 0,
      files: [],
      includedFileCount: 0,
      limitedByMaxFiles: false,
      message: "OpenClaw user systemd gateway metadata is outside the selected modified-time window",
      rootPathHash,
      sourceKind: AiMetricsTranscriptSource.Enum.openclaw,
      status: AiMetricsSourceStatus.Enum.available,
    });
  }

  if (!isWithinSizeWindow(input)(unitInfo.value)) {
    return AiMetricsDiscoveredSource.make({
      candidateFileCount: 0,
      fileCount: 0,
      files: [],
      includedFileCount: 0,
      limitedByMaxFiles: false,
      message: "OpenClaw user systemd gateway metadata exceeds the selected byte-size window",
      rootPathHash,
      sizeExcludedFileCount: 1,
      sourceKind: AiMetricsTranscriptSource.Enum.openclaw,
      status: AiMetricsSourceStatus.Enum.available,
    });
  }

  const file = AiMetricsDiscoveredTranscriptFile.make({
    modifiedAtMillis: modifiedAtMillis(unitInfo.value),
    sessionIdHash: yield* hashPrivateIdentifier("openclaw-gateway.service", input.hashSalt),
    sizeBytes: fileSizeBytes(unitInfo.value),
    sourceKind: AiMetricsTranscriptSource.Enum.openclaw,
    sourcePathHash: yield* hashPrivateIdentifier(unitPath, input.hashSalt),
    sourceRole: AiMetricsSourceRole.Enum.gateway_metadata,
  });

  return AiMetricsDiscoveredSource.make({
    candidateFileCount: 1,
    fileCount: 1,
    files: [file],
    includedFileCount: 1,
    limitedByMaxFiles: false,
    message: "OpenClaw discovery is limited to safe gateway metadata in P1",
    newestModifiedAtMillis: file.modifiedAtMillis,
    rootPathHash,
    sourceKind: AiMetricsTranscriptSource.Enum.openclaw,
    status: AiMetricsSourceStatus.Enum.available,
  });
});

/**
 * Discover local AI metrics transcript sources for the smoke target.
 *
 * @effects
 * - Stats configured Codex, Claude, and OpenClaw source roots.
 * - Recursively scans JSONL transcript files up to `maxFiles`.
 * - Reads Codex session metadata only far enough to derive source attribution.
 * - Hashes private local paths and session identifiers before returning results.
 * @example
 * ```ts
 * import { AiMetricsSourceDiscoveryInput, discoverAiMetricsSources } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 * const program = discoverAiMetricsSources(
 *   AiMetricsSourceDiscoveryInput.make({
 *     hashSalt: "salt",
 *     homeDir: "/home/me",
 *     repoRoot: "/repo"
 *   })
 * ).pipe(Effect.provide(NodeServices.layer))
 * console.log(program)
 * ```
 * @category services
 * @since 0.0.0
 */
export const discoverAiMetricsSources = Effect.fn("AiMetrics.discoverAiMetricsSources")(function* (
  input: AiMetricsSourceDiscoveryInput
) {
  const pathApi = yield* Path.Path;
  const repoRoot = pathApi.resolve(input.repoRoot);
  const homeDir = pathApi.resolve(input.homeDir);
  const codexRoot = input.codexSessionsRoot ?? pathApi.join(homeDir, ".codex/sessions");
  const claudeRoot =
    input.claudeProjectsRoot ?? pathApi.join(homeDir, ".claude/projects", repoPathToClaudeProjectName(repoRoot));
  const generatedAtEpochMillis = yield* Clock.currentTimeMillis;
  const sources = yield* Effect.all(
    [
      discoverJsonlSource({
        input,
        root: codexRoot,
        sourceKind: AiMetricsTranscriptSource.Enum.codex,
      }),
      discoverJsonlSource({
        input,
        root: claudeRoot,
        sourceKind: AiMetricsTranscriptSource.Enum.claude,
      }),
      discoverOpenClawSource(input),
    ],
    { concurrency: 3 }
  );

  return AiMetricsSourceDiscoveryResult.make({
    discoveredFileCount: pipe(
      sources,
      A.map((source) => source.fileCount),
      A.reduce(0, (left, right) => left + right)
    ),
    generatedAtEpochMillis,
    hashSaltStatus: resolveAiMetricsHashSaltStatus(input.hashSalt),
    homeDirHash: yield* hashPrivateIdentifier(homeDir, input.hashSalt),
    includeAll: input.includeAll,
    maxFiles: input.maxFiles,
    ...O.getSomesStruct({ maxFileBytes: O.fromUndefinedOr(input.maxFileBytes) }),
    repoRootHash: yield* hashPrivateIdentifier(repoRoot, input.hashSalt),
    sources,
    target: input.target,
    ...O.getSomesStruct({ sinceEpochMillis: O.fromUndefinedOr(input.sinceEpochMillis) }),
  });
});

/**
 * Render a source discovery result as JSON.
 *
 * @example
 * ```ts
 * import { AiMetricsSourceDiscoveryResult, sourceDiscoveryToJson } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const json = Effect.runPromise(
 *   sourceDiscoveryToJson(
 *     AiMetricsSourceDiscoveryResult.make({
 *       discoveredFileCount: 0,
 *       generatedAtEpochMillis: 1_717_000_000_000,
 *       hashSaltStatus: "provided",
 *       homeDirHash: "home-hash",
 *       includeAll: false,
 *       maxFiles: 200,
 *       repoRootHash: "repo-hash",
 *       sources: [],
 *       target: "local"
 *     })
 *   )
 * )
 * console.log(json)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const sourceDiscoveryToJson: (
  result: AiMetricsSourceDiscoveryResult
) => Effect.Effect<string, AiMetricsSourceDiscoveryError> = Effect.fn("AiMetrics.sourceDiscoveryToJson")(
  function* (result) {
    return yield* encodeSourceDiscoveryJson(result).pipe(
      Effect.mapError((cause) =>
        AiMetricsSourceDiscoveryError.make({
          cause,
          message: "Failed to encode AI metrics source discovery result as JSON.",
        })
      )
    );
  }
);
