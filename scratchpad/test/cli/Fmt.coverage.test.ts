import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Fmt } from "../../effected/cli/Fmt.ts";

it.effect("non-finite limits and zero-width graphemes keep truncation bounded", () => Effect.sync(() => {
  assert.strictEqual(Fmt.truncate("hello", Infinity), "hello");
  assert.strictEqual(Fmt.truncate("hello", NaN), "");
  assert.strictEqual(Fmt.truncate("hello", -Infinity), "");
  assert.strictEqual(Fmt.truncate("abc", 1, { ellipsis: "" }), "a");
  assert.strictEqual(Fmt.truncate("abc", 1, { ellipsis: "\u0301" }), "a\u0301");
  assert.strictEqual(Fmt.truncate("abc", 1, { ellipsis: "界" }), "a");
}));
