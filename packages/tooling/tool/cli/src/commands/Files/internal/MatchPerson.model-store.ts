/**
 * Immutable, bounded-memory model acquisition for the AdaFace backend.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, PosInt, Sha256Hex } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { sha256 } from "@noble/hashes/sha2.js";
import { Crypto, Duration, Effect, Encoding, FileSystem, Match, Number as Num, Path, Schedule, Stream } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { HttpClient, HttpClientError, HttpClientRequest } from "effect/unstable/http";
import { canonicalizeFileTargetPath } from "./FileTransaction.ts";
import { MatchPersonError } from "./MatchPerson.errors.ts";
import type { MatchPersonModelAcquisitionError, MatchPersonModelIntegrityError } from "./MatchPerson.errors.ts";
import type { PersonMatchModel, PersonMatchModelArtifact } from "./MatchPerson.schemas.ts";

const $I = $RepoCliId.create("commands/Files/internal/MatchPerson.model-store");

const artifactFileName = "model.safetensors";
const artifactDirectoryName = "pinned";
const modelStoreLockName = ".adaface-model-store.lock";
const modelStoreChunkBytes = 1024 * 1024;
const modelDownloadRangeBytes = PosInt.make(16 * 1024 * 1024);
const modelDownloadRetryCount = 2;
const modelDownloadRetrySchedule = Schedule.exponential(Duration.seconds(1));
const RetryableHttpFailureReason = LiteralKit(["DecodeError", "TransportError"]);
const insightFaceLicenseNotice =
  "InsightFace pretrained-model terms: https://github.com/deepinsight/insightface/blob/master/server/LICENSING.md";
const cvlFaceLicenseNotice =
  "CVLFace code is MIT-licensed; checkpoint use is also subject to the training-dataset and model-card terms at the pinned source.";

class PinnedModelArtifact extends S.Class<PinnedModelArtifact>($I`PinnedModelArtifact`)(
  {
    component: S.Literals(["detector", "aligner", "recognizer"]),
    fileName: S.NonEmptyString,
    licenseNotice: S.NonEmptyString,
    name: S.NonEmptyString,
    revision: S.NonEmptyString,
    sha256: Sha256Hex,
    sizeBytes: PosInt,
    url: S.NonEmptyString,
  },
  $I.annote("PinnedModelArtifact", {
    description: "One immutable person-match component artifact and its exact provenance and expected bytes.",
  })
) {}

const recognizerArtifact = PinnedModelArtifact.make({
  component: "recognizer",
  fileName: "model.safetensors",
  licenseNotice: cvlFaceLicenseNotice,
  name: "cvlface_adaface_vit_base_kprpe_webface12m",
  revision: "daefd5012d369588bd214fbaf4cc6b1d286e7066",
  sha256: Sha256Hex.make("99d16ed4aac0fdf0fcc82526b9b70703f3ec8c3041bf1bf44bd22751536e65db"),
  sizeBytes: PosInt.make(460_344_344),
  url: "https://huggingface.co/minchul/cvlface_adaface_vit_base_kprpe_webface12m/resolve/daefd5012d369588bd214fbaf4cc6b1d286e7066/model.safetensors",
});

const detectorArtifact = PinnedModelArtifact.make({
  component: "detector",
  fileName: "det_10g.onnx",
  licenseNotice: insightFaceLicenseNotice,
  name: "insightface-det_10g",
  revision: "v0.7",
  sha256: Sha256Hex.make("5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91"),
  sizeBytes: PosInt.make(16_923_827),
  url: "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip",
});

const alignerArtifact = PinnedModelArtifact.make({
  component: "aligner",
  fileName: "model.safetensors",
  licenseNotice: cvlFaceLicenseNotice,
  name: "cvlface_DFA_mobilenet",
  revision: "8317e6dda53d91e7074979923144c2cc08906a33",
  sha256: Sha256Hex.make("80b6e922e4c76c10d5e24061fe47cd96112d18689bf5ae7e34af52e641c18c4a"),
  sizeBytes: PosInt.make(2_007_980),
  url: "https://huggingface.co/minchul/cvlface_DFA_mobilenet/resolve/8317e6dda53d91e7074979923144c2cc08906a33/model.safetensors",
});

const buffaloRecognizerArtifact = PinnedModelArtifact.make({
  component: "recognizer",
  fileName: "w600k_r50.onnx",
  licenseNotice: insightFaceLicenseNotice,
  name: "insightface-w600k_r50",
  revision: "v0.7",
  sha256: Sha256Hex.make("4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43"),
  sizeBytes: PosInt.make(174_383_860),
  url: "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip",
});

const pinnedArtifacts = [alignerArtifact, recognizerArtifact] as const;
const pinnedComponents = ["aligner", "recognizer"] as const;

class ObservedArtifact extends S.Class<ObservedArtifact>($I`ObservedArtifact`)(
  {
    sha256: Sha256Hex,
    sizeBytes: NonNegativeInt,
  },
  $I.annote("ObservedArtifact", {
    description: "Bounded-memory size and SHA-256 observation for one local model artifact.",
  })
) {}

class InstalledArtifactExpectation extends S.Class<InstalledArtifactExpectation>($I`InstalledArtifactExpectation`)(
  {
    artifact: PinnedModelArtifact,
    path: S.NonEmptyString,
  },
  $I.annote("InstalledArtifactExpectation", {
    description: "One pinned model artifact paired with its only accepted canonical installation path.",
  })
) {}

/**
 * Canonical paths prepared for the AdaFace worker.
 *
 * **Example** (Describe prepared paths)
 *
 * ```ts
 * import { PreparedAdaFaceArtifacts } from "./MatchPerson.model-store.ts"
 *
 * const prepared = PreparedAdaFaceArtifacts.make({
 *   alignerPath: "/cache/pinned/aligner/model.safetensors",
 *   recognizerPath: "/cache/pinned/recognizer/model.safetensors"
 * })
 * console.log(prepared.alignerPath)
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class PreparedAdaFaceArtifacts extends S.Class<PreparedAdaFaceArtifacts>($I`PreparedAdaFaceArtifacts`)(
  {
    alignerPath: S.NonEmptyString,
    recognizerPath: S.NonEmptyString,
  },
  $I.annote("PreparedAdaFaceArtifacts", {
    description: "Canonical aligner and recognizer paths passed explicitly to the AdaFace worker.",
  })
) {}

type ModelStoreRequirements = FileSystem.FileSystem | Path.Path | Crypto.Crypto | HttpClient.HttpClient;

const { modelAcquisition: acquisitionError, modelIntegrity: integrityError } = MatchPersonError;

const httpFailureDetail = (cause: unknown): string => {
  if (!HttpClientError.isHttpClientError(cause)) {
    return P.isError(cause) ? cause.message : "unknown transport failure";
  }
  const nested = cause.reason.cause;
  return P.isError(nested) ? `${cause.reason._tag}: ${nested.message}` : cause.reason._tag;
};

const isRetryableHttpFailure = (cause: unknown): boolean =>
  HttpClientError.isHttpClientError(cause) && S.is(RetryableHttpFailureReason)(cause.reason._tag);

const isRetryableModelDownloadFailure = (
  cause: MatchPersonModelAcquisitionError | MatchPersonModelIntegrityError
): boolean => P.isTagged("MatchPersonModelAcquisitionError")(cause) && isRetryableHttpFailure(cause.cause);

const inspectArtifact = Effect.fn("Files.PersonMatchModelStore.inspectArtifact")(function* (
  filePath: string
): Effect.fn.Return<ObservedArtifact, MatchPersonModelIntegrityError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const stat = yield* fs
    .stat(filePath)
    .pipe(Effect.mapError((cause) => integrityError(`Failed to stat model artifact "${filePath}".`, cause)));
  if (stat.type !== "File") {
    return yield* integrityError(`Model artifact is not a regular file: "${filePath}".`);
  }

  const hasher = sha256.create();
  let sizeBytes = 0;
  yield* Stream.runForEach(fs.stream(filePath, { chunkSize: modelStoreChunkBytes }), (chunk) =>
    Effect.sync(() => {
      hasher.update(chunk);
      sizeBytes += chunk.byteLength;
    })
  ).pipe(Effect.mapError((cause) => integrityError(`Failed to hash model artifact "${filePath}".`, cause)));

  return ObservedArtifact.make({
    sha256: Sha256Hex.make(Encoding.encodeHex(hasher.digest())),
    sizeBytes: NonNegativeInt.make(sizeBytes),
  });
});

const validateObservedArtifact = Effect.fn("Files.PersonMatchModelStore.validateObservedArtifact")(function* (
  artifact: PinnedModelArtifact,
  observed: ObservedArtifact,
  mismatchMessage: string
): Effect.fn.Return<void, MatchPersonModelIntegrityError> {
  if (!Num.Equivalence(observed.sizeBytes, artifact.sizeBytes) || !Str.Equivalence(observed.sha256, artifact.sha256)) {
    return yield* integrityError(mismatchMessage);
  }
});

const validateArtifactPath = Effect.fn("Files.PersonMatchModelStore.validateArtifactPath")(function* (
  artifact: PinnedModelArtifact,
  filePath: string
): Effect.fn.Return<void, MatchPersonModelIntegrityError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolved = path.resolve(filePath);
  const canonical = yield* fs
    .realPath(resolved)
    .pipe(Effect.mapError((cause) => integrityError(`Failed to resolve model artifact "${resolved}".`, cause)));
  if (!Str.Equivalence(canonical, resolved)) {
    return yield* integrityError(`Refusing a symlinked or aliased model artifact: "${resolved}".`);
  }
  const observed = yield* inspectArtifact(canonical);
  yield* validateObservedArtifact(
    artifact,
    observed,
    `Model artifact integrity mismatch for ${artifact.component}: expected ${artifact.sizeBytes} bytes and SHA-256 ${artifact.sha256}.`
  );
});

const expectedInstalledArtifacts = (
  model: PersonMatchModel,
  modelRoot: string,
  path: Path.Path
): ReadonlyArray<InstalledArtifactExpectation> => {
  const detector = InstalledArtifactExpectation.make({
    artifact: detectorArtifact,
    path: path.join(modelRoot, "models", "beep_buffalo_l_v1", detectorArtifact.fileName),
  });
  return Match.value(model.backend).pipe(
    Match.when("buffalo-l", () => [
      detector,
      InstalledArtifactExpectation.make({
        artifact: buffaloRecognizerArtifact,
        path: path.join(modelRoot, "models", "beep_buffalo_l_v1", buffaloRecognizerArtifact.fileName),
      }),
    ]),
    Match.when("adaface-kprpe", () => [
      detector,
      InstalledArtifactExpectation.make({
        artifact: alignerArtifact,
        path: path.join(modelRoot, artifactDirectoryName, "aligner", alignerArtifact.fileName),
      }),
      InstalledArtifactExpectation.make({
        artifact: recognizerArtifact,
        path: path.join(modelRoot, artifactDirectoryName, "recognizer", recognizerArtifact.fileName),
      }),
    ]),
    Match.exhaustive
  );
};

const verifyReportedArtifact = Effect.fn("Files.PersonMatchModelStore.verifyReportedArtifact")(function* (
  reported: PersonMatchModelArtifact,
  expected: InstalledArtifactExpectation
): Effect.fn.Return<void, MatchPersonModelIntegrityError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  if (
    !Str.Equivalence(reported.name, expected.artifact.fileName) ||
    !Str.Equivalence(path.resolve(reported.path), expected.path) ||
    !Str.Equivalence(reported.sha256, expected.artifact.sha256) ||
    !Num.Equivalence(reported.sizeBytes, expected.artifact.sizeBytes)
  ) {
    return yield* integrityError(
      `Worker-reported ${expected.artifact.component} artifact does not match its pinned path, size, or SHA-256.`
    );
  }
  yield* validateArtifactPath(expected.artifact, expected.path);
});

const verifyReportedComponent = Effect.fn("Files.PersonMatchModelStore.verifyReportedComponent")(function* (
  reported: PersonMatchModel["components"][number],
  expected: InstalledArtifactExpectation
): Effect.fn.Return<void, MatchPersonModelIntegrityError, FileSystem.FileSystem | Path.Path> {
  const pinned = expected.artifact;
  if (
    reported.role !== pinned.component ||
    !Str.Equivalence(reported.name, pinned.name) ||
    !Str.Equivalence(reported.revision, pinned.revision) ||
    !Str.Equivalence(reported.source, pinned.url) ||
    !Str.Equivalence(reported.licenseNotice, pinned.licenseNotice)
  ) {
    return yield* integrityError(
      `Worker-reported ${pinned.component} component does not match its pinned name, revision, source, or license notice.`
    );
  }
  yield* A.match(reported.artifacts, {
    onEmpty: () => integrityError(`Worker model provenance omitted the ${pinned.component} artifact.`),
    onNonEmpty: ([head, ...tail]) =>
      A.isReadonlyArrayNonEmpty(tail)
        ? integrityError(`Worker model provenance reported multiple ${pinned.component} artifacts.`)
        : verifyReportedArtifact(head, expected),
  });
});

const artifactPath = (path: Path.Path, root: string, artifact: PinnedModelArtifact): string =>
  path.join(root, artifactDirectoryName, artifact.component, artifactFileName);

const acquireModelStoreLock = Effect.fn("Files.PersonMatchModelStore.acquireLock")(function* (
  modelRoot: string
): Effect.fn.Return<
  readonly [lockPath: string, token: string],
  MatchPersonModelAcquisitionError,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path
> {
  const crypto = yield* Crypto.Crypto;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lockPath = path.join(modelRoot, modelStoreLockName);
  const token = yield* crypto.randomUUIDv4.pipe(
    Effect.mapError((cause) => acquisitionError("Failed to generate the AdaFace model-store lock token.", cause))
  );
  yield* fs
    .writeFileString(lockPath, token, { flag: "wx", mode: 0o600 })
    .pipe(
      Effect.mapError((cause) =>
        acquisitionError(
          `Could not acquire the AdaFace model-store lock at "${lockPath}". Another acquisition may be active; remove the lock only after confirming it is idle.`,
          cause
        )
      )
    );
  return [lockPath, token];
});

const releaseModelStoreLock = Effect.fn("Files.PersonMatchModelStore.releaseLock")(function* (
  lock: readonly [lockPath: string, token: string]
): Effect.fn.Return<void, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const current = yield* fs.readFileString(lock[0]).pipe(Effect.option);
  if (O.exists(current, (value) => Str.Equivalence(value, lock[1]))) {
    yield* fs.remove(lock[0], { force: true }).pipe(Effect.ignore);
  }
});

const ensureCanonicalDirectory = Effect.fn("Files.PersonMatchModelStore.ensureCanonicalDirectory")(function* (
  directory: string,
  description: string
): Effect.fn.Return<string, MatchPersonModelIntegrityError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolved = path.resolve(directory);
  yield* fs
    .makeDirectory(resolved, { recursive: true, mode: 0o700 })
    .pipe(Effect.mapError((cause) => integrityError(`Failed to create ${description} "${resolved}".`, cause)));
  const canonical = yield* fs
    .realPath(resolved)
    .pipe(Effect.mapError((cause) => integrityError(`Failed to resolve ${description} "${resolved}".`, cause)));
  if (!Str.Equivalence(canonical, resolved)) {
    return yield* integrityError(`Refusing a symlinked or aliased ${description}: "${resolved}".`);
  }
  const stat = yield* fs
    .stat(canonical)
    .pipe(Effect.mapError((cause) => integrityError(`Failed to stat ${description} "${canonical}".`, cause)));
  if (stat.type !== "Directory") {
    return yield* integrityError(`${description} must be a regular directory: "${canonical}".`);
  }
  return canonical;
});

const downloadArtifactRangeAttempt = Effect.fn("Files.PersonMatchModelStore.downloadArtifactRangeAttempt")(function* (
  artifact: PinnedModelArtifact,
  rangePath: string,
  start: number,
  end: number,
  client: HttpClient.HttpClient
): Effect.fn.Return<void, MatchPersonModelAcquisitionError | MatchPersonModelIntegrityError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .remove(rangePath, { force: true })
    .pipe(
      Effect.mapError((cause) =>
        acquisitionError(
          `Failed to reset staging for the pinned ${artifact.component} model artifact byte range.`,
          cause
        )
      )
    );
  const expectedSizeBytes = end - start + 1;
  const expectedContentRange = `bytes ${start}-${end}/${artifact.sizeBytes}`;
  const request = HttpClientRequest.get(artifact.url).pipe(
    HttpClientRequest.setHeader("accept-encoding", "identity"),
    HttpClientRequest.setHeader("range", `bytes=${start}-${end}`)
  );
  const response = yield* client
    .execute(request)
    .pipe(
      Effect.mapError((cause) =>
        acquisitionError(
          `Failed to request pinned ${artifact.component} model artifact bytes ${start}-${end} (${httpFailureDetail(cause)}).`,
          cause
        )
      )
    );
  if (!Num.Equivalence(response.status, 206)) {
    return yield* integrityError(
      `Pinned ${artifact.component} model artifact byte range ${start}-${end} returned HTTP ${response.status}; expected 206.`
    );
  }
  if (!Str.Equivalence(response.headers["content-range"] ?? "", expectedContentRange)) {
    return yield* integrityError(
      `Pinned ${artifact.component} model artifact byte range ${start}-${end} returned an invalid Content-Range header.`
    );
  }
  const contentLength = response.headers["content-length"];
  if (contentLength !== undefined && !Str.Equivalence(contentLength, `${expectedSizeBytes}`)) {
    return yield* integrityError(
      `Pinned ${artifact.component} model artifact byte range ${start}-${end} returned an invalid Content-Length header.`
    );
  }
  const contentEncoding = response.headers["content-encoding"];
  if (contentEncoding !== undefined && !Str.Equivalence(contentEncoding, "identity")) {
    return yield* integrityError(
      `Pinned ${artifact.component} model artifact byte range ${start}-${end} returned an unsupported Content-Encoding header.`
    );
  }

  let sizeBytes = 0;
  yield* response.stream.pipe(
    Stream.mapEffect((chunk) =>
      sizeBytes + chunk.byteLength > expectedSizeBytes
        ? integrityError(
            `Pinned ${artifact.component} model artifact byte range ${start}-${end} exceeded its ${expectedSizeBytes}-byte ceiling.`
          )
        : Effect.sync(() => {
            sizeBytes += chunk.byteLength;
            return chunk;
          })
    ),
    Stream.run(fs.sink(rangePath, { flag: "wx", mode: 0o600 })),
    Effect.mapError((cause) =>
      P.isTagged("MatchPersonModelIntegrityError")(cause)
        ? cause
        : acquisitionError(
            HttpClientError.isHttpClientError(cause)
              ? `Failed to stream pinned ${artifact.component} model artifact bytes ${start}-${end} (${httpFailureDetail(cause)}).`
              : `Failed to stage pinned ${artifact.component} model artifact bytes ${start}-${end}.`,
            cause
          )
    )
  );
  if (!Num.Equivalence(sizeBytes, expectedSizeBytes)) {
    return yield* integrityError(
      `Pinned ${artifact.component} model artifact byte range ${start}-${end} ended after ${sizeBytes} bytes; expected ${expectedSizeBytes}.`
    );
  }
});

const downloadArtifactAttempt = Effect.fn("Files.PersonMatchModelStore.downloadArtifactAttempt")(function* (
  artifact: PinnedModelArtifact,
  stagedPath: string,
  rangePath: string,
  client: HttpClient.HttpClient,
  rangeBytes: PosInt,
  retrySchedule: Schedule.Schedule<Duration.Duration>
): Effect.fn.Return<
  ObservedArtifact,
  MatchPersonModelAcquisitionError | MatchPersonModelIntegrityError,
  FileSystem.FileSystem
> {
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .remove(stagedPath, { force: true })
    .pipe(
      Effect.mapError((cause) =>
        acquisitionError(`Failed to reset staging for the pinned ${artifact.component} model artifact.`, cause)
      )
    );
  const starts = A.unfold(0, (start) =>
    start < artifact.sizeBytes ? O.some([start, start + rangeBytes] as const) : O.none()
  );
  const hasher = sha256.create();
  let sizeBytes = 0;
  yield* Effect.forEach(
    starts,
    (start) => {
      const end = Num.min(start + rangeBytes - 1, artifact.sizeBytes - 1);
      return downloadArtifactRangeAttempt(artifact, rangePath, start, end, client).pipe(
        Effect.retry({
          schedule: retrySchedule,
          times: modelDownloadRetryCount,
          while: isRetryableModelDownloadFailure,
        }),
        Effect.andThen(
          fs.stream(rangePath, { chunkSize: modelStoreChunkBytes }).pipe(
            Stream.mapEffect((chunk) =>
              Effect.sync(() => {
                hasher.update(chunk);
                sizeBytes += chunk.byteLength;
                return chunk;
              })
            ),
            Stream.run(fs.sink(stagedPath, { flag: Num.Equivalence(start, 0) ? "wx" : "a", mode: 0o600 })),
            Effect.mapError((cause) =>
              acquisitionError(
                `Failed to append pinned ${artifact.component} model artifact bytes ${start}-${end}.`,
                cause
              )
            ),
            Effect.ensuring(fs.remove(rangePath, { force: true }).pipe(Effect.ignore))
          )
        )
      );
    },
    { concurrency: 1, discard: true }
  );
  return ObservedArtifact.make({
    sha256: Sha256Hex.make(Encoding.encodeHex(hasher.digest())),
    sizeBytes: NonNegativeInt.make(sizeBytes),
  });
});

const downloadArtifact = Effect.fn("Files.PersonMatchModelStore.downloadArtifact")(function* (
  artifact: PinnedModelArtifact,
  targetPath: string,
  modelRoot: string,
  rangeBytes = modelDownloadRangeBytes,
  retrySchedule: Schedule.Schedule<Duration.Duration> = modelDownloadRetrySchedule
): Effect.fn.Return<
  void,
  MatchPersonModelAcquisitionError | MatchPersonModelIntegrityError,
  FileSystem.FileSystem | HttpClient.HttpClient | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const client = HttpClient.followRedirects(yield* HttpClient.HttpClient, 5);
  const stagingDirectory = yield* fs
    .makeTempDirectory({ directory: modelRoot, prefix: `.beep-${artifact.component}-` })
    .pipe(
      Effect.mapError((cause) =>
        acquisitionError(`Failed to create staging for the ${artifact.component} model artifact.`, cause)
      )
    );
  const stagedPath = path.join(stagingDirectory, artifactFileName);
  const rangePath = path.join(stagingDirectory, `${artifactFileName}.range`);

  yield* Effect.ensuring(
    Effect.gen(function* () {
      yield* Effect.logInfo("Downloading pinned person-match model artifact").pipe(
        Effect.annotateLogs({
          component: artifact.component,
          revision: artifact.revision,
          sizeBytes: artifact.sizeBytes,
        })
      );
      const observed = yield* downloadArtifactAttempt(
        artifact,
        stagedPath,
        rangePath,
        client,
        rangeBytes,
        retrySchedule
      );
      yield* validateObservedArtifact(
        artifact,
        observed,
        `Downloaded ${artifact.component} model artifact failed integrity validation: expected ${artifact.sizeBytes} bytes and SHA-256 ${artifact.sha256}.`
      );
      yield* fs
        .rename(stagedPath, targetPath)
        .pipe(
          Effect.mapError((cause) =>
            acquisitionError(`Failed to atomically install the ${artifact.component} model artifact.`, cause)
          )
        );
      yield* validateArtifactPath(artifact, targetPath);
    }),
    fs.remove(stagingDirectory, { force: true, recursive: true }).pipe(Effect.ignore)
  );
});

/**
 * Acquires one tiny recognizer pin through the production ranged-download path for hermetic tests.
 *
 * **Details**
 *
 * The helper changes only the immutable pin and range size. Status, header, byte-ceiling,
 * retry, integrity, staging-cleanup, and atomic-install behavior remain production behavior.
 *
 * **Example** (Build a hermetic acquisition effect)
 *
 * ```ts
 * import { PosInt, Sha256Hex } from "@beep/schema"
 * import { Effect } from "effect"
 * import { acquirePinnedPersonMatchArtifactForTest } from "./MatchPerson.model-store.ts"
 *
 * const operation = acquirePinnedPersonMatchArtifactForTest(
 *   "/cache/models",
 *   "/cache/models/model.safetensors",
 *   PosInt.make(3),
 *   Sha256Hex.make("0000000000000000000000000000000000000000000000000000000000000000"),
 *   PosInt.make(2)
 * )
 * console.log(Effect.isEffect(operation))
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const acquirePinnedPersonMatchArtifactForTest = Effect.fn(
  "Files.PersonMatchModelStore.acquirePinnedArtifactForTest"
)(function* (
  modelRoot: string,
  targetPath: string,
  expectedSizeBytes: PosInt,
  expectedSha256: Sha256Hex,
  rangeBytes: PosInt
): Effect.fn.Return<
  void,
  MatchPersonModelAcquisitionError | MatchPersonModelIntegrityError,
  FileSystem.FileSystem | HttpClient.HttpClient | Path.Path
> {
  const artifact = PinnedModelArtifact.make({
    component: "recognizer",
    fileName: artifactFileName,
    licenseNotice: "Hermetic person-match ranged-download fixture.",
    name: "person-match-ranged-download-fixture",
    revision: "fixture",
    sha256: expectedSha256,
    sizeBytes: expectedSizeBytes,
    url: "https://example.invalid/person-match/model.safetensors",
  });
  yield* downloadArtifact(artifact, targetPath, modelRoot, rangeBytes, Schedule.exponential(Duration.zero));
});

const ensureArtifact = Effect.fn("Files.PersonMatchModelStore.ensureArtifact")(function* (
  artifact: PinnedModelArtifact,
  targetPath: string,
  modelRoot: string
): Effect.fn.Return<void, MatchPersonModelAcquisitionError | MatchPersonModelIntegrityError, ModelStoreRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(targetPath)
    .pipe(
      Effect.mapError((cause) => acquisitionError(`Failed to inspect ${artifact.component} model artifact.`, cause))
    );
  if (exists) {
    return yield* validateArtifactPath(artifact, targetPath);
  }
  const linked = yield* fs.readLink(targetPath).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false)
  );
  if (linked) {
    return yield* integrityError(`Refusing a dangling model artifact symlink: "${targetPath}".`);
  }
  yield* downloadArtifact(artifact, targetPath, modelRoot);
});

const validateExactArtifactAllowlist = Effect.fn("Files.PersonMatchModelStore.validateAllowlist")(function* (
  artifactsRoot: string
): Effect.fn.Return<void, MatchPersonModelIntegrityError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const components = yield* fs
    .readDirectory(artifactsRoot)
    .pipe(Effect.mapError((cause) => integrityError("Failed to inspect the AdaFace artifact allowlist.", cause)));
  if (
    A.length(components) !== A.length(pinnedComponents) ||
    A.some(components, (component) => !A.contains(pinnedComponents, component))
  ) {
    return yield* integrityError(`AdaFace artifact directory contains files outside the exact pinned allowlist.`);
  }
  yield* Effect.forEach(
    pinnedComponents,
    (component) =>
      fs.readDirectory(path.join(artifactsRoot, component)).pipe(
        Effect.flatMap((entries) =>
          A.length(entries) === 1 && Str.Equivalence(entries[0] ?? "", artifactFileName)
            ? Effect.void
            : integrityError(`AdaFace ${component} directory contains files outside the exact pinned allowlist.`)
        ),
        Effect.mapError((cause) =>
          cause._tag === "MatchPersonModelIntegrityError"
            ? cause
            : integrityError(`Failed to inspect the AdaFace ${component} artifact allowlist.`, cause)
        )
      ),
    { concurrency: 1, discard: true }
  );
});

/**
 * Prepare the exact pinned AdaFace aligner and recognizer without buffering either artifact in memory.
 *
 * **Example** (Prepare an AdaFace cache)
 *
 * ```ts
 * import { prepareAdaFaceArtifacts } from "./MatchPerson.model-store.ts"
 * import { Effect } from "effect"
 *
 * const operation = prepareAdaFaceArtifacts("/cache/adaface-kprpe")
 * console.log(Effect.isEffect(operation))
 * ```
 *
 * @internal
 * @category model-store
 * @since 0.0.0
 */
