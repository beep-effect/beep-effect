/**
 * Bounded corpus preservation and independent verification programs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { randomUUID } from "node:crypto";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { Console, DateTime, Effect, FileSystem, HashMap, HashSet, Order, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
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

const schemaVersion = "oppold-corpus-restoration/v1";
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();
const maximumWriterClaimBytes = 16 * 1024;

const RestorationWriterClaim = S.Struct({
  bootId: S.NonEmptyString,
  pid: S.Int,
  procStart: S.NonEmptyString,
  schemaVersion: S.Literal("oppold-preservation-writer/v2"),
  startedAt: S.String,
  token: S.NonEmptyString,
});
const RestorationWriterClaimJson = S.fromJsonString(RestorationWriterClaim);
const decodeRestorationWriterClaim = S.decodeUnknownEffect(RestorationWriterClaimJson);
const encodeRestorationWriterClaim = S.encodeEffect(RestorationWriterClaimJson);

type RestorationRequirements = FileSystem.FileSystem | Path.Path;

type ArchiveSourceObject = {
  readonly destinationRelativePath: string;
  readonly expectedInfo: SourceIdentity;
  readonly expectedSizeBytes: number;
  readonly objectId: string;
  readonly objectKind: "file" | "root-archive";
  readonly sourceLabel: string;
  readonly sourcePath: string;
  readonly sourceRelativePath: string;
};

type ArchiveDirectoryObject = {
  readonly destinationRelativePath: string;
  readonly expectedInfo: SourceIdentity;
  readonly objectId: string;
  readonly sourceLabel: string;
  readonly sourceRelativePath: string;
};

type ArchiveInventory = {
  readonly directories: ReadonlyArray<ArchiveDirectoryObject>;
  readonly files: ReadonlyArray<ArchiveSourceObject>;
  readonly requiredBytes: number;
  readonly rootArchiveBytes: number;
  readonly signature: Sha256Hex;
  readonly sourceTreeBytes: number;
};

type SourceIdentity = {
  readonly device: number;
  readonly inode: O.Option<number>;
  readonly mode: number;
  readonly mtimeMillis: number;
  readonly sizeBytes: number;
  readonly type: FileSystem.File.Type;
};

type CanonicalArchivePaths = {
  readonly archiveRoot: string;
  readonly corpusRoot: string;
  readonly rootArchivePath: string;
  readonly sourceManifestPath: string;
  readonly sourceRoot: string;
};

type SuccessfulCollectorDisposition = {
  readonly kind: "mutated" | "present";
  readonly recordedSize: number;
  readonly relativePath: string;
};

type CollectorDisposition = SuccessfulCollectorDisposition | { readonly kind: "collector-error" | "ignored" };

type ArchiveTerminalRecord = Extract<
  ArchiveLedgerRecord,
  { readonly recordType: "archive-directory-pass" | "archive-failure" | "archive-file-pass" }
>;

type ArchiveCopyAttemptOutcome = Extract<
  ArchiveLedgerRecord,
  { readonly recordType: "archive-changed-during-copy" | "archive-file-pass" }
>;

type ArchiveFilePass = Extract<ArchiveLedgerRecord, { readonly recordType: "archive-file-pass" }>;

type ArchiveFileCopyResult = {
  readonly pass: ArchiveFilePass;
  readonly stableObject: ArchiveSourceObject;
};

type PartialArchiveState = {
  readonly expectedInfo: O.Option<SourceIdentity>;
  readonly resumeBytes: number;
};

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

type RestorationWriterClaimLease = {
  readonly claimPath: string;
  readonly claimText: string;
};

type ArchiveManifestSeal = Extract<ArchiveLedgerRecord, { readonly recordType: "archive-manifest-seal" }>;

type ArchivePreflight = Extract<ArchiveLedgerRecord, { readonly recordType: "archive-preflight" }>;

type ArchiveFailureKind = Extract<ArchiveLedgerRecord, { readonly recordType: "archive-failure" }>["failureKind"];

type InheritedLossCategory = Extract<ArchiveLedgerRecord, { readonly recordType: "inherited-loss" }>["category"];

type InheritedLossCount = readonly [category: InheritedLossCategory, count: number];

type PreservationWriteContext = {
  readonly archiveRoot: string;
  readonly availableBytes: number;
  readonly capacityApproved: boolean;
  readonly canonicalPaths: CanonicalArchivePaths;
  readonly collector: {
    readonly collectorErrorCount: number;
    readonly mutatedDestinationCount: number;
    readonly rowCount: number;
  };
  readonly inventory: ArchiveInventory;
  readonly manifestPath: string;
  readonly options: RestorationPreserveOptions;
  readonly provenancePath: string;
  readonly runId: string;
  readonly startedAt: number;
};

type ArchiveTerminalIndex = {
  readonly duplicateObjectId: O.Option<string>;
  readonly terminals: HashMap.HashMap<string, ArchiveTerminalRecord>;
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

const sourceIdentity = (info: FileSystem.File.Info): SourceIdentity => ({
  device: info.dev,
  inode: info.ino,
  mode: info.mode,
  mtimeMillis: O.match(info.mtime, {
    onNone: () => 0,
    onSome: (value) => DateTime.toEpochMillis(DateTime.makeUnsafe(value)),
  }),
  sizeBytes: Number(info.size),
  type: info.type,
});

const sameSourceIdentityExceptMtime = (left: SourceIdentity, right: SourceIdentity): boolean =>
  left.device === right.device &&
  O.getOrElse(left.inode, () => -1) === O.getOrElse(right.inode, () => -1) &&
  left.mode === right.mode &&
  left.sizeBytes === right.sizeBytes &&
  left.type === right.type;

const sameSourceIdentity = (left: SourceIdentity, right: SourceIdentity): boolean =>
  sameSourceIdentityExceptMtime(left, right) && left.mtimeMillis === right.mtimeMillis;

const sameDeviceAndInode = (left: SourceIdentity, right: SourceIdentity): boolean =>
  left.device === right.device &&
  O.isSome(left.inode) &&
  O.isSome(right.inode) &&
  left.inode.value === right.inode.value;

const isContainedPath = (path: Path.Path, parent: string, candidate: string): boolean => {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !Str.startsWith(`..${path.sep}`)(relative))
  );
};

const pathsOverlap = (path: Path.Path, left: string, right: string): boolean =>
  isContainedPath(path, left, right) || isContainedPath(path, right, left);

const inspectCanonicalPath = Effect.fn("CorpusRestoration.inspectCanonicalPath")(function* (
  candidate: string,
  expectedType: "Directory" | "File",
  message: string,
  symbolicLinkMessage: string
): Effect.fn.Return<{ info: FileSystem.File.Info; resolved: string }, CorpusCommandError, RestorationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolved = path.resolve(candidate);
  const canonical = yield* fs.realPath(resolved).pipe(CorpusCommandError.mapError(message));
  if (canonical !== resolved) return yield* archiveError(symbolicLinkMessage);
  const info = yield* fs.stat(resolved).pipe(CorpusCommandError.mapError(message));
  if (info.type !== expectedType) return yield* archiveError(message);
  return { info, resolved };
});

const requireContainedPath = Effect.fn("CorpusRestoration.requireContainedPath")(function* (
  path: Path.Path,
  parent: string,
  candidate: string,
  message: string,
  allowEqual: boolean
): Effect.fn.Return<string, CorpusCommandError> {
  const resolved = path.resolve(candidate);
  const contained = isContainedPath(path, parent, resolved);
  if (!contained || (!allowEqual && resolved === parent)) return yield* archiveError(message);
  return resolved;
});

const requireCanonicalExistingPath = Effect.fn("CorpusRestoration.requireCanonicalExistingPath")(function* (
  candidate: string,
  expectedType: "Directory" | "File",
  message: string
): Effect.fn.Return<string, CorpusCommandError, RestorationRequirements> {
  const { resolved } = yield* inspectCanonicalPath(
    candidate,
    expectedType,
    message,
    `${message} Symbolic-link traversal is not allowed.`
  );
  return resolved;
});

const validateCanonicalArchivePaths = Effect.fn("CorpusRestoration.validateCanonicalPaths")(function* (
  options: RestorationPreserveOptions
): Effect.fn.Return<CanonicalArchivePaths, CorpusCommandError, RestorationRequirements> {
  const path = yield* Path.Path;
  const sourceRoot = yield* requireCanonicalExistingPath(
    options.sourceRoot,
    "Directory",
    "Preservation source root must be one canonical regular directory."
  );
  const rootArchivePath = yield* requireCanonicalExistingPath(
    options.rootArchivePath,
    "File",
    "The separately preserved root archive must be one canonical regular file."
  );
  const corpusRoot = yield* requireCanonicalExistingPath(
    options.corpusRoot,
    "Directory",
    "Preservation corpus root must be one canonical regular directory."
  );
  const sourceManifestPath = yield* requireCanonicalExistingPath(
    options.sourceManifestPath,
    "File",
    "Inherited collector manifest must be one canonical regular file."
  );
  const rawRoot = path.join(corpusRoot, "raw");
  const archiveRoot = yield* requireContainedPath(
    path,
    rawRoot,
    path.resolve(rawRoot, options.runLabel),
    "Preservation run label escapes the corpus raw root.",
    false
  );
  if (pathsOverlap(path, sourceRoot, rootArchivePath)) {
    return yield* archiveError("Preservation source tree and root archive must not overlap.");
  }
  if (pathsOverlap(path, sourceRoot, archiveRoot) || pathsOverlap(path, rootArchivePath, archiveRoot)) {
    return yield* archiveError("Preservation sources and archive destination must not overlap.");
  }
  return { archiveRoot, corpusRoot, rootArchivePath, sourceManifestPath, sourceRoot };
});

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

const inspectCanonicalDirectory = Effect.fn("CorpusRestoration.inspectCanonicalDirectory")(function* (
  directory: string,
  message: string
): Effect.fn.Return<void, CorpusCommandError, RestorationRequirements> {
  yield* inspectCanonicalPath(directory, "Directory", message, `${message} Symbolic links are not allowed.`);
});

const ensureCanonicalDirectoryPath = Effect.fn("CorpusRestoration.ensureCanonicalDirectoryPath")(function* (
  root: string,
  destination: string
): Effect.fn.Return<void, CorpusCommandError, RestorationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolvedDestination = yield* requireContainedPath(
    path,
    root,
    destination,
    "Preservation directory destination escapes its canonical root.",
    true
  );
  yield* inspectCanonicalDirectory(root, "Preservation directory root is not canonical.");
  const relative = path.relative(root, resolvedDestination);
  const segments = A.filter(Str.split(path.sep)(relative), Str.isNonEmpty);
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    const exists = yield* fs
      .exists(current)
      .pipe(CorpusCommandError.mapError("Failed checking preservation directory component."));
    if (!exists) {
      yield* fs
        .makeDirectory(current)
        .pipe(CorpusCommandError.mapError("Failed creating preservation directory component."));
      yield* syncRestorationDirectory(path.dirname(current));
    }
    yield* inspectCanonicalDirectory(current, "Preservation directory component is not canonical.");
  }
});

const filesystemRootFor = (path: Path.Path, candidate: string): string => {
  let current = path.resolve(candidate);
  while (path.dirname(current) !== current) current = path.dirname(current);
  return current;
};

const parseProcStatStartTime = (stat: string): O.Option<string> => {
  const closeParen = Str.lastIndexOf(")")(stat);
  if (O.isNone(closeParen)) return O.none();
  const fields = A.filter(Str.split(Str.trim(Str.slice(closeParen.value + 1)(stat)), /\s+/u), Str.isNonEmpty);
  return O.fromUndefinedOr(fields[19]);
};

const processStartTime = Effect.fn("CorpusRestoration.processStartTime")(function* (
  pid: number
): Effect.fn.Return<O.Option<string>, CorpusCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const stat = yield* fs.readFileString(`/proc/${pid}/stat`).pipe(
    Effect.asSome,
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "NotFound"
        ? Effect.succeed(O.none<string>())
        : Effect.fail(archiveError("Preservation writer ownership could not be verified safely."))
    )
  );
  if (O.isNone(stat)) return O.none();
  const startTime = parseProcStatStartTime(stat.value);
  if (O.isNone(startTime)) {
    return yield* archiveError("Preservation writer process identity is unreadable; ownership fails closed.");
  }
  return startTime;
});

const currentBootId = Effect.fn("CorpusRestoration.currentBootId")(function* (): Effect.fn.Return<
  string,
  CorpusCommandError,
  FileSystem.FileSystem
> {
  const fs = yield* FileSystem.FileSystem;
  const bootId = yield* fs
    .readFileString("/proc/sys/kernel/random/boot_id")
    .pipe(CorpusCommandError.mapError("Preservation writer boot identity could not be verified safely."));
  const trimmed = Str.trim(bootId);
  if (Str.isEmpty(trimmed)) {
    return yield* archiveError("Preservation writer boot identity is unreadable; ownership fails closed.");
  }
  return trimmed;
});

const writerClaimOwnerIsAlive = Effect.fn("CorpusRestoration.writerClaimOwnerIsAlive")(function* (
  claim: typeof RestorationWriterClaim.Type
): Effect.fn.Return<boolean, CorpusCommandError, FileSystem.FileSystem> {
  if (!Str.Equivalence(yield* currentBootId(), claim.bootId)) return false;
  const observedStart = yield* processStartTime(claim.pid);
  return O.isSome(observedStart) && Str.Equivalence(observedStart.value, claim.procStart);
});

const readOpenedCoordinationText = Effect.fn("CorpusRestoration.readOpenedCoordinationText")(function* (
  file: FileSystem.File
): Effect.fn.Return<string, CorpusCommandError> {
  const decoder = new TextDecoder();
  let byteCount = 0;
  let text = "";
  while (true) {
    const chunk = yield* file
      .readAlloc(4_096)
      .pipe(CorpusCommandError.mapError("Failed reading preservation writer coordination state."));
    if (O.isNone(chunk)) return `${text}${decoder.decode()}`;
    byteCount += chunk.value.length;
    if (byteCount > maximumWriterClaimBytes) {
      return yield* archiveError("Preservation writer coordination state exceeds its safe bounded size.");
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
});

const readCanonicalCoordinationFile = Effect.fn("CorpusRestoration.readCanonicalCoordinationFile")(function* (
  filePath: string
): Effect.fn.Return<O.Option<string>, CorpusCommandError, RestorationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(filePath)
    .pipe(CorpusCommandError.mapError("Failed checking preservation writer coordination state."));
  if (!exists) return O.none();
  const expectedInfo = yield* inspectCanonicalArchiveFile(
    filePath,
    "Preservation writer coordination state must be one canonical regular file."
  );
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const file = yield* fs
        .open(filePath, { flag: "r" })
        .pipe(CorpusCommandError.mapError("Failed opening preservation writer coordination state."));
      const openedInfo = yield* file.stat.pipe(
        CorpusCommandError.mapError("Failed inspecting opened preservation writer coordination state.")
      );
      const currentInfo = yield* inspectCanonicalArchiveFile(
        filePath,
        "Preservation writer coordination state changed before it could be read safely."
      );
      if (
        openedInfo.type !== "File" ||
        !sameSourceIdentity(sourceIdentity(expectedInfo), sourceIdentity(openedInfo)) ||
        !sameSourceIdentity(sourceIdentity(openedInfo), sourceIdentity(currentInfo))
      ) {
        return yield* archiveError("Preservation writer coordination state changed before safe observation.");
      }
      return O.some(yield* readOpenedCoordinationText(file));
    })
  );
});

const tryWriteExclusiveCoordinationFile = Effect.fn("CorpusRestoration.tryWriteExclusiveCoordinationFile")(function* (
  filePath: string,
  text: string
): Effect.fn.Return<boolean, CorpusCommandError, RestorationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const written = yield* Effect.scoped(
    fs.open(filePath, { flag: "wx" }).pipe(
      Effect.flatMap((file) =>
        file.writeAll(textEncoder.encode(text)).pipe(Effect.andThen(file.sync), Effect.as(true))
      ),
      Effect.catchTag("PlatformError", (error) =>
        error.reason._tag === "AlreadyExists"
          ? Effect.succeed(false)
          : Effect.fail(archiveError("Failed atomically creating preservation writer coordination state."))
      )
    )
  );
  if (written) yield* syncRestorationDirectory(path.dirname(filePath));
  return written;
});

const reapedCoordinationPath = (filePath: string): string => `${filePath}.reaped-${process.pid}-${randomUUID()}`;

const moveObservedCoordinationFile = Effect.fn("CorpusRestoration.moveObservedCoordinationFile")(function* (
  filePath: string,
  observedText: string
): Effect.fn.Return<boolean, CorpusCommandError, RestorationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const currentText = yield* readCanonicalCoordinationFile(filePath);
  if (O.isNone(currentText) || !Str.Equivalence(currentText.value, observedText)) return false;
  const reapedPath = reapedCoordinationPath(filePath);
  const moved = yield* fs.rename(filePath, reapedPath).pipe(
    Effect.as(true),
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "NotFound"
        ? Effect.succeed(false)
        : Effect.fail(archiveError("Failed atomically moving observed preservation writer coordination state."))
    )
  );
  if (!moved) return false;
  yield* syncRestorationDirectory(path.dirname(filePath));
  yield* fs
    .remove(reapedPath)
    .pipe(CorpusCommandError.mapError("Failed removing reaped preservation writer coordination state."));
  yield* syncRestorationDirectory(path.dirname(filePath));
  return true;
});

const releaseExactCoordinationFile = Effect.fn("CorpusRestoration.releaseExactCoordinationFile")(function* (
  filePath: string,
  expectedText: string
): Effect.fn.Return<void, never, RestorationRequirements> {
  yield* moveObservedCoordinationFile(filePath, expectedText).pipe(Effect.ignore);
});

const writerReapClaimPath = (claimPath: string, observedText: string): string =>
  `${claimPath}.reap-${digestText(observedText)}.claim`;

const writerReapClaimTombstonePath = (reapClaimPath: string, observedText: string): string =>
  `${reapClaimPath}.reap-${digestText(observedText)}.claim`;

const decodeObservedWriterClaim = Effect.fn("CorpusRestoration.decodeObservedWriterClaim")(function* (
  text: string,
  unreadableMessage: string
): Effect.fn.Return<typeof RestorationWriterClaim.Type, CorpusCommandError> {
  return yield* decodeRestorationWriterClaim(text).pipe(CorpusCommandError.mapError(unreadableMessage));
});

const tryRecoverObservedWriterReapClaim = Effect.fn("CorpusRestoration.tryRecoverObservedWriterReapClaim")(function* (
  reapClaimPath: string,
  replacementText: string,
  observedText: string
): Effect.fn.Return<boolean, CorpusCommandError, RestorationRequirements> {
  const tombstonePath = writerReapClaimTombstonePath(reapClaimPath, observedText);
  if (!(yield* tryWriteExclusiveCoordinationFile(tombstonePath, replacementText))) {
    const tombstoneText = yield* readCanonicalCoordinationFile(tombstonePath);
    if (O.isNone(tombstoneText)) return false;
    const tombstoneClaim = yield* decodeObservedWriterClaim(
      tombstoneText.value,
      "Preservation writer reclamation tombstone is unreadable; ownership fails closed."
    );
    if (yield* writerClaimOwnerIsAlive(tombstoneClaim)) return false;
    return yield* archiveError(
      "Preservation writer reclamation tombstone has a dead owner; depth-two reclamation fails closed."
    );
  }

  return yield* Effect.gen(function* () {
    const currentText = yield* readCanonicalCoordinationFile(reapClaimPath);
    if (O.isNone(currentText) || !Str.Equivalence(currentText.value, observedText)) return false;
    if (!(yield* moveObservedCoordinationFile(reapClaimPath, observedText))) return false;
    return yield* tryWriteExclusiveCoordinationFile(reapClaimPath, replacementText);
  }).pipe(Effect.ensuring(releaseExactCoordinationFile(tombstonePath, replacementText)));
});

const tryClaimWriterReapClaim = Effect.fn("CorpusRestoration.tryClaimWriterReapClaim")(function* (
  reapClaimPath: string,
  claimText: string
): Effect.fn.Return<boolean, CorpusCommandError, RestorationRequirements> {
  if (yield* tryWriteExclusiveCoordinationFile(reapClaimPath, claimText)) return true;
  const observedText = yield* readCanonicalCoordinationFile(reapClaimPath);
  if (O.isNone(observedText)) return yield* tryWriteExclusiveCoordinationFile(reapClaimPath, claimText);
  const observedClaim = yield* decodeObservedWriterClaim(
    observedText.value,
    "Preservation writer reclamation claim is unreadable; ownership fails closed."
  );
  if (yield* writerClaimOwnerIsAlive(observedClaim)) return false;
  return yield* tryRecoverObservedWriterReapClaim(reapClaimPath, claimText, observedText.value);
});

const tryMoveObservedWriterClaim = Effect.fn("CorpusRestoration.tryMoveObservedWriterClaim")(function* (
  claimPath: string,
  observedText: string,
  contenderText: string
): Effect.fn.Return<boolean, CorpusCommandError, RestorationRequirements> {
  const reapClaimPath = writerReapClaimPath(claimPath, observedText);
  if (!(yield* tryClaimWriterReapClaim(reapClaimPath, contenderText))) return false;
  return yield* moveObservedCoordinationFile(claimPath, observedText).pipe(
    Effect.ensuring(releaseExactCoordinationFile(reapClaimPath, contenderText))
  );
});

const tryReplaceStaleWriterClaim = Effect.fn("CorpusRestoration.tryReplaceStaleWriterClaim")(function* (
  claimPath: string,
  staleText: string,
  replacementText: string
): Effect.fn.Return<boolean, CorpusCommandError, RestorationRequirements> {
  if (!(yield* tryMoveObservedWriterClaim(claimPath, staleText, replacementText))) return false;
  return yield* tryWriteExclusiveCoordinationFile(claimPath, replacementText);
});

const acquireObservedRestorationWriterClaim = Effect.fn("CorpusRestoration.acquireObservedWriterClaim")(function* (
  lease: RestorationWriterClaimLease
): Effect.fn.Return<RestorationWriterClaimLease, CorpusCommandError, RestorationRequirements> {
  const observedText = yield* readCanonicalCoordinationFile(lease.claimPath);
  if (O.isNone(observedText)) {
    if (yield* tryWriteExclusiveCoordinationFile(lease.claimPath, lease.claimText)) return lease;
    return yield* archiveError("Preservation writer claim changed during acquisition; ownership fails closed.");
  }
  const observedClaim = yield* decodeObservedWriterClaim(
    observedText.value,
    "Preservation writer claim is unreadable; ownership fails closed."
  );
  if (yield* writerClaimOwnerIsAlive(observedClaim)) {
    return yield* archiveError("Another verified preservation writer currently owns this archive run.");
  }
  if (yield* tryReplaceStaleWriterClaim(lease.claimPath, observedText.value, lease.claimText)) return lease;
  return yield* archiveError(
    "Preservation writer claim changed during stale-owner reclamation; ownership fails closed."
  );
});

const acquireRestorationWriterClaim = Effect.fn("CorpusRestoration.acquireWriterClaim")(function* (
  claimDirectory: string,
  claimName: string
): Effect.fn.Return<RestorationWriterClaimLease, CorpusCommandError, RestorationRequirements> {
  const path = yield* Path.Path;
  const canonicalDirectory = path.resolve(claimDirectory);
  yield* inspectCanonicalDirectory(canonicalDirectory, "Preservation writer claim directory must be canonical.");
  if (
    Str.isEmpty(claimName) ||
    claimName === "." ||
    claimName === ".." ||
    !Str.Equivalence(path.basename(claimName), claimName)
  ) {
    return yield* archiveError("Preservation writer claim name must be one safe filesystem basename.");
  }
  const ownProcessStart = yield* processStartTime(process.pid);
  if (O.isNone(ownProcessStart)) {
    return yield* archiveError("Current preservation writer process identity is unavailable; ownership fails closed.");
  }
  const encodedClaim = yield* encodeRestorationWriterClaim({
    bootId: yield* currentBootId(),
    pid: process.pid,
    procStart: ownProcessStart.value,
    schemaVersion: "oppold-preservation-writer/v2",
    startedAt: yield* recordedAt(),
    token: randomUUID(),
  }).pipe(CorpusCommandError.mapError("Failed encoding preservation writer ownership state."));
  const claimText = `${encodedClaim}\n`;
  const claimPath = yield* requireContainedPath(
    path,
    canonicalDirectory,
    path.join(canonicalDirectory, claimName),
    "Preservation writer claim escapes its canonical claim directory.",
    false
  );
  const lease = { claimPath, claimText };
  if (yield* tryWriteExclusiveCoordinationFile(claimPath, claimText)) return lease;
  return yield* acquireObservedRestorationWriterClaim(lease);
});

const releaseArchiveWriterClaim = Effect.fn("CorpusRestoration.releaseWriterClaim")(function* (
  lease: RestorationWriterClaimLease
): Effect.fn.Return<void, CorpusCommandError, RestorationRequirements> {
  const released = yield* tryMoveObservedWriterClaim(lease.claimPath, lease.claimText, lease.claimText);
  if (!released) {
    return yield* archiveError("Failed releasing the exact preservation writer claim generation.");
  }
});

/**
 * Run one restoration writer under an exact-observation machine-local claim.
 *
 * **Example** (Serialize one restoration writer)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { withRestorationWriterClaim } from "@beep/repo-cli/test/Corpus"
 *
 * const guarded = withRestorationWriterClaim("/canonical/run/writer-claims", "mail-scope.claim", Effect.void)
 * console.log(Effect.isEffect(guarded))
 * ```
 *
 * **Details**
 *
 * The claim records boot, PID, and process-start identity. A fresh process can
 * reclaim only the exact bytes of a decodable dead-owner generation; live,
 * unreadable, or ambiguous ownership fails closed.
 *
 * @param claimDirectory - Existing canonical directory containing only writer claims.
 * @param claimName - Safe basename unique to the protected writer scope.
 * @param use - Effect to run while the exact claim generation is owned.
 * @returns The protected effect's result after exact claim release.
 * @effects Creates, syncs, reclaims, and removes private machine-local claim files.
 * @category resource-management
 * @since 0.0.0
 */
