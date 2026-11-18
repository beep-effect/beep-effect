/**
 * Media item metadata: what the platform learned about a stored media item by reading it.
 *
 * **Details**
 *
 * Every media item has a size. What else is known depends on what the item
 * is: a document has pages, an image has bands and maybe a position on Earth,
 * audio and video have a bit rate and a duration, an email has correspondents
 * and attachments. {@link MediaItemMetadata} is the wire's own tagged union of
 * those ten cases. OSDK copies nine of them by hand and funnels the tenth
 * (`cad`) and anything newer into an `unknown` wrapper; here every wire case
 * is a case, and a tag the platform adds later fails decoding instead of
 * hiding behind a wrapper.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, MappedLiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Tuple from "effect/Tuple";
import { MediaType, SizeBytes } from "../Attachment/Attachment.model.ts";
import { absent } from "../internal/AbsentKey.ts";

const $I = $ScratchpadId.create("osdk/Media/MediaMetadata.model");

// -----------------------------------------------------------------------------
// Literal domains
// -----------------------------------------------------------------------------

/**
 * The kinds of media item the platform describes, each with its own metadata record.
 *
 * **Details**
 *
 * `untyped` is a real kind, not a fallback: it describes an item the platform
 * stores without recognising its type.
 *
 * **Example** (List the kinds of media item)
 *
 * ```ts import.meta.vitest name="List the kinds of media item"
 * import { MediaItemMetadataKind } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const kinds = MediaItemMetadataKind.literals
 * kinds // => ["document", "imagery", "audio", "video", "dicom", "email", "model3d", "spreadsheet", "untyped", "cad"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MediaItemMetadataKind = LiteralKit([
  "document",
  "imagery",
  "audio",
  "video",
  "dicom",
  "email",
  "model3d",
  "spreadsheet",
  "untyped",
  "cad",
]).pipe(
  $I.annoteSchema("MediaItemMetadataKind", {
    description: "The kinds of media item the platform describes, each with its own metadata record.",
  })
);

/**
 * Runtime type of {@link MediaItemMetadataKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type MediaItemMetadataKind = typeof MediaItemMetadataKind.Type;

/**
 * File formats the platform reads audio from.
 *
 * **Example** (Decode an audio format)
 *
 * ```ts import.meta.vitest name="Decode an audio format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AudioDecodeFormat } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(AudioDecodeFormat)("NIST_SPHERE"))
 * decoded // => "nistSphere"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AudioDecodeFormat = MappedLiteralKit([
  ["FLAC", "flac"],
  ["MP2", "mp2"],
  ["MP3", "mp3"],
  ["MP4", "mp4"],
  ["NIST_SPHERE", "nistSphere"],
  ["OGG", "ogg"],
  ["WAV", "wav"],
  ["WEBM", "webm"],
]).pipe($I.annoteSchema("AudioDecodeFormat", { description: "File formats the platform reads audio from." }));

/**
 * Runtime type of {@link AudioDecodeFormat}.
 *
 * @category models
 * @since 0.0.0
 */
export type AudioDecodeFormat = typeof AudioDecodeFormat.Type;

/**
 * Container formats the platform reads video from.
 *
 * **Example** (Decode a video container format)
 *
 * ```ts import.meta.vitest name="Decode a video container format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { VideoDecodeFormat } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(VideoDecodeFormat)("MKV"))
 * decoded // => "mkv"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VideoDecodeFormat = MappedLiteralKit([
  ["MP4", "mp4"],
  ["MKV", "mkv"],
  ["MOV", "mov"],
  ["TS", "ts"],
  ["WEBM", "webm"],
]).pipe($I.annoteSchema("VideoDecodeFormat", { description: "Container formats the platform reads video from." }));

/**
 * Runtime type of {@link VideoDecodeFormat}.
 *
 * @category models
 * @since 0.0.0
 */
export type VideoDecodeFormat = typeof VideoDecodeFormat.Type;

/**
 * File formats the platform reads documents from.
 *
 * **Example** (Decode a document format)
 *
 * ```ts import.meta.vitest name="Decode a document format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DocumentDecodeFormat } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(DocumentDecodeFormat)("DOCX"))
 * decoded // => "docx"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocumentDecodeFormat = MappedLiteralKit([
  ["PDF", "pdf"],
  ["DOC", "doc"],
  ["DOCX", "docx"],
  ["TXT", "txt"],
  ["PPTX", "pptx"],
  ["RTF", "rtf"],
]).pipe(
  $I.annoteSchema("DocumentDecodeFormat", { description: "File formats the platform reads documents from." })
);

/**
 * Runtime type of {@link DocumentDecodeFormat}.
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentDecodeFormat = typeof DocumentDecodeFormat.Type;

/**
 * File formats the platform reads spreadsheets from.
 *
 * **Example** (Decode a spreadsheet format)
 *
 * ```ts import.meta.vitest name="Decode a spreadsheet format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SpreadsheetDecodeFormat } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(SpreadsheetDecodeFormat)("XLSX"))
 * decoded // => "xlsx"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SpreadsheetDecodeFormat = MappedLiteralKit([
  ["CSV", "csv"],
  ["XLSX", "xlsx"],
]).pipe(
  $I.annoteSchema("SpreadsheetDecodeFormat", { description: "File formats the platform reads spreadsheets from." })
);

/**
 * Runtime type of {@link SpreadsheetDecodeFormat}.
 *
 * @category models
 * @since 0.0.0
 */
