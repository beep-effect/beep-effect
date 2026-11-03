/** Structural ownership snapshots through the caller's canonical JSON codec.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

/** Copy structural data before asynchronous verification; retain codec services
 * and the caller's closed failure mapping in both directions.
 * @internal @category operations @since 0.0.0
 */
export const snapshotCitationValue = Effect.fn("Citation.snapshotValue")(function* <T, RD, RE, E>(
  codec: S.Codec<T, string, RD, RE>,
  value: T,
  invalid: () => E
) {
  const json = yield* S.encodeEffect(codec)(value).pipe(Effect.mapError(invalid));
  return yield* S.decodeEffect(codec)(json).pipe(Effect.mapError(invalid));
});
