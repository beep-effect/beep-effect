/**
 * Bounded corpus preservation and independent verification programs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { Console, DateTime, Effect, FileSystem, Order, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { bytesEqual } from "../../../internal/cli/FsGuards.ts";
import { CorpusCommandError } from "../Corpus.errors.ts";
import {
  ArchiveLedgerRecord,
  ArchiveVerificationRecord,
  decodeArchiveLedgerRecordJson,
  decodeCollectorManifestRecordJson,
  encodeArchiveLedgerRecordJson,
  encodeArchiveVerificationRecordJson,
  RestorationRunSummary,
} from "./Restoration.schemas.ts";
import {
  CorpusProvenanceRecord,
  decodeCorpusProvenanceRecordJson,
  encodeCorpusProvenanceRecordJson,
} from "./Salvage.schemas.ts";
import type { Scope } from "effect";
import type {
  CollectorManifestRecord,
  RestorationPreserveOptions,
  RestorationVerifyOptions,
} from "./Restoration.schemas.ts";

const schemaVersion = "oppold-corpus-restoration/v1" as const;
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

type RestorationRequirements = FileSystem.FileSystem | Path.Path;

type ArchiveSourceObject = {
  readonly destinationRelativePath: string;
  readonly objectId: string;
  readonly objectKind: "file" | "root-archive";
  readonly sourceLabel: string;
  readonly sourcePath: string;
  readonly sourceRelativePath: string;
};

type ArchiveDirectoryObject = {
  readonly destinationRelativePath: string;
  readonly objectId: string;
  readonly sourceLabel: string;
  readonly sourceRelativePath: string;
};

type ArchiveInventory = {
  readonly directories: ReadonlyArray<ArchiveDirectoryObject>;
  readonly files: ReadonlyArray<ArchiveSourceObject>;
  readonly requiredBytes: number;
  readonly rootArchiveBytes: number;
  readonly sourceTreeBytes: number;
};

type ArchiveTerminalRecord = Extract<
  ArchiveLedgerRecord,
  { readonly recordType: "archive-directory-pass" | "archive-failure" | "archive-file-pass" }
>;

type ArchiveCopyAttemptOutcome = Extract<
  ArchiveLedgerRecord,
  { readonly recordType: "archive-changed-during-copy" | "archive-file-pass" }
>;

type ArchiveAttemptContext = {
  readonly attemptId: string;
  readonly chunkSize: number;
  readonly destinationDirectory: string;
  readonly destinationPath: string;
  readonly manifestPath: string;
  readonly object: ArchiveSourceObject;
  readonly partialPath: string;
  readonly runId: string;
};

type ArchiveManifestSeal = Extract<ArchiveLedgerRecord, { readonly recordType: "archive-manifest-seal" }>;

type ArchivePreflight = Extract<ArchiveLedgerRecord, { readonly recordType: "archive-preflight" }>;

type ArchiveTerminalIndex = {
  readonly duplicateObjectId: O.Option<string>;
  readonly terminals: Map<string, ArchiveTerminalRecord>;
};

type TerminalVerificationOutcome = {
  readonly bytesVerified: number;
  readonly record: O.Option<ArchiveVerificationRecord>;
};

const archiveError = (message: string): CorpusCommandError => CorpusCommandError.make({ message });

const nonNegative = (value: number): NonNegativeInt => NonNegativeInt.make(Math.max(0, Math.floor(value)));

const digestBytes = (bytes: Uint8Array): Sha256Hex => Sha256Hex.make(bytesToHex(sha256(bytes)));

const digestText = (value: string): Sha256Hex => digestBytes(utf8ToBytes(value));

const objectIdFor = (sourceLabel: string, sourceRelativePath: string): string =>
  digestText(`${sourceLabel}\u0000${sourceRelativePath}`);

const recordedAt = Effect.fn("CorpusRestoration.recordedAt")(function* () {
  return DateTime.formatIso(yield* DateTime.now);
});

const sourceStat = (info: FileSystem.File.Info) => ({
  mtimeMillis: nonNegative(
    O.match(info.mtime, {
      onNone: () => 0,
      onSome: (value) => DateTime.toEpochMillis(DateTime.makeUnsafe(value)),
    })
  ),
  sizeBytes: nonNegative(Number(info.size)),
});

const isSameSourceStat = (left: ReturnType<typeof sourceStat>, right: ReturnType<typeof sourceStat>): boolean =>
  left.mtimeMillis === right.mtimeMillis && left.sizeBytes === right.sizeBytes;

/**
 * Durably flush a restoration directory after an atomic filesystem boundary.
 *
 * @param directory - Directory whose metadata must reach stable storage.
 * @returns An effect that completes after the directory handle is synced.
 * @effects Opens and syncs the directory through the platform filesystem.
 * @category utilities
 * @since 0.0.0
 */
export const syncRestorationDirectory = Effect.fn("CorpusRestoration.syncDirectory")(function* (
  directory: string
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  yield* Effect.scoped(
    fs.open(directory, { flag: "r" }).pipe(
      Effect.flatMap((handle) => handle.sync),
      CorpusCommandError.mapError(`Failed syncing archive directory "${directory}".`)
    )
  );
});

/**
 * Append text to a restoration ledger and durably sync both file and parent directory.
 *
 * @param filePath - Ledger path outside the repository.
 * @param text - Already encoded ledger text to append.
 * @returns An effect that completes only after the append is durable.
 * @effects Creates the parent directory, appends and syncs the file, then syncs its directory.
 * @category utilities
 * @since 0.0.0
 */
export const appendRestorationTextDurably = Effect.fn("CorpusRestoration.appendTextDurably")(function* (
  filePath: string,
  text: string
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.dirname(filePath);
  yield* fs
    .makeDirectory(directory, { recursive: true })
    .pipe(CorpusCommandError.mapError(`Failed creating ledger directory "${directory}".`));
  yield* Effect.scoped(
    fs.open(filePath, { flag: "a" }).pipe(
      Effect.flatMap((handle) => handle.writeAll(textEncoder.encode(text)).pipe(Effect.andThen(handle.sync))),
      CorpusCommandError.mapError(`Failed durably appending "${filePath}".`)
    )
  );
  yield* syncRestorationDirectory(directory);
});

const appendArchiveRecord = Effect.fn("CorpusRestoration.appendArchiveRecord")(function* (
  manifestPath: string,
  record: ArchiveLedgerRecord
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const encoded = yield* encodeArchiveLedgerRecordJson(record).pipe(
    CorpusCommandError.mapError("Archive ledger record failed JSONL encoding.")
  );
  yield* appendRestorationTextDurably(manifestPath, `${encoded}\n`);
});

/**
 * Compute a SHA-256 digest and byte count with bounded streaming reads.
 *
 * @param filePath - File to hash without loading it into memory.
 * @param chunkSize - Positive maximum bytes requested for each read.
 * @returns The complete byte count and SHA-256 digest.
 * @effects Opens and reads the file through the platform filesystem.
 * @category utilities
 * @since 0.0.0
 */
