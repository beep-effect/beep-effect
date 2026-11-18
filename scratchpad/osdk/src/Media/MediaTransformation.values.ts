/**
 * Literal domains of media transformations: what can be done to a media item, in which language, into which format.
 *
 * **Details**
 *
 * A transformation request is mostly vocabulary: the kind of conversion, the
 * output encoding, a sensitivity or performance setting, the languages an OCR
 * or transcription engine should expect. Each closed vocabulary is declared
 * once here. Upper-case wire enums are mapped kits that decode to lower-camel
 * literals. Tags, encodings and language codes already travel in their natural
 * spelling, so they are plain kits and the wire literal is the domain literal.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, MappedLiteralKit } from "@beep/schema";

const $I = $ScratchpadId.create("osdk/Media/MediaTransformation.values");

// -----------------------------------------------------------------------------
// Tag vocabularies
// -----------------------------------------------------------------------------

/**
 * The kinds of media transformation: a bare source kind stays within that kind, `<source>To<target>` crosses kinds.
 *
 * **Example** (Count the kinds of transformation)
 *
 * ```ts import.meta.vitest name="Count the kinds of transformation"
 * import * as A from "effect/Array"
 * import { MediaTransformationKind } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const facts = [A.length(MediaTransformationKind.literals), MediaTransformationKind.is.videoToAudio("videoToAudio")]
 * facts // => [18, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MediaTransformationKind = LiteralKit([
  "image",
  "video",
  "audio",
  "emailToText",
  "spreadsheetToText",
  "videoToAudio",
  "audioToText",
  "emailToAttachment",
  "videoToArchive",
  "videoToText",
  "imageToText",
  "videoToImage",
  "imageToDocument",
  "dicomToImage",
  "documentToDocument",
  "documentToImage",
  "imageToEmbedding",
  "documentToText",
]).pipe(
  $I.annoteSchema("MediaTransformationKind", {
    description: "The kinds of media transformation, named by source kind and, when it differs, target kind.",
  })
);

/**
 * Runtime type of {@link MediaTransformationKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type MediaTransformationKind = typeof MediaTransformationKind.Type;

// -----------------------------------------------------------------------------
// Output encodings
// -----------------------------------------------------------------------------

/**
 * Image formats a transformation can write.
 *
 * **Example** (List the image output formats)
 *
 * ```ts import.meta.vitest name="List the image output formats"
 * import { ImageryEncodingKind } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const formats = ImageryEncodingKind.literals
 * formats // => ["jpg", "png", "tiff", "webp"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ImageryEncodingKind = LiteralKit(["jpg", "png", "tiff", "webp"]).pipe(
  $I.annoteSchema("ImageryEncodingKind", { description: "Image formats a transformation can write." })
);

/**
 * Runtime type of {@link ImageryEncodingKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type ImageryEncodingKind = typeof ImageryEncodingKind.Type;

/**
 * Video container formats a transformation can write.
 *
 * **Example** (List the video output containers)
 *
 * ```ts import.meta.vitest name="List the video output containers"
 * import { VideoEncodingKind } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const containers = VideoEncodingKind.literals
 * containers // => ["mp4", "mov", "mkv", "ts"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VideoEncodingKind = LiteralKit(["mp4", "mov", "mkv", "ts"]).pipe(
  $I.annoteSchema("VideoEncodingKind", { description: "Video container formats a transformation can write." })
);

/**
 * Runtime type of {@link VideoEncodingKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type VideoEncodingKind = typeof VideoEncodingKind.Type;

/**
 * Audio formats a transformation can write; only `wav` takes further settings.
 *
 * **Example** (List the audio output formats)
 *
 * ```ts import.meta.vitest name="List the audio output formats"
 * import { AudioEncodingKind } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const formats = AudioEncodingKind.literals
 * formats // => ["mp3", "wav", "ts"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AudioEncodingKind = LiteralKit(["mp3", "wav", "ts"]).pipe(
  $I.annoteSchema("AudioEncodingKind", {
    description: "Audio formats a transformation can write; only wav takes further settings.",
  })
);

/**
 * Runtime type of {@link AudioEncodingKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type AudioEncodingKind = typeof AudioEncodingKind.Type;

/**
 * Archive formats a transformation can bundle many outputs into.
 *
 * **Example** (List the archive output formats)
 *
 * ```ts import.meta.vitest name="List the archive output formats"
 * import { ArchiveEncodingKind } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const formats = ArchiveEncodingKind.literals
 * formats // => ["tar"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ArchiveEncodingKind = LiteralKit(["tar"]).pipe(
  $I.annoteSchema("ArchiveEncodingKind", {
    description: "Archive formats a transformation can bundle many outputs into.",
  })
);

/**
 * Runtime type of {@link ArchiveEncodingKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type ArchiveEncodingKind = typeof ArchiveEncodingKind.Type;

/**
 * Document formats a transformation can write.
 *
 * **Example** (List the document output formats)
 *
 * ```ts import.meta.vitest name="List the document output formats"
 * import { DocumentEncodingKind } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const formats = DocumentEncodingKind.literals
 * formats // => ["pdf"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocumentEncodingKind = LiteralKit(["pdf"]).pipe(
  $I.annoteSchema("DocumentEncodingKind", { description: "Document formats a transformation can write." })
);

/**
 * Runtime type of {@link DocumentEncodingKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentEncodingKind = typeof DocumentEncodingKind.Type;

/**
 * What optical character recognition returns: `hocr` keeps layout and positions, `text` is the words alone.
 *
 * **Example** (List the OCR output formats)
 *
 * ```ts import.meta.vitest name="List the OCR output formats"
 * import { OcrOutputFormatKind } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const formats = OcrOutputFormatKind.literals
 * formats // => ["hocr", "text"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OcrOutputFormatKind = LiteralKit(["hocr", "text"]).pipe(
  $I.annoteSchema("OcrOutputFormatKind", {
    description: "What optical character recognition returns: hOCR markup with positions, or the words alone.",
  })
);

/**
 * Runtime type of {@link OcrOutputFormatKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type OcrOutputFormatKind = typeof OcrOutputFormatKind.Type;

// -----------------------------------------------------------------------------
// Operation settings
// -----------------------------------------------------------------------------

/**
 * Trade-off a transcription makes between cost and speed.
 *
 * **Example** (Decode a transcription performance mode)
 *
 * ```ts import.meta.vitest name="Decode a transcription performance mode"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { PerformanceMode } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const mode = await Effect.runPromise(S.decodeUnknownEffect(PerformanceMode)("MORE_ECONOMICAL"))
 * mode // => "moreEconomical"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PerformanceMode = MappedLiteralKit([
  ["MORE_ECONOMICAL", "moreEconomical"],
  ["MORE_PERFORMANT", "morePerformant"],
]).pipe(
  $I.annoteSchema("PerformanceMode", { description: "Trade-off a transcription makes between cost and speed." })
);

/**
 * Runtime type of {@link PerformanceMode}.
 *
 * @category models
 * @since 0.0.0
 */
