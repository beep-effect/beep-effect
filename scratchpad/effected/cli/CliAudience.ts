import * as S from "effect/Schema";
import { $ScratchpadId } from "@beep/identity/packages";
import type { AudienceKind, AudienceShape } from "../env/index.ts";
import { Audience, TerminalEnv } from "../env/index.ts";
import type * as Terminal from "effect/Terminal";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Stdio from "effect/Stdio";
import type { Command } from "effect/cli";
import { CliConfig, CliError, Command as CommandModule, Flag, GlobalFlag } from "effect/cli";
import { CliInteractive } from "./CliInteractive.ts";
import { canPrompt } from "./internal/canPrompt.ts";
import { refreshFailureTarget } from "./internal/failureTarget.ts";
import { scanAudience, tallyAudience } from "./internal/scanAudience.ts";
import { WizardDropped } from "./internal/wizardGate.ts";

const $I = $ScratchpadId.create("effected/cli/CliAudience");

class AudienceConflictError extends S.TaggedError<AudienceConflictError>($I`AudienceConflictError`)(
	"AudienceConflictError",
	{
		message: S.String.annotate({ description: "The usage guidance for conflicting or repeated audience flags." }),
	},
	$I.annote("AudienceConflictError", { description: "More than one audience flag occurrence was supplied to a CLI run." }),
) {}

const KINDS: ReadonlyArray<AudienceKind> = ["human", "agent", "ci"];

/**
 * Whether the run may prompt once a flag has named the audience.
 *
 * Only a `human` audience prompts, and only with a terminal on both standard input and standard output and a `TERM`
 * that is not `dumb` (`canPrompt`, the decision `CliInteractive.layer` makes). With the
 * terminal facts in the environment (`TerminalEnv`) that is decided from them, not from the ambient value, so a
 * flag can WIDEN: `--human` under a detected agent on real terminals prompts, and in a pipe it still cannot. With no
 * `TerminalEnv` there is nothing to decide from and the flag only narrows.
 */
const interactiveWhenFlagged = (kind: AudienceKind, current: boolean): Effect.Effect<boolean> =>
	Effect.flatMap(Effect.serviceOption(TerminalEnv), (terminal) => {
		if (kind !== "human") return Effect.succeed(false);
		return O.isSome(terminal) ? canPrompt(terminal.value) : Effect.succeed(current);
	});

/**
 * The four parsed audience flags a root command carries once {@link CliAudience.flags} is shared onto it.
 *
 * @public
 */
export interface AudienceFlagInput {
	/** Every `--audience <kind>` occurrence. */
	readonly audience: ReadonlyArray<AudienceKind>;
	/** Every `--human` occurrence. */
	readonly human: ReadonlyArray<boolean>;
	/** Every `--agent` occurrence. */
	readonly agent: ReadonlyArray<boolean>;
	/** Every `--ci` occurrence. */
	readonly ci: ReadonlyArray<boolean>;
}

/**
 * Options for {@link CliAudience.flags}.
 *
 * @public
 */
export interface CliAudienceFlagsOptions {
	/**
	 * Hide all four flags from every help screen. They still parse and resolve; describe them in the root
	 * command's description instead.
	 */
	readonly hidden?: boolean | undefined;
}

/**
 * Resolves to nothing for a command that carries the four audience flags, and to an unsatisfiable marker otherwise,
 * so `CliAudience.run` on a root that forgot `Command.withSharedFlags(CliAudience.flags())` does not compile. (A
 * plain `Input extends AudienceFlagInput` constraint does not do this: `Command` is contravariant in its input, so
 * a command with no flags still type-checks against it.)
 *
 * @public
 */
export type RequiresAudienceFlags<Input> = [Input] extends [AudienceFlagInput]
	? unknown
	: { readonly "missing shared flags": "pipe the root through Command.withSharedFlags(CliAudience.flags())" };

const CONFLICT = "Give at most one of --audience, --human, --agent, --ci (once).";

/** Resolve the four flags into the audience to provide, failing when more than one occurrence was given. */
const resolve = (input: AudienceFlagInput): Effect.Effect<AudienceShape, CliError.UserError, Audience> => {
	// The counting rule is shared with `scanAudience`, which reads argv before parsing, so the two cannot drift.
	const { given: named, conflict } = tallyAudience(input);
	if (conflict) {
		return Effect.fail(
			CliError.UserError.make({
				cause: AudienceConflictError.make({ message: CONFLICT }),
				userMessage: CONFLICT,
			}),
		);
	}
	const [kind] = named;
	// No flag: the ambient audience, the override variable or detection, is read and provided back unchanged.
	return kind === undefined ? Audience : Effect.succeed({ kind, source: "flag" });
};

