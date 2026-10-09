import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Fmt, sanitize } from "../../effected/cli/Fmt.ts";

const runs = { arbitrary: fcRuns(100) };
const limit = S.Int.check(S.isBetween({ minimum: 0, maximum: 100 }));
const safeText = S.Array(S.Literals(["a", "b", " ", "界", "👨‍👩‍👧", "é"])).pipe(Arbitrary.schema, Arbitrary.map(A.join("")));

it.effect.prop("sanitize is idempotent, preserves printable text and removes injected terminal controls", [safeText], ([text]) => Effect.sync(() => {
  const result = sanitize(`\u001b[31m${text}\u001b[0m\t\u0007`);
  assert.strictEqual(result, `${text} `);
  assert.strictEqual(sanitize(result), result);
  assert.strictEqual(Fmt.sanitize(text), text);
  assert.strictEqual(Fmt.width(`\u001b[31m${text}\u001b[0m`), Fmt.width(text));
}), runs);

it.effect.prop("sanitize arbitrary input is stable under another normalization", [Arbitrary.schema(S.String)], ([text]) => Effect.sync(() => {
  const once = Fmt.sanitize(text);
  assert.strictEqual(Fmt.sanitize(once), once);
  assert.notInclude(once, "\u001b");
  assert.notInclude(once, "\t");
}), runs);

it.effect.prop("truncate is idempotent, fits the budget and preserves text that fits", [safeText, Arbitrary.schema(limit)], ([text, width]) => Effect.sync(() => {
  const formatted = Fmt.truncate(text, width);
  assert.strictEqual(Fmt.truncate(formatted, width), formatted);
  assert.isAtMost(Fmt.width(formatted), width);
  if (Fmt.width(text) <= width && width > 0) assert.strictEqual(formatted, text);
}), runs);

// Numeric formatters accept numbers, so normalization means formatting after
// reading the numeric value from their display grammar, rather than passing a
// string to a number-only API.
const durationValue = (text: string): number => {
  const total = A.reduce(Str.split(text, " "), 0, (sum, part) => {
    const number = Number.parseFloat(part);
    const factor = Str.endsWith("ms")(part) ? 1 : Str.endsWith("s")(part) ? 1000 : Str.endsWith("m")(part) ? 60000 : 3600000;
    return sum + number * factor;
  });
  return total;
};

it.effect.prop("duration display grammar round-trips with stable rounding", [Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: 86400000 })))], ([ms]) => Effect.sync(() => {
  const text = Fmt.duration(ms);
  const parsed = durationValue(text);
  assert.strictEqual(Fmt.duration(parsed), text);
  assert.strictEqual(durationValue(Fmt.duration(parsed)), parsed);
  assert.isAtMost(Math.abs(parsed - ms), ms >= 3600000 ? 60000 : ms >= 60000 ? 1000 : ms >= 1000 ? 100 : 1);
}), runs);

it.effect.prop("percent retains its rounded numeric value across parse and format", [Arbitrary.schema(S.Int.check(S.isBetween({ minimum: -100000, maximum: 100000 }))), Arbitrary.schema(limit)], ([number, digits]) => Effect.sync(() => {
  const options = { scale: 100, digits } as const;
  const text = Fmt.percent(number / 100, options);
  const parsed = Number.parseFloat(text);
  assert.strictEqual(Fmt.percent(parsed, options), text);
  assert.strictEqual(Number.parseFloat(Fmt.percent(parsed, options)), parsed);
  assert.isAtMost(Math.abs(parsed - number / 100), 10 ** -Math.min(10, digits));
}), runs);

it.effect.prop("plural preserves the count and selects the singular only at one", [Arbitrary.schema(S.Int)], ([count]) => Effect.sync(() => {
  const text = Fmt.plural(count, "child", "children");
  const parsed = Number.parseFloat(text);
  assert.strictEqual(parsed, count);
  assert.strictEqual(Fmt.plural(parsed, "child", "children"), text);
  assert.strictEqual(text, `${count} ${count === 1 ? "child" : "children"}`);
}), runs);
