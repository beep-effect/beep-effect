/**
 * Schema-backed extraction rule collections and ontology-derived factories.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { IRI } from "@beep/rdf";
import { SchemaUtils } from "@beep/schema";
import { HashMap, Match, pipe, Result, Tuple } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { ClassDefinition, PropertyDefinition } from "../Domain/Model/Ontology.ts";
import { dual2 } from "../Utils/Dual.ts";
import type { RuleCategory } from "./ExtractionRule.ts";
import { ExtractionRule, ExtractionStage, RuleExample, RuleSeverity } from "./ExtractionRule.ts";

const $I = $ScratchpadId.create("effect-ontology/Prompt/RuleSet");

const buildCaseInsensitiveIriMap = (iris: ReadonlyArray<IRI>): HashMap.HashMap<string, IRI> =>
  pipe(
    iris,
    A.map((iri) => Tuple.make(Str.toLowerCase(iri), iri)),
    HashMap.fromIterable
  );

const AllowedIriKind = S.Literals(["classes", "objectProperties", "datatypeProperties", "entityIds"]).pipe(
  $I.annoteSchema("AllowedIriKind", {
    description: "Closed selector for the IRI collection rendered by AllowedIriSet.previewIris.",
  })
);

/** Selector accepted by the internal allowed-IRI preview renderer. */
type AllowedIriKind = typeof AllowedIriKind.Type;

/**
 * Canonical ontology IRIs and entity identifiers with precomputed
 * case-insensitive lookup indexes.
 *
 * **Example** (Build allowed identifiers)
 *
 * ```ts
 * import { AllowedIriSet } from "@effect-ontology/Prompt/RuleSet"
 *
 * const allowed = AllowedIriSet.fromOntology([], [], [])
 * console.log(allowed.previewIris("classes")) // ""
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AllowedIriSet extends S.Class<AllowedIriSet>($I`AllowedIriSet`)(
  {
    /** Canonical class IRIs accepted during entity extraction. */
    classIris: S.Array(IRI).pipe(
      SchemaUtils.withEmptyArrayDefaults<IRI>(),
      $I.annoteKey("AllowedIriSet.classIris", {
        description: "Canonical class IRIs accepted during entity extraction.",
      })
    ),
    /** Canonical object-property IRIs accepted during relation extraction. */
    objectPropertyIris: S.Array(IRI).pipe(
      SchemaUtils.withEmptyArrayDefaults<IRI>(),
      $I.annoteKey("AllowedIriSet.objectPropertyIris", {
        description: "Canonical object-property IRIs accepted during relation extraction.",
      })
    ),
    /** Canonical datatype-property IRIs accepted during extraction. */
    datatypePropertyIris: S.Array(IRI).pipe(
      SchemaUtils.withEmptyArrayDefaults<IRI>(),
      $I.annoteKey("AllowedIriSet.datatypePropertyIris", {
        description: "Canonical datatype-property IRIs accepted during extraction.",
      })
    ),
    /** Entity identifiers produced by the preceding extraction stage. */
    entityIds: S.Array(S.String).pipe(
      SchemaUtils.withEmptyArrayDefaults<string>(),
      $I.annoteKey("AllowedIriSet.entityIds", {
        description: "Entity identifiers produced by the preceding extraction stage.",
      })
    ),
    /** Case-folded index of canonical class IRIs. */
    classIriMap: S.HashMap(S.String, IRI).pipe(
      $I.annoteKey("AllowedIriSet.classIriMap", {
        description: "Case-folded index of canonical class IRIs.",
      })
    ),
    /** Case-folded index of canonical object and datatype property IRIs. */
    propertyIriMap: S.HashMap(S.String, IRI).pipe(
      $I.annoteKey("AllowedIriSet.propertyIriMap", {
        description: "Case-folded index of canonical object and datatype property IRIs.",
      })
    ),
  },
  $I.annote("AllowedIriSet", {
    description: "Canonical allowed IRIs with case-insensitive lookup indexes for prompt validation.",
  })
) {
  /**
   * Derives canonical IRI collections and lookup indexes from ontology models.
   *
   * **Example** (Build an empty allowed set)
   *
   * ```ts
   * import { AllowedIriSet } from "@effect-ontology/Prompt/RuleSet"
   *
   * console.log(AllowedIriSet.fromOntology([], [], []).classIris) // []
   * ```
   *
   * @param classes - Ontology classes available to entity extraction.
   * @param objectProperties - Entity-linking ontology properties.
   * @param datatypeProperties - Literal-valued ontology properties.
   * @param entityIds - Entity identifiers produced by an earlier stage.
   * @returns Canonical collections and case-folded lookup indexes.
   */
  static fromOntology(
    classes: ReadonlyArray<ClassDefinition>,
    objectProperties: ReadonlyArray<PropertyDefinition>,
    datatypeProperties: ReadonlyArray<PropertyDefinition>,
    entityIds: ReadonlyArray<string> = []
  ): AllowedIriSet {
    const classIris = A.map(classes, (definition) => definition.id);
    const objectPropertyIris = A.map(objectProperties, (definition) => definition.id);
    const datatypePropertyIris = A.map(datatypeProperties, (definition) => definition.id);
    const allPropertyIris = A.appendAll(objectPropertyIris, datatypePropertyIris);

    return AllowedIriSet.make({
      classIris,
      objectPropertyIris,
      datatypePropertyIris,
      entityIds,
      classIriMap: buildCaseInsensitiveIriMap(classIris),
      propertyIriMap: buildCaseInsensitiveIriMap(allPropertyIris),
    });
  }

  /**
   * Renders the first requested identifiers as a compact comma-delimited preview.
   *
   * **Example** (Render an empty preview)
   *
   * ```ts
   * import { AllowedIriSet } from "@effect-ontology/Prompt/RuleSet"
   *
   * console.log(AllowedIriSet.fromOntology([], [], []).previewIris("entityIds")) // ""
   * ```
   *
   * @param type - Identifier collection to preview.
   * @param limit - Maximum number of identifiers to include before an ellipsis.
   * @returns Compact preview preserving canonical collection order.
   */
  previewIris(type: AllowedIriKind, limit = 5): string {
    const select = Match.type<AllowedIriKind>().pipe(
      Match.when("classes", () => this.classIris),
      Match.when("objectProperties", () => this.objectPropertyIris),
      Match.when("datatypeProperties", () => this.datatypePropertyIris),
      Match.when("entityIds", () => this.entityIds),
      Match.exhaustive
    );
    const iris = select(type);
    const preview = pipe(iris, A.take(limit), A.join(", "));
    return A.length(iris) > limit ? `${preview}...` : preview;
  }
}

