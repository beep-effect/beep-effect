/**
 * The canonical set codec: an `effect/HashSet` when decoded, and the
 * deduplicated array of its members sorted by their encoded strings when
 * encoded.
 *
 * **Details**
 *
 * `S.HashSet` encodes its members in iteration order, which depends on hashing
 * and insertion history. A record hashed through canonical JSON (RFC 8785)
 * gets its object keys sorted, but never its arrays, so a set-valued field
 * must reach the preimage already in one order. This codec fixes that order on
 * the encoded side.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { $SchemaId } from "./internal/SchemaId.ts";

const $I = $SchemaId.create("CanonicalHashSet");

/**
 * A set of members whose encoded form is a string, decoded to an
 * `effect/HashSet` and encoded to the strictly ascending array of the members'
 * encoded strings, so equal sets always encode to equal arrays.
 *
 * **When to use**
 *
 * Use as the schema of every set-valued field of a record that is canonicalized or hashed,
 * such as the entities an activity used inside its content-hash preimage.
 *
 * **Details**
 *
 * Decoding accepts the members in any order and with repeats; the `HashSet`
 * keeps each once. Encoding sorts by UTF-16 code units, the order RFC 8785
 * uses for object keys. Equivalence is set equality.
 *
 * **Example** (Encode two orderings alike)
 *
 * ```ts import.meta.vitest name="Encode two orderings alike"
 * import * as HashSet from "effect/HashSet"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet"
 *
 * const Tags = CanonicalHashSet(S.String)
 * const encode = S.encodeResult(Tags)
 *
 * Result.getOrThrow(encode(HashSet.make("b", "a", "c"))) // => ["a", "b", "c"]
 * Result.getOrThrow(encode(HashSet.make("c", "a", "b", "a"))) // => ["a", "b", "c"]
 * ```
 *
 * @typeParam Item - The member schema; its encoded side is a string.
 * @param item - The member schema.
 * @returns A codec from a sorted array of encoded members to a `HashSet`.
 * @category combinators
 * @since 0.0.0
 */
export const CanonicalHashSet = <Item extends S.Top & { readonly Encoded: string }>(item: Item) =>
  item.pipe(
    S.toEncoded,
    S.Array,
    S.decodeTo(
      S.HashSet(item),
      SchemaTransformation.transform({
        decode: HashSet.fromIterable,
        encode: (members: HashSet.HashSet<Item["Encoded"]>): ReadonlyArray<Item["Encoded"]> =>
          A.sort(A.fromIterable(members), Order.String),
      })
    ),
    $I.annoteSchema("CanonicalHashSet", {
      description: "A HashSet whose encoded form is the ascending array of its members' encoded strings.",
    })
  );
