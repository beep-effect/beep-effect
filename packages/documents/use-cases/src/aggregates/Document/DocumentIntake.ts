/**
 * Document intake service contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IntakeBatchId } from "@beep/documents-domain/aggregates/IntakeBatch";
import { VaultFilingContext } from "@beep/documents-domain/values/Taxonomy";
import { $DocumentsUseCasesId } from "@beep/identity/packages";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { Context } from "effect";
import * as S from "effect/Schema";
import type { Document } from "@beep/documents-domain/aggregates/Document";
import type { Effect } from "effect";
import type { DocumentIntakeError } from "./Document.errors.ts";

const $I = $DocumentsUseCasesId.create("aggregates/Document/DocumentIntake");

/**
 * Client payload for app-level dropped-file intake.
 *
 * @example
 * ```ts
 * import { DefaultVaultFilingContext } from "@beep/documents-domain/values/Taxonomy"
 * import { IntakeDroppedFilePayload } from "@beep/documents-use-cases/public"
 * import { IntakeBatchId } from "@beep/documents-domain/aggregates/IntakeBatch"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const payload = IntakeDroppedFilePayload.make({
 *   content: new Uint8Array([1, 2, 3]),
 *   filingContext: DefaultVaultFilingContext,
 *   intakeBatchId: S.decodeUnknownSync(IntakeBatchId)("batch-20260709"),
 *   originalFileName: "complaint.pdf",
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(payload.originalFileName)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export class IntakeDroppedFilePayload extends S.Class<IntakeDroppedFilePayload>($I`IntakeDroppedFilePayload`)(
  {
    content: S.Uint8ArrayFromBase64.annotateKey({
      description: "Dropped file bytes encoded over RPC as Base64.",
    }),
    filingContext: VaultFilingContext.annotateKey({
      description: "Deterministic client and matter folder context.",
    }),
    intakeBatchId: IntakeBatchId.annotateKey({
      description: "Intake batch id for this dropped-file batch.",
    }),
    originalFileName: S.NonEmptyString.annotateKey({
      description: "Original source filename supplied by the desktop drop.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace receiving the dropped file.",
    }),
  },
  $I.annote("IntakeDroppedFilePayload", {
    description: "Client payload for app-level dropped-file intake.",
  })
) {}

/**
 * Server-side input for dropped-file intake after workspace vault resolution.
 *
 * @example
 * ```ts
 * import { DefaultVaultFilingContext } from "@beep/documents-domain/values/Taxonomy"
 * import { IntakeBatchId } from "@beep/documents-domain/aggregates/IntakeBatch"
 * import { IntakeDroppedFileInput } from "@beep/documents-use-cases/public"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const input = IntakeDroppedFileInput.make({
 *   content: new Uint8Array([1, 2, 3]),
 *   filingContext: DefaultVaultFilingContext,
 *   intakeBatchId: S.decodeUnknownSync(IntakeBatchId)("batch-20260709"),
 *   originalFileName: "complaint.pdf",
 *   vaultRootPath: "/tmp/beep-documents-vault",
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(input.vaultRootPath)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export class IntakeDroppedFileInput extends S.Class<IntakeDroppedFileInput>($I`IntakeDroppedFileInput`)(
  {
    content: S.Uint8ArrayFromBase64.annotateKey({
      description: "Dropped file bytes.",
    }),
    filingContext: VaultFilingContext.annotateKey({
      description: "Deterministic client and matter folder context.",
    }),
    intakeBatchId: IntakeBatchId.annotateKey({
      description: "Intake batch id for this dropped-file batch.",
    }),
    originalFileName: S.NonEmptyString.annotateKey({
      description: "Original source filename supplied by the desktop drop.",
    }),
    vaultRootPath: S.NonEmptyString.annotateKey({
      description: "Absolute workspace vault root path read from workspace configuration.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace receiving the dropped file.",
    }),
  },
  $I.annote("IntakeDroppedFileInput", {
    description: "Server-side input for dropped-file intake after workspace vault resolution.",
  })
) {}

/**
 * Document intake service shape.
 *
 * @example
 * ```ts
 * import type { DocumentIntakeShape } from "@beep/documents-use-cases/public"
 * import { Effect } from "effect"
 *
 * const service: DocumentIntakeShape = {
 *   intakeDroppedFile: () => Effect.die("not implemented")
 * }
 * console.log(service)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export interface DocumentIntakeShape {
  readonly intakeDroppedFile: (input: IntakeDroppedFileInput) => Effect.Effect<Document, DocumentIntakeError>;
}

/**
 * Document intake service contract.
 *
 * @example
 * ```ts
 * import { DocumentIntake } from "@beep/documents-use-cases/public"
 * import type { DocumentIntakeShape } from "@beep/documents-use-cases/public"
 * import { Effect } from "effect"
 *
 * const service: DocumentIntakeShape = {
 *   intakeDroppedFile: () => Effect.die("not implemented")
 * }
 * const program = Effect.gen(function* () {
 *   return (yield* DocumentIntake) === service
 * }).pipe(Effect.provideService(DocumentIntake, service))
 * console.log(Effect.runSync(program))
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export class DocumentIntake extends Context.Service<DocumentIntake, DocumentIntakeShape>()($I`DocumentIntake`) {}