export const hashRestorationFileStreaming = Effect.fn("CorpusRestoration.hashFileStreaming")(function* (
  filePath: string,
  chunkSize: number
): Effect.fn.Return<
  { readonly sha256: Sha256Hex; readonly sizeBytes: number },
  CorpusCommandError,
  FileSystem.FileSystem
> {
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const file = yield* fs
        .open(filePath, { flag: "r" })
        .pipe(CorpusCommandError.mapError(`Failed opening archive object for streaming hash "${filePath}".`));
      const hasher = sha256.create();
      let sizeBytes = 0;
      while (true) {
        const chunk = yield* file
          .readAlloc(chunkSize)
          .pipe(CorpusCommandError.mapError(`Failed reading archive object while hashing "${filePath}".`));
        if (O.isNone(chunk)) break;
        hasher.update(chunk.value);
        sizeBytes += chunk.value.length;
      }
      return { sha256: Sha256Hex.make(bytesToHex(hasher.digest())), sizeBytes };
    })
  );
});

const compareArchivePrefixes = Effect.fn("CorpusRestoration.compareArchivePrefixes")(function* (
  sourcePath: string,
  partialPath: string,
  prefixBytes: number,
  chunkSize: number
): Effect.fn.Return<boolean, CorpusCommandError, FileSystem.FileSystem | Scope.Scope> {
  const fs = yield* FileSystem.FileSystem;
  const source = yield* fs
    .open(sourcePath, { flag: "r" })
    .pipe(CorpusCommandError.mapError("Failed opening source for partial-prefix verification."));
  const partial = yield* fs
    .open(partialPath, { flag: "r" })
    .pipe(CorpusCommandError.mapError("Failed opening partial destination for prefix verification."));
  let remaining = prefixBytes;
  while (remaining > 0) {
    const size = Math.min(chunkSize, remaining);
    const [sourceChunk, partialChunk] = yield* Effect.all([source.readAlloc(size), partial.readAlloc(size)]).pipe(
      CorpusCommandError.mapError("Failed reading partial-prefix verification bytes.")
    );
    if (O.isNone(sourceChunk) || O.isNone(partialChunk)) return false;
    if (!bytesEqual(sourceChunk.value, partialChunk.value)) return false;
    remaining -= sourceChunk.value.length;
  }
  return true;
});

const prefixMatches = Effect.fn("CorpusRestoration.prefixMatches")(function* (
  sourcePath: string,
  partialPath: string,
  prefixBytes: number,
  chunkSize: number
): Effect.fn.Return<boolean, CorpusCommandError, FileSystem.FileSystem> {
  if (prefixBytes === 0) return true;
  return yield* Effect.scoped(compareArchivePrefixes(sourcePath, partialPath, prefixBytes, chunkSize));
});

const maybeCrash = (
  actual: RestorationPreserveOptions["crashPoint"],
  expected: string
): Effect.Effect<void, CorpusCommandError> =>
  actual === expected ? Effect.fail(archiveError(`Synthetic preservation interruption at ${expected}.`)) : Effect.void;

const collectArchiveInventory = Effect.fn("CorpusRestoration.collectArchiveInventory")(function* (
  options: RestorationPreserveOptions
): Effect.fn.Return<ArchiveInventory, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourceRoot = path.resolve(options.sourceRoot);
  const sourceRootInfo = yield* fs
    .stat(sourceRoot)
    .pipe(CorpusCommandError.mapError("Failed inspecting preservation source root."));
  if (sourceRootInfo.type !== "Directory") {
    return yield* archiveError("Preservation source root must be a directory.");
  }

  const directories: Array<ArchiveDirectoryObject> = [];
  const files: Array<ArchiveSourceObject> = [];
  let sourceTreeBytes = 0;
  directories.push({
    destinationRelativePath: path.join("payload", "tree"),
    objectId: objectIdFor("salvage-tree", "."),
    sourceLabel: "salvage-tree",
    sourceRelativePath: ".",
  });
  const collectAt: (directory: string) => Effect.Effect<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> =
    Effect.fn("CorpusRestoration.collectArchiveInventory.collectAt")(function* (directory) {
      const names = yield* fs
        .readDirectory(directory)
        .pipe(CorpusCommandError.mapError("Failed enumerating preservation source tree."));
      for (const name of A.sort(names, Order.String)) {
        const sourcePath = path.join(directory, name);
        const relativePath = path.relative(sourceRoot, sourcePath);
        const info = yield* fs
          .stat(sourcePath)
          .pipe(CorpusCommandError.mapError("Failed inspecting preservation source entry."));
        if (info.type === "Directory") {
          directories.push({
            destinationRelativePath: path.join("payload", "tree", relativePath),
            objectId: objectIdFor("salvage-tree", relativePath),
            sourceLabel: "salvage-tree",
            sourceRelativePath: relativePath,
          });
          yield* collectAt(sourcePath);
          continue;
        }
        if (info.type !== "File") {
          return yield* archiveError("Preservation source contains an unsupported non-file object.");
        }
        const sizeBytes = Number(info.size);
        sourceTreeBytes += sizeBytes;
        files.push({
          destinationRelativePath: path.join("payload", "tree", relativePath),
          objectId: objectIdFor("salvage-tree", relativePath),
          objectKind: "file",
          sourceLabel: "salvage-tree",
          sourcePath,
          sourceRelativePath: relativePath,
        });
      }
    });
  yield* collectAt(sourceRoot);

  const rootArchivePath = path.resolve(options.rootArchivePath);
  const rootArchiveInfo = yield* fs
    .stat(rootArchivePath)
    .pipe(CorpusCommandError.mapError("Failed inspecting separately preserved root archive object."));
  if (rootArchiveInfo.type !== "File") {
    return yield* archiveError("The separately addressable root archive object must be a file.");
  }
  const rootArchiveBytes = Number(rootArchiveInfo.size);
  files.push({
    destinationRelativePath: path.join("payload", "root-archive.zip"),
    objectId: objectIdFor("root-archive", "root-archive.zip"),
    objectKind: "root-archive",
    sourceLabel: "root-archive",
    sourcePath: rootArchivePath,
    sourceRelativePath: "root-archive.zip",
  });

  return {
    directories: A.sort(
      directories,
      Order.mapInput(Order.String, (value: ArchiveDirectoryObject) => value.destinationRelativePath)
    ),
    files: A.sort(
      files,
      Order.mapInput(Order.String, (value: ArchiveSourceObject) => value.destinationRelativePath)
    ),
    requiredBytes: sourceTreeBytes + rootArchiveBytes,
    rootArchiveBytes,
    sourceTreeBytes,
  };
});

const requireInventoryDenominator = (
  label: string,
  expected: number,
  observed: number
): Effect.Effect<void, CorpusCommandError> =>
  expected === observed
    ? Effect.void
    : Effect.fail(archiveError(`${label} denominator mismatch: expected ${expected}, observed ${observed}.`));

