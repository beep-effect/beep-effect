import { NodeServices } from "@effect/platform-node";
import { WorkflowCommand } from "../github-commands/index.ts";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as LogLevel from "effect/LogLevel";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as References from "effect/References";
import * as Result from "effect/Result";
import type { HttpClient } from "effect/http";
import { FetchHttpClient } from "effect/http";
import { ActionEnvironment } from "./ActionEnvironment.ts";
import { ActionInput } from "./ActionInput.ts";
import { ActionLogger } from "./ActionLogger.ts";
import { ActionOutputs } from "./ActionOutputs.ts";
import { ActionState } from "./ActionState.ts";

/**
 * Everything {@link ActionRuntime.layer} provides.
 *
 * @remarks
 * Spelled out rather than inferred so a caller can name it — a program written
 * against `ActionServices` is a program `Action.run` can run, and the compiler
 * says so before the runner does.
 *
 * @public
 */
export type ActionServices =
	| ActionEnvironment
	| ActionLogger
	| ActionOutputs
	| ActionState
	| NodeServices.NodeServices
	| HttpClient.HttpClient;

/**
 * The default runtime an action executes inside.
 *
 * @remarks
 * The one place in the kit where `@effect/platform-node` is composed rather
 * than left to the consumer, and the reason is that there is no second answer:
 * a GitHub Action is a Node process on a GitHub-provided runner.
 *
 * **The cache, artifact and blob services are deliberately NOT in here.** They
 * are the only modules that import `@azure/storage-blob`, and folding them into
 * the default runtime would put a blob-storage client in the bundle of every
 * action that merely sets an output. Their requirements are all satisfied by
 * this layer, so taking one costs a caller exactly one line:
 * `Action.run(program, { layer: ActionCache.layer })`.
 *
 * @public
 */
export class ActionRuntime {
	private constructor() {}

	/**
	 * The composed default: the runner services, the platform, an HTTP client
	 * and the workflow-command `Logger`.
	 *
	 * @remarks
	 * A bound constant rather than a factory. A layer-returning function mints a
	 * fresh layer per call, and layers memoize by reference — a factory here
	 * would rebuild the environment snapshot for every composition site.
	 */
	static readonly layer: Layer.Layer<ActionServices> = Layer.mergeAll(
		ActionLogger.layer,
		// The named constant, not a second spelling of it: two `Logger.layer([...])`
		// values with the same contents are different layers and memoize separately.
		ActionLogger.layerLogger,
		ActionState.layer,
		// The inputs-first config provider, NOT the record-backed test double
		// (`ActionInput.layer()`, which replaces the environment lookup wholesale
		// and stays exported for resolving inputs from an explicit record in a
		// test). This one changes bare `Config` reads only: a flat name tries the
		// runner's INPUT_ derivation first and then falls back to the ambient
		// lookup unchanged. It is needed because the runner publishes
		// INPUT_<MANGLED>, so a plain-named lookup finds nothing and every bare
		// read would silently fall back to its `withDefault`. A caller-supplied provider in the `layer` option still wins:
		// the extra layer's context merges last in `Action.run`'s composition.
		ActionInput.layerDefault,
	).pipe(
		// `provideMerge` rather than a flat `mergeAll`, and the difference is the
		// whole wiring: `ActionState` needs `ActionOutputs` (it masks before it
		// persists) and `ActionOutputs` needs `ActionEnvironment`. Merged as
		// siblings they would not see each other, and the layer would not build.
		Layer.provideMerge(ActionOutputs.layer),
		Layer.provideMerge(ActionEnvironment.layer),
		Layer.provideMerge(Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer)),
	);
}

/**
 * How to run an action.
 *
 * @public
 */
export interface ActionRunOptions<R> {
	/**
	 * Services the program needs beyond {@link ActionServices}.
	 *
	 * @remarks
	 * It may require anything {@link ActionRuntime.layer} provides — which is
	 * what makes `{ layer: ActionCache.layer }` compile with no further wiring.
	 */
	readonly layer?: Layer.Layer<R, never, ActionServices> | undefined;
	/**
	 * Whether step debugging lowers the minimum log level to `Debug`.
	 *
	 * @remarks
	 * Defaults to `true`. With step debugging on (`RUNNER_DEBUG=1`, read through
	 * {@link ActionEnvironmentShape.isDebug}), `Action.run` lowers core's
	 * `References.MinimumLogLevel` — `Info` by default — to `Debug` for the whole
	 * program, so `Effect.logDebug` calls reach the runner as `::debug::` lines
	 * instead of being filtered before any logger sees them. It only ever
	 * **lowers**: a level already at `Debug` or below, from the `layer` option,
	 * is left alone.
	 *
	 * Pass `false` to keep the ambient level regardless of step debugging — an
	 * action whose debug output is too heavy to show even to someone who asked
	 * for it. A program can still provide its own `MinimumLogLevel` either way;
	 * the innermost provision wins.
	 */
	readonly stepDebugLogLevel?: boolean | undefined;
}

/**
 * Lower the minimum log level to `Debug` for the program when the runner has
 * step debugging on — and never raise it.
 */
const withStepDebugLogLevel = <A, E, R>(program: Effect.Effect<A, E, R>): Effect.Effect<A, E, R | ActionEnvironment> =>
	Effect.gen(function* () {
		const env = yield* ActionEnvironment;
		const stepDebug = yield* env.isDebug;
		const minimum = yield* References.MinimumLogLevel;
		return yield* stepDebug && LogLevel.isGreaterThan(minimum, "Debug")
			? Effect.provideService(program, References.MinimumLogLevel, "Debug")
			: program;
	});

