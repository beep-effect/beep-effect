import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import { GitHubClient } from "./GitHubClient.ts";
import { GitHubError } from "./GitHubError.ts";
import { numericId } from "./internal/ids.ts";
import { Repo } from "./Repo.ts";
import { PageOptions } from "./Rest.ts";

const $I = $ScratchpadId.create("effected/github/WorkflowDispatch");

class UnstubbedError extends S.TaggedError<UnstubbedError>($I`UnstubbedError`)("UnstubbedError", {
	message: S.String,
}, $I.annote("UnstubbedError", { description: "An unconfigured test-double member was called." })) {}

/**
 * Where a workflow run has got to.
 *
 * **Example** (Inspect a completed workflow run)
 *
 * ```ts
 * import { WorkflowRunStatus } from "@beep/scratchpad/effected/github/WorkflowDispatch";
 *
 * const run = WorkflowRunStatus.make({
 *   id: 42, status: "completed", conclusion: "success",
 *   url: "https://github.com/acme/project/actions/runs/42",
 * });
 * console.log(run.conclusion); // success
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class WorkflowRunStatus extends S.Class<WorkflowRunStatus>($I`WorkflowRunStatus`)({
  /** The run's numeric id. */
  id: S.Int.annotateKey({ description: "The run's numeric id." }),
  /** `queued`, `in_progress`, `completed`, … */
  status: S.String.annotateKey({ description: "`queued`, `in_progress`, `completed`, …" }),
  /** Set once `status` is `completed`. */
  conclusion: S.optionalKey(S.String).annotateKey({ description: "Set once `status` is `completed`." }),
  /** The run's web URL. */
  url: S.String.annotateKey({ description: "The run's web URL." }),
}, $I.annote("WorkflowRunStatus", { description: "Where a workflow run has got to." })) {
  /**
   * Has the run finished, whatever the outcome?
   *
   * **Example** (Recognize a finished run with a failing conclusion)
   *
   * ```ts
   * import { WorkflowRunStatus } from "@beep/scratchpad/effected/github/WorkflowDispatch";
   *
   * const run = WorkflowRunStatus.make({
   *   id: 42, status: "completed", conclusion: "failure",
   *   url: "https://github.com/acme/project/actions/runs/42",
   * });
   * console.log(run.isDone); // true
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get isDone(): boolean {
    return this.status === "completed";
  }
}

/**
 * One workflow defined in the repository.
 *
 * **Details**
 *
 * `state` is GitHub's own value — `active`, `disabled_manually`,
 * `disabled_inactivity`, and so on. It is reported rather than interpreted:
 * whether a *disabled* workflow counts for a given GitHub feature is that
 * feature's rule, not this package's. Callers that care filter on it
 * themselves.
 *
 * **Example** (Decode a workflow definition)
 *
 * ```ts
 * import { WorkflowInfo } from "@beep/scratchpad/effected/github/WorkflowDispatch";
 * import * as S from "effect/Schema";
 *
 * const workflow = S.decodeUnknownSync(WorkflowInfo)({
 *   id: 1, name: "CI", path: ".github/workflows/ci.yml", state: "active",
 * });
 * console.log(workflow.state); // active
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const WorkflowInfo = S.Struct({
  /** The workflow's numeric id, usable as `workflow_id` on other routes. */
  id: S.Finite.annotateKey({ description: "The workflow's numeric id, usable as workflow_id on other routes." }),
  /** The workflow's display name. */
  name: S.String.annotateKey({ description: "The workflow's display name." }),
  /** Repository-relative path, e.g. `.github/workflows/ci.yml`. */
  path: S.String.annotateKey({ description: "Repository-relative workflow path." }),
  /** GitHub's state string; see the Details above before branching on it. */
  state: S.String.annotateKey({ description: "GitHub's uninterpreted workflow state string." }),
}).annotate($I.annote("WorkflowInfo", { description: "One workflow defined in the repository." }));

/**
 * The plain-object result described by {@link WorkflowInfo}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type WorkflowInfo = typeof WorkflowInfo.Type;

/**
 * How often to poll for a dispatched run, and how long to keep polling.
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export interface PollOptions {
  /** How often to check. Defaults to ten seconds. */
  readonly interval?: Duration.Duration | undefined;
  /** How long to keep checking. Defaults to five minutes. */
  readonly timeout?: Duration.Duration | undefined;
}

const DEFAULT_INTERVAL = Duration.seconds(10);
const DEFAULT_TIMEOUT = Duration.minutes(5);

