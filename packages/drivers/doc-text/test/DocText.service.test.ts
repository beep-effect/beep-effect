import { DocTextError, DocTextErrorOptions, DocTextErrorReason, DocTextFileProcessingEngine } from "@beep/doc-text";
import {
  ArtifactId,
  ArtifactLocator,
  ContentDigest,
  OperationId,
  SourceArtifact,
} from "@beep/file-processing/Artifact";
import { ExtractFileOperation } from "@beep/file-processing/Operation";
import { NonNegativeInt } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { PDFDocument, StandardFonts } from "pdf-lib";

const encode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): Codec["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Encoded"]): Codec["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const assertSchemaRoundTrip = <Codec extends S.Codec<unknown, unknown>>(schema: Codec): void => {
  fc.assert(
    fc.property(S.toArbitrary(schema), (value) => {
      const encoded = encode(schema, value);
      const decoded = decode(schema, encoded);

      expect(encode(schema, decoded)).toEqual(encoded);
      expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
    }),
    fcRuns(10)
  );
};

const fixtureIds = Effect.all({
  artifactId: S.decodeUnknownEffect(ArtifactId)(
    "artifact:3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7"
  ),
  digest: S.decodeUnknownEffect(ContentDigest)(
    "sha256:3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7"
  ),
  operationId: S.decodeUnknownEffect(OperationId)(
    "operation:3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7"
  ),
});

type FixtureIds = {
  readonly artifactId: ArtifactId;
  readonly digest: ContentDigest;
  readonly operationId: OperationId;
};

const makeOperation = Effect.fn("DocTextTest.makeOperation")(function* (
  ids: FixtureIds,
  extension: string,
  format: ExtractFileOperation["format"],
  bytes: Uint8Array,
  maxMaterializedBytes?: number
) {
  const relativePath = yield* S.decodeUnknownEffect(PosixPath)(`fixture.${extension}`);

  return ExtractFileOperation.make({
    format,
    ...(maxMaterializedBytes === undefined ? {} : { maxMaterializedBytes }),
    operationId: ids.operationId,
    operationKind: "extract",
    preference: { engine: "tika" },
    source: SourceArtifact.make({
      bytes,
      digest: ids.digest,
      extension,
      id: ids.artifactId,
      locator: ArtifactLocator.make({ kind: "synthetic", value: relativePath }),
      name: `fixture.${extension}`,
      relativePath,
      sizeBytes: NonNegativeInt.make(bytes.byteLength),
    }),
  });
});

const makePdf = (text: string): Promise<Uint8Array> =>
  PDFDocument.create().then((document) =>
    document.embedFont(StandardFonts.Helvetica).then((font) => {
      const page = document.addPage();
      page.drawText(text, { font });
      return document.save();
    })
  );

const makeEmptyPdf = (): Promise<Uint8Array> =>
  PDFDocument.create().then((document) => {
    document.addPage();
    return document.save();
  });

const makeDocx = (text: string): Promise<Buffer> =>
  Packer.toBuffer(
    new Document({
      sections: [
        {
          children: [new Paragraph({ children: [new TextRun(text)] })],
        },
      ],
    })
  );

describe("@beep/doc-text", () => {
  it("round-trips document text driver schemas", () => {
    assertSchemaRoundTrip(DocTextErrorReason);
    assertSchemaRoundTrip(DocTextErrorOptions);
    assertSchemaRoundTrip(DocTextError);
  });

  it.effect(
    "extracts text from a generated PDF text layer",
    Effect.fnUntraced(function* () {
      const ids = yield* fixtureIds;
      const bytes = yield* Effect.promise(() => makePdf("PDF fixture text"));
      const result = yield* DocTextFileProcessingEngine.extract(
        yield* makeOperation(ids, "pdf", "pdf-text-layer", bytes)
      );

      expect(result.text).toContain("PDF fixture text");
      expect(result.metadata["pdf.totalPages"]).toBe("1");
      expect(result.engine).toBe("doc-text-js");
    })
  );

  it.effect(
    "leaves the caller's PDF bytes intact after extraction",
    Effect.fnUntraced(function* () {
      const ids = yield* fixtureIds;
      const bytes = yield* Effect.promise(() => makePdf("PDF fixture text"));
      const original = new Uint8Array(bytes);
      yield* DocTextFileProcessingEngine.extract(yield* makeOperation(ids, "pdf", "pdf-text-layer", bytes));

      // pdfjs transfers the buffer it is handed; the engine must extract from a
      // copy so intake can still materialize the source bytes verbatim.
      expect(bytes.byteLength).toBe(original.byteLength);
      expect(bytes).toEqual(original);
    })
  );

  it.effect(
    "extracts text from a generated DOCX",
    Effect.fnUntraced(function* () {
      const ids = yield* fixtureIds;
      const bytes = yield* Effect.promise(() => makeDocx("DOCX fixture text"));
      const result = yield* DocTextFileProcessingEngine.extract(yield* makeOperation(ids, "docx", "docx", bytes));

      expect(result.text).toContain("DOCX fixture text");
      expect(result.engine).toBe("doc-text-js");
    })
  );

  it.effect(
    "rejects unsupported formats",
    Effect.fnUntraced(function* () {
      const ids = yield* fixtureIds;
      const error = yield* DocTextFileProcessingEngine.extract(
        yield* makeOperation(ids, "txt", "plain-text", new TextEncoder().encode("text"))
      ).pipe(Effect.flip);

      expect(error.reason).toBe("unsupported-file-format");
    })
  );

  it.effect(
    "maps corrupt document bytes to an extraction failure",
    Effect.fnUntraced(function* () {
      const ids = yield* fixtureIds;
      const error = yield* DocTextFileProcessingEngine.extract(
        yield* makeOperation(ids, "pdf", "pdf-text-layer", new Uint8Array([0, 1, 2, 3]))
      ).pipe(Effect.flip);

      expect(error.reason).toBe("file-extraction-failed");
    })
  );

  it.effect(
    "rejects an over-cap document before parsing",
    Effect.fnUntraced(function* () {
      const ids = yield* fixtureIds;
      const error = yield* DocTextFileProcessingEngine.extract(
        yield* makeOperation(ids, "pdf", "pdf-text-layer", new Uint8Array([0, 1]), 1)
      ).pipe(Effect.flip);

      expect(error.reason).toBe("output-limit-exceeded");
    })
  );

  it.effect(
    "reports an explicit empty text-layer outcome when OCR would be required",
    Effect.fnUntraced(function* () {
      const ids = yield* fixtureIds;
      const bytes = yield* Effect.promise(makeEmptyPdf);
      const error = yield* DocTextFileProcessingEngine.extract(
        yield* makeOperation(ids, "pdf", "pdf-text-layer", bytes)
      ).pipe(Effect.flip);

      expect(error.reason).toBe("file-extraction-failed");
      expect(error.details).toEqual({ outcome: "empty-text-layer", ocr: "disabled" });
    })
  );
});
