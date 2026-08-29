/**
 * Schema-backed file extension literals derived from the shared mime-type tables.
 *
 * **Details**
 *
 * This module exposes per-category schemas for the supported mime datasets and a
 * combined {@link FileExtension} schema that accepts any known extension from
 * those groups.
 *
 * **Example** (Decode category and combined schemas)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { FileExtension, ImageFileExtension } from "@beep/schema/FileExtension";
 *
 * const png = S.decodeUnknownSync(FileExtension)("png");
 * const jpeg = S.decodeUnknownSync(ImageFileExtension)("jpeg");
 * console.log([png, jpeg]);
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { application, audio, image, misc, text, video } from "@beep/data/MimeTypes";
import { $SchemaId } from "@beep/identity";
import { A, Struct } from "@beep/utils";
import { cast, pipe } from "effect";
import { LiteralKit } from "./LiteralKit/index.ts";

const $I = $SchemaId.create("FileExtension");

type MimeTypeProperty = {
  readonly [mimeType: string]: {
    readonly source: string;
    readonly extensions: A.NonEmptyReadonlyArray<string>;
  };
};

type MimeTypeExtension<T extends MimeTypeProperty> = T[keyof T]["extensions"][number];

/**
 * Extracts the distinct file extensions from a mime-type dictionary.
 *
 * **Details**
 *
 * The output preserves the encounter order from the input map while flattening
 * nested `extensions` arrays and removing duplicates.
 *
 * **Example** (Extract ordered unique extensions)
 *
 * ```ts import.meta.vitest name="Extract ordered unique extensions"
 * import { extractMimeExtensions } from "@beep/schema/FileExtension";
 *
 * const extensions = extractMimeExtensions({
 *   "text/plain": {
 *     source: "iana",
 *     extensions: ["txt"],
 *   },
 *   "text/markdown": {
 *     source: "iana",
 *     extensions: ["md", "markdown"],
 *   },
 * });
 *
 * extensions // => ["txt", "md", "markdown"]
 * ```
 *
 * @param mime - The mime-type dictionary whose extensions should be collected.
 * @returns A deduplicated non-empty list of extensions.
 * @category utilities
 * @since 0.0.0
 */
export const extractMimeExtensions = <const T extends MimeTypeProperty>(
  mime: T
): A.NonEmptyReadonlyArray<MimeTypeExtension<T>> =>
  cast<Array<MimeTypeExtension<T>>, A.NonEmptyReadonlyArray<MimeTypeExtension<T>>>(
    pipe(
      mime,
      Struct.entries,
      A.flatMap(([_, { extensions }]) => extensions),
      A.dedupe
    )
  );

