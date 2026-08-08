/**
 * Repo-local agent configuration snapshots for AI metrics attribution.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Effect, FileSystem, flow, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ConfigSnapshot } from "./models.ts";
import { hashPublicTextSha256 } from "./privacy.ts";

const $I = $RepoAiMetricsId.create("config-snapshot");

const CONFIG_ROOTS = [".codex", ".claude", ".ai", ".aiassistant"] as const;
const AGENT_DOC_NAMES = ["AGENTS.md", "CLAUDE.md"] as const;
const EXCLUDED_DIR_NAMES = [
  ".beep",
  ".cache",
  ".git",
  ".next",
  ".repos",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "outputs",
] as const;

/**
 * Input for repo-local agent configuration snapshotting.
 *
 * **Example** (Create snapshot input)
 *
 * ```ts
 * import { AiMetricsConfigSnapshotInput } from "@beep/repo-ai-metrics"
 *
 * const input = AiMetricsConfigSnapshotInput.make({
 *   repoRoot: "/repo"
 * })
 * console.log(input.label)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsConfigSnapshotInput extends S.Class<AiMetricsConfigSnapshotInput>(
  $I`AiMetricsConfigSnapshotInput`
)(
  {
    label: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("repo-local-agent-config")),
      S.withDecodingDefaultKey(Effect.succeed("repo-local-agent-config"))
    ),
    previousSnapshotPath: S.optionalKey(S.String),
    repoRoot: S.String,
  },
  $I.annote("AiMetricsConfigSnapshotInput", {
    description: "Repo root and label used to build an agent-facing configuration snapshot.",
  })
) {}

/**
 * Diff between the current and previous AI metrics config snapshot.
 *
 * **Example** (Create path change diff)
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
 * console.log(diff.addedPaths)
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
 * One file included in an AI metrics config snapshot.
 *
 * **Example** (Create hashed file entry)
 *
 * ```ts
 * import { AiMetricsConfigSnapshotFile } from "@beep/repo-ai-metrics"
 *
 * const file = AiMetricsConfigSnapshotFile.make({
 *   contentHash: "sha256:fixture",
 *   relativePath: "AGENTS.md",
 *   sizeBytes: 2048
 * })
 * console.log(file.relativePath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsConfigSnapshotFile extends S.Class<AiMetricsConfigSnapshotFile>($I`AiMetricsConfigSnapshotFile`)(
  {
    contentHash: S.String,
    relativePath: S.String,
    sizeBytes: S.Finite,
  },
  $I.annote("AiMetricsConfigSnapshotFile", {
    description: "Repo-relative agent-facing configuration file and its deterministic content hash.",
  })
) {}

/**
 * Complete repo-local agent configuration snapshot result.
 *
 * **Example** (Assemble full snapshot result)
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
 * console.log(result.fileCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsConfigSnapshotResult extends S.Class<AiMetricsConfigSnapshotResult>(
  $I`AiMetricsConfigSnapshotResult`
)(
  {
    excludedDirectoryNames: S.Array(S.String),
    diff: AiMetricsConfigSnapshotDiff.pipe(S.withDecodingDefaultKey(Effect.succeed(emptyConfigSnapshotDiff))),
    fileCount: S.Finite,
    files: S.Array(AiMetricsConfigSnapshotFile),
    previousSnapshotId: S.optionalKey(S.String),
    snapshot: ConfigSnapshot,
  },
  $I.annote("AiMetricsConfigSnapshotResult", {
    description: "Config snapshot manifest used to attribute AI-agent metrics to repo guidance changes.",
  })
) {}

/**
 * Error raised by config snapshot helpers.
 *
 * **Example** (Create config snapshot error)
 *
 * ```ts
 * import { AiMetricsConfigSnapshotError } from "@beep/repo-ai-metrics"
 *
 * const error = AiMetricsConfigSnapshotError.make({
 *   cause: "read failed",
 *   message: "Failed to read agent guidance file."
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsConfigSnapshotError extends TaggedErrorClass<AiMetricsConfigSnapshotError>(
  $I`AiMetricsConfigSnapshotError`
)(
  "AiMetricsConfigSnapshotError",
  {
    cause: S.Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annote("AiMetricsConfigSnapshotError", {
    description: "Typed failure raised while building an AI metrics config snapshot.",
  })
) {}

const encodeConfigSnapshotJson = S.encodeUnknownEffect(S.fromJsonString(AiMetricsConfigSnapshotResult));
const decodeConfigSnapshotJson = S.decodeUnknownEffect(S.fromJsonString(AiMetricsConfigSnapshotResult));

const byRelativePathAscending: Order.Order<AiMetricsConfigSnapshotFile> = Order.mapInput(
  Order.String,
  (file) => file.relativePath
);

const normalizeRepoPath = (pathApi: Path.Path, repoRoot: string, filePath: string): string =>
  pipe(pathApi.relative(repoRoot, filePath), Str.replace(/\\/gu, "/"));

const isExcludedDirectoryName = (name: string): boolean =>
  A.contains(EXCLUDED_DIR_NAMES as ReadonlyArray<string>, name);

const isAgentDocName = (name: string): boolean => A.contains(AGENT_DOC_NAMES as ReadonlyArray<string>, name);

const statOption = Effect.fn("AiMetrics.configSnapshot.statOption")(function* (pathName: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.stat(pathName).pipe(Effect.option);
});

const collectFilesUnder = Effect.fn("AiMetrics.collectConfigFilesUnder")(function* (
  root: string
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  const rootInfo = yield* statOption(root);

  if (O.isNone(rootInfo) || rootInfo.value.type !== "Directory") {
    return A.empty<string>();
  }

  const walk = Effect.fnUntraced(function* (
    currentPath: string
  ): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
    const info = yield* statOption(currentPath);
    if (O.isNone(info)) {
      return A.empty<string>();
    }

    if (info.value.type === "File") {
      return A.of(currentPath);
    }

    if (info.value.type !== "Directory") {
      return A.empty<string>();
    }

    const entries = yield* fs.readDirectory(currentPath).pipe(Effect.orElseSucceed(A.empty<string>));
    let files = A.empty<string>();
    for (const entry of entries) {
      if (isExcludedDirectoryName(entry)) {
        continue;
      }
      files = A.appendAll(files, yield* walk(pathApi.join(currentPath, entry)));
    }

    return files;
  });

  return yield* walk(root);
});

const collectAgentDocFiles = Effect.fn("AiMetrics.collectAgentDocFiles")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;

  const walk = Effect.fnUntraced(function* (
    currentPath: string
  ): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
    const info = yield* statOption(currentPath);
    if (O.isNone(info)) {
      return A.empty<string>();
    }

    if (info.value.type === "File") {
      return isAgentDocName(pathApi.basename(currentPath)) ? A.of(currentPath) : A.empty<string>();
    }

    if (info.value.type !== "Directory") {
      return A.empty<string>();
    }

    const entries = yield* fs.readDirectory(currentPath).pipe(Effect.orElseSucceed(A.empty<string>));
    let files = A.empty<string>();
    for (const entry of entries) {
      if (isExcludedDirectoryName(entry)) {
        continue;
      }
      files = A.appendAll(files, yield* walk(pathApi.join(currentPath, entry)));
    }

    return files;
  });

  return yield* walk(repoRoot);
});

const candidateSnapshotPaths = Effect.fn("AiMetrics.candidateSnapshotPaths")(function* (repoRoot: string) {
  const pathApi = yield* Path.Path;
  const configFiles = yield* Effect.forEach(
    CONFIG_ROOTS,
    (rootName) => collectFilesUnder(pathApi.join(repoRoot, rootName)),
    { concurrency: 4 }
  );
  const agentDocs = yield* collectAgentDocFiles(repoRoot);

  return pipe(A.flatten(configFiles), A.appendAll(agentDocs), A.dedupe, A.sort(Order.String));
});

const makeSnapshotFile = Effect.fn("AiMetrics.makeSnapshotFile")(function* (repoRoot: string, filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  const info = yield* fs.stat(filePath).pipe(
    Effect.mapError((cause) =>
      AiMetricsConfigSnapshotError.make({
        cause,
        message: "Failed to stat config snapshot file.",
      })
    )
  );
  const content = yield* fs.readFileString(filePath).pipe(
    Effect.mapError((cause) =>
      AiMetricsConfigSnapshotError.make({
        cause,
        message: "Failed to read config snapshot file.",
      })
    )
  );

  return AiMetricsConfigSnapshotFile.make({
    contentHash: yield* hashPublicTextSha256(content),
    relativePath: normalizeRepoPath(pathApi, repoRoot, filePath),
    sizeBytes: globalThis.Number(info.size),
  });
});

const snapshotHashInput: (files: ReadonlyArray<AiMetricsConfigSnapshotFile>) => string = flow(
  A.map((file) => `${file.relativePath}\u0000${file.contentHash}`),
  A.join("\n")
);

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

const readPreviousSnapshot = Effect.fn("AiMetrics.readPreviousConfigSnapshot")(function* (
  previousSnapshotPath: string | undefined
) {
  if (previousSnapshotPath === undefined) {
    return O.none<AiMetricsConfigSnapshotResult>();
  }

  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(previousSnapshotPath).pipe(
    Effect.mapError((cause) =>
      AiMetricsConfigSnapshotError.make({
        cause,
        message: "Failed to inspect previous AI metrics config snapshot artifact.",
      })
    )
  );
  if (!exists) {
    return O.none<AiMetricsConfigSnapshotResult>();
  }

  const content = yield* fs.readFileString(previousSnapshotPath).pipe(
    Effect.mapError((cause) =>
      AiMetricsConfigSnapshotError.make({
        cause,
        message: "Failed to read previous AI metrics config snapshot artifact.",
      })
    )
  );

  return yield* decodeConfigSnapshotJson(content).pipe(
    Effect.map(O.some),
    Effect.mapError((cause) =>
      AiMetricsConfigSnapshotError.make({
        cause,
        message: "Failed to decode previous AI metrics config snapshot artifact.",
      })
    )
  );
});

/**
 * Build a deterministic snapshot of repo-owned agent-facing configuration.
 *
 * **Example** (Build agent config snapshot)
 *
 * ```ts
 * import { AiMetricsConfigSnapshotInput, makeAiMetricsConfigSnapshot } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 * const program = makeAiMetricsConfigSnapshot(
 *   AiMetricsConfigSnapshotInput.make({ repoRoot: "/repo" })
 * ).pipe(Effect.provide(NodeServices.layer))
 * console.log(program)
 * ```
 *
 * @effects
 * - Traverses repo-local agent configuration roots and agent guide files.
 * - Reads included files to compute deterministic content hashes.
 * - Optionally reads a previous snapshot artifact for diff attribution.
 * @category services
 * @since 0.0.0
 */
