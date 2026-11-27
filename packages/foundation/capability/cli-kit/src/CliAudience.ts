/**
 * The audience flags (`--audience`, `--human`, `--agent`, `--ci`) and the runner that applies them before the
 * command runs, so every later decision reads the audience the person asked for.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $CliKitId } from "@beep/identity/packages";
import { Audience, TerminalEnv } from "@beep/runtime-env";
import { AudienceKind, AudienceShape } from "@beep/runtime-env/Audience";
import * as A from "effect/Array";
import * as CliConfig from "effect/cli/CliConfig";
import * as CliError from "effect/cli/CliError";
import * as CommandModule from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as GlobalFlag from "effect/cli/GlobalFlag";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import { CliInteractive } from "./CliInteractive.ts";
import { canPrompt } from "./internal/canPrompt.ts";
import { refreshFailureTarget } from "./internal/failureTarget.ts";
import { AudienceFlagValues, scanAudience, tallyAudience } from "./internal/scanAudience.ts";
import { WizardDropped } from "./internal/wizardGate.ts";
import type * as Command from "effect/cli/Command";
import type * as Terminal from "effect/Terminal";

const $I = $CliKitId.create("CliAudience");

class AudienceConflictError extends S.TaggedError<AudienceConflictError, { readonly brand: unique symbol }>(
  $I`AudienceConflictError`
)(
  "AudienceConflictError",
  {
    message: S.String.pipe(
      $I.annoteKey("AudienceConflictError.message", {
        description: "The usage guidance for conflicting or repeated audience flags.",
      })
    ),
  },
  $I.annoteError<AudienceConflictError>("AudienceConflictError", {
    description: "More than one audience flag occurrence was supplied to a CLI run.",
  })
) {}

const interactiveWhenFlagged: {
  (kind: AudienceKind, current: boolean): Effect.Effect<boolean>;
  (current: boolean): (kind: AudienceKind) => Effect.Effect<boolean>;
} = dual(
  2,
  (kind: AudienceKind, current: boolean): Effect.Effect<boolean> =>
    Effect.flatMap(Effect.serviceOption(TerminalEnv), (terminal) => {
      if (kind !== "human") return Effect.succeed(false);
      return O.isSome(terminal) ? canPrompt(terminal.value) : Effect.succeed(current);
    })
);

/**
 * The four parsed audience flags a root command carries once {@link CliAudience.flags} is shared onto it.
 *
 * **Example** (Validate shared audience flags)
 *
 * ```ts
 * import { AudienceFlagInput } from "@beep/cli-kit/CliAudience";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(AudienceFlagInput)({ audience: [], human: [], agent: [true], ci: [] })) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export const AudienceFlagInput = S.Struct(AudienceFlagValues.fields).pipe(
  $I.annoteSchema("AudienceFlagInput", { description: "The four audience flag arrays shared onto a root command." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type AudienceFlagInput = typeof AudienceFlagInput.Type;

/**
 * **Example** (Hide shared flags from help)
 *
 * ```ts
 * import { CliAudienceFlagsOptions } from "@beep/cli-kit/CliAudience";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(CliAudienceFlagsOptions)({ hidden: true })) // true
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class CliAudienceFlagsOptions extends S.Opaque<CliAudienceFlagsOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * Hide all four flags from every help screen. They still parse and resolve; describe them in the root
     * command's description instead.
     */
    hidden: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("CliAudienceFlagsOptions.hidden", {
        description: "Hide the audience flags without changing parsing or resolution.",
      })
    ),
  }).pipe(
    $I.annoteSchema("CliAudienceFlagsOptions", { description: "Presentation options for shared audience flags." })
  )
) {}

