import { fcRuns } from "@beep/fc-runs";
import { SafeObject, SafeObjectFromObjectKeyword } from "@beep/schema/SafeObject";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const { report, value: SafeObjectArbitrary } = S.toArbitrary(SafeObject, { report: true });
const SafeObjectFromObjectKeywordArbitrary = S.toArbitrary(SafeObjectFromObjectKeyword);

describe("SafeObject", () => {
  const decode = S.decodeUnknownEffect(SafeObject);
  const encode = S.encodeEffect(SafeObject);

  it.effect(
    "accepts heterogeneous string-keyed records",
    Effect.fnUntraced(function* () {
      const nested = { active: true };
      const value = yield* decode({
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
      expect(yield* decode({})).toEqual({});
    })
  );

  it.effect(
    "rejects values that are not object records",
    Effect.fnUntraced(function* () {
      expect(Exit.isFailure(yield* Effect.exit(decode(null)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decode(undefined)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decode(true)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decode(1)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decode("record")))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decode([])))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decode(() => undefined)))).toBe(true);
    })
  );

  it.effect(
    "normalizes record-like objects to their enumerable own properties",
    Effect.fnUntraced(function* () {
      class RecordLike {
        readonly label = "ready";
      }

      const input = new RecordLike();
      const value = yield* decode(input);

      expect(value).toEqual({ label: "ready" });
      expect(value).not.toBe(input);
    })
  );

  it("derives warning-free arbitrary values that round-trip", () => {
    const isSafeObject = S.is(SafeObject);

    expect(report.warnings).toEqual([]);

    fc.assert(
      fc.property(SafeObjectArbitrary, (value) => {
        expect(isSafeObject(value)).toBe(true);

        const encoded = Effect.runSync(encode(value));
        expect(Effect.runSync(decode(encoded))).toEqual(value);
      }),
      fcRuns(100)
    );
  });
});

describe("SafeObjectFromObjectKeyword", () => {
  const decode = S.decodeUnknownEffect(SafeObjectFromObjectKeyword);
  const encode = S.encodeEffect(SafeObjectFromObjectKeyword);

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

      expect(yield* decode({ enabled: true })).toEqual({ enabled: true });
      expect(yield* decode(new RecordLike())).toEqual({ label: "ready" });
      expect(yield* decode(["first", "second"])).toEqual({ 0: "first", 1: "second" });
      expect(yield* decode(callable)).toEqual({ label: "callable" });
      expect(yield* decode(() => undefined)).toEqual({});
    })
  );

  it.effect(
    "rejects values outside ObjectKeyword",
    Effect.fnUntraced(function* () {
      expect(Exit.isFailure(yield* Effect.exit(decode(null)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decode(undefined)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decode(true)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decode(1)))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decode("record")))).toBe(true);
    })
  );

  it.effect(
    "encodes the normalized safe object back to an object",
    Effect.fnUntraced(function* () {
      const value = yield* decode(["first", "second"]);
      const encoded = yield* encode(value);

      expect(encoded).toEqual({ 0: "first", 1: "second" });
      expect(yield* decode(encoded)).toEqual(value);
    })
  );

  it("derives arbitrary safe objects that round-trip", () => {
    fc.assert(
      fc.property(SafeObjectFromObjectKeywordArbitrary, (value) => {
        const encoded = Effect.runSync(encode(value));
        expect(Effect.runSync(decode(encoded))).toEqual(value);
      }),
      fcRuns(100)
    );
  });
});
