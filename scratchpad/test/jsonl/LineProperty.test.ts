// Restored from upstream jsonl/__test__/LineProperty.test.ts (MIT).
import { assert, describe, it } from "@effect/vitest";
import { assertDefined, assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { Line } from "../../effected/jsonl/index.ts";

// Array form ONLY: the named-record form of it.effect.prop silently discards
// Schema conversion (see packages/glob/__test__/compliance.test.ts).

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const byteLength = (text: string): number => encoder.encode(text).length;
/** What a string becomes after a UTF-8 write/read cycle — lossy for lone surrogates. */
const utf8RoundTrip = (text: string): string => decoder.decode(encoder.encode(text));
// Rule-forced (effect(preferSchemaOverJson)): the upstream JSON.parse and
// JSON.stringify calls go through the Schema JSON codec instead.
const UnknownJson = S.fromJsonString(S.Unknown);
const decodeJson = S.decodeResult(UnknownJson);
const encodeJson = S.encodeResult(UnknownJson);
const parseJson = (text: string): unknown => Result.getOrThrow(decodeJson(text));
const stringifyJson = (value: unknown): string => Result.getOrThrow(encodeJson(value));

/**
 * The payload shapes a real journal produces. Deliberately includes values that
 * are valid JSON but NOT envelopes, and strings carrying embedded newlines and
 * multi-byte characters, because those are what break a naive splitter.
 */
const payload = S.Literals([
  '{"at":"2026-08-03T00:00:00Z","event":"mail-received","data":{}}',
  '{"note":"line1\\nline2"}',
  '{"emoji":"\u{1F600}","snow":"☃"}',
  "null",
  "42",
  '"a bare string"',
  "[1,2,3]",
  "{}",
]);

/**
 * Object payloads only. Every strict prefix of a JSON object text fails to
 * parse, which is what makes a mid-line truncation detectable at this layer.
 */
const objectPayload = S.Literals([
  '{"at":"2026-08-03T00:00:00Z","event":"mail-received","data":{}}',
  '{"note":"line1\\nline2"}',
  '{"emoji":"\u{1F600}","snow":"☃"}',
  "{}",
]);

/** Lines that do not parse — the holes and the torn writes. */
const brokenLine = S.Literals(['{"a":', "not json at all", "{", "}", '{"unterminated":"str']);

const terminator = S.Literals(["\n", "\r\n"]);

/** A line as written: valid or broken, in equal measure. */
const anyLine = S.Union([payload, brokenLine]);

/** A whole journal file: valid and broken lines, mixed terminators, torn tail or not. */
const journal = Arbitrary.schema(
  S.Tuple([S.Array(S.Tuple([anyLine, terminator])).check(S.isMaxLength(12)), S.UndefinedOr(anyLine)])
).pipe(
  Arbitrary.map(([lines, tail]) => {
    const body = lines.map(([text, end]) => `${text}${end}`).join("");
    return tail === undefined ? body : `${body}${tail}`;
  })
);

/**
 * Arbitrary UTF-16 code units — unpaired surrogates included — which is the
 * case a hand-rolled byte counter gets wrong. Built from the code-unit domain
 * directly: a Schema string only ever generates well-formed text plus a
 * handful of edge cases, so the lone-surrogate space needs its own generator.
 */
const codeUnitText = S.Int.check(S.isBetween({ minimum: 0, maximum: 0xffff })).pipe(
  S.Array,
  Arbitrary.schema,
  Arbitrary.map((units) => String.fromCharCode(...units))
);

/**
 * Arbitrary Unicode scalar values, astral code points included — every UTF-8
 * width from one byte to four, with no lone surrogates.
 */
const codePointText = S.Int.check(
  S.isBetween({ minimum: 0, maximum: 0x10ffff }),
  S.makeFilter((codePoint) => codePoint < 0xd800 || codePoint > 0xdfff)
).pipe(
  S.Array,
  Arbitrary.schema,
  Arbitrary.map((codePoints) => String.fromCodePoint(...codePoints))
);

/** A uniform choice between arbitraries — the native module only unions Schemas. */
const oneOf = <A>(
  first: Arbitrary.Arbitrary<A>,
  ...rest: ReadonlyArray<Arbitrary.Arbitrary<A>>
): Arbitrary.Arbitrary<A> =>
  Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: rest.length }))).pipe(
    Arbitrary.flatMap((index) => (index === 0 ? first : (rest[index - 1] ?? first)))
  );

