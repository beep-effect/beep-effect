/**
 * Prompts that know when there is nobody to ask: a fallback answer, a clean `NotInteractive` failure, and the
 * gates that keep core prompts off a non-interactive run.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $CliKitId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as CliConfig from "effect/cli/CliConfig";
import * as GlobalFlag from "effect/cli/GlobalFlag";
import * as Prompt from "effect/cli/Prompt";
import * as TerminalCapabilities from "effect/cli/TerminalCapabilities";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as S from "effect/Schema";
import * as Terminal from "effect/Terminal";
import { Cancelled } from "./Cancelled.ts";
import { CliInteractive } from "./CliInteractive.ts";
import { answerWithoutPerson } from "./internal/fallbackAnswer.ts";
import { WizardDropped } from "./internal/wizardGate.ts";
import type * as Cause from "effect/Cause";
import type * as Param from "effect/cli/Param";

const $I = $CliKitId.create("CliPrompt");

/**
 * A missing flag targeted by a prompt fallback.
 *
 * **Example** (Inspect the target schema)
 *
 * ```ts
 * import { FlagTarget } from "@beep/cli-kit/CliPrompt"
 * console.log(typeof FlagTarget.make) // function
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class FlagTarget extends S.Opaque<FlagTarget, { readonly brand: unique symbol }>()(
  S.Struct({
    flag: S.String.pipe(
      $I.annoteKey("CliPromptTarget.Flag.flag", { description: "The missing flag's name without leading dashes." })
    ),
  }).pipe($I.annoteSchema("CliPromptTarget.Flag", { description: "A fallback target naming a missing flag." }))
) {}
/** Companion types for {@link FlagTarget}.
 * **Example** (Inspect the plain input)
 * ```ts
 * import { FlagTarget } from "@beep/cli-kit/CliPrompt"
 * import * as S from "effect/Schema"
 *
 * const plain: FlagTarget.Encoded = { flag: "profile" }
 * console.log(S.is(FlagTarget)(plain)) // true
 * ```
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FlagTarget {
  /**
   * The plain target input.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FlagTarget.Encoded;
}
/**
 * A missing argument targeted by a prompt fallback.
 *
 * **Example** (Inspect the target schema)
 *
 * ```ts
 * import { ArgumentTarget } from "@beep/cli-kit/CliPrompt"
 * console.log(typeof ArgumentTarget.make) // function
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ArgumentTarget extends S.Opaque<ArgumentTarget, { readonly brand: unique symbol }>()(
  S.Struct({
    argument: S.String.pipe(
      $I.annoteKey("CliPromptTarget.Argument.argument", { description: "The missing positional argument's name." })
    ),
  }).pipe(
    $I.annoteSchema("CliPromptTarget.Argument", {
      description: "A fallback target naming a missing positional argument.",
    })
  )
) {}
/** Companion types for {@link ArgumentTarget}.
 * **Example** (Inspect the plain input)
 * ```ts
 * import { ArgumentTarget } from "@beep/cli-kit/CliPrompt"
 * import * as S from "effect/Schema"
 *
 * const plain: ArgumentTarget.Encoded = { argument: "name" }
 * console.log(S.is(ArgumentTarget)(plain)) // true
 * ```
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ArgumentTarget {
  /**
   * The plain target input.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ArgumentTarget.Encoded;
}
/**
 * Which missing parameter a fallback stands in for, so a non-interactive run can fail with core's own error.
 *
 * **Example** (Validate the parameter named by a fallback)
 *
 * ```ts
 * import { CliPromptTarget } from "@beep/cli-kit/CliPrompt"
 * import * as S from "effect/Schema"
 * console.log(S.is(CliPromptTarget)({ flag: "name" })) // true
 * console.log(S.is(CliPromptTarget)({ argument: "file" })) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export const CliPromptTarget = S.Union([FlagTarget, ArgumentTarget]).pipe(
  $I.annoteSchema("CliPromptTarget", { description: "A plain flag or argument target for a prompt fallback." })
);

/**
 * The plain missing-parameter cases validated by {@link CliPromptTarget}.
 * @category type-level
 * @since 0.0.0
 */
