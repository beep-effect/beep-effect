import { GitHubClient } from "@beep/github/GitHubClient";
import { GitHubContent } from "@beep/github/GitHubContent";
import { GitHubError } from "@beep/github/GitHubError";
import { RepoRef } from "@beep/github/Repo";
import {
  CacheCommandError,
  CacheProducerBinding,
  CacheProducerBody,
  CacheProducerBundle,
  CacheProducerEnvelope,
  CacheProtocolExecution,
} from "@beep/repo-cli/commands/Cache";
import {
  buildCacheHostedProducerCompleteReport,
  CacheHostedProducerApproval,
  CacheHostedProducerCompleteReport,
  CacheHostedProducerReference,
  CacheHostedProducerReport,
  CacheHostedProducerRunReference,
  CacheProducerObservation,
  CacheRuntimeProcess,
  verifyCacheHostedProducerObservation,
  verifyCacheHostedProducerUpload,
} from "@beep/repo-cli/test/Cache";
import { Sha256HexFromBytes } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it, vi } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { zipProducerReport as zipReport } from "./helpers/cache-hosted-publication-fixture.ts";
import { input } from "./helpers/cache-producer-bundle-fixture.ts";

const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const encodeReport = S.encodeEffect(S.fromJsonString(CacheHostedProducerReport));
const encodeCompleteReport = S.encodeEffect(S.fromJsonString(CacheHostedProducerCompleteReport));
const encodeObservation = S.encodeEffect(S.fromJsonString(CacheProducerObservation));
const encodeUnknown = S.encodeEffect(S.fromJsonString(S.Unknown));
const revision = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const workflow = "name: Producer\non: workflow_dispatch\n";
const reference = CacheHostedProducerReference.make({ runId: 11, attempt: 2, artifactId: 22 });
const runRoute = "GET /repos/{owner}/{repo}/actions/runs/{run_id}";
const artifactRoute = "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}";

