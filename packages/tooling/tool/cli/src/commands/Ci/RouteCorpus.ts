/**
 * The hosted corpus of the verification route: capture GitHub Actions runs
 * into a digest-pinned, gzipped NDJSON file and load it back only when its
 * bytes match the receipt (`goals/verification-route`, slice 1).
 *
 * **Details**
 *
 * Capture ports `capture_hosted` from the time-to-certainty economics script.
 * It lists runs one UTC date at a time per workflow and fails closed when a
 * date returns the API cap, since GitHub silently drops the rest. It keeps
 * completed `pull_request` runs and completed pushes to `main`, then views
 * each kept run with its jobs. A capture resumes from the corpus already
 * under the output directory: a run is fetched again only when it is new or
 * its attempt moved past the captured one, so a pinned run is never
 * re-fetched. Every `gh` call goes through an injected {@link RouteGhRunner},
 * which lets tests supply recorded payloads and never spawn `gh`.
 *
 * @since 0.0.0
 */
import * as NodeZlib from "node:zlib";
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ghOutput } from "../../internal/github/index.ts";
import { sha256HexBytes } from "../Goals/PacketCore/PacketDigest.ts";
import { HostedJob, HostedRun, RouteCorpusReceipt, RouteError } from "./Route.schemas.ts";
import { RouteCorpus, RouteCorpusLoaded } from "./Route.service.ts";
import type * as Crypto from "effect/Crypto";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GhCommandFailure } from "../../internal/github/index.ts";
import type { RouteCorpusCaptureOptions, RouteCorpusShape } from "./Route.service.ts";

const $I = $RepoCliId.create("commands/Ci/RouteCorpus");

