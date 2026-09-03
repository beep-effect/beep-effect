/**
 * Bounded mail, recycle, and legacy-document restoration programs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ArtifactId,
  ArtifactLocator,
  ContentDigest,
  OperationId,
  SourceArtifact,
} from "@beep/file-processing/Artifact";
import { ExportArchiveOperation, FileProcessingOperationError } from "@beep/file-processing/Operation";
import { makePffexportFileProcessingEngine, PffexportEngineConfig } from "@beep/libpff";
import { NonNegativeInt, PosInt, Sha256Hex } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import * as O from "@beep/utils/Option";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { DateTime, Effect, Equal, FileSystem, MutableHashMap, MutableHashSet, Order, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { OutputBound, runCaptured } from "../../../internal/process/StepExec.ts";
import { CorpusCommandError } from "../Corpus.errors.ts";
import { classifyRecycleBinName, parseRecycleBinMetadata } from "../Corpus.recyclebin.ts";
import {
  decodeArchiveLedgerRecordJson,
  decodeRestorationAcceptanceRecordJson,
  decodeTransformationLedgerRecordJson,
  encodeRestorationAcceptanceRecordJson,
  encodeTransformationLedgerRecordJson,
  RestorationAcceptanceRecord,
  RestorationRunSummary,
  TransformationLedgerRecord,
} from "./Restoration.schemas.ts";
import {
  appendRestorationTextDurably,
  availableRestorationBytesAt,
  hashRestorationFileStreaming,
  repairRestorationJsonlTail,
  syncRestorationDirectory,
  verifyRestorationArchiveImpl,
  withRestorationWriterClaim,
} from "./Restoration.ts";
import type { ArchiveExportResult } from "@beep/file-processing/Extraction";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { CapturedStep } from "../../../internal/process/StepExec.ts";
import type {
  ArchiveLedgerRecord,
  MailRestorationScope,
  RestorationLegacyWordOptions,
  RestorationMailOptions,
  RestorationRecycleOptions,
} from "./Restoration.schemas.ts";

type TransformationRequirements =
  | Crypto.Crypto
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner;

type PreservedFilePass = Extract<ArchiveLedgerRecord, { readonly recordType: "archive-file-pass" }>;
type PreservationSeal = Extract<ArchiveLedgerRecord, { readonly recordType: "archive-manifest-seal" }>;
type TransformationFamily = "legacy-word" | "mail" | "recycle";
type LegacyWordPass = Extract<TransformationLedgerRecord, { readonly recordType: "legacy-word-pass" }>;
type LegacyWordException = Extract<TransformationLedgerRecord, { readonly recordType: "legacy-word-exception" }>;

type MailCandidate = {
  readonly family: "eml" | "msg" | "ost" | "pst" | "residue";
  readonly objectId: string;
  readonly pass: O.Option<PreservedFilePass>;
  readonly sourcePath: string;
};

type PstMailCandidate = MailCandidate & {
  readonly family: "pst";
  readonly pass: O.Some<PreservedFilePass>;
};

type WalkedTransformationFile = {
  readonly absolutePath: string;
  readonly relativePath: string;
};

type WalkedTransformationEntry = WalkedTransformationFile & {
  readonly kind: "directory" | "file";
};

type TransformationTreeDigest = {
  readonly sha256: Sha256Hex;
  readonly sizeBytes: number;
};

type TransformationRunContext = {
  readonly archiveRoot: string;
  readonly corpusRoot: string;
  readonly family: TransformationFamily;
  readonly ledgerPath: string;
  readonly mailScope: O.Option<MailRestorationScope>;
  readonly outputRoot: string;
  readonly preservationRecords: ReadonlyArray<ArchiveLedgerRecord>;
  readonly preservationRunId: string;
  readonly preservationSealSha256: Sha256Hex;
  readonly runLabel: string;
  readonly runRoot: string;
  readonly startedAt: number;
  readonly transformationRunId: string;
};

type TransformationEvidenceIdentity = {
  readonly preservationRunId: string;
  readonly preservationSealSha256: Sha256Hex;
  readonly recordedAt: string;
  readonly runLabel: string;
  readonly schemaVersion: "oppold-corpus-restoration/v1";
  readonly transformationRunId: string;
};

type FamilyCounters = {
  readonly exceptionCount: number;
  readonly inputBytes: number;
  readonly outputBytes: number;
  readonly passCount: number;
  readonly unapprovedCount: number;
};

const transformationError = (message: string): CorpusCommandError => CorpusCommandError.make({ message });

const nonNegative = (value: number): NonNegativeInt => NonNegativeInt.make(Math.trunc(Math.max(value, 0)));

const attachmentProbeOutputBound = OutputBound.make({
  maxChars: 4096,
  truncatedNotice: "\n[attachment probe output truncated]",
});

const sandboxRuntimeRoots: ReadonlyArray<string> = ["/usr", "/bin", "/lib", "/lib64", "/etc", "/var"];

const sandboxRuntimeBinds = Effect.fn("CorpusRestoration.sandboxRuntimeBinds")(function* (): Effect.fn.Return<
  ReadonlyArray<string>,
  CorpusCommandError,
  FileSystem.FileSystem
> {
  const fs = yield* FileSystem.FileSystem;
  const binds: Array<string> = [];
  for (const root of sandboxRuntimeRoots) {
    if (yield* fs.exists(root).pipe(CorpusCommandError.mapError("Failed probing a sandbox runtime root."))) {
      binds.push("--ro-bind", root, root);
    }
  }
  return binds;
});

const sandboxBaseArgs = (runtimeBinds: ReadonlyArray<string>): ReadonlyArray<string> => [
  "--die-with-parent",
  "--new-session",
  "--unshare-all",
  ...runtimeBinds,
  "--proc",
  "/proc",
  "--dev",
  "/dev",
  "--tmpfs",
  "/tmp",
  "--dir",
  "/tmp/home",
  "--dir",
  "/input",
  "--clearenv",
  "--setenv",
  "PATH",
  "/usr/bin:/bin",
  "--setenv",
  "LANG",
  "C.UTF-8",
  "--setenv",
  "HOME",
  "/tmp/home",
];

type SandboxedTool = {
  readonly bindArgs: ReadonlyArray<string>;
  readonly executable: string;
};

const sandboxedTool = (path: Path.Path, executable: string, name: string): SandboxedTool => {
  if (!path.isAbsolute(executable)) return { bindArgs: [], executable };
  const covered = A.some(sandboxRuntimeRoots, (root) => {
    const relative = path.relative(root, executable);
    return (
      relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !Str.startsWith(`..${path.sep}`)(relative))
    );
  });
  if (covered) return { bindArgs: [], executable };
  const sandboxExecutable = `/tool/${name}`;
  return {
    bindArgs: ["--dir", "/tool", "--ro-bind", executable, sandboxExecutable],
    executable: sandboxExecutable,
  };
};

const quarantineDisposition = (): { readonly disposition: "quarantine" } => ({ disposition: "quarantine" });

const schemaVersion = "oppold-corpus-restoration/v1";

const transformationIdentity = Effect.fn("CorpusRestoration.transformationIdentity")(function* (
  context: TransformationRunContext
): Effect.fn.Return<TransformationEvidenceIdentity> {
  return {
    preservationRunId: context.preservationRunId,
    preservationSealSha256: context.preservationSealSha256,
    recordedAt: DateTime.formatIso(yield* DateTime.now),
    runLabel: context.runLabel,
    schemaVersion,
    transformationRunId: context.transformationRunId,
  };
});

const requireMailScope = (context: TransformationRunContext): Effect.Effect<MailRestorationScope, CorpusCommandError> =>
  Effect.fromOption(context.mailScope, () =>
    transformationError("Mail evidence requires an explicit restoration scope.")
  );

const withTransformationRunWriter = Effect.fn("CorpusRestoration.withTransformationRunWriter")(function* <A, E, R>(
  context: TransformationRunContext,
  claimName: string,
  use: Effect.Effect<A, E, R>
): Effect.fn.Return<A, E | CorpusCommandError, R | FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const claimDirectory = path.join(context.runRoot, "writer-claims");
  yield* fs
    .makeDirectory(claimDirectory, { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating the transformation writer-claim directory."));
  yield* requireCanonicalContainedPath(claimDirectory, claimDirectory);
  return yield* withRestorationWriterClaim(claimDirectory, claimName, use);
});

const withTransformationFamilyWriter = <A, E, R>(
  context: TransformationRunContext,
  use: Effect.Effect<A, E, R>
): Effect.Effect<A, E | CorpusCommandError, R | FileSystem.FileSystem | Path.Path> => {
  const scope = O.getOrElse(context.mailScope, () => "full");
  return withTransformationRunWriter(context, `${context.family}-${scope}.claim`, use);
};

const appendTransformationRecord = Effect.fn("CorpusRestoration.appendTransformationRecord")(function* (
  ledgerPath: string,
  record: TransformationLedgerRecord
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const encoded = yield* encodeTransformationLedgerRecordJson(record).pipe(
    CorpusCommandError.mapError("Transformation ledger record failed JSONL encoding.")
  );
  yield* appendRestorationTextDurably(ledgerPath, `${encoded}\n`);
});

const prepareTransformationRun = Effect.fn("CorpusRestoration.prepareTransformationRun")(function* (
  corpusRoot: string,
  runLabel: string,
  family: TransformationFamily,
  scope: "full" | "slice"
): Effect.fn.Return<TransformationRunContext, CorpusCommandError, TransformationRequirements> {
  yield* verifyRestorationArchiveImpl({ corpusRoot, runLabel });
  const path = yield* Path.Path;
  const preservation = yield* currentPreservationEvidence(corpusRoot, runLabel);
  const runRoot = path.join(corpusRoot, "staging", "restoration", "runs", runLabel);
  const transformationRunId = `transformation:${digestString(
    `${runLabel}\u0000${preservation.seal.runId}\u0000${preservation.seal.manifestSha256}\u0000${family}\u0000${scope}`
  )}`;
  return {
    archiveRoot: path.join(corpusRoot, "raw", runLabel),
    corpusRoot,
    family,
    ledgerPath: path.join(runRoot, "ledgers", family, `${scope}.jsonl`),
    mailScope: family === "mail" ? O.some(scope) : O.none(),
    outputRoot: path.join(runRoot, "output", family, scope),
    preservationRecords: preservation.records,
    preservationRunId: preservation.seal.runId,
    preservationSealSha256: preservation.seal.manifestSha256,
    runLabel,
    runRoot,
    startedAt: DateTime.toEpochMillis(yield* DateTime.now),
    transformationRunId,
  };
});

const emptyFamilyCounters = (): FamilyCounters => ({
  exceptionCount: 0,
  inputBytes: 0,
  outputBytes: 0,
  passCount: 0,
  unapprovedCount: 0,
});

const addFamilyTerminal = (
  counters: FamilyCounters,
  terminal: {
    readonly inputBytes: number;
    readonly outputBytes: number;
    readonly passed: boolean;
    readonly unapproved: boolean;
  }
): FamilyCounters => ({
  exceptionCount: counters.exceptionCount + (terminal.passed ? 0 : 1),
  inputBytes: counters.inputBytes + terminal.inputBytes,
  outputBytes: counters.outputBytes + terminal.outputBytes,
  passCount: counters.passCount + (terminal.passed ? 1 : 0),
  unapprovedCount: counters.unapprovedCount + (terminal.unapproved ? 1 : 0),
});

const currentPreservationEvidence = Effect.fn("CorpusRestoration.currentPreservationEvidence")(function* (
  corpusRoot: string,
  runLabel: string
): Effect.fn.Return<
  { readonly records: ReadonlyArray<ArchiveLedgerRecord>; readonly seal: PreservationSeal },
  CorpusCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifestPath = path.join(corpusRoot, "raw", runLabel, "archive-ledger.jsonl");
  const text = yield* fs
    .readFileString(manifestPath)
    .pipe(CorpusCommandError.mapError("Failed reading the sealed preservation ledger for transformation."));
  const lines = A.filter(Str.split(/\r?\n/u)(text), Str.isNonEmpty);
  const records = yield* Effect.forEach(lines, (line) =>
    decodeArchiveLedgerRecordJson(line).pipe(
      CorpusCommandError.mapError("Preservation ledger failed transformation-gate decoding.")
    )
  );
  const seal = O.getOrElse(A.last(records), () => undefined);
  if (seal === undefined || seal.recordType !== "archive-manifest-seal") {
    return yield* transformationError("Transformation requires a terminally sealed preservation ledger.");
  }
  return { records: A.filter(records, (record) => record.runId === seal.runId), seal };
});

const requireCanonicalContainedPath = Effect.fn("CorpusRestoration.requireCanonicalContainedPath")(function* (
  root: string,
  candidate: string
): Effect.fn.Return<string, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  const canonicalRoot = yield* fs
    .realPath(resolvedRoot)
    .pipe(CorpusCommandError.mapError("Failed canonicalizing transformation output root."));
  const canonicalCandidate = yield* fs
    .realPath(resolvedCandidate)
    .pipe(CorpusCommandError.mapError("Failed canonicalizing transformation output entry."));
  const relative = path.relative(canonicalRoot, canonicalCandidate);
  if (
    canonicalRoot !== resolvedRoot ||
    canonicalCandidate !== resolvedCandidate ||
    relative === ".." ||
    Str.startsWith(`..${path.sep}`)(relative) ||
    path.isAbsolute(relative)
  ) {
    return yield* transformationError("Transformation tree contains a symlinked or escaping path.");
  }
  return canonicalCandidate;
});

const deterministicPreservationElapsed = (
  records: ReadonlyArray<ArchiveLedgerRecord>,
  seal: PreservationSeal
): Effect.Effect<NonNegativeInt, CorpusCommandError> => {
  const preflight = A.findFirst(records, (record) => record.recordType === "archive-preflight");
  const startedAt = O.flatMap(preflight, (record) => DateTime.make(record.recordedAt));
  const sealedAt = DateTime.make(seal.recordedAt);
  return O.match(
    O.zipWith(startedAt, sealedAt, (start, end) => DateTime.toEpochMillis(end) - DateTime.toEpochMillis(start)),
    {
      onNone: () =>
        Effect.fail(
          transformationError("Preservation timestamps cannot derive deterministic acceptance elapsed time.")
        ),
      onSome: (elapsedMillis) => Effect.succeed(nonNegative(elapsedMillis)),
    }
  );
};

const walkTransformationEntries = Effect.fn("CorpusRestoration.walkTransformationEntries")(function* (
  root: string
): Effect.fn.Return<ReadonlyArray<WalkedTransformationEntry>, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* requireCanonicalContainedPath(root, root);
  const entries: Array<WalkedTransformationEntry> = [];
  const walkAt: (directory: string) => Effect.Effect<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> =
    Effect.fn("CorpusRestoration.walkTransformationEntries.walkAt")(function* (directory) {
      const names = yield* fs
        .readDirectory(directory)
        .pipe(CorpusCommandError.mapError("Failed walking transformation output."));
      for (const name of A.sort(names, Order.String)) {
        const absolutePath = path.join(directory, name);
        yield* requireCanonicalContainedPath(root, absolutePath);
        const info = yield* fs
          .stat(absolutePath)
          .pipe(CorpusCommandError.mapError("Failed inspecting transformation output."));
        if (info.type === "Directory") {
          entries.push({ absolutePath, kind: "directory", relativePath: path.relative(root, absolutePath) });
          yield* walkAt(absolutePath);
          continue;
        }
        if (info.type !== "File") {
          return yield* transformationError("Transformation output contains an unsupported non-file object.");
        }
        entries.push({ absolutePath, kind: "file", relativePath: path.relative(root, absolutePath) });
      }
    });
  yield* walkAt(root);
  return entries;
});

const walkFiles = Effect.fn("CorpusRestoration.walkTransformationFiles")(function* (
  root: string
): Effect.fn.Return<ReadonlyArray<WalkedTransformationFile>, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  return A.map(
    A.filter(yield* walkTransformationEntries(root), (entry) => entry.kind === "file"),
    ({ absolutePath, relativePath }) => ({ absolutePath, relativePath })
  );
});

const hashTransformationTree = Effect.fn("CorpusRestoration.hashTransformationTree")(function* (
  root: string
): Effect.fn.Return<TransformationTreeDigest, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs
    .exists(root)
    .pipe(CorpusCommandError.mapError("Failed checking transformation tree for hashing."));
  if (!exists) return { sha256: digestString(""), sizeBytes: 0 };
  const rootInfo = yield* fs
    .stat(root)
    .pipe(CorpusCommandError.mapError("Failed inspecting transformation tree root."));
  if (rootInfo.type === "File") {
    yield* requireCanonicalContainedPath(root, root);
    const digest = yield* hashRestorationFileStreaming(root, 1024 * 1024);
    return {
      sha256: digestString(`F\u0000.\u0000${digest.sha256}\u0000${digest.sizeBytes}\n`),
      sizeBytes: digest.sizeBytes,
    };
  }
  if (rootInfo.type !== "Directory") {
    return yield* transformationError("Transformation tree root is neither a file nor a directory.");
  }
  yield* requireCanonicalContainedPath(root, root);
  const hasher = sha256.create();
  let sizeBytes = 0;
  const walkAt: (directory: string) => Effect.Effect<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> =
    Effect.fn("CorpusRestoration.hashTransformationTree.walkAt")(function* (directory) {
      const names = yield* fs
        .readDirectory(directory)
        .pipe(CorpusCommandError.mapError("Failed reading transformation tree during hashing."));
      for (const name of A.sort(names, Order.String)) {
        const absolutePath = path.join(directory, name);
        yield* requireCanonicalContainedPath(root, absolutePath);
        const relativePath = path.relative(root, absolutePath);
        const info = yield* fs
          .stat(absolutePath)
          .pipe(CorpusCommandError.mapError("Failed inspecting transformation tree entry during hashing."));
        if (info.type === "Directory") {
          hasher.update(utf8ToBytes(`D\u0000${relativePath}\n`));
          yield* walkAt(absolutePath);
          continue;
        }
        if (info.type !== "File") {
          return yield* transformationError("Transformation tree contains an unsupported non-file object.");
        }
        const digest = yield* hashRestorationFileStreaming(absolutePath, 1024 * 1024);
        yield* requireCanonicalContainedPath(root, absolutePath);
        hasher.update(utf8ToBytes(`F\u0000${relativePath}\u0000${digest.sha256}\u0000${digest.sizeBytes}\n`));
        sizeBytes += digest.sizeBytes;
      }
    });
  hasher.update(utf8ToBytes("D\u0000.\n"));
  yield* walkAt(root);
  return { sha256: Sha256Hex.make(bytesToHex(hasher.digest())), sizeBytes };
});

const measureTransformationTreeBytes = Effect.fn("CorpusRestoration.measureTransformationTreeBytes")(function* (
  root: string
): Effect.fn.Return<number, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(root)
    .pipe(CorpusCommandError.mapError("Failed checking transformation tree for bounded measurement."));
  if (!exists) return 0;
  const info = yield* fs
    .stat(root)
    .pipe(CorpusCommandError.mapError("Failed inspecting transformation tree for bounded measurement."));
  if (info.type === "File") {
    yield* requireCanonicalContainedPath(root, root);
    return Number(info.size);
  }
  if (info.type !== "Directory") {
    return yield* transformationError("Measured transformation tree contains an unsupported object type.");
  }
  const sizes = yield* Effect.forEach(
    yield* walkFiles(root),
    (file) =>
      fs.stat(file.absolutePath).pipe(
        Effect.map((fileInfo) => Number(fileInfo.size)),
        CorpusCommandError.mapError("Failed measuring a canonical transformation output file.")
      ),
    { concurrency: 1 }
  );
  return A.reduce(sizes, 0, (total, size) => total + size);
});

const syncTree = Effect.fn("CorpusRestoration.syncTransformationTree")(function* (
  root: string
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = yield* walkFiles(root);
  const directories = MutableHashSet.fromIterable([root]);
  for (const file of files) {
    yield* Effect.scoped(
      fs.open(file.absolutePath, { flag: "r" }).pipe(
        Effect.flatMap((handle) => handle.sync),
        CorpusCommandError.mapError("Failed syncing transformation output file.")
      )
    );
    let directory = path.dirname(file.absolutePath);
    while (directory.startsWith(root)) {
      MutableHashSet.add(directories, directory);
      if (directory === root) break;
      directory = path.dirname(directory);
    }
  }
  const ordered = A.sort(
    A.fromIterable(directories),
    Order.mapInput(Order.Number, (directory: string) => -directory.length)
  );
  for (const directory of ordered) yield* syncRestorationDirectory(directory);
});

const sourceExtension = (path: Path.Path, value: string): string =>
  Str.toLowerCase(Str.replace(/^\./u, "")(path.extname(value)));

const residueRootFor = (relativePath: string): O.Option<string> => {
  const normalized = Str.replaceAll("\\", "/")(relativePath);
  const segments = Str.split("/")(normalized);
  const index = A.findFirstIndex(
    segments,
    (segment) =>
      Str.endsWith(".export")(segment) || Str.endsWith(".orphans")(segment) || Str.endsWith(".recovered")(segment)
  );
  return O.map(index, (value) => A.join(A.take(segments, value + 1), "/"));
};

const mailFileCandidate = (
  path: Path.Path,
  archiveRoot: string,
  record: ArchiveLedgerRecord
): O.Option<MailCandidate> => {
  if (record.recordType !== "archive-file-pass") return O.none();
  const family = sourceExtension(path, record.sourceRelativePath);
  if (family !== "pst" && family !== "ost" && family !== "msg" && family !== "eml") return O.none();
  return O.some({
    family,
    objectId: record.objectId,
    pass: O.some(record),
    sourcePath: path.join(archiveRoot, record.destinationRelativePath),
  });
};

const collectResidueRoot = (
  roots: MutableHashMap.MutableHashMap<string, string>,
  record: ArchiveLedgerRecord
): void => {
  if (record.recordType !== "archive-file-pass") return;
  O.map(residueRootFor(record.sourceRelativePath), (root) => {
    if (!MutableHashMap.has(roots, root)) MutableHashMap.set(roots, root, record.objectId);
  });
};

const makeMailResidueCandidate = (
  path: Path.Path,
  archiveRoot: string,
  relativePath: string,
  objectId: string
): MailCandidate => ({
  family: "residue",
  objectId,
  pass: O.none(),
  sourcePath: path.join(archiveRoot, "payload", "tree", relativePath),
});

const mailResidueCandidates = (
  path: Path.Path,
  archiveRoot: string,
  records: ReadonlyArray<ArchiveLedgerRecord>
): ReadonlyArray<MailCandidate> => {
  const roots = MutableHashMap.empty<string, string>();
  for (const record of records) collectResidueRoot(roots, record);
  return A.map(A.fromIterable(roots), ([relativePath, objectId]) =>
    makeMailResidueCandidate(path, archiveRoot, relativePath, objectId)
  );
};

const mailCandidates = (
  path: Path.Path,
  archiveRoot: string,
  records: ReadonlyArray<ArchiveLedgerRecord>
): ReadonlyArray<MailCandidate> => {
  const candidates = A.appendAll(
    A.getSomes(A.map(records, (record) => mailFileCandidate(path, archiveRoot, record))),
    mailResidueCandidates(path, archiveRoot, records)
  );
  return A.sort(
    candidates,
    Order.mapInput(Order.String, (candidate: MailCandidate) => `${candidate.family}:${candidate.objectId}`)
  );
};

const selectMailCandidates = (
  path: Path.Path,
  scope: RestorationMailOptions["scope"],
  candidates: ReadonlyArray<MailCandidate>
): ReadonlyArray<MailCandidate> => {
  if (scope === "full") return candidates;
  const eligible = A.filter(
    candidates,
    (candidate): candidate is PstMailCandidate =>
      candidate.family === "pst" &&
      O.isSome(candidate.pass) &&
      candidate.pass.value.sizeBytes >= 1024 * 1024 &&
      (Str.includes("$Recycle.Bin")(candidate.pass.value.sourceRelativePath) ||
        Str.startsWith("$R")(path.basename(candidate.pass.value.sourceRelativePath)))
  );
  return A.take(
    A.sort(
      eligible,
      Order.mapInput(Order.Number, (candidate: PstMailCandidate) => candidate.pass.value.sizeBytes)
    ),
    1
  );
};

const classifyMailFailure = (message: string): "codepage" | "corrupt" | "engine-failure" | "password" => {
  const normalized = Str.toLowerCase(message);
  if (Str.includes("password")(normalized) || Str.includes("encrypted")(normalized)) return "password";
  if (Str.includes("codepage")(normalized) || Str.includes("code page")(normalized)) return "codepage";
  if (Str.includes("corrupt")(normalized) || Str.includes("invalid")(normalized)) return "corrupt";
  return "engine-failure";
};

const isFileProcessingOperationError = S.is(FileProcessingOperationError);

const classifyMailError = (error: unknown): "codepage" | "corrupt" | "engine-failure" | "password" => {
  if (isFileProcessingOperationError(error)) {
    if (error.details !== undefined) {
      const classification = error.details.processClassification;
      if (classification === "codepage" || classification === "corrupt" || classification === "password") {
        return classification;
      }
    }
    return classifyMailFailure(error.message);
  }
  return classifyMailFailure(S.is(S.String)(error) ? error : "Unknown mail engine failure.");
};

const signatureExtension = (bytes: Uint8Array): O.Option<string> => {
  const starts = (...values: ReadonlyArray<number>): boolean =>
    values.length <= bytes.length && values.every((value, index) => bytes[index] === value);
  if (starts(0x25, 0x50, 0x44, 0x46)) return O.some("pdf");
  if (starts(0x89, 0x50, 0x4e, 0x47)) return O.some("png");
  if (starts(0xff, 0xd8, 0xff)) return O.some("jpg");
  if (starts(0x47, 0x49, 0x46, 0x38)) return O.some("gif");
  if (starts(0x50, 0x4b, 0x03, 0x04)) return O.some("zip");
  return O.none();
};

const readPrefix = Effect.fn("CorpusRestoration.readPrefix")(function* (
  filePath: string
): Effect.fn.Return<Uint8Array, CorpusCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.scoped(
    fs.open(filePath, { flag: "r" }).pipe(
      Effect.flatMap((handle) => handle.readAlloc(16)),
      Effect.map((value) => O.getOrElse(value, () => new Uint8Array())),
      CorpusCommandError.mapError("Failed reading attachment signature bytes.")
    )
  );
});

const appendAttachmentRepair = Effect.fn("CorpusRestoration.appendAttachmentRepair")(function* (
  context: TransformationRunContext,
  attemptId: string,
  objectId: string,
  originalRelativePath: string,
  detectedExtension: string,
  derivedRelativePath: string,
  repairStatus: "repaired" | "unchanged" | "unsupported",
  derived: O.Option<{ readonly sha256: Sha256Hex; readonly sizeBytes: PosInt }>
) {
  const existing = A.filter(
    A.filter(yield* resumableTransformationRecords(context), isRecordType("attachment-type-repair")),
    (record) =>
      record.attemptId === attemptId &&
      record.sourceObjectId === objectId &&
      record.originalRelativePath === originalRelativePath &&
      record.derivedRelativePath === derivedRelativePath
  );
  if (existing.length > 0) {
    const matches = A.every(
      existing,
      (record) =>
        record.detectedExtension === detectedExtension &&
        record.repairStatus === repairStatus &&
        record.derivedSha256 === O.getOrUndefined(O.map(derived, (value) => value.sha256)) &&
        record.derivedSizeBytes === O.getOrUndefined(O.map(derived, (value) => value.sizeBytes))
    );
    if (existing.length === 1 && matches) return;
    return yield* transformationError("Attachment repair checkpoint conflicts with an existing immutable identity.");
  }
  yield* appendTransformationRecord(
    context.ledgerPath,
    TransformationLedgerRecord.cases["attachment-type-repair"].make({
      ...(yield* transformationIdentity(context)),
      attemptId,
      detectedExtension,
      ...(O.isSome(derived) ? { derivedSha256: derived.value.sha256, derivedSizeBytes: derived.value.sizeBytes } : {}),
      derivedRelativePath,
      family: "mail",
      mailScope: yield* requireMailScope(context),
      originalRelativePath,
      recordType: "attachment-type-repair",
      repairStatus,
      sourceObjectId: objectId,
    })
  );
});

const requireAttachmentCapacity = Effect.fn("CorpusRestoration.requireAttachmentCapacity")(function* (
  context: TransformationRunContext,
  attemptRoot: string,
  nextSizeBytes: number,
  attemptOutputCeiling: number,
  message: string
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const retained = yield* hashTransformationTree(attemptRoot);
  const available = yield* availableRestorationBytesAt(context.corpusRoot);
  if (nextSizeBytes > attemptOutputCeiling - retained.sizeBytes || available < nextSizeBytes) {
    return yield* transformationError(message);
  }
});

const materializeAttachmentRepair = Effect.fn("CorpusRestoration.materializeAttachmentRepair")(function* (
  sourcePath: string,
  derivedPath: string,
  attemptRoot: string,
  expected: TransformationTreeDigest,
  context: TransformationRunContext,
  attemptOutputCeiling: number
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs
    .exists(derivedPath)
    .pipe(CorpusCommandError.mapError("Failed checking content-addressed attachment-repair output."));
  if (exists) {
    yield* requireCanonicalContainedPath(attemptRoot, derivedPath);
    const retained = yield* hashRestorationFileStreaming(derivedPath, 1024 * 1024);
    if (retained.sha256 !== expected.sha256 || retained.sizeBytes !== expected.sizeBytes) {
      return yield* transformationError("Content-addressed attachment repair conflicts with retained bytes.");
    }
    return;
  }
  yield* requireAttachmentCapacity(
    context,
    attemptRoot,
    expected.sizeBytes,
    attemptOutputCeiling,
    "Attachment repair has no remaining retained-output budget."
  );
  yield* fs
    .makeDirectory(path.dirname(derivedPath), { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating attachment-repair output directory."));
  yield* exclusiveCopyFile(sourcePath, derivedPath, attemptRoot);
});

const extractAttachmentText = Effect.fn("CorpusRestoration.extractAttachmentText")(function* (
  derivedPath: string,
  attemptId: string,
  options: RestorationMailOptions,
  context: TransformationRunContext,
  attemptStartedAt: number
): Effect.fn.Return<string, CorpusCommandError, TransformationRequirements> {
  const path = yield* Path.Path;
  const now = DateTime.toEpochMillis(yield* DateTime.now);
  const remainingProbeMillis = Math.min(
    options.maxElapsedMillis - (now - attemptStartedAt),
    options.maxTotalElapsedMillis - (now - context.startedAt)
  );
  if (remainingProbeMillis <= 0) {
    return yield* transformationError(`Attachment repair exhausted the elapsed-time budget for ${attemptId}.`);
  }
  const java = sandboxedTool(path, options.javaPath, "java");
  const probe = yield* runCaptured({
    args: [
      ...sandboxBaseArgs(yield* sandboxRuntimeBinds()),
      ...java.bindArgs,
      "--ro-bind",
      options.tikaJarPath,
      "/input/tika.jar",
      "--ro-bind",
      derivedPath,
      "/input/source",
      "--",
      java.executable,
      "-jar",
      "/input/tika.jar",
      "-J",
      "-t",
      "/input/source",
    ],
    bound: attachmentProbeOutputBound,
    command: options.bwrapPath,
    forceKillAfter: "1 second",
    source: "stdout",
    timeout: remainingProbeMillis,
    trim: true,
  }).pipe(CorpusCommandError.mapError("Attachment repair second-pass Tika invocation failed."));
  if (probe.exitCode !== 0 || probe.truncated || Str.isEmpty(probe.output)) {
    return yield* transformationError(`Attachment repair second pass failed for attempt ${attemptId}.`);
  }
  return `${probe.output}\n`;
});

const persistAttachmentText = Effect.fn("CorpusRestoration.persistAttachmentText")(function* (
  attemptRoot: string,
  tikaRelativePath: string,
  tikaText: string,
  context: TransformationRunContext,
  attemptOutputCeiling: number
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tikaPath = path.join(attemptRoot, tikaRelativePath);
  const tikaSizeBytes = utf8ToBytes(tikaText).length;
  const tikaSha256 = digestString(tikaText);
  const exists = yield* fs
    .exists(tikaPath)
    .pipe(CorpusCommandError.mapError("Failed checking content-addressed attachment Tika output."));
  if (exists) {
    yield* requireCanonicalContainedPath(attemptRoot, tikaPath);
    const retained = yield* hashRestorationFileStreaming(tikaPath, 1024 * 1024);
    if (retained.sha256 !== tikaSha256 || retained.sizeBytes !== tikaSizeBytes) {
      return yield* transformationError("Content-addressed attachment Tika output conflicts with retained bytes.");
    }
    return;
  }
  yield* requireAttachmentCapacity(
    context,
    attemptRoot,
    tikaSizeBytes,
    attemptOutputCeiling,
    "Attachment Tika evidence has no remaining output budget."
  );
  const tikaPartialPath = `${tikaPath}.partial`;
  yield* appendRestorationTextDurably(tikaPartialPath, tikaText);
  yield* fs
    .rename(tikaPartialPath, tikaPath)
    .pipe(CorpusCommandError.mapError("Failed atomically retaining bounded attachment Tika output."));
  yield* syncRestorationDirectory(path.dirname(tikaPath));
});

const repairDetectedAttachment = Effect.fn("CorpusRestoration.repairDetectedAttachment")(function* (
  file: WalkedTransformationFile,
  detectedExtension: string,
  attemptRoot: string,
  attemptId: string,
  objectId: string,
  options: RestorationMailOptions,
  context: TransformationRunContext,
  attemptStartedAt: number,
  attemptOutputCeiling: number
): Effect.fn.Return<number, CorpusCommandError, TransformationRequirements> {
  const path = yield* Path.Path;
  const digest = yield* hashRestorationFileStreaming(file.absolutePath, 1024 * 1024);
  const derivedRelativePath = path.join("derived", "attachment-repairs", `${digest.sha256}.${detectedExtension}`);
  const derivedPath = path.join(attemptRoot, derivedRelativePath);
  yield* materializeAttachmentRepair(
    file.absolutePath,
    derivedPath,
    attemptRoot,
    digest,
    context,
    attemptOutputCeiling
  );
  const tikaText = yield* extractAttachmentText(derivedPath, attemptId, options, context, attemptStartedAt);
  const tikaRelativePath = path.join("derived", "attachment-repairs", `${digest.sha256}.tika.txt`);
  yield* persistAttachmentText(attemptRoot, tikaRelativePath, tikaText, context, attemptOutputCeiling);
  const derivedDigest = yield* hashRestorationFileStreaming(derivedPath, 1024 * 1024);
  if (derivedDigest.sizeBytes <= 0) {
    return yield* transformationError(`Attachment repair produced an empty derived file for attempt ${attemptId}.`);
  }
  yield* appendAttachmentRepair(
    context,
    attemptId,
    objectId,
    file.relativePath,
    detectedExtension,
    derivedRelativePath,
    "repaired",
    O.some({ sha256: derivedDigest.sha256, sizeBytes: PosInt.make(derivedDigest.sizeBytes) })
  );
  return 1;
});

const repairAttachment = Effect.fn("CorpusRestoration.repairAttachment")(function* (
  file: WalkedTransformationFile,
  attemptRoot: string,
  attemptId: string,
  objectId: string,
  options: RestorationMailOptions,
  context: TransformationRunContext,
  attemptStartedAt: number,
  attemptOutputCeiling: number
): Effect.fn.Return<number, CorpusCommandError, TransformationRequirements> {
  const path = yield* Path.Path;
  const detected = signatureExtension(yield* readPrefix(file.absolutePath));
  if (O.isNone(detected)) {
    yield* appendAttachmentRepair(
      context,
      attemptId,
      objectId,
      file.relativePath,
      "unknown",
      file.relativePath,
      "unsupported",
      O.none()
    );
    return 0;
  }
  if (sourceExtension(path, file.relativePath) === detected.value) {
    yield* appendAttachmentRepair(
      context,
      attemptId,
      objectId,
      file.relativePath,
      detected.value,
      file.relativePath,
      "unchanged",
      O.none()
    );
    return 0;
  }
  return yield* repairDetectedAttachment(
    file,
    detected.value,
    attemptRoot,
    attemptId,
    objectId,
    options,
    context,
    attemptStartedAt,
    attemptOutputCeiling
  );
});

const repairAttachments = Effect.fn("CorpusRestoration.repairAttachments")(function* (
  attemptRoot: string,
  attemptId: string,
  objectId: string,
  options: RestorationMailOptions,
  context: TransformationRunContext,
  attemptStartedAt: number,
  attemptOutputCeiling: number
): Effect.fn.Return<number, CorpusCommandError, TransformationRequirements> {
  const files = A.filter(yield* walkFiles(attemptRoot), (file) => Str.includes("Attachment")(file.relativePath));
  const repaired = yield* Effect.forEach(
    files,
    (file) =>
      repairAttachment(
        file,
        attemptRoot,
        attemptId,
        objectId,
        options,
        context,
        attemptStartedAt,
        attemptOutputCeiling
      ),
    { concurrency: 1 }
  );
  return A.reduce(repaired, 0, (total, count) => total + count);
});

const combineMailAttemptOutputDigests = (
  partial: TransformationTreeDigest,
  final: TransformationTreeDigest
): TransformationTreeDigest => ({
  sha256: digestString(
    `partial\u0000${partial.sha256}\u0000${partial.sizeBytes}\nfinal\u0000${final.sha256}\u0000${final.sizeBytes}\n`
  ),
  sizeBytes: partial.sizeBytes + final.sizeBytes,
});

const emptyMailAttemptOutputDigest = (): TransformationTreeDigest => {
  const empty: TransformationTreeDigest = { sha256: digestString(""), sizeBytes: 0 };
  return combineMailAttemptOutputDigests(empty, empty);
};

const retainedMailAttemptDigest = Effect.fn("CorpusRestoration.retainedMailAttemptDigest")(function* (
  partialRoot: string,
  finalRoot: string
): Effect.fn.Return<TransformationTreeDigest, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const partial = yield* hashTransformationTree(partialRoot);
  const final = yield* hashTransformationTree(finalRoot);
  return combineMailAttemptOutputDigests(partial, final);
});

type PstExceptionKind = "codepage" | "corrupt" | "engine-failure" | "password";

const appendPstException = Effect.fn("CorpusRestoration.appendPstException")(function* (
  context: TransformationRunContext,
  candidate: MailCandidate,
  attemptId: string,
  exceptionKind: PstExceptionKind,
  message: string,
  retainedOutput: TransformationTreeDigest
): Effect.fn.Return<boolean, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const dispositionApproved = O.contains(context.mailScope, "full") && exceptionKind !== "engine-failure";
  yield* appendTransformationRecord(
    context.ledgerPath,
    TransformationLedgerRecord.cases["mail-store-exception"].make({
      ...(yield* transformationIdentity(context)),
      approved: dispositionApproved,
      attemptId,
      ...(dispositionApproved ? quarantineDisposition() : {}),
      exceptionKind,
      family: "mail",
      mailScope: yield* requireMailScope(context),
      message,
      objectId: candidate.objectId,
      recordType: "mail-store-exception",
      retainedOutputBytes: nonNegative(retainedOutput.sizeBytes),
      retainedOutputSha256: retainedOutput.sha256,
      sourceFamily: "pst",
    })
  );
  return dispositionApproved;
});

const pstSourceUnchanged = Effect.fn("CorpusRestoration.pstSourceUnchanged")(function* (
  sourcePath: string,
  before: TransformationTreeDigest
): Effect.fn.Return<boolean, CorpusCommandError, FileSystem.FileSystem> {
  const after = yield* hashRestorationFileStreaming(sourcePath, 1024 * 1024);
  return after.sha256 === before.sha256 && after.sizeBytes === before.sizeBytes;
});

const appendPstWarnings = Effect.fn("CorpusRestoration.appendPstWarnings")(function* (
  context: TransformationRunContext,
  candidate: MailCandidate,
  attemptId: string,
  warnings: ReadonlyArray<string>
) {
  for (const warning of warnings) {
    yield* appendTransformationRecord(
      context.ledgerPath,
      TransformationLedgerRecord.cases["mail-warning"].make({
        ...(yield* transformationIdentity(context)),
        attemptId,
        family: "mail",
        mailScope: yield* requireMailScope(context),
        message: warning,
        objectId: candidate.objectId,
        recordType: "mail-warning",
      })
    );
  }
});

const pstEngineChildMatches = Effect.fn("CorpusRestoration.pstEngineChildMatches")(function* (
  result: ArchiveExportResult,
  file: WalkedTransformationFile
): Effect.fn.Return<boolean, CorpusCommandError, FileSystem.FileSystem> {
  const reference = A.findFirst(result.children, (child) => child.relativePath === file.relativePath);
  if (O.isNone(reference)) return false;
  const child = yield* hashRestorationFileStreaming(file.absolutePath, 1024 * 1024);
  const expectedDigest = O.map(O.fromUndefinedOr(reference.value.digest), Str.replace(/^sha256:/u, ""));
  return (
    !O.exists(expectedDigest, (digest) => digest !== child.sha256) &&
    (reference.value.sizeBytes === undefined || reference.value.sizeBytes === child.sizeBytes)
  );
});

const pstEngineChildrenReconcile = Effect.fn("CorpusRestoration.pstEngineChildrenReconcile")(function* (
  result: ArchiveExportResult,
  engineFiles: ReadonlyArray<WalkedTransformationFile>
): Effect.fn.Return<boolean, CorpusCommandError, FileSystem.FileSystem> {
  const enginePaths = MutableHashSet.fromIterable(A.map(result.children, (child) => child.relativePath));
  if (
    result.children.length <= 0 ||
    result.children.length !== engineFiles.length ||
    MutableHashSet.size(enginePaths) !== result.children.length
  ) {
    return false;
  }
  const matches = yield* Effect.forEach(engineFiles, (file) => pstEngineChildMatches(result, file), { concurrency: 1 });
  return A.every(matches, (matches) => matches);
});

const pstFailureTerminal = Effect.fn("CorpusRestoration.pstFailureTerminal")(function* (
  context: TransformationRunContext,
  candidate: MailCandidate,
  attemptId: string,
  pass: PreservedFilePass,
  partialRoot: string,
  finalRoot: string,
  error: unknown
): Effect.fn.Return<LegacyWordTerminal, CorpusCommandError, TransformationRequirements> {
  const retainedOutput = yield* retainedMailAttemptDigest(partialRoot, finalRoot);
  const approved = yield* appendPstException(
    context,
    candidate,
    attemptId,
    classifyMailError(error),
    "Mail engine failed; raw attempt output was retained.",
    retainedOutput
  );
  return {
    inputBytes: pass.sizeBytes,
    outputBytes: retainedOutput.sizeBytes,
    passed: false,
    unapproved: !approved,
  };
});

type PstAttempt = {
  readonly attemptId: string;
  readonly attemptOutputCeiling: number;
  readonly candidate: MailCandidate;
  readonly context: TransformationRunContext;
  readonly finalRoot: string;
  readonly options: RestorationMailOptions;
  readonly partialRoot: string;
  readonly pass: PreservedFilePass;
  readonly sourceBefore: TransformationTreeDigest;
  readonly startedAt: number;
};

type ValidatedPstExport = {
  readonly engineFiles: ReadonlyArray<WalkedTransformationFile>;
  readonly enginePaths: MutableHashSet.MutableHashSet<string>;
  readonly result: ArchiveExportResult;
};

const exportPstArchive = Effect.fn("CorpusRestoration.exportPstArchive")(function* (
  attempt: PstAttempt,
  remainingElapsedMillis: number
): Effect.fn.Return<
  ArchiveExportResult,
  CorpusCommandError | FileProcessingOperationError,
  TransformationRequirements
> {
  const artifactId = yield* S.decodeEffect(ArtifactId)(`artifact:${attempt.pass.sha256}`).pipe(
    CorpusCommandError.mapError("Failed binding the PST source artifact identity.")
  );
  const digest = yield* S.decodeEffect(ContentDigest)(`sha256:${attempt.pass.sha256}`).pipe(
    CorpusCommandError.mapError("Failed binding the PST source digest.")
  );
  const operationId = yield* S.decodeEffect(OperationId)(`operation:${attempt.pass.sha256}`).pipe(
    CorpusCommandError.mapError("Failed binding the PST operation identity.")
  );
  const locatorValue = yield* S.decodeEffect(PosixPath)(attempt.candidate.sourcePath).pipe(
    CorpusCommandError.mapError("Failed binding the PST source path.")
  );
  const relativePath = yield* S.decodeEffect(PosixPath)("mail-store.pst").pipe(
    CorpusCommandError.mapError("Failed binding the PST logical relative path.")
  );
  const source = SourceArtifact.make({
    digest,
    extension: "pst",
    id: artifactId,
    locator: ArtifactLocator.make({ kind: "file", value: locatorValue }),
    name: "mail-store.pst",
    relativePath,
    sizeBytes: attempt.pass.sizeBytes,
  });
  const engine = yield* makePffexportFileProcessingEngine(
    PffexportEngineConfig.make({
      bwrapPath: O.some(attempt.options.bwrapPath),
      existingExportPolicy: "fail",
      exportFormat: "all",
      exportMode: "all",
      exportRoot: attempt.partialRoot,
      maxOutputBytes: O.some(PosInt.make(Math.max(1, Math.floor(attempt.attemptOutputCeiling)))),
      pffexportPath: attempt.options.pffexportPath,
      systemdRunPath: attempt.options.systemdRunPath,
      timeoutMillis: O.some(PosInt.make(Math.min(attempt.options.maxElapsedMillis, remainingElapsedMillis))),
    })
  );
  return yield* engine.exportArchive(
    ExportArchiveOperation.make({
      format: "pst",
      maxMaterializedBytes: attempt.attemptOutputCeiling,
      operationId,
      operationKind: "export-archive",
      preference: { engine: "libpff" },
      source,
    })
  );
});

const failPstAttempt = Effect.fn("CorpusRestoration.failPstAttempt")(function* (
  attempt: PstAttempt,
  message: string
): Effect.fn.Return<LegacyWordTerminal, CorpusCommandError, TransformationRequirements> {
  const retainedOutput = yield* retainedMailAttemptDigest(attempt.partialRoot, attempt.finalRoot);
  yield* appendPstException(
    attempt.context,
    attempt.candidate,
    attempt.attemptId,
    "engine-failure",
    message,
    retainedOutput
  );
  return {
    inputBytes: attempt.pass.sizeBytes,
    outputBytes: retainedOutput.sizeBytes,
    passed: false,
    unapproved: true,
  };
});

const validatePstExport = Effect.fn("CorpusRestoration.validatePstExport")(function* (
  attempt: PstAttempt,
  result: ArchiveExportResult
): Effect.fn.Return<O.Option<ValidatedPstExport>, CorpusCommandError, TransformationRequirements> {
  yield* appendPstWarnings(attempt.context, attempt.candidate, attempt.attemptId, result.warnings);
  const engineFiles = yield* walkFiles(attempt.partialRoot);
  const childrenReconcile = yield* pstEngineChildrenReconcile(result, engineFiles);
  const sourceUnchanged = yield* pstSourceUnchanged(attempt.candidate.sourcePath, attempt.sourceBefore);
  if (!sourceUnchanged || result.warnings.length > 0 || !childrenReconcile) return O.none();
  return O.some({
    engineFiles,
    enginePaths: MutableHashSet.fromIterable(A.map(result.children, (child) => child.relativePath)),
    result,
  });
});

const appendPstChildren = Effect.fn("CorpusRestoration.appendPstChildren")(function* (
  attempt: PstAttempt,
  files: ReadonlyArray<WalkedTransformationFile>,
  enginePaths: MutableHashSet.MutableHashSet<string>
) {
  const path = yield* Path.Path;
  for (const file of files) {
    const child = yield* hashRestorationFileStreaming(path.join(attempt.finalRoot, file.relativePath), 1024 * 1024);
    yield* appendTransformationRecord(
      attempt.context.ledgerPath,
      TransformationLedgerRecord.cases["mail-child-pass"].make({
        ...(yield* transformationIdentity(attempt.context)),
        attemptId: attempt.attemptId,
        childRelativePath: file.relativePath,
        engineReported: MutableHashSet.has(enginePaths, file.relativePath),
        family: "mail",
        mailScope: yield* requireMailScope(attempt.context),
        recordType: "mail-child-pass",
        sha256: child.sha256,
        sizeBytes: nonNegative(child.sizeBytes),
        sourceObjectId: attempt.candidate.objectId,
      })
    );
  }
});

const appendPstPass = Effect.fn("CorpusRestoration.appendPstPass")(function* (
  attempt: PstAttempt,
  validated: ValidatedPstExport,
  fileCount: number,
  outputBytes: number,
  elapsedMillis: number,
  postProcessSha256: Sha256Hex
) {
  yield* appendTransformationRecord(
    attempt.context.ledgerPath,
    TransformationLedgerRecord.cases["mail-store-pass"].make({
      ...(yield* transformationIdentity(attempt.context)),
      accountedChildCount: nonNegative(fileCount),
      attemptId: attempt.attemptId,
      childCount: nonNegative(validated.result.children.length),
      elapsedMillis: nonNegative(elapsedMillis),
      family: "mail",
      inputBytes: attempt.pass.sizeBytes,
      mailScope: yield* requireMailScope(attempt.context),
      objectId: attempt.candidate.objectId,
      outputBytes: nonNegative(outputBytes),
      postProcessSha256,
      recordType: "mail-store-pass",
      sha256: attempt.pass.sha256,
      warningCount: nonNegative(validated.result.warnings.length),
    })
  );
});

const finishPstAttempt = Effect.fn("CorpusRestoration.finishPstAttempt")(function* (
  attempt: PstAttempt,
  validated: ValidatedPstExport,
  remainingOutputBytes: number
): Effect.fn.Return<LegacyWordTerminal, CorpusCommandError, TransformationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* repairAttachments(
    attempt.partialRoot,
    attempt.attemptId,
    attempt.candidate.objectId,
    attempt.options,
    attempt.context,
    attempt.startedAt,
    attempt.attemptOutputCeiling
  );
  const files = yield* walkFiles(attempt.partialRoot);
  const outputBytes = (yield* hashTransformationTree(attempt.partialRoot)).sizeBytes;
  const elapsedMillis = DateTime.toEpochMillis(yield* DateTime.now) - attempt.startedAt;
  const withinCeiling =
    elapsedMillis <= attempt.options.maxElapsedMillis &&
    outputBytes <= attempt.pass.sizeBytes * attempt.options.maxAmplificationRatio &&
    outputBytes <= remainingOutputBytes;
  if (!withinCeiling) {
    return yield* failPstAttempt(
      attempt,
      "Mail attempt exceeded its approved elapsed-time or disk-amplification ceiling."
    );
  }
  yield* syncTree(attempt.partialRoot);
  yield* fs
    .makeDirectory(path.dirname(attempt.finalRoot), { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating mail-attempt promotion directory."));
  yield* fs
    .rename(attempt.partialRoot, attempt.finalRoot)
    .pipe(CorpusCommandError.mapError("Failed atomically promoting mail restoration attempt."));
  yield* syncRestorationDirectory(path.dirname(attempt.finalRoot));
  yield* appendPstChildren(attempt, files, validated.enginePaths);
  const sourceAfter = yield* hashRestorationFileStreaming(attempt.candidate.sourcePath, 1024 * 1024);
  if (sourceAfter.sha256 !== attempt.sourceBefore.sha256 || sourceAfter.sizeBytes !== attempt.sourceBefore.sizeBytes) {
    return yield* failPstAttempt(attempt, "Mail source bytes changed before terminal PASS publication.");
  }
  yield* appendPstPass(attempt, validated, files.length, outputBytes, elapsedMillis, sourceAfter.sha256);
  return { inputBytes: attempt.pass.sizeBytes, outputBytes, passed: true, unapproved: false };
});

const processPstCandidate = Effect.fn("CorpusRestoration.processPstCandidate")(function* (
  candidate: MailCandidate,
  options: RestorationMailOptions,
  context: TransformationRunContext,
  remainingOutputBytes: number,
  remainingElapsedMillis: number,
  attemptId: string
): Effect.fn.Return<
  { readonly inputBytes: number; readonly outputBytes: number; readonly passed: boolean; readonly unapproved: boolean },
  CorpusCommandError,
  TransformationRequirements
> {
  const path = yield* Path.Path;
  const pass = O.getOrElse(candidate.pass, () => undefined);
  if (pass === undefined) {
    return { inputBytes: 0, outputBytes: 0, passed: false, unapproved: true };
  }
  const sourceBefore = yield* hashRestorationFileStreaming(candidate.sourcePath, 1024 * 1024);
  if (sourceBefore.sha256 !== pass.sha256 || sourceBefore.sizeBytes !== pass.sizeBytes) {
    return yield* transformationError("Mail source bytes drifted from preservation before transformation.");
  }
  const startedAt = DateTime.toEpochMillis(yield* DateTime.now);
  const partialRoot = path.join(context.outputRoot, "attempts", `${attemptId}.partial`);
  const finalRoot = path.join(context.outputRoot, "attempts", attemptId);

  return yield* Effect.gen(function* () {
    if (remainingOutputBytes <= 0 || remainingElapsedMillis <= 0) {
      yield* appendPstException(
        context,
        candidate,
        attemptId,
        "engine-failure",
        "Mail attempt has no remaining approved cumulative output budget.",
        emptyMailAttemptOutputDigest()
      );
      return { inputBytes: pass.sizeBytes, outputBytes: 0, passed: false, unapproved: true };
    }
    const attemptOutputCeiling = Math.min(pass.sizeBytes * options.maxAmplificationRatio, remainingOutputBytes);
    const availableBytes = yield* availableRestorationBytesAt(context.corpusRoot);
    if (availableBytes < attemptOutputCeiling) {
      yield* appendPstException(
        context,
        candidate,
        attemptId,
        "engine-failure",
        "Available bytes are below the next mail attempt output ceiling.",
        emptyMailAttemptOutputDigest()
      );
      return { inputBytes: pass.sizeBytes, outputBytes: 0, passed: false, unapproved: true };
    }
    const attempt: PstAttempt = {
      attemptId,
      attemptOutputCeiling,
      candidate,
      context,
      finalRoot,
      options,
      partialRoot,
      pass,
      sourceBefore,
      startedAt,
    };
    const result = yield* exportPstArchive(attempt, remainingElapsedMillis);
    const validated = yield* validatePstExport(attempt, result);
    if (O.isNone(validated)) {
      return yield* failPstAttempt(
        attempt,
        "Mail engine warnings, source drift, or child mismatch prevented terminal PASS."
      );
    }
    return yield* finishPstAttempt(attempt, validated.value, remainingOutputBytes);
  }).pipe(
    Effect.catch((error) => pstFailureTerminal(context, candidate, attemptId, pass, partialRoot, finalRoot, error))
  );
});

const optionalMailScopeFields = (context: TransformationRunContext): { readonly mailScope?: MailRestorationScope } =>
  O.getSomesStruct({ mailScope: context.mailScope });

const currentLedgerDigest = Effect.fn("CorpusRestoration.currentLedgerDigest")(function* (
  ledgerPath: string
): Effect.fn.Return<Sha256Hex, CorpusCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(ledgerPath)
    .pipe(CorpusCommandError.mapError("Failed checking transformation evidence ledger."));
  return exists ? (yield* hashRestorationFileStreaming(ledgerPath, 1024 * 1024)).sha256 : digestString("");
});

type DecodedTransformationLedger = {
  readonly lines: ReadonlyArray<string>;
  readonly records: ReadonlyArray<TransformationLedgerRecord>;
};

const decodeTransformationLedger = Effect.fn("CorpusRestoration.decodeTransformationLedger")(function* (
  context: TransformationRunContext,
  allowMissing: boolean
): Effect.fn.Return<DecodedTransformationLedger, CorpusCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(context.ledgerPath)
    .pipe(CorpusCommandError.mapError(`Failed checking the ${context.family} transformation ledger.`));
  if (!exists && allowMissing) return { lines: [], records: [] };
  if (!exists) return yield* transformationError(`${context.family} transformation ledger is missing.`);
  const text = yield* fs
    .readFileString(context.ledgerPath)
    .pipe(CorpusCommandError.mapError(`Failed reading the ${context.family} transformation ledger.`));
  if (!Str.endsWith("\n")(text)) {
    return yield* transformationError(`${context.family} transformation ledger is not durably newline-terminated.`);
  }
  const lines = A.dropRight(Str.split(/\r?\n/u)(text), 1);
  if (A.some(lines, Str.isEmpty)) {
    return yield* transformationError(`${context.family} transformation ledger has a blank evidence row.`);
  }
  const records = yield* Effect.forEach(lines, (line) =>
    decodeTransformationLedgerRecordJson(line).pipe(
      CorpusCommandError.mapError(`${context.family} transformation ledger failed decoding.`)
    )
  );
  if (!A.every(records, (record) => recordIdentityMatches(record, context))) {
    return yield* transformationError(`${context.family} transformation ledger identity or scope does not match.`);
  }
  return { lines, records };
});

type FamilyRunStart = Extract<TransformationLedgerRecord, { readonly recordType: "family-run-start" }>;
type FamilyRunSummary = Extract<TransformationLedgerRecord, { readonly recordType: "family-run-summary" }>;

const familyRunStartMatches = (
  start: FamilyRunStart,
  context: TransformationRunContext,
  expectedCount: number,
  maxTotalElapsedMillis: PosInt,
  maxTotalOutputBytes: PosInt,
  policySha256: Sha256Hex
): boolean =>
  start.family === context.family &&
  start.expectedCount === expectedCount &&
  start.maxTotalElapsedMillis === maxTotalElapsedMillis &&
  start.maxTotalOutputBytes === maxTotalOutputBytes &&
  start.policySha256 === policySha256 &&
  ("mailScope" in start ? start.mailScope : undefined) === O.getOrUndefined(context.mailScope);

const contextFromFamilyStart = (
  context: TransformationRunContext,
  start: FamilyRunStart
): Effect.Effect<TransformationRunContext, CorpusCommandError> =>
  O.match(DateTime.make(start.recordedAt), {
    onNone: () => Effect.fail(transformationError("Family run start has an invalid persisted timestamp.")),
    onSome: (recordedAt) => Effect.succeed({ ...context, startedAt: DateTime.toEpochMillis(recordedAt) }),
  });

const familySummaryStateIsResumable = (records: ReadonlyArray<TransformationLedgerRecord>): boolean => {
  const summaries = A.filter(records, isRecordType("family-run-summary"));
  return A.every(
    [
      summaries.length <= 1,
      O.match(A.head(summaries), {
        onNone: () => true,
        onSome: (summary) => O.exists(A.last(records), Equal.equals(summary)),
      }),
    ],
    (check) => check
  );
};

const familyStartStateIsResumable = (records: ReadonlyArray<TransformationLedgerRecord>): boolean => {
  const starts = A.filter(records, isRecordType("family-run-start"));
  return A.every(
    [
      starts.length <= 1,
      O.match(A.head(starts), {
        onNone: () => records.length === 0,
        onSome: (start) => O.exists(A.head(records), Equal.equals(start)),
      }),
    ],
    (check) => check
  );
};

const resumableFamilyStart = (
  context: TransformationRunContext,
  records: ReadonlyArray<TransformationLedgerRecord>
): Effect.Effect<O.Option<FamilyRunStart>, CorpusCommandError> =>
  Effect.succeed(records).pipe(
    Effect.filterOrFail(
      (ledger) => A.every(ledger, (record) => !Str.startsWith("family-acceptance-")(record.recordType)),
      () => transformationError(`${context.family} transformation run is already terminal and immutable.`)
    ),
    Effect.filterOrFail(familySummaryStateIsResumable, () =>
      transformationError(`${context.family} transformation run has an invalid pending summary state.`)
    ),
    Effect.filterOrFail(familyStartStateIsResumable, () =>
      transformationError("Transformation ledger must contain exactly one leading family run start.")
    ),
    Effect.map((ledger) => A.head(A.filter(ledger, isRecordType("family-run-start"))))
  );

const beginOrResumeFamilyRun = Effect.fn("CorpusRestoration.beginOrResumeFamilyRun")(function* (
  context: TransformationRunContext,
  expectedCount: number,
  maxTotalElapsedMillis: PosInt,
  maxTotalOutputBytes: PosInt,
  policySha256: Sha256Hex
): Effect.fn.Return<TransformationRunContext, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  yield* repairRestorationJsonlTail(context.ledgerPath);
  const decoded = yield* decodeTransformationLedger(context, true);
  const existing = yield* resumableFamilyStart(context, decoded.records);
  if (O.isSome(existing)) {
    if (
      !familyRunStartMatches(
        existing.value,
        context,
        expectedCount,
        maxTotalElapsedMillis,
        maxTotalOutputBytes,
        policySha256
      )
    ) {
      return yield* transformationError("Persisted family run contract differs from the requested restart contract.");
    }
    return yield* contextFromFamilyStart(context, existing.value);
  }
  const identity = yield* transformationIdentity(context);
  const start = TransformationLedgerRecord.cases["family-run-start"].make({
    ...identity,
    ...optionalMailScopeFields(context),
    expectedCount: nonNegative(expectedCount),
    family: context.family,
    maxTotalElapsedMillis,
    maxTotalOutputBytes,
    policySha256,
    recordType: "family-run-start",
  });
  yield* appendTransformationRecord(context.ledgerPath, start);
  return yield* contextFromFamilyStart(context, start);
});

type FamilyAttemptStart = Extract<TransformationLedgerRecord, { readonly recordType: "family-attempt-start" }>;
type FamilyAttemptInterrupted = Extract<
  TransformationLedgerRecord,
  { readonly recordType: "family-attempt-interrupted" }
>;

const familyAttemptId = (family: TransformationFamily, sourceId: string, retryOrdinal: number): string =>
  `${family}:${Str.takeLeft(24)(digestString(sourceId))}:r${retryOrdinal}`;

const terminalAttemptIds = (
  records: ReadonlyArray<TransformationLedgerRecord>
): MutableHashSet.MutableHashSet<string> =>
  MutableHashSet.fromIterable(
    A.map(
      A.filter(
        records,
        (
          record
        ): record is MailStorePass | MailStoreException | RecycleMapping | LegacyWordPass | LegacyWordException =>
          record.recordType === "mail-store-pass" ||
          record.recordType === "mail-store-exception" ||
          record.recordType === "recycle-mapping" ||
          record.recordType === "legacy-word-pass" ||
          record.recordType === "legacy-word-exception"
      ),
      (record) => record.attemptId
    )
  );

const unsettledAttemptStarts = (
  records: ReadonlyArray<TransformationLedgerRecord>
): ReadonlyArray<FamilyAttemptStart> => {
  const settled = terminalAttemptIds(records);
  for (const interrupted of A.filter(records, isRecordType("family-attempt-interrupted"))) {
    MutableHashSet.add(settled, interrupted.attemptId);
  }
  return A.filter(
    A.filter(records, isRecordType("family-attempt-start")),
    (start) => !MutableHashSet.has(settled, start.attemptId)
  );
};

const appendFamilyAttemptStart = Effect.fn("CorpusRestoration.appendFamilyAttemptStart")(function* (
  context: TransformationRunContext,
  sourceId: string,
  sourceSha256: Sha256Hex,
  inputBytes: number
): Effect.fn.Return<FamilyAttemptStart, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const records = yield* resumableTransformationRecords(context);
  const sourceStarts = A.filter(
    A.filter(records, isRecordType("family-attempt-start")),
    (start) => start.sourceId === sourceId
  );
  if (A.some(unsettledAttemptStarts(records), (start) => start.sourceId === sourceId)) {
    return yield* transformationError("A prior transformation attempt must be retained before the source can retry.");
  }
  const retryOrdinal = sourceStarts.length;
  const start = TransformationLedgerRecord.cases["family-attempt-start"].make({
    ...(yield* transformationIdentity(context)),
    ...optionalMailScopeFields(context),
    attemptId: familyAttemptId(context.family, sourceId, retryOrdinal),
    family: context.family,
    inputBytes: nonNegative(inputBytes),
    recordType: "family-attempt-start",
    retryOrdinal: nonNegative(retryOrdinal),
    sourceId,
    sourceSha256,
  });
  yield* appendTransformationRecord(context.ledgerPath, start);
  return start;
});

const appendInterruptedAttempt = Effect.fn("CorpusRestoration.appendInterruptedAttempt")(function* (
  context: TransformationRunContext,
  start: FamilyAttemptStart,
  retainedOutputRelativePath: string,
  digest: TransformationTreeDigest
) {
  yield* appendTransformationRecord(
    context.ledgerPath,
    TransformationLedgerRecord.cases["family-attempt-interrupted"].make({
      ...(yield* transformationIdentity(context)),
      ...optionalMailScopeFields(context),
      attemptId: start.attemptId,
      disposition: "retained-for-retry",
      family: context.family,
      recordType: "family-attempt-interrupted",
      retainedOutputBytes: nonNegative(digest.sizeBytes),
      retainedOutputRelativePath,
      retainedOutputSha256: digest.sha256,
      retryOrdinal: start.retryOrdinal,
      sourceId: start.sourceId,
    })
  );
});

type InterruptedRootCandidate = {
  readonly label: string;
  readonly relativePath: string;
};

const retainInterruptedAttempt = Effect.fn("CorpusRestoration.retainInterruptedAttempt")(function* (
  context: TransformationRunContext,
  start: FamilyAttemptStart,
  roots: ReadonlyArray<InterruptedRootCandidate>
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const retainedOutputRelativePath = path.join("interrupted", start.attemptId);
  const retainedRoot = path.join(context.outputRoot, retainedOutputRelativePath);
  yield* fs
    .makeDirectory(retainedRoot, { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating immutable interrupted-attempt output root."));
  yield* requireCanonicalContainedPath(context.outputRoot, retainedRoot);
  for (const candidate of roots) {
    const source = path.join(context.outputRoot, candidate.relativePath);
    const sourceExists = yield* fs
      .exists(source)
      .pipe(CorpusCommandError.mapError("Failed checking interrupted transformation output."));
    if (!sourceExists) continue;
    yield* requireCanonicalContainedPath(context.outputRoot, source);
    const destination = path.join(retainedRoot, candidate.label);
    if (
      yield* fs
        .exists(destination)
        .pipe(CorpusCommandError.mapError("Failed checking retained interrupted-attempt destination."))
    ) {
      return yield* transformationError("Interrupted-attempt retention destination already exists.");
    }
    yield* fs
      .rename(source, destination)
      .pipe(CorpusCommandError.mapError("Failed atomically retaining interrupted transformation output."));
  }
  yield* syncTree(retainedRoot);
  const digest = yield* hashTransformationTree(retainedRoot);
  yield* appendInterruptedAttempt(context, start, retainedOutputRelativePath, digest);
});

const recoverInterruptedAttempts = Effect.fn("CorpusRestoration.recoverInterruptedAttempts")(function* (
  context: TransformationRunContext,
  rootsFor: (start: FamilyAttemptStart) => ReadonlyArray<InterruptedRootCandidate>
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const records = yield* resumableTransformationRecords(context);
  for (const start of unsettledAttemptStarts(records)) {
    yield* retainInterruptedAttempt(context, start, rootsFor(start));
  }
});

const resumableTransformationRecords = Effect.fn("CorpusRestoration.resumableTransformationRecords")(function* (
  context: TransformationRunContext
): Effect.fn.Return<ReadonlyArray<TransformationLedgerRecord>, CorpusCommandError, FileSystem.FileSystem> {
  const decoded = yield* decodeTransformationLedger(context, true);
  if (A.some(decoded.records, (record) => Str.startsWith("family-acceptance-")(record.recordType))) {
    return yield* transformationError(`${context.family} transformation run is already terminal and immutable.`);
  }
  const summaries = A.filter(decoded.records, isRecordType("family-run-summary"));
  if (summaries.length === 0) return decoded.records;
  if (summaries.length === 1 && decoded.records[decoded.records.length - 1] === summaries[0]) {
    return A.dropRight(decoded.records, 1);
  }
  return yield* transformationError(`${context.family} transformation run has an invalid pending summary state.`);
});

const familyHasPendingSummary = Effect.fn("CorpusRestoration.familyHasPendingSummary")(function* (
  context: TransformationRunContext
): Effect.fn.Return<boolean, CorpusCommandError, FileSystem.FileSystem> {
  const decoded = yield* decodeTransformationLedger(context, false);
  return O.exists(A.last(decoded.records), isRecordType("family-run-summary"));
});

const denyFamilyPreflight = Effect.fn("CorpusRestoration.denyFamilyPreflight")(function* (
  context: TransformationRunContext,
  expectedCount: number,
  maxTotalElapsedMillis: PosInt,
  maxTotalOutputBytes: PosInt,
  message: string,
  errorMessage: string
): Effect.fn.Return<never, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const outputTree = yield* hashTransformationTree(context.outputRoot);
  yield* appendTransformationRecord(
    context.ledgerPath,
    TransformationLedgerRecord.cases["family-acceptance-failure"].make({
      ...(yield* transformationIdentity(context)),
      ...optionalMailScopeFields(context),
      evidenceSha256: yield* currentLedgerDigest(context.ledgerPath),
      expectedCount: nonNegative(expectedCount),
      family: context.family,
      maxTotalElapsedMillis,
      maxTotalOutputBytes,
      message,
      outputTreeSha256: outputTree.sha256,
      recordType: "family-acceptance-failure",
      terminalCount: nonNegative(0),
      unapprovedCount: nonNegative(1),
    })
  );
  return yield* transformationError(errorMessage);
});

const rejectFamilyPreflight = Effect.fn("CorpusRestoration.rejectFamilyPreflight")(function* (
  pendingSummary: boolean,
  context: TransformationRunContext,
  expectedCount: number,
  maxTotalElapsedMillis: PosInt,
  maxTotalOutputBytes: PosInt,
  message: string,
  errorMessage: string
): Effect.fn.Return<never, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  return yield* pendingSummary
    ? transformationError(`${errorMessage} Pending summary evidence remains immutable.`)
    : denyFamilyPreflight(context, expectedCount, maxTotalElapsedMillis, maxTotalOutputBytes, message, errorMessage);
});

const requireFamilyCapacity = Effect.fn("CorpusRestoration.requireFamilyCapacity")(function* (
  context: TransformationRunContext,
  expectedCount: number,
  maxTotalElapsedMillis: PosInt,
  maxTotalOutputBytes: PosInt
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const availableBytes = yield* availableRestorationBytesAt(context.corpusRoot);
  if (availableBytes < maxTotalOutputBytes) {
    return yield* denyFamilyPreflight(
      context,
      expectedCount,
      maxTotalElapsedMillis,
      maxTotalOutputBytes,
      "Available destination bytes are below the approved cumulative output ceiling.",
      `${context.family} restoration capacity preflight denied payload writes.`
    );
  }
});

const familyElapsedMillis = Effect.fn("CorpusRestoration.familyElapsedMillis")(function* (startedAt: number) {
  const elapsed = DateTime.toEpochMillis(yield* DateTime.now) - startedAt;
  if (elapsed < 0) {
    return yield* transformationError("The wall clock moved behind the durable family-run start timestamp.");
  }
  return elapsed;
});

const familyBudgetAvailable = Effect.fn("CorpusRestoration.familyBudgetAvailable")(function* (
  startedAt: number,
  outputBytes: number,
  maxTotalElapsedMillis: number,
  maxTotalOutputBytes: number
) {
  return (yield* familyElapsedMillis(startedAt)) < maxTotalElapsedMillis && outputBytes < maxTotalOutputBytes;
});

const transformationLinesSha256 = (lines: ReadonlyArray<string>): Sha256Hex => {
  const joined = A.join(lines, "\n");
  return digestString(Str.isEmpty(joined) ? "" : `${joined}\n`);
};

type PendingFamilyCompletionInput = {
  readonly context: TransformationRunContext;
  readonly contractMatches: boolean;
  readonly counters: FamilyCounters;
  readonly decoded: DecodedTransformationLedger;
  readonly expectedTerminalCount: number;
  readonly maxTotalElapsedMillis: PosInt;
  readonly maxTotalOutputBytes: PosInt;
  readonly outputTree: TransformationTreeDigest;
  readonly sourceCount: number;
  readonly terminalCount: number;
};

const pendingFamilySummaryReconciles = (input: PendingFamilyCompletionInput, summary: FamilyRunSummary): boolean =>
  A.every(
    [
      input.contractMatches,
      input.terminalCount === input.expectedTerminalCount,
      summary.exceptionCount === input.counters.exceptionCount,
      summary.family === input.context.family,
      summary.inputBytes === input.counters.inputBytes,
      summary.maxTotalElapsedMillis === input.maxTotalElapsedMillis,
      summary.maxTotalOutputBytes === input.maxTotalOutputBytes,
      summary.outputBytes === input.counters.outputBytes,
      summary.outputTreeSha256 === input.outputTree.sha256,
      summary.passCount === input.counters.passCount,
      summary.sourceCount === input.sourceCount,
      summary.unapprovedCount === 0,
      input.counters.outputBytes === input.outputTree.sizeBytes,
      transformationSegmentReconciles(input.context.family, summary, A.dropRight(input.decoded.records, 1)),
    ],
    (check) => check
  );

const restorationSummaryFromFamilySummary = (summary: FamilyRunSummary): RestorationRunSummary =>
  RestorationRunSummary.make({
    elapsedMillis: summary.elapsedMillis,
    exceptionCount: summary.exceptionCount,
    family: summary.family,
    inputBytes: summary.inputBytes,
    outputBytes: summary.outputBytes,
    passCount: summary.passCount,
    sourceCount: summary.sourceCount,
    unapprovedCount: summary.unapprovedCount,
  });

const completePendingFamilySummary = Effect.fn("CorpusRestoration.completePendingFamilySummary")(function* (
  input: PendingFamilyCompletionInput
): Effect.fn.Return<O.Option<RestorationRunSummary>, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const pendingSummary = A.last(input.decoded.records).pipe(O.filter(isRecordType("family-run-summary")));
  if (O.isNone(pendingSummary)) return O.none();
  if (!pendingFamilySummaryReconciles(input, pendingSummary.value)) {
    return yield* transformationError(
      `${input.context.family} pending summary does not match its terminal evidence or retained output.`
    );
  }
  yield* appendTransformationRecord(
    input.context.ledgerPath,
    TransformationLedgerRecord.cases["family-acceptance-pass"].make({
      ...(yield* transformationIdentity(input.context)),
      ...optionalMailScopeFields(input.context),
      evidenceSha256: transformationLinesSha256(A.dropRight(input.decoded.lines, 1)),
      expectedCount: nonNegative(input.expectedTerminalCount),
      family: input.context.family,
      maxTotalElapsedMillis: input.maxTotalElapsedMillis,
      maxTotalOutputBytes: input.maxTotalOutputBytes,
      outputTreeSha256: input.outputTree.sha256,
      recordType: "family-acceptance-pass",
      terminalCount: nonNegative(input.terminalCount),
      unapprovedCount: 0,
    })
  );
  return O.some(restorationSummaryFromFamilySummary(pendingSummary.value));
});

const finalizeFamilyRun = Effect.fn("CorpusRestoration.finalizeFamilyRun")(function* (
  context: TransformationRunContext,
  startedAt: number,
  sourceCount: number,
  counters: FamilyCounters,
  expectedTerminalCount: number,
  contractMatches: boolean,
  maxTotalElapsedMillis: PosInt,
  maxTotalOutputBytes: PosInt,
  failureMessage: string,
  errorMessage: string
): Effect.fn.Return<RestorationRunSummary, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const terminalCount = counters.passCount + counters.exceptionCount;
  const outputTree = yield* hashTransformationTree(context.outputRoot);
  const decoded = yield* decodeTransformationLedger(context, false);
  const completedPending = yield* completePendingFamilySummary({
    context,
    contractMatches,
    counters,
    decoded,
    expectedTerminalCount,
    maxTotalElapsedMillis,
    maxTotalOutputBytes,
    outputTree,
    sourceCount,
    terminalCount,
  });
  if (O.isSome(completedPending)) return completedPending.value;
  const evidenceSha256 = yield* currentLedgerDigest(context.ledgerPath);
  const accepted =
    contractMatches &&
    terminalCount === expectedTerminalCount &&
    counters.unapprovedCount === 0 &&
    counters.outputBytes === outputTree.sizeBytes;
  const summary = RestorationRunSummary.make({
    elapsedMillis: nonNegative(yield* familyElapsedMillis(startedAt)),
    exceptionCount: nonNegative(counters.exceptionCount),
    family: context.family,
    inputBytes: nonNegative(counters.inputBytes),
    outputBytes: nonNegative(counters.outputBytes),
    passCount: nonNegative(counters.passCount),
    sourceCount: nonNegative(sourceCount),
    unapprovedCount: nonNegative(counters.unapprovedCount),
  });
  yield* appendTransformationRecord(
    context.ledgerPath,
    TransformationLedgerRecord.cases["family-run-summary"].make({
      ...(yield* transformationIdentity(context)),
      ...optionalMailScopeFields(context),
      ...summary,
      family: context.family,
      maxTotalElapsedMillis,
      maxTotalOutputBytes,
      outputTreeSha256: outputTree.sha256,
      recordType: "family-run-summary",
    })
  );
  const acceptance = accepted
    ? TransformationLedgerRecord.cases["family-acceptance-pass"].make({
        ...(yield* transformationIdentity(context)),
        ...optionalMailScopeFields(context),
        evidenceSha256,
        expectedCount: nonNegative(expectedTerminalCount),
        family: context.family,
        maxTotalElapsedMillis,
        maxTotalOutputBytes,
        outputTreeSha256: outputTree.sha256,
        recordType: "family-acceptance-pass",
        terminalCount: nonNegative(terminalCount),
        unapprovedCount: 0,
      })
    : TransformationLedgerRecord.cases["family-acceptance-failure"].make({
        ...(yield* transformationIdentity(context)),
        ...optionalMailScopeFields(context),
        evidenceSha256,
        expectedCount: nonNegative(expectedTerminalCount),
        family: context.family,
        maxTotalElapsedMillis,
        maxTotalOutputBytes,
        message: failureMessage,
        outputTreeSha256: outputTree.sha256,
        recordType: "family-acceptance-failure",
        terminalCount: nonNegative(terminalCount),
        unapprovedCount: nonNegative(Math.max(1, counters.unapprovedCount)),
      });
  yield* appendTransformationRecord(context.ledgerPath, acceptance);
  if (!accepted) {
    return yield* transformationError(
      `${errorMessage} [contract=${contractMatches}; terminals=${terminalCount}/${expectedTerminalCount}; ` +
        `unapproved=${counters.unapprovedCount}; output=${counters.outputBytes}/${outputTree.sizeBytes}]`
    );
  }
  return summary;
});

const applyFamilyCeiling = Effect.fn("CorpusRestoration.applyFamilyCeiling")(function* (
  counters: FamilyCounters,
  startedAt: number,
  maxTotalElapsedMillis: number,
  maxTotalOutputBytes: number
) {
  const withinCeiling =
    (yield* familyElapsedMillis(startedAt)) <= maxTotalElapsedMillis && counters.outputBytes <= maxTotalOutputBytes;
  return withinCeiling ? counters : { ...counters, unapprovedCount: Math.max(1, counters.unapprovedCount) };
});

const runBoundedFamilyCandidates = Effect.fn("CorpusRestoration.runBoundedFamilyCandidates")(function* <Candidate>(
  candidates: ReadonlyArray<Candidate>,
  initialCounters: FamilyCounters,
  startedAt: number,
  maxTotalElapsedMillis: number,
  maxTotalOutputBytes: number,
  process: (
    candidate: Candidate,
    outputBytes: number
  ) => Effect.Effect<LegacyWordTerminal, CorpusCommandError, TransformationRequirements>
): Effect.fn.Return<FamilyCounters, CorpusCommandError, TransformationRequirements> {
  let counters = initialCounters;
  for (const candidate of candidates) {
    const terminal = yield* process(candidate, counters.outputBytes);
    counters = addFamilyTerminal(counters, terminal);
    if (terminal.unapproved) break;
  }
  return yield* applyFamilyCeiling(counters, startedAt, maxTotalElapsedMillis, maxTotalOutputBytes);
});

const processMailCandidate = Effect.fn("CorpusRestoration.processMailCandidate")(function* (
  candidate: MailCandidate,
  options: RestorationMailOptions,
  context: TransformationRunContext,
  startedAt: number,
  outputBytes: number
): Effect.fn.Return<LegacyWordTerminal, CorpusCommandError, TransformationRequirements> {
  const inputBytes = O.match(candidate.pass, { onNone: () => 0, onSome: (pass) => Math.trunc(pass.sizeBytes) });
  const sourceSha256 = O.match(candidate.pass, {
    onNone: () => digestString(candidate.objectId),
    onSome: (pass) => pass.sha256,
  });
  const attempt = yield* appendFamilyAttemptStart(context, candidate.objectId, sourceSha256, inputBytes);
  const budgetAvailable = yield* familyBudgetAvailable(
    startedAt,
    outputBytes,
    options.maxTotalElapsedMillis,
    options.maxTotalOutputBytes
  );
  if (!budgetAvailable) {
    yield* appendTransformationRecord(
      context.ledgerPath,
      TransformationLedgerRecord.cases["mail-store-exception"].make({
        ...(yield* transformationIdentity(context)),
        approved: false,
        attemptId: attempt.attemptId,
        exceptionKind: "engine-failure",
        family: "mail",
        mailScope: yield* requireMailScope(context),
        message: "The mail family exhausted its approved total elapsed-time or retained-output ceiling.",
        objectId: candidate.objectId,
        recordType: "mail-store-exception",
        retainedOutputBytes: nonNegative(0),
        retainedOutputSha256: emptyMailAttemptOutputDigest().sha256,
        sourceFamily: candidate.family,
      })
    );
    return { inputBytes, outputBytes: 0, passed: false, unapproved: true };
  }
  if (candidate.family === "pst") {
    return yield* processPstCandidate(
      candidate,
      options,
      context,
      options.maxTotalOutputBytes - outputBytes,
      options.maxTotalElapsedMillis - (yield* familyElapsedMillis(startedAt)),
      attempt.attemptId
    );
  }
  yield* appendTransformationRecord(
    context.ledgerPath,
    TransformationLedgerRecord.cases["mail-store-exception"].make({
      ...(yield* transformationIdentity(context)),
      approved: true,
      attemptId: attempt.attemptId,
      disposition: "defer",
      exceptionKind: "unsupported-family",
      family: "mail",
      mailScope: yield* requireMailScope(context),
      message: "Mail source family received an explicit defer disposition in this bounded cycle.",
      objectId: candidate.objectId,
      recordType: "mail-store-exception",
      retainedOutputBytes: nonNegative(0),
      retainedOutputSha256: emptyMailAttemptOutputDigest().sha256,
      sourceFamily: candidate.family,
    })
  );
  return { inputBytes, outputBytes: 0, passed: false, unapproved: false };
});

type FamilyResumeState<Candidate> = {
  readonly candidates: ReadonlyArray<Candidate>;
  readonly counters: FamilyCounters;
};

type MailResumeState = FamilyResumeState<MailCandidate>;

const loadFamilyResumeRecords = Effect.fn("CorpusRestoration.loadFamilyResumeRecords")(function* (
  context: TransformationRunContext,
  existingOutputBytes: number
): Effect.fn.Return<
  {
    readonly initialCounters: O.Option<FamilyCounters>;
    readonly records: ReadonlyArray<TransformationLedgerRecord>;
  },
  CorpusCommandError,
  FileSystem.FileSystem
> {
  const records = yield* resumableTransformationRecords(context);
  return {
    initialCounters:
      records.length === 0 ? O.some({ ...emptyFamilyCounters(), outputBytes: existingOutputBytes }) : O.none(),
    records,
  };
});

const resumeFamilyCandidates = Effect.fn("CorpusRestoration.resumeFamilyCandidates")(function* <Candidate, E, R>(
  context: TransformationRunContext,
  candidates: ReadonlyArray<Candidate>,
  existingOutputBytes: number,
  resumeRecords: (
    records: ReadonlyArray<TransformationLedgerRecord>
  ) => Effect.Effect<FamilyResumeState<Candidate>, E, R>
): Effect.fn.Return<FamilyResumeState<Candidate>, CorpusCommandError | E, FileSystem.FileSystem | R> {
  const loaded = yield* loadFamilyResumeRecords(context, existingOutputBytes);
  return yield* O.match(loaded.initialCounters, {
    onNone: () => resumeRecords(loaded.records),
    onSome: (counters) => Effect.succeed({ candidates, counters }),
  });
});

const mailResumeState = Effect.fn("CorpusRestoration.mailResumeState")(function* (
  context: TransformationRunContext,
  candidates: ReadonlyArray<MailCandidate>,
  existingOutputBytes: number
): Effect.fn.Return<MailResumeState, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  return yield* resumeFamilyCandidates(
    context,
    candidates,
    existingOutputBytes,
    Effect.fnUntraced(function* (records) {
      const passes = A.filter(records, isRecordType("mail-store-pass"));
      const exceptions = A.filter(records, isRecordType("mail-store-exception"));
      if (
        !resumableAttemptLifecycleReconciles(records) ||
        !mailSegmentReconciles(
          { exceptionCount: nonNegative(exceptions.length), passCount: nonNegative(passes.length) },
          records
        )
      ) {
        return yield* transformationError("Prior mail checkpoints are incomplete, duplicated, or unapproved.");
      }
      yield* rehashRetainedFamilyOutputs(context, records);
      const processedObjectIds = MutableHashSet.fromIterable(
        A.appendAll(
          A.map(passes, (record) => record.objectId),
          A.map(exceptions, (record) => record.objectId)
        )
      );
      const exceptionCandidates = yield* Effect.forEach(exceptions, (record) =>
        Effect.fromOption(
          A.findFirst(candidates, (candidate) => candidate.objectId === record.objectId),
          () => transformationError(`Prior mail exception references unknown candidate ${record.objectId}.`)
        )
      );
      const exceptionInputBytes = A.reduce(exceptionCandidates, 0, (total, candidate) =>
        O.match(candidate.pass, { onNone: () => total, onSome: (pass) => total + Math.trunc(pass.sizeBytes) })
      );
      const inputBytes =
        exceptionInputBytes + A.reduce(passes, 0, (total, record) => total + Math.trunc(record.inputBytes));
      return {
        candidates: A.filter(candidates, (candidate) => !MutableHashSet.has(processedObjectIds, candidate.objectId)),
        counters: {
          exceptionCount: exceptions.length,
          inputBytes,
          outputBytes: existingOutputBytes,
          passCount: passes.length,
          unapprovedCount: 0,
        },
      };
    })
  );
});

/**
 * Restore the selected mail slice or full mail estate with one-at-a-time libpff attempts.
 *
 * @param options - Frozen preservation label, engine paths, denominator, and resource ceilings.
 * @returns Aggregate store, byte, exception, and unapproved-terminal counts.
 * @effects Requires an independently verified preservation archive, invokes libpff at concurrency one with all-item mode, retains raw attempts, repairs byte-signature mismatches non-destructively, and appends an out-of-repo transformation ledger.
 * @category use-cases
 * @since 0.0.0
 */
