/**
 * Desktop document intake client atoms: the intake actor, its renderer view
 * and the synchronous DOM adapters that feed it events.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as O from "@beep/utils/Option";
import { createActorAtoms } from "@xstate/effect/atom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { AsyncResult, Atom, Reactivity } from "effect/reactivity";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import { DesktopIntakeClient } from "./DesktopIntake.client.ts";
import { documentIntakeMachine, documentIntakeStateOf, vaultStatusOf } from "./DocumentIntake.machine.ts";
import { DocumentIntakeInput, DocumentIntakeState, DocumentIntakeVaultStatus } from "./DocumentIntake.models.ts";
import { inspectIntakeActor } from "./Intake.inspection.ts";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

// The intake machine's actors need the RPC client and the registry's own
// Reactivity service, so mutations they run invalidate the same keys every
// other atom reads. `DesktopIntakeClient.runtime` alone only types the client.
const documentIntakeRuntime = professionalBrowserRuntime.factory((get) =>
  Layer.merge(
    get(DesktopIntakeClient.runtime.layer),
    Layer.effect(Reactivity.Reactivity, Effect.service(Reactivity.Reactivity))
  )
);

/**
 * Per-workspace hidden file-input element bridge.
 *
 * **Example** (Check atoms factory type)
 *
 * ```ts
 * import { intakeFileInputAtoms } from "@/intake/Intake.atoms"
 *
 * console.log(typeof intakeFileInputAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const intakeFileInputAtoms = Atom.family((_workspaceId: WorkspaceIdentity.WorkspaceId) =>
  Atom.make<O.Option<HTMLInputElement>>(O.none()).pipe(Atom.keepAlive)
);

/**
 * Runtime action family that owns the hidden file-input DOM reference.
 *
 * **Example** (Check action family type)
 *
 * ```ts
 * import { setIntakeFileInputAtoms } from "@/intake/Intake.atoms"
 *
 * console.log(typeof setIntakeFileInputAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const setIntakeFileInputAtoms = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  professionalBrowserRuntime.fn<HTMLInputElement | null>()(
    Effect.fnUntraced(function* (element, ctx) {
      ctx.set(intakeFileInputAtoms(workspaceId), O.fromNullishOr(element));
    })
  )
);

/**
 * Runtime action family that resets and invokes the hidden file input.
 *
 * **Example** (Check action family type)
 *
 * ```ts
 * import { openIntakeFilePickerAtoms } from "@/intake/Intake.atoms"
 *
 * console.log(typeof openIntakeFilePickerAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const openIntakeFilePickerAtoms = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  professionalBrowserRuntime.fn<void>()(
    Effect.fnUntraced(function* (_, ctx) {
      yield* O.match(ctx(intakeFileInputAtoms(workspaceId)), {
        onNone: () => Effect.void,
        onSome: (element) =>
          Effect.sync(() => {
            element.value = "";
            element.click();
          }),
      });
    })
  )
);

/**
 * The document intake view model consumed by `DocumentIntakeTarget`: the
 * renderer view of the intake actor, the vault status, and the action
 * dispatchers that send it events.
 *
 * **Details**
 *
 * `actions` is computed independently of `state`, so a component can hand its
 * callbacks to children without re-binding them whenever intake state moves.
 * `vaultStatus` is `pending` until the intake actor has read the workspace
 * vault configuration.
 *
 * @category models
 * @since 0.0.0
 */
export interface DocumentIntakeSurface {
  readonly actions: {
    readonly cancelManualVaultPath: () => void;
    readonly chooseVault: () => void;
    readonly clearResults: () => void;
    readonly dragEnter: (input: { readonly preventDefault: () => void }) => void;
    readonly dragLeave: (input: { readonly currentTarget: Node; readonly relatedTarget: EventTarget | null }) => void;
    readonly dragOver: (input: { readonly preventDefault: () => void }) => void;
    readonly drop: (input: { readonly files: ReadonlyArray<File>; readonly preventDefault: () => void }) => void;
    readonly fileSelection: (files: ReadonlyArray<File>) => void;
    readonly openFilePicker: () => void;
    readonly retryVaultConfig: () => void;
    readonly setFileInput: (element: HTMLInputElement | null) => void;
    readonly submitManualVaultPath: (path: string) => void;
  };
  readonly state: DocumentIntakeState;
  readonly vaultStatus: DocumentIntakeVaultStatus;
}

const pendingView: Pick<DocumentIntakeSurface, "state" | "vaultStatus"> = {
  state: DocumentIntakeState.initial,
  vaultStatus: DocumentIntakeVaultStatus.Enum.pending,
};

