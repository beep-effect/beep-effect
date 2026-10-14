import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { RequoteMode, RequoteScalarInput, requoteScalarText } from "../../../effected/yaml/internal/requote.ts";

describe("Requote structural schema regressions", () => {
  it.effect.prop("structural payloads round-trip through their defining schema", [Arbitrary.schema(RequoteScalarInput)], ([input]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(RequoteScalarInput)(input);
    assert.deepStrictEqual(yield* S.decodeEffect(RequoteScalarInput)(encoded), input);
  }), { arbitrary: fcRuns(100) });

  it.effect.prop("quote policies round-trip through their defining vocabulary", [Arbitrary.schema(RequoteMode)], ([mode]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(RequoteMode)(mode);
    assert.strictEqual(yield* S.decodeEffect(RequoteMode)(encoded), mode);
  }), { arbitrary: fcRuns(100) });

  it.effect("plain inputs retain absent and explicit undefined metadata compatibility", () => Effect.sync(() => {
    const scalar: RequoteScalarInput = { value: "hello", style: "single-quoted", offset: 0, length: 7 };
    for (const input of [scalar, { ...scalar, tag: undefined, anchor: undefined }]) {
      assert.isTrue(S.is(RequoteScalarInput)(input));
      assert.strictEqual(requoteScalarText("'hello'", input, '"', "conservative"), '"hello"');
      assert.strictEqual(requoteScalarText("'hello'", input, '"', "escaping"), '"hello"');
    }
    assert.isTrue(S.is(RequoteScalarInput)({ ...scalar, value: { arbitrary: [1, "x"] } }));
    for (const input of [{ ...scalar, tag: "!str" }, { ...scalar, anchor: "ref" }]) {
      assert.isTrue(S.is(RequoteScalarInput)(input));
      assert.strictEqual(requoteScalarText("'hello'", input, '"', "escaping"), undefined);
    }
  }));

  it.effect("finite span fields and the shared scalar style reject invalid payloads", () => Effect.sync(() => {
    const scalar: RequoteScalarInput = { value: "hello", style: "plain", offset: 0, length: 5 };
    for (const value of [NaN, Infinity, -Infinity]) {
      assert.isFalse(S.is(RequoteScalarInput)({ ...scalar, offset: value }));
      assert.isFalse(S.is(RequoteScalarInput)({ ...scalar, length: value }));
    }
    assert.isFalse(S.is(RequoteScalarInput)({ ...scalar, style: "unknown" }));
    assert.isFalse(S.is(RequoteScalarInput)({ ...scalar, tag: null }));
  }));

  it.effect("the named policy vocabulary keeps both conversion modes", () => Effect.sync(() => {
    assert.deepStrictEqual(RequoteMode.literals, ["conservative", "escaping"]);
    assert.isTrue(S.is(RequoteMode)("conservative"));
    assert.isTrue(S.is(RequoteMode)("escaping"));
    assert.isFalse(S.is(RequoteMode)("unknown"));
    const scalar: RequoteScalarInput = { value: "it's", style: "single-quoted", offset: 0, length: 7 };
    assert.strictEqual(requoteScalarText("'it''s'", scalar, '"', "conservative"), undefined);
    assert.strictEqual(requoteScalarText("'it''s'", scalar, '"', "escaping"), '"it\'s"');
  }));
});
