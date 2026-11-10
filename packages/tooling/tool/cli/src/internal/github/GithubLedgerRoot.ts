/**
 * The CLI root's GitHub budget ledger wiring: build the ledger once per
 * process and bind it to every GitHub client path.
 *
 * **Details**
 *
 * `withGithubLedger` wraps the command program innermost in `bin-main.ts`, so
 * the ledger is built under the rebuilt `ConfigProvider` and the platform
 * context. It provides the ledger, the driver's `RateLimitSink`, the repo-run
 * `GhSpawnSink`, the configured identities and the command label derived from
 * the loaded command tree. Any failure or defect while building means "no
 * ledger", never a failed command. The ledger is off under CI and with
 * `BEEP_GITHUB_LEDGER=off`.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { RateLimitSink } from "@beep/github/Resilience";
import { configStringOption, isCi } from "@beep/repo-cli-kit/cli/EnvConfig";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";
import { ROOT_VALUE_FLAG_NAMES } from "../dispatch/RootFlags.ts";
import { GhSpawnSink } from "../repo-run/GhSpawnSink.ts";
import { GithubConfiguredIdentities, readGhCliLogin, readGithubIdentityConfig } from "./GithubIdentityConfig.ts";
import { DEFAULT_COMMAND_LABEL, GithubLedgerCommandLabel, UNRESOLVED_IDENTITY } from "./GithubLedger.schemas.ts";
import { GithubBudgetLedger, GithubLedgerCommand, layerGithubBudgetLedgerLive } from "./GithubLedger.service.ts";
import type * as Command from "effect/cli/Command";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { ConfiguredGithubIdentity, GithubLedgerError } from "./GithubLedger.schemas.ts";

const MAX_COMMAND_NAMES = 3;

const childNamed = (command: Command.Command.Any, name: string): O.Option<Command.Command.Any> =>
  A.findFirst(
    A.flatMap(command.subcommands, (group) => group.commands),
    (child) => child.name === name
  );

// Skip root flags exactly as Dispatch.firstPositional does.
const firstPositionalIndex = (argv: ReadonlyArray<string>, index: number): O.Option<number> =>
  O.flatMap(A.get(argv, index), (token) =>
    token === "--"
      ? O.none()
      : A.contains(ROOT_VALUE_FLAG_NAMES, token)
        ? firstPositionalIndex(argv, index + 2)
        : Str.startsWith("-")(token)
          ? firstPositionalIndex(argv, index + 1)
          : O.some(index)
  );

const namesFrom = (
  command: Command.Command.Any,
  argv: ReadonlyArray<string>,
  index: number,
  names: ReadonlyArray<string>
): ReadonlyArray<string> =>
  A.length(names) >= MAX_COMMAND_NAMES
    ? names
    : pipe(
        A.get(argv, index),
        O.flatMap((token) => O.map(childNamed(command, token), (child) => [child, token] as const)),
        O.match({
          onNone: () => names,
          onSome: ([child, token]) => namesFrom(child, argv, index + 1, A.append(names, token)),
        })
      );

/**
 * The ledger's command label of an invocation, from the loaded command tree.
 *
 * **Details**
 *
 * Root flags are skipped as the dispatcher skips them. Each following token
 * counts only when it names a child of the current command, up to three names;
 * the first token that is not a child name (an argument or a flag) stops the
 * walk. No names gives `beep`. A lazily loaded group that was not imported is
 * a stub with no children, so its label is the group name alone.
 *
 * **Example** (Label an invocation)
 *
 * ```ts
 * import { commandLabelOf } from "@beep/repo-cli/test/SharedInternals"
 * import * as Command from "effect/cli/Command"
 *
 * const root = Command.make("beep").pipe(
 *   Command.withSubcommands([Command.make("yeet").pipe(Command.withSubcommands([Command.make("monitor")]))])
 * )
 * console.log(commandLabelOf(root, ["--log-level", "debug", "yeet", "monitor", "--until-ready"])) // "yeet monitor"
 * ```
 *
 * @param root - The root command.
 * @param argv - The invocation's arguments after the executable.
 * @returns The command label.
 * @category utilities
 * @since 0.0.0
 */
