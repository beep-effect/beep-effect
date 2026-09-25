import { fcRuns } from "@beep/fc-runs";
import * as GlobModule from "@beep/schema/Glob";
import { Glob } from "@beep/schema/Glob";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

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
      const failure1 = yield* Effect.exit(decodeUnknownGlobEffect(""));
      pipe(failure1, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure1)) {
        expect(pipe(failure1.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Glob pattern must not be empty"
        );
      }
    })
  );

  it.effect(
    "rejects backslash-separated patterns",
    Effect.fnUntraced(function* () {
      const failure2 = yield* Effect.exit(decodeUnknownGlobEffect("src\\**\\*.ts"));
      pipe(failure2, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure2)) {
        expect(pipe(failure2.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Glob pattern must use forward slashes instead of backslashes"
        );
      }
    })
  );

  it.effect(
    "rejects patterns longer than the current matcher limit",
    Effect.fnUntraced(function* () {
      const tooLong = "a".repeat(65_537);

      const failure3 = yield* Effect.exit(decodeUnknownGlobEffect(tooLong));
      pipe(failure3, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure3)) {
        expect(pipe(failure3.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Glob pattern must not exceed 65536 characters"
        );
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
      const failure4 = yield* Effect.exit(decodeGlobPayloadEffect({ glob: "src\\**\\*.ts" }));
      pipe(failure4, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure4)) {
        expect(pipe(failure4.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(`at ["glob"]`);
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