/**
 * Static and ontology-derived constraints governing one extraction stage.
 *
 * **Example** (Inspect an empty mention rule set)
 *
 * ```ts
 * import { makeMentionRuleSet } from "@effect-ontology/Prompt/RuleSet"
 *
 * console.log(makeMentionRuleSet().stage) // "mention"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuleSet extends S.Class<RuleSet>($I`RuleSet`)(
  {
    /** Extraction stage governed by this collection. */
    stage: ExtractionStage.pipe(
      $I.annoteKey("RuleSet.stage", {
        description: "Extraction stage governed by this collection.",
      })
    ),
    /** Rules that do not depend on ontology content. */
    staticRules: S.Array(ExtractionRule).pipe(
      $I.annoteKey("RuleSet.staticRules", {
        description: "Rules that do not depend on ontology content.",
      })
    ),
    /** Rules synthesized from the active ontology or extracted entities. */
    dynamicRules: S.Array(ExtractionRule).pipe(
      $I.annoteKey("RuleSet.dynamicRules", {
        description: "Rules synthesized from the active ontology or extracted entities.",
      })
    ),
    /** Allowed ontology IRIs and entity identifiers for validation and prompts. */
    allowedIris: AllowedIriSet.pipe(
      $I.annoteKey("RuleSet.allowedIris", {
        description: "Allowed ontology IRIs and entity identifiers for validation and prompts.",
      })
    ),
  },
  $I.annote("RuleSet", {
    description: "Static and ontology-derived extraction constraints for one pipeline stage.",
  })
) {
  /**
   *  Returns static rules followed by ontology-derived rules.
   *
   * **Example** (Inspect rule set.all rules)
   *
   * ```ts
   * import { RuleSet } from "@effect-ontology/Prompt/RuleSet"
   *
   * console.log(RuleSet)
   * ```
   *
   * @returns Result produced by this operation.
   */
  get allRules(): ReadonlyArray<ExtractionRule> {
    return A.appendAll(this.staticRules, this.dynamicRules);
  }

  /**
   *  Returns only schema-enforced rules.
   *
   * **Example** (Inspect rule set.error rules)
   *
   * ```ts
   * import { RuleSet } from "@effect-ontology/Prompt/RuleSet"
   *
   * console.log(RuleSet)
   * ```
   *
   * @returns Result produced by this operation.
   */
  get errorRules(): ReadonlyArray<ExtractionRule> {
    return A.filter(this.allRules, (rule) => RuleSeverity.is.error(rule.severity));
  }

  /**
   *  Returns only prompt-level preferences.
   *
   * **Example** (Inspect rule set.warning rules)
   *
   * ```ts
   * import { RuleSet } from "@effect-ontology/Prompt/RuleSet"
   *
   * console.log(RuleSet)
   * ```
   *
   * @returns Result produced by this operation.
   */
  get warningRules(): ReadonlyArray<ExtractionRule> {
    return A.filter(this.allRules, (rule) => RuleSeverity.is.warning(rule.severity));
  }

  /**
   *  Returns rules belonging to the requested behavioral category.
   *
   * **Example** (Inspect rule set.get rules by category)
   *
   * ```ts
   * import { RuleSet } from "@effect-ontology/Prompt/RuleSet"
   *
   * console.log(RuleSet)
   * ```
   *
   * @param category - Input consumed by this operation.
   * @returns Result produced by this operation.
   */
  getRulesByCategory(category: RuleCategory): ReadonlyArray<ExtractionRule> {
    return A.filter(this.allRules, (rule) => rule.category === category);
  }
}