export const restoreMailImpl = Effect.fn("CorpusRestoration.restoreMail")(function* (
  options: RestorationMailOptions
): Effect.fn.Return<RestorationRunSummary, CorpusCommandError, TransformationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const prepared = yield* prepareTransformationRun(options.corpusRoot, options.runLabel, "mail", options.scope);
  return yield* withTransformationFamilyWriter(
    prepared,
    Effect.gen(function* () {
      const run = yield* beginOrResumeFamilyRun(
        prepared,
        options.expectedStoreCount,
        options.maxTotalElapsedMillis,
        options.maxTotalOutputBytes,
        transformationPolicySha256([
          options.bwrapPath,
          options.expectedStoreCount,
          options.javaPath,
          options.maxAmplificationRatio,
          options.maxElapsedMillis,
          options.maxTotalElapsedMillis,
          options.maxTotalOutputBytes,
          options.pffexportPath,
          options.scope,
          options.tikaJarPath,
        ])
      );
      const pendingSummary = yield* familyHasPendingSummary(run);
      const candidates = selectMailCandidates(
        path,
        options.scope,
        mailCandidates(path, run.archiveRoot, run.preservationRecords)
      );
      if (candidates.length !== options.expectedStoreCount) {
        return yield* rejectFamilyPreflight(
          pendingSummary,
          run,
          options.expectedStoreCount,
          options.maxTotalElapsedMillis,
          options.maxTotalOutputBytes,
          "Mail candidate denominator drifted from the approved run contract.",
          "Mail candidate denominator does not match the approved expected store count."
        );
      }
      if (!pendingSummary) {
        yield* requireFamilyCapacity(
          run,
          options.expectedStoreCount,
          options.maxTotalElapsedMillis,
          options.maxTotalOutputBytes
        );
      }
      yield* fs
        .makeDirectory(run.outputRoot, { recursive: true })
        .pipe(CorpusCommandError.mapError("Failed creating mail restoration output root."));
      yield* recoverInterruptedAttempts(run, (start) => [
        { label: "partial", relativePath: `attempts/${start.attemptId}.partial` },
        { label: "final", relativePath: `attempts/${start.attemptId}` },
      ]);
      const existingOutput = yield* hashTransformationTree(run.outputRoot);
      if (existingOutput.sizeBytes > options.maxTotalOutputBytes) {
        return yield* rejectFamilyPreflight(
          pendingSummary,
          run,
          options.expectedStoreCount,
          options.maxTotalElapsedMillis,
          options.maxTotalOutputBytes,
          "Existing retained mail output already exceeds the approved cumulative output ceiling.",
          "Mail restoration refused to continue beyond its retained-output ceiling."
        );
      }

      const resume = yield* mailResumeState(run, candidates, existingOutput.sizeBytes);
      const counters = yield* runBoundedFamilyCandidates(
        resume.candidates,
        resume.counters,
        run.startedAt,
        options.maxTotalElapsedMillis,
        options.maxTotalOutputBytes,
        (candidate, outputBytes) => processMailCandidate(candidate, options, run, run.startedAt, outputBytes)
      );
      return yield* finalizeFamilyRun(
        run,
        run.startedAt,
        candidates.length,
        counters,
        options.expectedStoreCount,
        true,
        options.maxTotalElapsedMillis,
        options.maxTotalOutputBytes,
        "Mail terminals are incomplete or contain an unapproved exception or whole-family ceiling breach.",
        "Mail restoration failed its zero-unapproved-terminal acceptance gate."
      );
    })
  );
});

