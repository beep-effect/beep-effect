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
 * Effect Vitest canon detector utilities.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./EffectVitest.ts";
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
  SchemaFirstInventoryDocument,
  SchemaFirstInventoryPath,
  SchemaFirstLintOptions,
  SchemaFirstLintSummary,
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
  sourceTextHasSchemaArbitraryPropertyCoverage,
} from "./SchemaFirst.ts";
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
