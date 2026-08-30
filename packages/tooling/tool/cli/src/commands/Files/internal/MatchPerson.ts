/**
 * Local InsightFace orchestration and non-destructive person-match materialization.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { fileURLToPath } from "node:url";
import { A, Str } from "@beep/utils";
import { Config, Console, Effect, FileSystem, flow, Match, MutableHashSet, Number as Num, Path, pipe } from "effect";
import * as O from "effect/Option";
import {
  CommandJsonOutput,
  DEFAULT_JSON_PRETTY_MAX_LENGTH,
  encodeCommandJson,
  renderPrettyCommandJson,
} from "../../../internal/cli/Json.ts";
import { OutputBound, runCapturedStreams } from "../../../internal/process/StepExec.ts";
import { FilesCommandError, formatPlatformError } from "../Files.errors.ts";
import { backupStagedFileTarget, canonicalizeFileTargetPath, commitStagedFileByRename } from "./FileTransaction.ts";
import {
  decodePersonMatchWorkerReportJson,
  encodePersonMatchReport,
  PersonMatchReport,
} from "./MatchPerson.schemas.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { StagedFileCommitRecord } from "./FileTransaction.ts";
import type {
  MatchPersonOptions,
  PersonMatchDisposition,
  PersonMatchEntry,
  PersonMatchModel,
  PersonMatchModelArtifact,
  PersonMatchModelArtifactName,
  PersonMatchParameters,
  PersonMatchReference,
  PersonMatchWorkerReport,
  PersonMatchWorkerSuccess,
} from "./MatchPerson.schemas.ts";

const workerProjectDirectory = fileURLToPath(new URL("../../../../python/photo-face/", import.meta.url));
const workerOutputBound = OutputBound.make({
  maxChars: 268_435_456,
  truncatedNotice: "\n[files match-person output truncated]",
});
const workerModelRuntimeName = "beep_buffalo_l_v1";
const workerModelArtifactSha256: Readonly<Record<PersonMatchModelArtifactName, string>> = {
  "det_10g.onnx": "5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91",
  "w600k_r50.onnx": "4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43",
};
const workerScoreRoundingTolerance = 0.000001;
const trustedUvRoots = ["/usr/bin", "/usr/local/bin"] as const;

const approximatelyEqualWorkerScore = (left: number, right: number): boolean =>
  Math.abs(left - right) <= workerScoreRoundingTolerance;

interface CanonicalMatchPersonInputs {
  readonly cacheRoot: string;
  readonly candidateDirectory: string;
  readonly manifestPath: string;
  readonly modelRoot: string;
  readonly outputDirectory: O.Option<string>;
  readonly referenceDirectory: string;
  readonly uvCacheRoot: string;
  readonly uvEnvironment: string;
  readonly uvPath: string;
}

interface PersonMatchCopyPlanEntry {
  readonly sourcePath: string;
  readonly targetPath: string;
}

interface PersonMatchCommitRecord extends StagedFileCommitRecord {
  readonly temporaryDirectory: string;
}

interface CanonicalMatchPersonCacheChildren {
  readonly modelRoot: string;
  readonly uvCacheRoot: string;
  readonly uvEnvironment: string;
}

interface ValidatedWorkerReferences {
  readonly acceptedCount: number;
  readonly acceptedNames: MutableHashSet.MutableHashSet<string>;
}

interface MatchPersonPathOperations {
  readonly isAbsolute: (value: string) => boolean;
  readonly normalize: (value: string) => string;
  readonly relative: (from: string, to: string) => string;
  readonly sep: string;
}

const pathContains = (
  path: Pick<MatchPersonPathOperations, "isAbsolute" | "relative" | "sep">,
  root: string,
  target: string
): boolean => {
  const relative = path.relative(root, target);
  return (
    relative === "" || (relative !== ".." && !Str.startsWith(`..${path.sep}`)(relative) && !path.isAbsolute(relative))
  );
};

const pathsOverlap = (
  path: Pick<MatchPersonPathOperations, "isAbsolute" | "relative" | "sep">,
  left: string,
  right: string
): boolean => pathContains(path, left, right) || pathContains(path, right, left);

const requireDisjointMatchPersonPaths = Effect.fn("Files.requireDisjointMatchPersonPaths")(function* (
  path: Pick<MatchPersonPathOperations, "isAbsolute" | "relative" | "sep">,
  left: string,
  right: string,
  message: string
): Effect.fn.Return<void, FilesCommandError> {
  if (pathsOverlap(path, left, right)) {
    return yield* FilesCommandError.make({ message });
  }
});

const validateMatchPersonCachePathIsolation = Effect.fn("Files.validateMatchPersonCachePathIsolation")(function* (
  path: Pick<MatchPersonPathOperations, "isAbsolute" | "relative" | "sep">,
  candidateDirectory: string,
  referenceDirectory: string,
  manifestPath: string,
  cachePath: string
): Effect.fn.Return<void, FilesCommandError> {
  yield* requireDisjointMatchPersonPaths(
    path,
    candidateDirectory,
    cachePath,
    "The person-match cache must be outside the candidate and reference directories."
  );
  yield* requireDisjointMatchPersonPaths(
    path,
    referenceDirectory,
    cachePath,
    "The person-match cache must be outside the candidate and reference directories."
  );
  yield* requireDisjointMatchPersonPaths(
    path,
    cachePath,
    manifestPath,
    "The person-match manifest and cache paths must not overlap."
  );
});

const validateMatchPersonOutputPathIsolation = Effect.fn("Files.validateMatchPersonOutputPathIsolation")(function* (
  path: Pick<MatchPersonPathOperations, "isAbsolute" | "relative" | "sep">,
  candidateDirectory: string,
  referenceDirectory: string,
  manifestPath: string,
  cachePaths: ReadonlyArray<string>,
  outputDirectory: string
): Effect.fn.Return<void, FilesCommandError> {
  yield* requireDisjointMatchPersonPaths(
    path,
    candidateDirectory,
    outputDirectory,
    "The person-match output directory must be outside the candidate and reference directories."
  );
  yield* requireDisjointMatchPersonPaths(
    path,
    referenceDirectory,
    outputDirectory,
    "The person-match output directory must be outside the candidate and reference directories."
  );
  yield* requireDisjointMatchPersonPaths(
    path,
    outputDirectory,
    manifestPath,
    "The person-match output directory must not overlap the manifest or cache paths."
  );
  yield* Effect.forEach(
    cachePaths,
    (cachePath) =>
      requireDisjointMatchPersonPaths(
        path,
        outputDirectory,
        cachePath,
        "The person-match output directory must not overlap the manifest or cache paths."
      ),
    { concurrency: 1, discard: true }
  );
});

const validateMatchPersonPathIsolation = Effect.fn("Files.validateMatchPersonPathIsolation")(function* (
  path: Pick<MatchPersonPathOperations, "isAbsolute" | "relative" | "sep">,
  candidateDirectory: string,
  referenceDirectory: string,
  manifestPath: string,
  cachePaths: ReadonlyArray<string>,
  outputDirectory: O.Option<string>
): Effect.fn.Return<void, FilesCommandError> {
  yield* requireDisjointMatchPersonPaths(
    path,
    candidateDirectory,
    referenceDirectory,
    "Person-match candidate and reference directories must not overlap."
  );
  yield* requireDisjointMatchPersonPaths(
    path,
    candidateDirectory,
    manifestPath,
    "The person-match manifest must be outside the candidate and reference directories."
  );
  yield* requireDisjointMatchPersonPaths(
    path,
    referenceDirectory,
    manifestPath,
    "The person-match manifest must be outside the candidate and reference directories."
  );
  yield* Effect.forEach(
    cachePaths,
    (cachePath) =>
      validateMatchPersonCachePathIsolation(path, candidateDirectory, referenceDirectory, manifestPath, cachePath),
    { concurrency: 1, discard: true }
  );
  yield* O.match(outputDirectory, {
    onNone: () => Effect.void,
    onSome: (directory) =>
      validateMatchPersonOutputPathIsolation(
        path,
        candidateDirectory,
        referenceDirectory,
        manifestPath,
        cachePaths,
        directory
      ),
  });
});

const readOptionalConfig = (name: string): Effect.Effect<O.Option<string>> =>
  Config.option(Config.string(name)).pipe(
    Effect.orElseSucceed(O.none<string>),
    Effect.map(flow(O.map(Str.trim), O.filter(Str.isNonEmpty)))
  );

const canonicalizeExistingDirectory = Effect.fn("Files.matchPersonCanonicalizeDirectory")(function* (
  directory: string,
  description: string
): Effect.fn.Return<string, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolved = path.resolve(directory);
  const canonical = yield* fs
    .realPath(resolved)
    .pipe(Effect.mapError((cause) => formatPlatformError(`Failed to resolve ${description}`, resolved, { cause })));
  const stat = yield* fs
    .stat(canonical)
    .pipe(Effect.mapError((cause) => formatPlatformError(`Failed to stat ${description}`, canonical, { cause })));

  if (stat.type !== "Directory") {
    return yield* FilesCommandError.make({ message: `${description} must be a directory: "${canonical}"` });
  }

  return canonical;
});

const resolveCacheRoot = Effect.fn("Files.matchPersonResolveCacheRoot")(function* (
  configured: O.Option<string>
): Effect.fn.Return<string, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const xdgCacheHome = yield* readOptionalConfig("XDG_CACHE_HOME");
  const home = yield* readOptionalConfig("HOME");
  const selected = pipe(
    configured,
    O.map(path.resolve),
    O.orElse(() => O.map(xdgCacheHome, (root) => path.join(root, "beep", "photo-face"))),
    O.orElse(() => O.map(home, (root) => path.join(root, ".cache", "beep", "photo-face")))
  );

  if (O.isNone(selected)) {
    return yield* FilesCommandError.make({
      message: "Could not resolve a cache directory. Pass --cache-dir or configure XDG_CACHE_HOME/HOME.",
    });
  }

  return yield* canonicalizeFileTargetPath(selected.value, "person-match cache directory");
});

const canonicalizeMatchPersonCacheChild = Effect.fn("Files.canonicalizeMatchPersonCacheChild")(function* (
  cacheRoot: string,
  childName: string,
  description: string
): Effect.fn.Return<string, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const requestedPath = path.join(cacheRoot, childName);
  const canonicalPath = yield* canonicalizeFileTargetPath(requestedPath, description);
  if (canonicalPath !== requestedPath) {
    return yield* FilesCommandError.make({
      message: `Refusing a symlinked or aliased ${description}: "${requestedPath}"`,
    });
  }
  return canonicalPath;
});

const canonicalizeMatchPersonCacheChildren = Effect.fn("Files.canonicalizeMatchPersonCacheChildren")(function* (
  cacheRoot: string
): Effect.fn.Return<CanonicalMatchPersonCacheChildren, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  return {
    modelRoot: yield* canonicalizeMatchPersonCacheChild(cacheRoot, "insightface", "person-match model directory"),
    uvCacheRoot: yield* canonicalizeMatchPersonCacheChild(cacheRoot, "uv-cache", "person-match uv cache directory"),
    uvEnvironment: yield* canonicalizeMatchPersonCacheChild(
      cacheRoot,
      "venv-cpu-py312-v1",
      "person-match uv environment"
    ),
  };
});

const resolveTrustedUvPath = Effect.fn("Files.matchPersonResolveUvPath")(function* (): Effect.fn.Return<
  string,
  FilesCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const configured = yield* readOptionalConfig("BEEP_UV_PATH");
  const home = yield* readOptionalConfig("HOME");

  if (O.isSome(configured) && !path.isAbsolute(configured.value)) {
    return yield* FilesCommandError.make({ message: "BEEP_UV_PATH must be an absolute path to a trusted uv binary." });
  }

  const candidates = O.isSome(configured)
    ? [configured.value]
    : [
        ...A.map(trustedUvRoots, (root) => path.join(root, "uv")),
        ...pipe(
          home,
          O.map((root) => [path.join(root, ".local", "bin", "uv")]),
          O.getOrElse(A.empty<string>)
        ),
      ];

  for (const candidate of candidates) {
    const exists = yield* fs.exists(candidate).pipe(Effect.orElseSucceed(() => false));
    if (!exists) continue;

    const stat = yield* fs
      .stat(candidate)
      .pipe(Effect.mapError((cause) => formatPlatformError("Failed to stat uv binary", candidate, { cause })));
    if (stat.type === "File") return candidate;
  }

  return yield* FilesCommandError.make({
    message:
      "Could not find a trusted uv binary. Install uv in /usr/bin, /usr/local/bin, or $HOME/.local/bin, or set BEEP_UV_PATH to an absolute path.",
  });
});

const validateThresholds = (options: MatchPersonOptions): Effect.Effect<void, FilesCommandError> => {
  if (options.reviewThreshold >= options.matchThreshold) {
    return FilesCommandError.make({
      message: "files match-person requires --review-threshold to be lower than --match-threshold.",
    });
  }
  return Effect.void;
};

const preflightManifest = Effect.fn("Files.matchPersonPreflightManifest")(function* (
  manifestPath: string,
  overwrite: boolean
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(manifestPath)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to inspect person-match manifest", manifestPath, { cause })
      )
    );
  if (!exists) return;

  const stat = yield* fs
    .stat(manifestPath)
    .pipe(
      Effect.mapError((cause) => formatPlatformError("Failed to stat person-match manifest", manifestPath, { cause }))
    );
  if (stat.type !== "File") {
    return yield* FilesCommandError.make({
      message: `Refusing to overwrite a non-file person-match manifest: "${manifestPath}"`,
    });
  }
  if (!overwrite) {
    return yield* FilesCommandError.make({
      message: `Refusing to overwrite existing person-match manifest: "${manifestPath}"`,
    });
  }
});

const validateMatchPersonInputs = Effect.fn("Files.validateMatchPersonInputs")(function* (
  options: MatchPersonOptions
): Effect.fn.Return<CanonicalMatchPersonInputs, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  if (!options.acceptModelLicense) {
    return yield* FilesCommandError.make({
      message:
        "InsightFace buffalo_l weights are limited to non-commercial research use. Review https://github.com/deepinsight/insightface/blob/master/server/LICENSING.md, then re-run with --accept-model-license.",
    });
  }
  yield* validateThresholds(options);

  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const candidateDirectory = yield* canonicalizeExistingDirectory(options.dir, "person-match candidate directory");
  const referenceDirectory = yield* canonicalizeExistingDirectory(
    options.references,
    "person-match reference directory"
  );
  const manifestPath = yield* canonicalizeFileTargetPath(options.manifest, "person-match manifest path");
  if (manifestPath !== path.resolve(options.manifest)) {
    return yield* FilesCommandError.make({
      message: `Refusing a symlinked or aliased person-match manifest path: "${options.manifest}"`,
    });
  }
  const outputDirectory = yield* O.match(options.outDir, {
    onNone: () => Effect.succeed(O.none<string>()),
    onSome: (directory) =>
      canonicalizeFileTargetPath(directory, "person-match output directory").pipe(Effect.map(O.some)),
  });
  const cacheRoot = yield* resolveCacheRoot(options.cacheDir);
  const uvPath = yield* resolveTrustedUvPath();

  yield* validateMatchPersonPathIsolation(
    path,
    candidateDirectory,
    referenceDirectory,
    manifestPath,
    [cacheRoot],
    outputDirectory
  );

  yield* preflightManifest(manifestPath, options.overwrite);
  yield* fs
    .makeDirectory(cacheRoot, { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create person-match cache directory", cacheRoot, { cause })
      )
    );
  const canonicalCacheRoot = yield* canonicalizeExistingDirectory(cacheRoot, "person-match cache directory");
  const cacheChildren = yield* canonicalizeMatchPersonCacheChildren(canonicalCacheRoot);
  yield* validateMatchPersonPathIsolation(
    path,
    candidateDirectory,
    referenceDirectory,
    manifestPath,
    [canonicalCacheRoot, cacheChildren.modelRoot, cacheChildren.uvEnvironment, cacheChildren.uvCacheRoot],
    outputDirectory
  );

  return {
    cacheRoot: canonicalCacheRoot,
    candidateDirectory,
    manifestPath,
    modelRoot: cacheChildren.modelRoot,
    outputDirectory,
    referenceDirectory,
    uvCacheRoot: cacheChildren.uvCacheRoot,
    uvEnvironment: cacheChildren.uvEnvironment,
    uvPath,
  };
});

const workerArguments = (options: MatchPersonOptions, inputs: CanonicalMatchPersonInputs): ReadonlyArray<string> => [
  "run",
  "--project",
  workerProjectDirectory,
  "--frozen",
  "--python",
  "3.12",
  "--no-python-downloads",
  "--no-dev",
  "-m",
  "beep_photo_face",
  "--references",
  inputs.referenceDirectory,
  "--candidates",
  inputs.candidateDirectory,
  "--model-root",
  inputs.modelRoot,
  "--detection-threshold",
  `${options.detectionThreshold}`,
  "--match-threshold",
  `${options.matchThreshold}`,
  "--review-threshold",
  `${options.reviewThreshold}`,
  "--min-face-area-pct",
  `${options.minFaceAreaPct}`,
  ...(options.recursive ? ["--recursive"] : []),
  "--accept-model-license",
];

const workerFailureMessage = (report: PersonMatchWorkerReport, stderr: string, exitCode: number): string => {
  if (!report.ok) return `Person-match worker failed [${report.error.code}]: ${report.error.message}`;
  const diagnostic = Str.trim(stderr);
  return Str.isNonEmpty(diagnostic)
    ? `Person-match worker exited with code ${exitCode}: ${diagnostic}`
    : `Person-match worker exited with code ${exitCode}.`;
};

const decodeWorkerExecution = Effect.fn("Files.decodeMatchPersonWorkerExecution")(function* (
  stdout: string,
  stderr: string,
  exitCode: number,
  truncated: boolean
): Effect.fn.Return<PersonMatchWorkerSuccess, FilesCommandError> {
  if (truncated) {
    return yield* FilesCommandError.make({
      message: "Person-match worker output exceeded the 256 MiB safety bound; split the scan into smaller batches.",
    });
  }

  const decoded = yield* decodePersonMatchWorkerReportJson(stdout, { onExcessProperty: "error" }).pipe(Effect.option);
  if (O.isNone(decoded)) {
    const diagnostic = Str.trim(stderr);
    return yield* FilesCommandError.make({
      message: Str.isNonEmpty(diagnostic)
        ? `Person-match worker returned invalid JSON: ${diagnostic}`
        : "Person-match worker returned invalid or empty JSON.",
    });
  }
  if (exitCode !== 0 || !decoded.value.ok) {
    return yield* FilesCommandError.make({
      message: workerFailureMessage(decoded.value, stderr, exitCode),
    });
  }
  return decoded.value;
});

const validateUniqueRecursiveReferenceNames = Effect.fn("Files.validateUniqueRecursiveReferenceNames")(function* (
  references: ReadonlyArray<PersonMatchReference>,
  recursive: boolean
): Effect.fn.Return<void, FilesCommandError> {
  if (!recursive) return;
  const acceptedReferenceNames = MutableHashSet.empty<string>();
  for (const reference of references) {
    if (!reference.accepted) continue;
    if (MutableHashSet.has(acceptedReferenceNames, reference.sourceName)) {
      return yield* FilesCommandError.make({
        message: `Recursive person-match references contain duplicate accepted file names: "${reference.sourceName}". Rename one reference so face evidence remains unambiguous.`,
      });
    }
    MutableHashSet.add(acceptedReferenceNames, reference.sourceName);
  }
});

const runWorker = Effect.fn("Files.runMatchPersonWorker")(function* (
  options: MatchPersonOptions,
  inputs: CanonicalMatchPersonInputs
): Effect.fn.Return<PersonMatchWorkerSuccess, FilesCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runCapturedStreams({
    command: inputs.uvPath,
    args: workerArguments(options, inputs),
    cwd: workerProjectDirectory,
    extendEnv: true,
    env: {
      NO_COLOR: "1",
      PYTHONUTF8: "1",
      UV_CACHE_DIR: inputs.uvCacheRoot,
      UV_NO_PROGRESS: "1",
      UV_PROJECT_ENVIRONMENT: inputs.uvEnvironment,
    },
    bound: workerOutputBound,
    trim: true,
  }).pipe(FilesCommandError.mapError("Failed to start the local person-match worker"));

  const worker = yield* decodeWorkerExecution(result.stdout, result.stderr, result.exitCode, result.truncated);
  yield* validateUniqueRecursiveReferenceNames(worker.references, options.recursive);
  return worker;
});

const materializationCategory = (disposition: PersonMatchDisposition): O.Option<string> =>
  Match.value(disposition).pipe(
    Match.when("solo-match", () => O.some("accepted")),
    Match.when("group-match", () => O.some("group-review")),
    Match.when("low-quality-match", () => O.some("quality-review")),
    Match.when("review", () => O.some("identity-review")),
    Match.orElse(O.none<string>)
  );

const safeRelativePath = (
  path: Pick<MatchPersonPathOperations, "isAbsolute" | "normalize" | "sep">,
  relativePath: string
): O.Option<string> => {
  const normalized = path.normalize(relativePath);
  return path.isAbsolute(normalized) ||
    normalized === "." ||
    normalized === ".." ||
    Str.startsWith(`..${path.sep}`)(normalized) ||
    Str.includes("\0")(normalized)
    ? O.none()
    : O.some(normalized);
};

const validateWorkerParameters = Effect.fn("Files.validatePersonMatchWorkerParameters")(function* (
  parameters: PersonMatchParameters,
  options: MatchPersonOptions
): Effect.fn.Return<void, FilesCommandError> {
  if (
    parameters.detectionThreshold !== options.detectionThreshold ||
    parameters.matchThreshold !== options.matchThreshold ||
    parameters.reviewThreshold !== options.reviewThreshold ||
    parameters.minFaceAreaPct !== options.minFaceAreaPct ||
    parameters.recursive !== options.recursive
  ) {
    return yield* FilesCommandError.make({
      message: "Person-match worker reported parameters that do not match the requested scan.",
    });
  }
});

const validateWorkerModelArtifact = Effect.fn("Files.validatePersonMatchWorkerModelArtifact")(function* (
  artifact: PersonMatchModelArtifact,
  modelRoot: string,
  artifactNames: MutableHashSet.MutableHashSet<string>
): Effect.fn.Return<void, FilesCommandError, Path.Path> {
  const path = yield* Path.Path;
  if (MutableHashSet.has(artifactNames, artifact.name)) {
    return yield* FilesCommandError.make({
      message: `Person-match worker reported duplicate model artifact provenance for "${artifact.name}".`,
    });
  }
  MutableHashSet.add(artifactNames, artifact.name);
  const expectedArtifactPath = path.join(modelRoot, "models", workerModelRuntimeName, artifact.name);
  if (
    path.resolve(artifact.path) !== expectedArtifactPath ||
    artifact.sha256 !== workerModelArtifactSha256[artifact.name]
  ) {
    return yield* FilesCommandError.make({
      message: `Person-match worker reported unexpected model artifact provenance for "${artifact.name}".`,
    });
  }
});

const validateWorkerModel = Effect.fn("Files.validatePersonMatchWorkerModel")(function* (
  model: PersonMatchModel,
  modelRoot: string
): Effect.fn.Return<void, FilesCommandError, Path.Path> {
  const path = yield* Path.Path;
  if (path.resolve(model.root) !== modelRoot) {
    return yield* FilesCommandError.make({
      message: "Person-match worker reported a model root outside the selected cache.",
    });
  }
  const artifactNames = MutableHashSet.empty<string>();
  yield* Effect.forEach(
    model.artifacts,
    (artifact) => validateWorkerModelArtifact(artifact, modelRoot, artifactNames),
    { concurrency: 1, discard: true }
  );
  if (
    A.length(model.artifacts) !== 2 ||
    !MutableHashSet.has(artifactNames, "det_10g.onnx") ||
    !MutableHashSet.has(artifactNames, "w600k_r50.onnx")
  ) {
    return yield* FilesCommandError.make({
      message: "Person-match worker did not report the exact pinned detector and recognizer artifacts.",
    });
  }
});

const validateWorkerReference = Effect.fn("Files.validatePersonMatchWorkerReference")(function* (
  reference: PersonMatchReference,
  referenceDirectory: string,
  referencePaths: MutableHashSet.MutableHashSet<string>
): Effect.fn.Return<boolean, FilesCommandError, Path.Path> {
  const path = yield* Path.Path;
  const referencePath = path.resolve(reference.sourcePath);
  if (
    !pathContains(path, referenceDirectory, referencePath) ||
    reference.sourceName !== path.basename(referencePath) ||
    MutableHashSet.has(referencePaths, referencePath)
  ) {
    return yield* FilesCommandError.make({
      message: `Person-match worker returned an invalid or duplicate reference path: "${reference.sourcePath}".`,
    });
  }
  MutableHashSet.add(referencePaths, referencePath);
  if (reference.accepted) {
    if (reference.faceCount !== 1 || reference.detectionScore === undefined || reference.reason !== undefined) {
      return yield* FilesCommandError.make({
        message: `Person-match worker returned inconsistent accepted reference evidence for "${reference.sourcePath}".`,
      });
    }
    return true;
  }
  if (reference.reason === undefined) {
    return yield* FilesCommandError.make({
      message: `Person-match worker omitted the rejection reason for reference "${reference.sourcePath}".`,
    });
  }
  return false;
});

const validateWorkerReferences = Effect.fn("Files.validatePersonMatchWorkerReferences")(function* (
  references: ReadonlyArray<PersonMatchReference>,
  referenceDirectory: string
): Effect.fn.Return<ValidatedWorkerReferences, FilesCommandError, Path.Path> {
  const acceptedNames = MutableHashSet.empty<string>();
  const referencePaths = MutableHashSet.empty<string>();
  let acceptedCount = 0;
  for (const reference of references) {
    const accepted = yield* validateWorkerReference(reference, referenceDirectory, referencePaths);
    if (!accepted) continue;
    acceptedCount += 1;
    MutableHashSet.add(acceptedNames, reference.sourceName);
  }
  return { acceptedCount, acceptedNames };
});

const validateWorkerEntryPath = Effect.fn("Files.validatePersonMatchWorkerEntryPath")(function* (
  entry: PersonMatchEntry,
  candidateDirectory: string,
  sourcePaths: MutableHashSet.MutableHashSet<string>,
  relativePaths: MutableHashSet.MutableHashSet<string>
): Effect.fn.Return<void, FilesCommandError, Path.Path> {
  const path = yield* Path.Path;
  const safeRelative = safeRelativePath(path, entry.relativePath);
  if (O.isNone(safeRelative)) {
    return yield* FilesCommandError.make({
      message: `Person-match worker returned an unsafe relative path: "${entry.relativePath}"`,
    });
  }
  const expectedSourcePath = path.resolve(candidateDirectory, safeRelative.value);
  const reportedSourcePath = path.resolve(entry.sourcePath);
  if (reportedSourcePath !== expectedSourcePath || entry.sourceName !== path.basename(expectedSourcePath)) {
    return yield* FilesCommandError.make({
      message: `Person-match worker returned mismatched source and relative paths for "${entry.relativePath}".`,
    });
  }
  if (MutableHashSet.has(sourcePaths, reportedSourcePath) || MutableHashSet.has(relativePaths, safeRelative.value)) {
    return yield* FilesCommandError.make({
      message: `Person-match worker returned a duplicate candidate entry for "${entry.relativePath}".`,
    });
  }
  MutableHashSet.add(sourcePaths, reportedSourcePath);
  MutableHashSet.add(relativePaths, safeRelative.value);
});

const maximumValidatedFaceScore = Effect.fn("Files.maximumValidatedPersonMatchFaceScore")(function* (
  entry: PersonMatchEntry,
  acceptedReferenceNames: MutableHashSet.MutableHashSet<string>
): Effect.fn.Return<number, FilesCommandError> {
  let maximumMatchScore = -1;
  for (const face of entry.faces) {
    if (!MutableHashSet.has(acceptedReferenceNames, face.bestReferenceName)) {
      return yield* FilesCommandError.make({
        message: `Person-match worker referenced an unaccepted identity source for "${entry.relativePath}".`,
      });
    }
    if (!approximatelyEqualWorkerScore(face.matchScore, Num.max(face.centroidScore, face.top3MedianScore))) {
      return yield* FilesCommandError.make({
        message: `Person-match worker returned incoherent aggregate face scores for "${entry.relativePath}".`,
      });
    }
    maximumMatchScore = Num.max(maximumMatchScore, face.matchScore);
  }
  return maximumMatchScore;
});

const isWorkerDispositionCoherent = (
  entry: PersonMatchEntry,
  maximumMatchScore: number,
  options: MatchPersonOptions
): boolean => {
  const couldMeetMatchThreshold = maximumMatchScore >= options.matchThreshold - workerScoreRoundingTolerance;
  const mustMeetMatchThreshold = maximumMatchScore > options.matchThreshold + workerScoreRoundingTolerance;
  const couldMeetReviewThreshold = maximumMatchScore >= options.reviewThreshold - workerScoreRoundingTolerance;
  const couldMissReviewThreshold = maximumMatchScore <= options.reviewThreshold + workerScoreRoundingTolerance;
  const hasQualityFlags = A.some(entry.faces, (face) => A.isReadonlyArrayNonEmpty(face.qualityFlags));
  return Match.value(entry.disposition).pipe(
    Match.when("solo-match", () => entry.faceCount === 1 && couldMeetMatchThreshold && !hasQualityFlags),
    Match.when("low-quality-match", () => entry.faceCount === 1 && couldMeetMatchThreshold && hasQualityFlags),
    Match.when("group-match", () => entry.faceCount > 1 && couldMeetMatchThreshold),
    Match.when("review", () => !mustMeetMatchThreshold && couldMeetReviewThreshold),
    Match.when("no-match", () => couldMissReviewThreshold),
    Match.when("no-face", () => false),
    Match.when("unreadable", () => false),
    Match.exhaustive
  );
};

const hasNoComparableWorkerFace = (entry: PersonMatchEntry): boolean =>
  entry.disposition === "no-face" || entry.disposition === "unreadable";

const validateWorkerEntryFaceShape = Effect.fn("Files.validatePersonMatchWorkerEntryFaceShape")(function* (
  entry: PersonMatchEntry,
  hasNoComparableFace: boolean
): Effect.fn.Return<void, FilesCommandError> {
  if (entry.faceCount !== A.length(entry.faces)) {
    return yield* FilesCommandError.make({
      message: `Person-match worker returned a face-count mismatch for "${entry.relativePath}".`,
    });
  }
  if (
    (hasNoComparableFace && (entry.faceCount !== 0 || entry.bestScore !== undefined)) ||
    (!hasNoComparableFace && (entry.faceCount === 0 || entry.bestScore === undefined))
  ) {
    return yield* FilesCommandError.make({
      message: `Person-match worker returned incoherent face evidence for "${entry.relativePath}".`,
    });
  }
});

const validateWorkerEntryReason = Effect.fn("Files.validatePersonMatchWorkerEntryReason")(function* (
  entry: PersonMatchEntry
): Effect.fn.Return<void, FilesCommandError> {
  if (
    (entry.disposition === "unreadable" && entry.reason !== "image-decode-failed") ||
    (entry.disposition !== "unreadable" && entry.reason !== undefined)
  ) {
    return yield* FilesCommandError.make({
      message: `Person-match worker returned an incoherent candidate reason for "${entry.relativePath}".`,
    });
  }
});

const validateWorkerEntryBestScore = Effect.fn("Files.validatePersonMatchWorkerEntryBestScore")(function* (
  entry: PersonMatchEntry,
  maximumMatchScore: number
): Effect.fn.Return<void, FilesCommandError> {
  if (entry.bestScore === undefined || !approximatelyEqualWorkerScore(entry.bestScore, maximumMatchScore)) {
    return yield* FilesCommandError.make({
      message: `Person-match worker returned an incoherent best score for "${entry.relativePath}".`,
    });
  }
});

const validateWorkerEntryDisposition = Effect.fn("Files.validatePersonMatchWorkerEntryDisposition")(function* (
  entry: PersonMatchEntry,
  maximumMatchScore: number,
  options: MatchPersonOptions
): Effect.fn.Return<void, FilesCommandError> {
  if (!isWorkerDispositionCoherent(entry, maximumMatchScore, options)) {
    return yield* FilesCommandError.make({
      message: `Person-match worker returned a disposition inconsistent with its thresholds or quality evidence for "${entry.relativePath}".`,
    });
  }
});

const validateWorkerEntryEvidence = Effect.fn("Files.validatePersonMatchWorkerEntryEvidence")(function* (
  entry: PersonMatchEntry,
  acceptedReferenceNames: MutableHashSet.MutableHashSet<string>,
  options: MatchPersonOptions
): Effect.fn.Return<void, FilesCommandError> {
  const hasNoComparableFace = hasNoComparableWorkerFace(entry);
  yield* validateWorkerEntryFaceShape(entry, hasNoComparableFace);
  yield* validateWorkerEntryReason(entry);
  const maximumMatchScore = yield* maximumValidatedFaceScore(entry, acceptedReferenceNames);
  if (hasNoComparableFace) return;
  yield* validateWorkerEntryBestScore(entry, maximumMatchScore);
  yield* validateWorkerEntryDisposition(entry, maximumMatchScore, options);
});

const validateWorkerEntry = Effect.fn("Files.validatePersonMatchWorkerEntry")(function* (
  entry: PersonMatchEntry,
  inputs: CanonicalMatchPersonInputs,
  acceptedReferenceNames: MutableHashSet.MutableHashSet<string>,
  sourcePaths: MutableHashSet.MutableHashSet<string>,
  relativePaths: MutableHashSet.MutableHashSet<string>,
  options: MatchPersonOptions
): Effect.fn.Return<void, FilesCommandError, Path.Path> {
  yield* validateWorkerEntryPath(entry, inputs.candidateDirectory, sourcePaths, relativePaths);
  yield* validateWorkerEntryEvidence(entry, acceptedReferenceNames, options);
});

const validateWorkerSummary = Effect.fn("Files.validatePersonMatchWorkerSummary")(function* (
  worker: PersonMatchWorkerSuccess,
  acceptedReferenceCount: number
): Effect.fn.Return<void, FilesCommandError> {
  const dispositionCounts: ReadonlyArray<readonly [PersonMatchDisposition, number]> = [
    ["solo-match", worker.summary.soloMatchCount],
    ["group-match", worker.summary.groupMatchCount],
    ["low-quality-match", worker.summary.lowQualityMatchCount],
    ["review", worker.summary.reviewCount],
    ["no-match", worker.summary.noMatchCount],
    ["no-face", worker.summary.noFaceCount],
    ["unreadable", worker.summary.unreadableCount],
  ];
  if (
    worker.summary.totalCount !== A.length(worker.entries) ||
    worker.summary.acceptedReferenceCount !== acceptedReferenceCount ||
    worker.summary.rejectedReferenceCount !== A.length(worker.references) - acceptedReferenceCount ||
    A.some(
      dispositionCounts,
      ([disposition, expected]) =>
        A.length(A.filter(worker.entries, (entry) => entry.disposition === disposition)) !== expected
    )
  ) {
    return yield* FilesCommandError.make({
      message: "Person-match worker summary counts do not match its reference and candidate entries.",
    });
  }
});

const validateWorkerSemantics = Effect.fn("Files.validatePersonMatchWorkerSemantics")(function* (
  worker: PersonMatchWorkerSuccess,
  inputs: CanonicalMatchPersonInputs,
  options: MatchPersonOptions
): Effect.fn.Return<void, FilesCommandError, Path.Path> {
  yield* validateWorkerParameters(worker.parameters, options);
  yield* validateWorkerModel(worker.model, inputs.modelRoot);
  const references = yield* validateWorkerReferences(worker.references, inputs.referenceDirectory);
  const sourcePaths = MutableHashSet.empty<string>();
  const relativePaths = MutableHashSet.empty<string>();
  yield* Effect.forEach(
    worker.entries,
    (entry) => validateWorkerEntry(entry, inputs, references.acceptedNames, sourcePaths, relativePaths, options),
    { concurrency: 1, discard: true }
  );
  yield* validateWorkerSummary(worker, references.acceptedCount);
});

const resolveCopyPlanEntry = Effect.fn("Files.resolvePersonMatchCopyPlanEntry")(function* (
  entry: PersonMatchEntry,
  candidateDirectory: string,
  outputDirectory: string
): Effect.fn.Return<O.Option<PersonMatchCopyPlanEntry>, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const category = materializationCategory(entry.disposition);
  if (O.isNone(category)) return O.none();
  const relativePath = safeRelativePath(path, entry.relativePath);
  if (O.isNone(relativePath)) {
    return yield* FilesCommandError.make({
      message: `Person-match worker returned an unsafe relative path: "${entry.relativePath}"`,
    });
  }

  const requestedSourcePath = path.resolve(entry.sourcePath);
  const sourcePath = yield* fs
    .realPath(requestedSourcePath)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to resolve person-match source", requestedSourcePath, { cause })
      )
    );
  const requestedTargetPath = path.resolve(outputDirectory, category.value, relativePath.value);
  const targetPath = yield* canonicalizeFileTargetPath(requestedTargetPath, "person-match output");
  if (!pathContains(path, candidateDirectory, sourcePath) || !pathContains(path, outputDirectory, targetPath)) {
    return yield* FilesCommandError.make({
      message: `Person-match worker returned a source or target path outside the selected roots: "${entry.sourcePath}"`,
    });
  }
  if (sourcePath !== requestedSourcePath) {
    return yield* FilesCommandError.make({
      message: `Refusing symlinked or aliased person-match source: "${requestedSourcePath}"`,
    });
  }
  if (targetPath !== requestedTargetPath) {
    return yield* FilesCommandError.make({
      message: `Refusing symlinked or aliased person-match output: "${requestedTargetPath}"`,
    });
  }
  return O.some({ sourcePath, targetPath });
});

const preflightCopyPlanEntry = Effect.fn("Files.preflightPersonMatchCopyPlanEntry")(function* (
  entry: PersonMatchCopyPlanEntry,
  overwrite: boolean
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const sourceStat = yield* fs
    .stat(entry.sourcePath)
    .pipe(
      Effect.mapError((cause) => formatPlatformError("Failed to stat person-match source", entry.sourcePath, { cause }))
    );
  if (sourceStat.type !== "File") {
    return yield* FilesCommandError.make({
      message: `Person-match source is not a regular file: "${entry.sourcePath}"`,
    });
  }

  const targetExists = yield* fs
    .exists(entry.targetPath)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to inspect person-match output", entry.targetPath, { cause })
      )
    );
  if (!targetExists) return;
  const targetStat = yield* fs
    .stat(entry.targetPath)
    .pipe(
      Effect.mapError((cause) => formatPlatformError("Failed to stat person-match output", entry.targetPath, { cause }))
    );
  if (targetStat.type !== "File") {
    return yield* FilesCommandError.make({
      message: `Refusing to overwrite non-file person-match output: "${entry.targetPath}"`,
    });
  }
  if (!overwrite) {
    return yield* FilesCommandError.make({
      message: `Refusing to overwrite existing person-match output: "${entry.targetPath}"`,
    });
  }
});

const buildCopyPlanEntry = Effect.fn("Files.buildPersonMatchCopyPlanEntry")(function* (
  entry: PersonMatchEntry,
  candidateDirectory: string,
  outputDirectory: string,
  overwrite: boolean
): Effect.fn.Return<O.Option<PersonMatchCopyPlanEntry>, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const planned = yield* resolveCopyPlanEntry(entry, candidateDirectory, outputDirectory);
  if (O.isNone(planned)) return O.none();
  yield* preflightCopyPlanEntry(planned.value, overwrite);
  return planned;
});

const buildCopyPlan = Effect.fn("Files.buildPersonMatchCopyPlan")(function* (
  entries: ReadonlyArray<PersonMatchEntry>,
  candidateDirectory: string,
  outputDirectory: string,
  overwrite: boolean
): Effect.fn.Return<ReadonlyArray<PersonMatchCopyPlanEntry>, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const planned = yield* Effect.forEach(
    entries,
    (entry) => buildCopyPlanEntry(entry, candidateDirectory, outputDirectory, overwrite),
    { concurrency: 1 }
  );
  return A.getSomes(planned);
});

const renderManifest = Effect.fn("Files.renderPersonMatchManifest")(function* (
  report: PersonMatchReport
): Effect.fn.Return<string, FilesCommandError> {
  const encoded = yield* encodePersonMatchReport(report).pipe(
    Effect.mapError((cause) => FilesCommandError.new(cause, "Failed to encode person-match report"))
  );
  const encodedJson = yield* encodeCommandJson(encoded).pipe(
    Effect.mapError((cause) => FilesCommandError.new(cause, "Failed to encode person-match report JSON"))
  );
  return renderPrettyCommandJson(encodedJson, { maxLength: DEFAULT_JSON_PRETTY_MAX_LENGTH });
});

const fileIdentitySnapshot = (info: FileSystem.File.Info): string =>
  A.join(
    [
      `${info.dev}`,
      pipe(
        info.ino,
        O.map(String),
        O.getOrElse(() => "unknown-inode")
      ),
      `${info.size}`,
      pipe(
        info.mtime,
        O.map((value) => `${value.getTime()}`),
        O.getOrElse(() => "unknown-mtime")
      ),
    ],
    ":"
  );

const stageCopy = Effect.fn("Files.stagePersonMatchCopy")(function* (
  entry: PersonMatchCopyPlanEntry
): Effect.fn.Return<PersonMatchCommitRecord, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const parent = path.dirname(entry.targetPath);
  yield* fs
    .makeDirectory(parent, { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create person-match output directory", parent, { cause })
      )
    );
  const temporaryDirectory = yield* fs
    .makeTempDirectory({ directory: parent, prefix: ".beep-files-person-match-copy-" })
    .pipe(Effect.mapError((cause) => formatPlatformError("Failed to stage person-match output", parent, { cause })));

  return yield* Effect.onError(
    Effect.gen(function* () {
      const currentSourcePath = yield* fs.realPath(entry.sourcePath).pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to re-resolve person-match source before staging", entry.sourcePath, {
            cause,
          })
        )
      );
      if (currentSourcePath !== entry.sourcePath) {
        return yield* FilesCommandError.make({
          message: `Person-match source changed or became an alias during the scan: "${entry.sourcePath}"`,
        });
      }

      const sourceStat = yield* fs.stat(currentSourcePath).pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to inspect person-match source metadata before staging", currentSourcePath, {
            cause,
          })
        )
      );
      if (sourceStat.type !== "File") {
        return yield* FilesCommandError.make({
          message: `Person-match source is no longer a regular file: "${currentSourcePath}"`,
        });
      }

      const stagedPath = path.join(temporaryDirectory, ".staged-output");
      yield* fs
        .copyFile(currentSourcePath, stagedPath)
        .pipe(
          Effect.mapError((cause) => formatPlatformError("Failed to stage person-match output", stagedPath, { cause }))
        );
      const sourceAfterCopy = yield* fs
        .realPath(entry.sourcePath)
        .pipe(
          Effect.mapError((cause) =>
            formatPlatformError("Failed to re-resolve person-match source after staging", entry.sourcePath, { cause })
          )
        );
      if (sourceAfterCopy !== currentSourcePath) {
        return yield* FilesCommandError.make({
          message: `Person-match source path identity changed while it was being staged: "${entry.sourcePath}"`,
        });
      }
      const sourceStatAfterCopy = yield* fs.stat(sourceAfterCopy).pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to inspect person-match source metadata after staging", sourceAfterCopy, {
            cause,
          })
        )
      );
      const stagedStat = yield* fs
        .stat(stagedPath)
        .pipe(
          Effect.mapError((cause) =>
            formatPlatformError("Failed to stat staged person-match output", stagedPath, { cause })
          )
        );
      if (
        sourceStatAfterCopy.type !== "File" ||
        stagedStat.type !== "File" ||
        fileIdentitySnapshot(sourceStatAfterCopy) !== fileIdentitySnapshot(sourceStat) ||
        stagedStat.size !== sourceStat.size
      ) {
        return yield* FilesCommandError.make({
          message: `Person-match source metadata changed while it was being staged: "${entry.sourcePath}"`,
        });
      }

      return {
        backupPath: path.join(temporaryDirectory, ".previous-output"),
        backedUp: false,
        committed: false,
        description: "person-match output",
        stagedPath,
        targetPath: entry.targetPath,
        temporaryDirectory,
      };
    }),
    () => fs.remove(temporaryDirectory, { force: true, recursive: true }).pipe(Effect.ignore)
  );
});

const stageManifest = Effect.fn("Files.stagePersonMatchManifest")(function* (
  report: PersonMatchReport,
  rendered: string
): Effect.fn.Return<PersonMatchCommitRecord, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const parent = path.dirname(report.manifestPath);
  yield* fs
    .makeDirectory(parent, { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create person-match manifest directory", parent, { cause })
      )
    );
  const temporaryDirectory = yield* fs
    .makeTempDirectory({ directory: parent, prefix: ".beep-files-person-match-manifest-" })
    .pipe(Effect.mapError((cause) => formatPlatformError("Failed to stage person-match manifest", parent, { cause })));

  return yield* Effect.onError(
    Effect.gen(function* () {
      const stagedPath = path.join(temporaryDirectory, ".staged-manifest");
      yield* fs
        .writeFileString(stagedPath, rendered)
        .pipe(
          Effect.mapError((cause) =>
            formatPlatformError("Failed to write staged person-match manifest", stagedPath, { cause })
          )
        );
      return {
        backupPath: path.join(temporaryDirectory, ".previous-manifest"),
        backedUp: false,
        committed: false,
        description: "person-match manifest",
        stagedPath,
        targetPath: report.manifestPath,
        temporaryDirectory,
      };
    }),
    () => fs.remove(temporaryDirectory, { force: true, recursive: true }).pipe(Effect.ignore)
  );
});

const inspectCommitDestination = Effect.fn("Files.inspectPersonMatchCommitDestination")(function* (
  record: PersonMatchCommitRecord,
  overwrite: boolean
): Effect.fn.Return<boolean, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const canonicalTarget = yield* canonicalizeFileTargetPath(record.targetPath, record.description);
  if (canonicalTarget !== record.targetPath) {
    return yield* FilesCommandError.make({
      message: `Refusing a symlinked or aliased ${record.description}: "${record.targetPath}"`,
    });
  }
  const exists = yield* fs
    .exists(record.targetPath)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError(`Failed to recheck ${record.description}`, record.targetPath, { cause })
      )
    );
  if (!exists) return false;

  const stat = yield* fs
    .stat(record.targetPath)
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError(`Failed to inspect ${record.description} metadata`, record.targetPath, { cause })
      )
    );
  if (stat.type !== "File") {
    return yield* FilesCommandError.make({
      message: `Refusing to replace a non-file ${record.description}: "${record.targetPath}"`,
    });
  }
  if (!overwrite) {
    return yield* FilesCommandError.make({
      message: `Refusing to replace ${record.description} created during the scan: "${record.targetPath}"`,
    });
  }
  return true;
});

const recoverCommittedTarget = Effect.fn("Files.recoverCommittedPersonMatchTarget")(function* (
  record: PersonMatchCommitRecord
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  if (!record.committed) return O.none();
  const recovered = yield* fs.rename(record.targetPath, record.stagedPath).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false)
  );
  if (!recovered) {
    return O.some(
      `could not recover newly committed "${record.targetPath}" to "${record.stagedPath}"; staging retained at "${record.temporaryDirectory}"`
    );
  }
  record.committed = false;
  return O.none();
});

const restoreBackedUpTarget = Effect.fn("Files.restoreBackedUpPersonMatchTarget")(function* (
  record: PersonMatchCommitRecord
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  if (!record.backedUp) return O.none();
  const restored = yield* fs.rename(record.backupPath, record.targetPath).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false)
  );
  if (!restored) {
    return O.some(
      `could not restore "${record.backupPath}" to "${record.targetPath}"; staging retained at "${record.temporaryDirectory}"`
    );
  }
  record.backedUp = false;
  return O.none();
});

const rollbackCommitRecord = Effect.fn("Files.rollbackPersonMatchCommitRecord")(function* (
  record: PersonMatchCommitRecord
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem> {
  const recoverFailure = yield* recoverCommittedTarget(record);
  if (record.committed) return A.getSomes([recoverFailure]);
  const restoreFailure = yield* restoreBackedUpTarget(record);
  return A.getSomes([recoverFailure, restoreFailure]);
});

const rollbackCommit = Effect.fn("Files.rollbackPersonMatchCommit")(function* (
  records: ReadonlyArray<PersonMatchCommitRecord>
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem> {
  const failures = A.flatten(yield* Effect.forEach(A.reverse(records), rollbackCommitRecord, { concurrency: 1 }));
  if (A.isReadonlyArrayNonEmpty(failures)) {
    return yield* FilesCommandError.make({
      message: `Person-match rollback was incomplete: ${A.join(failures, "; ")}.`,
    });
  }
});

const cleanupCommitStaging = Effect.fn("Files.cleanupPersonMatchCommitStaging")(function* (
  records: ReadonlyArray<PersonMatchCommitRecord>
) {
  const fs = yield* FileSystem.FileSystem;
  const cleaned = MutableHashSet.empty<string>();
  for (const record of records) {
    if (record.backedUp || record.committed || MutableHashSet.has(cleaned, record.temporaryDirectory)) continue;
    MutableHashSet.add(cleaned, record.temporaryDirectory);
    yield* fs.remove(record.temporaryDirectory, { force: true, recursive: true }).pipe(Effect.ignore);
  }
});

const commitStagedFiles = Effect.fn("Files.commitPersonMatchStagedFiles")(function* (
  records: ReadonlyArray<PersonMatchCommitRecord>,
  overwrite: boolean
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  yield* Effect.uninterruptible(
    Effect.gen(function* () {
      for (const record of records) {
        const targetExists = yield* inspectCommitDestination(record, overwrite);
        if (!targetExists) continue;
        yield* backupStagedFileTarget(record);
      }

      for (const record of records) {
        yield* commitStagedFileByRename(record, "Failed to atomically commit");
      }

      for (const record of records) {
        record.committed = false;
        record.backedUp = false;
      }
    }).pipe(
      Effect.catch((commitError) =>
        rollbackCommit(records).pipe(
          Effect.matchEffect({
            onFailure: (rollbackError) =>
              FilesCommandError.make({
                cause: commitError,
                message: `${commitError.message} ${rollbackError.message}`,
              }),
            onSuccess: () => Effect.fail(commitError),
          })
        )
      )
    )
  );
});

const materializeReport = Effect.fn("Files.materializePersonMatchReport")(function* (
  report: PersonMatchReport,
  copyPlan: ReadonlyArray<PersonMatchCopyPlanEntry>,
  overwrite: boolean
): Effect.fn.Return<string, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const rendered = yield* renderManifest(report);
  const records: Array<PersonMatchCommitRecord> = [];
  return yield* Effect.ensuring(
    Effect.gen(function* () {
      for (const entry of copyPlan) {
        records.push(yield* stageCopy(entry));
      }
      records.push(yield* stageManifest(report, rendered));
      yield* commitStagedFiles(records, overwrite);
      return rendered;
    }),
    Effect.suspend(() => cleanupCommitStaging(records))
  );
});

/**
 * Run the local target-person matcher and write its privacy-preserving report.
 *
 * **Details**
 *
 * The default Python environment, verified InsightFace models, and dependency
 * cache live outside the repository; `--cache-dir` selects another location.
 * Candidate photos remain immutable; optional materialization copies only
 * accepted and review-lane images, and raw face embeddings never cross the
 * worker boundary.
 *
 * **Example** (Reference the operation)
 *
 * ```ts
 * import { matchPerson } from "@beep/repo-cli/commands/Files"
 *
 * const operation = matchPerson
 * console.log(typeof operation)
 * ```
 *
 * @param options - Candidate, references, threshold, cache, manifest, and copy options.
 * @returns The schema-versioned person-match report.
 * @category use-cases
 * @since 0.0.0
 */
