import { ConfigCodecError } from "@beep/config-file/ConfigCodec";
import { TomlCodec } from "@beep/config-file/TomlCodec";
import { TomlParseError, TomlStringifyError } from "@beep/toml";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

describe("TomlCodec", () => {
  it.effect("parses a TOML document", () =>
    Effect.gen(function* () {
      const parsed = yield* TomlCodec.parse('port = 8080\nhost = "localhost"\n');
      assert.deepStrictEqual(parsed, { port: 8080, host: "localhost" });
    })
  );

  it.effect("wraps a toml parse failure as ConfigCodecError with the cause preserved structurally", () =>
    Effect.gen(function* () {
      const error = yield* TomlCodec.parse("port = [unclosed").pipe(Effect.asVoid, Effect.flip);
      assert.instanceOf(error, ConfigCodecError);
      assert.strictEqual(error.codec, "toml");
      assert.strictEqual(error.operation, "parse");
      assert.isDefined(error.cause);
      assert.notStrictEqual(typeof error.cause, "string");
      assert.instanceOf(
        error.cause,
        TomlParseError,
        "the underlying TomlParseError survives structurally, not as prose"
      );
    })
  );

  it.effect("round-trips through stringify", () =>
    Effect.gen(function* () {
      const text = yield* TomlCodec.stringify({ port: 8080 });
      const parsed = yield* TomlCodec.parse(text);
      assert.deepStrictEqual(parsed, { port: 8080 });
    })
  );

  it.effect("wraps a toml stringify failure as ConfigCodecError — TOML has no null", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(TomlCodec.stringify({ port: null }));
      assert.instanceOf(error, ConfigCodecError);
      assert.strictEqual(error.codec, "toml");
      assert.strictEqual(error.operation, "stringify");
      assert.instanceOf(
        error.cause,
        TomlStringifyError,
        "TOML cannot represent null, so the structured TomlStringifyError rides in cause"
      );
      const cause = error.cause;
      if (!S.is(TomlStringifyError)(cause)) return assert.fail("expected TomlStringifyError");
      assert.strictEqual(cause.diagnostic.code, "UnsupportedValue");
    })
  );

  it.effect("never dies on hostile deeply-nested input — trips the parser's nesting-depth cap", () =>
    Effect.gen(function* () {
      const depthBeyondNestingCap = 1000;
      const hostile = `bomb = ${Str.repeat(depthBeyondNestingCap)("[")}1${Str.repeat(depthBeyondNestingCap)("]")}`;
      const exit = yield* Effect.exit(TomlCodec.parse(hostile));
      const causeOption = Exit.getCause(exit);
      const failureCause = O.getOrThrow(causeOption);
      assertExitFailure(exit, failureCause);
      assertSome(causeOption, failureCause);
      assert.isTrue(Cause.hasFails(failureCause), "the guard fails typed");
      assert.isFalse(Cause.hasDies(failureCause), "a Die reason would mean the guard threw");
      const error = yield* TomlCodec.parse(hostile).pipe(Effect.asVoid, Effect.flip);
      assert.instanceOf(error.cause, TomlParseError);
      const cause = error.cause;
      if (!S.is(TomlParseError)(cause)) return assert.fail("expected TomlParseError");
      assert.isTrue(
        A.some(cause.diagnostics, (d) => d.code === "NestingDepthExceeded"),
        "valid TOML 1000 deep exceeds the 256 MAX_NESTING_DEPTH cap, so the depth guard fires, not a syntax error"
      );
    })
  );
});
