import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { createElement } from "react";
import { Toggle } from "../../../effected/cli/ui/Toggle.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

for (const glyphs of ["ascii", "unicode"] as const) {
  for (const value of [true, false]) {
    for (const highlighted of [true, false]) {
      it.effect(`${glyphs} toggle draws ${value ? "on" : "off"} ${highlighted ? "highlighted" : "plain"}`, () =>
        Effect.gen(function* () {
          const handle = yield* CliUiTest.view(createElement(Toggle.View, { label: "Feature", value, highlighted }), { glyphs, color: "none" });
          const frame = yield* handle.plainFrame;
          assert.include(frame, "Feature");
          assert.include(frame, glyphs === "ascii" ? value ? "[x]" : "[ ]" : value ? "◉" : "◯");
          if (highlighted) assert.include(frame, glyphs === "ascii" ? ">" : "→");
        }));
    }
  }
}
