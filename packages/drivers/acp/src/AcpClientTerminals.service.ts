/**
 * Client-side implementation of the ACP `terminal/*` methods on top of `effect/process`.
 *
 * **Details**
 *
 * An ACP agent that sees `clientCapabilities.terminal: true` may ask the client to run commands:
 * `terminal/create` starts one, `terminal/output` reads its buffered output, `terminal/wait_for_exit`
 * waits for it, `terminal/kill` stops it, and `terminal/release` frees it. This service runs those
 * commands as child processes, buffers their combined stdout and stderr with truncation from the
 * beginning (on a UTF-8 character boundary, as the spec requires), and bounds how many terminals
 * and how many output bytes a connection can hold.
 *
 * Advertising `terminal: true` lets the agent run arbitrary commands with the client's authority.
 * Grant it only to agents that are trusted to do so, with a working directory and environment
 * chosen for that purpose. Provenance is recorded in the package README.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AcpId } from "@beep/identity";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableRef from "effect/MutableRef";
import * as Order from "effect/Order";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as AcpError from "./Acp.errors.ts";
import * as AcpClient from "./AcpClient.service.ts";
import { signalOf } from "./internal/stdio.ts";
import type * as Compat from "./AcpCompat.models.ts";

const $I = $AcpId.create("terminals");

const PositiveInt = S.Int.check(S.isGreaterThanOrEqualTo(1));
const positiveIntWithDefault = (value: number, description: string) =>
  PositiveInt.pipe(S.withConstructorDefault(Effect.succeed(value))).annotateKey({ description });

/**
 * **Details**
 *
 * - `maxLiveTerminals` (16): running, unreleased terminals.
 * - `maxUnreleasedTerminals` (64): unreleased terminals, running or exited.
 * - `maxRetainedReleasedTerminals` (32): released terminals whose output snapshot is kept.
 * - `maxRetainedOutputBytes` (16 MiB): output bytes kept across every terminal; the oldest
 *   output of the earliest terminals is dropped first.
 * - `defaultOutputByteLimit` (4 MiB) and `maxOutputByteLimit` (8 MiB): per-terminal output bound
 *   when the request omits `outputByteLimit`, and the ceiling applied to the one it sends.
 *
 * **Example** (Lower the live-terminal bound)
 *
 * ```ts
 * import { AcpClientTerminalLimits } from "@beep/acp/terminals"
 *
 * const limits = AcpClientTerminalLimits.make({ maxLiveTerminals: 4 })
 * console.log(limits.maxLiveTerminals, limits.maxUnreleasedTerminals) // 4 64
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AcpClientTerminalLimits extends S.Opaque<AcpClientTerminalLimits, { readonly brand: unique symbol }>()(
  S.Struct({
    defaultOutputByteLimit: positiveIntWithDefault(
      4 * 1024 * 1024,
      "Per-terminal output bound used when the request sends no outputByteLimit."
    ),
    maxLiveTerminals: positiveIntWithDefault(16, "Maximum number of running, unreleased terminals."),
    maxOutputByteLimit: positiveIntWithDefault(
      8 * 1024 * 1024,
      "Ceiling applied to the outputByteLimit a request sends."
    ),
    maxRetainedOutputBytes: positiveIntWithDefault(
      16 * 1024 * 1024,
      "Maximum output bytes retained across every terminal."
    ),
    maxRetainedReleasedTerminals: positiveIntWithDefault(
      32,
      "Maximum number of released terminals whose output snapshot is kept."
    ),
    maxUnreleasedTerminals: positiveIntWithDefault(64, "Maximum number of unreleased terminals."),
  }).pipe(
    $I.annoteSchema("AcpClientTerminalLimits", {
      description: "Resource bounds of the client-side ACP terminal service.",
    })
  )
) {}

/**
 * Options for {@link make} and {@link layer}.
 *
 * **Details**
 *
 * - `defaultCwd` is used when a `terminal/create` request sends no `cwd`.
 * - `environment` is the complete base environment of every command. When it is absent, commands
 *   inherit the host environment. Variables from the session environment (the second argument of
 *   {@link make}) and from the request's `env` are added on top, the request's last.
 * - `shellCommands` runs a request that has a `command` and no `args` through the system shell,
 *   for agents that send shell source as the command.
 * - `forceKillAfter` is how long `terminal/kill` and `terminal/release` wait after the first
 *   termination signal before sending `SIGKILL`; it defaults to 5 seconds.
 * - `exitOutputGrace` bounds how long the exit status waits for the output pipes to close after
 *   the command exits. A background process the command started can hold them open; its later
 *   output is still buffered. It defaults to 1 second.
 *
 * **Example** (Run commands in a fixed directory)
 *
 * ```ts
 * import { AcpClientTerminalsOptions } from "@beep/acp/terminals"
 *
 * const options = AcpClientTerminalsOptions.make({ defaultCwd: "/srv/workspace" })
 * console.log(options.shellCommands, options.limits.maxLiveTerminals) // false 16
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AcpClientTerminalsOptions extends S.Opaque<AcpClientTerminalsOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    defaultCwd: S.String.annotateKey({ description: "Working directory when a request sends no cwd." }),
    environment: S.OptionFromOptionalKey(S.Record(S.String, S.String))
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Complete base environment of every command; the host environment when absent.",
      }),
    forceKillAfter: S.Duration.pipe(S.withConstructorDefault(Effect.succeed(Duration.seconds(5)))).annotateKey({
      description: "Grace before kill and release force termination; 5 seconds by default.",
    }),
    limits: AcpClientTerminalLimits.pipe(
      S.withConstructorDefault(Effect.sync(() => AcpClientTerminalLimits.make({})))
    ).annotateKey({
      description: "Resource bounds; the AcpClientTerminalLimits defaults when absent.",
    }),
    exitOutputGrace: S.Duration.pipe(S.withConstructorDefault(Effect.succeed(Duration.seconds(1)))).annotateKey({
      description: "How long the exit status waits for the output pipes to close; 1 second by default.",
    }),
    shellCommands: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))).annotateKey({
      description: "Run an argument-less command through the system shell.",
    }),
  }).pipe(
    $I.annoteSchema("AcpClientTerminalsOptions", {
      description: "Options of the client-side ACP terminal service.",
    })
  )
) {}

/**
 * Extra environment variables for the commands of one ACP session.
 *
 * **Example** (Expose the session id to commands)
 *
 * ```ts
 * import type { AcpTerminalSessionEnvironment } from "@beep/acp/terminals"
 *
 * const environment: AcpTerminalSessionEnvironment = (sessionId) => ({ ACP_SESSION_ID: sessionId })
 * console.log(environment("session-1"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AcpTerminalSessionEnvironment = (sessionId: string) => Readonly<Record<string, string>> | undefined;

type AcpResult<A> = Effect.Effect<A, AcpError.AcpRequestError>;

/**
 * Operations of the client-side ACP terminal service.
 *
 * **Details**
 *
 * The five request methods match the ACP client handlers; {@link register} installs them on an
 * `AcpClient`. A terminal id is valid only for the session that created it and only until it is
 * released. `readOutputSnapshot` also answers for released terminals that are still retained, so
 * a client can render the output of a tool call after the agent released its terminal.
 * `disposeAll` releases every terminal; the service runs it when its scope closes.
 *
 * **Example** (Read the create operation)
 *
 * ```ts
 * import type { AcpClientTerminalsShape } from "@beep/acp/terminals"
 *
 * const createOf = (terminals: AcpClientTerminalsShape) => terminals.create
 * console.log(createOf)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface AcpClientTerminalsShape {
  readonly commandLine: (terminalId: string) => O.Option<string>;
  readonly create: (request: Compat.CreateTerminalRequest) => AcpResult<Compat.CreateTerminalResponse>;
  readonly disposeAll: Effect.Effect<void>;
  readonly kill: (request: Compat.KillTerminalRequest) => AcpResult<Compat.KillTerminalResponse>;
  readonly output: (request: Compat.TerminalOutputRequest) => AcpResult<Compat.TerminalOutputResponse>;
  readonly readOutputSnapshot: (sessionId: string, terminalId: string) => O.Option<Compat.TerminalOutputResponse>;
  readonly release: (request: Compat.ReleaseTerminalRequest) => AcpResult<Compat.ReleaseTerminalResponse>;
  readonly waitForExit: (request: Compat.WaitForTerminalExitRequest) => AcpResult<Compat.WaitForTerminalExitResponse>;
}

/**
 * Context service tag for the client-side ACP terminal service.
 *
 * **Example** (Resolve the terminal service)
 *
 * ```ts
 * import { AcpClientTerminals } from "@beep/acp/terminals"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const terminals = yield* AcpClientTerminals
 *   return terminals.disposeAll
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class AcpClientTerminals extends Context.Service<AcpClientTerminals, AcpClientTerminalsShape>()(
  $I`AcpClientTerminals`
) {}

interface OutputBuffer {
  bytes: number;
  readonly chunks: Array<Uint8Array>;
  readonly limit: number;
  truncated: boolean;
}

const decoder = new TextDecoder();

const trimOutputStart = (buffer: OutputBuffer, bytes: number): void => {
  let remaining = Math.min(bytes, buffer.bytes);
  for (const head of A.copy(buffer.chunks)) {
    if (head.byteLength <= remaining) {
      buffer.chunks.shift();
      buffer.bytes -= head.byteLength;
      remaining -= head.byteLength;
    } else {
      buffer.chunks[0] = head.subarray(remaining);
      buffer.bytes -= remaining;
      buffer.truncated = true;
      break;
    }
    buffer.truncated = true;
  }
};

const appendOutput = (buffer: OutputBuffer, chunk: Uint8Array): void => {
  buffer.chunks.push(chunk);
  buffer.bytes += chunk.byteLength;
  if (buffer.bytes > buffer.limit) trimOutputStart(buffer, buffer.bytes - buffer.limit);
};

const isContinuationByte = (byte: number): boolean => (byte & 0b1100_0000) === 0b1000_0000;

const readOutput = (buffer: OutputBuffer): string => {
  const combined = new Uint8Array(buffer.bytes);
  A.reduce(buffer.chunks, 0, (offset, chunk) => {
    combined.set(chunk, offset);
    return offset + chunk.byteLength;
  });
  const firstCharacterStart = buffer.truncated ? combined.findIndex((byte) => !isContinuationByte(byte)) : 0;
  const start = firstCharacterStart < 0 ? combined.byteLength : firstCharacterStart;
  return decoder.decode(combined.subarray(start));
};

interface ManagedTerminal {
  readonly buffer: OutputBuffer;
  readonly commandLine: string;
  readonly dispose: Effect.Effect<void>;
  readonly exit: Deferred.Deferred<Compat.WaitForTerminalExitResponse>;
  exitStatus: O.Option<Compat.TerminalExitStatus>;
  readonly kill: Effect.Effect<void>;
  readonly ordinal: number;
  released: boolean;
  readonly sessionId: string;
  readonly terminalId: string;
}

const terminalRequestError = (message: string, cause?: unknown) =>
  AcpError.AcpRequestError.internalError(
    message,
    undefined,
    AcpError.AcpRequestDiagnostics.make({ cause: O.fromUndefinedOr(cause) })
  );

const isLive = (terminal: ManagedTerminal) => !terminal.released && O.isNone(terminal.exitStatus);
const isUnreleased = (terminal: ManagedTerminal) => !terminal.released;
const byCreation = Order.mapInput(Order.Number, (terminal: ManagedTerminal) => terminal.ordinal);

const snapshotOf = (terminal: ManagedTerminal): Compat.TerminalOutputResponse => ({
  output: readOutput(terminal.buffer),
  truncated: terminal.buffer.truncated,
  ...O.match(terminal.exitStatus, { onNone: () => ({}), onSome: (exitStatus) => ({ exitStatus }) }),
});

const environmentFor = (
  options: AcpClientTerminalsOptions,
  sessionEnvironment: AcpTerminalSessionEnvironment | undefined,
  request: Compat.CreateTerminalRequest
): Pick<ChildProcess.CommandOptions, "env" | "extendEnv"> => {
  const added = {
    ...sessionEnvironment?.(request.sessionId),
    ...R.fromEntries(A.map(request.env ?? [], (variable) => [variable.name, variable.value] as const)),
  };
  return O.match(options.environment, {
    onNone: () => (R.isEmptyRecord(added) ? {} : { env: added, extendEnv: true }),
    onSome: (base) => ({ env: { ...base, ...added }, extendEnv: false }),
  });
};

const commandFor = (
  options: AcpClientTerminalsOptions,
  sessionEnvironment: AcpTerminalSessionEnvironment | undefined,
  request: Compat.CreateTerminalRequest
) => {
  const args = request.args ?? [];
  return ChildProcess.make(request.command, args, {
    ...environmentFor(options, sessionEnvironment, request),
    cwd: request.cwd ?? options.defaultCwd,
    forceKillAfter: options.forceKillAfter,
    shell: options.shellCommands && A.isReadonlyArrayEmpty(args),
  });
};

const exitStatusOf = (exitCode: ChildProcessSpawner.ChildProcessHandle["exitCode"]) =>
  Effect.match(exitCode, {
    onFailure: (cause): Compat.TerminalExitStatus => ({ exitCode: null, signal: signalOf(cause).pipe(O.getOrNull) }),
    onSuccess: (code): Compat.TerminalExitStatus => ({ exitCode: code, signal: null }),
  });

/**
 * Constructs the client-side ACP terminal service.
 *
 * **Details**
 *
 * Each terminal runs in its own scope; releasing it closes that scope, which stops the process
 * if it still runs. Creation is serialized so the terminal bounds hold under concurrent
 * requests. Failed operations are logged at warning level with the method name and returned to
 * the agent as JSON-RPC internal errors. Closing the surrounding scope releases every terminal.
 *
 * **Example** (Construct the service)
 *
 * ```ts
 * import { make } from "@beep/acp/terminals"
 *
 * const terminals = make({ defaultCwd: "/srv/workspace" })
 * console.log(terminals)
 * ```
 *
 * @effects Spawns one child process per `terminal/create` request when the returned service is
 * used, and registers a scope finalizer that releases every terminal.
 * @category constructors
 * @since 0.0.0
 */
