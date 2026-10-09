/**
 * Random byte generation services and helpers.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $RepoUtilsId } from "@beep/identity";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Random from "effect/Random";

const $I = $RepoUtilsId.create("Random");

/**
 * Service that yields random byte arrays.
 *
 * **Example** (Default RandomValues service)
 *
 * ```ts
 * import { RandomValues } from "@beep/utils/Random"
 *
 * console.log(RandomValues.Default)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export class RandomValues extends Context.Service<RandomValues>()($I`RandomValues`, {
  make: Effect.succeed(
    <A extends Uint8Array>(length: A["length"]): Effect.Effect<A> =>
      Effect.sync(() => crypto.getRandomValues(new Uint8Array(length)) as A)
  ),
}) {
  static override readonly call = <A extends Uint8Array>(length: A["length"]): Effect.Effect<A, never, RandomValues> =>
    Effect.suspend(() => RandomValues.use((randomValues) => randomValues(length)));

  static readonly Default = Layer.effect(RandomValues, RandomValues.make);

  static readonly Random = Layer.effect(
    RandomValues,
    Effect.gen(function* () {
      const random = yield* Random.Random;
      return RandomValues.of(
        <A extends Uint8Array>(length: A["length"]): Effect.Effect<A> =>
          Effect.sync(() => {
            const view = new Uint8Array(length);
            for (let i = 0; i < length; ++i) view[i] = random.nextIntUnsafe();
            return view as A;
          })
      );
    })
  );
}
