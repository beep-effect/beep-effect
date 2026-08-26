import { $ScratchpadId } from "@beep/identity";
// import * as Context from "effect/Context";
// import officeparser from "officeparser";
// import * as S from "effect/Schema";
import { LiteralKit } from "@beep/schema/LiteralKit";
// import * as SchemaUtils from "@beep/schema/SchemaUtils";
// import * as Tuple from "effect/Tuple";
// import {cast, pipe} from "effect/Function";
// import * as A from "@beep/utils/Array";
// import * as R from "@beep/utils/Record";
// import * as Struct from "@beep/utils/Struct";
// import {EmptyStructError, entries} from "@beep/utils/Struct";
// import {Match} from "effect";
// import * as O from "effect/Option";

const $I = $ScratchpadId.create("metadata/services/officeparser/OfficeParser.models");

/**
 * Enumerates stable failure codes emitted by OfficeParser parsing and generation operations.
 *
 * **Example** (Inspect an error code)
 *
 * ```ts
 * const code = OfficeErrorType.Options[0]
 *
 * console.log(code)
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
    description: "",
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
 * Enumerates stable warning codes for non-fatal OfficeParser conditions.
 *
 * **Example** (Inspect a warning code)
 *
 * ```ts
 * const code = OfficeWarningType.Options[0]
 *
 * console.log(code)
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
]);

/**
 * Decoded warning-code value selected by the runtime `OfficeWarningType` literal kit.
 *
 * @see {@link OfficeWarningType} for the runtime literal helpers and allowed values.
 * @category type-level
 * @since 0.0.0
 */
export type OfficeWarningType = typeof OfficeWarningType.Type;

/**
 * Consolidated timeout settings for OCR operations.
 * Preferred over the individual flat timeout properties on {@link OcrConfig},
 * which are now deprecated.
 *
 * **Details**
 *
 * If a key is present here, it takes priority over the corresponding deprecated
 * flat property (e.g. `timeout.autoTerminate` wins over `autoTerminateTimeout`).
 * Set any value to `0` to disable that specific timeout.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface OcrTimeoutConfig {
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
   * Set to `0` to keep workers alive indefinitely (useful when you want to
   * call {@link terminateOcr} manually at shutdown time).
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
 * Controls OCR language data, worker assets, cancellation, and timeouts during attachment extraction.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface OcrConfig {
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
   * Consolidated timeout settings for all OCR operations.
   *
   * **Details**
   *
   * Prefer this over the deprecated flat timeout properties.
   * If `timeout.autoTerminate` is set, it takes priority over the deprecated `autoTerminateTimeout`.
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
 * Controls parsing behavior that applies regardless of the detected Office format.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface CommonOfficeParserConfig {
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
   * Shared OCR configuration for worker pooling and offline support.
   * If provided, `ocrLanguage` will be ignored in favor of `ocrConfig.language`.
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
export interface HtmlParserConfig {
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
 * Caps archive expansion and table-cell materialization before malformed documents consume excessive memory.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface DecompressionLimits {
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
export interface OfficeIssue {
  /** The severity of the issue. */
  readonly type: "warning" | "info" | "error";
  /** Human-readable message text. */
  readonly message: string;
  /** The specific AST node that triggered this issue, if applicable. */
  readonly node?: undefined | OfficeContentNode;
  /** A unique error code for programmatic handling. */
  readonly code: OfficeWarningType | OfficeErrorType;
  /** Optional additional context or original error object. */
  readonly details?: undefined | any;
}

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
export interface ConversionResult<D extends UniversalGeneratorFormat> {
  /** The actual generated content (HTML, Markdown, Text, OfficeChunk[], etc.). */
  readonly value: ConversionValue<D>;
  /** A collection of issues (warnings/infos) generated during the process. */
  readonly messages: OfficeIssue[];
}

/**
 * Lists destination formats available for every supported source document.
 *
 * @category type-level
 * @since 0.0.0
 */
