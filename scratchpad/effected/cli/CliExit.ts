import * as S from "effect/Schema";
import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import { isExitCode } from "./internal/isExitCode.ts";

const $I = $ScratchpadId.create("effected/cli/CliExit");

class InvalidExitCodeError extends S.TaggedError<InvalidExitCodeError>($I`InvalidExitCodeError`)(
	"InvalidExitCodeError",
	{
		message: S.String.annotate({ description: "The invalid exit-code value and the required POSIX integer range." }),
	},
	$I.annote("InvalidExitCodeError", { description: "An exit code supplied to CliExit.set was not an integer in the POSIX range 0..255." }),
) {}

/**
 * The shape behind {@link CliExit}.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface CliExitShape {
	/** The highest exit code recorded during the run; `0` until one is set. */
	readonly code: MutableRef.MutableRef<number>;
}

/**
 * The exit code a successful run wants, for commands whose findings are a
 * result rather than a failure (a linter that found problems, say).
 *
 * **Details**
 *
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
 * **Example** (Keep the highest findings exit code)
 *
 * ```ts
 * import { CliExit } from "@beep/scratchpad/effected/cli/CliExit";
 * import * as Effect from "effect/Effect";
 * import * as MutableRef from "effect/MutableRef";
 *
 * const program = Effect.gen(function* () {
 *   yield* CliExit.set(2);
 *   yield* CliExit.set(1);
 *   const exit = yield* CliExit;
 *   return MutableRef.get(exit.code);
 * }).pipe(Effect.provide(CliExit.layer));
 * console.log(Effect.runSync(program)); // 2
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class CliExit extends Context.Service<CliExit, CliExitShape>()($I`CliExit`) {
	/**
 * A fresh cell at `0`; `CliRuntime.main` provides it, and tests provide it
 * directly.
 *
 * **Gotchas**
 *
 * Every provide mints a new cell. Layers memoize by reference across
 * `Effect.provide` calls, so without `Layer.fresh` a second provide of this
 * layer anywhere in the program — a nested `CliRuntime.main`, a test
 * helper — would silently share the first run's cell and inherit its code.
 *
 * A program run under `CliRuntime.main` must NOT provide `CliExit.layer`
 * itself: `main` already provides one, and a second provide mints a second,
 * unrelated cell that `main` never reads back, so `CliExit.set` calls made
 * against it are silently discarded and the run exits `0`.
 *
 * **Example** (Start a test with a clean exit cell)
 *
 * ```ts
 * import { CliExit } from "@beep/scratchpad/effected/cli/CliExit";
 * import * as Effect from "effect/Effect";
 * import * as MutableRef from "effect/MutableRef";
 *
 * const program = Effect.map(CliExit, (exit) => MutableRef.get(exit.code)).pipe(Effect.provide(CliExit.layer));
 * console.log(Effect.runSync(program)); // 0
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
	static readonly layer: Layer.Layer<CliExit> = Layer.fresh(
		Layer.sync(this, () => ({ code: MutableRef.make(0) })),
	);

	/**
 * Record an exit code; the highest code set during the run wins.
 *
 * **Gotchas**
 *
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
 *
 * **Example** (Preserve an earlier findings code)
 *
 * ```ts
 * import { CliExit } from "@beep/scratchpad/effected/cli/CliExit";
 * import * as Effect from "effect/Effect";
 * import * as MutableRef from "effect/MutableRef";
 *
 * const program = Effect.gen(function* () {
 *   yield* CliExit.set(2);
 *   yield* CliExit.set(1);
 *   const exit = yield* CliExit;
 *   return MutableRef.get(exit.code);
 * }).pipe(Effect.provide(CliExit.layer));
 * console.log(Effect.runSync(program)); // 2
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
	static readonly set = Effect.fn("set")(function* (code: number): Effect.fn.Return<void, never, CliExit> {
		if (!isExitCode(code)) {
			return yield* Effect.die(
				InvalidExitCodeError.make({
					message: `CliExit.set: exit code must be an integer 0..255, received ${code}`,
				}),
			);
		}
		const exit = yield* CliExit;
		if (code > MutableRef.get(exit.code)) MutableRef.set(exit.code, code);
	});
}
