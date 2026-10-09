import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { GitHubClient } from "../../effected/github/GitHubClient.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";
import { RetryPolicy } from "../../effected/github/Resilience.ts";
import type { Reply, ScriptedFetch } from "./fixtures.ts";
import { scriptedFetch } from "./fixtures.ts";

/** The repository every resource test acts on. */
export const REPO = RepoRef.make({ owner: "acme", repo: "widget" });

export interface Harness {
	/** What the scripted transport recorded. */
	readonly script: ScriptedFetch;
	/** A live client over that transport, plus the repository coordinate. */
	readonly base: Layer.Layer<GitHubClient | Repo>;
}

/**
 * A live client over scripted HTTP, plus a repository.
 *
 * @remarks
 * Resource tests drive the **real** client — real route interpolation, real
 * classification, real pagination — rather than a double of it. A stubbed client
 * would let a resource request the wrong route, send the wrong body or
 * mis-handle a 404 and still pass, which is most of what a resource can get
 * wrong.
 */
export const harness = (replies: ReadonlyArray<Reply>): Harness => {
	const script = scriptedFetch(replies);
	const base = Layer.mergeAll(
		GitHubClient.layerFromToken({
			token: Redacted.make("ghs_test"),
			fetch: script.fetch,
			retry: RetryPolicy.none,
		}),
		Repo.layer(REPO),
	);
	return { script, base };
};
