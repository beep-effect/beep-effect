import { isPromise, PromiseSchema } from "@beep/schema/PromiseSchema";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

// Promise identity is the data under test, not async work for the Effect runtime to await.
const PromisePayload = S.Struct({ value: PromiseSchema });
const decodePromisePayload = S.decodeEffect(PromisePayload);
const decodeUnknownPromisePayload = S.decodeUnknownEffect(PromisePayload);

describe("PromiseSchema", () => {
  it.effect(
    "accepts native Promise instances",
    Effect.fnUntraced(function* () {
      const value = globalThis.Promise.resolve(1);

      expect(isPromise(value)).toBe(true);
      expect((yield* decodePromisePayload({ value })).value).toBe(value);
    })
  );

  it.effect(
    "accepts Promise subclasses",
    Effect.fnUntraced(function* () {
      class DerivedPromise<A> extends globalThis.Promise<A> {}

      const value = DerivedPromise.resolve(1);

      expect(isPromise(value)).toBe(true);
      expect((yield* decodePromisePayload({ value })).value).toBe(value);
    })
  );

  it.effect(
    "rejects promise-like objects that are not native promises",
    Effect.fnUntraced(function* () {
      const thenable = {
        catch: () => thenable,
        finally: () => thenable,
        // oxlint-disable-next-line unicorn/no-thenable -- this test intentionally models a thenable impostor.
        then: () => thenable,
      };

      expect(isPromise(thenable)).toBe(false);
      const failure1 = yield* Effect.result(decodeUnknownPromisePayload({ value: thenable }));
      expect(Result.isFailure(failure1)).toBe(true);
      if (Result.isFailure(failure1)) {
        expect(failure1.failure.message).toMatch(/Expected @beep\/schema\/PromiseSchema\/PromiseSchema/);
      }
    })
  );

  it.effect(
    "rejects non-promise values",
    Effect.fnUntraced(function* () {
      expect(isPromise("nope")).toBe(false);
      const failure2 = yield* Effect.result(decodeUnknownPromisePayload({ value: "nope" }));
      expect(Result.isFailure(failure2)).toBe(true);
      if (Result.isFailure(failure2)) {
        expect(failure2.failure.message).toMatch(/Expected @beep\/schema\/PromiseSchema\/PromiseSchema/);
      }
    })
  );
});
