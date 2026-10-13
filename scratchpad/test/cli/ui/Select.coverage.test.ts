import { assert, it, vi } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import { Select } from "../../../effected/cli/ui/Select.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";
import { Viewport } from "../../../effected/cli/ui/Viewport.ts";

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

it.effect("a changing disabled accessor retains the fallback when both searches lose their enabled choice", () => Effect.sync(() => {
  let reads = 0;
  const choice = {
    label: "changing",
    value: 1,
    get disabled() {
      reads++;
      return reads > 1;
    },
  };
  const state = Select.init([choice]);
  assert.strictEqual(state.viewport.cursor, 0);
  assert.strictEqual(reads, 3);
  assert.strictEqual(Select.step(state, "submit"), state);
}));

it.effect("the row renderer leaves unexpected headers and missing choices blank", () => Effect.gen(function* () {
  const original = Viewport.View;
  yield* Effect.acquireRelease(
    Effect.sync(() => vi.spyOn(Viewport, "View").mockImplementation((props) => {
      // Exercise the callback's defensive inputs while retaining the real viewport render.
      const header = props.renderRow({ _tag: "Header", label: "unexpected" }, false);
      const missing = props.renderRow({ _tag: "Item", key: "999" }, false);
      assert.deepStrictEqual(header, missing);
      assert.isTrue(P.hasProperty(header.props, "children"));
      if (P.hasProperty(header.props, "children")) assert.strictEqual(header.props.children, "  ");
      return original(props);
    })),
    (spy) => Effect.sync(() => spy.mockRestore()),
  );
  const handle = yield* CliUiTest.render(Select.screen({ message: "Pick", choices: [{ label: "visible", value: 1 }] }));
  assert.include(yield* handle.plainFrame, "visible");
}));

// Array scanning is an implementation of third-party collections, so observe it at its actual runtime seam.
it.effect("choice lookups do not scan viewport rows during a fully visible repaint", () => Effect.gen(function* () {
  const scan = yield* Effect.acquireRelease(
    Effect.sync(() => vi.spyOn(Array.prototype, "indexOf")),
    (spy) => Effect.sync(() => spy.mockRestore()),
  );
  const choices = A.makeBy(64, (index) => ({ label: `choice ${index}`, value: index }));
  const handle = yield* CliUiTest.render(Select.screen({ message: "Pick", choices, height: 64 }), { rows: 80 });
  assert.include(yield* handle.plainFrame, "choice 63");
  yield* handle.press("down");
  assert.include(yield* handle.plainFrame, "→ choice 1");
  assert.strictEqual(A.filter(scan.mock.calls, ([value]) => P.isTagged("Item")(value)).length, 0);
}));
