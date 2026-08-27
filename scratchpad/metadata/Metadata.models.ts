/**
 * LiteralKits that classify file media, metadata provenance, and extraction
 * confidence for the metadata pipeline.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
// import * as S from "effect/Schema";
import { $ScratchpadId } from "@beep/identity";
// import * as SchemaUtils from "@beep/schema/SchemaUtils";
// import {pipe} from "effect/Function";
// import * as Tuple from "effect/Tuple";
import { LiteralKit } from "@beep/schema/LiteralKit";

const $I = $ScratchpadId.create("metadata/Metadata.models");

/**
 * Media class of a file as inferred by the metadata pipeline.
 *
 * **Example** (Guard an image file)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FileCategory } from "./Metadata.models.ts"
 *
 * console.log(S.is(FileCategory)(FileCategory.Enum.image)) // true
 * console.log(S.is(FileCategory)("exe")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FileCategory = LiteralKit(["image", "application", "audio", "video", "text", "misc"]).pipe(
  $I.annoteSchema("FileCategory", {
    description: "Media class of a file as inferred by the metadata pipeline.",
  })
);

/**
 * Decoded member of {@link FileCategory}.
 *
 * @see {@link FileCategory} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type FileCategory = typeof FileCategory.Type;

/**
 * Provenance store a metadata field was read from.
 *
 * **Example** (Guard an EXIF source)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { MetadataSource } from "./Metadata.models.ts"
 *
 * console.log(S.is(MetadataSource)(MetadataSource.Enum.exif)) // true
 * console.log(S.is(MetadataSource)("unknown")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MetadataSource = LiteralKit([
  "exif",
  "xmp",
  "iptc",
  "icc",
  "pdf-info",
  "pdf-xmp",
  "ooxml-core",
  "ooxml-custom",
  "odf-meta",
  "id3",
  "vorbis",
  "mp4",
  "matroska",
  "front-matter",
  "filesystem",
]).pipe(
  $I.annoteSchema("MetadataSource", {
    description: "Provenance store a metadata field was read from.",
  })
);

/**
 * Decoded member of {@link MetadataSource}.
 *
 * @see {@link MetadataSource} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type MetadataSource = typeof MetadataSource.Type;

/**
 * How strongly the extractor trusts a decoded metadata value.
 *
 * **Example** (Guard an exact confidence)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { MetadataConfidence } from "./Metadata.models.ts"
 *
 * console.log(S.is(MetadataConfidence)(MetadataConfidence.Enum.exact)) // true
 * console.log(S.is(MetadataConfidence)("guess")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MetadataConfidence = LiteralKit(["exact", "derived", "heuristic"]).pipe(
  $I.annoteSchema("MetadataConfidence", {
    description: "How strongly the extractor trusts a decoded metadata value.",
  })
);

/**
 * Decoded member of {@link MetadataConfidence}.
 *
 * @see {@link MetadataConfidence} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type MetadataConfidence = typeof MetadataConfidence.Type;
