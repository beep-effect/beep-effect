/**
 * Local InsightFace orchestration and non-destructive person-match materialization.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { A, HostProcessArchitecture, HostProcessPlatform, Str } from "@beep/utils";
import {
  Config,
  Console,
  Effect,
  FileSystem,
  flow,
  Match,
  MutableHashSet,
  MutableRef,
  Number as Num,
  Path,
  pipe,
} from "effect";
import * as Bool from "effect/Boolean";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  CommandJsonOutput,
  DEFAULT_JSON_PRETTY_MAX_LENGTH,
  encodeCommandJson,
  renderPrettyCommandJson,
} from "../../../internal/cli/Json.ts";
import { FilesCommandError, formatPlatformError } from "../Files.errors.ts";
import {
  backupStagedFileTarget,
  canonicalizeFileTargetPath,
  commitStagedFileByRename,
  StagedFileCommitRecord,
} from "./FileTransaction.ts";
import { toFilesCommandError } from "./MatchPerson.errors.ts";
import {
  encodePersonMatchReport,
  PERSON_MATCH_MAX_CANDIDATE_IMAGES,
  PERSON_MATCH_MAX_REFERENCE_IMAGES,
  PersonMatchModel,
  PersonMatchReport,
} from "./MatchPerson.schemas.ts";
import { CanonicalMatchPersonInputs, PersonMatchWorkerService } from "./MatchPerson.worker-service.ts";
import type {
  MatchPersonOptions,
  PersonMatchBackend,
  PersonMatchDisposition,
  PersonMatchEntry,
  PersonMatchModelArtifact,
  PersonMatchModelComponent,
  PersonMatchOnnxRuntime,
  PersonMatchPyTorchRuntime,
  PersonMatchReference,
  PersonMatchWorkerSuccess,
} from "./MatchPerson.schemas.ts";

const $I = $RepoCliId.create("commands/Files/internal/MatchPerson");

const workerModelRuntimeName = "beep_buffalo_l_v1";
const workerModelArtifactSha256: Readonly<Record<string, string>> = {
  "det_10g.onnx": "5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91",
  "w600k_r50.onnx": "4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43",
};
const workerScoreRoundingTolerance = 0.000001;
const adaFaceHipVersionPrefix = "7.2";
const adaFaceRocmArchitecture = "gfx1201";
const trustedUvRoots = ["/usr/bin", "/usr/local/bin"] as const;
const personMatchDeviceIndexesEquivalence = S.toEquivalence(S.Array(NonNegativeInt));
const PersonMatchSupportedImageExtension = LiteralKit(["jpg", "jpeg", "png", "webp"]).pipe(
  $I.annoteSchema("PersonMatchSupportedImageExtension", {
    description: "A lowercase image extension discovered by the isolated person-match worker.",
  })
);
const isPersonMatchSupportedImageExtension = S.is(PersonMatchSupportedImageExtension);

type PersonMatchDiscoveryBudget = {
  readonly count: MutableRef.MutableRef<number>;
  readonly entryCount: MutableRef.MutableRef<number>;
  readonly label: "candidate" | "reference";
  readonly limit: number;
};

const adaFaceRuntimeSupportsPlatform = (platform: string, architecture: string): boolean =>
  Str.Equivalence(platform, "linux") && Str.Equivalence(architecture, "x64");

const buffaloRuntimeSupportsPlatform = (platform: string, architecture: string): boolean =>
  Match.value(platform).pipe(
    Match.when("linux", () => Str.Equivalence(architecture, "x64") || Str.Equivalence(architecture, "arm64")),
    Match.when("darwin", () => Str.Equivalence(architecture, "x64") || Str.Equivalence(architecture, "arm64")),
    Match.when("win32", () => Str.Equivalence(architecture, "x64")),
    Match.orElse(() => false)
  );

/**
 * Select the person-match backend default for a host.
 *
 * **Example** (Select a portable backend)
 *
 * ```ts
 * import { defaultPersonMatchBackendForPlatform } from "./MatchPerson.ts"
 *
 * console.log(defaultPersonMatchBackendForPlatform("darwin", "arm64"))
 * // "buffalo-l"
 * ```
 *
 * @param platform - Node.js host platform identifier.
 * @param architecture - Node.js host architecture identifier.
 * @returns AdaFace on Linux x64 and Buffalo elsewhere; runtime validation rejects unsupported Buffalo hosts.
 * @category utilities
 * @since 0.0.0
 */
export const defaultPersonMatchBackendForPlatform: {
  (platform: string, architecture: string): PersonMatchBackend;
  (architecture: string): (platform: string) => PersonMatchBackend;
} = dual(
  2,
  (platform: string, architecture: string): PersonMatchBackend =>
    Bool.match(adaFaceRuntimeSupportsPlatform(platform, architecture), {
      onFalse: () => "buffalo-l",
      onTrue: () => "adaface-kprpe",
    })
);

/**
 * Resolve the trusted uv executable leaf for a host platform.
 *
 * **Example** (Select the Windows executable)
 *
 * ```ts
 * import { trustedUvExecutableNameForPlatform } from "./MatchPerson.ts"
 *
 * console.log(trustedUvExecutableNameForPlatform("win32"))
 * // "uv.exe"
 * ```
 *
 * @param platform - Node.js host platform identifier.
 * @returns The platform-specific uv executable filename.
 * @category utilities
 * @since 0.0.0
 */
export const trustedUvExecutableNameForPlatform = (platform: string): string =>
  Match.value(platform).pipe(
    Match.when("win32", () => "uv.exe"),
    Match.orElse(() => "uv")
  );

