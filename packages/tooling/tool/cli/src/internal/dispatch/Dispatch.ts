/**
 * Argv-first lazy dispatch over the command-group manifest.
 *
 * **Details**
 *
 * Dispatch runs before any Effect runtime or Layer exists, so it is a set of
 * pure functions over argv and the manifest rather than a `Context.Service`:
 * {@link resolveDispatchTarget} reads argv, {@link dispatchRuntimeServices}
 * names the Layers to build, {@link loadDispatchTarget} imports only the
 * groups the target names, and {@link makeRootCommand}
 * composes the `beep-cli` root from the loaded groups plus help-only stubs
 * for the rest. The stubs carry each group's static help fields, so root help
 * and unknown-subcommand suggestions render exactly as the eager tree did.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { LINT_POLICY_SUBCOMMANDS } from "../cli/LintRouting.ts";
import { commandGroupRoutes, QUALITY_TASK_NAMES } from "./Dispatch.manifest.ts";
import { DispatchTarget } from "./Dispatch.schemas.ts";
import type { CommandGroupRoute } from "./Dispatch.manifest.ts";
import type { CommandGroupHelp, RuntimeService } from "./Dispatch.schemas.ts";

/**
 * Name of the root command, shown in every usage line.
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const ROOT_COMMAND_NAME = "beep-cli";

/**
 * Description of the root command, shown at the top of `beep --help`.
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const ROOT_COMMAND_DESCRIPTION = "CLI tool for managing beep-effect monorepo packages";

const ROOT_GLOBAL_FLAG_NAMES: ReadonlyArray<string> = [
  "--completions",
  "--help",
  "--log-level",
  "--version",
  "-h",
  "-v",
];
// Built-in root flags that take their value as the next token.
const ROOT_VALUE_FLAG_NAMES: ReadonlyArray<string> = ["--completions", "--log-level"];
// Built-in root flags that walk every group, so the whole tree must load.
const FULL_TREE_FLAG_NAMES: ReadonlyArray<string> = ["--completions", "--wizard"];
const LINT_POLICY_SUBCOMMAND_NAMES: ReadonlyArray<string> = LINT_POLICY_SUBCOMMANDS;

const isFlagNamed =
  (names: ReadonlyArray<string>) =>
  (token: string): boolean =>
    A.contains(names, token) || A.some(names, (name) => Str.startsWith(`${name}=`)(token));

const isRootGlobalFlag = isFlagNamed(ROOT_GLOBAL_FLAG_NAMES);
const isFullTreeFlag = isFlagNamed(FULL_TREE_FLAG_NAMES);

const isQualityTaskInvocation = (argv: ReadonlyArray<string>): boolean =>
  O.exists(A.get(argv, 0), (name) => A.contains(QUALITY_TASK_NAMES, name)) &&
  !A.some(argv, isRootGlobalFlag) &&
  !(argv[0] === "lint" && O.exists(A.get(argv, 1), (name) => A.contains(LINT_POLICY_SUBCOMMAND_NAMES, name)));

// The first token that is neither a root flag nor a root flag's value names the group.
const firstPositional = (argv: ReadonlyArray<string>, index: number): O.Option<string> =>
  O.flatMap(A.get(argv, index), (token) =>
    token === "--"
      ? O.none()
      : A.contains(ROOT_VALUE_FLAG_NAMES, token)
        ? firstPositional(argv, index + 2)
        : Str.startsWith("-")(token)
          ? firstPositional(argv, index + 1)
          : O.some(token)
  );

/**
 * Find the route a token names, by group name or alias.
 *
 * @param token - A group name or alias from argv.
 * @returns The matching manifest route, if any.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const findCommandGroupRoute = (token: string): O.Option<CommandGroupRoute> =>
  A.findFirst(commandGroupRoutes, ({ help }) => help.name === token || help.alias === token);

/**
 * Decide which command groups argv needs, ignoring the quality-task route.
 *
 * **Example** (Resolve a group invocation)
 *
 * ```ts
 * resolveCommandTarget(["--log-level", "debug", "yeet", "--help"])
 * // { _tag: "group", name: "yeet" }
 * ```
 *
 * @param argv - Process arguments after the bin path.
 * @returns The group to load, the root alone, or the full tree.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const resolveCommandTarget = (argv: ReadonlyArray<string>): DispatchTarget =>
  A.some(argv, isFullTreeFlag)
    ? DispatchTarget.cases["full-tree"].make({})
    : pipe(
        firstPositional(argv, 0),
        O.flatMap(findCommandGroupRoute),
        O.match({
          onNone: () => DispatchTarget.cases.root.make({}),
          onSome: ({ help }) => DispatchTarget.cases.group.make({ name: help.name }),
        })
      );

/**
 * Decide what argv dispatches to: a root quality task, or the groups {@link resolveCommandTarget} picks.
 *
 * **Details**
 *
 * `beep build|check|test|lint|audit|coverage ...` without a root flag is a
 * quality task, except `beep lint <policy-subcommand>`, which is the lint
 * group. The caller still parses the task invocation and falls back to
 * {@link resolveCommandTarget} when it does not parse.
 *
 * @param argv - Process arguments after the bin path.
 * @returns The dispatch target.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const resolveDispatchTarget = (argv: ReadonlyArray<string>): DispatchTarget =>
  isQualityTaskInvocation(argv) ? DispatchTarget.cases["quality-task"].make({}) : resolveCommandTarget(argv);

/**
 * A help-only command carrying one group's static root-help fields.
 *
 * **Details**
 *
 * The stub has no flags, arguments or handler. It is only ever listed in the
 * root help page and matched by unknown-subcommand suggestions; the dispatcher
 * never routes argv into a stub.
 *
 * @param help - The group's static help fields.
 * @returns A command that renders like the real group in its parent's help.
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const makeStubCommand = (help: CommandGroupHelp): Command.Command.Any => {
  const named = Command.make(help.name);
  const described = help.description === undefined ? named : Command.withDescription(named, help.description);
  const short =
    help.shortDescription === undefined ? described : Command.withShortDescription(described, help.shortDescription);
  const aliased = help.alias === undefined ? short : Command.withAlias(short, help.alias);
  return help.unlisted === true ? Command.unlisted(aliased) : aliased;
};

const routesForTarget = (target: DispatchTarget): ReadonlyArray<CommandGroupRoute> =>
  DispatchTarget.match(target, {
    group: ({ name }) => A.filter(commandGroupRoutes, ({ help }) => help.name === name),
    root: () => A.empty(),
    "full-tree": () => commandGroupRoutes,
    "quality-task": () => A.empty(),
  });

/**
 * The runtime services the groups a target names declare, read from the manifest without importing them.
 *
 * @param target - The resolved dispatch target.
 * @returns The union of the selected routes' runtime services.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const dispatchRuntimeServices = (target: DispatchTarget): HashSet.HashSet<RuntimeService> =>
  HashSet.fromIterable(A.flatMap(routesForTarget(target), ({ services }) => services));

/**
 * Import only the groups a dispatch target names.
 *
 * @param target - The resolved dispatch target.
 * @returns The imported group commands keyed by group name.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const loadDispatchTarget = Effect.fnUntraced(function* (target: DispatchTarget) {
  const selected = routesForTarget(target);
  const commands = yield* Effect.forEach(selected, ({ load }) => Effect.promise(load), { concurrency: "unbounded" });
  return HashMap.fromIterable(
    A.zip(
      A.map(selected, ({ help }) => help.name),
      commands
    )
  );
});

/**
 * Compose the `beep-cli` root from loaded groups, with help-only stubs for every other group.
 *
 * @param commands - The groups imported for this invocation, keyed by group name.
 * @returns The root command handed to `Command.run`, its subcommands in manifest order.
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const makeRootCommand = (commands: HashMap.HashMap<string, Command.Command.Any>) =>
  Command.make(ROOT_COMMAND_NAME).pipe(
    Command.withDescription(ROOT_COMMAND_DESCRIPTION),
    Command.withSubcommands(
      A.map(commandGroupRoutes, ({ help }) =>
        O.getOrElse(HashMap.get(commands, help.name), () => makeStubCommand(help))
      )
    )
  ) as Command.Command<typeof ROOT_COMMAND_NAME, {}, {}, never, never>;
