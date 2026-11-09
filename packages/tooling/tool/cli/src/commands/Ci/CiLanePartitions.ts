/**
 * Deterministic package partitions for the hosted Lint and Test Unit lanes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { constant, dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
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
 * Stable identifiers for the hosted lint and unit-test partitions.
 *
 * **Details**
 *
 * `repo-cli-1` to `repo-cli-8` and `law-practice-1` to `law-practice-11` are
 * Vitest `--shard` slices of the `@beep/repo-cli#test` and
 * `@beep/law-practice-server#test` tasks; every other partition is a package bin.
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
export const CiLanePartitionId = LiteralKit([
  "lint-a",
  "lint-b",
  "repo-cli-1",
  "repo-cli-2",
  "repo-cli-3",
  "repo-cli-4",
  "repo-cli-5",
  "repo-cli-6",
  "repo-cli-7",
  "repo-cli-8",
  "law-practice-1",
  "law-practice-2",
  "law-practice-3",
  "law-practice-4",
  "law-practice-5",
  "law-practice-6",
  "law-practice-7",
  "law-practice-8",
  "law-practice-9",
  "law-practice-10",
  "law-practice-11",
  "unit-a",
  "unit-b",
  "unit-c",
  "unit-d",
  "unit-e",
  "unit-f",
]).pipe(
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
 * Vitest `--shard=<index>/<total>` slice carried by one CI lane partition.
 *
 * **Details**
 *
 * Vitest hashes each spec path and slices the sorted list into `total`
 * contiguous ranges, so the split is deterministic per file set. `index` is
 * one-based and never exceeds `total`; `total` is at least two because a
 * single-shard partition is just an unsharded bin.
 *
 * **Example** (Describe the first of two halves)
 *
 * ```ts
 * import { CiLanePartitionShard } from "@beep/repo-cli/commands/Ci"
 *
 * const shard = CiLanePartitionShard.make({ index: 1, total: 2 })
 * console.log(`--shard=${shard.index}/${shard.total}`)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLanePartitionShard extends S.Opaque<CiLanePartitionShard, { readonly brand: unique symbol }>()(
  S.Struct({
    index: S.Int.check(S.isGreaterThanOrEqualTo(1)),
    total: S.Int.check(S.isGreaterThanOrEqualTo(2)),
  })
    .check(
      S.makeFilter(
        (shard: { readonly index: number; readonly total: number }) => shard.index <= shard.total,
        $I.annote("CiLanePartitionShardIndexBoundCheck", {
          title: "CI Lane Partition Shard Index Bound",
          description: "Checks that a Vitest shard index never exceeds its shard total.",
          message: "Shard index must not exceed the shard total.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("CiLanePartitionShard", {
        description: "One-based Vitest --shard slice (index/total) forwarded by a sharded CI lane partition.",
      })
    )
) {}

/**
 * Schema-backed assignment and measured weight for one CI lane partition.
 *
 * **Details**
 *
 * A partition that carries `shard` runs a Vitest slice of its single package
 * instead of the whole task; sibling partitions with the same package and
 * total together cover every file once.
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
export class CiLanePartition extends S.Opaque<CiLanePartition, { readonly brand: unique symbol }>()(
  S.Struct({
    id: CiLanePartitionId,
    lane: PartitionedCiLane,
    packages: S.Array(S.String),
    weightSeconds: S.Finite,
    shard: S.optionalKey(CiLanePartitionShard),
  }).pipe(
    $I.annoteSchema("CiLanePartition", {
      description: "Schema-backed package assignment and measured p95 weight for one CI lane partition.",
    })
  )
) {}

/**
 * Deterministic Lint and Test Unit package partitions.
 *
 * **Details**
 *
 * Lint bins come from the p95 package-task weights recorded in
 * `goals/ci-lane-economics/research/tail-attribution.md`: candidates ordered
 * by descending p95 weight with task id as the stable tie-break, each assigned
 * to the currently lightest bin. Test Unit isolates `@beep/repo-cli` (eight
 * Vitest `--shard` slices, `packages/tooling/tool/cli/vitest.shards.json`) and
 * `@beep/law-practice-server` (eleven slices,
 * `packages/law-practice/server/vitest.shards.json`); a sharded weight is the
 * shard's planned file time, and the six unit bins are the LPT repack of every
 * other package's Vitest wall measured on green main run 42554761567
 * (2026-11-09; `goals/ci-lane-economics` decisions of 2026-11-02, 2026-11-08
 * and 2026-11-09). `beep ci partitions rebalance --write --run <id>` refreshes
 * the plans and prints the bin repack; `--check` fails when a weight drifts
 * from its plan or a partition exceeds its budget. The weights are evidence,
 * not runtime scheduling inputs.
 * A package the table does not name is placed by `ciLaneDefaultPlacements`, so
 * a new workspace needs no edit here; add it explicitly only when rebalancing.
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
      "@beep/occt",
      "@beep/pdf-tools",
      "@beep/technical-drawing",
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
      "@beep/execution-authority-domain",
      "@beep/epistemic-tables",
      "@beep/execution-authority-tables",
      "@beep/epistemic-use-cases",
      "@beep/execution-authority-use-cases",
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
      "@beep/freshbooks",
      "@beep/xstate",
      "@beep/tesseract",
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
      "@beep/test-runner",
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
      "@beep/execution-authority-config",
      "@beep/epistemic-server",
      "@beep/execution-authority-server",
      "@beep/epistemic-ui",
      "@beep/exiftool",
      "@beep/ffmpeg",
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
      "@beep/docket-intake",
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
      "@beep/workspace-domain",
      "@beep/workspace-tables",
      "@beep/architecture-lab-ui",
      "@beep/libpff",
      "@beep/rdf-canonize",
      "@beep/ontology-ui",
      "@beep/data",
      "@beep/poppler",
    ],
  }),
  CiLanePartition.make({
    id: "repo-cli-1",
    lane: "test-unit",
    weightSeconds: 263,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 1, total: 8 }),
  }),
  CiLanePartition.make({
    id: "repo-cli-2",
    lane: "test-unit",
    weightSeconds: 263,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 2, total: 8 }),
  }),
  CiLanePartition.make({
    id: "repo-cli-3",
    lane: "test-unit",
    weightSeconds: 263,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 3, total: 8 }),
  }),
  CiLanePartition.make({
    id: "repo-cli-4",
    lane: "test-unit",
    weightSeconds: 263,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 4, total: 8 }),
  }),
  CiLanePartition.make({
    id: "repo-cli-5",
    lane: "test-unit",
    weightSeconds: 263,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 5, total: 8 }),
  }),
  CiLanePartition.make({
    id: "repo-cli-6",
    lane: "test-unit",
    weightSeconds: 263,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 6, total: 8 }),
  }),
  CiLanePartition.make({
    id: "repo-cli-7",
    lane: "test-unit",
    weightSeconds: 263,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 7, total: 8 }),
  }),
  CiLanePartition.make({
    id: "repo-cli-8",
    lane: "test-unit",
    weightSeconds: 263,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 8, total: 8 }),
  }),
  // @beep/law-practice-server grew from 98 s (2026-11-02) to about 4,270 s of
  // Bun/Istanbul file time once #2847 registered the canonical citation
  // corpora. Three sha1-hash shards ran 23.0 / 31.6 / 22.8 min on green main run
  // 42554761567 (file time 1274 / 1779 / 1267 s); eleven LPT shards planned by
  // packages/law-practice/server/vitest.shards.json hold about 388 s of file
  // time each, under the 480 s budget with room for the corpus to grow. The
  // weights are the planned file sums; `beep ci partitions rebalance --check`
  // fails when they drift from the plan.
  CiLanePartition.make({
    id: "law-practice-1",
    lane: "test-unit",
    weightSeconds: 393,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 1, total: 11 }),
  }),
  CiLanePartition.make({
    id: "law-practice-2",
    lane: "test-unit",
    weightSeconds: 393,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 2, total: 11 }),
  }),
  CiLanePartition.make({
    id: "law-practice-3",
    lane: "test-unit",
    weightSeconds: 393,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 3, total: 11 }),
  }),
  CiLanePartition.make({
    id: "law-practice-4",
    lane: "test-unit",
    weightSeconds: 393,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 4, total: 11 }),
  }),
  CiLanePartition.make({
    id: "law-practice-5",
    lane: "test-unit",
    weightSeconds: 393,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 5, total: 11 }),
  }),
  CiLanePartition.make({
    id: "law-practice-6",
    lane: "test-unit",
    weightSeconds: 393,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 6, total: 11 }),
  }),
  CiLanePartition.make({
    id: "law-practice-7",
    lane: "test-unit",
    weightSeconds: 393,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 7, total: 11 }),
  }),
  CiLanePartition.make({
    id: "law-practice-8",
    lane: "test-unit",
    weightSeconds: 393,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 8, total: 11 }),
  }),
  CiLanePartition.make({
    id: "law-practice-9",
    lane: "test-unit",
    weightSeconds: 393,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 9, total: 11 }),
  }),
  CiLanePartition.make({
    id: "law-practice-10",
    lane: "test-unit",
    weightSeconds: 393,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 10, total: 11 }),
  }),
  CiLanePartition.make({
    id: "law-practice-11",
    lane: "test-unit",
    weightSeconds: 393,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 11, total: 11 }),
  }),
  // Six unit bins, LPT over per-package Vitest wall seconds measured on green main run 42554761567
  // (2026-11-09; four bins then summed 809 / 894 / 1,175 / 700 s and unit-c took 13.9 min). The weight is the
  // bin's serial sum; the lane runs two package steps at once, so a bin's body is about half of it plus
  // about 180 s of setup, prerequisite builds and artifact upload. Every package that ran, default-placed
  // ones included, is curated here. Budget: CI_UNIT_BIN_SERIAL_BUDGET_SECONDS (CiPartitions.schemas.ts).
  CiLanePartition.make({
    id: "unit-a",
    lane: "test-unit",
    weightSeconds: 594,
    packages: [
      "@beep/anthropic",
      "@beep/architecture-lab-tables",
      "@beep/architecture-lab-use-cases",
      "@beep/cli-kit",
      "@beep/config-file",
      "@beep/dock-react",
      "@beep/documents-use-cases",
      "@beep/epistemic-tables",
      "@beep/epistemic-use-cases",
      "@beep/epistemics",
      "@beep/execution-authority-config",
      "@beep/execution-authority-domain",
      "@beep/file-processing",
      "@beep/html",
      "@beep/libpff",
      "@beep/mcpb-kit",
      "@beep/md",
      "@beep/memfs",
      "@beep/oip-web",
      "@beep/ontology",
      "@beep/ontology-domain",
      "@beep/openai-compat",
      "@beep/oxigraph",
      "@beep/poppler",
      "@beep/pretext",
      "@beep/repo-ai-metrics",
      "@beep/semver",
      "@beep/technical-drawing",
      "@beep/tesseract",
      "@beep/workspace-tables",
      "@beep/xdg",
    ],
  }),
  CiLanePartition.make({
    id: "unit-b",
    lane: "test-unit",
    weightSeconds: 595,
    packages: [
      "@beep/acp",
      "@beep/chalk",
      "@beep/colors",
      "@beep/discord",
      "@beep/doc-text",
      "@beep/editor",
      "@beep/freshbooks",
      "@beep/git",
      "@beep/gov-legal-mcp",
      "@beep/infra",
      "@beep/jsonc",
      "@beep/law-practice-tables",
      "@beep/managed-section",
      "@beep/markdown",
      "@beep/npm-spec",
      "@beep/onepassword-cli",
      "@beep/ontology-server",
      "@beep/openai",
      "@beep/party-server",
      "@beep/phoenix",
      "@beep/postgres",
      "@beep/practice-identify",
      "@beep/public-site",
      "@beep/repo-docgen",
      "@beep/shared-domain",
      "@beep/shared-use-cases",
      "@beep/spdx",
      "@beep/storybook",
      "@beep/tika",
      "@beep/toml",
      "@beep/types",
      "@beep/uspto",
      "@beep/utils",
      "@beep/xstate",
    ],
  }),
  CiLanePartition.make({
    id: "unit-c",
    lane: "test-unit",
    weightSeconds: 594,
    packages: [
      "@beep/ai-sync",
      "@beep/api-transport",
      "@beep/brand",
      "@beep/cosmos",
      "@beep/data",
      "@beep/documents-domain",
      "@beep/epistemic-client",
      "@beep/fc-runs",
      "@beep/ffmpeg",
      "@beep/github-references",
      "@beep/hubspot",
      "@beep/law-practice-domain",
      "@beep/law-practice-use-cases",
      "@beep/observability",
      "@beep/occt",
      "@beep/ontology-use-cases",
      "@beep/openclaw",
      "@beep/package-json",
      "@beep/party-domain",
      "@beep/pglite",
      "@beep/rdf",
      "@beep/repo-cli-kit",
      "@beep/repo-utils",
      "@beep/sbom",
      "@beep/schema",
      "@beep/schema-org",
      "@beep/shacl",
      "@beep/todox",
      "@beep/workspace-domain",
      "@beep/workspace-use-cases",
      "@beep/yaml",
    ],
  }),
  CiLanePartition.make({
    id: "unit-d",
    lane: "test-unit",
    weightSeconds: 594,
    packages: [
      "@beep/agents-domain",
      "@beep/agents-server",
      "@beep/alchemy-postgres",
      "@beep/architecture-lab-client",
      "@beep/architecture-lab-config",
      "@beep/beep-effect-web",
      "@beep/commands",
      "@beep/duckdb",
      "@beep/epistemic-domain",
      "@beep/execution-authority-server",
      "@beep/execution-authority-use-cases",
      "@beep/eyecite",
      "@beep/github",
      "@beep/github-reporting",
      "@beep/identity",
      "@beep/langextract",
      "@beep/m365",
      "@beep/mcp-kit",
      "@beep/nlp-mcp",
      "@beep/nlp-processing",
      "@beep/ontology-client",
      "@beep/palantiri",
      "@beep/pdf-tools",
      "@beep/practice-mail-tagging",
      "@beep/practice-setup",
      "@beep/professional-desktop",
      "@beep/provenance",
      "@beep/skill-contract",
      "@beep/tailscale",
      "@beep/ui",
      "@beep/uspto-mcp",
    ],
  }),
  CiLanePartition.make({
    id: "unit-e",
    lane: "test-unit",
    weightSeconds: 594,
    packages: [
      "@beep/agents-tables",
      "@beep/architecture-lab-domain",
      "@beep/architecture-lab-ui",
      "@beep/box",
      "@beep/box-provisioning",
      "@beep/codegen-kit",
      "@beep/dock",
      "@beep/docket-intake",
      "@beep/documents-server",
      "@beep/documents-tables",
      "@beep/ecfr",
      "@beep/epistemic-server",
      "@beep/execution-authority-tables",
      "@beep/github-commands",
      "@beep/graph-3d",
      "@beep/jsonl",
      "@beep/lexical-schema",
      "@beep/lint-rules",
      "@beep/lockfiles",
      "@beep/m365-mcp",
      "@beep/ontology-config",
      "@beep/pacer",
      "@beep/practice-gateway",
      "@beep/practice-kg-mcp",
      "@beep/practice-m365-contacts",
      "@beep/practice-review-hub",
      "@beep/qa-capture",
      "@beep/runpod",
      "@beep/runtime-env",
      "@beep/sanity",
      "@beep/tsconfig",
      "@beep/workspace-server",
    ],
  }),
  CiLanePartition.make({
    id: "unit-f",
    lane: "test-unit",
    weightSeconds: 593,
    packages: [
      "@beep/agents-client",
      "@beep/agents-use-cases",
      "@beep/ai-provider-cli",
      "@beep/architecture-lab-proof",
      "@beep/architecture-lab-server",
      "@beep/db-admin",
      "@beep/drizzle",
      "@beep/effect-drizzle",
      "@beep/epistemic-ui",
      "@beep/exiftool",
      "@beep/firecrawl",
      "@beep/github-actions",
      "@beep/glob",
      "@beep/govinfo",
      "@beep/n3",
      "@beep/nlp",
      "@beep/obs",
      "@beep/ontology-ui",
      "@beep/pandoc-ast",
      "@beep/party-use-cases",
      "@beep/practice-claude-mod",
      "@beep/rdf-canonize",
      "@beep/repo-configs",
      "@beep/repo-tsconfig",
      "@beep/repo-workspaces",
      "@beep/semantic-web",
      "@beep/shared-tables",
      "@beep/test-runner",
      "@beep/test-utils",
      "@beep/walker",
      "@beep/windows-secrets",
      "@beep/wink",
    ],
  }),
];

/**
 * Default placement for one executable package the curated table does not name.
 *
 * **Example** (Describe a default placement)
 *
 * ```ts
 * import { CiLaneDefaultPlacement } from "@beep/repo-cli/commands/Ci"
 *
 * const placement = CiLaneDefaultPlacement.make({ packageName: "@beep/new-package", partition: "lint-a" })
 * console.log(placement.partition)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLaneDefaultPlacement extends S.Opaque<CiLaneDefaultPlacement, { readonly brand: unique symbol }>()(
  S.Struct({
    packageName: S.String,
    partition: CiLanePartitionId,
  }).pipe(
    $I.annoteSchema("CiLaneDefaultPlacement", {
      description: "Name-derived partition assigned to an executable package absent from the curated table.",
    })
  )
) {}

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

// FNV-1a over UTF-16 code units, spelled out here so a placement never moves
// when a runtime or library changes its own string hash.
const stablePackageNameHash = (packageName: string): number =>
  A.reduce(
    A.makeBy(Str.length(packageName), (index) => O.getOrElse(Str.charCodeAt(index)(packageName), constant(Number.NaN))),
    FNV_OFFSET_BASIS,
    (hash, codeUnit) => Math.imul(hash ^ codeUnit, FNV_PRIME) >>> 0
  );

const partitionIdOrder: Order.Order<CiLanePartition> = Order.mapInput(Order.String, (partition) => partition.id);

/**
 * Derive the default partition of every executable package the lane's curated bins do not name.
 *
 * **Details**
 *
 * The curated table stays the measured LPT placement. A package it does not
 * name (a freshly created workspace) lands in one of the lane's unsharded bins,
 * chosen by an FNV-1a hash of its name over the bins in id order. The choice
 * depends only on the package name and the lane's bin ids, so adding another
 * package never moves an existing one. A lane without an unsharded bin yields
 * no placement, and the coverage proof then fails closed.
 *
 * **Example** (Place an unlisted package)
 *
 * ```ts
 * import { CI_LANE_PARTITIONS, ciLaneDefaultPlacements } from "@beep/repo-cli/commands/Ci"
 * import * as A from "effect/Array"
 *
 * const lintBins = A.filter(CI_LANE_PARTITIONS, (partition) => partition.lane === "lint")
 * console.log(ciLaneDefaultPlacements(lintBins, ["@beep/new-package"]))
 * ```
 *
 * @param lanePartitions - Curated partitions of one lane.
 * @param taskPackageNames - Every package with an executable task in that lane.
 * @returns One placement per unlisted package, ordered by package name.
 * @category utilities
 * @since 0.0.0
 */
