import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";

const $I = $ScratchpadId.create("effected/env/ColorLevel");

/**
 * The colour support of one output stream: none, 16 colours, 256 colours or truecolor.
 *
 * @public
 */
export const ColorLevel = LiteralKit(["none", "basic", "256", "truecolor"]).annotate(
	$I.annote("ColorLevel", { description: "The colour support of one output stream: none, 16 colours, 256 colours or truecolor." }),
);

export type ColorLevel = typeof ColorLevel.Type;
