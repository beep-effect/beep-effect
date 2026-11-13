/**
 * The field of a wire key that may be absent.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const absentKey = <Item extends S.Constraint>(item: Item, description: string) =>
  S.OptionFromOptionalKey(item).pipe(S.withConstructorDefault(Effect.succeedNone), S.annotateKey({ description }));

/**
 * A described wire key that may be absent, held as an `Option` that constructors default to none.
 *
 * **Details**
 *
 * This is the package's rule for an optional wire key (absent on the wire,
 * `Option` in the domain, omitted from constructor input) in one call, for
 * structs with many such keys.
 *
 * **Example** (Read an absent key as none and omit it again)
 *
 * ```ts import.meta.vitest name="Read an absent key as none and omit it again"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { absent } from "@beep/scratchpad/osdk/src/internal/AbsentKey"
 *
 * const Page = S.Struct({ title: absent(S.String, "Title of the page, when it has one.") })
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(Page)({}))
 * const encoded = await Effect.runPromise(S.encodeEffect(Page)(Page.make({})))
 * const facts = [O.isNone(decoded.title), encoded]
 * facts // => [true, {}]
 * ```
 *
 * @param item - The schema of the value when the key is present.
 * @param description - What the key means, attached to the key.
 * @returns The field schema to place in a struct.
 * @category constructors
 * @since 0.0.0
 */
export const absent: {
  (description: string): <Item extends S.Constraint>(item: Item) => ReturnType<typeof absentKey<Item>>;
  <Item extends S.Constraint>(item: Item, description: string): ReturnType<typeof absentKey<Item>>;
} = dual(2, absentKey);
