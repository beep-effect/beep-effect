/**
 * Bounded R2 cache qualification probe and fleet enrollment.
 *
 * **Details**
 * Ported from the retired `infra/r2-cache/probe.py` (exact-hash qualification
 * over the loopback API) and `infra/r2-cache/fleet.py` (enroll existing Beep
 * clones and registered worktrees without changing source). Receipts exclude
 * environment values.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Net from "node:net";
import { $RepoCliId } from "@beep/identity/packages";
import { runCapturedStreams } from "@beep/repo-cli-kit/process/index";
import { JsonStringCodec } from "@beep/repo-cli-kit/schema/JsonCodec";
import { Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Hex from "effect/encoding/Hex";
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
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { CacheCommandError } from "./Cache.errors.ts";
import {
  CacheR2FleetReceipt,
  CacheR2FleetRow,
  CacheR2PayloadRow,
  CacheR2ProbeMode,
  CacheR2ProbeReceipt,
  CacheR2StoredReceipt,
  CacheR2TaskCache,
  CacheR2TaskExecution,
  CacheR2TaskRow,
} from "./Cache.r2.schemas.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type * as Scope from "effect/Scope";
import type { CacheR2Marker } from "./Cache.r2.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.r2");

const PAYLOAD_SIZES = [5_740_000, 11_350_000] as const;
const hashHex = S.decodeEffect(Sha256HexFromBytes);
const encoder = new TextEncoder();
const fail = (message: string) => Effect.fail(CacheCommandError.new(message));

/**
 * One loopback Turbo artifact API response.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface CacheR2Response {
  readonly body: Uint8Array;
  readonly elapsedSeconds: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly status: number;
}

/**
 * One artifact API request issued by the probe.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface CacheR2Request {
  readonly api?: string;
  readonly body?: Uint8Array;
  readonly key: string;
  readonly method: "GET" | "PUT" | "HEAD";
}

/**
 * Side effects of the R2 qualification probe.
 *
 * **Details**
 * The live layer talks to the resolved Turbo artifact API, runs native Turbo
 * tasks with summaries, starts a reader adapter through `adapter.sh serve`, and
 * writes the private receipt. Tests supply an in-memory artifact store.
 *
 * @internal
 * @category services
 * @since 0.0.0
 */
export interface CacheR2ProbeIoShape {
  readonly r2Active: boolean;
  readonly readerAdapter: Effect.Effect<string, CacheCommandError, Scope.Scope>;
  readonly request: (request: CacheR2Request) => Effect.Effect<CacheR2Response, CacheCommandError>;
  readonly task: (name: string, label: string, mode: string) => Effect.Effect<CacheR2TaskRow, CacheCommandError>;
  readonly writeReceipt: (receipt: CacheR2ProbeReceipt) => Effect.Effect<void, CacheCommandError>;
}

/**
 * R2 qualification probe side effects.
 *
 * **Example** (Provide an inert probe environment)
 * ```ts
 * import { CacheCommandError } from "@beep/repo-cli/commands/Cache"
 * import { CacheR2ProbeIo } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const refuse = Effect.fail(CacheCommandError.new("offline"))
 * const inert = Layer.succeed(CacheR2ProbeIo, {
 *   request: () => refuse,
 *   task: () => refuse,
 *   readerAdapter: refuse,
 *   writeReceipt: () => Effect.void,
 *   r2Active: false
 * })
 * console.assert(Layer.isLayer(inert))
 * ```
 *
 * @internal
 * @category services
 * @since 0.0.0
 */
export class CacheR2ProbeIo extends Context.Service<CacheR2ProbeIo, CacheR2ProbeIoShape>()($I`CacheR2ProbeIo`) {}

/**
 * Deterministic synthetic payload for one marker and label.
 *
 * **Details**
 * The SHA-256 digest of `marker + label` repeated and truncated to `size`
 * bytes, exactly as the retired Python probe built it, so payloads written by
 * either implementation verify against the other's receipt.
 *
 * **Example** (Build a small fixture)
 * ```ts
 * import { cacheR2ProbeFixture } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * const bytes = Effect.runSync(cacheR2ProbeFixture({ marker: "0123456789abcdef", label: "workstation", size: 40 }))
 * console.assert(bytes.length === 40)
 * ```
 *
 * @internal
 * @param options - Marker, label and byte size.
 * @returns The payload bytes.
 * @category qualification
 * @since 0.0.0
 */