export type SpreadsheetDecodeFormat = typeof SpreadsheetDecodeFormat.Type;

/**
 * File formats the platform reads images from.
 *
 * **Details**
 *
 * This is wider than the formats a transformation can write: an image stored
 * as `bmp`, `nitf` or `jp2k` can be read but never produced.
 *
 * **Example** (Decode an image format)
 *
 * ```ts import.meta.vitest name="Decode an image format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ImageryDecodeFormat } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const format = await Effect.runPromise(S.decodeUnknownEffect(ImageryDecodeFormat)("JP2K"))
 * format // => "jp2k"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ImageryDecodeFormat = MappedLiteralKit([
  ["BMP", "bmp"],
  ["TIFF", "tiff"],
  ["NITF", "nitf"],
  ["JP2K", "jp2k"],
  ["JPG", "jpg"],
  ["PNG", "png"],
  ["WEBP", "webp"],
]).pipe($I.annoteSchema("ImageryDecodeFormat", { description: "File formats the platform reads images from." }));

/**
 * Runtime type of {@link ImageryDecodeFormat}.
 *
 * @category models
 * @since 0.0.0
 */
export type ImageryDecodeFormat = typeof ImageryDecodeFormat.Type;

/**
 * File formats the platform reads emails from.
 *
 * **Example** (Decode an email format)
 *
 * ```ts import.meta.vitest name="Decode an email format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { EmailDecodeFormat } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(EmailDecodeFormat)("EML"))
 * decoded // => "eml"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EmailDecodeFormat = MappedLiteralKit([["EML", "eml"]]).pipe(
  $I.annoteSchema("EmailDecodeFormat", { description: "File formats the platform reads emails from." })
);

/**
 * Runtime type of {@link EmailDecodeFormat}.
 *
 * @category models
 * @since 0.0.0
 */
export type EmailDecodeFormat = typeof EmailDecodeFormat.Type;

/**
 * File formats the platform reads computer-aided design models from.
 *
 * **Example** (Decode a CAD format)
 *
 * ```ts import.meta.vitest name="Decode a CAD format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CadDecodeFormat } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(CadDecodeFormat)("STEP"))
 * decoded // => "step"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CadDecodeFormat = MappedLiteralKit([["STEP", "step"]]).pipe(
  $I.annoteSchema("CadDecodeFormat", {
    description: "File formats the platform reads computer-aided design models from.",
  })
);

/**
 * Runtime type of {@link CadDecodeFormat}.
 *
 * @category models
 * @since 0.0.0
 */
export type CadDecodeFormat = typeof CadDecodeFormat.Type;

/**
 * What a DICOM file holds: one image, a stack of frames, a video or a structured report.
 *
 * **Example** (Decode what a DICOM file holds)
 *
 * ```ts import.meta.vitest name="Decode what a DICOM file holds"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DicomMediaType } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(DicomMediaType)("MULTI_FRAME_IMAGE"))
 * decoded // => "multiFrameImage"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DicomMediaType = MappedLiteralKit([
  ["IMAGE", "image"],
  ["MULTI_FRAME_IMAGE", "multiFrameImage"],
  ["VIDEO", "video"],
  ["STRUCTURED_REPORT", "structuredReport"],
]).pipe(
  $I.annoteSchema("DicomMediaType", {
    description: "What a DICOM file holds: one image, a stack of frames, a video or a structured report.",
  })
);

/**
 * Runtime type of {@link DicomMediaType}.
 *
 * @category models
 * @since 0.0.0
 */
export type DicomMediaType = typeof DicomMediaType.Type;

/**
 * File formats the platform reads three-dimensional models from.
 *
 * **Example** (Decode a 3D model format)
 *
 * ```ts import.meta.vitest name="Decode a 3D model format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Model3dDecodeFormat } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(Model3dDecodeFormat)("PLY"))
 * decoded // => "ply"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Model3dDecodeFormat = MappedLiteralKit([
  ["LAS", "las"],
  ["PLY", "ply"],
  ["OBJ", "obj"],
]).pipe(
  $I.annoteSchema("Model3dDecodeFormat", {
    description: "File formats the platform reads three-dimensional models from.",
  })
);

/**
 * Runtime type of {@link Model3dDecodeFormat}.
 *
 * @category models
 * @since 0.0.0
 */
export type Model3dDecodeFormat = typeof Model3dDecodeFormat.Type;

/**
 * How a three-dimensional model represents its surface: loose points or connected faces.
 *
 * **Example** (Decode a 3D surface representation)
 *
 * ```ts import.meta.vitest name="Decode a 3D surface representation"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Model3dType } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(Model3dType)("POINT_CLOUD"))
 * decoded // => "pointCloud"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Model3dType = MappedLiteralKit([
  ["POINT_CLOUD", "pointCloud"],
  ["MESH", "mesh"],
]).pipe(
  $I.annoteSchema("Model3dType", {
    description: "How a three-dimensional model represents its surface: loose points or connected faces.",
  })
);

/**
 * Runtime type of {@link Model3dType}.
 *
 * @category models
 * @since 0.0.0
 */
export type Model3dType = typeof Model3dType.Type;

