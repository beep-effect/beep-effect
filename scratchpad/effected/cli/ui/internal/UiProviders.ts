import { dual } from "effect/Function";
import type { ReactElement, ReactNode } from "react";
import { inkModules } from "./ink.ts";
import type { ScreenContextValue } from "./ScreenContext.ts";
import { screenContext } from "./ScreenContext.ts";

/**
 * Wrap `children` in the kit's providers: the theme, the glyph set, the optional size override, and a screen's cancel
 * and defect route when it has them.
 *
 * **Details**
 *
 * The one place a kit tree's context is built, for `CliUi.run`'s screens, a live view and the public `UiProvider`,
 * so every kit hook reads the same value under each.
 *
 * **Example** (Build a provider tree after loading Ink)
 *
 * ```ts
 * import { uiProviders } from "@beep/scratchpad/effected/cli/ui/internal/UiProviders"
 * import * as Effect from "effect/Effect"
 * import { loadInk } from "@beep/scratchpad/effected/cli/ui/internal/ink"
 * import { CliTheme } from "@beep/scratchpad/effected/cli/CliTheme"
 * import { Glyphs } from "@beep/scratchpad/effected/cli/Glyphs"
 * import { isValidElement } from "react"
 *
 * await Effect.runPromise(loadInk)
 * const theme = Effect.runSync(Effect.provide(CliTheme, CliTheme.layerTest()))
 * const element = uiProviders({ theme, glyphs: Glyphs.ascii }, null)
 * console.log(isValidElement(element)) // true
 * ```
 *
 * @internal
 * @category providers
 * @since 0.0.0
 */
export const uiProviders: {
	(children: ReactNode): (value: ScreenContextValue) => ReactElement;
	(value: ScreenContextValue, children: ReactNode): ReactElement;
} = dual(2, (value: ScreenContextValue, children: ReactNode): ReactElement =>
	inkModules().react.createElement(screenContext().Provider, { value, children }));
