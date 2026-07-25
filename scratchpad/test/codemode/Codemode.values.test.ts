import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
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

    assert.isTrue(S.is(CodeModePromise)(promise));
    assert.isTrue(S.is(CodeModeDate)(date));
    assert.isTrue(S.is(CodeModeRegExp)(regexp));
    assert.isTrue(S.is(CodeModeMap)(map));
    assert.isTrue(S.is(CodeModeSet)(set));
    assert.isTrue(S.is(CodeModeURL)(url));
    assert.isTrue(S.is(CodeModeURLSearchParams)(searchParams));

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
