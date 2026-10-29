/**
 * Linux/Bun process boundary for the owned private observation worker.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { renderNativeHttpMetrics } from "@beep/repo-ai-metrics/native-http";
import {
  observationWorkerConfigFromLaunch,
  readObservationLaunchConfig,
} from "@beep/repo-ai-metrics/observation-launch";
import { makeObservationMaintenanceHttp } from "@beep/repo-ai-metrics/observation-maintenance-http";
import { makeObservationRuntime, renderObservationRuntimeMetrics } from "@beep/repo-ai-metrics/observation-runtime";
import { makeObservationWorker } from "@beep/repo-ai-metrics/observation-worker";
import { makeTranscriptDiscovery, TranscriptDiscoveryInput } from "@beep/repo-ai-metrics/transcript-discovery";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as SqliteClient from "@effect/sql-sqlite-bun/SqliteClient";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

const $I = $RepoCliId.create("commands/AIMetrics/internal/ObservationWorker");
/**
 * Content-free process-boundary failure.
 * **Example** (Inspecting process refusal)
 * ```ts
 * import { ObservationProcessError } from "@beep/repo-cli/commands/AIMetrics/internal/ObservationWorker"
 * console.log(ObservationProcessError.make({reason:"ownership"}).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ObservationProcessError extends S.TaggedError<ObservationProcessError, { readonly brand: unique symbol }>(
  $I`ObservationProcessError`
)(
  "ObservationProcessError",
  {
    reason: S.Literals([
      "configuration",
      "ownership",
      "resources",
      "storage",
      "socket",
      "secret-environment",
      "runtime",
    ]),
  },
  $I.annote("ObservationProcessError", {
    description: "Safe process refusal without paths, secrets or request content.",
  })
) {}
const failure = (reason: ObservationProcessError["reason"]) => ObservationProcessError.make({ reason });
const readKernel = Effect.fn("ObservationProcess.readKernel")(function* (file: string, limit = 8192) {
  const fs = yield* FileSystem.FileSystem;
  const chunks = yield* fs.stream(file, { bytesToRead: limit + 1 }).pipe(
    Stream.runCollect,
    Effect.mapError(() => failure("resources"))
  );
  const size = A.reduce(chunks, 0, (n, b) => n + b.byteLength);
  if (size > limit) return yield* failure("resources");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return yield* Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    catch: () => failure("resources"),
  });
});
const privateFile = Effect.fn("ObservationProcess.privateFile")(function* (file: string, uid: number) {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.lstat(file).pipe(Effect.mapError(() => failure("ownership")));
  if (
    info.type !== "File" ||
    (info.mode & 0o777) !== 0o600 ||
    O.isNone(info.uid) ||
    info.uid.value !== uid ||
    O.isNone(info.nlink) ||
    info.nlink.value !== BigInt(1) ||
    O.isNone(info.ino)
  )
    return yield* failure("ownership");
  return info;
});
const qualify = Effect.fn("ObservationProcess.qualify")(function* (directory: string, uid: number, dbPages: number) {
  const fs = yield* FileSystem.FileSystem;
  const lock = yield* privateFile(`${directory}/worker.lock`, uid);
  const descriptors = yield* fs.readDirectory("/proc/self/fd");
  if (descriptors.length > 256) return yield* failure("resources");
  let owned = false;
  for (const descriptor of descriptors) {
    if (!/^\d{1,3}$/.test(descriptor)) continue;
    const info = yield* fs.stat(`/proc/self/fd/${descriptor}`).pipe(Effect.option);
    if (
      O.isNone(info) ||
      info.value.dev !== lock.dev ||
      O.isNone(info.value.ino) ||
      O.isNone(lock.ino) ||
      info.value.ino.value !== lock.ino.value
    )
      continue;
    const metadata = yield* readKernel(`/proc/self/fdinfo/${descriptor}`);
    owned = new RegExp(
      `^lock:\\s+\\d+:\\s+FLOCK\\s+ADVISORY\\s+WRITE\\s+${process.pid}\\s+[0-9a-f]+:[0-9a-f]+:${lock.ino.value}\\s+0\\s+EOF$`,
      "m"
    ).test(metadata);
    if (owned) break;
  }
  if (!owned) return yield* failure("ownership");
  const group = O.getOrUndefined(Str.match(/^0::(\/[^\n]+)\n?$/)(yield* readKernel("/proc/self/cgroup")))?.[1];
  if (group === undefined || Str.includes("..")(group)) return yield* failure("resources");
  const root = `/sys/fs/cgroup${group}`;
  const number = Effect.fn("ObservationProcess.limit")(function* (name: string) {
    return yield* S.decodeEffect(S.FiniteFromString)(Str.trim(yield* readKernel(`${root}/${name}`))).pipe(
      Effect.mapError(() => failure("resources"))
    );
  });
  const memory = yield* number("memory.max");
  const swap = yield* number("memory.swap.max");
  const pids = yield* number("pids.max");
  const cpu = O.getOrNull(Str.match(/^(\d+) (\d+)\n?$/)(yield* readKernel(`${root}/cpu.max`)));
  if (
    memory <= 0 ||
    memory > 2147483648 ||
    swap !== 0 ||
    pids < 1 ||
    pids > 128 ||
    cpu === null ||
    Number(cpu[1]) <= 0 ||
    Number(cpu[2]) <= 0 ||
    Number(cpu[1]) > Number(cpu[2])
  )
    return yield* failure("resources");
  const limits = yield* readKernel("/proc/self/limits");
  const descriptorsLimit = O.getOrNull(Str.match(/^Max open files\s+(\d+)\s+(\d+)\s+files[ \t]*$/m)(limits));
  const fileLimit = O.getOrNull(Str.match(/^Max file size\s+(\d+)\s+(\d+)\s+bytes[ \t]*$/m)(limits));
  if (
    descriptorsLimit === null ||
    Number(descriptorsLimit[2]) > 256 ||
    fileLimit === null ||
    Number(fileLimit[2]) > 67108864 ||
    Number(fileLimit[1]) < dbPages * 8192 ||
    !/^Max core file size\s+0\s+0\s+bytes[ \t]*$/m.test(limits)
  )
    return yield* failure("resources");
  const status = yield* readKernel("/proc/self/status");
  if (!/^NoNewPrivs:\s+1$/m.test(status) || !/^Umask:\s+0077$/m.test(status)) return yield* failure("resources");
});
/**
 * Run a paused-by-default observation process on a private Unix socket.
 * **Example** (Inspecting the process program)
 * ```ts
 * import { runObservationWorkerProcess } from "@beep/repo-cli/commands/AIMetrics/internal/ObservationWorker"
 * console.log(typeof runObservationWorkerProcess)
 * ```
 * **Details** Linux/Bun only. Requires a pre-created private directory/config, inherited exclusive flock, cgroup memory/swap/CPU/task ceilings, finite descriptor/file limits, zero core dumps and no-new-privileges. Opens only fixed owned journal/socket paths; refuses symlink/hardlink database files and active stale sockets. Health, metrics and pause/resume are private-socket routes; no TCP listener is created. A frontend may expose only /v1/traces with the previously qualified transport limits. Installed credentials come from bounded private systemd files; direct process fixtures may use an explicit environment. A present but invalid credential directory never falls back to environment secrets. Secrets never enter argv or health. Scope shutdown drains the worker and closes the socket. No source is enrolled automatically and the historical recovery hold is untouched.
 * @category programs
 * @since 0.0.0
 */
