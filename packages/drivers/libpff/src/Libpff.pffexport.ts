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
const sandboxRuntimeRoots: ReadonlyArray<string> = ["/usr", "/bin", "/sbin", "/lib", "/lib64", "/etc", "/var"];
const PffexportModeBase = LiteralKit(["all", "items", "recovered"]);
const PffexportFormatBase = LiteralKit(["all", "html", "rtf", "text"]);
const PffexportExistingExportPolicyBase = LiteralKit(["fail", "replace"]);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
    bwrapPath: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Optional bubblewrap executable used to isolate untrusted archive parsing from the network, parent environment, and writable host filesystem.",
      })
    ),
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
    maxOutputBytes: S.OptionFromOptionalKey(PosInt).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Positive hard ceiling for all raw and derived bytes retained by one archive export.",
      })
    ),
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
      "Configuration for the real pffexport subprocess engine: target export root, binary path, mode, format, existing-export policy, optional sandbox, and optional per-archive timeout.",
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
  materializedBytes: number;
}

interface ResolvedExportedMessage {
  readonly emlRef: O.Option<ArtifactReference>;
  readonly record: PffexportMessageRecord;
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

const captureBoundedProcessText = <E>(stream: Stream.Stream<Uint8Array, E>): Effect.Effect<string, E> =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (captured, chunk) => Str.takeLeft(4_096)(`${captured}${chunk}`)
    )
  );

const classifyProcessFailure = (stderr: string): O.Option<"codepage" | "corrupt" | "password"> => {
  const normalized = Str.toLowerCase(stderr);
  if (Str.includes("password")(normalized) || Str.includes("encrypted")(normalized)) return O.some("password");
  if (Str.includes("codepage")(normalized) || Str.includes("code page")(normalized)) return O.some("codepage");
  if (Str.includes("corrupt")(normalized) || Str.includes("invalid")(normalized)) return O.some("corrupt");
  return O.none();
};

const byRelativePath = Order.mapInput(Str.Order, (file: WalkedFile) => file.relativePath);
const byReferencePath = Order.mapInput(Str.Order, (reference: ArtifactReference) => reference.relativePath);

const nonPortablePathWarning = (sizeBytes: number): string =>
  `Skipped one exported child with a non-portable path (${sizeBytes} bytes).`;

const budgetSkippedWarning =
  "Skipped EML assembly for one exported item because the materialization budget was exceeded.";
