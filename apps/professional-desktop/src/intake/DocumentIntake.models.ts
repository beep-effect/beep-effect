/**
 * Schema-first models for the desktop document intake statechart: per-file
 * outcomes, the vault-selection view, machine input, context, events, emitted
 * notifications and the typed failures its Effect actors raise.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Document } from "@beep/documents-domain/aggregates/Document";
import { IntakeBatchId } from "@beep/documents-domain/aggregates/IntakeBatch";
import { DefaultVaultFilingContext, slugVaultSegment } from "@beep/documents-domain/values/Taxonomy";
import { IntakeDroppedFilePayload } from "@beep/documents-use-cases/public";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as A from "@beep/utils/Array";
import * as N from "@beep/utils/Number";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";

const $I = $ProfessionalDesktopId.create("intake/DocumentIntake.models");

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
 * import { intakeRefusal } from "@/intake/DocumentIntake.models"
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
 * import { IntakeResultEntry } from "@/intake/DocumentIntake.models"
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
    draftPath: S.Option(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
    message: S.Option(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
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
 * Operator-facing view of the vault-selection lifecycle, projected from the
 * intake statechart's `vault.unconfigured` states.
 *
 * **Example** (Create choosing vault state)
 *
 * ```ts
 * import { VaultSelectionState } from "@/intake/DocumentIntake.models"
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
 * @category models
 * @since 0.0.0
 */
export type VaultSelectionState = typeof VaultSelectionState.Type;

/**
 * Whether the workspace vault configuration is known, and what it says.
 *
 * **Details**
 *
 * One literal domain replaces the former `configured` / `needsOnboarding`
 * boolean pair, whose both-false combination hid two different situations:
 * the configuration still loading, and the configuration read having failed.
 *
 * **Example** (Inspect vault statuses)
 *
 * ```ts
 * import { DocumentIntakeVaultStatus } from "@/intake/DocumentIntake.models"
 *
 * console.log(DocumentIntakeVaultStatus.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocumentIntakeVaultStatus = LiteralKit(["pending", "configured", "needs-onboarding", "unavailable"]).pipe(
  $I.annoteSchema("DocumentIntakeVaultStatus", {
    description: "Whether the workspace vault configuration is loading, present, absent, or unreadable.",
  })
);

/**
 * Runtime type for {@link DocumentIntakeVaultStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentIntakeVaultStatus = typeof DocumentIntakeVaultStatus.Type;

/**
 * Per-workspace renderer view of document intake, projected from the intake
 * statechart snapshot.
 *
 * **Example** (Read the initial intake view)
 *
 * ```ts
 * import { DocumentIntakeState } from "@/intake/DocumentIntake.models"
 *
 * console.log(DocumentIntakeState.initial.isDragging) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentIntakeState extends S.Class<DocumentIntakeState>($I`DocumentIntakeState`)(
  {
    activeBatches: S.Natural,
    isDragging: S.Boolean,
    results: S.Array(IntakeResultEntry),
    vaultSelection: VaultSelectionState,
  },
  $I.annote("DocumentIntakeState", {
    description: "Renderer-facing document intake progress, results, and operator status.",
  })
) {
  /**
   * The view shown before the intake actor has produced its first snapshot.
   */
  static readonly initial = DocumentIntakeState.make({
    activeBatches: S.Natural.make(0),
    isDragging: false,
    results: [],
    vaultSelection: VaultSelectionState.cases.idle.make(),
  });
}

/**
 * Browser-side dropped document input before the default filing context is attached.
 *
 * **Example** (Create dropped document input)
 *
 * ```ts
 * import { IntakeBatchId } from "@beep/documents-domain/aggregates/IntakeBatch"
 * import { DroppedDocumentInput } from "@/intake/DocumentIntake.models"
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
 * import { DroppedDocumentInput, intakeDroppedFilePayload } from "@/intake/DocumentIntake.models"
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
 * import { VaultDirectoryPickerInvocationError } from "@/intake/DocumentIntake.models"
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
    cause: S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent)),
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
 * import { BrowserFileReadError } from "@/intake/DocumentIntake.models"
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
    cause: S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent)),
  },
  $I.annoteError<BrowserFileReadError>("BrowserFileReadError", {
    description: "Technical failure raised while reading a browser File into memory.",
  })
) {}

/**
 * Browser `File` handed to desktop intake by a drop or the hidden file input.
 *
 * @category models
 * @since 0.0.0
 */
const IntakeFile = S.instanceOf(File).pipe(
  $I.annoteSchema("IntakeFile", {
    description: "Browser File handed to desktop intake by a drop or the hidden file input.",
  })
);