/**
 * The audience flags of a CLI: `--audience <human|agent|ci>` and the shorthands `--human`, `--agent`, `--ci`,
 * resolved into `@effected/env`'s `Audience`.
 *
 * @remarks
 * The one wiring: share the flags on the root command and hand the root to {@link CliAudience.run} (or
 * {@link CliAudience.runWith}), which resolves the flags from argv before core parses and applies
 * {@link CliAudience.provide} itself:
 *
 * ```ts
 * const root = Command.make("tool").pipe(
 *   Command.withSharedFlags(CliAudience.flags()),
 *   Command.withSubcommands([verify]),
 * )
 * NodeRuntime.runMain(
 *   CliRuntime.main(CliAudience.run(root, { version }), { platform: NodeServices.layer, env: {} }),
 * )
 * ```
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
 * {@link CliAudience.provide} on its own, the path for a bare `Command.run`, acts only on the subcommand handler,
 * because core parses the root flags into a local context before any of it is visible.
 *
 * @public
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
  * `hidden` to remove them from all of them.
  */
	static readonly flags = (
		options?: CliAudienceFlagsOptions,
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
				Flag.Literals("audience", KINDS).pipe(
					Flag.atLeast(0),
					// No metavar of its own: core appends "(choices: human, agent, ci)" to the description, and a
					// `<human|agent|ci>` placeholder would name the choices a second time.
					Flag.withDescription("Who the output is for"),
				),
			),
			human: maybeHide(
				Flag.Boolean("human").pipe(Flag.atLeast(0), Flag.withDescription("Shorthand for --audience human")),
			),
			agent: maybeHide(
				Flag.Boolean("agent").pipe(Flag.atLeast(0), Flag.withDescription("Shorthand for --audience agent")),
			),
			ci: maybeHide(
				Flag.Boolean("ci").pipe(Flag.atLeast(0), Flag.withDescription("Shorthand for --audience ci")),
			),
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
  */
	static readonly provide = <const Name extends string, Input extends AudienceFlagInput, ContextInput, E, R>(
		command: Command.Command<Name, Input, ContextInput, E, R>,
	): Command.Command<Name, Input, ContextInput, E | CliError.UserError, Exclude<R, Audience> | Audience> =>
		CommandModule.provideEffect(command, Audience, (input: Input) => resolve(input)).pipe(
			// A flag decides interactivity for the handler too: the env layer decided it from the DETECTED audience,
			// before the flag was read, so `--agent` on a terminal would otherwise stay interactive and `--human` under
			// a detected agent would stay off. See `interactiveWhenFlagged`.
			CommandModule.provideEffect(
				CliInteractive,
				Effect.fnUntraced(function* (input: Input) {
					const current = yield* CliInteractive;
					const [flagged] = tallyAudience(input).given;
					return flagged === undefined ? current : yield* interactiveWhenFlagged(flagged, current);
				}),
			),
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
  * @param command - the composite root, with the flags shared and `CliAudience.provide` piped on
  * @param config - the same `version` and `renderErrors` as core's
  */
	static readonly runWith = <const Name extends string, Input, E, R, ContextInput>(
		command: Command.Command<Name, Input, ContextInput, E, R> & RequiresAudienceFlags<Input>,
		config: { readonly version: string; readonly renderErrors?: boolean | undefined },
	): ((
		input: ReadonlyArray<string>,
	) => Effect.Effect<
		void,
		Exclude<E | CliError.UserError, Terminal.QuitError> | CliError.CliError,
		Exclude<R, Audience> | Audience | Command.Environment
	>) => {
		// `provide` is applied here, so there is one wiring and conflict detection cannot be dropped by omission.
		const core = CommandModule.runWith(
			CliAudience.provide<Name, AudienceFlagInput & Input, ContextInput, E, R>(command),
			config,
		);
		return Effect.fnUntraced(function* (argv) {
			const run = core(argv);
			const { given, conflict } = scanAudience(argv);
			const [kind] = given;
			if (kind === undefined) return yield* run;
			const withAudience = conflict ? run : Effect.provideService(run, Audience, { kind, source: "flag" });
			const current = yield* CliInteractive;
			const ambient = yield* CliConfig.CliConfig;
			// The report of a failure is written outside this run, where the flag is not in force: record the audience
			// the flag named, so `--agent` on a terminal gets the plain report and `--human` the painted one.
			if (!conflict) yield* refreshFailureTarget({ kind, source: "flag" });
			const interactive = !conflict && (yield* interactiveWhenFlagged(kind, current));
			const decided = Effect.provideService(withAudience, CliInteractive, interactive);
			// The wizard prompts, so it follows the decision: the environment gated it from the detected audience,
			// before the flag was read. A non-interactive run drops it, and a run the flag has made interactive
			// where the gate had dropped it gets it back.
			const hasWizard = ambient.builtIns.includes(GlobalFlag.Wizard);
			// Restored only into the config the gate produced: a consumer's own `builtIns` without it, whether it came from
			// outside the gate or inside, is a different object and stays without it.
			const restore = interactive && !hasWizard && (yield* WizardDropped) === ambient;
			const drop = !interactive && hasWizard;
			if (!restore && !drop) return yield* decided;
			const builtIns = interactive
				? [...ambient.builtIns, GlobalFlag.Wizard]
				: ambient.builtIns.filter((flag) => flag !== GlobalFlag.Wizard);
			return yield* Effect.provideService(decided, CliConfig.CliConfig, CliConfig.make({ builtIns }));
		});
	};

	/**
	 * `Command.run` with the audience flag resolved before parsing: reads `Stdio.args` and calls
	 * {@link CliAudience.runWith}.
	 *
	 * @param command - the composite root
	 * @param config - the same `version` and `renderErrors` as core's
	 */
	static readonly run = <const Name extends string, Input, E, R, ContextInput>(
		command: Command.Command<Name, Input, ContextInput, E, R> & RequiresAudienceFlags<Input>,
		config: { readonly version: string; readonly renderErrors?: boolean | undefined },
	): Effect.Effect<
		void,
		Exclude<E | CliError.UserError, Terminal.QuitError> | CliError.CliError,
		Exclude<R, Audience> | Audience | Command.Environment
	> =>
		Stdio.Stdio.use(({ args }) => Effect.flatMap(args, (argv) => CliAudience.runWith(command, config)(argv)));
}
