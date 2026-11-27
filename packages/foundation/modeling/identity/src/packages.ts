/**
 * Canonical identity composers for every `@beep/*` workspace namespace.
 *
 * **Details**
 *
 * Each export is a pre-built {@link Identity.IdentityComposer} scoped to a
 * specific workspace package. Use these to derive schema identifiers,
 * error tags, and service keys without manually calling `make`.
 *
 * Every package export is an independent, pure-annotated `$I.create("<slug>")`
 * leaf, so a bundle that imports one composer drops every other slug. The
 * `$I.compose(...)` groups are the registry that `beep create-package` and the
 * identity-registry lint read and write; they are pure and only
 * {@link RepoPkgs} evaluates them.
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
import { IdentityAuthority } from "./Authority.ts";
import * as Identity from "./Id.ts";

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
export const $I = Identity.make("beep", { authority: IdentityAuthority, prefix: "beep" }).$BeepId;

const generatedComposers = /*#__PURE__*/ $I.compose(
  // Foundation Packages
  "chalk",
  "colors",
  "data",
  "identity",
  "langextract",
  "md",
  "nlp-processing",
  "observability",
  "ontology",
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
  "ffmpeg",
  "postgres",
  "anthropic",
  "scratchpad",
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
  "freshbooks",
  "test-runner",
  "xstate",
  "tesseract",
  "poppler",
  "docket-intake",
  "practice-mail-tagging",
  "occt",
  "pdf-tools",
  "technical-drawing",
  "practice-identify",
  "practice-m365-contacts",
  "practice-claude-mod",
  "windows-secrets",
  "practice-gateway",
  "mcpb-kit",
  "practice-setup",
  "practice-review-hub",
  "palantiri",
  "jsonc",
  "jsonl",
  "semver",
  "spdx",
  "github-references",
  "github-commands",
  "commands",
  "public-site",
  "git",
  "glob",
  "managed-section",
  "memfs",
  "toml",
  "yaml",
  "npm-spec",
  "tsconfig",
  "walker",
  "github",
  "runtime-env",
  "epistemics",
  "markdown",
  "github-reporting",
  "repo-tsconfig",
  "package-json",
  "config-file",
  "lockfiles",
  "xdg",
  "cli-kit",
  "repo-workspaces",
  "sbom",
  "github-actions",
  "beep-effect-web",
  "party-domain",
  "party-use-cases",
  "party-server",
  "repo-cli-kit",
  "alchemy-postgres",
  "firecrawl",
  "execution-authority-domain",
  "execution-authority-use-cases",
  "execution-authority-tables",
  "execution-authority-server",
  "execution-authority-config",
  "eyecite",
  "agent-memory-store",
  "sqlite",
  "infra-turbo-cache",
  "alchemy-github-runners",
  "alchemy-aws-extras",
  "alchemy-vercel",
  "infra-cost-controls",
  "infra-hosts",
  "infra-github",
  "contract-kit",
  "infra-ci-runners",
  "gate-report",
  "repo-gate-record",
  "repo-gate-run",
  "csv",
  "xlsx",
  "repo-gate-vitest",
  "text",
  "annotation",
  "playwright"
);

// GENERATED LAB COMPOSERS START — synced from apps/labs/* workspace manifests by beep; do not edit by hand. On merge conflict, rerun `bun run beep lint identity-registry --fix`.
const generatedLabComposers = /*#__PURE__*/ $I.compose(
  "api-docs",
  "ciops",
  "lane-cockpit",
  "lejeune-bolt-workbench",
  "semantica",
  "social-mapper",
  "trustgraph-workbench"
);
// GENERATED LAB COMPOSERS END

/**
 * Record type of every registered package composer, keyed by accessor name.
 *
 * **Details**
 *
 * The type is read off the `$I.compose(...)` registry groups, so it names
 * every slug the identity-registry lint and `beep create-package` maintain,
 * plus the `$LangExtractId` casing alias. {@link RepoPkgs} has this type.
 *
 * **Example** (Read a composer type from the registry)
 *
 * ```ts
 * import type { RegisteredComposers } from "@beep/identity/packages"
 *
 * type SchemaComposer = RegisteredComposers["$SchemaId"]
 * const accessor: keyof RegisteredComposers = "$SchemaId"
 * console.log(accessor)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RegisteredComposers = typeof generatedComposers &
  typeof generatedLabComposers & {
    readonly $LangExtractId: typeof generatedComposers.$LangextractId;
  };

const registeredComposers = (): RegisteredComposers => ({
  ...generatedComposers,
  ...generatedLabComposers,
  $LangExtractId: generatedComposers.$LangextractId,
});

// GENERATED LAB EXPORTS START — synced from apps/labs/* workspace manifests by beep; do not edit by hand. On merge conflict, rerun `bun run beep lint identity-registry --fix`.

/**
 * Identity composer for `@beep/api-docs`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $ApiDocsId } from "@beep/identity/packages"
 *
 * const id = $ApiDocsId.make("ApiDocs")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ApiDocsId: Identity.IdentityComposer<"@beep/api-docs"> = /*#__PURE__*/ $I.create("api-docs");

/**
 * Identity composer for `@beep/ciops`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $CiopsId } from "@beep/identity/packages"
 *
 * const id = $CiopsId.make("Ciops")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $CiopsId: Identity.IdentityComposer<"@beep/ciops"> = /*#__PURE__*/ $I.create("ciops");

/**
 * Identity composer for `@beep/lane-cockpit`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $LaneCockpitId } from "@beep/identity/packages"
 *
 * const id = $LaneCockpitId.make("LaneCockpit")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LaneCockpitId: Identity.IdentityComposer<"@beep/lane-cockpit"> = /*#__PURE__*/ $I.create("lane-cockpit");

/**
 * Identity composer for `@beep/lejeune-bolt-workbench`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages"
 *
 * const id = $LejeuneBoltWorkbenchId.make("LejeuneBoltWorkbench")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LejeuneBoltWorkbenchId: Identity.IdentityComposer<"@beep/lejeune-bolt-workbench"> =
  /*#__PURE__*/ $I.create("lejeune-bolt-workbench");

/**
 * Identity composer for `@beep/semantica`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $SemanticaId } from "@beep/identity/packages"
 *
 * const id = $SemanticaId.make("Semantica")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SemanticaId: Identity.IdentityComposer<"@beep/semantica"> = /*#__PURE__*/ $I.create("semantica");

/**
 * Identity composer for `@beep/social-mapper`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $SocialMapperId } from "@beep/identity/packages"
 *
 * const id = $SocialMapperId.make("SocialMapper")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SocialMapperId: Identity.IdentityComposer<"@beep/social-mapper"> = /*#__PURE__*/ $I.create(
  "social-mapper"
);

/**
 * Identity composer for `@beep/trustgraph-workbench`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $TrustgraphWorkbenchId } from "@beep/identity/packages"
 *
 * const id = $TrustgraphWorkbenchId.make("TrustgraphWorkbench")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TrustgraphWorkbenchId: Identity.IdentityComposer<"@beep/trustgraph-workbench"> = /*#__PURE__*/ $I.create(
  "trustgraph-workbench"
);
// GENERATED LAB EXPORTS END

// --- foundation ---

/**
 * Identity composer for the `@beep/data` package.
 *
 * **Example** (Make data package ID)
 *
 * ```ts import.meta.vitest name="Make data package ID"
 * import { $DataId } from "@beep/identity/packages"
 *
 * const id = $DataId.make("Calendar")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DataId: Identity.IdentityComposer<"@beep/data"> = /*#__PURE__*/ $I.create("data");

/**
 * Identity composer for the `@beep/identity` package.
 *
 * **Example** (Make identity package ID)
 *
 * ```ts import.meta.vitest name="Make identity package ID"
 * import { $IdentityId } from "@beep/identity/packages"
 *
 * const id = $IdentityId.make("Composer")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $IdentityId: Identity.IdentityComposer<"@beep/identity"> = /*#__PURE__*/ $I.create("identity");

/**
 * Identity composer for the `@beep/schema` package.
 *
 * **Example** (Make schema package ID)
 *
 * ```ts import.meta.vitest name="Make schema package ID"
 * import { $SchemaId } from "@beep/identity/packages"
 *
 * const id = $SchemaId.make("EntityId")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SchemaId: Identity.IdentityComposer<"@beep/schema"> = /*#__PURE__*/ $I.create("schema");
/**
 * Identity composer for the `@beep/rdf` package.
 *
 * **Example** (Make RDF package ID)
 *
 * ```ts import.meta.vitest name="Make RDF package ID"
 * import { $RdfId } from "@beep/identity/packages"
 *
 * const id = $RdfId.make("Iri")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RdfId: Identity.IdentityComposer<"@beep/rdf"> = /*#__PURE__*/ $I.create("rdf");

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
export const $OntologyId: Identity.IdentityComposer<"@beep/ontology"> = /*#__PURE__*/ $I.create("ontology");

/**
 * Identity composer for the semantic-foundation vocabulary under `@beep/ontology`.
 *
 * **Example** (Log semantic foundation IRI)
 *
 * ```ts import.meta.vitest name="Log semantic foundation IRI"
 * import { $SemanticFoundationId } from "@beep/identity/packages"
 *
 * $SemanticFoundationId.iri // => "https://beep-effect.com/ns/ontology/semantic-foundation"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SemanticFoundationId = /*#__PURE__*/ $OntologyId.create("semantic-foundation");

/**
 * Identity composer for the epistemic slice vocabulary (claims, evidence quotes, claim subjects).
 *
 * **Details**
 *
 * The vocabulary is shared by every `@beep/epistemic-*` package, so it hangs off
 * the root composer instead of one package composer. Derive terms with
 * `create`; a slash namespace is the composer IRI plus a trailing `/`, because
 * identity segments cannot end in `/`.
 *
 * **Example** (Log epistemic claim class IRI)
 *
 * ```ts import.meta.vitest name="Log epistemic claim class IRI"
 * import { $EpistemicId } from "@beep/identity/packages"
 *
 * const claimSubjectPrefix = `${$EpistemicId.create("claim").iri}/`
 *
 * $EpistemicId.create("Claim").iri // => "https://beep-effect.com/ns/epistemic/Claim"
 * claimSubjectPrefix // => "https://beep-effect.com/ns/epistemic/claim/"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EpistemicId = /*#__PURE__*/ $I.create("epistemic");

/**
 * Identity composer for the QA evidence vocabulary (judge evidence and receipt
 * predicate types, the QA XMP namespace).
 *
 * **Details**
 *
 * The vocabulary is shared by `@beep/repo-cli` QA commands and `@beep/exiftool`,
 * so it hangs off the root composer instead of one package composer. The XMP
 * namespace is the versioned composer IRI plus a trailing `/`.
 *
 * **Example** (Log QA vocabulary IRI)
 *
 * ```ts import.meta.vitest name="Log QA vocabulary IRI"
 * import { $QaId } from "@beep/identity/packages"
 *
 * const xmpNamespace = `${$QaId.create("1.0").iri}/`
 *
 * $QaId.iri // => "https://beep-effect.com/ns/qa"
 * xmpNamespace // => "https://beep-effect.com/ns/qa/1.0/"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $QaId = /*#__PURE__*/ $I.create("qa");