/**
 * Derive the intake batch identifier sent with every file of one drop.
 *
 * **Example** (Derive a batch id)
 *
 * ```ts
 * import { batchIdFor } from "@/intake/DocumentIntake.models"
 *
 * console.log(batchIdFor([new File(["text"], "Brief.txt")]))
 * ```
 *
 * @param files - Files dropped or selected together.
 * @returns A batch identifier derived from the batch size and first file name.
 * @category identifiers
 * @since 0.0.0
 */
export const batchIdFor = (files: ReadonlyArray<File>): IntakeBatchId =>
  IntakeBatchId.make(
    `batch-${A.length(files)}-${A.head(files).pipe(
      O.map((file) => file.name),
      O.filter(Str.isNonEmpty),
      O.getOrElse(() => "drop"),
      slugVaultSegment
    )}`
  );

/**
 * Name a file for reporting and payloads, substituting a label for an unnamed file.
 *
 * **Example** (Name an unnamed file)
 *
 * ```ts
 * import { nonEmptyFileName } from "@/intake/DocumentIntake.models"
 *
 * console.log(nonEmptyFileName(new File(["text"], ""))) // "document"
 * ```
 *
 * @param file - File to name.
 * @returns The file name, or `"document"` when the browser reports none.
 * @category identifiers
 * @since 0.0.0
 */
export const nonEmptyFileName = (file: File): string =>
  O.liftPredicate(file.name, Str.isNonEmpty).pipe(O.getOrElse(() => "document"));

/**
 * Ordinal of a batch within one intake actor, used as the spawned child's key.
 *
 * **Details**
 *
 * `IntakeBatchId` is derived from the dropped files, so dropping the same files
 * twice yields the same id. The sequence keeps two such live batches distinct.
 *
 * @category models
 * @since 0.0.0
 */
const IntakeBatchSequence = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("IntakeBatchSequence", {
    description: "One-based ordinal of a batch within one document intake actor.",
  })
);

/**
 * Input of one intake batch actor: the files of one drop and where they go.
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeBatchInput extends S.Class<IntakeBatchInput>($I`IntakeBatchInput`)(
  {
    intakeBatchId: IntakeBatchId,
    workspaceId: WorkspaceIdentity.WorkspaceId,
    files: S.Array(IntakeFile),
  },
  $I.annote("IntakeBatchInput", {
    description: "Files of one drop together with the batch and workspace they belong to.",
  })
) {}

/**
 * Context of one intake batch actor: its input, a cursor over the files and
 * the outcomes recorded so far.
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeBatchContext extends S.Class<IntakeBatchContext>($I`IntakeBatchContext`)(
  {
    ...IntakeBatchInput.fields,
    cursor: S.Int,
    entries: S.Array(IntakeResultEntry),
    current: S.optionalKey(IntakeFile),
  },
  $I.annote("IntakeBatchContext", {
    description: "Batch input plus the file cursor and the per-file outcomes recorded so far.",
  })
) {}

/**
 * Final output of one intake batch actor.
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeBatchOutput extends S.Class<IntakeBatchOutput>($I`IntakeBatchOutput`)(
  {
    intakeBatchId: IntakeBatchId,
    entries: S.Array(IntakeResultEntry),
  },
  $I.annote("IntakeBatchOutput", {
    description: "Per-file outcomes of a settled intake batch, in file order.",
  })
) {}

/**
 * Per-state context of the batch states that work on one file: the file is present.
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeCurrentFileContext extends S.Class<IntakeCurrentFileContext>($I`IntakeCurrentFileContext`)(
  { current: IntakeFile },
  $I.annote("IntakeCurrentFileContext", {
    description: "Context refinement of the batch states that refuse, read or submit one file.",
  })
) {}

/**
 * Input of the file-read actor.
 *
 * @category models
 * @since 0.0.0
 */
export class ReadFileInput extends S.Class<ReadFileInput>($I`ReadFileInput`)(
  { file: IntakeFile },
  $I.annote("ReadFileInput", {
    description: "The browser file whose bytes are read into memory.",
  })
) {}

