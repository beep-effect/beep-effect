/**
 * Service contracts of the standing fleet missed-event check: the GitHub
 * reads, the token provider and the sleep seam, each with a fake for tests.
 * The fourth seam is `effect/Clock`, faked by `TestClock`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  FleetCheckJob,
  FleetDeliveryDetail,
  FleetHookDeliveriesPage,
  FleetHookDelivery,
  FleetJob,
  FleetJobsPage,
  FleetRunner,
  FleetRunnersPage,
  FleetRunsPage,
  FleetRunsQuery,
  FleetWorkflowRun,
} from "./FleetMissedEvent.schemas.ts";
import type { FleetDeliveryId } from "./FleetMissedEvent.schemas.ts";

const $I = $RepoCliId.create("commands/Ci/FleetMissedEvent.service");

/**
 * A GitHub read that failed: the endpoint, GitHub's status when it answered,
 * and why.
 *
 * **Example** (A failed detail read)
 *
 * ```ts
 * import { FleetReadError } from "@beep/repo-cli/commands/Ci"
 *
 * const error = FleetReadError.make({ endpoint: "hooks/1/deliveries/2", message: "HTTP 502" })
 * console.log(error._tag) // "FleetReadError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FleetReadError extends S.TaggedError<FleetReadError, { readonly brand: unique symbol }>(
  $I`FleetReadError`
)(
  "FleetReadError",
  { endpoint: S.String, message: S.String, status: S.optionalKey(S.Finite) },
  $I.annoteError<FleetReadError>("FleetReadError", {
    description: "A GitHub read of the fleet missed-event check that failed.",
  })
) {}

/**
 * The GitHub reads the check makes, one page or one record per call.
 *
 * **Details**
 *
 * Every member is a read: the check never redelivers, cancels, reruns or
 * writes. Paging is the caller's: it decides when a listing is complete.
 * `workflowRuns` lists the check workflow's recent runs from every event,
 * newest first; `checkJob` reads whether one of them ran its check job.
 * `requestCount` is the number of reads made through the service so far,
 * each retry included; {@link withFleetRequestCount} adds it to every layer.
 *
 * @category services
 * @since 0.0.0
 */
export interface FleetGithubReadsShape {
  readonly checkJob: (runId: number) => Effect.Effect<FleetCheckJob, FleetReadError>;
  readonly deliveriesPage: (
    hookId: FleetDeliveryId,
    cursor: O.Option<string>
  ) => Effect.Effect<FleetHookDeliveriesPage, FleetReadError>;
  readonly deliveryDetail: (
    hookId: FleetDeliveryId,
    deliveryId: FleetDeliveryId
  ) => Effect.Effect<FleetDeliveryDetail, FleetReadError>;
  readonly jobsPage: (runId: number, page: number) => Effect.Effect<FleetJobsPage, FleetReadError>;
  readonly requestCount: Effect.Effect<number>;
  readonly runnersPage: (page: number) => Effect.Effect<FleetRunnersPage, FleetReadError>;
  readonly runsPage: (query: FleetRunsQuery, page: number) => Effect.Effect<FleetRunsPage, FleetReadError>;
  readonly workflowRuns: (workflowFile: string) => Effect.Effect<ReadonlyArray<FleetWorkflowRun>, FleetReadError>;
}

/**
 * **Details**
 *
 * `runnerReads` holds one runner listing per walk of the org-runner
 * listing, in order; a walk past the last repeats it. A listing longer than
 * one page is walked until two walks agree, so such a read is given twice. Runs list by status from `queuedRuns` and
 * `inProgressRuns`, and by creation time from `recentRuns`. `jobs` are
 * served by their `runId`. `deliveries` are newest first and served
 * `pageSize` at a time; `failDeliveryPageAt` fails that page (0-based) and
 * `failingDetails` fails those detail reads. `workflowRuns` of `None` fails
 * the read. `checkJobs` serve each run's check job by `runId`, a run absent
 * from them has `NotRan`, and `failingCheckJobs` fail those reads.
 *
 * **Example** (An empty fleet)
 *
 * ```ts
 * import { FleetGithubFixture } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FleetGithubFixture.make({}).pageSize) // 100
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetGithubFixture extends S.Opaque<FleetGithubFixture, { readonly brand: unique symbol }>()(
  S.Struct({
    runnerReads: FleetRunner.pipe(S.Array, S.Array, S.withConstructorDefault(Effect.succeed([]))),
    queuedRuns: S.Array(S.Finite).pipe(S.withConstructorDefault(Effect.succeed([]))),
    inProgressRuns: S.Array(S.Finite).pipe(S.withConstructorDefault(Effect.succeed([]))),
    recentRuns: S.Array(S.Finite).pipe(S.withConstructorDefault(Effect.succeed([]))),
    jobs: S.Array(FleetJob).pipe(S.withConstructorDefault(Effect.succeed([]))),
    deliveries: S.Array(FleetHookDelivery).pipe(S.withConstructorDefault(Effect.succeed([]))),
    details: S.Array(FleetDeliveryDetail).pipe(S.withConstructorDefault(Effect.succeed([]))),
    failingDetails: S.Array(S.String).pipe(S.withConstructorDefault(Effect.succeed([]))),
    failDeliveryPageAt: S.Option(S.Finite).pipe(S.withConstructorDefault(Effect.succeedNone)),
    workflowRuns: FleetWorkflowRun.pipe(S.Array, S.Option, S.withConstructorDefault(Effect.succeedSome([]))),
    checkJobs: S.Struct({ runId: S.Finite, job: FleetCheckJob }).pipe(
      S.Array,
      S.withConstructorDefault(Effect.succeed([]))
    ),
    failingCheckJobs: S.Array(S.Finite).pipe(S.withConstructorDefault(Effect.succeed([]))),
    pageSize: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(100))),
  }).pipe($I.annoteSchema("FleetGithubFixture", { description: "The GitHub state the fake fleet reads serve." }))
) {}

/**
 * The read members of {@link FleetGithubReadsShape}, before they are counted.
 *
 * @category services
 * @since 0.0.0
 */
