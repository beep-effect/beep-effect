import { fcRuns } from "@beep/fc-runs";
import { SafeObject, SafeObjectFromObjectKeyword } from "@beep/schema/SafeObject";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

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
      expect(Exit.isFailure(yield* Effect.exit(decodeUnknownSafeObject(null)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeUnknownSafeObject(undefined)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeUnknownSafeObject(true)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeUnknownSafeObject(1)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeUnknownSafeObject("record")))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeUnknownSafeObject([])))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeUnknownSafeObject(() => undefined)))).toBe(true);
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

  it("derives arbitrary values that round-trip", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([SafeObjectArbitrary]),
          ([value]) => {
            expect(isSafeObject2(value)).toBe(true);

            const encoded = Effect.runSync(encodeSafeObject(value));
            expect(Effect.runSync(decodeUnknownSafeObject(encoded))).toEqual(value);

            return true;
          },
          fcRuns(100)
        )
      )
    ).toMatchObject({ _tag: "Passed" });
  });
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
      expect(Exit.isFailure(yield* Effect.exit(decodeUnknownSafeObjectFromObjectKeyword(null)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeUnknownSafeObjectFromObjectKeyword(undefined)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeUnknownSafeObjectFromObjectKeyword(true)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeUnknownSafeObjectFromObjectKeyword(1)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeUnknownSafeObjectFromObjectKeyword("record")))).toBe(true);
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

  it("returns typed schema failures when property enumeration throws", () => {
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
      const exit = Effect.runSync(Effect.exit(decodeUnknownSafeObjectFromObjectKeyword(input)));
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(Cause.hasFails(exit.cause)).toBe(true);
      }
    }
  });

  it("derives arbitrary safe objects that round-trip", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([SafeObjectFromObjectKeywordArbitrary]),
          ([value]) => {
            const encoded = Effect.runSync(encodeSafeObjectFromObjectKeyword(value));
            expect(Effect.runSync(decodeUnknownSafeObjectFromObjectKeyword(encoded))).toEqual(value);

            return true;
          },
          fcRuns(100)
        )
      )
    ).toMatchObject({ _tag: "Passed" });
  });
});
