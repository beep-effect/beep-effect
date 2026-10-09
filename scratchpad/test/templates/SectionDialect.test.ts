import { assert, describe, it } from "@effect/vitest";
import * as Equal from "effect/Equal";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { SectionRenderError } from "../../effected/templates/index.ts";
import { CommentStyle, SectionDialect, SectionDocument, SectionId } from "../../effected/templates/index.ts";

import { Eol } from "../../effected/templates/SectionDialect.ts";
import { ATTRIBUTE_NAME_PATTERN, AttributeName, AttributeValue } from "../../effected/templates/internal/attributes.ts";

const hashId = SectionId.make({ key: "example-tool", commentStyle: CommentStyle.hash });
const htmlId = SectionId.make({ key: "example-tool", commentStyle: CommentStyle.html });

const expectSuccess = (result: Result.Result<string, SectionRenderError>): string => {
	if (!Result.isSuccess(result)) {
		assert.fail(`expected a rendered section, got ${result.failure.reason}`);
	}
	return result.success;
};

const expectFailure = (result: Result.Result<string, SectionRenderError>): SectionRenderError => {
	if (!Result.isFailure(result)) {
		assert.fail("expected a render failure");
	}
	return result.failure;
};

describe("SectionDialect", () => {
	describe("default", () => {
		it("uses the domain-free marker phrase", () => {
			assert.strictEqual(SectionDialect.default.phrase, "MANAGED SECTION");
		});

		it("recognizes every preset comment style", () => {
			for (const style of CommentStyle.presets) {
				assert.isTrue(SectionDialect.default.recognizes(style));
			}
		});

		it("does not recognize a style outside its set", () => {
			assert.isFalse(SectionDialect.default.recognizes(CommentStyle.make({ prefix: "%" })));
		});
	});

	describe("markers", () => {
		it("renders a line style in the v3-compatible shape", () => {
			assert.strictEqual(SectionDialect.default.beginMarker(hashId), "# --- BEGIN example-tool MANAGED SECTION ---");
			assert.strictEqual(SectionDialect.default.endMarker(hashId), "# --- END example-tool MANAGED SECTION ---");
		});

		it("closes a wrapped style, which is what makes Markdown and HTML representable", () => {
			assert.strictEqual(
				SectionDialect.default.beginMarker(htmlId),
				"<!-- --- BEGIN example-tool MANAGED SECTION --- -->",
			);
			assert.strictEqual(SectionDialect.default.endMarker(htmlId), "<!-- --- END example-tool MANAGED SECTION --- -->");
		});

		it("renders the key verbatim — keys are case-sensitive", () => {
			const upper = SectionId.make({ key: "SAVVY-LINT", commentStyle: CommentStyle.hash });
			assert.include(SectionDialect.default.beginMarker(upper), "BEGIN SAVVY-LINT MANAGED");
			const lower = SectionId.make({ key: "savvy-lint", commentStyle: CommentStyle.hash });
			assert.include(SectionDialect.default.beginMarker(lower), "BEGIN savvy-lint MANAGED");
		});

		it("honors a custom phrase", () => {
			const dialect = SectionDialect.make({ phrase: "GENERATED BLOCK", styles: CommentStyle.presets });
			assert.strictEqual(dialect.beginMarker(hashId), "# --- BEGIN example-tool GENERATED BLOCK ---");
		});
	});

	describe("render", () => {
		it("wraps content in markers, one line break each side", () => {
			const text = expectSuccess(SectionDialect.default.render(hashId.section("echo hi")));
			assert.strictEqual(
				text,
				["# --- BEGIN example-tool MANAGED SECTION ---", "echo hi", "# --- END example-tool MANAGED SECTION ---"].join(
					"\n",
				),
			);
		});

		it("renders empty content as two adjacent markers", () => {
			const text = expectSuccess(SectionDialect.default.render(hashId.section("")));
			assert.strictEqual(
				text,
				["# --- BEGIN example-tool MANAGED SECTION ---", "", "# --- END example-tool MANAGED SECTION ---"].join("\n"),
			);
		});

		it("emits the requested line ending throughout", () => {
			const text = expectSuccess(SectionDialect.default.render(hashId.section("a\nb"), "\r\n"));
			assert.strictEqual(text.split("\r\n").length, 4);
			assert.isFalse(/[^\r]\n/.test(text), "every LF must be preceded by a CR");
		});

		it("refuses content carrying a marker, which would move the block boundary", () => {
			const hostile = hashId.section("ok\n# --- END example-tool MANAGED SECTION ---\nsmuggled");
			const error = expectFailure(SectionDialect.default.render(hostile));
			assert.strictEqual(error._tag, "SectionRenderError");
			assert.strictEqual(error.reason, "markerInContent");
			assert.strictEqual(error.key, "example-tool");
		});

		it("refuses a begin marker for any recognized style, not just its own", () => {
			const hostile = hashId.section("<!-- --- BEGIN other MANAGED SECTION --- -->");
			assert.strictEqual(expectFailure(SectionDialect.default.render(hostile)).reason, "markerInContent");
		});

		it("refuses the same hostile content every time it is asked", () => {
			// The scanners carry the `g` flag; a `regex.test` implementation would
			// advance `lastIndex` and let the second call through.
			const hostile = hashId.section("# --- END example-tool MANAGED SECTION ---");
			assert.strictEqual(expectFailure(SectionDialect.default.render(hostile)).reason, "markerInContent");
			assert.strictEqual(expectFailure(SectionDialect.default.render(hostile)).reason, "markerInContent");
			assert.strictEqual(expectFailure(SectionDialect.default.render(hostile)).reason, "markerInContent");
		});

		it("allows content that merely mentions the phrase without forming a marker", () => {
			const benign = hashId.section("# this MANAGED SECTION comment is prose, not a marker");
			assert.isTrue(Result.isSuccess(SectionDialect.default.render(benign)));
		});

		it("refuses a section whose style the dialect cannot scan back", () => {
			const narrow = SectionDialect.make({ phrase: "MANAGED SECTION", styles: [CommentStyle.hash] });
			const error = expectFailure(
				narrow.render(SectionId.make({ key: "k", commentStyle: CommentStyle.slash }).section("x")),
			);
			assert.strictEqual(error.reason, "unknownCommentStyle");
		});
	});

	describe("construction", () => {
		it("refuses a phrase that could collide with the marker rule", () => {
			for (const phrase of ["", " ", "---", "BEGIN-ISH-", "has\nnewline"]) {
				assert.throws(
					() => SectionDialect.make({ phrase, styles: CommentStyle.presets }),
					undefined,
					undefined,
					phrase,
				);
			}
		});

		it("refuses an empty style set, which would make every section unrenderable", () => {
			assert.throws(() => SectionDialect.make({ phrase: "MANAGED SECTION", styles: [] }));
		});
	});

	describe("JSON Schema export", () => {
		it("phrase exports its pattern", () => {
			assert.nestedPropertyVal(
				S.toJsonSchemaDocument(SectionDialect),
				"definitions.@beep/scratchpad/effected/templates/SectionDialect/SectionDialectEncoded.properties.phrase.pattern",
				"^[A-Za-z0-9][A-Za-z0-9 _]*$",
			);
		});
	});
});

