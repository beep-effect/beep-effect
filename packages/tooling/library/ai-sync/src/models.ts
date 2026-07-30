/**
 * Schema-first models for AI agent configuration sync and validation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AiSyncId } from "@beep/identity/packages";
import { Fn, LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { Sha256Hex } from "@beep/schema/Sha256";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $AiSyncId.create("models");

/**
 * V1 agent identifiers.
 *
 * @example
 * ```ts
 * import { AiSyncAgentId } from "@beep/ai-sync"
 * console.log(AiSyncAgentId.Enum.codex)
 * ```
 * @category models
 * @since 0.0.0
 */
export const AiSyncAgentId = LiteralKit([
  "claude-code",
  "codex",
  "grok-build",
  "jetbrains-ai-assistant",
  "junie",
  "mcp",
  "acp",
  "rulesync",
]).pipe(
  $I.annoteSchema("AiSyncAgentId", {
    description: "Agents and cross-vendor primitives tracked by the AI sync source map.",
  })
);

/**
 * Runtime type for {@link AiSyncAgentId}.
 *
 * @example
 * ```ts
 * import type { AiSyncAgentId } from "@beep/ai-sync"
 * const agent: AiSyncAgentId = "codex"
 * console.log(agent)
 * ```
 * @category models
 * @since 0.0.0
 */
export type AiSyncAgentId = typeof AiSyncAgentId.Type;

/**
 * V1 configuration domains.
 *
 * @example
 * ```ts
 * import { AiSyncDomainId } from "@beep/ai-sync"
 * console.log(AiSyncDomainId.Enum["mcp-servers"])
 * ```
 * @category models
 * @since 0.0.0
 */
export const AiSyncDomainId = LiteralKit([
  "skills",
  "rules",
  "commands",
  "hooks",
  "plugins",
  "mcp-servers",
  "config",
  "settings",
  "plugin-manifest",
  "marketplace",
  "protocol",
  "unified-config",
]).pipe(
  $I.annoteSchema("AiSyncDomainId", {
    description: "Configuration domains covered by the V1 schema matrix.",
  })
);

/**
 * Runtime type for {@link AiSyncDomainId}.
 *
 * @example
 * ```ts
 * import type { AiSyncDomainId } from "@beep/ai-sync"
 * const domain: AiSyncDomainId = "skills"
 * console.log(domain)
 * ```
 * @category models
 * @since 0.0.0
 */
export type AiSyncDomainId = typeof AiSyncDomainId.Type;

/**
 * Source evidence tiers.
 *
 * @example
 * ```ts
 * import { AiSyncSourceTier } from "@beep/ai-sync"
 * console.log(AiSyncSourceTier.Enum.tier_1)
 * ```
 * @category models
 * @since 0.0.0
 */
export const AiSyncSourceTier = LiteralKit(["tier_1", "tier_2", "tier_3", "tier_4"]).pipe(
  $I.annoteSchema("AiSyncSourceTier", {
    description: "Evidence tier used to justify each native schema surface.",
  })
);

/**
 * Runtime type for {@link AiSyncSourceTier}.
 *
 * @example
 * ```ts
 * import type { AiSyncSourceTier } from "@beep/ai-sync"
 * const tier: AiSyncSourceTier = "tier_1"
 * console.log(tier)
 * ```
 * @category models
 * @since 0.0.0
 */
export type AiSyncSourceTier = typeof AiSyncSourceTier.Type;

/**
 * Support state for an agent/domain cell.
 *
 * @example
 * ```ts
 * import { AiSyncSupportStatus } from "@beep/ai-sync"
 * console.log(AiSyncSupportStatus.Enum.unknown_schema)
 * ```
 * @category models
 * @since 0.0.0
 */
export const AiSyncSupportStatus = LiteralKit(["supported", "na", "unknown_schema"]).pipe(
  $I.annoteSchema("AiSyncSupportStatus", {
    description: "Whether an agent/domain cell is modeled, unsupported, or intentionally unknown.",
  })
);

