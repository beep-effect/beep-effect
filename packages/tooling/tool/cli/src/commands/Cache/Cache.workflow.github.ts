/**
 * Authenticated GitHub provenance for bounded, immutable producer upload reports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GitHubClient } from "@beep/github/GitHubClient";
import { GitHubContent } from "@beep/github/GitHubContent";
import { Repo } from "@beep/github/Repo";
import { $RepoCliId } from "@beep/identity/packages";
import { Sha256HexFromBytes } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { GithubClientRequest, layerGithubClientFor, selectGithubIdentity } from "../../internal/github/index.ts";
import { OutputBound, runCaptured } from "../../internal/process/index.ts";
import { CacheProducerBinding } from "./Cache.producer.schemas.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import {
  CacheHostedProducerApproval,
  CacheHostedProducerCompleteReport,
  CacheHostedProducerObservation,
  CacheHostedProducerReference,
  CacheHostedProducerUpload,
} from "./Cache.workflow.github.schemas.ts";
import { CacheProducerObservation } from "./Cache.workflow.schemas.ts";
import type * as Crypto from "effect/Crypto";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { CacheHostedProducerRunReference } from "./Cache.workflow.github.schemas.ts";

/**
 * Build the existing authenticated GitHub services only for hosted verification.
 *
 * **Details**
 * Identity selection uses the repo CLI's approved reference/App/gh route.
 * The supplied working directory is independently configured issuer storage;
 * reports choose neither credentials nor the GitHub endpoint. Unpublished
 * previews and unqualified policy audits never construct this layer.
 *
 * **Example** (Prepare an authenticated workflow-content read)
 * ```ts
 * import { GitHubContent } from "@beep/github/GitHubContent"
 * import { layerCacheHostedProducerMetadata } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 *
 * const workflow = GitHubContent.use((content) =>
 *   content.getFile(".github/workflows/cache-producer.yml", {
 *     ref: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
 *   })
 * ).pipe(Effect.provide(layerCacheHostedProducerMetadata("/private/cache/stable")))
 * // The caller still supplies the repository and platform services at execution.
 * console.assert(Effect.isEffect(workflow))
 * ```
 *
 * @param directory - Independently selected private issuer directory used for identity routing.
 * @returns Lazy GitHub client/content services whose credentials resolve only when built.
 * @internal
 * @category layers
 * @since 0.0.0
 */
export const layerCacheHostedProducerMetadata = (directory: string) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const identity = yield* selectGithubIdentity(O.none());
      return GitHubContent.layer.pipe(
        Layer.provideMerge(layerGithubClientFor(GithubClientRequest.make({ identity, cwd: directory })))
      );
    }).pipe(Effect.withSpan("CacheWorkflow.hostedMetadataLayer"))
  );

const $I = $RepoCliId.create("commands/Cache/Cache.workflow.github");

/**
 * Application-owned authenticated metadata capability for acceptance verification.
 *
 * **Details**
 * This service owns lazy credential and HTTP resource composition. Submitted
 * requests cannot configure it. An absent capability fails acceptance closed;
 * unpublished previews need no credential or network lookup.
 *
 * **Example** (Deny published imports in a restricted application)
 * ```ts
 * import { CacheCommandError } from "@beep/repo-cli/commands/Cache"
 * import { CacheHostedProducerVerifier } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const denyPublishedImports = Layer.succeed(CacheHostedProducerVerifier, {
 *   verify: () => Effect.fail(CacheCommandError.new("Published imports are disabled."))
 * })
 * console.assert(Layer.isLayer(denyPublishedImports))
 * ```
 *
 * @internal
 * @category services
 * @since 0.0.0
 */
export class CacheHostedProducerVerifier extends Context.Service<
  CacheHostedProducerVerifier,
  {
    readonly verify: (
      directory: string,
      approval: CacheHostedProducerApproval,
      reference: CacheHostedProducerReference,
      archive: Uint8Array,
      observation: CacheProducerObservation
    ) => Effect.Effect<CacheHostedProducerObservation, CacheCommandError>;
  }
>()($I`CacheHostedProducerVerifier`) {}