const makeExtractionRule = (input: unknown): ExtractionRule =>
  pipe(S.decodeUnknownResult(ExtractionRule)(input), Result.getOrThrow);

const previewValues = <Value>(values: ReadonlyArray<Value>, render: (value: Value) => string): string =>
  pipe(values, A.take(5), A.map(render), A.join(", "));

const previewSuffix = (values: ReadonlyArray<unknown>): string => (A.length(values) > 5 ? "..." : "");

// =============================================================================
// Static Rules - Entity Extraction
// =============================================================================

/**
 * Static rules for entity extraction (Stage 1)
 *
 * **Details**
 *
 * These rules are constant across all entity extractions.
 *
 * **Example** (Inspect the entity identifier rule)
 *
 * ```ts
 * import { ENTITY_STATIC_RULES } from "@effect-ontology/Prompt/RuleSet"
 *
 * console.log(ENTITY_STATIC_RULES[0]?.id) // "entity-id-format"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ENTITY_STATIC_RULES: ReadonlyArray<ExtractionRule> = [
  makeExtractionRule({
    id: "entity-id-format",
    category: "id_format",
    severity: "error",
    instruction:
      "Assign unique snake_case IDs starting with a lowercase letter (e.g., 'cristiano_ronaldo' for 'Cristiano Ronaldo')",
    example: RuleExample.make({
      input: "Cristiano Ronaldo",
      output: "cristiano_ronaldo",
      explanation: "Lowercase with underscores, no special characters",
    }),
    counterExample: RuleExample.make({
      input: "Cristiano Ronaldo",
      output: "CristianoRonaldo",
      explanation: "Avoid PascalCase or camelCase for entity IDs",
    }),
    schemaDescription:
      "Snake_case unique identifier - use this exact ID when referring to this entity in relations (e.g., 'cristiano_ronaldo')",
    validationTemplate: "Entity ID '{value}' must be snake_case starting with a lowercase letter",
  }),

  makeExtractionRule({
    id: "entity-id-numbers",
    category: "id_format",
    severity: "error",
    instruction: "For names starting with numbers, prepend 'e' (e.g., '2pac' becomes 'e2pac')",
    example: RuleExample.make({
      input: "2Pac",
      output: "e2pac",
      explanation: "Prepend 'e' for IDs that would start with a number",
    }),
    counterExample: RuleExample.make({
      input: "2Pac",
      output: "2pac",
      explanation: "IDs cannot start with a number",
    }),
    schemaDescription: "IDs must start with a letter - prepend 'e' for numeric names",
    validationTemplate: "Entity ID '{value}' cannot start with a number",
  }),

  makeExtractionRule({
    id: "entity-mention-complete",
    category: "mention_format",
    severity: "warning",
    instruction: "Use complete, human-readable names for mentions (e.g., 'Stanford University' not 'Stanford')",
    example: RuleExample.make({
      input: "Stanford is a top university",
      output: "Stanford University",
      explanation: "Use full canonical name even if abbreviated in text",
    }),
    counterExample: RuleExample.make({
      input: "Stanford is a top university",
      output: "Stanford",
      explanation: "Incomplete - prefer full canonical form",
    }),
    schemaDescription:
      "Human-readable entity name found in text - use complete, canonical form (e.g., 'Cristiano Ronaldo' not 'Ronaldo')",
    validationTemplate: "Mention '{value}' may be incomplete - prefer full canonical form",
  }),

  makeExtractionRule({
    id: "entity-type-required",
    category: "type_mapping",
    severity: "error",
    instruction: "Map each entity to at least one ontology class from the allowed list",
    example: RuleExample.make({
      input: "Cristiano Ronaldo is a footballer",
      output: '["http://schema.org/Person"]',
      explanation: "At least one type IRI is required",
    }),
    counterExample: RuleExample.make({
      input: "Cristiano Ronaldo is a footballer",
      output: "[]",
      explanation: "Empty types array is not allowed",
    }),
    schemaDescription: "Array of ontology class URIs this entity instantiates (at least one required)",
    validationTemplate: "Entity must have at least one type, got: {value}",
  }),

  makeExtractionRule({
    id: "entity-type-specific",
    category: "type_mapping",
    severity: "warning",
    instruction: "Map each entity to the MOST SPECIFIC applicable ontology class",
    example: RuleExample.make({
      input: "Cristiano Ronaldo is a footballer",
      output: "http://ontology/FootballPlayer",
      explanation: "Use specific subclass, not generic Person",
    }),
    counterExample: RuleExample.make({
      input: "Cristiano Ronaldo is a footballer",
      output: "http://schema.org/Thing",
      explanation: "Too generic - prefer specific type",
    }),
    schemaDescription: "Use the most specific applicable class from the ontology",
    validationTemplate: "Type '{value}' may be too generic - consider more specific class",
  }),

  makeExtractionRule({
    id: "iri-exact-casing",
    category: "iri_casing",
    severity: "error",
    instruction:
      "Use the short class/property names (Local Names) EXACTLY as shown in the schema. Do NOT use full IRIs.",
    example: RuleExample.make({
      input: "Player class with label 'player'",
      output: "Player",
      explanation: "Use local name from schema, not full IRI",
    }),
    counterExample: RuleExample.make({
      input: "Player class with label 'player'",
      output: "http://ontology/Player",
      explanation: "Do not use full URL/IRI",
    }),
    schemaDescription: "Use exact local name from allowed list (case-sensitive)",
    validationTemplate: "Name '{value}' has incorrect casing or is a full IRI - check the allowed list",
  }),

  makeExtractionRule({
    id: "entity-id-reuse",
    category: "reference_integrity",
    severity: "error",
    instruction: "Reuse the exact same ID when referring to the same entity across the text",
    example: RuleExample.make({
      input: "Ronaldo scored. Ronaldo celebrated.",
      output: "cristiano_ronaldo (both occurrences)",
      explanation: "Same entity = same ID",
    }),
    counterExample: RuleExample.make({
      input: "Ronaldo scored. Ronaldo celebrated.",
      output: "cristiano_ronaldo, ronaldo_2",
      explanation: "Don't create duplicate IDs for same entity",
    }),
    schemaDescription: "Reuse exact ID for same entity",
    validationTemplate: "Entity ID '{value}' may be a duplicate - reuse existing ID",
  }),

  makeExtractionRule({
    id: "entity-extract-all",
    category: "cardinality",
    severity: "warning",
    instruction: "Extract as many entities as possible - be thorough",
    example: RuleExample.make({
      input: "Ronaldo plays for Al-Nassr in Saudi Arabia",
      output: "3 entities: cristiano_ronaldo, al_nassr, saudi_arabia",
      explanation: "Extract all named entities",
    }),
    counterExample: RuleExample.make({
      input: "Ronaldo plays for Al-Nassr in Saudi Arabia",
      output: "1 entity: cristiano_ronaldo",
      explanation: "Missing entities - extract all of them",
    }),
    schemaDescription: "Extract all named entities from the text",
    validationTemplate: "May have missed entities - extraction found only {value}",
  }),

  // =============================================================================
  // Entity Exclusion Rules
  // =============================================================================

  makeExtractionRule({
    id: "entity-exclude-photo-credits",
    category: "entity_exclusion",
    severity: "error",
    instruction:
      "DO NOT extract photo credits, news agencies, or photographer/journalist names as entities. " +
      "Common patterns: 'Photo by X', 'X/AFP', 'X/Getty Images', bylines like 'By John Smith'",
    example: RuleExample.make({
      input: "Ben Stansall/AFP via Getty Images",
      output: "(skip - not an entity)",
      explanation: "Photo credits and photographer names are NOT entities",
    }),
    counterExample: RuleExample.make({
      input: "Ben Stansall/AFP via Getty Images",
      output: "{ id: 'ben_stansall', types: ['Player'] }",
      explanation: "WRONG - this is a photographer credit, not a football player",
    }),
    schemaDescription: "Skip photo credits, agency names, and journalist bylines",
    validationTemplate: "'{value}' appears to be a photo credit or journalist - do not extract",
  }),

  makeExtractionRule({
    id: "entity-exclude-agencies",
    category: "entity_exclusion",
    severity: "error",
    instruction:
      "DO NOT extract news/photo agencies as sports entities. Agencies include: AFP, Reuters, " +
      "Getty Images, AP, PA Media, EPA. These are never players, teams, or leagues.",
    example: RuleExample.make({
      input: "AFP reported the score",
      output: "(skip - news agency, not a sports entity)",
      explanation: "AFP is a news agency, not a sports organization",
    }),
    counterExample: RuleExample.make({
      input: "AFP",
      output: "{ id: 'afp', types: ['Team'] }",
      explanation: "WRONG - AFP is a news agency, not a team",
    }),
    schemaDescription: "Skip news and photo agencies - they are not sports entities",
    validationTemplate: "'{value}' is a news/photo agency - do not extract as sports entity",
  }),

  // =============================================================================
  // Canonical Name Rules
  // =============================================================================

  makeExtractionRule({
    id: "entity-full-canonical-name",
    category: "mention_format",
    severity: "error",
    instruction:
      "ALWAYS use full canonical names for organizations, teams, and places. " +
      "Never use ambiguous short forms that could refer to multiple entities. " +
      "Example: 'Manchester United' not 'United', 'Arsenal Football Club' not 'Arsenal'",
    example: RuleExample.make({
      input: "United won the match",
      output: "manchester_united (mention: 'Manchester United')",
      explanation: "Expand 'United' to full unambiguous name from context",
    }),
    counterExample: RuleExample.make({
      input: "United won the match",
      output: "united (mention: 'United')",
      explanation: "WRONG - 'United' is ambiguous (Man Utd, Newcastle Utd, Leeds Utd, etc.)",
    }),
    schemaDescription: "Use full canonical name, not ambiguous short form",
    validationTemplate: "'{value}' is ambiguous - use full canonical name",
  }),

  makeExtractionRule({
    id: "entity-disambiguate-from-context",
    category: "mention_format",
    severity: "warning",
    instruction:
      "When text uses short forms or nicknames, infer the full canonical name from context. " +
      "Use other entities, locations, and domain knowledge to disambiguate. " +
      "E.g., if 'City' appears in an article about Premier League with 'Pep Guardiola', it means 'Manchester City'",
    example: RuleExample.make({
      input: "City, managed by Pep Guardiola, beat Arsenal",
      output: "manchester_city (mention: 'Manchester City')",
      explanation: "Pep Guardiola context indicates Manchester City, not other 'City' teams",
    }),
    counterExample: RuleExample.make({
      input: "City beat Arsenal",
      output: "city (mention: 'City')",
      explanation: "WRONG - must disambiguate using context clues",
    }),
    schemaDescription: "Disambiguate short forms using surrounding context",
    validationTemplate: "'{value}' needs disambiguation - check context for clues",
  }),
];

// =============================================================================
// Static Rules - Relation Extraction
// =============================================================================

/**
 * Static rules for relation extraction (Stage 2)
 *
 * **Details**
 *
 * These rules are constant across all relation extractions.
 *
 * **Example** (Inspect the relation subject rule)
 *
 * ```ts
 * import { RELATION_STATIC_RULES } from "@effect-ontology/Prompt/RuleSet"
 *
 * console.log(RELATION_STATIC_RULES[0]?.id) // "relation-subject-valid"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RELATION_STATIC_RULES: ReadonlyArray<ExtractionRule> = [
  makeExtractionRule({
    id: "relation-subject-valid",
    category: "reference_integrity",
    severity: "error",
    instruction: "Subject MUST be one of the entity IDs from Stage 1",
    example: RuleExample.make({
      input: "cristiano_ronaldo plays for al_nassr",
      output: '{ "subjectId": "cristiano_ronaldo" }',
      explanation: "Use exact entity ID from Stage 1",
    }),
    counterExample: RuleExample.make({
      input: "cristiano_ronaldo plays for al_nassr",
      output: '{ "subjectId": "ronaldo" }',
      explanation: "Must use exact ID from Stage 1, not abbreviated",
    }),
    schemaDescription: "Subject entity ID - MUST be from Stage 1 entity list",
    validationTemplate: "Subject '{value}' is not a valid entity ID from Stage 1",
  }),

  makeExtractionRule({
    id: "relation-predicate-valid",
    category: "property_usage",
    severity: "error",
    instruction: "Predicate MUST be the local name of an allowed property (e.g., 'playsFor', NOT the full URI)",
    example: RuleExample.make({
      input: "uses playsFor property",
      output: "playsFor",
      explanation: "Use property local name from allowed list",
    }),
    counterExample: RuleExample.make({
      input: "uses playsFor property",
      output: "http://ontology/playsFor",
      explanation: "Must use local name only, NOT the full URI",
    }),
    schemaDescription: "Property local name - MUST be from allowed properties list",
    validationTemplate: "Predicate '{value}' is not a valid property name",
  }),

  makeExtractionRule({
    id: "relation-object-type",
    category: "property_usage",
    severity: "error",
    instruction:
      "Object type depends on property: object properties require entity ID, datatype properties require literal value",
    example: RuleExample.make({
      input: "Object property 'playsFor'",
      output: '{ "object": "al_nassr" }',
      explanation: "Object property → entity ID as object",
    }),
    counterExample: RuleExample.make({
      input: "Object property 'playsFor'",
      output: '{ "object": "Al-Nassr" }',
      explanation: "Must use entity ID, not literal string",
    }),
    schemaDescription: "Object: entity ID (for object properties) OR literal value (for datatype properties)",
    validationTemplate: "Object '{value}' has wrong type for this property",
  }),

  makeExtractionRule({
    id: "relation-property-casing",
    category: "iri_casing",
    severity: "warning",
    instruction: "Use property local names as shown in the allowed list. Casing is normalized automatically.",
    example: RuleExample.make({
      input: "teamRanking property",
      output: "teamRanking",
      explanation: "Use local name as shown (case will be normalized)",
    }),
    counterExample: RuleExample.make({
      input: "teamRanking property",
      output: "TeamRanking",
      explanation: "Prefer exact casing from list, though it will be normalized",
    }),
    schemaDescription: "Property local name from allowed list (case-insensitive matching)",
    validationTemplate: "Property '{value}' not found in allowed list",
  }),

  makeExtractionRule({
    id: "relation-extract-all",
    category: "cardinality",
    severity: "warning",
    instruction: "Extract ALL relationships mentioned or implied in the text - be thorough",
    example: RuleExample.make({
      input: "Ronaldo plays for Al-Nassr in Saudi Arabia",
      output: "2 relations: ronaldo-playsFor->al_nassr, al_nassr-locatedIn->saudi_arabia",
      explanation: "Extract all valid relations",
    }),
    counterExample: RuleExample.make({
      input: "Ronaldo plays for Al-Nassr in Saudi Arabia",
      output: "1 relation: ronaldo-playsFor->al_nassr",
      explanation: "Missing relation - extract all of them",
    }),
    schemaDescription: "Extract all valid relations from the text",
    validationTemplate: "May have missed relations - extraction found only {value}",
  }),

  // =============================================================================
  // Relation Context Validation Rules
  // =============================================================================

  makeExtractionRule({
    id: "relation-verify-text-support",
    category: "context_validation",
    severity: "error",
    instruction:
      "Relations MUST be explicitly stated or strongly implied by the text. " +
      "Do NOT infer relations from general knowledge - only extract what the text actually says. " +
      "If the text says 'X scored against Y', extract that relation, not unmentioned team affiliations.",
    example: RuleExample.make({
      input: "Vicario made a save against Arsenal",
      output: "vicario-playedAgainst->arsenal",
      explanation: "The text supports 'played against', not 'plays for'",
    }),
    counterExample: RuleExample.make({
      input: "Vicario made a save against Arsenal",
      output: "vicario-playsFor->arsenal",
      explanation: "WRONG - text says he played AGAINST Arsenal, not FOR them",
    }),
    schemaDescription: "Extract only relations supported by the text",
    validationTemplate: "Relation '{value}' is not supported by the text context",
  }),

  makeExtractionRule({
    id: "relation-opponent-vs-team",
    category: "context_validation",
    severity: "error",
    instruction:
      "Carefully distinguish between opponent relationships and team membership. " +
      "'X vs Y', 'X against Y', 'X faced Y' indicate opponents, NOT team membership. " +
      "Only use 'playsFor' when text explicitly states team affiliation.",
    example: RuleExample.make({
      input: "Hincapie's Leverkusen lost to Arsenal",
      output: "hincapie-playsFor->leverkusen, leverkusen-playedAgainst->arsenal",
      explanation: "Hincapie plays FOR Leverkusen, who played AGAINST Arsenal",
    }),
    counterExample: RuleExample.make({
      input: "Hincapie's tackle against Arsenal",
      output: "hincapie-playsFor->arsenal",
      explanation: "WRONG - 'against Arsenal' means opponent, not team membership",
    }),
    schemaDescription: "Distinguish opponent relations from team membership",
    validationTemplate: "'{value}' confuses opponent relationship with team membership",
  }),

  makeExtractionRule({
    id: "relation-possessive-indicates-affiliation",
    category: "context_validation",
    severity: "warning",
    instruction:
      "Possessive patterns indicate affiliation: 'X's Y', 'Y of X' suggest membership/ownership. " +
      "E.g., 'Arsenal's goalkeeper' means the goalkeeper plays for Arsenal. " +
      "'Spurs keeper Vicario' means Vicario plays for Tottenham (Spurs).",
    example: RuleExample.make({
      input: "Tottenham's goalkeeper Vicario saved the shot",
      output: "vicario-playsFor->tottenham",
      explanation: "Possessive 'Tottenham's goalkeeper' indicates team membership",
    }),
    counterExample: RuleExample.make({
      input: "Arsenal faced Tottenham's goalkeeper",
      output: "vicario-playsFor->arsenal",
      explanation: "WRONG - Vicario is TOTTENHAM's goalkeeper, not Arsenal's",
    }),
    schemaDescription: "Use possessive patterns to infer team affiliation",
    validationTemplate: "Check possessive pattern for correct affiliation in '{value}'",
  }),
];

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create entity extraction rule set from ontology context
 *
 * **Details**
 *
 * Combines static entity rules with dynamic rules derived from
 * the specific classes and properties available.
 *
 * **Example** (Build an empty entity-stage rule set)
 *
 * ```ts
 * import { makeEntityRuleSet } from "@effect-ontology/Prompt/RuleSet"
 *
 * console.log(makeEntityRuleSet([], []).stage) // "entity"
 * ```
 *
 * @param classes - Available ontology classes
 * @param datatypeProperties - Available datatype properties for attributes
 * @returns RuleSet for entity extraction
 * @category constructors
 * @since 0.0.0
 */