export const prepareAdaFaceArtifacts = Effect.fn("Files.PersonMatchModelStore.prepareAdaFaceArtifacts")(function* (
  modelRoot: string
): Effect.fn.Return<
  PreparedAdaFaceArtifacts,
  MatchPersonModelAcquisitionError | MatchPersonModelIntegrityError,
  ModelStoreRequirements
> {
  const path = yield* Path.Path;
  const requestedRoot = yield* canonicalizeFileTargetPath(modelRoot, "AdaFace model root").pipe(
    Effect.mapError((error) => integrityError(error.message, error.cause))
  );
  const canonicalRoot = yield* ensureCanonicalDirectory(requestedRoot, "AdaFace model root");

  return yield* Effect.acquireUseRelease(
    acquireModelStoreLock(canonicalRoot),
    Effect.fnUntraced(function* () {
      const artifactsRoot = yield* ensureCanonicalDirectory(
        path.join(canonicalRoot, artifactDirectoryName),
        "AdaFace pinned artifact directory"
      );
      yield* Effect.forEach(
        pinnedArtifacts,
        (artifact) =>
          ensureCanonicalDirectory(
            path.join(artifactsRoot, artifact.component),
            `AdaFace ${artifact.component} artifact directory`
          ).pipe(
            Effect.flatMap((directory) =>
              ensureArtifact(artifact, path.join(directory, artifactFileName), canonicalRoot)
            )
          ),
        { concurrency: 1, discard: true }
      );
      yield* validateExactArtifactAllowlist(artifactsRoot);
      return PreparedAdaFaceArtifacts.make({
        alignerPath: artifactPath(path, canonicalRoot, alignerArtifact),
        recognizerPath: artifactPath(path, canonicalRoot, recognizerArtifact),
      });
    }),
    releaseModelStoreLock
  ).pipe(
    Effect.withSpan("Files.PersonMatchModelStore.prepareAdaFaceArtifacts", {
      attributes: { backend: "adaface-kprpe" },
    })
  );
});

