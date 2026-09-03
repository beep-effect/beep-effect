/**
 * Desktop document intake client atoms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { chatProtocolLayerAtom } from "@beep/agents-client";
import { Document } from "@beep/documents-domain/aggregates/Document";
import { IntakeBatchId } from "@beep/documents-domain/aggregates/IntakeBatch";
import { DefaultVaultFilingContext, slugVaultSegment } from "@beep/documents-domain/values/Taxonomy";
import { DocumentsRpcs, IntakeDroppedFilePayload } from "@beep/documents-use-cases/public";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability/CauseRedaction";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { NonNegativeInt } from "@beep/schema/Number";
import { Defect } from "@beep/schema/Opaque";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as A from "@beep/utils/Array";
import * as N from "@beep/utils/Number";
import * as O from "@beep/utils/Option";
import * as P from "@beep/utils/Predicate";
import { SetWorkspaceVaultInput, WorkspaceVaultRpcs } from "@beep/workspace-use-cases/public";
import { invoke } from "@tauri-apps/api/core";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { AsyncResult, Atom, AtomRpc, Reactivity } from "effect/unstable/reactivity";
import { failureMessageOr } from "@/lib/failureMessage";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import { VaultDirectoryPickError, VaultDirectoryPickerRpcs } from "./VaultDirectoryPicker.rpc.ts";

const $I = $ProfessionalDesktopId.create("intake/Intake.atoms");

const DesktopIntakeRpcs = WorkspaceVaultRpcs.merge(DocumentsRpcs, VaultDirectoryPickerRpcs);

/**
 * Desktop RPC context used by document intake and workspace-vault atoms.
 *
 * **Details**
 *
 * Exported so runtime-atom tests can provide deterministic service layers
 * without opening a transport.
 *
 * **Example** (Check runtime function type)
 *
 * ```ts
 * import { DesktopIntakeClient } from "@/intake/Intake.atoms"
 *
 * console.log(typeof DesktopIntakeClient.runtime.fn === "function") // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DesktopIntakeClient extends AtomRpc.Service<DesktopIntakeClient>()("DesktopIntakeClient", {
  group: DesktopIntakeRpcs,
  protocol: (get) => get(chatProtocolLayerAtom),
  runtime: professionalBrowserRuntime.factory,
}) {}

const workspaceVaultKey = (workspaceId: WorkspaceIdentity.WorkspaceId) => `workspace-vault:${workspaceId}`;

/**
 * Largest file accepted by the renderer intake path.
 *
 * **Example** (Log size in megabytes)
 *
 * ```ts
 * import { MAX_INTAKE_FILE_BYTES } from "@/intake/Intake.atoms"
 *
 * console.log(MAX_INTAKE_FILE_BYTES / 1024 / 1024) // 25
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
const MAX_INTAKE_FILE_BYTES = 25 * 1024 * 1024;

const formatMegabytes = (bytes: number): string => `${N.round(bytes / (1024 * 1024), 1)} MB`;

const IntakeFileSize = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`IntakeFileSizeNonNegativeCheck`,
    title: "Non-negative intake file size",
    description: "Browser file sizes are whole byte counts greater than or equal to zero.",
    message: "Expected a non-negative file size.",
  })
).pipe(
  $I.annoteSchema("IntakeFileSize", {
    description: "Non-negative whole byte count reported by a browser File.",
  })
);

/**
 * File metadata inspected before desktop intake reads any bytes.
 *
 * **Example** (Create file metadata)
 *
 * ```ts
 * import { IntakeFileMetadata } from "@/intake/Intake.atoms"
 *
 * const metadata = IntakeFileMetadata.make({ name: "brief.pdf", size: 1024 })
 * console.log(metadata.name) // "brief.pdf"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class IntakeFileMetadata extends S.Class<IntakeFileMetadata>($I`IntakeFileMetadata`)(
  {
    name: S.String,
    size: IntakeFileSize,
  },
  $I.annote("IntakeFileMetadata", {
    description: "Browser file metadata used by the pre-read intake refusal policy.",
  })
) {}

/**
 * Decide whether a file must be rejected before its bytes are materialized.
 *
 * **Example** (Refuse empty file)
 *
 * ```ts
 * import { intakeRefusal } from "@/intake/Intake.atoms"
 *
 * console.log(intakeRefusal({ name: "empty.txt", size: 0 }))
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const intakeRefusal = (file: IntakeFileMetadata): O.Option<string> =>
  Match.value(file.size).pipe(
    Match.when(N.isGreaterThan(MAX_INTAKE_FILE_BYTES), (size) =>
      O.some(`${formatMegabytes(size)} exceeds the ${formatMegabytes(MAX_INTAKE_FILE_BYTES)} intake limit.`)
    ),
    Match.when(0, () => O.some("This file is empty, so there is nothing to file.")),
    Match.orElse(O.none<string>)
  );

class IntakeResultEntryDocument extends S.Class<IntakeResultEntryDocument>($I`IntakeResultEntryDocument`)(
  {
    kind: S.tag("document"),
    document: Document,
  },
  $I.annote("IntakeResultEntryDocument", {
    description: "A document that completed the desktop intake pipeline.",
  })
) {}

class IntakeResultEntryFailure extends S.Class<IntakeResultEntryFailure>($I`IntakeResultEntryFailure`)(
  {
    kind: S.tag("failure"),
    fileName: S.NonEmptyString,
    message: S.NonEmptyString,
  },
  $I.annote("IntakeResultEntryFailure", {
    description: "A file that was refused or failed during desktop intake.",
  })
) {}

const IntakeResultEntryKind = LiteralKit(["document", "failure"]).pipe(
  $I.annoteSchema("IntakeResultEntryKind", {
    description: "Exhaustive per-file document intake outcome variants.",
  })
);

/**
 * Exhaustive outcome for one file submitted to desktop intake.
 *
 * **Example** (Create failure result entry)
 *
 * ```ts
 * import { IntakeResultEntry } from "@/intake/Intake.atoms"
 *
 * const failure = IntakeResultEntry.cases.failure.make({
 *   fileName: "empty.txt",
 *   message: "This file is empty."
 * })
 * console.log(failure.kind) // "failure"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const IntakeResultEntry = IntakeResultEntryKind.mapMembers(
  Tuple.evolve([() => IntakeResultEntryDocument, () => IntakeResultEntryFailure])
)
  .annotate(
    $I.annote("IntakeResultEntry", {
      description: "Exhaustive per-file outcome emitted by desktop document intake.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));

/**
 * Runtime type for {@link IntakeResultEntry}.
 *
 * **Example** (Type a failure result)
 *
 * ```ts
 * import { IntakeResultEntry } from "@/intake/Intake.atoms"
 *
 * const result: IntakeResultEntry = IntakeResultEntry.cases.failure.make({
 *   fileName: "empty.txt",
 *   message: "This file is empty."
 * })
 * console.log(result.kind) // "failure"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type IntakeResultEntry = typeof IntakeResultEntry.Type;

class VaultSelectionIdle extends S.Class<VaultSelectionIdle>($I`VaultSelectionIdle`)(
  { kind: S.tag("idle") },
  $I.annote("VaultSelectionIdle", {
    description: "Workspace vault selection is ready for an operator request.",
  })
) {}

class VaultSelectionChoosing extends S.Class<VaultSelectionChoosing>($I`VaultSelectionChoosing`)(
  { kind: S.tag("choosing") },
  $I.annote("VaultSelectionChoosing", {
    description: "A native workspace vault picker is currently open.",
  })
) {}

class VaultSelectionManual extends S.Class<VaultSelectionManual>($I`VaultSelectionManual`)(
  {
    kind: S.tag("manual"),
    // A rejected path is retained so the reopened form does not force the
    // operator to retype it (the saving state unmounts the form in between).
    draftPath: S.Option(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    message: S.Option(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("VaultSelectionManual", {
    description: "A manual vault-path form is open because no native folder picker is available.",
  })
) {}

class VaultSelectionSaving extends S.Class<VaultSelectionSaving>($I`VaultSelectionSaving`)(
  { kind: S.tag("saving") },
  $I.annote("VaultSelectionSaving", {
    description: "The selected workspace vault root is being persisted.",
  })
) {}

class VaultSelectionFailed extends S.Class<VaultSelectionFailed>($I`VaultSelectionFailed`)(
  {
    kind: S.tag("failed"),
    message: S.NonEmptyString,
  },
  $I.annote("VaultSelectionFailed", {
    description: "Workspace vault selection failed with an operator-safe message.",
  })
) {}

const VaultSelectionStateKind = LiteralKit(["idle", "choosing", "manual", "saving", "failed"]).pipe(
  $I.annoteSchema("VaultSelectionStateKind", {
    description: "Exhaustive workspace vault selection lifecycle variants.",
  })
);

/**
 * Exhaustive workspace vault selection state machine.
 *
 * **Example** (Create choosing vault state)
 *
 * ```ts
 * import { VaultSelectionState } from "@/intake/Intake.atoms"
 *
 * const state = VaultSelectionState.cases.choosing.make()
 * console.log(VaultSelectionState.guards.choosing(state)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VaultSelectionState = VaultSelectionStateKind.mapMembers(
  Tuple.evolve([
    () => VaultSelectionIdle,
    () => VaultSelectionChoosing,
    () => VaultSelectionManual,
    () => VaultSelectionSaving,
    () => VaultSelectionFailed,
  ])
)
  .annotate(
    $I.annote("VaultSelectionState", {
      description: "Workspace vault picker and persistence lifecycle state.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));

/**
 * Runtime type for {@link VaultSelectionState}.
 *
 * **Example** (Type an idle vault state)
 *
 * ```ts
 * import { VaultSelectionState } from "@/intake/Intake.atoms"
 *
 * const state: VaultSelectionState = VaultSelectionState.cases.idle.make()
 * console.log(state.kind) // "idle"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VaultSelectionState = typeof VaultSelectionState.Type;

/**
 * Per-workspace renderer state for document intake.
 *
 * **Example** (Create initial intake state)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema/Number";
 * import { DocumentIntakeState, VaultSelectionState } from "@/intake/Intake.atoms"
 *
 * const state = DocumentIntakeState.make({
 *   activeBatches: NonNegativeInt.make(0),
 *   isDragging: false,
 *   results: [],
 *   vaultSelection: VaultSelectionState.cases.idle.make()
 * })
 * console.log(state.isDragging) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentIntakeState extends S.Class<DocumentIntakeState>($I`DocumentIntakeState`)(
  {
    activeBatches: NonNegativeInt,
    isDragging: S.Boolean,
    results: S.Array(IntakeResultEntry),
    vaultSelection: VaultSelectionState,
  },
  $I.annote("DocumentIntakeState", {
    description: "Renderer-owned document intake progress, results, and operator status.",
  })
) {
  /**
   * The canonical zero state: no batches, no results, idle vault selection.
   */
  static readonly initial = DocumentIntakeState.make({
    activeBatches: NonNegativeInt.make(0),
    isDragging: false,
    results: [],
    vaultSelection: VaultSelectionState.cases.idle.make(),
  });

  /**
   * Append one completed intake result.
   */
  // fallow-ignore-next-line unused-class-member -- invoked as state.<method>() inside registry.update callbacks in this module; fallow 3.14 misses S.Class instance-method receivers
  appendResult(result: IntakeResultEntry): DocumentIntakeState {
    return DocumentIntakeState.make({ ...this, results: A.append(this.results, result) });
  }

  /**
   * Drop all intake results.
   */
  // fallow-ignore-next-line unused-class-member -- invoked as state.<method>() inside registry.update callbacks in this module; fallow 3.14 misses S.Class instance-method receivers
  clearResults(): DocumentIntakeState {
    return DocumentIntakeState.make({ ...this, results: [] });
  }

  /**
   * Record one more in-flight intake batch.
   */
  // fallow-ignore-next-line unused-class-member -- invoked as state.<method>() inside registry.update callbacks in this module; fallow 3.14 misses S.Class instance-method receivers
  startBatch(): DocumentIntakeState {
    return DocumentIntakeState.make({ ...this, activeBatches: NonNegativeInt.make(this.activeBatches + 1) });
  }

  /**
   * Record one in-flight intake batch finishing.
   */
  // fallow-ignore-next-line unused-class-member -- invoked as state.<method>() inside registry.update callbacks in this module; fallow 3.14 misses S.Class instance-method receivers
  finishBatch(): DocumentIntakeState {
    return DocumentIntakeState.make({ ...this, activeBatches: NonNegativeInt.make(this.activeBatches - 1) });
  }

  /**
   * Set the drag-over highlight flag.
   */
  // fallow-ignore-next-line unused-class-member -- invoked as state.<method>() inside registry.update callbacks in this module; fallow 3.14 misses S.Class instance-method receivers
  withDragging(isDragging: boolean): DocumentIntakeState {
    return DocumentIntakeState.make({ ...this, isDragging });
  }

  /**
   * Replace the vault-selection operator status.
   */
  // fallow-ignore-next-line unused-class-member -- invoked as state.<method>() inside registry.update callbacks in this module; fallow 3.14 misses S.Class instance-method receivers
  withVaultSelection(vaultSelection: VaultSelectionState): DocumentIntakeState {
    return DocumentIntakeState.make({ ...this, vaultSelection });
  }
}