export type PerformanceMode = typeof PerformanceMode.Type;

/**
 * How readily scene detection declares a new scene in a video.
 *
 * **Example** (Decode a scene detection sensitivity)
 *
 * ```ts import.meta.vitest name="Decode a scene detection sensitivity"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SceneScore } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(SceneScore)("LESS_SENSITIVE"))
 * decoded // => "lessSensitive"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SceneScore = MappedLiteralKit([
  ["MORE_SENSITIVE", "moreSensitive"],
  ["STANDARD", "standard"],
  ["LESS_SENSITIVE", "lessSensitive"],
]).pipe(
  $I.annoteSchema("SceneScore", { description: "How readily scene detection declares a new scene in a video." })
);

/**
 * Runtime type of {@link SceneScore}.
 *
 * @category models
 * @since 0.0.0
 */
export type SceneScore = typeof SceneScore.Type;

/**
 * Which rendering of an email body to extract.
 *
 * **Example** (Decode an email body format)
 *
 * ```ts import.meta.vitest name="Decode an email body format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { EmailBodyFormat } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(EmailBodyFormat)("HTML"))
 * decoded // => "html"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EmailBodyFormat = MappedLiteralKit([
  ["TEXT", "text"],
  ["HTML", "html"],
]).pipe($I.annoteSchema("EmailBodyFormat", { description: "Which rendering of an email body to extract." }));

/**
 * Runtime type of {@link EmailBodyFormat}.
 *
 * @category models
 * @since 0.0.0
 */
