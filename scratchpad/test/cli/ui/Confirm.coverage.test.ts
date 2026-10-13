import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Confirm } from "../../../effected/cli/ui/Confirm.ts";

it.effect("the JavaScript constructor retains the Confirm namespace identity", () =>
  Effect.sync(() => {
    const instance: unknown = Reflect.construct(Confirm, []);
    assert.isTrue(instance instanceof Confirm);
    assert.deepStrictEqual(Confirm.result(Confirm.init()), { confirmed: false, toggles: {} });
  }),
);

it.effect("cancel preserves the reducer state and toggling changes only the selected row", () =>
  Effect.sync(() => {
    const initial = Confirm.init({ toggles: [
      { key: "a", label: "first", value: false },
      { key: "b", label: "second", value: true },
    ] });
    assert.strictEqual(Confirm.step(initial, "cancel"), initial);
    const selected = Confirm.step(initial, "down");
    assert.deepStrictEqual(Confirm.result(Confirm.step(selected, "toggle")), {
      confirmed: false, toggles: { a: true, b: true },
    });
    assert.deepStrictEqual(Confirm.result(initial), { confirmed: false, toggles: { a: false, b: true } });
  }),
);