const validateArchiveInventoryDenominators = Effect.fn("CorpusRestoration.validateInventoryDenominators")(function* (
  options: RestorationPreserveOptions,
  inventory: ArchiveInventory
): Effect.fn.Return<void, CorpusCommandError> {
  const sourceFileCount = A.filter(inventory.files, (object) => object.objectKind === "file").length;
  yield* requireInventoryDenominator(
    "Source directory",
    options.expectedSourceDirectoryCount,
    inventory.directories.length
  );
  yield* requireInventoryDenominator("Source file", options.expectedSourceFileCount, sourceFileCount);
  yield* requireInventoryDenominator("Source tree byte", options.expectedSourceTreeBytes, inventory.sourceTreeBytes);
  yield* requireInventoryDenominator("Root archive byte", options.expectedRootArchiveBytes, inventory.rootArchiveBytes);
});

/**
 * Probe the destination filesystem's currently available bytes.
 *
 * @param targetPath - Existing path on the destination filesystem.
 * @returns The available byte count reported by the host filesystem.
 * @effects Runs a bounded, read-only filesystem-capacity probe.
 * @category utilities
 * @since 0.0.0
 */
export const availableRestorationBytesAt = Effect.fn("CorpusRestoration.availableBytesAt")(function* (
  targetPath: string
): Effect.fn.Return<number, CorpusCommandError> {
  const result = yield* Effect.try({
    try: () =>
      Bun.spawnSync(["df", "--output=avail", "--block-size=1", targetPath], {
        stderr: "pipe",
        stdout: "pipe",
      }),
    catch: () => archiveError("Destination filesystem capacity probe failed."),
  });
  if (result.exitCode !== 0) {
    return yield* archiveError("Destination filesystem capacity probe failed.");
  }
  const lines = A.filter(Str.split(/\r?\n/u)(textDecoder.decode(result.stdout)), Str.isNonEmpty);
  const value = Number(O.getOrElse(A.last(lines), () => ""));
  if (!Number.isSafeInteger(value) || value < 0) {
    return yield* archiveError("Destination filesystem capacity probe returned an invalid byte count.");
  }
  return value;
});

const collectorRelativePath = (destination: string): O.Option<string> => {
  const segments = A.filter(Str.split(/[\\/]+/u)(destination), Str.isNonEmpty);
  const relative = A.drop(segments, 3);
  return relative.length > 0 ? O.some(A.join(relative, "/")) : O.none();
};

const reconcileCollectorRecord = Effect.fn("CorpusRestoration.reconcileCollectorRecord")(function* (
  record: CollectorManifestRecord,
  sourceRoot: string
): Effect.fn.Return<
  "collector-error" | "ignored" | "mutated" | "present",
  CorpusCommandError,
  RestorationRequirements
> {
  if (record.status === "error") return "collector-error";
  if (record.status === "excluded-secret") return "ignored";
  const relativePath = collectorRelativePath(record.dst);
  if (O.isNone(relativePath)) {
    return yield* archiveError("Inherited collector destination cannot be reconciled to the preserved tree.");
  }
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs
    .exists(path.join(sourceRoot, relativePath.value))
    .pipe(CorpusCommandError.mapError("Failed checking collector destination reconciliation."));
  return exists ? "present" : "mutated";
});

const requireCollectorDenominator = (
  label: string,
  expected: number,
  observed: number
): Effect.Effect<void, CorpusCommandError> =>
  expected === observed
    ? Effect.void
    : Effect.fail(archiveError(`${label} denominator mismatch: expected ${expected}, observed ${observed}.`));

const reconcileCollectorManifest = Effect.fn("CorpusRestoration.reconcileCollectorManifest")(function* (
  options: RestorationPreserveOptions
): Effect.fn.Return<
  { readonly collectorErrorCount: number; readonly mutatedDestinationCount: number; readonly rowCount: number },
  CorpusCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const manifestText = yield* fs
    .readFileString(options.sourceManifestPath)
    .pipe(CorpusCommandError.mapError("Failed reading inherited collector manifest."));
  const lines = A.filter(Str.split(/\r?\n/u)(manifestText), Str.isNonEmpty);
  const records = yield* Effect.forEach(lines, (line) =>
    decodeCollectorManifestRecordJson(line).pipe(
      CorpusCommandError.mapError("Inherited collector manifest contains an invalid JSONL row.")
    )
  );
  const dispositions = yield* Effect.forEach(records, (record) => reconcileCollectorRecord(record, options.sourceRoot));
  const collectorErrorCount = A.filter(dispositions, (value) => value === "collector-error").length;
  const mutatedDestinationCount = A.filter(dispositions, (value) => value === "mutated").length;
  yield* requireCollectorDenominator("Collector row", options.expectedCollectorRowCount, lines.length);
  yield* requireCollectorDenominator(
    "Mutated-destination",
    options.expectedMutatedDestinationCount,
    mutatedDestinationCount
  );
  const absentTreeExists = yield* fs
    .exists(options.absentRecycleTreePath)
    .pipe(CorpusCommandError.mapError("Failed checking the recorded absent recycle tree."));
  if (absentTreeExists) {
    return yield* archiveError(
      "The recorded absent recycle tree unexpectedly exists; opening evidence must be re-ratified."
    );
  }
  return { collectorErrorCount, mutatedDestinationCount, rowCount: lines.length };
});

const makeArchiveFilePass = Effect.fn("CorpusRestoration.makeArchiveFilePass")(function* (
  context: ArchiveAttemptContext,
  preCopySource: ReturnType<typeof sourceStat>,
  postCopySource: ReturnType<typeof sourceStat>,
  digest: { readonly sha256: Sha256Hex; readonly sizeBytes: number },
  resumedBytes: number
): Effect.fn.Return<ArchiveCopyAttemptOutcome> {
  return ArchiveLedgerRecord.cases["archive-file-pass"].make({
    attemptId: context.attemptId,
    destinationRelativePath: context.object.destinationRelativePath,
    objectId: context.object.objectId,
    objectKind: context.object.objectKind,
    postCopySource,
    preCopySource,
    recordedAt: yield* recordedAt(),
    recordType: "archive-file-pass",
    resumedBytes: nonNegative(resumedBytes),
    runId: context.runId,
    schemaVersion,
    sha256: digest.sha256,
    sizeBytes: nonNegative(digest.sizeBytes),
    sourceLabel: context.object.sourceLabel,
    sourceRelativePath: context.object.sourceRelativePath,
  });
});

const recordArchiveSourceChange = Effect.fn("CorpusRestoration.recordArchiveSourceChange")(function* (
  context: ArchiveAttemptContext,
  preCopySource: ReturnType<typeof sourceStat>,
  postCopySource: ReturnType<typeof sourceStat>
): Effect.fn.Return<ArchiveCopyAttemptOutcome, CorpusCommandError, RestorationRequirements> {
  const record = ArchiveLedgerRecord.cases["archive-changed-during-copy"].make({
    attemptId: context.attemptId,
    destinationRelativePath: context.object.destinationRelativePath,
    objectId: context.object.objectId,
    postCopySource,
    preCopySource,
    recordedAt: yield* recordedAt(),
    recordType: "archive-changed-during-copy",
    runId: context.runId,
    schemaVersion,
    sourceLabel: context.object.sourceLabel,
    sourceRelativePath: context.object.sourceRelativePath,
  });
  yield* appendArchiveRecord(context.manifestPath, record);
  return record;
});