export type EmailBodyFormat = typeof EmailBodyFormat.Type;

/**
 * Markup in which extracted text is returned.
 *
 * **Example** (Decode a text output format)
 *
 * ```ts import.meta.vitest name="Decode a text output format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TextOutputFormat } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(TextOutputFormat)("MARKDOWN"))
 * decoded // => "markdown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TextOutputFormat = MappedLiteralKit([
  ["TEXT", "text"],
  ["MARKDOWN", "markdown"],
  ["HTML", "html"],
]).pipe($I.annoteSchema("TextOutputFormat", { description: "Markup in which extracted text is returned." }));

/**
 * Runtime type of {@link TextOutputFormat}.
 *
 * @category models
 * @since 0.0.0
 */
export type TextOutputFormat = typeof TextOutputFormat.Type;

/**
 * How text extraction treats a page: read its embedded text, recognise it as a scan, or decide automatically.
 *
 * **Example** (Decode a text extraction mode)
 *
 * ```ts import.meta.vitest name="Decode a text extraction mode"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { OcrMode } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(OcrMode)("ELECTRONIC"))
 * decoded // => "electronic"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OcrMode = MappedLiteralKit([
  ["AUTO", "auto"],
  ["ELECTRONIC", "electronic"],
  ["SCAN", "scan"],
]).pipe(
  $I.annoteSchema("OcrMode", {
    description: "How text extraction treats a page: read embedded text, recognise a scan, or decide automatically.",
  })
);

/**
 * Runtime type of {@link OcrMode}.
 *
 * @category models
 * @since 0.0.0
 */
export type OcrMode = typeof OcrMode.Type;

/**
 * How a page image is sized before a vision model sees it: scaled freely, or fitted inside a box.
 *
 * **Example** (Decode a page resizing mode)
 *
 * ```ts import.meta.vitest name="Decode a page resizing mode"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ResizingMode } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(ResizingMode)("FIT_INTO_BOUNDING_BOX"))
 * decoded // => "fitIntoBoundingBox"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResizingMode = MappedLiteralKit([
  ["RESIZING", "resizing"],
  ["FIT_INTO_BOUNDING_BOX", "fitIntoBoundingBox"],
]).pipe(
  $I.annoteSchema("ResizingMode", {
    description: "How a page image is sized before a vision model sees it: scaled freely, or fitted inside a box.",
  })
);

/**
 * Runtime type of {@link ResizingMode}.
 *
 * @category models
 * @since 0.0.0
 */
export type ResizingMode = typeof ResizingMode.Type;

/**
 * Markup a vision language model returns extracted text in.
 *
 * **Details**
 *
 * The platform accepts a single value today. It is still a closed vocabulary
 * on the wire, so it is one here: a second format becomes a new literal.
 *
 * **Example** (Decode a vision model output format)
 *
 * ```ts import.meta.vitest name="Decode a vision model output format"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { VlmOutputFormat } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(VlmOutputFormat)("MARKDOWN"))
 * decoded // => "markdown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VlmOutputFormat = MappedLiteralKit([["MARKDOWN", "markdown"]]).pipe(
  $I.annoteSchema("VlmOutputFormat", {
    description: "Markup a vision language model returns extracted text in.",
  })
);

/**
 * Runtime type of {@link VlmOutputFormat}.
 *
 * @category models
 * @since 0.0.0
 */
export type VlmOutputFormat = typeof VlmOutputFormat.Type;

/**
 * Models that can turn an image into an embedding vector.
 *
 * **Example** (Decode an embedding model identifier)
 *
 * ```ts import.meta.vitest name="Decode an embedding model identifier"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { EmbeddingModelId } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(EmbeddingModelId)("GOOGLE_SIGLIP_2"))
 * decoded // => "googleSiglip2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EmbeddingModelId = MappedLiteralKit([["GOOGLE_SIGLIP_2", "googleSiglip2"]]).pipe(
  $I.annoteSchema("EmbeddingModelId", { description: "Models that can turn an image into an embedding vector." })
);

/**
 * Runtime type of {@link EmbeddingModelId}.
 *
 * @category models
 * @since 0.0.0
 */
