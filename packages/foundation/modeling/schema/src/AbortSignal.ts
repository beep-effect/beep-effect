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
 * ```ts import.meta.vitest name="Guard AbortSignal values"
 * import { isAbortSignal } from "@beep/schema/AbortSignal"
 *
 * const controller = new AbortController()
 * isAbortSignal(controller.signal) // => true
 * isAbortSignal("nope") // => false
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
 * ```ts import.meta.vitest name="Decode AbortSignal schema"
 * import * as S from "effect/Schema"
 * import { AbortSig } from "@beep/schema/AbortSignal"
 *
 * const controller = new AbortController()
 * const signal = S.decodeUnknownSync(AbortSig)(controller.signal)
 * signal.aborted // => false
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
 * @category models
 * @since 0.0.0
 */
export type AbortSig = typeof AbortSig.Type;
