/**
 * Worker concept-local value schemas.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $ArchitectureLabDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { WorkerId } from "@beep/shared-domain/identity/ArchitectureLab/WorkerId";
import * as Shared from "@beep/shared-domain/identity/Shared";
import * as S from "effect/Schema";

const $I = $ArchitectureLabDomainId.create("entities/Worker/Worker.values");

/**
 * Organization identity used by the Worker proof entity.
 *
 * **Example** (Decode organization id)
 *
 * ```ts
 * import { WorkerOrganizationId, type WorkerOrganizationId as WorkerOrganizationIdValue } from "@beep/architecture-lab-domain/entities/Worker"
 * import * as S from "effect/Schema"
 *
 * const organizationId: WorkerOrganizationIdValue = S.decodeUnknownSync(WorkerOrganizationId)(1)
 *
 * if (organizationId !== 1) {
 *   throw new Error("expected decoded organization id")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const WorkerOrganizationId = Shared.OrganizationId;

/**
 * Runtime type for {@link WorkerOrganizationId}.
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type WorkerOrganizationId = typeof WorkerOrganizationId.Type;

/**
 * Closed lifecycle vocabulary for the Worker proof entity.
 *
 * **Example** (Use active WorkerStatus)
 *
 * ```ts
 * import { WorkerStatus, type WorkerStatus as WorkerStatusValue } from "@beep/architecture-lab-domain/entities/Worker"
 *
 * const status: WorkerStatusValue = WorkerStatus.Enum.active
 * console.log(status)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const WorkerStatus = LiteralKit(["active", "inactive"]).pipe(
  $I.annoteSchema("WorkerStatus", {
    title: "Worker status",
    description: "Lifecycle status for a synthetic architecture lab Worker entity.",
  })
);

/**
 * Runtime type for {@link WorkerStatus}.
 *
 * @category value-objects
 * @since 0.0.0
 */
export type WorkerStatus = typeof WorkerStatus.Type;

/**
 * Constructor input for an active Worker in an organization.
 *
 * **Example** (Make CreateWorkerInput)
 *
 * ```ts
 * import { CreateWorkerInput, WorkerId, WorkerOrganizationId } from "@beep/architecture-lab-domain/entities/Worker"
 * import * as S from "effect/Schema"
 *
 * const input = CreateWorkerInput.make({
 *   id: S.decodeUnknownSync(WorkerId)(1),
 *   organizationId: S.decodeUnknownSync(WorkerOrganizationId)(1),
 *   displayName: "Ada Lovelace"
 * })
 *
 * console.log(input.displayName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class CreateWorkerInput extends S.Class<CreateWorkerInput>($I`CreateWorkerInput`)(
  {
    id: WorkerId.annotateKey({
      description: "Worker entity identifier.",
    }),
    organizationId: WorkerOrganizationId.annotateKey({
      description: "Organization that owns the Worker.",
    }),
    displayName: S.NonEmptyString.annotateKey({
      description: "Display name for the Worker.",
    }),
  },
  $I.annote("CreateWorkerInput", {
    title: "Create Worker input",
    description: "Input required to create an active architecture lab Worker entity.",
  })
) {}
