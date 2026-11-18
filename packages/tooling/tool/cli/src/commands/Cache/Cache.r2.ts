/**
 * Bounded R2 cache qualification probe.
 *
 * **Details**
 * Ported from the retired `infra/r2-cache/probe.py` (exact-hash qualification
 * over the loopback API). Receipts exclude environment values. The live side
 * effects are in `Cache.r2.live.ts`; fleet enrollment is in
 * `Cache.r2.fleet.ts`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { JsonStringCodec } from "@beep/repo-cli-kit/schema/JsonCodec";
import { Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Hex from "effect/encoding/Hex";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CacheCommandError } from "./Cache.errors.ts";
import {
  CacheR2PayloadRow,
  CacheR2ProbeMode,
  CacheR2ProbeReceipt,
  CacheR2Request,
  CacheR2StoredReceipt,
  CacheR2TaskCache,
  CacheR2TaskExecution,
} from "./Cache.r2.schemas.ts";
import type * as Scope from "effect/Scope";
import type { CacheR2Marker, CacheR2Response, CacheR2TaskRow } from "./Cache.r2.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.r2");

const PAYLOAD_SIZES = [5_740_000, 11_350_000] as const;
const hashHex = S.decodeEffect(Sha256HexFromBytes);
const encoder = new TextEncoder();
const fail = (message: string) => Effect.fail(CacheCommandError.new(message));
const decodeDuration = S.decodeOption(S.NumberFromString.pipe(S.check(S.isInt())));

/**
 * R2 qualification probe side effects.
 *
 * **Details**
 * The live layer (`layerCacheR2ProbeIo`) talks to the resolved Turbo artifact
 * API, runs native Turbo tasks with summaries, starts a reader adapter through
 * `adapter.sh serve`, and writes the private receipt. Tests supply an
 * in-memory artifact store.
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
export class CacheR2ProbeIo extends Context.Service<
  CacheR2ProbeIo,
  {
    readonly request: (request: CacheR2Request) => Effect.Effect<CacheR2Response, CacheCommandError>;
    readonly task: (name: string, label: string, mode: string) => Effect.Effect<CacheR2TaskRow, CacheCommandError>;
    readonly readerAdapter: Effect.Effect<string, CacheCommandError, Scope.Scope>;
    readonly writeReceipt: (receipt: CacheR2ProbeReceipt) => Effect.Effect<void, CacheCommandError>;
    readonly r2Active: boolean;
  }
>()($I`CacheR2ProbeIo`) {}

type Io = CacheR2ProbeIo["Service"];

/**
 * Deterministic synthetic payload for one marker and label.
 *
 * **Details**
 * The SHA-256 digest of `marker + label` repeated and truncated to `size`
 * bytes, exactly as the retired Python probe built it, so payloads written by
 * either implementation verify against the other's receipt.
 *
 * **Example** (Plan a small fixture)
 * ```ts
 * import { cacheR2ProbeFixture } from "@beep/repo-cli/test/Cache"
 * const plan = cacheR2ProbeFixture({ marker: "0123456789abcdef", label: "workstation", size: 40 })
 * console.assert(typeof plan === "object")
 * ```
 *
 * @internal
 * @param options - Marker, label and byte size.
 * @returns The payload bytes.
 * @category workflows
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

const decodeStored = JsonStringCodec(CacheR2StoredReceipt).decode;
const encodeStored = JsonStringCodec(CacheR2StoredReceipt).encode;

const put = (io: Io, key: string, body: Uint8Array, api: O.Option<string> = O.none()) =>
  io.request(
    CacheR2Request.make(
      O.match(api, {
        onNone: () => ({ key, method: "PUT" as const, body }),
        onSome: (value) => ({ key, method: "PUT" as const, body, api: value }),
      })
    )
  );

const get = (io: Io, key: string, method: "GET" | "HEAD" = "GET") => io.request(CacheR2Request.make({ key, method }));

const writePayloads = Effect.fnUntraced(function* (io: Io, marker: string, label: string) {
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

const checkPayloads = Effect.fnUntraced(function* (io: Io, rows: ReadonlyArray<CacheR2PayloadRow> | undefined) {
  yield* Effect.forEach(
    O.getOrElse(O.fromUndefinedOr(rows), A.empty),
    Effect.fnUntraced(function* (row) {
      const response = yield* get(io, row.hash);
      const sha256 = yield* hashHex(response.body);
      if (response.status !== 200 || response.body.length !== row.bytes || sha256 !== row.sha256)
        return yield* fail("Payload integrity mismatch");
    }),
    { concurrency: 1, discard: true }
  );
});

const readStored = Effect.fnUntraced(function* (io: Io, marker: string, missing: string) {
  const stored = yield* get(io, marker);
  if (stored.status !== 200) return yield* fail(missing);
  return yield* decodeStored(new TextDecoder().decode(stored.body)).pipe(
    CacheCommandError.mapError("Stored probe receipt differs from its schema.")
  );
});

const storeReceipt = Effect.fnUntraced(function* (
  io: Io,
  marker: string,
  receipt: CacheR2ProbeReceipt,
  message: string
) {
  const text = yield* encodeStored(CacheR2StoredReceipt.make(receipt)).pipe(CacheCommandError.mapError(message));
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
type Draft = Ref.Ref<CacheR2ProbeReceipt>;

const amendAndGet = (draft: Draft, fields: Partial<ReceiptFields>) =>
  Ref.updateAndGet(draft, (current) => CacheR2ProbeReceipt.make({ ...current, ...fields }));

const amend = (draft: Draft, fields: Partial<ReceiptFields>) => Effect.asVoid(amendAndGet(draft, fields));

const seedMode = Effect.fnUntraced(function* (io: Io, marker: string, draft: Draft) {
  const producer = yield* io.task("lint:effect-imports", "seed", "remote:w");
  yield* amend(draft, { producer });
  if (producer.cache.status !== "MISS") return yield* fail("Seed did not execute freshly");
  const payloads = yield* writePayloads(io, marker, "workstation");
  const receipt = yield* amendAndGet(draft, { payloads, status: "success" });
  yield* storeReceipt(io, marker, receipt, "Seed receipt upload failed");
});

const restoreSeedHash = Effect.fnUntraced(function* (io: Io, marker: string, draft: Draft) {
  if (!io.r2Active) return yield* fail("R2 adapter is not active; refusing an AWS-cache false positive");
  const seed = yield* readStored(io, marker, "Workstation seed receipt missing");
  yield* checkPayloads(io, seed.payloads);
  const seedProducer = yield* O.fromUndefinedOr(seed.producer).pipe(
    Effect.fromOption(() => CacheCommandError.new("Workstation seed receipt omitted its producer"))
  );
  const consumer = yield* io.task("lint:effect-imports", "ci-consumer", "remote:r");
  yield* amend(draft, { consumer });
  if (consumer.hash !== seedProducer.hash || consumer.cache.remote !== true)
    return yield* fail("CI did not restore the exact workstation hash");
  return seedProducer.hash;
});

const uploadedDuration = (producer: CacheR2TaskRow, head: CacheR2Response) => {
  const duration = pipe(headerValue(head.headers, "x-artifact-duration"), O.map(Str.trim), O.flatMap(decodeDuration));
  const elapsed = (producer.execution.endTime ?? Number.NaN) - (producer.execution.startTime ?? Number.NaN);
  return head.status === 200 ? O.filter(duration, (value) => Math.abs(elapsed - value) <= 1000) : O.none();
};

const produceFresh = Effect.fnUntraced(function* (io: Io, marker: string, draft: Draft) {
  const producer = yield* io.task("lint:effect-imports-markdown", "ci-producer", "remote:w");
  yield* amend(draft, { producer });
  if (producer.cache.status !== "MISS") return yield* fail("CI producer did not execute freshly");
  const head = yield* get(io, producer.hash, "HEAD");
  const duration = yield* uploadedDuration(producer, head).pipe(
    Effect.fromOption(() => CacheCommandError.new("Fresh CI upload duration was not retained"))
  );
  const payloads = yield* writePayloads(io, marker, "aws-ci");
  yield* amend(draft, { uploaded_duration_ms: duration, payloads });
});

const proveReaderDenied = Effect.fnUntraced(function* (io: Io, marker: string, seedHash: string, draft: Draft) {
  const api = yield* io.readerAdapter;
  const existing = yield* io.request(CacheR2Request.make({ key: seedHash, method: "GET", api }));
  if (existing.status !== 200) return yield* fail("Reader credential cannot read existing artifacts");
  const deniedDigest = yield* hashHex(encoder.encode(`${marker}denied`));
  const deniedKey = Str.slice(0, 16)(deniedDigest);
  const denied = yield* put(io, deniedKey, encoder.encode("reader-must-not-write"), O.some(api));
  const absent = yield* get(io, deniedKey, "HEAD");
  if ((denied.status >= 200 && denied.status < 300) || absent.status !== 404)
    return yield* fail("Reader credential wrote an artifact");
  yield* amend(draft, { reader_write_rejected: true });
});

const ciMode = Effect.fnUntraced(function* (io: Io, marker: string, draft: Draft) {
  const seedHash = yield* restoreSeedHash(io, marker, draft);
  yield* produceFresh(io, marker, draft);
  yield* Effect.scoped(proveReaderDenied(io, marker, seedHash, draft));
  const receipt = yield* amendAndGet(draft, { status: "success" });
  yield* storeReceipt(io, marker, receipt, "CI receipt upload failed");
});

const restoreMode = Effect.fnUntraced(function* (io: Io, marker: string, draft: Draft) {
  const ci = yield* readStored(io, marker, "CI receipt missing");
  if (ci.mode !== "ci" || ci.status !== "success" || ci.reader_write_rejected !== true)
    return yield* fail("CI credential proof incomplete");
  yield* checkPayloads(io, ci.payloads);
  yield* amend(draft, { ci });
  const consumer = yield* io.task("lint:effect-imports-markdown", "workstation-consumer", "remote:r");
  yield* amend(draft, { consumer });
  const restored =
    consumer.hash === ci.producer?.hash &&
    consumer.cache.remote === true &&
    consumer.cache.timeSaved === ci.uploaded_duration_ms;
  if (!restored) return yield* fail("Workstation did not restore the fresh CI artifact");
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
 * @category workflows
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
const decodeSummary = JsonStringCodec(Summary).decode;
const decodeNamed = S.decodeUnknownOption(SummaryNamed);
const decodeSummaryTask = S.decodeUnknownEffect(SummaryTask);

/**
 * Select one task's row from a Turbo run summary.
 *
 * **Example** (Plan a task-row read)
 * ```ts
 * import { selectCacheR2SummaryTask } from "@beep/repo-cli/test/Cache"
 * const plan = selectCacheR2SummaryTask('{"tasks":[]}', "lint:effect-imports")
 * console.assert(typeof plan === "object")
 * ```
 *
 * @internal
 * @param summaryText - Run summary JSON text.
 * @param name - Task name, for example `lint:effect-imports`.
 * @returns The task's hash, cache facts and execution timing.
 * @category parsing
 * @since 0.0.0
 */
export const selectCacheR2SummaryTask = Effect.fn("CacheR2.selectSummaryTask")(function* (
  summaryText: string,
  name: string
) {
  const summary = yield* decodeSummary(summaryText);
  const row = yield* pipe(
    summary.tasks,
    A.findFirst((task) => O.exists(decodeNamed(task), (named) => named.task === name)),
    Effect.fromOption(() => CacheCommandError.new(`Run summary omitted task ${name}`))
  );
  const task = yield* decodeSummaryTask(row);
  return {
    hash: task.hash,
    cache: task.cache,
    execution: O.getOrElse(O.fromUndefinedOr(task.execution), () => CacheR2TaskExecution.make({})),
  };
}, CacheCommandError.mapError("Cannot read the Turbo run summary."));
