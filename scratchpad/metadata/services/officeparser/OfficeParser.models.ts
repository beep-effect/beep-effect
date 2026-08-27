/**
 * OfficeParser parse and generate AST, diagnostics, chunking, and destination
 * configuration types.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("metadata/services/officeparser/OfficeParser.models");

const runtimeFunction = <A extends Function>() =>
  S.declare<A>((input: unknown): input is A => P.isFunction(input));

const AbortSignalSchema = S.declare<AbortSignal>(
  (input: unknown): input is AbortSignal =>
    P.isObject(input) &&
    P.hasProperty(input, "aborted") &&
    P.isBoolean(input.aborted) &&
    P.hasProperty(input, "addEventListener") &&
    P.isFunction(input.addEventListener)
).pipe(
  $I.annoteSchema("AbortSignalSchema", {
    description: "Identity-preserving runtime contract for a platform AbortSignal.",
  })
);

const NonNegativeInt = S.Natural.pipe(
  $I.annoteSchema("NonNegativeInt", {
    description: "Safe non-negative integer used for counts, offsets, and zero-disable timeouts.",
  })
);

const PositiveInt = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("PositiveInt", {
    description: "Safe positive integer used for one-based positions and resource limits.",
  })
);

const SimilarityThreshold = S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })).pipe(
  $I.annoteSchema("SimilarityThreshold", {
    description: "Cosine similarity threshold from zero through one.",
  })
);

const PdfScale = S.Finite.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("PdfScale", {
    description: "Positive PDF page-rendering scale factor.",
  })
);

const OfficeIssueSeverity = LiteralKit(["warning", "info", "error"]).pipe(
  $I.annoteSchema("OfficeIssueSeverity", { description: "Severity assigned to a parser diagnostic." })
);

const StandaloneStyleMode = LiteralKit(["full", "scoped", "none"]).pipe(
  $I.annoteSchema("StandaloneStyleMode", { description: "CSS inclusion mode for standalone HTML output." })
);

const StructuredStyleOperator = LiteralKit(["=", "~="]).pipe(
  $I.annoteSchema("StructuredStyleOperator", { description: "Comparison operator for a structured style attribute." })
);

/**
 * Schema-derived decoded type for {@link OcrTimeoutConfig}.
 *
 * @see {@link OcrTimeoutConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type OcrTimeoutConfig = typeof OcrTimeoutConfig.Type;

/**
 * Schema-derived decoded type for {@link OcrConfig}.
 *
 * @see {@link OcrConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type OcrConfig = typeof OcrConfig.Type;

/**
 * Schema-derived decoded type for {@link CommonOfficeParserConfig}.
 *
 * @see {@link CommonOfficeParserConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type CommonOfficeParserConfig = typeof CommonOfficeParserConfig.Type;

/**
 * Schema-derived decoded type for {@link HtmlParserConfig}.
 *
 * @see {@link HtmlParserConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type HtmlParserConfig = typeof HtmlParserConfig.Type;

/**
 * Schema-derived decoded type for {@link DecompressionLimits}.
 *
 * @see {@link DecompressionLimits} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type DecompressionLimits = typeof DecompressionLimits.Type;

/**
 * Schema-derived decoded type for {@link OfficeIssue}.
 *
 * @see {@link OfficeIssue} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type OfficeIssue = typeof OfficeIssue.Type;

/**
 * Schema-derived decoded type for {@link MetadataOverrides}.
 *
 * @see {@link MetadataOverrides} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type MetadataOverrides = typeof MetadataOverrides.Type;

/**
 * Schema-derived decoded type for {@link CommonGeneratorConfig}.
 *
 * @see {@link CommonGeneratorConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type CommonGeneratorConfig = typeof CommonGeneratorConfig.Type;

/**
 * Schema-derived decoded type for {@link HtmlInjectionConfig}.
 *
 * @see {@link HtmlInjectionConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type HtmlInjectionConfig = typeof HtmlInjectionConfig.Type;

/**
 * Schema-derived decoded type for {@link StandaloneConfig}.
 *
 * @see {@link StandaloneConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type StandaloneConfig = typeof StandaloneConfig.Type;

/**
 * Schema-derived decoded type for {@link HtmlGeneratorConfig}.
 *
 * @see {@link HtmlGeneratorConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type HtmlGeneratorConfig = typeof HtmlGeneratorConfig.Type;

/**
 * Schema-derived decoded type for {@link PdfGeneratorConfig}.
 *
 * @see {@link PdfGeneratorConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type PdfGeneratorConfig = typeof PdfGeneratorConfig.Type;

/**
 * Schema-derived decoded type for {@link StructuredStyleMapping}.
 *
 * @see {@link StructuredStyleMapping} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type StructuredStyleMapping = typeof StructuredStyleMapping.Type;

/**
 * Schema-derived decoded type for {@link RtfGeneratorConfig}.
 *
 * @see {@link RtfGeneratorConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type RtfGeneratorConfig = typeof RtfGeneratorConfig.Type;

/**
 * Schema-derived decoded type for {@link CsvGeneratorConfig}.
 *
 * @see {@link CsvGeneratorConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type CsvGeneratorConfig = typeof CsvGeneratorConfig.Type;

/**
 * Schema-derived decoded type for {@link MarkdownDialectConfig}.
 *
 * @see {@link MarkdownDialectConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownDialectConfig = typeof MarkdownDialectConfig.Type;

/**
 * Schema-derived decoded type for {@link FallbackToHtmlConfig}.
 *
 * @see {@link FallbackToHtmlConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type FallbackToHtmlConfig = typeof FallbackToHtmlConfig.Type;

/**
 * Schema-derived decoded type for {@link MdGeneratorConfig}.
 *
 * @see {@link MdGeneratorConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type MdGeneratorConfig = typeof MdGeneratorConfig.Type;

/**
 * Schema-derived decoded type for {@link TextGeneratorConfig}.
 *
 * @see {@link TextGeneratorConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type TextGeneratorConfig = typeof TextGeneratorConfig.Type;

/**
 * Schema-derived decoded type for {@link BaseChunkingConfig}.
 *
 * @see {@link BaseChunkingConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type BaseChunkingConfig = typeof BaseChunkingConfig.Type;

/**
 * Schema-derived decoded type for {@link FixedSizeChunkingConfig}.
 *
 * @see {@link FixedSizeChunkingConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type FixedSizeChunkingConfig = typeof FixedSizeChunkingConfig.Type;

/**
 * Schema-derived decoded type for {@link DocumentStructureChunkingConfig}.
 *
 * @see {@link DocumentStructureChunkingConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type DocumentStructureChunkingConfig = typeof DocumentStructureChunkingConfig.Type;

/**
 * Schema-derived decoded type for {@link SemanticChunkingConfig}.
 *
 * @see {@link SemanticChunkingConfig} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type SemanticChunkingConfig = typeof SemanticChunkingConfig.Type;

/**
 * Schema-derived decoded type for {@link OfficeChunk}.
 *
 * @see {@link OfficeChunk} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type OfficeChunk = typeof OfficeChunk.Type;

/**
 * Schema-derived decoded type for {@link TextFormatting}.
 *
 * @see {@link TextFormatting} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type TextFormatting = typeof TextFormatting.Type;

/**
 * Schema-derived decoded type for {@link SlideMetadata}.
 *
 * @see {@link SlideMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type SlideMetadata = typeof SlideMetadata.Type;

/**
 * Schema-derived decoded type for {@link SheetMetadata}.
 *
 * @see {@link SheetMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type SheetMetadata = typeof SheetMetadata.Type;

/**
 * Schema-derived decoded type for {@link IndentationMetadata}.
 *
 * @see {@link IndentationMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type IndentationMetadata = typeof IndentationMetadata.Type;

/**
 * Schema-derived decoded type for {@link HeadingMetadata}.
 *
 * @see {@link HeadingMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type HeadingMetadata = typeof HeadingMetadata.Type;

/**
 * Schema-derived decoded type for {@link ParagraphMetadata}.
 *
 * @see {@link ParagraphMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type ParagraphMetadata = typeof ParagraphMetadata.Type;

/**
 * Schema-derived decoded type for {@link ListMetadata}.
 *
 * @see {@link ListMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type ListMetadata = typeof ListMetadata.Type;

/**
 * Schema-derived decoded type for {@link CellMetadata}.
 *
 * @see {@link CellMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type CellMetadata = typeof CellMetadata.Type;

/**
 * Schema-derived decoded type for {@link TableMetadata}.
 *
 * @see {@link TableMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type TableMetadata = typeof TableMetadata.Type;

/**
 * Schema-derived decoded type for {@link ChartMetadata}.
 *
 * @see {@link ChartMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type ChartMetadata = typeof ChartMetadata.Type;

/**
 * Schema-derived decoded type for {@link ImageMetadata}.
 *
 * @see {@link ImageMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type ImageMetadata = typeof ImageMetadata.Type;

/**
 * Schema-derived decoded type for {@link EmbedMetadata}.
 *
 * @see {@link EmbedMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type EmbedMetadata = typeof EmbedMetadata.Type;

/**
 * Schema-derived decoded type for {@link AdmonitionMetadata}.
 *
 * @see {@link AdmonitionMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type AdmonitionMetadata = typeof AdmonitionMetadata.Type;

/**
 * Schema-derived decoded type for {@link PageMetadata}.
 *
 * @see {@link PageMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type PageMetadata = typeof PageMetadata.Type;

/**
 * Schema-derived decoded type for {@link TextMetadata}.
 *
 * @see {@link TextMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type TextMetadata = typeof TextMetadata.Type;

/**
 * Schema-derived decoded type for {@link NoteMetadata}.
 *
 * @see {@link NoteMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type NoteMetadata = typeof NoteMetadata.Type;

/**
 * Schema-derived decoded type for {@link BreakMetadata}.
 *
 * @see {@link BreakMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type BreakMetadata = typeof BreakMetadata.Type;

/**
 * Schema-derived decoded type for {@link CodeMetadata}.
 *
 * @see {@link CodeMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type CodeMetadata = typeof CodeMetadata.Type;

/**
 * Schema-derived decoded type for {@link CommentMetadata}.
 *
 * @see {@link CommentMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type CommentMetadata = typeof CommentMetadata.Type;

/**
 * Schema-derived decoded type for {@link HeaderFooterMetadata}.
 *
 * @see {@link HeaderFooterMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type HeaderFooterMetadata = typeof HeaderFooterMetadata.Type;

/**
 * Schema-derived decoded type for {@link BaseContentNode}.
 *
 * @see {@link BaseContentNode} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type BaseContentNode = BaseContentNodeShape;

/**
 * Schema-derived decoded type for {@link ChartData}.
 *
 * @see {@link ChartData} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type ChartData = typeof ChartData.Type;

/**
 * Schema-derived decoded type for {@link OfficeAttachment}.
 *
 * @see {@link OfficeAttachment} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type OfficeAttachment = typeof OfficeAttachment.Type;

/**
 * Schema-derived decoded type for {@link OfficeMetadata}.
 *
 * @see {@link OfficeMetadata} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type OfficeMetadata = typeof OfficeMetadata.Type;

/**
 * Schema-derived decoded type for {@link OfficeAuxiliaryContent}.
 *
 * @see {@link OfficeAuxiliaryContent} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type OfficeAuxiliaryContent = typeof OfficeAuxiliaryContent.Type;

/**
 * Schema-derived decoded type for {@link OfficeParserAST}.
 *
 * @see {@link OfficeParserAST} for the runtime schema and construction helpers.
 * @category type-level
 * @since 0.0.0
 */
export type OfficeParserAST = typeof OfficeParserAST.Type;

/**
 * Destination-specific conversion result decoded by {@link ConversionResult}.
 *
 * @see {@link ConversionResult} for the runtime schema factory.
 * @category type-level
 * @since 0.0.0
 */
export type ConversionResult<D extends UniversalGeneratorFormat> = ConversionResultShape<D>;


/**
 * Stable failure codes from OfficeParser parse and generate operations.
 *
 * **Example** (Guard a parser failure code)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OfficeErrorType } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * console.log(S.is(OfficeErrorType)("REQUIRED_PART_MISSING")) // true
 * console.log(S.is(OfficeErrorType)("NOT_A_CODE")) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OfficeErrorType = LiteralKit([
  /** Unsupported file extension */
  "EXTENSION_UNSUPPORTED",
  /** Unsupported output generator format */
  "FORMAT_UNSUPPORTED",
  /** File appears to be corrupted or malformed */
  "FILE_CORRUPTED",
  /** File could not be found at the specified path */
  "FILE_DOES_NOT_EXIST",
  /** Specified location/directory is not reachable or is a directory */
  "LOCATION_NOT_FOUND",
  /** Arguments passed to the function are missing or invalid */
  "IMPROPER_ARGUMENTS",
  /** Error occurred while reading or processing file buffers */
  "IMPROPER_BUFFERS",
  /** Input type is not a supported type (string, Buffer, ArrayBuffer, Uint8Array) */
  "INVALID_INPUT",
  /** PDF worker source is missing (required in browser) */
  "PDF_WORKER_MISSING",
  /** Attempted to use Node.js-only features in a browser environment */
  "FEATURE_NOT_SUPPORTED_IN_BROWSER",
  /** Style mapping string is malformed */
  "INVALID_STYLE_MAPPING",
  /** Selector in style mapping is invalid */
  "INVALID_SELECTOR",
  /** Output mapping in style mapping is invalid */
  "INVALID_OUTPUT_MAPPING",
  /** Semantic chunking strategy is selected but no embedding function is provided */
  "MISSING_EMBEDDING_FUNCTION",
  /** The operation was aborted */
  "OPERATION_ABORTED",
  /** ZIP entry count exceeds limit */
  "ZIP_ENTRY_COUNT_LIMIT_EXCEEDED",
  /** ZIP entry missing a valid declared size */
  "ZIP_ENTRY_INVALID_SIZE",
  /** ZIP uncompressed size limit exceeded */
  "ZIP_SIZE_LIMIT_EXCEEDED",
  /** ZIP data yielded no readable entries (corrupt, truncated, or not a ZIP archive) */
  "ZIP_NO_ENTRIES_FOUND",
  /** ZIP data is truncated: the End of Central Directory record is absent */
  "ZIP_TRUNCATED",
  /** A readable ZIP archive is missing the part its document format requires */
  "REQUIRED_PART_MISSING",
  /** Document element/structure nesting exceeded the safe recursion depth */
  "MAX_NESTING_DEPTH_EXCEEDED",
  /** Embedding call timed out */
  "EMBEDDING_TIMEOUT",
]).pipe(
  $I.annoteSchema("OfficeErrorType", {
    description: "Stable failure codes from OfficeParser parse and generate operations.",
  })
);

/**
 * Decoded failure-code value selected by the runtime `OfficeErrorType` literal kit.
 *
 * @see {@link OfficeErrorType} for the runtime literal helpers and allowed values.
 * @category type-level
 * @since 0.0.0
 */
export type OfficeErrorType = typeof OfficeErrorType.Type;

/**
 * Stable warning codes for non-fatal OfficeParser parse and generate conditions.
 *
 * **Example** (Guard a non-fatal warning code)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OfficeWarningType } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * console.log(S.is(OfficeWarningType)("OCR_FAILED")) // true
 * console.log(S.is(OfficeWarningType)("NOT_A_CODE")) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OfficeWarningType = LiteralKit([
  /** Performance advice (e.g., Rosetta translation on Mac) */
  "PERFORMANCE_TIP",
  /** OCR processing failed for an attachment */
  "OCR_FAILED",
  /** Extraction of structured chart data failed */
  "CHART_DATA_EXTRACTION_FAILED",
  /** Automatic worker path failed, falling back to CDN */
  "PDF_WORKER_FALLBACK",
  /** General attachment extraction failure */
  "ATTACHMENT_EXTRACTION_FAILED",
  /** Failed to load a specific page in a multi-page document */
  "PAGE_LOAD_FAILED",
  /** Failed to load a required dynamic dependency */
  "DEPENDENCY_LOAD_FAILED",
  /** Failed to extract images from a source */
  "IMAGE_EXTRACTION_FAILED",
  /** Failed to extract annotations from a document */
  "ANNOTATION_EXTRACTION_FAILED",
  /** Failed to process an extracted image bitmap */
  "IMAGE_PROCESSING_FAILED",
  /** Warning about limitations of browser-based generation */
  "BROWSER_GENERATION_LIMITATION",
  /** Specified sheet range in Excel/ODS export was not found */
  "SHEET_RANGE_NOT_FOUND",
  /** Buffer content type does not match the provided or expected file extension */
  "BUFFER_TYPE_MISMATCH",
  /** Failed to detect file type from buffer due to library error or incompatibility */
  "FILE_TYPE_DETECTION_FAILED",
  /** No chunks were generated for the document given the current strategy */
  "EMPTY_CHUNK_GENERATED",
  /** A node was skipped because it only contained whitespace */
  "WHITESPACE_NODE_SKIPPED",
  /** The HTML generator containerWidth option is invalid */
  "INVALID_CONTAINER_WIDTH",
  /** A document's repeated-cell expansion hit the configured cell limit and was truncated */
  "TABLE_CELL_LIMIT_EXCEEDED",
  /** A metadata override could not be represented in the destination format's vocabulary */
  "METADATA_NOT_REPRESENTABLE",
  /** A styleMap output.tag was not an allowed element name and was ignored */
  "INVALID_STYLE_MAP_TAG",
  /** A workbook archive contains no worksheet parts (chartsheet-only workbooks are legitimate) */
  "NO_WORKSHEETS_FOUND",
  /** A presentation archive contains no slides (a zero-slide presentation is legitimate) */
  "NO_SLIDES_FOUND",
]).pipe(
  $I.annoteSchema("OfficeWarningType", {
    description: "Stable warning codes for non-fatal OfficeParser parse and generate conditions.",
  })
);

/**
 * Decoded warning-code value selected by the runtime `OfficeWarningType` literal kit.
 *
 * @see {@link OfficeWarningType} for the runtime literal helpers and allowed values.
 * @category type-level
 * @since 0.0.0
 */
export type OfficeWarningType = typeof OfficeWarningType.Type;

/**
 * Nested millisecond timeouts for OCR worker-pool lifecycle, language load, and recognition.
 *
 * **Details**
 *
 * Set any key to `0` to disable that specific timeout. The keys are
 * `autoTerminate`, `workerLoad`, and `recognition`.
 *
 * **Gotchas**
 *
 * These nested keys on {@link OcrConfig} `timeout` are the only timeout surface.
 * {@link OcrConfig} has no sibling flat timeout fields.
 *
 * @category configuration
 * @since 0.0.0
 */
interface OcrTimeoutConfigShape {
  /**
   * Timeout in milliseconds of inactivity before the OCR worker pool is
   * automatically terminated and freed.
   *
   * **Details**
   *
   * The timer resets every time a new OCR job is enqueued.  When the last
   * job completes and this duration passes without a new one, the entire
   * worker pool is torn down so that no background threads keep the Node.js
   * process alive unnecessarily.
   *
   * Set to `0` to keep workers alive indefinitely, for example when tearing
   * the pool down at process shutdown.
   * Default is 10,000 ms (10 seconds).
   */
  readonly autoTerminate?: undefined | number;
  /**
   * Timeout in milliseconds for initializing a Tesseract worker
   * (loading the JS runtime, downloading or loading the `.traineddata`
   * language file) or for re-initializing an existing worker with a
   * different language.
   *
   * **Details**
   *
   * Multi-language combinations (e.g. `'por+eng+spa'`) must download a
   * separate `.traineddata` file for each language and are therefore
   * particularly susceptible to slow networks.  Tune this value upward if
   * your OCR environment has high network latency or if you are loading
   * languages from disk in a large container image.
   *
   * When the timeout fires, the failed job is rejected with a non-fatal
   * {@link OfficeWarningType.OCR_FAILED} warning and parsing continues
   * without OCR output for that image.  The stalled worker is terminated
   * and removed from the pool to prevent thread leaks.
   *
   * Set to `0` to wait indefinitely (not recommended for production; a hung
   * network request will block the entire OCR queue for that language).
   * Default is 60,000 ms (60 seconds).
   */
  readonly workerLoad?: undefined | number;
  /**
   * Timeout in milliseconds for the actual OCR text-recognition call
   * (`worker.recognize(image)`) on an already-initialized Tesseract worker.
   *
   * **Details**
   *
   * Recognition time scales with image resolution and the number of active
   * languages.  Very high-resolution scans or unusual character sets can
   * exceed the default.  If this timeout fires, the job is rejected with a
   * non-fatal {@link OfficeWarningType.OCR_FAILED} warning; the worker is
   * terminated and evicted from the pool because its internal state after a
   * mid-recognition timeout is undefined.
   *
   * Set to `0` to wait indefinitely.
   * Default is 30,000 ms (30 seconds).
   */
  readonly recognition?: undefined | number;
}

/**
 * Runtime schema for the OCR timeout configuration.
 *
 * **Example** (Validate timeout settings)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OcrTimeoutConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * console.log(S.is(S.toEncoded(OcrTimeoutConfig))({ workerLoad: 60_000 })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OcrTimeoutConfig = S.Class<OcrTimeoutConfigShape>($I`OcrTimeoutConfig`)(
  {
    autoTerminate: S.optionalKey(NonNegativeInt),
    workerLoad: S.optionalKey(NonNegativeInt),
    recognition: S.optionalKey(NonNegativeInt),
  },
  $I.annote("OcrTimeoutConfig", {
    description: "Nested millisecond timeouts for OCR worker-pool lifecycle, language load, and recognition.",
  })
);

/**
 * Controls OCR language data, worker assets, cancellation, and timeouts during attachment extraction.
 *
 * @category configuration
 * @since 0.0.0
 */