/**
 * Identity composer for the `@beep/types` package.
 *
 * **Example** (Make types package ID)
 *
 * ```ts import.meta.vitest name="Make types package ID"
 * import { $TypesId } from "@beep/identity/packages"
 *
 * const id = $TypesId.make("NonEmpty")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TypesId: Identity.IdentityComposer<"@beep/types"> = /*#__PURE__*/ $I.create("types");

/**
 * Identity composer for the `@beep/utils` package.
 *
 * **Example** (Make utils package ID)
 *
 * ```ts import.meta.vitest name="Make utils package ID"
 * import { $UtilsId } from "@beep/identity/packages"
 *
 * const id = $UtilsId.make("Retry")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $UtilsId: Identity.IdentityComposer<"@beep/utils"> = /*#__PURE__*/ $I.create("utils");

// --- ui ---

/**
 * Identity composer for the `@beep/ui` package.
 *
 * **Example** (Make UI package ID)
 *
 * ```ts import.meta.vitest name="Make UI package ID"
 * import { $UiId } from "@beep/identity/packages"
 *
 * const id = $UiId.make("Button") // initial type: `Identity.IdentityComposer<"@beep/ui/Button">`
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $UiId: Identity.IdentityComposer<"@beep/ui"> = /*#__PURE__*/ $I.create("ui");

// --- tooling ---

/**
 * Identity composer for the `@beep/repo-ai-metrics` package.
 *
 * **Example** (Make repo AI metrics ID)
 *
 * ```ts import.meta.vitest name="Make repo AI metrics ID"
 * import { $RepoAiMetricsId } from "@beep/identity/packages"
 *
 * const id = $RepoAiMetricsId.make("AgentTask")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RepoAiMetricsId: Identity.IdentityComposer<"@beep/repo-ai-metrics"> = /*#__PURE__*/ $I.create(
  "repo-ai-metrics"
);

/**
 * Identity composer for the `@beep/repo-cli` package.
 *
 * **Example** (Make repo CLI package ID)
 *
 * ```ts import.meta.vitest name="Make repo CLI package ID"
 * import { $RepoCliId } from "@beep/identity/packages"
 *
 * const id = $RepoCliId.make("Command")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RepoCliId: Identity.IdentityComposer<"@beep/repo-cli"> = /*#__PURE__*/ $I.create("repo-cli");

/**
 * Identity composer for the `@beep/repo-configs` package.
 *
 * **Example** (Make repo configs package ID)
 *
 * ```ts import.meta.vitest name="Make repo configs package ID"
 * import { $RepoConfigsId } from "@beep/identity/packages"
 *
 * const id = $RepoConfigsId.make("Command")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RepoConfigsId: Identity.IdentityComposer<"@beep/repo-configs"> = /*#__PURE__*/ $I.create("repo-configs");

/**
 * Identity composer for the `@beep/repo-utils` package.
 *
 * **Example** (Make repo utils package ID)
 *
 * ```ts import.meta.vitest name="Make repo utils package ID"
 * import { $RepoUtilsId } from "@beep/identity/packages"
 *
 * const id = $RepoUtilsId.make("FileTree")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RepoUtilsId: Identity.IdentityComposer<"@beep/repo-utils"> = /*#__PURE__*/ $I.create("repo-utils");

/**
 * Identity composer for the `@beep/test-utils` package.
 *
 * **Example** (Make test utils package ID)
 *
 * ```ts import.meta.vitest name="Make test utils package ID"
 * import { $TestUtilsId } from "@beep/identity/packages"
 *
 * const id = $TestUtilsId.make("Fixture")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TestUtilsId: Identity.IdentityComposer<"@beep/test-utils"> = /*#__PURE__*/ $I.create("test-utils");

// --- shared ---

/**
 * Identity composer for the `@beep/shared-domain` package.
 *
 * **Example** (Make shared domain package ID)
 *
 * ```ts import.meta.vitest name="Make shared domain package ID"
 * import { $SharedDomainId } from "@beep/identity/packages"
 *
 * const id = $SharedDomainId.make("TenantId")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SharedDomainId: Identity.IdentityComposer<"@beep/shared-domain"> = /*#__PURE__*/ $I.create(
  "shared-domain"
);

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
export const $SharedUseCasesId: Identity.IdentityComposer<"@beep/shared-use-cases"> = /*#__PURE__*/ $I.create(
  "shared-use-cases"
);

/**
 * Identity composer for the `@beep/shared-tables` package.
 *
 * **Example** (Make shared tables package ID)
 *
 * ```ts import.meta.vitest name="Make shared tables package ID"
 * import { $SharedTablesId } from "@beep/identity/packages"
 *
 * const id = $SharedTablesId.make("AuditColumns")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SharedTablesId: Identity.IdentityComposer<"@beep/shared-tables"> = /*#__PURE__*/ $I.create(
  "shared-tables"
);

/**
 * Identity composer for the `@beep/semantic-web` package.
 *
 * **Example** (Make semantic web package ID)
 *
 * ```ts import.meta.vitest name="Make semantic web package ID"
 * import { $SemanticWebId } from "@beep/identity/packages"
 *
 * const id = $SemanticWebId.make("Triple")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SemanticWebId: Identity.IdentityComposer<"@beep/semantic-web"> = /*#__PURE__*/ $I.create("semantic-web");
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
export const $NlpProcessingId: Identity.IdentityComposer<"@beep/nlp-processing"> = /*#__PURE__*/ $I.create(
  "nlp-processing"
);

/**
 * Identity composer for the `@beep/langextract` package.
 *
 * **Example** (Make langextract package ID)
 *
 * ```ts import.meta.vitest name="Make langextract package ID"
 * import { $LangExtractId } from "@beep/identity/packages"
 *
 * const id = $LangExtractId.make("Extraction")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LangExtractId: Identity.IdentityComposer<"@beep/langextract"> = /*#__PURE__*/ $I.create("langextract");

/**
 * Identity composer for the `@beep/observability` package.
 *
 * **Example** (Make observability package ID)
 *
 * ```ts import.meta.vitest name="Make observability package ID"
 * import { $ObservabilityId } from "@beep/identity/packages"
 *
 * const id = $ObservabilityId.make("Tracer")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ObservabilityId: Identity.IdentityComposer<"@beep/observability"> = /*#__PURE__*/ $I.create(
  "observability"
);

/**
 * Identity composer for the `@beep/colors` package.
 *
 * **Example** (Make colors package ID)
 *
 * ```ts import.meta.vitest name="Make colors package ID"
 * import { $ColorsId } from "@beep/identity/packages"
 *
 * const id = $ColorsId.make("Palette")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ColorsId: Identity.IdentityComposer<"@beep/colors"> = /*#__PURE__*/ $I.create("colors");

/**
 * Identity composer for the `@beep/chalk` package.
 *
 * **Example** (Make chalk package ID)
 *
 * ```ts import.meta.vitest name="Make chalk package ID"
 * import { $ChalkId } from "@beep/identity/packages"
 *
 * const id = $ChalkId.make("Formatter")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ChalkId: Identity.IdentityComposer<"@beep/chalk"> = /*#__PURE__*/ $I.create("chalk");

/**
 * Identity composer for the `@beep/repo-docgen` package.
 *
 * **Example** (Make repo docgen package ID)
 *
 * ```ts import.meta.vitest name="Make repo docgen package ID"
 * import { $RepoDocgenId } from "@beep/identity/packages"
 *
 * const id = $RepoDocgenId.make("Generator")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RepoDocgenId: Identity.IdentityComposer<"@beep/repo-docgen"> = /*#__PURE__*/ $I.create("repo-docgen");

// --- p3 professional runtime proof ---

/**
 * Identity composer for the `@beep/workspace-domain` package.
 *
 * **Example** (Make workspace domain package ID)
 *
 * ```ts import.meta.vitest name="Make workspace domain package ID"
 * import { $WorkspaceDomainId } from "@beep/identity/packages"
 *
 * const id = $WorkspaceDomainId.make("ContextPacket")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $WorkspaceDomainId: Identity.IdentityComposer<"@beep/workspace-domain"> = /*#__PURE__*/ $I.create(
  "workspace-domain"
);

/**
 * Identity composer for the `@beep/epistemic-domain` package.
 *
 * **Example** (Make epistemic domain package ID)
 *
 * ```ts import.meta.vitest name="Make epistemic domain package ID"
 * import { $EpistemicDomainId } from "@beep/identity/packages"
 *
 * const id = $EpistemicDomainId.make("Evidence")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EpistemicDomainId: Identity.IdentityComposer<"@beep/epistemic-domain"> = /*#__PURE__*/ $I.create(
  "epistemic-domain"
);

/**
 * Identity composer for the `@beep/epistemic-use-cases` package.
 *
 * **Example** (Make epistemic use-cases ID)
 *
 * ```ts
 * import { $EpistemicUseCasesId } from "@beep/identity/packages"
 *
 * const id = $EpistemicUseCasesId.make("ClaimGate")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EpistemicUseCasesId: Identity.IdentityComposer<"@beep/epistemic-use-cases"> = /*#__PURE__*/ $I.create(
  "epistemic-use-cases"
);

/**
 * Identity composer for the `@beep/agents-domain` package.
 *
 * **Example** (Make agents domain package ID)
 *
 * ```ts import.meta.vitest name="Make agents domain package ID"
 * import { $AgentsDomainId } from "@beep/identity/packages"
 *
 * const id = $AgentsDomainId.make("Agent")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AgentsDomainId: Identity.IdentityComposer<"@beep/agents-domain"> = /*#__PURE__*/ $I.create(
  "agents-domain"
);

/**
 * Identity composer for the `@beep/agents-server` package.
 *
 * **Example** (Make agents server package ID)
 *
 * ```ts import.meta.vitest name="Make agents server package ID"
 * import { $AgentsServerId } from "@beep/identity/packages"
 *
 * const id = $AgentsServerId.make("Agent")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AgentsServerId: Identity.IdentityComposer<"@beep/agents-server"> = /*#__PURE__*/ $I.create(
  "agents-server"
);

/**
 * Identity composer for the `@beep/agents-use-cases` package.
 *
 * **Example** (Make agents use-cases package ID)
 *
 * ```ts import.meta.vitest name="Make agents use-cases package ID"
 * import { $AgentsUseCasesId } from "@beep/identity/packages"
 *
 * const id = $AgentsUseCasesId.make("RuntimeScope")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AgentsUseCasesId: Identity.IdentityComposer<"@beep/agents-use-cases"> = /*#__PURE__*/ $I.create(
  "agents-use-cases"
);

/**
 * Identity composer for the `@beep/agents-client` package.
 *
 * **Example** (Make agents client package ID)
 *
 * ```ts import.meta.vitest name="Make agents client package ID"
 * import { $AgentsClientId } from "@beep/identity/packages"
 *
 * const id = $AgentsClientId.make("StreamingTurn")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AgentsClientId: Identity.IdentityComposer<"@beep/agents-client"> = /*#__PURE__*/ $I.create(
  "agents-client"
);

/**
 * Identity composer for the `@beep/law-practice-domain` package.
 *
 * **Example** (Make law practice domain ID)
 *
 * ```ts import.meta.vitest name="Make law practice domain ID"
 * import { $LawPracticeDomainId } from "@beep/identity/packages"
 *
 * const id = $LawPracticeDomainId.make("Matter")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LawPracticeDomainId: Identity.IdentityComposer<"@beep/law-practice-domain"> = /*#__PURE__*/ $I.create(
  "law-practice-domain"
);

