import { assert, describe, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { AnnotationProperties, WorkflowCommand } from "../../effected/github-commands/index.ts";

describe("WorkflowCommand", () => {
	describe("AnnotationProperties runtime contract", () => {
		const isAnnotationProperties = S.is(AnnotationProperties);

		it("accepts absent fields and structural annotations without integer or range constraints", () => {
			const properties: AnnotationProperties = {
				title: "",
				file: "src/main.ts",
				startLine: -1.5,
				endLine: 0,
				startColumn: 0.25,
				endColumn: -2,
			};
			assert.isTrue(isAnnotationProperties({}));
			assert.isTrue(isAnnotationProperties({ title: "T" }));
			assert.isTrue(isAnnotationProperties(properties));
			assert.strictEqual(
				WorkflowCommand.error("e", properties),
				"::error title=,file=src/main.ts,line=-1.5,endLine=0,col=0.25,endColumn=-2::e",
			);
		});

		it("rejects invalid field types, explicit undefined and non-finite coordinates", () => {
			for (const key of ["title", "file"]) {
				for (const value of [1, null, undefined]) assert.isFalse(isAnnotationProperties({ [key]: value }));
			}
			for (const key of ["startLine", "endLine", "startColumn", "endColumn"]) {
				for (const value of ["1", null, undefined, NaN, Infinity, -Infinity]) {
					assert.isFalse(isAnnotationProperties({ [key]: value }));
				}
			}
		});

		it("keeps command helpers structural without automatic schema decoding", () => {
			const properties: AnnotationProperties = { startLine: Infinity, endColumn: NaN };
			assert.isFalse(isAnnotationProperties(properties));
			assert.strictEqual(WorkflowCommand.notice("n", properties), "::notice line=Infinity,endColumn=NaN::n");
			assert.strictEqual(WorkflowCommand.warning("w", properties), "::warning line=Infinity,endColumn=NaN::w");
			assert.strictEqual(WorkflowCommand.error("e", properties), "::error line=Infinity,endColumn=NaN::e");
		});
	});

	describe("rendering", () => {
		it("renders a bare command with no properties", () => {
			assert.strictEqual(WorkflowCommand.render("debug", {}, "hello"), "::debug::hello");
		});

		it("renders properties as comma-separated key=value pairs", () => {
			assert.strictEqual(
				WorkflowCommand.render("error", { file: "app.ts", line: 3 }, "boom"),
				"::error file=app.ts,line=3::boom",
			);
		});

		it("omits properties that are undefined rather than emitting empty values", () => {
			assert.strictEqual(
				WorkflowCommand.render("warning", { file: "a.ts", line: undefined, title: "T" }, "m"),
				"::warning file=a.ts,title=T::m",
			);
		});

		it("renders an empty message as an empty tail", () => {
			assert.strictEqual(WorkflowCommand.render("endgroup", {}, ""), "::endgroup::");
		});
	});

	describe("escaping", () => {
		// The runner parses these characters structurally; an unescaped one
		// truncates the command or injects a new one.
		it("escapes percent, CR and LF in the message", () => {
			assert.strictEqual(WorkflowCommand.render("debug", {}, "100% \r\n done"), "::debug::100%25 %0D%0A done");
		});

		it("escapes colon and comma in property values, which delimit the command", () => {
			assert.strictEqual(WorkflowCommand.render("error", { title: "a:b,c" }, "m"), "::error title=a%3Ab%2Cc::m");
		});

		it("escapes percent, CR and LF in property values too", () => {
			assert.strictEqual(WorkflowCommand.render("error", { title: "50%\nx" }, "m"), "::error title=50%25%0Ax::m");
		});

		it("escapes the percent sign FIRST, so an escape sequence is not double-escaped", () => {
			// Escaping "\n" before "%" would turn "%0A" back into "%250A".
			assert.strictEqual(WorkflowCommand.render("debug", {}, "\n"), "::debug::%0A");
			assert.strictEqual(WorkflowCommand.render("debug", {}, "%0A"), "::debug::%250A");
		});

		it("refuses to let a message inject a second command", () => {
			const rendered = WorkflowCommand.render("debug", {}, "x\n::set-output name=a::b");
			assert.notInclude(rendered.slice("::debug::".length), "\n");
			assert.strictEqual(rendered, "::debug::x%0A::set-output name=a::b");
		});
	});

	describe("named commands", () => {
		it("builds the annotation commands", () => {
			assert.strictEqual(WorkflowCommand.debug("d"), "::debug::d");
			assert.strictEqual(WorkflowCommand.notice("n", {}), "::notice::n");
			assert.strictEqual(WorkflowCommand.warning("w", {}), "::warning::w");
			assert.strictEqual(WorkflowCommand.error("e", {}), "::error::e");
		});

		it("maps annotation properties onto GitHub's abbreviated names", () => {
			assert.strictEqual(
				WorkflowCommand.error("e", { file: "a.ts", startLine: 1, endLine: 2, startColumn: 3, endColumn: 4 }),
				"::error file=a.ts,line=1,endLine=2,col=3,endColumn=4::e",
			);
		});

		it("builds the grouping commands", () => {
			assert.strictEqual(WorkflowCommand.group("build"), "::group::build");
			assert.strictEqual(WorkflowCommand.endGroup(), "::endgroup::");
		});

		it("builds add-mask, which must escape like any other message", () => {
			assert.strictEqual(WorkflowCommand.addMask("s3cr3t"), "::add-mask::s3cr3t");
			assert.strictEqual(WorkflowCommand.addMask("a\nb"), "::add-mask::a%0Ab");
		});
	});
});
