/**
 * Live services and runners for the T7 preservation gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { sha256 } from "@noble/hashes/sha2.js";
import { DateTime, Effect, Encoding, FileSystem, Layer, MutableHashMap, Path, pipe, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { printLines } from "../../../internal/cli/Printer.ts";
import { runCapturedStreams } from "../../../internal/process/StepExec.ts";
import {
  PreservationArchiveIoError,
  PreservationCeilingExceededError,
  PreservationPreflightMissingError,
  PreservationPreflightUnapprovedError,
  PreservationUnapprovedRowsError,
  PreservationVerificationFailure,
} from "../Corpus.errors.ts";
import {
  ArchiveWriter,
  CapacityPreflightService,
  PreservationManifestStore,
  PreservationVerifier,
  StreamingHasher,
} from "./Preservation.contracts.ts";
import {
  CapacityMeasurement,
  CapacityPreflight,
  CapacityPreflightJson,
  CorpusLedgerRecordJson,
  PreservationAttemptOutcome,
  PreservationManifestRow,
  PreservationManifestRowJson,
  PreservationObjectIdentity,
  PreservationPassKind,
  PreservationRunSummary,
  PreservationVerificationOutcome,
  PreservationVerificationReport,
  PreservationVerificationRow,
  PreservationVerificationSummary,
  SourceStabilityObservation,
  StreamingHashResult,
  T7ArchiveProvenanceRecord,
} from "./Preservation.schemas.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { PreservationCommandError } from "../Corpus.errors.ts";
import type { ArchiveWriterShape, PreservationManifestStoreShape } from "./Preservation.contracts.ts";
import type { T7PreservationOptions } from "./Preservation.schemas.ts";

const archiveDirectoryName = "t7-salvage-2026-08-10";
const sourceDirectoryName = "oppold-salvage-2026-08-10";
const rootArchiveName = "oppold-corpus.zip";
const manifestName = "preservation-manifest.jsonl";
const preflightName = "preservation-preflight.json";
const partialSuffix = ".preservation-partial";
const hashChunkBytes = 1024 * 1024;
// Bar v2 stops-and-reports rather than spinning: after this many attempts the
// last unapproved row (changed-during-copy / resume-discarded) stands terminal.
const maxAttemptsPerObject = 5;
const utf8Encoder = new TextEncoder();
const decodeSha256 = S.decodeUnknownEffect(Sha256Hex);
const decodeNumber = S.decodeUnknownEffect(S.FiniteFromString);
const stabilityEquivalence = S.toEquivalence(SourceStabilityObservation);
const isPreservationPassKind = S.is(PreservationPassKind);
type Sha256State = ReturnType<typeof sha256.create>;

type PreservationRequirements = FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner;

const ioError =
  (operation: string, path: string) =>
  (cause: unknown): PreservationArchiveIoError =>
    PreservationArchiveIoError.make({
      cause,
      message: `Preservation ${operation} failed.`,
      operation,
      path,
    });

const archiveRootFor = (corpusRoot: string, path: Path.Path): string =>
  path.join(path.resolve(corpusRoot), "raw", archiveDirectoryName);

const manifestPathFor = (corpusRoot: string, path: Path.Path): string =>
  path.join(archiveRootFor(corpusRoot, path), manifestName);

const preflightPathFor = (corpusRoot: string, path: Path.Path): string =>
  path.join(archiveRootFor(corpusRoot, path), preflightName);

const sourceObservation = (info: FileSystem.File.Info): SourceStabilityObservation => {
  const mtimeEpoch = pipe(
    info.mtime,
    O.map((mtime) => Math.floor(DateTime.toEpochMillis(DateTime.makeUnsafe(mtime)) / 1000)),
    O.getOrElse(() => 0)
  );
  return SourceStabilityObservation.make({ mtimeEpoch, sizeBytes: NonNegativeInt.make(Number(info.size)) });
};

const objectIdentity = (
  info: FileSystem.File.Info,
  relativePath: string,
  sourceClass: "salvage-tree" | "root-archive-object"
): PreservationObjectIdentity => {
  const observation = sourceObservation(info);
  const mtimeIso = pipe(
    info.mtime,
    O.map((mtime) => DateTime.formatIso(DateTime.makeUnsafe(mtime))),
    O.getOrElse(() => "1970-01-01T00:00:00.000Z")
  );
  return PreservationObjectIdentity.make({
    mtimeEpoch: observation.mtimeEpoch,
    mtimeIso,
    relativePath,
    sizeBytes: observation.sizeBytes,
    sourceClass,
  });
};

const digestResult = Effect.fn("Preservation.digestResult")(function* (
  hasher: Sha256State,
  bytes: number
): Effect.fn.Return<StreamingHashResult, PreservationArchiveIoError> {
  const sha256Hex = yield* decodeSha256(Encoding.encodeHex(hasher.digest())).pipe(
    Effect.mapError(ioError("hash-finalize", "stream"))
  );
  return StreamingHashResult.make({ bytes: NonNegativeInt.make(bytes), sha256: sha256Hex });
});

const hashStream = Effect.fn("Preservation.hashStream")(function* (
  filePath: string,
  length?: number
): Effect.fn.Return<StreamingHashResult, PreservationArchiveIoError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const hasher = sha256.create();
  let bytes = 0;
  const stream = fs.stream(filePath, {
    chunkSize: hashChunkBytes,
    ...(length === undefined ? {} : { bytesToRead: length }),
  });
  yield* Stream.runForEach(stream, (chunk) =>
    Effect.sync(() => {
      hasher.update(chunk);
      bytes += chunk.byteLength;
    })
  ).pipe(Effect.mapError(ioError("hash-read", filePath)));
  return yield* digestResult(hasher, bytes);
});

/**
 * Live bounded-memory streaming hasher.
 *
 * **Example** (Provide streaming hashing)
 *
 * ```ts
 * import { StreamingHasher, StreamingHasherLive } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const effect = StreamingHasher.use((hasher) => hasher.hashFile("/tmp/synthetic.bin")).pipe(
 *   Effect.provide(StreamingHasherLive)
 * )
 * console.log(effect.pipe !== undefined) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const StreamingHasherLive: Layer.Layer<StreamingHasher, never, FileSystem.FileSystem> = Layer.effect(
  StreamingHasher,
  Effect.gen(function* () {
    const runtime = yield* Effect.context<FileSystem.FileSystem>();
    return StreamingHasher.of({
      hashFile: Effect.fn("StreamingHasher.hashFile")((filePath) => hashStream(filePath).pipe(Effect.provide(runtime))),
      hashFilePrefix: Effect.fn("StreamingHasher.hashFilePrefix")((filePath, length) =>
        hashStream(filePath, length).pipe(Effect.provide(runtime))
      ),
    });
  })
);

const fsyncDirectory = Effect.fn("Preservation.fsyncDirectory")(function* (
  directoryPath: string
): Effect.fn.Return<void, PreservationArchiveIoError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  yield* Effect.scoped(
    fs.open(directoryPath, { flag: "r" }).pipe(
      Effect.flatMap((handle) => handle.sync),
      Effect.mapError(ioError("directory-fsync", directoryPath))
    )
  );
});

const appendDurably = Effect.fn("Preservation.appendDurably")(function* (
  filePath: string,
  text: string
): Effect.fn.Return<void, PreservationArchiveIoError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const parent = path.dirname(filePath);
  yield* fs.makeDirectory(parent, { recursive: true }).pipe(Effect.mapError(ioError("mkdir", parent)));
  yield* Effect.scoped(
    fs.open(filePath, { flag: "a+" }).pipe(
      Effect.flatMap((handle) => handle.writeAll(utf8Encoder.encode(`${text}\n`)).pipe(Effect.andThen(handle.sync))),
      Effect.mapError(ioError("append-and-fsync", filePath))
    )
  );
  yield* fsyncDirectory(parent);
});

const occurrenceKey = (row: PreservationManifestRow): string =>
  A.join(
    [row.object.sourceClass, row.object.relativePath, `${row.object.sizeBytes}`, `${row.object.mtimeEpoch}`],
    "\u0000"
  );

const identityKey = (object: PreservationObjectIdentity): string =>
  A.join([object.sourceClass, object.relativePath, `${object.sizeBytes}`, `${object.mtimeEpoch}`], "\u0000");

const readManifest = Effect.fn("Preservation.readManifest")(function* (
  manifestPath: string
): Effect.fn.Return<ReadonlyArray<PreservationManifestRow>, PreservationArchiveIoError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  if (!(yield* fs.exists(manifestPath).pipe(Effect.mapError(ioError("manifest-exists", manifestPath))))) {
    return A.empty<PreservationManifestRow>();
  }
  const text = yield* fs.readFileString(manifestPath).pipe(Effect.mapError(ioError("manifest-read", manifestPath)));
  const lines = pipe(Str.split(/\r?\n/u)(text), A.filter(Str.isNonEmpty));
  return yield* Effect.forEach(lines, (line) =>
    PreservationManifestRowJson.decode(line).pipe(Effect.mapError(ioError("manifest-decode", manifestPath)))
  );
});

const terminalManifestRows = (rows: ReadonlyArray<PreservationManifestRow>): ReadonlyArray<PreservationManifestRow> => {
  const terminal = MutableHashMap.empty<string, PreservationManifestRow>();
  for (const row of rows) {
    MutableHashMap.set(terminal, occurrenceKey(row), row);
  }
  return A.fromIterable(MutableHashMap.values(terminal));
};

/**
 * Construct a durable append-only manifest-store layer for one JSONL path.
 *
 * **Example** (Create a manifest layer)
 *
 * ```ts
 * import { PreservationManifestStoreLive } from "@beep/repo-cli/commands/Corpus"
 *
 * const layer = PreservationManifestStoreLive("/tmp/preservation-manifest.jsonl")
 * console.log(layer.pipe !== undefined) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PreservationManifestStoreLive = (
  manifestPath: string
): Layer.Layer<PreservationManifestStore, never, FileSystem.FileSystem | Path.Path> =>
  Layer.effect(
    PreservationManifestStore,
    Effect.gen(function* () {
      const runtime = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
      const readAll = readManifest(manifestPath).pipe(Effect.provide(runtime));
      return PreservationManifestStore.of({
        append: Effect.fn("PreservationManifestStore.append")((row) =>
          PreservationManifestRowJson.encode(row).pipe(
            Effect.mapError(ioError("manifest-encode", manifestPath)),
            Effect.flatMap((encoded) => appendDurably(manifestPath, encoded)),
            Effect.provide(runtime)
          )
        ),
        readAll,
        terminalRows: readAll.pipe(Effect.map(terminalManifestRows)),
      });
    })
  );

const statSource = Effect.fn("Preservation.statSource")(function* (
  sourceAbs: string
): Effect.fn.Return<O.Option<SourceStabilityObservation>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.stat(sourceAbs).pipe(Effect.map(sourceObservation), Effect.option);
});

const unreadable = (message: string) =>
  PreservationAttemptOutcome.cases.unreadable.make({ kind: "unreadable", message });

const hashExistingPrefix = Effect.fn("Preservation.hashExistingPrefix")(function* (
  sourceAbs: string,
  partialAbs: string,
  length: number
): Effect.fn.Return<
  { readonly hasher: Sha256State; readonly matches: boolean },
  PreservationArchiveIoError,
  FileSystem.FileSystem
> {
  const fs = yield* FileSystem.FileSystem;
  const sourceHasher = sha256.create();
  const partialHasher = sha256.create();
  yield* Stream.runForEach(fs.stream(sourceAbs, { bytesToRead: length, chunkSize: hashChunkBytes }), (chunk) =>
    Effect.sync(() => sourceHasher.update(chunk))
  ).pipe(Effect.mapError(ioError("source-prefix-read", sourceAbs)));
  yield* Stream.runForEach(fs.stream(partialAbs, { bytesToRead: length, chunkSize: hashChunkBytes }), (chunk) =>
    Effect.sync(() => partialHasher.update(chunk))
  ).pipe(Effect.mapError(ioError("destination-prefix-read", partialAbs)));
  return {
    hasher: sourceHasher,
    matches: Str.Equivalence(
      Encoding.encodeHex(sourceHasher.clone().digest()),
      Encoding.encodeHex(partialHasher.digest())
    ),
  };
});

const streamRemainder = Effect.fn("Preservation.streamRemainder")(function* (
  sourceAbs: string,
  partialAbs: string,
  offset: number,
  hasher: Sha256State
): Effect.fn.Return<number, PreservationArchiveIoError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  let copied = 0;
  yield* Effect.scoped(
    fs.open(partialAbs, { flag: offset === 0 ? "w+" : "a+" }).pipe(
      Effect.flatMap((handle) =>
        Effect.gen(function* () {
          yield* Stream.runForEach(fs.stream(sourceAbs, { chunkSize: hashChunkBytes, offset }), (chunk) =>
            Effect.sync(() => {
              hasher.update(chunk);
              copied += chunk.byteLength;
            }).pipe(Effect.andThen(handle.writeAll(chunk)))
          );
          yield* handle.sync;
        })
      ),
      Effect.mapError(ioError("copy-and-fsync", partialAbs))
    )
  );
  return copied;
});

const changedOutcome = (
  statBefore: SourceStabilityObservation,
  statAfter: SourceStabilityObservation
): PreservationAttemptOutcome =>
  PreservationAttemptOutcome.cases["changed-during-copy"].make({ kind: "changed-during-copy", statAfter, statBefore });

const discardStaged = Effect.fn("Preservation.discardStaged")(function* (
  partialAbs: string,
  stagedBytes: number
): Effect.fn.Return<PreservationAttemptOutcome, PreservationArchiveIoError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.truncate(partialAbs).pipe(Effect.mapError(ioError("partial-truncate", partialAbs)));
  return PreservationAttemptOutcome.cases["resume-discarded"].make({
    bytesDiscarded: NonNegativeInt.make(stagedBytes),
    kind: "resume-discarded",
  });
});

const settleFullLengthDestination = Effect.fn("Preservation.settleFullLengthDestination")(function* (
  sourceAbs: string,
  destAbs: string,
  destBytes: number,
  statBefore: SourceStabilityObservation
): Effect.fn.Return<O.Option<PreservationAttemptOutcome>, PreservationArchiveIoError, FileSystem.FileSystem> {
  const sourceHash = yield* hashStream(sourceAbs);
  const destHash = yield* hashStream(destAbs);
  const statAfter = yield* statSource(sourceAbs);
  if (O.isNone(statAfter)) {
    return O.some(unreadable("Source became unreadable during preservation."));
  }
  if (!stabilityEquivalence(statBefore, statAfter.value)) {
    return O.some(changedOutcome(statBefore, statAfter.value));
  }
  if (!Str.Equivalence(sourceHash.sha256, destHash.sha256)) {
    return O.none();
  }
  return O.some(
    PreservationAttemptOutcome.cases["already-complete"].make({
      kind: "already-complete",
      bytesReused: NonNegativeInt.make(destBytes),
      sha256: sourceHash.sha256,
    })
  );
});

const settleExistingDestination = Effect.fn("Preservation.settleExistingDestination")(function* (
  sourceAbs: string,
  destAbs: string,
  partialAbs: string,
  parent: string,
  statBefore: SourceStabilityObservation
): Effect.fn.Return<O.Option<PreservationAttemptOutcome>, PreservationArchiveIoError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const destExists = yield* fs.exists(destAbs).pipe(Effect.mapError(ioError("destination-exists", destAbs)));
  const partialExists = yield* fs.exists(partialAbs).pipe(Effect.mapError(ioError("partial-exists", partialAbs)));
  if (!destExists || partialExists) {
    return O.none();
  }
  const destInfo = yield* fs.stat(destAbs).pipe(Effect.mapError(ioError("destination-stat", destAbs)));
  const destBytes = Number(destInfo.size);
  if (destBytes === statBefore.sizeBytes) {
    const settled = yield* settleFullLengthDestination(sourceAbs, destAbs, destBytes, statBefore);
    if (O.isSome(settled)) {
      return settled;
    }
  }
  yield* fs.rename(destAbs, partialAbs).pipe(Effect.mapError(ioError("partial-stage", destAbs)));
  yield* fsyncDirectory(parent);
  return O.none();
});

interface StagedPrefix {
  readonly hasher: Sha256State;
  readonly outcome: O.Option<PreservationAttemptOutcome>;
  readonly stagedBytes: number;
}

const stagedPrefixFor = Effect.fn("Preservation.stagedPrefixFor")(function* (
  sourceAbs: string,
  partialAbs: string,
  sourceSizeBytes: number
): Effect.fn.Return<StagedPrefix, PreservationArchiveIoError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const stagedExists = yield* fs.exists(partialAbs).pipe(Effect.mapError(ioError("partial-exists", partialAbs)));
  const stagedBytes = stagedExists
    ? Number((yield* fs.stat(partialAbs).pipe(Effect.mapError(ioError("partial-stat", partialAbs)))).size)
    : 0;
  if (stagedBytes > sourceSizeBytes) {
    return { hasher: sha256.create(), outcome: O.some(yield* discardStaged(partialAbs, stagedBytes)), stagedBytes: 0 };
  }
  const prefix =
    stagedBytes === 0
      ? { hasher: sha256.create(), matches: true }
      : yield* hashExistingPrefix(sourceAbs, partialAbs, stagedBytes);
  if (!prefix.matches) {
    return {
      hasher: prefix.hasher,
      outcome: O.some(yield* discardStaged(partialAbs, stagedBytes)),
      stagedBytes: 0,
    };
  }
  return { hasher: prefix.hasher, outcome: O.none(), stagedBytes };
});

const promoteVerifiedCopy = Effect.fn("Preservation.promoteVerifiedCopy")(function* (
  sourceAbs: string,
  destAbs: string,
  partialAbs: string,
  parent: string,
  statBefore: SourceStabilityObservation,
  staged: StagedPrefix,
  afterPayload: (sourceAbs: string, partialAbs: string) => Effect.Effect<void>
): Effect.fn.Return<PreservationAttemptOutcome, PreservationArchiveIoError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const bytesCopied = yield* streamRemainder(sourceAbs, partialAbs, staged.stagedBytes, staged.hasher);
  yield* afterPayload(sourceAbs, partialAbs);
  const statAfterOption = yield* statSource(sourceAbs);
  if (O.isNone(statAfterOption)) {
    return unreadable("Source became unreadable during preservation.");
  }
  const statAfter = statAfterOption.value;
  if (!stabilityEquivalence(statBefore, statAfter)) {
    return changedOutcome(statBefore, statAfter);
  }
  const sourceHash = yield* digestResult(staged.hasher, staged.stagedBytes + bytesCopied);
  const destinationHash = yield* hashStream(partialAbs);
  if (!Str.Equivalence(sourceHash.sha256, destinationHash.sha256)) {
    return yield* PreservationArchiveIoError.make({
      cause: `source=${sourceHash.sha256} destination=${destinationHash.sha256} bytes=${destinationHash.bytes}`,
      message: "The staged destination failed its copy-boundary digest verification.",
      operation: "copy-verify",
      path: partialAbs,
    });
  }
  yield* fs.rename(partialAbs, destAbs).pipe(Effect.mapError(ioError("atomic-promote", destAbs)));
  yield* fsyncDirectory(parent);
  return staged.stagedBytes === 0
    ? PreservationAttemptOutcome.cases.copied.make({
        bytesCopied: NonNegativeInt.make(bytesCopied),
        kind: "copied",
        sha256: sourceHash.sha256,
        statAfter,
        statBefore,
      })
    : PreservationAttemptOutcome.cases["resume-completed"].make({
        bytesCopied: NonNegativeInt.make(bytesCopied),
        bytesReused: NonNegativeInt.make(staged.stagedBytes),
        kind: "resume-completed",
        sha256: sourceHash.sha256,
        statAfter,
        statBefore,
      });
});

/**
 * Construct an atomic archive-writer layer, optionally injecting a synthetic
 * post-payload-sync test hook.
 *
 * **Example** (Create the default writer layer)
 *
 * ```ts
 * import { makeArchiveWriterLive } from "@beep/repo-cli/commands/Corpus"
 *
 * const layer = makeArchiveWriterLive()
 * console.log(layer.pipe !== undefined) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeArchiveWriterLive = (options?: {
  readonly afterPayloadSync?: ((sourceAbs: string, partialAbs: string) => Effect.Effect<void>) | undefined;
}): Layer.Layer<ArchiveWriter, never, FileSystem.FileSystem | Path.Path> =>
  Layer.effect(
    ArchiveWriter,
    Effect.gen(function* () {
      const runtime = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
      const afterPayloadSync = pipe(
        O.fromNullishOr(options?.afterPayloadSync),
        O.getOrElse(() => (_sourceAbs: string, _partialAbs: string) => Effect.void)
      );
      const archiveObject = Effect.fn("ArchiveWriter.archiveObject")(function* (
        sourceAbs: string,
        destAbs: string,
        identity: PreservationObjectIdentity
      ): Effect.fn.Return<PreservationAttemptOutcome, PreservationArchiveIoError, FileSystem.FileSystem | Path.Path> {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const statBeforeOption = yield* statSource(sourceAbs);
        if (O.isNone(statBeforeOption)) {
          return unreadable("Source could not be opened for preservation.");
        }
        const statBefore = statBeforeOption.value;
        if (statBefore.sizeBytes !== identity.sizeBytes) {
          return changedOutcome(
            SourceStabilityObservation.make({ mtimeEpoch: identity.mtimeEpoch, sizeBytes: identity.sizeBytes }),
            statBefore
          );
        }
        const parent = path.dirname(destAbs);
        const partialAbs = `${destAbs}${partialSuffix}`;
        yield* fs.makeDirectory(parent, { recursive: true }).pipe(Effect.mapError(ioError("mkdir", parent)));
        const settled = yield* settleExistingDestination(sourceAbs, destAbs, partialAbs, parent, statBefore);
        if (O.isSome(settled)) {
          return settled.value;
        }
        const staged = yield* stagedPrefixFor(sourceAbs, partialAbs, statBefore.sizeBytes);
        if (O.isSome(staged.outcome)) {
          return staged.outcome.value;
        }
        return yield* promoteVerifiedCopy(sourceAbs, destAbs, partialAbs, parent, statBefore, staged, afterPayloadSync);
      });
      return ArchiveWriter.of({
        archiveObject: Effect.fn("ArchiveWriter.archiveObject.provided")((sourceAbs, destAbs, identity) =>
          archiveObject(sourceAbs, destAbs, identity).pipe(Effect.provide(runtime))
        ),
      });
    })
  );

/**
 * Live atomic archive-writer layer.
 *
 * **Example** (Inspect the writer layer)
 *
 * ```ts
 * import { ArchiveWriterLive } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(ArchiveWriterLive.pipe !== undefined) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ArchiveWriterLive: Layer.Layer<ArchiveWriter, never, FileSystem.FileSystem | Path.Path> =
  makeArchiveWriterLive();

const expectedDigest = (row: PreservationManifestRow): O.Option<Sha256Hex> =>
  PreservationAttemptOutcome.match(row.outcome, {
    "already-complete": (outcome) => O.some(outcome.sha256),
    "changed-during-copy": () => O.none<Sha256Hex>(),
    copied: (outcome) => O.some(outcome.sha256),
    "resume-completed": (outcome) => O.some(outcome.sha256),
    "resume-discarded": () => O.none<Sha256Hex>(),
    unreadable: () => O.none<Sha256Hex>(),
  });

const verifyRow = Effect.fn("Preservation.verifyRow")(function* (
  archiveRoot: string,
  row: PreservationManifestRow
): Effect.fn.Return<PreservationVerificationRow, PreservationArchiveIoError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const destination = path.join(archiveRoot, row.destRelativePath);
  const verifiedAt = DateTime.formatIso(yield* DateTime.now);
  const exists = yield* fs.exists(destination).pipe(Effect.mapError(ioError("verify-exists", destination)));
  if (!exists) {
    return PreservationVerificationRow.make({
      destRelativePath: row.destRelativePath,
      object: row.object,
      outcome: PreservationVerificationOutcome.cases["missing-destination"].make({ kind: "missing-destination" }),
      verifiedAt,
    });
  }
  const actualBytes = Number(
    (yield* fs.stat(destination).pipe(Effect.mapError(ioError("verify-stat", destination)))).size
  );
  if (actualBytes !== row.object.sizeBytes) {
    return PreservationVerificationRow.make({
      destRelativePath: row.destRelativePath,
      object: row.object,
      outcome: PreservationVerificationOutcome.cases["size-mismatch"].make({
        actualBytes: NonNegativeInt.make(actualBytes),
        expectedBytes: row.object.sizeBytes,
        kind: "size-mismatch",
      }),
      verifiedAt,
    });
  }
  const actual = yield* hashStream(destination);
  const expected = expectedDigest(row);
  if (O.isNone(expected) || !Str.Equivalence(expected.value, actual.sha256)) {
    return PreservationVerificationRow.make({
      destRelativePath: row.destRelativePath,
      object: row.object,
      outcome: PreservationVerificationOutcome.cases["hash-mismatch"].make({
        actualSha256: actual.sha256,
        expectedSha256: O.getOrElse(expected, () => Sha256Hex.make(Str.repeat(64)("0"))),
        kind: "hash-mismatch",
      }),
      verifiedAt,
    });
  }
  return PreservationVerificationRow.make({
    destRelativePath: row.destRelativePath,
    object: row.object,
    outcome: PreservationVerificationOutcome.cases.verified.make({ kind: "verified", sha256: actual.sha256 }),
    verifiedAt,
  });
});

const verificationSummary = (rows: ReadonlyArray<PreservationVerificationRow>): PreservationVerificationSummary =>
  PreservationVerificationSummary.make({
    bytesVerified: NonNegativeInt.make(
      A.reduce(rows, 0, (total, row) => (row.outcome.kind === "verified" ? total + row.object.sizeBytes : total))
    ),
    hashMismatched: NonNegativeInt.make(A.filter(rows, (row) => row.outcome.kind === "hash-mismatch").length),
    missing: NonNegativeInt.make(A.filter(rows, (row) => row.outcome.kind === "missing-destination").length),
    rowsChecked: NonNegativeInt.make(A.length(rows)),
    sizeMismatched: NonNegativeInt.make(A.filter(rows, (row) => row.outcome.kind === "size-mismatch").length),
    verified: NonNegativeInt.make(A.filter(rows, (row) => row.outcome.kind === "verified").length),
  });

/**
 * Construct a fresh manifest-reparse verifier layer.
 *
 * **Example** (Create a verifier layer)
 *
 * ```ts
 * import { PreservationVerifierLive } from "@beep/repo-cli/commands/Corpus"
 *
 * const layer = PreservationVerifierLive("/tmp/preservation-manifest.jsonl")
 * console.log(layer.pipe !== undefined) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PreservationVerifierLive = (
  manifestPath: string
): Layer.Layer<PreservationVerifier, never, FileSystem.FileSystem | Path.Path> =>
  Layer.effect(
    PreservationVerifier,
    Effect.gen(function* () {
      const runtime = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
      const verify = Effect.fn("PreservationVerifier.verify")(function* (
        archiveRoot: string
      ): Effect.fn.Return<
        PreservationVerificationReport,
        PreservationArchiveIoError,
        FileSystem.FileSystem | Path.Path
      > {
        const rows = terminalManifestRows(yield* readManifest(manifestPath));
        const verifiedRows = yield* Effect.forEach(rows, (row) => verifyRow(archiveRoot, row), { concurrency: 1 });
        return PreservationVerificationReport.make({ rows: verifiedRows, summary: verificationSummary(verifiedRows) });
      });
      return PreservationVerifier.of({
        verify: Effect.fn("PreservationVerifier.verify.provided")((archiveRoot: string) =>
          verify(archiveRoot).pipe(Effect.provide(runtime))
        ),
      });
    })
  );

const isExcludedT7Path = (relativePath: string): boolean => {
  const first = pipe(Str.split(/[\\/]/u)(relativePath), A.head);
  return O.exists(
    first,
    (segment) => Str.Equivalence(segment, "cognee-restic") || Str.Equivalence(segment, "System Volume Information")
  );
};

const scopedSourceFiles = Effect.fn("Preservation.scopedSourceFiles")(function* (
  options: T7PreservationOptions
): Effect.fn.Return<
  ReadonlyArray<{
    readonly absolute: string;
    readonly identity: PreservationObjectIdentity;
    readonly relative: string;
  }>,
  PreservationArchiveIoError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const t7Root = path.resolve(options.t7Root);
  const salvageRoot = path.join(t7Root, sourceDirectoryName);
  const relativeEntries = yield* fs
    .readDirectory(salvageRoot, { recursive: true })
    .pipe(Effect.mapError(ioError("scope-walk", salvageRoot)));
  const salvageEntries = yield* Effect.forEach(
    relativeEntries,
    Effect.fnUntraced(function* (relative) {
      if (isExcludedT7Path(relative)) return O.none();
      const absolute = path.join(salvageRoot, relative);
      const info = yield* fs.stat(absolute).pipe(Effect.mapError(ioError("scope-stat", absolute)));
      return info.type === "File"
        ? O.some({ absolute, identity: objectIdentity(info, relative, "salvage-tree"), relative })
        : O.none();
    }),
    { concurrency: 1 }
  );
  const salvageFiles = A.getSomes(salvageEntries);
  const rootArchive = path.join(t7Root, rootArchiveName);
  const rootInfo = yield* fs.stat(rootArchive).pipe(Effect.mapError(ioError("root-archive-stat", rootArchive)));
  return A.append(salvageFiles, {
    absolute: rootArchive,
    identity: objectIdentity(rootInfo, rootArchiveName, "root-archive-object"),
    relative: rootArchiveName,
  });
});

const destinationFreeBytes = Effect.fn("Preservation.destinationFreeBytes")(function* (
  corpusRoot: string
): Effect.fn.Return<number, PreservationArchiveIoError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runCapturedStreams({
    args: ["-Pk", "--", corpusRoot],
    command: "df",
    cwd: corpusRoot,
    extendEnv: true,
    trim: true,
  }).pipe(Effect.mapError(ioError("capacity-stat", corpusRoot)));
  if (result.exitCode !== 0) {
    return yield* PreservationArchiveIoError.make({
      cause: result.stderr,
      message: "Destination free-space measurement failed.",
      operation: "capacity-stat",
      path: corpusRoot,
    });
  }
  const lines = pipe(Str.split(/\r?\n/u)(result.stdout), A.filter(Str.isNonEmpty));
  const fields = pipe(A.last(lines), O.map(Str.split(/\s+/u)), O.getOrElse(A.empty<string>));
  const availableKiB = A.get(fields, 3);
  if (O.isNone(availableKiB)) {
    return yield* PreservationArchiveIoError.make({
      cause: result.stdout,
      message: "Destination free-space output was malformed.",
      operation: "capacity-decode",
      path: corpusRoot,
    });
  }
  const parsed = yield* decodeNumber(availableKiB.value).pipe(Effect.mapError(ioError("capacity-decode", corpusRoot)));
  return NonNegativeInt.make(parsed * 1024);
});

/**
 * Live T7 scope census and destination-capacity layer.
 *
 * **Example** (Inspect the capacity layer)
 *
 * ```ts
 * import { CapacityPreflightServiceLive } from "@beep/repo-cli/commands/Corpus"
 *
 * console.log(CapacityPreflightServiceLive.pipe !== undefined) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CapacityPreflightServiceLive: Layer.Layer<CapacityPreflightService, never, PreservationRequirements> =
  Layer.effect(
    CapacityPreflightService,
    Effect.gen(function* () {
      const runtime = yield* Effect.context<PreservationRequirements>();
      const measure = Effect.fn("CapacityPreflightService.measure")(function* (
        options: T7PreservationOptions
      ): Effect.fn.Return<CapacityMeasurement, PreservationArchiveIoError, PreservationRequirements> {
        const files = yield* scopedSourceFiles(options);
        const sourceBytes = A.reduce(files, 0, (total, file) => total + file.identity.sizeBytes);
        const corpusRoot = (yield* Path.Path).resolve(options.corpusRoot);
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory(corpusRoot, { recursive: true }).pipe(Effect.mapError(ioError("mkdir", corpusRoot)));
        return CapacityMeasurement.make({
          destFreeBytes: NonNegativeInt.make(yield* destinationFreeBytes(corpusRoot)),
          measuredAt: DateTime.formatIso(yield* DateTime.now),
          objectCount: NonNegativeInt.make(A.length(files)),
          requiredBytes: NonNegativeInt.make(sourceBytes),
          sourceBytes: NonNegativeInt.make(sourceBytes),
        });
      });
      return CapacityPreflightService.of({
        measure: Effect.fn("CapacityPreflightService.measure.provided")((options: T7PreservationOptions) =>
          measure(options).pipe(Effect.provide(runtime))
        ),
      });
    })
  );

const writePreflight = Effect.fn("Preservation.writePreflight")(function* (
  corpusRoot: string,
  preflight: CapacityPreflight
): Effect.fn.Return<void, PreservationArchiveIoError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const statePath = preflightPathFor(corpusRoot, path);
  const encoded = yield* CapacityPreflightJson.encode(preflight).pipe(
    Effect.mapError(ioError("preflight-encode", statePath))
  );
  yield* fs
    .makeDirectory(path.dirname(statePath), { recursive: true })
    .pipe(Effect.mapError(ioError("mkdir", statePath)));
  yield* fs
    .writeFileString(statePath, encoded, { flag: "w" })
    .pipe(Effect.mapError(ioError("preflight-write", statePath)));
  yield* Effect.scoped(
    fs.open(statePath, { flag: "r" }).pipe(
      Effect.flatMap((handle) => handle.sync),
      Effect.mapError(ioError("preflight-fsync", statePath))
    )
  );
  yield* fsyncDirectory(path.dirname(statePath));
});

/** Measure and persist a proposed T7 preservation preflight. @since 0.0.0 */
export const preflightT7PreservationImpl = Effect.fn("CorpusCommandService.preflightT7Preservation")(function* (
  options: T7PreservationOptions
): Effect.fn.Return<CapacityPreflight, PreservationArchiveIoError, PreservationRequirements> {
  const files = yield* scopedSourceFiles(options);
  const sourceBytes = A.reduce(files, 0, (total, file) => total + file.identity.sizeBytes);
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const corpusRoot = path.resolve(options.corpusRoot);
  yield* fs.makeDirectory(corpusRoot, { recursive: true }).pipe(Effect.mapError(ioError("mkdir", corpusRoot)));
  const measurement = CapacityMeasurement.make({
    destFreeBytes: NonNegativeInt.make(yield* destinationFreeBytes(corpusRoot)),
    measuredAt: DateTime.formatIso(yield* DateTime.now),
    objectCount: NonNegativeInt.make(A.length(files)),
    requiredBytes: NonNegativeInt.make(sourceBytes),
    sourceBytes: NonNegativeInt.make(sourceBytes),
  });
  const preflight = CapacityPreflight.cases.proposed.make({ kind: "proposed", measurement });
  yield* writePreflight(options.corpusRoot, preflight);
  yield* printLines([
    `preservation preflight: objects=${measurement.objectCount}`,
    `preservation preflight: sourceBytes=${measurement.sourceBytes}`,
    `preservation preflight: requiredBytes=${measurement.requiredBytes}`,
    `preservation preflight: destFreeBytes=${measurement.destFreeBytes}`,
    "preservation preflight: state=proposed (approve a ceiling before the run)",
  ]);
  return preflight;
});

