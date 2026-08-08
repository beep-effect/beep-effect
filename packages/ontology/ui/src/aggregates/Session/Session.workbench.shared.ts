/**
 * Shared helpers for ontology workbench regions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { ChangeEvent } from "react";

/**
 * Extracts the current string value from a workbench form control event.
 *
 * **Example** (Extract form control value)
 *
 * ```ts
 * import { valueFromEvent } from "@beep/ontology-ui/aggregates/Session"
 *
 * console.log(valueFromEvent)
 * ```
 *
 * @category forms
 * @since 0.0.0
 */
export const valueFromEvent = (
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
): string => event.target.value;
