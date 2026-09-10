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
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

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
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([
            ArtifactIdArbitrary,
            ContentDigestArbitrary,
            OperationIdArbitrary,
            SourceArtifactArbitrary,
            ExtractFileOperationArbitrary,
            ProcessFileOperationArbitrary,
          ]),
          ([artifactId, digest, operationId, source, extractOperation, processOperation]) => {
            const decodedArtifactId = Effect.runSync(decodeArtifactId(artifactId));
            const decodedDigest = Effect.runSync(decodeContentDigest(digest));
            const decodedOperationId = Effect.runSync(decodeOperationId(operationId));
            const encodedSource = Effect.runSync(encodeSourceArtifact(source));
            const decodedSource = Effect.runSync(decodeSourceArtifact(encodedSource));
            const reencodedSource = Effect.runSync(encodeSourceArtifact(decodedSource));
            const encodedExtract = Effect.runSync(encodeExtractFileOperation(extractOperation));
            const decodedExtract = Effect.runSync(decodeExtractFileOperation(encodedExtract));
            const encodedProcess = Effect.runSync(encodeProcessFileOperation(processOperation));
            const decodedProcess = Effect.runSync(decodeProcessFileOperation(encodedProcess));

            expect(decodedArtifactId).toBe(artifactId);
            expect(decodedDigest).toBe(digest);
            expect(decodedOperationId).toBe(operationId);
            expect(reencodedSource).toEqual(encodedSource);
            expect(decodedExtract.operationKind).toBe("extract");
            expect(decodedProcess.operationKind).toBe("process");

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed"));

  it("round-trips TextSpan through its encoded shape and generated invariant", () =>
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([TextSpanArbitrary]),
          ([span]) => {
            const encoded = Effect.runSync(encodeTextSpan(span));
            const decoded = Effect.runSync(decodeTextSpan(encoded));
            const reencoded = Effect.runSync(encodeTextSpan(decoded));

            expect(reencoded).toEqual(encoded);
            expect(Number.isInteger(span.startOffset)).toBe(true);
            expect(Number.isInteger(span.endOffset)).toBe(true);
            expect(span.startOffset).toBeGreaterThanOrEqual(0);
            expect(span.endOffset).toBeGreaterThanOrEqual(span.startOffset);

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed"));

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
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([ProcessRunManifestArbitrary]),
          ([manifest]) => {
            assertJsonRoundTrip(manifest, encodeProcessRunManifestJson, decodeProcessRunManifestJson);

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed");

    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([FileProcessingCoverageSummaryArbitrary]),
          ([summary]) => {
            assertJsonRoundTrip(
              summary,
              encodeFileProcessingCoverageSummaryJson,
              decodeFileProcessingCoverageSummaryJson
            );

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed");

    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([SourceProcessingRecordArbitrary]),
          ([record]) => {
            assertJsonRoundTrip(record, encodeSourceProcessingRecordJson, decodeSourceProcessingRecordJson);

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed");

    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([FileProcessingFailureRecordArbitrary]),
          ([record]) => {
            assertJsonRoundTrip(record, encodeFileProcessingFailureRecordJson, decodeFileProcessingFailureRecordJson);

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed");

    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([ChildArtifactRecordArbitrary]),
          ([record]) => {
            assertJsonRoundTrip(record, encodeChildArtifactRecordJson, decodeChildArtifactRecordJson);

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed");
  });

  it("keeps path containment explicit and property-tested", () =>
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([pathSegmentArbitrary, pathSegmentArbitrary]),
          ([rootName, leafName]) => {
            const root = `/srv/${rootName}`;
            const child = `${root}/${leafName}`;

            expect(isPathWithinRoot(root, root)).toBe(true);
            expect(isPathWithinRoot(`${root}/`, `${root}\\${leafName}`)).toBe(false);
            expect(isPathWithinRoot(root, child)).toBe(true);
            expect(isPathWithinRoot(root, `/srv/${rootName}-evil/${leafName}`)).toBe(false);
            expect(isPathWithinRoot(root, `${root}/../${rootName}/${leafName}`)).toBe(false);
            expect(isPathWithinRoot(`C:\\srv\\${rootName}`, `C:\\srv\\${rootName}\\${leafName}`)).toBe(true);
            expect(isPathWithinRoot(`C:/srv/${rootName}`, `C:\\srv\\${rootName}\\${leafName}`)).toBe(true);

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed"));

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
