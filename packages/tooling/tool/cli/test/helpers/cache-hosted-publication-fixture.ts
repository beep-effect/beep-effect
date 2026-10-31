/** Controlled hosted metadata and physical ZIP fixtures; no live cloud access. */
import { GitHubClient } from "@beep/github/GitHubClient";
import { GitHubContent } from "@beep/github/GitHubContent";
import { GitHubError } from "@beep/github/GitHubError";
import { RepoRef } from "@beep/github/Repo";
import { CacheProducerBinding, CacheProducerBundle } from "@beep/repo-cli/commands/Cache";
import {
  buildCacheHostedProducerCompleteReport,
  CacheAdapterRuntimeObservation,
  CacheHostedProducerApproval,
  CacheHostedProducerCompleteReport,
  CacheHostedProducerReference,
  CacheHostedProducerRunReference,
  CacheHostedProducerUpload,
  CacheHostedProducerVerifier,
  CacheProducerAdapterReceipt,
  CacheProducerImportRequest,
  CacheProducerObservation,
  CacheProducerPublication,
  CacheProducerUploadApproval,
  CacheRuntimeProcess,
  initializeCacheProducerIssuer,
  verifyCacheHostedProducerObservation,
} from "@beep/repo-cli/test/Cache";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { CacheProducerTrustLocations } from "@beep/repo-cli/test/Cache";
import type { CacheTaskContract } from "@beep/repo-configs/cache";
import type * as Crypto from "effect/Crypto";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const encodeComplete = S.encodeEffect(S.fromJsonString(CacheHostedProducerCompleteReport));
const encodeApproval = S.encodeEffect(S.fromJsonString(CacheHostedProducerApproval));
const workflow = "name: Controlled producer\non: workflow_dispatch\n";
const runRoute = "GET /repos/{owner}/{repo}/actions/runs/{run_id}";
const artifactRoute = "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}";

/** Write one real ZIP, including explicit malformed-member controls when requested. */
export const zipProducerReport = Effect.fn("HostedProducerTest.zip")(function* (
  contents: string,
  extra?: boolean,
  symlink?: boolean,
  alternateMember?: "cache-producer.jsonx"
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "hosted-producer-test-" });
  const member = alternateMember ?? "cache-producer.json";
  const reportPath = path.join(directory, member);
  if (symlink === true) {
    yield* fs.symlink(contents, reportPath);
  } else {
    yield* fs.writeFileString(reportPath, contents);
  }
  if (extra === true) yield* fs.writeFileString(path.join(directory, "extra.txt"), "synthetic private payload");
  const zipped = yield* CacheRuntimeProcess.runCaptured({
    command: "/usr/bin/zip",
    args: ["-q", "-y", "report.zip", member, ...(extra === true ? ["extra.txt"] : [])],
    cwd: directory,
    source: "merge",
    extendEnv: false,
    env: { PATH: "/usr/bin" },
    timeout: Duration.seconds(10),
  });
  expect(zipped.exitCode).toBe(0);
  return yield* fs.readFile(path.join(directory, "report.zip"));
});

const prepareChannel = Effect.fn("PublishedAcceptanceTest.channel")(function* (
  directory: string,
  original: CacheProducerBundle,
  sourceBinding: CacheProducerBinding,
  contract: CacheTaskContract,
  runId: number
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const now = yield* Clock.currentTimeMillis;
  const uploadApproval = CacheProducerUploadApproval.make({
    targetSha256: sourceBinding.configurationDigest,
    artifactKeySha256: sourceBinding.runtimeKeyDigest,
  });
  const binding = CacheProducerBinding.make({ ...sourceBinding, uploadApproval: O.some(uploadApproval) });
  const observed = CacheAdapterRuntimeObservation.make({
    role: "writer",
    phase: "ready",
    tokioNamedThreadsIncludingBlocking: 2,
    totalThreads: 6,
    memoryPeakBytes: 1024,
  });
  const bundle = CacheProducerBundle.make({
    ...original,
    upload: O.some(
      CacheHostedProducerUpload.make({
        taskHash: "0123456789abcdef",
        archiveSha256: binding.configurationDigest,
        archiveBytes: 128,
        status: 202,
      })
    ),
    adapterRuntime: O.some(
      CacheProducerAdapterReceipt.make({
        backendSha256: Sha256Hex.make(binding.configurationDigest),
        targetSha256: uploadApproval.targetSha256,
        ready: { ...observed, role: "writer", phase: "ready" },
        afterLoad: { ...observed, role: "writer", phase: "after-load" },
      })
    ),
  });
  const issuer = yield* initializeCacheProducerIssuer(directory, binding, contract);
  const observation = CacheProducerObservation.make({ observation: bundle, envelope: yield* issuer.issue(bundle) });
  const approval = CacheHostedProducerApproval.make({
    repository: RepoRef.make({ owner: "beep-effect", repo: "beep-effect" }),
    repositoryId: 33,
    workflowPath: ".github/workflows/cache-producer.yml",
    workflowSha256: yield* hashBytes(new TextEncoder().encode(workflow)),
    binding,
  });
  const reference = CacheHostedProducerReference.make({ runId, attempt: 1, artifactId: runId + 100 });
  const report = yield* buildCacheHostedProducerCompleteReport(
    observation,
    CacheHostedProducerRunReference.make(reference)
  );
  const archive = yield* zipProducerReport(yield* encodeComplete(report));
  yield* fs.writeFileString(path.join(directory, "publication.json"), yield* encodeApproval(approval), {
    flag: "wx",
    mode: 0o600,
  });
  const repository = { id: 33, full_name: "beep-effect/beep-effect", fork: false };
  const run = {
    id: runId,
    run_attempt: 1,
    event: "workflow_dispatch",
    status: "completed",
    conclusion: "success",
    head_branch: "main",
    head_sha: binding.workflowRevision,
    path: approval.workflowPath,
    repository,
    head_repository: repository,
  };
  const artifact = {
    id: reference.artifactId,
    name: `cache-producer-${runId}-1`,
    size_in_bytes: archive.byteLength,
    digest: `sha256:${yield* hashBytes(archive)}`,
    expired: false,
    created_at: DateTime.formatIso(DateTime.makeUnsafe(now - 1000)),
    expires_at: DateTime.formatIso(DateTime.makeUnsafe(now + 24 * 60 * 60 * 1000)),
    workflow_run: {
      id: runId,
      repository_id: 33,
      head_repository_id: 33,
      head_branch: "main",
      head_sha: binding.workflowRevision,
    },
  };
  return {
    issuer,
    observation,
    approval,
    reference,
    publication: CacheProducerPublication.make({ reference, archive }),
    run,
    artifact,
  };
});

