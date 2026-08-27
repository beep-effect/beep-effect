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
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { DateTime, Effect, FileSystem, Order, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { OutputBound, runCaptured } from "../../../internal/process/StepExec.ts";
import { CorpusCommandError } from "../Corpus.errors.ts";
import { classifyRecycleBinName, parseRecycleBinMetadata } from "../Corpus.recyclebin.ts";
import {
  decodeArchiveLedgerRecordJson,
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
  syncRestorationDirectory,
  verifyRestorationArchiveImpl,
} from "./Restoration.ts";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type {
  ArchiveLedgerRecord,
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

type MailCandidate = {
  readonly family: "eml" | "msg" | "ost" | "pst" | "residue";
  readonly objectId: string;
  readonly pass: O.Option<PreservedFilePass>;
  readonly sourcePath: string;
};

type WalkedTransformationFile = {
  readonly absolutePath: string;
  readonly relativePath: string;
};

type TransformationRunPaths = {
  readonly archiveRoot: string;
  readonly ledgerPath: string;
  readonly outputRoot: string;
  readonly startedAt: number;
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
  family: "legacy-word" | "mail" | "recycle"
): Effect.fn.Return<TransformationRunPaths, CorpusCommandError, TransformationRequirements> {
  yield* verifyRestorationArchiveImpl({ corpusRoot, runLabel });
  const path = yield* Path.Path;
  return {
    archiveRoot: path.join(corpusRoot, "raw", runLabel),
    ledgerPath: path.join(corpusRoot, "staging", "restoration", "transformation-ledger.jsonl"),
    outputRoot: path.join(corpusRoot, "staging", "restoration", family),
    startedAt: DateTime.toEpochMillis(yield* DateTime.now),
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

const currentPreservationRecords = Effect.fn("CorpusRestoration.currentPreservationRecords")(function* (
  corpusRoot: string,
  runLabel: string
): Effect.fn.Return<ReadonlyArray<ArchiveLedgerRecord>, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
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
  return A.filter(records, (record) => record.runId === seal.runId);
});

const walkFiles = Effect.fn("CorpusRestoration.walkTransformationFiles")(function* (
  root: string
): Effect.fn.Return<ReadonlyArray<WalkedTransformationFile>, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files: Array<WalkedTransformationFile> = [];
  const walkAt: (directory: string) => Effect.Effect<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> =
    Effect.fn("CorpusRestoration.walkTransformationFiles.walkAt")(function* (directory) {
      const names = yield* fs
        .readDirectory(directory)
        .pipe(CorpusCommandError.mapError("Failed walking transformation output."));
      for (const name of A.sort(names, Order.String)) {
        const absolutePath = path.join(directory, name);
        const info = yield* fs
          .stat(absolutePath)
          .pipe(CorpusCommandError.mapError("Failed inspecting transformation output."));
        if (info.type === "Directory") {
          yield* walkAt(absolutePath);
          continue;
        }
        if (info.type !== "File") {
          return yield* transformationError("Transformation output contains an unsupported non-file object.");
        }
        files.push({ absolutePath, relativePath: path.relative(root, absolutePath) });
      }
    });
  yield* walkAt(root);
  return files;
});

const syncTree = Effect.fn("CorpusRestoration.syncTransformationTree")(function* (
  root: string
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = yield* walkFiles(root);
  const directories = new Set<string>([root]);
  for (const file of files) {
    yield* Effect.scoped(
      fs.open(file.absolutePath, { flag: "r" }).pipe(
        Effect.flatMap((handle) => handle.sync),
        CorpusCommandError.mapError("Failed syncing transformation output file.")
      )
    );
    let directory = path.dirname(file.absolutePath);
    while (directory.startsWith(root)) {
      directories.add(directory);
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

const collectResidueRoot = (roots: Map<string, string>, record: ArchiveLedgerRecord): void => {
  if (record.recordType !== "archive-file-pass") return;
  O.map(residueRootFor(record.sourceRelativePath), (root) => {
    if (!roots.has(root)) roots.set(root, record.objectId);
  });
};

const mailResidueCandidates = (
  path: Path.Path,
  archiveRoot: string,
  records: ReadonlyArray<ArchiveLedgerRecord>
): ReadonlyArray<MailCandidate> => {
  const roots = new Map<string, string>();
  for (const record of records) collectResidueRoot(roots, record);
  return A.map(A.fromIterable(roots), ([relativePath, objectId]) => ({
    family: "residue" as const,
    objectId,
    pass: O.none(),
    sourcePath: path.join(archiveRoot, "payload", "tree", relativePath),
  }));
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
    (candidate) =>
      candidate.family === "pst" &&
      O.exists(
        candidate.pass,
        (pass) =>
          pass.sizeBytes >= 1024 * 1024 &&
          (Str.includes("$Recycle.Bin")(pass.sourceRelativePath) ||
            Str.startsWith("$R")(path.basename(pass.sourceRelativePath)))
      )
  );
  return A.take(
    A.sort(
      eligible,
      Order.mapInput(Order.Number, (candidate: MailCandidate) =>
        O.getOrElse(
          O.map(candidate.pass, (pass) => pass.sizeBytes),
          () => 0
        )
      )
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
  if (isFileProcessingOperationError(error) && error.details !== undefined) {
    const classification = error.details.processClassification;
    if (classification === "codepage" || classification === "corrupt" || classification === "password") {
      return classification;
    }
  }
  return classifyMailFailure(String(error));
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
  ledgerPath: string,
  objectId: string,
  originalRelativePath: string,
  detectedExtension: string,
  derivedRelativePath: string,
  repairStatus: "repaired" | "unchanged" | "unsupported"
) {
  yield* appendTransformationRecord(
    ledgerPath,
    TransformationLedgerRecord.cases["attachment-type-repair"].make({
      detectedExtension,
      derivedRelativePath,
      originalRelativePath,
      recordType: "attachment-type-repair",
      repairStatus,
      sourceObjectId: objectId,
    })
  );
});

const repairAttachment = Effect.fn("CorpusRestoration.repairAttachment")(function* (
  file: WalkedTransformationFile,
  attemptRoot: string,
  attemptId: string,
  objectId: string,
  options: RestorationMailOptions,
  ledgerPath: string
): Effect.fn.Return<number, CorpusCommandError, TransformationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const detected = signatureExtension(yield* readPrefix(file.absolutePath));
  if (O.isNone(detected)) {
    yield* appendAttachmentRepair(ledgerPath, objectId, file.relativePath, "unknown", file.relativePath, "unsupported");
    return 0;
  }
  if (sourceExtension(path, file.relativePath) === detected.value) {
    yield* appendAttachmentRepair(
      ledgerPath,
      objectId,
      file.relativePath,
      detected.value,
      file.relativePath,
      "unchanged"
    );
    return 0;
  }
  const digest = yield* hashRestorationFileStreaming(file.absolutePath, 1024 * 1024);
  const derivedRelativePath = path.join("derived", "attachment-repairs", `${digest.sha256}.${detected.value}`);
  const derivedPath = path.join(attemptRoot, derivedRelativePath);
  yield* fs
    .makeDirectory(path.dirname(derivedPath), { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating attachment-repair output directory."));
  yield* fs
    .copyFile(file.absolutePath, derivedPath)
    .pipe(CorpusCommandError.mapError("Failed materializing non-destructive attachment repair."));
  const probe = yield* runCaptured({
    args: ["-jar", options.tikaJarPath, "-J", "-t", derivedPath],
    bound: attachmentProbeOutputBound,
    command: options.javaPath,
    forceKillAfter: "1 second",
    source: "stdout",
    timeout: options.maxElapsedMillis,
    trim: true,
  }).pipe(CorpusCommandError.mapError("Attachment repair second-pass Tika invocation failed."));
  if (probe.exitCode !== 0 || probe.truncated) {
    return yield* transformationError(`Attachment repair second pass failed for attempt ${attemptId}.`);
  }
  yield* appendAttachmentRepair(
    ledgerPath,
    objectId,
    file.relativePath,
    detected.value,
    derivedRelativePath,
    "repaired"
  );
  return 1;
});

const repairAttachments = Effect.fn("CorpusRestoration.repairAttachments")(function* (
  attemptRoot: string,
  attemptId: string,
  objectId: string,
  options: RestorationMailOptions,
  ledgerPath: string
): Effect.fn.Return<number, CorpusCommandError, TransformationRequirements> {
  const files = A.filter(yield* walkFiles(attemptRoot), (file) => Str.includes("Attachment")(file.relativePath));
  const repaired = yield* Effect.forEach(
    files,
    (file) => repairAttachment(file, attemptRoot, attemptId, objectId, options, ledgerPath),
    { concurrency: 1 }
  );
  return A.reduce(repaired, 0, (total, count) => total + count);
});

const processPstCandidate = Effect.fn("CorpusRestoration.processPstCandidate")(function* (
  candidate: MailCandidate,
  options: RestorationMailOptions,
  outputRoot: string,
  ledgerPath: string,
  remainingOutputBytes: number
): Effect.fn.Return<
  { readonly inputBytes: number; readonly outputBytes: number; readonly passed: boolean; readonly unapproved: boolean },
  CorpusCommandError,
  TransformationRequirements
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const pass = O.getOrElse(candidate.pass, () => undefined);
  if (pass === undefined) {
    return { inputBytes: 0, outputBytes: 0, passed: false, unapproved: true };
  }
  const startedAt = DateTime.toEpochMillis(yield* DateTime.now);
  const attemptId = `${candidate.objectId}:${startedAt}`;
  const partialRoot = path.join(outputRoot, "attempts", `${attemptId}.partial`);
  const finalRoot = path.join(outputRoot, "attempts", attemptId);
  const appendException = Effect.fn("CorpusRestoration.appendMailException")(function* (
    exceptionKind: "codepage" | "corrupt" | "engine-failure" | "password",
    message: string
  ) {
    yield* appendTransformationRecord(
      ledgerPath,
      TransformationLedgerRecord.cases["mail-store-exception"].make({
        approved: false,
        attemptId,
        exceptionKind,
        message,
        objectId: candidate.objectId,
        recordType: "mail-store-exception",
        sourceFamily: "pst",
      })
    );
  });

  return yield* Effect.gen(function* () {
    if (remainingOutputBytes <= 0) {
      yield* appendException("engine-failure", "Mail attempt has no remaining approved cumulative output budget.");
      return { inputBytes: pass.sizeBytes, outputBytes: 0, passed: false, unapproved: true };
    }
    const artifactId = yield* S.decodeEffect(ArtifactId)(`artifact:${pass.sha256}`);
    const digest = yield* S.decodeEffect(ContentDigest)(`sha256:${pass.sha256}`);
    const operationId = yield* S.decodeEffect(OperationId)(`operation:${pass.sha256}`);
    const locatorValue = yield* S.decodeEffect(PosixPath)(candidate.sourcePath);
    const relativePath = yield* S.decodeEffect(PosixPath)("mail-store.pst");
    const source = SourceArtifact.make({
      digest,
      extension: "pst",
      id: artifactId,
      locator: ArtifactLocator.make({ kind: "file", value: locatorValue }),
      name: "mail-store.pst",
      relativePath,
      sizeBytes: pass.sizeBytes,
    });
    const engine = yield* makePffexportFileProcessingEngine(
      PffexportEngineConfig.make({
        existingExportPolicy: "fail",
        exportFormat: "all",
        exportMode: "all",
        exportRoot: partialRoot,
        pffexportPath: options.pffexportPath,
        ...(options.maxElapsedMillis > 0 ? { timeoutMillis: O.some(PosInt.make(options.maxElapsedMillis)) } : {}),
      })
    );
    const result = yield* engine.exportArchive(
      ExportArchiveOperation.make({
        format: "pst",
        maxMaterializedBytes: Math.min(pass.sizeBytes * options.maxAmplificationRatio, remainingOutputBytes),
        operationId,
        operationKind: "export-archive",
        preference: { engine: "libpff" },
        source,
      })
    );
    for (const warning of result.warnings) {
      yield* appendTransformationRecord(
        ledgerPath,
        TransformationLedgerRecord.cases["mail-warning"].make({
          attemptId,
          message: warning,
          objectId: candidate.objectId,
          recordType: "mail-warning",
        })
      );
    }
    yield* repairAttachments(partialRoot, attemptId, candidate.objectId, options, ledgerPath);
    const files = yield* walkFiles(partialRoot);
    let outputBytes = 0;
    for (const file of files) {
      const child = yield* hashRestorationFileStreaming(file.absolutePath, 1024 * 1024);
      outputBytes += child.sizeBytes;
      yield* appendTransformationRecord(
        ledgerPath,
        TransformationLedgerRecord.cases["mail-child-pass"].make({
          attemptId,
          childRelativePath: file.relativePath,
          recordType: "mail-child-pass",
          sha256: child.sha256,
          sizeBytes: nonNegative(child.sizeBytes),
          sourceObjectId: candidate.objectId,
        })
      );
    }
    const elapsedMillis = DateTime.toEpochMillis(yield* DateTime.now) - startedAt;
    if (
      elapsedMillis > options.maxElapsedMillis ||
      outputBytes > pass.sizeBytes * options.maxAmplificationRatio ||
      outputBytes > remainingOutputBytes
    ) {
      yield* appendException(
        "engine-failure",
        "Mail attempt exceeded its approved elapsed-time or disk-amplification ceiling."
      );
      return { inputBytes: pass.sizeBytes, outputBytes, passed: false, unapproved: true };
    }
    yield* syncTree(partialRoot);
    yield* fs
      .makeDirectory(path.dirname(finalRoot), { recursive: true })
      .pipe(CorpusCommandError.mapError("Failed creating mail-attempt promotion directory."));
    yield* fs
      .rename(partialRoot, finalRoot)
      .pipe(CorpusCommandError.mapError("Failed atomically promoting mail restoration attempt."));
    yield* syncRestorationDirectory(path.dirname(finalRoot));
    yield* appendTransformationRecord(
      ledgerPath,
      TransformationLedgerRecord.cases["mail-store-pass"].make({
        accountedChildCount: nonNegative(files.length),
        attemptId,
        childCount: nonNegative(files.length),
        elapsedMillis: nonNegative(elapsedMillis),
        inputBytes: pass.sizeBytes,
        objectId: candidate.objectId,
        outputBytes: nonNegative(outputBytes),
        recordType: "mail-store-pass",
        sha256: pass.sha256,
        warningCount: nonNegative(result.warnings.length),
      })
    );
    return { inputBytes: pass.sizeBytes, outputBytes, passed: true, unapproved: false };
  }).pipe(
    Effect.catch((error) =>
      appendException(classifyMailError(error), "Mail engine failed; raw attempt output was retained.").pipe(
        Effect.as({ inputBytes: pass.sizeBytes, outputBytes: 0, passed: false, unapproved: true } as const)
      )
    )
  );
});

type TransformationFamily = "legacy-word" | "mail" | "recycle";

const denyFamilyPreflight = Effect.fn("CorpusRestoration.denyFamilyPreflight")(function* (
  ledgerPath: string,
  family: TransformationFamily,
  expectedCount: number,
  message: string,
  errorMessage: string
): Effect.fn.Return<never, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  yield* appendTransformationRecord(
    ledgerPath,
    TransformationLedgerRecord.cases["family-acceptance-failure"].make({
      expectedCount: nonNegative(expectedCount),
      family,
      message,
      recordType: "family-acceptance-failure",
      terminalCount: nonNegative(0),
      unapprovedCount: nonNegative(1),
    })
  );
  return yield* transformationError(errorMessage);
});

const requireFamilyCapacity = Effect.fn("CorpusRestoration.requireFamilyCapacity")(function* (
  corpusRoot: string,
  ledgerPath: string,
  family: TransformationFamily,
  expectedCount: number,
  maxTotalElapsedMillis: number,
  maxTotalOutputBytes: number
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  if (maxTotalElapsedMillis <= 0 || maxTotalOutputBytes <= 0) {
    return yield* denyFamilyPreflight(
      ledgerPath,
      family,
      expectedCount,
      "The approved whole-family elapsed-time or retained-output ceiling is not positive.",
      `${family} restoration requires positive whole-family ceilings.`
    );
  }
  const availableBytes = yield* availableRestorationBytesAt(corpusRoot);
  if (availableBytes < maxTotalOutputBytes) {
    return yield* denyFamilyPreflight(
      ledgerPath,
      family,
      expectedCount,
      "Available destination bytes are below the approved cumulative output ceiling.",
      `${family} restoration capacity preflight denied payload writes.`
    );
  }
});

const familyElapsedMillis = Effect.fn("CorpusRestoration.familyElapsedMillis")(function* (startedAt: number) {
  return DateTime.toEpochMillis(yield* DateTime.now) - startedAt;
});

const familyBudgetAvailable = Effect.fn("CorpusRestoration.familyBudgetAvailable")(function* (
  startedAt: number,
  outputBytes: number,
  maxTotalElapsedMillis: number,
  maxTotalOutputBytes: number
) {
  return (yield* familyElapsedMillis(startedAt)) < maxTotalElapsedMillis && outputBytes < maxTotalOutputBytes;
});

const finalizeFamilyRun = Effect.fn("CorpusRestoration.finalizeFamilyRun")(function* (
  ledgerPath: string,
  family: TransformationFamily,
  startedAt: number,
  sourceCount: number,
  counters: FamilyCounters,
  expectedTerminalCount: number,
  contractMatches: boolean,
  failureMessage: string,
  errorMessage: string
): Effect.fn.Return<RestorationRunSummary, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const terminalCount = counters.passCount + counters.exceptionCount;
  const accepted = contractMatches && terminalCount === expectedTerminalCount && counters.unapprovedCount === 0;
  const summary = RestorationRunSummary.make({
    elapsedMillis: nonNegative(yield* familyElapsedMillis(startedAt)),
    exceptionCount: nonNegative(counters.exceptionCount),
    family,
    inputBytes: nonNegative(counters.inputBytes),
    outputBytes: nonNegative(counters.outputBytes),
    passCount: nonNegative(counters.passCount),
    sourceCount: nonNegative(sourceCount),
    unapprovedCount: nonNegative(counters.unapprovedCount),
  });
  yield* appendTransformationRecord(
    ledgerPath,
    TransformationLedgerRecord.cases["family-run-summary"].make({
      ...summary,
      family,
      recordType: "family-run-summary",
    })
  );
  const acceptance = accepted
    ? TransformationLedgerRecord.cases["family-acceptance-pass"].make({
        expectedCount: nonNegative(expectedTerminalCount),
        family,
        recordType: "family-acceptance-pass",
        terminalCount: nonNegative(terminalCount),
        unapprovedCount: 0,
      })
    : TransformationLedgerRecord.cases["family-acceptance-failure"].make({
        expectedCount: nonNegative(expectedTerminalCount),
        family,
        message: failureMessage,
        recordType: "family-acceptance-failure",
        terminalCount: nonNegative(terminalCount),
        unapprovedCount: nonNegative(Math.max(1, counters.unapprovedCount)),
      });
  yield* appendTransformationRecord(ledgerPath, acceptance);
  if (!accepted) return yield* transformationError(errorMessage);
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
  startedAt: number,
  maxTotalElapsedMillis: number,
  maxTotalOutputBytes: number,
  process: (
    candidate: Candidate,
    outputBytes: number
  ) => Effect.Effect<LegacyWordTerminal, CorpusCommandError, TransformationRequirements>
): Effect.fn.Return<FamilyCounters, CorpusCommandError, TransformationRequirements> {
  let counters = emptyFamilyCounters();
  for (const candidate of candidates) {
    counters = addFamilyTerminal(counters, yield* process(candidate, counters.outputBytes));
  }
  return yield* applyFamilyCeiling(counters, startedAt, maxTotalElapsedMillis, maxTotalOutputBytes);
});

const processMailCandidate = Effect.fn("CorpusRestoration.processMailCandidate")(function* (
  candidate: MailCandidate,
  options: RestorationMailOptions,
  outputRoot: string,
  ledgerPath: string,
  startedAt: number,
  outputBytes: number
): Effect.fn.Return<LegacyWordTerminal, CorpusCommandError, TransformationRequirements> {
  const budgetAvailable = yield* familyBudgetAvailable(
    startedAt,
    outputBytes,
    options.maxTotalElapsedMillis,
    options.maxTotalOutputBytes
  );
  if (!budgetAvailable) {
    yield* appendTransformationRecord(
      ledgerPath,
      TransformationLedgerRecord.cases["mail-store-exception"].make({
        approved: false,
        attemptId: `${candidate.objectId}:family-ceiling`,
        exceptionKind: "engine-failure",
        message: "The mail family exhausted its approved total elapsed-time or retained-output ceiling.",
        objectId: candidate.objectId,
        recordType: "mail-store-exception",
        sourceFamily: candidate.family,
      })
    );
    return { inputBytes: 0, outputBytes: 0, passed: false, unapproved: true };
  }
  if (candidate.family === "pst") {
    return yield* processPstCandidate(
      candidate,
      options,
      outputRoot,
      ledgerPath,
      options.maxTotalOutputBytes - outputBytes
    );
  }
  yield* appendTransformationRecord(
    ledgerPath,
    TransformationLedgerRecord.cases["mail-store-exception"].make({
      approved: true,
      attemptId: `${candidate.objectId}:explicit-disposition`,
      disposition: "defer",
      exceptionKind: "unsupported-family",
      message: "Mail source family received an explicit defer disposition in this bounded cycle.",
      objectId: candidate.objectId,
      recordType: "mail-store-exception",
      sourceFamily: candidate.family,
    })
  );
  return { inputBytes: 0, outputBytes: 0, passed: false, unapproved: false };
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
  if (options.maxAmplificationRatio <= 0 || options.maxTotalOutputBytes <= 0) {
    return yield* transformationError("Mail amplification ratio must be greater than zero.");
  }
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const run = yield* prepareTransformationRun(options.corpusRoot, options.runLabel, "mail");
  const outputRoot = path.join(run.outputRoot, options.scope);
  const candidates = selectMailCandidates(
    path,
    options.scope,
    mailCandidates(path, run.archiveRoot, yield* currentPreservationRecords(options.corpusRoot, options.runLabel))
  );
  if (candidates.length !== options.expectedStoreCount) {
    return yield* denyFamilyPreflight(
      run.ledgerPath,
      "mail",
      options.expectedStoreCount,
      "Mail candidate denominator drifted from the approved run contract.",
      "Mail candidate denominator does not match the approved expected store count."
    );
  }
  yield* requireFamilyCapacity(
    options.corpusRoot,
    run.ledgerPath,
    "mail",
    options.expectedStoreCount,
    options.maxTotalElapsedMillis,
    options.maxTotalOutputBytes
  );
  yield* fs
    .makeDirectory(outputRoot, { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating mail restoration output root."));

  const counters = yield* runBoundedFamilyCandidates(
    candidates,
    run.startedAt,
    options.maxTotalElapsedMillis,
    options.maxTotalOutputBytes,
    (candidate, outputBytes) =>
      processMailCandidate(candidate, options, outputRoot, run.ledgerPath, run.startedAt, outputBytes)
  );
  return yield* finalizeFamilyRun(
    run.ledgerPath,
    "mail",
    run.startedAt,
    candidates.length,
    counters,
    options.expectedStoreCount,
    true,
    "Mail terminals are incomplete or contain an unapproved exception or whole-family ceiling breach.",
    "Mail restoration failed its zero-unapproved-terminal acceptance gate."
  );
});

type RecycleArchiveEntry = {
  readonly kind: "content" | "metadata";
  readonly objectId: string;
  readonly pairKey: string;
  readonly sourcePath: string;
  readonly sourceRelativePath: string;
  readonly surfaceKey: string;
};

type RecycleGroup = {
  readonly content: Array<RecycleArchiveEntry>;
  readonly metadata: Array<RecycleArchiveEntry>;
  readonly surfaceKey: string;
};

const digestString = (value: string): Sha256Hex => Sha256Hex.make(bytesToHex(sha256(utf8ToBytes(value))));

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
        sourcePath: path.join(archiveRoot, record.destinationRelativePath),
        sourceRelativePath: record.sourceRelativePath,
        surfaceKey: recycleSurfaceKey(path, record.sourceRelativePath),
      }));
    })
  );