export const commandLabelOf: {
  (argv: ReadonlyArray<string>): (root: Command.Command.Any) => GithubLedgerCommandLabel;
  (root: Command.Command.Any, argv: ReadonlyArray<string>): GithubLedgerCommandLabel;
} = dual(
  2,
  (root: Command.Command.Any, argv: ReadonlyArray<string>): GithubLedgerCommandLabel =>
    pipe(
      firstPositionalIndex(argv, 0),
      O.map((index) => namesFrom(root, argv, index, A.empty())),
      O.filter(A.isReadonlyArrayNonEmpty),
      O.flatMap((names) => GithubLedgerCommandLabel.makeOption(A.join(names, " "))),
      O.getOrElse(() => DEFAULT_COMMAND_LABEL)
    )
);

/**
 * The root's ledger: the file store, the `gh` CLI identity for spawn rows
 * (read lazily, once per process) and the configured identities.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { layerGithubLedgerRootLive } from "@beep/repo-cli/test/SharedInternals"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerGithubLedgerRootLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerGithubLedgerRootLive: Layer.Layer<
  GithubBudgetLedger,
  never,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> = Layer.unwrap(
  Effect.gen(function* () {
    const services = yield* Effect.context<ChildProcessSpawner.ChildProcessSpawner>();
    const ghIdentity = readGhCliLogin(".").pipe(
      Effect.provideContext(services),
      Effect.map(O.getOrElse(() => UNRESOLVED_IDENTITY))
    );
    return layerGithubBudgetLedgerLive({ ghIdentity });
  })
);

const configuredIdentitiesFor = (
  services: Context.Context<FileSystem.FileSystem | Path.Path>
): Effect.Effect<ReadonlyArray<ConfiguredGithubIdentity>> =>
  readGithubIdentityConfig.pipe(
    Effect.provideContext(services),
    Effect.catchCause((cause) =>
      Effect.as(Effect.logDebug("github.ledger.identities", cause), A.empty<ConfiguredGithubIdentity>())
    )
  );

/**
 * Whether the ledger is off for this process: under CI, or with `BEEP_GITHUB_LEDGER=off`.
 *
 * **Example** (Build the check)
 *
 * ```ts
 * import { githubLedgerDisabled } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(githubLedgerDisabled)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const githubLedgerDisabled: Effect.Effect<boolean> = Effect.gen(function* () {
  const setting = yield* configStringOption("BEEP_GITHUB_LEDGER");
  const ci = yield* isCi;
  return ci || O.exists(setting, (value) => Str.trim(value) === "off");
});

/**
 * Run a program with the GitHub budget ledger bound to every GitHub client path.
 *
 * **Details**
 *
 * The ledger layer is built with `Effect.exit`, so a typed failure, a defect
 * or an interrupt while building runs the program without a ledger. Inside,
 * `RateLimitSink`, `GhSpawnSink`, `GithubConfiguredIdentities` and
 * `GithubLedgerCommand` resolve to the ledger's bindings; outside, they keep
 * their no-op defaults.
 *
 * **Example** (Wrap a program)
 *
 * ```ts
 * import { withGithubLedger } from "@beep/repo-cli/test/SharedInternals"
 * import * as Command from "effect/cli/Command"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.succeed(1).pipe(withGithubLedger({ argv: [], root: Command.make("beep") }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - The invocation's arguments, the root command and, for tests, the ledger layer.
 * @returns A function wrapping a program.
 * @category layers
 * @since 0.0.0
 */
export const withGithubLedger =
  (options: {
    readonly argv: ReadonlyArray<string>;
    readonly root: Command.Command.Any;
    readonly layer?: Layer.Layer<
      GithubBudgetLedger,
      GithubLedgerError,
      FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
    >;
  }) =>
  <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner> =>
    Effect.gen(function* () {
      if (yield* githubLedgerDisabled) return yield* effect;
      const services = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
      const scope = yield* Scope.make();
      // Any failure or defect while building means "no ledger", never a failed command.
      const built = yield* Effect.exit(Layer.buildWithScope(options.layer ?? layerGithubLedgerRootLive, scope));
      if (Exit.isFailure(built)) {
        yield* Scope.close(scope, Exit.void);
        yield* Effect.logDebug("github.ledger.disabled", built.cause);
        return yield* effect;
      }
      const ledger = Context.get(built.value, GithubBudgetLedger);
      return yield* effect.pipe(
        Effect.provideService(GithubBudgetLedger, ledger),
        Effect.provideService(RateLimitSink, ledger.sink),
        Effect.provideService(GhSpawnSink, ledger.ghSink),
        Effect.provideService(GithubConfiguredIdentities, configuredIdentitiesFor(services)),
        Effect.provideService(GithubLedgerCommand, commandLabelOf(options.root, options.argv)),
        Effect.ensuring(Scope.close(scope, Exit.void))
      );
    });
