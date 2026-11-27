/**
 * Schema-first public models for the native ExifTool driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ExiftoolId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- driver-boundary idiom repeated across sibling drivers that must not depend on each other; no foundation capability owns it yet. Owner: @beep/exiftool. Exit: import it and delete this copy once a foundation capability package exports the idiom.
const $I = $ExiftoolId.create("Exiftool.models");

/**
 * **Example** (Decode positive timeout)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PositiveMilliseconds } from "@beep/exiftool"
 *
 * const timeout = S.decodeUnknownSync(PositiveMilliseconds)(2000)
 * console.log(timeout)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- driver-boundary idiom repeated across sibling drivers that must not depend on each other; no foundation capability owns it yet. Owner: @beep/exiftool. Exit: import it and delete this copy once a foundation capability package exports the idiom.
export const PositiveMilliseconds = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isFinite(
        $I.annote("PositiveMillisecondsFiniteCheck", {
          title: "Positive Milliseconds Finite",
          description: "Timeout milliseconds must be finite numbers.",
          message: "Expected finite milliseconds",
        })
      ),
      S.isGreaterThan(
        0,
        $I.annote("PositiveMillisecondsGreaterThanZeroCheck", {
          title: "Positive Milliseconds Greater Than Zero",
          description: "Timeout milliseconds must be greater than zero.",
          message: "Expected milliseconds greater than zero",
        })
      ),
    ],
    $I.annote("PositiveMillisecondsChecks", {
      title: "Positive Milliseconds",
      description: "Checks for positive finite timeout milliseconds.",
    })
  )
).pipe(
  $I.annoteSchema("PositiveMilliseconds", {
    description: "Positive finite timeout value in milliseconds.",
  })
);

/**
 * **Example** (Typed positive timeout)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PositiveMilliseconds } from "@beep/exiftool"
 *
 * const timeout: PositiveMilliseconds = S.decodeUnknownSync(PositiveMilliseconds)(2000)
 * console.log(timeout)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PositiveMilliseconds = typeof PositiveMilliseconds.Type;

/**
 * **Example** (Make epoch milliseconds)
 *
 * ```ts
 * import { EpochMilliseconds } from "@beep/exiftool"
 *
 * const capturedAt = EpochMilliseconds.make(1753900000000)
 * console.log(capturedAt)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EpochMilliseconds = S.Finite.check(
  S.isGreaterThanOrEqualTo(
    0,
    $I.annote("EpochMillisecondsMinimumCheck", {
      title: "Epoch Milliseconds Minimum",
      description: "Epoch millisecond timestamps must be zero or greater.",
      message: "Expected non-negative epoch milliseconds",
    })
  )
).pipe(
  $I.annoteSchema("EpochMilliseconds", {
    description: "Non-negative epoch timestamp measured in milliseconds.",
  })
);

/**
 * **Example** (Typed epoch milliseconds)
 *
 * ```ts
 * import { EpochMilliseconds } from "@beep/exiftool"
 * import type { EpochMilliseconds as EpochMillisecondsValue } from "@beep/exiftool"
 *
 * const capturedAt: EpochMillisecondsValue = EpochMilliseconds.make(1753900000000)
 * console.log(capturedAt)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EpochMilliseconds = typeof EpochMilliseconds.Type;

/**
 * **Example** (Make tag count)
 *
 * ```ts
 * import { TagCount } from "@beep/exiftool"
 *
 * const count = TagCount.make(3)
 * console.log(count)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TagCount = S.Int.check(
  S.isGreaterThanOrEqualTo(
    0,
    $I.annote("TagCountMinimumCheck", {
      title: "Tag Count Minimum",
      description: "Tag counts are non-negative integers.",
      message: "Expected a non-negative tag count",
    })
  )
).pipe(
  $I.annoteSchema("TagCount", {
    description: "Non-negative integer count of tag assignments.",
  })
);

/**
 * **Example** (Typed tag count)
 *
 * ```ts
 * import { TagCount } from "@beep/exiftool"
 * import type { TagCount as TagCountValue } from "@beep/exiftool"
 *
 * const count: TagCountValue = TagCount.make(3)
 * console.log(count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TagCount = typeof TagCount.Type;

/**
 * ExifTool tag name that cannot smuggle extra command-line arguments.
 *
 * **Details**
 *
 * Tag assignments are rendered as one `-TAG=VALUE` argv entry, so tag names
 * are restricted to group-qualified identifier characters.
 *
 * **Example** (Decode safe tag name)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SafeTagName } from "@beep/exiftool"
 *
 * const tagName = S.decodeUnknownSync(SafeTagName)("XMP-beepQA:sessionId")
 * console.log(tagName)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SafeTagName = S.String.check(
  S.makeFilterGroup(
    [
      S.isMinLength(
        1,
        $I.annote("SafeTagNameNonEmptyCheck", {
          title: "Safe Tag Name Non Empty",
          description: "ExifTool tag names must not be empty.",
          message: "Expected a non-empty tag name",
        })
      ),
      S.isPattern(
        /^[A-Za-z0-9:_-]+$/,
        $I.annote("SafeTagNameCharactersCheck", {
          title: "Safe Tag Name Characters",
          description: "ExifTool tag names may only use group-qualified identifier characters.",
          message: "Expected a tag name matching ^[A-Za-z0-9:_-]+$",
        })
      ),
    ],
    $I.annote("SafeTagNameChecks", {
      title: "Safe Tag Name",
      description: "Checks for tag names that stay a single -TAG=VALUE argv entry.",
    })
  )
).pipe(
  $I.annoteSchema("SafeTagName", {
    description: "ExifTool tag name restricted to group-qualified identifier characters.",
  })
);

/**
 * ExifTool tag name that cannot smuggle extra command-line arguments.
 *
 * **Example** (Typed safe tag name)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SafeTagName } from "@beep/exiftool"
 *
 * const tagName: SafeTagName = S.decodeUnknownSync(SafeTagName)("XMP-beepQA:sessionId")
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SafeTagName = typeof SafeTagName.Type;

/**
 * **Details**
 *
 * WebM/Matroska containers are read-only for exiftool; their provenance goes
 * through `FFmpeg.writeContainerMetadata` in `@beep/ffmpeg` instead.
 *
 * **Example** (List writable extensions)
 *
 * ```ts
 * import { ExiftoolWritableExtension } from "@beep/exiftool"
 *
 * console.log(ExiftoolWritableExtension.literals)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExiftoolWritableExtension = LiteralKit(["png", "jpg", "jpeg", "gif", "webp"]).pipe(
  $I.annoteSchema("ExiftoolWritableExtension", {
    description: "File extensions the native ExifTool binary can write metadata into.",
  })
);

/**
 * **Example** (Typed writable extension)
 *
 * ```ts
 * import type { ExiftoolWritableExtension } from "@beep/exiftool"
 *
 * const extension: ExiftoolWritableExtension = "png"
 * console.log(extension)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ExiftoolWritableExtension = typeof ExiftoolWritableExtension.Type;

/**
 * **Example** (Make config input)
 *
 * ```ts
 * import { ExiftoolConfigInput } from "@beep/exiftool"
 *
 * const config = ExiftoolConfigInput.make({ exiftoolPath: "exiftool" })
 * console.log(config)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExiftoolConfigInput extends S.Opaque<ExiftoolConfigInput, { readonly brand: unique symbol }>()(
  S.Struct({
    exiftoolPath: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("exiftool")),
      $I.annoteKey("ExiftoolConfigInput.exiftoolPath", {
        description: "Executable path or command name used for exiftool.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed("exiftool"))
    ),
    forceKillAfterMillis: PositiveMilliseconds.pipe(
      S.withConstructorDefault(Effect.succeed(2000)),
      $I.annoteKey("ExiftoolConfigInput.forceKillAfterMillis", {
        description: "Timeout in milliseconds before an interrupted native process is force-killed.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(2000))
    ),
  }).pipe(
    $I.annoteSchema("ExiftoolConfigInput", {
      description: "Optional runtime path overrides for the native ExifTool binary.",
    })
  )
) {}

/**
 * **Example** (Make resolved config)
 *
 * ```ts
 * import { ExiftoolConfig } from "@beep/exiftool"
 *
 * const config = ExiftoolConfig.make({ exiftoolPath: "exiftool", forceKillAfterMillis: 2000 })
 * console.log(config)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExiftoolConfig extends S.Opaque<ExiftoolConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    exiftoolPath: S.String.pipe(
      $I.annoteKey("ExiftoolConfig.exiftoolPath", {
        description: "Resolved executable path or command name used for exiftool.",
      })
    ),
    forceKillAfterMillis: PositiveMilliseconds.pipe(
      $I.annoteKey("ExiftoolConfig.forceKillAfterMillis", {
        description: "Resolved timeout in milliseconds before an interrupted native process is force-killed.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ExiftoolConfig", {
      description: "Resolved runtime configuration for native ExifTool command execution.",
    })
  )
) {}

/**
 * Cleaned metadata extracted from one ExifTool JSON record.
 *
 * **Details**
 *
 * Common fields are Option-modeled projections over the group-prefixed
 * `-j -G1` output; the untouched record survives in `raw` so no tag is lost.
 *
 * **Example** (Make cleaned metadata)
 *
 * ```ts
 * import { ExifMetadata } from "@beep/exiftool"
 * import * as O from "effect/Option"
 *
 * const metadata = ExifMetadata.make({ fileType: O.some("PNG"), raw: { "File:FileType": "PNG" } })
 * console.log(metadata)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExifMetadata extends S.Opaque<ExifMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    createDate: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("ExifMetadata.createDate", {
        description: "CreateDate tag text, when the file reported one.",
      })
    ),
    dateTimeOriginal: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("ExifMetadata.dateTimeOriginal", {
        description: "DateTimeOriginal tag text, when the file reported one.",
      })
    ),
    fileName: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("ExifMetadata.fileName", {
        description: "File name reported by exiftool, when available.",
      })
    ),
    fileSize: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("ExifMetadata.fileSize", {
        description: "Human-readable file size text, when available.",
      })
    ),
    fileType: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("ExifMetadata.fileType", {
        description: "Detected file type name, when available.",
      })
    ),
    gpsAltitude: S.OptionFromOptionalKey(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("ExifMetadata.gpsAltitude", {
        description: "Numeric GPS altitude, when the file reported one.",
      })
    ),
    gpsLatitude: S.OptionFromOptionalKey(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("ExifMetadata.gpsLatitude", {
        description: "Numeric GPS latitude in decimal degrees, when the file reported one.",
      })
    ),
    gpsLongitude: S.OptionFromOptionalKey(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("ExifMetadata.gpsLongitude", {
        description: "Numeric GPS longitude in decimal degrees, when the file reported one.",
      })
    ),
    imageHeight: S.OptionFromOptionalKey(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("ExifMetadata.imageHeight", {
        description: "Numeric image height in pixels, when the file reported one.",
      })
    ),
    imageWidth: S.OptionFromOptionalKey(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("ExifMetadata.imageWidth", {
        description: "Numeric image width in pixels, when the file reported one.",
      })
    ),
    make: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("ExifMetadata.make", {
        description: "Camera make text, when the file reported one.",
      })
    ),
    mimeType: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("ExifMetadata.mimeType", {
        description: "Detected MIME type, when available.",
      })
    ),
    model: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("ExifMetadata.model", {
        description: "Camera model text, when the file reported one.",
      })
    ),
    modifyDate: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("ExifMetadata.modifyDate", {
        description: "ModifyDate tag text, when the file reported one.",
      })
    ),
    orientation: S.OptionFromOptionalKey(S.Union([S.Finite, S.String])).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("ExifMetadata.orientation", {
        description: "Orientation value as number or text, when the file reported one.",
      })
    ),
    raw: S.Record(S.String, S.Unknown).pipe(
      $I.annoteKey("ExifMetadata.raw", {
        description: "Untouched group-prefixed exiftool JSON record; nothing is lost here.",
      })
    ),
    software: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("ExifMetadata.software", {
        description: "Producing software text, when the file reported one.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ExifMetadata", {
      description: "Cleaned metadata projections over one raw exiftool JSON record.",
    })
  )
) {}

/**
 * **Example** (Make read-tags request)
 *
 * ```ts
 * import { ReadTagsRequest } from "@beep/exiftool"
 *
 * const request = ReadTagsRequest.make({ filePath: "./frame.png" })
 * console.log(request)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReadTagsRequest extends S.Opaque<ReadTagsRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    filePath: S.String.pipe(
      $I.annoteKey("ReadTagsRequest.filePath", {
        description: "File path to inspect with exiftool.",
      })
    ),
    numeric: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      $I.annoteKey("ReadTagsRequest.numeric", {
        description: "Whether to request numeric tag values via exiftool's -n flag.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ),
  }).pipe(
    $I.annoteSchema("ReadTagsRequest", {
      description: "Request to read tags from a file with exiftool.",
    })
  )
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ReadTagsRequest);
}

/**
 * **Example** (Make read-tags result)
 *
 * ```ts
 * import { ExifMetadata, ReadTagsResult } from "@beep/exiftool"
 *
 * const result = ReadTagsResult.make({
 *   filePath: "./frame.png",
 *   metadata: ExifMetadata.make({ raw: {} })
 * })
 * console.log(result)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReadTagsResult extends S.Opaque<ReadTagsResult, { readonly brand: unique symbol }>()(
  S.Struct({
    filePath: S.String.pipe(
      $I.annoteKey("ReadTagsResult.filePath", {
        description: "Resolved file path that was inspected.",
      })
    ),
    metadata: ExifMetadata.pipe(
      $I.annoteKey("ReadTagsResult.metadata", {
        description: "Cleaned metadata extracted from the exiftool JSON output.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ReadTagsResult", {
      description: "Result of reading tags from a file with exiftool.",
    })
  )
) {}

/**
 * **Example** (Make tag assignment)
 *
 * ```ts
 * import { TagAssignment } from "@beep/exiftool"
 *
 * const assignment = TagAssignment.make({ tagName: "XMP-beepQA:sessionId", value: "qa-round-1-1754000000000" })
 * console.log(assignment)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TagAssignment extends S.Opaque<TagAssignment, { readonly brand: unique symbol }>()(
  S.Struct({
    tagName: SafeTagName.pipe(
      $I.annoteKey("TagAssignment.tagName", {
        description: "Injection-safe, optionally group-qualified exiftool tag name.",
      })
    ),
    value: S.String.pipe(
      $I.annoteKey("TagAssignment.value", {
        description: "Tag value text passed inside the single -TAG=VALUE argv entry.",
      })
    ),
  }).pipe(
    $I.annoteSchema("TagAssignment", {
      description: "A single -TAG=VALUE exiftool tag assignment.",
    })
  )
) {}

/**
 * **Example** (Make write-tags request)
 *
 * ```ts
 * import { TagAssignment, WriteTagsRequest } from "@beep/exiftool"
 *
 * const request = WriteTagsRequest.make({
 *   assignments: [TagAssignment.make({ tagName: "XMP-beepQA:sessionId", value: "qa-round-1-1754000000000" })],
 *   filePath: "./frame.png"
 * })
 * console.log(request)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WriteTagsRequest extends S.Opaque<WriteTagsRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    assignments: S.Array(TagAssignment).pipe(
      $I.annoteKey("WriteTagsRequest.assignments", {
        description: "Tag assignments applied in order; at least one is required at the service boundary.",
      })
    ),
    filePath: S.String.pipe(
      $I.annoteKey("WriteTagsRequest.filePath", {
        description: "File whose metadata is rewritten in place via temp-then-commit.",
      })
    ),
  }).pipe(
    $I.annoteSchema("WriteTagsRequest", {
      description: "Request to write tag assignments into a file with exiftool.",
    })
  )
) {
  static readonly decodeEffect = S.decodeUnknownEffect(WriteTagsRequest);
}

/**
 * **Example** (Make write-tags result)
 *
 * ```ts
 * import { WriteTagsResult } from "@beep/exiftool"
 *
 * const result = WriteTagsResult.make({ filePath: "./frame.png", tagsWritten: 1 })
 * console.log(result)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WriteTagsResult extends S.Opaque<WriteTagsResult, { readonly brand: unique symbol }>()(
  S.Struct({
    filePath: S.String.pipe(
      $I.annoteKey("WriteTagsResult.filePath", {
        description: "Resolved file path whose metadata was rewritten.",
      })
    ),
    tagsWritten: TagCount.pipe(
      $I.annoteKey("WriteTagsResult.tagsWritten", {
        description: "Number of tag assignments committed into the file.",
      })
    ),
  }).pipe(
    $I.annoteSchema("WriteTagsResult", {
      description: "Result of committing tag assignments into a file.",
    })
  )
) {}

/**
 * **Example** (Make QA provenance)
 *
 * ```ts
 * import { BeepQaProvenance } from "@beep/exiftool"
 *
 * const provenance = BeepQaProvenance.make({
 *   actionId: "act-9",
 *   capturedAtEpochMs: 1753900000000,
 *   scenarioName: "sash-drag",
 *   sessionId: "qa-round-1-1754000000000"
 * })
 * console.log(provenance)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BeepQaProvenance extends S.Opaque<BeepQaProvenance, { readonly brand: unique symbol }>()(
  S.Struct({
    actionId: S.String.pipe(
      $I.annoteKey("BeepQaProvenance.actionId", {
        description: "Identifier of the action event this artifact evidences.",
      })
    ),
    capturedAtEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("BeepQaProvenance.capturedAtEpochMs", {
        description: "Wall-clock capture instant in epoch milliseconds.",
      })
    ),
    clockOffsetMs: S.OptionFromOptionalKey(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("BeepQaProvenance.clockOffsetMs", {
        description: "Video-clock to wall-clock offset in milliseconds, when correlation produced one.",
      })
    ),
    commitSha: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("BeepQaProvenance.commitSha", {
        description: "Commit SHA the captured build was running, when known.",
      })
    ),
    scenarioName: S.String.pipe(
      $I.annoteKey("BeepQaProvenance.scenarioName", {
        description: "QA scenario the artifact was captured under.",
      })
    ),
    sessionId: S.String.pipe(
      $I.annoteKey("BeepQaProvenance.sessionId", {
        description: "Capture session identifier the artifact belongs to.",
      })
    ),
    sourceVideo: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("BeepQaProvenance.sourceVideo", {
        description: "Recording the artifact was extracted from, when applicable.",
      })
    ),
    toolVersions: S.OptionFromOptionalKey(S.Record(S.String, S.String)).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("BeepQaProvenance.toolVersions", {
        description: "Tool-name to version map recorded at capture time, when known.",
      })
    ),
  }).pipe(
    $I.annoteSchema("BeepQaProvenance", {
      description: "Capture provenance embedded into QA artifacts under the XMP-beepQA namespace.",
    })
  )
) {}

/**
 * **Example** (Make XMP packet request)
 *
 * ```ts
 * import { BeepQaProvenance, WriteXmpPacketRequest } from "@beep/exiftool"
 *
 * const request = WriteXmpPacketRequest.make({
 *   filePath: "./frame.png",
 *   provenance: BeepQaProvenance.make({
 *     actionId: "act-9",
 *     capturedAtEpochMs: 1753900000000,
 *     scenarioName: "sash-drag",
 *     sessionId: "qa-round-1-1754000000000"
 *   })
 * })
 * console.log(request)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WriteXmpPacketRequest extends S.Opaque<WriteXmpPacketRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    filePath: S.String.pipe(
      $I.annoteKey("WriteXmpPacketRequest.filePath", {
        description: "Image artifact receiving the XMP-beepQA provenance packet.",
      })
    ),
    provenance: BeepQaProvenance.pipe(
      $I.annoteKey("WriteXmpPacketRequest.provenance", {
        description: "Provenance payload encoded into XMP-beepQA tag assignments.",
      })
    ),
  }).pipe(
    $I.annoteSchema("WriteXmpPacketRequest", {
      description: "Request to embed a BeepQaProvenance XMP packet into an image artifact.",
    })
  )
) {
  static readonly decodeEffect = S.decodeUnknownEffect(WriteXmpPacketRequest);
}

/**
 * Decode an unknown value into a read-tags request.
 *
 * **Example** (Decode read-tags request)
 *
 * ```ts
 * import { decodeReadTagsRequest } from "@beep/exiftool"
 *
 * const effect = decodeReadTagsRequest({ filePath: "./frame.png" })
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
// Unary by contract: no dual because input is unknown; options stays on ReadTagsRequest.decodeEffect.
export const decodeReadTagsRequest: (input: unknown) => Effect.Effect<ReadTagsRequest, S.SchemaError> =
  ReadTagsRequest.decodeEffect;

/**
 * Decode an unknown value into a write-tags request.
 *
 * **Example** (Decode write-tags request)
 *
 * ```ts
 * import { decodeWriteTagsRequest } from "@beep/exiftool"
 *
 * const effect = decodeWriteTagsRequest({
 *   assignments: [{ tagName: "XMP-beepQA:sessionId", value: "qa-round-1-1754000000000" }],
 *   filePath: "./frame.png"
 * })
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
// Unary by contract: no dual because input is unknown; options stays on WriteTagsRequest.decodeEffect.
export const decodeWriteTagsRequest: (input: unknown) => Effect.Effect<WriteTagsRequest, S.SchemaError> =
  WriteTagsRequest.decodeEffect;

/**
 * Decode an unknown value into a write-XMP-packet request.
 *
 * **Example** (Decode XMP packet request)
 *
 * ```ts
 * import { decodeWriteXmpPacketRequest } from "@beep/exiftool"
 *
 * const effect = decodeWriteXmpPacketRequest({
 *   filePath: "./frame.png",
 *   provenance: {
 *     actionId: "act-9",
 *     capturedAtEpochMs: 1753900000000,
 *     scenarioName: "sash-drag",
 *     sessionId: "qa-round-1-1754000000000"
 *   }
 * })
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
// Unary by contract: no dual because input is unknown; options stays on WriteXmpPacketRequest.decodeEffect.
export const decodeWriteXmpPacketRequest: (input: unknown) => Effect.Effect<WriteXmpPacketRequest, S.SchemaError> =
  WriteXmpPacketRequest.decodeEffect;
