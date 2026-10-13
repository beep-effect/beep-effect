import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { renderToString, Text } from "ink";
import { createElement } from "react";
import { CliTheme } from "../../../../effected/cli/CliTheme.ts";
import { Glyphs } from "../../../../effected/cli/Glyphs.ts";
import { useScreenCancel, useScreenGuard } from "../../../../effected/cli/ui/internal/ScreenContext.ts";
import { uiProviders } from "../../../../effected/cli/ui/internal/UiProviders.ts";
import { loadInk } from "../../../../effected/cli/ui/internal/ink.ts";

it.layer(CliTheme.layerTest(), { timeout: "10 seconds" })("screen context hooks", (it) => {
it.effect("cancel under a provider is a no-op and an unguarded handler keeps its arguments and exception", () =>
  Effect.gen(function* () {
    yield* loadInk;
    const theme = yield* CliTheme;
    let received = "";
    const failure = new Error("input");
    const Probe = () => {
      useScreenCancel()("escape");
      const guard = useScreenGuard();
      guard((value: string) => { received = value; })("kept");
      assert.throws(() => guard(() => { throw failure; })(), /input/);
      return createElement(Text, null, "ok");
    };
    assert.strictEqual(renderToString(uiProviders({ theme, glyphs: Glyphs.ascii }, createElement(Probe))), "ok");
    assert.strictEqual(received, "kept");
    const Outside = () => {
      assert.throws(useScreenCancel, /outside a screen/);
      useScreenGuard()(() => { received = "outside"; })();
      return createElement(Text, null, "outside");
    };
    assert.strictEqual(renderToString(createElement(Outside)), "outside");
    assert.strictEqual(received, "outside");
  }),
);

});
