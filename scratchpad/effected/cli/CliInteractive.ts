import { $ScratchpadId } from "@beep/identity/packages";
import { Audience, TerminalEnv } from "../env/index.ts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { canPrompt } from "./internal/canPrompt.ts";

const $I = $ScratchpadId.create("effected/cli/CliInteractive");

/**
 * Whether this run may prompt a person: a human audience, with a terminal on
 * both standard input and standard output, and a `TERM` that is not `dumb`.
 *
 * **Details**
 *
 * A `Context.Reference`, not a `Context.Service`, for three reasons. It is one
 * boolean with a safe default, which is what a reference is for. A scoped
 * override, {@link CliInteractive.unless}, is a plain
 * `Effect.provideService`, so a command can switch prompting off for one
 * subtree without a layer. And forgetting to provide it is not a type error
 * but a harmless answer, since it reads `false` when no layer is provided: a
 * program that never wired it refuses to prompt rather than hanging on a
 * terminal that is not there. Read it with `yield* CliInteractive`.
 *
 * Because a reference's key type is `never`, {@link CliInteractive.layer} and
 * {@link CliInteractive.layerTest} are typed `Layer<never>`: they set the
 * reference rather than provide a service.
 *
 * **Example** (Read the safe interactivity default)
 *
 * ```ts
 * import { CliInteractive } from "@beep/scratchpad/effected/cli/CliInteractive";
 * import * as Effect from "effect/Effect";
 *
 * console.log(Effect.runSync(CliInteractive)); // false
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class CliInteractive extends Context.Reference<boolean>($I`CliInteractive`, {
	defaultValue: () => false,
}) {
	/**
 * Decide from the audience and the terminal: `true` only for a human audience with a terminal on both
 * standard input and standard output, and a `TERM` that is not `dumb`.
 *
 * **Details**
 *
 * A dumb terminal is a terminal, but it cannot move the cursor or take synchronized output, which a prompt or a
 * screen redrawing in place needs: it gets what a pipe gets. `TERM` is read through the ambient `ConfigProvider`,
 * as `@effected/env` reads the environment, so it adds no requirement; a test fixes it with
 * `Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ TERM: "dumb" }))`.
 *
 * Bind the layer to a constant and provide it once; `Audience` and `TerminalEnv` come from `@effected/env`.
 *
 * **Example** (Inspect the audience and terminal decision layer)
 *
 * ```ts
 * import { CliInteractive } from "@beep/scratchpad/effected/cli/CliInteractive";
 * import * as Layer from "effect/Layer";
 *
 * console.log(Layer.isLayer(CliInteractive.layer)); // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
	static readonly layer: Layer.Layer<never, never, Audience | TerminalEnv> = Layer.effect(
		CliInteractive,
		Effect.gen(function* () {
			const audience = yield* Audience;
			const terminal = yield* TerminalEnv;
			return audience.kind === "human" && (yield* canPrompt(terminal));
		}),
	);

	/**
 * A fixed answer that needs nothing.
 *
 * **Example** (Enable prompting within a test scope)
 *
 * ```ts
 * import { CliInteractive } from "@beep/scratchpad/effected/cli/CliInteractive";
 * import * as Effect from "effect/Effect";
 *
 * const program = CliInteractive.pipe(Effect.provide(CliInteractive.layerTest(true)));
 * console.log(Effect.runSync(program)); // true
 * ```
 *
 * @param value - whether the run is interactive
 * @category layers
 * @since 0.0.0
 */
	static readonly layerTest = (value: boolean): Layer.Layer<never> => Layer.succeed(CliInteractive, value);

	/**
 * Run `self` with interactivity switched off when `condition` holds.
 *
 * **Details**
 *
 * It only narrows: `unless(false)` leaves the current value alone and never turns interactivity on, so a
 * non-interactive scope stays non-interactive. The outer value is restored when `self` ends, whether it
 * succeeds, fails or is interrupted.
 *
 * A flag that resolves the audience (`--human`, under `CliAudience.runWith` or `provide`) recomputes interactivity
 * from the terminal facts, so it can override an outer `unless` or a `layerTest(false)`: those narrow the
 * environment's answer, and the flag is a later, explicit one.
 *
 * **Example** (Disable prompting for one subtree)
 *
 * ```ts
 * import { CliInteractive } from "@beep/scratchpad/effected/cli/CliInteractive";
 * import * as Effect from "effect/Effect";
 *
 * const program = CliInteractive.pipe(
 *   CliInteractive.unless(true),
 *   Effect.provide(CliInteractive.layerTest(true)),
 * );
 * console.log(Effect.runSync(program)); // false
 * ```
 *
 * @param condition - `true` to switch prompting off for `self`
 * @category combinators
 * @since 0.0.0
 */
	static readonly unless = (condition: boolean) =>
		Effect.fnUntraced(function* <A, E, R>(self: Effect.Effect<A, E, R>): Effect.fn.Return<A, E, R> {
			const current = yield* CliInteractive;
			return yield* Effect.provideService(self, CliInteractive, current && !condition);
		});
}
