import { LiteralKit } from "@beep/schema/LiteralKit";

/**
 * Where a run is, as readers see it.
 *
 * @category models
 * @since 0.0.0
 */
export const RunStatus = LiteralKit([
  "unrequested",
  "requested",
  "running",
  "awaiting-approval",
  "awaiting-child",
  "completed",
  "rejected",
  "cancelled",
  "exhausted",
  "continued",
]);
/**
 * @category models
 * @since 0.0.0
 */
export type RunStatus = typeof RunStatus.Type;
