"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "@phosphor-icons/react";
import { cn } from "../lib/index.ts";
import { Button } from "./button";
import type * as React from "react";

/**
 * Dialog component.
 *
 * @example
 * ```tsx
 * import { Dialog } from "@beep/ui/components/dialog"
 *
 * console.log(Dialog)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

/**
 * Dialog trigger component.
 *
 * @example
 * ```tsx
 * import { DialogTrigger } from "@beep/ui/components/dialog"
 *
 * console.log(DialogTrigger)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

/**
 * Dialog portal component.
 *
 * @example
 * ```tsx
 * import { DialogPortal } from "@beep/ui/components/dialog"
 *
 * console.log(DialogPortal)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

/**
 * Dialog close component.
 *
 * @example
 * ```tsx
 * import { DialogClose } from "@beep/ui/components/dialog"
 *
 * console.log(DialogClose)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

/**
 * Dialog overlay component.
 *
 * @example
 * ```tsx
 * import { DialogOverlay } from "@beep/ui/components/dialog"
 *
 * console.log(DialogOverlay)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-black/50 duration-100 fixed inset-0 z-50",
        className
      )}
      {...props}
    />
  );
}

/**
 * Dialog content component.
 *
 * @example
 * ```tsx
 * import { DialogContent } from "@beep/ui/components/dialog"
 *
 * console.log(DialogContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  readonly showCloseButton?: undefined | boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "bg-background data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/10 relative grid max-w-[calc(100%-2rem)] gap-4 rounded-xl p-4 text-sm ring-1 shadow-lg duration-100 w-full outline-none",
            className
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={<Button variant="ghost" className="absolute top-2 right-2" size="icon-sm" />}
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </div>
    </DialogPortal>
  );
}

/**
 * Dialog header component.
 *
 * @example
 * ```tsx
 * import { DialogHeader } from "@beep/ui/components/dialog"
 *
 * console.log(DialogHeader)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("gap-2 flex flex-col", className)} {...props} />;
}

/**
 * Dialog footer component.
 *
 * @example
 * ```tsx
 * import { DialogFooter } from "@beep/ui/components/dialog"
 *
 * console.log(DialogFooter)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  readonly showCloseButton?: undefined | boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "bg-muted/50 -mx-4 -mb-4 rounded-b-xl border-t p-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && <DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>}
    </div>
  );
}

/**
 * Dialog title component.
 *
 * @example
 * ```tsx
 * import { DialogTitle } from "@beep/ui/components/dialog"
 *
 * console.log(DialogTitle)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-sm leading-none font-medium", className)}
      {...props}
    />
  );
}

/**
 * Dialog description component.
 *
 * @example
 * ```tsx
 * import { DialogDescription } from "@beep/ui/components/dialog"
 *
 * console.log(DialogDescription)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-muted-foreground *:[a]:hover:text-foreground text-sm *:[a]:underline *:[a]:underline-offset-3",
        className
      )}
      {...props}
    />
  );
}
/**
 * Dialog component, composed with its part components via `Dialog.Trigger`,
 * `Dialog.Portal`, `Dialog.Overlay`, `Dialog.Content`, `Dialog.Header`,
 * `Dialog.Footer`, `Dialog.Title`, `Dialog.Description`, and `Dialog.Close`.
 *
 * @example
 * ```tsx
 * import { Dialog } from "@beep/ui/components/dialog"
 *
 * export function ConfirmDialog() {
 *   return (
 *     <Dialog>
 *       <Dialog.Trigger>Open</Dialog.Trigger>
 *       <Dialog.Content>
 *         <Dialog.Header>
 *           <Dialog.Title>Delete item</Dialog.Title>
 *           <Dialog.Description>This cannot be undone.</Dialog.Description>
 *         </Dialog.Header>
 *       </Dialog.Content>
 *     </Dialog>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const DialogWithParts = Object.assign(Dialog, {
  Close: DialogClose,
  Content: DialogContent,
  Description: DialogDescription,
  Footer: DialogFooter,
  Header: DialogHeader,
  Overlay: DialogOverlay,
  Portal: DialogPortal,
  Title: DialogTitle,
  Trigger: DialogTrigger,
});

export {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  DialogWithParts as Dialog,
};
