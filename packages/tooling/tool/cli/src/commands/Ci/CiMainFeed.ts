/**
 * The main feed lookup: `main`'s newest hosted gate reports at a lane's merge
 * base (decisions `history-baseline` and `report-carrier`).
 *
 * **Details**
 *
 * The lookup asks for the newest completed push run of `check.yml` at the
 * merge base. A run that was cancelled or skipped ran no gate, so when the
 * merge base has none that ran, one listing of `main`'s completed push runs
 * (one page of 100, created no later than the merge base's run when it has
 * one) is intersected with the merge base's first-parent ancestors, nearest
 * first. No ancestor in that page means no baseline; the lookup never pages
 * further. For the hit run, each requested job's artifact is listed by its
 * exact name and downloaded: two requests per job. A hit at the merge base
 * for one job is three REST requests, an ancestor hit four, and no request is
 * GraphQL. Every request goes through `GitHubClient`, so the budget ledger
 * records it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Count, Text } from "@beep/gate-report/Scalars";
import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo } from "@beep/github/Repo";
import { $RepoCliId } from "@beep/identity/packages";
import { GateName } from "@beep/repo-gate-record/GatePaths";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import { CiCommandError } from "./Ci.errors.ts";
import { downloadFeedArtifact, FeedArtifactPage, FeedReport } from "./CiFeedArtifact.ts";
import { taskOutcomeArtifactPrefix } from "./CiTaskOutcomes.ts";
import { CommitSha } from "./DependencyReviewSchemas.ts";
import type { GitHubError } from "@beep/github/GitHubError";

const $I = $RepoCliId.create("commands/Ci/CiMainFeed");

/**
 * The workflow whose push runs carry `main`'s gate reports.
 *
 * @category constants
 * @since 0.0.0
 */
export const MAIN_FEED_WORKFLOW = "check.yml";

/**
 * The page of `main` runs the ancestor walk reads, and the most first-parent
 * ancestors it considers.
 *
 * @category constants
 * @since 0.0.0
 */
export const MAIN_FEED_ANCESTOR_LIMIT = 100;

/**
 * A job's artifact key: the `<job>-<partition>` suffix of its
 * `task-outcomes-<run>-<attempt>-<job>-<partition>` artifact.
 *
 * **Example** (Accept a key)
 *
 * ```ts
 * import { FeedJobKey } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(FeedJobKey)("test-unit-shard-repo-cli-8")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FeedJobKey = S.String.check(S.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u)).pipe(
  $I.annoteSchema("FeedJobKey", {
    description: "The <job>-<partition> suffix of a job's task-outcomes artifact name.",
  })
);

/**
 * Type of {@link FeedJobKey}.
 *
 * @category models
 * @since 0.0.0
 */
export type FeedJobKey = typeof FeedJobKey.Type;

/**
 * What a lookup asks: the merge base, its first-parent ancestors nearest
 * first, the jobs whose reports it wants, and the gates to keep.
 *
 * **Details**
 *
 * `ancestors` is `git rev-list --first-parent <mergeBase>` without the merge
 * base itself; only the first {@link MAIN_FEED_ANCESTOR_LIMIT} are read. An
 * empty `gates` keeps every gate.
 *
 * **Example** (Ask for one job's test reports)
 *
 * ```ts
 * import { MainFeedRequest } from "@beep/repo-cli/commands/Ci"
 *
 * const request = MainFeedRequest.make({
 *   mergeBase: "bc49cb6f0000000000000000000000000000beef",
 *   ancestors: [],
 *   jobs: ["test-unit-shard-unit-a"],
 *   gates: ["test"],
 * })
 * console.log(request.jobs.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MainFeedRequest extends S.Opaque<MainFeedRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    mergeBase: CommitSha,
    ancestors: S.Array(CommitSha),
    jobs: S.NonEmptyArray(FeedJobKey),
    gates: S.Array(GateName),
  }).pipe(
    $I.annoteSchema("MainFeedRequest", {
      description: "A merge base, its first-parent ancestors, the jobs and the gates a main feed lookup reads.",
    })
  )
) {}

/**
 * One job's reports in the hit run: the job key, its artifact's name, and the
 * reports kept for the requested gates.
 *
 * @category models
 * @since 0.0.0
 */