/**
 * Numeric type of the samples in one band of a raster image.
 *
 * **Example** (Decode a band sample type)
 *
 * ```ts import.meta.vitest name="Decode a band sample type"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { BandDataType } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(BandDataType)("COMPLEX_FLOAT32"))
 * decoded // => "complexFloat32"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BandDataType = MappedLiteralKit([
  ["UNDEFINED", "undefined"],
  ["BYTE", "byte"],
  ["UINT16", "uint16"],
  ["INT16", "int16"],
  ["UINT32", "uint32"],
  ["INT32", "int32"],
  ["FLOAT32", "float32"],
  ["FLOAT64", "float64"],
  ["COMPLEX_INT16", "complexInt16"],
  ["COMPLEX_INT32", "complexInt32"],
  ["COMPLEX_FLOAT32", "complexFloat32"],
  ["COMPLEX_FLOAT64", "complexFloat64"],
  ["UINT64", "uint64"],
  ["INT64", "int64"],
  ["INT8", "int8"],
]).pipe(
  $I.annoteSchema("BandDataType", { description: "Numeric type of the samples in one band of a raster image." })
);

/**
 * Runtime type of {@link BandDataType}.
 *
 * @category models
 * @since 0.0.0
 */
export type BandDataType = typeof BandDataType.Type;

/**
 * What the samples of an image band stand for: a colour channel, a palette index or a luminance component.
 *
 * **Example** (Decode a band colour interpretation)
 *
 * ```ts import.meta.vitest name="Decode a band colour interpretation"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ColorInterpretation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(ColorInterpretation)("Y_CB_CR_SPACE_CB"))
 * decoded // => "yCbCrSpaceCb"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ColorInterpretation = MappedLiteralKit([
  ["UNDEFINED", "undefined"],
  ["GRAY", "gray"],
  ["PALETTE_INDEX", "paletteIndex"],
  ["RED", "red"],
  ["GREEN", "green"],
  ["BLUE", "blue"],
  ["ALPHA", "alpha"],
  ["HUE", "hue"],
  ["SATURATION", "saturation"],
  ["LIGHTNESS", "lightness"],
  ["CYAN", "cyan"],
  ["MAGENTA", "magenta"],
  ["YELLOW", "yellow"],
  ["BLACK", "black"],
  ["Y_CB_CR_SPACE_Y", "yCbCrSpaceY"],
  ["Y_CB_CR_SPACE_CB", "yCbCrSpaceCb"],
  ["Y_CB_CR_SPACE_CR", "yCbCrSpaceCr"],
]).pipe(
  $I.annoteSchema("ColorInterpretation", {
    description: "What the samples of an image band stand for: a colour channel, a palette index or a luminance part.",
  })
);

/**
 * Runtime type of {@link ColorInterpretation}.
 *
 * @category models
 * @since 0.0.0
 */
export type ColorInterpretation = typeof ColorInterpretation.Type;

/**
 * Colour model the entries of an image band's palette are expressed in.
 *
 * **Example** (Decode a palette colour model)
 *
 * ```ts import.meta.vitest name="Decode a palette colour model"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { PaletteInterpretation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(PaletteInterpretation)("CMYK"))
 * decoded // => "cmyk"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PaletteInterpretation = MappedLiteralKit([
  ["GRAY", "gray"],
  ["RGB", "rgb"],
  ["RGBA", "rgba"],
  ["CMYK", "cmyk"],
  ["HLS", "hls"],
]).pipe(
  $I.annoteSchema("PaletteInterpretation", {
    description: "Colour model the entries of an image band's palette are expressed in.",
  })
);

/**
 * Runtime type of {@link PaletteInterpretation}.
 *
 * @category models
 * @since 0.0.0
 */
export type PaletteInterpretation = typeof PaletteInterpretation.Type;

/**
 * A clockwise quarter-turn rotation, or `unknown` when an image's orientation tag names no such rotation.
 *
 * **Example** (Decode a rotation angle)
 *
 * ```ts import.meta.vitest name="Decode a rotation angle"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { RotationAngle } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const angle = await Effect.runPromise(S.decodeUnknownEffect(RotationAngle)("DEGREE_270"))
 * angle // => "degree270"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RotationAngle = MappedLiteralKit([
  ["DEGREE_90", "degree90"],
  ["DEGREE_180", "degree180"],
  ["DEGREE_270", "degree270"],
  ["UNKNOWN", "unknown"],
]).pipe(
  $I.annoteSchema("RotationAngle", {
    description: "A clockwise quarter-turn rotation, or unknown when an orientation tag names no such rotation.",
  })
);

/**
 * Runtime type of {@link RotationAngle}.
 *
 * @category models
 * @since 0.0.0
 */
export type RotationAngle = typeof RotationAngle.Type;

/**
 * Axis an image is mirrored along, or `unknown` when its orientation tag names none.
 *
 * **Example** (Decode a flip axis)
 *
 * ```ts import.meta.vitest name="Decode a flip axis"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FlipAxis } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(FlipAxis)("HORIZONTAL"))
 * decoded // => "horizontal"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FlipAxis = MappedLiteralKit([
  ["HORIZONTAL", "horizontal"],
  ["VERTICAL", "vertical"],
  ["UNKNOWN", "unknown"],
]).pipe(
  $I.annoteSchema("FlipAxis", {
    description: "Axis an image is mirrored along, or unknown when its orientation tag names none.",
  })
);

/**
 * Runtime type of {@link FlipAxis}.
 *
 * @category models
 * @since 0.0.0
 */
export type FlipAxis = typeof FlipAxis.Type;

