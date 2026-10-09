import type { ComponentClass, ReactNode } from "react";
import { fromReact } from "./ink.ts";

/**
 * Props of the screen's error boundary.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export interface ErrorBoundaryProps {
	/** Called once with the error a descendant threw while rendering. */
	readonly onError: (error: unknown) => void;
	/** The screen's tree. */
	readonly children?: ReactNode;
	/** What to draw once a descendant has thrown, read when it is drawn; nothing by default. */
	readonly fallback?: () => ReactNode;
}

/**
 * The screen's error boundary: catches a render error anywhere in the screen, renders nothing, and reports it.
 *
 * **Details**
 *
 * It sits inside Ink's own boundary, so Ink's `ErrorOverview` (which Ink writes to stdout) never renders: a probe on
 * fake streams found zero bytes of it with this boundary in place, against an `ERROR` header, a stack and a
 * screen-and-scrollback clear without it. A class over the loaded React, built on first use, because the kit holds
 * no runtime React at module scope.
 *
 * **Example** (Load the screen error boundary)
 *
 * ```ts
 * import { errorBoundary } from "@beep/scratchpad/effected/cli/ui/internal/ErrorBoundary"
 * import * as Effect from "effect/Effect"
 * import { loadInk } from "@beep/scratchpad/effected/cli/ui/internal/ink"
 * await Effect.runPromise(loadInk)
 * console.log(errorBoundary().displayName) // CliUiErrorBoundary
 * ```
 *
 * @internal
 * @category components
 * @since 0.0.0
 */
export const errorBoundary: () => ComponentClass<ErrorBoundaryProps> = fromReact(
	(react) =>
		class ScreenErrorBoundary extends react.Component<ErrorBoundaryProps, { readonly failed: boolean }> {
			static displayName = "CliUiErrorBoundary";

			static getDerivedStateFromError(): { readonly failed: boolean } {
				return { failed: true };
			}

			override state = { failed: false };

			override componentDidCatch(error: unknown): void {
				this.props.onError(error);
			}

			override render(): ReactNode {
				return this.state.failed ? (this.props.fallback?.() ?? null) : (this.props.children ?? null);
			}
		},
);
