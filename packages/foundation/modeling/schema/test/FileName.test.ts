import { fcRuns } from "@beep/fc-runs";
import { FileName } from "@beep/schema/FileName";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as Option from "effect/Option";
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
      const decodedUnknownFileNameEffect = yield* decodeUnknownFileNameEffect("readme.txt");
      expect(decodedUnknownFileNameEffect).toBe("readme.txt");
      const decodedUnknownFileNameEffect1 = yield* decodeUnknownFileNameEffect("archive.tar.gz");
      expect(decodedUnknownFileNameEffect1).toBe("archive.tar.gz");
      const decodedUnknownFileNameEffect2 = yield* decodeUnknownFileNameEffect("release.notes.v1.txt");
      expect(decodedUnknownFileNameEffect2).toBe("release.notes.v1.txt");
      const decodedUnknownFileNameEffect3 = yield* decodeUnknownFileNameEffect(".cache.png");
      expect(decodedUnknownFileNameEffect3).toBe(".cache.png");
    })
  );

  it.effect(
    "keeps FilePath's any-major-os portability policy for accepted names",
    Effect.fnUntraced(function* () {
      const decodedUnknownFileNameEffect4 = yield* decodeUnknownFileNameEffect("a<.txt");
      expect(decodedUnknownFileNameEffect4).toBe("a<.txt");
      const decodedUnknownFileNameEffect5 = yield* decodeUnknownFileNameEffect("CON.txt");
      expect(decodedUnknownFileNameEffect5).toBe("CON.txt");
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
      if (Exit.isFailure(failure5) && Exit.hasFails(failure5)) {
        expect(pipe(failure5.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "File name stems must not contain /"
        );
      }
      const failure6 = yield* Effect.exit(decodeUnknownFileNameEffect("bad\\name.txt"));
      pipe(failure6, Exit.hasFails, assertTrue);
      if (Exit.isFailure(failure6) && Exit.hasFails(failure6)) {
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
      if (Exit.isFailure(failure7) && Exit.hasFails(failure7)) {
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
      if (Exit.isFailure(failure8) && Exit.hasFails(failure8)) {
        expect(pipe(failure8.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(`at ["fileName"]`);
      }
    })
  );

  it.effect(
    "decodes object schemas with a fileName property",
    Effect.fnUntraced(function* () {
      const input = { fileName: "archive.tar.gz" };

      const decodedUnknownFileNamePayloadEffect = yield* decodeUnknownFileNamePayloadEffect(input);
      expect(decodedUnknownFileNamePayloadEffect).toEqual(input);
    })
  );

  {
    const arbitrary = Arbitrary.schema(FileName);
    it.effect.prop(
      "derives only-valid names from the schema arbitrary and round-trips them",
      [arbitrary],
      Effect.fnUntraced(function* ([name]) {
        expect(isFileName2(name)).toBe(true);
        const decodedUnknownFileNameEffect6 = yield* decodeUnknownFileNameEffect(name);
        expect(decodedUnknownFileNameEffect6).toBe(name);

        return true;
      }),
      { arbitrary: fcRuns(50) }
    );
  }
});
