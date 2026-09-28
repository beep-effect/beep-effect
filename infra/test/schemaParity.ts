import { assertTrue } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";

export const expectSchemaRoundTrip = Effect.fnUntraced(function* <A, E>(schema: S.Codec<A, E, never, never>, value: A) {
  const encoded = yield* S.encodeUnknownEffect(schema)(value);
  const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
  assertTrue(S.toEquivalence(schema)(decoded, value));
});
