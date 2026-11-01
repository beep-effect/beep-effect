/**
 * Lint command facade.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * Ecosystem dependency-polarity lint utilities.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./EcosystemPolarity.ts";
/**
 * Schema inventory fixture models and codecs.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./EffectSchemaInventory.schemas.ts";
/**
 * Pinned Effect schema inventory command and fixture utilities.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./EffectSchemaInventory.ts";
/**
 * Effect Vitest canon detector utilities.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./EffectVitest.ts";
/**
 * Schema-parity codemod data model and rule contract.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./internal/SchemaParityCodemod.schemas.ts";
/**
 * Schema-parity codemod text-edit rendering.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./internal/SchemaParityCodemodEdits.ts";
/**
 * Schema-parity codemod engine, rule registry, service and layer.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./internal/SchemaParityCodemodEngine.ts";
/**
 * The `exact-optional-keys` codemod rule.
 *
 * @category policies
 * @since 0.0.0
 */
export * from "./internal/SchemaParityCodemodExactOptionalKeysRule.ts";
/**
 * Schema-parity codemod import inspection.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./internal/SchemaParityCodemodImports.ts";
/**
 * The `literal-kit-match-rename` codemod rule.
 *
 * @category policies
 * @since 0.0.0
 */
export * from "./internal/SchemaParityCodemodLiteralKitMatchRule.ts";
/**
 * The `literal-kit-facets` codemod rule.
 *
 * @category policies
 * @since 0.0.0
 */
export * from "./internal/SchemaParityCodemodLiteralKitRule.ts";
/**
 * Judge-rubric lens drift lint utilities.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  diffJudgeRubricFamily,
  diffJudgeRubricLenses,
  JudgeRubricDrift,
  JudgeRubricFamilyInput,
  lintJudgeRubricCommand,
} from "./JudgeRubric.ts";
/**
 * Public lint command export.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./Lint.command.ts";
/**
 * Public command module export.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./Lint.errors.ts";
/**
 * Schema-first lint schema-role utilities.
 *
 * @category models
 * @since 0.0.0
 */
