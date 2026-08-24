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
import { TikaError, TikaErrorOptions, TikaErrorReason, TikaFileProcessingEngine } from "@beep/tika";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const SourceArtifactArbitrary = S.toArbitrary(SourceArtifact)(fc);
const ExtractFileOperationArbitrary = S.toArbitrary(ExtractFileOperation)(fc);
const TikaErrorReasonArbitrary = S.toArbitrary(TikaErrorReason)(fc);
const TikaErrorOptionsArbitrary = S.toArbitrary(TikaErrorOptions)(fc);
const TikaErrorArbitrary = S.toArbitrary(TikaError)(fc);
const encodeSourceArtifact = S.encodeEffect(SourceArtifact);
const decodeSourceArtifact = S.decodeUnknownEffect(SourceArtifact);
const encodeExtractFileOperation = S.encodeEffect(ExtractFileOperation);
const decodeExtractFileOperation = S.decodeUnknownEffect(ExtractFileOperation);

const encode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): Codec["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Encoded"]): Codec["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): void => {
  const encoded = encode(schema, value);
  const decoded = decode(schema, encoded);

  expect(encode(schema, decoded)).toEqual(encoded);
  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
};

const fixtureIds = Effect.all({
  artifactId: S.decodeEffect(ArtifactId)("artifact:ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"),
  digest: S.decodeEffect(ContentDigest)("sha256:ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"),
  operationId: S.decodeEffect(OperationId)(
    "operation:ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"
  ),
});

type FixtureIds = {
  readonly artifactId: ArtifactId;
  readonly digest: ContentDigest;
  readonly operationId: OperationId;
};

const decodeFixturePath = S.decodeUnknownEffect(PosixPath);

const source = Effect.fn("TikaTest.source")(function* (ids: FixtureIds, extension: string) {
  const relativePath = yield* decodeFixturePath(`fixture.${extension}`);

  return SourceArtifact.make({
    digest: ids.digest,
    extension,
    id: ids.artifactId,
    locator: ArtifactLocator.make({ kind: "synthetic", value: relativePath }),
    name: `fixture.${extension}`,
    relativePath,
    sizeBytes: NonNegativeInt.make(1),
    text: "a",
  });
});

describe("@beep/tika", () => {
  it("keeps Tika error encoded shapes byte-identical", () => {
    expect(encode(TikaErrorOptions, TikaErrorOptions.make({}))).toEqual({});
    expect(encode(TikaErrorOptions, TikaErrorOptions.make({ statusCode: NonNegativeInt.make(503) }))).toEqual({
      statusCode: 503,
    });
    expect(encode(TikaError, TikaError.fromReason("timeout"))).toEqual({
      _tag: "TikaError",
      reason: "timeout",
    });
    expect(
      encode(
        TikaError,
        TikaError.fromReason(
          "response-status",
          TikaErrorOptions.make({ cause: "exit 1", statusCode: NonNegativeInt.make(503) })
        )
      )
    ).toEqual({
      _tag: "TikaError",
      cause: "exit 1",
      reason: "response-status",
      statusCode: 503,
    });
  });

  it("round-trips schema-derived extraction operation data through file-processing schemas", () =>
    fc.assert(
      fc.property(
        SourceArtifactArbitrary,
        ExtractFileOperationArbitrary,
        TikaErrorReasonArbitrary,
        TikaErrorOptionsArbitrary,
        TikaErrorArbitrary,
        (sourceArtifact, extractOperation, errorReason, errorOptions, error) => {
          const encodedSourceArtifact = Effect.runSync(encodeSourceArtifact(sourceArtifact));
          const decodedSourceArtifact = Effect.runSync(decodeSourceArtifact(encodedSourceArtifact));
          expect(Effect.runSync(encodeSourceArtifact(decodedSourceArtifact))).toEqual(encodedSourceArtifact);

          const encodedExtractOperation = Effect.runSync(encodeExtractFileOperation(extractOperation));
          const decodedExtractOperation = Effect.runSync(decodeExtractFileOperation(encodedExtractOperation));
          expect(Effect.runSync(encodeExtractFileOperation(decodedExtractOperation))).toEqual(encodedExtractOperation);

          expectRoundTrip(TikaErrorReason, errorReason);
          expectRoundTrip(TikaErrorOptions, errorOptions);
          const encodedError = encode(TikaError, error);
          const decodedError = decode(TikaError, encodedError);
          expect(decodedError).toBeInstanceOf(TikaError);
          expect(encode(TikaError, decodedError)).toEqual(encodedError);
        }
      ),
      fcRuns(25)
    ));

  it.effect(
    "extracts text for a P1 text fixture",
    Effect.fnUntraced(function* () {
      const ids = yield* fixtureIds;
      const result = yield* TikaFileProcessingEngine.extract(
        ExtractFileOperation.make({
          format: "plain-text",
          operationId: ids.operationId,
          operationKind: "extract",
          preference: { engine: "tika" },
          source: yield* source(ids, "txt"),
        })
      );

      return yield* Effect.sync(() => {
        expect(result.text).toBe("a");
        expect(result.engine).toBe("apache-tika");
      });
    })
  );

  it.effect(
    "defers DOCX extraction behind an operation-level error",
    Effect.fnUntraced(function* () {
      const ids = yield* fixtureIds;
      const error = yield* TikaFileProcessingEngine.extract(
        ExtractFileOperation.make({
          format: "docx",
          operationId: ids.operationId,
          operationKind: "extract",
          preference: { engine: "tika" },
          source: yield* source(ids, "docx"),
        })
      ).pipe(Effect.flip);

      return yield* Effect.sync(() => {
        expect(error._tag).toBe("FileProcessingOperationError");
        expect(error.reason).toBe("engine-unavailable");
      });
    })
  );
});
