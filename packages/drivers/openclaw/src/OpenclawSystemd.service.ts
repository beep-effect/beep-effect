/**
 * Effect service for `systemctl --user` control of stack-owned OpenClaw units.
 *
 * Every operation runs `systemctl --user <verb> [unit]` and inherits the
 * calling environment (`extendEnv: true`) because systemctl needs
 * `XDG_RUNTIME_DIR`/`DBUS_SESSION_BUS_ADDRESS` from the invoking session; the
 * P2 applicator owns constructing that environment. `is-active` nonzero exits
 * are results (the state string), never error-channel failures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OpenclawId } from "@beep/identity";
import { Context, Duration, Effect, Layer, Number as N, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { ChildProcessSpawner } from "effect/unstable/process";
import { spawnProcessResult } from "./internal/spawn.ts";
import { OPENCLAW_SYSTEMCTL_TIMEOUT } from "./Openclaw.config.ts";
import { OpenclawCommandExitError, OpenclawCommandTimeoutError, OpenclawOutputParseError } from "./Openclaw.errors.ts";
import { OpenclawProcessRequest, OpenclawSystemdUnitState } from "./Openclaw.models.ts";
import type { OpenclawCliError } from "./Openclaw.errors.ts";
import type { OpenclawProcessResult } from "./Openclaw.models.ts";
import type { OpenclawCliRunner } from "./OpenclawCli.service.ts";

const $I = $OpenclawId.create("OpenclawSystemd.service");

const showLinePattern = /^([^=]+)=(.*)$/u;
const showProperties = ["MainPID", "ActiveState", "FragmentPath", "ControlGroup"];

const parseShowLine = (line: string): O.Option<readonly [string, string]> =>
  pipe(
    O.fromNullishOr(showLinePattern.exec(line)),
    O.flatMap((match) => O.all([O.fromUndefinedOr(match[1]), O.fromUndefinedOr(match[2])]))
  );

const parseUnitState = (
  executable: string,
  stdout: string
): Effect.Effect<OpenclawSystemdUnitState, OpenclawOutputParseError> => {
  const properties = R.fromEntries(A.getSomes(A.map(Str.split(Str.trim(stdout), "\n"), parseShowLine)));
  const nonBlankProperty = (name: string): O.Option<string> =>
    pipe(R.get(properties, name), O.map(Str.trim), O.filter(Str.isNonEmpty));

  return O.match(nonBlankProperty("ActiveState"), {
    onNone: () =>
      Effect.fail(
        OpenclawOutputParseError.make({
          cause: "Missing ActiveState in systemctl show output.",
          executable,
          stdoutLength: Str.length(stdout),
          subcommand: "show",
        })
      ),
    onSome: (activeState) =>
      Effect.succeed(
        OpenclawSystemdUnitState.make({
          activeState,
          controlGroup: nonBlankProperty("ControlGroup"),
          fragmentPath: nonBlankProperty("FragmentPath"),
          mainPid: pipe(
            nonBlankProperty("MainPID"),
            O.flatMap(N.parse),
            O.filter((pid) => pid > 0)
          ),
        })
      ),
  });
};

/**
 * Runtime shape exposed by the OpenClaw systemd control service.
 *
 * @category services
 * @since 0.0.0
 */
interface OpenclawSystemdShape {
  readonly daemonReload: Effect.Effect<void, OpenclawCliError>;
  readonly disable: (unit: string) => Effect.Effect<void, OpenclawCliError>;
  readonly enable: (unit: string) => Effect.Effect<void, OpenclawCliError>;
  readonly isActive: (unit: string) => Effect.Effect<string, OpenclawCliError>;
  readonly resetFailed: (unit: string) => Effect.Effect<void, OpenclawCliError>;
  readonly restart: (unit: string) => Effect.Effect<void, OpenclawCliError>;
  readonly show: (unit: string) => Effect.Effect<OpenclawSystemdUnitState, OpenclawCliError>;
  readonly start: (unit: string) => Effect.Effect<void, OpenclawCliError>;
  readonly stop: (unit: string) => Effect.Effect<void, OpenclawCliError>;
}

const verbLabel = (request: OpenclawProcessRequest): string =>
  pipe(
    A.get(request.args, 1),
    O.orElse(() => A.head(request.args)),
    O.getOrElse(() => request.executable)
  );

const runInherited = (
  spawner: ChildProcessSpawner.ChildProcessSpawner["Service"],
  request: OpenclawProcessRequest
): Effect.Effect<OpenclawProcessResult, OpenclawCliError> =>
  spawnProcessResult({ extendEnv: true, request, spawner, subcommand: verbLabel(request) });