export const cacheR2ProbeFixture = Effect.fn("CacheR2.fixture")(function* (options: {
  readonly marker: string;
  readonly label: string;
  readonly size: number;
}) {
  const digest = yield* hashHex(encoder.encode(`${options.marker}${options.label}`));
  const seed = yield* Effect.fromResult(Hex.decode(digest)).pipe(Effect.orDie);
  const out = new Uint8Array(options.size);
  out.set(seed.subarray(0, Math.min(seed.length, options.size)));
  let filled = Math.min(seed.length, options.size);
  // Doubling copy of the repeated digest; equal to Python's (seed * n)[:size].
  while (filled < options.size) {
    const span = Math.min(filled, options.size - filled);
    out.copyWithin(filled, 0, span);
    filled += span;
  }
  return out;
});

const PythonEscaped = HashSet.make("!", "'", "(", ")", "*");

/**
 * Percent-encode one query value like Python's `quote(value, safe="")`.
 *
 * @internal
 * @param value - Raw query value.
 * @returns The encoded value.
 * @category qualification
 * @since 0.0.0
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

const decodeStored = JsonStringCodec(CacheR2StoredReceipt).decode;
const encodeStored = JsonStringCodec(CacheR2StoredReceipt).encode;

const put = Effect.fnUntraced(function* (io: CacheR2ProbeIoShape, key: string, body: Uint8Array, api?: string) {
  return yield* io.request(api === undefined ? { key, method: "PUT", body } : { key, method: "PUT", body, api });
});

const writePayloads = Effect.fnUntraced(function* (io: CacheR2ProbeIoShape, marker: string, label: string) {
  return yield* Effect.forEach(
    PAYLOAD_SIZES,
    Effect.fnUntraced(function* (size) {
      const body = yield* cacheR2ProbeFixture({ marker, label, size });
      const sha256 = yield* hashHex(body);
      const key = Str.slice(0, 16)(sha256);
      const response = yield* put(io, key, body);
      if (response.status !== 201) return yield* fail(`Payload upload rejected: ${response.status}`);
      return CacheR2PayloadRow.make({ hash: key, bytes: size, sha256, upload_s: response.elapsedSeconds });
    }),
    { concurrency: 1 }
  );
});

const checkPayloads = Effect.fnUntraced(function* (io: CacheR2ProbeIoShape, rows: ReadonlyArray<CacheR2PayloadRow>) {
  yield* Effect.forEach(
    rows,
    Effect.fnUntraced(function* (row) {
      const response = yield* io.request({ key: row.hash, method: "GET" });
      const sha256 = yield* hashHex(response.body);
      if (response.status !== 200 || response.body.length !== row.bytes || sha256 !== row.sha256)
        return yield* fail("Payload integrity mismatch");
    }),
    { concurrency: 1, discard: true }
  );
});

const readStored = Effect.fnUntraced(function* (body: Uint8Array) {
  return yield* decodeStored(new TextDecoder().decode(body)).pipe(
    CacheCommandError.mapError("Stored probe receipt differs from its schema.")
  );
});

const storeReceipt = Effect.fnUntraced(function* (
  io: CacheR2ProbeIoShape,
  marker: string,
  receipt: CacheR2StoredReceipt,
  message: string
) {
  const text = yield* encodeStored(receipt).pipe(CacheCommandError.mapError(message));
  const response = yield* put(io, marker, encoder.encode(text));
  if (response.status !== 201) return yield* fail(message);
});

const headerValue = (headers: Readonly<Record<string, string>>, name: string) =>
  pipe(
    R.toEntries(headers),
    A.findFirst(([key]) => Str.toLowerCase(key) === name),
    O.map(([, value]) => value)
  );

const failureText = <E>(cause: Cause.Cause<E>) =>
  pipe(
    Cause.findErrorOption(cause),
    O.filter(S.is(CacheCommandError)),
    O.map((error) => error.message),
    O.getOrElse(() => "Qualification probe failed")
  );

type ReceiptFields = Parameters<typeof CacheR2ProbeReceipt.make>[0];

const amendAndGet = (draft: Ref.Ref<CacheR2ProbeReceipt>, fields: Partial<ReceiptFields>) =>
  Ref.updateAndGet(draft, (current) => CacheR2ProbeReceipt.make({ ...current, ...fields }));

const amend = (draft: Ref.Ref<CacheR2ProbeReceipt>, fields: Partial<ReceiptFields>) =>
  Effect.asVoid(amendAndGet(draft, fields));

const seedMode = Effect.fnUntraced(function* (
  io: CacheR2ProbeIoShape,
  marker: string,
  draft: Ref.Ref<CacheR2ProbeReceipt>
) {
  const producer = yield* io.task("lint:effect-imports", "seed", "remote:w");
  yield* amend(draft, { producer });
  if (producer.cache.status !== "MISS") return yield* fail("Seed did not execute freshly");
  const payloads = yield* writePayloads(io, marker, "workstation");
  const receipt = yield* amendAndGet(draft, { payloads, status: "success" });
  yield* storeReceipt(io, marker, CacheR2StoredReceipt.make(receipt), "Seed receipt upload failed");
});

const ciMode = Effect.fnUntraced(function* (
  io: CacheR2ProbeIoShape,
  marker: string,
  draft: Ref.Ref<CacheR2ProbeReceipt>
) {
  if (!io.r2Active) return yield* fail("R2 adapter is not active; refusing an AWS-cache false positive");
  const stored = yield* io.request({ key: marker, method: "GET" });
  if (stored.status !== 200) return yield* fail("Workstation seed receipt missing");
  const seed = yield* readStored(stored.body);
  yield* checkPayloads(io, O.getOrElse(O.fromUndefinedOr(seed.payloads), A.empty));
  const seedProducer = yield* O.fromUndefinedOr(seed.producer).pipe(
    Effect.fromOption(() => CacheCommandError.new("Workstation seed receipt omitted its producer"))
  );
  const consumer = yield* io.task("lint:effect-imports", "ci-consumer", "remote:r");
  yield* amend(draft, { consumer });
  if (consumer.hash !== seedProducer.hash || consumer.cache.remote !== true)
    return yield* fail("CI did not restore the exact workstation hash");
  const producer = yield* io.task("lint:effect-imports-markdown", "ci-producer", "remote:w");
  yield* amend(draft, { producer });
  if (producer.cache.status !== "MISS") return yield* fail("CI producer did not execute freshly");
  const head = yield* io.request({ key: producer.hash, method: "HEAD" });
  const duration = pipe(
    headerValue(head.headers, "x-artifact-duration"),
    O.flatMap((value) => S.decodeOption(S.NumberFromString.pipe(S.check(S.isInt())))(Str.trim(value)))
  );
  const elapsed = (producer.execution.endTime ?? Number.NaN) - (producer.execution.startTime ?? Number.NaN);
  if (head.status !== 200 || O.isNone(duration) || !(Math.abs(elapsed - duration.value) <= 1000))
    return yield* fail("Fresh CI upload duration was not retained");
  const payloads = yield* writePayloads(io, marker, "aws-ci");
  yield* amend(draft, { uploaded_duration_ms: duration.value, payloads });
  yield* Effect.scoped(
    Effect.gen(function* () {
      const api = yield* io.readerAdapter;
      const existing = yield* io.request({ key: seedProducer.hash, method: "GET", api });
      if (existing.status !== 200) return yield* fail("Reader credential cannot read existing artifacts");
      const deniedDigest = yield* hashHex(encoder.encode(`${marker}denied`));
      const deniedKey = Str.slice(0, 16)(deniedDigest);
      const denied = yield* put(io, deniedKey, encoder.encode("reader-must-not-write"), api);
      const absent = yield* io.request({ key: deniedKey, method: "HEAD" });
      if ((denied.status >= 200 && denied.status < 300) || absent.status !== 404)
        return yield* fail("Reader credential wrote an artifact");
      yield* amend(draft, { reader_write_rejected: true });
    })
  );
  const receipt = yield* amendAndGet(draft, { status: "success" });
  yield* storeReceipt(io, marker, CacheR2StoredReceipt.make(receipt), "CI receipt upload failed");
});

const restoreMode = Effect.fnUntraced(function* (
  io: CacheR2ProbeIoShape,
  marker: string,
  draft: Ref.Ref<CacheR2ProbeReceipt>
) {
  const stored = yield* io.request({ key: marker, method: "GET" });
  if (stored.status !== 200) return yield* fail("CI receipt missing");
  const ci = yield* readStored(stored.body);
  if (ci.mode !== "ci" || ci.status !== "success" || ci.reader_write_rejected !== true)
    return yield* fail("CI credential proof incomplete");
  yield* checkPayloads(io, O.getOrElse(O.fromUndefinedOr(ci.payloads), A.empty));
  yield* amend(draft, { ci });
  const consumer = yield* io.task("lint:effect-imports-markdown", "workstation-consumer", "remote:r");
  yield* amend(draft, { consumer });
  if (
    consumer.hash !== ci.producer?.hash ||
    consumer.cache.remote !== true ||
    consumer.cache.timeSaved !== ci.uploaded_duration_ms
  )
    return yield* fail("Workstation did not restore the fresh CI artifact");
});

/**
 * Run one bounded R2 qualification mode and write its sanitized receipt.
 *
 * **Details**
 * `seed` runs on the owner workstation: a fresh writer-only task plus two
 * large payloads, then the seed receipt under the marker key. `ci` runs in the
 * protected Cache Warm probe: it restores the workstation hash, uploads a fresh
 * task with its duration metadata, and proves the reader credential cannot
 * write. `restore` runs back on the workstation and requires the CI hash,
 * duration and payloads. The receipt is written to
 * `.beep/r2-cache/<mode>-proof.json` (mode 0600) whether the mode succeeds or
 * fails.
 *
 * **Example** (Plan the CI qualification)
 * ```ts
 * import { runCacheR2Probe } from "@beep/repo-cli/test/Cache"
 * const plan = runCacheR2Probe("ci", "0123456789abcdef")
 * console.assert(typeof plan === "object")
 * ```
 *
 * @internal
 * @param mode - Probe mode.
 * @param marker - Sixteen-hex marker shared by the three modes.
 * @returns The successful receipt.
 * @category qualification
 * @since 0.0.0
 */