/**
 * Runtime type for {@link AiSyncSupportStatus}.
 *
 * @example
 * ```ts
 * import type { AiSyncSupportStatus } from "@beep/ai-sync"
 * const status: AiSyncSupportStatus = "supported"
 * console.log(status)
 * ```
 * @category models
 * @since 0.0.0
 */
export type AiSyncSupportStatus = typeof AiSyncSupportStatus.Type;

/**
 * Drift check strategy for a source.
 *
 * @example
 * ```ts
 * import { AiSyncDriftMechanism } from "@beep/ai-sync"
 * console.log(AiSyncDriftMechanism.Enum.hash)
 * ```
 * @category models
 * @since 0.0.0
 */
export const AiSyncDriftMechanism = LiteralKit([
  "version",
  "hash",
  "version_and_hash",
  "semantic_field_diff",
  "content_hash",
  "release_redirect",
]).pipe(
  $I.annoteSchema("AiSyncDriftMechanism", {
    description: "Mechanism used to detect drift for an upstream schema or documentation source.",
  })
);

/**
 * Runtime type for {@link AiSyncDriftMechanism}.
 *
 * @example
 * ```ts
 * import type { AiSyncDriftMechanism } from "@beep/ai-sync"
 * const mechanism: AiSyncDriftMechanism = "hash"
 * console.log(mechanism)
 * ```
 * @category models
 * @since 0.0.0
 */
export type AiSyncDriftMechanism = typeof AiSyncDriftMechanism.Type;

/**
 * Transform proof status.
 *
 * @example
 * ```ts
 * import { AiSyncTransformStatus } from "@beep/ai-sync"
 * console.log(AiSyncTransformStatus.Enum.lossless)
 * ```
 * @category models
 * @since 0.0.0
 */
export const AiSyncTransformStatus = LiteralKit(["lossless", "lossy", "declined"]).pipe(
  $I.annoteSchema("AiSyncTransformStatus", {
    description: "Whether a transform is proven lossless, proven lossy, or evidence-declined.",
  })
);

/**
 * Runtime type for {@link AiSyncTransformStatus}.
 *
 * @example
 * ```ts
 * import type { AiSyncTransformStatus } from "@beep/ai-sync"
 * const status: AiSyncTransformStatus = "lossless"
 * console.log(status)
 * ```
 * @category models
 * @since 0.0.0
 */
export type AiSyncTransformStatus = typeof AiSyncTransformStatus.Type;

/**
 * Stable source-map identifier.
 *
 * @example
 * ```ts
 * import { AiSyncSourceId } from "@beep/ai-sync"
 *
 * const sourceId = AiSyncSourceId.make("codex-config")
 * console.log(sourceId)
 * ```
 * @category models
 * @since 0.0.0
 */
export const AiSyncSourceId = S.String.check(
  S.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "AI sync source ids must be lowercase kebab-case tokens.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.constant("codex-config"),
  })
  .pipe(
    S.brand("AiSyncSourceId"),
    $I.annoteSchema("AiSyncSourceId", {
      description: "Lowercase kebab-case identifier for an upstream AI sync source.",
    })
  );

/**
 * Runtime type for {@link AiSyncSourceId}.
 *
 * @example
 * ```ts
 * import { AiSyncSourceId } from "@beep/ai-sync"
 * import type { AiSyncSourceId as AiSyncSourceIdType } from "@beep/ai-sync"
 *
 * const sourceId: AiSyncSourceIdType = AiSyncSourceId.make("codex-config")
 * console.log(sourceId)
 * ```
 * @category models
 * @since 0.0.0
 */
export type AiSyncSourceId = typeof AiSyncSourceId.Type;

