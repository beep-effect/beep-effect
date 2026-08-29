/**
 * Array-backed schema for Effect `HashSet` values.
 *
 * **Details**
 *
 * The immutable sibling of `@beep/schema/MutableHashSet`, and deliberately
 * smaller than it. That module hand-rolls three symbols because
 * `effect/Schema` has no `MutableHashSet` support at all; for `HashSet` the
 * upstream package already provides the from-self declaration (`S.HashSet`),
 * its iso type (`S.HashSetIso`), and the guard (`HashSet.isHashSet` from
 * `effect/HashSet`). Only the array-backed transform is missing, so only the
 * array-backed transform lives here.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity/packages";
import { A } from "@beep/utils";
import { HashSet as HashSet_, SchemaTransformation } from "effect";
import * as S from "effect/Schema";

const $I = $SchemaId.create("HashSet");

/**
 * Schema for transforming arrays into `HashSet` instances.
 *
 * **Example** (Type a persisted set field)
 *
 * ```ts
 * import { HashSet } from "@beep/schema/HashSet"
 * import * as HashSet_ from "effect/HashSet"
 * import * as S from "effect/Schema"
 *
 * const axes: HashSet<typeof S.String> = HashSet(S.String)
 *
 * console.log(HashSet_.size(S.decodeUnknownSync(axes)(["temporal", "material"]))) // 2
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export interface HashSet<Value extends S.Top> extends S.decodeTo<S.HashSet<S.toType<Value>>, S.$Array<Value>> {
  readonly Rebuild: this;
  readonly value: Value;
}

/**
 * Schema for decoding arrays into `HashSet` instances and encoding sets back to
 * arrays.
 *
 * **When to use**
 *
 * Use with any set that crosses a serialization boundary — a jsonb column, a
 * wire payload, a fixture. `effect/Schema`'s own `HashSet` is the *from-self*
 * schema: its encoded side is another `HashSet`, so encoding leaves a runtime
 * set in place and decoding refuses anything that is not already one. That is
 * the right shape for validating a value in hand and the wrong one for storage.
 *
 * **Gotchas**
 *
 * A field declared with `effect/Schema`'s `HashSet` and persisted as jsonb
 * round-trips through neither direction: encoding writes Effect's tagged
 * `{"_id":"HashSet","values":[...]}` form, and decoding rejects both that
 * wrapper and a plain array. Because a table projects its column type from the
 * encoded side, the column is also *declared* as a set it can never return. Use
 * this schema instead whenever the set is stored.
 *
 * **Example** (Round-trip a stored set)
 *
 * ```ts import.meta.vitest name="Round-trip a stored set"
 * import { HashSet } from "@beep/schema/HashSet"
 * import * as HashSet_ from "effect/HashSet"
 * import * as S from "effect/Schema"
 *
 * const StringSet = HashSet(S.String)
 *
 * const decoded = S.decodeUnknownSync(StringSet)(["a", "b", "a"])
 * HashSet_.size(decoded) // => 2
 * S.encodeSync(StringSet)(decoded).length // => 2
 * ```
 *
 * @param value - Element schema for set members.
 * @returns Array-backed schema for immutable hash sets.
 * @since 0.0.0
 * @category validation
 */
export const HashSet = <Value extends S.Top>(value: Value): HashSet<Value> => {
  const schema = S.Array(value).pipe(
    S.decodeTo(
      S.toType(value).pipe(S.HashSet),
      SchemaTransformation.transform({
        decode: HashSet_.fromIterable,
        encode: A.fromIterable,
      })
    )
  );

  return S.make<HashSet<Value>>(schema.ast, {
    from: schema.from,
    to: schema.to,
    value,
  }).pipe(
    $I.annoteSchema("HashSet", {
      description: "Array-backed schema for Effect HashSet values.",
    })
  );
};