export const make = Effect.fn($I`AcpClientTerminals_make`)(function* (
  input: (typeof AcpClientTerminalsOptions)["~type.make.in"],
  sessionEnvironment?: AcpTerminalSessionEnvironment
): Effect.fn.Return<AcpClientTerminalsShape, never, ChildProcessSpawner.ChildProcessSpawner | Scope.Scope> {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const options = AcpClientTerminalsOptions.make(input);
  const { limits } = options;
  const creationPermit = yield* Semaphore.make(1);
  const terminals = MutableHashMap.empty<string, ManagedTerminal>();
  const nextTerminalNumber = MutableRef.make(1);
  const all = () => A.sort(MutableHashMap.values(terminals), byCreation);

  const enforceTotalOutputLimit = (): void => {
    let excess = A.reduce(all(), 0, (total, terminal) => total + terminal.buffer.bytes) - limits.maxRetainedOutputBytes;
    for (const terminal of all()) {
      if (excess <= 0) return;
      const before = terminal.buffer.bytes;
      trimOutputStart(terminal.buffer, excess);
      excess -= before - terminal.buffer.bytes;
    }
  };

  const pruneReleasedSnapshots = (): void => {
    const released = A.filter(all(), (terminal) => terminal.released);
    let retainedBytes = A.reduce(released, 0, (total, terminal) => total + terminal.buffer.bytes);
    let count = A.length(released);
    for (const terminal of released) {
      if (count <= limits.maxRetainedReleasedTerminals && retainedBytes <= limits.maxRetainedOutputBytes) return;
      retainedBytes -= terminal.buffer.bytes;
      count -= 1;
      MutableHashMap.remove(terminals, terminal.terminalId);
    }
  };

  const requireTerminal = (sessionId: string, terminalId: string, method: string): AcpResult<ManagedTerminal> =>
    MutableHashMap.get(terminals, terminalId).pipe(
      O.filter((terminal) => terminal.sessionId === sessionId && !terminal.released),
      Effect.fromOption,
      Effect.mapError(() => terminalRequestError(`ACP ${method} received an unknown terminal ID '${terminalId}'.`))
    );

  const releaseTerminal = (terminal: ManagedTerminal) =>
    Effect.sync(() => {
      terminal.released = true;
    }).pipe(Effect.andThen(terminal.dispose), Effect.andThen(Deferred.await(terminal.exit)));

  const startTerminal = Effect.fn($I`AcpClientTerminals_startTerminal`)(function* (
    request: Compat.CreateTerminalRequest,
    restore: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  ) {
    if (A.length(A.filter(all(), isUnreleased)) >= limits.maxUnreleasedTerminals)
      return yield* terminalRequestError(
        `ACP terminal/create exceeded the limit of ${limits.maxUnreleasedTerminals} unreleased terminals.`
      );
    if (A.length(A.filter(all(), isLive)) >= limits.maxLiveTerminals)
      return yield* terminalRequestError(
        `ACP terminal/create exceeded the limit of ${limits.maxLiveTerminals} concurrent terminals.`
      );
    const terminalScope = yield* Scope.make();
    const child = yield* restore(
      spawner.spawn(commandFor(options, sessionEnvironment, request)).pipe(
        Scope.provide(terminalScope),
        Effect.mapError((cause) =>
          terminalRequestError(`Could not start terminal command '${request.command}'.`, cause)
        )
      )
    ).pipe(Effect.onError(() => Scope.close(terminalScope, Exit.void)));

    const ordinal = MutableRef.getAndIncrement(nextTerminalNumber);
    const terminalId = `acp-term-${ordinal}`;
    const record: ManagedTerminal = {
      buffer: {
        bytes: 0,
        chunks: [],
        limit: Math.min(request.outputByteLimit ?? limits.defaultOutputByteLimit, limits.maxOutputByteLimit),
        truncated: false,
      },
      commandLine: A.join(A.prepend(request.args ?? [], request.command), " "),
      dispose: Scope.close(terminalScope, Exit.void),
      exit: yield* Deferred.make<Compat.WaitForTerminalExitResponse>(),
      exitStatus: O.none(),
      kill: child.kill({ forceKillAfter: options.forceKillAfter }).pipe(Effect.ignore),
      ordinal,
      released: false,
      sessionId: request.sessionId,
      terminalId,
    };
    MutableHashMap.set(terminals, terminalId, record);

    const pump = (stream: Stream.Stream<Uint8Array, unknown>) =>
      stream.pipe(
        Stream.runForEach((chunk) =>
          Effect.sync(() => {
            appendOutput(record.buffer, chunk);
            enforceTotalOutputLimit();
          })
        ),
        Effect.ignore
      );
    // Pumps and the exit watcher outlive the request: they end when the process exits, which
    // closing the terminal scope forces.
    const stdout = yield* child.stdout.pipe(pump, Effect.forkDetach);
    const stderr = yield* child.stderr.pipe(pump, Effect.forkDetach);
    yield* Effect.forkDetach(
      child.exitCode.pipe(
        exitStatusOf,
        Effect.tap(() => Fiber.joinAll([stdout, stderr]).pipe(Effect.timeoutOption(options.exitOutputGrace))),
        Effect.tap((status) =>
          Effect.sync(() => {
            record.exitStatus = O.some(status);
          })
        ),
        Effect.flatMap((status) => Deferred.succeed(record.exit, status))
      )
    );
    return { terminalId };
  });

  const create: AcpClientTerminalsShape["create"] = (request) =>
    creationPermit.withPermit(Effect.uninterruptibleMask((restore) => startTerminal(request, restore)));

  const output: AcpClientTerminalsShape["output"] = (request) =>
    Effect.map(requireTerminal(request.sessionId, request.terminalId, "terminal/output"), snapshotOf);

  const waitForExit: AcpClientTerminalsShape["waitForExit"] = (request) =>
    Effect.flatMap(requireTerminal(request.sessionId, request.terminalId, "terminal/wait_for_exit"), (terminal) =>
      Deferred.await(terminal.exit)
    );

  const kill: AcpClientTerminalsShape["kill"] = (request) =>
    requireTerminal(request.sessionId, request.terminalId, "terminal/kill").pipe(
      Effect.flatMap((terminal) => terminal.kill),
      Effect.as({})
    );

  const release: AcpClientTerminalsShape["release"] = (request) =>
    requireTerminal(request.sessionId, request.terminalId, "terminal/release").pipe(
      Effect.flatMap(releaseTerminal),
      Effect.andThen(Effect.sync(pruneReleasedSnapshots)),
      Effect.as({}),
      Effect.uninterruptible
    );

  const disposeAll = Effect.suspend(() =>
    Effect.forEach(A.filter(all(), isUnreleased), releaseTerminal, { concurrency: "unbounded", discard: true })
  ).pipe(Effect.andThen(Effect.sync(pruneReleasedSnapshots)), Effect.uninterruptible);

  const logged =
    <Request, Response>(method: string, handler: (request: Request) => AcpResult<Response>) =>
    (request: Request): AcpResult<Response> =>
      handler(request).pipe(
        Effect.tapError((error) =>
          Effect.logWarning("ACP client terminal operation failed").pipe(
            Effect.annotateLogs({ "acp.method": method, "acp.error_code": error.code })
          )
        )
      );

  yield* Effect.addFinalizer(() => disposeAll);

  return AcpClientTerminals.of({
    commandLine: (terminalId) => O.map(MutableHashMap.get(terminals, terminalId), (terminal) => terminal.commandLine),
    create: logged("terminal/create", create),
    disposeAll,
    kill: logged("terminal/kill", kill),
    output: logged("terminal/output", output),
    readOutputSnapshot: (sessionId, terminalId) =>
      O.map(
        O.filter(MutableHashMap.get(terminals, terminalId), (terminal) => terminal.sessionId === sessionId),
        snapshotOf
      ),
    release: logged("terminal/release", release),
    waitForExit: logged("terminal/wait_for_exit", waitForExit),
  });
});