interface OcrConfigShape {
  /**
   * Language for OCR.
   * Default is 'eng'.
   *
   * **Details**
   *
   * You can provide multiple languages separated by a `+` sign (e.g., 'eng+fra' for English and French).
   * The OCR engine will then attempt to recognize text in any of the specified languages.
   *
   * See the list of supported languages and their codes here:
   * https://tesseract-ocr.github.io/tessdoc/Data-Files#data-files-for-version-400-november-29-2016
   */
  readonly language?: undefined | string;
  /**
   * Path to the Tesseract worker script.
   * Primarily used for offline/air-gapped environments.
   * Default is ''.
   */
  readonly workerPath?: undefined | string;
  /**
   * Path to the Tesseract core script.
   * Primarily used for offline/air-gapped environments.
   * Default is ''.
   */
  readonly corePath?: undefined | string;
  /**
   * Path for Tesseract language files (traineddata).
   * Primarily used for offline/air-gapped environments.
   * Default is ''.
   */
  readonly langPath?: undefined | string;
  /**
   * Nested OCR timeouts from {@link OcrTimeoutConfig}.
   *
   * **Gotchas**
   *
   * Configure timeouts only through these nested keys (`autoTerminate`,
   * `workerLoad`, `recognition`). {@link OcrConfig} has no sibling flat timeout
   * fields.
   */
  readonly timeout?: undefined | OcrTimeoutConfig;
  /**
   * An optional AbortSignal propagated from the main parser configuration to abort active OCR jobs.
   * If the signal is aborted:
   * 1. Any pending OCR jobs in the scheduler queue are rejected immediately.
   * 2. Any active OCR job running on a Tesseract worker will reject, the worker will be
   *    terminated, and it will be removed from the pool to avoid hanging worker threads.
   *
   * **Details**
   *
   * Developers should prefer passing this at the top level of `parseOffice` (as `config.abortSignal`),
   * which automatically propagates here.
   */
  readonly abortSignal?: undefined | AbortSignal | null;
}

/**
 * Runtime schema for shared OCR configuration.
 *
 * **Example** (Validate OCR language settings)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OcrConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * console.log(S.is(S.toEncoded(OcrConfig))({ language: "eng+fra" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OcrConfig = S.Class<OcrConfigShape>($I`OcrConfig`)(
  {
    language: S.optionalKey(S.String),
    workerPath: S.optionalKey(S.String),
    corePath: S.optionalKey(S.String),
    langPath: S.optionalKey(S.String),
    timeout: S.optionalKey(OcrTimeoutConfig),
    abortSignal: AbortSignalSchema.pipe(S.NullOr, S.optionalKey),
  },
  $I.annote("OcrConfig", {
    description: "OCR language data, worker assets, cancellation, and timeout configuration.",
  })
);

/**
 * Controls parsing behavior that applies regardless of the detected Office format.
 *
 * @category configuration
 * @since 0.0.0
 */
interface CommonOfficeParserConfigShape {
  /**
   * Callback for warnings or non-fatal errors encountered during parsing.
   * Allows you to capture issues like OCR failures or attachment extraction errors
   * without stopping the parsing process.
   */
  readonly onWarning?: undefined | ((issue: OfficeIssue) => void);
  /**
   * The delimiter used for every new line in places that allow multiline text like word.
   * Default is \n.
   */
  readonly newlineDelimiter?: undefined | string;
  /**
   * Flag to ignore notes from parsing in files like powerpoint.
   * Default is false. It includes notes in the parsed text by default.
   */
  readonly ignoreNotes?: undefined | boolean;
  /**
   * Flag to ignore comments from parsing.
   * Default is false.
   */
  readonly ignoreComments?: undefined | boolean;
  /**
   * Flag to ignore headers and footers from parsing.
   * Default is false.
   */
  readonly ignoreHeadersAndFooters?: undefined | boolean;
  /**
   * Flag to ignore slide masters from parsing in PowerPoint.
   * Default is false.
   */
  readonly ignoreSlideMasters?: undefined | boolean;
  /**
   * Flag to extract attachments like images, charts, etc.
   * Default is false.
   */
  readonly extractAttachments?: undefined | boolean;
  /**
   * Flag to include raw content (XML for XML-based formats, RTF for RTF) in the AST.
   * Default is false.
   */
  readonly includeRawContent?: undefined | boolean;
  /**
   * Flag to enable OCR for images.
   * Default is false.
   */
  readonly ocr?: undefined | boolean;
  /**
   * Shared OCR configuration for worker pooling, language data, and timeouts.
   *
   * **Details**
   *
   * Language is {@link OcrConfig} `language` (default `'eng'`). There is no
   * sibling language field on this config object.
   */
  readonly ocrConfig?: undefined | OcrConfig;
  /**
   * An optional AbortSignal to cancel the parsing operation.
   * When aborted, the parser immediately rejects with a standard AbortError (DOMException).
   *
   * **Details**
   *
   * ### Format-Specific Abort Behavior:
   * - **PDF**: Checked between page loads and before individual image OCR operations.
   * - **RTF**: Checked before parsing/traversal and before running OCR on image attachments.
   * - **DOCX/XLSX/PPTX/ODF**: Checked during zip decompression before loading and parsing XML files.
   * - **CSV/MD/HTML**: Checked at the start of the parsing phase.
   *
   * Note: If an OCR operation is currently running on a Tesseract worker when aborted,
   * the worker will be terminated and removed from the worker pool automatically to prevent leaks.
   */
  readonly abortSignal?: undefined | AbortSignal | null;

  /**
   * Flag to serialize raw content (XML) as clean, formatted strings.
   * Only relevant when `includeRawContent` is true.
   * Default is true.
   *
   * **Details**
   *
   * If false, the parser will attempt to extract the original raw substring from the
   * source document instead of re-serializing the DOM node.
   */
  readonly serializeRawContent?: undefined | boolean;
  /**
   * Flag to preserve original XML whitespace and line endings when serializing.
   * Only relevant when `includeRawContent` is true and `serializeRawContent` is true.
   * Default is false.
   */
  readonly preserveXmlWhitespace?: undefined | boolean;
  /**
   * The URL/path to the PDF.js worker script.
   *
   * **Details**
   *
   * **Mandatory** when using PDF parsing in browser environments to avoid worker configuration errors.
   * If not provided, it defaults to `https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs`.
   * You can override this with your own local path or a different CDN link.
   */
  readonly pdfWorkerSrc?: undefined | string;
  /**
   * Flag to include break nodes in the AST.
   * This is currently only supported for Word documents. (w:br nodes)
   *
   * **Details**
   *
   * Default is false
   */
  readonly includeBreakNodes?: undefined | boolean;
  /**
   * Flag to ignore all internal (anchor) links during parsing.
   * When true, all bookmarks, cross-references, and internal document jumps are stripped
   * from the AST. Only external URLs will be preserved.
   *
   * **Details**
   *
   * Use this if you want a "flat" document without any internal interactivity.
   *
   * Default is false.
   */
  readonly ignoreInternalLinks?: undefined | boolean;
  /**
   * Optional hint for the file format.
   * When a Buffer or ArrayBuffer is passed, the parser relies on magic bytes to detect the file type.
   * Text-based formats like 'md', 'html', and 'csv' lack reliable magic bytes.
   * If you are parsing these formats from a Buffer, you must provide this fileType hint.
   *
   * **Details**
   *
   * This is authoritative and is used to determine the file type, so it should be accurate.
   * If provided, this bypasses the magic bytes detection and the file extension-based detection either way.
   *
   * Default is null.
   */
  readonly fileType?: undefined | SupportedFileType | null;
  /**
   * Custom delimiter for CSV files.
   * Defaults to ',' but can be overridden (e.g., ';', '\t').
   */
  readonly csvDelimiter?: undefined | string;
  /**
   * Limits and checks applied during ZIP extraction to protect against excessive
   * memory and resource usage.
   */
  readonly decompressionLimits?: undefined | DecompressionLimits;
}

/**
 * Runtime schema for format-independent OfficeParser options.
 *
 * **Example** (Validate parser options)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CommonOfficeParserConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * console.log(S.is(S.toEncoded(CommonOfficeParserConfig))({ ignoreComments: true, fileType: "docx" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CommonOfficeParserConfig = S.Class<CommonOfficeParserConfigShape>($I`CommonOfficeParserConfig`)(
  {
    onWarning: S.optionalKey(runtimeFunction<(issue: OfficeIssue) => void>()),
    newlineDelimiter: S.optionalKey(S.String),
    ignoreNotes: S.optionalKey(S.Boolean),
    ignoreComments: S.optionalKey(S.Boolean),
    ignoreHeadersAndFooters: S.optionalKey(S.Boolean),
    ignoreSlideMasters: S.optionalKey(S.Boolean),
    extractAttachments: S.optionalKey(S.Boolean),
    includeRawContent: S.optionalKey(S.Boolean),
    ocr: S.optionalKey(S.Boolean),
    ocrConfig: S.optionalKey(OcrConfig),
    abortSignal: AbortSignalSchema.pipe(S.NullOr, S.optionalKey),
    serializeRawContent: S.optionalKey(S.Boolean),
    preserveXmlWhitespace: S.optionalKey(S.Boolean),
    pdfWorkerSrc: S.optionalKey(S.String),
    includeBreakNodes: S.optionalKey(S.Boolean),
    ignoreInternalLinks: S.optionalKey(S.Boolean),
    fileType: S.suspend((): typeof SupportedFileType => SupportedFileType).pipe(S.NullOr, S.optionalKey),
    csvDelimiter: S.optionalKey(S.String),
    decompressionLimits: S.optionalKey(S.suspend((): typeof DecompressionLimits => DecompressionLimits)),
  },
  $I.annote("CommonOfficeParserConfig", {
    description: "Parsing behavior that applies regardless of the detected Office format.",
  })
);

/**
 * Controls preservation behavior shared by HTML, XHTML, and EPUB parsing.
 *
 * **Details**
 *
 * Note there is deliberately no `MdParserConfig`: the Markdown parser populates its
 * dialect-provenance metadata (e.g. `AdmonitionMetadata.sourceSyntax`) unconditionally because
 * doing so costs nothing and changes no existing field's value, so it has nothing to configure.
 * An empty placeholder interface would be worse than useless here - `interface X {}` accepts any
 * non-nullish value in TypeScript, so `mdParserConfig: 5` would type-check.
 *
 * @category configuration
 * @since 0.0.0
 */
interface HtmlParserConfigShape {
  /**
   * Preserve source HTML attributes that no typed metadata field consumed, on
   * `OfficeContentNode.htmlAttributes`, so they can be replayed on generation.
   *
   * **Details**
   *
   * Off by default: with it off nothing is populated, so the AST is byte-identical to previous
   * releases, and the attribute-replay surface stays something a consumer opts into rather than
   * something switched on for every existing caller. Captured values are sanitized on the way in
   * *and* on the way out - see `BaseContentNode.htmlAttributes`.
   *
   * Defaults to false.
   */
  readonly preserveAttributes?: undefined | boolean;
  /**
   * Preserve `<iframe>` embeds that aren't recognized as a known provider (YouTube is always
   * recognized). By default every non-YouTube iframe is dropped, which is a deliberate security
   * posture other consumers rely on; set this to opt back in. `true` preserves any iframe; an
   * array is a hostname allowlist (an entry matches the src's host exactly or as a `.`-suffix,
   * so `"vimeo.com"` also matches `player.vimeo.com`). Preserved iframes become `embed` nodes
   * with `embedType: 'iframe'`; on generation the `src` is still scheme-checked (only http/https
   * survive). This also governs a raw `<iframe>` block encountered in Markdown input.
   *
   * **Details**
   *
   * Defaults to false.
   */
  readonly preserveIframes?: undefined | boolean | string[];
  /**
   * Import ambiguous "folk" embed forms in Markdown as embeds: a standalone Obsidian-style image
   * whose URL is a YouTube link (`![](https://youtube.com/watch?v=ID)`), and the clickable
   * thumbnail-link (`[![alt](https://img.youtube.com/vi/ID/…)](watch-url)`). Both become a
   * `embedType: 'youtube'` embed (rendered from the validated id, so it is safe). Off by default:
   * auto-upgrading an image/link to an embed is a heuristic that could mangle a genuinely-intended
   * image link, so a consumer opts in. The unambiguous forms (`<div data-youtube-video>`, a bare
   * YouTube `<iframe>`, the `::youtube` directive) are always recognized, independent of this flag.
   *
   * **Details**
   *
   * Defaults to false.
   */
  readonly embedFolkForms?: undefined | boolean;
}

/**
 * Runtime schema for HTML parser preservation settings.
 *
 * **Example** (Validate iframe preservation)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { HtmlParserConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * console.log(S.is(S.toEncoded(HtmlParserConfig))({ preserveIframes: ["vimeo.com"] })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlParserConfig = S.Class<HtmlParserConfigShape>($I`HtmlParserConfig`)(
  {
    preserveAttributes: S.optionalKey(S.Boolean),
    preserveIframes: S.optionalKey(S.Union([S.Boolean, S.Array(S.String).pipe(S.mutable)])),
    embedFolkForms: S.optionalKey(S.Boolean),
  },
  $I.annote("HtmlParserConfig", {
    description: "Preservation behavior shared by HTML, XHTML, and EPUB parsing.",
  })
);

/**
 * Maps an input format string to its corresponding format-specific parser configuration, mirroring
 * `GeneratorSpecificConfig<D>` on the generator side. Unlike the generator side, the input format is
 * usually runtime-detected rather than known statically at the `parseOffice()` call site, so this
 * mainly exists for internal typing/extensibility rather than compile-time narrowing per call.
 */
type ParserSpecificConfig<F extends string> = F extends "html" | "epub"
  ? {
      readonly htmlParserConfig?: undefined | HtmlParserConfig;
    }
  : Partial<{ readonly htmlParserConfig: HtmlParserConfig }>;

/**
 * Combines format-independent parsing settings with options selected by the input format.
 *
 * @category configuration
 * @since 0.0.0
 */
export type OfficeParserConfig<F extends string = string> = CommonOfficeParserConfig & ParserSpecificConfig<F>;

/**
 * Runtime schema for the complete parser configuration surface.
 *
 * **Example** (Validate HTML parser settings)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OfficeParserConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(OfficeParserConfig))({ fileType: "html", htmlParserConfig: { preserveAttributes: true } })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OfficeParserConfig = S.Class<OfficeParserConfig>($I`OfficeParserConfig`)(
  {
    ...CommonOfficeParserConfig.fields,
    htmlParserConfig: S.optionalKey(HtmlParserConfig),
  },
  $I.annote("OfficeParserConfig", {
    description: "Format-independent and input-format-specific OfficeParser settings.",
  })
);

/**
 * Caps archive expansion and table-cell materialization before malformed documents consume excessive memory.
 *
 * @category configuration
 * @since 0.0.0
 */
interface DecompressionLimitsShape {
  /**
   * Maximum allowed total uncompressed size (in bytes) of files extracted from a ZIP archive.
   * Applies to OOXML (DOCX, XLSX, PPTX) and ODF (ODT, ODP, ODS) formats.
   * Default is 536870912 (512 MB).
   */
  readonly maxUncompressedBytes?: undefined | number;
  /**
   * Maximum allowed number of entries (files and directories) in a ZIP archive.
   * Applies to OOXML (DOCX, XLSX, PPTX) and ODF (ODT, ODP, ODS) formats.
   * Default is 10000.
   */
  readonly maxZipEntries?: undefined | number;
  /**
   * Maximum number of table cells materialized from a single document.
   *
   * **Details**
   *
   * ODF encodes runs of identical cells and rows with `table:number-columns-repeated` and
   * `table:number-rows-repeated` rather than repeating the markup, so a few hundred bytes of XML
   * can ask the parser to build an arbitrary number of nodes - and because the two multiply, a
   * row repeat times a column repeat compounds it. The ZIP limits above cannot catch this: the
   * XML is tiny before decompression and the expansion happens afterwards, while building the
   * AST.
   *
   * Real documents are nowhere near this. The repeat counts LibreOffice writes are large
   * (`number-rows-repeated="1048566"` is routine) but they sit on *empty* trailing runs, which
   * are skipped for spreadsheets; the bundled fixtures top out around 350 cells.
   *
   * On reaching the limit the parser stops materializing further cells, emits a
   * `TABLE_CELL_LIMIT_EXCEEDED` warning, and returns what it has rather than throwing, so a
   * genuinely enormous sheet still yields usable output. Raise it if you routinely process
   * spreadsheets larger than this; note the memory cost scales with it.
   *
   * Default is 1000000.
   */
  readonly maxTableCells?: undefined | number;
}

/**
 * Runtime schema for archive and table expansion limits.
 *
 * **Example** (Validate decompression limits)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DecompressionLimits } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * console.log(S.is(S.toEncoded(DecompressionLimits))({ maxZipEntries: 1_000 })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DecompressionLimits = S.Class<DecompressionLimitsShape>($I`DecompressionLimits`)(
  {
    maxUncompressedBytes: S.optionalKey(PositiveInt),
    maxZipEntries: S.optionalKey(PositiveInt),
    maxTableCells: S.optionalKey(PositiveInt),
  },
  $I.annote("DecompressionLimits", {
    description: "Limits applied during ZIP extraction and repeated-cell expansion.",
  })
);

/**
 * Describes parser settings after defaults and format-specific options have been resolved.
 *
 * @category configuration
 * @since 0.0.0
 */
export type FullOfficeParserConfig = DeepRequired<OfficeParserConfig>;

/**
 * Carries a stable code, severity, message, and optional source node for a document-processing diagnostic.
 *
 * @category diagnostics
 * @since 0.0.0
 */
interface OfficeIssueShape {
  /** The severity of the issue. */
  readonly type: "warning" | "info" | "error";
  /** Human-readable message text. */
  readonly message: string;
  /** The specific AST node that triggered this issue, if applicable. */
  readonly node?: undefined | OfficeContentNode;
  /** A unique error code for programmatic handling. */
  readonly code: OfficeWarningType | OfficeErrorType;
  /** Optional additional context or original error object. */
  readonly details?: undefined | unknown;
}

/**
 * Runtime schema for a structured OfficeParser diagnostic.
 *
 * **Example** (Validate a warning)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OfficeIssue } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * console.log(S.is(S.toEncoded(OfficeIssue))({ type: "warning", message: "OCR skipped", code: "OCR_FAILED" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OfficeIssue = S.Class<OfficeIssueShape>($I`OfficeIssue`)(
  {
    type: OfficeIssueSeverity,
    message: S.String,
    node: S.suspend((): typeof OfficeContentNode => OfficeContentNode).pipe(S.optionalKey),
    code: S.Union([OfficeWarningType, OfficeErrorType]),
    details: S.optionalKey(S.Unknown),
  },
  $I.annote("OfficeIssue", {
    description: "Structured warning, informational message, or error reported by OfficeParser.",
  })
);

const isEncodedOfficeIssue = S.is(S.toEncoded(OfficeIssue));

/**
 * Adds an optional structured OfficeParser diagnostic to a standard JavaScript `Error`.
 *
 * **Details**
 *
 * Catching code can branch on `error.officeIssue.code`, the same stable enum used for warnings,
 * instead of matching against message text. Errors that originate outside the library (and
 * `AbortError`, which is deliberately re-thrown untouched so cancellation stays detectable via
 * `error.name`) do not carry this property, hence the optional marker.
 *
 * **Example** (Inspect a structured parser error)
 *
 * ```ts
 * import { OfficeError, OfficeIssue } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * const issue: OfficeIssue = {
 *   type: "error",
 *   message: "Required DOCX part is missing",
 *   code: "REQUIRED_PART_MISSING"
 * }
 * const error: OfficeError = Object.assign(new Error(issue.message), { officeIssue: issue })
 *
 * console.log(error.officeIssue?.code)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export interface OfficeError extends Error {
  /** The structured issue this error was created from. */
  readonly officeIssue?: undefined | OfficeIssue;
}

/**
 * Identity-preserving runtime schema for native errors carrying an optional OfficeParser issue.
 *
 * **Gotchas**
 *
 * This remains a behavioral `Error` interface rather than an `S.TaggedError`: cancellation and
 * third-party failures must retain their native error identity, prototype, and `name`.
 *
 * **Example** (Validate an enriched native error)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OfficeError } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * console.log(S.is(OfficeError)(new Error("parse failed"))) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OfficeError = S.declare<OfficeError>(
  (input: unknown): input is OfficeError =>
    P.isError(input) &&
    (!P.hasProperty(input, "officeIssue") ||
      input.officeIssue === undefined ||
      isEncodedOfficeIssue(input.officeIssue))
).pipe(
  $I.annoteSchema("OfficeError", {
    description: "Native Error optionally enriched with a structured OfficeParser diagnostic.",
  })
);

/**
 * The result of a document conversion operation.
 */
type ConversionValue<D extends UniversalGeneratorFormat> = D extends "pdf"
  ? Uint8Array | string
  : D extends "chunks"
    ? OfficeChunk[]
    : D extends "csv"
      ? string | Uint8Array
      : D extends "epub"
        ? Uint8Array
        : string;

/**
 * Pairs generated document content with the non-fatal issues reported during conversion.
 *
 * @typeParam D - Selects the generated value type for the destination format.
 * @category models
 * @since 0.0.0
 */
interface ConversionResultShape<D extends UniversalGeneratorFormat> {
  /** The actual generated content (HTML, Markdown, Text, OfficeChunk[], etc.). */
  readonly value: ConversionValue<D>;
  /** A collection of issues (warnings/infos) generated during the process. */
  readonly messages: OfficeIssue[];
}

/**
 * Build the runtime schema for a destination-specific conversion result.
 *
 * **Example** (Build a text-result schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ConversionResult } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * const TextResult = ConversionResult<"text">(S.String)
 * console.log(S.is(S.toEncoded(TextResult))({ value: "hello", messages: [] })) // true
 * ```
 *
 * @category schema-factories
 * @since 0.0.0
 */
export const ConversionResult = <D extends UniversalGeneratorFormat>(value: S.Schema<ConversionValue<D>>) =>
  S.Class<ConversionResultShape<D>>($I`ConversionResult`)(
    {
      value,
      messages: S.Array(OfficeIssue).pipe(S.mutable),
    },
    $I.annote("ConversionResult", {
      description: "Generated content paired with non-fatal conversion diagnostics.",
    })
  );