const reconcileCompleteArchiveDestination = Effect.fn("CorpusRestoration.reconcileCompleteDestination")(function* (
  context: ArchiveAttemptContext,
  preCopySource: ReturnType<typeof sourceStat>
): Effect.fn.Return<O.Option<ArchiveCopyAttemptOutcome>, CorpusCommandError, RestorationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const destinationExists = yield* fs
    .exists(context.destinationPath)
    .pipe(CorpusCommandError.mapError("Failed checking complete archive destination."));
  if (!destinationExists) return O.none();
  const destinationInfo = yield* fs
    .stat(context.destinationPath)
    .pipe(CorpusCommandError.mapError("Failed inspecting complete archive destination."));
  if (destinationInfo.type !== "File") {
    return yield* archiveError("Existing complete archive destination is not a regular file.");
  }
  const [sourceHash, destinationHash, postInfo] = yield* Effect.all([
    hashRestorationFileStreaming(context.object.sourcePath, context.chunkSize),
    hashRestorationFileStreaming(context.destinationPath, context.chunkSize),
    fs
      .stat(context.object.sourcePath)
      .pipe(CorpusCommandError.mapError("Failed re-inspecting complete archive source.")),
  ]);
  const postCopySource = sourceStat(postInfo);
  if (!isSameSourceStat(preCopySource, postCopySource)) {
    return O.some(yield* recordArchiveSourceChange(context, preCopySource, postCopySource));
  }
  if (sourceHash.sha256 === destinationHash.sha256 && sourceHash.sizeBytes === destinationHash.sizeBytes) {
    return O.some(
      yield* makeArchiveFilePass(context, preCopySource, postCopySource, destinationHash, destinationHash.sizeBytes)
    );
  }
  const partialExists = yield* fs
    .exists(context.partialPath)
    .pipe(CorpusCommandError.mapError("Failed checking partial beside a mismatched complete destination."));
  yield* fs
    .rename(
      context.destinationPath,
      partialExists ? `${context.partialPath}.rejected-${context.attemptId}` : context.partialPath
    )
    .pipe(CorpusCommandError.mapError("Failed retaining mismatched complete destination for resumable replacement."));
  yield* syncRestorationDirectory(context.destinationDirectory);
  return O.none();
});

const resumableArchiveOffset = Effect.fn("CorpusRestoration.resumableArchiveOffset")(function* (
  context: ArchiveAttemptContext,
  sourceSizeBytes: number
): Effect.fn.Return<number, CorpusCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const partialExists = yield* fs
    .exists(context.partialPath)
    .pipe(CorpusCommandError.mapError("Failed checking partial archive destination."));
  if (!partialExists) return 0;
  const partialInfo = yield* fs
    .stat(context.partialPath)
    .pipe(CorpusCommandError.mapError("Failed inspecting partial archive destination."));
  const resumeBytes = Number(partialInfo.size);
  if (resumeBytes > sourceSizeBytes) return 0;
  const matches = yield* prefixMatches(context.object.sourcePath, context.partialPath, resumeBytes, context.chunkSize);
  return matches ? resumeBytes : 0;
});

const hashResumedArchivePrefix = Effect.fn("CorpusRestoration.hashResumedPrefix")(function* (
  sourcePath: string,
  resumeBytes: number,
  chunkSize: number,
  hasher: ReturnType<typeof sha256.create>
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Scope.Scope> {
  const fs = yield* FileSystem.FileSystem;
  const prefix = yield* fs
    .open(sourcePath, { flag: "r" })
    .pipe(CorpusCommandError.mapError("Failed reopening source to hash resumed prefix."));
  let remaining = resumeBytes;
  while (remaining > 0) {
    const chunk = yield* prefix
      .readAlloc(Math.min(chunkSize, remaining))
      .pipe(CorpusCommandError.mapError("Failed hashing resumed source prefix."));
    if (O.isNone(chunk)) return yield* archiveError("Source ended before the verified partial prefix.");
    hasher.update(chunk.value);
    remaining -= chunk.value.length;
  }
});

const copyArchiveRemainder = Effect.fn("CorpusRestoration.copyArchiveRemainder")(function* (
  source: FileSystem.File,
  destination: FileSystem.File,
  chunkSize: number,
  hasher: ReturnType<typeof sha256.create>
): Effect.fn.Return<void, CorpusCommandError> {
  while (true) {
    const chunk = yield* source
      .readAlloc(chunkSize)
      .pipe(CorpusCommandError.mapError("Failed reading preservation source during streaming copy."));
    if (O.isNone(chunk)) return;
    hasher.update(chunk.value);
    yield* destination
      .writeAll(chunk.value)
      .pipe(CorpusCommandError.mapError("Failed writing preservation destination during streaming copy."));
  }
});

const copyArchiveBytes = Effect.fn("CorpusRestoration.copyArchiveBytes")(function* (
  context: ArchiveAttemptContext,
  resumeBytes: number
): Effect.fn.Return<Sha256Hex, CorpusCommandError, FileSystem.FileSystem | Scope.Scope> {
  const fs = yield* FileSystem.FileSystem;
  const source = yield* fs
    .open(context.object.sourcePath, { flag: "r" })
    .pipe(CorpusCommandError.mapError("Failed opening preservation source for streaming copy."));
  const destination = yield* fs
    .open(context.partialPath, { flag: resumeBytes > 0 ? "a" : "w" })
    .pipe(CorpusCommandError.mapError("Failed opening partial preservation destination."));
  yield* source.seek(resumeBytes, "start");
  const hasher = sha256.create();
  if (resumeBytes > 0) {
    yield* hashResumedArchivePrefix(context.object.sourcePath, resumeBytes, context.chunkSize, hasher);
  }
  yield* copyArchiveRemainder(source, destination, context.chunkSize, hasher);
  yield* destination.sync.pipe(CorpusCommandError.mapError("Failed syncing preservation payload."));
  return Sha256Hex.make(bytesToHex(hasher.digest()));
});

const promoteAndVerifyArchiveCopy = Effect.fn("CorpusRestoration.promoteAndVerifyArchiveCopy")(function* (
  context: ArchiveAttemptContext,
  options: RestorationPreserveOptions,
  preCopySource: ReturnType<typeof sourceStat>,
  postCopySource: ReturnType<typeof sourceStat>,
  copiedDigest: Sha256Hex,
  resumeBytes: number
): Effect.fn.Return<ArchiveCopyAttemptOutcome, CorpusCommandError, RestorationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .rename(context.partialPath, context.destinationPath)
    .pipe(CorpusCommandError.mapError("Failed atomically promoting preservation destination."));
  yield* syncRestorationDirectory(context.destinationDirectory);
  yield* maybeCrash(options.crashPoint, "after-rename");
  const destinationHash = yield* hashRestorationFileStreaming(context.destinationPath, context.chunkSize);
  if (destinationHash.sha256 !== copiedDigest || destinationHash.sizeBytes !== postCopySource.sizeBytes) {
    return yield* archiveError(
      `Independently hashed destination failed verification (digestMatch=${destinationHash.sha256 === copiedDigest}, destinationBytes=${destinationHash.sizeBytes}, sourceBytes=${postCopySource.sizeBytes}).`
    );
  }
  yield* maybeCrash(options.crashPoint, "before-pass");
  return yield* makeArchiveFilePass(context, preCopySource, postCopySource, destinationHash, resumeBytes);
});

