/**
 * The lint rule model: the context handed to every rule, the public
 * rule interface, the severity vocabulary and the lint diagnostic.
 *
 * **Details**
 *
 * Cycle firewall: built-in rules must construct `YamlLintDiagnostic` while the
 * facade must import the built-in catalog — one module owning both would close the cycle
 * `YamlLint → rules → YamlLint` (`noImportCycles` is error-level). So the
 * model lives here, `src/internal/rules/*` import it, and `YamlLint.ts`
 * (config + facade) imports both. Nothing imports this module back.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $YamlId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { YamlDocument } from "./YamlDocument.ts";
import { YamlEdit } from "./YamlEdit.ts";
import { YamlToken } from "./YamlToken.ts";

const $I = $YamlId.create("YamlLintRule");

/**
 * **Example** (Decode a reporting severity)
 *
 * ```ts
 * import { YamlLintSeverity } from "@beep/yaml/YamlLintRule"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(YamlLintSeverity)("warning")) // warning
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const YamlLintSeverity = LiteralKit(["error", "warning"]).pipe(
  $I.annoteSchema("YamlLintSeverity", {
    description:
      'Lint diagnostic severities. `"off"` is a config-level disable only and never reaches a diagnostic — a rule set to `"off"` is not run.',
  })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlLintSeverity = typeof YamlLintSeverity.Type;

/**
 * **Details**
 *
 * Deliberately separate from the engine's `YamlDiagnostic`: that type is the
 * lexer/parser/composer/stringifier error-code union and the single source
 * of truth for engine fatality — it carries no severity and no fix, and
 * lint-layer concerns must not pollute it. The `parse-validity` rule bridges
 * the two by mapping engine diagnostics into this shape.
 *
 * **Example** (Construct a positioned lint finding)
 *
 * ```ts
 * import { YamlLintDiagnostic } from "@beep/yaml/YamlLintRule"
 *
 * const diagnostic = YamlLintDiagnostic.make({
 *   rule: "trailing-spaces",
 *   severity: "warning",
 *   message: "Remove trailing spaces",
 *   offset: 8,
 *   length: 2,
 *   line: 0,
 *   character: 8
 * })
 *
 * console.log(diagnostic.message) // Remove trailing spaces
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlLintDiagnostic extends S.Opaque<YamlLintDiagnostic, { readonly brand: unique symbol }>()(
  S.Struct({
    rule: S.String.pipe(
      $I.annoteKey("YamlLintDiagnostic.rule", { description: "Identifier of the lint rule reporting the finding" })
    ),
    severity: YamlLintSeverity.pipe(
      $I.annoteKey("YamlLintDiagnostic.severity", {
        description: "Effective reporting level, either `error` or `warning`; disabled rules produce no findings",
      })
    ),
    message: S.String.pipe(
      $I.annoteKey("YamlLintDiagnostic.message", {
        description: "Human-readable explanation of the reported lint finding",
      })
    ),
    offset: S.Finite.pipe(
      $I.annoteKey("YamlLintDiagnostic.offset", {
        description: "Zero-based UTF-16 source offset where the reported span begins",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("YamlLintDiagnostic.length", {
        description: "Length of the reported source span in UTF-16 code units",
      })
    ),
    line: S.Finite.pipe(
      $I.annoteKey("YamlLintDiagnostic.line", { description: "Zero-based source line where the reported span begins" })
    ),
    character: S.Finite.pipe(
      $I.annoteKey("YamlLintDiagnostic.character", {
        description: "Zero-based UTF-16 column where the reported span begins",
      })
    ),
    fix: S.optionalKey(YamlEdit).pipe(
      $I.annoteKey("YamlLintDiagnostic.fix", {
        description: "Optional source replacement supplied by the rule to repair the finding",
      })
    ),
  }).pipe(
    $I.annoteSchema("YamlLintDiagnostic", {
      description:
        "A single lint finding: the reporting rule, its severity, a positioned span and optionally a surgical fix.",
    })
  )
) {}

/**
 * One source line of the linted document: its text (without the line
 * terminator — `\n`, lone `\r`, or the `\r\n` pair), the offset of
 * its first character, and its zero-based line number.
 *
 * **Example** (Validate a positioned source line)
 *
 * ```ts
 * import { LintLine } from "@beep/yaml/YamlLintRule";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(LintLine)({ text: "a: 1", offset: 0, number: 0 })); // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LintLine extends S.Opaque<LintLine, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String.pipe(
      $I.annoteKey("LintLine.text", { description: "Source line text excluding its LF, CR, or CRLF terminator" })
    ),
    offset: S.Finite.pipe(
      $I.annoteKey("LintLine.offset", { description: "Zero-based UTF-16 source offset of the line's first character" })
    ),
    number: S.Finite.pipe($I.annoteKey("LintLine.number", { description: "Zero-based source line number" })),
  }).pipe($I.annoteSchema("LintLine", { description: "A positioned source line without its line terminator" }))
) {}

/**
 * The context handed to every rule.
 *
 * **Details**
 *
 * The engine tokenizes ONCE and every rule
 * shares the one materialized `tokens` array — linting is inherently
 * multi-pass and random-access (layout rules need lookahead and lookbehind),
 * so the context is eager by nature; the streaming token form exists for
 * other consumers.
 *
 * `text`, `lines` and `tokens` cover the FULL source; `document` is the
 * FIRST document of the stream (matching `Yaml.parse` — split the stream
 * `Yaml.parseAll`-style to lint every document). It is always present,
 * including for input that does not parse: it is built from the engine's
 * recovered compose, and its `errors`/`warnings` carry what went wrong (the
 * `parse-validity` rule reports them).
 *
 * **Example** (Validate the shared lint context)
 *
 * ```ts
 * import type { YamlLintDiagnostic } from "@beep/yaml/YamlLintRule";
 * import { LintContext, YamlRule } from "@beep/yaml/YamlLintRule";
 * import { YamlLint, YamlLintConfig } from "@beep/yaml/YamlLint";
 * import { dual } from "effect/Function";
 * import * as S from "effect/Schema";
 *
 * const probe = YamlRule.make({ id: "context", check: dual(2, (ctx: LintContext, _options: unknown): Iterable<YamlLintDiagnostic> => {
 *   console.log(S.is(LintContext)(ctx)); // true
 *   return [];
 * }) });
 * YamlLint.run("a: 1\n", [probe], YamlLintConfig.make({ rules: { context: "error" } }));
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LintContext extends S.Opaque<LintContext, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String.pipe($I.annoteKey("LintContext.text", { description: "Complete original YAML source text" })),
    lines: S.Array(LintLine).pipe(
      $I.annoteKey("LintContext.lines", { description: "Positioned source lines covering the complete stream" })
    ),
    tokens: S.Array(YamlToken).pipe(
      $I.annoteKey("LintContext.tokens", { description: "Materialized positioned tokens shared by every lint rule" })
    ),
    document: YamlDocument.pipe(
      $I.annoteKey("LintContext.document", {
        description: "Recovered first document, including parse errors and warnings",
      })
    ),
  }).pipe(
    $I.annoteSchema("LintContext", {
      description: "Shared eager lint input with source, positioned lines, tokens, and the recovered first document",
    })
  )
) {}

/**
 * **Details**
 *
 * The `dimension` IS the rule's option key and the `value` IS that option's
 * value (`"double"` for `quoteType`, `2` for `spaces`, `false` for
 * `present`), so the inference resolvers can turn unanimous or dominant
 * votes into a config entry with no per-rule knowledge — which is what lets
 * custom rules participate in inference for free. The position points at the
 * occurrence that voted, so a strict-resolution conflict can name where each
 * spelling was seen.
 *
 * The `_tag` literal is the RUNTIME discriminator between the two
 * observation kinds: class instances are structurally assignable, so a
 * custom rule may yield a plain object shaped like a vote, and the evidence
 * builder must still sort it into the right tally without `instanceof`.
 * `.make` defaults it — construction sites never pass `_tag`.
 *
 * **Example** (Record an indentation style vote)
 *
 * ```ts
 * import { StyleVote } from "@beep/yaml/YamlLintRule"
 *
 * const vote = StyleVote.make({
 *   dimension: "spaces",
 *   value: 2,
 *   offset: 9,
 *   length: 2,
 *   line: 1,
 *   character: 0
 * })
 *
 * console.log(vote.value) // 2
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class StyleVote extends S.Opaque<StyleVote, { readonly brand: unique symbol }>()(
  S.TaggedStruct("StyleVote", {
    dimension: S.String.pipe(
      $I.annoteKey("StyleVote.dimension", {
        description:
          "Rule option key supported by this source observation, such as `quoteType`, `spaces`, or `present`",
      })
    ),
    value: S.Union([S.String, S.Finite, S.Boolean]).pipe(
      $I.annoteKey("StyleVote.value", {
        description: "Option choice supported by this source occurrence, used when resolving inferred configuration",
      })
    ),
    offset: S.Finite.pipe(
      $I.annoteKey("StyleVote.offset", {
        description: "Zero-based UTF-16 source offset of the occurrence supporting this option choice",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("StyleVote.length", {
        description: "Source span length in UTF-16 code units of the occurrence supporting this option choice",
      })
    ),
    line: S.Finite.pipe(
      $I.annoteKey("StyleVote.line", {
        description: "Zero-based source line of the occurrence supporting this option choice",
      })
    ),
    character: S.Finite.pipe(
      $I.annoteKey("StyleVote.character", {
        description: "Zero-based UTF-16 column of the occurrence supporting this option choice",
      })
    ),
  }).pipe(
    $I.annoteSchema("StyleVote", {
      description:
        "One categorical style observation: a single occurrence of a style choice in the source, voting a `value` for an inference `dimension`.",
    })
  )
) {}

/**
 * **Details**
 *
 * The `_tag` literal discriminates a floor from a {@link StyleVote} at
 * runtime (see there); `.make` defaults it.
 *
 * **Gotchas**
 *
 * Floors are carried in the evidence for callers that want them and are
 * never resolved into config options; fabricating a max from the largest
 * value one happened to see would be lying with a straight face.
 *
 * **Example** (Record a measured line length floor)
 *
 * ```ts
 * import { StyleFloor } from "@beep/yaml/YamlLintRule"
 *
 * const floor = StyleFloor.make({ dimension: "max", value: 80 })
 *
 * console.log(floor.value) // 80
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class StyleFloor extends S.Opaque<StyleFloor, { readonly brand: unique symbol }>()(
  S.TaggedStruct("StyleFloor", {
    dimension: S.String.pipe(
      $I.annoteKey("StyleFloor.dimension", {
        description: "Rule option key for which the source establishes a measured lower bound",
      })
    ),
    value: S.Finite.pipe(
      $I.annoteKey("StyleFloor.value", {
        description:
          "Measured lower bound established by the source, such as longest line length; never resolved into a configured limit",
      })
    ),
  }).pipe(
    $I.annoteSchema("StyleFloor", {
      description:
        "One measured style floor: a value the source PROVES is at least `value`, without proving what the configured limit should be — the longest observed line proves `line-length.max` is at least that long, not what it is. Floors are carried in the evidence for callers that want them and are never resolved into config options; fabricating a max from the largest value one happened to see would be lying with a straight face.",
    })
  )
) {}

/**
 * What a rule's `infer` hook yields per occurrence: a categorical
 * {@link StyleVote} or a measured {@link StyleFloor}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type StyleObservation = StyleVote | StyleFloor;

type RuleCheck = {
  (ctx: LintContext, options: unknown): Iterable<YamlLintDiagnostic>;
  (options: unknown): (ctx: LintContext) => Iterable<YamlLintDiagnostic>;
};

type RuleInfer = (ctx: LintContext) => Iterable<StyleObservation>;

const RuleCheck = S.declare((u: unknown): u is RuleCheck => P.isFunction(u)).pipe(
  $I.annoteSchema("YamlRule.Check", { description: "A rule's dual check function." })
);

const RuleInfer = S.declare((u: unknown): u is RuleInfer => P.isFunction(u)).pipe(
  $I.annoteSchema("YamlRule.Infer", { description: "A rule's optional style-inference hook." })
);

/**
 * The public rule model — built-ins and custom rules are the same
 * shape, and config references either by `id`; there is no privileged
 * built-in mechanism a custom rule cannot reach.
 *
 * **Details**
 *
 * `options` is the validated per-rule options object from the config entry
 * (or `undefined` when the entry was a bare severity literal); built-in
 * rules receive options already validated against their exported options
 * schema, custom rules validate their own.
 *
 * `infer` is the optional config-inference hook: it reports the style
 * the source already follows as per-occurrence {@link StyleObservation}s, so
 * detection logic lives beside the check logic that polices the same
 * dimension (and shares its fixtures). Rules with no detectable style — the
 * policy rules, whose only evidence is violations — simply omit the hook and
 * stay default-driven under every resolver.
 *
 * **Example** (Define a custom rule)
 *
 * ```ts
 * import { YamlLint, YamlLintConfig } from "@beep/yaml/YamlLint"
 * import { YamlRule } from "@beep/yaml/YamlLintRule"
 * import type { LintContext, YamlLintDiagnostic } from "@beep/yaml/YamlLintRule"
 * import { dual } from "effect/Function"
 *
 * const silent = YamlRule.make({
 *   id: "silent",
 *   check: dual(2, (_ctx: LintContext, _options: unknown): Iterable<YamlLintDiagnostic> => []),
 * })
 * console.log(YamlLint.run("a: 1\n", [silent], YamlLintConfig.make({ rules: { silent: "error" } })).length) // 0
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlRule extends S.Opaque<YamlRule, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.pipe(
      $I.annoteKey("YamlRule.id", { description: "Rule identifier that lint configuration entries reference" })
    ),
    check: RuleCheck.pipe(
      $I.annoteKey("YamlRule.check", {
        description: "Dual check function yielding the rule's diagnostics for a lint context and its options",
      })
    ),
    infer: S.optionalKey(RuleInfer).pipe(
      $I.annoteKey("YamlRule.infer", {
        description: "Optional config-inference hook reporting the style observations the source already follows",
      })
    ),
  }).pipe(
    $I.annoteSchema("YamlRule", {
      description:
        "A lint rule: its config-facing `id`, the dual `check` that reports diagnostics, and the optional `infer` hook that reports style observations. Built-in and custom rules share this one shape.",
    })
  )
) {}
