/**
 * Pure YAML linting: strings in, diagnostics or a fixed string out.
 *
 * **Details**
 *
 * The rule-aware config schema and the {@link YamlLint} facade (`run`, `fix`,
 * `builtins`). The rule model lives in `YamlLintRule.ts` to break the
 * catalog cycle. No file discovery, config-file loading, IO or CLI lives here.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { HashMap, Result, Schema } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { composeFirstDocument } from "./internal/composer/document.ts";
import { isFatalCode } from "./internal/diagnostics.ts";
import { builtinOptionsSchemas, builtinRules } from "./internal/rules/catalog.ts";
import { YamlParseError } from "./Yaml.ts";
import { documentFromRaw } from "./YamlDocument.ts";
import { YamlEdit } from "./YamlEdit.ts";
import type { LintContext, LintLine, StyleObservation, YamlLintSeverity, YamlRule } from "./YamlLintRule.ts";
import { YamlLintDiagnostic } from "./YamlLintRule.ts";
import { YamlTokens } from "./YamlToken.ts";

const $I = $ScratchpadId.create("yaml/YamlLint");

// ── Config ──────────────────────────────────────────────────────────────────

/**
 * One entry of the config `rules` map: a bare severity literal (the common
 * case), `"off"` to disable, or a typed per-rule options object (the tuning
 * case; may carry its own `severity`).
 *
 * **Example** (Accept severity literals and option objects)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { YamlLintRuleSetting } from "@beep/scratchpad/yaml"
 *
 * console.log(S.is(YamlLintRuleSetting)("off")) // true
 * console.log(S.is(YamlLintRuleSetting)("warning")) // true
 * console.log(S.is(YamlLintRuleSetting)({ quoteType: "double" })) // true
 * ```
 *
 * @see {@link YamlLintConfig} for the config that stores a map of these settings.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const YamlLintRuleSetting = Schema.Union([
	Schema.Literals(["error", "warning", "off"]),
	Schema.Record(Schema.String, Schema.Unknown),
]).pipe(
	$I.annoteSchema("YamlLintRuleSetting", {
		description: "One lint config entry: a severity literal, off, or a per-rule options object.",
	}),
);

/**
 * Decoded union produced by {@link YamlLintRuleSetting}.
 *
 * @see {@link YamlLintRuleSetting} for the runtime schema and decoding behavior.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlLintRuleSetting = typeof YamlLintRuleSetting.Type;

/** Rule-aware validation of the config `rules` map (undefined = valid). */
const validateRulesMap = (rules: { readonly [id: string]: YamlLintRuleSetting }): string | undefined => {
	for (const [id, entry] of R.toEntries(rules)) {
		if (id === "parse-validity") {
			// Always-on rule #1: it cannot be demoted, disabled or configured.
			// Failing loud beats silently ignoring an entry that looks like it
			// does something.
			if (entry === "off" || entry === "warning") {
				return `Rule "parse-validity" is always-on and cannot be set to "${entry}"`;
			}
			if (P.isObject(entry)) {
				return `Rule "parse-validity" accepts no options`;
			}
			continue;
		}
		if (P.isObject(entry)) {
			const optionsSchema = O.getOrUndefined(HashMap.get(builtinOptionsSchemas, id));
			// Custom rule ids carry opaque options the custom rule validates
			// itself; built-in options are validated against the rule's own
			// exported schema so a typo'd option fails here, typed, instead of
			// travelling as `unknown` into the rule.
			if (optionsSchema !== undefined) {
				// onExcessProperty: "error" — a typo'd option KEY fails loudly with
				// an UnexpectedKey issue naming the key, instead of decoding to {}
				// (v4 Structs strip unknown keys by default).
				const decoded = Schema.decodeResult(optionsSchema as Schema.Codec<unknown, unknown>, {
					onExcessProperty: "error",
				})(entry);
				if (Result.isFailure(decoded)) {
					return `Invalid options for rule "${id}": ${String(decoded.failure)}`;
				}
			}
		}
	}
	return undefined;
};

