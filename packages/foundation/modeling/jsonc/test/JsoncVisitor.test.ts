import { Jsonc, JsoncParseOptions, JsoncVisitor, JsoncVisitorEvent } from "@beep/jsonc";
import { assert, describe, it } from "@effect/vitest";
import { assertDefined, assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const collect = (text: string, options?: JsoncParseOptions) => Stream.runCollect(JsoncVisitor.visit(text, options));
const tags = (text: string, options?: JsoncParseOptions) =>
  Effect.map(collect(text, options), (events) => A.map(events, (e) => e._tag));
const errorCodes = (text: string) =>
  Effect.map(collect(text), (events) => A.map(A.filter(events, JsoncVisitorEvent.guards.Error), (e) => e.code));

describe("JsoncVisitor", () => {
  describe("schema", () => {
    it("constructs and decodes finite event spans, rejecting non-finite fields", () => {
      for (const value of [-1, 0.5, -0.5, Number.MAX_SAFE_INTEGER + 1]) {
        const input = { offset: value, length: value };
        assert.deepStrictEqual({ ...JsoncVisitorEvent.cases.Comment.make(input) }, { _tag: "Comment", ...input });
        assertSuccess(
          Result.map(S.decodeResult(JsoncVisitorEvent)({ _tag: "Comment", ...input }), (event) => [
            event.offset,
            event.length,
          ]),
          [value, value]
        );
      }
      for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        for (const field of ["offset", "length"] as const) {
          const input = { offset: 0, length: 0, [field]: value };
          assert.throws(() => JsoncVisitorEvent.cases.Comment.make(input));
          assertFailure(
            Result.mapError(S.decodeResult(JsoncVisitorEvent)({ _tag: "Comment", ...input }), (error) => error._tag),
            "SchemaError"
          );
        }
      }
    });

    it("builds tagged, structurally-equal events with guards", () => {
      const event = JsoncVisitorEvent.cases.Comment.make({ offset: 0, length: 3 });
      assert.strictEqual(event._tag, "Comment");
      assert.isTrue(JsoncVisitorEvent.guards.Comment(event));
      assert.isFalse(JsoncVisitorEvent.guards.Error(event));
      assert.isTrue(S.is(JsoncVisitorEvent)(event));
      assert.isFalse(S.is(JsoncVisitorEvent)({ _tag: "Separator", character: ";", offset: 0, length: 1 }));
    });
  });

  describe("visit", () => {
    it.effect("emits a well-formed event sequence for an object", () =>
      Effect.gen(function* () {
        const tags1 = yield* tags('{ "a": 1 }');
        assert.deepStrictEqual(tags1, ["ObjectBegin", "ObjectProperty", "Separator", "LiteralValue", "ObjectEnd"]);
      })
    );

    it.effect("emits every literal kind with its decoded value and path", () =>
      Effect.gen(function* () {
        const events = yield* collect('[1, "s", true, false, null, { "k": 2 }]');
        const literals = A.filter(events, JsoncVisitorEvent.guards.LiteralValue);
        assert.deepStrictEqual(
          A.map(literals, (e) => e.value),
          [1, "s", true, false, null, 2]
        );
        assert.deepStrictEqual(
          A.map(literals, (e) => e.path),
          [[0], [1], [2], [3], [4], [5, "k"]]
        );
        const begins = A.filter(events, JsoncVisitorEvent.guards.ObjectBegin);
        assert.deepStrictEqual(
          A.map(begins, (e) => e.path),
          [[5]]
        );
        assert.deepStrictEqual(
          A.map(A.filter(events, JsoncVisitorEvent.guards.Separator), (e) => e.character),
          [",", ",", ",", ",", ",", ":"]
        );
      })
    );

    it.effect("filter + take enables early termination", () =>
      Effect.gen(function* () {
        const events = yield* JsoncVisitor.visit('{ "a": 1, "b": 2, "c": 3 }').pipe(
          Stream.filter(JsoncVisitorEvent.guards.LiteralValue),
          Stream.take(1),
          Stream.runCollect
        );
        assert.strictEqual(events.length, 1);
        assertDefined(events[0]);
        assert.strictEqual(events[0].value, 1);
      })
    );

    it.effect("emits Comment events by default and Error when comments are disallowed", () =>
      Effect.gen(function* () {
        const tags2 = yield* tags("/* a */ 1 // c");
        assert.deepStrictEqual(tags2, ["Comment", "LiteralValue", "Comment"]);
        const disallowed = yield* collect('{ "a": 1 } // c', JsoncParseOptions.make({ disallowComments: true }));
        assert.deepStrictEqual(
          A.map(A.filter(disallowed, JsoncVisitorEvent.guards.Error), (e) => e.code),
          ["InvalidCommentToken"]
        );
      })
    );

    // Port deviation (upstream-bug): upstream wraps one generator object, so a
    // second run of the same stream resumes the exhausted generator and yields
    // nothing; the lab creates a fresh generator per run.
    it.effect("one visit stream can be run more than once with the same events", () =>
      Effect.gen(function* () {
        const stream = JsoncVisitor.visit('{ "a": [1, 2] } // c');
        const first = yield* Stream.runCollect(stream);
        const second = yield* Stream.runCollect(stream);
        assert.deepStrictEqual(
          A.map(first, (e) => e._tag),
          [
            "ObjectBegin",
            "ObjectProperty",
            "Separator",
            "ArrayBegin",
            "LiteralValue",
            "Separator",
            "LiteralValue",
            "ArrayEnd",
            "ObjectEnd",
            "Comment",
          ]
        );
        assert.deepStrictEqual(second, first);
        const literals = yield* stream.pipe(Stream.filter(JsoncVisitorEvent.guards.LiteralValue), Stream.runCollect);
        assert.deepStrictEqual(
          A.map(literals, (e) => e.value),
          [1, 2]
        );
      })
    );

    it.effect("emits nothing for an empty document", () =>
      Effect.gen(function* () {
        const tags3 = yield* tags("");
        assert.deepStrictEqual(tags3, []);
        const tags4 = yield* tags("  \n");
        assert.deepStrictEqual(tags4, []);
      })
    );
  });

  describe("malformed-input recovery", () => {
    it.effect("terminates with bounded events on an invalid array element", () =>
      Effect.gen(function* () {
        const events = yield* collect("[@]");
        assert.deepStrictEqual(
          A.map(events, (e) => e._tag),
          ["ArrayBegin", "Error", "Error", "ArrayEnd"]
        );
      })
    );

    it.effect("does not consume a container closer during recovery", () =>
      Effect.gen(function* () {
        const tags5 = yield* tags('{ "a": }');
        assert.deepStrictEqual(tags5, ["ObjectBegin", "ObjectProperty", "Separator", "Error", "ObjectEnd"]);
      })
    );

    it.effect("reports missing commas, colons, property names and closers in band", () =>
      Effect.gen(function* () {
        const errorCodes6 = yield* errorCodes('{ "a": 1 "b": 2 }');
        assert.deepStrictEqual(errorCodes6, ["CommaExpected"]);
        const errorCodes7 = yield* errorCodes("[1 2]");
        assert.deepStrictEqual(errorCodes7, ["CommaExpected"]);
        const errorCodes8 = yield* errorCodes('{ "a" 1 }');
        assert.deepStrictEqual(errorCodes8, ["ColonExpected"]);
        const errorCodes9 = yield* errorCodes("{ 1: 2 }");
        assert.deepStrictEqual(errorCodes9, ["PropertyNameExpected", "PropertyNameExpected", "PropertyNameExpected"]);
        const errorCodes10 = yield* errorCodes('{ "a": 1');
        assert.deepStrictEqual(errorCodes10, ["CloseBraceExpected"]);
        const errorCodes11 = yield* errorCodes("[1");
        assert.deepStrictEqual(errorCodes11, ["CloseBracketExpected"]);
        const errorCodes12 = yield* errorCodes("1 2");
        assert.deepStrictEqual(errorCodes12, ["EndOfFileExpected"]);
        const errorCodes13 = yield* errorCodes('"abc');
        assert.deepStrictEqual(errorCodes13, ["UnexpectedEndOfString"]);
      })
    );

    it.effect("accepts trailing commas and emits their separators", () =>
      Effect.gen(function* () {
        const tags14 = yield* tags('{ "a": 1, }');
        assert.deepStrictEqual(tags14, [
          "ObjectBegin",
          "ObjectProperty",
          "Separator",
          "LiteralValue",
          "Separator",
          "ObjectEnd",
        ]);
        const tags15 = yield* tags("[1, ]");
        assert.deepStrictEqual(tags15, ["ArrayBegin", "LiteralValue", "Separator", "ArrayEnd"]);
      })
    );

    it.effect("deeply nested input yields a NestingDepthExceeded Error event, never a stack-overflow defect", () =>
      Effect.gen(function* () {
        const deep = `${Str.repeat(20000)("[")}1${Str.repeat(20000)("]")}`;
        const codes = yield* errorCodes(deep);
        assert.deepStrictEqual(codes, ["NestingDepthExceeded"]);
        const objects = `${Str.repeat(300)('{"a":')}1${Str.repeat(300)("}")}`;
        const errorCodes16 = yield* errorCodes(objects);
        assert.deepStrictEqual(errorCodes16, ["NestingDepthExceeded"]);
        const parsed = yield* Jsonc.parse(deep).pipe(Effect.asVoid, Effect.flip);
        assert.strictEqual(parsed._tag, "JsoncParseError");
      })
    );

    it.effect("keeps literal values stable for trailing-backslash unterminated strings", () =>
      Effect.gen(function* () {
        for (const [text, expected] of [
          ['"abc\\', "abc"],
          ['"\\', ""],
        ] as const) {
          const events = yield* collect(text);
          const literal = O.getOrUndefined(A.findFirst(events, JsoncVisitorEvent.guards.LiteralValue));
          assertDefined(literal);
          assert.strictEqual(literal.value, expected);
          assert.deepStrictEqual(
            A.map(A.filter(events, JsoncVisitorEvent.guards.Error), (e) => e.code),
            ["UnexpectedEndOfString"]
          );
        }
      })
    );
  });

  describe("collecting", () => {
    it.effect("Stream.filter + runCollect covers the collecting use case", () =>
      Effect.gen(function* () {
        const props = yield* JsoncVisitor.visit('{ "name": "x", "age": 1 }').pipe(
          Stream.filter(JsoncVisitorEvent.guards.ObjectProperty),
          Stream.map((e) => e.property),
          Stream.runCollect
        );
        assert.deepStrictEqual(props, ["name", "age"]);
        const parsed17 = yield* Jsonc.parse('{ "name": "x", "age": 1 }');
        assert.deepStrictEqual(parsed17, { name: "x", age: 1 });
      })
    );
  });
});