/**
 * State input of the batch `refused` state: why the file was refused.
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeRefusedStateInput extends S.Class<IntakeRefusedStateInput>($I`IntakeRefusedStateInput`)(
  { message: S.NonEmptyString },
  $I.annote("IntakeRefusedStateInput", {
    description: "Operator-facing reason a file was refused before it was read.",
  })
) {}

/**
 * State input of the batch `submitting` state: the bytes of the current file.
 *
 * **Details**
 *
 * Bytes travel as state input so they never enter the actor's context, which
 * snapshots, inspection and persistence all read.
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeSubmittingStateInput extends S.Class<IntakeSubmittingStateInput>($I`IntakeSubmittingStateInput`)(
  { content: S.Uint8Array },
  $I.annote("IntakeSubmittingStateInput", {
    description: "Bytes of the file being submitted.",
  })
) {}

/**
 * Notifications an intake batch actor emits while it works.
 *
 * @category models
 * @since 0.0.0
 */
export const IntakeBatchEmitted = {
  "file.result": S.Struct({ entry: IntakeResultEntry }),
};

/**
 * Input of the document intake actor.
 *
 * **Example** (Create intake input)
 *
 * ```ts
 * import { DocumentIntakeInput } from "@/intake/DocumentIntake.models"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 *
 * const input = DocumentIntakeInput.make({ workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID })
 * console.log(input.configRetryBaseMillis) // 2000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentIntakeInput extends S.Class<DocumentIntakeInput>($I`DocumentIntakeInput`)(
  {
    workspaceId: WorkspaceIdentity.WorkspaceId,
    configRetryBaseMillis: S.Int.pipe(S.withConstructorDefault(Effect.succeed(2000))).annotateKey({
      description: "First retry delay after a failed vault configuration read; later retries double it.",
    }),
  },
  $I.annote("DocumentIntakeInput", {
    description: "Workspace and retry timing a document intake actor starts with.",
  })
) {}

/**
 * Context of the document intake actor.
 *
 * **Details**
 *
 * `vaultFailure` is an optional key that the `vault.unconfigured.failed` state
 * narrows to a required one through its per-state context schema.
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentIntakeContext extends S.Class<DocumentIntakeContext>($I`DocumentIntakeContext`)(
  {
    workspaceId: WorkspaceIdentity.WorkspaceId,
    configRetryBaseMillis: S.Int,
    configAttempt: S.Int,
    batchSequence: S.Int,
    liveBatches: S.Array(IntakeBatchSequence),
    results: S.Array(IntakeResultEntry),
    manualDraftPath: S.Option(S.NonEmptyString),
    manualMessage: S.Option(S.NonEmptyString),
    vaultFailure: S.optionalKey(S.NonEmptyString),
  },
  $I.annote("DocumentIntakeContext", {
    description: "Workspace, retry bookkeeping, live batches, results and vault-selection form data.",
  })
) {}

/**
 * Per-state context of `vault.unconfigured.failed`: the failure message is present.
 *
 * @category models
 * @since 0.0.0
 */
export class VaultFailureContext extends S.Class<VaultFailureContext>($I`VaultFailureContext`)(
  { vaultFailure: S.NonEmptyString },
  $I.annote("VaultFailureContext", {
    description: "Context refinement of the failed vault-selection state.",
  })
) {}

/**
 * State input of the two `saving` states: the vault root being persisted.
 *
 * @category models
 * @since 0.0.0
 */
export class VaultSavingStateInput extends S.Class<VaultSavingStateInput>($I`VaultSavingStateInput`)(
  { vaultRootPath: S.NonEmptyString },
  $I.annote("VaultSavingStateInput", {
    description: "Trimmed vault root path a saving state persists.",
  })
) {}

/**
 * State input of the picker `saveFailed` state: the operator-safe failure message.
 *
 * @category models
 * @since 0.0.0
 */
export class VaultFailureStateInput extends S.Class<VaultFailureStateInput>($I`VaultFailureStateInput`)(
  { message: S.NonEmptyString },
  $I.annote("VaultFailureStateInput", {
    description: "Operator-safe message a failed vault save carries into its final state.",
  })
) {}

class PickerOutcomeCancelled extends S.Class<PickerOutcomeCancelled>($I`PickerOutcomeCancelled`)(
  { kind: S.tag("cancelled") },
  $I.annote("PickerOutcomeCancelled", {
    description: "The operator closed the folder picker without choosing a folder.",
  })
) {}

class PickerOutcomeSaved extends S.Class<PickerOutcomeSaved>($I`PickerOutcomeSaved`)(
  { kind: S.tag("saved") },
  $I.annote("PickerOutcomeSaved", {
    description: "The picked folder was persisted as the workspace vault root.",
  })
) {}

class PickerOutcomeFailed extends S.Class<PickerOutcomeFailed>($I`PickerOutcomeFailed`)(
  { kind: S.tag("failed"), message: S.NonEmptyString },
  $I.annote("PickerOutcomeFailed", {
    description: "The picker could not open, or the picked folder could not be persisted.",
  })
) {}