export type EmbeddingModelId = typeof EmbeddingModelId.Type;

/**
 * Where a transformation job stands: still running, ended in failure, or ended with a result to fetch.
 *
 * **Example** (Tell a finished job from a running one)
 *
 * ```ts import.meta.vitest name="Tell a finished job from a running one"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TransformationJobStatus } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const status = await Effect.runPromise(S.decodeUnknownEffect(TransformationJobStatus)("SUCCESSFUL"))
 * const isOver = TransformationJobStatus.To.match(status, {
 *   pending: () => false,
 *   failed: () => true,
 *   successful: () => true,
 * })
 * isOver // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TransformationJobStatus = MappedLiteralKit([
  ["PENDING", "pending"],
  ["FAILED", "failed"],
  ["SUCCESSFUL", "successful"],
]).pipe(
  $I.annoteSchema("TransformationJobStatus", {
    description: "Where a transformation job stands: still running, ended in failure, or ended with a result.",
  })
);

/**
 * Runtime type of {@link TransformationJobStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type TransformationJobStatus = typeof TransformationJobStatus.Type;

// -----------------------------------------------------------------------------
// Languages and scripts
// -----------------------------------------------------------------------------

/**
 * Languages optical character recognition can be told to expect.
 *
 * **Details**
 *
 * The codes are the recognition engine's own: mostly ISO 639-2 letter codes,
 * with suffixes for vertical text (`_VERT`), historical orthography (`_OLD`)
 * and a script variant (`_CYRL`, `_LATN`). `OSD` is not a language: it asks
 * for orientation and script detection.
 *
 * **Example** (Count the OCR languages)
 *
 * ```ts import.meta.vitest name="Count the OCR languages"
 * import * as A from "effect/Array"
 * import { OcrLanguage } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const facts = [
 *   A.length(OcrLanguage.literals),
 *   OcrLanguage.is.CHI_SIM_VERT("CHI_SIM_VERT"),
 *   OcrLanguage.is.ENG("eng"),
 * ]
 * facts // => [123, true, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OcrLanguage = LiteralKit([
  "AFR",
  "AMH",
  "ARA",
  "ASM",
  "AZE",
  "AZE_CYRL",
  "BEL",
  "BEN",
  "BOD",
  "BOS",
  "BRE",
  "BUL",
  "CAT",
  "CEB",
  "CES",
  "CHI_SIM",
  "CHI_SIM_VERT",
  "CHI_TRA",
  "CHI_TRA_VERT",
  "CHR",
  "COS",
  "CYM",
  "DAN",
  "DEU",
  "DIV",
  "DZO",
  "ELL",
  "ENG",
  "ENM",
  "EPO",
  "EST",
  "EUS",
  "FAO",
  "FAS",
  "FIL",
  "FIN",
  "FRA",
  "FRM",
  "FRY",
  "GLA",
  "GLE",
  "GLG",
  "GRC",
  "GUJ",
  "HAT",
  "HEB",
  "HIN",
  "HRV",
  "HUN",
  "HYE",
  "IKU",
  "IND",
  "ISL",
  "ITA",
  "ITA_OLD",
  "JAV",
  "JPN",
  "JPN_VERT",
  "KAN",
  "KAT",
  "KAT_OLD",
  "KAZ",
  "KHM",
  "KIR",
  "KMR",
  "KOR",
  "KOR_VERT",
  "LAO",
  "LAT",
  "LAV",
  "LIT",
  "LTZ",
  "MAL",
  "MAR",
  "MKD",
  "MLT",
  "MON",
  "MRI",
  "MSA",
  "MYA",
  "NEP",
  "NLD",
  "NOR",
  "OCI",
  "ORI",
  "OSD",
  "PAN",
  "POL",
  "POR",
  "PUS",
  "QUE",
  "RON",
  "RUS",
  "SAN",
  "SIN",
  "SLK",
  "SLV",
  "SND",
  "SPA",
  "SPA_OLD",
  "SQI",
  "SRP",
  "SRP_LATN",
  "SUN",
  "SWA",
  "SWE",
  "SYR",
  "TAM",
  "TAT",
  "TEL",
  "TGK",
  "THA",
  "TIR",
  "TON",
  "TUR",
  "UIG",
  "UKR",
  "URD",
  "UZB",
  "UZB_CYRL",
  "VIE",
  "YID",
  "YOR",
]).pipe(
  $I.annoteSchema("OcrLanguage", {
    description: "Languages optical character recognition can be told to expect, as recognition engine codes.",
  })
);

/**
 * Runtime type of {@link OcrLanguage}.
 *
 * @category models
 * @since 0.0.0
 */