/**
 * Per-workspace document intake renderer state.
 *
 * **Example** (Check atoms factory type)
 *
 * ```ts
 * import { documentIntakeStateAtoms } from "@/intake/Intake.atoms"
 *
 * console.log(typeof documentIntakeStateAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const documentIntakeStateAtoms = Atom.family((_workspaceId: WorkspaceIdentity.WorkspaceId) =>
  Atom.make(DocumentIntakeState.initial)
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
 * Atom family that reads the workspace vault configuration over desktop RPC.
 *
 * **Example** (Create vault config query)
 *
 * ```ts
 * import { workspaceVaultConfigAtom } from "@/intake/Intake.atoms"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 *
 * const query = workspaceVaultConfigAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID)
 * console.log(typeof query === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const workspaceVaultConfigAtom = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  DesktopIntakeClient.query("GetWorkspaceVault", { workspaceId }, { reactivityKeys: [workspaceVaultKey(workspaceId)] })
);

/**
 * Browser-side dropped document input before the default filing context is attached.
 *
 * **Example** (Create dropped document input)
 *
 * ```ts
 * import { IntakeBatchId } from "@beep/documents-domain/aggregates/IntakeBatch"
 * import { DroppedDocumentInput } from "@/intake/Intake.atoms"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 *
 * const input = DroppedDocumentInput.make({
 *   content: new Uint8Array([1, 2, 3]),
 *   intakeBatchId: IntakeBatchId.make("batch-20260709"),
 *   originalFileName: "complaint.pdf",
 *   workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID
 * })
 * console.log(input.originalFileName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DroppedDocumentInput extends S.Class<DroppedDocumentInput>($I`DroppedDocumentInput`)(
  {
    content: S.Uint8ArrayFromBase64,
    intakeBatchId: IntakeBatchId,
    originalFileName: S.NonEmptyString,
    workspaceId: WorkspaceIdentity.WorkspaceId,
  },
  $I.annote("DroppedDocumentInput", {
    description: "Browser-side dropped document input.",
  })
) {}

/**
 * Attach the default filing context to a typed dropped document input.
 *
 * **Example** (Attach default filing context)
 *
 * ```ts
 * import { IntakeBatchId } from "@beep/documents-domain/aggregates/IntakeBatch"
 * import { DroppedDocumentInput, intakeDroppedFilePayload } from "@/intake/Intake.atoms"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 *
 * const payload = intakeDroppedFilePayload(
 *   DroppedDocumentInput.make({
 *     content: new Uint8Array([1, 2, 3]),
 *     intakeBatchId: IntakeBatchId.make("batch-1"),
 *     originalFileName: "complaint.pdf",
 *     workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID
 *   })
 * )
 * console.log(payload.originalFileName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const intakeDroppedFilePayload = (input: DroppedDocumentInput): IntakeDroppedFilePayload =>
  IntakeDroppedFilePayload.make({
    ...input,
    filingContext: DefaultVaultFilingContext,
  });

/**
 * Technical failure raised while invoking the Tauri workspace vault picker.
 *
 * **Example** (Create an invocation failure)
 *
 * ```ts
 * import { VaultDirectoryPickerInvocationError } from "@/intake/Intake.atoms"
 *
 * const error = VaultDirectoryPickerInvocationError.make({ cause: new Error("dialog unavailable") })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VaultDirectoryPickerInvocationError extends S.TaggedError<VaultDirectoryPickerInvocationError>(
  $I`VaultDirectoryPickerInvocationError`
)(
  "VaultDirectoryPickerInvocationError",
  {
    cause: Defect({ includeStack: true }),
  },
  $I.annoteError<VaultDirectoryPickerInvocationError>("VaultDirectoryPickerInvocationError", {
    description: "Technical failure raised while invoking the Tauri workspace vault picker.",
  })
) {}

/**
 * Technical failure raised while reading a browser `File` into memory.
 *
 * **Example** (Create a file-read failure)
 *
 * ```ts
 * import { BrowserFileReadError } from "@/intake/Intake.atoms"
 *
 * const error = BrowserFileReadError.make({ cause: new Error("read failed") })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BrowserFileReadError extends S.TaggedError<BrowserFileReadError>($I`BrowserFileReadError`)(
  "BrowserFileReadError",
  {
    cause: Defect({ includeStack: true }),
  },
  $I.annoteError<BrowserFileReadError>("BrowserFileReadError", {
    description: "Technical failure raised while reading a browser File into memory.",
  })
) {}

const hasTauriRuntime = (): boolean => !P.isUndefined(globalThis.window) && "__TAURI_INTERNALS__" in globalThis.window;

const batchIdFor = (files: ReadonlyArray<File>): string =>
  `batch-${A.length(files)}-${A.head(files).pipe(
    O.map((file) => file.name),
    O.filter(Str.isNonEmpty),
    O.getOrElse(() => "drop"),
    slugVaultSegment
  )}`;

const nonEmptyFileName = (file: File): string =>
  O.liftPredicate(file.name, Str.isNonEmpty).pipe(O.getOrElse(() => "document"));

const vaultConfigurationFailureMessage = failureMessageOr("Unable to save workspace vault.");

const intakeFailureMessage = failureMessageOr("Intake failed.");

const decodeSetWorkspaceVaultInput = S.decodeUnknownEffect(SetWorkspaceVaultInput);

const decodeIntakeBatchId = S.decodeUnknownEffect(IntakeBatchId);

const isWorkspaceVaultConfigured = (ctx: Atom.FnContext, workspaceId: WorkspaceIdentity.WorkspaceId): boolean =>
  O.isSome(
    AsyncResult.value(ctx(workspaceVaultConfigAtom(workspaceId))).pipe(
      O.flatMap((configuration) => configuration.vaultRootPath)
    )
  );

const logIntakeCause = (
  cause: unknown,
  message: string,
  action: "intake_file" | "pick_workspace_vault" | "save_workspace_vault"
): Effect.Effect<void> =>
  logRedactedCause(
    cause,
    LogRedactedCauseOptions.make({
      message,
      level: "Warn",
      attributes: {
        "professional_desktop.intake.action": action,
        "professional_desktop.subsystem": "document_intake",
      },
    })
  );

/**
 * Runtime action family that opens a native vault picker and persists the
 * selected workspace root. All status and query updates occur inside the atom
 * runtime.
 *
 * **Example** (Check action family type)
 *
 * ```ts
 * import { chooseWorkspaceVaultAtoms } from "@/intake/Intake.atoms"
 *
 * console.log(typeof chooseWorkspaceVaultAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const chooseWorkspaceVaultAtoms = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  DesktopIntakeClient.runtime.fn<void>()(
    Effect.fn("professional_desktop.intake.choose_workspace_vault")(function* (_, ctx) {
      const client = yield* DesktopIntakeClient;
      const stateAtom = documentIntakeStateAtoms(workspaceId);
      const canStart = ctx.registry.modify(stateAtom, (state) => {
        const choosing = state.withVaultSelection(VaultSelectionState.cases.choosing.make());
        return VaultSelectionState.match(state.vaultSelection, {
          idle: () => Tuple.make(true, choosing),
          choosing: () => Tuple.make(false, state),
          manual: () => Tuple.make(false, state),
          saving: () => Tuple.make(false, state),
          failed: () => Tuple.make(true, choosing),
        });
      });
      if (!canStart) return;

      yield* Effect.annotateCurrentSpan({
        "professional_desktop.workspace.id": workspaceId,
      });
      // A real in-card form, not `window.prompt`: the raw prompt was
      // unstyled, unlabeled, and cancelling it stranded the operator on the
      // vault gate with no visible way forward (QA closeout finding).
      const openManualEntry = Effect.annotateCurrentSpan({
        "professional_desktop.intake.vault_selection.fallback": "manual_path_form",
      }).pipe(
        Effect.andThen(
          Effect.sync(() => {
            ctx.registry.update(stateAtom, (state) =>
              state.withVaultSelection(VaultSelectionState.cases.manual.make())
            );
          })
        ),
        Effect.as(O.none<string>())
      );
      const selected = yield* hasTauriRuntime()
        ? Effect.tryPromise({
            try: () => invoke<string | null>("select_vault_directory"),
            catch: (cause) => VaultDirectoryPickerInvocationError.make({ cause }),
          }).pipe(
            Effect.map(O.fromNullishOr),
            Effect.tapCause((cause) =>
              logIntakeCause(cause, "tauri vault directory picker failed", "pick_workspace_vault")
            ),
            Effect.mapError(() => VaultDirectoryPickError.new("The folder picker could not be opened.")),
            Effect.catchTag("VaultDirectoryPickError", (failure) =>
              Effect.annotateCurrentSpan({
                "professional_desktop.intake.vault_selection.outcome": "picker_failure",
              }).pipe(
                Effect.andThen(
                  Effect.sync(() => {
                    ctx.registry.update(stateAtom, (state) =>
                      state.withVaultSelection(VaultSelectionState.cases.failed.make({ message: failure.message }))
                    );
                  })
                ),
                Effect.as(O.none<string>())
              )
            )
          )
        : client("PickVaultDirectory", void 0).pipe(
            Effect.tapCause((cause) =>
              logIntakeCause(cause, "sidecar vault directory picker failed", "pick_workspace_vault")
            ),
            Effect.catchTags({
              RpcClientError: () => openManualEntry,
              VaultDirectoryPickError: () => openManualEntry,
            })
          );
      const selectedPath = selected.pipe(O.map(Str.trim), O.filter(Str.isNonEmpty));
      if (O.isNone(selectedPath)) {
        const cancelled = ctx.registry.modify(stateAtom, (state) =>
          VaultSelectionState.guards.choosing(state.vaultSelection)
            ? Tuple.make(true, state.withVaultSelection(VaultSelectionState.cases.idle.make()))
            : Tuple.make(false, state)
        );
        if (cancelled) {
          yield* Effect.annotateCurrentSpan({
            "professional_desktop.intake.vault_selection.outcome": "cancelled",
          });
        }
        return;
      }

      yield* Effect.annotateCurrentSpan({
        "professional_desktop.intake.vault_selection.outcome": "selected",
      });
      yield* saveWorkspaceVaultPath(workspaceId, client, ctx, selectedPath.value, (message) =>
        VaultSelectionState.cases.failed.make({ message })
      );
    }),
    { concurrent: true }
  )
);

// Persist one selected vault root and settle the selection state machine.
// `toFailureState` decides where a persistence failure lands: the native flow
// falls back to the failed card, the manual form stays open with the message
// rendered inline.
const saveWorkspaceVaultPath = Effect.fnUntraced(function* (
  workspaceId: WorkspaceIdentity.WorkspaceId,
  client: DesktopIntakeClient["Service"],
  ctx: Atom.FnContext,
  vaultRootPath: string,
  toFailureState: (message: string) => VaultSelectionState
) {
  const stateAtom = documentIntakeStateAtoms(workspaceId);
  ctx.registry.update(stateAtom, (state) => state.withVaultSelection(VaultSelectionState.cases.saving.make()));
  yield* decodeSetWorkspaceVaultInput({
    vaultRootPath,
    workspaceId,
  }).pipe(
    Effect.flatMap((payload) =>
      Reactivity.mutation(client("SetWorkspaceVault", payload), [workspaceVaultKey(workspaceId)])
    ),
    Effect.tapCause((cause) => logIntakeCause(cause, "workspace vault persistence failed", "save_workspace_vault")),
    Effect.matchEffect({
      onFailure: (failure) =>
        Effect.annotateCurrentSpan({
          "professional_desktop.intake.vault_selection.outcome": "save_failure",
        }).pipe(
          Effect.andThen(
            Effect.sync(() => {
              ctx.registry.update(stateAtom, (state) =>
                state.withVaultSelection(toFailureState(vaultConfigurationFailureMessage(failure)))
              );
            })
          )
        ),
      onSuccess: () =>
        Effect.annotateCurrentSpan({
          "professional_desktop.intake.vault_selection.outcome": "success",
        }).pipe(
          Effect.andThen(
            Effect.sync(() => {
              ctx.registry.update(stateAtom, (state) =>
                state.withVaultSelection(VaultSelectionState.cases.idle.make())
              );
            })
          )
        ),
    })
  );
});

/**
 * Runtime action family that persists a manually typed vault root path from
 * the onboarding form. An empty submission keeps the form open with guidance;
 * a persistence failure keeps it open with the operator-safe message.
 *
 * **Example** (Check action family type)
 *
 * ```ts
 * import { submitManualVaultPathAtoms } from "@/intake/Intake.atoms"
 *
 * console.log(typeof submitManualVaultPathAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const submitManualVaultPathAtoms = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  DesktopIntakeClient.runtime.fn<string>()(
    Effect.fn("professional_desktop.intake.submit_manual_vault_path")(function* (rawPath, ctx) {
      const client = yield* DesktopIntakeClient;
      const stateAtom = documentIntakeStateAtoms(workspaceId);
      if (!VaultSelectionState.guards.manual(ctx.registry.get(stateAtom).vaultSelection)) return;
      yield* Effect.annotateCurrentSpan({
        "professional_desktop.workspace.id": workspaceId,
      });
      const trimmed = Str.trim(rawPath);
      if (!Str.isNonEmpty(trimmed)) {
        yield* Effect.annotateCurrentSpan({
          "professional_desktop.intake.vault_selection.outcome": "empty_manual_path",
        });
        ctx.registry.update(stateAtom, (state) =>
          state.withVaultSelection(
            VaultSelectionState.cases.manual.make({ message: O.some("Enter the absolute path of a local folder.") })
          )
        );
        return;
      }
      yield* saveWorkspaceVaultPath(workspaceId, client, ctx, trimmed, (message) =>
        VaultSelectionState.cases.manual.make({ draftPath: O.some(trimmed), message: O.some(message) })
      );
    }),
    { concurrent: true }
  )
);

/**
 * Runtime action family that dismisses the manual vault-path form back to the
 * idle onboarding card, so a cancelled entry never strands the operator.
 *
 * **Example** (Check action family type)
 *
 * ```ts
 * import { cancelManualVaultPathAtoms } from "@/intake/Intake.atoms"
 *
 * console.log(typeof cancelManualVaultPathAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const cancelManualVaultPathAtoms = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  professionalBrowserRuntime.fn<void>()(
    Effect.fnUntraced(function* (_, ctx) {
      ctx.registry.update(documentIntakeStateAtoms(workspaceId), (state) =>
        VaultSelectionState.guards.manual(state.vaultSelection)
          ? state.withVaultSelection(VaultSelectionState.cases.idle.make())
          : state
      );
    })
  )
);

const processIntakeFiles = Effect.fn("professional_desktop.intake.process_files")(function* (
  workspaceId: WorkspaceIdentity.WorkspaceId,
  files: ReadonlyArray<File>,
  ctx: Atom.FnContext
) {
  if (A.isReadonlyArrayEmpty(files)) return;
  const client = yield* DesktopIntakeClient;
  const stateAtom = documentIntakeStateAtoms(workspaceId);
  const intakeBatchId = yield* decodeIntakeBatchId(batchIdFor(files)).pipe(Effect.orDie);
  yield* Effect.annotateCurrentSpan({
    "professional_desktop.intake.batch_id": intakeBatchId,
    "professional_desktop.intake.batch_size": A.length(files),
    "professional_desktop.workspace.id": workspaceId,
  });
  ctx.registry.update(stateAtom, (state) => state.startBatch());
  yield* Effect.forEach(
    files,
    (file) => {
      const fileName = nonEmptyFileName(file);
      const refusal = intakeRefusal(file);
      if (O.isSome(refusal)) {
        ctx.registry.update(stateAtom, (state) =>
          state.appendResult(
            IntakeResultEntry.cases.failure.make({
              fileName,
              message: refusal.value,
            })
          )
        );
        return Effect.void;
      }
      return Effect.tryPromise({
        try: () => file.arrayBuffer(),
        catch: (cause) => BrowserFileReadError.make({ cause }),
      }).pipe(
        Effect.map((buffer) => new Uint8Array(buffer)),
        Effect.flatMap((content) =>
          Reactivity.mutation(
            client(
              "IntakeDroppedFile",
              intakeDroppedFilePayload(
                DroppedDocumentInput.make({
                  content,
                  intakeBatchId,
                  originalFileName: fileName,
                  workspaceId,
                })
              )
            ),
            [workspaceVaultKey(workspaceId)]
          )
        ),
        Effect.tapCause((cause) => logIntakeCause(cause, "document intake failed", "intake_file")),
        Effect.matchEffect({
          onFailure: (failure) =>
            Effect.sync(() => {
              ctx.registry.update(stateAtom, (state) =>
                state.appendResult(
                  IntakeResultEntry.cases.failure.make({
                    fileName,
                    message: intakeFailureMessage(failure),
                  })
                )
              );
            }),
          onSuccess: (document) =>
            Effect.sync(() => {
              ctx.registry.update(stateAtom, (state) =>
                state.appendResult(IntakeResultEntry.cases.document.make({ document }))
              );
            }),
        })
      );
    },
    { concurrency: 1, discard: true }
  ).pipe(
    Effect.ensuring(
      Effect.sync(() => {
        ctx.registry.update(stateAtom, (state) => state.finishBatch());
      })
    )
  );
  yield* Effect.annotateCurrentSpan({
    "professional_desktop.intake.outcome": "completed",
  });
});

/**
 * Runtime action family that processes a file batch sequentially and appends
 * typed outcomes to the workspace intake state.
 *
 * **Example** (Check action family type)
 *
 * ```ts
 * import { intakeFilesAtoms } from "@/intake/Intake.atoms"
 *
 * console.log(typeof intakeFilesAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const intakeFilesAtoms = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  DesktopIntakeClient.runtime.fn<ReadonlyArray<File>>()((files, ctx) => processIntakeFiles(workspaceId, files, ctx), {
    concurrent: true,
  })
);

/**
 * Workspace-scoped runtime actions for drag-and-drop and hidden file-input
 * browser events.
 *
 * **Example** (Access drop event actions)
 *
 * ```ts
 * import { intakeDomEventAtoms } from "@/intake/Intake.atoms"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 *
 * const actions = intakeDomEventAtoms(DEFAULT_PROFESSIONAL_WORKSPACE_ID)
 * console.log(actions.drop !== actions.fileSelection) // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const intakeDomEventAtoms = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) => ({
  dragEnter: professionalBrowserRuntime.fn<{ readonly preventDefault: () => void }>()(
    Effect.fnUntraced(function* ({ preventDefault }, ctx) {
      if (!isWorkspaceVaultConfigured(ctx, workspaceId)) return;
      yield* Effect.sync(preventDefault);
      ctx.registry.update(documentIntakeStateAtoms(workspaceId), (state) => state.withDragging(true));
    })
  ),
  dragOver: professionalBrowserRuntime.fn<{ readonly preventDefault: () => void }>()(
    Effect.fnUntraced(function* ({ preventDefault }, ctx) {
      if (!isWorkspaceVaultConfigured(ctx, workspaceId)) return;
      yield* Effect.sync(preventDefault);
    })
  ),
  dragLeave: professionalBrowserRuntime.fn<{
    readonly currentTarget: Node;
    readonly relatedTarget: EventTarget | null;
  }>()(
    Effect.fnUntraced(function* ({ currentTarget, relatedTarget }, ctx) {
      if (relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) return;
      ctx.registry.update(documentIntakeStateAtoms(workspaceId), (state) => state.withDragging(false));
    })
  ),
  drop: DesktopIntakeClient.runtime.fn<{
    readonly files: ReadonlyArray<File>;
    readonly preventDefault: () => void;
  }>()(
    Effect.fnUntraced(function* ({ files, preventDefault }, ctx) {
      if (!isWorkspaceVaultConfigured(ctx, workspaceId)) return;
      yield* Effect.sync(preventDefault);
      ctx.registry.update(documentIntakeStateAtoms(workspaceId), (state) => state.withDragging(false));
      yield* processIntakeFiles(workspaceId, files, ctx);
    }),
    { concurrent: true }
  ),
  fileSelection: DesktopIntakeClient.runtime.fn<ReadonlyArray<File>>()(
    (files, ctx) => processIntakeFiles(workspaceId, files, ctx),
    { concurrent: true }
  ),
}));

/**
 * Runtime action family that clears completed intake outcomes.
 *
 * Consumed through the intake surface view model's `actions.clearResults`.
 *
 * @category atoms
 * @since 0.0.0
 */
