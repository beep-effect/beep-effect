/**
 * `bun run beep ci fleet-missed-event-check`: the standing, read-only check
 * for `beep-fleet-*` jobs GitHub queued and the new fleet never served.
 *
 * **Details**
 *
 * One run reads the org runners, waits 300 seconds through {@link FleetSleep},
 * reads them again, reads every queued, in-progress and recent run's jobs
 * with full paging, and walks the hook deliveries once (newest first, back to
 * the oldest job that needs them minus two minutes). For each job it reads
 * its window's `queued` delivery details nearest the job's creation first,
 * four at a time, and stops at the first 2xx delivery naming the job; only a
 * job without one reads every candidate. A listing cut at 50 pages short of
 * its total fails the run. It
 * prints the step summary, with the number of GitHub requests the reads
 * service counted, and exits non-zero on any alert. It
 * never redelivers, cancels, reruns or writes: the remedies are printed.
 *
 * `--guard` runs the workflow's guard instead: it reads the previous
 * checking run (the newest earlier run of the workflow, from any event, that
 * ran its check job, looking past guard-skipped runs) and writes `run=false`
 * to `$GITHUB_OUTPUT` when that run's check started less than eight minutes
 * ago, `run=true` otherwise. A `workflow_dispatch` always runs, and a read
 * failure fails open.
 *
 * Specification:
 * `goals/infra-alchemy-rebuild/decisions/2026-11-23-standing-missed-event-check.md`.
 *
 * @since 0.0.0
 */