/**
 * HTTP(S) source URL.
 *
 * @example
 * ```ts
 * import { AiSyncSourceUrl } from "@beep/ai-sync"
 *
 * const url = AiSyncSourceUrl.make("https://example.com/schema.json")
 * console.log(url.startsWith("https://"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const AiSyncSourceUrl = S.String.check(
  S.isPattern(/^https?:\/\/\S+$/, {
    message: "AI sync source URLs must be absolute http(s) URLs without whitespace.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.constant("https://example.com/schema.json"),
  })
  .pipe(
    S.brand("AiSyncSourceUrl"),
    $I.annoteSchema("AiSyncSourceUrl", {
      description: "Absolute HTTP(S) URL for a schema or documentation source.",
    })
  );

/**
 * Runtime type for {@link AiSyncSourceUrl}.
 *
 * @example
 * ```ts
 * import { AiSyncSourceUrl } from "@beep/ai-sync"
 * import type { AiSyncSourceUrl as AiSyncSourceUrlType } from "@beep/ai-sync"
 *
 * const url: AiSyncSourceUrlType = AiSyncSourceUrl.make("https://example.com/schema.json")
 * console.log(url)
 * ```
 * @category models
 * @since 0.0.0
 */
export type AiSyncSourceUrl = typeof AiSyncSourceUrl.Type;

/**
 * Upstream release or schema version pin.
 *
 * @example
 * ```ts
 * import { AiSyncVersionPin } from "@beep/ai-sync"
 *
 * const pin = AiSyncVersionPin.make("rust-v0.133.0")
 * console.log(pin)
 * ```
 * @category models
 * @since 0.0.0
 */
export const AiSyncVersionPin = S.NonEmptyString.pipe(
  S.brand("AiSyncVersionPin"),
  $I.annoteSchema("AiSyncVersionPin", {
    description: "Non-empty upstream version or release pin for a source.",
  })
);

/**
 * Runtime type for {@link AiSyncVersionPin}.
 *
 * @example
 * ```ts
 * import { AiSyncVersionPin } from "@beep/ai-sync"
 * import type { AiSyncVersionPin as AiSyncVersionPinType } from "@beep/ai-sync"
 *
 * const pin: AiSyncVersionPinType = AiSyncVersionPin.make("2025-11-25")
 * console.log(pin)
 * ```
 * @category models
 * @since 0.0.0
 */
export type AiSyncVersionPin = typeof AiSyncVersionPin.Type;

/**
 * Source content SHA-256 hash.
 *
 * @example
 * ```ts
 * import { AiSyncContentHash } from "@beep/ai-sync"
 *
 * const hash = AiSyncContentHash.make(
 *   "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * console.log(hash.length)
 * ```
 * @category models
 * @since 0.0.0
 */
export const AiSyncContentHash = Sha256Hex.pipe(
  $I.annoteSchema("AiSyncContentHash", {
    description: "Canonical lowercase SHA-256 digest for upstream source content.",
  })
);

/**
 * Runtime type for {@link AiSyncContentHash}.
 *
 * @example
 * ```ts
 * import { AiSyncContentHash } from "@beep/ai-sync"
 * import type { AiSyncContentHash as AiSyncContentHashType } from "@beep/ai-sync"
 *
 * const hash: AiSyncContentHashType = AiSyncContentHash.make(
 *   "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * console.log(hash)
 * ```
 * @category models
 * @since 0.0.0
 */
export type AiSyncContentHash = typeof AiSyncContentHash.Type;

class AiSyncSourceMetadataIdentity extends S.Class<AiSyncSourceMetadataIdentity>($I`AiSyncSourceMetadataIdentity`)(
  {
    id: AiSyncSourceId,
    agent: AiSyncAgentId,
    domain: AiSyncDomainId,
    tier: AiSyncSourceTier,
    url: AiSyncSourceUrl,
    versionPin: S.Option(AiSyncVersionPin),
    isOfficial: S.Boolean,
    driftMechanism: AiSyncDriftMechanism,
  },
  $I.annote("AiSyncSourceMetadataIdentity", {
    description: "Comparable source identity fields excluding the generated content hash.",
  })
) {}

