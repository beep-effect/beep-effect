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
import type {SchemaType} from "./Codemode.tool.ts";

const $I = $ScratchpadId.create("StdLib.json");

/**
 * The `RenderContext` model.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { RenderContext } from "@beep/codemode";
 *
 * const thing: RenderContext = RenderContext.make()
 *
 * console.log(thing); // `{}`
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RenderContext extends S.Class<RenderContext>($I`RenderContext`)(
  {
    // definitions: S.Record(S.String, JSONSchema)
    pretty: S.Boolean,
  },
  $I.annote("RenderContext", {
    description: "The `RenderContext` model"
  })
) {
}

/**
 * Companion namespace for {@link RenderContext}
 *
 * @since 0.0.0
 */
export declare namespace RenderContext {
  /**
   * Companion encoded type for {@link RenderContext}
   *
   * **Example**
   *
   * @example
   * ```ts
   * import { RenderContext } from "@beep/codemode";
   * import * as S from "effect/Schema";
   * const thingEncoded: RenderContext.Encoded = S.encodeSync(RenderContext)(RenderContext.make());
   *
   * console.log(thingEncoded); // `{}`
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {}
}

const isEffectSchema = (schema: SchemaType): schema is S.Decoder<unknown> & S.Top => S.isSchema(schema)
