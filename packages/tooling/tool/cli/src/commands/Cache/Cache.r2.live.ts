/**
 * Live side effects of the R2 qualification probe.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Net from "node:net";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { cacheLoopbackHealthy } from "./Cache.adapter.host.ts";
import { CacheCommandError } from "./Cache.errors.ts";
import { CacheR2ProbeReceipt, CacheR2Response, CacheR2TaskRow } from "./Cache.r2.schemas.ts";
import { CacheR2ProbeIo, selectCacheR2SummaryTask } from "./Cache.r2.ts";
import type * as Context from "effect/Context";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { CacheR2ProbeTarget, CacheR2Request } from "./Cache.r2.schemas.ts";

const fail = (message: string) => Effect.fail(CacheCommandError.new(message));
const SCRUBBED_PREFIXES = ["OP_", "R2_", "CLOUDFLARE_"];
const PythonEscaped = HashSet.make("!", "'", "(", ")", "*");
const encodeReceipt = S.encodeEffect(S.fromJsonString(CacheR2ProbeReceipt, { space: 2 }));
const ByMtime = Order.mapInput(Order.Number, ([, mtime]: readonly [string, number]) => mtime);

/**
 * Percent-encode one query value like Python's `quote(value, safe="")`.
 */
const quote = (value: string) =>
  pipe(
    Str.split(encodeURIComponent(value), ""),
    A.map((character) =>
      HashSet.has(PythonEscaped, character)
        ? `%${Str.toUpperCase(O.getOrElse(Str.charCodeAt(character, 0), () => 0).toString(16))}`
        : character
    ),
    A.join("")
  );

const definedEnvironment = (environment: NodeJS.ProcessEnv) =>
  R.filterMap(environment, (value) => (value === undefined ? Result.failVoid : Result.succeed(value)));

type Platform =
  | FileSystem.FileSystem
  | ChildProcessSpawner.ChildProcessSpawner
  | SecureRandom.SecureRandom
  | Digest.Digest;

interface Live {
  readonly client: HttpClient.HttpClient;
  readonly environment: Readonly<Record<string, string>>;
  readonly fs: FileSystem.FileSystem;
  readonly out: string;
  readonly path: Path.Path;
  readonly platform: Context.Context<Platform>;
  readonly runs: string;
  readonly target: CacheR2ProbeTarget;
}

const makeRequest = (live: Live) =>
  Effect.fn("CacheR2.request")(
    function* (request: CacheR2Request) {
      const url = `${request.api ?? live.target.api}/v8/artifacts/${request.key}?teamId=${quote(live.target.team)}`;
      const base = HttpClientRequest.make(request.method)(url).pipe(
        HttpClientRequest.setHeaders({ Authorization: `Bearer ${live.target.token}`, "x-artifact-duration": "1" })
      );
      const prepared = P.isUndefined(request.body)
        ? base
        : HttpClientRequest.bodyUint8Array(base, request.body, "application/octet-stream");
      const started = yield* Clock.currentTimeMillis;
      const response = yield* live.client.execute(prepared);
      const buffer = request.method === "HEAD" ? new ArrayBuffer(0) : yield* response.arrayBuffer;
      const finished = yield* Clock.currentTimeMillis;
      return CacheR2Response.make({
        status: response.status,
        body: new Uint8Array(buffer),
        headers: response.headers,
        elapsedSeconds: (finished - started) / 1000,
      });
    },
    Effect.timeout(Duration.seconds(90)),
    CacheCommandError.mapError("Turbo artifact request failed.")
  );

const listSummaries = (live: Live) =>
  live.fs
    .readDirectory(live.runs)
    .pipe(Effect.orElseSucceed(A.empty<string>), Effect.map(A.filter(Str.endsWith(".json"))));

