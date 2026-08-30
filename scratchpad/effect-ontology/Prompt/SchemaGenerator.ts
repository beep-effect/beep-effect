/**
 * Derives Effect Schema metadata from the same extraction rules rendered into
 * prompts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Match, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as P from "effect/Predicate";
import * as Eq from "effect/Equal";
import { dual2 } from "../Utils/Dual.ts";
import type { ExtractionRule, RuleCategory } from "./ExtractionRule.ts";
import type { RuleSet } from "./RuleSet.ts";

const $I = $ScratchpadId.create("effect-ontology/Prompt/SchemaGenerator");

const renderRules = (heading: string, rules: ReadonlyArray<ExtractionRule>): O.Option<string> =>
  pipe(
    rules,
    A.match({
      onEmpty: O.none<string>,
      onNonEmpty: (items) =>
        O.some(
          `${heading}:\n${pipe(
            items,
            A.map((rule) => `- ${rule.instruction}`),
            A.join("\n")
          )}`
        ),
    })
  );

const schemaTitleForStage = Match.type<RuleSet["stage"]>().pipe(
  Match.when("mention", () => "Mention Extraction"),
  Match.when("entity", () => "Entity Extraction (Stage 1)"),
  Match.when("relation", () => "Relation Extraction (Stage 2)"),
  Match.exhaustive
);

const schemaIdentifierForStage = Match.type<RuleSet["stage"]>().pipe(
  Match.when("mention", () => "MentionGraph"),
  Match.when("entity", () => "EntityGraph"),
  Match.when("relation", () => "RelationGraph"),
  Match.exhaustive
);

/**
 * Produces the top-level schema description containing enforced rules followed
 * by prompt-only preferences.
 *
 * **Example** (Describe mention extraction)
 *
 * ```ts
 * import { generateSchemaDescription } from "@effect-ontology/Prompt/SchemaGenerator"
 * import { makeMentionRuleSet } from "@effect-ontology/Prompt/RuleSet"
 *
 * console.log(generateSchemaDescription(makeMentionRuleSet()).startsWith("CRITICAL RULES:")) // true
 * ```
 *
 * @param ruleSet - Rules governing the target extraction stage.
 * @returns Ordered schema description with empty sections omitted.
 * @category formatting
 * @since 0.0.0
 */
export const generateSchemaDescription = (ruleSet: RuleSet): string =>
  pipe(
    A.getSomes([renderRules("CRITICAL RULES", ruleSet.errorRules), renderRules("PREFERENCES", ruleSet.warningRules)]),
    A.join("\n\n")
  );

/**
 * Produces the human-facing schema title for an extraction stage.
 *
 * **Example** (Title mention extraction)
 *
 * ```ts
 * import { generateSchemaTitle } from "@effect-ontology/Prompt/SchemaGenerator"
 * import { makeMentionRuleSet } from "@effect-ontology/Prompt/RuleSet"
 *
 * console.log(generateSchemaTitle(makeMentionRuleSet())) // "Mention Extraction"
 * ```
 *
 * @param ruleSet - Rules whose stage selects the title.
 * @returns Stable display title for schema metadata.
 * @category formatting
 * @since 0.0.0
 */
export const generateSchemaTitle = (ruleSet: RuleSet): string => schemaTitleForStage(ruleSet.stage);

/**
 * Produces the stable schema identifier associated with an extraction stage.
 *
 * **Example** (Identify relation output)
 *
 * ```ts
 * import { generateSchemaIdentifier } from "@effect-ontology/Prompt/SchemaGenerator"
 * import { makeRelationRuleSet } from "@effect-ontology/Prompt/RuleSet"
 *
 * console.log(generateSchemaIdentifier(makeRelationRuleSet([], []))) // "RelationGraph"
 * ```
 *
 * @param ruleSet - Rules whose stage selects the identifier.
 * @returns Stable identifier suitable for Effect Schema annotations.
 * @category formatting
 * @since 0.0.0
 */
export const generateSchemaIdentifier = (ruleSet: RuleSet): string => schemaIdentifierForStage(ruleSet.stage);

const FIELD_TO_RULE_MAP: Readonly<Record<string, string>> = {
  "entities.id": "entity-id-format",
  "entities.mention": "entity-mention-complete",
  "entities.types": "entity-type-required",
  "entities.attributes": "entity-allowed-attributes",
  "relations.subjectId": "relation-subject-valid",
  "relations.predicate": "relation-predicate-valid",
  "relations.object": "relation-object-type",
  "mentions.id": "mention-id-format",
  "mentions.mention": "mention-complete",
  "mentions.context": "mention-context",
};

const ruleForField = (ruleSet: RuleSet, fieldPath: string): O.Option<ExtractionRule> =>
  pipe(
    R.get(FIELD_TO_RULE_MAP, fieldPath),
    O.flatMap((ruleId) => A.findFirst(ruleSet.allRules, (rule) => rule.id === ruleId))
  );

/**
 * Looks up rule-derived schema prose for a known extraction field path.
 *
 * **Example** (Look up mention ID guidance)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { getFieldDescription } from "@effect-ontology/Prompt/SchemaGenerator"
 * import { makeMentionRuleSet } from "@effect-ontology/Prompt/RuleSet"
 *
 * console.log(O.isSome(getFieldDescription(makeMentionRuleSet(), "mentions.id"))) // true
 * ```
 *
 * @param ruleSet - Rules containing field-specific descriptions.
 * @param fieldPath - Dot-delimited extraction field path.
 * @returns The matching description, or `O.none()` for an unmapped field.
 * @category getters
 * @since 0.0.0
 */
