import type { ReactElement } from "react";
import { Fmt } from "../Fmt.ts";
import { inkModules } from "./internal/ink.ts";
import { lineText } from "./internal/lineText.ts";
import { Styled, useGlyphs, useTerminalSize } from "./UiTheme.ts";

/**
 * Props of {@link Toggle.View}.
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export interface ToggleViewProps {
	/** What the toggle controls. */
	readonly label: string;
	/** Whether it is on. */
	readonly value: boolean;
	/** Whether the row is the highlighted one. */
	readonly highlighted: boolean;
}

/**
 * An on/off row: a check glyph and a label.
 *
 * **Example** (Compose an enabled toggle row)
 *
 * ```ts
 * import { Toggle } from "@beep/scratchpad/effected/cli/ui/Toggle";
 * import { createElement } from "react";
 *
 * const element = createElement(Toggle.View, { label: "Linting", value: true, highlighted: false });
 * console.log(element.props.value) // true
 * ```
 *
 * @public
 * @category components
 * @since 0.0.0
 */
export abstract class Toggle {

	/**
	 * Draw a toggle row: `◉` on or `◯` off (`[x]` and `[ ]` under ASCII glyphs), then the label, cut to the width with
	 * the glyph set's ellipsis. A highlighted row starts with the arrow glyph and is painted with the accent token.
	 *
	 * **Example** (Compose a highlighted toggle row)
	 *
	 * ```ts
	 * import { Toggle } from "@beep/scratchpad/effected/cli/ui/Toggle";
	 * import { createElement } from "react";
	 *
	 * const element = createElement(Toggle.View, { label: "Linting", value: true, highlighted: true });
	 * console.log(element.props.highlighted) // true
	 * ```
	 *
	 * @param props - the label, the value and whether the row is highlighted
	 * @category components
	 * @since 0.0.0
	 */
	static readonly View = (props: ToggleViewProps): ReactElement => {
		const { ink, react } = inkModules();
		const glyphs = useGlyphs();
		const { columns } = useTerminalSize();
		const check = props.value ? (glyphs.kind === "unicode" ? "◉" : "[x]") : glyphs.kind === "unicode" ? "◯" : "[ ]";
		const lead = props.highlighted ? glyphs.arrow : " ".repeat(Fmt.width(glyphs.arrow));
		const text = Fmt.truncate(`${lead} ${check} ${lineText(props.label)}`, columns, { ellipsis: glyphs.ellipsis });
		return props.highlighted
			? react.createElement(Styled, { token: "accent" }, text)
			: react.createElement(ink.Text, null, text);
	};
}
