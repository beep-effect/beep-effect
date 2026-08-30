/**
 * Shared environment and config-provider readers for the repo CLI.
 *
 * Several command groups read optional configuration through Effect's
 * `Config`/`ConfigProvider` and fall back to defaults, and more than one of them
 * carried verbatim copies of the same synchronous readers. This module owns
 * those readers and the Turbo cache environment policy, including the
 * least-privilege environment passed to 1Password `op run`.
 *
 * All readers evaluate the environment lazily at call time (they are plain
 * functions that read through the ambient `ConfigProvider` when invoked), never
 * capturing values at module load. That is load-bearing: tests that mutate
 * `process.env` between cases rely on each call re-reading the current
 * environment.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as O from "@beep/utils/Option";
import { Config, ConfigProvider, Effect, flow, MutableHashMap, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runToExit } from "../process/StepExec.ts";
import {
  TurboCacheEnvironment,
  TurboCacheEnvName,
  TurboCacheMode,
  TurboCacheSecretEnvName,
  turboCacheValueSourceFor,
} from "./TurboCache.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { TurboCacheValueSource } from "./TurboCache.ts";

/**
 * Synchronously read an optional string config value from the ambient provider.
 *
 * **Example** (Check HOME is Option)
 *
 * ```ts
 * import { configStringOptionSync } from "@beep/repo-cli/internal/cli/EnvConfig"
 * import * as O from "effect/Option"
 *
 * console.log(O.isOption(configStringOptionSync("HOME")))
 * ```
 *
 * @param name - Config key to read.
 * @returns The configured value when present, evaluated at call time.
 * @category configuration
 * @since 0.0.0
 */
export const configStringOptionSync = (name: string): O.Option<string> =>
  Effect.runSync(Config.option(Config.string(name)));

/**
 * Check whether an optional string config value equals an expected value.
 *
 * **Example** (Match CI equals true)
 *
 * ```ts
 * import { configStringEqualsSync } from "@beep/repo-cli/internal/cli/EnvConfig"
 *
 * console.log(configStringEqualsSync("CI", "true"))
 * ```
 *
 * @param name - Config key to read.
 * @param expected - String value required for a match.
 * @returns Whether the configured value equals `expected`.
 * @category configuration
 * @since 0.0.0
 */
export const configStringEqualsSync: {
  (expected: string): (name: string) => boolean;
  (name: string, expected: string): boolean;
} = dual(2, (name: string, expected: string): boolean =>
  pipe(
    configStringOptionSync(name),
    O.exists((value) => value === expected)
  )
);

/**
 * Read an optional string config value inside an Effect workflow, succeeding
 * with `None` instead of failing when the value is absent or malformed.
 *
 * **Example** (Run HOME option Effect)
 *
 * ```ts
 * import { configStringOption } from "@beep/repo-cli/internal/cli/EnvConfig"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * console.log(O.isOption(Effect.runSync(configStringOption("HOME"))))
 * ```
 *
 * @param name - Config key to read.
 * @returns An Effect yielding the configured value when present.
 * @category configuration
 * @since 0.0.0
 */
export const configStringOption = (name: string): Effect.Effect<O.Option<string>> =>
  Config.option(Config.string(name)).pipe(Effect.orElseSucceed(O.none<string>));

/**
 * Read an optional string config value through the `ConfigProvider` service.
 *
 * **Details**
 *
 * Unlike {@link configStringOption}, this surfaces the provider's config error
 * so callers can map it to a domain error at their boundary.
 *
 * **Example** (Effect for optional HOME)
 *
 * ```ts
 * import { readOptionalConfigString } from "@beep/repo-cli/internal/cli/EnvConfig"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(readOptionalConfigString("HOME")))
 * ```
 *
 * @param key - Config key to read.
 * @returns An Effect yielding the configured value when present.
 * @category configuration
 * @since 0.0.0
 */
export const readOptionalConfigString = (key: string) =>
  ConfigProvider.ConfigProvider.use(pipe(Config.string(key), Config.option).parse);

