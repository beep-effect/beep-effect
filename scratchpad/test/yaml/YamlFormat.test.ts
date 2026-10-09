// @effect-diagnostics nodeBuiltinImport:skip-file
import { readFileSync } from "node:fs";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import { Yaml, YamlEdit } from "../../effected/yaml/index.ts";
import { composeAllDocuments } from "../../effected/yaml/internal/composer/document.ts";
import { YamlFormat, YamlFormattingOptions, YamlModificationError } from "../../effected/yaml/YamlFormat.ts";

const apply = (text: string, edits: ReadonlyArray<YamlEdit>) => YamlEdit.applyAll(text, edits);

describe("YamlFormat", () => {
	describe("format", () => {
		it("computes edits that reformat indentation", () => {
			const text = "a:\n    b: 1\n";
			const edits = YamlFormat.format(text);
			const out = apply(text, edits);
			assert.strictEqual(Yaml.equalsValue(out, { a: { b: 1 } }), true);
			assert.notStrictEqual(out, text);
		});

		it("is idempotent — formatting a formatted document is a no-op", () => {
			const text = "a:\n    b: 1\nc:\n  - 1\n  -   2\n";
			const once = YamlFormat.formatToString(text);
			const twice = YamlFormat.formatToString(once);
			assert.strictEqual(once, twice);
		});

		it("preserves a leading document comment by default", () => {
			// The stringifier only ever re-emits the document-level leading
			// comment (verified against v3: per-node/per-pair comments are
			// captured on the AST for round-trip detection but are not
			// re-serialized by either engine) — preserveComments governs this.
			const text = "# top comment\na: 1\n";
			const out = YamlFormat.formatToString(text);
			assert.include(out, "# top comment");
		});

		it("strips the document comment when preserveComments is false", () => {
			const text = "# drop me\na: 1\n";
			const out = YamlFormat.formatToString(text, undefined, YamlFormattingOptions.make({ preserveComments: false }));
			assert.notInclude(out, "drop me");
		});

		it("returns no edits for malformed input rather than corrupting it", () => {
			const text = "a: *undefined_alias\n";
			assert.deepStrictEqual(YamlFormat.format(text), []);
			assert.strictEqual(YamlFormat.formatToString(text), text);
		});

		it("restricts returned edits to a positional range", () => {
			const text = "a:\n    b: 1\nc:\n    d: 2\n";
			const full = YamlFormat.format(text);
			assert.isAbove(full.length, 0);
			// A zero-length range at the very start admits no edit.
			const restricted = YamlFormat.format(text, { offset: 0, length: 0 });
			assert.deepStrictEqual(restricted, []);
		});

		it("accepts a plain range object identically to a YamlRange instance", () => {
			const text = "a:\n    b: 1\n";
			const plain = YamlFormat.format(text, { offset: 0, length: 0 });
			assert.deepStrictEqual(plain, []);
		});

		it("honors options.range as a fallback when no positional range is given", () => {
			const text = "a:\n    b: 1\n";
			const viaOptions = YamlFormat.format(
				text,
				undefined,
				YamlFormattingOptions.make({ range: { offset: 0, length: 0 } }),
			);
			assert.deepStrictEqual(viaOptions, []);
		});
	});

	describe("finalNewline: false — governs the end of the OUTPUT, never an internal separator", () => {
		// Before this fix, finalNewline: false stripped the newline BETWEEN the
		// body and a following `...` end marker (or trailing comment block),
		// gluing them onto the last content line: "a: 1\n...\n" formatted to
		// "a: 1...\n", which re-parses as { a: "1..." } — a silent value change.
		const options = YamlFormattingOptions.make({ finalNewline: false });

		it("keeps a `...` end marker on its own line (byte-pinned)", () => {
			const out = YamlFormat.formatToString("a: 1\n...\n", undefined, options);
			assert.strictEqual(out, "a: 1\n...");
		});

		it("keeps a trailing comment block on its own line (byte-pinned)", () => {
			const out = YamlFormat.formatToString("a: 1\n# tail\n", undefined, options);
			assert.strictEqual(out, "a: 1\n# tail");
		});

		it("keeps a comment block after the `...` marker on its own line (byte-pinned)", () => {
			const out = YamlFormat.formatToString("a: 1\n...\n# tail\n", undefined, options);
			assert.strictEqual(out, "a: 1\n...\n# tail");
		});

		it("keeps the last document's `...` marker in a stream on its own line (byte-pinned)", () => {
			const out = YamlFormat.formatToString("x: 1\n---\na: 1\n...\n", undefined, options);
			assert.strictEqual(out, "x: 1\n---\na: 1\n...");
		});

		it("still drops the trailing newline when nothing follows the body (byte-pinned)", () => {
			const out = YamlFormat.formatToString("a: 1\n", undefined, options);
			assert.strictEqual(out, "a: 1");
		});

		it.effect("preserves meaning on the marker and comment shapes", () =>
			Effect.gen(function* () {
				for (const input of ["a: 1\n...\n", "a: 1\n# tail\n", "a: 1\n...\n# tail\n", "hello\n...\n"]) {
					const out = YamlFormat.formatToString(input, undefined, options);
					const original = yield* Yaml.parse(input);
					const formatted = yield* Yaml.parse(out);
					assert.deepStrictEqual(formatted, original);
				}
			}),
		);
	});

	describe("multi-document streams — formatted whole, never truncated", () => {
		// Before this contract, formatToString("a: 1\n---\nb: 2\n") returned
		// "a: 1\n" and silently destroyed documents 2..n (probe-verified
		// downstream, writing format output back to disk). Streams now format
		// every document, re-emitting each document's own framing.
		it("formats every document of a stream, preserving the separators", () => {
			const text = "a:   1\n---\nb:\n    c: 2\n";
			assert.strictEqual(YamlFormat.formatToString(text), "a: 1\n---\nb:\n  c: 2\n");
		});

		it("is idempotent on a multi-document stream", () => {
			const once = YamlFormat.formatToString("a:   1\n---\nb:   2\n---\nc:   3\n");
			assert.strictEqual(YamlFormat.formatToString(once), once);
		});

		it("preserves per-document comments and framing", () => {
			const text = "# doc one\na: 1\n# doc two\n---\nb: 2 # trailing\n";
			assert.strictEqual(YamlFormat.formatToString(text), text);
		});

		it("a comment between --- and content stays where it was written", () => {
			// It leads the ROOT NODE of the following document, so it emits on the
			// marker's far side. This used to hoist above the marker, because the
			// comment was stored as a document-level header block with no way to
			// say "after the marker"; a node-level leading slot says exactly that,
			// so the input is now a byte-identical fixed point.
			const text = "a: 1\n---\n# doc two\nb: 2\n";
			assert.strictEqual(YamlFormat.formatToString(text), text);
			assert.strictEqual(YamlFormat.formatToString(YamlFormat.formatToString(text)), text);
		});

		it("preserves an explicit ... document-end separation between bare documents", () => {
			const text = "a:   1\n...\nb:   2\n";
			assert.strictEqual(YamlFormat.formatToString(text), "a: 1\n...\nb: 2\n");
		});

		it("a trailing bare --- opens an empty second document and survives formatting", () => {
			assert.strictEqual(YamlFormat.formatToString("a:    1\n---\n"), "a: 1\n---\n");
		});

		it("the composer guarantees every later document has its own --- or a predecessor ...", () => {
			// The stream path REFUSES a document after the first that has
			// neither its own `---` nor a predecessor `...` (it could not be
			// re-emitted with faithful framing). This pins the composer
			// guarantee that makes the refusal branch unreachable for composer
			// output — a composer change breaking the guarantee fails here
			// instead of silently activating the refusal.
			const streams = [
				"a: 1\n---\nb: 2\n",
				"a: 1\n...\nb: 2\n",
				"---\na: 1\n...\n---\nb: 2\n",
				"a: 1\n...\n---\nb: 2\n",
				"%YAML 1.2\n---\na: 1\n...\n%YAML 1.2\n---\nb: 2\n",
				"--- |\ndoc\n--- >\ntext\n",
				"a: 1\n---\n",
			];
			for (const text of streams) {
				const { documents } = composeAllDocuments(text, {});
				assert.isAtLeast(documents.length, 2, `expected a multi-document stream: ${JSON.stringify(text)}`);
				for (let i = 1; i < documents.length; i++) {
					assert.isTrue(
						documents[i]?.hasDocumentStart === true || documents[i - 1]?.hasDocumentEnd === true,
						`document ${i} of ${JSON.stringify(text)} has neither its own --- nor a predecessor ...`,
					);
				}
			}
		});

		it("a two-document pnpm-lock-shaped stream round-trips with both documents intact", () => {
			const fixture = readFileSync(new URL("./fixtures/multi-doc/pnpm-lock-shape.yaml", import.meta.url), "utf8");
			const before = Yaml.parseAllResult(fixture);
			const once = YamlFormat.formatToString(fixture);
			const after = Yaml.parseAllResult(once);
			if (!Result.isSuccess(before) || !Result.isSuccess(after)) {
				assert.fail("the pnpm-lock-shaped stream must parse before and after formatting");
			}
			assert.strictEqual(after.success.length, 2);
			assert.deepStrictEqual(after.success, before.success);
			assert.include(once, "---\nlockfileVersion:");
			// Fixed point: formatting the formatted stream changes nothing.
			assert.strictEqual(YamlFormat.formatToString(once), once);
		});

		it("a stream carrying %YAML/%TAG directives is left byte-identical (not re-emittable faithfully)", () => {
			const text = "%YAML 1.2\n---\na:   1\n---\nb:   2\n";
			assert.deepStrictEqual(YamlFormat.format(text), []);
			assert.strictEqual(YamlFormat.formatToString(text), text);
		});

		it("a fatal error in any document leaves the whole stream untouched", () => {
			const text = "a:   1\n---\nb: *missing\n";
			assert.deepStrictEqual(YamlFormat.format(text), []);
			assert.strictEqual(YamlFormat.formatToString(text), text);
		});

		it.effect("modify stays single-document: fails typed with MultiDocumentStream, never a guess", () =>
			Effect.gen(function* () {
				// A YamlPath carries no document index, so which document of a
				// stream it names is a rule the format does not define.
				const error = yield* Effect.flip(YamlFormat.modify("a: 1\n---\nb: 2\n", ["a"], 2));
				assert.instanceOf(error, YamlModificationError);
				assert.strictEqual(error.diagnostics[0]?.code, "MultiDocumentStream");
				assert.notProperty(error, "reason");
			}),
		);

		it("a --- inside a block scalar is content, not a document boundary — formats as one document", () => {
			const text = "a:\n    b: 1\ntext: |\n  ---\n  not a marker\n";
			const out = YamlFormat.formatToString(text);
			assert.strictEqual(out, "a:\n  b: 1\ntext: |\n  ---\n  not a marker\n");
			const parsed = Yaml.parseAllResult(out);
			assert.isTrue(Result.isSuccess(parsed) && parsed.success.length === 1);
		});

		it("a --- inside a quoted scalar is content too", () => {
			const text = 'a:\n    b: 1\nsep: "---"\n';
			const out = YamlFormat.formatToString(text);
			assert.notStrictEqual(out, text);
			assert.isTrue(Yaml.equals(out, text));
		});

		it("a single document with an explicit leading --- marker still formats", () => {
			const text = "---\na:\n    b: 1\n";
			const out = YamlFormat.formatToString(text);
			assert.notStrictEqual(out, text);
			assert.isTrue(Yaml.equals(out, text));
		});
	});

	describe("single-document %YAML/%TAG directives — refused, never corrupted", () => {
		// Probe-verified downstream (independent oracle): the pre-fix path
		// dropped the %TAG line but kept the !e!foo shorthand that depends on
		// it, so the output failed TAG_RESOLVE_FAILED — a formatter turning a
		// valid file into one no parser can read. Directive re-emission is
		// unimplemented; until it lands, directive-carrying input is refused.
		it("a %TAG document is left byte-identical — never re-emitted without the directive its tags depend on", () => {
			const text = "%TAG !e! tag:example.com,2000:\n---\na: !e!foo bar\n";
			assert.deepStrictEqual(YamlFormat.format(text), []);
			assert.strictEqual(YamlFormat.formatToString(text), text);
		});

		it("a %YAML 1.2 document is left byte-identical", () => {
			const text = "%YAML 1.2\n---\na:   1\n";
			assert.deepStrictEqual(YamlFormat.format(text), []);
			assert.strictEqual(YamlFormat.formatToString(text), text);
		});

		it.effect("modify fails typed with DirectiveCarryingDocument, never re-emits without the directive", () =>
			Effect.gen(function* () {
				const text = "%TAG !e! tag:example.com,2000:\n---\na: !e!foo bar\nb: 1\n";
				const error = yield* Effect.flip(YamlFormat.modify(text, ["b"], 2));
				assert.instanceOf(error, YamlModificationError);
				assert.strictEqual(error.diagnostics[0]?.code, "DirectiveCarryingDocument");
				assert.notProperty(error, "reason");
			}),
		);

		it("a literal %TAG inside scalar content is content, not a directive — formats normally", () => {
			// The refusal must be directive-token-level, never text scanning: a
			// "%TAG ..." line inside a block scalar and a "%TAG" mid-scalar are
			// both content, and the badly-spaced sibling key still reformats.
			const text = 'a:   1\nnote: "contains %TAG inside"\ntext: |\n  %TAG !e! tag:example.com,2000:\n';
			const out = YamlFormat.formatToString(text);
			assert.strictEqual(out, 'a: 1\nnote: "contains %TAG inside"\ntext: |\n  %TAG !e! tag:example.com,2000:\n');
			assert.isTrue(Yaml.equals(out, text));
		});
	});

	describe("format — indentSequences", () => {
		// Exercises the AST (node-path) stringifier: YamlFormattingOptions
		// derives every YamlStringifyOptions field, including indentSequences.
		it("indents block sequences under mapping keys one level when set", () => {
			const options = YamlFormattingOptions.make({ indentSequences: true });
			assert.strictEqual(YamlFormat.formatToString("key:\n- a\n- b\n", undefined, options), "key:\n  - a\n  - b\n");
		});

		it("default formatting leaves sequences under mapping keys unindented", () => {
			assert.strictEqual(YamlFormat.formatToString("key:\n  - a\n  - b\n"), "key:\n- a\n- b\n");
		});

		it("YamlFormattingOptions.make constructs a validated instance carrying the derived field", () => {
			const options = YamlFormattingOptions.make({ indentSequences: true, preserveComments: false });
			assert.instanceOf(options, YamlFormattingOptions);
			assert.strictEqual(options.indentSequences, true);
			assert.throws(() => YamlFormattingOptions.make({ indentSequences: "yes" as unknown as boolean }));
		});
	});

	describe("quoteStyle", () => {
		// Exercises the AST (node-path) stringifier: YamlFormattingOptions derives
		// every YamlStringifyOptions field, quoteStyle included. On this path the
		// option governs only scalars with no style of their own — a value the
		// caller just inserted — because composed nodes carry their source style.
		it.effect("a modify-inserted value requiring quoting follows the option", () =>
			Effect.gen(function* () {
				const text = "deps:\n  a: 1\n";
				assert.strictEqual(yield* YamlFormat.modifyToString(text, ["deps", "a"], "*"), "deps:\n  a: '*'\n");
				assert.strictEqual(
					yield* YamlFormat.modifyToString(text, ["deps", "a"], "*", { quoteStyle: "double" }),
					'deps:\n  a: "*"\n',
				);
			}),
		);

		it.effect("a modify-inserted value needing no quoting stays plain under either setting", () =>
			Effect.gen(function* () {
				const text = "deps:\n  a: 1\n";
				assert.strictEqual(
					yield* YamlFormat.modifyToString(text, ["deps", "a"], "beta", { quoteStyle: "double" }),
					"deps:\n  a: beta\n",
				);
			}),
		);

		it("formatting preserves an existing scalar's own quote style rather than restyling it", () => {
			// Reformatting is not a restyling pass: a single-quoted source scalar
			// stays single-quoted even under quoteStyle "double".
			const options = YamlFormattingOptions.make({ quoteStyle: "double" });
			assert.strictEqual(YamlFormat.formatToString("k: '*'\n", undefined, options), "k: '*'\n");
		});

		it("YamlFormattingOptions.make constructs a validated instance carrying the derived field", () => {
			const options = YamlFormattingOptions.make({ quoteStyle: "double", preserveComments: false });
			assert.instanceOf(options, YamlFormattingOptions);
			assert.strictEqual(options.quoteStyle, "double");
			assert.throws(() => YamlFormattingOptions.make({ quoteStyle: "backtick" as unknown as "single" }));
		});
	});

	describe("requoteScalars (#347)", () => {
		const requoteDouble = YamlFormattingOptions.make({ quoteStyle: "double", requoteScalars: true });
		const requoteSingle = YamlFormattingOptions.make({ quoteStyle: "single", requoteScalars: true });

		it("single→double: a simple single-quoted scalar is re-quoted", () => {
			assert.strictEqual(YamlFormat.formatToString("k: 'a'\n", undefined, requoteDouble), 'k: "a"\n');
		});

		it("single→double: content needing escaping gets proper double-quote escapes", () => {
			// An inner double quote must be escaped as \" — the conservative lint
			// fix skips this shape; the format path escapes it.
			assert.strictEqual(
				YamlFormat.formatToString("k: 'say \"hi\"'\n", undefined, requoteDouble),
				'k: "say \\"hi\\""\n',
			);
			// A literal backslash (literal in single-quoted YAML) becomes \\.
			assert.strictEqual(YamlFormat.formatToString("k: 'a\\b'\n", undefined, requoteDouble), 'k: "a\\\\b"\n');
			// A doubled '' (the one single-quote escape) decodes to ' and re-encodes plainly.
			assert.strictEqual(YamlFormat.formatToString("k: 'it''s'\n", undefined, requoteDouble), 'k: "it\'s"\n');
		});

		it("double→single: a simple double-quoted scalar is re-quoted", () => {
			assert.strictEqual(YamlFormat.formatToString('k: "a"\n', undefined, requoteSingle), "k: 'a'\n");
		});

		it("double→single: applies under the default quoteStyle (single) when quoteStyle is omitted", () => {
			const options = YamlFormattingOptions.make({ requoteScalars: true });
			assert.strictEqual(YamlFormat.formatToString('k: "a"\n', undefined, options), "k: 'a'\n");
		});

		it("double→single: an inner single quote is doubled", () => {
			assert.strictEqual(YamlFormat.formatToString('k: "it\'s"\n', undefined, requoteSingle), "k: 'it''s'\n");
		});

		it("double→single: content single quotes cannot express is skipped, never corrupted", () => {
			// \n, \t escapes and control characters have no single-quoted spelling.
			assert.strictEqual(YamlFormat.formatToString('k: "a\\nb"\n', undefined, requoteSingle), 'k: "a\\nb"\n');
			assert.strictEqual(YamlFormat.formatToString('k: "a\\tb"\n', undefined, requoteSingle), 'k: "a\\tb"\n');
			// A control character (BEL): the scalar must stay double-quoted. Its
			// escape spelling may normalize (\x07 → \a), so compare against the
			// no-requote baseline rather than the raw source bytes.
			const bel = 'k: "\\x07"\n';
			assert.strictEqual(YamlFormat.formatToString(bel, undefined, requoteSingle), YamlFormat.formatToString(bel));
		});

		it("plain scalars stay plain — quote-style normalization, not quote forcing", () => {
			assert.strictEqual(YamlFormat.formatToString("k: a\n", undefined, requoteDouble), "k: a\n");
			assert.strictEqual(YamlFormat.formatToString("k: a\n", undefined, requoteSingle), "k: a\n");
		});

		it("tagged and anchored quoted scalars stay untouched", () => {
			assert.strictEqual(YamlFormat.formatToString("k: !!str 'a'\n", undefined, requoteDouble), "k: !!str 'a'\n");
			assert.strictEqual(YamlFormat.formatToString("k: &x 'a'\n", undefined, requoteDouble), "k: &x 'a'\n");
		});

		it("block scalars stay untouched", () => {
			const text = "k: |\n  a\n";
			assert.strictEqual(YamlFormat.formatToString(text, undefined, requoteDouble), text);
		});

		it("a multi-line quoted scalar is skipped", () => {
			const text = "k: 'a\n  b'\n";
			assert.strictEqual(YamlFormat.formatToString(text, undefined, requoteDouble), YamlFormat.formatToString(text));
		});

		it("a quoted scalar folded on CR-only line breaks is skipped too", () => {
			// A lone \r is a YAML line break (b-carriage-return): the scalar is
			// multi-line even though its raw slice carries no \n, and re-quoting
			// it from the folded value would collapse the layout.
			const text = "k: 'a\r  b'\n";
			assert.strictEqual(YamlFormat.formatToString(text, undefined, requoteDouble), YamlFormat.formatToString(text));
		});

		it("quoted mapping keys and sequence items re-quote too", () => {
			assert.strictEqual(YamlFormat.formatToString("'k': 1\n", undefined, requoteDouble), '"k": 1\n');
			assert.strictEqual(YamlFormat.formatToString("- 'a'\n- b\n", undefined, requoteDouble), '- "a"\n- b\n');
		});

		it("scalars inside flow collections re-quote", () => {
			const text = "k: {a: 'x'}\n";
			assert.strictEqual(
				YamlFormat.formatToString(text, undefined, requoteDouble),
				YamlFormat.formatToString(text).replace("'x'", '"x"'),
			);
		});

		it("comment and byte fidelity is preserved around requoted spans", () => {
			const text = "# top\na: 'x' # trail\nb: 2\n";
			assert.strictEqual(YamlFormat.formatToString(text, undefined, requoteDouble), '# top\na: "x" # trail\nb: 2\n');
			// The computed edits are surgical: each one falls inside a quoted
			// scalar's source span, touching nothing around it.
			const edits = YamlFormat.format(text, undefined, requoteDouble);
			assert.isAbove(edits.length, 0);
			const span = { offset: text.indexOf("'x'"), length: "'x'".length };
			for (const edit of edits) {
				assert.isAtLeast(edit.offset, span.offset);
				assert.isAtMost(edit.offset + edit.length, span.offset + span.length);
			}
		});

		it("default-off inertness: absent and explicit false are byte-identical to today (regression)", () => {
			const text = "a: 'x'\nb: \"y\"\nc: z\n";
			assert.strictEqual(YamlFormat.formatToString(text), text);
			assert.strictEqual(
				YamlFormat.formatToString(text, undefined, YamlFormattingOptions.make({ quoteStyle: "double" })),
				text,
			);
			assert.strictEqual(
				YamlFormat.formatToString(
					text,
					undefined,
					YamlFormattingOptions.make({ quoteStyle: "double", requoteScalars: false }),
				),
				text,
			);
		});

		it("multi-document streams re-quote every document", () => {
			assert.strictEqual(
				YamlFormat.formatToString("a: 'x'\n---\nb: 'y'\n", undefined, requoteDouble),
				'a: "x"\n---\nb: "y"\n',
			);
		});

		it.effect("round-trip: requoted output parses to the identical value", () =>
			Effect.gen(function* () {
				const text = "a: 'x'\nb: \"it's\"\nc: 'say \"hi\"'\nd: plain\ne:\n  - 'a\\b'\n  - \"tab\\there\"\n";
				const doubled = YamlFormat.formatToString(text, undefined, requoteDouble);
				const singled = YamlFormat.formatToString(text, undefined, requoteSingle);
				const original = yield* Yaml.parse(text);
				assert.deepStrictEqual(yield* Yaml.parse(doubled), original);
				assert.deepStrictEqual(yield* Yaml.parse(singled), original);
			}),
		);

		it("YamlFormattingOptions.make validates the requoteScalars field", () => {
			const options = YamlFormattingOptions.make({ requoteScalars: true });
			assert.strictEqual(options.requoteScalars, true);
			assert.throws(() => YamlFormattingOptions.make({ requoteScalars: "yes" as unknown as boolean }));
		});
	});

	describe("modify — replace", () => {
		it.effect("updates an existing mapping value", () =>
			Effect.gen(function* () {
				const text = "name: John\nage: 30\n";
				const edits = yield* YamlFormat.modify(text, ["name"], "Jane");
				assert.deepStrictEqual(yield* Yaml.parse(apply(text, edits)), { name: "Jane", age: 30 });
			}),
		);

		it.effect("updates a nested sequence element", () =>
			Effect.gen(function* () {
				const text = "xs:\n  - 1\n  - 2\n  - 3\n";
				const edits = yield* YamlFormat.modify(text, ["xs", 1], 99);
				assert.deepStrictEqual(yield* Yaml.parse(apply(text, edits)), { xs: [1, 99, 3] });
			}),
		);

		it.effect("byte-minimal: an untouched sibling key's line is unaffected", () =>
			Effect.gen(function* () {
				const text = "first: unchanged\nsecond: 2\n";
				const edits = yield* YamlFormat.modify(text, ["second"], 5);
				// Only the changed line's span should appear among the edits.
				for (const edit of edits) {
					assert.isAtLeast(edit.offset, text.indexOf("second"));
				}
				assert.deepStrictEqual(yield* Yaml.parse(apply(text, edits)), { first: "unchanged", second: 5 });
			}),
		);
	});

	describe("leading byte-order mark is preserved on whole-document re-emit (#694)", () => {
		it("format keeps the BOM", () => {
			assert.strictEqual(YamlFormat.formatToString("\uFEFFa:   1\nb: 2\n"), "\uFEFFa: 1\nb: 2\n");
			assert.deepStrictEqual(YamlFormat.format("\uFEFFa: 1\nb: 2\n"), []);
		});

		it("format keeps the BOM on a multi-document stream", () => {
			const text = "\uFEFFa:   1\n---\nb: 2\n";
			assert.strictEqual(YamlFormat.formatToString(text), "\uFEFFa: 1\n---\nb: 2\n");
		});

		it.effect("modify keeps the BOM when it falls back to the whole-document pipeline", () =>
			Effect.gen(function* () {
				// Insertion, removal and an object value all leave the fast path.
				assert.strictEqual(yield* YamlFormat.modifyToString("\uFEFFa: 1\n", ["b"], 2), "\uFEFFa: 1\nb: 2\n");
				assert.strictEqual(yield* YamlFormat.modifyToString("\uFEFFa: 1\nb: 2\n", ["b"], undefined), "\uFEFFa: 1\n");
				assert.strictEqual(yield* YamlFormat.modifyToString("\uFEFFa: 1\n", ["a"], { c: 3 }), "\uFEFFa:\n  c: 3\n");
				assert.strictEqual(
					yield* YamlFormat.modifyToString("\uFEFFb: 1\na: 2\n", ["a"], 3, { sortKeys: true }),
					"\uFEFFa: 3\nb: 1\n",
				);
			}),
		);
	});

	describe("modify — insert", () => {
		it.effect("appends a new key after the last one", () =>
			Effect.gen(function* () {
				const text = "a: 1\n";
				const edits = yield* YamlFormat.modify(text, ["b"], 2);
				assert.deepStrictEqual(yield* Yaml.parse(apply(text, edits)), { a: 1, b: 2 });
			}),
		);

		it.effect("inserts into an existing nested mapping", () =>
			Effect.gen(function* () {
				const text = "server:\n  host: localhost\n";
				const edits = yield* YamlFormat.modify(text, ["server", "port"], 8080);
				assert.deepStrictEqual(yield* Yaml.parse(apply(text, edits)), {
					server: { host: "localhost", port: 8080 },
				});
			}),
		);

		it.effect("escapes a generated key containing a colon and quotes", () =>
			Effect.gen(function* () {
				const text = "a: 1\n";
				const key = `weird: key "with" quotes`;
				const edits = yield* YamlFormat.modify(text, [key], "value");
				const out = apply(text, edits);
				const parsed = (yield* Yaml.parse(out)) as Record<string, unknown>;
				assert.strictEqual(parsed[key], "value");
			}),
		);

		it.effect("appends beyond the end of a sequence", () =>
			Effect.gen(function* () {
				const text = "xs:\n  - 1\n";
				const edits = yield* YamlFormat.modify(text, ["xs", 5], 2);
				assert.deepStrictEqual(yield* Yaml.parse(apply(text, edits)), { xs: [1, 2] });
			}),
		);
	});

	// #642. `jsValueToNode` lowered scalars only, so a mapping or sequence value
	// fell through the node stringifier's `String(value)` fallback and landed in
	// the document as the literal text `[object Object]`.
	describe("modify — a non-scalar value is lowered into nodes, never String()-coerced", () => {
		it.effect("appends a mapping to a sequence of mappings", () =>
			Effect.gen(function* () {
				const text = "verified:\n  - by: human:spencer\n    at: 2026-09-01T00:00:00Z\nstatus: stable\n";
				const out = yield* YamlFormat.modifyToString(
					text,
					["verified", 1],
					{ by: "human:other", at: "2026-09-02T00:00:00Z" },
					{ indentSequences: true },
				);
				assert.notInclude(out, "[object Object]");
				assert.strictEqual(
					out,
					"verified:\n  - by: human:spencer\n    at: 2026-09-01T00:00:00Z\n  - by: human:other\n    at: 2026-09-02T00:00:00Z\nstatus: stable\n",
				);
				assert.deepStrictEqual(yield* Yaml.parse(out), {
					verified: [
						{ by: "human:spencer", at: "2026-09-01T00:00:00Z" },
						{ by: "human:other", at: "2026-09-02T00:00:00Z" },
					],
					status: "stable",
				});
			}),
		);

		it.effect("the append is one surgical insertion that leaves surrounding comments alone", () =>
			Effect.gen(function* () {
				const text = "# header\nverified:\n  - by: a # note\n    at: b\n# tail\nstatus: stable\n";
				const edits = yield* YamlFormat.modify(text, ["verified", 1], { by: "c", at: "d" }, { indentSequences: true });
				assert.strictEqual(edits.length, 1);
				assert.strictEqual(edits[0]?.length, 0);
				assert.strictEqual(edits[0]?.content, "  - by: c\n    at: d\n");
				assert.strictEqual(
					apply(text, edits),
					"# header\nverified:\n  - by: a # note\n    at: b\n  - by: c\n    at: d\n# tail\nstatus: stable\n",
				);
			}),
		);

		it.effect("writes a sequence value as a block sequence", () =>
			Effect.gen(function* () {
				const text = "a: 1\n";
				const out = yield* YamlFormat.modifyToString(text, ["xs"], [1, "two", true]);
				assert.notInclude(out, "[object Object]");
				assert.strictEqual(out, "a: 1\nxs:\n- 1\n- two\n- true\n");
				assert.deepStrictEqual(yield* Yaml.parse(out), { a: 1, xs: [1, "two", true] });
			}),
		);

		it.effect("lowers a nested graph recursively, matching Yaml.stringify on the same value", () =>
			Effect.gen(function* () {
				const value = { a: { b: [1, { c: [2, 3] }] }, e: {}, xs: [] };
				const out = yield* YamlFormat.modifyToString("root: keep\n", ["meta"], value);
				assert.notInclude(out, "[object Object]");
				assert.deepStrictEqual((yield* Yaml.parse(out)) as Record<string, unknown>, {
					root: "keep",
					meta: value,
				});
			}),
		);

		it.effect("replaces the whole document when the path is empty", () =>
			Effect.gen(function* () {
				const out = yield* YamlFormat.modifyToString("old: 1\n", [], { fresh: [1, 2] });
				assert.notInclude(out, "[object Object]");
				assert.deepStrictEqual(yield* Yaml.parse(out), { fresh: [1, 2] });
			}),
		);

		it.effect("lowers a value shared across siblings twice rather than calling it a cycle", () =>
			Effect.gen(function* () {
				const shared = { s: 1 };
				const out = yield* YamlFormat.modifyToString("a: 1\n", ["m"], { x: shared, y: shared });
				assert.deepStrictEqual(yield* Yaml.parse(out), { a: 1, m: { x: { s: 1 }, y: { s: 1 } } });
			}),
		);

		it.effect("fails typed on a circular replacement value rather than hanging", () =>
			Effect.gen(function* () {
				const cyclic: { a: number; self?: unknown } = { a: 1 };
				cyclic.self = cyclic;
				const error = yield* Effect.flip(YamlFormat.modify("a: 1\n", ["m"], cyclic));
				assert.instanceOf(error, YamlModificationError);
				assert.strictEqual(error.diagnostics[0]?.code, "CircularReference");
			}),
		);

		it.effect("fails typed on a replacement value nested past the depth cap", () =>
			Effect.gen(function* () {
				let deep: unknown = "leaf";
				for (let i = 0; i < 300; i++) deep = { n: deep };
				const error = yield* Effect.flip(YamlFormat.modify("a: 1\n", ["m"], deep));
				assert.instanceOf(error, YamlModificationError);
				assert.strictEqual(error.diagnostics[0]?.code, "NestingDepthExceeded");
			}),
		);
	});

	describe("modify — delete via undefined", () => {
		it.effect("removes a mapping key", () =>
			Effect.gen(function* () {
				const text = "a: 1\nb: 2\n";
				const edits = yield* YamlFormat.modify(text, ["a"], undefined);
				assert.deepStrictEqual(yield* Yaml.parse(apply(text, edits)), { b: 2 });
			}),
		);

		it.effect("removes a sequence element", () =>
			Effect.gen(function* () {
				const text = "xs:\n  - 1\n  - 2\n  - 3\n";
				const edits = yield* YamlFormat.modify(text, ["xs", 1], undefined);
				assert.deepStrictEqual(yield* Yaml.parse(apply(text, edits)), { xs: [1, 3] });
			}),
		);

		it.effect("removing a missing key is a no-op", () =>
			Effect.gen(function* () {
				const text = "a: 1\n";
				const edits = yield* YamlFormat.modify(text, ["missing"], undefined);
				assert.strictEqual(apply(text, edits), text);
			}),
		);
	});

	describe("modify — failure carries diagnostics, never a reason string", () => {
		it.effect("fails on malformed source with a fatal-diagnostic aggregate", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(YamlFormat.modify("a: *undefined_alias\n", ["a"], 1));
				assert.instanceOf(error, YamlModificationError);
				assert.strictEqual(error._tag, "YamlModificationError");
				assert.isAbove(error.diagnostics.length, 0);
				assert.deepStrictEqual(error.path, ["a"]);
			}),
		);

		it.effect("fails navigating a missing intermediate key", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(YamlFormat.modify("a: 1\n", ["missing", "deep"], 2));
				assert.instanceOf(error, YamlModificationError);
				assert.isAbove(error.diagnostics.length, 0);
				assert.strictEqual(error.diagnostics[0]?.code, "PathNotFound");
			}),
		);

		it.effect("fails navigating through a scalar", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(YamlFormat.modify("a: 1\n", ["a", "deep"], 2));
				assert.instanceOf(error, YamlModificationError);
				assert.strictEqual(error.diagnostics[0]?.code, "NotNavigable");
			}),
		);

		it.effect("fails with an out-of-bounds negative sequence index", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(YamlFormat.modify("xs:\n  - 1\n", ["xs", -1], 2));
				assert.instanceOf(error, YamlModificationError);
				assert.strictEqual(error.diagnostics[0]?.code, "InvalidIndex");
			}),
		);

		it.effect("fails navigating deeper past the end of a sequence", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(YamlFormat.modify("xs:\n  - 1\n", ["xs", 5, "k"], 2));
				assert.instanceOf(error, YamlModificationError);
				assert.strictEqual(error.diagnostics[0]?.code, "InvalidIndex");
			}),
		);

		it.effect("fails navigating an empty document", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(YamlFormat.modify("", ["a"], 1));
				assert.instanceOf(error, YamlModificationError);
				assert.strictEqual(error.diagnostics[0]?.code, "EmptyDocument");
			}),
		);
	});

	describe("modifyToString", () => {
		it.effect("composes applyAll with modify", () =>
			Effect.gen(function* () {
				const text = "a: 1\n";
				const out = yield* YamlFormat.modifyToString(text, ["b"], 2);
				assert.deepStrictEqual(yield* Yaml.parse(out), { a: 1, b: 2 });
			}),
		);

		it.effect("clearing the root via an empty path yields an empty document", () =>
			Effect.gen(function* () {
				const text = "a: 1\n";
				const out = yield* YamlFormat.modifyToString(text, [], undefined);
				assert.deepStrictEqual(yield* Yaml.parse(out), null);
			}),
		);

		it.effect("replacing the root via an empty path replaces the whole document", () =>
			Effect.gen(function* () {
				const text = "a: 1\n";
				const out = yield* YamlFormat.modifyToString(text, [], "just a scalar");
				assert.deepStrictEqual(yield* Yaml.parse(out), "just a scalar");
			}),
		);
	});

	describe("merge key", () => {
		// A plain `<<` mapping key resolves to `tag:yaml.org,2002:merge` and
		// splices the aliased mapping into its parent; `'<<'` is an ordinary
		// string key that merges nothing. Quoting it on re-emission is a silent
		// semantic rewrite — the document still parses and still round-trips,
		// which is exactly why nothing caught it.
		it("leaves a plain merge key unquoted", () => {
			const text = "base: &base\n  a: 1\nderived:\n  <<: *base\n  b: 2\n";
			const out = YamlFormat.formatToString(text);
			assert.include(out, "<<: *base");
			assert.notInclude(out, "'<<'");
			assert.notInclude(out, '"<<"');
		});

		it("leaves a plain merge key unquoted inside a flow mapping", () => {
			const out = YamlFormat.formatToString("derived: {<<: *base, b: 2}\n");
			assert.include(out, "<<: *base");
			assert.notInclude(out, "'<<'");
		});

		it("leaves a plain merge key unquoted when nested several levels deep", () => {
			const out = YamlFormat.formatToString("x:\n  y:\n    z:\n      <<: *base\n");
			assert.include(out, "<<: *base");
			assert.notInclude(out, "'<<'");
		});

		it("is idempotent on a document containing a merge key", () => {
			const text = "base: &base\n  a: 1\nderived:\n  <<: *base\n  b: 2\n";
			const once = YamlFormat.formatToString(text);
			assert.strictEqual(YamlFormat.formatToString(once), once);
		});

		// The carve-out is deliberately narrow: it reads the key's SOURCE style,
		// so a key the author quoted on purpose keeps the quotes that make it a
		// literal string key rather than a merge key.
		it("preserves an explicitly single-quoted '<<' key as a literal string key", () => {
			const out = YamlFormat.formatToString("derived:\n  '<<': *base\n");
			assert.include(out, "'<<': *base");
		});

		it('preserves an explicitly double-quoted "<<" key as a literal string key', () => {
			const out = YamlFormat.formatToString('derived:\n  "<<": *base\n');
			assert.include(out, '"<<": *base');
		});

		// `<<` in value position is an ordinary string either way — plain and
		// quoted resolve to the same scalar — so the carve-out does not reach it
		// and the existing conservative quoting stands.
		it("does not change quoting of `<<` in value position", () => {
			const out = YamlFormat.formatToString("a: <<\n");
			assert.include(out, "'<<'");
		});

		// The value path is the opposite case: a JS object key "<<" is a literal
		// string key with no merge intent, so emitting it plain would CREATE
		// merge semantics that the input never had. It stays quoted.
		it.effect("still quotes a '<<' key on the value path, where there is no merge intent", () =>
			Effect.gen(function* () {
				const out = yield* Yaml.stringify({ "<<": 1 });
				assert.include(out, "'<<'");
			}),
		);
	});

	describe("keep-chomp block scalars — trailing blanks are VALUE, never doubled (P0 regression)", () => {
		// Under `+` chomping the trailing line breaks are part of the scalar's
		// value; the composer's blank-line-fidelity capture must not ALSO record
		// them as spaceBefore (or a leading-blank embed on a terminal comment
		// run), or emission renders both and the document grows one newline per
		// format pass — non-idempotent, meaning-changing whitespace rot. The
		// downstream scope table (savvy-web-systems, 2026-08-12) plus the shapes
		// the diagnosis found beyond it, each pinned as a byte fixed point.
		const fixedPoints: ReadonlyArray<readonly [string, string]> = [
			// The scope table — previously-growing rows.
			["|+ keep, trailing blank, sibling follows", "a: |+\n  text\n\nb: 1\n"],
			[">+ folded keep, trailing blank, sibling follows", "a: >+\n  text\n\nb: 1\n"],
			["|2+ explicit indent + keep, trailing blank", "a: |2+\n  text\n\nb: 1\n"],
			// The scope table — stable controls that must stay stable.
			["|+ keep, no trailing blank", "a: |+\n  text\nb: 1\n"],
			["|+ keep at EOF, no sibling", "a: |+\n  text\n\n"],
			["| clip, trailing blank", "a: |\n  text\n\nb: 1\n"],
			["|- strip, trailing blank", "a: |-\n  text\n\nb: 1\n"],
			// Beyond the table: every other site the same capture reaches.
			["|+ keep, two trailing blanks, sibling", "a: |+\n  text\n\n\nb: 1\n"],
			["|+ keep, terminal comment run", "a: |+\n  text\n\n# tail\n"],
			["|+ keep, comment run then sibling", "a: |+\n  text\n\n# c\nb: 1\n"],
			["|+ keep, comment run, stylistic blank, sibling", "a: |+\n  text\n\n# c\n\nb: 1\n"],
			["seq: |+ keep item, blank, next item", "- |+\n  text\n\n- 2\n"],
			["seq: |+ keep item, blank, terminal comment", "- |+\n  text\n\n# tail\n"],
			["nested map |+ keep, blank, outer sibling", "m:\n  a: |+\n    text\n\nb: 1\n"],
			["nested seq |+ keep, blank, outer sibling", "m:\n  - |+\n    text\n\nb: 1\n"],
			["nested >+ folded keep, blank, outer sibling", "m:\n  a: >+\n    text\n\nb: 1\n"],
			["doc root |+ keep, trailing comment", "|+\n  text\n\n# tail\n"],
			["doc root |+ keep at EOF", "|+\n  text\n\n"],
		];

		for (const [name, text] of fixedPoints) {
			it(`fixed point: ${name}`, () => {
				const once = YamlFormat.formatToString(text);
				assert.strictEqual(once, text);
				// Idempotence is implied by the fixed point, but assert the second
				// pass explicitly so a future non-fixed-point normalization of one
				// of these shapes still has to prove it converges.
				assert.strictEqual(YamlFormat.formatToString(once), once);
			});
		}

		it.effect("keep-chomp trailing newlines stay in the VALUE across a format pass", () =>
			Effect.gen(function* () {
				const text = "a: |+\n  text\n\nb: 1\n";
				const before = yield* Yaml.parse(text);
				const after = yield* Yaml.parse(YamlFormat.formatToString(text));
				assert.deepStrictEqual(before, { a: "text\n\n", b: 1 });
				assert.deepStrictEqual(after, before);
			}),
		);
	});
});
