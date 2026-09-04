/**
 * Canonical identity composers for every `@beep/*` workspace namespace.
 *
 * **Details**
 *
 * Each export is a pre-built {@link Identity.IdentityComposer} scoped to a
 * specific workspace package. Use these to derive schema identifiers,
 * error tags, and service keys without manually calling `make`.
 *
 * **Example** (Derive schema and service IDs)
 *
 * ```ts
 * import { $I, $SchemaId } from "@beep/identity/packages"
 *
 * const serviceId = $SchemaId`TenantService`
 * const customId = $I.create("custom").make("CustomService")
 * console.log(serviceId)
 * console.log(customId)
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Identity from "./Id.ts";
// import { Struct, pipe } from "effect";
// import * as A from "effect/Array";
/**
 * Root identity composer for the `@beep` namespace.
 *
 * **Details**
 *
 * All other package composers are derived from this root via `compose`.
 *
 * **Example** (Make root custom segment)
 *
 * ```ts import.meta.vitest name="Make root custom segment"
 * import { $I } from "@beep/identity/packages"
 *
 * const id = $I.make("CustomSegment")
 * id // => "@beep/CustomSegment"
 * ```
 *
 * @category configuration
 * @since 0.0.0
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
  "shared-use-cases",
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
  "pglite",
  "m365",
  "m365-mcp",
  "govinfo",
  "ecfr",
  "api-transport",
  "mcp-kit",
  "uspto-mcp",
  "pacer",
  "fc-runs",
  "cosmos",
  "epistemic-server",
  "epistemic-tables",
  "lint-rules",
  "n3",
  "pretext",
  "dock",
  "dock-react",
  "ontology-client",
  "ontology-config",
  "ontology-domain",
  "ontology-server",
  "ontology-ui",
  "ontology-use-cases",
  "oxigraph",
  "shacl",
  "storybook",
  "tsgo-shim",
  "doc-text",
  "documents-tables",
  "tailscale",
  "agents-tables",
  "graph-3d",
  "epistemic-config",
  "law-practice-tables",
  "practice-kg-mcp",
  "openclaw",
  "obs",
  "exiftool",
  "qa-capture",
  "gov-legal-mcp",
  "epistemic-client",
  "epistemic-ui",
  "effect-drizzle",
  "skill-contract",
  "codegen-kit",
  "brand",
  "openai",
  "todox",
  "box-provisioning",
  "freshbooks"
);

// GENERATED LAB COMPOSERS START — synced from apps/labs/* workspace manifests by beep; do not edit by hand. On merge conflict, rerun `bun run beep lint identity-registry --fix`.
const generatedLabComposers = $I.compose(
  "api-docs",
  "ciops",
  "lejeune-bolt-workbench",
  "semantica",
  "trustgraph-workbench"
);
// GENERATED LAB COMPOSERS END

const composers = {
  ...generatedComposers,
  ...generatedLabComposers,
  $LangExtractId: generatedComposers.$LangextractId,
};

// GENERATED LAB EXPORTS START — synced from apps/labs/* workspace manifests by beep; do not edit by hand. On merge conflict, rerun `bun run beep lint identity-registry --fix`.

/**
 * Identity composer for `@beep/api-docs`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $ApiDocsId } from "@beep/identity"
 *
 * const id = $ApiDocsId.make("ApiDocs")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ApiDocsId: Identity.IdentityComposer<"@beep/api-docs"> = composers.$ApiDocsId;

/**
 * Identity composer for `@beep/ciops`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $CiopsId } from "@beep/identity"
 *
 * const id = $CiopsId.make("Ciops")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $CiopsId: Identity.IdentityComposer<"@beep/ciops"> = composers.$CiopsId;

/**
 * Identity composer for `@beep/lejeune-bolt-workbench`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $LejeuneBoltWorkbenchId } from "@beep/identity"
 *
 * const id = $LejeuneBoltWorkbenchId.make("LejeuneBoltWorkbench")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LejeuneBoltWorkbenchId: Identity.IdentityComposer<"@beep/lejeune-bolt-workbench"> =
  composers.$LejeuneBoltWorkbenchId;

/**
 * Identity composer for `@beep/semantica`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $SemanticaId } from "@beep/identity"
 *
 * const id = $SemanticaId.make("Semantica")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SemanticaId: Identity.IdentityComposer<"@beep/semantica"> = composers.$SemanticaId;

/**
 * Identity composer for `@beep/trustgraph-workbench`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $TrustgraphWorkbenchId } from "@beep/identity"
 *
 * const id = $TrustgraphWorkbenchId.make("TrustgraphWorkbench")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TrustgraphWorkbenchId: Identity.IdentityComposer<"@beep/trustgraph-workbench"> =
  composers.$TrustgraphWorkbenchId;
// GENERATED LAB EXPORTS END

// --- foundation ---

/**
 * Identity composer for the `@beep/data` package.
 *
 * **Example** (Make data package ID)
 *
 * ```ts import.meta.vitest name="Make data package ID"
 * import { $DataId } from "@beep/identity"
 *
 * const id = $DataId.make("Calendar")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DataId = composers.$DataId;

/**
 * Identity composer for the `@beep/identity` package.
 *
 * **Example** (Make identity package ID)
 *
 * ```ts import.meta.vitest name="Make identity package ID"
 * import { $IdentityId } from "@beep/identity"
 *
 * const id = $IdentityId.make("Composer")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $IdentityId = composers.$IdentityId;

/**
 * Identity composer for the `@beep/schema` package.
 *
 * **Example** (Make schema package ID)
 *
 * ```ts import.meta.vitest name="Make schema package ID"
 * import { $SchemaId } from "@beep/identity"
 *
 * const id = $SchemaId.make("EntityId")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SchemaId = composers.$SchemaId;

/**
 * Identity composer for the `@beep/provenance` package.
 *
 * **Example** (Make provenance package ID)
 *
 * ```ts import.meta.vitest name="Make provenance package ID"
 * import { $ProvenanceId } from "@beep/identity"
 *
 * const id = $ProvenanceId.make("TextAnchor")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ProvenanceId: Identity.IdentityComposer<"@beep/provenance"> = composers.$ProvenanceId;

/**
 * Identity composer for the `@beep/rdf` package.
 *
 * **Example** (Make RDF package ID)
 *
 * ```ts import.meta.vitest name="Make RDF package ID"
 * import { $RdfId } from "@beep/identity"
 *
 * const id = $RdfId.make("Iri")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RdfId: Identity.IdentityComposer<"@beep/rdf"> = composers.$RdfId;

/**
 * Identity composer for the `@beep/ontology` package.
 *
 * **Example** (Make ontology package ID)
 *
 * ```ts import.meta.vitest name="Make ontology package ID"
 * import { $OntologyId } from "@beep/identity/packages"
 *
 * const id = $OntologyId.make("Ontology")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OntologyId: Identity.IdentityComposer<"@beep/ontology"> = composers.$OntologyId;

/**
 * Identity composer for the semantic-foundation vocabulary under `@beep/ontology`.
 *
 * **Example** (Log semantic foundation IRI)
 *
 * ```ts import.meta.vitest name="Log semantic foundation IRI"
 * import { $SemanticFoundationId } from "@beep/identity/packages"
 *
 * $SemanticFoundationId.iri // => "https://ns.beep.sh/ontology/semantic-foundation"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SemanticFoundationId = $OntologyId.create("semantic-foundation");

/**
 * Identity composer for the `@beep/types` package.
 *
 * **Example** (Make types package ID)
 *
 * ```ts import.meta.vitest name="Make types package ID"
 * import { $TypesId } from "@beep/identity"
 *
 * const id = $TypesId.make("NonEmpty")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TypesId = composers.$TypesId;

/**
 * Identity composer for the `@beep/utils` package.
 *
 * **Example** (Make utils package ID)
 *
 * ```ts import.meta.vitest name="Make utils package ID"
 * import { $UtilsId } from "@beep/identity"
 *
 * const id = $UtilsId.make("Retry")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $UtilsId = composers.$UtilsId;

// --- ui ---

/**
 * Identity composer for the `@beep/ui` package.
 *
 * **Example** (Make UI package ID)
 *
 * ```ts import.meta.vitest name="Make UI package ID"
 * import { $UiId } from "@beep/identity"
 *
 * const id = $UiId.make("Button") // initial type: `Identity.IdentityComposer<"@beep/ui/Button">`
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $UiId = composers.$UiId;

// --- tooling ---

/**
 * Identity composer for the `@beep/repo-ai-metrics` package.
 *
 * **Example** (Make repo AI metrics ID)
 *
 * ```ts import.meta.vitest name="Make repo AI metrics ID"
 * import { $RepoAiMetricsId } from "@beep/identity"
 *
 * const id = $RepoAiMetricsId.make("AgentTask")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RepoAiMetricsId = composers.$RepoAiMetricsId;

/**
 * Identity composer for the `@beep/repo-cli` package.
 *
 * **Example** (Make repo CLI package ID)
 *
 * ```ts import.meta.vitest name="Make repo CLI package ID"
 * import { $RepoCliId } from "@beep/identity"
 *
 * const id = $RepoCliId.make("Command")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RepoCliId = composers.$RepoCliId;

/**
 * Identity composer for the `@beep/repo-configs` package.
 *
 * **Example** (Make repo configs package ID)
 *
 * ```ts import.meta.vitest name="Make repo configs package ID"
 * import { $RepoConfigsId } from "@beep/identity"
 *
 * const id = $RepoConfigsId.make("Command")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RepoConfigsId = composers.$RepoConfigsId;

/**
 * Identity composer for the `@beep/repo-utils` package.
 *
 * **Example** (Make repo utils package ID)
 *
 * ```ts import.meta.vitest name="Make repo utils package ID"
 * import { $RepoUtilsId } from "@beep/identity"
 *
 * const id = $RepoUtilsId.make("FileTree")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RepoUtilsId = composers.$RepoUtilsId;

/**
 * Identity composer for the `@beep/test-utils` package.
 *
 * **Example** (Make test utils package ID)
 *
 * ```ts import.meta.vitest name="Make test utils package ID"
 * import { $TestUtilsId } from "@beep/identity"
 *
 * const id = $TestUtilsId.make("Fixture")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TestUtilsId = composers.$TestUtilsId;

// --- shared ---

/**
 * Identity composer for the `@beep/shared-domain` package.
 *
 * **Example** (Make shared domain package ID)
 *
 * ```ts import.meta.vitest name="Make shared domain package ID"
 * import { $SharedDomainId } from "@beep/identity"
 *
 * const id = $SharedDomainId.make("TenantId")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SharedDomainId = composers.$SharedDomainId;

/**
 * Identity composer for the `@beep/shared-use-cases` package.
 *
 * **Example** (Make a shared use-case contract ID)
 *
 * ```ts
 * import { $SharedUseCasesId } from "@beep/identity/packages"
 *
 * const id = $SharedUseCasesId.make("PromotionGate")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SharedUseCasesId: Identity.IdentityComposer<"@beep/shared-use-cases"> = composers.$SharedUseCasesId;

/**
 * Identity composer for the `@beep/shared-tables` package.
 *
 * **Example** (Make shared tables package ID)
 *
 * ```ts import.meta.vitest name="Make shared tables package ID"
 * import { $SharedTablesId } from "@beep/identity"
 *
 * const id = $SharedTablesId.make("AuditColumns")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SharedTablesId = composers.$SharedTablesId;

/**
 * Identity composer for the `@beep/semantic-web` package.
 *
 * **Example** (Make semantic web package ID)
 *
 * ```ts import.meta.vitest name="Make semantic web package ID"
 * import { $SemanticWebId } from "@beep/identity"
 *
 * const id = $SemanticWebId.make("Triple")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SemanticWebId: Identity.IdentityComposer<"@beep/semantic-web"> = composers.$SemanticWebId;

/**
 * Identity composer for the `@beep/nlp` package.
 *
 * **Example** (Make NLP package ID)
 *
 * ```ts import.meta.vitest name="Make NLP package ID"
 * import { $NlpId } from "@beep/identity"
 *
 * const id = $NlpId.make("Tokenizer")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $NlpId: Identity.IdentityComposer<"@beep/nlp"> = composers.$NlpId;

/**
 * Identity composer for the `@beep/nlp-processing` package.
 *
 * **Example** (Make NLP processing package ID)
 *
 * ```ts import.meta.vitest name="Make NLP processing package ID"
 * import { $NlpProcessingId } from "@beep/identity/packages"
 *
 * const id = $NlpProcessingId.make("Tokenizer")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $NlpProcessingId: Identity.IdentityComposer<"@beep/nlp-processing"> = composers.$NlpProcessingId;

/**
 * Identity composer for the `@beep/langextract` package.
 *
 * **Example** (Make langextract package ID)
 *
 * ```ts import.meta.vitest name="Make langextract package ID"
 * import { $LangExtractId } from "@beep/identity"
 *
 * const id = $LangExtractId.make("Extraction")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LangExtractId: Identity.IdentityComposer<"@beep/langextract"> = composers.$LangExtractId;

/**
 * Identity composer for the `@beep/observability` package.
 *
 * **Example** (Make observability package ID)
 *
 * ```ts import.meta.vitest name="Make observability package ID"
 * import { $ObservabilityId } from "@beep/identity"
 *
 * const id = $ObservabilityId.make("Tracer")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ObservabilityId: Identity.IdentityComposer<"@beep/observability"> = composers.$ObservabilityId;

/**
 * Identity composer for the `@beep/colors` package.
 *
 * **Example** (Make colors package ID)
 *
 * ```ts import.meta.vitest name="Make colors package ID"
 * import { $ColorsId } from "@beep/identity"
 *
 * const id = $ColorsId.make("Palette")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ColorsId: Identity.IdentityComposer<"@beep/colors"> = composers.$ColorsId;

/**
 * Identity composer for the `@beep/chalk` package.
 *
 * **Example** (Make chalk package ID)
 *
 * ```ts import.meta.vitest name="Make chalk package ID"
 * import { $ChalkId } from "@beep/identity"
 *
 * const id = $ChalkId.make("Formatter")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ChalkId: Identity.IdentityComposer<"@beep/chalk"> = composers.$ChalkId;

/**
 * Identity composer for the `@beep/repo-docgen` package.
 *
 * **Example** (Make repo docgen package ID)
 *
 * ```ts import.meta.vitest name="Make repo docgen package ID"
 * import { $RepoDocgenId } from "@beep/identity"
 *
 * const id = $RepoDocgenId.make("Generator")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RepoDocgenId: Identity.IdentityComposer<"@beep/repo-docgen"> = composers.$RepoDocgenId;

/**
 * Identity composer for the `@beep/infra` package.
 *
 * **Example** (Make infra package ID)
 *
 * ```ts import.meta.vitest name="Make infra package ID"
 * import { $InfraId } from "@beep/identity"
 *
 * const id = $InfraId.make("Deploy")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $InfraId: Identity.IdentityComposer<"@beep/infra"> = composers.$InfraId;

// --- p3 professional runtime proof ---

/**
 * Identity composer for the `@beep/workspace-domain` package.
 *
 * **Example** (Make workspace domain package ID)
 *
 * ```ts import.meta.vitest name="Make workspace domain package ID"
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
 * **Example** (Make epistemic domain package ID)
 *
 * ```ts import.meta.vitest name="Make epistemic domain package ID"
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
 * **Example** (Make epistemic use-cases ID)
 *
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
 * **Example** (Make agents domain package ID)
 *
 * ```ts import.meta.vitest name="Make agents domain package ID"
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
 * **Example** (Make agents server package ID)
 *
 * ```ts import.meta.vitest name="Make agents server package ID"
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
 * **Example** (Make agents use-cases package ID)
 *
 * ```ts import.meta.vitest name="Make agents use-cases package ID"
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
 * **Example** (Make agents client package ID)
 *
 * ```ts import.meta.vitest name="Make agents client package ID"
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
 * **Example** (Make law practice domain ID)
 *
 * ```ts import.meta.vitest name="Make law practice domain ID"
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
 * **Example** (Make law practice use-cases ID)
 *
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
 * **Example** (Make law practice server ID)
 *
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
 * **Example** (Make professional desktop package ID)
 *
 * ```ts import.meta.vitest name="Make professional desktop package ID"
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
 * **Example** (Log all package composers)
 *
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
 * **Example** (Log markdown package ID)
 *
 * ```ts
 * import { $MdId } from "@beep/identity/packages"
 *
 * console.log($MdId)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $MdId: Identity.IdentityComposer<"@beep/md"> = composers.$MdId;

/**
 * $oip web id export.
 *
 * **Example** (Log OIP web package ID)
 *
 * ```ts
 * import { $OipWebId } from "@beep/identity/packages"
 *
 * console.log($OipWebId)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OipWebId: Identity.IdentityComposer<"@beep/oip-web"> = composers.$OipWebId;

/**
 * $drizzle id export.
 *
 * **Example** (Log drizzle package ID)
 *
 * ```ts
 * import { $DrizzleId } from "@beep/identity/packages"
 *
 * console.log($DrizzleId)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DrizzleId: Identity.IdentityComposer<"@beep/drizzle"> = composers.$DrizzleId;

/**
 * $duckdb id export.
 *
 * **Example** (Log duckdb package ID)
 *
 * ```ts
 * import { $DuckdbId } from "@beep/identity/packages"
 *
 * console.log($DuckdbId)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DuckdbId: Identity.IdentityComposer<"@beep/duckdb"> = composers.$DuckdbId;

/**
 * $face detection id export.
 *
 * **Example** (Log face detection package ID)
 *
 * ```ts
 * import { $FaceDetectionId } from "@beep/identity/packages"
 *
 * console.log($FaceDetectionId)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $FaceDetectionId: Identity.IdentityComposer<"@beep/face-detection"> = composers.$FaceDetectionId;

/**
 * $ffmpeg id export.
 *
 * **Example** (Log ffmpeg package ID)
 *
 * ```ts
 * import { $FfmpegId } from "@beep/identity/packages"
 *
 * console.log($FfmpegId)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $FfmpegId: Identity.IdentityComposer<"@beep/ffmpeg"> = composers.$FfmpegId;

/**
 * $postgres id export.
 *
 * **Example** (Log postgres package ID)
 *
 * ```ts
 * import { $PostgresId } from "@beep/identity/packages"
 *
 * console.log($PostgresId)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PostgresId: Identity.IdentityComposer<"@beep/postgres"> = composers.$PostgresId;

/**
 * Identity composer for `@beep/anthropic`.
 *
 * **Example** (Make anthropic package ID)
 *
 * ```ts
 * import { $AnthropicId } from "@beep/identity"
 *
 * const id = $AnthropicId.make("Anthropic")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AnthropicId: Identity.IdentityComposer<"@beep/anthropic"> = composers.$AnthropicId;

/**
 * $venice ai id export.
 *
 * **Example** (Log Venice AI package ID)
 *
 * ```ts
 * import { $VeniceAiId } from "@beep/identity/packages"
 *
 * console.log($VeniceAiId)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $VeniceAiId: Identity.IdentityComposer<"@beep/venice-ai"> = composers.$VeniceAiId;

/**
 * $xai id export.
 *
 * **Example** (Log xAI package ID)
 *
 * ```ts
 * import { $XaiId } from "@beep/identity/packages"
 *
 * console.log($XaiId)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $XaiId: Identity.IdentityComposer<"@beep/xai"> = composers.$XaiId;

/**
 * Identity composer for `@beep/acp`.
 *
 * **Example** (Make ACP package ID)
 *
 * ```ts
 * import { $AcpId } from "@beep/identity"
 *
 * const id = $AcpId.make("AcpClient")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AcpId: Identity.IdentityComposer<"@beep/acp"> = composers.$AcpId;

/**
 * Identity composer for `@beep/openai-compat`.
 *
 * **Example** (Make OpenAI compat package ID)
 *
 * ```ts
 * import { $OpenaiCompatId } from "@beep/identity"
 *
 * const id = $OpenaiCompatId.make("LanguageModel")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OpenaiCompatId: Identity.IdentityComposer<"@beep/openai-compat"> = composers.$OpenaiCompatId;

/**
 * Identity composer for `@beep/workspace-tables`.
 *
 * **Example** (Make workspace tables package ID)
 *
 * ```ts
 * import { $WorkspaceTablesId } from "@beep/identity"
 *
 * const id = $WorkspaceTablesId.make("WorkspaceTable")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $WorkspaceTablesId: Identity.IdentityComposer<"@beep/workspace-tables"> = composers.$WorkspaceTablesId;

/**
 * Identity composer for `@beep/workspace-use-cases`.
 *
 * **Example** (Make workspace use-cases package ID)
 *
 * ```ts
 * import { $WorkspaceUseCasesId } from "@beep/identity"
 *
 * const id = $WorkspaceUseCasesId.make("ThreadStore")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $WorkspaceUseCasesId: Identity.IdentityComposer<"@beep/workspace-use-cases"> =
  composers.$WorkspaceUseCasesId;

/**
 * Identity composer for `@beep/workspace-server`.
 *
 * **Example** (Make workspace server package ID)
 *
 * ```ts
 * import { $WorkspaceServerId } from "@beep/identity"
 *
 * const id = $WorkspaceServerId.make("ThreadStoreLive")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $WorkspaceServerId: Identity.IdentityComposer<"@beep/workspace-server"> = composers.$WorkspaceServerId;

/**
 * Identity composer for `@beep/documents-domain`.
 *
 * **Example** (Make documents domain package ID)
 *
 * ```ts
 * import { $DocumentsDomainId } from "@beep/identity"
 *
 * const id = $DocumentsDomainId.make("LegalDocumentTaxonomy")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DocumentsDomainId: Identity.IdentityComposer<"@beep/documents-domain"> = composers.$DocumentsDomainId;

/**
 * Identity composer for `@beep/documents-use-cases`.
 *
 * **Example** (Make documents use-cases package ID)
 *
 * ```ts
 * import { $DocumentsUseCasesId } from "@beep/identity"
 *
 * const id = $DocumentsUseCasesId.make("FilingDecision")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DocumentsUseCasesId: Identity.IdentityComposer<"@beep/documents-use-cases"> =
  composers.$DocumentsUseCasesId;

/**
 * Identity composer for `@beep/documents-server`.
 *
 * **Example** (Make documents server package ID)
 *
 * ```ts
 * import { $DocumentsServerId } from "@beep/identity"
 *
 * const id = $DocumentsServerId.make("DocumentsServerLive")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DocumentsServerId: Identity.IdentityComposer<"@beep/documents-server"> = composers.$DocumentsServerId;

/**
 * Identity composer for `@beep/architecture-lab-domain`.
 *
 * **Example** (Make architecture lab domain ID)
 *
 * ```ts
 * import { $ArchitectureLabDomainId } from "@beep/identity"
 *
 * const id = $ArchitectureLabDomainId.make("WorkItem")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ArchitectureLabDomainId: Identity.IdentityComposer<"@beep/architecture-lab-domain"> =
  composers.$ArchitectureLabDomainId;

/**
 * Identity composer for `@beep/architecture-lab-use-cases`.
 *
 * **Example** (Make architecture lab use-cases ID)
 *
 * ```ts
 * import { $ArchitectureLabUseCasesId } from "@beep/identity"
 *
 * const id = $ArchitectureLabUseCasesId.make("WorkItemService")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ArchitectureLabUseCasesId: Identity.IdentityComposer<"@beep/architecture-lab-use-cases"> =
  composers.$ArchitectureLabUseCasesId;

/**
 * Identity composer for `@beep/architecture-lab-config`.
 *
 * **Example** (Make architecture lab config ID)
 *
 * ```ts
 * import { $ArchitectureLabConfigId } from "@beep/identity"
 *
 * const id = $ArchitectureLabConfigId.make("Config")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ArchitectureLabConfigId: Identity.IdentityComposer<"@beep/architecture-lab-config"> =
  composers.$ArchitectureLabConfigId;

/**
 * Identity composer for `@beep/architecture-lab-server`.
 *
 * **Example** (Make architecture lab server ID)
 *
 * ```ts
 * import { $ArchitectureLabServerId } from "@beep/identity"
 *
 * const id = $ArchitectureLabServerId.make("Layer")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ArchitectureLabServerId: Identity.IdentityComposer<"@beep/architecture-lab-server"> =
  composers.$ArchitectureLabServerId;

/**
 * Identity composer for `@beep/architecture-lab-tables`.
 *
 * **Example** (Make architecture lab tables ID)
 *
 * ```ts
 * import { $ArchitectureLabTablesId } from "@beep/identity"
 *
 * const id = $ArchitectureLabTablesId.make("WorkItemTable")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ArchitectureLabTablesId: Identity.IdentityComposer<"@beep/architecture-lab-tables"> =
  composers.$ArchitectureLabTablesId;

/**
 * Identity composer for `@beep/architecture-lab-client`.
 *
 * **Example** (Make architecture lab client ID)
 *
 * ```ts
 * import { $ArchitectureLabClientId } from "@beep/identity"
 *
 * const id = $ArchitectureLabClientId.make("WorkItemClient")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ArchitectureLabClientId: Identity.IdentityComposer<"@beep/architecture-lab-client"> =
  composers.$ArchitectureLabClientId;

/**
 * Identity composer for `@beep/architecture-lab-ui`.
 *
 * **Example** (Make architecture lab UI ID)
 *
 * ```ts
 * import { $ArchitectureLabUiId } from "@beep/identity"
 *
 * const id = $ArchitectureLabUiId.make("WorkItemViewModel")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ArchitectureLabUiId: Identity.IdentityComposer<"@beep/architecture-lab-ui"> =
  composers.$ArchitectureLabUiId;

/**
 * Identity composer for `@beep/architecture-lab-proof`.
 *
 * **Example** (Make architecture lab proof ID)
 *
 * ```ts
 * import { $ArchitectureLabProofId } from "@beep/identity"
 *
 * const id = $ArchitectureLabProofId.make("Proof")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ArchitectureLabProofId: Identity.IdentityComposer<"@beep/architecture-lab-proof"> =
  composers.$ArchitectureLabProofId;

/**
 * Identity composer for `@beep/runpod`.
 *
 * **Example** (Make Runpod package ID)
 *
 * ```ts
 * import { $RunpodId } from "@beep/identity"
 *
 * const id = $RunpodId.make("Runpod")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RunpodId: Identity.IdentityComposer<"@beep/runpod"> = composers.$RunpodId;

/**
 * Identity composer for `@beep/onepassword-cli`.
 *
 * **Example** (Make 1Password CLI package ID)
 *
 * ```ts
 * import { $OnepasswordCliId } from "@beep/identity"
 *
 * const id = $OnepasswordCliId.make("OnepasswordCli")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OnepasswordCliId: Identity.IdentityComposer<"@beep/onepassword-cli"> = composers.$OnepasswordCliId;

/**
 * Identity composer for `@beep/discord`.
 *
 * **Example** (Make Discord package ID)
 *
 * ```ts
 * import { $DiscordId } from "@beep/identity"
 *
 * const id = $DiscordId.make("Discord")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DiscordId: Identity.IdentityComposer<"@beep/discord"> = composers.$DiscordId;

/**
 * Identity composer for `@beep/ai-provider-cli`.
 *
 * **Example** (Make AI provider CLI package ID)
 *
 * ```ts
 * import { $AiProviderCliId } from "@beep/identity"
 *
 * const id = $AiProviderCliId.make("AiProviderCli")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AiProviderCliId: Identity.IdentityComposer<"@beep/ai-provider-cli"> = composers.$AiProviderCliId;

/**
 * Identity composer for `@beep/sanity`.
 *
 * **Example** (Make Sanity package ID)
 *
 * ```ts
 * import { $SanityId } from "@beep/identity"
 *
 * const id = $SanityId.make("Sanity")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SanityId: Identity.IdentityComposer<"@beep/sanity"> = composers.$SanityId;

/**
 * Identity composer for `@beep/hubspot`.
 *
 * **Example** (Make HubSpot package ID)
 *
 * ```ts
 * import { $HubspotId } from "@beep/identity"
 *
 * const id = $HubspotId.make("Hubspot")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $HubspotId: Identity.IdentityComposer<"@beep/hubspot"> = composers.$HubspotId;

/**
 * Identity composer for `@beep/phoenix`.
 *
 * **Example** (Make Phoenix package ID)
 *
 * ```ts
 * import { $PhoenixId } from "@beep/identity"
 *
 * const id = $PhoenixId.make("Phoenix")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PhoenixId: Identity.IdentityComposer<"@beep/phoenix"> = composers.$PhoenixId;

/**
 * Identity composer for `@beep/ai-sync`.
 *
 * **Example** (Make AI sync package ID)
 *
 * ```ts
 * import { $AiSyncId } from "@beep/identity"
 *
 * const id = $AiSyncId.make("AiSync")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AiSyncId: Identity.IdentityComposer<"@beep/ai-sync"> = composers.$AiSyncId;

/**
 * Identity composer for `@beep/box`.
 *
 * **Example** (Make Box package ID)
 *
 * ```ts import.meta.vitest name="Make Box package ID"
 * import { $BoxId } from "@beep/identity"
 *
 * const id = $BoxId.make("Box")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $BoxId: Identity.IdentityComposer<"@beep/box"> = composers.$BoxId;

/**
 * Identity composer for `@beep/nlp-mcp`.
 *
 * **Example** (Make NLP MCP package ID)
 *
 * ```ts import.meta.vitest name="Make NLP MCP package ID"
 * import { $NlpMcpId } from "@beep/identity"
 *
 * const id = $NlpMcpId.make("NlpMcp")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $NlpMcpId: Identity.IdentityComposer<"@beep/nlp-mcp"> = composers.$NlpMcpId;

/**
 * Identity composer for `@beep/rdf-canonize`.
 *
 * **Example** (Make RDF canonize package ID)
 *
 * ```ts import.meta.vitest name="Make RDF canonize package ID"
 * import { $RdfCanonizeId } from "@beep/identity/packages"
 *
 * const id = $RdfCanonizeId.make("Canonicalization")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RdfCanonizeId: Identity.IdentityComposer<"@beep/rdf-canonize"> = composers.$RdfCanonizeId;

/**
 * Identity composer for `@beep/wink`.
 *
 * **Example** (Make Wink package ID)
 *
 * ```ts import.meta.vitest name="Make Wink package ID"
 * import { $WinkId } from "@beep/identity"
 *
 * const id = $WinkId.make("Wink")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $WinkId: Identity.IdentityComposer<"@beep/wink"> = composers.$WinkId;

/**
 * Identity composer for `@beep/file-processing`.
 *
 * **Example** (Make file processing package ID)
 *
 * ```ts import.meta.vitest name="Make file processing package ID"
 * import { $FileProcessingId } from "@beep/identity"
 *
 * const id = $FileProcessingId.make("FileProcessing")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $FileProcessingId: Identity.IdentityComposer<"@beep/file-processing"> = composers.$FileProcessingId;

/**
 * Identity composer for `@beep/tika`.
 *
 * **Example** (Make Tika package ID)
 *
 * ```ts import.meta.vitest name="Make Tika package ID"
 * import { $TikaId } from "@beep/identity"
 *
 * const id = $TikaId.make("Tika")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TikaId: Identity.IdentityComposer<"@beep/tika"> = composers.$TikaId;

/**
 * Identity composer for `@beep/libpff`.
 *
 * **Example** (Make Libpff package ID)
 *
 * ```ts import.meta.vitest name="Make Libpff package ID"
 * import { $LibpffId } from "@beep/identity"
 *
 * const id = $LibpffId.make("Libpff")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LibpffId: Identity.IdentityComposer<"@beep/libpff"> = composers.$LibpffId;

/**
 * Identity composer for `@beep/firecrawl`.
 *
 * **Example** (Make Firecrawl package ID)
 *
 * ```ts import.meta.vitest name="Make Firecrawl package ID"
 * import { $FirecrawlId } from "@beep/identity"
 *
 * const id = $FirecrawlId.make("Firecrawl")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $FirecrawlId: Identity.IdentityComposer<"@beep/firecrawl"> = composers.$FirecrawlId;

/**
 * Identity composer for the `@beep/uspto` package.
 *
 * **Example** (Make USPTO package ID)
 *
 * ```ts import.meta.vitest name="Make USPTO package ID"
 * import { $UsptoId } from "@beep/identity"
 *
 * const id = $UsptoId.make("Uspto")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $UsptoId: Identity.IdentityComposer<"@beep/uspto"> = composers.$UsptoId;

/**
 * Identity composer for `@beep/lexical-schema`.
 *
 * **Example** (Make lexical schema package ID)
 *
 * ```ts import.meta.vitest name="Make lexical schema package ID"
 * import { $LexicalSchemaId } from "@beep/identity"
 *
 * const id = $LexicalSchemaId.make("LexicalSchema")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LexicalSchemaId: Identity.IdentityComposer<"@beep/lexical-schema"> = composers.$LexicalSchemaId;

/**
 * Identity composer for `@beep/editor`.
 *
 * **Example** (Make editor package ID)
 *
 * ```ts import.meta.vitest name="Make editor package ID"
 * import { $EditorId } from "@beep/identity"
 *
 * const id = $EditorId.make("Editor")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EditorId: Identity.IdentityComposer<"@beep/editor"> = composers.$EditorId;

/**
 * Identity composer for `@beep/scratchpad`.
 *
 * **Example** (Make scratchpad package ID)
 *
 * ```ts import.meta.vitest name="Make scratchpad package ID"
 * import { $ScratchpadId } from "@beep/identity"
 *
 * const id = $ScratchpadId.make("Scratchpad")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ScratchpadId: Identity.IdentityComposer<"@beep/scratchpad"> = composers.$ScratchpadId;

/**
 * Identity composer for `@beep/html`.
 *
 * **Example** (Make HTML package ID)
 *
 * ```ts import.meta.vitest name="Make HTML package ID"
 * import { $HtmlId } from "@beep/identity"
 *
 * const id = $HtmlId.make("Html")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $HtmlId: Identity.IdentityComposer<"@beep/html"> = composers.$HtmlId;

/**
 * Identity composer for `@beep/pandoc-ast`.
 *
 * **Example** (Make Pandoc AST package ID)
 *
 * ```ts import.meta.vitest name="Make Pandoc AST package ID"
 * import { $PandocAstId } from "@beep/identity"
 *
 * const id = $PandocAstId.make("PandocAst")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PandocAstId: Identity.IdentityComposer<"@beep/pandoc-ast"> = composers.$PandocAstId;

/**
 * Identity composer for `@beep/pglite`.
 *
 * **Example** (Make PGlite package ID)
 *
 * ```ts import.meta.vitest name="Make PGlite package ID"
 * import { $PgliteId } from "@beep/identity"
 *
 * const id = $PgliteId.make("Pglite")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PgliteId: Identity.IdentityComposer<"@beep/pglite"> = composers.$PgliteId;

/**
 * Identity composer for `@beep/m365`.
 *
 * **Example** (Make M365 package ID)
 *
 * ```ts import.meta.vitest name="Make M365 package ID"
 * import { $M365Id } from "@beep/identity"
 *
 * const id = $M365Id.make("M365")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $M365Id: Identity.IdentityComposer<"@beep/m365"> = composers.$M365Id;

/**
 * Identity composer for `@beep/m365-mcp`.
 *
 * **Example** (Make M365 MCP package ID)
 *
 * ```ts import.meta.vitest name="Make M365 MCP package ID"
 * import { $M365McpId } from "@beep/identity"
 *
 * const id = $M365McpId.make("M365Mcp")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $M365McpId: Identity.IdentityComposer<"@beep/m365-mcp"> = composers.$M365McpId;

/**
 * Identity composer for `@beep/govinfo`.
 *
 * **Example** (Make GovInfo package ID)
 *
 * ```ts import.meta.vitest name="Make GovInfo package ID"
 * import { $GovinfoId } from "@beep/identity"
 *
 * const id = $GovinfoId.make("Govinfo")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $GovinfoId: Identity.IdentityComposer<"@beep/govinfo"> = composers.$GovinfoId;

/**
 * Identity composer for `@beep/ecfr`.
 *
 * **Example** (Make eCFR package ID)
 *
 * ```ts import.meta.vitest name="Make eCFR package ID"
 * import { $EcfrId } from "@beep/identity"
 *
 * const id = $EcfrId.make("Ecfr")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EcfrId: Identity.IdentityComposer<"@beep/ecfr"> = composers.$EcfrId;

/**
 * Identity composer for `@beep/api-transport`.
 *
 * **Example** (Make API transport package ID)
 *
 * ```ts import.meta.vitest name="Make API transport package ID"
 * import { $ApiTransportId } from "@beep/identity"
 *
 * const id = $ApiTransportId.make("ApiTransport")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ApiTransportId: Identity.IdentityComposer<"@beep/api-transport"> = composers.$ApiTransportId;

/**
 * Identity composer for `@beep/mcp-kit`.
 *
 * **Example** (Make MCP kit package ID)
 *
 * ```ts import.meta.vitest name="Make MCP kit package ID"
 * import { $McpKitId } from "@beep/identity"
 *
 * const id = $McpKitId.make("McpKit")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $McpKitId: Identity.IdentityComposer<"@beep/mcp-kit"> = composers.$McpKitId;

/**
 * Identity composer for `@beep/uspto-mcp`.
 *
 * **Example** (Make USPTO MCP package ID)
 *
 * ```ts import.meta.vitest name="Make USPTO MCP package ID"
 * import { $UsptoMcpId } from "@beep/identity"
 *
 * const id = $UsptoMcpId.make("UsptoMcp")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $UsptoMcpId: Identity.IdentityComposer<"@beep/uspto-mcp"> = composers.$UsptoMcpId;

/**
 * Identity composer for `@beep/pacer`.
 *
 * **Example** (Make PACER package ID)
 *
 * ```ts import.meta.vitest name="Make PACER package ID"
 * import { $PacerId } from "@beep/identity"
 *
 * const id = $PacerId.make("Pacer")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PacerId: Identity.IdentityComposer<"@beep/pacer"> = composers.$PacerId;

/**
 * Identity composer for `@beep/fc-runs`.
 *
 * **Example** (Make FC runs package ID)
 *
 * ```ts import.meta.vitest name="Make FC runs package ID"
 * import { $FcRunsId } from "@beep/identity"
 *
 * const id = $FcRunsId.make("FcRuns")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $FcRunsId: Identity.IdentityComposer<"@beep/fc-runs"> = composers.$FcRunsId;

/**
 * Identity composer for `@beep/cosmos`.
 *
 * **Example** (Make Cosmos package ID)
 *
 * ```ts import.meta.vitest name="Make Cosmos package ID"
 * import { $CosmosId } from "@beep/identity"
 *
 * const id = $CosmosId.make("Cosmos")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $CosmosId: Identity.IdentityComposer<"@beep/cosmos"> = composers.$CosmosId;

/**
 * Identity composer for `@beep/db-admin`.
 *
 * **Example** (Make DB admin package ID)
 *
 * ```ts import.meta.vitest name="Make DB admin package ID"
 * import { $DbAdminId } from "@beep/identity"
 *
 * const id = $DbAdminId.make("DbAdmin")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DbAdminId: Identity.IdentityComposer<"@beep/db-admin"> = composers.$DbAdminId;

/**
 * Identity composer for `@beep/epistemic-server`.
 *
 * **Example** (Make epistemic server package ID)
 *
 * ```ts import.meta.vitest name="Make epistemic server package ID"
 * import { $EpistemicServerId } from "@beep/identity"
 *
 * const id = $EpistemicServerId.make("EpistemicServer")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EpistemicServerId: Identity.IdentityComposer<"@beep/epistemic-server"> = composers.$EpistemicServerId;

/**
 * Identity composer for `@beep/epistemic-tables`.
 *
 * **Example** (Make epistemic tables package ID)
 *
 * ```ts import.meta.vitest name="Make epistemic tables package ID"
 * import { $EpistemicTablesId } from "@beep/identity"
 *
 * const id = $EpistemicTablesId.make("EpistemicTables")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EpistemicTablesId: Identity.IdentityComposer<"@beep/epistemic-tables"> = composers.$EpistemicTablesId;

/**
 * Identity composer for `@beep/lint-rules`.
 *
 * **Example** (Make lint rules package ID)
 *
 * ```ts import.meta.vitest name="Make lint rules package ID"
 * import { $LintRulesId } from "@beep/identity"
 *
 * const id = $LintRulesId.make("LintRules")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LintRulesId: Identity.IdentityComposer<"@beep/lint-rules"> = composers.$LintRulesId;

/**
 * Identity composer for `@beep/n3`.
 *
 * **Example** (Make N3 package ID)
 *
 * ```ts import.meta.vitest name="Make N3 package ID"
 * import { $N3Id } from "@beep/identity"
 *
 * const id = $N3Id.make("N3")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $N3Id: Identity.IdentityComposer<"@beep/n3"> = composers.$N3Id;

/**
 * Identity composer for `@beep/pretext`.
 *
 * **Example** (Make Pretext package ID)
 *
 * ```ts import.meta.vitest name="Make Pretext package ID"
 * import { $PretextId } from "@beep/identity"
 *
 * const id = $PretextId.make("Pretext")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PretextId: Identity.IdentityComposer<"@beep/pretext"> = composers.$PretextId;

/**
 * Identity composer for `@beep/graph-3d`.
 *
 * **Example** (Make Graph 3D package ID)
 *
 * ```ts import.meta.vitest name="Make Graph 3D package ID"
 * import { $Graph3dId } from "@beep/identity"
 *
 * const id = $Graph3dId.make("Graph3D")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $Graph3dId: Identity.IdentityComposer<"@beep/graph-3d"> = composers.$Graph3dId;

/**
 * Identity composer for `@beep/dock`.
 *
 * **Example** (Make Dock package ID)
 *
 * ```ts import.meta.vitest name="Make Dock package ID"
 * import { $DockId } from "@beep/identity"
 *
 * const id = $DockId.make("Dock")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DockId: Identity.IdentityComposer<"@beep/dock"> = composers.$DockId;

/**
 * Identity composer for `@beep/dock-react`.
 *
 * **Example** (Make Dock React package ID)
 *
 * ```ts import.meta.vitest name="Make Dock React package ID"
 * import { $DockReactId } from "@beep/identity"
 *
 * const id = $DockReactId.make("DockReact")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DockReactId: Identity.IdentityComposer<"@beep/dock-react"> = composers.$DockReactId;

/**
 * Identity composer for `@beep/ontology-client`.
 *
 * **Example** (Make ontology client package ID)
 *
 * ```ts import.meta.vitest name="Make ontology client package ID"
 * import { $OntologyClientId } from "@beep/identity"
 *
 * const id = $OntologyClientId.make("OntologyClient")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OntologyClientId: Identity.IdentityComposer<"@beep/ontology-client"> = composers.$OntologyClientId;

/**
 * Identity composer for `@beep/ontology-config`.
 *
 * **Example** (Make ontology config package ID)
 *
 * ```ts import.meta.vitest name="Make ontology config package ID"
 * import { $OntologyConfigId } from "@beep/identity"
 *
 * const id = $OntologyConfigId.make("OntologyConfig")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OntologyConfigId: Identity.IdentityComposer<"@beep/ontology-config"> = composers.$OntologyConfigId;

/**
 * Identity composer for `@beep/ontology-domain`.
 *
 * **Example** (Make ontology domain package ID)
 *
 * ```ts import.meta.vitest name="Make ontology domain package ID"
 * import { $OntologyDomainId } from "@beep/identity"
 *
 * const id = $OntologyDomainId.make("OntologyDomain")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OntologyDomainId: Identity.IdentityComposer<"@beep/ontology-domain"> = composers.$OntologyDomainId;

/**
 * Identity composer for `@beep/ontology-server`.
 *
 * **Example** (Make ontology server package ID)
 *
 * ```ts import.meta.vitest name="Make ontology server package ID"
 * import { $OntologyServerId } from "@beep/identity"
 *
 * const id = $OntologyServerId.make("OntologyServer")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OntologyServerId: Identity.IdentityComposer<"@beep/ontology-server"> = composers.$OntologyServerId;

/**
 * Identity composer for `@beep/ontology-ui`.
 *
 * **Example** (Make ontology UI package ID)
 *
 * ```ts import.meta.vitest name="Make ontology UI package ID"
 * import { $OntologyUiId } from "@beep/identity"
 *
 * const id = $OntologyUiId.make("OntologyUi")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OntologyUiId: Identity.IdentityComposer<"@beep/ontology-ui"> = composers.$OntologyUiId;

/**
 * Identity composer for `@beep/ontology-use-cases`.
 *
 * **Example** (Make ontology use-cases package ID)
 *
 * ```ts import.meta.vitest name="Make ontology use-cases package ID"
 * import { $OntologyUseCasesId } from "@beep/identity"
 *
 * const id = $OntologyUseCasesId.make("OntologyUseCases")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OntologyUseCasesId: Identity.IdentityComposer<"@beep/ontology-use-cases"> = composers.$OntologyUseCasesId;

/**
 * Identity composer for `@beep/oxigraph`.
 *
 * **Example** (Make Oxigraph package ID)
 *
 * ```ts import.meta.vitest name="Make Oxigraph package ID"
 * import { $OxigraphId } from "@beep/identity"
 *
 * const id = $OxigraphId.make("Oxigraph")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OxigraphId: Identity.IdentityComposer<"@beep/oxigraph"> = composers.$OxigraphId;

/**
 * Identity composer for `@beep/shacl`.
 *
 * **Example** (Make SHACL package ID)
 *
 * ```ts import.meta.vitest name="Make SHACL package ID"
 * import { $ShaclId } from "@beep/identity"
 *
 * const id = $ShaclId.make("Shacl")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ShaclId: Identity.IdentityComposer<"@beep/shacl"> = composers.$ShaclId;

/**
 * Identity composer for `@beep/storybook`.
 *
 * **Example** (Make Storybook package ID)
 *
 * ```ts import.meta.vitest name="Make Storybook package ID"
 * import { $StorybookId } from "@beep/identity"
 *
 * const id = $StorybookId.make("Storybook")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $StorybookId: Identity.IdentityComposer<"@beep/storybook"> = composers.$StorybookId;

/**
 * Identity composer for `@beep/tsgo-shim`.
 *
 * **Example** (Make TSGO shim package ID)
 *
 * ```ts import.meta.vitest name="Make TSGO shim package ID"
 * import { $TsgoShimId } from "@beep/identity"
 *
 * const id = $TsgoShimId.make("TsgoShim")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TsgoShimId: Identity.IdentityComposer<"@beep/tsgo-shim"> = composers.$TsgoShimId;

/**
 * Identity composer for `@beep/doc-text`.
 *
 * **Example** (Make doc text package ID)
 *
 * ```ts import.meta.vitest name="Make doc text package ID"
 * import { $DocTextId } from "@beep/identity"
 *
 * const id = $DocTextId.make("DocText")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DocTextId: Identity.IdentityComposer<"@beep/doc-text"> = composers.$DocTextId;

/**
 * Identity composer for `@beep/documents-tables`.
 *
 * **Example** (Make documents tables package ID)
 *
 * ```ts import.meta.vitest name="Make documents tables package ID"
 * import { $DocumentsTablesId } from "@beep/identity"
 *
 * const id = $DocumentsTablesId.make("DocumentsTables")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DocumentsTablesId: Identity.IdentityComposer<"@beep/documents-tables"> = composers.$DocumentsTablesId;

/**
 * Identity composer for `@beep/tailscale`.
 *
 * **Example** (Make Tailscale package ID)
 *
 * ```ts import.meta.vitest name="Make Tailscale package ID"
 * import { $TailscaleId } from "@beep/identity"
 *
 * const id = $TailscaleId.make("Tailscale")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TailscaleId: Identity.IdentityComposer<"@beep/tailscale"> = composers.$TailscaleId;

/**
 * Identity composer for `@beep/agents-tables`.
 *
 * **Example** (Make agents tables package ID)
 *
 * ```ts import.meta.vitest name="Make agents tables package ID"
 * import { $AgentsTablesId } from "@beep/identity"
 *
 * const id = $AgentsTablesId.make("AgentsTables")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AgentsTablesId: Identity.IdentityComposer<"@beep/agents-tables"> = composers.$AgentsTablesId;

/**
 * Identity composer for `@beep/epistemic-config`.
 *
 * **Example** (Make epistemic config package ID)
 *
 * ```ts import.meta.vitest name="Make epistemic config package ID"
 * import { $EpistemicConfigId } from "@beep/identity"
 *
 * const id = $EpistemicConfigId.make("EpistemicConfig")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EpistemicConfigId: Identity.IdentityComposer<"@beep/epistemic-config"> = composers.$EpistemicConfigId;

/**
 * Identity composer for `@beep/law-practice-tables`.
 *
 * **Example** (Make law practice tables package ID)
 *
 * ```ts import.meta.vitest name="Make law practice tables package ID"
 * import { $LawPracticeTablesId } from "@beep/identity"
 *
 * const id = $LawPracticeTablesId.make("LawPracticeTables")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LawPracticeTablesId: Identity.IdentityComposer<"@beep/law-practice-tables"> =
  composers.$LawPracticeTablesId;

/**
 * Identity composer for `@beep/practice-kg-mcp`.
 *
 * **Example** (Make practice KG MCP package ID)
 *
 * ```ts import.meta.vitest name="Make practice KG MCP package ID"
 * import { $PracticeKgMcpId } from "@beep/identity"
 *
 * const id = $PracticeKgMcpId.make("PracticeKgMcp")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PracticeKgMcpId: Identity.IdentityComposer<"@beep/practice-kg-mcp"> = composers.$PracticeKgMcpId;

/**
 * Identity composer for `@beep/openclaw`.
 *
 * **Example** (Make Openclaw package ID)
 *
 * ```ts import.meta.vitest name="Make Openclaw package ID"
 * import { $OpenclawId } from "@beep/identity"
 *
 * const id = $OpenclawId.make("Openclaw")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OpenclawId: Identity.IdentityComposer<"@beep/openclaw"> = composers.$OpenclawId;

/**
 * Identity composer for `@beep/obs`.
 *
 * **Example** (Make OBS package ID)
 *
 * ```ts import.meta.vitest name="Make OBS package ID"
 * import { $ObsId } from "@beep/identity"
 *
 * const id = $ObsId.make("Obs")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ObsId: Identity.IdentityComposer<"@beep/obs"> = composers.$ObsId;

/**
 * Identity composer for `@beep/exiftool`.
 *
 * **Example** (Make ExifTool package ID)
 *
 * ```ts import.meta.vitest name="Make ExifTool package ID"
 * import { $ExiftoolId } from "@beep/identity"
 *
 * const id = $ExiftoolId.make("Exiftool")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ExiftoolId: Identity.IdentityComposer<"@beep/exiftool"> = composers.$ExiftoolId;

/**
 * Identity composer for `@beep/qa-capture`.
 *
 * **Example** (Make QA capture package ID)
 *
 * ```ts import.meta.vitest name="Make QA capture package ID"
 * import { $QaCaptureId } from "@beep/identity"
 *
 * const id = $QaCaptureId.make("QaCapture")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $QaCaptureId: Identity.IdentityComposer<"@beep/qa-capture"> = composers.$QaCaptureId;

/**
 * Identity composer for `@beep/gov-legal-mcp`.
 *
 * **Example** (Make gov legal MCP package ID)
 *
 * ```ts import.meta.vitest name="Make gov legal MCP package ID"
 * import { $GovLegalMcpId } from "@beep/identity"
 *
 * const id = $GovLegalMcpId.make("GovLegalMcp")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $GovLegalMcpId: Identity.IdentityComposer<"@beep/gov-legal-mcp"> = composers.$GovLegalMcpId;

/**
 * Identity composer for `@beep/epistemic-client`.
 *
 * **Example** (Make epistemic client package ID)
 *
 * ```ts
 * import { $EpistemicClientId } from "@beep/identity"
 *
 * console.log($EpistemicClientId.make("ContradictionTriage"))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EpistemicClientId: Identity.IdentityComposer<"@beep/epistemic-client"> = composers.$EpistemicClientId;

/**
 * Identity composer for `@beep/epistemic-ui`.
 *
 * **Example** (Make epistemic UI package ID)
 *
 * ```ts
 * import { $EpistemicUiId } from "@beep/identity"
 *
 * console.log($EpistemicUiId.make("ContradictionTriage"))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EpistemicUiId: Identity.IdentityComposer<"@beep/epistemic-ui"> = composers.$EpistemicUiId;

/**
 * Identity composer for `@beep/effect-drizzle`.
 *
 * **Example** (Compose an identifier)
 *
 * ```ts
 * import { $EffectDrizzleId } from "@beep/identity/packages"
 *
 * console.log($EffectDrizzleId.make("EffectDrizzle"))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EffectDrizzleId: Identity.IdentityComposer<"@beep/effect-drizzle"> = composers.$EffectDrizzleId;

/**
 * Identity composer for `@beep/skill-contract`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $SkillContractId } from "@beep/identity"
 *
 * const id = $SkillContractId.make("SkillContract")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SkillContractId: Identity.IdentityComposer<"@beep/skill-contract"> = composers.$SkillContractId;

/**
 * Identity composer for `@beep/codegen-kit`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $CodegenKitId } from "@beep/identity"
 *
 * const id = $CodegenKitId.make("CodegenKit")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $CodegenKitId: Identity.IdentityComposer<"@beep/codegen-kit"> = composers.$CodegenKitId;

/**
 * Identity composer for `@beep/brand`.
 *
 * **Example** (Make package ID)
 *
 * ```ts
 * import { $BrandId } from "@beep/identity"
 *
 * const id = $BrandId.make("Brand")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $BrandId: Identity.IdentityComposer<"@beep/brand"> = composers.$BrandId;

/**
 * Identity composer for `@beep/openai`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $OpenaiId } from "@beep/identity"
 *
 * const id = $OpenaiId.make("Openai")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OpenaiId: Identity.IdentityComposer<"@beep/openai"> = composers.$OpenaiId;

/**
 * Identity composer for `@beep/todox`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $TodoxId } from "@beep/identity"
 *
 * const id = $TodoxId.make("Todox")
 * id // => "@beep/todox/Todox"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TodoxId: Identity.IdentityComposer<"@beep/todox"> = composers.$TodoxId;

/**
 * Identity composer for `@beep/box-provisioning`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $BoxProvisioningId } from "@beep/identity"
 *
 * const id = $BoxProvisioningId.make("BoxProvisioning")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $BoxProvisioningId: Identity.IdentityComposer<"@beep/box-provisioning"> = composers.$BoxProvisioningId;

/**
 * Identity composer for `@beep/freshbooks`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $FreshbooksId } from "@beep/identity/packages"
 *
 * const id = $FreshbooksId.make("Freshbooks")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $FreshbooksId: Identity.IdentityComposer<"@beep/freshbooks"> = composers.$FreshbooksId;
