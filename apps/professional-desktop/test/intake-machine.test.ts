import { DocumentIntakeActionError } from "@beep/documents-use-cases/public";
import { it } from "@beep/test-runner";
import { WorkspaceVaultActionError } from "@beep/workspace-use-cases/public";
import { afterEach, describe, expect } from "@effect/vitest";
import { send, waitFor } from "@xstate/effect";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import { Reactivity } from "effect/reactivity";
import { TestClock } from "effect/testing";
import { vi } from "vitest";
import { workspaceVaultKey } from "@/intake/DesktopIntake.client";
import { documentIntakeStateOf, vaultSelectionOf, vaultStatusOf } from "@/intake/DocumentIntake.machine";
import { VaultSelectionState } from "@/intake/DocumentIntake.models";
import { VaultDirectoryPickError } from "@/intake/VaultDirectoryPicker.rpc";
import {
  configuredVault,
  intakeClient,
  intakeFile,
  recordOutcomes,
  recordSettledBatches,
  selectedPath,
  startIntake,
  startIntakeIsolated,
  unconfiguredVault,
  workspaceId,
} from "./support/IntakeHarness.ts";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const enableTauri = () => Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });

afterEach(() => {
  invoke.mockReset();
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
});

const unconfigured = () => Effect.succeed(unconfiguredVault);
const configured = () => Effect.succeed(configuredVault);

