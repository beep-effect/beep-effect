/**
 * Worker entity model.
 *
 * @packageDocumentation
 * @category entities
 * @since 0.0.0
 */

import { $ArchitectureLabDomainId } from "@beep/identity/packages";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import { WorkerId } from "@beep/shared-domain/identity/ArchitectureLab/WorkerId";
import * as S from "effect/Schema";
import { WorkerStatus } from "./Worker.values.ts";

const $I = $ArchitectureLabDomainId.create("entities/Worker/Worker.model");
const WorkerEntity = ProductEntity.make(WorkerId);

/**
 * Persisted Worker entity used by WorkItem assignment flows.
 *
 * **Example** (Create Worker entity)
 *
 * ```ts
 * import {
 *   CreateWorkerInput,
 *   Worker,
 *   WorkerOrganizationId,
 *   create
 * } from "@beep/architecture-lab-domain/entities/Worker"
 * import { WorkerId } from "@beep/shared-domain/identity/ArchitectureLab/WorkerId"
 * import * as S from "effect/Schema"
 *
 * const worker: Worker = create(
 *   CreateWorkerInput.make({
 *     id: S.decodeUnknownSync(WorkerId)(1),
 *     organizationId: S.decodeUnknownSync(WorkerOrganizationId)(1),
 *     displayName: "Ada Lovelace"
 *   })
 * )
 *
 * if (worker.entityType !== WorkerId.entityType || worker.status !== "active") {
 *   throw new Error("expected active Worker entity")
 * }
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Worker extends WorkerEntity.Entity<Worker>(WorkerEntity.tableName)(
  {
    displayName: S.NonEmptyString.annotateKey({
      description: "Display name shown for the Worker in assignment flows.",
    }).pipe(WorkerEntity.pg.text(), WorkerEntity.pg.columnName("display_name")),
    status: WorkerStatus.annotateKey({
      description: "Lifecycle status for the Worker.",
    }).pipe(WorkerEntity.pg.text()),
    ...WorkerEntity.identityFields,
  },
  $I.annote("Worker", {
    title: "Worker",
    description: "Canonical architecture lab persisted entity used to prove entity archetype generation.",
  }),
  (columns) => [
    WorkerEntity.Table.index("architecture_lab_worker_status_lookup_idx", [columns.status]),
    ...WorkerEntity.entityExtras(columns),
  ]
) {
  static readonly fromUnknown = S.decodeUnknownSync(Worker);
}
