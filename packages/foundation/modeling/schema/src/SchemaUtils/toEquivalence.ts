/**
 * Equivalence helpers for schema fields kept out of their owner's identity.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type * as Equivalence from "effect/Equivalence";

/**
 * Equivalence thunk for `S.overrideToEquivalence` that treats every pair of
 * values as equal, so an opaque field is left out of its owner's identity.
 *
 * **Details**
 *
 * Pass it to `S.overrideToEquivalence` on a field that must travel with a
 * value without taking part in `S.toEquivalence` of the owning schema: a
 * thrown `cause` (`S.Defect`) or an arbitrary caller payload (`S.Unknown`).
 * Decoding and encoding are untouched. Upstream has no named always-true
 * equivalence, so every consumer shares this one value instead of repeating
 * the `() => () => true` arrows at each field.
 *
 * **Example** (Exclude a cause from error identity)
 *
 * ```ts import.meta.vitest name="Exclude a cause from error identity"
 * import * as S from "effect/Schema"
 * import { alwaysEquivalent } from "@beep/schema/SchemaUtils/toEquivalence"
 *
 * const Failure = S.Struct({
 *   url: S.String,
 *   cause: S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(alwaysEquivalent)),
 * })
 * const same = S.toEquivalence(Failure)
 *
 * same({ url: "a", cause: new Error("first") }, { url: "a", cause: new Error("second") }) // => true
 * same({ url: "a", cause: new Error("first") }, { url: "b", cause: new Error("first") }) // => false
 * ```
 *
 * @returns An equivalence that reports every pair of values as equal.
 * @category utilities
 * @since 0.0.0
 */
export const alwaysEquivalent = (): Equivalence.Equivalence<unknown> => () => true;
