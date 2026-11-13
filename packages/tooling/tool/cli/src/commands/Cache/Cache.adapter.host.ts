/**
 * In-process owned Linux user-unit lifecycle for the bounded cache adapter.
 *
 * **Details**
 * Ported from the retired `infra/r2-cache/policy_runtime.py` owned-host
 * subprocess. Only the caller's fresh unit and process handles are eligible
 * for cleanup. Credential input crosses an anonymous pipe and is never written
 * into arguments, unit properties or an environment file. These checks do not
 * grant producer trust.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { OutputBound, runCapturedStreams } from "@beep/repo-cli-kit/process/index";
import { JsonStringCodec } from "@beep/repo-cli-kit/schema/JsonCodec";
import { Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as SecureRandomService from "effect/crypto/SecureRandom";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import {
  CacheAdapterObservationExpectation,
  CacheAdapterProcessSnapshot,
  CacheAdapterRuntimeObservation,
  CacheOwnedAdapterStartup,
} from "./Cache.adapter.schemas.ts";
import { CacheCommandError } from "./Cache.errors.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const $I = $RepoCliId.create("commands/Cache/Cache.adapter.host");

const MEMORY_MAX_BYTES = 256 * 1024 * 1024;
const STARTUP_INPUT_BOUND = 32_768;
const READINESS_ATTEMPTS = 100;
const SYSTEMCTL = "/usr/bin/systemctl";
const SYSTEMD_RUN = "/usr/bin/systemd-run";
const ENV = "/usr/bin/env";
const propertyBound = OutputBound.make({ maxChars: 4096, truncatedNotice: "systemd property exceeded bound" });

const AllowedEnvironment = HashSet.make(
  "PATH",
  "HOME",
  "LANG",
  "HOST",
  "PORT",
  "TOKIO_WORKER_THREADS",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET_NAME",
  "S3_USE_PATH_STYLE",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "TURBO_TOKEN",
  "BEEP_CACHE_POLICY",
  "BEEP_CACHE_NAMESPACE",
  "BEEP_CACHE_ACCESS_ROLE",
  "OTEL_SDK_DISABLED",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "RUST_LOG",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "RUNNER_TRACKING_ID"
);

const Role = S.Literals(["reader", "writer"]);
const Integer = S.NumberFromString.pipe(S.check(S.isInt()));

/**
 * Bounded launcher run inside the transient unit.
 *
 * **Details**
 * The unit starts it through `/usr/bin/env -i`, so the user manager's
 * environment (preload or runtime option variables included) never reaches the
 * launcher or the adapter. It reads the private startup value from the unit's
 * anonymous stdin pipe and replaces itself with the adapter through `execve`,
 * which keeps the PID the parent observes and passes exactly the approved
 * environment. It runs under the CLI's own runtime, outside this module, so it
 * is plain JavaScript text rather than Effect code.
 */
const LAUNCHER = `const chunks = []
let size = 0
for await (const chunk of process.stdin) { size += chunk.length; if (size > ${STARTUP_INPUT_BOUND}) process.exit(78); chunks.push(chunk) }
const config = JSON.parse(Buffer.concat(chunks).toString("utf8"))
process.execve(config.adapter, [config.adapter], config.env)`;

/**
 * Command line that the transient unit executes for the launcher.
 *
 * **Details**
 * The CLI's absolute runtime executable runs the launcher. Bun additionally
 * skips dotenv loading; Node never loads dotenv implicitly.
 *
 * **Example** (Inspect the cleared launcher environment)
 * ```ts
 * import { cacheOwnedAdapterLauncher } from "@beep/repo-cli/test/Cache"
 * console.assert(cacheOwnedAdapterLauncher({ runtime: "/usr/bin/bun", bun: true })[0] === "/usr/bin/env")
 * ```
 *
 * @internal
 * @param options - Absolute path of the JavaScript runtime executable and whether it is Bun.
 * @returns The unit's command line, starting with `/usr/bin/env -i`.
 * @category resources
 * @since 0.0.0
 */
export const cacheOwnedAdapterLauncher = ({
  runtime,
  bun,
}: {
  readonly runtime: string;
  readonly bun: boolean;
}): ReadonlyArray<string> => [ENV, "-i", runtime, ...(bun ? ["--no-env-file"] : A.empty<string>()), "-e", LAUNCHER];

