import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { FrontmatterSource } from "@beep/markdown/FrontmatterSource";
import {
  FrontmatterCapture,
  RawFrontmatterCapture,
  RawNewline,
  scanFrontmatter,
  scanRawFrontmatter,
} from "@beep/markdown/internal/blocks/frontmatter";
import { preprocessLines } from "@beep/markdown/internal/preprocess";
import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const rawValue = (source: string): string | undefined => O.getOrUndefined(scanRawFrontmatter(source))?.value;

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({
  newline: RawNewline,
  opening: S.Literals(["---", "+++", "---json"]),
  value: S.Array(S.Literals(["a", "b", "é", "中", " ", "\0"])).check(S.isMaxLength(30)),
  body: S.String.check(S.isMaxLength(50)),
});
const PaddedSample = S.Struct({
  newline: RawNewline,
  opening: S.Literals(["---", "+++", "---json"]),
  openPad: S.Array(S.Literals([" ", "\t"])).check(S.isMaxLength(4)),
  closePad: S.Array(S.Literals([" ", "\t"])).check(S.isMaxLength(4)),
  value: S.Array(S.Literals(["a", "b", "é", " ", "\t"])).check(S.isMaxLength(20)),
});
describe("frontmatter scanner property floor", () => {
  it.effect("capture models retain formats, raw newlines and exact source boundaries", () =>
    Effect.gen(function* () {
      for (const [opening, close, format] of [
        ["---", "---", "yaml"],
        ["+++", "+++", "toml"],
        ["---json", "---", "json"],
      ] as const) {
        for (const newline of RawNewline.literals) {
          const prefix = `${opening}${newline}first\0${newline}second${newline}${close}`;
          const source = `${prefix}${newline}body`;
          const raw = O.getOrThrow(scanRawFrontmatter(source));
          const processed = scanFrontmatter(preprocessLines(source), source);
          assert.deepStrictEqual(
            raw,
            RawFrontmatterCapture.make({
              format,
              value: `first\0${newline}second${newline}`,
              newline,
              bodyOffset: prefix.length + newline.length,
            })
          );
          assert.deepStrictEqual(
            processed,
            FrontmatterCapture.make({
              format,
              value: `first�${newline}second`,
              lineCount: 4,
              endOffset: prefix.length,
            })
          );
          const decodedRaw = yield* S.decodeEffect(RawFrontmatterCapture)(raw);
          const decodedProcessed = yield* S.decodeUnknownEffect(FrontmatterCapture)(processed);
          const value1 = yield* S.encodeEffect(RawFrontmatterCapture)(decodedRaw);
          assert.deepStrictEqual(value1, raw);
          const value2 = yield* S.encodeEffect(FrontmatterCapture)(decodedProcessed);
          assert.deepStrictEqual(value2, processed);
          assert.strictEqual(rawValue(`${opening}${newline}${close}`), "");
          assert.strictEqual(rawValue(`${opening}${newline}${newline}${close}`), newline);
        }
      }
      assertNone(scanRawFrontmatter("ordinary body"));
      assert.strictEqual(scanFrontmatter(preprocessLines("ordinary body"), "ordinary body"), null);
      assert.isFalse(S.is(FrontmatterCapture)({ format: "xml", value: "", lineCount: 2, endOffset: 7 }));
      assert.isFalse(
        S.is(FrontmatterCapture)({ format: "yaml", value: "", lineCount: Number.POSITIVE_INFINITY, endOffset: 7 })
      );
      assert.isFalse(S.is(RawFrontmatterCapture)({ format: "yaml", value: "", newline: "", bodyOffset: 8 }));
    })
  );
  it.effect.prop(
    "RawNewline decode(encode(x)) is x and decoding never fails",
    [Arbitrary.schema(RawNewline)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(RawNewline)(value);
        const decoded = yield* S.decodeEffect(RawNewline)(encoded);
        assert.strictEqual(decoded, value);
        const value3 = yield* S.encodeEffect(RawNewline)(decoded);
        assert.strictEqual(value3, encoded);
      }),
    runs
  );
  it.effect.prop(
    "raw and preprocessed scanners agree while preserving their own content contracts",
    [Arbitrary.schema(Sample)],
    ([sample]) =>
      Effect.sync(() => {
        const close = sample.opening === "+++" ? "+++" : "---";
        const value = `value: ${A.join(sample.value, "")}`;
        const source = `${sample.opening}${sample.newline}${value}${sample.newline}${close}${sample.newline}body:${sample.body}`;
        const raw = O.getOrThrow(scanRawFrontmatter(source));
        const processed = scanFrontmatter(preprocessLines(source), source);
        assert.strictEqual(raw.format, processed?.format);
        assert.strictEqual(raw.value, `${value}${sample.newline}`);
        assert.strictEqual(processed?.value, Str.replaceAll("\0", "�")(value));
        assert.strictEqual(Str.slice(raw.bodyOffset)(source), `body:${sample.body}`);
        assert.deepStrictEqual(scanFrontmatter(source)(preprocessLines(source)), processed);
        const joined = FrontmatterSource.join(FrontmatterSource.split(source));
        assert.strictEqual(joined, source);
        assert.deepStrictEqual(O.getOrThrow(scanRawFrontmatter(joined)), raw);
        assert.deepStrictEqual(scanFrontmatter(preprocessLines(joined), joined), processed);
        assert.strictEqual(FrontmatterSource.join(FrontmatterSource.split(joined)), joined);
      }),
    runs
  );
  it.effect.prop(
    "padded fences capture identically in both scanners and join back to canonical fences",
    [Arbitrary.schema(PaddedSample)],
    ([sample]) =>
      Effect.sync(() => {
        const close = sample.opening === "+++" ? "+++" : "---";
        const value = `value: ${A.join(sample.value, "")}`;
        const openPad = A.join(sample.openPad, "");
        const closePad = A.join(sample.closePad, "");
        const source = `${sample.opening}${openPad}${sample.newline}${value}${sample.newline}${close}${closePad}${sample.newline}body`;
        const raw = O.getOrThrow(scanRawFrontmatter(source));
        const processed = scanFrontmatter(preprocessLines(source), source);
        assert.strictEqual(raw.format, processed?.format);
        assert.strictEqual(raw.value, `${value}${sample.newline}`);
        assert.strictEqual(processed?.lineCount, 3);
        assert.strictEqual(processed?.endOffset, source.length - sample.newline.length - "body".length);
        assert.strictEqual(Str.slice(raw.bodyOffset)(source), "body");
        assert.strictEqual(
          FrontmatterSource.join(FrontmatterSource.split(source)),
          `${sample.opening}${sample.newline}${value}${sample.newline}${close}${sample.newline}body`
        );
      }),
    runs
  );
  it.effect.prop(
    "arbitrary raw scans agree with preprocessing about block presence",
    [Arbitrary.schema(S.String)],
    ([source]) =>
      Effect.sync(() => {
        assert.strictEqual(
          O.isNone(scanRawFrontmatter(source)),
          scanFrontmatter(preprocessLines(source), source) === null
        );
      }),
    runs
  );
});