export type UniversalGeneratorFormat = "text" | "md" | "html" | "pdf" | "csv" | "rtf" | "chunks" | "epub";

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
export interface MetadataOverrides {
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

/**
 * Controls parsing-independent behavior shared by every document generator.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface CommonGeneratorConfig {
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
export interface HtmlInjectionConfig {
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
 * Selects which parts of a complete HTML document surround generated content.
 *
 * **Details**
 *
 * Boolean `true` enables the full document envelope, while `false` emits only the content fragment. In object form, omitted fields keep their standalone defaults.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface StandaloneConfig {
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
 * Controls HTML document wrapping, assets, layout, and embed handling.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface HtmlGeneratorConfig {
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
 * Controls page layout, browser launch settings, and rendering timeouts for PDF output.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface PdfGeneratorConfig {
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
  readonly launchOptions?: undefined | any;
  /**
   * Timeout in milliseconds for PDF generation.
   * Limits the time spent waiting for Puppeteer to launch, load content, and render PDF.
   * Defaults to 30000 ms (30 seconds). Set to 0 to disable.
   */
  readonly timeout?: undefined | number;
}

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
export interface StructuredStyleMapping {
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

/**
 * Reserves destination-specific settings for RTF output.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface RtfGeneratorConfig {
  // Reserved for future RTF-specific options like page size or font embedding
}

/**
 * Controls sheet selection, sheet merging, and delimiters for CSV output.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface CsvGeneratorConfig {
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
 * Selects a named group of Markdown syntax choices for generation.
 *
 * **Details**
 *
 * The `extended` preset preserves the library's historical output with all supported extensions enabled and GitHub-style admonitions.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownDialectPreset = "extended" | "github" | "gitlab" | "obsidian" | "pandoc" | "commonmark";

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
 * @category type-level
 * @since 0.0.0
 */
export type AdmonitionSyntax = "blockquote" | "fence" | "fence-attribute" | "none";
/**
 * Selects `==text==` highlighting or disables highlight syntax.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HighlightSyntax = "equals" | "none";
/**
 * Selects GFM `~~text~~` strikethrough or disables strikethrough syntax.
 *
 * @category type-level
 * @since 0.0.0
 */
export type StrikethroughSyntax = "tilde" | "none";
/**
 * Selects colon-based definition lists or disables definition-list syntax.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DefinitionListSyntax = "colon" | "none";
/**
 * Selects caret-based `[^id]` footnotes or disables footnote syntax.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FootnoteSyntax = "caret" | "none";
/**
 * Selects `[@citekey]` citations or disables citation syntax.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CitationSyntax = "at" | "none";
/**
 * Selects `[[Page]]` wikilinks or disables wikilink syntax.
 *
 * @category type-level
 * @since 0.0.0
 */
export type WikilinkSyntax = "double-bracket" | "none";
/**
 * Selects brace-delimited attribute lists or disables attribute-list syntax.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AttributeListSyntax = "brace" | "none";
/**
 * Selects how embedded media nodes are written to Markdown.
 *
 * **Details**
 *
 * `html` preserves the historical `<div>` or `<iframe>` output. `directive` emits remark-directive leaves for compatible editors. `link` emits a plain media link. `thumbnail` emits a linked YouTube preview and falls back to a link for other providers.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EmbedSyntax = "html" | "directive" | "link" | "thumbnail";

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
export interface MarkdownDialectConfig {
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
   * Pandoc-style `[@citekey]` citations (`'at'`), or `'none'` to emit `[citekey]` (brackets, no
   * `@`). Omit to inherit from `extends`. Passing a boolean is deprecated: `true` = `'at'`,
   * `false` = `'none'` (removed next major).
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
 * Selects which unsupported Markdown features may fall back to raw HTML.
 *
 * **Details**
 *
 * Boolean form toggles every fallback through `MdGeneratorConfig.fallbackToHtml`. Object form controls them independently, and omitted fields remain enabled.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface FallbackToHtmlConfig {
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
 * Controls Markdown dialect selection and raw-HTML fallbacks.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface MdGeneratorConfig {
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
 * Controls line endings, layout preservation, and note rendering in plain-text output.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface TextGeneratorConfig {
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

// ─── Chunking Types ───────────────────────────────────────────────────────────

/**
 * Selects how parsed content is divided for retrieval pipelines.
 *
 * **Details**
 *
 * `fixed-size` uses size and overlap limits. `document-structure` follows source boundaries. `semantic` uses embedding similarity to detect topic changes.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ChunkingStrategy = "fixed-size" | "document-structure" | "semantic";

/**
 * Defines limits and metadata behavior shared by every chunking strategy.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface BaseChunkingConfig {
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
 * Splits text by size and overlap using an ordered separator list.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface FixedSizeChunkingConfig extends BaseChunkingConfig {
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
 * Splits content at source-defined boundaries such as headings, pages, slides, and sheets.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface DocumentStructureChunkingConfig extends BaseChunkingConfig {
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
 * Splits content where embedding similarity indicates a topic change.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface SemanticChunkingConfig extends BaseChunkingConfig {
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
 * Selects the settings required by each supported chunking strategy.
 *
 * @category configuration
 * @since 0.0.0
 */
export type ChunkingConfig = FixedSizeChunkingConfig | DocumentStructureChunkingConfig | SemanticChunkingConfig;

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
export interface OfficeChunk {
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
    readonly [key: string]: any;
  };