export const withRestorationWriterClaim = Effect.fn("CorpusRestoration.withWriterClaim")(function* <A, E, R>(
  claimDirectory: string,
  claimName: string,
  use: Effect.Effect<A, E, R>
): Effect.fn.Return<A, E | CorpusCommandError, R | RestorationRequirements> {
  return yield* Effect.acquireUseRelease(
    acquireRestorationWriterClaim(claimDirectory, claimName),
    () => use,
    releaseArchiveWriterClaim
  );
});

/**
 * Remove only the incomplete final row left by an interrupted JSONL append.
 *
 * @param filePath - Canonical JSONL path protected by its owning writer claim.
 * @returns Whether a non-newline tail was durably truncated.
 * @effects Opens an existing regular file without following aliases, truncates
 * only bytes after its final newline, then syncs the file and parent directory.
 * @category utilities
 * @since 0.0.0
 */
export const repairRestorationJsonlTail = Effect.fn("CorpusRestoration.repairJsonlTail")(function* (
  filePath: string
): Effect.fn.Return<boolean, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolvedFilePath = path.resolve(filePath);
  const exists = yield* fs
    .exists(resolvedFilePath)
    .pipe(CorpusCommandError.mapError("Failed checking restoration JSONL tail."));
  if (!exists) return false;
  const expectedInfo = yield* inspectCanonicalArchiveFile(
    resolvedFilePath,
    "Durable restoration append destination must be one canonical regular file."
  );
  const bytes = yield* fs
    .readFile(resolvedFilePath)
    .pipe(CorpusCommandError.mapError("Failed reading restoration JSONL tail."));
  if (bytes.length === 0 || bytes[bytes.length - 1] === 0x0a) return false;

  let retainedBytes = 0;
  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    if (bytes[index] === 0x0a) {
      retainedBytes = index + 1;
      break;
    }
  }
  yield* Effect.scoped(
    Effect.gen(function* () {
      const file = yield* fs
        .open(resolvedFilePath, { flag: "r+" })
        .pipe(CorpusCommandError.mapError("Failed safely opening restoration JSONL tail."));
      const openedInfo = yield* file.stat.pipe(
        CorpusCommandError.mapError("Failed inspecting opened restoration JSONL tail.")
      );
      if (
        openedInfo.type !== "File" ||
        Number(openedInfo.size) !== bytes.length ||
        !sameSourceIdentity(sourceIdentity(expectedInfo), sourceIdentity(openedInfo))
      ) {
        return yield* archiveError("Restoration JSONL changed before its incomplete tail could be repaired safely.");
      }
      const currentInfo = yield* inspectCanonicalArchiveFile(
        resolvedFilePath,
        "Restoration JSONL changed before its incomplete tail could be repaired."
      );
      if (!sameSourceIdentity(sourceIdentity(openedInfo), sourceIdentity(currentInfo))) {
        return yield* archiveError("Restoration JSONL changed before its incomplete tail could be repaired.");
      }
      yield* file
        .truncate(retainedBytes)
        .pipe(
          Effect.andThen(file.sync),
          CorpusCommandError.mapError("Failed durably removing an incomplete restoration JSONL tail.")
        );
    })
  );
  yield* syncRestorationDirectory(path.dirname(resolvedFilePath));
  return true;
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
  const resolvedFilePath = path.resolve(filePath);
  const directory = path.dirname(resolvedFilePath);
  yield* ensureCanonicalDirectoryPath(filesystemRootFor(path, directory), directory);
  const exists = yield* fs
    .exists(resolvedFilePath)
    .pipe(CorpusCommandError.mapError("Failed checking durable restoration append destination."));
  const expectedInfo = exists
    ? O.some(
        yield* inspectCanonicalArchiveFile(
          resolvedFilePath,
          "Durable restoration append destination must be one canonical regular file."
        )
      )
    : O.none<FileSystem.File.Info>();
  yield* Effect.scoped(
    Effect.gen(function* () {
      const file = yield* fs
        .open(resolvedFilePath, { flag: O.isSome(expectedInfo) ? "a" : "ax+" })
        .pipe(CorpusCommandError.mapError("Failed safely opening durable restoration append destination."));
      const openedInfo = yield* file.stat.pipe(
        CorpusCommandError.mapError("Failed inspecting opened durable restoration append destination.")
      );
      if (openedInfo.type !== "File") {
        return yield* archiveError("Opened durable restoration append destination is not a regular file.");
      }
      if (
        O.isSome(expectedInfo) &&
        !sameSourceIdentity(sourceIdentity(expectedInfo.value), sourceIdentity(openedInfo))
      ) {
        return yield* archiveError("Durable restoration append destination changed before it could be opened safely.");
      }
      const currentInfo = yield* inspectCanonicalArchiveFile(
        resolvedFilePath,
        "Durable restoration append destination changed before its first write."
      );
      if (!sameSourceIdentity(sourceIdentity(openedInfo), sourceIdentity(currentInfo))) {
        return yield* archiveError("Durable restoration append destination changed before its first write.");
      }
      yield* (
        Str.isEmpty(text) ? file.sync : file.writeAll(textEncoder.encode(text)).pipe(Effect.andThen(file.sync))
      ).pipe(CorpusCommandError.mapError("Failed writing durable restoration append destination."));
    })
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

const hashOpenedRestorationFile = Effect.fn("CorpusRestoration.hashOpenedFile")(function* (
  filePath: string,
  chunkSize: number
): Effect.fn.Return<
  { readonly sha256: Sha256Hex; readonly sizeBytes: number },
  CorpusCommandError,
  FileSystem.FileSystem | Scope.Scope
> {
  const fs = yield* FileSystem.FileSystem;
  const file = yield* fs
    .open(filePath, { flag: "r" })
    .pipe(CorpusCommandError.mapError("Failed opening archive object for streaming hash."));
  const hasher = sha256.create();
  let sizeBytes = 0;
  while (true) {
    const chunk = yield* file
      .readAlloc(chunkSize)
      .pipe(CorpusCommandError.mapError("Failed reading archive object while hashing."));
    if (O.isNone(chunk)) break;
    hasher.update(chunk.value);
    sizeBytes += chunk.value.length;
  }
  return { sha256: Sha256Hex.make(bytesToHex(hasher.digest())), sizeBytes };
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
  return yield* Effect.scoped(hashOpenedRestorationFile(filePath, chunkSize));
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

const maybeCrash = Effect.fn("CorpusRestoration.maybeCrash")(function* (
  actual: RestorationPreserveOptions["crashPoint"],
  expected: string
): Effect.fn.Return<void, CorpusCommandError> {
  if (actual === expected) return yield* archiveError(`Synthetic preservation interruption at ${expected}.`);
});

const sourceIdentityToken = (identity: SourceIdentity): string =>
  `${identity.type}\u0000${identity.device}\u0000${O.getOrElse(identity.inode, () => -1)}\u0000${identity.mode}\u0000${identity.mtimeMillis}\u0000${identity.sizeBytes}`;

const archiveInventorySignature = (
  directories: ReadonlyArray<ArchiveDirectoryObject>,
  files: ReadonlyArray<ArchiveSourceObject>
): Sha256Hex =>
  digestText(
    A.join(
      A.appendAll(
        A.map(
          directories,
          (directory) =>
            `directory\u0000${directory.sourceLabel}\u0000${directory.sourceRelativePath}\u0000${sourceIdentityToken(directory.expectedInfo)}`
        ),
        A.map(
          files,
          (file) =>
            `${file.objectKind}\u0000${file.sourceLabel}\u0000${file.sourceRelativePath}\u0000${sourceIdentityToken(file.expectedInfo)}`
        )
      ),
      "\n"
    )
  );

const collectArchiveInventory = Effect.fn("CorpusRestoration.collectArchiveInventory")(function* (
  canonicalPaths: CanonicalArchivePaths
): Effect.fn.Return<ArchiveInventory, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourceRoot = canonicalPaths.sourceRoot;
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
    expectedInfo: sourceIdentity(sourceRootInfo),
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
        yield* requireContainedPath(
          path,
          sourceRoot,
          sourcePath,
          "Preservation source entry escapes the canonical source root.",
          true
        );
        const canonicalSourcePath = yield* fs
          .realPath(sourcePath)
          .pipe(CorpusCommandError.mapError("Failed canonicalizing preservation source entry."));
        if (canonicalSourcePath !== sourcePath) {
          return yield* archiveError("Preservation source entries must not traverse symbolic links.");
        }
        const info = yield* fs
          .stat(sourcePath)
          .pipe(CorpusCommandError.mapError("Failed inspecting preservation source entry."));
        if (info.type === "Directory") {
          directories.push({
            destinationRelativePath: path.join("payload", "tree", relativePath),
            expectedInfo: sourceIdentity(info),
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
          expectedInfo: sourceIdentity(info),
          expectedSizeBytes: sizeBytes,
          objectId: objectIdFor("salvage-tree", relativePath),
          objectKind: "file",
          sourceLabel: "salvage-tree",
          sourcePath,
          sourceRelativePath: relativePath,
        });
      }
    });
  yield* collectAt(sourceRoot);

  const rootArchivePath = canonicalPaths.rootArchivePath;
  const rootArchiveInfo = yield* fs
    .stat(rootArchivePath)
    .pipe(CorpusCommandError.mapError("Failed inspecting separately preserved root archive object."));
  if (rootArchiveInfo.type !== "File") {
    return yield* archiveError("The separately addressable root archive object must be a file.");
  }
  const rootArchiveBytes = Number(rootArchiveInfo.size);
  const rootArchiveIdentity = sourceIdentity(rootArchiveInfo);
  if (A.some(files, (file) => sameDeviceAndInode(file.expectedInfo, rootArchiveIdentity))) {
    return yield* archiveError("The separately preserved root archive aliases a source-tree file.");
  }
  files.push({
    destinationRelativePath: path.join("payload", "root-archive.zip"),
    expectedInfo: rootArchiveIdentity,
    expectedSizeBytes: rootArchiveBytes,
    objectId: objectIdFor("root-archive", "root-archive.zip"),
    objectKind: "root-archive",
    sourceLabel: "root-archive",
    sourcePath: rootArchivePath,
    sourceRelativePath: "root-archive.zip",
  });

  const sortedDirectories = A.sort(
    directories,
    Order.mapInput(Order.String, (value: ArchiveDirectoryObject) => value.destinationRelativePath)
  );
  const sortedFiles = A.sort(
    files,
    Order.mapInput(Order.String, (value: ArchiveSourceObject) => value.destinationRelativePath)
  );
  return {
    directories: sortedDirectories,
    files: sortedFiles,
    requiredBytes: sourceTreeBytes + rootArchiveBytes,
    rootArchiveBytes,
    signature: archiveInventorySignature(sortedDirectories, sortedFiles),
    sourceTreeBytes,
  };
});

