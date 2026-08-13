/**
 * Pure Worker construction behavior.
 *
 * @packageDocumentation
 * @category entities
 * @since 0.0.0
 */

import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import { WorkerId } from "@beep/shared-domain/identity/ArchitectureLab/WorkerId";
import { Worker } from "./Worker.model.ts";
import type { Principal } from "@beep/shared-domain/entity/Principal";
import type { CreateWorkerInput } from "./Worker.values.ts";

const WorkerEntity = ProductEntity.make(WorkerId);
const systemPrincipal: Principal = {
  component: "Runtime",
  kind: "System",
};

const publicIdFor = (id: WorkerId) => WorkerEntity.publicId.fromUnknown(`${WorkerEntity.tableName}_a${id}`);

/**
 * Creates a new active Worker entity.
 *
 * **Example** (Create active Worker)
 *
 * ```ts
 * import { CreateWorkerInput, WorkerId, WorkerOrganizationId, create } from "@beep/architecture-lab-domain/entities/Worker"
 * import * as S from "effect/Schema"
 *
 * const worker = create(
 *   CreateWorkerInput.make({
 *     id: S.decodeUnknownSync(WorkerId)(1),
 *     organizationId: S.decodeUnknownSync(WorkerOrganizationId)(1),
 *     displayName: "Ada Lovelace"
 *   })
 * )
 *
 * console.log(worker.status)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export const create = (input: CreateWorkerInput): Worker =>
  Worker.fromUnknown({
    createdAt: 0,
    createdByPrincipal: systemPrincipal,
    displayName: input.displayName,
    entityType: WorkerId.entityType,
    id: input.id,
    orgId: input.organizationId,
    publicId: publicIdFor(input.id),
    rowVersion: 1,
    schemaVersion: "0.1.0",
    source: "Application",
    status: "active",
    updatedAt: 0,
    updatedByPrincipal: systemPrincipal,
  });
