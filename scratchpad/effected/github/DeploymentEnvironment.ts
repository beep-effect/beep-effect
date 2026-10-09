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
 * **Example** (Decode a listed environment)
 *
 * ```ts
 * import { DeploymentEnvironmentInfo } from "@beep/scratchpad/effected/github/DeploymentEnvironment";
 * import * as S from "effect/Schema";
 *
 * const environment = S.decodeUnknownSync(DeploymentEnvironmentInfo)({ name: "production" });
 * console.log(environment.name) // production
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const DeploymentEnvironmentInfo = S.Struct({
	/** The environment's name. */
	name: S.String.annotateKey({ description: "The environment's name." }),
}).annotate($I.annote("DeploymentEnvironmentInfo", { description: "A deployment environment's plain-object listing projection." }));

/**
 * The structural listing result owned by {@link DeploymentEnvironmentInfo}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DeploymentEnvironmentInfo = typeof DeploymentEnvironmentInfo.Type;

/**
 * Create or update, list and delete a repository's deployment environments.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface DeploymentEnvironmentShape {
	/**
	 * Create or update a deployment environment.
	 *
	 * **Details**
	 *
	 * The route is **idempotent** — a `PUT` on an existing environment updates it
	 * — so there is no list-then-branch here, unlike variables.
	 *
	 * `config` stays an open record because the protection-rule body is a moving
	 * target: wait timers, reviewers, deployment-branch policies and whatever
	 * GitHub adds next.
	 *
	 * **Example** (Construct the upsert operation)
	 *
	 * ```ts
	 * import { DeploymentEnvironment } from "@beep/scratchpad/effected/github/DeploymentEnvironment";
	 * import * as Effect from "effect/Effect";
	 *
	 * const program = Effect.gen(function* () {
	 *   const service = yield* DeploymentEnvironment;
	 *   return yield* service.upsert("production", { wait_timer: 10 });
	 * });
	 * console.log(Effect.isEffect(program)) // true
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	readonly upsert: (name: string, config?: Record<string, unknown>) => Effect.Effect<void, GitHubError, Repo>;

	/**
	 * The repository's deployment environments.
	 *
	 * **Example** (Construct the list operation)
	 *
	 * ```ts
	 * import { DeploymentEnvironment } from "@beep/scratchpad/effected/github/DeploymentEnvironment";
	 * import * as Effect from "effect/Effect";
	 *
	 * const program = Effect.gen(function* () {
	 *   const service = yield* DeploymentEnvironment;
	 *   return yield* service.list;
	 * });
	 * console.log(Effect.isEffect(program)) // true
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	readonly list: Effect.Effect<ReadonlyArray<DeploymentEnvironmentInfo>, GitHubError, Repo>;

	/**
	 * Remove one deployment environment.
	 *
	 * **Gotchas**
	 *
	 * **This deletes the environment's secrets and variables with it.** Anything
	 * sequencing a cleanup pass depends on that: removing an environment after
	 * its secrets is redundant, and removing it before them makes those deletions
	 * fail against a resource that no longer exists.
	 *
	 * **Example** (Construct the delete operation)
	 *
	 * ```ts
	 * import { DeploymentEnvironment } from "@beep/scratchpad/effected/github/DeploymentEnvironment";
	 * import * as Effect from "effect/Effect";
	 *
	 * const program = Effect.gen(function* () {
	 *   const service = yield* DeploymentEnvironment;
	 *   return yield* service.delete("preview");
	 * });
	 * console.log(Effect.isEffect(program)) // true
	 * ```
	 *
	 * @category utilities
	 * @since 0.0.0
	 */
	readonly delete: (name: string) => Effect.Effect<void, GitHubError, Repo>;
}

/**
 * Create or update, list and delete a repository's deployment environments.
 *
 * **Details**
 *
 * Provide it with {@link DeploymentEnvironment.layer}, which needs a
 * `GitHubClient`; each method also needs a `Repo` in `R`.
 *
 * **Example** (Configure a production wait timer and list environments)
 *
 * ```ts
 * import { DeploymentEnvironment } from "@beep/scratchpad/effected/github/DeploymentEnvironment";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const environments = yield* DeploymentEnvironment;
 *   yield* environments.upsert("production", { wait_timer: 10 });
 *   return yield* environments.list;
 * });
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class DeploymentEnvironment extends Context.Service<DeploymentEnvironment, DeploymentEnvironmentShape>()(
	$I`DeploymentEnvironment`,
) {
	/**
	 * The live service, built over a `GitHubClient`.
	 *
	 * **Gotchas**
	 *
	 * `(client) => make(client)` rather than `make`: a static initializer runs
	 * while the module body is still evaluating, so naming a `const` declared
	 * further down throws at import time with a clean typecheck.
	 *
	 * **Example** (Inspect the live service layer)
	 *
	 * ```ts
	 * import { DeploymentEnvironment } from "@beep/scratchpad/effected/github/DeploymentEnvironment";
	 * import * as Layer from "effect/Layer";
	 *
	 * console.log(Layer.isLayer(DeploymentEnvironment.layer)) // true
	 * ```
	 *
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layer: Layer.Layer<DeploymentEnvironment, never, GitHubClient> = Layer.effect(
		this,
		Effect.map(GitHubClient, (client) => make(client)),
	);

	/**
	 * An in-memory double; unstubbed members die naming themselves.
	 *
	 * **Example** (Stub a test service member)
	 *
	 * ```ts
	 * import { DeploymentEnvironment } from "@beep/scratchpad/effected/github/DeploymentEnvironment";
	 * import * as Effect from "effect/Effect";
	 *
	 * const service = DeploymentEnvironment.makeTest({ list: Effect.succeed([]) });
	 * console.log(Effect.isEffect(service.list)) // true
	 * ```
	 *
	 * @category constructors
	 * @since 0.0.0
	 */
	static readonly makeTest = (overrides: Partial<DeploymentEnvironmentShape> = {}): DeploymentEnvironmentShape => ({
		upsert: overrides.upsert ?? (() => unstubbed("upsert")),
		list: overrides.list ?? (Effect.suspend(() => unstubbed("list"))),
		delete: overrides.delete ?? (() => unstubbed("delete")),
	});

	/**
	 * {@link DeploymentEnvironment.makeTest} behind a `Layer`.
	 *
	 * **Example** (Construct a test service layer)
	 *
	 * ```ts
	 * import { DeploymentEnvironment } from "@beep/scratchpad/effected/github/DeploymentEnvironment";
	 * import * as Layer from "effect/Layer";
	 *
	 * const layer = DeploymentEnvironment.layerTest();
	 * console.log(Layer.isLayer(layer)) // true
	 * ```
	 *
	 * @category layers
	 * @since 0.0.0
	 */
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
