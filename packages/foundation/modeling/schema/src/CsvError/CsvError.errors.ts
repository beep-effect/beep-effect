/**
 * Shared CSV domain errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $SchemaId.create("CsvError");
const CsvErrorFields = {
  message: S.String,
  offset: S.optionalKey(S.Finite),
} satisfies S.Struct.Fields;
const sameCsvErrorFields = S.toEquivalence(S.TaggedStruct("CsvError", CsvErrorFields));
const sameCsvError = (self: CsvError, that: CsvError): boolean => sameCsvErrorFields(self, that);

/**
 * Raised when CSV parsing, header validation, or formatting fails.
 *
 * **Example** (Create CsvError instance)
 *
 * ```ts
 * import { CsvError } from "@beep/schema/CsvError"
 *
 * const error = CsvError.make({ message: "Invalid CSV" })
 * console.log(error.message)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class CsvError extends S.TaggedError<CsvError>($I`CsvError`)(
  "CsvError",
  CsvErrorFields,
  $I.annoteClass<S.declare<CsvError>, readonly [S.TaggedStruct<"CsvError", typeof CsvErrorFields>]>("CsvError", {
    description: "Raised when CSV parsing, header validation, or formatting fails.",
    toEquivalence: () => sameCsvError,
  })
) {}

/**
 * Construct a {@link CsvError}.
 *
 * **Example** (Construct CsvError with offset)
 *
 * ```ts
 * import { csvError } from "@beep/schema/CsvError"
 *
 * const error = csvError("Invalid CSV", 4)
 * console.log(error.offset)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const csvError: {
  (message: string): CsvError;
  (offset: number): (message: string) => CsvError;
  (message: string, offset: number): CsvError;
} = dual(
  (args) => args.length === 2 || P.isString(args[0]),
  (message: string, offset?: number): CsvError =>
    P.isNumber(offset)
      ? CsvError.make({
          message,
          offset,
        })
      : CsvError.make({ message })
);

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { CsvError as Error, csvError as make };