class PickerOutcomeManual extends S.Class<PickerOutcomeManual>($I`PickerOutcomeManual`)(
  { kind: S.tag("manual") },
  $I.annote("PickerOutcomeManual", {
    description: "No native folder picker is reachable, so the manual path form is needed.",
  })
) {}

const PickerOutcomeKind = LiteralKit(["cancelled", "saved", "failed", "manual"]).pipe(
  $I.annoteSchema("PickerOutcomeKind", {
    description: "Exhaustive ways the picker flow can finish.",
  })
);

/**
 * Output of the `picker` compound state: how one picker flow finished.
 *
 * **Details**
 *
 * Each final child of `picker` produces one case, and the parent state's
 * `onDone` routes on it. The picker flow therefore never names a state outside
 * itself.
 *
 * **Example** (Create a failed outcome)
 *
 * ```ts
 * import { PickerOutcome } from "@/intake/DocumentIntake.models"
 *
 * const outcome = PickerOutcome.cases.failed.make({ message: "The folder picker could not be opened." })
 * console.log(outcome.kind) // "failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PickerOutcome = PickerOutcomeKind.mapMembers(
  Tuple.evolve([
    () => PickerOutcomeCancelled,
    () => PickerOutcomeSaved,
    () => PickerOutcomeFailed,
    () => PickerOutcomeManual,
  ])
)
  .annotate(
    $I.annote("PickerOutcome", {
      description: "How one native or sidecar vault picker flow finished.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));

class ManualOutcomeCancelled extends S.Class<ManualOutcomeCancelled>($I`ManualOutcomeCancelled`)(
  { kind: S.tag("cancelled") },
  $I.annote("ManualOutcomeCancelled", {
    description: "The operator dismissed the manual vault path form.",
  })
) {}

class ManualOutcomeSaved extends S.Class<ManualOutcomeSaved>($I`ManualOutcomeSaved`)(
  { kind: S.tag("saved") },
  $I.annote("ManualOutcomeSaved", {
    description: "The typed path was persisted as the workspace vault root.",
  })
) {}

const ManualOutcomeKind = LiteralKit(["cancelled", "saved"]).pipe(
  $I.annoteSchema("ManualOutcomeKind", {
    description: "Exhaustive ways the manual vault path form can finish.",
  })
);

/**
 * Output of the `manual` compound state: how the manual path form finished.
 *
 * **Example** (Create a saved outcome)
 *
 * ```ts
 * import { ManualOutcome } from "@/intake/DocumentIntake.models"
 *
 * console.log(ManualOutcome.cases.saved.make().kind) // "saved"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ManualOutcome = ManualOutcomeKind.mapMembers(
  Tuple.evolve([() => ManualOutcomeCancelled, () => ManualOutcomeSaved])
)
  .annotate(
    $I.annote("ManualOutcome", {
      description: "How one manual vault path entry finished.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));

/**
 * Input of the vault-root persistence actor.
 *
 * @category models
 * @since 0.0.0
 */
export class PersistVaultRootInput extends S.Class<PersistVaultRootInput>($I`PersistVaultRootInput`)(
  {
    workspaceId: WorkspaceIdentity.WorkspaceId,
    vaultRootPath: S.NonEmptyString,
  },
  $I.annote("PersistVaultRootInput", {
    description: "Workspace and vault root path to persist.",
  })
) {}

/**
 * Input of the vault configuration feed actor.
 *
 * @category models
 * @since 0.0.0
 */
export class VaultConfigFeedInput extends S.Class<VaultConfigFeedInput>($I`VaultConfigFeedInput`)(
  { workspaceId: WorkspaceIdentity.WorkspaceId },
  $I.annote("VaultConfigFeedInput", {
    description: "Workspace whose vault configuration the feed reads.",
  })
) {}

/**
 * Events the operator and the DOM send to the document intake actor.
 *
 * @category models
 * @since 0.0.0
 */
const IntakeEventType = LiteralKit([
  "CHOOSE_VAULT",
  "SUBMIT_MANUAL_PATH",
  "CANCEL_MANUAL",
  "RETRY_CONFIG",
  "DRAG_ENTER",
  "DRAG_LEAVE",
  "DROP",
  "FILES_SELECTED",
  "CLEAR_RESULTS",
]).pipe(
  $I.annoteSchema("IntakeEventType", {
    description: "Public event types accepted by the document intake actor.",
  })
);

/**
 * Runtime type for {@link IntakeEventType}.
 *
 * @category models
 * @since 0.0.0
 */
type IntakeEventType = typeof IntakeEventType.Type;