/**
 * Resolve the fixed system directories eligible for trusted uv discovery.
 *
 * **Example** (Avoid POSIX roots on Windows)
 *
 * ```ts
 * import { trustedUvRootDirectoriesForPlatform } from "./MatchPerson.ts"
 *
 * console.log(trustedUvRootDirectoriesForPlatform("win32"))
 * // []
 * ```
 *
 * @param platform - Node.js host platform identifier.
 * @returns POSIX trusted roots on non-Windows hosts and no fixed roots on Windows.
 * @category utilities
 * @since 0.0.0
 */
export const trustedUvRootDirectoriesForPlatform = (platform: string): ReadonlyArray<string> =>
  Bool.match(Str.Equivalence(platform, "win32"), {
    onFalse: () => trustedUvRoots,
    onTrue: A.empty<string>,
  });

/**
 * Validate that the selected backend has a pinned runtime for the host.
 *
 * **Example** (Validate the portable backend)
 *
 * ```ts
 * import { validatePersonMatchBackendPlatform } from "./MatchPerson.ts"
 *
 * const validation = validatePersonMatchBackendPlatform("buffalo-l", "win32", "x64")
 * console.log(validation.pipe !== undefined)
 * // true
 * ```
 *
 * @param backend - Explicit or host-derived person-match backend.
 * @param platform - Node.js host platform identifier.
 * @param architecture - Node.js host architecture identifier.
 * @returns An Effect that fails before artifact acquisition when the backend is unavailable.
 * @category validation
 * @since 0.0.0
 */
export const validatePersonMatchBackendPlatform = Effect.fn("Files.validatePersonMatchBackendPlatform")(function* (
  backend: PersonMatchBackend,
  platform: string,
  architecture: string
): Effect.fn.Return<void, FilesCommandError> {
  const supported = Match.value(backend).pipe(
    Match.when("buffalo-l", () => buffaloRuntimeSupportsPlatform(platform, architecture)),
    Match.when("adaface-kprpe", () => adaFaceRuntimeSupportsPlatform(platform, architecture)),
    Match.exhaustive
  );
  return yield* Bool.match(supported, {
    onFalse: () =>
      FilesCommandError.make({
        message: Match.value(backend).pipe(
          Match.when(
            "buffalo-l",
            () =>
              `InsightFace Buffalo is unavailable on ${platform}/${architecture}; its pinned CPU environment ` +
              "supports Linux x64/arm64, macOS x64/arm64, and Windows x64."
          ),
          Match.when(
            "adaface-kprpe",
            () =>
              `AdaFace KP-RPE is unavailable on ${platform}/${architecture}; its pinned ROCm PyTorch runtime ` +
              "supports only Linux x64. Re-run with --backend buffalo-l --compute cpu."
          ),
          Match.exhaustive
        ),
      }),
    onTrue: () => Effect.void,
  });
});

const approximatelyEqualWorkerScore = (left: number, right: number): boolean =>
  Num.max(Num.subtract(left, right), Num.subtract(right, left)) <= workerScoreRoundingTolerance;

class PersonMatchCopyPlanEntry extends S.Class<PersonMatchCopyPlanEntry>($I`PersonMatchCopyPlanEntry`)(
  {
    sourcePath: S.NonEmptyString,
    targetPath: S.NonEmptyString,
  },
  $I.annote("PersonMatchCopyPlanEntry", {
    description: "Canonical immutable source and destination paths for one planned photo copy.",
  })
) {}

class PersonMatchCommitRecord extends S.Class<PersonMatchCommitRecord>($I`PersonMatchCommitRecord`)(
  {
    ...StagedFileCommitRecord.fields,
    temporaryDirectory: S.NonEmptyString,
  },
  $I.annote("PersonMatchCommitRecord", {
    description: "Mutable staged-file transaction state with its owned cleanup directory.",
  })
) {}

class CanonicalMatchPersonCacheChildren extends S.Class<CanonicalMatchPersonCacheChildren>(
  $I`CanonicalMatchPersonCacheChildren`
)(
  {
    modelRoot: S.NonEmptyString,
    uvCacheRoot: S.NonEmptyString,
    uvCpuEnvironment: S.NonEmptyString,
    uvEnvironment: S.NonEmptyString,
  },
  $I.annote("CanonicalMatchPersonCacheChildren", {
    description: "Backend-specific canonical model, uv download-cache, and isolated environment paths.",
  })
) {}

class ValidatedWorkerReferences extends S.Class<ValidatedWorkerReferences>($I`ValidatedWorkerReferences`)(
  {
    acceptedCount: NonNegativeInt,
    acceptedNames: S.Array(S.NonEmptyString),
  },
  $I.annote("ValidatedWorkerReferences", {
    description: "Accepted reference count and unique names after validating worker reference evidence.",
  })
) {}

class ExpectedPersonMatchFiles extends S.Class<ExpectedPersonMatchFiles>($I`ExpectedPersonMatchFiles`)(
  {
    candidatePaths: S.Array(S.NonEmptyString),
    referencePaths: S.Array(S.NonEmptyString),
  },
  $I.annote("ExpectedPersonMatchFiles", {
    description: "Canonical supported candidate and reference paths expected at the worker protocol boundary.",
  })
) {}

const expectedPersonMatchFilesEquivalence = S.toEquivalence(ExpectedPersonMatchFiles);

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