import { ActionOutputs } from "@beep/github-actions/ActionOutputs";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { identity, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { CiCommandError, reportCiCommandError } from "./Ci.errors.ts";
import { CiRunnerOutputsLive } from "./CiRunnerOutputs.ts";
import { layerFleetGithubReadsLive } from "./FleetMissedEvent.live.ts";
import {
  FLEET_RUNNER_READ_GAP,
  FLEET_THRESHOLDS,
  FleetCheckJob,
  FleetDeliveryEvidence,
  FleetGuardDecision,
  FleetGuardInput,
  FleetHookSource,
  FleetMissedEventInput,
  FleetPreviousRun,
  FleetRunsQuery,
  fleetHookSources,
} from "./FleetMissedEvent.schemas.ts";
import { FleetGithubReads, FleetReadError, FleetSleep, FleetWatchToken } from "./FleetMissedEvent.service.ts";
import {
  checkingRun,
  deliveryCandidates,
  earlierFleetRuns,
  fleetAlerts,
  fleetCheckReport,
  fleetGuardDecision,
  fleetJobFinding,
  fleetPreviousRun,
  isSuccessfulDelivery,
  judgeDeliveryEvidence,
  needsDeliveryEvidence,
  observeFleetPool,
  productionFleetPools,
  queuedFleetJobs,
  renderFleetCheckSummary,
  renderFleetGuardDecision,
} from "./FleetMissedEvent.ts";
import type * as HttpClient from "effect/http/HttpClient";
import type {
  FleetCheckingRun,
  FleetCheckReport,
  FleetDeliveryDetail,
  FleetDeliveryId,
  FleetHookDelivery,
  FleetJob,
  FleetQueuedJob,
  FleetRunner,
} from "./FleetMissedEvent.schemas.ts";
import type { FleetGithubReadsShape } from "./FleetMissedEvent.service.ts";

const READ_ATTEMPTS = 3;
const READ_RETRY_SPACING = Duration.seconds(2);
const MAX_LISTING_PAGES = 50;
const MAX_DELIVERY_PAGES = 60;
const JOB_READ_CONCURRENCY = 4;

type Sleep = (duration: Duration.Duration) => Effect.Effect<void>;

const retried =
  (sleep: Sleep) =>
  <A>(read: () => Effect.Effect<A, FleetReadError>): Effect.Effect<A, FleetReadError> => {
    const attempt = (n: number): Effect.Effect<A, FleetReadError> =>
      read().pipe(
        Effect.catchTag("FleetReadError", (error) =>
          n >= READ_ATTEMPTS ? Effect.fail(error) : Effect.andThen(sleep(READ_RETRY_SPACING), attempt(n + 1))
        )
      );
    return attempt(1);
  };

const MAX_LISTING_WALKS = 3;

interface ListingPage<A> {
  readonly items: ReadonlyArray<A>;
  readonly totalCount: number;
}

interface ListingWalk<A> {
  readonly consistent: boolean;
  readonly items: ReadonlyArray<A>;
  readonly keys: HashSet.HashSet<number>;
  readonly pages: number;
}

const walkListing = <A>(
  endpoint: string,
  readPage: (page: number) => Effect.Effect<ListingPage<A>, FleetReadError>,
  keyOf: (item: A) => number
): Effect.Effect<ListingWalk<A>, FleetReadError> => {
  const finish = (items: ReadonlyArray<A>, pages: number, totalsAgree: boolean): ListingWalk<A> => {
    const keys = HashSet.fromIterable(A.map(items, keyOf));
    return { items, keys, pages, consistent: totalsAgree && HashSet.size(keys) === A.length(items) };
  };
  const go = (
    page: number,
    collected: ReadonlyArray<A>,
    firstTotal: O.Option<number>
  ): Effect.Effect<ListingWalk<A>, FleetReadError> =>
    Effect.flatMap(readPage(page), ({ items, totalCount }) => {
      const all = A.appendAll(collected, items);
      const total = O.getOrElse(firstTotal, () => totalCount);
      const totalsAgree = total === totalCount;
      return A.isReadonlyArrayEmpty(items) && A.length(all) < totalCount
        ? Effect.fail(
            FleetReadError.make({
              endpoint,
              message: `listing stopped at page ${page} with ${A.length(all)} of ${totalCount} items`,
            })
          )
        : !totalsAgree || A.length(all) >= totalCount
          ? Effect.succeed(finish(all, page, totalsAgree))
          : page < MAX_LISTING_PAGES
            ? go(page + 1, all, O.some(total))
            : Effect.fail(
                FleetReadError.make({ endpoint, message: `listing truncated at ${MAX_LISTING_PAGES} pages` })
              );
    });
  return go(1, A.empty(), O.none());
};

const walksAgree = <A>(previous: O.Option<ListingWalk<A>>, walk: ListingWalk<A>): boolean =>
  O.exists(
    previous,
    (earlier) =>
      earlier.consistent &&
      HashSet.size(earlier.keys) === HashSet.size(walk.keys) &&
      HashSet.isSubset(earlier.keys, walk.keys)
  );

interface SettledListing<A> {
  readonly items: ReadonlyArray<A>;
  readonly note: O.Option<string>;
}

const unionOfWalks = <A>(walks: ReadonlyArray<ListingWalk<A>>, keyOf: (item: A) => number): ReadonlyArray<A> => {
  const items = A.flatMap(walks, (walk) => walk.items);
  const latest = A.reduce(items, HashMap.empty<number, A>(), (acc, item) => HashMap.set(acc, keyOf(item), item));
  return A.getSomes(A.map(A.dedupe(A.map(items, keyOf)), (key) => HashMap.get(latest, key)));
};

const allPages = <A>(
  endpoint: string,
  readPage: (page: number) => Effect.Effect<ListingPage<A>, FleetReadError>,
  keyOf: (item: A) => number
): Effect.Effect<SettledListing<A>, FleetReadError> => {
  const settle = (walks: ReadonlyArray<ListingWalk<A>>): Effect.Effect<SettledListing<A>, FleetReadError> =>
    Effect.flatMap(walkListing(endpoint, readPage, keyOf), (walk) => {
      const walked = A.append(walks, walk);
      const confirmed = A.isReadonlyArrayEmpty(walks) ? walk.pages === 1 : walksAgree(A.last(walks), walk);
      return walk.consistent && confirmed
        ? Effect.succeed({ items: walk.items, note: O.none() })
        : A.length(walked) >= MAX_LISTING_WALKS
          ? Effect.succeed({
              items: unionOfWalks(walked, keyOf),
              note: O.some(`${endpoint}: listing unstable (${A.length(walked)} walks)`),
            })
          : settle(walked);
    });
  return settle(A.empty());
};

const noted =
  (notes: Ref.Ref<ReadonlyArray<string>>) =>
  <A>(listing: SettledListing<A>): Effect.Effect<ReadonlyArray<A>> =>
    Effect.as(
      Ref.update(notes, (all) => A.appendAll(all, O.toArray(listing.note))),
      listing.items
    );

const asCommandError = (error: FleetReadError): CiCommandError =>
  CiCommandError.make({ message: `GitHub read ${error.endpoint} failed: ${error.message}` });

interface FleetReadContext {
  readonly notes: Ref.Ref<ReadonlyArray<string>>;
  readonly reads: FleetGithubReadsShape;
  readonly retry: <A>(read: () => Effect.Effect<A, FleetReadError>) => Effect.Effect<A, FleetReadError>;
}

const readRunners = (context: FleetReadContext): Effect.Effect<ReadonlyArray<FleetRunner>, FleetReadError> =>
  allPages(
    "org runners",
    (page) =>
      Effect.map(
        context.retry(() => context.reads.runnersPage(page)),
        (read) => ({
          items: read.runners,
          totalCount: read.totalCount,
        })
      ),
    (runner) => runner.id
  ).pipe(Effect.flatMap(noted(context.notes)));

const readRunIds = (context: FleetReadContext, query: FleetRunsQuery) =>
  allPages(
    `runs ${query._tag}`,
    (page) =>
      Effect.map(
        context.retry(() => context.reads.runsPage(query, page)),
        (read) => ({
          items: read.runIds,
          totalCount: read.totalCount,
        })
      ),
    identity
  ).pipe(Effect.flatMap(noted(context.notes)));

const readRunJobs = (context: FleetReadContext, runId: number) =>
  allPages(
    `runs/${runId}/jobs`,
    (page) =>
      Effect.map(
        context.retry(() => context.reads.jobsPage(runId, page)),
        (read) => ({
          items: read.jobs,
          totalCount: read.totalCount,
        })
      ),
    (job) => job.id
  ).pipe(Effect.flatMap(noted(context.notes)));

const readPoolJobs = Effect.fnUntraced(function* (
  context: FleetReadContext,
  labels: HashSet.HashSet<string>,
  queryAt: number
) {
  const queries = [
    FleetRunsQuery.cases.ByStatus.make({ status: "queued" }),
    FleetRunsQuery.cases.ByStatus.make({ status: "in_progress" }),
    FleetRunsQuery.cases.CreatedSince.make({ since: queryAt - FLEET_THRESHOLDS.lookback }),
  ];
  const runIds = yield* Effect.forEach(queries, (query) => readRunIds(context, query), { concurrency: 1 });
  const unique = A.fromIterable(HashSet.fromIterable(A.flatten(runIds)));
  const jobs = yield* Effect.forEach(unique, (runId) => readRunJobs(context, runId), {
    concurrency: JOB_READ_CONCURRENCY,
  });
  return {
    jobs: A.filter(A.flatten(jobs), (job: FleetJob) => A.some(job.labels, (label) => HashSet.has(labels, label))),
    lookbackRunIds: HashSet.fromIterable(O.getOrElse(A.last(runIds), A.empty<number>)),
  };
});

interface DeliveryWalk {
  readonly deliveries: ReadonlyArray<FleetHookDelivery>;
  readonly failure: O.Option<string>;
  readonly listingEnded: boolean;
  readonly oldestReached: O.Option<number>;
}

const walkDeliveries = (context: FleetReadContext, hookId: FleetDeliveryId, stopAt: number) => {
  const go = (cursor: O.Option<string>, pages: number, walk: DeliveryWalk): Effect.Effect<DeliveryWalk> =>
    context
      .retry(() => context.reads.deliveriesPage(hookId, cursor))
      .pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            Effect.succeed({
              ...walk,
              failure: O.some(`a delivery page read failed after ${READ_ATTEMPTS} attempts (${error.message})`),
            }),
          onSuccess: (page) => {
            const oldestReached = O.orElse(
              O.map(A.last(page.deliveries), (delivery) => delivery.deliveredAt),
              () => walk.oldestReached
            );
            const next = { ...walk, deliveries: A.appendAll(walk.deliveries, page.deliveries), oldestReached };
            const reached =
              A.isReadonlyArrayEmpty(page.deliveries) || O.exists(oldestReached, (oldest) => oldest < stopAt);
            const capped: DeliveryWalk = {
              ...next,
              failure: O.some(`the delivery walk stopped at ${MAX_DELIVERY_PAGES} pages`),
            };
            return O.match(page.nextCursor, {
              onNone: () => Effect.succeed({ ...next, listingEnded: true }),
              onSome: (nextCursor) =>
                reached
                  ? Effect.succeed(next)
                  : pages + 1 >= MAX_DELIVERY_PAGES
                    ? Effect.succeed(capped)
                    : go(O.some(nextCursor), pages + 1, next),
            });
          },
        })
      );
  return go(O.none(), 0, { deliveries: A.empty(), oldestReached: O.none(), failure: O.none(), listingEnded: false });
};