/** Arbitrary text, including text that is nothing like a journal. */
const anyText = oneOf<string>(
  journal,
  Arbitrary.schema(S.String),
  codeUnitText,
  codePointText,
  Arbitrary.schema(S.Literals(["", "\n", "\r\n", "\n\n", "   ", "\ud800", "\ud800\n"]))
);

/** Any non-negative 32-bit integer — the cut position, taken modulo the tail length. */
const nat = S.Int.check(S.isBetween({ minimum: 0, maximum: 0x7fffffff }));

describe("Line properties", () => {
  it.effect.prop("byteLength agrees with TextEncoder for any string", [codeUnitText], ([text]) =>
    Effect.sync(() => {
      assert.strictEqual(Line.byteLength(text), byteLength(text));
    })
  );

  it.effect.prop("every slice's byte offsets address its own text in the source", [anyText], ([text]) =>
    Effect.sync(() => {
      const source = encoder.encode(text);
      for (const line of Line.split(text)) {
        const decoded = decoder.decode(source.slice(line.offset, line.offset + line.length));
        // Compared against the UTF-8 round trip, not the raw text: an unpaired
        // surrogate encodes to U+FFFD and cannot come back, so `text` itself is
        // the wrong oracle for exactly the inputs this property exists to cover.
        assert.strictEqual(decoded, utf8RoundTrip(line.text), `offset ${line.offset} of ${stringifyJson(text)}`);
      }
    })
  );

  it.effect.prop("slices tile the source: each end is the next offset, the last is the length", [anyText], ([text]) =>
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
    })
  );

  it.effect.prop("no non-blank line is ever silently dropped", [anyText], ([text]) =>
    Effect.sync(() => {
      const nonBlank = Line.split(text).filter((line) => line.text.trim() !== "");
      assert.strictEqual(Line.parseAll(text).length, nonBlank.length);
    })
  );

  it.effect.prop("consumedOffset never consumes an unterminated tail's bytes", [anyText], ([text]) =>
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
    })
  );

  it.effect.prop("lastValid is exactly the last success of parseAll", [anyText], ([text]) =>
    Effect.sync(() => {
      const successes = Line.parseAll(text).filter(Result.isSuccess);
      const last = Line.lastValid(text);
      if (successes.length === 0) {
        assertNone(last);
        return;
      }
      assertSome(O.map(last, (row) => row.line.offset), successes.at(-1)?.success.line.offset);
    })
  );

  it.effect.prop(
    "appending a well-formed terminated line makes it the last valid line",
    [anyText, payload],
    ([prefix, line]) =>
      Effect.sync(() => {
        // A torn prefix is superseded by the next complete append, exactly as
        // the dogfood journal's correction-by-append rule requires.
        const source = `${prefix}${prefix === "" || prefix.endsWith("\n") ? "" : "\n"}${line}\n`;
        assertSome(O.map(Line.lastValid(source), (row) => row.value), parseJson(line));
      })
  );

  it.effect.prop(
    "truncating a journal mid-final-line walks back to the previous line",
    [S.Array(objectPayload).check(S.isBetweenLength(2, 8)), nat],
    ([payloads, cut]) =>
      Effect.sync(() => {
        // OBJECT payloads only, and the reason is a real property of JSONL: every
        // strict prefix of a JSON object text is unparseable, but a strict prefix
        // of a SCALAR is not — truncating `42` yields `4`, which parses fine as a
        // different value. See the "torn scalar" test in Line.test.ts; closing
        // that hole is the envelope layer's job, not this one's.
        const head = payloads
          .slice(0, -1)
          .map((p) => `${p}\n`)
          .join("");
        const tail = payloads.at(-1) ?? "{}";
        const keep = 1 + (cut % (tail.length - 1));
        const torn = `${head}${tail.slice(0, keep)}`;
        const expected = payloads.at(-2);
        assertDefined(expected);
        assertSome(O.map(Line.lastValid(torn), (row) => row.value), parseJson(expected));
      })
  );

  it.effect.prop("is total: no input throws", [anyText], ([text]) =>
    Effect.sync(() => {
      assert.doesNotThrow(() => {
        Line.split(text);
        Line.parseAll(text);
        Line.lastValid(text);
        Line.consumedOffset(text);
        Line.byteLength(text);
      });
    })
  );
});
