/**
 * What every gate the repo CLI runs shares: the audience flags split off a
 * task's arguments, the console settings for the detected or flagged
 * audience, the services a gate run needs, capturing a tool's whole output,
 * rendering a stored record, and the error that carries the tool's exit
 * code to the process.
 *
 * The module stays lean on purpose: the slim `gate run check` entry loads
 * it before every package `check`, so it imports no command group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AudienceFlagInput } from "@beep/cli-kit/CliAudience";
import { RecordPaths } from "@beep/gate-report/ConsoleDocument";
import { GateEvent } from "@beep/gate-report/GateEvent";
import { $RepoCliId } from "@beep/identity/packages";
import { RecordTarget, recordLocation } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import { selectAudience } from "@beep/repo-gate-run/GateAudience";
import { ConsoleRequest, ConsoleSettings, GateConsole, makeGateConsole } from "@beep/repo-gate-run/GateConsole";
import { GateHistory } from "@beep/repo-gate-run/GateHistory";
import { GateHistoryStore } from "@beep/repo-gate-run/GateHistoryStore";
import { GateRecorder, RunSource } from "@beep/repo-gate-run/GateRecorder";
import { GateRunRequest, runGate } from "@beep/repo-gate-run/GateRun";
import { repoPointerTableFor } from "@beep/repo-gate-run/RepoPointers";
import { Audience, AudienceKind } from "@beep/runtime-env/Audience";
import { CurrentRuntimeEnv } from "@beep/runtime-env/RuntimeEnv";
import { TerminalEnv } from "@beep/runtime-env/TerminalEnv";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { HistorySetting, historyStoreLayer, ingestAfterConsole, resolveHistoryTarget } from "./GateHistoryRuntime.ts";
import type { GateRecord } from "@beep/gate-report/GateRecord";
import type { ColorLevel } from "@beep/runtime-env/ColorLevel";
import type { GateHistoryTarget } from "./GateHistoryRuntime.ts";

const $I = $RepoCliId.create("commands/Gate/GateRuntime");

/**
 * A gate's tool exited non-zero. The console was already printed, so the
 * error is marked reported and the process exits with the tool's code.
 *
 * **Example** (Carry a tool's exit code)
 *
 * ```ts
 * import { GateToolExit } from "@beep/repo-cli/commands/Gate"
 *
 * console.log(GateToolExit.make({ gate: "check", subject: "@beep/glob", exitCode: 2 }).exitCode) // 2
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GateToolExit extends S.TaggedError<GateToolExit, { readonly brand: unique symbol }>($I`GateToolExit`)(
  "GateToolExit",
  { gate: S.String, subject: S.String, exitCode: S.Int },
  $I.annoteError<GateToolExit>("GateToolExit", {
    description: "A gate's tool exited non-zero after its console was printed.",
  })
) {
  /**
   * The process exits with the tool's own code.
   *
   * @returns The exit code the tool returned.
   */
  override get [Runtime.errorExitCode](): number {
    return this.exitCode;
  }

  /** The console already said everything; the runtime adds nothing. */
  override readonly [Runtime.errorReported] = false;
}

/**
 * **Example** (Name the directory)
 *
 * ```ts
 * import { GateNotAPackage } from "@beep/repo-cli/commands/Gate"
 *
 * console.log(GateNotAPackage.make({ dir: "/tmp" })._tag) // GateNotAPackage
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GateNotAPackage extends S.TaggedError<GateNotAPackage, { readonly brand: unique symbol }>(
  $I`GateNotAPackage`
)(
  "GateNotAPackage",
  { dir: S.String },
  $I.annoteError<GateNotAPackage>("GateNotAPackage", {
    description: "A gate was asked to run in a directory that is not a package of a repository.",
  })
) {}

const withLayer = <A, E, R, ROut, E2, RIn>(
  effect: Effect.Effect<A, E, R>,
  layer: Layer.Layer<ROut, E2, RIn>
): Effect.Effect<A, E | E2, Exclude<R, ROut> | RIn> =>
  layer.pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(effect, context)),
    Effect.scoped
  );

const AUDIENCE_PREFIX = "--audience=";
const isAudienceKind = S.is(AudienceKind);

/**
 * A task's arguments split in two: the audience flags that select the
 * console, and everything else, which goes to the tool.
 *
 * **Example** (Build split arguments)
 *
 * ```ts
 * import { AudienceArgs } from "@beep/repo-cli/commands/Gate"
 *
 * const split = AudienceArgs.make({ flags: { audience: [], human: [], agent: [true], ci: [] }, rest: ["--bail=1"] })
 * console.log(split.rest) // [ "--bail=1" ]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AudienceArgs extends S.Opaque<AudienceArgs, { readonly brand: unique symbol }>()(
  S.Struct({
    flags: AudienceFlagInput,
    rest: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("AudienceArgs", {
      description: "A task's audience flags and the arguments that go to its tool.",
    })
  )
) {}

/**
 * A task's arguments with the audience flags taken out: `--agent`,
 * `--human`, `--ci` and `--audience=<kind>` select the console; everything
 * else goes to the tool.
 *
 * **Example** (Split the flags off)
 *
 * ```ts
 * import { splitAudienceArgs } from "@beep/repo-cli/commands/Gate"
 *
 * const split = splitAudienceArgs(["--agent", "--bail=1"])
 * console.log(split.flags.agent, split.rest) // [ true ] [ "--bail=1" ]
 * ```
 *
 * @param args - The task's arguments after its name, as typed.
 * @returns The audience flags given and the arguments for the tool.
 * @category utilities
 * @since 0.0.0
 */
