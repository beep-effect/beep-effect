/**
 * Lint rule model: context, severity, diagnostics, style observations and the
 * public rule interface.
 *
 * Built-in rules construct {@link YamlLintDiagnostic} while the facade imports
 * the catalog, so this model lives here to break `YamlLint → rules → YamlLint`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Schema } from "effect";
import type { YamlDocument } from "./YamlDocument.ts";
import { YamlEdit } from "./YamlEdit.ts";
import type { YamlToken } from "./YamlToken.ts";

const $I = $ScratchpadId.create("yaml/YamlLintRule");

/**
 * Lint diagnostic severities. `"off"` is a config-level disable only and
 * never reaches a diagnostic — a rule set to `"off"` is not run.
 *
 * **Example** (Severity literals never include off)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { YamlLintSeverity } from "@beep/scratchpad/yaml"
 *
 * console.log(S.is(YamlLintSeverity)("error")) // true
 * console.log(S.is(YamlLintSeverity)("off")) // false
 * ```
 *
 * @see {@link YamlLintDiagnostic} for the finding that carries one of these severities.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const YamlLintSeverity = Schema.Literals(["error", "warning"]).pipe(
	$I.annoteSchema("YamlLintSeverity", {
		description: "Lint diagnostic severities. Off is config-only and never appears on a diagnostic.",
	}),
);

/**
 * Decoded literal union produced by {@link YamlLintSeverity}.
 *
 * @see {@link YamlLintSeverity} for the runtime schema and decoding behavior.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlLintSeverity = typeof YamlLintSeverity.Type;

/**
 * A single lint finding: the reporting rule, its severity, a positioned span
 * and optionally a surgical fix.
 *
 * Deliberately separate from the engine's `YamlDiagnostic`: that type is the
 * lexer/parser/composer/stringifier error-code union and the single source
 * of truth for engine fatality — it carries no severity and no fix, and
 * lint-layer concerns must not pollute it. The `parse-validity` rule bridges
 * the two by mapping engine diagnostics into this shape.
 *
 * **Gotchas**
 *
 * This is not {@link YamlDiagnostic}: it has no engine fatality predicate and
 * it carries severity plus an optional surgical fix. `"off"` never reaches a
 * diagnostic — a rule set to `"off"` is not run.
 *
 * **Example** (Make a lint finding)
 *
 * ```ts
 * import { YamlLintDiagnostic } from "@beep/scratchpad/yaml"
 *
 * const finding = YamlLintDiagnostic.make({
 *   rule: "trailing-spaces",
 *   severity: "error",
 *   message: "Trailing whitespace",
 *   offset: 4,
 *   length: 1,
 *   line: 0,
 *   character: 4,
 * })
 *
 * console.log(finding.rule) // "trailing-spaces"
 * console.log(finding.severity) // "error"
 * ```
 *
 * @see {@link YamlDiagnostic} for the engine diagnostic this type deliberately does not extend.
 * @public
 * @category diagnostics
 * @since 0.0.0
 */
export class YamlLintDiagnostic extends Schema.Class<YamlLintDiagnostic>("YamlLintDiagnostic")(
	{
		rule: Schema.String,
		severity: YamlLintSeverity,
		message: Schema.String,
		offset: Schema.Number,
		length: Schema.Number,
		line: Schema.Number,
		character: Schema.Number,
		fix: Schema.optionalKey(YamlEdit),
	},
	$I.annote("YamlLintDiagnostic", {
		description: "A lint finding with severity and an optional surgical fix, distinct from engine diagnostics.",
	}),
) {}

/**
 * One source line of the linted document: its text (without the line
 * terminator — the `\n`, and for CRLF input the `\r\n` pair), the offset of
 * its first character, and its zero-based line number.
 *
 * @see {@link LintContext} for the rule context that materializes these lines.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface LintLine {
	readonly text: string;
	readonly offset: number;
	readonly number: number;
}

/**
 * The context handed to every rule. The engine tokenizes ONCE and every rule
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
 * **Details**
 *
 * `text`, `lines` and `tokens` cover the FULL source; `document` is the FIRST
 * document of the stream only (matching {@link Yaml.parse}). It is always
 * present, including for unparseable input.
 *
 * @see {@link YamlLint.run} for the facade that builds this context once per run.
 * @see {@link YamlDocument} for the recovered first document stored on `document`.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface LintContext {
	readonly text: string;
	readonly lines: ReadonlyArray<LintLine>;
	readonly tokens: ReadonlyArray<YamlToken>;
	readonly document: YamlDocument;
}

/**
 * One categorical style observation (#345): a single occurrence of a style
 * choice in the source, voting a `value` for an inference `dimension`.
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
 * **Gotchas**
 *
 * Class instances are structurally assignable to plain objects, so evidence
 * must branch on `_tag`, never `instanceof`.
 *
 * **Example** (Make a quote-style vote)
 *
 * ```ts
 * import { StyleVote } from "@beep/scratchpad/yaml"
 *
 * const vote = StyleVote.make({
 *   dimension: "quoteType",
 *   value: "double",
 *   offset: 3,
 *   length: 5,
 *   line: 0,
 *   character: 3,
 * })
 *
 * console.log(vote._tag) // "StyleVote"
 * console.log(vote.value) // "double"
 * ```
 *
 * @see {@link YamlDiagnostic} for engine diagnostics, which this observation is not.
 * @see {@link StyleEvidence.fromObservations} for the tally builder that branches on `_tag`.
 * @public
 * @category models
 * @since 0.0.0
 */
