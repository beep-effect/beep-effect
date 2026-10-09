import { Effect } from "effect";
import type { ReactElement } from "react";

/** Where a lazy view keeps its loader: a `Symbol.for` key, so two copies of the package agree on it. */
const LOAD = Symbol.for("@effected/cli/ui/lazyView");

const NOT_LOADED =
	"@effected/cli/ui: a CliUi.lazyView render was called before its module loaded; only CliUi.live loads it first";

/** A live view's drawing: the state and the frame index to a React element. */
type LiveRender<S> = (state: S, frame: number) => ReactElement;

interface Lazy {
	readonly [LOAD]?: () => Promise<unknown>;
}

const kindOf = (value: unknown): string =>
	value === null ? "null" : Array.isArray(value) ? "an array" : typeof value === "object" ? "an object" : typeof value;

const EXPECTED = "a view, (state, frame) => ReactElement, or a module whose default export is one: { default: view }";

/** What a `load` resolved to that is no view: said with what was received and what is expected. */
const NO_VIEW = (resolved: unknown): string => {
	if (typeof resolved !== "object" || resolved === null) {
		return `@effected/cli/ui: CliUi.lazyView's load resolved to ${kindOf(resolved)}. Expected ${EXPECTED}`;
	}
	const named = Object.keys(resolved).filter((key) => key !== "default");
	const exports = named.length === 0 ? "" : ` (it exports ${named.join(", ")})`;
	const received = Object.hasOwn(resolved, "default")
		? `a module whose default export is ${kindOf((resolved as { readonly default: unknown }).default)}, not a function${exports}; a CommonJS module imported as ESM nests it one level deeper, as default.default`
		: `a module with no default export${exports}; resolve to the export itself, as .then((module) => module.name)`;
	return `@effected/cli/ui: CliUi.lazyView's load resolved to ${received}. Expected ${EXPECTED}`;
};

/**
 * A load that resolved to no view: deterministic, so a lazy view keeps it (one error object for the handle's life) and
 * the live view warns about it once, where a failed import is tried again by the next run.
 *
 * @internal
 */
export class LazyViewShapeError extends Error {}

/** The view `load` resolved to: the value itself when it is a function (a `default` property on it is ignored), else
 * its `default` when that is a function; anything else throws, saying what it got. */
const pick = (resolved: unknown): ((state: never, frame: number) => ReactElement) => {
	if (typeof resolved === "function") return resolved as (state: never, frame: number) => ReactElement;
	if (typeof resolved === "object" && resolved !== null) {
		const fallback = (resolved as { readonly default?: unknown }).default;
		if (typeof fallback === "function") return fallback as (state: never, frame: number) => ReactElement;
	}
	throw new LazyViewShapeError(NO_VIEW(resolved));
};

/**
 * `CliUi.lazyView`: a `render` that draws with what `load` resolves to, loaded on first use: the render itself, or a
 * module whose default export it is. One load is shared: an import that rejected is cleared, so the next run loads
 * again; a load that resolved to no view is kept, a `LazyViewShapeError` every later run gets as is. Calling the render
 * before it has loaded is a defect, since only `CliUi.live` knows to load it first.
 *
 * @internal
 */
export const lazyView = <S>(
	load: () => Promise<LiveRender<S> | { readonly default: LiveRender<S> }>,
): LiveRender<S> => {
	let loaded: LiveRender<S> | undefined;
	let pending: Promise<unknown> | undefined;
	const ensure = (): Promise<unknown> => {
		pending ??= load().then(
			// A load that resolved to no view rejects here and STAYS rejected: the module is what it is, so every later
			// run gets the same error object, and the live view warns about it once.
			(resolved: unknown) => {
				loaded = pick(resolved) as LiveRender<S>;
			},
			(error: unknown) => {
				// An import that failed (a network blip, a chunk not yet written) is the next run's to try again.
				pending = undefined;
				throw error;
			},
		);
		return pending;
	};
	const render: LiveRender<S> = (state, frame) => {
		if (loaded === undefined) throw new Error(NOT_LOADED);
		return loaded(state, frame);
	};
	return Object.assign(render, { [LOAD]: ensure });
};

/**
 * Load a lazy view's module before its render is first called; nothing for a render that is not lazy. Fails with what
 * the import failed with.
 *
 * @internal
 */
export const loadView = (render: unknown): Effect.Effect<void, unknown> => {
	const ensure = (render as Lazy)[LOAD];
	return ensure === undefined
		? Effect.void
		: Effect.asVoid(Effect.tryPromise({ try: ensure, catch: (error) => error }));
};
