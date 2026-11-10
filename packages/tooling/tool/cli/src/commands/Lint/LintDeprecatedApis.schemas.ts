/**
 * Partition plan for the full `beep lint deprecated-apis` sweep.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, normalizePath } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Lint/LintDeprecatedApis.schemas");

/**
 * Repository roots the full deprecated-API sweep covers.
 *
 * **Example** (Read the full sweep roots)
 *
 * ```ts
 * import { deprecatedApiSweepRoots } from "@beep/repo-cli/commands/Lint/LintDeprecatedApis.schemas"
 *
 * console.log(deprecatedApiSweepRoots) // ["apps", "packages", "infra"]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const deprecatedApiSweepRoots: A.NonEmptyReadonlyArray<string> = ["apps", "packages", "infra"];

/**
 * Names of the sequential partitions of the full deprecated-API sweep.
 *
 * **Example** (Check a partition name)
 *
 * ```ts
 * import { DeprecatedApiPartitionName } from "@beep/repo-cli/commands/Lint/LintDeprecatedApis.schemas"
 *
 * console.log(DeprecatedApiPartitionName.is.remainder("remainder")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeprecatedApiPartitionName = LiteralKit(["foundation-tooling", "drivers-apps", "remainder"]).pipe(
  $I.annoteSchema("DeprecatedApiPartitionName", {
    description: "Name of one sequential partition of the full deprecated-API sweep.",
  })
);

/**
 * Name of one sequential partition of the full deprecated-API sweep.
 *
 * **Example** (Annotate a partition name)
 *
 * ```ts
 * import type { DeprecatedApiPartitionName } from "@beep/repo-cli/commands/Lint/LintDeprecatedApis.schemas"
 *
 * const name: DeprecatedApiPartitionName = "drivers-apps"
 * console.log(name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DeprecatedApiPartitionName = typeof DeprecatedApiPartitionName.Type;

/**
 * One oxlint process of the full deprecated-API sweep: the directories it lints and the
 * directories below them it leaves to other partitions.
 *
 * **Details**
 *
 * tsrs-lint keeps every TypeScript program it builds alive until the process exits, so one
 * process over all three roots peaks at the sum of every program (about 27 GiB at four threads).
 * Sequential partitions peak at the largest partition instead.
 *
 * **Example** (Build a partition)
 *
 * ```ts
 * import { DeprecatedApiPartition } from "@beep/repo-cli/commands/Lint/LintDeprecatedApis.schemas"
 *
 * const partition = DeprecatedApiPartition.make({ name: "remainder", targets: ["infra"], excludes: [] })
 * console.log(partition.targets) // ["infra"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeprecatedApiPartition extends S.Opaque<DeprecatedApiPartition, { readonly brand: unique symbol }>()(
  S.Struct({
    name: DeprecatedApiPartitionName,
    targets: S.NonEmptyArray(S.String).pipe(
      $I.annoteKey("DeprecatedApiPartition.targets", {
        description: "Repo-relative directories this partition passes to oxlint.",
      })
    ),
    excludes: S.Array(S.String).pipe(
      $I.annoteKey("DeprecatedApiPartition.excludes", {
        description: "Repo-relative directories below a target that another partition lints.",
      })
    ),
  }).pipe(
    $I.annoteSchema("DeprecatedApiPartition", {
      description: "One sequential oxlint process of the full deprecated-API sweep.",
    })
  )
) {}

// Sized from measured per-family peaks at four threads (2026-11-09): foundation 7.4 GiB,
// drivers 7.2, tooling 6.3, apps 5.4, every other family and infra 1.9-3.0 each. The three
// partitions peaked at 11.5, 10.9 and 8.5 GiB against 27.2 GiB for one process.
const claimedFamilies = {
  foundationTooling: ["packages/foundation", "packages/tooling"],
  driversApps: ["packages/drivers"],
} as const;

/**
 * The full sweep's partitions, run one after another.
 *
 * **Details**
 *
 * The remainder partition lints every root minus the directories the named partitions claim,
 * so a new package family lands in it without a plan change. The command proves at run time
 * that the partitions' oxlint inventories are disjoint and union to the single-run inventory.
 *
 * **Example** (List the partition names)
 *
 * ```ts
 * import { deprecatedApiSweepPartitions } from "@beep/repo-cli/commands/Lint/LintDeprecatedApis.schemas"
 *
 * console.log(deprecatedApiSweepPartitions.map((partition) => partition.name))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const deprecatedApiSweepPartitions: A.NonEmptyReadonlyArray<DeprecatedApiPartition> = [
  DeprecatedApiPartition.make({
    name: "foundation-tooling",
    targets: [...claimedFamilies.foundationTooling],
    excludes: [],
  }),
  DeprecatedApiPartition.make({
    name: "drivers-apps",
    targets: [...claimedFamilies.driversApps, "apps"],
    excludes: [],
  }),
  DeprecatedApiPartition.make({
    name: "remainder",
    targets: ["infra", "packages"],
    excludes: [...claimedFamilies.foundationTooling, ...claimedFamilies.driversApps],
  }),
];

const isWithin = (directory: string) => (file: string) => file === directory || Str.startsWith(`${directory}/`)(file);

/**
 * Whether a partition lints a repo-relative file path.
 *
 * **Example** (Test partition membership)
 *
 * ```ts
 * import {
 *   deprecatedApiPartitionCovers,
 *   deprecatedApiSweepPartitions
 * } from "@beep/repo-cli/commands/Lint/LintDeprecatedApis.schemas"
 *
 * const [foundationTooling] = deprecatedApiSweepPartitions
 * console.log(deprecatedApiPartitionCovers(foundationTooling)("packages/tooling/a.ts")) // true
 * ```
 *
 * @param partition - The partition whose targets and excludes decide membership.
 * @returns A predicate over repo-relative paths; separators are normalized before matching.
 * @category predicates
 * @since 0.0.0
 */
export const deprecatedApiPartitionCovers =
  (partition: DeprecatedApiPartition) =>
  (file: string): boolean => {
    const normalized = normalizePath(file);
    return (
      A.some(partition.targets, (target) => isWithin(target)(normalized)) &&
      !A.some(partition.excludes, (exclude) => isWithin(exclude)(normalized))
    );
  };

/**
 * The oxlint path arguments of one partition: its targets, then one `--ignore-pattern` per
 * excluded directory.
 *
 * **Example** (Render the remainder's arguments)
 *
 * ```ts
 * import {
 *   DeprecatedApiPartition,
 *   deprecatedApiPartitionArgs
 * } from "@beep/repo-cli/commands/Lint/LintDeprecatedApis.schemas"
 *
 * const partition = DeprecatedApiPartition.make({ name: "remainder", targets: ["packages"], excludes: ["packages/a"] })
 * console.log(deprecatedApiPartitionArgs(partition)) // ["packages", "--ignore-pattern", "packages/a/**"]
 * ```
 *
 * @param partition - The partition to render.
 * @returns Targets in declared order, then `--ignore-pattern <exclude>/**` for each exclude.
 * @category utilities
 * @since 0.0.0
 */
export const deprecatedApiPartitionArgs = (partition: DeprecatedApiPartition): ReadonlyArray<string> => [
  ...partition.targets,
  ...pipe(
    partition.excludes,
    A.flatMap((exclude) => ["--ignore-pattern", `${exclude}/**`])
  ),
];