export const splitAudienceArgs = (args: ReadonlyArray<string>): AudienceArgs => {
  const named = (flag: string) =>
    A.map(
      A.filter(args, (arg) => arg === flag),
      () => true
    );
  const audience = A.filter(
    A.map(A.filter(args, Str.startsWith(AUDIENCE_PREFIX)), Str.slice(AUDIENCE_PREFIX.length)),
    isAudienceKind
  );
  return AudienceArgs.make({
    flags: { audience, human: named("--human"), agent: named("--agent"), ci: named("--ci") },
    rest: A.filter(
      args,
      (arg) => !A.contains(["--human", "--agent", "--ci"], arg) && !Str.startsWith(AUDIENCE_PREFIX)(arg)
    ),
  });
};

/**
 * The console settings for a gate run: the one audience flag given, else
 * the detected audience, and the colour level of standard output.
 *
 * **Example** (Resolve the settings)
 *
 * ```ts
 * import { consoleSettings } from "@beep/repo-cli/commands/Gate"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(consoleSettings({ audience: [], human: [], agent: [true], ci: [] }))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const consoleSettings = Effect.fn("Gate.consoleSettings")(function* (flags: AudienceFlagInput) {
  const audience = yield* withLayer(
    selectAudience(flags),
    Audience.layer().pipe(Layer.provide(CurrentRuntimeEnv.layer))
  );
  const stdio = yield* Effect.serviceOption(Stdio.Stdio);
  const color = yield* O.match(stdio, {
    onNone: () => Effect.succeed<ColorLevel>("none"),
    onSome: (service) => TerminalEnv.colorLevel("stdout").pipe(Effect.provideService(Stdio.Stdio, service)),
  });
  return ConsoleSettings.make({ audience, color });
});

/**
 * Where a gate run records and how it prints: the repository root, the
 * console settings, and whether it keeps history (resolved automatically by
 * default).
 *
 * **Example** (Describe a gate run's services)
 *
 * ```ts
 * import { GateServicesConfig } from "@beep/repo-cli/commands/Gate"
 * import { ConsoleSettings } from "@beep/repo-gate-run/GateConsole"
 *
 * const config = GateServicesConfig.make({ repoRoot: "/repo", settings: ConsoleSettings.make({ audience: "agent" }) })
 * console.log(config.repoRoot) // /repo
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateServicesConfig extends S.Opaque<GateServicesConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    repoRoot: S.NonEmptyString,
    settings: ConsoleSettings,
    history: HistorySetting.pipe(
      S.withConstructorDefault(Effect.sync(() => HistorySetting.cases.HistoryAuto.make({})))
    ),
  }).pipe(
    $I.annoteSchema("GateServicesConfig", {
      description: "The repository root a gate run records under, its console settings and its history setting.",
    })
  )
) {}

/**
 * Run a gate program with the services one gate run needs: the recorder
 * over the record store at the repository root, no history (the history
 * goal supplies it), and the console for the settings.
 *
 * **Example** (Provide the gate services)
 *
 * ```ts
 * import { GateServicesConfig, withGateServices } from "@beep/repo-cli/commands/Gate"
 * import { ConsoleSettings } from "@beep/repo-gate-run/GateConsole"
 * import * as Effect from "effect/Effect"
 *
 * const config = GateServicesConfig.make({ repoRoot: "/repo", settings: ConsoleSettings.make({ audience: "agent" }) })
 * const program = withGateServices(config)(Effect.void)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param config - The repository root records are written under, and the console settings.
 * @returns A function that provides the services to a gate program.
 * @category use-cases
 * @since 0.0.0
 */
export const withGateServices =
  (config: GateServicesConfig) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    withLayer(
      effect,
      Layer.mergeAll(
        GateRecorder.layer.pipe(Layer.provide(GateRecordStore.layer(config.repoRoot))),
        GateHistory.layerNone,
        GateConsole.layer(config.settings)
      )
    );