const defaultMaxMaterializedBytes = 64 * 1024 * 1024;

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
 * shared SHA-backed artifact id schema. File-backed source artifacts are
 * passed to `pffexport` by path; in-memory artifacts use a private temporary
 * snapshot.
 *
 * **Example** (Usage)
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

  const spawnOptions: ChildProcess.CommandOptions = {
    forceKillAfter: `${defaultForceKillAfterMillis} millis`,
    stdin: "ignore",
    stderr: "pipe",
    stdout: "pipe",
  };

  const resolvePffexportExecutable = Effect.fn("Libpff.pffexport.resolveExecutable")(function* () {
    const candidate = path.isAbsolute(pffexportPath)
      ? pffexportPath
      : yield* Effect.scoped(
          Effect.gen(function* () {
            const handle = yield* spawner
              .spawn(
                ChildProcess.make(
                  "/bin/sh",
                  ["-c", 'command -v -- "$1"', "pffexport-resolver", pffexportPath],
                  spawnOptions
                )
              )
              .pipe(
                Effect.mapError(() => makeLibpffError("engine-unavailable", { cause: "pffexport resolution failed" }))
              );
            const [stdout, , exitCode] = yield* Effect.all(
              [captureBoundedProcessText(handle.stdout), drainStream(handle.stderr), handle.exitCode],
              { concurrency: "unbounded" }
            );
            const resolved = Str.trim(stdout);
            if (exitCode !== 0 || Str.isEmpty(resolved) || Str.includes("\n")(resolved)) {
              return yield* makeLibpffError("engine-unavailable", { cause: "pffexport resolution failed" });
            }
            return resolved;
          })
        );
    const absoluteCandidate = path.isAbsolute(candidate) ? candidate : path.resolve(candidate);
    const canonical = yield* fs
      .realPath(absoluteCandidate)
      .pipe(Effect.mapError(() => makeLibpffError("engine-unavailable", { cause: "pffexport resolution failed" })));
    const info = yield* fs
      .stat(canonical)
      .pipe(Effect.mapError(() => makeLibpffError("engine-unavailable", { cause: "pffexport resolution failed" })));
    if (info.type !== "File") {
      return yield* makeLibpffError("engine-unavailable", { cause: "pffexport is not a regular file" });
    }
    return canonical;
  });

  const resolvedPffexportPath = yield* resolvePffexportExecutable().pipe(Effect.option);
  const hostPffexportPath = O.getOrElse(resolvedPffexportPath, () => pffexportPath);

  const sandboxRuntimeBinds = Effect.fn("Libpff.pffexport.sandboxRuntimeBinds")(function* () {
    const binds: Array<string> = [];
    for (const root of sandboxRuntimeRoots) {
      if (yield* fs.exists(root).pipe(Effect.orElseSucceed(() => false))) {
        binds.push("--ro-bind", root, root);
      }
    }
    return binds;
  });

  const sandboxRuntimeCovers = (candidate: string): boolean =>
    A.some(sandboxRuntimeRoots, (root) => {
      const relative = path.relative(root, candidate);
      return (
        relative === "" ||
        (!path.isAbsolute(relative) && relative !== ".." && !Str.startsWith(`..${path.sep}`)(relative))
      );
    });

  const runtimePrefixFor = (executable: string): string => {
    const executableDirectory = path.dirname(executable);
    return A.contains(["bin", "sbin"], path.basename(executableDirectory))
      ? path.dirname(executableDirectory)
      : executableDirectory;
  };

  const sandboxEnvShebangBinds = Effect.fn("Libpff.pffexport.sandboxEnvShebangBinds")(function* (
    shebangParts: ReadonlyArray<string>
  ): Effect.fn.Return<ReadonlyArray<string>, LibpffError> {
    const envCommand = A.findFirst(
      shebangParts.slice(1),
      (part) => !Str.isEmpty(part) && !Str.startsWith("-")(part) && !Str.includes("=")(part)
    );
    if (O.isNone(envCommand) || !/^[A-Za-z0-9._+-]+$/u.test(envCommand.value)) {
      return yield* makeLibpffError("config", { cause: "sandbox env shebang command is unsupported" });
    }
    const resolvedEnvInterpreter = yield* Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* spawner.spawn(
          ChildProcess.make(
            "/bin/sh",
            ["-c", 'command -v -- "$1"', "shebang-interpreter-resolver", envCommand.value],
            spawnOptions
          )
        );
        const [stdout, , exitCode] = yield* Effect.all(
          [captureBoundedProcessText(handle.stdout), drainStream(handle.stderr), handle.exitCode],
          { concurrency: "unbounded" }
        );
        const resolved = Str.trim(stdout);
        if (exitCode !== 0 || Str.isEmpty(resolved) || Str.includes("\n")(resolved)) {
          return yield* makeLibpffError("engine-unavailable", { cause: "env shebang interpreter resolution failed" });
        }
        return resolved;
      })
    ).pipe(
      Effect.mapError(() =>
        makeLibpffError("engine-unavailable", { cause: "env shebang interpreter resolution failed" })
      )
    );
    const canonicalEnvInterpreter = yield* fs
      .realPath(resolvedEnvInterpreter)
      .pipe(
        Effect.mapError(() =>
          makeLibpffError("engine-unavailable", { cause: "env shebang interpreter resolution failed" })
        )
      );
    const envInterpreterInfo = yield* fs
      .stat(canonicalEnvInterpreter)
      .pipe(
        Effect.mapError(() =>
          makeLibpffError("engine-unavailable", { cause: "env shebang interpreter resolution failed" })
        )
      );
    if (envInterpreterInfo.type !== "File") {
      return yield* makeLibpffError("engine-unavailable", { cause: "env shebang interpreter is not a regular file" });
    }
    const envRuntimePrefixes = A.dedupe(
      A.filter(
        [runtimePrefixFor(resolvedEnvInterpreter), runtimePrefixFor(canonicalEnvInterpreter)],
        (runtimePrefix) => !sandboxRuntimeCovers(runtimePrefix)
      )
    );
    if (A.some(envRuntimePrefixes, (runtimePrefix) => runtimePrefix === path.parse(runtimePrefix).root)) {
      return yield* makeLibpffError("config", { cause: "sandbox env interpreter bind cannot expose the host root" });
    }
    return [
      ...A.flatMap(envRuntimePrefixes, (runtimePrefix) => ["--ro-bind", runtimePrefix, runtimePrefix]),
      "--setenv",
      "PATH",
      `${path.dirname(resolvedEnvInterpreter)}:/usr/bin:/bin`,
    ];
  });

  const sandboxInterpreterBinds = Effect.fn("Libpff.pffexport.sandboxInterpreterBinds")(function* (
    interpreters: ReadonlyArray<string>
  ): Effect.fn.Return<ReadonlyArray<string>, LibpffError> {
    const binds: Array<string> = [];
    for (const interpreter of interpreters) {
      if (sandboxRuntimeCovers(interpreter)) continue;
      const runtimePrefix = runtimePrefixFor(interpreter);
      if (runtimePrefix === path.parse(runtimePrefix).root) {
        return yield* makeLibpffError("config", { cause: "sandbox runtime bind cannot expose the host root" });
      }
      if (!A.contains(binds, runtimePrefix)) binds.push(runtimePrefix);
    }
    return A.flatMap(binds, (runtimePrefix) => ["--ro-bind", runtimePrefix, runtimePrefix]);
  });

  const sandboxShebangBinds = Effect.fn("Libpff.pffexport.sandboxShebangBinds")(function* (
    executable: string
  ): Effect.fn.Return<ReadonlyArray<string>, LibpffError> {
    const shebang = yield* Effect.scoped(
      fs.open(executable, { flag: "r" }).pipe(
        Effect.flatMap((handle) => handle.readAlloc(4096)),
        Effect.map((bytes) => O.getOrElse(bytes, () => new Uint8Array()))
      )
    ).pipe(
      Effect.mapError(() =>
        makeLibpffError("engine-unavailable", { cause: "pffexport interpreter inspection failed" })
      ),
      Effect.map((bytes) => textDecoder.decode(bytes)),
      Effect.map((contents) => Str.split("\n")(contents)[0] ?? ""),
      Effect.map((firstLine) => (Str.startsWith("#!")(firstLine) ? Str.trim(Str.slice(2)(firstLine)) : ""))
    );
    const shebangParts = shebang.split(/\s+/u);
    const prefix = shebangParts[0] ?? "";
    if (Str.isEmpty(prefix) || !path.isAbsolute(prefix)) return [];

    const canonicalInterpreter = yield* fs
      .realPath(prefix)
      .pipe(
        Effect.mapError(() =>
          makeLibpffError("engine-unavailable", { cause: "pffexport interpreter resolution failed" })
        )
      );
    const interpreterInfo = yield* fs
      .stat(canonicalInterpreter)
      .pipe(
        Effect.mapError(() =>
          makeLibpffError("engine-unavailable", { cause: "pffexport interpreter resolution failed" })
        )
      );
    if (interpreterInfo.type !== "File") {
      return yield* makeLibpffError("engine-unavailable", { cause: "pffexport interpreter is not a regular file" });
    }

    const bindArguments = yield* sandboxInterpreterBinds([prefix, canonicalInterpreter]);
    if (path.basename(prefix) !== "env") return bindArguments;

    return [...bindArguments, ...(yield* sandboxEnvShebangBinds(shebangParts))];
  });

  const sandboxedPffexportCommand = Effect.fn("Libpff.pffexport.sandboxedCommand")(function* (
    bwrapPath: string,
    sourcePath: string,
    targetBase: string
  ): Effect.fn.Return<ReturnType<typeof ChildProcess.make>, LibpffError> {
    const relativeTarget = path.relative(config.exportRoot, targetBase);
    if (path.isAbsolute(relativeTarget) || relativeTarget === ".." || Str.startsWith(`..${path.sep}`)(relativeTarget)) {
      return yield* makeLibpffError("config", { cause: "sandbox target escaped export root" });
    }
    const sandboxTarget = `/output/${A.join(Str.split(path.sep)(relativeTarget), "/")}`;
    if (!path.isAbsolute(hostPffexportPath)) {
      return yield* makeLibpffError("engine-unavailable", {
        cause: "sandboxed pffexport executable could not be resolved",
      });
    }
    const runtimeCoversPffexport = sandboxRuntimeCovers(hostPffexportPath);
    const sandboxExecutable = hostPffexportPath;
    const executableRuntimePrefix = runtimePrefixFor(hostPffexportPath);
    if (!runtimeCoversPffexport && executableRuntimePrefix === path.parse(executableRuntimePrefix).root) {
      return yield* makeLibpffError("config", { cause: "sandbox executable bind cannot expose the host root" });
    }
    const executableBind = runtimeCoversPffexport
      ? []
      : ["--ro-bind", executableRuntimePrefix, executableRuntimePrefix];
    return ChildProcess.make(
      bwrapPath,
      [
        "--die-with-parent",
        "--new-session",
        "--unshare-all",
        "--clearenv",
        ...(yield* sandboxRuntimeBinds()),
        "--proc",
        "/proc",
        "--dev",
        "/dev",
        "--tmpfs",
        "/tmp",
        "--dir",
        "/input",
        "--dir",
        "/output",
        ...executableBind,
        "--setenv",
        "PATH",
        "/usr/bin:/bin",
        ...(yield* sandboxShebangBinds(hostPffexportPath)),
        "--ro-bind",
        sourcePath,
        "/input/source.pst",
        "--bind",
        config.exportRoot,
        "/output",
        "--setenv",
        "HOME",
        "/tmp",
        "--setenv",
        "LANG",
        "C.UTF-8",
        "--",
        sandboxExecutable,
        "-f",
        exportFormat,
        "-m",
        exportMode,
        "-q",
        "-t",
        sandboxTarget,
        "/input/source.pst",
      ],
      spawnOptions
    );
  });

  const pffexportCommand = Effect.fn("Libpff.pffexport.command")(function* (
    sourcePath: string,
    targetBase: string
  ): Effect.fn.Return<ReturnType<typeof ChildProcess.make>, LibpffError> {
    return yield* O.match(config.bwrapPath, {
      onNone: () =>
        Effect.succeed(
          ChildProcess.make(
            hostPffexportPath,
            ["-f", exportFormat, "-m", exportMode, "-q", "-t", targetBase, sourcePath],
            spawnOptions
          )
        ),
      onSome: (bwrapPath) => sandboxedPffexportCommand(bwrapPath, sourcePath, targetBase),
    });
  });

  const version = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(ChildProcess.make(hostPffexportPath, ["-V"], spawnOptions));
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

  const requireCanonicalExportEntry = Effect.fn("Libpff.pffexport.requireCanonicalExportEntry")(function* (
    canonicalRoot: string,
    absolutePath: string
  ): Effect.fn.Return<FileSystem.File.Info, LibpffError> {
    if (O.isSome(yield* fs.readLink(absolutePath).pipe(Effect.option))) {
      return yield* makeLibpffError("process", { cause: "export tree contains a symbolic link" });
    }
    const canonicalPath = yield* fs
      .realPath(absolutePath)
      .pipe(Effect.mapError(() => makeLibpffError("process", { cause: "export entry resolution failed" })));
    const relativeCanonicalPath = path.relative(canonicalRoot, canonicalPath);
    if (
      path.isAbsolute(relativeCanonicalPath) ||
      relativeCanonicalPath === ".." ||
      Str.startsWith(`..${path.sep}`)(relativeCanonicalPath)
    ) {
      return yield* makeLibpffError("process", { cause: "export entry escaped the export root" });
    }
    return yield* fs
      .stat(absolutePath)
      .pipe(Effect.mapError(() => makeLibpffError("process", { cause: "export tree stat failed" })));
  });

  const walkFilesWithin = Effect.fn("Libpff.pffexport.walkFilesWithin")(function* (
    canonicalRoot: string,
    root: string,
    directory: string
  ): Effect.fn.Return<Array<WalkedFile>, LibpffError> {
    const entries = yield* fs
      .readDirectory(directory)
      .pipe(Effect.mapError(() => makeLibpffError("process", { cause: "export tree read failed" })));
    const collected: Array<WalkedFile> = [];

    for (const entry of A.sort(entries, Str.Order)) {
      const absolutePath = path.join(directory, entry);
      const stat = yield* requireCanonicalExportEntry(canonicalRoot, absolutePath);

      if (stat.type === "Directory") {
        const nested = yield* walkFilesWithin(canonicalRoot, root, absolutePath);
        for (const file of nested) {
          collected.push(file);
        }
      } else if (stat.type === "File") {
        collected.push({
          absolutePath,
          relativePath: A.join(Str.split(path.sep)(path.relative(root, absolutePath)), "/"),
          sizeBytes: Number(stat.size),
        });
      } else {
        return yield* makeLibpffError("process", { cause: "export tree contains a non-regular entry" });
      }
    }

    return collected;
  });

  const walkFiles = Effect.fn("Libpff.pffexport.walkFiles")(function* (
    root: string,
    directory: string
  ): Effect.fn.Return<Array<WalkedFile>, LibpffError> {
    const canonicalRoot = yield* fs
      .realPath(root)
      .pipe(Effect.mapError(() => makeLibpffError("process", { cause: "export root resolution failed" })));
    return yield* walkFilesWithin(canonicalRoot, root, directory);
  });

  const runPffexport = Effect.fn("Libpff.pffexport.run")(function* (
    sourcePath: string,
    targetBase: string
  ): Effect.fn.Return<void, LibpffError> {
    const command = yield* pffexportCommand(sourcePath, targetBase);
    // Only a failed spawn means the engine is missing; a process that spawned
    // and then died from a signal (libpff segfaults on corrupt PSTs) is a
    // process failure, not a missing engine.
    const { exitCode, stderr } = yield* Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* spawner
          .spawn(command)
          .pipe(Effect.mapError(() => makeLibpffError("engine-unavailable", { cause: "pffexport spawn failed" })));
        const processResult = Effect.all(
          [drainStream(handle.stdout), captureBoundedProcessText(handle.stderr), handle.exitCode],
          { concurrency: "unbounded" }
        ).pipe(
          Effect.map(([, capturedStderr, code]) => ({ exitCode: code, stderr: capturedStderr })),
          Effect.mapError(() => makeLibpffError("process", { cause: "pffexport terminated abnormally" }))
        );
        const monitor = O.match(config.maxOutputBytes, {
          onNone: () => Effect.never,
          onSome: (maxOutputBytes) => monitorOutputBytes(handle, targetBase, maxOutputBytes),
        });
        const stopProcess = handle.kill({ forceKillAfter: "1 second" }).pipe(Effect.ignore);
        const watchedProcess = Effect.raceFirst(processResult, monitor);
        const timedProcess = O.match(config.timeoutMillis, {
          onNone: () => watchedProcess,
          onSome: (timeoutMillis) =>
            watchedProcess.pipe(
              Effect.timeoutOrElse({
                duration: `${timeoutMillis} millis`,
                orElse: () => Effect.fail(makeLibpffError("timeout")),
              })
            ),
        });
        return yield* timedProcess.pipe(
          Effect.catch((error) => stopProcess.pipe(Effect.andThen(Effect.fail(error)))),
          Effect.onInterrupt(() => stopProcess)
        );
      })
    );

    if (exitCode !== 0) {
      return yield* makeLibpffError("process", {
        exitCode: NonNegativeInt.make(Math.max(0, exitCode)),
        ...O.getSomesStruct({ processClassification: classifyProcessFailure(stderr) }),
      });
    }
  });

  const measureRawOutputBytes = Effect.fn("Libpff.pffexport.measureRawOutputBytes")(function* (
    targetBase: string
  ): Effect.fn.Return<number, LibpffError> {
    let total = 0;
    for (const suffix of allTargetTreeSuffixes) {
      const treeRoot = `${targetBase}${suffix}`;
      const exists = yield* fs
        .exists(treeRoot)
        .pipe(Effect.mapError(() => makeLibpffError("output-limit", { cause: "export output check failed" })));
      if (!exists) continue;
      const files = yield* walkFiles(config.exportRoot, treeRoot);
      total = A.reduce(files, total, (bytes, file) => bytes + file.sizeBytes);
    }
    return total;
  });

  const monitorOutputBytes = Effect.fn("Libpff.pffexport.monitorOutputBytes")(function* (
    handle: ChildProcessSpawner.ChildProcessHandle,
    targetBase: string,
    maxOutputBytes: number
  ): Effect.fn.Return<never, LibpffError> {
    while (true) {
      yield* Effect.sleep("20 millis");
      const retainedBytes = yield* measureRawOutputBytes(targetBase);
      if (retainedBytes > maxOutputBytes) {
        yield* handle.kill({ killSignal: "SIGKILL" }).pipe(Effect.ignore);
        return yield* makeLibpffError("output-limit", { cause: "pffexport output ceiling exceeded" });
      }
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
    S.decodeEffect(PosixPath)(value).pipe(Effect.option);

  const deriveChildId = (operation: ExportArchiveOperation, relativePath: string) =>
    deriveArtifactId([operation.source.id, relativePath]).pipe(
      Effect.mapError(() => makeLibpffError("process", { cause: "child artifact id derivation failed" }))
    );

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
    if (O.exists(budget, (limit) => state.materializedBytes + emlLowerBoundBytes > limit)) {
      warnings.push(budgetSkippedWarning);
      return O.none<ArtifactReference>();
    }

    const emlBytes = yield* assembleItemEmlBytes(operation, item, outlookHeaders);
    if (O.exists(budget, (limit) => state.materializedBytes + emlBytes.length > limit)) {
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
    budget: O.Option<number>,
    state: EmlBudgetState,
    warnings: Array<string>
  ): Effect.fn.Return<O.Option<ArtifactReference>, LibpffError, Crypto.Crypto> {
    if (!A.isReadonlyArrayNonEmpty(records)) {
      return O.none<ArtifactReference>();
    }
    const lines = yield* Effect.forEach(records, (record) => PffexportMessageRecord.encodeJson(record)).pipe(
      Effect.mapError(() => makeLibpffError("process", { cause: "message record encoding failed" }))
    );
    const jsonlBytes = textEncoder.encode(`${A.join(lines, "\n")}\n`);
    if (O.exists(budget, (limit) => state.materializedBytes + jsonlBytes.length > limit)) {
      return yield* makeLibpffError("output-limit", { cause: "messages metadata exceeds export output ceiling" });
    }
    yield* fs
      .writeFile(messagesJsonlPath, jsonlBytes)
      .pipe(Effect.mapError(() => makeLibpffError("process", { cause: "messages jsonl write failed" })));
    state.materializedBytes += jsonlBytes.length;
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
    yield* fs
      .makeDirectory(claimPath)
      .pipe(
        Effect.mapError((error) =>
          error.reason._tag === "AlreadyExists"
            ? makeLibpffError("config", { cause: "export target is claimed by another export" })
            : makeLibpffError("config", { cause: "export claim could not be created" })
        )
      );
  });

  const resolveExportedMessage = Effect.fn("Libpff.pffexport.resolveExportedMessage")(function* (input: {
    readonly budget: O.Option<number>;
    readonly entryPathIndex: Readonly<Record<string, boolean>>;
    readonly item: ExportedItemDirectory;
    readonly operation: ExportArchiveOperation;
    readonly state: EmlBudgetState;
    readonly warnings: Array<string>;
  }): Effect.fn.Return<O.Option<ResolvedExportedMessage>, LibpffError, Crypto.Crypto> {
    const outlookHeaders = parseOutlookHeaders(yield* readItemText(input.item.outlookHeaders.absolutePath));
    const folderPath = yield* decodeChildPath(input.item.folderPath);
    const messagePath = yield* decodeChildPath(input.item.directoryPath);
    if (O.isNone(folderPath) || O.isNone(messagePath)) {
      input.warnings.push(itemRecordSkippedWarning);
      return O.none<ResolvedExportedMessage>();
    }

    const emlRef = yield* resolveItemEml(
      input.operation,
      input.item,
      outlookHeaders,
      input.entryPathIndex,
      input.budget,
      input.state,
      input.warnings
    );
    return O.some({
      emlRef,
      record: PffexportMessageRecord.make({
        attachments: A.map(input.item.attachments, (entry) => entry.ref),
        folderPath: folderPath.value,
        headers: outlookHeaders,
        messagePath: messagePath.value,
        ...O.getSomesStruct({ body: O.map(input.item.body, (entry) => entry.ref), eml: emlRef }),
      }),
    });
  });

  const requireRawOutputWithinLimit = Effect.fn("Libpff.pffexport.requireRawOutputWithinLimit")(function* (
    rawOutputBytes: number
  ): Effect.fn.Return<void, LibpffError> {
    if (O.exists(config.maxOutputBytes, (limit) => rawOutputBytes > limit)) {
      return yield* makeLibpffError("output-limit", { cause: "pffexport output ceiling exceeded" });
    }
  });

  const releaseSuccessfulExportClaim = Effect.fn("Libpff.pffexport.releaseSuccessfulClaim")(function* (
    claimPath: string,
    warnings: Array<string>
  ) {
    const claimReleased = O.isSome(yield* fs.remove(claimPath, { recursive: true }).pipe(Effect.option));
    if (!claimReleased) warnings.push(claimReleaseFailedWarning);
  });

  const performExport = Effect.fn("LibpffPffexportEngine.performExport")(function* (
    operation: ExportArchiveOperation,
    sourcePath: string,
    targetBase: string,
    claimPath: string,
    messagesJsonlName: string,
    messagesJsonlPath: string
  ): Effect.fn.Return<ArchiveExportResult, LibpffError, Crypto.Crypto> {
    const treeSuffixes = targetTreeSuffixesFor(exportMode);
    const treeRootNames = A.map(treeSuffixes, (suffix) => `${operation.source.id}${suffix}`);

    yield* enforceExistingExportPolicy(targetBase, messagesJsonlPath);
    yield* runPffexport(sourcePath, targetBase);

    const warnings: Array<string> = [];
    const files = yield* collectExportedFiles(targetBase, treeSuffixes);
    const rawOutputBytes = A.reduce(files, 0, (bytes, file) => bytes + file.sizeBytes);
    yield* requireRawOutputWithinLimit(rawOutputBytes);
    const entries = yield* buildChildEntries(operation, files, warnings);
    const children: Array<ArtifactReference> = A.map(entries, (entry) => entry.ref);

    const entryPathIndex: Record<string, boolean> = {};
    for (const entry of entries) {
      entryPathIndex[entry.ref.relativePath] = true;
    }

    const operationBudget = operation.maxMaterializedBytes ?? defaultMaxMaterializedBytes;
    const totalDerivedBudget = O.map(config.maxOutputBytes, (limit) => limit - rawOutputBytes);
    const emlBudget = O.some(
      O.match(config.maxOutputBytes, {
        onNone: () => operationBudget,
        onSome: (limit) => Math.min(operationBudget, limit - rawOutputBytes),
      })
    );
    const state: EmlBudgetState = { materializedBytes: 0 };
    const records: Array<PffexportMessageRecord> = [];

    const resolvedMessages = yield* Effect.forEach(classifyExportedItems(entries, treeRootNames), (item) =>
      resolveExportedMessage({ budget: emlBudget, entryPathIndex, item, operation, state, warnings })
    );
    for (const resolved of A.getSomes(resolvedMessages)) {
      if (O.isSome(resolved.emlRef)) {
        children.push(resolved.emlRef.value);
      }
      records.push(resolved.record);
    }

    const jsonlRef = yield* writeMessagesJsonl(
      operation,
      records,
      messagesJsonlName,
      messagesJsonlPath,
      totalDerivedBudget,
      state,
      warnings
    );
    if (O.isSome(jsonlRef)) {
      children.push(jsonlRef.value);
    }

    if (A.length(children) === 0) {
      warnings.push("pffexport produced no exported children for this archive.");
    }

    // Release on the success path surfaces a stuck claim as result data; the
    // caller's `ensuring` backstop stays silent because failure paths already
    // carry their own error.
    yield* releaseSuccessfulExportClaim(claimPath, warnings);

    return ArchiveExportResult.make({
      children: A.sort(children, byReferencePath),
      engine: LibpffFileProcessingEngineDescriptor.name,
      operationId: operation.operationId,
      sourceArtifactId: operation.source.id,
      warnings,
    });
  });

  const exportArchiveImpl = Effect.fn("LibpffPffexportEngine.exportArchiveImpl")(function* (
    operation: ExportArchiveOperation,
    sourcePath: string
  ): Effect.fn.Return<ArchiveExportResult, LibpffError, Crypto.Crypto> {
    const targetBase = path.join(config.exportRoot, operation.source.id);
    const claimPath = `${targetBase}${PFFEXPORT_CLAIM_SUFFIX}`;
    const messagesJsonlName = `${operation.source.id}${PFFEXPORT_MESSAGES_SUFFIX}`;
    const messagesJsonlPath = path.join(config.exportRoot, messagesJsonlName);

    yield* fs
      .makeDirectory(config.exportRoot, { recursive: true })
      .pipe(Effect.mapError(() => makeLibpffError("config", { cause: "export root could not be created" })));

    yield* acquireExportClaim(claimPath);
    return yield* performExport(
      operation,
      sourcePath,
      targetBase,
      claimPath,
      messagesJsonlName,
      messagesJsonlPath
    ).pipe(Effect.ensuring(fs.remove(claimPath, { recursive: true }).pipe(Effect.ignore)));
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

      const bytes = operation.source.bytes;
      if (bytes === undefined && operation.source.locator.kind === "file") {
        return yield* Effect.scoped(exportArchiveImpl(operation, operation.source.locator.value)).pipe(
          Effect.mapError((error) => libpffOperationError(operation, error))
        );
      }
      if (bytes === undefined) {
        return yield* FileProcessingOperationError.fromReason("archive-export-failed", {
          artifactId: operation.source.id,
          engine: LibpffFileProcessingEngineDescriptor.name,
          format: operation.format,
          message: "pffexport requires source bytes or a file locator.",
          operationId: operation.operationId,
        });
      }

      return yield* Effect.scoped(
        Effect.gen(function* () {
          const directory = yield* fs
            .makeTempDirectoryScoped({ prefix: "beep-pffexport-source-" })
            .pipe(Effect.mapError(() => makeLibpffError("process", { cause: "source snapshot directory failed" })));
          const sourcePath = path.join(directory, `source.${operation.source.extension}`);
          yield* fs
            .writeFile(sourcePath, bytes, { flag: "wx", mode: 0o600 })
            .pipe(Effect.mapError(() => makeLibpffError("process", { cause: "source snapshot write failed" })));
          return yield* exportArchiveImpl(operation, sourcePath);
        })
      ).pipe(Effect.mapError((error) => libpffOperationError(operation, error)));
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