/**
 * The most runs `gh run list` returns for one query. A UTC date that returns
 * this many runs may have lost some, so capture fails closed on it.
 *
 * **Example** (Read the cap)
 *
 * ```ts
 * import { ROUTE_CORPUS_LIST_CAP } from "@beep/repo-cli/commands/Ci/RouteCorpus"
 *
 * console.log(ROUTE_CORPUS_LIST_CAP) // 1000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ROUTE_CORPUS_LIST_CAP = 1000;

/**
 * File name of the gzipped NDJSON corpus inside the capture's output directory.
 *
 * **Example** (Locate the corpus file)
 *
 * ```ts
 * import { ROUTE_CORPUS_FILE } from "@beep/repo-cli/commands/Ci/RouteCorpus"
 *
 * console.log(`research/corpus/${ROUTE_CORPUS_FILE}`) // "research/corpus/hosted-runs.ndjson.gz"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ROUTE_CORPUS_FILE = "hosted-runs.ndjson.gz";

/**
 * File name of the corpus receipt inside the capture's output directory.
 *
 * **Example** (Locate the receipt to load)
 *
 * ```ts
 * import { ROUTE_CORPUS_RECEIPT_FILE } from "@beep/repo-cli/commands/Ci/RouteCorpus"
 *
 * console.log(`research/corpus/${ROUTE_CORPUS_RECEIPT_FILE}`) // "research/corpus/RECEIPTS.json"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ROUTE_CORPUS_RECEIPT_FILE = "RECEIPTS.json";

const ROUTE_CORPUS_FETCH_CONCURRENCY = 8;
const GH_LIST_FIELDS = "databaseId,workflowName,event,status,conclusion,createdAt,updatedAt,headBranch,headSha,attempt";
const GH_VIEW_FIELDS = "databaseId,workflowName,event,conclusion,createdAt,headBranch,headSha,attempt,jobs";

/**
 * Runs one `gh` command in a checkout and yields its stdout.
 *
 * **Details**
 *
 * The corpus depends on this function, not on a process spawner, so a test
 * can answer each argument vector with a recorded payload. The production
 * runner behind {@link RouteCorpusLive} runs the real `gh` through the repo
 * capture and retries a failed call twice.
 *
 * **Example** (A runner that answers every list with no runs)
 *
 * ```ts
 * import type { RouteGhRunner } from "@beep/repo-cli/commands/Ci/RouteCorpus"
 * import * as Effect from "effect/Effect"
 *
 * const runGh: RouteGhRunner = (args) => Effect.succeed(args[1] === "list" ? "[]" : "{}")
 * console.log(typeof runGh) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type RouteGhRunner = (args: ReadonlyArray<string>, cwd: string) => Effect.Effect<string, RouteError>;

// gh spells an absent value as a missing key, `null`, an empty string, or Go's
// zero time (`0001-01-01T00:00:00Z` for a job that never started or finished).
const GhText = S.OptionFromOptionalNullOr(S.String).pipe(
  $I.annoteSchema("GhText", {
    description: "A gh text field that may be missing or null; empty and zero-time values are dropped later.",
  })
);

class GhRunListRow extends S.Opaque<GhRunListRow, { readonly brand: unique symbol }>()(
  S.Struct({
    databaseId: S.Int,
    event: S.String,
    status: S.String,
    headBranch: S.String,
    attempt: S.Int,
  }).pipe(
    $I.annoteSchema("GhRunListRow", {
      description: "The fields of one `gh run list --json` row that run selection reads.",
    })
  )
) {}

class GhRunViewJob extends S.Opaque<GhRunViewJob, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString,
    conclusion: GhText,
    startedAt: GhText,
    completedAt: GhText,
  }).pipe(
    $I.annoteSchema("GhRunViewJob", {
      description: "One job of a `gh run view --json jobs` payload: name, conclusion and timestamps.",
    })
  )
) {}

class GhRunView extends S.Opaque<GhRunView, { readonly brand: unique symbol }>()(
  S.Struct({
    databaseId: S.Int,
    workflowName: S.NonEmptyString,
    event: S.NonEmptyString,
    conclusion: GhText,
    createdAt: S.NonEmptyString,
    headBranch: S.String,
    headSha: S.NonEmptyString,
    attempt: S.Int,
    jobs: S.Array(GhRunViewJob),
  }).pipe(
    $I.annoteSchema("GhRunView", {
      description: "The fields of a `gh run view --json` payload that become a HostedRun.",
    })
  )
) {}

const decodeGhRunList = S.decodeUnknownEffect(S.fromJsonString(S.Array(GhRunListRow)));
const decodeGhRunView = S.decodeUnknownEffect(S.fromJsonString(GhRunView));
const decodeHostedRunLine = S.decodeUnknownEffect(S.fromJsonString(HostedRun));
const encodeHostedRunLine = S.encodeEffect(S.fromJsonString(HostedRun));
const decodeReceipt = S.decodeUnknownEffect(S.fromJsonString(RouteCorpusReceipt));
const encodeReceipt = S.encodeEffect(S.fromJsonString(RouteCorpusReceipt, { space: 2 }));

const isGoZeroTime = Str.startsWith("0001-01-01T");
const presentText = (value: O.Option<string>): O.Option<string> =>
  O.filter(value, (text) => Str.isNonEmpty(text) && !isGoZeroTime(text));

const hostedJobOf = (job: GhRunViewJob): HostedJob =>
  HostedJob.make({
    name: job.name,
    conclusion: presentText(job.conclusion),
    startedAt: presentText(job.startedAt),
    completedAt: presentText(job.completedAt),
  });

const hostedRunOf = (view: GhRunView): HostedRun =>
  HostedRun.make({
    runId: view.databaseId,
    workflow: view.workflowName,
    event: view.event,
    headBranch: view.headBranch,
    headSha: view.headSha,
    createdAt: view.createdAt,
    conclusion: presentText(view.conclusion),
    attempt: view.attempt,
    jobs: A.map(view.jobs, hostedJobOf),
  });

// A completed pull-request run, or a completed push to `main`. An unfinished
// run is left for a later capture rather than pinned without its verdicts.
const isCorpusRun = (row: GhRunListRow): boolean =>
  row.status === "completed" && (row.event === "pull_request" || (row.event === "push" && row.headBranch === "main"));

const byCreatedAtThenRunId: Order.Order<HostedRun> = Order.combine(
  Order.mapInput(Order.String, (run: HostedRun) => run.createdAt),
  Order.mapInput(Order.Number, (run: HostedRun) => run.runId)
);

const isLaterDay = Order.isGreaterThan(Str.Order);
const earlierDay = Order.min(Str.Order);
const laterDay = Order.max(Str.Order);

const nextDay = (day: DateTime.Utc): string => DateTime.formatIsoDateUtc(DateTime.add(day, { days: 1 }));

// A capture day is a canonical UTC `YYYY-MM-DD`: it must parse and format back
// to itself, which rejects both other spellings and impossible dates.
const parseDay = (reason: "corpus-fetch" | "corpus-pin", label: string, day: string) =>
  pipe(
    DateTime.make(day),
    O.filter((parsed) => DateTime.formatIsoDateUtc(parsed) === day),
    Effect.fromOption(() => RouteError.new(reason, `${label} "${day}" is not a UTC date (YYYY-MM-DD).`))
  );

const utcDays = (since: DateTime.DateTime, until: DateTime.DateTime): ReadonlyArray<string> =>
  A.unfold(
    since,
    flow(
      O.liftPredicate(DateTime.isLessThanOrEqualTo(until)),
      O.map((day): readonly [string, DateTime.DateTime] => [
        DateTime.formatIsoDateUtc(day),
        DateTime.add(day, { days: 1 }),
      ])
    )
  );

const ghFailureMessage = Match.type<GhCommandFailure>().pipe(
  Match.tagsExhaustive({
    spawn: (failure) => `Failed to spawn ${failure.command}.`,
    "nonzero-exit": (failure) => `${failure.command} exited ${failure.exitCode}: ${failure.output}`,
    truncated: (failure) => `${failure.command} overflowed the capture bound.`,
  })
);

const routeGhRunner = Effect.gen(function* () {
  const context = yield* Effect.context<Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner>();
  const runGh: RouteGhRunner = (args, cwd) =>
    ghOutput({
      args,
      cwd,
      label: A.join(["gh", ...A.take(args, 2)], " "),
      onFailure: (failure) => RouteError.new("corpus-fetch", ghFailureMessage(failure), failure),
    }).pipe(Effect.retry({ times: 2, schedule: Schedule.exponential(Duration.seconds(1)) }), Effect.provide(context));
  return runGh;
}).pipe(Effect.withSpan("RouteCorpus.ghRunner"));

const gzipText = (text: string, file: string) =>
  Effect.try({
    try: () => NodeZlib.gzipSync(new TextEncoder().encode(text), { level: 9 }),
    catch: RouteError.mapError("corpus-pin", `Failed to gzip ${file}.`),
  });

const gunzipText = (bytes: Uint8Array, file: string) =>
  Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(NodeZlib.gunzipSync(bytes)),
    catch: RouteError.mapError("corpus-pin", `${file} is not a gzip of UTF-8 text.`),
  });

// One `HostedRun` per line, each line newline-terminated; an empty corpus is an
// empty file. A missing final newline means a truncated write.
const corpusLines = (text: string, file: string) =>
  Str.isEmpty(text)
    ? Effect.succeed(A.empty<string>())
    : Str.endsWith("\n")(text)
      ? Effect.succeed(A.dropRight(Str.split(text, "\n"), 1))
      : Effect.fail(RouteError.new("corpus-pin", `${file} does not end with a newline; the corpus is truncated.`));

const decodeCorpus = Effect.fnUntraced(function* (
  bytes: Uint8Array,
  file: string
): Effect.fn.Return<ReadonlyArray<HostedRun>, RouteError> {
  const lines = yield* corpusLines(yield* gunzipText(bytes, file), file);
  return yield* Effect.forEach(lines, (line, index) =>
    decodeHostedRunLine(line).pipe(
      Effect.mapError(RouteError.mapError("corpus-pin", `${file} line ${index + 1} is not a HostedRun.`))
    )
  );
});

const encodeCorpus = Effect.fnUntraced(function* (
  runs: ReadonlyArray<HostedRun>,
  file: string
): Effect.fn.Return<Uint8Array, RouteError> {
  const lines = yield* Effect.forEach(runs, (run) =>
    encodeHostedRunLine(run).pipe(
      Effect.mapError(RouteError.mapError("corpus-pin", `Failed to encode run ${run.runId} for ${file}.`))
    )
  );
  const text = A.match(lines, { onEmpty: () => "", onNonEmpty: (nonEmpty) => `${A.join(nonEmpty, "\n")}\n` });
  return yield* gzipText(text, file);
});

/**
 * Build the corpus service over a `gh` runner.
 *
 * **Details**
 *
 * `capture` resolves `outDir` against `repoRoot` and lists every UTC date
 * from `since` to `until` (today in UTC when absent) for each workflow. It
 * keeps the selected runs and fetches the ones the existing corpus lacks,
 * eight at a time. It then writes `hosted-runs.ndjson.gz`, sorted by
 * `createdAt` then run id, and `RECEIPTS.json` beside it, each through a
 * temporary file and a rename. The receipt window is the union of the
 * previous receipt's window and this one; a window that would leave a gap
 * fails, because the receipt could not describe it.
 *
 * `load` reads a receipt and the corpus file beside it, compares the file's
 * sha256 with the receipt and decodes every line strictly. Any mismatch,
 * malformed line or count difference fails with reason `corpus-pin`, and
 * nothing is skipped. Every `gh` and payload failure is `corpus-fetch`.
 *
 * **Example** (Build the corpus over a runner that sees no runs)
 *
 * ```ts
 * import { makeRouteCorpus } from "@beep/repo-cli/commands/Ci/RouteCorpus"
 * import * as Effect from "effect/Effect"
 *
 * const corpus = makeRouteCorpus(() => Effect.succeed("[]"))
 * console.log(Effect.isEffect(corpus)) // true
 * ```
 *
 * @param runGh - Runs one `gh` argument vector in a checkout and yields stdout.
 * @returns The {@link RouteCorpusShape} implementation, closed over the file system, path and crypto services.
 * @category constructors
 * @since 0.0.0
 */
