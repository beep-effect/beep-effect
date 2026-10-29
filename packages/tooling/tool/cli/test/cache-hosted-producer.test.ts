import { GitHubClient } from "@beep/github/GitHubClient";
import { GitHubContent } from "@beep/github/GitHubContent";
import { GitHubError } from "@beep/github/GitHubError";
import { RepoRef } from "@beep/github/Repo";
import { CacheProducerBinding } from "@beep/repo-cli/commands/Cache";
import {
  CacheHostedProducerApproval,
  CacheHostedProducerReference,
  CacheHostedProducerReport,
  CacheRuntimeProcess,
  verifyCacheHostedProducerUpload,
} from "@beep/repo-cli/test/Cache";
import { Sha256HexFromBytes } from "@beep/schema";
import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { input } from "./helpers/cache-producer-bundle-fixture.ts";

const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const encodeReport = S.encodeEffect(S.fromJsonString(CacheHostedProducerReport));
const encodeUnknown = S.encodeEffect(S.fromJsonString(S.Unknown));
const revision = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const workflow = "name: Producer\non: workflow_dispatch\n";
const reference = CacheHostedProducerReference.make({ runId: 11, attempt: 2, artifactId: 22 });
const runRoute = "GET /repos/{owner}/{repo}/actions/runs/{run_id}";
const artifactRoute = "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}";

const zipReport = Effect.fn("HostedProducerTest.zip")(function* (
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

const fixture = Effect.fn("HostedProducerTest.fixture")(function* () {
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
    runId: reference.runId,
    attempt: reference.attempt,
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
  const now = yield* Clock.currentTimeMillis;
  const repository = { id: 33, full_name: "beep-effect/beep-effect", fork: false };
  const run = {
    id: reference.runId,
    run_attempt: reference.attempt,
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
    id: reference.artifactId,
    name: "cache-producer-11-2",
    size_in_bytes: archive.byteLength,
    digest: `sha256:${yield* hashBytes(archive)}`,
    expired: false,
    created_at: DateTime.formatIso(DateTime.makeUnsafe(now - 1000)),
    expires_at: DateTime.formatIso(DateTime.makeUnsafe(now + 60_000)),
    workflow_run: {
      id: reference.runId,
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
      return verifyCacheHostedProducerUpload(approved, reference, transported).pipe(
        Effect.provideService(GitHubClient, client),
        Effect.provideService(GitHubContent, content)
      );
    }
  );
  const repack = Effect.fn("HostedProducerTest.repack")(function* (text: string, extra = false, symlink = false) {
    const bytes = yield* zipReport(text, extra, symlink);
    return {
      bytes,
      metadata: { ...artifact, size_in_bytes: bytes.byteLength, digest: `sha256:${yield* hashBytes(bytes)}` },
    };
  });
  return { approval, report, contents, archive, run, artifact, verify, repack };
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("immutable hosted producer evidence", (it) => {
  it.effect("joins a real ZIP to exact authenticated run, workflow, artifact and computation identities", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const observed = yield* f.verify();
      expect(observed.authority).toBe("verified-github-artifact-observation-only");
      expect(observed.report.uploads).toEqual(f.report.uploads);
      expect(observed.reportSha256).toBe(yield* hashBytes(new TextEncoder().encode(f.contents)));
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
      yield* Effect.forEach(
        [
          { ...f.report, runId: 12 },
          { ...f.report, attempt: 1 },
          { ...f.report, binding: { ...f.report.binding, sourceRevision: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" } },
          { ...f.report, binding: { ...f.report.binding, key: { ...f.report.binding.key, epoch: "forged" } } },
          { ...f.report, uploads: [...f.report.uploads, ...f.report.uploads] },
          { ...f.report, uploads: [] },
          { ...f.report, unsafe: "synthetic bearer and artifact content must be refused" },
          { ...f.report, uploads: [{ ...f.report.uploads[0], backendResult: "ambiguous-write" }] },
        ],
        Effect.fn("HostedProducerTest.rejectForgery")(function* (report) {
          const packed = yield* f.repack(yield* encodeUnknown(report));
          (yield* f.verify({ artifact: packed.metadata }, packed.bytes).pipe(Effect.result)).pipe(
            Result.isFailure,
            assertTrue
          );
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
});
