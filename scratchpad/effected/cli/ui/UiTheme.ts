import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { $ScratchpadId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import type * as Cli from "../index.ts";
import type { ColorLevel } from "../../env/index.ts";
import type { ReactElement, ReactNode } from "react";
import { inkModules } from "./internal/ink.ts";
import type { ScreenContextValue } from "./internal/ScreenContext.ts";
import { screenContext } from "./internal/ScreenContext.ts";
import * as O from "@beep/utils/Option";

const $I = $ScratchpadId.create("effected/cli/ui/UiTheme");

class MissingUiThemeError extends S.TaggedError<MissingUiThemeError>($I`MissingUiThemeError`)(
	"MissingUiThemeError",
	{
		message: S.String,
	},
) {}

/**
 * The styling props of an Ink `Text` that a {@link @effected/cli!Style} maps to.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface InkTextProps {
	/**
	 * The foreground: a colour name or a `#rrggbb` hex.
	 *
	 * @since 0.0.0
	 */
	readonly color?: string;
	/**
	 * Bold.
	 *
	 * @since 0.0.0
	 */
	readonly bold?: boolean;
	/**
	 * Dim.
	 *
	 * @since 0.0.0
	 */
	readonly dimColor?: boolean;
	/**
	 * Italic.
	 *
	 * @since 0.0.0
	 */
	readonly italic?: boolean;
	/**
	 * Underline.
	 *
	 * @since 0.0.0
	 */
	readonly underline?: boolean;
}

/**
 * Selects the theme token or explicit style used to paint child text with {@link Styled}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface StyledProps {
	/**
	 * A theme token, or an explicit style.
	 *
	 * @since 0.0.0
	 */
	readonly token: Cli.TokenName | Cli.Style;
	/**
	 * The text.
	 *
	 * @since 0.0.0
	 */
	readonly children?: ReactNode;
}

/**
 * The usable size of the terminal.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface TerminalSize {
	/**
	 * The width, less one column, so a full-width line never wraps the cursor.
	 *
	 * @since 0.0.0
	 */
	readonly columns: number;
	/**
	 * The height, less one row, so a full-height frame never scrolls.
	 *
	 * @since 0.0.0
	 */
	readonly rows: number;
}

const OUTSIDE =
	"@effected/cli/ui: a theme hook was used outside a screen mounted by CliUi.run or a UiProvider";

const useScreen = (): ScreenContextValue => {
	const screen = inkModules().react.useContext(screenContext());
	if (screen === undefined) throw MissingUiThemeError.make({ message: OUTSIDE });
	return screen;
};

/**
 * Converts a resolved style into Ink `Text` props for the stream's colour level.
 *
 * **Details**
 *
 * At `"none"` it gives no styling props at all, not even bold or dim, so a frame is escape-free by construction;
 * Ink's colour level held at 0 is the backstop. A flag set to `false` adds no prop.
 *
 * Omit `color` in an Ink tree the kit did not mount, which has no colour level of its own to pass: every prop is
 * emitted, as at any level but `"none"`, and Ink's own chalk gates what reaches the terminal.
 *
 * **Example** (Suppress styling at no colour)
 *
 * ```ts
 * import { inkProps } from "@beep/scratchpad/effected/cli/ui/UiTheme"
 *
 * console.log(inkProps({ bold: true }, "none").bold) // undefined
 * ```
 *
 * @param style - the resolved style
 * @param color - the stream's colour level; omitted, every prop is emitted for Ink's chalk to gate
 * @public
 * @category formatting
 * @since 0.0.0
 */
export const inkProps: {
	(color?: ColorLevel): (style: Cli.Style) => InkTextProps;
	(style: Cli.Style, color?: ColorLevel): InkTextProps;
} = dual(
	(args) => P.isObjectKeyword(args[0]) && !P.isFunction(args[0]),
	(style: Cli.Style, color?: ColorLevel): InkTextProps =>
		color === "none"
			? {}
			: {
					...O.getSomesStruct({ color: O.fromUndefinedOr(style.fg) }),
					...(style.bold === true ? { bold: true } : {}),
					...(style.dim === true ? { dimColor: true } : {}),
					...(style.italic === true ? { italic: true } : {}),
					...(style.underline === true ? { underline: true } : {}),
				},
);

/**
 * The theme of the stream the mounted screen draws on.
 *
 * **Details**
 *
 * A React hook: call it from a component rendered inside a `CliUi.run` screen or a `UiProvider`.
 *
 * **Example** (Construct a component reading the theme)
 *
 * ```ts
 * import { useTheme, Styled } from "@beep/scratchpad/effected/cli/ui/UiTheme"
 * import { createElement, isValidElement } from "react"
 *
 * // Render this component inside the documented hook context.
 * const ReadScreen = () => {
 *   const theme = useTheme()
 *   return createElement(Styled, { token: { bold: true } }, theme.color)
 * }
 * console.log(isValidElement(createElement(ReadScreen))) // true
 * ```
 *
 * @public
 * @category hooks
 * @since 0.0.0
 */
export const useTheme = (): Cli.StreamTheme => useScreen().theme;