const readPreflightState = Effect.fn("Preservation.readPreflightState")(function* (
  corpusRoot: string,
  missingMessage: string
): Effect.fn.Return<CapacityPreflight, PreservationCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const statePath = preflightPathFor(corpusRoot, path);
  if (!(yield* fs.exists(statePath).pipe(Effect.mapError(ioError("preflight-exists", statePath))))) {
    return yield* PreservationPreflightMissingError.make({ message: missingMessage });
  }
  return yield* fs.readFileString(statePath).pipe(
    Effect.mapError(ioError("preflight-read", statePath)),
    Effect.flatMap((text) =>
      CapacityPreflightJson.decode(text).pipe(Effect.mapError(ioError("preflight-decode", statePath)))
    )
  );
});

/** Persist operator approval over the previously measured byte ceiling. @since 0.0.0 */
export const approveT7PreservationImpl = Effect.fn("CorpusCommandService.approveT7Preservation")(function* (
  corpusRoot: string,
  ceilingBytes: number,
  approvedBy: string
): Effect.fn.Return<CapacityPreflight, PreservationCommandError, FileSystem.FileSystem | Path.Path> {
  const proposed = yield* readPreflightState(corpusRoot, "Run preservation preflight before approval.");
  const approved = CapacityPreflight.cases.approved.make({
    approvedAt: DateTime.formatIso(yield* DateTime.now),
    approvedBy,
    ceilingBytes: NonNegativeInt.make(ceilingBytes),
    kind: "approved",
    measurement: proposed.measurement,
  });
  yield* writePreflight(corpusRoot, approved);
  yield* printLines([`preservation approve: ceilingBytes=${approved.ceilingBytes} approvedBy=${approved.approvedBy}`]);
  return approved;
});