/**
 * DICOM modality codes: the kind of equipment or process that produced a study.
 *
 * **Details**
 *
 * The codes are the DICOM standard's own (`CT`, `MR`, `US`), so they stay as
 * they travel. The last 18, from `AS` on, are codes the standard has retired
 * and that old files still carry.
 *
 * **Example** (Count the DICOM modalities)
 *
 * ```ts import.meta.vitest name="Count the DICOM modalities"
 * import * as A from "effect/Array"
 * import { Modality } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const facts = [A.length(Modality.literals), Modality.is.CT("CT"), Modality.is.CT("ct")]
 * facts // => [88, true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Modality = LiteralKit([
  "AR",
  "ASMT",
  "AU",
  "BDUS",
  "BI",
  "BMD",
  "CR",
  "CT",
  "CTPROTOCOL",
  "DG",
  "DOC",
  "DX",
  "ECG",
  "EPS",
  "ES",
  "FID",
  "GM",
  "HC",
  "HD",
  "IO",
  "IOL",
  "IVOCT",
  "IVUS",
  "KER",
  "KO",
  "LEN",
  "LS",
  "MG",
  "MR",
  "M3D",
  "NM",
  "OAM",
  "OCT",
  "OP",
  "OPM",
  "OPT",
  "OPTBSV",
  "OPTENF",
  "OPV",
  "OSS",
  "OT",
  "PLAN",
  "PR",
  "PT",
  "PX",
  "REG",
  "RESP",
  "RF",
  "RG",
  "RTDOSE",
  "RTIMAGE",
  "RTINTENT",
  "RTPLAN",
  "RTRAD",
  "RTRECORD",
  "RTSEGANN",
  "RTSTRUCT",
  "RWV",
  "SEG",
  "SM",
  "SMR",
  "SR",
  "SRF",
  "STAIN",
  "TEXTUREMAP",
  "TG",
  "US",
  "VA",
  "XA",
  "XC",
  "AS",
  "CD",
  "CF",
  "CP",
  "CS",
  "DD",
  "DF",
  "DM",
  "DS",
  "EC",
  "FA",
  "FS",
  "LP",
  "MA",
  "MS",
  "OPR",
  "ST",
  "VF",
]).pipe(
  $I.annoteSchema("Modality", {
    description: "DICOM modality codes: the kind of equipment or process that produced a study.",
  })
);

/**
 * Runtime type of {@link Modality}.
 *
 * @category models
 * @since 0.0.0
 */
export type Modality = typeof Modality.Type;

// -----------------------------------------------------------------------------
// Size
// -----------------------------------------------------------------------------

// Every metadata record carries its size twice: the older JSON number and the exact decimal string.
const sizeFields = {
  sizeBytes: S.Finite.annotateKey({
    description: "Size of the item in bytes as a JSON number, which cannot hold every size exactly.",
  }),
  sizeBytesLong: SizeBytes.annotateKey({ description: "Size of the item in bytes, exact at any magnitude." }),
};

// -----------------------------------------------------------------------------
// Audio and video
// -----------------------------------------------------------------------------

/**
 * Technical facts about an audio stream.
 *
 * @category models
 * @since 0.0.0
 */
export class AudioSpecification extends S.Opaque<AudioSpecification, { readonly brand: unique symbol }>()(
  S.Struct({
    bitRate: S.Finite.annotateKey({ description: "Bit rate of the stream." }),
    durationSeconds: S.Finite.annotateKey({ description: "Length of the audio in seconds." }),
    numberOfChannels: absent(S.Finite, "Number of audio channels."),
  }).pipe($I.annoteSchema("AudioSpecification", { description: "Technical facts about an audio stream." }))
) {}

/**
 * Technical facts about a video stream.
 *
 * @category models
 * @since 0.0.0
 */
export class VideoSpecification extends S.Opaque<VideoSpecification, { readonly brand: unique symbol }>()(
  S.Struct({
    bitRate: S.Finite.annotateKey({ description: "Bit rate of the stream." }),
    durationSeconds: S.Finite.annotateKey({ description: "Length of the video in seconds." }),
  }).pipe($I.annoteSchema("VideoSpecification", { description: "Technical facts about a video stream." }))
) {}

// -----------------------------------------------------------------------------
// Imagery
// -----------------------------------------------------------------------------

/**
 * Width and height of an image in pixels.
 *
 * @category models
 * @since 0.0.0
 */
export class Dimensions extends S.Opaque<Dimensions, { readonly brand: unique symbol }>()(
  S.Struct({
    width: S.Finite.annotateKey({ description: "Width in pixels." }),
    height: S.Finite.annotateKey({ description: "Height in pixels." }),
  }).pipe($I.annoteSchema("Dimensions", { description: "Width and height of an image in pixels." }))
) {}

/**
 * The unit of an image band's values, with the scale and offset that relate raw samples to it.
 *
 * @category models
 * @since 0.0.0
 */
export class UnitInterpretation extends S.Opaque<UnitInterpretation, { readonly brand: unique symbol }>()(
  S.Struct({
    unit: absent(S.String, "Unit of the band's values."),
    scale: absent(S.Finite, "Scale applied to raw samples."),
    offset: absent(S.Finite, "Offset applied to raw samples."),
  }).pipe(
    $I.annoteSchema("UnitInterpretation", {
      description: "The unit of an image band's values, with the scale and offset that relate raw samples to it.",
    })
  )
) {}

/**
 * One band (channel) of a raster image and how to read its samples.
 *
 * @category models
 * @since 0.0.0
 */
