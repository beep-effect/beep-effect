/**
 * Canonical identity composers for every `@beep/*` workspace namespace.
 *
 * Each export is a pre-built {@link Identity.IdentityComposer} scoped to a
 * specific workspace package. Use these to derive schema identifiers,
 * error tags, and service keys without manually calling `make`.
 *
 * @example
 * ```ts
 * import { $I, $SchemaId } from "@beep/identity/packages"
 *
 * const serviceId = $SchemaId`TenantService`
 * const customId = $I.create("custom").make("CustomService")
 * console.log(serviceId)
 * console.log(customId)
 * ```
 *
 * @since 0.0.0
 * @packageDocumentation
 */
import * as Identity from "./Id.ts";
// import { Struct, pipe } from "effect";
// import * as A from "effect/Array";
/**
 * Root identity composer for the `@beep` namespace.
 *
 * All other package composers are derived from this root via `compose`.
 *
 * @example
 * ```ts
 * import { $I } from "@beep/identity/packages"
 *
 * const id = $I.make("CustomSegment")
 * console.log(id)// "@beep/CustomSegment"
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $I = Identity.make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" }).$BeepId;

const generatedComposers = $I.compose(
  // IaC Infra Package
  "infra",

  // Foundation Packages
  "chalk",
  "colors",
  "data",
  "identity",
  "langextract",
  "md",
  "nlp",
  "nlp-processing",
  "observability",
  "ontology",
  "provenance",
  "rdf",
  "schema",
  "semantic-web",
  "types",
  "ui",
  "utils",

  // Professional runtime packages
  "agents-domain",
  "agents-use-cases",
  "agents-server",
  "agents-client",
  "epistemic-domain",
  "epistemic-use-cases",
  "law-practice-domain",
  "law-practice-use-cases",
  "law-practice-server",
  "documents-domain",
  "documents-use-cases",
  "documents-server",
  "professional-desktop",
  "workspace-domain",

  // Repository Tooling Packages
  "repo-ai-metrics",
  "repo-cli",
  "repo-configs",
  "repo-docgen",
  "repo-utils",
  "test-utils",

  // Internal Packages
  "db-admin",

  // Shared Kernel Slice Packages
  "shared-domain",
  "shared-tables",

  "oip-web",
  "drizzle",
  "duckdb",
  "face-detection",
  "ffmpeg",
  "postgres",
  "anthropic",
  "scratchpad",
  "venice-ai",
  "xai",
  "acp",
  "openai-compat",
  "workspace-tables",
  "workspace-use-cases",
  "workspace-server",
  "architecture-lab-domain",
  "architecture-lab-use-cases",
  "architecture-lab-config",
  "architecture-lab-server",
  "architecture-lab-tables",
  "architecture-lab-client",
  "architecture-lab-ui",
  "architecture-lab-proof",
  "runpod",
  "onepassword-cli",
  "discord",
  "ai-provider-cli",
  "sanity",
  "hubspot",
  "phoenix",
  "ai-sync",
  "nlp-mcp",
  "rdf-canonize",
  "wink",
  "file-processing",
  "tika",
  "libpff",
  "box",
  "firecrawl",
  "uspto",
  "lexical-schema",
  "editor",
  "html",
  "pandoc-ast",
  "form",
  "pglite",
  "m365",
  "m365-mcp",
  "govinfo",
  "federal-register",
  "ecfr",
  "dol",
  "courtlistener",
  "api-transport",
  "mcp-kit",
  "uspto-mcp",
  "pacer",
  "fc-runs"
);

const composers = {
  ...generatedComposers,
  $LangExtractId: generatedComposers.$LangextractId,
};

// --- foundation ---

/**
 * Identity composer for the `@beep/data` package.
 *
 * @example
 * ```ts
 * import { $DataId } from "@beep/identity"
 *
 * const id = $DataId.make("Calendar")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $DataId = composers.$DataId;

/**
 * Identity composer for the `@beep/identity` package.
 *
 * @example
 * ```ts
 * import { $IdentityId } from "@beep/identity"
 *
 * const id = $IdentityId.make("Composer")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $IdentityId = composers.$IdentityId;

/**
 * Identity composer for the `@beep/schema` package.
 *
 * @example
 * ```ts
 * import { $SchemaId } from "@beep/identity"
 *
 * const id = $SchemaId.make("EntityId")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $SchemaId = composers.$SchemaId;

/**
 * Identity composer for the `@beep/provenance` package.
 *
 * @example
 * ```ts
 * import { $ProvenanceId } from "@beep/identity"
 *
 * const id = $ProvenanceId.make("TextAnchor")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $ProvenanceId: Identity.IdentityComposer<"@beep/provenance"> = composers.$ProvenanceId;

/**
 * Identity composer for the `@beep/rdf` package.
 *
 * @example
 * ```ts
 * import { $RdfId } from "@beep/identity"
 *
 * const id = $RdfId.make("Iri")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $RdfId: Identity.IdentityComposer<"@beep/rdf"> = composers.$RdfId;

/**
 * Identity composer for the `@beep/ontology` package.
 *
 * @example
 * ```ts
 * import { $OntologyId } from "@beep/identity/packages"
 *
 * const id = $OntologyId.make("Ontology")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $OntologyId: Identity.IdentityComposer<"@beep/ontology"> = composers.$OntologyId;

/**
 * Identity composer for the `@beep/types` package.
 *
 * @example
 * ```ts
 * import { $TypesId } from "@beep/identity"
 *
 * const id = $TypesId.make("NonEmpty")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $TypesId = composers.$TypesId;

/**
 * Identity composer for the `@beep/utils` package.
 *
 * @example
 * ```ts
 * import { $UtilsId } from "@beep/identity"
 *
 * const id = $UtilsId.make("Retry")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $UtilsId = composers.$UtilsId;

// --- ui ---

/**
 * Identity composer for the `@beep/ui` package.
 *
 * @example
 * ```ts
 * import { $UiId } from "@beep/identity"
 *
 * const id = $UiId.make("Button") // initial type: `Identity.IdentityComposer<"@beep/ui/Button">`
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $UiId = composers.$UiId;

// --- tooling ---

/**
 * Identity composer for the `@beep/repo-ai-metrics` package.
 *
 * @example
 * ```ts
 * import { $RepoAiMetricsId } from "@beep/identity"
 *
 * const id = $RepoAiMetricsId.make("AgentTask")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $RepoAiMetricsId = composers.$RepoAiMetricsId;

/**
 * Identity composer for the `@beep/repo-cli` package.
 *
 * @example
 * ```ts
 * import { $RepoCliId } from "@beep/identity"
 *
 * const id = $RepoCliId.make("Command")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $RepoCliId = composers.$RepoCliId;

/**
 * Identity composer for the `@beep/repo-configs` package.
 *
 * @example
 * ```ts
 * import { $RepoConfigsId } from "@beep/identity"
 *
 * const id = $RepoConfigsId.make("Command")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $RepoConfigsId = composers.$RepoConfigsId;

/**
 * Identity composer for the `@beep/repo-utils` package.
 *
 * @example
 * ```ts
 * import { $RepoUtilsId } from "@beep/identity"
 *
 * const id = $RepoUtilsId.make("FileTree")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $RepoUtilsId = composers.$RepoUtilsId;

/**
 * Identity composer for the `@beep/test-utils` package.
 *
 * @example
 * ```ts
 * import { $TestUtilsId } from "@beep/identity"
 *
 * const id = $TestUtilsId.make("Fixture")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $TestUtilsId = composers.$TestUtilsId;

// --- shared ---

/**
 * Identity composer for the `@beep/shared-domain` package.
 *
 * @example
 * ```ts
 * import { $SharedDomainId } from "@beep/identity"
 *
 * const id = $SharedDomainId.make("TenantId")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $SharedDomainId = composers.$SharedDomainId;

/**
 * Identity composer for the `@beep/shared-tables` package.
 *
 * @example
 * ```ts
 * import { $SharedTablesId } from "@beep/identity"
 *
 * const id = $SharedTablesId.make("AuditColumns")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $SharedTablesId = composers.$SharedTablesId;

/**
 * Identity composer for the `@beep/semantic-web` package.
 *
 * @example
 * ```ts
 * import { $SemanticWebId } from "@beep/identity"
 *
 * const id = $SemanticWebId.make("Triple")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $SemanticWebId: Identity.IdentityComposer<"@beep/semantic-web"> = composers.$SemanticWebId;

/**
 * Identity composer for the `@beep/nlp` package.
 *
 * @example
 * ```ts
 * import { $NlpId } from "@beep/identity"
 *
 * const id = $NlpId.make("Tokenizer")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $NlpId: Identity.IdentityComposer<"@beep/nlp"> = composers.$NlpId;

/**
 * Identity composer for the `@beep/nlp-processing` package.
 *
 * @example
 * ```ts
 * import { $NlpProcessingId } from "@beep/identity/packages"
 *
 * const id = $NlpProcessingId.make("Tokenizer")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $NlpProcessingId: Identity.IdentityComposer<"@beep/nlp-processing"> = composers.$NlpProcessingId;

/**
 * Identity composer for the `@beep/langextract` package.
 *
 * @example
 * ```ts
 * import { $LangExtractId } from "@beep/identity"
 *
 * const id = $LangExtractId.make("Extraction")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $LangExtractId: Identity.IdentityComposer<"@beep/langextract"> = composers.$LangExtractId;

/**
 * Identity composer for the `@beep/observability` package.
 *
 * @example
 * ```ts
 * import { $ObservabilityId } from "@beep/identity"
 *
 * const id = $ObservabilityId.make("Tracer")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $ObservabilityId: Identity.IdentityComposer<"@beep/observability"> = composers.$ObservabilityId;

/**
 * Identity composer for the `@beep/colors` package.
 *
 * @example
 * ```ts
 * import { $ColorsId } from "@beep/identity"
 *
 * const id = $ColorsId.make("Palette")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $ColorsId: Identity.IdentityComposer<"@beep/colors"> = composers.$ColorsId;

/**
 * Identity composer for the `@beep/chalk` package.
 *
 * @example
 * ```ts
 * import { $ChalkId } from "@beep/identity"
 *
 * const id = $ChalkId.make("Formatter")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $ChalkId: Identity.IdentityComposer<"@beep/chalk"> = composers.$ChalkId;

/**
 * Identity composer for the `@beep/repo-docgen` package.
 *
 * @example
 * ```ts
 * import { $RepoDocgenId } from "@beep/identity"
 *
 * const id = $RepoDocgenId.make("Generator")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $RepoDocgenId: Identity.IdentityComposer<"@beep/repo-docgen"> = composers.$RepoDocgenId;

/**
 * Identity composer for the `@beep/infra` package.
 *
 * @example
 * ```ts
 * import { $InfraId } from "@beep/identity"
 *
 * const id = $InfraId.make("Deploy")
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $InfraId: Identity.IdentityComposer<"@beep/infra"> = composers.$InfraId;

// --- p3 professional runtime proof ---

/**
 * Identity composer for the `@beep/workspace-domain` package.
 *
 * @example
 * ```ts
 * import { $WorkspaceDomainId } from "@beep/identity"
 *
 * const id = $WorkspaceDomainId.make("ContextPacket")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $WorkspaceDomainId: Identity.IdentityComposer<"@beep/workspace-domain"> = composers.$WorkspaceDomainId;

/**
 * Identity composer for the `@beep/epistemic-domain` package.
 *
 * @example
 * ```ts
 * import { $EpistemicDomainId } from "@beep/identity"
 *
 * const id = $EpistemicDomainId.make("Evidence")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EpistemicDomainId: Identity.IdentityComposer<"@beep/epistemic-domain"> = composers.$EpistemicDomainId;

/**
 * Identity composer for the `@beep/epistemic-use-cases` package.
 *
 * @example
 * ```ts
 * import { $EpistemicUseCasesId } from "@beep/identity"
 *
 * const id = $EpistemicUseCasesId.make("ClaimGate")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EpistemicUseCasesId: Identity.IdentityComposer<"@beep/epistemic-use-cases"> =
  composers.$EpistemicUseCasesId;

/**
 * Identity composer for the `@beep/agents-domain` package.
 *
 * @example
 * ```ts
 * import { $AgentsDomainId } from "@beep/identity"
 *
 * const id = $AgentsDomainId.make("Agent")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AgentsDomainId: Identity.IdentityComposer<"@beep/agents-domain"> = composers.$AgentsDomainId;

/**
 * Identity composer for the `@beep/agents-server` package.
 *
 * @example
 * ```ts
 * import { $AgentsServerId } from "@beep/identity"
 *
 * const id = $AgentsServerId.make("Agent")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AgentsServerId: Identity.IdentityComposer<"@beep/agents-server"> = composers.$AgentsServerId;

/**
 * Identity composer for the `@beep/agents-use-cases` package.
 *
 * @example
 * ```ts
 * import { $AgentsUseCasesId } from "@beep/identity"
 *
 * const id = $AgentsUseCasesId.make("RuntimeScope")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AgentsUseCasesId: Identity.IdentityComposer<"@beep/agents-use-cases"> = composers.$AgentsUseCasesId;

/**
 * Identity composer for the `@beep/agents-client` package.
 *
 * @example
 * ```ts
 * import { $AgentsClientId } from "@beep/identity"
 *
 * const id = $AgentsClientId.make("StreamingTurn")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AgentsClientId: Identity.IdentityComposer<"@beep/agents-client"> = composers.$AgentsClientId;

/**
 * Identity composer for the `@beep/law-practice-domain` package.
 *
 * @example
 * ```ts
 * import { $LawPracticeDomainId } from "@beep/identity"
 *
 * const id = $LawPracticeDomainId.make("Matter")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LawPracticeDomainId: Identity.IdentityComposer<"@beep/law-practice-domain"> =
  composers.$LawPracticeDomainId;

/**
 * Identity composer for the `@beep/law-practice-use-cases` package.
 *
 * @example
 * ```ts
 * import { $LawPracticeUseCasesId } from "@beep/identity"
 *
 * const id = $LawPracticeUseCasesId.make("OfficeActionReview")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LawPracticeUseCasesId: Identity.IdentityComposer<"@beep/law-practice-use-cases"> =
  composers.$LawPracticeUseCasesId;

/**
 * Identity composer for the `@beep/law-practice-server` package.
 *
 * @example
 * ```ts
 * import { $LawPracticeServerId } from "@beep/identity"
 *
 * const id = $LawPracticeServerId.make("LawPracticeServerLive")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LawPracticeServerId: Identity.IdentityComposer<"@beep/law-practice-server"> =
  composers.$LawPracticeServerId;

/**
 * Identity composer for the `@beep/professional-desktop` package.
 *
 * @example
 * ```ts
 * import { $ProfessionalDesktopId } from "@beep/identity"
 *
 * const id = $ProfessionalDesktopId.make("Workbench")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ProfessionalDesktopId: Identity.IdentityComposer<"@beep/professional-desktop"> =
  composers.$ProfessionalDesktopId;

/**
 * RepoPkgs - export object containing all package IdentityComposer's
 *
 * @example
 * ```ts
 * import { RepoPkgs } from "@beep/identity/packages"
 *
 * console.log(RepoPkgs)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const RepoPkgs = composers;

/**
 * $md id export.
 *
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { $MdId } from "@beep/identity/packages"
 *
 * console.log($MdId)
 * ```
 *
 * @category configuration
 */
