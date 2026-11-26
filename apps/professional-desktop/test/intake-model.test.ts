import { it } from "@beep/test-runner";
import { toMachineJson, toMachineJsonText } from "@beep/xstate";
import { effectActorSut } from "@beep/xstate/test";
import { describe, expect } from "@effect/vitest";
import { propertyTest, testPaths } from "@xstate/test";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as fc from "fast-check";
import { DesktopIntakeClient } from "@/intake/DesktopIntake.client";
import { documentIntakeMachine, documentIntakeStateOf, vaultStatusOf } from "@/intake/DocumentIntake.machine";
import { batchIdFor, DocumentIntakeInput, IntakeResultEntry } from "@/intake/DocumentIntake.models";
import { intakeClient, intakeFile, workspaceId } from "./support/IntakeHarness.ts";
import type { AnyStateMachine } from "xstate";
import type { DocumentIntakeSnapshot } from "@/intake/DocumentIntake.machine";

const UnknownJson = S.fromJsonString(S.Unknown);

const xstateTestCompatibleModel: AnyStateMachine = documentIntakeMachine;

const input = DocumentIntakeInput.make({ workspaceId });

const noPayload = fc.constant({});

const publicSurfaceEvents = {
  CHOOSE_VAULT: noPayload,
  SUBMIT_MANUAL_PATH: fc.record({ rawPath: fc.constantFrom("", "/vault") }),
  CANCEL_MANUAL: noPayload,
  RETRY_CONFIG: noPayload,
  DRAG_ENTER: noPayload,
  DRAG_LEAVE: fc.record({ leftSurface: fc.boolean() }),
  CLEAR_RESULTS: noPayload,
  FILE_RESULT: fc.constant({
    entry: IntakeResultEntry.cases.failure.make({ fileName: "report.pdf", message: "Intake failed." }),
  }),
  BATCH_SETTLED: fc.record({
    sequence: fc.constantFrom(1, 2, 3),
    output: fc.constant({ intakeBatchId: batchIdFor([], 1), entries: [] }),
  }),
};

const pureModelOnlyInternalEvents = {
  VAULT_CONFIG_RESOLVED: fc.record({ vaultRootPath: fc.constantFrom(O.none<string>(), O.some("/vault")) }),
  BATCH_REQUESTED: fc.constant({ files: [] }),
};

const surfaceEvents = { ...publicSurfaceEvents, ...pureModelOnlyInternalEvents };

const fileEvents = {
  DROP: fc.record({ files: fc.constantFrom([], [intakeFile("dropped.txt")]) }),
  FILES_SELECTED: fc.record({ files: fc.constantFrom([], [intakeFile("selected.txt")]) }),
};

const emptyFileEvents = {
  DROP: fc.constant({ files: [] }),
  FILES_SELECTED: fc.constant({ files: [] }),
};

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

const mergeStatesByChartPosition = (snapshot: { readonly value: unknown }) =>
  Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(snapshot.value), identity);

const stopWherePickerReadsDoneOutput = (snapshot: unknown) =>
  (snapshot as DocumentIntakeSnapshot).matches({ vault: { watching: { unconfigured: "picker" } } });

const neverAnsweringIntakeClient = Layer.merge(
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
) as Layer.Layer<never>;

describe("document intake statechart model, serial: CPU-bound path generation under a wall-clock settle", {
  concurrent: false,
}, () => {
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

  it.effect("every shortest path through the surface events keeps the view projection consistent", () =>
    Effect.gen(function* () {
      const { coverage, results } = yield* Effect.promise(() =>
        testPaths(xstateTestCompatibleModel, {
          events: { ...surfaceEvents, ...emptyFileEvents },
          input,
          samples: 6,
          serializeState: mergeStatesByChartPosition,
          stopWhen: stopWherePickerReadsDoneOutput,
          invariant: ({ snapshot }) => intakeInvariant(snapshot as DocumentIntakeSnapshot),
        })
      );
      expect(A.every(results, (result) => result.passed)).toBe(true);
      expect(
        results.length,
        "paths stop at the picker, since synthesized done events carry no output, and merge by chart position, since results grow unbounded"
      ).toBeGreaterThan(0);
      const visited = A.join(coverage.states.covered, "\n");
      for (const state of ["loadFailed", "loading", "unconfigured", "sidecar", "configured", "dragging"]) {
        expect(visited).toContain(state);
      }
    })
  );

  it.effect("random event sequences never break the view projection", () =>
    Effect.gen(function* () {
      const { coverage } = yield* Effect.promise(() =>
        propertyTest(xstateTestCompatibleModel, {
          seed: 11,
          numRuns: 120,
          maxCommands: 16,
          events: { ...surfaceEvents, ...fileEvents },
          input,
          invariant: ({ snapshot }) => intakeInvariant(snapshot as DocumentIntakeSnapshot),
        })
      );
      const visited = A.join(coverage.states.covered, "\n");
      for (const state of ["loading", "unconfigured", "sidecar", "dragging", "busy"]) {
        expect(visited).toContain(state);
      }
    })
  );

  it.effect("the Effect-hosted actor agrees with the pure model", () =>
    Effect.promise(() =>
      propertyTest(xstateTestCompatibleModel, {
        seed: 5,
        numRuns: 25,
        maxCommands: 10,
        events: { ...publicSurfaceEvents, ...fileEvents },
        input,
        sut: effectActorSut(xstateTestCompatibleModel, {
          layer: neverAnsweringIntakeClient,
          settleTimeout: "5 seconds",
        }),
      })
    )
  );
});
