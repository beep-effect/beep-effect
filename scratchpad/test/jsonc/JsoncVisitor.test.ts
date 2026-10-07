import { assert, describe, it } from "@effect/vitest";
import { assertDefined } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { Jsonc, JsoncParseOptions, JsoncVisitor, JsoncVisitorEvent } from "../../effected/jsonc/index.ts";

const collect = (text: string, options?: JsoncParseOptions) => Stream.runCollect(JsoncVisitor.visit(text, options));
const tags = (text: string, options?: JsoncParseOptions) => Effect.map(collect(text, options), (events) => events.map((e) => e._tag));
const errorCodes = (text: string) =>
  Effect.map(collect(text), (events) => events.filter(JsoncVisitorEvent.guards.Error).map((e) => e.code));

describe("JsoncVisitor", () => {
  describe("schema", () => {
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
        assert.deepStrictEqual(yield* tags('{ "a": 1 }'), ["ObjectBegin", "ObjectProperty", "Separator", "LiteralValue", "ObjectEnd"]);
      })
    );

    it.effect("emits every literal kind with its decoded value and path", () =>
      Effect.gen(function* () {
        const events = yield* collect('[1, "s", true, false, null, { "k": 2 }]');
        const literals = events.filter(JsoncVisitorEvent.guards.LiteralValue);
        assert.deepStrictEqual(literals.map((e) => e.value), [1, "s", true, false, null, 2]);
        assert.deepStrictEqual(literals.map((e) => e.path), [[0], [1], [2], [3], [4], [5, "k"]]);
        const begins = events.filter(JsoncVisitorEvent.guards.ObjectBegin);
        assert.deepStrictEqual(begins.map((e) => e.path), [[5]]);
        assert.deepStrictEqual(events.filter(JsoncVisitorEvent.guards.Separator).map((e) => e.character), [",", ",", ",", ",", ",", ":"]);
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
        assert.deepStrictEqual(yield* tags('/* a */ 1 // c'), ["Comment", "LiteralValue", "Comment"]);
        const disallowed = yield* collect('{ "a": 1 } // c', JsoncParseOptions.make({ disallowComments: true }));
        assert.deepStrictEqual(disallowed.filter(JsoncVisitorEvent.guards.Error).map((e) => e.code), ["InvalidCommentToken"]);
      })
    );

    it.effect("emits nothing for an empty document", () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* tags(""), []);
        assert.deepStrictEqual(yield* tags("  \n"), []);
      })
    );
  });

  describe("malformed-input recovery", () => {
    it.effect("terminates with bounded events on an invalid array element", () =>
      Effect.gen(function* () {
        const events = yield* collect("[@]");
        assert.deepStrictEqual(events.map((e) => e._tag), ["ArrayBegin", "Error", "Error", "ArrayEnd"]);
      })
    );

    it.effect("does not consume a container closer during recovery", () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* tags('{ "a": }'), ["ObjectBegin", "ObjectProperty", "Separator", "Error", "ObjectEnd"]);
      })
    );

    it.effect("reports missing commas, colons, property names and closers in band", () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* errorCodes('{ "a": 1 "b": 2 }'), ["CommaExpected"]);
        assert.deepStrictEqual(yield* errorCodes("[1 2]"), ["CommaExpected"]);
        assert.deepStrictEqual(yield* errorCodes('{ "a" 1 }'), ["ColonExpected"]);
        assert.deepStrictEqual(yield* errorCodes("{ 1: 2 }"), ["PropertyNameExpected", "PropertyNameExpected", "PropertyNameExpected"]);
        assert.deepStrictEqual(yield* errorCodes('{ "a": 1'), ["CloseBraceExpected"]);
        assert.deepStrictEqual(yield* errorCodes("[1"), ["CloseBracketExpected"]);
        assert.deepStrictEqual(yield* errorCodes("1 2"), ["EndOfFileExpected"]);
        assert.deepStrictEqual(yield* errorCodes('"abc'), ["UnexpectedEndOfString"]);
      })
    );

    it.effect("accepts trailing commas and emits their separators", () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* tags('{ "a": 1, }'), ["ObjectBegin", "ObjectProperty", "Separator", "LiteralValue", "Separator", "ObjectEnd"]);
        assert.deepStrictEqual(yield* tags("[1, ]"), ["ArrayBegin", "LiteralValue", "Separator", "ArrayEnd"]);
      })
    );

    it.effect("deeply nested input yields a NestingDepthExceeded Error event, never a stack-overflow defect", () =>
      Effect.gen(function* () {
        const deep = `${"[".repeat(20000)}1${"]".repeat(20000)}`;
        const codes = yield* errorCodes(deep);
        assert.deepStrictEqual(codes, ["NestingDepthExceeded"]);
        const objects = `${"{\"a\":".repeat(300)}1${"}".repeat(300)}`;
        assert.deepStrictEqual(yield* errorCodes(objects), ["NestingDepthExceeded"]);
        const parsed = yield* Jsonc.parse(deep).pipe(Effect.asVoid, Effect.flip);
        assert.strictEqual(parsed._tag, "JsoncParseError");
      })
    );

    it.effect("keeps literal values stable for trailing-backslash unterminated strings", () =>
      Effect.gen(function* () {
        for (const [text, expected] of [['"abc\\', "abc"], ['"\\', ""]] as const) {
          const events = yield* collect(text);
          const literal = events.find(JsoncVisitorEvent.guards.LiteralValue);
          assertDefined(literal);
          assert.strictEqual(literal.value, expected);
          assert.deepStrictEqual(events.filter(JsoncVisitorEvent.guards.Error).map((e) => e.code), ["UnexpectedEndOfString"]);
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
        assert.deepStrictEqual(yield* Jsonc.parse('{ "name": "x", "age": 1 }'), { name: "x", age: 1 });
      })
    );
  });
});
