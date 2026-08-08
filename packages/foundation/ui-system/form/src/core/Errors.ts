/**
 * Mapping TanStack field errors into the `@beep/ui` `FieldError` shape.
 *
 * `Schema.toStandardSchemaV1` runs with `errors: "all"`, so TanStack buckets a
 * flat list of `{ message, path }` issues onto each field's
 * `state.meta.errors`. {@link toFieldErrors} normalizes that heterogeneous list
 * (issues or bare strings) into the `{ message }` entries `FieldError` renders.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FormId } from "@beep/identity";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $FormId.create("core/Errors");

/**
 * A single renderable field error, structurally compatible with `@beep/ui`'s
 * `FieldError` `errors` entries.
 *
 * **Example** (Make field error)
 *
 * ```ts
 * import { FieldErrorEntry } from "@beep/form/core/Errors"
 *
 * const entry = FieldErrorEntry.make({ message: "Required" })
 * console.log(entry.message) // "Required"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FieldErrorEntry extends S.Class<FieldErrorEntry>($I`FieldErrorEntry`)(
  {
    message: S.String.pipe(S.UndefinedOr, S.optionalKey).annotateKey({
      description: "Human-readable validation message rendered for a form field.",
    }),
  },
  $I.annote("FieldErrorEntry", {
    description: "A single renderable form-field validation error.",
  })
) {}

const toEntries = (error: unknown): ReadonlyArray<FieldErrorEntry> => {
  if (P.isString(error)) {
    return A.make(FieldErrorEntry.make({ message: error }));
  }
  if (P.isObject(error) && P.hasProperty(error, "message") && P.isString(error.message)) {
    return A.make(FieldErrorEntry.make({ message: error.message }));
  }
  return A.empty();
};

/**
 * Normalizes a TanStack `field.state.meta.errors` list into `FieldError`
 * entries, dropping anything without a string message.
 *
 * **Example** (Normalize mixed errors)
 *
 * ```ts
 * import { toFieldErrors } from "@beep/form/core/Errors"
 *
 * console.log(toFieldErrors([{ message: "Required" }, "Too short", null]))
 * // [{ message: "Required" }, { message: "Too short" }]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const toFieldErrors = (errors: ReadonlyArray<unknown> | undefined): ReadonlyArray<FieldErrorEntry> =>
  errors === undefined ? A.empty() : A.flatMap(errors, toEntries);