/**
 * Provide lazy authenticated GitHub verification with one owned scope per call.
 *
 * **Details**
 * Captures platform services while composing the application layer. Credentials
 * are resolved only when a published request is checked; the metadata context
 * is built inside the verification scope and released before returning.
 *
 * **Example** (Compose qualification with lazy hosted verification)
 * ```ts
 * import { CacheQualificationLive } from "@beep/repo-cli/commands/Cache"
 * import { CacheHostedProducerVerifierLive } from "@beep/repo-cli/test/Cache"
 * import * as Layer from "effect/Layer"
 *
 * const qualification = CacheQualificationLive.pipe(
 *   Layer.provideMerge(CacheHostedProducerVerifierLive)
 * )
 * console.assert(Layer.isLayer(qualification))
 * ```
 *
 * @internal
 * @category layers
 * @since 0.0.0
 */
export const CacheHostedProducerVerifierLive = Layer.effect(
  CacheHostedProducerVerifier,
  Effect.gen(function* () {
    const platform = yield* Effect.context<
      FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
    >();
    return CacheHostedProducerVerifier.of({
      verify: Effect.fn("CacheWorkflow.verifyPublishedAcceptance")(
        function* (directory, approval, reference, archive, observation) {
          const metadata = yield* Layer.build(layerCacheHostedProducerMetadata(directory));
          return yield* verifyCacheHostedProducerObservation(approval, reference, archive, observation).pipe(
            Effect.provide(metadata)
          );
        },
        Effect.scoped,
        CacheCommandError.mapError("Cannot verify independently published acceptance metadata."),
        Effect.provide(platform)
      ),
    });
  })
);

const id = CacheHostedProducerReference.fields.runId;
const repository = S.Struct({ id, full_name: S.NonEmptyString, fork: S.Boolean }).pipe(
  $I.annoteSchema("Repository", { description: "GitHub repository database identity and fork status." })
);
const Run = S.Struct({
  id,
  run_attempt: id,
  event: S.Literals(["workflow_dispatch", "schedule"]),
  status: S.tag("completed"),
  conclusion: S.tag("success"),
  head_branch: S.tag("main"),
  head_sha: GitObjectId,
  path: CacheHostedProducerApproval.fields.workflowPath,
  repository,
  head_repository: repository,
  // A reusable workflow needs its own approved resolved identity. This first
  // route refuses it instead of trusting only the caller workflow's bytes.
  referenced_workflows: S.Array(S.Unknown)
    .check(S.isMaxLength(0))
    .pipe(S.withDecodingDefaultKey(Effect.succeed(A.empty<unknown>()))),
}).pipe(
  $I.annoteSchema("Run", { description: "Completed successful main workflow metadata authenticated by GitHub." })
);
const Artifact = S.Struct({
  id,
  name: S.NonEmptyString.check(S.isMaxLength(100)),
  size_in_bytes: S.Int.check(S.isBetween({ minimum: 1, maximum: 1024 * 1024 })),
  digest: S.String.check(S.isPattern(/^sha256:[0-9a-f]{64}$/)),
  expired: S.tag(false),
  created_at: S.DateTimeUtcFromString,
  expires_at: S.DateTimeUtcFromString,
  workflow_run: S.Struct({
    id,
    repository_id: id,
    head_repository_id: id,
    head_branch: S.tag("main"),
    head_sha: GitObjectId,
  }),
}).pipe(
  $I.annoteSchema("Artifact", {
    description: "Immutable bounded archive identity and owning workflow run authenticated by GitHub.",
  })
);
const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const encodeApproval = S.encodeEffect(S.fromJsonString(CacheHostedProducerApproval));
const decodeApproval = S.decodeUnknownEffect(S.fromJsonString(CacheHostedProducerApproval));
const decodeReport = S.decodeUnknownEffect(S.fromJsonString(CacheHostedProducerObservation.fields.report), {
  onExcessProperty: "error",
});
const encodeObservation = S.encodeEffect(S.fromJsonString(CacheProducerObservation));
const decodeObservation = S.decodeUnknownEffect(S.fromJsonString(CacheProducerObservation));
const sameBinding = S.toEquivalence(CacheProducerBinding);
const sameRun = S.toEquivalence(Run);
const sameArtifact = S.toEquivalence(Artifact);
const bound = OutputBound.make({ maxChars: 64 * 1024, truncatedNotice: "producer report exceeded its bound" });
const AsciiWorkflow = S.String.check(S.isMaxLength(64 * 1024), S.isPattern(/^[\x09\x0a\x0d\x20-\x7e]*$/)).pipe(
  $I.annoteSchema("AsciiWorkflow", {
    description: "First-cohort ASCII workflow profile; rejects lossy UTF-8 decoding before exact byte hashing.",
  })
);
const isAsciiWorkflow = S.is(AsciiWorkflow);
// The standard ZIP parser owns directory/CRC/compression handling. No member
// path is ever extracted, and the report stream is read with a hard byte cap.
const readReportScript = `import sys, zipfile, stat
try:
    with zipfile.ZipFile(sys.argv[1]) as archive:
        entries = archive.infolist()
        if len(entries) != 1:
            sys.exit(2)
        item = entries[0]
        mode = stat.S_IFMT(item.external_attr >> 16)
        if item.filename != "cache-producer.json" or item.orig_filename != item.filename:
            sys.exit(2)
        if mode not in (0, stat.S_IFREG) or item.external_attr & 0x10:
            sys.exit(2)
        if item.flag_bits & 1 or item.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
            sys.exit(2)
        if item.file_size > 65536:
            sys.exit(2)
        with archive.open(item) as member:
            body = member.read(65537)
        if len(body) > 65536:
            sys.exit(2)
        body.decode("ascii", errors="strict")
        sys.stdout.buffer.write(body)
except (OSError, ValueError, zipfile.BadZipFile, RuntimeError, NotImplementedError):
    sys.exit(3)
`;
const assertFreshArtifact = Effect.fn("CacheWorkflow.freshHostedArtifact")(function* (artifact: typeof Artifact.Type) {
  const now = yield* Clock.currentTimeMillis;
  const created = DateTime.toEpochMillis(artifact.created_at);
  if (
    created > now ||
    now - created > Duration.toMillis(Duration.hours(24)) ||
    DateTime.toEpochMillis(artifact.expires_at) <= now
  )
    return yield* CacheCommandError.new("Producer artifact is expired or outside its observation lifetime.");
});

