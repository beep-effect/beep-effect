import { fcRuns } from "@beep/fc-runs";
import { SafeObject, SafeObjectFromObjectKeyword } from "@beep/schema/SafeObject";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Cause, Effect, Exit, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

const decodeUnknownSafeObject = S.decodeUnknownEffect(SafeObject);
const decodeUnknownSafeObjectFromObjectKeyword = S.decodeUnknownEffect(SafeObjectFromObjectKeyword);
const encodeSafeObject = S.encodeEffect(SafeObject);
const encodeSafeObjectFromObjectKeyword = S.encodeEffect(SafeObjectFromObjectKeyword);
const isSafeObject2 = S.is(SafeObject);

const SafeObjectArbitrary = Arbitrary.schema(SafeObject);
const SafeObjectFromObjectKeywordArbitrary = Arbitrary.schema(SafeObjectFromObjectKeyword);

describe("SafeObject", () => {
  it.effect(
    "accepts heterogeneous string-keyed records",
    Effect.fnUntraced(function* () {
      const nested = { active: true };
      const value = yield* decodeUnknownSafeObject({
        count: 1,
        enabled: true,
        label: "ready",
        nested,
      });

      expect(value).toEqual({
        count: 1,
        enabled: true,
        label: "ready",
        nested,
      });
      expect(value.nested).toBe(nested);
      expect(yield* decodeUnknownSafeObject({})).toEqual({});
    })
  );

  it.effect(
    "rejects values that are not object records",
    Effect.fnUntraced(function* () {
      pipe(yield* Effect.exit(decodeUnknownSafeObject(null)), Exit.isFailure, assertTrue);
      pipe(yield* Effect.exit(decodeUnknownSafeObject(undefined)), Exit.isFailure, assertTrue);
      pipe(yield* Effect.exit(decodeUnknownSafeObject(true)), Exit.isFailure, assertTrue);
      pipe(yield* Effect.exit(decodeUnknownSafeObject(1)), Exit.isFailure, assertTrue);
      pipe(yield* Effect.exit(decodeUnknownSafeObject("record")), Exit.isFailure, assertTrue);
      pipe(yield* Effect.exit(decodeUnknownSafeObject([])), Exit.isFailure, assertTrue);
      pipe(yield* Effect.exit(decodeUnknownSafeObject(() => undefined)), Exit.isFailure, assertTrue);
    })
  );

  it.effect(
    "normalizes record-like objects to their enumerable own properties",
    Effect.fnUntraced(function* () {
      class RecordLike {
        readonly label = "ready";
      }

      const input = new RecordLike();
      const value = yield* decodeUnknownSafeObject(input);

      expect(value).toEqual({ label: "ready" });
      expect(value).not.toBe(input);
    })
  );

  it.effect.prop(
    "derives arbitrary values that round-trip",
    [SafeObjectArbitrary],
    Effect.fnUntraced(function* ([value]) {
      expect(isSafeObject2(value)).toBe(true);

      const encoded = yield* encodeSafeObject(value);
      expect(yield* decodeUnknownSafeObject(encoded)).toEqual(value);

      return true;
    }),
    { arbitrary: fcRuns(100) }
  );
});

describe("SafeObjectFromObjectKeyword", () => {
  it.effect(
    "normalizes every object-keyword shape into a string-keyed record",
    Effect.fnUntraced(function* () {
      class RecordLike {
        readonly label = "ready";
      }

      function callable() {
        return undefined;
      }
      callable.label = "callable";

      expect(yield* decodeUnknownSafeObjectFromObjectKeyword({ enabled: true })).toEqual({ enabled: true });
      expect(yield* decodeUnknownSafeObjectFromObjectKeyword(new RecordLike())).toEqual({ label: "ready" });
      expect(yield* decodeUnknownSafeObjectFromObjectKeyword(["first", "second"])).toEqual({ 0: "first", 1: "second" });
      expect(yield* decodeUnknownSafeObjectFromObjectKeyword(callable)).toEqual({ label: "callable" });
      expect(yield* decodeUnknownSafeObjectFromObjectKeyword(() => undefined)).toEqual({});
    })
  );

  it.effect(
    "rejects values outside ObjectKeyword",
    Effect.fnUntraced(function* () {
      pipe(yield* Effect.exit(decodeUnknownSafeObjectFromObjectKeyword(null)), Exit.isFailure, assertTrue);
      pipe(yield* Effect.exit(decodeUnknownSafeObjectFromObjectKeyword(undefined)), Exit.isFailure, assertTrue);
      pipe(yield* Effect.exit(decodeUnknownSafeObjectFromObjectKeyword(true)), Exit.isFailure, assertTrue);
      pipe(yield* Effect.exit(decodeUnknownSafeObjectFromObjectKeyword(1)), Exit.isFailure, assertTrue);
      pipe(yield* Effect.exit(decodeUnknownSafeObjectFromObjectKeyword("record")), Exit.isFailure, assertTrue);
    })
  );

  it.effect(
    "encodes the normalized safe object back to an object",
    Effect.fnUntraced(function* () {
      const value = yield* decodeUnknownSafeObjectFromObjectKeyword(["first", "second"]);
      const encoded = yield* encodeSafeObjectFromObjectKeyword(value);

      expect(encoded).toEqual({ 0: "first", 1: "second" });
      expect(yield* decodeUnknownSafeObjectFromObjectKeyword(encoded)).toEqual(value);
    })
  );

  it.effect(
    "returns typed schema failures when property enumeration throws",
    Effect.fnUntraced(function* () {
      const throwingGetter = Object.defineProperty({}, "value", {
        enumerable: true,
        get: () => {
          throw new Error("getter failed");
        },
      });
      const throwingProxy = new Proxy(
        {},
        {
          ownKeys: () => {
            throw new Error("ownKeys failed");
          },
        }
      );

      for (const input of [throwingGetter, throwingProxy]) {
        expect(() => decodeUnknownSafeObjectFromObjectKeyword(input)).not.toThrow();
        const exit = yield* Effect.exit(decodeUnknownSafeObjectFromObjectKeyword(input));
        pipe(exit, Exit.isFailure, assertTrue);
        if (Exit.isFailure(exit)) {
          expect(Cause.hasFails(exit.cause)).toBe(true);
        }
      }
    })
  );

  it.effect.prop(
    "derives arbitrary safe objects that round-trip",
    [SafeObjectFromObjectKeywordArbitrary],
    Effect.fnUntraced(function* ([value]) {
      const encoded = yield* encodeSafeObjectFromObjectKeyword(value);
      expect(yield* decodeUnknownSafeObjectFromObjectKeyword(encoded)).toEqual(value);

      return true;
    }),
    { arbitrary: fcRuns(100) }
  );
});
