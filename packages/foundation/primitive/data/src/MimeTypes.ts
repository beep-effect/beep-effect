/**
 * Edge-compatible MIME type lookup utilities.
 *
 * Vendored from `mime-types`, ported to TypeScript, and adapted to avoid
 * Node-only APIs like `path.extname` so the module runs in edge runtimes
 * (Cloudflare Workers, Deno Deploy, Vercel Edge, etc.).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as official from "./generated/iana-media-types.ts";
import * as internal from "./internal/data/mime-types/index.ts";

// -------------------------------------------------------------------------------------
// types
// -------------------------------------------------------------------------------------

/**
 * Union of all known MIME type strings derived from the vendored mime-db data.
 *
 * Each member is a full MIME type string such as `"application/json"` or `"image/png"`.
 *
 * **Example** (Use MIME type union)
 *
 * ```ts import.meta.vitest name="Use MIME type union"
 * import type { MimeType } from "@beep/data/MimeTypes"
 *
 * const contentType: MimeType = "application/json"
 * console.assert(contentType === "application/json")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type MimeType = internal.MimeType;

/**
 * Union of official IANA media type strings from the generated registry data.
 *
 * **Example** (Use official MIME type union)
 *
 * ```ts import.meta.vitest name="Use official MIME type union"
 * import type { OfficialMimeType } from "@beep/data/MimeTypes"
 *
 * const contentType: OfficialMimeType = "application/json"
 * console.assert(contentType === "application/json")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OfficialMimeType = (typeof official.OfficialMimeTypeDataTypeValues)[number];

/**
 * Union of official IANA `application/*` media type strings.
 *
 * **Example** (Use application MIME type union)
 *
 * ```ts import.meta.vitest name="Use application MIME type union"
 * import type { ApplicationMimeType } from "@beep/data/MimeTypes"
 *
 * const contentType: ApplicationMimeType = "application/json"
 * console.assert(contentType === "application/json")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ApplicationMimeType = (typeof official.ApplicationMimeTypeValues)[number];

/**
 * Union of official IANA `audio/*` media type strings.
 *
 * **Example** (Use audio MIME type union)
 *
 * ```ts import.meta.vitest name="Use audio MIME type union"
 * import type { AudioMimeType } from "@beep/data/MimeTypes"
 *
 * const contentType: AudioMimeType = "audio/mpeg"
 * console.assert(contentType === "audio/mpeg")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AudioMimeType = (typeof official.AudioMimeTypeValues)[number];

/**
 * Union of official IANA `image/*` media type strings.
 *
 * **Example** (Use image MIME type union)
 *
 * ```ts import.meta.vitest name="Use image MIME type union"
 * import type { ImageMimeType } from "@beep/data/MimeTypes"
 *
 * const contentType: ImageMimeType = "image/png"
 * console.assert(contentType === "image/png")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ImageMimeType = (typeof official.ImageMimeTypeValues)[number];

/**
 * Union of official IANA `text/*` media type strings.
 *
 * **Example** (Use text MIME type union)
 *
 * ```ts import.meta.vitest name="Use text MIME type union"
 * import type { TextMimeType } from "@beep/data/MimeTypes"
 *
 * const contentType: TextMimeType = "text/plain"
 * console.assert(contentType === "text/plain")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TextMimeType = (typeof official.TextMimeTypeValues)[number];

/**
 * Union of official IANA `video/*` media type strings.
 *
 * **Example** (Use video MIME type union)
 *
 * ```ts import.meta.vitest name="Use video MIME type union"
 * import type { VideoMimeType } from "@beep/data/MimeTypes"
 *
 * const contentType: VideoMimeType = "video/mp4"
 * console.assert(contentType === "video/mp4")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type VideoMimeType = (typeof official.VideoMimeTypeValues)[number];

/**
 * Union of official IANA media type strings outside the primary top-level categories.
 *
 * **Example** (Use miscellaneous MIME type union)
 *
 * ```ts import.meta.vitest name="Use miscellaneous MIME type union"
 * import type { MiscMimeType } from "@beep/data/MimeTypes"
 *
 * const contentType: MiscMimeType = "font/woff2"
 * console.assert(contentType === "font/woff2")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type MiscMimeType = (typeof official.MiscMimeTypeValues)[number];

/**
 * A single official IANA media type registry entry.
 *
 * **Example** (Inspect official MIME type data)
 *
 * ```ts import.meta.vitest name="Inspect official MIME type data"
 * import { OfficialMimeTypeDataByType, type OfficialMimeTypeData } from "@beep/data/MimeTypes"
 *
 * const json: OfficialMimeTypeData = OfficialMimeTypeDataByType["application/json"]
 * console.assert(json.topLevel === "application")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OfficialMimeTypeData = (typeof official.OfficialMimeTypeDataValues)[number];

/**
 * Union of all known file extension strings (without leading dot) derived
 * from the vendored mime-db data.
 *
 * Each member is a bare extension like `"json"`, `"html"`, or `"png"`.
 *
 * **Example** (Use file extension union)
 *
 * ```ts import.meta.vitest name="Use file extension union"
 * import type { FileExtension } from "@beep/data/MimeTypes"
 *
 * const ext: FileExtension = "json"
 * console.assert(ext === "json")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type FileExtension = internal.FileExtension;

type MimeTypeDefinition = {
  source: string;
  extensions: FileExtension[];
};

// -------------------------------------------------------------------------------------
// data
// -------------------------------------------------------------------------------------

/**
 * Record of `application/*` MIME type definitions sourced from IANA, Apache,
 * and Nginx registries.
 *
 * **Example** (Use application MIME records)
 *
 * ```ts import.meta.vitest name="Use application MIME records"
 * import { application } from "@beep/data/MimeTypes"
 *
 * console.assert(application["application/json"].extensions.includes("json"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const application: typeof internal.application = internal.application;

/**
 * Record of `audio/*` MIME type definitions sourced from IANA, Apache,
 * and Nginx registries.
 *
 * **Example** (Use audio MIME records)
 *
 * ```ts import.meta.vitest name="Use audio MIME records"
 * import { audio } from "@beep/data/MimeTypes"
 *
 * console.assert(audio["audio/mpeg"].extensions.includes("mp3"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const audio: typeof internal.audio = internal.audio;

/**
 * Record of `image/*` MIME type definitions sourced from IANA, Apache,
 * and Nginx registries.
 *
 * **Example** (Use image MIME records)
 *
 * ```ts import.meta.vitest name="Use image MIME records"
 * import { image } from "@beep/data/MimeTypes"
 *
 * console.assert(image["image/png"].extensions.includes("png"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const image: typeof internal.image = internal.image;

/**
 * Record of miscellaneous MIME type definitions covering chemical, font,
 * message, model, and x-conference types.
 *
 * **Example** (Use miscellaneous MIME records)
 *
 * ```ts import.meta.vitest name="Use miscellaneous MIME records"
 * import { misc } from "@beep/data/MimeTypes"
 *
 * console.assert(misc["font/woff2"].extensions.includes("woff2"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const misc: typeof internal.misc = internal.misc;

/**
 * Record of `text/*` MIME type definitions sourced from IANA, Apache,
 * and Nginx registries.
 *
 * **Example** (Use text MIME records)
 *
 * ```ts import.meta.vitest name="Use text MIME records"
 * import { text } from "@beep/data/MimeTypes"
 *
 * console.assert(text["text/html"].extensions.includes("html"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const text: typeof internal.text = internal.text;

/**
 * Record of `video/*` MIME type definitions sourced from IANA, Apache,
 * and Nginx registries.
 *
 * **Example** (Use video MIME records)
 *
 * ```ts import.meta.vitest name="Use video MIME records"
 * import { video } from "@beep/data/MimeTypes"
 *
 * console.assert(video["video/mp4"].extensions.includes("mp4"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const video: typeof internal.video = internal.video;

// -------------------------------------------------------------------------------------
// constants
// -------------------------------------------------------------------------------------

/**
 * Combined record of all MIME type definitions across every category
 * (application, audio, image, text, video, and miscellaneous).
 *
 * This is the raw merged data object that backs the `mimeTypes` typed record.
 *
 * **Example** (Use extension-to-MIME map)
 *
 * ```ts import.meta.vitest name="Use extension-to-MIME map"
 * import { mimes } from "@beep/data/MimeTypes"
 *
 * console.assert(mimes["text/css"].extensions.includes("css"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const mimes: typeof internal.mimes = internal.mimes;

/**
 * Record mapping each known MIME type to its source registry and associated
 * file extensions. The source indicates where the MIME type definition
 * originated (`"iana"`, `"apache"`, or `"nginx"`).
 *
 * **Example** (Use MIME-to-extension map)
 *
 * ```ts import.meta.vitest name="Use MIME-to-extension map"
 * import { mimeTypes } from "@beep/data/MimeTypes"
 *
 * const json = mimeTypes["application/json"]
 * console.assert(json.extensions.includes("json"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const mimeTypes: Record<MimeType, MimeTypeDefinition> = internal.mimeTypes;

/**
 * Stable source metadata for the generated official IANA media type registry.
 *
 * **Example** (Inspect MIME registry metadata)
 *
 * ```ts import.meta.vitest name="Inspect MIME registry metadata"
 * import { OfficialMimeTypeDataMetadata, OfficialMimeTypeDataUpdated } from "@beep/data/MimeTypes"
 *
 * console.assert(OfficialMimeTypeDataMetadata.updated === OfficialMimeTypeDataUpdated)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OfficialMimeTypeDataMetadata: typeof official.OfficialMimeTypeDataMetadata =
  official.OfficialMimeTypeDataMetadata;

/**
 * Last updated date reported by the official IANA media type registry.
 *
 * **Example** (Read MIME registry update date)
 *
 * ```ts import.meta.vitest name="Read MIME registry update date"
 * import { OfficialMimeTypeDataUpdated } from "@beep/data/MimeTypes"
 *
 * console.assert(OfficialMimeTypeDataUpdated.length === "YYYY-MM-DD".length)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OfficialMimeTypeDataUpdated: typeof official.OfficialMimeTypeDataUpdated =
  official.OfficialMimeTypeDataUpdated;

/**
 * Official IANA media type registry source URL.
 *
 * **Example** (Read MIME registry source URL)
 *
 * ```ts import.meta.vitest name="Read MIME registry source URL"
 * import { OfficialMimeTypeDataSourceUrl } from "@beep/data/MimeTypes"
 *
 * console.assert(OfficialMimeTypeDataSourceUrl.endsWith("media-types.xml"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OfficialMimeTypeDataSourceUrl: typeof official.OfficialMimeTypeDataSourceUrl =
  official.OfficialMimeTypeDataSourceUrl;

/**
 * SHA-256 digest of the official source payload used for the generated dataset.
 *
 * **Example** (Read MIME registry source digest)
 *
 * ```ts import.meta.vitest name="Read MIME registry source digest"
 * import { OfficialMimeTypeDataSourceSha256 } from "@beep/data/MimeTypes"
 *
 * console.assert(OfficialMimeTypeDataSourceSha256.length === 64)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OfficialMimeTypeDataSourceSha256: typeof official.OfficialMimeTypeDataSourceSha256 =
  official.OfficialMimeTypeDataSourceSha256;

/**
 * Official IANA media type registry entries.
 *
 * **Example** (Inspect MIME registry values)
 *
 * ```ts import.meta.vitest name="Inspect MIME registry values"
 * import { OfficialMimeTypeDataValues } from "@beep/data/MimeTypes"
 *
 * const json = OfficialMimeTypeDataValues.find((entry) => entry.type === "application/json")
 * console.assert(json?.topLevel === "application")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OfficialMimeTypeDataValues: typeof official.OfficialMimeTypeDataValues =
  official.OfficialMimeTypeDataValues;

/**
 * Official IANA media type registry entries keyed by full media type.
 *
 * **Example** (Look up an official MIME type)
 *
 * ```ts import.meta.vitest name="Look up an official MIME type"
 * import { OfficialMimeTypeDataByType } from "@beep/data/MimeTypes"
 *
 * console.assert(OfficialMimeTypeDataByType["application/json"].name === "json")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OfficialMimeTypeDataByType: typeof official.OfficialMimeTypeDataByType =
  official.OfficialMimeTypeDataByType;

/**
 * Official IANA media type literal values.
 *
 * **Example** (Inspect official MIME type values)
 *
 * ```ts import.meta.vitest name="Inspect official MIME type values"
 * import { OfficialMimeTypeDataTypeValues } from "@beep/data/MimeTypes"
 *
 * console.assert(OfficialMimeTypeDataTypeValues.includes("application/json"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OfficialMimeTypeDataTypeValues: typeof official.OfficialMimeTypeDataTypeValues =
  official.OfficialMimeTypeDataTypeValues;

/**
 * Official IANA `application/*` media type literal values.
 *
 * **Example** (Inspect application MIME type values)
 *
 * ```ts import.meta.vitest name="Inspect application MIME type values"
 * import { ApplicationMimeTypeValues } from "@beep/data/MimeTypes"
 *
 * console.assert(ApplicationMimeTypeValues.includes("application/json"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ApplicationMimeTypeValues: typeof official.ApplicationMimeTypeValues = official.ApplicationMimeTypeValues;

/**
 * Official IANA `audio/*` media type literal values.
 *
 * **Example** (Inspect audio MIME type values)
 *
 * ```ts import.meta.vitest name="Inspect audio MIME type values"
 * import { AudioMimeTypeValues } from "@beep/data/MimeTypes"
 *
 * console.assert(AudioMimeTypeValues.includes("audio/mpeg"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const AudioMimeTypeValues: typeof official.AudioMimeTypeValues = official.AudioMimeTypeValues;

/**
 * Official IANA `image/*` media type literal values.
 *
 * **Example** (Inspect image MIME type values)
 *
 * ```ts import.meta.vitest name="Inspect image MIME type values"
 * import { ImageMimeTypeValues } from "@beep/data/MimeTypes"
 *
 * console.assert(ImageMimeTypeValues.includes("image/png"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ImageMimeTypeValues: typeof official.ImageMimeTypeValues = official.ImageMimeTypeValues;

/**
 * Official IANA `text/*` media type literal values.
 *
 * **Example** (Inspect text MIME type values)
 *
 * ```ts import.meta.vitest name="Inspect text MIME type values"
 * import { TextMimeTypeValues } from "@beep/data/MimeTypes"
 *
 * console.assert(TextMimeTypeValues.includes("text/plain"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TextMimeTypeValues: typeof official.TextMimeTypeValues = official.TextMimeTypeValues;

/**
 * Official IANA `video/*` media type literal values.
 *
 * **Example** (Inspect video MIME type values)
 *
 * ```ts import.meta.vitest name="Inspect video MIME type values"
 * import { VideoMimeTypeValues } from "@beep/data/MimeTypes"
 *
 * console.assert(VideoMimeTypeValues.includes("video/mp4"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VideoMimeTypeValues: typeof official.VideoMimeTypeValues = official.VideoMimeTypeValues;

/**
 * Official IANA media type literal values outside the primary top-level categories.
 *
 * **Example** (Inspect miscellaneous MIME type values)
 *
 * ```ts import.meta.vitest name="Inspect miscellaneous MIME type values"
 * import { MiscMimeTypeValues } from "@beep/data/MimeTypes"
 *
 * console.assert(MiscMimeTypeValues.includes("font/woff2"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MiscMimeTypeValues: typeof official.MiscMimeTypeValues = official.MiscMimeTypeValues;

/**
 * Official IANA media type entries grouped for schema category helpers.
 *
 * **Example** (Group MIME types by top level)
 *
 * ```ts import.meta.vitest name="Group MIME types by top level"
 * import { OfficialMimeTypeDataByTopLevel } from "@beep/data/MimeTypes"
 *
 * console.assert(OfficialMimeTypeDataByTopLevel.application["application/json"].name === "json")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OfficialMimeTypeDataByTopLevel: typeof official.OfficialMimeTypeDataByTopLevel =
  official.OfficialMimeTypeDataByTopLevel;

// -------------------------------------------------------------------------------------
// getters
// -------------------------------------------------------------------------------------

/**
 * Returns a record mapping each file extension (without leading dot) to its
 * preferred MIME type string. Preference is determined by source priority:
 * IANA, then unspecified, then Apache, then Nginx.
 *
 * Lazily populates the internal lookup tables on first call; subsequent
 * calls return the same cached object.
 *
 * **Example** (Get MIME types for an extension)
 *
 * ```ts import.meta.vitest name="Get MIME types for an extension"
 * import { getTypes } from "@beep/data/MimeTypes"
 *
 * const types = getTypes()
 * console.assert(types.json === "application/json" && types.html === "text/html")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const getTypes: () => Record<FileExtension, MimeType> = internal.getTypes;

/**
 * Returns a record mapping each known MIME type to an array of its associated
 * file extensions (without leading dots).
 *
 * Lazily populates the internal lookup tables on first call; subsequent
 * calls return the same cached object.
 *
 * **Example** (Get extensions for a MIME type)
 *
 * ```ts import.meta.vitest name="Get extensions for a MIME type"
 * import { getExtensions } from "@beep/data/MimeTypes"
 *
 * const extensions = getExtensions()
 * console.assert(extensions["application/json"].includes("json"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const getExtensions: () => Record<MimeType, FileExtension[]> = internal.getExtensions;

// -------------------------------------------------------------------------------------
// lookups
// -------------------------------------------------------------------------------------

/**
 * Look up the MIME type for a file path or extension.
 *
 * Accepts a bare extension (`"json"`), a dotted extension (`".json"`), or a
 * full file path (`"path/to/file.json"`). The lookup is case-insensitive.
 * Returns the matching MIME type string, or `false` if no match is found.
 *
 * **Example** (Look up a MIME type by extension)
 *
 * ```ts import.meta.vitest name="Look up a MIME type by extension"
 * import { lookup } from "@beep/data/MimeTypes"
 *
 * console.assert(lookup("json") === "application/json")
 * console.assert(lookup("unknown.zzzzz") === false)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const lookup: (path: string) => false | MimeType = internal.lookup;
