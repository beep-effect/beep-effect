// The lint rule model (#129): the context handed to every rule, the public
// rule interface, the severity vocabulary and the lint diagnostic.
//
// Cycle firewall: the design sketches one YamlLint.ts owning model AND
// facade, but built-in rules must construct `YamlLintDiagnostic` while the
// facade must import the built-in catalog — one module would close the cycle
// `YamlLint → rules → YamlLint` (`noImportCycles` is error-level). So the
// model lives here, `src/internal/rules/*` import it, and `YamlLint.ts`
// (config + facade) imports both. Nothing imports this module back.

import { Schema } from "effect";
import type { YamlDocument } from "./YamlDocument.ts";
import { YamlEdit } from "./YamlEdit.ts";
import type { YamlToken } from "./YamlToken.ts";

/**
 * Lint diagnostic severities. `"off"` is a config-level disable only and
 * never reaches a diagnostic — a rule set to `"off"` is not run.
 *
 * @public
 */
export const YamlLintSeverity = Schema.Literals(["error", "warning"]);

/**
 * The union of lint severity string literals.
 *
 * @public
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
 * @public
 */
export class YamlLintDiagnostic extends Schema.Class<YamlLintDiagnostic>("YamlLintDiagnostic")({
	rule: Schema.String,
	severity: YamlLintSeverity,
	message: Schema.String,
	offset: Schema.Number,
	length: Schema.Number,
	line: Schema.Number,
	character: Schema.Number,
	fix: Schema.optionalKey(YamlEdit),
}) {}

/**
 * One source line of the linted document: its text (without the line
 * terminator — the `\n`, and for CRLF input the `\r\n` pair), the offset of
 * its first character, and its zero-based line number.
 *
 * @public
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
 * @public
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
 * @public
 */
export class StyleVote extends Schema.TaggedClass<StyleVote>()("StyleVote", {
	dimension: Schema.String,
	value: Schema.Union([Schema.String, Schema.Number, Schema.Boolean]),
	offset: Schema.Number,
	length: Schema.Number,
	line: Schema.Number,
	character: Schema.Number,
}) {}

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
 * @public
 */
export class StyleFloor extends Schema.TaggedClass<StyleFloor>()("StyleFloor", {
	dimension: Schema.String,
	value: Schema.Number,
}) {}

/**
 * What a rule's `infer` hook yields per occurrence: a categorical
 * {@link StyleVote} or a measured {@link StyleFloor}.
 *
 * @public
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
 * @public
 */
export interface YamlRule {
	readonly id: string;
	readonly check: (ctx: LintContext, options: unknown) => Iterable<YamlLintDiagnostic>;
	readonly infer?: (ctx: LintContext) => Iterable<StyleObservation>;
}
