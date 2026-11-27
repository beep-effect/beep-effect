/**
 * Consumed fields of the pinned Codex Security artifact contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, MappedLiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Str from "effect/String";
import { CodexFindingTitle, GitCommitSha, GitHubRepoSlug } from "./Findings.capture.schemas.ts";

const $I = $RepoCliId.create("commands/Codex/Security.schemas");

/**
 * Exact `@openai/codex-security` package version this adapter is validated against.
 *
 * **Details**
 * Every runtime path, install hint, evidence record, and packet copy derives
 * from this single pin so a version bump is one edit plus a fixture refresh.
 *
 * **Example** (Building the pinned install path)
 * ```ts import.meta.vitest name="Building the pinned install path"
 * import { SECURITY_PACKAGE_VERSION } from "@beep/repo-cli/commands/Codex/Security.schemas"
 * `~/.cache/beep/codex-security/${SECURITY_PACKAGE_VERSION}` // => "~/.cache/beep/codex-security/0.1.27"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SECURITY_PACKAGE_VERSION = "0.1.27";

/**
 * Version of the plugin bundled inside the pinned package.
 *
 * **Example** (Reading the supported producer version)
 * ```ts import.meta.vitest name="Reading the supported producer version"
 * import { SECURITY_PLUGIN_VERSION } from "@beep/repo-cli/commands/Codex/Security.schemas"
 * SECURITY_PLUGIN_VERSION // => "0.1.95"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SECURITY_PLUGIN_VERSION = "0.1.95";

const GITHUB_REMOTE = /^(?:https?:\/\/|ssh:\/\/(?:[^@/]+@)?|git@)github\.com[:/]([^?#]+?)(?:\.git)?\/?$/i;

const remoteSlug = Str.replace(GITHUB_REMOTE, "$1");

/**
 * Codec from any credential-free GitHub remote URL to its `owner/repo` slug.
 *
 * **Details**
 * The upstream seal writes scheme URLs (`ssh://git@github.com/owner/repo.git`)
 * while a local checkout's origin is often scp-style (`git@github.com:owner/repo.git`).
 * Both, plus `https://` and `http://`, decode to the same slug; encoding renders
 * the canonical `https://github.com/owner/repo.git` form. The `ssh://` form may
 * carry a user, the host is case-insensitive, and one terminal `.git` is a
 * transport suffix followed by at most one trailing slash.
 *
 * **Gotchas**
 * Bare and `.git`-suffixed URLs identify the same slug only when the repository
 * name does not itself end in `.git` (case-insensitive). The decoder removes
 * one transport suffix. To preserve a slug such as `owner/repo.git`, use the
 * encoder's explicit `https://github.com/owner/repo.git.git` spelling.
 *
 * **Example** (Normalizing the seal's SSH URL form)
 * ```ts import.meta.vitest name="Normalizing the seal's SSH URL form"
 * import { GitHubRepoSlugFromRemote } from "@beep/repo-cli/commands/Codex/Security.schemas"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * S.decodeOption(GitHubRepoSlugFromRemote)("ssh://git@github.com/example/project.git") // => O.some("example/project")
 * S.decodeOption(GitHubRepoSlugFromRemote)("GIT@GitHub.com:example/project/") // => O.some("example/project")
 * O.isNone(S.decodeOption(GitHubRepoSlugFromRemote)("https://example.com/other.git")) // => true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const GitHubRepoSlugFromRemote = S.String.check(
  S.isPattern(
    GITHUB_REMOTE,
    $I.annote("GitHubRemoteCheck", {
      title: "GitHub Remote",
      description: "A credential-free https, http, ssh, or scp-style github.com remote.",
      message: "Expected a github.com remote URL",
    })
  )
).pipe(
  S.decodeTo(GitHubRepoSlug, {
    decode: SchemaGetter.transform(remoteSlug),
    encode: SchemaGetter.transform((slug: string) => `https://github.com/${slug}.git`),
  }),
  $I.annoteSchema("GitHubRepoSlugFromRemote", {
    description: "Normalizes every accepted GitHub remote spelling to one repository slug.",
  })
);
/**
 * Repository slug decoded from a remote URL.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GitHubRepoSlugFromRemote = typeof GitHubRepoSlugFromRemote.Type;

/**
 * Repository-relative path rule shared by sealed artifacts and the `--path`
 * scan target: non-empty, no leading `/`, no `..` segment, no backslash, no
 * control or format characters.
 *
 * **Example** (Refusing traversal and absolute paths)
 * ```ts import.meta.vitest name="Refusing traversal and absolute paths"
 * import { RepoRelativePath } from "@beep/repo-cli/commands/Codex/Security.schemas"
 * import * as S from "effect/Schema"
 * S.is(RepoRelativePath)("packages/tooling") // => true
 * S.is(RepoRelativePath)("/etc") // => false
 * S.is(RepoRelativePath)("../sibling") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RepoRelativePath = S.String.check(
  S.isPattern(
    /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[^\p{Cc}\p{Cf}]+$/u,
    $I.annote("RepoRelativePathCheck", {
      title: "Repository-Relative Path",
      description: "A non-empty relative path with no `..` segment, backslash, or control character.",
      message: "Expected a repository-relative path without traversal",
    })
  )
).pipe($I.annoteSchema("RepoRelativePath", { description: "Bounded relative path beneath a repository root." }));
/**
 * @category type-level
 * @since 0.0.0
 */