/** Shared pure fixture client for the workflow-content endpoint. */
export const PublishedContentClient = Layer.unwrap(
  Effect.gen(function* () {
    return GitHubClient.layerFixture({
      request: {
        "GET /repos/{owner}/{repo}/contents/{path}": Result.succeed({
          type: "file",
          encoding: "base64",
          content: yield* S.encodeEffect(S.Uint8ArrayFromBase64)(new TextEncoder().encode(workflow)),
          size: new TextEncoder().encode(workflow).byteLength,
          name: "cache-producer.yml",
          path: ".github/workflows/cache-producer.yml",
          sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          url: "https://example.invalid/content",
          git_url: "https://example.invalid/blob",
          html_url: "https://example.invalid/file",
          download_url: "https://example.invalid/raw",
          _links: {
            self: "https://example.invalid/content",
            git: "https://example.invalid/blob",
            html: "https://example.invalid/file",
          },
        }),
      },
    });
  })
);

/**
 * Prepare independent private approvals and real signed observations for both channels.
 * Metadata is captured once from fixture state; submitted mutations cannot rewrite it.
 */
export const makePublishedAcceptanceFixture = Effect.fn("PublishedAcceptanceTest.fixture")(function* (
  trust: CacheProducerTrustLocations,
  contract: CacheTaskContract,
  stable: CacheProducerBundle,
  stableBinding: CacheProducerBinding,
  canary: CacheProducerBundle,
  canaryBinding: CacheProducerBinding
) {
  const platform = yield* Effect.context<
    FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
  >();
  const channels = yield* Effect.all({
    stable: prepareChannel(trust.stable, stable, stableBinding, contract, 11),
    canary: prepareChannel(trust.canary, canary, canaryBinding, contract, 12),
  });
  const rows = [channels.stable, channels.canary];
  const reads = yield* Ref.make(0);
  const contentClient = yield* GitHubClient;
  const client = GitHubClient.makeTest({
    request: contentClient.request,
    requestDecoded: dual(3, <A, I>(route: string, params: Record<string, unknown>, schema: S.Codec<A, I>) =>
      Effect.gen(function* () {
        yield* Ref.update(reads, (count) => count + 1);
        const row = yield* Effect.fromOption(
          A.findFirst(rows, (entry) =>
            route === runRoute
              ? entry.reference.runId === params.run_id
              : entry.reference.artifactId === params.artifact_id
          ),
          () => GitHubError.notFound(route, "No independently prepared fixture metadata")
        );
        expect([runRoute, artifactRoute]).toContain(route);
        return yield* S.decodeUnknownEffect(schema)(route === runRoute ? row.run : row.artifact).pipe(
          Effect.mapError((cause) => GitHubError.decode(route, "Fixture metadata rejected", cause))
        );
      })
    ),
  });
  const content = GitHubContent.makeTest({
    getFile: dual(2, (file: string, options?: { readonly ref?: string | undefined }) => {
      expect(file).toBe(channels.stable.approval.workflowPath);
      expect(options?.ref).toBe(channels.stable.approval.binding.workflowRevision);
      return Effect.succeed(workflow);
    }),
  });
  const verifier = CacheHostedProducerVerifier.of({
    verify: Effect.fn("PublishedAcceptanceTest.verify")((_directory, approved, reference, archive, observation) =>
      verifyCacheHostedProducerObservation(approved, reference, archive, observation).pipe(
        Effect.provideService(GitHubClient, client),
        Effect.provideService(GitHubContent, content),
        Effect.provide(platform)
      )
    ),
  });
  return {
    request: CacheProducerImportRequest.make({
      observations: { stable: channels.stable.observation, canary: channels.canary.observation },
      publications: O.some({ stable: channels.stable.publication, canary: channels.canary.publication }),
    }),
    verifier,
    reads,
    client,
    channels,
  };
});
