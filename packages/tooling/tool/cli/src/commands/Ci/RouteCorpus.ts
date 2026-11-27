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
import { GitHubClient } from "@beep/github/GitHubClient";
import { GitHubError } from "@beep/github/GitHubError";
import { Repo } from "@beep/github/Repo";
import { $RepoCliId } from "@beep/identity/packages";
import { GATES_DIR } from "@beep/repo-gate-record/GatePaths";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { unzipSync } from "fflate";
import {
  GithubClientRequest,
  GithubIdentity,
  layerGithubClientFor,
  layerGithubRepoFor,
} from "../../internal/github/GithubIdentity.ts";
import { GithubRest, layerGithubRest } from "../../internal/github/GithubRest.ts";
import { sha256HexBytes } from "../Goals/PacketCore/PacketDigest.ts";
import { AnyTaskOutcomeRecord, taskOutcomeArtifactPrefix } from "./CiTaskOutcomes.ts";
import { HostedJob, HostedRun, HostedStep, RouteCorpusReceipt, RouteError } from "./Route.schemas.ts";
import { RouteCorpus, RouteCorpusLoaded } from "./Route.service.ts";
import { makeRouteReadBudget, RouteReadBudget } from "./RouteBudget.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { RouteCorpusCaptureOptions, RouteCorpusShape } from "./Route.service.ts";
import type { RouteReadBudgetShape } from "./RouteBudget.ts";

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
const ROUTE_CORPUS_JOB_PAGE = 100;
const ROUTE_CORPUS_JOB_FALLBACK_PAGE = 30;
const RATE_LIMIT_MAX_WAIT = Duration.minutes(60);
const RATE_LIMIT_MARGIN_MS = 1000;
const GH_LIST_FIELDS = "databaseId,workflowName,event,status,conclusion,createdAt,updatedAt,headBranch,headSha,attempt";
const GH_VIEW_FIELDS = "databaseId,workflowName,event,status,conclusion,createdAt,headBranch,headSha,attempt,jobs";