export type FleetGithubReadCalls = Omit<FleetGithubReadsShape, "requestCount">;

/**
 * Count every read made through a set of read calls, so the run can report
 * its GitHub request budget without counting at call sites.
 *
 * **Example** (Count one read)
 *
 * ```ts
 * import { FleetReadError, withFleetRequestCount } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const unread = () => Effect.fail(FleetReadError.make({ endpoint: "x", message: "unused" }))
 * const program = Effect.gen(function* () {
 *   const reads = yield* withFleetRequestCount({
 *     checkJob: unread,
 *     deliveriesPage: unread,
 *     deliveryDetail: unread,
 *     jobsPage: unread,
 *     runnersPage: unread,
 *     runsPage: unread,
 *     workflowRuns: unread,
 *   })
 *   yield* Effect.ignore(reads.runnersPage(1))
 *   return yield* reads.requestCount
 * })
 * console.log(Effect.runSync(program)) // 1
 * ```
 *
 * @param calls - The uncounted read calls.
 * @returns The service with each call counted and `requestCount` reading the total.
 * @category services
 * @since 0.0.0
 */
export const withFleetRequestCount = Effect.fnUntraced(function* (calls: FleetGithubReadCalls) {
  const count = yield* Ref.make(0);
  const counted =
    <Args extends ReadonlyArray<unknown>, A>(read: (...args: Args) => Effect.Effect<A, FleetReadError>) =>
    (...args: Args): Effect.Effect<A, FleetReadError> =>
      Effect.andThen(
        Ref.update(count, (n) => n + 1),
        Effect.suspend(() => read(...args))
      );
  return FleetGithubReads.of({
    requestCount: Ref.get(count),
    checkJob: counted(calls.checkJob),
    deliveriesPage: counted(calls.deliveriesPage),
    deliveryDetail: counted(calls.deliveryDetail),
    jobsPage: counted(calls.jobsPage),
    runnersPage: counted(calls.runnersPage),
    runsPage: counted(calls.runsPage),
    workflowRuns: counted(calls.workflowRuns),
  });
});

const pageOf = <A>(items: ReadonlyArray<A>, size: number, page: number): ReadonlyArray<A> =>
  pipe(items, A.drop((page - 1) * size), A.take(size));

const fixtureFailure = (endpoint: string): FleetReadError =>
  FleetReadError.make({ endpoint, message: "fixture failure", status: 502 });

