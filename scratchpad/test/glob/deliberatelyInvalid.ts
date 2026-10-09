/**
 * Passes deliberately invalid values to typed APIs so tests exercise their runtime validation.
 *
 * **Details**
 *
 * This module's single assertion is sanctioned by the effected-port wrong-input test ruling.
 * Use it only for inputs that the subject must reject.
 *
 * **Example** (Exercise constructor validation)
 *
 * ```ts
 * import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";
 *
 * const invalidBoolean = deliberatelyInvalid<boolean>(undefined);
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const deliberatelyInvalid = <T>(value: unknown): T => value as T;
