import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { preprocessLines, replaceNul, SourceLine } from "../../../effected/markdown/internal/preprocess.ts";
const runs = { arbitrary: fcRuns(100) };
const text = S.Literals(["a", "😀", "\0", "\n", "\r", "\r\n", "\t"]).pipe(S.Array, Arbitrary.schema, Arbitrary.map((parts) => parts.join("")));
const format = (source: string): string => preprocessLines(source).map((line) => line.text).join("\n") + "\n";
describe("preprocessor properties", () => {
  it("validates plain source lines with finite offsets and retains normalized provenance", () => {
    const lines = preprocessLines("a\0\r\nb\rc\n");
    assert.deepStrictEqual(lines, [
      { text: "a\uFFFD", start: 0 },
      { text: "b", start: 4 },
      { text: "c", start: 6 },
    ]);
    for (const line of lines) assert.isTrue(S.is(SourceLine)(line));
    assert.isTrue(S.is(SourceLine)({ text: "", start: 0 }));
    assert.isFalse(S.is(SourceLine)({ text: 1, start: 0 }));
    assert.isFalse(S.is(SourceLine)({ text: "a" }));
    for (const start of [NaN, Infinity, -Infinity]) assert.isFalse(S.is(SourceLine)({ text: "a", start }));
  });
  it.effect.prop("line canonicalization and NUL normalization are idempotent", [text], ([source]) => Effect.sync(() => {
    assert.strictEqual(format(format(source)), format(source));
    assert.strictEqual(replaceNul(replaceNul(source)), replaceNul(source));
  }), runs);
  it.effect.prop("parse(stringify(parse(x))) retains line text and source offsets retain provenance", [text], ([source]) => Effect.sync(() => {
    const lines = preprocessLines(source);
    assert.deepStrictEqual(preprocessLines(format(source)).map((line) => line.text), lines.map((line) => line.text));
    for (const line of lines) assert.strictEqual(line.text, replaceNul(source.slice(line.start, line.start + line.text.length)));
  }), runs);
});
