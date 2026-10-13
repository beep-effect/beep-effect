import { assert, describe, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Comparator, InvalidComparatorError } from "../../effected/semver/Comparator.ts";

describe("Comparator coverage boundaries", () => {
  it.effect("reports position-free errors and rejects invalid codec input", () => Effect.gen(function* () {
    assert.strictEqual(InvalidComparatorError.make({ input: "bad" }).message, 'Invalid comparator: "bad"');
    assertFailure(yield* Effect.result(S.decodeEffect(Comparator.FromString)(">=bad").pipe(Effect.mapError((error) => error._tag))), "SchemaError");
    const comparator = yield* Comparator.parse(">=1.2.3");
    assert.strictEqual(inspect(comparator), ">=1.2.3");
  }));
});

const inspect = (value: unknown): unknown => {
  const key = Symbol.for("nodejs.util.inspect.custom");
  if (P.hasProperty(value, key) && P.isFunction(value[key])) return value[key].call(value);
  return assert.fail("Expected a custom inspection method");
};
