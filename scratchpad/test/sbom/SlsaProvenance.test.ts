// @effect-diagnostics nodeBuiltinImport:skip-file processEnv:skip-file
// SLSA Provenance v1 — typed, total, and byte-compatible with @actions/attest.
//
// The compatibility claim is the reason this file reads a fixture rather than
// asserting field by field: a verifier must see the same `buildDefinition` /
// `runDetails` structure whichever path produced the attestation, and a
// deep-equal against the shape upstream emits fails as loudly on an EXTRA field
// as on a missing one. Field-by-field assertions cannot do that.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";
import { GITHUB_BUILD_TYPE, SLSA_PROVENANCE_V1, SlsaProvenance } from "../../effected/sbom/index.ts";

const FIXTURE: unknown = JSON.parse(
	readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "fixtures", "actions-attest-provenance.json"), "utf8"),
);

/** The claims the vendored fixture was transcribed for. */
const claims = {
	serverUrl: "https://github.com",
	repository: "effected/kit",
	ref: "refs/heads/main",
	sha: "6a13657ec19f43b1d7b95c2f0a1c1e5b8d4f7a20",
	eventName: "push",
	workflowRef: "effected/kit/.github/workflows/release.yml@refs/heads/main",
	// Deliberately DIFFERENT from `workflowRef` — a reusable workflow in another
	// repository, which is the case that distinguishes them. Upstream builds the
	// builder id from `job_workflow_ref` and the workflow path from
	// `workflow_ref`; with the two set equal, a constructor that confuses them
	// passes every assertion. (A survived mutant found exactly that.)
	jobWorkflowRef: "effected/reusable/.github/workflows/publish.yml@refs/tags/v3",
	repositoryId: "123456",
	repositoryOwnerId: "654321",
	runnerEnvironment: "github-hosted",
	runId: "42",
	runAttempt: "1",
} as const;

const asJson = (provenance: SlsaProvenance): unknown => JSON.parse(JSON.stringify(provenance));

describe("SlsaProvenance.forGitHubWorkflow", () => {
	it("emits exactly the shape @actions/attest emits", () => {
		assert.deepStrictEqual(asJson(SlsaProvenance.forGitHubWorkflow(claims)), FIXTURE);
	});

	it("is a plain function — no Effect, no error channel", () => {
		// The predecessor wrapped this body in `Effect.try` behind a
		// `SlsaError { reason: "env" }` arm that nothing could ever fire.
		const provenance = SlsaProvenance.forGitHubWorkflow(claims);
		assert.instanceOf(provenance, SlsaProvenance);
	});

	it("declares the published predicate and build type URIs", () => {
		assert.strictEqual(SlsaProvenance.predicateType, "https://slsa.dev/provenance/v1");
		assert.strictEqual(SLSA_PROVENANCE_V1, "https://slsa.dev/provenance/v1");
		assert.strictEqual(SlsaProvenance.buildType, "https://actions.github.io/buildtypes/workflow/v1");
		assert.strictEqual(GITHUB_BUILD_TYPE, "https://actions.github.io/buildtypes/workflow/v1");
		assert.strictEqual(SlsaProvenance.forGitHubWorkflow(claims).buildDefinition.buildType, GITHUB_BUILD_TYPE);
	});

	it("strips the repository prefix and the @ref suffix from the workflow path", () => {
		const provenance = SlsaProvenance.forGitHubWorkflow({
			...claims,
			workflowRef: "effected/kit/.github/workflows/nested/build.yml@refs/tags/v1.2.3",
		});
		assert.strictEqual(
			provenance.buildDefinition.externalParameters.workflow.path,
			".github/workflows/nested/build.yml",
		);
	});

	it("takes the serverUrl from its argument, never from the environment", () => {
		// The discriminating test for the no-ambient-env rule: upstream reads
		// `process.env.GITHUB_SERVER_URL` (and writes the literal `undefined` when
		// it is unset). Setting it here must change nothing.
		const before = process.env.GITHUB_SERVER_URL;
		process.env.GITHUB_SERVER_URL = "https://ambient.example";
		try {
			assert.deepStrictEqual(asJson(SlsaProvenance.forGitHubWorkflow(claims)), FIXTURE);
		} finally {
			if (before === undefined) delete process.env.GITHUB_SERVER_URL;
			else process.env.GITHUB_SERVER_URL = before;
		}
	});

	it("threads a GHES server URL through every derived URL", () => {
		const provenance = SlsaProvenance.forGitHubWorkflow({ ...claims, serverUrl: "https://ghe.example.com" });
		assert.strictEqual(
			provenance.buildDefinition.externalParameters.workflow.repository,
			"https://ghe.example.com/effected/kit",
		);
		assert.strictEqual(
			provenance.buildDefinition.resolvedDependencies[0]?.uri,
			"git+https://ghe.example.com/effected/kit@refs/heads/main",
		);
		assert.strictEqual(
			provenance.runDetails.builder.id,
			"https://ghe.example.com/effected/reusable/.github/workflows/publish.yml@refs/tags/v3",
		);
		assert.strictEqual(
			provenance.runDetails.metadata.invocationId,
			"https://ghe.example.com/effected/kit/actions/runs/42/attempts/1",
		);
	});

	it("records the built commit as the resolved dependency's gitCommit digest", () => {
		const provenance = SlsaProvenance.forGitHubWorkflow(claims);
		assert.deepStrictEqual(provenance.buildDefinition.resolvedDependencies[0]?.digest, { gitCommit: claims.sha });
	});

	it("spells the internal parameters in the platform's claim names", () => {
		// `event_name`, not `eventName`: the input record is our vocabulary and the
		// predicate is the specification's, and only one of them is negotiable.
		const github = SlsaProvenance.forGitHubWorkflow(claims).buildDefinition.internalParameters.github;
		assert.deepStrictEqual<unknown>(github, {
			event_name: "push",
			repository_id: "123456",
			repository_owner_id: "654321",
			runner_environment: "github-hosted",
		});
	});
});