/**
 * Lists destination formats available for every supported source document.
 *
 * **Example** (Guard an HTML destination)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { UniversalGeneratorFormat } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(UniversalGeneratorFormat)("html")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UniversalGeneratorFormat = LiteralKit(["text", "md", "html", "pdf", "csv", "rtf", "chunks", "epub"]).pipe(
  $I.annoteSchema("UniversalGeneratorFormat", {
    description: "Destination formats available for every supported OfficeParser source.",
  })
);

/**
 * Decoded destination-format member of {@link UniversalGeneratorFormat}.
 *
 * @see {@link UniversalGeneratorFormat} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type UniversalGeneratorFormat = typeof UniversalGeneratorFormat.Type;

/**
 * Selects generator destinations for a source type; the current mapping permits every universal format.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SupportedDestination<_T extends SupportedFileType = SupportedFileType> = UniversalGeneratorFormat;

/**
 * Selects document metadata fields to replace when a generator writes output.
 *
 * **Details**
 *
 * HTML and Markdown can represent arbitrary custom entries. EPUB and RTF use closed metadata vocabularies, so generators report `METADATA_NOT_REPRESENTABLE` when an override cannot be written.
 *
 * @category configuration
 * @since 0.0.0
 */
interface MetadataOverridesShape {
  /** Document title. */
  readonly title?: undefined | string;
  /** Document author. */
  readonly author?: undefined | string;
  /** Description/comments. */
  readonly description?: undefined | string;
  /** Subject/topic. */
  readonly subject?: undefined | string;
  /** Keywords. */
  readonly keywords?: undefined | string;
  /** User who last modified the document. */
  readonly lastModifiedBy?: undefined | string;
  /** Creation date. */
  readonly created?: undefined | Date;
  /**
   * Last modification date.
   *
   * **Details**
   *
   * EPUB writes it as the required `dcterms:modified` property and as the mtime on every zip
   * entry. When unset, the source document's own `metadata.modified` is used, falling back to
   * the current time only if the document has none.
   */
  readonly modified?: undefined | Date;
  /**
   * Language tag (e.g. `'en'`, `'de-DE'`). Written as EPUB `dc:language` and HTML `lang`.
   */
  readonly language?: undefined | string;
  /**
   * Arbitrary caller-defined key/value pairs, kept in their own bucket rather than mixed in
   * beside the named fields above: with a bare index signature a typo like `titel` would
   * silently become a custom entry instead of a compile error.
   *
   * **Details**
   *
   * Written where the format allows it (HTML `<meta name="custom:KEY">`, Markdown frontmatter);
   * reported via `onWarning` where it does not (EPUB, RTF).
   */
  readonly custom?: undefined | Record<string, string | number | boolean | Date>;
}

const MetadataOverrideValue = S.Union([S.String, S.Finite, S.Boolean, S.Date]).pipe(
  $I.annoteSchema("MetadataOverrideValue", {
    description: "Scalar value accepted by a custom metadata override.",
  })
);

/**
 * Runtime schema for document metadata overrides.
 *
 * **Example** (Validate title and modification overrides)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { MetadataOverrides } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * console.log(S.is(S.toEncoded(MetadataOverrides))({ title: "Q4", modified: new Date(0) })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MetadataOverrides = S.Class<MetadataOverridesShape>($I`MetadataOverrides`)(
  {
    title: S.optionalKey(S.String),
    author: S.optionalKey(S.String),
    description: S.optionalKey(S.String),
    subject: S.optionalKey(S.String),
    keywords: S.optionalKey(S.String),
    lastModifiedBy: S.optionalKey(S.String),
    created: S.optionalKey(S.Date),
    modified: S.optionalKey(S.Date),
    language: S.optionalKey(S.String),
    custom: S.optionalKey(S.Record(S.String, MetadataOverrideValue)),
  },
  $I.annote("MetadataOverrides", {
    description: "Document metadata fields replaced when a generator writes output.",
  })
);

/**
 * Controls parsing-independent behavior shared by every document generator.
 *
 * @category configuration
 * @since 0.0.0
 */
interface CommonGeneratorConfigShape {
  /**
   * Runs before each node is generated and may filter, replace, mutate, or asynchronously inspect it.
   *
   * **Details**
   *
   * Return `false` to skip the node and its children. Return a string to replace normal rendering.
   * Mutate the node and return `void` to continue with the default renderer. The callback may also
   * return a `Promise` for asynchronous work.
   */
  readonly onNode?: undefined | ((node: OfficeContentNode) => string | false | Promise<string | false | void> | void);
  /**
   * Callback for warnings, non-fatal errors, or issues encountered during generation.
   * Allows the process to continue while reporting skipping or approximation of content.
   */
  readonly onWarning?: undefined | ((issue: OfficeIssue) => void);
  /**
   * Maps named document styles to semantic output elements.
   *
   * **Details**
   *
   * String entries use the mammoth.js-compatible `selector => output` syntax. Structured entries
   * add typed selectors, classes, and attributes. Set `ignoreDefaultStyleMap` to `true` and leave
   * this array empty to disable semantic style translation.
   *
   * **Example** (Map a named paragraph style)
   *
   * ```ts
   * const styleMap: CommonGeneratorConfig["styleMap"] = ["p[style-name='Heading 1'] => h1"]
   * console.log(styleMap)
   * ```
   *
   * **Example** (Map a quote style)
   *
   * ```ts
   * const styleMap: CommonGeneratorConfig["styleMap"] = ["p[style='Quote'] => blockquote"]
   * console.log(styleMap)
   * ```
   *
   * **Example** (Map a style with structured output)
   *
   * ```ts
   * const styleMap: CommonGeneratorConfig["styleMap"] = [
   *   {
   *     selector: { nodeType: "paragraph", attributes: { style: "Heading 1" } },
   *     output: { tag: "h1", classes: ["main-title"], attributes: { id: "top" } }
   *   }
   * ]
   *
   * console.log(styleMap.length)
   * ```
   */
  readonly styleMap?: undefined | string[] | StructuredStyleMapping[];
  /**
   * Whether to include visual formatting like font size, font family, and colors in the output.
   * Set to false for clean, semantic output.
   * Defaults to true.
   */
  readonly includeFormatting?: undefined | boolean;
  /**
   * Whether to automatically generate unique slug-based IDs for headings.
   * Useful for table-of-contents and anchor links.
   * Defaults to true.
   */
  readonly generateIds?: undefined | boolean;
  /**
   * Whether to render document metadata (title, author, etc.) as visible content
   * in the generated output (e.g., a header block in HTML or plain text).
   * Structural metadata (HTML <meta> tags, Markdown YAML frontmatter) is always included.
   * Defaults to false.
   */
  readonly renderMetadata?: undefined | boolean;
  /**
   * Overrides for the document metadata written into the generated output, applied on top of
   * `ast.metadata`.
   *
   * **Details**
   *
   * Merged **per field**, so setting only `modified` leaves the parsed title, author, and
   * everything else intact. Every field is optional; an omitted field keeps the source
   * document's value.
   *
   * These are output overrides only - `ast.metadata` itself is never mutated, so the same AST
   * can be generated repeatedly with different metadata.
   *
   * **Example** (Override the modification date)
   *
   * ```ts
   * const config: CommonGeneratorConfig = {
   *   metadataOverrides: { modified: new Date("2024-01-01T00:00:00Z") }
   * }
   *
   * console.log(config.metadataOverrides?.modified)
   * ```
   *
   * **Example** (Override output identity fields)
   *
   * ```ts
   * const config: CommonGeneratorConfig = {
   *   metadataOverrides: {
   *     title: "Q4 Report",
   *     author: "Acme Inc",
   *     custom: { department: "Finance" }
   *   }
   * }
   *
   * console.log(config.metadataOverrides?.title)
   * ```
   */
  readonly metadataOverrides?: undefined | MetadataOverrides;
  /**
   * Whether to ignore the built-in default style mappings (e.g. "Heading 1" -> h1).
   * Set to true if you want full control over style mapping.
   * Defaults to false.
   */
  readonly ignoreDefaultStyleMap?: undefined | boolean;
  /**
   * Whether to include images in the generated output.
   * Defaults to true.
   */
  readonly includeImages?: undefined | boolean;
  /**
   * Whether to include interactive charts in the generated output (HTML only).
   * Defaults to true.
   */
  readonly includeCharts?: undefined | boolean;
  /**
   * Whether to ignore all internal (anchor) links and anchor IDs during generation.
   * When true, all bookmarks, cross-references, and internal document jumps are stripped.
   * Specifically for Markdown, this removes the {#id} block from headings.
   * Defaults to false.
   */
  readonly ignoreInternalLinks?: undefined | boolean;
  /**
   * An optional AbortSignal to cancel the generation operation.
   * When aborted, the generator immediately rejects with a standard AbortError.
   * Currently supported by PdfGenerator and ChunkingGenerator.
   */
  readonly abortSignal?: undefined | AbortSignal | null;
}

/**
 * Runtime schema for parsing-independent generator behavior.
 *
 * **Example** (Validate shared generator settings)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CommonGeneratorConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * console.log(S.is(S.toEncoded(CommonGeneratorConfig))({ includeImages: true, generateIds: true })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CommonGeneratorConfig = S.Class<CommonGeneratorConfigShape>($I`CommonGeneratorConfig`)(
  {
    onNode: S.optionalKey(
      runtimeFunction<(node: OfficeContentNode) => string | false | Promise<string | false | void> | void>()
    ),
    onWarning: S.optionalKey(runtimeFunction<(issue: OfficeIssue) => void>()),
    styleMap: S.optionalKey(
      S.Union([
        S.Array(S.String).pipe(S.mutable),
        S.Array(S.suspend((): typeof StructuredStyleMapping => StructuredStyleMapping)).pipe(S.mutable),
      ])
    ),
    includeFormatting: S.optionalKey(S.Boolean),
    generateIds: S.optionalKey(S.Boolean),
    renderMetadata: S.optionalKey(S.Boolean),
    metadataOverrides: S.optionalKey(MetadataOverrides),
    ignoreDefaultStyleMap: S.optionalKey(S.Boolean),
    includeImages: S.optionalKey(S.Boolean),
    includeCharts: S.optionalKey(S.Boolean),
    ignoreInternalLinks: S.optionalKey(S.Boolean),
    abortSignal: AbortSignalSchema.pipe(S.NullOr, S.optionalKey),
  },
  $I.annote("CommonGeneratorConfig", {
    description: "Parsing-independent behavior shared by every document generator.",
  })
);

/**
 * Maps a destination format to the matching generator-specific configuration.
 */
type GeneratorSpecificConfig<D extends string> = D extends "html"
  ? { readonly htmlConfig?: undefined | HtmlGeneratorConfig }
  : D extends "md"
    ? { readonly mdConfig?: undefined | MdGeneratorConfig }
    : D extends "pdf"
      ? { readonly pdfConfig?: undefined | PdfGeneratorConfig }
      : D extends "csv"
        ? { readonly csvConfig?: undefined | CsvGeneratorConfig }
        : D extends "text"
          ? { readonly textConfig?: undefined | TextGeneratorConfig }
          : D extends "rtf"
            ? { readonly rtfConfig?: undefined | RtfGeneratorConfig }
            : D extends "chunks"
              ? {
                  readonly chunksConfig?: undefined | ChunkingConfig;
                }
              : Partial<{
                  readonly htmlConfig: HtmlGeneratorConfig;
                  readonly mdConfig: MdGeneratorConfig;
                  readonly pdfConfig: PdfGeneratorConfig;
                  readonly csvConfig: CsvGeneratorConfig;
                  readonly textConfig: TextGeneratorConfig;
                  readonly rtfConfig: RtfGeneratorConfig;
                  readonly chunksConfig: ChunkingConfig;
                }>;

/**
 * Combines shared generator behavior with settings selected by the destination format.
 *
 * **Details**
 *
 * This interface is designed to be format-aware. When you specify a destination format
 * (e.g., `OfficeGenerator.generate(ast, 'html', config)`), the generic parameter `D`
 * ensures that only the relevant sub-configuration (e.g., `htmlConfig`) is available
 * for type checking.
 *
 * @typeParam D - Selects the destination-specific configuration available to callers.
 * @category configuration
 * @since 0.0.0
 */
export type GeneratorConfig<D extends string = string> = CommonGeneratorConfig & GeneratorSpecificConfig<D>;

/**
 * Combines source parsing and destination generation settings for one-step conversion.
 *
 * @typeParam D - Selects the destination-specific generator configuration.
 * @typeParam T - Restricts the source file type accepted by `parseConfig`.
 * @category configuration
 * @since 0.0.0
 */
export type OfficeConverterConfig<D extends string = string, T extends SupportedFileType = SupportedFileType> = {
  /**
   * Specific configuration for the source parsing phase.
   */
  readonly parseConfig?: undefined | (OfficeParserConfig & { readonly fileType?: undefined | T });
  /**
   * Specific configuration for the destination generation phase.
   */
  readonly generatorConfig?: undefined | GeneratorConfig<D>;
  /**
   * Callback for warnings or non-fatal errors encountered during the entire conversion process.
   * This is passed to both the parser and the generator.
   * If provided, this takes precedence over callbacks inside parseConfig or generatorConfig.
   */
  readonly onWarning?: undefined | ((issue: OfficeIssue) => void);
};

/**
 * Recursively requires object properties while preserving functions and built-in leaf types.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DeepRequired<T> = T extends Function | Date | Buffer | RegExp
  ? T
  : T extends Array<infer U>
    ? Array<DeepRequired<U>>
    : T extends object
      ? { [P in keyof T]-?: undefined | DeepRequired<T[P]> }
      : T;

/**
 * Describes generator settings after shared and destination-specific defaults have been resolved.
 *
 * **Details**
 *
 * `chunksConfig` remains a `ChunkingConfig` because its discriminated members cannot be uniformly deep-required. `metadataOverrides` also preserves optional fields so callers can replace individual metadata values.
 *
 * @category configuration
 * @since 0.0.0
 */
export type FullGeneratorConfig = DeepRequired<
  Omit<CommonGeneratorConfig, "metadataOverrides"> & {
    readonly htmlConfig: HtmlGeneratorConfig;
    readonly mdConfig: MdGeneratorConfig;
    readonly pdfConfig: PdfGeneratorConfig;
    readonly csvConfig: CsvGeneratorConfig;
    readonly textConfig: TextGeneratorConfig;
    readonly rtfConfig: RtfGeneratorConfig;
  }
> & {
  readonly chunksConfig: ChunkingConfig;
  // Deliberately not DeepRequired: every field is meant to stay optional, since the whole
  // point is overriding individual fields without having to supply the rest.
  readonly metadataOverrides: MetadataOverrides;
};

/**
 * Places caller-supplied HTML at defined points in a generated document envelope.
 *
 * @category configuration
 * @since 0.0.0
 */
interface HtmlInjectionConfigShape {
  /** Raw HTML injected immediately after the opening <head> tag */
  readonly headStart?: undefined | string;
  /** Raw HTML injected immediately before the closing </head> tag */
  readonly headEnd?: undefined | string;
  /** Raw HTML injected immediately after the opening <body> tag */
  readonly bodyStart?: undefined | string;
  /** Raw HTML injected immediately before the closing </body> tag */
  readonly bodyEnd?: undefined | string;
}

/**
 * Runtime schema for HTML envelope injection points.
 *
 * **Example** (Validate a head injection)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { HtmlInjectionConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(HtmlInjectionConfig))({ headEnd: "<style></style>" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlInjectionConfig = S.Class<HtmlInjectionConfigShape>($I`HtmlInjectionConfig`)(
  {
    headStart: S.optionalKey(S.String),
    headEnd: S.optionalKey(S.String),
    bodyStart: S.optionalKey(S.String),
    bodyEnd: S.optionalKey(S.String),
  },
  $I.annote("HtmlInjectionConfig", {
    description: "Caller-supplied HTML placed at defined document-envelope points.",
  })
);

/**
 * Selects which parts of a complete HTML document surround generated content.
 *
 * **Details**
 *
 * Boolean `true` enables the full document envelope, while `false` emits only the content fragment. In object form, omitted fields keep their standalone defaults.
 *
 * @category configuration
 * @since 0.0.0
 */
interface StandaloneConfigShape {
  /**
   * Wrap the output in `<!DOCTYPE html><html><head>…</head><body>…</body></html>`.
   * When false, only the inner content fragment is emitted. Defaults to true.
   */
  readonly document?: undefined | boolean;
  /**
   * Emit `<title>` and `<meta>` tags (author, description, dates, custom properties) in the head.
   * Only meaningful when `document` is true. Defaults to true.
   */
  readonly metaTags?: undefined | boolean;
  /**
   * How the library's built-in CSS is delivered:
   * - `'full'`: the complete built-in stylesheet using global selectors (`body`, `h1`, `table`, etc.).
   *   This is what `standalone: true` has always emitted.
   * - `'scoped'`: the same styling, scoped under the fragment's container via CSS `@scope` so it
   *   cannot leak into a host page's own styles. Requires a modern browser engine (Chrome 118+,
   *   Safari 17.4+, Firefox 128+).
   * - `'none'`: no stylesheet is emitted; the host page, EPUB reader, or rich-text editor
   *   supplies its own styling.
   * The boolean shorthand for `standalone` maps `true` → `'full'`, `false` → `'none'`.
   * Defaults to `'full'`.
   */
  readonly styles?: undefined | "full" | "scoped" | "none";
  /**
   * Emit injected `<script>` tags: the Chart.js loader (when `includeCharts` is true and charts
   * are present) and the spreadsheet interactivity script. Defaults to true.
   */
  readonly scripts?: undefined | boolean;
  /**
   * Apply `injections.headStart` / `injections.headEnd`. Only meaningful when `document` is true
   * (there is no `<head>` to inject into otherwise). Defaults to true.
   */
  readonly headInjections?: undefined | boolean;
  /**
   * Apply `injections.bodyStart` / `injections.bodyEnd`. Applies even when generating a bare
   * fragment (`document: false`), since these wrap body *content*, not the document shell.
   * Defaults to true.
   */
  readonly bodyInjections?: undefined | boolean;
}

/**
 * Runtime schema for granular standalone HTML output settings.
 *
 * **Example** (Validate a fragment configuration)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { StandaloneConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(StandaloneConfig))({ document: false, styles: "scoped" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const StandaloneConfig = S.Class<StandaloneConfigShape>($I`StandaloneConfig`)(
  {
    document: S.optionalKey(S.Boolean),
    metaTags: S.optionalKey(S.Boolean),
    styles: StandaloneStyleMode.pipe(S.optionalKey),
    scripts: S.optionalKey(S.Boolean),
    headInjections: S.optionalKey(S.Boolean),
    bodyInjections: S.optionalKey(S.Boolean),
  },
  $I.annote("StandaloneConfig", {
    description: "Parts of a complete HTML document that surround generated content.",
  })
);

/**
 * Controls HTML document wrapping, assets, layout, and embed handling.
 *
 * @category configuration
 * @since 0.0.0
 */
interface HtmlGeneratorConfigShape {
  /**
   * Whether to wrap the output in a full HTML document structure (e.g., <html>, <head>, etc.).
   * Pass an object instead of a boolean for granular control over individual parts of the
   * envelope (document shell, meta tags, styles, scripts, injections) - see `StandaloneConfig`.
   * Defaults to true.
   */
  readonly standalone?: undefined | boolean | StandaloneConfig;
  /**
   * URL for the Chart.js library to use when 'includeCharts' is true.
   * Defaults to 'https://cdn.jsdelivr.net/npm/chart.js'.
   */
  readonly chartJsSrc?: undefined | string;
  /**
   * Custom container width for the generated HTML.
   * Can be a number (pixels) or string (e.g., '900px', '100%').
   * If not specified or set to 'auto', it defaults based on the content type:
   * - Spreadsheet: '100%'
   * - Presentation/Slides: '1100px'
   * - Standard Document (PDF/DOCX/RTF/etc.): '900px'
   */
  readonly containerWidth?: undefined | string | number;
  /**
   * Custom CSS to append to the generated HTML document.
   * This CSS will be included in the `<style>` block and can be used to style
   * custom classes added during AST manipulation or override default styles.
   */
  readonly customCss?: undefined | string;
  /**
   * Granular injection points for custom HTML, scripts, and styles.
   */
  readonly injections?: undefined | HtmlInjectionConfig;
  /**
   * Carry each rich node's raw source in a `data-*` attribute, with undelimited text content,
   * so attribute-driven structured consumers (rich-text editors, custom viewers) can rehydrate
   * the node from the markup rather than re-parsing the display text. Affects wikilinks
   * (adds `data-wikilink`/`data-target`/`data-alias`), citations (a `<span class="citation">`
   * carrying `data-key` instead of `<cite>`), math (the LaTeX in `data-math`, undelimited) and
   * mermaid (a `<div class="mermaid" data-mermaid>` instead of `<pre><code>`).
   *
   * **Details**
   *
   * Off by default; the default output is byte-identical to previous releases. The widened
   * `HtmlParser` reads every shape this emits, so output stays self-round-trippable.
   */
  readonly sourceAttributes?: undefined | boolean;
  /**
   * Emit a generic (non-YouTube) iframe embed as a gated placeholder,
   * `<div data-embed-gated data-embed-src="…" …>`, instead of a live `<iframe>`. The gated shape
   * never auto-loads its src: an editor renders a click-to-load placeholder from it, and
   * `HtmlParser` reads it back to the same `embed` node. The src is scheme-checked (`sanitizeUrl`)
   * on emit. Off by default; the default output (a live `<iframe>`) is unchanged. YouTube embeds
   * are unaffected (they already render from a validated id).
   */
  readonly gatedEmbeds?: undefined | boolean;
}

