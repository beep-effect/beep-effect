// The #345 dogfood pin: strict-mode config inference over our OWN
// stringifier's emitted output must resolve without conflict — unanimous
// evidence out of our own emit, or the stringifier is inconsistent with
// itself. The corpus is value-path emission (Yaml.stringifyResult with
// default options): the value path is where every presentation choice is the
// stringifier's own, which is exactly what self-consistency is about.

import { assert, describe, it } from "@effect/vitest";
import { Result } from "effect";
import { StyleEvidence, Yaml, YamlLint } from "../../../effected/yaml/index.ts";

const values: ReadonlyArray<unknown> = [
	{ name: "alice", age: 30, admin: true },
	{ deps: { a: "*", b: ">=1.2.3" }, scripts: { test: "vitest run", lint: "biome check" } },
	{ list: [1, 2, 3], nested: { seq: ["a", "b", "c"], map: { deep: { deeper: "still" } } } },
	{ steps: [{ run: "build" }, { run: "test", env: { CI: "true" } }] },
	{ text: "line one\nline two\n", note: "needs: quoting" },
	{ empty: {}, emptyList: [], nul: null, pi: 3.14 },
];

describe("e2e: strict inference over the stringifier's own emit (#345)", () => {
	it("unanimous evidence out of our own emit — or the stringifier disagrees with itself", () => {
		let evidence = StyleEvidence.empty;
		for (const value of values) {
			const emitted = Yaml.stringifyResult(value);
			assert.isTrue(Result.isSuccess(emitted), "the corpus values must stringify");
			if (Result.isSuccess(emitted)) {
				evidence = StyleEvidence.combine(evidence, YamlLint.observe(emitted.success, YamlLint.builtins));
			}
		}
		// Positive control: the corpus must actually exercise the inferable
		// dimensions — an inference pass that observed nothing would resolve
		// "without conflict" vacuously.
		const voted = new Set(evidence.votes.map((v) => `${v.rule}.${v.dimension}`));
		assert.isTrue(voted.has("quoted-strings.quoteType"), "corpus must produce quote-style votes");
		assert.isTrue(voted.has("indentation.spaces"), "corpus must produce indent-unit votes");
		assert.isTrue(voted.has("indentation.indentSequences"), "corpus must produce sequence-policy votes");
		assert.isTrue(voted.has("document-start.present"), "corpus must produce start-marker votes");
		assert.isTrue(voted.has("document-end.present"), "corpus must produce end-marker votes");

		const resolved = YamlLint.resolveStrict(evidence);
		assert.isTrue(
			Result.isSuccess(resolved),
			Result.isFailure(resolved) ? `stringifier self-inconsistency: ${resolved.failure.message}` : "",
		);
		if (Result.isSuccess(resolved)) {
			// The inferred config is the stringifier's own documented voice:
			// single-quote fallback, two-space indent, unindented sequences, no
			// document markers.
			assert.deepStrictEqual(resolved.success.rules["quoted-strings"], { quoteType: "single" });
			assert.deepStrictEqual(resolved.success.rules.indentation, { indentSequences: false, spaces: 2 });
			assert.deepStrictEqual(resolved.success.rules["document-start"], { present: false });
			assert.deepStrictEqual(resolved.success.rules["document-end"], { present: false });
		}
	});
});
