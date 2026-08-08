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
import { TestFileProcessingEngine } from "@beep/file-processing/test";
import { NonNegativeInt } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { fcRuns } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const ArtifactIdArbitrary = S.toArbitrary(ArtifactId);
const ContentDigestArbitrary = S.toArbitrary(ContentDigest);
const OperationIdArbitrary = S.toArbitrary(OperationId);
const SourceArtifactArbitrary = S.toArbitrary(SourceArtifact);
const ExtractFileOperationArbitrary = S.toArbitrary(ExtractFileOperation);
const ProcessFileOperationArbitrary = S.toArbitrary(ProcessFileOperation);
const TextSpanArbitrary = S.toArbitrary(TextSpan);
const ProcessRunManifestArbitrary = S.toArbitrary(ProcessRunManifest);
const FileProcessingCoverageSummaryArbitrary = S.toArbitrary(FileProcessingCoverageSummary);
const SourceProcessingRecordArbitrary = S.toArbitrary(SourceProcessingRecord);
const FileProcessingFailureRecordArbitrary = S.toArbitrary(FileProcessingFailureRecord);
const ChildArtifactRecordArbitrary = S.toArbitrary(ChildArtifactRecord);
const decodeTextSpan = S.decodeUnknownEffect(TextSpan);
const encodeTextSpan = S.encodeEffect(TextSpan);
const decodeProcessRunManifestJson = S.decodeUnknownEffect(S.fromJsonString(ProcessRunManifest));
const decodeFileProcessingCoverageSummaryJson = S.decodeUnknownEffect(S.fromJsonString(FileProcessingCoverageSummary));
const decodeSourceProcessingRecordJson = S.decodeUnknownEffect(S.fromJsonString(SourceProcessingRecord));
const decodeFileProcessingFailureRecordJson = S.decodeUnknownEffect(S.fromJsonString(FileProcessingFailureRecord));
const decodeChildArtifactRecordJson = S.decodeUnknownEffect(S.fromJsonString(ChildArtifactRecord));
const pathSegmentArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]{0,12}$/);

const assertJsonRoundTrip = <A, EncodeError, DecodeError>(
  value: A,
  encode: (value: A) => Effect.Effect<string, EncodeError>,
  decode: (value: string) => Effect.Effect<A, DecodeError>
): void => {
  const encoded = Effect.runSync(encode(value));
  const decoded = Effect.runSync(decode(encoded));
  const reencoded = Effect.runSync(encode(decoded));

  expect(reencoded).toBe(encoded);
};

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
    sizeBytes: NonNegativeInt.make(text?.length ?? 11),
    ...(text === undefined ? {} : { text }),
  });
});

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const serviceLayer = makeFileProcessingServiceLayer([TestFileProcessingEngine]).pipe(Layer.provide(BunCrypto.layer));