const loadApprovedPreflight = Effect.fn("Preservation.loadApprovedPreflight")(function* (
  corpusRoot: string
): Effect.fn.Return<CapacityPreflight, PreservationCommandError, FileSystem.FileSystem | Path.Path> {
  const decoded = yield* readPreflightState(corpusRoot, "Run preservation preflight before the archive run.");
  if (decoded.kind !== "approved") {
    return yield* PreservationPreflightUnapprovedError.make({
      message: "Approve the capacity ceiling before the archive run.",
    });
  }
  if (decoded.measurement.requiredBytes > decoded.ceilingBytes) {
    return yield* PreservationCeilingExceededError.make({
      ceilingBytes: decoded.ceilingBytes,
      measuredBytes: decoded.measurement.requiredBytes,
      message: "The measured preservation requirement exceeds the approved ceiling.",
    });
  }
  return decoded;
});

const outcomeSha = (outcome: PreservationAttemptOutcome): O.Option<Sha256Hex> =>
  PreservationAttemptOutcome.match(outcome, {
    "already-complete": (value) => O.some(value.sha256),
    "changed-during-copy": () => O.none<Sha256Hex>(),
    copied: (value) => O.some(value.sha256),
    "resume-completed": (value) => O.some(value.sha256),
    "resume-discarded": () => O.none<Sha256Hex>(),
    unreadable: () => O.none<Sha256Hex>(),
  });