/**
 * A readable one-line summary of why an action failed.
 *
 * @remarks
 * `[Tag]: message` because a workflow log is read by a human scanning for the
 * first red line, and every error in this kit carries both. The `_tag` is what
 * makes two failures with the same wording distinguishable, and the `message`
 * getter is what makes the line worth reading.
 *
 * An interruption has neither, and `Cause.pretty` is the honest answer for it.
 *
 * @public
 */
export const describeCause = (cause: Cause.Cause<unknown>): string => {
	const failure = Cause.findErrorOption(cause);
	if (O.isSome(failure)) {
		return describeError(failure.value);
	}
	const defect = Cause.findDefect(cause);
	if (Result.isSuccess(defect)) {
		return `[defect] ${describeError(defect.success)}`;
	}
	const pretty = Cause.pretty(cause);
	return pretty.trim() === "" ? "the action failed with no diagnostic information" : pretty;
};

/** The `[Tag]: message` half, over anything a failure or a defect can be. */
const describeError = (error: unknown): string => {
	if (typeof error === "object" && error !== null && "_tag" in error) {
		const tagged = error;
		const detail =
			P.hasProperty(tagged, "message") && P.isString(tagged.message) && tagged.message !== ""
				? `: ${tagged.message}`
				: "";
		return `[${String(tagged._tag)}]${detail}`;
	}
	return error instanceof Error ? `[${error.name}]: ${error.message}` : `[unknown]: ${String(error)}`;
};

/**
 * The entry point an action's `main`, `pre` and `post` scripts call.
 *
 * @remarks
 * Everything an action entry point does that is not the action: compose the
 * runtime, run the program, render a failure as a `::error::` annotation, and
 * **set the exit code** — which is the piece
 * `ActionOutputs.setFailed` deliberately leaves alone, so an action that
 * reports a failure and then recovers is not doomed by a side effect it cannot
 * undo.
 *
 * It also honours **step debugging**: when the runner sets `RUNNER_DEBUG=1`, it
 * lowers core's `References.MinimumLogLevel` from its `Info` default to
 * `Debug`, so `Effect.logDebug` anywhere in the program — or in any
 * `@effected` library it calls — reaches the runner as a `::debug::` line
 * rather than being filtered before a logger sees it. It only ever lowers the
 * level, and `{ stepDebugLogLevel: false }` ({@link ActionRunOptions}) opts
 * out.
 *
 * Two things it deliberately does **not** do:
 *
 * - **It does not wrap the program in a log buffer.** A buffer that swallowed
 *   the transcript on an unhandled defect would leave a run that failed and
 *   printed nothing. `ActionLogger.withBuffer` is opt-in and flushes on every
 *   exit path including a defect, so the buffering is where the caller can
 *   see it.
 * - **It does not throw.** The returned promise always resolves; the failure is
 *   in `process.exitCode`, which is what the runner reads. An action entry
 *   point that rejected would produce an unhandled rejection *and* a failed
 *   step, and only the first would be legible.
 *
 * The rendering depth is deliberate too: one `::error::` line carrying
 * `[Tag]: message`, and the fiddly diagnostics — the full `Cause.pretty` render
 * with its span trace and stack — behind `::debug::`, which the runner shows
 * only when someone turns step debugging on. No JS stack is spliced into the
 * visible error, because in a bundled action it points at one line of
 * `dist/main.js`.
 *
 * @example
 * ```ts
 * import { Action, ActionCache } from "./index.ts";
 *
 * await Action.run(program, { layer: ActionCache.layer });
 * ```
 *
 * @public
 */
export class Action {
	private constructor() {}

	/** {@link describeCause}, so an action can render its own failures the same way. */
	static readonly describeCause = describeCause;

	/**
	 * Run an action program to completion.
	 *
	 * @remarks
	 * Never rejects: the promise resolves whether the program succeeded or not,
	 * so read `process.exitCode` for the verdict. Requirements beyond
	 * {@link ActionServices} come from `options.layer`.
	 */
	static readonly run = <E, R = never>(
		program: Effect.Effect<void, E, ActionServices | R>,
		options: ActionRunOptions<R> = {},
	): Promise<void> => {
		const extra = options.layer;
		const composed =
			extra === undefined
				? ActionRuntime.layer
				: Layer.mergeAll(ActionRuntime.layer, Layer.provide(extra, ActionRuntime.layer));

		// Inside the provide, so the level read is the one the composed runtime —
		// including a caller's `layer` — actually installed.
		const leveled = options.stepDebugLogLevel === false ? program : withStepDebugLogLevel(program);

		const runnable = Effect.scopedWith((scope) =>
			Effect.flatMap(Layer.buildWithScope(composed, scope), (context) =>
				// This entry point trusts the caller's layer for R; an omitted service still defects at use.
				Effect.provideContext(leveled, Context.makeUnsafe<ActionServices | R>(context.mapUnsafe)),
			),
		).pipe(
			Effect.exit,
			Effect.flatMap((exit) =>
				Exit.isSuccess(exit)
					? Effect.void
					: Effect.gen(function* () {
							// Written with the workflow-command renderer rather than through
							// the `Logger`, because this runs after the program — and after
							// whatever went wrong with it.
							const detail = Cause.pretty(exit.cause);
							if (detail.trim() !== "") {
								yield* Console.log(WorkflowCommand.render("debug", {}, detail));
							}
							yield* Console.log(WorkflowCommand.render("error", {}, `Action failed: ${describeCause(exit.cause)}`));
							process.exitCode = 1;
						}),
			),
		);

		return Effect.runPromise(runnable).catch(() => {
			// The last resort. If rendering the failure itself failed, the step must
			// still fail: a green step for a crashed action is the worst outcome
			// available here.
			process.exitCode = 1;
		});
	};
}
