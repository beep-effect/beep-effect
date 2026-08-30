import { fcRuns } from "@beep/fc-runs";
import {
  Byte,
  DetectedFileInfo,
  DetectFileOptions,
  detectFile,
  FileContent,
  FileSignature,
  FileType,
  FileTypeCatalog,
  FileTypeInfo,
  isFileContent,
  isFileType,
  ValidateFileTypeOptions,
  validateFileType,
} from "@beep/schema/FileTypeChecker";
import { describe, expect, it } from "@effect/vitest";
import { Match, pipe } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { FileType as FileTypeValue } from "@beep/schema/FileTypeChecker";

const pngBytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const sharedIsoMediaSignature = [0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x56, 0x20];
const webmDocType = [0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d];
const matroskaDocType = [0x42, 0x82, 0x88, 0x6d, 0x61, 0x74, 0x72, 0x6f, 0x73, 0x6b, 0x61];
const flacWithFinalStreamInfo = pipe(
  [
    0x66, 0x4c, 0x61, 0x43, 0x80, 0x00, 0x00, 0x22, 0x10, 0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0a,
    0xc4, 0x42, 0xf0, 0x00, 0x00, 0x00, 0x00,
  ],
  A.appendAll(A.replicate(0, 16))
);
const signatureEquivalence = S.toEquivalence(FileSignature);
const fileTypeEquivalence = S.toEquivalence(FileType);

const catalogCases = pipe(
  FileType.Options,
  A.flatMap((type) =>
    A.map(FileTypeCatalog[type].signatures, (signature, signatureIndex) => ({
      signature,
      signatureIndex,
      type,
    }))
  )
);

const baseSampleFromSignature = (signature: FileSignature): ReadonlyArray<number> => {
  const spanLength = signature.sequence.length + signature.skippedBytes.length;
  return A.makeBy(signature.offset + spanLength, (absoluteIndex) => {
    const fileIndex = absoluteIndex - signature.offset;
    if (fileIndex < 0 || A.contains(signature.skippedBytes, fileIndex)) return 0;
    const skippedBefore = A.filter(signature.skippedBytes, (skipped) => skipped < fileIndex).length;
    return signature.sequence[fileIndex - skippedBefore] ?? 0;
  });
};

const enrichSample = Match.type<{
  readonly base: ReadonlyArray<number>;
  readonly signature: FileSignature;
  readonly type: FileTypeValue;
}>().pipe(
  Match.when({ type: "avif" }, () => [0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]),
  Match.when({ type: "heic" }, ({ base, signature }) =>
    Num.Equivalence(signature.sequence.length, 5) ? A.appendAll(base, [0x69, 0x66, 0x31]) : base
  ),
  Match.when({ type: "mkv" }, ({ base }) => A.appendAll(base, matroskaDocType)),
  Match.when({ type: "webm" }, ({ base }) => A.appendAll(base, webmDocType)),
  Match.orElse(({ base }) => base)
);

const sampleFromSignature = (type: FileTypeValue, signature: FileSignature): ReadonlyArray<number> =>
  enrichSample({ base: baseSampleFromSignature(signature), signature, type });

const canonicalDetectedType = (type: FileTypeValue, signature: FileSignature): FileTypeValue =>
  Eq.equals(signature.sequence, sharedIsoMediaSignature) ? "m4v" : type;

const expectSchemaRoundTrip = <A, I>(schema: S.Codec<A, I>, value: A): void => {
  const encoded = Result.getOrThrow(S.encodeUnknownResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeResult(schema)(encoded));
  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
};

