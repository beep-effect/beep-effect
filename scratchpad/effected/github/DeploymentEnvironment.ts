import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { GitHubClient } from "./GitHubClient.ts";
import type { GitHubError } from "./GitHubError.ts";
import { Repo } from "./Repo.ts";

const $I = $ScratchpadId.create("effected/github/DeploymentEnvironment");

class UnstubbedError extends S.TaggedError<UnstubbedError>($I`UnstubbedError`)("UnstubbedError", {
	message: S.String,
}, $I.annote("UnstubbedError", { description: "An unconfigured test-double member was called." })) {}

/**
 * A deployment environment, as listing returns it.
 *
 * @public
 */
export const DeploymentEnvironmentInfo = S.Struct({
	/** The environment's name. */
	name: S.String.annotateKey({ description: "The environment's name." }),
}).annotate($I.annote("DeploymentEnvironmentInfo", { description: "A deployment environment's plain-object listing projection." }));

/** The structural listing result owned by {@link DeploymentEnvironmentInfo}. */
export type DeploymentEnvironmentInfo = typeof DeploymentEnvironmentInfo.Type;

/**
 * Create or update, list and delete a repository's deployment environments.
 *
 * @public
 */
export interface DeploymentEnvironmentShape {
	/**
	 * Create or update a deployment environment.
	 *
	 * @remarks
	 * The route is **idempotent** — a `PUT` on an existing environment updates it
	 * — so there is no list-then-branch here, unlike variables.
	 *
	 * `config` stays an open record because the protection-rule body is a moving
	 * target: wait timers, reviewers, deployment-branch policies and whatever
	 * GitHub adds next.
	 */
	readonly upsert: (name: string, config?: Record<string, unknown>) => Effect.Effect<void, GitHubError, Repo>;

	/** The repository's deployment environments. */
	readonly list: Effect.Effect<ReadonlyArray<DeploymentEnvironmentInfo>, GitHubError, Repo>;

	/**
	 * Remove one deployment environment.
	 *
	 * @remarks
	 * **This deletes the environment's secrets and variables with it.** Anything
	 * sequencing a cleanup pass depends on that: removing an environment after
	 * its secrets is redundant, and removing it before them makes those deletions
	 * fail against a resource that no longer exists.
	 */
	readonly delete: (name: string) => Effect.Effect<void, GitHubError, Repo>;
}

/**
 * Create or update, list and delete a repository's deployment environments.
 *
 * @remarks
 * Provide it with {@link DeploymentEnvironment.layer}, which needs a
 * `GitHubClient`; each method also needs a `Repo` in `R`.
 *
 * @example
 * ```ts
 * import { DeploymentEnvironment } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const environments = yield* DeploymentEnvironment;
 *   yield* environments.upsert("production", { wait_timer: 10 });
 *   return yield* environments.list;
 * });
 * ```
 *
 * @public
 */
export class DeploymentEnvironment extends Context.Service<DeploymentEnvironment, DeploymentEnvironmentShape>()(
	$I`DeploymentEnvironment`,
) {
	/**
	 * The live service, built over a `GitHubClient`.
	 *
	 * @remarks
	 * `(client) => make(client)` rather than `make`: a static initializer runs
	 * while the module body is still evaluating, so naming a `const` declared
	 * further down throws at import time with a clean typecheck.
	 */
	static readonly layer: Layer.Layer<DeploymentEnvironment, never, GitHubClient> = Layer.effect(
		this,
		Effect.map(GitHubClient, (client) => make(client)),
	);

	/** An in-memory double; unstubbed members die naming themselves. */
	static readonly makeTest = (overrides: Partial<DeploymentEnvironmentShape> = {}): DeploymentEnvironmentShape => ({
		upsert: overrides.upsert ?? (() => unstubbed("upsert")),
		list: overrides.list ?? (Effect.suspend(() => unstubbed("list"))),
		delete: overrides.delete ?? (() => unstubbed("delete")),
	});

	/** {@link DeploymentEnvironment.makeTest} behind a `Layer`. */
	static readonly layerTest = (
		overrides: Partial<DeploymentEnvironmentShape> = {},
	): Layer.Layer<DeploymentEnvironment> =>
		Layer.succeed(DeploymentEnvironment, DeploymentEnvironment.makeTest(overrides));
}

const unstubbed = (member: string): never => {
	throw UnstubbedError.make({ message: `DeploymentEnvironment.makeTest: ${member}() was called but not stubbed — pass an override.` });
};

const make = (client: GitHubClient["Service"]): DeploymentEnvironmentShape => {
	const upsert = Effect.fn("DeploymentEnvironment.upsert")(function* (
		name: string,
		config: Record<string, unknown> = {},
	) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, environment: name });

		yield* client.request("PUT /repos/{owner}/{repo}/environments/{environment_name}", {
			// It spreads FIRST so the coordinates below stay authoritative: a caller
			// key named `owner`, `repo` or `environment_name` would otherwise
			// silently retarget the request at a different repository, with no
			// error and with the span still annotating the intended one.
			...config,
			owner,
			repo,
			environment_name: name,
		});
	});

	const list = Effect.suspend(Effect.fn("DeploymentEnvironment.list")(function* () {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo });

		const environments = yield* client.paginate("GET /repos/{owner}/{repo}/environments", { owner, repo });
		// Paginated, so this is already an array — octokit's paginator normalises
		// the envelope, including the case where a repository with none answers
		// without the key at all.
		return A.map(environments, (environment) => DeploymentEnvironmentInfo.make({ name: environment.name }));
	}));

	const delete_ = Effect.fn("DeploymentEnvironment.delete")(function* (name: string) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, environment: name });

		yield* client.request("DELETE /repos/{owner}/{repo}/environments/{environment_name}", {
    owner,
    repo,
    environment_name: name,
});
	});

	return { upsert, list, delete: delete_ };
};