const appendPassProvenance = Effect.fn("Preservation.appendPassProvenance")(function* (
  corpusRoot: string,
  row: PreservationManifestRow
): Effect.fn.Return<void, PreservationArchiveIoError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const sha = outcomeSha(row.outcome);
  if (O.isNone(sha)) {
    return;
  }
  const ledgerPath = path.join(corpusRoot, "raw", "provenance.jsonl");
  const provenance = T7ArchiveProvenanceRecord.make({
    archivedAt: row.archivedAt,
    destRelativePath: row.destRelativePath,
    mtimeEpoch: row.object.mtimeEpoch,
    mtimeIso: row.object.mtimeIso,
    record: "t7-archive/v1",
    relativePath: row.object.relativePath,
    sha256: sha.value,
    sizeBytes: row.object.sizeBytes,
    sourceClass: row.object.sourceClass,
  });
  const encoded = yield* CorpusLedgerRecordJson.encode(provenance).pipe(
    Effect.mapError(ioError("provenance-encode", ledgerPath))
  );
  yield* appendDurably(ledgerPath, encoded);
});

const archiveObjectToTerminal = Effect.fn("Preservation.archiveObjectToTerminal")(function* (
  writer: ArchiveWriterShape,
  manifest: PreservationManifestStoreShape,
  attemptCounts: MutableHashMap.MutableHashMap<string, number>,
  sourceAbs: string,
  destAbs: string,
  destRelativePath: string,
  identity: PreservationObjectIdentity
): Effect.fn.Return<A.NonEmptyReadonlyArray<PreservationManifestRow>, PreservationArchiveIoError> {
  const key = identityKey(identity);
  const attemptOnce = Effect.fnUntraced(function* () {
    const attempt = 1 + O.getOrElse(MutableHashMap.get(attemptCounts, key), () => 0);
    MutableHashMap.set(attemptCounts, key, attempt);
    const outcome = yield* writer.archiveObject(sourceAbs, destAbs, identity);
    const row = PreservationManifestRow.make({
      archivedAt: DateTime.formatIso(yield* DateTime.now),
      attempt: NonNegativeInt.make(attempt),
      destRelativePath,
      object: identity,
      outcome,
    });
    yield* manifest.append(row);
    return { attempt, row };
  });
  const first = yield* attemptOnce();
  let rows = A.of(first.row);
  let latest = first;
  while (
    (latest.row.outcome.kind === "resume-discarded" || latest.row.outcome.kind === "changed-during-copy") &&
    latest.attempt < maxAttemptsPerObject
  ) {
    latest = yield* attemptOnce();
    rows = A.append(rows, latest.row);
  }
  return rows;
});

