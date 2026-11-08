/** Shared lookup of authenticated original assertion payloads.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";

/** Read exact canonical event IDs; callers decode their distinct assertion schemas.
 * @internal @category testing @since 0.0.0
 */
export const readCitationCanonicalAssertionPayloads = Effect.fn("CanonicalCriteriaTest.payloads")(
  (assertions: HashMap.HashMap<string, { readonly payload: string }>, ids: ReadonlyArray<string>) =>
    Effect.forEach(ids, (id) => Effect.fromOption(HashMap.get(assertions, id)).pipe(Effect.map((row) => row.payload)))
);