const readConfiguredHome = Effect.fn("Files.matchPersonReadConfiguredHome")(function* (): Effect.fn.Return<
  O.Option<string>
> {
  const [home, userProfile] = yield* Effect.all([readOptionalConfig("HOME"), readOptionalConfig("USERPROFILE")], {
    concurrency: 2,
  });
  return pipe(
    home,
    O.orElse(() => userProfile)
  );
});

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
  const home = yield* readConfiguredHome();
  const selected = pipe(
    configured,
    O.map(path.resolve),
    O.orElse(() => O.map(xdgCacheHome, (root) => path.join(root, "beep", "photo-face"))),
    O.orElse(() => O.map(home, (root) => path.join(root, ".cache", "beep", "photo-face")))
  );

  if (O.isNone(selected)) {
    return yield* FilesCommandError.make({
      message: "Could not resolve a cache directory. Pass --cache-dir or configure XDG_CACHE_HOME/HOME/USERPROFILE.",
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
  cacheRoot: string,
  backend: MatchPersonOptions["backend"]
): Effect.fn.Return<CanonicalMatchPersonCacheChildren, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const modelChild = Match.value(backend).pipe(
    Match.when("buffalo-l", () => "insightface"),
    Match.when("adaface-kprpe", () => "adaface-kprpe"),
    Match.exhaustive
  );
  const environmentChild = Match.value(backend).pipe(
    Match.when("buffalo-l", () => "venv-cpu-py312-v1"),
    Match.when("adaface-kprpe", () => "venv-adaface-rocm72-py312-v1"),
    Match.exhaustive
  );
  const cpuEnvironmentChild = Match.value(backend).pipe(
    Match.when("buffalo-l", () => environmentChild),
    Match.when("adaface-kprpe", () => "venv-adaface-cpu-py312-v1"),
    Match.exhaustive
  );
  return CanonicalMatchPersonCacheChildren.make({
    modelRoot: yield* canonicalizeMatchPersonCacheChild(cacheRoot, modelChild, "person-match model directory"),
    uvCacheRoot: yield* canonicalizeMatchPersonCacheChild(cacheRoot, "uv-cache", "person-match uv cache directory"),
    uvCpuEnvironment: yield* canonicalizeMatchPersonCacheChild(
      cacheRoot,
      cpuEnvironmentChild,
      "person-match CPU uv environment"
    ),
    uvEnvironment: yield* canonicalizeMatchPersonCacheChild(cacheRoot, environmentChild, "person-match uv environment"),
  });
});