/** Run the approved T7 preservation archive operation. @since 0.0.0 */
export const runT7PreservationImpl = Effect.fn("CorpusCommandService.runT7Preservation")(function* (
  options: T7PreservationOptions
): Effect.fn.Return<PreservationRunSummary, PreservationCommandError, PreservationRequirements> {
  yield* loadApprovedPreflight(options.corpusRoot);
  const path = yield* Path.Path;
  const archiveRoot = archiveRootFor(options.corpusRoot, path);
  const manifestPath = manifestPathFor(options.corpusRoot, path);
  const services = Layer.mergeAll(ArchiveWriterLive, PreservationManifestStoreLive(manifestPath));
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const serviceContext = yield* Layer.build(services);
      return yield* Effect.gen(function* () {
        const writer = yield* ArchiveWriter;
        const manifest = yield* PreservationManifestStore;
        const files = yield* scopedSourceFiles(options);
        const priorRows = yield* manifest.readAll;
        const attemptCounts = MutableHashMap.empty<string, number>();
        for (const row of priorRows) {
          const key = occurrenceKey(row);
          MutableHashMap.set(attemptCounts, key, 1 + O.getOrElse(MutableHashMap.get(attemptCounts, key), () => 0));
        }
        let passed = 0;
        let unapproved = 0;
        let attempted = 0;
        for (const file of files) {
          const destRelativePath =
            file.identity.sourceClass === "root-archive-object"
              ? path.join("root-archive-object", rootArchiveName)
              : path.join("salvage-tree", file.relative);
          const destAbs = path.join(archiveRoot, destRelativePath);
          const rows = yield* archiveObjectToTerminal(
            writer,
            manifest,
            attemptCounts,
            file.absolute,
            destAbs,
            destRelativePath,
            file.identity
          );
          attempted += A.length(rows);
          const terminalRow = A.lastNonEmpty(rows);
          if (isPreservationPassKind(terminalRow.outcome.kind)) {
            passed += 1;
            yield* appendPassProvenance(options.corpusRoot, terminalRow);
          } else {
            unapproved += 1;
          }
        }
        const summary = PreservationRunSummary.make({
          attempted: NonNegativeInt.make(attempted),
          passed: NonNegativeInt.make(passed),
          unapproved: NonNegativeInt.make(unapproved),
        });
        yield* printLines([
          `preservation run: attempted=${summary.attempted} passed=${summary.passed} unapproved=${summary.unapproved}`,
        ]);
        if (summary.unapproved > 0) {
          return yield* PreservationUnapprovedRowsError.make({
            message: "The archive run left unapproved terminal manifest rows; preservation did not pass.",
            unapprovedRows: summary.unapproved,
          });
        }
        return summary;
      }).pipe(Effect.provide(serviceContext));
    })
  );
});

