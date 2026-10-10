import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import { splitFrame } from "../../../effected/cli/internal/splitFrame.ts";
const words = S.Literals(["a", "b", "/", ":", "1", "(", ")"]).pipe(S.Array, Arbitrary.schema, Arbitrary.map(A.join("")));
it.effect.prop("splitFrame: frame formatting is idempotent and parse/stringify preserves function and nested location", [words, words], ([fn, location]) => Effect.sync(() => {
  const canonical = `fn${fn} (${location})`;
  const parsed = splitFrame(`  at ${canonical}  `);
  assert.strictEqual(parsed.fn, `fn${fn}`);
  assert.strictEqual(parsed.location, location);
  assert.deepStrictEqual(splitFrame(parsed.text), parsed);
  assert.deepStrictEqual(splitFrame(`at ${parsed.fn} (${parsed.location})`), parsed);
}), runs);
it.effect.prop("splitFrame agrees with its regular expression grammar on mixed terminators and nested parentheses", [Arbitrary.schema(S.String)], ([raw]) => Effect.sync(() => {
  const text = raw.trim().replace(/^at\s+/, "");
  const wrapped = /^(.*?)\s+\((.*)\)$/.exec(text);
  const fn = wrapped?.[1];
  const expected = { text, ...(fn === undefined || fn === "" ? {} : { fn }), location: wrapped === null ? text : (wrapped[2] ?? "") };
  assert.deepStrictEqual(splitFrame(raw), expected);
}), runs);