/**
 * Runtime schema for HTML generator settings.
 *
 * **Example** (Validate HTML output settings)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { HtmlGeneratorConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(HtmlGeneratorConfig))({ standalone: true, gatedEmbeds: true })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlGeneratorConfig = S.Class<HtmlGeneratorConfigShape>($I`HtmlGeneratorConfig`)(
  {
    standalone: S.optionalKey(S.Union([S.Boolean, StandaloneConfig])),
    chartJsSrc: S.optionalKey(S.String),
    containerWidth: S.optionalKey(S.Union([S.String, S.Finite])),
    customCss: S.optionalKey(S.String),
    injections: S.optionalKey(HtmlInjectionConfig),
    sourceAttributes: S.optionalKey(S.Boolean),
    gatedEmbeds: S.optionalKey(S.Boolean),
  },
  $I.annote("HtmlGeneratorConfig", {
    description: "HTML document wrapping, assets, layout, and embed handling settings.",
  })
);

/**
 * Controls page layout, browser launch settings, and rendering timeouts for PDF output.
 *
 * @category configuration
 * @since 0.0.0
 */
interface PdfGeneratorConfigShape {
  /** Paper format. Defaults to 'A4'. */
  readonly format?:
    | undefined
    | "letter"
    | "legal"
    | "tabloid"
    | "ledger"
    | "a0"
    | "a1"
    | "a2"
    | "a3"
    | "a4"
    | "a5"
    | "a6"
    | "Letter"
    | "Legal"
    | "Tabloid"
    | "Ledger"
    | "A0"
    | "A1"
    | "A2"
    | "A3"
    | "A4"
    | "A5"
    | "A6";
  /** Paper width, accepts values labeled with units (e.g., '5in', '3cm') or numbers (in pixels). */
  readonly width?: undefined | string | number;
  /** Paper height, accepts values labeled with units (e.g., '5in', '3cm') or numbers (in pixels). */
  readonly height?: undefined | string | number;
  /** Whether to print in landscape orientation. Defaults to false. */
  readonly landscape?: undefined | boolean;
  /** Whether to print background graphics. Defaults to true. */
  readonly printBackground?: undefined | boolean;
  /** Scale of the webpage rendering. Defaults to 1. */
  readonly scale?: undefined | number;
  /** Paper margins. */
  readonly margin?:
    | undefined
    | {
        readonly top?: undefined | string | number;
        readonly right?: undefined | string | number;
        readonly bottom?: undefined | string | number;
        readonly left?: undefined | string | number;
      };
  /** Whether to display header and footer. Defaults to false. */
  readonly displayHeaderFooter?: undefined | boolean;
  /** HTML template for the print header. */
  readonly headerTemplate?: undefined | string;
  /** HTML template for the print footer. */
  readonly footerTemplate?: undefined | string;
  /**
   * Optional Puppeteer launch options for Node.js environment.
   * Useful for setting custom executable paths or args in CI/CD.
   */
  readonly launchOptions?: undefined | unknown;
  /**
   * Timeout in milliseconds for PDF generation.
   * Limits the time spent waiting for Puppeteer to launch, load content, and render PDF.
   * Defaults to 30000 ms (30 seconds). Set to 0 to disable.
   */
  readonly timeout?: undefined | number;
}

const PdfMargin = S.Class<PdfMargin>($I`PdfMargin`)(
  {
    top: S.optionalKey(S.Union([S.String, S.Finite])),
    right: S.optionalKey(S.Union([S.String, S.Finite])),
    bottom: S.optionalKey(S.Union([S.String, S.Finite])),
    left: S.optionalKey(S.Union([S.String, S.Finite])),
  },
  $I.annote("PdfMargin", {
    description: "Optional top, right, bottom, and left PDF page margins.",
  })
);
interface PdfMargin {
  readonly top?: undefined | string | number;
  readonly right?: undefined | string | number;
  readonly bottom?: undefined | string | number;
  readonly left?: undefined | string | number;
}

const PdfPaperFormat = LiteralKit([
  "letter", "legal", "tabloid", "ledger", "a0", "a1", "a2", "a3", "a4", "a5", "a6",
  "Letter", "Legal", "Tabloid", "Ledger", "A0", "A1", "A2", "A3", "A4", "A5", "A6",
]).pipe(
  $I.annoteSchema("PdfPaperFormat", {
    description: "Named paper formats accepted by the PDF generator.",
  })
);

/**
 * Runtime schema for PDF rendering settings.
 *
 * **Example** (Validate PDF page settings)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PdfGeneratorConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(PdfGeneratorConfig))({ format: "A4", landscape: true })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PdfGeneratorConfig = S.Class<PdfGeneratorConfigShape>($I`PdfGeneratorConfig`)(
  {
    format: S.optionalKey(PdfPaperFormat),
    width: S.optionalKey(S.Union([S.String, S.Finite])),
    height: S.optionalKey(S.Union([S.String, S.Finite])),
    landscape: S.optionalKey(S.Boolean),
    printBackground: S.optionalKey(S.Boolean),
    scale: S.optionalKey(PdfScale),
    margin: S.optionalKey(PdfMargin),
    displayHeaderFooter: S.optionalKey(S.Boolean),
    headerTemplate: S.optionalKey(S.String),
    footerTemplate: S.optionalKey(S.String),
    launchOptions: S.optionalKey(S.Unknown),
    timeout: S.optionalKey(NonNegativeInt),
  },
  $I.annote("PdfGeneratorConfig", {
    description: "PDF page layout, browser launch, and rendering timeout settings.",
  })
);

/**
 * Maps parsed node selectors to generated tags, classes, attributes, and freshness behavior.
 *
 * **Details**
 *
 * Office documents often use custom or localized style names. Mapping those names to semantic
 * tags lets each generator choose its native representation. For example, `blockquote` becomes
 * an HTML element, a Markdown `>` prefix, or structural indentation in plain text.
 *
 * @category configuration
 * @since 0.0.0
 */
interface StructuredStyleMappingShape {
  /**
   * The criteria used to identify which AST nodes should be transformed.
   * Think of this as the "Source Filter".
   */
  readonly selector: {
    /**
     * The structural type of the node (e.g., 'paragraph', 'heading', 'text').
     * Most style mappings target 'paragraph' nodes to convert them into headers or blocks.
     */
    readonly nodeType?: undefined | OfficeContentNodeType;
    /**
     * A dictionary of attributes to match on the node.
     *
     * **Details**
     *
     * The most common use case is matching the 'style' attribute from
     * Word documents (e.g., { style: 'Intense Quote' }).
     *
     * Matchers:
     * - Literal: `style: 'Heading 1'` matches exactly.
     * - Operator: `{ value: 'Title', operator: '~=' }` matches if the word 'Title'
     *   is found within the style name.
     */
    readonly attributes?:
      | undefined
      | Record<
          string,
          | string
          | number
          | boolean
          | {
              readonly value: string | number | boolean;
              readonly operator: "=" | "~=";
            }
        >;
  };
  /**
   * The target representation for the matched node.
   * Think of this as the "Semantic Meaning" you want to assign to the match.
   */
  readonly output: {
    /**
     * The universal semantic tag (e.g., 'h1', 'h2', 'blockquote', 'code', 'pre', 'u').
     * All generators use this tag to decide their native output syntax.
     */
    readonly tag: string;
    /**
     * CSS classes to apply to the output.
     * This is utilized by the HTML generator to allow for downstream CSS styling.
     */
    readonly classes?: undefined | string[];
    /**
     * Key-value pair of HTML attributes (like 'id', 'data-*', or 'style') to apply.
     * Primarily used by the HTML generator for high-fidelity conversion.
     */
    readonly attributes?: undefined | Record<string, string>;
    /**
     * If true, prevents the generator from collapsing this element into
     * adjacent elements of the same type.
     *
     * **Details**
     *
     * For example, multiple paragraphs mapped to 'blockquote' normally merge into
     * one big blockquote. Setting `fresh: true` forces them to be separate blocks.
     */
    readonly fresh?: undefined | boolean;
  };
}

const StructuredStyleAttributeMatcher = S.Class<StructuredStyleAttributeMatcher>($I`StructuredStyleAttributeMatcher`)(
  {
    value: S.Union([S.String, S.Finite, S.Boolean]),
    operator: StructuredStyleOperator,
  },
  $I.annote("StructuredStyleAttributeMatcher", {
    description: "Value and equality operator used by a structured style selector.",
  })
);
interface StructuredStyleAttributeMatcher {
  readonly value: string | number | boolean;
  readonly operator: "=" | "~=";
}

const StructuredStyleSelector = S.Class<StructuredStyleSelector>($I`StructuredStyleSelector`)(
  {
    nodeType: S.suspend((): typeof OfficeContentNodeType => OfficeContentNodeType).pipe(S.optionalKey),
    attributes: S.optionalKey(
      S.Record(
        S.String,
        S.Union([S.String, S.Finite, S.Boolean, StructuredStyleAttributeMatcher])
      )
    ),
  },
  $I.annote("StructuredStyleSelector", {
    description: "Node type and attribute criteria for a structured style mapping.",
  })
);
interface StructuredStyleSelector {
  readonly nodeType?: undefined | OfficeContentNodeType;
  readonly attributes?:
    | undefined
    | Record<string, string | number | boolean | StructuredStyleAttributeMatcher>;
}

const StructuredStyleOutput = S.Class<StructuredStyleOutput>($I`StructuredStyleOutput`)(
  {
    tag: S.String,
    classes: S.Array(S.String).pipe(S.mutable, S.optionalKey),
    attributes: S.optionalKey(S.Record(S.String, S.String)),
    fresh: S.optionalKey(S.Boolean),
  },
  $I.annote("StructuredStyleOutput", {
    description: "Generated tag, classes, attributes, and freshness behavior for a style mapping.",
  })
);
interface StructuredStyleOutput {
  readonly tag: string;
  readonly classes?: undefined | string[];
  readonly attributes?: undefined | Record<string, string>;
  readonly fresh?: undefined | boolean;
}

/**
 * Runtime schema for a structured style mapping.
 *
 * **Example** (Validate a heading mapping)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { StructuredStyleMapping } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(StructuredStyleMapping))({ selector: { nodeType: "paragraph" }, output: { tag: "h1" } })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const StructuredStyleMapping = S.Class<StructuredStyleMappingShape>($I`StructuredStyleMapping`)(
  {
    selector: StructuredStyleSelector,
    output: StructuredStyleOutput,
  },
  $I.annote("StructuredStyleMapping", {
    description: "Parsed node selector mapped to generated tag, class, attribute, and freshness behavior.",
  })
);

/**
 * Reserves destination-specific settings for RTF output.
 *
 * @category configuration
 * @since 0.0.0
 */
interface RtfGeneratorConfigShape {
  // Reserved for future RTF-specific options like page size or font embedding
}

/**
 * Runtime schema for the currently empty RTF-specific configuration.
 *
 * **Example** (Validate default RTF settings)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RtfGeneratorConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(RtfGeneratorConfig))({})) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RtfGeneratorConfig = S.Class<RtfGeneratorConfigShape>($I`RtfGeneratorConfig`)(
  {},
  $I.annote("RtfGeneratorConfig", {
    description: "Reserved destination-specific settings for RTF output.",
  })
);

/**
 * Controls sheet selection, sheet merging, and delimiters for CSV output.
 *
 * @category configuration
 * @since 0.0.0
 */
interface CsvGeneratorConfigShape {
  /**
   * Range of sheets to export.
   * Supports formats like "1", "1-3", "1,2", "1,3-5,7".
   * 1-based indexing.
   * Default is '' (all sheets).
   */
  readonly sheets?: undefined | string;
  /**
   * Whether to merge all selected sheets into a single CSV.
   * If false, returns a ZIP archive containing individual CSV files.
   * Defaults to true.
   */
  readonly mergeSheets?: undefined | boolean;
  /**
   * Custom delimiter for CSV files.
   * Defaults to ','.
   */
  readonly columnDelimiter?: undefined | string;
}

/**
 * Runtime schema for CSV generator settings.
 *
 * **Example** (Validate CSV sheet settings)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CsvGeneratorConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(CsvGeneratorConfig))({ sheets: "1-3", mergeSheets: true })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvGeneratorConfig = S.Class<CsvGeneratorConfigShape>($I`CsvGeneratorConfig`)(
  {
    sheets: S.optionalKey(S.String),
    mergeSheets: S.optionalKey(S.Boolean),
    columnDelimiter: S.optionalKey(S.String),
  },
  $I.annote("CsvGeneratorConfig", {
    description: "CSV sheet selection, merging, and delimiter settings.",
  })
);

/**
 * Selects a named group of Markdown syntax choices for generation.
 *
 * **Details**
 *
 * The `extended` preset preserves the library's historical output with all supported extensions enabled and GitHub-style admonitions.
 *
 * **Example** (Guard a GitHub preset)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { MarkdownDialectPreset } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(MarkdownDialectPreset)("github")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MarkdownDialectPreset = LiteralKit(["extended", "github", "gitlab", "obsidian", "pandoc", "commonmark"]).pipe(
  $I.annoteSchema("MarkdownDialectPreset", {
    description: "Named groups of Markdown syntax choices for generation.",
  })
);

/**
 * Decoded preset member of {@link MarkdownDialectPreset}.
 *
 * @see {@link MarkdownDialectPreset} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownDialectPreset = typeof MarkdownDialectPreset.Type;

/*
 * Per-capability syntax variants for `MarkdownDialectConfig`. Each is named for the *syntax* it
 * selects, never for a product, so a convention shared by several flavors is a single value and a
 * preset simply points at it (e.g. both the `obsidian` and `extended` presets select `'equals'`
 * highlight). `'none'` is the explicit off switch, mirroring `math`'s existing `'dollar' | 'none'`;
 * `undefined`/omitted means "inherit from the `extends` preset", never "off". Modelling these as
 * unions rather than booleans lets a second syntax be added later without a breaking change.
 */

/**
 * Selects the Markdown carrier used for admonitions.
 *
 * **Details**
 *
 * `blockquote` uses GitHub's `> [!NOTE]`, `fence` uses GitLab's `:::note`, `fence-attribute` uses Pandoc's `::: {.note}`, and `none` emits a plain labeled blockquote.
 *
 * **Example** (Guard blockquote admonitions)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AdmonitionSyntax } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(AdmonitionSyntax)("blockquote")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AdmonitionSyntax = LiteralKit(["blockquote", "fence", "fence-attribute", "none"]).pipe(
  $I.annoteSchema("AdmonitionSyntax", { description: "Markdown carriers available for admonitions." })
);
/**
 * Decoded syntax member of {@link AdmonitionSyntax}.
 *
 * @see {@link AdmonitionSyntax} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type AdmonitionSyntax = typeof AdmonitionSyntax.Type;
/**
 * Selects `==text==` highlighting or disables highlight syntax.
 *
 * **Example** (Guard equals highlighting)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { HighlightSyntax } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(HighlightSyntax)("equals")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HighlightSyntax = LiteralKit(["equals", "none"]).pipe(
  $I.annoteSchema("HighlightSyntax", { description: "Markdown highlight syntax selection." })
);
/**
 * Decoded syntax member of {@link HighlightSyntax}.
 *
 * @see {@link HighlightSyntax} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type HighlightSyntax = typeof HighlightSyntax.Type;
/**
 * Selects GFM `~~text~~` strikethrough or disables strikethrough syntax.
 *
 * **Example** (Guard tilde strikethrough)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { StrikethroughSyntax } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(StrikethroughSyntax)("tilde")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const StrikethroughSyntax = LiteralKit(["tilde", "none"]).pipe(
  $I.annoteSchema("StrikethroughSyntax", { description: "Markdown strikethrough syntax selection." })
);
/**
 * Decoded syntax member of {@link StrikethroughSyntax}.
 *
 * @see {@link StrikethroughSyntax} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type StrikethroughSyntax = typeof StrikethroughSyntax.Type;
/**
 * Selects colon-based definition lists or disables definition-list syntax.
 *
 * **Example** (Guard colon definition lists)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DefinitionListSyntax } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(DefinitionListSyntax)("colon")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DefinitionListSyntax = LiteralKit(["colon", "none"]).pipe(
  $I.annoteSchema("DefinitionListSyntax", { description: "Markdown definition-list syntax selection." })
);
/**
 * Decoded syntax member of {@link DefinitionListSyntax}.
 *
 * @see {@link DefinitionListSyntax} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type DefinitionListSyntax = typeof DefinitionListSyntax.Type;
/**
 * Selects caret-based `[^id]` footnotes or disables footnote syntax.
 *
 * **Example** (Guard caret footnotes)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FootnoteSyntax } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(FootnoteSyntax)("caret")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FootnoteSyntax = LiteralKit(["caret", "none"]).pipe(
  $I.annoteSchema("FootnoteSyntax", { description: "Markdown footnote syntax selection." })
);
/**
 * Decoded syntax member of {@link FootnoteSyntax}.
 *
 * @see {@link FootnoteSyntax} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type FootnoteSyntax = typeof FootnoteSyntax.Type;
/**
 * Selects Pandoc-style at-citekey citations (`[@` + `citekey]`) or disables citation syntax.
 *
 * **Example** (Guard at-sign citations)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CitationSyntax } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(CitationSyntax)("at")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CitationSyntax = LiteralKit(["at", "none"]).pipe(
  $I.annoteSchema("CitationSyntax", { description: "Markdown citation syntax selection." })
);
/**
 * Decoded syntax member of {@link CitationSyntax}.
 *
 * @see {@link CitationSyntax} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type CitationSyntax = typeof CitationSyntax.Type;
/**
 * Selects `[[Page]]` wikilinks or disables wikilink syntax.
 *
 * **Example** (Guard double-bracket wikilinks)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { WikilinkSyntax } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(WikilinkSyntax)("double-bracket")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WikilinkSyntax = LiteralKit(["double-bracket", "none"]).pipe(
  $I.annoteSchema("WikilinkSyntax", { description: "Markdown wikilink syntax selection." })
);
/**
 * Decoded syntax member of {@link WikilinkSyntax}.
 *
 * @see {@link WikilinkSyntax} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type WikilinkSyntax = typeof WikilinkSyntax.Type;
/**
 * Selects brace-delimited attribute lists or disables attribute-list syntax.
 *
 * **Example** (Guard brace attribute lists)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AttributeListSyntax } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(AttributeListSyntax)("brace")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AttributeListSyntax = LiteralKit(["brace", "none"]).pipe(
  $I.annoteSchema("AttributeListSyntax", { description: "Markdown attribute-list syntax selection." })
);
/**
 * Decoded syntax member of {@link AttributeListSyntax}.
 *
 * @see {@link AttributeListSyntax} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type AttributeListSyntax = typeof AttributeListSyntax.Type;
/**
 * Selects how embedded media nodes are written to Markdown.
 *
 * **Details**
 *
 * `html` preserves the historical `<div>` or `<iframe>` output. `directive` emits remark-directive leaves for compatible editors. `link` emits a plain media link. `thumbnail` emits a linked YouTube preview and falls back to a link for other providers.
 *
 * **Example** (Guard directive embeds)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { EmbedSyntax } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(EmbedSyntax)("directive")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EmbedSyntax = LiteralKit(["html", "directive", "link", "thumbnail"]).pipe(
  $I.annoteSchema("EmbedSyntax", { description: "Markdown representation used for embedded media nodes." })
);
/**
 * Decoded syntax member of {@link EmbedSyntax}.
 *
 * @see {@link EmbedSyntax} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type EmbedSyntax = typeof EmbedSyntax.Type;

const MathSyntax = LiteralKit(["dollar", "none"]).pipe(
  $I.annoteSchema("MathSyntax", { description: "Markdown math syntax selection." })
);

const BulletListMarker = LiteralKit(["-", "*", "+"]).pipe(
  $I.annoteSchema("BulletListMarker", { description: "Marker used for unordered Markdown list items." })
);

const OrderedListMarker = LiteralKit([".", ")"]).pipe(
  $I.annoteSchema("OrderedListMarker", { description: "Suffix used after ordered Markdown list numbers." })
);

const EmphasisMarker = LiteralKit(["asterisk", "underscore"]).pipe(
  $I.annoteSchema("EmphasisMarker", { description: "Delimiter family used for Markdown emphasis." })
);

const MarkdownTableSyntax = LiteralKit(["native", "html"]).pipe(
  $I.annoteSchema("MarkdownTableSyntax", { description: "Markdown table representation selection." })
);

const HorizontalAlignment = LiteralKit(["left", "center", "right"]).pipe(
  $I.annoteSchema("HorizontalAlignment", { description: "Horizontal layout alignment." })
);

const DocumentSplitBoundary = LiteralKit(["page", "slide", "sheet", "heading", "paragraph"]).pipe(
  $I.annoteSchema("DocumentSplitBoundary", { description: "Source structure used as a chunk boundary." })
);

const TableSplitStrategy = LiteralKit(["row", "flatten"]).pipe(
  $I.annoteSchema("TableSplitStrategy", { description: "Strategy used to split table content across chunks." })
);

const ListType = LiteralKit(["ordered", "unordered"]).pipe(
  $I.annoteSchema("ListType", { description: "Ordered or unordered list classification." })
);

const EmbedType = LiteralKit(["youtube", "iframe"]).pipe(
  $I.annoteSchema("EmbedType", { description: "Recognized embedded-media provider family." })
);

const AdmonitionType = LiteralKit(["note", "tip", "important", "warning", "caution"]).pipe(
  $I.annoteSchema("AdmonitionType", { description: "Semantic admonition category." })
);

const AdmonitionSourceSyntax = LiteralKit(["github", "gitlab"]).pipe(
  $I.annoteSchema("AdmonitionSourceSyntax", { description: "Markdown syntax family that produced an admonition." })
);

const LinkType = LiteralKit(["internal", "external"]).pipe(
  $I.annoteSchema("LinkType", { description: "Internal or external text-link destination." })
);

const NoteType = LiteralKit(["footnote", "endnote"]).pipe(
  $I.annoteSchema("NoteType", { description: "Footnote or endnote classification." })
);

const BreakType = LiteralKit(["column", "page", "lastRenderedPage", "textWrapping", "carriageReturn", "thematic"]).pipe(
  $I.annoteSchema("BreakType", { description: "Document break classification." })
);

const BreakClear = LiteralKit(["all", "left", "none", "right"]).pipe(
  $I.annoteSchema("BreakClear", { description: "Float-clearing behavior attached to a document break." })
);

const MathDisplayMode = LiteralKit(["inline", "block"]).pipe(
  $I.annoteSchema("MathDisplayMode", { description: "Inline or block mathematical display mode." })
);

const OfficeAttachmentType = LiteralKit(["image", "chart"]).pipe(
  $I.annoteSchema("OfficeAttachmentType", { description: "Extracted attachment content category." })
);

/**
 * Selects Markdown syntax for features whose representation differs across dialects.
 *
 * **Details**
 *
 * A preset string selects a named target. Object form overrides individual features and inherits omitted fields from `extends`, which defaults to `extended`.
 *
 * @category configuration
 * @since 0.0.0
 */
