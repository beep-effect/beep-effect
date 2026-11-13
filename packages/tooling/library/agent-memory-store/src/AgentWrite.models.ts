/**
 * Results of the agent write path: the batch op capture submitted, the
 * admission outcome of each of its operations and the export that follows.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { AdmissionOutcome } from "./Admission.models.ts";
import { BaseExport, OperationBatch } from "./Operation.models.ts";

const $I = $AgentMemoryStoreId.create("AgentWrite.models");

/**
 * One agent edit as admission judged it.
 *
 * **Details**
 *
 * `batch` is the operation batch op capture submitted for the edit, absent
 * when the edit changed nothing (and admission was not called). `outcomes`
 * holds one admission outcome per operation of the batch, in batch order.
 *
 * **Example** (Read the fields of an admitted write)
 *
 * ```ts
 * import { AdmittedWrite } from "@beep/agent-memory-store"
 *
 * console.log(AdmittedWrite.fields.outcomes)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmittedWrite extends S.Opaque<AdmittedWrite, { readonly brand: unique symbol }>()(
  S.Struct({
    batch: S.Option(OperationBatch).annotateKey({
      description: "The batch op capture submitted; none when the edit changed nothing.",
    }),
    outcomes: S.Array(AdmissionOutcome).annotateKey({
      description: "One admission outcome per operation of the batch, in batch order.",
    }),
  }).pipe(
    $I.annoteSchema("AdmittedWrite", {
      description: "One agent edit as admission judged it.",
    })
  )
) {}

/**
 * One agent edit as admission judged it, with the export that projected the
 * log afterwards.
 *
 * **Example** (Read the fields of an exported write)
 *
 * ```ts
 * import { ExportedWrite } from "@beep/agent-memory-store"
 *
 * console.log(ExportedWrite.fields.exported)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExportedWrite extends S.Opaque<ExportedWrite, { readonly brand: unique symbol }>()(
  S.Struct({
    write: AdmittedWrite.annotateKey({ description: "The edit as admission judged it." }),
    exported: BaseExport.annotateKey({ description: "The export of the memory folder after admission." }),
  }).pipe(
    $I.annoteSchema("ExportedWrite", {
      description: "One agent edit as admission judged it, with the export that projected the log afterwards.",
    })
  )
) {}