export const ciLaneDefaultPlacements: {
  (
    lanePartitions: ReadonlyArray<CiLanePartition>,
    taskPackageNames: ReadonlyArray<string>
  ): ReadonlyArray<CiLaneDefaultPlacement>;
  (
    taskPackageNames: ReadonlyArray<string>
  ): (lanePartitions: ReadonlyArray<CiLanePartition>) => ReadonlyArray<CiLaneDefaultPlacement>;
} = dual(
  2,
  (
    lanePartitions: ReadonlyArray<CiLanePartition>,
    taskPackageNames: ReadonlyArray<string>
  ): ReadonlyArray<CiLaneDefaultPlacement> => {
    const assigned = HashSet.fromIterable(A.flatMap(lanePartitions, (partition) => partition.packages));
    const bins = pipe(
      lanePartitions,
      A.filter((partition) => P.isUndefined(partition.shard)),
      A.sort(partitionIdOrder)
    );

    return pipe(
      taskPackageNames,
      A.dedupe,
      A.filter((packageName) => !HashSet.has(assigned, packageName)),
      A.sort(Order.String),
      A.map((packageName) =>
        pipe(
          A.get(bins, stablePackageNameHash(packageName) % Math.max(A.length(bins), 1)),
          O.map((bin) => CiLaneDefaultPlacement.make({ packageName, partition: bin.id }))
        )
      ),
      A.getSomes
    );
  }
);