export class BandInfo extends S.Opaque<BandInfo, { readonly brand: unique symbol }>()(
  S.Struct({
    dataType: absent(BandDataType, "Numeric type of the band's samples."),
    colorInterpretation: absent(ColorInterpretation, "What the band's samples stand for."),
    paletteInterpretation: absent(PaletteInterpretation, "Colour model of the band's palette, when it has one."),
    unitInterpretation: absent(UnitInterpretation, "Unit, scale and offset of the band's values."),
  }).pipe(
    $I.annoteSchema("BandInfo", { description: "One band (channel) of a raster image and how to read its samples." })
  )
) {}

/**
 * The coordinate system a geo-referenced image is expressed in.
 *
 * @category models
 * @since 0.0.0
 */
export class CoordinateReferenceSystem extends S.Opaque<
  CoordinateReferenceSystem,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    wkt: absent(S.String, "Definition of the coordinate system in well-known text."),
  }).pipe(
    $I.annoteSchema("CoordinateReferenceSystem", {
      description: "The coordinate system a geo-referenced image is expressed in.",
    })
  )
) {}

/**
 * The six coefficients that map a pixel position to a position in the image's coordinate system.
 *
 * @category models
 * @since 0.0.0
 */
export class AffineTransform extends S.Opaque<AffineTransform, { readonly brand: unique symbol }>()(
  S.Struct({
    xTranslate: absent(S.Finite, "Horizontal translation."),
    xScale: absent(S.Finite, "Horizontal scale."),
    xShear: absent(S.Finite, "Horizontal shear."),
    yTranslate: absent(S.Finite, "Vertical translation."),
    yShear: absent(S.Finite, "Vertical shear."),
    yScale: absent(S.Finite, "Vertical scale."),
  }).pipe(
    $I.annoteSchema("AffineTransform", {
      description: "The six coefficients that map a pixel position to a position in the image's coordinate system.",
    })
  )
) {}

/**
 * A pixel of an image paired with the projected position it shows.
 *
 * @category models
 * @since 0.0.0
 */
export class GroundControlPoint extends S.Opaque<GroundControlPoint, { readonly brand: unique symbol }>()(
  S.Struct({
    pixX: absent(S.Finite, "Pixel column of the point."),
    pixY: absent(S.Finite, "Pixel row of the point."),
    projX: absent(S.Finite, "Projected X coordinate of the point."),
    projY: absent(S.Finite, "Projected Y coordinate of the point."),
    projZ: absent(S.Finite, "Projected Z coordinate of the point."),
  }).pipe(
    $I.annoteSchema("GroundControlPoint", {
      description: "A pixel of an image paired with the projected position it shows.",
    })
  )
) {}

/**
 * The ground control points that tie an image to the ground.
 *
 * @category models
 * @since 0.0.0
 */
export class GroundControlPoints extends S.Opaque<GroundControlPoints, { readonly brand: unique symbol }>()(
  S.Struct({
    gcps: S.Array(GroundControlPoint).annotateKey({ description: "The control points, in file order." }),
  }).pipe(
    $I.annoteSchema("GroundControlPoints", {
      description: "The ground control points that tie an image to the ground.",
    })
  )
) {}

/**
 * Where a camera was when it took an image, as recorded in the image's embedded tags.
 *
 * @category models
 * @since 0.0.0
 */
export class GpsMetadata extends S.Opaque<GpsMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    latitude: absent(S.Finite, "Latitude of the position."),
    longitude: absent(S.Finite, "Longitude of the position."),
    altitude: absent(S.Finite, "Altitude of the position."),
  }).pipe(
    $I.annoteSchema("GpsMetadata", {
      description: "Where a camera was when it took an image, as recorded in the image's embedded tags.",
    })
  )
) {}

/**
 * Everything an image embeds about where on Earth it lies.
 *
 * @category models
 * @since 0.0.0
 */
export class GeoMetadata extends S.Opaque<GeoMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    crs: absent(CoordinateReferenceSystem, "Coordinate system the image is expressed in."),
    geotransform: absent(AffineTransform, "Mapping from pixel positions to coordinates."),
    gcpInfo: absent(GroundControlPoints, "Ground control points of the image."),
    gpsData: absent(GpsMetadata, "Position of the camera when the image was taken."),
  }).pipe(
    $I.annoteSchema("GeoMetadata", { description: "Everything an image embeds about where on Earth it lies." })
  )
) {}

/**
 * How an image must be turned and mirrored to be seen upright, as recorded in its embedded tags.
 *
 * @category models
 * @since 0.0.0
 */
