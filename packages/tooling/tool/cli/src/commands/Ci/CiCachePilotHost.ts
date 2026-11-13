/**
 * Host preparation and cleanup of the hosted cache pilot jobs.
 *
 * **Details**
 *
 * `ensureCacheNativeSandbox` installs bubblewrap when the runner lacks it and
 * `cleanupCachePilot` removes only the job-owned pilot layout. Both need only
 * the platform services and the operational service, so the pre-toolchain CI
 * binary can carry them. They keep the retired shell adapters' observable
 * behaviour: the same stdout and stderr lines, exit codes and removed paths.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as F from "effect/Function";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CiCachePilotMode } from "./CiCachePilot.schemas.ts";
import { CiOperational } from "./CiOperational.service.ts";

const $I = $RepoCliId.create("commands/Ci/CiCachePilotHost");
const inherited = { stdin: "inherit", stdout: "inherit", stderr: "inherit" } as const;
const isPilotMode = S.is(CiCachePilotMode);
const LOCAL_OBSERVATION_PREFIX = "/beep-cache-local-observation.";
const LocalObservationSuffix = S.String.check(S.isPattern(/^[A-Za-z0-9]{6}$/u));
const isLocalObservationSuffix = S.is(LocalObservationSuffix);

// `test -x`: some execute bit is set on the (symlink-followed) path.
const isExecutable = (fs: FileSystem.FileSystem, file: string) =>
  fs.stat(file).pipe(
    Effect.map((info) => (info.mode & 0o111) !== 0),
    Effect.orElseSucceed(() => false)
  );

/**
 * Find the first executable regular file named `name` in a `PATH` string.
 *
 * **Details**
 *
 * The `command -v` and `shutil.which` lookup the retired adapters used: each
 * `:`-separated entry is tried in order, an empty entry means the current
 * directory, and a candidate must be a regular file with some execute bit set.
 *
 * **Example** (Look up node on a fixture path)
 *
 * ```ts
 * import { findOnPath } from "@beep/repo-cli/commands/Ci/CiCachePilotHost"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(findOnPath("/usr/bin:/bin", "node"))) // true
 * ```
 *
 * @param searchPath - The `PATH` value to search.
 * @param name - The executable name.
 * @returns Effect with the first matching path, if any.
 * @category utilities
 * @since 0.0.0
 */
export const findOnPath = Effect.fn("Ci.findOnPath")(function* (searchPath: string, name: string) {
  const fs = yield* FileSystem.FileSystem;
  const candidates = A.map(
    Str.split(searchPath, ":"),
    (directory) => `${Str.isEmpty(directory) ? "." : directory}/${name}`
  );
  return yield* Effect.findFirst(candidates, (file) =>
    fs.stat(file).pipe(
      Effect.map((info) => info.type === "File" && (info.mode & 0o111) !== 0),
      Effect.orElseSucceed(() => false)
    )
  );
});

// `command -v`: an executable regular file named `name` in some `PATH` entry.
const isOnPath = Effect.fn("Ci.isOnPath")(function* (name: string) {
  const searchPath = yield* Config.String("PATH").pipe(Config.withDefault(""));
  const found = yield* findOnPath(searchPath, name);
  return O.isSome(found);
});

// Run a command with the job's stdio and return its exit status.
const runInherited = Effect.fn("Ci.runInherited")(function* (command: string, args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const handle = yield* spawner.spawn(ChildProcess.make(command, args, inherited));
  const status = yield* handle.exitCode;
  return Number(status);
}, Effect.scoped);

// `set -e`: a failing step ends the command with that step's status.
const runStep = Effect.fn("Ci.runStep")(function* (command: string, args: ReadonlyArray<string>) {
  const status = yield* runInherited(command, args);
  if (status !== 0) return yield* failWithReportedExit(`${command} exited ${status}`, status);
});

// `sudo -n` only when the job is not already root, as the shell adapter did.
const withPrivilege = (command: string, args: ReadonlyArray<string>): readonly [string, ReadonlyArray<string>] =>
  (process.geteuid?.() ?? 0) === 0 ? [command, args] : ["sudo", ["-n", command, ...args]];

