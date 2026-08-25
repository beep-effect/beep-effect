/**
 * Source discovery for repo AI metrics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Defect, LiteralKit, SchemaUtils, Sha256Hex } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Clock, Effect, FileSystem, flow, Order, Path, pipe, Stream } from "effect";
import * as S from "effect/Schema";
import { fileSizeBytes, modifiedAtMillis } from "./internal/file-info.ts";
import { collectJsonlFiles, statOption } from "./internal/jsonl-discovery.ts";
import { normalizedRelativePath, resolveTranscriptSourceRoots, transcriptLines } from "./internal/transcript-utils.ts";
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
const SourceDiscoveryEpochMillis = S.Natural.pipe(
  $I.annoteSchema("SourceDiscoveryEpochMillis", {
    description: "Non-negative integral epoch milliseconds used by source discovery boundaries.",
  })
);
const SourceDiscoverySha256 = S.toEncoded(Sha256Hex).pipe(
  $I.annoteSchema("SourceDiscoverySha256", {
    description: "Canonical lowercase SHA-256 digest stored in source discovery metadata.",
  })
);
const OptionalSourceString = S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault);
const OptionalSourceNatural = S.OptionFromOptionalKey(S.Natural).pipe(SchemaUtils.withNoneDefault);
const OptionalSourceEpochMillis = S.OptionFromOptionalKey(SourceDiscoveryEpochMillis).pipe(SchemaUtils.withNoneDefault);

/**
 * P1 source discovery availability status.
 *
 * **Example** (Log available status enum)
 *
 * ```ts
 * import { AiMetricsSourceStatus } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsSourceStatus.Enum.available)
 * ```
 *
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
 * **Example** (Assign available status type)
 *
 * ```ts
 * import type { AiMetricsSourceStatus } from "@beep/repo-ai-metrics"
 * const status: AiMetricsSourceStatus = "available"
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsSourceStatus = typeof AiMetricsSourceStatus.Type;

/**
 * Input for local AI metrics source discovery.
 *
 * **Example** (Make discovery input object)
 *
 * ```ts
 * import { AiMetricsSourceDiscoveryInput } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 *
 * const input = AiMetricsSourceDiscoveryInput.make({
 *   hashSalt: O.some("salt"),
 *   homeDir: "/home/me",
 *   maxFiles: 25,
 *   repoRoot: "/repo"
 * })
 * console.log(input.target)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsSourceDiscoveryInput extends S.Class<AiMetricsSourceDiscoveryInput>(
  $I`AiMetricsSourceDiscoveryInput`
)(
  {
    claudeProjectsRoot: OptionalSourceString,
    codexSessionsRoot: OptionalSourceString,
    hashSalt: OptionalSourceString,
    homeDir: S.String,
    includeAll: SchemaUtils.BoolKeyDefaultFalse,
    maxFiles: S.Natural.pipe(SchemaUtils.withKeyDefaults(DEFAULT_MAX_FILES)),
    maxFileBytes: OptionalSourceNatural,
    openClawUnitPath: OptionalSourceString,
    repoRoot: S.String,
    sinceEpochMillis: OptionalSourceEpochMillis,
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
 * **Example** (Make transcript file metadata)
 *
 * ```ts
 * import { AiMetricsDiscoveredTranscriptFile } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 *
 * const file = AiMetricsDiscoveredTranscriptFile.make({
 *   modifiedAtMillis: 1_717_000_000_000,
 *   sessionIdHash: O.some("4444444444444444444444444444444444444444444444444444444444444444"),
 *   sizeBytes: 4096,
 *   sourceKind: "codex",
 *   sourcePathHash: "1111111111111111111111111111111111111111111111111111111111111111",
 *   sourceRole: "primary"
 * })
 * console.log(file.sizeBytes)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsDiscoveredTranscriptFile extends S.Class<AiMetricsDiscoveredTranscriptFile>(
  $I`AiMetricsDiscoveredTranscriptFile`
)(
  {
    agentNicknameHash: S.OptionFromOptionalKey(SourceDiscoverySha256).pipe(SchemaUtils.withNoneDefault),
    agentRoleHash: S.OptionFromOptionalKey(SourceDiscoverySha256).pipe(SchemaUtils.withNoneDefault),
    forkedFromIdHash: S.OptionFromOptionalKey(SourceDiscoverySha256).pipe(SchemaUtils.withNoneDefault),
    modifiedAtMillis: S.Natural,
    parentSessionIdHash: S.OptionFromOptionalKey(SourceDiscoverySha256).pipe(SchemaUtils.withNoneDefault),
    parentThreadIdHash: S.OptionFromOptionalKey(SourceDiscoverySha256).pipe(SchemaUtils.withNoneDefault),
    sessionIdHash: S.OptionFromOptionalKey(SourceDiscoverySha256).pipe(SchemaUtils.withNoneDefault),
    sizeBytes: S.Natural,
    sourceKind: AiMetricsTranscriptSource,
    sourcePathHash: SourceDiscoverySha256,
    sourceRole: AiMetricsSourceRole,
    threadSpawn: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("AiMetricsDiscoveredTranscriptFile", {
    description: "Discovered local source file with private identifiers represented by salted hashes.",
  })
) {}

/**
 * Source-level discovery summary.
 *
 * **Example** (Make missing source summary)
 *
 * ```ts
 * import { AiMetricsDiscoveredSource } from "@beep/repo-ai-metrics"
 *
 * const source = AiMetricsDiscoveredSource.make({
 *   fileCount: 0,
 *   files: [],
 *   rootPathHash: "5555555555555555555555555555555555555555555555555555555555555555",
 *   sourceKind: "claude",
 *   status: "missing"
 * })
 * console.log(source.fileCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsDiscoveredSource extends S.Class<AiMetricsDiscoveredSource>($I`AiMetricsDiscoveredSource`)(
  {
    candidateFileCount: S.Natural.pipe(SchemaUtils.withKeyDefaults(0)),
    fileCount: S.Natural,
    files: S.Array(AiMetricsDiscoveredTranscriptFile),
    includedFileCount: S.Natural.pipe(SchemaUtils.withKeyDefaults(0)),
    limitedByMaxFiles: SchemaUtils.BoolKeyDefaultFalse,
    message: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    newestModifiedAtMillis: S.OptionFromOptionalKey(SourceDiscoveryEpochMillis).pipe(SchemaUtils.withNoneDefault),
    rootPathHash: SourceDiscoverySha256,
    sizeExcludedFileCount: S.Natural.pipe(SchemaUtils.withKeyDefaults(0)),
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
 * **Example** (Make empty discovery result)
 *
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
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsSourceDiscoveryResult extends S.Class<AiMetricsSourceDiscoveryResult>(
  $I`AiMetricsSourceDiscoveryResult`
)(
  {
    discoveredFileCount: S.Natural,
    generatedAtEpochMillis: SourceDiscoveryEpochMillis,
    hashSaltStatus: AiMetricsHashSaltStatus,
    homeDirHash: SourceDiscoverySha256,
    includeAll: S.Boolean,
    maxFiles: S.Natural,
    maxFileBytes: S.OptionFromOptionalKey(S.Natural).pipe(SchemaUtils.withNoneDefault),
    repoRootHash: SourceDiscoverySha256,
    sinceEpochMillis: S.OptionFromOptionalKey(SourceDiscoveryEpochMillis).pipe(SchemaUtils.withNoneDefault),
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
 * **Example** (Make discovery error instance)
 *
 * ```ts
 * import { AiMetricsSourceDiscoveryError } from "@beep/repo-ai-metrics"
 *
 * const error = AiMetricsSourceDiscoveryError.make({
 *   cause: "stat failed",
 *   message: "Failed to stat AI metrics source file."
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsSourceDiscoveryError extends S.TaggedError<AiMetricsSourceDiscoveryError>(
  $I`AiMetricsSourceDiscoveryError`
)(
  "AiMetricsSourceDiscoveryError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annoteError<AiMetricsSourceDiscoveryError>("AiMetricsSourceDiscoveryError", {
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

const isWithinModifiedTimeWindow =
  (input: AiMetricsSourceDiscoveryInput) =>
  (info: FileSystem.File.Info): boolean =>
    input.includeAll || O.isNone(input.sinceEpochMillis) || modifiedAtMillis(info) >= input.sinceEpochMillis.value;

const isWithinSizeWindow =
  (input: AiMetricsSourceDiscoveryInput) =>
  (info: FileSystem.File.Info): boolean =>
    O.isNone(input.maxFileBytes) || fileSizeBytes(info) <= input.maxFileBytes.value;

const sessionIdFromPath = (pathApi: Path.Path, sourcePath: string): string =>
  pipe(pathApi.basename(sourcePath), Str.replace(/\.jsonl$/u, ""));

const makeDiscoveredTranscriptFile = Effect.fn("AiMetrics.makeDiscoveredTranscriptFile")(function* ({
  hashSalt,
  root,
  sourceKind,
  sourcePath,
}: {
  readonly hashSalt: O.Option<string>;
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
  const relativePath = normalizedRelativePath(sourcePath, { pathApi, root });
  const attribution = yield* makeAiMetricsSourceAttribution({
    content,
    hashSalt,
    relativePath,
    sourceKind,
    sourcePath,
  }).pipe(Effect.mapError((cause) => fileSystemFailure("Failed to derive AI metrics source attribution.", cause)));
  const fallbackSessionIdHash = yield* hashPrivateIdentifier(sessionIdFromPath(pathApi, sourcePath), hashSalt);

  return AiMetricsDiscoveredTranscriptFile.make({
    agentNicknameHash: attribution.agentNicknameHash,
    agentRoleHash: attribution.agentRoleHash,
    forkedFromIdHash: attribution.forkedFromIdHash,
    modifiedAtMillis: modifiedAtMillis(info),
    parentSessionIdHash: attribution.parentSessionIdHash,
    parentThreadIdHash: attribution.parentThreadIdHash,
    sessionIdHash: O.orElse(attribution.sessionIdHash, () => O.some(fallbackSessionIdHash)),
    sizeBytes: fileSizeBytes(info),
    sourceKind,
    sourcePathHash: yield* hashPrivateIdentifier(sourcePath, hashSalt),
    sourceRole: attribution.sourceRole,
    threadSpawn: attribution.threadSpawn,
  });
});

const newestModifiedAtMillis: (files: ReadonlyArray<AiMetricsDiscoveredTranscriptFile>) => O.Option<number> = flow(
  A.map((file) => file.modifiedAtMillis),
  A.sort(Order.mapInput(Order.Number, (value: number) => -value)),
  A.head
);

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
      message: O.some("source root does not exist"),
      rootPathHash,
      sourceKind,
      status: AiMetricsSourceStatus.Enum.missing,
    });
  }

  if (rootInfo.value.type !== "Directory") {
    return AiMetricsDiscoveredSource.make({
      fileCount: 0,
      files: [],
      message: O.some("source root is not a directory"),
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
          hashSalt: input.hashSalt,
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
    newestModifiedAtMillis: newestModifiedAtMillis(includedFiles),
  });
});

const discoverOpenClawSource = Effect.fn("AiMetrics.discoverOpenClawSource")(function* (
  input: AiMetricsSourceDiscoveryInput
) {
  const pathApi = yield* Path.Path;
  const unitPath = O.getOrElse(input.openClawUnitPath, () =>
    pathApi.join(input.homeDir, ".config/systemd/user/openclaw-gateway.service")
  );
  const unitInfo = yield* statOption(unitPath);
  const rootPathHash = yield* hashPrivateIdentifier(unitPath, input.hashSalt);

  if (O.isNone(unitInfo)) {
    return AiMetricsDiscoveredSource.make({
      fileCount: 0,
      files: [],
      message: O.some("OpenClaw user systemd gateway unit was not found"),
      rootPathHash,
      sourceKind: AiMetricsTranscriptSource.Enum.openclaw,
      status: AiMetricsSourceStatus.Enum.missing,
    });
  }

  if (unitInfo.value.type !== "File") {
    return AiMetricsDiscoveredSource.make({
      fileCount: 0,
      files: [],
      message: O.some("OpenClaw user systemd gateway path is not a file"),
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
      message: O.some("OpenClaw user systemd gateway metadata is outside the selected modified-time window"),
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
      message: O.some("OpenClaw user systemd gateway metadata exceeds the selected byte-size window"),
      rootPathHash,
      sizeExcludedFileCount: 1,
      sourceKind: AiMetricsTranscriptSource.Enum.openclaw,
      status: AiMetricsSourceStatus.Enum.available,
    });
  }

  const file = AiMetricsDiscoveredTranscriptFile.make({
    modifiedAtMillis: modifiedAtMillis(unitInfo.value),
    sessionIdHash: O.some(yield* hashPrivateIdentifier("openclaw-gateway.service", input.hashSalt)),
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
    message: O.some("OpenClaw discovery is limited to safe gateway metadata in P1"),
    newestModifiedAtMillis: O.some(file.modifiedAtMillis),
    rootPathHash,
    sourceKind: AiMetricsTranscriptSource.Enum.openclaw,
    status: AiMetricsSourceStatus.Enum.available,
  });
});

/**
 * Discover local AI metrics transcript sources for the smoke target.
 *
 * **Example** (Discover sources with Effect)
 *
 * ```ts
 * import { AiMetricsSourceDiscoveryInput, discoverAiMetricsSources } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * const program = discoverAiMetricsSources(
 *   AiMetricsSourceDiscoveryInput.make({
 *     hashSalt: O.some("salt"),
 *     homeDir: "/home/me",
 *     repoRoot: "/repo"
 *   })
 * ).pipe(Effect.provide(NodeServices.layer))
 * console.log(program)
 * ```
 *
 * @effects
 * - Stats configured Codex, Claude, and OpenClaw source roots.
 * - Recursively scans JSONL transcript files up to `maxFiles`.
 * - Reads Codex session metadata only far enough to derive source attribution.
 * - Hashes private local paths and session identifiers before returning results.
 * @category services
 * @since 0.0.0
 */
export const discoverAiMetricsSources = Effect.fn("AiMetrics.discoverAiMetricsSources")(function* (
  input: AiMetricsSourceDiscoveryInput
) {
  const pathApi = yield* Path.Path;
  const { claudeRoot, codexRoot, homeDir, repoRoot } = resolveTranscriptSourceRoots(input, pathApi);
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
    maxFileBytes: input.maxFileBytes,
    repoRootHash: yield* hashPrivateIdentifier(repoRoot, input.hashSalt),
    sources,
    target: input.target,
    sinceEpochMillis: input.sinceEpochMillis,
  });
});

/**
 * Render a source discovery result as JSON.
 *
 * **Example** (Render discovery result JSON)
 *
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
 *
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