type RecycleArchiveEntry = {
  readonly kind: "content" | "metadata";
  readonly objectId: string;
  readonly pairKey: string;
  readonly preservationRecord: Extract<
    ArchiveLedgerRecord,
    { readonly recordType: "archive-directory-pass" | "archive-file-pass" }
  >;
  readonly sourcePath: string;
  readonly sourceRelativePath: string;
  readonly surfaceKey: string;
};

type RecycleGroup = {
  readonly content: Array<RecycleArchiveEntry>;
  readonly metadata: Array<RecycleArchiveEntry>;
  readonly pairKey: string;
  readonly surfaceKey: string;
};

const digestString = (value: string): Sha256Hex => Sha256Hex.make(bytesToHex(sha256(utf8ToBytes(value))));

const transformationPolicySha256 = (values: ReadonlyArray<number | string>): Sha256Hex =>
  digestString(
    A.join(
      A.map(values, (value) => `${value}`),
      "\u0000"
    )
  );

const recycleSurfaceKey = (path: Path.Path, relativePath: string): string => {
  const normalized = Str.replaceAll("\\", "/")(relativePath);
  const parent = path.dirname(normalized);
  const segments = Str.split("/")(parent);
  const recycleIndex = A.findFirstIndex(segments, (segment) => Str.toLowerCase(segment) === "$recycle.bin");
  return O.match(recycleIndex, {
    onNone: () => parent,
    onSome: (index) => A.join(A.take(segments, Math.min(segments.length, index + 2)), "/"),
  });
};