// One factory builds the actor atoms, the DOM adapters and the surface atom, so
// the surface atom's closure is the only thing that has to stay alive: a second
// `Atom.family` lookup could otherwise mint a second actor behind a WeakRef.
const makeDocumentIntakeSurface = (workspaceId: WorkspaceIdentity.WorkspaceId): Atom.Atom<DocumentIntakeSurface> => {
  const intake = createActorAtoms(documentIntakeRuntime, documentIntakeMachine, {
    input: DocumentIntakeInput.make({ workspaceId }),
  });

  const inspection = documentIntakeRuntime.atom((get) => Effect.flatMap(get.result(intake.actor), inspectIntakeActor));

  const isVaultConfigured = (ctx: Atom.FnContext): boolean =>
    O.exists(AsyncResult.value(ctx(intake.snapshot)), (snapshot) =>
      DocumentIntakeVaultStatus.is.configured(vaultStatusOf(snapshot))
    );

  // `send` is queued, so `preventDefault` and the `contains` check have to run
  // here, synchronously inside the DOM event handler.
  const dragEnter = professionalBrowserRuntime.fn<{ readonly preventDefault: () => void }>()(
    Effect.fnUntraced(function* ({ preventDefault }, ctx) {
      if (!isVaultConfigured(ctx)) return;
      yield* Effect.sync(preventDefault);
      ctx.set(intake.send, { type: "DRAG_ENTER" });
    })
  );
  const dragOver = professionalBrowserRuntime.fn<{ readonly preventDefault: () => void }>()(
    Effect.fnUntraced(function* ({ preventDefault }, ctx) {
      if (!isVaultConfigured(ctx)) return;
      yield* Effect.sync(preventDefault);
    })
  );
  const dragLeave = professionalBrowserRuntime.fn<{
    readonly currentTarget: Node;
    readonly relatedTarget: EventTarget | null;
  }>()(
    Effect.fnUntraced(function* ({ currentTarget, relatedTarget }, ctx) {
      const leftSurface = !(relatedTarget instanceof Node && currentTarget.contains(relatedTarget));
      ctx.set(intake.send, { type: "DRAG_LEAVE", leftSurface });
    })
  );
  const drop = professionalBrowserRuntime.fn<{
    readonly files: ReadonlyArray<File>;
    readonly preventDefault: () => void;
  }>()(
    Effect.fnUntraced(function* ({ files, preventDefault }, ctx) {
      if (!isVaultConfigured(ctx)) return;
      yield* Effect.sync(preventDefault);
      ctx.set(intake.send, { type: "DROP", files });
    })
  );

  // The actions read no reactive state, so this atom computes once per
  // workspace and every closure, including the file-input React ref callback,
  // stays referentially stable across intake state changes.
  const actions = Atom.make((get): DocumentIntakeSurface["actions"] => {
    const openFilePickerAtom = openIntakeFilePickerAtoms(workspaceId);
    const setFileInputAtom = setIntakeFileInputAtoms(workspaceId);
    get.mount(dragEnter);
    get.mount(dragLeave);
    get.mount(dragOver);
    get.mount(drop);
    get.mount(openFilePickerAtom);
    get.mount(setFileInputAtom);
    return {
      cancelManualVaultPath: () => get.set(intake.send, { type: "CANCEL_MANUAL" }),
      chooseVault: () => get.set(intake.send, { type: "CHOOSE_VAULT" }),
      clearResults: () => get.set(intake.send, { type: "CLEAR_RESULTS" }),
      dragEnter: (input) => get.set(dragEnter, input),
      dragLeave: (input) => get.set(dragLeave, input),
      dragOver: (input) => get.set(dragOver, input),
      drop: (input) => get.set(drop, input),
      fileSelection: (files) => get.set(intake.send, { type: "FILES_SELECTED", files }),
      openFilePicker: () => get.set(openFilePickerAtom, void 0),
      retryVaultConfig: () => get.set(intake.send, { type: "RETRY_CONFIG" }),
      setFileInput: (element) => get.set(setFileInputAtom, element),
      submitManualVaultPath: (rawPath) => get.set(intake.send, { type: "SUBMIT_MANUAL_PATH", rawPath }),
    };
  });

  return Atom.make((get): DocumentIntakeSurface => {
    get.mount(inspection);
    return {
      ...O.match(AsyncResult.value(get(intake.snapshot)), {
        onNone: () => pendingView,
        onSome: (snapshot) => ({ state: documentIntakeStateOf(snapshot), vaultStatus: vaultStatusOf(snapshot) }),
      }),
      actions: get(actions),
    };
  });
};

/**
 * One read for the document-intake surface: the intake view, the vault status
 * and the stable action record, keyed by workspace.
 *
 * **Details**
 *
 * Reading the atom starts that workspace's intake actor; releasing it stops the
 * actor and interrupts its configuration feed and any batch still filing.
 *
 * **Example** (Inspect the surface atom family)
 *
 * ```ts
 * import { documentIntakeSurfaceAtoms } from "@/intake/Intake.atoms"
 *
 * console.log(typeof documentIntakeSurfaceAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const documentIntakeSurfaceAtoms = Atom.family(makeDocumentIntakeSurface);
