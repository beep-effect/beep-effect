// Reading the runner's *results backend* coordinates — the two variables the
// cache, artifact and blob-store protocols all speak through.
//
// Shared by `ActionCache`, `Artifact` and `BlobStore.githubCache`, and
// deliberately free of `@azure/storage-blob`: an internal helper is exactly how
// a heavy import leaks into a light module's graph, so the one piece those
// three modules share is the piece with no dependencies.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Function from "effect/Function";
import type { ActionEnvironmentShape } from "../ActionEnvironment.ts";
import { payloadOf } from "./jwt.ts";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/github-actions/internal/actionsResults");

/**
 * The run/job identifiers the artifact protocol scopes every call to.
 *
 * **Example** (Validate BackendIds input)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import * as Console from "effect/Console";
 * import * as Effect from "effect/Effect";
 * import { BackendIds } from "@beep/scratchpad/effected/github-actions/internal/actionsResults";
 *
 * const input = { workflowRunBackendId: "run-1", workflowJobRunBackendId: "job-1" };
 * Effect.runSync(Console.log(S.is(BackendIds)(input))) // true
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const BackendIds = S.Struct({
	workflowRunBackendId: S.String.annotateKey({ description: "The workflow run's backend identifier." }),
	workflowJobRunBackendId: S.String.annotateKey({ description: "The workflow job run's backend identifier." }),
}).annotate($I.annote("BackendIds", { description: "The run and job identifiers used by the artifact protocol." }));

/**
 * The plain-object identifiers accepted by {@link BackendIds}.
 * @category type-level
 * @since 0.0.0
 */
export type BackendIds = typeof BackendIds.Type;

/**
 * Where the results backend is and how to talk to it.
 *
 * **Example** (Validate ResultsBackend input)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import * as Console from "effect/Console";
 * import * as Effect from "effect/Effect";
 * import * as Redacted from "effect/Redacted";
 * import * as Result from "effect/Result";
 * import { ResultsBackend } from "@beep/scratchpad/effected/github-actions/internal/actionsResults";
 *
 * const input = { baseUrl: "https://results.example/", token: Redacted.make("example token"), backendIds: Result.succeed({ workflowRunBackendId: "run-1", workflowJobRunBackendId: "job-1" }) };
 * Effect.runSync(Console.log(S.is(ResultsBackend)(input))) // true
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const ResultsBackend = S.Struct({
	/** Always ends in `/`, so a caller composes paths by concatenation. */
	baseUrl: S.String.annotateKey({ description: "The results backend URL, normalized by resultsBackend to end in a slash." }),
	/**
  * The runtime token.
  *
  * **Details**
  *
  * Wrapped on the way *in*, not unwrapped on the way out: it arrives from the
  * environment as plaintext, and `HttpClientRequest.bearerToken` accepts a
  * `Redacted` directly, so this package's declassification seam is never
  * involved and `Redacted.value` is never called.
  */
	token: S.Redacted(S.String).annotateKey({ description: "The runner's runtime token, preserved as a redacted value." }),
	/**
  * The backend ids, or why they could not be read.
  *
  * **Details**
  *
  * A `Result` rather than a failure, because only the artifact protocol needs
  * them: a runtime token with no `Actions.Results` scope must not stop a cache
  * save that never looks at one.
  */
	backendIds: S.Result(BackendIds, S.String).annotateKey({ description: "Artifact backend identifiers, or why they could not be read." }),
}).annotate($I.annote("ResultsBackend", { description: "Plain-object results backend coordinates and artifact scope resolution." }));

/**
 * The plain-object coordinates accepted by {@link ResultsBackend}.
 * @category type-level
 * @since 0.0.0
 */
export type ResultsBackend = typeof ResultsBackend.Type;

