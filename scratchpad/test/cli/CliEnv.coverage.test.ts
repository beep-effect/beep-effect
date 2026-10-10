import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CliEnv } from "../../effected/cli/CliEnv.ts";

it.effect("CliEnv retains its runtime class identity", () => Effect.sync(() => {
  assert.isTrue(Reflect.construct(CliEnv, []) instanceof CliEnv);
}));

import { CliInteractive } from "../../effected/cli/CliInteractive.ts";
import { TerminalEnv } from "../../effected/env/index.ts";
import { assertSome } from "@effect/vitest/utils";
it.layer(CliEnv.layerTest({ columns: 123, tty: true }), { timeout: "30 seconds" })((it) => {
  it.effect("a test environment preserves an explicitly supplied width", () => Effect.gen(function* () {
    const terminal = yield* TerminalEnv;
    assertSome(terminal.stdout.columns, 123);
    assertSome(terminal.stderr.columns, 123);
    assert.strictEqual(yield* CliInteractive, true);
  }));
});

import * as Layer from "effect/Layer";
import * as Stdio from "effect/Stdio";
import * as ConfigProvider from "effect/ConfigProvider";
import { TestTerminal } from "../../effected/cli/testing.ts";
it.layer(CliEnv.layer({ stderrIsTerminal: Effect.succeed(true) }).pipe(Layer.provide(Layer.mergeAll(Stdio.layerTest({}), Layer.unwrap(Effect.map(TestTerminal.make(), (terminal) => terminal.layer)), ConfigProvider.layer(ConfigProvider.fromUnknown({}))))), { timeout: "30 seconds" })((it) => {
  it.effect("an explicit stderr terminal probe is preserved by the environment layer", () => Effect.gen(function* () {
    const terminal = yield* TerminalEnv;
    assert.strictEqual(terminal.stderr.isTerminal, true);
    assert.strictEqual(terminal.stdout.isTerminal, false);
  }));
});
