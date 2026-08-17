/**
 * Shared environment and config-provider readers for the repo CLI.
 *
 * Several command groups read optional configuration through Effect's
 * `Config`/`ConfigProvider` and fall back to defaults, and more than one of them
 * carried verbatim copies of the same synchronous readers. This module owns
 * those readers, the turbo env/token policy, and the 1Password `op run`
 * local-env wrapper once.
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

import { $RepoCliId } from "@beep/identity/packages";
import { thunkFalse } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Config, ConfigProvider, Effect, FileSystem, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runToExit } from "../process/StepExec.ts";
import { TurboCacheEnvironment, TurboCacheMode, turboCacheValueSourceFor } from "./TurboCache.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { TurboCacheValueSource } from "./TurboCache.ts";

const $I = $RepoCliId.create("internal/cli/EnvConfig");

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

// `op run --env-file=.env -- bunx turbo ...` is still a turbo spawn: the
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

/**
 * Compute the environment overrides applied when spawning `turbo`, directly via
 * `bunx` or wrapped in `op run`.
 *
 * **Details**
 *
 * Forces `TURBO_UI=false` so the child never enables its interactive TUI (which
 * can leave the terminal in mouse-capture mode when a task tears down), and
 * scrubs `TURBO_API`/`TURBO_TOKEN`/`TURBO_TEAM` when they are unresolved
 * `op://` references. Returns an empty object for any non-turbo command.
 *
 * **Gotchas**
 *
 * Scrubbing a credential and leaving a remote cache posture in place would ask
 * turbo to read a remote cache it has no usable token for, so a scrub also
 * pins `TURBO_CACHE` to local-only. That is the environment half of failing
 * closed; the argument half is `localOnlyTurboCacheArgs`, because a `--cache`
 * flag outranks the environment variable.
 *
 * The scrub applies to a *direct* turbo spawn only. `op run` resolves `op://`
 * references out of the environment it is handed — not just out of its
 * `--env-file` — so scrubbing them from a wrapped spawn would delete the very
 * references it exists to resolve, leaving the wrapped turbo with no
 * credential at all.
 *
 * **Example** (Turbo and non-turbo overrides)
 *
 * ```ts
 * import { turboEnvOverrides } from "@beep/repo-cli/internal/cli/EnvConfig"
 * import { Effect } from "effect"
 *
 * console.log(Effect.runSync(turboEnvOverrides("bunx", ["turbo", "run", "check"])).TURBO_UI)
 * console.log(Effect.runSync(turboEnvOverrides("git", ["status"])))
 * ```
 *
 * @param command - The command being spawned.
 * @param args - The command arguments.
 * @returns The environment overrides to merge into the child environment.
 * @category configuration
 * @since 0.0.0
 */