// The Tauri `invoke` mock and `__TAURI_INTERNALS__` are process globals.
describe("document intake machine", { concurrent: false }, () => {
  it.layer(Reactivity.layer, { timeout: "30 seconds" })((it) => {
    describe("vault configuration", () => {
      it.effect(
        "is pending until the configuration feed resolves",
        Effect.fnUntraced(function* () {
          const actor = yield* startIntake(intakeClient({ GetWorkspaceVault: () => Effect.never }));
          const snapshot = actor.getSnapshot();
          expect(vaultStatusOf(snapshot)).toBe("pending");
          expect(documentIntakeStateOf(snapshot).vaultSelection.kind).toBe("idle");
        })
      );

      it.effect(
        "opens onboarding for a workspace without a vault root",
        Effect.fnUntraced(function* () {
          const actor = yield* startIntake(intakeClient({ GetWorkspaceVault: unconfigured }));
          const snapshot = yield* waitFor(actor, (current) =>
            current.matches({ vault: { watching: { unconfigured: "idle" } } })
          );
          expect(vaultStatusOf(snapshot)).toBe("needs-onboarding");
        })
      );

      it.effect(
        "enables intake for a workspace with a vault root, and follows the feed back to onboarding",
        Effect.fnUntraced(function* () {
          const config = yield* Ref.make(configuredVault);
          const actor = yield* startIntake(intakeClient({ GetWorkspaceVault: () => Ref.get(config) }));
          const ready = yield* waitFor(actor, (current) => current.matches({ vault: { watching: "configured" } }));
          expect(vaultStatusOf(ready)).toBe("configured");

          yield* Ref.set(config, unconfiguredVault);
          yield* Reactivity.invalidate([workspaceVaultKey(workspaceId)]);
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: "unconfigured" } }));
        })
      );

      it.effect(
        "retries at once when the operator asks",
        Effect.fnUntraced(function* () {
          const attempts = yield* Ref.make(0);
          const actor = yield* startIntake(
            intakeClient({
              GetWorkspaceVault: () =>
                Effect.flatMap(
                  Ref.updateAndGet(attempts, (count) => count + 1),
                  (count) =>
                    count < 2
                      ? Effect.fail(WorkspaceVaultActionError.new("Vault store unavailable."))
                      : Effect.succeed(unconfiguredVault)
                ),
            })
          );
          yield* waitFor(actor, (current) => current.matches({ vault: "loadFailed" }));
          yield* send(actor, { type: "RETRY_CONFIG" });
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: "unconfigured" } }));
          expect(yield* Ref.get(attempts)).toBe(2);
        })
      );
    });

    describe("vault selection", () => {
      it.effect(
        "persists a folder picked in the native dialog and waits for the feed to confirm it",
        Effect.fnUntraced(function* () {
          enableTauri();
          invoke.mockResolvedValue(`  ${selectedPath}  `);
          const config = yield* Ref.make(unconfiguredVault);
          const save = yield* Deferred.make<void>();
          const confirm = yield* Deferred.make<void>();
          const saved = yield* Ref.make<ReadonlyArray<unknown>>([]);
          const reads = yield* Ref.make(0);
          const actor = yield* startIntake(
            intakeClient({
              GetWorkspaceVault: () =>
                Effect.flatMap(
                  Ref.updateAndGet(reads, (count) => count + 1),
                  (count) => (count === 1 ? Ref.get(config) : Effect.andThen(Deferred.await(confirm), Ref.get(config)))
                ),
              SetWorkspaceVault: (payload) =>
                Deferred.await(save).pipe(
                  Effect.andThen(Ref.update(saved, A.append(payload))),
                  Effect.andThen(Ref.set(config, configuredVault)),
                  Effect.as(configuredVault)
                ),
            })
          );
          const outcomes = yield* recordOutcomes(actor);
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: { unconfigured: "idle" } } }));

          yield* send(actor, { type: "CHOOSE_VAULT" });
          const saving = yield* waitFor(actor, (current) =>
            current.matches({ vault: { watching: { unconfigured: { picker: "saving" } } } })
          );
          expect(vaultSelectionOf(saving).kind).toBe("saving");

          yield* Deferred.succeed(save, void 0);
          const awaiting = yield* waitFor(actor, (current) =>
            current.matches({ vault: { watching: { unconfigured: "awaitingConfig" } } })
          );
          // Persisted, but the card keeps saving until the feed confirms the root.
          expect(vaultSelectionOf(awaiting).kind).toBe("saving");
          expect(vaultStatusOf(awaiting)).toBe("needs-onboarding");

          yield* Deferred.succeed(confirm, void 0);
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: "configured" } }));
          expect(yield* Ref.get(saved)).toMatchObject([{ vaultRootPath: selectedPath, workspaceId }]);
          expect(yield* Queue.takeN(outcomes, 2)).toEqual(["selected", "success"]);
        })
      );

      it.effect(
        "returns to the idle card when the operator cancels the native dialog",
        Effect.fnUntraced(function* () {
          enableTauri();
          invoke.mockResolvedValue(null);
          const actor = yield* startIntake(intakeClient({ GetWorkspaceVault: unconfigured }));
          const outcomes = yield* recordOutcomes(actor);
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: { unconfigured: "idle" } } }));

          yield* send(actor, { type: "CHOOSE_VAULT" });
          const snapshot = yield* waitFor(actor, (current) =>
            current.matches({ vault: { watching: { unconfigured: "idle" } } })
          );
          expect(vaultSelectionOf(snapshot).kind).toBe("idle");
          expect(yield* Queue.takeN(outcomes, 1)).toEqual(["cancelled"]);
        })
      );

      it.effect(
        "ignores a repeated picker request while the dialog is open",
        Effect.fnUntraced(function* () {
          enableTauri();
          const picker = Promise.withResolvers<string | null>();
          invoke.mockReturnValue(picker.promise);
          const actor = yield* startIntake(intakeClient({ GetWorkspaceVault: unconfigured }));
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: { unconfigured: "idle" } } }));

          yield* send(actor, { type: "CHOOSE_VAULT" });
          const choosing = yield* waitFor(actor, (current) =>
            current.matches({ vault: { watching: { unconfigured: { picker: "native" } } } })
          );
          expect(vaultSelectionOf(choosing).kind).toBe("choosing");
          yield* send(actor, { type: "CHOOSE_VAULT" });

          picker.resolve(null);
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: { unconfigured: "idle" } } }));
          expect(invoke).toHaveBeenCalledTimes(1);
        })
      );

      it.effect(
        "surfaces a client-safe picker failure and lets the operator try again",
        Effect.fnUntraced(function* () {
          enableTauri();
          invoke.mockRejectedValueOnce(new Error("private picker failure /home/operator"));
          invoke.mockResolvedValue(null);
          const actor = yield* startIntake(intakeClient({ GetWorkspaceVault: unconfigured }));
          const outcomes = yield* recordOutcomes(actor);
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: { unconfigured: "idle" } } }));

          yield* send(actor, { type: "CHOOSE_VAULT" });
          const failed = yield* waitFor(actor, (current) =>
            current.matches({ vault: { watching: { unconfigured: "failed" } } })
          );
          const selection = vaultSelectionOf(failed);
          expect(selection).toStrictEqual(
            VaultSelectionState.cases.failed.make({ message: "The folder picker could not be opened." })
          );

          yield* send(actor, { type: "CHOOSE_VAULT" });
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: { unconfigured: "idle" } } }));
          expect(yield* Queue.takeN(outcomes, 2)).toEqual(["picker_failure", "cancelled"]);
        })
      );

      it.effect(
        "stores the public workspace-vault failure message when a picked folder cannot be saved",
        Effect.fnUntraced(function* () {
          enableTauri();
          invoke.mockResolvedValue(selectedPath);
          const actor = yield* startIntake(
            intakeClient({
              GetWorkspaceVault: unconfigured,
              SetWorkspaceVault: () =>
                Effect.fail(WorkspaceVaultActionError.new("The selected vault is not writable.")),
            })
          );
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: { unconfigured: "idle" } } }));

          yield* send(actor, { type: "CHOOSE_VAULT" });
          const failed = yield* waitFor(actor, (current) =>
            current.matches({ vault: { watching: { unconfigured: "failed" } } })
          );
          expect(vaultSelectionOf(failed)).toStrictEqual(
            VaultSelectionState.cases.failed.make({ message: "The selected vault is not writable." })
          );
        })
      );

      it.effect(
        "persists a folder picked in the sidecar dialog",
        Effect.fnUntraced(function* () {
          const config = yield* Ref.make(unconfiguredVault);
          const actor = yield* startIntake(
            intakeClient({
              GetWorkspaceVault: () => Ref.get(config),
              PickVaultDirectory: () => Effect.succeedSome(selectedPath),
              SetWorkspaceVault: () => Effect.as(Ref.set(config, configuredVault), configuredVault),
            })
          );
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: { unconfigured: "idle" } } }));
          yield* send(actor, { type: "CHOOSE_VAULT" });
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: "configured" } }));
        })
      );

      it.effect(
        "treats a blank sidecar selection as a cancellation",
        Effect.fnUntraced(function* () {
          const actor = yield* startIntake(
            intakeClient({
              GetWorkspaceVault: unconfigured,
              PickVaultDirectory: () => Effect.succeedSome("   "),
            })
          );
          const outcomes = yield* recordOutcomes(actor);
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: { unconfigured: "idle" } } }));
          yield* send(actor, { type: "CHOOSE_VAULT" });
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: { unconfigured: "idle" } } }));
          expect(yield* Queue.takeN(outcomes, 1)).toEqual(["cancelled"]);
        })
      );

      it.effect(
        "opens the manual path form when the sidecar picker fails",
        Effect.fnUntraced(function* () {
          const prompt = vi.spyOn(window, "prompt");
          const actor = yield* startIntake(
            intakeClient({
              GetWorkspaceVault: unconfigured,
              PickVaultDirectory: () => Effect.fail(VaultDirectoryPickError.new("Native picker unavailable.")),
            })
          );
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: { unconfigured: "idle" } } }));
          yield* send(actor, { type: "CHOOSE_VAULT" });
          const manual = yield* waitFor(actor, (current) =>
            current.matches({ vault: { watching: { unconfigured: { manual: "editing" } } } })
          );
          expect(prompt).not.toHaveBeenCalled();
          expect(vaultSelectionOf(manual)).toStrictEqual(VaultSelectionState.cases.manual.make());
          prompt.mockRestore();
        })
      );
    });

    describe("manual vault path", () => {
      const openManualForm = Effect.fnUntraced(function* (handlers: Parameters<typeof intakeClient>[0]) {
        const actor = yield* startIntake(
          intakeClient({
            GetWorkspaceVault: unconfigured,
            PickVaultDirectory: () => Effect.fail(VaultDirectoryPickError.new("Native picker unavailable.")),
            ...handlers,
          })
        );
        yield* waitFor(actor, (current) => current.matches({ vault: { watching: { unconfigured: "idle" } } }));
        yield* send(actor, { type: "CHOOSE_VAULT" });
        yield* waitFor(actor, (current) =>
          current.matches({ vault: { watching: { unconfigured: { manual: "editing" } } } })
        );
        return actor;
      });

      it.effect(
        "persists a trimmed manual path and enables intake",
        Effect.fnUntraced(function* () {
          const config = yield* Ref.make(unconfiguredVault);
          const saved = yield* Ref.make<ReadonlyArray<unknown>>([]);
          const actor = yield* openManualForm({
            GetWorkspaceVault: () => Ref.get(config),
            SetWorkspaceVault: (payload) =>
              Ref.update(saved, A.append(payload)).pipe(
                Effect.andThen(Ref.set(config, configuredVault)),
                Effect.as(configuredVault)
              ),
          });
          yield* send(actor, { type: "SUBMIT_MANUAL_PATH", rawPath: `  ${selectedPath}  ` });
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: "configured" } }));
          expect(yield* Ref.get(saved)).toMatchObject([{ vaultRootPath: selectedPath }]);
        })
      );

      it.effect(
        "keeps the form open with guidance when the submitted path is empty",
        Effect.fnUntraced(function* () {
          const actor = yield* openManualForm({});
          yield* send(actor, { type: "SUBMIT_MANUAL_PATH", rawPath: "   " });
          const guided = yield* waitFor(actor, (current) => O.isSome(current.context.manualMessage));
          expect(vaultSelectionOf(guided)).toStrictEqual(
            VaultSelectionState.cases.manual.make({ message: O.some("Enter the absolute path of a local folder.") })
          );
        })
      );

      it.effect(
        "keeps the form open with the rejected path and the persistence failure message",
        Effect.fnUntraced(function* () {
          const actor = yield* openManualForm({
            SetWorkspaceVault: () => Effect.fail(WorkspaceVaultActionError.new("The selected vault is not writable.")),
          });
          yield* send(actor, { type: "SUBMIT_MANUAL_PATH", rawPath: selectedPath });
          const rejected = yield* waitFor(
            actor,
            (current) =>
              current.matches({ vault: { watching: { unconfigured: { manual: "editing" } } } }) &&
              O.isSome(current.context.manualMessage)
          );
          expect(vaultSelectionOf(rejected)).toStrictEqual(
            VaultSelectionState.cases.manual.make({
              draftPath: O.some(selectedPath),
              message: O.some("The selected vault is not writable."),
            })
          );
        })
      );

      it.effect(
        "shows the saving view while a manual path is being persisted",
        Effect.fnUntraced(function* () {
          const actor = yield* openManualForm({ SetWorkspaceVault: () => Effect.never });
          yield* send(actor, { type: "SUBMIT_MANUAL_PATH", rawPath: selectedPath });
          const saving = yield* waitFor(actor, (current) =>
            current.matches({ vault: { watching: { unconfigured: { manual: "saving" } } } })
          );
          expect(vaultSelectionOf(saving).kind).toBe("saving");
        })
      );

      it.effect(
        "returns to the idle card when the form is cancelled",
        Effect.fnUntraced(function* () {
          const actor = yield* openManualForm({});
          yield* send(actor, { type: "CANCEL_MANUAL" });
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: { unconfigured: "idle" } } }));
        })
      );

      it.effect(
        "ignores a manual submission when the form is not open",
        Effect.fnUntraced(function* () {
          const picker = yield* Deferred.make<O.Option<string>>();
          const actor = yield* startIntake(
            intakeClient({ GetWorkspaceVault: unconfigured, PickVaultDirectory: () => Deferred.await(picker) })
          );
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: { unconfigured: "idle" } } }));
          yield* send(actor, { type: "SUBMIT_MANUAL_PATH", rawPath: selectedPath });
          // The next event is processed after the ignored one, so reaching the
          // picker proves the submission was dropped without saving.
          yield* send(actor, { type: "CHOOSE_VAULT" });
          yield* waitFor(actor, (current) =>
            current.matches({ vault: { watching: { unconfigured: { picker: "sidecar" } } } })
          );
        })
      );
    });

    describe("document intake", () => {
      it.effect(
        "tracks the drag highlight only while the pointer is over the surface",
        Effect.fnUntraced(function* () {
          const actor = yield* startIntake(intakeClient({ GetWorkspaceVault: configured }));
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: { configured: "idle" } } }));

          yield* send(actor, { type: "DRAG_ENTER" });
          const dragging = yield* waitFor(actor, (current) =>
            current.matches({ vault: { watching: { configured: "dragging" } } })
          );
          expect(documentIntakeStateOf(dragging).isDragging).toBe(true);

          // Leaving towards a child of the surface keeps the highlight.
          yield* send(actor, { type: "DRAG_LEAVE", leftSurface: false });
          yield* send(actor, { type: "DRAG_LEAVE", leftSurface: true });
          const idle = yield* waitFor(actor, (current) =>
            current.matches({ vault: { watching: { configured: "idle" } } })
          );
          expect(documentIntakeStateOf(idle).isDragging).toBe(false);
        })
      );

      it.effect(
        "keeps overlapping batches alive, records every file, and returns to idle",
        Effect.fnUntraced(function* () {
          const release = yield* Deferred.make<void>();
          const intake = vi.fn(() =>
            Effect.andThen(
              Deferred.await(release),
              Effect.fail(DocumentIntakeActionError.new("Document intake unavailable."))
            )
          );
          const actor = yield* startIntake(intakeClient({ GetWorkspaceVault: configured, IntakeDroppedFile: intake }));
          const settled = yield* recordSettledBatches(actor);
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: { configured: "idle" } } }));

          yield* send(actor, { type: "DRAG_ENTER" });
          yield* send(actor, { type: "DROP", files: [intakeFile("first.txt")] });
          yield* send(actor, { type: "FILES_SELECTED", files: [intakeFile("second.txt")] });
          const busy = yield* waitFor(actor, (current) => A.length(current.context.liveBatches) === 2);
          expect(busy.matches({ batches: "busy" })).toBe(true);
          expect(busy.matches({ vault: { watching: { configured: "idle" } } })).toBe(true);
          expect(documentIntakeStateOf(busy).activeBatches).toBe(2);

          yield* Deferred.succeed(release, void 0);
          const done = yield* waitFor(
            actor,
            (current) => current.matches({ batches: "idle" }) && A.length(current.context.results) === 2
          );
          expect(intake).toHaveBeenCalledTimes(2);
          expect(A.every(done.context.results, (result) => result.kind === "failure")).toBe(true);
          expect(yield* Queue.takeN(settled, 2)).toEqual([1, 1]);

          yield* send(actor, { type: "CLEAR_RESULTS" });
          yield* waitFor(actor, (current) => A.isReadonlyArrayEmpty(current.context.results));
        })
      );

      it.effect(
        "files a drop that arrives without a preceding drag",
        Effect.fnUntraced(function* () {
          const actor = yield* startIntake(intakeClient({ GetWorkspaceVault: configured }));
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: { configured: "idle" } } }));
          yield* send(actor, { type: "DROP", files: [new File([], "empty.txt")] });
          const done = yield* waitFor(
            actor,
            (current) => current.matches({ batches: "idle" }) && A.length(current.context.results) === 1
          );
          expect(done.context.results[0]?.kind).toBe("failure");
        })
      );

      it.effect(
        "ignores an empty selection",
        Effect.fnUntraced(function* () {
          const actor = yield* startIntake(intakeClient({ GetWorkspaceVault: configured }));
          yield* waitFor(actor, (current) => current.matches({ vault: { watching: { configured: "idle" } } }));
          yield* send(actor, { type: "FILES_SELECTED", files: [] });
          yield* send(actor, { type: "DRAG_ENTER" });
          const dragging = yield* waitFor(actor, (current) =>
            current.matches({ vault: { watching: { configured: "dragging" } } })
          );
          expect(dragging.matches({ batches: "idle" })).toBe(true);
          expect(dragging.context.batchSequence).toBe(0);
        })
      );
    });
  });
});

