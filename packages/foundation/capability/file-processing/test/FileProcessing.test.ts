import {
  ArtifactId,
  ArtifactLocator,
  ContentDigest,
  deriveArtifactId,
  OperationId,
  SourceArtifact,
} from "@beep/file-processing/Artifact";
import {
  ChildArtifactRecord,
  encodeChildArtifactRecordJson,
  encodeFileProcessingCoverageSummaryJson,
  encodeFileProcessingFailureRecordJson,
  encodeProcessRunManifestJson,
  encodeSourceProcessingRecordJson,
  FileProcessingCoverageSummary,
  FileProcessingFailureRecord,
  ProcessRunManifest,
  SourceProcessingRecord,
  TextSpan,
} from "@beep/file-processing/Extraction";
import { ExtractFileOperation, ProcessFileOperation } from "@beep/file-processing/Operation";
import { isPathWithinRoot } from "@beep/file-processing/PathSafety";
import { extractFile, makeFileProcessingServiceLayer, processFile } from "@beep/file-processing/Service";
import { classifyFormatFromExtension, FileFormatFamily } from "@beep/file-processing/Strategy";
import { TestFileProcessingEngine } from "@beep/file-processing/test";
import { PosixPath } from "@beep/schema/PosixPath";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, Layer, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Exit from "effect/Exit";
import * as S from "effect/Schema";

const decodeArtifactId = S.decodeEffect(ArtifactId);
const decodeContentDigest = S.decodeEffect(ContentDigest);
const decodeExtractFileOperation = S.decodeEffect(ExtractFileOperation);
const decodeOperationId = S.decodeEffect(OperationId);
const decodeProcessFileOperation = S.decodeEffect(ProcessFileOperation);
const decodeSourceArtifact = S.decodeEffect(SourceArtifact);
const encodeExtractFileOperation = S.encodeEffect(ExtractFileOperation);
const encodeProcessFileOperation = S.encodeEffect(ProcessFileOperation);
const encodeSourceArtifact = S.encodeEffect(SourceArtifact);

const ArtifactIdArbitrary = Arbitrary.schema(ArtifactId);
const ContentDigestArbitrary = Arbitrary.schema(ContentDigest);
const OperationIdArbitrary = Arbitrary.schema(OperationId);
const SourceArtifactArbitrary = Arbitrary.schema(SourceArtifact);
const ExtractFileOperationArbitrary = Arbitrary.schema(ExtractFileOperation);
const ProcessFileOperationArbitrary = Arbitrary.schema(ProcessFileOperation);
const TextSpanArbitrary = Arbitrary.schema(TextSpan);
const ProcessRunManifestArbitrary = Arbitrary.schema(ProcessRunManifest);
const FileProcessingCoverageSummaryArbitrary = Arbitrary.schema(FileProcessingCoverageSummary);
const SourceProcessingRecordArbitrary = Arbitrary.schema(SourceProcessingRecord);
const FileProcessingFailureRecordArbitrary = Arbitrary.schema(FileProcessingFailureRecord);
const ChildArtifactRecordArbitrary = Arbitrary.schema(ChildArtifactRecord);
const decodeTextSpan = S.decodeUnknownEffect(TextSpan);
const encodeTextSpan = S.encodeEffect(TextSpan);
const decodeProcessRunManifestJson = S.decodeUnknownEffect(S.fromJsonString(ProcessRunManifest));
const decodeFileProcessingCoverageSummaryJson = S.decodeUnknownEffect(S.fromJsonString(FileProcessingCoverageSummary));
const decodeSourceProcessingRecordJson = S.decodeUnknownEffect(S.fromJsonString(SourceProcessingRecord));
const decodeFileProcessingFailureRecordJson = S.decodeUnknownEffect(S.fromJsonString(FileProcessingFailureRecord));
const decodeChildArtifactRecordJson = S.decodeUnknownEffect(S.fromJsonString(ChildArtifactRecord));
const pathSegmentArbitrary = Arbitrary.schema(S.String.check(S.isPattern(/^[a-z][a-z0-9-]{0,12}$/)));

const assertJsonRoundTrip = Effect.fn("FileProcessingTest.assertJsonRoundTrip")(function* <A, EncodeError, DecodeError>(
  value: A,
  encode: (value: A) => Effect.Effect<string, EncodeError>,
  decode: (value: string) => Effect.Effect<A, DecodeError>
) {
  const encoded = yield* encode(value);
  const decoded = yield* decode(encoded);
  const reencoded = yield* encode(decoded);
  expect(reencoded).toBe(encoded);
});

