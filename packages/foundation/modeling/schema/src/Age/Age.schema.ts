/**
 * Person age schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Age");

/**
 * The age of a person in years.
 *
 * **Example** (Decode age value)
 *
 * ```ts
 * import { Age } from "@beep/schema/Age"
 * import * as S from "effect/Schema"
 *
 * const age = S.decodeUnknownSync(Age)(42)
 * console.log(age)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Age = S.Int.check(
  S.isBetween({
    maximum: 150,
    minimum: 1,
  })
).pipe(
  S.brand("Age"),
  $I.annoteSchema("Age", {
    description: "Age in years",
  })
);

/**
 * {@inheritDoc Age}
 * @category validation
 * @since 0.0.0
 */
export type Age = typeof Age.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { Age as Schema };
