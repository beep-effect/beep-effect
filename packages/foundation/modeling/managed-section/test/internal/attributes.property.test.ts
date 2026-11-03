import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { AttributeName, AttributeValue, parseAttributeRun } from "@beep/managed-section/internal/attributes";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name}: decode(encode(x)) equals x and never fails`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("exported schema round trips", () => {
  roundTrips("AttributeName", AttributeName);
  roundTrips("AttributeValue", AttributeValue);
});

const pairs = AttributeValue.pipe(S.Array, Arbitrary.schema);
const stringify = (attributes: Record<string, string>): string =>
  A.join(
    A.map(R.toEntries(attributes), ([name, value]) => `${name}="${value}"`),
    " "
  );

it.effect.prop(
  "attribute parsing retains values and insertion order through canonical formatting",
  [pairs],
  ([values]) =>
    Effect.sync(() => {
      const expected = R.fromEntries(A.map(values, (value, index): readonly [string, string] => [`a${index}`, value]));
      const text = stringify(expected);
      const parsed = O.getOrUndefined(parseAttributeRun(text));
      if (values.length === 0) {
        assert.strictEqual(parsed, undefined);
        return;
      }
      assert.deepStrictEqual(parsed, expected);
      if (parsed !== undefined) {
        const formatted = stringify(parsed);
        assert.strictEqual(stringify(O.getOrElse(parseAttributeRun(formatted), () => ({}))), formatted);
        assert.deepStrictEqual(O.getOrUndefined(parseAttributeRun(formatted)), parsed);
        assert.deepStrictEqual(R.toEntries(parsed), R.toEntries(expected));
      }
    }),
  runs
);