export const makeEntityRuleSet = dual2(
  (classes: ReadonlyArray<ClassDefinition>, datatypeProperties: ReadonlyArray<PropertyDefinition>): RuleSet => {
    const classRule = A.match(classes, {
      onEmpty: O.none<ExtractionRule>,
      onNonEmpty: (definitions) => {
        const preview = previewValues(definitions, (definition) => definition.id);
        const suffix = previewSuffix(definitions);
        return O.some(
          makeExtractionRule({
            id: "entity-allowed-classes",
            category: "type_mapping",
            severity: "error",
            instruction: `Types MUST be from allowed classes: ${preview}${suffix}`,
            example: RuleExample.make({
              input: "Selecting entity type",
              output: A.headNonEmpty(definitions).id,
              explanation: "Use IRI from the ontology schema",
            }),
            schemaDescription: `Allowed classes: ${preview}${suffix}`,
            validationTemplate: "Type '{value}' is not in allowed classes",
          })
        );
      },
    });

    const datatypeRule = A.match(datatypeProperties, {
      onEmpty: O.none<ExtractionRule>,
      onNonEmpty: (definitions) => {
        const preview = previewValues(definitions, (definition) => definition.id);
        const suffix = previewSuffix(definitions);
        return O.some(
          makeExtractionRule({
            id: "entity-allowed-attributes",
            category: "property_usage",
            severity: "error", // Error - attributes are important for entity value
            instruction: `Extract entity attributes using property keys. REQUIRED when text contains relevant data. Use: ${preview}${suffix}`,
            example: RuleExample.make({
              input: "CEO John Mitchell of Acme Corporation, founded in 2018",
              output: '{ "name": "John Mitchell", "title": "CEO", "foundedDate": "2018" }',
              explanation: "Extract all available attributes from text - names, titles, dates, quantities",
            }),
            schemaDescription: "Entity attributes capture literal values. Extract ALL available data.",
            validationTemplate: "Entity should have attributes extracted from text",
          })
        );
      },
    });

    const dynamicRules = A.getSomes([classRule, datatypeRule]);

    const allowedIris = AllowedIriSet.fromOntology(
      classes,
      [], // No object properties for entity stage
      datatypeProperties,
      [] // No entity IDs yet
    );

    return RuleSet.make({
      stage: "entity",
      staticRules: ENTITY_STATIC_RULES,
      dynamicRules,
      allowedIris,
    });
  }
);