const requireInventoryDenominator = Effect.fn("CorpusRestoration.requireInventoryDenominator")(function* (
  label: string,
  expected: number,
  observed: number
): Effect.fn.Return<void, CorpusCommandError> {
  if (expected !== observed) {
    return yield* archiveError(`${label} denominator mismatch: expected ${expected}, observed ${observed}.`);
  }
});

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

const collectorRelativePath = (destination: string, prefixSegmentCount: number): O.Option<string> => {
  const segments = A.filter(Str.split(/[\\/]+/u)(destination), Str.isNonEmpty);
  const relative = A.drop(segments, prefixSegmentCount);
  const traverses = A.some(relative, (segment) => segment === "." || segment === "..");
  return relative.length > 0 && !traverses ? O.some(A.join(relative, "/")) : O.none();
};

const reconcileCollectorRecord = Effect.fn("CorpusRestoration.reconcileCollectorRecord")(function* (
  record: CollectorManifestRecord,
  sourceRoot: string,
  prefixSegmentCount: number
): Effect.fn.Return<CollectorDisposition, CorpusCommandError, RestorationRequirements> {
  if (record.status === "error") return { kind: "collector-error" };
  if (record.status === "excluded-secret") return { kind: "ignored" };
  const relativePath = collectorRelativePath(record.dst, prefixSegmentCount);
  if (O.isNone(relativePath)) {
    return yield* archiveError("Inherited collector destination cannot be reconciled to the preserved tree.");
  }
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const candidatePath = yield* requireContainedPath(
    path,
    sourceRoot,
    path.resolve(sourceRoot, relativePath.value),
    "Inherited collector destination escapes the canonical preservation source root.",
    true
  );
  const exists = yield* fs
    .exists(candidatePath)
    .pipe(CorpusCommandError.mapError("Failed checking collector destination reconciliation."));
  if (!exists) return { kind: "mutated", recordedSize: record.size, relativePath: relativePath.value };
  const canonicalCandidate = yield* fs
    .realPath(candidatePath)
    .pipe(CorpusCommandError.mapError("Failed canonicalizing collector destination reconciliation."));
  if (canonicalCandidate !== candidatePath || !isContainedPath(path, sourceRoot, canonicalCandidate)) {
    return yield* archiveError("Inherited collector destination traverses a symbolic link or escapes the source root.");
  }
  const info = yield* fs
    .stat(candidatePath)
    .pipe(CorpusCommandError.mapError("Failed inspecting collector destination reconciliation."));
  if (info.type !== "File") {
    return yield* archiveError("Inherited collector destination must reconcile to one regular file.");
  }
  if (Number(info.size) !== record.size) {
    return yield* archiveError("Inherited collector destination size contradicts the collector manifest.");
  }
  return { kind: "present", recordedSize: record.size, relativePath: relativePath.value };
});

