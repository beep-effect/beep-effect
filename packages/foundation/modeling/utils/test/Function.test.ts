import { it } from "@beep/test-runner";
import * as Fn from "@beep/utils/Function";
import { describe, expect } from "@effect/vitest";

describe("@beep/utils Function.tuple", () => {
  it("preserves the provided elements in order", () => {
    expect(Fn.tuple("beep", 5, true)).toEqual(["beep", 5, true]);
  });
});

describe("@beep/utils Function.tupledCurry", () => {
  it("applies tuple elements to a curried function", () => {
    const join =
      (left: string) =>
      (right: string): string =>
        `${left}:${right}`;

    expect(Fn.tupledCurry(join)(["beep", "effect"])).toBe("beep:effect");
  });
});

describe("@beep/utils Function.reverseCurry", () => {
  it("reverses a two-argument curried function", () => {
    const append =
      (suffix: string) =>
      (value: string): string =>
        `${value}${suffix}`;

    expect(Fn.reverseCurry(append)("beep")("-effect")).toBe("beep-effect");
  });
});

describe("@beep/utils Function.curry", () => {
  it("curries a two-argument function", () => {
    const divide = (left: number, right: number): number => left / right;

    expect(Fn.curry(divide)(12)(3)).toBe(4);
  });
});

describe("@beep/utils Function.uncurry", () => {
  it("uncurries a two-argument curried function", () => {
    const join =
      (left: string) =>
      (right: string): string =>
        `${left}:${right}`;

    expect(Fn.uncurry(join)("beep", "effect")).toBe("beep:effect");
  });
});

describe("@beep/utils Function.lazy", () => {
  it("evaluates the thunk once and returns the cached value", () => {
    let calls = 0;
    const readOnce = Fn.lazy(() => {
      calls += 1;
      return { calls };
    });

    const first = readOnce();
    const second = readOnce();

    expect(first).toBe(second);
    expect(first).toEqual({ calls: 1 });
    expect(calls).toBe(1);
  });

  it("caches undefined values", () => {
    let calls = 0;
    const readOnce = Fn.lazy((): undefined => {
      calls += 1;
      return undefined;
    });

    expect(readOnce()).toBeUndefined();
    expect(readOnce()).toBeUndefined();
    expect(calls).toBe(1);
  });
});
