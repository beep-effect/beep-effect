// Oracle-pinned contract for the NODE-LEVEL comment model (#348/#349 follow-on).
//
// WHY THIS FILE EXISTS: the comment fields used to live on `YamlPair`, which is
// not where the reference puts them. That one placement decision was the root
// of four separate recorded divergences — a relocated key-line comment, the
// alias drop, the multi-line complex-key drop, and the explicit-key spelling —
// because a pair has one comment slot where the reference has two independent
// node slots. Moving the fields onto the key and value NODES dissolves all
// four rather than patching each.
//
// Provenance (ORACLE.md convention, parity with oracle-differential.test.ts):
// - Oracle: `yaml@2.9.0` (`YAML.parseDocument`, reading node.commentBefore /
//   node.comment / node.spaceBefore; re-emission via `String(doc)`)
// - Authored: 2026-08-16, offline, in a scratch script outside the test run
// - The oracle is NOT a dependency of this suite — the committed literals below
//   are the contract. Never regenerate them with our own parser.
//
// SCOPE OF PARITY: these literals pin comment ATTRIBUTION and comment
// EMISSION. They deliberately do NOT pin reference behavior that is not a
// comment decision — the reference drops a root block scalar's body indent,
// respaces flow collections to `{ b: 1 }`, and does not spill an over-long
// implicit key (#323). Those stay ours; see the divergence record at the head
// of src/internal/composer/comments.ts.

import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { YamlNode } from "../../effected/yaml/index.ts";
import { YamlAlias, YamlDocument, YamlMap, YamlScalar, YamlSeq } from "../../effected/yaml/index.ts";

/** The comment triple, flattened for comparison against an oracle literal. */
interface Comments {
	readonly commentBefore?: string;
	readonly comment?: string;
	readonly spaceBefore?: boolean;
}

const commentsOf = (node: YamlNode | null): Comments => {
	if (node === null) return {};
	return {
		...(node.commentBefore !== undefined ? { commentBefore: node.commentBefore } : {}),
		...(node.comment !== undefined ? { comment: node.comment } : {}),
		...(node.spaceBefore !== undefined ? { spaceBefore: node.spaceBefore } : {}),
	};
};

const rootMap = (doc: YamlDocument): YamlMap => {
	assert.instanceOf(doc.contents, YamlMap);
	return doc.contents as YamlMap;
};

/** `key` / `value` comment triples of the pair at `index` of the root mapping. */
const pairComments = (doc: YamlDocument, index = 0): { key: Comments; value: Comments } => {
	const pair = rootMap(doc).items[index];
	assert.isDefined(pair);
	return { key: commentsOf(pair.key), value: commentsOf(pair.value) };
};

