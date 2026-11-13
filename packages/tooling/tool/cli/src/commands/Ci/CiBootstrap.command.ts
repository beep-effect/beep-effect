/**
 * The pre-toolchain `ci` commands: the ones a hosted job runs before `bun install`.
 *
 * **Details**
 *
 * These command values are registered twice, unchanged: in the full `ci`
 * group and in the slim `src/bin-ci.ts` entry that `bun build --compile`
 * turns into the CI binary. The module therefore imports only the
 * operational service and its schemas, never the lane, route or coverage
 * machinery the full group carries.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CiCommandError } from "./Ci.errors.ts";
import { cacheNativeSandboxDefaults, cleanupCachePilot, ensureCacheNativeSandbox } from "./CiCachePilotHost.ts";
import { CiResourceLane } from "./CiOperational.schemas.ts";
import { CiOperational, CiOperationalLive } from "./CiOperational.service.ts";
import { ciShardOverflowCommand } from "./CiShardOverflow.ts";

const operationalFailure = <A, R>(effect: Effect.Effect<A, CiCommandError, R>) =>
  effect.pipe(
    Effect.catchTag("CiCommandError", (error) =>
      Console.error(error.message).pipe(Effect.andThen(failWithReportedExit(error.message)))
    )
  );
const patternsCommand = Command.make(
  "patterns",
  { write: Flag.Boolean("write").pipe(Flag.withDefault(false)) },
  ({ write }) => CiOperational.use((service) => operationalFailure(service.patterns(write)))
).pipe(
  Command.withDescription("Check the pre-runtime CI pattern projection, or regenerate with --write"),
  Command.provide(CiOperationalLive)
);
const changeProfileCommand = Command.make(
  "change-profile",
  {
    base: Argument.String("base").pipe(Argument.optional),
    head: Argument.String("head").pipe(Argument.optional),
  },
  ({ base, head }) => CiOperational.use((service) => operationalFailure(service.changeProfile(base, head)))
).pipe(
  Command.withDescription("Export goals-only, docs-only and desktop Rust lane profiles"),
  Command.provide(CiOperationalLive)
);
const jobEnvironmentCommand = Command.make("job-env", {}, () =>
  CiOperational.use((service) => operationalFailure(service.jobEnvironment))
).pipe(
  Command.withDescription("Append the trusted event's explicit environment inputs to GITHUB_ENV"),
  Command.provide(CiOperationalLive)
);
const pruneAptCommand = Command.make(
  "prune-apt",
  { directory: Argument.String("sources-dir").pipe(Argument.optional) },
  ({ directory }) =>
    CiOperational.use((service) =>
      operationalFailure(service.pruneAptSources(O.getOrElse(directory, () => "/etc/apt/sources.list.d")))
    )
).pipe(
  Command.withDescription("Remove every third-party apt source except the Ubuntu archive"),
  Command.provide(CiOperationalLive)
);
const decodeCiRuntimeArguments = S.decodeUnknownEffect(S.Array(S.String));
const isResourceLane = S.is(CiResourceLane);
const runnerResourcesCommand = Command.make(
  "runner-resources",
  {
    lane: Argument.String("lane"),
    command: Argument.String("command"),
    args: Argument.String("args").pipe(Argument.variadic),
  },
  Effect.fn("Ci.runRunnerResources")(function* ({ lane, command, args }) {
    if (!isResourceLane(lane)) return yield* failWithReportedExit("Invalid resource lane name", 64);
    const values = yield* decodeCiRuntimeArguments(args).pipe(
      CiCommandError.mapError("Runtime arguments must be strings.")
    );
    const status = yield* CiOperational.use((service) =>
      operationalFailure(service.runnerResources(lane, command, values))
    ).pipe(Effect.scoped);
    if (status !== 0) return yield* failWithReportedExit("CI lane failed", status);
  })
).pipe(
  Command.withDescription("Measure host resources around a command while preserving its status"),
  Command.provide(CiOperationalLive)
);
const cacheSandboxCommand = Command.make(
  "cache-sandbox",
  {
    bwrap: Flag.String("bwrap").pipe(
      Flag.withDefault(cacheNativeSandboxDefaults.bwrap),
      Flag.withDescription("Sandbox executable to require (a fixture seam; hosted jobs keep the default)")
    ),
    aptSources: Flag.String("apt-sources").pipe(
      Flag.withDefault(cacheNativeSandboxDefaults.aptSources),
      Flag.withDescription("Apt source directory pruned before an apt install (a fixture seam)")
    ),
  },
  ensureCacheNativeSandbox
).pipe(
  Command.withDescription("Install bubblewrap for the cache producer sandbox when the runner lacks it"),
  Command.provide(CiOperationalLive)
);
const cachePilotCleanupCommand = Command.make(
  "cache-pilot-cleanup",
  { mode: Argument.String("mode").pipe(Argument.optional) },
  // `${1:-signed}`: an absent or empty mode is the signed trial.
  ({ mode }) => cleanupCachePilot(O.getOrElse(O.filter(mode, Str.isNonEmpty), () => "signed"))
).pipe(Command.withDescription("Remove only the current job's cache pilot worktrees, inputs and private directory"));

/**
 * The pre-toolchain `ci` subcommands, in their registration order.
 *
 * **Details**
 *
 * `patterns`, `change-profile`, `job-env`, `prune-apt`, `runner-resources`,
 * `cache-sandbox`, `cache-pilot-cleanup` and `shard-overflow` need only the
 * platform services (`FileSystem`, `Path`, `ChildProcessSpawner`), so the
 * compiled CI binary can run them before the job installs its toolchain.
 *
 * **Example** (Register the bootstrap commands under a `ci` group)
 *
 * ```ts
 * import { ciBootstrapCommands } from "@beep/repo-cli/commands/Ci"
 * import * as Command from "effect/cli/Command"
 *
 * const ci = Command.make("ci").pipe(Command.withSubcommands(ciBootstrapCommands))
 * console.log(ci.name) // "ci"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciBootstrapCommands = [
  patternsCommand,
  changeProfileCommand,
  jobEnvironmentCommand,
  pruneAptCommand,
  runnerResourcesCommand,
  cacheSandboxCommand,
  cachePilotCleanupCommand,
  ciShardOverflowCommand,
] as const;
