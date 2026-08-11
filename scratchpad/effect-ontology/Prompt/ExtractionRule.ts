/**
 * Schema-backed extraction rules shared by prompt generation and validation
 * feedback.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { pipe } from "effect";
import * as Inspectable from "effect/Inspectable";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $ScratchpadId.create("effect-ontology/Prompt/ExtractionRule");

/**
 * Closed taxonomy used to group extraction constraints by the behavior they
 * govern.
 *
 * **Example** (Recognize an identifier rule)
 *
 * ```ts
 * import { RuleCategory } from "@effect-ontology/Prompt/ExtractionRule.ts"
 *
 * console.log(RuleCategory.is.id_format("id_format")) // true
 * console.log(RuleCategory.is.id_format("cardinality")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RuleCategory = LiteralKit([
  "id_format",
  "type_mapping",
  "property_usage",
  "iri_casing",
  "cardinality",
  "reference_integrity",
  "mention_format",
  "literal_format",
  "entity_exclusion",
  "context_validation",
]).pipe(
  $I.annoteSchema("RuleCategory", {
    description: "Closed taxonomy of behaviors governed by extraction rules.",
  })
);

/**
 * Runtime rule category accepted by {@link RuleCategory}.
 *
 * **Example** (Declare a rule category)
 *
 * ```ts
 * import type { RuleCategory } from "@effect-ontology/Prompt/ExtractionRule.ts"
 *
 * const category: RuleCategory = "id_format"
 * console.log(category) // "id_format"
 * ```
 *
 * @see {@link RuleCategory} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type RuleCategory = typeof RuleCategory.Type;

/**
 * Distinguishes schema-enforced extraction constraints from prompt-only
 * preferences.
 *
 * **Example** (Recognize a hard constraint)
 *
 * ```ts
 * import { RuleSeverity } from "@effect-ontology/Prompt/ExtractionRule.ts"
 *
 * console.log(RuleSeverity.is.error("error")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RuleSeverity = LiteralKit(["error", "warning"]).pipe(
  $I.annoteSchema("RuleSeverity", {
    description: "Enforcement level for an extraction rule.",
  })
);

/**
 * Runtime enforcement level accepted by {@link RuleSeverity}.
 *
 * **Example** (Declare an enforcement level)
 *
 * ```ts
 * import type { RuleSeverity } from "@effect-ontology/Prompt/ExtractionRule.ts"
 *
 * const severity: RuleSeverity = "error"
 * console.log(severity) // "error"
 * ```
 *
 * @see {@link RuleSeverity} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type RuleSeverity = typeof RuleSeverity.Type;

/**
 * Demonstrates one expected or discouraged extraction outcome in its source
 * context.
 *
 * **Example** (Describe an identifier example)
 *
 * ```ts
 * import { RuleExample } from "@effect-ontology/Prompt/ExtractionRule.ts"
 *
 * const example = RuleExample.make({
 *   input: "Cristiano Ronaldo",
 *   output: "cristiano_ronaldo",
 *   explanation: "Use lowercase snake case."
 * })
 * console.log(example.output) // "cristiano_ronaldo"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuleExample extends S.Class<RuleExample>($I`RuleExample`)(
  {
    /** Source context or scenario to which the example applies. */
    input: S.String.pipe(
      $I.annoteKey("RuleExample.input", {
        description: "Source context or scenario to which the example applies.",
      })
    ),
    /** Expected or discouraged extraction output. */
    output: S.String.pipe(
      $I.annoteKey("RuleExample.output", {
        description: "Expected or discouraged extraction output.",
      })
    ),
    /** Concise explanation connecting the input to the output. */
    explanation: S.String.pipe(
      $I.annoteKey("RuleExample.explanation", {
        description: "Concise explanation connecting the input to the output.",
      })
    ),
  },
  $I.annote("RuleExample", {
    description: "One input, output, and explanation used to teach an extraction rule.",
  })
) {}