export const makeAiMetricsConfigSnapshot = Effect.fn("AiMetrics.makeAiMetricsConfigSnapshot")(function* (
  input: AiMetricsConfigSnapshotInput
) {
  const pathApi = yield* Path.Path;
  const repoRoot = pathApi.resolve(input.repoRoot);
  const paths = yield* candidateSnapshotPaths(repoRoot);
  const files = pipe(
    yield* Effect.forEach(paths, (filePath) => makeSnapshotFile(repoRoot, filePath), { concurrency: 16 }),
    A.sort(byRelativePathAscending)
  );
  const snapshotHash = yield* hashPublicTextSha256(`ai-metrics-config-snapshot-v1\n${snapshotHashInput(files)}`);
  const relativePaths = A.map(files, (file) => file.relativePath);
  const previous = yield* readPreviousSnapshot(input.previousSnapshotPath);
  const previousFiles = pipe(
    previous,
    O.map((snapshot) => snapshot.files),
    O.getOrElse(A.empty<AiMetricsConfigSnapshotFile>)
  );
  const diff = snapshotDiff(files, previousFiles);
  const changedPaths = changedPathsFor(diff);
  const previousSnapshotId = pipe(
    previous,
    O.map((snapshot) => snapshot.snapshot.snapshotId)
  );

  return AiMetricsConfigSnapshotResult.make({
    excludedDirectoryNames: EXCLUDED_DIR_NAMES,
    diff,
    fileCount: A.length(files),
    files,
    ...(O.isSome(previousSnapshotId) ? { previousSnapshotId: previousSnapshotId.value } : {}),
    snapshot: ConfigSnapshot.make({
      changedPaths,
      configHash: snapshotHash,
      includedPaths: relativePaths,
      label: input.label,
      ...(O.isSome(previousSnapshotId) ? { previousSnapshotId: previousSnapshotId.value } : {}),
      snapshotId: `config-${snapshotHash}`,
    }),
  });
});