/**
 * Identity composer for the `@beep/law-practice-use-cases` package.
 *
 * **Example** (Make law practice use-cases ID)
 *
 * ```ts
 * import { $LawPracticeUseCasesId } from "@beep/identity/packages"
 *
 * const id = $LawPracticeUseCasesId.make("OfficeActionReview")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LawPracticeUseCasesId: Identity.IdentityComposer<"@beep/law-practice-use-cases"> =
  /*#__PURE__*/ $I.create("law-practice-use-cases");

/**
 * Identity composer for the `@beep/law-practice-server` package.
 *
 * **Example** (Make law practice server ID)
 *
 * ```ts
 * import { $LawPracticeServerId } from "@beep/identity/packages"
 *
 * const id = $LawPracticeServerId.make("LawPracticeServerLive")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LawPracticeServerId: Identity.IdentityComposer<"@beep/law-practice-server"> = /*#__PURE__*/ $I.create(
  "law-practice-server"
);

/**
 * Identity composer for the `@beep/professional-desktop` package.
 *
 * **Example** (Make professional desktop package ID)
 *
 * ```ts import.meta.vitest name="Make professional desktop package ID"
 * import { $ProfessionalDesktopId } from "@beep/identity/packages"
 *
 * const id = $ProfessionalDesktopId.make("Workbench")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ProfessionalDesktopId: Identity.IdentityComposer<"@beep/professional-desktop"> = /*#__PURE__*/ $I.create(
  "professional-desktop"
);

/**
 * RepoPkgs - export object containing all package IdentityComposer's
 *
 * **Details**
 *
 * The record is built from the `$I.compose(...)` registry groups behind a
 * pure annotation, so a bundle that never reads `RepoPkgs` drops it and the
 * full slug list with it.
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
export const RepoPkgs: RegisteredComposers = /*#__PURE__*/ registeredComposers();

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
export const $MdId: Identity.IdentityComposer<"@beep/md"> = /*#__PURE__*/ $I.create("md");

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
export const $OipWebId: Identity.IdentityComposer<"@beep/oip-web"> = /*#__PURE__*/ $I.create("oip-web");

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
export const $DrizzleId: Identity.IdentityComposer<"@beep/drizzle"> = /*#__PURE__*/ $I.create("drizzle");

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
export const $DuckdbId: Identity.IdentityComposer<"@beep/duckdb"> = /*#__PURE__*/ $I.create("duckdb");

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
export const $FfmpegId: Identity.IdentityComposer<"@beep/ffmpeg"> = /*#__PURE__*/ $I.create("ffmpeg");

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
export const $PostgresId: Identity.IdentityComposer<"@beep/postgres"> = /*#__PURE__*/ $I.create("postgres");

/**
 * Identity composer for `@beep/anthropic`.
 *
 * **Example** (Make anthropic package ID)
 *
 * ```ts
 * import { $AnthropicId } from "@beep/identity/packages"
 *
 * const id = $AnthropicId.make("Anthropic")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AnthropicId: Identity.IdentityComposer<"@beep/anthropic"> = /*#__PURE__*/ $I.create("anthropic");

/**
 * Identity composer for `@beep/acp`.
 *
 * **Example** (Make ACP package ID)
 *
 * ```ts
 * import { $AcpId } from "@beep/identity/packages"
 *
 * const id = $AcpId.make("AcpClient")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AcpId: Identity.IdentityComposer<"@beep/acp"> = /*#__PURE__*/ $I.create("acp");

/**
 * Identity composer for `@beep/openai-compat`.
 *
 * **Example** (Make OpenAI compat package ID)
 *
 * ```ts
 * import { $OpenaiCompatId } from "@beep/identity/packages"
 *
 * const id = $OpenaiCompatId.make("LanguageModel")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OpenaiCompatId: Identity.IdentityComposer<"@beep/openai-compat"> = /*#__PURE__*/ $I.create(
  "openai-compat"
);

/**
 * Identity composer for `@beep/workspace-tables`.
 *
 * **Example** (Make workspace tables package ID)
 *
 * ```ts
 * import { $WorkspaceTablesId } from "@beep/identity/packages"
 *
 * const id = $WorkspaceTablesId.make("WorkspaceTable")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $WorkspaceTablesId: Identity.IdentityComposer<"@beep/workspace-tables"> = /*#__PURE__*/ $I.create(
  "workspace-tables"
);

/**
 * Identity composer for `@beep/workspace-use-cases`.
 *
 * **Example** (Make workspace use-cases package ID)
 *
 * ```ts
 * import { $WorkspaceUseCasesId } from "@beep/identity/packages"
 *
 * const id = $WorkspaceUseCasesId.make("ThreadStore")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $WorkspaceUseCasesId: Identity.IdentityComposer<"@beep/workspace-use-cases"> = /*#__PURE__*/ $I.create(
  "workspace-use-cases"
);

/**
 * Identity composer for `@beep/workspace-server`.
 *
 * **Example** (Make workspace server package ID)
 *
 * ```ts
 * import { $WorkspaceServerId } from "@beep/identity/packages"
 *
 * const id = $WorkspaceServerId.make("ThreadStoreLive")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $WorkspaceServerId: Identity.IdentityComposer<"@beep/workspace-server"> = /*#__PURE__*/ $I.create(
  "workspace-server"
);

/**
 * Identity composer for `@beep/documents-domain`.
 *
 * **Example** (Make documents domain package ID)
 *
 * ```ts
 * import { $DocumentsDomainId } from "@beep/identity/packages"
 *
 * const id = $DocumentsDomainId.make("LegalDocumentTaxonomy")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DocumentsDomainId: Identity.IdentityComposer<"@beep/documents-domain"> = /*#__PURE__*/ $I.create(
  "documents-domain"
);

/**
 * Identity composer for `@beep/documents-use-cases`.
 *
 * **Example** (Make documents use-cases package ID)
 *
 * ```ts
 * import { $DocumentsUseCasesId } from "@beep/identity/packages"
 *
 * const id = $DocumentsUseCasesId.make("FilingDecision")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DocumentsUseCasesId: Identity.IdentityComposer<"@beep/documents-use-cases"> = /*#__PURE__*/ $I.create(
  "documents-use-cases"
);

/**
 * Identity composer for `@beep/documents-server`.
 *
 * **Example** (Make documents server package ID)
 *
 * ```ts
 * import { $DocumentsServerId } from "@beep/identity/packages"
 *
 * const id = $DocumentsServerId.make("DocumentsServerLive")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DocumentsServerId: Identity.IdentityComposer<"@beep/documents-server"> = /*#__PURE__*/ $I.create(
  "documents-server"
);

/**
 * Identity composer for `@beep/architecture-lab-domain`.
 *
 * **Example** (Make architecture lab domain ID)
 *
 * ```ts
 * import { $ArchitectureLabDomainId } from "@beep/identity/packages"
 *
 * const id = $ArchitectureLabDomainId.make("WorkItem")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ArchitectureLabDomainId: Identity.IdentityComposer<"@beep/architecture-lab-domain"> =
  /*#__PURE__*/ $I.create("architecture-lab-domain");

/**
 * Identity composer for `@beep/architecture-lab-use-cases`.
 *
 * **Example** (Make architecture lab use-cases ID)
 *
 * ```ts
 * import { $ArchitectureLabUseCasesId } from "@beep/identity/packages"
 *
 * const id = $ArchitectureLabUseCasesId.make("WorkItemService")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ArchitectureLabUseCasesId: Identity.IdentityComposer<"@beep/architecture-lab-use-cases"> =
  /*#__PURE__*/ $I.create("architecture-lab-use-cases");

/**
 * Identity composer for `@beep/architecture-lab-config`.
 *
 * **Example** (Make architecture lab config ID)
 *
 * ```ts
 * import { $ArchitectureLabConfigId } from "@beep/identity/packages"
 *
 * const id = $ArchitectureLabConfigId.make("Config")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ArchitectureLabConfigId: Identity.IdentityComposer<"@beep/architecture-lab-config"> =
  /*#__PURE__*/ $I.create("architecture-lab-config");

/**
 * Identity composer for `@beep/architecture-lab-server`.
 *
 * **Example** (Make architecture lab server ID)
 *
 * ```ts
 * import { $ArchitectureLabServerId } from "@beep/identity/packages"
 *
 * const id = $ArchitectureLabServerId.make("Layer")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ArchitectureLabServerId: Identity.IdentityComposer<"@beep/architecture-lab-server"> =
  /*#__PURE__*/ $I.create("architecture-lab-server");

/**
 * Identity composer for `@beep/architecture-lab-tables`.
 *
 * **Example** (Make architecture lab tables ID)
 *
 * ```ts
 * import { $ArchitectureLabTablesId } from "@beep/identity/packages"
 *
 * const id = $ArchitectureLabTablesId.make("WorkItemTable")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ArchitectureLabTablesId: Identity.IdentityComposer<"@beep/architecture-lab-tables"> =
  /*#__PURE__*/ $I.create("architecture-lab-tables");

/**
 * Identity composer for `@beep/architecture-lab-client`.
 *
 * **Example** (Make architecture lab client ID)
 *
 * ```ts
 * import { $ArchitectureLabClientId } from "@beep/identity/packages"
 *
 * const id = $ArchitectureLabClientId.make("WorkItemClient")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ArchitectureLabClientId: Identity.IdentityComposer<"@beep/architecture-lab-client"> =
  /*#__PURE__*/ $I.create("architecture-lab-client");

/**
 * Identity composer for `@beep/architecture-lab-ui`.
 *
 * **Example** (Make architecture lab UI ID)
 *
 * ```ts
 * import { $ArchitectureLabUiId } from "@beep/identity/packages"
 *
 * const id = $ArchitectureLabUiId.make("WorkItemViewModel")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ArchitectureLabUiId: Identity.IdentityComposer<"@beep/architecture-lab-ui"> = /*#__PURE__*/ $I.create(
  "architecture-lab-ui"
);

/**
 * Identity composer for `@beep/architecture-lab-proof`.
 *
 * **Example** (Make architecture lab proof ID)
 *
 * ```ts
 * import { $ArchitectureLabProofId } from "@beep/identity/packages"
 *
 * const id = $ArchitectureLabProofId.make("Proof")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ArchitectureLabProofId: Identity.IdentityComposer<"@beep/architecture-lab-proof"> =
  /*#__PURE__*/ $I.create("architecture-lab-proof");

/**
 * Identity composer for `@beep/runpod`.
 *
 * **Example** (Make Runpod package ID)
 *
 * ```ts
 * import { $RunpodId } from "@beep/identity/packages"
 *
 * const id = $RunpodId.make("Runpod")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RunpodId: Identity.IdentityComposer<"@beep/runpod"> = /*#__PURE__*/ $I.create("runpod");

/**
 * Identity composer for `@beep/onepassword-cli`.
 *
 * **Example** (Make 1Password CLI package ID)
 *
 * ```ts
 * import { $OnepasswordCliId } from "@beep/identity/packages"
 *
 * const id = $OnepasswordCliId.make("OnepasswordCli")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OnepasswordCliId: Identity.IdentityComposer<"@beep/onepassword-cli"> = /*#__PURE__*/ $I.create(
  "onepassword-cli"
);

