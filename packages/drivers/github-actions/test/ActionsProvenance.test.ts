import {
  ActionEnvironment,
  ActionsProvenance,
  OidcClaims,
  OidcTokenError,
  OidcTokenIssuer,
} from "@beep/github-actions";
import { MemoryFileSystem } from "@beep/memfs";
import { SlsaProvenance } from "@beep/sbom/SlsaProvenance";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const DISTINCT_CLAIMS = OidcClaims.make({
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
  env: Layer.Layer<ActionEnvironment> = ActionEnvironment.layerTest()
) => program.pipe(provideScopedLayer(Layer.mergeAll(issuer, env)));

const emptyEnvironment = ActionEnvironment.layerFrom({}).pipe(Layer.provide(MemoryFileSystem.layer));

describe("ActionsProvenance", () => {
  it.effect("maps every claim the predicate consumes, through a real decodable token double", () =>
    provided(
      Effect.gen(function* () {
        const provenance = yield* ActionsProvenance.capture("sigstore");
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
          "sbom's own constructor over the correctly spelled record pins every snake_case to camelCase rename"
        );
      }),
      OidcTokenIssuer.layerFor(DISTINCT_CLAIMS)
    )
  );

  it.effect("keeps repository_id and repository_owner_id on their own sides of the predicate", () =>
    provided(
      Effect.gen(function* () {
        const provenance = yield* ActionsProvenance.capture();
        assert.strictEqual(
          provenance.buildDefinition.internalParameters.github.repository_id,
          "1111",
          "both fields are strings, so a swap compiles and signs a wrong attestation; each is asserted on its own"
        );
        assert.strictEqual(provenance.buildDefinition.internalParameters.github.repository_owner_id, "2222");
      }),
      OidcTokenIssuer.layerFor(DISTINCT_CLAIMS)
    )
  );

  it.effect("defaults the server URL to https://github.com when the environment does not set it", () =>
    provided(
      Effect.gen(function* () {
        const provenance = yield* ActionsProvenance.capture();
        assert.strictEqual(
          provenance.buildDefinition.externalParameters.workflow.repository,
          "https://github.com/acme/widgets",
          "layerFrom({}) leaves GITHUB_SERVER_URL absent; layerTest()'s seeded default equals the fallback"
        );
        assert.strictEqual(
          provenance.runDetails.builder.id,
          "https://github.com/acme/reusable/.github/workflows/publish.yml@refs/tags/v2",
          "upstream builds the builder id from job_workflow_ref, so the claims keep it distinct from workflow_ref"
        );
      }),
      OidcTokenIssuer.layerFor(DISTINCT_CLAIMS),
      emptyEnvironment
    )
  );

  it.effect("a GHES server URL moves every URL the predicate builds", () =>
    provided(
      Effect.gen(function* () {
        const provenance = yield* ActionsProvenance.capture();
        const ghes = "https://github.example.com";
        assert.strictEqual(provenance.buildDefinition.externalParameters.workflow.repository, `${ghes}/acme/widgets`);
        assert.strictEqual(
          provenance.buildDefinition.resolvedDependencies[0]?.uri,
          `git+${ghes}/acme/widgets@refs/heads/release`
        );
        assert.strictEqual(
          provenance.runDetails.builder.id,
          `${ghes}/acme/reusable/.github/workflows/publish.yml@refs/tags/v2`
        );
        assert.strictEqual(
          provenance.runDetails.metadata.invocationId,
          `${ghes}/acme/widgets/actions/runs/777/attempts/3`
        );
      }),
      OidcTokenIssuer.layerFor(DISTINCT_CLAIMS),
      ActionEnvironment.layerTest({ GITHUB_SERVER_URL: "https://github.example.com" })
    )
  );

  it.effect("an issuer failure passes through untouched — the error policy stays the consumer's", () =>
    Effect.gen(function* () {
      const failure = OidcTokenError.make({ reason: "unavailable", detail: "ACTIONS_ID_TOKEN_REQUEST_URL" });
      const error = yield* provided(
        Effect.flip(ActionsProvenance.capture("sigstore")),
        OidcTokenIssuer.layerTest({ claims: () => Effect.fail(failure) })
      );
      assert.strictEqual(
        error,
        failure,
        "the same error object: not caught, rewrapped or defaulted; the consumer decides if attestation is mandatory"
      );
    })
  );

  it.effect("forwards the audience to the issuer verbatim, including its absence", () =>
    Effect.gen(function* () {
      const audiences: Array<string | undefined> = [];
      const issuer = OidcTokenIssuer.layerTest({
        claims: (audience) =>
          Effect.suspend(() => {
            audiences.push(audience);
            return Effect.succeed(DISTINCT_CLAIMS);
          }),
      });
      yield* provided(ActionsProvenance.capture("sigstore"), issuer);
      yield* provided(ActionsProvenance.capture(), issuer);
      assert.deepStrictEqual(
        audiences,
        ["sigstore", undefined],
        "no defaulting in either direction: an audience arrives as given, and omitting it sends none"
      );
    })
  );
});
