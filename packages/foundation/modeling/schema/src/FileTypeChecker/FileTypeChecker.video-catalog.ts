/**
 * Internal video entries for the file-type catalog.
 *
 * @internal
 * @since 0.0.0
 */

import { makeCatalogFileTypeInfo } from "./FileTypeChecker.catalog-constructor.ts";
import type { FileTypeInfo } from "./FileTypeChecker.schema.ts";

type VideoFileType = "avi" | "flv" | "m4v" | "mkv" | "mov" | "mp4" | "ogg" | "swf" | "webm";
type VideoCatalog = { readonly [K in VideoFileType]: FileTypeInfo & { readonly extension: K } };

/**
 * Internal video metadata keyed by canonical extension.
 *
 * **Example** (Read video metadata)
 *
 * ```ts
 * import { videoCatalog } from "@beep/schema/FileTypeChecker/FileTypeChecker.video-catalog"
 *
 * console.log(videoCatalog.avi.extension) // "avi"
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const videoCatalog: VideoCatalog = {
  avi: makeCatalogFileTypeInfo({
    extension: "avi",
    mimeType: "video/x-msvideo",
    description: "Audio Video Interleave video format",
    signatures: [
      {
        sequence: [0x52, 0x49, 0x46, 0x46, 0x41, 0x56, 0x49, 0x20, 0x4c, 0x49, 0x53, 0x54],
        skippedBytes: [4, 5, 6, 7],
      },
    ],
  }),

  flv: makeCatalogFileTypeInfo({
    extension: "flv",
    mimeType: "video/x-flv",
    description: "Flash Video file",
    signatures: [
      {
        sequence: [0x46, 0x4c, 0x56, 0x01],
      },
      {
        sequence: [0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x56, 0x20],
        description: "ISO Media, MPEG v4 system, or iTunes AVC-LC file",
        offset: 4,
        compatibleExtensions: ["mp4", "m4v"],
      },
    ],
  }),

  m4v: makeCatalogFileTypeInfo({
    extension: "m4v",
    mimeType: "video/x-m4v",
    description: "Apple's video container format, very similar to MP4",
    signatures: [
      {
        sequence: [0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32],
        description: "MPEG-4 video | QuickTime file",
        offset: 4,
        compatibleExtensions: ["mp4"],
      },
      {
        sequence: [0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x56, 0x20],
        description: "ISO Media, MPEG v4 system, or iTunes AVC-LC file",
        offset: 4,
        compatibleExtensions: ["mp4", "flv"],
      },
    ],
  }),

  mkv: makeCatalogFileTypeInfo({
    extension: "mkv",
    mimeType: "video/x-matroska",
    description:
      "MKV (Matroska Video) is a flexible, open-source media container format that supports multiple audio, video, and subtitle streams in a single file",
    signatures: [
      {
        sequence: [0x1a, 0x45, 0xdf, 0xa3],
        description: "EBML identifier",
        compatibleExtensions: ["webm", "mka", "mks", "mk3d"],
      },
    ],
  }),

  mov: makeCatalogFileTypeInfo({
    extension: "mov",
    mimeType: "video/quicktime",
    description: "QuickTime movie file",
    signatures: [
      {
        sequence: [0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20],
        offset: 4,
      },
      {
        sequence: [0x6d, 0x6f, 0x6f, 0x76],
        offset: 4,
      },
    ],
  }),

  mp4: makeCatalogFileTypeInfo({
    extension: "mp4",
    mimeType: "video/mp4",
    description:
      "A multimedia container format widely used for storing audio, video, and other data, and is known for its high compression efficiency and compatibility with many devices",
    signatures: [
      {
        sequence: [0x66, 0x74, 0x79, 0x70, 0x4d, 0x53, 0x4e, 0x56],
        description: "MPEG-4 video file",
        offset: 4,
      },
      {
        sequence: [0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d],
        description: "ISO Base Media file (MPEG-4) v1",
        offset: 4,
      },
      {
        sequence: [0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x56, 0x20],
        description: "ISO Media, MPEG v4 system, or iTunes AVC-LC file",
        offset: 4,
        compatibleExtensions: ["m4v", "flv"],
      },
    ],
  }),

  ogg: makeCatalogFileTypeInfo({
    extension: "ogg",
    mimeType: "video/ogg",
    description: "Ogg Vorbis Codec compressed Multimedia file",
    signatures: [
      {
        sequence: [0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        compatibleExtensions: ["oga", "ogv", "ogx"],
      },
    ],
  }),

  swf: makeCatalogFileTypeInfo({
    extension: "swf",
    mimeType: "application/x-shockwave-flash",
    description:
      "SWF (Shockwave Flash) is a file format for multimedia, vector graphics, and ActionScript, used for creating and delivering animations, games, and other interactive web-based content",
    signatures: [
      {
        sequence: [0x43, 0x57, 0x53],
        description: "Macromedia Shockwave Flash player file (zlib compressed, SWF 6 and later)",
      },
      {
        sequence: [0x46, 0x57, 0x53],
        description: "Macromedia Shockwave Flash player file (uncompressed)",
      },
      {
        sequence: [0x5a, 0x57, 0x53],
        description: "Macromedia Shockwave Flash player file (uncompressed)",
      },
    ],
  }),

  webm: makeCatalogFileTypeInfo({
    extension: "webm",
    mimeType: "video/webm",
    description:
      "WebM is a royalty-free, open-source media file format optimized for web delivery, using efficient VP8 video and Vorbis audio codecs",
    signatures: [
      {
        sequence: [0x1a, 0x45, 0xdf, 0xa3],
        description: "EBML identifier",
        compatibleExtensions: ["mkv"],
      },
    ],
  }),
};
