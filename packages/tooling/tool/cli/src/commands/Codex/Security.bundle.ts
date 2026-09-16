/**
 * Integrity-checked import of local scan artifacts into the findings pipeline.
 * @packageDocumentation
 * @since 0.0.0
 */
import { NonNegativeInt, Sha256HexFromBytes } from "@beep/schema";
import { Effect, FileSystem, Match, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readContainedFileBytesNoFollow } from "../../internal/cli/FsGuards.ts";
import { decodeCodexFindingsCapturePayload } from "./Findings.capture.schemas.ts";
import { scanSensitiveUnknown } from "./Findings.scan.ts";
import { CodexSecurityError, toCodexSecurityError } from "./Security.errors.ts";
import {
  GitHubRepoSlugFromRemote,
  SECURITY_PACKAGE_VERSION,
  SecurityCoverage,
  SecurityFindings,
  SecurityManifest,
  SecuritySeverityToPacket,
  SecuritySourceReceipt,
} from "./Security.schemas.ts";
import type { FsGuardError } from "../../internal/cli/FsGuards.ts";
import type { GitHubRepoSlug } from "./Findings.capture.schemas.ts";

const decodeJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const utf8 = new TextDecoder();
/** Per-artifact ceiling: 16 MiB. */
const MAX_ARTIFACT_BYTES = NonNegativeInt.make(16777216);
/** Whole-bundle ceiling across every file read: 64 MiB. */
const MAX_BUNDLE_BYTES = 67108864;

type SealedArtifact = { readonly path: string; readonly bytes: Uint8Array };
/**
 * Where the repository identity came from. Only the wrapper receipt is
 * deterministic; a sealed remote is model-written and unverified upstream.
 */
type ScanIdentity = {
  readonly repository: GitHubRepoSlug;
  readonly repositorySource: "local-source-receipt" | "sealed-remote-unverified";
};
const remoteSlugOption = S.decodeOption(GitHubRepoSlugFromRemote);
const decodeRemoteSlug = S.decodeEffect(GitHubRepoSlugFromRemote);
const encodeManifest = S.encodeEffect(SecurityManifest);

/**
 * Decodes a credential-free GitHub remote into a repository slug with a safe error.
 *
 * **Details**
 * Effect wrapper over `GitHubRepoSlugFromRemote` for the scan command, which
 * reads the local origin (often scp-style) and must fail with an operator-safe
 * `CodexSecurityError` rather than a schema issue.
 *
 * **Example** (Normalizing an scp-style remote)
 * ```ts import.meta.vitest name="Normalizing an scp-style remote"
 * import { securityRepositoryFromRemote } from "@beep/repo-cli/commands/Codex/Security.bundle"
 * import * as Effect from "effect/Effect"
 * const program = securityRepositoryFromRemote("git@github.com:example/project.git")
 * Effect.runSync(program) // => "example/project"
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const securityRepositoryFromRemote = Effect.fn("CodexSecurity.repositoryFromRemote")((remote: string) =>
  decodeRemoteSlug(remote).pipe(
    Effect.mapError((cause) =>
      CodexSecurityError.make({ message: "Repository remote is not a credential-free GitHub slug.", cause })
    )
  )
);

const artifactReadError = (cause: FsGuardError): CodexSecurityError =>
  CodexSecurityError.make({
    message: Match.value(cause.reason).pipe(
      Match.whenOr(
        "symlink",
        "outside-root",
        "parent-not-directory",
        "root-not-directory",
        () => "Bundle artifacts must be unlinked files beneath the scan directory."
      ),
      Match.orElse(() => "Bundle artifact is not a regular file within the 16 MiB input limit.")
    ),
    cause,
  });

/**
 * Bounded, contained, symlink-refusing read of one bundle file that also
 * charges the bytes against the whole-bundle budget. `None` means absent.
 */