/**
 * Dispatch workflows, wait for the run they start, and list the repository's
 * workflows.
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export interface WorkflowDispatchShape {
  /** Fire a `workflow_dispatch` event. GitHub answers 204 with no run id. */
  readonly dispatch: (
    workflow: string,
    ref: string,
    inputs?: Record<string, string>,
  ) => Effect.Effect<void, GitHubError, Repo>;
  /** Read one workflow run's status. */
  readonly runStatus: (runId: number) => Effect.Effect<WorkflowRunStatus, GitHubError, Repo>;
  /**
   * Every workflow defined in the repository.
   *
   * **Details**
   *
   * The question this answers is "does this repository have workflows at all",
   * which nothing else in the package could ask: repository *languages* come
   * from linguist and can never report `actions`, while GitHub validates that
   * language against workflow **files**. A consumer offering CodeQL setup
   * otherwise has to either request `actions` blindly and absorb a 422, or
   * drop it for every repository including the ones where it is valid.
   *
   * An empty array is the honest answer for a repository with no workflows,
   * not an error.
   */
  readonly list: Effect.Effect<ReadonlyArray<WorkflowInfo>, GitHubError, Repo>;
  /**
   * Dispatch, find the run it created, and wait for it to finish.
   *
   * **Details**
   *
   * The wait is `Effect.repeat` with a predicate over the **success** value, so
   * "not finished yet" is never an error. If the run is not found finished
   * within `poll.timeout`, it fails with a `rejected` `GitHubError` (status
   * 408), including time spent inside requests. A non-positive polling interval
   * fails with a `rejected` `GitHubError` (status 422) before dispatching.
   * Discovery filters by workflow, event, branch and creation time, then retains
   * one run id. Concurrent dispatches of the same workflow on the same ref can
   * still be confused because GitHub's dispatch response supplies no run id.
   */
  readonly dispatchAndWait: (
    workflow: string,
    ref: string,
    options?: {
      readonly inputs?: Record<string, string> | undefined;
      readonly poll?: PollOptions | undefined
    },
  ) => Effect.Effect<WorkflowRunStatus, GitHubError, Repo>;
}

