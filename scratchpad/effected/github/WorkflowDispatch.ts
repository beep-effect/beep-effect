import { Clock, Context, Duration, Effect, Layer, Option, Schedule, Schema } from "effect";
import { GitHubClient } from "./GitHubClient.ts";
import { GitHubError } from "./GitHubError.ts";
import { numericId } from "./internal/ids.ts";
import { Repo } from "./Repo.ts";
import { PageOptions } from "./Rest.ts";

/**
 * Where a workflow run has got to.
 *
 * @public
 */
export class WorkflowRunStatus extends Schema.Class<WorkflowRunStatus>("WorkflowRunStatus")({
	/** The run's numeric id. */
	id: Schema.Int,
	/** `queued`, `in_progress`, `completed`, … */
	status: Schema.String,
	/** Set once `status` is `completed`. */
	conclusion: Schema.optionalKey(Schema.String),
	/** The run's web URL. */
	url: Schema.String,
}) {
	/** Has the run finished, whatever the outcome? */
	get isDone(): boolean {
		return this.status === "completed";
	}
}

/**
 * One workflow defined in the repository.
 *
 * @remarks
 * `state` is GitHub's own value — `active`, `disabled_manually`,
 * `disabled_inactivity`, and so on. It is reported rather than interpreted:
 * whether a *disabled* workflow counts for a given GitHub feature is that
 * feature's rule, not this package's. Callers that care filter on it
 * themselves.
 *
 * @public
 */
export interface WorkflowInfo {
	/** The workflow's numeric id, usable as `workflow_id` on other routes. */
	readonly id: number;
	/** The workflow's display name. */
	readonly name: string;
	/** Repository-relative path, e.g. `.github/workflows/ci.yml`. */
	readonly path: string;
	/** GitHub's state string; see the remarks above before branching on it. */
	readonly state: string;
}

/**
 * How often to poll for a dispatched run, and how long to keep polling.
 *
 * @public
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
	 * @remarks
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
	 * @remarks
	 * The wait is `Effect.repeat` with a predicate over the **success** value, so
	 * "not finished yet" is never an error. If the run is not found finished
	 * within `poll.timeout`, it fails with a `rejected` `GitHubError` (status
	 * 408). The run is matched by branch, creation time and workflow path, so
	 * concurrent dispatches of the same workflow on the same ref can be confused.
	 */
	readonly dispatchAndWait: (
		workflow: string,
		ref: string,
		options?: { readonly inputs?: Record<string, string> | undefined; readonly poll?: PollOptions | undefined },
	) => Effect.Effect<WorkflowRunStatus, GitHubError, Repo>;
}

/**
 * Dispatch workflows, wait for the run they start, and list the repository's
 * workflows.
 *
 * @remarks
 * Provide it with {@link WorkflowDispatch.layer}, which needs a `GitHubClient`;
 * each method also needs a `Repo` in `R`. `list` is an `Effect` value, not a
 * function.
 *
 * @example
 * ```ts
 * import { WorkflowDispatch } from "./index.ts";
 * import { Duration, Effect } from "effect";
 *
 * const release = Effect.gen(function* () {
 *   const workflows = yield* WorkflowDispatch;
 *   const run = yield* workflows.dispatchAndWait("release.yml", "main", {
 *     inputs: { dryRun: "false" },
 *     poll: { interval: Duration.seconds(15), timeout: Duration.minutes(20) },
 *   });
 *   return run.conclusion;
 * });
 * ```
 *
 * @public
 */
export class WorkflowDispatch extends Context.Service<WorkflowDispatch, WorkflowDispatchShape>()(
	"@effected/github/WorkflowDispatch",
) {
	/** The live service, built over a `GitHubClient`. */
	static readonly layer: Layer.Layer<WorkflowDispatch, never, GitHubClient> = Layer.effect(
		this,
		Effect.map(GitHubClient, (client) => make(client)),
	);

	/** An in-memory double; unstubbed members die naming themselves. */
	static readonly makeTest = (overrides: Partial<WorkflowDispatchShape> = {}): WorkflowDispatchShape => ({
		dispatch: overrides.dispatch ?? (() => unstubbed("dispatch")),
		runStatus: overrides.runStatus ?? (() => unstubbed("runStatus")),
		// A value member, so the stub has to defer: `unstubbed()` throws, and
		// throwing while BUILDING the double would fail every test that provides
		// it rather than the ones that actually read `list`.
		list: overrides.list ?? Effect.sync(() => unstubbed("list")),
		dispatchAndWait: overrides.dispatchAndWait ?? (() => unstubbed("dispatchAndWait")),
	});

	/** {@link WorkflowDispatch.makeTest} behind a `Layer`. */
	static readonly layerTest = (overrides: Partial<WorkflowDispatchShape> = {}): Layer.Layer<WorkflowDispatch> =>
		Layer.succeed(WorkflowDispatch, WorkflowDispatch.makeTest(overrides));
}

const unstubbed = (member: string): never => {
	throw new Error(`WorkflowDispatch.makeTest: ${member}() was called but not stubbed — pass an override.`);
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
			...(inputs !== undefined ? { inputs } : {}),
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
		const workflows = yield* client.paginate("GET /repos/{owner}/{repo}/actions/workflows", { owner, repo });
		return workflows.map(
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
			options?: { readonly inputs?: Record<string, string> | undefined; readonly poll?: PollOptions | undefined },
		) {
			const { owner, repo } = yield* Repo;
			const interval = options?.poll?.interval ?? DEFAULT_INTERVAL;
			const timeout = options?.poll?.timeout ?? DEFAULT_TIMEOUT;
			const attempts = Math.max(1, Math.ceil(Duration.toMillis(timeout) / Duration.toMillis(interval)));
			yield* Effect.annotateCurrentSpan({ owner, repo, workflow, ref, attempts });

			// GitHub answers a dispatch with 204 and no run id, so the run has to be
			// found by when it was created. `dispatchedAt` is read before the
			// dispatch so a run created in the same second is not missed.
			const dispatchedAt = new Date(yield* Clock.currentTimeMillis).toISOString();
			yield* dispatch(workflow, ref, options?.inputs);

			const findRun = Effect.gen(function* () {
				const runs = yield* client.paginate(
					"GET /repos/{owner}/{repo}/actions/runs",
					{ owner, repo, created: `>=${dispatchedAt}`, branch: ref },
					PageOptions.make({ perPage: 10, maxPages: 1 }),
				);
				const match = runs.find((run) => run.path?.endsWith(workflow) ?? true);
				return match === undefined ? Option.none<WorkflowRunStatus>() : Option.some(statusOf(match));
			});

			const settled = yield* Effect.repeat(findRun, {
				// Repeat WHILE the answer is "not yet" — a predicate over the success
				// value, so "pending" never has to masquerade as an error.
				while: (found) => Option.isNone(found) || !found.value.isDone,
				schedule: Schedule.spaced(interval),
				times: attempts,
			});

			if (Option.isNone(settled) || !settled.value.isDone) {
				return yield* Effect.fail(
					GitHubError.rejected(
						"WorkflowDispatch.dispatchAndWait",
						408,
						`workflow ${workflow} did not finish within ${Duration.format(timeout)}`,
					),
				);
			}
			return settled.value;
		}),
	};
};