const resolveTrustedUvPath = Effect.fn("Files.matchPersonResolveUvPath")(function* (): Effect.fn.Return<
  string,
  FilesCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const configured = yield* readOptionalConfig("BEEP_UV_PATH");
  const home = yield* readConfiguredHome();
  const platform = yield* HostProcessPlatform;
  const executableName = trustedUvExecutableNameForPlatform(platform);

  if (O.isSome(configured) && !path.isAbsolute(configured.value)) {
    return yield* FilesCommandError.make({ message: "BEEP_UV_PATH must be an absolute path to a trusted uv binary." });
  }

  const candidates = O.isSome(configured)
    ? [configured.value]
    : [
        ...A.map(trustedUvRootDirectoriesForPlatform(platform), (root) => path.join(root, executableName)),
        ...pipe(
          home,
          O.map((root) => [path.join(root, ".local", "bin", executableName)]),
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
      "Could not find a trusted uv binary in the platform's supported install locations. " +
      "Set BEEP_UV_PATH to an absolute path when uv is installed elsewhere.",
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
  const hostPlatform = yield* HostProcessPlatform;
  const hostArchitecture = yield* HostProcessArchitecture;
  yield* validatePersonMatchBackendPlatform(options.backend, hostPlatform, hostArchitecture);
  if (!options.acceptModelLicense) {
    const message = Match.value(options.backend).pipe(
      Match.when(
        "buffalo-l",
        () =>
          "InsightFace buffalo_l weights are limited to non-commercial research use. Review https://github.com/deepinsight/insightface/blob/master/server/LICENSING.md, then re-run with --accept-model-license."
      ),
      Match.when(
        "adaface-kprpe",
        () =>
          "AdaFace/CVLFace checkpoint use is subject to the model-card and training-dataset terms at its pinned source. Review those terms and the InsightFace detector terms, then re-run with --accept-model-license."
      ),
      Match.exhaustive
    );
    return yield* FilesCommandError.make({
      message,
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
  const cacheChildren = yield* canonicalizeMatchPersonCacheChildren(canonicalCacheRoot, options.backend);
  yield* validateMatchPersonPathIsolation(
    path,
    candidateDirectory,
    referenceDirectory,
    manifestPath,
    [
      canonicalCacheRoot,
      cacheChildren.modelRoot,
      cacheChildren.uvEnvironment,
      cacheChildren.uvCpuEnvironment,
      cacheChildren.uvCacheRoot,
    ],
    outputDirectory
  );

  return CanonicalMatchPersonInputs.make({
    cacheRoot: canonicalCacheRoot,
    candidateDirectory,
    manifestPath,
    modelRoot: cacheChildren.modelRoot,
    outputDirectory,
    referenceDirectory,
    uvCacheRoot: cacheChildren.uvCacheRoot,
    uvCpuEnvironment: cacheChildren.uvCpuEnvironment,
    uvEnvironment: cacheChildren.uvEnvironment,
    uvPath,
  });
});

const readBoundedPersonMatchDirectory = Effect.fn("Files.readBoundedPersonMatchDirectory")(function* (
  directory: string,
  budget: PersonMatchDiscoveryBudget
): Effect.fn.Return<ReadonlyArray<string>, FilesCommandError> {
  const admittedEntryCount = MutableRef.get(budget.entryCount);
  const remaining = Num.subtract(budget.limit, admittedEntryCount);
  const names = yield* Effect.try({
    try: (): ReadonlyArray<string> => {
      const discovered: Array<string> = [];
      const entries = new Bun.Glob("*").scanSync({
        cwd: directory,
        dot: true,
        followSymlinks: false,
        onlyFiles: false,
        throwErrorOnBrokenSymlink: false,
      });
      for (const name of entries) {
        discovered.push(name);
        if (A.length(discovered) > remaining) break;
      }
      return discovered;
    },
    catch: (cause) => formatPlatformError("Failed to discover person-match image inputs", directory, { cause }),
  });
  if (A.length(names) > remaining) {
    return yield* FilesCommandError.make({
      message: `${budget.label} directory entry count exceeds ${budget.limit}; split the scan into smaller batches.`,
    });
  }

  MutableRef.set(budget.entryCount, Num.sum(admittedEntryCount, A.length(names)));
  return names;
});

/**
 * Exercises bounded directory enumeration without invoking a person-match
 * worker.
 *
 * **Example** (Create a bounded enumeration effect)
 *
 * ```ts
 * import { boundedPersonMatchDirectoryNamesForTesting } from "@beep/repo-cli/test/Files"
 *
 * const names = boundedPersonMatchDirectoryNamesForTesting("/images", 256)
 * console.log(typeof names) // "object"
 * ```
 *
 * @internal
 * @param directory - Physical directory to enumerate.
 * @param limit - Maximum entries the test enumeration may retain.
 * @returns A bounded enumeration effect that fails on the first excess entry.
 * @category testing
 * @since 0.0.0
 */
export const boundedPersonMatchDirectoryNamesForTesting: {
  (directory: string, limit: number): Effect.Effect<ReadonlyArray<string>, FilesCommandError>;
  (limit: number): (directory: string) => Effect.Effect<ReadonlyArray<string>, FilesCommandError>;
} = dual(2, (directory: string, limit: number) =>
  readBoundedPersonMatchDirectory(directory, {
    count: MutableRef.make(0),
    entryCount: MutableRef.make(0),
    label: "candidate",
    limit,
  })
);

const discoverSupportedPersonMatchFiles: (
  root: string,
  directory: string,
  recursive: boolean,
  budget: PersonMatchDiscoveryBudget
) => Effect.Effect<ReadonlyArray<string>, FilesCommandError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "Files.discoverSupportedPersonMatchFiles"
)(function* (root, directory, recursive, budget) {
  const names = yield* readBoundedPersonMatchDirectory(directory, budget);
  const discovered = yield* Effect.forEach(
    A.sort(names, Str.Order),
    (name) => discoverSupportedPersonMatchEntry(root, directory, name, recursive, budget),
    { concurrency: 1 }
  );
  return A.sort(A.flatten(discovered), Str.Order);
});

const isContainedPersonMatchSourcePath = (
  path: Pick<MatchPersonPathOperations, "isAbsolute" | "relative" | "sep">,
  root: string,
  sourcePath: string
): boolean => {
  const relativePath = path.relative(root, sourcePath);
  return (
    !path.isAbsolute(relativePath) &&
    !Str.startsWith(`..${path.sep}`)(relativePath) &&
    !Str.Equivalence(relativePath, "..")
  );
};

const supportedPersonMatchSourcePath = (
  path: Path.Path,
  root: string,
  sourcePath: string,
  name: string
): O.Option<string> => {
  const extension = pipe(path.extname(name), Str.replace(/^\./u, ""), Str.toLowerCase);
  return pipe(
    sourcePath,
    O.liftPredicate(() => isPersonMatchSupportedImageExtension(extension)),
    O.filter(() => isContainedPersonMatchSourcePath(path, root, sourcePath))
  );
};

const admitSupportedPersonMatchPath = (
  supportedPath: O.Option<string>,
  budget: PersonMatchDiscoveryBudget
): Effect.Effect<ReadonlyArray<string>, FilesCommandError> =>
  O.match(supportedPath, {
    onNone: () => Effect.succeed(A.empty<string>()),
    onSome: (path) => {
      const count = Num.sum(MutableRef.get(budget.count), 1);
      if (count > budget.limit) {
        return FilesCommandError.make({
          message: `${budget.label} image count exceeds ${budget.limit}; split the scan into smaller batches.`,
        });
      }
      MutableRef.set(budget.count, count);
      return Effect.succeed([path]);
    },
  });

const discoverSupportedPersonMatchEntry: (
  root: string,
  directory: string,
  name: string,
  recursive: boolean,
  budget: PersonMatchDiscoveryBudget
) => Effect.Effect<ReadonlyArray<string>, FilesCommandError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "Files.discoverSupportedPersonMatchEntry"
)(function* (root, directory, name, recursive, budget) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourcePath = path.join(directory, name);
  const isSymbolicLink = yield* fs.readLink(sourcePath).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false)
  );
  if (isSymbolicLink) return A.empty<string>();

  const stat = yield* fs.stat(sourcePath).pipe(Effect.option);
  return yield* O.match(stat, {
    onNone: () => Effect.succeed(A.empty<string>()),
    onSome: (info) =>
      Match.value(info.type).pipe(
        Match.when("Directory", () =>
          Bool.match(recursive, {
            onFalse: () => Effect.succeed(A.empty<string>()),
            onTrue: () => discoverSupportedPersonMatchFiles(root, sourcePath, recursive, budget),
          })
        ),
        Match.when("File", () =>
          admitSupportedPersonMatchPath(supportedPersonMatchSourcePath(path, root, sourcePath, name), budget)
        ),
        Match.orElse(() => Effect.succeed(A.empty<string>()))
      ),
  });
});

const discoverExpectedPersonMatchFiles = Effect.fn("Files.discoverExpectedPersonMatchFiles")(function* (
  inputs: CanonicalMatchPersonInputs,
  recursive: boolean
): Effect.fn.Return<ExpectedPersonMatchFiles, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const candidateBudget: PersonMatchDiscoveryBudget = {
    count: MutableRef.make(0),
    entryCount: MutableRef.make(0),
    label: "candidate",
    limit: PERSON_MATCH_MAX_CANDIDATE_IMAGES,
  };
  const referenceBudget: PersonMatchDiscoveryBudget = {
    count: MutableRef.make(0),
    entryCount: MutableRef.make(0),
    label: "reference",
    limit: PERSON_MATCH_MAX_REFERENCE_IMAGES,
  };
  const [candidatePaths, referencePaths] = yield* Effect.all(
    [
      discoverSupportedPersonMatchFiles(
        inputs.candidateDirectory,
        inputs.candidateDirectory,
        recursive,
        candidateBudget
      ),
      discoverSupportedPersonMatchFiles(
        inputs.referenceDirectory,
        inputs.referenceDirectory,
        recursive,
        referenceBudget
      ),
    ],
    { concurrency: 2 }
  );
  return ExpectedPersonMatchFiles.make({ candidatePaths, referencePaths });
});

