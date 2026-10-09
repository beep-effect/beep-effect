import { $ScratchpadId } from "@beep/identity/packages";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/github/Repo");

/**
 * Reports input that does not identify a repository as `owner/repo`.
 *
 * **Example** (Describe an invalid repository slug)
 *
 * ```ts
 * import { InvalidRepoRefError } from "@beep/scratchpad/effected/github/Repo";
 *
 * const error = InvalidRepoRefError.make({ input: "app" });
 * console.log(error.message) // not an owner/repo slug: "app"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class InvalidRepoRefError extends S.TaggedError<InvalidRepoRefError>($I`InvalidRepoRefError`)("InvalidRepoRefError", {
	/**
	 * What was handed in.
	 *
	 * @since 0.0.0
	 */
	input: S.String.annotateKey({ description: "What was handed in." }),
}, $I.annote("InvalidRepoRefError", { description: "A repository slug was not `owner/repo`." })) {
	/**
	 * Explains which input failed repository-slug validation.
	 *
	 * **Example** (Inspect the rejected repository slug)
	 *
	 * ```ts
	 * import { InvalidRepoRefError } from "@beep/scratchpad/effected/github/Repo";
	 *
	 * console.log(InvalidRepoRefError.make({ input: "app" }).message) // not an owner/repo slug: "app"
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		return `not an owner/repo slug: ${JSON.stringify(this.input)}`;
	}
}

/**
 * Identifies the owner and repository targeted by an operation.
 *
 * **Example** (Construct repository coordinates)
 *
 * ```ts
 * import { RepoRef } from "@beep/scratchpad/effected/github/Repo";
 *
 * const ref = RepoRef.make({ owner: "acme", repo: "app" });
 * console.log(ref.slug) // acme/app
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class RepoRef extends S.Class<RepoRef>($I`RepoRef`)({
	/**
	 * The user or organization.
	 *
	 * @since 0.0.0
	 */
	owner: S.NonEmptyString.annotateKey({ description: "The user or organization." }),
	/**
	 * The repository name, without the owner.
	 *
	 * @since 0.0.0
	 */
	repo: S.NonEmptyString.annotateKey({ description: "The repository name, without the owner." }),
}, $I.annote("RepoRef", { description: "Which repository an operation acts on." })) {
	/**
	 * Validates an `"owner/repo"` slug synchronously without throwing for invalid input.
	 *
	 * **Details**
	 *
	 * The sync `Result` primitive; {@link RepoRef.parse} is the `Effect` form over
	 * it. `make` is reserved by the class factory for the validated field
	 * constructor, which is why string parsing is named rather than overloaded.
	 *
	 * **Example** (Parse repository coordinates without an effect)
	 *
	 * ```ts
	 * import { RepoRef } from "@beep/scratchpad/effected/github/Repo";
	 * import * as Result from "effect/Result";
	 *
	 * console.log(Result.isSuccess(RepoRef.parseResult("acme/app"))) // true
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 */
	static parseResult(slug: string): Result.Result<RepoRef, InvalidRepoRefError> {
		const parts = slug.split("/");
		const [owner, repo] = parts;
		if (parts.length !== 2 || owner === undefined || repo === undefined || owner === "" || repo === "") {
			return Result.fail(InvalidRepoRefError.make({ input: slug }));
		}
		return Result.succeed(RepoRef.make({ owner, repo }));
	}

	/**
	 * Validates an `"owner/repo"` slug and reports invalid input through the Effect error channel.
	 *
	 * **Example** (Parse repository coordinates in an effect)
	 *
	 * ```ts
	 * import { RepoRef } from "@beep/scratchpad/effected/github/Repo";
	 * import * as Effect from "effect/Effect";
	 *
	 * console.log(Effect.runSync(RepoRef.parse("acme/app")).slug) // acme/app
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 */
	static readonly parse = Effect.fn("RepoRef.parse")((slug: string) => Effect.fromResult(RepoRef.parseResult(slug)));

	/**
	 * Formats the repository coordinates as an `"owner/repo"` slug.
	 *
	 * **Example** (Format repository coordinates)
	 *
	 * ```ts
	 * import { RepoRef } from "@beep/scratchpad/effected/github/Repo";
	 *
	 * console.log(RepoRef.make({ owner: "acme", repo: "app" }).slug) // acme/app
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get slug(): string {
		return `${this.owner}/${this.repo}`;
	}
}

/**
 * The repository the surrounding program acts on.
 *
 * **Details**
 *
 * Every resource service takes this in its `R` and **no method takes an
 * `{ owner, repo }` argument**, which is what makes a read like
 * `GitHubRepository.defaultBranch` a single expression instead of a preamble.
 *
 * The coordinate is a plain value. The only env-driven way to get one is
 * {@link Repo.layerFromConfig}, which is named for being env-driven, and a
 * program that acts on several repositories uses {@link Repo.provide}.
 *
 * The service shape is entirely one immutable value (a `RepoRef`), with no
 * methods, so `Layer.succeed` is the correct test double.
 *
 * Repo is resolved per operation so Repo.provide can redirect an already built resource service.
 *
 * **Example** (Run an operation across repositories concurrently)
 *
 * ```ts
 * import { Repo, RepoRef } from "@beep/scratchpad/effected/github/Repo";
 * import * as Effect from "effect/Effect";
 *
 * const syncOne = Effect.map(Repo, (ref) => ref.slug);
 * const targets = [
 *   RepoRef.make({ owner: "acme", repo: "app" }),
 *   RepoRef.make({ owner: "acme", repo: "docs" }),
 * ];
 *
 * const syncAll = Effect.forEach(targets, (target) => syncOne.pipe(Repo.provide(target)), {
 *   concurrency: 4,
 * });
 * console.log(Effect.isEffect(syncAll)) // true
 * ```
 *
 * @public
 * @effect-leakable-service
 * @category services
 * @since 0.0.0
 */
export class Repo extends Context.Service<Repo, RepoRef>()($I`Repo`) {
	/**
	 * The repository, as a value you already have.
	 *
	 * **Example** (Provide explicit repository coordinates)
	 *
	 * ```ts
	 * import { Repo, RepoRef } from "@beep/scratchpad/effected/github/Repo";
	 * import * as Effect from "effect/Effect";
	 *
	 * const program = Effect.map(Repo, (ref) => ref.slug).pipe(
	 *   Effect.provide(Repo.layer(RepoRef.make({ owner: "acme", repo: "app" }))),
	 * );
	 * console.log(Effect.runSync(program)) // acme/app
	 * ```
	 *
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layer = (ref: RepoRef): Layer.Layer<Repo> => Layer.succeed(Repo, ref);

	/**
	 * The repository, from an `"owner/repo"` slug.
	 *
	 * **Example** (Provide a parsed repository slug)
	 *
	 * ```ts
	 * import { Repo } from "@beep/scratchpad/effected/github/Repo";
	 * import * as Effect from "effect/Effect";
	 *
	 * const program = Effect.map(Repo, (ref) => ref.slug).pipe(Effect.provide(Repo.layerFromSlug("acme/app")));
	 * console.log(Effect.runSync(program)) // acme/app
	 * ```
	 *
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layerFromSlug = (slug: string): Layer.Layer<Repo, InvalidRepoRefError> =>
		Layer.effect(Repo, RepoRef.parse(slug));

	/**
	 * The repository from configuration, `GITHUB_REPOSITORY` by default.
	 *
	 * **Details**
	 *
	 * The one env-driven variant, read through the ambient `ConfigProvider` rather
	 * than `process.env` — so a test provides a provider instead of mutating the
	 * environment, and a consumer outside Actions can source it however it likes.
	 *
	 * **Example** (Construct a layer using a configuration key)
	 *
	 * ```ts
	 * import { Repo } from "@beep/scratchpad/effected/github/Repo";
	 * import * as Layer from "effect/Layer";
	 *
	 * const layer = Repo.layerFromConfig({ name: "TARGET_REPOSITORY" });
	 * console.log(Layer.isLayer(layer)) // true
	 * ```
	 *
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layerFromConfig = (
		options: { readonly name?: string | undefined } = {},
	): Layer.Layer<Repo, Config.ConfigError | InvalidRepoRefError> =>
		Layer.effect(
			Repo,
			Effect.flatMap(Config.String(options.name ?? "GITHUB_REPOSITORY"), (slug) => RepoRef.parse(slug)),
		);

	/**
	 * Run `effect` against a different repository.
	 *
	 * **Example** (Redirect an operation to a repository)
	 *
	 * ```ts
	 * import { Repo, RepoRef } from "@beep/scratchpad/effected/github/Repo";
	 * import * as Effect from "effect/Effect";
	 *
	 * const program = Effect.map(Repo, (ref) => ref.slug).pipe(
	 *   Repo.provide(RepoRef.make({ owner: "acme", repo: "app" })),
	 * );
	 * console.log(Effect.runSync(program)) // acme/app
	 * ```
	 *
	 * @category combinators
	 * @since 0.0.0
	 */
	static readonly provide =
		(ref: RepoRef) =>
		<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, Exclude<R, Repo>> =>
			Effect.provideService(effect, Repo, ref);
}