/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { CliAudienceFlagsOptions } from "@beep/cli-kit/CliAudience"
 * import * as S from "effect/Schema"
 *
 * const plain: CliAudienceFlagsOptions.Encoded = { hidden: true }
 * console.log(S.is(CliAudienceFlagsOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CliAudienceFlagsOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CliAudienceFlagsOptions.Encoded;
}

/**
 * Resolves to nothing for a command that carries the four audience flags, and to an unsatisfiable marker otherwise,
 * so `CliAudience.run` on a root that forgot `Command.withSharedFlags(CliAudience.flags())` does not compile. (A
 * plain `Input extends AudienceFlagInput` constraint does not do this: `Command` is contravariant in its input, so
 * a command with no flags still type-checks against it.)
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type RequiresAudienceFlags<Input> = [Input] extends [AudienceFlagInput]
  ? unknown
  : { readonly "missing shared flags": "pipe the root through Command.withSharedFlags(CliAudience.flags())" };

const CONFLICT = "Give at most one of --audience, --human, --agent, --ci (once).";

const resolve = (input: AudienceFlagInput): Effect.Effect<AudienceShape, CliError.UserError, Audience> => {
  const { given: named, conflict } = tallyAudience(input);
  if (conflict) {
    return Effect.fail(
      CliError.UserError.make({
        cause: AudienceConflictError.make({ message: CONFLICT }),
        userMessage: CONFLICT,
      })
    );
  }
  const [kind] = named;
  return kind === undefined ? Audience : Effect.succeed(AudienceShape.make({ kind, source: "flag" }));
};

type AudienceRun<E, R> = Effect.Effect<
  void,
  Exclude<E | CliError.UserError, Terminal.QuitError> | CliError.CliError,
  Exclude<R, Audience> | Audience | Command.Environment
>;

const wizardConfig = Effect.fnUntraced(function* (ambient: typeof CliConfig.CliConfig.Service, interactive: boolean) {
  const hasWizard = A.contains(ambient.builtIns, GlobalFlag.Wizard);
  const restore = interactive && !hasWizard && (yield* WizardDropped) === ambient;
  const drop = !interactive && hasWizard;
  if (!restore && !drop) return undefined;
  const builtIns = interactive
    ? [...ambient.builtIns, GlobalFlag.Wizard]
    : A.filter(ambient.builtIns, (flag) => flag !== GlobalFlag.Wizard);
  return CliConfig.make({ builtIns });
});

/**
 * The audience flags of a CLI: `--audience <human|agent|ci>` and the shorthands `--human`, `--agent`, `--ci`,
 * resolved into `@beep/runtime-env`'s `Audience`.
 *
 * **Details**
 *
 * The one wiring: share the flags on the root command and hand the root to {@link CliAudience.run} (or
 * {@link CliAudience.runWith}), which resolves the flags from argv before core parses and applies
 * {@link CliAudience.provide} itself.
 *
 * Core lists a shared flag in the help of every subcommand, not only at the root: that is upstream (Effect-TS/effect
 * issue 8642), and `flags({ hidden: true })` is the way to keep them out of help altogether.
 *
 * A root that forgot `Command.withSharedFlags(CliAudience.flags())` does not compile. Giving more than one
 * occurrence across the four flags is a usage error even when they agree; a boolean set to false (`--no-agent`,
 * `--agent=false`) counts as not given. A bad `--audience` value is core's own parse error. Both exit `64` under
 * `CliRuntime.main`. A conflicting audience together with `--help` exits `0` and prints help, because core handles
 * its action flags before the resolver runs.
 *
 * A flag decides `CliInteractive` from the audience it names and the terminal facts: `--human` is interactive when
 * `TerminalEnv` says there is a terminal on stdin and on stdout, even where the environment detected an agent, so a
 * person running the tool inside an agent can ask for the human experience; in a pipe it still cannot prompt. A
 * non-human flag (`--agent`, `--ci`, `--audience agent|ci`) turns it off and drops `--wizard`, and switches
 * diagnostics to NDJSON, for the whole run including the parse step where a fallback prompt fires. Without
 * `TerminalEnv` in the environment a flag only narrows. `--wizard` follows the decision: a run a flag makes
 * interactive gets it back where the environment's gate had dropped it, and only there: a consumer's own `builtIns`
 * without it stay without it.
 *
 * {@link CliAudience.provide} on its own, the path for a bare `Command.run`, acts only on the subcommand handler,
 * because core parses the root flags into a local context before any of it is visible.
 *
 * **Example** (Wire audience flags into a command)
 *
 * ```ts
 * import { CliAudience } from "@beep/cli-kit/CliAudience";
 * import * as Command from "effect/cli/Command";
 * import * as Effect from "effect/Effect";
 *
 * const verify = Command.make("verify");
 * const root = Command.make("tool").pipe(
 *   Command.withSharedFlags(CliAudience.flags()),
 *   Command.withSubcommands([verify]),
 * );
 * const program = CliAudience.run(root, { version: "1.0.0" });
 * console.log(Effect.isEffect(program)); // true
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class CliAudience {
  private constructor() {}

  /**
   * The four flags, for `Command.withSharedFlags` on the root command.
   *
   * **Details**
   *
   * Each is repeatable, so every occurrence is counted; a boolean given as `false` (`--agent=false`,
   * `--no-agent`) is not an occurrence. Core lists shared flags in every command's help; pass
   * `hidden` to remove them from all of them. `--audience` sets no metavar: core appends
   * `(choices: human, agent, ci)` to the description, so a `<human|agent|ci>` placeholder would name them twice.
   *
   * **Example** (Create the four shared audience flags)
   *
   * ```ts
   * import { CliAudience } from "@beep/cli-kit/CliAudience";
   *
   * const flags = CliAudience.flags({ hidden: true });
   * console.log(Object.keys(flags).join(", ")); // audience, human, agent, ci
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly flags = (
    options?: CliAudienceFlagsOptions.Encoded
  ): {
    readonly audience: Flag.Flag<ReadonlyArray<AudienceKind>>;
    readonly human: Flag.Flag<ReadonlyArray<boolean>>;
    readonly agent: Flag.Flag<ReadonlyArray<boolean>>;
    readonly ci: Flag.Flag<ReadonlyArray<boolean>>;
  } => {
    const hide = options?.hidden === true;
    const maybeHide = <A>(flag: Flag.Flag<A>): Flag.Flag<A> => (hide ? Flag.withHidden(flag) : flag);
    return {
      audience: maybeHide(
        Flag.Literals("audience", AudienceKind.literals).pipe(
          Flag.atLeast(0),
          Flag.withDescription("Who the output is for")
        )
      ),
      human: maybeHide(
        Flag.Boolean("human").pipe(Flag.atLeast(0), Flag.withDescription("Shorthand for --audience human"))
      ),
      agent: maybeHide(
        Flag.Boolean("agent").pipe(Flag.atLeast(0), Flag.withDescription("Shorthand for --audience agent"))
      ),
      ci: maybeHide(Flag.Boolean("ci").pipe(Flag.atLeast(0), Flag.withDescription("Shorthand for --audience ci"))),
    };
  };

  /**
   * Resolve the flags before every subcommand handler and re-provide `Audience`.
   *
   * **Gotchas**
   *
   * `CliAudience.run` and `runWith` apply this themselves, so a program run through them never needs it. Use it
   * directly only with a bare `Command.run`, which leaves a fallback prompt blind to the flags (see the class
   * remarks).
   *
   * A failure report is written outside the run, where the flag is not in force, so only `runWith` and `run` carry
   * the flag's audience to it; with this on its own the report follows the environment's audience.
   *
   * Pipe it onto the composite root, after `withSubcommands`, since a parent's handler does not run when a
   * subcommand is selected. With exactly one flag the audience is `{ kind, source: "flag" }`; with none the
   * ambient `Audience` is read and provided back unchanged, so `Audience` stays in the requirement a handler
   * reading it already has, and is added to a program whose handlers do not read it.
   *
   * **Example** (Provide the audience to a bare command)
   *
   * ```ts
   * import { CliAudience } from "@beep/cli-kit/CliAudience";
   * import * as Command from "effect/cli/Command";
   * const root = Command.make("tool").pipe(Command.withSharedFlags(CliAudience.flags()));
   * const provided = CliAudience.provide(root);
   * console.log(provided.name); // tool
   * ```
   *
   * @category combinators
   * @since 0.0.0
   */
  static readonly provide = <const Name extends string, Input extends AudienceFlagInput, ContextInput, E, R>(
    command: Command.Command<Name, Input, ContextInput, E, R>
  ): Command.Command<Name, Input, ContextInput, E | CliError.UserError, Exclude<R, Audience> | Audience> =>
    CommandModule.provideEffect(command, Audience, (input: Input) => resolve(input)).pipe(
      CommandModule.provideEffect(
        CliInteractive,
        Effect.fnUntraced(function* (input: Input) {
          const current = yield* CliInteractive;
          const [flagged] = tallyAudience(input).given;
          return flagged === undefined ? current : yield* interactiveWhenFlagged(flagged, current);
        })
      )
    );

  /**
   * Run a command the way `Command.runWith` does, with the audience flag resolved BEFORE core parses.
   *
   * **Details**
   *
   * It scans `argv` for the four audience flags first, then runs core around a provided `Audience` (when exactly
   * one is given: `{ kind, source: "flag" }`) and a `CliInteractive` decided from it: `--human` is interactive when
   * `TerminalEnv` reports a terminal on stdin and stdout and `TERM` is not `dumb` (it can turn prompting on under a detected agent), a
   * non-human flag or a conflict makes it false. A fallback prompt fires while core parses, earlier than
   * anything `CliAudience.provide` can reach, so `--agent init` on a terminal would otherwise still prompt. No
   * flag leaves the ambient values untouched. A conflict still gets core's own usage error, exit `64`, from
   * `CliAudience.provide`'s resolver.
   *
   * **Example** (Construct a run with explicit arguments)
   *
   * ```ts
   * import { CliAudience } from "@beep/cli-kit/CliAudience";
   * import * as Command from "effect/cli/Command";
   * import * as Effect from "effect/Effect";
   *
   * const root = Command.make("tool").pipe(Command.withSharedFlags(CliAudience.flags()));
   * const program = CliAudience.runWith(root, { version: "1.0.0" })(["--agent"]);
   * console.log(Effect.isEffect(program)); // true
   * ```
   *
   * @param command - the composite root, with the flags shared and `CliAudience.provide` piped on
   * @param config - the same `version` and `renderErrors` as core's
   * @category commands
   * @since 0.0.0
   */
  static readonly runWith: {
    <const Name extends string, Input, E, R, ContextInput>(
      command: Command.Command<Name, Input, ContextInput, E, R> & RequiresAudienceFlags<Input>,
      config: { readonly version: string; readonly renderErrors?: boolean | undefined }
    ): (input: ReadonlyArray<string>) => AudienceRun<E, R>;
    <const Name extends string, Input, E, R, ContextInput>(config: {
      readonly version: string;
      readonly renderErrors?: boolean | undefined;
    }): (
      command: Command.Command<Name, Input, ContextInput, E, R> & RequiresAudienceFlags<Input>
    ) => (input: ReadonlyArray<string>) => AudienceRun<E, R>;
  } = dual(
    2,
    <const Name extends string, Input, E, R, ContextInput>(
      command: Command.Command<Name, Input, ContextInput, E, R> & RequiresAudienceFlags<Input>,
      config: { readonly version: string; readonly renderErrors?: boolean | undefined }
    ): ((input: ReadonlyArray<string>) => AudienceRun<E, R>) => {
      const core = CommandModule.runWith(
        CliAudience.provide<Name, AudienceFlagInput & Input, ContextInput, E, R>(command),
        config
      );
      return Effect.fnUntraced(function* (argv) {
        const run = core(argv);
        const { given, conflict } = scanAudience(argv);
        const [kind] = given;
        if (kind === undefined) return yield* run;
        const withAudience = conflict
          ? run
          : Effect.provideService(run, Audience, AudienceShape.make({ kind, source: "flag" }));
        const current = yield* CliInteractive;
        const ambient = yield* CliConfig.CliConfig;
        if (!conflict) yield* refreshFailureTarget(AudienceShape.make({ kind, source: "flag" }));
        const interactive = !conflict && (yield* interactiveWhenFlagged(kind, current));
        const decided = Effect.provideService(withAudience, CliInteractive, interactive);
        const config = yield* wizardConfig(ambient, interactive);
        return yield* config === undefined ? decided : Effect.provideService(decided, CliConfig.CliConfig, config);
      });
    }
  );

  /**
   * `Command.run` with the audience flag resolved before parsing: reads `Stdio.args` and calls
   * {@link CliAudience.runWith}.
   *
   * **Example** (Construct a run that reads standard arguments)
   *
   * ```ts
   * import { CliAudience } from "@beep/cli-kit/CliAudience";
   * import * as Command from "effect/cli/Command";
   * import * as Effect from "effect/Effect";
   *
   * const root = Command.make("tool").pipe(Command.withSharedFlags(CliAudience.flags()));
   * const program = CliAudience.run(root, { version: "1.0.0" });
   * console.log(Effect.isEffect(program)); // true
   * ```
   *
   * @param command - the composite root
   * @param config - the same `version` and `renderErrors` as core's
   * @category commands
   * @since 0.0.0
   */
  static readonly run: {
    <const Name extends string, Input, E, R, ContextInput>(
      command: Command.Command<Name, Input, ContextInput, E, R> & RequiresAudienceFlags<Input>,
      config: { readonly version: string; readonly renderErrors?: boolean | undefined }
    ): AudienceRun<E, R>;
    <const Name extends string, Input, E, R, ContextInput>(config: {
      readonly version: string;
      readonly renderErrors?: boolean | undefined;
    }): (command: Command.Command<Name, Input, ContextInput, E, R> & RequiresAudienceFlags<Input>) => AudienceRun<E, R>;
  } = dual(
    2,
    <const Name extends string, Input, E, R, ContextInput>(
      command: Command.Command<Name, Input, ContextInput, E, R> & RequiresAudienceFlags<Input>,
      config: { readonly version: string; readonly renderErrors?: boolean | undefined }
    ): AudienceRun<E, R> =>
      Stdio.Stdio.use(({ args }) => Effect.flatMap(args, (argv) => CliAudience.runWith(command, config)(argv)))
  );
}