/**
 * The lint configuration: a `rules` map keying rule ids (built-in or custom)
 * to a severity literal or a typed per-rule options object.
 *
 * **Details**
 *
 * Validation is rule-aware for the built-in catalog — a mistyped option on a
 * built-in rule fails schema validation with a typed error naming the rule,
 * and any attempt to demote or disable the always-on `parse-validity` rule
 * is rejected. Custom rule ids are accepted with a bare severity or an
 * opaque options object the custom rule validates itself.
 *
 * Presets ship as the statics {@link YamlLintConfig.default} and
 * {@link YamlLintConfig.relaxed} — composing one is object spread over a
 * static, not an `extends` string resolution step (this package owns no
 * config-file loader).
 *
 * **Gotchas**
 *
 * Config validation rejects demoting or disabling `parse-validity`. Document-
 * driven rules see only the first stream document; token and line rules cover
 * full source. `"off"` in a base config outranks inference.
 *
 * **Example** (Spread the default preset)
 *
 * ```ts
 * import { YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const config = YamlLintConfig.make({
 *   rules: { ...YamlLintConfig.default.rules, "trailing-spaces": "warning" },
 * })
 *
 * console.log(config.rules["trailing-spaces"]) // "warning"
 * ```
 *
 * @see {@link YamlLint.run} for applying this config to a document.
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class YamlLintConfig extends Schema.Class<YamlLintConfig>("YamlLintConfig")(
	{
		rules: Schema.Record(Schema.String, YamlLintRuleSetting).pipe(Schema.check(Schema.makeFilter(validateRulesMap))),
	},
	$I.annote("YamlLintConfig", {
		description: "Lint configuration mapping rule ids to severities or per-rule options.",
	}),
) {
	/**
	 * The default preset. Rule entries accrete as built-ins land; the
	 * `quoted-strings` rule defaults to DOUBLE quotes here (the one taste
	 * call the design pins).
	 */
	static readonly default: YamlLintConfig = YamlLintConfig.make({
		rules: {
			"line-length": "error",
			"trailing-spaces": "error",
			"empty-lines": "error",
			"eof-newline": "error",
			"key-duplicates": "error",
			"quoted-strings": { quoteType: "double" },
			truthy: "error",
			"comments-spacing": "error",
			"colon-spacing": "error",
			"hyphen-spacing": "error",
			indentation: "error",
		},
	});

	/** The relaxed preset: style rules demoted to warnings. */
	static readonly relaxed: YamlLintConfig = YamlLintConfig.make({
		rules: {
			"line-length": "warning",
			"trailing-spaces": "warning",
			"empty-lines": "warning",
			"eof-newline": "warning",
			"key-duplicates": "error",
			"quoted-strings": { quoteType: "double", severity: "warning" },
			truthy: "warning",
			"comments-spacing": "warning",
			"colon-spacing": "warning",
			"hyphen-spacing": "warning",
			indentation: "warning",
		},
	});
}

// ── Context construction ────────────────────────────────────────────────────

/**
 * Split `text` into positioned lines. Line text excludes the terminator
 * whole — for CRLF input the `\r` is part of the terminator and is stripped
 * too, so every rule sees the same line content regardless of line-ending
 * style. Empty input has no lines: rules that count blank lines must not see
 * a phantom first line.
 */
const buildLines = (text: string): ReadonlyArray<LintLine> => {
	if (text === "") return [];
	const lines: Array<LintLine> = [];
	let offset = 0;
	let number = 0;
	while (offset <= text.length) {
		const nl = text.indexOf("\n", offset);
		const end = nl === -1 ? text.length : nl > offset && text[nl - 1] === "\r" ? nl - 1 : nl;
		// The final empty segment after a trailing newline is not a line.
		if (offset === text.length && number > 0) break;
		lines.push({ text: text.slice(offset, end), offset, number });
		if (nl === -1) break;
		offset = nl + 1;
		number++;
	}
	return lines;
};

/**
 * Build the eager lint context: tokenize once, compose once (through the
 * RECOVERED path, so the context exists for malformed input too — the
 * `parse-validity` rule reports what went wrong).
 */
const buildContext = (text: string): LintContext => {
	const tokens = Result.match(YamlTokens.tokenize(text), {
		onSuccess: (value) => value,
		onFailure: (error) => {
			// The tokenize failure channel is reserved and never fires today.
			throw error;
		},
	});
	return {
		text,
		lines: buildLines(text),
		tokens,
		// uniqueKeys: false — duplicate-key POLICY belongs to the configurable
		// `key-duplicates` rule, so the engine's own duplicate warnings are
		// switched off here and `parse-validity` never double-reports them.
		document: documentFromRaw(composeFirstDocument(text, { uniqueKeys: false }), text),
	};
};

// ── Style evidence (#345) ───────────────────────────────────────────────────

/**
 * An accumulated tally of one {@link StyleVote} spelling: how many times a
 * `value` was voted for a `(rule, dimension)` pair, and the position of the
 * FIRST occurrence seen (merging keeps the left operand's position, so on a
 * multi-file merge the first file that exhibited the spelling names it).
 *
 * **Example** (Record a first-seen quote-style vote)
 *
 * ```ts
 * import { StyleVoteTally } from "@beep/scratchpad/yaml"
 *
 * const tally = StyleVoteTally.make({
 *   rule: "quoted-strings",
 *   dimension: "quoteType",
 *   value: "double",
 *   count: 2,
 *   offset: 3,
 *   length: 5,
 *   line: 0,
 *   character: 3,
 * })
 *
 * console.log(tally.count) // 2
 * console.log(tally.value) // "double"
 * ```
 *
 * @see {@link StyleEvidence} for the monoid that accumulates these tallies.
 * @public
 * @category models
 * @since 0.0.0
 */
export class StyleVoteTally extends Schema.Class<StyleVoteTally>("StyleVoteTally")(
	{
		rule: Schema.String,
		dimension: Schema.String,
		value: Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]),
		count: Schema.Finite,
		offset: Schema.Finite,
		length: Schema.Finite,
		line: Schema.Finite,
		character: Schema.Finite,
	},
	$I.annote("StyleVoteTally", {
		description: "An accumulated tally of one style vote spelling with first-seen position.",
	}),
) {}