export class Orientation extends S.Opaque<Orientation, { readonly brand: unique symbol }>()(
  S.Struct({
    rotationAngle: absent(RotationAngle, "Clockwise rotation to apply."),
    flipAxis: absent(FlipAxis, "Axis to mirror the image along."),
  }).pipe(
    $I.annoteSchema("Orientation", {
      description: "How an image must be turned and mirrored to be seen upright, as recorded in its embedded tags.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// DICOM
// -----------------------------------------------------------------------------

const DicomMetaInformationKind = LiteralKit(["v1"]);

/**
 * The file meta information every DICOM file opens with.
 *
 * @category models
 * @since 0.0.0
 */
export class DicomFileMetaInformation extends S.Opaque<DicomFileMetaInformation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("v1"),
    mediaStorageSop: S.String.annotateKey({ description: "Identifier of the kind of object the file stores." }),
    mediaStorageSopInstance: S.String.annotateKey({ description: "Identifier of the stored object itself." }),
    transferSyntax: S.String.annotateKey({ description: "Identifier of the encoding used for the rest of the file." }),
  }).pipe(
    $I.annoteSchema("DicomFileMetaInformation", {
      description: "The file meta information every DICOM file opens with.",
    })
  )
) {}

/**
 * The meta information of a DICOM file, tagged by the version of its layout.
 *
 * **Example** (Read the transfer syntax of a DICOM file)
 *
 * ```ts import.meta.vitest name="Read the transfer syntax of a DICOM file"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DicomMetaInformation } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const information = await Effect.runPromise(
 *   S.decodeUnknownEffect(DicomMetaInformation)({
 *     type: "v1",
 *     mediaStorageSop: "1.2.840.10008.5.1.4.1.1.2",
 *     mediaStorageSopInstance: "1.3.6.1.4.1.14519.5.2.1.99.1",
 *     transferSyntax: "1.2.840.10008.1.2.1",
 *   })
 * )
 * const syntax = DicomMetaInformation.match(information, { v1: ({ transferSyntax }) => transferSyntax })
 * syntax // => "1.2.840.10008.1.2.1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DicomMetaInformation = DicomMetaInformationKind.mapMembers(() =>
  Tuple.make(DicomFileMetaInformation)
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("DicomMetaInformation", {
    description: "The meta information of a DICOM file, tagged by the version of its layout.",
  })
);

/**
 * Runtime type of {@link DicomMetaInformation}.
 *
 * @category models
 * @since 0.0.0
 */
export type DicomMetaInformation = typeof DicomMetaInformation.Type;

/**
 * The DICOM data elements most studies carry, lifted out of the element table.
 *
 * @category models
 * @since 0.0.0
 */
export class CommonDicomDataElements extends S.Opaque<CommonDicomDataElements, { readonly brand: unique symbol }>()(
  S.Struct({
    numberFrames: absent(S.Finite, "Number of frames in a multi-frame image."),
    modality: absent(Modality, "Kind of equipment or process that produced the study."),
    patientId: absent(S.String, "Identifier of the patient."),
    studyId: absent(S.String, "Identifier of the study given by the institution."),
    studyUid: absent(S.String, "Unique identifier of the study."),
    seriesUid: absent(S.String, "Unique identifier of the series."),
    studyTime: absent(S.String, "When the study started, as the file writes it."),
    seriesTime: absent(S.String, "When the series started, as the file writes it."),
  }).pipe(
    $I.annoteSchema("CommonDicomDataElements", {
      description: "The DICOM data elements most studies carry, lifted out of the element table.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Email
// -----------------------------------------------------------------------------

const MailboxFields = S.Struct({
  displayName: absent(S.String, "Name shown for the mailbox."),
  emailAddress: S.String.annotateKey({ description: "Address of the mailbox." }),
});

/**
 * One email mailbox: an address and the name shown for it.
 *
 * @category models
 * @since 0.0.0
 */
export class Mailbox extends S.Opaque<Mailbox, { readonly brand: unique symbol }>()(
  MailboxFields.pipe($I.annoteSchema("Mailbox", { description: "One email mailbox: an address and its shown name." }))
) {}

const GroupFields = S.Struct({
  groupName: S.String.annotateKey({ description: "Name of the group." }),
  mailboxes: S.Array(Mailbox).annotateKey({ description: "Mailboxes the group stands for." }),
});

/**
 * A recipient that is a single mailbox.
 *
 * @category models
 * @since 0.0.0
 */
export class MailboxRecipient extends S.Opaque<MailboxRecipient, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("mailbox"), mailbox: S.toEncoded(MailboxFields) }).pipe(
    S.decodeTo(
      S.Struct({ type: S.tag("mailbox"), ...MailboxFields.fields }),
      SchemaTransformation.transform({
        decode: ({ type, mailbox }) => ({ type, ...mailbox }),
        encode: ({ type, ...mailbox }) => ({ type, mailbox }),
      })
    ),
    $I.annoteSchema("MailboxRecipient", { description: "A recipient that is a single mailbox." })
  )
) {}

/**
 * A recipient that is a named group of mailboxes.
 *
 * @category models
 * @since 0.0.0
 */
export class GroupRecipient extends S.Opaque<GroupRecipient, { readonly brand: unique symbol }>()(
  S.Struct({ type: S.tag("group"), group: S.toEncoded(GroupFields) }).pipe(
    S.decodeTo(
      S.Struct({ type: S.tag("group"), ...GroupFields.fields }),
      SchemaTransformation.transform({
        decode: ({ type, group }) => ({ type, ...group }),
        encode: ({ type, ...group }) => ({ type, group }),
      })
    ),
    $I.annoteSchema("GroupRecipient", { description: "A recipient that is a named group of mailboxes." })
  )
) {}

const EmailRecipientKind = LiteralKit(["mailbox", "group"]);

/**
 * Who an email is addressed to: one mailbox, or a named group of them.
 *
 * **Details**
 *
 * The wire nests each case under a key that repeats the tag
 * (`{ type: "mailbox", mailbox: {...} }`). Here the fields sit beside the tag,
 * and encoding restores the nesting.
 *
 * **Example** (Collect the addresses behind a recipient)
 *
 * ```ts import.meta.vitest name="Collect the addresses behind a recipient"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { EmailRecipient } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const recipient = await Effect.runPromise(
 *   S.decodeUnknownEffect(EmailRecipient)({
 *     type: "group",
 *     group: {
 *       groupName: "reviewers",
 *       mailboxes: [{ emailAddress: "a@example.com" }, { emailAddress: "b@example.com" }],
 *     },
 *   })
 * )
 * const addresses = EmailRecipient.match(recipient, {
 *   mailbox: ({ emailAddress }) => [emailAddress],
 *   group: ({ mailboxes }) => A.map(mailboxes, (mailbox) => mailbox.emailAddress),
 * })
 * addresses // => ["a@example.com", "b@example.com"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EmailRecipient = EmailRecipientKind.mapMembers(() => Tuple.make(MailboxRecipient, GroupRecipient)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("EmailRecipient", {
    description: "Who an email is addressed to: one mailbox, or a named group of them.",
  })
);

/**
 * Runtime type of {@link EmailRecipient}.
 *
 * @category models
 * @since 0.0.0
 */
export type EmailRecipient = typeof EmailRecipient.Type;

/**
 * One file attached to an email.
 *
 * @category models
 * @since 0.0.0
 */
export class EmailAttachment extends S.Opaque<EmailAttachment, { readonly brand: unique symbol }>()(
  S.Struct({
    attachmentIndex: S.Finite.annotateKey({
      description: "Position of the attachment in the email, used to fetch its bytes.",
    }),
    fileName: absent(S.String, "Name the attachment was sent under."),
    mimeType: MediaType.annotateKey({ description: "MIME type of the attachment's content." }),
  }).pipe($I.annoteSchema("EmailAttachment", { description: "One file attached to an email." }))
) {}

// -----------------------------------------------------------------------------
// CAD
// -----------------------------------------------------------------------------

/**
 * Units a computer-aided design file declares for its measurements.
 *
 * @category models
 * @since 0.0.0
 */
export class CadUnits extends S.Opaque<CadUnits, { readonly brand: unique symbol }>()(
  S.Struct({
    lengthUnit: absent(S.String, "Unit of length, as the file names it."),
  }).pipe(
    $I.annoteSchema("CadUnits", {
      description: "Units a computer-aided design file declares for its measurements.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Metadata records
// -----------------------------------------------------------------------------

/**
 * Metadata of a document: its format, page count and declared title and author.
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentMetadata extends S.Opaque<DocumentMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("document"),
    format: DocumentDecodeFormat.annotateKey({ description: "File format the document is stored in." }),
    pages: absent(S.Finite, "Number of pages."),
    ...sizeFields,
    title: absent(S.String, "Title the document declares."),
    author: absent(S.String, "Author the document declares."),
  }).pipe(
    $I.annoteSchema("DocumentMetadata", {
      description: "Metadata of a document: its format, page count and declared title and author.",
    })
  )
) {}

/**
 * Metadata of an image: its format, size in pixels, bands, embedded attributes and geo-referencing.
 *
 * @category models
 * @since 0.0.0
 */
export class ImageryMetadata extends S.Opaque<ImageryMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("imagery"),
    format: ImageryDecodeFormat.annotateKey({ description: "File format the image is stored in." }),
    dimensions: absent(Dimensions, "Width and height of the image in pixels."),
    bands: S.Array(BandInfo).annotateKey({ description: "Bands of the image, in file order." }),
    attributes: S.Record(S.String, S.Record(S.String, S.String)).annotateKey({
      description: "Free-form attributes embedded in the image, grouped by attribute domain.",
    }),
    iccProfile: absent(S.String, "Colour profile embedded in the image."),
    geo: absent(GeoMetadata, "Geo-referencing embedded in the image."),
    pages: absent(S.Finite, "Number of pages."),
    orientation: absent(Orientation, "How the image must be turned and mirrored to be seen upright."),
    ...sizeFields,
  }).pipe(
    $I.annoteSchema("ImageryMetadata", {
      description: "Metadata of an image: its format, pixel size, bands, embedded attributes and geo-referencing.",
    })
  )
) {}

/**
 * Metadata of an audio file: its format and stream facts.
 *
 * @category models
 * @since 0.0.0
 */
export class AudioMetadata extends S.Opaque<AudioMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("audio"),
    format: AudioDecodeFormat.annotateKey({ description: "File format the audio is stored in." }),
    specification: AudioSpecification,
    ...sizeFields,
  }).pipe($I.annoteSchema("AudioMetadata", { description: "Metadata of an audio file: its format and stream facts." }))
) {}

