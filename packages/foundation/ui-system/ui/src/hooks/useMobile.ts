/**
 * Responsive mobile-state helpers for `@beep/ui`.
 *
 * **Example** (Import resolveIsMobile helper)
 *
 * ```ts
 * import { resolveIsMobile } from "@beep/ui/hooks/useMobile"
 *
 * console.log(resolveIsMobile)
 * ```
 *
 * **Example** (Import useIsMobile hook)
 *
 * ```ts
 * import { useIsMobile } from "@beep/ui/hooks/useMobile"
 *
 * console.log(useIsMobile)
 * ```
 *
 * @packageDocumentation
 * @category hooks
 * @since 0.0.0
 */
import { Str } from "@beep/utils";
import { useAtomValue } from "@effect/atom-react";
import { constFalse } from "effect/Function";
import * as O from "effect/Option";
import { mediaQueryAtom } from "../internal/react-atoms.ts";
import { TOUCH_MEDIA_QUERY } from "../themes/scales.ts";

const mobileMediaQuery = Str.replace(/^@media\s*/, "")(TOUCH_MEDIA_QUERY);

/**
 * Resolve is mobile export.
 *
 * **Example** (Import resolveIsMobile export)
 *
 * ```ts
 * import { resolveIsMobile } from "@beep/ui/hooks/useMobile"
 *
 * console.log(resolveIsMobile)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolveIsMobile = (isMobile: O.Option<boolean>): boolean => O.getOrElse(isMobile, constFalse);

/**
 * Use is mobile hook.
 *
 * **Example** (Import useIsMobile export)
 *
 * ```ts
 * import { useIsMobile } from "@beep/ui/hooks/useMobile"
 *
 * console.log(useIsMobile)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function useIsMobile() {
  return useAtomValue(mediaQueryAtom(mobileMediaQuery));
}