/**
 * Create relation extraction rule set from ontology context
 *
 * **Details**
 *
 * Combines static relation rules with dynamic rules derived from
 * the specific entity IDs and properties available.
 *
 * **Example** (Build an empty relation-stage rule set)
 *
 * ```ts
 * import { makeRelationRuleSet } from "@effect-ontology/Prompt/RuleSet"
 *
 * console.log(makeRelationRuleSet([], []).stage) // "relation"
 * ```
 *
 * @param entityIds - Valid entity IDs from Stage 1
 * @param properties - Available properties (both object and datatype)
 * @returns RuleSet for relation extraction
 * @category constructors
 * @since 0.0.0
 */
export const makeRelationRuleSet = dual2(
  (entityIds: ReadonlyArray<string>, properties: ReadonlyArray<PropertyDefinition>): RuleSet => {
    const objectProperties = A.filter(properties, (property) => property.rangeType === "object");
    const datatypeProperties = A.filter(properties, (property) => property.rangeType === "datatype");

    const entityRule = A.match(entityIds, {
      onEmpty: O.none<ExtractionRule>,
      onNonEmpty: (ids) => {
        const preview = previewValues(ids, (id) => id);
        const suffix = previewSuffix(ids);
        return O.some(
          makeExtractionRule({
            id: "relation-valid-entities",
            category: "reference_integrity",
            severity: "error",
            instruction: `Use ONLY these entity IDs from Stage 1: ${preview}${suffix}`,
            example: RuleExample.make({
              input: "Selecting subject/object",
              output: A.headNonEmpty(ids),
              explanation: "Use exact ID from Stage 1",
            }),
            schemaDescription: `Valid entity IDs: ${preview}${suffix}`,
            validationTemplate: "Entity ID '{value}' is not from Stage 1",
          })
        );
      },
    });

    const objectPropertyRule = A.match(objectProperties, {
      onEmpty: O.none<ExtractionRule>,
      onNonEmpty: (definitions) => {
        const preview = previewValues(definitions, (definition) => definition.id);
        const suffix = previewSuffix(definitions);
        return O.some(
          makeExtractionRule({
            id: "relation-allowed-object-props",
            category: "property_usage",
            severity: "error",
            instruction: `Object properties (link entities): ${preview}${suffix}`,
            example: RuleExample.make({
              input: "Entity-to-entity relation",
              output: A.headNonEmpty(definitions).id,
              explanation: "Object property → object must be entity ID",
            }),
            schemaDescription: `Object properties: ${preview}${suffix}`,
            validationTemplate: "Property '{value}' is not in allowed object properties",
          })
        );
      },
    });

    const datatypePropertyRule = A.match(datatypeProperties, {
      onEmpty: O.none<ExtractionRule>,
      onNonEmpty: (definitions) => {
        const preview = previewValues(definitions, (definition) => definition.id);
        const suffix = previewSuffix(definitions);
        return O.some(
          makeExtractionRule({
            id: "relation-allowed-datatype-props",
            category: "property_usage",
            severity: "error",
            instruction: `Datatype properties (literal values): ${preview}${suffix}`,
            example: RuleExample.make({
              input: "Entity-to-literal relation",
              output: A.headNonEmpty(definitions).id,
              explanation: "Datatype property → object must be literal",
            }),
            schemaDescription: `Datatype properties: ${preview}${suffix}`,
            validationTemplate: "Property '{value}' is not in allowed datatype properties",
          })
        );
      },
    });

    const dynamicRules = A.getSomes([entityRule, objectPropertyRule, datatypePropertyRule]);

    const allowedIris = AllowedIriSet.fromOntology(
      [], // No classes for relation stage
      objectProperties,
      datatypeProperties,
      entityIds
    );

    return RuleSet.make({
      stage: "relation",
      staticRules: RELATION_STATIC_RULES,
      dynamicRules,
      allowedIris,
    });
  }
);