export type OcrLanguage = typeof OcrLanguage.Type;

/**
 * Writing systems optical character recognition can be told to expect when the language is not known.
 *
 * **Example** (Count the OCR scripts)
 *
 * ```ts import.meta.vitest name="Count the OCR scripts"
 * import * as A from "effect/Array"
 * import { OcrScript } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const facts = [A.length(OcrScript.literals), OcrScript.is.HANGUL_VERT("HANGUL_VERT")]
 * facts // => [37, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OcrScript = LiteralKit([
  "ARABIC",
  "ARMENIAN",
  "BENGALI",
  "CANADIAN_ABORIGINAL",
  "CHEROKEE",
  "CYRILLIC",
  "DEVANAGARI",
  "ETHIOPIC",
  "FRAKTUR",
  "GEORGIAN",
  "GREEK",
  "GUJARATI",
  "GURMUKHI",
  "HAN_SIMPLIFIED",
  "HAN_SIMPLIFIED_VERT",
  "HAN_TRADITIONAL",
  "HAN_TRADITIONAL_VERT",
  "HANGUL",
  "HANGUL_VERT",
  "HEBREW",
  "JAPANESE",
  "JAPANESE_VERT",
  "KANNADA",
  "KHMER",
  "LAO",
  "LATIN",
  "MALAYALAM",
  "MYANMAR",
  "ORIYA",
  "SINHALA",
  "SYRIAC",
  "TAMIL",
  "TELUGU",
  "THAANA",
  "THAI",
  "TIBETAN",
  "VIETNAMESE",
]).pipe(
  $I.annoteSchema("OcrScript", {
    description: "Writing systems optical character recognition can be told to expect when the language is not known.",
  })
);

/**
 * Runtime type of {@link OcrScript}.
 *
 * @category models
 * @since 0.0.0
 */
export type OcrScript = typeof OcrScript.Type;