type DetailReads = HashMap.HashMap<string, O.Option<FleetDeliveryDetail>>;

const nearestCreationFirst = (job: FleetJob): Order.Order<FleetHookDelivery> =>
  Order.mapInput(Order.Number, (delivery: FleetHookDelivery) => Math.abs(delivery.deliveredAt - job.createdAt));

const deliversJob = (job: FleetJob, details: DetailReads) => (delivery: FleetHookDelivery) =>
  isSuccessfulDelivery(delivery) &&
  O.exists(O.flatten(HashMap.get(details, delivery.id)), (detail) => O.contains(detail.workflowJobId, `${job.id}`));

const searchJobDetails = (
  context: FleetReadContext,
  hookId: FleetDeliveryId,
  job: FleetJob,
  candidates: ReadonlyArray<FleetHookDelivery>,
  details: DetailReads
): Effect.Effect<DetailReads> => {
  const unread = A.filter(candidates, (delivery) => !HashMap.has(details, delivery.id));
  return A.some(candidates, deliversJob(job, details)) || A.isReadonlyArrayEmpty(unread)
    ? Effect.succeed(details)
    : Effect.forEach(
        A.take(unread, JOB_READ_CONCURRENCY),
        (delivery) =>
          context
            .retry(() => context.reads.deliveryDetail(hookId, delivery.id))
            .pipe(
              Effect.option,
              Effect.map((detail): readonly [string, O.Option<FleetDeliveryDetail>] => [delivery.id, detail])
            ),
        { concurrency: JOB_READ_CONCURRENCY }
      ).pipe(
        Effect.flatMap((reads) =>
          searchJobDetails(
            context,
            hookId,
            job,
            candidates,
            A.reduce(reads, details, (acc, [id, detail]) => HashMap.set(acc, id, detail))
          )
        )
      );
};

