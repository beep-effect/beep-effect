// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { SlsaProvenance } from "../../effected/sbom/index.ts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { ActionEnvironment, ActionsProvenance, OidcClaims, OidcTokenError, OidcTokenIssuer } from "../../effected/github-actions/index.ts";

// Every value distinct, and `workflow_ref` ≠ `job_workflow_ref` (a reusable
// workflow in another repository) — sbom's own fixture keeps them different
// because upstream builds the builder id from one and the workflow path from
// the other, and a constructor that confuses them passes everything when they
// are equal. A survived mutant found exactly that; do not collapse them here
// either.
const CLAIMS = OidcClaims.make({
	iss: "https://token.actions.githubusercontent.com",
	ref: "refs/heads/release",
	sha: "d34db33fd34db33fd34db33fd34db33fd34db33f",
	repository: "acme/widgets",
	event_name: "workflow_dispatch",
	job_workflow_ref: "acme/reusable/.github/workflows/publish.yml@refs/tags/v2",
	workflow_ref: "acme/widgets/.github/workflows/release.yml@refs/heads/release",
	repository_id: "1111",
	repository_owner_id: "2222",
	runner_environment: "github-hosted",
	run_id: "777",
	run_attempt: "3",
});

const provided = <A, E>(
	program: Effect.Effect<A, E, OidcTokenIssuer | ActionEnvironment>,
	issuer: Layer.Layer<OidcTokenIssuer>,
	env: Layer.Layer<ActionEnvironment> = ActionEnvironment.layerTest(),
) => program.pipe(Effect.provide(Layer.mergeAll(issuer, env)));

/** An environment with NOTHING seeded — `GITHUB_SERVER_URL` genuinely absent — over an empty volume. */
const emptyEnvironment = ActionEnvironment.layerFrom({}).pipe(Layer.provide(MemoryFileSystem.layer));

describe("ActionsProvenance", () => {
	it.effect("maps every claim the predicate consumes, through a real decodable token double", () =>
		provided(
			Effect.gen(function* () {
				const provenance = yield* ActionsProvenance.capture("sigstore");
				// The oracle is sbom's own constructor over the CORRECTLY spelled
				// record, so this deep-equal pins exactly the snake_case→camelCase
				// rename the module exists to own — every field, not a sample.
				assert.deepStrictEqual(
					provenance,
					SlsaProvenance.forGitHubWorkflow({
						serverUrl: "https://github.com",
						repository: "acme/widgets",
						ref: "refs/heads/release",
						sha: "d34db33fd34db33fd34db33fd34db33fd34db33f",
						eventName: "workflow_dispatch",
						workflowRef: "acme/widgets/.github/workflows/release.yml@refs/heads/release",
						jobWorkflowRef: "acme/reusable/.github/workflows/publish.yml@refs/tags/v2",
						repositoryId: "1111",
						repositoryOwnerId: "2222",
						runnerEnvironment: "github-hosted",
						runId: "777",
						runAttempt: "3",
					}),
				);
			}),
			OidcTokenIssuer.layerFor(CLAIMS),
		),
	);

	it.effect("keeps repository_id and repository_owner_id on their own sides of the predicate", () =>
		provided(
			Effect.gen(function* () {
				// The transposition hazard the ask names: both fields are strings, so
				// swapping them compiles clean and signs a WRONG attestation. Asserted
				// individually, against distinct values, on the emitted document.
				const provenance = yield* ActionsProvenance.capture();
				assert.strictEqual(provenance.buildDefinition.internalParameters.github.repository_id, "1111");
				assert.strictEqual(provenance.buildDefinition.internalParameters.github.repository_owner_id, "2222");
			}),
			OidcTokenIssuer.layerFor(CLAIMS),
		),
	);

	it.effect("defaults the server URL to https://github.com when the environment does not set it", () =>
		provided(
			Effect.gen(function* () {
				// `layerFrom({})` seeds nothing at all — the seeded test default
				// happens to EQUAL the fallback, so using `layerTest()` here would
				// pass even if the default never applied.
				const provenance = yield* ActionsProvenance.capture();
				assert.strictEqual(
					provenance.buildDefinition.externalParameters.workflow.repository,
					"https://github.com/acme/widgets",
				);
				assert.strictEqual(
					provenance.runDetails.builder.id,
					"https://github.com/acme/reusable/.github/workflows/publish.yml@refs/tags/v2",
				);
			}),
			OidcTokenIssuer.layerFor(CLAIMS),
			emptyEnvironment,
		),
	);

	it.effect("a GHES server URL moves every URL the predicate builds", () =>
		provided(
			Effect.gen(function* () {
				const provenance = yield* ActionsProvenance.capture();
				const ghes = "https://github.example.com";
				assert.strictEqual(provenance.buildDefinition.externalParameters.workflow.repository, `${ghes}/acme/widgets`);
				assert.strictEqual(
					provenance.buildDefinition.resolvedDependencies[0]?.uri,
					`git+${ghes}/acme/widgets@refs/heads/release`,
				);
				assert.strictEqual(
					provenance.runDetails.builder.id,
					`${ghes}/acme/reusable/.github/workflows/publish.yml@refs/tags/v2`,
				);
				assert.strictEqual(
					provenance.runDetails.metadata.invocationId,
					`${ghes}/acme/widgets/actions/runs/777/attempts/3`,
				);
			}),
			OidcTokenIssuer.layerFor(CLAIMS),
			ActionEnvironment.layerTest({ GITHUB_SERVER_URL: "https://github.example.com" }),
		),
	);

	it.effect("an issuer failure passes through untouched — the error policy stays the consumer's", () =>
		Effect.gen(function* () {
			const failure = OidcTokenError.make({ reason: "unavailable", detail: "ACTIONS_ID_TOKEN_REQUEST_URL" });
			const error = yield* provided(
				Effect.flip(ActionsProvenance.capture("sigstore")),
				OidcTokenIssuer.layerTest({ claims: () => Effect.fail(failure) }),
			);
			// Identity, not just shape: the SAME error object, proving the adapter
			// neither caught, rewrapped nor defaulted it. Whether attestation is
			// mandatory or best-effort is decided downstream, at the consumer.
			assert.strictEqual(error, failure);
		}),
	);

	it.effect("forwards the audience to the issuer verbatim, including its absence", () =>
		Effect.gen(function* () {
			const audiences: Array<string | undefined> = [];
			const issuer = OidcTokenIssuer.layerTest({
				claims: (audience) =>
					Effect.suspend(() => {
						audiences.push(audience);
						return Effect.succeed(CLAIMS);
					}),
			});
			yield* provided(ActionsProvenance.capture("sigstore"), issuer);
			yield* provided(ActionsProvenance.capture(), issuer);
			// No defaulting in either direction: a caller's audience arrives as
			// given, and omitting it sends none rather than inventing one.
			assert.deepStrictEqual(audiences, ["sigstore", undefined]);
		}),
	);
});