const readSealedBytes = Effect.fn("CodexSecurity.readSealedBytes")(function* (
  root: string,
  relative: string,
  totalBytes: Ref.Ref<number>
) {
  const read = yield* readContainedFileBytesNoFollow(root, relative, MAX_ARTIFACT_BYTES).pipe(
    Effect.mapError(artifactReadError)
  );
  const contents = read.contents;
  if (!read.exists) return O.none<Uint8Array>();
  if (O.isNone(contents))
    return yield* CodexSecurityError.make({
      message: "Bundle artifact is not a regular file within the 16 MiB input limit.",
    });
  const consumed = yield* Ref.updateAndGet(totalBytes, (total) => total + contents.value.byteLength);
  if (consumed > MAX_BUNDLE_BYTES)
    return yield* CodexSecurityError.make({ message: "Bundle exceeds the 64 MiB total input limit." });
  return contents;
});

const readSealedArtifact = Effect.fn("CodexSecurity.readSealedArtifact")(function* (
  root: string,
  relative: string,
  totalBytes: Ref.Ref<number>
) {
  const bytes = yield* readSealedBytes(root, relative, totalBytes);
  if (O.isNone(bytes)) return yield* CodexSecurityError.make({ message: "Required sealed artifact is missing." });
  return bytes.value;
});

const decodeSealedJson = <Decoded, Encoded>(schema: S.Codec<Decoded, Encoded>) =>
  Effect.fn("CodexSecurity.decodeSealedJson")(function* (bytes: Uint8Array) {
    const input = yield* decodeJson(utf8.decode(bytes));
    return { input, value: yield* S.decodeUnknownEffect(schema)(input) };
  });

const decodeManifestJson = decodeSealedJson(SecurityManifest);
const decodeFindingsJson = decodeSealedJson(SecurityFindings);
const decodeCoverageJson = decodeSealedJson(SecurityCoverage);
const decodeReceiptJson = decodeSealedJson(SecuritySourceReceipt);

const isMockScan = (manifest: SecurityManifest): boolean =>
  O.contains("mock")(manifest.scan.scope.runtimeStatus) || O.exists(manifest.scan.extensions, (value) => value.mock);

const bindsRequiredArtifactsOnce = (manifest: SecurityManifest): boolean => {
  const paths = A.map(manifest.scan.artifacts, (artifact) => artifact.path);
  return (
    A.length(A.dedupe(paths)) === A.length(paths) &&
    A.contains(paths, "findings.json") &&
    A.contains(paths, "coverage.json")
  );
};

const decodeSealedManifest = Effect.fn("CodexSecurity.decodeSealedManifest")(function* (
  root: string,
  totalBytes: Ref.Ref<number>
) {
  const manifestBytes = yield* readSealedArtifact(root, "scan-manifest.json", totalBytes);
  const { value: manifest } = yield* decodeManifestJson(manifestBytes);
  if (isMockScan(manifest))
    return yield* CodexSecurityError.make({ message: "Synthetic mock scans cannot create remediation packets." });
  if (!bindsRequiredArtifactsOnce(manifest))
    return yield* CodexSecurityError.make({
      message: "Manifest must bind findings and coverage exactly once, without duplicate artifact paths.",
    });
  return { manifest, manifestBytes };
});

const verifySealedArtifacts = Effect.fn("CodexSecurity.verifySealedArtifacts")(function* (
  root: string,
  artifacts: SecurityManifest["scan"]["artifacts"],
  totalBytes: Ref.Ref<number>
) {
  return yield* Effect.forEach(
    artifacts,
    Effect.fnUntraced(function* (artifact: SecurityManifest["scan"]["artifacts"][number]) {
      const bytes = yield* readSealedArtifact(root, artifact.path, totalBytes);
      if ((yield* hashBytes(bytes)) !== artifact.sha256)
        return yield* CodexSecurityError.make({ message: "Artifact digest does not match the sealed manifest." });
      return { path: artifact.path, bytes } satisfies SealedArtifact;
    }),
    { concurrency: 1 }
  );
});

const sealedArtifactBytes = Effect.fn("CodexSecurity.sealedArtifactBytes")(function* (
  artifacts: ReadonlyArray<SealedArtifact>,
  name: string
) {
  const artifact = A.findFirst(artifacts, (item) => item.path === name);
  if (O.isNone(artifact)) return yield* CodexSecurityError.make({ message: "Required sealed artifact is missing." });
  return artifact.value.bytes;
});