export const $MdId: Identity.IdentityComposer<"@beep/md"> = composers.$MdId;

/**
 * $oip web id export.
 *
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { $OipWebId } from "@beep/identity/packages"
 *
 * console.log($OipWebId)
 * ```
 *
 * @category configuration
 */
export const $OipWebId: Identity.IdentityComposer<"@beep/oip-web"> = composers.$OipWebId;

/**
 * $drizzle id export.
 *
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { $DrizzleId } from "@beep/identity/packages"
 *
 * console.log($DrizzleId)
 * ```
 *
 * @category configuration
 */
export const $DrizzleId: Identity.IdentityComposer<"@beep/drizzle"> = composers.$DrizzleId;

/**
 * $duckdb id export.
 *
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { $DuckdbId } from "@beep/identity/packages"
 *
 * console.log($DuckdbId)
 * ```
 *
 * @category configuration
 */
export const $DuckdbId: Identity.IdentityComposer<"@beep/duckdb"> = composers.$DuckdbId;

/**
 * $face detection id export.
 *
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { $FaceDetectionId } from "@beep/identity/packages"
 *
 * console.log($FaceDetectionId)
 * ```
 *
 * @category configuration
 */
export const $FaceDetectionId: Identity.IdentityComposer<"@beep/face-detection"> = composers.$FaceDetectionId;

