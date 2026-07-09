/**
 * Intake batch aggregate model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema/Int";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";

const $I = $DocumentsDomainId.create("aggregates/IntakeBatch/IntakeBatch.model");

/**
 * Stable intake batch identifier supplied by the intake boundary.
 *
 * @example
 * ```ts
 * import { IntakeBatchId } from "@beep/documents-domain/aggregates/IntakeBatch"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(IntakeBatchId)("batch-20260709")
 * console.log(id)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const IntakeBatchId = S.NonEmptyString.pipe(
  S.brand("IntakeBatchId"),
  $I.annoteSchema("IntakeBatchId", {
    description: "Stable intake batch id supplied by the app intake boundary.",
  })
);

/**
 * Stable intake batch identifier supplied by the intake boundary.
 *
 * @example
 * ```ts
 * import { IntakeBatchId } from "@beep/documents-domain/aggregates/IntakeBatch"
 * import * as S from "effect/Schema"
 *
 * const id: IntakeBatchId = S.decodeUnknownSync(IntakeBatchId)("batch-20260709")
 * console.log(id)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type IntakeBatchId = typeof IntakeBatchId.Type;

/**
 * Deterministic local intake batch metadata.
 *
 * @example
 * ```ts
 * import { IntakeBatch, IntakeBatchId } from "@beep/documents-domain/aggregates/IntakeBatch"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const batch = S.decodeUnknownSync(IntakeBatch)({
 *   fileCount: 2,
 *   id: S.decodeUnknownSync(IntakeBatchId)("batch-20260709"),
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(batch.fileCount)
 * ```
 *
 * @category aggregates
 * @since 0.0.0
 */
export class IntakeBatch extends S.Class<IntakeBatch>($I`IntakeBatch`)(
  {
    fileCount: NonNegativeInt.annotateKey({
      description: "Number of files received in the batch.",
    }),
    id: IntakeBatchId.annotateKey({
      description: "Stable intake batch id.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace that owns the intake batch.",
    }),
  },
  $I.annote("IntakeBatch", {
    description: "A deterministic local intake batch.",
  })
) {}
