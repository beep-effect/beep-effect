import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  CodeModeDate,
  CodeModeMap,
  CodeModePromise,
  CodeModeRegExp,
  CodeModeSet,
  CodeModeURL,
  CodeModeURLSearchParams,
  isCodeModeValue,
} from "../../codemode/Codemode.values.ts";

describe("CodeMode value schemas", () => {
  it("constructs every runtime wrapper through its static new factory", () => {
    const promise = CodeModePromise.new(Effect.runFork(Effect.succeed("done")));
    const date = CodeModeDate.new(Number.NaN);
    const regexp = CodeModeRegExp.new("value", "g");
    const map = CodeModeMap.new();
    const set = CodeModeSet.new();
    const url = CodeModeURL.new(new URL("https://example.com/?value=1"));
    const searchParams = CodeModeURLSearchParams.new(new URLSearchParams("value=1"));

    assert.isTrue(CodeModePromise.is(promise));
    assert.isTrue(CodeModeDate.is(date));
    assert.isTrue(CodeModeRegExp.is(regexp));
    assert.isTrue(CodeModeMap.is(map));
    assert.isTrue(CodeModeSet.is(set));
    assert.isTrue(CodeModeURL.is(url));
    assert.isTrue(CodeModeURLSearchParams.is(searchParams));
    assert.isFalse(CodeModeDate.is({ time: Number.NaN }));

    assert.isFalse(isCodeModeValue(promise));
    assert.isTrue(isCodeModeValue(date));
    assert.isTrue(isCodeModeValue(regexp));
    assert.isTrue(isCodeModeValue(map));
    assert.isTrue(isCodeModeValue(set));
    assert.isTrue(isCodeModeValue(url));
    assert.isTrue(isCodeModeValue(searchParams));

    date.time = 1;
    assert.strictEqual(date.time, 1);
    assert.strictEqual(url.searchParams.params, url.url.searchParams);
  });
});