const fail = (message: string) => Effect.fail(CacheCommandError.new(message));

const userManagerEnvironment = (home: string) => {
  // The retired host ran with only PATH and HOME, so it always used the
  // default runtime directory and bus for its own uid.
  const uid = O.getOrElse(O.fromUndefinedOr(process.getuid?.()), () => 0);
  const runtime = `/run/user/${uid}`;
  return {
    PATH: "/usr/bin",
    HOME: home,
    XDG_RUNTIME_DIR: runtime,
    DBUS_SESSION_BUS_ADDRESS: `unix:path=${runtime}/bus`,
  };
};

const systemctl = Effect.fnUntraced(function* (
  environment: Readonly<Record<string, string>>,
  args: ReadonlyArray<string>,
  timeout: Duration.Input
) {
  return yield* runCapturedStreams({
    command: SYSTEMCTL,
    args: ["--user", ...args],
    cwd: environment.HOME,
    extendEnv: false,
    env: environment,
    bound: propertyBound,
  }).pipe(Effect.timeout(timeout));
});

const unitProperty = Effect.fnUntraced(function* (
  environment: Readonly<Record<string, string>>,
  unit: string,
  name: string
) {
  const result = yield* systemctl(environment, ["show", unit, "-p", name, "--value"], Duration.seconds(10));
  if (result.exitCode !== 0 || result.truncated) return yield* fail(`Cannot read the owned adapter ${name}.`);
  return Str.trim(result.stdout);
});

const hashBytes = S.decodeEffect(Sha256HexFromBytes);

const parseInteger = (value: string) => S.decodeOption(Integer)(Str.trim(value));

const countMatching = (names: ReadonlyArray<string>, ...needles: ReadonlyArray<string>) =>
  A.length(A.filter(names, (name) => A.some(needles, (needle) => pipe(name, Str.includes(needle)))));

const holdsLoopbackListener = (snapshot: CacheAdapterProcessSnapshot, port: number) => {
  const address = `0100007F:${pipe(Str.toUpperCase(port.toString(16)), Str.padStart(4, "0"))}`;
  const sockets = HashSet.fromIterable(snapshot.socketInodes);
  return pipe(
    Str.split(snapshot.tcpTable, "\n"),
    A.drop(1),
    A.map((row) => Str.split(Str.trim(row), /\s+/)),
    A.some(
      (row) =>
        A.get(row, 1).pipe(O.contains(address)) &&
        A.get(row, 3).pipe(O.contains("0A")) &&
        A.get(row, 9).pipe(O.exists((inode) => HashSet.has(sockets, inode)))
    )
  );
};

const ownsCgroup = (snapshot: CacheAdapterProcessSnapshot, expected: CacheAdapterObservationExpectation) =>
  snapshot.mainPid > 0 &&
  snapshot.mainPid === expected.pid &&
  Str.startsWith("/user.slice/")(snapshot.controlGroup) &&
  Str.endsWith(`/${expected.unit}`)(snapshot.controlGroup);

const explicitEnvironment = (snapshot: CacheAdapterProcessSnapshot, expected: CacheAdapterObservationExpectation) => {
  const names = HashSet.fromIterable(snapshot.environmentNames);
  return (
    Equal.equals(names, HashSet.fromIterable(expected.environmentNames)) &&
    !HashSet.has(names, "TURBO_REMOTE_CACHE_SIGNATURE_KEY") &&
    !HashSet.some(names, Str.startsWith("OP_"))
  );
};

const cpuEnvelope = (snapshot: CacheAdapterProcessSnapshot) =>
  pipe(
    A.map(Str.split(Str.trim(snapshot.cpuMax), /\s+/), parseInteger),
    O.liftPredicate((cpu) => A.length(cpu) === 2),
    O.flatMap((cpu) => O.all({ quota: O.flatten(A.get(cpu, 0)), period: O.flatten(A.get(cpu, 1)) })),
    O.filter(({ quota, period }) => quota === 2 * period)
  );

const resourceEnvelope = (snapshot: CacheAdapterProcessSnapshot) =>
  O.isSome(cpuEnvelope(snapshot)) &&
  O.contains(parseInteger(snapshot.memoryMax), MEMORY_MAX_BYTES) &&
  O.contains(parseInteger(snapshot.pidsMax), 16);