const isSuccessfulCollectorDisposition = (
  disposition: CollectorDisposition
): disposition is SuccessfulCollectorDisposition => disposition.kind === "mutated" || disposition.kind === "present";

const collectorStatusCount = (
  records: ReadonlyArray<CollectorManifestRecord>,
  status: CollectorManifestRecord["status"]
): number => A.filter(records, (record) => record.status === status).length;

const reconcileCollectorHistoricalIdentities = Effect.fn("CorpusRestoration.reconcileCollectorHistoricalIdentities")(
  function* (
    dispositions: ReadonlyArray<SuccessfulCollectorDisposition>
  ): Effect.fn.Return<HashMap.HashMap<string, number>, CorpusCommandError> {
    let sizesByPath = HashMap.empty<string, number>();
    for (const disposition of dispositions) {
      const priorSize = HashMap.get(sizesByPath, disposition.relativePath);
      if (O.isSome(priorSize) && priorSize.value !== disposition.recordedSize) {
        return yield* archiveError("Inherited collector retries contradict the recorded size for one destination.");
      }
      sizesByPath = HashMap.set(sizesByPath, disposition.relativePath, disposition.recordedSize);
    }
    return sizesByPath;
  }
);

const requireCollectorDenominator = Effect.fn("CorpusRestoration.requireCollectorDenominator")(function* (
  label: string,
  expected: number,
  observed: number
): Effect.fn.Return<void, CorpusCommandError> {
  if (expected !== observed) {
    return yield* archiveError(`${label} denominator mismatch: expected ${expected}, observed ${observed}.`);
  }
});

