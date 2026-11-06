import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { RequoteMode, RequoteScalarInput, requoteScalarText } from "@beep/yaml/internal/requote";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

describe("Requote structural schema regressions", () => {
  it.effect.prop(
    "structural payloads round-trip through their defining schema",
    [Arbitrary.schema(RequoteScalarInput)],
    ([input]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(RequoteScalarInput)(input);
        const value1 = yield* S.decodeEffect(RequoteScalarInput)(encoded);
        assert.deepStrictEqual(value1, input);
      }),
    { arbitrary: fcRuns(100) }
  );

  it.effect.prop(
    "quote policies round-trip through their defining vocabulary",
    [Arbitrary.schema(RequoteMode)],
    ([mode]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(RequoteMode)(mode);
        const value2 = yield* S.decodeEffect(RequoteMode)(encoded);
        assert.strictEqual(value2, mode);
      }),
    { arbitrary: fcRuns(100) }
  );

  it.effect("plain inputs retain absent metadata and reject explicit undefined metadata", () =>
    Effect.sync(() => {
      const scalar: RequoteScalarInput = RequoteScalarInput.make({
        value: "hello",
        style: "single-quoted",
        offset: 0,
        length: 7,
      });
      assert.isTrue(S.is(RequoteScalarInput)(scalar));
      assert.strictEqual(O.getOrUndefined(requoteScalarText("'hello'", scalar, '"', "conservative")), '"hello"');
      assert.strictEqual(O.getOrUndefined(requoteScalarText("'hello'", scalar, '"', "escaping")), '"hello"');
      assert.isFalse(S.is(RequoteScalarInput)({ ...scalar, tag: undefined, anchor: undefined }));
      assert.isTrue(S.is(RequoteScalarInput)({ ...scalar, value: { arbitrary: [1, "x"] } }));
      for (const input of [
        { ...scalar, tag: "!str" },
        { ...scalar, anchor: "ref" },
      ]) {
        assert.isTrue(S.is(RequoteScalarInput)(input));
        assert.strictEqual(O.getOrUndefined(requoteScalarText("'hello'", input, '"', "escaping")), undefined);
      }
    })
  );

  it.effect("finite span fields and the shared scalar style reject invalid payloads", () =>
    Effect.sync(() => {
      const scalar: RequoteScalarInput = RequoteScalarInput.make({
        value: "hello",
        style: "plain",
        offset: 0,
        length: 5,
      });
      for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        assert.isFalse(S.is(RequoteScalarInput)({ ...scalar, offset: value }));
        assert.isFalse(S.is(RequoteScalarInput)({ ...scalar, length: value }));
      }
      assert.isFalse(S.is(RequoteScalarInput)({ ...scalar, style: "unknown" }));
      assert.isFalse(S.is(RequoteScalarInput)({ ...scalar, tag: null }));
    })
  );

  it.effect("the named policy vocabulary keeps both conversion modes", () =>
    Effect.sync(() => {
      assert.deepStrictEqual(RequoteMode.literals, ["conservative", "escaping"]);
      assert.isTrue(S.is(RequoteMode)("conservative"));
      assert.isTrue(S.is(RequoteMode)("escaping"));
      assert.isFalse(S.is(RequoteMode)("unknown"));
      const scalar: RequoteScalarInput = RequoteScalarInput.make({
        value: "it's",
        style: "single-quoted",
        offset: 0,
        length: 7,
      });
      assert.strictEqual(O.getOrUndefined(requoteScalarText("'it''s'", scalar, '"', "conservative")), undefined);
      assert.strictEqual(O.getOrUndefined(requoteScalarText("'it''s'", scalar, '"', "escaping")), '"it\'s"');
    })
  );
});
