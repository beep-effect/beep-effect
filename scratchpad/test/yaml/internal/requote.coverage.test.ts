import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { requoteScalarText } from "../../../effected/yaml/internal/requote.ts";

it.effect("rejects escape-producing conservative swaps and unrepresentable single quotes", () => Effect.sync(() => {
  assert.strictEqual(requoteScalarText("'a\\b'", { value: "a\\b", style: "single-quoted", offset: 0, length: 5 }, '"', "conservative"), undefined);
  assert.strictEqual(requoteScalarText("plain", { value: "plain", style: "plain", offset: 0, length: 5 }, "'", "escaping"), undefined);
  assert.strictEqual(requoteScalarText('"a\\nb"', { value: "a\nb", style: "double-quoted", offset: 0, length: 6 }, "'", "conservative"), undefined);
  assert.strictEqual(requoteScalarText('"already"', { value: "already", style: "double-quoted", offset: 0, length: 9 }, '"', "escaping"), undefined);
  for (const value of ["\t", "\n", "\r", "\u0001", "\u007f", "\u0080", "\u009f"]) {
    assert.strictEqual(requoteScalarText('"escaped"', { value, style: "double-quoted", offset: 0, length: 9 }, "'", "escaping"), undefined);
  }
}));