interface MarkdownDialectConfigShape {
  /** Base preset any omitted field inherits from. Defaults to 'extended'. */
  readonly extends?: undefined | MarkdownDialectPreset;
  /**
   * Admonition syntax: `'blockquote'` = GitHub `> [!NOTE]`, `'fence'` = GitLab `:::note`,
   * `'fence-attribute'` = Pandoc `::: {.note}`, `'none'` = a plain bold-labeled blockquote with no
   * special marker. Omit to inherit from the `extends` preset. The legacy flavor names
   * `'github'`/`'gitlab'`/`'pandoc'` are accepted as deprecated aliases (see
   * `DeprecatedAdmonitionFlavor`) and will be removed in the next major version.
   */
  readonly admonitions?: undefined | AdmonitionSyntax;
  /**
   * Markdown Extra/Pandoc-style `Term`/`: Description` definition lists (`'colon'`), or `'none'`
   * to render terms and descriptions as plain paragraphs. Omit to inherit from `extends`. Passing
   * a boolean is deprecated: `true` = `'colon'`, `false` = `'none'` (removed next major).
   */
  readonly definitionLists?: undefined | DefinitionListSyntax;
  /**
   * `[^id]` footnote references/definitions (`'caret'`), or `'none'` to inline note content as a
   * parenthetical right at the reference point. Omit to inherit from `extends`. Passing a boolean
   * is deprecated: `true` = `'caret'`, `false` = `'none'` (removed next major).
   */
  readonly footnotes?: undefined | FootnoteSyntax;
  /**
   * Pandoc-style at-citekey citations (`[@` + `citekey]`, `'at'`), or `'none'` to emit
   * `[citekey]` without the at-sign. Omit to inherit from `extends`. Passing a boolean is
   * deprecated: `true` = `'at'`, `false` = `'none'` (removed next major).
   */
  readonly citations?: undefined | CitationSyntax;
  /**
   * Obsidian-style `[[Page]]`/`[[Page|Alias]]` wikilinks (`'double-bracket'`), or `'none'` to fall
   * back to a plain `[text](url)` link using the same target. Omit to inherit from `extends`.
   * Passing a boolean is deprecated: `true` = `'double-bracket'`, `false` = `'none'` (removed next major).
   */
  readonly wikilinks?: undefined | WikilinkSyntax;
  /** Inline `$...$`/block `$$...$$` math delimiters (`'dollar'`), or `'none'` for bare LaTeX text. */
  readonly math?: undefined | "dollar" | "none";
  /**
   * Pandoc-style `{width=50% .centered}` attribute lists after images/tables (`'brace'`), or
   * `'none'`. Omit to inherit from `extends`. Passing a boolean is deprecated: `true` = `'brace'`,
   * `false` = `'none'` (removed next major).
   */
  readonly attributeLists?: undefined | AttributeListSyntax;
  /**
   * GFM `~~text~~` strikethrough (`'tilde'`; not part of base CommonMark), or `'none'`. Omit to
   * inherit from `extends`. Passing a boolean is deprecated: `true` = `'tilde'`, `false` = `'none'`
   * (removed next major).
   */
  readonly strikethrough?: undefined | StrikethroughSyntax;
  /**
   * `==text==` highlight (`'equals'`; Obsidian/extended flavors, NOT GFM or CommonMark where `==`
   * is literal text), or `'none'`. When `'equals'`, a highlighted run round-trips as `==text==`
   * and `==text==` is read back as a highlight; when `'none'`, a highlight falls back to an HTML
   * `<mark>`/`<span>` per `fallbackToHtml.inlineFormatting`, and `==text==` stays literal on parse.
   * Omit to inherit from `extends`.
   */
  readonly highlight?: undefined | HighlightSyntax;
  /** Unordered list bullet character. */
  readonly bulletListMarker?: undefined | "-" | "*" | "+";
  /** Ordered list marker punctuation. */
  readonly orderedListMarker?: undefined | "." | ")";
  /** Emphasis delimiter style for bold/italic. */
  readonly emphasisMarker?: undefined | "asterisk" | "underscore";
  /** Table syntax: native GFM pipe tables, or forced HTML `<table>` (required for strict
   *  CommonMark, which has no table syntax of its own). */
  readonly tables?: undefined | "native" | "html";
  /**
   * How an `embed` node is written to Markdown (`'html'` | `'directive'` | `'link'` |
   * `'thumbnail'`; see `EmbedSyntax`). This is the authority for embed form. When omitted, the
   * deprecated `fallbackToHtml.embeds` boolean is honored (`true`/unset maps to `'html'`, `false`
   * to `'link'`), then the default `'html'`.
   */
  readonly embeds?: undefined | EmbedSyntax;
}

/**
 * Runtime schema for per-capability Markdown dialect choices.
 *
 * **Example** (Validate a GitHub-derived dialect)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { MarkdownDialectConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(MarkdownDialectConfig))({ extends: "github", footnotes: "caret" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MarkdownDialectConfig = S.Class<MarkdownDialectConfigShape>($I`MarkdownDialectConfig`)(
  {
    extends: MarkdownDialectPreset.pipe(S.optionalKey),
    admonitions: AdmonitionSyntax.pipe(S.optionalKey),
    definitionLists: DefinitionListSyntax.pipe(S.optionalKey),
    footnotes: FootnoteSyntax.pipe(S.optionalKey),
    citations: CitationSyntax.pipe(S.optionalKey),
    wikilinks: WikilinkSyntax.pipe(S.optionalKey),
    math: MathSyntax.pipe(S.optionalKey),
    attributeLists: AttributeListSyntax.pipe(S.optionalKey),
    strikethrough: StrikethroughSyntax.pipe(S.optionalKey),
    highlight: HighlightSyntax.pipe(S.optionalKey),
    bulletListMarker: BulletListMarker.pipe(S.optionalKey),
    orderedListMarker: OrderedListMarker.pipe(S.optionalKey),
    emphasisMarker: EmphasisMarker.pipe(S.optionalKey),
    tables: MarkdownTableSyntax.pipe(S.optionalKey),
    embeds: EmbedSyntax.pipe(S.optionalKey),
  },
  $I.annote("MarkdownDialectConfig", {
    description: "Markdown syntax choices whose representation differs across dialects.",
  })
);

/**
 * Selects which unsupported Markdown features may fall back to raw HTML.
 *
 * **Details**
 *
 * Boolean form toggles every fallback through `MdGeneratorConfig.fallbackToHtml`. Object form controls them independently, and omitted fields remain enabled.
 *
 * @category configuration
 * @since 0.0.0
 */
interface FallbackToHtmlConfigShape {
  /** Underline/subscript/superscript via `<u>`/`<sub>`/`<sup>`. */
  readonly textFormatting?: undefined | boolean;
  /** Heading/paragraph text alignment via `<div style="text-align:...">`. */
  readonly alignment?: undefined | boolean;
  /** Internal-link/heading `<a id>`/`<a name>` anchor tags. */
  readonly anchors?: undefined | boolean;
  /** Nested-table and merged-cell (colspan/rowspan) HTML `<table>` fallback. */
  readonly tables?: undefined | boolean;
  /** Multi-line table cell content joined with `<br>` instead of a space. */
  readonly cellLineBreaks?: undefined | boolean;
  /**
   * Multi-paragraph list-item content (an HTML `<li>` with several `<p>` children) joined with
   * `<br>` instead of a space, so it stays on the item's single Markdown line. Block children of
   * an item (a code fence or table inside `<li>`) degrade under this join, the same way they do
   * inside a table cell under `cellLineBreaks`.
   */
  readonly itemLineBreaks?: undefined | boolean;
  /**
   * Inline text color, highlight, and font size via a `<span style="color:...;background-color:...;
   * font-size:...">` run, which the Markdown parser reads back. These have no Markdown syntax and
   * are silently lost otherwise. Unlike the other fields this is **off by default even when
   * `fallbackToHtml` is `true`**, because it changes default output; enable it explicitly with
   * `fallbackToHtml: { inlineFormatting: true }`.
   */
  readonly inlineFormatting?: undefined | boolean;
}

/**
 * Runtime schema for unsupported-Markdown HTML fallbacks.
 *
 * **Example** (Validate granular fallbacks)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FallbackToHtmlConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(FallbackToHtmlConfig))({ tables: true, inlineFormatting: false })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FallbackToHtmlConfig = S.Class<FallbackToHtmlConfigShape>($I`FallbackToHtmlConfig`)(
  {
    textFormatting: S.optionalKey(S.Boolean),
    alignment: S.optionalKey(S.Boolean),
    anchors: S.optionalKey(S.Boolean),
    tables: S.optionalKey(S.Boolean),
    cellLineBreaks: S.optionalKey(S.Boolean),
    itemLineBreaks: S.optionalKey(S.Boolean),
    inlineFormatting: S.optionalKey(S.Boolean),
  },
  $I.annote("FallbackToHtmlConfig", {
    description: "Unsupported Markdown features allowed to fall back to raw HTML.",
  })
);

/**
 * Controls Markdown dialect selection and raw-HTML fallbacks.
 *
 * @category configuration
 * @since 0.0.0
 */
interface MdGeneratorConfigShape {
  /**
   * Whether to fallback to HTML tags for features not supported by standard Markdown.
   * Pass an object instead of a boolean for granular control over individual parts (text
   * formatting, alignment, anchors, tables, embeds, cell line breaks) - see
   * `FallbackToHtmlConfig`. Omitted object fields default to on, matching `true`.
   *
   * **Details**
   *
   * Markdown has limited support for complex document structures. This flag controls how
   * the generator handles features that cannot be represented in pure Markdown:
   *
   * 1. If a feature is NOT supported natively by Markdown (e.g., nested tables, text alignment,
   *    underline, subscript/superscript):
   *    - If true: The generator will use HTML tags (<u>, <sub>, <div>, <table>, etc.) to
   *      maintain high fidelity.
   *    - If false: The generator will skip or simplify the feature (e.g., ignoring alignment,
   *      skipping underline, or hoisting nested tables out of their cells).
   *
   * 2. If a feature IS supported by Markdown but a higher quality version is possible
   *    via HTML (e.g., tables with merged cells):
   *    - If true: Use HTML for better fidelity.
   *    - If false: Use native Markdown syntax (e.g., a standard GFM table grid).
   *
   * Defaults to true.
   */
  readonly fallbackToHtml?: undefined | boolean | FallbackToHtmlConfig;

  /**
   * Target Markdown dialect for generation - which native syntax to emit for constructs that
   * differ across real-world targets (GitHub/GitLab/Obsidian/Pandoc/strict CommonMark). See
   * `MarkdownDialectConfig` for the full per-feature field list. Defaults to `'extended'`
   * (officeParser's own historical kitchen-sink behavior, unchanged from prior versions).
   */
  readonly dialect?: undefined | MarkdownDialectPreset | MarkdownDialectConfig;
}

/**
 * Runtime schema for Markdown generator settings.
 *
 * **Example** (Validate Markdown output settings)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { MdGeneratorConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(MdGeneratorConfig))({ fallbackToHtml: false, dialect: "commonmark" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MdGeneratorConfig = S.Class<MdGeneratorConfigShape>($I`MdGeneratorConfig`)(
  {
    fallbackToHtml: S.optionalKey(S.Union([S.Boolean, FallbackToHtmlConfig])),
    dialect: S.optionalKey(S.Union([MarkdownDialectPreset, MarkdownDialectConfig])),
  },
  $I.annote("MdGeneratorConfig", {
    description: "Markdown dialect selection and raw-HTML fallback settings.",
  })
);

/**
 * Controls line endings, layout preservation, and note rendering in plain-text output.
 *
 * @category configuration
 * @since 0.0.0
 */
interface TextGeneratorConfigShape {
  /**
   * The delimiter used for every new line.
   * Defaults to '\n'.
   */
  readonly newlineDelimiter?: undefined | string;
  /**
   * Whether to attempt to preserve the original document layout.
   * If true, tables are rendered with separators and aligned columns, and list items get their
   * markers and indentation.
   * If false, output is a flat stream of text nodes (cells are tab-separated).
   * Defaults to **true**.
   */
  readonly preserveLayout?: undefined | boolean;
  /**
   * Whether to append the collected footnotes/endnotes as a trailing `--- Notes ---` section.
   * Set false to omit it when you want only the document body; the notes are still parsed and
   * remain available on the AST, they are simply not rendered into the text output.
   *
   * **Details**
   *
   * Note this differs from the parser's `ignoreNotes`, which discards notes at parse time so they
   * never reach the AST at all. Use this when you want the AST to keep them but the text output
   * to leave them out.
   *
   * Defaults to true.
   */
  readonly renderNotes?: undefined | boolean;
}

/**
 * Runtime schema for plain-text generator settings.
 *
 * **Example** (Validate text layout settings)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TextGeneratorConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(TextGeneratorConfig))({ newlineDelimiter: "\r\n", preserveLayout: true })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TextGeneratorConfig = S.Class<TextGeneratorConfigShape>($I`TextGeneratorConfig`)(
  {
    newlineDelimiter: S.optionalKey(S.String),
    preserveLayout: S.optionalKey(S.Boolean),
    renderNotes: S.optionalKey(S.Boolean),
  },
  $I.annote("TextGeneratorConfig", {
    description: "Plain-text line ending, layout preservation, and note rendering settings.",
  })
);

// ─── Chunking Types ───────────────────────────────────────────────────────────

/**
 * Selects how parsed content is divided for retrieval pipelines.
 *
 * **Details**
 *
 * `fixed-size` uses size and overlap limits. `document-structure` follows source boundaries. `semantic` uses embedding similarity to detect topic changes.
 *
 * **Example** (Guard fixed-size chunking)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ChunkingStrategy } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(ChunkingStrategy)("fixed-size")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChunkingStrategy = LiteralKit(["fixed-size", "document-structure", "semantic"]).pipe(
  $I.annoteSchema("ChunkingStrategy", {
    description: "Strategies for dividing parsed content into retrieval chunks.",
  })
);

/**
 * Decoded strategy member of {@link ChunkingStrategy}.
 *
 * @see {@link ChunkingStrategy} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type ChunkingStrategy = typeof ChunkingStrategy.Type;

/**
 * Defines limits and metadata behavior shared by every chunking strategy.
 *
 * @category configuration
 * @since 0.0.0
 */
interface BaseChunkingConfigShape {
  /**
   * The strategy used for chunking.
   * Default is 'document-structure'.
   */
  readonly strategy?: undefined | ChunkingStrategy;

  /**
   * A function that measures the size of a text string.
   * Defaults to character count: `(text) => text.length`.
   * Override with a token counter (e.g., `tiktoken`) for strict LLM context window adherence.
   */
  readonly lengthFunction?: undefined | ((text: string) => number);

  /**
   * Whether to strip leading/trailing whitespace from each chunk.
   * Default is true.
   */
  readonly stripWhitespace?: undefined | boolean;

  /**
   * Whether to include rich AST metadata (page number, slide number, heading, etc.)
   * in the generated chunk objects.
   * Default is true.
   */
  readonly includeMetadata?: undefined | boolean;

  /**
   * Whether to include the starting character index of each chunk
   * relative to the whole document. Useful for UI text highlighting.
   * Default is false.
   */
  readonly addStartIndex?: undefined | boolean;
  /**
   * Optional custom regex (as string or RegExp object) to identify sentence boundaries.
   * Use this for languages or specific document types that require custom splitting logic.
   * If provided, it overrides or augments the default segmenter.
   *
   * **Example** (Recognize CJK sentence endings)
   *
   * ```ts
   * const boundary: BaseChunkingConfig["sentenceBoundaryRegex"] = /[。？！]/
   * console.log(boundary)
   * ```
   */
  readonly sentenceBoundaryRegex?: undefined | string | RegExp;
  /**
   * Optional list of abbreviations to ignore when splitting text into sentences.
   * These words, if followed by a period, will not be treated as sentence boundaries.
   * Use this to handle language-specific or domain-specific abbreviations.
   *
   * **Example** (Protect common abbreviations)
   *
   * ```ts
   * const abbreviations: BaseChunkingConfig["abbreviations"] = ["Inc", "Ltd", "approx"]
   * console.log(abbreviations)
   * ```
   */
  readonly abbreviations?: undefined | string[];
}

/**
 * Runtime schema for settings shared by every chunking strategy.
 *
 * **Example** (Validate shared chunk settings)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BaseChunkingConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(BaseChunkingConfig))({ stripWhitespace: true, addStartIndex: true })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BaseChunkingConfig = S.Class<BaseChunkingConfigShape>($I`BaseChunkingConfig`)(
  {
    strategy: ChunkingStrategy.pipe(S.optionalKey),
    lengthFunction: S.optionalKey(runtimeFunction<(text: string) => number>()),
    stripWhitespace: S.optionalKey(S.Boolean),
    includeMetadata: S.optionalKey(S.Boolean),
    addStartIndex: S.optionalKey(S.Boolean),
    sentenceBoundaryRegex: S.optionalKey(S.Union([S.String, S.RegExp])),
    abbreviations: S.Array(S.String).pipe(S.mutable, S.optionalKey),
  },
  $I.annote("BaseChunkingConfig", {
    description: "Limits and metadata behavior shared by every chunking strategy.",
  })
);

/**
 * Splits text by size and overlap using an ordered separator list.
 *
 * @category configuration
 * @since 0.0.0
 */
interface FixedSizeChunkingConfigShape extends BaseChunkingConfig {
  readonly strategy: "fixed-size";

  /**
   * Maximum size of the chunk, measured by `lengthFunction`.
   * Default is 1000 characters.
   */
  readonly chunkSize?: undefined | number;

  /**
   * Number of characters/tokens to overlap between consecutive chunks
   * to avoid losing context at boundaries.
   * Rule of thumb: ~10–20% of `chunkSize`.
   * Default is 200.
   */
  readonly chunkOverlap?: undefined | number;

  /**
   * Ordered list of separators to try when splitting.
   * The chunker tries each in order; if a split would exceed `chunkSize`,
   * it tries the next separator.
   * Default is ['\n\n', '\n', ' ', ''].
   */
  readonly separators?: undefined | string[];
}

/**
 * Runtime schema for fixed-size chunking settings.
 *
 * **Example** (Validate fixed-size chunks)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FixedSizeChunkingConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(FixedSizeChunkingConfig))({ strategy: "fixed-size", chunkSize: 1_000 })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FixedSizeChunkingConfig = S.Class<FixedSizeChunkingConfigShape>($I`FixedSizeChunkingConfig`)(
  {
    ...BaseChunkingConfig.fields,
    strategy: S.Literal("fixed-size"),
    chunkSize: S.optionalKey(PositiveInt),
    chunkOverlap: S.optionalKey(NonNegativeInt),
    separators: S.Array(S.String).pipe(S.mutable, S.optionalKey),
  },
  $I.annote("FixedSizeChunkingConfig", {
    description: "Text chunking by size and overlap using an ordered separator list.",
  })
);

/**
 * Splits content at source-defined boundaries such as headings, pages, slides, and sheets.
 *
 * @category configuration
 * @since 0.0.0
 */
interface DocumentStructureChunkingConfigShape extends BaseChunkingConfig {
  readonly strategy: "document-structure";

  /**
   * The primary structural element at which to force a chunk boundary.
   * - 'paragraph': Never cross a paragraph boundary (finest-grained, most precise).
   * - 'heading': Split at every heading change.
   * - 'page': Chunks never span multiple pages (PDF only).
   * - 'slide': Chunks never span multiple slides (PPTX/ODP only).
   * - 'sheet': Chunks never span multiple sheets (XLSX/ODS only).
   * Default is 'paragraph'.
   */
  readonly splitBy?: undefined | "page" | "slide" | "sheet" | "heading" | "paragraph";

  /**
   * Maximum size of a chunk (measured by `lengthFunction`).
   * If a single structural unit (e.g., one paragraph) exceeds this limit,
   * it will be further split using a recursive character splitter.
   * Default is 1000 characters.
   */
  readonly maxChunkSize?: undefined | number;

  /**
   * How to handle table nodes when splitting.
   * - 'row': Split by rows and repeat the header row in every chunk so each chunk retains
   *   its column labels.
   * - 'flatten': Convert the table to plain text and split like a regular block.
   * Default is 'row'.
   */
  readonly tableSplitStrategy?: undefined | "row" | "flatten";
}

/**
 * Runtime schema for document-structure chunking settings.
 *
 * **Example** (Validate heading chunks)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DocumentStructureChunkingConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(DocumentStructureChunkingConfig))({ strategy: "document-structure", splitBy: "heading" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DocumentStructureChunkingConfig = S.Class<DocumentStructureChunkingConfigShape>(
  $I`DocumentStructureChunkingConfig`
)(
  {
    ...BaseChunkingConfig.fields,
    strategy: S.Literal("document-structure"),
    splitBy: DocumentSplitBoundary.pipe(S.optionalKey),
    maxChunkSize: S.optionalKey(PositiveInt),
    tableSplitStrategy: TableSplitStrategy.pipe(S.optionalKey),
  },
  $I.annote("DocumentStructureChunkingConfig", {
    description: "Content chunking at source-defined document boundaries.",
  })
);

/**
 * Splits content where embedding similarity indicates a topic change.
 *
 * @category configuration
 * @since 0.0.0
 */
interface SemanticChunkingConfigShape extends BaseChunkingConfig {
  readonly strategy: "semantic";

  /**
   * A user-provided async function to generate vector embeddings for a text string.
   * Required. Example: a wrapper around OpenAI's `text-embedding-3-small`.
   *
   * **Example** (Provide an embedding function)
   *
   * ```ts
   * const embeddingFunction: SemanticChunkingConfig["embeddingFunction"] = async (value) => [value.length]
   *
   * console.log(embeddingFunction("office") instanceof Promise)
   * ```
   */
  readonly embeddingFunction: (text: string) => Promise<number[]>;

