import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";

const $I = $ScratchpadId.create("effected/env/ColorLevel");

/**
 * The colour support of one output stream: none, 16 colours, 256 colours or truecolor.
 *
 * **Example** (Validate truecolor support)
 *
 * ```ts
 * import { ColorLevel } from "@beep/scratchpad/effected/env/ColorLevel";
 * import * as S from "effect/Schema";
 * console.log(S.is(ColorLevel)("truecolor")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ColorLevel = LiteralKit(["none", "basic", "256", "truecolor"]).annotate(
	$I.annote("ColorLevel", { description: "The colour support of one output stream: none, 16 colours, 256 colours or truecolor." }),
);

/**
 * Represents the colour capability of a stream: none, 16 colours, 256 colours, or truecolor.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ColorLevel = typeof ColorLevel.Type;
