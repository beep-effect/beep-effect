import { isPromise, PromiseSchema } from "@beep/schema/PromiseSchema";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
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
      const failure1 = yield* Effect.exit(decodeUnknownPromisePayload({ value: thenable }));
      pipe(failure1, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure1)) {
        expect(pipe(failure1.cause, Cause.findErrorOption, Option.getOrThrow).message).toMatch(
          /Expected @beep\/schema\/PromiseSchema\/PromiseSchema/
        );
      }
    })
  );

  it.effect(
    "rejects non-promise values",
    Effect.fnUntraced(function* () {
      expect(isPromise("nope")).toBe(false);
      const failure2 = yield* Effect.exit(decodeUnknownPromisePayload({ value: "nope" }));
      pipe(failure2, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure2)) {
        expect(pipe(failure2.cause, Cause.findErrorOption, Option.getOrThrow).message).toMatch(
          /Expected @beep\/schema\/PromiseSchema\/PromiseSchema/
        );
      }
    })
  );
});
