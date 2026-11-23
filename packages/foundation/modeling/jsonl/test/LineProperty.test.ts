// Ported from upstream jsonl/__test__/LineProperty.test.ts (MIT).
import { fcRuns } from "@beep/fc-runs";
import { Line } from "@beep/jsonl";
import { assert, describe, it } from "@effect/vitest";
import { assertDefined, assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// decision: tests-prop-array-form
const minimum100RunsRaisedByEnvironment = { arbitrary: fcRuns(100) };
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const byteLength = (text: string): number => encoder.encode(text).length;
const lossyUtf8RoundTrip = (text: string): string => decoder.decode(encoder.encode(text));
const UnknownJson = S.fromJsonString(S.Unknown);
const decodeJson = S.decodeResult(UnknownJson);
const encodeJson = S.encodeResult(UnknownJson);
const parseJson = (text: string): unknown => Result.getOrThrow(decodeJson(text));
const stringifyJson = (value: unknown): string => Result.getOrThrow(encodeJson(value));

const naiveSplitterBreakingPayload = S.Literals([
  '{"at":"2026-08-03T00:00:00Z","event":"mail-received","data":{}}',
  '{"note":"line1\\nline2"}',
  '{"emoji":"\u{1F600}","snow":"☃"}',
  "null",
  "42",
  '"a bare string"',
  "[1,2,3]",
  "{}",
]);

const prefixUnparseableObjectPayload = S.Literals([
  '{"at":"2026-08-03T00:00:00Z","event":"mail-received","data":{}}',
  '{"note":"line1\\nline2"}',
  '{"emoji":"\u{1F600}","snow":"☃"}',
  "{}",
]);

const brokenLine = S.Literals(['{"a":', "not json at all", "{", "}", '{"unterminated":"str']);

const terminator = S.Literals(["\n", "\r\n"]);

const anyLine = S.Union([naiveSplitterBreakingPayload, brokenLine]);

const journal = Arbitrary.schema(
  S.Tuple([S.Array(S.Tuple([anyLine, terminator])).check(S.isMaxLength(12)), S.UndefinedOr(anyLine)])
).pipe(
  Arbitrary.map(([lines, tail]) => {
    const body = A.join(
      A.map(lines, ([text, end]) => `${text}${end}`),
      ""
    );
    return tail === undefined ? body : `${body}${tail}`;
  })
);

const loneSurrogateCodeUnitText = S.Int.check(S.isBetween({ minimum: 0, maximum: 0xffff })).pipe(
  S.Array,
  Arbitrary.schema,
  Arbitrary.map((units) => String.fromCharCode(...units))
);

const scalarValueText = S.Int.check(
  S.isBetween({ minimum: 0, maximum: 0x10ffff }),
  S.makeFilter((codePoint) => codePoint < 0xd800 || codePoint > 0xdfff)
).pipe(
  S.Array,
  Arbitrary.schema,
  Arbitrary.map((codePoints) => String.fromCodePoint(...codePoints))
);

const oneOfArbitraries = <A>(
  first: Arbitrary.Arbitrary<A>,
  ...rest: ReadonlyArray<Arbitrary.Arbitrary<A>>
): Arbitrary.Arbitrary<A> =>
  Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: rest.length }))).pipe(
    Arbitrary.flatMap((index) => (index === 0 ? first : (rest[index - 1] ?? first)))
  );

const anyText = oneOfArbitraries<string>(
  journal,
  Arbitrary.schema(S.String),
  loneSurrogateCodeUnitText,
  scalarValueText,
  Arbitrary.schema(S.Literals(["", "\n", "\r\n", "\n\n", "   ", "\ud800", "\ud800\n"]))
);

const cutPosition = S.Int.check(S.isBetween({ minimum: 0, maximum: 0x7fffffff }));