export class MainFeedJob extends S.Opaque<MainFeedJob, { readonly brand: unique symbol }>()(
  S.Struct({
    job: FeedJobKey,
    artifact: Text,
    reports: S.Array(FeedReport),
  }).pipe(
    $I.annoteSchema("MainFeedJob", {
      description: "One job's artifact in a main run and the gate reports kept from it.",
    })
  )
) {}

/**
 * Why a lookup found no baseline: no completed run of the workflow at the
 * merge base or at any ancestor in the page it reads.
 *
 * @category models
 * @since 0.0.0
 */
export const MainFeedMissReason = LiteralKit(["no-main-run"]).pipe(
  $I.annoteSchema("MainFeedMissReason", { description: "Why a main feed lookup found no baseline." })
);

/**
 * A lookup's answer: the hit run with its jobs' reports, or a miss; each
 * with the REST requests it spent.
 *
 * **Details**
 *
 * `distance` is 0 for a hit at the merge base and `n` for its `n`-th
 * first-parent ancestor. `missing` names the requested jobs whose artifact
 * the hit run does not hold.
 *
 * **Example** (A miss)
 *
 * ```ts
 * import { MainFeedResult } from "@beep/repo-cli/commands/Ci"
 *
 * const miss = MainFeedResult.cases.MainFeedMiss.make({ reason: "no-main-run", requests: 2 })
 * console.log(miss._tag) // "MainFeedMiss"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MainFeedResult = S.TaggedUnion({
  MainFeedHit: {
    sha: CommitSha,
    distance: Count,
    runId: S.Int,
    runAttempt: S.Int,
    jobs: S.Array(MainFeedJob),
    missing: S.Array(FeedJobKey),
    requests: Count,
  },
  MainFeedMiss: { reason: MainFeedMissReason, requests: Count },
}).pipe(
  $I.annoteSchema("MainFeedResult", {
    description: "A main feed lookup's hit run and reports, or its miss, with the REST requests it spent.",
  })
);

/**
 * Type of {@link MainFeedResult}.
 *
 * @category models
 * @since 0.0.0
 */
export type MainFeedResult = typeof MainFeedResult.Type;

const RunWire = S.Struct({
  id: S.Int,
  head_sha: S.String,
  conclusion: S.NullOr(S.String),
  created_at: S.String,
  run_attempt: S.optionalKey(S.Int),
});

type RunWire = typeof RunWire.Type;

const RunsPage = S.Struct({ workflow_runs: S.Array(RunWire) });

const RAN_GATES = ["success", "failure"];

const ranGates = (run: RunWire): boolean => A.contains(RAN_GATES, run.conclusion ?? "");

const newestFirst = Order.flip(Order.mapInput(Order.String, (run: RunWire) => run.created_at));

const newestThatRan = (runs: ReadonlyArray<RunWire>): O.Option<RunWire> =>
  A.findFirst(A.sort(runs, newestFirst), ranGates);

const keep =
  (gates: ReadonlyArray<string>) =>
  (gate: string): boolean =>
    A.isReadonlyArrayEmpty(gates) || A.contains(gates, gate);

const ancestorHit = (
  ancestors: ReadonlyArray<string>,
  runs: ReadonlyArray<RunWire>
): O.Option<{ readonly run: RunWire; readonly distance: number }> => {
  const bySha = A.reduce(A.sort(runs, newestFirst), HashMap.empty<string, RunWire>(), (map, run) =>
    ranGates(run) && !HashMap.has(map, run.head_sha) ? HashMap.set(map, run.head_sha, run) : map
  );
  return pipe(
    A.take(ancestors, MAIN_FEED_ANCESTOR_LIMIT),
    A.findFirstWithIndex((sha) => HashMap.has(bySha, sha)),
    O.flatMap(([sha, index]) => O.map(HashMap.get(bySha, sha), (run) => ({ run, distance: index + 1 })))
  );
};

/**
 * Look `main`'s newest gate reports up at a merge base.
 *
 * **Example** (Build a lookup)
 *
 * ```ts
 * import { lookupMainFeed, MainFeedRequest } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const request = MainFeedRequest.make({
 *   mergeBase: "bc49cb6f0000000000000000000000000000beef",
 *   ancestors: [],
 *   jobs: ["test-unit-shard-unit-a"],
 *   gates: [],
 * })
 * console.log(Effect.isEffect(lookupMainFeed(request))) // true
 * ```
 *
 * @param request - The merge base, its ancestors, the jobs and the gates.
 * @returns The hit run's reports, or a miss, with the requests spent.
 * @category use-cases
 * @since 0.0.0
 */
