import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { ReactElement } from "react";

const $I = $ScratchpadId.create("effected/cli/ui/internal/lazyView");

class LazyViewStateError extends S.TaggedError<LazyViewStateError>($I`LazyViewStateError`)("LazyViewStateError", {
	message: S.String,
}) {}

/** Where a lazy view keeps its loader: a `Symbol.for` key, so two copies of the package agree on it. */
const LOAD = Symbol.for("@effected/cli/ui/lazyView");

const NOT_LOADED =
	"@effected/cli/ui: a CliUi.lazyView render was called before its module loaded; only CliUi.live loads it first";

/** A live view's drawing: the state and the frame index to a React element. */
type LiveRender<S> = (state: S, frame: number) => ReactElement;

const kindOf = (value: unknown): string => {
	if (value === null) return "null";
	if (A.isArray(value)) return "an array";
	if (P.isFunction(value)) return "function";
	if (P.isObjectKeyword(value)) return "an object";
	if (P.isString(value)) return "string";
	if (P.isNumber(value)) return "number";
	if (P.isBoolean(value)) return "boolean";
	if (P.isBigInt(value)) return "bigint";
	if (P.isSymbol(value)) return "symbol";
	return "undefined";
};

const EXPECTED = "a view, (state, frame) => ReactElement, or a module whose default export is one: { default: view }";

/** What a `load` resolved to that is no view: said with what was received and what is expected. */
const NO_VIEW = (resolved: unknown): string => {
	if (!P.isObjectKeyword(resolved) || P.isFunction(resolved)) {
		return `@effected/cli/ui: CliUi.lazyView's load resolved to ${kindOf(resolved)}. Expected ${EXPECTED}`;
	}
	const named = R.keys(resolved).filter((key) => key !== "default");
	const exports = named.length === 0 ? "" : ` (it exports ${named.join(", ")})`;
	const received = P.hasProperty(resolved, "default") && R.has(resolved, "default")
		? `a module whose default export is ${kindOf(resolved.default)}, not a function${exports}; a CommonJS module imported as ESM nests it one level deeper, as default.default`
		: `a module with no default export${exports}; resolve to the export itself, as .then((module) => module.name)`;
	return `@effected/cli/ui: CliUi.lazyView's load resolved to ${received}. Expected ${EXPECTED}`;
};

/**
 * A load that resolved to no view: deterministic, so a lazy view keeps it (one error object for the handle's life) and
 * the live view warns about it once, where a failed import is tried again by the next run.
 *
 * @internal
 */
export class LazyViewShapeError extends S.TaggedError<LazyViewShapeError>($I`LazyViewShapeError`)(
	"LazyViewShapeError",
	{ message: S.String.annotate({ description: "The resolved module's invalid view shape and the expected shape." }) },
	$I.annote("LazyViewShapeError", { description: "A deterministic invalid lazy-view module, cached for the handle's life." }),
) {
	/** An identity owned by this error, used to distinguish equal-looking cached shape errors. */
	readonly id = Symbol();
	override readonly name = "Error";
}

/** The view `load` resolved to: the value itself when it is a function (a `default` property on it is ignored), else
 * its `default` when that is a function; anything else throws, saying what it got. */
const pick = <S>(resolved: LiveRender<S> | { readonly default: LiveRender<S> }): LiveRender<S> => {
	if (P.isFunction(resolved)) return resolved;
	if (P.isObjectKeyword(resolved) && !P.isFunction(resolved)) {
		const fallback = resolved.default;
		if (P.isFunction(fallback)) return fallback;
	}
	throw LazyViewShapeError.make({ message: NO_VIEW(resolved) });
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
			(resolved) => {
				loaded = pick(resolved);
			},
			(error: unknown) => {
				// An import that failed (a network blip, a chunk not yet written) is the next run's to try again.
				pending = undefined;
				throw error;
			},
		);
		return pending;
	};
	const render = (state: S, frame: number): ReactElement => {
		if (loaded === undefined) throw LazyViewStateError.make({ message: NOT_LOADED });
		return loaded(state, frame);
	};
	render[LOAD] = ensure;
	return render;
};

/** A typed boundary around the loader's original rejection, retained for rendering unchanged. */
class LazyViewLoadError extends S.TaggedError<LazyViewLoadError>($I`LazyViewLoadError`)(
	"LazyViewLoadError",
	{ cause: S.Defect({ includeStack: true }).annotate({ description: "The original lazy-view load rejection, including a cached shape error." }) },
	$I.annote("LazyViewLoadError", { description: "A typed boundary retaining the lazy-view loader's original rejection." }),
) {
	override readonly name = "LazyViewLoadError";
}

/**
 * Load a lazy view's module before its render is first called; nothing for a render that is not lazy. Fails with what
 * the import failed with.
 *
 * @internal
 */
export const loadView = (render: unknown): Effect.Effect<void, LazyViewLoadError> => {
	const ensure = P.hasProperty(render, LOAD) ? render[LOAD] : undefined;
	return ensure === undefined
		? Effect.void
		: Effect.asVoid(Effect.tryPromise({
			try: () => {
				if (!P.isFunction(ensure)) throw LazyViewStateError.make({ message: "lazy view loader is not a function" });
				return Promise.resolve(ensure());
			},
			catch: (cause) => LazyViewLoadError.make({ cause }),
		}));
};
