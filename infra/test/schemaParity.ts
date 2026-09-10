import { Effect } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { expect } from "vitest";

export const expectSchemaRoundTrip = <A, E>(schema: S.Codec<A, E, never, never>): void => {
  const equivalent = S.toEquivalence(schema);

  expect(
    Effect.runSync(
      Arbitrary.checkEffect(
        Arbitrary.all([Arbitrary.schema(schema)]),
        ([value]) => {
          const encoded = Effect.runSync(S.encodeUnknownEffect(schema)(value));
          const decoded = Effect.runSync(S.decodeUnknownEffect(schema)(encoded));

          expect(equivalent(decoded, value)).toBe(true);

          return true;
        },
        { runs: 25 }
      )
    )._tag
  ).toBe("Passed");
};