/**
 * The glyph set of the mounted screen, so a component draws Unicode or ASCII glyphs to match the rest of the output.
 *
 * **Details**
 *
 * A React hook: call it from a component rendered inside a `CliUi.run` screen or a `UiProvider`.
 *
 * **Example** (Construct a component reading glyphs)
 *
 * ```ts
 * import { useGlyphs, Styled } from "@beep/scratchpad/effected/cli/ui/UiTheme"
 * import { createElement, isValidElement } from "react"
 *
 * // Render this component inside the documented hook context.
 * const ReadScreen = () => {
 *   const glyphs = useGlyphs()
 *   return createElement(Styled, { token: { bold: true } }, glyphs.bullet)
 * }
 * console.log(isValidElement(createElement(ReadScreen))) // true
 * ```
 *
 * @public
 * @category hooks
 * @since 0.0.0
 */
export const useGlyphs = (): Cli.GlyphSet => useScreen().glyphs;

/**
 * Text painted with a theme token or style, through the mounted screen's theme.
 *
 * **Gotchas**
 *
 * Its children are drawn as given. The kit's widgets sanitise every string they draw from data (escapes removed,
 * line breaks folded) before handing it here; text a consumer passes to `Styled`, or to Ink's own `Text`, is the
 * consumer's to sanitise, with `Fmt.sanitize`. Ink keeps the escape sequences it is handed, so text from data drawn
 * unsanitised can paint colour at colour `none` or plant a hyperlink, and a line break in it adds a row the screen's
 * height budget did not count.
 *
 * **Example** (Construct styled text)
 *
 * ```ts
 * import { Styled } from "@beep/scratchpad/effected/cli/ui/UiTheme"
 * import { createElement, isValidElement } from "react"
 *
 * // Render this element inside a CliUi.run screen or UiProvider.
 * const text = createElement(Styled, { token: { bold: true } }, "Ready")
 * console.log(isValidElement(text)) // true
 * ```
 *
 * @param props - the token or style, and the text
 * @public
 * @category components
 * @since 0.0.0
 */
export const Styled = (props: StyledProps): ReactElement => {
	const theme = useTheme();
	const { ink, react } = inkModules();
	return react.createElement(ink.Text, inkProps(theme.style(props.token), theme.color), props.children);
};

/** A reported size, or `fallback` when it is unknown: absent, or not positive (a pty `script` opens reports 0x0). */
const known = (reported: number | undefined, fallback: number): number =>
	reported !== undefined && reported > 0 ? reported : fallback;

/**
 * The usable terminal size: the stdout Ink draws on, less one column and one row, re-read on every render and when
 * the terminal resizes; or, under a `UiProvider` given a `size`, that size less one column and one row.
 *
 * **Gotchas**
 *
 * A width or height the stream does not report, or reports as 0 (a pty that `script` opens says `0 0`), is unknown and
 * reads as 80 columns by 24 rows, so a screen never lays itself out at width 0. This is not Ink's own fallback, which
 * first asks the process's terminal (`terminal-size`: the tty, `COLUMNS`, `tput`) and only then uses 80x24; the kit
 * reads no `process` here. On a 0x0 pty with `COLUMNS=50`, Ink lays out at 50 while these rows are cut at 79.
 *
 * The override exists for Ink's `renderToString`, whose `useStdout` is the process's own stdout whatever width it
 * lays out at; without it, the kit's widgets would cut their rows to the wrong width there.
 *
 * Never feed `columns` into a `Box`'s `width`. On a resize Ink re-lays out the tree it already has and repaints
 * before React re-renders with the new size, so a width taken from this hook is one paint stale. After a shrink,
 * that stale, wider frame wraps in the narrower terminal and leaves a copy stranded above the live one. For a
 * one-column margin use `marginRight: 1`, which Ink recomputes within its own resize. Text cut to `columns` lags the
 * same paint, so give a long row Ink's `wrap: "truncate-end"` too: on a shrink Ink then clips it rather than letting
 * the terminal wrap it.
 *
 * A React hook: call it from a component rendered inside an Ink tree; it needs no screen, but reads a `UiProvider`'s
 * size when there is one.
 *
 * **Example** (Construct a component reading terminal dimensions)
 *
 * ```ts
 * import { useTerminalSize, Styled } from "@beep/scratchpad/effected/cli/ui/UiTheme"
 * import { createElement, isValidElement } from "react"
 *
 * // Render this component inside the documented hook context.
 * const ReadScreen = () => {
 *   const size = useTerminalSize()
 *   return createElement(Styled, { token: { bold: true } }, `${size.columns} columns`)
 * }
 * console.log(isValidElement(createElement(ReadScreen))) // true
 * ```
 *
 * @public
 * @category hooks
 * @since 0.0.0
 */
export const useTerminalSize = (): TerminalSize => {
	const { ink, react } = inkModules();
	const { stdout } = ink.useStdout();
	const override = react.useContext(screenContext())?.size;
	const [, redraw] = react.useReducer((count: number) => count + 1, 0);
	const followsStdout = override === undefined;
	react.useEffect(() => {
		if (!followsStdout) return undefined;
		stdout.on("resize", redraw);
		return () => {
			stdout.off("resize", redraw);
		};
	}, [stdout, followsStdout]);
	const columns = override?.columns ?? stdout.columns;
	const rows = override?.rows ?? stdout.rows;
	return { columns: Math.max(1, known(columns, 80) - 1), rows: Math.max(1, known(rows, 24) - 1) };
};
