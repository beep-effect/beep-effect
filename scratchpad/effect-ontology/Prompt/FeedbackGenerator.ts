/**
 * Converts Effect v4 schema failures into rule-aware feedback and retry prompts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { pipe } from "effect";
import * as A from "effect/Array";
import * as Formatter from "effect/Formatter";
import * as HashSet from "effect/HashSet";
import * as Inspectable from "effect/Inspectable";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as Str from "effect/String";
import { dual2 } from "../Utils/Dual.ts";
import type { ExtractionRule, RuleCategory } from "./ExtractionRule.ts";
import type { RuleSet } from "./RuleSet.ts";

const $I = $ScratchpadId.create("effect-ontology/Prompt/FeedbackGenerator");

/** Internal plain-text document assembled before feedback rendering. */
type PromptDoc = string;
const Doc = {
  empty: "",
  text: (value: string): PromptDoc => value,
  vsep: (documents: ReadonlyArray<PromptDoc>): PromptDoc => A.join(documents, "\n"),
  render: (document: PromptDoc, _options?: unknown): string => document,
};

const formatStandardIssue = SchemaIssue.makeFormatterStandardSchemaV1();
const formatIssue = SchemaIssue.makeFormatterDefault();

/**
 * One flattened Effect Schema violation with its formatted path and optional
 * reported input.
 *
 * **Example** (Create a root violation)
 *
 * ```ts
 * import { Violation } from "@effect-ontology/Prompt/FeedbackGenerator.ts"
 *
 * const violation = Violation.make({ path: "root", message: "Expected string" })
 * console.log(violation.path) // "root"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Violation extends S.Class<Violation>($I`Violation`)(
  {
    /** Formatted path to the rejected field or collection element. */
    path: S.NonEmptyString.pipe(
      $I.annoteKey("Violation.path", {
        description: "Formatted path to the rejected field or collection element.",
      })
    ),
    /** Human-readable message produced by the Effect Schema formatter. */
    message: S.NonEmptyString.pipe(
      $I.annoteKey("Violation.message", {
        description: "Human-readable message produced by the Effect Schema formatter.",
      })
    ),
    /** Optional rejected input retained when schema decoding enabled input reporting. */
    actual: S.Unknown.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("Violation.actual", {
        description: "Optional rejected input retained when schema decoding enabled input reporting.",
      })
    ),
  },
  $I.annote("Violation", {
    description: "Flattened Effect Schema violation used by extraction feedback.",
  })
) {}

/**
 * Flattens an Effect v4 `SchemaError` into deterministic path/message records.
 *
 * **Details**
 *
 * The standard formatter preserves the complete schema issue tree and its paths.
 * Actual input remains absent unless a caller separately retained it.
 *
 * **Example** (Extract one violation)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import { extractViolations } from "@effect-ontology/Prompt/FeedbackGenerator.ts"
 *
 * const result = S.decodeUnknownResult(S.Struct({ name: S.String }))({ name: 1 })
 * if (Result.isFailure(result)) console.log(extractViolations(result.failure).length) // 1
 * ```
 *
 * @param error - Effect v4 schema decoding or encoding failure.
 * @returns Flattened violations in formatter order.
 * @category destructors
 * @since 0.0.0
 */
export const extractViolations = (error: S.SchemaError): ReadonlyArray<Violation> =>
  A.map(formatStandardIssue(error.issue).issues, (issue) =>
    Violation.make({
      path:
        issue.path === undefined
          ? "root"
          : A.join(
              A.map(issue.path, (segment) => Formatter.format(segment)),
              "."
            ),
      message: issue.message,
    })
  );

const pathMatchers: ReadonlyArray<{ readonly pattern: string; readonly category: RuleCategory }> = [
  { pattern: ".id", category: "id_format" },
  { pattern: "id]", category: "id_format" },
  { pattern: ".types", category: "type_mapping" },
  { pattern: "types]", category: "type_mapping" },
  { pattern: ".predicate", category: "property_usage" },
  { pattern: ".subjectid", category: "reference_integrity" },
  { pattern: ".object", category: "property_usage" },
  { pattern: ".mention", category: "mention_format" },
  { pattern: ".attributes", category: "property_usage" },
];

const firstRuleInCategory = (ruleSet: RuleSet, category: RuleCategory): O.Option<ExtractionRule> =>
  A.head(ruleSet.getRulesByCategory(category));