const copyOneArchiveObject = Effect.fn("CorpusRestoration.copyOneArchiveObject")(function* (
  object: ArchiveSourceObject,
  options: RestorationPreserveOptions,
  archiveRoot: string,
  manifestPath: string,
  runId: string
): Effect.fn.Return<ArchiveLedgerRecord, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const destinationPath = path.join(archiveRoot, object.destinationRelativePath);
  const destinationDirectory = path.dirname(destinationPath);
  yield* fs
    .makeDirectory(destinationDirectory, { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating archive destination directory."));

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const context: ArchiveAttemptContext = {
      attemptId: `${runId}:${object.objectId}:${attempt}`,
      chunkSize: Math.max(1, options.chunkSizeBytes),
      destinationDirectory,
      destinationPath,
      manifestPath,
      object,
      partialPath: `${destinationPath}.partial`,
      runId,
    };
    const preInfo = yield* fs
      .stat(object.sourcePath)
      .pipe(CorpusCommandError.mapError("Failed inspecting source before copy."));
    const preCopySource = sourceStat(preInfo);
    const existingOutcome = yield* reconcileCompleteArchiveDestination(context, preCopySource);
    if (O.isSome(existingOutcome)) {
      if (existingOutcome.value.recordType === "archive-file-pass") return existingOutcome.value;
      continue;
    }

    const resumeBytes = yield* resumableArchiveOffset(context, preCopySource.sizeBytes);
    const copiedDigest = yield* Effect.scoped(copyArchiveBytes(context, resumeBytes));
    yield* maybeCrash(options.crashPoint, "after-payload-sync");

    const postInfo = yield* fs
      .stat(object.sourcePath)
      .pipe(CorpusCommandError.mapError("Failed inspecting source after copy."));
    const postCopySource = sourceStat(postInfo);
    if (!isSameSourceStat(preCopySource, postCopySource)) {
      yield* recordArchiveSourceChange(context, preCopySource, postCopySource);
      continue;
    }
    return yield* promoteAndVerifyArchiveCopy(
      context,
      options,
      preCopySource,
      postCopySource,
      copiedDigest,
      resumeBytes
    );
  }
  return yield* archiveError("Source remained unstable across all bounded preservation attempts.");
});

const appendProvenance = Effect.fn("CorpusRestoration.appendProvenance")(function* (
  provenancePath: string,
  archiveRoot: string,
  source: ArchiveSourceObject,
  pass: ArchiveLedgerRecord,
  salvagedAt: string
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  if (pass.recordType !== "archive-file-pass") return;
  const path = yield* Path.Path;
  const record = CorpusProvenanceRecord.make({
    copyMode: "copied",
    destPath: path.join(archiveRoot, pass.destinationRelativePath),
    mtimeEpoch: Math.floor(pass.postCopySource.mtimeMillis / 1000),
    mtimeIso: DateTime.formatIso(DateTime.makeUnsafe(pass.postCopySource.mtimeMillis)),
    originPath: source.sourcePath,
    relativePath: pass.destinationRelativePath,
    salvagedAt,
    sha256: pass.sha256,
    sizeBytes: pass.sizeBytes,
    sourceLabel: source.sourceLabel,
  });
  const fs = yield* FileSystem.FileSystem;
  if (yield* fs.exists(provenancePath).pipe(CorpusCommandError.mapError("Failed checking restoration provenance."))) {
    const existingLines = A.filter(
      Str.split(/\r?\n/u)(
        yield* fs
          .readFileString(provenancePath)
          .pipe(CorpusCommandError.mapError("Failed reading restoration provenance for resume reconciliation."))
      ),
      Str.isNonEmpty
    );
    const existing = yield* Effect.forEach(existingLines, (line) =>
      decodeCorpusProvenanceRecordJson(line).pipe(
        CorpusCommandError.mapError("Existing restoration provenance failed resume decoding.")
      )
    );
    const destinationRows = A.filter(existing, (candidate) => candidate.destPath === record.destPath);
    if (destinationRows.length > 0) {
      const exact = A.some(
        destinationRows,
        (candidate) =>
          candidate.mtimeEpoch === record.mtimeEpoch &&
          candidate.mtimeIso === record.mtimeIso &&
          candidate.originPath === record.originPath &&
          candidate.relativePath === record.relativePath &&
          candidate.sha256 === record.sha256 &&
          candidate.sizeBytes === record.sizeBytes &&
          candidate.sourceLabel === record.sourceLabel
      );
      if (!exact || destinationRows.length !== 1) {
        return yield* archiveError("Restoration provenance destination already has contradictory or duplicate rows.");
      }
      return;
    }
  }
  const encoded = yield* encodeCorpusProvenanceRecordJson(record).pipe(
    CorpusCommandError.mapError("Restoration provenance row failed JSONL encoding.")
  );
  yield* appendRestorationTextDurably(provenancePath, `${encoded}\n`);
});

const sealArchiveManifest = Effect.fn("CorpusRestoration.sealArchiveManifest")(function* (
  manifestPath: string,
  runId: string,
  chunkSize: number
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs
    .readFileString(manifestPath)
    .pipe(CorpusCommandError.mapError("Failed reparsing archive manifest before sealing."));
  const recordCount = A.length(A.filter(Str.split(/\r?\n/u)(text), Str.isNonEmpty));
  const digest = yield* hashRestorationFileStreaming(manifestPath, chunkSize);
  yield* appendArchiveRecord(
    manifestPath,
    ArchiveLedgerRecord.cases["archive-manifest-seal"].make({
      manifestSha256: digest.sha256,
      recordCount: nonNegative(recordCount),
      recordedAt: yield* recordedAt(),
      recordType: "archive-manifest-seal",
      runId,
      schemaVersion,
    })
  );
});

/**
 * Preserve the ratified current corpus state through a bounded, resumable archive run.
 *
 * @param options - Explicit source locations, frozen denominators, and approved capacity policy.
 * @returns Aggregate preservation counts and byte/time measurements.
 * @effects Reads the source estate and collector ledger, writes only the out-of-repo corpus archive and append-only ledgers, and fails before payload writes when capacity or opening evidence drifts.
 * @category use-cases
 * @since 0.0.0
 */