/**
 * Paths the native sandbox preparation reads, with the hosted defaults.
 *
 * **Details**
 *
 * The fields are a synthetic-filesystem seam for fixtures; hosted jobs keep
 * `/usr/bin/bwrap` and the privileged `/etc/apt/sources.list.d`.
 *
 * **Example** (Use the hosted paths)
 *
 * ```ts
 * import { cacheNativeSandboxDefaults } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(cacheNativeSandboxDefaults.bwrap) // "/usr/bin/bwrap"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const cacheNativeSandboxDefaults = {
  bwrap: "/usr/bin/bwrap",
  aptSources: "/etc/apt/sources.list.d",
} as const;

/**
 * Ensure the producer sandbox executable exists, installing bubblewrap when absent.
 *
 * **Details**
 *
 * With `dnf` the package installs directly; with `apt-get` the third-party apt
 * sources are pruned in process first. Both installs run through `sudo -n`
 * unless the job is root. A runner with neither manager fails with a workflow
 * error. The command then requires an executable `bwrap` and prints its
 * version.
 *
 * **Example** (Prepare the hosted sandbox)
 *
 * ```ts
 * import { cacheNativeSandboxDefaults, ensureCacheNativeSandbox } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(ensureCacheNativeSandbox(cacheNativeSandboxDefaults))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const ensureCacheNativeSandbox = Effect.fn("Ci.ensureCacheNativeSandbox")(function* (paths: {
  readonly bwrap: string;
  readonly aptSources: string;
}) {
  const fs = yield* FileSystem.FileSystem;
  if (!(yield* isExecutable(fs, paths.bwrap))) {
    if (yield* isOnPath("dnf")) {
      yield* runStep(...withPrivilege("dnf", ["install", "-y", "bubblewrap"]));
    } else if (yield* isOnPath("apt-get")) {
      yield* CiOperational.use((service) => service.pruneAptSources(paths.aptSources)).pipe(
        Effect.catchTag("CiCommandError", (error) =>
          Console.error(error.message).pipe(Effect.andThen(failWithReportedExit(error.message)))
        )
      );
      yield* runStep(...withPrivilege("apt-get", ["update"]));
      yield* runStep(...withPrivilege("apt-get", ["install", "-y", "--no-install-recommends", "bubblewrap"]));
    } else {
      const message = `::error::Producer inspection requires ${paths.bwrap}; no supported package manager.`;
      yield* Console.log(message);
      return yield* failWithReportedExit(message);
    }
  }
  if (!(yield* isExecutable(fs, paths.bwrap))) return yield* failWithReportedExit(`${paths.bwrap} is not executable`);
  yield* runStep(paths.bwrap, ["--version"]);
});

/**
 * The step environment the cache pilot commands read with `set -u` semantics.
 *
 * **Details**
 *
 * Defaults to the process environment with empty strings preserved as
 * values; a fixture provides its own record instead of mutating
 * `process.env`.
 *
 * **Example** (Supply a fixture step environment)
 *
 * ```ts
 * import { CiStepEnvironment, readStepVariable } from "@beep/repo-cli/commands/Ci"
 * import * as ConfigProvider from "effect/ConfigProvider"
 * import * as Effect from "effect/Effect"
 *
 * const workspace = readStepVariable("ci cache-pilot-cleanup", "GITHUB_WORKSPACE").pipe(
 *   Effect.provideService(
 *     CiStepEnvironment,
 *     ConfigProvider.fromUnknown({ GITHUB_WORKSPACE: "/work" }, { preserveEmptyStrings: true })
 *   )
 * )
 * console.log(Effect.isEffect(workspace)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const CiStepEnvironment: Context.Reference<ConfigProvider.ConfigProvider> = Context.Reference(
  $I`CiStepEnvironment`,
  { defaultValue: () => ConfigProvider.fromEnv({ preserveEmptyStrings: true }) }
);

/**
 * Read a step environment variable with `set -u` semantics.
 *
 * **Details**
 *
 * A variable set to the empty string is a value, unlike the default provider,
 * which reads it as missing. An unset variable prints
 * `<command>: <name>: unbound variable` to stderr and fails with exit 1 before
 * anything it guards runs.
 *
 * **Example** (Require the workspace path)
 *
 * ```ts
 * import { readStepVariable } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readStepVariable("ci cache-pilot-cleanup", "GITHUB_WORKSPACE"))) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const readStepVariable = Effect.fn("Ci.readStepVariable")(function* (command: string, name: string) {
  const environment = yield* CiStepEnvironment;
  const value = yield* Config.option(Config.String(name)).pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, environment)
  );
  if (O.isSome(value)) return value.value;
  const message = `${command}: ${name}: unbound variable`;
  yield* Console.error(message);
  return yield* failWithReportedExit(message);
});
const variable = (name: string) => readStepVariable("ci cache-pilot-cleanup", name);

// A refused path stays in place: log the workflow error and mark the cleanup failed.
const refusePath = (message: string) => Console.log(`::error::${message}`).pipe(Effect.as(true));

const removeOwned = Effect.fn("Ci.cleanupRemove")(function* (target: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .remove(target, { recursive: true, force: true })
    .pipe(
      Effect.catch(() =>
        Console.error(`ci cache-pilot-cleanup: cannot remove ${target}`).pipe(
          Effect.andThen(failWithReportedExit(`cannot remove ${target}`))
        )
      )
    );
});

// One `TRIAL_WORKTREE_*` entry; `true` when it was refused or `git worktree remove` failed.
const cleanupWorktree = Effect.fn("Ci.cleanupWorktree")(function* (workspace: string, tree: string) {
  const fs = yield* FileSystem.FileSystem;
  if (Str.isEmpty(tree) || !(yield* fs.exists(tree).pipe(Effect.orElseSucceed(() => false)))) return false;
  const owned = `${workspace}-worktrees/cache-producer-${yield* variable("GITHUB_RUN_ID")}-${yield* variable("GITHUB_RUN_ATTEMPT")}-`;
  if (tree !== `${owned}a` && tree !== `${owned}b`) return yield* refusePath("Refusing unexpected producer worktree.");
  // KEEP (D-22): git's own stderr (`... is not a working tree`) streams to the job log, the parity the
  // `ci-cache-pilot` goldens pin against the retired shell adapter; the kit captures it.
  return (yield* runInherited("git", ["worktree", "remove", "--", tree])) !== 0;
});

// `TRIAL_INPUTS`; `true` when it was refused.
const cleanupInputs = Effect.fn("Ci.cleanupInputs")(function* (inputs: string, expected: string) {
  if (Str.isEmpty(inputs)) return false;
  if (inputs !== expected) return yield* refusePath("Refusing unexpected producer input directory.");
  yield* removeOwned(inputs);
  return false;
});

// Whether `TRIAL_ROOT` is the one private directory the mode owns.
const isOwnedPrivateRoot = Effect.fn("Ci.isOwnedPrivateRoot")(function* (mode: CiCachePilotMode, trialRoot: string) {
  if (mode === "signed") return trialRoot === `${yield* variable("HOME")}/.cache/beep/cache-producer-trial-v1`;
  // `${TRIAL_ROOT##*/beep-cache-local-observation.}`: drop through the last marker.
  const suffix = O.match(Str.lastIndexOf(LOCAL_OBSERVATION_PREFIX)(trialRoot), {
    onNone: () => trialRoot,
    onSome: (index) => Str.slice(index + LOCAL_OBSERVATION_PREFIX.length)(trialRoot),
  });
  return (
    isLocalObservationSuffix(suffix) &&
    trialRoot === `${yield* variable("RUNNER_TEMP")}/beep-cache-local-observation.${suffix}`
  );
});

// `TRIAL_ROOT`; `true` when it was refused.
const cleanupPrivateRoot = Effect.fn("Ci.cleanupPrivateRoot")(function* (mode: CiCachePilotMode, trialRoot: string) {
  if (!(yield* isOwnedPrivateRoot(mode, trialRoot)))
    return yield* refusePath("Refusing unexpected private pilot directory.");
  yield* removeOwned(trialRoot);
  return false;
});

/**
 * Remove only the current job's pilot worktrees, inputs and private directory.
 *
 * **Details**
 *
 * Every path is read from the step environment (`TRIAL_WORKTREE_A`,
 * `TRIAL_WORKTREE_B`, `TRIAL_INPUTS`, `TRIAL_ROOT`) and compared with the one
 * layout the mode owns: the worktrees
 * `$GITHUB_WORKSPACE-worktrees/cache-producer-<run>-<attempt>-a` and `-b`,
 * the mode's `.beep/cache/` input directory and either
 * `$HOME/.cache/beep/cache-producer-trial-v1` (signed) or a six-character
 * `$RUNNER_TEMP/beep-cache-local-observation.XXXXXX` (local). Anything else is
 * refused with a workflow error and left in place; every owned path is still
 * removed, and any refusal or failed `git worktree remove` exits 1. An
 * unsupported mode exits 64.
 *
 * **Example** (Clean up a signed trial)
 *
 * ```ts
 * import { cleanupCachePilot } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(cleanupCachePilot("signed"))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const cleanupCachePilot = Effect.fn("Ci.cleanupCachePilot")(function* (mode: string) {
  if (!isPilotMode(mode)) {
    yield* Console.error("Unsupported cleanup mode.");
    return yield* failWithReportedExit("Unsupported cleanup mode.", 64);
  }
  const workspace = yield* variable("GITHUB_WORKSPACE");
  const expectedInputs = `${workspace}/.beep/cache/${mode === "signed" ? "protected-producer-trial" : "local-pilot-observation"}`;
  const trees = [yield* variable("TRIAL_WORKTREE_A"), yield* variable("TRIAL_WORKTREE_B")];
  const treeFailures = yield* Effect.forEach(trees, (tree) => cleanupWorktree(workspace, tree));
  const inputs = yield* variable("TRIAL_INPUTS");
  const inputsFailed = yield* cleanupInputs(inputs, expectedInputs);
  const trialRoot = yield* variable("TRIAL_ROOT");
  const privateFailed = yield* cleanupPrivateRoot(mode, trialRoot);
  if (A.some([...treeFailures, inputsFailed, privateFailed], F.identity))
    return yield* failWithReportedExit("Cache pilot cleanup refused or failed a path.");
});