const readDetails = (
  context: FleetReadContext,
  hookId: FleetDeliveryId,
  jobs: ReadonlyArray<FleetJob>,
  deliveries: ReadonlyArray<FleetHookDelivery>
): Effect.Effect<DetailReads> =>
  Effect.reduce(jobs, HashMap.empty<string, O.Option<FleetDeliveryDetail>>, (details, job) =>
    searchJobDetails(
      context,
      hookId,
      job,
      A.sort(deliveryCandidates(job, deliveries), nearestCreationFirst(job)),
      details
    )
  );

const hookEvidence = Effect.fnUntraced(function* (
  context: FleetReadContext,
  hookId: FleetDeliveryId,
  jobs: ReadonlyArray<FleetJob>
) {
  const stopAt =
    A.reduce(jobs, Number.POSITIVE_INFINITY, (oldest, job) => Math.min(oldest, job.createdAt)) -
    FLEET_THRESHOLDS.deliveryLead;
  const walk = yield* walkDeliveries(context, hookId, stopAt);
  const details = yield* readDetails(context, hookId, jobs, walk.deliveries);
  return A.map(jobs, (job): readonly [number, FleetDeliveryEvidence] => [
    job.id,
    judgeDeliveryEvidence({
      job,
      hookId,
      deliveries: walk.deliveries,
      oldestReached: walk.oldestReached,
      walkFailure: walk.failure,
      listingEnded: walk.listingEnded,
      details,
    }),
  ]);
});