  /** The start character index of this chunk in the full document text. Only set when `addStartIndex` is true. */
  readonly startIndex?: undefined | number;
  /** The end character index of this chunk in the full document text. Only set when `addStartIndex` is true. */
  readonly endIndex?: undefined | number;
}

// ─── End Chunking Types ────────────────────────────────────────────────────────

/**
 * Lists source formats accepted by the parser.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SupportedFileType =
  | "docx"
  | "pptx"
  | "xlsx"
  | "odt"
  | "odp"
  | "ods"
  | "pdf"
  | "rtf"
  | "md"
  | "html"
  | "csv"
  | "epub";

/**
 * A structural stand-in for the web `Blob`/`File` so `parseOffice`/`convert` accept them in the
 * browser without pulling the DOM lib into this package's types. Any object with an
 * `arrayBuffer()` method qualifies. When `name` is present (as on a `File`) it is used only for
 * extension-based type detection, never as a filesystem path.
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
 * @category type-level
 * @since 0.0.0
 */
export type OfficeContentNodeType =
  | "paragraph"
  | "heading"
  | "table"
  | "list"
  | "text"
  | "image"
  | "chart"
  | "drawing"
  | "slide"
  | "note"
  | "sheet"
  | "row"
  | "cell"
  | "page"
  | "break"
  | "code"
  | "comment"
  | "header"
  | "footer"
  | "slideMaster"
  | "embed"
  | "admonition"
  | "definitionList"
  | "definitionTerm"
  | "definitionDescription";

/**
 * Lists media types used for extracted attachments.
 *
 * @category type-level
 * @since 0.0.0
 */
export type OfficeMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/bmp"
  | "image/tiff"
  | "image/svg+xml"
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  | "application/vnd.oasis.opendocument.chart"
  | "application/vnd.oasis.opendocument.spreadsheet"
  | "application/vnd.oasis.opendocument.text"
  | "application/vnd.oasis.opendocument.presentation"
  | "application/rtf"
  | "text/csv"
  | "text/markdown"
  | "text/html";

/**
 * Constrains alignment values shared by text, paragraph, and spreadsheet metadata.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TextAlignment = "left" | "center" | "right" | "justify";

/**
 * Captures formatting that was explicitly applied to a text run.
 *
 * @category models
 * @since 0.0.0
 */
export interface TextFormatting {
  /**
   * Whether the text is bold.
   * Corresponds to `<w:b/>` in OOXML, `\b` in RTF.
   *
   * **Example** (Mark text as bold)
   *
   * ```ts
   * const bold: TextFormatting["bold"] = true
   * console.log(bold)
   * ```
   */
  readonly bold?: undefined | boolean;

  /**
   * Whether the text is italic.
   * Corresponds to `<w:i/>` in OOXML, `\i` in RTF.
   *
   * **Example** (Mark text as italic)
   *
   * ```ts
   * const italic: TextFormatting["italic"] = true
   * console.log(italic)
   * ```
   */
  readonly italic?: undefined | boolean;

  /**
   * Whether the text is underlined.
   * Corresponds to `<w:u/>` in OOXML, `\ul` in RTF.
   *
   * **Example** (Mark text as underlined)
   *
   * ```ts
   * const underline: TextFormatting["underline"] = true
   * console.log(underline)
   * ```
   */
  readonly underline?: undefined | boolean;

  /**
   * Whether the text has a strikethrough.
   * Corresponds to `<w:strike/>` in OOXML, `\strike` in RTF.
   *
   * **Example** (Mark text as struck through)
   *
   * ```ts
   * const strikethrough: TextFormatting["strikethrough"] = true
   * console.log(strikethrough)
   * ```
   */
  readonly strikethrough?: undefined | boolean;

  /**
   * Text color in hex format (#RRGGBB).
   * Extracted from color tables in RTF or XML color attributes in OOXML.
   *
   * **Example** (Set a foreground color)
   *
   * ```ts
   * const color: TextFormatting["color"] = "#ff0000"
   * console.log(color)
   * ```
   */
  readonly color?: undefined | string;