/**
 * $ffmpeg id export.
 *
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { $FfmpegId } from "@beep/identity/packages"
 *
 * console.log($FfmpegId)
 * ```
 *
 * @category configuration
 */
export const $FfmpegId: Identity.IdentityComposer<"@beep/ffmpeg"> = composers.$FfmpegId;

/**
 * $postgres id export.
 *
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { $PostgresId } from "@beep/identity/packages"
 *
 * console.log($PostgresId)
 * ```
 *
 * @category configuration
 */
export const $PostgresId: Identity.IdentityComposer<"@beep/postgres"> = composers.$PostgresId;

/**
 * Identity composer for `@beep/anthropic`.
 *
 * @example
 * ```ts
 * import { $AnthropicId } from "@beep/identity"
 *
 * const id = $AnthropicId.make("Anthropic")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $AnthropicId: Identity.IdentityComposer<"@beep/anthropic"> = composers.$AnthropicId;

/**
 * $venice ai id export.
 *
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { $VeniceAiId } from "@beep/identity/packages"
 *
 * console.log($VeniceAiId)
 * ```
 *
 * @category configuration
 */
export const $VeniceAiId: Identity.IdentityComposer<"@beep/venice-ai"> = composers.$VeniceAiId;

/**
 * $xai id export.
 *
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { $XaiId } from "@beep/identity/packages"
 *
 * console.log($XaiId)
 * ```
 *
 * @category configuration
 */