export const turboEnvOverrides = Effect.fn("EnvConfig.turboEnvOverrides")(function* (
  command: string,
  args: ReadonlyArray<string>
) {
  const directTurbo = isBunxTurbo(command, args);
  if (!directTurbo && !isOpRunTurbo(command, args)) {
    return {};
  }

  // A wrapped spawn hands its environment to `op run`, which resolves the
  // `op://` references in it. Scrubbing them here would strip the credential
  // before it can be resolved, so a wrapped spawn takes the TUI guard only.
  if (!directTurbo) {
    return { TURBO_UI: "false" };
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

const turboCacheValueSource = (name: string): O.Option<TurboCacheValueSource> =>
  pipe(
    configStringOptionSync(name),
    O.map(Str.trim),
    O.filter(Str.isNonEmpty),
    O.map((value) => turboCacheValueSourceFor(isUnresolvedSecretReference(value)))
  );

/**
 * Read the checkout's Turbo remote-read configuration from the ambient
 * environment.
 *
 * **Details**
 *
 * Evaluated at call time, like every other reader here. Credential *values*
 * never leave this function: `TURBO_API`, `TURBO_TOKEN`, and `TURBO_TEAM` are
 * reduced to whether they are literal or still an unresolved `op://` reference,
 * and only the non-secret `TURBO_CACHE` posture is carried through verbatim.
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
  TurboCacheEnvironment.make(
    O.getSomesStruct({
      api: turboCacheValueSource("TURBO_API"),
      token: turboCacheValueSource("TURBO_TOKEN"),
      team: turboCacheValueSource("TURBO_TEAM"),
      cache: pipe(configStringOptionSync("TURBO_CACHE"), O.map(Str.trim), O.filter(Str.isNonEmpty)),
    })
  );

/**
 * A subprocess step shape recognized by the local-env wrapper.
 *
 * **Example** (Make LocalEnvStep instance)
 *
 * ```ts
 * import { LocalEnvStep } from "@beep/repo-cli/internal/cli/EnvConfig"
 *
 * const step = LocalEnvStep.make({ label: "test", command: "bun", args: ["test"], cwd: "/repo" })
 * console.log(step.command)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LocalEnvStep extends S.Class<LocalEnvStep>($I`LocalEnvStep`)(
  {
    label: S.String,
    command: S.String,
    args: S.Array(S.String),
    cwd: S.String,
    useLocalEnv: S.optionalKey(S.Boolean),
  },
  $I.annote("LocalEnvStep", {
    description: "A subprocess step recognized by the local-env op-run wrapper.",
  })
) {}

/**
 * Whether the local `op run --env-file=.env` wrapper can be used at `repoRoot`.
 *
 * **Details**
 *
 * Returns `false` under CI, when no `.env` file is present, or when
 * `op whoami` does not succeed.
 *
 * **Example** (Check local env Effect)
 *
 * ```ts
 * import { canUseLocalEnv } from "@beep/repo-cli/internal/cli/EnvConfig"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(canUseLocalEnv(process.cwd())))
 * ```
 *
 * @param repoRoot - Directory that should contain the `.env` file.
 * @returns Whether local 1Password env injection is available.
 * @category execution
 * @since 0.0.0
 */
export const canUseLocalEnv = Effect.fn("EnvConfig.canUseLocalEnv")(function* (
  repoRoot: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner> {
  const ci = yield* configStringOption("CI");
  if (
    pipe(
      ci,
      O.exists((value) => value === "true")
    )
  ) {
    return false;
  }

  const fs = yield* FileSystem.FileSystem;
  const hasEnv = yield* fs.exists(`${repoRoot}/.env`).pipe(Effect.orElseSucceed(thunkFalse));
  if (!hasEnv) {
    return false;
  }

  const exitCode = yield* runToExit({ command: "op", args: ["whoami"], cwd: repoRoot, stdio: "ignore" }).pipe(
    Effect.orElseSucceed(() => 1)
  );
  return exitCode === 0;
});

/**
 * Rewrite a step to run under `op run --env-file=.env`.
 *
 * **Details**
 *
 * A pure transformation; use {@link withLocalEnv} to apply it only when local
 * env injection is both requested and available.
 *
 * **Example** (Rewrite step via op run)
 *
 * ```ts
 * import { localEnvOpRunStep } from "@beep/repo-cli/internal/cli/EnvConfig"
 *
 * const wrapped = localEnvOpRunStep({ label: "test", command: "bun", args: ["test"], cwd: "/repo" })
 * console.log(wrapped.command)
 * ```
 *
 * @param step - The step to wrap.
 * @returns The step rewritten to invoke `op run`.
 * @category execution
 * @since 0.0.0
 */
export const localEnvOpRunStep = (step: LocalEnvStep): LocalEnvStep => ({
  label: `${step.label} (op run)`,
  command: "op",
  args: ["run", "--env-file=.env", "--", step.command, ...step.args],
  cwd: step.cwd,
});

/**
 * Wrap a step with 1Password `op run` local env injection when the step opts in
 * (`useLocalEnv === true`) and local env is available at its `cwd`; otherwise
 * return the step unchanged.
 *
 * **Example** (Conditionally wrap step Effect)
 *
 * ```ts
 * import { withLocalEnv } from "@beep/repo-cli/internal/cli/EnvConfig"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(withLocalEnv({ label: "x", command: "bun", args: [], cwd: "/repo" })))
 * ```
 *
 * @param step - The step to conditionally wrap.
 * @returns The original or `op run`-wrapped step.
 * @category execution
 * @since 0.0.0
 */
export const withLocalEnv = Effect.fn("EnvConfig.withLocalEnv")(function* (
  step: LocalEnvStep
): Effect.fn.Return<LocalEnvStep, never, FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner> {
  if (step.useLocalEnv !== true) {
    return step;
  }

  const shouldUseLocalEnv = yield* canUseLocalEnv(step.cwd);
  if (!shouldUseLocalEnv) {
    return step;
  }

  return localEnvOpRunStep(step);
});
