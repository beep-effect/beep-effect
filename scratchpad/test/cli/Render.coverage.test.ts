import { assert, it } from "@effect/vitest";
import * as Layer from "effect/Layer";
import { Audience, TerminalEnv } from "../../effected/env/index.ts";
import { CliTheme } from "../../effected/cli/CliTheme.ts";
import { CliLinks } from "../../effected/cli/CliLinks.ts";
import * as Effect from "effect/Effect";
import { Render } from "../../effected/cli/Render.ts";

it.effect("Render retains its runtime class identity", () => Effect.sync(() => {
  const instance: unknown = Reflect.construct(Render, []);
  assert.isTrue(instance instanceof Render);
}));

it.effect("contextOf calls its identity and painting functions and preserves path defaults", () => Effect.sync(() => {
  const plain = Render.contextOf({ audience: "human" });
  assert.strictEqual(plain.paint("error", "message"), "message");
  assert.strictEqual(plain.link({ url: "https://example.com" }, "example"), "example");
  assert.strictEqual(plain.displayPath("/file.ts"), "/file.ts");
  const painted = Render.contextOf({ audience: "human", color: "basic" });
  assert.include(painted.paint("error", "message"), "\u001b[");
  assert.strictEqual(Render.contextOf({ audience: "human", neutralizeWorkflowCommands: false }).neutralizeWorkflowCommands, false);
}));

const terminal = TerminalEnv.layerTest({ stdinIsTerminal: false });
const environment = Layer.mergeAll(
  terminal,
  Audience.layerTest("human"),
  CliTheme.layer().pipe(Layer.provide(terminal)),
  CliLinks.layerTest("off"),
);
it.layer(environment, { timeout: "30 seconds" })((it) => {
  it.effect("service contexts preserve absolute display paths by default", () => Effect.gen(function* () {
    const context = yield* Render.context("stdout");
    assert.strictEqual(context.displayPath("/workspace/file.ts"), "/workspace/file.ts");
  }));
});
