/**
 * Valid-time predicates shared by claim owners.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { constFalse, dual } from "effect/Function";
import { holdsAt } from "../ValidInterval/index.ts";
import { ValidTime as ValidTimeSchema } from "./Claim.model.ts";
import type * as DateTime from "effect/DateTime";
import type { ValidTime } from "./Claim.model.ts";

/**
 * Does a claim's valid time cover `at`? `Unknown` never does.
 *
 * **Example** (Unknown valid time is never selected)
 *
 * ```ts
 * import { validAt } from "@beep/epistemics/Claim"
 * import * as DateTime from "effect/DateTime"
 *
 * validAt({ _tag: "Unknown" }, DateTime.makeUnsafe(0)) // => false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const validAt: {
  (at: DateTime.Utc): (validTime: ValidTime) => boolean;
  (validTime: ValidTime, at: DateTime.Utc): boolean;
} = dual(2, (validTime: ValidTime, at: DateTime.Utc): boolean =>
  ValidTimeSchema.match(validTime, { Unknown: constFalse, Interval: (interval) => holdsAt(interval, at) })
);