const collectEvidence = Effect.fnUntraced(function* (
  context: FleetReadContext,
  queued: ReadonlyArray<FleetQueuedJob>,
  now: number
) {
  const byHook = A.reduce(queued, HashMap.empty<string, ReadonlyArray<FleetJob>>(), (acc, entry) =>
    FleetHookSource.guards.RepositoryHook(entry.source) && needsDeliveryEvidence(entry, now)
      ? HashMap.set(
          acc,
          entry.source.hookId,
          A.append(O.getOrElse(HashMap.get(acc, entry.source.hookId), A.empty<FleetJob>), entry.job)
        )
      : acc
  );
  const read = yield* Effect.forEach(A.fromIterable(byHook), ([hookId, jobs]) => hookEvidence(context, hookId, jobs), {
    concurrency: 1,
  });
  const gate = A.map(
    A.filter(queued, (entry) => FleetHookSource.guards.NoHook(entry.source)),
    (entry): readonly [number, FleetDeliveryEvidence] => [entry.job.id, FleetDeliveryEvidence.cases.Gate.make({})]
  );
  return HashMap.fromIterable(A.appendAll(A.flatten(read), gate));
});

interface FleetRunReads {
  readonly reads: FleetGithubReadsShape;
  readonly retry: <A>(read: () => Effect.Effect<A, FleetReadError>) => Effect.Effect<A, FleetReadError>;
}

const previousCheckingRun = (
  context: FleetRunReads,
  workflowFile: string,
  currentRunId: O.Option<number>
): Effect.Effect<O.Option<FleetCheckingRun>, FleetReadError> =>
  context
    .retry(() => context.reads.workflowRuns(workflowFile))
    .pipe(
      Effect.flatMap((runs) =>
        Effect.findFirstFilter(earlierFleetRuns(runs, currentRunId), (run) =>
          context
            .retry(() => context.reads.checkJob(run.id))
            .pipe(Effect.map((job) => Result.fromOption(checkingRun(run, job), () => run)))
        )
      )
    );

const currentCheckStart = (
  context: FleetRunReads,
  currentRunId: O.Option<number>,
  previous: O.Option<FleetCheckingRun>
): Effect.Effect<O.Option<number>> =>
  O.isNone(previous)
    ? Effect.succeedNone
    : O.match(currentRunId, {
        onNone: () => Effect.succeedNone,
        onSome: (runId) =>
          context
            .retry(() => context.reads.checkJob(runId))
            .pipe(
              Effect.map(
                FleetCheckJob.match({
                  Ran: ({ startedAt }) => O.some(startedAt),
                  NotRan: () => O.none<number>(),
                })
              ),
              Effect.orElseSucceed(O.none<number>)
            ),
      });