/**
 * An accumulated {@link StyleFloor} for a `(rule, dimension)` pair: the
 * largest value the observed sources prove the limit is AT LEAST. Merging
 * takes the maximum. Floors are informational — never resolved into config
 * options (see {@link StyleFloor}).
 *
 * **Example** (Record a measured line-length floor)
 *
 * ```ts
 * import { StyleFloorTally } from "@beep/scratchpad/yaml"
 *
 * const floor = StyleFloorTally.make({
 *   rule: "line-length",
 *   dimension: "max",
 *   value: 96,
 * })
 *
 * console.log(floor.value) // 96
 * ```
 *
 * @see {@link StyleFloor} for the per-occurrence observation this tally accumulates.
 * @public
 * @category models
 * @since 0.0.0
 */
export class StyleFloorTally extends Schema.Class<StyleFloorTally>("StyleFloorTally")(
	{
		rule: Schema.String,
		dimension: Schema.String,
		value: Schema.Finite,
	},
	$I.annote("StyleFloorTally", {
		description: "The largest measured style floor observed for a (rule, dimension) pair.",
	}),
) {}

/** Canonical histogram key for a vote value — type-discriminating (`"2"` ≠ `2`, `"true"` ≠ `true`). */
const valueKey = (value: string | number | boolean): string => `${typeof value}:${String(value)}`;

const byTallyOrder = (
	a: { readonly rule: string; readonly dimension: string },
	b: { readonly rule: string; readonly dimension: string },
	aKey: string,
	bKey: string,
): number =>
	a.rule < b.rule
		? -1
		: a.rule > b.rule
			? 1
			: a.dimension < b.dimension
				? -1
				: a.dimension > b.dimension
					? 1
					: aKey < bKey
						? -1
						: aKey > bKey
							? 1
							: 0;

/**
 * Per-dimension style evidence (#345): what the observed sources say about
 * each inferable `(rule, dimension)` — vote histograms with first-seen
 * positions, and measured floors.
 *
 * **Details**
 *
 * Evidence is a MONOID: {@link StyleEvidence.empty} is the identity and
 * {@link StyleEvidence.combine} is associative, so multi-file inference is
 * observe-per-file, merge, resolve — and the N-file loop stays the caller's
 * (no IO enters the package). `combine` normalizes: counts of the same
 * `(rule, dimension, value)` add, the left operand's first-seen position
 * wins, floors take the maximum, and the result is canonically sorted — so
 * every value `observe`/`combine`/`fromObservations` produces is canonical
 * and the monoid laws hold structurally over them.
 *
 * **Gotchas**
 *
 * Floors never become config options. Strict inference fails only on observed
 * disagreement; unobserved dimensions fall back to `base`. `"off"` in base
 * outranks inference. Branch on `_tag` when consuming observations — class
 * instances are structurally assignable.
 *
 * **Example** (Combine two observe results)
 *
 * ```ts
 * import { StyleEvidence, YamlLint } from "@beep/scratchpad/yaml"
 *
 * const singles = YamlLint.observe("name: 'Ada'\n", YamlLint.builtins)
 * const doubles = YamlLint.observe('name: "Bob"\n', YamlLint.builtins)
 * const combined = StyleEvidence.combine(singles, doubles)
 * const quotes = combined.votes.filter((vote) => vote.dimension === "quoteType")
 *
 * console.log(quotes.length) // 2
 * console.log(quotes.some((vote) => vote.value === "single")) // true
 * console.log(quotes.some((vote) => vote.value === "double")) // true
 * ```
 *
 * @see {@link YamlLint.observe} for collecting evidence from source text.
 * @see {@link YamlLint.resolveStrict} for failing on observed disagreement.
 * @see {@link YamlLint.inferLenient} for plurality resolution plus residual diagnostics.
 * @public
 * @category models
 * @since 0.0.0
 */