export const runObservationWorkerProcess = Effect.fn("AIMetrics.runObservationWorkerProcess")(
  function* (directory: string) {
    if (process.platform !== "linux" || process.geteuid === undefined) return yield* failure("resources");
    const uid = process.geteuid();
    const fs = yield* FileSystem.FileSystem;
    const config = yield* readObservationLaunchConfig(directory, uid).pipe(
      Effect.mapError(() => failure("configuration"))
    );
    yield* qualify(directory, uid, config.intake.maxDatabasePages);
    const credentialDirectory = yield* Config.option(Config.String("CREDENTIALS_DIRECTORY")).pipe(
      Effect.mapError(() => failure("secret-environment"))
    );
    const secrets = yield* Effect.gen(function* () {
      if (O.isNone(credentialDirectory)) {
        // Direct process fixtures retain their explicit environment route. The
        // installed service uses credentials and clears all inherited variables.
        return {
          salt: yield* Config.Redacted("BEEP_AI_METRICS_HASH_SALT"),
          apiKey: yield* Config.option(Config.Redacted("BEEP_OBSERVATION_PHOENIX_API_KEY")),
        };
      }
      const path = yield* Path.Path;
      const directory = credentialDirectory.value;
      if (!path.isAbsolute(directory) || path.normalize(directory) !== directory)
        return yield* failure("secret-environment");
      const info = yield* fs.lstat(directory);
      if (info.type !== "Directory" || O.isNone(info.uid) || info.uid.value !== uid || (info.mode & 0o077) !== 0)
        return yield* failure("secret-environment");
      const names = yield* fs.readDirectory(directory);
      if (
        !A.contains(names, "hash-salt") ||
        A.some(names, (name) => name !== "hash-salt" && name !== "phoenix-api-key")
      )
        return yield* failure("secret-environment");
      const read = Effect.fn("ObservationProcess.readCredential")(function* (name: string) {
        const file = path.join(directory, name);
        const info = yield* fs.lstat(file);
        if (
          info.type !== "File" ||
          O.isNone(info.uid) ||
          info.uid.value !== uid ||
          (info.mode & 0o077) !== 0 ||
          O.isNone(info.nlink) ||
          info.nlink.value !== BigInt(1) ||
          info.size < 1 ||
          info.size > 4096
        )
          return yield* failure("secret-environment");
        const value = yield* readKernel(file, 4096);
        if (Str.includes("\u0000")(value) || Str.includes("\n")(value) || Str.includes("\r")(value))
          return yield* failure("secret-environment");
        return Redacted.make(value);
      });
      return {
        salt: yield* read("hash-salt"),
        apiKey: A.contains(names, "phoenix-api-key") ? O.some(yield* read("phoenix-api-key")) : O.none(),
      };
    }).pipe(Effect.mapError(() => failure("secret-environment")));
    const workerConfig = yield* observationWorkerConfigFromLaunch(config, secrets.salt, secrets.apiKey).pipe(
      Effect.mapError(() => failure("configuration"))
    );
    const names = yield* fs.readDirectory(directory);
    for (const name of ["journal.sqlite", "journal.sqlite-journal", "journal.sqlite-wal", "journal.sqlite-shm"]) {
      if (A.contains(names, name)) yield* privateFile(`${directory}/${name}`, uid);
    }
    const socket = `${directory}/worker.sock`;
    if (A.contains(names, "worker.sock")) {
      const info = yield* fs.lstat(socket);
      if (info.type !== "Socket" || O.isNone(info.uid) || info.uid.value !== uid || (info.mode & 0o777) !== 0o600)
        return yield* failure("socket");
      if (
        A.some(Str.split("\n")(yield* readKernel("/proc/net/unix", 1048576)), (line) =>
          Str.endsWith(` ${socket}`)(line)
        )
      )
        return yield* failure("socket");
      yield* fs.remove(socket);
    }
    const sql = yield* SqliteClient.make({ filename: `${directory}/journal.sqlite` });
    yield* fs.chmod(`${directory}/journal.sqlite`, 0o600);
    const worker = yield* makeObservationWorker(workerConfig).pipe(Effect.provideService(SqlClient.SqlClient, sql));
    const maintenance = yield* makeObservationMaintenanceHttp(worker, workerConfig, directory);
    const sourceWork = O.isSome(config.discovery)
      ? O.some({
          poll: worker.discover(
            yield* makeTranscriptDiscovery(
              TranscriptDiscoveryInput.make({ ...config.discovery.value, hashSalt: secrets.salt })
            ),
            config.discovery.value.read
          ),
          policy: config.discovery.value.runtime,
        })
      : O.none();
    const runtime = yield* makeObservationRuntime(worker, config.runtime, sourceWork);
    // Capture ownership only after bind. Never unlink another listener on a failed bind.
    let ownedSocket: O.Option<FileSystem.File.Info> = O.none();
    // Registered first so server shutdown precedes inode-checked socket cleanup.
    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        if (O.isNone(ownedSocket)) return;
        const current = yield* fs.lstat(socket).pipe(Effect.option);
        if (
          O.isSome(current) &&
          current.value.type === "Socket" &&
          current.value.dev === ownedSocket.value.dev &&
          O.isSome(current.value.ino) &&
          O.isSome(ownedSocket.value.ino) &&
          current.value.ino.value === ownedSocket.value.ino.value
        )
          yield* fs.remove(socket);
      }).pipe(Effect.orDie)
    );
    const server = Context.get(
      yield* Layer.build(BunHttpServer.layer({ unix: socket, maxRequestBodySize: 524288, idleTimeout: 2 })),
      HttpServer.HttpServer
    );
    ownedSocket = O.some(yield* fs.lstat(socket));
    yield* fs.chmod(socket, 0o600);
    const handler = Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      if (request.method === "GET" && request.url === "/health") {
        const health = yield* runtime.health;
        return yield* HttpServerResponse.json(
          { control: yield* worker.status, runtime: health, intake: yield* worker.intakeHealth },
          { status: health.running ? 200 : 503 }
        );
      }
      if (request.method === "GET" && request.url === "/metrics")
        return HttpServerResponse.text(
          renderObservationRuntimeMetrics(yield* runtime.health) + renderNativeHttpMetrics(yield* worker.intakeHealth),
          {
            contentType: "text/plain; version=0.0.4; charset=utf-8",
          }
        );
      if (request.method === "POST" && request.url === "/control/resume")
        return yield* HttpServerResponse.json(yield* worker.resume);
      if (request.method === "POST" && request.url === "/control/pause")
        return yield* HttpServerResponse.json(yield* worker.pause);
      if (request.url === "/maintenance") return yield* maintenance.handler;
      return yield* worker.handler;
    }).pipe(Effect.orElseSucceed(() => HttpServerResponse.text("Observation operation unavailable", { status: 503 })));
    yield* server.serve(handler);
    const running = yield* runtime.run.pipe(Effect.forkChild);
    yield* Console.log("Observation worker ready on owned private socket; intake starts paused.");
    return yield* Fiber.join(running);
  },
  Effect.mapError((error) => (S.is(ObservationProcessError)(error) ? error : failure("runtime")))
);
