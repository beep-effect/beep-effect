/**
 * Architecture role and stage topology helpers.
 *
 * @packageDocumentation
 * @category utilities
 * @since 0.0.0
 */

import { A, Str, thunk0 } from "@beep/utils";
import { pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { ArchitectureSliceRolePlan, defaultArchitecturePlanTarget } from "../Architecture.schemas.ts";
import type {
  ArchitectureDomainKind,
  ArchitecturePlanStage,
  ArchitecturePlanTarget,
  ArchitectureSliceRole,
} from "../Architecture.schemas.ts";

const defaultPlanTarget = defaultArchitecturePlanTarget;

const stageOrder: ReadonlyArray<ArchitecturePlanStage> = ["core", "persistence", "protocol", "client", "full"];
const stageRank = (stage: ArchitecturePlanStage): number =>
  pipe(stageOrder, A.findFirstIndex(Str.equivalence(stage)), O.getOrElse(thunk0));

/**
 * Tests whether a proof file stage is included by a requested plan stage.
 *
 * @param requested - Plan stage the caller asked to generate.
 * @param fileStage - Stage a candidate proof file is tagged with.
 * @returns `true` when the file stage is covered by the requested stage.
 * @example
 * ```ts
 * import { isStageIncluded } from "@beep/repo-cli/commands/Architecture/internal/RoleTopology"
 *
 * console.log(isStageIncluded("full", "client")) // true
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const isStageIncluded: {
  (requested: ArchitecturePlanStage, fileStage: ArchitecturePlanStage): boolean;
  (fileStage: ArchitecturePlanStage): (requested: ArchitecturePlanStage) => boolean;
} = dual(
  2,
  (requested: ArchitecturePlanStage, fileStage: ArchitecturePlanStage): boolean =>
    Str.equivalence(requested, "full") || stageRank(fileStage) <= stageRank(requested)
);

const aggregateRoles: ReadonlyArray<ArchitectureSliceRole> = [
  "domain",
  "use-cases",
  "config",
  "server",
  "tables",
  "client",
  "ui",
  "proof-app",
  "db-admin",
] as const;
const entityRoles: ReadonlyArray<ArchitectureSliceRole> = ["domain", "use-cases", "server", "tables", "db-admin"];
const valueRoles: ReadonlyArray<ArchitectureSliceRole> = ["domain"];

/**
 * Returns the architecture roles supported by a domain-kind archetype.
 *
 * @param domainKind - Archetype (`aggregates`, `entities`, or `values`) to resolve roles for.
 * @returns The slice roles that archetype scaffolds.
 * @example
 * ```ts
 * import { rolesForDomainKind } from "@beep/repo-cli/commands/Architecture/internal/RoleTopology"
 *
 * console.log(rolesForDomainKind("values")) // ["domain"]
 * ```
 * @category getters
 * @since 0.0.0
 */
export const rolesForDomainKind = (domainKind: ArchitectureDomainKind): ReadonlyArray<ArchitectureSliceRole> => {
  if (domainKind === "entities") return entityRoles;
  if (domainKind === "values") return valueRoles;
  return aggregateRoles;
};

/**
 * Tests whether a role belongs to a domain-kind archetype.
 *
 * @param domainKind - Archetype whose allowed roles are checked.
 * @param role - Slice role tested for membership in that archetype.
 * @returns `true` when the role is scaffolded by the domain-kind archetype.
 * @example
 * ```ts
 * import { roleAllowedForDomainKind } from "@beep/repo-cli/commands/Architecture/internal/RoleTopology"
 *
 * console.log(roleAllowedForDomainKind("entities", "ui")) // false
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const roleAllowedForDomainKind: {
  (domainKind: ArchitectureDomainKind, role: ArchitectureSliceRole): boolean;
  (role: ArchitectureSliceRole): (domainKind: ArchitectureDomainKind) => boolean;
} = dual(2, (domainKind: ArchitectureDomainKind, role: ArchitectureSliceRole): boolean =>
  pipe(rolesForDomainKind(domainKind), A.contains(role))
);

/**
 * Tests whether db-admin proof files apply to a target.
 *
 * @param target - Plan target whose context, domain kind, and concept are inspected.
 * @returns `true` only for the canonical WorkItem/Worker db-admin proof targets.
 * @example
 * ```ts
 * import { defaultArchitecturePlanTarget } from "@beep/repo-cli/commands/Architecture"
 * import { dbAdminProofTargetAllowed } from "@beep/repo-cli/commands/Architecture/internal/RoleTopology"
 *
 * console.log(dbAdminProofTargetAllowed(defaultArchitecturePlanTarget)) // true
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const dbAdminProofTargetAllowed = (target: ArchitecturePlanTarget): boolean =>
  Str.equivalence(target.boundedContext, defaultPlanTarget.boundedContext) &&
  ((Str.equivalence(target.domainKind, "aggregates") && Str.equivalence(target.concept, "WorkItem")) ||
    (Str.equivalence(target.domainKind, "entities") && Str.equivalence(target.concept, "Worker")));

/**
 * Tests whether a role is valid for a concrete architecture plan target.
 *
 * @param target - Concrete plan target being scaffolded.
 * @param role - Slice role tested against that target.
 * @returns `true` when the role is allowed for the target's domain kind (and, for `db-admin`, its proof target).
 * @example
 * ```ts
 * import { defaultArchitecturePlanTarget } from "@beep/repo-cli/commands/Architecture"
 * import { roleAllowedForTarget } from "@beep/repo-cli/commands/Architecture/internal/RoleTopology"
 *
 * console.log(roleAllowedForTarget(defaultArchitecturePlanTarget, "domain")) // true
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const roleAllowedForTarget: {
  (target: ArchitecturePlanTarget, role: ArchitectureSliceRole): boolean;
  (role: ArchitectureSliceRole): (target: ArchitecturePlanTarget) => boolean;
} = dual(
  2,
  (target: ArchitecturePlanTarget, role: ArchitectureSliceRole): boolean =>
    roleAllowedForDomainKind(target.domainKind, role) && (role !== "db-admin" || dbAdminProofTargetAllowed(target))
);

/**
 * Derives the package name for an architecture role.
 *
 * @param target - Plan target whose bounded context seeds the package name.
 * @param role - Slice role that suffixes (or overrides) the package name.
 * @returns The `@beep/*` workspace package name for the role.
 * @example
 * ```ts
 * import { defaultArchitecturePlanTarget } from "@beep/repo-cli/commands/Architecture"
 * import { packageNameForRole } from "@beep/repo-cli/commands/Architecture/internal/RoleTopology"
 *
 * console.log(packageNameForRole(defaultArchitecturePlanTarget, "domain"))
 * ```
 * @category getters
 * @since 0.0.0
 */
export const packageNameForRole: {
  (target: ArchitecturePlanTarget, role: ArchitectureSliceRole): string;
  (role: ArchitectureSliceRole): (target: ArchitecturePlanTarget) => string;
} = dual(2, (target: ArchitecturePlanTarget, role: ArchitectureSliceRole): string => {
  if (role === "proof-app") return `@beep/${target.boundedContext}-proof`;
  if (role === "db-admin") return "@beep/db-admin";
  return `@beep/${target.boundedContext}-${role}`;
});

/**
 * Derives the repository path for an architecture role.
 *
 * @param target - Plan target whose bounded context seeds the repository path.
 * @param role - Slice role that determines the path segment (or override) used.
 * @returns The repository-relative directory for the role package.
 * @example
 * ```ts
 * import { defaultArchitecturePlanTarget } from "@beep/repo-cli/commands/Architecture"
 * import { pathForRole } from "@beep/repo-cli/commands/Architecture/internal/RoleTopology"
 *
 * console.log(pathForRole(defaultArchitecturePlanTarget, "server"))
 * ```
 * @category getters
 * @since 0.0.0
 */
export const pathForRole: {
  (target: ArchitecturePlanTarget, role: ArchitectureSliceRole): string;
  (role: ArchitectureSliceRole): (target: ArchitecturePlanTarget) => string;
} = dual(2, (target: ArchitecturePlanTarget, role: ArchitectureSliceRole): string => {
  if (role === "proof-app") return `apps/${target.boundedContext}-proof`;
  if (role === "db-admin") return "packages/_internal/db-admin";
  return `packages/${target.boundedContext}/${role}`;
});

/**
 * Derives public export subpaths for an architecture role.
 *
 * @param target - Plan target whose concept path is woven into the export list.
 * @param role - Slice role whose public subpath set is resolved.
 * @returns The public export subpaths the role package exposes.
 * @example
 * ```ts
 * import { defaultArchitecturePlanTarget } from "@beep/repo-cli/commands/Architecture"
 * import { exportsForRole } from "@beep/repo-cli/commands/Architecture/internal/RoleTopology"
 *
 * console.log(exportsForRole(defaultArchitecturePlanTarget, "tables"))
 * ```
 * @category getters
 * @since 0.0.0
 */
export const exportsForRole: {
  (target: ArchitecturePlanTarget, role: ArchitectureSliceRole): ReadonlyArray<string>;
  (role: ArchitectureSliceRole): (target: ArchitecturePlanTarget) => ReadonlyArray<string>;
} = dual(2, (target: ArchitecturePlanTarget, role: ArchitectureSliceRole): ReadonlyArray<string> => {
  const conceptExport = `./${target.conceptPath}`;
  if (role === "domain") return [".", `./${target.domainKind}`, conceptExport];
  if (role === "use-cases") return [".", "./public", "./server", conceptExport, `${conceptExport}/server`];
  if (role === "config") return [".", "./public", "./server", "./secrets", "./layer", "./test", conceptExport];
  if (role === "server") return [".", "./layer", "./test", conceptExport];
  if (role === "tables") return [".", "./tables", conceptExport];
  if (role === "client" || role === "ui") return [".", conceptExport];
  return ["."];
});

/**
 * Builds package metadata for one role in an operation plan.
 *
 * @param target - Plan target describing the slice being scaffolded.
 * @param role - Slice role whose package name, path, and exports are assembled.
 * @returns Role plan metadata for one role in the operation plan.
 * @example
 * ```ts
 * import { defaultArchitecturePlanTarget } from "@beep/repo-cli/commands/Architecture"
 * import { rolePlanFor } from "@beep/repo-cli/commands/Architecture/internal/RoleTopology"
 *
 * console.log(rolePlanFor(defaultArchitecturePlanTarget, "domain").packageName)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const rolePlanFor = (target: ArchitecturePlanTarget, role: ArchitectureSliceRole): ArchitectureSliceRolePlan =>
  ArchitectureSliceRolePlan.make({
    role,
    packageName: packageNameForRole(target, role),
    path: pathForRole(target, role),
    exports: exportsForRole(target, role),
  });

/**
 * Tests whether a target is the canonical architecture-lab WorkItem target.
 *
 * @param target - Plan target compared against the canonical WorkItem target.
 * @returns `true` when the target matches the default architecture-lab WorkItem target.
 * @example
 * ```ts
 * import { defaultArchitecturePlanTarget } from "@beep/repo-cli/commands/Architecture"
 * import { isDefaultPlanTarget } from "@beep/repo-cli/commands/Architecture/internal/RoleTopology"
 *
 * console.log(isDefaultPlanTarget(defaultArchitecturePlanTarget)) // true
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const isDefaultPlanTarget = (target: ArchitecturePlanTarget): boolean =>
  Str.equivalence(target.boundedContext, defaultPlanTarget.boundedContext) &&
  Str.equivalence(target.concept, defaultPlanTarget.concept) &&
  Str.equivalence(target.domainKind, defaultPlanTarget.domainKind);
