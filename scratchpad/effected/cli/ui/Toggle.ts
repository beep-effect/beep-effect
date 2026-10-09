import type { ReactElement } from "react";
import { Fmt } from "../Fmt.ts";
import { inkModules } from "./internal/ink.ts";
import { lineText } from "./internal/lineText.ts";
import { Styled, useGlyphs, useTerminalSize } from "./UiTheme.ts";

/**
 * Props of {@link Toggle.View}.
 *
 * @public
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
 * @public
 */
export class Toggle {
	private constructor() {}

	/**
	 * Draw a toggle row: `◉` on or `◯` off (`[x]` and `[ ]` under ASCII glyphs), then the label, cut to the width with
	 * the glyph set's ellipsis. A highlighted row starts with the arrow glyph and is painted with the accent token.
	 *
	 * @param props - the label, the value and whether the row is highlighted
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