const recycleEntries = (
  path: Path.Path,
  archiveRoot: string,
  records: ReadonlyArray<ArchiveLedgerRecord>
): ReadonlyArray<RecycleArchiveEntry> =>
  A.getSomes(
    A.map(records, (record) => {
      if (record.recordType !== "archive-file-pass" && record.recordType !== "archive-directory-pass") {
        return O.none<RecycleArchiveEntry>();
      }
      const classified = classifyRecycleBinName(path.basename(record.sourceRelativePath));
      return O.map(classified, (entry) => ({
        kind: entry.kind,
        objectId: record.objectId,
        pairKey: entry.pairKey,
        preservationRecord: record,
        sourcePath: path.join(archiveRoot, record.destinationRelativePath),
        sourceRelativePath: record.sourceRelativePath,
        surfaceKey: recycleSurfaceKey(path, record.sourceRelativePath),
      }));
    })
  );

const groupRecycleEntries = (
  entries: ReadonlyArray<RecycleArchiveEntry>
): MutableHashMap.MutableHashMap<string, RecycleGroup> => {
  const groups = MutableHashMap.empty<string, RecycleGroup>();
  for (const entry of entries) {
    const key = `${entry.surfaceKey}\u0000${entry.pairKey}`;
    const group: RecycleGroup = O.getOrElse(
      MutableHashMap.get(groups, key),
      (): RecycleGroup => ({
        content: [],
        metadata: [],
        pairKey: entry.pairKey,
        surfaceKey: entry.surfaceKey,
      })
    );
    if (entry.kind === "metadata") group.metadata.push(entry);
    else group.content.push(entry);
    MutableHashMap.set(groups, key, group);
  }
  return groups;
};

const hashRecycleContent = Effect.fn("CorpusRestoration.hashRecycleContent")(function* (
  sourcePath: string
): Effect.fn.Return<
  { readonly sha256: Sha256Hex; readonly sizeBytes: number },
  CorpusCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs
    .stat(sourcePath)
    .pipe(CorpusCommandError.mapError("Failed inspecting recycle content object."));
  if (info.type === "File") return yield* hashRestorationFileStreaming(sourcePath, 1024 * 1024);
  if (info.type !== "Directory") {
    return yield* transformationError("Recycle content object is neither a file nor a directory.");
  }
  return yield* hashTransformationTree(sourcePath);
});

