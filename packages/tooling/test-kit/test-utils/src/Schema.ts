/**
 * Schema property-test helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { fcRuns } from "./FastCheckRuns.js";

/**
 * Assert that a schema-derived arbitrary only emits values accepted by the same schema without transformation.
 *
 * Decoded values are compared with schema-derived equivalence so object and class schemas can use the helper.
 *
 * @param schema - Schema whose generated values must decode back to themselves.
 * @param options - Optional FastCheck tuning for the assertion.
 * @example
 * ```ts
 * import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils"
 * import * as S from "effect/Schema"
 *
 * const Status = S.Literal("ready")
 * assertSchemaArbitraryDecodesToSelf(Status, { numRuns: 4 })
 * ```
 * @category schema
 * @since 0.0.0
 */
export const assertSchemaArbitraryDecodesToSelf = <Schema extends S.Codec<unknown>>(
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
};