const lifetimeEnvelope = (snapshot: CacheAdapterProcessSnapshot) =>
  snapshot.runtimeMaxUSec === "10min" && snapshot.timeoutStopUSec === "10s" && snapshot.killMode === "control-group";

const workerCounts = (snapshot: CacheAdapterProcessSnapshot) => ({
  actix: countMatching(snapshot.threadNames, "actix", "arbiter"),
  tokio: countMatching(snapshot.threadNames, "tokio"),
});

const workerEnvelope = (snapshot: CacheAdapterProcessSnapshot) => {
  const { actix, tokio } = workerCounts(snapshot);
  return actix === 3 && tokio >= 2 && tokio <= 8 && A.length(snapshot.threadNames) <= 12;
};

type ObservationCheck = readonly [
  holds: (snapshot: CacheAdapterProcessSnapshot, expected: CacheAdapterObservationExpectation) => boolean,
  refusal: string,
];

// The retired host's order and refusal messages; the first failing check names the refusal.
const OBSERVATION_CHECKS: ReadonlyArray<ObservationCheck> = [
  [ownsCgroup, "Runtime proof did not identify its owned adapter cgroup"],
  [
    (snapshot, expected) => snapshot.executableSha256 === expected.sha256,
    "The resource unit did not execute the reviewed adapter",
  ],
  [
    (snapshot, expected) => holdsLoopbackListener(snapshot, expected.port),
    "The owned adapter does not hold its loopback listener",
  ],
  [explicitEnvironment, "The backend inherited environment outside its explicit fixture allowlist"],
  [resourceEnvelope, "The actual adapter resource envelope differs from the requested caps"],
  [lifetimeEnvelope, "The actual adapter lifetime or stop envelope differs from its requested caps"],
  [workerEnvelope, "The adapter did not preserve its fixed worker envelope"],
];

const decodeObservation = S.decodeUnknownEffect(CacheAdapterRuntimeObservation);

/**
 * Judge one recorded process snapshot against the owned adapter's fixed envelope.
 *
 * **Details**
 * Checks run in the retired host's order: owned cgroup and stable PID, reviewed
 * executable digest, loopback listener held by the process, exact environment
 * names (never the artifact signing key or `OP_*` names), cgroup caps, unit
 * lifetime/stop envelope, then the fixed worker-thread envelope. The first
 * failing check names the refusal.
 *
 * **Example** (Plan a snapshot judgment)
 * ```ts
 * import { observeCacheAdapterSnapshot } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof observeCacheAdapterSnapshot === "function")
 * ```
 *
 * @internal
 * @param snapshot - Recorded systemd, /proc and cgroup facts.
 * @param expected - The unit, role, phase, executable digest, environment names, port and PID.
 * @returns The schema-checked runtime observation.
 * @category observability
 * @since 0.0.0
 */
export const observeCacheAdapterSnapshot = Effect.fn("CacheAdapterHost.observeSnapshot")(function* (
  snapshot: CacheAdapterProcessSnapshot,
  expected: CacheAdapterObservationExpectation
) {
  const refusal = A.findFirst(OBSERVATION_CHECKS, ([holds]) => !holds(snapshot, expected));
  if (O.isSome(refusal)) return yield* fail(refusal.value[1]);
  const cpu = yield* cpuEnvelope(snapshot).pipe(
    Effect.fromOption(() => CacheCommandError.new("Unreachable cpu envelope."))
  );
  const memoryPeak = yield* parseInteger(snapshot.memoryPeak).pipe(
    Effect.fromOption(() => CacheCommandError.new("The owned adapter memory peak is unreadable."))
  );
  const { actix, tokio } = workerCounts(snapshot);
  return yield* decodeObservation({
    role: expected.role,
    phase: expected.phase,
    actixThreadsIncludingAcceptor: actix,
    tokioNamedThreadsIncludingBlocking: tokio,
    totalThreads: A.length(snapshot.threadNames),
    memoryMaxBytes: MEMORY_MAX_BYTES,
    cpuQuotaMicros: cpu.quota,
    cpuPeriodMicros: cpu.period,
    tasksMax: 16,
    runtimeMaxSeconds: 600,
    stopTimeoutSeconds: 10,
    memoryPeakBytes: memoryPeak,
    reviewedExecutable: true,
    ownedLoopbackListener: true,
    sameProcess: true,
    explicitEnvironmentOnly: true,
    passed: true,
  }).pipe(CacheCommandError.mapError("The owned adapter observation differs from its fixed schema."));
});