describe("SectionDialect review regressions", () => {
	it("normalizes CRLF content before emitting either supported EOL", () => {
		const section = hashId.section("a\r\nb\nc\r\n");
		for (const eol of Eol.literals) {
			const text = expectSuccess(SectionDialect.default.render(section, eol));
			assert.strictEqual(text, [SectionDialect.default.beginMarker(hashId), "a", "b", "c", "", SectionDialect.default.endMarker(hashId)].join(eol));
			assert.isFalse(text.includes("\r\r\n"));
			const parsed = SectionDocument.parseResult(text);
			if (!Result.isSuccess(parsed)) assert.fail("rendered content must parse");
			assert.strictEqual(parsed.success.check(section)._tag, "UpToDate");
		}
	});

	it("accepts exactly LF and CRLF through the Eol schema", () => {
		assert.deepStrictEqual(Eol.literals, ["\n", "\r\n"]);
		for (const eol of Eol.literals) assert.isTrue(S.is(Eol)(eol));
		for (const eol of ["", "\r", "\n\n", "LF"]) assert.isFalse(S.is(Eol)(eol));
	});

	it("owns reusable matchers separately for equal dialect instances", () => {
		const left = SectionDialect.make({ phrase: "MANAGED SECTION", styles: CommentStyle.presets });
		const right = SectionDialect.make({ phrase: "MANAGED SECTION", styles: CommentStyle.presets });
		assert.isTrue(Equal.equals(left, right));
		assert.strictEqual(left.matchers(), left.matchers());
		assert.notStrictEqual(left.matchers(), right.matchers());
		for (const [index, matcher] of left.matchers().entries()) {
			assert.notStrictEqual(matcher.regex, right.matchers()[index]?.regex);
			assert.strictEqual(matcher.style, left.styles[index]);
		}
		const text = expectSuccess(left.render(hashId.section("body")));
		for (let count = 0; count < 3; count += 1) {
			assert.isTrue(left.containsMarker(text));
			const parsed = SectionDocument.parseResult(text, left);
			if (!Result.isSuccess(parsed)) assert.fail("repeated scans must succeed");
			assert.lengthOf(parsed.success.sections, 1);
			for (const matcher of left.matchers()) assert.strictEqual(matcher.regex.lastIndex, 0);
		}
		const narrow = SectionDialect.make({ phrase: "CUSTOM BLOCK", styles: [CommentStyle.slash] });
		assert.isFalse(narrow.containsMarker(text));
	});

	it.effect("keeps owned matcher state out of the encoded dialect", () => Effect.gen(function*() {
		const dialect = SectionDialect.make({ phrase: "MANAGED SECTION", styles: [CommentStyle.hash] });
		dialect.matchers();
		const encoded = yield* S.encodeEffect(SectionDialect)(dialect);
		assert.deepStrictEqual(encoded, { phrase: "MANAGED SECTION", styles: [{ prefix: "#" }] });
		assert.deepStrictEqual(Object.keys(dialect), ["phrase", "styles"]);
	}));

	it("derives attribute refusal from schemas while retaining dollar-anchor behavior", () => {
		for (const name of ["a", "A0_-", "a\n", "a\r", "a\r\n", "a\u2028", "a\u2029", "a\n\n", "", "0a", "_a", "a b"]) {
			const accepted = ATTRIBUTE_NAME_PATTERN.test(name);
			assert.strictEqual(S.is(AttributeName)(name), accepted, JSON.stringify(name));
			const result = SectionDialect.default.render(hashId.section("body", { [name]: "value" }));
			assert.strictEqual(Result.isSuccess(result), accepted, JSON.stringify(name));
			if (Result.isFailure(result)) {
				assert.strictEqual(result.failure.reason, "invalidAttribute");
				assert.strictEqual(result.failure.attribute, name);
			}
		}
		for (const value of ["", "hello", "\u2028", "\u2029", 'a"b', "a\n", "a\r", "a\r\n"]) {
			const accepted = !value.includes('"') && !value.includes("\n") && !value.includes("\r");
			assert.strictEqual(S.is(AttributeValue)(value), accepted);
			const result = SectionDialect.default.render(hashId.section("body", { name: value }));
			assert.strictEqual(Result.isSuccess(result), accepted);
			if (Result.isFailure(result)) assert.strictEqual(result.failure.reason, "invalidAttribute");
		}
	});
});