export class StyleEvidence extends Schema.Class<StyleEvidence>("StyleEvidence")(
	{
		votes: Schema.Array(StyleVoteTally),
		floors: Schema.Array(StyleFloorTally),
	},
	$I.annote("StyleEvidence", {
		description: "Monoid of per-dimension style votes and floors collected from observed YAML sources.",
	}),
) {
	/** The monoid identity: no observations. */
	static readonly empty: StyleEvidence = StyleEvidence.make({ votes: [], floors: [] });

	/**
	 * Merge two bodies of evidence (associative; {@link StyleEvidence.empty}
	 * is the identity). Vote counts add, the left operand's first-seen
	 * position wins per spelling, floors take the maximum.
	 *
	 * **Example** (Add matching vote counts)
	 *
	 * ```ts
	 * import { StyleEvidence, StyleVote } from "@beep/scratchpad/yaml"
	 *
	 * const vote = StyleVote.make({
	 *   dimension: "quoteType", value: "single", offset: 0, length: 3, line: 0, character: 0,
	 * })
	 * const one = StyleEvidence.fromObservations("quoted-strings", [vote])
	 * const combined = StyleEvidence.combine(one, one)
	 * console.log(combined.votes[0]?.count) // 2
	 * ```
	 */
	static combine(a: StyleEvidence, b: StyleEvidence): StyleEvidence {
		let votes = HashMap.empty<string, StyleVoteTally>();
		for (const tally of [...a.votes, ...b.votes]) {
			const key = `${tally.rule}\x00${tally.dimension}\x00${valueKey(tally.value)}`;
			const seen = O.getOrUndefined(HashMap.get(votes, key));
			votes = HashMap.set(
				votes,
				key,
				seen === undefined ? tally : StyleVoteTally.make({ ...seen, count: seen.count + tally.count }),
			);
		}
		let floors = HashMap.empty<string, StyleFloorTally>();
		for (const floor of [...a.floors, ...b.floors]) {
			const key = `${floor.rule}\x00${floor.dimension}`;
			const seen = O.getOrUndefined(HashMap.get(floors, key));
			floors = HashMap.set(floors, key, seen === undefined || floor.value > seen.value ? floor : seen);
		}
		return StyleEvidence.make({
			votes: [...HashMap.values(votes)].sort((x, y) => byTallyOrder(x, y, valueKey(x.value), valueKey(y.value))),
			floors: [...HashMap.values(floors)].sort((x, y) => byTallyOrder(x, y, "", "")),
		});
	}

	/**
	 * Build canonical evidence from one rule's raw observations — the
	 * homomorphism from observation lists into the monoid
	 * (`fromObservations(r, [...a, ...b])` equals
	 * `combine(fromObservations(r, a), fromObservations(r, b))`). `observe`
	 * uses it per rule; it is public so custom tooling can construct evidence
	 * without a {@link LintContext}.
	 *
	 * **Example** (Tally one style vote)
	 *
	 * ```ts
	 * import { StyleEvidence, StyleVote } from "@beep/scratchpad/yaml"
	 *
	 * const evidence = StyleEvidence.fromObservations("quoted-strings", [
	 *   StyleVote.make({
	 *     dimension: "quoteType", value: "double", offset: 0, length: 3, line: 0, character: 0,
	 *   }),
	 * ])
	 * console.log(evidence.votes[0]?.value) // "double"
	 * ```
	 */
	static fromObservations(rule: string, observations: Iterable<StyleObservation>): StyleEvidence {
		let acc = StyleEvidence.empty;
		for (const observation of observations) {
			// Branch on the `_tag` discriminator, never `instanceof`: class
			// instances are structurally assignable, so a custom rule may yield a
			// PLAIN OBJECT shaped like a vote, and it must still tally as one.
			acc = StyleEvidence.combine(
				acc,
				observation._tag === "StyleVote"
					? StyleEvidence.make({
							votes: [
								StyleVoteTally.make({
									rule,
									count: 1,
									dimension: observation.dimension,
									value: observation.value,
									offset: observation.offset,
									length: observation.length,
									line: observation.line,
									character: observation.character,
								}),
							],
							floors: [],
						})
					: StyleEvidence.make({
							votes: [],
							floors: [StyleFloorTally.make({ rule, dimension: observation.dimension, value: observation.value })],
						}),
			);
		}
		return acc;
	}
}

/**
 * One strict-resolution conflict: a `(rule, dimension)` whose observed
 * spellings disagree. `candidates` carries every spelling with its count and
 * first-seen position, ordered by count descending (dominant first).
 *
 * **Example** (Name a quote-style conflict)
 *
 * ```ts
 * import { StyleConflict, StyleVoteTally } from "@beep/scratchpad/yaml"
 *
 * const conflict = StyleConflict.make({
 *   rule: "quoted-strings",
 *   dimension: "quoteType",
 *   candidates: [
 *     StyleVoteTally.make({
 *       rule: "quoted-strings",
 *       dimension: "quoteType",
 *       value: "double",
 *       count: 2,
 *       offset: 0,
 *       length: 3,
 *       line: 0,
 *       character: 0,
 *     }),
 *     StyleVoteTally.make({
 *       rule: "quoted-strings",
 *       dimension: "quoteType",
 *       value: "single",
 *       count: 1,
 *       offset: 8,
 *       length: 3,
 *       line: 1,
 *       character: 3,
 *     }),
 *   ],
 * })
 *
 * console.log(conflict.candidates.length) // 2
 * console.log(conflict.candidates.some((c) => c.value === "double")) // true
 * console.log(conflict.candidates.some((c) => c.value === "single")) // true
 * ```
 *
 * @see {@link YamlStyleConflictError} for the strict-inference error that carries these conflicts.
 * @public
 * @category models
 * @since 0.0.0
 */
export class StyleConflict extends Schema.Class<StyleConflict>("StyleConflict")(
	{
		rule: Schema.String,
		dimension: Schema.String,
		candidates: Schema.Array(StyleVoteTally),
	},
	$I.annote("StyleConflict", {
		description: "A strict-inference conflict: one (rule, dimension) whose observed spellings disagree.",
	}),
) {}