/**
 * Persist a config snapshot manifest and latest pointer for future diff attribution.
 *
 * **Example** (Write snapshot artifacts)
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
 * const program = writeAiMetricsConfigSnapshotArtifacts({
 *   outputDir: ".beep/ai-metrics/config",
 *   result
 * }).pipe(Effect.provide(NodeServices.layer))
 * console.log(program)
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
    const content = yield* configSnapshotToJson(result);
    const manifestPath = pathApi.join(outputDir, `${result.snapshot.snapshotId}.json`);
    const latestPath = pathApi.join(outputDir, "latest.json");
    const latestTmpPath = pathApi.join(outputDir, "latest.json.tmp");
    yield* fs.makeDirectory(outputDir, { recursive: true }).pipe(
      Effect.mapError((cause) =>
        AiMetricsConfigSnapshotError.make({
          cause,
          message: "Failed to create AI metrics config snapshot artifact directory.",
        })
      )
    );
    yield* fs.writeFileString(manifestPath, content).pipe(
      Effect.mapError((cause) =>
        AiMetricsConfigSnapshotError.make({
          cause,
          message: "Failed to write AI metrics config snapshot manifest.",
        })
      )
    );
    if (commitLatest) {
      yield* fs.writeFileString(latestTmpPath, content).pipe(
        Effect.mapError((cause) =>
          AiMetricsConfigSnapshotError.make({
            cause,
            message: "Failed to write AI metrics latest config snapshot temporary pointer.",
          })
        )
      );
      yield* fs.rename(latestTmpPath, latestPath).pipe(
        Effect.mapError((cause) =>
          AiMetricsConfigSnapshotError.make({
            cause,
            message: "Failed to promote AI metrics latest config snapshot pointer.",
          })
        )
      );
    }

    return { latestPath, manifestPath };
  }
);

/**
 * Render a config snapshot result as JSON.
 *
 * **Example** (Serialize result to JSON)
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
 * const json = Effect.runPromise(
 *   configSnapshotToJson(
 *     AiMetricsConfigSnapshotResult.make({
 *       excludedDirectoryNames: [],
 *       diff: AiMetricsConfigSnapshotDiff.make({
 *         addedPaths: [],
 *         modifiedPaths: [],
 *         removedPaths: [],
 *         unchangedPaths: []
 *       }),
 *       fileCount: 0,
 *       files: [],
 *       snapshot: ConfigSnapshot.make({
 *         changedPaths: [],
 *         configHash: "config-hash",
 *         label: "repo-local-agent-config",
 *         snapshotId: "config-1"
 *       })
 *     })
 *   )
 * )
 * console.log(json)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const configSnapshotToJson: (
  result: AiMetricsConfigSnapshotResult
) => Effect.Effect<string, AiMetricsConfigSnapshotError> = Effect.fn("AiMetrics.configSnapshotToJson")(
  function* (result) {
    return yield* encodeConfigSnapshotJson(result).pipe(
      Effect.mapError((cause) =>
        AiMetricsConfigSnapshotError.make({
          cause,
          message: "Failed to encode AI metrics config snapshot as JSON.",
        })
      )
    );
  }
);
