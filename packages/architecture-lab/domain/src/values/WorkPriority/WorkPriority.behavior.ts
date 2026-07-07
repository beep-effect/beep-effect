/**
 * WorkPriority pure behavior.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { dual } from "effect/Function";
import { WorkPriority as WorkPrioritySchema } from "./WorkPriority.model.js";
import type { WorkPriority } from "./WorkPriority.model.js";

/**
 * Default priority for newly created WorkItems.
 *
 * @example
 * ```ts
 * import { WorkPriority, defaultWorkPriority } from "@beep/architecture-lab-domain/values/WorkPriority"
 *
 * const usesNormalPriority = defaultWorkPriority === WorkPriority.Enum.normal
 *
 * console.log(usesNormalPriority)
 *
 * if (defaultWorkPriority !== WorkPriority.Enum.normal) {
 *   throw new Error("expected normal default priority")
 * }
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const defaultWorkPriority: WorkPriority = WorkPrioritySchema.Enum.normal;

/**
 * Rank a priority from lowest to highest.
 *
 * @example
 * ```ts
 * import { rank } from "@beep/architecture-lab-domain/values/WorkPriority"
 *
 * const highOutranksLow = rank("high") > rank("low")
 *
 * console.log(highOutranksLow)
 *
 * if (rank("high") <= rank("low")) {
 *   throw new Error("expected high priority to outrank low priority")
 * }
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const rank: (priority: WorkPriority) => number = WorkPrioritySchema.$match({
  low: () => 0,
  normal: () => 1,
  high: () => 2,
});

/**
 * Compare two priorities by their relative rank.
 *
 * @example
 * ```ts
 * import { compare } from "@beep/architecture-lab-domain/values/WorkPriority"
 *
 * const highBeatsNormal = compare("high", "normal")
 * const lowLosesToNormal = compare("normal")("low")
 *
 * console.log({ highBeatsNormal, lowLosesToNormal })
 *
 * if (highBeatsNormal <= 0 || lowLosesToNormal >= 0) {
 *   throw new Error("expected priority ordering")
 * }
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const compare: {
  (left: WorkPriority, right: WorkPriority): number;
  (right: WorkPriority): (left: WorkPriority) => number;
} = dual(2, (left: WorkPriority, right: WorkPriority): number => rank(left) - rank(right));
