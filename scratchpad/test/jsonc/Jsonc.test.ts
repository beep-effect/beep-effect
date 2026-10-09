import { assert, describe, it } from "@effect/vitest";
import { assertDefined, assertExitFailure, assertFailure, assertNone, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  Jsonc,
  JsoncFormatter,
  JsoncNode,
  JsoncParseError,
  JsoncParseErrorCode,
  JsoncParseErrorDetail,
  JsoncParseOptions,
  JsoncStringifyError,
  JsoncStringifyErrorCode,
  JsoncStringifyOptions,
} from "../../effected/jsonc/index.ts";
import { ParseFlags, parseTree as parseTreeRaw, parseValue as parseValueRaw } from "../../effected/jsonc/internal/parser.ts";

const deeplyNested = `${"[".repeat(20000)}1${"]".repeat(20000)}`;

// The typed failure of an Effect whose success is irrelevant to the assertion.
const failureOf = <E>(self: Effect.Effect<unknown, E>) => self.pipe(Effect.asVoid, Effect.flip);

// The typed failure of a Result; a success fails the assertion.
const failure = <E>(result: Result.Result<unknown, E>): E => result.pipe(Result.flip, Result.getOrThrow);

const codes = (error: JsoncParseError): ReadonlyArray<string> => error.errors.map((e) => e.code);

// The best of three wall-clock runs of `run(input)` in nanoseconds, after one
// warm-up call; taking the minimum filters out collection pauses and load.
const bestNanos = Effect.fnUntraced(function* (run: (input: string) => unknown, input: string) {
  run(input);
  let best = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 3; attempt++) {
    const start = yield* Clock.currentTimeNanos;
    run(input);
    best = Math.min(best, Number((yield* Clock.currentTimeNanos) - start));
  }
  return best;
});

// Growing the input 16-fold must grow the time less than 48-fold. Linear
// accumulation measures 5 to 20 here; the copy-per-append accumulators this
// guards against measured 80 to 220.
const scalesLinearly = Effect.fnUntraced(function* (run: (input: string) => unknown, make: (size: number) => string) {
  const small = yield* bestNanos(run, make(2_000));
  const large = yield* bestNanos(run, make(32_000));
  assert.isBelow(large, small * 48);
});

const flatArray = (size: number): string => `[${"0,".repeat(size)}0]`;

// The parse-error codes a malformed document reports, in either parse mode.
const parseCodes = (text: string): ReadonlyArray<string> => Jsonc.parseResult(text).pipe(failure, codes);
const parseTreeCodes = (text: string): ReadonlyArray<string> => Jsonc.parseTreeResult(text).pipe(failure, codes);