const safeRestoredPath = (path: Path.Path, originalPath: string): string => {
  const normalized = Str.replaceAll("\\", "/")(Str.normalize("NFC")(originalPath));
  const withoutDrive = Str.replace(/^[A-Za-z]:/u, "")(normalized);
  const segments = A.filter(Str.split("/")(withoutDrive), Str.isNonEmpty);
  const sanitized = A.map(segments, (segment) => {
    const safe = Str.replace(/[. ]+$/gu, "")(Str.replace(/[<>:"|?*\u0000-\u001f]/gu, "_")(segment));
    const nonempty = safe === "." || safe === ".." || Str.isEmpty(safe) ? "_" : safe;
    return nonempty.length <= 120
      ? nonempty
      : `${Str.takeLeft(88)(nonempty)}__${Str.takeLeft(24)(digestString(nonempty))}`;
  });
  const joined = A.length(sanitized) === 0 ? "_" : path.join(...sanitized);
  return sanitized.length <= 32 && joined.length <= 768
    ? joined
    : path.join("_long-path", `${digestString(normalized)}${path.extname(joined)}`);
};

const collisionAllocatedPath = (
  path: Path.Path,
  desiredPath: string,
  occurrenceKey: string,
  used: MutableHashMap.MutableHashMap<string, string>
): string => {
  const extension = path.extname(desiredPath);
  const stem = Str.slice(0, desiredPath.length - extension.length)(desiredPath);
  let probe = 0;
  let allocated = `${stem}__${Str.takeLeft(24)(digestString(occurrenceKey))}${extension}`;
  let equivalenceKey = Str.toLocaleLowerCase("en-US")(Str.normalize("NFC")(allocated));
  while (MutableHashMap.has(used, equivalenceKey)) {
    probe += 1;
    allocated = `${stem}__${Str.takeLeft(24)(digestString(`${occurrenceKey}\u0000${probe}`))}${extension}`;
    equivalenceKey = Str.toLocaleLowerCase("en-US")(Str.normalize("NFC")(allocated));
  }
  MutableHashMap.set(used, equivalenceKey, occurrenceKey);
  return allocated;
};

const sortedRecycleGroups = (
  groups: MutableHashMap.MutableHashMap<string, RecycleGroup>
): ReadonlyArray<RecycleGroup> =>
  groups.pipe(
    MutableHashMap.values,
    A.fromIterable,
    A.sort(Order.mapInput(Order.String, (group: RecycleGroup) => `${group.surfaceKey}\u0000${group.pairKey}`))
  );

type RecyclePair = {
  readonly content: RecycleArchiveEntry;
  readonly group: RecycleGroup;
  readonly metadata: RecycleArchiveEntry;
};

const recyclePair = (group: RecycleGroup): O.Option<RecyclePair> => {
  const byObjectId = Order.mapInput(Order.String, (entry: RecycleArchiveEntry) => entry.objectId);
  return O.zipWith(
    A.head(A.sort(group.metadata, byObjectId)),
    A.head(A.sort(group.content, byObjectId)),
    (metadata, content) => ({
      content,
      group,
      metadata,
    })
  );
};

const sortedRecyclePairs = (groups: MutableHashMap.MutableHashMap<string, RecycleGroup>): ReadonlyArray<RecyclePair> =>
  groups.pipe(sortedRecycleGroups, A.map(recyclePair), A.getSomes);

const exclusiveCopyFile = Effect.fn("CorpusRestoration.exclusiveCopyFile")(function* (
  sourcePath: string,
  destinationPath: string,
  outputRoot: string
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* requireCanonicalContainedPath(outputRoot, path.dirname(destinationPath));
  yield* Effect.scoped(
    Effect.gen(function* () {
      const source = yield* fs
        .open(sourcePath, { flag: "r" })
        .pipe(CorpusCommandError.mapError("Failed opening transformation copy source."));
      const destination = yield* fs
        .open(destinationPath, { flag: "wx+" })
        .pipe(CorpusCommandError.mapError("Failed exclusively creating transformation copy destination."));
      const opened = yield* destination.stat.pipe(
        CorpusCommandError.mapError("Failed inspecting opened transformation copy destination.")
      );
      yield* requireCanonicalContainedPath(outputRoot, destinationPath);
      const current = yield* fs
        .stat(destinationPath)
        .pipe(CorpusCommandError.mapError("Failed inspecting current transformation copy destination."));
      if (
        opened.type !== "File" ||
        current.type !== "File" ||
        opened.dev !== current.dev ||
        !Equal.equals(opened.ino, current.ino)
      ) {
        return yield* transformationError("Opened transformation destination identity changed before first write.");
      }
      while (true) {
        const chunk = yield* source
          .readAlloc(1024 * 1024)
          .pipe(CorpusCommandError.mapError("Failed reading transformation copy source."));
        if (O.isNone(chunk)) break;
        yield* destination
          .writeAll(chunk.value)
          .pipe(CorpusCommandError.mapError("Failed writing exclusive transformation copy destination."));
      }
      yield* destination.sync.pipe(CorpusCommandError.mapError("Failed syncing exclusive transformation copy."));
    })
  );
});

const exclusiveCopyDirectory = Effect.fn("CorpusRestoration.exclusiveCopyDirectory")(function* (
  sourceRoot: string,
  destinationRoot: string,
  outputRoot: string
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(destinationRoot)
    .pipe(CorpusCommandError.mapError("Failed exclusively creating recycle directory staging root."));
  yield* requireCanonicalContainedPath(outputRoot, destinationRoot);
  const copyAt: (
    source: string,
    destination: string
  ) => Effect.Effect<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> = Effect.fn(
    "CorpusRestoration.exclusiveCopyDirectory.copyAt"
  )(function* (source, destination) {
    const names = yield* fs
      .readDirectory(source)
      .pipe(CorpusCommandError.mapError("Failed reading canonical recycle source directory."));
    for (const name of A.sort(names, Order.String)) {
      const sourceEntry = path.join(source, name);
      const destinationEntry = path.join(destination, name);
      yield* requireCanonicalContainedPath(sourceRoot, sourceEntry);
      const info = yield* fs
        .stat(sourceEntry)
        .pipe(CorpusCommandError.mapError("Failed inspecting canonical recycle source entry."));
      if (info.type === "Directory") {
        yield* fs
          .makeDirectory(destinationEntry)
          .pipe(CorpusCommandError.mapError("Failed exclusively creating recycle destination directory."));
        yield* requireCanonicalContainedPath(outputRoot, destinationEntry);
        yield* copyAt(sourceEntry, destinationEntry);
      } else if (info.type === "File") {
        yield* exclusiveCopyFile(sourceEntry, destinationEntry, outputRoot);
      } else {
        return yield* transformationError("Recycle source tree contains an unsupported non-file object.");
      }
    }
    yield* syncRestorationDirectory(destination);
  });
  yield* copyAt(sourceRoot, destinationRoot);
});

const copyRecycleContent = Effect.fn("CorpusRestoration.copyRecycleContent")(function* (
  outputRoot: string,
  sourcePath: string,
  destinationPath: string,
  expectedDigest: Sha256Hex
): Effect.fn.Return<number, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs
    .exists(destinationPath)
    .pipe(CorpusCommandError.mapError("Failed checking recycle restoration destination."));
  if (exists) {
    yield* requireCanonicalContainedPath(outputRoot, destinationPath);
    const actual = yield* hashRecycleContent(destinationPath);
    if (actual.sha256 === expectedDigest) return 0;
    return yield* transformationError("Existing recycle restoration destination has a conflicting digest.");
  }
  const partialPath = `${destinationPath}.partial`;
  const partialExists = yield* fs
    .exists(partialPath)
    .pipe(CorpusCommandError.mapError("Failed checking partial recycle restoration destination."));
  if (partialExists) {
    return yield* transformationError(
      "Partial recycle restoration destination requires explicit recovery before rerun."
    );
  }
  yield* fs
    .makeDirectory(path.dirname(destinationPath), { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating recycle restoration parent directory."));
  yield* requireCanonicalContainedPath(outputRoot, path.dirname(destinationPath));
  const sourceInfo = yield* fs
    .stat(sourcePath)
    .pipe(CorpusCommandError.mapError("Failed inspecting recycle source during restoration."));
  if (sourceInfo.type === "Directory") {
    yield* exclusiveCopyDirectory(sourcePath, partialPath, outputRoot);
    yield* syncTree(partialPath);
  } else {
    yield* exclusiveCopyFile(sourcePath, partialPath, outputRoot);
  }
  yield* requireCanonicalContainedPath(outputRoot, partialPath);
  const copiedDigest = yield* hashRecycleContent(partialPath);
  if (copiedDigest.sha256 !== expectedDigest) {
    return yield* transformationError("Recycle restoration copy digest does not match its preserved occurrence.");
  }
  if (yield* fs.exists(destinationPath).pipe(CorpusCommandError.mapError("Failed rechecking recycle destination."))) {
    return yield* transformationError("Recycle restoration destination appeared during staged copy.");
  }
  yield* fs
    .rename(partialPath, destinationPath)
    .pipe(CorpusCommandError.mapError("Failed atomically promoting recycle restoration occurrence."));
  yield* syncRestorationDirectory(path.dirname(destinationPath));
  return copiedDigest.sizeBytes;
});

type RecycleSurfaceCounts = {
  readonly duplicate: number;
  readonly missing: number;
  readonly orphan: number;
  readonly valid: number;
};

type RecycleRestoreState = {
  readonly inputBytes: number;
  readonly mappingCount: number;
  readonly outputBytes: number;
};

const recycleGroupCounts = (group: RecycleGroup): RecycleSurfaceCounts => ({
  duplicate:
    group.metadata.length +
    group.content.length -
    (group.metadata.length > 0 ? 1 : 0) -
    (group.content.length > 0 ? 1 : 0),
  missing: group.metadata.length > 0 && group.content.length === 0 ? 1 : 0,
  orphan: group.metadata.length === 0 && group.content.length > 0 ? 1 : 0,
  valid: group.metadata.length > 0 && group.content.length > 0 ? 1 : 0,
});

const recycleGroupSourceObjectIds = (
  group: RecycleGroup,
  joinClass: RecycleJoinClassAndCount[0]
): ReadonlyArray<string> => {
  const metadata = A.sort(
    group.metadata,
    Order.mapInput(Order.String, (entry: RecycleArchiveEntry) => entry.objectId)
  );
  const content = A.sort(
    group.content,
    Order.mapInput(Order.String, (entry: RecycleArchiveEntry) => entry.objectId)
  );
  const byClass: Record<RecycleJoinClassAndCount[0], () => ReadonlyArray<string>> = {
    duplicate: () => A.map(A.appendAll(A.drop(metadata, 1), A.drop(content, 1)), (entry) => entry.objectId),
    "missing-content": () => (metadata[0] === undefined || content.length > 0 ? [] : [metadata[0].objectId]),
    "orphan-content": () => (content[0] === undefined || metadata.length > 0 ? [] : [content[0].objectId]),
    "valid-pair": () => {
      const firstMetadata = metadata[0];
      const firstContent = content[0];
      return firstMetadata !== undefined && firstContent !== undefined
        ? [firstMetadata.objectId, firstContent.objectId]
        : [];
    },
  };
  return byClass[joinClass]();
};

const addRecycleSurfaceCounts = (left: RecycleSurfaceCounts, right: RecycleSurfaceCounts): RecycleSurfaceCounts => ({
  duplicate: left.duplicate + right.duplicate,
  missing: left.missing + right.missing,
  orphan: left.orphan + right.orphan,
  valid: left.valid + right.valid,
});

const recycleSurfaceCounts = (
  groups: MutableHashMap.MutableHashMap<string, RecycleGroup>
): MutableHashMap.MutableHashMap<string, RecycleSurfaceCounts> => {
  const surfaces = MutableHashMap.empty<string, RecycleSurfaceCounts>();
  for (const group of sortedRecycleGroups(groups)) {
    const counts = O.getOrElse(MutableHashMap.get(surfaces, group.surfaceKey), () => ({
      duplicate: 0,
      missing: 0,
      orphan: 0,
      valid: 0,
    }));
    MutableHashMap.set(surfaces, group.surfaceKey, addRecycleSurfaceCounts(counts, recycleGroupCounts(group)));
  }
  return surfaces;
};

const recycleMissingContentCount = (surfaces: MutableHashMap.MutableHashMap<string, RecycleSurfaceCounts>): number => {
  let count = 0;
  for (const surface of MutableHashMap.values(surfaces)) count += surface.missing;
  return count;
};

type DecodedRecycleMetadata = {
  readonly before: TransformationTreeDigest;
  readonly originalPath: string;
};

const readRecycleMetadata = Effect.fn("CorpusRestoration.readRecycleMetadata")(function* (
  metadata: RecycleArchiveEntry
): Effect.fn.Return<DecodedRecycleMetadata, CorpusCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  if (metadata.preservationRecord.recordType !== "archive-file-pass") {
    return yield* transformationError("Recycle metadata occurrence is not a preserved bounded file.");
  }
  if (metadata.preservationRecord.sizeBytes > 64 * 1024) {
    return yield* transformationError("Recycle metadata occurrence exceeded its bounded preserved size contract.");
  }
  const before = yield* hashRestorationFileStreaming(metadata.sourcePath, 1024 * 1024);
  if (
    before.sha256 !== metadata.preservationRecord.sha256 ||
    before.sizeBytes !== metadata.preservationRecord.sizeBytes
  ) {
    return yield* transformationError("Recycle metadata bytes drifted from preservation before parsing.");
  }
  const metadataBytes = yield* fs
    .readFile(metadata.sourcePath)
    .pipe(CorpusCommandError.mapError("Failed reading bounded recycle metadata occurrence."));
  const decoded = yield* parseRecycleBinMetadata(metadataBytes);
  return { before, originalPath: decoded.originalPath };
});

const hashPreservedRecycleContent = Effect.fn("CorpusRestoration.hashPreservedRecycleContent")(function* (
  content: RecycleArchiveEntry
): Effect.fn.Return<TransformationTreeDigest, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const digest = yield* hashRecycleContent(content.sourcePath);
  if (
    content.preservationRecord.recordType === "archive-file-pass" &&
    (digest.sha256 !== content.preservationRecord.sha256 || digest.sizeBytes !== content.preservationRecord.sizeBytes)
  ) {
    return yield* transformationError("Recycle content bytes drifted from preservation before copying.");
  }
  return digest;
});

const requireRecycleCopyCapacity = Effect.fn("CorpusRestoration.requireRecycleCopyCapacity")(function* (
  context: TransformationRunContext,
  digest: TransformationTreeDigest,
  state: RecycleRestoreState,
  options: RestorationRecycleOptions,
  startedAt: number
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const elapsedMillis = yield* familyElapsedMillis(startedAt);
  if (
    elapsedMillis >= options.maxTotalElapsedMillis ||
    digest.sizeBytes > options.maxTotalOutputBytes - state.outputBytes
  ) {
    return yield* denyFamilyPreflight(
      context,
      options.expectedSurfaceCount,
      options.maxTotalElapsedMillis,
      options.maxTotalOutputBytes,
      "Recycle restoration reached its approved total elapsed-time or retained-output ceiling.",
      "Recycle restoration stopped before a copy could exceed its whole-family ceiling."
    );
  }
  const availableBytes = yield* availableRestorationBytesAt(context.corpusRoot);
  if (availableBytes < digest.sizeBytes) {
    return yield* denyFamilyPreflight(
      context,
      options.expectedSurfaceCount,
      options.maxTotalElapsedMillis,
      options.maxTotalOutputBytes,
      "Available destination bytes are below the next recycle payload size.",
      "Recycle restoration capacity preflight denied the next payload write."
    );
  }
});

const recycleSourcesUnchanged = Effect.fn("CorpusRestoration.recycleSourcesUnchanged")(function* (
  metadata: RecycleArchiveEntry,
  metadataBefore: TransformationTreeDigest,
  content: RecycleArchiveEntry,
  contentBefore: TransformationTreeDigest
): Effect.fn.Return<boolean, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const metadataAfter = yield* hashRestorationFileStreaming(metadata.sourcePath, 1024 * 1024);
  const contentAfter = yield* hashRecycleContent(content.sourcePath);
  return (
    metadataAfter.sha256 === metadataBefore.sha256 &&
    metadataAfter.sizeBytes === metadataBefore.sizeBytes &&
    contentAfter.sha256 === contentBefore.sha256 &&
    contentAfter.sizeBytes === contentBefore.sizeBytes
  );
});

const restoreRecyclePair = Effect.fn("CorpusRestoration.restoreRecyclePair")(function* (
  metadata: RecycleArchiveEntry,
  content: RecycleArchiveEntry,
  group: RecycleGroup,
  context: TransformationRunContext,
  outputRoot: string,
  usedPaths: MutableHashMap.MutableHashMap<string, string>,
  state: RecycleRestoreState,
  options: RestorationRecycleOptions,
  startedAt: number
): Effect.fn.Return<RecycleRestoreState, CorpusCommandError, TransformationRequirements> {
  const path = yield* Path.Path;
  const decoded = yield* readRecycleMetadata(metadata);
  const digest = yield* hashPreservedRecycleContent(content);
  yield* requireRecycleCopyCapacity(context, digest, state, options, startedAt);
  const attempt = yield* appendFamilyAttemptStart(context, content.objectId, digest.sha256, digest.sizeBytes);
  const surfaceId = `surface-${Str.takeLeft(16)(digestString(group.surfaceKey))}`;
  const desired = path.join(surfaceId, safeRestoredPath(path, decoded.originalPath));
  const restoredRelativePath = collisionAllocatedPath(
    path,
    desired,
    `${metadata.objectId}\u0000${content.objectId}\u0000${group.pairKey}`,
    usedPaths
  );
  const retainedBytes = yield* copyRecycleContent(
    outputRoot,
    content.sourcePath,
    path.join(outputRoot, restoredRelativePath),
    digest.sha256
  );
  if (!(yield* recycleSourcesUnchanged(metadata, decoded.before, content, digest))) {
    return yield* transformationError("Recycle source bytes changed while parsing or copying.");
  }
  yield* appendTransformationRecord(
    context.ledgerPath,
    TransformationLedgerRecord.cases["recycle-mapping"].make({
      ...(yield* transformationIdentity(context)),
      attemptId: attempt.attemptId,
      contentObjectId: content.objectId,
      digest: digest.sha256,
      family: "recycle",
      metadataObjectId: metadata.objectId,
      originalPath: decoded.originalPath,
      recordType: "recycle-mapping",
      restoredRelativePath,
      surfaceId,
    })
  );
  return {
    inputBytes: state.inputBytes + digest.sizeBytes,
    mappingCount: state.mappingCount + 1,
    outputBytes: state.outputBytes + retainedBytes,
  };
});

const restoreRecyclePairs = Effect.fn("CorpusRestoration.restoreRecyclePairs")(function* (
  pairs: ReadonlyArray<RecyclePair>,
  context: TransformationRunContext,
  outputRoot: string,
  options: RestorationRecycleOptions,
  startedAt: number,
  initialState: RecycleRestoreState,
  usedPaths: MutableHashMap.MutableHashMap<string, string>
): Effect.fn.Return<RecycleRestoreState, CorpusCommandError, TransformationRequirements> {
  let state = initialState;
  for (const pair of pairs) {
    state = yield* restoreRecyclePair(
      pair.metadata,
      pair.content,
      pair.group,
      context,
      outputRoot,
      usedPaths,
      state,
      options,
      startedAt
    );
  }
  return state;
});

type RecycleMapping = Extract<TransformationLedgerRecord, { readonly recordType: "recycle-mapping" }>;
type RecycleJoin = Extract<TransformationLedgerRecord, { readonly recordType: "recycle-join" }>;

type RecycleResumeState = {
  readonly joins: ReadonlyArray<RecycleJoin>;
  readonly pairs: ReadonlyArray<RecyclePair>;
  readonly state: RecycleRestoreState;
  readonly usedPaths: MutableHashMap.MutableHashMap<string, string>;
};

const recycleCheckpointOrderValid = (records: ReadonlyArray<TransformationLedgerRecord>): boolean => {
  let joinsStarted = false;
  for (const record of records) {
    if (record.recordType === "recycle-join") joinsStarted = true;
    else if (
      record.recordType === "family-run-start" ||
      record.recordType === "family-attempt-start" ||
      record.recordType === "family-attempt-interrupted"
    ) {
    } else if (record.recordType !== "recycle-mapping" || joinsStarted) return false;
  }
  return true;
};

const expectedRecycleMappingPath = (
  path: Path.Path,
  pair: RecyclePair,
  originalPath: string,
  usedPaths: MutableHashMap.MutableHashMap<string, string>
): { readonly restoredRelativePath: string; readonly surfaceId: string } => {
  const surfaceId = `surface-${Str.takeLeft(16)(digestString(pair.group.surfaceKey))}`;
  const desired = path.join(surfaceId, safeRestoredPath(path, originalPath));
  return {
    restoredRelativePath: collisionAllocatedPath(
      path,
      desired,
      `${pair.metadata.objectId}\u0000${pair.content.objectId}\u0000${pair.group.pairKey}`,
      usedPaths
    ),
    surfaceId,
  };
};

const recycleMappingIdentityMatches = (
  mapping: RecycleMapping,
  pair: RecyclePair,
  digest: TransformationTreeDigest,
  originalPath: string,
  expected: { readonly restoredRelativePath: string; readonly surfaceId: string }
): boolean =>
  mapping.contentObjectId === pair.content.objectId &&
  mapping.metadataObjectId === pair.metadata.objectId &&
  mapping.digest === digest.sha256 &&
  mapping.originalPath === originalPath &&
  mapping.restoredRelativePath === expected.restoredRelativePath &&
  mapping.surfaceId === expected.surfaceId;

const recycleRetainedCheckpointMatches = Effect.fn("CorpusRestoration.recycleRetainedCheckpointMatches")(function* (
  context: TransformationRunContext,
  outputRoot: string,
  restoredRelativePath: string,
  digest: TransformationTreeDigest
): Effect.fn.Return<boolean, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const retainedPath = path.join(outputRoot, restoredRelativePath);
  yield* requireCanonicalContainedPath(context.outputRoot, retainedPath);
  const retained = yield* hashRecycleContent(retainedPath);
  return retained.sha256 === digest.sha256 && retained.sizeBytes === digest.sizeBytes;
});

const recoverRecycleInterruptedAttempts = Effect.fn("CorpusRestoration.recoverRecycleInterruptedAttempts")(function* (
  context: TransformationRunContext,
  pairs: ReadonlyArray<RecyclePair>
): Effect.fn.Return<void, CorpusCommandError, TransformationRequirements> {
  const path = yield* Path.Path;
  const records = yield* resumableTransformationRecords(context);
  const unsettled = unsettledAttemptStarts(records);
  const usedPaths = MutableHashMap.empty<string, string>();
  for (const pair of pairs) {
    const decoded = yield* readRecycleMetadata(pair.metadata);
    const expected = expectedRecycleMappingPath(path, pair, decoded.originalPath, usedPaths);
    const attempt = A.findFirst(unsettled, (start) => start.sourceId === pair.content.objectId);
    if (O.isSome(attempt)) {
      yield* retainInterruptedAttempt(context, attempt.value, [
        { label: "partial", relativePath: `restored/${expected.restoredRelativePath}.partial` },
        { label: "restored", relativePath: `restored/${expected.restoredRelativePath}` },
      ]);
    }
  }
});

const validateRecycleMappingCheckpoint = Effect.fn("CorpusRestoration.validateRecycleMappingCheckpoint")(function* (
  context: TransformationRunContext,
  outputRoot: string,
  pair: RecyclePair,
  mapping: RecycleMapping,
  usedPaths: MutableHashMap.MutableHashMap<string, string>
): Effect.fn.Return<number, CorpusCommandError, TransformationRequirements> {
  const path = yield* Path.Path;
  const decoded = yield* readRecycleMetadata(pair.metadata);
  const digest = yield* hashPreservedRecycleContent(pair.content);
  const expected = expectedRecycleMappingPath(path, pair, decoded.originalPath, usedPaths);
  if (!recycleMappingIdentityMatches(mapping, pair, digest, decoded.originalPath, expected)) {
    return yield* transformationError(
      "Prior recycle mapping checkpoint does not match the deterministic occurrence join."
    );
  }
  if (!(yield* recycleRetainedCheckpointMatches(context, outputRoot, expected.restoredRelativePath, digest))) {
    return yield* transformationError("Prior recycle mapping checkpoint does not match its retained output bytes.");
  }
  if (!(yield* recycleSourcesUnchanged(pair.metadata, decoded.before, pair.content, digest))) {
    return yield* transformationError("Prior recycle checkpoint source bytes drifted from preservation.");
  }
  return digest.sizeBytes;
});

const validateRecycleMappingPrefix = Effect.fn("CorpusRestoration.validateRecycleMappingPrefix")(function* (
  context: TransformationRunContext,
  outputRoot: string,
  mappings: ReadonlyArray<RecycleMapping>,
  allPairs: ReadonlyArray<RecyclePair>
): Effect.fn.Return<
  { readonly inputBytes: number; readonly usedPaths: MutableHashMap.MutableHashMap<string, string> },
  CorpusCommandError,
  TransformationRequirements
> {
  const usedPaths = MutableHashMap.empty<string, string>();
  let inputBytes = 0;
  for (const [index, mapping] of mappings.entries()) {
    const pair = allPairs[index];
    if (pair === undefined) {
      return yield* transformationError(
        "Prior recycle mapping checkpoint index is outside the approved join inventory."
      );
    }
    inputBytes += yield* validateRecycleMappingCheckpoint(context, outputRoot, pair, mapping, usedPaths);
  }
  return { inputBytes, usedPaths };
});

const recycleResumeState = Effect.fn("CorpusRestoration.recycleResumeState")(function* (
  context: TransformationRunContext,
  groups: MutableHashMap.MutableHashMap<string, RecycleGroup>,
  outputRoot: string,
  existingOutputBytes: number
): Effect.fn.Return<RecycleResumeState, CorpusCommandError, TransformationRequirements> {
  const allPairs = sortedRecyclePairs(groups);
  yield* recoverRecycleInterruptedAttempts(context, allPairs);
  const records = yield* resumableTransformationRecords(context);
  if (!resumableAttemptLifecycleReconciles(records) || !recycleCheckpointOrderValid(records)) {
    return yield* transformationError("Prior recycle checkpoints contain unsupported or out-of-order evidence rows.");
  }
  const mappings = A.filter(records, isRecordType("recycle-mapping"));
  const joins = A.filter(records, isRecordType("recycle-join"));
  if (mappings.length > allPairs.length || (joins.length > 0 && mappings.length !== allPairs.length)) {
    return yield* transformationError("Prior recycle checkpoints do not form a complete deterministic mapping prefix.");
  }
  const prefix = yield* validateRecycleMappingPrefix(context, outputRoot, mappings, allPairs);
  yield* requireRecyclePhysicalEntriesOwned(
    context,
    mappings,
    A.filter(records, isRecordType("family-attempt-interrupted"))
  );
  return {
    joins,
    pairs: A.drop(allPairs, mappings.length),
    state: { inputBytes: prefix.inputBytes, mappingCount: mappings.length, outputBytes: existingOutputBytes },
    usedPaths: prefix.usedPaths,
  };
});

type RecycleJoinClassAndCount = readonly ["duplicate" | "missing-content" | "orphan-content" | "valid-pair", number];

const recycleJoinClasses = (counts: RecycleSurfaceCounts): ReadonlyArray<RecycleJoinClassAndCount> => {
  const classes: ReadonlyArray<RecycleJoinClassAndCount> = [
    ["duplicate", counts.duplicate],
    ["missing-content", counts.missing],
    ["orphan-content", counts.orphan],
    ["valid-pair", counts.valid],
  ];
  return classes;
};

const recycleSurfaceSourceObjectIds = (
  groups: MutableHashMap.MutableHashMap<string, RecycleGroup>,
  surfaceKey: string,
  joinClass: RecycleJoinClassAndCount[0]
): ReadonlyArray<string> =>
  A.flatMap(
    A.filter(sortedRecycleGroups(groups), (group) => group.surfaceKey === surfaceKey),
    (group: RecycleGroup) => recycleGroupSourceObjectIds(group, joinClass)
  );

type RecycleJoinSpec = {
  readonly count: number;
  readonly joinClass: RecycleJoinClassAndCount[0];
  readonly sourceObjectIds: ReadonlyArray<string>;
  readonly surfaceId: string;
};

const recycleJoinSpecs = (
  groups: MutableHashMap.MutableHashMap<string, RecycleGroup>,
  surfaces: MutableHashMap.MutableHashMap<string, RecycleSurfaceCounts>
): ReadonlyArray<RecycleJoinSpec> => {
  const sortedSurfaces = A.sort(
    A.fromIterable(surfaces),
    Order.mapInput(Order.String, ([surfaceKey]: readonly [string, RecycleSurfaceCounts]) => surfaceKey)
  );
  return A.flatMap(sortedSurfaces, ([surfaceKey, counts]) =>
    A.map(recycleJoinClasses(counts), ([joinClass, count]) => ({
      count,
      joinClass,
      sourceObjectIds: recycleSurfaceSourceObjectIds(groups, surfaceKey, joinClass),
      surfaceId: `surface-${Str.takeLeft(16)(digestString(surfaceKey))}`,
    }))
  );
};

const recycleJoinCheckpointMatches = (record: RecycleJoin, spec: RecycleJoinSpec): boolean =>
  record.count === spec.count &&
  record.joinClass === spec.joinClass &&
  record.surfaceId === spec.surfaceId &&
  record.sourceObjectIds.length === spec.sourceObjectIds.length &&
  A.every(A.zip(record.sourceObjectIds, spec.sourceObjectIds), ([actual, expected]) => actual === expected);

const appendRecycleJoinSpec = Effect.fn("CorpusRestoration.appendRecycleJoinSpec")(function* (
  context: TransformationRunContext,
  spec: RecycleJoinSpec
) {
  yield* appendTransformationRecord(
    context.ledgerPath,
    TransformationLedgerRecord.cases["recycle-join"].make({
      ...(yield* transformationIdentity(context)),
      count: nonNegative(spec.count),
      family: "recycle",
      joinClass: spec.joinClass,
      recordType: "recycle-join",
      sourceObjectIds: spec.sourceObjectIds,
      surfaceId: spec.surfaceId,
    })
  );
});

const appendRecycleJoins = Effect.fn("CorpusRestoration.appendRecycleJoins")(function* (
  groups: MutableHashMap.MutableHashMap<string, RecycleGroup>,
  surfaces: MutableHashMap.MutableHashMap<string, RecycleSurfaceCounts>,
  context: TransformationRunContext,
  priorJoins: ReadonlyArray<RecycleJoin>
): Effect.fn.Return<
  { readonly joinOutcomeCount: number; readonly missingContentCount: number },
  CorpusCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const specs = recycleJoinSpecs(groups, surfaces);
  if (
    priorJoins.length > specs.length ||
    !A.every(A.zip(priorJoins, A.take(specs, priorJoins.length)), ([record, spec]) =>
      recycleJoinCheckpointMatches(record, spec)
    )
  ) {
    return yield* transformationError("Prior recycle join checkpoints do not match the deterministic surface ledger.");
  }
  yield* Effect.forEach(A.drop(specs, priorJoins.length), (spec) => appendRecycleJoinSpec(context, spec), {
    concurrency: 1,
  });
  return {
    joinOutcomeCount: A.reduce(specs, 0, (total, spec) => total + spec.count),
    missingContentCount: A.reduce(
      A.filter(specs, (spec) => spec.joinClass === "missing-content"),
      0,
      (total, spec) => total + spec.count
    ),
  };
});

/**
 * Reconcile and restore all recycle surfaces through a four-class occurrence join.
 *
 * @param options - Frozen preservation label and expected surface and missing-content denominators.
 * @returns Aggregate occurrence, mapping, exception, and byte counts.
 * @effects Requires an independently verified preservation archive, reads recycle metadata, atomically materializes valid pairs under a sanitized collision-aware path policy, and appends join and mapping rows outside the repo.
 * @category use-cases
 * @since 0.0.0
 */
export const restoreRecycleImpl = Effect.fn("CorpusRestoration.restoreRecycle")(function* (
  options: RestorationRecycleOptions
): Effect.fn.Return<RestorationRunSummary, CorpusCommandError, TransformationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const prepared = yield* prepareTransformationRun(options.corpusRoot, options.runLabel, "recycle", "full");
  return yield* withTransformationFamilyWriter(
    prepared,
    Effect.gen(function* () {
      const entries = recycleEntries(path, prepared.archiveRoot, prepared.preservationRecords);
      const run = yield* beginOrResumeFamilyRun(
        prepared,
        entries.length,
        options.maxTotalElapsedMillis,
        options.maxTotalOutputBytes,
        transformationPolicySha256([
          options.expectedMissingContentCount,
          options.expectedSurfaceCount,
          options.maxTotalElapsedMillis,
          options.maxTotalOutputBytes,
        ])
      );
      const pendingSummary = yield* familyHasPendingSummary(run);
      const outputRoot = path.join(run.outputRoot, "restored");
      const groups = groupRecycleEntries(entries);
      const surfaces = recycleSurfaceCounts(groups);
      const missingContentCount = recycleMissingContentCount(surfaces);
      if (
        MutableHashMap.size(surfaces) !== options.expectedSurfaceCount ||
        missingContentCount !== options.expectedMissingContentCount
      ) {
        return yield* rejectFamilyPreflight(
          pendingSummary,
          run,
          entries.length,
          options.maxTotalElapsedMillis,
          options.maxTotalOutputBytes,
          "Recycle surface or missing-content evidence drifted from the approved run contract.",
          "Recycle restoration denominator preflight denied payload writes."
        );
      }
      if (!pendingSummary) {
        yield* requireFamilyCapacity(run, entries.length, options.maxTotalElapsedMillis, options.maxTotalOutputBytes);
      }
      yield* fs
        .makeDirectory(outputRoot, { recursive: true })
        .pipe(CorpusCommandError.mapError("Failed creating the recycle restoration output root."));
      yield* requireCanonicalContainedPath(outputRoot, outputRoot);
      const existingOutput = yield* hashTransformationTree(run.outputRoot);
      if (existingOutput.sizeBytes > options.maxTotalOutputBytes) {
        return yield* rejectFamilyPreflight(
          pendingSummary,
          run,
          entries.length,
          options.maxTotalElapsedMillis,
          options.maxTotalOutputBytes,
          "Existing retained recycle output already exceeds the approved cumulative output ceiling.",
          "Recycle restoration refused to continue beyond its retained-output ceiling."
        );
      }
      const resume = yield* recycleResumeState(run, groups, outputRoot, existingOutput.sizeBytes);
      const restored = yield* restoreRecyclePairs(
        resume.pairs,
        run,
        outputRoot,
        options,
        run.startedAt,
        resume.state,
        resume.usedPaths
      );
      const joins = yield* appendRecycleJoins(groups, surfaces, run, resume.joins);
      let counters: FamilyCounters = {
        exceptionCount: joins.joinOutcomeCount - restored.mappingCount,
        inputBytes: restored.inputBytes,
        outputBytes: restored.outputBytes,
        passCount: restored.mappingCount,
        unapprovedCount: 0,
      };
      counters = yield* applyFamilyCeiling(
        counters,
        run.startedAt,
        options.maxTotalElapsedMillis,
        options.maxTotalOutputBytes
      );
      const contractMatches = joins.missingContentCount === missingContentCount;
      return yield* finalizeFamilyRun(
        run,
        run.startedAt,
        entries.length,
        counters,
        joins.joinOutcomeCount,
        contractMatches,
        options.maxTotalElapsedMillis,
        options.maxTotalOutputBytes,
        "Recycle surface, missing-content, or whole-family ceiling evidence drifted from the approved contract.",
        "Recycle restoration failed its surface or missing-content acceptance gate."
      );
    })
  );
});

