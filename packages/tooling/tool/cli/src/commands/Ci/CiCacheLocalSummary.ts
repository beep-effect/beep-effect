/**
 * Public digest-and-count projection of a private local cache pilot receipt.
 *
 * **Details**
 *
 * `beep ci cache-local-summary` replaces the retired isolated Python adapter.
 * It never publishes a private receipt: labels are hashed, observations are
 * counted, and every refusal prints one fixed line without paths, field values
 * or payloads.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { CacheClientChannel } from "@beep/repo-configs/cache";
import { Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CiCachePilotComputation } from "./CiCachePilot.schemas.ts";

const REPORT_LIMIT = 16 * 1024 * 1024;

/**
 * The largest encoded public summary, and request file, in bytes.
 *
 * **Example** (Bound a summary)
 *
 * ```ts
 * import { CACHE_LOCAL_SUMMARY_LIMIT } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CACHE_LOCAL_SUMMARY_LIMIT) // 65536
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CACHE_LOCAL_SUMMARY_LIMIT = 64 * 1024;

/**
 * The single line printed to stderr for any refused input.
 *
 * **Example** (Recognize the refusal)
 *
 * ```ts
 * import { CACHE_LOCAL_SUMMARY_REFUSAL } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CACHE_LOCAL_SUMMARY_REFUSAL.startsWith("Local observation")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CACHE_LOCAL_SUMMARY_REFUSAL = "Local observation summary refused invalid or unbounded input.";

const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const decodeJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const SourceRevision = S.String.check(S.isPattern(/^[a-f0-9]{40}$/u));
const isSourceRevision = S.is(SourceRevision);
const isChannel = S.is(CacheClientChannel);
const isComputation = S.is(CiCachePilotComputation);

// Python counts code points and hashes UTF-8, which a lone surrogate cannot encode.
const CheckLabel = S.String.check(
  S.makeFilter((label: string) => {
    const points = A.length(A.fromIterable(label));
    return points > 0 && points <= 1024 && O.isNone(Str.match(/[\uD800-\uDFFF]/u)(label));
  })
);
const Observations = S.Array(S.Unknown).check(S.isMaxLength(1024));
const LocalReceipt = S.Struct({
  schemaVersion: S.Literal("cache-pilot-local/v5"),
  authority: S.Literal("local-observation-only"),
  sourceRevision: S.String,
  channel: S.String,
  key: S.Struct({ computation: S.Unknown }),
  client: S.Struct({
    version: S.String.check(S.isPattern(/^[0-9]+\.[0-9]+\.[0-9]+(?:-canary\.[0-9]+)?$/u)),
    sha256: S.String.check(S.isPattern(/^[a-f0-9]{64}$/u)),
    namespace: S.Literal("team_beep_local_observation_v1"),
  }),
  selection: S.Literal("full"),
  checks: S.Array(S.Struct({ passed: S.Boolean, name: CheckLabel })).check(S.isMinLength(1), S.isMaxLength(1024)),
  runs: Observations,
  mutations: Observations,
  nonExecutions: Observations,
});
const decodeReceipt = S.decodeUnknownEffect(LocalReceipt);
const LocalRequest = S.Struct({ channel: S.Unknown, client: S.Unknown, selection: S.Literal("full") });
const decodeRequest = S.decodeUnknownEffect(LocalRequest);
const ReceiptEnvelope = S.Struct({ client: S.Unknown });
const decodeEnvelope = S.decodeUnknownEffect(ReceiptEnvelope);

const refused = Effect.fail("refused" as const);
// `bytes.decode()` in `json.loads`: strict UTF-8, with a leading BOM dropped.
const decodeUtf8 = (bytes: Uint8Array) =>
  Effect.try({ try: () => decoder.decode(bytes), catch: () => "refused" as const });

/**
 * Project a private local receipt and its request onto the public summary bytes.
 *
 * **Details**
 *
 * Requires the receipt to be a full `cache-pilot-local/v5` local observation
 * of `revision`, `channel` and `computation` whose client equals the
 * request's and uses the local observation namespace. Failed check labels are
 * published only as SHA-256 digests (at most 64, the rest counted), and a
 * fully passing receipt must record runs, mutations and non-executions. The
 * result is the canonical sorted-key JSON line, at most
 * `CACHE_LOCAL_SUMMARY_LIMIT` bytes; any refusal fails with `"refused"`.
 *
 * **Example** (Refuse an unrelated receipt)
 *
 * ```ts
 * import { summarizeCacheLocalObservation } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const bytes = new TextEncoder().encode("{}")
 * const summary = summarizeCacheLocalObservation(bytes, bytes, "a".repeat(40), "stable", "@beep/types#lint")
 * console.log(Effect.isEffect(summary)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const summarizeCacheLocalObservation = Effect.fn("Ci.summarizeCacheLocalObservation")(
  function* (
    reportBytes: Uint8Array,
    requestBytes: Uint8Array,
    revision: string,
    channel: string,
    computation: string
  ) {
    if (!isSourceRevision(revision) || !isChannel(channel) || !isComputation(computation)) return yield* refused;
    const reportText = yield* decodeUtf8(reportBytes);
    const requestText = yield* decodeUtf8(requestBytes);
    const reportJson = yield* decodeJson(reportText);
    const requestJson = yield* decodeJson(requestText);
    const report = yield* decodeReceipt(reportJson);
    const request = yield* decodeRequest(requestJson);
    const rawClients = yield* Effect.all([decodeEnvelope(reportJson), decodeEnvelope(requestJson)]);
    if (
      report.sourceRevision !== revision ||
      report.channel !== channel ||
      request.channel !== channel ||
      report.key.computation !== computation ||
      !Equal.equals(rawClients[0].client, rawClients[1].client)
    )
      return yield* refused;
    const failed = yield* Effect.forEach(
      A.filter(report.checks, (check) => !check.passed),
      (check) => hashBytes(encoder.encode(check.name))
    );
    const counts = {
      checks: A.length(report.checks),
      failedChecks: A.length(failed),
      mutations: A.length(report.mutations),
      nonExecutions: A.length(report.nonExecutions),
      runs: A.length(report.runs),
    };
    if (A.isReadonlyArrayEmpty(failed) && (counts.runs === 0 || counts.mutations === 0 || counts.nonExecutions === 0))
      return yield* refused;
    const receiptSha256 = yield* hashBytes(reportBytes);
    // Keys in sorted order with compact separators, as `json.dumps(sort_keys=True)`;
    // every value is ASCII by construction.
    const json = yield* encodeJson({
      allChecksPassed: A.isReadonlyArrayEmpty(failed),
      authority: "local-observation-only",
      channel,
      client: { sha256: report.client.sha256, version: report.client.version },
      computation,
      counts,
      failedLabelSha256: A.take(failed, 64),
      omittedFailedLabels: Math.max(0, A.length(failed) - 64),
      privateReceipt: { bytes: reportBytes.byteLength, sha256: receiptSha256 },
      qualificationGranted: false,
      schemaVersion: "cache-local-observation-summary/v1",
      sourceRevision: revision,
    });
    const encoded = encoder.encode(`${json}\n`);
    if (encoded.byteLength > CACHE_LOCAL_SUMMARY_LIMIT) return yield* refused;
    return encoded;
  },
  Effect.mapError((): "refused" => "refused")
);

// node:fs is reached through the runtime's builtin registry: the FileSystem
// service cannot open with O_NOFOLLOW | O_NONBLOCK, which keep a symlink or a
// FIFO from being followed or blocking the read.
const nodeFs = (): typeof import("node:fs") => process.getBuiltinModule("node:fs");

/**
 * Read a regular, non-symlink file of 1 to `limit` bytes that does not change while read.
 *
 * **Details**
 *
 * The file is opened with `O_NOFOLLOW | O_NONBLOCK`, so a symlink fails to
 * open and a FIFO never blocks; anything but a regular file, an empty or
 * oversized file, or a file whose device, inode, size, mtime or ctime changes
 * during the read fails with `"refused"`.
 *
 * **Example** (Bound a receipt read)
 *
 * ```ts
 * import { readBoundedRegularFile } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readBoundedRegularFile("/tmp/receipt.json", 16))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const readBoundedRegularFile: {
  (limit: number): (file: string) => Effect.Effect<Uint8Array, "refused">;
  (file: string, limit: number): Effect.Effect<Uint8Array, "refused">;
} = dual(
  2,
  (file: string, limit: number): Effect.Effect<Uint8Array, "refused"> =>
    Effect.try({
      try: () => {
        const fs = nodeFs();
        const descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
        try {
          const before = fs.fstatSync(descriptor, { bigint: true });
          if (!before.isFile() || before.size <= BigInt(0) || before.size > BigInt(limit)) return O.none<Uint8Array>();
          const buffer = new Uint8Array(Number(before.size) + 1);
          let total = 0;
          for (let read = -1; read !== 0 && total < buffer.byteLength; total += read)
            read = fs.readSync(descriptor, buffer, total, buffer.byteLength - total, null);
          const after = fs.fstatSync(descriptor, { bigint: true });
          const identity = (info: typeof before) => [info.dev, info.ino, info.size, info.mtimeNs, info.ctimeNs];
          return BigInt(total) === before.size && Equal.equals(identity(before), identity(after))
            ? O.some(buffer.subarray(0, total))
            : O.none<Uint8Array>();
        } finally {
          fs.closeSync(descriptor);
        }
      },
      catch: () => "refused" as const,
    }).pipe(Effect.flatMap(O.match({ onNone: () => refused, onSome: Effect.succeed })))
);

/**
 * Write the public summary of a private local observation, exclusively.
 *
 * **Details**
 *
 * Reads the receipt (at most 16 MiB) and request (at most 64 KiB) with
 * {@link readBoundedRegularFile}, projects them with
 * {@link summarizeCacheLocalObservation} and creates `output` with mode
 * `0600`, refusing an existing file. Any refusal prints
 * `CACHE_LOCAL_SUMMARY_REFUSAL` to stderr and exits 1.
 *
 * **Example** (Publish a summary)
 *
 * ```ts
 * import { writeCacheLocalSummary } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const write = writeCacheLocalSummary({
 *   report: "/private/local-observation.json",
 *   request: ".beep/cache/local-pilot-observation/request.json",
 *   output: "/private/publication/observation-summary.json",
 *   revision: "a".repeat(40),
 *   channel: "stable",
 *   computation: "@beep/types#lint",
 * })
 * console.log(Effect.isEffect(write)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const writeCacheLocalSummary = Effect.fn("Ci.writeCacheLocalSummary")(function* (options: {
  readonly report: string;
  readonly request: string;
  readonly output: string;
  readonly revision: string;
  readonly channel: string;
  readonly computation: string;
}) {
  const fs = yield* FileSystem.FileSystem;
  const program = Effect.gen(function* () {
    const report = yield* readBoundedRegularFile(options.report, REPORT_LIMIT);
    const request = yield* readBoundedRegularFile(options.request, CACHE_LOCAL_SUMMARY_LIMIT);
    const summary = yield* summarizeCacheLocalObservation(
      report,
      request,
      options.revision,
      options.channel,
      options.computation
    );
    yield* fs.writeFile(options.output, summary, { flag: "wx", mode: 0o600 });
  });
  // Do not print paths, field values, payloads or failure representations.
  return yield* program.pipe(
    Effect.catch(() =>
      Console.error(CACHE_LOCAL_SUMMARY_REFUSAL).pipe(Effect.andThen(failWithReportedExit(CACHE_LOCAL_SUMMARY_REFUSAL)))
    )
  );
});
