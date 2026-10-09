import { Context } from "effect";

/**
 * Overrides of Ink's render options that only the screen harness sets.
 *
 * @internal
 */
export interface UiRenderOverrides {
	/**
	 * Render a screen's every frame in full, unthrottled, as Ink's `debug` mode does; the harness reads screen frames this
	 * way unless a session asks for the production path. A live view never renders in debug mode: it always runs on the
	 * production path, so what it writes above its frame lands as it does on a terminal.
	 */
	readonly debug?: boolean;
	/**
	 * Ink's `maxFps`: on the production path Ink throttles renders and writes to it (30 by default, a trailing timer of
	 * about 33 ms). The harness raises it so a frame lands within its settle window rather than a throttle period later.
	 */
	readonly maxFps?: number;
	/** Called after each render, just before Ink writes the frame; the harness counts frames with it. */
	readonly onRender?: () => void;
	/**
	 * Called as a screen's run starts mounting, before Ink is loaded and before the screen's thunk is called, so a run
	 * that crashes before Ink draws still has a capture; the harness starts that screen's capture. `kind` says whether a
	 * screen (`CliUi.run`) or a live view's run (`CliUi.live`) is mounting, which decides how its writes are read.
	 */
	readonly onMount?: (kind: "screen" | "live") => void;
	/**
	 * Called once a screen has unmounted, Ink has exited and the colour level is restored, with the defect the run died
	 * of, if it died (a thunk or a component that threw); the harness marks that screen's capture ended, and crashed.
	 */
	readonly onUnmount?: (crash: { readonly defect: unknown } | undefined) => void;
}

/**
 * The render-option overrides in force: none by default. Internal, so `CliUi.run`'s public signature stays as
 * specified; `CliUiTest` sets it.
 *
 * @internal
 */
export class UiRenderOptions extends Context.Reference<UiRenderOverrides>("@effected/cli/ui/UiRenderOptions", {
	defaultValue: () => ({}),
}) {}
