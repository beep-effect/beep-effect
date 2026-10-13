import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { createElement } from "react";
import { Text } from "ink";
import { Viewport, type ViewportRow } from "../../../effected/cli/ui/Viewport.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

it.effect("an empty viewport is immobile and header-only rows have no selected item", () =>
  Effect.gen(function* () {
    const empty = Viewport.init(0, 3);
    assert.strictEqual(Viewport.step(empty, "down"), empty);
    assert.deepStrictEqual(Viewport.resize(empty, 2), { cursor: 0, offset: 0, count: 0, height: 2 });
    const rows: ReadonlyArray<ViewportRow> = [{ _tag: "Header", label: "header" }];
    const handle = yield* CliUiTest.render(() => createElement(Viewport.View, {
      rows, state: empty, renderRow: (row, selected) => {
        assert.isFalse(selected);
        return createElement(Text, null, row._tag === "Header" ? row.label : row.key);
      },
    }));
    assert.strictEqual(yield* handle.plainFrame, "header");
  }),
);

it.effect("expanding the window keeps the selected last item visible when the preceding header consumes its budget", () =>
  Effect.gen(function* () {
    const rows: ReadonlyArray<ViewportRow> = [
      { _tag: "Header", label: "section" },
      { _tag: "Item", key: "first" },
      { _tag: "Header", label: "last section" },
      { _tag: "Item", key: "last" },
    ];
    const handle = yield* CliUiTest.render(() => createElement(Viewport.View, {
      rows, state: { count: 2, cursor: 1, height: 3, offset: 1 },
      renderRow: (row, selected) => createElement(Text, null, row._tag === "Header" ? row.label : `${selected ? ">" : " "}${row.key}`),
    }));
    assert.include(yield* handle.plainFrame, ">last");
    assert.notInclude(yield* handle.plainFrame, "first");
  }),
);

it.effect("a NaN cursor keeps the view's defensive first-row selection and window fallback", () =>
  Effect.gen(function* () {
    const rows: ReadonlyArray<ViewportRow> = [{ _tag: "Item", key: "first" }, { _tag: "Item", key: "second" }];
    const handle = yield* CliUiTest.render(() => createElement(Viewport.View, {
      rows, state: Viewport.init(2, 2, Number.NaN),
      renderRow: (row, selected) => createElement(Text, null, row._tag === "Header" ? row.label : `${selected ? ">" : " "}${row.key}`),
    }));
    assert.strictEqual(yield* handle.plainFrame, ">first\n second");
  }),
);
