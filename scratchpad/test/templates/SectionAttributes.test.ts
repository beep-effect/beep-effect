// Marker attributes: `name="value"` pairs on a BEGIN marker. Metadata, not
// identity — they participate in equality (an attribute change is real drift)
// but never in which block a marker names.

import { assert, describe, it } from "@effect/vitest";
import { Arbitrary, Effect, Equal, Option, Result, Schema } from "effect";
import type { Section, SectionDocument, SectionRenderError } from "../../effected/templates/index.ts";
import { CommentStyle, ManagedSection, SectionDialect, SectionId } from "../../effected/templates/index.ts";
import { begin, block, end, id, lines, memoryFs, parse, parseFailure, section } from "./fixtures.ts";

/** A `#`-style BEGIN marker carrying a raw attribute run. */
const beginWith = (key: string, run: string) => `# --- BEGIN ${key} MANAGED SECTION ${run} ---`;

/** A rendered block whose BEGIN marker carries a raw attribute run. */
const blockWith = (key: string, run: string, content: string) => [beginWith(key, run), content, end(key)].join("\n");

const expectRender = (result: Result.Result<string, SectionRenderError>): string => {
	if (!Result.isSuccess(result)) {
		assert.fail(`expected a rendered section, got ${result.failure.reason}`);
	}
	return result.success;
};

const expectRenderFailure = (result: Result.Result<string, SectionRenderError>): SectionRenderError => {
	if (!Result.isFailure(result)) {
		assert.fail("expected a render failure");
	}
	return result.failure;
};

const reconcile = (doc: SectionDocument, declared: ReadonlyArray<Section>) => {
	const result = doc.reconcile(declared);
	if (!Result.isSuccess(result)) {
		assert.fail(`expected reconciliation to succeed, got ${result.failure.reason}`);
	}
	return result.success;
};