export type RepoRelativePath = typeof RepoRelativePath.Type;
const ArtifactPath = RepoRelativePath;
const Digest = S.String.check(S.isPattern(/^[a-f0-9]{64}$/));
const FindingId = S.String.check(S.isPattern(/^csf_[a-f0-9]{24}$/));
const OccurrenceId = S.String.check(S.isPattern(/^occ_[a-f0-9]{24}$/));
const ScanId = S.String.check(S.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/));
const Timestamp = S.String.check(S.isPattern(/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/));
const Text = S.String.check(S.isMinLength(1), S.isMaxLength(100000));

class Artifact extends S.Opaque<Artifact, { readonly brand: unique symbol }>()(
  S.Struct({ path: ArtifactPath, sha256: Digest, mediaType: S.NonEmptyString }).pipe(
    $I.annoteSchema("Artifact", { description: "Digest-bound file in a sealed scan." })
  )
) {}
class Producer extends S.Opaque<Producer, { readonly brand: unique symbol }>()(
  S.Struct({ name: S.tag("codex-security-plugin"), version: S.tag(SECURITY_PLUGIN_VERSION) }).pipe(
    $I.annoteSchema("Producer", { description: `Bundled producer supported by SDK ${SECURITY_PACKAGE_VERSION}.` })
  )
) {}
class Target extends S.Opaque<Target, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("git_revision"),
    revision: GitCommitSha,
    remote: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    targetId: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("Target", {
      description: "Immutable repository revision; snapshots are not accepted by packet ingestion.",
    })
  )
) {}