/**
 * Schema for file extensions associated with `application/*` mime types.
 *
 * **Example** (Decode application extension)
 *
 * ```ts import.meta.vitest name="Decode application extension"
 * import * as S from "effect/Schema"
 * import { ApplicationFileExtension } from "@beep/schema/FileExtension"
 *
 * const ext = S.decodeUnknownSync(ApplicationFileExtension)("pdf")
 * ext // => "pdf"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ApplicationFileExtension = pipe(
  application,
  extractMimeExtensions,
  (extensions) => LiteralKit(extensions),
  $I.annoteSchema("ApplicationExtension", {
    description: "A file extension for a mime type that is an application.",
  })
);

/**
 * Union of literals accepted by {@link ApplicationFileExtension}.
 *
 * **Example** (Type application extension literal)
 *
 * ```ts import.meta.vitest name="Type application extension literal"
 * import * as S from "effect/Schema"
 * import { ApplicationFileExtension } from "@beep/schema/FileExtension"
 *
 * const ext: ApplicationFileExtension = S.decodeUnknownSync(ApplicationFileExtension)("pdf")
 * ext // => "pdf"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ApplicationFileExtension = typeof ApplicationFileExtension.Type;

/**
 * Schema for file extensions associated with `video/*` mime types.
 *
 * **Example** (Decode video extension)
 *
 * ```ts import.meta.vitest name="Decode video extension"
 * import * as S from "effect/Schema"
 * import { VideoFileExtension } from "@beep/schema/FileExtension"
 *
 * const ext = S.decodeUnknownSync(VideoFileExtension)("mp4")
 * ext // => "mp4"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const VideoFileExtension = pipe(
  video,
  extractMimeExtensions,
  (extensions) => LiteralKit(extensions),
  $I.annoteSchema("VideoExtension", {
    description: "A file extension for a mime type that is a video.",
  })
);

/**
 * Union of literals accepted by {@link VideoFileExtension}.
 *
 * **Example** (Type video extension literal)
 *
 * ```ts import.meta.vitest name="Type video extension literal"
 * import * as S from "effect/Schema"
 * import { VideoFileExtension } from "@beep/schema/FileExtension"
 *
 * const ext: VideoFileExtension = S.decodeUnknownSync(VideoFileExtension)("mp4")
 * ext // => "mp4"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VideoFileExtension = typeof VideoFileExtension.Type;

/**
 * Schema for file extensions associated with `text/*` mime types.
 *
 * **Example** (Decode text extension)
 *
 * ```ts import.meta.vitest name="Decode text extension"
 * import * as S from "effect/Schema"
 * import { TextFileExtension } from "@beep/schema/FileExtension"
 *
 * const ext = S.decodeUnknownSync(TextFileExtension)("txt")
 * ext // => "txt"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const TextFileExtension = pipe(
  text,
  extractMimeExtensions,
  (extensions) => LiteralKit(extensions),
  $I.annoteSchema("TextExtension", {
    description: "A file extension for a mime type that is text.",
  })
);

/**
 * Union of literals accepted by {@link TextFileExtension}.
 *
 * **Example** (Type text extension literal)
 *
 * ```ts import.meta.vitest name="Type text extension literal"
 * import * as S from "effect/Schema"
 * import { TextFileExtension } from "@beep/schema/FileExtension"
 *
 * const ext: TextFileExtension = S.decodeUnknownSync(TextFileExtension)("txt")
 * ext // => "txt"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TextFileExtension = typeof TextFileExtension.Type;

/**
 * Schema for file extensions associated with `image/*` mime types.
 *
 * **Example** (Decode image extension)
 *
 * ```ts import.meta.vitest name="Decode image extension"
 * import * as S from "effect/Schema"
 * import { ImageFileExtension } from "@beep/schema/FileExtension"
 *
 * const ext = S.decodeUnknownSync(ImageFileExtension)("png")
 * ext // => "png"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ImageFileExtension = pipe(
  image,
  extractMimeExtensions,
  (extensions) => LiteralKit(extensions),
  $I.annoteSchema("ImageExtension", {
    description: "A file extension for a mime type that is an image.",
  })
);

/**
 * Union of literals accepted by {@link ImageFileExtension}.
 *
 * **Example** (Type image extension literal)
 *
 * ```ts import.meta.vitest name="Type image extension literal"
 * import * as S from "effect/Schema"
 * import { ImageFileExtension } from "@beep/schema/FileExtension"
 *
 * const ext: ImageFileExtension = S.decodeUnknownSync(ImageFileExtension)("png")
 * ext // => "png"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ImageFileExtension = typeof ImageFileExtension.Type;

/**
 * Schema for file extensions associated with `audio/*` mime types.
 *
 * **Example** (Decode audio extension)
 *
 * ```ts import.meta.vitest name="Decode audio extension"
 * import * as S from "effect/Schema"
 * import { AudioFileExtension } from "@beep/schema/FileExtension"
 *
 * const ext = S.decodeUnknownSync(AudioFileExtension)("mp3")
 * ext // => "mp3"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const AudioFileExtension = pipe(
  audio,
  extractMimeExtensions,
  (extensions) => LiteralKit(extensions),
  $I.annoteSchema("AudioExtension", {
    description: "A file extension for a mime type that is an audio file.",
  })
);

/**
 * Union of literals accepted by {@link AudioFileExtension}.
 *
 * **Example** (Type audio extension literal)
 *
 * ```ts import.meta.vitest name="Type audio extension literal"
 * import * as S from "effect/Schema"
 * import { AudioFileExtension } from "@beep/schema/FileExtension"
 *
 * const ext: AudioFileExtension = S.decodeUnknownSync(AudioFileExtension)("mp3")
 * ext // => "mp3"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AudioFileExtension = typeof AudioFileExtension.Type;

/**
 * Schema for file extensions associated with miscellaneous mime types.
 *
 * **Example** (Decode misc extension)
 *
 * ```ts import.meta.vitest name="Decode misc extension"
 * import * as S from "effect/Schema"
 * import { MiscFileExtension } from "@beep/schema/FileExtension"
 *
 * const ext = S.decodeUnknownSync(MiscFileExtension)("cdx")
 * ext // => "cdx"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const MiscFileExtension = pipe(
  misc,
  extractMimeExtensions,
  (extensions) => LiteralKit(extensions),
  $I.annoteSchema("MiscExtension", {
    description: "A file extension for a mime type that is miscellaneous.",
  })
);

/**
 * Union of literals accepted by {@link MiscFileExtension}.
 *
 * **Example** (Type misc extension literal)
 *
 * ```ts import.meta.vitest name="Type misc extension literal"
 * import * as S from "effect/Schema"
 * import { MiscFileExtension } from "@beep/schema/FileExtension"
 *
 * const ext: MiscFileExtension = S.decodeUnknownSync(MiscFileExtension)("cdx")
 * ext // => "cdx"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MiscFileExtension = typeof MiscFileExtension.Type;

/**
 * Schema for any supported file extension across all mime-type categories.
 *
 * **Example** (Decode any file extension)
 *
 * ```ts import.meta.vitest name="Decode any file extension"
 * import * as S from "effect/Schema"
 * import { FileExtension } from "@beep/schema/FileExtension"
 *
 * const ext = S.decodeUnknownSync(FileExtension)("json")
 * ext // => "json"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const FileExtension = LiteralKit([
  ...ApplicationFileExtension.Options,
  ...VideoFileExtension.Options,
  ...TextFileExtension.Options,
  ...ImageFileExtension.Options,
  ...AudioFileExtension.Options,
  ...MiscFileExtension.Options,
]).pipe(
  $I.annoteSchema("FileExtension", {
    description: "A file extension for a mime type.",
  })
);

/**
 * Union of literals accepted by {@link FileExtension}.
 *
 * **Example** (Type any file extension literal)
 *
 * ```ts import.meta.vitest name="Type any file extension literal"
 * import * as S from "effect/Schema"
 * import { FileExtension } from "@beep/schema/FileExtension"
 *
 * const ext: FileExtension = S.decodeUnknownSync(FileExtension)("png")
 * ext // => "png"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FileExtension = typeof FileExtension.Type;
