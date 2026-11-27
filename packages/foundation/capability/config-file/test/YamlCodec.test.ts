import { ConfigCodecError } from "@beep/config-file/ConfigCodec";
import { YamlCodec } from "@beep/config-file/YamlCodec";
import { YamlParseError } from "@beep/yaml";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

describe("YamlCodec", () => {
  it.effect("parses a YAML document", () =>
    Effect.gen(function* () {
      const parsed = yield* YamlCodec.parse("port: 8080\nhost: localhost\n");
      assert.deepStrictEqual(parsed, { port: 8080, host: "localhost" });
    })
  );

  it.effect("wraps a yaml parse failure as ConfigCodecError with the cause preserved structurally", () =>
    Effect.gen(function* () {
      const error = yield* YamlCodec.parse("port: [unclosed").pipe(Effect.asVoid, Effect.flip);
      assert.instanceOf(error, ConfigCodecError);
      assert.strictEqual(error.codec, "yaml");
      assert.strictEqual(error.operation, "parse");
      assert.isDefined(error.cause);
      assert.notStrictEqual(typeof error.cause, "string");
      assert.instanceOf(
        error.cause,
        YamlParseError,
        "the underlying YamlParseError survives structurally, not as prose"
      );
    })
  );

  it.effect("round-trips through stringify", () =>
    Effect.gen(function* () {
      const text = yield* YamlCodec.stringify({ port: 8080 });
      const parsed = yield* YamlCodec.parse(text);
      assert.deepStrictEqual(parsed, { port: 8080 });
    })
  );

  it.effect("never dies on hostile deeply-nested input — trips the composer's nesting-depth cap", () =>
    Effect.gen(function* () {
      const depthBeyondNestingCap = 1000;
      const hostile = `${Str.repeat(depthBeyondNestingCap)("[")}1${Str.repeat(depthBeyondNestingCap)("]")}`;
      const exit = yield* Effect.exit(YamlCodec.parse(hostile));
      const causeOption = Exit.getCause(exit);
      const failureCause = O.getOrThrow(causeOption);
      assertExitFailure(exit, failureCause);
      assertSome(causeOption, failureCause);
      assert.isTrue(Cause.hasFails(failureCause));
      assert.isFalse(Cause.hasDies(failureCause));
      const error = yield* YamlCodec.parse(hostile).pipe(Effect.asVoid, Effect.flip);
      assert.instanceOf(error.cause, YamlParseError);
      const cause = error.cause;
      if (!S.is(YamlParseError)(cause)) return assert.fail("expected YamlParseError");
      assert.isTrue(
        A.some(cause.diagnostics, (d) => d.code === "NestingDepthExceeded"),
        "valid YAML 1000 deep exceeds the 256 MAX_NESTING_DEPTH cap, so the depth guard fires, not a syntax error"
      );
    })
  );

  it.effect("an alias bomb fails as a typed ConfigCodecError, never a defect — trips the alias-expansion budget", () =>
    Effect.gen(function* () {
      const sixTiersOfTenAliases = [
        "a0: &a0 [x, x]",
        "a1: &a1 [*a0,*a0,*a0,*a0,*a0,*a0,*a0,*a0,*a0,*a0]",
        "a2: &a2 [*a1,*a1,*a1,*a1,*a1,*a1,*a1,*a1,*a1,*a1]",
        "a3: &a3 [*a2,*a2,*a2,*a2,*a2,*a2,*a2,*a2,*a2,*a2]",
        "a4: &a4 [*a3,*a3,*a3,*a3,*a3,*a3,*a3,*a3,*a3,*a3]",
        "a5: &a5 [*a4,*a4,*a4,*a4,*a4,*a4,*a4,*a4,*a4,*a4]",
        "bomb: [*a5,*a5,*a5,*a5,*a5,*a5,*a5,*a5,*a5,*a5]",
      ];
      const bomb = A.join(sixTiersOfTenAliases, "\n");
      const exit = yield* Effect.exit(YamlCodec.parse(bomb));
      const causeOption = Exit.getCause(exit);
      const failureCause = O.getOrThrow(causeOption);
      assertExitFailure(exit, failureCause);
      assertSome(causeOption, failureCause);
      assert.isTrue(Cause.hasFails(failureCause), "the guard fails typed");
      assert.isFalse(Cause.hasDies(failureCause), "a Die reason would mean the guard threw");
      const error = yield* YamlCodec.parse(bomb).pipe(Effect.asVoid, Effect.flip);
      assert.instanceOf(error, ConfigCodecError);
      assert.strictEqual(error.codec, "yaml");
      assert.instanceOf(error.cause, YamlParseError);
      const cause = error.cause;
      if (!S.is(YamlParseError)(cause)) return assert.fail("expected YamlParseError");
      assert.isTrue(
        A.some(cause.diagnostics, (d) => d.code === "AliasCountExceeded"),
        "60 raw alias tokens stay under maxAliasCount 100; ~10^6 expanded nodes exceed the 1_010_000 budget"
      );
      assert.isTrue(
        A.some(cause.diagnostics, (d) => Str.includes("expansion exceeded budget")(d.message)),
        "both guards report AliasCountExceeded; only the expansion budget says expansion exceeded budget"
      );
    })
  );
});
