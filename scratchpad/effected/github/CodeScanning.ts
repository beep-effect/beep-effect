import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { GitHubClient } from "./GitHubClient.ts";
import type { GitHubError } from "./GitHubError.ts";
import { Repo } from "./Repo.ts";
import * as R from "effect/Record";

const $I = $ScratchpadId.create("effected/github/CodeScanning");

class UnstubbedError extends S.TaggedError<UnstubbedError>($I`UnstubbedError`)("UnstubbedError", {
	message: S.String,
}, $I.annote("UnstubbedError", { description: "An unconfigured test-double member was called." })) {}

/**
 * A CodeQL default-setup configuration.
 *
 * **Gotchas**
 *
 * Every field is optional and an **omitted field means "leave it alone"**, which
 * is why this is a partial rather than a full configuration: sending
 * `undefined` for a key the caller never mentioned would clear a setting they
 * did not ask to change.
 *
 * @public
 */
export const CodeScanningSetup = S.Struct({
	/** Whether default setup is `configured` or `not-configured`. */
	state: S.optional(S.Literals(["configured", "not-configured"])).annotateKey({ description: "Whether default setup is configured or not-configured." }),
	/** The CodeQL languages to analyse. */
	languages: S.String.pipe(S.Array, S.optional).annotateKey({ description: "The CodeQL languages to analyse." }),
	/** `default` or `extended`. */
	query_suite: S.optional(S.String).annotateKey({ description: "The query suite; accepts GitHub's evolving string vocabulary." }),
	/** `remote` or `remote_and_local`. */
	threat_model: S.optional(S.String).annotateKey({ description: "The threat model; accepts GitHub's evolving string vocabulary." }),
	/** `standard` or `labeled`. */
	runner_type: S.optional(S.String).annotateKey({ description: "The runner type; accepts GitHub's evolving string vocabulary." }),
	/** The runner label, when `runner_type` is `labeled`. */
	runner_label: S.optional(S.String).annotateKey({ description: "The runner label, when runner_type is labeled." }),
}).annotate($I.annote("CodeScanningSetup", { description: "A partial CodeQL default-setup configuration preserving omitted fields." }));

/** The structural configuration owned by {@link CodeScanningSetup}. */
export type CodeScanningSetup = typeof CodeScanningSetup.Type;

/**
 * CodeQL default setup, and the language detection that gates it.
 *
 * @public
 */
export interface CodeScanningShape {
	/**
  * Apply a default-setup configuration.
  *
  * **Gotchas**
  *
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
  * **Details**
  *
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
 * **Details**
 *
 * Provide it with {@link CodeScanning.layer}, which needs a `GitHubClient`; each
 * method also needs a `Repo` in `R`.
 *
 * @public
 */
export class CodeScanning extends Context.Service<CodeScanning, CodeScanningShape>()($I`CodeScanning`) {
	/**
  * The live service, built over a `GitHubClient`.
  *
  * **Gotchas**
  *
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
	throw UnstubbedError.make({ message: `CodeScanning.makeTest: ${member}() was called but not stubbed — pass an override.` });
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
			if (key === "languages") {
				const languages = setup.languages;
				if (languages !== undefined) body[key] = [...languages];
			} else {
				const value = setup[key];
				if (value !== undefined) body[key] = value;
			}
		}

		yield* client.request("PATCH /repos/{owner}/{repo}/code-scanning/default-setup", {
			owner,
			repo,
			...body,
		});
	});

	const languages = Effect.suspend(Effect.fn("CodeScanning.languages")(function* () {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo });

		const detected = yield* client.request("GET /repos/{owner}/{repo}/languages", { owner, repo });
		return R.keys(detected);
	}));

	return { configure, languages };
};
