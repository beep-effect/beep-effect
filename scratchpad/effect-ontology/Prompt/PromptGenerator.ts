/**
 * Schema-backed builders for text, few-shot, and multimodal extraction prompts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { pipe, Result } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Prompt from "effect/unstable/ai/Prompt";
import { Entity } from "../Domain/Model/Entity.ts";
import { ImageForPrompt } from "../Domain/Model/Image.ts";
import { ClassDefinition, PropertyDefinition, partitionPropertiesByRangeType } from "../Domain/Model/Ontology.ts";
import { dual2, dual3, dual4 } from "../Utils/Dual.ts";
import { extractLocalNameFromIri } from "../Utils/Iri.ts";
import type { PromptDoc } from "./Doc.ts";
import { Doc } from "./Doc.ts";
import type { RuleSet } from "./RuleSet.ts";
import { makeEntityRuleSet, makeMentionRuleSet, makeRelationRuleSet } from "./RuleSet.ts";

const $I = $ScratchpadId.create("effect-ontology/Prompt/PromptGenerator");

const optionText = (fallback: string): ((value: O.Option<string>) => string) => O.getOrElse(() => fallback);

const renderUnknownJson: (value: unknown) => string = flow(
  UnknownFromJsonString.encodeUnknownResult,
  Result.getOrElse(() => "null")
);

/** Optional string collection used by ontology prompt context fields. */
const OptionalStrings = S.Array(S.String).pipe(
  S.OptionFromOptionalKey,
  SchemaUtils.withNoneDefault,
  $I.annoteSchema("OptionalStrings", {
    description: "Optional immutable string collection with an Option-none constructor default.",
  })
);

/** Closed conversation roles accepted in few-shot example messages. */
const PromptRole = LiteralKit(["user", "assistant"]).pipe(
  $I.annoteSchema("PromptRole", {
    description: "Conversation roles supported by few-shot extraction examples.",
  })
);

/**
 * Ontology definitions and prior-stage values available while building a prompt.
 *
 * **Example** (Create an empty-ontology mention context)
 *
 * ```ts
 * import { OntologyPromptContext } from "@effect-ontology/Prompt/PromptGenerator"
 * import * as O from "effect/Option"
 *
 * const context = OntologyPromptContext.make({
 *   classes: [],
 *   objectProperties: [],
 *   datatypeProperties: []
 * })
 * console.log(context.classes.length) // 0
 * console.log(O.isNone(context.imageContexts)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OntologyPromptContext extends S.Class<OntologyPromptContext>($I`OntologyPromptContext`)(
  {
    /** Ontology classes available to the extraction stage. */
    classes: S.Array(ClassDefinition).pipe(
      SchemaUtils.withEmptyArrayDefaults<ClassDefinition>(),
      $I.annoteKey("OntologyPromptContext.classes", {
        description: "Ontology classes available to the extraction stage.",
      })
    ),
    /** Ontology object properties that connect extracted entities. */
    objectProperties: S.Array(PropertyDefinition).pipe(
      SchemaUtils.withEmptyArrayDefaults<PropertyDefinition>(),
      $I.annoteKey("OntologyPromptContext.objectProperties", {
        description: "Ontology object properties that connect extracted entities.",
      })
    ),
    /** Ontology datatype properties that carry literal values. */
    datatypeProperties: S.Array(PropertyDefinition).pipe(
      SchemaUtils.withEmptyArrayDefaults<PropertyDefinition>(),
      $I.annoteKey("OntologyPromptContext.datatypeProperties", {
        description: "Ontology datatype properties that carry literal values.",
      })
    ),
    /** Optional entity identifiers emitted by the preceding extraction stage. */
    entityIds: OptionalStrings.pipe(
      $I.annoteKey("OntologyPromptContext.entityIds", {
        description: "Optional entity identifiers emitted by the preceding extraction stage.",
      })
    ),
    /** Optional entities emitted by the preceding extraction stage. */
    entities: S.Array(Entity).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("OntologyPromptContext.entities", {
        description: "Optional entities emitted by the preceding extraction stage.",
      })
    ),
    /** Optional images available to a multimodal extraction request. */
    imageContexts: S.Array(ImageForPrompt).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("OntologyPromptContext.imageContexts", {
        description: "Optional images available to a multimodal extraction request.",
      })
    ),
  },
  $I.annote("OntologyPromptContext", {
    description: "Ontology definitions and prior-stage values used to construct an extraction prompt.",
  })
) {}

const StructuredPromptFields = {
  /** Cacheable extraction rules, ontology schema, and instructions. */
  systemMessage: S.String.pipe(
    $I.annoteKey("StructuredPrompt.systemMessage", {
      description: "Cacheable extraction rules, ontology schema, and instructions.",
    })
  ),
  /** Request-specific source content supplied by the caller. */
  userMessage: S.String.pipe(
    $I.annoteKey("StructuredPrompt.userMessage", {
      description: "Request-specific source content supplied by the caller.",
    })
  ),
};

