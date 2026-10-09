import type * as Cli from "../index.ts";
import type { ReactElement, ReactNode } from "react";
import { inkModules } from "./internal/ink.ts";
import { screenContext } from "./internal/ScreenContext.ts";
import { uiProviders } from "./internal/UiProviders.ts";
import * as O from "@beep/utils/Option";

/**
 * What the kit's hooks read in a tree the kit did not mount: the theme, the glyph set, and optionally the size.
 *
 * **Gotchas**
 *
 * Only `CliUi.context` mints one, because only it also loads the Ink and React the provider renders with. A value
 * without the brand does not compile, which stops one being built by accident; the brand is a plain key, so a
 * literal that spells it out compiles, and must never be written. Spread a minted value to change its fields
 * (`{ ...value, size }`).
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface UiContextValue {
	/**
	 * Set by `CliUi.context` alone; never set it yourself.
	 *
	 * @since 0.0.0
	 */
	readonly "~@effected/cli/ui/UiContextValue": true;
	/**
	 * The theme of the stream the tree draws on.
	 *
	 * @since 0.0.0
	 */
	readonly theme: Cli.StreamTheme;
	/**
	 * The glyph set in use.
	 *
	 * @since 0.0.0
	 */
	readonly glyphs: Cli.GlyphSet;
	/**
	 * The terminal size the tree is laid out at, which `useTerminalSize` reads in place of the stdout's.
	 *
	 * @since 0.0.0
	 */
	readonly size?: { readonly columns: number; readonly rows: number };
	/**
	 * Whether the GitHub Actions runner reads the output (`CliUi.context` sets it from `CurrentRuntimeEnv`, when one is
	 * provided): a `DocView` under it neutralizes any line its data would turn into a workflow command. `false` opts the
	 * tree out of that under GitHub Actions, the consumer's choice; a nested provider cannot clear it once a provider
	 * above it has set it.
	 *
	 * @since 0.0.0
	 */
	readonly neutralizeWorkflowCommands?: boolean;
}

/**
 * Supplies minted context and the child tree to {@link UiProvider}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface UiProviderProps {
	/**
	 * The context, from `CliUi.context`.
	 *
	 * @since 0.0.0
	 */
	readonly value: UiContextValue;
	/**
	 * The tree.
	 *
	 * @since 0.0.0
	 */
	readonly children?: ReactNode;
}

/**
 * Provide the kit's context to an Ink tree the kit did not mount, so `useTheme`, `useGlyphs`, `Styled` and
 * `useTerminalSize` work in it.
 *
 * **Details**
 *
 * Take the value from `CliUi.context`, which also loads Ink and React: the provider and the kit's hooks render with
 * the modules the kit loaded. A screen mounted by `CliUi.run` already has this context.
 *
 * With `size`, `useTerminalSize` reads it instead of the stdout Ink draws on, less one column and one row as ever.
 * Give it to Ink's `renderToString`, whose terminal hooks see the process's own stdout rather than the width it lays
 * out at: `renderToString(tree, { columns })` with `size: { columns, rows }` keeps the kit's widgets cut to that
 * width. A tree given a `size` no longer follows the terminal's resizes.
 *
 * Standalone, there is no screen to end: a kit widget's own quit key, such as `Select`'s `q`, does nothing, and an
 * input handler a kit widget registers is called as is, so what it throws escapes as Ink leaves it. Nested inside a `CliUi.run` screen, it overrides only the theme, the glyphs and the size: the screen's
 * cancel and its defect route pass through, so `q` still cancels and a throwing handler is still the screen's defect.
 * Ink's colour level is the host's: `Styled` passes the theme's props, none at colour `none`.
 *
 * **Example** (Construct a provider from minted context)
 *
 * ```ts
 * import { UiProvider } from "@beep/scratchpad/effected/cli/ui/UiProvider"
 * import { CliUi } from "@beep/scratchpad/effected/cli/ui/CliUi"
 * import * as Effect from "effect/Effect"
 * import { createElement, isValidElement } from "react"
 *
 * const program = CliUi.context.pipe(
 *   Effect.map((value) => isValidElement(createElement(UiProvider, { value }, "Ready")))
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param props - the context, and the tree
 * @public
 * @category providers
 * @since 0.0.0
 */
export const UiProvider = (props: UiProviderProps): ReactElement => {
	const { react } = inkModules();
	const { theme, glyphs, size } = props.value;
	const columns = size?.columns;
	const rows = size?.rows;
	// A screen above keeps its cancel and its defect route; they come from the parent context, never from the value.
	const parent = react.useContext(screenContext());
	const cancel = parent?.cancel;
	const die = parent?.die;
	// Under the runner if this value says so, or the tree above does: a nested provider never lifts it.
	const neutralize = props.value.neutralizeWorkflowCommands === true || parent?.neutralizeWorkflowCommands === true;
	const value = react.useMemo(
		() => ({
			theme,
			glyphs,
			...(columns === undefined || rows === undefined ? {} : { size: { columns, rows } }),
			...O.getSomesStruct({ cancel: O.fromUndefinedOr(cancel) }),
			...O.getSomesStruct({ die: O.fromUndefinedOr(die) }),
			...(neutralize ? { neutralizeWorkflowCommands: true } : {}),
		}),
		[theme, glyphs, columns, rows, cancel, die, neutralize],
	);
	return uiProviders(value, props.children);
};