/**
 * Extend a lane's curated partitions with the default placement of every unlisted executable package.
 *
 * **Example** (Resolve the effective lint bins)
 *
 * ```ts
 * import { CI_LANE_PARTITIONS, withCiLaneDefaultPlacements } from "@beep/repo-cli/commands/Ci"
 * import * as A from "effect/Array"
 *
 * const lintBins = A.filter(CI_LANE_PARTITIONS, (partition) => partition.lane === "lint")
 * const effective = withCiLaneDefaultPlacements(lintBins, ["@beep/new-package"])
 * console.log(A.some(effective, (partition) => A.contains(partition.packages, "@beep/new-package")))
 * ```
 *
 * @param lanePartitions - Curated partitions of one lane.
 * @param taskPackageNames - Every package with an executable task in that lane.
 * @returns The same partitions, with default-placed packages appended to their bins.
 * @category utilities
 * @since 0.0.0
 */
export const withCiLaneDefaultPlacements: {
  (
    lanePartitions: ReadonlyArray<CiLanePartition>,
    taskPackageNames: ReadonlyArray<string>
  ): ReadonlyArray<CiLanePartition>;
  (
    taskPackageNames: ReadonlyArray<string>
  ): (lanePartitions: ReadonlyArray<CiLanePartition>) => ReadonlyArray<CiLanePartition>;
} = dual(
  2,
  (
    lanePartitions: ReadonlyArray<CiLanePartition>,
    taskPackageNames: ReadonlyArray<string>
  ): ReadonlyArray<CiLanePartition> => {
    const placements = ciLaneDefaultPlacements(lanePartitions, taskPackageNames);

    return A.isReadonlyArrayEmpty(placements)
      ? lanePartitions
      : A.map(lanePartitions, (partition) =>
          CiLanePartition.make({
            ...partition,
            packages: A.appendAll(
              partition.packages,
              pipe(
                placements,
                A.filter((placement) => placement.partition === partition.id),
                A.map((placement) => placement.packageName)
              )
            ),
          })
        );
  }
);