/**
 * Metadata of a video file: its container format and stream facts.
 *
 * @category models
 * @since 0.0.0
 */
export class VideoMetadata extends S.Opaque<VideoMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("video"),
    format: VideoDecodeFormat.annotateKey({ description: "Container format the video is stored in." }),
    specification: VideoSpecification,
    ...sizeFields,
  }).pipe(
    $I.annoteSchema("VideoMetadata", {
      description: "Metadata of a video file: its container format and stream facts.",
    })
  )
) {}

/**
 * Metadata of a DICOM file: its meta information, what it holds and its data elements.
 *
 * @category models
 * @since 0.0.0
 */
export class DicomMetadata extends S.Opaque<DicomMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("dicom"),
    metaInformation: DicomMetaInformation.annotateKey({ description: "The file meta information." }),
    mediaType: DicomMediaType.annotateKey({ description: "What the file holds." }),
    commonDataElements: CommonDicomDataElements,
    otherDataElements: S.Record(S.String, S.Json).annotateKey({
      description: "Every other data element of the file, keyed by element tag, as JSON.",
    }),
    ...sizeFields,
  }).pipe(
    $I.annoteSchema("DicomMetadata", {
      description: "Metadata of a DICOM file: its meta information, what it holds and its data elements.",
    })
  )
) {}