describe("Jsonc", () => {
  describe("schemas", () => {
    it("JsoncParseOptions defaults to the JSONC convention", () => {
      assert.deepStrictEqual({ ...JsoncParseOptions.make({}) }, { disallowComments: false, allowTrailingComma: true, allowEmptyContent: false });
      assert.strictEqual(Result.getOrThrow(S.decodeResult(JsoncParseOptions)({ disallowComments: true })).allowTrailingComma, true);
    });

    it("JsoncStringifyOptions defaults to a two-space indent", () => {
      assert.deepStrictEqual({ ...JsoncStringifyOptions.make({}) }, { tabSize: 2, insertSpaces: true });
    });

    it("the code kits guard their literals", () => {
      assert.isTrue(JsoncParseErrorCode.is.CommaExpected("CommaExpected"));
      assert.strictEqual(JsoncParseErrorCode.literals.length, 17);
      assert.isTrue(JsoncStringifyErrorCode.is.SerializationFailed("SerializationFailed"));
    });

    it("JsoncParseErrorDetail and JsoncParseError are schema classes", () => {
      const detail = JsoncParseErrorDetail.make({ code: "ValueExpected", offset: 7, length: 1, line: 0, character: 7 });
      const error = JsoncParseError.make({ errors: [detail], input: '{ "a": }' });
      assert.isTrue(S.is(JsoncParseError)(error));
      assert.strictEqual(error.message, "JSONC parse failed with 1 error: ValueExpected at 1:8");
      const two = JsoncParseError.make({ errors: [detail, detail], input: "" });
      assert.include(two.message, "with 2 errors");
    });
  });

  describe("parse", () => {
    it.effect("parses objects, arrays and scalars", () =>
      Effect.gen(function* () {
        const value = yield* Jsonc.parse('{ "a": 1, "b": [true, null, "x"] }');
        assert.deepStrictEqual(value, { a: 1, b: [true, null, "x"] });
      })
    );

    it.effect("ignores comments and allows trailing commas by default", () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* Jsonc.parse('{ "port": 3000 // dev\n /* block */ }'), { port: 3000 });
        assert.deepStrictEqual(yield* Jsonc.parse('{ "a": 1, }'), { a: 1 });
        assert.deepStrictEqual(yield* Jsonc.parse("[1, 2, ]"), [1, 2]);
      })
    );

    it.effect("fails with an aggregate JsoncParseError carrying positioned details", () =>
      Effect.gen(function* () {
        const error = yield* failureOf(Jsonc.parse("{ bad }"));
        assert.instanceOf(error, JsoncParseError);
        assert.strictEqual(error._tag, "JsoncParseError");
        assert.strictEqual(error.input, "{ bad }");
        const detail = error.errors[0];
        assertDefined(detail);
        assert.strictEqual(detail.line, 0);
        assert.strictEqual(detail.character, 2);
      })
    );

    it.effect("renders the message position 1-based while the detail fields stay 0-based", () =>
      Effect.gen(function* () {
        const e = yield* failureOf(Jsonc.parse('{ "a": }'));
        assert.deepStrictEqual(e.errors[0], JsoncParseErrorDetail.make({ code: "ValueExpected", offset: 7, length: 1, line: 0, character: 7 }));
        assert.include(e.message, "ValueExpected at 1:8");
        assert.notInclude(e.message, "at 0:7");
        const multi = yield* failureOf(Jsonc.parse('{\n  "a": 1\n  "b": 2\n}'));
        assert.deepStrictEqual(multi.errors[0], JsoncParseErrorDetail.make({ code: "CommaExpected", offset: 13, length: 3, line: 2, character: 2 }));
        assert.include(multi.message, "CommaExpected at 3:3");
      })
    );

    it.effect("computes line and character across LF, CRLF, bare CR, LS and PS", () =>
      Effect.gen(function* () {
        const lf = yield* failureOf(Jsonc.parse('{\n  "a": 1\n  "b": 2\n}'));
        assert.deepStrictEqual(lf.errors.map((e) => [e.line, e.character]), [[2, 2]]);
        const crlf = yield* failureOf(Jsonc.parse('{\r\n  "a": 1\r\n  "b": 2\r\n}'));
        assert.deepStrictEqual(crlf.errors.map((e) => [e.line, e.character]), [[2, 2]]);
        const cr = yield* failureOf(Jsonc.parse('{\r  "a": 1\r  "b": 2\r}'));
        assert.deepStrictEqual(cr.errors.map((e) => [e.line, e.character]), [[2, 2]]);
        const separators = yield* failureOf(Jsonc.parse("{\u2028bad\u2029}"));
        assert.deepStrictEqual(separators.errors.map((e) => [e.code, e.line, e.character]), [["InvalidSymbol", 1, 0], ["PropertyNameExpected", 1, 0]]);
      })
    );

    it.effect("rejects comments when disallowComments is set", () =>
      Effect.gen(function* () {
        const error = yield* failureOf(Jsonc.parse('{ "a": 1 } // no', JsoncParseOptions.make({ disallowComments: true })));
        assert.deepStrictEqual(codes(error), ["InvalidCommentToken"]);
      })
    );
  });

  describe("parseResult", () => {
    it("succeeds synchronously with the decoded value", () => {
      assertSuccess(Jsonc.parseResult('{ "a": 1, "b": [true, null, "x"] // dev\n }'), { a: 1, b: [true, null, "x"] });
    });

    it("fails with the aggregate JsoncParseError carrying positioned details", () => {
      const error = failure(Jsonc.parseResult("{ bad }"));
      assert.instanceOf(error, JsoncParseError);
      assert.strictEqual(error.input, "{ bad }");
      assert.deepStrictEqual(codes(error), ["InvalidSymbol", "PropertyNameExpected"]);
    });

    it("honors JsoncParseOptions", () => {
      const error = failure(Jsonc.parseResult('{ "a": 1 } // no', JsoncParseOptions.make({ disallowComments: true })));
      assert.deepStrictEqual(codes(error), ["InvalidCommentToken"]);
      assertSuccess(Jsonc.parseResult("", JsoncParseOptions.make({ allowEmptyContent: true })), undefined);
    });

    it("bounds hostile deep nesting through the failure side, never a thrown RangeError", () => {
      assert.deepStrictEqual(parseCodes(deeplyNested), ["NestingDepthExceeded"]);
    });
  });

  describe("parse delegates to parseResult", () => {
    it.effect("succeeds and fails identically to the Result variant", () =>
      Effect.gen(function* () {
        assertSuccess(Jsonc.parseResult('{ "a": [1, 2], }'), yield* Jsonc.parse('{ "a": [1, 2], }'));
        const effectError = yield* failureOf(Jsonc.parse("{ bad }"));
        assert.deepStrictEqual(effectError, failure(Jsonc.parseResult("{ bad }")));
      })
    );
  });

  describe("parseTree", () => {
    it.effect("builds a JsoncNode AST", () =>
      Effect.gen(function* () {
        const root = O.getOrThrow(yield* Jsonc.parseTree('{ "a": [1, 2] }'));
        assert.instanceOf(root, JsoncNode);
        assert.strictEqual(root.type, "object");
        assert.strictEqual(root.children?.length, 1);
        assert.deepStrictEqual(root.toValue(), { a: [1, 2] });
      })
    );

    it.effect("returns O.none() for empty input with allowEmptyContent", () =>
      Effect.gen(function* () {
        assertNone(yield* Jsonc.parseTree("", JsoncParseOptions.make({ allowEmptyContent: true })));
      })
    );

    // Tree construction used to double in cost per nesting level, so merely
    // completing inside the test timeout at depth 250 proves the internal
    // builder is no longer re-validating every subtree per node.
    it.effect("parses deep nesting under the depth cap in linear time", () =>
      Effect.gen(function* () {
        const depth = 250;
        let node = O.getOrThrow(yield* Jsonc.parseTree(`${"[".repeat(depth)}1${"]".repeat(depth)}`));
        let levels = 0;
        while (node.type === "array" && node.children?.length === 1) {
          const child = node.children[0];
          assertDefined(child);
          node = child;
          levels++;
        }
        assert.strictEqual(levels, depth);
        assert.strictEqual(node.value, 1);
      })
    );

    it.effect("parses wide documents in time linear in node count", () =>
      Effect.gen(function* () {
        const root = O.getOrThrow(yield* Jsonc.parseTree(`[${Array.from({ length: 10_000 }, (_, i) => i).join(",")}]`));
        assert.strictEqual(root.children?.length, 10_000);
        assert.strictEqual(root.children?.[9_999]?.value, 9_999);
      })
    );

    it.effect("parser-built nodes are structurally equal to JsoncNode.make-built ones", () =>
      Effect.gen(function* () {
        const parsed = O.getOrThrow(yield* Jsonc.parseTree('{"a": [1]}'));
        const handBuilt = JsoncNode.make({
          type: "object",
          offset: 0,
          length: 10,
          children: [
            JsoncNode.make({
              type: "property",
              offset: 1,
              length: 8,
              colonOffset: 4,
              children: [
                JsoncNode.make({ type: "string", offset: 1, length: 3, value: "a" }),
                JsoncNode.make({
                  type: "array",
                  offset: 6,
                  length: 3,
                  children: [JsoncNode.make({ type: "number", offset: 7, length: 1, value: 1 })],
                }),
              ],
            }),
          ],
        });
        assert.isTrue(Equal.equals(parsed, handBuilt));
      })
    );
  });

  describe("parseTreeResult", () => {
    it("succeeds synchronously with the AST, with none for empty input", () => {
      const root = Jsonc.parseTreeResult('{ "a": [1, 2] }').pipe(Result.getOrThrow, O.getOrThrow);
      assert.deepStrictEqual(root.toValue(), { a: [1, 2] });
      assertNone(Jsonc.parseTreeResult("", JsoncParseOptions.make({ allowEmptyContent: true })).pipe(Result.getOrThrow));
    });

    it("fails with the aggregate JsoncParseError and bounds deep nesting", () => {
      assert.deepStrictEqual(parseTreeCodes("{ bad }"), ["InvalidSymbol", "PropertyNameExpected"]);
      assert.deepStrictEqual(parseTreeCodes(deeplyNested), ["NestingDepthExceeded"]);
    });
  });

  describe("parseTree delegates to parseTreeResult", () => {
    it.effect("succeeds and fails identically to the Result variant", () =>
      Effect.gen(function* () {
        const viaEffect = yield* Jsonc.parseTree('{ "a": [1, 2] }');
        const viaResult = Result.getOrThrow(Jsonc.parseTreeResult('{ "a": [1, 2] }'));
        assert.isTrue(Equal.equals(O.getOrThrow(viaEffect), O.getOrThrow(viaResult)));
        const effectError = yield* failureOf(Jsonc.parseTree("{ bad }"));
        assert.deepStrictEqual(effectError, failure(Jsonc.parseTreeResult("{ bad }")));
      })
    );
  });

  describe("stripComments", () => {
    it("removes comments producing valid JSON", () => {
      assert.strictEqual(Jsonc.stripComments('{ "a": 1 // c\n}'), '{ "a": 1 \n}');
      assert.strictEqual(Jsonc.stripComments('/* a */ 1 /* b */'), " 1 ");
      assert.strictEqual(Jsonc.stripComments("1"), "1");
    });

    it("preserves offsets and line breaks when a replacement character is given", () => {
      const input = '{ "a": 1 // comment\n}';
      const stripped = Jsonc.stripComments(input, " ");
      assert.strictEqual(stripped.length, input.length);
      assertSuccess(Jsonc.parseResult(stripped), { a: 1 });
      assert.strictEqual(Jsonc.stripComments("/* a\r\nb */1", "x"), "xxxx\r\nxxxx1");
    });
  });

  describe("stringifyResult", () => {
    it("default output is a two-space-indented document", () => {
      assertSuccess(Jsonc.stringifyResult({ port: 3000, hosts: ["a", "b"], nested: { flag: true, nothing: null } }), '{\n  "port": 3000,\n  "hosts": [\n    "a",\n    "b"\n  ],\n  "nested": {\n    "flag": true,\n    "nothing": null\n  }\n}');
      assertSuccess(Jsonc.stringifyResult("plain string"), '"plain string"');
      assertSuccess(Jsonc.stringifyResult(42), "42");
      assertSuccess(Jsonc.stringifyResult(null), "null");
      assertSuccess(Jsonc.stringifyResult({}), "{}");
      assertSuccess(Jsonc.stringifyResult([]), "[]");
    });

    it("fails with CircularReference on a reference cycle, direct or through siblings", () => {
      const value: Record<string, unknown> = { a: 1 };
      value.self = value;
      const error = failure(Jsonc.stringifyResult(value));
      assert.strictEqual(error._tag, "JsoncStringifyError");
      assert.strictEqual(error.code, "CircularReference");
      assert.strictEqual(error.value, value);
      const shared = { leaf: 1 };
      assertSuccess(Jsonc.stringifyResult({ a: shared, b: shared }, JsoncStringifyOptions.make({ tabSize: 0 })), '{"a":{"leaf":1},"b":{"leaf":1}}');
      const inner: Record<string, unknown> = { b: {} };
      const nested: Record<string, unknown> = { a: inner };
      inner["b"] = { back: nested };
      assert.strictEqual(failure(Jsonc.stringifyResult(nested)).code, "CircularReference");
    });

    it("fails with BigIntValue on top-level and nested bigints", () => {
      assert.strictEqual(failure(Jsonc.stringifyResult(1n)).code, "BigIntValue");
      assert.strictEqual(failure(Jsonc.stringifyResult({ a: { b: [1n] } })).code, "BigIntValue");
    });

    it("fails with TopLevelUnrepresentable when output would be absent", () => {
      for (const value of [undefined, () => 1, Symbol("s")]) {
        assert.strictEqual(failure(Jsonc.stringifyResult(value)).code, "TopLevelUnrepresentable");
      }
    });

    it("classifies the root after toJSON, as JSON.stringify sees it", () => {
      assertSuccess(Jsonc.stringifyResult(Object.assign(() => 0, { toJSON: () => 7 })), "7");
      for (const toJSON of [() => undefined, () => Symbol("x"), () => () => 1]) {
        const error = failure(Jsonc.stringifyResult({ toJSON }));
        assert.strictEqual(error.code, "TopLevelUnrepresentable");
        assert.strictEqual(error.detail, "the top-level value (undefined, a function or a symbol) has no JSON representation");
      }
      assert.strictEqual(failure(Jsonc.stringifyResult({ toJSON: () => 1n })).code, "BigIntValue");
    });

    it("nested unrepresentables follow JSON.stringify semantics (dropped in objects, null in arrays)", () => {
      const value = { keep: 1, drop: undefined, fn: () => 1, arr: [undefined, () => 1, 2] };
      assertSuccess(Jsonc.stringifyResult(value, JsoncStringifyOptions.make({ tabSize: 0 })), '{"keep":1,"arr":[null,null,2]}');
    });

    it("honors the tabSize and insertSpaces knobs", () => {
      const value = { a: [1] };
      assertSuccess(Jsonc.stringifyResult(value, JsoncStringifyOptions.make({ tabSize: 4 })), '{\n    "a": [\n        1\n    ]\n}');
      assertSuccess(Jsonc.stringifyResult(value, JsoncStringifyOptions.make({ insertSpaces: false })), '{\n\t"a": [\n\t\t1\n\t]\n}');
      assertSuccess(Jsonc.stringifyResult(value, JsoncStringifyOptions.make({ tabSize: 0 })), '{"a":[1]}');
    });

    // Port deviation (law:7): upstream rethrows a throwing toJSON as a defect; the lab fails typed with SerializationFailed.
    it("a throwing toJSON fails typed with SerializationFailed", () => {
      const bomb = {
        toJSON: () => {
          throw new RangeError("boom");
        },
      };
      const error = failure(Jsonc.stringifyResult(bomb));
      assert.strictEqual(error.code, "SerializationFailed");
      assert.include(error.message, "JSONC stringify failed: SerializationFailed");
    });
  });

  describe("linear scaling", () => {
    const flags = ParseFlags.make({});
    const cases: ReadonlyArray<readonly [string, (input: string) => unknown, (size: number) => string]> = [
      ["parseValue accumulates array items", (text) => parseValueRaw(text, flags), flatArray],
      ["parseValue accumulates recovered errors", (text) => parseValueRaw(text, flags), (size) => `[${",".repeat(size)}]`],
      ["parseTree accumulates array children", (text) => parseTreeRaw(text, flags), flatArray],
      [
        "parseTree accumulates object members",
        (text) => parseTreeRaw(text, flags),
        (size) => `{${A.join(A.makeBy(size, (index) => `"k${index}":0`), ",")}}`,
      ],
      ["the scanner decodes escapes", (text) => parseValueRaw(text, flags), (size) => `"${"\\n".repeat(size)}"`],
      ["JsoncFormatter.format accumulates edits", JsoncFormatter.format, flatArray],
      ["Jsonc.stripComments accumulates pieces", Jsonc.stripComments, (size) => `[${"/**/0,".repeat(size)}0]`],
    ];
    for (const [name, run, make] of cases) {
      // it.live: the measurement needs real elapsed time, which the TestClock would freeze.
      it.live(`${name} in linear time`, () => scalesLinearly(run, make));
    }
  });

  describe("stringify delegates to stringifyResult", () => {
    it.effect("succeeds and fails identically to the Result variant", () =>
      Effect.gen(function* () {
        assert.strictEqual(yield* Jsonc.stringify({ a: 1 }), '{\n  "a": 1\n}');
        const error = yield* failureOf(Jsonc.stringify(1n));
        assert.instanceOf(error, JsoncStringifyError);
        assert.strictEqual(error.code, "BigIntValue");
        assert.include(error.message, "JSONC stringify failed");
      })
    );
  });

  describe("equals / equalsValue", () => {
    it("is key-order independent for objects and order-sensitive for arrays", () => {
      assert.isTrue(Jsonc.equals('{ "a": 1, "b": 2 }', '{"b":2,"a":1}'));
      assert.isFalse(Jsonc.equals("[1, 2]", "[2, 1]"));
      assert.isTrue(Jsonc.equals("[1, 2]", "[1,2]"));
      assert.isFalse(Jsonc.equals("[1, 2]", "[1]"));
      assert.isFalse(Jsonc.equals("[1]", '{"0": 1}'));
      assert.isFalse(Jsonc.equals('{"a": 1}', '{"b": 1}'));
      assert.isFalse(Jsonc.equals('{"a": 1}', '{"a": 1, "b": 2}'));
      assert.isFalse(Jsonc.equals("1", '"1"'));
      assert.isFalse(Jsonc.equals("null", "{}"));
    });

    it("ignores comments and formatting", () => {
      assert.isTrue(Jsonc.equals('{ "a": 1 /* c */ }', '{\n  "a": 1 // note\n}'));
    });

    it("equalsValue compares against a JS value", () => {
      assert.isTrue(Jsonc.equalsValue('{ "port": 3000, "host": "x" }', { host: "x", port: 3000 }));
      assert.isFalse(Jsonc.equalsValue('{ "a": 1 }', { a: 2 }));
      assert.isFalse(Jsonc.equalsValue("[1]", { 0: 1 }));
    });

    it("malformed input is never equal to anything", () => {
      assert.isFalse(Jsonc.equals("{ bad }", "{}"));
      assert.isFalse(Jsonc.equals("{}", "{ bad }"));
      assert.isFalse(Jsonc.equalsValue("{ bad }", {}));
    });
  });

  describe("hostile input", () => {
    it.effect("__proto__ becomes an own data property, never a prototype mutation", () =>
      Effect.gen(function* () {
        const text = '{ "__proto__": { "polluted": true } }';
        const value = yield* Jsonc.parse(text);
        assert.strictEqual(Object.getPrototypeOf(value), Object.prototype);
        assert(P.isObject(value), "parse yields a plain object");
        assert.isTrue(Object.hasOwn(value, "__proto__"));
        assert.isFalse("polluted" in {});
        const fromTree = O.getOrThrow(yield* Jsonc.parseTree(text)).toValue();
        assert.strictEqual(Object.getPrototypeOf(fromTree), Object.prototype);
        assert(P.isObject(fromTree), "toValue yields a plain object");
        assert.isTrue(Object.hasOwn(fromTree, "__proto__"));
      })
    );

    it.effect("rejects unescaped control characters inside strings", () =>
      Effect.gen(function* () {
        const error = yield* failureOf(Jsonc.parse(`{ "a": "x${String.fromCharCode(1)}y" }`));
        assert.deepStrictEqual(codes(error), ["InvalidCharacter"]);
      })
    );

    it.effect("survives documents with tens of thousands of consecutive line breaks", () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* Jsonc.parse(`[1,${"\n".repeat(50000)}2]`), [1, 2]);
      })
    );

    it.effect("deeply nested input fails typed in both parse modes, never as a defect", () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(codes(yield* failureOf(Jsonc.parse(deeplyNested))), ["NestingDepthExceeded"]);
        assert.deepStrictEqual(codes(yield* failureOf(Jsonc.parseTree(deeplyNested))), ["NestingDepthExceeded"]);
        // The whole cause is one typed failure: no defect rides along with it.
        const exit = yield* Effect.exit(Jsonc.parse(deeplyNested));
        const error = exit.pipe(Exit.findErrorOption, O.getOrThrow);
        assert.deepStrictEqual(codes(error), ["NestingDepthExceeded"]);
        assertExitFailure(
          exit,
          Cause.annotate(Cause.fail(error), Exit.match(exit, { onFailure: Cause.annotations, onSuccess: Context.empty }))
        );
      })
    );

    it("equalsValue compares unequal without throwing on hostile hand-built values", () => {
      let value: unknown = 1;
      for (let i = 0; i < 20000; i++) value = [value];
      assert.doesNotThrow(() => Jsonc.equalsValue("[1]", value));
      assert.isFalse(Jsonc.equalsValue("[1]", value));
      // Both sides nested to the parser cap: the comparison stops at the cap
      // instead of recursing further.
      let other: unknown = 2;
      for (let i = 0; i < 256; i++) other = [other];
      assert.isFalse(Jsonc.equalsValue(`${"[".repeat(256)}1${"]".repeat(256)}`, other));
    });
  });

  describe("schema pipeline", () => {
    const Config = S.Struct({ name: S.String, version: S.Finite });

    it.effect("JsoncFromString decodes commented input to unknown and encodes back to JSON", () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* S.decodeEffect(Jsonc.JsoncFromString)('{ "k": 42 // c\n}'), { k: 42 });
        assert.strictEqual(yield* S.encodeUnknownEffect(Jsonc.JsoncFromString)({ a: 1 }), '{\n  "a": 1\n}');
      })
    );

    it.effect("schema(Target) decodes JSONC straight into a domain value", () =>
      Effect.gen(function* () {
        const config = yield* S.decodeEffect(Jsonc.schema(Config))('{ "name": "app", "version": 1 /* v1 */ }');
        assert.deepStrictEqual(config, { name: "app", version: 1 });
        const strict = Jsonc.schema(Config, JsoncParseOptions.make({ allowTrailingComma: false }));
        assertFailure(Result.mapError(S.decodeResult(strict)('{ "name": "app", "version": 1, }'), (error) => error._tag), "SchemaError");
      })
    );

    it.effect("encode surfaces a SchemaError carrying the stringify message on a circular value", () =>
      Effect.gen(function* () {
        const value: Record<string, unknown> = {};
        value.self = value;
        const error = yield* failureOf(S.encodeUnknownEffect(Jsonc.JsoncFromString)(value));
        assert.strictEqual(error._tag, "SchemaError");
        assert.include(String(error), "JSONC stringify failed");
      })
    );

    it.effect("decode surfaces a SchemaError carrying the aggregate parse message, distinct from target failures", () =>
      Effect.gen(function* () {
        const parseError = yield* failureOf(S.decodeEffect(Jsonc.JsoncFromString)("{ bad }"));
        assert.strictEqual(parseError._tag, "SchemaError");
        assert.include(String(parseError), "JSONC parse failed");
        const targetError = yield* failureOf(S.decodeEffect(Jsonc.schema(Config))('{ "name": "app", "version": "not-a-number" }'));
        assert.strictEqual(targetError._tag, "SchemaError");
        assert.notInclude(String(targetError), "JSONC parse failed");
      })
    );
  });

  describe("bind", () => {
    const config = Jsonc.bind(S.Struct({ name: S.String, version: S.Finite }));

    it.effect("decodes, encodes and round-trips through the composed schema", () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* config.decode('{ "name": "app", "version": 1 /* v1 */ }'), { name: "app", version: 1 });
        const text = yield* config.encode({ name: "app", version: 1 });
        assert.strictEqual(text, '{\n  "name": "app",\n  "version": 1\n}');
        assert.deepStrictEqual(yield* config.decode(text), { name: "app", version: 1 });
        assert.deepStrictEqual(yield* S.decodeEffect(config.schema)('{ "name": "app", "version": 2, }'), { name: "app", version: 2 });
      })
    );

    it.effect("surfaces parse and target failures as SchemaError", () =>
      Effect.gen(function* () {
        const parseError = yield* failureOf(config.decode("{ bad }"));
        assert.include(String(parseError), "JSONC parse failed");
        const targetError = yield* failureOf(config.decode('{ "name": "app", "version": "x" }'));
        assert.strictEqual(targetError._tag, "SchemaError");
        assert.notInclude(String(targetError), "JSONC parse failed");
      })
    );
  });

  describe("parse ∘ stripComments agreement (property)", () => {
    // `-0` is a valid `Int` the generator does emit, and JSON cannot carry it,
    // so the round-trip domain excludes it rather than letting equality fail.
    const Sample = S.Struct({
      name: S.String,
      count: S.Int.check(S.makeFilter((n) => !Object.is(n, -0))),
      enabled: S.Boolean,
      tags: S.Array(S.String),
    });
    const encodeSample = S.encodeEffect(S.fromJsonString(Sample));
    const decodeSample = S.decodeEffect(S.fromJsonString(Sample));

    it.effect.prop("parse agrees with the JSON codec on comment-free-equivalent input", [Sample], ([value]) =>
      Effect.gen(function* () {
        const json = yield* encodeSample(value);
        const commented = `${json.slice(0, -1)} /* trailing */ }`;
        assert.deepStrictEqual(yield* decodeSample(Jsonc.stripComments(commented)), value);
        assert.deepStrictEqual(yield* Jsonc.parse(commented), value);
      })
    );

    it.effect.prop("JsoncFromString round-trips decode(encode(v)) back to the original value", [Sample], ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeUnknownEffect(Jsonc.JsoncFromString)(value);
        assert.deepStrictEqual(yield* S.decodeEffect(Jsonc.JsoncFromString)(encoded), value);
      })
    );
  });

  // Review round 2 pins. They sit at the end of the file so every test above
  // keeps the line number the README and the ledger cite.

  describe("stripComments replacement text", () => {
    // Upstream parity: `replaceCh` lands verbatim once per comment code unit, so
    // the `$` sequences String.prototype.replace would expand stay literal.
    it("inserts replaceCh verbatim, replacement-pattern tokens included", () => {
      assert.strictEqual(Jsonc.stripComments("1/*x*/", "$&"), "1$&$&$&$&$&");
      assert.strictEqual(Jsonc.stripComments("1/*x*/", "$$"), "1$$$$$$$$$$");
      assert.strictEqual(Jsonc.stripComments("/* ab */1", "$'"), "$'$'$'$'$'$'$'$'1");
      assert.strictEqual(Jsonc.stripComments("/* ab */1", "$`"), "$`$`$`$`$`$`$`$`1");
      assert.strictEqual(Jsonc.stripComments("/* ab */1", "$1"), "$1$1$1$1$1$1$1$11");
      assert.strictEqual(Jsonc.stripComments("/* a\r\nb */1 // t\n2", "$&"), "$&$&$&$&\r\n$&$&$&$&1 $&$&$&$&\n2");
      assert.strictEqual(Jsonc.stripComments('"// kept" // c', "$'"), "\"// kept\" $'$'$'$'");
    });

    it("counts UTF-16 code units and takes an empty or multi-character replacement", () => {
      assert.strictEqual(Jsonc.stripComments("/* \u{1F600} */1", "x"), "xxxxxxxx1");
      assert.strictEqual(Jsonc.stripComments("// only", "ab"), "ababababababab");
      assert.strictEqual(Jsonc.stripComments("/* a\r\nb */1 // t\n2", ""), "\r\n1 \n2");
    });
  });

  describe("stringifyResult failure classification", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const throwing = (error: unknown) => ({
      toJSON: (): never => {
        throw error;
      },
    });

    // Upstream parity: the engine unboxes a boxed bigint after the replacer has
    // run and then refuses it exactly as it refuses a primitive, whatever the
    // box's prototype is.
    it("classifies a boxed bigint as BigIntValue, top level and nested", () => {
      const boxed: unknown = Object(1n);
      const bare: unknown = Object.setPrototypeOf(Object(2n), null);
      // The classification reads the engine's internal slot, never a method
      // the box owns: this `valueOf` must not run.
      const guarded: unknown = Object.assign(Object(3n), {
        valueOf: (): never => {
          throw new Error("valueOf executed");
        },
      });
      for (const value of [boxed, { n: boxed }, [boxed], { a: { b: [boxed] } }, { toJSON: () => boxed }, bare, [bare], [guarded]]) {
        assert.strictEqual(failure(Jsonc.stringifyResult(value)).code, "BigIntValue");
      }
    });

    it("treats an object that only inherits from BigInt.prototype as a plain object", () => {
      const inherits: unknown = Object.create(BigInt.prototype);
      assertSuccess(Jsonc.stringifyResult(inherits), "{}");
      assert.strictEqual(failure(Jsonc.stringifyResult([inherits, throwing(new RangeError("late"))])).code, "SerializationFailed");
      // A boxed bigint whose own toJSON answers never reaches the engine as a bigint.
      assertSuccess(Jsonc.stringifyResult(Object.assign(Object(1n), { toJSON: () => 1 })), "1");
    });

    // Port deviation (law:13 and the effect-first JSON-codec law): serialization
    // runs through the S.fromJsonString codec, which reports every throw as one
    // schema issue, so `detail` is that issue's sentence where upstream carries
    // the engine's message (or, for caller code, rethrows it).
    it("carries the schema codec's sentence as detail for every thrown failure", () => {
      const cases: ReadonlyArray<readonly [unknown, JsoncStringifyErrorCode]> = [
        [1n, "BigIntValue"],
        [{ a: [Object(1n)] }, "BigIntValue"],
        [circular, "CircularReference"],
        [throwing(new RangeError("boom")), "SerializationFailed"],
      ];
      for (const [value, code] of cases) {
        const error = failure(Jsonc.stringifyResult(value));
        assert.strictEqual(error.code, code);
        assert.strictEqual(error.detail, "Expected a JSON-serializable value");
        assert.strictEqual(error.message, `JSONC stringify failed: ${code} — Expected a JSON-serializable value`);
      }
    });

    // Port deviation (upstream-bug): upstream classifies every thrown TypeError
    // by its message, so caller code that throws TypeError("... bigint ...")
    // comes back as BigIntValue; the lab classifies by the value the engine
    // refused, so a caller's throw is always SerializationFailed.
    it("classifies a caller-thrown TypeError as SerializationFailed whatever its message says", () => {
      for (const message of ["my bigint thing", "circular dependency", "cyclic import"]) {
        assert.strictEqual(failure(Jsonc.stringifyResult(throwing(new TypeError(message)))).code, "SerializationFailed");
        const getter = {
          a: {
            get b(): never {
              throw new TypeError(message);
            },
          },
        };
        assert.strictEqual(failure(Jsonc.stringifyResult(getter)).code, "SerializationFailed");
      }
    });
  });

  describe("stringify tabSize", () => {
    const value = { a: [1] };
    const text = (tabSize: number) => Jsonc.stringifyResult(value, JsoncStringifyOptions.make({ tabSize }));
    const decodeOptions = S.decodeUnknownResult(JsoncStringifyOptions);

    // Upstream parity: `tabSize` is any number, and JSON.stringify truncates it
    // and caps it at 10. A width strictly between 0 and 1 is left out: the
    // engines disagree on it (V8 breaks lines without indenting, JavaScriptCore
    // stays compact), and lab and upstream both hand the number to the engine.
    it("accepts any finite width, truncated and clamped as JSON.stringify does", () => {
      for (const width of [-100, -2, -1.5, -1, -0.5]) {
        assertSuccess(text(width), '{"a":[1]}');
      }
      assertSuccess(text(1.5), '{\n "a": [\n  1\n ]\n}');
      assertSuccess(text(2.9), '{\n  "a": [\n    1\n  ]\n}');
      const ten = `{\n${" ".repeat(10)}"a": [\n${" ".repeat(20)}1\n${" ".repeat(10)}]\n}`;
      for (const width of [10, 11, 100]) {
        assertSuccess(text(width), ten);
      }
      assertSuccess(Jsonc.stringifyResult(value, JsoncStringifyOptions.make({ tabSize: -1, insertSpaces: false })), '{\n\t"a": [\n\t\t1\n\t]\n}');
      assertSuccess(Result.map(decodeOptions({ tabSize: -1.5 }), (options) => options.tabSize), -1.5);
    });

    // Port deviation (law: the schemaNumber Effect rule): upstream types
    // `tabSize` as Schema.Number, so NaN and the infinities decode and
    // JSON.stringify reads them as 0, 10 and 0; the lab's S.Finite rejects them.
    it("rejects a non-finite width", () => {
      for (const tabSize of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        assertFailure(Result.mapError(decodeOptions({ tabSize }), (error) => error._tag), "SchemaError");
        assert.throws(() => JsoncStringifyOptions.make({ tabSize }));
      }
    });
  });
});