describe("@beep/file-processing", () => {
  it.effect(
    "derives child artifact ids distinct from their source artifact",
    Effect.fnUntraced(function* () {
      const ids = yield* fixtureIds;
      const childId = yield* deriveArtifactId([ids.artifactId, "children/synthetic-message.txt"]);

      expect(childId).not.toBe(ids.artifactId);
      expect(childId.startsWith("artifact:")).toBe(true);
    }, provideScopedLayer(BunCrypto.layer))
  );

  it("round-trips schema-derived artifact and operation payloads", () =>
    fc.assert(
      fc.property(
        ArtifactIdArbitrary,
        ContentDigestArbitrary,
        OperationIdArbitrary,
        SourceArtifactArbitrary,
        ExtractFileOperationArbitrary,
        ProcessFileOperationArbitrary,
        (artifactId, digest, operationId, source, extractOperation, processOperation) => {
          const decodedArtifactId = Effect.runSync(S.decodeEffect(ArtifactId)(artifactId));
          const decodedDigest = Effect.runSync(S.decodeEffect(ContentDigest)(digest));
          const decodedOperationId = Effect.runSync(S.decodeEffect(OperationId)(operationId));
          const encodedSource = Effect.runSync(S.encodeEffect(SourceArtifact)(source));
          const decodedSource = Effect.runSync(S.decodeEffect(SourceArtifact)(encodedSource));
          const reencodedSource = Effect.runSync(S.encodeEffect(SourceArtifact)(decodedSource));
          const encodedExtract = Effect.runSync(S.encodeEffect(ExtractFileOperation)(extractOperation));
          const decodedExtract = Effect.runSync(S.decodeEffect(ExtractFileOperation)(encodedExtract));
          const encodedProcess = Effect.runSync(S.encodeEffect(ProcessFileOperation)(processOperation));
          const decodedProcess = Effect.runSync(S.decodeEffect(ProcessFileOperation)(encodedProcess));

          expect(decodedArtifactId).toBe(artifactId);
          expect(decodedDigest).toBe(digest);
          expect(decodedOperationId).toBe(operationId);
          expect(reencodedSource).toEqual(encodedSource);
          expect(decodedExtract.operationKind).toBe("extract");
          expect(decodedProcess.operationKind).toBe("process");
        }
      ),
      fcRuns(50)
    ));

  it("round-trips TextSpan through its encoded shape and generated invariant", () =>
    fc.assert(
      fc.property(TextSpanArbitrary, (span) => {
        const encoded = Effect.runSync(encodeTextSpan(span));
        const decoded = Effect.runSync(decodeTextSpan(encoded));
        const reencoded = Effect.runSync(encodeTextSpan(decoded));

        expect(reencoded).toEqual(encoded);
        expect(Number.isInteger(span.startOffset)).toBe(true);
        expect(Number.isInteger(span.endOffset)).toBe(true);
        expect(span.startOffset).toBeGreaterThanOrEqual(0);
        expect(span.endOffset).toBeGreaterThanOrEqual(span.startOffset);
      }),
      fcRuns(50)
    ));

  it.effect(
    "rejects invalid TextSpan offsets at decode",
    Effect.fnUntraced(function* () {
      const negative = yield* Effect.exit(decodeTextSpan({ endOffset: 1, startOffset: -1, text: "bad" }));
      const inverted = yield* Effect.exit(decodeTextSpan({ endOffset: 1, startOffset: 2, text: "bad" }));

      expect(negative._tag).toBe("Failure");
      expect(inverted._tag).toBe("Failure");
    })
  );

  it("round-trips file-processing JSON codecs byte-identically", () => {
    fc.assert(
      fc.property(ProcessRunManifestArbitrary, (manifest) => {
        assertJsonRoundTrip(manifest, encodeProcessRunManifestJson, decodeProcessRunManifestJson);
      }),
      fcRuns(50)
    );

    fc.assert(
      fc.property(FileProcessingCoverageSummaryArbitrary, (summary) => {
        assertJsonRoundTrip(summary, encodeFileProcessingCoverageSummaryJson, decodeFileProcessingCoverageSummaryJson);
      }),
      fcRuns(50)
    );

    fc.assert(
      fc.property(SourceProcessingRecordArbitrary, (record) => {
        assertJsonRoundTrip(record, encodeSourceProcessingRecordJson, decodeSourceProcessingRecordJson);
      }),
      fcRuns(50)
    );

    fc.assert(
      fc.property(FileProcessingFailureRecordArbitrary, (record) => {
        assertJsonRoundTrip(record, encodeFileProcessingFailureRecordJson, decodeFileProcessingFailureRecordJson);
      }),
      fcRuns(50)
    );

    fc.assert(
      fc.property(ChildArtifactRecordArbitrary, (record) => {
        assertJsonRoundTrip(record, encodeChildArtifactRecordJson, decodeChildArtifactRecordJson);
      }),
      fcRuns(50)
    );
  });

  it("keeps path containment explicit and property-tested", () =>
    fc.assert(
      fc.property(pathSegmentArbitrary, pathSegmentArbitrary, (rootName, leafName) => {
        const root = `/srv/${rootName}`;
        const child = `${root}/${leafName}`;

        expect(isPathWithinRoot(root, root)).toBe(true);
        expect(isPathWithinRoot(`${root}/`, `${root}\\${leafName}`)).toBe(false);
        expect(isPathWithinRoot(root, child)).toBe(true);
        expect(isPathWithinRoot(root, `/srv/${rootName}-evil/${leafName}`)).toBe(false);
        expect(isPathWithinRoot(root, `${root}/../${rootName}/${leafName}`)).toBe(false);
        expect(isPathWithinRoot(`C:\\srv\\${rootName}`, `C:\\srv\\${rootName}\\${leafName}`)).toBe(true);
        expect(isPathWithinRoot(`C:/srv/${rootName}`, `C:\\srv\\${rootName}\\${leafName}`)).toBe(true);
      }),
      fcRuns(50)
    ));

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
      ).pipe(provideScopedLayer(serviceLayer));

      expect(result.text).toBe("hello proof");
      expect(result.format).toBe("markdown");
    })
  );

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
      ).pipe(provideScopedLayer(serviceLayer));

      expect(result.resultKind).toBe("extracted");
      if (result.resultKind === "extracted") {
        expect(result.extraction.text).toBe("hello proof");
      }
    })
  );

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
      ).pipe(provideScopedLayer(serviceLayer));

      expect(result.resultKind).toBe("archive-exported");
      if (result.resultKind === "archive-exported") {
        expect(result.archiveExport.children).toHaveLength(1);
        expect(result.archiveExport.children[0]?.id).not.toBe(ids.artifactId);
      }
    })
  );

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
      ).pipe(provideScopedLayer(serviceLayer));

      expect(result.resultKind).toBe("skipped");
      if (result.resultKind === "skipped") {
        expect(result.skipReason).toBe("operation-not-required");
      }
    })
  );
});