const readSocketInodes = Effect.fnUntraced(function* (fs: FileSystem.FileSystem, processRoot: string) {
  const descriptors = yield* fs.readDirectory(`${processRoot}/fd`);
  const targets = yield* Effect.forEach(
    descriptors,
    (descriptor) => fs.readLink(`${processRoot}/fd/${descriptor}`).pipe(Effect.option),
    { concurrency: 1 }
  );
  return pipe(
    A.getSomes(targets),
    A.filter((target) => Str.startsWith("socket:[")(target) && Str.endsWith("]")(target)),
    A.map(Str.slice(8, -1))
  );
});

const readThreadNames = Effect.fnUntraced(function* (fs: FileSystem.FileSystem, processRoot: string) {
  const tasks = yield* fs.readDirectory(`${processRoot}/task`);
  return yield* Effect.forEach(
    tasks,
    (task) => fs.readFileString(`${processRoot}/task/${task}/comm`).pipe(Effect.map(Str.trim)),
    { concurrency: 1 }
  );
});

const readEnvironmentNames = Effect.fnUntraced(function* (fs: FileSystem.FileSystem, processRoot: string) {
  const environ = yield* fs.readFile(`${processRoot}/environ`);
  return pipe(
    Str.split(new TextDecoder().decode(environ), "\0"),
    A.filter(Str.isNonEmpty),
    A.map((entry) => pipe(Str.split(entry, "="), A.headNonEmpty))
  );
});

/**
 * Read one live process snapshot for an owned unit.
 *
 * @internal
 * @param environment - User-manager client environment.
 * @param unit - The owned transient unit name.
 * @returns The unparsed systemd, /proc and cgroup facts.
 * @category observability
 * @since 0.0.0
 */
const readCacheAdapterSnapshot = Effect.fn("CacheAdapterHost.readSnapshot")(function* (
  environment: Readonly<Record<string, string>>,
  unit: string
) {
  const fs = yield* FileSystem.FileSystem;
  const mainPid = yield* unitProperty(environment, unit, "MainPID").pipe(
    Effect.map(parseInteger),
    Effect.map(O.getOrElse(() => 0))
  );
  const controlGroup = yield* unitProperty(environment, unit, "ControlGroup");
  if (mainPid <= 0) return yield* fail("Runtime proof did not identify its owned adapter cgroup");
  const processRoot = `/proc/${mainPid}`;
  const group = `/sys/fs/cgroup${controlGroup}`;
  return CacheAdapterProcessSnapshot.make({
    mainPid,
    controlGroup,
    executableSha256: yield* fs.readFile(`${processRoot}/exe`).pipe(Effect.flatMap(hashBytes)),
    socketInodes: yield* readSocketInodes(fs, processRoot),
    tcpTable: yield* fs.readFileString(`${processRoot}/net/tcp`),
    environmentNames: yield* readEnvironmentNames(fs, processRoot),
    cpuMax: yield* fs.readFileString(`${group}/cpu.max`),
    memoryMax: yield* fs.readFileString(`${group}/memory.max`),
    pidsMax: yield* fs.readFileString(`${group}/pids.max`),
    memoryPeak: yield* fs.readFileString(`${group}/memory.peak`),
    runtimeMaxUSec: yield* unitProperty(environment, unit, "RuntimeMaxUSec"),
    timeoutStopUSec: yield* unitProperty(environment, unit, "TimeoutStopUSec"),
    killMode: yield* unitProperty(environment, unit, "KillMode"),
    threadNames: yield* readThreadNames(fs, processRoot),
  });
}, CacheCommandError.mapError("Cannot read the owned adapter runtime facts."));

/**
 * Services the live owned-adapter host uses.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CacheOwnedAdapterServices =
  | FileSystem.FileSystem
  | ChildProcessSpawner.ChildProcessSpawner
  | SecureRandom.SecureRandom
  | Digest.Digest
  | HttpClient.HttpClient;

/**
 * Starts one owned adapter unit inside the caller's scope from a private startup value.
 *
 * @internal
 * @category services
 * @since 0.0.0
 */
