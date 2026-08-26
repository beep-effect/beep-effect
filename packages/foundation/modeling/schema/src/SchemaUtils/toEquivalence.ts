/**
 * Derive a dual-call equivalence function from an Effect schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { dual } from "effect/Function";
import * as S from "effect/Schema";

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
