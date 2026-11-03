import { CliInteractive } from "@beep/cli-kit";
import { provideBuilt } from "@beep/cli-kit/internal/provideBuilt";
import { Audience, TerminalEnv } from "@beep/runtime-env";
import { assert, describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import type { AudienceKind } from "@beep/runtime-env";

const decide = (
  kind: AudienceKind,
  stdinIsTerminal: boolean,
  stdoutIsTerminal: boolean,
  env: Record<string, string> = {}
) =>
  CliInteractive.pipe(
    provideBuilt(
      CliInteractive.layer.pipe(
        Layer.provide(
          Layer.mergeAll(
            Audience.layerTest(kind),
            TerminalEnv.layerTest({ stdinIsTerminal, stdout: { isTerminal: stdoutIsTerminal } })
          )
        )
      )
    ),
    // The environment is fixed, never the host's, and provided outside the layer that reads it: TERM decides too.
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env))
  );

describe("CliInteractive.layer", () => {
  const kinds: ReadonlyArray<AudienceKind> = ["human", "agent", "ci"];
  for (const kind of kinds) {
    for (const stdin of [true, false]) {
      for (const stdout of [true, false]) {
        // Only a human with a terminal on both ends is interactive.
        const expected = kind === "human" && stdin && stdout;
        it.effect(`${kind}, stdin TTY ${stdin}, stdout TTY ${stdout} => ${expected}`, () =>
          Effect.gen(function* () {
            const decide1 = yield* decide(kind, stdin, stdout);
            assert.strictEqual(decide1, expected);
          })
        );
      }
    }
  }

  it.effect("a human on two terminals is not interactive when TERM is dumb: it cannot move the cursor", () =>
    Effect.gen(function* () {
      const decide2 = yield* decide("human", true, true, { TERM: "dumb" });
      assert.strictEqual(decide2, false);
      const decide3 = yield* decide("human", true, true, { TERM: "xterm-256color" });
      assert.strictEqual(decide3, true, "control: a real TERM");
      const decide4 = yield* decide("human", true, true, { TERM: "" });
      assert.strictEqual(decide4, true, "an empty TERM is unset");
    })
  );

  it.effect("defaults to non-interactive when no layer is provided", () =>
    Effect.gen(function* () {
      const CliInteractive5 = yield* CliInteractive;
      assert.strictEqual(CliInteractive5, false);
    })
  );
});

it.layer(CliInteractive.layerTest(true), { timeout: "30 seconds" })("CliInteractive.unless", (it) => {
  const read = CliInteractive;

  it.effect("unless(true) turns an interactive scope off", () =>
    Effect.gen(function* () {
      const value6 = yield* CliInteractive.unless(true)(read);
      assert.strictEqual(value6, false);
    })
  );

  it.effect("unless(false) leaves an interactive scope interactive", () =>
    Effect.gen(function* () {
      const value7 = yield* CliInteractive.unless(false)(read);
      assert.strictEqual(value7, true);
    })
  );

  it.effect("restores the outer value after the scope exits", () =>
    Effect.gen(function* () {
      const inside = yield* CliInteractive.unless(true)(read);
      const after = yield* read;
      assert.strictEqual(inside, false);
      assert.strictEqual(after, true);
    })
  );

  it.effect("narrowing nests: an inner unless(false) cannot undo an outer unless(true)", () =>
    Effect.gen(function* () {
      const pipe8 = yield* read.pipe(CliInteractive.unless(false), CliInteractive.unless(true));
      assert.strictEqual(pipe8, false);
    })
  );

  it.effect("restores the outer value when the scoped effect fails", () =>
    Effect.gen(function* () {
      yield* Effect.fail("boom").pipe(CliInteractive.unless(true), Effect.ignore);
      const read9 = yield* read;
      assert.strictEqual(read9, true);
    })
  );

  it.effect("an interrupted unless scope still restores the outer value", () =>
    Effect.gen(function* () {
      const fiber = yield* Effect.never.pipe(CliInteractive.unless(true), Effect.forkChild);
      yield* Effect.yieldNow;
      yield* Fiber.interrupt(fiber);
      const read10 = yield* read;
      assert.strictEqual(read10, true);
    })
  );
});

it.layer(CliInteractive.layerTest(false), { timeout: "30 seconds" })(
  "CliInteractive.unless in a non-interactive scope",
  (it) => {
    const read = CliInteractive;

    it.effect("unless(false) never turns a non-interactive scope on", () =>
      Effect.gen(function* () {
        const value11 = yield* CliInteractive.unless(false)(read);
        assert.strictEqual(value11, false);
        const value12 = yield* CliInteractive.unless(true)(read);
        assert.strictEqual(value12, false);
      })
    );
  }
);
