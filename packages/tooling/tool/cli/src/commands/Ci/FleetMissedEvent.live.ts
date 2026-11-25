/**
 * The live GitHub reads of the standing fleet missed-event check, over
 * `effect/http`.
 *
 * **Details**
 *
 * Every request is a `GET`. The body is read as text and decoded by schema,
 * and every `"id"` integer in a hook delivery body is turned into a string
 * before it is parsed ({@link quoteJsonIds}), because delivery ids exceed
 * 2^53 and `JSON.parse` would round them. The deliveries listing pages by
 * the cursor in GitHub's `Link` header.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Headers from "effect/http/Headers";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  FLEET_CHECK_JOB_NAME,
  FleetCheckJob,
  FleetDeliveryDetail,
  FleetDeliveryId,
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
import {
  FleetGithubReads,
  FleetReadError,
  FleetWatchToken,
  withFleetRequestCount,
} from "./FleetMissedEvent.service.ts";

const $I = $RepoCliId.create("commands/Ci/FleetMissedEvent.live");

const PER_PAGE = 100;
const WORKFLOW_RUNS_PER_PAGE = 30;

const IsoTime = S.DateTimeUtcFromString;

const RunnersWire = S.Struct({
  total_count: S.Finite,
  runners: S.Array(
    S.Struct({
      id: S.Finite,
      name: S.String,
      status: S.String,
      busy: S.Boolean,
      labels: S.Array(S.Struct({ name: S.String })),
    })
  ),
}).pipe($I.annoteSchema("FleetRunnersWire", { description: "The org self-hosted runners listing." }));

const RunsWire = S.Struct({
  total_count: S.Finite,
  workflow_runs: S.Array(S.Struct({ id: S.Finite, created_at: IsoTime })),
}).pipe($I.annoteSchema("FleetRunsWire", { description: "A workflow runs listing." }));

const JobsWire = S.Struct({
  total_count: S.Finite,
  jobs: S.Array(
    S.Struct({
      id: S.Finite,
      run_id: S.Finite,
      name: S.String,
      status: S.String,
      labels: S.Array(S.String),
      created_at: IsoTime,
      started_at: S.NullOr(IsoTime),
      runner_name: S.String.pipe(S.NullOr, S.optionalKey),
    })
  ),
}).pipe($I.annoteSchema("FleetJobsWire", { description: "A workflow run's jobs listing." }));

const CheckJobsWire = S.Struct({
  jobs: S.Array(
    S.Struct({
      name: S.String,
      status: S.String,
      conclusion: S.String.pipe(S.NullOr, S.optionalKey),
      started_at: S.NullOr(IsoTime),
    })
  ),
}).pipe(
  $I.annoteSchema("FleetCheckJobsWire", { description: "A check workflow run's jobs, as the guard reads them." })
);

const NOT_RAN_CONCLUSIONS = HashSet.make("skipped", "cancelled");
const RAN_STATUSES = HashSet.make("in_progress", "completed");

const DeliveriesWire = S.Array(
  S.Struct({
    id: FleetDeliveryId,
    delivered_at: IsoTime,
    status_code: S.Finite,
    action: S.String.pipe(S.NullOr, S.optionalKey),
  })
).pipe($I.annoteSchema("FleetDeliveriesWire", { description: "One page of a hook's deliveries, ids quoted." }));

const WorkflowJobRef = S.Struct({ id: S.String }).pipe(S.NullOr, S.optionalKey);
const PayloadRef = S.Struct({ workflow_job: WorkflowJobRef }).pipe(S.NullOr, S.optionalKey);
const RequestRef = S.Struct({ payload: PayloadRef }).pipe(S.NullOr, S.optionalKey);

const DeliveryDetailWire = S.Struct({
  id: FleetDeliveryId,
  request: RequestRef,
}).pipe($I.annoteSchema("FleetDeliveryDetailWire", { description: "One delivery's detail, ids quoted." }));

const millis = DateTime.toEpochMillis;
const nullable = <A>(value: A | null | undefined): O.Option<A> => O.fromNullishOr(value);

/**
 * Quote every `"id"` integer of a JSON text, so a parse keeps ids above
 * 2^53 exact.
 *
 * **Example** (Keep a delivery id exact)
 *
 * ```ts
 * import { quoteJsonIds } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(quoteJsonIds('[{"id": 3855552300210716674}]')) // [{"id":"3855552300210716674"}]
 * ```
 *
 * @param text - A JSON text.
 * @returns The text with each `"id"` integer as a string.
 * @category utilities
 * @since 0.0.0
 */