/**
 * Read an optional redacted string config value through the `ConfigProvider`
 * service, keeping the value wrapped in `Redacted`.
 *
 * **Example** (Effect for redacted SECRET)
 *
 * ```ts
 * import { readOptionalRedactedConfigString } from "@beep/repo-cli/internal/cli/EnvConfig"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(readOptionalRedactedConfigString("SECRET")))
 * ```
 *
 * @param key - Config key to read.
 * @returns An Effect yielding the redacted value when present.
 * @category configuration
 * @since 0.0.0
 */
export const readOptionalRedactedConfigString = (key: string) =>
  ConfigProvider.ConfigProvider.use(pipe(key, Config.redacted, Config.option).parse);

/**
 * Read a non-empty string environment value, falling back to a default.
 *
 * **Example** (Default for unset variable)
 *
 * ```ts
 * import { envValue } from "@beep/repo-cli/internal/cli/EnvConfig"
 *
 * console.log(envValue("DEFINITELY_UNSET_VAR", "default")) // "default"
 * ```
 *
 * @param name - Config key to read.
 * @param fallback - Value returned when the key is absent or empty.
 * @returns The configured non-empty value or the fallback.
 * @category configuration
 * @since 0.0.0
 */
export const envValue: {
  (name: string, fallback: string): string;
  (fallback: string): (name: string) => string;
} = dual(2, (name: string, fallback: string): string =>
  pipe(
    configStringOptionSync(name),
    O.filter(Str.isNonEmpty),
    O.getOrElse(() => fallback)
  )
);

/**
 * Read a positive integer environment value, falling back to a default.
 *
 * **Example** (Integer default for unset)
 *
 * ```ts
 * import { intEnvValue } from "@beep/repo-cli/internal/cli/EnvConfig"
 *
 * console.log(intEnvValue("DEFINITELY_UNSET_VAR", 180))
 * ```
 *
 * @param name - Config key to read.
 * @param fallback - Value returned when the key is absent or not a positive integer.
 * @returns The parsed positive integer or the fallback.
 * @category configuration
 * @since 0.0.0
 */
