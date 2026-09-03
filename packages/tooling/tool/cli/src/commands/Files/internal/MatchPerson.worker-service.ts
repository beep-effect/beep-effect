/**
 * Effect service boundary for the isolated person-match Python worker.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { fileURLToPath } from "node:url";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Config, Console, Context, Effect, FileSystem, flow, Layer, Match, Number as Num, Path } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { OutputBound, runCapturedStreams } from "../../../internal/process/StepExec.ts";
import { MatchPersonError } from "./MatchPerson.errors.ts";
import { prepareAdaFaceArtifacts, verifyPersonMatchModelArtifacts } from "./MatchPerson.model-store.ts";
import { decodePersonMatchWorkerReportJson, PERSON_MATCH_MAX_REPORTED_FACES } from "./MatchPerson.schemas.ts";
import type * as Crypto from "effect/Crypto";
import type { HttpClient } from "effect/unstable/http";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type {
  MatchPersonConfigError,
  MatchPersonLicenseError,
  MatchPersonModelAcquisitionError,
  MatchPersonModelIntegrityError,
  MatchPersonPathError,
  MatchPersonRuntimeError,
  MatchPersonSemanticError,
  PersonMatchWorkerServiceError,
} from "./MatchPerson.errors.ts";
import type { PreparedAdaFaceArtifacts } from "./MatchPerson.model-store.ts";
import type {
  MatchPersonOptions,
  PersonMatchModel,
  PersonMatchWorkerErrorCode,
  PersonMatchWorkerReport,
  PersonMatchWorkerSuccess,
} from "./MatchPerson.schemas.ts";

const $I = $RepoCliId.create("commands/Files/internal/MatchPerson.worker-service");

const workerProjectDirectory = fileURLToPath(new URL("../../../../python/photo-face/", import.meta.url));
const workerReportOutputBound = OutputBound.make({
  maxChars: 67_108_864,
  truncatedNotice: "\n[files match-person JSON truncated]",
});
const workerDiagnosticOutputBound = OutputBound.make({
  maxChars: 1_048_576,
  truncatedNotice: "\n[files match-person diagnostics truncated]",
});
const workerSetupOutputBound = OutputBound.make({
  maxChars: 16_384,
  truncatedNotice: "\n[files match-person setup output truncated]",
});
const adaFaceCpuRuntimePackageVersion = "2.9.1+cpu";
const adaFaceRocmRuntimePackageVersion = "2.9.1+rocm7.2.0.git7e1940d4";
const adaFaceHipVersionPrefix = "7.2";
const adaFaceRocmArchitecture = "gfx1201";
const rocmLibraryPathConfigName = "BEEP_PHOTO_FACE_ROCM_LIBRARY_PATH";
const localRocmLibraryDirectorySegments = ["rocm-libs", "hipsparselt-7.2.4-1.1", "opt", "rocm", "lib"] as const;
const hipSparseLtSoname = "libhipsparselt.so.0";
const hipSparseLtVersionedName = "libhipsparselt.so.0.2";
const deviceIndexesEquivalence = S.toEquivalence(S.Array(NonNegativeInt));
const isNonNegativeInt = S.is(NonNegativeInt);
const PersonMatchWorkerEnvironment = LiteralKit(["primary", "cpu"]);
type PersonMatchWorkerEnvironment = typeof PersonMatchWorkerEnvironment.Type;

class MatchPersonWorkerEnvironmentSetupError extends S.TaggedError<MatchPersonWorkerEnvironmentSetupError>(
  $I`MatchPersonWorkerEnvironmentSetupError`
)(
  "MatchPersonWorkerEnvironmentSetupError",
  {
    environment: PersonMatchWorkerEnvironment,
    exitCode: NonNegativeInt,
    message: S.NonEmptyString,
  },
  $I.annoteError<MatchPersonWorkerEnvironmentSetupError>("MatchPersonWorkerEnvironmentSetupError", {
    description: "A completed uv sync that could not materialize one isolated person-match worker environment.",
  })
) {}

class MaterializedPersonMatchWorkerEnvironment extends S.Class<MaterializedPersonMatchWorkerEnvironment>(
  $I`MaterializedPersonMatchWorkerEnvironment`
)(
  {
    environment: PersonMatchWorkerEnvironment,
    workerLibraryPath: S.Option(S.NonEmptyString),
  },
  $I.annote("MaterializedPersonMatchWorkerEnvironment", {
    description: "One synchronized worker environment and its resolved runtime library path.",
  })
) {}

/**
 * Canonical paths and isolated caches supplied to one worker execution.
 *
 * **Example** (Describe canonical worker inputs)
 *
 * ```ts
 * import { CanonicalMatchPersonInputs } from "./MatchPerson.worker-service.ts"
 * import * as O from "effect/Option"
 *
 * const inputs = CanonicalMatchPersonInputs.make({
 *   cacheRoot: "/cache/photo-face",
 *   candidateDirectory: "/photos/mixed",
 *   manifestPath: "/reports/matches.json",
 *   modelRoot: "/cache/photo-face/adaface-kprpe",
 *   outputDirectory: O.none(),
 *   referenceDirectory: "/photos/references",
 *   uvCacheRoot: "/cache/photo-face/uv-cache",
 *   uvCpuEnvironment: "/cache/photo-face/venv-adaface-cpu-py312-v1",
 *   uvEnvironment: "/cache/photo-face/venv-adaface-rocm72-py312-v1",
 *   uvPath: "/usr/bin/uv"
 * })
 * console.log(inputs.modelRoot)
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CanonicalMatchPersonInputs extends S.Class<CanonicalMatchPersonInputs>($I`CanonicalMatchPersonInputs`)(
  {
    cacheRoot: S.NonEmptyString,
    candidateDirectory: S.NonEmptyString,
    manifestPath: S.NonEmptyString,
    modelRoot: S.NonEmptyString,
    outputDirectory: S.Option(S.NonEmptyString),
    referenceDirectory: S.NonEmptyString,
    uvCacheRoot: S.NonEmptyString,
    uvCpuEnvironment: S.NonEmptyString,
    uvEnvironment: S.NonEmptyString,
    uvPath: S.NonEmptyString,
  },
  $I.annote("CanonicalMatchPersonInputs", {
    description: "Canonical source, report, model, uv cache, environment, and executable paths for one worker run.",
  })
) {}

/**
 * Effect behavior exposed by the private person-match worker boundary.
 *
 * The service captures platform dependencies in its layer so callers observe
 * only schema-decoded success or the closed worker error channel.
 *
 * @internal
 * @category services
 * @since 0.0.0
 */