export const preserveRestorationArchiveImpl = Effect.fn("CorpusRestoration.preserveArchive")(function* (
  options: RestorationPreserveOptions
): Effect.fn.Return<RestorationRunSummary, CorpusCommandError, RestorationRequirements> {
  const startedAt = DateTime.toEpochMillis(yield* DateTime.now);
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const inventory = yield* collectArchiveInventory(options);
  yield* validateArchiveInventoryDenominators(options, inventory);
  const collector = yield* reconcileCollectorManifest(options);
  const corpusRoot = path.resolve(options.corpusRoot);
  const archiveRoot = path.join(corpusRoot, "raw", options.runLabel);
  const manifestPath = path.join(archiveRoot, "archive-ledger.jsonl");
  const provenancePath = path.join(corpusRoot, "raw", "provenance.jsonl");
  const priorManifestExists = yield* fs
    .exists(manifestPath)
    .pipe(CorpusCommandError.mapError("Failed checking prior preservation manifest."));
  const priorManifestRows = priorManifestExists
    ? A.length(
        A.filter(
          Str.split(/\r?\n/u)(
            yield* fs
              .readFileString(manifestPath)
              .pipe(CorpusCommandError.mapError("Failed reading prior preservation manifest."))
          ),
          Str.isNonEmpty
        )
      )
    : 0;
  const runId = `${options.runLabel}:${startedAt}:${priorManifestRows}`;
  const availableBytes = yield* availableRestorationBytesAt(corpusRoot);
  const capacityApproved =
    inventory.requiredBytes <= options.capacityCeilingBytes &&
    availableBytes >= inventory.requiredBytes + options.minimumFreeAfterBytes;

  yield* fs
    .makeDirectory(archiveRoot, { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating preservation run root."));
  yield* appendArchiveRecord(
    manifestPath,
    ArchiveLedgerRecord.cases["archive-preflight"].make({
      approved: capacityApproved,
      approvedCeilingBytes: options.capacityCeilingBytes,
      availableBytes: nonNegative(availableBytes),
      directoryCount: nonNegative(inventory.directories.length),
      fileCount: nonNegative(inventory.files.length),
      minimumFreeAfterBytes: options.minimumFreeAfterBytes,
      recordedAt: yield* recordedAt(),
      recordType: "archive-preflight",
      requiredBytes: nonNegative(inventory.requiredBytes),
      runId,
      schemaVersion,
    })
  );
  if (!capacityApproved) {
    yield* appendArchiveRecord(
      manifestPath,
      ArchiveLedgerRecord.cases["archive-failure"].make({
        approved: false,
        failureKind: "capacity-denied",
        message: "Required payload or retained free-space floor exceeds the approved capacity policy.",
        objectId: "archive-run",
        recordedAt: yield* recordedAt(),
        recordType: "archive-failure",
        runId,
        schemaVersion,
        sourceLabel: "archive-run",
        sourceRelativePath: ".",
      })
    );
    return yield* archiveError("Preservation capacity preflight denied payload writes.");
  }

  for (const [category, count] of [
    ["collector-error", collector.collectorErrorCount],
    ["missing-recycle-payload", options.expectedMissingRecyclePayloadCount],
    ["mutated-destination", collector.mutatedDestinationCount],
    ["stripped-filesystem-metadata", inventory.files.length + inventory.directories.length],
  ] as const) {
    yield* appendArchiveRecord(
      manifestPath,
      ArchiveLedgerRecord.cases["inherited-loss"].make({
        approved: true,
        category,
        count: nonNegative(count),
        recordedAt: yield* recordedAt(),
        recordType: "inherited-loss",
        runId,
        schemaVersion,
      })
    );
  }

  for (const directory of inventory.directories) {
    const destination = path.join(archiveRoot, directory.destinationRelativePath);
    yield* fs
      .makeDirectory(destination, { recursive: true })
      .pipe(CorpusCommandError.mapError("Failed creating preservation directory object."));
    yield* syncRestorationDirectory(destination);
    yield* syncRestorationDirectory(path.dirname(destination));
    yield* appendArchiveRecord(
      manifestPath,
      ArchiveLedgerRecord.cases["archive-directory-pass"].make({
        destinationRelativePath: directory.destinationRelativePath,
        objectId: directory.objectId,
        objectKind: "directory",
        recordedAt: yield* recordedAt(),
        recordType: "archive-directory-pass",
        runId,
        schemaVersion,
        sourceLabel: directory.sourceLabel,
        sourceRelativePath: directory.sourceRelativePath,
      })
    );
  }

  const salvagedAt = yield* recordedAt();
  for (const source of inventory.files) {
    const pass = yield* copyOneArchiveObject(source, options, archiveRoot, manifestPath, runId).pipe(
      Effect.catch((error) =>
        Effect.gen(function* () {
          yield* appendArchiveRecord(
            manifestPath,
            ArchiveLedgerRecord.cases["archive-failure"].make({
              approved: false,
              failureKind: "unreadable",
              message: error.message,
              objectId: source.objectId,
              recordedAt: yield* recordedAt(),
              recordType: "archive-failure",
              runId,
              schemaVersion,
              sourceLabel: source.sourceLabel,
              sourceRelativePath: source.sourceRelativePath,
            })
          );
          return yield* error;
        })
      )
    );
    yield* appendArchiveRecord(manifestPath, pass);
    yield* appendProvenance(provenancePath, archiveRoot, source, pass, salvagedAt);
  }
  yield* sealArchiveManifest(manifestPath, runId, Math.max(1, options.chunkSizeBytes));

  const completedAt = DateTime.toEpochMillis(yield* DateTime.now);
  const summary = RestorationRunSummary.make({
    elapsedMillis: nonNegative(completedAt - startedAt),
    exceptionCount: nonNegative(0),
    family: "preservation",
    inputBytes: nonNegative(inventory.requiredBytes),
    outputBytes: nonNegative(inventory.requiredBytes),
    passCount: nonNegative(inventory.files.length + inventory.directories.length),
    sourceCount: nonNegative(inventory.files.length + inventory.directories.length),
    unapprovedCount: nonNegative(0),
  });
  yield* Console.log(
    `corpus restoration preserve: objects=${summary.sourceCount} bytes=${summary.outputBytes} unapproved=${summary.unapprovedCount}`
  );
  return summary;
});

const verificationFailure = (
  objectId: string,
  failureKind:
    | "digest-mismatch"
    | "duplicate-object"
    | "manifest-corrupt"
    | "manifest-unsealed"
    | "missing-destination"
    | "unapproved-terminal",
  message: string
): ArchiveVerificationRecord =>
  ArchiveVerificationRecord.cases["verification-failure"].make({
    failureKind,
    message,
    objectId,
    recordType: "verification-failure",
  });

const persistVerificationReport = Effect.fn("CorpusRestoration.persistVerificationReport")(function* (
  archiveRoot: string,
  records: ReadonlyArray<ArchiveVerificationRecord>
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lines = yield* Effect.forEach(records, (record) =>
    encodeArchiveVerificationRecordJson(record).pipe(
      CorpusCommandError.mapError("Archive verification row failed JSONL encoding.")
    )
  );
  const text = lines.length === 0 ? "" : `${A.join(lines, "\n")}\n`;
  const directory = path.join(archiveRoot, "verification");
  const destinationPath = path.join(directory, `${digestText(text)}.jsonl`);
  const partialPath = `${destinationPath}.partial`;
  yield* fs
    .makeDirectory(directory, { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating archive verification report directory."));
  if (yield* fs.exists(destinationPath).pipe(CorpusCommandError.mapError("Failed checking verification report."))) {
    const existing = yield* fs
      .readFileString(destinationPath)
      .pipe(CorpusCommandError.mapError("Failed reading existing verification report."));
    if (existing !== text) return yield* archiveError("Content-addressed verification report bytes drifted.");
    return;
  }
  if (yield* fs.exists(partialPath).pipe(CorpusCommandError.mapError("Failed checking partial verification report."))) {
    const partial = yield* fs
      .readFileString(partialPath)
      .pipe(CorpusCommandError.mapError("Failed reading partial verification report."));
    if (partial !== text) return yield* archiveError("Partial verification report bytes drifted.");
  } else {
    yield* appendRestorationTextDurably(partialPath, text);
  }
  yield* fs
    .rename(partialPath, destinationPath)
    .pipe(CorpusCommandError.mapError("Failed atomically promoting archive verification report."));
  yield* syncRestorationDirectory(directory);
});

const failArchiveVerification = Effect.fn("CorpusRestoration.failVerification")(function* (
  archiveRoot: string,
  failureKind: Parameters<typeof verificationFailure>[1],
  message: string,
  objectId = "archive-manifest"
): Effect.fn.Return<never, CorpusCommandError, RestorationRequirements> {
  yield* persistVerificationReport(archiveRoot, [verificationFailure(objectId, failureKind, message)]);
  return yield* archiveError(message);
});

const readArchiveManifest = Effect.fn("CorpusRestoration.readArchiveManifest")(function* (
  manifestPath: string
): Effect.fn.Return<
  { readonly lines: ReadonlyArray<string>; readonly records: ReadonlyArray<ArchiveLedgerRecord> },
  CorpusCommandError,
  FileSystem.FileSystem
> {
  const fs = yield* FileSystem.FileSystem;
  const manifestBytes = yield* fs
    .readFile(manifestPath)
    .pipe(CorpusCommandError.mapError("Failed reading preservation manifest for independent verification."));
  const lines = A.filter(Str.split(/\r?\n/u)(textDecoder.decode(manifestBytes)), Str.isNonEmpty);
  const records = yield* Effect.forEach(lines, (line) =>
    decodeArchiveLedgerRecordJson(line).pipe(
      CorpusCommandError.mapError("Preservation manifest failed fresh-process schema decoding.")
    )
  );
  return { lines, records };
});

const validateArchiveManifestSeal = Effect.fn("CorpusRestoration.validateManifestSeal")(function* (
  archiveRoot: string,
  lines: ReadonlyArray<string>,
  records: ReadonlyArray<ArchiveLedgerRecord>
): Effect.fn.Return<ArchiveManifestSeal, CorpusCommandError, RestorationRequirements> {
  if (lines.length === 0) {
    return yield* failArchiveVerification(
      archiveRoot,
      "manifest-unsealed",
      "Preservation manifest is empty and unsealed."
    );
  }
  const seal = records[records.length - 1];
  if (seal === undefined) {
    return yield* failArchiveVerification(
      archiveRoot,
      "manifest-corrupt",
      "Preservation manifest is empty after schema decoding."
    );
  }
  if (seal.recordType !== "archive-manifest-seal") {
    return yield* failArchiveVerification(
      archiveRoot,
      "manifest-unsealed",
      "Preservation manifest terminal row is not a seal."
    );
  }
  const coveredLines = A.dropRight(lines, 1);
  const coveredText = A.length(coveredLines) === 0 ? "" : `${A.join(coveredLines, "\n")}\n`;
  if (
    digestBytes(textEncoder.encode(coveredText)) !== seal.manifestSha256 ||
    coveredLines.length !== seal.recordCount
  ) {
    return yield* failArchiveVerification(
      archiveRoot,
      "manifest-corrupt",
      "Preservation manifest seal digest or row count does not match exact covered bytes."
    );
  }
  return seal;
});

const validateCurrentArchiveRun = Effect.fn("CorpusRestoration.validateCurrentRun")(function* (
  archiveRoot: string,
  records: ReadonlyArray<ArchiveLedgerRecord>,
  seal: ArchiveManifestSeal
): Effect.fn.Return<
  { readonly currentPreflight: ArchivePreflight; readonly currentRecords: ReadonlyArray<ArchiveLedgerRecord> },
  CorpusCommandError,
  RestorationRequirements
> {
  const currentRecords = A.filter(records, (record) => record.runId === seal.runId);
  const currentPreflights = A.filter(currentRecords, (record) => record.recordType === "archive-preflight");
  if (currentPreflights.length !== 1) {
    return yield* failArchiveVerification(
      archiveRoot,
      "manifest-corrupt",
      "Current sealed run must contain exactly one capacity preflight row."
    );
  }
  const currentPreflight = currentPreflights[0];
  if (currentPreflight === undefined) {
    return yield* failArchiveVerification(
      archiveRoot,
      "manifest-corrupt",
      "Current sealed run capacity preflight is missing after reconciliation."
    );
  }
  if (!currentPreflight.approved) {
    return yield* failArchiveVerification(
      archiveRoot,
      "unapproved-terminal",
      "Current sealed run does not have an approved capacity preflight."
    );
  }
  const inheritedLossRows = A.filter(currentRecords, (record) => record.recordType === "inherited-loss");
  if (inheritedLossRows.length !== 4) {
    return yield* failArchiveVerification(
      archiveRoot,
      "manifest-corrupt",
      "Current sealed run does not contain all four inherited-loss opening classes."
    );
  }
  return { currentPreflight, currentRecords };
});

const isArchiveTerminalRecord = (record: ArchiveLedgerRecord): record is ArchiveTerminalRecord =>
  record.recordType === "archive-directory-pass" ||
  record.recordType === "archive-failure" ||
  record.recordType === "archive-file-pass";

const indexArchiveTerminals = (records: ReadonlyArray<ArchiveLedgerRecord>): ArchiveTerminalIndex => {
  const terminals = new Map<string, ArchiveTerminalRecord>();
  let duplicateObjectId = O.none<string>();
  for (const record of records) {
    if (!isArchiveTerminalRecord(record)) continue;
    if (terminals.has(record.objectId)) {
      if (O.isNone(duplicateObjectId)) duplicateObjectId = O.some(record.objectId);
      continue;
    }
    terminals.set(record.objectId, record);
  }
  return { duplicateObjectId, terminals };
};

const validateArchiveTerminalIndex = Effect.fn("CorpusRestoration.validateTerminalIndex")(function* (
  archiveRoot: string,
  records: ReadonlyArray<ArchiveLedgerRecord>,
  preflight: ArchivePreflight
): Effect.fn.Return<Map<string, ArchiveTerminalRecord>, CorpusCommandError, RestorationRequirements> {
  const index = indexArchiveTerminals(records);
  if (O.isSome(index.duplicateObjectId)) {
    return yield* failArchiveVerification(
      archiveRoot,
      "duplicate-object",
      "Current sealed run contains duplicate terminal rows for one archive object.",
      index.duplicateObjectId.value
    );
  }
  if (index.terminals.size !== preflight.directoryCount + preflight.fileCount) {
    return yield* failArchiveVerification(
      archiveRoot,
      "manifest-corrupt",
      "Current sealed run terminal count does not reconcile to its approved preflight denominator."
    );
  }
  return index.terminals;
});

const verificationPass = (
  objectId: string,
  destinationRelativePath: string,
  sha256: Sha256Hex,
  sizeBytes: number
): ArchiveVerificationRecord =>
  ArchiveVerificationRecord.cases["verification-pass"].make({
    destinationRelativePath,
    objectId,
    recordType: "verification-pass",
    sha256,
    sizeBytes: nonNegative(sizeBytes),
  });

const verifyArchiveDirectory = Effect.fn("CorpusRestoration.verifyDirectory")(function* (
  objectId: string,
  terminal: Extract<ArchiveTerminalRecord, { readonly recordType: "archive-directory-pass" }>,
  destinationPath: string
): Effect.fn.Return<TerminalVerificationOutcome, CorpusCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs
    .stat(destinationPath)
    .pipe(CorpusCommandError.mapError("Failed inspecting archive directory destination."));
  if (info.type !== "Directory") {
    return {
      bytesVerified: 0,
      record: O.some(verificationFailure(objectId, "missing-destination", "Terminal directory is not a directory.")),
    };
  }
  return {
    bytesVerified: 0,
    record: O.some(verificationPass(objectId, terminal.destinationRelativePath, digestBytes(new Uint8Array()), 0)),
  };
});

const verifyArchiveFile = Effect.fn("CorpusRestoration.verifyFile")(function* (
  objectId: string,
  terminal: Extract<ArchiveTerminalRecord, { readonly recordType: "archive-file-pass" }>,
  destinationPath: string
): Effect.fn.Return<TerminalVerificationOutcome, CorpusCommandError, FileSystem.FileSystem> {
  const digest = yield* hashRestorationFileStreaming(destinationPath, 8 * 1024 * 1024);
  if (digest.sha256 !== terminal.sha256 || digest.sizeBytes !== terminal.sizeBytes) {
    return {
      bytesVerified: digest.sizeBytes,
      record: O.some(verificationFailure(objectId, "digest-mismatch", "Terminal destination bytes do not match PASS.")),
    };
  }
  return {
    bytesVerified: digest.sizeBytes,
    record: O.some(verificationPass(objectId, terminal.destinationRelativePath, digest.sha256, digest.sizeBytes)),
  };
});

const verifyArchiveTerminal = Effect.fn("CorpusRestoration.verifyTerminal")(function* (
  archiveRoot: string,
  objectId: string,
  terminal: ArchiveTerminalRecord
): Effect.fn.Return<TerminalVerificationOutcome, CorpusCommandError, RestorationRequirements> {
  if (terminal.recordType === "archive-failure") {
    return {
      bytesVerified: 0,
      record: terminal.approved
        ? O.none()
        : O.some(verificationFailure(objectId, "unapproved-terminal", "Current terminal failure is unapproved.")),
    };
  }
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const destinationPath = path.join(archiveRoot, terminal.destinationRelativePath);
  const exists = yield* fs
    .exists(destinationPath)
    .pipe(CorpusCommandError.mapError("Failed checking archive verification destination."));
  if (!exists) {
    return {
      bytesVerified: 0,
      record: O.some(verificationFailure(objectId, "missing-destination", "Terminal archive destination is missing.")),
    };
  }
  return terminal.recordType === "archive-directory-pass"
    ? yield* verifyArchiveDirectory(objectId, terminal, destinationPath)
    : yield* verifyArchiveFile(objectId, terminal, destinationPath);
});

/**
 * Independently reparse and verify a sealed preservation manifest against destination bytes.
 *
 * @param options - Corpus root and immutable preservation run label.
 * @returns Aggregate verification counts and byte measurements.
 * @effects Reads the sealed out-of-repo manifest and streams every terminal destination object; it writes no payload bytes.
 * @category use-cases
 * @since 0.0.0
 */
export const verifyRestorationArchiveImpl = Effect.fn("CorpusRestoration.verifyArchive")(function* (
  options: RestorationVerifyOptions
): Effect.fn.Return<RestorationRunSummary, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const startedAt = DateTime.toEpochMillis(yield* DateTime.now);
  const path = yield* Path.Path;
  const archiveRoot = path.join(path.resolve(options.corpusRoot), "raw", options.runLabel);
  const manifestPath = path.join(archiveRoot, "archive-ledger.jsonl");
  const { lines, records } = yield* readArchiveManifest(manifestPath);
  const seal = yield* validateArchiveManifestSeal(archiveRoot, lines, records);
  const { currentPreflight, currentRecords } = yield* validateCurrentArchiveRun(archiveRoot, records, seal);
  const terminals = yield* validateArchiveTerminalIndex(archiveRoot, currentRecords, currentPreflight);
  const outcomes = yield* Effect.forEach(A.fromIterable(terminals), ([objectId, terminal]) =>
    verifyArchiveTerminal(archiveRoot, objectId, terminal)
  );
  const results = A.getSomes(A.map(outcomes, (outcome) => outcome.record));
  const bytesVerified = A.reduce(outcomes, 0, (total, outcome) => total + outcome.bytesVerified);
  const failures = A.filter(results, (record) => record.recordType === "verification-failure");
  yield* persistVerificationReport(archiveRoot, results);
  if (failures.length > 0) {
    return yield* archiveError(`Independent preservation verification found ${failures.length} terminal failure(s).`);
  }
  const completedAt = DateTime.toEpochMillis(yield* DateTime.now);
  const summary = RestorationRunSummary.make({
    elapsedMillis: nonNegative(completedAt - startedAt),
    exceptionCount: nonNegative(0),
    family: "preservation",
    inputBytes: nonNegative(bytesVerified),
    outputBytes: nonNegative(bytesVerified),
    passCount: nonNegative(results.length),
    sourceCount: nonNegative(terminals.size),
    unapprovedCount: nonNegative(0),
  });
  yield* Console.log(
    `corpus restoration verify: terminals=${summary.sourceCount} passes=${summary.passCount} bytes=${summary.inputBytes}`
  );
  return summary;
});