/**
 * Raised by strict config inference when observed evidence is not unanimous:
 * carries every conflicting `(rule, dimension)` as a structured
 * {@link StyleConflict} — dimension, all spellings, counts and positions —
 * never a collapsed `reason` string (the structure-preserving-errors house
 * rule). Unobserved dimensions never conflict: they fall back to the base
 * config's defaults.
 *
 * **Example** (Strict inference fails on mixed quotes)
 *
 * ```ts
 * import { Result } from "effect"
 * import { YamlLint, YamlStyleConflictError } from "@beep/scratchpad/yaml"
 *
 * const strict = YamlLint.inferStrict("a: 'x'\nb: \"y\"\n", YamlLint.builtins)
 * console.log(Result.isFailure(strict)) // true
 * if (Result.isFailure(strict)) {
 *   console.log(strict.failure._tag) // "YamlStyleConflictError"
 *   console.log(strict.failure instanceof YamlStyleConflictError) // true
 * }
 * ```
 *
 * @see {@link YamlLint.resolveStrict} for the resolver that raises this error.
 * @public
 * @category errors
 * @since 0.0.0
 */
export class YamlStyleConflictError extends Schema.TaggedError<YamlStyleConflictError>()(
	"YamlStyleConflictError",
	{
		conflicts: Schema.Array(StyleConflict),
	},
	$I.annote("YamlStyleConflictError", {
		description: "Strict style inference failed because observed evidence disagreed on at least one dimension.",
	}),
) {
	/**
	 * Render every conflicting rule, dimension, candidate count, and first
	 * source position as a human-readable summary.
	 *
	 * **Example** (Read a strict-inference conflict summary)
	 *
	 * ```ts
	 * import { Result } from "effect"
	 * import { YamlLint } from "@beep/scratchpad/yaml"
	 *
	 * const result = YamlLint.inferStrict("a: 'x'\nb: \"y\"\n", YamlLint.builtins)
	 * if (Result.isFailure(result)) {
	 *   console.log(result.failure.message.includes("quoted-strings.quoteType")) // true
	 * }
	 * ```
	 */
	override get message(): string {
		return this.conflicts
			.map(
				(conflict) =>
					`Conflicting style for ${conflict.rule}.${conflict.dimension}: ${conflict.candidates
						.map((c) => `${JSON.stringify(c.value)} (${c.count}×, first at ${c.line}:${c.character})`)
						.join(" vs ")}`,
			)
			.join("; ");
	}
}

/** Group canonical vote tallies by rule, then dimension (order-preserving). */
const groupVotes = (
	evidence: StyleEvidence,
): HashMap.HashMap<string, HashMap.HashMap<string, Array<StyleVoteTally>>> => {
	let byRule = HashMap.empty<string, HashMap.HashMap<string, Array<StyleVoteTally>>>();
	for (const tally of evidence.votes) {
		let dims = O.getOrElse(HashMap.get(byRule, tally.rule), () => HashMap.empty<string, Array<StyleVoteTally>>());
		const tallies = O.getOrElse(HashMap.get(dims, tally.dimension), () => []);
		dims = HashMap.set(dims, tally.dimension, [...tallies, tally]);
		byRule = HashMap.set(byRule, tally.rule, dims);
	}
	return byRule;
};

/**
 * Overlay resolved option picks onto the base config. A base entry keeps its
 * severity (a bare `"warning"` becomes `{ severity: "warning", ...picks }`);
 * an explicit `"off"` outranks inference and is left untouched; a rule the
 * base does not mention is added as a plain options entry.
 */
const overlayConfig = (
	base: YamlLintConfig,
	picks: HashMap.HashMap<string, HashMap.HashMap<string, string | number | boolean>>,
): YamlLintConfig => {
	const rules: Record<string, YamlLintRuleSetting> = { ...base.rules };
	for (const [ruleId, dims] of picks) {
		const entry = rules[ruleId];
		if (entry === "off") continue;
		const merged: Record<string, unknown> =
			entry === "warning" ? { severity: "warning" } : P.isObject(entry) ? { ...entry } : {};
		for (const [dimension, value] of dims) merged[dimension] = value;
		rules[ruleId] = merged as YamlLintRuleSetting;
	}
	return YamlLintConfig.make({ rules });
};

/** The observation loop shared by `observe` and the infer conveniences. */
const observeContext = (ctx: LintContext, rules: ReadonlyArray<YamlRule>): StyleEvidence => {
	let evidence = StyleEvidence.empty;
	for (const rule of rules) {
		if (rule.infer === undefined) continue;
		evidence = StyleEvidence.combine(evidence, StyleEvidence.fromObservations(rule.id, rule.infer(ctx)));
	}
	return evidence;
};

const resolveStrictEvidence = (
	evidence: StyleEvidence,
	base: YamlLintConfig,
): Result.Result<YamlLintConfig, YamlStyleConflictError> => {
	const conflicts: Array<StyleConflict> = [];
	let picks = HashMap.empty<string, HashMap.HashMap<string, string | number | boolean>>();
	for (const [ruleId, dims] of groupVotes(evidence)) {
		for (const [dimension, tallies] of dims) {
			if (tallies.length > 1) {
				conflicts.push(
					StyleConflict.make({
						rule: ruleId,
						dimension,
						candidates: [...tallies].sort((a, b) => b.count - a.count),
					}),
				);
				continue;
			}
			const only = tallies[0] as StyleVoteTally;
			const dimPicks = O.getOrElse(HashMap.get(picks, ruleId), () =>
				HashMap.empty<string, string | number | boolean>(),
			);
			picks = HashMap.set(picks, ruleId, HashMap.set(dimPicks, dimension, only.value));
		}
	}
	if (conflicts.length > 0) return Result.fail(YamlStyleConflictError.make({ conflicts }));
	return Result.succeed(overlayConfig(base, picks));
};

