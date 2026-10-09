import { Config, Effect } from "effect";

/**
 * Whether a drain mode drains: `true` and `false` as given, and `"auto"` unless `NODE_ENV` is exactly `"production"`.
 *
 * @remarks
 * React picks its development build whenever `NODE_ENV` is not exactly `"production"`, and that build records
 * user-timing entries on every render and never clears them. An
 * unset `NODE_ENV`, the common case for a CLI, leaks like `"development"`, so `"auto"` drains then too. `NODE_ENV` is
 * read through `Config`, so a test sets it with a `ConfigProvider` and `./ui` reads no `process`.
 *
 * @internal
 */
export const resolveDrain = (mode: boolean | "auto"): Effect.Effect<boolean> =>
	mode === "auto"
		? Config.String("NODE_ENV").pipe(
				Config.withDefault(""),
				Effect.map((env) => env !== "production"),
				Effect.orElseSucceed(() => true),
			)
		: Effect.succeed(mode);

/**
 * Clear every user-timing `measure` entry in the process, when `drain` is true.
 *
 * @remarks
 * The clear is global: it removes a consumer's own measures too, because the platform's `clearMeasures` filters only
 * by name, and React's entries (`Update`, `Mount`, tagged `detail.devtools`) share their names with anything a
 * consumer might call a measure. Marks are left alone: React's development build leaks measures only, never marks,
 * so clearing marks would only take a host's own. A runtime without `performance` is left alone.
 *
 * @internal
 */
export const drainPerformance = (drain: boolean): void => {
	if (!drain) return;
	const timing = globalThis.performance as Partial<Pick<Performance, "clearMeasures">> | undefined;
	timing?.clearMeasures?.();
};
