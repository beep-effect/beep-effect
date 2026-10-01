import { it } from "@beep/test-runner";
import { toMachineJson, toMachineJsonText } from "@beep/xstate";
import { effectActorSut } from "@beep/xstate/test";
import { describe, expect } from "@effect/vitest";
import { propertyTest, testPaths } from "@xstate/test";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { Reactivity } from "effect/reactivity";
import * as fc from "fast-check";
import { DesktopIntakeClient } from "@/intake/DesktopIntake.client";
import { documentIntakeMachine, documentIntakeStateOf, vaultStatusOf } from "@/intake/DocumentIntake.machine";
import { batchIdFor, DocumentIntakeInput, IntakeResultEntry } from "@/intake/DocumentIntake.models";
import { intakeClient, intakeFile, workspaceId } from "./support/IntakeHarness.ts";
import type { AnyStateMachine } from "xstate";
import type { DocumentIntakeSnapshot } from "@/intake/DocumentIntake.machine";

// `@xstate/test` 2.0.0-alpha.1 constrains its source to `ActorLogic<any, any, any>`,
// which a machine declaring `schemas.emitted` does not satisfy.
const intakeModel: AnyStateMachine = documentIntakeMachine;

const input = DocumentIntakeInput.make({ workspaceId });

const noPayload = fc.constant({});

// In pure mode nothing runs the invoked actors, so the model is driven by the
// events those actors would cause: the configuration feed's internal event and
// the two events a batch actor relays.
const surfaceEvents = {
  CHOOSE_VAULT: noPayload,
  SUBMIT_MANUAL_PATH: fc.record({ rawPath: fc.constantFrom("", "/vault") }),
  CANCEL_MANUAL: noPayload,
  RETRY_CONFIG: noPayload,
  DRAG_ENTER: noPayload,
  DRAG_LEAVE: fc.record({ leftSurface: fc.boolean() }),
  CLEAR_RESULTS: noPayload,
  VAULT_CONFIG_RESOLVED: fc.record({ vaultRootPath: fc.constantFrom(O.none<string>(), O.some("/vault")) }),
  FILE_RESULT: fc.constant({
    entry: IntakeResultEntry.cases.failure.make({ fileName: "report.pdf", message: "Intake failed." }),
  }),
  BATCH_SETTLED: fc.record({
    sequence: fc.constantFrom(1, 2, 3),
    output: fc.constant({ intakeBatchId: batchIdFor([]), entries: [] }),
  }),
  BATCH_REQUESTED: fc.constant({ files: [] }),
};

const fileEvents = {
  DROP: fc.record({ files: fc.constantFrom([], [intakeFile("dropped.txt")]) }),
  FILES_SELECTED: fc.record({ files: fc.constantFrom([], [intakeFile("selected.txt")]) }),
};

const emptyFileEvents = {
  DROP: fc.constant({ files: [] }),
  FILES_SELECTED: fc.constant({ files: [] }),
};

// What must hold in every reachable state, whatever sequence of events led there.
const intakeInvariant = (snapshot: DocumentIntakeSnapshot): void => {
  const status = vaultStatusOf(snapshot);
  const view = documentIntakeStateOf(snapshot);
  const configured = snapshot.matches({ vault: { watching: "configured" } });
  expect(status === "configured").toBe(configured);
  expect(view.isDragging && !configured).toBe(false);
  expect(view.vaultSelection.kind !== "idle" && status !== "needs-onboarding").toBe(false);
  expect(snapshot.matches({ batches: "busy" })).toBe(A.isReadonlyArrayNonEmpty(snapshot.context.liveBatches));
  expect(view.activeBatches).toBe(A.length(snapshot.context.liveBatches));
};

// Path generation is synchronous CPU work, and the conformance run settles on
// a wall-clock timeout, so these cases must not share the event loop.
describe("document intake statechart model", { concurrent: false }, () => {
  it.effect("exports a Stately-compatible definition of both regions", () =>
    Effect.gen(function* () {
      const definition = toMachineJson(documentIntakeMachine);
      expect(definition).toMatchObject({ id: "intake", type: "parallel" });
      const text = yield* toMachineJsonText(documentIntakeMachine);
      for (const state of ["watching", "loadFailed", "picker", "manual", "awaitingConfig", "dragging", "busy"]) {
        expect(text).toContain(`"${state}"`);
      }
    })
  );

  it.live("every shortest path through the surface events keeps the view projection consistent", () =>
    Effect.gen(function* () {
      const { coverage, results } = yield* Effect.promise(() =>
        testPaths(intakeModel, {
          events: { ...surfaceEvents, ...emptyFileEvents },
          input,
          samples: 6,
          // Path generation synthesizes an invoked actor's done event without its
          // output, so traversal stops where the picker would read that output.
          // `results` and the batch sequence grow without bound, so states are
          // merged by their position in the chart.
          serializeState: (snapshot) => JSON.stringify(snapshot.value),
          stopWhen: (snapshot) =>
            (snapshot as DocumentIntakeSnapshot).matches({ vault: { watching: { unconfigured: "picker" } } }),
          invariant: ({ snapshot }) => intakeInvariant(snapshot as DocumentIntakeSnapshot),
        })
      );
      expect(A.every(results, (result) => result.passed)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      const visited = coverage.states.covered.join("\n");
      for (const state of ["loadFailed", "loading", "unconfigured", "sidecar", "configured", "dragging"]) {
        expect(visited).toContain(state);
      }
    })
  );

  it.live("random event sequences never break the view projection", () =>
    Effect.gen(function* () {
      const { coverage } = yield* Effect.promise(() =>
        propertyTest(intakeModel, {
          seed: 11,
          numRuns: 120,
          maxCommands: 16,
          events: { ...surfaceEvents, ...fileEvents },
          input,
          invariant: ({ snapshot }) => intakeInvariant(snapshot as DocumentIntakeSnapshot),
        })
      );
      const visited = coverage.states.covered.join("\n");
      for (const state of ["loading", "unconfigured", "sidecar", "dragging", "busy"]) {
        expect(visited).toContain(state);
      }
    })
  );

  it.live("the Effect-hosted actor agrees with the pure model", () =>
    Effect.promise(() =>
      propertyTest(intakeModel, {
        seed: 5,
        numRuns: 25,
        maxCommands: 10,
        events: { ...surfaceEvents, ...fileEvents },
        input,
        // No RPC ever answers, so the hosted actor only moves when the model does.
        sut: effectActorSut(intakeModel, {
          layer: Layer.merge(
            Layer.succeed(
              DesktopIntakeClient,
              intakeClient({
                GetWorkspaceVault: () => Effect.never,
                IntakeDroppedFile: () => Effect.never,
                PickVaultDirectory: () => Effect.never,
                SetWorkspaceVault: () => Effect.never,
              })
            ),
            Reactivity.layer
          ) as Layer.Layer<never>,
          settleTimeout: "5 seconds",
        }),
      })
    )
  );
});