/**
 * Identity composer for `@beep/discord`.
 *
 * **Example** (Make Discord package ID)
 *
 * ```ts
 * import { $DiscordId } from "@beep/identity/packages"
 *
 * const id = $DiscordId.make("Discord")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DiscordId: Identity.IdentityComposer<"@beep/discord"> = /*#__PURE__*/ $I.create("discord");

/**
 * Identity composer for `@beep/ai-provider-cli`.
 *
 * **Example** (Make AI provider CLI package ID)
 *
 * ```ts
 * import { $AiProviderCliId } from "@beep/identity/packages"
 *
 * const id = $AiProviderCliId.make("AiProviderCli")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AiProviderCliId: Identity.IdentityComposer<"@beep/ai-provider-cli"> = /*#__PURE__*/ $I.create(
  "ai-provider-cli"
);

/**
 * Identity composer for `@beep/sanity`.
 *
 * **Example** (Make Sanity package ID)
 *
 * ```ts
 * import { $SanityId } from "@beep/identity/packages"
 *
 * const id = $SanityId.make("Sanity")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SanityId: Identity.IdentityComposer<"@beep/sanity"> = /*#__PURE__*/ $I.create("sanity");

/**
 * Identity composer for `@beep/hubspot`.
 *
 * **Example** (Make HubSpot package ID)
 *
 * ```ts
 * import { $HubspotId } from "@beep/identity/packages"
 *
 * const id = $HubspotId.make("Hubspot")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $HubspotId: Identity.IdentityComposer<"@beep/hubspot"> = /*#__PURE__*/ $I.create("hubspot");

/**
 * Identity composer for `@beep/phoenix`.
 *
 * **Example** (Make Phoenix package ID)
 *
 * ```ts
 * import { $PhoenixId } from "@beep/identity/packages"
 *
 * const id = $PhoenixId.make("Phoenix")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PhoenixId: Identity.IdentityComposer<"@beep/phoenix"> = /*#__PURE__*/ $I.create("phoenix");

/**
 * Identity composer for `@beep/ai-sync`.
 *
 * **Example** (Make AI sync package ID)
 *
 * ```ts
 * import { $AiSyncId } from "@beep/identity/packages"
 *
 * const id = $AiSyncId.make("AiSync")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AiSyncId: Identity.IdentityComposer<"@beep/ai-sync"> = /*#__PURE__*/ $I.create("ai-sync");

/**
 * Identity composer for `@beep/box`.
 *
 * **Example** (Make Box package ID)
 *
 * ```ts import.meta.vitest name="Make Box package ID"
 * import { $BoxId } from "@beep/identity/packages"
 *
 * const id = $BoxId.make("Box")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $BoxId: Identity.IdentityComposer<"@beep/box"> = /*#__PURE__*/ $I.create("box");

/**
 * Identity composer for `@beep/nlp-mcp`.
 *
 * **Example** (Make NLP MCP package ID)
 *
 * ```ts import.meta.vitest name="Make NLP MCP package ID"
 * import { $NlpMcpId } from "@beep/identity/packages"
 *
 * const id = $NlpMcpId.make("NlpMcp")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $NlpMcpId: Identity.IdentityComposer<"@beep/nlp-mcp"> = /*#__PURE__*/ $I.create("nlp-mcp");

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
export const $RdfCanonizeId: Identity.IdentityComposer<"@beep/rdf-canonize"> = /*#__PURE__*/ $I.create("rdf-canonize");

/**
 * Identity composer for `@beep/wink`.
 *
 * **Example** (Make Wink package ID)
 *
 * ```ts import.meta.vitest name="Make Wink package ID"
 * import { $WinkId } from "@beep/identity/packages"
 *
 * const id = $WinkId.make("Wink")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $WinkId: Identity.IdentityComposer<"@beep/wink"> = /*#__PURE__*/ $I.create("wink");

/**
 * Identity composer for `@beep/file-processing`.
 *
 * **Example** (Make file processing package ID)
 *
 * ```ts import.meta.vitest name="Make file processing package ID"
 * import { $FileProcessingId } from "@beep/identity/packages"
 *
 * const id = $FileProcessingId.make("FileProcessing")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $FileProcessingId: Identity.IdentityComposer<"@beep/file-processing"> = /*#__PURE__*/ $I.create(
  "file-processing"
);

/**
 * Identity composer for `@beep/tika`.
 *
 * **Example** (Make Tika package ID)
 *
 * ```ts import.meta.vitest name="Make Tika package ID"
 * import { $TikaId } from "@beep/identity/packages"
 *
 * const id = $TikaId.make("Tika")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TikaId: Identity.IdentityComposer<"@beep/tika"> = /*#__PURE__*/ $I.create("tika");

/**
 * Identity composer for `@beep/libpff`.
 *
 * **Example** (Make Libpff package ID)
 *
 * ```ts import.meta.vitest name="Make Libpff package ID"
 * import { $LibpffId } from "@beep/identity/packages"
 *
 * const id = $LibpffId.make("Libpff")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LibpffId: Identity.IdentityComposer<"@beep/libpff"> = /*#__PURE__*/ $I.create("libpff");

/**
 * Identity composer for the `@beep/uspto` package.
 *
 * **Example** (Make USPTO package ID)
 *
 * ```ts import.meta.vitest name="Make USPTO package ID"
 * import { $UsptoId } from "@beep/identity/packages"
 *
 * const id = $UsptoId.make("Uspto")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $UsptoId: Identity.IdentityComposer<"@beep/uspto"> = /*#__PURE__*/ $I.create("uspto");

/**
 * Identity composer for `@beep/lexical-schema`.
 *
 * **Example** (Make lexical schema package ID)
 *
 * ```ts import.meta.vitest name="Make lexical schema package ID"
 * import { $LexicalSchemaId } from "@beep/identity/packages"
 *
 * const id = $LexicalSchemaId.make("LexicalSchema")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LexicalSchemaId: Identity.IdentityComposer<"@beep/lexical-schema"> = /*#__PURE__*/ $I.create(
  "lexical-schema"
);

/**
 * Identity composer for `@beep/editor`.
 *
 * **Example** (Make editor package ID)
 *
 * ```ts import.meta.vitest name="Make editor package ID"
 * import { $EditorId } from "@beep/identity/packages"
 *
 * const id = $EditorId.make("Editor")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EditorId: Identity.IdentityComposer<"@beep/editor"> = /*#__PURE__*/ $I.create("editor");

/**
 * Identity composer for `@beep/scratchpad`.
 *
 * **Example** (Make scratchpad package ID)
 *
 * ```ts import.meta.vitest name="Make scratchpad package ID"
 * import { $ScratchpadId } from "@beep/identity/packages"
 *
 * const id = $ScratchpadId.make("Scratchpad")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ScratchpadId: Identity.IdentityComposer<"@beep/scratchpad"> = /*#__PURE__*/ $I.create("scratchpad");

/**
 * Identity composer for `@beep/html`.
 *
 * **Example** (Make HTML package ID)
 *
 * ```ts import.meta.vitest name="Make HTML package ID"
 * import { $HtmlId } from "@beep/identity/packages"
 *
 * const id = $HtmlId.make("Html")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $HtmlId: Identity.IdentityComposer<"@beep/html"> = /*#__PURE__*/ $I.create("html");

/**
 * Identity composer for `@beep/pandoc-ast`.
 *
 * **Example** (Make Pandoc AST package ID)
 *
 * ```ts import.meta.vitest name="Make Pandoc AST package ID"
 * import { $PandocAstId } from "@beep/identity/packages"
 *
 * const id = $PandocAstId.make("PandocAst")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PandocAstId: Identity.IdentityComposer<"@beep/pandoc-ast"> = /*#__PURE__*/ $I.create("pandoc-ast");

/**
 * Identity composer for `@beep/pglite`.
 *
 * **Example** (Make PGlite package ID)
 *
 * ```ts import.meta.vitest name="Make PGlite package ID"
 * import { $PgliteId } from "@beep/identity/packages"
 *
 * const id = $PgliteId.make("Pglite")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PgliteId: Identity.IdentityComposer<"@beep/pglite"> = /*#__PURE__*/ $I.create("pglite");

/**
 * Identity composer for `@beep/m365`.
 *
 * **Example** (Make M365 package ID)
 *
 * ```ts import.meta.vitest name="Make M365 package ID"
 * import { $M365Id } from "@beep/identity/packages"
 *
 * const id = $M365Id.make("M365")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $M365Id: Identity.IdentityComposer<"@beep/m365"> = /*#__PURE__*/ $I.create("m365");

/**
 * Identity composer for `@beep/m365-mcp`.
 *
 * **Example** (Make M365 MCP package ID)
 *
 * ```ts import.meta.vitest name="Make M365 MCP package ID"
 * import { $M365McpId } from "@beep/identity/packages"
 *
 * const id = $M365McpId.make("M365Mcp")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $M365McpId: Identity.IdentityComposer<"@beep/m365-mcp"> = /*#__PURE__*/ $I.create("m365-mcp");

/**
 * Identity composer for `@beep/govinfo`.
 *
 * **Example** (Make GovInfo package ID)
 *
 * ```ts import.meta.vitest name="Make GovInfo package ID"
 * import { $GovinfoId } from "@beep/identity/packages"
 *
 * const id = $GovinfoId.make("Govinfo")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $GovinfoId: Identity.IdentityComposer<"@beep/govinfo"> = /*#__PURE__*/ $I.create("govinfo");

/**
 * Identity composer for `@beep/ecfr`.
 *
 * **Example** (Make eCFR package ID)
 *
 * ```ts import.meta.vitest name="Make eCFR package ID"
 * import { $EcfrId } from "@beep/identity/packages"
 *
 * const id = $EcfrId.make("Ecfr")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EcfrId: Identity.IdentityComposer<"@beep/ecfr"> = /*#__PURE__*/ $I.create("ecfr");

/**
 * Identity composer for `@beep/api-transport`.
 *
 * **Example** (Make API transport package ID)
 *
 * ```ts import.meta.vitest name="Make API transport package ID"
 * import { $ApiTransportId } from "@beep/identity/packages"
 *
 * const id = $ApiTransportId.make("ApiTransport")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ApiTransportId: Identity.IdentityComposer<"@beep/api-transport"> = /*#__PURE__*/ $I.create(
  "api-transport"
);

/**
 * Identity composer for `@beep/mcp-kit`.
 *
 * **Example** (Make MCP kit package ID)
 *
 * ```ts import.meta.vitest name="Make MCP kit package ID"
 * import { $McpKitId } from "@beep/identity/packages"
 *
 * const id = $McpKitId.make("McpKit")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $McpKitId: Identity.IdentityComposer<"@beep/mcp-kit"> = /*#__PURE__*/ $I.create("mcp-kit");

/**
 * Identity composer for `@beep/uspto-mcp`.
 *
 * **Example** (Make USPTO MCP package ID)
 *
 * ```ts import.meta.vitest name="Make USPTO MCP package ID"
 * import { $UsptoMcpId } from "@beep/identity/packages"
 *
 * const id = $UsptoMcpId.make("UsptoMcp")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $UsptoMcpId: Identity.IdentityComposer<"@beep/uspto-mcp"> = /*#__PURE__*/ $I.create("uspto-mcp");