  /**
   * Background/highlight color in hex format (#RRGGBB).
   * Preserves either a background fill or source text highlighting.
   *
   * **Example** (Set a highlight color)
   *
   * ```ts
   * const backgroundColor: TextFormatting["backgroundColor"] = "#ffff00"
   * console.log(backgroundColor)
   * ```
   */
  readonly backgroundColor?: undefined | string;

  /**
   * Font size with units.
   * Most parsers append 'pt' (points), but ODF may use other units like 'in' (inches) or 'cm'.
   *
   * **Example** (Set a font size)
   *
   * ```ts
   * const size: TextFormatting["size"] = "12pt"
   * console.log(size)
   * ```
   */
  readonly size?: undefined | string;

  /**
   * Font family/typeface name.
   * Extracted from font tables in RTF or font definitions in OOXML.
   *
   * **Example** (Set a font family)
   *
   * ```ts
   * const font: TextFormatting["font"] = "Arial"
   * console.log(font)
   * ```
   */
  readonly font?: undefined | string;

  /**
   * Whether the text is subscript (e.g., H₂O).
   * Corresponds to `\sub` in RTF, `<w:vertAlign w:val="subscript"/>` in OOXML.
   * Mutually exclusive with superscript.
   *
   * **Example** (Mark text as subscript)
   *
   * ```ts
   * const subscript: TextFormatting["subscript"] = true
   * console.log(subscript)
   * ```
   */
  readonly subscript?: undefined | boolean;

  /**
   * Whether the text is superscript (e.g., E=mc²).
   * Corresponds to `\super` in RTF, `<w:vertAlign w:val="superscript"/>` in OOXML.
   * Mutually exclusive with subscript.
   *
   * **Example** (Mark text as superscript)
   *
   * ```ts
   * const superscript: TextFormatting["superscript"] = true
   * console.log(superscript)
   * ```
   */
  readonly superscript?: undefined | boolean;

  /**
   * The alignment of the text.
   * Common in spreadsheet cells or paragraph styles.
   *
   * **Example** (Align a text run)
   *
   * ```ts
   * const alignment: TextFormatting["alignment"] = "center"
   * console.log(alignment)
   * ```
   */
  readonly alignment?: undefined | TextAlignment;
}

/**
 * Locates a content node within a presentation slide and its related note or anchors.
 *
 * @category models
 * @since 0.0.0
 */
export interface SlideMetadata {
  /** The slide number (1-based). */
  readonly slideNumber: number;

  /**
   * The unique ID of the note associated with this slide (if any).
   *
   * **Example** (Reference a slide note)
   *
   * ```ts
   * const noteId: SlideMetadata["noteId"] = "slide-note-1"
   * console.log(noteId)
   * ```
   */
  readonly noteId?: undefined | string;

  /** The style of the slide. */
  readonly style?: undefined | string;
  /** Unique anchor IDs for internal linking. */
  readonly anchorIds?: undefined | string[];
}

/**
 * Locates a content node within a workbook sheet and preserves its style and anchors.
 *
 * @category models
 * @since 0.0.0
 */
export interface SheetMetadata {
  /** The name of the sheet. */
  readonly sheetName: string;
  /** The style of the sheet. */
  readonly style?: undefined | string;
  /** Unique anchor IDs for internal linking. */
  readonly anchorIds?: undefined | string[];
}

/**
 * Records paragraph indentation measurements, typically in OOXML twips.
 *
 * @category models
 * @since 0.0.0
 */
export interface IndentationMetadata {
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
 * Records a heading's level, alignment, style, indentation, and anchors.
 *
 * @category models
 * @since 0.0.0
 */
export interface HeadingMetadata {
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
 * Records a paragraph's alignment, style, indentation, and anchors.
 *
 * @category models
 * @since 0.0.0
 */
export interface ParagraphMetadata {
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
 * Identifies a list item and records its nesting, alignment, task state, and source style.
 *
 * @category models
 * @since 0.0.0
 */
export interface ListMetadata {
  /**
   * The type of list: 'ordered' (numbered) or 'unordered' (bulleted).
   *
   * **Example** (Identify an ordered list)
   *
   * ```ts
   * const listType: ListMetadata["listType"] = "ordered"
   * console.log(listType)
   * ```
   */
  readonly listType: "ordered" | "unordered";

  /**
   * The nesting level (indent level) of the list item, starting from 0.
   *
   * **Example** (Represent a nested list item)
   *
   * ```ts
   * const indentation: ListMetadata["indentation"] = 1
   * console.log(indentation)
   * ```
   */
  readonly indentation: number;

  /** Detailed indentation information. */
  readonly paragraphIndentation?: undefined | IndentationMetadata;