describe("node-level comment model — oracle contract (yaml@2.9.0)", () => {
	describe("the pair itself carries nothing", () => {
		it.effect("YamlPair has no comment fields at all", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("a: 1 # t\n# lead\nb: 2\n");
				for (const pair of rootMap(doc).items) {
					assert.notProperty(pair, "commentBefore");
					assert.notProperty(pair, "comment");
					assert.notProperty(pair, "spaceBefore");
				}
			}),
		);
	});

	describe("attribution: which node owns which comment", () => {
		it.effect("a trailing comment belongs to the VALUE node", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("a: 1 # t\n");
				assert.deepStrictEqual(pairComments(doc), { key: {}, value: { comment: " t" } });
			}),
		);

		it.effect("an own-line comment above a key belongs to the KEY node", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("a: 1\n# section\nb: 2\n");
				assert.deepStrictEqual(pairComments(doc, 1), { key: { commentBefore: " section" }, value: {} });
			}),
		);

		it.effect("a blank line above the comment run sets spaceBefore on the KEY node", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("a: 1\n\n# section\nb: 2\n");
				assert.deepStrictEqual(pairComments(doc, 1), {
					key: { commentBefore: " section", spaceBefore: true },
					value: {},
				});
			}),
		);

		it.effect("a key-line comment with the value below trails the KEY — a deliberate divergence", () =>
			Effect.gen(function* () {
				// The oracle folds this into the value's `commentBefore`, which makes
				// `a: # kc` and `a:` + an own-line `# kc` above the value the same
				// AST — so one of the two source shapes has to be rewritten on emit.
				// Attaching it to the KEY, whose line it was written on, keeps them
				// distinct and lets both round-trip byte-intact. Divergence 1 in
				// composer/comments.ts.
				const doc = yield* YamlDocument.parse("a: # kc\n  1\n");
				assert.deepStrictEqual(pairComments(doc), { key: { comment: " kc" }, value: {} });

				// The own-line form keeps its own line, and neither shape moves.
				const spilled = yield* YamlDocument.parse("a:\n  # kc\n  1\n");
				assert.deepStrictEqual(pairComments(spilled), { key: {}, value: { commentBefore: " kc" } });
			}),
		);

		it.effect("a key-line comment on an ABSENT value lands on the key — the one placement divergence", () =>
			Effect.gen(function* () {
				// The oracle puts this on the value, because it materializes `a:`
				// as Scalar(null) and every node it makes has a comment slot. Our
				// `value` is `null` for an absent value, and making it always-a-node
				// for parity's sake would silently break every consumer's
				// `pair.value === null` check at RUNTIME rather than at compile
				// time. The emitted bytes are identical either way (`a: # kc`), so
				// the divergence is invisible to a formatter and visible only to a
				// consumer reading the field. Recorded in composer/comments.ts.
				const doc = yield* YamlDocument.parse("a: # kc\nb: 2\n");
				assert.deepStrictEqual(pairComments(doc), { key: { comment: " kc" }, value: {} });
			}),
		);
	});

	describe("aliases carry comments (the old blanket drop is gone)", () => {
		it.effect("a trailing comment on an alias value", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("a: &x 1\nb: *x # ac\n");
				const value = rootMap(doc).items[1]?.value;
				assert.instanceOf(value, YamlAlias);
				assert.deepStrictEqual(commentsOf(value as YamlAlias), { comment: " ac" });
			}),
		);

		it.effect("a leading comment on an alias value", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("a: &x 1\nb:\n  # lead\n  *x\n");
				const value = rootMap(doc).items[1]?.value;
				assert.instanceOf(value, YamlAlias);
				assert.deepStrictEqual(commentsOf(value as YamlAlias), { commentBefore: " lead" });
			}),
		);

		it.effect("a comment on an alias inside a sequence", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("a: &x 1\nb:\n  - *x # ac\n");
				const seq = rootMap(doc).items[1]?.value;
				assert.instanceOf(seq, YamlSeq);
				const item = (seq as YamlSeq).items[0];
				assert.instanceOf(item, YamlAlias);
				assert.deepStrictEqual(commentsOf(item as YamlAlias), { comment: " ac" });
			}),
		);

		// Capture alone proves nothing: the fields existed on the node while three
		// `instanceof YamlAlias` guards in the stringifier still skipped them, so
		// every one of these round-tripped its comment straight out of existence.
		// Emission is the assertion that has teeth.
		const aliasRoundtrips: ReadonlyArray<readonly [string, string]> = [
			["trailing on a mapping value", "a: &x 1\nb: *x # ac\n"],
			["leading on a mapping value", "a: &x 1\nb:\n  # lead\n  *x\n"],
			// Sequence values render unindented under the default indentSequences.
			["trailing on a sequence item", "a: &x 1\nb:\n- *x # ac\n"],
			["leading on a sequence item", "a: &x 1\nb:\n# lead\n- *x\n"],
		];
		for (const [name, source] of aliasRoundtrips) {
			it.effect(`re-emits an alias comment byte-intact: ${name}`, () =>
				Effect.gen(function* () {
					const doc = yield* YamlDocument.parse(source);
					const out = yield* doc.stringify();
					assert.strictEqual(out, source);
					const again = yield* YamlDocument.parse(out);
					assert.strictEqual(yield* again.stringify(), out);
				}),
			);
		}
	});

	describe("complex keys keep their pair's trailing comment", () => {
		it.effect("a block-scalar key's pair comment lands on the value", () =>
			Effect.gen(function* () {
				// Previously dropped: a multi-line key has no line that can carry a
				// `#`, and the single pair slot put the comment there. The value
				// node has a line of its own.
				const doc = yield* YamlDocument.parse("? |\n  k\n: v # t\n");
				assert.deepStrictEqual(commentsOf(rootMap(doc).items[0]?.value ?? null), { comment: " t" });
			}),
		);

		it.effect("a sequence key's pair comment lands on the value", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("? - k\n: v # t\n");
				assert.deepStrictEqual(commentsOf(rootMap(doc).items[0]?.value ?? null), { comment: " t" });
			}),
		);

		it.effect("a value's own leading comment stays on the value", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("? - k\n:\n  # lead\n  - v\n");
				assert.deepStrictEqual(commentsOf(rootMap(doc).items[0]?.value ?? null), { commentBefore: " lead" });
			}),
		);
	});

	describe("flow collections attribute to their inner nodes", () => {
		it.effect("an own-line comment inside a flow map leads the inner KEY", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("a: {\n  # lead\n  b: 1,\n}\n");
				const inner = rootMap(doc).items[0]?.value;
				assert.instanceOf(inner, YamlMap);
				assert.deepStrictEqual(commentsOf((inner as YamlMap).items[0]?.key ?? null), { commentBefore: " lead" });
			}),
		);

		it.effect("an own-line comment inside a flow seq leads the ITEM", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("a: [\n  # lead\n  1,\n]\n");
				const inner = rootMap(doc).items[0]?.value;
				assert.instanceOf(inner, YamlSeq);
				assert.deepStrictEqual(commentsOf((inner as YamlSeq).items[0] ?? null), { commentBefore: " lead" });
			}),
		);

		it.effect("a trailing comment after a flow collection belongs to that collection", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("a: {b: 1} # t\n");
				assert.deepStrictEqual(commentsOf(rootMap(doc).items[0]?.value ?? null), { comment: " t" });
			}),
		);
	});

	describe("document fields follow the reference naming and attribution", () => {
		it.effect("a header comment leads the FIRST KEY, not the document", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("# hdr\na: 1\n");
				assert.isUndefined(doc.commentBefore);
				assert.isUndefined(doc.comment);
				assert.deepStrictEqual(pairComments(doc), { key: { commentBefore: " hdr" }, value: {} });
			}),
		);

		it.effect("a trailing block is the document's `comment` (was `commentAfter`)", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("# hdr\na: 1\n# tail\n");
				assert.strictEqual(doc.comment, " tail");
				assert.deepStrictEqual(pairComments(doc), { key: { commentBefore: " hdr" }, value: {} });
			}),
		);

		it.effect("a comment after a `...` marker is the document's `comment` too", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("a: 1\n...\n# tail\n");
				assert.strictEqual(doc.comment, " tail");
			}),
		);
	});

	describe("block-scalar header comments live on the scalar, at every depth", () => {
		const headers: ReadonlyArray<readonly [string, string]> = [
			["pair value", "a: | # hdr\n  body\n"],
			["seq item", "- | # hdr\n  body\n"],
			["explicit-key value", "? - k\n: | # hdr\n  body\n"],
			["document root", "| # hdr\n  body\n"],
		];
		for (const [name, source] of headers) {
			it.effect(`captures the header comment on the scalar: ${name}`, () =>
				Effect.gen(function* () {
					const doc = yield* YamlDocument.parse(source);
					const found: YamlScalar[] = [];
					const visit = (node: YamlNode | null): void => {
						if (node === null) return;
						if (S.is(YamlScalar)(node)) {
							if (node.comment !== undefined) found.push(node);
							return;
						}
						if (S.is(YamlSeq)(node)) for (const item of node.items) visit(item);
						if (S.is(YamlMap)(node)) {
							for (const pair of node.items) {
								visit(pair.key);
								visit(pair.value);
							}
						}
					};
					visit(doc.contents);
					assert.lengthOf(found, 1);
					assert.strictEqual(found[0]?.comment, " hdr");
				}),
			);
		}
	});
});