/**
 * A tool's finished run: its exit code and its whole output, standard
 * output and standard error interleaved.
 *
 * **Example** (Describe a captured run)
 *
 * ```ts
 * import { CapturedRun } from "@beep/repo-cli/commands/Gate"
 *
 * console.log(CapturedRun.make({ exitCode: 0, output: new Uint8Array() }).exitCode) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CapturedRun extends S.Opaque<CapturedRun, { readonly brand: unique symbol }>()(
  S.Struct({
    exitCode: S.Int,
    output: S.Uint8Array,
  }).pipe(
    $I.annoteSchema("CapturedRun", {
      description: "A tool's exit code and its whole interleaved output.",
    })
  )
) {}

const concatChunks = (chunks: ReadonlyArray<Uint8Array>): Uint8Array => {
  const output = new Uint8Array(A.reduce(chunks, 0, (total, chunk) => total + chunk.length));
  A.reduce(chunks, 0, (offset, chunk) => {
    output.set(chunk, offset);
    return offset + chunk.length;
  });
  return output;
};

/**
 * Run a tool to the end and keep its whole output; nothing is printed.
 *
 * **Example** (Capture a package script)
 *
 * ```ts
 * import { captureRun } from "@beep/repo-cli/commands/Gate"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(captureRun({ command: "bun", args: ["run", "beep:check"], cwd: "/repo/packages/a" }))) // true
 * ```
 *
 * @param input - The executable, its arguments, the directory it runs in, and environment overrides.
 * @returns The exit code and the output.
 * @category use-cases
 * @since 0.0.0
 */
export const captureRun = Effect.fn("Gate.captureRun")(function* (input: {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string | undefined>> | undefined;
  readonly extendEnv?: boolean | undefined;
}) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(
        ChildProcess.make(input.command, input.args, {
          cwd: input.cwd,
          env: { ...input.env },
          extendEnv: input.extendEnv ?? true,
        })
      );
      const chunks = yield* Stream.runCollect(handle.all);
      const exitCode = yield* handle.exitCode;
      return CapturedRun.make({ exitCode, output: concatChunks(chunks) });
    })
  );
});

/**
 * The size of a stored record's raw log, or none when the log is absent.
 *
 * **Example** (Read a package record's log size)
 *
 * ```ts
 * import { storedLogBytes } from "@beep/repo-cli/commands/Gate"
 * import { RecordTarget } from "@beep/repo-gate-record/GatePaths"
 * import * as Effect from "effect/Effect"
 *
 * const target = RecordTarget.cases.PackageTarget.make({ packageDir: "packages/a", gate: "test" })
 * console.log(Effect.isEffect(storedLogBytes("/repo", target))) // true
 * ```
 *
 * @param repoRoot - The repository root.
 * @param target - Whose record.
 * @returns The log's size in bytes, or none.
 * @category use-cases
 * @since 0.0.0
 */
export const storedLogBytes = Effect.fn("Gate.storedLogBytes")(function* (repoRoot: string, target: RecordTarget) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.stat(path.join(repoRoot, recordLocation(target).log)).pipe(
    Effect.map((info) => Number(info.size)),
    Effect.option
  );
});

/**
 * Print the console of a stored record: read it back, name its record and
 * raw log with the log's size, and render it for the settings.
 *
 * **Example** (Render a package record)
 *
 * ```ts
 * import { renderStoredRecord } from "@beep/repo-cli/commands/Gate"
 * import { ConsoleSettings } from "@beep/repo-gate-run/GateConsole"
 * import { RecordTarget } from "@beep/repo-gate-record/GatePaths"
 * import * as Effect from "effect/Effect"
 *
 * const target = RecordTarget.cases.PackageTarget.make({ packageDir: "packages/a", gate: "test" })
 * console.log(Effect.isEffect(renderStoredRecord("/repo", target, ConsoleSettings.make({ audience: "agent" })))) // true
 * ```
 *
 * @param repoRoot - The repository root.
 * @param target - Whose record.
 * @param settings - The console settings.
 * @returns The record rendered.
 * @category use-cases
 * @since 0.0.0
 */
export const renderStoredRecord = Effect.fn("Gate.renderStoredRecord")(function* (
  repoRoot: string,
  target: RecordTarget,
  settings: ConsoleSettings
) {
  const store = yield* GateRecordStore.make(repoRoot);
  const record: GateRecord = yield* store.readRecord(target);
  const location = recordLocation(target);
  const logBytes = yield* storedLogBytes(repoRoot, target);
  const output = makeGateConsole(settings).render(
    ConsoleRequest.make({
      report: record.report,
      paths: O.map(logBytes, (bytes) =>
        RecordPaths.make({ record: location.record, log: location.log, logBytes: bytes })
      ),
      pointers: O.some(repoPointerTableFor(target)),
    })
  );
  yield* Console.log(output.text);
  return record;
});