/**
 * Supplies the corpus compatibility protocol in a checkout and yields JSON text.
 *
 * **Details**
 *
 * The corpus depends on this function, not on a process spawner, so a test
 * can answer each argument vector with a recorded payload. The production
 * runner behind {@link RouteCorpusLive} uses paginated GitHub REST reads
 * with the gh login and retries a failed call twice. A call GitHub refused for its rate
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
 * **Details**
 *
 * A {@link RouteGhRunner} fails with this error so the corpus can look up the
 * reset instant with `gh api rate_limit`, wait for it once (at most 60
 * minutes) and retry the call. When the wait is too long, the reset is
 * unknown, or the retry is refused again, capture fails with a `corpus-fetch`
 * {@link RouteError} that names the reset instant. `requests` counts the
 * task-outcome requests the refused call had already sent; the capture adds
 * them to the retried call's count.
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
    requests: S.Int.pipe(S.withConstructorDefault(Effect.succeed(0))),
  },
  $I.annoteError<RouteGhRateLimited>("RouteGhRateLimited", {
    description: "A gh call refused because the GitHub API rate limit was exhausted.",
  })
) {}

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

class GhRunViewStep extends S.Opaque<GhRunViewStep, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    conclusion: GhText,
  }).pipe(
    $I.annoteSchema("GhRunViewStep", {
      description: "One step of a `gh run view --json jobs` job: its name and conclusion.",
    })
  )
) {}

class GhRunViewJob extends S.Opaque<GhRunViewJob, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString,
    conclusion: GhText,
    startedAt: GhText,
    completedAt: GhText,
    steps: GhRunViewStep.pipe(S.Array, S.OptionFromOptionalNullOr),
  }).pipe(
    $I.annoteSchema("GhRunViewJob", {
      description: "One job of a `gh run view --json jobs` payload: name, conclusion, timestamps and steps.",
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

const hostedStepOf = (step: GhRunViewStep): HostedStep =>
  HostedStep.make({ name: step.name, conclusion: presentText(step.conclusion) });

const hostedJobOf = (job: GhRunViewJob): HostedJob => {
  const conclusion = presentText(job.conclusion);
  return HostedJob.make({
    name: job.name,
    conclusion,
    startedAt: presentText(job.startedAt),
    completedAt: presentText(job.completedAt),
    steps: pipe(
      job.steps,
      O.filter(() => O.exists(conclusion, (value) => Str.Equivalence(value, "failure"))),
      O.map(A.map(hostedStepOf))
    ),
  });
};

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

const TaskOutcomeRead = S.Struct({ requests: S.Int, records: S.Array(AnyTaskOutcomeRecord) }).pipe(
  $I.annoteSchema("TaskOutcomeRead", {
    description: "The task-outcome records of one run attempt and the GitHub requests spent reading them.",
  })
);
const decodeTaskOutcomeRead = S.decodeUnknownEffect(S.fromJsonString(TaskOutcomeRead));

const carriedReads = (loaded: RouteCorpusLoaded, kept: boolean): number =>
  kept ? O.getOrElse(loaded.receipt.taskOutcomeReads, () => 0) : 0;

type FetchedRun = { readonly run: HostedRun; readonly reads: number };

const isFailedJob = (job: HostedJob): boolean => O.exists(job.conclusion, (value) => Str.Equivalence(value, "failure"));

// A record names its job as GitHub lists it; a job reached through a reusable workflow is listed as
// `<caller> / <job>` (the overflow shard), so a record also joins a job whose name starts with `<job> / `.
const recordFor = (records: ReadonlyArray<AnyTaskOutcomeRecord>, job: HostedJob): O.Option<AnyTaskOutcomeRecord> =>
  A.findFirst(records, (record) => record.job === job.name || Str.startsWith(`${record.job} / `)(job.name));

const withTaskOutcomes = (run: HostedRun, records: ReadonlyArray<AnyTaskOutcomeRecord>): HostedRun =>
  HostedRun.make({
    ...run,
    jobs: A.map(run.jobs, (job) =>
      isFailedJob(job)
        ? O.match(recordFor(records, job), {
            onNone: () => job,
            onSome: (record) => HostedJob.make({ ...job, tasks: O.some(record.tasks) }),
          })
        : job
    ),
  });

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

const WorkflowReference = S.String.check(S.isPattern(/^\d+$|\.ya?ml$/u)).pipe(
  $I.annoteSchema("WorkflowReference", {
    description: "A numeric workflow id or YAML filename accepted directly by REST.",
  })
);
const WorkflowWire = S.Struct({ id: S.Int, name: S.String, path: S.String });
const RunWire = S.Struct({
  id: S.Int,
  name: S.NullOr(S.String),
  event: S.String,
  status: S.NullOr(S.String),
  conclusion: S.NullOr(S.String),
  created_at: S.String,
  head_branch: S.NullOr(S.String),
  head_sha: S.String,
  run_attempt: S.optionalKey(S.Int),
});
const StepWire = S.Struct({ name: S.String, conclusion: S.NullOr(S.String) });
const JobWire = S.Struct({
  name: S.NonEmptyString,
  conclusion: S.NullOr(S.String),
  started_at: S.NullOr(S.String),
  completed_at: S.NullOr(S.String),
  steps: StepWire.pipe(S.Array, S.NullOr, S.optionalKey),
});
const decodeWorkflowRows = S.decodeUnknownEffect(S.Array(WorkflowWire));
const decodeRunRows = S.decodeUnknownEffect(S.Array(RunWire));
const decodeJobRows = S.decodeUnknownEffect(S.Array(JobWire));
const ArtifactWire = S.Struct({ id: S.Int, name: S.String, expired: S.Boolean, size_in_bytes: S.Int });
const ArtifactPage = S.Struct({ total_count: S.Int, artifacts: S.Array(ArtifactWire) });
const ArchiveBytes = S.instanceOf(ArrayBuffer);
const decodeRecordJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const ARTIFACT_PAGE = 100;
const ENTRY_INFLATE_BYTES_MAX = 1024 * 1024;
const ARTIFACT_DOWNLOAD_BYTES_MAX = 64 * 1024 * 1024;

const isIndexedGateFile = (file: string): boolean =>
  Str.startsWith(`${GATES_DIR}/`)(file) || pipe(file, Str.includes(`/${GATES_DIR}/`));

const archiveRecords = Effect.fnUntraced(function* (bytes: ArrayBuffer, name: string) {
  const entries = yield* Effect.try({
    try: () =>
      unzipSync(new Uint8Array(bytes), {
        filter: (file) =>
          Str.endsWith(".json")(file.name) &&
          !isIndexedGateFile(file.name) &&
          file.originalSize <= ENTRY_INFLATE_BYTES_MAX,
      }),
    catch: RouteError.mapError("corpus-fetch", `Artifact ${name} is not a zip archive.`),
  });
  return yield* Effect.forEach(
    A.sort(
      R.toEntries(entries),
      Order.mapInput(Order.String, ([file]: readonly [string, Uint8Array]) => file)
    ),
    ([file, content]) =>
      decodeRecordJson(new TextDecoder().decode(content)).pipe(
        Effect.mapError(RouteError.mapError("corpus-fetch", `${name}/${file} is not JSON.`))
      ),
    { concurrency: 1 }
  );
});
const encodeWire = S.encodeEffect(S.fromJsonString(S.Unknown));
const ghRun = (run: typeof RunWire.Type) => ({
  databaseId: run.id,
  workflowName: run.name ?? "",
  event: run.event,
  status: run.status ?? "",
  conclusion: run.conclusion,
  createdAt: run.created_at,
  headBranch: run.head_branch ?? "",
  headSha: run.head_sha,
  attempt: run.run_attempt ?? 1,
});

/**
 * Adapt the recorded corpus protocol to paginated GitHub REST reads.
 *
 * **Details**
 * Display names resolve against every workflow page; numeric ids and workflow
 * filenames go directly to the runs endpoint. The compatibility protocol keeps
 * the corpus decoder and its error wording stable without spawning `gh`.
 *
 * A task-outcome artifact is downloaded only up to 64 MiB, since a
 * `task-outcomes/v2` artifact also carries the job's gate records and raw
 * logs. Inside it, only JSON entries up to 1 MiB inflate, so a crafted
 * archive cannot make the capture expand an entry; the gate records under
 * `.beep/gates/` are skipped, and every other JSON entry is decoded as a
 * `task-outcomes/v1` or `v2` record, so a malformed one fails with its run.
 *
 * **Example** (Inspect the REST runner)
 *
 * ```ts
 * import { makeRouteGithubRunner } from "@beep/repo-cli/commands/Ci/RouteCorpus"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(makeRouteGithubRunner))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
// decision: per-attempt-page-fallback-anchor
export const makeRouteGithubRunner = Effect.gen(function* () {
  const client = yield* GitHubClient;
  const repo = yield* Repo;
  const rest = yield* GithubRest;
  const at = { owner: repo.owner, repo: repo.repo };
  const runGh: RouteGhRunner = (args) =>
    Effect.flatMap(Ref.make(0), (spent) =>
      Effect.gen(function* () {
        if (args[0] === "api") {
          const limit = yield* rest.rateLimit;
          return yield* encodeWire({
            resources: { core: { reset: DateTime.toEpochMillis(limit.core.resetAt) / 1000 } },
          });
        }
        if (args[1] === "list") {
          const workflow = args[3] ?? "";
          const id = S.is(WorkflowReference)(workflow)
            ? workflow
            : yield* client.paginate("GET /repos/{owner}/{repo}/actions/workflows", { ...at, per_page: 100 }).pipe(
                Effect.flatMap((rows) => decodeWorkflowRows(rows)),
                Effect.flatMap((rows) =>
                  Effect.fromOption(
                    A.findFirst(rows, (row) => row.name === workflow),
                    () =>
                      RouteError.new(
                        "corpus-fetch",
                        `gh run list --workflow ${workflow} --created ${args[5]} returned no matching workflow.`
                      )
                  )
                ),
                Effect.map((row) => row.id)
              );
          const rows = yield* client
            .paginate("GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs", {
              ...at,
              workflow_id: id,
              created: args[5] ?? "",
              per_page: 100,
            })
            .pipe(Effect.flatMap(decodeRunRows));
          return yield* encodeWire(A.map(rows, ghRun));
        }
        if (args[1] === "task-outcomes") {
          const runId = yield* S.decodeUnknownEffect(S.FiniteFromString)(args[2]);
          const attempt = yield* S.decodeUnknownEffect(S.FiniteFromString)(args[3]);
          // Paged by hand so every page is counted as it is requested, a page a failed attempt sent included.
          const listPages = (
            page: number,
            seen: ReadonlyArray<typeof ArtifactWire.Type>
          ): Effect.Effect<ReadonlyArray<typeof ArtifactWire.Type>, GitHubError> =>
            Ref.update(spent, (n) => n + 1).pipe(
              Effect.andThen(
                client.requestDecoded(
                  "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts",
                  { ...at, run_id: runId, per_page: ARTIFACT_PAGE, page },
                  ArtifactPage
                )
              ),
              Effect.flatMap((listing) => {
                const all = A.appendAll(seen, listing.artifacts);
                return A.length(listing.artifacts) < ARTIFACT_PAGE || A.length(all) >= listing.total_count
                  ? Effect.succeed(all)
                  : listPages(page + 1, all);
              })
            );
          const artifacts = yield* listPages(1, A.empty());
          const prefix = taskOutcomeArtifactPrefix(runId, attempt);
          const wanted = A.filter(
            artifacts,
            (artifact) =>
              !artifact.expired &&
              Str.startsWith(prefix)(artifact.name) &&
              artifact.size_in_bytes <= ARTIFACT_DOWNLOAD_BYTES_MAX
          );
          const records = yield* Effect.forEach(
            wanted,
            (artifact) =>
              Ref.update(spent, (n) => n + 1).pipe(
                Effect.andThen(
                  client
                    .requestDecoded(
                      "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip",
                      { ...at, artifact_id: artifact.id },
                      ArchiveBytes
                    )
                    .pipe(Effect.flatMap((bytes) => archiveRecords(bytes, artifact.name)))
                )
              ),
            { concurrency: 1 }
          );
          return yield* encodeWire({ requests: yield* Ref.get(spent), records: A.flatten(records) });
        }
        const runId = yield* S.decodeUnknownEffect(S.FiniteFromString)(args[2]);
        const run = yield* client.requestDecoded(
          "GET /repos/{owner}/{repo}/actions/runs/{run_id}",
          { ...at, run_id: runId },
          RunWire
        );
        const jobPages = (perPage: number) =>
          client.paginate("GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs", {
            ...at,
            run_id: runId,
            per_page: perPage,
          });
        const jobs = yield* jobPages(ROUTE_CORPUS_JOB_PAGE).pipe(
          Effect.catchIf(GitHubError.hasKind("transport"), () => jobPages(ROUTE_CORPUS_JOB_FALLBACK_PAGE)),
          Effect.flatMap(decodeJobRows)
        );
        return yield* encodeWire({
          ...ghRun(run),
          jobs: A.map(jobs, (job) => ({
            name: job.name,
            conclusion: job.conclusion,
            startedAt: job.started_at,
            completedAt: job.completed_at,
            steps: job.steps ?? null,
          })),
        });
      }).pipe(
        Effect.mapError(routeGithubFailure(args)),
        Effect.retry({
          times: 2,
          schedule: Schedule.exponential(Duration.seconds(1)),
          while: P.not(P.isTagged("RouteGhRateLimited")),
        }),
        Effect.catchTag("RouteGhRateLimited", (refused) =>
          Effect.flatMap(Ref.get(spent), (requests) => Effect.fail(RouteGhRateLimited.make({ ...refused, requests })))
        )
      )
    );
  return runGh;
}).pipe(Effect.withSpan("RouteCorpus.githubRunner"));

const unreadableCommand = (args: ReadonlyArray<string>): string =>
  args[1] === "list" ? `gh run list --workflow ${args[3]} --created ${args[5]}` : `gh run view ${args[2]}`;

const githubFailure = (args: ReadonlyArray<string>, error: unknown): RouteError | RouteGhRateLimited => {
  const command = A.join(["gh", ...args], " ");
  if (!S.is(GitHubError)(error))
    return RouteError.new("corpus-fetch", `${unreadableCommand(args)} returned an unreadable payload.`, error);
  if (GitHubError.hasKind("rateLimited")(error)) return RouteGhRateLimited.make({ command, output: error.message });
  return RouteError.new(
    "corpus-fetch",
    GitHubError.hasKind("decode")(error)
      ? `${unreadableCommand(args)} returned an unreadable payload.`
      : `${command} exited 1: ${error.message}`,
    error
  );
};

const routeGithubFailure =
  (args: ReadonlyArray<string>) =>
  (error: unknown): RouteError | RouteGhRateLimited =>
    S.is(RouteError)(error) ? error : githubFailure(args, error);

const corpusIdentity = GithubIdentity.make({
  kind: "gh-cli",
  tokenRef: O.none(),
  appId: O.none(),
  installationId: O.none(),
  privateKeyRef: O.none(),
});
const routeGhRunner = Effect.gen(function* () {
  const context = yield* Effect.context<ChildProcessSpawner.ChildProcessSpawner>();
  const runGh: RouteGhRunner = (args, cwd) =>
    Effect.flatMap(
      Layer.build(
        layerGithubRest.pipe(
          Layer.provideMerge(
            Layer.mergeAll(
              layerGithubClientFor(GithubClientRequest.make({ identity: corpusIdentity, cwd }), { retry: "off" }),
              layerGithubRepoFor(cwd)
            )
          )
        )
      ),
      (services) =>
        Effect.provideContext(
          Effect.flatMap(makeRouteGithubRunner, (run) => run(args, cwd)),
          services
        )
    ).pipe(
      Effect.scoped,
      // The build-time context fills in only what the call's own context lacks, so a sink the
      // caller provides (the read budget's request counter) reaches the transport.
      Effect.updateContext((current: Context.Context<never>) => Context.merge(context, current)),
      Effect.mapError((error): RouteError | RouteGhRateLimited =>
        S.is(RouteError)(error) || S.is(RouteGhRateLimited)(error)
          ? error
          : RouteError.new("corpus-fetch", "Failed to initialize GitHub corpus reads.", error)
      )
    );
  return runGh;
});

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
  const lines = yield* gunzipText(bytes, file).pipe(Effect.flatMap((text) => corpusLines(text, file)));
  return yield* Effect.forEach(
    lines,
    (line, index) =>
      decodeHostedRunLine(line).pipe(
        Effect.mapError(RouteError.mapError("corpus-pin", `${file} line ${index + 1} is not a HostedRun.`))
      ),
    { concurrency: 1 }
  );
});

const encodeCorpus = Effect.fnUntraced(function* (
  runs: ReadonlyArray<HostedRun>,
  file: string
): Effect.fn.Return<Uint8Array, RouteError> {
  const lines = yield* Effect.forEach(
    runs,
    (run) =>
      encodeHostedRunLine(run).pipe(
        Effect.mapError(RouteError.mapError("corpus-pin", `Failed to encode run ${run.runId} for ${file}.`))
      ),
    { concurrency: 1 }
  );
  const text = A.match(lines, { onEmpty: () => "", onNonEmpty: (nonEmpty) => `${A.join(nonEmpty, "\n")}\n` });
  return yield* gzipText(text, file);
});

type CaptureState = {
  readonly runs: HashMap.HashMap<number, HostedRun>;
  readonly pinned: O.Option<string>;
  readonly covered: string;
  readonly open: boolean;
  readonly reads: number;
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
 * interrupted switch leaves the previous receipt and its corpus intact. A job
 * that concluded `failure` keeps its step names and conclusions; no other job
 * keeps steps, and runs already pinned are never re-fetched for them.
 *
 * The receipt's `until` is the last fully captured day. A day with an
 * eligible run that has not finished stays open: its finished runs are
 * pinned, but `until` stops before it, so the next capture lists it again. A
 * rerun whose `since` falls inside the receipt and whose workflows match
 * continues from the day after `until`. An earlier `since` or another set of
 * workflows starts the window again; a later `since` that would leave a gap
 * fails, because the receipt could not describe it.
 *
 * Capture is a background reader: before each call it waits while the
 * capture identity's `core` bucket is below `github-budget-ledger`'s 15%
 * reserve, and it counts every response (see {@link RouteReadBudgetShape};
 * without `budget` the calls are counted but never held).
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
 * @param budget - The read budget that admits and counts each call; unmetered when absent.
 * @returns The {@link RouteCorpusShape} implementation, closed over the file system, path and crypto services.
 * @category constructors
 * @since 0.0.0
 */