const makeService = (executable: string, runner: OpenclawCliRunner): OpenclawSystemdShape => {
  const timeoutMs = Duration.toMillis(OPENCLAW_SYSTEMCTL_TIMEOUT);

  const execute = Effect.fnUntraced(function* (subcommand: string, args: ReadonlyArray<string>) {
    const request = OpenclawProcessRequest.make({
      args: ["--user", ...args],
      env: R.empty(),
      executable,
      timeoutMs: O.some(timeoutMs),
    });

    return yield* runner(request).pipe(
      Effect.timeout(OPENCLAW_SYSTEMCTL_TIMEOUT),
      Effect.catchTag("TimeoutError", () =>
        Effect.fail(
          OpenclawCommandTimeoutError.make({
            executable,
            subcommand,
            timeoutMs,
          })
        )
      )
    );
  });

  const runVerb = Effect.fnUntraced(function* (verb: string, args: ReadonlyArray<string>) {
    const result = yield* execute(verb, args);
    if (result.exitCode !== 0) {
      return yield* OpenclawCommandExitError.make({
        executable,
        exitCode: result.exitCode,
        stderrLength: Str.length(result.stderr),
        stdoutLength: Str.length(result.stdout),
        subcommand: verb,
      });
    }
  });

  const unitVerb = (spanName: string, verb: string) =>
    Effect.fn(spanName)(function* (unit: string) {
      return yield* runVerb(verb, [verb, unit]);
    });

  const daemonReload = runVerb("daemon-reload", ["daemon-reload"]).pipe(
    Effect.withSpan("OpenclawSystemd.daemonReload")
  );

  const isActive = Effect.fn("OpenclawSystemd.isActive")(function* (unit: string) {
    const result = yield* execute("is-active", ["is-active", unit]);
    return Str.trim(result.stdout);
  });

  const show = Effect.fn("OpenclawSystemd.show")(function* (unit: string) {
    const args = ["show", unit, ...A.flatMap(showProperties, (property) => ["-p", property])];
    const result = yield* execute("show", args);
    if (result.exitCode !== 0) {
      return yield* OpenclawCommandExitError.make({
        executable,
        exitCode: result.exitCode,
        stderrLength: Str.length(result.stderr),
        stdoutLength: Str.length(result.stdout),
        subcommand: "show",
      });
    }

    return yield* parseUnitState(executable, result.stdout);
  });

  return {
    daemonReload,
    disable: unitVerb("OpenclawSystemd.disable", "disable"),
    enable: unitVerb("OpenclawSystemd.enable", "enable"),
    isActive,
    resetFailed: unitVerb("OpenclawSystemd.resetFailed", "reset-failed"),
    restart: unitVerb("OpenclawSystemd.restart", "restart"),
    show,
    start: unitVerb("OpenclawSystemd.start", "start"),
    stop: unitVerb("OpenclawSystemd.stop", "stop"),
  };
};

/**
 * Effect service for `systemctl --user` control of OpenClaw units.
 *
 * **Details**
 *
 * All verbs are forced through `--user`; the executable is configurable for
 * tests only. Lifecycle verbs (`daemon-reload`, `enable`, `disable`, `start`,
 * `stop`, `restart`, `reset-failed`) fail with redacted
 * {@link OpenclawCommandExitError} values on nonzero exits, while `is-active`
 * models its nonzero exit as the reported state string and `show` parses
 * `Key=Value` property lines into {@link OpenclawSystemdUnitState}.
 *
 * **Example** (Mock runner isActive check)
 *
 * ```ts
 * import { OpenclawProcessResult } from "@beep/openclaw/Openclaw.models"
 * import { OpenclawSystemd } from "@beep/openclaw/OpenclawSystemd.service"
 * import type { OpenclawCliRunner } from "@beep/openclaw/OpenclawCli.service"
 * import { Effect } from "effect"
 *
 * const runner: OpenclawCliRunner = () =>
 *   Effect.succeed(OpenclawProcessResult.make({ exitCode: 3, stderr: "", stdout: "inactive\n" }))
 *
 * const program = Effect.gen(function* () {
 *   const systemd = yield* OpenclawSystemd
 *   return yield* systemd.isActive("openclaw-spike.service")
 * }).pipe(Effect.provide(OpenclawSystemd.makeLayerFromRunner(runner)))
 *
 * console.log(program)
 * ```
 *
 * @effects
 * Live layers spawn `systemctl --user` with the inherited environment through
 * `ChildProcessSpawner`; injected-runner layers perform only the effects
 * encoded by the supplied runner.
 * @category services
 * @since 0.0.0
 */
export class OpenclawSystemd extends Context.Service<OpenclawSystemd, OpenclawSystemdShape>()($I`OpenclawSystemd`) {
  /**
   * Build a live systemd control layer backed by native child processes.
   *
   * **Example** (Create live systemd layer)
   *
   * ```ts
   * import { OpenclawSystemd } from "@beep/openclaw/OpenclawSystemd.service"
   *
   * const layer = OpenclawSystemd.makeLayer()
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (
    executable = "systemctl"
  ): Layer.Layer<OpenclawSystemd, never, ChildProcessSpawner.ChildProcessSpawner> =>
    Layer.effect(
      OpenclawSystemd,
      Effect.gen(function* () {
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        return OpenclawSystemd.of(makeService(executable, (request) => runInherited(spawner, request)));
      })
    );

  /**
   * Build a deterministic test layer from an injected process runner.
   *
   * **Example** (Layer from injected runner)
   *
   * ```ts
   * import { OpenclawProcessResult } from "@beep/openclaw/Openclaw.models"
   * import { OpenclawSystemd } from "@beep/openclaw/OpenclawSystemd.service"
   * import type { OpenclawCliRunner } from "@beep/openclaw/OpenclawCli.service"
   * import { Effect } from "effect"
   *
   * const runner: OpenclawCliRunner = () =>
   *   Effect.succeed(OpenclawProcessResult.make({ exitCode: 0, stderr: "", stdout: "" }))
   *
   * console.log(OpenclawSystemd.makeLayerFromRunner(runner))
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayerFromRunner = (
    runner: OpenclawCliRunner,
    executable = "systemctl"
  ): Layer.Layer<OpenclawSystemd> =>
    Layer.succeed(OpenclawSystemd, OpenclawSystemd.of(makeService(executable, runner)));
}
