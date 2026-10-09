import { assert, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { Select } from "../../../effected/cli/ui/Select.ts";

it.effect("initial and page moves seek backwards when the remaining rows are disabled", () => Effect.sync(() => {
  const choices = [{ label: "enabled", value: 1 }, { label: "disabled", value: 2, disabled: true }, { label: "disabled too", value: 3, disabled: true }];
  const state = Select.init(choices, { initial: 2, height: 1 });
  assert.strictEqual(state.viewport.cursor, 0);
  assert.strictEqual(Select.step(state, "pagedown").viewport.cursor, 0);
  const disabled = { ...state, viewport: { ...state.viewport, cursor: 1 } };
  assert.strictEqual(Select.step(disabled, "submit"), disabled);
  assertNone(Select.chosen({ ...state, submitted: true, viewport: { ...state.viewport, cursor: 9 } }));
  const last = Select.init([{ label: "disabled", value: 0, disabled: true }, { label: "enabled", value: 1 }], { initial: 1, height: 1 });
  assert.strictEqual(Select.step(last, "pageup").viewport.cursor, 1);
}));

it.effect("cancel reducer preserves the choice", () => Effect.sync(() => {
  const state = Select.init([{ label: "A", value: 1 }]);
  assert.strictEqual(Select.step(state, "cancel"), state);
}));

it.effect("a NaN initial index falls back to the first row", () => Effect.sync(() => {
  assert.strictEqual(Select.init([{ label: "A", value: 1 }], { initial: Number.NaN }).viewport.cursor, 0);
}));
