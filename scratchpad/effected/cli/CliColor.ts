import { TerminalEnv } from "../env/index.ts";
import type * as Stdio from "effect/Stdio";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { CliOutput } from "effect/cli";

/**
 * Whether a CLI's output should carry ANSI colour, decided once and shared by
 * everything that renders — help text, error output, and any rendered result.
 *
 * **Details**
 *
 * The decision is `@effected/env`'s `TerminalEnv.colorLevel("stdout")`, which
 * follows Node's `getColorDepth` precedence: `FORCE_COLOR` first (`0` or an
 * unrecognised value forces colour off; an empty value, `1` or `true` force basic colour, `2` 256 colours and
 * `3` truecolor, even without a terminal), then a non-empty `NO_COLOR` or `NODE_DISABLE_COLORS` and
 * `TERM=dumb`, then the TTY gate. `FORCE_COLOR` therefore beats `NO_COLOR`.
 * The environment
 * is read through the ambient `ConfigProvider`, never `process`, so a test
 * swaps it with `Effect.provideService(ConfigProvider.ConfigProvider, ...)`;
 * an ambient `TerminalEnv`, such as `TerminalEnv.layerTest`, answers instead
 * when one is provided.
 *
 * **Example** (Construct the shared color decision)
 *
 * ```ts
 * import { CliColor } from "@beep/scratchpad/effected/cli/CliColor";
 * import * as Effect from "effect/Effect";
 *
 * console.log(Effect.isEffect(CliColor.enabled)); // true
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class CliColor {
	private constructor() {}

	/**
 * The decision, for passing to a pure renderer as a plain boolean.
 *
 * **Example** (Inspect the deferred color decision)
 *
 * ```ts
 * import { CliColor } from "@beep/scratchpad/effected/cli/CliColor";
 * import * as Effect from "effect/Effect";
 *
 * console.log(Effect.isEffect(CliColor.enabled)); // true
 * ```
 *
 * @public
 * @category queries
 * @since 0.0.0
 */
	static readonly enabled: Effect.Effect<boolean, never, Stdio.Stdio> = TerminalEnv.colorLevel("stdout").pipe(
		Effect.map((level) => level !== "none"),
	);

	/**
 * Core's default `CliOutput.Formatter`, coloured by the same decision as
 * {@link CliColor.enabled}, so help text, parse errors and rendered
 * output never disagree on whether colour is on.
 *
 * **Details**
 *
 * `overrides` replaces individual methods of the default formatter — for
 * example `formatVersion`, to append a "via `<carrier>`" line without
 * losing the other defaults. Each call mints a fresh layer; bind the
 * result to a `const` or the decision is re-read every time it is
 * provided.
 *
 * The `never` in its output does not mean it installs nothing.
 * `CliOutput.Formatter` is a `Context.Reference`, whose key type is
 * `never`, so this layer sets the formatter reference rather than
 * providing a service. Every command it is provided to renders with the
 * formatter it sets, and without it they fall back to core's default
 * formatter.
 *
 * **Example** (Build a formatter with a custom version line)
 *
 * ```ts
 * import { CliColor } from "@beep/scratchpad/effected/cli/CliColor";
 * import * as Layer from "effect/Layer";
 *
 * const formatter = CliColor.formatterLayer({ formatVersion: (version) => `tool ${version}` });
 * console.log(Layer.isLayer(formatter)); // true
 * ```
 *
 * @public
 * @category layers
 * @since 0.0.0
 */
	static readonly formatterLayer = (
		overrides: Partial<CliOutput.Formatter> = {},
	): Layer.Layer<never, never, Stdio.Stdio> =>
		Layer.unwrap(
			Effect.map(CliColor.enabled, (colors) =>
				CliOutput.layer({ ...CliOutput.defaultFormatter({ colors }), ...overrides }),
			),
		);
}
