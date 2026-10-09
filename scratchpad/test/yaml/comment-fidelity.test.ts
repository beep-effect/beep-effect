// @effect-diagnostics nodeBuiltinImport:skip-file
// Comment fidelity (#127): the commentBefore / comment / spaceBefore split on
// the four node classes, the composer's FORWARD own-line attribution, blank
// line preservation, and stringifier emission across node kinds and styles.
//
// The headline gate is the systems repro: a workflow file carrying leading
// comments, trailing comments and own-line section comments roundtrips
// through YamlFormat.formatToString byte-intact (fixtures/comment-fidelity/
// workflow.yaml, a committed fixed point under indentSequences: true).

import { readFileSync } from "node:fs";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema, Result, Stream } from "effect";
import { Yaml, YamlDocument, YamlFormat, YamlMap, YamlScalar, YamlSeq, YamlVisitor } from "../../effected/yaml/index.ts";

const firstMap = (doc: YamlDocument): YamlMap => {
	assert.instanceOf(doc.contents, YamlMap);
	return doc.contents as YamlMap;
};

const JsonString = Schema.fromJsonString(Schema.String);

describe("comment fidelity (#127)", () => {
	describe("composer attribution", () => {
		it.effect("attributes an own-line comment FORWARD to the following pair", () =>
			Effect.gen(function* () {
				// The issue's exact case: `# section` documents `b`, not `a`.
				const doc = yield* YamlDocument.parse("a: 1\n\n# section\nb: 2\n");
				const map = firstMap(doc);
				const [a, b] = map.items;
				assert.isUndefined(a?.key.commentBefore);
				assert.isUndefined(a?.value?.comment);
				assert.strictEqual(b?.key.commentBefore, " section");
				assert.strictEqual(b?.key.spaceBefore, true);
			}),
		);

		it.effect("attributes a same-line comment as the pair's trailing comment", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("a: 1 # trailing a\nb: 2\n");
				const map = firstMap(doc);
				assert.strictEqual(map.items[0]?.value?.comment, " trailing a");
				assert.isUndefined(map.items[1]?.value?.comment);
			}),
		);

		it.effect("joins consecutive leading comment lines with a newline", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("a: 1\n# line one\n# line two\nb: 2\n");
				const map = firstMap(doc);
				assert.strictEqual(map.items[1]?.key.commentBefore, " line one\n line two");
			}),
		);

		it.effect("preserves a blank line without comments as spaceBefore", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("a: 1\n\nb: 2\n");
				const map = firstMap(doc);
				assert.isUndefined(map.items[0]?.key.spaceBefore);
				assert.strictEqual(map.items[1]?.key.spaceBefore, true);
				assert.isUndefined(map.items[1]?.key.commentBefore);
			}),
		);

		it.effect("own-line comments after a mapping's last entry become the mapping's trailing comment", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("a:\n  b: 1\n  # end of a\nc: 2\n");
				const map = firstMap(doc);
				const aValue = map.items[0]?.value;
				assert.instanceOf(aValue, YamlMap);
				assert.strictEqual((aValue as YamlMap).comment, " end of a");
				// It must NOT have attached backward to the b entry.
				assert.isUndefined((aValue as YamlMap).items[0]?.value?.comment);
			}),
		);

		it.effect("attributes seq item comments: own-line forward, same-line trailing", () =>
			Effect.gen(function* () {
				// A comment between `key:` and the sequence leads the VALUE node
				// (the sequence itself) — the same attachment the yaml npm
				// package uses; comments between items lead the next item.
				const doc = yield* YamlDocument.parse("steps:\n  # first step\n  - build\n  # mid\n  - test # inline\n");
				const map = firstMap(doc);
				const seq = map.items[0]?.value;
				assert.instanceOf(seq, YamlSeq);
				assert.strictEqual((seq as YamlSeq).commentBefore, " first step");
				const [first, second] = (seq as YamlSeq).items;
				assert.instanceOf(first, YamlScalar);
				assert.isUndefined((first as YamlScalar).commentBefore);
				assert.strictEqual((second as YamlScalar).commentBefore, " mid");
				assert.strictEqual((second as YamlScalar).comment, " inline");
			}),
		);

		it.effect("a key comment and a value comment both survive — neither shadows the other", () =>
			Effect.gen(function* () {
				// Both slots are legitimately occupied: the key line carries its own
				// comment because the value renders below, and the value carries a
				// trailing comment on its own line. An emitter that returns the key's
				// comment and stops drops the value's silently.
				const source = "a: # kc\n  1 # vc\n";
				const doc = yield* YamlDocument.parse(source);
				const pair = firstMap(doc).items[0];
				assert.strictEqual(pair?.key.comment, " kc");
				assert.strictEqual(pair?.value?.comment, " vc");
				const out = yield* doc.stringify();
				assert.strictEqual((out.match(/#/g) ?? []).length, 2, `a comment was dropped: ${(yield* Schema.encodeEffect(JsonString)(out))}`);
				assert.strictEqual(YamlFormat.formatToString(out), out);
			}),
		);

		it.effect("a key-line comment ahead of a block value trails the KEY", () =>
			Effect.gen(function* () {
				// It was written on the key's line and it stays there. The own-line
				// form below it is a different shape and keeps its own line, so both
				// round-trip byte-intact.
				const doc = yield* YamlDocument.parse("a: # c\n  b: 1\n");
				assert.strictEqual(firstMap(doc).items[0]?.key.comment, " c");

				const spilled = yield* YamlDocument.parse("a:\n  # c\n  b: 1\n");
				assert.isUndefined(firstMap(spilled).items[0]?.key.comment);
				assert.strictEqual(firstMap(spilled).items[0]?.value?.commentBefore, " c");
			}),
		);

		it.effect("an own-line comment between `:` and the value leads the value node", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("a:\n  # note\n  1\n");
				const map = firstMap(doc);
				const value = map.items[0]?.value;
				assert.instanceOf(value, YamlScalar);
				assert.strictEqual((value as YamlScalar).commentBefore, " note");
			}),
		);

		it.effect("stores RAW post-# text: alignment, no-space and bare # survive", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("#no-space\n#   aligned\n#\na: 1\n");
				const map = firstMap(doc);
				// Reference parity: raw slices; a bare `#` stores " " so it is
				// distinguishable from an embedded blank line ("").
				// With no `---` to separate it, a header block is just the first
				// own-line comment in the item stream, so it leads the first key.
				assert.strictEqual(map.items[0]?.key.commentBefore, "no-space\n   aligned\n ");
				assert.isUndefined(doc.commentBefore);
			}),
		);

		it.effect("embeds a blank line WITHIN a comment run; blank BEFORE the run is spaceBefore", () =>
			Effect.gen(function* () {
				const interior = yield* YamlDocument.parse("a: 1\n# one\n\n# two\nb: 2\n");
				const im = firstMap(interior);
				assert.strictEqual(im.items[1]?.key.commentBefore, " one\n\n two");
				assert.isUndefined(im.items[1]?.key.spaceBefore);

				const before = yield* YamlDocument.parse("a: 1\n\n# one\n# two\nb: 2\n");
				const bm = firstMap(before);
				assert.strictEqual(bm.items[1]?.key.commentBefore, " one\n two");
				assert.strictEqual(bm.items[1]?.key.spaceBefore, true);

				const after = yield* YamlDocument.parse("a: 1\n# one\n\nb: 2\n");
				const am = firstMap(after);
				assert.strictEqual(am.items[1]?.key.commentBefore, " one\n");
				assert.isUndefined(am.items[1]?.key.spaceBefore);
			}),
		);

		it.effect("a shallow terminal comment escapes the nested block to the next outer key", () =>
			Effect.gen(function* () {
				// Reference parity: a column-0 `# tail` after `c:`'s nested block
				// documents `e`, not the nested block — while a comment at the
				// nested content's column stays the nested map's trailing comment.
				const doc = yield* YamlDocument.parse("c:\n  d: 1\n# tail\n\ne: 3\n");
				const map = firstMap(doc);
				const cValue = map.items[0]?.value;
				assert.instanceOf(cValue, YamlMap);
				assert.isUndefined((cValue as YamlMap).comment);
				assert.strictEqual(map.items[1]?.key.commentBefore, " tail\n");
			}),
		);

		it.effect("joins a multi-line header comment onto the first key", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("# one\n# two\na: 1\n");
				assert.strictEqual(firstMap(doc).items[0]?.key.commentBefore, " one\n two");
			}),
		);

		it.effect("comments on BOTH sides of a `---` marker keep their sides", () =>
			Effect.gen(function* () {
				// The marker partitions the leading run per comment. Deciding once
				// from the first comment merged both sides into one block and
				// re-emitted the whole thing above the marker — lossless, but wrong,
				// and a fixed point, so it stayed wrong quietly.
				const doc = yield* YamlDocument.parse("# before\n---\n# after\na: 1\n");
				assert.strictEqual(doc.commentBefore, " before");
				assert.strictEqual(doc.contents?.commentBefore, " after");
				for (const text of ["# before\n---\n# after\na: 1\n", "# b1\n# b2\n---\n# a1\n# a2\na: 1\n"]) {
					assert.strictEqual(YamlFormat.formatToString(text), text);
				}
			}),
		);

		it.effect("a header AFTER a `---` marker leads the root node", () =>
			Effect.gen(function* () {
				const after = yield* YamlDocument.parse("---\n# hdr\na: 1\n");
				assert.isUndefined(after.commentBefore);
				assert.strictEqual(after.contents?.commentBefore, " hdr");
			}),
		);

		it.effect("a header AHEAD of a `---` marker is the document's commentBefore", () =>
			Effect.gen(function* () {
				// This was recorded as a known gap on the theory that the CST handed
				// the comment over in a position the leading branch could not claim.
				// It was not: `decorateDocumentSourceMultiline` — which runs on every
				// parse — wrote `commentBefore` into the `comment` key, so every
				// document header became a trailing comment on the way out. The two
				// sibling sites of that rename were caught by TS1117 as duplicate
				// keys; this one used conditional spreads and compiled clean.
				const doc = yield* YamlDocument.parse("# hdr\n---\na: 1\n");
				assert.strictEqual(doc.commentBefore, " hdr");
				assert.isUndefined(doc.comment);
				assert.strictEqual(YamlFormat.formatToString("# hdr\n---\na: 1\n"), "# hdr\n---\na: 1\n");
			}),
		);

		it.effect("captures comments after the document end marker as the document's comment", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("a: 1\n...\n# after\n");
				assert.strictEqual(doc.comment, " after");
				assert.isUndefined(doc.commentBefore);
			}),
		);
	});

	describe("stringifier emission", () => {
		const roundtrips = Effect.fn("roundtrips")(function* (source: string, options?: { readonly indentSequences?: boolean }) {
				const doc = yield* YamlDocument.parse(source);
				const out = yield* doc.stringify(options);
				assert.strictEqual(out, source);
				// And the emission is stable: parse(out) stringifies identically.
				const again = yield* YamlDocument.parse(out);
				assert.strictEqual(yield* again.stringify(options), out);
			});

		it.effect("emits leading, trailing and section comments in block mappings", () =>
			roundtrips("# doc header\n# line two\na: 1 # trailing a\n\n# section\nb: 2\n"),
		);

		it.effect("emits a mapping's trailing comment after its last entry", () =>
			roundtrips("a:\n  b: 1\n  # end of a\nc: 2\n"),
		);

		it.effect("emits blank lines preserved as spaceBefore", () => roundtrips("a: 1\n\nb: 2\n"));

		it.effect("emits raw comment text byte-intact: no-space, alignment, bare #", () =>
			roundtrips("a: 1 #tight\n#no-space\n#   aligned\n#\nb: 2\n"),
		);

		it.effect("emits spaces-only comment text byte-intact: bare # and trailing-space spellings (PR #338)", () =>
			Effect.gen(function* () {
				// `#` (raw "") and `# ` (raw " ") are DIFFERENT comment spellings;
				// the all-space capture escape keeps them apart from the embedded
				// blank line encoding so every one re-emits byte-intact.
				yield* roundtrips("a: 1\n#\nb: 2\n");
				yield* roundtrips("a: 1\n# \nb: 2\n");
				yield* roundtrips("a: 1 #\n");
				yield* roundtrips("a: 1 # \n");
				yield* roundtrips("# one\n\n# two\na: 1\n");
			}),
		);

		it.effect("an empty document keeps its markers and trailing comment (PR #338)", () =>
			Effect.gen(function* () {
				yield* roundtrips("---\n...\n# tail\n");
				yield* roundtrips("---\n");
				const doc = yield* YamlDocument.parse("---\n...\n# tail\n");
				assert.isNull(doc.contents);
				assert.strictEqual(doc.comment, " tail");
				assert.strictEqual(YamlFormat.formatToString("---\n...\n# tail\n"), "---\n...\n# tail\n");
			}),
		);

		it.effect("emits blank lines within and after a comment run byte-intact", () =>
			roundtrips("a: 1\n# one\n\n# two\nb: 2\nc:\n  d: 1\n# tail\n\ne: 3\n"),
		);

		it.effect("keeps a key-line comment on the key line when the value starts below", () =>
			roundtrips("a: # c\n  b: 1\n"),
		);

		it.effect("emits the document trailing comment after the end marker", () =>
			roundtrips("a: 1\n...\n# after\n# more\n"),
		);

		it.effect("emits a value's own leading comment above the spilled value", () => roundtrips("a:\n  # note\n  1\n"));

		it.effect("emits seq item comments in block style", () =>
			roundtrips("steps:\n  # first step\n  - build\n  # mid\n  - test # inline\n", { indentSequences: true }),
		);

		it.effect("emits comment-carrying flow collections in multi-line flow layout", () =>
			Effect.gen(function* () {
				// Single-line flow cannot carry `#` comments (they would swallow
				// the closing bracket), so comment-carrying flow collections
				// re-emit in multi-line flow layout — semantics preserved.
				const doc = yield* YamlDocument.parse("m: { a: 1, # c\n  b: 2 }\n");
				// Pin the exact FIRST emission (multi-line flow layout), not just
				// comment presence — see the seq own-line pin below.
				const out = yield* doc.stringify();
				assert.strictEqual(out, "m:\n  {\n    a: 1, # c\n    b: 2\n  }\n");
				assert.include(out, "a: 1, # c");
				assert.include(out, "{");
				assert.deepStrictEqual(yield* Yaml.parse(out), { m: { a: 1, b: 2 } });
				// Idempotent from the second pass on.
				const again = yield* YamlDocument.parse(out);
				assert.strictEqual(yield* again.stringify(), out);
			}),
		);

		it.effect("emits comment-carrying flow sequences in multi-line flow layout", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("s: [ one, # c\n  two ]\n");
				// Pin the exact FIRST emission (multi-line flow layout), not just
				// comment presence.
				const out = yield* doc.stringify();
				assert.strictEqual(out, "s:\n  [\n    one, # c\n    two\n  ]\n");
				assert.include(out, "# c");
				assert.include(out, "[");
				assert.deepStrictEqual(yield* Yaml.parse(out), { s: ["one", "two"] });
				const again = yield* YamlDocument.parse(out);
				assert.strictEqual(yield* again.stringify(), out);
			}),
		);

		it.effect("flow: an own-line comment attributes FORWARD to the next item, first emit a fixed point (PR #338)", () =>
			Effect.gen(function* () {
				// The comment sits on its own line between `a` and `b`; backward
				// attachment would render `a, # own` — which a REPARSE attributes
				// forward again, so the first emission would not be a fixed point.
				const doc = yield* YamlDocument.parse("[ a\n# own\n, b ]\n");
				const seq = doc.contents;
				assert.instanceOf(seq, YamlSeq);
				assert.strictEqual(((seq as YamlSeq).items[1] as YamlScalar).commentBefore, " own");
				const out = yield* doc.stringify();
				assert.strictEqual(out, "[\n  a,\n  # own\n  b\n]\n");
				const again = yield* YamlDocument.parse(out);
				assert.strictEqual(yield* again.stringify(), out);
			}),
		);

		it.effect(
			"flow: a same-line comment still trails its item; the following own-line comment goes forward (PR #338)",
			() =>
				Effect.gen(function* () {
					const doc = yield* YamlDocument.parse("[ a # t\n# own\n, b ]\n");
					const seq = doc.contents as YamlSeq;
					assert.strictEqual((seq.items[0] as YamlScalar).comment, " t");
					assert.strictEqual((seq.items[1] as YamlScalar).commentBefore, " own");
					const out = yield* doc.stringify();
					assert.strictEqual(out, "[\n  a, # t\n  # own\n  b\n]\n");
					const again = yield* YamlDocument.parse(out);
					assert.strictEqual(yield* again.stringify(), out);
				}),
		);

		it.effect("flow: an own-line comment after the last item becomes the sequence's trailing comment (PR #338)", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("[ a,\nb\n# own\n]\n");
				const seq = doc.contents as YamlSeq;
				assert.strictEqual(seq.comment, " own");
				// Pin the exact FIRST emission — a stringifier that dropped or
				// relocated `# own` could still fixed-point on its reduced output.
				const out = yield* doc.stringify();
				assert.strictEqual(out, "[\n  a,\n  b\n  # own\n]\n");
				const again = yield* YamlDocument.parse(out);
				assert.strictEqual(yield* again.stringify(), out);
			}),
		);

		describe("flow blank-line fidelity (PR #338 review)", () => {
			// Closers sit indented past the block level so #340 strictness
			// accepts the parse. First emission is the multi-line flow
			// re-layout (expected); each pin asserts the exact first output
			// INCLUDING the blank line, then the fixed point.

			it.effect("flow seq: the blank line before an own-line comment run survives", () =>
				Effect.gen(function* () {
					const source = "a: [\n  1,\n\n  # c\n  2\n  ]\n";
					const doc = yield* YamlDocument.parse(source);
					const seq = firstMap(doc).items[0]?.value;
					assert.instanceOf(seq, YamlSeq);
					const second = (seq as YamlSeq).items[1] as YamlScalar;
					assert.strictEqual(second.commentBefore, " c");
					assert.strictEqual(second.spaceBefore, true);
					const out = YamlFormat.formatToString(source);
					assert.strictEqual(out, "a:\n  [\n    1,\n\n    # c\n    2\n  ]\n");
					assert.strictEqual(YamlFormat.formatToString(out), out);
				}),
			);

			it.effect("flow map control: the blank line before an own-line comment run stays preserved", () =>
				Effect.gen(function* () {
					const source = "m: {\n  a: 1,\n\n  # c\n  b: 2\n  }\n";
					const doc = yield* YamlDocument.parse(source);
					const map = firstMap(doc).items[0]?.value;
					assert.instanceOf(map, YamlMap);
					assert.strictEqual((map as YamlMap).items[1]?.key.commentBefore, " c");
					assert.strictEqual((map as YamlMap).items[1]?.key.spaceBefore, true);
					const out = YamlFormat.formatToString(source);
					assert.strictEqual(out, "m:\n  {\n    a: 1,\n\n    # c\n    b: 2\n  }\n");
					assert.strictEqual(YamlFormat.formatToString(out), out);
				}),
			);

			it.effect("flow seq: the blank line before the TERMINAL comment run survives as a leading embed", () =>
				Effect.gen(function* () {
					const source = "a: [\n  1,\n  2\n\n  # tail\n  ]\n";
					const doc = yield* YamlDocument.parse(source);
					const seq = firstMap(doc).items[0]?.value;
					assert.instanceOf(seq, YamlSeq);
					assert.strictEqual((seq as YamlSeq).comment, "\n tail");
					const out = YamlFormat.formatToString(source);
					assert.strictEqual(out, "a:\n  [\n    1,\n    2\n\n    # tail\n  ]\n");
					assert.strictEqual(YamlFormat.formatToString(out), out);
				}),
			);

			it.effect("flow seq: a blank WITHIN a comment run embeds as an empty line", () =>
				Effect.gen(function* () {
					const source = "a: [\n  1,\n\n  # c1\n\n  # c2\n  2\n  ]\n";
					const doc = yield* YamlDocument.parse(source);
					const seq = firstMap(doc).items[0]?.value;
					assert.instanceOf(seq, YamlSeq);
					const second = (seq as YamlSeq).items[1] as YamlScalar;
					assert.strictEqual(second.commentBefore, " c1\n\n c2");
					assert.strictEqual(second.spaceBefore, true);
					const out = YamlFormat.formatToString(source);
					assert.strictEqual(out, "a:\n  [\n    1,\n\n    # c1\n\n    # c2\n    2\n  ]\n");
					assert.strictEqual(YamlFormat.formatToString(out), out);
				}),
			);

			// A collection's OWN trailing comment renders AFTER the closing
			// bracket, so it cannot swallow it and is no reason to expand a
			// single-line flow. Only a comment on an ITEM forces the
			// one-entry-per-line layout. The reference agrees: yaml@2.9.0
			// re-emits both spellings as `a: { b: 1 } # t`.
			it.effect("an inline flow map with only a trailing comment stays on one line", () =>
				Effect.gen(function* () {
					const source = "a: {b: 1} # t\n";
					const map = firstMap(yield* YamlDocument.parse(source)).items[0]?.value;
					assert.instanceOf(map, YamlMap);
					assert.strictEqual((map as YamlMap).comment, " t");
					const out = YamlFormat.formatToString(source);
					assert.strictEqual(out, "a: {b: 1} # t\n");
					assert.strictEqual(YamlFormat.formatToString(out), out);
				}),
			);

			it("an inline flow seq with only a trailing comment stays on one line", () => {
				const source = "a: [1, 2] # t\n";
				const out = YamlFormat.formatToString(source);
				assert.strictEqual(out, "a: [1, 2] # t\n");
				assert.strictEqual(YamlFormat.formatToString(out), out);
			});

			it("an INNER comment still forces the multi-line flow layout", () => {
				const source = "a: {\n  b: 1 # inner\n  }\n";
				const out = YamlFormat.formatToString(source);
				assert.strictEqual(out, "a:\n  {\n    b: 1 # inner\n  }\n");
				assert.strictEqual(YamlFormat.formatToString(out), out);
			});

			it.effect("flow seq nested in a block mapping keeps the blank line", () =>
				Effect.gen(function* () {
					const source = "top:\n  inner: [\n    1,\n\n    # c\n    2\n    ]\n";
					const out = YamlFormat.formatToString(source);
					assert.strictEqual(out, "top:\n  inner:\n    [\n      1,\n\n      # c\n      2\n    ]\n");
					assert.strictEqual(YamlFormat.formatToString(out), out);
					assert.deepStrictEqual(yield* Yaml.parse(out), { top: { inner: [1, 2] } });
				}),
			);
		});

		it.effect("emits comments on explicit-key spill pairs (#323 interaction)", () =>
			Effect.gen(function* () {
				const key = `pkg-a@1.0.0(${"a".repeat(1100)})`;
				const source = `# entry\n? ${key}\n: 1 # one\n`;
				const doc = yield* YamlDocument.parse(source);
				const out = yield* doc.stringify();
				assert.include(out, "# entry");
				assert.include(out, ": 1 # one");
				const again = yield* YamlDocument.parse(out);
				assert.strictEqual(yield* again.stringify(), out);
			}),
		);

		describe("block-scalar header comments (#341)", () => {
			// The header line is the ONE line of a block scalar that legally
			// carries a `#` comment; the lexer packs it inside the scalar's CST
			// token, so makeScalar captures it as the SCALAR's trailing comment
			// (reference `yaml` parity) and the stringifier re-emits it on the
			// header line. Each case is a byte-pinned fixed point.
			const roundtrips: ReadonlyArray<readonly [string, string]> = [
				["map literal", "a: | # hdr\n  body\n"],
				["map folded", "a: > # hdr\n  body\n"],
				["seq literal", "- | # hdr\n  body\n"],
				["seq folded", "- > # hdr\n  body\n"],
				["map strip-chomp", "a: |- # hdr\n  body\n"],
				["seq strip-chomp", "- |- # hdr\n  body\n"],
				// Explicit header indicators the value alone cannot derive
				// (CodeRabbit PR #338): a redundant keep-chomp and a redundant
				// indentation indicator both re-emit byte-intact.
				["map keep-chomp", "a: |+ # hdr\n  body\n"],
				["seq keep-chomp", "- |+ # hdr\n  body\n"],
				["map folded keep-chomp", "a: >+ # hdr\n  body\n"],
				["map indent indicator", "a: |2 # hdr\n  body\n"],
				["map folded indent indicator", "a: >2 # hdr\n  body\n"],
				["map indent indicator with keep", "a: |2+ # hdr\n  body\n"],
				["map keep-chomp bare header", "a: |+\n  body\n"],
				["map indent indicator bare header", "a: |2\n  body\n"],
			];
			for (const [name, source] of roundtrips) {
				it.effect(`roundtrips byte-intact: ${name}`, () =>
					Effect.gen(function* () {
						const doc = yield* YamlDocument.parse(source);
						const out = yield* doc.stringify();
						assert.strictEqual(out, source);
						const again = yield* YamlDocument.parse(out);
						assert.strictEqual(yield* again.stringify(), out);
					}),
				);
			}

			it.effect("captures the header comment on the SCALAR node", () =>
				Effect.gen(function* () {
					// A block scalar's header comment is simply the entry's trailing
					// comment: the header line IS the line the value ends on, so it
					// needs no concept of its own.
					const doc = yield* YamlDocument.parse("a: | # hdr\n  body\n");
					const pair = firstMap(doc).items[0];
					assert.isUndefined(pair?.key.commentBefore);
					const scalar = pair?.value as YamlScalar;
					assert.instanceOf(scalar, YamlScalar);
					assert.strictEqual(scalar.comment, " hdr");
					assert.strictEqual(scalar.value, "body\n");
				}),
			);

			it.effect("captures a seq item's header comment on the item scalar", () =>
				Effect.gen(function* () {
					const doc = yield* YamlDocument.parse("- | # hdr\n  body\n");
					assert.instanceOf(doc.contents, YamlSeq);
					const item = (doc.contents as YamlSeq).items[0];
					assert.instanceOf(item, YamlScalar);
					assert.strictEqual((item as YamlScalar).comment, " hdr");
				}),
			);

			it.effect("emits the header comment on an explicit-key spill pair's value header", () =>
				Effect.gen(function* () {
					const key = `pkg-a@1.0.0(${"a".repeat(1100)})`;
					const source = `? ${key}\n: | # hdr\n  body\n`;
					const doc = yield* YamlDocument.parse(source);
					const out = yield* doc.stringify();
					assert.strictEqual(out, source);
					const again = yield* YamlDocument.parse(out);
					assert.strictEqual(yield* again.stringify(), out);
				}),
			);

			it.effect("a key-line comment and a header comment both land on the value, in different slots", () =>
				Effect.gen(function* () {
					// Two slots on one node rather than a pair slot competing with a
					// scalar slot: the key-line comment LEADS the value, the header
					// comment TRAILS it. Neither has to displace the other.
					const source = "a: # pair\n  | # hdr\n  body\n";
					const doc = yield* YamlDocument.parse(source);
					const pair = firstMap(doc).items[0];
					assert.strictEqual(pair?.key.comment, " pair");
					const scalar = pair?.value as YamlScalar;
					assert.instanceOf(scalar, YamlScalar);
					assert.strictEqual(scalar.comment, " hdr");
					// Both want the key line, because the block-scalar header hoists
					// onto it. The header wins the line and the key's comment spills
					// above — one comment per line, neither dropped.
					const out = yield* doc.stringify();
					assert.strictEqual((out.match(/#/g) ?? []).length, 2);
					const again = yield* YamlDocument.parse(out);
					assert.strictEqual(yield* again.stringify(), out);
				}),
			);

			it.effect("a key-line comment rides along when the header hoists onto the key line", () =>
				Effect.gen(function* () {
					// The scalar's header is emitted on the key line, so a comment
					// written on that line lands after it. Relocation within the same
					// line, not across lines — and a fixed point.
					const doc = yield* YamlDocument.parse("a: # pair\n  |\n  body\n");
					const out = yield* doc.stringify();
					assert.strictEqual(out, "a: | # pair\n  body\n");
					const again = yield* YamlDocument.parse(out);
					assert.strictEqual(yield* again.stringify(), out);
				}),
			);

			it.effect("captures the explicit indicators on the scalar: chomp keep and blockIndent", () =>
				Effect.gen(function* () {
					const doc = yield* YamlDocument.parse("a: |2+ # hdr\n  body\n");
					const scalar = firstMap(doc).items[0]?.value as YamlScalar;
					assert.strictEqual(scalar.chomp, "keep");
					assert.strictEqual(scalar.blockIndent, 2);
					assert.strictEqual(scalar.value, "body\n");
					// No explicit indicator → no captured field.
					const doc2 = yield* YamlDocument.parse("a: |\n  body\n");
					const scalar2 = firstMap(doc2).items[0]?.value as YamlScalar;
					assert.isUndefined(scalar2.blockIndent);
				}),
			);

			it.effect("an explicit indicator that no longer matches the rendered indent normalizes away", () =>
				Effect.gen(function* () {
					// blockIndent 4 with a rendered indent of 2 would lie about the
					// content columns — the header falls back to auto-detection.
					const doc = yield* YamlDocument.parse("a: |4\n    body\n");
					const scalar = firstMap(doc).items[0]?.value as YamlScalar;
					assert.strictEqual(scalar.blockIndent, 4);
					assert.strictEqual(scalar.value, "body\n");
					assert.strictEqual(yield* doc.stringify(), "a: |\n  body\n");
				}),
			);

			it.effect("a +/- inside the header comment is not a chomp indicator (regression)", () =>
				Effect.gen(function* () {
					// getBlockChomp once scanned the whole header line, so a `+` in
					// `# x+y` parsed as keep-chomp and re-emitted as `|+`, changing
					// what the document means.
					const doc = yield* YamlDocument.parse("a: | # x+y\n  body\n");
					const scalar = firstMap(doc).items[0]?.value as YamlScalar;
					assert.strictEqual(scalar.chomp, "clip");
					assert.strictEqual(yield* doc.stringify(), "a: | # x+y\n  body\n");

					const doc2 = yield* YamlDocument.parse("a: | # strip-me\n  body\n");
					const scalar2 = firstMap(doc2).items[0]?.value as YamlScalar;
					assert.strictEqual(scalar2.chomp, "clip");
				}),
			);

			it("survives the YamlFormat path", () => {
				const text = "a: | # hdr\n  body\nb: 1\n";
				assert.strictEqual(YamlFormat.formatToString(text), text);
			});
		});

		describe("document-root block-scalar header comments (#349)", () => {
			// The pair, seq-item and explicit-key paths each splice the scalar's
			// captured header comment back onto the header line (#341); the
			// DOCUMENT ROOT was the fourth caller and had no slot, so the comment
			// was captured on the node and silently dropped on emit. Every root
			// spelling is a byte-pinned fixed point — including the two that
			// return through the tag/anchor branch of stringifyDocument.
			const roundtrips: ReadonlyArray<readonly [string, string]> = [
				["literal", "| # hdr\n  body\n"],
				["folded", "> # hdr\n  body\n"],
				["strip-chomp", "|- # hdr\n  body\n"],
				["keep-chomp", "|+ # hdr\n  body\n"],
				["indent indicator", "|2 # hdr\n  body\n"],
				["after a document start marker", "--- | # hdr\n  body\n"],
				["with an anchor", "&a | # hdr\n  body\n"],
				["with a tag", "!!str | # hdr\n  body\n"],
			];
			for (const [name, source] of roundtrips) {
				it.effect(`roundtrips byte-intact: ${name}`, () =>
					Effect.gen(function* () {
						const doc = yield* YamlDocument.parse(source);
						const out = yield* doc.stringify();
						assert.strictEqual(out, source);
						const again = yield* YamlDocument.parse(out);
						assert.strictEqual(yield* again.stringify(), out);
					}),
				);
			}

			it.effect("captures the header comment on the root scalar", () =>
				Effect.gen(function* () {
					const doc = yield* YamlDocument.parse("| # hdr\n  body\n");
					assert.instanceOf(doc.contents, YamlScalar);
					assert.strictEqual((doc.contents as YamlScalar).comment, " hdr");
					assert.strictEqual((doc.contents as YamlScalar).value, "body\n");
				}),
			);

			it("survives the YamlFormat path", () => {
				const text = "| # hdr\n  body\n";
				assert.strictEqual(YamlFormat.formatToString(text), text);
			});

			it.effect("canonical mode still drops it", () =>
				Effect.gen(function* () {
					const doc = yield* YamlDocument.parse("| # hdr\n  body\n");
					assert.notInclude(yield* doc.stringify({ forceDefaultStyles: true }), "#");
				}),
			);
		});

		describe("comment slots surfaced by the PR #384 review", () => {
			// Each of these is a distinct missing or mis-shared slot. All four
			// are byte-intact round trips: the source shapes are legal YAML a
			// consumer writes, and a format pass has no licence to move or drop
			// any of them.

			it("keeps a blank line on the side of the marker it was written on", () => {
				// One shared `lastLeadingCommentOffset` embedded the blank below
				// an AFTER-marker comment into the PRE-marker block, moving it
				// across the marker — and the result was not even a fixed point.
				const source = "# a\n---\n# b\n\nx: 1\n";
				const out = YamlFormat.formatToString(source);
				assert.strictEqual(out, source);
				assert.strictEqual(YamlFormat.formatToString(out), out);
			});

			it("keeps an after-marker comment when the document has no content", () => {
				// `headerForDocument` was already taken by the pre-marker run, and
				// there is no content node to lead, so the after-marker run fell
				// through both branches and was discarded.
				const source = "# a\n---\n# b\n";
				const out = YamlFormat.formatToString(source);
				assert.strictEqual((out.match(/#/g) ?? []).length, 2);
				assert.include(out, "# a");
				assert.include(out, "# b");
				assert.strictEqual(YamlFormat.formatToString(out), out);
			});

			it("leaves a value's trailing comment on the value's line under a leading block", () => {
				// The key line routed through `entryTrailing`, which reaches past
				// an absent key comment to the VALUE's — printing it on the key
				// line and then skipping the value's own.
				const source = "a:\n  # lead\n  1 # vc\n";
				const out = YamlFormat.formatToString(source);
				assert.strictEqual(out, source);
				assert.strictEqual(YamlFormat.formatToString(out), out);
			});

			it("keeps a key-line comment on an ALIAS key's line", () => {
				// `keyIsSimple` rejected every non-scalar, but the stringifier
				// emits an alias key in implicit form, so the key does own its
				// line and the comment belongs on it.
				const source = "a: &x 1\n*x : # c\n  2\n";
				const out = YamlFormat.formatToString(source);
				assert.include(out, "# c");
				assert.notInclude(out, "2 # c");
				assert.strictEqual(YamlFormat.formatToString(out), out);
			});

			it("emits a marker-LESS header over a scalar root", () => {
				// The header is stored on the root node itself for a scalar root,
				// and the emission slot was gated on a `---` marker being present,
				// so without one the comment was captured and dropped.
				const source = "# h\n42\n";
				const out = YamlFormat.formatToString(source);
				assert.strictEqual(out, source);
				assert.strictEqual(YamlFormat.formatToString(out), out);
			});
		});

		describe("explicit-key pairs emit their value's leading comment (#348)", () => {
			// Every sibling branch of the block-mapping stringifier consults the
			// value node's own `commentBefore`; the explicit-key (`? k` / `: v`)
			// branch did not, so a value-level leading comment was dropped on
			// emit. RZP5 and XW4D in the yaml-test-suite corpus are this shape.

			it.effect("keeps both comments on an explicit-key entry and stays a fixed point", () =>
				Effect.gen(function* () {
					const source = "? - seq1\n: # lala\n  #lala\n  - seq2\n";
					const doc = yield* YamlDocument.parse(source);
					const value = firstMap(doc).items[0]?.value;
					assert.instanceOf(value, YamlSeq);
					// Both comments sit on the `:` side with the value below, so both
					// lead the value and join into one run — neither is dropped.
					assert.include((value as YamlSeq).commentBefore ?? "", "lala");
					const out = yield* doc.stringify();
					assert.strictEqual(YamlFormat.formatToString(out), out);
					assert.strictEqual((out.match(/#/g) ?? []).length, 2);
				}),
			);

			it("reaches its fixed point on the FIRST format pass", () => {
				const once = YamlFormat.formatToString("? - seq1\n: # lala\n - #lala\n  seq2\n");
				// Pin the bytes too, not just the idempotence: asserting only
				// `f(f(x)) === f(x)` stays green no matter how `f(x)` drifts.
				assert.strictEqual(once, "? - seq1\n:\n  #lala\n  - seq2\n  # lala\n");
				assert.strictEqual(YamlFormat.formatToString(once), once);
			});

			it.effect("a value leading comment ALONE survives an explicit-key pair", () =>
				Effect.gen(function* () {
					const source = "? - seq1\n:\n  #lead\n  - seq2\n";
					const doc = yield* YamlDocument.parse(source);
					const seq = firstMap(doc).items[0]?.value as YamlSeq;
					assert.strictEqual(seq.commentBefore, "lead");
					assert.strictEqual(yield* doc.stringify(), source);
				}),
			);
		});

		describe("a terminal comment survives a last pair with a NULL value (#348)", () => {
			// An own-line comment after a mapping's last pair is the mapping's
			// own trailing `comment` (the control below pins the model). When the
			// last pair's value was EMPTY, consumeValueNode consumed the comment
			// looking for a value and the caller then discarded it, because a
			// leading comment can only attach to a value node that exists. The
			// comment was lost on a single format pass. NKF9 in the corpus.

			// At the ROOT the terminal run belongs to the DOCUMENT — the document
			// is the root collection's enclosing scope, so the same escape rule
			// that hands a shallow terminal comment outward applies at the top.
			it.effect("control: a non-null last value keeps it", () =>
				Effect.gen(function* () {
					const doc = yield* YamlDocument.parse("x: 1\n# c\n");
					assert.strictEqual(doc.comment, " c");
				}),
			);

			it.effect("a null last value keeps it too", () =>
				Effect.gen(function* () {
					const doc = yield* YamlDocument.parse("x:\n# c\n");
					assert.strictEqual(doc.comment, " c");
				}),
			);

			it.effect("an empty KEY and value keeps it", () =>
				Effect.gen(function* () {
					const doc = yield* YamlDocument.parse(":\n# c\n");
					assert.strictEqual(doc.comment, " c");
				}),
			);

			it("a null last value is a fixed point through the format path", () => {
				for (const text of ["x:\n# c\n", ":\n# c\n", ":\n# c\n---\n{: null}\n"]) {
					assert.strictEqual(YamlFormat.formatToString(text), text);
				}
			});

			it("the comment still forward-attributes when a pair follows it", () => {
				// Rewinding must not steal the comment from the NEXT pair: with a
				// following key this is `commentBefore`, not a terminal run.
				const text = "x:\n# c\ny: 2\n";
				assert.strictEqual(YamlFormat.formatToString(text), text);
			});

			it("keeps both header comments across two empty-key documents", () => {
				const once = YamlFormat.formatToString("---\n# c1\n:\n---\n# c2\n{ : }\n");
				assert.include(once, "# c1");
				assert.include(once, "# c2");
				assert.strictEqual(YamlFormat.formatToString(once), once);
			});
		});

		it.effect("canonical mode (forceDefaultStyles) stays comment-free — the conformance contract", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("# doc\na: 1 # trailing\n\n# section\nb: 2\n");
				const out = yield* doc.stringify({ forceDefaultStyles: true });
				assert.notInclude(out, "#");
				assert.strictEqual(out, "a: 1\nb: 2\n");
			}),
		);
	});

	describe("YamlFormat.formatToString — the systems repro gate", () => {
		const fixture = readFileSync(new URL("./fixtures/comment-fidelity/workflow.yaml", import.meta.url), "utf8");

		it("roundtrips the workflow repro byte-intact (fixed point)", () => {
			const options = { indentSequences: true };
			const out = YamlFormat.formatToString(fixture, undefined, options);
			assert.strictEqual(out, fixture);
		});

		it("preserveComments keeps its name: true preserves per-node comments, false strips them", () => {
			const preserved = YamlFormat.formatToString(fixture, undefined, { indentSequences: true });
			assert.include(preserved, "# Deploy workflow");
			assert.include(preserved, "# only main");
			assert.include(preserved, "# check the repo out");
			assert.include(preserved, "# install deps");

			const stripped = YamlFormat.formatToString(fixture, undefined, {
				indentSequences: true,
				preserveComments: false,
			});
			assert.notInclude(stripped, "#");
		});

		it.effect("formatting preserves the parsed value exactly", () =>
			Effect.gen(function* () {
				const out = YamlFormat.formatToString(fixture, undefined, { indentSequences: true });
				assert.deepStrictEqual(yield* Yaml.parse(out), yield* Yaml.parse(fixture));
			}),
		);
	});

	describe("blank-line fidelity — header block and terminal comment run (systems item 10)", () => {
		// Both repro shapes are CAPTURE-side embeds: a blank line adjacent to a
		// comment run stores as an empty line in the joined comment string
		// (trailing for the document header, leading for a collection's
		// terminal run), so emission needs no new state.

		it("keeps the blank line between a document-header comment block and the first key (fixed point)", () => {
			for (const text of ["# hdr\n# hdr2\n\nversion: 2\n", "# hdr\n\nversion: 2\n"]) {
				assert.strictEqual(YamlFormat.formatToString(text), text);
			}
		});

		it("keeps the blank line between a doc-header block and a `---` marker (fixed point)", () => {
			const text = "# hdr\n\n---\nversion: 2\n";
			assert.strictEqual(YamlFormat.formatToString(text), text);
		});

		it("roundtrips a dependabot-style header byte-intact (fixed point)", () => {
			const fixture = readFileSync(new URL("./fixtures/comment-fidelity/dependabot.yaml", import.meta.url), "utf8");
			assert.strictEqual(YamlFormat.formatToString(fixture, undefined, { indentSequences: true }), fixture);
		});

		it.effect("captures the header's trailing blank as a trailing empty line", () =>
			Effect.gen(function* () {
				const doc = yield* YamlDocument.parse("# hdr\n\nversion: 2\n");
				assert.strictEqual(firstMap(doc).items[0]?.key.commentBefore, " hdr\n");
			}),
		);

		it("keeps the blank line before a nested mapping's terminal comment run (claude.yml reduction, fixed point)", () => {
			for (const text of [
				"m:\n  a: 1\n\n  # c\n",
				"m:\n  a: |\n    text\n\n  # c\n",
				"m:\n  a: |\n    text\n\n  # c1\n  b: 2\n\n  # c2\n  # c3\n\n  # c4\n",
			]) {
				assert.strictEqual(YamlFormat.formatToString(text), text);
			}
		});

		it("keeps the blank line before a block sequence's terminal comment run (fixed point)", () => {
			const text = "s:\n  - 1\n\n  # c\n";
			assert.strictEqual(YamlFormat.formatToString(text, undefined, { indentSequences: true }), text);
		});

		it("controls: pre-existing blank-line shapes stay untouched", () => {
			for (const text of [
				"a: 1\n\nb: 2\n",
				"a: 1\n\n# c\nb: 2\n",
				"a: |\n  text\n\n# c\nb: 2\n",
				"# hdr\nversion: 2\n", // no blank — none invented
				"m:\n  a: 1\n  # c\n", // terminal run without a blank — none invented
				"m:\n  a: 1\n\n# tail\nnext: 2\n", // escaped-to-outer comment keeps its blank
			]) {
				assert.strictEqual(YamlFormat.formatToString(text), text);
			}
		});

		it("accepted normalizations hold: blank runs collapse to one, whitespace-only lines strip", () => {
			assert.strictEqual(YamlFormat.formatToString("a: 1\n\n\nb: 2\n"), "a: 1\n\nb: 2\n");
			assert.strictEqual(YamlFormat.formatToString("# hdr\n\n\nversion: 2\n"), "# hdr\n\nversion: 2\n");
			assert.strictEqual(YamlFormat.formatToString("a: 1\n   \nb: 2\n"), "a: 1\n\nb: 2\n");
		});
	});

	describe("visitor", () => {
		it.effect("Comment events discriminate leading from trailing placement", () =>
			Effect.gen(function* () {
				const events = yield* Stream.runCollect(
					YamlVisitor.visit("# header\n# section\na: 1 # trailing\n...\n# tail\n"),
				);
				const comments = [...events]
					.filter((e) => e._tag === "Comment")
					.map((e) => e as { readonly text: string; readonly placement: "leading" | "trailing" });
				assert.deepStrictEqual(
					comments.map((c) => [c.placement, c.text]),
					[
						["leading", " header\n section"],
						["trailing", " trailing"],
						["trailing", " tail"],
					],
				);
			}),
		);
	});

	// ── Format properties over the fidelity inputs ──────────────────────────
	//
	// Fixed-point fixtures pin bytes for shapes we know about; the two
	// properties below hold for EVERY fidelity input, known or not:
	// idempotence (format∘format === format — a second pass that moves is
	// rewriting content) and meaning preservation (parse∘format === parse).
	// The keep-chomp growth regression violated both while every byte fixture
	// of the day stayed green — hence properties, not more fixtures.
	describe("format properties over the fidelity inputs", () => {
		const fileFixtures: ReadonlyArray<readonly [string, string, { indentSequences?: boolean }]> = [
			[
				"workflow.yaml",
				readFileSync(new URL("./fixtures/comment-fidelity/workflow.yaml", import.meta.url), "utf8"),
				{ indentSequences: true },
			],
			[
				"dependabot.yaml",
				readFileSync(new URL("./fixtures/comment-fidelity/dependabot.yaml", import.meta.url), "utf8"),
				{ indentSequences: true },
			],
		];
		const inlineInputs: ReadonlyArray<string> = [
			"a: 1\n\n# section\nb: 2\n",
			"a: 1 # trailing a\nb: 2\n",
			"a: 1\n# line one\n# line two\nb: 2\n",
			"a: 1\n\nb: 2\n",
			"a:\n  b: 1\n  # end of a\nc: 2\n",
			"steps:\n  # first step\n  - build\n  # mid\n  - test # inline\n",
			"# hdr\n# hdr2\n\nversion: 2\n",
			"# hdr\n\n---\nversion: 2\n",
			"m:\n  a: 1\n\n  # c\n",
			"m:\n  a: |\n    text\n\n  # c\n",
			"m:\n  a: |\n    text\n\n  # c1\n  b: 2\n\n  # c2\n  # c3\n\n  # c4\n",
			"a: 1\n\n# c\nb: 2\n",
			"a: |\n  text\n\n# c\nb: 2\n",
			"m:\n  a: 1\n\n# tail\nnext: 2\n",
			"a: |+\n  text\n\nb: 1\n",
			"a: >+\n  text\n\n# tail\n",
			"# header\n# section\na: 1 # trailing\n...\n# tail\n",
		];

		for (const [name, fixture, options] of fileFixtures) {
			it(`idempotence + meaning preservation — ${name}`, () => {
				const once = YamlFormat.formatToString(fixture, undefined, options);
				assert.strictEqual(YamlFormat.formatToString(once, undefined, options), once);
				assert.deepStrictEqual(Result.getOrThrow(Yaml.parseResult(once)), Result.getOrThrow(Yaml.parseResult(fixture)));
			});
		}

		for (const input of inlineInputs) {
			it(`idempotence + meaning preservation — ${JSON.stringify(input)}`, () => {
				const once = YamlFormat.formatToString(input);
				assert.strictEqual(YamlFormat.formatToString(once), once);
				assert.deepStrictEqual(
					Result.getOrThrow(Yaml.parseAllResult(once)),
					Result.getOrThrow(Yaml.parseAllResult(input)),
				);
			});
		}
	});
});