const resolveLenientEvidence = (evidence: StyleEvidence, base: YamlLintConfig): YamlLintConfig => {
	let picks = HashMap.empty<string, HashMap.HashMap<string, string | number | boolean>>();
	for (const [ruleId, dims] of groupVotes(evidence)) {
		for (const [dimension, tallies] of dims) {
			// Dominant = plurality: highest count wins; a tie breaks to the first
			// tally in canonical (value-key) order, so the pick is deterministic.
			let dominant = tallies[0] as StyleVoteTally;
			for (const tally of tallies) {
				if (tally.count > dominant.count) dominant = tally;
			}
			const dimPicks = O.getOrElse(HashMap.get(picks, ruleId), () =>
				HashMap.empty<string, string | number | boolean>(),
			);
			picks = HashMap.set(picks, ruleId, HashMap.set(dimPicks, dimension, dominant.value));
		}
	}
	return overlayConfig(base, picks);
};

/**
 * A lenient inference report: the inferred config plus the residual — the
 * diagnostics that config still produces on the observed text ("here is your
 * config, and the places that do not match it").
 *
 * **Example** (Guard a lenient inference report)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { YamlLintConfig, YamlLintInference } from "@beep/scratchpad/yaml"
 *
 * console.log(S.is(YamlLintInference)({ config: YamlLintConfig.default, residual: [] })) // true
 * ```
 *
 * @see {@link YamlLint.inferLenient} for the convenience that returns this report.
 * @public
 * @category models
 * @since 0.0.0
 */
export const YamlLintInference = Schema.Struct({
	config: YamlLintConfig,
	residual: Schema.Array(YamlLintDiagnostic),
}).pipe(
	$I.annoteSchema("YamlLintInference", {
		description: "Lenient YAML style-inference report containing the inferred config and residual diagnostics.",
	}),
);

/**
 * TypeScript representation of lenient YAML style-inference report containing the inferred config and residual diagnostics.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YamlLintInference = typeof YamlLintInference.Type;

// ── Facade ──────────────────────────────────────────────────────────────────

/** Resolve the effective severity of a configured entry. */
const resolveSeverity = (entry: YamlLintRuleSetting): YamlLintSeverity => {
	if (entry === "error" || entry === "warning") return entry;
	if (P.isObject(entry) && (entry.severity === "error" || entry.severity === "warning")) {
		return entry.severity;
	}
	return "error";
};

const byPosition = (a: YamlLintDiagnostic, b: YamlLintDiagnostic): number =>
	a.offset - b.offset || a.length - b.length || (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0);

/**
 * The rule loop shared by `run` and `fix` over one already-built context —
 * `fix` must not tokenize and compose the same input twice.
 */
const runRules = (
	ctx: LintContext,
	rules: ReadonlyArray<YamlRule>,
	config: YamlLintConfig,
): ReadonlyArray<YamlLintDiagnostic> => {
	const out: Array<YamlLintDiagnostic> = [];
	for (const rule of rules) {
		const alwaysOn = rule.id === "parse-validity";
		const entry = alwaysOn ? "error" : config.rules[rule.id];
		if (entry === undefined || entry === "off") continue;
		const severity = resolveSeverity(entry);
		const options = P.isObject(entry) ? entry : undefined;
		for (const diagnostic of rule.check(ctx, options)) {
			out.push(
				alwaysOn || diagnostic.severity === severity ? diagnostic : YamlLintDiagnostic.make({ ...diagnostic, severity }),
			);
		}
	}
	return out.sort(byPosition);
};