/**
 * Create mention extraction rule set
 *
 * **Details**
 *
 * Mention extraction has simpler rules since it doesn't involve type assignment.
 *
 * **Example** (Build a mention-stage rule set)
 *
 * ```ts
 * import { makeMentionRuleSet } from "@effect-ontology/Prompt/RuleSet"
 *
 * console.log(makeMentionRuleSet().stage) // "mention"
 * ```
 *
 * @returns RuleSet for mention extraction
 * @category constructors
 * @since 0.0.0
 */
export const makeMentionRuleSet = (): RuleSet => {
  const staticRules: ReadonlyArray<ExtractionRule> = [
    makeExtractionRule({
      id: "mention-id-format",
      category: "id_format",
      severity: "error",
      instruction: "Assign unique snake_case IDs starting with a lowercase letter",
      example: RuleExample.make({
        input: "Cristiano Ronaldo",
        output: "cristiano_ronaldo",
        explanation: "Lowercase with underscores",
      }),
      schemaDescription: "Snake_case unique identifier",
      validationTemplate: "Mention ID '{value}' must be snake_case",
    }),

    makeExtractionRule({
      id: "mention-complete",
      category: "mention_format",
      severity: "warning",
      instruction: "Use complete, human-readable names for mentions",
      example: RuleExample.make({
        input: "Stanford is a university",
        output: "Stanford University",
        explanation: "Use full canonical form",
      }),
      schemaDescription: "Human-readable entity name - use complete form",
      validationTemplate: "Mention '{value}' may be incomplete",
    }),

    makeExtractionRule({
      id: "mention-context",
      category: "mention_format",
      severity: "warning",
      instruction: "Include brief context about each entity to help with later classification",
      example: RuleExample.make({
        input: "Ronaldo scored a goal",
        output: '{ "context": "A professional footballer who scored" }',
        explanation: "Context helps with type assignment in Stage 1",
      }),
      schemaDescription: "Brief context about the entity from text",
      validationTemplate: "Missing context for mention '{value}'",
    }),

    makeExtractionRule({
      id: "mention-extract-all",
      category: "cardinality",
      severity: "warning",
      instruction: "Extract as many entity mentions as possible - be thorough",
      example: RuleExample.make({
        input: "Ronaldo plays for Al-Nassr",
        output: "2 mentions",
        explanation: "Extract all named entities",
      }),
      schemaDescription: "Extract all entity mentions from text",
      validationTemplate: "May have missed mentions",
    }),
  ];

  return RuleSet.make({
    stage: "mention",
    staticRules,
    dynamicRules: [],
    allowedIris: AllowedIriSet.make({
      classIriMap: HashMap.empty(),
      propertyIriMap: HashMap.empty(),
    }),
  });
};