export const quoteJsonIds: (text: string) => string = Str.replace(/"id"\s*:\s*(\d+)/gu, '"id":"$1"');

/**
 * The `cursor` of the `rel="next"` link in a `Link` header.
 *
 * **Example** (Read the next cursor)
 *
 * ```ts
 * import { nextLinkCursor } from "@beep/repo-cli/commands/Ci"
 *
 * const link = '<https://api.github.com/repos/o/r/hooks/1/deliveries?per_page=100&cursor=v1_9>; rel="next"'
 * console.log(nextLinkCursor(link)) // { _id: 'Option', _tag: 'Some', value: 'v1_9' }
 * ```
 *
 * @param link - The `Link` header's value.
 * @returns The next page's cursor, when there is a next page.
 * @category utilities
 * @since 0.0.0
 */
export const nextLinkCursor = (link: string): O.Option<string> =>
  pipe(
    Str.split(link, ","),
    A.findFirst(Str.includes('rel="next"')),
    O.flatMap(Str.match(/[?&]cursor=([^&>]+)/u)),
    O.flatMap((match) => A.get(match, 1))
  );

const runsQueryString = (query: FleetRunsQuery): string =>
  FleetRunsQuery.match(query, {
    ByStatus: ({ status }) => `status=${status}`,
    CreatedSince: ({ since }) => `created=${encodeURIComponent(`>=${DateTime.formatIso(DateTime.makeUnsafe(since))}`)}`,
  });