  /**
   * The cosine similarity threshold below which a chunk boundary is created.
   * When the similarity between two adjacent sentences drops below this value,
   * a new chunk starts. Higher = more splits, smaller chunks.
   * Default is 0.8.
   */
  readonly similarityThreshold?: undefined | number;

  /**
   * Maximum size of a chunk even if semantic similarity remains high.
   * Prevents runaway chunks when an entire document is on one topic.
   * Default is 2000 characters.
   */
  readonly maxChunkSize?: undefined | number;

  /**
   * Number of surrounding sentences to include when computing similarity
   * for a sentence. A larger window reduces noise from single odd sentences.
   * Default is 1.
   */
  readonly bufferSize?: undefined | number;
  /**
   * Number of sentences to process in a single batch when calling the embedding function.
   * Higher values are faster but may trigger API rate limits.
   * Default is 50.
   */
  readonly embeddingBatchSize?: undefined | number;
  /**
   * Timeout in milliseconds for individual embedding API calls.
   * Defaults to 10000 ms (10 seconds). Set to 0 to disable.
   */
  readonly timeout?: undefined | number;
}

/**
 * Runtime schema for semantic chunking settings.
 *
 * **Example** (Validate semantic chunks)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SemanticChunkingConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * const embeddingFunction = async (text: string) => [text.length]
 * console.log(S.is(S.toEncoded(SemanticChunkingConfig))({ strategy: "semantic", embeddingFunction })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SemanticChunkingConfig = S.Class<SemanticChunkingConfigShape>($I`SemanticChunkingConfig`)(
  {
    ...BaseChunkingConfig.fields,
    strategy: S.Literal("semantic"),
    embeddingFunction: runtimeFunction<(text: string) => Promise<number[]>>(),
    similarityThreshold: S.optionalKey(SimilarityThreshold),
    maxChunkSize: S.optionalKey(PositiveInt),
    bufferSize: S.optionalKey(NonNegativeInt),
    embeddingBatchSize: S.optionalKey(PositiveInt),
    timeout: S.optionalKey(NonNegativeInt),
  },
  $I.annote("SemanticChunkingConfig", {
    description: "Content chunking where embedding similarity indicates a topic change.",
  })
);

/**
 * Selects the settings required by each supported chunking strategy.
 *
 * @category configuration
 * @since 0.0.0
 */
export type ChunkingConfig = FixedSizeChunkingConfig | DocumentStructureChunkingConfig | SemanticChunkingConfig;

/**
 * Runtime schema for the chunking-strategy union.
 *
 * **Example** (Guard fixed-size settings)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ChunkingConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(ChunkingConfig))({ strategy: "fixed-size", chunkSize: 500 })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChunkingConfig = S.Union([
  FixedSizeChunkingConfig,
  DocumentStructureChunkingConfig,
  SemanticChunkingConfig,
]).pipe(
  $I.annoteSchema("ChunkingConfig", {
    description: "Settings required by each supported chunking strategy.",
  })
);

/**
 * Runtime schema for the complete generator configuration surface.
 *
 * **Example** (Validate an HTML generator configuration)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GeneratorConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(GeneratorConfig))({ includeImages: true, htmlConfig: { standalone: false } })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GeneratorConfig = S.Class<GeneratorConfig>($I`GeneratorConfig`)(
  {
    ...CommonGeneratorConfig.fields,
    htmlConfig: S.optionalKey(HtmlGeneratorConfig),
    mdConfig: S.optionalKey(MdGeneratorConfig),
    pdfConfig: S.optionalKey(PdfGeneratorConfig),
    csvConfig: S.optionalKey(CsvGeneratorConfig),
    textConfig: S.optionalKey(TextGeneratorConfig),
    rtfConfig: S.optionalKey(RtfGeneratorConfig),
    chunksConfig: S.optionalKey(ChunkingConfig),
  },
  $I.annote("GeneratorConfig", {
    description: "Shared and destination-specific document generator settings.",
  })
);

/**
 * Runtime schema for one-step parse-and-generate settings.
 *
 * **Example** (Validate converter settings)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OfficeConverterConfig } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(OfficeConverterConfig))({ parseConfig: { fileType: "docx" }, generatorConfig: {} })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OfficeConverterConfig = S.Class<OfficeConverterConfig>($I`OfficeConverterConfig`)(
  {
    parseConfig: S.optionalKey(OfficeParserConfig),
    generatorConfig: S.optionalKey(GeneratorConfig),
    onWarning: S.optionalKey(runtimeFunction<(issue: OfficeIssue) => void>()),
  },
  $I.annote("OfficeConverterConfig", {
    description: "Source parsing and destination generation settings for one-step conversion.",
  })
);

/**
 * Carries chunk text and its source location for retrieval pipelines.
 *
 * **Details**
 *
 * Chunks are the result of splitting a document into smaller, semantically coherent
 * pieces that fit within the context window of an LLM. Each chunk includes the
 * extracted text and rich AST-derived metadata for citations and filtered retrieval.
 *
 * @category models
 * @since 0.0.0
 */
interface OfficeChunkShape {
  /** The text content of this chunk. This is what gets embedded. */
  readonly text: string;

  /**
   * Rich contextual metadata extracted from the AST.
   * Use this to populate vector DB metadata fields for filtered retrieval
   * and for LLM citations.
   */
  readonly metadata: {
    /** The source file format (e.g., 'docx', 'pptx', 'pdf'). */
    readonly sourceType: SupportedFileType;
    /** Page number (1-based), if available (PDF). */
    readonly pageNumber?: undefined | number;
    /** Slide number (1-based), if available (PPTX/ODP). */
    readonly slideNumber?: undefined | number;
    /** Sheet name, if available (XLSX/ODS). */
    readonly sheetName?: undefined | string;
    /** The text of the nearest heading above this chunk in the document. */
    readonly closestHeading?: undefined | string;
    /** True if this chunk is part of a table split. */
    readonly isTableChunk?: undefined | boolean;
    /** Extensible for user-defined metadata. */
    readonly [key: string]: unknown;
  };

  /** The start character index of this chunk in the full document text. Only set when `addStartIndex` is true. */
  readonly startIndex?: undefined | number;
  /** The end character index of this chunk in the full document text. Only set when `addStartIndex` is true. */
  readonly endIndex?: undefined | number;
}

interface OfficeChunkMetadata {
  readonly sourceType: SupportedFileType;
  readonly pageNumber?: undefined | number;
  readonly slideNumber?: undefined | number;
  readonly sheetName?: undefined | string;
  readonly closestHeading?: undefined | string;
  readonly isTableChunk?: undefined | boolean;
  readonly [key: string]: unknown;
}

const OfficeChunkMetadata = S.Class<OfficeChunkMetadata>($I`OfficeChunkMetadata`)(
  {
    sourceType: S.suspend((): typeof SupportedFileType => SupportedFileType),
    pageNumber: S.optionalKey(PositiveInt),
    slideNumber: S.optionalKey(PositiveInt),
    sheetName: S.optionalKey(S.String),
    closestHeading: S.optionalKey(S.String),
    isTableChunk: S.optionalKey(S.Boolean),
  },
  $I.annote("OfficeChunkMetadata", {
    description: "Source location and retrieval metadata attached to an Office chunk.",
  })
);

/**
 * Runtime schema for one retrieval chunk and its source location.
 *
 * **Example** (Validate a page chunk)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OfficeChunk } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(OfficeChunk))({ text: "Hello", metadata: { sourceType: "pdf", pageNumber: 1 } })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OfficeChunk = S.Class<OfficeChunkShape>($I`OfficeChunk`)(
  {
    text: S.String,
    metadata: OfficeChunkMetadata,
    startIndex: S.optionalKey(NonNegativeInt),
    endIndex: S.optionalKey(NonNegativeInt),
  },
  $I.annote("OfficeChunk", {
    description: "Chunk text and source location for retrieval pipelines.",
  })
);

// ─── End Chunking Types ────────────────────────────────────────────────────────

/**
 * Lists source formats accepted by the parser.
 *
 * **Example** (Guard a DOCX source)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SupportedFileType } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(SupportedFileType)("docx")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SupportedFileType = LiteralKit([
  "docx",
  "pptx",
  "xlsx",
  "odt",
  "odp",
  "ods",
  "pdf",
  "rtf",
  "md",
  "html",
  "csv",
  "epub",
]).pipe(
  $I.annoteSchema("SupportedFileType", {
    description: "Source formats accepted by the OfficeParser boundary.",
  })
);

/**
 * Decoded source-format member of {@link SupportedFileType}.
 *
 * @see {@link SupportedFileType} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type SupportedFileType = typeof SupportedFileType.Type;

/**
 * A structural stand-in for the web `Blob`/`File` so `parseOffice`/`convert` accept them in the
 * browser without pulling the DOM lib into this package's types. Any object with an
 * `arrayBuffer()` method qualifies. When `name` is present (as on a `File`) it is used only for
 * extension-based type detection, never as a filesystem path.
 *
 * **Gotchas**
 *
 * This intentionally remains a behavioral interface: its `arrayBuffer()` method is a
 * capability protocol implemented by platform `Blob` and `File` objects, not inert data that
 * can be reconstructed by a schema class.
 *
 * @category interop
 * @since 0.0.0
 */
export interface BlobLike {
  arrayBuffer(): Promise<ArrayBuffer>;

  readonly name?: undefined | string;
}

/**
 * Lists discriminator values used by document content nodes.
 *
 * **Example** (Guard a paragraph node)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OfficeContentNodeType } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(OfficeContentNodeType)("paragraph")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OfficeContentNodeType = LiteralKit([
  "paragraph",
  "heading",
  "table",
  "list",
  "text",
  "image",
  "chart",
  "drawing",
  "slide",
  "note",
  "sheet",
  "row",
  "cell",
  "page",
  "break",
  "code",
  "comment",
  "header",
  "footer",
  "slideMaster",
  "embed",
  "admonition",
  "definitionList",
  "definitionTerm",
  "definitionDescription",
]).pipe(
  $I.annoteSchema("OfficeContentNodeType", {
    description: "Discriminator values used by document content nodes.",
  })
);

/**
 * Decoded content-node discriminator member of {@link OfficeContentNodeType}.
 *
 * @see {@link OfficeContentNodeType} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type OfficeContentNodeType = typeof OfficeContentNodeType.Type;

/**
 * Lists media types used for extracted attachments.
 *
 * **Example** (Guard a PNG attachment)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OfficeMimeType } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(OfficeMimeType)("image/png")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OfficeMimeType = LiteralKit([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/svg+xml",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.chart",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.presentation",
  "application/rtf",
  "text/csv",
  "text/markdown",
  "text/html",
]).pipe(
  $I.annoteSchema("OfficeMimeType", {
    description: "Media types used for extracted OfficeParser attachments.",
  })
);

/**
 * Decoded attachment media type from {@link OfficeMimeType}.
 *
 * @see {@link OfficeMimeType} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type OfficeMimeType = typeof OfficeMimeType.Type;

/**
 * Constrains alignment values shared by text, paragraph, and spreadsheet metadata.
 *
 * **Example** (Guard centered text)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TextAlignment } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(TextAlignment)("center")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TextAlignment = LiteralKit(["left", "center", "right", "justify"]).pipe(
  $I.annoteSchema("TextAlignment", {
    description: "Alignment values shared by text, paragraph, and spreadsheet metadata.",
  })
);

/**
 * Decoded alignment member of {@link TextAlignment}.
 *
 * @see {@link TextAlignment} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type TextAlignment = typeof TextAlignment.Type;

/**
 * Captures formatting that was explicitly applied to a text run.
 *
 * **Example** (Format a heading run)
 *
 * ```ts
 * import { TextFormatting } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * const formatting: TextFormatting = {
 *   bold: true,
 *   size: "12pt",
 *   font: "Arial",
 * }
 *
 * console.log(formatting.font)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
interface TextFormattingShape {
  /**
   * Whether the text is bold.
   * Corresponds to `<w:b/>` in OOXML, `\b` in RTF.
   */
  readonly bold?: undefined | boolean;

  /**
   * Whether the text is italic.
   * Corresponds to `<w:i/>` in OOXML, `\i` in RTF.
   */
  readonly italic?: undefined | boolean;

  /**
   * Whether the text is underlined.
   * Corresponds to `<w:u/>` in OOXML, `\ul` in RTF.
   */
  readonly underline?: undefined | boolean;

  /**
   * Whether the text has a strikethrough.
   * Corresponds to `<w:strike/>` in OOXML, `\strike` in RTF.
   */
  readonly strikethrough?: undefined | boolean;

  /**
   * Text color in hex format (#RRGGBB).
   * Extracted from color tables in RTF or XML color attributes in OOXML.
   */
  readonly color?: undefined | string;

  /**
   * Background/highlight color in hex format (#RRGGBB).
   * Preserves either a background fill or source text highlighting.
   */
  readonly backgroundColor?: undefined | string;

  /**
   * Font size with units.
   * Most parsers append 'pt' (points), but ODF may use other units like 'in' (inches) or 'cm'.
   */
  readonly size?: undefined | string;

  /**
   * Font family/typeface name.
   * Extracted from font tables in RTF or font definitions in OOXML.
   */
  readonly font?: undefined | string;

  /**
   * Whether the text is subscript (e.g., H₂O).
   * Corresponds to `\sub` in RTF, `<w:vertAlign w:val="subscript"/>` in OOXML.
   * Mutually exclusive with superscript.
   */
  readonly subscript?: undefined | boolean;

  /**
   * Whether the text is superscript (e.g., E=mc²).
   * Corresponds to `\super` in RTF, `<w:vertAlign w:val="superscript"/>` in OOXML.
   * Mutually exclusive with subscript.
   */
  readonly superscript?: undefined | boolean;

  /**
   * The alignment of the text.
   * Common in spreadsheet cells or paragraph styles.
   */
  readonly alignment?: undefined | TextAlignment;
}

/**
 * Runtime schema for explicitly applied text formatting.
 *
 * **Example** (Guard bold text)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TextFormatting } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(TextFormatting))({ bold: true })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TextFormatting = S.Class<TextFormattingShape>($I`TextFormatting`)(
  {
    bold: S.optionalKey(S.Boolean),
    italic: S.optionalKey(S.Boolean),
    underline: S.optionalKey(S.Boolean),
    strikethrough: S.optionalKey(S.Boolean),
    color: S.optionalKey(S.String),
    backgroundColor: S.optionalKey(S.String),
    size: S.optionalKey(S.String),
    font: S.optionalKey(S.String),
    subscript: S.optionalKey(S.Boolean),
    superscript: S.optionalKey(S.Boolean),
    alignment: S.optionalKey(TextAlignment),
  },
  $I.annote("TextFormatting", { description: "Formatting explicitly applied to a text run." })
);

/**
 * Locates a content node within a presentation slide and its related note or anchors.
 *
 * **Example** (Locate a slide note)
 *
 * ```ts
 * import { SlideMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * const slide: SlideMetadata = {
 *   slideNumber: 1,
 *   noteId: "slide-note-1",
 * }
 *
 * console.log(slide.noteId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
interface SlideMetadataShape {
  /** The slide number (1-based). */
  readonly slideNumber: number;

  /**
   * The unique ID of the note associated with this slide (if any).
   */
  readonly noteId?: undefined | string;

  /** The style of the slide. */
  readonly style?: undefined | string;
  /** Unique anchor IDs for internal linking. */
  readonly anchorIds?: undefined | string[];
}

/**
 * Runtime schema for slide metadata.
 *
 * **Example** (Guard a slide)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SlideMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(SlideMetadata))({ slideNumber: 1 })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SlideMetadata = S.Class<SlideMetadataShape>($I`SlideMetadata`)(
  {
    slideNumber: PositiveInt,
    noteId: S.optionalKey(S.String),
    style: S.optionalKey(S.String),
    anchorIds: S.Array(S.String).pipe(S.mutable, S.optionalKey),
  },
  $I.annote("SlideMetadata", { description: "Presentation slide location, style, notes, and anchors." })
);

/**
 * Locates a content node within a workbook sheet and preserves its style and anchors.
 *
 * @category models
 * @since 0.0.0
 */
interface SheetMetadataShape {
  /** The name of the sheet. */
  readonly sheetName: string;
  /** The style of the sheet. */
  readonly style?: undefined | string;
  /** Unique anchor IDs for internal linking. */
  readonly anchorIds?: undefined | string[];
}

/**
 * Runtime schema for worksheet metadata.
 *
 * **Example** (Guard a sheet)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SheetMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(SheetMetadata))({ sheetName: "Q4" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SheetMetadata = S.Class<SheetMetadataShape>($I`SheetMetadata`)(
  {
    sheetName: S.String,
    style: S.optionalKey(S.String),
    anchorIds: S.Array(S.String).pipe(S.mutable, S.optionalKey),
  },
  $I.annote("SheetMetadata", { description: "Workbook sheet location, style, and anchors." })
);

/**
 * Records paragraph indentation measurements, typically in OOXML twips.
 *
 * @category models
 * @since 0.0.0
 */
interface IndentationMetadataShape {
  /** Left indentation. */
  readonly left?: undefined | number;
  /** Right indentation. */
  readonly right?: undefined | number;
  /** First line indentation. */
  readonly firstLine?: undefined | number;
  /** Hanging indentation. */
  readonly hanging?: undefined | number;
}

/**
 * Runtime schema for paragraph indentation.
 *
 * **Example** (Guard left indentation)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { IndentationMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(IndentationMetadata))({ left: 720 })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IndentationMetadata = S.Class<IndentationMetadataShape>($I`IndentationMetadata`)(
  {
    left: S.optionalKey(S.Finite),
    right: S.optionalKey(S.Finite),
    firstLine: S.optionalKey(S.Finite),
    hanging: S.optionalKey(S.Finite),
  },
  $I.annote("IndentationMetadata", { description: "Paragraph indentation measurements, typically in OOXML twips." })
);

/**
 * Records a heading's level, alignment, style, indentation, and anchors.
 *
 * @category models
 * @since 0.0.0
 */
interface HeadingMetadataShape {
  /** The heading level (e.g., 1 for H1). */
  readonly level: number;
  /** The alignment of the heading. */
  readonly alignment?: undefined | TextAlignment;
  /** The style of the heading. */
  readonly style?: undefined | string;
  /** Detailed indentation information. */
  readonly paragraphIndentation?: undefined | IndentationMetadata;
  /** Unique anchor IDs for internal linking. */
  readonly anchorIds?: undefined | string[];
}

/**
 * Runtime schema for heading metadata.
 *
 * **Example** (Guard an H1)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { HeadingMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(HeadingMetadata))({ level: 1 })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HeadingMetadata = S.Class<HeadingMetadataShape>($I`HeadingMetadata`)(
  {
    level: PositiveInt,
    alignment: S.optionalKey(TextAlignment),
    style: S.optionalKey(S.String),
    paragraphIndentation: S.optionalKey(IndentationMetadata),
    anchorIds: S.Array(S.String).pipe(S.mutable, S.optionalKey),
  },
  $I.annote("HeadingMetadata", { description: "Heading level, alignment, style, indentation, and anchors." })
);

/**
 * Records a paragraph's alignment, style, indentation, and anchors.
 *
 * @category models
 * @since 0.0.0
 */
interface ParagraphMetadataShape {
  /** The alignment of the paragraph. */
  readonly alignment?: undefined | TextAlignment;
  /** The style of the paragraph. */
  readonly style?: undefined | string;
  /** Detailed indentation information. */
  readonly paragraphIndentation?: undefined | IndentationMetadata;
  /** Unique anchor IDs for internal linking. */
  readonly anchorIds?: undefined | string[];
}

/**
 * Runtime schema for paragraph metadata.
 *
 * **Example** (Guard alignment)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ParagraphMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(ParagraphMetadata))({ alignment: "left" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ParagraphMetadata = S.Class<ParagraphMetadataShape>($I`ParagraphMetadata`)(
  {
    alignment: S.optionalKey(TextAlignment),
    style: S.optionalKey(S.String),
    paragraphIndentation: S.optionalKey(IndentationMetadata),
    anchorIds: S.Array(S.String).pipe(S.mutable, S.optionalKey),
  },
  $I.annote("ParagraphMetadata", { description: "Paragraph alignment, style, indentation, and anchors." })
);

/**
 * Identifies a list item and records its nesting, alignment, task state, and source style.
 *
 * **Example** (Describe a nested ordered item)
 *
 * ```ts
 * import { ListMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * const item: ListMetadata = {
 *   listType: "ordered",
 *   indentation: 1,
 *   alignment: "left",
 *   listId: "2",
 *   itemIndex: 0,
 *   style: "ListParagraph",
 * }
 *
 * console.log(item.listType, item.indentation)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
interface ListMetadataShape {
  /**
   * The type of list: 'ordered' (numbered) or 'unordered' (bulleted).
   */
  readonly listType: "ordered" | "unordered";

  /**
   * The nesting level (indent level) of the list item, starting from 0.
   */
  readonly indentation: number;

  /** Detailed indentation information. */
  readonly paragraphIndentation?: undefined | IndentationMetadata;

  /**
   * Text alignment of the list item.
   */
  readonly alignment: TextAlignment;

  /**
   * The list ID from the Word document's numbering definition.
   * Used to identify which list definition this item belongs to.
   */
  readonly listId: string;

  /**
   * The zero-based index of this item within its list.
   * Continues incrementing even across paragraph interruptions for the same listId.
   */
  readonly itemIndex: number;

  /**
   * The style name of the list item.
   */
  readonly style?: undefined | string;
  /** Unique anchor IDs for internal linking. */
  readonly anchorIds?: undefined | string[];

  /** True when this list item is a GFM task-list item (checkbox), regardless of checked state. */
  readonly isTask?: undefined | boolean;
  /** Checked state for a task-list item. Only meaningful when isTask is true. */
  readonly checked?: undefined | boolean;
}

