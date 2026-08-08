/**
 * Toaster primitive: renders the live toast queue from the toast manager.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastPrimitive,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@beep/ui/components/toast";
import { A } from "@beep/utils";
import { cn } from "../lib/index.ts";
import { globalToastManager } from "../lib/toaster.ts";
import type { ToastData } from "@beep/ui/components/toast";

/**
 * Renders the live toasts from the toast manager.
 *
 * **Example** (Import ToastPrimitive)
 *
 * ```tsx
 * import { ToastPrimitive } from "@beep/ui/components/toaster"
 *
 * console.log(ToastPrimitive)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ToasterViewport() {
  const { toasts } = ToastPrimitive.useToastManager();

  return (
    <ToastViewport>
      {A.map(toasts, (toast) => (
        <Toast
          key={toast.id}
          toast={toast as ToastPrimitive.Root.ToastObject<ToastData>}
          className="bg-[--sl-color-bg]"
        >
          <div className="grid gap-1">
            {toast.title && <ToastTitle className="text-[--sl-color-white]">{toast.title}</ToastTitle>}
            {toast.description && (
              <ToastDescription className="text-[--sl-color-text]">{toast.description}</ToastDescription>
            )}
          </div>
          {toast.actionProps && (
            <button
              type="button"
              className={cn(
                "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 font-medium text-sm transition-colors hover:bg-secondary"
              )}
              {...toast.actionProps}
            />
          )}
          <ToastClose className="cursor-pointer bg-transparent text-[--sl-color-white]" />
        </Toast>
      ))}
    </ToastViewport>
  );
}

/**
 * Toaster component.
 *
 * **Example** (Import Toaster component)
 *
 * ```tsx
 * import { Toaster } from "@beep/ui/components/toaster"
 *
 * console.log(Toaster)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function Toaster() {
  return (
    <ToastProvider timeout={5000} limit={3} toastManager={globalToastManager}>
      <ToasterViewport />
    </ToastProvider>
  );
}

/**
 * Toast primitive namespace re-export.
 *
 * **Example** (Import ToastPrimitive namespace)
 *
 * ```tsx
 * import { ToastPrimitive } from "@beep/ui/components/toaster"
 *
 * console.log(ToastPrimitive)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export { ToastPrimitive };
