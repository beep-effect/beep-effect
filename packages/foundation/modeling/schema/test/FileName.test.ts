import { fcRuns } from "@beep/fc-runs";
import { FileName } from "@beep/schema/FileName";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

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
      const failure1 = yield* Effect.exit(decodeUnknownFileNameEffect(".png"));
      pipe(failure1, Exit.hasFails, assertTrue);
    })
  );

  it.effect(
    "rejects names without a known extension segment",
    Effect.fnUntraced(function* () {
      const failure2 = yield* Effect.exit(decodeUnknownFileNameEffect("readme"));
      pipe(failure2, Exit.hasFails, assertTrue);
      const failure3 = yield* Effect.exit(decodeUnknownFileNameEffect("readme."));
      pipe(failure3, Exit.hasFails, assertTrue);
      const failure4 = yield* Effect.exit(decodeUnknownFileNameEffect("readme.unknownext"));
      pipe(failure4, Exit.hasFails, assertTrue);
    })
  );

  it.effect(
    "rejects names containing path separators",
    Effect.fnUntraced(function* () {
      const failure5 = yield* Effect.exit(decodeUnknownFileNameEffect("bad/name.txt"));
      pipe(failure5, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure5)) {
        expect(pipe(failure5.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "File name stems must not contain /"
        );
      }
      const failure6 = yield* Effect.exit(decodeUnknownFileNameEffect("bad\\name.txt"));
      pipe(failure6, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure6)) {
        expect(pipe(failure6.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "File name stems must not contain \\"
        );
      }
    })
  );

  it.effect(
    "rejects names containing embedded NUL bytes",
    Effect.fnUntraced(function* () {
      const failure7 = yield* Effect.exit(decodeUnknownFileNameEffect(`bad\u0000name.txt`));
      pipe(failure7, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure7)) {
        expect(pipe(failure7.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "File name stems must not contain embedded NUL bytes"
        );
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
      const failure8 = yield* Effect.exit(decodeFileNamePayloadEffect({ fileName: "bad/name.txt" }));
      pipe(failure8, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure8)) {
        expect(pipe(failure8.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(`at ["fileName"]`);
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