const reconcileCollectorManifest = Effect.fn("CorpusRestoration.reconcileCollectorManifest")(function* (
  options: RestorationPreserveOptions,
  canonicalPaths: CanonicalArchivePaths,
  inventory: ArchiveInventory
): Effect.fn.Return<
  { readonly collectorErrorCount: number; readonly mutatedDestinationCount: number; readonly rowCount: number },
  CorpusCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const manifestText = yield* fs
    .readFileString(canonicalPaths.sourceManifestPath)
    .pipe(CorpusCommandError.mapError("Failed reading inherited collector manifest."));
  const lines = A.filter(Str.split(/\r?\n/u)(manifestText), Str.isNonEmpty);
  const records = yield* Effect.forEach(lines, (line) =>
    decodeCollectorManifestRecordJson(line).pipe(
      CorpusCommandError.mapError("Inherited collector manifest contains an invalid JSONL row.")
    )
  );
  const dispositions = yield* Effect.forEach(records, (record) =>
    reconcileCollectorRecord(record, canonicalPaths.sourceRoot, options.collectorDestinationPrefixSegments)
  );
  const successfulDispositions = A.filter(dispositions, isSuccessfulCollectorDisposition);
  const collectorErrorCount = A.filter(dispositions, (value) => value.kind === "collector-error").length;
  const mutatedDestinationCount = A.filter(successfulDispositions, (value) => value.kind === "mutated").length;
  const presentDispositions = A.filter(successfulDispositions, (value) => value.kind === "present");
  const historicalSizes = yield* reconcileCollectorHistoricalIdentities(successfulDispositions);
  yield* requireCollectorDenominator("Collector row", options.expectedCollectorRowCount, lines.length);
  yield* requireCollectorDenominator(
    "Collector copied row",
    options.expectedCollectorCopiedCount,
    collectorStatusCount(records, "copied")
  );
  yield* requireCollectorDenominator(
    "Collector resumed row",
    options.expectedCollectorResumedCount,
    collectorStatusCount(records, "resumed")
  );
  yield* requireCollectorDenominator(
    "Collector error row",
    options.expectedCollectorErrorCount,
    collectorStatusCount(records, "error")
  );
  yield* requireCollectorDenominator(
    "Collector excluded-secret row",
    options.expectedCollectorExcludedSecretCount,
    collectorStatusCount(records, "excluded-secret")
  );
  yield* requireCollectorDenominator(
    "Collector unique successful destination",
    options.expectedCollectorUniqueSuccessfulDestinationCount,
    HashMap.size(historicalSizes)
  );
  yield* requireCollectorDenominator(
    "Collector present successful row",
    options.expectedCollectorPresentSuccessfulRowCount,
    presentDispositions.length
  );
  yield* requireCollectorDenominator(
    "Mutated-destination",
    options.expectedMutatedDestinationCount,
    mutatedDestinationCount
  );
  const presentPaths = A.map(presentDispositions, (value) => value.relativePath);
  const sourceFilePaths = A.map(
    A.filter(inventory.files, (object) => object.objectKind === "file"),
    (object) => object.sourceRelativePath
  );
  const sourceFilePathSet = HashSet.fromIterable(sourceFilePaths);
  const presentDestinationsArePreserved = A.every(presentPaths, (relativePath) =>
    HashSet.has(sourceFilePathSet, relativePath)
  );
  if (!presentDestinationsArePreserved) {
    return yield* archiveError("Inherited collector present destinations are not a subset of preservation files.");
  }
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

const inspectCanonicalArchiveFile = Effect.fn("CorpusRestoration.inspectCanonicalArchiveFile")(function* (
  filePath: string,
  message: string
): Effect.fn.Return<FileSystem.File.Info, CorpusCommandError, RestorationRequirements> {
  const { info } = yield* inspectCanonicalPath(filePath, "File", message, `${message} Symbolic links are not allowed.`);
  return info;
});

const inspectExpectedSourceFile = Effect.fn("CorpusRestoration.inspectExpectedSourceFile")(function* (
  object: ArchiveSourceObject,
  message: string
): Effect.fn.Return<FileSystem.File.Info, CorpusCommandError, RestorationRequirements> {
  const info = yield* inspectCanonicalArchiveFile(object.sourcePath, message);
  if (
    Number(info.size) !== object.expectedSizeBytes ||
    !sameSourceIdentity(sourceIdentity(info), object.expectedInfo)
  ) {
    return yield* archiveError("Preservation source no longer matches its approved per-object inventory evidence.");
  }
  return info;
});

const inspectArchiveAttemptSource = Effect.fn("CorpusRestoration.inspectArchiveAttemptSource")(function* (
  object: ArchiveSourceObject,
  allowStableRebaseline: boolean
): Effect.fn.Return<FileSystem.File.Info, CorpusCommandError, RestorationRequirements> {
  if (!allowStableRebaseline) return yield* inspectExpectedSourceFile(object, "Failed inspecting source before copy.");
  const info = yield* inspectCanonicalArchiveFile(
    object.sourcePath,
    "Failed inspecting changed preservation source before stable recopy."
  );
  if (Number(info.size) !== object.expectedSizeBytes) {
    return yield* archiveError("Changed preservation source violates its frozen per-object byte denominator.");
  }
  return info;
});

const inspectExpectedSourceDirectory = Effect.fn("CorpusRestoration.inspectExpectedSourceDirectory")(function* (
  directory: ArchiveDirectoryObject,
  sourceRoot: string
): Effect.fn.Return<void, CorpusCommandError, RestorationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourcePath = path.resolve(sourceRoot, directory.sourceRelativePath);
  yield* requireContainedPath(
    path,
    sourceRoot,
    sourcePath,
    "Preservation source directory escapes its canonical root.",
    true
  );
  const canonical = yield* fs
    .realPath(sourcePath)
    .pipe(CorpusCommandError.mapError("Failed canonicalizing preservation source directory."));
  if (canonical !== sourcePath) {
    return yield* archiveError("Preservation source directory traverses a symbolic link.");
  }
  const info = yield* fs
    .stat(sourcePath)
    .pipe(CorpusCommandError.mapError("Failed inspecting preservation source directory."));
  if (info.type !== "Directory" || !sameSourceIdentity(sourceIdentity(info), directory.expectedInfo)) {
    return yield* archiveError("Preservation source directory no longer matches its approved inventory evidence.");
  }
});

const syncRestorationFile = Effect.fn("CorpusRestoration.syncFile")(function* (
  filePath: string
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  yield* Effect.scoped(
    fs.open(filePath, { flag: "r" }).pipe(
      Effect.flatMap((handle) => handle.sync),
      CorpusCommandError.mapError("Failed syncing preservation file.")
    )
  );
});

