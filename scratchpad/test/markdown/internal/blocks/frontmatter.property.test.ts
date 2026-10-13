import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { FrontmatterCapture, RawFrontmatterCapture, RawNewline, scanFrontmatter, scanRawFrontmatter } from "../../../../effected/markdown/internal/blocks/frontmatter.ts";
import { preprocessLines } from "../../../../effected/markdown/internal/preprocess.ts";
import { FrontmatterSource } from "../../../../effected/markdown/FrontmatterSource.ts";
const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({
  newline: RawNewline,
  opening: S.Literals(["---", "+++", "---json"]),
  value: S.Array(S.Literals(["a", "b", "é", "中", " ", "\0"])).check(S.isMaxLength(30)),
  body: S.String.check(S.isMaxLength(50)),
});
describe("frontmatter scanner property floor", () => {
 it.effect("capture models retain formats, raw newlines and exact source boundaries", () => Effect.gen(function* () {
  for (const [opening, close, format] of [["---", "---", "yaml"], ["+++", "+++", "toml"], ["---json", "---", "json"]] as const) {
   for (const newline of RawNewline.literals) {
    const prefix = `${opening}${newline}first\0${newline}second${newline}${close}`;
    const source = `${prefix}${newline}body`;
    const raw = scanRawFrontmatter(source);
    const processed = scanFrontmatter(preprocessLines(source), source);
    assert.deepStrictEqual(raw, { format, value: `first\0${newline}second${newline}`, newline, bodyOffset: prefix.length + newline.length });
    assert.deepStrictEqual(processed, { format, value: `first�${newline}second`, lineCount: 4, endOffset: prefix.length });
    const decodedRaw = yield* S.decodeUnknownEffect(RawFrontmatterCapture)(raw);
    const decodedProcessed = yield* S.decodeUnknownEffect(FrontmatterCapture)(processed);
    assert.deepStrictEqual(yield* S.encodeEffect(RawFrontmatterCapture)(decodedRaw), raw);
    assert.deepStrictEqual(yield* S.encodeEffect(FrontmatterCapture)(decodedProcessed), processed);
    assert.strictEqual(scanRawFrontmatter(`${opening}${newline}${close}`)?.value, "");
    assert.strictEqual(scanRawFrontmatter(`${opening}${newline}${newline}${close}`)?.value, newline);
   }
  }
  assert.strictEqual(scanRawFrontmatter("ordinary body"), null);
  assert.strictEqual(scanFrontmatter(preprocessLines("ordinary body"), "ordinary body"), null);
  assert.isFalse(S.is(FrontmatterCapture)({ format: "xml", value: "", lineCount: 2, endOffset: 7 }));
  assert.isFalse(S.is(FrontmatterCapture)({ format: "yaml", value: "", lineCount: Infinity, endOffset: 7 }));
  assert.isFalse(S.is(RawFrontmatterCapture)({ format: "yaml", value: "", newline: "", bodyOffset: 8 }));
 }));
 it.effect.prop("RawNewline decode(encode(x)) is x and decoding never fails", [Arbitrary.schema(RawNewline)], ([value]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(RawNewline)(value);
  const decoded = yield* S.decodeEffect(RawNewline)(encoded);
  assert.strictEqual(decoded, value);
  assert.strictEqual(yield* S.encodeEffect(RawNewline)(decoded), encoded);
 }), runs);
 it.effect.prop("raw and preprocessed scanners agree while preserving their own content contracts", [Arbitrary.schema(Sample)], ([sample]) => Effect.sync(() => {
  const close = sample.opening === "+++" ? "+++" : "---";
  const value = `value: ${sample.value.join("")}`;
  const source = `${sample.opening}${sample.newline}${value}${sample.newline}${close}${sample.newline}body:${sample.body}`;
  const raw = scanRawFrontmatter(source);
  const processed = scanFrontmatter(preprocessLines(source), source);
  assert.strictEqual(raw?.format, processed?.format);
  assert.strictEqual(raw?.value, `${value}${sample.newline}`);
  assert.strictEqual(processed?.value, value.replaceAll("\0", "�"));
  assert.strictEqual(source.slice(raw?.bodyOffset), `body:${sample.body}`);
  assert.deepStrictEqual(scanFrontmatter(source)(preprocessLines(source)), processed);
  const joined = FrontmatterSource.join(FrontmatterSource.split(source));
  assert.strictEqual(joined, source);
  assert.deepStrictEqual(scanRawFrontmatter(joined), raw);
  assert.deepStrictEqual(scanFrontmatter(preprocessLines(joined), joined), processed);
  assert.strictEqual(FrontmatterSource.join(FrontmatterSource.split(joined)), joined);
 }), runs);
 it.effect.prop("arbitrary raw scans agree with preprocessing about block presence", [Arbitrary.schema(S.String)], ([source]) => Effect.sync(() => {
  assert.strictEqual(scanRawFrontmatter(source) === null, scanFrontmatter(preprocessLines(source), source) === null);
 }), runs);
});