const makeLiveReads = Effect.fnUntraced(function* (repository: string) {
  const client = yield* HttpClient.HttpClient;
  const { token } = yield* FleetWatchToken;
  const owner = pipe(Str.split(repository, "/"), A.headNonEmpty);

  const get = Effect.fnUntraced(function* (endpoint: string) {
    const bearer = yield* token;
    const request = HttpClientRequest.get(`https://api.github.com/${endpoint}`).pipe(
      HttpClientRequest.setHeaders({
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "beep-fleet-missed-event-check",
      }),
      HttpClientRequest.bearerToken(Redacted.value(bearer))
    );
    const { response, text } = yield* client.execute(request).pipe(
      Effect.flatMap((response) => Effect.map(response.text, (text) => ({ response, text }))),
      Effect.mapError((error) => FleetReadError.make({ endpoint, message: error.message }))
    );
    return response.status >= 200 && response.status < 300
      ? { text, headers: response.headers }
      : yield* FleetReadError.make({ endpoint, message: `HTTP ${response.status}`, status: response.status });
  });

  const decode = <A>(endpoint: string, schema: S.Codec<A, unknown>, text: string) =>
    S.decodeEffect(S.fromJsonString(schema))(text).pipe(
      Effect.mapError((error) => FleetReadError.make({ endpoint, message: `undecodable response: ${error.message}` }))
    );

  const read = <A>(endpoint: string, schema: S.Codec<A, unknown>) =>
    Effect.flatMap(get(endpoint), ({ text }) => decode(endpoint, schema, text));

  return yield* withFleetRequestCount({
    runnersPage: Effect.fn("FleetGithubReads.runnersPage")((page: number) =>
      read(`orgs/${owner}/actions/runners?per_page=${PER_PAGE}&page=${page}`, RunnersWire).pipe(
        Effect.map((wire) =>
          FleetRunnersPage.make({
            totalCount: wire.total_count,
            runners: A.map(wire.runners, (runner) =>
              FleetRunner.make({
                id: runner.id,
                name: runner.name,
                online: runner.status === "online",
                busy: runner.busy,
                labels: A.map(runner.labels, (label) => label.name),
              })
            ),
          })
        )
      )
    ),
    runsPage: Effect.fn("FleetGithubReads.runsPage")((query: FleetRunsQuery, page: number) =>
      read(
        `repos/${repository}/actions/runs?${runsQueryString(query)}&per_page=${PER_PAGE}&page=${page}`,
        RunsWire
      ).pipe(
        Effect.map((wire) =>
          FleetRunsPage.make({ totalCount: wire.total_count, runIds: A.map(wire.workflow_runs, (run) => run.id) })
        )
      )
    ),
    jobsPage: Effect.fn("FleetGithubReads.jobsPage")((runId: number, page: number) =>
      read(
        `repos/${repository}/actions/runs/${runId}/jobs?filter=latest&per_page=${PER_PAGE}&page=${page}`,
        JobsWire
      ).pipe(
        Effect.map((wire) =>
          FleetJobsPage.make({
            totalCount: wire.total_count,
            jobs: A.map(wire.jobs, (job) =>
              FleetJob.make({
                id: job.id,
                runId: job.run_id,
                name: job.name,
                status: job.status,
                labels: job.labels,
                createdAt: millis(job.created_at),
                startedAt: O.map(nullable(job.started_at), millis),
                runnerName: O.filter(nullable(job.runner_name), Str.isNonEmpty),
              })
            ),
          })
        )
      )
    ),
    deliveriesPage: Effect.fn("FleetGithubReads.deliveriesPage")(function* (
      hookId: FleetDeliveryId,
      cursor: O.Option<string>
    ) {
      const endpoint = `repos/${repository}/hooks/${hookId}/deliveries?per_page=${PER_PAGE}${O.match(cursor, {
        onNone: () => "",
        onSome: (value) => `&cursor=${value}`,
      })}`;
      const { text, headers } = yield* get(endpoint);
      const wire = yield* decode(endpoint, DeliveriesWire, quoteJsonIds(text));
      return FleetHookDeliveriesPage.make({
        nextCursor: O.flatMap(Headers.get(headers, "link"), nextLinkCursor),
        deliveries: A.map(wire, (delivery) =>
          FleetHookDelivery.make({
            id: delivery.id,
            deliveredAt: millis(delivery.delivered_at),
            statusCode: delivery.status_code,
            action: nullable(delivery.action),
          })
        ),
      });
    }),
    deliveryDetail: Effect.fn("FleetGithubReads.deliveryDetail")(
      (hookId: FleetDeliveryId, deliveryId: FleetDeliveryId) => {
        const endpoint = `repos/${repository}/hooks/${hookId}/deliveries/${deliveryId}`;
        return get(endpoint).pipe(
          Effect.flatMap(({ text }) => decode(endpoint, DeliveryDetailWire, quoteJsonIds(text))),
          Effect.map((wire) =>
            FleetDeliveryDetail.make({
              id: wire.id,
              workflowJobId: pipe(
                nullable(wire.request),
                O.flatMap((request) => nullable(request.payload)),
                O.flatMap((payload) => nullable(payload.workflow_job)),
                O.map((job) => job.id)
              ),
            })
          )
        );
      }
    ),
    workflowRuns: Effect.fn("FleetGithubReads.workflowRuns")((workflowFile: string) =>
      read(
        `repos/${repository}/actions/workflows/${workflowFile}/runs?per_page=${WORKFLOW_RUNS_PER_PAGE}`,
        RunsWire
      ).pipe(
        Effect.map(
          flow(
            (wire) => wire.workflow_runs,
            A.map((run) => FleetWorkflowRun.make({ id: run.id, createdAt: millis(run.created_at) }))
          )
        )
      )
    ),
    checkJob: Effect.fn("FleetGithubReads.checkJob")((runId: number) =>
      read(`repos/${repository}/actions/runs/${runId}/jobs?filter=latest&per_page=${PER_PAGE}`, CheckJobsWire).pipe(
        Effect.map((wire) =>
          pipe(
            A.findFirst(
              wire.jobs,
              (job) =>
                job.name === FLEET_CHECK_JOB_NAME &&
                HashSet.has(RAN_STATUSES, job.status) &&
                !O.exists(nullable(job.conclusion), (conclusion) => HashSet.has(NOT_RAN_CONCLUSIONS, conclusion))
            ),
            O.flatMap((job) => nullable(job.started_at)),
            O.match({
              onNone: () => FleetCheckJob.cases.NotRan.make({}),
              onSome: (startedAt) => FleetCheckJob.cases.Ran.make({ startedAt: millis(startedAt) }),
            })
          )
        )
      )
    ),
  });
});

/**
 * The live GitHub reads for one `owner/name` repository; org runners are
 * read from its owner.
 *
 * **Example** (Build the live layer)
 *
 * ```ts
 * import { layerFleetGithubReadsLive } from "@beep/repo-cli/commands/Ci"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerFleetGithubReadsLive("beep-effect/beep-effect"))) // true
 * ```
 *
 * @param repository - The `owner/name` repository.
 * @returns A layer of {@link FleetGithubReads}.
 * @category layers
 * @since 0.0.0
 */
export const layerFleetGithubReadsLive = (
  repository: string
): Layer.Layer<FleetGithubReads, never, HttpClient.HttpClient | FleetWatchToken> =>
  Layer.effect(FleetGithubReads, makeLiveReads(repository));
