/**
 * Row schemas over each driver's numeric shapes: PGlite returns `bigint`
 * columns as numbers, postgres.js as decimal strings, and `@effect/sql-pg` as
 * native `bigint`. Every row with such a column decodes all three.
 */
import { AcceptedJson, DeliveryRow } from "@beep/alchemy-postgres";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const delivery = {
  target: { kind: "policy", name: "Provisioning" },
  key: "Account/a-1",
  source: "Account/a-1",
  seq: 1,
  origin: "Account",
  tag: "Opened",
  event: { _tag: "Opened" },
  envelope: { id: "a-1", stream: "Account/a-1", seq: 1, at: 0, commandId: "c-1" },
};

describe("bigint columns", () => {
  it.effect.prop(
    "an outbox row's position decodes the same from a number, a decimal string and a native bigint",
    [Arbitrary.schema(S.Int.check(S.isGreaterThanOrEqualTo(0)))],
    ([position]) =>
      Effect.gen(function* () {
        const positions = yield* Effect.forEach([position, `${position}`, BigInt(position)], (shape) =>
          S.decodeUnknownEffect(DeliveryRow)({ position: shape, producer: "Account", delivery }).pipe(
            Effect.map((row) => row.position)
          )
        );
        deepStrictEqual(positions, [position, position, position]);
      })
  );

  it.effect("an accepted input's time decodes from a native bigint", () =>
    Effect.gen(function* () {
      const accepted = yield* S.decodeUnknownEffect(AcceptedJson)({ position: 1, delivery, at: 1_700_000_000_000n });
      deepStrictEqual([accepted.position, accepted.at], [1, 1_700_000_000_000]);
    })
  );

  it.effect("a value that is no integer in any shape is refused", () =>
    Effect.gen(function* () {
      const refused = yield* Effect.forEach(["seven", 7.5], (position) =>
        S.decodeUnknownEffect(DeliveryRow)({ position, producer: "Account", delivery }).pipe(
          Effect.flip,
          Effect.map(S.isSchemaError)
        )
      );
      deepStrictEqual(refused, [true, true]);
    })
  );
});
