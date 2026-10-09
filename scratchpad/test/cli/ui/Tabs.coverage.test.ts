import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { createElement, StrictMode, Activity } from "react";
import { Tabs } from "../../../effected/cli/ui/Tabs.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

it.effect("strict mode announces an initial tab once and absent callbacks remain optional", () =>
  Effect.gen(function* () {
    const calls: Array<string> = [];
    const handle = yield* CliUiTest.view(createElement(StrictMode, null, createElement(Tabs.View, {
      tabs: [{ name: "a", label: "Alpha" }, { name: "b", label: "Beta" }],
      onChange: (name: string) => { calls.push(name); },
    })));
    assert.deepStrictEqual(calls, ["a"]);
    yield* handle.rerender(createElement(Tabs.View, { tabs: [{ name: "a", label: "Alpha" }, { name: "b", label: "Beta" }] }));
    yield* handle.press("right");
    assert.include(yield* handle.frame, "Beta");
  }));

it.effect("empty tabs ignore keys and render no labels", () =>
  Effect.gen(function* () {
    const calls: Array<string> = [];
    const handle = yield* CliUiTest.view(createElement(Tabs.View, { tabs: [], onChange: (name: string) => { calls.push(name); } }));
    yield* handle.press("right");
    assert.deepStrictEqual(calls, []);
    assert.strictEqual(yield* handle.frame, "");
  }));

it.effect("overflow widens around the active tab to the left and right", () =>
  Effect.gen(function* () {
    const tabs = [{ name: "a", label: "A" }, { name: "b", label: "B" }, { name: "c", label: "C" }, { name: "d", label: "D" }, { name: "e", label: "E" }];
    const handle = yield* CliUiTest.view(createElement(Tabs.View, { tabs, defaultValue: "c", separator: "|" }), { columns: 17, color: "none" });
    const frame = yield* handle.frame;
    assert.include(frame, "[C]");
    assert.include(frame, "B");
    assert.include(frame, "D");
    assert.include(frame, "…");
  }));

it.effect("shrinking uncontrolled tabs after navigation renders an empty missing position", () =>
  Effect.gen(function* () {
    const handle = yield* CliUiTest.view(createElement(Tabs.View, { tabs: [{ name: "a", label: "Alpha" }, { name: "b", label: "Beta" }], defaultValue: "b" }), { columns: 5, color: "none" });
    yield* handle.rerender(createElement(Tabs.View, { tabs: [{ name: "a", label: "Long alpha" }] }));
    assert.notInclude(yield* handle.plainFrame, "Beta");
    yield* handle.press("right");
    assert.include(yield* handle.plainFrame, "[");
  }));

it.effect("reactivating a hidden tab tree does not announce its initial tab twice", () =>
  Effect.gen(function* () {
    const calls: Array<string> = [];
    const tabs = [{ name: "a", label: "Alpha" }, { name: "b", label: "Beta" }];
    const tree = (mode: "visible" | "hidden") => createElement(Activity, { mode, children: createElement(Tabs.View, { tabs, onChange: (name: string) => { calls.push(name); } }) });
    const handle = yield* CliUiTest.view(tree("visible"));
    yield* handle.rerender(tree("hidden"));
    yield* handle.rerender(tree("visible"));
    assert.deepStrictEqual(calls, ["a"]);
    assert.include(yield* handle.plainFrame, "Alpha");
  }));