/**
 * Atomic extraction constraint that drives prompt instructions, schema metadata,
 * and validation feedback from one source of truth.
 *
 * **Example** (Create an identifier rule)
 *
 * ```ts
 * import { ExtractionRule, RuleExample } from "@effect-ontology/Prompt/ExtractionRule.ts"
 *
 * const rule = ExtractionRule.make({
 *   id: "entity-id-format",
 *   category: "id_format",
 *   severity: "error",
 *   instruction: "Use lowercase snake_case identifiers.",
 *   example: RuleExample.make({
 *     input: "Cristiano Ronaldo",
 *     output: "cristiano_ronaldo",
 *     explanation: "Spaces become underscores."
 *   }),
 *   schemaDescription: "Lowercase snake_case entity identifier.",
 *   validationTemplate: "Entity ID '{value}' must be snake_case."
 * })
 * console.log(rule.isHardConstraint) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractionRule extends S.Class<ExtractionRule>($I`ExtractionRule`)(
  {
    /** Stable identifier used to correlate prompts and validation feedback. */
    id: S.NonEmptyString.pipe(
      $I.annoteKey("ExtractionRule.id", {
        description: "Stable identifier used to correlate prompts and validation feedback.",
      })
    ),
    /** Behavioral category governed by the rule. */
    category: RuleCategory.pipe(
      $I.annoteKey("ExtractionRule.category", {
        description: "Behavioral category governed by the rule.",
      })
    ),
    /** Whether the rule is schema-enforced or supplied as prompt guidance. */
    severity: RuleSeverity.pipe(
      $I.annoteKey("ExtractionRule.severity", {
        description: "Whether the rule is schema-enforced or supplied as prompt guidance.",
      })
    ),
    /** Imperative instruction rendered into an extraction prompt. */
    instruction: S.NonEmptyString.pipe(
      $I.annoteKey("ExtractionRule.instruction", {
        description: "Imperative instruction rendered into an extraction prompt.",
      })
    ),
    /** Positive example demonstrating compliant extraction behavior. */
    example: RuleExample.pipe(
      $I.annoteKey("ExtractionRule.example", {
        description: "Positive example demonstrating compliant extraction behavior.",
      })
    ),
    /** Optional counterexample demonstrating the mistake to avoid. */
    counterExample: RuleExample.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ExtractionRule.counterExample", {
        description: "Optional counterexample demonstrating the mistake to avoid.",
      })
    ),
    /** Field or schema description derived from the rule. */
    schemaDescription: S.NonEmptyString.pipe(
      $I.annoteKey("ExtractionRule.schemaDescription", {
        description: "Field or schema description derived from the rule.",
      })
    ),
    /** Feedback template whose value placeholder is filled after validation. */
    validationTemplate: S.NonEmptyString.pipe(
      $I.annoteKey("ExtractionRule.validationTemplate", {
        description: "Feedback template whose value placeholder is filled after validation.",
      })
    ),
  },
  $I.annote("ExtractionRule", {
    description: "Atomic extraction constraint shared by prompts, schemas, and feedback.",
  })
) {
  /**
   * Indicates whether schema validation must enforce this rule.
   *
   * **Example** (Inspect hard enforcement)
   *
   * ```ts
   * import { ExtractionRule, RuleExample } from "@effect-ontology/Prompt/ExtractionRule.ts"
   *
   * const rule = ExtractionRule.make({
   *   id: "id", category: "id_format", severity: "error", instruction: "Use an ID.",
   *   example: RuleExample.make({ input: "Ada", output: "ada", explanation: "Normalize it." }),
   *   schemaDescription: "Identifier.", validationTemplate: "Invalid {value}."
   * })
   * console.log(rule.isHardConstraint) // true
   * ```
   */
  get isHardConstraint(): boolean {
    return RuleSeverity.is.error(this.severity);
  }

  /**
   * Indicates whether this rule is prompt guidance rather than a hard failure.
   *
   * **Example** (Inspect soft guidance)
   *
   * ```ts
   * import { ExtractionRule, RuleExample } from "@effect-ontology/Prompt/ExtractionRule.ts"
   *
   * const rule = ExtractionRule.make({
   *   id: "mention", category: "mention_format", severity: "warning", instruction: "Use full names.",
   *   example: RuleExample.make({ input: "Ada", output: "Ada Lovelace", explanation: "Expand it." }),
   *   schemaDescription: "Full name.", validationTemplate: "Review {value}."
   * })
   * console.log(rule.isSoftPreference) // true
   * ```
   */
  get isSoftPreference(): boolean {
    return RuleSeverity.is.warning(this.severity);
  }

  /**
   * Renders a validation message with an inspectable representation of the
   * rejected value.
   *
   * **Example** (Format rejected input)
   *
   * ```ts
   * import { ExtractionRule, RuleExample } from "@effect-ontology/Prompt/ExtractionRule.ts"
   *
   * const rule = ExtractionRule.make({
   *   id: "id", category: "id_format", severity: "error", instruction: "Use an ID.",
   *   example: RuleExample.make({ input: "Ada", output: "ada", explanation: "Normalize it." }),
   *   schemaDescription: "Identifier.", validationTemplate: "Invalid {value}."
   * })
   * console.log(rule.formatValidationMessage("Ada")) // 'Invalid "Ada".'
   * ```
   *
   * @param value - Rejected boundary value to render without unsafe coercion.
   * @returns Validation feedback with the first value placeholder replaced.
   */
  formatValidationMessage(value: unknown): string {
    return pipe(this.validationTemplate, Str.replace("{value}", Inspectable.toStringUnknown(value, 0)));
  }
}

/**
 * Closed vocabulary of extraction pipeline stages that own distinct rule sets.
 *
 * **Example** (Recognize the relation stage)
 *
 * ```ts
 * import { ExtractionStage } from "@effect-ontology/Prompt/ExtractionRule.ts"
 *
 * console.log(ExtractionStage.is.relation("relation")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExtractionStage = LiteralKit(["mention", "entity", "relation"]).pipe(
  $I.annoteSchema("ExtractionStage", {
    description: "Closed vocabulary of prompt-generation extraction stages.",
  })
);

/**
 * Runtime extraction stage accepted by {@link ExtractionStage}.
 *
 * **Example** (Declare an extraction stage)
 *
 * ```ts
 * import type { ExtractionStage } from "@effect-ontology/Prompt/ExtractionRule.ts"
 *
 * const stage: ExtractionStage = "relation"
 * console.log(stage) // "relation"
 * ```
 *
 * @see {@link ExtractionStage} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionStage = typeof ExtractionStage.Type;