type LegacyWordCandidate = {
  readonly digest: Sha256Hex;
  readonly occurrenceCount: number;
  readonly pass: PreservedFilePass;
  readonly sourcePath: string;
};

type LegacyWordTerminal = {
  readonly inputBytes: number;
  readonly outputBytes: number;
  readonly passed: boolean;
  readonly unapproved: boolean;
};

const legacyOutputBound = OutputBound.make({
  maxChars: 64 * 1024 * 1024,
  truncatedNotice: "\n[legacy-word output truncated]",
});

const legacyWordCandidates = (
  path: Path.Path,
  archiveRoot: string,
  records: ReadonlyArray<ArchiveLedgerRecord>
): { readonly candidates: ReadonlyArray<LegacyWordCandidate>; readonly occurrenceCount: number } => {
  const occurrences = A.filter(
    records,
    (record): record is PreservedFilePass =>
      record.recordType === "archive-file-pass" && sourceExtension(path, record.sourceRelativePath) === "doc"
  );
  const byDigest = MutableHashMap.empty<Sha256Hex, { occurrenceCount: number; pass: PreservedFilePass }>();
  for (const pass of occurrences) {
    const current = MutableHashMap.get(byDigest, pass.sha256);
    MutableHashMap.set(
      byDigest,
      pass.sha256,
      O.match(current, {
        onNone: () => ({ occurrenceCount: 1, pass }),
        onSome: (value) => ({ occurrenceCount: value.occurrenceCount + 1, pass: value.pass }),
      })
    );
  }
  return {
    candidates: A.sort(
      A.map(A.fromIterable(byDigest), ([digest, value]) => ({
        digest,
        occurrenceCount: value.occurrenceCount,
        pass: value.pass,
        sourcePath: path.join(archiveRoot, value.pass.destinationRelativePath),
      })),
      Order.mapInput(Order.String, (candidate: LegacyWordCandidate) => candidate.digest)
    ),
    occurrenceCount: occurrences.length,
  };
};

const isCompoundFileBinary = (bytes: Uint8Array): boolean =>
  [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((value, index) => bytes[index] === value);

const runLegacyStep = Effect.fn("CorpusRestoration.runLegacyStep")(function* (
  command: string,
  args: ReadonlyArray<string>,
  maxElapsedMillis: number,
  source: "all" | "stdout" = "all",
  abortWhen: O.Option<Effect.Effect<never, CorpusCommandError, FileSystem.FileSystem | Path.Path>> = O.none()
): Effect.fn.Return<CapturedStep, CorpusCommandError, TransformationRequirements> {
  if (maxElapsedMillis <= 0) {
    return yield* transformationError("Legacy-Word transformation has no remaining elapsed-time budget.");
  }
  return yield* runCaptured({
    ...(O.isSome(abortWhen) ? { abortWhen: abortWhen.value } : {}),
    args,
    bound: legacyOutputBound,
    command,
    forceKillAfter: "1 second",
    source,
    timeout: maxElapsedMillis,
    trim: true,
  }).pipe(CorpusCommandError.mapError("Legacy-Word subprocess failed before producing a terminal result."));
});

type LegacyTimeBudget = {
  readonly attemptStartedAt: number;
  readonly context: TransformationRunContext;
  readonly familyStartedAt: number;
};

const legacyOutputWatchdog = Effect.fn("CorpusRestoration.legacyOutputWatchdog")(function* (
  context: TransformationRunContext,
  options: RestorationLegacyWordOptions
): Effect.fn.Return<never, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  while (true) {
    const retainedBytes = yield* measureTransformationTreeBytes(context.outputRoot);
    if (retainedBytes > options.maxTotalOutputBytes) {
      return yield* transformationError(
        "Legacy-Word subprocess crossed the approved cumulative retained-output ceiling."
      );
    }
    yield* Effect.sleep("25 millis");
  }
});

const remainingLegacyMillis = Effect.fn("CorpusRestoration.remainingLegacyMillis")(function* (
  budget: LegacyTimeBudget,
  options: RestorationLegacyWordOptions
) {
  const now = DateTime.toEpochMillis(yield* DateTime.now);
  return Math.min(
    options.maxElapsedMillis - (now - budget.attemptStartedAt),
    options.maxTotalElapsedMillis - (now - budget.familyStartedAt)
  );
});

const runSandboxedConversion = Effect.fn("CorpusRestoration.runSandboxedConversion")(function* (
  inputPath: string,
  inputExtension: "doc" | "docx",
  outputFormat: "docx" | "pdf",
  outputDirectory: string,
  options: RestorationLegacyWordOptions,
  budget: LegacyTimeBudget
): Effect.fn.Return<string, CorpusCommandError, TransformationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(outputDirectory, { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating a legacy-Word sandbox output directory."));
  const sandboxInput = `/input/source.${inputExtension}`;
  const converter = sandboxedTool(path, options.converterPath, "converter");
  const result = yield* runLegacyStep(
    options.bwrapPath,
    [
      ...sandboxBaseArgs(yield* sandboxRuntimeBinds()),
      ...converter.bindArgs,
      "--ro-bind",
      inputPath,
      sandboxInput,
      "--bind",
      outputDirectory,
      "/output",
      "--setenv",
      "HOME",
      "/tmp/home",
      "--setenv",
      "SAL_USE_VCLPLUGIN",
      "svp",
      "--",
      converter.executable,
      "--headless",
      "--convert-to",
      outputFormat,
      "--outdir",
      "/output",
      sandboxInput,
    ],
    yield* remainingLegacyMillis(budget, options),
    "all",
    O.some(legacyOutputWatchdog(budget.context, options))
  );
  if (result.exitCode !== 0 || result.truncated) {
    return yield* transformationError("Sandboxed legacy-Word conversion failed or exceeded its bounded output.");
  }
  const convertedPath = path.join(outputDirectory, `source.${outputFormat}`);
  if (!(yield* fs.exists(convertedPath).pipe(CorpusCommandError.mapError("Failed checking converter output.")))) {
    return yield* transformationError("Sandboxed legacy-Word conversion produced no expected output object.");
  }
  return convertedPath;
});

const normalizedTikaText = Effect.fn("CorpusRestoration.normalizedTikaText")(function* (
  filePath: string,
  options: RestorationLegacyWordOptions,
  budget: LegacyTimeBudget
): Effect.fn.Return<
  { readonly digest: Sha256Hex; readonly text: string },
  CorpusCommandError,
  TransformationRequirements
> {
  const path = yield* Path.Path;
  const java = sandboxedTool(path, options.javaPath, "java");
  const result = yield* runLegacyStep(
    options.bwrapPath,
    [
      ...sandboxBaseArgs(yield* sandboxRuntimeBinds()),
      ...java.bindArgs,
      "--ro-bind",
      options.tikaJarPath,
      "/input/tika.jar",
      "--ro-bind",
      filePath,
      "/input/source",
      "--",
      java.executable,
      "-jar",
      "/input/tika.jar",
      "-t",
      "/input/source",
    ],
    yield* remainingLegacyMillis(budget, options),
    "stdout"
  );
  if (result.exitCode !== 0 || result.truncated) {
    return yield* transformationError("Tika failed or exceeded its bounded output during legacy-Word comparison.");
  }
  const normalized = Str.trim(Str.replace(/\s+/gu, " ")(Str.normalize("NFKC")(result.output)));
  if (Str.isEmpty(normalized)) {
    return yield* transformationError("Tika returned empty normalized text during legacy-Word comparison.");
  }
  return { digest: digestString(normalized), text: normalized };
});

const pdfPageCount = Effect.fn("CorpusRestoration.pdfPageCount")(function* (
  pdfPath: string,
  options: RestorationLegacyWordOptions,
  budget: LegacyTimeBudget
): Effect.fn.Return<number, CorpusCommandError, TransformationRequirements> {
  const path = yield* Path.Path;
  const pdfinfo = sandboxedTool(path, options.pdfinfoPath, "pdfinfo");
  const result = yield* runLegacyStep(
    options.bwrapPath,
    [
      ...sandboxBaseArgs(yield* sandboxRuntimeBinds()),
      ...pdfinfo.bindArgs,
      "--ro-bind",
      pdfPath,
      "/input/source.pdf",
      "--",
      pdfinfo.executable,
      "/input/source.pdf",
    ],
    yield* remainingLegacyMillis(budget, options),
    "stdout"
  );
  if (result.exitCode !== 0 || result.truncated) {
    return yield* transformationError("PDF page-count probe failed or exceeded its bounded output.");
  }
  const pagesLine = A.findFirst(Str.split(/\r?\n/u)(result.output), (line) => Str.startsWith("Pages:")(Str.trim(line)));
  const pages = O.match(pagesLine, {
    onNone: () => Number.NaN,
    onSome: (line) => Number(Str.trim(Str.slice("Pages:".length)(Str.trim(line)))),
  });
  if (!Number.isSafeInteger(pages) || pages <= 0) {
    return yield* transformationError("PDF page-count probe returned no valid page denominator.");
  }
  return pages;
});

const renderPdfPages = Effect.fn("CorpusRestoration.renderPdfPages")(function* (
  pdfPath: string,
  outputDirectory: string,
  options: RestorationLegacyWordOptions,
  budget: LegacyTimeBudget
): Effect.fn.Return<ReadonlyArray<string>, CorpusCommandError, TransformationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(outputDirectory, { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating a legacy-Word page-render directory."));
  const pdftoppm = sandboxedTool(path, options.pdftoppmPath, "pdftoppm");
  const result = yield* runLegacyStep(
    options.bwrapPath,
    [
      ...sandboxBaseArgs(yield* sandboxRuntimeBinds()),
      ...pdftoppm.bindArgs,
      "--ro-bind",
      pdfPath,
      "/input/source.pdf",
      "--bind",
      outputDirectory,
      "/output",
      "--",
      pdftoppm.executable,
      "-png",
      "-r",
      "96",
      "/input/source.pdf",
      "/output/page",
    ],
    yield* remainingLegacyMillis(budget, options),
    "all",
    O.some(legacyOutputWatchdog(budget.context, options))
  );
  if (result.exitCode !== 0 || result.truncated) {
    return yield* transformationError("PDF page rendering failed or exceeded its bounded output.");
  }
  return A.map(
    A.sort(
      A.filter(yield* walkFiles(outputDirectory), (file) => sourceExtension(path, file.relativePath) === "png"),
      Order.mapInput(Order.String, (file: WalkedTransformationFile) => file.relativePath)
    ),
    (file) => file.absolutePath
  );
});

const parseNormalizedRmse = (output: string): O.Option<number> => {
  const matched = /\(([0-9]+(?:\.[0-9]+)?)\)/u.exec(output);
  if (matched === null || matched[1] === undefined) return O.none();
  const value = Number(matched[1]);
  return Number.isFinite(value) ? O.some(value) : O.none();
};

const comparePageRmse = Effect.fn("CorpusRestoration.comparePageRmse")(function* (
  original: string,
  converted: string,
  options: RestorationLegacyWordOptions,
  budget: LegacyTimeBudget
): Effect.fn.Return<number, CorpusCommandError, TransformationRequirements> {
  const path = yield* Path.Path;
  const compare = sandboxedTool(path, options.comparePath, "compare");
  const result = yield* runLegacyStep(
    options.bwrapPath,
    [
      ...sandboxBaseArgs(yield* sandboxRuntimeBinds()),
      ...compare.bindArgs,
      "--ro-bind",
      original,
      "/input/original.png",
      "--ro-bind",
      converted,
      "/input/converted.png",
      "--",
      compare.executable,
      "-metric",
      "RMSE",
      "/input/original.png",
      "/input/converted.png",
      "null:",
    ],
    yield* remainingLegacyMillis(budget, options)
  );
  if ((result.exitCode !== 0 && result.exitCode !== 1) || result.truncated) {
    return yield* transformationError("Rendered-page comparison failed or exceeded its bounded output.");
  }
  const rmse = O.getOrElse(parseNormalizedRmse(result.output), () => Number.NaN);
  if (!Number.isFinite(rmse)) {
    return yield* transformationError("Rendered-page comparison returned no normalized RMSE value.");
  }
  return rmse;
});

const maximumPageRmse = Effect.fn("CorpusRestoration.maximumPageRmse")(function* (
  originalPages: ReadonlyArray<string>,
  convertedPages: ReadonlyArray<string>,
  options: RestorationLegacyWordOptions,
  budget: LegacyTimeBudget
): Effect.fn.Return<number, CorpusCommandError, TransformationRequirements> {
  if (originalPages.length !== convertedPages.length) return Number.POSITIVE_INFINITY;
  const values = yield* Effect.forEach(
    A.zip(originalPages, convertedPages),
    ([original, converted]) => comparePageRmse(original, converted, options, budget),
    { concurrency: 1 }
  );
  return A.reduce(values, 0, Math.max);
});

const appendLegacyException = Effect.fn("CorpusRestoration.appendLegacyException")(function* (
  context: TransformationRunContext,
  attemptId: string,
  digest: Sha256Hex,
  exceptionKind: "conversion-failed" | "fidelity-failed" | "not-binary-word",
  approved: boolean,
  message: string
) {
  yield* appendTransformationRecord(
    context.ledgerPath,
    TransformationLedgerRecord.cases["legacy-word-exception"].make({
      ...(yield* transformationIdentity(context)),
      approved,
      attemptId,
      exceptionKind,
      family: "legacy-word",
      message,
      originalSha256: digest,
      recordType: "legacy-word-exception",
    })
  );
});

type LegacyFidelityEvidence = {
  readonly convertedPath: string;
  readonly normalizedTextSha256: Sha256Hex;
  readonly pageCountDelta: number;
  readonly visualRmse: number;
};

const makeLegacyWorkRoot = Effect.fn("CorpusRestoration.makeLegacyWorkRoot")(function* (
  outputRoot: string,
  digest: Sha256Hex,
  attemptId: string
): Effect.fn.Return<string, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workRoot = path.join(outputRoot, "proof", digest, attemptId);
  if (yield* fs.exists(workRoot).pipe(CorpusCommandError.mapError("Failed checking legacy-Word proof root."))) {
    return yield* transformationError(
      "Legacy-Word proof root already exists; the immutable attempt must not be overwritten."
    );
  }
  yield* fs
    .makeDirectory(workRoot, { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating legacy-Word proof root."));
  yield* requireCanonicalContainedPath(outputRoot, workRoot);
  return workRoot;
});

const proveLegacyFidelity = Effect.fn("CorpusRestoration.proveLegacyFidelity")(function* (
  candidate: LegacyWordCandidate,
  workRoot: string,
  options: RestorationLegacyWordOptions,
  budget: LegacyTimeBudget
): Effect.fn.Return<LegacyFidelityEvidence, CorpusCommandError, TransformationRequirements> {
  const path = yield* Path.Path;
  const convertedPath = yield* runSandboxedConversion(
    candidate.sourcePath,
    "doc",
    "docx",
    path.join(workRoot, "converted"),
    options,
    budget
  );
  const originalText = yield* normalizedTikaText(candidate.sourcePath, options, budget);
  const convertedText = yield* normalizedTikaText(convertedPath, options, budget);
  const originalPdf = yield* runSandboxedConversion(
    candidate.sourcePath,
    "doc",
    "pdf",
    path.join(workRoot, "original-pdf"),
    options,
    budget
  );
  const convertedPdf = yield* runSandboxedConversion(
    convertedPath,
    "docx",
    "pdf",
    path.join(workRoot, "converted-pdf"),
    options,
    budget
  );
  const originalPageCount = yield* pdfPageCount(originalPdf, options, budget);
  const convertedPageCount = yield* pdfPageCount(convertedPdf, options, budget);
  const originalPages = yield* renderPdfPages(originalPdf, path.join(workRoot, "original-pages"), options, budget);
  const convertedPages = yield* renderPdfPages(convertedPdf, path.join(workRoot, "converted-pages"), options, budget);
  if (
    originalPages.length !== originalPageCount ||
    convertedPages.length !== convertedPageCount ||
    originalPages.length <= 0 ||
    convertedPages.length <= 0
  ) {
    return yield* transformationError(
      "Rendered legacy-Word page files do not exactly match the positive PDF page denominators."
    );
  }
  return {
    convertedPath,
    normalizedTextSha256: originalText.digest,
    pageCountDelta: convertedPageCount - originalPageCount,
    visualRmse:
      originalText.digest === convertedText.digest
        ? yield* maximumPageRmse(originalPages, convertedPages, options, budget)
        : Number.POSITIVE_INFINITY,
  };
});

const legacyFidelityPasses = (
  evidence: LegacyFidelityEvidence,
  elapsedMillis: number,
  options: RestorationLegacyWordOptions
): boolean =>
  evidence.pageCountDelta === 0 &&
  evidence.visualRmse <= options.maxVisualRmse &&
  elapsedMillis <= options.maxElapsedMillis;

const promoteLegacyWordOutput = Effect.fn("CorpusRestoration.promoteLegacyWordOutput")(function* (
  convertedPath: string,
  digest: Sha256Hex,
  outputRoot: string,
  corpusRoot: string,
  maxTotalOutputBytes: PosInt
): Effect.fn.Return<
  { readonly sha256: Sha256Hex; readonly sizeBytes: number },
  CorpusCommandError,
  TransformationRequirements
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const convertedDigest = yield* hashRestorationFileStreaming(convertedPath, 1024 * 1024);
  const retained = yield* hashTransformationTree(outputRoot);
  const available = yield* availableRestorationBytesAt(corpusRoot);
  if (convertedDigest.sizeBytes > maxTotalOutputBytes - retained.sizeBytes || available < convertedDigest.sizeBytes) {
    return yield* transformationError("Legacy-Word final DOCX has no remaining cumulative output capacity.");
  }
  const finalRoot = path.join(outputRoot, "converted");
  const destinationPath = path.join(finalRoot, `${digest}.docx`);
  const partialPath = `${destinationPath}.partial`;
  yield* fs
    .makeDirectory(finalRoot, { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating legacy-Word conversion destination."));
  yield* requireCanonicalContainedPath(outputRoot, finalRoot);
  const destinationExists = yield* fs
    .exists(destinationPath)
    .pipe(CorpusCommandError.mapError("Failed checking legacy-Word destination."));
  const partialExists = yield* fs
    .exists(partialPath)
    .pipe(CorpusCommandError.mapError("Failed checking legacy-Word partial destination."));
  if (destinationExists || partialExists) {
    return yield* transformationError("Legacy-Word conversion destination already exists and will not be overwritten.");
  }
  yield* exclusiveCopyFile(convertedPath, partialPath, outputRoot);
  const stagedDigest = yield* hashRestorationFileStreaming(partialPath, 1024 * 1024);
  if (stagedDigest.sha256 !== convertedDigest.sha256 || stagedDigest.sizeBytes !== convertedDigest.sizeBytes) {
    return yield* transformationError("Legacy-Word atomic staging digest does not match the converter output.");
  }
  yield* fs
    .link(partialPath, destinationPath)
    .pipe(CorpusCommandError.mapError("Failed exclusively publishing legacy-Word conversion output."));
  yield* syncRestorationDirectory(finalRoot);
  yield* fs
    .remove(partialPath)
    .pipe(CorpusCommandError.mapError("Failed removing published legacy-Word conversion staging link."));
  yield* syncRestorationDirectory(finalRoot);
  return convertedDigest;
});

const legacyCandidateRetainedBytes = Effect.fn("CorpusRestoration.legacyCandidateRetainedBytes")(function* (
  outputRoot: string,
  digest: Sha256Hex
): Effect.fn.Return<number, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const sizes = yield* Effect.forEach(
    [path.join(outputRoot, "proof", digest), path.join(outputRoot, "converted", `${digest}.docx`)],
    measureTransformationTreeBytes,
    { concurrency: 1 }
  );
  return A.reduce(sizes, 0, (total, size) => total + size);
});

const processLegacyWordCandidate = Effect.fn("CorpusRestoration.processLegacyWordCandidate")(function* (
  candidate: LegacyWordCandidate,
  engineVersion: string,
  context: TransformationRunContext,
  options: RestorationLegacyWordOptions
): Effect.fn.Return<LegacyWordTerminal, CorpusCommandError, TransformationRequirements> {
  const sourceBefore = yield* hashRestorationFileStreaming(candidate.sourcePath, 1024 * 1024);
  if (sourceBefore.sha256 !== candidate.digest || sourceBefore.sizeBytes !== candidate.pass.sizeBytes) {
    return yield* transformationError("Legacy-Word source bytes drifted from preservation before transformation.");
  }
  const attempt = yield* appendFamilyAttemptStart(
    context,
    candidate.digest,
    candidate.digest,
    candidate.pass.sizeBytes
  );
  const attemptId = attempt.attemptId;
  const prefix = yield* readPrefix(candidate.sourcePath);
  if (!isCompoundFileBinary(prefix)) {
    yield* appendLegacyException(
      context,
      attemptId,
      candidate.digest,
      "not-binary-word",
      true,
      "The .doc occurrence does not carry the Compound File Binary signature and remains preserved without conversion."
    );
    return { inputBytes: candidate.pass.sizeBytes, outputBytes: 0, passed: false, unapproved: false };
  }
  const startedAt = DateTime.toEpochMillis(yield* DateTime.now);
  const budget: LegacyTimeBudget = { attemptStartedAt: startedAt, context, familyStartedAt: context.startedAt };
  const workRoot = yield* makeLegacyWorkRoot(context.outputRoot, candidate.digest, attemptId);
  const evidence = yield* proveLegacyFidelity(candidate, workRoot, options, budget);
  const sourceAfter = yield* hashRestorationFileStreaming(candidate.sourcePath, 1024 * 1024);
  if (sourceAfter.sha256 !== sourceBefore.sha256 || sourceAfter.sizeBytes !== sourceBefore.sizeBytes) {
    return yield* transformationError("Legacy-Word source bytes changed during transformation.");
  }
  const elapsedMillis = DateTime.toEpochMillis(yield* DateTime.now) - startedAt;
  if (!legacyFidelityPasses(evidence, elapsedMillis, options)) {
    yield* appendLegacyException(
      context,
      attemptId,
      candidate.digest,
      "fidelity-failed",
      false,
      "Converted output exceeded the declared normalized-text, pagination, visual, or elapsed-time fidelity boundary."
    );
    return {
      inputBytes: candidate.pass.sizeBytes,
      outputBytes: yield* legacyCandidateRetainedBytes(context.outputRoot, candidate.digest),
      passed: false,
      unapproved: true,
    };
  }
  const convertedDigest = yield* promoteLegacyWordOutput(
    evidence.convertedPath,
    candidate.digest,
    context.outputRoot,
    context.corpusRoot,
    options.maxTotalOutputBytes
  );
  yield* appendTransformationRecord(
    context.ledgerPath,
    TransformationLedgerRecord.cases["legacy-word-pass"].make({
      ...(yield* transformationIdentity(context)),
      attemptId,
      convertedSha256: convertedDigest.sha256,
      engineVersion,
      family: "legacy-word",
      normalizedTextSha256: evidence.normalizedTextSha256,
      originalSha256: candidate.digest,
      pageCountDelta: evidence.pageCountDelta,
      postProcessOriginalSha256: sourceAfter.sha256,
      recordType: "legacy-word-pass",
      visualRmse: evidence.visualRmse,
    })
  );
  return {
    inputBytes: candidate.pass.sizeBytes,
    outputBytes: yield* legacyCandidateRetainedBytes(context.outputRoot, candidate.digest),
    passed: true,
    unapproved: false,
  };
});

const legacyFailureTerminal = Effect.fn("CorpusRestoration.legacyFailureTerminal")(function* (
  context: TransformationRunContext,
  candidate: LegacyWordCandidate
): Effect.fn.Return<LegacyWordTerminal, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const records = yield* resumableTransformationRecords(context);
  const attempt = O.getOrElse(
    A.last(A.filter(unsettledAttemptStarts(records), (start) => start.sourceId === candidate.digest)),
    () => undefined
  );
  if (attempt === undefined) {
    return yield* transformationError("Legacy-Word failure has no unmatched durable attempt start.");
  }
  yield* appendLegacyException(
    context,
    attempt.attemptId,
    candidate.digest,
    "conversion-failed",
    false,
    "The sandboxed conversion or its evidence pipeline failed before a PASS could be recorded."
  );
  return {
    inputBytes: candidate.pass.sizeBytes,
    outputBytes: yield* legacyCandidateRetainedBytes(context.outputRoot, candidate.digest),
    passed: false,
    unapproved: true,
  };
});

const processLegacyWordTerminal = Effect.fn("CorpusRestoration.processLegacyWordTerminal")(function* (
  candidate: LegacyWordCandidate,
  engineVersion: string,
  context: TransformationRunContext,
  options: RestorationLegacyWordOptions,
  familyStartedAt: number,
  outputBytes: number
): Effect.fn.Return<LegacyWordTerminal, CorpusCommandError, TransformationRequirements> {
  const budgetAvailable = yield* familyBudgetAvailable(
    familyStartedAt,
    outputBytes,
    options.maxTotalElapsedMillis,
    options.maxTotalOutputBytes
  );
  if (!budgetAvailable) {
    const attempt = yield* appendFamilyAttemptStart(
      context,
      candidate.digest,
      candidate.digest,
      candidate.pass.sizeBytes
    );
    yield* appendLegacyException(
      context,
      attempt.attemptId,
      candidate.digest,
      "conversion-failed",
      false,
      "The legacy-Word family exhausted its approved total elapsed-time or retained-output ceiling."
    );
    return { inputBytes: candidate.pass.sizeBytes, outputBytes: 0, passed: false, unapproved: true };
  }
  return yield* processLegacyWordCandidate(candidate, engineVersion, context, options).pipe(
    Effect.catch(() => legacyFailureTerminal(context, candidate))
  );
});

type LegacyResumeState = FamilyResumeState<LegacyWordCandidate>;

const legacyResumeState = Effect.fn("CorpusRestoration.legacyResumeState")(function* (
  context: TransformationRunContext,
  candidates: ReadonlyArray<LegacyWordCandidate>,
  existingOutputBytes: number
): Effect.fn.Return<LegacyResumeState, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  return yield* resumeFamilyCandidates(
    context,
    candidates,
    existingOutputBytes,
    Effect.fnUntraced(function* (records) {
      const passes = A.filter(records, isRecordType("legacy-word-pass"));
      const exceptions = A.filter(records, isRecordType("legacy-word-exception"));
      if (
        !resumableAttemptLifecycleReconciles(records) ||
        !legacySegmentReconciles(
          { exceptionCount: nonNegative(exceptions.length), passCount: nonNegative(passes.length) },
          records
        )
      ) {
        return yield* transformationError("Prior legacy-Word checkpoints are incomplete, duplicated, or unapproved.");
      }
      yield* rehashRetainedFamilyOutputs(context, records);
      const processedDigests = MutableHashSet.fromIterable(
        A.appendAll(
          A.map(passes, (record) => record.originalSha256),
          A.map(exceptions, (record) => record.originalSha256)
        )
      );
      const processedCandidates = A.filter(candidates, (candidate) =>
        MutableHashSet.has(processedDigests, candidate.digest)
      );
      return {
        candidates: A.filter(candidates, (candidate) => !MutableHashSet.has(processedDigests, candidate.digest)),
        counters: {
          exceptionCount: exceptions.length,
          inputBytes: A.reduce(
            processedCandidates,
            0,
            (total, candidate) => total + Math.trunc(candidate.pass.sizeBytes)
          ),
          outputBytes: existingOutputBytes,
          passCount: passes.length,
          unapprovedCount: 0,
        },
      };
    })
  );
});

const legacyInterruptedAttemptRoots = (start: FamilyAttemptStart): ReadonlyArray<InterruptedRootCandidate> => [
  { label: "proof", relativePath: `proof/${start.sourceId}/${start.attemptId}` },
  { label: "converted", relativePath: `converted/${start.sourceSha256}.docx` },
  { label: "converted-partial", relativePath: `converted/${start.sourceSha256}.docx.partial` },
];

/**
 * Convert every distinct preserved legacy-Word digest with declared text, page, and visual fidelity checks.
 *
 * @param options - Pinned converter identity, occurrence denominator, sandbox tool paths, and fidelity ceilings.
 * @returns Aggregate occurrence, distinct-digest terminal, byte, and unapproved counts.
 * @effects Verifies P0, runs the pinned converter inside a network-isolated read-only bubblewrap runtime, invokes Tika and PDF comparison tools, atomically retains derived DOCX files, and appends terminal evidence outside the repo.
 * @category use-cases
 * @since 0.0.0
 */
export const restoreLegacyWordImpl = Effect.fn("CorpusRestoration.restoreLegacyWord")(function* (
  options: RestorationLegacyWordOptions
): Effect.fn.Return<RestorationRunSummary, CorpusCommandError, TransformationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const prepared = yield* prepareTransformationRun(options.corpusRoot, options.runLabel, "legacy-word", "full");
  return yield* withTransformationFamilyWriter(
    prepared,
    Effect.gen(function* () {
      const run = yield* beginOrResumeFamilyRun(
        prepared,
        options.expectedOccurrenceCount,
        options.maxTotalElapsedMillis,
        options.maxTotalOutputBytes,
        transformationPolicySha256([
          options.bwrapPath,
          options.comparePath,
          options.converterPath,
          options.expectedConverterVersion,
          options.expectedOccurrenceCount,
          options.javaPath,
          options.maxElapsedMillis,
          options.maxTotalElapsedMillis,
          options.maxTotalOutputBytes,
          options.maxVisualRmse,
          options.pdfinfoPath,
          options.pdftoppmPath,
          options.tikaJarPath,
        ])
      );
      const pendingSummary = yield* familyHasPendingSummary(run);
      const inventory = legacyWordCandidates(path, run.archiveRoot, run.preservationRecords);
      const version = pendingSummary
        ? O.none<CapturedStep>()
        : O.some(yield* runLegacyStep(options.converterPath, ["--version"], options.maxElapsedMillis, "stdout"));
      const versionMatches = O.match(version, {
        onNone: () => true,
        onSome: (captured) =>
          captured.exitCode === 0 && !captured.truncated && captured.output === options.expectedConverterVersion,
      });
      if (inventory.occurrenceCount !== options.expectedOccurrenceCount || !versionMatches) {
        return yield* rejectFamilyPreflight(
          pendingSummary,
          run,
          inventory.candidates.length,
          options.maxTotalElapsedMillis,
          options.maxTotalOutputBytes,
          "Legacy-Word occurrence denominator or pinned converter identity drifted before transformation.",
          "Legacy-Word preflight failed its occurrence or converter-version gate."
        );
      }
      if (!pendingSummary) {
        yield* requireFamilyCapacity(
          run,
          inventory.candidates.length,
          options.maxTotalElapsedMillis,
          options.maxTotalOutputBytes
        );
      }
      yield* fs
        .makeDirectory(run.outputRoot, { recursive: true })
        .pipe(CorpusCommandError.mapError("Failed creating legacy-Word restoration output root."));
      yield* requireCanonicalContainedPath(run.outputRoot, run.outputRoot);
      yield* recoverInterruptedAttempts(run, legacyInterruptedAttemptRoots);
      const existingOutput = yield* hashTransformationTree(run.outputRoot);
      if (existingOutput.sizeBytes > options.maxTotalOutputBytes) {
        return yield* rejectFamilyPreflight(
          pendingSummary,
          run,
          inventory.candidates.length,
          options.maxTotalElapsedMillis,
          options.maxTotalOutputBytes,
          "Existing retained legacy-Word output already exceeds the approved cumulative output ceiling.",
          "Legacy-Word restoration refused to continue beyond its retained-output ceiling."
        );
      }

      const resume = yield* legacyResumeState(run, inventory.candidates, existingOutput.sizeBytes);
      const engineVersion = O.isSome(version) ? version.value.output : options.expectedConverterVersion;
      const counters = yield* runBoundedFamilyCandidates(
        resume.candidates,
        resume.counters,
        run.startedAt,
        options.maxTotalElapsedMillis,
        options.maxTotalOutputBytes,
        (candidate, outputBytes) =>
          processLegacyWordTerminal(candidate, engineVersion, run, options, run.startedAt, outputBytes)
      );
      return yield* finalizeFamilyRun(
        run,
        run.startedAt,
        inventory.occurrenceCount,
        counters,
        inventory.candidates.length,
        true,
        options.maxTotalElapsedMillis,
        options.maxTotalOutputBytes,
        "Legacy-Word terminals are incomplete or contain an unapproved exception or whole-family ceiling breach.",
        "Legacy-Word restoration failed its zero-unapproved-terminal acceptance gate."
      );
    })
  );
});