/**
 * Correlates a flattened violation with the most specific extraction rule that
 * can explain it.
 *
 * **Example** (Match an identifier violation)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { findMatchingRule, Violation } from "@effect-ontology/Prompt/FeedbackGenerator.ts"
 * import { makeMentionRuleSet } from "@effect-ontology/Prompt/RuleSet.ts"
 *
 * const violation = Violation.make({ path: "mentions[0].id", message: "Invalid value" })
 * console.log(O.isSome(findMatchingRule(violation, makeMentionRuleSet()))) // true
 * ```
 *
 * @param violation - Flattened schema violation to correlate.
 * @param ruleSet - Extraction rules available for feedback.
 * @returns The first matching rule, preferring field-path evidence.
 * @category getters
 * @since 0.0.0
 */
export const findMatchingRule = dual2((violation: Violation, ruleSet: RuleSet): O.Option<ExtractionRule> => {
  const path = Str.toLowerCase(violation.path);
  const message = Str.toLowerCase(violation.message);
  const pathRule = pipe(
    A.findFirst(pathMatchers, (matcher) => Str.includes(matcher.pattern)(path)),
    O.flatMap((matcher) => firstRuleInCategory(ruleSet, matcher.category))
  );
  const messageRule = pipe(
    [
      { matches: Str.includes("casing")(message) || Str.includes("case")(message), category: "iri_casing" },
      { matches: Str.includes("snake")(message) || Str.includes("lowercase")(message), category: "id_format" },
    ] as const,
    A.findFirst((matcher) => matcher.matches),
    O.flatMap((matcher) => firstRuleInCategory(ruleSet, matcher.category))
  );
  return O.orElse(pathRule, () => messageRule);
});

/**
 * Replaces named placeholders with safely rendered values while leaving unknown
 * placeholders intact.
 *
 * **Example** (Interpolate a rejected value)
 *
 * ```ts
 * import { interpolate } from "@effect-ontology/Prompt/FeedbackGenerator.ts"
 *
 * console.log(interpolate("Invalid {value}", { value: "Ada" })) // 'Invalid "Ada"'
 * ```
 *
 * @param template - Message containing brace-delimited placeholder names.
 * @param values - Values keyed by placeholder name.
 * @returns Template with every supplied placeholder replaced.
 * @category formatting
 * @since 0.0.0
 */
export const interpolate = dual2((template: string, values: Readonly<Record<string, unknown>>): string =>
  pipe(
    R.toEntries(values),
    A.reduce(template, (message, [key, value]) =>
      pipe(message, Str.replaceAll(`{${key}}`, Inspectable.toStringUnknown(value, 0)))
    )
  )
);

/**
 * Produces concise rule-aware feedback for an Effect v4 schema failure.
 *
 * **Example** (Render validation feedback)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import { generateFeedback } from "@effect-ontology/Prompt/FeedbackGenerator.ts"
 * import { makeMentionRuleSet } from "@effect-ontology/Prompt/RuleSet.ts"
 *
 * const result = S.decodeUnknownResult(S.Struct({ id: S.String }))({ id: 1 })
 * if (Result.isFailure(result)) console.log(generateFeedback(result.failure, makeMentionRuleSet()))
 * ```
 *
 * @param error - Effect v4 schema failure to explain.
 * @param ruleSet - Rules used to specialize feedback.
 * @returns Newline-delimited actionable validation feedback.
 * @category error-handling
 * @since 0.0.0
 */
export const generateFeedback = dual2((error: S.SchemaError, ruleSet: RuleSet): string =>
  pipe(
    extractViolations(error),
    A.match({
      onEmpty: () => "Validation failed. Please check the output format.",
      onNonEmpty: (violations) =>
        pipe(
          violations,
          A.map((violation) =>
            pipe(
              findMatchingRule(violation, ruleSet),
              O.flatMap((rule) =>
                O.map(violation.actual, (actual) => interpolate(rule.validationTemplate, { value: actual }))
              ),
              O.getOrElse(() => `Error at ${violation.path}: ${violation.message}`)
            )
          ),
          A.join("\n")
        ),
    })
  )
);