export class StyleVote extends Schema.TaggedClass<StyleVote>()(
	"StyleVote",
	{
		dimension: Schema.String,
		value: Schema.Union([Schema.String, Schema.Number, Schema.Boolean]),
		offset: Schema.Number,
		length: Schema.Number,
		line: Schema.Number,
		character: Schema.Number,
	},
	$I.annote("StyleVote", {
		description: "One categorical style observation voting a value for an inference dimension.",
	}),
) {}

/**
 * One measured style floor (#345): a value the source PROVES is at least
 * `value`, without proving what the configured limit should be — the longest
 * observed line proves `line-length.max` is at least that long, not what it
 * is. Floors are carried in the evidence for callers that want them and are
 * never resolved into config options; fabricating a max from the largest
 * value one happened to see would be lying with a straight face.
 *
 * The `_tag` literal discriminates a floor from a {@link StyleVote} at
 * runtime (see there); `.make` defaults it.
 *
 * **Gotchas**
 *
 * Branch on `_tag`, never `instanceof`. Floors are informational and never
 * resolved into config options.
 *
 * **Example** (Make a line-length floor)
 *
 * ```ts
 * import { StyleFloor } from "@beep/scratchpad/yaml"
 *
 * const floor = StyleFloor.make({ dimension: "max", value: 96 })
 *
 * console.log(floor._tag) // "StyleFloor"
 * console.log(floor.value) // 96
 * ```
 *
 * @see {@link StyleVote} for categorical observations discriminated by the same `_tag` field.
 * @public
 * @category models
 * @since 0.0.0
 */
export class StyleFloor extends Schema.TaggedClass<StyleFloor>()(
	"StyleFloor",
	{
		dimension: Schema.String,
		value: Schema.Number,
	},
	$I.annote("StyleFloor", {
		description: "A measured style floor the source proves is at least this value.",
	}),
) {}

/**
 * What a rule's `infer` hook yields per occurrence: a categorical
 * {@link StyleVote} or a measured {@link StyleFloor}.
 *
 * **Gotchas**
 *
 * Discriminate on `_tag`. Do not use `instanceof` — custom rules may yield
 * plain objects shaped like a vote or floor.
 *
 * @see {@link StyleVote} for categorical observations.
 * @see {@link StyleFloor} for measured floors that never become config options.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type StyleObservation = StyleVote | StyleFloor;

/**
 * The public rule interface — built-ins and custom rules are the same
 * shape, and config references either by `id`; there is no privileged
 * built-in mechanism a custom rule cannot reach.
 *
 * `options` is the validated per-rule options object from the config entry
 * (or `undefined` when the entry was a bare severity literal); built-in
 * rules receive options already validated against their exported options
 * schema, custom rules validate their own.
 *
 * `infer` is the optional config-inference hook (#345): it reports the style
 * the source already follows as per-occurrence {@link StyleObservation}s, so
 * detection logic lives beside the check logic that polices the same
 * dimension (and shares its fixtures). Rules with no detectable style — the
 * policy rules, whose only evidence is violations — simply omit the hook and
 * stay default-driven under every resolver.
 *
 * **Example** (Run a one-off custom rule)
 *
 * ```ts
 * import { YamlLint, YamlLintConfig, YamlLintDiagnostic, type YamlRule } from "@beep/scratchpad/yaml"
 *
 * const rule: YamlRule = {
 *   id: "no-todo",
 *   check: (ctx) => {
 *     const offset = ctx.text.indexOf("TODO")
 *     if (offset === -1) return []
 *     return [
 *       YamlLintDiagnostic.make({
 *         rule: "no-todo",
 *         severity: "warning",
 *         message: "TODO found",
 *         offset,
 *         length: 4,
 *         line: 0,
 *         character: offset,
 *       }),
 *     ]
 *   },
 * }
 *
 * const findings = YamlLint.run("TODO: later\n", [rule], YamlLintConfig.make({ rules: { "no-todo": "warning" } }))
 * console.log(findings[0]?.rule) // "no-todo"
 * ```
 *
 * @see {@link YamlLint.run} for executing a rule list under a config.
 * @see {@link YamlLintDiagnostic} for the finding shape `check` yields.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface YamlRule {
	readonly id: string;
	readonly check: (ctx: LintContext, options: unknown) => Iterable<YamlLintDiagnostic>;
	readonly infer?: (ctx: LintContext) => Iterable<StyleObservation>;
}
