/**
 * Declaration equivalence hook adopting the declared field struct.
 *
 * @internal
 */
import type { Equivalence } from "effect/Equivalence";

/**
 * Effect calls a tagged error's `toEquivalence` hook with the derived equivalence of its declared
 * `TaggedStruct`; returning it makes `toEquivalence(ErrorClass)` compare declared fields only.
 * Narrowing the struct equivalence from `never` to `Self` is the contravariant direction (`Self`
 * extends the struct type), so the assertion is sound.
 *
 * @internal
 */
export const declaredFieldsEquivalence = <Self>(typeParameters: readonly [Equivalence<never>]): Equivalence<Self> =>
  typeParameters[0] as Equivalence<Self>;