/**
 * Identity composer for `@beep/pacer`.
 *
 * **Example** (Make PACER package ID)
 *
 * ```ts import.meta.vitest name="Make PACER package ID"
 * import { $PacerId } from "@beep/identity/packages"
 *
 * const id = $PacerId.make("Pacer")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PacerId: Identity.IdentityComposer<"@beep/pacer"> = /*#__PURE__*/ $I.create("pacer");

/**
 * Identity composer for `@beep/fc-runs`.
 *
 * **Example** (Make FC runs package ID)
 *
 * ```ts import.meta.vitest name="Make FC runs package ID"
 * import { $FcRunsId } from "@beep/identity/packages"
 *
 * const id = $FcRunsId.make("FcRuns")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $FcRunsId: Identity.IdentityComposer<"@beep/fc-runs"> = /*#__PURE__*/ $I.create("fc-runs");

/**
 * Identity composer for `@beep/cosmos`.
 *
 * **Example** (Make Cosmos package ID)
 *
 * ```ts import.meta.vitest name="Make Cosmos package ID"
 * import { $CosmosId } from "@beep/identity/packages"
 *
 * const id = $CosmosId.make("Cosmos")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $CosmosId: Identity.IdentityComposer<"@beep/cosmos"> = /*#__PURE__*/ $I.create("cosmos");

/**
 * Identity composer for `@beep/db-admin`.
 *
 * **Example** (Make DB admin package ID)
 *
 * ```ts import.meta.vitest name="Make DB admin package ID"
 * import { $DbAdminId } from "@beep/identity/packages"
 *
 * const id = $DbAdminId.make("DbAdmin")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DbAdminId: Identity.IdentityComposer<"@beep/db-admin"> = /*#__PURE__*/ $I.create("db-admin");

/**
 * Identity composer for `@beep/epistemic-server`.
 *
 * **Example** (Make epistemic server package ID)
 *
 * ```ts import.meta.vitest name="Make epistemic server package ID"
 * import { $EpistemicServerId } from "@beep/identity/packages"
 *
 * const id = $EpistemicServerId.make("EpistemicServer")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EpistemicServerId: Identity.IdentityComposer<"@beep/epistemic-server"> = /*#__PURE__*/ $I.create(
  "epistemic-server"
);

/**
 * Identity composer for `@beep/epistemic-tables`.
 *
 * **Example** (Make epistemic tables package ID)
 *
 * ```ts import.meta.vitest name="Make epistemic tables package ID"
 * import { $EpistemicTablesId } from "@beep/identity/packages"
 *
 * const id = $EpistemicTablesId.make("EpistemicTables")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EpistemicTablesId: Identity.IdentityComposer<"@beep/epistemic-tables"> = /*#__PURE__*/ $I.create(
  "epistemic-tables"
);

/**
 * Identity composer for `@beep/lint-rules`.
 *
 * **Example** (Make lint rules package ID)
 *
 * ```ts import.meta.vitest name="Make lint rules package ID"
 * import { $LintRulesId } from "@beep/identity/packages"
 *
 * const id = $LintRulesId.make("LintRules")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LintRulesId: Identity.IdentityComposer<"@beep/lint-rules"> = /*#__PURE__*/ $I.create("lint-rules");

/**
 * Identity composer for `@beep/n3`.
 *
 * **Example** (Make N3 package ID)
 *
 * ```ts import.meta.vitest name="Make N3 package ID"
 * import { $N3Id } from "@beep/identity/packages"
 *
 * const id = $N3Id.make("N3")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $N3Id: Identity.IdentityComposer<"@beep/n3"> = /*#__PURE__*/ $I.create("n3");

/**
 * Identity composer for `@beep/pretext`.
 *
 * **Example** (Make Pretext package ID)
 *
 * ```ts import.meta.vitest name="Make Pretext package ID"
 * import { $PretextId } from "@beep/identity/packages"
 *
 * const id = $PretextId.make("Pretext")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PretextId: Identity.IdentityComposer<"@beep/pretext"> = /*#__PURE__*/ $I.create("pretext");

/**
 * Identity composer for `@beep/graph-3d`.
 *
 * **Example** (Make Graph 3D package ID)
 *
 * ```ts import.meta.vitest name="Make Graph 3D package ID"
 * import { $Graph3dId } from "@beep/identity/packages"
 *
 * const id = $Graph3dId.make("Graph3D")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $Graph3dId: Identity.IdentityComposer<"@beep/graph-3d"> = /*#__PURE__*/ $I.create("graph-3d");

/**
 * Identity composer for `@beep/dock`.
 *
 * **Example** (Make Dock package ID)
 *
 * ```ts import.meta.vitest name="Make Dock package ID"
 * import { $DockId } from "@beep/identity/packages"
 *
 * const id = $DockId.make("Dock")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DockId: Identity.IdentityComposer<"@beep/dock"> = /*#__PURE__*/ $I.create("dock");

/**
 * Identity composer for `@beep/dock-react`.
 *
 * **Example** (Make Dock React package ID)
 *
 * ```ts import.meta.vitest name="Make Dock React package ID"
 * import { $DockReactId } from "@beep/identity/packages"
 *
 * const id = $DockReactId.make("DockReact")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DockReactId: Identity.IdentityComposer<"@beep/dock-react"> = /*#__PURE__*/ $I.create("dock-react");

/**
 * Identity composer for `@beep/ontology-client`.
 *
 * **Example** (Make ontology client package ID)
 *
 * ```ts import.meta.vitest name="Make ontology client package ID"
 * import { $OntologyClientId } from "@beep/identity/packages"
 *
 * const id = $OntologyClientId.make("OntologyClient")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OntologyClientId: Identity.IdentityComposer<"@beep/ontology-client"> = /*#__PURE__*/ $I.create(
  "ontology-client"
);

/**
 * Identity composer for `@beep/ontology-config`.
 *
 * **Example** (Make ontology config package ID)
 *
 * ```ts import.meta.vitest name="Make ontology config package ID"
 * import { $OntologyConfigId } from "@beep/identity/packages"
 *
 * const id = $OntologyConfigId.make("OntologyConfig")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OntologyConfigId: Identity.IdentityComposer<"@beep/ontology-config"> = /*#__PURE__*/ $I.create(
  "ontology-config"
);

/**
 * Identity composer for `@beep/ontology-domain`.
 *
 * **Example** (Make ontology domain package ID)
 *
 * ```ts import.meta.vitest name="Make ontology domain package ID"
 * import { $OntologyDomainId } from "@beep/identity/packages"
 *
 * const id = $OntologyDomainId.make("OntologyDomain")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OntologyDomainId: Identity.IdentityComposer<"@beep/ontology-domain"> = /*#__PURE__*/ $I.create(
  "ontology-domain"
);

/**
 * Identity composer for `@beep/ontology-server`.
 *
 * **Example** (Make ontology server package ID)
 *
 * ```ts import.meta.vitest name="Make ontology server package ID"
 * import { $OntologyServerId } from "@beep/identity/packages"
 *
 * const id = $OntologyServerId.make("OntologyServer")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OntologyServerId: Identity.IdentityComposer<"@beep/ontology-server"> = /*#__PURE__*/ $I.create(
  "ontology-server"
);

/**
 * Identity composer for `@beep/ontology-ui`.
 *
 * **Example** (Make ontology UI package ID)
 *
 * ```ts import.meta.vitest name="Make ontology UI package ID"
 * import { $OntologyUiId } from "@beep/identity/packages"
 *
 * const id = $OntologyUiId.make("OntologyUi")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OntologyUiId: Identity.IdentityComposer<"@beep/ontology-ui"> = /*#__PURE__*/ $I.create("ontology-ui");

/**
 * Identity composer for `@beep/ontology-use-cases`.
 *
 * **Example** (Make ontology use-cases package ID)
 *
 * ```ts import.meta.vitest name="Make ontology use-cases package ID"
 * import { $OntologyUseCasesId } from "@beep/identity/packages"
 *
 * const id = $OntologyUseCasesId.make("OntologyUseCases")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OntologyUseCasesId: Identity.IdentityComposer<"@beep/ontology-use-cases"> = /*#__PURE__*/ $I.create(
  "ontology-use-cases"
);

/**
 * Identity composer for `@beep/oxigraph`.
 *
 * **Example** (Make Oxigraph package ID)
 *
 * ```ts import.meta.vitest name="Make Oxigraph package ID"
 * import { $OxigraphId } from "@beep/identity/packages"
 *
 * const id = $OxigraphId.make("Oxigraph")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OxigraphId: Identity.IdentityComposer<"@beep/oxigraph"> = /*#__PURE__*/ $I.create("oxigraph");

/**
 * Identity composer for `@beep/shacl`.
 *
 * **Example** (Make SHACL package ID)
 *
 * ```ts import.meta.vitest name="Make SHACL package ID"
 * import { $ShaclId } from "@beep/identity/packages"
 *
 * const id = $ShaclId.make("Shacl")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ShaclId: Identity.IdentityComposer<"@beep/shacl"> = /*#__PURE__*/ $I.create("shacl");

/**
 * Identity composer for `@beep/storybook`.
 *
 * **Example** (Make Storybook package ID)
 *
 * ```ts import.meta.vitest name="Make Storybook package ID"
 * import { $StorybookId } from "@beep/identity/packages"
 *
 * const id = $StorybookId.make("Storybook")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $StorybookId: Identity.IdentityComposer<"@beep/storybook"> = /*#__PURE__*/ $I.create("storybook");

/**
 * Identity composer for `@beep/tsgo-shim`.
 *
 * **Example** (Make TSGO shim package ID)
 *
 * ```ts import.meta.vitest name="Make TSGO shim package ID"
 * import { $TsgoShimId } from "@beep/identity/packages"
 *
 * const id = $TsgoShimId.make("TsgoShim")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TsgoShimId: Identity.IdentityComposer<"@beep/tsgo-shim"> = /*#__PURE__*/ $I.create("tsgo-shim");

/**
 * Identity composer for `@beep/doc-text`.
 *
 * **Example** (Make doc text package ID)
 *
 * ```ts import.meta.vitest name="Make doc text package ID"
 * import { $DocTextId } from "@beep/identity/packages"
 *
 * const id = $DocTextId.make("DocText")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DocTextId: Identity.IdentityComposer<"@beep/doc-text"> = /*#__PURE__*/ $I.create("doc-text");

/**
 * Identity composer for `@beep/documents-tables`.
 *
 * **Example** (Make documents tables package ID)
 *
 * ```ts import.meta.vitest name="Make documents tables package ID"
 * import { $DocumentsTablesId } from "@beep/identity/packages"
 *
 * const id = $DocumentsTablesId.make("DocumentsTables")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DocumentsTablesId: Identity.IdentityComposer<"@beep/documents-tables"> = /*#__PURE__*/ $I.create(
  "documents-tables"
);

/**
 * Identity composer for `@beep/tailscale`.
 *
 * **Example** (Make Tailscale package ID)
 *
 * ```ts import.meta.vitest name="Make Tailscale package ID"
 * import { $TailscaleId } from "@beep/identity/packages"
 *
 * const id = $TailscaleId.make("Tailscale")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TailscaleId: Identity.IdentityComposer<"@beep/tailscale"> = /*#__PURE__*/ $I.create("tailscale");