/** Independently reparse and verify the terminal destination manifest. @since 0.0.0 */
export const verifyT7PreservationImpl = Effect.fn("CorpusCommandService.verifyT7Preservation")(function* (
  corpusRoot: string
): Effect.fn.Return<PreservationVerificationReport, PreservationCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const archiveRoot = archiveRootFor(corpusRoot, path);
  const report = yield* Effect.scoped(
    Effect.gen(function* () {
      const verifierContext = yield* Layer.build(PreservationVerifierLive(manifestPathFor(corpusRoot, path)));
      return yield* PreservationVerifier.use((verifier) => verifier.verify(archiveRoot)).pipe(
        Effect.provide(verifierContext)
      );
    })
  );
  yield* printLines([
    `preservation verify: rows=${report.summary.rowsChecked} verified=${report.summary.verified} missing=${report.summary.missing} sizeMismatched=${report.summary.sizeMismatched} hashMismatched=${report.summary.hashMismatched}`,
  ]);
  const failedRows = report.summary.rowsChecked - report.summary.verified;
  if (failedRows > 0) {
    return yield* PreservationVerificationFailure.make({
      failedRows: NonNegativeInt.make(failedRows),
      message: "Independent preservation verification found non-verified terminal rows.",
    });
  }
  return report;
});
