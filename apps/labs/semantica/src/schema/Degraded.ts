import { $SemanticaId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $SemanticaId.create("schema/Degraded");

/**
 * Closed degraded-state vocabulary for the C0 parse and extraction stages.
 *
 * **Example** (Check provider degradation)
 *
 * ```ts
 * import { DegradedKind } from "@/schema/Degraded"
 *
 * console.log(DegradedKind.is["provider-unavailable"]("provider-unavailable")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DegradedKind = LiteralKit([
  "invalid-utf8",
  "truncated",
  "empty-text-layer",
  "extraction-failed",
  "input-limit",
  "provider-unavailable",
  "model-output-invalid",
  "fabricated-span",
  "relation-unresolved",
]).pipe(
  $I.annoteSchema("DegradedKind", {
    description: "Exhaustive typed parse and extraction degradation kinds admitted by C0.",
  })
);

/**
 * Decoded literal accepted by {@link DegradedKind}.
 *
 * **Example** (Annotate a degraded state)
 *
 * ```ts
 * import type { DegradedKind } from "@/schema/Degraded"
 *
 * const kind: DegradedKind = "extraction-failed"
 * console.log(kind) // "extraction-failed"
 * ```
 *
 * @see {@link DegradedKind} for literal helpers and validation.
 * @category type-level
 * @since 0.0.0
 */
export type DegradedKind = typeof DegradedKind.Type;