const readReport = Effect.fn("CacheWorkflow.readHostedReport")(function* (archive: Uint8Array) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "beep-cache-producer-" });
  yield* fs.chmod(directory, 0o700);
  const file = path.join(directory, "report.zip");
  yield* fs.writeFile(file, archive, { mode: 0o600 });
  const result = yield* runCaptured({
    command: "/usr/bin/python3",
    args: ["-I", "-S", "-c", readReportScript, file],
    cwd: directory,
    extendEnv: false,
    env: { PATH: "/usr/bin", LANG: "C", LC_ALL: "C" },
    bound,
    timeout: Duration.seconds(10),
    source: "merge",
  });
  if (result.exitCode !== 0 || result.truncated)
    return yield* CacheCommandError.new("Producer ZIP inspection failed or exceeded its bound.");
  const text = result.output;
  const report = yield* decodeReport(text);
  return { report, reportSha256: yield* hashBytes(new TextEncoder().encode(text)) };
});

const inspectHostedMetadata = Effect.fn("CacheWorkflow.inspectHostedMetadata")(function* (
  approval: CacheHostedProducerApproval,
  selected: CacheHostedProducerReference
) {
  const client = yield* GitHubClient;
  const at = { owner: approval.repository.owner, repo: approval.repository.repo };
  const readRun = client.requestDecoded(
    "GET /repos/{owner}/{repo}/actions/runs/{run_id}",
    { ...at, run_id: selected.runId },
    Run
  );
  const readArtifact = client.requestDecoded(
    "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}",
    { ...at, artifact_id: selected.artifactId },
    Artifact
  );
  const run = yield* readRun;
  const artifact = yield* readArtifact;
  const name = `cache-producer-${selected.runId}-${selected.attempt}`;
  const approvedRepository = { id: approval.repositoryId, full_name: approval.repository.slug, fork: false };
  if (
    !sameRun(run, {
      ...run,
      id: selected.runId,
      run_attempt: selected.attempt,
      head_sha: approval.binding.workflowRevision,
      path: approval.workflowPath,
      repository: approvedRepository,
      head_repository: approvedRepository,
    })
  )
    return yield* CacheCommandError.new("Producer run differs from independent approval.");
  if (
    !sameArtifact(artifact, {
      ...artifact,
      id: selected.artifactId,
      name,
      workflow_run: {
        id: selected.runId,
        repository_id: approval.repositoryId,
        head_repository_id: approval.repositoryId,
        head_sha: run.head_sha,
        head_branch: "main",
      },
    })
  )
    return yield* CacheCommandError.new("Producer artifact differs from independent approval.");

  return { run, artifact, readRun, readArtifact };
});