const runTurbo = Effect.fnUntraced(function* (live: Live, name: string, label: string, mode: string) {
  const nanos = yield* Clock.currentTimeNanos;
  const env = {
    ...R.filter(live.environment, (_, key) => !A.some(SCRUBBED_PREFIXES, (prefix) => Str.startsWith(prefix)(key))),
    TURBO_CACHE: mode,
  };
  const handle = yield* ChildProcess.make(
    "bun",
    [
      "run",
      "--bun",
      "turbo",
      "run",
      name,
      `--cache=${mode}`,
      `--cache-dir=${live.path.join(live.out, `local-${label}-${nanos}`)}`,
      "--summarize",
      "--output-logs=errors-only",
    ],
    { cwd: live.target.root, extendEnv: false, env, stdin: "ignore", stdout: "pipe", stderr: "pipe" }
  );
  yield* Stream.run(handle.all, live.fs.sink(live.path.join(live.out, `${label}.private.log`), { mode: 0o600 }));
  return yield* handle.exitCode;
});

const newestSummary = Effect.fnUntraced(function* (live: Live, created: ReadonlyArray<string>) {
  const dated = yield* Effect.forEach(
    created,
    (file) =>
      live.fs.stat(live.path.join(live.runs, file)).pipe(
        Effect.map(
          (info) =>
            [
              file,
              O.getOrElse(
                O.map(info.mtime, (date) => date.getTime()),
                () => 0
              ),
            ] as const
        )
      ),
    { concurrency: 1 }
  );
  return pipe(
    A.sort(dated, ByMtime),
    A.last,
    O.map(([file]) => file)
  );
});

const makeTask = (live: Live) =>
  Effect.fn("CacheR2.task")(
    function* (name: string, label: string, mode: string) {
      const existing = yield* listSummaries(live);
      const before = HashSet.fromIterable(existing);
      const started = yield* Clock.currentTimeMillis;
      const exitCode = yield* Effect.scoped(runTurbo(live, name, label, mode)).pipe(
        Effect.timeout(Duration.minutes(10))
      );
      const after = yield* listSummaries(live);
      const created = A.filter(after, (file) => !HashSet.has(before, file));
      const newest = yield* newestSummary(live, created);
      const file = yield* O.filter(newest, () => exitCode === 0).pipe(
        Effect.fromOption(() => CacheCommandError.new(`Qualification task failed: ${label}`))
      );
      const summaryText = yield* live.fs.readFileString(live.path.join(live.runs, file));
      const row = yield* selectCacheR2SummaryTask(summaryText, name);
      const finished = yield* Clock.currentTimeMillis;
      return CacheR2TaskRow.make({ task: name, ...row, elapsed_s: (finished - started) / 1000, mode });
    },
    CacheCommandError.mapError("Qualification task failed."),
    Effect.provide(live.platform)
  );

const reserveLoopbackPort = Effect.callback<number, CacheCommandError>((resume) => {
  const server = Net.createServer();
  server.once("error", (cause) => resume(Effect.fail(CacheCommandError.new("Cannot reserve a loopback port.", cause))));
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    const port = P.isNotNull(address) && !P.isString(address) ? address.port : 0;
    server.close(() => resume(Effect.succeed(port)));
  });
});

const requiredEnvironment = (live: Live, name: string) =>
  R.get(live.environment, name).pipe(
    Effect.fromOption(() => CacheCommandError.new(`${name} is required for the reader proof`))
  );

