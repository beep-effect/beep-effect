import { DocumentIntakeActionError } from "@beep/documents-use-cases/public";
import { WorkspaceVaultRootPath } from "@beep/workspace-domain/entities/Workspace";
import { WorkspaceVaultActionError, WorkspaceVaultConfig } from "@beep/workspace-use-cases/public";
import { it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Schedule from "effect/Schedule";
import { AsyncResult, AtomRegistry, Reactivity } from "effect/unstable/reactivity";
import { afterEach, describe, expect, vi } from "vitest";
import {
  cancelManualVaultPathAtoms,
  chooseWorkspaceVaultAtoms,
  DesktopIntakeClient,
  documentIntakeStateAtoms,
  intakeDomEventAtoms,
  intakeFileInputAtoms,
  intakeFilesAtoms,
  openIntakeFilePickerAtoms,
  setIntakeFileInputAtoms,
  submitManualVaultPathAtoms,
  VaultSelectionState,
  workspaceVaultConfigAtom,
} from "@/intake/Intake.atoms";
import { VaultDirectoryPickError } from "@/intake/VaultDirectoryPicker.rpc";
import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace";
import type { DocumentIntakeState } from "@/intake/Intake.atoms";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const workspaceId = DEFAULT_PROFESSIONAL_WORKSPACE_ID;
const selectedPath = "/tmp/professional-desktop-vault";
const intakeFile = (name: string): File => {
  const file = new File(["content"], name);
  Object.defineProperty(file, "arrayBuffer", {
    configurable: true,
    value: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
  });
  return file;
};

const successfulConfig = WorkspaceVaultConfig.make({
  workspaceId,
  vaultRootPath: O.some(WorkspaceVaultRootPath.make(selectedPath)),
});

const registryWithClient = (client: DesktopIntakeClient["Service"]) =>
  AtomRegistry.make({
    initialValues: [
      [DesktopIntakeClient.runtime.layer, Layer.mergeAll(Layer.succeed(DesktopIntakeClient, client), Reactivity.layer)],
    ],
  });

const configuredRegistryWithClient = (client: DesktopIntakeClient["Service"]) =>
  AtomRegistry.make({
    initialValues: [
      [DesktopIntakeClient.runtime.layer, Layer.mergeAll(Layer.succeed(DesktopIntakeClient, client), Reactivity.layer)],
      [workspaceVaultConfigAtom(workspaceId), AsyncResult.success(successfulConfig)],
    ],
  });

const pollSchedule = Schedule.spaced(Duration.millis(10)).pipe(
  Schedule.upTo({ duration: Duration.seconds(3), times: 300 })
);

const waitForState = (
  registry: AtomRegistry.AtomRegistry,
  predicate: (state: DocumentIntakeState) => boolean
): Effect.Effect<void, string> =>
  Effect.suspend(() =>
    predicate(registry.get(documentIntakeStateAtoms(workspaceId)))
      ? Effect.void
      : Effect.fail("document intake state has not reached the expected value")
  ).pipe(Effect.retry(pollSchedule));

const waitForSelection = (
  registry: AtomRegistry.AtomRegistry,
  kind: DocumentIntakeState["vaultSelection"]["kind"]
): Effect.Effect<void, string> => waitForState(registry, (state) => state.vaultSelection.kind === kind);

const runChooseVault = (registry: AtomRegistry.AtomRegistry) => {
  const action = chooseWorkspaceVaultAtoms(workspaceId);
  registry.mount(documentIntakeStateAtoms(workspaceId));
  registry.mount(action);
  registry.set(action, void 0);
  return AtomRegistry.getResult(registry, action);
};

const openManualForm = (registry: AtomRegistry.AtomRegistry) => {
  registry.mount(documentIntakeStateAtoms(workspaceId));
  registry.update(documentIntakeStateAtoms(workspaceId), (state) =>
    state.withVaultSelection(VaultSelectionState.cases.manual.make())
  );
};

const runSubmitManualVaultPath = (registry: AtomRegistry.AtomRegistry, path: string) => {
  const action = submitManualVaultPathAtoms(workspaceId);
  registry.mount(action);
  registry.set(action, path);
  return AtomRegistry.getResult(registry, action);
};

const runCancelManualVaultPath = (registry: AtomRegistry.AtomRegistry) => {
  const action = cancelManualVaultPathAtoms(workspaceId);
  registry.mount(action);
  registry.set(action, void 0);
  return AtomRegistry.getResult(registry, action);
};

afterEach(() => {
  vi.restoreAllMocks();
  invoke.mockReset();
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
});

describe("workspace vault runtime action", { concurrent: false }, () => {
  it.live(
    "shows the saving state and clears it after persistence succeeds",
    Effect.fnUntraced(function* () {
      Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
      invoke.mockResolvedValue(selectedPath);
      const save = yield* Deferred.make<WorkspaceVaultConfig>();
      const client = DesktopIntakeClient.of(((tag: string) =>
        tag === "SetWorkspaceVault"
          ? Deferred.await(save)
          : Effect.die(`unexpected intake RPC: ${tag}`)) as unknown as DesktopIntakeClient["Service"]);
      const registry = registryWithClient(client);

      const result = runChooseVault(registry);
      yield* waitForSelection(registry, "saving");
      yield* Deferred.succeed(save, successfulConfig);
      yield* result;

      expect(registry.get(documentIntakeStateAtoms(workspaceId)).vaultSelection.kind).toBe("idle");
      registry.dispose();
    })
  );

  it.live(
    "leaves state unchanged when the operator cancels the picker",
    Effect.fnUntraced(function* () {
      Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
      invoke.mockResolvedValue(null);
      const client = DesktopIntakeClient.of((() =>
        Effect.die(
          "workspace vault RPC must not run after picker cancellation"
        )) as unknown as DesktopIntakeClient["Service"]);
      const registry = registryWithClient(client);

      yield* runChooseVault(registry);

      expect(registry.get(documentIntakeStateAtoms(workspaceId)).vaultSelection.kind).toBe("idle");
      registry.dispose();
    })
  );

  it.live(
    "surfaces a client-safe picker failure",
    Effect.fnUntraced(function* () {
      Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
      invoke.mockRejectedValue(new Error("private picker failure /home/operator"));
      const client = DesktopIntakeClient.of((() =>
        Effect.die(
          "workspace vault RPC must not run after picker failure"
        )) as unknown as DesktopIntakeClient["Service"]);
      const registry = registryWithClient(client);

      yield* runChooseVault(registry);

      const selection = registry.get(documentIntakeStateAtoms(workspaceId)).vaultSelection;
      expect(VaultSelectionState.guards.failed(selection)).toBe(true);
      expect(
        VaultSelectionState.match(selection, {
          idle: () => "",
          choosing: () => "",
          manual: () => "",
          saving: () => "",
          failed: ({ message }) => message,
        })
      ).not.toContain("/home/operator");
      registry.dispose();
    })
  );

  it.live(
    "opens the manual path form when the sidecar picker fails",
    Effect.fnUntraced(function* () {
      const prompt = vi.spyOn(window, "prompt");
      const client = DesktopIntakeClient.of(((tag: string) =>
        tag === "PickVaultDirectory"
          ? Effect.fail(VaultDirectoryPickError.new("Native picker unavailable."))
          : Effect.die(`unexpected intake RPC: ${tag}`)) as unknown as DesktopIntakeClient["Service"]);
      const registry = registryWithClient(client);

      yield* runChooseVault(registry);

      expect(prompt).not.toHaveBeenCalled();
      expect(registry.get(documentIntakeStateAtoms(workspaceId)).vaultSelection).toStrictEqual(
        VaultSelectionState.cases.manual.make()
      );
      registry.dispose();
    })
  );

  it.live(
    "persists a manually entered vault path and settles back to idle",
    Effect.fnUntraced(function* () {
      const client = DesktopIntakeClient.of(((tag: string) =>
        tag === "SetWorkspaceVault"
          ? Effect.succeed(successfulConfig)
          : Effect.die(`unexpected intake RPC: ${tag}`)) as unknown as DesktopIntakeClient["Service"]);
      const registry = registryWithClient(client);
      openManualForm(registry);

      yield* runSubmitManualVaultPath(registry, `  ${selectedPath}  `);

      expect(registry.get(documentIntakeStateAtoms(workspaceId)).vaultSelection.kind).toBe("idle");
      registry.dispose();
    })
  );

  it.live(
    "keeps the manual form open with guidance when the submitted path is empty",
    Effect.fnUntraced(function* () {
      const client = DesktopIntakeClient.of(((tag: string) =>
        Effect.die(
          `workspace vault RPC must not run for an empty path: ${tag}`
        )) as unknown as DesktopIntakeClient["Service"]);
      const registry = registryWithClient(client);
      openManualForm(registry);

      yield* runSubmitManualVaultPath(registry, "   ");

      expect(registry.get(documentIntakeStateAtoms(workspaceId)).vaultSelection).toStrictEqual(
        VaultSelectionState.cases.manual.make({ message: O.some("Enter the absolute path of a local folder.") })
      );
      registry.dispose();
    })
  );

  it.live(
    "keeps the manual form open with the persistence failure message",
    Effect.fnUntraced(function* () {
      const client = DesktopIntakeClient.of(((tag: string) =>
        tag === "SetWorkspaceVault"
          ? Effect.fail(WorkspaceVaultActionError.new("The selected vault is not writable."))
          : Effect.die(`unexpected intake RPC: ${tag}`)) as unknown as DesktopIntakeClient["Service"]);
      const registry = registryWithClient(client);
      openManualForm(registry);

      yield* runSubmitManualVaultPath(registry, selectedPath);

      // The rejected path is retained so the reopened form does not force the
      // operator to retype it.
      expect(registry.get(documentIntakeStateAtoms(workspaceId)).vaultSelection).toStrictEqual(
        VaultSelectionState.cases.manual.make({
          draftPath: O.some(selectedPath),
          message: O.some("The selected vault is not writable."),
        })
      );
      registry.dispose();
    })
  );

  it.live(
    "ignores a manual submission when the form is not open",
    Effect.fnUntraced(function* () {
      const client = DesktopIntakeClient.of(((tag: string) =>
        Effect.die(
          `workspace vault RPC must not run outside the manual form: ${tag}`
        )) as unknown as DesktopIntakeClient["Service"]);
      const registry = registryWithClient(client);
      registry.mount(documentIntakeStateAtoms(workspaceId));

      yield* runSubmitManualVaultPath(registry, selectedPath);

      expect(registry.get(documentIntakeStateAtoms(workspaceId)).vaultSelection.kind).toBe("idle");
      registry.dispose();
    })
  );

  it.live(
    "cancelling the manual form returns to the idle onboarding card",
    Effect.fnUntraced(function* () {
      const client = DesktopIntakeClient.of(((tag: string) =>
        Effect.die(`workspace vault RPC must not run on cancel: ${tag}`)) as unknown as DesktopIntakeClient["Service"]);
      const registry = registryWithClient(client);
      openManualForm(registry);

      yield* runCancelManualVaultPath(registry);

      expect(registry.get(documentIntakeStateAtoms(workspaceId)).vaultSelection.kind).toBe("idle");
      registry.dispose();
    })
  );

  it.live(
    "stores the public workspace-vault failure message",
    Effect.fnUntraced(function* () {
      Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
      invoke.mockResolvedValue(selectedPath);
      const client = DesktopIntakeClient.of(((tag: string) =>
        tag === "SetWorkspaceVault"
          ? Effect.fail(WorkspaceVaultActionError.new("The selected vault is not writable."))
          : Effect.die(`unexpected intake RPC: ${tag}`)) as unknown as DesktopIntakeClient["Service"]);
      const registry = registryWithClient(client);

      yield* runChooseVault(registry);

      expect(registry.get(documentIntakeStateAtoms(workspaceId)).vaultSelection).toStrictEqual(
        VaultSelectionState.cases.failed.make({ message: "The selected vault is not writable." })
      );
      registry.dispose();
    })
  );

  it.live(
    "ignores a repeated picker request while selection is already running",
    Effect.fnUntraced(function* () {
      Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
      const picker = Promise.withResolvers<string | null>();
      invoke.mockReturnValue(picker.promise);
      const client = DesktopIntakeClient.of((() =>
        Effect.die(
          "workspace vault RPC must not run after picker cancellation"
        )) as unknown as DesktopIntakeClient["Service"]);
      const registry = registryWithClient(client);
      const action = chooseWorkspaceVaultAtoms(workspaceId);
      registry.mount(documentIntakeStateAtoms(workspaceId));
      registry.mount(action);

      registry.set(action, void 0);
      yield* waitForSelection(registry, "choosing");
      registry.set(action, void 0);
      yield* Effect.yieldNow;

      expect(invoke).toHaveBeenCalledTimes(1);
      picker.resolve(null);
      yield* waitForSelection(registry, "idle");
      expect(invoke).toHaveBeenCalledTimes(1);
      registry.dispose();
    })
  );
});

describe("document intake runtime concurrency", { concurrent: false }, () => {
  it.live(
    "keeps overlapping batches alive, records every file, and returns the busy count to zero",
    Effect.fnUntraced(function* () {
      const release = yield* Deferred.make<void>();
      const intake = vi.fn(() =>
        Deferred.await(release).pipe(
          Effect.andThen(Effect.fail(DocumentIntakeActionError.new("Document intake unavailable.")))
        )
      );
      const client = DesktopIntakeClient.of(((tag: string) =>
        tag === "IntakeDroppedFile"
          ? intake()
          : Effect.die(`unexpected intake RPC: ${tag}`)) as unknown as DesktopIntakeClient["Service"]);
      const registry = registryWithClient(client);
      const action = intakeFilesAtoms(workspaceId);
      const stateAtom = documentIntakeStateAtoms(workspaceId);
      registry.mount(stateAtom);
      registry.mount(action);

      registry.set(action, [intakeFile("first.txt")]);
      registry.set(action, [intakeFile("second.txt")]);
      yield* waitForState(registry, (state) => state.activeBatches === 2);

      yield* Deferred.succeed(release, void 0);
      yield* waitForState(registry, (state) => state.activeBatches === 0 && A.length(state.results) === 2);

      const state = registry.get(stateAtom);
      expect(intake).toHaveBeenCalledTimes(2);
      expect(A.length(state.results)).toBe(2);
      expect(A.every(state.results, (result) => result.kind === "failure")).toBe(true);
      registry.dispose();
    })
  );
});

describe("intake DOM event runtime actions", { concurrent: false }, () => {
  it.live(
    "keeps the hidden file input available after the registry idle TTL",
    Effect.fnUntraced(function* () {
      const registry = AtomRegistry.make({ defaultIdleTTL: 10, timeoutResolution: 1 });
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
      expect(registry.get(intakeFileInputAtoms(workspaceId))).toStrictEqual(O.some(input));

      const releaseOpenPicker = registry.mount(openPicker);
      registry.set(openPicker, void 0);
      yield* AtomRegistry.getResult(registry, openPicker);

      expect(click).toHaveBeenCalledOnce();
      releaseOpenPicker();
      registry.dispose();
    })
  );

  it.live(
    "owns drag state and boundary narrowing inside the runtime",
    Effect.fnUntraced(function* () {
      const client = DesktopIntakeClient.of((() =>
        Effect.die("drag-only test must not call intake RPCs")) as unknown as DesktopIntakeClient["Service"]);
      const registry = configuredRegistryWithClient(client);
      const actions = intakeDomEventAtoms(workspaceId);
      const stateAtom = documentIntakeStateAtoms(workspaceId);
      const preventDefault = vi.fn();
      const container = document.createElement("div");
      const child = container.appendChild(document.createElement("span"));
      registry.mount(stateAtom);
      registry.mount(actions.dragEnter);
      registry.mount(actions.dragLeave);

      registry.set(actions.dragEnter, { preventDefault });
      yield* AtomRegistry.getResult(registry, actions.dragEnter);
      expect(preventDefault).toHaveBeenCalledOnce();
      expect(registry.get(stateAtom).isDragging).toBe(true);

      registry.set(actions.dragLeave, { currentTarget: container, relatedTarget: child });
      yield* AtomRegistry.getResult(registry, actions.dragLeave);
      expect(registry.get(stateAtom).isDragging).toBe(true);

      registry.set(actions.dragLeave, { currentTarget: container, relatedTarget: null });
      yield* AtomRegistry.getResult(registry, actions.dragLeave);
      expect(registry.get(stateAtom).isDragging).toBe(false);
      registry.dispose();
    })
  );

  it.live(
    "prevents configured drops and delegates the file batch inside the runtime",
    Effect.fnUntraced(function* () {
      const client = DesktopIntakeClient.of((() =>
        Effect.die("refused files must not call intake RPCs")) as unknown as DesktopIntakeClient["Service"]);
      const registry = configuredRegistryWithClient(client);
      const actions = intakeDomEventAtoms(workspaceId);
      const stateAtom = documentIntakeStateAtoms(workspaceId);
      const preventDefault = vi.fn();
      registry.mount(stateAtom);
      registry.mount(actions.drop);

      registry.set(actions.drop, { files: [new File([], "empty.txt")], preventDefault });
      yield* AtomRegistry.getResult(registry, actions.drop);

      const state = registry.get(stateAtom);
      expect(preventDefault).toHaveBeenCalledOnce();
      expect(state.isDragging).toBe(false);
      expect(A.length(state.results)).toBe(1);
      expect(state.results[0]?.kind).toBe("failure");
      registry.dispose();
    })
  );
});
