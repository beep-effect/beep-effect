/**
 * Deterministic package partitions for the hosted Lint, Test Unit and Test Integration lanes.
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
export const PartitionedCiLane = LiteralKit(["lint", "test-unit", "test-integration"]).pipe(
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
 * Stable identifiers for the hosted lint, unit-test and integration-test partitions.
 *
 * **Details**
 *
 * `repo-cli-1` to `repo-cli-11` and `law-practice-1` to `law-practice-12` are
 * Vitest `--shard` slices of the `@beep/repo-cli#test` and
 * `@beep/law-practice-server#test` tasks, `lps-int-1` to `lps-int-19` the
 * nineteen slices of `@beep/law-practice-server#test:integration:parallel`;
 * `int-rest` is the integration catch-all bin and every other partition is a
 * package bin.
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
  "repo-cli-9",
  "repo-cli-10",
  "repo-cli-11",
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
  "law-practice-12",
  "unit-a",
  "unit-b",
  "unit-c",
  "unit-d",
  "unit-e",
  "unit-f",
  "unit-g",
  "lps-int-1",
  "lps-int-2",
  "lps-int-3",
  "lps-int-4",
  "lps-int-5",
  "lps-int-6",
  "lps-int-7",
  "lps-int-8",
  "lps-int-9",
  "lps-int-10",
  "lps-int-11",
  "lps-int-12",
  "lps-int-13",
  "lps-int-14",
  "lps-int-15",
  "lps-int-16",
  "lps-int-17",
  "lps-int-18",
  "lps-int-19",
  "int-rest",
]).pipe(
  $I.annoteSchema("CiLanePartitionId", {
    description: "Stable identifier for one hosted Lint, Test Unit or Test Integration partition.",
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
 * `startFirst` names the packages a Test Unit bin starts before the rest,
 * heaviest first ({@link ciLaneStartOrder}); it is a scheduling input, unlike
 * the weight.
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
    startFirst: S.String.pipe(S.Array, S.optionalKey),
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
 * to the currently lightest bin. Test Unit isolates `@beep/repo-cli` (eleven
 * Vitest `--shard` slices, `packages/tooling/tool/cli/vitest.shards.json`) and
 * `@beep/law-practice-server` (twelve slices,
 * `packages/law-practice/server/vitest.shards.json`); a sharded weight is the
 * shard's planned file time, and the seven unit bins are the LPT repack of every
 * other package's worst Vitest wall over six green runs, five on PR #3007 and
 * main run 42677073526 (`goals/ci-lane-economics` decisions of 2026-11-02,
 * 2026-11-08 and 2026-11-09). `beep ci partitions rebalance --write --run <id>`
 * refreshes the plans and prints the bin repack; `--check` fails when a weight
 * drifts from its plan or a partition exceeds its budget. The weights are
 * evidence, not runtime scheduling inputs; a bin's `startFirst` list is the one
 * scheduling input, the order its heaviest packages start in.
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
    weightSeconds: 321,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 1, total: 11 }),
  }),
  CiLanePartition.make({
    id: "repo-cli-2",
    lane: "test-unit",
    weightSeconds: 321,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 2, total: 11 }),
  }),
  CiLanePartition.make({
    id: "repo-cli-3",
    lane: "test-unit",
    weightSeconds: 321,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 3, total: 11 }),
  }),
  CiLanePartition.make({
    id: "repo-cli-4",
    lane: "test-unit",
    weightSeconds: 321,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 4, total: 11 }),
  }),
  CiLanePartition.make({
    id: "repo-cli-5",
    lane: "test-unit",
    weightSeconds: 321,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 5, total: 11 }),
  }),
  CiLanePartition.make({
    id: "repo-cli-6",
    lane: "test-unit",
    weightSeconds: 321,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 6, total: 11 }),
  }),
  CiLanePartition.make({
    id: "repo-cli-7",
    lane: "test-unit",
    weightSeconds: 321,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 7, total: 11 }),
  }),
  CiLanePartition.make({
    id: "repo-cli-8",
    lane: "test-unit",
    weightSeconds: 321,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 8, total: 11 }),
  }),
  CiLanePartition.make({
    id: "repo-cli-9",
    lane: "test-unit",
    weightSeconds: 321,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 9, total: 11 }),
  }),
  CiLanePartition.make({
    id: "repo-cli-10",
    lane: "test-unit",
    weightSeconds: 321,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 10, total: 11 }),
  }),
  CiLanePartition.make({
    id: "repo-cli-11",
    lane: "test-unit",
    weightSeconds: 321,
    packages: ["@beep/repo-cli"],
    shard: CiLanePartitionShard.make({ index: 11, total: 11 }),
  }),
  // @beep/law-practice-server grew from 98 s (2026-11-02) to about 4,270 s of
  // Bun/Istanbul file time once #2847 registered the canonical citation
  // corpora. Three sha1-hash shards ran 23.0 / 31.6 / 22.8 min on green main run
  // 42554761567 (file time 1274 / 1779 / 1267 s); twelve LPT shards planned by
  // packages/law-practice/server/vitest.shards.json hold about 371 s of file
  // time each at every file's worst measurement over PR #3007's four green runs
  // (42607991192, 42615698428, 42626103000, 42637312401; `rebalance --write`
  // with repeated `--run`, then `--prune` for the two files #3009 deleted):
  // hosted shards varied 0.6x to 1.3x around a single-run plan, so the plan
  // carries the worst case and the 480 s budget the rest. The weights are the
  // planned file sums; `beep ci partitions rebalance --check` fails when they
  // drift from the plan.
  CiLanePartition.make({
    id: "law-practice-1",
    lane: "test-unit",
    weightSeconds: 376,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 1, total: 12 }),
  }),
  CiLanePartition.make({
    id: "law-practice-2",
    lane: "test-unit",
    weightSeconds: 376,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 2, total: 12 }),
  }),
  CiLanePartition.make({
    id: "law-practice-3",
    lane: "test-unit",
    weightSeconds: 376,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 3, total: 12 }),
  }),
  CiLanePartition.make({
    id: "law-practice-4",
    lane: "test-unit",
    weightSeconds: 376,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 4, total: 12 }),
  }),
  CiLanePartition.make({
    id: "law-practice-5",
    lane: "test-unit",
    weightSeconds: 376,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 5, total: 12 }),
  }),
  CiLanePartition.make({
    id: "law-practice-6",
    lane: "test-unit",
    weightSeconds: 376,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 6, total: 12 }),
  }),
  CiLanePartition.make({
    id: "law-practice-7",
    lane: "test-unit",
    weightSeconds: 376,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 7, total: 12 }),
  }),
  CiLanePartition.make({
    id: "law-practice-8",
    lane: "test-unit",
    weightSeconds: 376,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 8, total: 12 }),
  }),
  CiLanePartition.make({
    id: "law-practice-9",
    lane: "test-unit",
    weightSeconds: 376,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 9, total: 12 }),
  }),
  CiLanePartition.make({
    id: "law-practice-10",
    lane: "test-unit",
    weightSeconds: 376,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 10, total: 12 }),
  }),
  CiLanePartition.make({
    id: "law-practice-11",
    lane: "test-unit",
    weightSeconds: 376,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 11, total: 12 }),
  }),
  CiLanePartition.make({
    id: "law-practice-12",
    lane: "test-unit",
    weightSeconds: 376,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 12, total: 12 }),
  }),
  // Seven unit bins, LPT over per-package Vitest wall seconds at each package's worst measurement across
  // six green runs: PR #3007's 42607991192, 42615698428, 42626103000, 42637312401 and 42646019844, and
  // main run 42677073526 (hosted package walls swing between runs). History: four bins from main run
  // 42554761567 summed 809 / 894 / 1,175 / 700 s and unit-c took 13.9 min; six bins of about 595 s still
  // let unit-a run 10.7 min; seven bins of 582 s ran 5.6-8.5 min on main run 42677073526 except unit-b at
  // 10.2 min, whose 309 s package started 162 s in and then ran alone. The lane runs two package steps at
  // once in list order, so each bin now starts its `startFirst` packages (30 s and over, heaviest first;
  // CI_UNIT_BIN_START_FIRST_SECONDS) before the rest, which keeps a body near the larger of its heaviest
  // package and half the serial sum, plus about 180 s of setup, prerequisite builds and upload. The weight
  // is the bin's serial sum. Every package that ran, default-placed ones included, is curated here;
  // @beep/infra and @beep/storybook kept their bin without a measurement in those runs.
  // Budget: CI_UNIT_BIN_SERIAL_BUDGET_SECONDS (CiPartitions.schemas.ts).
  CiLanePartition.make({
    id: "unit-a",
    lane: "test-unit",
    weightSeconds: 594,
    // law-practice-domain 322 s, alchemy-postgres 51 s, ontology-client 33 s
    startFirst: ["@beep/law-practice-domain", "@beep/alchemy-postgres", "@beep/ontology-client"],
    packages: [
      "@beep/agents-use-cases",
      "@beep/alchemy-postgres",
      "@beep/anthropic",
      "@beep/api-transport",
      "@beep/architecture-lab-tables",
      "@beep/beep-effect-web",
      "@beep/discord",
      "@beep/ecfr",
      "@beep/execution-authority-tables",
      "@beep/github",
      "@beep/jsonl",
      "@beep/law-practice-domain",
      "@beep/law-practice-tables",
      "@beep/lockfiles",
      "@beep/managed-section",
      "@beep/ontology-client",
      "@beep/pacer",
      "@beep/palantiri",
      "@beep/practice-claude-mod",
      "@beep/repo-tsconfig",
      "@beep/schema-org",
      "@beep/skill-contract",
      "@beep/spdx",
      "@beep/ui",
      "@beep/uspto",
      "@beep/workspace-domain",
    ],
  }),
  CiLanePartition.make({
    id: "unit-b",
    lane: "test-unit",
    weightSeconds: 593,
    // repo-ai-metrics 309 s, epistemic-server 59 s, occt 39 s
    startFirst: ["@beep/repo-ai-metrics", "@beep/epistemic-server", "@beep/occt"],
    packages: [
      "@beep/agents-tables",
      "@beep/ai-sync",
      "@beep/architecture-lab-config",
      "@beep/architecture-lab-domain",
      "@beep/commands",
      "@beep/effect-drizzle",
      "@beep/epistemic-server",
      "@beep/firecrawl",
      "@beep/freshbooks",
      "@beep/infra",
      "@beep/lexical-schema",
      "@beep/libpff",
      "@beep/mcp-kit",
      "@beep/occt",
      "@beep/oip-web",
      "@beep/onepassword-cli",
      "@beep/ontology-config",
      "@beep/openai-compat",
      "@beep/pandoc-ast",
      "@beep/party-domain",
      "@beep/party-server",
      "@beep/practice-review-hub",
      "@beep/practice-setup",
      "@beep/repo-ai-metrics",
      "@beep/sbom",
      "@beep/storybook",
      "@beep/toml",
      "@beep/workspace-server",
    ],
  }),
  CiLanePartition.make({
    id: "unit-c",
    lane: "test-unit",
    weightSeconds: 594,
    // markdown 279 s, box-provisioning 75 s, practice-kg-mcp 48 s
    startFirst: ["@beep/markdown", "@beep/box-provisioning", "@beep/practice-kg-mcp"],
    packages: [
      "@beep/architecture-lab-ui",
      "@beep/box-provisioning",
      "@beep/chalk",
      "@beep/config-file",
      "@beep/documents-tables",
      "@beep/execution-authority-use-cases",
      "@beep/exiftool",
      "@beep/jsonc",
      "@beep/law-practice-use-cases",
      "@beep/m365-mcp",
      "@beep/markdown",
      "@beep/mcpb-kit",
      "@beep/nlp-processing",
      "@beep/oxigraph",
      "@beep/package-json",
      "@beep/pdf-tools",
      "@beep/pglite",
      "@beep/practice-kg-mcp",
      "@beep/public-site",
      "@beep/qa-capture",
      "@beep/repo-docgen",
      "@beep/runpod",
      "@beep/semver",
      "@beep/tailscale",
      "@beep/tika",
      "@beep/types",
      "@beep/xdg",
    ],
  }),
  CiLanePartition.make({
    id: "unit-d",
    lane: "test-unit",
    weightSeconds: 594,
    // professional-desktop 231 s, repo-cli-kit 77 s, doc-text 62 s, technical-drawing 35 s
    startFirst: ["@beep/professional-desktop", "@beep/repo-cli-kit", "@beep/doc-text", "@beep/technical-drawing"],
    packages: [
      "@beep/box",
      "@beep/brand",
      "@beep/doc-text",
      "@beep/dock",
      "@beep/documents-domain",
      "@beep/documents-use-cases",
      "@beep/execution-authority-server",
      "@beep/ffmpeg",
      "@beep/git",
      "@beep/github-references",
      "@beep/graph-3d",
      "@beep/html",
      "@beep/identity",
      "@beep/nlp-mcp",
      "@beep/ontology-domain",
      "@beep/ontology-ui",
      "@beep/openclaw",
      "@beep/poppler",
      "@beep/pretext",
      "@beep/professional-desktop",
      "@beep/repo-cli-kit",
      "@beep/shacl",
      "@beep/technical-drawing",
      "@beep/todox",
      "@beep/walker",
      "@beep/workspace-tables",
      "@beep/xstate",
    ],
  }),
  CiLanePartition.make({
    id: "unit-e",
    lane: "test-unit",
    weightSeconds: 593,
    // repo-workspaces 203 s, md 87 s, db-admin 66 s, editor 48 s
    startFirst: ["@beep/repo-workspaces", "@beep/md", "@beep/db-admin", "@beep/editor"],
    packages: [
      "@beep/architecture-lab-server",
      "@beep/codegen-kit",
      "@beep/db-admin",
      "@beep/dock-react",
      "@beep/editor",
      "@beep/epistemic-tables",
      "@beep/epistemics",
      "@beep/execution-authority-domain",
      "@beep/fc-runs",
      "@beep/github-actions",
      "@beep/govinfo",
      "@beep/hubspot",
      "@beep/langextract",
      "@beep/md",
      "@beep/n3",
      "@beep/npm-spec",
      "@beep/openai",
      "@beep/practice-identify",
      "@beep/practice-m365-contacts",
      "@beep/practice-mail-tagging",
      "@beep/repo-configs",
      "@beep/repo-utils",
      "@beep/repo-workspaces",
      "@beep/sanity",
      "@beep/shared-tables",
      "@beep/tesseract",
      "@beep/windows-secrets",
    ],
  }),
  CiLanePartition.make({
    id: "unit-f",
    lane: "test-unit",
    weightSeconds: 593,
    // documents-server 154 s, duckdb 96 s, glob 76 s, cli-kit 49 s
    startFirst: ["@beep/documents-server", "@beep/duckdb", "@beep/glob", "@beep/cli-kit"],
    packages: [
      "@beep/agents-client",
      "@beep/agents-domain",
      "@beep/agents-server",
      "@beep/ai-provider-cli",
      "@beep/architecture-lab-client",
      "@beep/architecture-lab-proof",
      "@beep/architecture-lab-use-cases",
      "@beep/cli-kit",
      "@beep/colors",
      "@beep/cosmos",
      "@beep/documents-server",
      "@beep/duckdb",
      "@beep/epistemic-ui",
      "@beep/file-processing",
      "@beep/github-reporting",
      "@beep/glob",
      "@beep/gov-legal-mcp",
      "@beep/m365",
      "@beep/memfs",
      "@beep/obs",
      "@beep/observability",
      "@beep/ontology-use-cases",
      "@beep/party-use-cases",
      "@beep/rdf",
      "@beep/rdf-canonize",
      "@beep/shared-domain",
      "@beep/shared-use-cases",
      "@beep/test-runner",
    ],
  }),
  CiLanePartition.make({
    id: "unit-g",
    lane: "test-unit",
    weightSeconds: 594,
    // test-utils 128 s, lint-rules 115 s, yaml 76 s, ontology-server 55 s, wink 32 s
    startFirst: ["@beep/test-utils", "@beep/lint-rules", "@beep/yaml", "@beep/ontology-server", "@beep/wink"],
    packages: [
      "@beep/acp",
      "@beep/data",
      "@beep/docket-intake",
      "@beep/drizzle",
      "@beep/epistemic-client",
      "@beep/epistemic-domain",
      "@beep/epistemic-use-cases",
      "@beep/execution-authority-config",
      "@beep/eyecite",
      "@beep/github-commands",
      "@beep/lint-rules",
      "@beep/nlp",
      "@beep/ontology",
      "@beep/ontology-server",
      "@beep/phoenix",
      "@beep/postgres",
      "@beep/practice-gateway",
      "@beep/provenance",
      "@beep/runtime-env",
      "@beep/schema",
      "@beep/semantic-web",
      "@beep/test-utils",
      "@beep/tsconfig",
      "@beep/uspto-mcp",
      "@beep/utils",
      "@beep/wink",
      "@beep/workspace-use-cases",
      "@beep/yaml",
    ],
  }),
  // Hosted Test Integration partitions (goals/citation-extraction-engine, 2026-11-09). Nineteen
  // Vitest shards of @beep/law-practice-server's integration suite, placed by the LPT plan in
  // packages/law-practice/server/vitest.integration.shards.json. The weight is each bin's sum of
  // its files' worst passing hosted seconds over eight runs (PR #3005 run 42656046751, main runs
  // 42662847801, 42675828132 and 42677073526, pull-request runs 42679893579, 42680346897,
  // 42682725454 and 42690710476; ubuntu-24.04, one worker). The count is the smallest whose
  // largest bin equals the largest single file (422 s), and every bin stays within
  // CI_SHARDED_PARTITION_FILE_BUDGET_SECONDS, which test/ci-lane.test.ts enforces. The shard total
  // must equal that plan's length or Vitest falls back to its hash split. Every other package with
  // an integration task is default-placed into `int-rest`, which runs the root integration lane
  // with the sharded packages filtered out.
  CiLanePartition.make({
    id: "lps-int-1",
    lane: "test-integration",
    weightSeconds: 422,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 1, total: 19 }),
  }),
  CiLanePartition.make({
    id: "lps-int-2",
    lane: "test-integration",
    weightSeconds: 400,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 2, total: 19 }),
  }),
  CiLanePartition.make({
    id: "lps-int-3",
    lane: "test-integration",
    weightSeconds: 391,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 3, total: 19 }),
  }),
  CiLanePartition.make({
    id: "lps-int-4",
    lane: "test-integration",
    weightSeconds: 366,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 4, total: 19 }),
  }),
  CiLanePartition.make({
    id: "lps-int-5",
    lane: "test-integration",
    weightSeconds: 359,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 5, total: 19 }),
  }),
  CiLanePartition.make({
    id: "lps-int-6",
    lane: "test-integration",
    weightSeconds: 356,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 6, total: 19 }),
  }),
  CiLanePartition.make({
    id: "lps-int-7",
    lane: "test-integration",
    weightSeconds: 355,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 7, total: 19 }),
  }),
  CiLanePartition.make({
    id: "lps-int-8",
    lane: "test-integration",
    weightSeconds: 347,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 8, total: 19 }),
  }),
  CiLanePartition.make({
    id: "lps-int-9",
    lane: "test-integration",
    weightSeconds: 328,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 9, total: 19 }),
  }),
  CiLanePartition.make({
    id: "lps-int-10",
    lane: "test-integration",
    weightSeconds: 324,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 10, total: 19 }),
  }),
  CiLanePartition.make({
    id: "lps-int-11",
    lane: "test-integration",
    weightSeconds: 312,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 11, total: 19 }),
  }),
  CiLanePartition.make({
    id: "lps-int-12",
    lane: "test-integration",
    weightSeconds: 308,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 12, total: 19 }),
  }),
  CiLanePartition.make({
    id: "lps-int-13",
    lane: "test-integration",
    weightSeconds: 310,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 13, total: 19 }),
  }),
  CiLanePartition.make({
    id: "lps-int-14",
    lane: "test-integration",
    weightSeconds: 342,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 14, total: 19 }),
  }),
  CiLanePartition.make({
    id: "lps-int-15",
    lane: "test-integration",
    weightSeconds: 356,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 15, total: 19 }),
  }),
  CiLanePartition.make({
    id: "lps-int-16",
    lane: "test-integration",
    weightSeconds: 353,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 16, total: 19 }),
  }),
  CiLanePartition.make({
    id: "lps-int-17",
    lane: "test-integration",
    weightSeconds: 367,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 17, total: 19 }),
  }),
  CiLanePartition.make({
    id: "lps-int-18",
    lane: "test-integration",
    weightSeconds: 391,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 18, total: 19 }),
  }),
  CiLanePartition.make({
    id: "lps-int-19",
    lane: "test-integration",
    weightSeconds: 421,
    packages: ["@beep/law-practice-server"],
    shard: CiLanePartitionShard.make({ index: 19, total: 19 }),
  }),
  CiLanePartition.make({
    id: "int-rest",
    lane: "test-integration",
    weightSeconds: 60,
    packages: [],
  }),
];

/**
 * Order a partition's items so its `startFirst` packages lead, in their listed order.
 *
 * **Details**
 *
 * A Test Unit bin runs two package steps at a time in list order, so a long
 * package that starts late runs alone at the end. On main run 42677073526
 * unit-b's 309 s package started 162 s in and the bin body took 471 s, against
 * 265 to 448 s for siblings of the same serial sum. Starting the heaviest
 * packages first keeps a body near the larger of its heaviest package and half
 * its serial sum. Items the list does not name follow in their given order.
 *
 * **Example** (Lead with the heaviest package)
 *
 * ```ts
 * import { ciLaneStartOrder } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ciLaneStartOrder(["a", "b", "c"], ["c"], (name) => name)) // ["c", "a", "b"]
 * ```
 *
 * @param items - The partition's runnable items in their default order.
 * @param startFirst - Package names to start first, in start order.
 * @param nameOf - The package name of one item.
 * @returns The items with the named packages leading.
 * @category utilities
 * @since 0.0.0
 */
export const ciLaneStartOrder: {
  <Item>(
    items: ReadonlyArray<Item>,
    startFirst: ReadonlyArray<string>,
    nameOf: (item: Item) => string
  ): ReadonlyArray<Item>;
  <Item>(
    startFirst: ReadonlyArray<string>,
    nameOf: (item: Item) => string
  ): (items: ReadonlyArray<Item>) => ReadonlyArray<Item>;
} = dual(
  3,
  <Item>(
    items: ReadonlyArray<Item>,
    startFirst: ReadonlyArray<string>,
    nameOf: (item: Item) => string
  ): ReadonlyArray<Item> =>
    A.sort(
      items,
      Order.mapInput(Order.Number, (item: Item) =>
        O.getOrElse(
          A.findFirstIndex(startFirst, (name) => name === nameOf(item)),
          () => A.length(startFirst)
        )
      )
    )
);

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