const readerAdapter = (live: Live) =>
  Effect.gen(function* () {
    const port = yield* reserveLoopbackPort;
    const readerKey = yield* requiredEnvironment(live, "R2_READ_ACCESS_KEY_ID");
    const readerSecret = yield* requiredEnvironment(live, "R2_READ_SECRET_ACCESS_KEY");
    // The scoped handle terminates the adapter, then kills it after five seconds.
    const handle = yield* ChildProcess.make(live.path.join(live.target.root, "infra/r2-cache/adapter.sh"), ["serve"], {
      cwd: live.target.root,
      extendEnv: false,
      env: {
        ...live.environment,
        R2_ACCESS_KEY_ID: readerKey,
        R2_SECRET_ACCESS_KEY: readerSecret,
        R2_ADAPTER_PORT: `${port}`,
      },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      forceKillAfter: Duration.seconds(5),
    });
    yield* Stream.run(handle.all, live.fs.sink(live.path.join(live.out, "reader.private.log"), { mode: 0o600 })).pipe(
      Effect.ignore,
      Effect.forkScoped
    );
    const api = `http://127.0.0.1:${port}`;
    const health = cacheLoopbackHealthy(
      HttpClientRequest.get(`${api}/management/health`).pipe(
        HttpClientRequest.setHeader("Authorization", `Bearer ${live.target.token}`)
      )
    ).pipe(
      Effect.provideService(HttpClient.HttpClient, live.client),
      Effect.tap((ready) => (ready ? Effect.void : Effect.sleep(Duration.millis(100))))
    );
    const ready = yield* health.pipe(Effect.repeat({ times: 99, until: (value: boolean) => value }));
    if (!ready) return yield* fail("Reader adapter did not start");
    return api;
  }).pipe(
    Effect.withSpan("CacheR2.readerAdapter"),
    CacheCommandError.mapError("Reader adapter did not start."),
    Effect.provide(live.platform)
  );

const makeWriteReceipt = (live: Live) =>
  Effect.fn("CacheR2.writeReceipt")(function* (receipt: CacheR2ProbeReceipt) {
    const text = yield* encodeReceipt(receipt);
    const file = live.path.join(live.out, `${receipt.mode}-proof.json`);
    yield* live.fs.writeFileString(file, `${text}\n`);
    yield* live.fs.chmod(file, 0o600);
  }, CacheCommandError.mapError("Cannot write the qualification receipt."));

/**
 * Live probe side effects for a checkout root.
 *
 * **Details**
 * Requests carry the bearer and `x-artifact-duration: 1` with a 90-second
 * bound. Tasks run `bun run --bun turbo run <task> --summarize` with vault and
 * storage variables (`OP_*`, `R2_*`, `CLOUDFLARE_*`) removed and their output
 * captured only in a private log under `.beep/r2-cache`. The reader adapter is
 * `infra/r2-cache/adapter.sh serve` with the read-only storage grant on an
 * ephemeral loopback port.
 *
 * **Example** (Compose the live probe environment)
 * ```ts
 * import { CacheR2ProbeTarget, layerCacheR2ProbeIo } from "@beep/repo-cli/test/Cache"
 * import * as Layer from "effect/Layer"
 * const layer = layerCacheR2ProbeIo(
 *   CacheR2ProbeTarget.make({ root: "/repo", api: "http://127.0.0.1:9427", token: "t", team: "team_x" })
 * )
 * console.assert(Layer.isLayer(layer))
 * ```
 *
 * @internal
 * @param target - Checkout root and the resolved Turbo API, token and team.
 * @returns The live probe layer.
 * @category layers
 * @since 0.0.0
 */
export const layerCacheR2ProbeIo = (target: CacheR2ProbeTarget) =>
  Layer.effect(
    CacheR2ProbeIo,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const client = yield* HttpClient.HttpClient;
      const platform = yield* Effect.context<Platform>();
      const out = path.join(target.root, ".beep/r2-cache");
      yield* fs.makeDirectory(out, { recursive: true });
      const environment = definedEnvironment(process.env);
      const runs = path.join(target.root, ".turbo/runs");
      const live: Live = { target, fs, path, client, out, runs, environment, platform };
      return CacheR2ProbeIo.of({
        request: makeRequest(live),
        task: makeTask(live),
        readerAdapter: readerAdapter(live),
        writeReceipt: makeWriteReceipt(live),
        r2Active: O.contains(R.get(environment, "BEEP_CI_TURBO_R2_ACTIVE"), "true"),
      });
    })
  );
