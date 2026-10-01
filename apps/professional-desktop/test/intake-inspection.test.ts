import { it } from "@beep/test-runner";
import { afterEach, describe, expect } from "@effect/vitest";
import { createEffectActor, send, waitFor } from "@xstate/effect";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { vi } from "vitest";
import { createMachine } from "xstate";
import { inspectIntakeActor, statelyInspectEnabled } from "@/intake/Intake.inspection";

const { createInspector, calls } = vi.hoisted(() => {
  const recorded: Array<{ readonly method: string; readonly id?: string }> = [];
  return {
    calls: recorded,
    createInspector: vi.fn((options: unknown) => {
      recorded.push({ method: `create:${JSON.stringify(options)}` });
      return {
        inspectorUrl: "http://inspector.test/session",
        ready: Promise.resolve(),
        actor: (id: string) => recorded.push({ method: "actor", id }),
        event: (id: string) => recorded.push({ method: "event", id }),
        snapshot: (id: string) => recorded.push({ method: "snapshot", id }),
        stop: (id: string) => recorded.push({ method: "stop", id }),
        destroy: () => recorded.push({ method: "destroy" }),
      };
    }),
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
      expect(yield* inspectIntakeActor(actor)).toEqual(O.none());
      expect(createInspector).not.toHaveBeenCalled();
    }, Effect.scoped)
  );

  it.effect("streams the actor to the Stately inspector when VITE_STATELY_INSPECT is set", () =>
    Effect.gen(function* () {
      vi.stubEnv("VITE_STATELY_INSPECT", "1");
      expect(statelyInspectEnabled()).toBe(true);
      yield* Effect.gen(function* () {
        const actor = yield* createEffectActor(toggle);
        expect(yield* inspectIntakeActor(actor)).toEqual(O.some("http://inspector.test/session"));
        yield* send(actor, { type: "FLIP" });
        yield* waitFor(actor, (snapshot) => snapshot.matches("on"));
        const methods = A.map(calls, (call) => call.method);
        expect(methods[0]).toContain("professional-desktop document intake");
        expect(methods).toContain("actor");
        expect(methods).toContain("event");
        expect(methods).toContain("snapshot");
      }).pipe(Effect.scoped);
      // Closing the scope releases the inspector connection.
      expect(A.map(calls, (call) => call.method)).toContain("destroy");
    })
  );
});