/**
 * Languages a transcription can be told the audio is spoken in.
 *
 * **Details**
 *
 * The domain holds every language twice: 100 short codes followed by 112
 * English names, several of which are synonyms of one another (`BURMESE` and
 * `MYANMAR`, `CASTILIAN` and `SPANISH`). A few names also appear in
 * {@link OcrScript} (`ARABIC`, `LAO`) where they mean a writing system, not a
 * spoken language. When no language is given the platform detects it from the
 * first 30 seconds of audio.
 *
 * **Example** (Count the transcription languages)
 *
 * ```ts import.meta.vitest name="Count the transcription languages"
 * import * as A from "effect/Array"
 * import { TranscriptionLanguage } from "@beep/scratchpad/osdk/src/Media/index"
 *
 * const facts = [
 *   A.length(TranscriptionLanguage.literals),
 *   TranscriptionLanguage.is.YUE("YUE"),
 *   TranscriptionLanguage.is.CANTONESE("CANTONESE"),
 * ]
 * facts // => [212, true, true]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TranscriptionLanguage = LiteralKit([
  "AF",
  "AM",
  "AR",
  "AS",
  "AZ",
  "BA",
  "BE",
  "BG",
  "BN",
  "BO",
  "BR",
  "BS",
  "CA",
  "CS",
  "CY",
  "DA",
  "DE",
  "EL",
  "EN",
  "ES",
  "ET",
  "EU",
  "FA",
  "FI",
  "FO",
  "FR",
  "GL",
  "GU",
  "HA",
  "HAW",
  "HE",
  "HI",
  "HR",
  "HT",
  "HU",
  "HY",
  "ID",
  "IS",
  "IT",
  "JA",
  "JW",
  "KA",
  "KK",
  "KM",
  "KN",
  "KO",
  "LA",
  "LB",
  "LN",
  "LO",
  "LT",
  "LV",
  "MG",
  "MI",
  "MK",
  "ML",
  "MN",
  "MR",
  "MS",
  "MT",
  "MY",
  "NE",
  "NL",
  "NN",
  "NO",
  "OC",
  "PA",
  "PL",
  "PS",
  "PT",
  "RO",
  "RU",
  "SA",
  "SD",
  "SI",
  "SK",
  "SL",
  "SN",
  "SO",
  "SQ",
  "SR",
  "SU",
  "SV",
  "SW",
  "TA",
  "TE",
  "TG",
  "TH",
  "TK",
  "TL",
  "TR",
  "TT",
  "UK",
  "UR",
  "UZ",
  "VI",
  "YI",
  "YO",
  "YUE",
  "ZH",
  "AFRIKAANS",
  "ALBANIAN",
  "AMHARIC",
  "ARABIC",
  "ARMENIAN",
  "ASSAMESE",
  "AZERBAIJANI",
  "BASHKIR",
  "BASQUE",
  "BELARUSIAN",
  "BENGALI",
  "BOSNIAN",
  "BRETON",
  "BULGARIAN",
  "BURMESE",
  "CANTONESE",
  "CASTILIAN",
  "CATALAN",
  "CHINESE",
  "CROATIAN",
  "CZECH",
  "DANISH",
  "DUTCH",
  "ENGLISH",
  "ESTONIAN",
  "FAROESE",
  "FINNISH",
  "FLEMISH",
  "FRENCH",
  "GALICIAN",
  "GEORGIAN",
  "GERMAN",
  "GREEK",
  "GUJARATI",
  "HAITIAN",
  "HAITIAN_CREOLE",
  "HAUSA",
  "HAWAIIAN",
  "HEBREW",
  "HINDI",
  "HUNGARIAN",
  "ICELANDIC",
  "INDONESIAN",
  "ITALIAN",
  "JAPANESE",
  "JAVANESE",
  "KANNADA",
  "KAZAKH",
  "KHMER",
  "KOREAN",
  "LAO",
  "LATIN",
  "LATVIAN",
  "LETZEBURGESCH",
  "LINGALA",
  "LITHUANIAN",
  "LUXEMBOURGISH",
  "MACEDONIAN",
  "MALAGASY",
  "MALAY",
  "MALAYALAM",
  "MALTESE",
  "MANDARIN",
  "MAORI",
  "MARATHI",
  "MOLDAVIAN",
  "MOLDOVAN",
  "MONGOLIAN",
  "MYANMAR",
  "NEPALI",
  "NORWEGIAN",
  "NYNORSK",
  "OCCITAN",
  "PANJABI",
  "PASHTO",
  "PERSIAN",
  "POLISH",
  "PORTUGUESE",
  "PUNJABI",
  "PUSHTO",
  "ROMANIAN",
  "RUSSIAN",
  "SANSKRIT",
  "SERBIAN",
  "SHONA",
  "SINDHI",
  "SINHALA",
  "SINHALESE",
  "SLOVAK",
  "SLOVENIAN",
  "SOMALI",
  "SPANISH",
  "SUNDANESE",
  "SWAHILI",
  "SWEDISH",
  "TAGALOG",
  "TAJIK",
  "TAMIL",
  "TATAR",
  "TELUGU",
  "THAI",
  "TIBETAN",
  "TURKISH",
  "TURKMEN",
  "UKRAINIAN",
  "URDU",
  "UZBEK",
  "VALENCIAN",
  "VIETNAMESE",
  "WELSH",
  "YIDDISH",
  "YORUBA",
]).pipe(
  $I.annoteSchema("TranscriptionLanguage", {
    description: "Languages a transcription can be told the audio is spoken in, as short codes and English names.",
  })
);

/**
 * Runtime type of {@link TranscriptionLanguage}.
 *
 * @category models
 * @since 0.0.0
 */
export type TranscriptionLanguage = typeof TranscriptionLanguage.Type;
