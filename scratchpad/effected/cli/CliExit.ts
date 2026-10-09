import { Context, Effect, Layer, MutableRef } from "effect";
import { isExitCode } from "./internal/isExitCode.ts";

/**
 * The shape behind {@link CliExit}.
 *
 * @public
 */
export interface CliExitShape {
	/** The highest exit code recorded during the run; `0` until one is set. */
	readonly code: MutableRef.MutableRef<number>;
}

/**
 * The exit code a successful run wants, for commands whose findings are a
 * result rather than a failure (a linter that found problems, say).
 *
 * @remarks
 * Findings are not a failure — a JSON `tapError` must not fire, and the
 * handler must return normally — yet the process must exit non-zero. Writing
 * `process.exitCode` works only because Node's `runMain` skips
 * `process.exit(0)` on success; `process.exit(n)` in a handler skips every
 * finalizer. `CliRuntime.main` reads this cell after the program
 * succeeds and turns a non-zero code into a marked failure the runtime's
 * teardown honours, on any runtime, with finalizers intact.
 *
 * A `Service`, not a `Reference`: forgetting `CliRuntime.main` is a type error,
 * never a silently ignored global.
 *
 * @public
 */
export class CliExit extends Context.Service<CliExit, CliExitShape>()("@effected/cli/CliExit") {
	/**
	 * A fresh cell at `0`; `CliRuntime.main` provides it, and tests provide it
	 * directly.
	 *
	 * @remarks
	 * Every provide mints a new cell. Layers memoize by reference across
	 * `Effect.provide` calls, so without `Layer.fresh` a second provide of this
	 * layer anywhere in the program — a nested `CliRuntime.main`, a test
	 * helper — would silently share the first run's cell and inherit its code.
	 *
	 * A program run under `CliRuntime.main` must NOT provide `CliExit.layer`
	 * itself: `main` already provides one, and a second provide mints a second,
	 * unrelated cell that `main` never reads back, so `CliExit.set` calls made
	 * against it are silently discarded and the run exits `0`.
	 */
	static readonly layer: Layer.Layer<CliExit> = Layer.fresh(Layer.sync(this, () => ({ code: MutableRef.make(0) })));

	/**
	 * Record an exit code; the highest code set during the run wins.
	 *
	 * @remarks
	 * Highest-wins, not last-wins, so a later "clean" step cannot quietly
	 * downgrade an earlier finding's code.
	 *
	 * The code must be an integer in `0..255` — the range a POSIX exit status
	 * can carry. Anything else dies as a defect naming the value: `256` would
	 * wrap to exit `0` and silently pass a run with findings, and a fraction
	 * such as `1.5` makes `process.exit` throw `ERR_OUT_OF_RANGE` after the
	 * program has finished.
	 *
	 * The code only applies to a run that **succeeds**. A program failure beats
	 * findings: when the program fails, `CliRuntime.main` never reads this
	 * cell, and the failure's own exit code (or the `exitCode` fallback) wins.
	 */
	static readonly set = (code: number): Effect.Effect<void, never, CliExit> =>
		Effect.gen(function* () {
			if (!isExitCode(code)) {
				return yield* Effect.die(new Error(`CliExit.set: exit code must be an integer 0..255, received ${code}`));
			}
			const exit = yield* CliExit;
			if (code > MutableRef.get(exit.code)) MutableRef.set(exit.code, code);
		});
}