const fixtureIds = Effect.all({
  artifactId: S.decodeEffect(ArtifactId)("artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
  digest: S.decodeEffect(ContentDigest)("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
  operationId: S.decodeEffect(OperationId)(
    "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  ),
});

type FixtureIds = {
  readonly artifactId: ArtifactId;
  readonly digest: ContentDigest;
  readonly operationId: OperationId;
};

const decodeFixturePath = S.decodeUnknownEffect(PosixPath);

const makeSource = Effect.fn("FileProcessingTest.makeSource")(function* (
  ids: FixtureIds,
  extension: string,
  text?: string
) {
  const relativePath = yield* decodeFixturePath(`readme.${extension}`);
  const locatorPath = yield* decodeFixturePath(`fixtures/readme.${extension}`);

  return SourceArtifact.make({
    digest: ids.digest,
    extension,
    id: ids.artifactId,
    locator: ArtifactLocator.make({ kind: "synthetic", value: locatorPath }),
    name: `readme.${extension}`,
    relativePath,
    sizeBytes: S.Natural.make(text?.length ?? 11),
    ...(text === undefined ? {} : { text }),
  });
});
const serviceLayer = makeFileProcessingServiceLayer([TestFileProcessingEngine]).pipe(Layer.provide(BunCrypto.layer));

describe("@beep/file-processing", () => {
  it.layer(BunCrypto.layer)("derives child artifact ids distinct from their source artifact", (it) => {
    it.effect(
      "derives child artifact ids distinct from their source artifact",
      Effect.fnUntraced(function* () {
        const ids = yield* fixtureIds;
        const childId = yield* deriveArtifactId([ids.artifactId, "children/synthetic-message.txt"]);

        expect(childId).not.toBe(ids.artifactId);
        expect(childId.startsWith("artifact:")).toBe(true);
      })
    );
  });

  it.effect.prop(
    "round-trips schema-derived artifact and operation payloads",
    {
      artifactId: ArtifactIdArbitrary,
      digest: ContentDigestArbitrary,
      operationId: OperationIdArbitrary,
      source: SourceArtifactArbitrary,
      extractOperation: ExtractFileOperationArbitrary,
      processOperation: ProcessFileOperationArbitrary,
    },
    ({ artifactId, digest, operationId, source, extractOperation, processOperation }) =>
      Effect.gen(function* () {
        const decodedArtifactId = yield* decodeArtifactId(artifactId);
        const decodedDigest = yield* decodeContentDigest(digest);
        const decodedOperationId = yield* decodeOperationId(operationId);
        const encodedSource = yield* encodeSourceArtifact(source);
        const decodedSource = yield* decodeSourceArtifact(encodedSource);
        const reencodedSource = yield* encodeSourceArtifact(decodedSource);
        const encodedExtract = yield* encodeExtractFileOperation(extractOperation);
        const decodedExtract = yield* decodeExtractFileOperation(encodedExtract);
        const encodedProcess = yield* encodeProcessFileOperation(processOperation);
        const decodedProcess = yield* decodeProcessFileOperation(encodedProcess);

        expect(decodedArtifactId).toBe(artifactId);
        expect(decodedDigest).toBe(digest);
        expect(decodedOperationId).toBe(operationId);
        expect(reencodedSource).toEqual(encodedSource);
        expect(decodedExtract.operationKind).toBe("extract");
        expect(yield* encodeExtractFileOperation(decodedExtract)).toEqual(encodedExtract);
        expect(decodedProcess.operationKind).toBe("process");
        expect(yield* encodeProcessFileOperation(decodedProcess)).toEqual(encodedProcess);
      }),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "round-trips TextSpan through its encoded shape and generated invariant",
    { span: TextSpanArbitrary },
    ({ span }) =>
      Effect.gen(function* () {
        const encoded = yield* encodeTextSpan(span);
        const decoded = yield* decodeTextSpan(encoded);
        const reencoded = yield* encodeTextSpan(decoded);

        expect(reencoded).toEqual(encoded);
        expect(Number.isInteger(span.startOffset)).toBe(true);
        expect(Number.isInteger(span.endOffset)).toBe(true);
        expect(span.startOffset).toBeGreaterThanOrEqual(0);
        expect(span.endOffset).toBeGreaterThanOrEqual(span.startOffset);
      }),
    { arbitrary: fcRuns(50) }
  );

  it.effect(
    "rejects invalid TextSpan offsets at decode",
    Effect.fnUntraced(function* () {
      const negative = yield* Effect.exit(decodeTextSpan({ endOffset: 1, startOffset: -1, text: "bad" }));
      const inverted = yield* Effect.exit(decodeTextSpan({ endOffset: 1, startOffset: 2, text: "bad" }));

      pipe(negative, Exit.isFailure, assertTrue);
      pipe(inverted, Exit.isFailure, assertTrue);
    })
  );

  it.effect.prop(
    "round-trips file-processing JSON codecs byte-identically",
    {
      manifest: ProcessRunManifestArbitrary,
      summary: FileProcessingCoverageSummaryArbitrary,
      sourceRecord: SourceProcessingRecordArbitrary,
      failureRecord: FileProcessingFailureRecordArbitrary,
      childRecord: ChildArtifactRecordArbitrary,
    },
    ({ manifest, summary, sourceRecord, failureRecord, childRecord }) =>
      Effect.gen(function* () {
        yield* assertJsonRoundTrip(manifest, encodeProcessRunManifestJson, decodeProcessRunManifestJson);
        yield* assertJsonRoundTrip(
          summary,
          encodeFileProcessingCoverageSummaryJson,
          decodeFileProcessingCoverageSummaryJson
        );
        yield* assertJsonRoundTrip(sourceRecord, encodeSourceProcessingRecordJson, decodeSourceProcessingRecordJson);
        yield* assertJsonRoundTrip(
          failureRecord,
          encodeFileProcessingFailureRecordJson,
          decodeFileProcessingFailureRecordJson
        );
        yield* assertJsonRoundTrip(childRecord, encodeChildArtifactRecordJson, decodeChildArtifactRecordJson);
      }),
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "keeps path containment explicit and property-tested",
    { rootName: pathSegmentArbitrary, leafName: pathSegmentArbitrary },
    ({ rootName, leafName }) => {
      const root = `/srv/${rootName}`;
      const child = `${root}/${leafName}`;

      expect(isPathWithinRoot(root, root)).toBe(true);
      expect(isPathWithinRoot(`${root}/`, `${root}\\${leafName}`)).toBe(false);
      expect(isPathWithinRoot(root, child)).toBe(true);
      expect(isPathWithinRoot(root, `/srv/${rootName}-evil/${leafName}`)).toBe(false);
      expect(isPathWithinRoot(root, `${root}/../${rootName}/${leafName}`)).toBe(false);
      expect(isPathWithinRoot(`C:\\srv\\${rootName}`, `C:\\srv\\${rootName}\\${leafName}`)).toBe(true);
      expect(isPathWithinRoot(`C:/srv/${rootName}`, `C:\\srv\\${rootName}\\${leafName}`)).toBe(true);
    },
    { arbitrary: fcRuns(50) }
  );

  it("classifies every recognized extension into its format family", () => {
    const cases = [
      ["doc", "doc"],
      ["docx", "docx"],
      ["docm", "docm"],
      ["rtf", "rtf"],
      ["htm", "html"],
      ["html", "html"],
      ["xhtml", "xhtml"],
      ["pdf", "pdf-text-layer"],
      ["pst", "pst"],
      ["txt", "plain-text"],
      ["markdown", "markdown"],
      ["png", "image-metadata"],
      ["xls", "xls"],
      ["xlsx", "xlsx"],
      ["zip", "unknown"],
      [undefined, "unknown"],
    ] as const;

    for (const [extension, family] of cases) {
      expect(classifyFormatFromExtension(extension)).toBe(family);
    }
    expect(FileFormatFamily.processCapability("image-metadata")).toBe("extract-metadata");
    expect(FileFormatFamily.processCapability("pdf-text-layer")).toBe("extract-text");
  });

  it.layer(serviceLayer)("extracts synthetic text through the service contract", (it) => {
    it.effect(
      "extracts synthetic text through the service contract",
      Effect.fnUntraced(function* () {
        const ids = yield* fixtureIds;
        const result = yield* extractFile(
          ExtractFileOperation.make({
            format: "markdown",
            operationId: ids.operationId,
            operationKind: "extract",
            preference: { engine: "test" },
            source: yield* makeSource(ids, "md", "hello proof"),
          })
        );

        expect(result.text).toBe("hello proof");
        expect(result.format).toBe("markdown");
      })
    );
  });

  it.layer(serviceLayer)("processes synthetic text through the service contract", (it) => {
    it.effect(
      "processes synthetic text through the service contract",
      Effect.fnUntraced(function* () {
        const ids = yield* fixtureIds;
        const result = yield* processFile(
          ProcessFileOperation.make({
            exportChildren: false,
            operationId: ids.operationId,
            operationKind: "process",
            preference: { engine: "test" },
            source: yield* makeSource(ids, "md", "hello proof"),
          })
        );

        expect(result.resultKind).toBe("extracted");
        if (result.resultKind === "extracted") {
          expect(result.extraction.text).toBe("hello proof");
        }
      })
    );
  });

  it.layer(serviceLayer)("exports PST children through process when requested", (it) => {
    it.effect(
      "exports PST children through process when requested",
      Effect.fnUntraced(function* () {
        const ids = yield* fixtureIds;
        const result = yield* processFile(
          ProcessFileOperation.make({
            exportChildren: true,
            operationId: ids.operationId,
            operationKind: "process",
            preference: { engine: "test" },
            source: yield* makeSource(ids, "pst"),
          })
        );

        expect(result.resultKind).toBe("archive-exported");
        if (result.resultKind === "archive-exported") {
          expect(result.archiveExport.children).toHaveLength(1);
          expect(result.archiveExport.children[0]?.id).not.toBe(ids.artifactId);
        }
      })
    );
  });

  it.layer(serviceLayer)("skips PST child export when it is not requested", (it) => {
    it.effect(
      "skips PST child export when it is not requested",
      Effect.fnUntraced(function* () {
        const ids = yield* fixtureIds;
        const result = yield* processFile(
          ProcessFileOperation.make({
            exportChildren: false,
            operationId: ids.operationId,
            operationKind: "process",
            preference: { engine: "test" },
            source: yield* makeSource(ids, "pst"),
          })
        );

        expect(result.resultKind).toBe("skipped");
        if (result.resultKind === "skipped") {
          expect(result.skipReason).toBe("operation-not-required");
        }
      })
    );
  });
});
