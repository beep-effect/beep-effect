// The config-inference facade (#345): the StyleEvidence monoid (laws proven
// generatively over Schema-derived observation arbitraries), multi-file
// merge-then-resolve, the strict and lenient resolvers over one evidence
// type, the residual report, and the typed conflict error.

import { assert, describe, it } from "@effect/vitest";
import { Effect, Result, Schema } from "effect";
import type { YamlRule } from "../../effected/yaml/index.ts";
import {
	StyleEvidence,
	StyleFloor,
	StyleVote,
	YamlLint,
	YamlLintConfig,
	YamlStyleConflictError,
} from "../../effected/yaml/index.ts";

const observation = Schema.Union([StyleVote, StyleFloor]);
const observations = Schema.Array(observation);

const combineAll = (evidences: ReadonlyArray<StyleEvidence>): StyleEvidence =>
	evidences.reduce((acc, e) => StyleEvidence.combine(acc, e), StyleEvidence.empty);

describe("StyleEvidence — the monoid", () => {
	it.effect.prop(
		"combine is associative and empty is the identity",
		{ a: observations, b: observations, c: observations },
		({ a, b, c }) =>
			Effect.sync(() => {
				const ea = StyleEvidence.fromObservations("r", a);
				const eb = StyleEvidence.fromObservations("r", b);
				const ec = StyleEvidence.fromObservations("s", c);
				assert.deepStrictEqual(
					StyleEvidence.combine(StyleEvidence.combine(ea, eb), ec),
					StyleEvidence.combine(ea, StyleEvidence.combine(eb, ec)),
				);
				assert.deepStrictEqual(StyleEvidence.combine(StyleEvidence.empty, ea), ea);
				assert.deepStrictEqual(StyleEvidence.combine(ea, StyleEvidence.empty), ea);
			}),
	);

	it.effect.prop(
		"fromObservations is a monoid homomorphism over concatenation",
		{ a: observations, b: observations },
		({ a, b }) =>
			Effect.sync(() => {
				assert.deepStrictEqual(
					StyleEvidence.fromObservations("r", [...a, ...b]),
					StyleEvidence.combine(StyleEvidence.fromObservations("r", a), StyleEvidence.fromObservations("r", b)),
				);
			}),
	);

	it("merging tallies: counts add, the left position wins, floors take the max", () => {
		const vote = (offset: number) =>
			StyleVote.make({ dimension: "quoteType", value: "double", offset, length: 3, line: offset, character: 0 });
		const a = StyleEvidence.fromObservations("quoted-strings", [
			vote(3),
			StyleFloor.make({ dimension: "max", value: 10 }),
		]);
		const b = StyleEvidence.fromObservations("quoted-strings", [
			vote(9),
			StyleFloor.make({ dimension: "max", value: 40 }),
		]);
		const merged = StyleEvidence.combine(a, b);
		assert.strictEqual(merged.votes.length, 1);
		assert.strictEqual(merged.votes[0]?.count, 2);
		assert.strictEqual(merged.votes[0]?.offset, 3);
		assert.strictEqual(merged.floors.length, 1);
		assert.strictEqual(merged.floors[0]?.value, 40);
	});

	it("multi-file: observing N snippets and merging equals the concatenation-equivalent evidence", () => {
		const parts = ["a: 'x'\n", "b: 'y'\n", 'c: "z"\n'];
		const merged = combineAll(parts.map((text) => YamlLint.observe(text, YamlLint.builtins)));
		const quoteVotes = merged.votes.filter((v) => v.rule === "quoted-strings" && v.dimension === "quoteType");
		assert.deepStrictEqual(
			quoteVotes.map((v) => [v.value, v.count]),
			[
				["double", 1],
				["single", 2],
			],
		);
		// The merge is fold-order independent (associativity, applied).
		const [e1, e2, e3] = parts.map((text) => YamlLint.observe(text, YamlLint.builtins)) as [
			StyleEvidence,
			StyleEvidence,
			StyleEvidence,
		];
		assert.deepStrictEqual(merged, StyleEvidence.combine(e1, StyleEvidence.combine(e2, e3)));
	});
});

