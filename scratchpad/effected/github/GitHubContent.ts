import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { GitHubClient } from "./GitHubClient.ts";
import { GitHubError } from "./GitHubError.ts";
import { Repo } from "./Repo.ts";

const JsonValue = S.fromJsonString(S.String);

/**
 * Read a text file out of a repository at a ref.
 *
 * @public
 */
export interface GitHubContentShape {
	/**
	 * A text file's contents at `ref`, or the default branch when `ref` is
	 * omitted.
	 *
	 * @remarks
	 * Fails `notFound` when the path does not exist, and `rejected` when it is a
	 * directory, is not a regular file, or is too large for the contents API
	 * (which answers an empty body above roughly a megabyte).
	 */
	readonly getFile: (
		path: string,
		options?: { readonly ref?: string | undefined },
	) => Effect.Effect<string, GitHubError, Repo>;
	/** As {@link GitHubContentShape.getFile}, with absence as `Option.none`. */
	readonly getFileOption: (
		path: string,
		options?: { readonly ref?: string | undefined },
	) => Effect.Effect<O.Option<string>, GitHubError, Repo>;
}

/**
 * Read a text file out of a repository at a ref, with absence as an `Option`
 * when you want it.
 *
 * @remarks
 * Provide it with {@link GitHubContent.layer}, which needs a `GitHubClient`;
 * each method also needs a `Repo` in `R`.
 *
 * @example
 * ```ts
 * import { GitHubContent } from "./index.ts";
 * import { Effect, Option } from "effect";
 *
 * const readme = Effect.gen(function* () {
 *   const content = yield* GitHubContent;
 *   const file = yield* content.getFileOption("README.md", { ref: "main" });
 *   return Option.getOrElse(file, () => "");
 * });
 * ```
 *
 * @public
 */
export class GitHubContent extends Context.Service<GitHubContent, GitHubContentShape>()(
	"@beep/scratchpad/effected/github/GitHubContent",
) {
	/** The live service, built over a `GitHubClient`. */
	static readonly layer: Layer.Layer<GitHubContent, never, GitHubClient> = Layer.effect(
		this,
		Effect.map(GitHubClient, (client) => make(client)),
	);

	/** An in-memory double; unstubbed members die naming themselves. */
	static readonly makeTest = (overrides: Partial<GitHubContentShape> = {}): GitHubContentShape => ({
		getFile: overrides.getFile ?? (() => unstubbed("getFile")),
		getFileOption: overrides.getFileOption ?? (() => unstubbed("getFileOption")),
	});

	/** {@link GitHubContent.makeTest} behind a `Layer`. */
	static readonly layerTest = (overrides: Partial<GitHubContentShape> = {}): Layer.Layer<GitHubContent> =>
		Layer.succeed(GitHubContent, GitHubContent.makeTest(overrides));
}

const unstubbed = (member: string): never => {
	throw new Error(`GitHubContent.makeTest: ${member}() was called but not stubbed — pass an override.`);
};

const make = (client: GitHubClient["Service"]): GitHubContentShape => {
	const getFile = Effect.fn("GitHubContent.getFile")(function* (
		path: string,
		options?: { readonly ref?: string | undefined },
	) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, path, ref: options?.ref ?? "" });
		const content = yield* client.request("GET /repos/{owner}/{repo}/contents/{path}", {
			owner,
			repo,
			path,
			...(options?.ref !== undefined ? { ref: options.ref } : {}),
		});
		// A directory comes back as an array. Reading one as a file would be a
		// silent type confusion.
		if (Array.isArray(content)) {
			return yield*GitHubError.rejected("GitHubContent.getFile", 422, `${path} is a directory`);
		}
		if (content.type !== "file") {
			return yield*
				GitHubError.rejected("GitHubContent.getFile", 422, `${path} is a ${content.type}, not a file`);
		}
		// Over about a megabyte GitHub answers with `encoding: "none"` and an empty
		// body. Decoding that as base64 yields an empty string that looks exactly
		// like a legitimately empty file, so it is refused instead.
		if (content.encoding !== "base64") {
			return yield*
				GitHubError.rejected(
					"GitHubContent.getFile",
					422,
					`${path} came back with encoding ${(yield* S.encodeEffect(JsonValue)(content.encoding).pipe(Effect.orDie))} — it is probably too large for the contents API`,
				);
		}
		return Buffer.from(content.content.replace(/\s/g, ""), "base64").toString("utf8");
	});

	return {
		getFile,
		getFileOption: Effect.fn("GitHubContent.getFileOption")(function* (
			path: string,
			options?: { readonly ref?: string | undefined },
		) {
			return yield* getFile(path, options).pipe(
				Effect.asSome,
				Effect.catchIf(GitHubError.hasKind("notFound"), () => Effect.succeed(O.none<string>())),
			);
		}),
	};
};
