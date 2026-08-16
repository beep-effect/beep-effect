/**
 * Schema-first delete-package policy and manifest contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Tuple } from "effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/DeletePackage/schemas");

/**
 * Decoded delete-package flags and preflight facts.
 *
 * **Example** (Assemble a preflight policy)
 *
 * ```ts
 * import { DeletePackagePolicy } from "@beep/repo-cli/commands/DeletePackage"
 *
 * const policy = DeletePackagePolicy.make({
 *   allowPublished: false,
 *   allowStalePackets: false,
 *   cascade: false,
 *   force: false,
 *   pruneCatalog: false,
 *   rewritePackets: false,
 *   skipBaselines: false,
 *   inCi: false,
 *   retiredNameCollision: false,
 *   livePromotionRecord: false,
 *   cascadeClosureAllowed: false,
 *   catalogUniquenessProven: false,
 * })
 * console.log(policy.force) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeletePackagePolicy extends S.Class<DeletePackagePolicy>($I`DeletePackagePolicy`)(
  {
    allowPublished: S.Boolean,
    allowStalePackets: S.Boolean,
    cascade: S.Boolean,
    force: S.Boolean,
    pruneCatalog: S.Boolean,
    rewritePackets: S.Boolean,
    skipBaselines: S.Boolean,
    inCi: S.Boolean,
    retiredNameCollision: S.Boolean,
    livePromotionRecord: S.Boolean,
    cascadeClosureAllowed: S.Boolean,
    catalogUniquenessProven: S.Boolean,
  },
  $I.annote("DeletePackagePolicy", {
    description: "Decoded delete-package flags and preflight facts consumed by refusal policy.",
  })
) {}

/**
 * Closed schema for delete-package refusal reasons.
 *
 * **Example** (Guard a refusal kind)
 *
 * ```ts
 * import { DeletePackageRefusalKind } from "@beep/repo-cli/commands/DeletePackage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(DeletePackageRefusalKind)("dependent")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DeletePackageRefusalKind = LiteralKit([
  "dependent",
  "published",
  "promotion-record",
  "protected-slug",
  "retired-name-collision",
  "cascade-boundary",
  "ci-skip-baselines",
  "catalog-uniqueness",
  "packet-claim",
]).pipe(
  $I.annoteSchema("DeletePackageRefusalKind", {
    description: "Closed hard and soft refusal reasons emitted before deletion.",
  })
);
/**
 * Type represented by {@link DeletePackageRefusalKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type DeletePackageRefusalKind = typeof DeletePackageRefusalKind.Type;

class HardDeletePackageRefusal extends S.Class<HardDeletePackageRefusal>($I`HardDeletePackageRefusal`)(
  {
    severity: S.tag("hard"),
    kind: DeletePackageRefusalKind,
    detail: S.NonEmptyString,
  },
  $I.annote("HardDeletePackageRefusal", {
    description: "A deletion refusal that no force flag can bypass.",
  })
) {}

class SoftDeletePackageRefusal extends S.Class<SoftDeletePackageRefusal>($I`SoftDeletePackageRefusal`)(
  {
    severity: S.tag("soft"),
    kind: DeletePackageRefusalKind,
    detail: S.NonEmptyString,
  },
  $I.annote("SoftDeletePackageRefusal", {
    description: "A deletion refusal cleared only by its dedicated explicit policy flag.",
  })
) {}

/**
 * Tagged union schema for hard and soft deletion refusals.
 *
 * **Example** (Construct a hard refusal)
 *
 * ```ts
 * import { DeletePackageRefusal } from "@beep/repo-cli/commands/DeletePackage"
 *
 * const refusal = DeletePackageRefusal.cases.hard.make({
 *   kind: "dependent",
 *   detail: "2 production dependents; --force never overrides dependents.",
 * })
 * console.log(refusal.severity) // "hard"
 * ```
 *
 * @returns Tagged union schema keyed by `severity`.
 * @category schemas
 * @since 0.0.0
 */
export const DeletePackageRefusal = LiteralKit(["hard", "soft"])
  .mapMembers(Tuple.evolve([() => HardDeletePackageRefusal, () => SoftDeletePackageRefusal]))
  .pipe(
    S.toTaggedUnion("severity"),
    $I.annoteSchema("DeletePackageRefusal", {
      description: "One classified delete-package preflight refusal.",
    })
  );
/**
 * Type represented by {@link DeletePackageRefusal}.
 *
 * @category models
 * @since 0.0.0
 */
export type DeletePackageRefusal = typeof DeletePackageRefusal.Type;

/**
 * Minimal package manifest decoded during deletion preflight.
 *
 * **Example** (Resolve a target manifest)
 *
 * ```ts
 * import { DeletePackageManifest } from "@beep/repo-cli/commands/DeletePackage"
 *
 * const manifest = DeletePackageManifest.make({ name: "@beep/example" })
 * console.log(manifest.name) // "@beep/example"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeletePackageManifest extends S.Class<DeletePackageManifest>($I`DeletePackageManifest`)(
  {
    name: S.NonEmptyString,
    private: S.Boolean.pipe(S.optionalKey),
    version: S.String.pipe(S.optionalKey),
  },
  $I.annote("DeletePackageManifest", {
    description: "Minimal package manifest fields required by deletion preflight.",
  })
) {}