/**
 * Fail with {@link GateToolExit} when the tool exited non-zero.
 *
 * **Example** (Pass a clean exit)
 *
 * ```ts
 * import { exitWithTool, GateToolExit } from "@beep/repo-cli/commands/Gate"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(exitWithTool(GateToolExit.make({ gate: "check", subject: "@beep/glob", exitCode: 0 })))) // true
 * ```
 *
 * @param failure - The gate, the package and the tool's exit code.
 * @returns Succeeds on zero.
 * @category use-cases
 * @since 0.0.0
 */
export const exitWithTool = Effect.fn("Gate.exitWithTool")(function* (failure: GateToolExit) {
  if (failure.exitCode !== 0) return yield* failure;
});

/**
 * One finished tool run to record: whose record, the gate events its
 * adapter emitted, the tool's exit code, its whole output, and for a package
 * record the package name, which states the run when its events do not.
 *
 * **Example** (Describe an empty run)
 *
 * ```ts
 * import { EventRun } from "@beep/repo-cli/commands/Gate"
 * import { RecordTarget } from "@beep/repo-gate-record/GatePaths"
 *
 * const run = EventRun.make({
 *   target: RecordTarget.cases.PackageTarget.make({ packageDir: "packages/a", gate: "check" }),
 *   events: [],
 *   exitCode: 0,
 *   output: new Uint8Array(),
 * })
 * console.log(run.exitCode) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EventRun extends S.Opaque<EventRun, { readonly brand: unique symbol }>()(
  S.Struct({
    target: RecordTarget,
    events: S.Array(GateEvent),
    exitCode: S.Int,
    output: S.Uint8Array,
    subject: S.OptionFromOptionalKey(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("EventRun", {
      description: "A finished tool run to record: its target, gate events, exit code, whole output and package name.",
    })
  )
) {}

const eventRequest = (run: EventRun, deadlineMs: O.Option<number>) =>
  GateRunRequest.make({
    target: run.target,
    source: RunSource.cases.RunEvents.make({ events: run.events }),
    exitCode: run.exitCode,
    pointers: O.some(repoPointerTableFor(run.target)),
    subject: run.subject,
    ...O.match(deadlineMs, { onNone: () => ({}), onSome: (historyDeadlineMs) => ({ historyDeadlineMs }) }),
  });

const recordWithHistory = (config: GateServicesConfig, run: EventRun, target: GateHistoryTarget) =>
  withLayer(
    runGate(eventRequest(run, O.some(target.config.deadlineMs)), Stream.make(run.output)).pipe(
      Effect.tap((result) => ingestAfterConsole(target)(result.report))
    ),
    Layer.mergeAll(
      GateRecorder.layer.pipe(Layer.provide(GateRecordStore.layer(config.repoRoot))),
      GateHistoryStore.historyLayer(target.scope),
      GateConsole.layer(config.settings)
    ).pipe(Layer.provideMerge(historyStoreLayer(target)))
  );

/**
 * Record a finished tool run and print its console with the gate services
 * for the configuration: the whole output goes to the raw log, the events to
 * the record. Its pointer line names the query pinned to that record:
 * `--dir <package>` for a package record, `--run <run id>` for a root run.
 *
 * **Details**
 *
 * With history resolved for the checkout, the console carries the history
 * labels and the delta, read under the history deadline, and the report is
 * recorded in history only after the console was printed; a failed write
 * prints one line on standard error and changes neither the console nor the
 * exit code.
 *
 * **Example** (Record a run)
 *
 * ```ts
 * import { EventRun, GateServicesConfig, recordEventRun } from "@beep/repo-cli/commands/Gate"
 * import { ConsoleSettings } from "@beep/repo-gate-run/GateConsole"
 * import { RecordTarget } from "@beep/repo-gate-record/GatePaths"
 * import * as Effect from "effect/Effect"
 *
 * const config = GateServicesConfig.make({ repoRoot: "/repo", settings: ConsoleSettings.make({ audience: "agent" }) })
 * const run = EventRun.make({
 *   target: RecordTarget.cases.PackageTarget.make({ packageDir: "packages/a", gate: "check" }),
 *   events: [],
 *   exitCode: 0,
 *   output: new Uint8Array(),
 * })
 * console.log(Effect.isEffect(recordEventRun(config)(run))) // true
 * ```
 *
 * @param config - The repository root and the console settings.
 * @returns A function that records one run and returns what the gate printed.
 * @category use-cases
 * @since 0.0.0
 */
export const recordEventRun = (config: GateServicesConfig) =>
  Effect.fn("Gate.recordEventRun")(function* (run: EventRun) {
    const target = yield* resolveHistoryTarget(config.repoRoot, config.history);
    return yield* O.match(target, {
      onNone: () => runGate(eventRequest(run, O.none()), Stream.make(run.output)).pipe(withGateServices(config)),
      onSome: (found) => recordWithHistory(config, run, found),
    });
  });
