/**
 * Real pffexport-backed PST archive export engine.
 *
 * Runs the pffexport CLI sidecar, walks every mode-derived target tree,
 * assembles deterministic EML child artifacts, and writes a JSONL metadata
 * record per exported item so folder/message/attachment relationships survive
 * into the file-processing manifest tree.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ArtifactReference, deriveArtifactId } from "@beep/file-processing/Artifact";
import { ArchiveExportResult } from "@beep/file-processing/Extraction";
import { FileProcessingOperationError } from "@beep/file-processing/Operation";
import { FileProcessingEngineDescriptor } from "@beep/file-processing/Strategy";
import { $LibpffId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { A, O, R, Str, Struct } from "@beep/utils";
import { Effect, FileSystem, flow, Match, Order, Path, Stream } from "effect";
import * as S from "effect/Schema";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import {
  assembleEml,
  PFFEXPORT_EML_FILE_NAME,
  parseOutlookHeaders,
  stripMimeStructuralHeaders,
  synthesizeEmlHeaderBlock,
} from "./Libpff.eml.ts";
import { libpffOperationError } from "./Libpff.error-translation.ts";
import { makeLibpffError } from "./Libpff.errors.ts";
import { PFFEXPORT_MESSAGES_SUFFIX, PffexportMessageRecord } from "./Libpff.messages.ts";
import { LibpffFileProcessingEngine, LibpffFileProcessingEngineDescriptor } from "./Libpff.service.ts";
import type { ExportArchiveOperation, ExtractFileOperation } from "@beep/file-processing/Operation";
import type { FileProcessingEngineShape } from "@beep/file-processing/Service";
import type * as Crypto from "effect/Crypto";
import type { LibpffError } from "./Libpff.errors.ts";

const $I = $LibpffId.create("Libpff.pffexport");

const defaultPffexportPath = "pffexport";
const defaultForceKillAfterMillis = 10_000;
const PffexportModeBase = LiteralKit(["all", "items", "recovered"]);
const PffexportFormatBase = LiteralKit(["all", "html", "rtf", "text"]);
const PffexportExistingExportPolicyBase = LiteralKit(["fail", "replace"]);

const textEncoder = new TextEncoder();
const versionOutputPattern = /^pffexport\s+(\S+)/;
const artifactIdPrefixLength = "artifact:".length;
const emlBoundaryHexLength = 40;

// pffexport suffixes the -t basename per mode: `items` fills `.export`,
// `recovered` fills `.orphans` + `.recovered`, `all` fills all three — and it
// hard-fails when a tree it wants to create already exists.
const allTargetTreeSuffixes: ReadonlyArray<string> = [".export", ".orphans", ".recovered"];

// Held for the duration of one export as the atomic per-target mutex.
const PFFEXPORT_CLAIM_SUFFIX = ".claim";

const outlookHeadersFileName = "OutlookHeaders.txt";
const internetHeadersFileName = "InternetHeaders.txt";
const itemMetadataFileNames: ReadonlyArray<string> = [
  outlookHeadersFileName,
  internetHeadersFileName,
  "Recipients.txt",
  "ConversationIndex.txt",
  "ItemValues.txt",
];
// Fixed precedence keeps EML assembly deterministic under `-f all`, which
// writes several body variants side by side; non-selected variants stay plain
// metadata children rather than attachments.
const bodyFileNamePrecedence: ReadonlyArray<string> = [
  "Message.txt",
  "Message.html",
  "Message.rtf",
  "Contact.txt",
  "Appointment.txt",
  "Task.txt",
  "Meeting.txt",
  "Note.txt",
];
const emlBodyFileNames: ReadonlyArray<string> = ["Message.txt", "Message.html", "Message.rtf"];
const attachmentDirectoryPattern = /^Attachment\d/;

const bodyContentTypeFor = Match.type<string>().pipe(
  Match.when("Message.html", () => "text/html; charset=utf-8"),
  Match.when("Message.rtf", () => "application/rtf"),
  Match.orElse(() => "text/plain; charset=utf-8")
);

/**
 * pffexport item export mode.
 *
 * @example
 * ```ts
 * import { PffexportMode } from "@beep/libpff"
 * console.log(PffexportMode)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PffexportMode = PffexportModeBase.pipe(
  $I.annoteSchema("PffexportMode", {
    description: "pffexport -m export mode: regular items, recovered (deleted) items, or both.",
  }),
  SchemaUtils.withLiteralKitStatics(PffexportModeBase)
);

/**
 * Type for {@link PffexportMode}.
 *
 * @example
 * ```ts
 * import { PffexportMode } from "@beep/libpff"
 *
 * const mode: PffexportMode = "items"
 * console.log(PffexportMode.is.items(mode))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PffexportMode = typeof PffexportMode.Type;

/**
 * pffexport message body export format.
 *
 * @example
 * ```ts
 * import { PffexportFormat } from "@beep/libpff"
 * console.log(PffexportFormat)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PffexportFormat = PffexportFormatBase.pipe(
  $I.annoteSchema("PffexportFormat", {
    description: "pffexport -f preferred message body export format.",
  }),
  SchemaUtils.withLiteralKitStatics(PffexportFormatBase)
);

/**
 * Type for {@link PffexportFormat}.
 *
 * @example
 * ```ts
 * import { PffexportFormat } from "@beep/libpff"
 *
 * const format: PffexportFormat = "html"
 * console.log(PffexportFormat.is.html(format))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PffexportFormat = typeof PffexportFormat.Type;

/**
 * Policy applied when a prior export already exists for the same source.
 *
 * @example
 * ```ts
 * import { PffexportExistingExportPolicy } from "@beep/libpff"
 *
 * console.log(PffexportExistingExportPolicy.Options.includes("replace")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PffexportExistingExportPolicy = PffexportExistingExportPolicyBase.pipe(
  $I.annoteSchema("PffexportExistingExportPolicy", {
    description:
      "Output-directory policy when a prior export tree or messages JSONL already exists: fail with a typed config error or replace the stale outputs.",
  }),
  SchemaUtils.withLiteralKitStatics(PffexportExistingExportPolicyBase)
);

/**
 * Type for {@link PffexportExistingExportPolicy}.
 *
 * @example
 * ```ts
 * import { PffexportExistingExportPolicy } from "@beep/libpff"
 *
 * const policy: PffexportExistingExportPolicy = "replace"
 * console.log(PffexportExistingExportPolicy.is.replace(policy))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PffexportExistingExportPolicy = typeof PffexportExistingExportPolicy.Type;

/**
 * Configuration for the pffexport subprocess engine.
 *
 * @example
 * ```ts
 * import { PffexportEngineConfig } from "@beep/libpff"
 *
 * const config = PffexportEngineConfig.make({ exportRoot: "/tmp/pst-out" })
 * console.log(config.existingExportPolicy) // "fail"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class PffexportEngineConfig extends S.Class<PffexportEngineConfig>($I`PffexportEngineConfig`)(
  {
    existingExportPolicy: PffexportExistingExportPolicy.pipe(SchemaUtils.withKeyDefaults("fail")).annotateKey({
      description:
        "Behavior when any prior export tree (.export/.orphans/.recovered) or messages JSONL already exists for this source.",
    }),
    exportFormat: PffexportFormat.pipe(SchemaUtils.withKeyDefaults("text")).annotateKey({
      description: "pffexport message body format passed to the `-f` flag.",
    }),
    exportMode: PffexportMode.pipe(SchemaUtils.withKeyDefaults("items")).annotateKey({
      description: "pffexport item selection mode passed to the `-m` flag.",
    }),
    exportRoot: S.String.annotateKey({
      description: "Host filesystem directory where pffexport materializes archive children.",
    }),
    pffexportPath: S.String.pipe(SchemaUtils.withKeyDefaults(defaultPffexportPath)).annotateKey({
      description: "Executable path or command name used to spawn pffexport.",
    }),
    timeoutMillis: S.OptionFromOptionalKey(PosInt).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Positive per-archive subprocess timeout in milliseconds when configured.",
      })
    ),
  },
  $I.annote("PffexportEngineConfig", {
    description:
      "Configuration for the real pffexport subprocess engine: target export root, binary path, mode, format, existing-export policy, and optional per-archive timeout.",
  })
) {}

const targetTreeSuffixesFor = (mode: PffexportMode): ReadonlyArray<string> =>
  Match.value(mode).pipe(
    Match.when("items", (): ReadonlyArray<string> => [".export"]),
    Match.when("recovered", (): ReadonlyArray<string> => [".orphans", ".recovered"]),
    Match.when("all", () => allTargetTreeSuffixes),
    Match.exhaustive
  );

const posixDirname = (path: string): string => {
  const separator = path.lastIndexOf("/");
  return separator < 0 ? "" : path.slice(0, separator);
};

const posixBasename = (path: string): string => {
  const separator = path.lastIndexOf("/");
  return separator < 0 ? path : path.slice(separator + 1);
};

interface WalkedFile {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly sizeBytes: number;
}

interface ExportedEntry {
  readonly absolutePath: string;
  readonly ref: ArtifactReference;
}

interface ExportedItemAccumulator {
  readonly attachments: Array<ExportedEntry>;
  readonly bodyCandidates: Record<string, ExportedEntry>;
  readonly directoryPath: string;
  internetHeaders: O.Option<ExportedEntry>;
  readonly outlookHeaders: ExportedEntry;
}

interface ExportedItemDirectory {
  readonly attachments: ReadonlyArray<ExportedEntry>;
  readonly body: O.Option<ExportedEntry>;
  readonly directoryPath: string;
  readonly folderPath: string;
  readonly internetHeaders: O.Option<ExportedEntry>;
  readonly outlookHeaders: ExportedEntry;
}

interface EmlBudgetState {
  budgetExhausted: boolean;
  materializedBytes: number;
}

const itemFolderPath = (directoryPath: string, treeRootNames: ReadonlyArray<string>): string => {
  const parent = posixDirname(directoryPath);
  return O.match(
    A.findFirst(treeRootNames, (name) => parent === name || parent.startsWith(`${name}/`)),
    {
      onNone: () => parent,
      onSome: (name) => (parent === name ? "" : parent.slice(name.length + 1)),
    }
  );
};

// An item directory is one that directly contains OutlookHeaders.txt, except
// attachment subtrees (`Attachments`, `Attachment<digit>...`) — an attachment
// literally named OutlookHeaders.txt must not fabricate an item.
const collectItemAccumulators = (entries: ReadonlyArray<ExportedEntry>): Record<string, ExportedItemAccumulator> => {
  const accumulators: Record<string, ExportedItemAccumulator> = {};

  for (const entry of entries) {
    const relativePath = entry.ref.relativePath;
    if (posixBasename(relativePath) !== outlookHeadersFileName) {
      continue;
    }
    const directoryPath = posixDirname(relativePath);
    const directoryName = posixBasename(directoryPath);
    if (directoryName === "Attachments" || attachmentDirectoryPattern.test(directoryName)) {
      continue;
    }
    accumulators[directoryPath] = {
      attachments: [],
      bodyCandidates: {},
      directoryPath,
      internetHeaders: O.none(),
      outlookHeaders: entry,
    };
  }

  return accumulators;
};

const findOwnerItemDirectory = (
  parent: string,
  accumulators: Readonly<Record<string, ExportedItemAccumulator>>
): O.Option<ExportedItemAccumulator> => {
  let owner = parent;
  while (owner !== "" && !(owner in accumulators)) {
    owner = posixDirname(owner);
  }
  return owner === "" ? O.none() : O.fromUndefinedOr(accumulators[owner]);
};

const attributeItemFile = (accumulator: ExportedItemAccumulator, entry: ExportedEntry): void => {
  const relativePath = entry.ref.relativePath;
  const baseName = posixBasename(relativePath);

  if (posixDirname(relativePath) === accumulator.directoryPath) {
    if (baseName === internetHeadersFileName) {
      accumulator.internetHeaders = O.some(entry);
      return;
    }
    if (A.contains(itemMetadataFileNames, baseName) || baseName === PFFEXPORT_EML_FILE_NAME) {
      return;
    }
    if (A.contains(bodyFileNamePrecedence, baseName)) {
      accumulator.bodyCandidates[baseName] = entry;
      return;
    }
  }

  accumulator.attachments.push(entry);
};

const finalizeItem = (
  accumulator: ExportedItemAccumulator,
  treeRootNames: ReadonlyArray<string>
): ExportedItemDirectory => ({
  attachments: A.sort(
    accumulator.attachments,
    Order.mapInput(Str.Order, (entry: ExportedEntry) => entry.ref.relativePath)
  ),
  body: A.findFirst(bodyFileNamePrecedence, (name) => name in accumulator.bodyCandidates).pipe(
    O.flatMap((name) => O.fromUndefinedOr(accumulator.bodyCandidates[name]))
  ),
  directoryPath: accumulator.directoryPath,
  folderPath: itemFolderPath(accumulator.directoryPath, treeRootNames),
  internetHeaders: accumulator.internetHeaders,
  outlookHeaders: accumulator.outlookHeaders,
});

// Classification operates on the pre-assembly walk snapshot only. Files
// attribute to their deepest enclosing item directory, so embedded messages
// become their own items instead of double counting as parent attachments.
const classifyExportedItems = (
  entries: ReadonlyArray<ExportedEntry>,
  treeRootNames: ReadonlyArray<string>
): ReadonlyArray<ExportedItemDirectory> => {
  const accumulators = collectItemAccumulators(entries);

  for (const entry of entries) {
    const parent = posixDirname(entry.ref.relativePath);
    if (posixBasename(entry.ref.relativePath) === outlookHeadersFileName && parent in accumulators) {
      continue;
    }
    O.match(findOwnerItemDirectory(parent, accumulators), {
      onNone: () => undefined,
      onSome: (accumulator) => attributeItemFile(accumulator, entry),
    });
  }

  const directoryPaths = A.sort(Struct.keys(accumulators), Str.Order);
  return A.getSomes(
    A.map(directoryPaths, (directoryPath) =>
      O.map(O.fromUndefinedOr(accumulators[directoryPath]), (accumulator) => finalizeItem(accumulator, treeRootNames))
    )
  );
};

const drainStream = <E>(stream: Stream.Stream<Uint8Array, E>): Effect.Effect<void, E> => Stream.runDrain(stream);

const byRelativePath = Order.mapInput(Str.Order, (file: WalkedFile) => file.relativePath);
const byReferencePath = Order.mapInput(Str.Order, (reference: ArtifactReference) => reference.relativePath);

const nonPortablePathWarning = (sizeBytes: number): string =>
  `Skipped one exported child with a non-portable path (${sizeBytes} bytes).`;

const budgetSkippedWarning =
  "Skipped EML assembly for one exported item because the materialization budget was exceeded.";

const itemRecordSkippedWarning = "Skipped one exported item record with a non-portable path.";

const emlNameCollisionWarning =
  "Skipped EML assembly for one exported item because the export tree already contains Message.eml.";

const claimReleaseFailedWarning =
  "Failed to release the export target claim; remove the stale .claim path before re-exporting this source.";

/**
 * Create the real pffexport-backed file-processing engine.
 *
 * Captures the file system, path, and process-spawner services at
 * construction and probes `pffexport -V` once to populate
 * `descriptor.version`; a failed probe leaves the version unset rather than
 * failing construction. The returned engine's `exportArchive` method still
 * requires `effect/Crypto` so child artifact ids can be derived through the
 * shared SHA-backed artifact id schema.
 *
 * @example
 * ```ts
 * import { makePffexportFileProcessingEngine, PffexportEngineConfig } from "@beep/libpff"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const engine = yield* makePffexportFileProcessingEngine(
 *     PffexportEngineConfig.make({ exportRoot: "/tmp/pst-out" })
 *   )
 *   return engine.descriptor.engine
 * })
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @effects Requires {@link FileSystem.FileSystem}, {@link Path.Path}, and {@link ChildProcessSpawner.ChildProcessSpawner}; returned archive export effects additionally require `effect/Crypto` for child artifact id derivation.
 * @category constructors
 * @since 0.0.0
 */