// A retry test advances its own TestClock, so these run outside the shared layer
// block with a Reactivity service of their own.
describe("document intake configuration retry", () => {
  it.effect(
    "retries a failed configuration read on a doubling backoff",
    Effect.fnUntraced(function* () {
      const attempts = yield* Ref.make(0);
      const actor = yield* startIntakeIsolated(2000)(
        intakeClient({
          GetWorkspaceVault: () =>
            Effect.flatMap(
              Ref.updateAndGet(attempts, (count) => count + 1),
              (count) =>
                count < 3
                  ? Effect.fail(WorkspaceVaultActionError.new("Vault store unavailable."))
                  : Effect.succeed(configuredVault)
            ),
        })
      );
      const failed = yield* waitFor(actor, (current) => current.matches({ vault: "loadFailed" }));
      expect(vaultStatusOf(failed)).toBe("unavailable");
      expect(failed.context.configAttempt).toBe(0);

      // First retry after the base delay.
      yield* TestClock.adjust("2 seconds");
      yield* waitFor(
        actor,
        (current) => current.matches({ vault: "loadFailed" }) && current.context.configAttempt === 1
      );
      expect(yield* Ref.get(attempts)).toBe(2);

      // The second delay doubled: two more seconds are not enough.
      yield* TestClock.adjust("2 seconds");
      expect(yield* Ref.get(attempts)).toBe(2);
      expect(actor.getSnapshot().matches({ vault: "loadFailed" })).toBe(true);

      yield* TestClock.adjust("2 seconds");
      const recovered = yield* waitFor(actor, (current) => current.matches({ vault: { watching: "configured" } }));
      expect(yield* Ref.get(attempts)).toBe(3);
      expect(recovered.context.configAttempt).toBe(0);
    })
  );

  it.effect(
    "caps the retry delay at thirty seconds",
    Effect.fnUntraced(function* () {
      const attempts = yield* Ref.make(0);
      const actor = yield* startIntakeIsolated(20_000)(
        intakeClient({
          GetWorkspaceVault: () =>
            Effect.flatMap(
              Ref.updateAndGet(attempts, (count) => count + 1),
              (count) =>
                count < 3
                  ? Effect.fail(WorkspaceVaultActionError.new("Vault store unavailable."))
                  : Effect.succeed(configuredVault)
            ),
        })
      );
      yield* waitFor(actor, (current) => current.matches({ vault: "loadFailed" }));
      yield* TestClock.adjust("20 seconds");
      yield* waitFor(
        actor,
        (current) => current.matches({ vault: "loadFailed" }) && current.context.configAttempt === 1
      );
      // Doubling would wait forty seconds; the cap is thirty.
      yield* TestClock.adjust("30 seconds");
      yield* waitFor(actor, (current) => current.matches({ vault: { watching: "configured" } }));
    })
  );
});
