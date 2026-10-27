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
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";

const $I = $ProfessionalDesktopId.create("intake/DocumentIntake.models");

// Each intake data schema carries its own string-keyed nominal brand. The xstate machines map and intersect every
// schema reachable from their contexts, inputs, outputs and events: an anonymous `brand: unique symbol` cannot be
// named in declaration emit (TS2527), and two of them on the shared `brand` key intersect to never.

const MAX_INTAKE_FILE_BYTES = 25 * 1024 * 1024;

const formatMegabytes = (bytes: number): string => `${N.round(bytes / (1024 * 1024), 1)} MB`;

const IntakeFileSize = S.Int.check(
  S.isGreaterThanOrEqualTo(
    0,
    $I.annote("IntakeFileSizeNonNegativeCheck", {
      title: "Non-negative intake file size",
      description: "Browser file sizes are whole byte counts greater than or equal to zero.",
      message: "Expected a non-negative file size.",
    })
  )
).pipe(
  $I.annoteSchema("IntakeFileSize", {
    description: "Non-negative whole byte count reported by a browser File.",
  })
);

/**
 * Browser file metadata used by the pre-read intake refusal policy.
 *
 * **Example** (Refuse an oversized upload before reading it)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { IntakeFileMetadata, intakeRefusal } from "@/intake/DocumentIntake.models"
 *
 * const scan = IntakeFileMetadata.make({ name: "deposition-scan.pdf", size: 40 * 1024 * 1024 })
 *
 * console.log(O.isSome(intakeRefusal(scan))) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeFileMetadata extends S.Opaque<
  IntakeFileMetadata,
  { readonly "~beep/intake/IntakeFileMetadata": "IntakeFileMetadata" }
>()(
  S.Struct({
    name: S.String,
    size: IntakeFileSize,
  }).pipe(
    $I.annoteSchema("IntakeFileMetadata", {
      description: "Browser file metadata used by the pre-read intake refusal policy.",
    })
  )
) {}

/**
 * Decide whether a file must be rejected before its bytes are materialized.
 *
 * **Example** (Refuse empty file)
 *
 * ```ts
 * import { IntakeFileMetadata, intakeRefusal } from "@/intake/DocumentIntake.models"
 * import * as O from "effect/Option"
 *
 * const empty = IntakeFileMetadata.make({ name: "empty.txt", size: 0 })
 * const memo = IntakeFileMetadata.make({ name: "memo.pdf", size: 2048 })
 *
 * console.log(O.getOrNull(intakeRefusal(empty))) // This file is empty, so there is nothing to file.
 * console.log(O.isNone(intakeRefusal(memo))) // true
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

class IntakeResultEntryDocument extends S.Opaque<
  IntakeResultEntryDocument,
  { readonly "~beep/intake/IntakeResultEntryDocument": "IntakeResultEntryDocument" }
>()(
  S.Struct({
    kind: S.tag("document"),
    document: Document,
  }).pipe(
    $I.annoteSchema("IntakeResultEntryDocument", {
      description: "A document that completed the desktop intake pipeline.",
    })
  )
) {}

class IntakeResultEntryFailure extends S.Opaque<
  IntakeResultEntryFailure,
  { readonly "~beep/intake/IntakeResultEntryFailure": "IntakeResultEntryFailure" }
>()(
  S.Struct({
    kind: S.tag("failure"),
    fileName: S.NonEmptyString,
    message: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("IntakeResultEntryFailure", {
      description: "A file that was refused or failed during desktop intake.",
    })
  )
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
).pipe(
  $I.annoteSchema("IntakeResultEntry", {
    description: "Exhaustive per-file outcome emitted by desktop document intake.",
  }),
  S.toTaggedUnion("kind")
);

/**
 * Runtime type for {@link IntakeResultEntry}.
 *
 * @category models
 * @since 0.0.0
 */
export type IntakeResultEntry = typeof IntakeResultEntry.Type;

