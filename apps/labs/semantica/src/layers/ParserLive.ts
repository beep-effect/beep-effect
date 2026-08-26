import { DocTextFileProcessingEngine } from "@beep/doc-text";
import {
  ArtifactId,
  ArtifactLocator,
  ContentDigest,
  OperationId,
  SourceArtifact,
} from "@beep/file-processing/Artifact";
import { ExtractFileOperation } from "@beep/file-processing/Operation";
import { SourceTextExtractor } from "@beep/provenance";
import { NonNegativeInt, PosixPath } from "@beep/schema";
import { Effect, Layer, Result } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { getDocumentProxy } from "unpdf";
import { extractHtmlText } from "@/parse/Html";
import { SEMANTICA_VERSION } from "@/runtime/Version";
import { DegradedKind } from "@/schema/Degraded";
import { MediaType } from "@/schema/MediaType";
import { ParseOutcome } from "@/schema/Text";
import { Parser } from "@/services/Parser";
import type { FileProcessingOperationError } from "@beep/file-processing/Operation";
import type { DegradedKind as DegradedKindValue } from "@/schema/Degraded";
import type { SourceDocument } from "@/schema/Document";
import type { ParseOutcome as ParseOutcomeValue } from "@/schema/Text";

const extractors = {
  html: SourceTextExtractor.make({ name: "semantica-html", version: SEMANTICA_VERSION }),
  markdown: SourceTextExtractor.make({ name: "semantica-md", version: SEMANTICA_VERSION }),
  pdf: SourceTextExtractor.make({ name: "doc-text", version: SEMANTICA_VERSION }),
  retryPdf: SourceTextExtractor.make({ name: "unpdf-raw", version: SEMANTICA_VERSION }),
};

const degraded = (document: SourceDocument, kind: DegradedKindValue, detail: string): ParseOutcomeValue =>
  ParseOutcome.cases.Degraded.make({
    detail,
    document: document.id,
    kind,
    outcome: "Degraded",
  });

const parsed = (document: SourceDocument, text: string, extractor: SourceTextExtractor): ParseOutcomeValue =>
  ParseOutcome.cases.Parsed.make({
    document: document.id,
    extractor,
    outcome: "Parsed",
    text,
  });

const strictUtf8 = (bytes: Uint8Array): Effect.Effect<string, "invalid-utf8"> =>
  Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    catch: (): "invalid-utf8" => "invalid-utf8",
  });

const parserDetail = DegradedKind.$match({
  "invalid-utf8": () => "The source bytes are not valid UTF-8.",
  truncated: () => "The HTML source ended inside a tag, attribute, or comment.",
  "empty-text-layer": () => "The PDF contains no extractable text layer.",
  "extraction-failed": () => "The PDF text extractor could not read the source.",
  "input-limit": () => "The source exceeded the PDF extractor input limit.",
  "provider-unavailable": () => "A provider was unavailable.",
  "model-output-invalid": () => "A model returned invalid output.",
  "fabricated-span": () => "A generated span was not grounded.",
  "relation-unresolved": () => "A generated relation endpoint was unresolved.",
});

const fileProcessingDegradedKind = (error: FileProcessingOperationError): DegradedKindValue => {
  if (Str.Equivalence(error.reason, "output-limit-exceeded")) {
    return "input-limit";
  }
  const outcome = O.flatMap(O.fromUndefinedOr(error.details), (details) => R.get(details, "outcome"));
  return O.contains(outcome, "empty-text-layer") ? "empty-text-layer" : "extraction-failed";
};

const sourceName = (document: SourceDocument): string =>
  O.getOrElse(A.last(Str.split(document.origin.relativePath, "/")), () => document.origin.relativePath);

const makePdfOperation = (document: SourceDocument, bytes: Uint8Array): ExtractFileOperation => {
  const relativePath = PosixPath.make(document.origin.relativePath);
  return ExtractFileOperation.make({
    format: "pdf-text-layer",
    operationId: OperationId.make(`operation:${document.id}`),
    operationKind: "extract",
    preference: { engine: "tika" },
    source: SourceArtifact.make({
      bytes,
      digest: ContentDigest.make(`sha256:${document.sha256}`),
      extension: "pdf",
      id: ArtifactId.make(`artifact:${document.id}`),
      locator: ArtifactLocator.make({ kind: "memory", value: relativePath }),
      name: sourceName(document),
      relativePath,
      sizeBytes: NonNegativeInt.make(bytes.byteLength),
    }),
  });
};

