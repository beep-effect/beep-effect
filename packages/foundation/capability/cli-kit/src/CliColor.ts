/**
 * Whether output carries ANSI colour, decided once from the audience and the stream and shared by every writer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { TerminalEnv } from "@beep/runtime-env";
import * as CliOutput from "effect/cli/CliOutput";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as R from "effect/Record";
import type * as Stdio from "effect/Stdio";

/**
 * Whether a CLI's output should carry ANSI colour, decided once and shared by
 * everything that renders — help text, error output, and any rendered result.
 *
 * **Details**
 *
 * The decision is `@beep/runtime-env`'s `TerminalEnv.colorLevel("stdout")`, which
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
 * import { CliColor } from "@beep/cli-kit/CliColor";
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
   * import { CliColor } from "@beep/cli-kit/CliColor";
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
    Effect.map((level) => level !== "none")
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
   * losing the other defaults. `options` takes core's other
   * `CliOutput.defaultFormatter` options beside the colour decision:
   * `globalFlags: "summary"` replaces the `GLOBAL FLAGS` block of every
   * subcommand's help with one `Run '<root> --help' for global flags` line,
   * while the declaring (root) command still lists them in full;
   * `inheritedFlags` makes the same choice for flags inherited from ancestor
   * commands. Both default to `"full"`. Each call mints a fresh layer; bind the
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
   * import { CliColor } from "@beep/cli-kit/CliColor";
   * import * as Layer from "effect/Layer";
   *
   * const formatter = CliColor.formatterLayer({ formatVersion: (version) => `tool ${version}` });
   * console.log(Layer.isLayer(formatter)); // true
   * ```
   *
   * **Example** (Summarise global flags below the root command)
   *
   * ```ts
   * import { CliColor } from "@beep/cli-kit/CliColor";
   * import * as Layer from "effect/Layer";
   *
   * const formatter = CliColor.formatterLayer({}, { globalFlags: "summary" });
   * console.log(Layer.isLayer(formatter)); // true
   * ```
   *
   * @public
   * @category layers
   * @since 0.0.0
   */
  static readonly formatterLayer = (
    overrides: Partial<CliOutput.Formatter> = R.empty(),
    options: Omit<NonNullable<Parameters<typeof CliOutput.defaultFormatter>[0]>, "colors"> = R.empty()
  ): Layer.Layer<never, never, Stdio.Stdio> =>
    Layer.unwrap(
      Effect.map(CliColor.enabled, (colors) =>
        CliOutput.layer({ ...CliOutput.defaultFormatter({ ...options, colors }), ...overrides })
      )
    );
}