export const runCacheR2Probe = Effect.fn("CacheR2.probe")(function* (mode: CacheR2ProbeMode, marker: CacheR2Marker) {
  const io = yield* CacheR2ProbeIo;
  const draft = yield* Ref.make(CacheR2ProbeReceipt.make({ mode, marker, status: "running" }));
  const exit = yield* CacheR2ProbeMode.match(mode, {
    seed: () => seedMode(io, marker, draft),
    ci: () => ciMode(io, marker, draft),
    restore: () => restoreMode(io, marker, draft),
  }).pipe(Effect.exit);
  const receipt = yield* amendAndGet(
    draft,
    Exit.isSuccess(exit) ? { status: "success" } : { status: "failed", failure: failureText(exit.cause) }
  );
  yield* io.writeReceipt(receipt);
  yield* exit;
  return receipt;
});

/**
 * Turbo run-summary task row fields read by the probe.
 */
const SummaryTask = S.Struct({
  task: S.String,
  hash: S.String,
  cache: CacheR2TaskCache,
  execution: S.optionalKey(CacheR2TaskExecution),
}).pipe($I.annoteSchema("SummaryTask", { description: "The task row of a Turbo --summarize run summary." }));
const SummaryNamed = S.Struct({ task: S.String }).pipe(
  $I.annoteSchema("SummaryNamed", { description: "Any summary row naming its task." })
);
const Summary = S.Struct({ tasks: S.Array(S.Unknown) }).pipe(
  $I.annoteSchema("Summary", { description: "A Turbo --summarize run summary." })
);

