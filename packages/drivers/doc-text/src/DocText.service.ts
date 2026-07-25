/**
 * JS-native PDF and DOCX text extraction engine.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ExtractionResult } from "@beep/file-processing/Extraction";
import { DetectionResult, FileProcessingOperationError } from "@beep/file-processing/Operation";
import { classifyFormatFromExtension, FileProcessingEngineDescriptor } from "@beep/file-processing/Strategy";
import { A, O } from "@beep/utils";
import { Effect, Match } from "effect";
import * as Str from "effect/String";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { makeDocTextError } from "./DocText.errors.ts";
import type {
  DetectFileOperation,
  ExportArchiveOperation,
  ExtractFileOperation,
} from "@beep/file-processing/Operation";
import type { FileProcessingEngineShape } from "@beep/file-processing/Service";
import type { DocTextError } from "./DocText.errors.ts";

/**
 * JS-native document text file-processing engine descriptor.
 *
 * The capability contract currently groups text engines under the `tika`
 * engine family; the concrete `doc-text-js` name distinguishes this runtime.
 *
 * @example
 * ```ts
 * import { DocTextFileProcessingEngineDescriptor } from "@beep/doc-text"
 *
 * console.log(DocTextFileProcessingEngineDescriptor.supportedFormats) // ["pdf-text-layer", "docx"]
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const DocTextFileProcessingEngineDescriptor = FileProcessingEngineDescriptor.make({
  capabilities: ["detect", "extract-text"],
  engine: "tika",
  name: "doc-text-js",
  supportedFormats: ["pdf-text-layer", "docx"],
});

const operationFailure = (operation: ExtractFileOperation, error: DocTextError): FileProcessingOperationError =>
  Match.value(error.reason).pipe(
    Match.when("empty-text-layer", () =>
      FileProcessingOperationError.fromReason("file-extraction-failed", {
        artifactId: operation.source.id,
        details: { outcome: "empty-text-layer", ocr: "disabled" },
        engine: DocTextFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: "The PDF has no extractable text layer and OCR is disabled.",
        operationId: operation.operationId,
      })
    ),
    Match.when("source-bytes-unavailable", () =>
      FileProcessingOperationError.fromReason("file-extraction-failed", {
        artifactId: operation.source.id,
        engine: DocTextFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: "Document extraction requires in-memory source bytes.",
        operationId: operation.operationId,
      })
    ),
    Match.when("input-limit", () =>
      FileProcessingOperationError.fromReason("output-limit-exceeded", {
        artifactId: operation.source.id,
        engine: DocTextFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: "Document source exceeds the configured materialization limit.",
        operationId: operation.operationId,
      })
    ),
    Match.orElse(() =>
      FileProcessingOperationError.fromReason("file-extraction-failed", {
        artifactId: operation.source.id,
        engine: DocTextFileProcessingEngineDescriptor.name,
        format: operation.format,
        message: "Document text extraction failed inside the driver boundary.",
        operationId: operation.operationId,
      })
    )
  );

const sourceBytes = (operation: ExtractFileOperation): Effect.Effect<Uint8Array, DocTextError> =>
  O.fromUndefinedOr(operation.source.bytes).pipe(
    O.match({
      onNone: () => Effect.fail(makeDocTextError("source-bytes-unavailable")),
      onSome: (bytes) =>
        O.fromUndefinedOr(operation.maxMaterializedBytes).pipe(O.exists((limit) => bytes.byteLength > limit))
          ? Effect.fail(makeDocTextError("input-limit"))
          : Effect.succeed(bytes),
    })
  );

const extractPdf = Effect.fn("DocTextFileProcessingEngine.extractPdf")(function* (
  operation: ExtractFileOperation
): Effect.fn.Return<ExtractionResult, DocTextError> {
  const bytes = yield* sourceBytes(operation);
  const result = yield* Effect.tryPromise({
    // pdfjs transfers the input buffer to its parser, detaching the caller's
    // view; hand it a copy so the operation's source bytes stay intact. Keep
    // recoverable parser warnings inside this driver boundary; extraction
    // failures are returned through the typed operation error below.
    try: () =>
      getDocumentProxy(new Uint8Array(bytes), { verbosity: 0 }).then((proxy) =>
        extractText(proxy, { mergePages: true })
      ),
    catch: () => makeDocTextError("extraction"),
  });

  if (Str.isEmpty(Str.trim(result.text))) {
    return yield* makeDocTextError("empty-text-layer");
  }

  return ExtractionResult.make({
    engine: DocTextFileProcessingEngineDescriptor.name,
    format: operation.format,
    metadata: { "pdf.totalPages": `${result.totalPages}` },
    operationId: operation.operationId,
    sourceArtifactId: operation.source.id,
    text: result.text,
    warnings: [],
  });
});

const extractDocx = Effect.fn("DocTextFileProcessingEngine.extractDocx")(function* (
  operation: ExtractFileOperation
): Effect.fn.Return<ExtractionResult, DocTextError> {
  const bytes = yield* sourceBytes(operation);
  const result = yield* Effect.tryPromise({
    try: () => mammoth.extractRawText({ buffer: Buffer.from(bytes) }),
    catch: () => makeDocTextError("extraction"),
  });

  return ExtractionResult.make({
    engine: DocTextFileProcessingEngineDescriptor.name,
    format: operation.format,
    metadata: {},
    operationId: operation.operationId,
    sourceArtifactId: operation.source.id,
    text: result.value,
    warnings: A.map(result.messages, (message) => message.message),
  });
});

/**
 * Create the JS-native PDF and DOCX text extraction engine.
 *
 * @example
 * ```ts
 * import { makeDocTextFileProcessingEngine } from "@beep/doc-text"
 *
 * const engine = makeDocTextFileProcessingEngine()
 * console.log(engine.descriptor.name) // "doc-text-js"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeDocTextFileProcessingEngine = (): FileProcessingEngineShape => ({
  descriptor: DocTextFileProcessingEngineDescriptor,
  detect: Effect.fn("DocTextFileProcessingEngine.detect")(function* (operation: DetectFileOperation) {
    const format = classifyFormatFromExtension(operation.source.extension);

    return DetectionResult.make({
      confidence: DocTextFileProcessingEngineDescriptor.supportsFormat(format) ? 1 : 0,
      engine: DocTextFileProcessingEngineDescriptor.name,
      format,
      operationId: operation.operationId,
      sourceArtifactId: operation.source.id,
      ...O.getSomesStruct({
        mediaType: O.fromUndefinedOr(operation.source.mediaType),
      }),
    });
  }),
  exportArchive: Effect.fn("DocTextFileProcessingEngine.exportArchive")(function* (operation: ExportArchiveOperation) {
    return yield* FileProcessingOperationError.fromReason("unsupported-file-format", {
      artifactId: operation.source.id,
      engine: DocTextFileProcessingEngineDescriptor.name,
      format: operation.format,
      message: "The document text driver does not export archive children.",
      operationId: operation.operationId,
    });
  }),
  extract: Effect.fn("DocTextFileProcessingEngine.extract")(function* (operation: ExtractFileOperation) {
    return yield* Match.value(operation.format).pipe(
      Match.when("pdf-text-layer", () =>
        extractPdf(operation).pipe(Effect.mapError((error) => operationFailure(operation, error)))
      ),
      Match.when("docx", () =>
        extractDocx(operation).pipe(Effect.mapError((error) => operationFailure(operation, error)))
      ),
      Match.orElse(() =>
        Effect.fail(
          FileProcessingOperationError.fromReason("unsupported-file-format", {
            artifactId: operation.source.id,
            engine: DocTextFileProcessingEngineDescriptor.name,
            format: operation.format,
            message: `The document text driver does not support ${operation.format}.`,
            operationId: operation.operationId,
          })
        )
      )
    );
  }),
});

/**
 * JS-native PDF and DOCX text extraction engine value.
 *
 * @example
 * ```ts
 * import { DocTextFileProcessingEngine } from "@beep/doc-text"
 *
 * console.log(DocTextFileProcessingEngine.descriptor.supportsFormat("docx")) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const DocTextFileProcessingEngine: FileProcessingEngineShape = makeDocTextFileProcessingEngine();
