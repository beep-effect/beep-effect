/**
 * Architecture accepted-template retargeting helpers.
 *
 * @packageDocumentation
 * @category utilities
 * @since 0.0.0
 */

import { A, Str, thunkFalse } from "@beep/utils";
import { pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { isDefaultPlanTarget } from "./RoleTopology.js";
import type { ArchitectureDomainKind, ArchitecturePlanTarget } from "../Architecture.schemas.js";
import type { AcceptedProofFile } from "./AcceptedProofManifest.js";

const sourceConceptForPath = (sourcePath: string): string => {
  const lowerPath = Str.toLowerCase(sourcePath);
  if (Str.includes("WorkPriority")(sourcePath) || Str.includes("work_priority")(lowerPath)) return "WorkPriority";
  if (Str.includes("WorkItem")(sourcePath) || Str.includes("work_item")(lowerPath)) return "WorkItem";
  if (Str.includes("Worker")(sourcePath) || Str.includes("worker")(lowerPath)) return "Worker";
  return "WorkItem";
};

const sourceDomainKindForPath = (sourcePath: string): O.Option<ArchitectureDomainKind> => {
  const sourceConcept = sourceConceptForPath(sourcePath);
  if (Str.includes("/values/")(sourcePath) || Str.equivalence(sourceConcept, "WorkPriority")) return O.some("values");
  if (Str.includes("/entities/")(sourcePath) || Str.equivalence(sourceConcept, "Worker")) return O.some("entities");
  if (Str.includes("/aggregates/")(sourcePath) || Str.equivalence(sourceConcept, "WorkItem"))
    return O.some("aggregates");
  return O.none();
};

const isPackageScaffoldFile = (sourcePath: string): boolean =>
  pipe(
    [
      "AGENTS.md",
      "LICENSE",
      "README.md",
      "docgen.json",
      "package.json",
      "tsconfig.json",
      "vitest.config.ts",
      "dtslint/.gitkeep",
      "test/.gitkeep",
    ] as const,
    A.some((suffix) => Str.endsWith(suffix)(sourcePath))
  );

const isPackageIndexFile = (sourcePath: string): boolean =>
  pipe(
    [
      "/src/index.ts",
      "/src/public.ts",
      "/src/server.ts",
      "/src/Layer.ts",
      "/src/test.ts",
      "/src/tables.ts",
      "/src/schema.ts",
      "/src/targets.ts",
      "/src/migrations/ArchitectureLab.ts",
      "/drizzle.config.ts",
    ] as const,
    A.some((suffix) => Str.endsWith(suffix)(sourcePath))
  );

/**
 * Tests whether an accepted proof path is package-level scaffold.
 *
 * @example
 * ```ts
 * import { isPackageLevelFile } from "@beep/repo-cli/commands/Architecture/internal/TemplateRetarget"
 *
 * console.log(isPackageLevelFile("packages/architecture-lab/domain/package.json")) // true
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const isPackageLevelFile = (sourcePath: string): boolean =>
  isPackageScaffoldFile(sourcePath) || isPackageIndexFile(sourcePath);

/**
 * Tests whether an accepted proof file belongs to a target domain-kind.
 *
 * @example
 * ```ts
 * import { defaultArchitecturePlanTarget } from "@beep/repo-cli/commands/Architecture"
 * import { acceptedProofFiles } from "@beep/repo-cli/commands/Architecture/internal/AcceptedProofManifest"
 * import { proofFileMatchesDomainKind } from "@beep/repo-cli/commands/Architecture/internal/TemplateRetarget"
 *
 * console.log(proofFileMatchesDomainKind(defaultArchitecturePlanTarget, acceptedProofFiles[0]))
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const proofFileMatchesDomainKind: {
  (target: ArchitecturePlanTarget, file: AcceptedProofFile): boolean;
  (file: AcceptedProofFile): (target: ArchitecturePlanTarget) => boolean;
} = dual(2, (target: ArchitecturePlanTarget, file: AcceptedProofFile): boolean => {
  if (isDefaultPlanTarget(target)) return true;
  if (isPackageLevelFile(file.path)) return true;
  return pipe(sourceDomainKindForPath(file.path), O.map(Str.equivalence(target.domainKind)), O.getOrElse(thunkFalse));
});

const sourceConceptPathFor = (sourcePath: string): string =>
  pipe(
    sourceDomainKindForPath(sourcePath),
    O.map((domainKind) => `${domainKind}/${sourceConceptForPath(sourcePath)}`),
    O.getOrElse(() => "aggregates/WorkItem")
  );

/**
 * Retargets an accepted proof path to a requested bounded context and concept.
 *
 * @example
 * ```ts
 * import { ArchitecturePlanTarget } from "@beep/repo-cli/commands/Architecture"
 * import { targetPathFor } from "@beep/repo-cli/commands/Architecture/internal/TemplateRetarget"
 *
 * const target = ArchitecturePlanTarget.make({ boundedContext: "research-lab", concept: "Experiment", conceptPath: "aggregates/Experiment", domainKind: "aggregates", stage: "core" })
 * console.log(targetPathFor("packages/architecture-lab/domain/src/aggregates/WorkItem/index.ts", target))
 * ```
 * @category mapping
 * @since 0.0.0
 */
export const targetPathFor: {
  (sourcePath: string, target: ArchitecturePlanTarget): string;
  (target: ArchitecturePlanTarget): (sourcePath: string) => string;
} = dual(2, (sourcePath: string, target: ArchitecturePlanTarget): string => {
  if (isDefaultPlanTarget(target)) return sourcePath;
  const sourceConcept = sourceConceptForPath(sourcePath);
  const sourceConceptPath = sourceConceptPathFor(sourcePath);
  const conceptPascal = Str.pascalCase(target.concept);
  const conceptKebab = Str.kebabCase(target.concept);
  const conceptSnake = Str.snakeCase(target.concept);
  const sourceConceptKebab = Str.kebabCase(sourceConcept);
  const sourceConceptSnake = Str.snakeCase(sourceConcept);
  const contextKebab = Str.kebabCase(target.boundedContext);
  const contextSnake = Str.snakeCase(target.boundedContext);
  if (Str.startsWith("packages/architecture-lab/")(sourcePath)) {
    return pipe(
      sourcePath,
      Str.replace("packages/architecture-lab/", `packages/${target.boundedContext}/`),
      Str.replaceAll("ArchitectureLab", Str.pascalCase(target.boundedContext)),
      Str.replaceAll("architecture_lab", contextSnake),
      Str.replaceAll(sourceConceptPath, target.conceptPath),
      Str.replaceAll(sourceConcept, conceptPascal),
      Str.replaceAll(sourceConceptKebab, conceptKebab),
      Str.replaceAll(sourceConceptSnake, conceptSnake)
    );
  }
  if (Str.startsWith("apps/architecture-lab-proof/")(sourcePath)) {
    return pipe(
      sourcePath,
      Str.replace("apps/architecture-lab-proof/", `apps/${target.boundedContext}-proof/`),
      Str.replaceAll("ArchitectureLab", Str.pascalCase(target.boundedContext)),
      Str.replaceAll(sourceConcept, conceptPascal),
      Str.replaceAll(sourceConceptKebab, conceptKebab),
      Str.replaceAll(sourceConceptSnake, conceptSnake)
    );
  }
  return pipe(
    sourcePath,
    Str.replaceAll("ArchitectureLab", Str.pascalCase(target.boundedContext)),
    Str.replaceAll("architecture-lab", contextKebab),
    Str.replaceAll("architecture_lab", contextSnake),
    Str.replaceAll(sourceConcept, conceptPascal),
    Str.replaceAll(sourceConceptKebab, conceptKebab),
    Str.replaceAll(sourceConceptSnake, conceptSnake)
  );
});

const replacementPairs = (
  target: ArchitecturePlanTarget,
  sourcePath: string
): ReadonlyArray<readonly [string, string]> => {
  const sourceConcept = sourceConceptForPath(sourcePath);
  const sourceConceptPascal = Str.pascalCase(sourceConcept);
  const sourceConceptCamel = Str.camelCase(sourceConcept);
  const sourceConceptKebab = Str.kebabCase(sourceConcept);
  const sourceConceptSnake = Str.snakeCase(sourceConcept);
  const conceptPascal = Str.pascalCase(target.concept);
  const conceptCamel = Str.camelCase(target.concept);
  const conceptKebab = Str.kebabCase(target.concept);
  const conceptSnake = Str.snakeCase(target.concept);
  const contextPascal = Str.pascalCase(target.boundedContext);
  const contextKebab = Str.kebabCase(target.boundedContext);
  const contextSnake = Str.snakeCase(target.boundedContext);

  return [
    ["ARCHITECTURE_LAB", Str.toUpperCase(contextSnake)],
    [Str.toUpperCase(sourceConceptSnake), Str.toUpperCase(conceptSnake)],
    ["ArchitectureLab", contextPascal],
    ["architecture-lab", contextKebab],
    ["architecture_lab", contextSnake],
    ["architecture lab", Str.replaceAll("-", " ")(contextKebab)],
    [sourceConceptPascal, conceptPascal],
    [sourceConceptCamel, conceptCamel],
    [sourceConceptKebab, conceptKebab],
    [sourceConceptSnake, conceptSnake],
  ];
};

/**
 * Retargets accepted proof-file content for a requested bounded context and concept.
 *
 * @example
 * ```ts
 * import { ArchitecturePlanTarget } from "@beep/repo-cli/commands/Architecture"
 * import { renderAcceptedTemplate } from "@beep/repo-cli/commands/Architecture/internal/TemplateRetarget"
 *
 * const target = ArchitecturePlanTarget.make({ boundedContext: "research-lab", concept: "Experiment", conceptPath: "aggregates/Experiment", domainKind: "aggregates", stage: "core" })
 * console.log(renderAcceptedTemplate("ArchitectureLab WorkItem", target, "WorkItem.model.ts"))
 * ```
 * @category mapping
 * @since 0.0.0
 */
const renderAcceptedTemplate = (content: string, target: ArchitecturePlanTarget, sourcePath: string): string =>
  isDefaultPlanTarget(target)
    ? content
    : pipe(
        replacementPairs(target, sourcePath),
        A.reduce(content, (rendered, [from, to]) => Str.replaceAll(from, to)(rendered))
      );

/**
 * Retargets accepted proof-file content from an object input.
 *
 * @example
 * ```ts
 * import { ArchitecturePlanTarget } from "@beep/repo-cli/commands/Architecture"
 * import { renderAcceptedTemplateForPlan } from "@beep/repo-cli/commands/Architecture/internal/TemplateRetarget"
 *
 * const target = ArchitecturePlanTarget.make({ boundedContext: "research-lab", concept: "Experiment", conceptPath: "aggregates/Experiment", domainKind: "aggregates", stage: "core" })
 * console.log(renderAcceptedTemplateForPlan({ content: "ArchitectureLab WorkItem", sourcePath: "WorkItem.model.ts", target }))
 * ```
 * @category mapping
 * @since 0.0.0
 */
export const renderAcceptedTemplateForPlan = (input: {
  readonly content: string;
  readonly sourcePath: string;
  readonly target: ArchitecturePlanTarget;
}): string => renderAcceptedTemplate(input.content, input.target, input.sourcePath);