export {
  decodeEffectVitestFindingJson,
  decodeEffectVitestInventoryDocument,
  decodeEffectVitestPrimitiveGraphDocument,
  EffectVitestCensusPath,
  EffectVitestCensusRow,
  EffectVitestFinding,
  EffectVitestFindingRuleId,
  EffectVitestInventoryDocument,
  EffectVitestInventoryPath,
  EffectVitestLintOptions,
  EffectVitestPackageTiming,
  EffectVitestPrimitive,
  EffectVitestPrimitiveCoverage,
  EffectVitestPrimitiveGraphDocument,
  EffectVitestPrimitiveGraphPath,
  EffectVitestReplacement,
  EffectVitestRuleId,
  EffectVitestScanTiming,
  EffectVitestSourceFileGlobs,
  encodeEffectVitestFindingJson,
  encodeEffectVitestInventoryDocument,
  encodeEffectVitestPrimitiveGraphDocument,
  encodeSchemaFirstInventoryDocument,
  isActiveSchemaFirstRuleAdvisory,
  isEffectVitestTestFilePath,
  LiteralKitConstAssertionViolation,
  makeEffectVitestFindingKey,
  makeSchemaFirstEntryIdentity,
  makeSchemaFirstEntryKey,
  SchemaCrispeningPolicyPath,
  SchemaFirstBacklogRow,
  SchemaFirstEntryIdentity,
  SchemaFirstInventoryDocument,
  SchemaFirstInventoryPath,
  SchemaFirstLintOptions,
  SchemaFirstLintSummary,
  SchemaFirstOccurrenceAnchor,
  SchemaFirstParityFindings,
  SchemaFirstParityRuleId,
  SchemaFirstParityRuleSummary,
  schemaFirstBacklogRowKeys,
  schemaFirstEntryOrder,
  sortSchemaFirstEntries,
} from "./Lint.schemas.ts";
/**
 * Circular-import lint command export.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./LintCircular.command.ts";
/**
 * Deprecated vendor API lint command export.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./LintDeprecatedApis.command.ts";
/**
 * Documentation lint command export.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./LintJsdoc.command.ts";
/**
 * Package-scoped law lint command export.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./LintLaws.command.ts";
/**
 * Root policy sweep command export.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./LintPolicy.command.ts";
/**
 * Type-aware generated Opaque sample roundtrip lint.
 *
 * **Example** (Inspect the roundtrip command)
 * ```ts
 * import { lintOpaqueRoundtripsCommand } from "@beep/repo-cli/commands/Lint"
 * console.log(lintOpaqueRoundtripsCommand.name)
 * ```
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./OpaqueRoundtrips.ts";
/**
 * Workspace scripts policy command export.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./PackageScripts.command.ts";
/**
 * Package test-typecheck blind-spot lint utilities.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  collectTestTypecheckBlindSpots,
  defaultTestTypecheckBaselinePath,
  lintPackageTestTypecheckCommand,
  PackageTestTypecheckOptions,
  readTestTypecheckManifest,
  runPackageTestTypecheckLint,
  TestTypecheckBlindSpot,
  TestTypecheckBlindSpotBaseline,
  TestTypecheckBlindSpotKind,
  TestTypecheckBlindSpotSummary,
} from "./PackageTestTypecheck.ts";
/**
 * Per-task policy fingerprint schema export.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./PolicyFingerprint.schemas.ts";
/**
 * Per-task policy fingerprint command and service export.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./PolicyFingerprint.ts";
/**
 * Schema catalog generation utilities.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  generateSchemaCatalogDocument,
  generateSchemaCatalogShards,
  lintSchemaCatalogCommand,
  renderSchemaCatalogShard,
  runSchemaCatalog,
  SchemaCatalogDocument,
  SchemaCatalogEntry,
  SchemaCatalogEntryKind,
  SchemaCatalogOptions,
  SchemaCatalogOwner,
  SchemaCatalogShard,
  SchemaCatalogSummary,
  schemaCatalogShardPath,
  shardSchemaCatalogDocument,
} from "./SchemaCatalog.ts";
/**
 * Schema-first lint utilities.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  diffSchemaFirstParity,
  fnSchemaEntryFromFunctionLike,
  getsomesStructEntryFromCallExpression,
  isSchemaCrispeningPolicyExempt,
  lintSchemaFirstCommand,
  literalMemberEquals,
  makeSchemaFirstOwnerResolver,
  makeSchemaFirstProject,
  normalizationEntryFromCallExpression,
  nullReturnEntryFromFunctionLike,
  runSchemaFirstLint,
  SchemaCrispeningFamilyPolicy,
  SchemaCrispeningPolicyDocument,
  SchemaFirstIncludedGlobs,
  SchemaFirstInventoryEntry,
  SchemaFirstSourceFileGlobs,
  schemaCrispeningFamilyForFile,
  schemaFirstParityEntriesFromSourceFile,
  sourceTextHasSchemaArbitraryPropertyCoverage,
  toSchemaFirstBacklog,
} from "./SchemaFirst.ts";
/**
 * Schema-parity codemod command.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./SchemaParityCodemod.ts";
/**
 * Schema topology lint utilities.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./SchemaTopology.ts";
/**
 * Tooling schema-first lint command export.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./ToolingSchemaFirst.command.ts";
/**
 * Check-overlay allowlist lint utilities.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  collectTsconfigOverlayViolations,
  lintTsconfigOverlayCommand,
  runTsconfigOverlayLint,
  TsconfigOverlayCompilerOptionKey,
  TsconfigOverlayDocumentKey,
  TsconfigOverlayViolation,
  TsconfigOverlayViolationScope,
} from "./TsconfigOverlay.ts";
