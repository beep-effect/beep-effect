import { assert, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity } from "effect/Function";
import * as S from "effect/Schema";
import * as O from "effect/Option";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as References from "effect/References";
import * as Prompt from "effect/cli/Prompt";
import * as Path from "effect/Path";
import * as Stdio from "effect/Stdio";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { Text } from "ink";
import { createElement } from "react";
import { Cancelled } from "../../../effected/cli/Cancelled.ts";
import { CliInteractive } from "../../../effected/cli/CliInteractive.ts";
import { CliTheme } from "../../../effected/cli/CliTheme.ts";
import { CurrentRuntimeEnv } from "../../../effected/env/index.ts";
import { TestTerminal } from "../../../effected/cli/testing.ts";
import { MemoryFileSystem } from "../../../effected/memfs/index.ts";
import { CliUi } from "../../../effected/cli/ui/CliUi.ts";
import { useScreenGuard } from "../../../effected/cli/ui/internal/ScreenContext.ts";
import { KeyTable, useKeys } from "../../../effected/cli/ui/KeyTable.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

it.effect("a crash after same-tick resolution wins over the answer", () =>
  Effect.gen(function* () {
    const failure = new Error("answer followed by crash");
    const handle = yield* CliUiTest.render<string>((control) => {
      const View = () => {
        const guard = useScreenGuard();
        useKeys(KeyTable.make([{ keys: ["enter"], action: "submit", help: "submit" }]), () => {
          guard(() => { control.resolve("answer"); throw failure; })();
          guard(() => { throw new Error("later crash"); })();
        });
        return createElement(Text, null, "waiting");
      };
      return createElement(View);
    });
    yield* handle.press("enter");
    const exit = yield* Effect.exit(handle.result);
    assertExitFailure(exit, Exit.match(exit, { onFailure: identity, onSuccess: () => Cause.empty }));
    assert.strictEqual(Cause.squash(exit.cause), failure);
  }),
);

it.effect("the JavaScript constructor retains the CliUi namespace identity", () =>
  Effect.sync(() => {
    const instance: unknown = Reflect.construct(CliUi, []);
    assert.isTrue(instance instanceof CliUi);
  }),
);

const platform = Layer.mergeAll(
  MemoryFileSystem.layer, Path.layer, Stdio.layerTest({}),
  Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, ChildProcessSpawner.make(() => Effect.die("unexpected child process"))),
  Layer.unwrap(Effect.map(TestTerminal.make(), (terminal) => terminal.layer)),
);

it.layer(Layer.mergeAll(platform,
  CliTheme.layerTest(), CliInteractive.layerTest(false), CurrentRuntimeEnv.layerTest({ ci: O.some("github-actions") }),
), { timeout: "30 seconds" })((it) => {
  it.effect("context marks Actions output and an uncleared fallback returns its default", () =>
    Effect.gen(function* () {
      assert.strictEqual((yield* CliUi.context).neutralizeWorkflowCommands, true);
      const configured = CliUi.fallback(() => createElement(Text, null, "unused"), { flag: "answer", otherwise: 42 });
      const fallback = yield* Prompt.isPrompt(configured) ? Effect.die("expected a deferred fallback") : configured;
      assert.isTrue(Prompt.isPrompt(fallback));
      assert.propertyVal(fallback, "value", 42);
    }),
  );
});

it.layer(platform, { timeout: "30 seconds" })((it) => {
  it.effect("a theme-free argument fallback explains its name once and retains its answer", () =>
    Effect.gen(function* () {
      const messages: Array<unknown> = [];
      const configured = CliUi.fallback(() => createElement(Text, null, "unused"), { argument: "destination", otherwise: "local" });
      const fallback = Prompt.isPrompt(configured) ? Effect.die("expected a deferred fallback") : configured;
      const answer = fallback.pipe(
        Effect.provideService(CliInteractive, true),
        Effect.provideService(Logger.CurrentLoggers, new Set([Logger.make(({ message }) => { messages.push(message); })])),
        Effect.provideService(References.MinimumLogLevel, "Debug"),
      );
      assert.propertyVal(yield* answer, "value", "local");
      assert.propertyVal(yield* answer, "value", "local");
      assert.deepStrictEqual(messages, [["@effected/cli/ui: CliUi.fallback for <destination> answered without its screen: CliInteractive is on, but no CliTheme is provided around parsing (CliRuntime.main's env provides one)"]]);
    }),
  );
});

it.effect("mapping forwards cancellation without calling the answer transform", () =>
  Effect.gen(function* () {
    let mapped = 0;
    const handle = yield* CliUiTest.render(CliUi.map<string, number>((control) => {
      control.cancel("interrupt");
      return createElement(Text, null, "cancelled");
    }, (value) => { mapped++; return value.length; }));
    const error = yield* Effect.flip(handle.result);
    assert.strictEqual(S.is(Cancelled)(error) ? error.reason : undefined, "interrupt");
    assert.strictEqual(mapped, 0);
  }),
);
