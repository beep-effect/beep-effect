/**
 * Field builder shared by the outbox tool and audit schemas.
 *
 * @internal
 * @since 0.1.0
 */
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const listField = <Sch extends S.Top>(schema: Sch, description: string) =>
  // fallow-ignore-next-line code-duplication -- the annotation reorder touched this pre-existing twin of `mailRecipients` in @beep/m365, so the audit attributes it as introduced; both build an empty-by-default annotated array field. Owner: @beep/m365-mcp. Exit: import one shared helper once @beep/schema ships an array-default field that takes key annotations.
  S.Array(schema).pipe(
    S.withConstructorDefault(Effect.succeed([])),
    S.annotateKey({ description }),
    S.withDecodingDefaultTypeKey(Effect.succeed([]))
  );

/**
 * An array field that is empty when its key is missing.
 *
 * @internal
 */
export const emptyByDefault: {
  (description: string): <Sch extends S.Top>(schema: Sch) => ReturnType<typeof listField<Sch>>;
  <Sch extends S.Top>(schema: Sch, description: string): ReturnType<typeof listField<Sch>>;
} = dual(2, listField);
