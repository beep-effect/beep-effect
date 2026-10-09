import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { YamlTokens } from "../../effected/yaml/YamlToken.ts";

describe("YamlTokens runtime API", () => {
  it.effect("positions streamed tokens across CR, LF and CRLF", () => Effect.gen(function* () {
    const tokens = yield* Stream.runCollect(YamlTokens.stream("a\rb\r\nc\nd"));
    assert.deepStrictEqual(tokens.filter((t) => t.kind === "scalar").map((t) => [t.text, t.line, t.character]), [
      ["a", 0, 0], ["b", 1, 0], ["c", 2, 0], ["d", 3, 0],
    ]);
  }));
  it.effect("keeps instance state empty and token operations on the constructor", () => Effect.sync(() => {
    const instance: unknown = Reflect.construct(YamlTokens, []);
    assert.strictEqual(Object.getPrototypeOf(instance), YamlTokens.prototype);
    assert.notProperty(instance, "tokenize");
    assert.notProperty(instance, "stream");
    assert.isFunction(YamlTokens.tokenize);
    assert.isFunction(YamlTokens.stream);
  }));
});