const validateDiscoveredReferenceImages = Effect.fn("Files.validateDiscoveredReferenceImages")(function* (
  expected: ExpectedPersonMatchFiles
): Effect.fn.Return<void, FilesCommandError> {
  return yield* A.match(expected.referencePaths, {
    onEmpty: () =>
      FilesCommandError.make({
        message: "Reference directory contains no supported jpg, jpeg, png, or webp images.",
      }),
    onNonEmpty: () => Effect.void,
  });
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

class ExpectedPersonMatchComponent extends S.Class<ExpectedPersonMatchComponent>($I`ExpectedPersonMatchComponent`)(
  {
    role: S.Literals(["detector", "aligner", "recognizer"]),
    name: S.NonEmptyString,
    revision: S.NonEmptyString,
    source: S.NonEmptyString,
    licenseNotice: S.NonEmptyString,
    artifactName: S.NonEmptyString,
    artifactPath: S.NonEmptyString,
    artifactSha256: S.NonEmptyString,
    artifactSizeBytes: S.Option(S.Finite),
  },
  $I.annote("ExpectedPersonMatchComponent", {
    description: "Exact component and artifact provenance expected from one person-match backend.",
  })
) {}

const insightFaceSource = "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip";
const insightFaceLicenseNotice =
  "InsightFace pretrained-model terms: https://github.com/deepinsight/insightface/blob/master/server/LICENSING.md";
const cvlFaceLicenseNotice =
  "CVLFace code is MIT-licensed; checkpoint use is also subject to the training-dataset and model-card terms at the pinned source.";
const adaFaceAlignerSource =
  "https://huggingface.co/minchul/cvlface_DFA_mobilenet/resolve/8317e6dda53d91e7074979923144c2cc08906a33/model.safetensors";
const adaFaceRecognizerSource =
  "https://huggingface.co/minchul/cvlface_adaface_vit_base_kprpe_webface12m/resolve/daefd5012d369588bd214fbaf4cc6b1d286e7066/model.safetensors";

const expectedDetector = (path: Path.Path, modelRoot: string): ExpectedPersonMatchComponent =>
  ExpectedPersonMatchComponent.make({
    role: "detector",
    name: "insightface-det_10g",
    revision: "v0.7",
    source: insightFaceSource,
    licenseNotice: insightFaceLicenseNotice,
    artifactName: "det_10g.onnx",
    artifactPath: path.join(modelRoot, "models", workerModelRuntimeName, "det_10g.onnx"),
    artifactSha256: workerModelArtifactSha256["det_10g.onnx"] ?? "",
    artifactSizeBytes: O.some(16_923_827),
  });

const expectedBuffaloRecognizer = (path: Path.Path, modelRoot: string): ExpectedPersonMatchComponent =>
  ExpectedPersonMatchComponent.make({
    role: "recognizer",
    name: "insightface-w600k_r50",
    revision: "v0.7",
    source: insightFaceSource,
    licenseNotice: insightFaceLicenseNotice,
    artifactName: "w600k_r50.onnx",
    artifactPath: path.join(modelRoot, "models", workerModelRuntimeName, "w600k_r50.onnx"),
    artifactSha256: workerModelArtifactSha256["w600k_r50.onnx"] ?? "",
    artifactSizeBytes: O.some(174_383_860),
  });

const expectedAdaFaceAligner = (path: Path.Path, modelRoot: string): ExpectedPersonMatchComponent =>
  ExpectedPersonMatchComponent.make({
    role: "aligner",
    name: "cvlface_DFA_mobilenet",
    revision: "8317e6dda53d91e7074979923144c2cc08906a33",
    source: adaFaceAlignerSource,
    licenseNotice: cvlFaceLicenseNotice,
    artifactName: "model.safetensors",
    artifactPath: path.join(modelRoot, "pinned", "aligner", "model.safetensors"),
    artifactSha256: "80b6e922e4c76c10d5e24061fe47cd96112d18689bf5ae7e34af52e641c18c4a",
    artifactSizeBytes: O.some(2_007_980),
  });

const expectedAdaFaceRecognizer = (path: Path.Path, modelRoot: string): ExpectedPersonMatchComponent =>
  ExpectedPersonMatchComponent.make({
    role: "recognizer",
    name: "cvlface_adaface_vit_base_kprpe_webface12m",
    revision: "daefd5012d369588bd214fbaf4cc6b1d286e7066",
    source: adaFaceRecognizerSource,
    licenseNotice: cvlFaceLicenseNotice,
    artifactName: "model.safetensors",
    artifactPath: path.join(modelRoot, "pinned", "recognizer", "model.safetensors"),
    artifactSha256: "99d16ed4aac0fdf0fcc82526b9b70703f3ec8c3041bf1bf44bd22751536e65db",
    artifactSizeBytes: O.some(460_344_344),
  });

const expectedWorkerComponents = (
  model: PersonMatchModel,
  modelRoot: string,
  path: Path.Path
): ReadonlyArray<ExpectedPersonMatchComponent> =>
  Match.value(model.backend).pipe(
    Match.when("buffalo-l", () => [expectedDetector(path, modelRoot), expectedBuffaloRecognizer(path, modelRoot)]),
    Match.when("adaface-kprpe", () => [
      expectedDetector(path, modelRoot),
      expectedAdaFaceAligner(path, modelRoot),
      expectedAdaFaceRecognizer(path, modelRoot),
    ]),
    Match.exhaustive
  );

const validateWorkerModelArtifact = Effect.fn("Files.validatePersonMatchWorkerModelArtifact")(function* (
  artifact: PersonMatchModelArtifact,
  expected: ExpectedPersonMatchComponent
): Effect.fn.Return<void, FilesCommandError, Path.Path> {
  const path = yield* Path.Path;
  if (
    !Str.Equivalence(artifact.name, expected.artifactName) ||
    !Str.Equivalence(path.resolve(artifact.path), expected.artifactPath) ||
    !Str.Equivalence(artifact.sha256, expected.artifactSha256) ||
    artifact.sizeBytes <= 0 ||
    O.exists(expected.artifactSizeBytes, (sizeBytes) => !Num.Equivalence(artifact.sizeBytes, sizeBytes))
  ) {
    return yield* FilesCommandError.make({
      message: `Person-match worker reported unexpected model artifact provenance for "${artifact.name}".`,
    });
  }
});

const validateWorkerModelComponent = Effect.fn("Files.validatePersonMatchWorkerModelComponent")(function* (
  component: PersonMatchModelComponent,
  expected: ExpectedPersonMatchComponent
): Effect.fn.Return<void, FilesCommandError, Path.Path> {
  if (
    component.role !== expected.role ||
    !Str.Equivalence(component.name, expected.name) ||
    !Str.Equivalence(component.revision, expected.revision) ||
    !Str.Equivalence(component.source, expected.source) ||
    !Str.Equivalence(component.licenseNotice, expected.licenseNotice) ||
    A.length(component.artifacts) !== 1
  ) {
    return yield* FilesCommandError.make({
      message: `Person-match worker reported unexpected ${expected.role} component provenance.`,
    });
  }
  const artifact = component.artifacts[0];
  if (artifact === undefined) {
    return yield* FilesCommandError.make({
      message: `Person-match worker omitted the pinned ${expected.role} artifact.`,
    });
  }
  yield* validateWorkerModelArtifact(artifact, expected);
});

const validateBuffaloWorkerRuntime = Effect.fn("Files.validateBuffaloPersonMatchWorkerRuntime")(function* (
  runtime: PersonMatchOnnxRuntime
): Effect.fn.Return<void, FilesCommandError> {
  if (runtime.framework !== "onnxruntime" || A.isReadonlyArrayNonEmpty(runtime.warnings)) {
    return yield* FilesCommandError.make({
      message: "Buffalo model runtime provenance is not the exact pinned CPU runtime.",
    });
  }
});

const isPinnedAdaFaceRocmRuntime = (runtime: PersonMatchPyTorchRuntime): boolean =>
  runtime.distribution === "rocm72" &&
  O.exists(runtime.hipVersion, Str.startsWith(adaFaceHipVersionPrefix)) &&
  A.length(runtime.devices) === 1 &&
  A.every(runtime.devices, (device) => Str.Equivalence(device.architecture, adaFaceRocmArchitecture));

const adaFaceRuntimeUsesRequestedDevices = (
  runtime: PersonMatchPyTorchRuntime,
  requestedDevices: MatchPersonOptions["devices"]
): boolean =>
  !O.exists(
    requestedDevices,
    (requested) =>
      !personMatchDeviceIndexesEquivalence(
        A.map(runtime.devices, (device) => device.index),
        requested
      )
  );

const validateAdaFaceRocmRuntime = Effect.fn("Files.validateAdaFaceRocmPersonMatchWorkerRuntime")(function* (
  runtime: PersonMatchPyTorchRuntime,
  requestedDevices: MatchPersonOptions["devices"]
): Effect.fn.Return<void, FilesCommandError> {
  if (!isPinnedAdaFaceRocmRuntime(runtime)) {
    return yield* FilesCommandError.make({
      message: "AdaFace ROCm runtime requires the pinned HIP 7.2 family and one selected gfx1201 device.",
    });
  }
  if (!adaFaceRuntimeUsesRequestedDevices(runtime, requestedDevices)) {
    return yield* FilesCommandError.make({
      message: "AdaFace runtime did not select the explicitly requested ROCm device.",
    });
  }
});

const validateAdaFaceRuntimeDevices = (
  runtime: PersonMatchPyTorchRuntime,
  requestedDevices: MatchPersonOptions["devices"]
): Effect.Effect<void, FilesCommandError> =>
  Match.value(runtime.actualCompute).pipe(
    Match.when("rocm", () => validateAdaFaceRocmRuntime(runtime, requestedDevices)),
    Match.when("cpu", () =>
      Bool.match(A.isReadonlyArrayNonEmpty(runtime.devices), {
        onFalse: () => Effect.void,
        onTrue: () => FilesCommandError.make({ message: "AdaFace CPU runtime reported a selected ROCm device." }),
      })
    ),
    Match.exhaustive
  );

const adaFaceRuntimeHonorsComputePolicy = (
  runtime: PersonMatchPyTorchRuntime,
  compute: MatchPersonOptions["compute"]
): boolean =>
  Match.value(compute).pipe(
    Match.when("auto", () => true),
    Match.when("rocm", () => runtime.actualCompute === "rocm"),
    Match.when("cpu", () => runtime.actualCompute === "cpu"),
    Match.exhaustive
  );

const validateAdaFaceComputePolicy = Effect.fn("Files.validateAdaFacePersonMatchComputePolicy")(function* (
  runtime: PersonMatchPyTorchRuntime,
  compute: MatchPersonOptions["compute"]
): Effect.fn.Return<void, FilesCommandError> {
  if (!adaFaceRuntimeHonorsComputePolicy(runtime, compute)) {
    return yield* FilesCommandError.make({ message: "AdaFace runtime did not honor the explicit compute policy." });
  }
});

const hasSingleRocmFallbackWarning = (runtime: PersonMatchPyTorchRuntime): boolean =>
  A.length(runtime.warnings) === 1 &&
  O.exists(A.head(runtime.warnings), (warning) => warning.code === "rocm-fallback-to-cpu");

const hasCoherentAdaFaceRuntimeWarnings = (
  runtime: PersonMatchPyTorchRuntime,
  compute: MatchPersonOptions["compute"]
): boolean =>
  Match.value(compute).pipe(
    Match.when("auto", () =>
      Bool.match(runtime.actualCompute === "cpu", {
        onFalse: () => A.isReadonlyArrayEmpty(runtime.warnings),
        onTrue: () => hasSingleRocmFallbackWarning(runtime),
      })
    ),
    Match.orElse(() => A.isReadonlyArrayEmpty(runtime.warnings))
  );

const validateAdaFaceRuntimeWarnings = Effect.fn("Files.validateAdaFacePersonMatchRuntimeWarnings")(function* (
  runtime: PersonMatchPyTorchRuntime,
  compute: MatchPersonOptions["compute"]
): Effect.fn.Return<void, FilesCommandError> {
  if (!hasCoherentAdaFaceRuntimeWarnings(runtime, compute)) {
    return yield* FilesCommandError.make({
      message: "AdaFace runtime reported incoherent compute fallback provenance.",
    });
  }
});

const validateAdaFaceWorkerRuntime = Effect.fn("Files.validateAdaFacePersonMatchWorkerRuntime")(function* (
  runtime: PersonMatchPyTorchRuntime,
  options: MatchPersonOptions
): Effect.fn.Return<void, FilesCommandError> {
  yield* validateAdaFaceRuntimeDevices(runtime, options.devices);
  yield* validateAdaFaceComputePolicy(runtime, options.compute);
  yield* validateAdaFaceRuntimeWarnings(runtime, options.compute);
});

const validateWorkerRuntime = Effect.fn("Files.validatePersonMatchWorkerRuntime")(function* (
  model: PersonMatchModel,
  options: MatchPersonOptions
): Effect.fn.Return<void, FilesCommandError> {
  yield* PersonMatchModel.match({
    "buffalo-l": (buffalo) => validateBuffaloWorkerRuntime(buffalo.runtime),
    "adaface-kprpe": (adaFace) => validateAdaFaceWorkerRuntime(adaFace.runtime, options),
  })(model);
});

const validateWorkerModel = Effect.fn("Files.validatePersonMatchWorkerModel")(function* (
  model: PersonMatchModel,
  modelRoot: string,
  options: MatchPersonOptions
): Effect.fn.Return<void, FilesCommandError, Path.Path> {
  const path = yield* Path.Path;
  if (!Str.Equivalence(path.resolve(model.root), modelRoot) || model.backend !== options.backend) {
    return yield* FilesCommandError.make({
      message: "Person-match worker reported a model root or backend outside the selected cache.",
    });
  }
  yield* validateWorkerRuntime(model, options);
  const expected = expectedWorkerComponents(model, modelRoot, path);
  if (A.length(model.components) !== A.length(expected)) {
    return yield* FilesCommandError.make({
      message: "Person-match worker did not report the exact pinned model component set.",
    });
  }
  yield* Effect.forEach(
    expected,
    (expectedComponent) =>
      O.match(
        A.findFirst(model.components, (component) => component.role === expectedComponent.role),
        {
          onNone: () =>
            FilesCommandError.make({
              message: `Person-match worker omitted the pinned ${expectedComponent.role} component.`,
            }),
          onSome: (component) => validateWorkerModelComponent(component, expectedComponent),
        }
      ),
    { concurrency: 1, discard: true }
  );
});

const validateWorkerReferencePath = Effect.fn("Files.validatePersonMatchWorkerReferencePath")(function* (
  reference: PersonMatchReference,
  referenceDirectory: string,
  referencePaths: MutableHashSet.MutableHashSet<string>
): Effect.fn.Return<void, FilesCommandError, Path.Path> {
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
});

const validateAcceptedWorkerReference = Effect.fn("Files.validateAcceptedPersonMatchWorkerReference")(function* (
  reference: PersonMatchReference
): Effect.fn.Return<boolean, FilesCommandError> {
  if (reference.faceCount !== 1 || reference.detectionScore === undefined || reference.reason !== undefined) {
    return yield* FilesCommandError.make({
      message: `Person-match worker returned inconsistent accepted reference evidence for "${reference.sourcePath}".`,
    });
  }
  return true;
});

const validateRejectedWorkerReference = Effect.fn("Files.validateRejectedPersonMatchWorkerReference")(function* (
  reference: PersonMatchReference
): Effect.fn.Return<boolean, FilesCommandError> {
  if (reference.reason === undefined) {
    return yield* FilesCommandError.make({
      message: `Person-match worker omitted the rejection reason for reference "${reference.sourcePath}".`,
    });
  }
  if (reference.reason === "aligner-confidence-failed" && reference.faceCount !== 0) {
    return yield* FilesCommandError.make({
      message: `Person-match worker returned incoherent aligner rejection evidence for reference "${reference.sourcePath}".`,
    });
  }
  return false;
});

const validateWorkerReference = Effect.fn("Files.validatePersonMatchWorkerReference")(function* (
  reference: PersonMatchReference,
  referenceDirectory: string,
  referencePaths: MutableHashSet.MutableHashSet<string>
): Effect.fn.Return<boolean, FilesCommandError, Path.Path> {
  yield* validateWorkerReferencePath(reference, referenceDirectory, referencePaths);
  return yield* Bool.match(reference.accepted, {
    onFalse: () => validateRejectedWorkerReference(reference),
    onTrue: () => validateAcceptedWorkerReference(reference),
  });
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
  return ValidatedWorkerReferences.make({
    acceptedCount: NonNegativeInt.make(acceptedCount),
    acceptedNames: A.fromIterable(acceptedNames),
  });
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
  acceptedReferenceNames: ReadonlyArray<string>
): Effect.fn.Return<number, FilesCommandError> {
  let maximumMatchScore = -1;
  for (const face of entry.faces) {
    if (!A.contains(acceptedReferenceNames, face.bestReferenceName)) {
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
  const hasPartialAlignerRejection = entry.reason === "aligner-confidence-failed";
  return Match.value(entry.disposition).pipe(
    Match.when("solo-match", () => entry.faceCount === 1 && couldMeetMatchThreshold && !hasQualityFlags),
    Match.when("low-quality-match", () => entry.faceCount === 1 && couldMeetMatchThreshold && hasQualityFlags),
    Match.when("group-match", () => entry.faceCount > 1 && couldMeetMatchThreshold),
    Match.when("review", () => hasPartialAlignerRejection || (!mustMeetMatchThreshold && couldMeetReviewThreshold)),
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
  const coherent = Match.value(entry.disposition).pipe(
    Match.when("unreadable", () => entry.reason === "image-decode-failed"),
    Match.when("no-face", () => entry.reason === undefined || entry.reason === "aligner-confidence-failed"),
    Match.when("review", () => entry.reason === undefined || entry.reason === "aligner-confidence-failed"),
    Match.orElse(() => entry.reason === undefined)
  );
  if (!coherent) {
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
  acceptedReferenceNames: ReadonlyArray<string>,
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
  acceptedReferenceNames: ReadonlyArray<string>,
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

const validateWorkerCompleteness = Effect.fn("Files.validatePersonMatchWorkerCompleteness")(function* (
  worker: PersonMatchWorkerSuccess,
  expected: ExpectedPersonMatchFiles
): Effect.fn.Return<void, FilesCommandError> {
  const reported = ExpectedPersonMatchFiles.make({
    candidatePaths: A.sort(
      A.map(worker.entries, (entry) => entry.sourcePath),
      Str.Order
    ),
    referencePaths: A.sort(
      A.map(worker.references, (reference) => reference.sourcePath),
      Str.Order
    ),
  });
  if (!expectedPersonMatchFilesEquivalence(expected, reported)) {
    return yield* FilesCommandError.make({
      message: "Person-match worker did not report every eligible candidate and reference image exactly once.",
    });
  }
});

const validateWorkerSemantics = Effect.fn("Files.validatePersonMatchWorkerSemantics")(function* (
  worker: PersonMatchWorkerSuccess,
  inputs: CanonicalMatchPersonInputs,
  expected: ExpectedPersonMatchFiles,
  options: MatchPersonOptions
): Effect.fn.Return<void, FilesCommandError, Path.Path> {
  yield* validateWorkerModel(worker.model, inputs.modelRoot, options);
  const references = yield* validateWorkerReferences(worker.references, inputs.referenceDirectory);
  const sourcePaths = MutableHashSet.empty<string>();
  const relativePaths = MutableHashSet.empty<string>();
  yield* Effect.forEach(
    worker.entries,
    (entry) => validateWorkerEntry(entry, inputs, references.acceptedNames, sourcePaths, relativePaths, options),
    { concurrency: 1, discard: true }
  );
  yield* validateWorkerSummary(worker, references.acceptedCount);
  yield* validateWorkerCompleteness(worker, expected);
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
  return O.some(PersonMatchCopyPlanEntry.make({ sourcePath, targetPath }));
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

      return PersonMatchCommitRecord.make({
        backupPath: path.join(temporaryDirectory, ".previous-output"),
        backedUp: false,
        committed: false,
        description: "person-match output",
        stagedPath,
        targetPath: entry.targetPath,
        temporaryDirectory,
      });
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
      return PersonMatchCommitRecord.make({
        backupPath: path.join(temporaryDirectory, ".previous-manifest"),
        backedUp: false,
        committed: false,
        description: "person-match manifest",
        stagedPath,
        targetPath: report.manifestPath,
        temporaryDirectory,
      });
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
  FileSystem.FileSystem | Path.Path | PersonMatchWorkerService
> {
  const inputs = yield* validateMatchPersonInputs(options);
  if (!options.json) {
    const modelName = Match.value(options.backend).pipe(
      Match.when("buffalo-l", () => "local buffalo_l"),
      Match.when("adaface-kprpe", () => "pinned AdaFace ViT-Base KP-RPE"),
      Match.exhaustive
    );
    yield* Console.log(
      `files match-person: loading ${modelName} models and scanning "${inputs.candidateDirectory}" against "${inputs.referenceDirectory}".`
    );
  }

  const expectedBefore = yield* discoverExpectedPersonMatchFiles(inputs, options.recursive);
  yield* validateDiscoveredReferenceImages(expectedBefore);
  const workerService = yield* PersonMatchWorkerService;
  const worker = yield* workerService.run(options, inputs).pipe(Effect.mapError(toFilesCommandError));
  const expectedAfter = yield* discoverExpectedPersonMatchFiles(inputs, options.recursive);
  if (!expectedPersonMatchFilesEquivalence(expectedBefore, expectedAfter)) {
    return yield* FilesCommandError.make({
      message:
        "Eligible candidate or reference images changed while person matching was running; no report was written.",
    });
  }
  yield* validateWorkerSemantics(worker, inputs, expectedBefore, options);
  if (worker.summary.acceptedReferenceCount === 0) {
    return yield* FilesCommandError.make({
      message: "Person-match worker did not accept any single-face reference images.",
    });
  }

  const copyPlan = O.isSome(inputs.outputDirectory)
    ? yield* buildCopyPlan(worker.entries, inputs.candidateDirectory, inputs.outputDirectory.value, options.overwrite)
    : A.empty<PersonMatchCopyPlanEntry>();

  const report = PersonMatchReport.make({
    schemaVersion: "beep.files.match-person.v2",
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