export const lookupMainFeed = Effect.fn("CiMainFeed.lookup")(function* (request: MainFeedRequest) {
  const client = yield* GitHubClient;
  const { owner, repo } = yield* Repo;
  const spent = yield* Ref.make(0);
  const counted = <A>(effect: Effect.Effect<A, GitHubError>) =>
    Ref.update(spent, (n) => n + 1).pipe(
      Effect.andThen(effect),
      CiCommandError.mapError("Failed to read main's gate reports.")
    );
  const listRuns = (query: { readonly head_sha?: string; readonly created?: string; readonly branch?: string }) =>
    counted(
      client.requestDecoded(
        "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs",
        {
          owner,
          repo,
          workflow_id: MAIN_FEED_WORKFLOW,
          event: "push",
          status: "completed",
          per_page: MAIN_FEED_ANCESTOR_LIMIT,
          ...query,
        },
        RunsPage
      )
    ).pipe(Effect.map((page) => page.workflow_runs));

  const atMergeBase = yield* listRuns({ head_sha: request.mergeBase });
  const hit = yield* O.match(newestThatRan(atMergeBase), {
    onSome: (run) => Effect.succeedSome({ run, distance: 0 }),
    onNone: () =>
      A.isReadonlyArrayEmpty(request.ancestors)
        ? Effect.succeedNone
        : listRuns({
            branch: "main",
            ...O.match(A.head(A.sort(atMergeBase, newestFirst)), {
              onNone: () => ({}),
              onSome: (run) => ({ created: `<=${run.created_at}` }),
            }),
          }).pipe(Effect.map((runs) => ancestorHit(request.ancestors, runs))),
  });
  if (O.isNone(hit)) {
    return MainFeedResult.cases.MainFeedMiss.make({ reason: "no-main-run", requests: yield* Ref.get(spent) });
  }
  const { run, distance } = hit.value;
  const attempt = run.run_attempt ?? 1;
  const wanted = keep(request.gates);
  const read = yield* Effect.forEach(
    request.jobs,
    (job) => {
      const name = `${taskOutcomeArtifactPrefix(run.id, attempt)}${job}`;
      return counted(
        client.requestDecoded(
          "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts",
          { owner, repo, run_id: run.id, name, per_page: 1 },
          FeedArtifactPage
        )
      ).pipe(
        Effect.flatMap((page) =>
          O.match(
            A.findFirst(page.artifacts, (artifact) => artifact.name === name && !artifact.expired),
            {
              onNone: () => Effect.succeed(O.none<MainFeedJob>()),
              onSome: (artifact) =>
                Ref.update(spent, (n) => n + 1).pipe(
                  Effect.andThen(downloadFeedArtifact(artifact, wanted)),
                  Effect.map((feed) => MainFeedJob.makeOption({ job, artifact: name, reports: feed.reports }))
                ),
            }
          )
        ),
        Effect.map((found) => ({ job, found }))
      );
    },
    { concurrency: 1 }
  );
  return MainFeedResult.cases.MainFeedHit.make({
    sha: run.head_sha,
    distance,
    runId: run.id,
    runAttempt: attempt,
    jobs: A.getSomes(A.map(read, ({ found }) => found)),
    missing: A.map(
      A.filter(read, ({ found }) => O.isNone(found)),
      ({ job }) => job
    ),
    requests: yield* Ref.get(spent),
  });
});

/**
 * The main feed service's operations.
 *
 * @category services
 * @since 0.0.0
 */
export interface MainFeedShape {
  readonly lookup: (request: MainFeedRequest) => Effect.Effect<MainFeedResult, CiCommandError>;
}

/**
 * The main feed service: `main`'s newest gate reports at a merge base, read
 * through the `GitHubClient` and `Repo` in context when its layer is built.
 *
 * **Example** (Provide the lookup)
 *
 * ```ts
 * import { MainFeed } from "@beep/repo-cli/commands/Ci"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(MainFeed.layer)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class MainFeed extends Context.Service<MainFeed, MainFeedShape>()($I`MainFeed`) {
  /**
   * The lookup over {@link lookupMainFeed}.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<MainFeed, never, GitHubClient | Repo> = Layer.effect(
    MainFeed,
    Effect.map(Effect.context<GitHubClient | Repo>(), (context) =>
      MainFeed.of({ lookup: flow(lookupMainFeed, Effect.provideContext(context)) })
    )
  );
}