export const $XaiId: Identity.IdentityComposer<"@beep/xai"> = composers.$XaiId;

/**
 * Identity composer for `@beep/acp`.
 *
 * @example
 * ```ts
 * import { $AcpId } from "@beep/identity"
 *
 * const id = $AcpId.make("AcpClient")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $AcpId: Identity.IdentityComposer<"@beep/acp"> = composers.$AcpId;

/**
 * Identity composer for `@beep/openai-compat`.
 *
 * @example
 * ```ts
 * import { $OpenaiCompatId } from "@beep/identity"
 *
 * const id = $OpenaiCompatId.make("LanguageModel")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $OpenaiCompatId: Identity.IdentityComposer<"@beep/openai-compat"> = composers.$OpenaiCompatId;

/**
 * Identity composer for `@beep/workspace-tables`.
 *
 * @example
 * ```ts
 * import { $WorkspaceTablesId } from "@beep/identity"
 *
 * const id = $WorkspaceTablesId.make("WorkspaceTable")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $WorkspaceTablesId: Identity.IdentityComposer<"@beep/workspace-tables"> = composers.$WorkspaceTablesId;

/**
 * Identity composer for `@beep/workspace-use-cases`.
 *
 * @example
 * ```ts
 * import { $WorkspaceUseCasesId } from "@beep/identity"
 *
 * const id = $WorkspaceUseCasesId.make("ThreadStore")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $WorkspaceUseCasesId: Identity.IdentityComposer<"@beep/workspace-use-cases"> =
  composers.$WorkspaceUseCasesId;

/**
 * Identity composer for `@beep/workspace-server`.
 *
 * @example
 * ```ts
 * import { $WorkspaceServerId } from "@beep/identity"
 *
 * const id = $WorkspaceServerId.make("ThreadStoreLive")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $WorkspaceServerId: Identity.IdentityComposer<"@beep/workspace-server"> = composers.$WorkspaceServerId;

/**
 * Identity composer for `@beep/documents-domain`.
 *
 * @example
 * ```ts
 * import { $DocumentsDomainId } from "@beep/identity"
 *
 * const id = $DocumentsDomainId.make("LegalDocumentTaxonomy")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $DocumentsDomainId: Identity.IdentityComposer<"@beep/documents-domain"> = composers.$DocumentsDomainId;

/**
 * Identity composer for `@beep/documents-use-cases`.
 *
 * @example
 * ```ts
 * import { $DocumentsUseCasesId } from "@beep/identity"
 *
 * const id = $DocumentsUseCasesId.make("FilingDecision")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $DocumentsUseCasesId: Identity.IdentityComposer<"@beep/documents-use-cases"> =
  composers.$DocumentsUseCasesId;

/**
 * Identity composer for `@beep/documents-server`.
 *
 * @example
 * ```ts
 * import { $DocumentsServerId } from "@beep/identity"
 *
 * const id = $DocumentsServerId.make("DocumentsServerLive")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $DocumentsServerId: Identity.IdentityComposer<"@beep/documents-server"> = composers.$DocumentsServerId;

/**
 * Identity composer for `@beep/architecture-lab-domain`.
 *
 * @example
 * ```ts
 * import { $ArchitectureLabDomainId } from "@beep/identity"
 *
 * const id = $ArchitectureLabDomainId.make("WorkItem")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $ArchitectureLabDomainId: Identity.IdentityComposer<"@beep/architecture-lab-domain"> =
  composers.$ArchitectureLabDomainId;

/**
 * Identity composer for `@beep/architecture-lab-use-cases`.
 *
 * @example
 * ```ts
 * import { $ArchitectureLabUseCasesId } from "@beep/identity"
 *
 * const id = $ArchitectureLabUseCasesId.make("WorkItemService")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $ArchitectureLabUseCasesId: Identity.IdentityComposer<"@beep/architecture-lab-use-cases"> =
  composers.$ArchitectureLabUseCasesId;

/**
 * Identity composer for `@beep/architecture-lab-config`.
 *
 * @example
 * ```ts
 * import { $ArchitectureLabConfigId } from "@beep/identity"
 *
 * const id = $ArchitectureLabConfigId.make("Config")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $ArchitectureLabConfigId: Identity.IdentityComposer<"@beep/architecture-lab-config"> =
  composers.$ArchitectureLabConfigId;

/**
 * Identity composer for `@beep/architecture-lab-server`.
 *
 * @example
 * ```ts
 * import { $ArchitectureLabServerId } from "@beep/identity"
 *
 * const id = $ArchitectureLabServerId.make("Layer")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $ArchitectureLabServerId: Identity.IdentityComposer<"@beep/architecture-lab-server"> =
  composers.$ArchitectureLabServerId;

/**
 * Identity composer for `@beep/architecture-lab-tables`.
 *
 * @example
 * ```ts
 * import { $ArchitectureLabTablesId } from "@beep/identity"
 *
 * const id = $ArchitectureLabTablesId.make("WorkItemTable")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $ArchitectureLabTablesId: Identity.IdentityComposer<"@beep/architecture-lab-tables"> =
  composers.$ArchitectureLabTablesId;

/**
 * Identity composer for `@beep/architecture-lab-client`.
 *
 * @example
 * ```ts
 * import { $ArchitectureLabClientId } from "@beep/identity"
 *
 * const id = $ArchitectureLabClientId.make("WorkItemClient")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $ArchitectureLabClientId: Identity.IdentityComposer<"@beep/architecture-lab-client"> =
  composers.$ArchitectureLabClientId;

/**
 * Identity composer for `@beep/architecture-lab-ui`.
 *
 * @example
 * ```ts
 * import { $ArchitectureLabUiId } from "@beep/identity"
 *
 * const id = $ArchitectureLabUiId.make("WorkItemViewModel")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $ArchitectureLabUiId: Identity.IdentityComposer<"@beep/architecture-lab-ui"> =
  composers.$ArchitectureLabUiId;

/**
 * Identity composer for `@beep/architecture-lab-proof`.
 *
 * @example
 * ```ts
 * import { $ArchitectureLabProofId } from "@beep/identity"
 *
 * const id = $ArchitectureLabProofId.make("Proof")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $ArchitectureLabProofId: Identity.IdentityComposer<"@beep/architecture-lab-proof"> =
  composers.$ArchitectureLabProofId;

/**
 * Identity composer for `@beep/runpod`.
 *
 * @example
 * ```ts
 * import { $RunpodId } from "@beep/identity"
 *
 * const id = $RunpodId.make("Runpod")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $RunpodId: Identity.IdentityComposer<"@beep/runpod"> = composers.$RunpodId;

/**
 * Identity composer for `@beep/onepassword-cli`.
 *
 * @example
 * ```ts
 * import { $OnepasswordCliId } from "@beep/identity"
 *
 * const id = $OnepasswordCliId.make("OnepasswordCli")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $OnepasswordCliId: Identity.IdentityComposer<"@beep/onepassword-cli"> = composers.$OnepasswordCliId;

/**
 * Identity composer for `@beep/discord`.
 *
 * @example
 * ```ts
 * import { $DiscordId } from "@beep/identity"
 *
 * const id = $DiscordId.make("Discord")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $DiscordId: Identity.IdentityComposer<"@beep/discord"> = composers.$DiscordId;

/**
 * Identity composer for `@beep/ai-provider-cli`.
 *
 * @example
 * ```ts
 * import { $AiProviderCliId } from "@beep/identity"
 *
 * const id = $AiProviderCliId.make("AiProviderCli")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $AiProviderCliId: Identity.IdentityComposer<"@beep/ai-provider-cli"> = composers.$AiProviderCliId;

/**
 * Identity composer for `@beep/sanity`.
 *
 * @example
 * ```ts
 * import { $SanityId } from "@beep/identity"
 *
 * const id = $SanityId.make("Sanity")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $SanityId: Identity.IdentityComposer<"@beep/sanity"> = composers.$SanityId;

/**
 * Identity composer for `@beep/hubspot`.
 *
 * @example
 * ```ts
 * import { $HubspotId } from "@beep/identity"
 *
 * const id = $HubspotId.make("Hubspot")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $HubspotId: Identity.IdentityComposer<"@beep/hubspot"> = composers.$HubspotId;

/**
 * Identity composer for `@beep/phoenix`.
 *
 * @example
 * ```ts
 * import { $PhoenixId } from "@beep/identity"
 *
 * const id = $PhoenixId.make("Phoenix")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $PhoenixId: Identity.IdentityComposer<"@beep/phoenix"> = composers.$PhoenixId;

/**
 * Identity composer for `@beep/ai-sync`.
 *
 * @example
 * ```ts
 * import { $AiSyncId } from "@beep/identity"
 *
 * const id = $AiSyncId.make("AiSync")
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $AiSyncId: Identity.IdentityComposer<"@beep/ai-sync"> = composers.$AiSyncId;

/**
 * Identity composer for `@beep/box`.
 *
 * @example
 * ```ts
 * import { $BoxId } from "@beep/identity"
 *
 * const id = $BoxId.make("Box")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $BoxId: Identity.IdentityComposer<"@beep/box"> = composers.$BoxId;

/**
 * Identity composer for `@beep/nlp-mcp`.
 *
 * @example
 * ```ts
 * import { $NlpMcpId } from "@beep/identity"
 *
 * const id = $NlpMcpId.make("NlpMcp")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $NlpMcpId: Identity.IdentityComposer<"@beep/nlp-mcp"> = composers.$NlpMcpId;

/**
 * Identity composer for `@beep/rdf-canonize`.
 *
 * @example
 * ```ts
 * import { $RdfCanonizeId } from "@beep/identity/packages"
 *
 * const id = $RdfCanonizeId.make("Canonicalization")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $RdfCanonizeId: Identity.IdentityComposer<"@beep/rdf-canonize"> = composers.$RdfCanonizeId;

/**
 * Identity composer for `@beep/wink`.
 *
 * @example
 * ```ts
 * import { $WinkId } from "@beep/identity"
 *
 * const id = $WinkId.make("Wink")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $WinkId: Identity.IdentityComposer<"@beep/wink"> = composers.$WinkId;

/**
 * Identity composer for `@beep/file-processing`.
 *
 * @example
 * ```ts
 * import { $FileProcessingId } from "@beep/identity"
 *
 * const id = $FileProcessingId.make("FileProcessing")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $FileProcessingId: Identity.IdentityComposer<"@beep/file-processing"> = composers.$FileProcessingId;

/**
 * Identity composer for `@beep/tika`.
 *
 * @example
 * ```ts
 * import { $TikaId } from "@beep/identity"
 *
 * const id = $TikaId.make("Tika")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $TikaId: Identity.IdentityComposer<"@beep/tika"> = composers.$TikaId;

/**
 * Identity composer for `@beep/libpff`.
 *
 * @example
 * ```ts
 * import { $LibpffId } from "@beep/identity"
 *
 * const id = $LibpffId.make("Libpff")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $LibpffId: Identity.IdentityComposer<"@beep/libpff"> = composers.$LibpffId;

/**
 * Identity composer for `@beep/firecrawl`.
 *
 * @example
 * ```ts
 * import { $FirecrawlId } from "@beep/identity"
 *
 * const id = $FirecrawlId.make("Firecrawl")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $FirecrawlId: Identity.IdentityComposer<"@beep/firecrawl"> = composers.$FirecrawlId;

/**
 * Identity composer for the `@beep/uspto` package.
 *
 * @example
 * ```ts
 * import { $UsptoId } from "@beep/identity"
 *
 * const id = $UsptoId.make("Uspto")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $UsptoId: Identity.IdentityComposer<"@beep/uspto"> = composers.$UsptoId;

/**
 * Identity composer for `@beep/lexical-schema`.
 *
 * @example
 * ```ts
 * import { $LexicalSchemaId } from "@beep/identity"
 *
 * const id = $LexicalSchemaId.make("LexicalSchema")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $LexicalSchemaId: Identity.IdentityComposer<"@beep/lexical-schema"> = composers.$LexicalSchemaId;

/**
 * Identity composer for `@beep/editor`.
 *
 * @example
 * ```ts
 * import { $EditorId } from "@beep/identity"
 *
 * const id = $EditorId.make("Editor")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $EditorId: Identity.IdentityComposer<"@beep/editor"> = composers.$EditorId;

/**
 * Identity composer for `@beep/scratchpad`.
 *
 * @example
 * ```ts
 * import { $ScratchpadId } from "@beep/identity"
 *
 * const id = $ScratchpadId.make("Scratchpad")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $ScratchpadId: Identity.IdentityComposer<"@beep/scratchpad"> = composers.$ScratchpadId;

/**
 * Identity composer for `@beep/html`.
 *
 * @example
 * ```ts
 * import { $HtmlId } from "@beep/identity"
 *
 * const id = $HtmlId.make("Html")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $HtmlId: Identity.IdentityComposer<"@beep/html"> = composers.$HtmlId;

/**
 * Identity composer for `@beep/pandoc-ast`.
 *
 * @example
 * ```ts
 * import { $PandocAstId } from "@beep/identity"
 *
 * const id = $PandocAstId.make("PandocAst")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $PandocAstId: Identity.IdentityComposer<"@beep/pandoc-ast"> = composers.$PandocAstId;

/**
 * Identity composer for `@beep/form`.
 *
 * @example
 * ```ts
 * import { $FormId } from "@beep/identity"
 *
 * const id = $FormId.make("Form")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $FormId: Identity.IdentityComposer<"@beep/form"> = composers.$FormId;

/**
 * Identity composer for `@beep/pglite`.
 *
 * @example
 * ```ts
 * import { $PgliteId } from "@beep/identity"
 *
 * const id = $PgliteId.make("Pglite")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $PgliteId: Identity.IdentityComposer<"@beep/pglite"> = composers.$PgliteId;

/**
 * Identity composer for `@beep/m365`.
 *
 * @example
 * ```ts
 * import { $M365Id } from "@beep/identity"
 *
 * const id = $M365Id.make("M365")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $M365Id: Identity.IdentityComposer<"@beep/m365"> = composers.$M365Id;

/**
 * Identity composer for `@beep/m365-mcp`.
 *
 * @example
 * ```ts
 * import { $M365McpId } from "@beep/identity"
 *
 * const id = $M365McpId.make("M365Mcp")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $M365McpId: Identity.IdentityComposer<"@beep/m365-mcp"> = composers.$M365McpId;

/**
 * Identity composer for `@beep/govinfo`.
 *
 * @example
 * ```ts
 * import { $GovinfoId } from "@beep/identity"
 *
 * const id = $GovinfoId.make("Govinfo")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $GovinfoId: Identity.IdentityComposer<"@beep/govinfo"> = composers.$GovinfoId;

/**
 * Identity composer for `@beep/federal-register`.
 *
 * @example
 * ```ts
 * import { $FederalRegisterId } from "@beep/identity"
 *
 * const id = $FederalRegisterId.make("FederalRegister")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $FederalRegisterId: Identity.IdentityComposer<"@beep/federal-register"> = composers.$FederalRegisterId;

/**
 * Identity composer for `@beep/ecfr`.
 *
 * @example
 * ```ts
 * import { $EcfrId } from "@beep/identity"
 *
 * const id = $EcfrId.make("Ecfr")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $EcfrId: Identity.IdentityComposer<"@beep/ecfr"> = composers.$EcfrId;

/**
 * Identity composer for `@beep/dol`.
 *
 * @example
 * ```ts
 * import { $DolId } from "@beep/identity"
 *
 * const id = $DolId.make("Dol")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $DolId: Identity.IdentityComposer<"@beep/dol"> = composers.$DolId;

/**
 * Identity composer for `@beep/courtlistener`.
 *
 * @example
 * ```ts
 * import { $CourtlistenerId } from "@beep/identity"
 *
 * const id = $CourtlistenerId.make("Courtlistener")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $CourtlistenerId: Identity.IdentityComposer<"@beep/courtlistener"> = composers.$CourtlistenerId;

/**
 * Identity composer for `@beep/api-transport`.
 *
 * @example
 * ```ts
 * import { $ApiTransportId } from "@beep/identity"
 *
 * const id = $ApiTransportId.make("ApiTransport")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $ApiTransportId: Identity.IdentityComposer<"@beep/api-transport"> = composers.$ApiTransportId;

/**
 * Identity composer for `@beep/mcp-kit`.
 *
 * @example
 * ```ts
 * import { $McpKitId } from "@beep/identity"
 *
 * const id = $McpKitId.make("McpKit")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $McpKitId: Identity.IdentityComposer<"@beep/mcp-kit"> = composers.$McpKitId;

/**
 * Identity composer for `@beep/uspto-mcp`.
 *
 * @example
 * ```ts
 * import { $UsptoMcpId } from "@beep/identity"
 *
 * const id = $UsptoMcpId.make("UsptoMcp")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $UsptoMcpId: Identity.IdentityComposer<"@beep/uspto-mcp"> = composers.$UsptoMcpId;

/**
 * Identity composer for `@beep/pacer`.
 *
 * @example
 * ```typescript
 * import { $PacerId } from "@beep/identity"
 *
 * const id = $PacerId.make("Pacer")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $PacerId: Identity.IdentityComposer<"@beep/pacer"> = composers.$PacerId;

/**
 * Identity composer for `@beep/fc-runs`.
 *
 * @example
 * ```typescript
 * import { $FcRunsId } from "@beep/identity"
 *
 * const id = $FcRunsId.make("FcRuns")
 * void id
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const $FcRunsId: Identity.IdentityComposer<"@beep/fc-runs"> = composers.$FcRunsId;