describe("Line properties", () => {
  it.effect.prop(
    "byteLength agrees with TextEncoder for any string",
    [loneSurrogateCodeUnitText],
    ([text]) =>
      Effect.sync(() => {
        assert.strictEqual(Line.byteLength(text), byteLength(text));
      }),
    minimum100RunsRaisedByEnvironment
  );

  it.effect.prop(
    "every slice's byte offsets address its own text in the source",
    [anyText],
    ([text]) =>
      Effect.sync(() => {
        const source = encoder.encode(text);
        for (const line of Line.split(text)) {
          const decoded = decoder.decode(source.slice(line.offset, line.offset + line.length));
          assert.strictEqual(
            decoded,
            lossyUtf8RoundTrip(line.text),
            `offset ${line.offset} of ${stringifyJson(text)}: the oracle is the UTF-8 round trip, since a lone surrogate encodes to U+FFFD`
          );
        }
      }),
    minimum100RunsRaisedByEnvironment
  );

  it.effect.prop(
    "slices tile the source: each end is the next offset, the last is the length",
    [anyText],
    ([text]) =>
      Effect.sync(() => {
        const lines = Line.split(text);
        if (lines.length === 0) {
          assert.strictEqual(byteLength(text), 0);
          return;
        }
        assert.strictEqual(lines[0]?.offset, 0);
        for (let i = 0; i < lines.length - 1; i++) {
          assert.strictEqual(lines[i]?.end, lines[i + 1]?.offset, "no gap and no overlap between lines");
        }
        assert.strictEqual(lines.at(-1)?.end, byteLength(text), "the last line ends at the end of the source");
      }),
    minimum100RunsRaisedByEnvironment
  );

  it.effect.prop(
    "no non-blank line is ever silently dropped",
    [anyText],
    ([text]) =>
      Effect.sync(() => {
        const nonBlank = A.filter(Line.split(text), (line) => Str.trim(line.text) !== "");
        assert.strictEqual(Line.parseAll(text).length, nonBlank.length);
      }),
    minimum100RunsRaisedByEnvironment
  );

  it.effect.prop(
    "consumedOffset never consumes an unterminated tail's bytes",
    [anyText],
    ([text]) =>
      Effect.sync(() => {
        const lines = Line.split(text);
        const consumed = Line.consumedOffset(text);
        assert.isAtLeast(consumed, 0);
        assert.isAtMost(consumed, byteLength(text));
        const last = lines.at(-1);
        if (last !== undefined && !last.terminated) {
          assert.strictEqual(consumed, last.offset, "a torn tail is left for the next read");
        } else {
          assert.strictEqual(consumed, byteLength(text));
        }
      }),
    minimum100RunsRaisedByEnvironment
  );

  it.effect.prop(
    "lastValid is exactly the last success of parseAll",
    [anyText],
    ([text]) =>
      Effect.sync(() => {
        const successes = A.filter(Line.parseAll(text), Result.isSuccess);
        const last = Line.lastValid(text);
        if (successes.length === 0) {
          assertNone(last);
          return;
        }
        assertSome(
          O.map(last, (row) => row.line.offset),
          successes.at(-1)?.success.line.offset
        );
      }),
    minimum100RunsRaisedByEnvironment
  );

  it.effect.prop(
    "appending a well-formed terminated line supersedes a torn prefix and becomes the last valid line (correction by append)",
    [anyText, naiveSplitterBreakingPayload],
    ([prefix, line]) =>
      Effect.sync(() => {
        const source = `${prefix}${prefix === "" || Str.endsWith("\n")(prefix) ? "" : "\n"}${line}\n`;
        assertSome(
          O.map(Line.lastValid(source), (row) => row.value),
          parseJson(line)
        );
      }),
    minimum100RunsRaisedByEnvironment
  );

  it.effect.prop(
    "truncating a journal of object payloads mid-final-line walks back to the previous line (a torn scalar prefix such as 4 of 42 still parses; the envelope layer owns that hole)",
    [S.Array(prefixUnparseableObjectPayload).check(S.isBetweenLength(2, 8)), cutPosition],
    ([payloads, cut]) =>
      Effect.sync(() => {
        const head = A.join(
          A.map(payloads.slice(0, -1), (p) => `${p}\n`),
          ""
        );
        const tail = payloads.at(-1) ?? "{}";
        const keep = 1 + (cut % (tail.length - 1));
        const torn = `${head}${Str.slice(0, keep)(tail)}`;
        const expected = payloads.at(-2);
        assertDefined(expected);
        assertSome(
          O.map(Line.lastValid(torn), (row) => row.value),
          parseJson(expected)
        );
      }),
    minimum100RunsRaisedByEnvironment
  );

  it.effect.prop(
    "is total: no input throws",
    [anyText],
    ([text]) =>
      Effect.sync(() => {
        assert.doesNotThrow(() => {
          Line.split(text);
          Line.parseAll(text);
          Line.lastValid(text);
          Line.consumedOffset(text);
          Line.byteLength(text);
        });
      }),
    minimum100RunsRaisedByEnvironment
  );
});