/**
 * Identity composer for `@beep/agents-tables`.
 *
 * **Example** (Make agents tables package ID)
 *
 * ```ts import.meta.vitest name="Make agents tables package ID"
 * import { $AgentsTablesId } from "@beep/identity/packages"
 *
 * const id = $AgentsTablesId.make("AgentsTables")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AgentsTablesId: Identity.IdentityComposer<"@beep/agents-tables"> = /*#__PURE__*/ $I.create(
  "agents-tables"
);

/**
 * Identity composer for `@beep/law-practice-tables`.
 *
 * **Example** (Make law practice tables package ID)
 *
 * ```ts import.meta.vitest name="Make law practice tables package ID"
 * import { $LawPracticeTablesId } from "@beep/identity/packages"
 *
 * const id = $LawPracticeTablesId.make("LawPracticeTables")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LawPracticeTablesId: Identity.IdentityComposer<"@beep/law-practice-tables"> = /*#__PURE__*/ $I.create(
  "law-practice-tables"
);

/**
 * Identity composer for `@beep/practice-kg-mcp`.
 *
 * **Example** (Make practice KG MCP package ID)
 *
 * ```ts import.meta.vitest name="Make practice KG MCP package ID"
 * import { $PracticeKgMcpId } from "@beep/identity/packages"
 *
 * const id = $PracticeKgMcpId.make("PracticeKgMcp")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PracticeKgMcpId: Identity.IdentityComposer<"@beep/practice-kg-mcp"> = /*#__PURE__*/ $I.create(
  "practice-kg-mcp"
);

/**
 * Identity composer for `@beep/openclaw`.
 *
 * **Example** (Make Openclaw package ID)
 *
 * ```ts import.meta.vitest name="Make Openclaw package ID"
 * import { $OpenclawId } from "@beep/identity/packages"
 *
 * const id = $OpenclawId.make("Openclaw")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OpenclawId: Identity.IdentityComposer<"@beep/openclaw"> = /*#__PURE__*/ $I.create("openclaw");

/**
 * Identity composer for `@beep/obs`.
 *
 * **Example** (Make OBS package ID)
 *
 * ```ts import.meta.vitest name="Make OBS package ID"
 * import { $ObsId } from "@beep/identity/packages"
 *
 * const id = $ObsId.make("Obs")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ObsId: Identity.IdentityComposer<"@beep/obs"> = /*#__PURE__*/ $I.create("obs");

/**
 * Identity composer for `@beep/exiftool`.
 *
 * **Example** (Make ExifTool package ID)
 *
 * ```ts import.meta.vitest name="Make ExifTool package ID"
 * import { $ExiftoolId } from "@beep/identity/packages"
 *
 * const id = $ExiftoolId.make("Exiftool")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ExiftoolId: Identity.IdentityComposer<"@beep/exiftool"> = /*#__PURE__*/ $I.create("exiftool");

/**
 * Identity composer for `@beep/qa-capture`.
 *
 * **Example** (Make QA capture package ID)
 *
 * ```ts import.meta.vitest name="Make QA capture package ID"
 * import { $QaCaptureId } from "@beep/identity/packages"
 *
 * const id = $QaCaptureId.make("QaCapture")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $QaCaptureId: Identity.IdentityComposer<"@beep/qa-capture"> = /*#__PURE__*/ $I.create("qa-capture");

/**
 * Identity composer for `@beep/gov-legal-mcp`.
 *
 * **Example** (Make gov legal MCP package ID)
 *
 * ```ts import.meta.vitest name="Make gov legal MCP package ID"
 * import { $GovLegalMcpId } from "@beep/identity/packages"
 *
 * const id = $GovLegalMcpId.make("GovLegalMcp")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $GovLegalMcpId: Identity.IdentityComposer<"@beep/gov-legal-mcp"> = /*#__PURE__*/ $I.create(
  "gov-legal-mcp"
);

/**
 * Identity composer for `@beep/epistemic-client`.
 *
 * **Example** (Make epistemic client package ID)
 *
 * ```ts
 * import { $EpistemicClientId } from "@beep/identity/packages"
 *
 * console.log($EpistemicClientId.make("ContradictionTriage"))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EpistemicClientId: Identity.IdentityComposer<"@beep/epistemic-client"> = /*#__PURE__*/ $I.create(
  "epistemic-client"
);

/**
 * Identity composer for `@beep/epistemic-ui`.
 *
 * **Example** (Make epistemic UI package ID)
 *
 * ```ts
 * import { $EpistemicUiId } from "@beep/identity/packages"
 *
 * console.log($EpistemicUiId.make("ContradictionTriage"))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EpistemicUiId: Identity.IdentityComposer<"@beep/epistemic-ui"> = /*#__PURE__*/ $I.create("epistemic-ui");

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
export const $EffectDrizzleId: Identity.IdentityComposer<"@beep/effect-drizzle"> = /*#__PURE__*/ $I.create(
  "effect-drizzle"
);

/**
 * Identity composer for `@beep/skill-contract`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $SkillContractId } from "@beep/identity/packages"
 *
 * const id = $SkillContractId.make("SkillContract")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SkillContractId: Identity.IdentityComposer<"@beep/skill-contract"> = /*#__PURE__*/ $I.create(
  "skill-contract"
);

/**
 * Identity composer for `@beep/codegen-kit`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $CodegenKitId } from "@beep/identity/packages"
 *
 * const id = $CodegenKitId.make("CodegenKit")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $CodegenKitId: Identity.IdentityComposer<"@beep/codegen-kit"> = /*#__PURE__*/ $I.create("codegen-kit");

/**
 * Identity composer for `@beep/brand`.
 *
 * **Example** (Make package ID)
 *
 * ```ts
 * import { $BrandId } from "@beep/identity/packages"
 *
 * const id = $BrandId.make("Brand")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $BrandId: Identity.IdentityComposer<"@beep/brand"> = /*#__PURE__*/ $I.create("brand");

/**
 * Identity composer for `@beep/openai`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $OpenaiId } from "@beep/identity/packages"
 *
 * const id = $OpenaiId.make("Openai")
 * void id
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OpenaiId: Identity.IdentityComposer<"@beep/openai"> = /*#__PURE__*/ $I.create("openai");

/**
 * Identity composer for `@beep/todox`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $TodoxId } from "@beep/identity/packages"
 *
 * const id = $TodoxId.make("Todox")
 * id // => "@beep/todox/Todox"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TodoxId: Identity.IdentityComposer<"@beep/todox"> = /*#__PURE__*/ $I.create("todox");

/**
 * Identity composer for `@beep/box-provisioning`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $BoxProvisioningId } from "@beep/identity/packages"
 *
 * const id = $BoxProvisioningId.make("BoxProvisioning")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $BoxProvisioningId: Identity.IdentityComposer<"@beep/box-provisioning"> = /*#__PURE__*/ $I.create(
  "box-provisioning"
);

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
export const $FreshbooksId: Identity.IdentityComposer<"@beep/freshbooks"> = /*#__PURE__*/ $I.create("freshbooks");

/**
 * Identity composer for `@beep/test-runner`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $TestRunnerId } from "@beep/identity/packages"
 *
 * const id = $TestRunnerId.make("TestRunner")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TestRunnerId: Identity.IdentityComposer<"@beep/test-runner"> = /*#__PURE__*/ $I.create("test-runner");

/**
 * Identity composer for `@beep/xstate`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $XstateId } from "@beep/identity/packages"
 *
 * const id = $XstateId.make("Xstate")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $XstateId: Identity.IdentityComposer<"@beep/xstate"> = /*#__PURE__*/ $I.create("xstate");

/**
 * Identity composer for `@beep/tesseract`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $TesseractId } from "@beep/identity/packages"
 *
 * const id = $TesseractId.make("Tesseract")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TesseractId: Identity.IdentityComposer<"@beep/tesseract"> = /*#__PURE__*/ $I.create("tesseract");

/**
 * Identity composer for `@beep/poppler`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $PopplerId } from "@beep/identity/packages"
 *
 * const id = $PopplerId.make("Poppler")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PopplerId: Identity.IdentityComposer<"@beep/poppler"> = /*#__PURE__*/ $I.create("poppler");

/**
 * Identity composer for `@beep/docket-intake`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $DocketIntakeId } from "@beep/identity/packages"
 *
 * const id = $DocketIntakeId.make("DocketIntake")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $DocketIntakeId: Identity.IdentityComposer<"@beep/docket-intake"> = /*#__PURE__*/ $I.create(
  "docket-intake"
);

/**
 * Identity composer for `@beep/practice-mail-tagging`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $PracticeMailTaggingId } from "@beep/identity/packages"
 *
 * const id = $PracticeMailTaggingId.make("PracticeMailTagging")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PracticeMailTaggingId: Identity.IdentityComposer<"@beep/practice-mail-tagging"> = /*#__PURE__*/ $I.create(
  "practice-mail-tagging"
);

/**
 * Identity composer for `@beep/occt`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $OcctId } from "@beep/identity/packages"
 *
 * const id = $OcctId.make("Occt")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $OcctId: Identity.IdentityComposer<"@beep/occt"> = /*#__PURE__*/ $I.create("occt");

/**
 * Identity composer for `@beep/pdf-tools`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $PdfToolsId } from "@beep/identity/packages"
 *
 * const id = $PdfToolsId.make("PdfTools")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PdfToolsId: Identity.IdentityComposer<"@beep/pdf-tools"> = /*#__PURE__*/ $I.create("pdf-tools");

/**
 * Identity composer for `@beep/technical-drawing`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $TechnicalDrawingId } from "@beep/identity/packages"
 *
 * const id = $TechnicalDrawingId.make("TechnicalDrawing")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TechnicalDrawingId: Identity.IdentityComposer<"@beep/technical-drawing"> = /*#__PURE__*/ $I.create(
  "technical-drawing"
);

/**
 * Identity composer for `@beep/practice-identify`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $PracticeIdentifyId } from "@beep/identity/packages"
 *
 * const id = $PracticeIdentifyId.make("PracticeIdentify")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PracticeIdentifyId: Identity.IdentityComposer<"@beep/practice-identify"> = /*#__PURE__*/ $I.create(
  "practice-identify"
);

/**
 * Identity composer for `@beep/practice-m365-contacts`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $PracticeM365ContactsId } from "@beep/identity/packages"
 *
 * const id = $PracticeM365ContactsId.make("PracticeM365Contacts")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PracticeM365ContactsId: Identity.IdentityComposer<"@beep/practice-m365-contacts"> =
  /*#__PURE__*/ $I.create("practice-m365-contacts");

/**
 * Identity composer for `@beep/practice-claude-mod`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $PracticeClaudeModId } from "@beep/identity/packages"
 *
 * const id = $PracticeClaudeModId.make("PracticeClaudeMod")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PracticeClaudeModId: Identity.IdentityComposer<"@beep/practice-claude-mod"> = /*#__PURE__*/ $I.create(
  "practice-claude-mod"
);
/**
 * Identity composer for `@beep/practice-review-hub`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $PracticeReviewHubId } from "@beep/identity/packages"
 *
 * const id = $PracticeReviewHubId.make("PracticeReviewHub")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PracticeReviewHubId: Identity.IdentityComposer<"@beep/practice-review-hub"> = /*#__PURE__*/ $I.create(
  "practice-review-hub"
);

