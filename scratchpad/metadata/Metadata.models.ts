// import * as S from "effect/Schema";
import { $ScratchpadId } from "@beep/identity";
// import * as SchemaUtils from "@beep/schema/SchemaUtils";
// import {pipe} from "effect/Function";
// import * as Tuple from "effect/Tuple";
import { LiteralKit } from "@beep/schema/LiteralKit";

const $I = $ScratchpadId.create("metadata/Metadata.models");

export const FileCategory = LiteralKit(["image", "application", "audio", "video", "text", "misc"]).pipe(
  $I.annoteSchema("FileCategory", {
    description: "",
  })
);

export type FileCategory = typeof FileCategory.Type;

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
    description: "",
  })
);

export type MetadataSource = typeof MetadataSource.Type;

export const MetadataConfidence = LiteralKit(["exact", "derived", "heuristic"]).pipe(
  $I.annoteSchema("MetadataConfidence", {
    description: "",
  })
);

export type MetadataConfidence = typeof MetadataConfidence.Type;