/**
 * Metadata for one upstream source.
 *
 * @example
 * ```ts
 * import { AiSyncSourceId, AiSyncSourceMetadata, AiSyncSourceUrl, AiSyncVersionPin } from "@beep/ai-sync"
 * import * as O from "effect/Option"
 * const source = AiSyncSourceMetadata.make({
 *   id: AiSyncSourceId.make("codex-config"),
 *   agent: "codex",
 *   domain: "config",
 *   tier: "tier_1",
 *   url: AiSyncSourceUrl.make("https://example.com/schema.json"),
 *   versionPin: O.some(AiSyncVersionPin.make("rust-v0.133.0")),
 *   isOfficial: true,
 *   driftMechanism: "hash"
 * })
 * console.log(source.id)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AiSyncSourceMetadata extends S.Class<AiSyncSourceMetadata>($I`AiSyncSourceMetadata`)(
  {
    id: AiSyncSourceId,
    agent: AiSyncAgentId,
    domain: AiSyncDomainId,
    tier: AiSyncSourceTier,
    url: AiSyncSourceUrl,
    versionPin: AiSyncVersionPin.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    contentHash: AiSyncContentHash.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    isOfficial: S.Boolean,
    driftMechanism: AiSyncDriftMechanism,
  },
  $I.annote("AiSyncSourceMetadata", {
    description: "Source tier, pin, and drift metadata for one upstream evidence item.",
  })
) {
  static readonly decodeArrayEffect = S.decodeUnknownEffect(S.Array(AiSyncSourceMetadata));
  static readonly identityEquivalence = SchemaUtils.toEquivalence(AiSyncSourceMetadataIdentity);

  static readonly toIdentity = (source: AiSyncSourceMetadata): AiSyncSourceMetadataIdentity =>
    AiSyncSourceMetadataIdentity.make({
      id: source.id,
      agent: source.agent,
      domain: source.domain,
      tier: source.tier,
      url: source.url,
      versionPin: source.versionPin,
      isOfficial: source.isOfficial,
      driftMechanism: source.driftMechanism,
    });

  static readonly hasSameIdentity: {
    (self: AiSyncSourceMetadata, that: AiSyncSourceMetadata): boolean;
    (that: AiSyncSourceMetadata): (self: AiSyncSourceMetadata) => boolean;
  } = dual(2, (self: AiSyncSourceMetadata, that: AiSyncSourceMetadata): boolean =>
    AiSyncSourceMetadata.identityEquivalence(
      AiSyncSourceMetadata.toIdentity(self),
      AiSyncSourceMetadata.toIdentity(that)
    )
  );
}

/**
 * Support matrix cell.
 *
 * @example
 * ```ts
 * import { AiSyncSchemaCell } from "@beep/ai-sync"
 * const cell = AiSyncSchemaCell.make({
 *   agent: "codex",
 *   domain: "config",
 *   status: "supported",
 *   rationale: "Codex publishes a JSON schema."
 * })
 * console.log(cell.status)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AiSyncSchemaCell extends S.Class<AiSyncSchemaCell>($I`AiSyncSchemaCell`)(
  {
    agent: AiSyncAgentId,
    domain: AiSyncDomainId,
    status: AiSyncSupportStatus,
    sourceId: AiSyncSourceId.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    rationale: S.String,
  },
  $I.annote("AiSyncSchemaCell", {
    description: "Agent/domain support status and rationale.",
  })
) {}

/**
 * Drift difference for one upstream source.
 *
 * @example
 * ```ts
 * import { AiSyncContentHash, AiSyncDriftFinding, AiSyncSourceId } from "@beep/ai-sync"
 * import * as O from "effect/Option"
 * const finding = AiSyncDriftFinding.make({
 *   sourceId: AiSyncSourceId.make("codex-config"),
 *   expectedHash: O.none(),
 *   actualHash: AiSyncContentHash.make(
 *     "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *   ),
 *   message: "Source moved"
 * })
 * console.log(finding.sourceId)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AiSyncDriftFinding extends S.Class<AiSyncDriftFinding>($I`AiSyncDriftFinding`)(
  {
    sourceId: AiSyncSourceId,
    expectedHash: AiSyncContentHash.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    actualHash: AiSyncContentHash,
    message: S.String,
  },
  $I.annote("AiSyncDriftFinding", {
    description: "Structured drift finding for a source whose current content differs from the committed pin.",
  })
) {}

/**
 * Validated repo-local config path.
 *
 * @example
 * ```ts
 * import { AiSyncValidatedConfigPath } from "@beep/ai-sync"
 *
 * console.log(AiSyncValidatedConfigPath.Enum[".codex/config.toml"])
 * ```
 * @category validation
 * @since 0.0.0
 */
