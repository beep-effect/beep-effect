/**
 * Local InsightFace orchestration and non-destructive person-match materialization.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { fileURLToPath } from "node:url";
import { renderBiomeJson } from "@beep/repo-utils/schemas/BiomeJson";
import { A, Str } from "@beep/utils";
import { Config, Console, Effect, FileSystem, flow, Match, Path, pipe } from "effect";
import * as O from "effect/Option";
import { OutputBound, runCapturedStreams } from "../../../internal/process/StepExec.ts";
import { FilesCommandError, formatPlatformError } from "../Files.errors.ts";
import {
  decodePersonMatchWorkerReportJson,
  encodePersonMatchReport,
  PersonMatchReport,
} from "./MatchPerson.schemas.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type {
  MatchPersonOptions,
  PersonMatchDisposition,
  PersonMatchEntry,
  PersonMatchWorkerReport,
  PersonMatchWorkerSuccess,
} from "./MatchPerson.schemas.ts";

const workerProjectDirectory = fileURLToPath(new URL("../../../../python/photo-face/", import.meta.url));
const workerOutputBound = OutputBound.make({
  maxChars: 268_435_456,
  truncatedNotice: "\n[files match-person output truncated]",
});
const trustedUvRoots = ["/usr/bin", "/usr/local/bin"] as const;

interface CanonicalMatchPersonInputs {
  readonly cacheRoot: string;
  readonly candidateDirectory: string;
  readonly manifestPath: string;
  readonly modelRoot: string;
  readonly outputDirectory: O.Option<string>;
  readonly referenceDirectory: string;
  readonly uvEnvironment: string;
  readonly uvPath: string;
}

interface PersonMatchCopyPlanEntry {
  readonly sourcePath: string;
  readonly targetPath: string;
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

const canonicalizeTargetPath = Effect.fn("Files.matchPersonCanonicalizeTargetPath")(function* (
  targetPath: string,
  description: string
): Effect.fn.Return<string, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolvedTarget = path.resolve(targetPath);
  let candidate = resolvedTarget;

  while (true) {
    const exists = yield* fs
      .exists(candidate)
      .pipe(Effect.mapError((cause) => formatPlatformError(`Failed to inspect ${description}`, candidate, { cause })));
    if (exists) {
      const canonicalCandidate = yield* fs
        .realPath(candidate)
        .pipe(
          Effect.mapError((cause) => formatPlatformError(`Failed to resolve ${description}`, candidate, { cause }))
        );
      const relativeSuffix = path.relative(candidate, resolvedTarget);
      return relativeSuffix === "" ? canonicalCandidate : path.resolve(canonicalCandidate, relativeSuffix);
    }

    const parent = path.dirname(candidate);
    if (parent === candidate) {
      return yield* FilesCommandError.make({
        message: `Failed to find an existing ancestor for ${description} "${resolvedTarget}".`,
      });
    }
    candidate = parent;
  }
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

  return yield* canonicalizeTargetPath(selected.value, "person-match cache directory");
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
        "InsightFace buffalo_l weights are limited to non-commercial research use. Re-run with --accept-model-license after reviewing those terms.",
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
  const manifestPath = yield* canonicalizeTargetPath(options.manifest, "person-match manifest path");
  if (manifestPath !== path.resolve(options.manifest)) {
    return yield* FilesCommandError.make({
      message: `Refusing a symlinked or aliased person-match manifest path: "${options.manifest}"`,
    });
  }
  const outputDirectory = yield* O.match(options.outDir, {
    onNone: () => Effect.succeed(O.none<string>()),
    onSome: (directory) => canonicalizeTargetPath(directory, "person-match output directory").pipe(Effect.map(O.some)),
  });
  const cacheRoot = yield* resolveCacheRoot(options.cacheDir);
  const uvPath = yield* resolveTrustedUvPath();

  if (pathsOverlap(path, candidateDirectory, referenceDirectory)) {
    return yield* FilesCommandError.make({
      message: "Person-match candidate and reference directories must not overlap.",
    });
  }
  if (pathsOverlap(path, candidateDirectory, manifestPath) || pathsOverlap(path, referenceDirectory, manifestPath)) {
    return yield* FilesCommandError.make({
      message: "The person-match manifest must be outside the candidate and reference directories.",
    });
  }
  if (pathsOverlap(path, candidateDirectory, cacheRoot) || pathsOverlap(path, referenceDirectory, cacheRoot)) {
    return yield* FilesCommandError.make({
      message: "The person-match cache must be outside the candidate and reference directories.",
    });
  }
  if (
    O.exists(
      outputDirectory,
      (directory) =>
        pathsOverlap(path, candidateDirectory, directory) || pathsOverlap(path, referenceDirectory, directory)
    )
  ) {
    return yield* FilesCommandError.make({
      message: "The person-match output directory must be outside the candidate and reference directories.",
    });
  }

  yield* preflightManifest(manifestPath, options.overwrite);
  yield* fs
    .makeDirectory(cacheRoot, { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create person-match cache directory", cacheRoot, { cause })
      )
    );
  const canonicalCacheRoot = yield* canonicalizeExistingDirectory(cacheRoot, "person-match cache directory");

  return {
    cacheRoot: canonicalCacheRoot,
    candidateDirectory,
    manifestPath,
    modelRoot: path.join(canonicalCacheRoot, "insightface"),
    outputDirectory,
    referenceDirectory,
    uvEnvironment: path.join(canonicalCacheRoot, "venv-cpu-py312-v1"),
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
      UV_CACHE_DIR: `${inputs.cacheRoot}/uv-cache`,
      UV_NO_PROGRESS: "1",
      UV_PROJECT_ENVIRONMENT: inputs.uvEnvironment,
    },
    bound: workerOutputBound,
    trim: true,
  }).pipe(FilesCommandError.mapError("Failed to start the local person-match worker"));

  if (result.truncated) {
    return yield* FilesCommandError.make({
      message: "Person-match worker output exceeded the 256 MiB safety bound; split the scan into smaller batches.",
    });
  }

  const decoded = yield* decodePersonMatchWorkerReportJson(result.stdout).pipe(Effect.option);
  if (O.isNone(decoded)) {
    const diagnostic = Str.trim(result.stderr);
    return yield* FilesCommandError.make({
      message: Str.isNonEmpty(diagnostic)
        ? `Person-match worker returned invalid JSON: ${diagnostic}`
        : "Person-match worker returned invalid or empty JSON.",
    });
  }
  if (result.exitCode !== 0 || !decoded.value.ok) {
    return yield* FilesCommandError.make({
      message: workerFailureMessage(decoded.value, result.stderr, result.exitCode),
    });
  }
  return decoded.value;
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

const buildCopyPlan = Effect.fn("Files.buildPersonMatchCopyPlan")(function* (
  entries: ReadonlyArray<PersonMatchEntry>,
  candidateDirectory: string,
  outputDirectory: string,
  overwrite: boolean
): Effect.fn.Return<ReadonlyArray<PersonMatchCopyPlanEntry>, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let plan = A.empty<PersonMatchCopyPlanEntry>();

  for (const entry of entries) {
    const category = materializationCategory(entry.disposition);
    if (O.isNone(category)) continue;

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
    const targetPath = yield* canonicalizeTargetPath(requestedTargetPath, "person-match output");
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

    const sourceStat = yield* fs
      .stat(sourcePath)
      .pipe(
        Effect.mapError((cause) => formatPlatformError("Failed to stat person-match source", sourcePath, { cause }))
      );
    if (sourceStat.type !== "File") {
      return yield* FilesCommandError.make({ message: `Person-match source is not a regular file: "${sourcePath}"` });
    }

    const targetExists = yield* fs
      .exists(targetPath)
      .pipe(
        Effect.mapError((cause) => formatPlatformError("Failed to inspect person-match output", targetPath, { cause }))
      );
    if (targetExists) {
      const targetStat = yield* fs
        .stat(targetPath)
        .pipe(
          Effect.mapError((cause) => formatPlatformError("Failed to stat person-match output", targetPath, { cause }))
        );
      if (targetStat.type !== "File") {
        return yield* FilesCommandError.make({
          message: `Refusing to overwrite non-file person-match output: "${targetPath}"`,
        });
      }
      if (!overwrite) {
        return yield* FilesCommandError.make({
          message: `Refusing to overwrite existing person-match output: "${targetPath}"`,
        });
      }
    }

    plan = A.append(plan, { sourcePath, targetPath });
  }

  return plan;
});

const applyCopyPlan = Effect.fn("Files.applyPersonMatchCopyPlan")(function* (
  plan: ReadonlyArray<PersonMatchCopyPlanEntry>
): Effect.fn.Return<void, FilesCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  for (const entry of plan) {
    const parent = path.dirname(entry.targetPath);
    yield* fs
      .makeDirectory(parent, { recursive: true })
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to create person-match output directory", parent, { cause })
        )
      );
    yield* fs
      .copyFile(entry.sourcePath, entry.targetPath)
      .pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to copy person-match output", entry.targetPath, { cause })
        )
      );
  }
});

const writeManifest = Effect.fn("Files.writePersonMatchManifest")(function* (
  report: PersonMatchReport,
  overwrite: boolean
): Effect.fn.Return<
  string,
  FilesCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const encoded = yield* encodePersonMatchReport(report).pipe(
    Effect.mapError((cause) => FilesCommandError.new(cause, "Failed to encode person-match report"))
  );
  const rendered = yield* renderBiomeJson(report.manifestPath, encoded).pipe(
    Effect.mapError((cause) => FilesCommandError.new(cause, "Failed to render person-match report JSON"))
  );
  const parent = path.dirname(report.manifestPath);
  yield* fs
    .makeDirectory(parent, { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        formatPlatformError("Failed to create person-match manifest directory", parent, { cause })
      )
    );

  yield* Effect.acquireUseRelease(
    fs
      .makeTempDirectory({ directory: parent, prefix: ".beep-files-person-match-" })
      .pipe(
        Effect.mapError((cause) => formatPlatformError("Failed to stage person-match manifest", parent, { cause }))
      ),
    Effect.fnUntraced(function* (temporaryDirectory) {
      const temporaryPath = path.join(temporaryDirectory, path.basename(report.manifestPath));
      yield* fs
        .writeFileString(temporaryPath, rendered)
        .pipe(
          Effect.mapError((cause) =>
            formatPlatformError("Failed to write staged person-match manifest", temporaryPath, { cause })
          )
        );
      const targetExists = yield* fs
        .exists(report.manifestPath)
        .pipe(
          Effect.mapError((cause) =>
            formatPlatformError("Failed to recheck person-match manifest", report.manifestPath, { cause })
          )
        );
      if (targetExists) {
        const targetStat = yield* fs
          .stat(report.manifestPath)
          .pipe(
            Effect.mapError((cause) =>
              formatPlatformError("Failed to restat person-match manifest", report.manifestPath, { cause })
            )
          );
        if (targetStat.type !== "File") {
          return yield* FilesCommandError.make({
            message: `Refusing to replace a non-file person-match manifest: "${report.manifestPath}"`,
          });
        }
        if (!overwrite) {
          return yield* FilesCommandError.make({
            message: `Refusing to replace a person-match manifest created during the scan: "${report.manifestPath}"`,
          });
        }
      }

      const commit = overwrite
        ? fs.rename(temporaryPath, report.manifestPath)
        : fs.link(temporaryPath, report.manifestPath);
      yield* commit.pipe(
        Effect.mapError((cause) =>
          formatPlatformError("Failed to atomically commit person-match manifest", report.manifestPath, { cause })
        )
      );
    }),
    (temporaryDirectory) => fs.remove(temporaryDirectory, { force: true, recursive: true }).pipe(Effect.ignore)
  );
  return rendered;
});

/**
 * Run the local target-person matcher and write its privacy-preserving report.
 *
 * **Details**
 *
 * The Python environment, verified InsightFace models, and dependency cache
 * live outside the repository. Candidate photos remain immutable; optional
 * materialization copies only accepted and review-lane images, and raw face
 * embeddings never cross the worker boundary.
 *
 * **Example** (Reference the operation)
 *
 * ```ts
 * const operation = runMatchPerson
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
  if (worker.summary.acceptedReferenceCount === 0) {
    return yield* FilesCommandError.make({
      message: "Person-match worker did not accept any single-face reference images.",
    });
  }

  if (O.isSome(inputs.outputDirectory)) {
    const copyPlan = yield* buildCopyPlan(
      worker.entries,
      inputs.candidateDirectory,
      inputs.outputDirectory.value,
      options.overwrite
    );
    yield* applyCopyPlan(copyPlan);
  }

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
  const rendered = yield* writeManifest(report, options.overwrite);

  if (options.json) {
    yield* Console.log(Str.trimEnd(rendered));
  } else {
    yield* Console.log(
      `files match-person: ${report.summary.soloMatchCount} solo match(es), ${report.summary.groupMatchCount} group review(s), ${report.summary.lowQualityMatchCount} quality review(s), ${report.summary.reviewCount} identity review(s), ${report.summary.noMatchCount} no-match, ${report.summary.noFaceCount} no-face.`
    );
    yield* Console.log(`files match-person: wrote "${report.manifestPath}".`);
  }

  return report;
});
