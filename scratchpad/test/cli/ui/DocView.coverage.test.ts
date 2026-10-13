import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { renderToString } from "ink";
import { createElement } from "react";
import { CliTheme } from "../../../effected/cli/CliTheme.ts";
import { Doc } from "../../../effected/cli/Doc.ts";
import { Render } from "../../../effected/cli/Render.ts";
import { CliUi } from "../../../effected/cli/ui/CliUi.ts";
import { DocView } from "../../../effected/cli/ui/DocView.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

it.layer(CliTheme.layerTest(), { timeout: "30 seconds" })((it) => {
it.effect("without a provider DocView requires a context, and explicit contexts preserve links and paths", () =>
  Effect.gen(function* () {
    yield* CliUi.context;
    assert.throws(() => renderToString(createElement(DocView, { doc: [] })), /DocView.*no ctx outside/);
    const doc = [Doc.paragraph(Doc.link({ url: "https://example.test" }, "label"), " ", Doc.file("/absolute"))];
    const ctx = Render.contextOf({ audience: "human", width: 80 });
    assert.strictEqual(renderToString(createElement(DocView, { doc, ctx })), Render.plain(doc, ctx));
    assert.strictEqual(renderToString(createElement(DocView, { doc: [], ctx })), "");
  }),
);
it.effect("the inferred context keeps link labels and absolute file paths", () =>
  Effect.gen(function* () {
    const doc = [Doc.paragraph(Doc.link({ url: "https://example.test" }, "label"), " ", Doc.file("/absolute"))];
    const handle = yield* CliUiTest.render(() => createElement(DocView, { doc }), { color: "none" });
    assert.strictEqual(yield* handle.plainFrame, Render.plain(doc, Render.contextOf({ audience: "human", width: 79 })));
  }),
);
});