const buildRuleReminders = (error: S.SchemaError, ruleSet: RuleSet): PromptDoc => {
  const matchedRuleIds = pipe(
    extractViolations(error),
    A.flatMap((violation) =>
      pipe(
        findMatchingRule(violation, ruleSet),
        O.map((rule) => rule.id),
        O.toArray
      )
    ),
    HashSet.fromIterable
  );
  const reminders = pipe(
    ruleSet.allRules,
    A.filter((rule) => HashSet.has(matchedRuleIds, rule.id)),
    A.map((rule) => Doc.text(`• ${rule.instruction}`))
  );
  return pipe(
    reminders,
    A.match({
      onEmpty: () => Doc.empty,
      onNonEmpty: (items) => Doc.vsep([Doc.empty, Doc.text("Remember these rules:"), ...items]),
    })
  );
};

/**
 * Renders the complete Effect Schema issue tree followed by applicable rule
 * reminders.
 *
 * **Example** (Render a schema issue tree)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import { generateTreeFeedback } from "@effect-ontology/Prompt/FeedbackGenerator.ts"
 * import { makeMentionRuleSet } from "@effect-ontology/Prompt/RuleSet.ts"
 *
 * const result = S.decodeUnknownResult(S.Struct({ id: S.String }))({ id: 1 })
 * if (Result.isFailure(result)) console.log(generateTreeFeedback(result.failure, makeMentionRuleSet()))
 * ```
 *
 * @param error - Effect v4 schema failure to render.
 * @param ruleSet - Rules used to append relevant reminders.
 * @returns Hierarchical validation feedback.
 * @category error-handling
 * @since 0.0.0
 */
export const generateTreeFeedback = dual2((error: S.SchemaError, ruleSet: RuleSet): string =>
  Doc.render(
    Doc.vsep([
      Doc.text("Validation Errors:"),
      Doc.empty,
      Doc.text(formatIssue(error.issue)),
      buildRuleReminders(error, ruleSet),
    ])
  )
);

/**
 * Builds the corrective instruction sent with a retry after schema validation
 * fails.
 *
 * **Example** (Build a retry instruction)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import { generateImprovementPrompt } from "@effect-ontology/Prompt/FeedbackGenerator.ts"
 * import { makeMentionRuleSet } from "@effect-ontology/Prompt/RuleSet.ts"
 *
 * const result = S.decodeUnknownResult(S.String)(1)
 * if (Result.isFailure(result)) console.log(generateImprovementPrompt(result.failure, makeMentionRuleSet()))
 * ```
 *
 * @param error - Effect v4 schema failure from the previous attempt.
 * @param ruleSet - Rules used to specialize corrective reminders.
 * @returns Prompt instructing the model to repair every reported violation.
 * @category formatting
 * @since 0.0.0
 */
export const generateImprovementPrompt = dual2((error: S.SchemaError, ruleSet: RuleSet): string =>
  Doc.render(
    Doc.vsep([
      Doc.text("Your previous output had validation errors:"),
      Doc.empty,
      Doc.text(generateTreeFeedback(error, ruleSet)),
      Doc.empty,
      Doc.text("Please correct these issues. The tree above shows:"),
      Doc.text("• The path to each error (for example, [entities][0][types])"),
      Doc.text("• What was expected versus what was received"),
      Doc.empty,
      Doc.text("Generate a corrected output that fixes all validation errors."),
    ])
  )
);

const retryablePatterns = [/casing/i, /format/i, /invalid.*value/i, /expected.*got/i, /must be/i, /should be/i];
const structuralPatterns = [/missing.*required/i, /unknown.*property/i, /undefined/i];
const matchesAny = (message: string, patterns: ReadonlyArray<RegExp>): boolean =>
  A.some(patterns, (pattern) => O.isSome(Str.match(pattern)(message)));

/**
 * Classifies whether validation feedback describes a model-correctable format or
 * value problem rather than a structural contract mismatch.
 *
 * **Example** (Classify a value mismatch)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import { isRetryable } from "@effect-ontology/Prompt/FeedbackGenerator.ts"
 *
 * const result = S.decodeUnknownResult(S.Literal("valid"))("invalid")
 * if (Result.isFailure(result)) console.log(isRetryable(result.failure))
 * ```
 *
 * @param error - Effect v4 schema failure to classify.
 * @returns `true` when at least half of violations look correctable and none are structural.
 * @category predicates
 * @since 0.0.0
 */
export const isRetryable = (error: S.SchemaError): boolean => {
  const violations = extractViolations(error);
  return (
    A.isReadonlyArrayNonEmpty(violations) &&
    !A.some(violations, (violation) => matchesAny(violation.message, structuralPatterns)) &&
    A.length(A.filter(violations, (violation: Violation) => matchesAny(violation.message, retryablePatterns))) >=
      A.length(violations) * 0.5
  );
};