export type CliPromptTarget = typeof CliPromptTarget.Type;
/** Companion types for {@link CliPromptTarget}.
 * **Example** (Inspect plain target input)
 * ```ts
 * import { CliPromptTarget } from "@beep/cli-kit/CliPrompt"
 * import * as S from "effect/Schema"
 *
 * const plain: CliPromptTarget.Encoded = { flag: "profile" }
 * console.log(S.is(CliPromptTarget)(plain)) // true
 * ```
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CliPromptTarget {
  /**
   * Plain missing-parameter input.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CliPromptTarget.Encoded;
}

/**
 * Options for {@link CliPrompt.fallback}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type CliPromptFallbackOptions<A> = CliPromptTarget.Encoded & {
  /** The value to use when the run is not interactive. Without it a non-interactive run fails as missing. */
  readonly otherwise?: A;
};

/**
 * Prompts that know whether there is a person to ask.
 *
 * **Example** (Construct a non-interactive prompt fallback)
 *
 * ```ts
 * import { CliPrompt } from "@beep/cli-kit/CliPrompt"
 * import * as Effect from "effect/Effect"
 * import * as Prompt from "effect/cli/Prompt"
 * const program = CliPrompt.fallback(Prompt.succeed("Ada"), { flag: "name", otherwise: "guest" })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export abstract class CliPrompt {
  /**
   * A fallback for `Flag.withFallbackPrompt` or `Argument.withFallbackPrompt` that only prompts when the run is
   * interactive.
   *
   * **Gotchas**
   *
   * Interactive (`CliInteractive`): the prompt runs and its answer is used. Not interactive: `otherwise` is used
   * when given, and the terminal is never read; without it the parameter fails as missing, exactly as it would
   * with no fallback, so core renders its own message and `CliRuntime.main` exits `64`. Name the parameter with
   * `flag` (the name without dashes, as given to `Flag.String`) or `argument` so that error can be built.
   *
   * Why the prompt runs inside this function rather than being handed back to core: core's
   * `withFallbackPrompt` turns a quit, such as Ctrl-C, into the original missing-parameter error, which would
   * exit `64` as if the flag had been forgotten. Here a quit is `Cancelled` with reason `interrupt`, exit `130`.
   * It is raised as a defect because core's parse step turns every typed failure into a usage error. Core then
   * runs the already-answered `Prompt.succeed` it is handed. Because it travels as a defect, a handler's
   * `Effect.catchTag("Cancelled", ...)` cannot see it, and only `CliRuntime.main` (or
   * `CliRuntime.reportFailures`) renders it as one line with exit `130`; under a bare `runMain` it prints a
   * stack.
   *
   * Pair it with `CliPrompt.gateTerminal`, which `CliEnv.layer` installs: core still runs `Prompt.run` on the
   * answered prompt it is handed, and `Prompt.run` subscribes the terminal's input, which on a real terminal
   * attaches a reader to stdin and drops piped input. The gate makes that subscription harmless when the run is
   * not interactive.
   *
   * **Example** (Construct a non-interactive prompt fallback)
   *
   * ```ts
   * import { CliPrompt } from "@beep/cli-kit/CliPrompt"
   * import * as Effect from "effect/Effect"
   * import * as Prompt from "effect/cli/Prompt"
   * const program = CliPrompt.fallback(Prompt.succeed("Ada"), { flag: "name", otherwise: "guest" })
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @param prompt - the prompt to show
   * @param options - the parameter it stands in for, and the non-interactive default
   * @category utilities
   * @since 0.0.0
   */
  static readonly fallback: {
    <A>(prompt: Prompt.Prompt<A>, options: CliPromptFallbackOptions<A>): Param.FallbackPrompt<A>;
    <A>(options: CliPromptFallbackOptions<A>): (prompt: Prompt.Prompt<A>) => Param.FallbackPrompt<A>;
  } = dual(
    2,
    Effect.fn("CliPrompt.fallback")(function* <A>(prompt: Prompt.Prompt<A>, options: CliPromptFallbackOptions<A>) {
      if (yield* CliInteractive) {
        const answer = yield* Prompt.run(prompt).pipe(
          Effect.catchTag("QuitError", () => Effect.die(Cancelled.make({ reason: "interrupt" })))
        );
        return Prompt.succeed(answer);
      }
      return yield* answerWithoutPerson(options);
    })
  );

  /**
   * Gates core's `Terminal` on `CliInteractive`, so a run that is not interactive never touches the real one.
   *
   * **Details**
   *
   * Core's prompt runner subscribes the terminal's input even for a prompt that is already answered, and the
   * real Node terminal then attaches a readline to stdin, which drops piped input and puts a TTY stdin into raw
   * mode. Not interactive, this terminal's input is an already-ended queue, its `readLine` fails as quit and its
   * `display` writes nothing, so any prompt, the wizard included, is quit at once and the real terminal is never
   * read. Its `columns`, `rows` and `size` always come from the real one, so layout keeps working. Interactive, every
   * call passes through to the real terminal.
   *
   * The decision is made on every call, not when the layer is built, so a scope that narrows `CliInteractive`
   * later, such as an audience flag under `CliAudience.runWith`, gates it too.
   *
   * Because this gate owns the decision, it also sets core's `TerminalCapabilities.canPrompt` to `true`, keeping
   * the ambient `canColor` and `canAnimate`. Core otherwise skips every fallback prompt when the process lacks a
   * TTY, before `CliPrompt.fallback` can answer with its `otherwise` value; a core prompt that does run against a
   * non-interactive gate still quits at once and fails as missing.
   *
   * It requires the real `Terminal`. `CliEnv.layer` installs it, after `TerminalEnv` is built from the real
   * terminal, so consumers do not compose it.
   *
   * **Example** (Construct the terminal input gate)
   *
   * ```ts
   * import { CliPrompt } from "@beep/cli-kit/CliPrompt"
   * import * as Layer from "effect/Layer"
   *
   * const live = CliPrompt.gateTerminal
   * console.log(Layer.isLayer(live)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly gateTerminal: Layer.Layer<Terminal.Terminal, never, Terminal.Terminal> = Layer.merge(
    Layer.effect(
      Terminal.Terminal,
      Effect.gen(function* () {
        const real = yield* Terminal.Terminal;
        const endedInput = Effect.map(Queue.unbounded<Terminal.UserInput, Cause.Done>(), (queue) => {
          Queue.endUnsafe(queue);
          return queue;
        });
        return Terminal.make({
          columns: real.columns,
          rows: real.rows,
          size: real.size,
          readInput: Effect.flatMap(CliInteractive, (interactive) => (interactive ? real.readInput : endedInput)),
          readLine: Effect.flatMap(CliInteractive, (interactive) =>
            interactive ? real.readLine : Effect.fail(Terminal.QuitError.make({}))
          ),
          display: (text) =>
            Effect.flatMap(CliInteractive, (interactive) => (interactive ? real.display(text) : Effect.void)),
        });
      })
    ),
    Layer.effect(
      TerminalCapabilities.TerminalCapabilities,
      Effect.map(TerminalCapabilities.TerminalCapabilities, (capabilities) => ({ ...capabilities, canPrompt: true }))
    )
  );

  /**
   * Drops core's `--wizard` built-in flag when the run is not interactive.
   *
   * **Details**
   *
   * The wizard prompts, so offering it without a terminal only leads to a dead end. With the flag gone, core
   * treats `--wizard` as an unknown flag, a usage error that exits `64`, and lists it nowhere in `--help`.
   * The layer reads `CliInteractive` and the ambient `CliConfig` when it is built, so provide those first, for
   * example `CliPrompt.gateWizard.pipe(Layer.provide(CliInteractive.layer))`. It filters the ambient `CliConfig`,
   * so a consumer's own `builtIns` survive, and returns it untouched when interactive. An audience flag read
   * later is covered by `CliAudience.runWith`, which drops the wizard too. When this layer removes the flag it records
   * that it did, so `runWith` puts it back only when a flag turns interactivity on where this took it away: a
   * consumer who never had `Wizard` in their `builtIns` keeps it out.
   *
   * **Example** (Construct the wizard flag gate)
   *
   * ```ts
   * import { CliPrompt } from "@beep/cli-kit/CliPrompt"
   * import * as Layer from "effect/Layer"
   *
   * const live = CliPrompt.gateWizard
   * console.log(Layer.isLayer(live)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly gateWizard: Layer.Layer<never> = Layer.effectContext(
    Effect.gen(function* () {
      // The ambient config, never core's full list: a consumer's own `builtIns` (from `CliConfig.layer`) survive.
      const ambient = yield* CliConfig.CliConfig;
      const unchanged = Context.make(CliConfig.CliConfig, ambient);
      if ((yield* CliInteractive) || !ambient.builtIns.includes(GlobalFlag.Wizard)) return unchanged;
      // The config this produced is recorded, as that exact object, so an audience flag that later makes the run
      // interactive restores the wizard only into this one and never into a config someone else provided.
      const dropped = CliConfig.make({ builtIns: A.filter(ambient.builtIns, (flag) => flag !== GlobalFlag.Wizard) });
      return Context.make(CliConfig.CliConfig, dropped).pipe(Context.add(WizardDropped, dropped));
    })
  );
}