class VaultSelectionIdle extends S.Opaque<
  VaultSelectionIdle,
  { readonly "~beep/intake/VaultSelectionIdle": "VaultSelectionIdle" }
>()(
  S.Struct({ kind: S.tag("idle") }).pipe(
    $I.annoteSchema("VaultSelectionIdle", {
      description: "Workspace vault selection is ready for an operator request.",
    })
  )
) {}

class VaultSelectionChoosing extends S.Opaque<
  VaultSelectionChoosing,
  { readonly "~beep/intake/VaultSelectionChoosing": "VaultSelectionChoosing" }
>()(
  S.Struct({ kind: S.tag("choosing") }).pipe(
    $I.annoteSchema("VaultSelectionChoosing", {
      description: "A native workspace vault picker is currently open.",
    })
  )
) {}

class VaultSelectionManual extends S.Opaque<
  VaultSelectionManual,
  { readonly "~beep/intake/VaultSelectionManual": "VaultSelectionManual" }
>()(
  S.Struct({
    kind: S.tag("manual"),
    // A rejected path is retained so the reopened form does not force the
    // operator to retype it (the saving state unmounts the form in between).
    draftPath: S.Option(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
    message: S.Option(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("VaultSelectionManual", {
      description: "A manual vault-path form is open because no native folder picker is available.",
    })
  )
) {}

class VaultSelectionSaving extends S.Opaque<
  VaultSelectionSaving,
  { readonly "~beep/intake/VaultSelectionSaving": "VaultSelectionSaving" }
>()(
  S.Struct({ kind: S.tag("saving") }).pipe(
    $I.annoteSchema("VaultSelectionSaving", {
      description: "The selected workspace vault root is being persisted.",
    })
  )
) {}

class VaultSelectionFailed extends S.Opaque<
  VaultSelectionFailed,
  { readonly "~beep/intake/VaultSelectionFailed": "VaultSelectionFailed" }
>()(
  S.Struct({
    kind: S.tag("failed"),
    message: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("VaultSelectionFailed", {
      description: "Workspace vault selection failed with an operator-safe message.",
    })
  )
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
 * const state = VaultSelectionState.cases.choosing.make({})
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
).pipe(
  $I.annoteSchema("VaultSelectionState", {
    description: "Workspace vault picker and persistence lifecycle state.",
  }),
  S.toTaggedUnion("kind")
);

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
export class DocumentIntakeState extends S.Opaque<
  DocumentIntakeState,
  { readonly "~beep/intake/DocumentIntakeState": "DocumentIntakeState" }
>()(
  S.Struct({
    activeBatches: S.Natural,
    isDragging: S.Boolean,
    results: S.Array(IntakeResultEntry),
    vaultSelection: VaultSelectionState,
  }).pipe(
    $I.annoteSchema("DocumentIntakeState", {
      description: "Renderer-facing document intake progress, results, and operator status.",
    })
  )
) {
  /**
   * The view shown before the intake actor has produced its first snapshot.
   */
  static readonly initial = DocumentIntakeState.make({
    activeBatches: S.Natural.make(0),
    isDragging: false,
    results: [],
    vaultSelection: VaultSelectionState.cases.idle.make({}),
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
export class DroppedDocumentInput extends S.Opaque<
  DroppedDocumentInput,
  { readonly "~beep/intake/DroppedDocumentInput": "DroppedDocumentInput" }
>()(
  S.Struct({
    content: S.Uint8ArrayFromBase64,
    intakeBatchId: IntakeBatchId,
    originalFileName: S.NonEmptyString,
    workspaceId: WorkspaceIdentity.WorkspaceId,
  }).pipe(
    $I.annoteSchema("DroppedDocumentInput", {
      description: "Browser-side dropped document input.",
    })
  )
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
export class VaultDirectoryPickerInvocationError extends S.TaggedError<
  VaultDirectoryPickerInvocationError,
  { readonly brand: unique symbol }
>($I`VaultDirectoryPickerInvocationError`)(
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
export class BrowserFileReadError extends S.TaggedError<BrowserFileReadError, { readonly brand: unique symbol }>(
  $I`BrowserFileReadError`
)(
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
 * **Details**
 *
 * The identifier starts with the batch's one-based `sequence` within the
 * intake actor, so two drops of the same files never share an inbox folder
 * (`projectInboxDocumentPath` keys the folder on this id). The file count and
 * a slug of the first file name follow so a developer can read it.
 *
 * **Example** (Derive a batch id)
 *
 * ```ts
 * import { batchIdFor } from "@/intake/DocumentIntake.models"
 * import { pipe } from "effect/Function"
 *
 * const files = [new File(["text"], "Brief.txt")]
 * console.log(batchIdFor(files, 1))
 * console.log(pipe(files, batchIdFor(2)))
 * ```
 *
 * @param files - Files dropped or selected together.
 * @param sequence - One-based ordinal of the batch within its intake actor.
 * @returns A batch identifier unique per drop within one intake actor.
 * @category identifiers
 * @since 0.0.0
 */
export const batchIdFor: {
  (sequence: number): (files: ReadonlyArray<File>) => IntakeBatchId;
  (files: ReadonlyArray<File>, sequence: number): IntakeBatchId;
} = dual(
  2,
  (files: ReadonlyArray<File>, sequence: number): IntakeBatchId =>
    IntakeBatchId.make(
      `batch-${sequence}-${A.length(files)}-${A.head(files).pipe(
        O.map((file) => file.name),
        O.filter(Str.isNonEmpty),
        O.getOrElse(() => "drop"),
        slugVaultSegment
      )}`
    )
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
 * **Example** (Create batch input)
 *
 * ```ts
 * import { IntakeBatchInput, batchIdFor } from "@/intake/DocumentIntake.models"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 *
 * const files = [new File(["text"], "Brief.txt")]
 * const input = IntakeBatchInput.make({
 *   intakeBatchId: batchIdFor(files, 1),
 *   workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID,
 *   files
 * })
 * console.log(input.files.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeBatchInput extends S.Opaque<
  IntakeBatchInput,
  { readonly "~beep/intake/IntakeBatchInput": "IntakeBatchInput" }
>()(
  S.Struct({
    intakeBatchId: IntakeBatchId,
    workspaceId: WorkspaceIdentity.WorkspaceId,
    files: S.Array(IntakeFile),
  }).pipe(
    $I.annoteSchema("IntakeBatchInput", {
      description: "Files of one drop together with the batch and workspace they belong to.",
    })
  )
) {}

/**
 * Context of one intake batch actor: its input, a cursor over the files and
 * the outcomes recorded so far.
 *
 * **Example** (Create the initial batch context)
 *
 * ```ts
 * import { IntakeBatchContext, batchIdFor } from "@/intake/DocumentIntake.models"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 *
 * const files = [new File(["text"], "Brief.txt")]
 * const context = IntakeBatchContext.make({
 *   intakeBatchId: batchIdFor(files, 1),
 *   workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID,
 *   files,
 *   cursor: 0,
 *   entries: []
 * })
 * console.log(context.cursor) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeBatchContext extends S.Opaque<
  IntakeBatchContext,
  { readonly "~beep/intake/IntakeBatchContext": "IntakeBatchContext" }
>()(
  S.Struct({
    ...IntakeBatchInput.fields,
    cursor: S.Int,
    entries: S.Array(IntakeResultEntry),
    current: S.optionalKey(IntakeFile),
  }).pipe(
    $I.annoteSchema("IntakeBatchContext", {
      description: "Batch input plus the file cursor and the per-file outcomes recorded so far.",
    })
  )
) {}

/**
 * Final output of one intake batch actor.
 *
 * **Example** (Create a settled batch output)
 *
 * ```ts
 * import { IntakeBatchId } from "@beep/documents-domain/aggregates/IntakeBatch"
 * import { IntakeBatchOutput, IntakeResultEntry } from "@/intake/DocumentIntake.models"
 *
 * const output = IntakeBatchOutput.make({
 *   intakeBatchId: IntakeBatchId.make("batch-1"),
 *   entries: [IntakeResultEntry.cases.failure.make({ fileName: "empty.txt", message: "This file is empty." })]
 * })
 * console.log(output.entries.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeBatchOutput extends S.Opaque<
  IntakeBatchOutput,
  { readonly "~beep/intake/IntakeBatchOutput": "IntakeBatchOutput" }
>()(
  S.Struct({
    intakeBatchId: IntakeBatchId,
    entries: S.Array(IntakeResultEntry),
  }).pipe(
    $I.annoteSchema("IntakeBatchOutput", {
      description: "Per-file outcomes of a settled intake batch, in file order.",
    })
  )
) {}

/**
 * Per-state context of the batch states that work on one file: the file is present.
 *
 * **Example** (Narrow the context to one file)
 *
 * ```ts
 * import { IntakeCurrentFileContext } from "@/intake/DocumentIntake.models"
 *
 * const context = IntakeCurrentFileContext.make({ current: new File(["text"], "Brief.txt") })
 * console.log(context.current.name) // "Brief.txt"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeCurrentFileContext extends S.Opaque<
  IntakeCurrentFileContext,
  { readonly "~beep/intake/IntakeCurrentFileContext": "IntakeCurrentFileContext" }
>()(
  S.Struct({ current: IntakeFile }).pipe(
    $I.annoteSchema("IntakeCurrentFileContext", {
      description: "Context refinement of the batch states that refuse, read or submit one file.",
    })
  )
) {}

/**
 * Input of the file-read actor.
 *
 * **Example** (Create file-read input)
 *
 * ```ts
 * import { ReadFileInput } from "@/intake/DocumentIntake.models"
 *
 * const input = ReadFileInput.make({ file: new File(["text"], "Brief.txt") })
 * console.log(input.file.name) // "Brief.txt"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReadFileInput extends S.Opaque<
  ReadFileInput,
  { readonly "~beep/intake/ReadFileInput": "ReadFileInput" }
>()(
  S.Struct({ file: IntakeFile }).pipe(
    $I.annoteSchema("ReadFileInput", {
      description: "The browser file whose bytes are read into memory.",
    })
  )
) {}

/**
 * State input of the batch `refused` state: why the file was refused.
 *
 * **Example** (Create refused state input)
 *
 * ```ts
 * import { IntakeRefusedStateInput } from "@/intake/DocumentIntake.models"
 *
 * const input = IntakeRefusedStateInput.make({ message: "This file is empty." })
 * console.log(input.message)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeRefusedStateInput extends S.Opaque<
  IntakeRefusedStateInput,
  { readonly "~beep/intake/IntakeRefusedStateInput": "IntakeRefusedStateInput" }
>()(
  S.Struct({ message: S.NonEmptyString }).pipe(
    $I.annoteSchema("IntakeRefusedStateInput", {
      description: "Operator-facing reason a file was refused before it was read.",
    })
  )
) {}

/**
 * State input of the batch `submitting` state: the bytes of the current file.
 *
 * **Details**
 *
 * Bytes travel as state input so they never enter the actor's context, which
 * snapshots, inspection and persistence all read.
 *
 * **Example** (Create submitting state input)
 *
 * ```ts
 * import { IntakeSubmittingStateInput } from "@/intake/DocumentIntake.models"
 *
 * const input = IntakeSubmittingStateInput.make({ content: new Uint8Array([1, 2, 3]) })
 * console.log(input.content.byteLength) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeSubmittingStateInput extends S.Opaque<
  IntakeSubmittingStateInput,
  { readonly "~beep/intake/IntakeSubmittingStateInput": "IntakeSubmittingStateInput" }
>()(
  S.Struct({ content: S.Uint8Array }).pipe(
    $I.annoteSchema("IntakeSubmittingStateInput", {
      description: "Bytes of the file being submitted.",
    })
  )
) {}

/**
 * Notifications an intake batch actor emits while it works.
 *
 * **Example** (Check a file result notification)
 *
 * ```ts
 * import { IntakeBatchEmitted, IntakeResultEntry } from "@/intake/DocumentIntake.models"
 * import * as S from "effect/Schema"
 *
 * const entry = IntakeResultEntry.cases.failure.make({ fileName: "empty.txt", message: "This file is empty." })
 * console.log(S.is(IntakeBatchEmitted["file.result"])({ entry })) // true
 * ```
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
export class DocumentIntakeInput extends S.Opaque<
  DocumentIntakeInput,
  { readonly "~beep/intake/DocumentIntakeInput": "DocumentIntakeInput" }
>()(
  S.Struct({
    workspaceId: WorkspaceIdentity.WorkspaceId,
    configRetryBaseMillis: S.Int.pipe(S.withConstructorDefault(Effect.succeed(2000))).annotateKey({
      description: "First retry delay after a failed vault configuration read; later retries double it.",
    }),
  }).pipe(
    $I.annoteSchema("DocumentIntakeInput", {
      description: "Workspace and retry timing a document intake actor starts with.",
    })
  )
) {}

/**
 * Context of the document intake actor.
 *
 * **Details**
 *
 * `vaultFailure` is an optional key that the `vault.unconfigured.failed` state
 * narrows to a required one through its per-state context schema.
 *
 * **Example** (Create the initial intake context)
 *
 * ```ts
 * import { DocumentIntakeContext } from "@/intake/DocumentIntake.models"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 * import * as O from "effect/Option"
 *
 * const context = DocumentIntakeContext.make({
 *   workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID,
 *   configRetryBaseMillis: 2000,
 *   configAttempt: 0,
 *   batchSequence: 0,
 *   liveBatches: [],
 *   results: [],
 *   manualDraftPath: O.none(),
 *   manualMessage: O.none()
 * })
 * console.log(context.liveBatches.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentIntakeContext extends S.Opaque<
  DocumentIntakeContext,
  { readonly "~beep/intake/DocumentIntakeContext": "DocumentIntakeContext" }
>()(
  S.Struct({
    workspaceId: WorkspaceIdentity.WorkspaceId,
    configRetryBaseMillis: S.Int,
    configAttempt: S.Int,
    batchSequence: S.Int,
    liveBatches: S.Array(IntakeBatchSequence),
    results: S.Array(IntakeResultEntry),
    manualDraftPath: S.Option(S.NonEmptyString),
    manualMessage: S.Option(S.NonEmptyString),
    vaultFailure: S.optionalKey(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("DocumentIntakeContext", {
      description: "Workspace, retry bookkeeping, live batches, results and vault-selection form data.",
    })
  )
) {}

/**
 * Per-state context of `vault.unconfigured.failed`: the failure message is present.
 *
 * **Example** (Narrow the context to a failure)
 *
 * ```ts
 * import { VaultFailureContext } from "@/intake/DocumentIntake.models"
 *
 * const context = VaultFailureContext.make({ vaultFailure: "Vault store unavailable." })
 * console.log(context.vaultFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VaultFailureContext extends S.Opaque<
  VaultFailureContext,
  { readonly "~beep/intake/VaultFailureContext": "VaultFailureContext" }
>()(
  S.Struct({ vaultFailure: S.NonEmptyString }).pipe(
    $I.annoteSchema("VaultFailureContext", {
      description: "Context refinement of the failed vault-selection state.",
    })
  )
) {}

/**
 * State input of the two `saving` states: the vault root being persisted.
 *
 * **Example** (Create saving state input)
 *
 * ```ts
 * import { VaultSavingStateInput } from "@/intake/DocumentIntake.models"
 *
 * const input = VaultSavingStateInput.make({ vaultRootPath: "/vault" })
 * console.log(input.vaultRootPath) // "/vault"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VaultSavingStateInput extends S.Opaque<
  VaultSavingStateInput,
  { readonly "~beep/intake/VaultSavingStateInput": "VaultSavingStateInput" }
>()(
  S.Struct({ vaultRootPath: S.NonEmptyString }).pipe(
    $I.annoteSchema("VaultSavingStateInput", {
      description: "Trimmed vault root path a saving state persists.",
    })
  )
) {}

/**
 * State input of the picker `saveFailed` state: the operator-safe failure message.
 *
 * **Example** (Create save-failed state input)
 *
 * ```ts
 * import { VaultFailureStateInput } from "@/intake/DocumentIntake.models"
 *
 * const input = VaultFailureStateInput.make({ message: "Vault store unavailable." })
 * console.log(input.message)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VaultFailureStateInput extends S.Opaque<
  VaultFailureStateInput,
  { readonly "~beep/intake/VaultFailureStateInput": "VaultFailureStateInput" }
>()(
  S.Struct({ message: S.NonEmptyString }).pipe(
    $I.annoteSchema("VaultFailureStateInput", {
      description: "Operator-safe message a failed vault save carries into its final state.",
    })
  )
) {}

class PickerOutcomeCancelled extends S.Opaque<
  PickerOutcomeCancelled,
  { readonly "~beep/intake/PickerOutcomeCancelled": "PickerOutcomeCancelled" }
>()(
  S.Struct({ kind: S.tag("cancelled") }).pipe(
    $I.annoteSchema("PickerOutcomeCancelled", {
      description: "The operator closed the folder picker without choosing a folder.",
    })
  )
) {}

class PickerOutcomeSaved extends S.Opaque<
  PickerOutcomeSaved,
  { readonly "~beep/intake/PickerOutcomeSaved": "PickerOutcomeSaved" }
>()(
  S.Struct({ kind: S.tag("saved") }).pipe(
    $I.annoteSchema("PickerOutcomeSaved", {
      description: "The picked folder was persisted as the workspace vault root.",
    })
  )
) {}

class PickerOutcomeFailed extends S.Opaque<
  PickerOutcomeFailed,
  { readonly "~beep/intake/PickerOutcomeFailed": "PickerOutcomeFailed" }
>()(
  S.Struct({ kind: S.tag("failed"), message: S.NonEmptyString }).pipe(
    $I.annoteSchema("PickerOutcomeFailed", {
      description: "The picker could not open, or the picked folder could not be persisted.",
    })
  )
) {}

class PickerOutcomeManual extends S.Opaque<
  PickerOutcomeManual,
  { readonly "~beep/intake/PickerOutcomeManual": "PickerOutcomeManual" }
>()(
  S.Struct({ kind: S.tag("manual") }).pipe(
    $I.annoteSchema("PickerOutcomeManual", {
      description: "No native folder picker is reachable, so the manual path form is needed.",
    })
  )
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
).pipe(
  $I.annoteSchema("PickerOutcome", {
    description: "How one native or sidecar vault picker flow finished.",
  }),
  S.toTaggedUnion("kind")
);

class ManualOutcomeCancelled extends S.Opaque<
  ManualOutcomeCancelled,
  { readonly "~beep/intake/ManualOutcomeCancelled": "ManualOutcomeCancelled" }
>()(
  S.Struct({ kind: S.tag("cancelled") }).pipe(
    $I.annoteSchema("ManualOutcomeCancelled", {
      description: "The operator dismissed the manual vault path form.",
    })
  )
) {}

class ManualOutcomeSaved extends S.Opaque<
  ManualOutcomeSaved,
  { readonly "~beep/intake/ManualOutcomeSaved": "ManualOutcomeSaved" }
>()(
  S.Struct({ kind: S.tag("saved") }).pipe(
    $I.annoteSchema("ManualOutcomeSaved", {
      description: "The typed path was persisted as the workspace vault root.",
    })
  )
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
 * console.log(ManualOutcome.cases.saved.make({}).kind) // "saved"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ManualOutcome = ManualOutcomeKind.mapMembers(
  Tuple.evolve([() => ManualOutcomeCancelled, () => ManualOutcomeSaved])
).pipe(
  $I.annoteSchema("ManualOutcome", {
    description: "How one manual vault path entry finished.",
  }),
  S.toTaggedUnion("kind")
);

/**
 * Input of the vault-root persistence actor.
 *
 * **Example** (Create persistence input)
 *
 * ```ts
 * import { PersistVaultRootInput } from "@/intake/DocumentIntake.models"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 *
 * const input = PersistVaultRootInput.make({ workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID, vaultRootPath: "/vault" })
 * console.log(input.vaultRootPath) // "/vault"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PersistVaultRootInput extends S.Opaque<
  PersistVaultRootInput,
  { readonly "~beep/intake/PersistVaultRootInput": "PersistVaultRootInput" }
>()(
  S.Struct({
    workspaceId: WorkspaceIdentity.WorkspaceId,
    vaultRootPath: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("PersistVaultRootInput", {
      description: "Workspace and vault root path to persist.",
    })
  )
) {}

/**
 * Input of the vault configuration feed actor.
 *
 * **Example** (Create feed input)
 *
 * ```ts
 * import { VaultConfigFeedInput } from "@/intake/DocumentIntake.models"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 *
 * const input = VaultConfigFeedInput.make({ workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID })
 * console.log(input.workspaceId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VaultConfigFeedInput extends S.Opaque<
  VaultConfigFeedInput,
  { readonly "~beep/intake/VaultConfigFeedInput": "VaultConfigFeedInput" }
>()(
  S.Struct({ workspaceId: WorkspaceIdentity.WorkspaceId }).pipe(
    $I.annoteSchema("VaultConfigFeedInput", {
      description: "Workspace whose vault configuration the feed reads.",
    })
  )
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
 * **Example** (Check a public event payload)
 *
 * ```ts
 * import { IntakeEventPayloads } from "@/intake/DocumentIntake.models"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(IntakeEventPayloads.DRAG_LEAVE)({ leftSurface: true })) // true
 * ```
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
 * **Example** (Check an internal event payload)
 *
 * ```ts
 * import { IntakeInternalEventPayloads } from "@/intake/DocumentIntake.models"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(IntakeInternalEventPayloads.VAULT_CONFIG_RESOLVED)({ vaultRootPath: O.some("/vault") })) // true
 * ```
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
 * **Example** (Check a relayed file result)
 *
 * ```ts
 * import { IntakeBatchRelayPayloads, IntakeResultEntry } from "@/intake/DocumentIntake.models"
 * import * as S from "effect/Schema"
 *
 * const entry = IntakeResultEntry.cases.failure.make({ fileName: "empty.txt", message: "This file is empty." })
 * console.log(S.is(IntakeBatchRelayPayloads.FILE_RESULT)({ entry })) // true
 * ```
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
 * **Example** (Check a settled-batch notification)
 *
 * ```ts
 * import { IntakeBatchId } from "@beep/documents-domain/aggregates/IntakeBatch"
 * import { DocumentIntakeEmitted } from "@/intake/DocumentIntake.models"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(DocumentIntakeEmitted["batch.settled"])({ intakeBatchId: IntakeBatchId.make("batch-1"), fileCount: 1 })) // true
 * ```
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
export class IntakeLogRequest extends S.Opaque<
  IntakeLogRequest,
  { readonly "~beep/intake/IntakeLogRequest": "IntakeLogRequest" }
>()(
  S.Struct({
    action: IntakeLogAction,
    cause: S.Unknown,
    message: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("IntakeLogRequest", {
      description: "A failure cause with the operator-safe message and intake operation it is logged under.",
    })
  )
) {}
