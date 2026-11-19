/**
 * Field helpers shared by the report schemas.
 *
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

/**
 * An optional field that decodes to `Option` and defaults to `None` when a
 * value is constructed.
 *
 * @since 0.0.0
 */
export const optionalSlot = <Schema extends S.Constraint>(schema: Schema) =>
  S.OptionFromOptionalKey(schema).pipe(S.withConstructorDefault(Effect.succeedNone));