const makeFakeReads = Effect.fnUntraced(function* (fixture: FleetGithubFixture) {
  const runnerReadIndex = yield* Ref.make(0);
  const failing = HashSet.fromIterable(fixture.failingDetails);
  const size = fixture.pageSize;
  const runnersPage = Effect.fnUntraced(function* (page: number) {
    const index =
      page === 1 ? yield* Ref.getAndUpdate(runnerReadIndex, (n) => n + 1) : (yield* Ref.get(runnerReadIndex)) - 1;
    const read = pipe(
      A.get(fixture.runnerReads, index),
      O.orElse(() => A.last(fixture.runnerReads)),
      O.getOrElse(A.empty<FleetRunner>)
    );
    return FleetRunnersPage.make({ runners: pageOf(read, size, page), totalCount: A.length(read) });
  });
  const runIdsOf = (query: FleetRunsQuery): ReadonlyArray<number> =>
    FleetRunsQuery.match(query, {
      ByStatus: ({ status }) => (status === "queued" ? fixture.queuedRuns : fixture.inProgressRuns),
      CreatedSince: () => fixture.recentRuns,
    });
  const deliveryPageIndex = (cursor: O.Option<string>): number =>
    O.match(cursor, { onNone: () => 0, onSome: (value) => Number(Str.slice(1)(value)) });
  return yield* withFleetRequestCount({
    runnersPage,
    runsPage: Effect.fn("FleetGithubReads.fake.runsPage")(function* (query: FleetRunsQuery, page: number) {
      const ids = runIdsOf(query);
      return FleetRunsPage.make({ runIds: pageOf(ids, size, page), totalCount: A.length(ids) });
    }),
    jobsPage: Effect.fn("FleetGithubReads.fake.jobsPage")(function* (runId: number, page: number) {
      const jobs = A.filter(fixture.jobs, (job) => job.runId === runId);
      return FleetJobsPage.make({ jobs: pageOf(jobs, size, page), totalCount: A.length(jobs) });
    }),
    deliveriesPage: Effect.fn("FleetGithubReads.fake.deliveriesPage")(function* (
      hookId: FleetDeliveryId,
      cursor: O.Option<string>
    ) {
      const index = deliveryPageIndex(cursor);
      if (O.exists(fixture.failDeliveryPageAt, (at) => at === index)) {
        return yield* fixtureFailure(`hooks/${hookId}/deliveries`);
      }
      const more = (index + 1) * size < A.length(fixture.deliveries);
      return FleetHookDeliveriesPage.make({
        deliveries: pageOf(fixture.deliveries, size, index + 1),
        nextCursor: more ? O.some(`c${index + 1}`) : O.none(),
      });
    }),
    deliveryDetail: Effect.fn("FleetGithubReads.fake.deliveryDetail")(function* (
      hookId: FleetDeliveryId,
      deliveryId: FleetDeliveryId
    ) {
      const failure = fixtureFailure(`hooks/${hookId}/deliveries/${deliveryId}`);
      return HashSet.has(failing, deliveryId)
        ? yield* failure
        : yield* Effect.fromOption(A.findFirst(fixture.details, (detail) => detail.id === deliveryId)).pipe(
            Effect.mapError(() => failure)
          );
    }),
    workflowRuns: Effect.fn("FleetGithubReads.fake.workflowRuns")(function* (workflowFile: string) {
      return yield* Effect.fromOption(fixture.workflowRuns).pipe(
        Effect.mapError(() => fixtureFailure(`workflows/${workflowFile}/runs`))
      );
    }),
    checkJob: Effect.fn("FleetGithubReads.fake.checkJob")(function* (runId: number) {
      return A.contains(fixture.failingCheckJobs, runId)
        ? yield* fixtureFailure(`runs/${runId}/jobs`)
        : pipe(
            A.findFirst(fixture.checkJobs, (entry) => entry.runId === runId),
            O.match({ onNone: () => FleetCheckJob.cases.NotRan.make({}), onSome: (entry) => entry.job })
          );
    }),
  });
});

/**
 * The GitHub reads service.
 *
 * **Example** (Serve an empty fleet)
 *
 * ```ts
 * import { FleetGithubFixture, FleetGithubReads } from "@beep/repo-cli/commands/Ci"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(FleetGithubReads.layerFake(FleetGithubFixture.make({})))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FleetGithubReads extends Context.Service<FleetGithubReads, FleetGithubReadsShape>()($I`FleetGithubReads`) {
  /**
   * Serve a recorded GitHub state.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerFake = (fixture: FleetGithubFixture): Layer.Layer<FleetGithubReads> =>
    Layer.effect(FleetGithubReads, makeFakeReads(fixture));
}

/**
 * The installation token the GitHub reads present.
 *
 * **Example** (A fixed token)
 *
 * ```ts
 * import { FleetWatchToken } from "@beep/repo-cli/commands/Ci"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(FleetWatchToken.layerFake("ghs_test"))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FleetWatchToken extends Context.Service<
  FleetWatchToken,
  { readonly token: Effect.Effect<Redacted.Redacted<string>, FleetReadError> }
>()($I`FleetWatchToken`) {
  /**
   * Read the token from `GH_TOKEN`, where the workflow puts the minted App
   * token.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerEnv: Layer.Layer<FleetWatchToken> = Layer.succeed(FleetWatchToken, {
    token: Config.Redacted("GH_TOKEN").pipe(
      Effect.mapError(() => FleetReadError.make({ endpoint: "GH_TOKEN", message: "GH_TOKEN is not set" }))
    ),
  });

  /**
   * A fixed token.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerFake = (token: string): Layer.Layer<FleetWatchToken> =>
    Layer.succeed(FleetWatchToken, {
      token: Effect.succeed(Redacted.make(token)),
    });
}

/**
 * The sleep between the two org-runner reads.
 *
 * **Example** (Record the requested sleeps)
 *
 * ```ts
 * import { FleetSleep } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 * import * as Ref from "effect/Ref"
 *
 * const slept = Effect.runSync(Ref.make<ReadonlyArray<number>>([]))
 * console.log(typeof FleetSleep.layerFake(slept)) // "object"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FleetSleep extends Context.Service<
  FleetSleep,
  { readonly sleep: (duration: Duration.Duration) => Effect.Effect<void> }
>()($I`FleetSleep`) {
  /**
   * Sleep for real.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerLive: Layer.Layer<FleetSleep> = Layer.succeed(FleetSleep, { sleep: Effect.sleep });

  /**
   * Return at once, recording each requested sleep in milliseconds.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerFake = (slept: Ref.Ref<ReadonlyArray<number>>): Layer.Layer<FleetSleep> =>
    Layer.succeed(FleetSleep, {
      sleep: Effect.fn("FleetSleep.fake.sleep")(function* (duration: Duration.Duration) {
        yield* Ref.update(slept, A.append(Duration.toMillis(duration)));
      }),
    });
}
