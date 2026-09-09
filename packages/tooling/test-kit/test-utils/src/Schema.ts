/**
 * Schema property-test helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { assert } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { fcRuns } from "./FastCheckRuns.ts";

/**
 * Assert that a schema-derived arbitrary only emits values accepted by the same schema without transformation.
 *
 * **Details**
 *
 * Decoded values are compared with schema-derived equivalence so object and class schemas can use the helper.
 *
 * **Example** (Assert arbitrary decodes to self)
 *
 * ```ts
 * import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils"
 * import { pipe } from "effect"
 * import * as S from "effect/Schema"
 *
 * const Status = S.Literal("ready")
 * assertSchemaArbitraryDecodesToSelf(Status, { runs: 4 })
 * pipe(Status, assertSchemaArbitraryDecodesToSelf({ runs: 4 }))
 * ```
 *
 * @param schema - Schema whose generated values must decode back to themselves.
 * @param options - Optional Effect Arbitrary tuning for the assertion.
 * @category testing
 * @since 0.0.0
 */
export const assertSchemaArbitraryDecodesToSelf: {
  (options?: Arbitrary.CheckOptions): <Schema extends S.Codec<unknown>>(schema: Schema) => void;
  <Schema extends S.Codec<unknown>>(schema: Schema, options?: Arbitrary.CheckOptions): void;
} = dual(
  (args) => S.isSchema(args[0]),
  <Schema extends S.Codec<unknown>>(schema: Schema, options?: Arbitrary.CheckOptions): void => {
    const arbitrary = Arbitrary.schema(schema);
    const decode = S.decodeUnknownEffect(schema);
    const equivalent = S.toEquivalence(schema);
    const isValue = S.is(schema);

    const result = Effect.runSync(
      Arbitrary.checkEffect(
        arbitrary,
        (value) => Effect.map(decode(value), (decoded) => isValue(value) && equivalent(decoded, value)),
        { ...options, ...fcRuns(options?.runs ?? 50) }
      )
    );
    assert.deepInclude(result, { _tag: "Passed" });
  }
);
