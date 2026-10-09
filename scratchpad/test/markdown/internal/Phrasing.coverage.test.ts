import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { parsePhrasingText } from "../../../effected/markdown/internal/phrasing.ts";
it.effect("trims blank phrasing and retains exact original offsets through CRLF and NUL preprocessing", () => Effect.sync(() => {
  assert.deepStrictEqual(parsePhrasingText("", "gfm"), []);
  assert.deepStrictEqual(parsePhrasingText("gfm")(" \t\r\n "), []);
  const [text] = parsePhrasingText(" \r\n  a\0\r\nb  ", "gfm");
  if (text?.type !== "text") assert.fail("expected text");
  assert.strictEqual(text.value, "a�\nb");
  assert.strictEqual(text.position.start.offset, 5);
  assert.strictEqual(text.position.start.line, 2);
  assert.strictEqual(text.position.start.column, 3);
  assert.strictEqual(text.position.end.offset, 10);
  assert.strictEqual(text.position.end.line, 3);
  assert.strictEqual(text.position.end.column, 2);
}));
