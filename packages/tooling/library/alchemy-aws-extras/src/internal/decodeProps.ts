/**
 * Shared props decoding for every provider in the package.
 *
 * @packageDocumentation
 * @internal
 * @since 0.0.0
 */

import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { InvalidResourceProps } from "../Errors.ts";

/**
 * Decode resolved resource props through their schema, failing with
 * {@link InvalidResourceProps} before any AWS call.
 *
 * @internal
 * @since 0.0.0
 */
export const decodeProps =
  <A, I>({ resourceType, schema }: { readonly resourceType: string; readonly schema: S.Codec<A, I> }) =>
  (props: unknown): Effect.Effect<A, InvalidResourceProps> =>
    S.decodeUnknownEffect(schema)(props).pipe(
      Effect.mapError((error) => InvalidResourceProps.make({ resourceType, message: error.message }))
    );