export interface CacheOwnedAdapterHostShape {
  readonly start: (
    startup: CacheOwnedAdapterStartup,
    work: string
  ) => Effect.Effect<
    {
      /** Readiness observation of the started unit. */
      readonly ready: CacheAdapterRuntimeObservation;
      /** Observe the same process again after load. */
      readonly verify: Effect.Effect<CacheAdapterRuntimeObservation, CacheCommandError, CacheOwnedAdapterServices>;
      /** Run the exhaustive cleanup; fails when any owned resource could not be stopped. */
      readonly stop: Effect.Effect<void, CacheCommandError, CacheOwnedAdapterServices>;
    },
    CacheCommandError,
    CacheOwnedAdapterServices | Scope.Scope
  >;
}

const realPathOption = (fs: FileSystem.FileSystem) => (path: string) =>
  fs.realPath(path).pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>));

interface StartupFacts {
  readonly digest: string;
  readonly home: O.Option<string>;
  readonly info: FileSystem.File.Info;
  readonly startup: CacheOwnedAdapterStartup;
  readonly workspace: string;
}

const startupPort = (startup: CacheOwnedAdapterStartup) => pipe(R.get(startup.env, "PORT"), O.flatMap(parseInteger));
const startupRole = (startup: CacheOwnedAdapterStartup) =>
  pipe(R.get(startup.env, "BEEP_CACHE_ACCESS_ROLE"), O.filter(S.is(Role)));

const STARTUP_CHECKS: ReadonlyArray<(facts: StartupFacts) => boolean> = [
  ({ info }) => info.type === "File" && (info.mode & 0o111) !== 0,
  ({ digest, startup }) => digest === startup.sha256,
  ({ startup }) => O.contains(R.get(startup.env, "HOST"), "127.0.0.1"),
  ({ startup }) => O.exists(startupPort(startup), (value) => value >= 1024 && value <= 65_535),
  ({ startup }) => O.contains(R.get(startup.env, "BEEP_CACHE_POLICY"), "signed-v1"),
  ({ startup }) => O.isSome(startupRole(startup)),
  ({ startup }) => A.every(R.keys(startup.env), (key) => HashSet.has(AllowedEnvironment, key)),
  ({ home, workspace }) => O.contains(home, workspace),
];

const encodeStartup = JsonStringCodec(CacheOwnedAdapterStartup).encode;

const validateStartup = Effect.fnUntraced(function* (startup: CacheOwnedAdapterStartup, work: string) {
  const fs = yield* FileSystem.FileSystem;
  const adapter = yield* fs.realPath(startup.adapter);
  const facts: StartupFacts = {
    info: yield* fs.stat(adapter),
    digest: yield* fs.readFile(adapter).pipe(Effect.flatMap(hashBytes)),
    home: yield* O.match(R.get(startup.env, "HOME"), {
      onNone: () => Effect.succeed(O.none<string>()),
      onSome: realPathOption(fs),
    }),
    workspace: yield* fs.realPath(work),
    startup,
  };
  const accepted = O.all({ port: startupPort(startup), role: startupRole(startup) }).pipe(
    O.filter(() => A.every(STARTUP_CHECKS, (holds) => holds(facts)))
  );
  const { port, role } = yield* accepted.pipe(
    Effect.fromOption(() => CacheCommandError.new("Owned adapter input differs from its bounded signed profile"))
  );
  const configuration = yield* encodeStartup(CacheOwnedAdapterStartup.make({ ...startup, adapter }));
  const bytes = new TextEncoder().encode(configuration);
  if (bytes.length > STARTUP_INPUT_BOUND) return yield* fail("Owned adapter startup input exceeds its bound");
  return { bytes, port, role, workspace: facts.workspace };
});

const stopUnit = Effect.fnUntraced(function* (environment: Readonly<Record<string, string>>, unit: string) {
  const stopped = yield* systemctl(environment, ["stop", unit], Duration.seconds(15));
  const loaded = stopped.exitCode === 0 ? "stopped" : yield* unitProperty(environment, unit, "LoadState");
  if (loaded !== "stopped" && loaded !== "not-found") return yield* fail("Owned adapter unit could not be stopped");
  const state = yield* unitProperty(environment, unit, "ActiveState");
  if (state !== "inactive" && state !== "failed")
    return yield* fail("Owned adapter unit remained active after cleanup");
  yield* systemctl(environment, ["reset-failed", unit], Duration.seconds(10)).pipe(Effect.ignore);
});