  /**
   * Text alignment of the list item.
   *
   * **Example** (Align a list item)
   *
   * ```ts
   * const alignment: ListMetadata["alignment"] = "justify"
   * console.log(alignment)
   * ```
   */
  readonly alignment: TextAlignment;

  /**
   * The list ID from the Word document's numbering definition.
   * Used to identify which list definition this item belongs to.
   *
   * **Example** (Identify a list definition)
   *
   * ```ts
   * const listId: ListMetadata["listId"] = "2"
   * console.log(listId)
   * ```
   */
  readonly listId: string;

  /**
   * The zero-based index of this item within its list.
   * Continues incrementing even across paragraph interruptions for the same listId.
   *
   * **Example** (Index a list item)
   *
   * ```ts
   * const itemIndex: ListMetadata["itemIndex"] = 2
   * console.log(itemIndex)
   * ```
   */
  readonly itemIndex: number;

  /**
   * The style name of the list item.
   *
   * **Example** (Name a list style)
   *
   * ```ts
   * const style: ListMetadata["style"] = "ListParagraph"
   * console.log(style)
   * ```
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
 * Locates a cell within a parsed table and records spans, alignment, style, and color.
 *
 * @category models
 * @since 0.0.0
 */
export interface CellMetadata {
  /**
   * The row index of the cell (0-based).
   *
   * **Example** (Index the first row)
   *
   * ```ts
   * const row: CellMetadata["row"] = 0
   * console.log(row)
   * ```
   */
  readonly row: number;
  /**
   * The column index of the cell (0-based).
   *
   * **Example** (Index the first column)
   *
   * ```ts
   * const column: CellMetadata["col"] = 0
   * console.log(column)
   * ```
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
   *
   * **Example** (Span two rows)
   *
   * ```ts
   * const rowSpan: CellMetadata["rowSpan"] = 2
   * console.log(rowSpan)
   * ```
   */
  readonly rowSpan?: undefined | number;
  /**
   * The number of columns this cell spans (merges).
   *
   * **Example** (Span two columns)
   *
   * ```ts
   * const columnSpan: CellMetadata["colSpan"] = 2
   * console.log(columnSpan)
   * ```
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
 * Preserves table anchors and page alignment.
 *
 * @category models
 * @since 0.0.0
 */
export interface TableMetadata {
  /** Unique anchor IDs for internal linking. */
  readonly anchorIds?: undefined | string[];
  /**
   * Layout alignment of the table on the page (e.g. an editor's custom table node).
   *
   * **Example** (Center a table)
   *
   * ```ts
   * const alignment: TableMetadata["align"] = "center"
   * console.log(alignment)
   * ```
   */
  readonly align?: undefined | "left" | "center" | "right";
}

/**
 * Links a chart node to the attachment that stores its extracted chart data.
 *
 * @category models
 * @since 0.0.0
 */
export interface ChartMetadata {
  /**
   * The name of the attachment that contains the actual chart data.
   * Use this to look up the full chart data from the attachments array.
   *
   * **Example** (Reference chart data)
   *
   * ```ts
   * const attachmentName: ChartMetadata["attachmentName"] = "chart1.xml"
   * console.log(attachmentName)
   * ```
   */
  readonly attachmentName: string;
  /** Unique anchor IDs for internal linking. */
  readonly anchorIds?: undefined | string[];
}

/**
 * Links an image node to its attachment and preserves display metadata.
 *
 * @category models
 * @since 0.0.0
 */
export interface ImageMetadata {
  /**
   * The name of the attachment that contains the actual image data.
   * Use this to look up the full image data from the attachments array.
   *
   * **Example** (Reference an image)
   *
   * ```ts
   * const attachmentName: ImageMetadata["attachmentName"] = "image1.png"
   * console.log(attachmentName)
   * ```
   */
  readonly attachmentName: string;

  /**
   * Alt text (alternative text) describing the image.
   * Extracted from image properties in the document.
   *
   * **Example** (Describe an image)
   *
   * ```ts
   * const altText: ImageMetadata["altText"] = "Company logo"
   * console.log(altText)
   * ```
   */
  readonly altText?: undefined | string;

