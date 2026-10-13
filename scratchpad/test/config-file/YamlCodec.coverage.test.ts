import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ConfigCodecError } from "../../effected/config-file/ConfigCodec.ts";
import { YamlCodec } from "../../effected/config-file/YamlCodec.ts";
import { YamlStringifyError } from "../../effected/yaml/index.ts";

describe("YamlCodec stringify failures", () => {
  it.effect("preserves a circular-reference failure and the offending value structurally", () =>
    Effect.gen(function* () {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      const error = yield* Effect.flip(YamlCodec.stringify(circular));
      assert.instanceOf(error, ConfigCodecError);
      assert.strictEqual(error.codec, "yaml");
      assert.strictEqual(error.operation, "stringify");
      assert.strictEqual(error.path, undefined);
      assert.instanceOf(error.cause, YamlStringifyError);
      const cause = yield* S.decodeEffect(YamlStringifyError)(error.cause);
      assert.strictEqual(cause.value, circular);
      assert.isTrue(A.some(cause.diagnostics, (diagnostic) => diagnostic.code === "CircularReference"));
    }));

  it.effect("reports excessive output nesting as a typed stringify failure", () =>
    Effect.gen(function* () {
      let nested: unknown = "leaf";
      for (let depth = 0; depth < 1000; depth++) nested = [nested];
      const error = yield* Effect.flip(YamlCodec.stringify(nested));
      assert.instanceOf(error, ConfigCodecError);
      assert.strictEqual(error.codec, "yaml");
      assert.strictEqual(error.operation, "stringify");
      const cause = yield* S.decodeUnknownEffect(YamlStringifyError)(error.cause);
      assert.strictEqual(cause.value, nested);
      assert.isTrue(A.some(cause.diagnostics, (diagnostic) => diagnostic.code === "NestingDepthExceeded"));
    }));
});
