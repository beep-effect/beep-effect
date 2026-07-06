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
 * @example
 * ```typescript
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
 * @example
 * ```typescript
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
 * A single official IANA media type registry entry.
 *
 * @example
 * ```typescript
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
 * @example
 * ```typescript
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
 * @example
 * ```typescript
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
 * @example
 * ```typescript
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
 * @example
 * ```typescript
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
 * @example
 * ```typescript
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
 * @example
 * ```typescript
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
 * @example
 * ```typescript
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
 * @example
 * ```typescript
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
 * @example
 * ```typescript
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
 * @example
 * ```typescript
 * import { OfficialMimeTypeDataMetadata } from "@beep/data/MimeTypes"
 *
 * console.assert(OfficialMimeTypeDataMetadata.updated === "2026-06-12")
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
 * @example
 * ```typescript
 * import { OfficialMimeTypeDataUpdated } from "@beep/data/MimeTypes"
 *
 * console.assert(OfficialMimeTypeDataUpdated === "2026-06-12")
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
 * @example
 * ```typescript
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
 * @example
 * ```typescript
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
 * @example
 * ```typescript
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
 * @example
 * ```typescript
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
 * @example
 * ```typescript
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
 * Official IANA media type entries grouped for schema category helpers.
 *
 * @example
 * ```typescript
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
 * @example
 * ```typescript
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
 * @example
 * ```typescript
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
 * @example
 * ```typescript
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
