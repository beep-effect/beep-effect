import { it } from "@beep/test-runner";
import { WorkspaceVaultActionError } from "@beep/workspace-use-cases/public";
import { afterEach, describe, expect, vi } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import { Atom, AtomRegistry, Reactivity } from "effect/reactivity";
import * as Stream from "effect/Stream";
import { DesktopIntakeClient } from "@/intake/DesktopIntake.client";
import { VaultSelectionState } from "@/intake/DocumentIntake.models";
import {
  documentIntakeSurfaceAtoms,
  intakeFileInputAtoms,
  openIntakeFilePickerAtoms,
  setIntakeFileInputAtoms,
} from "@/intake/Intake.atoms";
import { VaultDirectoryPickError } from "@/intake/VaultDirectoryPicker.rpc";
import {
  configuredVault,
  intakeClient,
  selectedPath,
  unconfiguredVault,
  workspaceId,
} from "./support/IntakeHarness.ts";
import type { DocumentIntakeSurface } from "@/intake/Intake.atoms";
import type { IntakeHandlers } from "./support/IntakeHarness.ts";

const surfaceAtom = documentIntakeSurfaceAtoms(workspaceId);

// A registry whose intake runtime talks to the fake RPC client, with the
// surface mounted the way `DocumentIntakeTarget` mounts it.
const mountSurface = Effect.fnUntraced(function* (handlers: IntakeHandlers) {
  const registry = yield* Effect.acquireRelease(
    Effect.sync(() =>
      AtomRegistry.make({
        initialValues: [
          [
            DesktopIntakeClient.runtime.layer,
            Layer.mergeAll(Layer.succeed(DesktopIntakeClient, intakeClient(handlers)), Reactivity.layer),
          ],
        ],
      })
    ),
    (created) => Effect.sync(() => created.dispose())
  );
  registry.mount(surfaceAtom);
  const surface = (): DocumentIntakeSurface => registry.get(surfaceAtom);
  const waitFor = (predicate: (current: DocumentIntakeSurface) => boolean) =>
    AtomRegistry.toStream(registry, surfaceAtom).pipe(
      Stream.filter(predicate),
      Stream.take(1),
      Stream.runHead,
      Effect.flatMap(Effect.fromOption),
      Effect.timeoutOrElse({
        duration: Duration.seconds(3),
        orElse: () => Effect.fail("the intake surface has not reached the expected view"),
      })
    );
  return { registry, surface, waitFor };
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Spies are restored after each case, so cases must not interleave.
describe("document intake surface", { concurrent: false }, () => {
  it.effect(
    "starts pending, opens onboarding, and enables intake once a picked vault is saved",
    Effect.fnUntraced(function* () {
      const config = yield* Ref.make(unconfiguredVault);
      const saved = yield* Ref.make<ReadonlyArray<unknown>>([]);
      const { surface, waitFor } = yield* mountSurface({
        GetWorkspaceVault: () => Ref.get(config),
        PickVaultDirectory: () => Effect.succeedSome(selectedPath),
        SetWorkspaceVault: (payload) =>
          Ref.update(saved, A.append(payload)).pipe(
            Effect.andThen(Ref.set(config, configuredVault)),
            Effect.as(configuredVault)
          ),
      });
      expect(surface().vaultStatus).toBe("pending");
      expect(surface().state.vaultSelection.kind).toBe("idle");

      const onboarding = yield* waitFor((current) => current.vaultStatus === "needs-onboarding");
      onboarding.actions.chooseVault();
      const ready = yield* waitFor((current) => current.vaultStatus === "configured");

      expect(ready.state.vaultSelection.kind).toBe("idle");
      expect(yield* Ref.get(saved)).toMatchObject([{ vaultRootPath: selectedPath, workspaceId }]);
      // The file-input ref callback and every handler stay referentially stable.
      expect(ready.actions).toBe(onboarding.actions);
    })
  );

  it.effect(
    "reports an unreadable vault configuration and recovers when the operator retries",
    Effect.fnUntraced(function* () {
      const attempts = yield* Ref.make(0);
      const { waitFor } = yield* mountSurface({
        GetWorkspaceVault: () =>
          Effect.flatMap(
            Ref.updateAndGet(attempts, (count) => count + 1),
            (count) =>
              count === 1
                ? Effect.fail(WorkspaceVaultActionError.new("Vault store unavailable."))
                : Effect.succeed(configuredVault)
          ),
      });
      const unavailable = yield* waitFor((current) => current.vaultStatus === "unavailable");
      unavailable.actions.retryVaultConfig();
      yield* waitFor((current) => current.vaultStatus === "configured");
      expect(yield* Ref.get(attempts)).toBe(2);
    })
  );

  it.effect(
    "walks the manual path form through guidance, cancellation, and a saved path",
    Effect.fnUntraced(function* () {
      const config = yield* Ref.make(unconfiguredVault);
      const { waitFor } = yield* mountSurface({
        GetWorkspaceVault: () => Ref.get(config),
        PickVaultDirectory: () => Effect.fail(VaultDirectoryPickError.new("Native picker unavailable.")),
        SetWorkspaceVault: () => Effect.as(Ref.set(config, configuredVault), configuredVault),
      });
      const onboarding = yield* waitFor((current) => current.vaultStatus === "needs-onboarding");
      const { actions } = onboarding;

      actions.chooseVault();
      yield* waitFor((current) => current.state.vaultSelection.kind === "manual");
      actions.submitManualVaultPath("   ");
      const guided = yield* waitFor(
        (current) => current.state.vaultSelection.kind === "manual" && O.isSome(current.state.vaultSelection.message)
      );
      expect(guided.state.vaultSelection).toStrictEqual(
        VaultSelectionState.cases.manual.make({ message: O.some("Enter the absolute path of a local folder.") })
      );

      actions.cancelManualVaultPath();
      yield* waitFor((current) => current.state.vaultSelection.kind === "idle");

      actions.chooseVault();
      yield* waitFor((current) => current.state.vaultSelection.kind === "manual");
      actions.submitManualVaultPath(selectedPath);
      yield* waitFor((current) => current.vaultStatus === "configured");
    })
  );

  it.effect(
    "owns the drag highlight and boundary narrowing",
    Effect.fnUntraced(function* () {
      const { waitFor } = yield* mountSurface({ GetWorkspaceVault: () => Effect.succeed(configuredVault) });
      const { actions } = yield* waitFor((current) => current.vaultStatus === "configured");
      const preventDefault = vi.fn();
      const container = document.createElement("div");
      const child = container.appendChild(document.createElement("span"));

      actions.dragEnter({ preventDefault });
      actions.dragOver({ preventDefault });
      yield* waitFor((current) => current.state.isDragging);
      expect(preventDefault).toHaveBeenCalledTimes(2);

      // Moving onto a child of the surface must not drop the highlight; the
      // result marker proves that leave event was processed before the assert.
      actions.dragLeave({ currentTarget: container, relatedTarget: child });
      actions.fileSelection([new File([], "marker.txt")]);
      const stillDragging = yield* waitFor((current) => A.length(current.state.results) === 1);
      expect(stillDragging.state.isDragging).toBe(true);

      actions.dragLeave({ currentTarget: container, relatedTarget: null });
      yield* waitFor((current) => !current.state.isDragging);
    })
  );

  it.effect(
    "prevents a configured drop, files the batch, and clears the results on request",
    Effect.fnUntraced(function* () {
      const { waitFor } = yield* mountSurface({ GetWorkspaceVault: () => Effect.succeed(configuredVault) });
      const { actions } = yield* waitFor((current) => current.vaultStatus === "configured");
      const preventDefault = vi.fn();

      actions.dragEnter({ preventDefault });
      actions.drop({ files: [new File([], "empty.txt")], preventDefault });
      const filed = yield* waitFor(
        (current) => A.length(current.state.results) === 1 && current.state.activeBatches === 0
      );
      expect(preventDefault).toHaveBeenCalledTimes(2);
      expect(filed.state.isDragging).toBe(false);
      expect(filed.state.results[0]?.kind).toBe("failure");

      actions.clearResults();
      yield* waitFor((current) => A.isReadonlyArrayEmpty(current.state.results));
    })
  );

  it.effect(
    "leaves drags and drops to the browser until a vault is configured",
    Effect.fnUntraced(function* () {
      const { waitFor } = yield* mountSurface({
        GetWorkspaceVault: () => Effect.succeed(unconfiguredVault),
        PickVaultDirectory: () => Effect.never,
      });
      const { actions } = yield* waitFor((current) => current.vaultStatus === "needs-onboarding");
      const preventDefault = vi.fn();

      actions.dragEnter({ preventDefault });
      actions.dragOver({ preventDefault });
      actions.drop({ files: [new File([], "empty.txt")], preventDefault });
      // A later event the machine does handle orders this assert after the three above.
      actions.chooseVault();
      const choosing = yield* waitFor((current) => current.state.vaultSelection.kind === "choosing");

      expect(preventDefault).not.toHaveBeenCalled();
      expect(choosing.state.isDragging).toBe(false);
      expect(choosing.state.results).toEqual([]);
    })
  );
});

describe("intake file input", { concurrent: false }, () => {
  // The registry's idle timers are real, so this case waits in live time.
  it.live(
    "keeps the hidden file input available after the registry idle TTL",
    Effect.fnUntraced(function* () {
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => AtomRegistry.make({ defaultIdleTTL: 10, timeoutResolution: 1 })),
        (created) => Effect.sync(() => created.dispose())
      );
      const idleWitness = Atom.make(0);
      registry.set(idleWitness, 1);
      expect(registry.get(idleWitness)).toBe(1);
      const input = document.createElement("input");
      input.type = "file";
      const click = vi.spyOn(input, "click").mockImplementation(() => undefined);
      const setInput = setIntakeFileInputAtoms(workspaceId);
      const openPicker = openIntakeFilePickerAtoms(workspaceId);

      const releaseSetInput = registry.mount(setInput);
      registry.set(setInput, input);
      yield* AtomRegistry.getResult(registry, setInput);
      releaseSetInput();

      yield* Effect.sleep(Duration.millis(50));
      expect(registry.get(idleWitness)).toBe(0);
      assertSome(registry.get(intakeFileInputAtoms(workspaceId)), input);

      const releaseOpenPicker = registry.mount(openPicker);
      registry.set(openPicker, void 0);
      yield* AtomRegistry.getResult(registry, openPicker);

      expect(click).toHaveBeenCalledOnce();
      releaseOpenPicker();
    })
  );

  it.effect(
    "routes the surface file-input actions to the same hidden input",
    Effect.fnUntraced(function* () {
      const { registry, waitFor } = yield* mountSurface({ GetWorkspaceVault: () => Effect.succeed(configuredVault) });
      const { actions } = yield* waitFor((current) => current.vaultStatus === "configured");
      const input = document.createElement("input");
      input.type = "file";
      const click = vi.spyOn(input, "click").mockImplementation(() => undefined);

      actions.setFileInput(input);
      actions.openFilePicker();
      yield* AtomRegistry.getResult(registry, openIntakeFilePickerAtoms(workspaceId));

      assertSome(registry.get(intakeFileInputAtoms(workspaceId)), input);
      expect(click).toHaveBeenCalledOnce();
    })
  );
});
