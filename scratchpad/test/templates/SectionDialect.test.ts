import { assert, describe, it } from "@effect/vitest";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { SectionRenderError } from "../../effected/templates/index.ts";
import { CommentStyle, SectionDialect, SectionId } from "../../effected/templates/index.ts";

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
				"definitions.SectionDialectEncoded.properties.phrase.pattern",
				"^[A-Za-z0-9][A-Za-z0-9 _]*$",
			);
		});
	});
});