/**
 * Metadata of an email: its correspondents, subject and attachments.
 *
 * @category models
 * @since 0.0.0
 */
export class EmailMetadata extends S.Opaque<EmailMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("email"),
    format: EmailDecodeFormat.annotateKey({ description: "File format the email is stored in." }),
    ...sizeFields,
    sender: S.Array(Mailbox).annotateKey({ description: "Mailboxes the email was sent from." }),
    date: S.String.annotateKey({ description: "When the email was sent, as the platform writes it." }),
    attachmentCount: S.Finite.annotateKey({ description: "Number of files attached to the email." }),
    to: S.Array(EmailRecipient).annotateKey({ description: "Primary recipients." }),
    cc: S.Array(EmailRecipient).annotateKey({ description: "Recipients in copy." }),
    subject: absent(S.String, "Subject line of the email."),
    attachments: S.Array(EmailAttachment).annotateKey({ description: "Files attached to the email." }),
  }).pipe(
    $I.annoteSchema("EmailMetadata", {
      description: "Metadata of an email: its correspondents, subject and attachments.",
    })
  )
) {}

/**
 * Metadata of a three-dimensional model: its format and surface representation.
 *
 * @category models
 * @since 0.0.0
 */
export class Model3dMetadata extends S.Opaque<Model3dMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("model3d"),
    format: Model3dDecodeFormat.annotateKey({ description: "File format the model is stored in." }),
    modelType: Model3dType.annotateKey({ description: "How the model represents its surface." }),
    ...sizeFields,
  }).pipe(
    $I.annoteSchema("Model3dMetadata", {
      description: "Metadata of a three-dimensional model: its format and surface representation.",
    })
  )
) {}

/**
 * Metadata of a spreadsheet: its format, sheet names and declared title and author.
 *
 * @category models
 * @since 0.0.0
 */
export class SpreadsheetMetadata extends S.Opaque<SpreadsheetMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("spreadsheet"),
    format: SpreadsheetDecodeFormat.annotateKey({ description: "File format the spreadsheet is stored in." }),
    sheetNames: S.Array(S.String).annotateKey({ description: "Names of the sheets, in workbook order." }),
    ...sizeFields,
    title: absent(S.String, "Title the spreadsheet declares."),
    author: absent(S.String, "Author the spreadsheet declares."),
  }).pipe(
    $I.annoteSchema("SpreadsheetMetadata", {
      description: "Metadata of a spreadsheet: its format, sheet names and declared title and author.",
    })
  )
) {}

/**
 * Metadata of an item the platform stores without recognising its type: only its size is known.
 *
 * @category models
 * @since 0.0.0
 */
export class UntypedMetadata extends S.Opaque<UntypedMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("untyped"),
    ...sizeFields,
  }).pipe(
    $I.annoteSchema("UntypedMetadata", {
      description: "Metadata of an item the platform stores without recognising its type: only its size is known.",
    })
  )
) {}

/**
 * Metadata of a computer-aided design model: its format and declared units.
 *
 * @category models
 * @since 0.0.0
 */
export class CadMetadata extends S.Opaque<CadMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("cad"),
    format: CadDecodeFormat.annotateKey({ description: "File format the model is stored in." }),
    ...sizeFields,
    units: absent(CadUnits, "Units the file declares for its measurements."),
  }).pipe(
    $I.annoteSchema("CadMetadata", {
      description: "Metadata of a computer-aided design model: its format and declared units.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// The metadata union
// -----------------------------------------------------------------------------

/**
 * What the platform knows about a media item, by kind of item.
 *
 * **Details**
 *
 * The size travels twice on every case: `sizeBytes` is the older JSON number,
 * `sizeBytesLong` the exact decimal string, decoded here to a `bigint`. Prefer
 * `sizeBytesLong`; the number is kept because the wire still sends it.
 *
 * **Example** (Summarise a media item by its kind)
 *
 * ```ts import.meta.vitest name="Summarise a media item by its kind"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { MediaItemMetadata } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const metadata = await Effect.runPromise(
 *   S.decodeUnknownEffect(MediaItemMetadata)({
 *     type: "document",
 *     format: "PDF",
 *     pages: 12,
 *     sizeBytes: 393469,
 *     sizeBytesLong: "393469",
 *   })
 * )
 * const summary = MediaItemMetadata.matchOrElse(
 *   metadata,
 *   { document: ({ format, pages }) => `${format} with ${O.getOrElse(pages, () => 0)} pages` },
 *   (other) => other.type
 * )
 * const facts = [summary, metadata.sizeBytesLong === BigInt(393469), MediaItemMetadata.guards.cad(metadata)]
 * facts // => ["pdf with 12 pages", true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MediaItemMetadata = MediaItemMetadataKind.mapMembers(() =>
  Tuple.make(
    DocumentMetadata,
    ImageryMetadata,
    AudioMetadata,
    VideoMetadata,
    DicomMetadata,
    EmailMetadata,
    Model3dMetadata,
    SpreadsheetMetadata,
    UntypedMetadata,
    CadMetadata
  )
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("MediaItemMetadata", {
    description: "What the platform knows about a media item, by kind of item.",
  })
);

/**
 * Runtime type of {@link MediaItemMetadata}.
 *
 * @category models
 * @since 0.0.0
 */
export type MediaItemMetadata = typeof MediaItemMetadata.Type;