describe("FileTypeChecker schemas", () => {
  it("owns constructor, decoding, and encoding defaults", () => {
    const madeSignature = FileSignature.make({ sequence: [0x50, 0x4b] });
    expect(madeSignature).toMatchObject({ offset: 0, skippedBytes: [], compatibleExtensions: [] });
    expect(O.isNone(madeSignature.description)).toBe(true);

    const decodedSignature = Result.getOrThrow(S.decodeResult(FileSignature)({ sequence: [0x50, 0x4b] }));
    expect(decodedSignature.offset).toBe(0);
    expect(decodedSignature.skippedBytes).toEqual([]);
    expect(decodedSignature.compatibleExtensions).toEqual([]);
    expect(O.isNone(decodedSignature.description)).toBe(true);
    expect(Result.getOrThrow(S.encodeUnknownResult(FileSignature)(decodedSignature))).toEqual({
      sequence: [0x50, 0x4b],
      offset: 0,
      skippedBytes: [],
      compatibleExtensions: [],
    });

    const describedSignature = Result.getOrThrow(
      S.decodeResult(FileSignature)({ sequence: [0x50, 0x4b], description: "ZIP marker" })
    );
    expect(O.getOrNull(describedSignature.description)).toBe("ZIP marker");
    expect(Result.getOrThrow(S.encodeUnknownResult(FileSignature)(describedSignature)).description).toBe("ZIP marker");

    const madeDetectOptions = DetectFileOptions.make({});
    const madeValidateOptions = ValidateFileTypeOptions.make({});
    expect(madeDetectOptions.chunkSize).toBe(64);
    expect(madeValidateOptions).toMatchObject({ chunkSize: 64, excludeSimilarTypes: false });

    const detectOptions = Result.getOrThrow(S.decodeResult(DetectFileOptions)({}));
    const validateOptions = Result.getOrThrow(S.decodeResult(ValidateFileTypeOptions)({}));
    expect(detectOptions.chunkSize).toBe(64);
    expect(validateOptions).toMatchObject({ chunkSize: 64, excludeSimilarTypes: false });
    expect(Result.getOrThrow(S.encodeUnknownResult(DetectFileOptions)(detectOptions))).toEqual({ chunkSize: 64 });
    expect(Result.getOrThrow(S.encodeUnknownResult(ValidateFileTypeOptions)(validateOptions))).toEqual({
      chunkSize: 64,
      excludeSimilarTypes: false,
    });
  });

  it("rejects invalid bytes, options, signatures, and file types", () => {
    for (const invalidByte of [-1, 0.5, 256]) {
      expect(Result.isFailure(S.decodeResult(Byte)(invalidByte))).toBe(true);
    }
    for (const invalidChunkSize of [-1, 0, 1.5]) {
      expect(Result.isFailure(S.decodeResult(DetectFileOptions)({ chunkSize: invalidChunkSize }))).toBe(true);
    }
    for (const invalidSignature of [
      { sequence: [] },
      { sequence: [1], skippedBytes: [0, 0] },
      { sequence: [1], skippedBytes: [99] },
      { sequence: [1], compatibleExtensions: ["png", "png"] },
    ]) {
      expect(Result.isFailure(S.decodeUnknownResult(FileSignature)(invalidSignature))).toBe(true);
    }
    const rawSignature = { sequence: [0x89, 0x50, 0x4e, 0x47] };
    for (const invalidInfo of [
      {
        extension: "png",
        mimeType: "image/png",
        description: "Duplicate signatures",
        signatures: [rawSignature, rawSignature],
      },
      {
        extension: "png",
        mimeType: "image/png",
        description: "Self-compatible signature",
        signatures: [{ ...rawSignature, compatibleExtensions: ["png"] }],
      },
      {
        extension: "png",
        mimeType: "foo/bar",
        description: "Unowned media type",
        signatures: [rawSignature],
      },
    ]) {
      expect(Result.isFailure(S.decodeUnknownResult(FileTypeInfo)(invalidInfo))).toBe(true);
    }
    expect(
      Result.isSuccess(
        S.decodeResult(FileTypeInfo)({
          extension: "blend",
          mimeType: "application/x-blender",
          description: "Blender asset",
          signatures: [{ sequence: [0x42, 0x4c, 0x45, 0x4e, 0x44, 0x45, 0x52] }],
        })
      )
    ).toBe(true);
    expect(isFileContent([0, 255])).toBe(true);
    expect(isFileContent([256])).toBe(false);
    expect(isFileType("png")).toBe(true);
    expect(isFileType("PNG")).toBe(false);
  });

  it("requires canonical ordering for set-like signature metadata", () => {
    const canonical = FileSignature.make({
      sequence: [1],
      skippedBytes: [1, 2],
      compatibleExtensions: ["flv", "mp4"],
    });
    expect(Result.getOrThrow(S.encodeUnknownResult(FileSignature)(canonical))).toMatchObject({
      skippedBytes: [1, 2],
      compatibleExtensions: ["flv", "mp4"],
    });
    expect(Result.isFailure(S.decodeResult(FileSignature)({ sequence: [1], skippedBytes: [2, 1] }))).toBe(true);
    expect(
      Result.isFailure(S.decodeResult(FileSignature)({ sequence: [1], compatibleExtensions: ["mp4", "flv"] }))
    ).toBe(true);
  });

  it("round-trips every public schema representation", () => {
    const signature = FileSignature.make({ sequence: [0x89, 0x50, 0x4e, 0x47] });
    const info = FileTypeInfo.make({
      extension: "png",
      mimeType: "image/png",
      description: "Portable Network Graphics image",
      signatures: [signature],
    });
    const detected = DetectedFileInfo.make({ info, signature });

    expectSchemaRoundTrip(FileTypeInfo, info);
    expectSchemaRoundTrip(DetectedFileInfo, detected);
    expectSchemaRoundTrip(DetectFileOptions, DetectFileOptions.make({}));
    expectSchemaRoundTrip(ValidateFileTypeOptions, ValidateFileTypeOptions.make({}));

    for (const content of [[1, 2], new Uint8Array([1, 2]), new Uint8Array([1, 2]).buffer]) {
      const decoded = Result.getOrThrow(S.decodeResult(FileContent)(content));
      const encoded = Result.getOrThrow(S.encodeUnknownResult(FileContent)(decoded));
      expect(Result.isSuccess(S.decodeResult(FileContent)(encoded))).toBe(true);
    }
  });

  it("keeps catalog keys correlated, exhaustive, and schema-valid", () => {
    const catalogKeys = R.keys(FileTypeCatalog);
    expect(catalogKeys).toHaveLength(FileType.Options.length);
    expect(A.every(FileType.Options, (type) => A.contains(catalogKeys, type))).toBe(true);
    for (const type of FileType.Options) {
      const info = FileTypeCatalog[type];
      expect(info.extension).toBe(type);
      expect(S.is(FileTypeInfo)(info)).toBe(true);
      expect(A.isReadonlyArrayNonEmpty(info.signatures)).toBe(true);
      expect(A.every(info.signatures, S.is(FileSignature))).toBe(true);
    }
  });

  it("derives codec-equivalent arbitrary values from every public schema", () => {
    fc.assert(
      fc.property(
        S.toArbitrary(FileType)(fc),
        S.toArbitrary(Byte)(fc),
        S.toArbitrary(FileContent)(fc),
        S.toArbitrary(FileSignature)(fc),
        S.toArbitrary(FileTypeInfo)(fc),
        S.toArbitrary(DetectedFileInfo)(fc),
        S.toArbitrary(DetectFileOptions)(fc),
        S.toArbitrary(ValidateFileTypeOptions)(fc),
        (type, byte, content, signature, info, detected, detectOptions, validateOptions) => {
          expectSchemaRoundTrip(FileType, type);
          expectSchemaRoundTrip(Byte, byte);
          expectSchemaRoundTrip(FileContent, content);
          expectSchemaRoundTrip(FileSignature, signature);
          expectSchemaRoundTrip(FileTypeInfo, info);
          expectSchemaRoundTrip(DetectedFileInfo, detected);
          expectSchemaRoundTrip(DetectFileOptions, detectOptions);
          expectSchemaRoundTrip(ValidateFileTypeOptions, validateOptions);
        }
      ),
      fcRuns(25)
    );
  });
});