/**
 * Extraction prompt separated into cacheable system and variable user messages.
 *
 * **Example** (Create a structured prompt)
 *
 * ```ts
 * import { StructuredPrompt } from "@effect-ontology/Prompt/PromptGenerator"
 *
 * const prompt = StructuredPrompt.make({ systemMessage: "Extract entities.", userMessage: "Ada wrote notes." })
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StructuredPrompt extends S.Class<StructuredPrompt>($I`StructuredPrompt`)(
  StructuredPromptFields,
  $I.annote("StructuredPrompt", {
    description: "Extraction prompt separated into cacheable system and variable user messages.",
  })
) {}

/**
 * One user or assistant turn in a few-shot extraction example.
 *
 * **Example** (Create a user example turn)
 *
 * ```ts
 * import { ExampleMessage } from "@effect-ontology/Prompt/PromptGenerator"
 *
 * const message = ExampleMessage.make({ role: "user", content: "Extract from: Ada founded Acme." })
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExampleMessage extends S.Class<ExampleMessage>($I`ExampleMessage`)(
  {
    /** Conversation role associated with the example turn. */
    role: PromptRole.pipe(
      $I.annoteKey("ExampleMessage.role", {
        description: "Conversation role associated with the example turn.",
      })
    ),
    /** Textual content of the example turn. */
    content: S.String.pipe(
      $I.annoteKey("ExampleMessage.content", {
        description: "Textual content of the example turn.",
      })
    ),
  },
  $I.annote("ExampleMessage", {
    description: "One user or assistant turn in a few-shot extraction example.",
  })
) {}

/** Retrieved conversation turn accepted before role filtering. */
const ScoredExampleMessage = S.Struct({
  /** Conversation role supplied by a retrieved example. */
  role: S.String.pipe(
    $I.annoteKey("ScoredExample.promptMessages.role", {
      description: "Conversation role supplied by a retrieved example.",
    })
  ),
  /** Conversation content supplied by a retrieved example. */
  content: S.String.pipe(
    $I.annoteKey("ScoredExample.promptMessages.content", {
      description: "Conversation content supplied by a retrieved example.",
    })
  ),
}).pipe(
  $I.annoteSchema("ScoredExampleMessage", {
    description: "Untrusted retrieved conversation turn filtered before prompt insertion.",
  })
);

/** Structured warning metadata decoded from a negative example output. */
const NegativeExampleOutput = S.Struct({
  /** Optional machine-readable category for the demonstrated mistake. */
  errorCategory: S.String.pipe(
    S.OptionFromOptionalKey,
    SchemaUtils.withNoneDefault,
    $I.annoteKey("NegativeExampleOutput.errorCategory", {
      description: "Optional machine-readable category for the demonstrated mistake.",
    })
  ),
  /** Optional textual pattern that must not be extracted. */
  pattern: S.String.pipe(
    S.OptionFromOptionalKey,
    SchemaUtils.withNoneDefault,
    $I.annoteKey("NegativeExampleOutput.pattern", {
      description: "Optional textual pattern that must not be extracted.",
    })
  ),
}).pipe(
  SchemaUtils.withCodecStatics(["decodeUnknownOption"]),
  $I.annoteSchema("NegativeExampleOutput", {
    description: "Optional structured metadata carried by a negative extraction example.",
  })
);

/**
 * Retrieved few-shot example with its expected output and polarity.
 *
 * **Example** (Create a positive example)
 *
 * ```ts
 * import { ScoredExample } from "@effect-ontology/Prompt/PromptGenerator"
 *
 * const example = ScoredExample.make({
 *   inputText: "Ada founded Acme.",
 *   expectedOutput: { entities: [] }
 * })
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScoredExample extends S.Class<ScoredExample>($I`ScoredExample`)(
  {
    /** Source text presented by the example. */
    inputText: S.String.pipe(
      $I.annoteKey("ScoredExample.inputText", {
        description: "Source text presented by the example.",
      })
    ),
    /** Expected structured extraction output for the source text. */
    expectedOutput: S.Unknown.pipe(
      $I.annoteKey("ScoredExample.expectedOutput", {
        description: "Expected structured extraction output for the source text.",
      })
    ),
    /** Whether the example demonstrates behavior the model must avoid. */
    isNegative: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(false),
      $I.annoteKey("ScoredExample.isNegative", {
        description: "Whether the example demonstrates behavior the model must avoid.",
      })
    ),
    /** Optional preformatted conversation turns for this example. */
    promptMessages: S.Array(ScoredExampleMessage).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ScoredExample.promptMessages", {
        description: "Optional preformatted conversation turns for this example.",
      })
    ),
    /** Optional explanation of a negative example's prohibited behavior. */
    explanation: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ScoredExample.explanation", {
        description: "Optional explanation of a negative example's prohibited behavior.",
      })
    ),
  },
  $I.annote("ScoredExample", {
    description: "Retrieved few-shot example with expected output and positive or negative polarity.",
  })
) {}

/**
 * Structured extraction prompt augmented with positive and negative examples.
 *
 * **Example** (Create an example-aware prompt)
 *
 * ```ts
 * import { StructuredPromptWithExamples } from "@effect-ontology/Prompt/PromptGenerator"
 *
 * const prompt = StructuredPromptWithExamples.make({
 *   systemMessage: "Extract entities.",
 *   userMessage: "Ada wrote notes.",
 *   exampleMessages: [],
 *   hasNegativeExamples: false
 * })
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StructuredPromptWithExamples extends S.Class<StructuredPromptWithExamples>(
  $I`StructuredPromptWithExamples`
)(
  {
    ...StructuredPromptFields,
    /** Positive few-shot example turns inserted before the request. */
    exampleMessages: S.Array(ExampleMessage).pipe(
      SchemaUtils.withEmptyArrayDefaults<ExampleMessage>(),
      $I.annoteKey("StructuredPromptWithExamples.exampleMessages", {
        description: "Positive few-shot example turns inserted before the request.",
      })
    ),
    /** Whether negative-example warnings were included in the system message. */
    hasNegativeExamples: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(false),
      $I.annoteKey("StructuredPromptWithExamples.hasNegativeExamples", {
        description: "Whether negative-example warnings were included in the system message.",
      })
    ),
  },
  $I.annote("StructuredPromptWithExamples", {
    description: "Structured extraction prompt augmented with positive and negative examples.",
  })
) {}