/**
 * The variable naming the backend. Absent outside a `uses:` step.
 *
 * **Example** (Read the results_url variable name)
 *
 * ```ts
 * import { RESULTS_URL } from "@beep/scratchpad/effected/github-actions/internal/actionsResults";
 *
 * console.log(RESULTS_URL) // ACTIONS_RESULTS_URL
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RESULTS_URL = "ACTIONS_RESULTS_URL";

/**
 * The variable holding the run-scoped credential. Absent outside a `uses:` step.
 *
 * **Example** (Read the runtime_token variable name)
 *
 * ```ts
 * import { RUNTIME_TOKEN } from "@beep/scratchpad/effected/github-actions/internal/actionsResults";
 *
 * console.log(RUNTIME_TOKEN) // ACTIONS_RUNTIME_TOKEN
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RUNTIME_TOKEN = "ACTIONS_RUNTIME_TOKEN";

/**
 * The `misconfigured` detail every results-backend consumer reports when
 * {@link resultsBackend} fails: names the missing variable, and says why it is
 * missing — the single most common misuse of these services.
 * **Example** (Explain a missing results URL)
 *
 * ```ts
 * import { misconfiguredDetail, RESULTS_URL } from "@beep/scratchpad/effected/github-actions/internal/actionsResults";
 *
 * console.log(misconfiguredDetail(RESULTS_URL, "cache")) // ACTIONS_RESULTS_URL is not set — the cache is only reachable from a `uses:` step, never from `run:`
 * ```
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const misconfiguredDetail: {
	(variable: string, service: string): string;
	(service: string): (variable: string) => string;
} = Function.dual(2, (variable: string, service: string): string =>
	`${variable} is not set — the ${service} is only reachable from a \`uses:\` step, never from \`run:\``);

/**
 * The run and job ids the artifact protocol needs, from the runtime token's
 * `scp` claim.
 *
 * **Details**
 *
 * The scope is space-separated and the interesting entry is
 * `Actions.Results:<run>:<job>`. Exported so its own failures are tested
 * directly rather than through four RPC round trips.
 *
 * **Example** (Read artifact backend scope)
 *
 * ```ts
 * import { backendIdsFrom } from "@beep/scratchpad/effected/github-actions/internal/actionsResults";
 * import * as Base64Url from "effect/encoding/Base64Url";
 * import * as Result from "effect/Result";
 *
 * const claims = Base64Url.encode(JSON.stringify({ scp: "Actions.Results:run1:job1" }));
 * const token = ["e30", claims, "signature"].join(".");
 * console.log(Result.isSuccess(backendIdsFrom(token))) // true
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const backendIdsFrom = (token: string): Result.Result<BackendIds, string> => {
	// No signature verification (`internal/jwt.ts` says why): the claim read
	// here scopes a request rather than authorizing one.
	const payload = payloadOf(token);
	if (Result.isFailure(payload)) {
		return Result.fail(`the runtime token is not a readable JWT: ${payload.failure.detail}`);
	}
	const claims = payload.success;
	const scope = P.isObjectOrArray(claims) && "scp" in claims ? claims.scp : undefined;
	if (!P.isString(scope)) {
		return Result.fail("the runtime token carries no `scp` claim");
	}
	for (const entry of scope.split(" ")) {
		const parts = entry.split(":");
		if (parts[0] !== "Actions.Results") {
			continue;
		}
		const run = parts[1];
		const job = parts[2];
		if (parts.length > 3 || run === undefined || run === "" || job === undefined || job === "") {
			return Result.fail(`the runtime token's Actions.Results scope is malformed: "${entry}"`);
		}
		return Result.succeed({ workflowRunBackendId: run, workflowJobRunBackendId: job });
	}
	return Result.fail("the runtime token carries no `Actions.Results` scope");
};

/**
 * Read the results-backend coordinates from the runner environment.
 *
 * **Details**
 *
 * Fails with the *name* of whichever variable is missing. Both are injected
 * only into `uses:` steps, so their absence is the single most common way one
 * of these three services is misused — a caller that reads the name can say so.
 *
 * Takes the environment **shape**, not the service: the layer resolves
 * `ActionEnvironment` once at construction and every member's `R` stays
 * `never`, which is the same fix `ActionEnvironment.payload` got. The variables
 * themselves are read per call, because resolving them at construction would
 * make merely *composing* the layer fail outside Actions — including for an
 * action that never touches the cache.
 *
 * **Example** (Compose a results backend lookup)
 *
 * ```ts
 * import { resultsBackend } from "@beep/scratchpad/effected/github-actions/internal/actionsResults";
 * import { ActionEnvironment } from "@beep/scratchpad/effected/github-actions/ActionEnvironment";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const env = yield* ActionEnvironment;
 *   return yield* resultsBackend(env);
 * });
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const resultsBackend = Effect.fn("resultsBackend")(function* (env: ActionEnvironmentShape) {
		const url = yield* env.getOptional(RESULTS_URL);
		const token = yield* env.getOptional(RUNTIME_TOKEN);
		if (O.isNone(url)) {
			return yield* Effect.fail(RESULTS_URL);
		}
		if (O.isNone(token)) {
			return yield* Effect.fail(RUNTIME_TOKEN);
		}
		return {
			baseUrl: url.value.endsWith("/") ? url.value : `${url.value}/`,
			token: Redacted.make(token.value),
			backendIds: backendIdsFrom(token.value),
		};
	});
