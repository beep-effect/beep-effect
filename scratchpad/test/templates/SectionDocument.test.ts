import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import { CommentStyle, SectionDialect, SectionDocument, SectionId } from "../../effected/templates/index.ts";
import { begin, block, crlf, end, id, lines, parse, parseFailure, section } from "./fixtures.ts";

describe("SectionDocument.parseResult", () => {
	describe("locating sections", () => {
		it("finds nothing in a document with no markers", () => {
			const doc = parse("just some user text\n");
			assert.lengthOf(doc.sections, 0);
		});

		it("finds a section and captures its content exactly", () => {
			const doc = parse(lines("header", block("example-tool", "echo hi"), "footer", ""));
			assert.lengthOf(doc.sections, 1);
			assert.strictEqual(doc.sections[0]?.section.content, "echo hi");
			assert.strictEqual(doc.sections[0]?.section.key, "example-tool");
		});

		it("reports the span so the block can be sliced back out verbatim", () => {
			const text = lines("header", block("example-tool", "body"), "footer", "");
			const doc = parse(text);
			const placed = doc.sections[0];
			assert.isDefined(placed);
			assert.strictEqual(text.slice(placed.start, placed.end), block("example-tool", "body"));
		});

		it("reports a 1-based line for the begin marker", () => {
			const doc = parse(lines("one", "two", block("example-tool", "body"), ""));
			assert.strictEqual(doc.sections[0]?.line, 3);
		});

		it("finds sections in document order, across comment styles", () => {
			const text = lines(
				block("first", "a"),
				"",
				"<!-- --- BEGIN second MANAGED SECTION --- -->",
				"b",
				"<!-- --- END second MANAGED SECTION --- -->",
				"",
			);
			const doc = parse(text);
			assert.deepStrictEqual(
				doc.sections.map((placed) => placed.section.key),
				["first", "second"],
			);
		});

		it("preserves empty content through a round trip", () => {
			const doc = parse(block("example-tool", ""));
			assert.strictEqual(doc.sections[0]?.section.content, "");
		});

		it("keeps interior blank lines, stripping only the boundary line breaks", () => {
			const doc = parse(block("example-tool", "a\n\nb"));
			assert.strictEqual(doc.sections[0]?.section.content, "a\n\nb");
		});

		it("does not treat prose mentioning the phrase as a marker", () => {
			const doc = parse("this MANAGED SECTION is prose\n");
			assert.lengthOf(doc.sections, 0);
		});

		it("ignores a marker whose comment style the dialect does not recognize", () => {
			const narrow = SectionDialect.make({ phrase: "MANAGED SECTION", styles: [CommentStyle.slash] });
			const doc = parse(block("example-tool", "body"), narrow);
			assert.lengthOf(doc.sections, 0);
		});
	});

	describe("line endings", () => {
		it("detects LF", () => {
			assert.strictEqual(parse("a\nb\n").eol, "\n");
		});

		it("detects CRLF", () => {
			assert.strictEqual(parse(crlf("a\nb\n")).eol, "\r\n");
		});

		it("finds sections in a CRLF document, which the v3 scanner could not", () => {
			const doc = parse(crlf(lines("header", block("example-tool", "echo hi"), "")));
			assert.lengthOf(doc.sections, 1);
		});

		it("normalizes parsed content to LF so comparison is honest", () => {
			const doc = parse(crlf(lines(block("example-tool", "a\nb"), "")));
			assert.strictEqual(doc.sections[0]?.section.content, "a\nb");
		});
	});

	describe("ambiguity fails typed", () => {
		it("rejects a begin marker with no end", () => {
			const error = parseFailure(lines("header", begin("example-tool"), "body", ""));
			assert.strictEqual(error._tag, "SectionParseError");
			assert.strictEqual(error.reason, "unterminatedSection");
			assert.strictEqual(error.line, 2);
			assert.strictEqual(error.key, "example-tool");
		});

		it("rejects an end marker with no begin", () => {
			const error = parseFailure(lines("header", end("example-tool"), ""));
			assert.strictEqual(error.reason, "orphanedEnd");
			assert.strictEqual(error.line, 2);
		});

		it("rejects an end marker that does not close what is open", () => {
			const error = parseFailure(lines(begin("a"), "body", end("b"), ""));
			assert.strictEqual(error.reason, "orphanedEnd");
			assert.strictEqual(error.key, "b");
		});

		it("rejects a begin marker inside another section", () => {
			const error = parseFailure(lines(begin("a"), begin("b"), end("b"), end("a"), ""));
			assert.strictEqual(error.reason, "overlappingSections");
			assert.strictEqual(error.line, 2);
			assert.strictEqual(error.key, "b");
		});

		it("rejects two sections with the same identity", () => {
			const error = parseFailure(lines(block("dup", "one"), block("dup", "two"), ""));
			assert.strictEqual(error.reason, "duplicateSection");
			assert.strictEqual(error.key, "dup");
			assert.strictEqual(error.line, 4, "points at the second occurrence");
		});

		it("allows the same key under two different comment styles", () => {
			const text = lines(
				block("shared", "hash"),
				"// --- BEGIN shared MANAGED SECTION ---",
				"slash",
				"// --- END shared MANAGED SECTION ---",
				"",
			);
			assert.lengthOf(parse(text).sections, 2);
		});
	});

	describe("parse — the Effect twin", () => {
		it("succeeds with the same document the primitive returns", () =>
			Effect.gen(function* () {
				const text = lines(block("example-tool", "body"), "");
				const viaEffect = yield* SectionDocument.parse(text);
				assert.isTrue(Equal.equals(viaEffect, parse(text)));
			}).pipe(Effect.runSync));

		it("fails through the typed channel, never as a defect", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(SectionDocument.parse(begin("example-tool")));
				assert.strictEqual(error._tag, "SectionParseError");
				assert.strictEqual(error.reason, "unterminatedSection");
			}).pipe(Effect.runSync));
	});

	describe("read / has", () => {
		const doc = parse(lines(block("example-tool", "echo hi"), ""));

		it("reads a present section", () => {
			const found = doc.read(id("example-tool"));
			assert.isTrue(O.isSome(found));
			assert.strictEqual(O.getOrThrow(found).content, "echo hi");
		});

		it("answers none for an absent section", () => {
			assert.isTrue(O.isNone(doc.read(id("other"))));
		});

		it("does not match a different comment style", () => {
			const slash = SectionId.make({ key: "example-tool", commentStyle: CommentStyle.slash });
			assert.isTrue(O.isNone(doc.read(slash)));
		});

		it("is case-sensitive", () => {
			assert.isTrue(O.isNone(doc.read(id("EXAMPLE-TOOL"))));
		});

		it("has answers the same question as read", () => {
			assert.isTrue(doc.has(id("example-tool")));
			assert.isFalse(doc.has(id("other")));
		});
	});

	describe("check", () => {
		const doc = parse(lines(block("example-tool", "echo hi"), ""));

		it("reports Absent for a section that is not there", () => {
			const outcome = doc.check(section("other", "x"));
			assert.strictEqual(outcome._tag, "Absent");
		});

		it("reports UpToDate for identical content", () => {
			assert.strictEqual(doc.check(section("example-tool", "echo hi"))._tag, "UpToDate");
		});

		it("reports Drifted with both sides for changed content", () => {
			const outcome = doc.check(section("example-tool", "echo bye"));
			assert.strictEqual(outcome._tag, "Drifted");
			if (outcome._tag !== "Drifted") {
				return;
			}
			assert.strictEqual(outcome.onDisk.content, "echo hi");
			assert.strictEqual(outcome.expected.content, "echo bye");
		});

		it("reports drift for a whitespace-only change, which v3 swallowed", () => {
			assert.strictEqual(doc.check(section("example-tool", "  echo hi"))._tag, "Drifted");
		});

		it("is line-ending agnostic, so a CRLF document does not drift forever", () => {
			const crlfDoc = parse(crlf(lines(block("example-tool", "echo hi"), "")));
			assert.strictEqual(crlfDoc.check(section("example-tool", "echo hi"))._tag, "UpToDate");
		});

		it("normalizes the DECLARED side too, so CRLF content does not drift against an LF document", () => {
			// The other direction: the document is LF (or was normalized at parse)
			// and the caller hands over content carrying CRLF. Without normalizing
			// the declared side, this reports drift forever and rewrites on every run.
			const lfDoc = parse(lines(block("example-tool", "a\nb"), ""));
			assert.strictEqual(lfDoc.check(section("example-tool", "a\r\nb"))._tag, "UpToDate");
		});
	});

	describe("remove", () => {
		it("answers none when the section is not present", () => {
			assert.isTrue(O.isNone(parse("nothing here\n").remove(id("example-tool"))));
		});

		it("drops the block and collapses the surrounding blank lines", () => {
			const doc = parse(lines("header", "", block("example-tool", "body"), "", "footer", ""));
			const next = O.getOrThrow(doc.remove(id("example-tool")));
			assert.strictEqual(next, lines("header", "", "footer", ""));
		});

		it("does not accumulate gaps across repeated removals", () => {
			const doc = parse(lines("header", "", block("a", "1"), "", block("b", "2"), "", "footer", ""));
			const once = O.getOrThrow(doc.remove(id("a")));
			const twice = O.getOrThrow(parse(once).remove(id("b")));
			assert.strictEqual(twice, lines("header", "", "footer", ""));
		});

		it("leaves a lone section's file empty rather than newline-littered", () => {
			const doc = parse(`${block("only", "body")}\n`);
			assert.strictEqual(O.getOrThrow(doc.remove(id("only"))), "");
		});

		it("preserves the document's line endings", () => {
			const doc = parse(crlf(lines("header", "", block("example-tool", "body"), "", "footer", "")));
			const next = O.getOrThrow(doc.remove(id("example-tool")));
			assert.strictEqual(next, crlf(lines("header", "", "footer", "")));
		});
	});
});
