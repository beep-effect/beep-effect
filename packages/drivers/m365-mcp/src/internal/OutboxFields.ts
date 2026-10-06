/**
 * Field builder shared by the outbox tool and audit schemas.
 *
 * @internal
 * @since 0.1.0
 */
import { Effect } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const listField = <Sch extends S.Top>(schema: Sch, description: string) =>
  S.Array(schema)
    .pipe(S.withConstructorDefault(Effect.succeed([])), S.withDecodingDefaultTypeKey(Effect.succeed([])))
    .annotateKey({ description });

/**
 * An array field that is empty when its key is missing.
 *
 * @internal
 */
export const emptyByDefault: {
  (description: string): <Sch extends S.Top>(schema: Sch) => ReturnType<typeof listField<Sch>>;
  <Sch extends S.Top>(schema: Sch, description: string): ReturnType<typeof listField<Sch>>;
} = dual(2, listField);
