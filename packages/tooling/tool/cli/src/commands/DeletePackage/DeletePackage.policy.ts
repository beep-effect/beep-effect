/**
 * Pure refusal-policy evaluation for delete-package preflight.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { pipe } from "effect";
import * as O from "effect/Option";
import { DeletePackageRefusal } from "./DeletePackage.schemas.ts";
import type { DependentsReport, RegistrationTarget } from "../../internal/cli/RegistrationGeometry/index.ts";
import type { DeletePackagePolicy } from "./DeletePackage.schemas.ts";

const PROTECTED_SLUGS = ["identity", "schema", "utils", "types", "repo-cli", "repo-utils", "repo-configs"];
const HARD_DEPENDENT_KINDS = [
  "manifest-prod",
  "manifest-dev",
  "manifest-peer",
  "manifest-optional",
  "import-prod",
  "import-test",
  "script",
  "file-path",
];

const slugOf = (packageName: string): string => Str.replace("@beep/", Str.empty)(packageName);

const hardDependentHits = (report: DependentsReport) =>
  A.filter(report.hits, (hit) => A.some(HARD_DEPENDENT_KINDS, Str.equivalence(hit.kind)));

const refuseWhen = (condition: boolean, refusal: () => DeletePackageRefusal): O.Option<DeletePackageRefusal> =>
  condition ? O.some(refusal()) : O.none();

type RefusalRule = (
  target: RegistrationTarget,
  report: DependentsReport,
  policy: DeletePackagePolicy
) => O.Option<DeletePackageRefusal>;

const REFUSAL_RULES: ReadonlyArray<RefusalRule> = [
  (_target, report) => {
    const hardHits = hardDependentHits(report);
    return refuseWhen(A.isReadonlyArrayNonEmpty(hardHits), () =>
      DeletePackageRefusal.cases.hard.make({
        kind: "dependent",
        detail: `${A.length(hardHits)} production/test/script/path dependent hit(s); --force never overrides dependents.`,
      })
    );
  },
  (target, _report, policy) =>
    refuseWhen(!target.private && !policy.allowPublished, () =>
      DeletePackageRefusal.cases.hard.make({ kind: "published", detail: "private:false requires --allow-published." })
    ),
  (_target, _report, policy) =>
    refuseWhen(policy.livePromotionRecord, () =>
      DeletePackageRefusal.cases.hard.make({
        kind: "promotion-record",
        detail: "A live shared-kernel promotion record requires the human doctrine-11 retirement process.",
      })
    ),
  (target) =>
    refuseWhen(A.some(PROTECTED_SLUGS, Str.equivalence(slugOf(target.packageName))), () =>
      DeletePackageRefusal.cases.hard.make({
        kind: "protected-slug",
        detail: `${target.packageName} is protected infrastructure.`,
      })
    ),
  (target, _report, policy) =>
    refuseWhen(policy.retiredNameCollision, () =>
      DeletePackageRefusal.cases.hard.make({
        kind: "retired-name-collision",
        detail: `${target.packageName} is both live and retired; reconcile name provenance before deletion.`,
      })
    ),
  (_target, _report, policy) =>
    refuseWhen(policy.cascade && !policy.cascadeClosureAllowed, () =>
      DeletePackageRefusal.cases.hard.make({
        kind: "cascade-boundary",
        detail: "Cascade closure includes a target outside the allowed explicit set.",
      })
    ),
  (_target, _report, policy) =>
    refuseWhen(policy.skipBaselines && policy.inCi, () =>
      DeletePackageRefusal.cases.hard.make({
        kind: "ci-skip-baselines",
        detail: "--skip-baselines is forbidden in CI.",
      })
    ),
  (_target, _report, policy) =>
    refuseWhen(policy.pruneCatalog && !policy.catalogUniquenessProven, () =>
      DeletePackageRefusal.cases.hard.make({
        kind: "catalog-uniqueness",
        detail: "--prune-catalog requires proof that no survivor lists the dependency.",
      })
    ),
  (_target, report, policy) =>
    pipe(
      A.findFirst(report.hits, (hit) => Str.equivalence(hit.kind, "packet")),
      O.filter(() => !policy.rewritePackets && !policy.allowStalePackets),
      O.map((packetHit) =>
        DeletePackageRefusal.cases.soft.make({
          kind: "packet-claim",
          detail: `Packet reference remains at ${packetHit.file}; pass --rewrite-packets or --allow-stale-packets.`,
        })
      )
    ),
];

const refusalReasons = (
  target: RegistrationTarget,
  report: DependentsReport,
  policy: DeletePackagePolicy
): ReadonlyArray<DeletePackageRefusal> => A.flatMap(REFUSAL_RULES, (rule) => O.toArray(rule(target, report, policy)));

const dependentsCascadeLines = (report: DependentsReport): ReadonlyArray<string> => [
  `direct: ${A.isReadonlyArrayNonEmpty(report.directWorkspaceDependents) ? A.join(report.directWorkspaceDependents, ", ") : "(none)"}`,
  `transitive: ${A.isReadonlyArrayNonEmpty(report.transitiveWorkspaceDependents) ? A.join(report.transitiveWorkspaceDependents, ", ") : "(none)"}`,
  ...A.map(report.hits, (hit) => `${hit.kind}: ${hit.owner} ${hit.file}`),
];

/**
 * Evaluate deletion refusals and render the dependency cascade.
 *
 * **Example** (Inspect available policy operations)
 *
 * ```ts
 * import { DeletePackagePolicyEvaluation } from "@beep/repo-cli/commands/DeletePackage"
 *
 * console.log(Object.keys(DeletePackagePolicyEvaluation))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const DeletePackagePolicyEvaluation = { dependentsCascadeLines, refusalReasons };
