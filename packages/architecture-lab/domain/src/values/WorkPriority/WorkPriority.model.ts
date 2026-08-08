/**
 * WorkPriority value-object model.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $ArchitectureLabDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $ArchitectureLabDomainId.create("values/WorkPriority/WorkPriority.model");

/**
 * Closed priority vocabulary shared by WorkItem creation and ranking behavior.
 *
 * **Example** (Decode high priority value)
 *
 * ```ts
 * import { WorkPriority, type WorkPriority as WorkPriorityValue } from "@beep/architecture-lab-domain/values/WorkPriority"
 * import * as S from "effect/Schema"
 *
 * const priority: WorkPriorityValue = S.decodeUnknownSync(WorkPriority)("high")
 *
 * if (priority !== WorkPriority.Enum.high) {
 *   throw new Error("expected decoded high priority")
 * }
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const WorkPriority = LiteralKit(["low", "normal", "high"]).pipe(
  $I.annoteSchema("WorkPriority", {
    title: "Work priority",
    description: "Reusable architecture lab value object for relative WorkItem priority.",
  })
);

/**
 * Runtime type for {@link WorkPriority}.
 *
 * **Example** (Use normal priority enum)
 *
 * ```ts
 * import { WorkPriority, type WorkPriority as WorkPriorityValue } from "@beep/architecture-lab-domain/values/WorkPriority"
 *
 * const priority: WorkPriorityValue = WorkPriority.Enum.normal
 * const isNormalPriority = priority === "normal"
 *
 * console.log(isNormalPriority)
 *
 * if (priority !== "normal") {
 *   throw new Error("expected normal priority")
 * }
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type WorkPriority = typeof WorkPriority.Type;
