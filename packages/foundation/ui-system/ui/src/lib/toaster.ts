/**
 * Shared toast manager used by the `@beep/ui` toaster surface.
 *
 * **Example** (Import global toast manager)
 *
 * ```ts
 * import { globalToastManager } from "@beep/ui/lib/toaster"
 *
 * console.log(globalToastManager)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import type { ToastData } from "../components/toast.tsx";

/**
 * Global toast manager export.
 *
 * **Example** (Log global toast manager)
 *
 * ```ts
 * import { globalToastManager } from "@beep/ui/lib/toaster"
 *
 * console.log(globalToastManager)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const globalToastManager = ToastPrimitive.createToastManager<ToastData>();
