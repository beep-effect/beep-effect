import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { JsoncEdit, JsoncFormatter, JsoncFormattingOptions, JsoncRange } from "@beep/scratchpad/effected/jsonc/index";

describe("JsoncFormatter", () => {
	describe("range restriction", () => {
		it("the final-newline edit respects a range that excludes the document end", () => {
			const text = '{"a":1}';
			const options = JsoncFormattingOptions.make({ insertFinalNewline: true });
			const range = JsoncRange.make({ offset: 0, length: 3 });
			const edits = JsoncFormatter.format(text, range, options);
			assert.isFalse(edits.some((e) => e.content === "\n" && e.offset >= text.length - 1));
		});

		it("the final-newline edit is produced when the range covers the document end", () => {
			const text = '{"a":1}';
			const options = JsoncFormattingOptions.make({ insertFinalNewline: true });
			const range = JsoncRange.make({ offset: 0, length: text.length });
			const out = JsoncFormatter.formatToString(text, range, options);
			assert.isTrue(out.endsWith("\n"));
		});
	});

	describe("format / formatToString", () => {
		it("reflows a compact object with default options", () => {
			assert.strictEqual(JsoncFormatter.formatToString('{"a":1,"b":2}'), '{\n  "a": 1,\n  "b": 2\n}');
		});

		it("honors tabSize and tabs", () => {
			const options = JsoncFormattingOptions.make({ insertSpaces: false });
			assert.strictEqual(JsoncFormatter.formatToString('{"a":1}', undefined, options), '{\n\t"a": 1\n}');
		});

		it("preserves comments while reformatting", () => {
			const out = JsoncFormatter.formatToString('{"a":1 // note\n}');
			assert.include(out, "// note");
			assert.include(out, '"a": 1');
		});

		it("format returns edits only within a range", () => {
			const text = '{"a":1,"b":2}';
			const range = JsoncRange.make({ offset: 0, length: 4 });
			const edits = JsoncFormatter.format(text, range);
			assert.isTrue(edits.every((e) => e.offset + e.length <= 4));
		});

		it("appends a final newline when requested", () => {
			const out = JsoncFormatter.formatToString(
				'{"a":1}',
				undefined,
				JsoncFormattingOptions.make({ insertFinalNewline: true }),
			);
			assert.isTrue(out.endsWith("\n"));
		});

		it("computes edits as JsoncEdit instances", () => {
			const edits = JsoncFormatter.format('{"a":1}');
			assert.isTrue(edits.every(S.is(JsoncEdit)));
		});
	});

	describe("idempotence (property)", () => {
		const Sample = S.Struct({
			name: S.String,
			count: S.Int,
			nested: S.Struct({ flag: S.Boolean }),
			items: S.Array(S.Int),
		});

		it.effect.prop("formatting a formatted document is a no-op", [Sample], ([value]) =>
			Effect.gen(function* () {
				const json = yield* S.encodeEffect(S.fromJsonString(Sample))(value);
				const once = JsoncFormatter.formatToString(json);
				const twice = JsoncFormatter.formatToString(once);
				assert.strictEqual(twice, once);
			}),
		);
	});
});
