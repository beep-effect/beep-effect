/**
 * Derive a dual-call equivalence function from an Effect schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type * as Equivalence from "effect/Equivalence";

/**
 * Dual-call equivalence function produced by {@link toEquivalence}.
 *
 * **Details**
 *
 * A dual equivalence compares two schema-decoded values directly, or accepts
 * the right-hand value first and returns a pipe-friendly comparator for the
 * left-hand value.
 *
 * **Example** (Dual equivalence call forms)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { toEquivalence, type DualEquivalence } from "@beep/schema/SchemaUtils/toEquivalence"
 *
 * const sameString: DualEquivalence<string> = toEquivalence(S.String)
 *
 * console.log(sameString("docs", "docs")) // true
 * console.log(sameString("tests")("docs")) // false
 * ```
 *
 * @typeParam A - Value type compared by the equivalence relation.
 * @category models
 * @since 0.0.0
 */
export type DualEquivalence<A> = {
  (self: A, that: A): boolean;
  (that: A): (self: A) => boolean;
};

/**
 * Create a schema-backed equivalence function with data-first and data-last
 * call signatures.
 *
 * **Details**
 *
 * The returned function delegates value comparison to `S.toEquivalence(schema)`
 * while adding a pipe-friendly unary form. Use this when a schema-modeled
 * value should be compared according to the schema rather than ad-hoc
 * equality checks.
 *
 * **Example** (Schema-backed dual equivalence)
 *
 * ```ts import.meta.vitest name="Schema-backed dual equivalence"
 * import { pipe } from "effect"
 * import * as S from "effect/Schema"
 * import { toEquivalence } from "@beep/schema/SchemaUtils/toEquivalence"
 *
 * const sameTags = toEquivalence(S.Array(S.String))
 *
 * sameTags(["docs", "tests"], ["docs", "tests"]) // => true
 * pipe(["docs", "tests"], sameTags(["docs", "lint"])) // => false
 * ```
 *
 * @typeParam A - Decoded value type described by the schema.
 * @param schema - Schema used to derive the underlying equivalence relation.
 * @returns A dual equivalence function for the schema's decoded values.
 * @category utilities
 * @since 0.0.0
 */
export const toEquivalence: <A>(schema: S.Schema<A>) => DualEquivalence<A> = <A>(
  schema: S.Schema<A>
): DualEquivalence<A> => dual(2, S.toEquivalence(schema));

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