/**
 * Run the check once: read, judge, print the summary, and append it to
 * `$GITHUB_STEP_SUMMARY` when that is set.
 *
 * **Example** (Build a run)
 *
 * ```ts
 * import { FleetMissedEventInput, fleetHookSources, productionFleetPools, runFleetMissedEventCheck } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const input = FleetMissedEventInput.make({
 *   repository: "beep-effect/beep-effect",
 *   workflowFile: "fleet-missed-event-check.yml",
 *   currentRunId: O.none(),
 *   stepSummary: false,
 *   pools: productionFleetPools,
 *   hookSources: fleetHookSources,
 * })
 * console.log(Effect.isEffect(runFleetMissedEventCheck(input))) // true
 * ```
 *
 * @param input - The resolved inputs.
 * @returns The run's report.
 * @category use-cases
 * @since 0.0.0
 */
export const runFleetMissedEventCheck = Effect.fn("Ci.runFleetMissedEventCheck")(function* (
  input: FleetMissedEventInput
): Effect.fn.Return<FleetCheckReport, CiCommandError, FleetGithubReads | FleetSleep | ActionOutputs> {
  const reads = yield* FleetGithubReads;
  const { sleep } = yield* FleetSleep;
  const notes = yield* Ref.make<ReadonlyArray<string>>(A.empty());
  const context: FleetReadContext = { notes, reads, retry: retried(sleep) };
  const firstReadAt = yield* Clock.currentTimeMillis;
  const firstRead = yield* readRunners(context).pipe(Effect.mapError(asCommandError));
  yield* sleep(FLEET_RUNNER_READ_GAP);
  const secondRead = yield* readRunners(context).pipe(Effect.mapError(asCommandError));
  const queryAt = yield* Clock.currentTimeMillis;
  const labels = HashSet.fromIterable(A.map(input.pools, (pool) => pool.label));
  const { jobs, lookbackRunIds } = yield* readPoolJobs(context, labels, queryAt).pipe(Effect.mapError(asCommandError));
  const now = yield* Clock.currentTimeMillis;
  const observations = A.map(input.pools, (pool) =>
    observeFleetPool({ pool, firstReadAt, firstRead, secondRead, jobs, now })
  );
  const queued = queuedFleetJobs({ observations, jobs, lookbackRunIds, hookSources: input.hookSources, now });
  const evidence = yield* collectEvidence(context, queued, now);
  const previousRun = yield* previousCheckingRun(context, input.workflowFile, input.currentRunId).pipe(
    Effect.flatMap((previous) =>
      Effect.map(currentCheckStart(context, input.currentRunId, previous), (currentStartedAt) =>
        fleetPreviousRun({ previous, currentStartedAt, jobs, checkedAt: now })
      )
    ),
    Effect.catchTag("FleetReadError", (error) =>
      Effect.succeed(FleetPreviousRun.cases.Unreadable.make({ reason: error.message }))
    )
  );
  const report = fleetCheckReport({
    repository: input.repository,
    checkedAt: now,
    pools: observations,
    findings: A.map(queued, (entry) => fleetJobFinding(entry, HashMap.get(evidence, entry.job.id))),
    previousRun,
    githubRequests: yield* reads.requestCount,
    listingNotes: yield* Ref.get(notes),
  });
  const summary = renderFleetCheckSummary(report);
  yield* Console.log(summary);
  if (input.stepSummary) {
    const outputs = yield* ActionOutputs;
    yield* outputs
      .summary(summary)
      .pipe(CiCommandError.mapError("Failed to append the missed-event check to $GITHUB_STEP_SUMMARY."));
  }
  return report;
});

