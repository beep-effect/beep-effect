import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Subject from "../../effected/markdown/MarkdownEdit.ts";
const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: decode(encode(x)) equals x and never fails`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};

describe("MarkdownEdit schema property floor", () => {
  roundTrips("MarkdownRange", Subject.MarkdownRange);
  roundTrips("MarkdownEdit", Subject.MarkdownEdit);
});

describe("MarkdownEdit splice fidelity", () => {
  it.effect.prop("disjoint replacements preserve prefix, middle and suffix regardless of edit order", [Arbitrary.schema(S.String), Arbitrary.schema(S.String), Arbitrary.schema(S.String)], ([prefix, middle, suffix]) => Effect.gen(function* () {
    const source = `${prefix}X${middle}Y${suffix}`;
    const first = Subject.MarkdownEdit.make({ offset: prefix.length, length: 1, content: "first" });
    const second = Subject.MarkdownEdit.make({ offset: prefix.length + 1 + middle.length, length: 1, content: "second" });
    const edits = [first, second];
    const expected = `${prefix}first${middle}second${suffix}`;
    assert.strictEqual(Subject.MarkdownEdit.applyAll(source, edits), expected);
    assert.strictEqual(Subject.MarkdownEdit.applyAll(source, [second, first]), expected);
    assert.deepStrictEqual(edits, [first, second]);
    yield* Effect.void;
  }), runs);
});