const hasDuplicateIdentities = (findings: SecurityFindings): boolean => {
  const count = A.length(findings.findings);
  return (
    A.length(A.dedupe(A.map(findings.findings, (finding) => finding.findingId))) !== count ||
    A.length(A.dedupe(A.map(findings.findings, (finding) => finding.occurrenceId))) !== count
  );
};

const verifyScanConsistency = Effect.fn("CodexSecurity.verifyScanConsistency")(function* (
  manifest: SecurityManifest,
  findings: SecurityFindings,
  coverage: SecurityCoverage
) {
  if (findings.scanId !== manifest.scan.id || coverage.scanId !== manifest.scan.id)
    return yield* CodexSecurityError.make({ message: "Manifest, findings, and coverage refer to different scans." });
  if (hasDuplicateIdentities(findings))
    return yield* CodexSecurityError.make({ message: "A scan contains duplicate finding or occurrence identities." });
});

const readSourceReceipt = Effect.fn("CodexSecurity.readSourceReceipt")(function* (
  root: string,
  totalBytes: Ref.Ref<number>
) {
  const bytes = yield* readSealedBytes(root, "beep-source.json", totalBytes);
  return yield* O.match(bytes, {
    onNone: () => Effect.succeed(O.none<SecuritySourceReceipt>()),
    onSome: (value) => decodeReceiptJson(value).pipe(Effect.map((decoded) => O.some(decoded.value))),
  });
});

const receiptDisagrees = (
  manifest: SecurityManifest,
  remoteRepository: O.Option<GitHubRepoSlug>,
  receipt: SecuritySourceReceipt
): boolean =>
  receipt.revision !== manifest.scan.target.revision ||
  O.exists(remoteRepository, (repository) => repository !== receipt.repository);

/**
 * The wrapper receipt is the identity whenever it exists: it is written from the
 * actual checkout, while the sealed remote is model-asserted. A remote that
 * normalizes must agree with the receipt; one that does not is ignored. Without
 * a receipt the sealed remote is used and labelled unverified.
 */
const resolveScanIdentity = Effect.fn("CodexSecurity.resolveScanIdentity")(function* (
  root: string,
  manifest: SecurityManifest,
  totalBytes: Ref.Ref<number>
) {
  const receipt = yield* readSourceReceipt(root, totalBytes);
  const remoteRepository = O.flatMap(manifest.scan.target.remote, remoteSlugOption);
  if (O.exists(receipt, (value) => receiptDisagrees(manifest, remoteRepository, value)))
    return yield* CodexSecurityError.make({ message: "Local source receipt disagrees with the sealed target." });
  const identity: O.Option<ScanIdentity> = O.orElse(
    O.map(receipt, (value) => ({ repository: value.repository, repositorySource: "local-source-receipt" as const })),
    () =>
      O.map(remoteRepository, (repository) => ({ repository, repositorySource: "sealed-remote-unverified" as const }))
  );
  if (O.isNone(identity))
    return yield* CodexSecurityError.make({
      message: "The scan has neither a GitHub remote nor a wrapper-generated beep-source.json receipt.",
    });
  return identity.value;
});

const reportOf = (manifest: SecurityManifest) => (finding: SecurityFindings["findings"][number]) =>
  Effect.map(encodeJson(finding), (description) => ({
    codexId: `local:${finding.findingId}`,
    description,
    relevantPaths: A.join(
      A.map(finding.locations, (location) => `${location.path}:${location.startLine}`),
      ", "
    ),
    detectedAt: manifest.scan.completedAt,
  }));

/**
 * Projects verified inputs into the capture payload, private reports, and evidence record.
 *
 * Only the capture projection (titles, ids, repository, commit) reaches tracked
 * files, so only it is hard-scanned. The raw upstream findings and coverage stay
 * complete in the private evidence record: a credential finding is secret-shaped
 * by definition, and refusing it would abort every real scan.
 */
