import { makeCreateChalk } from "@beep/chalk/internal/ChalkRuntime";
import { describe, expect, it } from "@effect/vitest";
import { identity } from "effect";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const capture = (evaluate: () => unknown): unknown =>
  Result.match(Result.try(evaluate), {
    onFailure: identity,
    onSuccess: identity,
  });

const triggerMissingBuilderMetadata = (): unknown => {
  const builder = makeCreateChalk(false)();
  const prototype = Reflect.getPrototypeOf(builder);
  const level = P.isObjectKeyword(prototype) ? Reflect.getOwnPropertyDescriptor(prototype, "level") : undefined;
  const getter = P.isObject(level) ? Reflect.get(level, "get") : undefined;
  return P.isFunction(getter) ? Reflect.apply(getter, () => "", []) : getter;
};

describe("@beep/chalk tagged-error declared equivalence", () => {
  it("compares the private missing-builder-metadata error by declared message", () => {
    const first = capture(triggerMissingBuilderMetadata);
    const second = capture(triggerMissingBuilderMetadata);
    const schema = P.isObject(first) ? Reflect.get(first, "constructor") : first;

    expect(S.isSchema(schema)).toBe(true);
    if (S.isSchema(schema)) {
      const make = Reflect.get(schema, "make");
      const different = P.isFunction(make)
        ? Reflect.apply(make, schema, [{ message: "Different Chalk metadata failure." }])
        : make;
      const same = S.toEquivalence(schema);

      expect(same(first, second)).toBe(true);
      expect(same(first, different)).toBe(false);
    }
  });
});
