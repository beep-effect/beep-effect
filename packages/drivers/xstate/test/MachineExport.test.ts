import { it } from "@beep/test-runner";
import { MachineJsonText, toMachineJson, toMachineJsonText } from "@beep/xstate";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { releaseMachine } from "./fixtures/Release.machine.ts";

describe("MachineExport", () => {
  it("serializes a setupEffect machine to xstate's data form", () => {
    const json = toMachineJson(releaseMachine);
    expect(json.id).toBe("release");
    expect(json.initial).toBe("awaitingApproval");
    expect(Object.keys(json.states ?? {})).toEqual([
      "awaitingApproval",
      "deploying",
      "failed",
      "deployed",
      "expired",
      "cancelled",
    ]);
  });

  it.effect("encodes pretty JSON text that decodes back to the same definition", () =>
    Effect.gen(function* () {
      const text = yield* toMachineJsonText(releaseMachine);
      expect(text).toContain('"initial": "awaitingApproval"');
      expect(text).toContain('"src": "deploy"');
      const decoded = yield* S.decodeEffect(MachineJsonText)(text);
      expect(decoded).toEqual(toMachineJson(releaseMachine));
    })
  );
});