/**
 * Run, fix and infer YAML style over in-memory strings.
 *
 * **Details**
 *
 * Pure and synchronous throughout — the lint engine is the pure half only:
 * strings in, diagnostics or a fixed string out. File discovery, config-file
 * loading and autofix-to-disk belong to a consumer's tier, not here.
 *
 * **Gotchas**
 *
 * `parse-validity` is always-on and cannot be demoted. `run`/`fix`
 * document-driven rules see only the first stream document; token and line
 * rules cover full source. `fix` drops overlapping or same-offset surgical
 * fixes (earlier `run` order wins) and fails with {@link YamlParseError} on a
 * fatal first document. Duplicate-key policy belongs to `key-duplicates`;
 * compose uses `uniqueKeys: false` so `parse-validity` does not double-report.
 *
 * **Example** (Find trailing spaces, then infer lenient residual)
 *
 * ```ts
 * import { Result } from "effect"
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const findings = YamlLint.run("a: 1 \n", YamlLint.builtins, YamlLintConfig.default)
 * console.log(findings.some((diagnostic) => diagnostic.rule === "trailing-spaces")) // true
 *
 * const fixed = YamlLint.fix("a: 1 \n", YamlLint.builtins, YamlLintConfig.default)
 * console.log(Result.isSuccess(fixed) && !fixed.success.includes("1 ")) // true
 *
 * const inference = YamlLint.inferLenient("a: 1 \n", YamlLint.builtins)
 * console.log(inference.residual.some((diagnostic) => diagnostic.rule === "trailing-spaces")) // true
 * ```
 *
 * @see {@link YamlLint.run} for the rule loop.
 * @see {@link YamlLint.fix} for comment-safe surgical fixes.
 * @see {@link YamlLint.observe} for collecting style evidence.
 * @see {@link YamlLint.resolveStrict} for unanimous overlay over a base config.
 * @see {@link YamlLint.inferLenient} for plurality inference plus residual diagnostics.
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class YamlLint {
	private constructor() {}

	/**
	 * The built-in rule catalog. Custom usage is array concatenation:
	 * `YamlLint.run(text, [...YamlLint.builtins, myRule], config)`.
	 */
	static readonly builtins: ReadonlyArray<YamlRule> = builtinRules;

	/**
	 * Run `rules` over `text` under `config`, returning every finding sorted
	 * by position.
	 *
	 * Document-driven rules see the FIRST document of the stream (matching
	 * `Yaml.parse`; split the stream `Yaml.parseAll`-style to lint every
	 * document), while token- and line-driven rules cover the full source —
	 * see {@link LintContext}.
	 *
	 * A rule runs when its config entry is a severity or an options object;
	 * `"off"` and absent entries skip it — except `parse-validity`, which is
	 * always-on. The resolved severity (explicit-in-options, else the bare
	 * literal, else `"error"`) overrides what the rule emitted, again except
	 * for `parse-validity`, whose bridged engine diagnostics keep the
	 * engine's own grading.
	 *
	 * **Example** (Report a duplicate mapping key)
	 *
	 * ```ts
	 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/yaml"
	 *
	 * const findings = YamlLint.run("a: 1\na: 2\n", YamlLint.builtins, YamlLintConfig.default)
	 *
	 * console.log(findings.length) // 1
	 * console.log(findings[0]?.rule) // "key-duplicates"
	 * ```
	 */
	static run(text: string, rules: ReadonlyArray<YamlRule>, config: YamlLintConfig): ReadonlyArray<YamlLintDiagnostic> {
		return runRules(buildContext(text), rules, config);
	}

	/**
	 * Run `rules` and apply every non-overlapping surgical fix, returning the
	 * fixed text. Fails with {@link YamlParseError} when the FIRST document
	 * of the stream has a fatal parse error — a document the engine cannot
	 * compose is not safely fixable. The gate matches `Yaml.parse`'s scope:
	 * later documents of a multi-document stream are not composed (split the
	 * stream `Yaml.parseAll`-style to lint every document), though token- and
	 * line-driven fixes still cover the full source. Fixes route exclusively through `YamlEdit.applyAll` (never a
	 * reformat), so applying them is comment-safe by construction; when two
	 * fixes overlap — or start at the same offset — the earlier one in
	 * {@link YamlLint.run} order (position, then rule id) wins and the later
	 * is dropped (its diagnostic remains reported by {@link YamlLint.run}).
	 *
	 * **Example** (Apply a truthy-value fix)
	 *
	 * ```ts
	 * import * as Result from "effect/Result"
	 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/yaml"
	 *
	 * const fixed = YamlLint.fix("value: yes\n", YamlLint.builtins, YamlLintConfig.default)
	 *
	 * if (Result.isSuccess(fixed)) console.log(fixed.success) // 'value: "yes"\n'
	 * ```
	 */
	static fix(
		text: string,
		rules: ReadonlyArray<YamlRule>,
		config: YamlLintConfig,
	): Result.Result<string, YamlParseError> {
		// One context serves both the fatal-parse gate and the rule loop —
		// tokenize once, compose once. DuplicateKey is not a fatal code, so the
		// context's uniqueKeys-disabled compose sees the same fatal set the
		// default compose would.
		const ctx = buildContext(text);
		const fatal = ctx.document.errors.filter((e) => isFatalCode(e.code));
		if (fatal.length > 0) {
			return Result.fail(YamlParseError.make({ diagnostics: fatal, input: text }));
		}
		const fixes: Array<YamlEdit> = [];
		let lastEnd = -1;
		let lastOffset = -1;
		for (const diagnostic of runRules(ctx, rules, config)) {
			const fix = diagnostic.fix;
			if (fix === undefined) continue;
			// Overlapping — and same-offset (two zero-length insertions at one
			// position would apply in arbitrary order) — earlier fix wins.
			if (fix.offset < lastEnd || fix.offset === lastOffset) continue;
			fixes.push(fix);
			lastEnd = fix.offset + fix.length;
			lastOffset = fix.offset;
		}
		return Result.succeed(YamlEdit.applyAll(text, fixes));
	}

	/**
	 * Observe the style `text` already follows (#345): run every rule's
	 * optional `infer` hook over one eagerly-built context and merge the
	 * observations into canonical {@link StyleEvidence}. Pure and total —
	 * strings in, evidence out; observing N files is N `observe` calls merged
	 * with {@link StyleEvidence.combine}, and the N-file loop stays the
	 * caller's (no IO enters the package).
	 *
	 * **Example** (Observe a single-quote preference)
	 *
	 * ```ts
	 * import { YamlLint } from "@beep/scratchpad/yaml"
	 *
	 * const evidence = YamlLint.observe("name: 'Alice'\n", YamlLint.builtins)
	 *
	 * console.log(evidence.votes.some((vote) => vote.value === "single")) // true
	 * ```
	 */
	static observe(text: string, rules: ReadonlyArray<YamlRule>): StyleEvidence {
		return observeContext(buildContext(text), rules);
	}

	/**
	 * Strict resolution: every OBSERVED dimension must be unanimous, and the
	 * unanimous picks overlay `base` (default {@link YamlLintConfig.default})
	 * into an exact config. Conflicting evidence fails with
	 * {@link YamlStyleConflictError} naming every conflicting dimension, all
	 * spellings, counts and first-seen positions. Unobserved is NOT
	 * conflicting: a corpus with no comments says nothing about
	 * `comments-spacing`, so that dimension falls back to `base` rather than
	 * failing. A rule `base` sets to `"off"` stays off — an explicit disable
	 * outranks inference.
	 *
	 * **Example** (Resolve unanimous evidence)
	 *
	 * ```ts
	 * import * as Result from "effect/Result"
	 * import { YamlLint } from "@beep/scratchpad/yaml"
	 *
	 * const evidence = YamlLint.observe("name: 'Alice'\n", YamlLint.builtins)
	 * const resolved = YamlLint.resolveStrict(evidence)
	 *
	 * console.log(Result.isSuccess(resolved)) // true
	 * ```
	 */
	static resolveStrict(
		evidence: StyleEvidence,
		base: YamlLintConfig = YamlLintConfig.default,
	): Result.Result<YamlLintConfig, YamlStyleConflictError> {
		return resolveStrictEvidence(evidence, base);
	}

	/**
	 * Lenient resolution: the dominant (plurality) spelling per observed
	 * dimension overlays `base` (default {@link YamlLintConfig.default}); a
	 * tie breaks deterministically to the first candidate in canonical
	 * value order. Total — lenient resolution cannot fail; the places that do
	 * not match the inferred config surface as the residual report (run the
	 * lint with the inferred config, or use {@link YamlLint.inferLenient}).
	 *
	 * **Example** (Resolve the dominant quote style)
	 *
	 * ```ts
	 * import { YamlLint } from "@beep/scratchpad/yaml"
	 *
	 * const evidence = YamlLint.observe("name: 'Alice'\n", YamlLint.builtins)
	 * const config = YamlLint.resolveLenient(evidence)
	 *
	 * console.log(config.rules["quoted-strings"]) // { quoteType: "single" }
	 * ```
	 */
	static resolveLenient(evidence: StyleEvidence, base: YamlLintConfig = YamlLintConfig.default): YamlLintConfig {
		return resolveLenientEvidence(evidence, base);
	}

	/**
	 * Single-text strict inference: `observe` then {@link YamlLint.resolveStrict}
	 * in one step. Multi-file callers observe each file and merge with
	 * {@link StyleEvidence.combine} before resolving.
	 *
	 * **Example** (Infer a strict config from one document)
	 *
	 * ```ts
	 * import * as Result from "effect/Result"
	 * import { YamlLint } from "@beep/scratchpad/yaml"
	 *
	 * const inferred = YamlLint.inferStrict("name: 'Alice'\n", YamlLint.builtins)
	 *
	 * console.log(Result.isSuccess(inferred)) // true
	 * ```
	 */
	static inferStrict(
		text: string,
		rules: ReadonlyArray<YamlRule>,
		base: YamlLintConfig = YamlLintConfig.default,
	): Result.Result<YamlLintConfig, YamlStyleConflictError> {
		return resolveStrictEvidence(YamlLint.observe(text, rules), base);
	}

	/**
	 * Single-text lenient inference: `observe`, resolve dominant picks over
	 * `base`, then run the lint with the inferred config — returning the
	 * config AND the residual diagnostics it still produces ("here is your
	 * config, and the places that do not match it"). One context serves both
	 * the observation and the residual run. Multi-file callers compose the
	 * primitives instead: observe each file, {@link StyleEvidence.combine},
	 * {@link YamlLint.resolveLenient}, then {@link YamlLint.run} per file.
	 *
	 * **Example** (Return the inferred config and residual findings)
	 *
	 * ```ts
	 * import { YamlLint } from "@beep/scratchpad/yaml"
	 *
	 * const inferred = YamlLint.inferLenient("a: 'x'\nb: \"y\"\n", YamlLint.builtins)
	 *
	 * console.log(inferred.residual.length) // 1
	 * ```
	 */
	static inferLenient(
		text: string,
		rules: ReadonlyArray<YamlRule>,
		base: YamlLintConfig = YamlLintConfig.default,
	): YamlLintInference {
		const ctx = buildContext(text);
		const config = resolveLenientEvidence(observeContext(ctx, rules), base);
		return { config, residual: runRules(ctx, rules, config) };
	}
}