type FamilyAcceptance = Extract<
  TransformationLedgerRecord,
  { readonly recordType: "family-acceptance-failure" | "family-acceptance-pass" }
>;

type MailStorePass = Extract<TransformationLedgerRecord, { readonly recordType: "mail-store-pass" }>;
type MailStoreException = Extract<TransformationLedgerRecord, { readonly recordType: "mail-store-exception" }>;
type MailWarning = Extract<TransformationLedgerRecord, { readonly recordType: "mail-warning" }>;
type MailChildPass = Extract<TransformationLedgerRecord, { readonly recordType: "mail-child-pass" }>;
type AttachmentRepair = Extract<TransformationLedgerRecord, { readonly recordType: "attachment-type-repair" }>;

const isRecordType =
  <RecordType extends TransformationLedgerRecord["recordType"]>(recordType: RecordType) =>
  (
    record: TransformationLedgerRecord
  ): record is Extract<TransformationLedgerRecord, { readonly recordType: RecordType }> =>
    record.recordType === recordType;

const mailPassReconciles = (
  record: MailStorePass,
  children: ReadonlyArray<MailChildPass>,
  warnings: ReadonlyArray<MailWarning>
): boolean => {
  const childCount = A.filter(children, (child) => child.attemptId === record.attemptId).length;
  const engineChildCount = A.filter(
    children,
    (child) => child.attemptId === record.attemptId && child.engineReported
  ).length;
  const warningCount = A.filter(warnings, (warning) => warning.attemptId === record.attemptId).length;
  const relativePaths = MutableHashSet.fromIterable(
    A.map(
      A.filter(children, (child) => child.attemptId === record.attemptId),
      (child) => child.childRelativePath
    )
  );
  return (
    record.accountedChildCount === childCount &&
    record.childCount === engineChildCount &&
    childCount > 0 &&
    MutableHashSet.size(relativePaths) === childCount &&
    record.warningCount === 0 &&
    warningCount === 0
  );
};

const mailExceptionIsApproved = (record: MailStoreException): boolean =>
  record.approved && record.disposition !== undefined;

const safeAttemptId = (attemptId: string): boolean =>
  attemptId !== "." && attemptId !== ".." && !Str.includes("/")(attemptId) && !Str.includes("\\")(attemptId);

const attachmentRepairsReconcile = (
  repairs: ReadonlyArray<AttachmentRepair>,
  children: ReadonlyArray<MailChildPass>,
  owners: ReadonlyArray<AttemptTerminalBinding>
): boolean => {
  const identities = MutableHashSet.fromIterable(
    A.map(
      repairs,
      (repair) =>
        `${repair.attemptId}\u0000${repair.sourceObjectId}\u0000${repair.originalRelativePath}\u0000${repair.derivedRelativePath}`
    )
  );
  return (
    MutableHashSet.size(identities) === repairs.length &&
    A.every(repairs, (repair) => {
      if (
        !safeAttemptId(repair.attemptId) ||
        !A.some(owners, (owner) => owner.attemptId === repair.attemptId && owner.sourceId === repair.sourceObjectId)
      ) {
        return false;
      }
      if (repair.repairStatus !== "repaired") {
        return repair.derivedSha256 === undefined && repair.derivedSizeBytes === undefined;
      }
      if (repair.derivedSha256 === undefined || repair.derivedSizeBytes === undefined) return false;
      const copiedDerivative = A.some(
        children,
        (child) =>
          child.attemptId === repair.attemptId &&
          child.sourceObjectId === repair.sourceObjectId &&
          child.childRelativePath === repair.derivedRelativePath &&
          child.sha256 === repair.derivedSha256 &&
          Equal.equals(child.sizeBytes, repair.derivedSizeBytes) &&
          !child.engineReported
      );
      const tikaDerivative = A.some(
        children,
        (child) =>
          child.attemptId === repair.attemptId &&
          child.sourceObjectId === repair.sourceObjectId &&
          Str.endsWith(`${repair.derivedSha256}.tika.txt`)(child.childRelativePath) &&
          child.sizeBytes > 0 &&
          !child.engineReported
      );
      return copiedDerivative && tikaDerivative;
    })
  );
};

const mailTerminalIdentitiesReconcile = (terminals: ReadonlyArray<MailStorePass | MailStoreException>): boolean => {
  const attemptIds = A.map(terminals, (record) => record.attemptId);
  const objectIds = A.map(terminals, (record) => record.objectId);
  return (
    A.every(attemptIds, safeAttemptId) &&
    MutableHashSet.size(MutableHashSet.fromIterable(attemptIds)) === terminals.length &&
    MutableHashSet.size(MutableHashSet.fromIterable(objectIds)) === terminals.length
  );
};

const mailOwnedEvidenceReconciles = (
  passes: ReadonlyArray<MailStorePass>,
  exceptions: ReadonlyArray<MailStoreException>,
  interruptions: ReadonlyArray<FamilyAttemptInterrupted>,
  children: ReadonlyArray<MailChildPass>,
  warnings: ReadonlyArray<MailWarning>
): boolean => {
  const passAttemptIds = MutableHashSet.fromIterable(A.map(passes, (record) => record.attemptId));
  const exceptionAttemptIds = MutableHashSet.fromIterable(A.map(exceptions, (record) => record.attemptId));
  const interruptedAttemptIds = MutableHashSet.fromIterable(A.map(interruptions, (record) => record.attemptId));
  return (
    A.every(
      children,
      (child) =>
        MutableHashSet.has(passAttemptIds, child.attemptId) ||
        MutableHashSet.has(interruptedAttemptIds, child.attemptId)
    ) &&
    A.every(
      warnings,
      (warning) =>
        MutableHashSet.has(exceptionAttemptIds, warning.attemptId) ||
        MutableHashSet.has(interruptedAttemptIds, warning.attemptId)
    )
  );
};

const mailTerminalCountsReconcile = (
  summary: Pick<FamilyRunSummary, "exceptionCount" | "passCount">,
  passes: ReadonlyArray<MailStorePass>,
  exceptions: ReadonlyArray<MailStoreException>
): boolean => passes.length === summary.passCount && exceptions.length === summary.exceptionCount;

const mailSegmentReconciles = (
  summary: Pick<FamilyRunSummary, "exceptionCount" | "passCount">,
  records: ReadonlyArray<TransformationLedgerRecord>
): boolean => {
  const passes = A.filter(records, isRecordType("mail-store-pass"));
  const exceptions = A.filter(records, isRecordType("mail-store-exception"));
  const warnings = A.filter(records, isRecordType("mail-warning"));
  const children = A.filter(records, isRecordType("mail-child-pass"));
  const repairs = A.filter(records, isRecordType("attachment-type-repair"));
  const interruptions = A.filter(records, isRecordType("family-attempt-interrupted"));
  const terminals: ReadonlyArray<MailStorePass | MailStoreException> = A.appendAll(passes, exceptions);
  const owners: ReadonlyArray<AttemptTerminalBinding> = A.appendAll(
    A.map(terminals, (terminal) => ({ attemptId: terminal.attemptId, sourceId: terminal.objectId })),
    A.map(interruptions, (interrupted) => ({
      attemptId: interrupted.attemptId,
      sourceId: interrupted.sourceId,
    }))
  );
  return (
    A.every(passes, (record) => mailPassReconciles(record, children, warnings)) &&
    mailTerminalCountsReconcile(summary, passes, exceptions) &&
    A.every(exceptions, mailExceptionIsApproved) &&
    mailTerminalIdentitiesReconcile(terminals) &&
    mailOwnedEvidenceReconciles(passes, exceptions, interruptions, children, warnings) &&
    attachmentRepairsReconcile(repairs, children, owners)
  );
};

const recycleSegmentReconciles = (
  summary: FamilyRunSummary,
  records: ReadonlyArray<TransformationLedgerRecord>
): boolean => {
  const mappings = A.filter(records, isRecordType("recycle-mapping"));
  const joins = A.filter(records, isRecordType("recycle-join"));
  const joinCount = A.reduce(joins, 0, (total, record) => total + record.count);
  const joinedObjectIds = A.flatMap(
    joins,
    (join: Extract<TransformationLedgerRecord, { readonly recordType: "recycle-join" }>) => join.sourceObjectIds
  );
  const uniqueObjectIds = MutableHashSet.fromIterable(joinedObjectIds);
  const validObjectIds = MutableHashSet.fromIterable(
    A.flatMap(
      A.filter(joins, (join) => join.joinClass === "valid-pair"),
      (join: Extract<TransformationLedgerRecord, { readonly recordType: "recycle-join" }>) => join.sourceObjectIds
    )
  );
  const mappedObjectIds = A.flatMap(mappings, (mapping) => [mapping.metadataObjectId, mapping.contentObjectId]);
  const uniqueMappedObjectIds = MutableHashSet.fromIterable(mappedObjectIds);
  const restoredPaths = MutableHashSet.fromIterable(A.map(mappings, (mapping) => mapping.restoredRelativePath));
  return (
    mappings.length === summary.passCount &&
    joinCount - mappings.length === summary.exceptionCount &&
    joinedObjectIds.length === MutableHashSet.size(uniqueObjectIds) &&
    mappedObjectIds.length === MutableHashSet.size(uniqueMappedObjectIds) &&
    MutableHashSet.size(validObjectIds) === mappings.length * 2 &&
    MutableHashSet.size(uniqueMappedObjectIds) === MutableHashSet.size(validObjectIds) &&
    MutableHashSet.size(restoredPaths) === mappings.length &&
    A.every(joins, (join) =>
      join.joinClass === "valid-pair"
        ? join.sourceObjectIds.length === join.count * 2
        : join.sourceObjectIds.length === join.count
    ) &&
    A.every(
      mappings,
      (mapping) =>
        mapping.contentObjectId !== mapping.metadataObjectId &&
        MutableHashSet.has(validObjectIds, mapping.contentObjectId) &&
        MutableHashSet.has(validObjectIds, mapping.metadataObjectId)
    )
  );
};

const legacySegmentReconciles = (
  summary: Pick<FamilyRunSummary, "exceptionCount" | "passCount">,
  records: ReadonlyArray<TransformationLedgerRecord>
): boolean => {
  const passes = A.filter(records, isRecordType("legacy-word-pass"));
  const exceptions = A.filter(records, isRecordType("legacy-word-exception"));
  const terminalDigests = A.appendAll(
    A.map(passes, (record) => record.originalSha256),
    A.map(exceptions, (record) => record.originalSha256)
  );
  return (
    passes.length === summary.passCount &&
    exceptions.length === summary.exceptionCount &&
    A.every(exceptions, (record) => record.approved) &&
    MutableHashSet.size(MutableHashSet.fromIterable(terminalDigests)) === terminalDigests.length
  );
};

type AttemptTerminalBinding = { readonly attemptId: string; readonly sourceId: string };

const attemptTerminalBindings = (
  records: ReadonlyArray<TransformationLedgerRecord>
): ReadonlyArray<AttemptTerminalBinding> =>
  A.getSomes(
    A.map(records, (record) => {
      if (record.recordType === "mail-store-pass" || record.recordType === "mail-store-exception") {
        return O.some({ attemptId: record.attemptId, sourceId: record.objectId });
      }
      if (record.recordType === "recycle-mapping") {
        return O.some({ attemptId: record.attemptId, sourceId: record.contentObjectId });
      }
      if (record.recordType === "legacy-word-pass" || record.recordType === "legacy-word-exception") {
        return O.some({ attemptId: record.attemptId, sourceId: record.originalSha256 });
      }
      return O.none<AttemptTerminalBinding>();
    })
  );

const familyRunStartReconciles = (
  summary: FamilyRunSummary,
  records: ReadonlyArray<TransformationLedgerRecord>
): boolean => {
  const starts = A.filter(records, isRecordType("family-run-start"));
  return (
    starts.length === 1 &&
    records[0] === starts[0] &&
    starts[0]?.expectedCount === summary.sourceCount &&
    starts[0]?.maxTotalElapsedMillis === summary.maxTotalElapsedMillis &&
    starts[0].maxTotalOutputBytes === summary.maxTotalOutputBytes
  );
};

const attemptSettlementsReconcile = (
  starts: ReadonlyArray<FamilyAttemptStart>,
  interruptions: ReadonlyArray<FamilyAttemptInterrupted>,
  terminals: ReadonlyArray<AttemptTerminalBinding>
): boolean => {
  const startIds = MutableHashSet.fromIterable(A.map(starts, (start) => start.attemptId));
  const interruptedIds = MutableHashSet.fromIterable(A.map(interruptions, (record) => record.attemptId));
  const terminalIds = MutableHashSet.fromIterable(A.map(terminals, (terminal) => terminal.attemptId));
  const settlements = A.appendAll(
    A.map(interruptions, (record) => record.attemptId),
    A.map(terminals, (terminal) => terminal.attemptId)
  );
  return (
    MutableHashSet.size(startIds) === starts.length &&
    MutableHashSet.size(interruptedIds) === interruptions.length &&
    MutableHashSet.size(terminalIds) === terminals.length &&
    settlements.length === starts.length &&
    A.every(settlements, (attemptId) => MutableHashSet.has(startIds, attemptId)) &&
    MutableHashSet.size(MutableHashSet.fromIterable(settlements)) === settlements.length
  );
};

const attemptBindingsReconcile = (
  starts: ReadonlyArray<FamilyAttemptStart>,
  interruptions: ReadonlyArray<FamilyAttemptInterrupted>,
  terminals: ReadonlyArray<AttemptTerminalBinding>
): boolean => {
  const startFor = (attemptId: string): O.Option<FamilyAttemptStart> =>
    A.findFirst(starts, (start) => start.attemptId === attemptId);
  return (
    A.every(
      starts,
      (start) =>
        safeAttemptId(start.attemptId) &&
        start.attemptId === familyAttemptId(start.family, start.sourceId, start.retryOrdinal)
    ) &&
    A.every(terminals, (terminal) =>
      O.exists(startFor(terminal.attemptId), (start) => start.sourceId === terminal.sourceId)
    ) &&
    A.every(interruptions, (interrupted) =>
      O.exists(
        startFor(interrupted.attemptId),
        (start) => start.sourceId === interrupted.sourceId && start.retryOrdinal === interrupted.retryOrdinal
      )
    )
  );
};

const attemptRetryOrdinalsReconcile = (starts: ReadonlyArray<FamilyAttemptStart>): boolean => {
  const bySource = MutableHashMap.empty<string, Array<FamilyAttemptStart>>();
  for (const start of starts) {
    const sourceStarts = O.getOrElse(MutableHashMap.get(bySource, start.sourceId), (): Array<FamilyAttemptStart> => []);
    sourceStarts.push(start);
    MutableHashMap.set(bySource, start.sourceId, sourceStarts);
  }
  for (const sourceStarts of MutableHashMap.values(bySource)) {
    const ordinals = MutableHashSet.fromIterable(A.map(sourceStarts, (start) => start.retryOrdinal));
    if (
      MutableHashSet.size(ordinals) !== sourceStarts.length ||
      A.some(sourceStarts, (start, index) => start.retryOrdinal !== index)
    ) {
      return false;
    }
  }
  return true;
};

const latestAttemptsAreTerminal = (
  starts: ReadonlyArray<FamilyAttemptStart>,
  terminals: ReadonlyArray<AttemptTerminalBinding>
): boolean => {
  const terminalIds = MutableHashSet.fromIterable(A.map(terminals, (terminal) => terminal.attemptId));
  const latestBySource = MutableHashMap.empty<string, FamilyAttemptStart>();
  for (const start of starts) MutableHashMap.set(latestBySource, start.sourceId, start);
  for (const start of MutableHashMap.values(latestBySource)) {
    if (!MutableHashSet.has(terminalIds, start.attemptId)) return false;
  }
  return true;
};

const transformationAttemptLifecycleReconciles = (
  summary: FamilyRunSummary,
  records: ReadonlyArray<TransformationLedgerRecord>
): boolean => {
  const starts = A.filter(records, isRecordType("family-attempt-start"));
  const terminals = attemptTerminalBindings(records);
  return (
    familyRunStartReconciles(summary, records) &&
    resumableAttemptLifecycleReconciles(records) &&
    latestAttemptsAreTerminal(starts, terminals)
  );
};

const resumableAttemptLifecycleReconciles = (records: ReadonlyArray<TransformationLedgerRecord>): boolean => {
  const starts = A.filter(records, isRecordType("family-attempt-start"));
  const interruptions = A.filter(records, isRecordType("family-attempt-interrupted"));
  const terminals = attemptTerminalBindings(records);
  return (
    attemptSettlementsReconcile(starts, interruptions, terminals) &&
    attemptBindingsReconcile(starts, interruptions, terminals) &&
    attemptRetryOrdinalsReconcile(starts)
  );
};

const transformationSegmentReconciles = (
  family: TransformationFamily,
  summary: FamilyRunSummary,
  records: ReadonlyArray<TransformationLedgerRecord>
): boolean => {
  if (summary.unapprovedCount !== 0) return false;
  if (!transformationAttemptLifecycleReconciles(summary, records)) return false;
  if (family === "mail") return mailSegmentReconciles(summary, records);
  if (family === "recycle") return recycleSegmentReconciles(summary, records);
  return legacySegmentReconciles(summary, records);
};

type StrictFamilyEvidence = {
  readonly acceptance: FamilyAcceptance;
  readonly evidenceSha256: Sha256Hex;
  readonly segment: ReadonlyArray<TransformationLedgerRecord>;
  readonly summary: FamilyRunSummary;
};

const requireStrictFamilyTerminalRows = (
  context: TransformationRunContext,
  records: ReadonlyArray<TransformationLedgerRecord>
): Effect.Effect<{ readonly acceptance: FamilyAcceptance; readonly summary: FamilyRunSummary }, CorpusCommandError> => {
  const summary = records[records.length - 2];
  const acceptance = records[records.length - 1];
  if (
    summary?.recordType !== "family-run-summary" ||
    (acceptance?.recordType !== "family-acceptance-pass" && acceptance?.recordType !== "family-acceptance-failure")
  ) {
    return Effect.fail(
      transformationError(
        `${context.family} transformation ledger must end in exactly one summary and one acceptance row.`
      )
    );
  }
  return Effect.succeed({ acceptance, summary });
};

const requireStrictFamilySegment = (
  context: TransformationRunContext,
  records: ReadonlyArray<TransformationLedgerRecord>
): Effect.Effect<ReadonlyArray<TransformationLedgerRecord>, CorpusCommandError> => {
  const segment = A.dropRight(records, 2);
  const hasPriorTerminal = A.some(
    segment,
    (record) => record.recordType === "family-run-summary" || Str.startsWith("family-acceptance-")(record.recordType)
  );
  return hasPriorTerminal
    ? Effect.fail(transformationError(`${context.family} transformation ledger contains an unapproved prior run.`))
    : Effect.succeed(segment);
};

const strictEvidenceSha256 = (lines: ReadonlyArray<string>): Sha256Hex => {
  const joined = A.join(A.dropRight(lines, 2), "\n");
  return digestString(Str.isEmpty(joined) ? "" : `${joined}\n`);
};