const NoPayload = S.Struct({});

const IntakeFilesPayload = S.Struct({ files: S.Array(IntakeFile) });

/**
 * Payload schema of every public intake event, keyed by event type.
 *
 * **Details**
 *
 * XState reads event schemas as a record keyed by type. The `satisfies` clause
 * keeps that record exhaustive over {@link IntakeEventType}.
 *
 * @category models
 * @since 0.0.0
 */
export const IntakeEventPayloads = {
  CHOOSE_VAULT: NoPayload,
  SUBMIT_MANUAL_PATH: S.Struct({ rawPath: S.String }),
  CANCEL_MANUAL: NoPayload,
  RETRY_CONFIG: NoPayload,
  DRAG_ENTER: NoPayload,
  DRAG_LEAVE: S.Struct({ leftSurface: S.Boolean }),
  DROP: IntakeFilesPayload,
  FILES_SELECTED: IntakeFilesPayload,
  CLEAR_RESULTS: NoPayload,
} satisfies Record<IntakeEventType, S.Constraint>;

/**
 * Payload schema of every event only the intake actor itself may raise.
 *
 * **Details**
 *
 * `VAULT_CONFIG_RESOLVED` is raised from the vault configuration feed's
 * snapshots and `BATCH_REQUESTED` from a drop or file selection. Both are
 * absent from the type of `actor.send`.
 *
 * @category models
 * @since 0.0.0
 */
export const IntakeInternalEventPayloads = {
  VAULT_CONFIG_RESOLVED: S.Struct({ vaultRootPath: S.Option(S.String) }),
  BATCH_REQUESTED: IntakeFilesPayload,
};

/**
 * Payload schema of every event a spawned batch actor relays to the intake actor.
 *
 * **Details**
 *
 * xstate rejects an internal event that crosses an actor boundary, and an
 * event mapped by `enq.listen` or `enq.subscribeTo` is delivered with the
 * child as its sender. These two therefore sit in the public protocol even
 * though the intake surface never sends them.
 *
 * @category models
 * @since 0.0.0
 */
export const IntakeBatchRelayPayloads = {
  FILE_RESULT: S.Struct({ entry: IntakeResultEntry }),
  BATCH_SETTLED: S.Struct({ sequence: IntakeBatchSequence, output: IntakeBatchOutput }),
};

/**
 * How one vault-selection attempt ended, emitted for telemetry.
 *
 * @category models
 * @since 0.0.0
 */
const VaultSelectionOutcome = LiteralKit([
  "cancelled",
  "selected",
  "picker_failure",
  "save_failure",
  "success",
  "empty_manual_path",
  "manual_path_form",
]).pipe(
  $I.annoteSchema("VaultSelectionOutcome", {
    description: "Terminal or intermediate outcome of one workspace vault selection attempt.",
  })
);

/**
 * Runtime type for {@link VaultSelectionOutcome}.
 *
 * @category models
 * @since 0.0.0
 */
export type VaultSelectionOutcome = typeof VaultSelectionOutcome.Type;

/**
 * Notifications the document intake actor emits.
 *
 * @category models
 * @since 0.0.0
 */
export const DocumentIntakeEmitted = {
  "vault.outcome": S.Struct({ outcome: VaultSelectionOutcome }),
  "batch.settled": S.Struct({ intakeBatchId: IntakeBatchId, fileCount: S.Int }),
};

/**
 * Which intake operation a logged failure belongs to.
 *
 * @category models
 * @since 0.0.0
 */
const IntakeLogAction = LiteralKit([
  "intake_file",
  "load_workspace_vault",
  "pick_workspace_vault",
  "save_workspace_vault",
]).pipe(
  $I.annoteSchema("IntakeLogAction", {
    description: "Intake operation a redacted failure log line is attributed to.",
  })
);

/**
 * Parameters of the `logIntakeCause` Effect action.
 *
 * **Example** (Create a log request)
 *
 * ```ts
 * import { IntakeLogRequest } from "@/intake/DocumentIntake.models"
 *
 * const request = IntakeLogRequest.make({
 *   action: "intake_file",
 *   cause: new Error("read failed"),
 *   message: "document intake failed"
 * })
 * console.log(request.action) // "intake_file"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeLogRequest extends S.Class<IntakeLogRequest>($I`IntakeLogRequest`)(
  {
    action: IntakeLogAction,
    cause: S.Unknown,
    message: S.NonEmptyString,
  },
  $I.annote("IntakeLogRequest", {
    description: "A failure cause with the operator-safe message and intake operation it is logged under.",
  })
) {}
