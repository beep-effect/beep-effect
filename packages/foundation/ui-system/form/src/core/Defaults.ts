/**
 * Schema-first default form values.
 *
 * The same effect schema that validates a form also supplies its initial
 * values: {@link getDefaultFormValues} materializes the schema's constructor
 * defaults via `schema.make({})`. {@link getEncodedDefaultFormValues} then
 * encodes those decoded defaults back to the wire shape TanStack stores in
 * `defaultValues`. Declare defaults on the schema with
 * `S.withConstructorDefault` or `@beep/schema`'s `withKeyDefaults`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { pipe } from "effect";
import * as S from "effect/Schema";

/**
 * Materializes a schema's constructor defaults into a default form-values
 * object by calling `schema.make({})`.
 *
 * **Details**
 *
 * **Totality caveat:** `make({})` succeeds only when *every* field is either
 * defaulted or optional. For a schema with required, non-defaulted fields this
 * throws — declare defaults (`S.withConstructorDefault` / `withKeyDefaults`) or
 * pass explicit `defaultValues` to the form-options builders instead.
 *
 * **Example** (Materialize schema defaults)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { getDefaultFormValues } from "@beep/form/core/Defaults"
 *
 * const schema = S.Struct({
 *   name: S.String.pipe(S.withConstructorDefault(Effect.succeed(""))),
 * })
 * console.log(getDefaultFormValues(schema)) // { name: "" }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const getDefaultFormValues = <Schema extends S.Top>(schema: Schema): Schema["Type"] =>
  schema.make({} as Schema["~type.make.in"]);

/**
 * Materializes constructor defaults and encodes them to the schema's wire shape.
 *
 * **Details**
 *
 * TanStack Form stores `defaultValues` as the field value shape. For transform
 * schemas, that is the schema's `Encoded` side rather than its decoded `Type`.
 * For example, `S.NumberFromString` decodes to a number but the form field
 * still starts from a string.
 *
 * **Example** (Encoded form defaults)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { getEncodedDefaultFormValues } from "@beep/form/core/Defaults"
 *
 * const schema = S.Struct({
 *   count: S.NumberFromString.pipe(S.withConstructorDefault(Effect.succeed(1))),
 * })
 *
 * console.log(getEncodedDefaultFormValues(schema)) // { count: "1" }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const getEncodedDefaultFormValues = <A, I>(schema: S.Codec<A, I>): I => {
  const encode = schema.pipe(S.encodeSync);
  return pipe(getDefaultFormValues(schema), encode);
};