const parseMarkdown = Effect.fn("Parser.parseMarkdown")(function* (document: SourceDocument, bytes: Uint8Array) {
  const text = yield* strictUtf8(bytes).pipe(Effect.option);
  return O.match(text, {
    onNone: () => degraded(document, "invalid-utf8", parserDetail("invalid-utf8")),
    onSome: (decoded) => parsed(document, decoded, extractors.markdown),
  });
});

const parseHtml = Effect.fn("Parser.parseHtml")(function* (document: SourceDocument, bytes: Uint8Array) {
  const decoded = yield* strictUtf8(bytes).pipe(Effect.option);
  if (O.isNone(decoded)) {
    return degraded(document, "invalid-utf8", parserDetail("invalid-utf8"));
  }
  const extracted = extractHtmlText(decoded.value);
  return yield* Effect.fromResult(extracted).pipe(
    Effect.map((text) => parsed(document, text, extractors.html)),
    Effect.catch((kind) => Effect.succeed(degraded(document, kind, parserDetail(kind))))
  );
});

const parsePdf = Effect.fn("Parser.parsePdf")(function* (document: SourceDocument, bytes: Uint8Array) {
  const extraction = yield* DocTextFileProcessingEngine.extract(makePdfOperation(document, bytes)).pipe(Effect.result);
  if (Result.isFailure(extraction)) {
    const kind = fileProcessingDegradedKind(extraction.failure);
    return degraded(document, kind, parserDetail(kind));
  }
  return O.match(O.fromUndefinedOr(extraction.success.text), {
    onNone: () => degraded(document, "extraction-failed", parserDetail("extraction-failed")),
    onSome: (text) => parsed(document, text, extractors.pdf),
  });
});

const textItem = (item: unknown): O.Option<string> => {
  if (!P.hasProperty(item, "str") || !P.isString(item.str)) {
    return O.none();
  }
  const text = item.str;
  const hasEndOfLine = P.hasProperty(item, "hasEOL") && item.hasEOL === true;
  return O.some(
    Bool.match(hasEndOfLine, {
      onFalse: () => text,
      onTrue: () => `${text}\n`,
    })
  );
};

const extractPdfRaw = Effect.fn("ParserRetry.extractPdfRaw")(function* (
  bytes: Uint8Array
): Effect.fn.Return<string, "extraction-failed"> {
  const proxy = yield* Effect.tryPromise({
    try: () => getDocumentProxy(new Uint8Array(bytes), { verbosity: 0 }),
    catch: (): "extraction-failed" => "extraction-failed",
  });
  const pages = yield* Effect.forEach(
    A.range(1, proxy.numPages),
    (pageNumber) =>
      Effect.tryPromise({
        try: () =>
          proxy
            .getPage(pageNumber)
            .then((page) => page.getTextContent({ disableNormalization: true }))
            .then((content) => A.join(A.getSomes(A.map(content.items, textItem)), Str.empty)),
        catch: (): "extraction-failed" => "extraction-failed",
      }),
    { concurrency: 1 }
  );
  return A.join(pages, "\n");
});

const parsePdfRetry = Effect.fn("ParserRetry.parsePdf")(function* (document: SourceDocument, bytes: Uint8Array) {
  const extraction = yield* extractPdfRaw(bytes).pipe(Effect.option);
  if (O.isNone(extraction)) {
    return degraded(document, "extraction-failed", parserDetail("extraction-failed"));
  }
  if (Str.isEmpty(Str.trim(extraction.value))) {
    return degraded(document, "empty-text-layer", parserDetail("empty-text-layer"));
  }
  return parsed(document, extraction.value, extractors.retryPdf);
});

const makeParser = (pdf: (document: SourceDocument, bytes: Uint8Array) => Effect.Effect<ParseOutcomeValue>) =>
  Parser.of({
    parse: Effect.fn("Parser.parse")((document, bytes) =>
      MediaType.$match(document.mediaType, {
        "application/pdf": () => pdf(document, bytes),
        "text/html": () => parseHtml(document, bytes),
        "text/markdown": () => parseMarkdown(document, bytes),
      })
    ),
  });

/**
 * Primary parser Layer backed by doc-text, strict UTF-8, and the local HTML
 * extractor.
 *
 * @category layers
 * @since 0.0.0
 */
export const ParserLive = Layer.succeed(Parser, makeParser(parsePdf));

/**
 * Breaker-only PDF parser using unpdf with normalization disabled per page.
 *
 * @category layers
 * @since 0.0.0
 */
export const ParserRetryLive = Layer.succeed(Parser, makeParser(parsePdfRetry));