// Closing a process scope sends SIGTERM and SIGKILL ten seconds later, the
// retired host's terminate/wait/kill sequence.
const stopProcess = (scope: Scope.Closeable) =>
  Scope.close(scope, Exit.void).pipe(Effect.timeout(Duration.seconds(15)));

interface OwnedResources {
  readonly processes: ReadonlyArray<Scope.Closeable>;
  readonly units: ReadonlyArray<string>;
}

/**
 * Attempt every owned unit and child before reporting an aggregate failure.
 */
const stopOwnedAdapters = Effect.fnUntraced(function* (
  environment: Readonly<Record<string, string>>,
  resources: Ref.Ref<OwnedResources>
) {
  const owned = yield* Ref.getAndSet(resources, { units: A.empty(), processes: A.empty() });
  const unitResults = yield* Effect.forEach(owned.units, (unit) => Effect.exit(stopUnit(environment, unit)), {
    concurrency: 1,
  });
  const processResults = yield* Effect.forEach(owned.processes, (process) => Effect.exit(stopProcess(process)), {
    concurrency: 1,
  });
  const failures = A.length(A.filter(A.appendAll(unitResults, processResults), Exit.isFailure));
  if (failures > 0)
    return yield* fail(`Owned adapter cleanup failed in ${failures} operation(s); every resource was attempted`);
});

/**
 * Whether a loopback HTTP endpoint answers 200 within one second.
 *
 * **Details**
 * Shared by the owned adapter host and the R2 probe's reader adapter. Any
 * transport failure or timeout counts as not ready.
 *
 * **Example** (Plan one readiness probe)
 * ```ts
 * import { cacheLoopbackHealthy } from "@beep/repo-cli/test/Cache"
 * import * as HttpClientRequest from "effect/http/HttpClientRequest"
 * const probe = cacheLoopbackHealthy(HttpClientRequest.get("http://127.0.0.1:9427/management/health"))
 * console.assert(typeof probe === "object")
 * ```
 *
 * @internal
 * @param request - The health request.
 * @returns `true` when the endpoint answered 200.
 * @category utilities
 * @since 0.0.0
 */
export const cacheLoopbackHealthy = (request: HttpClientRequest.HttpClientRequest) =>
  HttpClient.execute(request).pipe(
    Effect.map((response) => response.status === 200),
    Effect.timeout(Duration.seconds(1)),
    Effect.orElseSucceed(() => false)
  );

const systemdRunArguments = (unit: string, workspace: string) => [
  "--user",
  "--quiet",
  "--wait",
  "--pipe",
  `--unit=${unit}`,
  "--service-type=exec",
  `--working-directory=${workspace}`,
  "--property=MemoryMax=256M",
  "--property=CPUQuota=200%",
  "--property=TasksMax=16",
  "--property=RuntimeMaxSec=600",
  "--property=TimeoutStopSec=10",
  "--property=KillMode=control-group",
  ...cacheOwnedAdapterLauncher({ runtime: process.execPath, bun: P.isNotUndefined(process.versions.bun) }),
];

const allocateUnit = Effect.fnUntraced(function* (manager: Readonly<Record<string, string>>, role: string) {
  const random = yield* SecureRandomService.SecureRandom;
  const uuid = yield* random.uuidV4();
  const unit = `beep-cache-owned-${Str.slice(0, 12)(Str.replaceAll("-", "")(uuid))}-${role}.service`;
  const loaded = yield* unitProperty(manager, unit, "LoadState");
  if (loaded !== "not-found") return yield* fail("Owned adapter unit already exists");
  return unit;
});

const awaitReadiness = Effect.fnUntraced(function* (handle: ChildProcessSpawner.ChildProcessHandle, port: number) {
  const health = HttpClientRequest.get(`http://127.0.0.1:${port}/management/health`);
  const isReady = yield* Effect.gen(function* () {
    if (!(yield* handle.isRunning)) return yield* fail("Owned adapter exited before readiness");
    const ready = yield* cacheLoopbackHealthy(health);
    if (!ready) yield* Effect.sleep(Duration.millis(50));
    return ready;
  }).pipe(Effect.repeat({ times: READINESS_ATTEMPTS - 1, until: (ready: boolean) => ready }));
  if (!isReady) return yield* fail("Owned adapter did not become ready");
});