/**
 * Binds the wrapper's selected repository to an exact source revision.
 *
 * **Details**
 * Upstream manifests can omit the remote. This sidecar records local capture
 * provenance without modifying the sealed bundle or claiming upstream attestation.
 *
 * **Example** (Recording source identity)
 * ```ts import.meta.vitest name="Recording source identity"
 * import { SecuritySourceReceipt } from "@beep/repo-cli/commands/Codex/Security.schemas"
 * const source = SecuritySourceReceipt.make({ schemaVersion: "beep-security-source/v1", repository: "example/project", revision: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" })
 * source.repository // => "example/project"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SecuritySourceReceipt extends S.Opaque<SecuritySourceReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("beep-security-source/v1"),
    repository: GitHubRepoSlug,
    revision: GitCommitSha,
  }).pipe(
    $I.annoteSchema("SecuritySourceReceipt", {
      description: "Local capture provenance used when upstream omits repository identity.",
    })
  )
) {}
const scopeLimitationsDefault = A.empty();
class Scope extends S.Opaque<Scope, { readonly brand: unique symbol }>()(
  S.Struct({
    includePaths: S.Array(S.String),
    excludePaths: S.Array(S.String),
    limitations: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(scopeLimitationsDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(scopeLimitationsDefault))
    ),
    runtimeStatus: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    summary: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    context: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    validationMode: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe($I.annoteSchema("Scope", { description: "Declared included and excluded scan paths." }))
) {}
class Extensions extends S.Opaque<Extensions, { readonly brand: unique symbol }>()(
  S.Struct({
    mock: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ),
  }).pipe(
    $I.annoteSchema("Extensions", {
      description: "Synthetic-scan marker that cannot be promoted to a real findings packet.",
    })
  )
) {}
class Scan extends S.Opaque<Scan, { readonly brand: unique symbol }>()(
  S.Struct({
    id: ScanId,
    producer: Producer,
    status: S.tag("completed"),
    startedAt: Timestamp,
    completedAt: Timestamp,
    sealedAt: Timestamp,
    target: Target,
    scope: Scope,
    extensions: S.OptionFromOptionalKey(Extensions).pipe(S.withConstructorDefault(Effect.succeedNone)),
    coverageRef: S.tag("coverage.json"),
    findingsRef: S.tag("findings.json"),
    artifacts: S.Array(Artifact).check(S.isMinLength(2), S.isMaxLength(10000)),
  }).pipe($I.annoteSchema("Scan", { description: "Completed immutable scan with artifact integrity records." }))
) {}

/**
 * Decodes the supported sealed manifest before any artifact path is followed.
 *
 * **Example** (Rejecting an unrelated document)
 * ```ts import.meta.vitest name="Rejecting an unrelated document"
 * import { SecurityManifest } from "@beep/repo-cli/commands/Codex/Security.schemas"
 * import * as S from "effect/Schema"
 * S.is(SecurityManifest)({ documentType: "other" }) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SecurityManifest extends S.Opaque<SecurityManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    documentType: S.tag("codex-security.scan-manifest"),
    schemaVersion: S.tag("1.0"),
    scan: Scan,
  }).pipe($I.annoteSchema("SecurityManifest", { description: "Consumed fields of the sealed scan manifest." }))
) {}

/**
 * Codec from the scanner's lowercase severity to the capitalized packet domain.
 *
 * **Example** (Mapping a scanner severity)
 * ```ts import.meta.vitest name="Mapping a scanner severity"
 * import { SecuritySeverityToPacket } from "@beep/repo-cli/commands/Codex/Security.schemas"
 * SecuritySeverityToPacket.Enum.critical // => "Critical"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SecuritySeverityToPacket = MappedLiteralKit([
  ["critical", "Critical"],
  ["high", "High"],
  ["medium", "Medium"],
  ["low", "Low"],
  ["informational", "Informational"],
]).pipe(
  $I.annoteSchema("SecuritySeverityToPacket", {
    description: "Scanner severity levels paired with the packet severity they capture as.",
  })
);
/**
 * Packet-domain severity decoded from a scanner level.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SecuritySeverityToPacket = typeof SecuritySeverityToPacket.Type;

class Severity extends S.Opaque<Severity, { readonly brand: unique symbol }>()(
  S.Struct({ level: LiteralKit(A.map(SecuritySeverityToPacket.Pairs, ([level]) => level)) }).pipe(
    $I.annoteSchema("Severity", { description: "Severity reported by the scanner, before human triage." })
  )
) {}
class Location extends S.Opaque<Location, { readonly brand: unique symbol }>()(
  S.Struct({ path: ArtifactPath, startLine: S.Int.check(S.isGreaterThan(0)) }).pipe(
    $I.annoteSchema("Location", { description: "Repository-relative source evidence location." })
  )
) {}
class Fingerprints extends S.Opaque<Fingerprints, { readonly brand: unique symbol }>()(
  S.Struct({
    algorithm: S.tag("codex-security/v1"),
    primary: S.String.check(S.isPattern(/^codex-security\/v1:sha256:[a-f0-9]{64}$/)),
  }).pipe($I.annoteSchema("Fingerprints", { description: "Producer's root-cause fingerprint." }))
) {}
class Finding extends S.Opaque<Finding, { readonly brand: unique symbol }>()(
  S.Struct({
    findingId: FindingId,
    occurrenceId: OccurrenceId,
    fingerprints: Fingerprints,
    title: CodexFindingTitle,
    summary: Text,
    severity: Severity,
    locations: S.Array(Location).check(S.isMinLength(1), S.isMaxLength(500)),
    remediation: Text,
  }).pipe(
    $I.annoteSchema("Finding", {
      description: "Finding projection used to construct a private evidence report and public capture metadata.",
    })
  )
) {}

/**
 * Decodes findings while retaining source identities separately from cloud IDs.
 *
 * **Example** (Recognizing an empty result)
 * ```ts import.meta.vitest name="Recognizing an empty result"
 * import { SecurityFindings } from "@beep/repo-cli/commands/Codex/Security.schemas"
 * const result = SecurityFindings.make({ documentType: "codex-security.findings", schemaVersion: "1.0", scanId: "scan-1", findings: [] })
 * result.findings.length // => 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SecurityFindings extends S.Opaque<SecurityFindings, { readonly brand: unique symbol }>()(
  S.Struct({
    documentType: S.tag("codex-security.findings"),
    schemaVersion: S.tag("1.0"),
    scanId: ScanId,
    findings: S.Array(Finding).check(S.isMaxLength(500)),
  }).pipe($I.annoteSchema("SecurityFindings", { description: "Finding capture projection from a sealed local scan." }))
) {}

/**
 * Preserves coverage status; completion never implies complete coverage.
 *
 * **Example** (Rejecting missing coverage)
 * ```ts import.meta.vitest name="Rejecting missing coverage"
 * import { SecurityCoverage } from "@beep/repo-cli/commands/Codex/Security.schemas"
 * import * as S from "effect/Schema"
 * S.is(SecurityCoverage)({}) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SecurityCoverage extends S.Opaque<SecurityCoverage, { readonly brand: unique symbol }>()(
  S.Struct({
    documentType: S.tag("codex-security.coverage"),
    schemaVersion: S.tag("1.0"),
    scanId: ScanId,
    completeness: LiteralKit(["complete", "partial", "unknown"]),
    includePaths: S.Array(S.String),
    excludePaths: S.Array(S.String),
    deferred: S.Array(S.Unknown),
    explicitExclusions: S.Array(S.Unknown),
  }).pipe(
    $I.annoteSchema("SecurityCoverage", { description: "Coverage status and gaps accompanying captured findings." })
  )
) {}

/**
 * Whether a command only rehearses the scan or runs it.
 *
 * **Example** (Recognizing the preflight mode)
 * ```ts import.meta.vitest name="Recognizing the preflight mode"
 * import { SecurityScanMode } from "@beep/repo-cli/commands/Codex/Security.schemas"
 * SecurityScanMode.is.preflight("preflight") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SecurityScanMode = LiteralKit(["preflight", "scan"]).pipe(
  $I.annoteSchema("SecurityScanMode", { description: "Dry-run preflight versus a budgeted scan." })
);
/**
 * @category type-level
 * @since 0.0.0
 */
export type SecurityScanMode = typeof SecurityScanMode.Type;

/**
 * Validated flags accepted by `beep codex security preflight` and `scan`.
 *
 * **Details**
 * The cost ceiling is bounded to 100 USD and the timeout to 120 minutes so a
 * typo cannot authorize an unbounded run.
 *
 * **Example** (Rejecting an unbounded cost)
 * ```ts import.meta.vitest name="Rejecting an unbounded cost"
 * import { SecurityScanOptions } from "@beep/repo-cli/commands/Codex/Security.schemas"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * const decoded = S.decodeUnknownOption(SecurityScanOptions)({ outputDir: "/private/scan", maxCost: 500, timeoutMinutes: 30 })
 * O.isNone(decoded) // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SecurityScanOptions extends S.Opaque<SecurityScanOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    outputDir: S.String,
    maxCost: S.Finite.check(S.isGreaterThan(0), S.isLessThanOrEqualTo(100)),
    timeoutMinutes: S.Int.check(S.isGreaterThan(0), S.isLessThanOrEqualTo(120)),
    target: S.OptionFromOptionalKey(RepoRelativePath).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("SecurityScanOptions", { description: "Bounded operator inputs for a local Security CLI run." })
  )
) {}