/**
 * Dispatch workflows, wait for the run they start, and list the repository's
 * workflows.
 *
 * **Details**
 *
 * Provide it with {@link WorkflowDispatch.layer}, which needs a `GitHubClient`;
 * each method also needs a `Repo` in `R`. `list` is an `Effect` value, not a
 * function.
 *
 * **Example** (Dispatch a release workflow and await its conclusion)
 *
 * ```ts
 * import { WorkflowDispatch } from "@beep/scratchpad/effected/github/WorkflowDispatch";
 * import * as Duration from "effect/Duration";
 * import * as Effect from "effect/Effect";
 *
 * const release = Effect.gen(function* () {
 *   const workflows = yield* WorkflowDispatch;
 *   const run = yield* workflows.dispatchAndWait("release.yml", "main", {
 *     inputs: { dryRun: "false" },
 *     poll: { interval: Duration.seconds(15), timeout: Duration.minutes(20) },
 *   });
 *   return run.conclusion;
 * });
 *
 * console.log(Effect.isEffect(release)); // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class WorkflowDispatch extends Context.Service<WorkflowDispatch, WorkflowDispatchShape>()(
  $I`WorkflowDispatch`,
) {
  /**
   * The live service, built over a `GitHubClient`.
   *
   * **Example** (Construct the live service layer)
   *
   * ```ts
   * import { WorkflowDispatch } from "@beep/scratchpad/effected/github/WorkflowDispatch";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(WorkflowDispatch.layer)); // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<WorkflowDispatch, never, GitHubClient> = Layer.effect(
    this,
    Effect.map(GitHubClient, (client) => make(client)),
  );

  /**
   * An in-memory double; unstubbed members die naming themselves.
   *
   * **Example** (Stub the workflow list)
   *
   * ```ts
   * import { WorkflowDispatch } from "@beep/scratchpad/effected/github/WorkflowDispatch";
   * import * as Effect from "effect/Effect";
   *
   * const workflows = WorkflowDispatch.makeTest({ list: Effect.succeed([]) });
   * const count = workflows.list.pipe(Effect.map((items) => items.length));
   * console.log(Effect.runSync(count)); // 0
   * ```
   *
   * @category testing
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<WorkflowDispatchShape> = {}): WorkflowDispatchShape => ({
    dispatch: overrides.dispatch ?? (() => unstubbed("dispatch")),
    runStatus: overrides.runStatus ?? (() => unstubbed("runStatus")),
    // A value member, so the stub has to defer: `unstubbed()` throws, and
    // throwing while BUILDING the double would fail every test that provides
    // it rather than the ones that actually read `list`.
    list: overrides.list ?? Effect.sync(() => unstubbed("list")),
    dispatchAndWait: overrides.dispatchAndWait ?? (() => unstubbed("dispatchAndWait")),
  });

  /**
   * {@link WorkflowDispatch.makeTest} behind a `Layer`.
   *
   * **Example** (Provide a workflow list through a test layer)
   *
   * ```ts
   * import { WorkflowDispatch } from "@beep/scratchpad/effected/github/WorkflowDispatch";
   * import * as Effect from "effect/Effect";
   *
   * const count = Effect.gen(function* () {
   *   const workflows = yield* WorkflowDispatch;
   *   return (yield* workflows.list).length;
   * }).pipe(Effect.provide(WorkflowDispatch.layerTest({ list: Effect.succeed([]) })));
   * console.log(Effect.runSync(count)); // 0
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<WorkflowDispatchShape> = {}): Layer.Layer<WorkflowDispatch> =>
    Layer.succeed(WorkflowDispatch, WorkflowDispatch.makeTest(overrides));
}

const unstubbed = (member: string): never => {
  throw UnstubbedError.make({ message: `WorkflowDispatch.makeTest: ${member}() was called but not stubbed — pass an override.` });
};

const statusOf = (raw: {
  id: number | bigint;
  status?: string | null;
  conclusion?: string | null;
  html_url: string;
}): WorkflowRunStatus =>
  WorkflowRunStatus.make({
    id: numericId(raw.id),
    status: raw.status ?? "unknown",
    ...(raw.conclusion != null ? { conclusion: raw.conclusion } : {}),
    url: raw.html_url,
  });

const make = (client: GitHubClient["Service"]): WorkflowDispatchShape => {
  const dispatch = Effect.fn("WorkflowDispatch.dispatch")(function* (
    workflow: string,
    ref: string,
    inputs?: Record<string, string>,
  ) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, workflow, ref });
    yield* client.request("POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches", {
      owner,
      repo,
      workflow_id: workflow,
      ref,
      ...O.getSomesStruct({ inputs: O.fromUndefinedOr(inputs) }),
    });
  });

  const runStatus = Effect.fn("WorkflowDispatch.runStatus")(function* (runId: number) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, runId });
    const raw = yield* client.request("GET /repos/{owner}/{repo}/actions/runs/{run_id}", {
      owner,
      repo,
      run_id: runId,
    });
    return statusOf(raw);
  });

  const list = Effect.fn("WorkflowDispatch.list")(function* () {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo });
    // Paginated. A single `request` returns one page, so a repository with more
    // workflows than a page holds would silently report a subset — and the
    // symptom is a length that disagrees with GitHub's own total_count.
    const workflows = yield* client.paginate("GET /repos/{owner}/{repo}/actions/workflows", {
      owner,
      repo,
    });
    return A.map(workflows,
      (workflow): WorkflowInfo => ({
        id: workflow.id,
        name: workflow.name,
        path: workflow.path,
        state: workflow.state,
      }),
    );
  });

  return {
    dispatch,
    runStatus,
    list: list(),

    dispatchAndWait: Effect.fn("WorkflowDispatch.dispatchAndWait")(function* (
      workflow: string,
      ref: string,
      options?: {
        readonly inputs?: Record<string, string> | undefined;
        readonly poll?: PollOptions | undefined
      },
    ) {
      const { owner, repo } = yield* Repo;
      const interval = options?.poll?.interval ?? DEFAULT_INTERVAL;
      const timeout = options?.poll?.timeout ?? DEFAULT_TIMEOUT;
      if (Duration.isPositive(interval) === false) {
        return yield* GitHubError.rejected(
          "WorkflowDispatch.dispatchAndWait", 422, "polling interval must be positive",
        );
      }
      yield* Effect.annotateCurrentSpan({
        owner,
        repo,
        workflow,
        ref,
        interval: Duration.format(interval),
        timeout: Duration.format(timeout),
      });

      // GitHub answers a dispatch with 204 and no run id, so the run has to be
      // found by when it was created. `dispatchedAt` is read before the
      // dispatch so a run created in the same second is not missed.
      const expired = GitHubError.rejected(
        "WorkflowDispatch.dispatchAndWait",
        408,
        `workflow ${workflow} did not finish within ${Duration.format(timeout)}`,
      );
      return yield* Effect.gen(function* () {
        const dispatchedAt = DateTime.formatIso(yield* DateTime.now);
        yield* dispatch(workflow, ref, options?.inputs);
        let selectedId = O.none<number>();
        const poll = Effect.fnUntraced(function* () {
          if (O.isSome(selectedId)) {
            return O.some(yield* runStatus(selectedId.value));
          }
          const runs = yield* client.paginate(
            "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs",
            { owner, repo, workflow_id: workflow, event: "workflow_dispatch", created: `>=${dispatchedAt}`, branch: ref },
            PageOptions.make({ perPage: 10, maxPages: 1 }),
          );
          const found = O.map(A.head(runs), statusOf);
          selectedId = O.map(found, (run) => run.id);
          return found;
        });
        const settled = yield* Effect.repeat(poll(), {
          while: (found) => O.isNone(found) || found.value.isDone === false,
          schedule: Schedule.spaced(interval),
        });
        return yield* Effect.fromOption(settled).pipe(Effect.mapError(() => expired));
      }).pipe(Effect.timeoutOrElse({ duration: timeout, orElse: () => Effect.fail(expired) }));
    }),
  };
};