describe("YamlLint.resolveStrict", () => {
	it("empty evidence resolves to the base config untouched", () => {
		const resolved = YamlLint.resolveStrict(StyleEvidence.empty);
		assert.isTrue(Result.isSuccess(resolved));
		if (Result.isSuccess(resolved)) {
			assert.deepStrictEqual(resolved.success.rules, YamlLintConfig.default.rules);
		}
	});

	it("unanimous evidence overlays exact options onto the base", () => {
		const resolved = YamlLint.inferStrict("a: 'x'\nb: 'y'\n", YamlLint.builtins);
		assert.isTrue(Result.isSuccess(resolved));
		if (Result.isSuccess(resolved)) {
			// The observed style overrides the base default's taste call...
			assert.deepStrictEqual(resolved.success.rules["quoted-strings"], { quoteType: "single" });
			// ...and observed rules absent from the base are added.
			assert.deepStrictEqual(resolved.success.rules["document-start"], { present: false });
			assert.deepStrictEqual(resolved.success.rules["document-end"], { present: false });
			// Unobserved rules keep their base entries — unobserved ≠ conflicting.
			assert.strictEqual(resolved.success.rules["comments-spacing"], "error");
			assert.strictEqual(resolved.success.rules.truthy, "error");
		}
	});

	it("conflicting evidence fails typed, naming dimension, spellings and positions", () => {
		const text = "a: 'x'\nb: \"y\"\n";
		const resolved = YamlLint.inferStrict(text, YamlLint.builtins);
		assert.isTrue(Result.isFailure(resolved), "a mixed-quote corpus must not resolve strictly");
		if (Result.isFailure(resolved)) {
			assert.instanceOf(resolved.failure, YamlStyleConflictError);
			const conflict = resolved.failure.conflicts.find(
				(c) => c.rule === "quoted-strings" && c.dimension === "quoteType",
			);
			assert.isDefined(conflict);
			assert.sameDeepMembers([...(conflict?.candidates.map((c) => c.value) ?? [])], ["single", "double"]);
			const single = conflict?.candidates.find((c) => c.value === "single");
			const double = conflict?.candidates.find((c) => c.value === "double");
			assert.strictEqual(text.slice(single?.offset, (single?.offset ?? 0) + (single?.length ?? 0)), "'x'");
			assert.strictEqual(text.slice(double?.offset, (double?.offset ?? 0) + (double?.length ?? 0)), '"y"');
			assert.include(resolved.failure.message, "quoted-strings.quoteType");
			assert.include(resolved.failure.message, '"single"');
			assert.include(resolved.failure.message, '"double"');
		}
	});

	it("renders conflict positions 1-based in the message while the tally fields stay 0-based", () => {
		const resolved = YamlLint.inferStrict("a: 'x'\nb: \"y\"\n", YamlLint.builtins);
		if (Result.isSuccess(resolved)) {
			assert.fail("a mixed-quote corpus must not resolve strictly");
			return;
		}
		const conflict = resolved.failure.conflicts.find((c) => c.rule === "quoted-strings" && c.dimension === "quoteType");
		const double = conflict?.candidates.find((c) => c.value === "double");
		assert.strictEqual(double?.line, 1);
		assert.strictEqual(double?.character, 3);
		assert.include(resolved.failure.message, '"double" (1×, first at 2:4)');
		assert.include(resolved.failure.message, '"single" (1×, first at 1:4)');
	});

	it("an explicit base 'off' outranks inference", () => {
		const base = YamlLintConfig.make({ rules: { "quoted-strings": "off" } });
		const resolved = YamlLint.inferStrict("a: 'x'\n", YamlLint.builtins, base);
		assert.isTrue(Result.isSuccess(resolved));
		if (Result.isSuccess(resolved)) {
			assert.strictEqual(resolved.success.rules["quoted-strings"], "off");
		}
	});

	it("a base severity survives the overlay", () => {
		const base = YamlLintConfig.make({ rules: { "quoted-strings": "warning" } });
		const resolved = YamlLint.inferStrict("a: 'x'\n", YamlLint.builtins, base);
		assert.isTrue(Result.isSuccess(resolved));
		if (Result.isSuccess(resolved)) {
			assert.deepStrictEqual(resolved.success.rules["quoted-strings"], { severity: "warning", quoteType: "single" });
		}
	});

	it("custom rules participate in inference for free", () => {
		const custom: YamlRule = {
			id: "my-rule",
			check: () => [],
			infer: () => [StyleVote.make({ dimension: "style", value: "x", offset: 0, length: 0, line: 0, character: 0 })],
		};
		const resolved = YamlLint.inferStrict("a: 1\n", [custom], YamlLintConfig.make({ rules: {} }));
		assert.isTrue(Result.isSuccess(resolved));
		if (Result.isSuccess(resolved)) {
			assert.deepStrictEqual(resolved.success.rules["my-rule"], { style: "x" });
		}
	});

	it("a PLAIN-OBJECT vote from a custom rule tallies as a vote, never as a floor", () => {
		// Class instances are structurally assignable: a custom rule may yield
		// an object that type-checks as StyleVote without being an instance.
		// The evidence builder must branch on the `_tag` discriminator, not
		// `instanceof` — instanceof would drop this into the floor branch and
		// feed a string `value` to StyleFloorTally.
		const plainVote: StyleVote = {
			_tag: "StyleVote",
			dimension: "style",
			value: "x",
			offset: 0,
			length: 0,
			line: 0,
			character: 0,
		} as StyleVote;
		assert.isFalse(plainVote instanceof StyleVote, "the fixture must NOT be a class instance");
		const custom: YamlRule = { id: "my-rule", check: () => [], infer: () => [plainVote] };
		const evidence = YamlLint.observe("a: 1\n", [custom]);
		assert.strictEqual(evidence.floors.length, 0, "a plain-object vote must not land in the floor tally");
		assert.strictEqual(evidence.votes.length, 1);
		assert.strictEqual(evidence.votes[0]?.value, "x");
		const resolved = YamlLint.resolveStrict(evidence, YamlLintConfig.make({ rules: {} }));
		assert.isTrue(Result.isSuccess(resolved));
		if (Result.isSuccess(resolved)) {
			assert.deepStrictEqual(resolved.success.rules["my-rule"], { style: "x" });
		}
	});
});