const recordIdentityMatches = (record: TransformationLedgerRecord, context: TransformationRunContext): boolean =>
  record.family === context.family &&
  record.runLabel === context.runLabel &&
  record.preservationRunId === context.preservationRunId &&
  record.preservationSealSha256 === context.preservationSealSha256 &&
  record.transformationRunId === context.transformationRunId &&
  ("mailScope" in record ? record.mailScope : undefined) ===
    (context.family === "mail" ? O.getOrUndefined(context.mailScope) : undefined);

const readStrictFamilyEvidence = Effect.fn("CorpusRestoration.readStrictFamilyEvidence")(function* (
  context: TransformationRunContext
): Effect.fn.Return<StrictFamilyEvidence, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const decoded = yield* decodeTransformationLedger(context, false);
  if (decoded.lines.length < 2) {
    return yield* transformationError(`${context.family} transformation ledger has missing or blank evidence rows.`);
  }
  const terminal = yield* requireStrictFamilyTerminalRows(context, decoded.records);
  const segment = yield* requireStrictFamilySegment(context, decoded.records);
  return { ...terminal, evidenceSha256: strictEvidenceSha256(decoded.lines), segment };
});

const containedEvidencePath = (
  path: Path.Path,
  root: string,
  segments: ReadonlyArray<string>
): Effect.Effect<string, CorpusCommandError> => {
  const candidate = path.resolve(root, ...segments);
  const relative = path.relative(root, candidate);
  return relative === ".." || Str.startsWith(`..${path.sep}`)(relative) || path.isAbsolute(relative)
    ? Effect.fail(transformationError("Transformation evidence path escapes its immutable output root."))
    : Effect.succeed(candidate);
};

const mailAttemptRelativeRoots = (path: Path.Path, attemptId: string): readonly [string, string] => [
  path.join("attempts", `${attemptId}.partial`),
  path.join("attempts", attemptId),
];

const rehashMailExceptionOutputs = Effect.fn("CorpusRestoration.rehashMailExceptionOutputs")(function* (
  context: TransformationRunContext,
  exceptions: ReadonlyArray<MailStoreException>
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  for (const exception of exceptions) {
    const [partialRelativePath, finalRelativePath] = mailAttemptRelativeRoots(path, exception.attemptId);
    const retained = yield* retainedMailAttemptDigest(
      path.join(context.outputRoot, partialRelativePath),
      path.join(context.outputRoot, finalRelativePath)
    );
    if (retained.sha256 !== exception.retainedOutputSha256 || retained.sizeBytes !== exception.retainedOutputBytes) {
      return yield* transformationError("Retained mail exception output drifted from its terminal evidence.");
    }
  }
});

const relativePathIsUnder = (path: Path.Path, relativePath: string, roots: ReadonlyArray<string>): boolean =>
  A.some(roots, (root) => relativePath === root || Str.startsWith(`${root}${path.sep}`)(relativePath));

const recycleEntryTouchesOwnedRoot = (
  path: Path.Path,
  entry: WalkedTransformationEntry,
  roots: ReadonlyArray<string>
): boolean =>
  relativePathIsUnder(path, entry.relativePath, roots) ||
  (entry.kind === "directory" && A.some(roots, (root) => relativePathIsUnder(path, root, [entry.relativePath])));

const requireRecyclePhysicalEntriesOwned = Effect.fn("CorpusRestoration.requireRecyclePhysicalEntriesOwned")(function* (
  context: TransformationRunContext,
  mappings: ReadonlyArray<RecycleMapping>,
  interruptions: ReadonlyArray<FamilyAttemptInterrupted>
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const ownedRoots = A.appendAll(
    A.map(mappings, (mapping) => path.join("restored", mapping.restoredRelativePath)),
    A.map(interruptions, (record) => record.retainedOutputRelativePath)
  );
  const unowned = A.filter(
    yield* walkTransformationEntries(context.outputRoot),
    (entry) => entry.relativePath !== "restored" && !recycleEntryTouchesOwnedRoot(path, entry, ownedRoots)
  );
  if (unowned.length > 0) {
    return yield* transformationError(
      "Retained recycle output contains a physical entry not owned by terminal evidence."
    );
  }
});

const requireMailPhysicalFilesOwned = Effect.fn("CorpusRestoration.requireMailPhysicalFilesOwned")(function* (
  context: TransformationRunContext,
  records: ReadonlyArray<TransformationLedgerRecord>,
  interruptions: ReadonlyArray<FamilyAttemptInterrupted>,
  exceptions: ReadonlyArray<MailStoreException>
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const passAttemptIds = MutableHashSet.fromIterable(
    A.map(A.filter(records, isRecordType("mail-store-pass")), (record) => record.attemptId)
  );
  const expectedTerminalFiles = MutableHashSet.fromIterable(
    A.map(
      A.filter(A.filter(records, isRecordType("mail-child-pass")), (child) =>
        MutableHashSet.has(passAttemptIds, child.attemptId)
      ),
      (child) => path.join("attempts", child.attemptId, child.childRelativePath)
    )
  );
  const exceptionRoots = A.flatMap(exceptions, (record) => mailAttemptRelativeRoots(path, record.attemptId));
  const interruptedRoots = A.map(interruptions, (record) => record.retainedOutputRelativePath);
  const unownedPhysicalFiles = A.filter(
    yield* walkFiles(context.outputRoot),
    (file) =>
      !MutableHashSet.has(expectedTerminalFiles, file.relativePath) &&
      !relativePathIsUnder(path, file.relativePath, exceptionRoots) &&
      !relativePathIsUnder(path, file.relativePath, interruptedRoots)
  );
  if (unownedPhysicalFiles.length > 0) {
    return yield* transformationError("Retained mail output contains a physical file not owned by terminal evidence.");
  }
});

const rehashMailChildren = Effect.fn("CorpusRestoration.rehashMailChildren")(function* (
  context: TransformationRunContext,
  records: ReadonlyArray<TransformationLedgerRecord>,
  interruptions: ReadonlyArray<FamilyAttemptInterrupted>
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  for (const child of A.filter(records, isRecordType("mail-child-pass"))) {
    const interrupted = A.findFirst(interruptions, (record) => record.attemptId === child.attemptId);
    const childPath = yield* containedEvidencePath(
      path,
      context.outputRoot,
      O.isSome(interrupted)
        ? [interrupted.value.retainedOutputRelativePath, "final", child.childRelativePath]
        : ["attempts", child.attemptId, child.childRelativePath]
    );
    yield* requireCanonicalContainedPath(context.outputRoot, childPath);
    const digest = yield* hashRestorationFileStreaming(childPath, 1024 * 1024);
    if (digest.sha256 !== child.sha256 || digest.sizeBytes !== child.sizeBytes) {
      return yield* transformationError("Retained mail child bytes do not match their ledger evidence.");
    }
  }
});

const rehashMailOutputs = Effect.fn("CorpusRestoration.rehashMailOutputs")(function* (
  context: TransformationRunContext,
  records: ReadonlyArray<TransformationLedgerRecord>
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const interruptions = A.filter(records, isRecordType("family-attempt-interrupted"));
  const exceptions = A.filter(records, isRecordType("mail-store-exception"));
  yield* rehashMailExceptionOutputs(context, exceptions);
  yield* requireMailPhysicalFilesOwned(context, records, interruptions, exceptions);
  yield* rehashMailChildren(context, records, interruptions);
});

const rehashInterruptedOutputs = Effect.fn("CorpusRestoration.rehashInterruptedOutputs")(function* (
  context: TransformationRunContext,
  records: ReadonlyArray<TransformationLedgerRecord>
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  for (const interrupted of A.filter(records, isRecordType("family-attempt-interrupted"))) {
    const retainedRoot = yield* containedEvidencePath(path, context.outputRoot, [
      interrupted.retainedOutputRelativePath,
    ]);
    yield* requireCanonicalContainedPath(context.outputRoot, retainedRoot);
    const digest = yield* hashTransformationTree(retainedRoot);
    if (digest.sha256 !== interrupted.retainedOutputSha256 || digest.sizeBytes !== interrupted.retainedOutputBytes) {
      return yield* transformationError("Retained interrupted-attempt output drifted from its immutable evidence.");
    }
  }
});

const rehashRecycleOutputs = Effect.fn("CorpusRestoration.rehashRecycleOutputs")(function* (
  context: TransformationRunContext,
  records: ReadonlyArray<TransformationLedgerRecord>
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const mappings = A.filter(records, isRecordType("recycle-mapping"));
  yield* requireRecyclePhysicalEntriesOwned(
    context,
    mappings,
    A.filter(records, isRecordType("family-attempt-interrupted"))
  );
  for (const mapping of mappings) {
    const outputPath = yield* containedEvidencePath(path, context.outputRoot, [
      "restored",
      mapping.restoredRelativePath,
    ]);
    yield* requireCanonicalContainedPath(context.outputRoot, outputPath);
    const digest = yield* hashRecycleContent(outputPath);
    if (digest.sha256 !== mapping.digest) {
      return yield* transformationError("Retained recycle output does not match its mapping digest.");
    }
  }
});

const rehashLegacyOutputs = Effect.fn("CorpusRestoration.rehashLegacyOutputs")(function* (
  context: TransformationRunContext,
  records: ReadonlyArray<TransformationLedgerRecord>
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  for (const pass of A.filter(records, isRecordType("legacy-word-pass"))) {
    const outputPath = yield* containedEvidencePath(path, context.outputRoot, [
      "converted",
      `${pass.originalSha256}.docx`,
    ]);
    yield* requireCanonicalContainedPath(context.outputRoot, outputPath);
    const digest = yield* hashRestorationFileStreaming(outputPath, 1024 * 1024);
    if (digest.sha256 !== pass.convertedSha256) {
      return yield* transformationError("Retained legacy-Word output does not match its PASS digest.");
    }
  }
});

const rehashRetainedFamilyOutputs = Effect.fn("CorpusRestoration.rehashRetainedFamilyOutputs")(function* (
  context: TransformationRunContext,
  records: ReadonlyArray<TransformationLedgerRecord>
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  yield* rehashInterruptedOutputs(context, records);
  if (context.family === "mail") return yield* rehashMailOutputs(context, records);
  if (context.family === "recycle") return yield* rehashRecycleOutputs(context, records);
  return yield* rehashLegacyOutputs(context, records);
});

const readCanonicalAcceptance = Effect.fn("CorpusRestoration.readCanonicalAcceptance")(function* (
  directory: string,
  filePath: string,
  description: string
): Effect.fn.Return<string, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  yield* requireCanonicalContainedPath(directory, filePath);
  const info = yield* fs.stat(filePath).pipe(CorpusCommandError.mapError(`Failed inspecting ${description}.`));
  if (info.type !== "File") return yield* transformationError(`${description} is not a canonical regular file.`);
  const text = yield* fs.readFileString(filePath).pipe(CorpusCommandError.mapError(`Failed reading ${description}.`));
  yield* requireCanonicalContainedPath(directory, filePath);
  const decoded = yield* decodeRestorationAcceptanceRecordJson(Str.trim(text)).pipe(
    CorpusCommandError.mapError(`${description} failed decoding.`)
  );
  return yield* encodeRestorationAcceptanceRecordJson(decoded).pipe(
    CorpusCommandError.mapError(`${description} failed canonical encoding.`)
  );
});

const publishAcceptancePartial = Effect.fn("CorpusRestoration.publishAcceptancePartial")(function* (
  directory: string,
  partialPath: string,
  destinationPath: string
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  yield* requireCanonicalContainedPath(directory, partialPath);
  yield* fs
    .link(partialPath, destinationPath)
    .pipe(CorpusCommandError.mapError("Failed exclusively publishing the immutable family acceptance record."));
  yield* syncRestorationDirectory(directory);
  yield* requireCanonicalContainedPath(directory, destinationPath);
  yield* fs
    .remove(partialPath)
    .pipe(CorpusCommandError.mapError("Failed removing the published family acceptance staging link."));
  yield* syncRestorationDirectory(directory);
});

const removeMatchingAcceptancePartial = Effect.fn("CorpusRestoration.removeMatchingAcceptancePartial")(function* (
  directory: string,
  partialPath: string,
  encoded: string
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const partialExists = yield* fs
    .exists(partialPath)
    .pipe(CorpusCommandError.mapError("Failed checking stale partial acceptance publication."));
  if (!partialExists) return;
  const partial = yield* readCanonicalAcceptance(directory, partialPath, "Stale partial family acceptance record");
  if (partial !== encoded) {
    return yield* transformationError("Stale partial immutable family acceptance conflicts with published evidence.");
  }
  yield* fs
    .remove(partialPath)
    .pipe(CorpusCommandError.mapError("Failed removing stale matching acceptance publication link."));
  yield* syncRestorationDirectory(directory);
});

const writeAcceptanceRecord = Effect.fn("CorpusRestoration.writeAcceptanceRecord")(function* (
  corpusRoot: string,
  runLabel: string,
  record: RestorationAcceptanceRecord
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(corpusRoot, "staging", "restoration", "runs", runLabel, "acceptance");
  const destinationPath = path.join(directory, `${record.family}.json`);
  const partialPath = `${destinationPath}.partial`;
  yield* fs
    .makeDirectory(directory, { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating the immutable family acceptance directory."));
  yield* requireCanonicalContainedPath(directory, directory);
  const encoded = yield* encodeRestorationAcceptanceRecordJson(record).pipe(
    CorpusCommandError.mapError("Family acceptance record failed JSON encoding.")
  );
  const destinationExists = yield* fs
    .exists(destinationPath)
    .pipe(CorpusCommandError.mapError("Failed checking acceptance destination."));
  if (destinationExists) {
    const canonical = yield* readCanonicalAcceptance(directory, destinationPath, "Existing family acceptance record");
    if (canonical === encoded) {
      yield* removeMatchingAcceptancePartial(directory, partialPath, encoded);
      return;
    }
    return yield* transformationError("Existing immutable family acceptance conflicts with reconciled evidence.");
  }
  const partialExists = yield* fs
    .exists(partialPath)
    .pipe(CorpusCommandError.mapError("Failed checking partial acceptance destination."));
  if (partialExists) {
    const canonical = yield* readCanonicalAcceptance(directory, partialPath, "Partial family acceptance record");
    if (canonical !== encoded) {
      return yield* transformationError("Partial immutable family acceptance conflicts with reconciled evidence.");
    }
    yield* publishAcceptancePartial(directory, partialPath, destinationPath);
    return;
  }
  yield* appendRestorationTextDurably(partialPath, `${encoded}\n`);
  yield* publishAcceptancePartial(directory, partialPath, destinationPath);
});

const familyEvidenceDigestsMatch = (evidence: StrictFamilyEvidence, outputTree: TransformationTreeDigest): boolean =>
  evidence.acceptance.evidenceSha256 === evidence.evidenceSha256 &&
  evidence.acceptance.outputTreeSha256 === outputTree.sha256 &&
  evidence.summary.outputTreeSha256 === outputTree.sha256 &&
  evidence.summary.outputBytes === outputTree.sizeBytes;

const familyEvidenceCeilingsMatch = (evidence: StrictFamilyEvidence): boolean =>
  evidence.summary.elapsedMillis <= evidence.summary.maxTotalElapsedMillis &&
  evidence.summary.outputBytes <= evidence.summary.maxTotalOutputBytes &&
  evidence.acceptance.maxTotalElapsedMillis === evidence.summary.maxTotalElapsedMillis &&
  evidence.acceptance.maxTotalOutputBytes === evidence.summary.maxTotalOutputBytes;

const familyEvidenceTerminalsMatch = (evidence: StrictFamilyEvidence): boolean => {
  const terminalCount = evidence.summary.passCount + evidence.summary.exceptionCount;
  return (
    evidence.acceptance.unapprovedCount === 0 &&
    evidence.acceptance.expectedCount === evidence.acceptance.terminalCount &&
    evidence.acceptance.terminalCount === terminalCount
  );
};

const familyEvidenceAccepted = (
  context: TransformationRunContext,
  evidence: StrictFamilyEvidence,
  outputTree: TransformationTreeDigest
): boolean =>
  evidence.acceptance.recordType === "family-acceptance-pass" &&
  familyEvidenceDigestsMatch(evidence, outputTree) &&
  familyEvidenceCeilingsMatch(evidence) &&
  familyEvidenceTerminalsMatch(evidence) &&
  transformationSegmentReconciles(context.family, evidence.summary, evidence.segment);

/**
 * Test-only semantic probes for restoration evidence invariants.
 *
 * @category testing
 */
export const restorationTransformationTesting = {
  addFamilyTerminal,
  appendAttachmentRepair,
  appendFamilyAttemptStart,
  appendRecycleJoins,
  applyFamilyCeiling,
  attachmentRepairsReconcile,
  attemptBindingsReconcile,
  attemptRetryOrdinalsReconcile,
  attemptSettlementsReconcile,
  attemptTerminalBindings,
  classifyMailError,
  classifyMailFailure,
  collisionAllocatedPath,
  combineMailAttemptOutputDigests,
  completePendingFamilySummary,
  contextFromFamilyStart,
  currentLedgerDigest,
  currentPreservationEvidence,
  deterministicPreservationElapsed,
  digestString,
  emptyFamilyCounters,
  emptyMailAttemptOutputDigest,
  exclusiveCopyDirectory,
  exclusiveCopyFile,
  extractAttachmentText,
  familyAttemptId,
  familyEvidenceAccepted,
  familyEvidenceCeilingsMatch,
  familyEvidenceDigestsMatch,
  familyEvidenceTerminalsMatch,
  familyRunStartReconciles,
  familyRunStartMatches,
  familyStartStateIsResumable,
  familySummaryStateIsResumable,
  familyElapsedMillis,
  finishPstAttempt,
  groupRecycleEntries,
  hashTransformationTree,
  isCompoundFileBinary,
  latestAttemptsAreTerminal,
  legacyFidelityPasses,
  legacyFailureTerminal,
  legacyInterruptedAttemptRoots,
  legacyOutputWatchdog,
  legacyResumeState,
  legacySegmentReconciles,
  legacyWordCandidates,
  mailAttemptRelativeRoots,
  mailCandidates,
  mailExceptionIsApproved,
  mailResumeState,
  mailOwnedEvidenceReconciles,
  mailPassReconciles,
  mailSegmentReconciles,
  mailTerminalCountsReconcile,
  mailTerminalIdentitiesReconcile,
  materializeAttachmentRepair,
  maximumPageRmse,
  measureTransformationTreeBytes,
  makeLegacyWorkRoot,
  nonNegative,
  parseNormalizedRmse,
  pdfPageCount,
  processLegacyWordCandidate,
  processLegacyWordTerminal,
  processMailCandidate,
  processPstCandidate,
  promoteLegacyWordOutput,
  persistAttachmentText,
  quarantineDisposition,
  recordIdentityMatches,
  recycleCheckpointOrderValid,
  recycleEntries,
  recycleJoinClasses,
  recycleJoinCheckpointMatches,
  recycleMissingContentCount,
  recycleMappingIdentityMatches,
  recyclePair,
  recycleSegmentReconciles,
  recycleSurfaceCounts,
  recycleSurfaceKey,
  recycleResumeState,
  recycleRetainedCheckpointMatches,
  readCanonicalAcceptance,
  readPrefix,
  relativePathIsUnder,
  removeMatchingAcceptancePartial,
  renderPdfPages,
  repairAttachment,
  repairDetectedAttachment,
  requireCanonicalContainedPath,
  requireMailPhysicalFilesOwned,
  requireRecycleCopyCapacity,
  requireRecyclePhysicalEntriesOwned,
  requireAttachmentCapacity,
  requireStrictFamilySegment,
  requireStrictFamilyTerminalRows,
  residueRootFor,
  rejectFamilyPreflight,
  requireMailScope,
  resumableFamilyStart,
  resumeFamilyCandidates,
  restoreRecyclePair,
  runSandboxedConversion,
  runLegacyStep,
  resumableAttemptLifecycleReconciles,
  safeAttemptId,
  safeRestoredPath,
  sandboxBaseArgs,
  sandboxRuntimeBinds,
  sandboxedTool,
  selectMailCandidates,
  signatureExtension,
  sourceExtension,
  sortedRecycleGroups,
  sortedRecyclePairs,
  strictEvidenceSha256,
  syncTree,
  terminalAttemptIds,
  transformationLinesSha256,
  transformationPolicySha256,
  transformationAttemptLifecycleReconciles,
  transformationSegmentReconciles,
  unsettledAttemptStarts,
  validateRecycleMappingCheckpoint,
  validateRecycleMappingPrefix,
  walkFiles,
  walkTransformationEntries,
  writeAcceptanceRecord,
  comparePageRmse,
  copyRecycleContent,
  hashPreservedRecycleContent,
  hashRecycleContent,
  normalizedTikaText,
  pstEngineChildMatches,
  pstEngineChildrenReconcile,
  readRecycleMetadata,
  readStrictFamilyEvidence,
  recoverRecycleInterruptedAttempts,
  rehashInterruptedOutputs,
  rehashLegacyOutputs,
  rehashMailChildren,
  rehashMailExceptionOutputs,
  rehashRetainedFamilyOutputs,
  rehashRecycleOutputs,
  retainInterruptedAttempt,
  recycleGroupSourceObjectIds,
} as const;

const reconcileTransformationAcceptance = Effect.fn("CorpusRestoration.reconcileTransformationAcceptance")(function* (
  context: TransformationRunContext
): Effect.fn.Return<RestorationAcceptanceRecord, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const evidence = yield* readStrictFamilyEvidence(context);
  const outputTree = yield* hashTransformationTree(context.outputRoot);
  if (!familyEvidenceAccepted(context, evidence, outputTree)) {
    return yield* transformationError(
      `Final ${context.family} acceptance evidence is missing, incomplete, stale, over ceiling, or unapproved.`
    );
  }
  yield* rehashRetainedFamilyOutputs(context, evidence.segment);
  return RestorationAcceptanceRecord.make({
    ...optionalMailScopeFields(context),
    elapsedMillis: evidence.summary.elapsedMillis,
    evidenceSha256: evidence.evidenceSha256,
    exceptionCount: evidence.summary.exceptionCount,
    expectedTerminalCount: evidence.acceptance.expectedCount,
    family: context.family,
    inputBytes: evidence.summary.inputBytes,
    outputBytes: evidence.summary.outputBytes,
    outputTreeSha256: outputTree.sha256,
    passCount: evidence.summary.passCount,
    preservationRunId: context.preservationRunId,
    preservationSealSha256: context.preservationSealSha256,
    recordedAt: evidence.acceptance.recordedAt,
    runLabel: context.runLabel,
    schemaVersion,
    sourceCount: evidence.summary.sourceCount,
    status: "pass",
    terminalCount: evidence.acceptance.terminalCount,
    transformationRunId: context.transformationRunId,
    unapprovedCount: 0,
  });
});

const reconcileAcceptanceUnderClaim = Effect.fn("CorpusRestoration.reconcileAcceptanceUnderClaim")(function* (
  corpusRoot: string,
  runLabel: string,
  mail: TransformationRunContext
): Effect.fn.Return<ReadonlyArray<RestorationAcceptanceRecord>, CorpusCommandError, TransformationRequirements> {
  const path = yield* Path.Path;
  const preservation = yield* verifyRestorationArchiveImpl({ corpusRoot, runLabel });
  const preservationEvidence = yield* currentPreservationEvidence(corpusRoot, runLabel);
  const preservationOutputTree = yield* hashTransformationTree(path.join(corpusRoot, "raw", runLabel, "payload"));
  const preservationElapsedMillis = yield* deterministicPreservationElapsed(
    preservationEvidence.records,
    preservationEvidence.seal
  );
  const acceptances: Array<RestorationAcceptanceRecord> = [
    RestorationAcceptanceRecord.make({
      elapsedMillis: preservationElapsedMillis,
      evidenceSha256: preservationEvidence.seal.manifestSha256,
      exceptionCount: preservation.exceptionCount,
      expectedTerminalCount: preservation.sourceCount,
      family: "preservation",
      inputBytes: preservation.inputBytes,
      outputBytes: preservation.outputBytes,
      outputTreeSha256: preservationOutputTree.sha256,
      passCount: preservation.passCount,
      preservationRunId: preservationEvidence.seal.runId,
      preservationSealSha256: preservationEvidence.seal.manifestSha256,
      recordedAt: preservationEvidence.seal.recordedAt,
      runLabel,
      schemaVersion,
      sourceCount: preservation.sourceCount,
      status: "pass",
      terminalCount: preservation.passCount,
      unapprovedCount: 0,
    }),
  ];
  const recycle = yield* prepareTransformationRun(corpusRoot, runLabel, "recycle", "full");
  const legacyWord = yield* prepareTransformationRun(corpusRoot, runLabel, "legacy-word", "full");
  acceptances.push(yield* reconcileTransformationAcceptance(mail));
  acceptances.push(yield* reconcileTransformationAcceptance(recycle));
  acceptances.push(yield* reconcileTransformationAcceptance(legacyWord));
  for (const acceptance of acceptances) yield* writeAcceptanceRecord(corpusRoot, runLabel, acceptance);
  return acceptances;
});

/**
 * Independently reconcile preservation and all transformation ledgers into four separate immutable acceptance records.
 *
 * @param corpusRoot - Governed corpus home outside the public repository.
 * @param runLabel - Immutable preservation run label used by every transformation family.
 * @returns The four separate PASS records after terminal, child, warning, join, and exception reconciliation.
 * @effects Re-verifies P0, schema-decodes the transformation ledger, writes one atomically promoted acceptance JSON file per family, and refuses any incomplete or unapproved terminal state.
 * @category use-cases
 * @since 0.0.0
 */
export const reconcileRestorationAcceptanceImpl = Effect.fn("CorpusRestoration.reconcileAcceptance")(function* (
  corpusRoot: string,
  runLabel: string
): Effect.fn.Return<ReadonlyArray<RestorationAcceptanceRecord>, CorpusCommandError, TransformationRequirements> {
  const mail = yield* prepareTransformationRun(corpusRoot, runLabel, "mail", "full");
  return yield* withTransformationRunWriter(
    mail,
    "acceptance.claim",
    reconcileAcceptanceUnderClaim(corpusRoot, runLabel, mail)
  );
});
