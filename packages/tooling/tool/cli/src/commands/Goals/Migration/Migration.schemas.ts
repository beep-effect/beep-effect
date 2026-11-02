/**
 * Typed fleet-lint findings for goal-packet manifests.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Goals/Migration/Migration.schemas");

/**
 * Finding severity used by fleet-lint reports.
 *
 * **Example** (Distinguish blocking findings)
 *
 * ```ts
 * import { MigrationSeverity } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas"
 *
 * console.log(MigrationSeverity.is.violation("violation")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MigrationSeverity = LiteralKit(["violation", "warning"]).pipe(
  $I.annoteSchema("MigrationSeverity", {
    description: "Fleet-lint finding severity: violations block; warnings do not.",
  })
);

/**
 * Migration finding severity.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MigrationSeverity = typeof MigrationSeverity.Type;

/**
 * Fleet graph finding kinds.
 *
 * **Example** (Recognize a dependency cycle)
 *
 * ```ts
 * import { FleetLintFindingKind } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas"
 *
 * console.log(FleetLintFindingKind.is["dependency-cycle"]("dependency-cycle")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetLintFindingKind = LiteralKit([
  "duplicate-slug",
  "dependency-cycle",
  "unreachable-packet",
  "unmigrated-reference",
]).pipe($I.annoteSchema("FleetLintFindingKind", { description: "Cross-packet graph integrity finding kinds." }));

/**
 * Cross-packet fleet-lint finding kind.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FleetLintFindingKind = typeof FleetLintFindingKind.Type;

/**
 * One cross-packet fleet-lint finding.
 *
 * **Example** (Record a dangling packet reference)
 *
 * ```ts
 * import { FleetLintFinding } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas"
 *
 * const item = FleetLintFinding.make({
 *   slug: "demo",
 *   kind: "unreachable-packet",
 *   severity: "violation",
 *   related: ["missing"],
 *   message: "blockedBy names a missing packet",
 * })
 * console.log(item.kind) // "unreachable-packet"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetLintFinding extends S.Opaque<FleetLintFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    slug: S.String,
    kind: FleetLintFindingKind,
    severity: MigrationSeverity,
    related: S.Array(S.String),
    message: S.String,
  }).pipe($I.annoteSchema("FleetLintFinding", { description: "One sorted cross-packet graph integrity finding." }))
) {}
