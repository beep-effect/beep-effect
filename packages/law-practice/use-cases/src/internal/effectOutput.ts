/**
 * Schema for the Effect values the law-practice port methods return.
 *
 * Covered by the package's `./internal/*: null` export guard — not part of the
 * public surface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { Effect } from "effect";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("internal/effectOutput");

/**
 * Declare the `Effect` a port method returns as a `Fn` output schema.
 *
 * **Details**
 *
 * The guard is `Effect.isEffect`, narrowed to the declared channels. Only the
 * runtime value is checked: the success, error, and requirement types are
 * compile-time claims, because checking them would mean running the effect.
 *
 * **Example** (Declare a port output)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { EffectOutput } from "./effectOutput.ts"
 *
 * const Output = EffectOutput<number, string>()
 * console.log(S.is(Output)(Effect.succeed(1))) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EffectOutput = <A, E = never, R = never>() =>
  S.declare(
    (u): u is Effect.Effect<A, E, R> => Effect.isEffect(u),
    $I.annote("EffectOutput", {
      description: "An Effect returned by a law-practice port method; its channels are not checked at runtime.",
    })
  );