export const AiSyncValidatedConfigPath = LiteralKit([
  ".codex/config.toml",
  ".mcp.json",
  ".claude/settings.json",
  "AGENTS.md",
  "CLAUDE.md",
]).pipe(
  $I.annoteSchema("AiSyncValidatedConfigPath", {
    description: "Repo-local paths with first-party V1 AI sync validation coverage.",
  })
);

/**
 * Runtime type for {@link AiSyncValidatedConfigPath}.
 *
 * @example
 * ```ts
 * import type { AiSyncValidatedConfigPath } from "@beep/ai-sync"
 *
 * const path: AiSyncValidatedConfigPath = ".codex/config.toml"
 * console.log(path)
 * ```
 * @category validation
 * @since 0.0.0
 */
export type AiSyncValidatedConfigPath = typeof AiSyncValidatedConfigPath.Type;

/**
 * Validation schema identifiers.
 *
 * @example
 * ```ts
 * import { AiSyncValidationSchemaId } from "@beep/ai-sync"
 *
 * console.log(AiSyncValidationSchemaId.Enum["codex-config"])
 * ```
 * @category validation
 * @since 0.0.0
 */
export const AiSyncValidationSchemaId = LiteralKit([
  "codex-config",
  "claude-mcp-json",
  "claude-settings",
  "agent-instruction-document",
]).pipe(
  $I.annoteSchema("AiSyncValidationSchemaId", {
    description: "Native V1 schemas available to the repo-local config validator.",
  })
);

/**
 * Runtime type for {@link AiSyncValidationSchemaId}.
 *
 * @example
 * ```ts
 * import type { AiSyncValidationSchemaId } from "@beep/ai-sync"
 *
 * const schemaId: AiSyncValidationSchemaId = "codex-config"
 * console.log(schemaId)
 * ```
 * @category validation
 * @since 0.0.0
 */
export type AiSyncValidationSchemaId = typeof AiSyncValidationSchemaId.Type;

/**
 * Input for the repo config validation contract.
 *
 * @example
 * ```ts
 * import { ValidateRepoConfigInput } from "@beep/ai-sync"
 *
 * const input = ValidateRepoConfigInput.make({
 *   repoRoot: "/workspace/repo",
 *   config: ".codex/config.toml"
 * })
 * console.log(input.config)
 * ```
 * @category validation
 * @since 0.0.0
 */
export class ValidateRepoConfigInput extends S.Class<ValidateRepoConfigInput>($I`ValidateRepoConfigInput`)(
  {
    repoRoot: S.NonEmptyString,
    config: S.NonEmptyString,
  },
  $I.annote("ValidateRepoConfigInput", {
    description: "Input accepted by the schema contract for repo-local AI sync config validation.",
  })
) {}