describe("detectFile", () => {
  it("exercises every authored catalog signature", () => {
    const options = DetectFileOptions.make({ chunkSize: 30_000 });
    for (const { type, signature, signatureIndex } of catalogCases) {
      const detected = O.getOrThrow(pipe(sampleFromSignature(type, signature), detectFile(options)));
      const expectedType = canonicalDetectedType(type, signature);
      expect(detected.extension, `${type} signature ${signatureIndex}`).toBe(expectedType);
      expect(S.is(DetectedFileInfo)(detected)).toBe(true);
      if (fileTypeEquivalence(expectedType, type)) {
        expect(signatureEquivalence(detected.signature, signature), `${type} signature ${signatureIndex}`).toBe(true);
      } else {
        expect(Eq.equals(detected.signature.sequence, signature.sequence)).toBe(true);
        expect(detected.signature.offset).toBe(signature.offset);
      }
    }
  });

  it("supports arrays, non-zero-offset views, ArrayBuffers, and both call forms", () => {
    const wrapped = new Uint8Array([0, ...pngBytes, 0]);
    const view = wrapped.subarray(1, 1 + pngBytes.length);
    expect(O.getOrThrow(detectFile(pngBytes)).extension).toBe("png");
    expect(O.getOrThrow(detectFile()(view)).extension).toBe("png");
    expect(
      O.getOrThrow(detectFile(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength))).extension
    ).toBe("png");
    expect(O.getOrThrow(detectFile(DetectFileOptions.make({ chunkSize: pngBytes.length }))(view)).extension).toBe(
      "png"
    );
  });

  it("accepts FLAC when STREAMINFO is the final metadata block", () => {
    expect(O.getOrThrow(detectFile(flacWithFinalStreamInfo)).extension).toBe("flac");
    expect(validateFileType(flacWithFinalStreamInfo, ["flac"])).toBe(true);
  });

  it("returns none for empty, invalid, detached, unknown, truncated, and inconclusive input", () => {
    const detached = new ArrayBuffer(4);
    detached.transfer();
    expect(O.isNone(detectFile([]))).toBe(true);
    expect(O.isNone(detectFile([256]))).toBe(true);
    expect(O.isNone(detectFile(detached))).toBe(true);
    expect(O.isNone(detectFile([1, 2, 3, 4]))).toBe(true);
    expect(O.isNone(detectFile(pngBytes, DetectFileOptions.make({ chunkSize: pngBytes.length - 1 })))).toBe(true);
    expect(O.isNone(detectFile([0, 0, 0]))).toBe(true);
    expect(O.isNone(detectFile([0x1a, 0x45, 0xdf, 0xa3]))).toBe(true);
  });

  it("honors skipped positions independently of significant signature bytes", () => {
    const wav = [0x52, 0x49, 0x46, 0x46, 0x12, 0x34, 0x56, 0x78, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20];
    const changedSkippedByte = pipe(A.replace(wav, 4, 0xff), O.getOrThrow);
    const changedSignificantByte = pipe(A.replace(wav, 8, 0xff), O.getOrThrow);
    expect(O.getOrThrow(detectFile(wav)).extension).toBe("wav");
    expect(O.getOrThrow(detectFile(changedSkippedByte)).extension).toBe("wav");
    expect(O.isNone(detectFile(changedSignificantByte))).toBe(true);
  });

  it("respects exact chunk boundaries and explicitly enlarged high-offset windows", () => {
    for (const signature of FileTypeCatalog.zip.signatures) {
      if (Num.Equivalence(signature.offset, 0)) continue;
      const sample = baseSampleFromSignature(signature);
      const boundary = signature.offset + signature.sequence.length + signature.skippedBytes.length;
      expect(O.isNone(detectFile(sample, DetectFileOptions.make({ chunkSize: boundary - 1 })))).toBe(true);
      expect(O.getOrThrow(detectFile(sample, DetectFileOptions.make({ chunkSize: boundary }))).extension).toBe("zip");
      if (boundary > 64) expect(O.isNone(detectFile(sample))).toBe(true);
    }
  });

  it("uses anchored ISO evidence and rejects contradictory EBML document types", () => {
    const heic = sampleFromSignature("heic", FileTypeCatalog.heic.signatures[0]);
    expect(
      O.getOrThrow(detectFile(A.appendAll(heic, [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]))).extension
    ).toBe("heic");
    for (const signature of FileTypeCatalog.heic.signatures) {
      expect(O.getOrThrow(detectFile(sampleFromSignature("heic", signature))).extension).toBe("heic");
    }
    const ebml = baseSampleFromSignature(FileTypeCatalog.webm.signatures[0]);
    expect(O.isNone(detectFile(pipe(ebml, A.appendAll(webmDocType), A.appendAll(matroskaDocType))))).toBe(true);
  });
});