const assertHostedReport = Effect.fn("CacheWorkflow.assertHostedReport")(function* (
  report: CacheHostedProducerObservation["report"],
  approval: CacheHostedProducerApproval,
  selected: CacheHostedProducerReference
) {
  if (
    report.runId !== selected.runId ||
    report.attempt !== selected.attempt ||
    !sameBinding(report.binding, approval.binding) ||
    A.dedupe(A.map(report.uploads, (upload) => upload.taskHash)).length !== report.uploads.length
  )
    return yield* CacheCommandError.new("Producer report identity, binding or unique upload set is invalid.");
});

/**
 * Join exact archived bytes to authenticated GitHub metadata and independent approval.
 *
 * **Details**
 * The caller transports a ZIP; its digest is checked against GitHub before any
 * member is read. Run and artifact identities are re-read after inspection.
 * The current completed main attempt, same non-fork repository, exact approved
 * workflow revision and bounded ASCII bytes, finite upload results and full computation binding
 * must agree. Reports expire after twenty-four hours. No report-selected URL,
 * trust root, arbitrary signing request or qualification transition exists.
 *
 * Approval must cover the workflow's complete reviewed execution boundary,
 * including pinned actions and protected credentials. These API checks do not
 * establish deployed environment rules, honest task inputs or HMAC validity.
 * Reusable workflows are refused until their resolved approvals are supported.
 *
 * **Example** (Reference immutable producer verification)
 * ```ts
 * import { verifyCacheHostedProducerUpload } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof verifyCacheHostedProducerUpload === "function")
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const verifyCacheHostedProducerUpload = Effect.fn("CacheWorkflow.verifyHostedUpload")(
  function* (
    approved: CacheHostedProducerApproval,
    reference: CacheHostedProducerReference,
    transportedArchive: Uint8Array
  ) {
    if (transportedArchive.byteLength === 0 || transportedArchive.byteLength > 1024 * 1024)
      return yield* CacheCommandError.new("Producer archive exceeded its compressed byte bound.");
    const archive = new Uint8Array(transportedArchive);
    const approval = yield* encodeApproval(approved).pipe(Effect.flatMap(decodeApproval));
    const selected = yield* S.encodeEffect(CacheHostedProducerReference)(reference).pipe(
      Effect.flatMap(S.decodeUnknownEffect(CacheHostedProducerReference))
    );
    const content = yield* GitHubContent;
    const { run, artifact, readRun, readArtifact } = yield* inspectHostedMetadata(approval, selected);
    yield* assertFreshArtifact(artifact);
    const artifactSha256 = yield* hashBytes(archive);
    if (archive.byteLength !== artifact.size_in_bytes || `sha256:${artifactSha256}` !== artifact.digest)
      return yield* CacheCommandError.new("Transported producer archive differs from GitHub's immutable digest.");
    const workflow = yield* content
      .getFile(approval.workflowPath, { ref: run.head_sha })
      .pipe(Repo.provide(approval.repository));
    const workflowBytes = new TextEncoder().encode(workflow);
    if (!isAsciiWorkflow(workflow) || (yield* hashBytes(workflowBytes)) !== approval.workflowSha256)
      return yield* CacheCommandError.new("Producer workflow bytes differ from independent approval.");
    const decoded = yield* readReport(archive);
    yield* assertHostedReport(decoded.report, approval, selected);
    if (!sameRun(run, yield* readRun) || !sameArtifact(artifact, yield* readArtifact))
      return yield* CacheCommandError.new("Producer run or immutable artifact changed during verification.");
    yield* assertFreshArtifact(artifact);
    return CacheHostedProducerObservation.make({
      reference: selected,
      artifactSha256,
      reportSha256: decoded.reportSha256,
      report: decoded.report,
    });
  },
  Effect.scoped,
  CacheCommandError.mapError("Cannot verify the independently approved GitHub producer artifact.")
);

/**
 * Prepare the bounded report from a complete observation's own upload.
 *
 * **Details**
 * The enclosing approved workflow supplies the run identity before upload. This function
 * derives the binding, complete canonical digest and upload from the observation;
 * it accepts no replacement upload rows. It neither authenticates the envelope
 * nor publishes an artifact or grants qualification.
 *
 * **Example** (Prepare publication for an owned observation)
 * ```ts
 * import {
 *   buildCacheHostedProducerCompleteReport,
 *   type CacheHostedProducerRunReference,
 *   type CacheProducerObservation,
 * } from "@beep/repo-cli/test/Cache"
 *
 * const prepare = (observation: CacheProducerObservation, run: CacheHostedProducerRunReference) =>
 *   buildCacheHostedProducerCompleteReport(observation, run)
 * ```
 *
 * @internal
 * @category projections
 * @since 0.0.0
 */
