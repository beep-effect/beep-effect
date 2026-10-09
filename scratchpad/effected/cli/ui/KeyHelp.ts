import type { ReactElement } from "react";
import { Fmt } from "../Fmt.ts";
import { inkModules } from "./internal/ink.ts";
import { lineText } from "./internal/lineText.ts";
import { KeyTable } from "./KeyTable.ts";
import { Styled, useGlyphs, useTerminalSize } from "./UiTheme.ts";

/** The fewest cells worth giving the widget's own keys when the line is cut; below it they are left out. */
const MIN_OWN = 4;

/**
 * Props of {@link KeyHelp}.
 *
 * @public
 */
export interface KeyHelpProps {
	/** The tables to describe, in order. */
	readonly tables: ReadonlyArray<KeyTable<unknown>>;
	/** Whether to end with the root keys (`esc cancel`); `true` by default. */
	readonly root?: boolean;
}

/**
 * A one-line footer naming every visible binding of the given tables, then the root keys:
 * `↑/↓ move · space toggle · enter continue · esc cancel`.
 *
 * **Details**
 *
 * Drawn from the same tables that dispatch the keys, so the help cannot name a key the screen ignores. Neighbouring
 * rows with the same help share one entry (`↑/↓ move`). It stays one line, cut to the terminal width with the glyph
 * set's ellipsis; when it must be cut, the widget's own keys give way and the root hint (`esc cancel`) stays whole at
 * the end. Painted with the `muted` token; labels follow the screen's glyph set.
 *
 * @param props - the tables, and whether to append the root keys
 * @public
 */
export const KeyHelp = (props: KeyHelpProps): ReactElement => {
	const glyphs = useGlyphs();
	const { columns } = useTerminalSize();
	const separator = glyphs.kind === "unicode" ? " · " : " | ";
	const rowsOf = (tables: ReadonlyArray<KeyTable<unknown>>): Array<{ label: string; help: string }> => {
		// Neighbouring rows that say the same thing share one entry: ↑ move, ↓ move reads ↑/↓ move.
		const rows: Array<{ label: string; help: string }> = [];
		for (const drawn of tables.flatMap((table) => table.help(glyphs))) {
			const row = { label: lineText(drawn.label), help: lineText(drawn.help) };
			const previous = rows.at(-1);
			if (previous !== undefined && previous.help === row.help) previous.label = `${previous.label}/${row.label}`;
			else rows.push({ ...row });
		}
		return rows;
	};
	const ownRows = rowsOf(props.tables);
	const rootRows = props.root === false ? [] : rowsOf([KeyTable.root]);
	// A widget's last entry that says what the root's first says ("q cancel", "esc cancel") joins it across the pinned
	// boundary, so the hint reads "q/esc cancel" and is kept whole with it.
	const lastOwn = ownRows.at(-1);
	const firstRoot = rootRows[0];
	if (lastOwn !== undefined && firstRoot !== undefined && lastOwn.help === firstRoot.help) {
		rootRows[0] = { label: `${lastOwn.label}/${firstRoot.label}`, help: firstRoot.help };
		ownRows.pop();
	}
	const own = ownRows.map((row) => `${row.label} ${row.help}`).join(separator);
	const root = rootRows.map((row) => `${row.label} ${row.help}`).join(separator);
	const whole = [own, root].filter((part) => part !== "").join(separator);
	// One line, cut to the terminal width with the theme's ellipsis, so the footer never wraps into a second row.
	// When it must be cut, the widget's own keys give way and the root hint (esc cancel) stays whole at the end;
	// when the keys would get fewer than MIN_OWN cells they are dropped, along with the separator, rather than shown
	// as an ellipsis; and when even the separator does not fit, the hint stands alone.
	const ellipsis = { ellipsis: glyphs.ellipsis };
	const room = columns - Fmt.width(separator) - Fmt.width(root);
	const line =
		Fmt.width(whole) <= columns || root === "" || own === ""
			? Fmt.truncate(whole, columns, ellipsis)
			: room >= MIN_OWN
				? `${Fmt.truncate(own, room, ellipsis)}${separator}${root}`
				: Fmt.truncate(root, columns, ellipsis);
	return inkModules().react.createElement(Styled, { token: "muted" }, line);
};