const makeArchiveFilePass = Effect.fn("CorpusRestoration.makeArchiveFilePass")(function* (
  context: ArchiveAttemptContext,
  preCopySource: ReturnType<typeof sourceStat>,
  postCopySource: ReturnType<typeof sourceStat>,
  digest: { readonly sha256: Sha256Hex; readonly sizeBytes: number },
  resumedBytes: number
): Effect.fn.Return<ArchiveFilePass> {
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
  preInfo: FileSystem.File.Info
): Effect.fn.Return<O.Option<ArchiveCopyAttemptOutcome>, CorpusCommandError, RestorationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const preCopySource = sourceStat(preInfo);
  const destinationExists = yield* fs
    .exists(context.destinationPath)
    .pipe(CorpusCommandError.mapError("Failed checking complete archive destination."));
  if (!destinationExists) return O.none();
  const destinationInfo = yield* inspectCanonicalArchiveFile(
    context.destinationPath,
    "Existing complete archive destination is not one canonical regular file."
  );
  if (sameDeviceAndInode(sourceIdentity(preInfo), sourceIdentity(destinationInfo))) {
    return yield* archiveError("Existing archive destination aliases its preservation source.");
  }
  const [sourceHash, destinationHash, postInfo] = yield* Effect.all([
    hashRestorationFileStreaming(context.object.sourcePath, context.chunkSize),
    hashRestorationFileStreaming(context.destinationPath, context.chunkSize),
    fs
      .stat(context.object.sourcePath)
      .pipe(CorpusCommandError.mapError("Failed re-inspecting complete archive source.")),
  ]);
  const postCopySource = sourceStat(postInfo);
  if (!sameSourceIdentity(sourceIdentity(preInfo), sourceIdentity(postInfo))) {
    return O.some(yield* recordArchiveSourceChange(context, preCopySource, postCopySource));
  }
  yield* inspectExpectedSourceFile(context.object, "Failed validating complete archive source evidence.");
  if (
    sourceHash.sizeBytes === context.object.expectedSizeBytes &&
    sourceHash.sha256 === destinationHash.sha256 &&
    sourceHash.sizeBytes === destinationHash.sizeBytes
  ) {
    yield* syncRestorationFile(context.destinationPath);
    yield* syncRestorationDirectory(context.destinationDirectory);
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
  sourceInfo: FileSystem.File.Info
): Effect.fn.Return<PartialArchiveState, CorpusCommandError, RestorationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const partialExists = yield* fs
    .exists(context.partialPath)
    .pipe(CorpusCommandError.mapError("Failed checking partial archive destination."));
  if (!partialExists) return { expectedInfo: O.none(), resumeBytes: 0 };
  const partialInfo = yield* inspectCanonicalArchiveFile(
    context.partialPath,
    "Partial archive destination is not one canonical regular file."
  );
  if (sameDeviceAndInode(sourceIdentity(sourceInfo), sourceIdentity(partialInfo))) {
    return yield* archiveError("Partial archive destination aliases its preservation source.");
  }
  const resumeBytes = Number(partialInfo.size);
  if (resumeBytes > context.object.expectedSizeBytes) {
    return { expectedInfo: O.some(sourceIdentity(partialInfo)), resumeBytes: 0 };
  }
  const matches = yield* prefixMatches(context.object.sourcePath, context.partialPath, resumeBytes, context.chunkSize);
  return {
    expectedInfo: O.some(sourceIdentity(partialInfo)),
    resumeBytes: matches ? resumeBytes : 0,
  };
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

const partialArchiveOpenFlag = (partialState: PartialArchiveState): "a" | "r+" | "wx+" =>
  O.match(partialState.expectedInfo, {
    onNone: () => "wx+",
    onSome: () => (partialState.resumeBytes > 0 ? "a" : "r+"),
  });

const validateOpenedArchiveCopy = Effect.fn("CorpusRestoration.validateOpenedArchiveCopy")(function* (
  context: ArchiveAttemptContext,
  partialState: PartialArchiveState,
  openedSourceInfo: FileSystem.File.Info,
  openedDestinationInfo: FileSystem.File.Info
): Effect.fn.Return<void, CorpusCommandError, RestorationRequirements> {
  const openedSourceIdentity = sourceIdentity(openedSourceInfo);
  const openedDestinationIdentity = sourceIdentity(openedDestinationInfo);
  if (!sameSourceIdentity(openedSourceIdentity, context.object.expectedInfo)) {
    return yield* archiveError("Opened preservation source no longer matches its approved per-object evidence.");
  }
  if (openedDestinationInfo.type !== "File") {
    return yield* archiveError("Opened archive destination is not a regular file.");
  }
  if (
    O.isSome(partialState.expectedInfo) &&
    !sameSourceIdentity(openedDestinationIdentity, partialState.expectedInfo.value)
  ) {
    return yield* archiveError("Partial archive destination changed before it could be opened safely.");
  }
  const currentDestinationInfo = yield* inspectCanonicalArchiveFile(
    context.partialPath,
    "Partial archive destination changed before its first write."
  );
  if (!sameSourceIdentity(openedDestinationIdentity, sourceIdentity(currentDestinationInfo))) {
    return yield* archiveError("Partial archive destination changed before its first write.");
  }
  if (sameDeviceAndInode(openedSourceIdentity, openedDestinationIdentity)) {
    return yield* archiveError("Opened archive destination aliases its preservation source.");
  }
});

const copyArchiveBytes = Effect.fn("CorpusRestoration.copyArchiveBytes")(function* (
  context: ArchiveAttemptContext,
  partialState: PartialArchiveState
): Effect.fn.Return<Sha256Hex, CorpusCommandError, FileSystem.FileSystem | Path.Path | Scope.Scope> {
  const fs = yield* FileSystem.FileSystem;
  const source = yield* fs
    .open(context.object.sourcePath, { flag: "r" })
    .pipe(CorpusCommandError.mapError("Failed opening preservation source for streaming copy."));
  const destination = yield* fs
    .open(context.partialPath, {
      flag: partialArchiveOpenFlag(partialState),
    })
    .pipe(CorpusCommandError.mapError("Failed opening partial preservation destination."));
  const [openedSourceInfo, openedDestinationInfo] = yield* Effect.all([source.stat, destination.stat]).pipe(
    CorpusCommandError.mapError("Failed inspecting opened preservation copy handles.")
  );
  yield* validateOpenedArchiveCopy(context, partialState, openedSourceInfo, openedDestinationInfo);
  if (partialState.resumeBytes === 0) {
    yield* destination
      .truncate(0)
      .pipe(CorpusCommandError.mapError("Failed safely truncating rejected partial archive destination."));
  }
  yield* source
    .seek(partialState.resumeBytes, "start")
    .pipe(CorpusCommandError.mapError("Failed seeking preservation source copy handle."));
  const hasher = sha256.create();
  if (partialState.resumeBytes > 0) {
    yield* hashResumedArchivePrefix(context.object.sourcePath, partialState.resumeBytes, context.chunkSize, hasher);
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
): Effect.fn.Return<ArchiveFilePass, CorpusCommandError, RestorationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .rename(context.partialPath, context.destinationPath)
    .pipe(CorpusCommandError.mapError("Failed atomically promoting preservation destination."));
  yield* syncRestorationDirectory(context.destinationDirectory);
  yield* maybeCrash(options.crashPoint, "after-rename");
  const destinationInfo = yield* inspectCanonicalArchiveFile(
    context.destinationPath,
    "Promoted archive destination is not one canonical regular file."
  );
  if (sameDeviceAndInode(context.object.expectedInfo, sourceIdentity(destinationInfo))) {
    return yield* archiveError("Promoted archive destination aliases its preservation source.");
  }
  const destinationHash = yield* hashRestorationFileStreaming(context.destinationPath, context.chunkSize);
  if (
    destinationHash.sha256 !== copiedDigest ||
    destinationHash.sizeBytes !== postCopySource.sizeBytes ||
    destinationHash.sizeBytes !== context.object.expectedSizeBytes
  ) {
    return yield* archiveError(
      `Independently hashed destination failed verification (digestMatch=${destinationHash.sha256 === copiedDigest}, destinationBytes=${destinationHash.sizeBytes}, sourceBytes=${postCopySource.sizeBytes}).`
    );
  }
  yield* maybeCrash(options.crashPoint, "before-pass");
  return yield* makeArchiveFilePass(context, preCopySource, postCopySource, destinationHash, resumeBytes);
});

const runArchiveCopyAttempt = Effect.fn("CorpusRestoration.runArchiveCopyAttempt")(function* (
  context: ArchiveAttemptContext,
  options: RestorationPreserveOptions,
  preInfo: FileSystem.File.Info
): Effect.fn.Return<ArchiveCopyAttemptOutcome, CorpusCommandError, RestorationRequirements> {
  const existingOutcome = yield* reconcileCompleteArchiveDestination(context, preInfo);
  if (O.isSome(existingOutcome)) return existingOutcome.value;

  const partialState = yield* resumableArchiveOffset(context, preInfo);
  const copiedDigest = yield* Effect.scoped(copyArchiveBytes(context, partialState));
  yield* maybeCrash(options.crashPoint, "after-payload-sync");

  const preCopySource = sourceStat(preInfo);
  const postInfo = yield* inspectCanonicalArchiveFile(
    context.object.sourcePath,
    "Failed inspecting source after copy."
  );
  const postCopySource = sourceStat(postInfo);
  if (!sameSourceIdentity(sourceIdentity(preInfo), sourceIdentity(postInfo))) {
    return yield* recordArchiveSourceChange(context, preCopySource, postCopySource);
  }
  yield* inspectExpectedSourceFile(context.object, "Failed validating source after copy.");
  return yield* promoteAndVerifyArchiveCopy(
    context,
    options,
    preCopySource,
    postCopySource,
    copiedDigest,
    partialState.resumeBytes
  );
});

const copyOneArchiveObject = Effect.fn("CorpusRestoration.copyOneArchiveObject")(function* (
  object: ArchiveSourceObject,
  options: RestorationPreserveOptions,
  archiveRoot: string,
  manifestPath: string,
  runId: string
): Effect.fn.Return<ArchiveFileCopyResult, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const destinationPath = path.join(archiveRoot, object.destinationRelativePath);
  yield* requireContainedPath(
    path,
    archiveRoot,
    destinationPath,
    "Archive object destination escapes the canonical preservation run root.",
    true
  );
  const destinationDirectory = path.dirname(destinationPath);
  yield* ensureCanonicalDirectoryPath(archiveRoot, destinationDirectory);
  let allowStableRebaseline = false;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const preInfo = yield* inspectArchiveAttemptSource(object, allowStableRebaseline);
    const stableAttemptObject = allowStableRebaseline ? { ...object, expectedInfo: sourceIdentity(preInfo) } : object;
    const context: ArchiveAttemptContext = {
      attemptId: `${runId}:${object.objectId}:${attempt}`,
      chunkSize: Math.max(1, options.chunkSizeBytes),
      destinationDirectory,
      destinationPath,
      manifestPath,
      object: stableAttemptObject,
      partialPath: `${destinationPath}.partial`,
      runId,
    };
    const outcome = yield* runArchiveCopyAttempt(context, options, preInfo);
    if (outcome.recordType === "archive-file-pass") return { pass: outcome, stableObject: stableAttemptObject };
    allowStableRebaseline = true;
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

const appendArchiveFailure = Effect.fn("CorpusRestoration.appendArchiveFailure")(function* (
  manifestPath: string,
  runId: string,
  objectId: string,
  sourceLabel: string,
  sourceRelativePath: string,
  failureKind: ArchiveFailureKind,
  message: string
): Effect.fn.Return<void, CorpusCommandError, RestorationRequirements> {
  yield* appendArchiveRecord(
    manifestPath,
    ArchiveLedgerRecord.cases["archive-failure"].make({
      approved: false,
      failureKind,
      message,
      objectId,
      recordedAt: yield* recordedAt(),
      recordType: "archive-failure",
      runId,
      schemaVersion,
      sourceLabel,
      sourceRelativePath,
    })
  );
});

const failArchiveSourceObject = Effect.fn("CorpusRestoration.failSourceObject")(function* (
  manifestPath: string,
  runId: string,
  source: ArchiveSourceObject,
  error: CorpusCommandError
): Effect.fn.Return<never, CorpusCommandError, RestorationRequirements> {
  yield* appendArchiveFailure(
    manifestPath,
    runId,
    source.objectId,
    source.sourceLabel,
    source.sourceRelativePath,
    "unreadable",
    "Preservation source object failed before a terminal PASS could be recorded."
  );
  return yield* error;
});

const failArchiveRun = Effect.fn("CorpusRestoration.failRun")(function* (
  manifestPath: string,
  runId: string,
  failureKind: ArchiveFailureKind,
  message: string,
  error: CorpusCommandError
): Effect.fn.Return<never, CorpusCommandError, RestorationRequirements> {
  yield* appendArchiveFailure(manifestPath, runId, "archive-run", "archive-run", ".", failureKind, message);
  return yield* error;
});

const writeArchivePreflight = Effect.fn("CorpusRestoration.writePreflight")(function* (
  context: PreservationWriteContext
): Effect.fn.Return<void, CorpusCommandError, RestorationRequirements> {
  yield* appendArchiveRecord(
    context.manifestPath,
    ArchiveLedgerRecord.cases["archive-preflight"].make({
      approved: context.capacityApproved,
      approvedCeilingBytes: nonNegative(context.options.capacityCeilingBytes),
      availableBytes: nonNegative(context.availableBytes),
      directoryCount: nonNegative(context.inventory.directories.length),
      fileCount: nonNegative(context.inventory.files.length),
      minimumFreeAfterBytes: context.options.minimumFreeAfterBytes,
      recordedAt: yield* recordedAt(),
      recordType: "archive-preflight",
      requiredBytes: nonNegative(context.inventory.requiredBytes),
      runId: context.runId,
      schemaVersion,
    })
  );
  if (!context.capacityApproved) {
    const error = archiveError("Preservation capacity preflight denied payload writes.");
    return yield* failArchiveRun(
      context.manifestPath,
      context.runId,
      "capacity-denied",
      "Required payload or retained free-space floor exceeds the approved capacity policy.",
      error
    );
  }
});

const writeInheritedLossRecords = Effect.fn("CorpusRestoration.writeInheritedLosses")(function* (
  context: PreservationWriteContext
): Effect.fn.Return<void, CorpusCommandError, RestorationRequirements> {
  const counts: ReadonlyArray<InheritedLossCount> = [
    ["collector-error", context.collector.collectorErrorCount],
    ["missing-recycle-payload", context.options.expectedMissingRecyclePayloadCount],
    ["mutated-destination", context.collector.mutatedDestinationCount],
    ["stripped-filesystem-metadata", context.inventory.files.length + context.inventory.directories.length],
  ];
  for (const [category, count] of counts) {
    yield* appendArchiveRecord(
      context.manifestPath,
      ArchiveLedgerRecord.cases["inherited-loss"].make({
        approved: true,
        category,
        count: nonNegative(count),
        recordedAt: yield* recordedAt(),
        recordType: "inherited-loss",
        runId: context.runId,
        schemaVersion,
      })
    );
  }
});

const preserveArchiveDirectories = Effect.fn("CorpusRestoration.preserveDirectories")(function* (
  context: PreservationWriteContext
): Effect.fn.Return<void, CorpusCommandError, RestorationRequirements> {
  const path = yield* Path.Path;
  for (const directory of context.inventory.directories) {
    yield* inspectExpectedSourceDirectory(directory, context.canonicalPaths.sourceRoot);
    const destination = yield* requireContainedPath(
      path,
      context.archiveRoot,
      path.join(context.archiveRoot, directory.destinationRelativePath),
      "Archive directory destination escapes the canonical preservation run root.",
      true
    );
    yield* ensureCanonicalDirectoryPath(context.archiveRoot, destination);
    yield* syncRestorationDirectory(destination);
    yield* syncRestorationDirectory(path.dirname(destination));
    yield* appendArchiveRecord(
      context.manifestPath,
      ArchiveLedgerRecord.cases["archive-directory-pass"].make({
        destinationRelativePath: directory.destinationRelativePath,
        objectId: directory.objectId,
        objectKind: "directory",
        recordedAt: yield* recordedAt(),
        recordType: "archive-directory-pass",
        runId: context.runId,
        schemaVersion,
        sourceLabel: directory.sourceLabel,
        sourceRelativePath: directory.sourceRelativePath,
      })
    );
  }
});

const preserveArchiveFiles = Effect.fn("CorpusRestoration.preserveFiles")(function* (
  context: PreservationWriteContext
): Effect.fn.Return<ReadonlyArray<ArchiveSourceObject>, CorpusCommandError, RestorationRequirements> {
  const salvagedAt = yield* recordedAt();
  const stableObjects: Array<ArchiveSourceObject> = [];
  for (const source of context.inventory.files) {
    const result = yield* copyOneArchiveObject(
      source,
      context.options,
      context.archiveRoot,
      context.manifestPath,
      context.runId
    ).pipe(
      Effect.catchTag("CorpusCommandError", (error) =>
        failArchiveSourceObject(context.manifestPath, context.runId, source, error)
      )
    );
    yield* appendArchiveRecord(context.manifestPath, result.pass);
    yield* appendProvenance(context.provenancePath, context.archiveRoot, result.stableObject, result.pass, salvagedAt);
    stableObjects.push(result.stableObject);
  }
  return stableObjects;
});

const reconcileStableSourceDirectories = Effect.fn("CorpusRestoration.reconcileStableSourceDirectories")(function* (
  context: PreservationWriteContext,
  stableFiles: ReadonlyArray<ArchiveSourceObject>
): Effect.fn.Return<ReadonlyArray<ArchiveDirectoryObject>, CorpusCommandError, RestorationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const changedTreeFiles = A.filter(
    stableFiles,
    (stableFile) =>
      stableFile.objectKind === "file" &&
      A.some(
        context.inventory.files,
        (originalFile) =>
          originalFile.objectId === stableFile.objectId &&
          !sameSourceIdentity(originalFile.expectedInfo, stableFile.expectedInfo)
      )
  );
  const reconcileOneDirectory = Effect.fn("CorpusRestoration.reconcileStableSourceDirectories.one")(function* (
    directory: ArchiveDirectoryObject
  ) {
    const sourcePath = path.resolve(context.canonicalPaths.sourceRoot, directory.sourceRelativePath);
    const isChangedFileAncestor = A.some(changedTreeFiles, (file) =>
      isContainedPath(path, sourcePath, file.sourcePath)
    );
    if (!isChangedFileAncestor) return directory;
    const info = yield* fs
      .stat(sourcePath)
      .pipe(CorpusCommandError.mapError("Failed reconciling a stable source replacement's parent directory."));
    const observedIdentity = sourceIdentity(info);
    if (!sameSourceIdentityExceptMtime(directory.expectedInfo, observedIdentity)) {
      return yield* archiveError(
        "A stable source replacement's parent directory changed beyond its expected timestamp transition."
      );
    }
    return {
      ...directory,
      expectedInfo: { ...directory.expectedInfo, mtimeMillis: observedIdentity.mtimeMillis },
    };
  });
  return yield* Effect.forEach(context.inventory.directories, reconcileOneDirectory);
});

const validateFinalArchiveInventory = Effect.fn("CorpusRestoration.validateFinalInventory")(function* (
  context: PreservationWriteContext,
  expectedInventory: ArchiveInventory
): Effect.fn.Return<void, CorpusCommandError, RestorationRequirements> {
  const finalInventory = yield* collectArchiveInventory(context.canonicalPaths).pipe(
    Effect.catchTag("CorpusCommandError", (error) =>
      failArchiveRun(
        context.manifestPath,
        context.runId,
        "source-manifest-mismatch",
        "Final preservation source inventory could not be reconciled.",
        error
      )
    )
  );
  yield* validateArchiveInventoryDenominators(context.options, finalInventory).pipe(
    Effect.catchTag("CorpusCommandError", (error) =>
      failArchiveRun(
        context.manifestPath,
        context.runId,
        "source-manifest-mismatch",
        "Final preservation source denominators contradict the approved preflight.",
        error
      )
    )
  );
  if (finalInventory.signature !== expectedInventory.signature) {
    const error = archiveError("Final preservation source inventory signature changed after preflight.");
    return yield* failArchiveRun(
      context.manifestPath,
      context.runId,
      "source-manifest-mismatch",
      "Final source inventory detected an addition, removal, rename, type change, or metadata change.",
      error
    );
  }
  const finalAvailableBytes = yield* availableRestorationBytesAt(context.canonicalPaths.corpusRoot);
  if (
    finalInventory.requiredBytes > context.options.capacityCeilingBytes ||
    finalAvailableBytes < context.options.minimumFreeAfterBytes
  ) {
    const error = archiveError("Final preservation capacity policy no longer holds.");
    return yield* failArchiveRun(
      context.manifestPath,
      context.runId,
      "capacity-denied",
      "Final source denominator or retained free-space floor exceeds the approved capacity policy.",
      error
    );
  }
});

const writePreservationArchive = Effect.fn("CorpusRestoration.writeArchive")(function* (
  context: PreservationWriteContext
): Effect.fn.Return<RestorationRunSummary, CorpusCommandError, RestorationRequirements> {
  yield* repairRestorationJsonlTail(context.manifestPath);
  yield* repairRestorationJsonlTail(context.provenancePath);
  yield* writeArchivePreflight(context);
  yield* writeInheritedLossRecords(context);
  yield* preserveArchiveDirectories(context);
  const stableFiles = yield* preserveArchiveFiles(context);
  const stableDirectories = yield* reconcileStableSourceDirectories(context, stableFiles);
  const expectedFinalInventory: ArchiveInventory = {
    ...context.inventory,
    directories: stableDirectories,
    files: stableFiles,
    signature: archiveInventorySignature(stableDirectories, stableFiles),
  };
  yield* validateFinalArchiveInventory(context, expectedFinalInventory);
  yield* sealArchiveManifest(context.manifestPath, context.runId, Math.max(1, context.options.chunkSizeBytes));
  const completedAt = DateTime.toEpochMillis(yield* DateTime.now);
  const sourceCount = context.inventory.files.length + context.inventory.directories.length;
  const summary = RestorationRunSummary.make({
    elapsedMillis: nonNegative(completedAt - context.startedAt),
    exceptionCount: nonNegative(0),
    family: "preservation",
    inputBytes: nonNegative(context.inventory.requiredBytes),
    outputBytes: nonNegative(context.inventory.requiredBytes),
    passCount: nonNegative(sourceCount),
    sourceCount: nonNegative(sourceCount),
    unapprovedCount: nonNegative(0),
  });
  yield* Console.log(
    `corpus restoration preserve: objects=${summary.sourceCount} bytes=${summary.outputBytes} unapproved=${summary.unapprovedCount}`
  );
  return summary;
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
  const canonicalPaths = yield* validateCanonicalArchivePaths(options);
  const inventory = yield* collectArchiveInventory(canonicalPaths);
  yield* validateArchiveInventoryDenominators(options, inventory);
  const collector = yield* reconcileCollectorManifest(options, canonicalPaths, inventory);
  const manifestPath = path.join(canonicalPaths.archiveRoot, "archive-ledger.jsonl");
  const provenancePath = path.join(canonicalPaths.corpusRoot, "raw", "provenance.jsonl");
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
  const availableBytes = yield* availableRestorationBytesAt(canonicalPaths.corpusRoot);
  const capacityApproved =
    inventory.requiredBytes <= options.capacityCeilingBytes &&
    availableBytes >= inventory.requiredBytes + options.minimumFreeAfterBytes;
  const context: PreservationWriteContext = {
    archiveRoot: canonicalPaths.archiveRoot,
    availableBytes,
    capacityApproved,
    canonicalPaths,
    collector,
    inventory,
    manifestPath,
    options,
    provenancePath,
    runId,
    startedAt,
  };
  const rawRoot = path.join(canonicalPaths.corpusRoot, "raw");
  yield* ensureCanonicalDirectoryPath(canonicalPaths.corpusRoot, rawRoot);
  yield* ensureCanonicalDirectoryPath(rawRoot, canonicalPaths.archiveRoot);
  return yield* withRestorationWriterClaim(
    canonicalPaths.archiveRoot,
    ".preservation-writer.claim",
    writePreservationArchive(context)
  );
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
  yield* ensureCanonicalDirectoryPath(archiveRoot, directory);
  if (yield* fs.exists(destinationPath).pipe(CorpusCommandError.mapError("Failed checking verification report."))) {
    yield* inspectCanonicalArchiveFile(
      destinationPath,
      "Existing archive verification report is not one canonical regular file."
    );
    const existing = yield* fs
      .readFileString(destinationPath)
      .pipe(CorpusCommandError.mapError("Failed reading existing verification report."));
    if (existing !== text) return yield* archiveError("Content-addressed verification report bytes drifted.");
    return;
  }
  if (yield* fs.exists(partialPath).pipe(CorpusCommandError.mapError("Failed checking partial verification report."))) {
    yield* inspectCanonicalArchiveFile(
      partialPath,
      "Partial archive verification report is not one canonical regular file."
    );
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
  if (!A.isReadonlyArrayNonEmpty(currentPreflights) || currentPreflights.length !== 1) {
    return yield* failArchiveVerification(
      archiveRoot,
      "manifest-corrupt",
      "Current sealed run must contain exactly one capacity preflight row."
    );
  }
  const currentPreflight = A.headNonEmpty(currentPreflights);
  if (!currentPreflight.approved) {
    return yield* failArchiveVerification(
      archiveRoot,
      "unapproved-terminal",
      "Current sealed run does not have an approved capacity preflight."
    );
  }
  const currentFailures = A.filter(currentRecords, (record) => record.recordType === "archive-failure");
  if (currentFailures.length > 0) {
    return yield* failArchiveVerification(
      archiveRoot,
      "unapproved-terminal",
      "A sealed preservation run cannot contain any archive failure record."
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
  let terminals = HashMap.empty<string, ArchiveTerminalRecord>();
  let duplicateObjectId = O.none<string>();
  for (const record of records) {
    if (!isArchiveTerminalRecord(record)) continue;
    if (HashMap.has(terminals, record.objectId)) {
      if (O.isNone(duplicateObjectId)) duplicateObjectId = O.some(record.objectId);
      continue;
    }
    terminals = HashMap.set(terminals, record.objectId, record);
  }
  return { duplicateObjectId, terminals };
};

const validateArchiveTerminalIndex = Effect.fn("CorpusRestoration.validateTerminalIndex")(function* (
  archiveRoot: string,
  records: ReadonlyArray<ArchiveLedgerRecord>,
  preflight: ArchivePreflight
): Effect.fn.Return<HashMap.HashMap<string, ArchiveTerminalRecord>, CorpusCommandError, RestorationRequirements> {
  const index = indexArchiveTerminals(records);
  if (O.isSome(index.duplicateObjectId)) {
    return yield* failArchiveVerification(
      archiveRoot,
      "duplicate-object",
      "Current sealed run contains duplicate terminal rows for one archive object.",
      index.duplicateObjectId.value
    );
  }
  if (HashMap.size(index.terminals) !== preflight.directoryCount + preflight.fileCount) {
    return yield* failArchiveVerification(
      archiveRoot,
      "manifest-corrupt",
      "Current sealed run terminal count does not reconcile to its approved preflight denominator."
    );
  }
  const destinationPaths = index.terminals.pipe(
    A.fromIterable,
    A.map(([, terminal]) =>
      terminal.recordType === "archive-failure" ? O.none<string>() : O.some(terminal.destinationRelativePath)
    ),
    A.getSomes
  );
  if (HashSet.size(HashSet.fromIterable(destinationPaths)) !== destinationPaths.length) {
    return yield* failArchiveVerification(
      archiveRoot,
      "duplicate-object",
      "Current sealed run contains duplicate archive destination paths."
    );
  }
  return index.terminals;
});

const requireArchivePayloadOwned = Effect.fn("CorpusRestoration.requireArchivePayloadOwned")(function* (
  archiveRoot: string,
  terminals: HashMap.HashMap<string, ArchiveTerminalRecord>
): Effect.fn.Return<void, CorpusCommandError, RestorationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const payloadRoot = path.join(archiveRoot, "payload");
  const expected = terminals.pipe(
    A.fromIterable,
    A.map(([, terminal]) =>
      terminal.recordType === "archive-failure" ? O.none<string>() : O.some(terminal.destinationRelativePath)
    ),
    A.getSomes,
    HashSet.fromIterable
  );
  const actual: Array<string> = [];
  const walkAt: (directory: string) => Effect.Effect<void, CorpusCommandError, RestorationRequirements> = Effect.fn(
    "CorpusRestoration.requireArchivePayloadOwned.walkAt"
  )(function* (directory) {
    const names = yield* fs
      .readDirectory(directory)
      .pipe(CorpusCommandError.mapError("Failed walking the sealed preservation payload tree."));
    for (const name of A.sort(names, Order.String)) {
      const absolutePath = path.join(directory, name);
      const canonical = yield* fs
        .realPath(absolutePath)
        .pipe(CorpusCommandError.mapError("Failed canonicalizing a sealed preservation payload entry."));
      const info = yield* fs
        .stat(absolutePath)
        .pipe(CorpusCommandError.mapError("Failed inspecting a sealed preservation payload entry."));
      if (canonical !== path.resolve(absolutePath) || (info.type !== "Directory" && info.type !== "File")) {
        return yield* failArchiveVerification(
          archiveRoot,
          "manifest-corrupt",
          "The physical preservation payload contains a noncanonical or unsupported entry."
        );
      }
      actual.push(path.relative(archiveRoot, absolutePath));
      if (info.type === "Directory") yield* walkAt(absolutePath);
    }
  });
  yield* walkAt(payloadRoot);
  if (
    actual.length !== HashSet.size(expected) ||
    A.some(actual, (relativePath) => !HashSet.has(expected, relativePath))
  ) {
    return yield* failArchiveVerification(
      archiveRoot,
      "manifest-corrupt",
      "The physical preservation payload does not exactly match sealed terminal ownership."
    );
  }
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
): Effect.fn.Return<TerminalVerificationOutcome, CorpusCommandError, RestorationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const canonical = yield* fs
    .realPath(destinationPath)
    .pipe(CorpusCommandError.mapError("Failed canonicalizing archive directory destination."));
  const info = yield* fs
    .stat(destinationPath)
    .pipe(CorpusCommandError.mapError("Failed inspecting archive directory destination."));
  if (canonical !== path.resolve(destinationPath) || info.type !== "Directory") {
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
): Effect.fn.Return<TerminalVerificationOutcome, CorpusCommandError, RestorationRequirements> {
  yield* inspectCanonicalArchiveFile(
    destinationPath,
    "Terminal archive destination is not one canonical regular file."
  );
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
      record: O.some(
        verificationFailure(objectId, "unapproved-terminal", "An archive failure record can never verify as PASS.")
      ),
    };
  }
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const destinationPath = yield* requireContainedPath(
    path,
    archiveRoot,
    path.resolve(archiveRoot, terminal.destinationRelativePath),
    "Terminal archive destination escapes the canonical preservation run root.",
    true
  );
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

const resolveVerificationArchiveRoot = Effect.fn("CorpusRestoration.resolveVerificationArchiveRoot")(function* (
  options: RestorationVerifyOptions
): Effect.fn.Return<string, CorpusCommandError, RestorationRequirements> {
  const path = yield* Path.Path;
  const corpusRoot = yield* requireCanonicalExistingPath(
    options.corpusRoot,
    "Directory",
    "Verification corpus root must be one canonical regular directory."
  );
  const rawRoot = path.join(corpusRoot, "raw");
  const archiveRoot = yield* requireContainedPath(
    path,
    rawRoot,
    path.resolve(rawRoot, options.runLabel),
    "Verification run label escapes the corpus raw root.",
    false
  );
  yield* requireCanonicalExistingPath(
    archiveRoot,
    "Directory",
    "Verification archive root must be one canonical regular directory."
  );
  return archiveRoot;
});

/**
 * Test-only semantic probes for preservation identity and path invariants.
 *
 * @category testing
 */
export const restorationArchiveTesting = {
  acquireObservedRestorationWriterClaim,
  archiveInventorySignature,
  appendProvenance,
  availableRestorationBytesAt,
  collectorRelativePath,
  collectArchiveInventory,
  currentBootId,
  decodeObservedWriterClaim,
  encodeRestorationWriterClaim,
  filesystemRootFor,
  hashResumedArchivePrefix,
  indexArchiveTerminals,
  inspectArchiveAttemptSource,
  inspectCanonicalPath,
  inspectExpectedSourceDirectory,
  inspectExpectedSourceFile,
  isArchiveTerminalRecord,
  isContainedPath,
  maybeCrash,
  moveObservedCoordinationFile,
  nonNegative,
  objectIdFor,
  parseProcStatStartTime,
  partialArchiveOpenFlag,
  pathsOverlap,
  persistVerificationReport,
  prefixMatches,
  processStartTime,
  promoteAndVerifyArchiveCopy,
  readCanonicalCoordinationFile,
  reconcileCompleteArchiveDestination,
  reconcileCollectorHistoricalIdentities,
  reconcileCollectorRecord,
  reapedCoordinationPath,
  resumableArchiveOffset,
  releaseArchiveWriterClaim,
  requireArchivePayloadOwned,
  requireCollectorDenominator,
  requireContainedPath,
  requireInventoryDenominator,
  sameDeviceAndInode,
  sameSourceIdentity,
  sameSourceIdentityExceptMtime,
  sourceIdentity,
  sourceIdentityToken,
  sourceStat,
  tryClaimWriterReapClaim,
  tryMoveObservedWriterClaim,
  tryRecoverObservedWriterReapClaim,
  tryReplaceStaleWriterClaim,
  tryWriteExclusiveCoordinationFile,
  validateArchiveManifestSeal,
  validateArchiveTerminalIndex,
  validateCanonicalArchivePaths,
  validateCurrentArchiveRun,
  validateFinalArchiveInventory,
  validateOpenedArchiveCopy,
  verifyArchiveDirectory,
  verifyArchiveFile,
  verifyArchiveTerminal,
  writerClaimOwnerIsAlive,
  writerReapClaimPath,
  writerReapClaimTombstonePath,
} as const;

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
  const archiveRoot = yield* resolveVerificationArchiveRoot(options);
  const manifestPath = path.join(archiveRoot, "archive-ledger.jsonl");
  const { lines, records } = yield* readArchiveManifest(manifestPath);
  const seal = yield* validateArchiveManifestSeal(archiveRoot, lines, records);
  const { currentPreflight, currentRecords } = yield* validateCurrentArchiveRun(archiveRoot, records, seal);
  const terminals = yield* validateArchiveTerminalIndex(archiveRoot, currentRecords, currentPreflight);
  yield* requireArchivePayloadOwned(archiveRoot, terminals);
  const outcomes = yield* Effect.forEach(A.fromIterable(terminals), ([objectId, terminal]) =>
    verifyArchiveTerminal(archiveRoot, objectId, terminal)
  );
  const results = A.getSomes(A.map(outcomes, (outcome) => outcome.record));
  const bytesVerified = A.reduce(outcomes, 0, (total, outcome) => total + outcome.bytesVerified);
  const sourceCount = HashMap.size(terminals);
  const passCount = A.filter(results, (record) => record.recordType === "verification-pass").length;
  const reconciles = passCount === sourceCount && results.length === sourceCount;
  const finalResults = reconciles
    ? results
    : A.append(
        results,
        verificationFailure(
          "archive-manifest",
          "manifest-corrupt",
          "Independent preservation PASS count does not equal its source denominator."
        )
      );
  const failures = A.filter(finalResults, (record) => record.recordType === "verification-failure");
  yield* persistVerificationReport(archiveRoot, finalResults);
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
    passCount: nonNegative(passCount),
    sourceCount: nonNegative(sourceCount),
    unapprovedCount: nonNegative(0),
  });
  yield* Console.log(
    `corpus restoration verify: terminals=${summary.sourceCount} passes=${summary.passCount} bytes=${summary.inputBytes}`
  );
  return summary;
});