const clearIntakeResultsAtoms = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  professionalBrowserRuntime.fn<void>()(
    Effect.fnUntraced(function* (_, ctx) {
      const stateAtom = documentIntakeStateAtoms(workspaceId);
      ctx.registry.update(stateAtom, (state) => state.clearResults());
    })
  )
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
 * The document intake view model consumed by `DocumentIntakeTarget`: current
 * intake state, the vault-configuration flags derived from the workspace vault
 * config, and the runtime-bound action dispatchers.
 *
 * **Details**
 *
 * `actions` is computed independently of `state`, so a component can hand its
 * callbacks to children without re-binding them whenever intake state moves.
 * `configured` and `needsOnboarding` are mutually exclusive and both `false`
 * until the workspace vault configuration resolves.
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
    readonly setFileInput: (element: HTMLInputElement | null) => void;
    readonly submitManualVaultPath: (path: string) => void;
  };
  readonly configured: boolean;
  readonly needsOnboarding: boolean;
  readonly state: DocumentIntakeState;
}

/**
 * Stable, non-reactive action record for the document intake surface, keyed by
 * workspace.
 *
 * **Details**
 *
 * The actions read no reactive state, so this atom computes once per workspace
 * and every closure — including the file-input React ref callback — stays
 * referentially stable across intake state changes. Each dispatcher mounts the
 * atom it writes to, keeping those fibers subscribed for as long as the record
 * is observed.
 *
 * @category atoms
 * @since 0.0.0
 */
