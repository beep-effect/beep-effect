import { SlsaProvenance } from "../sbom/index.ts";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { ActionEnvironment } from "./ActionEnvironment.ts";
import type { OidcTokenError } from "./OidcTokenIssuer.ts";
import { OidcTokenIssuer } from "./OidcTokenIssuer.ts";

/**
 * The server URL a workflow on github.com runs against.
 *
 * @remarks
 * GHES runners export `GITHUB_SERVER_URL`; github.com runners do too, but a
 * program running outside a runner — or under a partial test environment —
 * legitimately sees it absent, and absence has a **correct answer** rather
 * than being an error. See {@link ActionsProvenance.capture}.
 */
const DEFAULT_SERVER_URL = "https://github.com";

/**
 * Builds the current run's SLSA provenance from the runner's OIDC claims: the
 * Actions side of `@effected/sbom`'s `SlsaProvenance.forGitHubWorkflow`.
 *
 * @remarks
 * `SlsaProvenance.forGitHubWorkflow` is total and does the real work, but it
 * takes a camelCase input record — and the only input anyone inside a workflow
 * actually holds is the runner's own OIDC claims, spelled in GitHub's
 * snake_case claim names. The rename between the two is eleven all-string
 * fields, so transposing `repository_id` and `repository_owner_id` compiles,
 * passes every type check, and produces a validly signed attestation asserting
 * the **wrong** provenance. This module owns that rename once, on the same
 * `github-actions` ↔ `sbom` seam as {@link ActionsIdentityToken}: `sbom` must
 * not depend on the Actions runtime, so the adapter lives here, beside the
 * services it reads.
 *
 * The construct ends at the predicate. Assembling the in-toto statement,
 * signing it and uploading the bundle stay with the consumer — that pipeline
 * is deliberately consumer glue (see `@effected/sbom`'s `SigstoreSigner` and
 * `@effected/github`'s `Attestation.upload`).
 *
 * @example
 * ```ts
 * import { ActionsProvenance } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const provenance = yield* ActionsProvenance.capture();
 *   return provenance.runDetails.builder.id;
 * });
 * ```
 *
 * @public
 */
export class ActionsProvenance {
	private constructor() {}

	/**
	 * The current run's SLSA provenance, built from the runner's OIDC claims.
	 *
	 * @remarks
	 * Every field `GitHubWorkflowProvenance` declares is populated from
	 * {@link OidcClaims}, except `serverUrl`, which is read from
	 * `GITHUB_SERVER_URL` through {@link ActionEnvironment}'s `getOptional`
	 * with `https://github.com` as the default — **not** through the
	 * `GitHubContext` projection. The projection fails typed when a `GITHUB_*`
	 * variable is missing, and a missing server URL is not a failure: it has a
	 * correct default. GHES consumers set the variable, github.com consumers
	 * never should have to, and neither should think about it. (Upstream
	 * `@actions/attest` reads the same variable with no default and writes the
	 * literal string `undefined` into every URL it builds — the hazard
	 * `GitHubWorkflowProvenance.serverUrl` being a required field exists to
	 * prevent.)
	 *
	 * The audience is forwarded to {@link OidcTokenIssuerShape.claims}
	 * verbatim; the claims a provenance reads do not depend on it, so omitting
	 * it is fine and spends no extra token mint.
	 *
	 * An {@link OidcTokenError} passes through **untouched** — not caught, not
	 * defaulted, not wrapped. Whether attestation is mandatory or best-effort
	 * is the consumer's policy: an action that must not publish unattested
	 * lets the error propagate, and one that publishes anyway catches it at
	 * its own boundary. `reason: "unavailable"` almost always means the
	 * workflow is missing `permissions: id-token: write`.
	 */
	static readonly capture: (
		audience?: string,
	) => Effect.Effect<SlsaProvenance, OidcTokenError, OidcTokenIssuer | ActionEnvironment> = Effect.fn(
		"ActionsProvenance.capture",
	)(function* (audience?: string) {
		const issuer = yield* OidcTokenIssuer;
		const env = yield* ActionEnvironment;
		const claims = yield* issuer.claims(audience);
		const serverUrl = O.getOrElse(yield* env.getOptional("GITHUB_SERVER_URL"), () => DEFAULT_SERVER_URL);
		return SlsaProvenance.forGitHubWorkflow({
			serverUrl,
			repository: claims.repository,
			ref: claims.ref,
			sha: claims.sha,
			eventName: claims.event_name,
			workflowRef: claims.workflow_ref,
			jobWorkflowRef: claims.job_workflow_ref,
			repositoryId: claims.repository_id,
			repositoryOwnerId: claims.repository_owner_id,
			runnerEnvironment: claims.runner_environment,
			runId: claims.run_id,
			runAttempt: claims.run_attempt,
		});
	});
}
