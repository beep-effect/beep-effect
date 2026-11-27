/**
 * JS-native PDF and DOCX text extraction engine.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ExtractionResult } from "@beep/file-processing/Extraction";
import { DetectionResult, FileProcessingOperationError } from "@beep/file-processing/Operation";
import { classifyFormatFromExtension, FileProcessingEngineDescriptor } from "@beep/file-processing/Strategy";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Unzip, UnzipInflate, zipSync } from "fflate";
import mammoth from "mammoth";
import { SaxesParser } from "saxes";
import { extractText, getDocumentProxy } from "unpdf";
import { DocTextError, makeDocTextError } from "./DocText.errors.ts";
import type {
  DetectFileOperation,
  ExportArchiveOperation,
  ExtractFileOperation,
} from "@beep/file-processing/Operation";
import type { FileProcessingEngineShape } from "@beep/file-processing/Service";
import type { UnzipFile } from "fflate";

/**
 * Version of the canonical text emitted by the JS-native document extractor.
 *
 * **Details**
 *
 * Increment this value when PDF or DOCX extraction semantics change in a way
 * that can alter the canonical text or its UTF-16 offsets.
 *
 * **Example** (Log engine version constant)
 *
 * ```ts
 * import { DOC_TEXT_ENGINE_VERSION } from "@beep/doc-text"
 *
 * console.log(DOC_TEXT_ENGINE_VERSION) // "1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DOC_TEXT_ENGINE_VERSION = "1";

/**
 * JS-native document text file-processing engine descriptor.
 *
 * **Details**
 *
 * The capability contract currently groups text engines under the `tika`
 * engine family; the concrete `doc-text-js` name distinguishes this runtime.
 *
 * **Example** (Log supported formats list)
 *
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
  version: DOC_TEXT_ENGINE_VERSION,
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
        message: "Document source or expanded contents exceed the extraction resource limits.",
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
  const bytesForPdfjsToDetach = new Uint8Array(bytes);
  const result = yield* Effect.tryPromise({
    try: () =>
      getDocumentProxy(bytesForPdfjsToDetach, { verbosity: 0 }).then((proxy) =>
        extractText(proxy, { mergePages: true })
      ),
    catch: () => makeDocTextError("extraction"),
  });

  if (Str.isEmpty(Str.trim(result.text))) {
    return yield* makeDocTextError("empty-text-layer");
  }

  return ExtractionResult.make({
    engine: DocTextFileProcessingEngineDescriptor.name,
    engineVersion: DOC_TEXT_ENGINE_VERSION,
    format: operation.format,
    metadata: { "pdf.totalPages": `${result.totalPages}` },
    operationId: operation.operationId,
    sourceArtifactId: operation.source.id,
    text: result.text,
    warnings: [],
  });
});

const DOCX_MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const DOCX_MAX_EXPANDED_BYTES = 8 * 1024 * 1024;
const DOCX_MAX_ENTRIES = 512;
const DOCX_MAX_XML_NODES = 1_000_000;
const DOCX_MAX_XML_DEPTH = 128;
const DOCX_COMPRESSED_CHUNK_BYTES = 1_024;
const DOCX_XML_BYTES_PER_NODE = 8;

// decision: docx-validated-repack
const boundedDocx = Effect.fn("DocTextFileProcessingEngine.boundDocx")((bytes: Uint8Array, maxBytes: number) =>
  Effect.try({
    try: () => {
      if (bytes.byteLength > DOCX_MAX_SOURCE_BYTES) throw makeDocTextError("input-limit");
      let total = 0;
      let entries = 0;
      let completed = 0;
      let started = 0;
      let nodes = 0;
      const maxNodes = Math.max(1, Math.min(DOCX_MAX_XML_NODES, Math.floor(maxBytes / DOCX_XML_BYTES_PER_NODE)));
      let files = R.empty<string, Uint8Array>();
      let members = R.empty<string, UnzipFile>();
      let relationships = R.empty<string, Readonly<Record<string, string>>>();
      const names = MutableHashSet.empty<string>();
      const exceeded = () => {
        throw makeDocTextError("input-limit");
      };
      const chargeNode = () => {
        if (++nodes > maxNodes) exceeded();
      };
      const unzip = new Unzip((file) => {
        if (++entries > DOCX_MAX_ENTRIES) exceeded();
        if (
          MutableHashSet.has(names, file.name) ||
          Str.startsWith("/")(file.name) ||
          Str.includes("\\")(file.name) ||
          Str.includes("//")(file.name) ||
          A.some(Str.split("/")(file.name), (part) => part === "." || part === "..")
        ) {
          throw makeDocTextError("extraction");
        }
        MutableHashSet.add(names, file.name);
        members = R.set(members, file.name, file);
      });
      unzip.register(UnzipInflate);
      for (let offset = 0; offset < bytes.byteLength; offset += DOCX_COMPRESSED_CHUNK_BYTES) {
        unzip.push(
          bytes.subarray(offset, offset + DOCX_COMPRESSED_CHUNK_BYTES),
          offset + DOCX_COMPRESSED_CHUNK_BYTES >= bytes.byteLength
        );
      }
      if (entries === 0) throw makeDocTextError("extraction");

      const joinPathLikeMammoth = (name: string, target: string) => {
        const base = Str.replace(/(?:^|\/)_rels\/[^/]*$/, "")(name);
        return Str.startsWith("/")(target) ? Str.slice(1)(target) : Str.isEmpty(base) ? target : `${base}/${target}`;
      };
      const relationshipTypes = A.map(
        ["officeDocument", "comments", "endnotes", "footnotes", "numbering", "styles"],
        (part) => `http://schemas.openxmlformats.org/officeDocument/2006/relationships/${part}`
      );
      const readPart = (name: string): Readonly<Record<string, string>> => {
        const cached = relationships[name];
        if (cached !== undefined) return cached;
        const file = members[name];
        if (file === undefined) return R.empty();
        if (file.originalSize !== undefined && file.originalSize > maxBytes - total) exceeded();
        let chunks: ReadonlyArray<Uint8Array> = [];
        file.ondata = (error, data, final) => {
          if (error !== null) throw S.is(DocTextError)(error) ? error : makeDocTextError("extraction");
          total += data.byteLength;
          if (total > maxBytes) exceeded();
          chunks = A.append(chunks, data);
          if (final) ++completed;
        };
        ++started;
        file.start();
        if (started !== completed) throw makeDocTextError("extraction");
        const content = Buffer.concat(chunks);
        files = R.set(files, name, content);
        const text = Str.replace(/^\uFEFF+/, "")(new TextDecoder("utf-8", { fatal: true }).decode(content));
        let targets = R.empty<string, string>();
        let depth = 0;
        const scopes: Array<MutableHashMap.MutableHashMap<string, string>> = [];
        const bindNamespace = (
          bindings: MutableHashMap.MutableHashMap<string, string>,
          [attribute, uri]: [string, string]
        ) => {
          if (attribute === "xmlns") MutableHashMap.set(bindings, "", uri);
          else if (Str.startsWith("xmlns:")(attribute)) MutableHashMap.set(bindings, Str.slice(6)(attribute), uri);
        };
        const pushNamespaceScope = (attributes: Readonly<Record<string, string>>) => {
          const scope = MutableHashMap.empty<string, string>();
          for (const attribute of R.toEntries(attributes)) bindNamespace(scope, attribute);
          scopes.push(scope);
        };
        const namespaceUri = (prefix: string) => {
          for (let index = scopes.length - 1; index >= 0; --index) {
            const scope = scopes[index];
            if (scope === undefined) continue;
            const uri = MutableHashMap.get(scope, prefix);
            if (O.isSome(uri)) return uri.value;
          }
          return "";
        };
        const popNamespaceScope = () => {
          --depth;
          scopes.pop();
        };
        const resolveElementName = (name: string) =>
          O.match(Str.indexOf(":")(name), {
            onNone: () => ["", name] as const,
            onSome: (separator) => [Str.slice(0, separator)(name), Str.slice(separator + 1)(name)] as const,
          });
        const isRelationshipElement = (name: string) => {
          const [prefix, local] = resolveElementName(name);
          return (
            local === "Relationship" &&
            namespaceUri(prefix) === "http://schemas.openxmlformats.org/package/2006/relationships"
          );
        };
        const rememberFirstTarget = (type: string, target: string) => {
          if (!A.contains(relationshipTypes, type) || targets[type] !== undefined) return;
          const resolved = joinPathLikeMammoth(name, target);
          if (MutableHashSet.has(names, resolved)) targets = R.set(targets, type, resolved);
        };
        const parser = new SaxesParser({ xmlns: false });
        parser.on("doctype", exceeded);
        parser.on("opentag", (tag) => {
          chargeNode();
          if (++depth > DOCX_MAX_XML_DEPTH) exceeded();
          pushNamespaceScope(tag.attributes);
          if (!isRelationshipElement(tag.name)) return;
          const type = tag.attributes.Type;
          const target = tag.attributes.Target;
          if (type === undefined || target === undefined || depth !== 2) return;
          rememberFirstTarget(type, target);
        });
        parser.on("closetag", popNamespaceScope);
        parser.on("attribute", chargeNode);
        parser.on("text", chargeNode);
        parser.on("cdata", chargeNode);
        parser.on("comment", chargeNode);
        parser.on("processinginstruction", chargeNode);
        parser.write(text).close();
        relationships = R.set(relationships, name, targets);
        return targets;
      };
      const selectPart = (name: string, type: string, fallback: string) =>
        O.getOrElse(
          O.fromUndefinedOr(
            readPart(name)[`http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}`]
          ),
          () => fallback
        );
      const relsName = (name: string) => Str.replace(/(^|\/)([^/]*)$/, "$1_rels/$2.rels")(name);
      readPart("[Content_Types].xml");
      const main = selectPart("_rels/.rels", "officeDocument", "word/document.xml");
      const mainRels = relsName(main);
      for (const type of ["comments", "endnotes", "footnotes", "numbering", "styles"]) {
        const part = selectPart(mainRels, type, `word/${type}.xml`);
        if (type === "comments" || type === "endnotes" || type === "footnotes") readPart(relsName(part));
        readPart(part);
      }
      readPart(main);
      return zipSync(files, { level: 0 });
    },
    catch: (cause) => (S.is(DocTextError)(cause) ? cause : makeDocTextError("extraction")),
  })
);

const extractDocx = Effect.fn("DocTextFileProcessingEngine.extractDocx")(function* (
  operation: ExtractFileOperation
): Effect.fn.Return<ExtractionResult, DocTextError> {
  const bytes = yield* sourceBytes(operation);
  const archive = yield* boundedDocx(
    bytes,
    Math.min(operation.maxMaterializedBytes ?? DOCX_MAX_EXPANDED_BYTES, DOCX_MAX_EXPANDED_BYTES)
  );
  const result = yield* Effect.tryPromise({
    try: () => mammoth.extractRawText({ buffer: Buffer.from(archive) }),
    catch: () => makeDocTextError("extraction"),
  });

  return ExtractionResult.make({
    engine: DocTextFileProcessingEngineDescriptor.name,
    engineVersion: DOC_TEXT_ENGINE_VERSION,
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
 * **Example** (Create engine and log name)
 *
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
 * **Example** (Check DOCX format support)
 *
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