/**
 * Identity composer for `@beep/palantiri`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $PalantiriId } from "@beep/identity/packages"
 *
 * const id = $PalantiriId.make("Palantiri")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PalantiriId: Identity.IdentityComposer<"@beep/palantiri"> = /*#__PURE__*/ $I.create("palantiri");

/**
 * Identity composer for `@beep/windows-secrets`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $WindowsSecretsId } from "@beep/identity/packages"
 *
 * const id = $WindowsSecretsId.make("WindowsSecrets")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $WindowsSecretsId: Identity.IdentityComposer<"@beep/windows-secrets"> = /*#__PURE__*/ $I.create(
  "windows-secrets"
);

/**
 * Identity composer for `@beep/practice-gateway`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $PracticeGatewayId } from "@beep/identity/packages"
 *
 * const id = $PracticeGatewayId.make("PracticeGateway")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PracticeGatewayId: Identity.IdentityComposer<"@beep/practice-gateway"> = /*#__PURE__*/ $I.create(
  "practice-gateway"
);

/**
 * Identity composer for `@beep/mcpb-kit`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $McpbKitId } from "@beep/identity/packages"
 *
 * const id = $McpbKitId.make("McpbKit")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $McpbKitId: Identity.IdentityComposer<"@beep/mcpb-kit"> = /*#__PURE__*/ $I.create("mcpb-kit");

/**
 * Identity composer for `@beep/practice-setup`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $PracticeSetupId } from "@beep/identity/packages"
 *
 * const id = $PracticeSetupId.make("PracticeSetup")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PracticeSetupId: Identity.IdentityComposer<"@beep/practice-setup"> = /*#__PURE__*/ $I.create(
  "practice-setup"
);

/**
 * Identity composer for `@beep/jsonc`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $JsoncId } from "@beep/identity/packages"
 *
 * const id = $JsoncId.make("Jsonc")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $JsoncId: Identity.IdentityComposer<"@beep/jsonc"> = /*#__PURE__*/ $I.create("jsonc");

/**
 * Identity composer for `@beep/jsonl`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $JsonlId } from "@beep/identity/packages"
 *
 * const id = $JsonlId.make("Jsonl")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $JsonlId: Identity.IdentityComposer<"@beep/jsonl"> = /*#__PURE__*/ $I.create("jsonl");

/**
 * Identity composer for `@beep/semver`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $SemverId } from "@beep/identity/packages"
 *
 * const id = $SemverId.make("Semver")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SemverId: Identity.IdentityComposer<"@beep/semver"> = /*#__PURE__*/ $I.create("semver");

/**
 * Identity composer for `@beep/spdx`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $SpdxId } from "@beep/identity/packages"
 *
 * const id = $SpdxId.make("Spdx")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SpdxId: Identity.IdentityComposer<"@beep/spdx"> = /*#__PURE__*/ $I.create("spdx");
/**
 * Identity composer for `@beep/github-references`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $GithubReferencesId } from "@beep/identity/packages"
 *
 * const id = $GithubReferencesId.make("GithubReferences")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $GithubReferencesId: Identity.IdentityComposer<"@beep/github-references"> = /*#__PURE__*/ $I.create(
  "github-references"
);

/**
 * Identity composer for `@beep/github-commands`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $GithubCommandsId } from "@beep/identity/packages"
 *
 * const id = $GithubCommandsId.make("GithubCommands")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $GithubCommandsId: Identity.IdentityComposer<"@beep/github-commands"> = /*#__PURE__*/ $I.create(
  "github-commands"
);

/**
 * Identity composer for `@beep/commands`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $CommandsId } from "@beep/identity/packages"
 *
 * const id = $CommandsId.make("Commands")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $CommandsId: Identity.IdentityComposer<"@beep/commands"> = /*#__PURE__*/ $I.create("commands");

/**
 * Identity composer for `@beep/public-site`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $PublicSiteId } from "@beep/identity/packages"
 *
 * const id = $PublicSiteId.make("PublicSite")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PublicSiteId: Identity.IdentityComposer<"@beep/public-site"> = /*#__PURE__*/ $I.create("public-site");

/**
 * Identity composer for `@beep/git`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $GitId } from "@beep/identity/packages"
 *
 * const id = $GitId.make("Git")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $GitId: Identity.IdentityComposer<"@beep/git"> = /*#__PURE__*/ $I.create("git");

/**
 * Identity composer for `@beep/glob`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $GlobId } from "@beep/identity/packages"
 *
 * const id = $GlobId.make("Glob")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $GlobId: Identity.IdentityComposer<"@beep/glob"> = /*#__PURE__*/ $I.create("glob");

/**
 * Identity composer for `@beep/managed-section`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $ManagedSectionId } from "@beep/identity/packages"
 *
 * const id = $ManagedSectionId.make("ManagedSection")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ManagedSectionId: Identity.IdentityComposer<"@beep/managed-section"> = /*#__PURE__*/ $I.create(
  "managed-section"
);

/**
 * Identity composer for `@beep/memfs`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $MemfsId } from "@beep/identity/packages"
 *
 * const id = $MemfsId.make("Memfs")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $MemfsId: Identity.IdentityComposer<"@beep/memfs"> = /*#__PURE__*/ $I.create("memfs");

/**
 * Identity composer for `@beep/toml`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $TomlId } from "@beep/identity/packages"
 *
 * const id = $TomlId.make("Toml")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TomlId: Identity.IdentityComposer<"@beep/toml"> = /*#__PURE__*/ $I.create("toml");

/**
 * Identity composer for `@beep/yaml`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $YamlId } from "@beep/identity/packages"
 *
 * const id = $YamlId.make("Yaml")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $YamlId: Identity.IdentityComposer<"@beep/yaml"> = /*#__PURE__*/ $I.create("yaml");

/**
 * Identity composer for `@beep/npm-spec`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $NpmSpecId } from "@beep/identity/packages"
 *
 * const id = $NpmSpecId.make("NpmSpec")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $NpmSpecId: Identity.IdentityComposer<"@beep/npm-spec"> = /*#__PURE__*/ $I.create("npm-spec");

/**
 * Identity composer for `@beep/tsconfig`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $TsconfigId } from "@beep/identity/packages"
 *
 * const id = $TsconfigId.make("Tsconfig")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TsconfigId: Identity.IdentityComposer<"@beep/tsconfig"> = /*#__PURE__*/ $I.create("tsconfig");

/**
 * Identity composer for `@beep/walker`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $WalkerId } from "@beep/identity/packages"
 *
 * const id = $WalkerId.make("Walker")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $WalkerId: Identity.IdentityComposer<"@beep/walker"> = /*#__PURE__*/ $I.create("walker");

/**
 * Identity composer for `@beep/github`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $GithubId } from "@beep/identity/packages"
 *
 * const id = $GithubId.make("Github")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $GithubId: Identity.IdentityComposer<"@beep/github"> = /*#__PURE__*/ $I.create("github");

/**
 * Identity composer for `@beep/runtime-env`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $RuntimeEnvId } from "@beep/identity/packages"
 *
 * const id = $RuntimeEnvId.make("RuntimeEnv")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RuntimeEnvId: Identity.IdentityComposer<"@beep/runtime-env"> = /*#__PURE__*/ $I.create("runtime-env");

/**
 * Identity composer for `@beep/epistemics`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $EpistemicsId } from "@beep/identity/packages"
 *
 * const id = $EpistemicsId.make("Epistemics")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EpistemicsId: Identity.IdentityComposer<"@beep/epistemics"> = /*#__PURE__*/ $I.create("epistemics");

/**
 * Identity composer for `@beep/markdown`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $MarkdownId } from "@beep/identity/packages"
 *
 * const id = $MarkdownId.make("Markdown")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $MarkdownId: Identity.IdentityComposer<"@beep/markdown"> = /*#__PURE__*/ $I.create("markdown");

/**
 * Identity composer for `@beep/github-reporting`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $GithubReportingId } from "@beep/identity/packages"
 *
 * const id = $GithubReportingId.make("GithubReporting")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $GithubReportingId: Identity.IdentityComposer<"@beep/github-reporting"> = /*#__PURE__*/ $I.create(
  "github-reporting"
);

/**
 * Identity composer for `@beep/repo-tsconfig`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $RepoTsconfigId } from "@beep/identity/packages"
 *
 * const id = $RepoTsconfigId.make("RepoTsconfig")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RepoTsconfigId: Identity.IdentityComposer<"@beep/repo-tsconfig"> = /*#__PURE__*/ $I.create(
  "repo-tsconfig"
);

/**
 * Identity composer for `@beep/package-json`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $PackageJsonId } from "@beep/identity/packages"
 *
 * const id = $PackageJsonId.make("PackageJson")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PackageJsonId: Identity.IdentityComposer<"@beep/package-json"> = /*#__PURE__*/ $I.create("package-json");

/**
 * Identity composer for `@beep/config-file`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $ConfigFileId } from "@beep/identity/packages"
 *
 * const id = $ConfigFileId.make("ConfigFile")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ConfigFileId: Identity.IdentityComposer<"@beep/config-file"> = /*#__PURE__*/ $I.create("config-file");

/**
 * Identity composer for `@beep/lockfiles`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $LockfilesId } from "@beep/identity/packages"
 *
 * const id = $LockfilesId.make("Lockfiles")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $LockfilesId: Identity.IdentityComposer<"@beep/lockfiles"> = /*#__PURE__*/ $I.create("lockfiles");

/**
 * Identity composer for `@beep/xdg`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $XdgId } from "@beep/identity/packages"
 *
 * const id = $XdgId.make("Xdg")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $XdgId: Identity.IdentityComposer<"@beep/xdg"> = /*#__PURE__*/ $I.create("xdg");

/**
 * Identity composer for `@beep/cli-kit`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $CliKitId } from "@beep/identity/packages"
 *
 * const id = $CliKitId.make("CliKit")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $CliKitId: Identity.IdentityComposer<"@beep/cli-kit"> = /*#__PURE__*/ $I.create("cli-kit");

/**
 * Identity composer for `@beep/repo-workspaces`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $RepoWorkspacesId } from "@beep/identity/packages"
 *
 * const id = $RepoWorkspacesId.make("RepoWorkspaces")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RepoWorkspacesId: Identity.IdentityComposer<"@beep/repo-workspaces"> = /*#__PURE__*/ $I.create(
  "repo-workspaces"
);

/**
 * Identity composer for `@beep/sbom`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $SbomId } from "@beep/identity/packages"
 *
 * const id = $SbomId.make("Sbom")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SbomId: Identity.IdentityComposer<"@beep/sbom"> = /*#__PURE__*/ $I.create("sbom");

/**
 * Identity composer for `@beep/github-actions`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $GithubActionsId } from "@beep/identity/packages"
 *
 * const id = $GithubActionsId.make("GithubActions")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $GithubActionsId: Identity.IdentityComposer<"@beep/github-actions"> = /*#__PURE__*/ $I.create(
  "github-actions"
);

/**
 * Identity composer for `@beep/beep-effect-web`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $BeepEffectWebId } from "@beep/identity/packages"
 *
 * const id = $BeepEffectWebId.make("BeepEffectWeb")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $BeepEffectWebId: Identity.IdentityComposer<"@beep/beep-effect-web"> = /*#__PURE__*/ $I.create(
  "beep-effect-web"
);