  /**
   * URL of the image if it is an external link.
   * Typical for HTML or Markdown images that point to remote servers.
   *
   * **Example** (Reference an external image)
   *
   * ```ts
   * const url: ImageMetadata["url"] = "https://example.com/image.png"
   * console.log(url)
   * ```
   */
  readonly url?: undefined | string;
  /** Unique anchor IDs for internal linking. */
  readonly anchorIds?: undefined | string[];
  /**
   * Display width of the image (e.g. an editor's custom image node), as a CSS length or percentage.
   *
   * **Example** (Set an image width)
   *
   * ```ts
   * const width: ImageMetadata["width"] = "50%"
   * console.log(width)
   * ```
   */
  readonly width?: undefined | string;
  /**
   * Layout alignment of the image (e.g. an editor's custom image node).
   *
   * **Example** (Center an image)
   *
   * ```ts
   * const alignment: ImageMetadata["align"] = "center"
   * console.log(alignment)
   * ```
   */
  readonly align?: undefined | "left" | "center" | "right";
  /** Advisory image title (Markdown `![alt](url "title")`, HTML `<img title>`), if any. */
  readonly title?: undefined | string;
}

/**
 * Preserves the source, dimensions, alignment, and label of embedded external media.
 *
 * @category models
 * @since 0.0.0
 */
export interface EmbedMetadata {
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
 * Preserves an admonition's kind, title, and parsed Markdown syntax.
 *
 * @category models
 * @since 0.0.0
 */
export interface AdmonitionMetadata {
  readonly admonitionType: "note" | "tip" | "important" | "warning" | "caution";
  /** Optional custom title; falls back to the type label. */
  readonly title?: undefined | string;
  /** Which concrete input syntax produced this node. Always populated by the parser. */
  readonly sourceSyntax?: undefined | "github" | "gitlab";
}

/**
 * Identifies the source PDF page for a content node.
 *
 * @category models
 * @since 0.0.0
 */
export interface PageMetadata {
  /**
   * The page number (1-based) from the PDF document.
   *
   * **Example** (Identify the first page)
   *
   * ```ts
   * const pageNumber: PageMetadata["pageNumber"] = 1
   * console.log(pageNumber)
   * ```
   */
  readonly pageNumber: number;
}

/**
 * Preserves links, citations, abbreviations, wikilinks, and style data for a text run.
 *
 * @category models
 * @since 0.0.0
 */
export interface TextMetadata {
  /** Style name of the text */
  readonly style?: undefined | string;

  /**
   * The hyperlink URL (for external links) or anchor reference (for internal links).
   *
   * **Example** (Link a text run)
   *
   * ```ts
   * const link: TextMetadata["link"] = "https://example.com"
   * console.log(link)
   * ```
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
   * (`[@citekey]`), and this is the bare citekey (e.g. "smith2024"). Bibliography
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
 * Identifies a footnote or endnote and records its source anchors and reference state.
 *
 * @category models
 * @since 0.0.0
 */
export interface NoteMetadata {
  /**
   * Type of note: 'footnote' or 'endnote'.
   */
  readonly noteType?: undefined | "footnote" | "endnote";

