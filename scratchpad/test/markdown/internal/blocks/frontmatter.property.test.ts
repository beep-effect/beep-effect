import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { RawNewline, scanFrontmatter, scanRawFrontmatter } from "../../../../effected/markdown/internal/blocks/frontmatter.ts";
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
