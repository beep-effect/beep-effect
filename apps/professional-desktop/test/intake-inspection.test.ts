import { it } from "@beep/test-runner";
import { afterEach, describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { createEffectActor, send, waitFor } from "@xstate/effect";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Scope from "effect/Scope";
import { vi } from "vitest";
import { createMachine } from "xstate";
import { inspectIntakeActor, statelyInspectEnabled } from "@/intake/Intake.inspection";
import type { Inspector } from "@statelyai/sdk";

const { createInspector, calls, relay } = vi.hoisted(() => {
  const recorded: Array<{ readonly method: string; readonly id?: string }> = [];
  const relay = { accept: true };
  return {
    calls: recorded,
    relay,
    createInspector: vi.fn(
      (
        options: unknown
      ): Pick<Inspector, "actor" | "destroy" | "event" | "inspectorUrl" | "ready" | "snapshot" | "stop"> => {
        recorded.push({ method: `create:${JSON.stringify(options)}` });
        const ready = relay.accept ? Promise.resolve() : Promise.reject(new Error("relay refused"));
        // The rejection is observed by the code under test; mark it handled so the runtime does not report it.
        ready.catch(() => undefined);
        return {
          inspectorUrl: "http://inspector.test/session",
          ready,
          actor: (id: string) => recorded.push({ method: "actor", id }),
          event: (id: string) => recorded.push({ method: "event", id }),
          snapshot: (id: string) => recorded.push({ method: "snapshot", id }),
          stop: (id: string) => recorded.push({ method: "stop", id }),
          destroy: () => recorded.push({ method: "destroy" }),
        };
      }
    ),
  };
});

vi.mock("@statelyai/sdk", () => ({ createInspector }));

const toggle = createMachine({
  id: "toggle",
  initial: "off",
  states: { off: { on: { FLIP: { target: "on" } } }, on: {} },
});

afterEach(() => {
  vi.unstubAllEnvs();
  relay.accept = true;
  createInspector.mockClear();
  calls.length = 0;
});

// `import.meta.env` is process-wide, so these cases cannot interleave.
describe("intake actor inspection", { concurrent: false }, () => {
  it.effect(
    "stays off unless the developer opts in",
    Effect.fnUntraced(function* () {
      const actor = yield* createEffectActor(toggle);
      expect(statelyInspectEnabled()).toBe(false);
      assertNone(yield* inspectIntakeActor(actor));
      expect(createInspector).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "streams the actor to the Stately inspector when VITE_STATELY_INSPECT is set",
    Effect.fnUntraced(function* () {
      vi.stubEnv("VITE_STATELY_INSPECT", "1");
      expect(statelyInspectEnabled()).toBe(true);
      // The inspector gets a scope of its own, so closing it proves the connection is released.
      const inspection = yield* Scope.make();
      const actor = yield* createEffectActor(toggle);
      assertSome(yield* inspectIntakeActor(actor).pipe(Scope.provide(inspection)), "http://inspector.test/session");
      yield* send(actor, { type: "FLIP" });
      yield* waitFor(actor, (snapshot) => snapshot.matches("on"));
      const methods = A.map(calls, (call) => call.method);
      expect(methods[0]).toContain("professional-desktop document intake");
      expect(methods).toContain("actor");
      expect(methods).toContain("event");
      expect(methods).toContain("snapshot");
      expect(methods).not.toContain("destroy");
      yield* Scope.close(inspection, Exit.void);
      expect(A.map(calls, (call) => call.method)).toContain("destroy");
    })
  );

  it.effect(
    "reports no session when the relay rejects the registration",
    Effect.fnUntraced(function* () {
      vi.stubEnv("VITE_STATELY_INSPECT", "1");
      relay.accept = false;
      const actor = yield* createEffectActor(toggle);
      assertNone(yield* inspectIntakeActor(actor));
      expect(createInspector).toHaveBeenCalledTimes(1);
      expect(A.map(calls, (call) => call.method)).not.toContain("actor");
    })
  );
});