/**
 * Runtime schema for list-item metadata.
 *
 * **Example** (Guard a list item)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ListMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * const item = { listType: "ordered", indentation: 0, alignment: "left", listId: "1", itemIndex: 0 }
 * console.log(S.is(S.toEncoded(ListMetadata))(item)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListMetadata = S.Class<ListMetadataShape>($I`ListMetadata`)(
  {
    listType: ListType,
    indentation: NonNegativeInt,
    paragraphIndentation: S.optionalKey(IndentationMetadata),
    alignment: TextAlignment,
    listId: S.String,
    itemIndex: NonNegativeInt,
    style: S.optionalKey(S.String),
    anchorIds: S.Array(S.String).pipe(S.mutable, S.optionalKey),
    isTask: S.optionalKey(S.Boolean),
    checked: S.optionalKey(S.Boolean),
  },
  $I.annote("ListMetadata", { description: "List identity, nesting, alignment, task state, and source style." })
);

/**
 * Locates a cell within a parsed table and records spans, alignment, style, and color.
 *
 * **Example** (Locate a merged header cell)
 *
 * ```ts
 * import { CellMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * const cell: CellMetadata = {
 *   row: 0,
 *   col: 1,
 *   rowSpan: 2,
 *   colSpan: 2,
 *   align: "center",
 * }
 *
 * console.log(cell.row, cell.colSpan)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
interface CellMetadataShape {
  /**
   * The row index of the cell (0-based).
   */
  readonly row: number;
  /**
   * The column index of the cell (0-based).
   */
  readonly col: number;
  /**
   * Text alignment for this cell's column, from the GFM pipe-table separator row
   * (`:---` left, `:---:` center, `---:` right). All cells in a column carry the same value;
   * the Markdown generator reads it from the header row to emit the separator.
   */
  readonly align?: undefined | "left" | "center" | "right";
  /**
   * The number of rows this cell spans (merges).
   */
  readonly rowSpan?: undefined | number;
  /**
   * The number of columns this cell spans (merges).
   */
  readonly colSpan?: undefined | number;
  /** The style of the cell. */
  readonly style?: undefined | string;
  /** Unique anchor IDs for internal linking. */
  readonly anchorIds?: undefined | string[];
  /** Background color for this cell in hex format (e.g. #FFFFFF). */
  readonly backgroundColor?: undefined | string;
}

/**
 * Runtime schema for table-cell metadata.
 *
 * **Example** (Guard a cell)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CellMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(CellMetadata))({ row: 0, col: 1 })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CellMetadata = S.Class<CellMetadataShape>($I`CellMetadata`)(
  {
    row: NonNegativeInt,
    col: NonNegativeInt,
    align: HorizontalAlignment.pipe(S.optionalKey),
    rowSpan: S.optionalKey(PositiveInt),
    colSpan: S.optionalKey(PositiveInt),
    style: S.optionalKey(S.String),
    anchorIds: S.Array(S.String).pipe(S.mutable, S.optionalKey),
    backgroundColor: S.optionalKey(S.String),
  },
  $I.annote("CellMetadata", { description: "Table-cell coordinates, spans, alignment, style, and color." })
);

/**
 * Preserves table anchors and page alignment.
 *
 * **Example** (Center a table on the page)
 *
 * ```ts
 * import { TableMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * const table: TableMetadata = {
 *   align: "center",
 *   anchorIds: ["tbl-q4"],
 * }
 *
 * console.log(table.align)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
interface TableMetadataShape {
  /** Unique anchor IDs for internal linking. */
  readonly anchorIds?: undefined | string[];
  /**
   * Layout alignment of the table on the page (e.g. an editor's custom table node).
   */
  readonly align?: undefined | "left" | "center" | "right";
}

/**
 * Runtime schema for table metadata.
 *
 * **Example** (Guard a centered table)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TableMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(TableMetadata))({ align: "center" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TableMetadata = S.Class<TableMetadataShape>($I`TableMetadata`)(
  {
    anchorIds: S.Array(S.String).pipe(S.mutable, S.optionalKey),
    align: HorizontalAlignment.pipe(S.optionalKey),
  },
  $I.annote("TableMetadata", { description: "Table anchors and page alignment." })
);

/**
 * Links a chart node to the attachment that stores its extracted chart data.
 *
 * **Example** (Point a chart node at its attachment)
 *
 * ```ts
 * import { ChartMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * const chart: ChartMetadata = { attachmentName: "chart1.xml" }
 *
 * console.log(chart.attachmentName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
interface ChartMetadataShape {
  /**
   * The name of the attachment that contains the actual chart data.
   * Use this to look up the full chart data from the attachments array.
   */
  readonly attachmentName: string;
  /** Unique anchor IDs for internal linking. */
  readonly anchorIds?: undefined | string[];
}

/**
 * Runtime schema for chart metadata.
 *
 * **Example** (Guard a chart link)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ChartMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(ChartMetadata))({ attachmentName: "chart.xml" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChartMetadata = S.Class<ChartMetadataShape>($I`ChartMetadata`)(
  {
    attachmentName: S.String,
    anchorIds: S.Array(S.String).pipe(S.mutable, S.optionalKey),
  },
  $I.annote("ChartMetadata", { description: "Chart node link to its extracted attachment." })
);

/**
 * Links an image node to its attachment and preserves display metadata.
 *
 * **Example** (Describe a centered logo)
 *
 * ```ts
 * import { ImageMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * const image: ImageMetadata = {
 *   attachmentName: "image1.png",
 *   altText: "Company logo",
 *   width: "50%",
 *   align: "center",
 * }
 *
 * console.log(image.altText)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
interface ImageMetadataShape {
  /**
   * The name of the attachment that contains the actual image data.
   * Use this to look up the full image data from the attachments array.
   */
  readonly attachmentName: string;

  /**
   * Alt text (alternative text) describing the image.
   * Extracted from image properties in the document.
   */
  readonly altText?: undefined | string;

  /**
   * URL of the image if it is an external link.
   * Typical for HTML or Markdown images that point to remote servers.
   */
  readonly url?: undefined | string;
  /** Unique anchor IDs for internal linking. */
  readonly anchorIds?: undefined | string[];
  /**
   * Display width of the image (e.g. an editor's custom image node), as a CSS length or percentage.
   */
  readonly width?: undefined | string;
  /**
   * Layout alignment of the image (e.g. an editor's custom image node).
   */
  readonly align?: undefined | "left" | "center" | "right";
  /** Advisory image title (Markdown `![alt](url "title")`, HTML `<img title>`), if any. */
  readonly title?: undefined | string;
}

/**
 * Runtime schema for image metadata.
 *
 * **Example** (Guard an image link)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ImageMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(ImageMetadata))({ attachmentName: "logo.png" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ImageMetadata = S.Class<ImageMetadataShape>($I`ImageMetadata`)(
  {
    attachmentName: S.String,
    altText: S.optionalKey(S.String),
    url: S.optionalKey(S.String),
    anchorIds: S.Array(S.String).pipe(S.mutable, S.optionalKey),
    width: S.optionalKey(S.String),
    align: HorizontalAlignment.pipe(S.optionalKey),
    title: S.optionalKey(S.String),
  },
  $I.annote("ImageMetadata", { description: "Image attachment link and display metadata." })
);

/**
 * Preserves the source, dimensions, alignment, and label of embedded external media.
 *
 * @category models
 * @since 0.0.0
 */
interface EmbedMetadataShape {
  /**
   * The kind of embed. 'youtube' is recognized from a `data-youtube-video` wrapper or a YouTube
   * iframe; 'iframe' is a generic preserved iframe (opt-in via `HtmlParserConfig.preserveIframes`).
   */
  readonly embedType: "youtube" | "iframe";
  /** The provider-specific video ID (e.g. the 11-character YouTube video ID). Absent for generic iframes. */
  readonly videoId?: undefined | string;
  /** The original/canonical URL of the embedded media, if known. For a generic iframe, its `src`. */
  readonly url?: undefined | string;
  /** Display width, as a CSS length or percentage. */
  readonly width?: undefined | string;
  /** Display height, as a CSS length or percentage. */
  readonly height?: undefined | string;
  /** Layout alignment of the embed. */
  readonly align?: undefined | "left" | "center" | "right";
  /** Human-readable label for the embed (e.g. the `[Label]` of a `::youtube[Label]{...}` leaf
   *  directive, or a gated embed's caption). Purely descriptive; never a trust or render input. */
  readonly label?: undefined | string;
}

/**
 * Runtime schema for embedded-media metadata.
 *
 * **Example** (Guard a YouTube embed)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { EmbedMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(EmbedMetadata))({ embedType: "youtube", videoId: "abc" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EmbedMetadata = S.Class<EmbedMetadataShape>($I`EmbedMetadata`)(
  {
    embedType: EmbedType,
    videoId: S.optionalKey(S.String),
    url: S.optionalKey(S.String),
    width: S.optionalKey(S.String),
    height: S.optionalKey(S.String),
    align: HorizontalAlignment.pipe(S.optionalKey),
    label: S.optionalKey(S.String),
  },
  $I.annote("EmbedMetadata", { description: "Source, dimensions, alignment, and label of embedded media." })
);

/**
 * Preserves an admonition's kind, title, and parsed Markdown syntax.
 *
 * @category models
 * @since 0.0.0
 */
interface AdmonitionMetadataShape {
  readonly admonitionType: "note" | "tip" | "important" | "warning" | "caution";
  /** Optional custom title; falls back to the type label. */
  readonly title?: undefined | string;
  /** Which concrete input syntax produced this node. Always populated by the parser. */
  readonly sourceSyntax?: undefined | "github" | "gitlab";
}

/**
 * Runtime schema for admonition metadata.
 *
 * **Example** (Guard a note)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AdmonitionMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(AdmonitionMetadata))({ admonitionType: "note" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AdmonitionMetadata = S.Class<AdmonitionMetadataShape>($I`AdmonitionMetadata`)(
  {
    admonitionType: AdmonitionType,
    title: S.optionalKey(S.String),
    sourceSyntax: AdmonitionSourceSyntax.pipe(S.optionalKey),
  },
  $I.annote("AdmonitionMetadata", { description: "Admonition kind, title, and parsed Markdown syntax." })
);

/**
 * Identifies the source PDF page for a content node.
 *
 * **Example** (Tag a node with its PDF page)
 *
 * ```ts
 * import { PageMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * const page: PageMetadata = { pageNumber: 1 }
 *
 * console.log(page.pageNumber)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
interface PageMetadataShape {
  /**
   * The page number (1-based) from the PDF document.
   */
  readonly pageNumber: number;
}

/**
 * Runtime schema for page metadata.
 *
 * **Example** (Guard a page)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PageMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(PageMetadata))({ pageNumber: 1 })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PageMetadata = S.Class<PageMetadataShape>($I`PageMetadata`)(
  { pageNumber: PositiveInt },
  $I.annote("PageMetadata", { description: "Source PDF page number for a content node." })
);

/**
 * Preserves links, citations, abbreviations, wikilinks, and style data for a text run.
 *
 * **Example** (Link a text run)
 *
 * ```ts
 * import { TextMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * const run: TextMetadata = {
 *   link: "https://example.com",
 *   linkType: "external",
 * }
 *
 * console.log(run.link)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
interface TextMetadataShape {
  /** Style name of the text */
  readonly style?: undefined | string;

  /**
   * The hyperlink URL (for external links) or anchor reference (for internal links).
   */
  readonly link?: undefined | string;

  /**
   * Type of hyperlink.
   * - 'internal': Link to a bookmark/anchor within the same document
   * - 'external': Link to an external URL
   */
  readonly linkType?: undefined | "internal" | "external";

  /**
   * When set, this text is an abbreviation and this is its full-form expansion,
   * rendered as `<abbr title="...">`. Populated from Markdown Extra's
   * `*[HTML]: Hypertext Markup Language` syntax or an HTML `<abbr>` tag.
   */
  readonly abbreviationTitle?: undefined | string;

  /**
   * When set, this text is a Pandoc/MultiMarkdown-style citation reference
   * (`[@` + `citekey]`), and this is the bare citekey (e.g. "smith2024"). Bibliography
   * resolution (author/year display, .bib management) is left to the consuming app.
   */
  readonly citationKey?: undefined | string;

  /**
   * True when this is an Obsidian-style wikilink (`[[page]]` / `[[page|alias]]`).
   * `link` holds the bare page name and `linkType` is always 'internal'; the
   * per-workspace enable/disable toggle lives in markdownwriter, not here -
   * officeParser always parses/generates the syntax.
   */
  readonly wikilink?: undefined | boolean;
  /** Advisory link title (Markdown `[text](url "title")`, HTML `<a title>`), if any. */
  readonly title?: undefined | string;
}

/**
 * Runtime schema for text-run metadata.
 *
 * **Example** (Guard an external link)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TextMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(TextMetadata))({ link: "https://example.com", linkType: "external" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TextMetadata = S.Class<TextMetadataShape>($I`TextMetadata`)(
  {
    style: S.optionalKey(S.String),
    link: S.optionalKey(S.String),
    linkType: LinkType.pipe(S.optionalKey),
    abbreviationTitle: S.optionalKey(S.String),
    citationKey: S.optionalKey(S.String),
    wikilink: S.optionalKey(S.Boolean),
    title: S.optionalKey(S.String),
  },
  $I.annote("TextMetadata", { description: "Links, citations, abbreviations, wikilinks, and style data for a text run." })
);

/**
 * Identifies a footnote or endnote and records its source anchors and reference state.
 *
 * **Example** (Identify a footnote)
 *
 * ```ts
 * import { NoteMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * const note: NoteMetadata = {
 *   noteType: "footnote",
 *   noteId: "1",
 * }
 *
 * console.log(note.noteId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
interface NoteMetadataShape {
  /**
   * Type of note: 'footnote' or 'endnote'.
   */
  readonly noteType?: undefined | "footnote" | "endnote";

  /**
   * The unique ID of the note from the source document.
   */
  readonly noteId?: undefined | string;
  /** Unique anchor IDs for internal linking. */
  readonly anchorIds?: undefined | string[];
  /** The slide number this note is associated with (used in PowerPoint). */
  readonly slideNumber?: undefined | number;
  /**
   * True for a footnote/endnote definition that no reference points at (an "orphan").
   * The Markdown parser sets this when it recovers a `[^id]: ...` definition with no matching
   * `[^id]` reference so the definition is preserved rather than dropped. Generators route such
   * notes into their footnotes section without a citation marker, and the HTML generator omits
   * the (otherwise dangling) back-link.
   */
  readonly unreferenced?: undefined | boolean;
}

/**
 * Runtime schema for note metadata.
 *
 * **Example** (Guard a footnote)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NoteMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(NoteMetadata))({ noteType: "footnote", noteId: "1" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NoteMetadata = S.Class<NoteMetadataShape>($I`NoteMetadata`)(
  {
    noteType: NoteType.pipe(S.optionalKey),
    noteId: S.optionalKey(S.String),
    anchorIds: S.Array(S.String).pipe(S.mutable, S.optionalKey),
    slideNumber: S.optionalKey(PositiveInt),
    unreferenced: S.optionalKey(S.Boolean),
  },
  $I.annote("NoteMetadata", { description: "Footnote or endnote identity, anchors, and reference state." })
);

/**
 * Distinguishes line, page, column, thematic, and other document breaks.
 *
 * @category models
 * @since 0.0.0
 */
interface BreakMetadataShape {
  /**
   * Type of break. The break type determines the next location where
   * text shall be placed.
   * - 'column': The next text will be placed in the next column.
   * - 'page': The next text will be placed on the next page.
   * - 'lastRenderedPage': The editing application has inserted a soft break on the last save.
   * - 'textWrapping' (default, assumed when not specified): The next text will be placed on the next line.
   * - 'carriageReturn': An explicit carriage return (w:cr) equivalent to a hard line break.
   * - 'thematic': A thematic break (Markdown `---`/`***`/`___`, HTML `<hr>`) - a horizontal
   *   rule separating sections, distinct from a page break. Emitted as `---` in Markdown and
   *   `<hr>` in HTML.
   */
  readonly breakType: "column" | "page" | "lastRenderedPage" | "textWrapping" | "carriageReturn" | "thematic";

  /**
   * Specifies the location which shall be used as the next available line when breakType
   * has a value of 'textWrapping'. Should be ignored for other break types.
   * - 'all': text wrapping break shall advance the text to the next line which spans the full width of the line
   * - 'left': text wrapping break shall restart in next text region unblocked on the left
   * - 'none': text wrapping break shall advance the text to the next line regardless of any floating objects
   * - 'right': text wrapping break shall restart in next text region unblocked on the right
   */
  readonly clear?: undefined | "all" | "left" | "none" | "right";
}

/**
 * Runtime schema for document-break metadata.
 *
 * **Example** (Guard a page break)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BreakMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(BreakMetadata))({ breakType: "page" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BreakMetadata = S.Class<BreakMetadataShape>($I`BreakMetadata`)(
  {
    breakType: BreakType,
    clear: BreakClear.pipe(S.optionalKey),
  },
  $I.annote("BreakMetadata", { description: "Line, page, column, thematic, and other document breaks." })
);

/**
 * Preserves the language, anchors, and math status of a code block.
 *
 * @category models
 * @since 0.0.0
 */
interface CodeMetadataShape {
  /** The programming language of the code block (e.g., 'typescript', 'python') */
  readonly language?: undefined | string;
  /** Unique anchor IDs for internal linking. */
  readonly anchorIds?: undefined | string[];
  /**
   * When set, this node is a LaTeX math expression rather than a code block. `node.text`
   * holds the bare LaTeX (delimiters excluded); 'inline' round-trips as `$...$`,
   * 'block' as `$$...$$`. Matches attribute-driven editors' math nodes.
   */
  readonly math?: undefined | "inline" | "block";
}

/**
 * Runtime schema for code-block metadata.
 *
 * **Example** (Guard TypeScript code)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CodeMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(CodeMetadata))({ language: "typescript" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodeMetadata = S.Class<CodeMetadataShape>($I`CodeMetadata`)(
  {
    language: S.optionalKey(S.String),
    anchorIds: S.Array(S.String).pipe(S.mutable, S.optionalKey),
    math: MathDisplayMode.pipe(S.optionalKey),
  },
  $I.annote("CodeMetadata", { description: "Language, anchors, and math status of a code block." })
);

/**
 * Associates comment content with a document node.
 *
 * @category models
 * @since 0.0.0
 */
interface CommentMetadataShape {
  readonly author?: undefined | string;
  readonly initials?: undefined | string;
  readonly date?: undefined | string;
  readonly commentId?: undefined | string;
}

/**
 * Runtime schema for comment metadata.
 *
 * **Example** (Guard an author)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CommentMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(CommentMetadata))({ author: "Ada" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CommentMetadata = S.Class<CommentMetadataShape>($I`CommentMetadata`)(
  {
    author: S.optionalKey(S.String),
    initials: S.optionalKey(S.String),
    date: S.optionalKey(S.String),
    commentId: S.optionalKey(S.String),
  },
  $I.annote("CommentMetadata", { description: "Comment identity and authorship associated with a document node." })
);

/**
 * Marks content extracted from a document header or footer.
 *
 * @category models
 * @since 0.0.0
 */
interface HeaderFooterMetadataShape {
  readonly type: "default" | "first" | "even" | string;
}

/**
 * Runtime schema for header or footer metadata.
 *
 * **Example** (Guard a first-page header)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { HeaderFooterMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(HeaderFooterMetadata))({ type: "first" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HeaderFooterMetadata = S.Class<HeaderFooterMetadataShape>($I`HeaderFooterMetadata`)(
  { type: S.String },
  $I.annote("HeaderFooterMetadata", { description: "Section kind for content extracted from a document header or footer." })
);

/**
 * Maps content-node variants to the metadata shapes they may carry.
 *
 * @category models
 * @since 0.0.0
 */
export type ContentMetadata =
  | SlideMetadata
  | SheetMetadata
  | HeadingMetadata
  | ListMetadata
  | CellMetadata
  | ImageMetadata
  | ChartMetadata
  | PageMetadata
  | ParagraphMetadata
  | TextMetadata
  | NoteMetadata
  | BreakMetadata
  | CodeMetadata
  | CommentMetadata
  | HeaderFooterMetadata
  | TableMetadata
  | EmbedMetadata
  | AdmonitionMetadata
  | undefined;

