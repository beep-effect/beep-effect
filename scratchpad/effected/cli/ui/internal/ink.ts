import * as Data from "effect/Data";
import { dual } from "effect/Function";
import type { ColorLevel } from "../../../env/index.ts";
import type * as Scope from "effect/Scope";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import type * as Ink from "ink";
import type React from "react";
import type { ChalkLevel, InkChalk } from "./inkChalk.ts";
import { inkChalk } from "./inkChalk.ts";

class TestError extends Data.TaggedError("TestError")<{ readonly message: string; readonly cause?: unknown }> {
	override readonly name = "Error";
	constructor(message: string, options?: { readonly cause?: unknown }) { super({ message, ...options }); }
}

/**
 * The loaded optional peers: Ink's module and React.
 *
 * @internal
 */
export interface InkModules {
	readonly ink: typeof Ink;
	readonly react: typeof React;
}

const MISSING_PEERS =
	"@effected/cli/ui could not load its optional peers ink and react: install both beside @effected/cli to mount a screen";

const READ_BEFORE_LOAD =
	"@effected/cli/ui read Ink before loading it: run CliUi.context (or mount a screen with CliUi.run) before rendering UiProvider or a kit component in a tree of your own";

const UNRESOLVED_CHALK =
	"@effected/cli/ui could not resolve the chalk Ink uses (is ink bundled?), so Ink decides its own colour level";

let modules: InkModules | undefined;
let loading: Promise<InkModules> | undefined;

const importPeers = (): Promise<InkModules> => Promise.all([import("ink"), import("react")]).then(([ink, react]) => ({ ink, react: react.default }));

/**
 * Load `ink` and `react`, once. The only runtime access the kit has to either package: nothing imports a value
 * from them, so importing `./ui` loads neither, and only mounting a screen does.
 *
 * @remarks
 * Concurrent loads share one import, and a failed one is retried by the next call. A missing peer is a defect, not
 * a typed failure, because it is an installation error no handler can recover from; its message names both peers.
 *
 * @internal
 */
export const loadInk: Effect.Effect<InkModules> = Effect.suspend(() => {
	if (modules !== undefined) return Effect.succeed(modules);
	return Effect.tryPromise({
		try: () => {
			loading ??= importPeers();
			return loading;
		},
		catch: (cause) => new TestError(MISSING_PEERS, { cause }),
	}).pipe(
		Effect.tap((loaded) =>
			Effect.sync(() => {
				modules = loaded;
			}),
		),
		Effect.tapError(() =>
			Effect.sync(() => {
				loading = undefined;
			}),
		),
		Effect.orDie,
	);
});

/**
 * The modules {@link loadInk} loaded, read at render time by kit components.
 *
 * @remarks
 * Throws when nothing has loaded them: a kit component rendered outside a screen. Inside a render that throw is
 * caught by the screen's error boundary and becomes a defect.
 *
 * @internal
 */
export const inkModules = (): InkModules => {
	if (modules === undefined) throw new Error(READ_BEFORE_LOAD);
	return modules;
};

/**
 * A value built once from the loaded React, such as a class component or a context, which cannot be declared at
 * module scope because the kit holds no runtime React until {@link loadInk} runs.
 *
 * @remarks
 * The returned accessor builds on first call and returns the same value thereafter; like {@link inkModules}, it
 * throws if called before the load.
 *
 * @internal
 */
export const fromReact = <T>(build: (react: InkModules["react"]) => T): (() => T) => {
	let built: { readonly react: InkModules["react"]; readonly value: T } | undefined;
	return () => {
		const { react } = inkModules();
		if (built === undefined || built.react !== react) built = { react, value: build(react) };
		return built.value;
	};
};

const LEVELS: Record<ColorLevel, ChalkLevel> = { none: 0, basic: 1, "256": 2, truecolor: 3 };

/**
 * A stream's colour level as a chalk level: `none` 0, `basic` 1, `256` 2, `truecolor` 3.
 *
 * @internal
 */
export const levelOf = (colour: ColorLevel): ChalkLevel => LEVELS[colour];

let chalk: Promise<O.Option<InkChalk>> | undefined;
const resolveChalk: Effect.Effect<O.Option<InkChalk>> = Effect.promise(() => {
	chalk ??= inkChalk();
	return chalk;
});

let warned = false;

/**
 * Hold `chalk` at `colour`'s level for the enclosing scope, restoring the saved level when the scope closes, by
 * release or by interruption. With no chalk to hold, warn once and leave Ink's own detection in place.
 *
 * @internal
 */
export const holdChalkLevel: {
	(colour: ColorLevel): (found: O.Option<InkChalk>) => Effect.Effect<void, never, Scope.Scope>;
	(found: O.Option<InkChalk>, colour: ColorLevel): Effect.Effect<void, never, Scope.Scope>;
} = dual(2, (
	found: O.Option<InkChalk>,
	colour: ColorLevel,
): Effect.Effect<void, never, Scope.Scope> =>
	O.match(found, {
		onNone: () =>
			Effect.suspend(() => {
				if (warned) return Effect.void;
				warned = true;
				return Effect.logWarning(UNRESOLVED_CHALK);
			}),
		onSome: (instance) =>
			Effect.asVoid(
				Effect.acquireRelease(
					Effect.sync(() => {
						const saved = instance.level;
						instance.level = levelOf(colour);
						return saved;
					}),
					(saved) =>
						Effect.sync(() => {
							instance.level = saved;
						}),
				),
			),
	}));

/**
 * Set Ink's colour level from the stream's `ColorLevel` for the enclosing scope, on Ink's own chalk. The level is process-global while held: the last screen
 * mounted wins.
 *
 * @internal
 */
export const withInkColour = (colour: ColorLevel): Effect.Effect<void, never, Scope.Scope> =>
	Effect.flatMap(resolveChalk, (found) => holdChalkLevel(found, colour));
