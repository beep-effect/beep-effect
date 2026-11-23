import { Toml, TomlParseError, TomlStringifyError } from "@beep/toml/Toml";
import { TomlDocument } from "@beep/toml/TomlDocument";
import { TomlFormat, TomlModificationError } from "@beep/toml/TomlFormat";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";
import { expectFailure } from "./expectFailure.ts";

// decision: hostile-elapsed-bound
const ELAPSED_BOUND_MS = 30_000;

const parseError = Effect.fn("parseError")(function* (text: string) {
  const error = yield* expectFailure(Toml.parse(text));
  assert.instanceOf(error, TomlParseError);
  return error;
});

const codeOf = (error: TomlParseError): string | undefined => error.diagnostics[0]?.code;

const assertPrototypeUnpolluted = (): void => {
  const probe: Record<string, unknown> = {};
  assert.strictEqual(probe.x, undefined);
  assert.notInclude(Reflect.ownKeys(Object.prototype), "x");
  assert.isFalse("x" in {});
};

const checkedTable = (value: unknown): Record<string, unknown> => {
  if (!P.isObject(value)) {
    assert.fail("expected a TOML table");
  }
  return value;
};

describe("hostile input fails typed or succeeds benign; a defect, stack overflow or hang is an engine bug", () => {
  describe("parse — depth bombs", () => {
    it.effect("10_000 unbalanced open brackets fail typed, never a stack overflow", () =>
      Effect.gen(function* () {
        const error = yield* parseError(`a = ${Str.repeat(10_000)("[")}`);
        assert.strictEqual(codeOf(error), "NestingDepthExceeded");
      })
    );

    it.effect("10_000 nested inline tables fail typed", () =>
      Effect.gen(function* () {
        const error = yield* parseError(`a = ${Str.repeat(10_000)("{b = ")}`);
        assert.strictEqual(codeOf(error), "NestingDepthExceeded");
      })
    );

    it.effect("mixed array/inline-table nesting counts against one combined depth", () =>
      Effect.gen(function* () {
        const error = yield* parseError(`a = ${Str.repeat(2_000)("[{a = [")}`);
        assert.strictEqual(codeOf(error), "NestingDepthExceeded");
      })
    );
  });

  describe("stringify — depth bombs", () => {
    it.effect("a 10_000-deep nested OBJECT trips the emitTable guard typed", () =>
      Effect.gen(function* () {
        let value: Record<string, unknown> = {};
        for (let i = 0; i < 10_000; i++) {
          value = { a: value };
        }
        const error = yield* Effect.flip(Toml.stringify(value));
        assert.instanceOf(error, TomlStringifyError);
        assert.strictEqual(error.diagnostic.code, "NestingDepthExceeded");
      })
    );

    it.effect("a 10_000-deep nested ARRAY trips the renderInline guard typed", () =>
      Effect.gen(function* () {
        let value: unknown = 1;
        for (let i = 0; i < 10_000; i++) {
          value = [value];
        }
        const error = yield* Effect.flip(Toml.stringify({ a: value }));
        assert.instanceOf(error, TomlStringifyError);
        assert.strictEqual(error.diagnostic.code, "NestingDepthExceeded");
      })
    );

    it.effect("256 containers with a non-empty scalar leaf round-trip because only container descent counts", () =>
      Effect.gen(function* () {
        const doc = `a = ${Str.repeat(256)("[")}1${Str.repeat(256)("]")}\n`;
        const value = yield* Toml.parse(doc);
        const text = yield* Toml.stringify(value);
        const back = yield* Toml.parse(text);
        assert.deepStrictEqual(back, value);
      })
    );
  });

  describe("stringify — cycles", () => {
    it.effect("a 3-hop cycle across tables fails typed as CircularReference", () =>
      Effect.gen(function* () {
        const a: Record<string, unknown> = {};
        const b: Record<string, unknown> = {};
        const c: Record<string, unknown> = {};
        a.b = b;
        b.c = c;
        c.a = a;
        const error = yield* Effect.flip(Toml.stringify(a));
        assert.instanceOf(error, TomlStringifyError);
        assert.strictEqual(error.diagnostic.code, "CircularReference");
      })
    );

    it.effect("a 3-hop cycle through inline arrays fails typed as CircularReference", () =>
      Effect.gen(function* () {
        const inner: Array<unknown> = [];
        const middle: Array<unknown> = [inner, 1];
        const outer: Array<unknown> = [middle];
        inner.push(outer);
        const error = yield* Effect.flip(Toml.stringify({ a: outer }));
        assert.instanceOf(error, TomlStringifyError);
        assert.strictEqual(error.diagnostic.code, "CircularReference");
      })
    );
  });

  describe("defect passthrough", () => {
    it.effect("stringify lets a throwing getter die instead of masking it as TomlStringifyError", () =>
      Effect.gen(function* () {
        const evil = {
          get boom(): number {
            throw new Error("boom");
          },
        };
        const exit = yield* Effect.exit(Toml.stringify(evil));
        if (!Exit.isFailure(exit)) {
          return assert.fail("expected the getter throw to surface as a failure exit");
        }
        assert.isFalse(A.some(exit.cause.reasons, Cause.isFailReason), "must not surface as a typed Fail");
        const die = O.getOrUndefined(A.findFirst(exit.cause.reasons, Cause.isDieReason));
        if (die === undefined) {
          return assert.fail("expected a Die reason carrying the getter's error");
        }
        assert.instanceOf(die.defect, Error);
        assert.notInstanceOf(die.defect, TomlStringifyError);
        const defect = die.defect;
        if (!(defect instanceof Error)) {
          assert.fail("expected the getter error");
        }
        assert.strictEqual(defect.message, "boom");
      })
    );

    it.effect("parse lets a non-engine TypeError die instead of masking it as TomlParseError", () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(Toml.parse(deliberatelyInvalid<string>(42)));
        if (!Exit.isFailure(exit)) {
          return assert.fail("expected the misuse to surface as a failure exit");
        }
        assert.isFalse(A.some(exit.cause.reasons, Cause.isFailReason), "must not surface as a typed Fail");
        const die = O.getOrUndefined(A.findFirst(exit.cause.reasons, Cause.isDieReason));
        if (die === undefined) {
          return assert.fail("expected a Die reason carrying the TypeError");
        }
        assert.instanceOf(die.defect, TypeError);
        assert.notInstanceOf(die.defect, TomlParseError);
      })
    );
  });

  describe("facade surfaces on deep input", () => {
    const bomb = `a = ${Str.repeat(10_000)("[")}`;

    it.effect("TomlDocument.parse fails typed on the 10_000-bracket bomb", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(TomlDocument.parse(bomb));
        assert.instanceOf(error, TomlParseError);
        assert.strictEqual(codeOf(error), "NestingDepthExceeded");
      })
    );

    it.effect("TomlFormat.modify fails typed on the 10_000-bracket bomb", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(TomlFormat.modify(bomb, ["a"], 1));
        assert.instanceOf(error, TomlParseError);
        if (!S.is(TomlParseError)(error)) {
          assert.fail("expected a TomlParseError");
        }
        assert.strictEqual(codeOf(error), "NestingDepthExceeded");
      })
    );

    it("TomlFormat.format yields no edits on the bomb instead of overflowing", () => {
      assert.deepStrictEqual(TomlFormat.format(bomb), []);
      assert.strictEqual(TomlFormat.formatToString(bomb), bomb);
    });

    it.effect("the TomlFromString schema surfaces the bomb as a SchemaError, never a defect", () =>
      Effect.gen(function* () {
        const error = yield* expectFailure(S.decodeEffect(Toml.TomlFromString)(bomb));
        assert.strictEqual(error._tag, "SchemaError");
        assert.include(String(error), "NestingDepthExceeded");
      })
    );
  });

  describe("modify — path depth", () => {
    it.effect(
      "a 100_000-segment path fails typed promptly, before any parse work",
      () =>
        Effect.gen(function* () {
          const path = Array.from({ length: 100_000 }, (_, i) => `k${i}`);
          const started = performance.now();
          const error = yield* Effect.flip(TomlFormat.modify("a = 1\n", path, 2));
          const elapsed = performance.now() - started;
          assert.instanceOf(error, TomlModificationError);
          if (!S.is(TomlModificationError)(error)) {
            assert.fail("expected a TomlModificationError");
          }
          assert.strictEqual(error.diagnostic.code, "NestingDepthExceeded");
          assert.isBelow(elapsed, ELAPSED_BOUND_MS);
        }),
      ELAPSED_BOUND_MS
    );
  });

  describe("scale with the elapsed bound also used as the test timeout for slow CI", () => {
    it.effect(
      "a 2MB document of 50_000 key-values parses under the timeout",
      () =>
        Effect.gen(function* () {
          const lines = Array.from(
            { length: 50_000 },
            (_, i) => `k${Str.padStart(5, "0")(String(i))} = "${Str.repeat(28)("x")}"`
          );
          const doc = `${A.join(lines, "\n")}\n`;
          assert.isAtLeast(doc.length, 2_000_000);
          const started = performance.now();
          const parsed1 = yield* Toml.parse(doc);
          const value = checkedTable(parsed1);
          const elapsed = performance.now() - started;
          assert.strictEqual(R.size(value), 50_000);
          assert.strictEqual(value.k49999, Str.repeat(28)("x"));
          assert.isBelow(elapsed, ELAPSED_BOUND_MS);
        }),
      ELAPSED_BOUND_MS
    );

    it.effect(
      "a 1MB single-line string parses",
      () =>
        Effect.gen(function* () {
          const payload = Str.repeat(1_048_576)("x");
          const started = performance.now();
          const parsed2 = yield* Toml.parse(`s = "${payload}"\n`);
          const value = checkedTable(parsed2);
          const elapsed = performance.now() - started;
          assert.strictEqual(value.s, payload);
          assert.isBelow(elapsed, ELAPSED_BOUND_MS);
        }),
      ELAPSED_BOUND_MS
    );

    it.effect(
      "a 1MB unterminated string fails typed promptly — no quadratic scan",
      () =>
        Effect.gen(function* () {
          const started = performance.now();
          const error = yield* parseError(`s = "${Str.repeat(1_048_576)("x")}`);
          const elapsed = performance.now() - started;
          assert.strictEqual(codeOf(error), "UnterminatedString");
          assert.isBelow(elapsed, ELAPSED_BOUND_MS);
        }),
      ELAPSED_BOUND_MS
    );
  });

  describe("prototype pollution", () => {
    it.effect('"__proto__ = 1" lands as an own data property', () =>
      Effect.gen(function* () {
        const parsed3 = yield* Toml.parse("__proto__ = 1\n");
        const value = checkedTable(parsed3);
        assert.isTrue(R.has(value, "__proto__"));
        assert.strictEqual(Object.getOwnPropertyDescriptor(value, "__proto__")?.value, 1);
        assert.strictEqual(Object.getPrototypeOf(value), Object.prototype);
        assertPrototypeUnpolluted();
      })
    );

    it.effect('"[__proto__]" defines an own table, not a prototype', () =>
      Effect.gen(function* () {
        const parsed4 = yield* Toml.parse("[__proto__]\nx = 1\n");
        const value = checkedTable(parsed4);
        assert.isTrue(R.has(value, "__proto__"));
        const table = checkedTable(Object.getOwnPropertyDescriptor(value, "__proto__")?.value);
        assert.isTrue(R.has(table, "x"));
        assert.strictEqual(table.x, 1);
        assert.strictEqual(Object.getPrototypeOf(value), Object.prototype);
        assertPrototypeUnpolluted();
      })
    );

    it.effect('"[[__proto__]]" defines an own array of tables', () =>
      Effect.gen(function* () {
        const parsed5 = yield* Toml.parse("[[__proto__]]\nx = 1\n");
        const value = checkedTable(parsed5);
        assert.isTrue(R.has(value, "__proto__"));
        const array: unknown = Object.getOwnPropertyDescriptor(value, "__proto__")?.value;
        if (!A.isArray(array)) {
          assert.fail("expected an array of tables");
        }
        assert.isTrue(A.isArray(array));
        assert.strictEqual(array.length, 1);
        const first = array[0];
        assert.isDefined(first);
        if (!P.isObject(first)) {
          assert.fail("expected the first array element to be a table");
        }
        assert.isTrue(R.has(first, "x"));
        assert.strictEqual(first.x, 1);
        assertPrototypeUnpolluted();
      })
    );

    it.effect('"constructor.prototype.x = 1" builds own tables all the way down', () =>
      Effect.gen(function* () {
        const parsed6 = yield* Toml.parse("constructor.prototype.x = 1\n");
        const value = checkedTable(parsed6);
        assert.isTrue(R.has(value, "constructor"));
        const constructorTable = checkedTable(value.constructor);
        assert.notStrictEqual<unknown>(constructorTable, Object);
        assert.strictEqual(Object.getPrototypeOf(constructorTable), Object.prototype);
        assert.isTrue(R.has(constructorTable, "prototype"));
        const prototypeTable = checkedTable(constructorTable.prototype);
        assert.isTrue(R.has(prototypeTable, "x"));
        assert.strictEqual(prototypeTable.x, 1);
        assertPrototypeUnpolluted();
      })
    );
  });

  describe("control characters and encoding through the public parse surface, not only the scanner", () => {
    it.effect("NUL in the document body fails typed", () =>
      Effect.gen(function* () {
        const error = yield* parseError("a = 1\u0000\n");
        assert.strictEqual(codeOf(error), "InvalidCharacter");
      })
    );

    it.effect("a lone carriage return fails typed", () =>
      Effect.gen(function* () {
        const error = yield* parseError("a = 1\rb = 2\n");
        assert.strictEqual(codeOf(error), "BareCarriageReturn");
      })
    );

    it.effect("a control character in a comment fails typed", () =>
      Effect.gen(function* () {
        const error = yield* parseError("# hi\u0001\n");
        assert.strictEqual(codeOf(error), "ControlCharacterInComment");
      })
    );

    it.effect("a control character in a basic string fails typed", () =>
      Effect.gen(function* () {
        const error = yield* parseError('a = "x\u0001y"\n');
        assert.strictEqual(codeOf(error), "ControlCharacterInString");
      })
    );

    it.effect("a control character in a literal string fails typed", () =>
      Effect.gen(function* () {
        const error = yield* parseError("a = 'x\u0001y'\n");
        assert.strictEqual(codeOf(error), "ControlCharacterInString");
      })
    );

    it.effect("an unpaired surrogate escape fails typed", () =>
      Effect.gen(function* () {
        const error = yield* parseError('a = "\\uD800"\n');
        assert.strictEqual(codeOf(error), "InvalidUnicodeEscape");
      })
    );

    it.effect("an escape beyond U+10FFFF fails typed", () =>
      Effect.gen(function* () {
        const error = yield* parseError('a = "\\U00110000"\n');
        assert.strictEqual(codeOf(error), "InvalidUnicodeEscape");
      })
    );

    it.effect("a raw DEL character in a string fails typed", () =>
      Effect.gen(function* () {
        const error = yield* parseError('a = "x\u007Fy"\n');
        assert.strictEqual(codeOf(error), "ControlCharacterInString");
      })
    );
  });

  describe("numeric abuse", () => {
    it.effect("int64 overflow fails typed as IntegerOutOfRange", () =>
      Effect.gen(function* () {
        const over = yield* parseError("a = 9223372036854775808\n");
        assert.strictEqual(codeOf(over), "IntegerOutOfRange");
        const under = yield* parseError("a = -9223372036854775809\n");
        assert.strictEqual(codeOf(under), "IntegerOutOfRange");
      })
    );

    it.effect("a 20-digit hex integer fails typed as IntegerOutOfRange", () =>
      Effect.gen(function* () {
        const error = yield* parseError(`a = 0x${Str.repeat(20)("F")}\n`);
        assert.strictEqual(codeOf(error), "IntegerOutOfRange");
      })
    );

    it.effect("1e400 saturates to Infinity — floats overflow legally per spec", () =>
      Effect.gen(function* () {
        const parsed7 = yield* Toml.parse("a = 1e400\n");
        const value = checkedTable(parsed7);
        assert.strictEqual(value.a, Number.POSITIVE_INFINITY);
      })
    );

    it.effect("malformed underscore spellings fail typed", () =>
      Effect.gen(function* () {
        const doubled = yield* parseError("a = 0__0\n");
        assert.strictEqual(codeOf(doubled), "InvalidNumber");
        const leading = yield* parseError("a = +_1\n");
        assert.strictEqual(codeOf(leading), "InvalidValue");
      })
    );
  });

  describe("datetime abuse", () => {
    it.effect("impossible calendar dates fail typed as InvalidDateTime", () =>
      Effect.gen(function* () {
        for (const token of ["0000-00-00", "2021-13-01", "2021-01-32"]) {
          const error = yield* parseError(`a = ${token}\n`);
          assert.strictEqual(codeOf(error), "InvalidDateTime", token);
        }
      })
    );

    it.effect("hour 24 fails typed as InvalidDateTime", () =>
      Effect.gen(function* () {
        const error = yield* parseError("a = 24:00:00\n");
        assert.strictEqual(codeOf(error), "InvalidDateTime");
      })
    );
  });

  describe("header abuse", () => {
    it.effect("10_000 distinct headers parse fine", () =>
      Effect.gen(function* () {
        const doc = `${A.join(
          Array.from({ length: 10_000 }, (_, i) => `[t${i}]`),
          "\n"
        )}\n`;
        const parsed8 = yield* Toml.parse(doc);
        const value = checkedTable(parsed8);
        assert.strictEqual(R.size(value), 10_000);
        assert.deepStrictEqual(value.t9999, {});
      })
    );

    it.effect("a 5_001-segment dotted header is DATA — no depth guard, no overflow", () =>
      Effect.gen(function* () {
        const segments = 5_001;
        const doc = `[${A.join(
          Array.from({ length: segments }, () => "a"),
          "."
        )}]\n`;
        const parsed9 = yield* Toml.parse(doc);
        let current = checkedTable(parsed9);
        for (let i = 0; i < segments; i++) {
          assert.isTrue(R.has(current, "a"), `own property missing at depth ${i}`);
          current = checkedTable(current.a);
        }
        assert.deepStrictEqual(R.keys(current), []);
      })
    );

    it.effect("a 5_001-segment dotted KEY is also data-driven", () =>
      Effect.gen(function* () {
        const segments = 5_001;
        const doc = `${A.join(
          Array.from({ length: segments }, () => "a"),
          "."
        )} = 1\n`;
        const parsed10 = yield* Toml.parse(doc);
        let current = checkedTable(parsed10);
        for (let i = 0; i < segments - 1; i++) {
          assert.isTrue(R.has(current, "a"), `own property missing at depth ${i}`);
          current = checkedTable(current.a);
        }
        assert.strictEqual(current.a, 1);
      })
    );
  });
});