/**
 * Runtime schema for content-node metadata variants.
 *
 * **Example** (Guard heading metadata)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ContentMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(ContentMetadata))({ level: 1 })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContentMetadata = S.Union([
  SlideMetadata,
  SheetMetadata,
  HeadingMetadata,
  ListMetadata,
  CellMetadata,
  ImageMetadata,
  ChartMetadata,
  PageMetadata,
  ParagraphMetadata,
  TextMetadata,
  NoteMetadata,
  BreakMetadata,
  CodeMetadata,
  CommentMetadata,
  HeaderFooterMetadata,
  TableMetadata,
  EmbedMetadata,
  AdmonitionMetadata,
  S.Undefined,
]).pipe(
  $I.annoteSchema("ContentMetadata", {
    description: "Metadata shapes carried by document content-node variants.",
  })
);

/**
 * Defines fields shared by every node in the parsed document tree.
 *
 * **Details**
 *
 * Container nodes use `children` for nested document structure, while leaf nodes store their text and formatting directly.
 *
 * **Example** (Represent shared paragraph fields)
 *
 * ```ts
 * import { BaseContentNode } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * const paragraph: BaseContentNode = {
 *   text: "Hello world",
 *   children: [
 *     { type: "text", text: "Hello ", formatting: { bold: true } },
 *     { type: "text", text: "world", formatting: { italic: true } }
 *   ]
 * }
 *
 * console.log(paragraph.children?.length)
 * ```
 *
 * **Example** (Represent shared heading fields)
 *
 * ```ts
 * import { BaseContentNode } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * const heading: BaseContentNode = {
 *   text: "Chapter 1",
 *   children: []
 * }
 *
 * console.log(heading.text)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
interface BaseContentNodeShape {
  /**
   * The complete text content of the node and all its children combined.
   * For container nodes (paragraph, heading), this is the concatenation of all child text.
   * For leaf nodes (text), this is the actual text content.
   */
  readonly text?: undefined | string;

  /**
   * Child nodes that make up this node's content.
   * Used for hierarchical structures:
   * - Paragraphs contain text runs with different formatting
   * - Tables contain rows
   * - Rows contain cells
   * - Cells contain paragraphs
   */
  readonly children?: undefined | OfficeContentNode[];

  /**
   * Comments attached to this specific node.
   * Keeps annotations completely separate from the actual content flow.
   */
  readonly comments?: undefined | OfficeContentNode[];

  /**
   * Notes (like footnotes or slide notes) attached to this specific node.
   * Keeps notes separate from the actual structural children.
   */
  readonly notes?: undefined | OfficeContentNode[];

  /**
   * Text formatting applied to this node.
   * Only applicable to text-containing nodes.
   * For container nodes like paragraphs, formatting typically appears on child text nodes.
   */
  readonly formatting?: undefined | TextFormatting;

  /**
   * The raw source content for this node.
   * - For XML-based formats (DOCX, XLSX, PPTX): contains the raw XML
   * - For RTF: contains the raw RTF markup
   * - For PDF: typically not available
   * Only populated when `config.includeRawContent` is true.
   * Useful for debugging or when you need access to format-specific features.
   */
  readonly rawContent?: undefined | string;

  /**
   * Source HTML attributes that no typed metadata field consumed, preserved for round-trip
   * fidelity (e.g. a `data-*` attribute an editor round-trips through officeParser).
   *
   * **Details**
   *
   * Only populated by the HTML/XHTML parser, only for elements it recognises, and only when
   * `htmlParserConfig.preserveAttributes` is enabled - so by default this is always absent.
   *
   * Sanitized on both legs, since an AST can also be constructed programmatically rather than
   * parsed: event handlers (`on*`) and `srcdoc` are never carried, URL-bearing attributes go
   * through the same URL sanitizer as typed fields, and every value is escaped on output. A
   * typed field always wins over a same-named entry here.
   *
   * Ignored by the non-HTML generators (Markdown, RTF, CSV, text, chunking) by design - these
   * are HTML attributes and have no meaning in those targets.
   */
  readonly htmlAttributes?: undefined | Record<string, string>;
}

/**
 * Runtime schema for fields shared by every content node.
 *
 * **Example** (Guard shared text fields)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BaseContentNode } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(BaseContentNode))({ text: "Hello" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BaseContentNode = S.Class<BaseContentNodeShape>($I`BaseContentNode`)(
  {
    text: S.optionalKey(S.String),
    children: S.suspend(() => S.Array(OfficeContentNode).pipe(S.mutable)).pipe(S.optionalKey),
    comments: S.suspend(() => S.Array(OfficeContentNode).pipe(S.mutable)).pipe(S.optionalKey),
    notes: S.suspend(() => S.Array(OfficeContentNode).pipe(S.mutable)).pipe(S.optionalKey),
    formatting: S.optionalKey(TextFormatting),
    rawContent: S.optionalKey(S.String),
    htmlAttributes: S.optionalKey(S.Record(S.String, S.String)),
  },
  $I.annote("BaseContentNode", {
    description: "Text, children, comments, notes, formatting, and source fields shared by every content node.",
  })
);

/**
 * Models one discriminated node in the parsed document tree.
 *
 * **Example** (Build a paragraph node)
 *
 * ```ts
 * import { OfficeContentNode } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * const paragraph: OfficeContentNode = {
 *   type: "paragraph",
 *   text: "Hello world",
 *   children: [
 *     { type: "text", text: "Hello ", formatting: { bold: true } },
 *     { type: "text", text: "world", formatting: { italic: true } }
 *   ]
 * }
 *
 * console.log(paragraph.type)
 * ```
 *
 * **Example** (Build a heading node)
 *
 * ```ts
 * import { OfficeContentNode } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * const heading: OfficeContentNode = {
 *   type: "heading",
 *   text: "Chapter 1",
 *   metadata: { level: 1 },
 *   children: []
 * }
 *
 * console.log(heading.metadata?.level)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OfficeContentNode = BaseContentNode &
  (
    | { readonly type: "slide"; readonly metadata?: undefined | SlideMetadata }
    | { readonly type: "sheet"; readonly metadata?: undefined | SheetMetadata }
    | {
        readonly type: "heading";
        readonly metadata?: undefined | HeadingMetadata;
      }
    | { readonly type: "list"; readonly metadata?: undefined | ListMetadata }
    | { readonly type: "cell"; readonly metadata?: undefined | CellMetadata }
    | { readonly type: "image"; readonly metadata?: undefined | ImageMetadata }
    | { readonly type: "chart"; readonly metadata?: undefined | ChartMetadata }
    | { readonly type: "page"; readonly metadata?: undefined | PageMetadata }
    | {
        readonly type: "paragraph";
        readonly metadata?: undefined | ParagraphMetadata;
      }
    | { readonly type: "text"; readonly metadata?: undefined | TextMetadata }
    | { readonly type: "note"; readonly metadata?: undefined | NoteMetadata }
    | { readonly type: "break"; readonly metadata?: undefined | BreakMetadata }
    | { readonly type: "code"; readonly metadata?: undefined | CodeMetadata }
    | {
        readonly type: "comment";
        readonly metadata?: undefined | CommentMetadata;
      }
    | {
        readonly type: "header";
        readonly metadata?: undefined | HeaderFooterMetadata;
      }
    | {
        readonly type: "footer";
        readonly metadata?: undefined | HeaderFooterMetadata;
      }
    | { readonly type: "table"; readonly metadata?: undefined | TableMetadata }
    | { readonly type: "row"; readonly metadata?: undefined }
    | { readonly type: "drawing"; readonly metadata?: undefined }
    | {
        readonly type: "slideMaster";
        readonly metadata?: undefined | SlideMetadata;
      }
    | { readonly type: "embed"; readonly metadata?: undefined | EmbedMetadata }
    | {
        readonly type: "admonition";
        readonly metadata?: undefined | AdmonitionMetadata;
      }
    | {
        readonly type: "definitionList";
        readonly metadata?: undefined;
      }
    | {
        readonly type: "definitionTerm";
        readonly metadata?: undefined;
      }
    | {
        readonly type: "definitionDescription";
        readonly metadata?: undefined;
      }
  );

const ContentMetadataByNodeType = {
  slide: SlideMetadata,
  sheet: SheetMetadata,
  heading: HeadingMetadata,
  list: ListMetadata,
  cell: CellMetadata,
  image: ImageMetadata,
  chart: ChartMetadata,
  page: PageMetadata,
  paragraph: ParagraphMetadata,
  text: TextMetadata,
  note: NoteMetadata,
  break: BreakMetadata,
  code: CodeMetadata,
  comment: CommentMetadata,
  header: HeaderFooterMetadata,
  footer: HeaderFooterMetadata,
  table: TableMetadata,
  row: S.Undefined,
  drawing: S.Undefined,
  slideMaster: SlideMetadata,
  embed: EmbedMetadata,
  admonition: AdmonitionMetadata,
  definitionList: S.Undefined,
  definitionTerm: S.Undefined,
  definitionDescription: S.Undefined,
} satisfies Readonly<Record<OfficeContentNodeType, S.Top>>;

const isBaseContentNode = S.is(S.toEncoded(BaseContentNode));
const isOfficeContentNodeType = S.is(OfficeContentNodeType);
const isContentMetadataByNodeType = R.map(ContentMetadataByNodeType, (schema) => S.is(S.toEncoded(schema)));

/**
 * Identity-preserving recursive runtime schema companion for {@link OfficeContentNode}.
 *
 * **Example** (Guard a paragraph node)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OfficeContentNode } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(OfficeContentNode)({ type: "paragraph", text: "Hello" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OfficeContentNode: S.declare<OfficeContentNode> = S.declare<OfficeContentNode>(
  (input: unknown): input is OfficeContentNode => {
    if (!P.hasProperty(input, "type") || !isOfficeContentNodeType(input.type) || !isBaseContentNode(input)) {
      return false;
    }
    return (
      !P.hasProperty(input, "metadata") ||
      input.metadata === undefined ||
      isContentMetadataByNodeType[input.type](input.metadata)
    );
  }
).pipe(
  $I.annoteSchema("OfficeContentNode", {
    description: "Recursive discriminated node in the parsed Office document tree.",
  })
);

/**
 * Stores chart titles, labels, datasets, and raw text extracted from chart markup.
 *
 * @category models
 * @since 0.0.0
 */
interface ChartDataShape {
  /** Chart title (if any) */
  readonly title?: undefined | string;

  /** X-axis title (for continuous or categorical axes) */
  readonly xAxisTitle?: undefined | string;

  /** Y-axis title (for value or continuous axes) */
  readonly yAxisTitle?: undefined | string;

  /**
   * Collections of data points.
   * For bar/line charts, each dataset is one 'line' or group of bars.
   * For pie charts, there is typically only one dataset.
   */
  readonly dataSets: {
    /** Name of this data group (e.g., 'Sales 2023') */
    readonly name?: undefined | string;
    /** Actual numeric or string values for this group */
    readonly values: string[];
    /** Specific labels for each point in this dataset (if defined per point) */
    readonly pointLabels: string[];
  }[];

  /**
   * Labels for the chart facets (e.g., 'Jan', 'Feb', 'Mar' on X-axis).
   * These typically correspond to the data points in each dataSet.
   */
  readonly labels: string[];

  /** Every text node discovered in the chart XML (for keyword search/raw extraction) */
  readonly rawTexts: string[];
}

interface ChartDataSet {
  readonly name?: undefined | string;
  readonly values: string[];
  readonly pointLabels: string[];
}

const ChartDataSet = S.Class<ChartDataSet>($I`ChartDataSet`)(
  {
    name: S.optionalKey(S.String),
    values: S.Array(S.String).pipe(S.mutable),
    pointLabels: S.Array(S.String).pipe(S.mutable),
  },
  $I.annote("ChartDataSet", {
    description: "One named set of chart values and per-point labels.",
  })
);

/**
 * Runtime schema for extracted chart data.
 *
 * **Example** (Validate an empty chart)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ChartData } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(ChartData))({ dataSets: [], labels: [], rawTexts: [] })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChartData = S.Class<ChartDataShape>($I`ChartData`)(
  {
    title: S.optionalKey(S.String),
    xAxisTitle: S.optionalKey(S.String),
    yAxisTitle: S.optionalKey(S.String),
    dataSets: S.Array(ChartDataSet).pipe(S.mutable),
    labels: S.Array(S.String).pipe(S.mutable),
    rawTexts: S.Array(S.String).pipe(S.mutable),
  },
  $I.annote("ChartData", {
    description: "Chart titles, labels, datasets, and raw text extracted from chart markup.",
  })
);

/**
 * Stores an extracted binary resource and any OCR, accessibility, or chart metadata associated with it.
 *
 * **Example** (Describe an extracted image)
 *
 * ```ts
 * import { OfficeAttachment } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * const attachment: OfficeAttachment = {
 *   type: "image",
 *   mimeType: "image/png",
 *   data: "iVBORw0KGgoAAAANSUhEUgAA...",
 *   name: "chart1.png",
 *   extension: "png",
 *   ocrText: "Sales Chart Q4 2024"
 * }
 *
 * console.log(attachment.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
interface OfficeAttachmentShape {
  /**
   * The category of the attachment.
   * Helps identify what kind of content this represents.
   */
  readonly type: "image" | "chart";

  /**
   * The MIME type of the attachment data.
   * Indicates the file format and how the data should be interpreted.
   */
  readonly mimeType: OfficeMimeType;

  /**
   * The attachment content encoded as Base64.
   * This is the actual binary data of the image/chart/etc. encoded for text transmission.
   * Can be used directly in HTML img tags with data URIs or decoded to binary.
   */
  readonly data: string;

  /**
   * A unique name for this attachment file.
   * May be derived from the source file or auto-generated.
   * Used to link `ImageMetadata` nodes to their corresponding attachments.
   */
  readonly name: string;

  /**
   * The file extension (without the dot).
   * Derived from the MIME type or original filename.
   */
  readonly extension: string;

  /**
   * Text extracted from the image using Optical Character Recognition (OCR).
   * Only present when:
   * - `config.ocr` is true
   * - `config.extractAttachments` is true
   * - The attachment is an image containing text
   * Uses Tesseract.js with the language specified in `ocrConfig.language`.
   */
  readonly ocrText?: undefined | string;

  /**
   * Alt text or description associated with the image in the document.
   * Extracted from the document markup (e.g., wp:docPr descr attribute in DOCX).
   */
  readonly altText?: undefined | string;

  /**
   * Structured data extracted from a chart attachment.
   * Only present if the attachment is a chart and data extraction was successful.
   * Contains series names, values, labels, and titles.
   */
  readonly chartData?: undefined | ChartData;
}

/**
 * Runtime schema for an extracted document attachment.
 *
 * **Example** (Validate an image attachment)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OfficeAttachment } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(OfficeAttachment))({ type: "image", mimeType: "image/png", data: "AA==", name: "a.png", extension: "png" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OfficeAttachment = S.Class<OfficeAttachmentShape>($I`OfficeAttachment`)(
  {
    type: OfficeAttachmentType,
    mimeType: OfficeMimeType,
    data: S.String,
    name: S.String,
    extension: S.String,
    ocrText: S.optionalKey(S.String),
    altText: S.optionalKey(S.String),
    chartData: S.optionalKey(ChartData),
  },
  $I.annote("OfficeAttachment", {
    description: "Extracted binary resource with OCR, accessibility, or chart metadata.",
  })
);

/**
 * Preserves standard and source-native document properties discovered during parsing.
 *
 * @category models
 * @since 0.0.0
 */
interface OfficeMetadataShape {
  /** The title of the document. */
  readonly title?: undefined | string;
  /** The author of the document. */
  readonly author?: undefined | string;
  /** User who last modified the document. */
  readonly lastModifiedBy?: undefined | string;
  /** Creation date. */
  readonly created?: undefined | Date;
  /** Last modification date. */
  readonly modified?: undefined | Date;
  /** Description/Comments. */
  readonly description?: undefined | string;
  /** Subject/Topic. */
  readonly subject?: undefined | string;
  /** Number of pages (if available). */
  readonly pages?: undefined | number;
  /** Document-wide default formatting settings (font, size, color). */
  readonly formatting?: undefined | Partial<TextFormatting>;
  /** Style map for styles in the document. */
  readonly styleMap?: undefined | Record<string, Partial<TextFormatting>>;
  /**
   * User-defined custom properties embedded in the document.
   * Sources by format:
   * - DOCX/XLSX/PPTX: `docProps/custom.xml` (Office custom document properties)
   * - ODT/ODP/ODS: `meta:user-defined` elements in `meta.xml`
   * - PDF: non-standard entries in the PDF Info dictionary
   * RTF does not support custom properties; the `\info` group is not extracted.
   * Values are typed as string, number, boolean, or Date where the source format provides type information.
   */
  readonly customProperties?: undefined | Record<string, string | number | boolean | Date>;
  /** Keywords associated with the document. */
  readonly keywords?: undefined | string;
  /**
   * Contains all format-specific metadata fields extracted verbatim.
   * Consumers can use this to access properties not mapped to the standard OfficeMetadata fields.
   * Examples: all <meta> tags in HTML, app.xml properties in DOCX, XMP dicts in PDF.
   */
  readonly nativeProperties?: undefined | Record<string, unknown>;
}

const OfficeMetadataValue = S.Union([S.String, S.Finite, S.Boolean, S.Date]).pipe(
  $I.annoteSchema("OfficeMetadataValue", {
    description: "Scalar value accepted by a typed custom Office metadata property.",
  })
);

/**
 * Runtime schema for standard and source-native document properties.
 *
 * **Example** (Validate document identity)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OfficeMetadata } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(OfficeMetadata))({ title: "Annual report", pages: 12 })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OfficeMetadata = S.Class<OfficeMetadataShape>($I`OfficeMetadata`)(
  {
    title: S.optionalKey(S.String),
    author: S.optionalKey(S.String),
    lastModifiedBy: S.optionalKey(S.String),
    created: S.optionalKey(S.Date),
    modified: S.optionalKey(S.Date),
    description: S.optionalKey(S.String),
    subject: S.optionalKey(S.String),
    pages: S.optionalKey(NonNegativeInt),
    formatting: S.optionalKey(TextFormatting),
    styleMap: S.optionalKey(S.Record(S.String, TextFormatting)),
    customProperties: S.optionalKey(S.Record(S.String, OfficeMetadataValue)),
    keywords: S.optionalKey(S.String),
    nativeProperties: S.optionalKey(S.Record(S.String, S.Unknown)),
  },
  $I.annote("OfficeMetadata", {
    description: "Standard and source-native document properties discovered during parsing.",
  })
);

/**
 * Separates headers, footers, and slide masters from the main document flow.
 *
 * @category models
 * @since 0.0.0
 */
interface OfficeAuxiliaryContentShape {
  /** Headers extracted from the document. */
  readonly headers?: undefined | ReadonlyArray<OfficeContentNode>;
  /** Footers extracted from the document. */
  readonly footers?: undefined | ReadonlyArray<OfficeContentNode>;
  /** Slide Masters extracted from presentations. */
  readonly slideMasters?: undefined | ReadonlyArray<OfficeContentNode>;
}

/**
 * Runtime schema for out-of-band document layout content.
 *
 * **Example** (Validate empty auxiliary content)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OfficeAuxiliaryContent } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * console.log(S.is(S.toEncoded(OfficeAuxiliaryContent))({ headers: [], footers: [] })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OfficeAuxiliaryContent = S.Class<OfficeAuxiliaryContentShape>($I`OfficeAuxiliaryContent`)(
  {
    headers: S.Array(OfficeContentNode).pipe(S.optionalKey),
    footers: S.Array(OfficeContentNode).pipe(S.optionalKey),
    slideMasters: S.Array(OfficeContentNode).pipe(S.optionalKey),
  },
  $I.annote("OfficeAuxiliaryContent", {
    description: "Headers, footers, and slide masters separated from the main document flow.",
  })
);

/**
 * Collects parsed content, metadata, attachments, diagnostics, and conversion behavior for one source document.
 *
 * **Details**
 *
 * The shape stays consistent across PDF, Office, Markdown, and HTML sources. `content` holds the
 * main node tree, `metadata` holds document properties, `attachments` holds extracted binary
 * assets, and `auxiliary` holds headers, footers, and slide masters.
 *
 * **Example** (Inspect a parsed document tree)
 *
 * ```ts
 * import { OfficeParserAST } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 *
 * const ast: Pick<OfficeParserAST, "type" | "metadata" | "content" | "attachments" | "warnings"> = {
 *   type: "docx",
 *   metadata: {
 *     title: "Annual Report",
 *     author: "John Smith",
 *   },
 *   content: [
 *     { type: "heading", text: "Chapter 1", metadata: { level: 1 } },
 *     { type: "paragraph", text: "Hello world" },
 *   ],
 *   attachments: [],
 *   warnings: [],
 * }
 *
 * console.log(ast.type, ast.content[0]?.text)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
interface OfficeParserASTShape {
  /**
   * The original configuration used to parse this document.
   * This includes options like OCR settings, delimiter choices, and filtering flags.
   */
  readonly config: OfficeParserConfig;

  /**
   * The type of the parsed file.
   * Indicates which parser was used and what format the input was in.
   */
  readonly type: SupportedFileType;

  /**
   * Document metadata extracted from the file properties.
   * Includes information like author, title, creation date, etc.
   * Availability depends on the file format and whether metadata was present in the source.
   */
  readonly metadata: OfficeMetadata;

  /**
   * The hierarchical content structure of the document.
   * This is an array of top-level content nodes. Each node can have children, creating a tree.
   * For different file types:
   * - DOCX: Array of paragraphs, headings, tables, etc.
   * - XLSX: Array of sheets, each containing rows
   * - PPTX: Array of slides, each containing content nodes
   * - PDF: Array of pages, each containing paragraphs
   */
  readonly content: ReadonlyArray<OfficeContentNode>;

  /**
   * Out-of-band layout and template elements that are not part of the main text flow.
   * Extracted only if the respective `ignore...` config flags are false.
   * Contains elements like `headers`, `footers`, and `slideMasters`.
   */
  readonly auxiliary?: undefined | OfficeAuxiliaryContent;

  /**
   * Attachments extracted from the document (images, charts, embedded files).
   * Only populated when `config.extractAttachments` is true.
   * Each attachment includes:
   * - Base64-encoded data
   * - MIME type
   * - Optional OCR text (if `config.ocr` is true)
   */
  readonly attachments: ReadonlyArray<OfficeAttachment>;

  /** Any warnings or non-fatal issues encountered during parsing. */
  readonly warnings: ReadonlyArray<OfficeIssue>;

  /**
   * Converts the parsed document to another format without reparsing the source.
   */
  readonly to: <T extends this, D extends SupportedDestination<T["type"]>>(
    this: T,
    destination: D,
    config?: undefined | GeneratorConfig<D>
  ) => Promise<ConversionResult<D>>;
}

/**
 * Runtime schema for a parsed Office document AST and its conversion capability.
 *
 * **Example** (Validate a parsed document shell)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { OfficeParserAST } from "../../../metadata/services/officeparser/OfficeParser.models.ts"
 * const to = async () => ({ value: "", messages: [] })
 * console.log(S.is(S.toEncoded(OfficeParserAST))({ config: {}, type: "docx", metadata: {}, content: [], attachments: [], warnings: [], to })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OfficeParserAST = S.Class<OfficeParserASTShape>($I`OfficeParserAST`)(
  {
    config: OfficeParserConfig,
    type: SupportedFileType,
    metadata: OfficeMetadata,
    content: S.Array(OfficeContentNode),
    auxiliary: S.optionalKey(OfficeAuxiliaryContent),
    attachments: S.Array(OfficeAttachment),
    warnings: S.Array(OfficeIssue),
    to: runtimeFunction<OfficeParserASTShape["to"]>(),
  },
  $I.annote("OfficeParserAST", {
    description: "Parsed document content, metadata, attachments, diagnostics, and conversion capability.",
  })
);
