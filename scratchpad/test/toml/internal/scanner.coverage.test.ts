import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { classifyValueToken, scanMultilineBasicString, scanMultilineLiteralString } from "../../../effected/toml/internal/scanner.ts";

it.effect("multiline scanning preserves short quote runs and reports unfinished trimming", () => Effect.sync(() => {
  const literal = "'''a'b''c'''";
  assert.deepStrictEqual(scanMultilineLiteralString(literal, 0), { value: "a'b''c", end: literal.length });
  const crlf = "'''a\r\nb'''";
  assert.deepStrictEqual(scanMultilineLiteralString(crlf, 0), { value: "a\r\nb", end: crlf.length });
  assert.throws(() => scanMultilineBasicString('"""a\\  ', 0), /unterminated multiline basic string/);
  assert.throws(() => scanMultilineBasicString('"""a\\\n \r', 0), /carriage return not followed by a line feed/);
  assert.throws(() => scanMultilineLiteralString("'''a\r", 0), /carriage return not followed by a line feed/);
}));

it.effect("Gregorian month boundaries preserve all twelve lengths and century leap rules", () => Effect.sync(() => {
  const months = [[1, 31], [2, 28], [3, 31], [4, 30], [5, 31], [6, 30], [7, 31], [8, 31], [9, 30], [10, 31], [11, 30], [12, 31]] as const;
  for (const [month, days] of months) {
    const prefix = `2023-${String(month).padStart(2, "0")}-`;
    const lastDay = `${prefix}${days}`;
    assert.strictEqual(classifyValueToken(lastDay, 0).toString(), lastDay);
    assert.throws(() => classifyValueToken(`${prefix}${days + 1}`, 0), /does not exist in month/);
  }
  for (const year of [2000, 2024, 2400]) {
    const leapDay = `${year}-02-29`;
    assert.strictEqual(classifyValueToken(leapDay, 0).toString(), leapDay);
  }
  for (const year of [1900, 2100, 2200]) {
    assert.throws(() => classifyValueToken(`${year}-02-29`, 0), /does not exist in month/);
  }
}));
