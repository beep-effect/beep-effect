/**
 * The option model shared by selection fields (select, radio, toggle group,
 * multi-select, …).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type React from "react";

/**
 * A single selectable option: a stable string `value`, a renderable `label`,
 * and an optional `disabled` flag.
 *
 * **Example** (Options array with disabled)
 *
 * ```ts
 * import type { FieldOption } from "@beep/form/core/Options"
 *
 * const options: ReadonlyArray<FieldOption> = [
 *   { value: "us", label: "United States" },
 *   { value: "ca", label: "Canada", disabled: true },
 * ]
 * console.log(options.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface FieldOption<Value extends string = string> {
  readonly disabled?: boolean | undefined;
  readonly label: React.ReactNode;
  readonly value: Value;
}