/**
 * Select one task's row from a Turbo run summary.
 *
 * **Example** (Read a task row)
 * ```ts
 * import { selectCacheR2SummaryTask } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof selectCacheR2SummaryTask === "function")
 * ```
 *
 * @internal
 * @param summaryText - Run summary JSON text.
 * @param name - Task name, for example `lint:effect-imports`.
 * @returns The task's hash, cache facts and execution timing.
 * @category qualification
 * @since 0.0.0
 */
export const selectCacheR2SummaryTask = Effect.fn("CacheR2.selectSummaryTask")(function* (
  summaryText: string,
  name: string
) {
  const summary = yield* JsonStringCodec(Summary).decode(summaryText);
  const row = yield* pipe(
    summary.tasks,
    A.findFirst((task) => O.exists(S.decodeUnknownOption(SummaryNamed)(task), (named) => named.task === name)),
    Effect.fromOption(() => CacheCommandError.new(`Run summary omitted task ${name}`))
  );
  const task = yield* S.decodeUnknownEffect(SummaryTask)(row);
  return {
    hash: task.hash,
    cache: task.cache,
    execution: O.getOrElse(O.fromUndefinedOr(task.execution), () => CacheR2TaskExecution.make({})),
  };
}, CacheCommandError.mapError("Cannot read the Turbo run summary."));

