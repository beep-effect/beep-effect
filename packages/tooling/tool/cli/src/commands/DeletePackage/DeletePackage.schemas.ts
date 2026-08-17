/**
 * Schema-first delete-package policy and manifest contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
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
 *   dropData: false,
 *   allowNonLocalData: false,
 *   dataResourceDeclared: false,
 *   dataConnectionNonLocal: false,
 *   dataOwnershipProven: false,
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
    dropData: S.Boolean,
    allowNonLocalData: S.Boolean,
    dataResourceDeclared: S.Boolean,
    dataConnectionNonLocal: S.Boolean,
    dataOwnershipProven: S.Boolean,
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
  "data-non-local",
  "data-ownership",
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

/**
 * Closed exit policy for one delete-package baseline writer step.
 *
 * **Details**
 *
 * `zero-only` fails on any nonzero exit. `tolerate-finding-exit` additionally
 * tolerates exit code 1 when the step's verified output file was provably
 * (re)written — the fallow health baseline writer exits 1 on pre-existing
 * findings even though the baseline write succeeded.
 *
 * **Example** (Guard an exit policy)
 *
 * ```ts
 * import { BaselineWriterExitPolicy } from "@beep/repo-cli/commands/DeletePackage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BaselineWriterExitPolicy)("tolerate-finding-exit")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BaselineWriterExitPolicy = LiteralKit(["zero-only", "tolerate-finding-exit"]).pipe(
  $I.annoteSchema("BaselineWriterExitPolicy", {
    description: "Closed exit policy for one delete-package baseline writer step.",
  })
);
/**
 * Type represented by {@link BaselineWriterExitPolicy}.
 *
 * @category models
 * @since 0.0.0
 */
export type BaselineWriterExitPolicy = typeof BaselineWriterExitPolicy.Type;

/**
 * Closed outcome of one baseline writer invocation.
 *
 * **Example** (Guard an outcome)
 *
 * ```ts
 * import { BaselineStepOutcome } from "@beep/repo-cli/commands/DeletePackage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BaselineStepOutcome)("tolerated")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BaselineStepOutcome = LiteralKit(["ok", "tolerated", "failed"]).pipe(
  $I.annoteSchema("BaselineStepOutcome", {
    description: "Closed outcome of one baseline writer invocation: ok, tolerated, or failed.",
  })
);
/**
 * Type represented by {@link BaselineStepOutcome}.
 *
 * @category models
 * @since 0.0.0
 */
export type BaselineStepOutcome = typeof BaselineStepOutcome.Type;

/**
 * `(mtime, size)` stamp of a baseline output file proving a write happened.
 *
 * **Details**
 *
 * Comparing stamps instead of mtime alone keeps the write proof honest on
 * filesystems with coarse timestamps: an equal-mtime rewrite still counts as
 * written when the size changed.
 *
 * **Example** (Stamp a baseline output)
 *
 * ```ts
 * import { BaselineOutputStamp } from "@beep/repo-cli/commands/DeletePackage"
 *
 * const stamp = BaselineOutputStamp.make({ mtimeMillis: 1_723_000_000_000, size: 2048 })
 * console.log(stamp.size) // 2048
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BaselineOutputStamp extends S.Class<BaselineOutputStamp>($I`BaselineOutputStamp`)(
  {
    mtimeMillis: S.Finite,
    size: S.Finite,
  },
  $I.annote("BaselineOutputStamp", {
    description: "(mtime, size) stamp of a baseline output file proving a write happened.",
  })
) {}

/**
 * One delete-package baseline writer step with its exit policy and optional
 * verified output file.
 *
 * **Details**
 *
 * `exitPolicy` defaults to `zero-only` and `verifiedOutput` to `Option.none()`
 * at construction, so only the deliberately tolerant step declares them —
 * guarding against tolerance creep in the writer table.
 *
 * **Example** (Declare a zero-only writer step)
 *
 * ```ts
 * import { BaselineWriterStep } from "@beep/repo-cli/commands/DeletePackage"
 *
 * const step = BaselineWriterStep.make({ label: "Knip baseline", args: ["run", "beep", "quality", "knip"] })
 * console.log(step.exitPolicy) // "zero-only"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BaselineWriterStep extends S.Class<BaselineWriterStep>($I`BaselineWriterStep`)(
  {
    label: S.NonEmptyString,
    args: S.Array(S.NonEmptyString),
    exitPolicy: BaselineWriterExitPolicy.pipe(SchemaUtils.withConstantDefault<BaselineWriterExitPolicy>("zero-only")),
    verifiedOutput: S.OptionFromOptionalKey(PosixPath).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("BaselineWriterStep", {
    description: "One delete-package baseline writer step with exit policy and optional verified output file.",
  })
) {}
