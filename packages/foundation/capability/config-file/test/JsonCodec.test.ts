import { ConfigCodecError } from "@beep/config-file/ConfigCodec";
import { JsonCodec } from "@beep/config-file/JsonCodec";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertSome, assertSuccess } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const JsonValue = S.fromJsonString(S.Unknown);

describe("JsonCodec", () => {
  it.effect("parses valid JSON to an unknown value", () =>
    Effect.gen(function* () {
      const parsed = yield* JsonCodec.parse(`{"port":8080}`);
      assert.deepStrictEqual(parsed, { port: 8080 });
    })
  );

  it.effect("stringifies a value back to JSON text", () =>
    Effect.gen(function* () {
      const text = yield* JsonCodec.stringify({ port: 8080 });
      assertSuccess(S.decodeResult(JsonValue)(text), { port: 8080 });
    })
  );

  it.effect("fails with ConfigCodecError carrying a structured cause, not a string", () =>
    Effect.gen(function* () {
      const error = yield* JsonCodec.parse("{ not json").pipe(Effect.asVoid, Effect.flip);
      assert.instanceOf(error, ConfigCodecError);
      assert.strictEqual(error._tag, "ConfigCodecError");
      assert.strictEqual(error.codec, "json");
      assert.strictEqual(error.operation, "parse");
      assert.instanceOf(error.cause, S.SchemaError, "the underlying SchemaError survives structurally");
    })
  );

  it.effect("fails with operation: stringify on a circular value", () =>
    Effect.gen(function* () {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      const error = yield* Effect.flip(JsonCodec.stringify(circular));
      assert.strictEqual(error.operation, "stringify");
      assert.instanceOf(error.cause, S.SchemaError);
    })
  );

  it.effect("never dies — malformed input fails through the typed channel", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(JsonCodec.parse("{ not json"));
      const cause = exit.pipe(Exit.getCause, O.getOrThrow);
      assertExitFailure(exit, cause);
      assertSome(Exit.getCause(exit), cause);
      assert.isTrue(Cause.hasFails(cause), "the parser fails typed with a Fail reason");
      assert.isFalse(Cause.hasDies(cause), "a Die reason would mean the parser threw");
    })
  );
});
