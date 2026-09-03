/**
 * Schema-first extraction rules and text, feedback, and multimodal prompt generators.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export type {
  ExtractionStage as ExtractionStageType,
  RuleCategory as RuleCategoryType,
  RuleSeverity as RuleSeverityType,
} from "./ExtractionRule.ts";
export { ExtractionRule, ExtractionStage, RuleCategory, RuleExample, RuleSeverity } from "./ExtractionRule.ts";
export {
  extractViolations,
  findMatchingRule,
  generateFeedback,
  generateImprovementPrompt,
  generateTreeFeedback,
  interpolate,
  isRetryable,
  Violation,
} from "./FeedbackGenerator.ts";
export {
  buildMultimodalPrompt,
  buildMultimodalUserContent,
  buildPromptFromStructured,
  ExampleMessage,
  generateStructuredEntityPrompt,
  generateStructuredMentionPrompt,
  generateStructuredPrompt,
  generateStructuredPromptWithExamples,
  generateStructuredRelationPrompt,
  imagesToPromptParts,
  OntologyPromptContext,
  ScoredExample,
  StructuredPrompt,
  StructuredPromptWithExamples,
} from "./PromptGenerator.ts";
export { AllowedIriSet, makeEntityRuleSet, makeMentionRuleSet, makeRelationRuleSet, RuleSet } from "./RuleSet.ts";
export {
  findRuleById,
  findRulesByCategory,
  GeneratedSchemaAnnotations,
  generateSchemaAnnotations,
  generateSchemaDescription,
  generateSchemaIdentifier,
  generateSchemaTitle,
  getFieldDescription,
  getFieldValidationTemplate,
} from "./SchemaGenerator.ts";
