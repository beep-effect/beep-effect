import { $ScratchpadId } from "@beep/identity/packages";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/github/Repo");

/**
 * A repository slug was not `owner/repo`.
 *
 * @public
 */
export class InvalidRepoRefError extends S.TaggedError<InvalidRepoRefError>($I`InvalidRepoRefError`)("InvalidRepoRefError", {
	/** What was handed in. */
	input: S.String.annotateKey({ description: "What was handed in." }),
}, $I.annote("InvalidRepoRefError", { description: "A repository slug was not `owner/repo`." })) {
	override get message(): string {
		return `not an owner/repo slug: ${JSON.stringify(this.input)}`;
	}
}

/**
 * Which repository an operation acts on.
 *
 * @public
 */
export class RepoRef extends S.Class<RepoRef>($I`RepoRef`)({
	/** The user or organization. */
	owner: S.NonEmptyString.annotateKey({ description: "The user or organization." }),
	/** The repository name, without the owner. */
	repo: S.NonEmptyString.annotateKey({ description: "The repository name, without the owner." }),
}, $I.annote("RepoRef", { description: "Which repository an operation acts on." })) {
	/**
	 * Parse `"owner/repo"`, synchronously.
	 *
	 * @remarks
	 * The sync `Result` primitive; {@link RepoRef.parse} is the `Effect` form over
	 * it. `make` is reserved by the class factory for the validated field
	 * constructor, which is why string parsing is named rather than overloaded.
	 */
	static parseResult(slug: string): Result.Result<RepoRef, InvalidRepoRefError> {
		const parts = slug.split("/");
		const [owner, repo] = parts;
		if (parts.length !== 2 || owner === undefined || repo === undefined || owner === "" || repo === "") {
			return Result.fail(InvalidRepoRefError.make({ input: slug }));
		}
		return Result.succeed(RepoRef.make({ owner, repo }));
	}

	/** Parse `"owner/repo"`. */
	static readonly parse = Effect.fn("RepoRef.parse")((slug: string) => Effect.fromResult(RepoRef.parseResult(slug)));

	/** `"owner/repo"`. */
	get slug(): string {
		return `${this.owner}/${this.repo}`;
	}
}

/**
 * The repository the surrounding program acts on.
 *
 * @remarks
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
 * @example
 * ```ts
 * import { Repo, RepoRef } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * declare const syncOne: Effect.Effect<void, never, Repo>;
 * declare const targets: ReadonlyArray<RepoRef>;
 *
 * const syncAll = Effect.forEach(targets, (target) => syncOne.pipe(Repo.provide(target)), {
 *   concurrency: 4,
 * });
 * ```
 *
 * Repo is resolved per operation so Repo.provide can redirect an already built resource service.
 * @effect-leakable-service
 *
 * @public
 */
export class Repo extends Context.Service<Repo, RepoRef>()($I`Repo`) {
	/** The repository, as a value you already have. */
	static readonly layer = (ref: RepoRef): Layer.Layer<Repo> => Layer.succeed(Repo, ref);

	/** The repository, from an `"owner/repo"` slug. */
	static readonly layerFromSlug = (slug: string): Layer.Layer<Repo, InvalidRepoRefError> =>
		Layer.effect(Repo, RepoRef.parse(slug));

	/**
	 * The repository from configuration, `GITHUB_REPOSITORY` by default.
	 *
	 * @remarks
	 * The one env-driven variant, read through the ambient `ConfigProvider` rather
	 * than `process.env` — so a test provides a provider instead of mutating the
	 * environment, and a consumer outside Actions can source it however it likes.
	 */
	static readonly layerFromConfig = (
		options: { readonly name?: string | undefined } = {},
	): Layer.Layer<Repo, Config.ConfigError | InvalidRepoRefError> =>
		Layer.effect(
			Repo,
			Effect.flatMap(Config.String(options.name ?? "GITHUB_REPOSITORY"), (slug) => RepoRef.parse(slug)),
		);

	/** Run `effect` against a different repository. */
	static readonly provide =
		(ref: RepoRef) =>
		<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, Exclude<R, Repo>> =>
			Effect.provideService(effect, Repo, ref);
}
