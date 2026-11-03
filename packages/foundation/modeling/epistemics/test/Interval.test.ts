import { KnowledgeInterval, KnowledgeIntervalFields, knownAt } from "@beep/epistemics/KnowledgeInterval";
import { holdsAt, ValidInterval, ValidIntervalFields } from "@beep/epistemics/ValidInterval";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const at = DateTime.makeUnsafe;

describe("ValidInterval", () => {
  const decode = S.decodeEffect(ValidInterval);
  const encode = S.encodeEffect(ValidInterval);

  it.effect("round-trips flat epoch-millis columns with a null open end", () =>
    Effect.gen(function* () {
      const open = yield* decode({ validFrom: 1_000, validTo: null });
      const closed = yield* decode({ validFrom: 1_000, validTo: 2_000 });
      assertNone(open.validTo);
      const encoded1 = yield* encode(open);
      expect(encoded1).toStrictEqual({ validFrom: 1_000, validTo: null });
      const encoded2 = yield* encode(closed);
      expect(encoded2).toStrictEqual({ validFrom: 1_000, validTo: 2_000 });
    })
  );

  it.effect("holds on [validFrom, validTo)", () =>
    Effect.gen(function* () {
      const closed = yield* decode({ validFrom: 1_000, validTo: 2_000 });
      expect(holdsAt(closed, at(999))).toBe(false);
      expect(holdsAt(closed, at(1_000))).toBe(true);
      expect(holdsAt(closed, at(1_999))).toBe(true);
      expect(holdsAt(closed, at(2_000))).toBe(false);
      expect(holdsAt(at(1_500))(closed)).toBe(true);
    })
  );

  it.effect("holds from validFrom onward when the upper bound is open", () =>
    Effect.gen(function* () {
      const open = yield* decode({ validFrom: 1_000, validTo: null });
      expect(holdsAt(open, at(999))).toBe(false);
      expect(holdsAt(open, at(4_102_444_800_000))).toBe(true);
    })
  );

  it.effect("exposes its fields for spreading into flat rows", () =>
    Effect.gen(function* () {
      const Row = S.Struct({ ...ValidIntervalFields, name: S.String });
      const encoded = { name: "fact", validFrom: 1_000, validTo: null };
      const row = yield* S.decodeEffect(Row)(encoded);
      expect(holdsAt(row, at(1_000))).toBe(true);
      const value3 = yield* S.encodeEffect(Row)(row);
      expect(value3).toStrictEqual(encoded);
    })
  );
});

describe("KnowledgeInterval", () => {
  const decode = S.decodeEffect(KnowledgeInterval);
  const encode = S.encodeEffect(KnowledgeInterval);

  it.effect("round-trips flat epoch-millis columns with a null open end", () =>
    Effect.gen(function* () {
      const current = yield* decode({ expiredAt: null, recordedAt: 1_000 });
      const expired = yield* decode({ expiredAt: 2_000, recordedAt: 1_000 });
      const encoded4 = yield* encode(current);
      expect(encoded4).toStrictEqual({ expiredAt: null, recordedAt: 1_000 });
      const encoded5 = yield* encode(expired);
      expect(encoded5).toStrictEqual({ expiredAt: 2_000, recordedAt: 1_000 });
    })
  );

  it.effect("is known on [recordedAt, expiredAt)", () =>
    Effect.gen(function* () {
      const expired = yield* decode({ expiredAt: 2_000, recordedAt: 1_000 });
      expect(knownAt(expired, at(999))).toBe(false);
      expect(knownAt(expired, at(1_000))).toBe(true);
      expect(knownAt(expired, at(1_999))).toBe(true);
      expect(knownAt(expired, at(2_000))).toBe(false);
      expect(knownAt(at(1_500))(expired)).toBe(true);
    })
  );

  it.effect("is known from recordedAt onward while current", () =>
    Effect.gen(function* () {
      const current = yield* decode({ expiredAt: null, recordedAt: 1_000 });
      expect(knownAt(current, at(999))).toBe(false);
      expect(knownAt(current, at(4_102_444_800_000))).toBe(true);
    })
  );

  it.effect("exposes its fields for spreading into flat rows", () =>
    Effect.gen(function* () {
      const Row = S.Struct({ ...KnowledgeIntervalFields, name: S.String });
      const encoded = { expiredAt: null, name: "fact", recordedAt: 1_000 };
      const row = yield* S.decodeEffect(Row)(encoded);
      expect(knownAt(row, at(1_000))).toBe(true);
      const value6 = yield* S.encodeEffect(Row)(row);
      expect(value6).toStrictEqual(encoded);
    })
  );
});

describe("interval schema laws", () => {
  it.effect.prop(
    "round-trips schema-derived intervals through their flat columns",
    [Arbitrary.schema(ValidInterval), Arbitrary.schema(KnowledgeInterval)],
    ([valid, knowledge]) =>
      Effect.gen(function* () {
        const argument = S.decodeEffect(ValidInterval);
        const value1 = yield* S.encodeEffect(ValidInterval)(valid);
        const validRoundTrip = yield* argument(value1);
        const argument1 = S.decodeEffect(KnowledgeInterval);
        const value2 = yield* S.encodeEffect(KnowledgeInterval)(knowledge);
        const knowledgeRoundTrip = yield* argument1(value2);
        expect(S.toEquivalence(ValidInterval)(validRoundTrip, valid)).toBe(true);
        expect(S.toEquivalence(KnowledgeInterval)(knowledgeRoundTrip, knowledge)).toBe(true);
      })
  );
});

describe("interval ordering", () => {
  it.effect("rejects empty and inverted intervals", () =>
    Effect.gen(function* () {
      const rejected = (exit: Exit.Exit<unknown, unknown>) => exit.pipe(Exit.isFailure, assertTrue);
      const exit7 = yield* Effect.exit(S.decodeEffect(ValidInterval)({ validFrom: 200, validTo: 100 }));
      rejected(exit7);
      const exit8 = yield* Effect.exit(S.decodeEffect(ValidInterval)({ validFrom: 100, validTo: 100 }));
      rejected(exit8);
      const exit9 = yield* Effect.exit(S.decodeEffect(KnowledgeInterval)({ recordedAt: 200, expiredAt: 100 }));
      rejected(exit9);
    })
  );

  it.effect.prop(
    "every decoded interval is ordered",
    [ValidInterval.pipe(S.toEncoded, Arbitrary.schema), KnowledgeInterval.pipe(S.toEncoded, Arbitrary.schema)],
    ([valid, knowledge]) =>
      Effect.gen(function* () {
        const v = yield* Effect.exit(S.decodeEffect(ValidInterval)(valid));
        const k = yield* Effect.exit(S.decodeEffect(KnowledgeInterval)(knowledge));
        if (Exit.isSuccess(v)) {
          expect(
            O.match(v.value.validTo, { onNone: () => true, onSome: (to) => DateTime.isLessThan(v.value.validFrom, to) })
          ).toBe(true);
        }
        if (Exit.isSuccess(k)) {
          expect(
            O.match(k.value.expiredAt, {
              onNone: () => true,
              onSome: (to) => DateTime.isLessThan(k.value.recordedAt, to),
            })
          ).toBe(true);
        }
      })
  );
});