/**
 * Run the workflow's guard once: decide whether this run's check job runs,
 * print the decision, and write `run=true` or `run=false` to
 * `$GITHUB_OUTPUT` when asked.
 *
 * **Details**
 *
 * A `workflow_dispatch` reads nothing and runs. Otherwise the guard reads the
 * previous checking run the check itself names, and any read failure, the
 * token included, fails open to `run=true`.
 *
 * **Example** (Build a guard run)
 *
 * ```ts
 * import { FleetGuardInput, runFleetMissedEventGuard } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const input = FleetGuardInput.make({
 *   repository: "beep-effect/beep-effect",
 *   workflowFile: "fleet-missed-event-check.yml",
 *   currentRunId: O.none(),
 *   event: "workflow_run",
 *   githubOutput: false,
 * })
 * console.log(Effect.isEffect(runFleetMissedEventGuard(input))) // true
 * ```
 *
 * @param input - The resolved guard inputs.
 * @returns The guard's decision.
 * @category use-cases
 * @since 0.0.0
 */
export const runFleetMissedEventGuard = Effect.fn("Ci.runFleetMissedEventGuard")(function* (
  input: FleetGuardInput
): Effect.fn.Return<FleetGuardDecision, CiCommandError, FleetGithubReads | FleetSleep | ActionOutputs> {
  const reads = yield* FleetGithubReads;
  const { sleep } = yield* FleetSleep;
  const context: FleetRunReads = { reads, retry: retried(sleep) };
  const previous =
    input.event === "workflow_dispatch"
      ? Result.succeed(O.none<FleetCheckingRun>())
      : yield* previousCheckingRun(context, input.workflowFile, input.currentRunId).pipe(
          Effect.result,
          Effect.map(Result.mapError((error) => `${error.endpoint}: ${error.message}`))
        );
  const now = yield* Clock.currentTimeMillis;
  const decision = fleetGuardDecision({ event: input.event, now, previous });
  yield* Console.log(renderFleetGuardDecision(decision, now));
  if (input.githubOutput) {
    const outputs = yield* ActionOutputs;
    yield* outputs
      .set("run", FleetGuardDecision.guards.Skip(decision) ? "false" : "true")
      .pipe(CiCommandError.mapError("Failed to append the guard decision to $GITHUB_OUTPUT."));
  }
  return decision;
});

/**
 * Fail when a report holds any alert, so the run exits non-zero.
 *
 * **Example** (A green report passes)
 *
 * ```ts
 * import { FleetCheckReport, FleetPreviousRun, failOnFleetAlerts } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const report = FleetCheckReport.make({
 *   repository: "beep-effect/beep-effect",
 *   checkedAt: 0,
 *   pools: [],
 *   findings: [],
 *   previousRun: FleetPreviousRun.cases.NoneFound.make({}),
 * })
 * console.log(Effect.isEffect(failOnFleetAlerts(report))) // true
 * ```
 *
 * @param report - The run's report.
 * @returns Success when no finding alerts.
 * @category use-cases
 * @since 0.0.0
 */
export const failOnFleetAlerts = (report: FleetCheckReport): Effect.Effect<void, CiCommandError> =>
  A.match(fleetAlerts(report), {
    onEmpty: () => Effect.void,
    onNonEmpty: (alerts) =>
      Effect.fail(
        CiCommandError.make({ message: `fleet missed-event check: ${A.length(alerts)} alert(s); see the step summary` })
      ),
  });

const optionalEnv = (name: string) =>
  Config.option(Config.String(name)).pipe(Effect.orElseSucceed(O.none<string>), Effect.map(O.filter(Str.isNonEmpty)));

const resolveInput = Effect.fn("Ci.resolveFleetMissedEventInput")(function* (flags: {
  readonly repository: O.Option<string>;
  readonly workflowFile: string;
}) {
  const repository = yield* pipe(
    flags.repository,
    O.match({ onNone: () => optionalEnv("GH_REPO"), onSome: Effect.succeedSome }),
    Effect.flatMap(
      O.match({
        onNone: () => Effect.fail(CiCommandError.make({ message: "Pass --repository or set GH_REPO." })),
        onSome: Effect.succeed,
      })
    )
  );
  const runIdText = yield* optionalEnv("GITHUB_RUN_ID");
  const currentRunId = O.flatMap(runIdText, (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) ? O.some(id) : O.none();
  });
  const summaryPath = yield* optionalEnv("GITHUB_STEP_SUMMARY");
  const stepSummary = O.isSome(summaryPath);
  return FleetMissedEventInput.make({
    repository,
    workflowFile: flags.workflowFile,
    currentRunId,
    stepSummary,
    pools: productionFleetPools,
    hookSources: fleetHookSources,
  });
});