export const makeRouteCorpus = Effect.fn("RouteCorpus.make")(function* (
  runGh: RouteGhRunner
): Effect.fn.Return<RouteCorpusShape, never, FileSystem.FileSystem | Path.Path | Crypto.Crypto> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const context = yield* Effect.context<Crypto.Crypto>();

  const digest = (bytes: Uint8Array, file: string) =>
    sha256HexBytes(bytes).pipe(
      Effect.provide(context),
      Effect.mapError(RouteError.mapError("corpus-pin", `Failed to hash ${file}.`))
    );

  const writeAtomic = (target: string, bytes: Uint8Array) =>
    fs
      .writeFile(`${target}.tmp`, bytes)
      .pipe(
        Effect.andThen(fs.rename(`${target}.tmp`, target)),
        Effect.mapError(RouteError.mapError("corpus-pin", `Failed to write ${target}.`))
      );

  const exists = (file: string) =>
    fs.exists(file).pipe(Effect.mapError(RouteError.mapError("corpus-pin", `Failed to stat ${file}.`)));

  const readReceipt = Effect.fnUntraced(function* (
    receiptPath: string
  ): Effect.fn.Return<RouteCorpusReceipt, RouteError> {
    const text = yield* fs
      .readFileString(receiptPath)
      .pipe(Effect.mapError(RouteError.mapError("corpus-pin", `Failed to read the corpus receipt ${receiptPath}.`)));
    return yield* decodeReceipt(text).pipe(
      Effect.mapError(RouteError.mapError("corpus-pin", `${receiptPath} is not a route-corpus/v1 receipt.`))
    );
  });

  const readRuns = Effect.fnUntraced(function* (
    corpusPath: string
  ): Effect.fn.Return<ReadonlyArray<HostedRun>, RouteError> {
    const bytes = yield* fs
      .readFile(corpusPath)
      .pipe(Effect.mapError(RouteError.mapError("corpus-pin", `Failed to read the corpus ${corpusPath}.`)));
    return yield* decodeCorpus(bytes, corpusPath);
  });

  const listDay = Effect.fn("RouteCorpus.listDay")(function* (
    repoRoot: string,
    workflow: string,
    day: string
  ): Effect.fn.Return<ReadonlyArray<GhRunListRow>, RouteError> {
    const query = `gh run list --workflow ${workflow} --created ${day}`;
    const text = yield* runGh(
      [
        "run",
        "list",
        "--workflow",
        workflow,
        "--created",
        day,
        "--limit",
        `${ROUTE_CORPUS_LIST_CAP}`,
        "--json",
        GH_LIST_FIELDS,
      ],
      repoRoot
    );
    const rows = yield* decodeGhRunList(text).pipe(
      Effect.mapError(RouteError.mapError("corpus-fetch", `${query} returned an unreadable payload.`))
    );
    if (A.length(rows) >= ROUTE_CORPUS_LIST_CAP) {
      return yield* RouteError.new(
        "corpus-fetch",
        `${query} reached the ${ROUTE_CORPUS_LIST_CAP}-run API cap; runs on that date may be missing.`
      );
    }
    return rows;
  });

  const fetchRun = Effect.fn("RouteCorpus.fetchRun")(function* (
    repoRoot: string,
    runId: number
  ): Effect.fn.Return<HostedRun, RouteError> {
    const text = yield* runGh(["run", "view", `${runId}`, "--json", GH_VIEW_FIELDS], repoRoot);
    const view = yield* decodeGhRunView(text).pipe(
      Effect.mapError(RouteError.mapError("corpus-fetch", `gh run view ${runId} returned an unreadable payload.`))
    );
    if (view.databaseId !== runId) {
      return yield* RouteError.new("corpus-fetch", `gh run view ${runId} answered for run ${view.databaseId}.`);
    }
    return hostedRunOf(view);
  });

  const captureWindow = Effect.fnUntraced(function* (
    previous: O.Option<RouteCorpusReceipt>,
    since: string,
    until: DateTime.Utc,
    workflows: ReadonlyArray<string>
  ): Effect.fn.Return<
    { readonly since: string; readonly until: string; readonly workflows: ReadonlyArray<string> },
    RouteError
  > {
    const untilDay = DateTime.formatIsoDateUtc(until);
    if (O.isNone(previous)) {
      return { since, until: untilDay, workflows };
    }
    const receipt = previous.value;
    const previousUntil = yield* parseDay("corpus-pin", "the receipt's until", receipt.until);
    yield* parseDay("corpus-pin", "the receipt's since", receipt.since);
    if (isLaterDay(since, nextDay(previousUntil)) || isLaterDay(receipt.since, nextDay(until))) {
      return yield* RouteError.new(
        "corpus-fetch",
        `The window ${since}..${untilDay} leaves a gap beside the captured ${receipt.since}..${receipt.until}; extend the existing window instead.`
      );
    }
    return {
      since: earlierDay(receipt.since, since),
      until: laterDay(receipt.until, untilDay),
      workflows: A.union(receipt.workflows, workflows),
    };
  });

  const capture = Effect.fn("RouteCorpus.capture")(function* (
    options: RouteCorpusCaptureOptions
  ): Effect.fn.Return<RouteCorpusReceipt, RouteError> {
    const now = yield* DateTime.now;
    const outDir = path.resolve(options.repoRoot, options.outDir);
    const corpusPath = path.join(outDir, ROUTE_CORPUS_FILE);
    const receiptPath = path.join(outDir, ROUTE_CORPUS_RECEIPT_FILE);
    const since = yield* parseDay("corpus-fetch", "since", options.since);
    const until = yield* parseDay(
      "corpus-fetch",
      "until",
      O.getOrElse(options.until, () => DateTime.formatIsoDateUtc(now))
    );
    if (DateTime.isGreaterThan(since, until)) {
      return yield* RouteError.new(
        "corpus-fetch",
        `since ${options.since} is after until ${DateTime.formatIsoDateUtc(until)}.`
      );
    }
    const previous = (yield* exists(receiptPath)) ? O.some(yield* readReceipt(receiptPath)) : O.none();
    const window = yield* captureWindow(previous, options.since, until, options.workflows);
    const existing = (yield* exists(corpusPath)) ? yield* readRuns(corpusPath) : A.empty<HostedRun>();
    const captured = HashMap.fromIterable(A.map(existing, (run): readonly [number, HostedRun] => [run.runId, run]));

    const days = utcDays(since, until);
    const queries = A.flatMap(options.workflows, (workflow) =>
      A.map(days, (day): readonly [string, string] => [workflow, day])
    );
    const listed = A.flatten(
      yield* Effect.forEach(queries, ([workflow, day]) => listDay(options.repoRoot, workflow, day), {
        concurrency: ROUTE_CORPUS_FETCH_CONCURRENCY,
      })
    );
    const pending = pipe(
      listed,
      A.filter(isCorpusRun),
      A.filter((row) => !O.exists(HashMap.get(captured, row.databaseId), (run) => run.attempt >= row.attempt)),
      A.map((row) => row.databaseId),
      HashSet.fromIterable,
      A.fromIterable,
      A.sort(Order.Number)
    );
    const fetched = yield* Effect.forEach(pending, (runId) => fetchRun(options.repoRoot, runId), {
      concurrency: ROUTE_CORPUS_FETCH_CONCURRENCY,
    });
    const runs = A.sort(
      HashMap.toValues(A.reduce(fetched, captured, (byId, run) => HashMap.set(byId, run.runId, run))),
      byCreatedAtThenRunId
    );

    const bytes = yield* encodeCorpus(runs, corpusPath);
    const sha256 = yield* digest(bytes, corpusPath);
    yield* fs
      .makeDirectory(outDir, { recursive: true })
      .pipe(Effect.mapError(RouteError.mapError("corpus-pin", `Failed to create ${outDir}.`)));
    yield* writeAtomic(corpusPath, bytes);
    const receipt = RouteCorpusReceipt.make({
      schemaVersion: "route-corpus/v1",
      capturedAt: DateTime.formatIso(now),
      since: window.since,
      until: window.until,
      workflows: window.workflows,
      runs: A.length(runs),
      heads: HashSet.size(HashSet.fromIterable(A.map(runs, (run) => run.headSha))),
      path: path.relative(path.resolve(options.repoRoot), corpusPath),
      sha256,
    });
    const receiptText = yield* encodeReceipt(receipt).pipe(
      Effect.mapError(RouteError.mapError("corpus-pin", `Failed to encode the receipt for ${corpusPath}.`))
    );
    yield* writeAtomic(receiptPath, new TextEncoder().encode(`${receiptText}\n`));
    yield* Effect.logDebug("route corpus captured").pipe(
      Effect.annotateLogs({
        listed: A.length(listed),
        fetched: A.length(fetched),
        runs: receipt.runs,
        heads: receipt.heads,
      })
    );
    return receipt;
  });

  const load = Effect.fn("RouteCorpus.load")(function* (
    receiptPath: string
  ): Effect.fn.Return<RouteCorpusLoaded, RouteError> {
    const receipt = yield* readReceipt(receiptPath);
    // `receipt.path` is relative to the repo root the capture ran in; the corpus
    // file always sits beside its receipt, so resolve it from the receipt.
    const corpusPath = path.join(path.dirname(receiptPath), path.basename(receipt.path));
    const bytes = yield* fs
      .readFile(corpusPath)
      .pipe(Effect.mapError(RouteError.mapError("corpus-pin", `Failed to read the corpus ${corpusPath}.`)));
    const sha256 = yield* digest(bytes, corpusPath);
    if (sha256 !== receipt.sha256) {
      return yield* RouteError.new(
        "corpus-pin",
        `${corpusPath} has sha256 ${sha256}, but its receipt pins ${receipt.sha256}.`
      );
    }
    const runs = yield* decodeCorpus(bytes, corpusPath);
    if (A.length(runs) !== receipt.runs) {
      return yield* RouteError.new(
        "corpus-pin",
        `${corpusPath} holds ${A.length(runs)} runs, but its receipt counts ${receipt.runs}.`
      );
    }
    return RouteCorpusLoaded.make({ receipt, runs });
  });

  return RouteCorpus.of({ capture, load });
});

/**
 * The corpus service over the real `gh` CLI.
 *
 * **Details**
 *
 * Each `gh` call runs in the capture's `repoRoot`, so `gh` resolves the
 * repository from that checkout's remote. A failed call is retried twice with
 * exponential backoff from one second, then fails with reason `corpus-fetch`.
 *
 * **Example** (Load a pinned corpus)
 *
 * ```ts
 * import { RouteCorpusLive } from "@beep/repo-cli/commands/Ci/RouteCorpus"
 * import { RouteCorpus } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const corpus = yield* RouteCorpus
 *   return yield* corpus.load("goals/verification-route/research/corpus/RECEIPTS.json")
 * }).pipe(Effect.provide(RouteCorpusLive))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const RouteCorpusLive: Layer.Layer<
  RouteCorpus,
  never,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> = Layer.effect(RouteCorpus, Effect.flatMap(routeGhRunner, makeRouteCorpus));