export interface PersonMatchWorkerServiceShape {
  readonly run: (
    options: MatchPersonOptions,
    inputs: CanonicalMatchPersonInputs
  ) => Effect.Effect<PersonMatchWorkerSuccess, PersonMatchWorkerServiceError>;
}

/**
 * Isolated worker service used by the Files command orchestration.
 *
 * **Example** (Access the worker service)
 *
 * ```ts
 * import { PersonMatchWorkerService } from "./MatchPerson.worker-service.ts"
 *
 * const access = PersonMatchWorkerService.use((service) => service.run)
 * console.log(access.pipe !== undefined)
 * ```
 *
 * @internal
 * @category services
 * @since 0.0.0
 */
export class PersonMatchWorkerService extends Context.Service<
  PersonMatchWorkerService,
  PersonMatchWorkerServiceShape
>()($I`PersonMatchWorkerService`) {}

/**
 * Physical model-artifact verification used after a worker execution.
 *
 * The default always re-hashes the exact pinned artifacts. Package tests may
 * replace only this reference when a process stub cannot materialize the real
 * multi-hundred-megabyte model files.
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export type PersonMatchModelArtifactVerifier = (
  model: PersonMatchModel,
  modelRoot: string
) => Effect.Effect<void, MatchPersonModelIntegrityError, FileSystem.FileSystem | Path.Path>;

/**
 * Fail-closed model-artifact verifier reference.
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const PersonMatchModelArtifactVerifier: Context.Reference<PersonMatchModelArtifactVerifier> = Context.Reference(
  $I`PersonMatchModelArtifactVerifier`,
  { defaultValue: () => verifyPersonMatchModelArtifacts }
);

type WorkerServiceRequirements =
  | FileSystem.FileSystem
  | Path.Path
  | Crypto.Crypto
  | HttpClient.HttpClient
  | ChildProcessSpawner.ChildProcessSpawner;

const {
  config: configError,
  license: licenseError,
  modelAcquisition: acquisitionError,
  modelIntegrity: integrityError,
  path: pathError,
  process: processError,
  protocol: protocolError,
  runtime: runtimeError,
  runtimeFromWorker,
  semantic: semanticError,
} = MatchPersonError;

const readOptionalConfig = (name: string): Effect.Effect<O.Option<string>, MatchPersonConfigError> =>
  Config.option(Config.string(name)).pipe(
    Effect.map(flow(O.map(Str.trim), O.filter(Str.isNonEmpty))),
    Effect.mapError((cause) => configError(`Failed to read optional person-match configuration ${name}.`, cause))
  );

const canonicalizeRocmLibraryDirectory = Effect.fn("Files.PersonMatchWorker.canonicalizeRocmLibraryDirectory")(
  function* (
    directory: string,
    requireExactPath: boolean
  ): Effect.fn.Return<string, MatchPersonPathError, FileSystem.FileSystem | Path.Path> {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const requested = path.resolve(directory);
    const canonical = yield* fs
      .realPath(requested)
      .pipe(
        Effect.mapError((cause) =>
          pathError(`Failed to resolve ${rocmLibraryPathConfigName} directory "${requested}".`, cause)
        )
      );
    const stat = yield* fs
      .stat(canonical)
      .pipe(
        Effect.mapError((cause) =>
          pathError(`Failed to stat ${rocmLibraryPathConfigName} directory "${canonical}".`, cause)
        )
      );
    if (stat.type !== "Directory") {
      return yield* pathError(`${rocmLibraryPathConfigName} must resolve to a directory: "${canonical}".`);
    }
    if (requireExactPath && !Str.Equivalence(requested, canonical)) {
      return yield* pathError(`Refusing an aliased local ROCm library directory: "${requested}".`);
    }

    const versionedPath = path.join(canonical, hipSparseLtVersionedName);
    const canonicalVersionedPath = yield* fs
      .realPath(versionedPath)
      .pipe(
        Effect.mapError((cause) => pathError(`Failed to resolve the required ROCm library "${versionedPath}".`, cause))
      );
    const versionedStat = yield* fs
      .stat(canonicalVersionedPath)
      .pipe(
        Effect.mapError((cause) =>
          pathError(`Failed to stat the required ROCm library "${canonicalVersionedPath}".`, cause)
        )
      );
    if (versionedStat.type !== "File" || !Str.Equivalence(canonicalVersionedPath, versionedPath)) {
      return yield* pathError(`Required ROCm library is not a canonical regular file: "${versionedPath}".`);
    }

    const sonamePath = path.join(canonical, hipSparseLtSoname);
    const sonameTarget = yield* fs
      .realPath(sonamePath)
      .pipe(
        Effect.mapError((cause) => pathError(`Failed to resolve the required ROCm soname "${sonamePath}".`, cause))
      );
    if (!Str.Equivalence(sonameTarget, canonicalVersionedPath)) {
      return yield* pathError(`Required ROCm soname "${sonamePath}" must resolve to "${canonicalVersionedPath}".`);
    }
    return canonical;
  }
);

const resolveWorkerLibraryPath = Effect.fn("Files.PersonMatchWorker.resolveLibraryPath")(function* (
  options: MatchPersonOptions,
  inputs: CanonicalMatchPersonInputs,
  environment: PersonMatchWorkerEnvironment
): Effect.fn.Return<
  O.Option<string>,
  MatchPersonConfigError | MatchPersonPathError,
  FileSystem.FileSystem | Path.Path
> {
  if (options.backend === "buffalo-l" || environment === "cpu") return O.none();
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const configured = yield* readOptionalConfig(rocmLibraryPathConfigName);
  const localDirectory = path.join(inputs.cacheRoot, ...localRocmLibraryDirectorySegments);
  const selectedDirectory = yield* O.match(configured, {
    onNone: () =>
      fs.exists(localDirectory).pipe(
        Effect.mapError((cause) =>
          pathError(`Failed to inspect local ROCm library directory "${localDirectory}".`, cause)
        ),
        Effect.flatMap((exists) =>
          exists
            ? canonicalizeRocmLibraryDirectory(localDirectory, true).pipe(Effect.map(O.some))
            : Effect.succeed(O.none<string>())
        )
      ),
    onSome: (directory) => canonicalizeRocmLibraryDirectory(directory, false).pipe(Effect.map(O.some)),
  });
  if (O.isNone(selectedDirectory)) return O.none();
  const inherited = yield* readOptionalConfig("LD_LIBRARY_PATH");
  return O.some(
    O.match(inherited, {
      onNone: () => selectedDirectory.value,
      onSome: (value) => A.join([selectedDirectory.value, value], ":"),
    })
  );
});

const validateRuntimeRequest = Effect.fn("Files.PersonMatchWorker.validateRuntimeRequest")(function* (
  options: MatchPersonOptions
): Effect.fn.Return<void, MatchPersonLicenseError | MatchPersonRuntimeError> {
  if (!options.acceptModelLicense) {
    return yield* licenseError("Review and accept the selected face-model and training-data terms before running.");
  }
  if (options.backend === "buffalo-l" && options.compute === "rocm") {
    return yield* runtimeError("The Buffalo backend is CPU-only; choose --compute auto or --compute cpu.");
  }
  if (options.backend === "buffalo-l" && O.isSome(options.devices)) {
    return yield* runtimeError("Explicit GPU devices are supported only by the AdaFace ROCm backend.");
  }
  if (options.compute === "cpu" && O.isSome(options.devices)) {
    return yield* runtimeError("Explicit GPU devices cannot be combined with --compute cpu.");
  }
  if (O.exists(options.devices, (devices) => A.length(devices) !== 1)) {
    return yield* runtimeError("Explicit ROCm selection accepts exactly one device index per run.");
  }
});

const prepareBackendArtifacts = Effect.fn("Files.PersonMatchWorker.prepareBackendArtifacts")(function* (
  options: MatchPersonOptions,
  inputs: CanonicalMatchPersonInputs
): Effect.fn.Return<
  O.Option<PreparedAdaFaceArtifacts>,
  MatchPersonModelAcquisitionError | MatchPersonModelIntegrityError,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | HttpClient.HttpClient
> {
  return yield* Match.value(options.backend).pipe(
    Match.when("buffalo-l", () => Effect.succeed(O.none<PreparedAdaFaceArtifacts>())),
    Match.when("adaface-kprpe", () => prepareAdaFaceArtifacts(inputs.modelRoot).pipe(Effect.map(O.some))),
    Match.exhaustive
  );
});

const deviceArguments = (options: MatchPersonOptions): ReadonlyArray<string> =>
  O.match(options.devices, {
    onNone: A.empty<string>,
    onSome: (devices) => [
      "--devices",
      A.join(
        A.map(devices, (device) => `${device}`),
        ","
      ),
    ],
  });

const backendWorkerArguments = (
  options: MatchPersonOptions,
  artifacts: O.Option<PreparedAdaFaceArtifacts>
): ReadonlyArray<string> =>
  Match.value(options.backend).pipe(
    Match.when("buffalo-l", A.empty<string>),
    Match.when("adaface-kprpe", () =>
      O.match(artifacts, {
        onNone: A.empty<string>,
        onSome: (prepared) => ["--aligner-path", prepared.alignerPath, "--recognizer-path", prepared.recognizerPath],
      })
    ),
    Match.exhaustive
  );

const workerSyncArguments = (
  options: MatchPersonOptions,
  environment: PersonMatchWorkerEnvironment
): ReadonlyArray<string> => [
  "sync",
  "--project",
  workerProjectDirectory,
  "--frozen",
  "--python",
  "3.12",
  "--no-python-downloads",
  "--no-dev",
  ...Match.value(options.backend).pipe(
    Match.when("buffalo-l", A.empty<string>),
    Match.when("adaface-kprpe", () => ["--extra", environment === "cpu" ? "adaface-cpu" : "adaface"]),
    Match.exhaustive
  ),
];

const workerArguments = (
  options: MatchPersonOptions,
  inputs: CanonicalMatchPersonInputs,
  artifacts: O.Option<PreparedAdaFaceArtifacts>
): ReadonlyArray<string> => [
  "run",
  "--project",
  workerProjectDirectory,
  "--no-sync",
  "--frozen",
  "--python",
  "3.12",
  "--no-python-downloads",
  "--no-dev",
  "-m",
  "beep_photo_face",
  "--backend",
  options.backend,
  "--compute",
  options.compute,
  ...deviceArguments(options),
  "--batch-size",
  `${options.batchSize}`,
  "--threshold-source",
  options.thresholdSource,
  ...backendWorkerArguments(options, artifacts),
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

const workerFailureError = (report: PersonMatchWorkerReport): PersonMatchWorkerServiceError => {
  if (report.ok) {
    return protocolError("Person-match worker reported success on a failed process exit.");
  }
  const message = `Person-match worker failed [${report.error.code}]: ${report.error.message}`;
  const workerRuntimeError = () => runtimeFromWorker(report.error.code, message);
  return Match.value(report.error.code).pipe(
    Match.when("model-acquisition-incomplete", () => acquisitionError(message)),
    Match.when("model-acquisition-failed", () => acquisitionError(message)),
    Match.when("model-integrity-failed", () => integrityError(message)),
    Match.when("model-module-missing", () => integrityError(message)),
    Match.when("model-state-mismatch", () => integrityError(message)),
    Match.when("unexpected-model-artifact", () => integrityError(message)),
    Match.when("unexpected-execution-provider", workerRuntimeError),
    Match.when("unsupported-platform", workerRuntimeError),
    Match.when("pytorch-runtime-load-failed", workerRuntimeError),
    Match.when("runtime-dependency-missing", workerRuntimeError),
    Match.when("rocm-unavailable", workerRuntimeError),
    Match.when("device-probe-failed", workerRuntimeError),
    Match.orElse(() => protocolError(message))
  );
};

const validateWorkerExitReport = Effect.fn("Files.PersonMatchWorker.validateExitReport")(function* (
  report: PersonMatchWorkerReport,
  diagnostic: string,
  exitCode: number
): Effect.fn.Return<PersonMatchWorkerSuccess, PersonMatchWorkerServiceError> {
  if (report.ok) {
    if (exitCode !== 0) {
      return yield* processError(
        Str.isNonEmpty(diagnostic)
          ? `Person-match worker exited with code ${exitCode}: ${diagnostic}`
          : `Person-match worker exited with code ${exitCode}.`
      );
    }
    return report;
  }
  const expectedExitCodes = report.error.code === "worker-failed" ? [1, 2] : [2];
  if (!A.contains(expectedExitCodes, exitCode)) {
    return yield* protocolError(
      `Person-match worker failure [${report.error.code}] used exit code ${exitCode}; expected ${A.join(
        A.map(expectedExitCodes, (code) => `${code}`),
        " or "
      )}.`
    );
  }
  return yield* workerFailureError(report);
});

const decodeWorkerExecution = Effect.fn("Files.PersonMatchWorker.decodeExecution")(function* (
  stdout: string,
  stderr: string,
  exitCode: number,
  truncated: boolean
): Effect.fn.Return<PersonMatchWorkerSuccess, PersonMatchWorkerServiceError> {
  if (truncated) {
    return yield* protocolError(
      "Person-match worker JSON or diagnostics exceeded its safety bound; split the scan into smaller batches."
    );
  }
  const diagnostic = Str.trim(stderr);
  const report = yield* decodePersonMatchWorkerReportJson(stdout, { onExcessProperty: "error" }).pipe(
    Effect.mapError((cause) =>
      protocolError(
        Str.isNonEmpty(diagnostic)
          ? `Person-match worker returned invalid JSON: ${diagnostic}`
          : "Person-match worker returned invalid or empty JSON.",
        cause
      )
    )
  );
  return yield* validateWorkerExitReport(report, diagnostic, exitCode);
});

const requestedParametersMatch = (worker: PersonMatchWorkerSuccess, options: MatchPersonOptions): boolean => {
  const parameters = worker.parameters;
  return A.every(
    [
      parameters.backend === options.backend,
      parameters.compute === options.compute,
      Num.Equivalence(parameters.batchSize, options.batchSize),
      parameters.precision === "fp32",
      parameters.thresholdSource === options.thresholdSource,
      Num.Equivalence(parameters.detectionThreshold, options.detectionThreshold),
      Num.Equivalence(parameters.matchThreshold, options.matchThreshold),
      Num.Equivalence(parameters.reviewThreshold, options.reviewThreshold),
      Num.Equivalence(parameters.minFaceAreaPct, options.minFaceAreaPct),
      parameters.recursive === options.recursive,
    ],
    P.isTruthy
  );
};

const validateRequestedParameters = Effect.fn("Files.PersonMatchWorker.validateRequestedParameters")(function* (
  worker: PersonMatchWorkerSuccess,
  options: MatchPersonOptions
): Effect.fn.Return<void, MatchPersonSemanticError> {
  if (!requestedParametersMatch(worker, options)) {
    return yield* semanticError("Person-match worker reported parameters that do not match the requested scan.");
  }
});

const validateRequestedModel = Effect.fn("Files.PersonMatchWorker.validateRequestedModel")(function* (
  worker: PersonMatchWorkerSuccess,
  options: MatchPersonOptions,
  inputs: CanonicalMatchPersonInputs
): Effect.fn.Return<void, MatchPersonSemanticError, Path.Path> {
  const path = yield* Path.Path;
  if (worker.model.backend !== options.backend || !Str.Equivalence(path.resolve(worker.model.root), inputs.modelRoot)) {
    return yield* semanticError("Person-match worker reported a backend or model root outside the selected cache.");
  }
});

const validateRuntimeParameterEvidence = Effect.fn("Files.PersonMatchWorker.validateRuntimeParameterEvidence")(
  function* (worker: PersonMatchWorkerSuccess): Effect.fn.Return<void, MatchPersonSemanticError> {
    const parameters = worker.parameters;
    const runtime = worker.model.runtime;
    if (runtime.actualCompute !== parameters.actualCompute || runtime.precision !== parameters.precision) {
      return yield* semanticError("Person-match worker reported inconsistent runtime and parameter provenance.");
    }
    const runtimeDevices = A.map(runtime.devices, (device) => device.index);
    if (!deviceIndexesEquivalence(runtimeDevices, parameters.devices)) {
      return yield* semanticError("Person-match worker reported inconsistent runtime device ordinals.");
    }
    if (
      A.length(A.dedupe(runtimeDevices)) !== A.length(runtimeDevices) ||
      A.length(A.dedupe(parameters.devices)) !== A.length(parameters.devices)
    ) {
      return yield* semanticError("Person-match worker reported duplicate runtime device ordinals.");
    }
  }
);

const validateRequestedWorkerEvidence = Effect.fn("Files.PersonMatchWorker.validateRequestedEvidence")(function* (
  worker: PersonMatchWorkerSuccess,
  options: MatchPersonOptions,
  inputs: CanonicalMatchPersonInputs
): Effect.fn.Return<void, MatchPersonSemanticError, Path.Path> {
  yield* validateRequestedParameters(worker, options);
  yield* validateRequestedModel(worker, options, inputs);
  yield* validateRuntimeParameterEvidence(worker);
});

const validateRequestedDeviceSelection = Effect.fn("Files.PersonMatchWorker.validateRequestedDeviceSelection")(
  function* (
    worker: PersonMatchWorkerSuccess,
    options: MatchPersonOptions
  ): Effect.fn.Return<void, MatchPersonRuntimeError | MatchPersonSemanticError> {
    const parameters = worker.parameters;
    if (
      parameters.actualCompute === "rocm" &&
      O.exists(options.devices, (requested) => !deviceIndexesEquivalence(parameters.devices, requested))
    ) {
      return yield* runtimeError("Person-match worker did not select the explicitly requested ROCm device.");
    }
    if (parameters.actualCompute === "cpu" && A.isReadonlyArrayNonEmpty(parameters.devices)) {
      return yield* semanticError("Person-match worker reported GPU devices for CPU inference.");
    }
  }
);

const validateExplicitComputePolicy = Effect.fn("Files.PersonMatchWorker.validateExplicitComputePolicy")(function* (
  worker: PersonMatchWorkerSuccess,
  options: MatchPersonOptions
): Effect.fn.Return<void, MatchPersonRuntimeError> {
  const parameters = worker.parameters;
  const runtime = worker.model.runtime;
  if (options.compute === "rocm" && parameters.actualCompute !== "rocm") {
    return yield* runtimeError("Person-match worker silently substituted CPU for explicitly requested ROCm inference.");
  }
  if (options.compute === "cpu" && parameters.actualCompute !== "cpu") {
    return yield* runtimeError("Person-match worker did not honor explicitly requested CPU inference.");
  }
  if (options.compute !== "auto" && A.isReadonlyArrayNonEmpty(runtime.warnings)) {
    return yield* runtimeError("Person-match worker reported a compute fallback for an explicit compute policy.");
  }
});

const validateWorkerComputeSelection = Effect.fn("Files.PersonMatchWorker.validateComputeSelection")(function* (
  worker: PersonMatchWorkerSuccess,
  options: MatchPersonOptions
): Effect.fn.Return<void, MatchPersonRuntimeError | MatchPersonSemanticError> {
  yield* validateRequestedDeviceSelection(worker, options);
  yield* validateExplicitComputePolicy(worker, options);
});

const validateBuffaloRuntime = Effect.fn("Files.PersonMatchWorker.validateBuffaloRuntime")(function* (
  worker: PersonMatchWorkerSuccess
): Effect.fn.Return<void, MatchPersonRuntimeError> {
  const parameters = worker.parameters;
  const runtime = worker.model.runtime;
  if (
    parameters.actualCompute !== "cpu" ||
    runtime.framework !== "onnxruntime" ||
    A.isReadonlyArrayNonEmpty(runtime.warnings)
  ) {
    return yield* runtimeError("The Buffalo backend reported an unexpected non-CPU ONNX runtime.");
  }
});

const validateAdaFaceRocmRuntime = Effect.fn("Files.PersonMatchWorker.validateAdaFaceRocmRuntime")(function* (
  worker: PersonMatchWorkerSuccess
): Effect.fn.Return<void, MatchPersonRuntimeError> {
  const runtime = worker.model.runtime;
  if (runtime.actualCompute !== "rocm") return;
  if (runtime.distribution !== "rocm72") {
    return yield* runtimeError("The AdaFace backend cannot report ROCm compute from the pinned CPU distribution.");
  }
  if (O.isNone(runtime.hipVersion) || !Str.startsWith(adaFaceHipVersionPrefix)(runtime.hipVersion.value)) {
    return yield* runtimeError("The AdaFace ROCm runtime did not report the pinned HIP 7.2 family.");
  }
  if (
    A.length(runtime.devices) !== 1 ||
    A.some(runtime.devices, (device) => !Str.Equivalence(device.architecture, adaFaceRocmArchitecture))
  ) {
    return yield* runtimeError("The AdaFace ROCm runtime requires exactly one selected gfx1201 device.");
  }
});

const validateAdaFaceFramework = Effect.fn("Files.PersonMatchWorker.validateAdaFaceFramework")(function* (
  worker: PersonMatchWorkerSuccess
): Effect.fn.Return<void, MatchPersonRuntimeError> {
  const runtime = worker.model.runtime;
  if (runtime.framework !== "pytorch") {
    return yield* runtimeError("The AdaFace backend reported an unexpected non-PyTorch runtime.");
  }
  const expectedVersion = Match.value(runtime.distribution).pipe(
    Match.when("rocm72", () => adaFaceRocmRuntimePackageVersion),
    Match.when("cpu", () => adaFaceCpuRuntimePackageVersion),
    Match.exhaustive
  );
  if (!Str.Equivalence(runtime.packageVersion, expectedVersion)) {
    return yield* runtimeError(
      `The AdaFace backend did not report the pinned ${runtime.distribution} PyTorch runtime ${expectedVersion}.`
    );
  }
  if (runtime.distribution === "rocm72" && runtime.actualCompute !== "rocm") {
    return yield* runtimeError("The AdaFace ROCm distribution reported non-ROCm compute provenance.");
  }
  if (runtime.distribution === "cpu" && (runtime.actualCompute !== "cpu" || O.isSome(runtime.hipVersion))) {
    return yield* runtimeError("The AdaFace CPU distribution reported incoherent HIP or compute provenance.");
  }
});

const validateAdaFaceWarningProvenance = Effect.fn("Files.PersonMatchWorker.validateAdaFaceWarningProvenance")(
  function* (
    worker: PersonMatchWorkerSuccess,
    options: MatchPersonOptions
  ): Effect.fn.Return<void, MatchPersonRuntimeError> {
    const runtime = worker.model.runtime;
    if (
      (options.compute === "auto" &&
        runtime.actualCompute === "cpu" &&
        (A.length(runtime.warnings) !== 1 || runtime.warnings[0]?.code !== "rocm-fallback-to-cpu")) ||
      ((options.compute !== "auto" || runtime.actualCompute === "rocm") && A.isReadonlyArrayNonEmpty(runtime.warnings))
    ) {
      return yield* runtimeError("The AdaFace backend reported incoherent compute-fallback provenance.");
    }
  }
);

const validateAdaFaceRuntime = Effect.fn("Files.PersonMatchWorker.validateAdaFaceRuntime")(function* (
  worker: PersonMatchWorkerSuccess,
  options: MatchPersonOptions
): Effect.fn.Return<void, MatchPersonRuntimeError> {
  yield* validateAdaFaceFramework(worker);
  yield* validateAdaFaceRocmRuntime(worker);
  yield* validateAdaFaceWarningProvenance(worker, options);
});

const validateBackendRuntime = Effect.fn("Files.PersonMatchWorker.validateBackendRuntime")(function* (
  worker: PersonMatchWorkerSuccess,
  options: MatchPersonOptions
): Effect.fn.Return<void, MatchPersonRuntimeError> {
  return yield* Match.value(options.backend).pipe(
    Match.when("buffalo-l", () => validateBuffaloRuntime(worker)),
    Match.when("adaface-kprpe", () => validateAdaFaceRuntime(worker, options)),
    Match.exhaustive
  );
});

const validateWorkerSizeEvidence = Effect.fn("Files.PersonMatchWorker.validateSizeEvidence")(function* (
  worker: PersonMatchWorkerSuccess
): Effect.fn.Return<void, MatchPersonSemanticError> {
  const referenceFaceCount = A.reduce(worker.references, 0, (count, reference) => count + reference.faceCount);
  const entryFaceCount = A.reduce(worker.entries, 0, (count, entry) => count + entry.faceCount);
  if (referenceFaceCount + entryFaceCount > PERSON_MATCH_MAX_REPORTED_FACES) {
    return yield* semanticError(
      `Person-match worker reported more than ${PERSON_MATCH_MAX_REPORTED_FACES} faces; split the scan into smaller batches.`
    );
  }
  if (A.some(worker.entries, (entry) => entry.faceCount !== A.length(entry.faces))) {
    return yield* semanticError(
      "Person-match worker reported a face count inconsistent with its retained face evidence."
    );
  }
});

const validateWorkerEnvelope = Effect.fn("Files.PersonMatchWorker.validateEnvelope")(function* (
  worker: PersonMatchWorkerSuccess,
  options: MatchPersonOptions,
  inputs: CanonicalMatchPersonInputs
): Effect.fn.Return<void, MatchPersonRuntimeError | MatchPersonSemanticError, Path.Path> {
  yield* validateRequestedWorkerEvidence(worker, options, inputs);
  yield* validateWorkerComputeSelection(worker, options);
  yield* validateBackendRuntime(worker, options);
  yield* validateWorkerSizeEvidence(worker);
});

const validateUniqueRecursiveReferenceNames = Effect.fn("Files.PersonMatchWorker.validateReferenceNames")(function* (
  worker: PersonMatchWorkerSuccess,
  recursive: boolean
): Effect.fn.Return<void, MatchPersonSemanticError> {
  if (!recursive) return;
  const accepted = A.filter(worker.references, (reference) => reference.accepted);
  const names = A.map(accepted, (reference) => reference.sourceName);
  if (A.length(A.dedupe(names)) !== A.length(names)) {
    return yield* semanticError(
      "Recursive person-match references contain duplicate accepted file names. Rename references so face evidence remains unambiguous."
    );
  }
});

const workerLibraryEnvironment = (
  environment: PersonMatchWorkerEnvironment,
  workerLibraryPath: O.Option<string>
): Readonly<Record<string, string | undefined>> =>
  Match.value(environment).pipe(
    Match.when("primary", () => O.getSomesStruct({ LD_LIBRARY_PATH: workerLibraryPath })),
    Match.when("cpu", () => ({ LD_LIBRARY_PATH: undefined })),
    Match.exhaustive
  );

const capturedCommandFailureMessage = (summary: string, stdout: string, stderr: string, exitCode: number): string => {
  const stderrDiagnostic = Str.trim(stderr);
  const stdoutDiagnostic = Str.trim(stdout);
  const diagnostic = Str.isNonEmpty(stderrDiagnostic) ? stderrDiagnostic : stdoutDiagnostic;
  return Str.isNonEmpty(diagnostic)
    ? `${summary} with code ${exitCode}: ${diagnostic}`
    : `${summary} with code ${exitCode}.`;
};

const validateWorkerLock = Effect.fn("Files.PersonMatchWorker.validateLock")(function* (
  inputs: CanonicalMatchPersonInputs
): Effect.fn.Return<void, PersonMatchWorkerServiceError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runCapturedStreams({
    command: inputs.uvPath,
    args: ["lock", "--check", "--project", workerProjectDirectory, "--python", "3.12", "--no-python-downloads"],
    cwd: workerProjectDirectory,
    extendEnv: true,
    env: {
      NO_COLOR: "1",
      PYTHONUTF8: "1",
      UV_CACHE_DIR: inputs.uvCacheRoot,
      UV_NO_PROGRESS: "1",
    },
    bound: workerSetupOutputBound,
    trim: true,
  }).pipe(Effect.mapError((cause) => processError("Failed to start person-match uv lock validation.", cause)));
  if (result.exitCode !== 0) {
    return yield* processError(
      capturedCommandFailureMessage(
        "Person-match uv lock validation failed",
        result.stdout,
        result.stderr,
        result.exitCode
      )
    );
  }
});

const workerProcessEnvironment = (
  inputs: CanonicalMatchPersonInputs,
  environment: PersonMatchWorkerEnvironment,
  workerLibraryPath: O.Option<string>
): Readonly<Record<string, string | undefined>> => ({
  NO_COLOR: "1",
  PYTHONUTF8: "1",
  UV_CACHE_DIR: inputs.uvCacheRoot,
  UV_NO_PROGRESS: "1",
  UV_PROJECT_ENVIRONMENT: environment === "cpu" ? inputs.uvCpuEnvironment : inputs.uvEnvironment,
  ...workerLibraryEnvironment(environment, workerLibraryPath),
});

const materializeWorkerEnvironment = Effect.fn("Files.PersonMatchWorker.materializeEnvironment")(function* (
  options: MatchPersonOptions,
  inputs: CanonicalMatchPersonInputs,
  environment: PersonMatchWorkerEnvironment
): Effect.fn.Return<
  MaterializedPersonMatchWorkerEnvironment,
  MatchPersonWorkerEnvironmentSetupError | PersonMatchWorkerServiceError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const workerLibraryPath = yield* resolveWorkerLibraryPath(options, inputs, environment);
  const processEnvironment = workerProcessEnvironment(inputs, environment, workerLibraryPath);
  const result = yield* runCapturedStreams({
    command: inputs.uvPath,
    args: workerSyncArguments(options, environment),
    cwd: workerProjectDirectory,
    extendEnv: true,
    env: processEnvironment,
    bound: workerSetupOutputBound,
    trim: true,
  }).pipe(Effect.mapError((cause) => processError("Failed to start person-match environment sync.", cause)));
  if (result.exitCode !== 0) {
    if (!isNonNegativeInt(result.exitCode)) {
      return yield* processError(`Person-match environment sync returned invalid exit code ${result.exitCode}.`);
    }
    return yield* MatchPersonWorkerEnvironmentSetupError.make({
      environment,
      exitCode: result.exitCode,
      message: capturedCommandFailureMessage(
        `Person-match ${environment} environment sync failed`,
        result.stdout,
        result.stderr,
        result.exitCode
      ),
    });
  }
  return MaterializedPersonMatchWorkerEnvironment.make({ environment, workerLibraryPath });
});

const executeWorker = Effect.fn("Files.PersonMatchWorker.execute")(function* (
  options: MatchPersonOptions,
  inputs: CanonicalMatchPersonInputs,
  artifacts: O.Option<PreparedAdaFaceArtifacts>,
  materialized: MaterializedPersonMatchWorkerEnvironment
): Effect.fn.Return<PersonMatchWorkerSuccess, PersonMatchWorkerServiceError, WorkerServiceRequirements> {
  const processEnvironment = workerProcessEnvironment(inputs, materialized.environment, materialized.workerLibraryPath);
  const result = yield* runCapturedStreams({
    command: inputs.uvPath,
    args: workerArguments(options, inputs, artifacts),
    cwd: workerProjectDirectory,
    extendEnv: true,
    env: processEnvironment,
    stdoutBound: workerReportOutputBound,
    stderrBound: workerDiagnosticOutputBound,
    trim: true,
  }).pipe(Effect.mapError((cause) => processError("Failed to start the local person-match worker.", cause)));
  const worker = yield* decodeWorkerExecution(result.stdout, result.stderr, result.exitCode, result.truncated);
  yield* validateWorkerEnvelope(worker, options, inputs);
  const verifyModelArtifacts = yield* PersonMatchModelArtifactVerifier;
  yield* verifyModelArtifacts(worker.model, inputs.modelRoot);
  yield* validateUniqueRecursiveReferenceNames(worker, options.recursive);
  return worker;
});

const initialWorkerEnvironment = (options: MatchPersonOptions): PersonMatchWorkerEnvironment =>
  Match.value(options.backend).pipe(
    Match.when("buffalo-l", () => "primary" as const),
    Match.when("adaface-kprpe", () => (options.compute === "cpu" ? "cpu" : "primary")),
    Match.exhaustive
  );

const shouldRetryAdaFaceOnCpu = (
  options: MatchPersonOptions,
  environment: PersonMatchWorkerEnvironment,
  workerCode: PersonMatchWorkerErrorCode | undefined
): boolean =>
  options.backend === "adaface-kprpe" &&
  options.compute === "auto" &&
  environment === "primary" &&
  (workerCode === "pytorch-runtime-load-failed" ||
    workerCode === "rocm-unavailable" ||
    workerCode === "device-probe-failed");

const shouldRetryAdaFaceSetupOnCpu = (
  options: MatchPersonOptions,
  environment: PersonMatchWorkerEnvironment
): boolean => options.backend === "adaface-kprpe" && options.compute === "auto" && environment === "primary";

const setupErrorToServiceError = (error: MatchPersonWorkerEnvironmentSetupError): PersonMatchWorkerServiceError =>
  processError(error.message);

const writeAdaFaceSetupFallbackDiagnostic = Effect.fn("Files.PersonMatchWorker.writeSetupFallbackDiagnostic")(
  function* (message: string) {
    yield* Console.error(
      `Person-match primary environment setup failed; retrying the pinned CPU environment: ${message}`
    );
  }
);

const writeAdaFaceSetupFallback = (error: MatchPersonWorkerEnvironmentSetupError): Effect.Effect<void> =>
  writeAdaFaceSetupFallbackDiagnostic(error.message);

const materializeInitialWorkerEnvironment = Effect.fn("Files.PersonMatchWorker.materializeInitialEnvironment")(
  function* (
    options: MatchPersonOptions,
    inputs: CanonicalMatchPersonInputs,
    environment: PersonMatchWorkerEnvironment
  ): Effect.fn.Return<
    MaterializedPersonMatchWorkerEnvironment,
    PersonMatchWorkerServiceError,
    FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  > {
    return yield* materializeWorkerEnvironment(options, inputs, environment).pipe(
      Effect.catchTag("MatchPersonWorkerEnvironmentSetupError", (error) =>
        shouldRetryAdaFaceSetupOnCpu(options, error.environment)
          ? writeAdaFaceSetupFallback(error).pipe(Effect.andThen(materializeWorkerEnvironment(options, inputs, "cpu")))
          : Effect.fail(setupErrorToServiceError(error))
      ),
      Effect.catchTag("MatchPersonWorkerEnvironmentSetupError", flow(setupErrorToServiceError, Effect.fail))
    );
  }
);

/**
 * Exposes the runtime-attempt policy to package tests without making it part of the command API.
 *
 * **Example** (Inspect the policy)
 *
 * ```ts
 * import { PersonMatchWorkerPolicyForTest } from "@beep/repo-cli/test/Files"
 *
 * console.log(typeof PersonMatchWorkerPolicyForTest.initialEnvironment)
 * // "function"
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const PersonMatchWorkerPolicyForTest = {
  decodeWorkerExecution,
  initialEnvironment: initialWorkerEnvironment,
  resolveWorkerLibraryPath,
  shouldRetryAdaFaceOnCpu,
  shouldRetryAdaFaceSetupOnCpu,
  validateRuntimeRequest,
  validateWorkerEnvelope,
  writeAdaFaceSetupFallbackDiagnostic,
  workerArguments,
  workerLibraryEnvironment,
  workerSyncArguments,
};

const runWorker = Effect.fn("Files.PersonMatchWorker.run")(function* (
  options: MatchPersonOptions,
  inputs: CanonicalMatchPersonInputs
): Effect.fn.Return<PersonMatchWorkerSuccess, PersonMatchWorkerServiceError, WorkerServiceRequirements> {
  yield* validateRuntimeRequest(options);
  yield* validateWorkerLock(inputs);
  const environment = initialWorkerEnvironment(options);
  const materialized = yield* materializeInitialWorkerEnvironment(options, inputs, environment);
  const artifacts = yield* prepareBackendArtifacts(options, inputs);
  return yield* executeWorker(options, inputs, artifacts, materialized).pipe(
    Effect.catchTag("MatchPersonRuntimeError", (error) =>
      shouldRetryAdaFaceOnCpu(options, materialized.environment, error.workerCode)
        ? materializeWorkerEnvironment(options, inputs, "cpu").pipe(
            Effect.catchTag("MatchPersonWorkerEnvironmentSetupError", flow(setupErrorToServiceError, Effect.fail)),
            Effect.flatMap((cpuEnvironment) => executeWorker(options, inputs, artifacts, cpuEnvironment))
          )
        : Effect.fail(error)
    )
  );
});

const makePersonMatchWorkerService = Effect.fn("Files.PersonMatchWorkerService.make")(function* () {
  const runtimeContext = yield* Effect.context<WorkerServiceRequirements>();
  return PersonMatchWorkerService.of({
    run: Effect.fn("PersonMatchWorkerService.run")((options, inputs) =>
      runWorker(options, inputs).pipe(
        Effect.provide(runtimeContext),
        Effect.withSpan("Files.PersonMatchWorkerService.run", {
          attributes: { backend: options.backend, compute: options.compute },
        })
      )
    ),
  });
});

/**
 * Live worker layer backed by Effect filesystem, HTTP, cryptography, paths, and process services.
 *
 * **Example** (Reference the live layer)
 *
 * ```ts
 * import { PersonMatchWorkerServiceLive } from "./MatchPerson.worker-service.ts"
 *
 * console.log(PersonMatchWorkerServiceLive.pipe !== undefined)
 * ```
 *
 * @internal
 * @category layers
 * @since 0.0.0
 */
export const PersonMatchWorkerServiceLive: Layer.Layer<PersonMatchWorkerService, never, WorkerServiceRequirements> =
  Layer.effect(PersonMatchWorkerService, makePersonMatchWorkerService());
