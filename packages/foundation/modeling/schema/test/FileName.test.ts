import { fcRuns } from "@beep/fc-runs";
import { FileName } from "@beep/schema/FileName";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decodeUnknownFileNameEffect = S.decodeUnknownEffect(FileName);
const isFileName2 = S.is(FileName);
const FileNamePayload = S.Struct({ fileName: FileName });
const decodeFileNamePayloadEffect = S.decodeEffect(FileNamePayload);
const decodeUnknownFileNamePayloadEffect = S.decodeUnknownEffect(FileNamePayload);

describe("FileName", () => {
  it.effect(
    "accepts portable file names with known extensions",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownFileNameEffect("readme.txt")).toBe("readme.txt");
      expect(yield* decodeUnknownFileNameEffect("archive.tar.gz")).toBe("archive.tar.gz");
      expect(yield* decodeUnknownFileNameEffect("release.notes.v1.txt")).toBe("release.notes.v1.txt");
      expect(yield* decodeUnknownFileNameEffect(".cache.png")).toBe(".cache.png");
    })
  );

  it.effect(
    "keeps FilePath's any-major-os portability policy for accepted names",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownFileNameEffect("a<.txt")).toBe("a<.txt");
      expect(yield* decodeUnknownFileNameEffect("CON.txt")).toBe("CON.txt");
    })
  );

  it.effect(
    "rejects names without a non-empty basename before the final extension",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.result(decodeUnknownFileNameEffect(".png"));
      expect(Result.isFailure(failure1)).toBe(true);
    })
  );

  it.effect(
    "rejects names without a known extension segment",
    Effect.fnUntraced(function* () {
      const failure2 = yield* Effect.result(decodeUnknownFileNameEffect("readme"));
      expect(Result.isFailure(failure2)).toBe(true);
      const failure3 = yield* Effect.result(decodeUnknownFileNameEffect("readme."));
      expect(Result.isFailure(failure3)).toBe(true);
      const failure4 = yield* Effect.result(decodeUnknownFileNameEffect("readme.unknownext"));
      expect(Result.isFailure(failure4)).toBe(true);
    })
  );

  it.effect(
    "rejects names containing path separators",
    Effect.fnUntraced(function* () {
      const failure5 = yield* Effect.result(decodeUnknownFileNameEffect("bad/name.txt"));
      expect(Result.isFailure(failure5)).toBe(true);
      if (Result.isFailure(failure5)) {
        expect(failure5.failure.message).toContain("File name stems must not contain /");
      }
      const failure6 = yield* Effect.result(decodeUnknownFileNameEffect("bad\\name.txt"));
      expect(Result.isFailure(failure6)).toBe(true);
      if (Result.isFailure(failure6)) {
        expect(failure6.failure.message).toContain("File name stems must not contain \\");
      }
    })
  );

  it.effect(
    "rejects names containing embedded NUL bytes",
    Effect.fnUntraced(function* () {
      const failure7 = yield* Effect.result(decodeUnknownFileNameEffect(`bad\u0000name.txt`));
      expect(Result.isFailure(failure7)).toBe(true);
      if (Result.isFailure(failure7)) {
        expect(failure7.failure.message).toContain("File name stems must not contain embedded NUL bytes");
      }
    })
  );

  it("supports guard-style schema checks", () => {
    expect(isFileName2("photo.png")).toBe(true);
    expect(isFileName2("photo")).toBe(false);
    expect(isFileName2("bad/name.txt")).toBe(false);
  });

  it.effect(
    "reports nested field failures at the fileName key",
    Effect.fnUntraced(function* () {
      const failure8 = yield* Effect.result(decodeFileNamePayloadEffect({ fileName: "bad/name.txt" }));
      expect(Result.isFailure(failure8)).toBe(true);
      if (Result.isFailure(failure8)) {
        expect(failure8.failure.message).toContain(`at ["fileName"]`);
      }
    })
  );

  it.effect(
    "decodes object schemas with a fileName property",
    Effect.fnUntraced(function* () {
      const input = { fileName: "archive.tar.gz" };

      expect(yield* decodeUnknownFileNamePayloadEffect(input)).toEqual(input);
    })
  );

  {
    const arbitrary = Arbitrary.schema(FileName);
    it.effect.prop(
      "derives only-valid names from the schema arbitrary and round-trips them",
      [arbitrary],
      Effect.fnUntraced(function* ([name]) {
        expect(isFileName2(name)).toBe(true);
        expect(yield* decodeUnknownFileNameEffect(name)).toBe(name);

        return true;
      }),
      { arbitrary: fcRuns(50) }
    );
  }
});