export const getFieldDescription = dual2(
  (ruleSet: RuleSet, fieldPath: string): O.Option<string> =>
    pipe(
      ruleForField(ruleSet, fieldPath),
      O.map((rule) => rule.schemaDescription)
    )
);

/**
 * Looks up the validation feedback template associated with an extraction field.
 *
 * **Example** (Look up a validation template)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { getFieldValidationTemplate } from "@effect-ontology/Prompt/SchemaGenerator"
 * import { makeMentionRuleSet } from "@effect-ontology/Prompt/RuleSet"
 *
 * console.log(O.isSome(getFieldValidationTemplate(makeMentionRuleSet(), "mentions.id"))) // true
 * ```
 *
 * @param ruleSet - Rules containing field-specific validation templates.
 * @param fieldPath - Dot-delimited extraction field path.
 * @returns The matching template, or `O.none()` for an unmapped field.
 * @category getters
 * @since 0.0.0
 */
export const getFieldValidationTemplate = dual2(
  (ruleSet: RuleSet, fieldPath: string): O.Option<string> =>
    pipe(
      ruleForField(ruleSet, fieldPath),
      O.map((rule) => rule.validationTemplate)
    )
);

/**
 * Complete identity, title, and description metadata generated for a schema.
 *
 * **Example** (Create generated annotations)
 *
 * ```ts
 * import { GeneratedSchemaAnnotations } from "@effect-ontology/Prompt/SchemaGenerator"
 *
 * const annotations = GeneratedSchemaAnnotations.make({
 *   identifier: "MentionGraph",
 *   title: "Mention Extraction",
 *   description: "Extract mentions."
 * })
 * console.log(annotations.identifier) // "MentionGraph"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GeneratedSchemaAnnotations extends S.Class<GeneratedSchemaAnnotations>($I`GeneratedSchemaAnnotations`)(
  {
    /** Stable identifier consumed by Effect Schema tooling. */
    identifier: S.NonEmptyString.pipe(
      $I.annoteKey("GeneratedSchemaAnnotations.identifier", {
        description: "Stable identifier consumed by Effect Schema tooling.",
      })
    ),
    /** Human-facing schema title. */
    title: S.NonEmptyString.pipe(
      $I.annoteKey("GeneratedSchemaAnnotations.title", {
        description: "Human-facing schema title.",
      })
    ),
    /** Rule-derived schema description. */
    description: S.String.pipe(
      $I.annoteKey("GeneratedSchemaAnnotations.description", {
        description: "Rule-derived schema description.",
      })
    ),
  },
  $I.annote("GeneratedSchemaAnnotations", {
    description: "Identity, title, and rule-derived description for an extraction schema.",
  })
) {}

/**
 * Generates a complete annotation object from an extraction rule set.
 *
 * **Example** (Generate mention annotations)
 *
 * ```ts
 * import { generateSchemaAnnotations } from "@effect-ontology/Prompt/SchemaGenerator"
 * import { makeMentionRuleSet } from "@effect-ontology/Prompt/RuleSet"
 *
 * console.log(generateSchemaAnnotations(makeMentionRuleSet()).identifier) // "MentionGraph"
 * ```
 *
 * @param ruleSet - Rules used to derive the annotation content.
 * @returns Schema-compatible identifier, title, and description.
 * @category constructors
 * @since 0.0.0
 */
export const generateSchemaAnnotations = (ruleSet: RuleSet): GeneratedSchemaAnnotations =>
  GeneratedSchemaAnnotations.make({
    identifier: generateSchemaIdentifier(ruleSet),
    title: generateSchemaTitle(ruleSet),
    description: generateSchemaDescription(ruleSet),
  });

/**
 * Selects all rules in one behavioral category.
 *
 * **Example** (Find identifier rules)
 *
 * ```ts
 * import { findRulesByCategory } from "@effect-ontology/Prompt/SchemaGenerator"
 * import { makeMentionRuleSet } from "@effect-ontology/Prompt/RuleSet"
 *
 * console.log(findRulesByCategory(makeMentionRuleSet(), "id_format").length) // 1
 * ```
 *
 * @param ruleSet - Rule collection to query.
 * @param category - Closed behavioral category to select.
 * @returns Rules in their original deterministic order.
 * @category filtering
 * @since 0.0.0
 */
export const findRulesByCategory = dual2(
  (ruleSet: RuleSet, category: RuleCategory): ReadonlyArray<ExtractionRule> => ruleSet.getRulesByCategory(category)
);

/**
 * Finds a rule by its stable identifier.
 *
 * **Example** (Find the mention ID rule)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { findRuleById } from "@effect-ontology/Prompt/SchemaGenerator"
 * import { makeMentionRuleSet } from "@effect-ontology/Prompt/RuleSet"
 *
 * console.log(O.isSome(findRuleById(makeMentionRuleSet(), "mention-id-format"))) // true
 * ```
 *
 * @param ruleSet - Rule collection to search.
 * @param ruleId - Stable rule identifier.
 * @returns The matching rule, or `O.none()` when absent.
 * @category getters
 * @since 0.0.0
 */
export const findRuleById = dual2(
  (ruleSet: RuleSet, ruleId: string): O.Option<ExtractionRule> =>
    A.findFirst(ruleSet.allRules, P.Struct({id: Eq.equals(ruleId)}))
);
