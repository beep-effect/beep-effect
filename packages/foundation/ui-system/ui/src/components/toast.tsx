"use client";

import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { $UiId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { XIcon } from "@phosphor-icons/react";
import { cva } from "class-variance-authority";
import * as S from "effect/Schema";
import * as React from "react";
import { cn } from "../lib/index.ts";
import type { VariantProps } from "class-variance-authority";

const $I = $UiId.create("components/toast");

/**
 * Toast variant type.
 *
 * Toast variant export.
 *
 * Toast data class.
 *
 * @example
 * ```tsx
 * import { ToastData } from "@beep/ui/components/toast"
 *
 * console.log(ToastData)
 * ```
 *
 * @example
 * ```tsx
 * import { ToastVariant } from "@beep/ui/components/toast"
 *
 * console.log(ToastVariant)
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
const ToastProvider = ToastPrimitive.Provider;

/**
 * Toast viewport component.
 *
 * @example
 * ```tsx
 * import { ToastViewport } from "@beep/ui/components/toast"
 *
 * console.log(ToastViewport)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const ToastViewport = React.forwardRef<HTMLDivElement, ToastPrimitive.Viewport.Props & { readonly className?: string }>(
  ({ className, ...props }, ref) => (
    <ToastPrimitive.Viewport
      ref={ref}
      className={cn(
        "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:top-auto sm:right-0 sm:bottom-0 sm:flex-col md:max-w-[420px]",
        className
      )}
      {...props}
    />
  )
);
ToastViewport.displayName = "ToastViewport";

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 pr-6 shadow-lg transition-all data-[ending]:animate-out data-[starting]:animate-in data-[ending]:fade-out-80 data-[ending]:slide-out-to-right-full data-[starting]:slide-in-from-top-full data-[starting]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive: "destructive group border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface ToastRootProps extends Omit<ToastPrimitive.Root.Props, "toast">, VariantProps<typeof toastVariants> {
  toast: ToastPrimitive.Root.ToastObject<ToastData>;
}

/**
 * Toast variant component.
 *
 * @example
 * ```tsx
 * import { ToastVariant } from "@beep/ui/components/toast"
 *
 * console.log(ToastVariant)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const ToastVariant = LiteralKit(["default", "destructive"]).pipe(
  $I.annoteSchema("ToastVariant", {
    description: "Visual variants supported by toast notifications.",
  })
);

/**
 * Toast variant type.
 *
 * @example
 * ```ts
 * import type { ToastVariant } from "@beep/ui/components/toast"
 *
 * const value = {} as ToastVariant
 * console.log(value)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ToastVariant = typeof ToastVariant.Type;

/**
 * Toast data class.
 *
 * @example
 * ```tsx
 * import { ToastData } from "@beep/ui/components/toast"
 *
 * console.log(ToastData)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class ToastData extends S.Class<ToastData>($I`ToastData`)(
  {
    variant: ToastVariant.pipe(
      S.optionalKey,
      SchemaUtils.withKeyDefaults(ToastVariant.Enum.default),
      $I.annoteKey("ToastData.variant", {
        description: "Visual variant carried by toast notification data.",
      })
    ),
  },
  $I.annote("ToastData", {
    description: "Data carried by toast notifications.",
  })
) {}

/**
 * Toast component.
 *
 * @example
 * ```tsx
 * import { Toast } from "@beep/ui/components/toast"
 *
 * console.log(Toast)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const Toast = React.forwardRef<HTMLDivElement, ToastRootProps>(({ className, variant, toast, ...props }, ref) => {
  const resolvedVariant = variant ?? toast.data?.variant ?? "default";
  return (
    <ToastPrimitive.Root
      ref={ref}
      toast={toast}
      className={cn(toastVariants({ variant: resolvedVariant }), className)}
      {...props}
    />
  );
});
Toast.displayName = "Toast";

/**
 * Toast action component.
 *
 * @example
 * ```tsx
 * import { ToastAction } from "@beep/ui/components/toast"
 *
 * console.log(ToastAction)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const ToastAction = React.forwardRef<HTMLButtonElement, ToastPrimitive.Action.Props & { readonly className?: string }>(
  ({ className, ...props }, ref) => (
    <ToastPrimitive.Action
      ref={ref}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 font-medium text-sm transition-colors hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:focus:ring-destructive group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground",
        className
      )}
      {...props}
    />
  )
);
ToastAction.displayName = "ToastAction";

/**
 * Toast close component.
 *
 * @example
 * ```tsx
 * import { ToastClose } from "@beep/ui/components/toast"
 *
 * console.log(ToastClose)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const ToastClose = React.forwardRef<HTMLButtonElement, ToastPrimitive.Close.Props & { readonly className?: string }>(
  ({ className, ...props }, ref) => (
    <ToastPrimitive.Close
      ref={ref}
      className={cn(
        "absolute top-1 right-1 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-1 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600 group-[.destructive]:hover:text-red-50",
        className
      )}
      {...props}
    >
      <XIcon className={"h-4 w-4"} />
    </ToastPrimitive.Close>
  )
);
ToastClose.displayName = "ToastClose";

/**
 * Toast title component.
 *
 * @example
 * ```tsx
 * import { ToastTitle } from "@beep/ui/components/toast"
 *
 * console.log(ToastTitle)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const ToastTitle = React.forwardRef<HTMLHeadingElement, ToastPrimitive.Title.Props & { readonly className?: string }>(
  ({ className, ...props }, ref) => (
    <ToastPrimitive.Title ref={ref} className={cn("font-semibold text-sm [&+div]:text-xs", className)} {...props} />
  )
);
ToastTitle.displayName = "ToastTitle";

/**
 * Toast description component.
 *
 * @example
 * ```tsx
 * import { ToastDescription } from "@beep/ui/components/toast"
 *
 * console.log(ToastDescription)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const ToastDescription = React.forwardRef<
  HTMLParagraphElement,
  ToastPrimitive.Description.Props & { className?: string }
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description ref={ref} className={cn("text-sm opacity-90", className)} {...props} />
));
ToastDescription.displayName = "ToastDescription";

/**
 * Toast props type.
 *
 * @example
 * ```ts
 * import type { ToastProps } from "@beep/ui/components/toast"
 *
 * const value = {} as ToastProps
 * console.log(value)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

/**
 * Toast action element type.
 *
 * @example
 * ```ts
 * import type { ToastActionElement } from "@beep/ui/components/toast"
 *
 * const value = {} as ToastActionElement
 * console.log(value)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
type ToastActionElement = React.ReactElement<typeof ToastAction>;

/**
 * @category components
 * @since 0.0.0
 */
export {
  Toast,
  ToastAction,
  type ToastActionElement,
  ToastClose,
  ToastDescription,
  ToastPrimitive,
  type ToastProps,
  ToastProvider,
  ToastTitle,
  ToastViewport,
};
