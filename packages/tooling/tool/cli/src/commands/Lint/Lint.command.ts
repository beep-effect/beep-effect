/**
 * Lint policy command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { A } from "@beep/utils";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import { lintCoverageOwnersCommand } from "./CoverageOwners.ts";
import { lintEcosystemPolarityCommand } from "./EcosystemPolarity.ts";
import { lintEffectSchemaInventoryCommand } from "./EffectSchemaInventory.ts";
import { lintEffectVitestCommand } from "./EffectVitest.ts";
import { lintIdentityRegistryCommand } from "./IdentityRegistry.ts";
import { lintJudgeRubricCommand } from "./JudgeRubric.ts";
import { lintCircularCommand } from "./LintCircular.command.ts";
import { lintDeprecatedApisCommand } from "./LintDeprecatedApis.command.ts";
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
  lintCoverageOwnersCommand,
  lintDeprecatedApisCommand,
  lintJsdocCommand,
  lintLawsCommand,
  lintEcosystemPolarityCommand,
  lintEffectSchemaInventoryCommand,
  lintEffectVitestCommand,
  lintOpaqueRoundtripsCommand,
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

// `beep lint` alone is the root lint sweep, which bin-main sends to the quality
// task before this group loads. A root flag such as `--log-level` keeps argv off
// that route, so it lands here. Exiting 0 would report a sweep that never ran.
const BARE_LINT_SUMMARY = "beep lint: nothing ran; a root flag such as --log-level skips the lint sweep.";

const bareLintLines: ReadonlyArray<string> = [
  BARE_LINT_SUMMARY,
  "Run the sweep with `bun run lint`, or one policy check:",
  ...A.map(lintSubcommands, (command) => `- bun run beep lint ${command.name}`),
];

/**
 * Lint command group.
 *
 * **Details**
 *
 * `beep lint` with no subcommand runs the lint sweep through the root quality
 * task and never reaches this group. A root flag such as `--log-level` takes it
 * off that route, so the group's own handler runs: it writes a pointer to
 * `bun run lint` and the subcommand index to stderr, then exits 1, so an
 * accidental flag cannot pass for a green sweep.
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
export const lintCommand = Command.make(
  "lint",
  {},
  Effect.fn(function* () {
    yield* Effect.forEach(bareLintLines, (line) => Console.error(line), { discard: true });
    return yield* failWithReportedExit(BARE_LINT_SUMMARY, 1);
  })
).pipe(Command.withDescription("Repository lint policy checks"), Command.withSubcommands(lintSubcommands));