export const intEnvValue: {
  (name: string, fallback: number): number;
  (fallback: number): (name: string) => number;
} = dual(2, (name: string, fallback: number): number => {
  const parsed = Number.parseInt(envValue(name, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
});

/**
 * Read a boolean environment value, accepting `true/1/yes` and `false/0/no`
 * (case-insensitive) and falling back to a default otherwise.
 *
 * **Example** (Boolean default for unset)
 *
 * ```ts
 * import { booleanEnvValue } from "@beep/repo-cli/internal/cli/EnvConfig"
 *
 * console.log(booleanEnvValue("DEFINITELY_UNSET_VAR", true))
 * ```
 *
 * @param name - Config key to read.
 * @param fallback - Value returned when the key is absent or unrecognized.
 * @returns The parsed boolean or the fallback.
 * @category configuration
 * @since 0.0.0
 */
export const booleanEnvValue: {
  (name: string, fallback: boolean): boolean;
  (fallback: boolean): (name: string) => boolean;
} = dual(2, (name: string, fallback: boolean): boolean => {
  const normalized = Str.toLowerCase(Str.trim(envValue(name, "")));
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  return fallback;
});

/**
 * Whether a value is an unresolved 1Password secret reference (`op://...`).
 *
 * **Example** (Detect unresolved op references)
 *
 * ```ts
 * import { isUnresolvedSecretReference } from "@beep/repo-cli/internal/cli/EnvConfig"
 *
 * console.log(isUnresolvedSecretReference("op://vault/item/field"))
 * console.log(isUnresolvedSecretReference("postgres://localhost"))
 * ```
 *
 * @param value - The candidate value.
 * @returns Whether the value is a still-unresolved `op://` reference.
 * @category configuration
 * @since 0.0.0
 */
export const isUnresolvedSecretReference = (value: string | undefined): boolean =>
  value !== undefined && Str.startsWith("op://")(value);

const OP_RUN_ARGUMENT_SEPARATOR = "--";

const isBunxTurbo = (command: string, args: ReadonlyArray<string>): boolean =>
  command === "bunx" &&
  pipe(
    A.head(args),
    O.exists((arg) => arg === "turbo")
  );

// `op run -- bunx turbo ...` is still a turbo spawn: the
// overrides below must reach it, or an op-wrapped lane silently loses the
// mouse-capture guard and the fail-closed cache posture.
const isOpRunTurbo = (command: string, args: ReadonlyArray<string>): boolean =>
  command === "op" &&
  pipe(
    A.findFirstIndex(args, (arg) => arg === OP_RUN_ARGUMENT_SEPARATOR),
    O.map((index) => A.drop(args, index + 1)),
    O.exists((childArgs) =>
      pipe(
        A.head(childArgs),
        O.exists((childCommand) => isBunxTurbo(childCommand, A.drop(childArgs, 1)))
      )
    )
  );

const isTurboCacheSecretEnvName = S.is(TurboCacheSecretEnvName);

/**
 * Remove unrelated `op://` references from a Turbo secret-session environment.
 *
 * **Details**
 *
 * Ordinary ambient values remain available so the 1Password CLI and Turbo can
 * find their runtime configuration. Only `TURBO_API`, `TURBO_TOKEN`, and
 * `TURBO_TEAM` may retain unresolved references for `op run` to resolve.
 *
 * **Example** (Drop an unrelated reference)
 *
 * ```ts
 * import { turboCacheSecretSessionEnvironment } from "@beep/repo-cli/test/SharedInternals"
 *
 * const env = turboCacheSecretSessionEnvironment({
 *   PATH: "/usr/bin",
 *   TURBO_TOKEN: "op://fixture-vault/turbo/token",
 *   OTHER_TOKEN: "op://fixture-vault/other/token"
 * })
 * console.log(env.OTHER_TOKEN) // undefined
 * ```
 *
 * @param environment - Complete ambient environment before secret resolution.
 * @returns An environment with only Turbo credential references retained.
 * @category configuration
 * @since 0.0.0
 */
export const turboCacheSecretSessionEnvironment = (
  environment: Readonly<Record<string, string | undefined>>
): Record<string, string> =>
  R.filter(
    environment,
    (value, name): value is string =>
      value !== undefined && (!isUnresolvedSecretReference(value) || isTurboCacheSecretEnvName(name))
  );

/**
 * Decide whether a Turbo spawn may inherit the ambient process environment.
 *
 * **Details**
 *
 * A direct Turbo spawn extends the ambient environment. A Turbo invocation
 * wrapped in `op run` receives the complete sanitized environment from
 * {@link turboCacheSecretSessionEnvironment}, so extending it would restore the
 * unrelated references that the sanitizer removed.
 *
 * **Example** (Isolate a wrapped Turbo spawn)
 *
 * ```ts
 * import { turboEnvExtendsAmbient } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(turboEnvExtendsAmbient("op", ["run", "--", "bunx", "turbo", "run", "check"])) // false
 * ```
 *
 * @param command - The command being spawned.
 * @param args - The command arguments.
 * @returns Whether the child should extend the ambient environment.
 * @category configuration
 * @since 0.0.0
 */
export const turboEnvExtendsAmbient: {
  (args: ReadonlyArray<string>): (command: string) => boolean;
  (command: string, args: ReadonlyArray<string>): boolean;
} = dual(2, (command: string, args: ReadonlyArray<string>): boolean => !isOpRunTurbo(command, args));

/**
 * Compute the environment applied when spawning `turbo`, directly via `bunx`
 * or wrapped in `op run`.
 *
 * **Details**
 *
 * Forces `TURBO_UI=false` so the child never enables its interactive TUI (which
 * can leave the terminal in mouse-capture mode when a task tears down), and
 * scrubs `TURBO_API`/`TURBO_TOKEN`/`TURBO_TEAM` when they are unresolved
 * `op://` references. A wrapped spawn receives a complete sanitized environment
 * for use with `extendEnv: false`. Returns an empty object for any non-turbo
 * command.
 *
 * **Gotchas**
 *
 * Scrubbing a credential and leaving a remote cache posture in place would ask
 * turbo to read a remote cache it has no usable token for, so a scrub also
 * pins `TURBO_CACHE` to local-only. That is the environment half of failing
 * closed; the argument half is `localOnlyTurboCacheArgs`, because a `--cache`
 * flag outranks the environment variable.
 *
 * A wrapped spawn retains only the three Turbo credential references. Callers
 * must pair its result with {@link turboEnvExtendsAmbient}; otherwise the child
 * process merge would restore unrelated references from the parent.
 *
 * **Example** (Turbo and non-turbo overrides)
 *
 * ```ts
 * import { turboEnvOverrides } from "@beep/repo-cli/internal/cli/EnvConfig"
 * import { Effect } from "effect"
 *
 * console.log(Effect.runSync(turboEnvOverrides("bunx", ["turbo", "run", "check"], {})).TURBO_UI)
 * console.log(Effect.runSync(turboEnvOverrides("git", ["status"], {})))
 * ```
 *
 * @param command - The command being spawned.
 * @param args - The command arguments.
 * @param environment - Complete ambient environment to sanitize for a wrapped spawn.
 * @returns The direct-spawn overrides or complete wrapped-spawn environment.
 * @category configuration
 * @since 0.0.0
 */
export const turboEnvOverrides = Effect.fn("EnvConfig.turboEnvOverrides")(function* (
  command: string,
  args: ReadonlyArray<string>,
  environment: Readonly<Record<string, string | undefined>>
) {
  const directTurbo = isBunxTurbo(command, args);
  if (!directTurbo && !isOpRunTurbo(command, args)) {
    return {};
  }

  // A wrapped spawn hands this complete environment to `op run` with ambient
  // extension disabled. The three Turbo references survive for resolution;
  // every unrelated reference is absent from both `op` and its task child.
  if (!directTurbo) {
    return { ...turboCacheSecretSessionEnvironment(environment), TURBO_UI: "false" };
  }

  const turboApi = yield* configStringOption("TURBO_API");
  const turboToken = yield* configStringOption("TURBO_TOKEN");
  const turboTeam = yield* configStringOption("TURBO_TEAM");
  const unresolvedApi = isUnresolvedSecretReference(pipe(turboApi, O.getOrUndefined));
  const unresolvedToken = isUnresolvedSecretReference(pipe(turboToken, O.getOrUndefined));
  const unresolvedTeam = isUnresolvedSecretReference(pipe(turboTeam, O.getOrUndefined));
  return {
    // Spawned turbo inherits the parent TTY; its interactive TUI enables
    // crossterm mouse capture (DECSET ?1000/?1002/?1003/?1006) and, when a
    // failed task tears the run down, the child is killed before it can restore
    // the terminal — leaving it emitting mouse-motion reports and swallowing
    // Ctrl-C. Force turbo's stream renderer so it never enables mouse capture.
    TURBO_UI: "false",
    ...(unresolvedApi ? { TURBO_API: undefined } : {}),
    ...(unresolvedToken ? { TURBO_TOKEN: undefined } : {}),
    ...(unresolvedTeam ? { TURBO_TEAM: undefined } : {}),
    ...(unresolvedApi || unresolvedToken || unresolvedTeam ? { TURBO_CACHE: TurboCacheMode.Enum.LocalOnly } : {}),
  };
});

const configuredValue = (value: string | undefined): O.Option<string> =>
  pipe(O.fromUndefinedOr(value), O.map(Str.trim), O.filter(Str.isNonEmpty));

const turboCacheValueSource = (value: string | undefined): O.Option<TurboCacheValueSource> =>
  pipe(configuredValue(value), O.map(flow(isUnresolvedSecretReference, turboCacheValueSourceFor)));

/**
 * Classify a Turbo remote-read configuration from an explicit environment
 * record.
 *
 * **Details**
 *
 * A pure function of its argument, so every classification arm is reachable
 * from a unit test regardless of what the host process carries. Credential
 * *values* never leave this function: `TURBO_API`, `TURBO_TOKEN`, and
 * `TURBO_TEAM` are reduced to whether they are literal or still an unresolved
 * `op://` reference, blank and missing names are absent, and only the
 * non-secret `TURBO_CACHE` posture is carried through verbatim.
 *
 * **Example** (Classify a workstation posture)
 *
 * ```ts
 * import { readTurboCacheEnvironment } from "@beep/repo-cli/internal/cli/EnvConfig"
 *
 * const environment = readTurboCacheEnvironment({
 *   TURBO_API: "https://cache.example.test",
 *   TURBO_TOKEN: "op://vault/turbo/token",
 *   TURBO_TEAM: "",
 *   TURBO_CACHE: "local:rw,remote:r",
 * })
 * console.log(environment.api)
 * console.log(environment.token)
 * console.log(environment.team)
 * ```
 *
 * @param environment - Environment record to classify; values may be undefined.
 * @returns The remote-read configuration the record carries.
 * @category configuration
 * @since 0.0.0
 */
export const readTurboCacheEnvironment = (
  environment: Readonly<Record<string, string | undefined>>
): TurboCacheEnvironment =>
  TurboCacheEnvironment.make(
    O.getSomesStruct({
      api: turboCacheValueSource(environment.TURBO_API),
      token: turboCacheValueSource(environment.TURBO_TOKEN),
      team: turboCacheValueSource(environment.TURBO_TEAM),
      cache: configuredValue(environment.TURBO_CACHE),
    })
  );

/**
 * Read the checkout's Turbo remote-read configuration from the ambient
 * environment.
 *
 * **Details**
 *
 * Evaluated at call time, like every other reader here: the four
 * {@link TurboCacheEnvName} values are read through the ambient provider and
 * handed to {@link readTurboCacheEnvironment}, which owns the classification.
 *
 * **Example** (Read the ambient cache configuration)
 *
 * ```ts
 * import { readTurboCacheEnvironmentSync } from "@beep/repo-cli/internal/cli/EnvConfig"
 *
 * console.log(typeof readTurboCacheEnvironmentSync().cache)
 * ```
 *
 * @returns The remote-read configuration this checkout carries.
 * @category configuration
 * @since 0.0.0
 */
export const readTurboCacheEnvironmentSync = (): TurboCacheEnvironment =>
  readTurboCacheEnvironment(
    R.fromIterableWith(TurboCacheEnvName.Options, (name) => [name, O.getOrUndefined(configStringOptionSync(name))])
  );

const turboSecretSessionVerdicts = MutableHashMap.empty<string, boolean>();

/** Clear process-local Turbo secret-session probes for isolated tests. */
export const clearTurboCacheSecretSessionVerdictsForTesting = (): void => {
  MutableHashMap.clear(turboSecretSessionVerdicts);
};

/**
 * Whether a local Turbo secret session can be used at `repoRoot`.
 *
 * **Details**
 *
 * Returns `false` under CI or when `op whoami` does not succeed. The caller has
 * already established that the ambient Turbo configuration contains an
 * unresolved reference.
 *
 * **Example** (Check local env Effect)
 *
 * ```ts
 * import { canUseTurboCacheSecretSession } from "@beep/repo-cli/internal/cli/EnvConfig"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(canUseTurboCacheSecretSession("/repo")))
 * ```
 *
 * @param repoRoot - Working directory used for the 1Password identity check.
 * @returns Whether local 1Password reference resolution is available.
 * @category execution
 * @since 0.0.0
 */
export const canUseTurboCacheSecretSession = Effect.fn("EnvConfig.canUseTurboCacheSecretSession")(function* (
  repoRoot: string
): Effect.fn.Return<boolean, never, ChildProcessSpawner.ChildProcessSpawner> {
  const ci = yield* configStringOption("CI");
  if (
    pipe(
      ci,
      O.exists((value) => value === "true")
    )
  ) {
    return false;
  }

  const cacheKey = `${repoRoot}\0${O.getOrElse(ci, () => "")}`;
  const cached = MutableHashMap.get(turboSecretSessionVerdicts, cacheKey);
  if (O.isSome(cached)) return cached.value;

  const whoamiExitCode = yield* runToExit({ command: "op", args: ["whoami"], cwd: repoRoot, stdio: "ignore" }).pipe(
    Effect.orElseSucceed(() => 1)
  );
  if (whoamiExitCode !== 0) {
    MutableHashMap.set(turboSecretSessionVerdicts, cacheKey, false);
    return false;
  }

  // `op whoami` proves only that the desktop/CLI session is alive. Resolve
  // every `op://` value in the environment through a no-output child so a
  // stale item or field reference degrades the lane before the real Turbo
  // command is wrapped. No resolved value is printed or returned.
  const referenceProbeExitCode = yield* runToExit({
    command: "op",
    args: ["run", "--", "/usr/bin/true"],
    cwd: repoRoot,
    stdio: "ignore",
  }).pipe(Effect.orElseSucceed(() => 1));
  const usable = referenceProbeExitCode === 0;
  MutableHashMap.set(turboSecretSessionVerdicts, cacheKey, usable);
  return usable;
});