const groupRecycleEntries = (entries: ReadonlyArray<RecycleArchiveEntry>): ReadonlyMap<string, RecycleGroup> => {
  const groups = new Map<string, RecycleGroup>();
  for (const entry of entries) {
    const key = `${entry.surfaceKey}\u0000${entry.pairKey}`;
    const group = groups.get(key) ?? { content: [], metadata: [], surfaceKey: entry.surfaceKey };
    group[entry.kind].push(entry);
    groups.set(key, group);
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
  const hasher = sha256.create();
  let sizeBytes = 0;
  for (const file of yield* walkFiles(sourcePath)) {
    const digest = yield* hashRestorationFileStreaming(file.absolutePath, 1024 * 1024);
    hasher.update(utf8ToBytes(`${file.relativePath}\u0000${digest.sha256}\u0000${digest.sizeBytes}\n`));
    sizeBytes += digest.sizeBytes;
  }
  return { sha256: Sha256Hex.make(bytesToHex(hasher.digest())), sizeBytes };
});

const safeRestoredPath = (path: Path.Path, originalPath: string): string => {
  const normalized = originalPath.normalize("NFC").replaceAll("\\", "/");
  const withoutDrive = normalized.replace(/^[A-Za-z]:/u, "");
  const segments = A.filter(Str.split("/")(withoutDrive), Str.isNonEmpty);
  const sanitized = A.map(segments, (segment) => {
    const safe = segment.replace(/[<>:"|?*\u0000-\u001f]/gu, "_").replace(/[. ]+$/gu, "");
    return safe === "." || safe === ".." || Str.isEmpty(safe) ? "_" : safe;
  });
  return A.length(sanitized) === 0 ? "_" : path.join(...sanitized);
};

const collisionAllocatedPath = (
  path: Path.Path,
  desiredPath: string,
  digest: Sha256Hex,
  used: Map<string, string>
): string => {
  const equivalenceKey = desiredPath.normalize("NFC").toLocaleLowerCase("en-US");
  const existing = used.get(equivalenceKey);
  if (existing === undefined || existing === digest) {
    used.set(equivalenceKey, digest);
    return desiredPath;
  }
  const extension = path.extname(desiredPath);
  const stem = Str.slice(0, desiredPath.length - extension.length)(desiredPath);
  const allocated = `${stem}__${Str.takeLeft(12)(digest)}${extension}`;
  used.set(allocated.normalize("NFC").toLocaleLowerCase("en-US"), digest);
  return allocated;
};

const copyRecycleContent = Effect.fn("CorpusRestoration.copyRecycleContent")(function* (
  sourcePath: string,
  destinationPath: string,
  expectedDigest: Sha256Hex
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs
    .exists(destinationPath)
    .pipe(CorpusCommandError.mapError("Failed checking recycle restoration destination."));
  if (exists) {
    const actual = yield* hashRecycleContent(destinationPath);
    if (actual.sha256 === expectedDigest) return;
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
  const sourceInfo = yield* fs
    .stat(sourcePath)
    .pipe(CorpusCommandError.mapError("Failed inspecting recycle source during restoration."));
  if (sourceInfo.type === "Directory") {
    yield* fs
      .copy(sourcePath, partialPath, { preserveTimestamps: true })
      .pipe(CorpusCommandError.mapError("Failed copying recycle directory occurrence."));
    yield* syncTree(partialPath);
  } else {
    yield* fs
      .copyFile(sourcePath, partialPath)
      .pipe(CorpusCommandError.mapError("Failed copying recycle file occurrence."));
    yield* Effect.scoped(
      fs.open(partialPath, { flag: "r" }).pipe(
        Effect.flatMap((handle) => handle.sync),
        CorpusCommandError.mapError("Failed syncing recycle file occurrence.")
      )
    );
  }
  const copiedDigest = yield* hashRecycleContent(partialPath);
  if (copiedDigest.sha256 !== expectedDigest) {
    return yield* transformationError("Recycle restoration copy digest does not match its preserved occurrence.");
  }
  yield* fs
    .rename(partialPath, destinationPath)
    .pipe(CorpusCommandError.mapError("Failed atomically promoting recycle restoration occurrence."));
  yield* syncRestorationDirectory(path.dirname(destinationPath));
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
  duplicate: Math.max(0, group.metadata.length - 1) + Math.max(0, group.content.length - 1),
  missing: group.content.length === 0 ? group.metadata.length : 0,
  orphan: group.metadata.length === 0 ? group.content.length : 0,
  valid: Math.min(group.metadata.length, group.content.length),
});

const addRecycleSurfaceCounts = (left: RecycleSurfaceCounts, right: RecycleSurfaceCounts): RecycleSurfaceCounts => ({
  duplicate: left.duplicate + right.duplicate,
  missing: left.missing + right.missing,
  orphan: left.orphan + right.orphan,
  valid: left.valid + right.valid,
});

const recycleSurfaceCounts = (groups: ReadonlyMap<string, RecycleGroup>): ReadonlyMap<string, RecycleSurfaceCounts> => {
  const surfaces = new Map<string, RecycleSurfaceCounts>();
  for (const group of groups.values()) {
    const counts = surfaces.get(group.surfaceKey) ?? { duplicate: 0, missing: 0, orphan: 0, valid: 0 };
    surfaces.set(group.surfaceKey, addRecycleSurfaceCounts(counts, recycleGroupCounts(group)));
  }
  return surfaces;
};

const recycleMissingContentCount = (surfaces: ReadonlyMap<string, RecycleSurfaceCounts>): number => {
  let count = 0;
  for (const surface of surfaces.values()) count += surface.missing;
  return count;
};

const restoreRecyclePair = Effect.fn("CorpusRestoration.restoreRecyclePair")(function* (
  metadata: RecycleArchiveEntry,
  content: RecycleArchiveEntry,
  group: RecycleGroup,
  outputRoot: string,
  ledgerPath: string,
  usedPaths: Map<string, string>,
  state: RecycleRestoreState,
  options: RestorationRecycleOptions,
  startedAt: number
): Effect.fn.Return<RecycleRestoreState, CorpusCommandError, TransformationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const metadataBytes = yield* fs
    .readFile(metadata.sourcePath)
    .pipe(CorpusCommandError.mapError("Failed reading recycle metadata occurrence."));
  const decoded = yield* parseRecycleBinMetadata(metadataBytes);
  const digest = yield* hashRecycleContent(content.sourcePath);
  const withinElapsedCeiling = (yield* familyElapsedMillis(startedAt)) < options.maxTotalElapsedMillis;
  const withinOutputCeiling = digest.sizeBytes <= options.maxTotalOutputBytes - state.outputBytes;
  const canRetain = withinElapsedCeiling && withinOutputCeiling;
  if (!canRetain) {
    return yield* denyFamilyPreflight(
      ledgerPath,
      "recycle",
      options.expectedSurfaceCount,
      "Recycle restoration reached its approved total elapsed-time or retained-output ceiling.",
      "Recycle restoration stopped before a copy could exceed its whole-family ceiling."
    );
  }
  const surfaceId = `surface-${Str.takeLeft(16)(digestString(group.surfaceKey))}`;
  const desired = path.join(surfaceId, safeRestoredPath(path, decoded.originalPath));
  const restoredRelativePath = collisionAllocatedPath(path, desired, digest.sha256, usedPaths);
  yield* copyRecycleContent(content.sourcePath, path.join(outputRoot, restoredRelativePath), digest.sha256);
  yield* appendTransformationRecord(
    ledgerPath,
    TransformationLedgerRecord.cases["recycle-mapping"].make({
      digest: digest.sha256,
      originalPath: decoded.originalPath,
      recordType: "recycle-mapping",
      restoredRelativePath,
      sourceObjectId: content.objectId,
      surfaceId,
    })
  );
  return {
    inputBytes: state.inputBytes + digest.sizeBytes,
    mappingCount: state.mappingCount + 1,
    outputBytes: state.outputBytes + digest.sizeBytes,
  };
});

const restoreRecycleGroups = Effect.fn("CorpusRestoration.restoreRecycleGroups")(function* (
  groups: ReadonlyMap<string, RecycleGroup>,
  outputRoot: string,
  ledgerPath: string,
  options: RestorationRecycleOptions,
  startedAt: number
): Effect.fn.Return<RecycleRestoreState, CorpusCommandError, TransformationRequirements> {
  const usedPaths = new Map<string, string>();
  let state: RecycleRestoreState = { inputBytes: 0, mappingCount: 0, outputBytes: 0 };
  for (const group of groups.values()) {
    for (const [metadata, content] of A.zip(group.metadata, group.content)) {
      state = yield* restoreRecyclePair(
        metadata,
        content,
        group,
        outputRoot,
        ledgerPath,
        usedPaths,
        state,
        options,
        startedAt
      );
    }
  }
  return state;
});

const recycleJoinClasses = (counts: RecycleSurfaceCounts) =>
  [
    ["duplicate", counts.duplicate],
    ["missing-content", counts.missing],
    ["orphan-content", counts.orphan],
    ["valid-pair", counts.valid],
  ] as const;

const appendRecycleJoins = Effect.fn("CorpusRestoration.appendRecycleJoins")(function* (
  surfaces: ReadonlyMap<string, RecycleSurfaceCounts>,
  ledgerPath: string
): Effect.fn.Return<
  { readonly joinOutcomeCount: number; readonly missingContentCount: number },
  CorpusCommandError,
  FileSystem.FileSystem | Path.Path
> {
  let joinOutcomeCount = 0;
  let missingContentCount = 0;
  for (const [surfaceKey, counts] of surfaces) {
    const surfaceId = `surface-${Str.takeLeft(16)(digestString(surfaceKey))}`;
    for (const [joinClass, count] of recycleJoinClasses(counts)) {
      joinOutcomeCount += count;
      missingContentCount += joinClass === "missing-content" ? count : 0;
      yield* appendTransformationRecord(
        ledgerPath,
        TransformationLedgerRecord.cases["recycle-join"].make({
          count: nonNegative(count),
          joinClass,
          recordType: "recycle-join",
          surfaceId,
        })
      );
    }
  }
  return { joinOutcomeCount, missingContentCount };
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
  const path = yield* Path.Path;
  const run = yield* prepareTransformationRun(options.corpusRoot, options.runLabel, "recycle");
  const outputRoot = path.join(run.outputRoot, "restored");
  const entries = recycleEntries(
    path,
    run.archiveRoot,
    yield* currentPreservationRecords(options.corpusRoot, options.runLabel)
  );
  const groups = groupRecycleEntries(entries);
  const surfaces = recycleSurfaceCounts(groups);
  const missingContentCount = recycleMissingContentCount(surfaces);
  if (surfaces.size !== options.expectedSurfaceCount || missingContentCount !== options.expectedMissingContentCount) {
    return yield* denyFamilyPreflight(
      run.ledgerPath,
      "recycle",
      entries.length,
      "Recycle surface or missing-content evidence drifted from the approved run contract.",
      "Recycle restoration denominator preflight denied payload writes."
    );
  }
  yield* requireFamilyCapacity(
    options.corpusRoot,
    run.ledgerPath,
    "recycle",
    entries.length,
    options.maxTotalElapsedMillis,
    options.maxTotalOutputBytes
  );
  const restored = yield* restoreRecycleGroups(groups, outputRoot, run.ledgerPath, options, run.startedAt);
  const joins = yield* appendRecycleJoins(surfaces, run.ledgerPath);
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
    run.ledgerPath,
    "recycle",
    run.startedAt,
    entries.length,
    counters,
    joins.joinOutcomeCount,
    contractMatches,
    "Recycle surface, missing-content, or whole-family ceiling evidence drifted from the approved contract.",
    "Recycle restoration failed its surface or missing-content acceptance gate."
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
  const byDigest = new Map<Sha256Hex, { occurrenceCount: number; pass: PreservedFilePass }>();
  for (const pass of occurrences) {
    const current = byDigest.get(pass.sha256);
    byDigest.set(pass.sha256, {
      occurrenceCount: (current?.occurrenceCount ?? 0) + 1,
      pass: current?.pass ?? pass,
    });
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
  source: "all" | "stdout" = "all"
) {
  if (maxElapsedMillis <= 0) {
    return yield* transformationError("Legacy-Word transformation has no remaining elapsed-time budget.");
  }
  return yield* runCaptured({
    args,
    bound: legacyOutputBound,
    command,
    forceKillAfter: "1 second",
    source,
    timeout: maxElapsedMillis,
    trim: true,
  }).pipe(CorpusCommandError.mapError("Legacy-Word subprocess failed before producing a terminal result."));
});

const remainingLegacyMillis = Effect.fn("CorpusRestoration.remainingLegacyMillis")(function* (
  startedAt: number,
  maximum: number
) {
  return maximum - (DateTime.toEpochMillis(yield* DateTime.now) - startedAt);
});

const runSandboxedConversion = Effect.fn("CorpusRestoration.runSandboxedConversion")(function* (
  inputPath: string,
  inputExtension: "doc" | "docx",
  outputFormat: "docx" | "pdf",
  outputDirectory: string,
  options: RestorationLegacyWordOptions,
  startedAt: number
): Effect.fn.Return<string, CorpusCommandError, TransformationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(outputDirectory, { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating a legacy-Word sandbox output directory."));
  const rootBinds: Array<string> = [];
  for (const root of ["/usr", "/lib", "/lib64", "/etc", "/var"] as const) {
    if (yield* fs.exists(root).pipe(CorpusCommandError.mapError("Failed probing a sandbox runtime root."))) {
      rootBinds.push("--ro-bind", root, root);
    }
  }
  const sandboxInput = `/input/source.${inputExtension}`;
  const result = yield* runLegacyStep(
    options.bwrapPath,
    [
      "--die-with-parent",
      "--new-session",
      "--unshare-all",
      ...rootBinds,
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
      "--dir",
      "/tool",
      "--ro-bind",
      options.converterPath,
      "/tool/converter",
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
      "/tool/converter",
      "--headless",
      "--convert-to",
      outputFormat,
      "--outdir",
      "/output",
      sandboxInput,
    ],
    yield* remainingLegacyMillis(startedAt, options.maxElapsedMillis)
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
  startedAt: number
): Effect.fn.Return<
  { readonly digest: Sha256Hex; readonly text: string },
  CorpusCommandError,
  TransformationRequirements
> {
  const result = yield* runLegacyStep(
    options.javaPath,
    ["-jar", options.tikaJarPath, "-t", filePath],
    yield* remainingLegacyMillis(startedAt, options.maxElapsedMillis),
    "stdout"
  );
  if (result.exitCode !== 0 || result.truncated) {
    return yield* transformationError("Tika failed or exceeded its bounded output during legacy-Word comparison.");
  }
  const normalized = Str.trim(Str.replace(/\s+/gu, " ")(result.output.normalize("NFKC")));
  if (Str.isEmpty(normalized)) {
    return yield* transformationError("Tika returned empty normalized text during legacy-Word comparison.");
  }
  return { digest: digestString(normalized), text: normalized };
});

const pdfPageCount = Effect.fn("CorpusRestoration.pdfPageCount")(function* (
  pdfPath: string,
  options: RestorationLegacyWordOptions,
  startedAt: number
): Effect.fn.Return<number, CorpusCommandError, TransformationRequirements> {
  const result = yield* runLegacyStep(
    options.pdfinfoPath,
    [pdfPath],
    yield* remainingLegacyMillis(startedAt, options.maxElapsedMillis),
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
  startedAt: number
): Effect.fn.Return<ReadonlyArray<string>, CorpusCommandError, TransformationRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(outputDirectory, { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating a legacy-Word page-render directory."));
  const prefix = path.join(outputDirectory, "page");
  const result = yield* runLegacyStep(
    options.pdftoppmPath,
    ["-png", "-r", "96", pdfPath, prefix],
    yield* remainingLegacyMillis(startedAt, options.maxElapsedMillis)
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
  startedAt: number
): Effect.fn.Return<number, CorpusCommandError, TransformationRequirements> {
  const result = yield* runLegacyStep(
    options.comparePath,
    ["-metric", "RMSE", original, converted, "null:"],
    yield* remainingLegacyMillis(startedAt, options.maxElapsedMillis)
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
  startedAt: number
): Effect.fn.Return<number, CorpusCommandError, TransformationRequirements> {
  if (originalPages.length !== convertedPages.length) return Number.POSITIVE_INFINITY;
  const values = yield* Effect.forEach(
    A.zip(originalPages, convertedPages),
    ([original, converted]) => comparePageRmse(original, converted, options, startedAt),
    { concurrency: 1 }
  );
  return A.reduce(values, 0, Math.max);
});

const appendLegacyException = Effect.fn("CorpusRestoration.appendLegacyException")(function* (
  ledgerPath: string,
  digest: Sha256Hex,
  exceptionKind: "conversion-failed" | "fidelity-failed" | "not-binary-word",
  approved: boolean,
  message: string
) {
  yield* appendTransformationRecord(
    ledgerPath,
    TransformationLedgerRecord.cases["legacy-word-exception"].make({
      approved,
      exceptionKind,
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
  digest: Sha256Hex
): Effect.fn.Return<string, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workRoot = path.join(outputRoot, "proof", digest);
  if (yield* fs.exists(workRoot).pipe(CorpusCommandError.mapError("Failed checking legacy-Word proof root."))) {
    return yield* transformationError(
      "Legacy-Word proof root already exists; the immutable attempt must not be overwritten."
    );
  }
  yield* fs
    .makeDirectory(workRoot, { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating legacy-Word proof root."));
  return workRoot;
});

const proveLegacyFidelity = Effect.fn("CorpusRestoration.proveLegacyFidelity")(function* (
  candidate: LegacyWordCandidate,
  workRoot: string,
  options: RestorationLegacyWordOptions,
  startedAt: number
): Effect.fn.Return<LegacyFidelityEvidence, CorpusCommandError, TransformationRequirements> {
  const path = yield* Path.Path;
  const convertedPath = yield* runSandboxedConversion(
    candidate.sourcePath,
    "doc",
    "docx",
    path.join(workRoot, "converted"),
    options,
    startedAt
  );
  const originalText = yield* normalizedTikaText(candidate.sourcePath, options, startedAt);
  const convertedText = yield* normalizedTikaText(convertedPath, options, startedAt);
  const originalPdf = yield* runSandboxedConversion(
    candidate.sourcePath,
    "doc",
    "pdf",
    path.join(workRoot, "original-pdf"),
    options,
    startedAt
  );
  const convertedPdf = yield* runSandboxedConversion(
    convertedPath,
    "docx",
    "pdf",
    path.join(workRoot, "converted-pdf"),
    options,
    startedAt
  );
  const originalPageCount = yield* pdfPageCount(originalPdf, options, startedAt);
  const convertedPageCount = yield* pdfPageCount(convertedPdf, options, startedAt);
  const originalPages = yield* renderPdfPages(originalPdf, path.join(workRoot, "original-pages"), options, startedAt);
  const convertedPages = yield* renderPdfPages(
    convertedPdf,
    path.join(workRoot, "converted-pages"),
    options,
    startedAt
  );
  return {
    convertedPath,
    normalizedTextSha256: originalText.digest,
    pageCountDelta: convertedPageCount - originalPageCount,
    visualRmse:
      originalText.digest === convertedText.digest
        ? yield* maximumPageRmse(originalPages, convertedPages, options, startedAt)
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
  outputRoot: string
): Effect.fn.Return<
  { readonly sha256: Sha256Hex; readonly sizeBytes: number },
  CorpusCommandError,
  TransformationRequirements
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const convertedDigest = yield* hashRestorationFileStreaming(convertedPath, 1024 * 1024);
  const finalRoot = path.join(outputRoot, "converted");
  const destinationPath = path.join(finalRoot, `${digest}.docx`);
  const partialPath = `${destinationPath}.partial`;
  yield* fs
    .makeDirectory(finalRoot, { recursive: true })
    .pipe(CorpusCommandError.mapError("Failed creating legacy-Word conversion destination."));
  const destinationExists = yield* fs
    .exists(destinationPath)
    .pipe(CorpusCommandError.mapError("Failed checking legacy-Word destination."));
  const partialExists = yield* fs
    .exists(partialPath)
    .pipe(CorpusCommandError.mapError("Failed checking legacy-Word partial destination."));
  if (destinationExists || partialExists) {
    return yield* transformationError("Legacy-Word conversion destination already exists and will not be overwritten.");
  }
  yield* fs
    .copyFile(convertedPath, partialPath)
    .pipe(CorpusCommandError.mapError("Failed staging legacy-Word conversion output."));
  yield* Effect.scoped(
    fs.open(partialPath, { flag: "r" }).pipe(
      Effect.flatMap((handle) => handle.sync),
      CorpusCommandError.mapError("Failed syncing legacy-Word conversion output.")
    )
  );
  const stagedDigest = yield* hashRestorationFileStreaming(partialPath, 1024 * 1024);
  if (stagedDigest.sha256 !== convertedDigest.sha256 || stagedDigest.sizeBytes !== convertedDigest.sizeBytes) {
    return yield* transformationError("Legacy-Word atomic staging digest does not match the converter output.");
  }
  yield* fs
    .rename(partialPath, destinationPath)
    .pipe(CorpusCommandError.mapError("Failed atomically promoting legacy-Word conversion output."));
  yield* syncRestorationDirectory(finalRoot);
  return convertedDigest;
});

const retainedLegacyPathBytes = Effect.fn("CorpusRestoration.retainedLegacyPathBytes")(function* (
  root: string
): Effect.fn.Return<number, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(root)
    .pipe(CorpusCommandError.mapError("Failed checking retained legacy-Word output."));
  if (!exists) return 0;
  const info = yield* fs.stat(root).pipe(CorpusCommandError.mapError("Failed inspecting retained legacy-Word output."));
  if (info.type === "File") return Number(info.size);
  if (info.type !== "Directory") {
    return yield* transformationError("Retained legacy-Word output contains an unsupported object type.");
  }
  const sizes = yield* Effect.forEach(yield* walkFiles(root), (file) =>
    fs.stat(file.absolutePath).pipe(
      Effect.map((fileInfo) => Number(fileInfo.size)),
      CorpusCommandError.mapError("Failed measuring retained legacy-Word proof output.")
    )
  );
  return A.reduce(sizes, 0, (total, size) => total + size);
});

const legacyCandidateRetainedBytes = Effect.fn("CorpusRestoration.legacyCandidateRetainedBytes")(function* (
  outputRoot: string,
  digest: Sha256Hex
): Effect.fn.Return<number, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const sizes = yield* Effect.forEach(
    [path.join(outputRoot, "proof", digest), path.join(outputRoot, "converted", `${digest}.docx`)],
    retainedLegacyPathBytes,
    { concurrency: 1 }
  );
  return A.reduce(sizes, 0, (total, size) => total + size);
});

const processLegacyWordCandidate = Effect.fn("CorpusRestoration.processLegacyWordCandidate")(function* (
  candidate: LegacyWordCandidate,
  engineVersion: string,
  outputRoot: string,
  ledgerPath: string,
  options: RestorationLegacyWordOptions
): Effect.fn.Return<LegacyWordTerminal, CorpusCommandError, TransformationRequirements> {
  const prefix = yield* readPrefix(candidate.sourcePath);
  if (!isCompoundFileBinary(prefix)) {
    yield* appendLegacyException(
      ledgerPath,
      candidate.digest,
      "not-binary-word",
      true,
      "The .doc occurrence does not carry the Compound File Binary signature and remains preserved without conversion."
    );
    return { inputBytes: candidate.pass.sizeBytes, outputBytes: 0, passed: false, unapproved: false };
  }
  const startedAt = DateTime.toEpochMillis(yield* DateTime.now);
  const workRoot = yield* makeLegacyWorkRoot(outputRoot, candidate.digest);
  const evidence = yield* proveLegacyFidelity(candidate, workRoot, options, startedAt);
  const elapsedMillis = DateTime.toEpochMillis(yield* DateTime.now) - startedAt;
  if (!legacyFidelityPasses(evidence, elapsedMillis, options)) {
    yield* appendLegacyException(
      ledgerPath,
      candidate.digest,
      "fidelity-failed",
      false,
      "Converted output exceeded the declared normalized-text, pagination, visual, or elapsed-time fidelity boundary."
    );
    return {
      inputBytes: candidate.pass.sizeBytes,
      outputBytes: yield* legacyCandidateRetainedBytes(outputRoot, candidate.digest),
      passed: false,
      unapproved: true,
    };
  }
  const convertedDigest = yield* promoteLegacyWordOutput(evidence.convertedPath, candidate.digest, outputRoot);
  yield* appendTransformationRecord(
    ledgerPath,
    TransformationLedgerRecord.cases["legacy-word-pass"].make({
      convertedSha256: convertedDigest.sha256,
      engineVersion,
      normalizedTextSha256: evidence.normalizedTextSha256,
      originalSha256: candidate.digest,
      pageCountDelta: evidence.pageCountDelta,
      recordType: "legacy-word-pass",
      visualRmse: evidence.visualRmse,
    })
  );
  return {
    inputBytes: candidate.pass.sizeBytes,
    outputBytes: yield* legacyCandidateRetainedBytes(outputRoot, candidate.digest),
    passed: true,
    unapproved: false,
  };
});

const processLegacyWordTerminal = Effect.fn("CorpusRestoration.processLegacyWordTerminal")(function* (
  candidate: LegacyWordCandidate,
  engineVersion: string,
  outputRoot: string,
  ledgerPath: string,
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
    yield* appendLegacyException(
      ledgerPath,
      candidate.digest,
      "conversion-failed",
      false,
      "The legacy-Word family exhausted its approved total elapsed-time or retained-output ceiling."
    );
    return { inputBytes: candidate.pass.sizeBytes, outputBytes: 0, passed: false, unapproved: true };
  }
  return yield* processLegacyWordCandidate(candidate, engineVersion, outputRoot, ledgerPath, options).pipe(
    Effect.catch(() =>
      Effect.gen(function* () {
        yield* appendLegacyException(
          ledgerPath,
          candidate.digest,
          "conversion-failed",
          false,
          "The sandboxed conversion or its evidence pipeline failed before a PASS could be recorded."
        );
        return {
          inputBytes: candidate.pass.sizeBytes,
          outputBytes: yield* legacyCandidateRetainedBytes(outputRoot, candidate.digest),
          passed: false,
          unapproved: true,
        } satisfies LegacyWordTerminal;
      })
    )
  );
});

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
  const path = yield* Path.Path;
  const run = yield* prepareTransformationRun(options.corpusRoot, options.runLabel, "legacy-word");
  const inventory = legacyWordCandidates(
    path,
    run.archiveRoot,
    yield* currentPreservationRecords(options.corpusRoot, options.runLabel)
  );
  const version = yield* runLegacyStep(options.converterPath, ["--version"], options.maxElapsedMillis, "stdout");
  const versionMatches =
    version.exitCode === 0 && !version.truncated && version.output === options.expectedConverterVersion;
  if (inventory.occurrenceCount !== options.expectedOccurrenceCount || !versionMatches) {
    return yield* denyFamilyPreflight(
      run.ledgerPath,
      "legacy-word",
      inventory.candidates.length,
      "Legacy-Word occurrence denominator or pinned converter identity drifted before transformation.",
      "Legacy-Word preflight failed its occurrence or converter-version gate."
    );
  }
  yield* requireFamilyCapacity(
    options.corpusRoot,
    run.ledgerPath,
    "legacy-word",
    inventory.candidates.length,
    options.maxTotalElapsedMillis,
    options.maxTotalOutputBytes
  );

  const counters = yield* runBoundedFamilyCandidates(
    inventory.candidates,
    run.startedAt,
    options.maxTotalElapsedMillis,
    options.maxTotalOutputBytes,
    (candidate, outputBytes) =>
      processLegacyWordTerminal(
        candidate,
        version.output,
        run.outputRoot,
        run.ledgerPath,
        options,
        run.startedAt,
        outputBytes
      )
  );
  return yield* finalizeFamilyRun(
    run.ledgerPath,
    "legacy-word",
    run.startedAt,
    inventory.occurrenceCount,
    counters,
    inventory.candidates.length,
    true,
    "Legacy-Word terminals are incomplete or contain an unapproved exception or whole-family ceiling breach.",
    "Legacy-Word restoration failed its zero-unapproved-terminal acceptance gate."
  );
});

type FamilyRunSummary = Extract<TransformationLedgerRecord, { readonly recordType: "family-run-summary" }>;
type FamilyAcceptance = Extract<
  TransformationLedgerRecord,
  { readonly recordType: "family-acceptance-failure" | "family-acceptance-pass" }
>;

type MailStorePass = Extract<TransformationLedgerRecord, { readonly recordType: "mail-store-pass" }>;
type MailStoreException = Extract<TransformationLedgerRecord, { readonly recordType: "mail-store-exception" }>;
type MailWarning = Extract<TransformationLedgerRecord, { readonly recordType: "mail-warning" }>;
type MailChildPass = Extract<TransformationLedgerRecord, { readonly recordType: "mail-child-pass" }>;

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
  const warningCount = A.filter(warnings, (warning) => warning.attemptId === record.attemptId).length;
  return (
    record.accountedChildCount === record.childCount &&
    childCount === record.childCount &&
    warningCount === record.warningCount
  );
};

const mailExceptionIsApproved = (record: MailStoreException): boolean =>
  record.approved && (record.exceptionKind !== "unsupported-family" || record.disposition !== undefined);

const mailSegmentReconciles = (
  summary: FamilyRunSummary,
  records: ReadonlyArray<TransformationLedgerRecord>
): boolean => {
  const passes = A.filter(records, isRecordType("mail-store-pass"));
  const exceptions = A.filter(records, isRecordType("mail-store-exception"));
  const warnings = A.filter(records, isRecordType("mail-warning"));
  const children = A.filter(records, isRecordType("mail-child-pass"));
  return (
    A.every(passes, (record) => mailPassReconciles(record, children, warnings)) &&
    passes.length === summary.passCount &&
    exceptions.length === summary.exceptionCount &&
    A.every(exceptions, mailExceptionIsApproved)
  );
};

const recycleSegmentReconciles = (
  summary: FamilyRunSummary,
  records: ReadonlyArray<TransformationLedgerRecord>
): boolean => {
  const mappings = A.filter(records, isRecordType("recycle-mapping"));
  const joins = A.filter(records, isRecordType("recycle-join"));
  const joinCount = A.reduce(joins, 0, (total, record) => total + record.count);
  return mappings.length === summary.passCount && joinCount - mappings.length === summary.exceptionCount;
};

const legacySegmentReconciles = (
  summary: FamilyRunSummary,
  records: ReadonlyArray<TransformationLedgerRecord>
): boolean => {
  const passes = A.filter(records, isRecordType("legacy-word-pass"));
  const exceptions = A.filter(records, isRecordType("legacy-word-exception"));
  return (
    passes.length === summary.passCount &&
    exceptions.length === summary.exceptionCount &&
    A.every(exceptions, (record) => record.approved)
  );
};

const transformationSegmentReconciles = (
  family: TransformationFamily,
  summary: FamilyRunSummary,
  records: ReadonlyArray<TransformationLedgerRecord>
): boolean => {
  if (summary.unapprovedCount !== 0) return false;
  if (family === "mail") return mailSegmentReconciles(summary, records);
  if (family === "recycle") return recycleSegmentReconciles(summary, records);
  return legacySegmentReconciles(summary, records);
};

const familyAcceptanceIndices = (
  family: TransformationFamily,
  records: ReadonlyArray<TransformationLedgerRecord>
): ReadonlyArray<number> => {
  const indices: Array<number> = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (
      record !== undefined &&
      (record.recordType === "family-acceptance-failure" || record.recordType === "family-acceptance-pass") &&
      record.family === family
    ) {
      indices.push(index);
    }
  }
  return indices;
};

const familySummaryIndex = (
  family: TransformationFamily,
  records: ReadonlyArray<TransformationLedgerRecord>,
  afterIndex: number,
  beforeIndex: number
): number => {
  let result = -1;
  for (let index = afterIndex + 1; index < beforeIndex; index += 1) {
    const record = records[index];
    if (record?.recordType === "family-run-summary" && record.family === family) result = index;
  }
  return result;
};

const latestFamilyEvidence = (
  family: TransformationFamily,
  records: ReadonlyArray<TransformationLedgerRecord>
): O.Option<{
  readonly acceptance: FamilyAcceptance;
  readonly segment: ReadonlyArray<TransformationLedgerRecord>;
  readonly summary: FamilyRunSummary;
}> => {
  const indices = familyAcceptanceIndices(family, records);
  const acceptanceIndex = O.getOrElse(A.last(indices), () => -1);
  const previousAcceptanceIndex = O.getOrElse(A.last(A.dropRight(indices, 1)), () => -1);
  const summaryIndex = familySummaryIndex(family, records, previousAcceptanceIndex, acceptanceIndex);
  const summary = records[summaryIndex];
  const acceptance = records[acceptanceIndex];
  if (
    summary === undefined ||
    summary.recordType !== "family-run-summary" ||
    acceptance === undefined ||
    (acceptance.recordType !== "family-acceptance-failure" && acceptance.recordType !== "family-acceptance-pass")
  ) {
    return O.none();
  }
  return O.some({
    acceptance,
    segment: A.take(A.drop(records, previousAcceptanceIndex + 1), summaryIndex - previousAcceptanceIndex - 1),
    summary,
  });
};

const writeAcceptanceRecord = Effect.fn("CorpusRestoration.writeAcceptanceRecord")(function* (
  corpusRoot: string,
  record: RestorationAcceptanceRecord
): Effect.fn.Return<void, CorpusCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(corpusRoot, "staging", "restoration", "acceptance");
  const destinationPath = path.join(directory, `${record.family}.json`);
  const partialPath = `${destinationPath}.partial`;
  if (
    (yield* fs.exists(destinationPath).pipe(CorpusCommandError.mapError("Failed checking acceptance destination."))) ||
    (yield* fs.exists(partialPath).pipe(CorpusCommandError.mapError("Failed checking partial acceptance destination.")))
  ) {
    return yield* transformationError("Immutable family acceptance destination already exists.");
  }
  const encoded = yield* encodeRestorationAcceptanceRecordJson(record).pipe(
    CorpusCommandError.mapError("Family acceptance record failed JSON encoding.")
  );
  yield* appendRestorationTextDurably(partialPath, `${encoded}\n`);
  yield* fs
    .rename(partialPath, destinationPath)
    .pipe(CorpusCommandError.mapError("Failed atomically promoting family acceptance record."));
  yield* syncRestorationDirectory(directory);
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
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const preservation = yield* verifyRestorationArchiveImpl({ corpusRoot, runLabel });
  const ledgerPath = path.join(corpusRoot, "staging", "restoration", "transformation-ledger.jsonl");
  const text = yield* fs
    .readFileString(ledgerPath)
    .pipe(CorpusCommandError.mapError("Failed reading transformation ledger for final acceptance."));
  const records = yield* Effect.forEach(A.filter(Str.split(/\r?\n/u)(text), Str.isNonEmpty), (line) =>
    decodeTransformationLedgerRecordJson(line).pipe(
      CorpusCommandError.mapError("Transformation ledger failed final acceptance decoding.")
    )
  );
  const recordedAt = DateTime.formatIso(yield* DateTime.now);
  const acceptances: Array<RestorationAcceptanceRecord> = [
    RestorationAcceptanceRecord.make({
      elapsedMillis: preservation.elapsedMillis,
      exceptionCount: preservation.exceptionCount,
      expectedTerminalCount: preservation.sourceCount,
      family: "preservation",
      inputBytes: preservation.inputBytes,
      outputBytes: preservation.outputBytes,
      passCount: preservation.passCount,
      recordedAt,
      schemaVersion: "oppold-corpus-restoration/v1",
      sourceCount: preservation.sourceCount,
      status: "pass",
      terminalCount: preservation.passCount,
      unapprovedCount: 0,
    }),
  ];
  for (const family of ["mail", "recycle", "legacy-word"] as const) {
    const evidence = O.getOrElse(latestFamilyEvidence(family, records), () => undefined);
    if (
      evidence === undefined ||
      evidence.acceptance.recordType !== "family-acceptance-pass" ||
      evidence.acceptance.unapprovedCount !== 0 ||
      evidence.acceptance.expectedCount !== evidence.acceptance.terminalCount ||
      evidence.acceptance.terminalCount !== evidence.summary.passCount + evidence.summary.exceptionCount ||
      !transformationSegmentReconciles(family, evidence.summary, evidence.segment)
    ) {
      return yield* transformationError(`Final ${family} acceptance evidence is missing, incomplete, or unapproved.`);
    }
    acceptances.push(
      RestorationAcceptanceRecord.make({
        elapsedMillis: evidence.summary.elapsedMillis,
        exceptionCount: evidence.summary.exceptionCount,
        expectedTerminalCount: evidence.acceptance.expectedCount,
        family,
        inputBytes: evidence.summary.inputBytes,
        outputBytes: evidence.summary.outputBytes,
        passCount: evidence.summary.passCount,
        recordedAt,
        schemaVersion: "oppold-corpus-restoration/v1",
        sourceCount: evidence.summary.sourceCount,
        status: "pass",
        terminalCount: evidence.acceptance.terminalCount,
        unapprovedCount: 0,
      })
    );
  }
  for (const acceptance of acceptances) yield* writeAcceptanceRecord(corpusRoot, acceptance);
  return acceptances;
});
