import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { createElement } from "react";
import { KeyHelp } from "../../../effected/cli/ui/KeyHelp.ts";
import { KeyTable } from "../../../effected/cli/ui/KeyTable.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

it.effect("root-free help truncates its own keys without adding cancel", () =>
  Effect.gen(function* () {
    const table = KeyTable.make([{ keys: ["enter"], action: "submit", help: "continue with the selected answer" }]);
    const handle = yield* CliUiTest.render(() => createElement(KeyHelp, { tables: [table], root: false }), {
      columns: 12,
      color: "none",
    });
    assert.strictEqual(Str.trimEnd(yield* handle.plainFrame), "enter cont…");
  }),
);