describe("validateFileType", () => {
  it("keeps every public overload sound, including empty curried type lists", () => {
    expect(validateFileType(pngBytes, ["jpeg", "png"])).toBe(true);
    expect(validateFileType(["png"])(pngBytes)).toBe(true);
    expect(validateFileType(["png"], ValidateFileTypeOptions.make({ excludeSimilarTypes: true }))(pngBytes)).toBe(true);
    expect(validateFileType(pngBytes, ["jpeg"])).toBe(false);

    const empty = validateFileType([]);
    const emptyWithOptions = validateFileType([], ValidateFileTypeOptions.make({ chunkSize: 64 }));
    expect(P.isFunction(empty)).toBe(true);
    expect(P.isFunction(emptyWithOptions)).toBe(true);
    expect(empty(pngBytes)).toBe(false);
    expect(emptyWithOptions(pngBytes)).toBe(false);
  });

  it("derives permissive compatibility from each detected signature", () => {
    const options = DetectFileOptions.make({ chunkSize: 30_000 });
    for (const { type, signature } of catalogCases) {
      const sample = sampleFromSignature(type, signature);
      const detected = O.getOrThrow(detectFile(sample, options));
      for (const compatible of A.filter(detected.signature.compatibleExtensions, isFileType)) {
        expect(validateFileType(sample, [compatible], ValidateFileTypeOptions.make({ chunkSize: 30_000 }))).toBe(true);
        if (!Eq.equals(compatible, detected.extension)) {
          expect(
            validateFileType(
              sample,
              [compatible],
              ValidateFileTypeOptions.make({ chunkSize: 30_000, excludeSimilarTypes: true })
            )
          ).toBe(false);
        }
      }
    }
  });

  it("keeps compatibility directional and rejects invalid or inconclusive input", () => {
    const m4v = sampleFromSignature("m4v", FileTypeCatalog.m4v.signatures[0]);
    const m4a = sampleFromSignature("m4a", FileTypeCatalog.m4a.signatures[0]);
    const mp4 = sampleFromSignature("mp4", FileTypeCatalog.mp4.signatures[0]);
    const aac = sampleFromSignature("aac", FileTypeCatalog.aac.signatures[0]);
    expect(validateFileType(m4v, ["mp4"])).toBe(true);
    expect(validateFileType(m4a, ["aac"])).toBe(true);
    expect(validateFileType(mp4, ["m4v"])).toBe(false);
    expect(validateFileType(aac, ["m4a"])).toBe(false);
    expect(validateFileType([256], ["png"])).toBe(false);
    expect(validateFileType([0, 0, 0], ["avif"])).toBe(false);
  });
});
