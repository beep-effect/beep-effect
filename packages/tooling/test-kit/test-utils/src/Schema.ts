/**
 * Schema property-test helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
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
 * assertSchemaArbitraryDecodesToSelf(Status, { numRuns: 4 })
 * pipe(Status, assertSchemaArbitraryDecodesToSelf({ numRuns: 4 }))
 * ```
 *
 * @param schema - Schema whose generated values must decode back to themselves.
 * @param options - Optional FastCheck tuning for the assertion.
 * @category schema
 * @since 0.0.0
 */
export const assertSchemaArbitraryDecodesToSelf: {
  (options?: { readonly numRuns?: number }): <Schema extends S.Codec<unknown>>(schema: Schema) => void;
  <Schema extends S.Codec<unknown>>(schema: Schema, options?: { readonly numRuns?: number }): void;
} = dual(
  (args) => S.isSchema(args[0]),
  <Schema extends S.Codec<unknown>>(
    schema: Schema,
    options?: {
      readonly numRuns?: number;
    }
  ): void => {
    const arbitrary = S.toArbitrary(schema);
    const decode = S.decodeUnknownSync(schema);
    const equivalent = S.toEquivalence(schema);
    const isValue = S.is(schema);

    fc.assert(
      fc.property(arbitrary, (value) => isValue(value) && equivalent(decode(value), value)),
      fcRuns(options?.numRuns ?? 50)
    );
  }
);
