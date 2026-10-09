import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Terminal from "effect/Terminal";
import { CliConfig, GlobalFlag } from "effect/cli";
import { CliInteractive } from "../../effected/cli/CliInteractive.ts";
import { CliPrompt } from "../../effected/cli/CliPrompt.ts";

it.effect("the wizard gate leaves a consumer config without Wizard untouched", () => Effect.gen(function* () {
  const config = CliConfig.make({ builtIns: [GlobalFlag.Help] });
  const gated = yield* Effect.scopedWith((scope) => Effect.flatMap(
    Layer.buildWithScope(CliPrompt.gateWizard, scope),
    (context) => Effect.provideContext(CliConfig.CliConfig, context),
  )).pipe(
    Effect.provideService(CliConfig.CliConfig, config),
    Effect.provideService(CliInteractive, false),
  );
  assert.strictEqual(gated, config);
  assert.deepStrictEqual(gated.builtIns, [GlobalFlag.Help]);
}));

const real = Terminal.make({
  columns: Effect.succeed(80),
  rows: Effect.succeed(24),
  readInput: Effect.die("unused input queue"),
  readLine: Effect.succeed("person answered"),
  display: () => Effect.void,
});

it.layer(CliPrompt.gateTerminal.pipe(Layer.provide(Layer.succeed(Terminal.Terminal, real))), { timeout: "30 seconds" })((it) => {
  it.effect("an interactive readLine delegates to the real terminal", () => Effect.gen(function* () {
    const terminal = yield* Terminal.Terminal;
    const answer = yield* terminal.readLine.pipe(Effect.provideService(CliInteractive, true));
    assert.strictEqual(answer, "person answered");
    assert.strictEqual(yield* terminal.columns, 80);
    assert.strictEqual(yield* terminal.rows, 24);
  }));
});
