import { assert, it, vi } from "@effect/vitest";
import { assertDefined } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { Text } from "ink";
import { createElement } from "react";
import { KeyTable, useKeys } from "../../../effected/cli/ui/KeyTable.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

const handlers: Array<Parameters<typeof import("ink").useInput>[0]> = [];
vi.doMock("ink", (importOriginal) => importOriginal<typeof import("ink")>().then((actual) => ({
  ...actual,
  useInput: (handler: Parameters<typeof actual.useInput>[0], options: Parameters<typeof actual.useInput>[1]) => {
    handlers.push(handler);
    return actual.useInput(handler, options);
  },
})));

it.effect("coalesced input translates control graphemes and drops unsupported controls", () =>
  Effect.gen(function* () {
    const seen: Array<string> = [];
    const table = KeyTable.make([
      { keys: ["enter"], action: "enter", help: "submit" },
      { keys: ["tab"], action: "tab", help: "next" },
      { keys: ["space"], action: "space", help: "toggle" },
      { keys: ["backspace"], action: "backspace", help: "erase" },
      { keys: [{ char: "x" }], action: "x", help: "type" },
    ]);
    const Keys = () => {
      useKeys((action: string) => seen.push(action))(table);
      return createElement(Text, null, "keys");
    };
    const handle = yield* CliUiTest.render(() => createElement(Keys));
    yield* handle.chunk({ char: "x\n\t \b\u007f\u0000x" });
    assert.deepStrictEqual(seen, ["x", "enter", "tab", "space", "backspace", "backspace", "x"]);
    yield* handle.chunk({ char: "\u0000" });
    yield* handle.chunk({ char: "\u0001" });
    yield* handle.chunk({ char: "\u001bx" });
    assert.lengthOf(seen, 7);
  }),
);

it.effect("plain Ink callback input handles backspace graphemes and an unsupported singleton", () =>
  Effect.gen(function* () {
    const seen: Array<string> = [];
    const Keys = () => {
      useKeys(KeyTable.make([
        { keys: ["backspace"], action: "erase", help: "erase" },
        { keys: [{ char: "x" }], action: "x", help: "type" },
      ]), (action) => seen.push(action));
      return createElement(Text, null, "keys");
    };
    yield* CliUiTest.render(() => createElement(Keys));
    const input = handlers.at(-1);
    assertDefined(input);
    const key = {
      upArrow: false, downArrow: false, leftArrow: false, rightArrow: false,
      pageDown: false, pageUp: false, home: false, end: false, return: false,
      escape: false, ctrl: false, shift: false, tab: false, backspace: false,
      delete: false, meta: false, super: false, hyper: false, capsLock: false, numLock: false,
    };
    input("x\b\u007f", key);
    assert.deepStrictEqual(seen, ["x", "erase", "erase"]);
    input("\u0000", key);
    assert.deepStrictEqual(seen, ["x", "erase", "erase"]);
  }),
);
