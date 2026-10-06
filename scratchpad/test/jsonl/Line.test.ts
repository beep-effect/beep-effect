// Adapted from upstream Line.test.ts and LineProperty.test.ts (MIT).
import { Line, LineSlice, MalformedLine, ParsedLine } from "@beep/scratchpad/effected/jsonl/index";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSome, assertSuccess } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const first = (text: string) => O.getOrThrow(A.head(Line.split(text)));
const json = S.decodeResult(S.fromJsonString(S.Unknown));
const textArb = Arbitrary.schema(
  S.Array(S.Int.check(S.isBetween({ minimum: 0, maximum: 0xffff }))).check(S.isMaxLength(150)),
).pipe(Arbitrary.map((units) => String.fromCharCode(...units)));
const payload = S.Literals([
  '{"n":1}',
  '{"note":"line1\\nline2"}',
  '{"emoji":"😀","snow":"☃"}',
  "null",
  "42",
  '"text"',
  "[1,2]",
]);
const objectPayload = S.Literals(['{"n":1}', '{"emoji":"😀"}', '{"note":"x\\ny"}', "{}"]);
const journal = Arbitrary.schema(
  S.Tuple([
    S.Array(S.Tuple([S.Union([payload, S.Literals(["{", "bad", " ", ""])]), S.Literals(["\n", "\r\n"])])).check(
      S.isMaxLength(12),
    ),
    S.Literals(["", "{", "4"]),
  ]),
).pipe(
  Arbitrary.map(
    ([lines, tail]) =>
      A.join(
        A.map(lines, ([value, end]) => value + end),
        "",
      ) + tail,
  ),
);
const anyText = Arbitrary.schema(S.Boolean).pipe(Arbitrary.flatMap((pick) => (pick ? textArb : journal)));

describe("Line boundaries", () => {
  it.each([
    ["", 0],
    ["abc", 3],
    ["☃", 3],
    ["😀", 4],
    ["\ud800", 3],
    ["\udfff", 3],
  ])("counts UTF-8 bytes for %j", (text, expected) => {
    assert.strictEqual(Line.byteLength(text), expected);
    assert.strictEqual(Line.byteLength(text), encoder.encode(text).length);
  });
  it.each(["x\n", "x\r\n", "\n", "x", "a\rb\n", "😀\n☃\n", "x\n\ny\n"])("tiles slices for %j", (text) => {
    let end = 0;
    for (const slice of Line.split(text)) {
      assert.instanceOf(slice, LineSlice);
      assert.strictEqual(slice.offset, end);
      assert.strictEqual(
        decoder.decode(encoder.encode(text).subarray(slice.offset, slice.offset + slice.length)),
        slice.text,
      );
      end = slice.end;
    }
    assert.strictEqual(end, encoder.encode(text).length);
  });
  it("does not synthesize a trailing line or split escaped newlines", () => {
    assert.deepStrictEqual(Line.split(""), []);
    assert.strictEqual(A.length(Line.split('{"note":"x\\ny"}\n')), 1);
    assert.strictEqual(A.length(Line.split("\n")), 1);
    assert.strictEqual(first("x\r\n").text, "x");
    assert.strictEqual(first("a\rb\n").text, "a\rb");
  });
  it.each([
    ["", 0],
    ["x\n", 2],
    ["x\n{", 2],
    ["x\n42", 2],
    ["😀\r\n{", 6],
  ])("leaves incomplete bytes unconsumed in %j", (text, expected) => {
    assert.strictEqual(Line.consumedOffset(text), expected);
  });
  it.each([
    ['{"a":1}', { a: 1 }],
    ["5", 5],
    ['"text"', "text"],
    ["null", null],
    ["true", true],
    ["[1,2]", [1, 2]],
  ])("parses %j", (text, value) => {
    const line = first(text);
    assertSuccess(Line.parseResult(line), ParsedLine.make({ line, value }));
  });
  it.each(["{", "\n", "nope", '{"a":'])("reports typed malformed input %j", (text) => {
    const line = first(text);
    assertFailure(Line.parseResult(line), MalformedLine.make({ line }));
  });
  it("reports interior corruption with byte offsets and skips blanks", () => {
    const rows = Line.parseAll("42\n\n \nnot json\ntrue\n{");
    assert.strictEqual(rows.length, 4);
    const [one, bad, three, tail] = rows;
    assert.isDefined(one);
    assert.isDefined(bad);
    assert.isDefined(three);
    assert.isDefined(tail);
    assertSuccess(
      Result.map(one, (parsed) => parsed.value),
      42,
    );
    const badLine = LineSlice.make({ offset: 6, end: 15, length: 8, text: "not json", terminated: true });
    assertFailure(bad, MalformedLine.make({ line: badLine }));
    assertSuccess(
      Result.map(three, (parsed) => parsed.value),
      true,
    );
    assertFailure(
      Result.mapError(tail, (error) => error.line.terminated),
      false,
    );
  });
  it.each(["", "broken\n{\n", "  \n"])("has no valid tail for %j", (text) => assertNone(Line.lastValid(text)));
  it.each([
    ['{"n":1}\n{"n":2}\n', { n: 2 }],
    ['{"n":1}\n{"n":2}\n{', { n: 2 }],
    ['{"n":1}\nbroken\n{', { n: 1 }],
    ['{"n":1}\n \n', { n: 1 }],
    ['{"n":1}\n4', 4],
    ['{"n":1}\n{"n":2}', { n: 2 }],
  ])("walks back from %j", (text, expected) =>
    assertSome(
      O.map(Line.lastValid(text), (row) => row.value),
      expected,
    ),
  );
  it("walks back from every strict object prefix", () => {
    const tail = '{"event":"unlinked","data":null}';
    for (const keep of A.range(1, tail.length - 1)) {
      assertSome(
        O.map(Line.lastValid(`42\n${Str.slice(0, keep)(tail)}`), (row) => row.value),
        42,
      );
    }
  });
  it("parses deep input without traversing unknown payloads", () => {
    const text = Str.repeat(20000)("[") + "1" + Str.repeat(20000)("]");
    assertSuccess(
      Result.map(Line.parseResult(first(text)), (row) => row.line.length),
      text.length,
    );
  });
});

