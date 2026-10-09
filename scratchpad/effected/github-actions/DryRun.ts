import { Config, Context, Effect, Layer } from "effect";
import { ActionInput } from "./ActionInput.ts";

/**
 * The {@link DryRun} service shape.
 *
 * @public
 */
export interface DryRunShape {
	/** Whether this run is a rehearsal. */
	readonly isDryRun: Effect.Effect<boolean>;
	/**
	 * Run a mutation, or skip it and take the fallback.
	 *
	 * @remarks
	 * The `label` is what a dry run reports instead of doing the work, so it
	 * should name the mutation from the workflow author's point of view
	 * (`"publish @acme/thing@1.2.3"`), not the function that would have run it.
	 *
	 * The fallback is required rather than optional on purpose: a mutation whose
	 * result the caller uses must say what a rehearsal produces instead, and the
	 * type is the place to force that. For a `void` mutation it is simply
	 * `undefined`.
	 */
	readonly guard: <A, E, R>(label: string, effect: Effect.Effect<A, E, R>, fallback: A) => Effect.Effect<A, E, R>;
}

/** The input a workflow author sets to rehearse a run. */
const DEFAULT_INPUT = "dry-run";

const make = (enabled: boolean): DryRunShape => ({
	isDryRun: Effect.succeed(enabled),
	guard: <A, E, R>(label: string, effect: Effect.Effect<A, E, R>, fallback: A) =>
		enabled ? Effect.as(Effect.logInfo(`[DRY-RUN] ${label}`), fallback) : effect,
});

/**
 * The rehearsal guard: every mutation an action performs goes through it, so a
 * workflow can be run end to end without changing anything.
 *
 * @remarks
 * A service rather than a boolean threaded through call sites, because the
 * decision has to be available wherever a mutation is, and because a test that
 * wants to prove "this path mutates nothing" provides one layer instead of
 * auditing every branch.
 *
 * @example
 * ```ts
 * import { DryRun } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const dryRun = yield* DryRun;
 *   yield* dryRun.guard("publish @acme/thing@1.2.3", publish, undefined);
 * });
 * ```
 *
 * @public
 */
export class DryRun extends Context.Service<DryRun, DryRunShape>()("@beep/scratchpad/effected/github-actions/DryRun") {
	/**
	 * Driven by a named input.
	 *
	 * @remarks
	 * A parameterized layer factory mints a fresh layer per call and layers
	 * memoize by reference — bind it to a `const` rather than calling it at each
	 * composition site.
	 */
	static readonly layerFromInput = (name: string): Layer.Layer<DryRun, Config.ConfigError> =>
		Layer.effect(DryRun, Effect.map(ActionInput.boolean(name).pipe(Config.withDefault(false)), make));

	/**
	 * Driven by the `dry-run` action input, defaulting to a real run.
	 *
	 * @remarks
	 * Fails with a `ConfigError` when the input is present but is not a YAML 1.2
	 * core-schema boolean — a workflow that writes `dry-run: yes` should stop,
	 * not quietly perform the mutations it meant to rehearse.
	 */
	static readonly layer: Layer.Layer<DryRun, Config.ConfigError> = DryRun.layerFromInput(DEFAULT_INPUT);

	/** Driven by an explicit decision the caller has already made. */
	static readonly layerFrom = (enabled: boolean): Layer.Layer<DryRun> => Layer.succeed(DryRun, make(enabled));

	/**
	 * A double that rehearses.
	 *
	 * @remarks
	 * **A recorded exception to the die-on-unstubbed rule.** The default is not a
	 * fabrication but the safe direction: a test that forgot to say which mode it
	 * wants gets the mode that mutates nothing. The members are the real
	 * implementation, so the double cannot drift from it.
	 */
	static readonly makeTest = (overrides: Partial<DryRunShape> = {}): DryRunShape => ({
		...make(true),
		...overrides,
	});

	/** {@link DryRun.makeTest} behind `Layer.succeed`. */
	static readonly layerTest = (overrides: Partial<DryRunShape> = {}): Layer.Layer<DryRun> =>
		Layer.succeed(DryRun, DryRun.makeTest(overrides));
}