/**
 * Layer that provides the client-side ACP terminal service.
 *
 * **Details**
 *
 * For per-session environment variables, build the layer from {@link make} instead:
 * `Layer.effect(AcpClientTerminals, make(options, sessionEnvironment))`.
 *
 * **Example** (Provide terminals for a workspace)
 *
 * ```ts
 * import { layer } from "@beep/acp/terminals"
 *
 * const TerminalsLive = layer({ defaultCwd: "/srv/workspace" })
 * console.log(TerminalsLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer = (
  input: (typeof AcpClientTerminalsOptions)["~type.make.in"]
): Layer.Layer<AcpClientTerminals, never, ChildProcessSpawner.ChildProcessSpawner> =>
  Layer.effect(AcpClientTerminals, make(input));

/**
 * Installs the terminal service as the `terminal/*` handlers of an ACP client.
 *
 * **Details**
 *
 * Pair it with `clientCapabilities.terminal: true` in the `initialize` request; without that the
 * agent never sends terminal requests.
 *
 * **Example** (Serve terminal requests)
 *
 * ```ts
 * import { register } from "@beep/acp/terminals"
 *
 * console.log(register)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const register: Effect.Effect<void, never, AcpClient.AcpClient | AcpClientTerminals> = Effect.gen(function* () {
  const client = yield* AcpClient.AcpClient;
  const terminals = yield* AcpClientTerminals;
  yield* client.handleCreateTerminal(terminals.create);
  yield* client.handleTerminalOutput(terminals.output);
  yield* client.handleTerminalWaitForExit(terminals.waitForExit);
  yield* client.handleTerminalKill(terminals.kill);
  yield* client.handleTerminalRelease(terminals.release);
}).pipe(Effect.withSpan($I`AcpClientTerminals_register`));
