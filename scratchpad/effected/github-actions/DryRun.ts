import { $ScratchpadId } from "@beep/identity/packages";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { ActionInput } from "./ActionInput.ts";

const $I = $ScratchpadId.create("effected/github-actions/DryRun");

/**
 * The {@link DryRun} service shape.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface DryRunShape {
	/**
	 * Whether this run is a rehearsal.
	 *
	 * @since 0.0.0
	 */
	readonly isDryRun: Effect.Effect<boolean>;
	/**
	 * Run a mutation, or skip it and take the fallback.
	 *
	 * **Details**
	 *
	 * The `label` is what a dry run reports instead of doing the work, so it
	 * should name the mutation from the workflow author's point of view
	 * (`"publish @acme/thing@1.2.3"`), not the function that would have run it.
	 *
	 * The fallback is required rather than optional on purpose: a mutation whose
	 * result the caller uses must say what a rehearsal produces instead, and the
	 * type is the place to force that. For a `void` mutation it is simply
	 * `undefined`.
	 *
	 * @since 0.0.0
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
 * **Details**
 *
 * A service rather than a boolean threaded through call sites, because the
 * decision has to be available wherever a mutation is, and because a test that
 * wants to prove "this path mutates nothing" provides one layer instead of
 * auditing every branch.
 *
 * **Example** (Guard package publication during a dry run)
 *
 * ```ts
 * import { DryRun } from "@beep/scratchpad/effected/github-actions/DryRun";
 * import * as Effect from "effect/Effect";
 *
 * let published = false;
 * const publish = Effect.sync(() => { published = true; });
 * const program = Effect.gen(function* () {
 *   const dryRun = yield* DryRun;
 *   yield* dryRun.guard("publish @acme/thing@1.2.3", publish, undefined);
 * });
 * Effect.runSync(program.pipe(Effect.provide(DryRun.layerFrom(true))));
 * console.log(published) // false
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class DryRun extends Context.Service<DryRun, DryRunShape>()($I`DryRun`) {
	/**
	 * Driven by a named input.
	 *
	 * **Gotchas**
	 *
	 * A parameterized layer factory mints a fresh layer per call and layers
	 * memoize by reference — bind it to a `const` rather than calling it at each
	 * composition site.
	 *
	 * **Example** (Bind a named rehearsal layer once)
	 *
	 * ```ts
	 * import { DryRun } from "@beep/scratchpad/effected/github-actions/DryRun";
	 * import * as Layer from "effect/Layer";
	 *
	 * const rehearsal = DryRun.layerFromInput("preview");
	 * console.log(Layer.isLayer(rehearsal)) // true
	 * ```
	 *
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layerFromInput = (name: string): Layer.Layer<DryRun, Config.ConfigError> =>
		Layer.effect(DryRun, Effect.map(ActionInput.boolean(name).pipe(Config.withDefault(false)), make));

	/**
	 * Driven by the `dry-run` action input, defaulting to a real run.
	 *
	 * **Gotchas**
	 *
	 * Fails with a `ConfigError` when the input is present but is not a YAML 1.2
	 * core-schema boolean — a workflow that writes `dry-run: yes` should stop,
	 * not quietly perform the mutations it meant to rehearse.
	 *
	 * **Example** (Inspect the action-input rehearsal layer)
	 *
	 * ```ts
	 * import { DryRun } from "@beep/scratchpad/effected/github-actions/DryRun";
	 * import * as Layer from "effect/Layer";
	 *
	 * console.log(Layer.isLayer(DryRun.layer)) // true
	 * ```
	 *
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layer: Layer.Layer<DryRun, Config.ConfigError> = DryRun.layerFromInput(DEFAULT_INPUT);

	/**
	 * Driven by an explicit decision the caller has already made.
	 *
	 * **Example** (Read an explicit rehearsal decision)
	 *
	 * ```ts
	 * import { DryRun } from "@beep/scratchpad/effected/github-actions/DryRun";
	 * import * as Effect from "effect/Effect";
	 *
	 * const program = Effect.flatMap(DryRun, (dryRun) => dryRun.isDryRun);
	 * console.log(Effect.runSync(program.pipe(Effect.provide(DryRun.layerFrom(true))))) // true
	 * ```
	 *
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layerFrom = (enabled: boolean): Layer.Layer<DryRun> => Layer.succeed(DryRun, make(enabled));

	/**
	 * A double that rehearses.
	 *
	 * **Details**
	 *
	 * **A recorded exception to the die-on-unstubbed rule.** The default is not a
	 * fabrication but the safe direction: a test that forgot to say which mode it
	 * wants gets the mode that mutates nothing. The members are the real
	 * implementation, so the double cannot drift from it.
	 *
	 * **Example** (Inspect the safe default test mode)
	 *
	 * ```ts
	 * import { DryRun } from "@beep/scratchpad/effected/github-actions/DryRun";
	 * import * as Effect from "effect/Effect";
	 *
	 * console.log(Effect.runSync(DryRun.makeTest().isDryRun)) // true
	 * ```
	 *
	 * @category testing
	 * @since 0.0.0
	 */
	static readonly makeTest = (overrides: Partial<DryRunShape> = {}): DryRunShape => ({
		...make(true),
		...overrides,
	});

	/**
	 * Provides {@link DryRun.makeTest} behind `Layer.succeed`.
	 *
	 * **Example** (Provide the default rehearsal test layer)
	 *
	 * ```ts
	 * import { DryRun } from "@beep/scratchpad/effected/github-actions/DryRun";
	 * import * as Effect from "effect/Effect";
	 *
	 * const program = Effect.flatMap(DryRun, (dryRun) => dryRun.isDryRun);
	 * console.log(Effect.runSync(program.pipe(Effect.provide(DryRun.layerTest())))) // true
	 * ```
	 *
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layerTest = (overrides: Partial<DryRunShape> = {}): Layer.Layer<DryRun> =>
		Layer.succeed(DryRun, DryRun.makeTest(overrides));
}