const fixture = Effect.fn("HostedProducerTest.fixture")(function* (selectedReference = reference) {
  const now = yield* Clock.currentTimeMillis;
  const runReference = CacheHostedProducerRunReference.make({
    runId: selectedReference.runId,
    attempt: selectedReference.attempt,
  });
  const binding = yield* S.decodeUnknownEffect(CacheProducerBinding)({
    ...input.pilot,
    protocolClient: input.protocol.observation.client,
    workflowRevision: revision,
    workflowImplementation: input.pilot.configurationDigest,
    policyDigest: input.pilot.configurationDigest,
  });
  const approval = CacheHostedProducerApproval.make({
    repository: RepoRef.make({ owner: "beep-effect", repo: "beep-effect" }),
    repositoryId: 33,
    workflowPath: ".github/workflows/cache-producer.yml",
    workflowSha256: yield* hashBytes(new TextEncoder().encode(workflow)),
    binding,
  });
  const report = CacheHostedProducerReport.make({
    binding,
    runId: selectedReference.runId,
    attempt: selectedReference.attempt,
    uploads: [
      {
        taskHash: "0123456789abcdef",
        archiveSha256: binding.configurationDigest,
        archiveBytes: 128,
        status: 202,
        backendResult: "allowed",
      },
    ],
  });
  const contents = yield* encodeReport(report);
  const archive = yield* zipReport(contents);
  const observation = CacheProducerObservation.make({
    observation: yield* S.decodeUnknownEffect(CacheProducerBundle)({ ...input, upload: report.uploads[0] }),
    envelope: CacheProducerEnvelope.make({
      body: CacheProducerBody.make({
        issuer: binding.configurationDigest,
        binding,
        payloadSha256: binding.configurationDigest,
        issuedAtMs: now,
        expiresAtMs: now + 60_000,
      }),
      mac: binding.configurationDigest,
    }),
  });
  const repository = { id: 33, full_name: "beep-effect/beep-effect", fork: false };
  const run = {
    id: selectedReference.runId,
    run_attempt: selectedReference.attempt,
    event: "workflow_dispatch",
    status: "completed",
    conclusion: "success",
    head_branch: "main",
    head_sha: revision,
    path: approval.workflowPath,
    repository,
    head_repository: repository,
  };
  const artifact = {
    id: selectedReference.artifactId,
    name: `cache-producer-${selectedReference.runId}-${selectedReference.attempt}`,
    size_in_bytes: archive.byteLength,
    digest: `sha256:${yield* hashBytes(archive)}`,
    expired: false,
    created_at: DateTime.formatIso(DateTime.makeUnsafe(now - 1000)),
    expires_at: DateTime.formatIso(DateTime.makeUnsafe(now + 60_000)),
    workflow_run: {
      id: selectedReference.runId,
      repository_id: 33,
      head_repository_id: 33,
      head_branch: "main",
      head_sha: revision,
    },
  };
  const verify = Effect.fn("HostedProducerTest.verify")(
    (
      responses: {
        readonly run?: unknown;
        readonly artifact?: unknown;
        readonly workflow?: string;
        readonly afterRun?: unknown;
        readonly afterArtifact?: unknown;
        readonly runFailure?: GitHubError;
        readonly observation?: CacheProducerObservation;
        readonly onRead?: () => void;
      } = {},
      transported = archive,
      approved = approval
    ) => {
      let runReads = 0;
      let artifactReads = 0;
      const firstRun = responses.run ?? run;
      const firstArtifact = responses.artifact ?? artifact;
      const runResponse = () => (++runReads > 1 ? (responses.afterRun ?? firstRun) : firstRun);
      const artifactResponse = () => (++artifactReads > 1 ? (responses.afterArtifact ?? firstArtifact) : firstArtifact);
      const client = GitHubClient.makeTest({
        requestDecoded: dual(3, <A, I>(route: string, _params: Record<string, unknown>, schema: S.Codec<A, I>) =>
          Effect.suspend(() => {
            responses.onRead?.();
            if (route === runRoute && responses.runFailure !== undefined) return Effect.fail(responses.runFailure);
            const data = route === runRoute ? runResponse() : artifactResponse();
            expect([runRoute, artifactRoute]).toContain(route);
            return S.decodeUnknownEffect(schema)(data).pipe(
              Effect.mapError((cause) => GitHubError.decode(route, "Fixture metadata rejected", cause))
            );
          })
        ),
      });
      const content = GitHubContent.makeTest({
        getFile: dual(2, (file: string, options?: { readonly ref?: string | undefined }) => {
          expect(file).toBe(approval.workflowPath);
          expect(options?.ref).toBe(revision);
          return Effect.succeed(responses.workflow ?? workflow);
        }),
      });
      const verified =
        responses.observation === undefined
          ? verifyCacheHostedProducerUpload(approved, selectedReference, transported)
          : verifyCacheHostedProducerObservation(approved, selectedReference, transported, responses.observation);
      return verified.pipe(Effect.provideService(GitHubClient, client), Effect.provideService(GitHubContent, content));
    }
  );
  const repack = Effect.fn("HostedProducerTest.repack")(function* (text: string, extra = false, symlink = false) {
    const bytes = yield* zipReport(text, extra, symlink);
    return {
      bytes,
      metadata: { ...artifact, size_in_bytes: bytes.byteLength, digest: `sha256:${yield* hashBytes(bytes)}` },
    };
  });
  const complete = Effect.fn("HostedProducerTest.complete")(function* () {
    const report = yield* buildCacheHostedProducerCompleteReport(observation, runReference);
    const packed = yield* repack(yield* encodeCompleteReport(report));
    return { report, ...packed };
  });
  return { approval, report, observation, contents, archive, run, runReference, artifact, verify, repack, complete };
});

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "30 seconds" })(
  "immutable hosted producer evidence",
  (it) => {
    it.effect("retains typed GitHub failure causes without adding them to producer observations", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        for (const status of [401, 403, 404, 429]) {
          const failure = GitHubError.fromOctokit(
            runRoute,
            { status, message: "fixture metadata request rejected" },
            0
          );
          const error = yield* f.verify({ runFailure: failure }).pipe(Effect.flip);
          expect(error.cause).toBe(failure);
          expect(error.message).toBe("Cannot verify the independently approved GitHub producer artifact.");
        }
      })
    );
    it.effect("preserves an existing CacheCommandError and its runtime cause", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const original = CacheCommandError.new("controlled producer identity refusal", { stage: "fixture-identity" });
        const create = vi.spyOn(CacheCommandError, "new").mockReturnValue(original);
        yield* Effect.gen(function* () {
          const error = yield* f.verify({ run: { ...f.run, id: f.run.id + 1 } }).pipe(Effect.flip);
          expect(error).toBe(original);
          expect(create).toHaveBeenCalledTimes(1);
        }).pipe(Effect.ensuring(Effect.sync(() => create.mockRestore())));
      })
    );
    it.effect.prop(
      "binds schema-generated run references and rejects a different authenticated artifact identity",
      { selectedReference: CacheHostedProducerReference },
      ({ selectedReference }) =>
        Effect.gen(function* () {
          const f = yield* fixture(selectedReference);
          const observed = yield* f.verify();
          expect(observed.reference).toEqual(selectedReference);
          expect(observed.report.runId).toBe(selectedReference.runId);
          expect(observed.report.attempt).toBe(selectedReference.attempt);
          const otherId = selectedReference.artifactId === 1 ? 2 : 1;
          (yield* f.verify({ artifact: { ...f.artifact, id: otherId } }).pipe(Effect.result)).pipe(
            Result.isFailure,
            assertTrue
          );
        }),
      { arbitrary: fcRuns(12) }
    );

    it.effect("joins a real ZIP to exact authenticated run, workflow, artifact and computation identities", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const observed = yield* f.verify();
        expect(observed.authority).toBe("verified-github-artifact-observation-only");
        expect(observed.report.uploads).toEqual(f.report.uploads);
        expect(observed.reportSha256).toBe(yield* hashBytes(new TextEncoder().encode(f.contents)));
      })
    );

    it.effect("binds complete canonical observation bytes without publishing their matrices or envelope", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const packed = yield* f.complete();
        const observed = yield* f.verify({ artifact: packed.metadata, observation: f.observation }, packed.bytes);
        expect(observed.report).toEqual(packed.report);
        expect(packed.report.observationSha256).toBe(
          yield* hashBytes(new TextEncoder().encode(yield* encodeObservation(f.observation)))
        );
        const contents = yield* encodeCompleteReport(packed.report);
        expect(contents).not.toContain('"envelope"');
        expect(contents).not.toContain('"pilot"');
        expect(observed.authority).toBe("verified-github-artifact-observation-only");
      })
    );

    it.effect("rejects substituted complete matrices or envelope bytes with the same approved upload", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const packed = yield* f.complete();
        const other = yield* hashBytes(new TextEncoder().encode("controlled changed complete observation"));
        for (const observation of [
          CacheProducerObservation.make({
            ...f.observation,
            observation: CacheProducerBundle.make({
              ...f.observation.observation,
              protocol: CacheProtocolExecution.make({ ...f.observation.observation.protocol, bunSha256: other }),
            }),
          }),
          CacheProducerObservation.make({
            ...f.observation,
            envelope: CacheProducerEnvelope.make({ ...f.observation.envelope, mac: other }),
          }),
        ]) {
          const error = yield* f.verify({ artifact: packed.metadata, observation }, packed.bytes).pipe(Effect.flip);
          expect(error.message).toContain("complete observation bytes");
        }
      })
    );

    it.effect("rejects a contradictory published upload even when its complete observation digest matches", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const original = yield* f.complete();
        const report = CacheHostedProducerCompleteReport.make({
          ...original.report,
          uploads: [{ ...original.report.uploads[0], archiveBytes: original.report.uploads[0].archiveBytes + 1 }],
        });
        const packed = yield* f.repack(yield* encodeCompleteReport(report));
        const error = yield* f
          .verify({ artifact: packed.metadata, observation: f.observation }, packed.bytes)
          .pipe(Effect.flip);
        expect(error.message).toContain("owned upload");
      })
    );

    it.effect("keeps legacy upload-only reports readable without accepting them as complete publication", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        expect((yield* f.verify()).report.schemaVersion).toBe("cache-hosted-producer-upload/v1");
        const error = yield* f.verify({ observation: f.observation }).pipe(Effect.flip);
        expect(error.message).toContain("Legacy upload-only publication");
      })
    );

    it.effect("requires the complete observation's own upload before publication or hosted joining", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const observation = CacheProducerObservation.make({
          ...f.observation,
          observation: CacheProducerBundle.make({ ...f.observation.observation, upload: O.none() }),
        });
        const buildError = yield* buildCacheHostedProducerCompleteReport(observation, f.runReference).pipe(Effect.flip);
        expect(buildError.message).toContain("owned upload");
        const joinError = yield* f.verify({ observation }).pipe(Effect.flip);
        expect(joinError.message).toContain("owned upload");
      })
    );

    it.effect("retains authenticated run and race refusals for complete publication", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const packed = yield* f.complete();
        for (const change of [
          { run: { ...f.run, event: "pull_request" } },
          { afterRun: { ...f.run, run_attempt: f.run.run_attempt + 1 } },
        ])
          (yield* f
            .verify({ ...change, artifact: packed.metadata, observation: f.observation }, packed.bytes)
            .pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
      })
    );

    it.effect("rejects an observation from another independent computation binding", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const packed = yield* f.complete();
        const binding = CacheProducerBinding.make({
          ...f.approval.binding,
          sourceRevision: yield* S.decodeEffect(CacheProducerBinding.fields.sourceRevision)(Str.repeat(40)("b")),
        });
        const observation = CacheProducerObservation.make({
          ...f.observation,
          envelope: CacheProducerEnvelope.make({
            ...f.observation.envelope,
            body: CacheProducerBody.make({ ...f.observation.envelope.body, binding }),
          }),
        });
        const error = yield* f.verify({ artifact: packed.metadata, observation }, packed.bytes).pipe(Effect.flip);
        expect(error.message).toContain("independent binding");
      })
    );

    it.effect("refuses malformed complete digests, absent digests and more than one upload", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const original = yield* f.complete();
        for (const report of [
          { ...original.report, observationSha256: "not-a-sha256" },
          { ...original.report, observationSha256: undefined },
          { ...original.report, uploads: [...original.report.uploads, ...original.report.uploads] },
        ]) {
          const packed = yield* f.repack(yield* encodeUnknown(report));
          (yield* f
            .verify({ artifact: packed.metadata, observation: f.observation }, packed.bytes)
            .pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
        }
      })
    );

    it.effect("compares a private observation snapshot despite mutation during hosted metadata reads", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const original = yield* f.complete();
        const upload = O.getOrThrow(f.observation.observation.upload);
        const changedBytes = upload.archiveBytes + 1;
        const report = CacheHostedProducerCompleteReport.make({
          ...original.report,
          uploads: [{ ...original.report.uploads[0], archiveBytes: changedBytes }],
        });
        const packed = yield* f.repack(yield* encodeCompleteReport(report));
        const error = yield* f
          .verify(
            {
              artifact: packed.metadata,
              observation: f.observation,
              onRead: () => expect(Reflect.set(upload, "archiveBytes", changedBytes)).toBe(true),
            },
            packed.bytes
          )
          .pipe(Effect.flip);
        expect(upload.archiveBytes).toBe(changedBytes);
        expect(error.message).toContain("owned upload");
      })
    );

    for (const { name, change } of [
      { name: "PR event", change: { event: "pull_request" } },
      { name: "wrong branch", change: { head_branch: "untrusted" } },
      { name: "failed run", change: { conclusion: "failure" } },
      { name: "unfinished run", change: { status: "in_progress" } },
      { name: "wrong run", change: { id: 12 } },
      { name: "stale attempt", change: { run_attempt: 3 } },
      { name: "changed workflow revision", change: { head_sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" } },
      { name: "different workflow", change: { path: ".github/workflows/other.yml" } },
      { name: "unapproved reusable workflow", change: { referenced_workflows: [{ sha: revision }] } },
    ]) {
      it.effect(`rejects ${name}`, () =>
        Effect.gen(function* () {
          const f = yield* fixture();
          (yield* f.verify({ run: { ...f.run, ...change } }).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
        })
      );
    }

    it.effect("rejects forks and repository substitution independently on run and artifact metadata", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        for (const run of [
          { ...f.run, repository: { ...f.run.repository, fork: true } },
          { ...f.run, head_repository: { ...f.run.head_repository, id: 44 } },
          { ...f.run, repository: { ...f.run.repository, full_name: "attacker/repo" } },
        ])
          (yield* f.verify({ run }).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
        (yield* f
          .verify({ artifact: { ...f.artifact, workflow_run: { ...f.artifact.workflow_run, repository_id: 44 } } })
          .pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
      })
    );

    it.effect("rejects expired, future, old and malformed artifact metadata", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        for (const change of [
          { expired: true },
          { name: "cache-producer-11-1" },
          { id: 23 },
          { digest: "md5:abcd" },
          { expires_at: "1970-01-01T00:00:00.000Z" },
          { created_at: "2099-01-01T00:00:00.000Z" },
          { created_at: "1969-12-30T00:00:00.000Z" },
          { size_in_bytes: 1024 * 1024 + 1 },
        ])
          (yield* f.verify({ artifact: { ...f.artifact, ...change } }).pipe(Effect.result)).pipe(
            Result.isFailure,
            assertTrue
          );
      })
    );

    it.effect("rejects empty and oversized transported archives at the compressed byte bound", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        for (const archive of [new Uint8Array(0), new Uint8Array(1024 * 1024 + 1)]) {
          const error = yield* f.verify({}, archive).pipe(Effect.flip);
          expect(error.message).toBe("Producer archive exceeded its compressed byte bound.");
        }
      })
    );

    it.effect("rejects transported corruption and changed approved workflow bytes", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const corrupt = new Uint8Array(f.archive);
        corrupt[0] = 0;
        (yield* f.verify({}, corrupt).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
        (yield* f.verify({ workflow: `${workflow}# changed` }).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
      })
    );

    it.effect("refuses lossy or Unicode workflow text outside the declared ASCII profile", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const text = `${workflow}# \uFFFD\n`;
        const approval = CacheHostedProducerApproval.make({
          ...f.approval,
          workflowSha256: yield* hashBytes(new TextEncoder().encode(text)),
        });
        const error = yield* f.verify({ workflow: text }, f.archive, approval).pipe(Effect.flip);
        expect(error.message).toContain("workflow bytes");
      })
    );

    it.effect("rejects a valid replacement ZIP whose digest was never published by GitHub", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const replacement = yield* f.repack(
          yield* encodeReport(
            CacheHostedProducerReport.make({
              ...f.report,
              uploads: [{ ...f.report.uploads[0], archiveBytes: 129 }],
            })
          )
        );
        const error = yield* f.verify({}, replacement.bytes).pipe(Effect.flip);
        expect(error.message).toContain("immutable digest");
      })
    );

    it.effect("rejects changed identities after inspection instead of trusting the initial read", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        (yield* f.verify({ afterRun: { ...f.run, run_attempt: 3 } }).pipe(Effect.result)).pipe(
          Result.isFailure,
          assertTrue
        );
        (yield* f
          .verify({ afterArtifact: { ...f.artifact, digest: `sha256:${Str.repeat(64)("b")}` } })
          .pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
      })
    );

    it.effect("rejects a forged computation or epoch binding and duplicate upload identities", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const encodedReport = yield* S.encodeEffect(CacheHostedProducerReport)(f.report);
        yield* Effect.forEach(
          [
            { ...encodedReport, runId: 12 },
            { ...encodedReport, attempt: 1 },
            {
              ...encodedReport,
              binding: { ...encodedReport.binding, sourceRevision: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
            },
            {
              ...encodedReport,
              binding: { ...encodedReport.binding, key: { ...encodedReport.binding.key, epoch: "forged" } },
            },
            { ...encodedReport, uploads: [...encodedReport.uploads, ...encodedReport.uploads] },
            { ...encodedReport, uploads: [] },
            { ...encodedReport, unsafe: "synthetic bearer and artifact content must be refused" },
            { ...encodedReport, uploads: [{ ...encodedReport.uploads[0], backendResult: "ambiguous-write" }] },
          ],
          Effect.fn("HostedProducerTest.rejectForgery")(function* (report) {
            const packed = yield* f.repack(yield* encodeUnknown(report));
            const error = yield* f.verify({ artifact: packed.metadata }, packed.bytes).pipe(Effect.flip);
            if (report.uploads.length > 0 && !("unsafe" in report) && report.uploads[0]?.backendResult === "allowed") {
              expect(error.cause).toBeUndefined();
              expect(error.message).toBe("Producer report identity, binding or unique upload set is invalid.");
            }
          }),
          { concurrency: 1, discard: true }
        );
      })
    );

    it.effect("refuses extra ZIP members, symlinks and decompressed report overflow without extracting files", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        for (const packed of [
          yield* f.repack(f.contents, true),
          yield* f.repack(f.contents, false, true),
          yield* f.repack(Str.repeat(100_000)("x")),
        ])
          (yield* f.verify({ artifact: packed.metadata }, packed.bytes).pipe(Effect.result)).pipe(
            Result.isFailure,
            assertTrue
          );
      })
    );

    it.effect("rejects a ZIP member whose embedded NUL was normalized away by the standard parser", () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "hosted-producer-nul-" });
        const file = path.join(directory, "report.zip");
        yield* fs.writeFile(file, yield* zipReport(f.contents, false, false, "cache-producer.jsonx"));
        const modified = yield* CacheRuntimeProcess.runCaptured({
          command: "/usr/bin/python3",
          args: [
            "-I",
            "-S",
            "-c",
            "import sys,pathlib; p=pathlib.Path(sys.argv[1]); p.write_bytes(p.read_bytes().replace(b'cache-producer.jsonx', b'cache-producer.json\\x00'))",
            file,
          ],
          cwd: directory,
          extendEnv: false,
          env: { PATH: "/usr/bin" },
          source: "merge",
          timeout: Duration.seconds(10),
        });
        expect(modified.exitCode).toBe(0);
        const archive = yield* fs.readFile(file);
        const metadata = {
          ...f.artifact,
          size_in_bytes: archive.byteLength,
          digest: `sha256:${yield* hashBytes(archive)}`,
        };
        const error = yield* f.verify({ artifact: metadata }, archive).pipe(Effect.flip);
        expect(error.message).toContain("ZIP inspection failed");
      })
    );
  }
);