/**
 * Re-hash every worker-reported model component and compare it with its exact installation pin.
 *
 * **Example** (Reference artifact verification)
 *
 * ```ts
 * import { verifyPersonMatchModelArtifacts } from "./MatchPerson.model-store.ts"
 *
 * console.log(typeof verifyPersonMatchModelArtifacts)
 * ```
 *
 * @internal
 * @category model-store
 * @since 0.0.0
 */
export const verifyPersonMatchModelArtifacts = Effect.fn("Files.PersonMatchModelStore.verifyReportedArtifacts")(
  function* (
    model: PersonMatchModel,
    modelRoot: string
  ): Effect.fn.Return<void, MatchPersonModelIntegrityError, FileSystem.FileSystem | Path.Path> {
    const path = yield* Path.Path;
    const expected = expectedInstalledArtifacts(model, modelRoot, path);
    if (A.length(model.components) !== A.length(expected)) {
      return yield* integrityError("Worker model provenance omitted or added a pinned model component.");
    }
    yield* Effect.forEach(
      expected,
      (expectation) => {
        const component = A.findFirst(
          model.components,
          (candidate) => candidate.role === expectation.artifact.component
        );
        return O.match(component, {
          onNone: () =>
            integrityError(`Worker model provenance omitted the ${expectation.artifact.component} component.`),
          onSome: (present) => verifyReportedComponent(present, expectation),
        });
      },
      { concurrency: 1, discard: true }
    );
  }
);
