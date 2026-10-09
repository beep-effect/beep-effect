import { Context, Effect, Layer } from "effect";
import { GitHubClient } from "./GitHubClient.ts";
import type { GitHubError } from "./GitHubError.ts";
import { Repo } from "./Repo.ts";
import type * as Rest from "./Rest.ts";

/**
 * A CodeQL default-setup configuration.
 *
 * @remarks
 * Every field is optional and an **omitted field means "leave it alone"**, which
 * is why this is a partial rather than a full configuration: sending
 * `undefined` for a key the caller never mentioned would clear a setting they
 * did not ask to change.
 *
 * @public
 */
export interface CodeScanningSetup {
	/** Whether default setup is `configured` or `not-configured`. */
	readonly state?: "configured" | "not-configured" | undefined;
	/** The CodeQL languages to analyse. */
	readonly languages?: ReadonlyArray<string> | undefined;
	/** `default` or `extended`. */
	readonly query_suite?: string | undefined;
	/** `remote` or `remote_and_local`. */
	readonly threat_model?: string | undefined;
	/** `standard` or `labeled`. */
	readonly runner_type?: string | undefined;
	/** The runner label, when `runner_type` is `labeled`. */
	readonly runner_label?: string | undefined;
}

/**
 * CodeQL default setup, and the language detection that gates it.
 *
 * @public
 */
export interface CodeScanningShape {
	/**
	 * Apply a default-setup configuration.
	 *
	 * @remarks
	 * The endpoint answers **202 Accepted** and configures asynchronously.
	 * Nothing here polls: a successful call means GitHub accepted the request,
	 * not that scanning is running.
	 *
	 * **Turning it back off does not undo everything it did.** Setting `state`
	 * to `not-configured` stops default setup, but the synthetic CodeQL workflow
	 * GitHub created when it was enabled **survives** — it remains listed among
	 * the repository's workflows afterwards. A caller that treats "default setup
	 * is off" as "no CodeQL workflow exists" will be wrong, and one that counts
	 * workflows to decide whether a repository has any CI will count that one.
	 * Observed against a real organization, not inferred from the API
	 * description.
	 */
	readonly configure: (setup: CodeScanningSetup) => Effect.Effect<void, GitHubError, Repo>;
	/**
	 * The languages GitHub detects in the repository.
	 *
	 * @remarks
	 * The response maps language name to bytes; only the names are returned, in
	 * GitHub's own order (most bytes first). Use it to filter a configured
	 * language list down to what the repository actually contains — GitHub
	 * rejects a default-setup call naming a language it does not detect.
	 */
	readonly languages: Effect.Effect<ReadonlyArray<string>, GitHubError, Repo>;
}

/**
 * Configure CodeQL default setup and read the languages GitHub detects in a
 * repository.
 *
 * @remarks
 * Provide it with {@link CodeScanning.layer}, which needs a `GitHubClient`; each
 * method also needs a `Repo` in `R`.
 *
 * @public
 */
export class CodeScanning extends Context.Service<CodeScanning, CodeScanningShape>()("@beep/scratchpad/effected/github/CodeScanning") {
	/**
	 * The live service, built over a `GitHubClient`.
	 *
	 * @remarks
	 * The callback is written `(client) => make(client)` rather than passed as
	 * `make` directly, and that is load-bearing: a static initializer runs while
	 * the module body is still evaluating, so naming a `const` declared further
	 * down throws `Cannot access 'make' before initialization` **at import time**,
	 * with a clean typecheck.
	 */
	static readonly layer: Layer.Layer<CodeScanning, never, GitHubClient> = Layer.effect(
		this,
		Effect.map(GitHubClient, (client) => make(client)),
	);

	/** An in-memory double; unstubbed members die naming themselves. */
	static readonly makeTest = (overrides: Partial<CodeScanningShape> = {}): CodeScanningShape => ({
		configure: overrides.configure ?? (() => unstubbed("configure")),
		languages: overrides.languages ?? (Effect.suspend(() => unstubbed("languages"))),
	});

	/** {@link CodeScanning.makeTest} behind a `Layer`. */
	static readonly layerTest = (overrides: Partial<CodeScanningShape> = {}): Layer.Layer<CodeScanning> =>
		Layer.succeed(CodeScanning, CodeScanning.makeTest(overrides));
}

const unstubbed = (member: string): never => {
	throw new Error(`CodeScanning.makeTest: ${member}() was called but not stubbed — pass an override.`);
};

const SETUP_KEYS = [
	"state",
	"languages",
	"query_suite",
	"threat_model",
	"runner_type",
	"runner_label",
] as const satisfies ReadonlyArray<keyof CodeScanningSetup>;

// `satisfies` proves every listed key belongs to the type; it does NOT prove
// the reverse, so a new optional field on `CodeScanningSetup` would be dropped
// from the body silently. This fails to compile until the key is listed.
type UnlistedSetupKey = Exclude<keyof CodeScanningSetup, (typeof SETUP_KEYS)[number]>;
const _everySetupKeyIsListed: UnlistedSetupKey extends never ? true : never = true;
void _everySetupKeyIsListed;

/**
 * Every method resolves {@link Repo} per call rather than once at layer
 * construction, for the reason `GitBranch` states: capturing the coordinate
 * would make a scoped `Repo.provide` silently do nothing.
 */
const make = (client: GitHubClient["Service"]): CodeScanningShape => {
	const configure = Effect.fn("CodeScanning.configure")(function* (setup: CodeScanningSetup) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo });

		// Only the keys the caller set are sent. Copying the whole object would
		// send `undefined` for every key they omitted, which clears settings
		// rather than leaving them alone.
		const body: Record<string, unknown> = {};
		for (const key of SETUP_KEYS) {
			const value = setup[key];
			if (value !== undefined) body[key] = key === "languages" ? [...(value as ReadonlyArray<string>)] : value;
		}

		yield* client.request("PATCH /repos/{owner}/{repo}/code-scanning/default-setup", {
			owner,
			repo,
			// Assembled key-by-key above, so it cannot be narrowed to the route's
			// parameter union at compile time. The cast is on the BODY, never the
			// route literal.
			...body,
		} as Rest.Params<"PATCH /repos/{owner}/{repo}/code-scanning/default-setup">);
	});

	const languages = Effect.suspend(Effect.fn("CodeScanning.languages")(function* () {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo });

		const detected = yield* client.request("GET /repos/{owner}/{repo}/languages", { owner, repo });
		return Object.keys(detected);
	}));

	return { configure, languages };
};
