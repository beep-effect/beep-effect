/**
 * Lint policy command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import * as Command from "effect/cli/Command";
import { printLines } from "../../internal/cli/Printer.ts";
import { lintEcosystemPolarityCommand } from "./EcosystemPolarity.ts";
import { lintEffectSchemaInventoryCommand } from "./EffectSchemaInventory.ts";
import { lintEffectVitestCommand } from "./EffectVitest.ts";
import { lintIdentityRegistryCommand } from "./IdentityRegistry.ts";
import { lintJudgeRubricCommand } from "./JudgeRubric.ts";
import { lintCircularCommand } from "./LintCircular.command.ts";
import { lintDeprecatedApisCommand } from "./LintDeprecatedApis.command.ts";
import { lintGoalPacketsCommand } from "./LintGoalPackets.command.ts";
import { lintJsdocCommand } from "./LintJsdoc.command.ts";
import { lintLawsCommand } from "./LintLaws.command.ts";
import { lintPolicyCommand } from "./LintPolicy.command.ts";
import { lintOpaqueRoundtripsCommand } from "./OpaqueRoundtrips.ts";
import { lintPackageScriptsCommand } from "./PackageScripts.command.ts";
import { lintPackageTestImportsCommand } from "./PackageTestImports.ts";
import { lintPackageTestTypecheckCommand } from "./PackageTestTypecheck.ts";
import { lintPolicyFingerprintCommand } from "./PolicyFingerprint.ts";
import { lintReflectionArtifactsCommand } from "./ReflectionArtifact.ts";
import { lintRoadmapRefsCommand } from "./RoadmapRefs.ts";
import { lintSchemaCatalogCommand } from "./SchemaCatalog.ts";
import { lintSchemaFirstCommand } from "./SchemaFirst.ts";
import { lintSchemaParityCodemodCommand } from "./SchemaParityCodemod.ts";
import { lintSchemaTopologyCommand } from "./SchemaTopology.ts";
import { lintToolingSchemaFirstCommand } from "./ToolingSchemaFirst.command.ts";
import { lintTsconfigOverlayCommand } from "./TsconfigOverlay.ts";

const lintSubcommands = [
  lintPackageScriptsCommand,
  lintPolicyFingerprintCommand,
  lintCircularCommand,
  lintDeprecatedApisCommand,
  lintJsdocCommand,
  lintLawsCommand,
  lintEcosystemPolarityCommand,
  lintEffectSchemaInventoryCommand,
  lintEffectVitestCommand,
  lintOpaqueRoundtripsCommand,
  lintGoalPacketsCommand,
  lintIdentityRegistryCommand,
  lintJudgeRubricCommand,
  lintPackageTestImportsCommand,
  lintPackageTestTypecheckCommand,
  lintPolicyCommand,
  lintReflectionArtifactsCommand,
  lintRoadmapRefsCommand,
  lintSchemaCatalogCommand,
  lintSchemaFirstCommand,
  lintSchemaParityCodemodCommand,
  lintSchemaTopologyCommand,
  lintToolingSchemaFirstCommand,
  lintTsconfigOverlayCommand,
];

/**
 * Lint command group.
 *
 * **Example** (Reference the lint command group)
 *
 * ```ts
 * console.log("lintCommand")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const lintCommand = Command.make("lint", {}, () =>
  printLines(["Lint commands:", ...A.map(lintSubcommands, (command) => `- bun run beep lint ${command.name}`)])
).pipe(Command.withDescription("Repository lint policy checks"), Command.withSubcommands(lintSubcommands));
