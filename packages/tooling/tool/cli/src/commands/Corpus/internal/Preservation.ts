/**
 * Live services and runners for the T7 preservation gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import * as O from "@beep/utils/Option";
import { sha256 } from "@noble/hashes/sha2.js";
import { DateTime, Effect, Encoding, FileSystem, Layer, MutableHashMap, MutableRef, Path, pipe, Stream } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { printLines } from "../../../internal/cli/Printer.ts";
import { runCapturedStreams } from "../../../internal/process/StepExec.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
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
  ArchiveWriterPayloadSyncHookInput,
  CapacityMeasurement,
  CapacityPreflight,
  CapacityPreflightJson,
  CorpusLedgerRecordJson,
  InheritedLossRow,
  PreservationAttemptOutcome,
  PreservationManifestRow,
  PreservationManifestRowJson,
  PreservationObjectIdentity,
  PreservationRunSummary,
  PreservationVerificationOutcome,
  PreservationVerificationReport,
  PreservationVerificationRow,
  PreservationVerificationSummary,
  SourceStabilityObservation,
  StreamingHashResult,
  T7ArchiveProvenanceRecord,
  T7PreservationOptions,
} from "./Preservation.schemas.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { PreservationCommandError } from "../Corpus.errors.ts";
import type { ArchiveWriterShape, PreservationManifestStoreShape } from "./Preservation.contracts.ts";
import type { ArchiveWriterLiveOptions, CorpusLedgerRecord } from "./Preservation.schemas.ts";

const $I = $RepoCliId.create("commands/Corpus/internal/Preservation");

const archiveDirectoryName = "t7-salvage-2026-08-10";
const sourceDirectoryName = "oppold-salvage-2026-08-10";
const rootArchiveName = "oppold-corpus.zip";
const manifestName = "preservation-manifest.jsonl";
const preflightName = "preservation-preflight.json";
const inheritedLossName = "inherited-loss.jsonl";
const partialSuffix = ".preservation-partial";
const hashChunkBytes = 1024 * 1024;
// Bar v2 stops-and-reports rather than spinning: after this many attempts the
// last unapproved row (changed-during-copy / resume-discarded) stands terminal.
const maxAttemptsPerObject = 5;
const utf8Encoder = new TextEncoder();
const decodeSha256 = S.decodeUnknownEffect(Sha256Hex);
const decodeNumber = S.decodeUnknownEffect(S.FiniteFromString);
const stabilityEquivalence = S.toEquivalence(SourceStabilityObservation);
const objectIdentityEquivalence = S.toEquivalence(PreservationObjectIdentity);
const inheritedLossRowsEquivalence = S.toEquivalence(S.Array(InheritedLossRow));
const isT7ArchiveProvenanceRecord = S.is(T7ArchiveProvenanceRecord);
type Sha256State = ReturnType<typeof sha256.create>;

class CollectorManifestRecord extends S.Class<CollectorManifestRecord>($I`CollectorManifestRecord`)(
  {
    dst: S.OptionFromOptionalKey(S.NonEmptyString),
    size: S.OptionFromOptionalKey(NonNegativeInt),
    status: S.Literals(["copied", "error", "excluded-secret", "resumed"]),
  },
  $I.annote("CollectorManifestRecord", {
    description:
      "Minimal decoded collector-ledger row used to reconcile successful destinations and inherited failures.",
  })
) {}

class CollectorReconciliationSummary extends S.Class<CollectorReconciliationSummary>(
  $I`CollectorReconciliationSummary`
)(
  {
    collectorErrors: NonNegativeInt,
    deliberateExclusions: NonNegativeInt,
    missingDestinations: NonNegativeInt,
    reconciledDestinations: NonNegativeInt,
    sizeMismatches: NonNegativeInt,
  },
  $I.annote("CollectorReconciliationSummary", {
    description:
      "Aggregate collector-manifest reconciliation without corpus filenames or other client-bearing evidence.",
  })
) {}

const CollectorManifestRecordJson = JsonStringCodec(CollectorManifestRecord);
const InheritedLossRowJson = JsonStringCodec(InheritedLossRow);

type PreservationRequirements = FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner;
type ApprovedCapacityPreflight = Extract<CapacityPreflight, { readonly kind: "approved" }>;

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

const inheritedLossPathFor = (corpusRoot: string, path: Path.Path): string =>
  path.join(archiveRootFor(corpusRoot, path), inheritedLossName);

const normalizedRelativePath = (path: Path.Path, root: string, candidate: string): string =>
  pipe(path.relative(path.resolve(root), path.resolve(candidate)), Str.replaceAll("\\", "/"));

const isContainedPath = (path: Path.Path, root: string, candidate: string): boolean => {
  const relative = normalizedRelativePath(path, root, candidate);
  return (
    relative === "" ||
    relative === "." ||
    (!path.isAbsolute(relative) && relative !== ".." && !Str.startsWith("../")(relative))
  );
};

const sourceObservation = (info: FileSystem.File.Info): SourceStabilityObservation => {
  const mtimeEpoch = pipe(
    info.mtime,
    O.map((mtime) => DateTime.toEpochMillis(DateTime.makeUnsafe(mtime))),
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
    ...O.getSomesStruct({ bytesToRead: O.fromUndefinedOr(length) }),
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

const ensureDurableParent = Effect.fn("Preservation.ensureDurableParent")(function* (
  filePath: string
): Effect.fn.Return<string, PreservationArchiveIoError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const parent = path.dirname(filePath);
  yield* fs.makeDirectory(parent, { recursive: true }).pipe(Effect.mapError(ioError("mkdir", parent)));
  return parent;
});

const appendDurably = Effect.fn("Preservation.appendDurably")(function* (
  filePath: string,
  text: string
): Effect.fn.Return<void, PreservationArchiveIoError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const parent = yield* ensureDurableParent(filePath);
  yield* Effect.scoped(
    fs.open(filePath, { flag: "a+" }).pipe(
      Effect.flatMap((handle) => handle.writeAll(utf8Encoder.encode(`${text}\n`)).pipe(Effect.andThen(handle.sync))),
      Effect.mapError(ioError("append-and-fsync", filePath))
    )
  );
  yield* fsyncDirectory(parent);
});

const writeFileDurably = Effect.fn("Preservation.writeFileDurably")(function* (
  filePath: string,
  text: string
): Effect.fn.Return<void, PreservationArchiveIoError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const parent = yield* ensureDurableParent(filePath);
  const partialPath = `${filePath}${partialSuffix}`;
  yield* Effect.scoped(
    fs.open(partialPath, { flag: "w+" }).pipe(
      Effect.flatMap((handle) => handle.writeAll(utf8Encoder.encode(text)).pipe(Effect.andThen(handle.sync))),
      Effect.mapError(ioError("write-and-fsync", partialPath))
    )
  );
  yield* fs.rename(partialPath, filePath).pipe(Effect.mapError(ioError("atomic-promote", filePath)));
  yield* fsyncDirectory(parent);
});

const occurrenceKey = (row: PreservationManifestRow): string =>
  A.join([row.object.sourceClass, row.object.relativePath], "\u0000");

const identityKey = (object: PreservationObjectIdentity): string =>
  A.join([object.sourceClass, object.relativePath], "\u0000");

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
 * @param manifestPath - Destination JSONL path whose appends and directory entries are durably synced.
 * @returns A layer providing append, full-read, and last-terminal-row manifest operations.
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
  expectedSizeBytes: number,
  hasher: Sha256State
): Effect.fn.Return<number, PreservationArchiveIoError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  let copied = 0;
  yield* Effect.scoped(
    fs.open(partialAbs, { flag: offset === 0 ? "w+" : "a+" }).pipe(
      Effect.flatMap(
        Effect.fnUntraced(function* (handle) {
          yield* Stream.runForEach(
            fs.stream(sourceAbs, {
              bytesToRead: Math.max(0, expectedSizeBytes - offset),
              chunkSize: hashChunkBytes,
              offset,
            }),
            (chunk) =>
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

const sourceStabilityFailure = (
  statBefore: SourceStabilityObservation,
  observed: O.Option<SourceStabilityObservation>
): O.Option<PreservationAttemptOutcome> =>
  O.match(observed, {
    onNone: () => O.some(unreadable("Source became unreadable during preservation.")),
    onSome: (stat) => (stabilityEquivalence(statBefore, stat) ? O.none() : O.some(changedOutcome(statBefore, stat))),
  });

const hashesProveAlreadyComplete = (
  firstSourceHash: StreamingHashResult,
  secondSourceHash: StreamingHashResult,
  destHash: StreamingHashResult,
  sourceBytes: number,
  destBytes: number
): boolean =>
  firstSourceHash.bytes === sourceBytes &&
  secondSourceHash.bytes === sourceBytes &&
  destHash.bytes === destBytes &&
  Str.Equivalence(firstSourceHash.sha256, destHash.sha256) &&
  Str.Equivalence(firstSourceHash.sha256, secondSourceHash.sha256);

const settleFullLengthDestination = Effect.fn("Preservation.settleFullLengthDestination")(function* (
  sourceAbs: string,
  destAbs: string,
  destBytes: number,
  statBefore: SourceStabilityObservation
): Effect.fn.Return<O.Option<PreservationAttemptOutcome>, PreservationArchiveIoError, FileSystem.FileSystem> {
  const firstSourceHash = yield* hashStream(sourceAbs);
  const destHash = yield* hashStream(destAbs);
  const statBetween = yield* statSource(sourceAbs);
  const betweenFailure = sourceStabilityFailure(statBefore, statBetween);
  if (O.isSome(betweenFailure)) return betweenFailure;
  const secondSourceHash = yield* hashStream(sourceAbs);
  const statAfter = yield* statSource(sourceAbs);
  const afterFailure = sourceStabilityFailure(statBefore, statAfter);
  if (O.isSome(afterFailure)) return afterFailure;
  if (!hashesProveAlreadyComplete(firstSourceHash, secondSourceHash, destHash, statBefore.sizeBytes, destBytes))
    return O.none();
  return O.some(
    PreservationAttemptOutcome.cases["already-complete"].make({
      kind: "already-complete",
      bytesReused: NonNegativeInt.make(destBytes),
      sha256: firstSourceHash.sha256,
      statAfter: O.getOrThrow(statAfter),
      statBefore,
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
  afterPayload: NonNullable<ArchiveWriterLiveOptions["afterPayloadSync"]>
): Effect.fn.Return<PreservationAttemptOutcome, PreservationArchiveIoError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const bytesCopied = yield* streamRemainder(
    sourceAbs,
    partialAbs,
    staged.stagedBytes,
    statBefore.sizeBytes,
    staged.hasher
  );
  yield* afterPayload(ArchiveWriterPayloadSyncHookInput.make({ partialAbs, sourceAbs }));
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
  const settledSourceHash = yield* hashStream(sourceAbs);
  if (
    !Str.Equivalence(sourceHash.sha256, destinationHash.sha256) ||
    !Str.Equivalence(sourceHash.sha256, settledSourceHash.sha256)
  ) {
    return yield* PreservationArchiveIoError.make({
      cause: `streamedSource=${sourceHash.sha256} settledSource=${settledSourceHash.sha256} destination=${destinationHash.sha256} bytes=${destinationHash.bytes}`,
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
 * @param options - Optional crash/mutation hook invoked after payload sync and before the stability re-stat.
 * @returns A layer providing atomic copy, prefix-resume, and destination-digest verification.
 * @category layers
 * @since 0.0.0
 */
