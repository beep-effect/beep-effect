/**
 * AbortSignal schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $SchemaId.create("AbortSignal");
/**
 * Type guard that checks whether a value is an `AbortSignal` instance.
 *
 * **Example** (Guard AbortSignal values)
 *
 * ```ts
 * import { isAbortSignal } from "@beep/schema/AbortSignal"
 *
 * const controller = new AbortController()
 * console.log(isAbortSignal(controller.signal)) // true
 * console.log(isAbortSignal("nope")) // false
 * ```
 *
 * @param u - The value to test.
 * @returns Whether the value is an `AbortSignal`.
 * @category validation
 * @since 0.0.0
 */
export const isAbortSignal = (u: unknown): u is AbortSignal => u instanceof AbortSignal;

/**
 * Declared schema for `AbortSignal` instances.
 *
 * **Example** (Decode AbortSignal schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AbortSig } from "@beep/schema/AbortSignal"
 *
 * const controller = new AbortController()
 * const signal = S.decodeUnknownSync(AbortSig)(controller.signal)
 * console.log(signal.aborted) // false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const AbortSig = S.declare(isAbortSignal).pipe(
  $I.annoteSchema("AbortSig", {
    description: "An instance of an AbortSignal",
  })
);

/**
 * {@inheritDoc AbortSig}
 *
 * **Example** (Type AbortSignal value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AbortSig } from "@beep/schema/AbortSignal"
 *
 * const controller = new AbortController()
 * const signal: AbortSig = S.decodeUnknownSync(AbortSig)(controller.signal)
 * console.log(signal.aborted) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AbortSig = typeof AbortSig.Type;