export const runMatchPerson = Effect.fn("Files.runMatchPerson")(function* (
  options: MatchPersonOptions
): Effect.fn.Return<
  PersonMatchReport,
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const inputs = yield* validateMatchPersonInputs(options);
  if (!options.json) {
    yield* Console.log(
      `files match-person: loading local buffalo_l models and scanning "${inputs.candidateDirectory}" against "${inputs.referenceDirectory}".`
    );
  }

  const worker = yield* runWorker(options, inputs);
  yield* validateWorkerSemantics(worker, inputs, options);
  if (worker.summary.acceptedReferenceCount === 0) {
    return yield* FilesCommandError.make({
      message: "Person-match worker did not accept any single-face reference images.",
    });
  }

  const copyPlan = O.isSome(inputs.outputDirectory)
    ? yield* buildCopyPlan(worker.entries, inputs.candidateDirectory, inputs.outputDirectory.value, options.overwrite)
    : A.empty<PersonMatchCopyPlanEntry>();

  const report = PersonMatchReport.make({
    schemaVersion: "beep.files.match-person.v1",
    ok: true,
    model: worker.model,
    parameters: worker.parameters,
    references: worker.references,
    entries: worker.entries,
    summary: worker.summary,
    elapsedSeconds: worker.elapsedSeconds,
    manifestPath: inputs.manifestPath,
    manifestWritten: true,
    ...(O.isSome(inputs.outputDirectory) ? { outputDirectory: inputs.outputDirectory.value } : {}),
  });
  const rendered = yield* materializeReport(report, copyPlan, options.overwrite);

  if (options.json) {
    const writeJson = yield* CommandJsonOutput;
    yield* writeJson(rendered);
  } else {
    yield* Console.log(
      `files match-person: ${report.summary.soloMatchCount} solo match(es), ${report.summary.groupMatchCount} group review(s), ${report.summary.lowQualityMatchCount} quality review(s), ${report.summary.reviewCount} identity review(s), ${report.summary.noMatchCount} no-match, ${report.summary.noFaceCount} no-face, ${report.summary.unreadableCount} unreadable.`
    );
    yield* Console.log(`files match-person: wrote "${report.manifestPath}".`);
  }

  return report;
});
