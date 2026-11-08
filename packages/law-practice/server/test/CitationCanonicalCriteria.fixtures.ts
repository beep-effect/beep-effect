/** Shared lookup of authenticated original assertion payloads.
 * @internal @packageDocumentation @since 0.0.0
 */

import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import type { CitationOracleOperations } from "@beep/law-practice-use-cases/test";

/** Read exact canonical event IDs; callers decode their distinct assertion schemas.
 * @internal @category testing @since 0.0.0
 */
export const readCitationCanonicalAssertionPayloads = Effect.fn("CanonicalCriteriaTest.payloads")(
  (assertions: HashMap.HashMap<string, { readonly payload: string }>, ids: ReadonlyArray<string>) =>
    Effect.forEach(ids, (id) => Effect.fromOption(HashMap.get(assertions, id)).pipe(Effect.map((row) => row.payload)))
);

/** Read an original successful builtin plain parser call with its exact None profile.
 * @internal @category testing @since 0.0.0
 */
export const readCitationCanonicalPlainExtraction = Effect.fn("CanonicalCriteriaTest.plainExtraction")(function* (
  operations: CitationOracleOperations,
  id: string,
  raw: string
) {
  const call = yield* Effect.fromOption(A.findFirst(operations.cases, (row) => row.id === id));
  if (call.operation !== "get_citations") return yield* Effect.die("Expected original get_citations operation");
  const body = call.payload.value;
  if (body.outcome.kind !== "success") return yield* Effect.die("Expected successful original extraction");
  expect(body.input, id).toMatchObject({
    plain_text: raw,
    markup_text: "",
    clean_steps: null,
    remove_ambiguous: false,
    tokenizer: { tokenizer: "AhocorasickTokenizer" },
  });
  return { id: call.id, input: body.input, models: body.outcome.value };
});
