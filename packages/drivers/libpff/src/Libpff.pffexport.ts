/**
 * Real pffexport-backed PST archive export engine.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ArtifactReference, deriveArtifactId } from "@beep/file-processing/Artifact";
import { ArchiveExportResult } from "@beep/file-processing/Extraction";
import { FileProcessingOperationError } from "@beep/file-processing/Operation";
import { $LibpffId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { A, O, Str } from "@beep/utils";
import { Effect, FileSystem, Match, Order, Path, Stream } from "effect";
import * as S from "effect/Schema";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { makeLibpffError } from "./Libpff.errors.js";
import { LibpffFileProcessingEngine, LibpffFileProcessingEngineDescriptor } from "./Libpff.service.js";
import type { ExportArchiveOperation, ExtractFileOperation } from "@beep/file-processing/Operation";
import type { FileProcessingEngineShape } from "@beep/file-processing/Service";
import type * as Crypto from "effect/Crypto";
import type { LibpffError } from "./Libpff.errors.js";

const $I = $LibpffId.create("Libpff.pffexport");

const defaultPffexportPath = "pffexport";
const defaultForceKillAfterMillis = 10_000;
const PffexportModeBase = LiteralKit(["all", "items", "recovered"]);
const PffexportFormatBase = LiteralKit(["all", "html", "rtf", "text"]);

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
 * @category models
 * @since 0.0.0
 */
export type PffexportFormat = typeof PffexportFormat.Type;

/**
 * Configuration for the pffexport subprocess engine.
 *
 * @example
 * ```ts
 * import { PffexportEngineConfig } from "@beep/libpff"
 *
 * const config = PffexportEngineConfig.make({ exportRoot: "/tmp/pst-out" })
 * console.log(config.exportRoot)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class PffexportEngineConfig extends S.Class<PffexportEngineConfig>($I`PffexportEngineConfig`)(
  {
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
      "Configuration for the real pffexport subprocess engine: target export root, binary path, mode, format, and optional per-archive timeout.",
  })
) {}

const operationFailure = (operation: ExportArchiveOperation, error: LibpffError): FileProcessingOperationError =>
  Match.value(error.reason).pipe(
    Match.when("engine-unavailable", () =>
      FileProcessingOperationError.fromReason("engine-unavailable", {
        artifactId: operation.source.id,
        engine: LibpffFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: "pffexport is not available on this host.",
        operationId: operation.operationId,
      })
    ),
    Match.when("timeout", () =>
      FileProcessingOperationError.fromReason("operation-timed-out", {
        artifactId: operation.source.id,
        engine: LibpffFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: "pffexport timed out while exporting the archive.",
        operationId: operation.operationId,
      })
    ),
    Match.orElse(() =>
      FileProcessingOperationError.fromReason("archive-export-failed", {
        artifactId: operation.source.id,
        engine: LibpffFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: "pffexport failed while exporting the archive.",
        operationId: operation.operationId,
        ...O.getSomesStruct({
          details: O.map(error.exitCode, (exitCode) => ({ exitCode: `${exitCode}` })),
        }),
      })
    )
  );

interface WalkedFile {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly sizeBytes: number;
}

const drainStream = <E>(stream: Stream.Stream<Uint8Array, E>): Effect.Effect<void, E> => Stream.runDrain(stream);

const byRelativePath = Order.mapInput(Str.Order, (file: WalkedFile) => file.relativePath);

/**
 * Create the real pffexport-backed file-processing engine.
 *
 * Captures the file system, path, and process-spawner services at
 * construction. The returned engine's `exportArchive` method still requires
 * `effect/Crypto` so child artifact ids can be derived through the shared
 * SHA-backed artifact id schema.
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
 * console.log(program)
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
      {
        forceKillAfter: `${defaultForceKillAfterMillis} millis`,
        stdin: "ignore",
        stderr: "pipe",
        stdout: "pipe",
      }
    );
    const exitCode = yield* Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* spawner.spawn(command);
        const [, , code] = yield* Effect.all(
          [drainStream(handle.stdout), drainStream(handle.stderr), handle.exitCode],
          { concurrency: "unbounded" }
        );
        return code;
      })
    ).pipe(Effect.mapError(() => makeLibpffError("engine-unavailable", { cause: "pffexport spawn failed" })));

    if (exitCode !== 0) {
      return yield* makeLibpffError("process", { exitCode: NonNegativeInt.make(Math.max(0, exitCode)) });
    }
  });

  const exportArchiveImpl = Effect.fn("LibpffPffexportEngine.exportArchiveImpl")(function* (
    operation: ExportArchiveOperation
  ): Effect.fn.Return<ArchiveExportResult, LibpffError, Crypto.Crypto> {
    const sourcePath = operation.source.locator.value;
    const targetBase = path.join(config.exportRoot, operation.source.id);
    const exportedRoot = `${targetBase}.export`;

    yield* fs
      .makeDirectory(config.exportRoot, { recursive: true })
      .pipe(Effect.mapError(() => makeLibpffError("config", { cause: "export root could not be created" })));

    const run = runPffexport(sourcePath, targetBase);
    yield* O.match(config.timeoutMillis, {
      onNone: () => run,
      onSome: (timeoutMillis) =>
        run.pipe(
          Effect.timeoutOrElse({
            duration: `${timeoutMillis} millis`,
            orElse: () => Effect.fail(makeLibpffError("timeout")),
          })
        ),
    });

    const exportedExists = yield* fs
      .exists(exportedRoot)
      .pipe(Effect.mapError(() => makeLibpffError("process", { cause: "export tree check failed" })));
    const files = exportedExists ? yield* walkFiles(config.exportRoot, exportedRoot) : [];

    const warnings: Array<string> = [];
    const children: Array<ArtifactReference> = [];

    for (const file of A.sort(files, byRelativePath)) {
      const decoded = yield* S.decodeUnknownEffect(PosixPath)(file.relativePath).pipe(Effect.option);
      if (O.isNone(decoded)) {
        warnings.push(`Skipped one exported child with a non-portable path (${file.sizeBytes} bytes).`);
        continue;
      }
      const childId = yield* deriveArtifactId([operation.source.id, decoded.value]).pipe(
        Effect.mapError(() => makeLibpffError("process", { cause: "child artifact id derivation failed" }))
      );
      children.push(
        ArtifactReference.make({
          id: childId,
          relativePath: decoded.value,
          sizeBytes: NonNegativeInt.make(file.sizeBytes),
        })
      );
    }

    if (A.length(children) === 0) {
      warnings.push("pffexport produced no exported children for this archive.");
    }

    return ArchiveExportResult.make({
      children,
      engine: LibpffFileProcessingEngineDescriptor.name,
      operationId: operation.operationId,
      sourceArtifactId: operation.source.id,
      warnings,
    });
  });

  const engine: FileProcessingEngineShape = {
    descriptor: LibpffFileProcessingEngineDescriptor,
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

      return yield* exportArchiveImpl(operation).pipe(Effect.mapError((error) => operationFailure(operation, error)));
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