describe("Line properties", () => {
  it.prop("byteLength agrees with TextEncoder including lone surrogates", [textArb], ([text]) => {
    assert.strictEqual(Line.byteLength(text), encoder.encode(text).length);
  });
  it.prop("slices address their encoded text and tile all source bytes", [anyText], ([text]) => {
    const bytes = encoder.encode(text);
    let end = 0;
    for (const line of Line.split(text)) {
      assert.strictEqual(line.offset, end);
      assert.strictEqual(
        decoder.decode(bytes.subarray(line.offset, line.offset + line.length)),
        decoder.decode(encoder.encode(line.text)),
      );
      end = line.end;
    }
    assert.strictEqual(end, bytes.length);
  });
  it.prop("reports every nonblank line and leaves the unterminated tail unconsumed", [anyText], ([text]) => {
    const lines = Line.split(text);
    assert.strictEqual(Line.parseAll(text).length, A.filter(lines, (line) => !Str.isEmpty(Str.trim(line.text))).length);
    const expected = O.map(A.last(lines), (line) => (line.terminated ? line.end : line.offset));
    assert.strictEqual(
      Line.consumedOffset(text),
      O.getOrElse(expected, () => 0),
    );
  });
  it.prop("lastValid is exactly the last successful parse", [anyText], ([text]) => {
    const successes = A.filterMap(Line.parseAll(text), (result) => result);
    A.match(successes, {
      onEmpty: () => assertNone(Line.lastValid(text)),
      onNonEmpty: (rows) => assertSome(Line.lastValid(text), A.lastNonEmpty(rows)),
    });
  });
  it.prop("a complete appended line becomes the last valid line", [anyText, payload], ([prefix, text]) => {
    assertSome(
      O.map(Line.lastValid(`${prefix}\n${text}\n`), (row) => row.value),
      Result.getOrThrow(json(text)),
    );
  });
  it.prop(
    "truncating the final object recovers the previous object",
    [S.Array(objectPayload).check(S.isBetweenLength(2, 8)), S.Int.check(S.isBetween({ minimum: 0, maximum: 100000 }))],
    ([rows, cut]) => {
      const tail = O.getOrThrow(A.last(rows));
      const body = A.join(A.dropRight(rows, 1), "\n") + "\n";
      const text = body + Str.slice(0, 1 + (cut % (tail.length - 1)))(tail);
      const previous = O.getOrThrow(A.get(rows, rows.length - 2));
      assertSome(
        O.map(Line.lastValid(text), (row) => row.value),
        Result.getOrThrow(json(previous)),
      );
    },
  );
  it.prop("all pure read surfaces are total", [anyText], ([text]) => {
    assert.doesNotThrow(() => {
      Line.split(text);
      Line.parseAll(text);
      Line.lastValid(text);
      Line.consumedOffset(text);
    });
  });
});
