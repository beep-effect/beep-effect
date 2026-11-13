/**
 * Route liveness probes: the Claude Code live index for same-host peers and
 * the local `t3` CLI for T3 threads and linked environments.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { processStartTimeForPid } from "../../internal/repo-run/ProcessIdentity.ts";
import { RouteProbeReading } from "./Route.schemas.ts";
import type { RouteLiveness, T3ThreadRoute } from "./Route.schemas.ts";

const $I = $RepoCliId.create("commands/Session/RouteProbe.service");

/**
 * One environment linked to the local T3 server, as `t3 environment list`
 * reports it.
 *
 * **Example** (Make a linked environment)
 *
 * ```ts
 * import { LinkedT3Environment } from "@beep/repo-cli/test/Session"
 *
 * const environment = LinkedT3Environment.make({ environmentId: "env-2", label: "beep-worker", status: "reachable" })
 * console.log(environment.label) // "beep-worker"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LinkedT3Environment extends S.Opaque<LinkedT3Environment, { readonly brand: unique symbol }>()(
  S.Struct({ environmentId: S.NonEmptyString, label: S.String, status: S.String }).pipe(
    $I.annoteSchema("LinkedT3Environment", { description: "A T3 environment linked to this host and its status." })
  )
) {}

/**
 * Service contract: compute the liveness of one route from the harness's own
 * evidence. No probe fails; evidence that cannot be read is `unknown`.
 *
 * **Example** (Describe a peer probe)
 *
 * ```ts
 * import type { SessionRouteProbeShape } from "@beep/repo-cli/test/Session"
 *
 * const probePeer = (probe: SessionRouteProbeShape) => probe.claudePeer("5f0c2b8e")
 * console.log(probePeer.length) // 1
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface SessionRouteProbeShape {
  readonly claudePeer: (sessionId: string) => Effect.Effect<RouteProbeReading>;
  readonly environments: Effect.Effect<O.Option<ReadonlyArray<LinkedT3Environment>>>;
  readonly localEnvironmentId: Effect.Effect<O.Option<string>>;
  readonly t3Thread: (route: T3ThreadRoute) => Effect.Effect<RouteProbeReading>;
}

/**
 * Context tag for the route liveness probe.
 *
 * **Example** (Request the probe)
 *
 * ```ts
 * import { SessionRouteProbe } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(Effect.gen(function* () { return yield* SessionRouteProbe }))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SessionRouteProbe extends Context.Service<SessionRouteProbe, SessionRouteProbeShape>()(
  $I`SessionRouteProbe`
) {}

class ClaudeLiveIndexEntry extends S.Opaque<ClaudeLiveIndexEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    pid: S.Finite,
    procStart: S.String,
    sessionId: S.String,
    name: S.String.pipe(S.optionalKey),
  }).pipe(
    $I.annoteSchema("ClaudeLiveIndexEntry", {
      description: "The fields route probing reads from one ~/.claude/sessions/<pid>.json entry.",
    })
  )
) {}

class T3ThreadShow extends S.Opaque<T3ThreadShow, { readonly brand: unique symbol }>()(
  S.Struct({
    thread: S.Struct({
      status: S.String,
      archived: S.Boolean,
      parentThreadId: S.String.pipe(S.NullOr, S.optionalKey),
    }),
  }).pipe($I.annoteSchema("T3ThreadShow", { description: "The fields route probing reads from `t3 thread show`." }))
) {}

type T3CliOutput = { readonly stdout: string; readonly stderr: string; readonly exitCode: number };

const decodeLiveIndexEntry = S.decodeUnknownOption(S.fromJsonString(ClaudeLiveIndexEntry));
const decodeThreadShow = S.decodeUnknownOption(S.fromJsonString(T3ThreadShow));
const decodeEnvironments = S.decodeUnknownOption(S.fromJsonString(S.Array(LinkedT3Environment)));

const LIVE_INDEX_FILE = /^[0-9]+\.json$/u;
const T3_THREAD_TIMEOUT = Duration.seconds(10);
// `t3 environment list` pings every link before it answers (about 11 seconds
// with five links on 2026-11-13).
const T3_ENVIRONMENTS_TIMEOUT = Duration.seconds(30);
// Run statuses from T3's orchestration contract that mean a turn is in flight
// or about to be; every other non-archived status is a thread a send wakes.
const ACTIVE_THREAD_STATUSES = ["preparing", "queued", "starting", "running", "waiting"];
const MISSING_THREAD = "no longer available";

const reading = (liveness: RouteLiveness, detail: string, currentName: O.Option<string> = O.none()) =>
  RouteProbeReading.make({ liveness, detail, currentName, parentThreadId: O.none() });

const optionalConfig = (name: string): Effect.Effect<O.Option<string>> =>
  Config.option(Config.String(name)).pipe(
    Effect.map(O.filter((value) => Str.isNonEmpty(Str.trim(value)))),
    Effect.orElseSucceed(O.none<string>)
  );

const readEnvironmentId = (fs: FileSystem.FileSystem, homeDir: string): Effect.Effect<O.Option<string>> =>
  fs
    .readFileString(`${homeDir}/userdata/environment-id`)
    .pipe(Effect.option, Effect.map(flow(O.map(Str.trim), O.filter(Str.isNonEmpty))));

/**
 * The local T3 home directory: `T3CODE_HOME`, else `$HOME/.t3`.
 *
 * **Example** (Build the lookup)
 *
 * ```ts
 * import { t3HomeDirectory } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(t3HomeDirectory)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const t3HomeDirectory: Effect.Effect<O.Option<string>> = Effect.gen(function* () {
  const configured = yield* optionalConfig("T3CODE_HOME");
  if (O.isSome(configured)) return configured;
  const home = yield* optionalConfig("HOME");
  return O.map(home, (value) => `${value}/.t3`);
});

/**
 * This host's T3 environment id, read from the `environment-id` file in T3's
 * userdata directory, or none when T3 is not installed here.
 *
 * **Example** (Build the lookup)
 *
 * ```ts
 * import { localT3EnvironmentId } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(localT3EnvironmentId)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const localT3EnvironmentId: Effect.Effect<O.Option<string>, never, FileSystem.FileSystem> = Effect.gen(
  function* () {
    const fs = yield* FileSystem.FileSystem;
    const home = yield* t3HomeDirectory;
    return O.isNone(home) ? O.none<string>() : yield* readEnvironmentId(fs, home.value);
  }
);

/**
 * Build the live probe over the Claude Code live index (`CLAUDE_CONFIG_DIR`,
 * else `$HOME/.claude`), `/proc`, and the `t3` CLI (`T3CODE_CLI_PATH`, else
 * the CLI in the T3 home).
 *
 * **Example** (Build the live probe effect)
 *
 * ```ts
 * import { makeSessionRouteProbeLive } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeSessionRouteProbeLive())) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeSessionRouteProbeLive = Effect.fn("SessionRouteProbe.makeLive")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const home = yield* optionalConfig("HOME");
  const configuredClaudeDir = yield* optionalConfig("CLAUDE_CONFIG_DIR");
  const claudeDir = O.orElse(configuredClaudeDir, () => O.map(home, (value) => path.join(value, ".claude")));
  const t3Home = yield* t3HomeDirectory;
  const configuredCli = yield* optionalConfig("T3CODE_CLI_PATH");
  const t3Cli = O.orElse(configuredCli, () => O.map(t3Home, (value) => path.join(value, "bin", "t3")));
  const localEnvironmentId = O.match(t3Home, {
    onNone: () => Effect.succeed(O.none<string>()),
    onSome: (homeDir) => readEnvironmentId(fs, homeDir),
  });

  const runT3 = (args: ReadonlyArray<string>, timeout: Duration.Duration): Effect.Effect<O.Option<T3CliOutput>> =>
    O.match(t3Cli, {
      onNone: () => Effect.succeed(O.none<T3CliOutput>()),
      onSome: (cli) =>
        Effect.scoped(
          Effect.gen(function* () {
            const handle = yield* spawner.spawn(ChildProcess.make(cli, args, { stdin: "ignore", extendEnv: true }));
            const [stdout, stderr, exitCode] = yield* Effect.all(
              [
                handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
                handle.stderr.pipe(Stream.decodeText(), Stream.mkString),
                handle.exitCode,
              ],
              { concurrency: "unbounded" }
            );
            const output: T3CliOutput = { stdout, stderr, exitCode: Number(exitCode) };
            return output;
          })
        ).pipe(Effect.timeoutOption(timeout), Effect.orElseSucceed(O.none<T3CliOutput>)),
    });

  const environments = runT3(["environment", "list", "--json"], T3_ENVIRONMENTS_TIMEOUT).pipe(
    Effect.map(O.flatMap((output) => (output.exitCode === 0 ? decodeEnvironments(output.stdout) : O.none())))
  );

  const claudePeer = Effect.fn("SessionRouteProbe.claudePeer")(
    function* (sessionId: string) {
      if (O.isNone(claudeDir))
        return reading("unknown", "no Claude config directory (HOME and CLAUDE_CONFIG_DIR unset)");
      const sessionsDir = path.join(claudeDir.value, "sessions");
      const names = yield* fs.readDirectory(sessionsDir).pipe(Effect.option);
      if (O.isNone(names)) return reading("unknown", `Claude live index ${sessionsDir} is unreadable`);
      const contents = yield* Effect.forEach(
        A.filter(names.value, (name) => LIVE_INDEX_FILE.test(name)),
        (name) => fs.readFileString(path.join(sessionsDir, name)).pipe(Effect.option)
      );
      const entries = A.map(contents, O.flatMap(decodeLiveIndexEntry));
      const matches = A.filter(A.getSomes(entries), (entry) => entry.sessionId === sessionId);
      if (!A.isReadonlyArrayNonEmpty(matches)) {
        const unreadable = A.length(A.filter(entries, O.isNone));
        return unreadable > 0
          ? reading("unknown", `no live index entry, and ${unreadable} index file(s) could not be read`)
          : reading("dead", "no Claude live index entry for this session");
      }
      const ownStart = yield* processStartTimeForPid(process.pid);
      if (O.isNone(ownStart)) return reading("unknown", "/proc is unreadable, so the pid cannot be checked");
      const checked = yield* Effect.forEach(matches, (entry) =>
        processStartTimeForPid(entry.pid).pipe(
          Effect.map((start) => ({ entry, alive: O.exists(start, (value) => value === entry.procStart) }))
        )
      );
      return O.match(
        A.findFirst(checked, (check) => check.alive),
        {
          onNone: () => reading("dead", `pid ${A.headNonEmpty(matches).pid} is gone or reused`),
          onSome: ({ entry }) => reading("live", `pid ${entry.pid} is running`, O.fromUndefinedOr(entry.name)),
        }
      );
    },
    Effect.provideService(FileSystem.FileSystem, fs)
  );

  const t3Thread = Effect.fn("SessionRouteProbe.t3Thread")(function* (route: T3ThreadRoute) {
    const local = yield* localEnvironmentId;
    if (!O.exists(local, (id) => id === route.environmentId)) {
      const linked = yield* environments;
      const environment = O.flatMap(
        linked,
        A.findFirst((value) => value.environmentId === route.environmentId)
      );
      return O.match(environment, {
        onNone: () =>
          reading(
            "unknown",
            O.isSome(linked)
              ? "environment is neither this host nor a linked one"
              : "environment is not this host; linked environments could not be listed"
          ),
        onSome: (value) =>
          value.status === "reachable"
            ? reading("unknown", `thread lives on ${value.label}; read it there with t3_thread_read`)
            : reading("unreachable", `environment ${value.label} is ${value.status}`),
      });
    }
    const output = yield* runT3(["thread", "show", route.threadId, "--json", "--messages", "0"], T3_THREAD_TIMEOUT);
    if (O.isNone(output)) return reading("unknown", "the t3 CLI could not be run");
    if (output.value.exitCode !== 0) {
      return Str.includes(MISSING_THREAD)(output.value.stderr)
        ? reading("dead", "T3 reports the thread is no longer available")
        : reading("unreachable", `the local T3 server did not answer (exit ${output.value.exitCode})`);
    }
    return O.match(decodeThreadShow(output.value.stdout), {
      onNone: () => reading("unknown", "`t3 thread show` output did not decode"),
      onSome: ({ thread }) => {
        const parentThreadId = O.fromNullishOr(thread.parentThreadId);
        const computed = thread.archived
          ? reading("dead", "thread is archived")
          : A.contains(ACTIVE_THREAD_STATUSES, thread.status)
            ? reading("live", `thread is ${thread.status}`)
            : reading("dormant", `thread is ${thread.status}; a send wakes it`);
        return RouteProbeReading.make({ ...computed, parentThreadId });
      },
    });
  });

  return SessionRouteProbe.of({ claudePeer, t3Thread, environments, localEnvironmentId });
});

/**
 * Live route probe layer.
 *
 * **Example** (Provide the live probe)
 *
 * ```ts
 * import { layerSessionRouteProbeLive, SessionRouteProbe } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () { return yield* SessionRouteProbe }).pipe(Effect.provide(layerSessionRouteProbeLive))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerSessionRouteProbeLive = Layer.effect(SessionRouteProbe, makeSessionRouteProbeLive());
