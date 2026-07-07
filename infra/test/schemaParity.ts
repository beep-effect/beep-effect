import { Effect } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { expect } from "vitest";

export const expectSchemaRoundTrip = <A, E>(schema: S.Codec<A, E, never, never>): void => {
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(S.toArbitrary(schema), (value) => {
      const encoded = Effect.runSync(S.encodeUnknownEffect(schema)(value));
      const decoded = Effect.runSync(S.decodeUnknownEffect(schema)(encoded));

      expect(equivalent(decoded, value)).toBe(true);
    }),
    { numRuns: 25 }
  );
};