describe("marker attributes", () => {
	describe("rendering", () => {
		it("emits attributes on the BEGIN marker in insertion order, END unchanged", () => {
			const text = expectRender(
				SectionDialect.default.render(id("example-tool").section("echo hi", { name: "value", other: "v2" })),
			);
			assert.strictEqual(
				text,
				lines(
					'# --- BEGIN example-tool MANAGED SECTION name="value" other="v2" ---',
					"echo hi",
					"# --- END example-tool MANAGED SECTION ---",
				),
			);
		});

		it("renders an empty attribute record exactly like a section without one", () => {
			const bare = expectRender(SectionDialect.default.render(id("k").section("x")));
			const empty = expectRender(SectionDialect.default.render(id("k").section("x", {})));
			assert.strictEqual(empty, bare);
			assert.strictEqual(bare.split("\n")[0], begin("k"));
		});
	});

	describe("round trip", () => {
		it("parses rendered attributes back verbatim, byte-identically", () => {
			const attrs = { owner: "example-tool", version: "1.2.3" };
			const first = reconcile(parse("user line\n"), [id("example-tool").section("echo hi", attrs)]);
			const doc = parse(first.text);
			const found = doc.read(id("example-tool"));
			assert.isTrue(Option.isSome(found));
			assert.deepStrictEqual(Option.getOrThrow(found).attributes, attrs);
			// The second pass is the byte-identity proof: what was written is
			// exactly what reads back, so nothing re-renders.
			const second = reconcile(doc, [id("example-tool").section("echo hi", attrs)]);
			assert.strictEqual(second.text, first.text);
			assert.isFalse(second.changed);
			assert.deepStrictEqual(
				second.outcomes.map((o) => o._tag),
				["Unchanged"],
			);
		});

		it("round-trips a value containing the closing rule", () => {
			const attrs = { note: "a --- b" };
			const first = reconcile(parse(""), [id("k").section("x", attrs)]);
			const found = parse(first.text).read(id("k"));
			assert.isTrue(Option.isSome(found));
			assert.deepStrictEqual(Option.getOrThrow(found).attributes, attrs);
			const second = reconcile(parse(first.text), [id("k").section("x", attrs)]);
			assert.isFalse(second.changed);
		});

		it("parses an old marker without attributes to an empty record, byte-identically", () => {
			const text = lines("#!/bin/sh", block("example-tool", "echo hi"), "");
			const doc = parse(text);
			assert.deepStrictEqual(Option.getOrThrow(doc.read(id("example-tool"))).attributes, {});
			const result = reconcile(doc, [section("example-tool", "echo hi")]);
			assert.strictEqual(result.text, text);
			assert.isFalse(result.changed);
		});

		it("tolerates extra whitespace between pairs on read, normalizes on write", () => {
			const doc = parse(`${blockWith("k", 'a="1"   b="2"', "x")}\n`);
			assert.deepStrictEqual(Option.getOrThrow(doc.read(id("k"))).attributes, { a: "1", b: "2" });
			const result = reconcile(doc, [id("k").section("x", { a: "1", b: "2" })]);
			assert.include(result.text, 'a="1" b="2"');
			assert.deepStrictEqual(
				result.outcomes.map((o) => o._tag),
				["Unchanged"],
			);
		});
	});

	describe("equality", () => {
		it("treats an omitted record and an explicit empty one as the same section", () => {
			assert.isTrue(Equal.equals(id("k").section("x"), id("k").section("x", {})));
		});

		it("compares equal-but-reordered attributes equal — record equality, not order", () => {
			const forward = id("k").section("x", { a: "1", b: "2" });
			const reversed = id("k").section("x", { b: "2", a: "1" });
			assert.isTrue(Equal.equals(forward, reversed));
			// Discriminating control: a changed value must not compare equal.
			assert.isFalse(Equal.equals(forward, id("k").section("x", { a: "1", b: "CHANGED" })));
		});

		it("preserves attributes through withContent", () => {
			const original = id("k").section("x", { a: "1" });
			const rewritten = original.withContent("y");
			assert.deepStrictEqual(rewritten.attributes, { a: "1" });
			assert.strictEqual(rewritten.content, "y");
		});
	});

	describe("refusals", () => {
		it("refuses an attribute name outside the grammar, naming it", () => {
			for (const name of ["1bad", "bad name", "-x", "_x", ""]) {
				const error = expectRenderFailure(SectionDialect.default.render(id("k").section("x", { [name]: "v" })));
				assert.strictEqual(error._tag, "SectionRenderError");
				assert.strictEqual(error.reason, "invalidAttribute");
				assert.strictEqual(error.key, "k");
				assert.strictEqual(error.attribute, name);
			}
		});

		it('refuses a value containing `"`', () => {
			const error = expectRenderFailure(SectionDialect.default.render(id("k").section("x", { a: 'say "hi"' })));
			assert.strictEqual(error.reason, "invalidAttribute");
			assert.strictEqual(error.attribute, "a");
		});

		it("refuses a value containing a line break — LF and CR alike", () => {
			for (const value of ["one\ntwo", "one\rtwo", "one\r\ntwo"]) {
				const error = expectRenderFailure(SectionDialect.default.render(id("k").section("x", { a: value })));
				assert.strictEqual(error.reason, "invalidAttribute");
			}
		});

		it("fails reconciliation typed and leaves the document untouched", () => {
			const text = lines("user line", block("k", "x"), "");
			const result = parse(text).reconcile([id("k").section("x", { "bad name": "v" })]);
			assert.isTrue(Result.isFailure(result));
			if (Result.isFailure(result)) {
				assert.strictEqual(result.failure.reason, "invalidAttribute");
			}
		});
	});

	describe("drift", () => {
		it("reports an attribute value change as Drifted and rewrites it", () => {
			const doc = parse(`${blockWith("k", 'a="1"', "x")}\n`);
			const declared = id("k").section("x", { a: "2" });
			assert.strictEqual(doc.check(declared)._tag, "Drifted");
			const result = reconcile(doc, [declared]);
			assert.deepStrictEqual(
				result.outcomes.map((o) => o._tag),
				["Updated"],
			);
			assert.include(result.text, 'a="2"');
			assert.notInclude(result.text, 'a="1"');
		});

		it("reports adding attributes to a bare marker as drift", () => {
			const doc = parse(`${block("k", "x")}\n`);
			const declared = id("k").section("x", { a: "1" });
			assert.strictEqual(doc.check(declared)._tag, "Drifted");
			assert.deepStrictEqual(
				reconcile(doc, [declared]).outcomes.map((o) => o._tag),
				["Updated"],
			);
		});

		it("reports removing attributes as drift and strips the run", () => {
			const doc = parse(`${blockWith("k", 'a="1"', "x")}\n`);
			assert.strictEqual(doc.check(section("k", "x"))._tag, "Drifted");
			const result = reconcile(doc, [section("k", "x")]);
			assert.deepStrictEqual(
				result.outcomes.map((o) => o._tag),
				["Updated"],
			);
			assert.strictEqual(result.text, `${block("k", "x")}\n`);
		});

		it("checks equal-but-reordered attributes UpToDate and reconciles Unchanged", () => {
			const doc = parse(`${blockWith("k", 'a="1" b="2"', "x")}\n`);
			const reversed = id("k").section("x", { b: "2", a: "1" });
			assert.strictEqual(doc.check(reversed)._tag, "UpToDate");
			const first = reconcile(doc, [reversed]);
			assert.deepStrictEqual(
				first.outcomes.map((o) => o._tag),
				["Unchanged"],
			);
			// The rewrite renders declared order; the pass after it is a fixed point.
			const second = reconcile(parse(first.text), [reversed]);
			assert.strictEqual(second.text, first.text);
			assert.isFalse(second.changed);
		});
	});

	describe("identity", () => {
		it("finds, probes and removes an attributed section by key and style alone", () => {
			const doc = parse(lines("user", blockWith("k", 'a="1"', "x"), "tail", ""));
			assert.isTrue(doc.has(id("k")));
			assert.isTrue(Option.isSome(doc.read(id("k"))));
			const removed = doc.remove(id("k"));
			assert.isTrue(Option.isSome(removed));
			assert.notInclude(Option.getOrThrow(removed), "BEGIN");
		});

		it("still rejects two blocks with one identity, attributes notwithstanding", () => {
			const text = lines(blockWith("k", 'a="1"', "x"), block("k", "y"), "");
			assert.strictEqual(parseFailure(text).reason, "duplicateSection");
		});
	});

	describe("hand-mangled markers", () => {
		it("treats a mangled attribute run as content, so its END fails typed as orphaned", () => {
			const text = lines(beginWith("k", 'a="1" ju nk'), "x", end("k"), "");
			assert.strictEqual(parseFailure(text).reason, "orphanedEnd");
		});

		it("treats a duplicate attribute name as content — two values for one name is a guess", () => {
			const text = lines(beginWith("k", 'a="1" a="2"'), "x", end("k"), "");
			assert.strictEqual(parseFailure(text).reason, "orphanedEnd");
		});

		it("treats an adversarial near-miss run as content, at any length", () => {
			// The backtracking shape a validating regex would melt on: one valid
			// pair, then a long tail that is almost-but-never a second pair. The
			// run parser is a single linear walk, so this is just a big line of
			// prose — the whole document is content, not a marker.
			const hostile = beginWith("k", `a="v"${" a".repeat(20_000)}`);
			assert.strictEqual(parse(lines(hostile, "")).sections.length, 0);
		});

		it("treats an END marker carrying attributes as content, so the section is unterminated", () => {
			const text = lines(begin("k"), "x", `# --- END k MANAGED SECTION a="1" ---`, "");
			assert.strictEqual(parseFailure(text).reason, "unterminatedSection");
		});

		it("refuses content carrying an attributed marker", () => {
			const hostile = id("k").section(`ok\n${beginWith("other", 'a="1"')}\nsmuggled`);
			assert.strictEqual(expectRenderFailure(SectionDialect.default.render(hostile)).reason, "markerInContent");
		});

		it("allows content carrying a mangled pseudo-marker the scanner reads as prose", () => {
			// The renderer's refusal mirrors the scanner exactly: what scans as
			// content renders as content, so the round trip stays verbatim.
			const benign = id("k").section(beginWith("other", 'a="1" ju nk'));
			assert.isTrue(Result.isSuccess(SectionDialect.default.render(benign)));
		});
	});

	describe("CRLF", () => {
		it("keeps a CRLF document CRLF and reaches a fixed point with attributes", () => {
			const source = "user line\r\n";
			const declared = id("k").section("a\nb", { owner: "tool" });
			const first = reconcile(parse(source), [declared]);
			assert.isFalse(/[^\r]\n/.test(first.text), "output must not contain a lone LF");
			assert.include(first.text, 'owner="tool"');
			const doc = parse(first.text);
			assert.deepStrictEqual(Option.getOrThrow(doc.read(id("k"))).attributes, { owner: "tool" });
			const second = reconcile(doc, [declared]);
			assert.strictEqual(second.text, first.text);
			assert.isFalse(second.changed);
		});
	});

	describe("service", () => {
		it.effect("a second identical sync with attributes is Unchanged and does not write", () => {
			const fs = memoryFs({ "pre-commit": "#!/bin/sh\n" });
			const declared = id("example-tool").section("echo hi", { owner: "kit", version: "1.2.3" });
			return Effect.gen(function* () {
				const service = yield* ManagedSection;
				const first = yield* service.sync("pre-commit", declared);
				assert.strictEqual(first._tag, "Created");
				const writesAfterFirst = fs.writes();
				const written = fs.text("pre-commit") ?? "";
				assert.include(written, 'owner="kit" version="1.2.3"');
				const second = yield* service.sync("pre-commit", declared);
				assert.strictEqual(second._tag, "Unchanged");
				assert.strictEqual(fs.writes(), writesAfterFirst, "the second sync must not write");
				assert.strictEqual(fs.text("pre-commit"), written);
			}).pipe(Effect.provide(ManagedSection.layer), Effect.provide(fs.layer));
		});
	});

	describe("properties", () => {
		// Inline styles, never presets: the properties must exercise structural
		// identity, the path a consumer defining its own style takes.
		const styles = {
			"#": CommentStyle.make({ prefix: "#" }),
			"//": CommentStyle.make({ prefix: "//" }),
			"<!--": CommentStyle.make({ prefix: "<!--", suffix: "-->" }),
		};
		const styleArb = Arbitrary.schema(Schema.Literals(["#", "//", "<!--"])).pipe(
			Arbitrary.map((prefix) => styles[prefix]),
		);
		const Name = Schema.Literals(["name", "other", "x1", "a-b", "c_d", "Z"]);
		const Value = Schema.Literals(["", "v", "1.2.3", "spaced value", "a --- b", "-->"]);
		// Unique by name, or the pairs would collapse into fewer entries than
		// were generated and the round trip would compare against the wrong map.
		const attrsArb = Arbitrary.schema(
			Schema.Array(Schema.Tuple([Name, Value])).check(Schema.isUniqueKey(), Schema.isMaxLength(3)),
		).pipe(Arbitrary.map((pairs) => Object.fromEntries(pairs) as Record<string, string>));
		const Content = Schema.Literals(["", "echo hi", "a\nb", "  indented"]);
		const Document = Schema.Literals(["", "#!/bin/sh\n", "user line\nsecond\n"]);

		it.prop(
			"attributes survive a reconcile round trip and reach a fixed point",
			[Document, styleArb, attrsArb, Content],
			([text, commentStyle, attributes, content]) => {
				const sectionId = SectionId.make({ key: "alpha", commentStyle });
				const declared = sectionId.section(content, attributes);
				const first = reconcile(parse(text), [declared]);
				const doc = parse(first.text);
				const found = doc.read(sectionId);
				assert.isTrue(Option.isSome(found));
				assert.deepStrictEqual(Option.getOrThrow(found).attributes, attributes);
				assert.strictEqual(doc.check(declared)._tag, "UpToDate");
				const second = reconcile(doc, [declared]);
				assert.strictEqual(second.text, first.text);
				assert.isFalse(second.changed);
				return true;
			},
		);
	});
});