describe("YamlLint.resolveLenient / inferLenient", () => {
	it("the dominant spelling wins and the residual names what still deviates", () => {
		const text = "a: 'x'\nb: 'y'\nc: \"z\"\n";
		const { config, residual } = YamlLint.inferLenient(text, YamlLint.builtins);
		assert.deepStrictEqual(config.rules["quoted-strings"], { quoteType: "single" });
		// The residual IS a plain run with the inferred config — reused, not
		// reimplemented.
		assert.deepStrictEqual(residual, YamlLint.run(text, YamlLint.builtins, config));
		const deviation = residual.filter((d) => d.rule === "quoted-strings");
		assert.strictEqual(deviation.length, 1);
		assert.strictEqual(
			text.slice(deviation[0]?.offset, (deviation[0]?.offset ?? 0) + (deviation[0]?.length ?? 0)),
			'"z"',
		);
	});

	it("a perfectly consistent document leaves an empty rule residual", () => {
		const { config, residual } = YamlLint.inferLenient("a: 'x'\nb: 'y'\n", YamlLint.builtins);
		assert.deepStrictEqual(config.rules["quoted-strings"], { quoteType: "single" });
		assert.deepStrictEqual(
			residual.filter((d) => d.rule === "quoted-strings"),
			[],
		);
	});

	it("a tie breaks deterministically to canonical value order", () => {
		const evidence = YamlLint.observe("a: 'x'\nb: \"y\"\n", YamlLint.builtins);
		const config = YamlLint.resolveLenient(evidence);
		// 1-1: "double" precedes "single" canonically, so the pick is stable.
		assert.deepStrictEqual(config.rules["quoted-strings"], { quoteType: "double" });
		assert.deepStrictEqual(YamlLint.resolveLenient(evidence), config);
	});

	it("floors never leak into a resolved config", () => {
		const text = "a: 1\nkey: something-quite-long-here\n\n\nb: 2\n";
		const evidence = YamlLint.observe(text, YamlLint.builtins);
		assert.isAbove(evidence.floors.length, 0, "the corpus must actually measure floors");
		const base = YamlLintConfig.make({ rules: {} });
		const strict = YamlLint.resolveStrict(evidence, base);
		assert.isTrue(Result.isSuccess(strict));
		if (Result.isSuccess(strict)) {
			assert.isUndefined(strict.success.rules["line-length"]);
			assert.isUndefined(strict.success.rules["empty-lines"]);
		}
		assert.isUndefined(YamlLint.resolveLenient(evidence, base).rules["line-length"]);
	});
});
