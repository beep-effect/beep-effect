/**
 * The hosted corpus of the verification route: capture GitHub Actions runs
 * into a digest-named, gzipped NDJSON file and load it back only when its
 * bytes match the receipt (`goals/verification-route`, slice 1).
 *
 * **Details**
 *
 * Capture ports `capture_hosted` from the time-to-certainty economics script.
 * It lists runs one UTC date at a time per workflow and fails closed when a
 * date returns the API cap, since GitHub silently drops the rest. It keeps
 * completed `pull_request` runs and completed pushes to `main`, then views
 * each kept run with its jobs.
 *
 * Capture works one UTC day at a time, oldest first, and pins the corpus
 * after every day, so a failure keeps every finished day. The receipt's
 * `until` is the last fully captured day: every eligible run of that day and
 * the days before it was finished and fetched, and the UTC day has elapsed.
 * Today and future days remain open even when no unfinished runs are listed.
 * A rerun with the same `since`
 * verifies the pinned corpus before continuing from the day after `until`.
 * Changing workflows filters saved runs to that selection. A run is fetched again only when it
 * is new or its attempt moved past the captured one, so a pinned run is never
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
import * as Equal from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ghOutput } from "../../internal/github/index.ts";
import { sha256HexBytes } from "../Goals/PacketCore/PacketDigest.ts";
import { HostedJob, HostedRun, RouteCorpusReceipt, RouteError } from "./Route.schemas.ts";
import { RouteCorpus, RouteCorpusLoaded } from "./Route.service.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
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
 * ```ts import.meta.vitest name="Read the cap"
 * import { ROUTE_CORPUS_LIST_CAP } from "@beep/repo-cli/commands/Ci/RouteCorpus"
 *
 * ROUTE_CORPUS_LIST_CAP // => 1000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ROUTE_CORPUS_LIST_CAP = 1000;

/**
 * Legacy corpus filename, read when adopting an unreceipted capture.
 *
 * **Details**
 * New checkpoints use `hosted-runs.<sha256>.ndjson.gz` and switch the receipt
 * last. An interrupted write therefore leaves the prior receipt and its
 * immutable corpus loadable. Read the current filename from the receipt.
 *
 * **Example** (Locate a legacy corpus file)
 *
 * ```ts import.meta.vitest name="Locate a legacy corpus file"
 * import { ROUTE_CORPUS_FILE } from "@beep/repo-cli/commands/Ci/RouteCorpus"
 *
 * `research/corpus/${ROUTE_CORPUS_FILE}` // => "research/corpus/hosted-runs.ndjson.gz"
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
 * ```ts import.meta.vitest name="Locate the receipt to load"
 * import { ROUTE_CORPUS_RECEIPT_FILE } from "@beep/repo-cli/commands/Ci/RouteCorpus"
 *
 * `research/corpus/${ROUTE_CORPUS_RECEIPT_FILE}` // => "research/corpus/RECEIPTS.json"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ROUTE_CORPUS_RECEIPT_FILE = "RECEIPTS.json";

const ROUTE_CORPUS_FETCH_CONCURRENCY = 8;
const RATE_LIMIT_MAX_WAIT = Duration.minutes(60);
const RATE_LIMIT_MARGIN_MS = 1000;
const GH_RATE_LIMIT_PATTERN = /rate limit exceeded|secondary rate limit/iu;
const GH_LIST_FIELDS = "databaseId,workflowName,event,status,conclusion,createdAt,updatedAt,headBranch,headSha,attempt";
const GH_VIEW_FIELDS = "databaseId,workflowName,event,status,conclusion,createdAt,headBranch,headSha,attempt,jobs";

/**
 * Runs one `gh` command in a checkout and yields its stdout.
 *
 * **Details**
 *
 * The corpus depends on this function, not on a process spawner, so a test
 * can answer each argument vector with a recorded payload. The production
 * runner behind {@link RouteCorpusLive} runs the real `gh` through the repo
 * capture and retries a failed call twice. A call GitHub refused for its rate
 * limit fails with {@link RouteGhRateLimited} instead, so the corpus can wait
 * for the reset.
 *
 * **Example** (A runner that answers every list with no runs)
 *
 * ```ts import.meta.vitest name="A runner that answers every list with no runs"
 * import type { RouteGhRunner } from "@beep/repo-cli/commands/Ci/RouteCorpus"
 * import * as Effect from "effect/Effect"
 *
 * const runGh: RouteGhRunner = (args) => Effect.succeed(args[1] === "list" ? "[]" : "{}")
 * typeof runGh // => "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type RouteGhRunner = (
  args: ReadonlyArray<string>,
  cwd: string
) => Effect.Effect<string, RouteError | RouteGhRateLimited>;

/**
 * A `gh` call GitHub refused because the API rate limit was exhausted.
 *
 * **Details**
 *
 * A {@link RouteGhRunner} fails with this error so the corpus can look up the
 * reset instant with `gh api rate_limit`, wait for it once (at most 60
 * minutes) and retry the call. When the wait is too long, the reset is
 * unknown, or the retry is refused again, capture fails with a `corpus-fetch`
 * {@link RouteError} that names the reset instant.
 *
 * **Example** (Refuse a call for the rate limit)
 *
 * ```ts import.meta.vitest name="Refuse a call for the rate limit"
 * import { RouteGhRateLimited } from "@beep/repo-cli/commands/Ci/RouteCorpus"
 *
 * const refused = RouteGhRateLimited.make({
 *   command: "gh run view 1 --json jobs",
 *   output: "HTTP 403: API rate limit exceeded for user ID 1.",
 * })
 * refused._tag // => "RouteGhRateLimited"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RouteGhRateLimited extends S.TaggedError<RouteGhRateLimited, { readonly brand: unique symbol }>(
  $I`RouteGhRateLimited`
)(
  "RouteGhRateLimited",
  {
    command: S.String,
    output: S.String,
  },
  $I.annoteError<RouteGhRateLimited>("RouteGhRateLimited", {
    description: "A gh call refused because the GitHub API rate limit was exhausted.",
  })
) {}

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
    status: S.String,
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

const GhRateLimit = S.Struct({
  resources: S.Struct({ core: S.Struct({ reset: S.Int }) }),
}).pipe(
  $I.annoteSchema("GhRateLimit", {
    description: "The core bucket reset (epoch seconds) of a `gh api rate_limit` payload.",
  })
);

const decodeGhRunList = S.decodeUnknownEffect(S.fromJsonString(S.Array(GhRunListRow)));
const decodeGhRunView = S.decodeUnknownEffect(S.fromJsonString(GhRunView));
const decodeHostedRunLine = S.decodeUnknownEffect(S.fromJsonString(HostedRun));
const encodeHostedRunLine = S.encodeEffect(S.fromJsonString(HostedRun));
const decodeReceipt = S.decodeUnknownEffect(S.fromJsonString(RouteCorpusReceipt));
const encodeReceipt = S.encodeEffect(S.fromJsonString(RouteCorpusReceipt, { space: 2 }));
const decodeGhRateLimit = S.decodeUnknownEffect(S.fromJsonString(GhRateLimit));

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

// A pull-request run, or a push to `main`. Only finished ones are fetched; an
// unfinished one keeps its day open so a later capture lists it again.
const isEligibleRun = (row: GhRunListRow): boolean =>
  row.event === "pull_request" || (row.event === "push" && row.headBranch === "main");
const isFinishedRun = (row: GhRunListRow): boolean => row.status === "completed";

const byCreatedAtThenRunId: Order.Order<HostedRun> = Order.combine(
  Order.mapInput(Order.String, (run: HostedRun) => run.createdAt),
  Order.mapInput(Order.Number, (run: HostedRun) => run.runId)
);

const isLaterDay = Order.isGreaterThan(Str.Order);
const nonNegative = Order.max(Order.Number);

const nextDay = (day: DateTime.Utc): string => DateTime.formatIsoDateUtc(DateTime.add(day, { days: 1 }));
const dayBefore = (day: DateTime.Utc): string => DateTime.formatIsoDateUtc(DateTime.subtract(day, { days: 1 }));
const sameWorkflows = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  Equal.equals(HashSet.fromIterable(left), HashSet.fromIterable(right));

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

const ghFailure = Match.type<GhCommandFailure>().pipe(
  Match.tagsExhaustive({
    spawn: (failure): RouteError | RouteGhRateLimited =>
      RouteError.new("corpus-fetch", `Failed to spawn ${failure.command}.`, failure),
    "nonzero-exit": (failure): RouteError | RouteGhRateLimited =>
      GH_RATE_LIMIT_PATTERN.test(failure.output)
        ? RouteGhRateLimited.make({ command: failure.command, output: failure.output })
        : RouteError.new("corpus-fetch", `${failure.command} exited ${failure.exitCode}: ${failure.output}`, failure),
    truncated: (failure): RouteError | RouteGhRateLimited =>
      RouteError.new("corpus-fetch", `${failure.command} overflowed the capture bound.`, failure),
  })
);

const routeGhRunner = Effect.gen(function* () {
  const context = yield* Effect.context<
    Digest.Digest | SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
  >();
  const runGh: RouteGhRunner = (args, cwd) =>
    ghOutput({
      args,
      cwd,
      label: A.join(["gh", ...A.take(args, 2)], " "),
      onFailure: ghFailure,
    }).pipe(
      // A rate-limited call is not retried here: the corpus waits for the reset.
      Effect.retry({
        times: 2,
        schedule: Schedule.exponential(Duration.seconds(1)),
        while: P.not(P.isTagged("RouteGhRateLimited")),
      }),
      Effect.provide(context)
    );
  return runGh;
}).pipe(Effect.withSpan("RouteCorpus.ghRunner"));

const gzipText = (text: string, file: string) =>
  Effect.try({
    try: () => NodeZlib.gzipSync(new TextEncoder().encode(text)),
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

// Capture state threaded through the days: the runs by id, the digest of the
// corpus on disk while it still matches them, the last fully captured day, and
// whether every day so far was complete.
type CaptureState = {
  readonly runs: HashMap.HashMap<number, HostedRun>;
  readonly pinned: O.Option<string>;
  readonly covered: string;
  readonly open: boolean;
};

type CapturePlan = {
  readonly since: string;
  readonly start: DateTime.DateTime;
  readonly covered: string;
  readonly workflows: ReadonlyArray<string>;
};

/**
 * Build the corpus service over a `gh` runner.
 *
 * **Details**
 *
 * `capture` resolves `outDir` against `repoRoot` and walks the UTC days from
 * `since` to `until` (today in UTC when absent), oldest first. For each day
 * it lists every workflow, fetches the finished eligible runs the corpus
 * lacks (eight at a time), and then pins the corpus: it writes
 * `hosted-runs.<sha256>.ndjson.gz`, sorted by `createdAt` then run id, and
 * switches `RECEIPTS.json` last through a temporary file and a rename. An
 * interrupted switch leaves the previous receipt and its corpus intact.
 *
 * The receipt's `until` is the last fully captured day. A day with an
 * eligible run that has not finished stays open: its finished runs are
 * pinned, but `until` stops before it, so the next capture lists it again. A
 * rerun whose `since` falls inside the receipt and whose workflows match
 * continues from the day after `until`. An earlier `since` or another set of
 * workflows starts the window again; a later `since` that would leave a gap
 * fails, because the receipt could not describe it.
 *
 * When GitHub refuses a call for its rate limit, capture reads the reset
 * instant from `gh api rate_limit`, waits for it once (at most 60 minutes) and
 * retries. Otherwise it fails with a `corpus-fetch` error naming the reset.
 *
 * `load` reads a receipt and the corpus file beside it, compares the file's
 * sha256 with the receipt and decodes every line strictly. Any mismatch,
 * malformed line or count difference fails with reason `corpus-pin`, and
 * nothing is skipped. Every `gh` and payload failure is `corpus-fetch`.
 *
 * **Example** (Build the corpus over a runner that sees no runs)
 *
 * ```ts import.meta.vitest name="Build the corpus over a runner that sees no runs"
 * import { makeRouteCorpus } from "@beep/repo-cli/commands/Ci/RouteCorpus"
 * import * as Effect from "effect/Effect"
 *
 * const corpus = makeRouteCorpus(() => Effect.succeed("[]"))
 * Effect.isEffect(corpus) // => true
 * ```
 *
 * @param runGh - Runs one `gh` argument vector in a checkout and yields stdout.
 * @returns The {@link RouteCorpusShape} implementation, closed over the file system, path and crypto services.
 * @category constructors
 * @since 0.0.0
 */