  /**
   * The unique ID of the note from the source document.
   *
   * **Example** (Identify a note)
   *
   * ```ts
   * const noteId: NoteMetadata["noteId"] = "1"
   * console.log(noteId)
   * ```
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
 * Distinguishes line, page, column, thematic, and other document breaks.
 *
 * @category models
 * @since 0.0.0
 */
export interface BreakMetadata {
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
 * Preserves the language, anchors, and math status of a code block.
 *
 * @category models
 * @since 0.0.0
 */
export interface CodeMetadata {
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
 * Associates comment content with a document node.
 *
 * @category models
 * @since 0.0.0
 */
export interface CommentMetadata {
  readonly author?: undefined | string;
  readonly initials?: undefined | string;
  readonly date?: undefined | string;
  readonly commentId?: undefined | string;
}

/**
 * Marks content extracted from a document header or footer.
 *
 * @category models
 * @since 0.0.0
 */
export interface HeaderFooterMetadata {
  readonly type: "default" | "first" | "even" | string;
}

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
 * Defines fields shared by every node in the parsed document tree.
 *
 * **Details**
 *
 * Container nodes use `children` for nested document structure, while leaf nodes store their text and formatting directly.
 *
 * **Example** (Represent shared paragraph fields)
 *
 * ```ts
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
export interface BaseContentNode {
  /**
   * The complete text content of the node and all its children combined.
   * For container nodes (paragraph, heading), this is the concatenation of all child text.
   * For leaf nodes (text), this is the actual text content.
   *
   * **Example** (Store combined node text)
   *
   * ```ts
   * const text: BaseContentNode["text"] = "Hello world"
   * console.log(text)
   * ```
   */
  readonly text?: undefined | string;

  /**
   * Child nodes that make up this node's content.
   * Used for hierarchical structures:
   * - Paragraphs contain text runs with different formatting
   * - Tables contain rows
   * - Rows contain cells
   * - Cells contain paragraphs
   *
   * **Example** (Add a formatted child node)
   *
   * ```ts
   * const children: BaseContentNode["children"] = [{ type: "text", text: "Hello", formatting: { bold: true } }]
   * console.log(children)
   * ```
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
   *
   * **Example** (Describe text formatting)
   *
   * ```ts
   * const formatting: BaseContentNode["formatting"] = { bold: true, size: "12pt", font: "Arial" }
   * console.log(formatting)
   * ```
   */
  readonly formatting?: undefined | TextFormatting;

  /**
   * The raw source content for this node.
   * - For XML-based formats (DOCX, XLSX, PPTX): contains the raw XML
   * - For RTF: contains the raw RTF markup
   * - For PDF: typically not available
   * Only populated when `config.includeRawContent` is true.
   * Useful for debugging or when you need access to format-specific features.
   *
   * **Example** (Retain source markup)
   *
   * ```ts
   * const rawContent: BaseContentNode["rawContent"] = "<w:p><w:r><w:t>Hello</w:t></w:r></w:p>"
   * console.log(rawContent)
   * ```
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
   *
   * **Example** (Retain HTML attributes)
   *
   * ```ts
   * const htmlAttributes: BaseContentNode["htmlAttributes"] = { "data-tracking-id": "abc123", class: "lead" }
   * console.log(htmlAttributes)
   * ```
   */
  readonly htmlAttributes?: undefined | Record<string, string>;
}

/**
 * Models one discriminated node in the parsed document tree.
 *
 * **Example** (Build a paragraph node)
 *
 * ```ts
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

/**
 * Stores chart titles, labels, datasets, and raw text extracted from chart markup.
 *
 * @category models
 * @since 0.0.0
 */
export interface ChartData {
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

/**
 * Stores an extracted binary resource and any OCR, accessibility, or chart metadata associated with it.
 *
 * **Example** (Describe an extracted image)
 *
 * ```ts
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
export interface OfficeAttachment {
  /**
   * The category of the attachment.
   * Helps identify what kind of content this represents.
   *
   * **Example** (Identify an image attachment)
   *
   * ```ts
   * const type: OfficeAttachment["type"] = "image"
   * console.log(type)
   * ```
   */
  readonly type: "image" | "chart";

  /**
   * The MIME type of the attachment data.
   * Indicates the file format and how the data should be interpreted.
   *
   * **Example** (Record an image media type)
   *
   * ```ts
   * const mimeType: OfficeAttachment["mimeType"] = "image/png"
   * console.log(mimeType)
   * ```
   */
  readonly mimeType: OfficeMimeType;

  /**
   * The attachment content encoded as Base64.
   * This is the actual binary data of the image/chart/etc. encoded for text transmission.
   * Can be used directly in HTML img tags with data URIs or decoded to binary.
   *
   * **Example** (Store Base64 attachment data)
   *
   * ```ts
   * const data: OfficeAttachment["data"] = "iVBORw0KGgoAAAANSUhEUgAA..."
   * console.log(data)
   * ```
   */
  readonly data: string;

  /**
   * A unique name for this attachment file.
   * May be derived from the source file or auto-generated.
   * Used to link `ImageMetadata` nodes to their corresponding attachments.
   *
   * **Example** (Name an attachment)
   *
   * ```ts
   * const name: OfficeAttachment["name"] = "image1.png"
   * console.log(name)
   * ```
   */
  readonly name: string;

  /**
   * The file extension (without the dot).
   * Derived from the MIME type or original filename.
   *
   * **Example** (Record a file extension)
   *
   * ```ts
   * const extension: OfficeAttachment["extension"] = "png"
   * console.log(extension)
   * ```
   */
  readonly extension: string;

  /**
   * Text extracted from the image using Optical Character Recognition (OCR).
   * Only present when:
   * - `config.ocr` is true
   * - `config.extractAttachments` is true
   * - The attachment is an image containing text
   * Uses Tesseract.js with the language specified in `config.ocrLanguage`.
   *
   * **Example** (Store OCR output)
   *
   * ```ts
   * const ocrText: OfficeAttachment["ocrText"] = "Annual Revenue: $1.2M"
   * console.log(ocrText)
   * ```
   */
  readonly ocrText?: undefined | string;