export const makeRouteCorpus = Effect.fn("RouteCorpus.make")(function* (
  runGh: RouteGhRunner,
  budget?: RouteReadBudgetShape
): Effect.fn.Return<
  RouteCorpusShape,
  never,
  FileSystem.FileSystem | Path.Path | Digest.Digest | SecureRandom.SecureRandom
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const context = yield* Effect.context<Digest.Digest | SecureRandom.SecureRandom>();
  const meter = budget ?? (yield* makeRouteReadBudget(O.none()));
  const gh: RouteGhRunner = (args, repoRoot) => meter.metered(runGh(args, repoRoot));

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

  const readExisting = Effect.fnUntraced(function* (corpusPath: string): Effect.fn.Return<CaptureState, RouteError> {
    const bytes = yield* readCorpusBytes(corpusPath);
    const runs = yield* decodeCorpus(bytes, corpusPath);
    return {
      runs: HashMap.fromIterable(A.map(runs, (run): readonly [number, HostedRun] => [run.runId, run])),
      pinned: yield* Effect.asSome(digest(bytes, corpusPath)),
      covered: "",
      open: true,
      reads: 0,
    };
  });

  const rateLimitReset = (repoRoot: string): Effect.Effect<O.Option<DateTime.Utc>> =>
    gh(["api", "rate_limit"], repoRoot).pipe(
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
    meter.admit(label).pipe(
      Effect.andThen(gh(args, repoRoot)),
      Effect.catchTag("RouteGhRateLimited", () => waitForReset(label, repoRoot, gh(args, repoRoot)))
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
  ): Effect.fn.Return<O.Option<FetchedRun>, RouteError> {
    const text = yield* callGh(`gh run view ${runId}`, ["run", "view", `${runId}`, "--json", GH_VIEW_FIELDS], repoRoot);
    const view = yield* decodeGhRunView(text).pipe(
      Effect.mapError(RouteError.mapError("corpus-fetch", `gh run view ${runId} returned an unreadable payload.`))
    );
    if (view.databaseId !== runId) {
      return yield* RouteError.new("corpus-fetch", `gh run view ${runId} answered for run ${view.databaseId}.`);
    }
    // A rerun can start between the list and the view: the view then shows the
    // newer, unfinished attempt, which is not evidence yet.
    if (view.status !== "completed") {
      return O.none();
    }
    const run = hostedRunOf(view);
    if (!A.some(run.jobs, isFailedJob)) {
      return O.some({ run, reads: 0 });
    }
    const label = `gh run task-outcomes ${runId} ${view.attempt}`;
    const carried = yield* Ref.make(0);
    const attemptRead = gh(["run", "task-outcomes", `${runId}`, `${view.attempt}`], repoRoot).pipe(
      Effect.tapErrorTag("RouteGhRateLimited", (refused) => Ref.update(carried, (n) => n + refused.requests))
    );
    const admittedRead = meter.admit(label).pipe(Effect.andThen(attemptRead));
    const outcomes = yield* admittedRead.pipe(
      Effect.catchTag("RouteGhRateLimited", () => waitForReset(label, repoRoot, admittedRead))
    );
    const read = yield* decodeTaskOutcomeRead(outcomes).pipe(
      Effect.mapError(RouteError.mapError("corpus-fetch", `${label} returned an unreadable payload.`))
    );
    const before = yield* Ref.get(carried);
    return O.some({ run: withTaskOutcomes(run, read.records), reads: read.requests + before });
  });

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
    const loaded = (yield* exists(receiptPath)) ? yield* Effect.asSome(load(receiptPath)) : O.none();
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
          reads: carriedReads(loaded.value, A.every(loaded.value.runs, inWindow)),
        }
      : (yield* exists(corpusPath))
        ? yield* readExisting(corpusPath)
        : { runs: HashMap.empty(), pinned: O.none(), covered: "", open: true, reads: 0 };
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
        taskOutcomeReads: O.some(state.reads),
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
      const forEach2 = yield* Effect.forEach(plan.workflows, (workflow) => listDay(options.repoRoot, workflow, day), {
        concurrency: ROUTE_CORPUS_FETCH_CONCURRENCY,
      });
      const listed = A.flatten(forEach2);
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
      const read = A.getSomes(viewed);
      const fetched = A.map(read, (entry) => entry.run);
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
        reads: A.reduce(read, state.reads, (total, entry) => total + entry.reads),
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
 * The corpus service over GitHub REST using the current gh login.
 *
 * **Details**
 *
 * REST reads resolve the repository from `GH_REPO` or the capture checkout's origin.
 * The gh login supplies the token. A failed call is retried twice with
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
> = Layer.effect(
  RouteCorpus,
  Effect.gen(function* () {
    const runner = yield* routeGhRunner;
    const budget = yield* Effect.serviceOption(RouteReadBudget);
    return yield* makeRouteCorpus(runner, O.getOrUndefined(budget));
  })
);
