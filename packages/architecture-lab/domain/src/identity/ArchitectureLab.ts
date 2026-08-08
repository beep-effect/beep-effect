/**
 * Architecture lab slice-local entity identifiers.
 *
 * @packageDocumentation
 * @category entity-ids
 * @since 0.0.0
 */

import { $ArchitectureLabDomainId } from "@beep/identity/packages";
import * as EntityId from "@beep/shared-domain/entity/EntityId";

const $I = $ArchitectureLabDomainId.create("identity/ArchitectureLab");
const make = EntityId.factory("architecture_lab", $I);

/**
 * Architecture lab Worker entity identifier.
 *
 * **Example** (Decode WorkerId from number)
 *
 * ```ts
 * import { WorkerId, type WorkerId as WorkerIdValue } from "@beep/architecture-lab-domain/identity/ArchitectureLab"
 * import * as S from "effect/Schema"
 *
 * const id: WorkerIdValue = S.decodeUnknownSync(WorkerId)(1)
 *
 * if (id !== 1 || WorkerId.tableName !== "architecture_lab_worker") {
 *   throw new Error("expected architecture lab Worker identity")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const WorkerId = make("worker", {
  description: "Identifier for an architecture lab Worker entity.",
});

/**
 * Runtime type for {@link WorkerId}.
 *
 * **Example** (WorkerId type array usage)
 *
 * ```ts
 * import { WorkerId, type WorkerId as WorkerIdValue } from "@beep/architecture-lab-domain/identity/ArchitectureLab"
 * import * as S from "effect/Schema"
 *
 * const id: WorkerIdValue = S.decodeUnknownSync(WorkerId)(1)
 * const ids: ReadonlyArray<WorkerIdValue> = [id]
 *
 * if (ids.length !== 1) {
 *   throw new Error("expected Worker id type evidence")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type WorkerId = typeof WorkerId.Type;