export const makeArchiveWriterLive = (
  options?: ArchiveWriterLiveOptions
): Layer.Layer<ArchiveWriter, never, FileSystem.FileSystem | Path.Path> =>
  Layer.effect(
    ArchiveWriter,
    Effect.gen(function* () {
      const runtime = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
      const afterPayloadSync = pipe(
        O.fromNullishOr(options?.afterPayloadSync),
        O.getOrElse(() => (_input: ArchiveWriterPayloadSyncHookInput) => Effect.void)
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
        const approvedObservation = SourceStabilityObservation.make({
          mtimeEpoch: identity.mtimeEpoch,
          sizeBytes: identity.sizeBytes,
        });
        if (!stabilityEquivalence(statBefore, approvedObservation)) {
          return changedOutcome(approvedObservation, statBefore);
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
    "changed-during-copy": O.none<Sha256Hex>,
    copied: (outcome) => O.some(outcome.sha256),
    "resume-completed": (outcome) => O.some(outcome.sha256),
    "resume-discarded": O.none<Sha256Hex>,
    unreadable: O.none<Sha256Hex>,
  });

const missingVerificationRow = (row: PreservationManifestRow, verifiedAt: string): PreservationVerificationRow =>
  PreservationVerificationRow.make({
    destRelativePath: row.destRelativePath,
    object: row.object,
    outcome: PreservationVerificationOutcome.cases["missing-destination"].make({ kind: "missing-destination" }),
    verifiedAt,
  });

const verifyRow = Effect.fn("Preservation.verifyRow")(function* (
  archiveRoot: string,
  row: PreservationManifestRow
): Effect.fn.Return<PreservationVerificationRow, PreservationArchiveIoError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const verifiedAt = DateTime.formatIso(yield* DateTime.now);
  const destination = path.resolve(archiveRoot, row.destRelativePath);
  if (!isContainedPath(path, archiveRoot, destination)) {
    return missingVerificationRow(row, verifiedAt);
  }
  const exists = yield* fs.exists(destination).pipe(Effect.mapError(ioError("verify-exists", destination)));
  if (!exists) {
    return missingVerificationRow(row, verifiedAt);
  }
  const canonicalRoot = yield* fs.realPath(archiveRoot).pipe(Effect.mapError(ioError("verify-realpath", archiveRoot)));
  const canonicalDestination = yield* fs
    .realPath(destination)
    .pipe(Effect.mapError(ioError("verify-realpath", destination)));
  const expectedCanonicalDestination = path.resolve(canonicalRoot, row.destRelativePath);
  if (
    !isContainedPath(path, canonicalRoot, canonicalDestination) ||
    !Str.Equivalence(canonicalDestination, expectedCanonicalDestination)
  ) {
    return missingVerificationRow(row, verifiedAt);
  }
  const destinationInfo = yield* fs
    .stat(canonicalDestination)
    .pipe(Effect.mapError(ioError("verify-stat", canonicalDestination)));
  if (destinationInfo.type !== "File") {
    return missingVerificationRow(row, verifiedAt);
  }
  const actualBytes = Number(destinationInfo.size);
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
  const actual = yield* hashStream(canonicalDestination);
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
 * @param manifestPath - Destination JSONL manifest to reparse independently from the archive run.
 * @returns A layer that verifies contained, non-symlinked terminal destinations one at a time.
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

type ScopedSourceFile = {
  readonly absolute: string;
  readonly identity: PreservationObjectIdentity;
  readonly relative: string;
};

const scopedSourceFiles = Effect.fn("Preservation.scopedSourceFiles")(function* (
  options: T7PreservationOptions
): Effect.fn.Return<ReadonlyArray<ScopedSourceFile>, PreservationArchiveIoError, FileSystem.FileSystem | Path.Path> {
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

const collectorRelativePath = (destination: string): O.Option<string> => {
  const normalized = Str.replaceAll("\\", "/")(destination);
  const marker = `${sourceDirectoryName}/`;
  return pipe(
    Str.indexOf(marker)(normalized),
    O.map((index) => Str.slice(index + marker.length)(normalized)),
    O.filter(Str.isNonEmpty)
  );
};

const readCollectorManifest = Effect.fn("Preservation.readCollectorManifest")(function* (
  options: T7PreservationOptions
): Effect.fn.Return<
  ReadonlyArray<CollectorManifestRecord>,
  PreservationArchiveIoError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifestPath = path.join(path.resolve(options.t7Root), sourceDirectoryName, "_meta", "manifest.jsonl");
  const text = yield* fs
    .readFileString(manifestPath)
    .pipe(Effect.mapError(ioError("collector-manifest-read", manifestPath)));
  const lines = pipe(Str.split(/\r?\n/u)(text), A.filter(Str.isNonEmpty));
  return yield* Effect.forEach(lines, (line) =>
    CollectorManifestRecordJson.decode(line).pipe(Effect.mapError(ioError("collector-manifest-decode", manifestPath)))
  );
});

type CollectorTerminalEvidence = {
  readonly collectorErrors: number;
  readonly deliberateExclusions: number;
  readonly terminalSuccesses: MutableHashMap.MutableHashMap<string, NonNegativeInt>;
};

type CollectorDestinationStatus = "missing" | "reconciled" | "size-mismatch";

const collectorSuccessCoordinates = Effect.fn("Preservation.collectorSuccessCoordinates")(function* (
  row: CollectorManifestRecord,
  manifestPath: string
): Effect.fn.Return<readonly [string, NonNegativeInt], PreservationArchiveIoError> {
  const coordinates = O.all({ destination: row.dst, size: row.size });
  if (O.isNone(coordinates)) {
    return yield* PreservationArchiveIoError.make({
      cause: row.status,
      message: "A successful collector-manifest row omitted its destination or size.",
      operation: "collector-manifest-decode",
      path: manifestPath,
    });
  }
  const relative = collectorRelativePath(coordinates.value.destination);
  if (O.isNone(relative)) {
    return yield* PreservationArchiveIoError.make({
      cause: "collector destination is outside the declared salvage namespace",
      message: "A successful collector-manifest row did not target the declared salvage tree.",
      operation: "collector-manifest-reconcile",
      path: manifestPath,
    });
  }
  return [relative.value, coordinates.value.size];
});

const collectorTerminalEvidence = Effect.fn("Preservation.collectorTerminalEvidence")(function* (
  rows: ReadonlyArray<CollectorManifestRecord>,
  manifestPath: string
): Effect.fn.Return<CollectorTerminalEvidence, PreservationArchiveIoError> {
  if (A.length(rows) === 0) {
    return yield* PreservationArchiveIoError.make({
      cause: "collector manifest is empty",
      message: "The collector manifest must contain terminal evidence rows before preservation can run.",
      operation: "collector-manifest-reconcile",
      path: manifestPath,
    });
  }
  const successfulRows = A.filter(rows, (row) => row.status === "copied" || row.status === "resumed");
  if (A.length(successfulRows) === 0) {
    return yield* PreservationArchiveIoError.make({
      cause: "collector manifest has no successful terminal destinations",
      message: "The collector manifest must include at least one copied or resumed destination.",
      operation: "collector-manifest-reconcile",
      path: manifestPath,
    });
  }
  const terminalEntries = yield* Effect.forEach(successfulRows, (row) =>
    collectorSuccessCoordinates(row, manifestPath)
  );
  return {
    collectorErrors: A.length(A.filter(rows, (row) => row.status === "error")),
    deliberateExclusions: A.length(A.filter(rows, (row) => row.status === "excluded-secret")),
    terminalSuccesses: MutableHashMap.fromIterable(terminalEntries),
  };
});

const reconcileCollectorDestination = Effect.fn("Preservation.reconcileCollectorDestination")(function* (
  salvageRoot: string,
  manifestPath: string,
  relative: string,
  expectedSize: NonNegativeInt
): Effect.fn.Return<CollectorDestinationStatus, PreservationArchiveIoError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const destination = path.resolve(salvageRoot, relative);
  if (!isContainedPath(path, salvageRoot, destination)) {
    return yield* PreservationArchiveIoError.make({
      cause: "collector destination escapes the declared salvage namespace",
      message: "Collector-manifest reconciliation rejected an escaping destination.",
      operation: "collector-manifest-reconcile",
      path: manifestPath,
    });
  }
  const exists = yield* fs
    .exists(destination)
    .pipe(Effect.mapError(ioError("collector-destination-exists", destination)));
  if (!exists) return "missing";
  const info = yield* fs.stat(destination).pipe(Effect.mapError(ioError("collector-destination-stat", destination)));
  return info.type === "File" && Number(info.size) === expectedSize ? "reconciled" : "size-mismatch";
});

const reconcileCollectorDestinations = Effect.fn("Preservation.reconcileCollectorDestinations")(function* (
  salvageRoot: string,
  manifestPath: string,
  terminalSuccesses: MutableHashMap.MutableHashMap<string, NonNegativeInt>
): Effect.fn.Return<
  ReadonlyArray<CollectorDestinationStatus>,
  PreservationArchiveIoError,
  FileSystem.FileSystem | Path.Path
> {
  return yield* Effect.forEach(terminalSuccesses, ([relative, expectedSize]) =>
    reconcileCollectorDestination(salvageRoot, manifestPath, relative, expectedSize)
  );
});

const reconcileCollectorManifest = Effect.fn("Preservation.reconcileCollectorManifest")(function* (
  options: T7PreservationOptions
): Effect.fn.Return<CollectorReconciliationSummary, PreservationArchiveIoError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const salvageRoot = path.join(path.resolve(options.t7Root), sourceDirectoryName);
  const manifestPath = path.join(salvageRoot, "_meta", "manifest.jsonl");
  const evidence = yield* collectorTerminalEvidence(yield* readCollectorManifest(options), manifestPath);
  const statuses = yield* reconcileCollectorDestinations(salvageRoot, manifestPath, evidence.terminalSuccesses);
  const count = (status: CollectorDestinationStatus): NonNegativeInt =>
    NonNegativeInt.make(A.length(A.filter(statuses, (candidate) => candidate === status)));
  return CollectorReconciliationSummary.make({
    collectorErrors: NonNegativeInt.make(evidence.collectorErrors),
    deliberateExclusions: NonNegativeInt.make(evidence.deliberateExclusions),
    missingDestinations: count("missing"),
    reconciledDestinations: count("reconciled"),
    sizeMismatches: count("size-mismatch"),
  });
});

const inheritedLossRows = (summary: CollectorReconciliationSummary): ReadonlyArray<InheritedLossRow> => [
  InheritedLossRow.make({
    count: summary.collectorErrors,
    evidenceRef:
      "explorations/oppold-corpus-overhaul/research/2026-08-17-restoration-census.md#the-collector-ledger-salvage-_metamanifestjsonl",
    lossClass: "collector-error",
  }),
  InheritedLossRow.make({
    count: summary.deliberateExclusions,
    evidenceRef:
      "explorations/oppold-corpus-overhaul/research/2026-08-17-restoration-census.md#the-collector-ledger-salvage-_metamanifestjsonl",
    lossClass: "deliberate-exclusion",
  }),
  InheritedLossRow.make({
    count: NonNegativeInt.make(1),
    evidenceRef:
      "explorations/oppold-corpus-overhaul/research/2026-08-17-restoration-census.md#filesystem-and-drive-facts",
    lossClass: "exfat-stripped-metadata",
  }),
  InheritedLossRow.make({
    count: NonNegativeInt.make(13),
    evidenceRef:
      "explorations/oppold-corpus-overhaul/research/2026-08-17-restoration-census.md#the-three-recycle-surfaces-are-three-volumes",
    lossClass: "missing-recycle-r-record",
  }),
  InheritedLossRow.make({
    count: summary.missingDestinations,
    evidenceRef:
      "explorations/oppold-corpus-overhaul/research/2026-08-17-restoration-census.md#the-collector-ledger-salvage-_metamanifestjsonl",
    lossClass: "mutated-e-tree-destination",
  }),
];

const readInheritedLossRows = Effect.fn("Preservation.readInheritedLossRows")(function* (
  ledgerPath: string
): Effect.fn.Return<ReadonlyArray<InheritedLossRow>, PreservationArchiveIoError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  if (!(yield* fs.exists(ledgerPath).pipe(Effect.mapError(ioError("inherited-loss-exists", ledgerPath))))) {
    return A.empty<InheritedLossRow>();
  }
  const text = yield* fs.readFileString(ledgerPath).pipe(Effect.mapError(ioError("inherited-loss-read", ledgerPath)));
  const lines = pipe(Str.split(/\r?\n/u)(text), A.filter(Str.isNonEmpty));
  return yield* Effect.forEach(lines, (line) =>
    InheritedLossRowJson.decode(line).pipe(Effect.mapError(ioError("inherited-loss-decode", ledgerPath)))
  );
});

const seedInheritedLossLedger = Effect.fn("Preservation.seedInheritedLossLedger")(function* (
  corpusRoot: string,
  summary: CollectorReconciliationSummary
): Effect.fn.Return<void, PreservationArchiveIoError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const ledgerPath = inheritedLossPathFor(corpusRoot, path);
  const expected = inheritedLossRows(summary);
  if (yield* fs.exists(ledgerPath).pipe(Effect.mapError(ioError("inherited-loss-exists", ledgerPath)))) {
    const existing = yield* readInheritedLossRows(ledgerPath);
    if (!inheritedLossRowsEquivalence(existing, expected)) {
      return yield* PreservationArchiveIoError.make({
        cause: "existing inherited-loss opening balance differs from the current reconciliation",
        message: "The inherited-loss ledger does not match the current collector reconciliation.",
        operation: "inherited-loss-reconcile",
        path: ledgerPath,
      });
    }
    return;
  }
  const encoded = yield* Effect.forEach(expected, InheritedLossRowJson.encode).pipe(
    Effect.mapError(ioError("inherited-loss-encode", ledgerPath))
  );
  yield* writeFileDurably(ledgerPath, `${A.join(encoded, "\n")}\n`);
});

const inheritedLossLedgerMatches = Effect.fn("Preservation.inheritedLossLedgerMatches")(function* (
  corpusRoot: string,
  summary: CollectorReconciliationSummary
): Effect.fn.Return<boolean, PreservationArchiveIoError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const rows = yield* readInheritedLossRows(inheritedLossPathFor(corpusRoot, path));
  return inheritedLossRowsEquivalence(rows, inheritedLossRows(summary));
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

const measureCapacityForFiles = Effect.fn("Preservation.measureCapacityForFiles")(function* (
  options: T7PreservationOptions,
  files: ReadonlyArray<ScopedSourceFile>
): Effect.fn.Return<CapacityMeasurement, PreservationArchiveIoError, PreservationRequirements> {
  const sourceBytes = A.reduce(files, 0, (total, file) => total + file.identity.sizeBytes);
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const corpusRoot = path.resolve(options.corpusRoot);
  const sourceRoot = path.resolve(options.t7Root);
  yield* fs.makeDirectory(corpusRoot, { recursive: true }).pipe(Effect.mapError(ioError("mkdir", corpusRoot)));
  return CapacityMeasurement.make({
    destFreeBytes: NonNegativeInt.make(yield* destinationFreeBytes(corpusRoot)),
    measuredAt: DateTime.formatIso(yield* DateTime.now),
    objectCount: NonNegativeInt.make(A.length(files)),
    requiredBytes: NonNegativeInt.make(sourceBytes),
    sourceBytes: NonNegativeInt.make(sourceBytes),
    sourceRoot,
  });
});

const measureCapacity = Effect.fn("Preservation.measureCapacity")(function* (
  options: T7PreservationOptions
): Effect.fn.Return<CapacityMeasurement, PreservationArchiveIoError, PreservationRequirements> {
  return yield* measureCapacityForFiles(options, yield* scopedSourceFiles(options));
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
      return CapacityPreflightService.of({
        measure: Effect.fn("CapacityPreflightService.measure.provided")((options: T7PreservationOptions) =>
          measureCapacity(options).pipe(Effect.provide(runtime))
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

/**
 * Measure and durably persist a proposed T7 source census and destination
 * capacity record for later operator approval.
 *
 * **Example** (Build a capacity preflight effect)
 *
 * ```ts
 * import { preflightT7Preservation, T7PreservationOptions } from "@beep/repo-cli/commands/Corpus"
 *
 * const effect = preflightT7Preservation(
 *   T7PreservationOptions.make({ corpusRoot: "/tmp/corpus", t7Root: "/media/t7" })
 * )
 * console.log(effect.pipe !== undefined) // true
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const preflightT7PreservationImpl = Effect.fn("CorpusCommandService.preflightT7Preservation")(function* (
  options: T7PreservationOptions
): Effect.fn.Return<CapacityPreflight, PreservationArchiveIoError, PreservationRequirements> {
  const measurement = yield* measureCapacity(options);
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

/**
 * Persist operator approval over the previously measured byte ceiling while
 * retaining the canonical source identity for run-time refresh checks.
 *
 * **Example** (Build an approval effect)
 *
 * ```ts
 * import { approveT7Preservation } from "@beep/repo-cli/commands/Corpus"
 *
 * const effect = approveT7Preservation("/tmp/corpus", 400_000_000_000, "operator")
 * console.log(effect.pipe !== undefined) // true
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const approveT7PreservationImpl = Effect.fn("CorpusCommandService.approveT7Preservation")(function* (
  corpusRoot: string,
  ceilingBytes: number,
  approvedBy: string
): Effect.fn.Return<ApprovedCapacityPreflight, PreservationCommandError, FileSystem.FileSystem | Path.Path> {
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
): Effect.fn.Return<ApprovedCapacityPreflight, PreservationCommandError, FileSystem.FileSystem | Path.Path> {
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

const refreshApprovedPreflight = Effect.fn("Preservation.refreshApprovedPreflight")(function* (
  options: T7PreservationOptions,
  files: ReadonlyArray<ScopedSourceFile>,
  approved: ApprovedCapacityPreflight
): Effect.fn.Return<ApprovedCapacityPreflight, PreservationCommandError, PreservationRequirements> {
  const current = yield* measureCapacityForFiles(options, files);
  yield* validateRefreshedCapacityForTesting(
    approved.measurement.sourceRoot,
    current.sourceRoot,
    current.requiredBytes,
    approved.ceilingBytes,
    current.destFreeBytes
  );
  const refreshed = CapacityPreflight.cases.approved.make({
    approvedAt: approved.approvedAt,
    approvedBy: approved.approvedBy,
    ceilingBytes: approved.ceilingBytes,
    kind: "approved",
    measurement: current,
  });
  yield* writePreflight(options.corpusRoot, refreshed);
  return refreshed;
});

/** @category Testing */
export const validateRefreshedCapacityForTesting = Effect.fnUntraced(function* (
  approvedSourceRoot: string,
  currentSourceRoot: string,
  currentRequiredBytes: number,
  ceilingBytes: number,
  destFreeBytes: number
) {
  if (!Str.Equivalence(approvedSourceRoot, currentSourceRoot)) {
    return yield* PreservationPreflightUnapprovedError.make({
      message: "The approved preflight belongs to a different canonical T7 source root; run preflight again.",
    });
  }
  if (currentRequiredBytes > ceilingBytes) {
    return yield* PreservationCeilingExceededError.make({
      ceilingBytes: NonNegativeInt.make(ceilingBytes),
      measuredBytes: NonNegativeInt.make(currentRequiredBytes),
      message: "The current preservation requirement exceeds the approved ceiling.",
    });
  }
  if (currentRequiredBytes > destFreeBytes) {
    return yield* PreservationCeilingExceededError.make({
      ceilingBytes: NonNegativeInt.make(destFreeBytes),
      measuredBytes: NonNegativeInt.make(currentRequiredBytes),
      message: "The current destination free space is smaller than the preservation requirement.",
    });
  }
});

const readCorpusLedger = Effect.fn("Preservation.readCorpusLedger")(function* (
  ledgerPath: string
): Effect.fn.Return<ReadonlyArray<CorpusLedgerRecord>, PreservationArchiveIoError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  if (!(yield* fs.exists(ledgerPath).pipe(Effect.mapError(ioError("provenance-exists", ledgerPath))))) {
    return A.empty<CorpusLedgerRecord>();
  }
  const text = yield* fs.readFileString(ledgerPath).pipe(Effect.mapError(ioError("provenance-read", ledgerPath)));
  const lines = pipe(Str.split(/\r?\n/u)(text), A.filter(Str.isNonEmpty));
  return yield* Effect.forEach(lines, (line) =>
    CorpusLedgerRecordJson.decode(line).pipe(Effect.mapError(ioError("provenance-decode", ledgerPath)))
  );
});

const appendPassProvenance = Effect.fn("Preservation.appendPassProvenance")(function* (
  corpusRoot: string,
  row: PreservationManifestRow,
  sha: Sha256Hex
): Effect.fn.Return<void, PreservationArchiveIoError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const ledgerPath = path.join(corpusRoot, "raw", "provenance.jsonl");
  const provenance = T7ArchiveProvenanceRecord.make({
    archivedAt: row.archivedAt,
    destRelativePath: row.destRelativePath,
    mtimeEpoch: row.object.mtimeEpoch,
    mtimeIso: row.object.mtimeIso,
    record: "t7-archive/v1",
    relativePath: row.object.relativePath,
    sha256: sha,
    sizeBytes: row.object.sizeBytes,
    sourceClass: row.object.sourceClass,
  });
  const existing = yield* readCorpusLedger(ledgerPath);
  if (
    A.some(
      existing,
      (record) =>
        isT7ArchiveProvenanceRecord(record) &&
        record.sourceClass === provenance.sourceClass &&
        Str.Equivalence(record.relativePath, provenance.relativePath) &&
        Str.Equivalence(record.destRelativePath, provenance.destRelativePath) &&
        record.sizeBytes === provenance.sizeBytes &&
        record.mtimeEpoch === provenance.mtimeEpoch &&
        Str.Equivalence(record.sha256, provenance.sha256)
    )
  ) {
    return;
  }
  const encoded = yield* CorpusLedgerRecordJson.encode(provenance).pipe(
    Effect.mapError(ioError("provenance-encode", ledgerPath))
  );
  yield* appendDurably(ledgerPath, encoded);
});

type PreservationCapacityBudget = {
  readonly aggregateRequiredBytes: MutableRef.MutableRef<number>;
  readonly ceilingBytes: number;
  readonly corpusRoot: string;
  readonly remainingRequiredBytes: MutableRef.MutableRef<number>;
};

/** @category Testing */
export const validateCopyTimeCapacityForTesting = Effect.fnUntraced(function* (
  aggregateRequiredBytes: number,
  remainingRequiredBytes: number,
  ceilingBytes: number,
  destFreeBytes: number
) {
  if (aggregateRequiredBytes > ceilingBytes) {
    return yield* PreservationCeilingExceededError.make({
      ceilingBytes: NonNegativeInt.make(ceilingBytes),
      measuredBytes: NonNegativeInt.make(aggregateRequiredBytes),
      message: "Copy-time source growth exceeds the approved preservation ceiling.",
    });
  }
  if (remainingRequiredBytes > destFreeBytes) {
    return yield* PreservationCeilingExceededError.make({
      ceilingBytes: NonNegativeInt.make(destFreeBytes),
      measuredBytes: NonNegativeInt.make(remainingRequiredBytes),
      message: "Copy-time source growth exceeds the measured destination free space.",
    });
  }
});

const archiveObjectToTerminal = Effect.fn("Preservation.archiveObjectToTerminal")(function* (
  writer: ArchiveWriterShape,
  manifest: PreservationManifestStoreShape,
  attemptCounts: MutableHashMap.MutableHashMap<string, number>,
  sourceAbs: string,
  destAbs: string,
  destRelativePath: string,
  identity: PreservationObjectIdentity,
  capacity: PreservationCapacityBudget
): Effect.fn.Return<
  A.NonEmptyReadonlyArray<PreservationManifestRow>,
  PreservationArchiveIoError | PreservationCeilingExceededError,
  FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner
> {
  const key = identityKey(identity);
  const fs = yield* FileSystem.FileSystem;
  let accountedSizeBytes = identity.sizeBytes;
  const attemptOnce = Effect.fnUntraced(function* () {
    const attempt = 1 + O.getOrElse(MutableHashMap.get(attemptCounts, key), () => 0);
    MutableHashMap.set(attemptCounts, key, attempt);
    const currentIdentity = yield* fs.stat(sourceAbs).pipe(
      Effect.map((info) => objectIdentity(info, identity.relativePath, identity.sourceClass)),
      Effect.option
    );
    const attemptIdentity = O.getOrElse(currentIdentity, () => identity);
    const nextAggregateRequiredBytes =
      MutableRef.get(capacity.aggregateRequiredBytes) - accountedSizeBytes + attemptIdentity.sizeBytes;
    const nextRemainingRequiredBytes =
      MutableRef.get(capacity.remainingRequiredBytes) - accountedSizeBytes + attemptIdentity.sizeBytes;
    const partialInfo = yield* fs.stat(`${destAbs}${partialSuffix}`).pipe(Effect.option);
    const allocatedInfo = O.isSome(partialInfo) ? partialInfo : yield* fs.stat(destAbs).pipe(Effect.option);
    const allocatedBytes = O.match(allocatedInfo, {
      onNone: () => 0,
      onSome: (info) => Math.min(attemptIdentity.sizeBytes, Number(info.size)),
    });
    const destinationBytesRequired = Math.max(0, nextRemainingRequiredBytes - allocatedBytes);
    const currentDestFreeBytes = yield* destinationFreeBytes(capacity.corpusRoot);
    yield* validateCopyTimeCapacityForTesting(
      nextAggregateRequiredBytes,
      destinationBytesRequired,
      capacity.ceilingBytes,
      currentDestFreeBytes
    );
    MutableRef.set(capacity.aggregateRequiredBytes, nextAggregateRequiredBytes);
    MutableRef.set(capacity.remainingRequiredBytes, nextRemainingRequiredBytes);
    accountedSizeBytes = attemptIdentity.sizeBytes;
    const outcome = yield* writer.archiveObject(sourceAbs, destAbs, attemptIdentity);
    const row = PreservationManifestRow.make({
      archivedAt: DateTime.formatIso(yield* DateTime.now),
      attempt: NonNegativeInt.make(attempt),
      destRelativePath,
      object: attemptIdentity,
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

const sourceMatchesVerificationReport = Effect.fn("Preservation.sourceMatchesVerificationReport")(function* (
  options: T7PreservationOptions,
  report: PreservationVerificationReport
): Effect.fn.Return<boolean, PreservationArchiveIoError, FileSystem.FileSystem | Path.Path> {
  const currentFiles = yield* scopedSourceFiles(options);
  if (A.length(currentFiles) !== report.summary.rowsChecked) return false;
  const manifestIdentities = MutableHashMap.empty<string, PreservationObjectIdentity>();
  for (const row of report.rows) {
    MutableHashMap.set(manifestIdentities, identityKey(row.object), row.object);
  }
  return A.every(currentFiles, (file) =>
    O.exists(MutableHashMap.get(manifestIdentities, identityKey(file.identity)), (identity) =>
      objectIdentityEquivalence(identity, file.identity)
    )
  );
});

/**
 * Run the approved T7 preservation archive operation after refreshing capacity
 * and reconciling the collector and inherited-loss ledgers.
 *
 * **Example** (Build an archive-run effect)
 *
 * ```ts
 * import { runT7Preservation, T7PreservationOptions } from "@beep/repo-cli/commands/Corpus"
 *
 * const effect = runT7Preservation(
 *   T7PreservationOptions.make({ corpusRoot: "/tmp/corpus", t7Root: "/media/t7" })
 * )
 * console.log(effect.pipe !== undefined) // true
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const runT7PreservationImpl = Effect.fn("CorpusCommandService.runT7Preservation")(function* (
  options: T7PreservationOptions
): Effect.fn.Return<PreservationRunSummary, PreservationCommandError, PreservationRequirements> {
  const approved = yield* loadApprovedPreflight(options.corpusRoot);
  const path = yield* Path.Path;
  if (!Str.Equivalence(approved.measurement.sourceRoot, path.resolve(options.t7Root))) {
    return yield* PreservationPreflightUnapprovedError.make({
      message: "The approved preflight belongs to a different canonical T7 source root; run preflight again.",
    });
  }
  yield* refreshApprovedPreflight(options, yield* scopedSourceFiles(options), approved);
  const reconciliation = yield* reconcileCollectorManifest(options);
  if (reconciliation.sizeMismatches > 0) {
    return yield* PreservationUnapprovedRowsError.make({
      message: "Collector-manifest reconciliation found current destinations with changed sizes.",
      unapprovedRows: reconciliation.sizeMismatches,
    });
  }
  yield* seedInheritedLossLedger(options.corpusRoot, reconciliation);
  yield* printLines([
    `preservation collector: reconciled=${reconciliation.reconciledDestinations} inheritedMissing=${reconciliation.missingDestinations} collectorErrors=${reconciliation.collectorErrors} deliberateExclusions=${reconciliation.deliberateExclusions}`,
  ]);
  const files = yield* scopedSourceFiles(options);
  const refreshed = yield* refreshApprovedPreflight(options, files, approved);
  const archiveRoot = archiveRootFor(options.corpusRoot, path);
  const manifestPath = manifestPathFor(options.corpusRoot, path);
  const services = Layer.mergeAll(ArchiveWriterLive, PreservationManifestStoreLive(manifestPath));
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const serviceContext = yield* Layer.build(services);
      return yield* Effect.gen(function* () {
        const writer = yield* ArchiveWriter;
        const manifest = yield* PreservationManifestStore;
        const priorRows = yield* manifest.readAll;
        const attemptCounts = MutableHashMap.empty<string, number>();
        for (const row of priorRows) {
          const key = occurrenceKey(row);
          MutableHashMap.set(attemptCounts, key, 1 + O.getOrElse(MutableHashMap.get(attemptCounts, key), () => 0));
        }
        let passed = 0;
        let unapproved = 0;
        let attempted = 0;
        const capacity: PreservationCapacityBudget = {
          aggregateRequiredBytes: MutableRef.make(refreshed.measurement.requiredBytes),
          ceilingBytes: refreshed.ceilingBytes,
          corpusRoot: path.resolve(options.corpusRoot),
          remainingRequiredBytes: MutableRef.make(refreshed.measurement.requiredBytes),
        };
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
            file.identity,
            capacity
          );
          attempted += A.length(rows);
          const terminalRow = A.lastNonEmpty(rows);
          const sha = expectedDigest(terminalRow);
          if (O.isSome(sha)) {
            MutableRef.update(capacity.remainingRequiredBytes, (remaining) =>
              Math.max(0, remaining - terminalRow.object.sizeBytes)
            );
            passed += 1;
            yield* appendPassProvenance(options.corpusRoot, terminalRow, sha.value);
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

/**
 * Independently reparse the terminal destination manifest and require it to
 * cover the refreshed source census and inherited-loss opening balance.
 *
 * **Example** (Build an independent verification effect)
 *
 * ```ts
 * import { verifyT7Preservation } from "@beep/repo-cli/commands/Corpus"
 *
 * const effect = verifyT7Preservation("/tmp/corpus")
 * console.log(effect.pipe !== undefined) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const verifyT7PreservationImpl = Effect.fn("CorpusCommandService.verifyT7Preservation")(function* (
  corpusRoot: string
): Effect.fn.Return<PreservationVerificationReport, PreservationCommandError, PreservationRequirements> {
  const path = yield* Path.Path;
  const approved = yield* loadApprovedPreflight(corpusRoot);
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
  const options = T7PreservationOptions.make({ corpusRoot, t7Root: approved.measurement.sourceRoot });
  const sourceMatches = yield* sourceMatchesVerificationReport(options, report);
  const reconciliation = yield* reconcileCollectorManifest(options);
  const inheritedLossComplete = yield* inheritedLossLedgerMatches(corpusRoot, reconciliation);
  const complete =
    report.summary.rowsChecked === approved.measurement.objectCount &&
    report.summary.verified === approved.measurement.objectCount &&
    sourceMatches &&
    reconciliation.sizeMismatches === 0 &&
    inheritedLossComplete;
  if (!complete) {
    const unverifiedRows = report.summary.rowsChecked - report.summary.verified;
    return yield* PreservationVerificationFailure.make({
      failedRows: NonNegativeInt.make(unverifiedRows > 0 ? unverifiedRows : 1),
      message:
        "Independent preservation verification found non-verified, missing-census, source-drift, or inherited-loss rows.",
    });
  }
  return report;
});
