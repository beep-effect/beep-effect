import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import { GitHubClient } from "./GitHubClient.ts";
import { GitHubError } from "./GitHubError.ts";
import { Repo } from "./Repo.ts";
import * as A from "effect/Array";

const $I = $ScratchpadId.create("effected/github/GitHubContent");

class UnstubbedError extends S.TaggedError<UnstubbedError>($I`UnstubbedError`)("UnstubbedError", {
	message: S.String,
}, $I.annote("UnstubbedError", { description: "An unconfigured test-double member was called." })) {}

const JsonValue = S.fromJsonString(S.String);

/**
 * Read a text file out of a repository at a ref.
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export interface GitHubContentShape {
	/**
  * A text file's contents at `ref`, or the default branch when `ref` is
  * omitted.
  *
  * **Gotchas**
  *
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
 * **Details**
 *
 * Provide it with {@link GitHubContent.layer}, which needs a `GitHubClient`;
 * each method also needs a `Repo` in `R`.
 *
 * **Example** (Read a README with an empty fallback)
 *
 * ```ts
 * import { GitHubContent } from "@beep/scratchpad/effected/github/GitHubContent";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 *
 * const readme = Effect.gen(function* () {
 *   const content = yield* GitHubContent;
 *   const file = yield* content.getFileOption("README.md", { ref: "main" });
 *   return O.getOrElse(file, () => "");
 * });
 * console.log(Effect.isEffect(readme)); // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class GitHubContent extends Context.Service<GitHubContent, GitHubContentShape>()(
	$I`GitHubContent`,
) {
	/**
 * The live service, built over a `GitHubClient`.
 *

 * **Example** (Construct a file read with the live layer)
 *
 * ```ts
 * import { GitHubContent } from "@beep/scratchpad/effected/github/GitHubContent";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.flatMap(GitHubContent, (content) => content.getFile("README.md")).pipe(
 *   Effect.provide(GitHubContent.layer),
 * );
 * console.log(Effect.isEffect(program)); // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
	static readonly layer: Layer.Layer<GitHubContent, never, GitHubClient> = Layer.effect(
		this,
		Effect.map(GitHubClient, (client) => make(client)),
	);

	/**
 * An in-memory double; unstubbed members die naming themselves.
 *

 * **Example** (Override a repository file read)
 *
 * ```ts
 * import { GitHubContent } from "@beep/scratchpad/effected/github/GitHubContent";
 * import * as Effect from "effect/Effect";
 *
 * const content = GitHubContent.makeTest({ getFile: () => Effect.succeed("# Project") });
 * console.log(Effect.isEffect(content.getFile("README.md"))); // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
	static readonly makeTest = (overrides: Partial<GitHubContentShape> = {}): GitHubContentShape => ({
		getFile: overrides.getFile ?? (() => unstubbed("getFile")),
		getFileOption: overrides.getFileOption ?? (() => unstubbed("getFileOption")),
	});

	/**
 * {@link GitHubContent.makeTest} behind a `Layer`.
 *

 * **Example** (Provide a content test layer)
 *
 * ```ts
 * import { GitHubContent } from "@beep/scratchpad/effected/github/GitHubContent";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.map(GitHubContent, () => "ready").pipe(
 *   Effect.provide(GitHubContent.layerTest()),
 * );
 * console.log(Effect.runSync(program)); // ready
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
	static readonly layerTest = (overrides: Partial<GitHubContentShape> = {}): Layer.Layer<GitHubContent> =>
		Layer.succeed(GitHubContent, GitHubContent.makeTest(overrides));
}

const unstubbed = (member: string): never => {
	throw UnstubbedError.make({ message: `GitHubContent.makeTest: ${member}() was called but not stubbed — pass an override.` });
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
			...O.getSomesStruct({ ref: O.fromUndefinedOr(options?.ref) }),
		});
		// A directory comes back as an array. Reading one as a file would be a
		// silent type confusion.
		if (A.isArray(content)) {
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
