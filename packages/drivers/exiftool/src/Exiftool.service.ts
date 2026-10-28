/**
 * Native ExifTool process driver service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Run } from "@beep/commands/Run";
import { $ExiftoolId } from "@beep/identity/packages";
import { Fn } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as N from "effect/Number";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ExiftoolError } from "./Exiftool.errors.ts";
import {
  BeepQaProvenance,
  ExifMetadata,
  ExiftoolConfig,
  ExiftoolConfigInput,
  ExiftoolWritableExtension,
  ReadTagsRequest,
  ReadTagsResult,
  TagAssignment,
  WriteTagsRequest,
  WriteTagsResult,
  WriteXmpPacketRequest,
} from "./Exiftool.models.ts";
import { provenanceTagAssignments, RenderBeepQaConfigOptions, renderBeepQaExiftoolConfig } from "./ExiftoolConfig.ts";
import type { CommandFailedError, CommandOutput, CommandOutputError } from "@beep/commands/Run";

const $I = $ExiftoolId.create("Exiftool.service");
const decodeRawRecords = S.decodeUnknownEffect(S.fromJsonString(S.Array(S.Record(S.String, S.Unknown))));
// Requests arrive as already-constructed Type-side instances (Options and
// all), so the boundary validation runs through the type-side codec instead
// of the encoded-side class codec.
const validateReadTagsRequest = S.decodeUnknownEffect(S.toType(ReadTagsRequest));
const validateWriteTagsRequest = S.decodeUnknownEffect(S.toType(WriteTagsRequest));
const validateWriteXmpPacketRequest = S.decodeUnknownEffect(S.toType(WriteXmpPacketRequest));
const decodeWritableExtension = S.decodeUnknownOption(ExiftoolWritableExtension);
const writableExtensionsText = A.join(ExiftoolWritableExtension.literals, ", ");
type ExiftoolConfigInputOptions = (typeof ExiftoolConfigInput)["~type.make.in"];

/**
 * Runtime shape exposed by the {@link Exiftool} service.
 *
 * **Example** (Stub ExiftoolShape service)
 *
 * ```ts
 * import type { ExiftoolShape } from "@beep/exiftool"
 * import * as Effect from "effect/Effect";
 * const service: ExiftoolShape = {
 *   readTags: () => Effect.die("not implemented"),
 *   version: Effect.die("not implemented"),
 *   writeTags: () => Effect.die("not implemented"),
 *   writeXmpPacket: () => Effect.die("not implemented")
 * }
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ExiftoolShape {
  readonly readTags: (request: ReadTagsRequest) => Effect.Effect<ReadTagsResult, ExiftoolError>;
  readonly version: Effect.Effect<string, ExiftoolError>;
  readonly writeTags: (request: WriteTagsRequest) => Effect.Effect<WriteTagsResult, ExiftoolError>;
  readonly writeXmpPacket: (request: WriteXmpPacketRequest) => Effect.Effect<WriteTagsResult, ExiftoolError>;
}

const defaultConfig = (input?: ExiftoolConfigInputOptions | undefined): ExiftoolConfig =>
  ExiftoolConfig.make(ExiftoolConfigInput.make(input ?? {}));

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- driver-boundary idiom repeated across sibling drivers that must not depend on each other; no foundation capability owns it yet. Owner: @beep/exiftool. Exit: import it and delete this copy once a foundation capability package exports the idiom.
const parseFiniteNumber = (value: unknown): O.Option<number> => {
  if (P.isNumber(value)) {
    return Number.isFinite(value) ? O.some(value) : O.none();
  }
  if (P.isString(value)) {
    return pipe(
      N.parse(value),
      O.filter((number) => Number.isFinite(number))
    );
  }
  return O.none();
};

// -G1 prefixes every key with a family-1 group ("File:FileType"); match the
// bare tag name first, then the first group-qualified suffix match in
// exiftool's own emission order.
const tagValueAt = (raw: Readonly<Record<string, unknown>>, tagName: string): O.Option<unknown> => {
  const direct = O.fromUndefinedOr(raw[tagName]);
  if (O.isSome(direct)) {
    return direct;
  }

  const suffix = `:${tagName}`;
  return pipe(
    R.toEntries(raw),
    A.findFirst(([key]) => Str.endsWith(suffix)(key)),
    O.map(([, value]) => value)
  );
};

const textTag = (raw: Readonly<Record<string, unknown>>, tagName: string): O.Option<string> =>
  pipe(
    tagValueAt(raw, tagName),
    O.flatMap((value) =>
      P.isString(value)
        ? O.some(value)
        : pipe(
            parseFiniteNumber(value),
            O.map((number) => `${number}`)
          )
    )
  );

const numberTag = (raw: Readonly<Record<string, unknown>>, tagName: string): O.Option<number> =>
  pipe(tagValueAt(raw, tagName), O.flatMap(parseFiniteNumber));

const metadataFromRaw = (raw: Readonly<Record<string, unknown>>): ExifMetadata =>
  ExifMetadata.make({
    createDate: textTag(raw, "CreateDate"),
    dateTimeOriginal: textTag(raw, "DateTimeOriginal"),
    fileName: textTag(raw, "FileName"),
    fileSize: textTag(raw, "FileSize"),
    fileType: textTag(raw, "FileType"),
    gpsAltitude: numberTag(raw, "GPSAltitude"),
    gpsLatitude: numberTag(raw, "GPSLatitude"),
    gpsLongitude: numberTag(raw, "GPSLongitude"),
    imageHeight: numberTag(raw, "ImageHeight"),
    imageWidth: numberTag(raw, "ImageWidth"),
    make: textTag(raw, "Make"),
    mimeType: textTag(raw, "MIMEType"),
    model: textTag(raw, "Model"),
    modifyDate: textTag(raw, "ModifyDate"),
    orientation: pipe(
      tagValueAt(raw, "Orientation"),
      O.flatMap((value) => (P.isString(value) ? O.some<number | string>(value) : parseFiniteNumber(value)))
    ),
    raw,
    software: textTag(raw, "Software"),
  });

/**
 * Options for building native exiftool read-tags arguments.
 *
 * **Example** (Make read-tags options)
 *
 * ```ts
 * import { BuildReadTagsArgsOptions } from "@beep/exiftool"
 *
 * const options = BuildReadTagsArgsOptions.make({
 *   configPath: "/tmp/beepqa.config",
 *   filePath: "./frame.png",
 *   numeric: false
 * })
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BuildReadTagsArgsOptions extends S.Opaque<BuildReadTagsArgsOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    configPath: S.String.pipe(
      $I.annoteKey("BuildReadTagsArgsOptions.configPath", {
        description: "Materialized -config file path passed as the FIRST exiftool argument.",
      })
    ),
    filePath: S.String.pipe(
      $I.annoteKey("BuildReadTagsArgsOptions.filePath", {
        description: "File path whose tags are read.",
      })
    ),
    numeric: S.Boolean.pipe(
      $I.annoteKey("BuildReadTagsArgsOptions.numeric", {
        description: "Whether to pass -n for numeric tag values.",
      })
    ),
  }).pipe(
    $I.annoteSchema("BuildReadTagsArgsOptions", {
      description: "Options for building native exiftool read-tags arguments.",
    })
  )
) {}

const BuildReadTagsArgs = Fn({
  input: BuildReadTagsArgsOptions,
  output: S.Array(S.String),
}).pipe(
  $I.annoteSchema("BuildReadTagsArgs", {
    description: "Schema-backed builder for native exiftool read-tags arguments.",
  })
);

/**
 * Build exiftool arguments for the read-tags operation.
 *
 * **Example** (Build read-tags args)
 *
 * ```ts
 * import { BuildReadTagsArgsOptions, buildReadTagsArgs } from "@beep/exiftool"
 *
 * const args = buildReadTagsArgs(
 *   BuildReadTagsArgsOptions.make({
 *     configPath: "/tmp/beepqa.config",
 *     filePath: "./frame.png",
 *     numeric: false
 *   })
 * )
 * console.log(args)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const buildReadTagsArgs: (options: BuildReadTagsArgsOptions) => ReadonlyArray<string> =
  BuildReadTagsArgs.implementSync((options) => [
    "-config",
    options.configPath,
    "-j",
    "-G1",
    ...(options.numeric ? ["-n"] : []),
    options.filePath,
  ]);

/**
 * Options for building native exiftool write-tags arguments.
 *
 * **Example** (Make write-tags options)
 *
 * ```ts
 * import { BuildWriteTagsArgsOptions, TagAssignment } from "@beep/exiftool"
 *
 * const options = BuildWriteTagsArgsOptions.make({
 *   assignments: [TagAssignment.make({ tagName: "XMP-beepQA:sessionId", value: "qa-round-1-1754000000000" })],
 *   configPath: "/tmp/beepqa.config",
 *   outputPath: "./frames/.tmp/frame.png",
 *   sourcePath: "./frames/frame.png"
 * })
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BuildWriteTagsArgsOptions extends S.Opaque<BuildWriteTagsArgsOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    assignments: S.Array(TagAssignment).pipe(
      $I.annoteKey("BuildWriteTagsArgsOptions.assignments", {
        description: "Tag assignments rendered as -TAG=VALUE argv entries.",
      })
    ),
    configPath: S.String.pipe(
      $I.annoteKey("BuildWriteTagsArgsOptions.configPath", {
        description: "Materialized -config file path passed as the FIRST exiftool argument.",
      })
    ),
    outputPath: S.String.pipe(
      $I.annoteKey("BuildWriteTagsArgsOptions.outputPath", {
        description: "Temporary -o output path the rewritten file is staged into.",
      })
    ),
    sourcePath: S.String.pipe(
      $I.annoteKey("BuildWriteTagsArgsOptions.sourcePath", {
        description: "Source file whose metadata is rewritten.",
      })
    ),
  }).pipe(
    $I.annoteSchema("BuildWriteTagsArgsOptions", {
      description: "Options for building native exiftool write-tags arguments.",
    })
  )
) {}

const BuildWriteTagsArgs = Fn({
  input: BuildWriteTagsArgsOptions,
  output: S.Array(S.String),
}).pipe(
  $I.annoteSchema("BuildWriteTagsArgs", {
    description: "Schema-backed builder for native exiftool write-tags arguments.",
  })
);

/**
 * Build exiftool arguments for the temp-then-commit write-tags operation.
 *
 * **Example** (Build write-tags args)
 *
 * ```ts
 * import { BuildWriteTagsArgsOptions, buildWriteTagsArgs, TagAssignment } from "@beep/exiftool"
 *
 * const args = buildWriteTagsArgs(
 *   BuildWriteTagsArgsOptions.make({
 *     assignments: [TagAssignment.make({ tagName: "XMP-beepQA:sessionId", value: "qa-round-1-1754000000000" })],
 *     configPath: "/tmp/beepqa.config",
 *     outputPath: "./frames/.tmp/frame.png",
 *     sourcePath: "./frames/frame.png"
 *   })
 * )
 * console.log(args)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const buildWriteTagsArgs: (options: BuildWriteTagsArgsOptions) => ReadonlyArray<string> =
  BuildWriteTagsArgs.implementSync((options) => [
    "-config",
    options.configPath,
    ...A.map(options.assignments, (assignment) => `-${assignment.tagName}=${assignment.value}`),
    "-o",
    options.outputPath,
    options.sourcePath,
  ]);

/**
 * Arguments for the exiftool version probe.
 *
 * **Example** (Inspect version probe args)
 *
 * ```ts
 * import { exiftoolVersionArgs } from "@beep/exiftool"
 *
 * console.log(exiftoolVersionArgs)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const exiftoolVersionArgs: ReadonlyArray<string> = ["-ver"];

// The kit reports a spawn or stream failure as `CommandFailedError` carrying
// the platform failure; unwrap it so the driver error keeps the same cause it
// had under the hand-rolled fold. An over-budget stream has no platform cause,
// so the kit error itself becomes the cause.
const commandFailureCause = (error: CommandFailedError | CommandOutputError): unknown =>
  error._tag === "CommandFailedError" ? error.cause : error;

// Per-stream capture ceiling. A `-j` readTags batch over many files can run
// well past the kit's 16 MiB default, and the hand-rolled fold had no ceiling,
// so this driver raises it instead of inheriting the default.
const exiftoolMaxOutputBytes = 128 * 1024 * 1024;

const runProcess = (
  spawner: ChildProcessSpawner.ChildProcessSpawner["Service"],
  command: ChildProcess.Command,
  operation: string,
  message: string
): Effect.Effect<CommandOutput, ExiftoolError> =>
  Run.collect(command, { maxOutputBytes: exiftoolMaxOutputBytes }).pipe(
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
    Effect.mapError((error) => ExiftoolError.fromUnknown(operation, message, { cause: commandFailureCause(error) }))
  );

const ensureFile = Effect.fn("Exiftool.ensureFile")(function* (
  fs: FileSystem.FileSystem,
  filePath: string,
  label: string,
  operation: string
): Effect.fn.Return<void, ExiftoolError> {
  const stat = yield* fs
    .stat(filePath)
    .pipe(
      Effect.mapError((cause) =>
        ExiftoolError.fromUnknown(operation, `Failed to stat ${label}: "${filePath}"`, { cause })
      )
    );
  if (stat.type !== "File") {
    return yield* ExiftoolError.make({
      message: `Expected ${label} to be a file: "${filePath}"`,
      operation,
    });
  }
});

const makeService = Effect.fn("Exiftool.make")(function* (configInput?: ExiftoolConfigInputOptions | undefined) {
  const config = defaultConfig(configInput);
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  // Materialize the XMP-beepQA -config once per layer into a scoped temp file;
  // every spawn passes it as the FIRST exiftool argument. Failing to stage a
  // few hundred bytes of config is an environment defect, not a typed error,
  // so the layer's error channel stays `never`.
  const configPath = yield* fs.makeTempFileScoped({ prefix: "beep-exiftool-config-" }).pipe(
    Effect.tap((file) => fs.writeFileString(file, renderBeepQaExiftoolConfig(RenderBeepQaConfigOptions.make({})))),
    Effect.orDie
  );

  const runExiftool = (operation: string, args: ReadonlyArray<string>): Effect.Effect<CommandOutput, ExiftoolError> =>
    runProcess(
      spawner,
      ChildProcess.make(config.exiftoolPath, args, {
        forceKillAfter: `${config.forceKillAfterMillis} millis`,
        stdin: "ignore",
        stderr: "pipe",
        stdout: "pipe",
      }),
      operation,
      "Failed to run exiftool. Install exiftool or configure exiftoolPath."
    );

  const readTags = Effect.fn("Exiftool.readTags")(function* (rawRequest: ReadTagsRequest) {
    const request = yield* validateReadTagsRequest(rawRequest).pipe(
      Effect.mapError((cause) => ExiftoolError.fromUnknown("readTags", "Invalid read-tags request.", { cause }))
    );
    const filePath = path.resolve(request.filePath);
    yield* ensureFile(fs, filePath, "metadata input", "readTags");

    const args = buildReadTagsArgs(BuildReadTagsArgsOptions.make({ configPath, filePath, numeric: request.numeric }));
    const result = yield* runExiftool("readTags", args);

    if (result.exitCode !== 0) {
      return yield* ExiftoolError.make({
        command: O.some(config.exiftoolPath),
        exitCode: O.some(result.exitCode),
        message: `exiftool could not read tags for "${filePath}".`,
        operation: "readTags",
        stderr: O.some(Str.trim(result.stderr)),
        stdout: O.some(Str.trim(result.stdout)),
      });
    }

    const records = yield* decodeRawRecords(result.stdout).pipe(
      Effect.mapError((cause) =>
        ExiftoolError.fromUnknown("readTags", `Failed to decode exiftool JSON for "${filePath}".`, {
          cause,
          command: config.exiftoolPath,
          stdout: result.stdout,
        })
      )
    );
    const raw = pipe(
      A.head(records),
      O.getOrElse((): Readonly<Record<string, unknown>> => ({}))
    );

    return ReadTagsResult.make({ filePath, metadata: metadataFromRaw(raw) });
  });

  const writeTagsCore = Effect.fn("Exiftool.writeTagsCore")(function* (
    operation: string,
    rawFilePath: string,
    assignments: ReadonlyArray<TagAssignment>
  ): Effect.fn.Return<WriteTagsResult, ExiftoolError> {
    const filePath = path.resolve(rawFilePath);
    const extensionText = pipe(path.extname(filePath), Str.toLowerCase, Str.slice(1));
    const extension = decodeWritableExtension(extensionText);

    if (O.isNone(extension)) {
      return yield* ExiftoolError.make({
        message:
          `exiftool cannot write metadata into "${filePath}": extension "${extensionText}" is not writable ` +
          `(writable: ${writableExtensionsText}). For video containers use FFmpeg.writeContainerMetadata from @beep/ffmpeg.`,
        operation,
      });
    }

    if (A.length(assignments) === 0) {
      return yield* ExiftoolError.make({
        message: `Expected at least one tag assignment for "${filePath}".`,
        operation,
      });
    }

    yield* ensureFile(fs, filePath, "metadata target", operation);

    return yield* Effect.acquireUseRelease(
      fs.makeTempDirectory({ directory: path.dirname(filePath), prefix: ".beep-exiftool-write-" }).pipe(
        Effect.mapError((cause) =>
          ExiftoolError.fromUnknown(operation, `Failed to create temporary write directory next to "${filePath}".`, {
            cause,
          })
        )
      ),
      Effect.fnUntraced(function* (tempDir) {
        const outputPath = path.join(tempDir, path.basename(filePath));
        const args = buildWriteTagsArgs(
          BuildWriteTagsArgsOptions.make({ assignments, configPath, outputPath, sourcePath: filePath })
        );
        const result = yield* runExiftool(operation, args);

        if (result.exitCode !== 0) {
          return yield* ExiftoolError.make({
            command: O.some(config.exiftoolPath),
            exitCode: O.some(result.exitCode),
            message: `exiftool could not write tags into "${filePath}".`,
            operation,
            stderr: O.some(Str.trim(result.stderr)),
            stdout: O.some(Str.trim(result.stdout)),
          });
        }

        yield* ensureFile(fs, outputPath, "staged write output", operation);
        yield* fs.rename(outputPath, filePath).pipe(
          Effect.mapError((cause) =>
            ExiftoolError.fromUnknown(operation, `Failed to commit metadata output: "${filePath}"`, { cause })
          ),
          Effect.uninterruptible
        );

        return WriteTagsResult.make({ filePath, tagsWritten: A.length(assignments) });
      }),
      (tempDir) => fs.remove(tempDir, { recursive: true, force: true }).pipe(Effect.ignore)
    );
  });

  const writeTags = Effect.fn("Exiftool.writeTags")(function* (rawRequest: WriteTagsRequest) {
    const request = yield* validateWriteTagsRequest(rawRequest).pipe(
      Effect.mapError((cause) => ExiftoolError.fromUnknown("writeTags", "Invalid write-tags request.", { cause }))
    );
    return yield* writeTagsCore("writeTags", request.filePath, request.assignments);
  });

  const writeXmpPacket = Effect.fn("Exiftool.writeXmpPacket")(function* (rawRequest: WriteXmpPacketRequest) {
    const request = yield* validateWriteXmpPacketRequest(rawRequest).pipe(
      Effect.mapError((cause) =>
        ExiftoolError.fromUnknown("writeXmpPacket", "Invalid write-XMP-packet request.", { cause })
      )
    );
    return yield* writeTagsCore(
      "writeXmpPacket",
      request.filePath,
      provenanceTagAssignments(BeepQaProvenance.make(request.provenance))
    );
  });

  const version = Effect.gen(function* () {
    const result = yield* runExiftool("version", exiftoolVersionArgs);

    if (result.exitCode !== 0) {
      return yield* ExiftoolError.make({
        command: O.some(config.exiftoolPath),
        exitCode: O.some(result.exitCode),
        message: "exiftool could not report its version.",
        operation: "version",
        stderr: O.some(Str.trim(result.stderr)),
        stdout: O.some(Str.trim(result.stdout)),
      });
    }

    return Str.trim(result.stdout);
  });

  return {
    readTags,
    version,
    writeTags,
    writeXmpPacket,
  };
});

/**
 * Effect service for native ExifTool execution.
 *
 * **Example** (Reference Exiftool service)
 *
 * ```ts
 * import { Exiftool } from "@beep/exiftool"
 *
 * const service = Exiftool
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Exiftool extends Context.Service<Exiftool, ExiftoolShape>()($I`Exiftool`) {
  /**
   * Build the native ExifTool service layer.
   *
   * **Details**
   *
   * The layer never probes the exiftool binary at build time; a missing
   * binary surfaces as an actionable {@link ExiftoolError} on the first call.
   *
   * **Example** (Create service layer)
   *
   * ```ts
   * import { Exiftool } from "@beep/exiftool"
   *
   * const layer = Exiftool.makeLayer()
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (
    config?: ExiftoolConfigInputOptions | undefined
  ): Layer.Layer<Exiftool, never, ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path> =>
    Layer.effect(Exiftool, Effect.map(makeService(config), Exiftool.of));
}
