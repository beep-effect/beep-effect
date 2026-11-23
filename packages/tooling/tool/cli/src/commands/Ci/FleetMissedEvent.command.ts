/**
 * `bun run beep ci fleet-missed-event-check`: the standing, read-only check
 * for `beep-fleet-*` jobs GitHub queued and the new fleet never served.
 *
 * **Details**
 *
 * One run reads the org runners, waits 300 seconds through {@link FleetSleep},
 * reads them again, reads every queued, in-progress and recent run's jobs
 * with full paging, and walks the hook deliveries once (newest first, back to
 * the oldest job that needs them minus two minutes) with one detail read per
 * delivery. A listing cut at 50 pages short of its total fails the run. It
 * prints the step summary, with the number of GitHub requests the reads
 * service counted, and exits non-zero on any alert. It
 * never redelivers, cancels, reruns or writes: the remedies are printed.
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
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { CiCommandError, reportCiCommandError } from "./Ci.errors.ts";
import { CiRunnerOutputsLive } from "./CiRunnerOutputs.ts";
import { layerFleetGithubReadsLive } from "./FleetMissedEvent.live.ts";
import {
  FLEET_RUNNER_READ_GAP,
  FLEET_THRESHOLDS,
  FleetDeliveryEvidence,
  FleetHookSource,
  FleetMissedEventInput,
  FleetPreviousRun,
  FleetRunsQuery,
  fleetHookSources,
} from "./FleetMissedEvent.schemas.ts";
import { FleetGithubReads, FleetReadError, FleetSleep, FleetWatchToken } from "./FleetMissedEvent.service.ts";
import {
  deliveryWindow,
  fleetAlerts,
  fleetCheckReport,
  fleetJobFinding,
  judgeDeliveryEvidence,
  needsDeliveryEvidence,
  observeFleetPool,
  previousScheduledRun,
  productionFleetPools,
  queuedFleetJobs,
  renderFleetCheckSummary,
} from "./FleetMissedEvent.ts";
import type * as HttpClient from "effect/http/HttpClient";
import type {
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

const allPages = <A>(
  endpoint: string,
  readPage: (
    page: number
  ) => Effect.Effect<{ readonly items: ReadonlyArray<A>; readonly totalCount: number }, FleetReadError>
): Effect.Effect<ReadonlyArray<A>, FleetReadError> => {
  const go = (page: number, collected: ReadonlyArray<A>): Effect.Effect<ReadonlyArray<A>, FleetReadError> =>
    Effect.flatMap(readPage(page), ({ items, totalCount }) => {
      const all = A.appendAll(collected, items);
      const incomplete = A.isReadonlyArrayNonEmpty(items) && A.length(all) < totalCount;
      return !incomplete
        ? Effect.succeed(all)
        : page < MAX_LISTING_PAGES
          ? go(page + 1, all)
          : Effect.fail(FleetReadError.make({ endpoint, message: `listing truncated at ${MAX_LISTING_PAGES} pages` }));
    });
  return go(1, A.empty());
};

const asCommandError = (error: FleetReadError): CiCommandError =>
  CiCommandError.make({ message: `GitHub read ${error.endpoint} failed: ${error.message}` });

interface FleetReadContext {
  readonly reads: FleetGithubReadsShape;
  readonly retry: <A>(read: () => Effect.Effect<A, FleetReadError>) => Effect.Effect<A, FleetReadError>;
}

const readRunners = (context: FleetReadContext): Effect.Effect<ReadonlyArray<FleetRunner>, FleetReadError> =>
  allPages("org runners", (page) =>
    Effect.map(
      context.retry(() => context.reads.runnersPage(page)),
      (read) => ({
        items: read.runners,
        totalCount: read.totalCount,
      })
    )
  );

const readRunIds = (context: FleetReadContext, query: FleetRunsQuery) =>
  allPages(`runs ${query._tag}`, (page) =>
    Effect.map(
      context.retry(() => context.reads.runsPage(query, page)),
      (read) => ({
        items: read.runIds,
        totalCount: read.totalCount,
      })
    )
  );

const readRunJobs = (context: FleetReadContext, runId: number) =>
  allPages(`runs/${runId}/jobs`, (page) =>
    Effect.map(
      context.retry(() => context.reads.jobsPage(runId, page)),
      (read) => ({
        items: read.jobs,
        totalCount: read.totalCount,
      })
    )
  );

const readPoolJobs = Effect.fnUntraced(function* (
  context: FleetReadContext,
  labels: HashSet.HashSet<string>,
  now: number
) {
  const queries = [
    FleetRunsQuery.cases.ByStatus.make({ status: "queued" }),
    FleetRunsQuery.cases.ByStatus.make({ status: "in_progress" }),
    FleetRunsQuery.cases.CreatedSince.make({ since: now - FLEET_THRESHOLDS.lookback }),
  ];
  const runIds = yield* Effect.forEach(queries, (query) => readRunIds(context, query), { concurrency: 1 });
  const unique = A.fromIterable(HashSet.fromIterable(A.flatten(runIds)));
  const jobs = yield* Effect.forEach(unique, (runId) => readRunJobs(context, runId), {
    concurrency: JOB_READ_CONCURRENCY,
  });
  return A.filter(A.flatten(jobs), (job: FleetJob) => A.some(job.labels, (label) => HashSet.has(labels, label)));
});

interface DeliveryWalk {
  readonly deliveries: ReadonlyArray<FleetHookDelivery>;
  readonly failure: O.Option<string>;
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
              onNone: () => Effect.succeed(next),
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
  return go(O.none(), 0, { deliveries: A.empty(), oldestReached: O.none(), failure: O.none() });
};

const candidateIds = (jobs: ReadonlyArray<FleetJob>, deliveries: ReadonlyArray<FleetHookDelivery>) =>
  HashSet.fromIterable(
    A.flatMap(jobs, (job) => {
      const window = deliveryWindow(job);
      return A.map(
        A.filter(
          deliveries,
          (delivery) =>
            O.contains(delivery.action, "queued") &&
            delivery.deliveredAt >= window.start &&
            delivery.deliveredAt <= window.end
        ),
        (delivery) => delivery.id
      );
    })
  );

const readDetails = Effect.fnUntraced(function* (
  context: FleetReadContext,
  hookId: FleetDeliveryId,
  ids: HashSet.HashSet<string>
) {
  const reads = yield* Effect.forEach(
    A.fromIterable(ids),
    (id) =>
      context
        .retry(() => context.reads.deliveryDetail(hookId, id))
        .pipe(
          Effect.option,
          Effect.map((detail): readonly [string, O.Option<FleetDeliveryDetail>] => [id, detail])
        ),
    { concurrency: JOB_READ_CONCURRENCY }
  );
  return HashMap.fromIterable(reads);
});

const hookEvidence = Effect.fnUntraced(function* (
  context: FleetReadContext,
  hookId: FleetDeliveryId,
  jobs: ReadonlyArray<FleetJob>
) {
  const stopAt =
    A.reduce(jobs, Number.POSITIVE_INFINITY, (oldest, job) => Math.min(oldest, job.createdAt)) -
    FLEET_THRESHOLDS.deliveryLead;
  const walk = yield* walkDeliveries(context, hookId, stopAt);
  const details = yield* readDetails(context, hookId, candidateIds(jobs, walk.deliveries));
  return A.map(jobs, (job): readonly [number, FleetDeliveryEvidence] => [
    job.id,
    judgeDeliveryEvidence({
      job,
      hookId,
      deliveries: walk.deliveries,
      oldestReached: walk.oldestReached,
      walkFailure: walk.failure,
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
  const context: FleetReadContext = { reads, retry: retried(sleep) };
  const firstReadAt = yield* Clock.currentTimeMillis;
  const firstRead = yield* readRunners(context).pipe(Effect.mapError(asCommandError));
  yield* sleep(FLEET_RUNNER_READ_GAP);
  const secondRead = yield* readRunners(context).pipe(Effect.mapError(asCommandError));
  const now = yield* Clock.currentTimeMillis;
  const labels = HashSet.fromIterable(A.map(input.pools, (pool) => pool.label));
  const jobs = yield* readPoolJobs(context, labels, now).pipe(Effect.mapError(asCommandError));
  const observations = A.map(input.pools, (pool) =>
    observeFleetPool({ pool, firstReadAt, firstRead, secondRead, jobs, now })
  );
  const queued = queuedFleetJobs({ observations, jobs, hookSources: input.hookSources, now });
  const evidence = yield* collectEvidence(context, queued, now);
  const previousRun = yield* context
    .retry(() => reads.scheduledRuns(input.workflowFile))
    .pipe(
      Effect.map((runs) => previousScheduledRun(runs, input.currentRunId)),
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

/**
 * The live services of one run: the GitHub reads over the minted token in
 * `GH_TOKEN`, and the real sleep.
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
      Flag.withDescription("The check's own workflow file, whose previous scheduled run the summary names")
    ),
  },
  (flags) =>
    pipe(
      resolveInput(flags),
      Effect.flatMap((input) =>
        Effect.flatMap(Layer.build(layerFleetMissedEventLive(input.repository)), (context) =>
          Effect.provideContext(runFleetMissedEventCheck(input), context)
        ).pipe(Effect.scoped, Effect.flatMap(failOnFleetAlerts))
      ),
      Effect.catchTag("CiCommandError", reportCiCommandError)
    )
).pipe(
  Command.withDescription("Read-only check for fleet jobs GitHub queued and no runner served; fails on any alert"),
  Command.provide(CiRunnerOutputsLive)
);