const projectCapture = Effect.fn("CodexSecurity.projectCapture")(function* (input: {
  readonly manifest: SecurityManifest;
  readonly manifestBytes: Uint8Array;
  readonly findings: SecurityFindings;
  readonly findingsInput: unknown;
  readonly coverage: SecurityCoverage;
  readonly coverageInput: unknown;
  readonly identity: ScanIdentity;
}) {
  const { manifest, findings, identity } = input;
  const metadata = {
    adapterPackageVersion: SECURITY_PACKAGE_VERSION,
    producer: manifest.scan.producer,
    scanId: manifest.scan.id,
    manifestSha256: yield* hashBytes(input.manifestBytes),
    targetRevision: manifest.scan.target.revision,
    repository: identity.repository,
    repositorySource: identity.repositorySource,
    scope: (yield* encodeManifest(manifest)).scan.scope,
    coverage: input.coverageInput,
    findings: input.findingsInput,
  };
  const payloadInput = {
    schemaVersion: "codex-findings-capture/v1",
    capture: {
      source: "security-bundle",
      capturedAt: Str.slice(0, 10)(manifest.scan.completedAt),
      repository: identity.repository,
      sourceUrl: "https://learn.chatgpt.com/docs/security/cli/reference",
      findingsView: `sealed scan ${manifest.scan.id}`,
      expectedCount: A.length(findings.findings),
      authState: "authenticated",
    },
    findings: A.map(findings.findings, (finding) => ({
      codexId: `local:${finding.findingId}`,
      title: finding.title,
      severity: SecuritySeverityToPacket.Enum[finding.severity.level],
      codexStatus: "Open",
      commit: manifest.scan.target.revision,
    })),
  };
  if (A.isReadonlyArrayNonEmpty(scanSensitiveUnknown("security-bundle", payloadInput))) {
    return yield* CodexSecurityError.make({
      message: "Tracked capture fields contain private or secret-shaped content; offending values are not reproduced.",
    });
  }
  const payload = yield* decodeCodexFindingsCapturePayload(payloadInput);
  const reports = yield* Effect.forEach(findings.findings, reportOf(manifest));
  return { payload, reports, evidenceJson: yield* encodeJson(metadata), coverage: input.coverage.completeness };
});

/**
 * Verifies every declared digest before projecting a committed-revision scan.
 *
 * **Details**
 * Complete and partial coverage can both supply findings; neither supplies a
 * remediation verdict. File references must resolve beneath the bundle root.
 * Seals establish consistency, not authenticity of scanner claims.
 *
 * **Example** (Composing a bundle import)
 * ```ts
 * import { readSecurityBundle } from "@beep/repo-cli/commands/Codex/Security.bundle"
 * import * as Effect from "effect/Effect"
 * const program = readSecurityBundle("/private/scan").pipe(Effect.map(result => result.payload.capture.repository))
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const readSecurityBundle = Effect.fn("CodexSecurity.readBundle")(
  function* (directory: string) {
    const fs = yield* FileSystem.FileSystem;
    const root = yield* fs.realPath(directory);
    const totalBytes = yield* Ref.make(0);
    const { manifest, manifestBytes } = yield* decodeSealedManifest(root, totalBytes);
    const artifacts = yield* verifySealedArtifacts(root, manifest.scan.artifacts, totalBytes);
    const findings = yield* decodeFindingsJson(yield* sealedArtifactBytes(artifacts, "findings.json"));
    const coverage = yield* decodeCoverageJson(yield* sealedArtifactBytes(artifacts, "coverage.json"));
    yield* verifyScanConsistency(manifest, findings.value, coverage.value);
    const identity = yield* resolveScanIdentity(root, manifest, totalBytes);
    return yield* projectCapture({
      manifest,
      manifestBytes,
      findings: findings.value,
      findingsInput: findings.input,
      coverage: coverage.value,
      coverageInput: coverage.input,
      identity,
    });
  },
  Effect.mapError(
    toCodexSecurityError(
      "Security bundle rejected: check supported producer, committed target, bounded unlinked files, digests, identities, and private-content policy."
    )
  )
);
