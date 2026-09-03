/**
 * Deterministic package partitions for the hosted Lint and Test Unit lanes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Ci/CiLanePartitions");

/**
 * Repository-relative path to the committed CI lane partition table.
 *
 * **Example** (Show the repair target)
 *
 * ```ts
 * import { CI_LANE_PARTITION_TABLE_PATH } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CI_LANE_PARTITION_TABLE_PATH)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CI_LANE_PARTITION_TABLE_PATH = "packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts";

/**
 * CI lanes that support deterministic package partitions.
 *
 * **Example** (Recognize a partitioned lane)
 *
 * ```ts
 * import { PartitionedCiLane } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(PartitionedCiLane.is.lint("lint"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PartitionedCiLane = LiteralKit(["lint", "test-unit"]).pipe(
  $I.annoteSchema("PartitionedCiLane", {
    description: "CI lane whose executable package tasks have deterministic hosted partitions.",
  })
);

/**
 * CI lane that supports deterministic package partitions.
 *
 * **Example** (Type a partitioned lane)
 *
 * ```ts
 * import type { PartitionedCiLane } from "@beep/repo-cli/commands/Ci"
 *
 * const lane: PartitionedCiLane = "lint"
 * console.log(lane)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PartitionedCiLane = typeof PartitionedCiLane.Type;

/**
 * Stable identifiers for the five hosted CI lane partitions.
 *
 * **Example** (Recognize a lint partition)
 *
 * ```ts
 * import { CiLanePartitionId } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiLanePartitionId.is["lint-a"]("lint-a"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiLanePartitionId = LiteralKit(["lint-a", "lint-b", "repo-cli", "unit-a", "unit-b"]).pipe(
  $I.annoteSchema("CiLanePartitionId", {
    description: "Stable identifier for one hosted Lint or Test Unit partition.",
  })
);

/**
 * Stable identifier for one hosted CI lane partition.
 *
 * **Example** (Type a unit partition)
 *
 * ```ts
 * import type { CiLanePartitionId } from "@beep/repo-cli/commands/Ci"
 *
 * const partition: CiLanePartitionId = "unit-a"
 * console.log(partition)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CiLanePartitionId = typeof CiLanePartitionId.Type;

/**
 * Schema-backed assignment and measured weight for one CI lane partition.
 *
 * **Example** (Inspect a partition)
 *
 * ```ts
 * import { CI_LANE_PARTITIONS } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CI_LANE_PARTITIONS[0]?.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLanePartition extends S.Class<CiLanePartition>($I`CiLanePartition`)(
  {
    id: CiLanePartitionId,
    lane: PartitionedCiLane,
    packages: S.Array(S.String),
    weightSeconds: S.Finite,
  },
  $I.annote("CiLanePartition", {
    description: "Schema-backed package assignment and measured p95 weight for one CI lane partition.",
  })
) {}

/**
 * Deterministic Lint and Test Unit package partitions.
 *
 * **Details**
 *
 * Generated from the p95 package-task weights recorded in
 * `goals/ci-lane-economics/research/tail-attribution.md`. For each lane,
 * candidates are ordered by descending p95 weight with task id as the stable
 * tie-break, then assigned to the currently lightest bin. Test Unit first
 * isolates `@beep/repo-cli`; the remaining tasks are assigned to two bins.
 * The weights are evidence, not runtime scheduling inputs.
 *
 * **Example** (List the hosted partitions)
 *
 * ```ts
 * import { CI_LANE_PARTITIONS } from "@beep/repo-cli/commands/Ci"
 * import * as A from "effect/Array"
 *
 * console.log(A.map(CI_LANE_PARTITIONS, (partition) => partition.id))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CI_LANE_PARTITIONS: ReadonlyArray<CiLanePartition> = [
  CiLanePartition.make({
    id: "lint-a",
    lane: "lint",
    weightSeconds: 1132,
    packages: [
      "@beep/repo-cli",
      "@beep/types",
      "@beep/colors",
      "@beep/obs",
      "@beep/pacer",
      "@beep/utils",
      "@beep/agents-client",
      "@beep/agents-server",
      "@beep/agents-use-cases",
      "@beep/ai-sync",
      "@beep/api-transport",
      "@beep/architecture-lab-config",
      "@beep/architecture-lab-proof",
      "@beep/architecture-lab-use-cases",
      "@beep/brand",
      "@beep/codegen-kit",
      "@beep/db-admin",
      "@beep/doc-text",
      "@beep/dock",
      "@beep/documents-server",
      "@beep/documents-use-cases",
      "@beep/duckdb",
      "@beep/editor",
      "@beep/epistemic-client",
      "@beep/epistemic-domain",
      "@beep/epistemic-tables",
      "@beep/epistemic-use-cases",
      "@beep/face-detection",
      "@beep/file-processing",
      "@beep/gov-legal-mcp",
      "@beep/graph-3d",
      "@beep/identity",
      "@beep/langextract",
      "@beep/law-practice-server",
      "@beep/lexical-schema",
      "@beep/m365-mcp",
      "@beep/mcp-kit",
      "@beep/n3",
      "@beep/nlp-processing",
      "@beep/observability",
      "@beep/onepassword-cli",
      "@beep/ontology-domain",
      "@beep/ontology",
      "@beep/openai",
      "@beep/oxigraph",
      "@beep/pglite",
      "@beep/postgres",
      "@beep/pretext",
      "@beep/qa-capture",
      "@beep/repo-ai-metrics",
      "@beep/repo-docgen",
      "@beep/runpod",
      "@beep/semantic-web",
      "@beep/shared-tables",
      "@beep/skill-contract",
      "@beep/tailscale",
      "@beep/ui",
      "@beep/uspto",
      "@beep/wink",
      "@beep/workspace-server",
      "@beep/workspace-use-cases",
      "@beep/architecture-lab-tables",
      "@beep/law-practice-tables",
      "@beep/ontology-client",
      "@beep/shacl",
      "@beep/schema",
      "@beep/professional-desktop",
    ],
  }),
  CiLanePartition.make({
    id: "lint-b",
    lane: "lint",
    weightSeconds: 1134,
    packages: [
      "@beep/fc-runs",
      "@beep/todox",
      "@beep/box-provisioning",
      "@beep/html",
      "@beep/ontology-server",
      "@beep/test-utils",
      "@beep/acp",
      "@beep/agents-domain",
      "@beep/agents-tables",
      "@beep/ai-provider-cli",
      "@beep/anthropic",
      "@beep/architecture-lab-client",
      "@beep/architecture-lab-domain",
      "@beep/architecture-lab-server",
      "@beep/box",
      "@beep/chalk",
      "@beep/cosmos",
      "@beep/discord",
      "@beep/dock-react",
      "@beep/documents-domain",
      "@beep/documents-tables",
      "@beep/drizzle",
      "@beep/ecfr",
      "@beep/effect-drizzle",
      "@beep/epistemic-config",
      "@beep/epistemic-server",
      "@beep/epistemic-ui",
      "@beep/exiftool",
      "@beep/ffmpeg",
      "@beep/firecrawl",
      "@beep/govinfo",
      "@beep/hubspot",
      "@beep/infra",
      "@beep/law-practice-domain",
      "@beep/law-practice-use-cases",
      "@beep/lint-rules",
      "@beep/m365",
      "@beep/md",
      "@beep/nlp-mcp",
      "@beep/nlp",
      "@beep/oip-web",
      "@beep/ontology-config",
      "@beep/ontology-use-cases",
      "@beep/openai-compat",
      "@beep/openclaw",
      "@beep/pandoc-ast",
      "@beep/phoenix",
      "@beep/practice-kg-mcp",
      "@beep/provenance",
      "@beep/rdf",
      "@beep/repo-configs",
      "@beep/repo-utils",
      "@beep/sanity",
      "@beep/shared-domain",
      "@beep/shared-use-cases",
      "@beep/storybook",
      "@beep/tika",
      "@beep/uspto-mcp",
      "@beep/venice-ai",
      "@beep/workspace-domain",
      "@beep/workspace-tables",
      "@beep/xai",
      "@beep/architecture-lab-ui",
      "@beep/libpff",
      "@beep/rdf-canonize",
      "@beep/ontology-ui",
      "@beep/data",
    ],
  }),
  CiLanePartition.make({
    id: "repo-cli",
    lane: "test-unit",
    weightSeconds: 879,
    packages: ["@beep/repo-cli"],
  }),
  CiLanePartition.make({
    id: "unit-a",
    lane: "test-unit",
    weightSeconds: 1214,
    packages: [
      "@beep/professional-desktop",
      "@beep/lexical-schema",
      "@beep/repo-utils",
      "@beep/observability",
      "@beep/ontology-client",
      "@beep/documents-server",
      "@beep/repo-configs",
      "@beep/agents-client",
      "@beep/documents-domain",
      "@beep/epistemic-use-cases",
      "@beep/agents-server",
      "@beep/skill-contract",
      "@beep/lint-rules",
      "@beep/law-practice-domain",
      "@beep/shared-domain",
      "@beep/epistemic-server",
      "@beep/ontology-server",
      "@beep/law-practice-use-cases",
      "@beep/nlp",
      "@beep/workspace-server",
      "@beep/mcp-kit",
      "@beep/md",
      "@beep/test-utils",
      "@beep/tika",
      "@beep/documents-tables",
      "@beep/ffmpeg",
      "@beep/ontology",
      "@beep/ui",
      "@beep/architecture-lab-domain",
      "@beep/govinfo",
      "@beep/pretext",
      "@beep/db-admin",
      "@beep/workspace-use-cases",
      "@beep/doc-text",
      "@beep/agents-domain",
      "@beep/architecture-lab-server",
      "@beep/ontology-ui",
      "@beep/pacer",
      "@beep/ai-provider-cli",
      "@beep/anthropic",
      "@beep/chalk",
      "@beep/epistemic-client",
      "@beep/gov-legal-mcp",
      "@beep/m365-mcp",
      "@beep/provenance",
      "@beep/runpod",
      "@beep/workspace-tables",
      "@beep/architecture-lab-proof",
      "@beep/codegen-kit",
      "@beep/discord",
      "@beep/firecrawl",
      "@beep/openai-compat",
      "@beep/sanity",
      "@beep/tailscale",
      "@beep/venice-ai",
      "@beep/architecture-lab-config",
      "@beep/colors",
      "@beep/epistemic-config",
      "@beep/identity",
      "@beep/onepassword-cli",
      "@beep/uspto-mcp",
      "@beep/utils",
      "@beep/data",
      "@beep/todox",
      "@beep/ontology-config",
      "@beep/storybook",
    ],
  }),
  CiLanePartition.make({
    id: "unit-b",
    lane: "test-unit",
    weightSeconds: 1214,
    packages: [
      "@beep/law-practice-server",
      "@beep/repo-ai-metrics",
      "@beep/editor",
      "@beep/schema",
      "@beep/html",
      "@beep/infra",
      "@beep/repo-docgen",
      "@beep/dock",
      "@beep/wink",
      "@beep/documents-use-cases",
      "@beep/qa-capture",
      "@beep/ontology-use-cases",
      "@beep/epistemic-domain",
      "@beep/epistemic-ui",
      "@beep/dock-react",
      "@beep/nlp-processing",
      "@beep/agents-use-cases",
      "@beep/langextract",
      "@beep/openclaw",
      "@beep/rdf",
      "@beep/box-provisioning",
      "@beep/pandoc-ast",
      "@beep/nlp-mcp",
      "@beep/law-practice-tables",
      "@beep/practice-kg-mcp",
      "@beep/architecture-lab-use-cases",
      "@beep/epistemic-tables",
      "@beep/oip-web",
      "@beep/pglite",
      "@beep/acp",
      "@beep/file-processing",
      "@beep/libpff",
      "@beep/semantic-web",
      "@beep/api-transport",
      "@beep/brand",
      "@beep/obs",
      "@beep/duckdb",
      "@beep/openai",
      "@beep/workspace-domain",
      "@beep/ai-sync",
      "@beep/architecture-lab-tables",
      "@beep/ecfr",
      "@beep/face-detection",
      "@beep/hubspot",
      "@beep/postgres",
      "@beep/rdf-canonize",
      "@beep/shacl",
      "@beep/agents-tables",
      "@beep/architecture-lab-client",
      "@beep/box",
      "@beep/cosmos",
      "@beep/exiftool",
      "@beep/m365",
      "@beep/phoenix",
      "@beep/shared-tables",
      "@beep/uspto",
      "@beep/xai",
      "@beep/drizzle",
      "@beep/graph-3d",
      "@beep/n3",
      "@beep/oxigraph",
      "@beep/shared-use-cases",
      "@beep/architecture-lab-ui",
      "@beep/effect-drizzle",
      "@beep/ontology-domain",
      "@beep/fc-runs",
      "@beep/types",
    ],
  }),
];