const SCRUBBED_PREFIXES = ["OP_", "R2_", "CLOUDFLARE_"];

const definedEnvironment = (environment: NodeJS.ProcessEnv) =>
  R.filterMap(environment, (value) => (value === undefined ? Result.failVoid : Result.succeed(value)));

/**
 * Turbo artifact tuple resolved by the caller.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface CacheR2TurboTuple {
  readonly api: string;
  readonly team: string;
  readonly token: string;
}

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
 * import { layerCacheR2ProbeIo } from "@beep/repo-cli/test/Cache"
 * import * as Layer from "effect/Layer"
 * const layer = layerCacheR2ProbeIo({
 *   root: "/repo",
 *   tuple: { api: "http://127.0.0.1:9427", token: "t", team: "team_x" }
 * })
 * console.assert(Layer.isLayer(layer))
 * ```
 *
 * @internal
 * @param options - Repository checkout root and the resolved Turbo API, token and team.
 * @returns The live probe layer.
 * @category layers
 * @since 0.0.0
 */
export const layerCacheR2ProbeIo = ({ root, tuple }: { readonly root: string; readonly tuple: CacheR2TurboTuple }) =>
  Layer.effect(
    CacheR2ProbeIo,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const client = yield* HttpClient.HttpClient;
      const platform = yield* Effect.context<
        FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom | Digest.Digest
      >();
      const out = path.join(root, ".beep/r2-cache");
      const runs = path.join(root, ".turbo/runs");
      yield* fs.makeDirectory(out, { recursive: true });
      const environment = definedEnvironment(process.env);

      const request = Effect.fn("CacheR2.request")(
        function* (request: CacheR2Request) {
          const url = `${request.api ?? tuple.api}/v8/artifacts/${request.key}?teamId=${quote(tuple.team)}`;
          const base = HttpClientRequest.make(request.method)(url).pipe(
            HttpClientRequest.setHeaders({ Authorization: `Bearer ${tuple.token}`, "x-artifact-duration": "1" })
          );
          const prepared =
            request.body === undefined
              ? base
              : HttpClientRequest.bodyUint8Array(base, request.body, "application/octet-stream");
          const started = yield* Clock.currentTimeMillis;
          const response = yield* client.execute(prepared);
          const buffer = request.method === "HEAD" ? new ArrayBuffer(0) : yield* response.arrayBuffer;
          const body = new Uint8Array(buffer);
          const finished = yield* Clock.currentTimeMillis;
          return {
            status: response.status,
            body,
            headers: response.headers,
            elapsedSeconds: (finished - started) / 1000,
          } satisfies CacheR2Response;
        },
        Effect.timeout(Duration.seconds(90)),
        CacheCommandError.mapError("Turbo artifact request failed.")
      );

      const summaries = fs
        .readDirectory(runs)
        .pipe(Effect.orElseSucceed(A.empty<string>), Effect.map(A.filter(Str.endsWith(".json"))));

      const task = Effect.fn("CacheR2.task")(
        function* (name: string, label: string, mode: string) {
          const existing = yield* summaries;
          const before = HashSet.fromIterable(existing);
          const started = yield* Clock.currentTimeMillis;
          const nanos = yield* Clock.currentTimeNanos;
          const cacheDir = path.join(out, `local-${label}-${nanos}`);
          const env = {
            ...R.filter(environment, (_, key) => !A.some(SCRUBBED_PREFIXES, (prefix) => Str.startsWith(prefix)(key))),
            TURBO_CACHE: mode,
          };
          const exitCode = yield* Effect.scoped(
            Effect.gen(function* () {
              const handle = yield* ChildProcess.make(
                "bun",
                [
                  "run",
                  "--bun",
                  "turbo",
                  "run",
                  name,
                  `--cache=${mode}`,
                  `--cache-dir=${cacheDir}`,
                  "--summarize",
                  "--output-logs=errors-only",
                ],
                { cwd: root, extendEnv: false, env, stdin: "ignore", stdout: "pipe", stderr: "pipe" }
              );
              yield* Stream.run(handle.all, fs.sink(path.join(out, `${label}.private.log`), { mode: 0o600 }));
              return yield* handle.exitCode;
            })
          ).pipe(Effect.timeout(Duration.minutes(10)));
          const after = yield* summaries;
          const created = A.filter(after, (file) => !HashSet.has(before, file));
          if (exitCode !== 0 || A.isReadonlyArrayEmpty(created))
            return yield* fail(`Qualification task failed: ${label}`);
          const dated = yield* Effect.forEach(
            created,
            (file) =>
              fs.stat(path.join(runs, file)).pipe(
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
          const newest = pipe(
            A.sort(
              dated,
              Order.mapInput(Order.Number, ([, mtime]: readonly [string, number]) => mtime)
            ),
            A.last,
            O.map(([file]) => file)
          );
          const file = yield* newest.pipe(
            Effect.fromOption(() => CacheCommandError.new(`Qualification task failed: ${label}`))
          );
          const summaryText = yield* fs.readFileString(path.join(runs, file));
          const row = yield* selectCacheR2SummaryTask(summaryText, name);
          const finished = yield* Clock.currentTimeMillis;
          return CacheR2TaskRow.make({ task: name, ...row, elapsed_s: (finished - started) / 1000, mode });
        },
        CacheCommandError.mapError("Qualification task failed."),
        Effect.provide(platform)
      );

      const readerAdapter = Effect.gen(function* () {
        const port = yield* reserveLoopbackPort;
        const readerKey = yield* R.get(environment, "R2_READ_ACCESS_KEY_ID").pipe(
          Effect.fromOption(() => CacheCommandError.new("R2_READ_ACCESS_KEY_ID is required for the reader proof"))
        );
        const readerSecret = yield* R.get(environment, "R2_READ_SECRET_ACCESS_KEY").pipe(
          Effect.fromOption(() => CacheCommandError.new("R2_READ_SECRET_ACCESS_KEY is required for the reader proof"))
        );
        const handle = yield* ChildProcess.make(path.join(root, "infra/r2-cache/adapter.sh"), ["serve"], {
          cwd: root,
          extendEnv: false,
          env: {
            ...environment,
            R2_ACCESS_KEY_ID: readerKey,
            R2_SECRET_ACCESS_KEY: readerSecret,
            R2_ADAPTER_PORT: `${port}`,
          },
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
          forceKillAfter: Duration.seconds(5),
        });
        yield* Stream.run(handle.all, fs.sink(path.join(out, "reader.private.log"), { mode: 0o600 })).pipe(
          Effect.ignore,
          Effect.forkScoped
        );
        const api = `http://127.0.0.1:${port}`;
        const health = client
          .execute(
            HttpClientRequest.get(`${api}/management/health`).pipe(
              HttpClientRequest.setHeader("Authorization", `Bearer ${tuple.token}`)
            )
          )
          .pipe(
            Effect.map((response) => response.status === 200),
            Effect.timeout(Duration.seconds(1)),
            Effect.orElseSucceed(() => false),
            Effect.tap((ready) => (ready ? Effect.void : Effect.sleep(Duration.millis(100))))
          );
        const ready = yield* health.pipe(Effect.repeat({ times: 99, until: (ready: boolean) => ready }));
        if (!ready) return yield* fail("Reader adapter did not start");
        // The scoped handle terminates the adapter, then kills it after five seconds.
        return api;
      }).pipe(CacheCommandError.mapError("Reader adapter did not start."), Effect.provide(platform));

      const writeReceipt = Effect.fn("CacheR2.writeReceipt")(function* (receipt: CacheR2ProbeReceipt) {
        const text = yield* S.encodeEffect(S.fromJsonString(CacheR2ProbeReceipt, { space: 2 }))(receipt);
        const target = path.join(out, `${receipt.mode}-proof.json`);
        yield* fs.writeFileString(target, `${text}\n`);
        yield* fs.chmod(target, 0o600);
      }, CacheCommandError.mapError("Cannot write the qualification receipt."));

      return CacheR2ProbeIo.of({
        request,
        task,
        readerAdapter,
        writeReceipt,
        r2Active: O.contains(R.get(environment, "BEEP_CI_TURBO_R2_ACTIVE"), "true"),
      });
    })
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

// --- Fleet enrollment (ported from infra/r2-cache/fleet.py) ---

const CanonicalOrigin = /^(?:https:\/\/github\.com\/|git@github\.com:)beep-effect\/beep-effect(?:\.git)?$/;
const POLICY_FILES = [
  "packages/tooling/library/repo-cli-kit/src/cli/TurboCache.ts",
  // The policy moved to @beep/repo-cli-kit in beep-cli-composition W3; older checkouts keep it in repo-cli.
  "packages/tooling/tool/cli/src/internal/cli/TurboCache.ts",
];

const git = Effect.fnUntraced(function* (root: string, ...words: ReadonlyArray<string>) {
  const result = yield* runCapturedStreams({ command: "git", args: ["-C", root, ...words] }).pipe(
    Effect.orElseSucceed(() => ({ exitCode: 1, stdout: "", stderr: "", truncated: false }))
  );
  return result.exitCode === 0 ? Str.trim(result.stdout) : "";
});

const PathOrder = Order.mapInput(A.makeOrder(Str.Order), (path: string) => Str.split(path, "/"));

/**
 * Inventory or enroll existing Beep clones and registered worktrees.
 *
 * **Details**
 * Each root is a clone or a parent of `beep-effect*` clones. Only clones whose
 * origin is the canonical public repository count; their registered worktrees
 * are listed. A checkout whose cache resolver supports trusted writes is
 * planned read/write, an older one read-only, and one without the resolver is
 * reported as `legacy-use-beep-turbo`. With `apply`, supported checkouts are
 * enrolled through `workstation.sh enable`; enrollment output is not retained.
 * The default is a read-only plan.
 *
 * **Example** (Plan enrollment for a projects directory)
 * ```ts
 * import { runCacheR2Fleet } from "@beep/repo-cli/test/Cache"
 * import * as O from "effect/Option"
 * const plan = runCacheR2Fleet({
 *   roots: ["/home/me/projects"],
 *   apply: false,
 *   output: O.none(),
 *   workstation: "/repo/infra/r2-cache/workstation.sh"
 * })
 * console.assert(typeof plan === "object")
 * ```
 *
 * @internal
 * @param options - Roots, apply flag, optional receipt path and the enrollment script.
 * @returns The receipt and the printed summary lines.
 * @category fleet
 * @since 0.0.0
 */
export const runCacheR2Fleet = Effect.fn("CacheR2.fleet")(function* (options: {
  readonly roots: ReadonlyArray<string>;
  readonly apply: boolean;
  readonly output: O.Option<string>;
  readonly workstation: string;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const isGitCheckout = (candidate: string) => fs.exists(path.join(candidate, ".git"));
  const clones = yield* Effect.forEach(
    options.roots,
    Effect.fnUntraced(function* (root) {
      if (yield* isGitCheckout(root)) return [yield* fs.realPath(root)];
      const info = yield* fs.stat(root).pipe(Effect.option);
      if (!O.exists(info, (stat) => stat.type === "Directory")) return A.empty<string>();
      const children = yield* fs.readDirectory(root);
      const entries = A.filter(children, Str.startsWith("beep-effect"));
      const candidates = A.map(entries, (entry) => path.join(root, entry));
      const checkouts = yield* Effect.filter(candidates, isGitCheckout);
      return yield* Effect.forEach(checkouts, fs.realPath, { concurrency: 1 });
    }),
    { concurrency: 1 }
  ).pipe(Effect.map(A.flatten), Effect.map(A.dedupe));
  const checkouts = yield* Effect.forEach(
    clones,
    Effect.fnUntraced(function* (clone) {
      const origin = yield* git(clone, "remote", "get-url", "origin");
      if (!CanonicalOrigin.test(origin)) return A.empty<string>();
      const porcelain = yield* git(clone, "worktree", "list", "--porcelain");
      const listed = pipe(Str.split(porcelain, "\n"), A.filter(Str.startsWith("worktree ")), A.map(Str.slice(9)));
      const existing = yield* Effect.filter(listed, (checkout) =>
        fs.stat(checkout).pipe(
          Effect.map((info) => info.type === "Directory"),
          Effect.orElseSucceed(() => false)
        )
      );
      return yield* Effect.forEach(existing, fs.realPath, { concurrency: 1 });
    }),
    { concurrency: 1 }
  ).pipe(Effect.map(A.flatten), Effect.map(A.dedupe), Effect.map(A.sort(PathOrder)));
  const rows = yield* Effect.forEach(
    checkouts,
    Effect.fnUntraced(function* (checkout) {
      const policies = yield* Effect.filter(
        A.map(POLICY_FILES, (file) => path.join(checkout, file)),
        (file) =>
          fs.stat(file).pipe(
            Effect.map((info) => info.type === "File"),
            Effect.orElseSucceed(() => false)
          )
      );
      const text = yield* pipe(
        A.head(policies),
        O.match({ onNone: () => Effect.succeed(""), onSome: fs.readFileString })
      );
      const mode = pipe(text, Str.includes("BEEP_TURBO_TRUSTED_WRITER"))
        ? ("local:rw,remote:rw" as const)
        : ("local:rw,remote:r" as const);
      const supported = pipe(text, Str.includes("local:rw,remote:r"));
      const head = yield* git(checkout, "rev-parse", "HEAD");
      const planned = CacheR2FleetRow.make({
        checkout,
        head,
        mode,
        status: supported ? "planned" : "legacy-use-beep-turbo",
      });
      if (!options.apply || !supported) return planned;
      // Enrollment errors describe field names only. Do not retain arbitrary command output.
      const result = yield* runCapturedStreams({
        command: options.workstation,
        args: ["enable", checkout, mode],
      }).pipe(Effect.orElseSucceed(() => ({ exitCode: 127, stdout: "", stderr: "", truncated: false })));
      return CacheR2FleetRow.make({
        ...planned,
        status: result.exitCode === 0 ? "enrolled" : "blocked",
        exit_code: result.exitCode,
      });
    }),
    { concurrency: 1 }
  );
  const now = yield* DateTime.now;
  const recorded = DateTime.formatIso(now);
  const receipt = CacheR2FleetReceipt.make({ recorded_utc: recorded, applied: options.apply, checkouts: rows });
  yield* Effect.forEach(
    O.toArray(options.output),
    Effect.fnUntraced(function* (output) {
      yield* fs.makeDirectory(path.dirname(output), { recursive: true, mode: 0o700 });
      const text = yield* S.encodeEffect(S.fromJsonString(CacheR2FleetReceipt, { space: 2 }))(receipt);
      yield* fs.writeFileString(output, text, { mode: 0o600 });
      yield* fs.chmod(output, 0o600);
    }),
    { discard: true }
  );
  const statuses = A.sort(A.dedupe(A.map(rows, (row) => row.status)), Str.Order);
  const lines = A.appendAll(
    A.map(statuses, (status) => `${status}: ${A.length(A.filter(rows, (row) => row.status === status))}`),
    [`Read-write capable: ${A.length(A.filter(rows, (row) => Str.endsWith(":rw")(row.mode)))}`]
  );
  return { receipt, lines, blocked: A.some(rows, (row) => row.status === "blocked") };
}, CacheCommandError.mapError("Fleet enrollment failed."));
