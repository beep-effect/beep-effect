/**
 * Optional defect cause field shared by the epistemic use-case errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

/**
 * Optional `cause` field carrying a defect with its stack.
 *
 * **Details**
 *
 * A missing key decodes to `None`, and the defect never takes part in the
 * owning error's equivalence: `S.overrideToEquivalence` makes any two causes
 * equal, so `S.toEquivalence(ErrorClass)` compares the declared diagnostic
 * fields only.
 *
 * @param description - Field description attached to the property key.
 * @returns The optional defect field schema.
 * @category schemas
 * @since 0.0.0
 */
export const optionalDefect = (description: string) =>
  S.OptionFromOptionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(() => () => true)))
    .pipe(SchemaUtils.withNoneDefault)
    .annotateKey({
      description,
    });
