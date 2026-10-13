import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { unescape } from "../../../effected/glob/internal/unescape.ts";

describe("unescape option branches", () => {
  it.effect("defaults remove bracket and backslash escapes including braces", () => Effect.sync(() => {
    assert.strictEqual(unescape("[*]\\?[{]\\}"), "*?{}");
    assert.strictEqual(unescape()("\\*"), "*");
    assert.strictEqual(unescape("\\/[/][\\]"), "\\/[/][]");
    assert.strictEqual(unescape("\\[*]"), "[*]");
  }));

  it.effect("Windows mode removes bracket escapes and preserves backslash separators", () => Effect.sync(() => {
    assert.strictEqual(unescape("[*]\\?[{]\\}", { windowsPathsNoEscape: true }), "*\\?{\\}");
    assert.strictEqual(unescape({ windowsPathsNoEscape: true })("\\[*]"), "\\*");
    assert.strictEqual(unescape("[/][\\]", { windowsPathsNoEscape: true }), "[/][\\]");
  }));

  it.effect("disabled magical braces retain brace escapes in POSIX mode", () => Effect.sync(() => {
    assert.strictEqual(unescape("[*]\\?[{][}]\\{\\}", { magicalBraces: false }), "*?[{][}]\\{\\}");
    assert.strictEqual(unescape({ magicalBraces: false })("x[*]"), "x*");
    assert.strictEqual(unescape("\\/[/][\\]", { magicalBraces: false }), "\\/[/][]");
  }));

  it.effect("Windows mode with disabled magical braces preserves braces and separators", () => Effect.sync(() => {
    const options = { windowsPathsNoEscape: true, magicalBraces: false };
    assert.strictEqual(unescape("[*]\\?[{][}]\\{\\}", options), "*\\?[{][}]\\{\\}");
    assert.strictEqual(unescape(options)("[/][\\]"), "[/][\\]");
    assert.strictEqual(unescape("", options), "");
  }));
});
