/**
 * MIME type literal schemas derived from the official IANA registry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ApplicationMimeTypeValues,
  AudioMimeTypeValues,
  ImageMimeTypeValues,
  MiscMimeTypeValues,
  OfficialMimeTypeDataTypeValues,
  TextMimeTypeValues,
  VideoMimeTypeValues,
} from "@beep/data/MimeTypes";
import { $SchemaId } from "@beep/identity/packages";
import { A, Struct } from "@beep/utils";
import { Function as Fn, flow, pipe } from "effect";
import { LiteralKit } from "./LiteralKit/index.ts";
import type { LiteralKit as LiteralKitSchema } from "./LiteralKit/index.ts";

const $I = $SchemaId.create("MimeType");

type MimeTypeProperty = {
  readonly [mimeType: string]: unknown;
};
type MimeTypeKey<T extends MimeTypeProperty> = keyof T & string;

/**
 * Extracts all MIME type keys from a MIME type dictionary as a deduplicated array.
 *
 * **Example** (Use MIME type schemas)
 *
 * ```ts
 * import { extractMimeTypes } from "@beep/schema/MimeType"
 *
 * const values = extractMimeTypes({
 *   "application/json": {},
 *   "text/plain": {},
 * })
 *
 * console.log(values.join(", ")) // "application/json, text/plain"
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export const extractMimeTypes: <const T extends MimeTypeProperty>(mime: T) => ReadonlyArray<MimeTypeKey<T>> = flow(
  Struct.keys,
  A.dedupe
);

const mimeTypeKinds = {
  Application: LiteralKit(ApplicationMimeTypeValues),
  Video: LiteralKit(VideoMimeTypeValues),
  Text: LiteralKit(TextMimeTypeValues),
  Image: LiteralKit(ImageMimeTypeValues),
  Audio: LiteralKit(AudioMimeTypeValues),
  Misc: LiteralKit(MiscMimeTypeValues),
} as const;

type MimeTypeSchema = LiteralKitSchema<typeof OfficialMimeTypeDataTypeValues> & {
  readonly kinds: typeof mimeTypeKinds;
};

/**
 * Schema kit that covers official IANA media type literals with per-category sub-schemas.
 *
 * **Example** (Use MIME type schemas)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { MimeType } from "@beep/schema/MimeType"
 *
 * const mediaType = S.decodeUnknownSync(MimeType)("application/json")
 * console.log(S.is(MimeType.kinds.Application)(mediaType)) // true
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const MimeType: MimeTypeSchema = pipe(mimeTypeKinds, (kinds) => {
  const base = LiteralKit(OfficialMimeTypeDataTypeValues).pipe(
    $I.annoteSchema("MimeType", {
      description: "An official IANA media type.",
    })
  );
  Reflect.set(base, "kinds", kinds);
  return Fn.cast(base);
});

/**
 * Union of official IANA media-type literals.
 *
 * **Example** (Use MIME type schemas)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { MimeType } from "@beep/schema/MimeType"
 *
 * const mediaType: MimeType = S.decodeUnknownSync(MimeType)("text/plain")
 * console.log(mediaType) // "text/plain"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type MimeType = typeof MimeType.Type;

/**
 * Schema for `application/*` media-type literals.
 *
 * **Example** (Use MIME type schemas)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ApplicationMimeType } from "@beep/schema/MimeType"
 *
 * const mediaType = S.decodeUnknownSync(ApplicationMimeType)("application/json")
 * console.log(mediaType) // "application/json"
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const ApplicationMimeType = MimeType.kinds.Application;

/**
 * Union of application media-type literals.
 *
 * **Example** (Use MIME type schemas)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ApplicationMimeType } from "@beep/schema/MimeType"
 *
 * const mediaType: ApplicationMimeType = S.decodeUnknownSync(ApplicationMimeType)("application/json")
 * console.log(mediaType) // "application/json"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type ApplicationMimeType = typeof MimeType.kinds.Application.Type;

/**
 * Schema for `video/*` media-type literals.
 *
 * **Example** (Use MIME type schemas)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { VideoMimeType } from "@beep/schema/MimeType"
 *
 * const mediaType = S.decodeUnknownSync(VideoMimeType)("video/mp4")
 * console.log(mediaType) // "video/mp4"
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const VideoMimeType = MimeType.kinds.Video;

/**
 * Union of video media-type literals.
 *
 * **Example** (Use MIME type schemas)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { VideoMimeType } from "@beep/schema/MimeType"
 *
 * const mediaType: VideoMimeType = S.decodeUnknownSync(VideoMimeType)("video/mp4")
 * console.log(mediaType) // "video/mp4"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type VideoMimeType = typeof MimeType.kinds.Video.Type;

/**
 * Schema for `text/*` media-type literals.
 *
 * **Example** (Use MIME type schemas)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TextMimeType } from "@beep/schema/MimeType"
 *
 * const mediaType = S.decodeUnknownSync(TextMimeType)("text/plain")
 * console.log(mediaType) // "text/plain"
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const TextMimeType = MimeType.kinds.Text;

/**
 * Union of text media-type literals.
 *
 * **Example** (Use MIME type schemas)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TextMimeType } from "@beep/schema/MimeType"
 *
 * const mediaType: TextMimeType = S.decodeUnknownSync(TextMimeType)("text/plain")
 * console.log(mediaType) // "text/plain"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type TextMimeType = typeof MimeType.kinds.Text.Type;

/**
 * Schema for `image/*` media-type literals.
 *
 * **Example** (Use MIME type schemas)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ImageMimeType } from "@beep/schema/MimeType"
 *
 * const mediaType = S.decodeUnknownSync(ImageMimeType)("image/png")
 * console.log(mediaType) // "image/png"
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const ImageMimeType = MimeType.kinds.Image;

/**
 * Union of image media-type literals.
 *
 * **Example** (Use MIME type schemas)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ImageMimeType } from "@beep/schema/MimeType"
 *
 * const mediaType: ImageMimeType = S.decodeUnknownSync(ImageMimeType)("image/png")
 * console.log(mediaType) // "image/png"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type ImageMimeType = typeof MimeType.kinds.Image.Type;

/**
 * Schema for `audio/*` media-type literals.
 *
 * **Example** (Use MIME type schemas)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AudioMimeType } from "@beep/schema/MimeType"
 *
 * const mediaType = S.decodeUnknownSync(AudioMimeType)("audio/mpeg")
 * console.log(mediaType) // "audio/mpeg"
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const AudioMimeType = MimeType.kinds.Audio;

/**
 * Union of audio media-type literals.
 *
 * **Example** (Use MIME type schemas)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AudioMimeType } from "@beep/schema/MimeType"
 *
 * const mediaType: AudioMimeType = S.decodeUnknownSync(AudioMimeType)("audio/mpeg")
 * console.log(mediaType) // "audio/mpeg"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type AudioMimeType = typeof MimeType.kinds.Audio.Type;

/**
 * Schema for non-core top-level media-type literals.
 *
 * **Example** (Use MIME type schemas)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { MiscMimeType } from "@beep/schema/MimeType"
 *
 * const mediaType = S.decodeUnknownSync(MiscMimeType)("font/woff2")
 * console.log(mediaType) // "font/woff2"
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const MiscMimeType = MimeType.kinds.Misc;

/**
 * Union of non-core top-level media-type literals.
 *
 * **Example** (Use MIME type schemas)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { MiscMimeType } from "@beep/schema/MimeType"
 *
 * const mediaType: MiscMimeType = S.decodeUnknownSync(MiscMimeType)("font/woff2")
 * console.log(mediaType) // "font/woff2"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type MiscMimeType = typeof MimeType.kinds.Misc.Type;