export const makeRouteCorpus = Effect.fn("RouteCorpus.make")(function* (
  runGh: RouteGhRunner
): Effect.fn.Return<
  RouteCorpusShape,
  never,
  FileSystem.FileSystem | Path.Path | Digest.Digest | SecureRandom.SecureRandom
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const context = yield* Effect.context<Digest.Digest | SecureRandom.SecureRandom>();

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

  const readCorpusBytes = (corpusPath: string) =>
    fs
      .readFile(corpusPath)
      .pipe(Effect.mapError(RouteError.mapError("corpus-pin", `Failed to read the corpus ${corpusPath}.`)));

  // The corpus already on disk: its runs, and its digest while it is unchanged.
  const readExisting = Effect.fnUntraced(function* (corpusPath: string): Effect.fn.Return<CaptureState, RouteError> {
    const bytes = yield* readCorpusBytes(corpusPath);
    const runs = yield* decodeCorpus(bytes, corpusPath);
    return {
      runs: HashMap.fromIterable(A.map(runs, (run): readonly [number, HostedRun] => [run.runId, run])),
      pinned: O.some(yield* digest(bytes, corpusPath)),
      covered: "",
      open: true,
    };
  });

  const rateLimitReset = (repoRoot: string): Effect.Effect<O.Option<DateTime.Utc>> =>
    runGh(["api", "rate_limit"], repoRoot).pipe(
      Effect.flatMap(decodeGhRateLimit),
      Effect.map((limit) => DateTime.makeUnsafe(limit.resources.core.reset * 1000)),
      Effect.option
    );

  const rateLimited = (label: string, reset: O.Option<DateTime.Utc>, detail: string) =>
    Effect.fail(
      RouteError.new(
        "corpus-fetch",
        `${label} hit the GitHub API rate limit${detail}; ${O.match(reset, {
          onNone: () => "gh did not report when it resets",
          onSome: (at) => `it resets at ${DateTime.formatIso(at)}`,
        })}. Finished days stay pinned; rerun the capture to continue.`
      )
    );

  // Wait once for the reported reset (at most an hour), then retry the call.
  const waitForReset = Effect.fnUntraced(function* <A>(
    label: string,
    repoRoot: string,
    call: Effect.Effect<A, RouteError | RouteGhRateLimited>
  ): Effect.fn.Return<A, RouteError> {
    const reset = yield* rateLimitReset(repoRoot);
    const now = yield* DateTime.now;
    const wait = pipe(
      reset,
      O.map((at) =>
        Duration.millis(nonNegative(DateTime.toEpochMillis(at) - DateTime.toEpochMillis(now), 0) + RATE_LIMIT_MARGIN_MS)
      ),
      O.filter(Duration.isLessThanOrEqualTo(RATE_LIMIT_MAX_WAIT))
    );
    if (O.isNone(wait)) {
      return yield* rateLimited(label, reset, "");
    }
    yield* Effect.logWarning("route corpus waiting for the GitHub API rate limit to reset").pipe(
      Effect.annotateLogs({ call: label, waitMs: Duration.toMillis(wait.value) })
    );
    yield* Effect.sleep(wait.value);
    return yield* call.pipe(
      Effect.catchTag("RouteGhRateLimited", () => rateLimited(label, reset, " again after waiting for the reset"))
    );
  });

  const callGh = (label: string, args: ReadonlyArray<string>, repoRoot: string) =>
    runGh(args, repoRoot).pipe(
      Effect.catchTag("RouteGhRateLimited", () => waitForReset(label, repoRoot, runGh(args, repoRoot)))
    );

  const listDay = Effect.fn("RouteCorpus.listDay")(function* (
    repoRoot: string,
    workflow: string,
    day: string
  ): Effect.fn.Return<ReadonlyArray<GhRunListRow>, RouteError> {
    const query = `gh run list --workflow ${workflow} --created ${day}`;
    const text = yield* callGh(
      query,
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
  ): Effect.fn.Return<O.Option<HostedRun>, RouteError> {
    const text = yield* callGh(`gh run view ${runId}`, ["run", "view", `${runId}`, "--json", GH_VIEW_FIELDS], repoRoot);
    const view = yield* decodeGhRunView(text).pipe(
      Effect.mapError(RouteError.mapError("corpus-fetch", `gh run view ${runId} returned an unreadable payload.`))
    );
    if (view.databaseId !== runId) {
      return yield* RouteError.new("corpus-fetch", `gh run view ${runId} answered for run ${view.databaseId}.`);
    }
    // A rerun can start between the list and the view: the view then shows the
    // newer, unfinished attempt, which is not evidence yet.
    return view.status === "completed" ? O.some(hostedRunOf(view)) : O.none();
  });

  // Where this capture starts and what the receipt already covers. A receipt
  // for the same workflows whose window holds `since` is continued after its
  // `until`; anything else starts the window again at `since`.
  const capturePlan = Effect.fnUntraced(function* (
    previous: O.Option<RouteCorpusReceipt>,
    since: string,
    sinceDay: DateTime.Utc,
    workflows: ReadonlyArray<string>,
    until: string
  ): Effect.fn.Return<CapturePlan, RouteError> {
    const fresh: CapturePlan = { since, start: sinceDay, covered: dayBefore(sinceDay), workflows };
    if (O.isNone(previous)) {
      return fresh;
    }
    const receipt = previous.value;
    if (
      !sameWorkflows(receipt.workflows, workflows) ||
      isLaterDay(receipt.since, since) ||
      isLaterDay(receipt.until, until)
    ) {
      return fresh;
    }
    const previousUntil = yield* parseDay("corpus-pin", "the receipt's until", receipt.until);
    if (isLaterDay(since, nextDay(previousUntil))) {
      return yield* RouteError.new(
        "corpus-fetch",
        `since ${since} leaves a gap after the captured ${receipt.since}..${receipt.until}; continue from ${nextDay(previousUntil)} instead.`
      );
    }
    return {
      since: receipt.since,
      start: DateTime.add(previousUntil, { days: 1 }),
      covered: receipt.until,
      workflows: receipt.workflows,
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
    const loaded = (yield* exists(receiptPath)) ? O.some(yield* load(receiptPath)) : O.none();
    const previous = O.map(loaded, (value) => value.receipt);
    const plan = yield* capturePlan(
      previous,
      options.since,
      since,
      options.workflows,
      DateTime.formatIsoDateUtc(until)
    );
    const inWindow = (run: HostedRun) => {
      const day = Str.takeLeft(run.createdAt, 10);
      return (
        A.contains(options.workflows, run.workflow) &&
        !isLaterDay(plan.since, day) &&
        !isLaterDay(day, DateTime.formatIsoDateUtc(until))
      );
    };
    const existing: CaptureState = O.isSome(loaded)
      ? {
          runs: HashMap.fromIterable(
            A.map(A.filter(loaded.value.runs, inWindow), (run): readonly [number, HostedRun] => [run.runId, run])
          ),
          pinned: A.every(loaded.value.runs, inWindow) ? O.some(loaded.value.receipt.sha256) : O.none(),
          covered: "",
          open: true,
        }
      : (yield* exists(corpusPath))
        ? yield* readExisting(corpusPath)
        : { runs: HashMap.empty(), pinned: O.none(), covered: "", open: true };
    yield* fs
      .makeDirectory(outDir, { recursive: true })
      .pipe(Effect.mapError(RouteError.mapError("corpus-pin", `Failed to create ${outDir}.`)));

    const pinnedPath = (sha256: string) => path.join(outDir, `hosted-runs.${sha256}.ndjson.gz`);
    const pinRuns = Effect.fnUntraced(function* (runs: ReadonlyArray<HostedRun>) {
      const bytes = yield* encodeCorpus(runs, corpusPath);
      const sha256 = yield* digest(bytes, corpusPath);
      const target = pinnedPath(sha256);
      if (!(yield* exists(target))) {
        yield* writeAtomic(target, bytes);
      }
      return sha256;
    });

    // Commit immutable corpus bytes first, then atomically switch the receipt.
    // Prior versions remain available if that final switch is interrupted.
    const checkpoint = Effect.fnUntraced(function* (
      state: CaptureState
    ): Effect.fn.Return<readonly [RouteCorpusReceipt, CaptureState], RouteError> {
      const runs = A.sort(HashMap.toValues(state.runs), byCreatedAtThenRunId);
      const sha256 = yield* O.match(state.pinned, {
        onSome: (sha256) =>
          exists(pinnedPath(sha256)).pipe(
            Effect.flatMap((present) => (present ? Effect.succeed(sha256) : pinRuns(runs)))
          ),
        onNone: () => pinRuns(runs),
      });
      const receipt = RouteCorpusReceipt.make({
        schemaVersion: "route-corpus/v1",
        capturedAt: DateTime.formatIso(now),
        since: plan.since,
        until: state.covered,
        workflows: plan.workflows,
        runs: A.length(runs),
        heads: HashSet.size(HashSet.fromIterable(A.map(runs, (run) => run.headSha))),
        path: path.relative(path.resolve(options.repoRoot), pinnedPath(sha256)),
        sha256,
      });
      const receiptText = yield* encodeReceipt(receipt).pipe(
        Effect.mapError(RouteError.mapError("corpus-pin", `Failed to encode the receipt for ${corpusPath}.`))
      );
      yield* writeAtomic(receiptPath, new TextEncoder().encode(`${receiptText}\n`));
      return [receipt, { ...state, pinned: O.some(sha256) }];
    });

    const captureDay = Effect.fn("RouteCorpus.captureDay")(function* (
      state: CaptureState,
      day: string
    ): Effect.fn.Return<CaptureState, RouteError> {
      const listed = A.flatten(
        yield* Effect.forEach(plan.workflows, (workflow) => listDay(options.repoRoot, workflow, day), {
          concurrency: ROUTE_CORPUS_FETCH_CONCURRENCY,
        })
      );
      const eligible = A.filter(listed, isEligibleRun);
      const pending = pipe(
        eligible,
        A.filter(isFinishedRun),
        A.filter((row) => !O.exists(HashMap.get(state.runs, row.databaseId), (run) => run.attempt >= row.attempt)),
        A.map((row) => row.databaseId),
        HashSet.fromIterable,
        A.fromIterable,
        A.sort(Order.Number)
      );
      const viewed = yield* Effect.forEach(pending, (runId) => fetchRun(options.repoRoot, runId), {
        concurrency: ROUTE_CORPUS_FETCH_CONCURRENCY,
      });
      const fetched = A.getSomes(viewed);
      const open =
        state.open &&
        isLaterDay(DateTime.formatIsoDateUtc(now), day) &&
        A.every(eligible, isFinishedRun) &&
        A.length(fetched) === A.length(viewed);
      yield* Effect.logDebug("route corpus day captured").pipe(
        Effect.annotateLogs({ day, listed: A.length(listed), fetched: A.length(fetched), complete: open })
      );
      const [, written] = yield* checkpoint({
        runs: A.reduce(fetched, state.runs, (byId, run) => HashMap.set(byId, run.runId, run)),
        pinned: A.isReadonlyArrayEmpty(fetched) ? state.pinned : O.none(),
        covered: open ? day : state.covered,
        open,
      });
      return written;
    });

    const captured = yield* Effect.reduce(
      utcDays(plan.start, until),
      () => ({ ...existing, covered: plan.covered }),
      captureDay
    );
    const [receipt] = yield* checkpoint(captured);
    return receipt;
  });

  const load = Effect.fn("RouteCorpus.load")(function* (
    receiptPath: string
  ): Effect.fn.Return<RouteCorpusLoaded, RouteError> {
    const receipt = yield* readReceipt(receiptPath);
    // `receipt.path` is relative to the repo root the capture ran in; the corpus
    // file always sits beside its receipt, so resolve it from the receipt.
    const corpusPath = path.join(path.dirname(receiptPath), path.basename(receipt.path));
    const bytes = yield* readCorpusBytes(corpusPath);
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
 * ```ts import.meta.vitest name="Load a pinned corpus"
 * import { RouteCorpusLive } from "@beep/repo-cli/commands/Ci/RouteCorpus"
 * import { RouteCorpus } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const corpus = yield* RouteCorpus
 *   return yield* corpus.load("goals/verification-route/research/corpus/RECEIPTS.json")
 * }).pipe(Effect.provide(RouteCorpusLive))
 * Effect.isEffect(program) // => true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const RouteCorpusLive: Layer.Layer<
  RouteCorpus,
  never,
  | FileSystem.FileSystem
  | Path.Path
  | Digest.Digest
  | SecureRandom.SecureRandom
  | ChildProcessSpawner.ChildProcessSpawner
> = Layer.effect(RouteCorpus, Effect.flatMap(routeGhRunner, makeRouteCorpus));
