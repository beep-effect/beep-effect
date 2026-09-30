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
 * Schema-parity codemod import inspection.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./internal/SchemaParityCodemodImports.ts";
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
export { diffJudgeRubricLenses, JudgeRubricDrift, lintJudgeRubricCommand } from "./JudgeRubric.ts";
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
  makeSchemaFirstEntryKey,
  SchemaCrispeningPolicyPath,
  SchemaFirstBacklogRow,
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
  runPackageTestTypecheckLint,
  TestTypecheckBlindSpot,
  TestTypecheckBlindSpotBaseline,
  TestTypecheckBlindSpotKind,
  TestTypecheckBlindSpotSummary,
} from "./PackageTestTypecheck.ts";
/**
 * Schema catalog generation utilities.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  generateSchemaCatalogDocument,
  generateSchemaCatalogText,
  lintSchemaCatalogCommand,
  renderSchemaCatalogDocument,
  runSchemaCatalog,
  SchemaCatalogDocument,
  SchemaCatalogEntry,
  SchemaCatalogEntryKind,
  SchemaCatalogOptions,
  SchemaCatalogSummary,
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