  /**
   * Alt text or description associated with the image in the document.
   * Extracted from the document markup (e.g., wp:docPr descr attribute in DOCX).
   *
   * **Example** (Describe an attachment)
   *
   * ```ts
   * const altText: OfficeAttachment["altText"] = "A chart showing sales growth"
   * console.log(altText)
   * ```
   */
  readonly altText?: undefined | string;

  /**
   * Structured data extracted from a chart attachment.
   * Only present if the attachment is a chart and data extraction was successful.
   * Contains series names, values, labels, and titles.
   *
   * **Example** (Attach structured chart data)
   *
   * ```ts
   * const chartData: OfficeAttachment["chartData"] = {
   *   dataSets: [],
   *   labels: [],
   *   rawTexts: []
   * }
   *
   * console.log(chartData?.dataSets.length)
   * ```
   */
  readonly chartData?: undefined | ChartData;
}

/**
 * Preserves standard and source-native document properties discovered during parsing.
 *
 * @category models
 * @since 0.0.0
 */
export interface OfficeMetadata {
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
  readonly nativeProperties?: undefined | Record<string, any>;
}

/**
 * Separates headers, footers, and slide masters from the main document flow.
 *
 * @category models
 * @since 0.0.0
 */
export interface OfficeAuxiliaryContent {
  /** Headers extracted from the document. */
  readonly headers?: undefined | ReadonlyArray<OfficeContentNode>;
  /** Footers extracted from the document. */
  readonly footers?: undefined | ReadonlyArray<OfficeContentNode>;
  /** Slide Masters extracted from presentations. */
  readonly slideMasters?: undefined | ReadonlyArray<OfficeContentNode>;
}

/**
 * Collects parsed content, metadata, attachments, diagnostics, and conversion behavior for one source document.
 *
 * **Details**
 *
 * The shape stays consistent across PDF, Office, Markdown, and HTML sources. `content` holds the
 * main node tree, `metadata` holds document properties, `attachments` holds extracted binary
 * assets, and `auxiliary` holds headers, footers, and slide masters.
 *
 * **Example** (Inspect source and destination types)
 *
 * ```ts
 * const sourceType: OfficeParserAST["type"] = "docx"
 * type Destination = Parameters<OfficeParserAST["to"]>[0]
 * const destination: Destination = "md"
 *
 * console.log({ sourceType, destination })
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface OfficeParserAST {
  /**
   * The original configuration used to parse this document.
   * This includes options like OCR settings, delimiter choices, and filtering flags.
   */
  readonly config: OfficeParserConfig;

  /**
   * The type of the parsed file.
   * Indicates which parser was used and what format the input was in.
   *
   * **Example** (Identify the source format)
   *
   * ```ts
   * const sourceType: OfficeParserAST["type"] = "docx"
   * console.log(sourceType)
   * ```
   */
  readonly type: SupportedFileType;

  /**
   * Document metadata extracted from the file properties.
   * Includes information like author, title, creation date, etc.
   * Availability depends on the file format and whether metadata was present in the source.
   *
   * **Example** (Describe parsed document metadata)
   *
   * ```ts
   * const metadata: OfficeParserAST["metadata"] = {
   *   author: "John Smith",
   *   title: "Annual Report",
   *   created: new Date("2024-01-01")
   * }
   *
   * console.log(metadata.title)
   * ```
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
   *
   * **Example** (Store top-level content nodes)
   *
   * ```ts
   * const content: OfficeParserAST["content"] = [
   *   { type: "paragraph", text: "Hello" },
   *   { type: "heading", text: "Chapter 1", metadata: { level: 1 } }
   * ]
   *
   * console.log(content.length)
   * ```
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
   *
   * **Example** (Store extracted attachments)
   *
   * ```ts
   * const attachments: OfficeParserAST["attachments"] = [
   *   { type: "image", mimeType: "image/png", data: "base64...", name: "image1.png", extension: "png" }
   * ]
   *
   * console.log(attachments.length)
   * ```
   */
  readonly attachments: ReadonlyArray<OfficeAttachment>;

  /** Any warnings or non-fatal issues encountered during parsing. */
  readonly warnings: ReadonlyArray<OfficeIssue>;

  /**
   * Converts the parsed document to another format without reparsing the source.
   *
   * **Example** (Select a conversion destination)
   *
   * ```ts
   * type Convert = OfficeParserAST["to"]
   * const destination: Parameters<Convert>[0] = "html"
   *
   * console.log(destination)
   * ```
   *
   */
  readonly to: <T extends this, D extends SupportedDestination<T["type"]>>(
    this: T,
    destination: D,
    config?: undefined | GeneratorConfig<D>
  ) => Promise<ConversionResult<D>>;
}
