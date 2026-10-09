import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { MultiSelect } from "../../../effected/cli/ui/MultiSelect.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

it.effect("an empty multi-select ignores both toggle actions and submits an empty selection", () =>
  Effect.gen(function* () {
    const empty = MultiSelect.init([]);
    assert.strictEqual(MultiSelect.step(empty, "toggle"), empty);
    assert.strictEqual(MultiSelect.step(empty, "toggleSection"), empty);
    const handle = yield* CliUiTest.render(MultiSelect.screen({ message: "Nothing available", sections: [], height: 2 }));
    yield* handle.press("space");
    yield* handle.type("a");
    yield* handle.press("enter");
    assert.deepStrictEqual(yield* handle.result, []);
  }));

it.effect("cancel reducer preserves the selection", () => Effect.sync(() => {
  const state = MultiSelect.init([]);
  assert.strictEqual(MultiSelect.step(state, "cancel"), state);
}));
