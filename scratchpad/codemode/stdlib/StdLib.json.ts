/**
 * `Stdlib`
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {$ScratchpadId} from "@beep/identity";
import * as S from "effect/Schema";
import {LiteralKit, SchemaUtils, MappedLiteralKit} from "@beep/schema";
import {P, A, O, Str, R, Struct, pipe, dual} from "@beep/utils";
import {HashMap, HashSet} from "effect";

const $I = $ScratchpadId.create("StdLib.json");

/**
 * The `Thing` model.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { Thing } from "@beep/codemode";
 *
 * const thing: Thing = Thing.make()
 *
 * console.log(thing); // `{}`
 * ```
 *
 * @category models
 * @since 0.0.0
 */
const Thing = LiteralKit(["thing"]).pipe(
  $I.annoteSchema("Thing", {
    description: ""
  })
);

/**
 *
 * Companion runtime type for {@link Thing}
 *
 *
 * **Example **
 *
 * @example
 * ```ts
 * import { Thing } from "@beep/codemode";
 *
 * const thing: Thing = Thing.make()
 *
 * console.log(thing); // `{}`
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Thing = typeof Thing.Type;


/**
 * The `ThingClass` model.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { ThingClass } from "@beep/codemode";
 *
 * const thing: ThingClass = ThingClass.make()
 *
 * console.log(thing); // `{}`
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ThingClass extends S.Class<ThingClass>($I`ThingClass`)(
  {},
  $I.annote("ThingClass", {
    description: "The `ThingClass` model"
  })
) {
}

/**
 * Companion namespace for {@link ThingClass}
 *
 * @since 0.0.0
 */
export declare namespace ThingClass {
  /**
   * Companion encoded type for {@link ThingClass}
   *
   * **Example**
   *
   * @example
   * ```ts
   * import { ThingClass } from "@beep/codemode";
   * import * as S from "effect/Schema";
   * const thingEncoded: ThingClass.Encoded = S.encodeSync(ThingClass)(ThingClass.make());
   *
   * console.log(thingEncoded); // `{}`
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {}
}
