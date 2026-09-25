import { fcRuns } from "@beep/fc-runs";
import * as GlobModule from "@beep/schema/Glob";
import { Glob } from "@beep/schema/Glob";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decodeGlobModuleSchemaEffect = S.decodeEffect(GlobModule.Schema);
const decodeUnknownGlobEffect = S.decodeUnknownEffect(Glob);
const isGlob2 = S.is(Glob);
const GlobPayload = S.Struct({ glob: Glob });
const decodeGlobPayloadEffect = S.decodeEffect(GlobPayload);

describe("Glob", () => {
  it.effect(
    "accepts portable glob patterns supported by the Bun parser",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownGlobEffect("src/**/*.ts")).toBe("src/**/*.ts");
      expect(yield* decodeUnknownGlobEffect("{src,test}/**/*.ts")).toBe("{src,test}/**/*.ts");
      expect(yield* decodeUnknownGlobEffect("foo/bar")).toBe("foo/bar");
      expect(yield* decodeUnknownGlobEffect("foo/[bar")).toBe("foo/[bar");
      expect(yield* decodeUnknownGlobEffect("foo/{bar")).toBe("foo/{bar");
      expect(yield* decodeUnknownGlobEffect("!index.ts")).toBe("!index.ts");
    })
  );

  it.effect(
    "rejects empty input",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.result(decodeUnknownGlobEffect(""));
      expect(Result.isFailure(failure1)).toBe(true);
      if (Result.isFailure(failure1)) {
        expect(failure1.failure.message).toContain("Glob pattern must not be empty");
      }
    })
  );

  it.effect(
    "rejects backslash-separated patterns",
    Effect.fnUntraced(function* () {
      const failure2 = yield* Effect.result(decodeUnknownGlobEffect("src\\**\\*.ts"));
      expect(Result.isFailure(failure2)).toBe(true);
      if (Result.isFailure(failure2)) {
        expect(failure2.failure.message).toContain("Glob pattern must use forward slashes instead of backslashes");
      }
    })
  );

  it.effect(
    "rejects patterns longer than the current matcher limit",
    Effect.fnUntraced(function* () {
      const tooLong = "a".repeat(65_537);

      const failure3 = yield* Effect.result(decodeUnknownGlobEffect(tooLong));
      expect(Result.isFailure(failure3)).toBe(true);
      if (Result.isFailure(failure3)) {
        expect(failure3.failure.message).toContain("Glob pattern must not exceed 65536 characters");
      }
    })
  );

  it("supports guard-style schema checks", () => {
    expect(isGlob2("src/**/*.ts")).toBe(true);
    expect(isGlob2("src\\**\\*.ts")).toBe(false);
  });

  it.effect(
    "reports nested field failures at the glob key",
    Effect.fnUntraced(function* () {
      const failure4 = yield* Effect.result(decodeGlobPayloadEffect({ glob: "src\\**\\*.ts" }));
      expect(Result.isFailure(failure4)).toBe(true);
      if (Result.isFailure(failure4)) {
        expect(failure4.failure.message).toContain(`at ["glob"]`);
      }
    })
  );

  {
    const arbitrary = Arbitrary.schema(Glob);
    it.effect.prop(
      "derives portable glob patterns from the source schema arbitrary",
      [arbitrary],
      Effect.fnUntraced(function* ([pattern]) {
        expect(isGlob2(pattern)).toBe(true);
        expect(yield* decodeUnknownGlobEffect(pattern)).toBe(pattern);

        return true;
      }),
      { arbitrary: fcRuns(25) }
    );
  }

  it.effect(
    "exposes the canonical namespace module schema role",
    Effect.fnUntraced(function* () {
      expect(yield* decodeGlobModuleSchemaEffect("src/**/*.ts")).toBe("src/**/*.ts");
      expect(GlobModule.Glob).toBe(GlobModule.Schema);
    })
  );
});
