import { GITHUB_BUILD_TYPE, SLSA_PROVENANCE_V1, SlsaProvenance } from "@beep/sbom";
import { assert, describe, it, vi } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { identity } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import FIXTURE from "./fixtures/actions-attest-provenance.json" with { type: "json" };

const UnknownJson = S.fromJsonString(S.Unknown);

const fixtureClaims = {
  serverUrl: "https://github.com",
  repository: "effected/kit",
  ref: "refs/heads/main",
  sha: "6a13657ec19f43b1d7b95c2f0a1c1e5b8d4f7a20",
  eventName: "push",
  workflowRef: "effected/kit/.github/workflows/release.yml@refs/heads/main",
  jobWorkflowRef: "effected/reusable/.github/workflows/publish.yml@refs/tags/v3",
  repositoryId: "123456",
  repositoryOwnerId: "654321",
  runnerEnvironment: "github-hosted",
  runId: "42",
  runAttempt: "1",
} as const;

const asJson = (provenance: SlsaProvenance): unknown =>
  Result.getOrThrowWith(
    S.decodeResult(UnknownJson)(Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(provenance), identity)),
    identity
  );

describe("SlsaProvenance.forGitHubWorkflow", () => {
  it("emits exactly the shape @actions/attest emits", () => {
    assert.deepStrictEqual(
      asJson(SlsaProvenance.forGitHubWorkflow(fixtureClaims)),
      FIXTURE,
      "a deep-equal against the @actions/attest shape fails on an extra field as loudly as on a missing one"
    );
  });

  it("is a plain function — no Effect, no error channel", () => {
    const provenance = SlsaProvenance.forGitHubWorkflow(fixtureClaims);
    assertTrue(S.is(SlsaProvenance)(provenance), "an Opaque record is a member by structure, not by prototype");
  });

  it("declares the published predicate and build type URIs", () => {
    assert.strictEqual(SlsaProvenance.predicateType, "https://slsa.dev/provenance/v1");
    assert.strictEqual(SLSA_PROVENANCE_V1, "https://slsa.dev/provenance/v1");
    assert.strictEqual(SlsaProvenance.buildType, "https://actions.github.io/buildtypes/workflow/v1");
    assert.strictEqual(GITHUB_BUILD_TYPE, "https://actions.github.io/buildtypes/workflow/v1");
    assert.strictEqual(SlsaProvenance.forGitHubWorkflow(fixtureClaims).buildDefinition.buildType, GITHUB_BUILD_TYPE);
  });

  it("strips the repository prefix and the @ref suffix from the workflow path", () => {
    const provenance = SlsaProvenance.forGitHubWorkflow({
      ...fixtureClaims,
      workflowRef: "effected/kit/.github/workflows/nested/build.yml@refs/tags/v1.2.3",
    });
    assert.strictEqual(
      provenance.buildDefinition.externalParameters.workflow.path,
      ".github/workflows/nested/build.yml"
    );
  });

  it("takes the serverUrl from its argument, never from the environment", () => {
    vi.stubEnv("GITHUB_SERVER_URL", "https://ambient.example");
    try {
      assert.deepStrictEqual(
        asJson(SlsaProvenance.forGitHubWorkflow(fixtureClaims)),
        FIXTURE,
        "upstream reads GITHUB_SERVER_URL and writes a literal undefined when unset; here it changes nothing"
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("threads a GHES server URL through every derived URL", () => {
    const provenance = SlsaProvenance.forGitHubWorkflow({ ...fixtureClaims, serverUrl: "https://ghe.example.com" });
    assert.strictEqual(
      provenance.buildDefinition.externalParameters.workflow.repository,
      "https://ghe.example.com/effected/kit"
    );
    assert.strictEqual(
      provenance.buildDefinition.resolvedDependencies[0]?.uri,
      "git+https://ghe.example.com/effected/kit@refs/heads/main"
    );
    assert.strictEqual(
      provenance.runDetails.builder.id,
      "https://ghe.example.com/effected/reusable/.github/workflows/publish.yml@refs/tags/v3",
      "the builder id comes from jobWorkflowRef, a reusable workflow, so confusing it with workflowRef fails"
    );
    assert.strictEqual(
      provenance.runDetails.metadata.invocationId,
      "https://ghe.example.com/effected/kit/actions/runs/42/attempts/1"
    );
  });

  it("records the built commit as the resolved dependency's gitCommit digest", () => {
    const provenance = SlsaProvenance.forGitHubWorkflow(fixtureClaims);
    assert.deepStrictEqual(provenance.buildDefinition.resolvedDependencies[0]?.digest, {
      gitCommit: fixtureClaims.sha,
    });
  });

  it("spells the internal parameters in the platform's claim names", () => {
    const github = SlsaProvenance.forGitHubWorkflow(fixtureClaims).buildDefinition.internalParameters.github;
    assert.deepStrictEqual<unknown>(
      github,
      {
        event_name: "push",
        repository_id: "123456",
        repository_owner_id: "654321",
        runner_environment: "github-hosted",
      },
      "event_name, not eventName: the input record is our vocabulary, the predicate is the specification's"
    );
  });
});