/**
 * Drift check report.
 *
 * @example
 * ```ts
 * import { AiSyncDriftReport } from "@beep/ai-sync"
 * const report = AiSyncDriftReport.make({ mode: "local", findings: [] })
 * console.log(report.findings.length)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AiSyncDriftReport extends S.Class<AiSyncDriftReport>($I`AiSyncDriftReport`)(
  {
    mode: LiteralKit(["local", "strict", "refresh"]),
    findings: S.Array(AiSyncDriftFinding),
  },
  $I.annote("AiSyncDriftReport", {
    description: "Result of a local, strict, or refresh-oriented drift check.",
  })
) {}

/**
 * Transform proof metadata.
 *
 * @example
 * ```ts
 * import { AiSyncTransformEvidence } from "@beep/ai-sync"
 * const evidence = AiSyncTransformEvidence.make({
 *   id: "codex-mcp-to-claude-mcp",
 *   status: "lossless",
 *   sourceAgent: "codex",
 *   targetAgent: "claude-code",
 *   domain: "mcp-servers",
 *   rationale: "Both shapes preserve command, args, env, and url."
 * })
 * console.log(evidence.status)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AiSyncTransformEvidence extends S.Class<AiSyncTransformEvidence>($I`AiSyncTransformEvidence`)(
  {
    id: S.String,
    status: AiSyncTransformStatus,
    sourceAgent: AiSyncAgentId,
    targetAgent: AiSyncAgentId,
    domain: AiSyncDomainId,
    rationale: S.String,
  },
  $I.annote("AiSyncTransformEvidence", {
    description: "Evidence ledger entry for a V1 transform candidate.",
  })
) {}

/**
 * Validation success record for a repo-local config file.
 *
 * @example
 * ```ts
 * import { AiSyncValidationResult } from "@beep/ai-sync"
 * const result = AiSyncValidationResult.make({
 *   relativePath: ".codex/config.toml",
 *   schemaId: "codex-config"
 * })
 * console.log(result.relativePath)
 * ```
 * @category validation
 * @since 0.0.0
 */
export class AiSyncValidationResult extends S.Class<AiSyncValidationResult>($I`AiSyncValidationResult`)(
  {
    relativePath: AiSyncValidatedConfigPath,
    schemaId: AiSyncValidationSchemaId,
  },
  $I.annote("AiSyncValidationResult", {
    description: "Successful validation result for a repo-local agent config file.",
  })
) {}

/**
 * Typed AI sync operational error.
 *
 * @example
 * ```ts
 * import { AiSyncError } from "@beep/ai-sync"
 * const error = AiSyncError.make({ message: "Validation failed" })
 * console.log(error._tag)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class AiSyncError extends TaggedErrorClass<AiSyncError>($I`AiSyncError`)(
  "AiSyncError",
  {
    message: S.String,
    sourceId: AiSyncSourceId.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    relativePath: S.NonEmptyString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    schemaId: AiSyncValidationSchemaId.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    cause: S.Defect({ includeStack: true }).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("AiSyncError", {
    description: "Typed operational error for AI sync generation, drift checks, transforms, and validation.",
  })
) {}

/**
 * Schema contract for {@link validateRepoConfig}.
 *
 * @example
 * ```ts
 * import { ValidateRepoConfig } from "@beep/ai-sync"
 *
 * console.log(ValidateRepoConfig.inputSchema.ast)
 * ```
 * @category validation
 * @since 0.0.0
 */
export const ValidateRepoConfig = Fn({
  input: ValidateRepoConfigInput,
  output: AiSyncValidationResult,
  error: AiSyncError,
}).pipe(
  $I.annoteSchema("ValidateRepoConfig", {
    description: "Function schema for repo-local AI sync config validation.",
  })
);

/**
 * Runtime type for {@link ValidateRepoConfig}.
 *
 * @example
 * ```ts
 * import { AiSyncValidationResult } from "@beep/ai-sync"
 * import type { ValidateRepoConfig } from "@beep/ai-sync"
 *
 * const validate: ValidateRepoConfig = () =>
 *   AiSyncValidationResult.make({ relativePath: ".codex/config.toml", schemaId: "codex-config" })
 * console.log(validate)
 * ```
 * @category validation
 * @since 0.0.0
 */
export type ValidateRepoConfig = typeof ValidateRepoConfig.Type;
