import { CliEnv } from "@beep/cli-kit/CliEnv";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

it.effect("CliEnv retains its runtime class identity", () =>
  Effect.sync(() => {
    assert.isTrue(Reflect.construct(CliEnv, []) instanceof CliEnv);
  })
);

import { CliInteractive } from "@beep/cli-kit/CliInteractive";
import { TerminalEnv } from "@beep/runtime-env";
import { assertSome } from "@effect/vitest/utils";

it.layer(CliEnv.layerTest({ columns: 123, tty: true }), { timeout: "30 seconds" })((it) => {
  it.effect("a test environment preserves an explicitly supplied width", () =>
    Effect.gen(function* () {
      const terminal = yield* TerminalEnv;
      assertSome(terminal.stdout.columns, 123);
      assertSome(terminal.stderr.columns, 123);
      const CliInteractive1 = yield* CliInteractive;
      assert.strictEqual(CliInteractive1, true);
    })
  );
});

import { TestTerminal } from "@beep/cli-kit/testing";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Layer from "effect/Layer";
import * as Stdio from "effect/Stdio";

it.layer(
  CliEnv.layer({ stderrIsTerminal: Effect.succeed(true) }).pipe(
    Layer.provide(
      Layer.mergeAll(
        Stdio.layerTest({}),
        Layer.unwrap(Effect.map(TestTerminal.make(), (terminal) => terminal.layer)),
        ConfigProvider.layer(ConfigProvider.fromUnknown({}))
      )
    )
  ),
  { timeout: "30 seconds" }
)((it) => {
  it.effect("an explicit stderr terminal probe is preserved by the environment layer", () =>
    Effect.gen(function* () {
      const terminal = yield* TerminalEnv;
      assert.strictEqual(terminal.stderr.isTerminal, true);
      assert.strictEqual(terminal.stdout.isTerminal, false);
    })
  );
});
