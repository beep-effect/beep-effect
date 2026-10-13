import { assert, describe, it } from "@effect/vitest";
import * as S from "effect/Schema";
import * as AST from "effect/SchemaAST";
import { ScreenExited } from "../../../effected/cli/ui/CliUi.ts";
import { LiveTickError } from "../../../effected/cli/ui/CliUiLive.ts";
import { Confirm, ConfirmAction, DuplicateToggleKeyError } from "../../../effected/cli/ui/Confirm.ts";
import { MissingDocViewThemeError } from "../../../effected/cli/ui/DocView.ts";
import { DuplicateItemKey, MultiSelect, MultiSelectAction } from "../../../effected/cli/ui/MultiSelect.ts";
import { NoEnabledChoiceError, Select, SelectAction } from "../../../effected/cli/ui/Select.ts";

describe("reducer and runtime error metadata", () => {
	for (const [error, tag, file] of [
		[DuplicateToggleKeyError, "DuplicateToggleKeyError", "Confirm"],
		[NoEnabledChoiceError, "NoEnabledChoiceError", "Select"],
		[MissingDocViewThemeError, "MissingDocViewThemeError", "DocView"],
		[LiveTickError, "LiveTickError", "CliUiLive"],
		[ScreenExited, "ScreenExited", "CliUi"],
		[DuplicateItemKey, "DuplicateItemKey", "MultiSelect"],
	] as const) {
		it(`${tag} describes its schema and message without changing construction`, () => {
			assert.include(AST.resolveIdentifier(error.ast) ?? "", tag);
			assert.isAbove((AST.resolveDescription(error.ast) ?? "").length, 20);
			assert.include(AST.resolveIdentifier(error.fields.message.ast) ?? "", `${tag}.message`);
			assert.isAbove((AST.resolveDescription(error.fields.message.ast) ?? "").length, 20);
			const instance = error.make({ message: "invariant failed" });
			assert.strictEqual(instance._tag, tag);
			assert.strictEqual(instance.message, "invariant failed");
			assert.strictEqual(instance.name, error === ScreenExited || error === DuplicateItemKey ? "Error" : `@beep/scratchpad/effected/cli/ui/${file}/${tag}`);
		});
	}
});

describe("schema-owned reducer actions", () => {
	it("Confirm preserves every action and makes submitted states terminal", () => {
		assert.deepStrictEqual(ConfirmAction.literals, ["up", "down", "toggle", "yes", "no", "flip", "submit", "cancel"]);
		assert.isString(AST.resolveDescription(ConfirmAction.ast));
		const state = Confirm.step(Confirm.step(Confirm.init({ toggles: [{ key: "extra", label: "Extra", value: false }] }), "down"), "submit");
		for (const action of ConfirmAction.literals) {
			assert.isTrue(S.is(ConfirmAction)(action));
			assert.strictEqual(Confirm.step(state, action), state);
		}
	});

	it("Select preserves every action and makes submitted states terminal", () => {
		assert.deepStrictEqual(SelectAction.literals, ["up", "down", "home", "end", "pageup", "pagedown", "submit", "cancel"]);
		assert.isString(AST.resolveDescription(SelectAction.ast));
		const state = Select.step(Select.init([{ label: "first", value: 1 }, { label: "second", value: 2 }]), "submit");
		for (const action of SelectAction.literals) {
			assert.isTrue(S.is(SelectAction)(action));
			assert.strictEqual(Select.step(state, action), state);
		}
	});

	it("MultiSelect preserves every action and makes submitted states terminal", () => {
		assert.deepStrictEqual(MultiSelectAction.literals, ["up", "down", "home", "end", "pageup", "pagedown", "toggle", "toggleSection", "submit", "cancel"]);
		assert.isString(AST.resolveDescription(MultiSelectAction.ast));
		const state = MultiSelect.step(MultiSelect.init([{ title: "Items", items: [{ key: "first", label: "first", value: 1 }] }]), "submit");
		for (const action of MultiSelectAction.literals) {
			assert.isTrue(S.is(MultiSelectAction)(action));
			assert.strictEqual(MultiSelect.step(state, action), state);
		}
	});
});