const resolveGuardInput = Effect.fn("Ci.resolveFleetGuardInput")(function* (input: FleetMissedEventInput) {
  const event = yield* optionalEnv("GITHUB_EVENT_NAME");
  const outputPath = yield* optionalEnv("GITHUB_OUTPUT");
  return FleetGuardInput.make({
    repository: input.repository,
    workflowFile: input.workflowFile,
    currentRunId: input.currentRunId,
    event: O.getOrElse(event, () => "local"),
    githubOutput: O.isSome(outputPath),
  });
});

/**
 * The live services of one run: the GitHub reads over the minted token in
 * `GH_TOKEN`, and the real sleep.
 *
 * **Example** (Build the live layer)
 *
 * ```ts
 * import { layerFleetMissedEventLive } from "@beep/repo-cli/commands/Ci"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerFleetMissedEventLive("beep-effect/beep-effect"))) // true
 * ```
 *
 * @param repository - The `owner/name` repository.
 * @returns A layer of the reads and the sleep seam.
 * @category layers
 * @since 0.0.0
 */
export const layerFleetMissedEventLive = (
  repository: string
): Layer.Layer<FleetGithubReads | FleetSleep, never, HttpClient.HttpClient> =>
  Layer.mergeAll(
    layerFleetGithubReadsLive(repository).pipe(Layer.provide(FleetWatchToken.layerEnv)),
    FleetSleep.layerLive
  );

/**
 * The `ci fleet-missed-event-check` subcommand.
 *
 * **Example** (Register the subcommand)
 *
 * ```ts
 * import { ciFleetMissedEventCheckCommand } from "@beep/repo-cli/commands/Ci"
 * import * as Command from "effect/cli/Command"
 *
 * const ci = Command.make("ci").pipe(Command.withSubcommands([ciFleetMissedEventCheckCommand]))
 * console.log(typeof ci) // "object"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciFleetMissedEventCheckCommand = Command.make(
  "fleet-missed-event-check",
  {
    repository: Flag.String("repository").pipe(
      Flag.optional,
      Flag.withDescription("The owner/name repository to check (default: GH_REPO)")
    ),
    workflowFile: Flag.String("workflow-file").pipe(
      Flag.withDefault("fleet-missed-event-check.yml"),
      Flag.withDescription("The check's own workflow file, whose previous check run the summary names")
    ),
    guard: Flag.Boolean("guard").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "Run the workflow's guard: write run=false to GITHUB_OUTPUT when a check started less than 8 minutes ago"
      )
    ),
  },
  (flags) =>
    pipe(
      resolveInput(flags),
      Effect.flatMap((input) =>
        Effect.flatMap(Layer.build(layerFleetMissedEventLive(input.repository)), (context) =>
          flags.guard
            ? Effect.provideContext(Effect.flatMap(resolveGuardInput(input), runFleetMissedEventGuard), context).pipe(
                Effect.asVoid
              )
            : Effect.provideContext(Effect.flatMap(runFleetMissedEventCheck(input), failOnFleetAlerts), context)
        ).pipe(Effect.scoped)
      ),
      Effect.catchTag("CiCommandError", reportCiCommandError)
    )
).pipe(
  Command.withDescription("Read-only check for fleet jobs GitHub queued and no runner served; fails on any alert"),
  Command.provide(CiRunnerOutputsLive)
);
