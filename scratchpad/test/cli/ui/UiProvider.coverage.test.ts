import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { createElement } from "react";
import { CliUi } from "../../../effected/cli/ui/CliUi.ts";
import { UiProvider } from "../../../effected/cli/ui/UiProvider.ts";
import { DocView } from "../../../effected/cli/ui/DocView.ts";
import { Doc } from "../../../effected/cli/Doc.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

it.layer(Layer.unwrap(Effect.map(CliUiTest.session(), (session) => session.layer)), { timeout: "30 seconds" })((it) => {
it.effect("a nested provider cannot lift workflow-command neutralization", () =>
  Effect.gen(function* () {
    const value = yield* CliUi.context;
    const tree = createElement(UiProvider, { value: { ...value, neutralizeWorkflowCommands: true } },
      createElement(UiProvider, { value: { ...value, neutralizeWorkflowCommands: false } },
        createElement(DocView, { doc: [Doc.lines([[Doc.text("::error::data")]])] })));
    const handle = yield* CliUiTest.view(tree, { color: "none" });
    const frame = yield* handle.plainFrame;
    assert.include(frame, "data");
    assert.isFalse(frame.startsWith("::error::"));
  }));

});