export const makePffexportFileProcessingEngine = Effect.fn("Libpff.makePffexportFileProcessingEngine")(function* (
  config: PffexportEngineConfig
): Effect.fn.Return<
  FileProcessingEngineShape,
  never,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { exportFormat, exportMode, pffexportPath } = config;

  const spawnOptions = {
    forceKillAfter: `${defaultForceKillAfterMillis} millis`,
    stdin: "ignore",
    stderr: "pipe",
    stdout: "pipe",
  } as const;

  const version = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(ChildProcess.make(pffexportPath, ["-V"], spawnOptions));
      const [stdout, , exitCode] = yield* Effect.all(
        [handle.stdout.pipe(Stream.decodeText(), Stream.mkString), drainStream(handle.stderr), handle.exitCode],
        { concurrency: "unbounded" }
      );
      return exitCode === 0 ? O.some(stdout) : O.none<string>();
    })
  ).pipe(
    Effect.timeoutOrElse({
      duration: `${defaultForceKillAfterMillis} millis`,
      orElse: () => Effect.succeed(O.none<string>()),
    }),
    Effect.option,
    Effect.map(O.flatten),
    Effect.map(
      O.flatMap(
        flow(
          Str.match(versionOutputPattern),
          O.flatMap((matched) => O.fromUndefinedOr(matched[1])),
          O.map(Str.trim),
          O.filter(Str.isNonEmpty)
        )
      )
    )
  );

  const descriptor = FileProcessingEngineDescriptor.make({
    capabilities: LibpffFileProcessingEngineDescriptor.capabilities,
    engine: LibpffFileProcessingEngineDescriptor.engine,
    name: LibpffFileProcessingEngineDescriptor.name,
    supportedFormats: LibpffFileProcessingEngineDescriptor.supportedFormats,
    ...O.getSomesStruct({ version }),
  });

  const walkFiles = Effect.fn("Libpff.pffexport.walkFiles")(function* (
    root: string,
    directory: string
  ): Effect.fn.Return<Array<WalkedFile>, LibpffError> {
    const entries = yield* fs
      .readDirectory(directory)
      .pipe(Effect.mapError(() => makeLibpffError("process", { cause: "export tree read failed" })));
    const collected: Array<WalkedFile> = [];

    for (const entry of A.sort(entries, Str.Order)) {
      const absolutePath = path.join(directory, entry);
      const stat = yield* fs
        .stat(absolutePath)
        .pipe(Effect.mapError(() => makeLibpffError("process", { cause: "export tree stat failed" })));

      if (stat.type === "Directory") {
        const nested = yield* walkFiles(root, absolutePath);
        for (const file of nested) {
          collected.push(file);
        }
      } else if (stat.type === "File") {
        collected.push({
          absolutePath,
          relativePath: path.relative(root, absolutePath).split(path.sep).join("/"),
          sizeBytes: Number(stat.size),
        });
      }
    }

    return collected;
  });

  const runPffexport = Effect.fn("Libpff.pffexport.run")(function* (
    sourcePath: string,
    targetBase: string
  ): Effect.fn.Return<void, LibpffError> {
    const command = ChildProcess.make(
      pffexportPath,
      ["-f", exportFormat, "-m", exportMode, "-q", "-t", targetBase, sourcePath],
      spawnOptions
    );
    // Only a failed spawn means the engine is missing; a process that spawned
    // and then died from a signal (libpff segfaults on corrupt PSTs) is a
    // process failure, not a missing engine.
    const exitCode = yield* Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* spawner
          .spawn(command)
          .pipe(Effect.mapError(() => makeLibpffError("engine-unavailable", { cause: "pffexport spawn failed" })));
        const [, , code] = yield* Effect.all(
          [drainStream(handle.stdout), drainStream(handle.stderr), handle.exitCode],
          { concurrency: "unbounded" }
        ).pipe(Effect.mapError(() => makeLibpffError("process", { cause: "pffexport terminated abnormally" })));
        return code;
      })
    );

    if (exitCode !== 0) {
      return yield* makeLibpffError("process", { exitCode: NonNegativeInt.make(Math.max(0, exitCode)) });
    }
  });

  const enforceExistingExportPolicy = Effect.fn("Libpff.pffexport.enforceExistingExportPolicy")(function* (
    targetBase: string,
    messagesJsonlPath: string
  ): Effect.fn.Return<void, LibpffError> {
    const candidates: Array<string> = [];
    for (const suffix of allTargetTreeSuffixes) {
      candidates.push(`${targetBase}${suffix}`);
    }
    candidates.push(messagesJsonlPath);

    for (const candidate of candidates) {
      const exists = yield* fs
        .exists(candidate)
        .pipe(Effect.mapError(() => makeLibpffError("config", { cause: "export target check failed" })));
      if (!exists) {
        continue;
      }
      if (PffexportExistingExportPolicy.is.fail(config.existingExportPolicy)) {
        return yield* makeLibpffError("config", { cause: "export target already exists" });
      }
      yield* fs
        .remove(candidate, { recursive: true })
        .pipe(Effect.mapError(() => makeLibpffError("config", { cause: "stale export removal failed" })));
    }
  });

  const readItemText = (absolutePath: string): Effect.Effect<string, LibpffError> =>
    fs
      .readFileString(absolutePath)
      .pipe(Effect.mapError(() => makeLibpffError("process", { cause: "export item read failed" })));

  const readItemBytes = (absolutePath: string): Effect.Effect<Uint8Array, LibpffError> =>
    fs
      .readFile(absolutePath)
      .pipe(Effect.mapError(() => makeLibpffError("process", { cause: "export item read failed" })));

  const decodeChildPath = (value: string): Effect.Effect<O.Option<PosixPath>> =>
    S.decodeUnknownEffect(PosixPath)(value).pipe(Effect.option);

  const deriveChildId = (operation: ExportArchiveOperation, relativePath: string) =>
    deriveArtifactId([operation.source.id, relativePath]).pipe(
      Effect.mapError(() => makeLibpffError("process", { cause: "child artifact id derivation failed" }))
    );

  const runPffexportWithTimeout = (sourcePath: string, targetBase: string): Effect.Effect<void, LibpffError> =>
    O.match(config.timeoutMillis, {
      onNone: () => runPffexport(sourcePath, targetBase),
      onSome: (timeoutMillis) =>
        runPffexport(sourcePath, targetBase).pipe(
          Effect.timeoutOrElse({
            duration: `${timeoutMillis} millis`,
            orElse: () => Effect.fail(makeLibpffError("timeout")),
          })
        ),
    });

  const collectExportedFiles = Effect.fn("Libpff.pffexport.collectExportedFiles")(function* (
    targetBase: string,
    treeSuffixes: ReadonlyArray<string>
  ): Effect.fn.Return<Array<WalkedFile>, LibpffError> {
    const files: Array<WalkedFile> = [];
    for (const suffix of treeSuffixes) {
      const treeRoot = `${targetBase}${suffix}`;
      const treeExists = yield* fs
        .exists(treeRoot)
        .pipe(Effect.mapError(() => makeLibpffError("process", { cause: "export tree check failed" })));
      if (!treeExists) {
        continue;
      }
      for (const file of yield* walkFiles(config.exportRoot, treeRoot)) {
        files.push(file);
      }
    }
    return files;
  });

  const buildChildEntries = Effect.fn("Libpff.pffexport.buildChildEntries")(function* (
    operation: ExportArchiveOperation,
    files: ReadonlyArray<WalkedFile>,
    warnings: Array<string>
  ): Effect.fn.Return<Array<ExportedEntry>, LibpffError, Crypto.Crypto> {
    const entries: Array<ExportedEntry> = [];
    for (const file of A.sort(files, byRelativePath)) {
      const decoded = yield* decodeChildPath(file.relativePath);
      if (O.isNone(decoded)) {
        warnings.push(nonPortablePathWarning(file.sizeBytes));
        continue;
      }
      const childId = yield* deriveChildId(operation, decoded.value);
      entries.push({
        absolutePath: file.absolutePath,
        ref: ArtifactReference.make({
          id: childId,
          relativePath: decoded.value,
          sizeBytes: NonNegativeInt.make(file.sizeBytes),
        }),
      });
    }
    return entries;
  });

  const assembleItemEmlBytes = Effect.fn("Libpff.pffexport.assembleItemEmlBytes")(function* (
    operation: ExportArchiveOperation,
    item: ExportedItemDirectory,
    outlookHeaders: Readonly<Record<string, string>>
  ): Effect.fn.Return<Uint8Array, LibpffError, Crypto.Crypto> {
    const headerBlock = yield* O.match(item.internetHeaders, {
      onNone: () => Effect.succeed(synthesizeEmlHeaderBlock(outlookHeaders)),
      onSome: (entry) => readItemText(entry.absolutePath).pipe(Effect.map(stripMimeStructuralHeaders)),
    });
    const body = yield* O.match(item.body, {
      onNone: () => Effect.succeedNone,
      onSome: (entry) =>
        readItemText(entry.absolutePath).pipe(
          Effect.map((content) =>
            O.some({
              content,
              contentType: bodyContentTypeFor(posixBasename(entry.ref.relativePath)),
            })
          )
        ),
    });
    const attachments = yield* Effect.forEach(item.attachments, (entry) =>
      readItemBytes(entry.absolutePath).pipe(
        Effect.map((bytes) => ({ bytes, fileName: posixBasename(entry.ref.relativePath) }))
      )
    );
    const boundaryId = yield* deriveArtifactId([operation.source.id, item.directoryPath, "boundary"]).pipe(
      Effect.mapError(() => makeLibpffError("process", { cause: "child artifact id derivation failed" }))
    );
    const boundary = `=_beep-${boundaryId.slice(artifactIdPrefixLength, artifactIdPrefixLength + emlBoundaryHexLength)}`;
    const eml = yield* Effect.try({
      try: () => assembleEml({ attachments, body, boundary, headerBlock }),
      catch: () => makeLibpffError("process", { cause: "eml assembly failed" }),
    });
    return textEncoder.encode(eml);
  });

  const writeEmlArtifact = Effect.fn("Libpff.pffexport.writeEmlArtifact")(function* (
    operation: ExportArchiveOperation,
    item: ExportedItemDirectory,
    emlBytes: Uint8Array,
    warnings: Array<string>
  ): Effect.fn.Return<O.Option<ArtifactReference>, LibpffError, Crypto.Crypto> {
    const emlRelativePath = yield* decodeChildPath(`${item.directoryPath}/${PFFEXPORT_EML_FILE_NAME}`);
    if (O.isNone(emlRelativePath)) {
      warnings.push(nonPortablePathWarning(emlBytes.length));
      return O.none<ArtifactReference>();
    }
    yield* fs
      .writeFile(path.join(config.exportRoot, item.directoryPath, PFFEXPORT_EML_FILE_NAME), emlBytes)
      .pipe(Effect.mapError(() => makeLibpffError("process", { cause: "eml artifact write failed" })));
    const emlId = yield* deriveChildId(operation, emlRelativePath.value);
    return O.some(
      ArtifactReference.make({
        id: emlId,
        mediaType: "message/rfc822",
        relativePath: emlRelativePath.value,
        sizeBytes: NonNegativeInt.make(emlBytes.length),
      })
    );
  });

  const resolveItemEml = Effect.fn("Libpff.pffexport.resolveItemEml")(function* (
    operation: ExportArchiveOperation,
    item: ExportedItemDirectory,
    outlookHeaders: Readonly<Record<string, string>>,
    entryPathIndex: Readonly<Record<string, boolean>>,
    budget: O.Option<number>,
    state: EmlBudgetState,
    warnings: Array<string>
  ): Effect.fn.Return<O.Option<ArtifactReference>, LibpffError, Crypto.Crypto> {
    const qualifiesForEml =
      O.isSome(item.internetHeaders) ||
      O.exists(item.body, (entry) => A.contains(emlBodyFileNames, posixBasename(entry.ref.relativePath)));
    if (!qualifiesForEml) {
      return O.none<ArtifactReference>();
    }

    // Never overwrite engine output: an exported file already owns this
    // item's Message.eml name, so the snapshot reference stays truthful.
    if (R.has(entryPathIndex, `${item.directoryPath}/${PFFEXPORT_EML_FILE_NAME}`)) {
      warnings.push(emlNameCollisionWarning);
      return O.none<ArtifactReference>();
    }

    // Peak assembly memory is one message's parts; the raw byte sum of the
    // parts is a strict lower bound of the final EML size (base64 only
    // expands), so an over-budget item is skipped before any part is read.
    const emlLowerBoundBytes =
      O.match(item.body, { onNone: () => 0, onSome: (entry) => entry.ref.sizeBytes ?? 0 }) +
      A.reduce(item.attachments, 0, (total, entry) => total + (entry.ref.sizeBytes ?? 0));
    if (state.budgetExhausted || O.exists(budget, (limit) => state.materializedBytes + emlLowerBoundBytes > limit)) {
      state.budgetExhausted = true;
      warnings.push(budgetSkippedWarning);
      return O.none<ArtifactReference>();
    }

    const emlBytes = yield* assembleItemEmlBytes(operation, item, outlookHeaders);
    if (O.exists(budget, (limit) => state.materializedBytes + emlBytes.length > limit)) {
      state.budgetExhausted = true;
      warnings.push(budgetSkippedWarning);
      return O.none<ArtifactReference>();
    }

    state.materializedBytes += emlBytes.length;
    return yield* writeEmlArtifact(operation, item, emlBytes, warnings);
  });

  const writeMessagesJsonl = Effect.fn("Libpff.pffexport.writeMessagesJsonl")(function* (
    operation: ExportArchiveOperation,
    records: ReadonlyArray<PffexportMessageRecord>,
    messagesJsonlName: string,
    messagesJsonlPath: string,
    warnings: Array<string>
  ): Effect.fn.Return<O.Option<ArtifactReference>, LibpffError, Crypto.Crypto> {
    if (!A.isReadonlyArrayNonEmpty(records)) {
      return O.none<ArtifactReference>();
    }
    const lines = yield* Effect.forEach(records, (record) => PffexportMessageRecord.encodeJson(record)).pipe(
      Effect.mapError(() => makeLibpffError("process", { cause: "message record encoding failed" }))
    );
    const jsonlBytes = textEncoder.encode(`${A.join(lines, "\n")}\n`);
    yield* fs
      .writeFile(messagesJsonlPath, jsonlBytes)
      .pipe(Effect.mapError(() => makeLibpffError("process", { cause: "messages jsonl write failed" })));
    const jsonlRelativePath = yield* decodeChildPath(messagesJsonlName);
    if (O.isNone(jsonlRelativePath)) {
      warnings.push(nonPortablePathWarning(jsonlBytes.length));
      return O.none<ArtifactReference>();
    }
    const jsonlId = yield* deriveChildId(operation, jsonlRelativePath.value);
    return O.some(
      ArtifactReference.make({
        id: jsonlId,
        relativePath: jsonlRelativePath.value,
        sizeBytes: NonNegativeInt.make(jsonlBytes.length),
      })
    );
  });

  // Atomic target ownership: two concurrent exports of the same
  // content-addressed source derive identical target paths (duplicate PSTs
  // are common in real corpora), and an exists-check alone leaves a window
  // where both pass before either writes. A non-recursive mkdir is the
  // atomic claim, held for the run and always released. A present claim
  // refuses under EVERY policy — the driver cannot distinguish a live
  // concurrent export from a crashed run's leftover, so `replace` never
  // steals; recovering a crashed run means removing the `.claim` path (or
  // choosing a fresh export root) explicitly.
  const acquireExportClaim = Effect.fn("Libpff.pffexport.acquireExportClaim")(function* (
    claimPath: string
  ): Effect.fn.Return<void, LibpffError> {
    const acquired = O.isSome(yield* fs.makeDirectory(claimPath).pipe(Effect.option));
    if (!acquired) {
      return yield* makeLibpffError("config", { cause: "export target is claimed by another export" });
    }
  });

  const performExport = Effect.fn("LibpffPffexportEngine.performExport")(function* (
    operation: ExportArchiveOperation,
    targetBase: string,
    claimPath: string,
    messagesJsonlName: string,
    messagesJsonlPath: string
  ): Effect.fn.Return<ArchiveExportResult, LibpffError, Crypto.Crypto> {
    const sourcePath = operation.source.locator.value;
    const treeSuffixes = targetTreeSuffixesFor(exportMode);
    const treeRootNames = A.map(treeSuffixes, (suffix) => `${operation.source.id}${suffix}`);

    yield* enforceExistingExportPolicy(targetBase, messagesJsonlPath);
    yield* runPffexportWithTimeout(sourcePath, targetBase);

    const warnings: Array<string> = [];
    const files = yield* collectExportedFiles(targetBase, treeSuffixes);
    const entries = yield* buildChildEntries(operation, files, warnings);
    const children: Array<ArtifactReference> = A.map(entries, (entry) => entry.ref);

    const entryPathIndex: Record<string, boolean> = {};
    for (const entry of entries) {
      entryPathIndex[entry.ref.relativePath] = true;
    }

    const budget = O.fromUndefinedOr(operation.maxMaterializedBytes);
    const state: EmlBudgetState = { budgetExhausted: false, materializedBytes: 0 };
    const records: Array<PffexportMessageRecord> = [];

    for (const item of classifyExportedItems(entries, treeRootNames)) {
      const outlookHeaders = parseOutlookHeaders(yield* readItemText(item.outlookHeaders.absolutePath));
      const folderPath = yield* decodeChildPath(item.folderPath);
      const messagePath = yield* decodeChildPath(item.directoryPath);
      if (O.isNone(folderPath) || O.isNone(messagePath)) {
        warnings.push(itemRecordSkippedWarning);
        continue;
      }

      const emlRef = yield* resolveItemEml(operation, item, outlookHeaders, entryPathIndex, budget, state, warnings);
      if (O.isSome(emlRef)) {
        children.push(emlRef.value);
      }
      records.push(
        PffexportMessageRecord.make({
          attachments: A.map(item.attachments, (entry) => entry.ref),
          folderPath: folderPath.value,
          headers: outlookHeaders,
          messagePath: messagePath.value,
          ...O.getSomesStruct({ body: O.map(item.body, (entry) => entry.ref), eml: emlRef }),
        })
      );
    }

    const jsonlRef = yield* writeMessagesJsonl(operation, records, messagesJsonlName, messagesJsonlPath, warnings);
    if (O.isSome(jsonlRef)) {
      children.push(jsonlRef.value);
    }

    if (A.length(children) === 0) {
      warnings.push("pffexport produced no exported children for this archive.");
    }

    // Release on the success path surfaces a stuck claim as result data; the
    // caller's `ensuring` backstop stays silent because failure paths already
    // carry their own error.
    const claimReleased = O.isSome(yield* fs.remove(claimPath, { recursive: true }).pipe(Effect.option));
    if (!claimReleased) {
      warnings.push(claimReleaseFailedWarning);
    }

    return ArchiveExportResult.make({
      children: A.sort(children, byReferencePath),
      engine: LibpffFileProcessingEngineDescriptor.name,
      operationId: operation.operationId,
      sourceArtifactId: operation.source.id,
      warnings,
    });
  });

  const exportArchiveImpl = Effect.fn("LibpffPffexportEngine.exportArchiveImpl")(function* (
    operation: ExportArchiveOperation
  ): Effect.fn.Return<ArchiveExportResult, LibpffError, Crypto.Crypto> {
    const targetBase = path.join(config.exportRoot, operation.source.id);
    const claimPath = `${targetBase}${PFFEXPORT_CLAIM_SUFFIX}`;
    const messagesJsonlName = `${operation.source.id}${PFFEXPORT_MESSAGES_SUFFIX}`;
    const messagesJsonlPath = path.join(config.exportRoot, messagesJsonlName);

    yield* fs
      .makeDirectory(config.exportRoot, { recursive: true })
      .pipe(Effect.mapError(() => makeLibpffError("config", { cause: "export root could not be created" })));

    yield* acquireExportClaim(claimPath);
    return yield* performExport(operation, targetBase, claimPath, messagesJsonlName, messagesJsonlPath).pipe(
      Effect.ensuring(fs.remove(claimPath, { recursive: true }).pipe(Effect.ignore))
    );
  });

  const engine: FileProcessingEngineShape = {
    descriptor,
    detect: LibpffFileProcessingEngine.detect,
    exportArchive: Effect.fn("LibpffPffexportEngine.exportArchive")(function* (operation) {
      if (operation.format !== "pst") {
        return yield* FileProcessingOperationError.fromReason("unsupported-file-format", {
          artifactId: operation.source.id,
          engine: LibpffFileProcessingEngineDescriptor.name,
          format: operation.format,
          message: `pffexport only exports PST archives, not ${operation.format}.`,
          operationId: operation.operationId,
        });
      }

      if (operation.source.locator.kind !== "file") {
        return yield* FileProcessingOperationError.fromReason("archive-export-failed", {
          artifactId: operation.source.id,
          engine: LibpffFileProcessingEngineDescriptor.name,
          format: operation.format,
          message: "pffexport requires a file locator for the source archive.",
          operationId: operation.operationId,
        });
      }

      return yield* exportArchiveImpl(operation).pipe(
        Effect.mapError((error) => libpffOperationError(operation, error))
      );
    }),
    extract: Effect.fn("LibpffPffexportEngine.extract")(function* (operation: ExtractFileOperation) {
      return yield* FileProcessingOperationError.fromReason("unsupported-file-format", {
        artifactId: operation.source.id,
        engine: LibpffFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: "pffexport does not expose direct text extraction; export archive children instead.",
        operationId: operation.operationId,
      });
    }),
  };

  return engine;
});
