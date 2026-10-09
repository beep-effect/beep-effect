import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import type * as Cli from "../../index.ts";
import type { Context as ReactContext } from "react";
import { fromReact, inkModules } from "./ink.ts";

const $I = $ScratchpadId.create("effected/cli/ui/internal/ScreenContext");

class ScreenContextError extends S.TaggedError<ScreenContextError>($I`ScreenContextError`)("ScreenContextError", {
	message: S.String,
}) {}

/**
 * What every kit widget reads from its screen.
 *
 * @internal
 */
export interface ScreenContextValue {
	/** Cancel the screen; absent under a tree that is not a screen (a `UiProvider`, a live view). */
	readonly cancel?: (reason: "escape" | "interrupt") => void;
	/**
	 * End the screen as a defect carrying `error`: what an input handler that throws comes to. Absent under a tree
	 * that is not a screen.
	 */
	readonly die?: (error: unknown) => void;
	/** The theme of the stream the tree draws on. */
	readonly theme: Cli.StreamTheme;
	/** The glyph set in use. */
	readonly glyphs: Cli.GlyphSet;
	/** The terminal size the tree is laid out at, read by `useTerminalSize` in place of the stdout's. */
	readonly size?: { readonly columns: number; readonly rows: number };
	/**
	 * Whether the GitHub Actions runner reads the output, so text from data must not form a workflow command:
	 * `DocView` sets `neutralizeWorkflowCommands` from it.
	 */
	readonly neutralizeWorkflowCommands?: boolean;
}

/**
 * The React context carrying {@link ScreenContextValue}, built on the loaded React.
 *
 * @internal
 */
export const screenContext: () => ReactContext<ScreenContextValue | undefined> = fromReact((react) =>
	react.createContext<ScreenContextValue | undefined>(undefined),
);

const ignore = (): void => undefined;

/**
 * The mounted screen's cancel, for a widget whose own key (such as Select's `q`) ends the screen.
 *
 * @remarks
 * A React hook; throws outside a screen mounted by `CliUi.run` or a `UiProvider`. Under a tree that is not a screen
 * (a `UiProvider`, a live view) there is nothing to cancel, and it does nothing.
 *
 * @internal
 */
export const useScreenCancel = (): ((reason: "escape" | "interrupt") => void) => {
	const screen = inkModules().react.useContext(screenContext());
	if (screen === undefined)
		throw ScreenContextError.make({
			message: "@effected/cli/ui: a widget was used outside a screen mounted by CliUi.run or a UiProvider",
		});
	return screen.cancel ?? ignore;
};

/**
 * Wrap an input handler so a throw ends the screen as a defect instead of escaping.
 *
 * @remarks
 * Ink calls `useInput` and `usePaste` handlers from its stdin listener, outside React's render, so an error boundary
 * never sees what they throw: unguarded, it is an uncaught exception (the process dies, Effect finalizers skipped)
 * or, where something keeps the process alive, a screen left waiting. Guarded, the screen dies with the error and
 * `CliUi.run` unmounts it like any other defect. Outside a screen mounted by `CliUi.run`, a `UiProvider` tree
 * included, a handler is called as is.
 *
 * A React hook.
 *
 * @internal
 */
export const useScreenGuard = (): (<Args extends ReadonlyArray<unknown>>(
	handler: (...args: Args) => void,
) => (...args: Args) => void) => {
	const die = inkModules().react.useContext(screenContext())?.die;
	return (handler) =>
		(...args) => {
			if (die === undefined) return handler(...args);
			try {
				handler(...args);
			} catch (error) {
				die(error);
			}
		};
};