export const buildCacheHostedProducerCompleteReport = Effect.fn("CacheWorkflow.buildCompleteHostedReport")(function* (
  observation: CacheProducerObservation,
  reference: CacheHostedProducerRunReference
) {
  const owned = yield* encodeObservation(observation).pipe(Effect.flatMap(decodeObservation));
  const upload = yield* owned.observation.upload.pipe(
    Effect.fromOption(() => CacheCommandError.new("Complete producer publication requires its owned upload."))
  );
  return CacheHostedProducerCompleteReport.make({
    binding: owned.envelope.body.binding,
    runId: reference.runId,
    attempt: reference.attempt,
    observationSha256: yield* hashBytes(new TextEncoder().encode(yield* encodeObservation(owned))),
    uploads: [upload],
  });
}, CacheCommandError.mapError("Cannot prepare complete producer publication."));

/**
 * Bind immutable hosted publication to the exact complete accepted observation.
 *
 * **Details**
 * Reuses all authenticated metadata, workflow, archive, freshness and race
 * checks. Legacy upload-only reports cannot satisfy this join. The independent
 * computation binding, full canonical observation digest and exact owned upload
 * must agree. This verifies publication only: issuer authentication, native
 * comparisons, live source and qualification policy remain separate gates.
 *
 * **Example** (Inspect complete hosted publication)
 * ```ts
 * import {
 *   type CacheHostedProducerApproval,
 *   type CacheHostedProducerReference,
 *   type CacheProducerObservation,
 *   verifyCacheHostedProducerObservation,
 * } from "@beep/repo-cli/test/Cache"
 *
 * const inspect = (
 *   approval: CacheHostedProducerApproval,
 *   run: CacheHostedProducerReference,
 *   archive: Uint8Array,
 *   observation: CacheProducerObservation,
 * ) => verifyCacheHostedProducerObservation(approval, run, archive, observation)
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const verifyCacheHostedProducerObservation = Effect.fn("CacheWorkflow.verifyHostedObservation")(function* (
  approval: CacheHostedProducerApproval,
  reference: CacheHostedProducerReference,
  archive: Uint8Array,
  observation: CacheProducerObservation
) {
  const owned = yield* encodeObservation(observation).pipe(Effect.flatMap(decodeObservation));
  const contents = yield* encodeObservation(owned);
  const upload = yield* owned.observation.upload.pipe(
    Effect.fromOption(() => CacheCommandError.new("Complete producer observation requires its owned upload."))
  );
  const hosted = yield* verifyCacheHostedProducerUpload(approval, reference, archive);
  if (!sameBinding(owned.envelope.body.binding, hosted.report.binding))
    return yield* CacheCommandError.new("Complete producer observation differs from independent binding.");
  if (!S.is(CacheHostedProducerCompleteReport)(hosted.report))
    return yield* CacheCommandError.new("Legacy upload-only publication cannot bind a complete observation.");
  if (hosted.report.observationSha256 !== (yield* hashBytes(new TextEncoder().encode(contents))))
    return yield* CacheCommandError.new("Hosted publication differs from the complete observation bytes.");
  if (!S.toEquivalence(CacheHostedProducerUpload)(hosted.report.uploads[0], upload))
    return yield* CacheCommandError.new("Hosted publication differs from the complete observation's owned upload.");
  return hosted;
}, CacheCommandError.mapError("Cannot join complete producer observation to immutable publication."));
