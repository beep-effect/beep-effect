import { it } from "@beep/test-runner";
import { O } from "@beep/utils";
import { describe, expect, expectTypeOf } from "@effect/vitest";
import { pipe } from "effect/Function";

describe("@beep/utils O.propFromNullishOr", () => {
  it("supports data-first and data-last calls", () => {
    interface Person {
      readonly age?: number | null | undefined;
      readonly name: string;
    }

    const person: Person = { name: "beep", age: 42 };
    const dataFirst = O.propFromNullishOr(person, "age");
    const dataLast = pipe(person, O.propFromNullishOr("age"));

    expect(O.getOrNull(dataFirst)).toBe(42);
    expect(O.getOrNull(dataLast)).toBe(42);
    expectTypeOf(dataFirst).toEqualTypeOf<O.Option<number>>();
    expectTypeOf(dataLast).toEqualTypeOf<O.Option<number>>();
  });

  it("returns none for nullish and missing values", () => {
    const source = {
      nullable: null as number | null,
      maybeUndefined: undefined as number | undefined,
    };
    const missing = {} as { readonly nested?: { readonly age?: number | null } };

    expect(O.isNone(O.propFromNullishOr(source, "nullable"))).toBe(true);
    expect(O.isNone(O.propFromNullishOr(source, "maybeUndefined"))).toBe(true);
    expect(O.isNone(O.propFromNullishOr(missing, "nested.age"))).toBe(true);
  });

  it("supports tuple paths and removes nullish from nested value types", () => {
    const source: {
      readonly profile?: {
        readonly age?: number | null;
      };
    } = {
      profile: { age: 30 },
    };

    const age = pipe(source, O.propFromNullishOr(["profile", "age"] as const));

    expect(O.getOrNull(age)).toBe(30);
    expectTypeOf(age).toEqualTypeOf<O.Option<number>>();
  });
});

describe("@beep/utils O.getSomesStruct", () => {
  it("omits None fields and unwraps Some fields", () => {
    const result = O.getSomesStruct({
      id: O.some(1),
      name: O.none<string>(),
    });

    expect(result).toEqual({ id: 1 });
    expect("name" in result).toBe(false);
    expectTypeOf(result).toEqualTypeOf<{
      id?: number;
      name?: string;
    }>();
  });

  it("preserves explicitly present undefined values", () => {
    const result = O.getSomesStruct({
      value: O.some(undefined),
    });

    expect(result).toEqual({ value: undefined });
    expect("value" in result).toBe(true);
    expectTypeOf(result).toEqualTypeOf<{
      value?: undefined;
    }>();
  });
});
