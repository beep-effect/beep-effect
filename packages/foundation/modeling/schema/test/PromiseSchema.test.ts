import { isPromise, PromiseSchema } from "@beep/schema/PromiseSchema";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("PromiseSchema", () => {
  it("accepts native Promise instances", () => {
    const value = globalThis.Promise.resolve(1);

    expect(isPromise(value)).toBe(true);
    expect(S.decodeSync(PromiseSchema)(value)).toBe(value);
  });

  it("accepts Promise subclasses", () => {
    class DerivedPromise<A> extends globalThis.Promise<A> {}

    const value = DerivedPromise.resolve(1);

    expect(isPromise(value)).toBe(true);
    expect(S.decodeSync(PromiseSchema)(value)).toBe(value);
  });

  it("rejects promise-like objects that are not native promises", () => {
    const thenable = {
      catch: () => thenable,
      finally: () => thenable,
      // oxlint-disable-next-line unicorn/no-thenable -- this test intentionally models a thenable impostor.
      then: () => thenable,
    };

    expect(isPromise(thenable)).toBe(false);
    expect(() => S.decodeUnknownSync(PromiseSchema)(thenable)).toThrow(
      /Expected @beep\/schema\/PromiseSchema\/PromiseSchema/
    );
  });

  it("rejects non-promise values", () => {
    expect(isPromise("nope")).toBe(false);
    expect(() => S.decodeUnknownSync(PromiseSchema)("nope")).toThrow(
      /Expected @beep\/schema\/PromiseSchema\/PromiseSchema/
    );
  });
});