/**
 * Identity composer for `@beep/party-domain`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $PartyDomainId } from "@beep/identity/packages"
 *
 * const id = $PartyDomainId.make("PartyDomain")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PartyDomainId: Identity.IdentityComposer<"@beep/party-domain"> = /*#__PURE__*/ $I.create("party-domain");

/**
 * Identity composer for `@beep/party-use-cases`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $PartyUseCasesId } from "@beep/identity/packages"
 *
 * const id = $PartyUseCasesId.make("PartyUseCases")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PartyUseCasesId: Identity.IdentityComposer<"@beep/party-use-cases"> = /*#__PURE__*/ $I.create(
  "party-use-cases"
);

/**
 * Identity composer for `@beep/party-server`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $PartyServerId } from "@beep/identity/packages"
 *
 * const id = $PartyServerId.make("PartyServer")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PartyServerId: Identity.IdentityComposer<"@beep/party-server"> = /*#__PURE__*/ $I.create("party-server");

/**
 * Identity composer for `@beep/repo-cli-kit`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $RepoCliKitId } from "@beep/identity/packages"
 *
 * const id = $RepoCliKitId.make("RepoCliKit")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RepoCliKitId: Identity.IdentityComposer<"@beep/repo-cli-kit"> = /*#__PURE__*/ $I.create("repo-cli-kit");

/**
 * Identity composer for `@beep/alchemy-postgres`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $AlchemyPostgresId } from "@beep/identity/packages"
 *
 * const id = $AlchemyPostgresId.make("AlchemyPostgres")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AlchemyPostgresId: Identity.IdentityComposer<"@beep/alchemy-postgres"> = /*#__PURE__*/ $I.create(
  "alchemy-postgres"
);

/**
 * Identity composer for `@beep/firecrawl`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $FirecrawlId } from "@beep/identity/packages"
 *
 * const id = $FirecrawlId.make("Firecrawl")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $FirecrawlId: Identity.IdentityComposer<"@beep/firecrawl"> = /*#__PURE__*/ $I.create("firecrawl");

/**
 * Identity composer for `@beep/execution-authority-domain`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $ExecutionAuthorityDomainId } from "@beep/identity/packages"
 *
 * const id = $ExecutionAuthorityDomainId.make("ExecutionAuthorityDomain")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ExecutionAuthorityDomainId: Identity.IdentityComposer<"@beep/execution-authority-domain"> =
  /*#__PURE__*/ $I.create("execution-authority-domain");

/**
 * Identity composer for `@beep/execution-authority-use-cases`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $ExecutionAuthorityUseCasesId } from "@beep/identity/packages"
 *
 * const id = $ExecutionAuthorityUseCasesId.make("ExecutionAuthorityUseCases")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ExecutionAuthorityUseCasesId: Identity.IdentityComposer<"@beep/execution-authority-use-cases"> =
  /*#__PURE__*/ $I.create("execution-authority-use-cases");

/**
 * Identity composer for `@beep/execution-authority-tables`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $ExecutionAuthorityTablesId } from "@beep/identity/packages"
 *
 * const id = $ExecutionAuthorityTablesId.make("ExecutionAuthorityTables")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ExecutionAuthorityTablesId: Identity.IdentityComposer<"@beep/execution-authority-tables"> =
  /*#__PURE__*/ $I.create("execution-authority-tables");

/**
 * Identity composer for `@beep/execution-authority-server`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $ExecutionAuthorityServerId } from "@beep/identity/packages"
 *
 * const id = $ExecutionAuthorityServerId.make("ExecutionAuthorityServer")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ExecutionAuthorityServerId: Identity.IdentityComposer<"@beep/execution-authority-server"> =
  /*#__PURE__*/ $I.create("execution-authority-server");

/**
 * Identity composer for `@beep/execution-authority-config`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $ExecutionAuthorityConfigId } from "@beep/identity/packages"
 *
 * const id = $ExecutionAuthorityConfigId.make("ExecutionAuthorityConfig")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ExecutionAuthorityConfigId: Identity.IdentityComposer<"@beep/execution-authority-config"> =
  /*#__PURE__*/ $I.create("execution-authority-config");

/**
 * Identity composer for `@beep/eyecite`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $EyeciteId } from "@beep/identity/packages"
 *
 * const id = $EyeciteId.make("Eyecite")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $EyeciteId: Identity.IdentityComposer<"@beep/eyecite"> = /*#__PURE__*/ $I.create("eyecite");

/**
 * Identity composer for `@beep/agent-memory-store`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $AgentMemoryStoreId } from "@beep/identity/packages"
 *
 * const id = $AgentMemoryStoreId.make("AgentMemoryStore")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AgentMemoryStoreId: Identity.IdentityComposer<"@beep/agent-memory-store"> = /*#__PURE__*/ $I.create(
  "agent-memory-store"
);

/**
 * Identity composer for `@beep/sqlite`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $SqliteId } from "@beep/identity/packages"
 *
 * const id = $SqliteId.make("Sqlite")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SqliteId: Identity.IdentityComposer<"@beep/sqlite"> = /*#__PURE__*/ $I.create("sqlite");

/**
 * Identity composer for `@beep/infra-turbo-cache`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $InfraTurboCacheId } from "@beep/identity/packages"
 *
 * const id = $InfraTurboCacheId.make("InfraTurboCache")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $InfraTurboCacheId: Identity.IdentityComposer<"@beep/infra-turbo-cache"> = /*#__PURE__*/ $I.create(
  "infra-turbo-cache"
);

/**
 * Identity composer for `@beep/alchemy-github-runners`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $AlchemyGithubRunnersId } from "@beep/identity/packages"
 *
 * const id = $AlchemyGithubRunnersId.make("AlchemyGithubRunners")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AlchemyGithubRunnersId: Identity.IdentityComposer<"@beep/alchemy-github-runners"> =
  /*#__PURE__*/ $I.create("alchemy-github-runners");

/**
 * Identity composer for `@beep/alchemy-aws-extras`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $AlchemyAwsExtrasId } from "@beep/identity/packages"
 *
 * const id = $AlchemyAwsExtrasId.make("AlchemyAwsExtras")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AlchemyAwsExtrasId: Identity.IdentityComposer<"@beep/alchemy-aws-extras"> = /*#__PURE__*/ $I.create(
  "alchemy-aws-extras"
);

/**
 * Identity composer for `@beep/alchemy-vercel`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $AlchemyVercelId } from "@beep/identity/packages"
 *
 * const id = $AlchemyVercelId.make("AlchemyVercel")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AlchemyVercelId: Identity.IdentityComposer<"@beep/alchemy-vercel"> = /*#__PURE__*/ $I.create(
  "alchemy-vercel"
);

/**
 * Identity composer for `@beep/infra-cost-controls`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $InfraCostControlsId } from "@beep/identity/packages"
 *
 * const id = $InfraCostControlsId.make("InfraCostControls")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $InfraCostControlsId: Identity.IdentityComposer<"@beep/infra-cost-controls"> = /*#__PURE__*/ $I.create(
  "infra-cost-controls"
);

/**
 * Identity composer for `@beep/infra-hosts`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $InfraHostsId } from "@beep/identity/packages"
 *
 * const id = $InfraHostsId.make("InfraHosts")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $InfraHostsId: Identity.IdentityComposer<"@beep/infra-hosts"> = /*#__PURE__*/ $I.create("infra-hosts");

/**
 * Identity composer for `@beep/infra-github`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $InfraGithubId } from "@beep/identity/packages"
 *
 * const id = $InfraGithubId.make("InfraGithub")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $InfraGithubId: Identity.IdentityComposer<"@beep/infra-github"> = /*#__PURE__*/ $I.create("infra-github");

/**
 * Identity composer for `@beep/contract-kit`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $ContractKitId } from "@beep/identity/packages"
 *
 * const id = $ContractKitId.make("ContractKit")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $ContractKitId: Identity.IdentityComposer<"@beep/contract-kit"> = /*#__PURE__*/ $I.create("contract-kit");

/**
 * Identity composer for `@beep/infra-ci-runners`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $InfraCiRunnersId } from "@beep/identity/packages"
 *
 * const id = $InfraCiRunnersId.make("InfraCiRunners")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $InfraCiRunnersId: Identity.IdentityComposer<"@beep/infra-ci-runners"> = /*#__PURE__*/ $I.create(
  "infra-ci-runners"
);

/**
 * Identity composer for `@beep/gate-report`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $GateReportId } from "@beep/identity/packages"
 *
 * const id = $GateReportId.make("GateReport")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $GateReportId: Identity.IdentityComposer<"@beep/gate-report"> = /*#__PURE__*/ $I.create("gate-report");

/**
 * Identity composer for `@beep/repo-gate-record`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $RepoGateRecordId } from "@beep/identity/packages"
 *
 * const id = $RepoGateRecordId.make("RepoGateRecord")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RepoGateRecordId: Identity.IdentityComposer<"@beep/repo-gate-record"> = /*#__PURE__*/ $I.create(
  "repo-gate-record"
);

/**
 * Identity composer for `@beep/repo-gate-run`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $RepoGateRunId } from "@beep/identity/packages"
 *
 * const id = $RepoGateRunId.make("RepoGateRun")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RepoGateRunId: Identity.IdentityComposer<"@beep/repo-gate-run"> = /*#__PURE__*/ $I.create(
  "repo-gate-run"
);

/**
 * Identity composer for `@beep/csv`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $CsvId } from "@beep/identity/packages"
 *
 * const id = $CsvId.make("Csv")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $CsvId: Identity.IdentityComposer<"@beep/csv"> = /*#__PURE__*/ $I.create("csv");

/**
 * Identity composer for `@beep/xlsx`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $XlsxId } from "@beep/identity/packages"
 *
 * const id = $XlsxId.make("Xlsx")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $XlsxId: Identity.IdentityComposer<"@beep/xlsx"> = /*#__PURE__*/ $I.create("xlsx");

/**
 * Identity composer for `@beep/repo-gate-vitest`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $RepoGateVitestId } from "@beep/identity/packages"
 *
 * const id = $RepoGateVitestId.make("RepoGateVitest")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $RepoGateVitestId: Identity.IdentityComposer<"@beep/repo-gate-vitest"> = /*#__PURE__*/ $I.create(
  "repo-gate-vitest"
);

/**
 * Identity composer for `@beep/text`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $TextId } from "@beep/identity/packages"
 *
 * const id = $TextId.make("Text")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $TextId: Identity.IdentityComposer<"@beep/text"> = /*#__PURE__*/ $I.create("text");

/**
 * Identity composer for `@beep/annotation`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $AnnotationId } from "@beep/identity/packages"
 *
 * const id = $AnnotationId.make("Annotation")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $AnnotationId: Identity.IdentityComposer<"@beep/annotation"> = /*#__PURE__*/ $I.create("annotation");

/**
 * Identity composer for `@beep/playwright`.
 *
 * **Example** (Make package ID)
 *
 * ```ts import.meta.vitest name="Make package ID"
 * import { $PlaywrightId } from "@beep/identity/packages"
 *
 * const id = $PlaywrightId.make("Playwright")
 * console.log(id)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $PlaywrightId: Identity.IdentityComposer<"@beep/playwright"> = /*#__PURE__*/ $I.create("playwright");