const documentIntakeActionsAtoms = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  Atom.make((get): DocumentIntakeSurface["actions"] => {
    const domEvents = intakeDomEventAtoms(workspaceId);
    const cancelManualVaultPathAtom = cancelManualVaultPathAtoms(workspaceId);
    const chooseVaultAtom = chooseWorkspaceVaultAtoms(workspaceId);
    const clearResultsAtom = clearIntakeResultsAtoms(workspaceId);
    const openFilePickerAtom = openIntakeFilePickerAtoms(workspaceId);
    const setFileInputAtom = setIntakeFileInputAtoms(workspaceId);
    const submitManualVaultPathAtom = submitManualVaultPathAtoms(workspaceId);
    get.mount(cancelManualVaultPathAtom);
    get.mount(chooseVaultAtom);
    get.mount(clearResultsAtom);
    get.mount(domEvents.dragEnter);
    get.mount(domEvents.dragLeave);
    get.mount(domEvents.dragOver);
    get.mount(domEvents.drop);
    get.mount(domEvents.fileSelection);
    get.mount(openFilePickerAtom);
    get.mount(setFileInputAtom);
    get.mount(submitManualVaultPathAtom);
    return {
      cancelManualVaultPath: () => get.set(cancelManualVaultPathAtom, void 0),
      chooseVault: () => get.set(chooseVaultAtom, void 0),
      clearResults: () => get.set(clearResultsAtom, void 0),
      dragEnter: (input) => get.set(domEvents.dragEnter, input),
      dragLeave: (input) => get.set(domEvents.dragLeave, input),
      dragOver: (input) => get.set(domEvents.dragOver, input),
      drop: (input) => get.set(domEvents.drop, input),
      fileSelection: (files) => get.set(domEvents.fileSelection, files),
      openFilePicker: () => get.set(openFilePickerAtom, void 0),
      setFileInput: (element) => get.set(setFileInputAtom, element),
      submitManualVaultPath: (path) => get.set(submitManualVaultPathAtom, path),
    };
  })
);

/**
 * One read for the document-intake surface: intake state, vault configuration
 * flags, and the stable action record, keyed by workspace.
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
export const documentIntakeSurfaceAtoms = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  Atom.make((get): DocumentIntakeSurface => {
    const vaultConfig = get(workspaceVaultConfigAtom(workspaceId));
    const state = get(documentIntakeStateAtoms(workspaceId));
    return {
      state,
      configured: AsyncResult.isSuccess(vaultConfig) && O.isSome(vaultConfig.value.vaultRootPath),
      needsOnboarding: AsyncResult.isSuccess(vaultConfig) && O.isNone(vaultConfig.value.vaultRootPath),
      actions: get(documentIntakeActionsAtoms(workspaceId)),
    };
  })
);