const startLive = Effect.fn("CacheAdapterHost.start")(function* (startup: CacheOwnedAdapterStartup, work: string) {
  const input = yield* validateStartup(startup, work);
  const manager = userManagerEnvironment(input.workspace);
  const unit = yield* allocateUnit(manager, input.role);
  const processScope = yield* Scope.make();
  const resources = yield* Ref.make<OwnedResources>({ units: [unit], processes: [processScope] });
  // The exhaustive cleanup scope is installed before the unit or child can exist.
  yield* Effect.addFinalizer(() => stopOwnedAdapters(manager, resources).pipe(Effect.ignore));
  const handle = yield* ChildProcess.make(SYSTEMD_RUN, systemdRunArguments(unit, input.workspace), {
    cwd: input.workspace,
    extendEnv: false,
    env: manager,
    stdin: { stream: Stream.make(input.bytes) },
    stdout: "ignore",
    stderr: "ignore",
    forceKillAfter: Duration.seconds(10),
  }).pipe(Scope.provide(processScope));
  yield* awaitReadiness(handle, input.port);
  const pid = yield* unitProperty(manager, unit, "MainPID").pipe(
    Effect.map(parseInteger),
    Effect.map(O.getOrElse(() => 0))
  );
  const observe = (phase: CacheAdapterObservationExpectation["phase"]) =>
    readCacheAdapterSnapshot(manager, unit).pipe(
      Effect.flatMap((snapshot) =>
        observeCacheAdapterSnapshot(
          snapshot,
          CacheAdapterObservationExpectation.make({
            unit,
            role: input.role,
            phase,
            sha256: startup.sha256,
            environmentNames: R.keys(startup.env),
            port: input.port,
            pid,
          })
        )
      )
    );
  const ready = yield* observe("ready");
  // The unit caps the adapter at ten minutes; parent commands cannot extend it.
  const deadline = (yield* Clock.currentTimeMillis) + Duration.toMillis(Duration.minutes(10));
  const requireLive = Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const running = yield* handle.isRunning.pipe(Effect.orElseSucceed(() => false));
    if (now >= deadline || !running) return yield* fail("Owned backend stopped before the parent completed");
  });
  return {
    ready,
    verify: requireLive.pipe(Effect.andThen(observe("after-load"))),
    stop: requireLive.pipe(Effect.andThen(stopOwnedAdapters(manager, resources))),
  };
}, CacheCommandError.mapError("Owned adapter host failed."));

/**
 * Live owned-adapter host over the systemd user manager.
 *
 * **Example** (Reference the live host)
 * ```ts
 * import { cacheOwnedAdapterHostLive } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof cacheOwnedAdapterHostLive.start === "function")
 * ```
 *
 * @internal
 * @category layers
 * @since 0.0.0
 */
export const cacheOwnedAdapterHostLive: CacheOwnedAdapterHostShape = { start: startLive };

/**
 * Owned adapter host used by producer upload supervision.
 *
 * **Details**
 * A `Context.Reference` whose default drives the real systemd user manager,
 * so producer commands need no extra layer. Tests provide an inert host.
 * A missing user manager fails explicitly; this route never falls back to an
 * unbounded process.
 *
 * **Example** (Replace the host in a test)
 * ```ts
 * import { CacheCommandError } from "@beep/repo-cli/commands/Cache"
 * import { CacheOwnedAdapterHost } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const refuse = Layer.succeed(CacheOwnedAdapterHost, {
 *   start: () => Effect.fail(CacheCommandError.new("No user manager in this test."))
 * })
 * console.assert(Layer.isLayer(refuse))
 * ```
 *
 * @internal
 * @category services
 * @since 0.0.0
 */
export const CacheOwnedAdapterHost: Context.Reference<CacheOwnedAdapterHostShape> =
  Context.Reference<CacheOwnedAdapterHostShape>($I`CacheOwnedAdapterHost`, {
    defaultValue: () => cacheOwnedAdapterHostLive,
  });