// =============================================================================
// Document Builders - Sections
// =============================================================================

/**
 * Build namespace prefix section
 * Explains that we use local names for token efficiency and will expand to full IRIs
 */
const buildNamespacePrefixSection = (ctx: OntologyPromptContext): PromptDoc => {
  if (A.isReadonlyArrayEmpty(ctx.classes)) {
    return Doc.empty;
  }

  // Extract common namespace from first class
  const namespace = pipe(
    ctx.classes,
    A.head,
    O.map((definition) => definition.id),
    O.flatMap(Str.match(/^.*[/#]/)),
    O.map(A.head),
    O.flatten,
    O.getOrElse(() => "")
  );

  return Doc.vsep([
    Doc.text("=== NAMESPACE ==="),
    Doc.text(`Base: ${namespace}`),
    Doc.text("Use LOCAL NAMES only (e.g., 'Player' not full URI)."),
    Doc.text("We will expand to full URIs automatically."),
    Doc.empty,
  ]);
};

/**
 * Build task header section (without input text - text is added at end of prompt)
 */
const buildTaskSection = (stage: "mention" | "entity" | "relation"): PromptDoc => {
  const taskDescription =
    stage === "mention"
      ? "Extract all named entity mentions from the text provided at the end WITHOUT assigning types."
      : stage === "entity"
        ? "Extract all named entities from the text provided at the end and map them to the ontology classes defined below."
        : "Extract relationships between entities from the text provided at the end using the ontology properties defined below.";

  return Doc.text(taskDescription);
};

/**
 * Build input text section (placed at end of prompt for LLM recency bias)
 */
const buildInputTextSection = (text: string): PromptDoc =>
  Doc.vsep([Doc.text("=== INPUT TEXT ==="), Doc.text("Extract from the following text:"), Doc.empty, Doc.text(text)]);

/**
 * Build class snippet for ontology documentation
 *
 * Uses local names instead of full IRIs for token efficiency.
 * Exposes SKOS metadata (altLabels, definition, scopeNote) to help LLMs
 * recognize alternative names and understand concept scope.
 *
 * Format:
 * ```
 * ## ClassName
 * [skos:definition or rdfs:comment]
 * Aliases: altLabel1, altLabel2, ...  (if available)
 * Inherits from: ParentClass1         (if available)
 * Scope: [scopeNote]                  (if available)
 * Properties:
 *   - propName: description [expects type]
 * ```
 */
const buildClassSnippet = (
  cls: ClassDefinition,
  applicableProperties: ReadonlyArray<PropertyDefinition>
): PromptDoc => {
  const clsLocalName = extractLocalNameFromIri(cls.id);
  const props = A.filter(
    applicableProperties,
    // Fix: Ensure we are comparing local names. Property domain might store full IRIs or local names.
    // We normalize both to local names to be safe.
    (p) => {
      const propertyDomains = A.map(p.domain, extractLocalNameFromIri);
      return A.isReadonlyArrayEmpty(propertyDomains) || A.contains(propertyDomains, clsLocalName);
    }
  );

  const propLines =
    props.length > 0
      ? A.map(props, (p) => {
          const propLocalName = extractLocalNameFromIri(p.id);
          const rangeNote = p.rangeType === "datatype" ? "literal value" : "entity reference";
          return Doc.text(`    - ${propLocalName}: ${optionText("No description")(p.comment)} [expects ${rangeNote}]`);
        })
      : [Doc.text("    (no specific properties)")];

  // Use skos:definition if available, otherwise fall back to rdfs:comment
  const description = pipe(
    cls.definition,
    O.orElse(() => cls.comment),
    optionText("No description available.")
  );

  // Build aliases line from altLabels (SKOS alternative labels are synonyms LLM should recognize)
  // Include prefLabels if they differ from the class local name
  const filteredPrefLabels = A.filter(
    cls.prefLabels,
    (label) => Str.toLowerCase(label) !== Str.toLowerCase(clsLocalName)
  );
  const aliases = A.appendAll(filteredPrefLabels, cls.altLabels);
  const aliasesLine = aliases.length > 0 ? Doc.text(`Aliases: ${A.join(aliases, ", ")}`) : Doc.empty;

  // Show inheritance from broader concepts
  const broaderLocalNames = A.map(cls.broader, extractLocalNameFromIri);
  const inheritsLine =
    broaderLocalNames.length > 0 ? Doc.text(`Inherits from: ${A.join(broaderLocalNames, ", ")}`) : Doc.empty;

  // Include scope note if available (helps LLM understand when to use this class)
  const scopeLine = pipe(
    cls.scopeNote,
    O.map((scope) => Doc.text(`Scope: ${scope}`)),
    O.getOrElse(() => Doc.empty)
  );

  return pipe(
    [
      Doc.text(`## ${clsLocalName}`),
      Doc.text(description),
      aliasesLine,
      inheritsLine,
      scopeLine,
      Doc.text("Properties:"),
      ...propLines,
    ],
    A.filter(Str.isNonEmpty),
    Doc.vsep
  );
};

/**
 * Build property snippet for relation extraction
 * Uses local names instead of full IRIs for token efficiency
 * Includes inverse property warnings and scope notes to guide LLM usage
 */
const buildPropertySnippet = (prop: PropertyDefinition): PromptDoc => {
  const propLocalName = extractLocalNameFromIri(prop.id);
  const rangeType = prop.rangeType === "datatype" ? "LITERAL VALUE" : "ENTITY REFERENCE";
  const domainNote = prop.domain.length > 0 ? `Domain: ${A.join(prop.domain, ", ")}` : "Domain: any entity";
  const rangeNote =
    prop.range.length > 0 ? `Range: ${A.join(prop.range, ", ")}` : `Range: ${Str.toLowerCase(rangeType)}`;

  const lines: Array<PromptDoc> = [
    Doc.text(`### ${propLocalName}`),
    Doc.text(optionText("No description available.")(prop.comment)),
    Doc.text(`- ${domainNote}`),
    Doc.text(`- ${rangeNote}`),
    Doc.text(`- Expects: ${rangeType}`),
  ];

  // Add inverse property warning to help LLM choose correct direction
  if (prop.inverseOf.length > 0) {
    const inverseNames = pipe(prop.inverseOf, A.map(extractLocalNameFromIri), A.join(", "));
    lines.push(Doc.text(`- ⚠️ Inverse of: ${inverseNames} (use only ONE direction, not both)`));
  }

  // Add scope note if available - provides usage guidance
  O.map(prop.scopeNote, (scope) => lines.push(Doc.text(`- Usage: ${scope}`)));

  return Doc.vsep(lines);
};

/**
 * Build ontology schema section for entity extraction
 */
const buildOntologySection = (ctx: OntologyPromptContext): PromptDoc => {
  if (ctx.classes.length === 0) {
    return Doc.empty;
  }

  const allProperties = [...ctx.objectProperties, ...ctx.datatypeProperties];
  const classSnippets = A.map(ctx.classes, (cls) => buildClassSnippet(cls, allProperties));

  return Doc.vsep([
    Doc.text("=== ONTOLOGY SCHEMA ==="),
    Doc.empty,
    ...A.flatMap(classSnippets, (snippet) => [snippet, Doc.empty]),
  ]);
};

/**
 * Build properties section for relation extraction
 */
const buildPropertiesSection = (ctx: OntologyPromptContext): PromptDoc => {
  const parts: Array<PromptDoc> = [Doc.text("=== ONTOLOGY PROPERTIES ==="), Doc.empty];

  if (ctx.objectProperties.length > 0) {
    parts.push(Doc.text("## Object Properties (link entities together)"));
    A.forEach(ctx.objectProperties, (p) => {
      parts.push(buildPropertySnippet(p));
      parts.push(Doc.empty);
    });
  }

  if (ctx.datatypeProperties.length > 0) {
    parts.push(Doc.text("## Datatype Properties (literal values)"));
    A.forEach(ctx.datatypeProperties, (p) => {
      parts.push(buildPropertySnippet(p));
      parts.push(Doc.empty);
    });
  }

  return Doc.vsep(parts);
};

/**
 * Build entities list section for relation extraction
 */
const buildEntitiesSection = (ctx: OntologyPromptContext): PromptDoc =>
  pipe(
    ctx.entities,
    O.filter(A.isReadonlyArrayNonEmpty),
    O.map((entities) =>
      Doc.vsep([
        Doc.text("=== EXTRACTED ENTITIES (from Stage 1) ==="),
        ...A.map(entities, (entity) => Doc.text(`- ${entity.id} (${entity.mention}): [${A.join(entity.types, ", ")}]`)),
      ])
    ),
    O.getOrElse(() => Doc.empty)
  );

/**
 * Build DUL hierarchy section explaining Object vs Event distinction
 *
 * Helps LLMs understand the fundamental ontological categories:
 * - TrackedEntity extends dul:Object (things with spatial extent)
 * - TrackedEvent extends dul:Event (things with temporal extent)
 *
 * This section is added to entity extraction prompts to guide type selection.
 */
const buildDulHierarchySection = (ctx: OntologyPromptContext): PromptDoc => {
  // Check if we have TrackedEntity/TrackedEvent in the class hierarchy
  const hasTrackedEntity = A.some(
    ctx.classes,
    (definition) =>
      Str.includes("TrackedEntity")(definition.id) || A.some(definition.broader, Str.includes("TrackedEntity"))
  );
  const hasTrackedEvent = A.some(
    ctx.classes,
    (definition) =>
      Str.includes("TrackedEvent")(definition.id) || A.some(definition.broader, Str.includes("TrackedEvent"))
  );

  // Only show if we have core ontology classes
  if (!hasTrackedEntity && !hasTrackedEvent) {
    return Doc.empty;
  }

  const lines: Array<PromptDoc> = [Doc.text("=== ENTITY TYPE GUIDANCE ==="), Doc.empty];

  if (hasTrackedEntity) {
    lines.push(
      Doc.text("## OBJECTS (TrackedEntity subclasses)"),
      Doc.text("Use for things that EXIST in space: people, organizations, places, documents."),
      Doc.text("Examples: Person, Organization, Location, BoardOrCommission, Department"),
      Doc.empty
    );
  }

  if (hasTrackedEvent) {
    lines.push(
      Doc.text("## EVENTS (TrackedEvent subclasses)"),
      Doc.text("Use for things that OCCUR in time: meetings, announcements, votes, appointments."),
      Doc.text("Examples: Meeting, Announcement, Vote, Appointment, StaffChange"),
      Doc.empty
    );
  }

  lines.push(
    Doc.text("CRITICAL: Choose Object types for 'who/what' entities, Event types for 'what happened'."),
    Doc.empty
  );

  return Doc.vsep(lines);
};

/**
 * Build quick reference section showing allowed values
 * Uses local names instead of full IRIs for token efficiency
 */
const buildQuickReferenceSection = (ruleSet: RuleSet): PromptDoc => {
  const parts = A.empty<PromptDoc>();
  const iris = ruleSet.allowedIris;

  if (A.isReadonlyArrayNonEmpty(iris.classIris)) {
    // Convert to local names for compact display
    const localNames = A.map(iris.classIris, extractLocalNameFromIri);
    parts.push(Doc.text("=== ALLOWED CLASSES ==="), Doc.text(A.join(localNames, ", ")), Doc.empty);
  }

  const allPropertyIris = [...iris.objectPropertyIris, ...iris.datatypePropertyIris];
  if (A.isReadonlyArrayNonEmpty(allPropertyIris)) {
    // Convert to local names for compact display
    const localNames = A.map(allPropertyIris, extractLocalNameFromIri);
    parts.push(Doc.text("=== ALLOWED PROPERTIES ==="), Doc.text(A.join(localNames, ", ")), Doc.empty);
  }

  if (A.isReadonlyArrayNonEmpty(iris.entityIds)) {
    parts.push(Doc.text("=== VALID ENTITY IDs ==="), Doc.text(A.join(iris.entityIds, ", ")), Doc.empty);
  }

  return parts.length > 0 ? Doc.vsep(parts) : Doc.empty;
};

/**
 * Build extraction rules section from RuleSet
 *
 * This is the key integration point - rules are defined once and rendered here.
 */
const buildRulesSection = (ruleSet: RuleSet): PromptDoc => {
  const errorRules = ruleSet.errorRules;
  const warningRules = ruleSet.warningRules;

  const parts = A.empty<PromptDoc>();

  // Critical rules
  if (A.isReadonlyArrayNonEmpty(errorRules)) {
    parts.push(Doc.text("=== EXTRACTION RULES ==="));
    A.forEach(errorRules, (rule, idx) => {
      parts.push(Doc.text(`${idx + 1}. ${rule.instruction}`));
    });
    parts.push(Doc.empty);
  }

  // Local names instruction (always include for entity/relation)
  if (ruleSet.stage !== "mention") {
    parts.push(
      Doc.text("=== CRITICAL: USE LOCAL NAMES ==="),
      Doc.text("Use the short class/property names shown above (e.g., 'Player', 'Team')."),
      Doc.text("Do NOT use full URIs - we will expand them automatically."),
      Doc.text("Example: Use 'Player' NOT 'https://ontology/Player'"),
      Doc.empty
    );
  }

  // Preferences (warnings)
  if (A.isReadonlyArrayNonEmpty(warningRules)) {
    parts.push(Doc.text("=== PREFERENCES ==="));
    A.forEach(warningRules, (rule) => {
      parts.push(Doc.text(`- ${rule.instruction}`));
    });
    parts.push(Doc.empty);
  }

  return Doc.vsep(parts);
};

/**
 * Build output format section
 * Updated to use local names instead of URIs
 */
const buildOutputFormatSection = (stage: "mention" | "entity" | "relation"): PromptDoc => {
  const formatContent =
    stage === "mention"
      ? `Return a JSON object with a "mentions" array. Each mention should have:
- id: snake_case unique identifier
- mention: exact text from source (human-readable name)
- context: brief description of what this entity is based on the text`
      : stage === "entity"
        ? `Return a JSON object with an "entities" array. Each entity should have:
- id: snake_case unique identifier (e.g., "arsenal_fc")
- mention: exact text from source (human-readable name)
- types: array of class names (e.g., ["Player", "Team"]) - use local names, not full URIs
- attributes: object with extracted literal values for this entity. REQUIRED when text contains relevant data.
  Extract ALL available attributes: names, titles, dates, quantities, descriptions, locations mentioned.
  Common attributes: name, title, description, foundedDate, headquarters, role, amount.
  Use {} only if absolutely NO attributes are extractable from the text.
- mentions: array of evidence spans, each with:
  - text: exact quote from source
  - startChar: character offset start (0-indexed)
  - endChar: character offset end (exclusive)
  - confidence: optional extraction confidence (0-1)`
        : `Return a JSON object with a "relations" array. Each relation should have:
- subjectId: entity ID from Stage 1
- predicate: property name (e.g., "playsFor") - use local name, not full URI
- object: entity ID (for object properties) OR literal value (for datatype properties)
- evidence: optional span with text quote, startChar, endChar, confidence for provenance`;

  return Doc.vsep([Doc.text("=== OUTPUT FORMAT ==="), Doc.text(formatContent)]);
};

// =============================================================================
// Few-Shot Example Builders
// =============================================================================

/**
 * Build example messages from scored examples
 *
 * Converts ScoredExample objects into user/assistant message pairs
 * suitable for few-shot prompting.
 *
 * @param examples - Scored examples from retrieval
 * @returns Array of example messages as user/assistant turns
 */
const buildExampleMessages = (examples: ReadonlyArray<ScoredExample>): ReadonlyArray<ExampleMessage> => {
  const messages = A.empty<ExampleMessage>();

  for (const example of examples) {
    // Skip negative examples - they go in system message
    if (example.isNegative) continue;

    // Use pre-formatted prompt messages if available
    if (O.isSome(example.promptMessages) && A.isReadonlyArrayNonEmpty(example.promptMessages.value)) {
      for (const msg of example.promptMessages.value) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push(
            ExampleMessage.make({
              role: msg.role,
              content: msg.content,
            })
          );
        }
      }
    } else {
      // Fall back to input/output format
      messages.push(
        ExampleMessage.make({
          role: "user",
          content: `Extract from: ${example.inputText}`,
        })
      );
      messages.push(
        ExampleMessage.make({
          role: "assistant",
          content: renderUnknownJson(example.expectedOutput),
        })
      );
    }
  }

  return messages;
};

/**
 * Build negative examples section for system message
 *
 * Negative examples warn the model about common extraction mistakes.
 * They are included in the system message as explicit warnings.
 *
 * @param examples - Scored examples (filtered to negatives)
 * @returns Doc section for negative examples, or empty if none
 */
const buildNegativeExamplesSection = (examples: ReadonlyArray<ScoredExample>): PromptDoc => {
  const negatives = A.filter(examples, (example) => example.isNegative);

  if (A.isReadonlyArrayEmpty(negatives)) {
    return Doc.empty;
  }

  const lines: Array<PromptDoc> = [Doc.text("=== EXTRACTION WARNINGS (Avoid These Mistakes) ==="), Doc.empty];

  for (const neg of negatives) {
    const output = NegativeExampleOutput.decodeUnknownOption(neg.expectedOutput);

    lines.push(Doc.text(`❌ DO NOT: ${optionText("Avoid this pattern")(neg.explanation)}`));

    pipe(
      output,
      O.flatMap((value) => value.pattern),
      O.map((pattern) => lines.push(Doc.text(`   Pattern: ${pattern}`)))
    );
    pipe(
      output,
      O.flatMap((value) => value.errorCategory),
      O.map((category) => lines.push(Doc.text(`   Error type: ${category}`)))
    );
    lines.push(Doc.text(`   Example input: "${neg.inputText}"`));
    lines.push(Doc.empty);
  }

  return Doc.vsep(lines);
};

const buildCoreSystemSections = (ruleSet: RuleSet, ctx: OntologyPromptContext): Array<PromptDoc> => {
  const sections = [buildTaskSection(ruleSet.stage), Doc.empty, buildRulesSection(ruleSet)];

  if (ruleSet.stage === "entity") {
    sections.push(Doc.empty, buildDulHierarchySection(ctx));
    sections.push(Doc.empty, buildNamespacePrefixSection(ctx));
    sections.push(Doc.empty, buildQuickReferenceSection(ruleSet));
    sections.push(Doc.empty, buildOntologySection(ctx));
  } else if (ruleSet.stage === "relation") {
    sections.push(Doc.empty, buildEntitiesSection(ctx));
    sections.push(Doc.empty, buildQuickReferenceSection(ruleSet));
    sections.push(Doc.empty, buildPropertiesSection(ctx));
  }

  return sections;
};

// =============================================================================
// Public API
// =============================================================================

/**
 * Generate structured prompt with separate system and user messages
 *
 * **Details**
 *
 * Separates cacheable content (system message) from variable content (user message)
 * to enable prompt caching. System message contains ontology schema, rules, and
 * instructions. User message contains the input text to extract from.
 *
 * **Example** (Usage)
 *
 * ```ts
 * import { generateStructuredPrompt, OntologyPromptContext } from "@effect-ontology/Prompt/PromptGenerator"
 * import { makeMentionRuleSet } from "@effect-ontology/Prompt/RuleSet"
 *
 * const ruleSet = makeMentionRuleSet()
 * const context = OntologyPromptContext.make({ classes: [], objectProperties: [], datatypeProperties: [] })
 * console.log(generateStructuredPrompt("Ada wrote notes.", ruleSet, context).userMessage)
 * ```
 *
 * @param text - Source text to extract from
 * @param ruleSet - Rule set for the extraction stage
 * @param ctx - Ontology context (classes, properties, entities)
 * @returns Structured prompt with system and user messages
 * @category formatting
 * @since 0.0.0
 */
export const generateStructuredPrompt = dual3(
  (text: string, ruleSet: RuleSet, ctx: OntologyPromptContext): StructuredPrompt => {
    const systemSections = buildCoreSystemSections(ruleSet, ctx);

    // Common sections - Output Format closes the instructions
    systemSections.push(Doc.empty, buildOutputFormatSection(ruleSet.stage));

    // Build user message (variable content)
    const userSections = buildInputTextSection(text);

    const systemDoc = Doc.vsep(systemSections);
    return StructuredPrompt.make({
      systemMessage: Doc.render(systemDoc, { style: "pretty", options: { lineWidth: 120 } }),
      userMessage: Doc.render(userSections, { style: "pretty", options: { lineWidth: 120 } }),
    });
  }
);

/**
 * Generate structured prompt with few-shot examples
 *
 * **Details**
 *
 * Extends the base structured prompt with examples retrieved from the
 * ontology-scoped example store. Positive examples become user/assistant
 * conversation turns. Negative examples are included in the system message
 * as explicit warnings.
 *
 * Example message structure:
 * - System: rules, schema, warnings (including negative examples)
 * - Example 1 User: input
 * - Example 1 Assistant: output
 * - Example 2 User: input
 * - Example 2 Assistant: output
 * - User: actual input text
 *
 * **Example** (Usage)
 *
 * ```ts
 * import {
 *   generateStructuredPromptWithExamples,
 *   OntologyPromptContext,
 *   ScoredExample
 * } from "@effect-ontology/Prompt/PromptGenerator"
 * import { makeMentionRuleSet } from "@effect-ontology/Prompt/RuleSet"
 *
 * const ruleSet = makeMentionRuleSet()
 * const context = OntologyPromptContext.make({})
 * const example = ScoredExample.make({ inputText: "Ada", expectedOutput: { mentions: [] } })
 * const prompt = generateStructuredPromptWithExamples("Ada", ruleSet, context, [example])
 * console.log(prompt.exampleMessages.length) // 2
 * ```
 *
 * @param text - Source text to extract from
 * @param ruleSet - Rule set for the extraction stage
 * @param ctx - Ontology context (classes, properties, entities)
 * @param examples - Retrieved few-shot examples (positives and negatives)
 * @returns Structured prompt with system message, example turns, and user message
 * @category formatting
 * @since 0.0.0
 */
export const generateStructuredPromptWithExamples = dual4(
  (
    text: string,
    ruleSet: RuleSet,
    ctx: OntologyPromptContext,
    examples: ReadonlyArray<ScoredExample>
  ): StructuredPromptWithExamples => {
    const systemSections = buildCoreSystemSections(ruleSet, ctx);

    // Add negative examples as warnings in system message
    const negativeSection = buildNegativeExamplesSection(examples);
    const hasNegatives = A.some(examples, (example) => example.isNegative);
    if (hasNegatives) {
      systemSections.push(Doc.empty, negativeSection);
    }

    // Common sections - Output Format closes the instructions
    systemSections.push(Doc.empty, buildOutputFormatSection(ruleSet.stage));

    // Hint about examples if we have any positive ones
    const positiveCount = A.length(A.filter(examples, (example) => !example.isNegative));
    if (positiveCount > 0) {
      systemSections.push(
        Doc.empty,
        Doc.text("=== EXAMPLES ==="),
        Doc.text(`${positiveCount} example(s) follow. Study them carefully before processing the input.`)
      );
    }

    // Build example messages from positive examples
    const exampleMessages = buildExampleMessages(examples);

    // Build user message (variable content)
    const userDoc = buildInputTextSection(text);

    const systemDoc = Doc.vsep(systemSections);

    return StructuredPromptWithExamples.make({
      systemMessage: Doc.render(systemDoc, { style: "pretty", options: { lineWidth: 120 } }),
      userMessage: Doc.render(userDoc, { style: "pretty", options: { lineWidth: 120 } }),
      exampleMessages,
      hasNegativeExamples: hasNegatives,
    });
  }
);

/**
 * Generate structured entity extraction prompt
 *
 * **Details**
 *
 * Convenience wrapper that creates RuleSet internally and returns structured prompt.
 *
 * **Example** (Build an entity prompt without ontology definitions)
 *
 * ```ts
 * import { generateStructuredEntityPrompt } from "@effect-ontology/Prompt/PromptGenerator"
 *
 * console.log(generateStructuredEntityPrompt("Ada wrote notes.", [], []).userMessage.includes("Ada")) // true
 * ```
 *
 * @param text - Source text to extract from
 * @param classes - Available ontology classes
 * @param datatypeProperties - Available datatype properties
 * @returns Structured prompt with system and user messages
 * @category formatting
 * @since 0.0.0
 */
export const generateStructuredEntityPrompt = dual3(
  (
    text: string,
    classes: ReadonlyArray<ClassDefinition>,
    datatypeProperties: ReadonlyArray<PropertyDefinition>
  ): StructuredPrompt => {
    const ruleSet = makeEntityRuleSet(classes, datatypeProperties);

    return generateStructuredPrompt(
      text,
      ruleSet,
      OntologyPromptContext.make({
        classes,
        objectProperties: [],
        datatypeProperties,
      })
    );
  }
);

/**
 * Generate structured relation extraction prompt
 *
 * **Details**
 *
 * Convenience wrapper that creates RuleSet internally and returns structured prompt.
 *
 * **Example** (Build a relation prompt without prior entities)
 *
 * ```ts
 * import { generateStructuredRelationPrompt } from "@effect-ontology/Prompt/PromptGenerator"
 *
 * console.log(generateStructuredRelationPrompt("Ada joined Acme.", [], []).systemMessage.length > 0) // true
 * ```
 *
 * @param text - Source text to extract from
 * @param entities - Entities from Stage 1
 * @param properties - Available properties
 * @returns Structured prompt with system and user messages
 * @category formatting
 * @since 0.0.0
 */
export const generateStructuredRelationPrompt = dual3(
  (text: string, entities: ReadonlyArray<Entity>, properties: ReadonlyArray<PropertyDefinition>): StructuredPrompt => {
    const entityIds = A.map(entities, (entity) => entity.id);
    const ruleSet = makeRelationRuleSet(entityIds, properties);

    const { objectProperties, datatypeProperties } = partitionPropertiesByRangeType(properties);

    return generateStructuredPrompt(
      text,
      ruleSet,
      OntologyPromptContext.make({
        classes: [],
        objectProperties,
        datatypeProperties,
        entityIds: O.some(entityIds),
        entities: O.some(entities),
      })
    );
  }
);

/**
 * Generate structured mention extraction prompt
 *
 * **Details**
 *
 * Convenience wrapper for pre-Stage 1 mention detection.
 *
 * **Example** (Build a structured mention prompt)
 *
 * ```ts
 * import { generateStructuredMentionPrompt } from "@effect-ontology/Prompt/PromptGenerator"
 *
 * console.log(generateStructuredMentionPrompt("Ada wrote notes.").userMessage.includes("Ada")) // true
 * ```
 *
 * @param text - Source text to extract from
 * @returns Structured prompt with system and user messages
 * @category formatting
 * @since 0.0.0
 */
export const generateStructuredMentionPrompt = (text: string): StructuredPrompt => {
  const ruleSet = makeMentionRuleSet();

  return generateStructuredPrompt(
    text,
    ruleSet,
    OntologyPromptContext.make({
      classes: [],
      objectProperties: [],
      datatypeProperties: [],
    })
  );
};

// =============================================================================
// Multimodal Prompt Building (Image Support)
// =============================================================================

/**
 * Get file extension from media type
 */
const getImageExtension = (mediaType: string): string => {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  return pipe(
    map,
    R.get(mediaType),
    O.getOrElse(() => "bin")
  );
};

/**
 * Convert ImageForPrompt[] to Prompt.FilePart[]
 *
 * **Details**
 *
 * Creates FilePart objects suitable for multimodal LLM calls.
 *
 * **Example** (Convert no images)
 *
 * ```ts
 * import { imagesToPromptParts } from "@effect-ontology/Prompt/PromptGenerator"
 *
 * console.log(imagesToPromptParts([]).length) // 0
 * ```
 *
 * @param images - Images to convert
 * @returns Array of Prompt.FilePart objects
 * @category formatting
 * @since 0.0.0
 */
export const imagesToPromptParts = (images: ReadonlyArray<ImageForPrompt>): ReadonlyArray<Prompt.FilePart> =>
  A.map(images, (img, index) =>
    Prompt.makePart("file", {
      mediaType: img.mediaType,
      data: img.base64,
      fileName: `image-${O.getOrElse(img.position, () => index)}.${getImageExtension(img.mediaType)}`,
    })
  );

/**
 * Build multimodal user message content with text and optional images
 *
 * **Details**
 *
 * Creates an array of UserMessagePart objects combining text and image content.
 * Images are appended after the text with optional context.
 *
 * **Example** (Usage)
 *
 * ```ts
 * import { buildMultimodalUserContent } from "@effect-ontology/Prompt/PromptGenerator"
 *
 * const parts = buildMultimodalUserContent(
 *   "Extract entities from this article...",
 *   undefined,
 *   undefined
 * )
 * console.log(parts.length) // 1
 * ```
 *
 * @param text - Text content
 * @param images - Images to include (optional)
 * @param imageIntro - Optional intro text before images
 * @returns Array of UserMessagePart objects for user message content
 * @category factories
 * @since 0.0.0
 */
export const buildMultimodalUserContent = dual3(
  (
    text: string,
    images: ReadonlyArray<ImageForPrompt> | undefined,
    imageIntro: string | undefined
  ): ReadonlyArray<Prompt.UserMessagePart> => {
    const parts: Array<Prompt.UserMessagePart> = [Prompt.makePart("text", { text })];

    const availableImages = O.flatMap(O.fromUndefinedOr(images), A.match({ onEmpty: O.none, onNonEmpty: O.some }));
    if (O.isSome(availableImages)) {
      // Add intro text for images if provided
      if (P.isNotUndefined(imageIntro)) {
        parts.push(Prompt.makePart("text", { text: `\n\n${imageIntro}` }));
      }

      // Add image parts with context annotations
      for (const img of availableImages.value) {
        // Build context string from available metadata
        const contextParts = A.getSomes([img.alt, img.caption, img.context]);
        const position = O.getOrElse(img.position, () => 0);
        if (contextParts.length > 0) {
          parts.push(
            Prompt.makePart("text", {
              text: `\n[Image ${position}: ${A.join(contextParts, " - ")}]`,
            })
          );
        }

        parts.push(
          Prompt.makePart("file", {
            mediaType: img.mediaType,
            data: img.base64,
            fileName: `image-${position}.${getImageExtension(img.mediaType)}`,
          })
        );
      }
    }

    return parts;
  }
);

/**
 * Build a complete multimodal Prompt object
 *
 * **Details**
 *
 * Creates a Prompt with system message and user message containing
 * both text and image content for multimodal extraction.
 *
 * **Example** (Usage)
 *
 * ```ts
 * import { buildMultimodalPrompt } from "@effect-ontology/Prompt/PromptGenerator"
 *
 * const prompt = buildMultimodalPrompt(
 *   "Extract named entities.",
 *   "Ada wrote notes.",
 *   undefined,
 *   undefined
 * )
 * console.log(prompt)
 * ```
 *
 * @param systemMessage - System instructions (cacheable)
 * @param userText - User text content
 * @param images - Images to include (optional)
 * @param imageIntro - Optional intro text before images
 * @returns Complete Prompt object for LLM call
 * @category factories
 * @since 0.0.0
 */
export const buildMultimodalPrompt = dual4(
  (
    systemMessage: string,
    userText: string,
    images: ReadonlyArray<ImageForPrompt> | undefined,
    imageIntro: string | undefined
  ): Prompt.Prompt => {
    const userParts = buildMultimodalUserContent(userText, images, imageIntro);

    return Prompt.fromMessages([
      Prompt.makeMessage("system", {
        content: systemMessage,
      }),
      Prompt.makeMessage("user", {
        content: userParts,
      }),
    ]);
  }
);

/**
 * Build multimodal prompt from StructuredPrompt and context
 *
 * **Details**
 *
 * Convenience wrapper that extracts images from OntologyPromptContext
 * and builds a multimodal Prompt.
 *
 * **Example** (Usage)
 *
 * ```ts
 * import { buildPromptFromStructured, StructuredPrompt } from "@effect-ontology/Prompt/PromptGenerator"
 *
 * const structured = StructuredPrompt.make({
 *   systemMessage: "Extract named entities.",
 *   userMessage: "Ada wrote notes."
 * })
 * const prompt = buildPromptFromStructured(structured, undefined)
 * console.log(prompt)
 * ```
 *
 * @param structured - Structured prompt with system and user messages
 * @param ctx - Ontology context with optional imageContexts
 * @returns Complete Prompt object for LLM call
 * @category factories
 * @since 0.0.0
 */
export const buildPromptFromStructured = dual2(
  (structured: StructuredPrompt, ctx: OntologyPromptContext | undefined): Prompt.Prompt => {
    const images = pipe(
      O.fromNullishOr(ctx),
      O.flatMap((context) => context.imageContexts),
      O.getOrUndefined
    );
    return buildMultimodalPrompt(
      structured.systemMessage,
      structured.userMessage,
      images,
      Bool.match(images !== undefined && A.isReadonlyArrayNonEmpty(images), {
        onFalse: () => undefined,
        onTrue: () => "Relevant images from the document:",
      })
    );
  }
);
