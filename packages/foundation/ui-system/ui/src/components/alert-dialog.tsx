/**
 * Alert dialog primitive: a modal confirmation root for destructive or high-friction actions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { Button } from "@beep/ui/components/button";
import { cn } from "../lib/index.ts";
import type * as React from "react";

/**
 * Modal confirmation root for destructive or high-friction decisions.
 *
 * @example
 * ```tsx
 * import {
 *   AlertDialog,
 *   AlertDialogAction,
 *   AlertDialogCancel,
 *   AlertDialogContent,
 *   AlertDialogDescription,
 *   AlertDialogFooter,
 *   AlertDialogHeader,
 *   AlertDialogTitle,
 *   AlertDialogTrigger
 * } from "@beep/ui/components/alert-dialog"
 *
 * export function DeleteRecordDialog() {
 *   return (
 *     <AlertDialog>
 *       <AlertDialogTrigger>Delete record</AlertDialogTrigger>
 *       <AlertDialogContent size="sm">
 *         <AlertDialogHeader>
 *           <AlertDialogTitle>Delete this record?</AlertDialogTitle>
 *           <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
 *         </AlertDialogHeader>
 *         <AlertDialogFooter>
 *           <AlertDialogCancel>Cancel</AlertDialogCancel>
 *           <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
 *         </AlertDialogFooter>
 *       </AlertDialogContent>
 *     </AlertDialog>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

/**
 * Control that opens an alert dialog.
 *
 * @example
 * ```tsx
 * import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogTrigger } from "@beep/ui/components/alert-dialog"
 *
 * export function ArchiveTrigger() {
 *   return (
 *     <AlertDialog>
 *       <AlertDialogTrigger>Archive account</AlertDialogTrigger>
 *       <AlertDialogContent>
 *         <AlertDialogTitle>Archive this account?</AlertDialogTitle>
 *       </AlertDialogContent>
 *     </AlertDialog>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AlertDialogTrigger({ ...props }: AlertDialogPrimitive.Trigger.Props) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

/**
 * Portal target for alert dialog overlay and popup content.
 *
 * @example
 * ```tsx
 * import { AlertDialog, AlertDialogOverlay, AlertDialogPortal } from "@beep/ui/components/alert-dialog"
 *
 * export function CustomAlertDialogPortal() {
 *   return (
 *     <AlertDialog open>
 *       <AlertDialogPortal>
 *         <AlertDialogOverlay />
 *       </AlertDialogPortal>
 *     </AlertDialog>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />;
}

/**
 * Backdrop layer that dims the page behind an alert dialog.
 *
 * @example
 * ```tsx
 * import { AlertDialog, AlertDialogOverlay, AlertDialogPortal } from "@beep/ui/components/alert-dialog"
 *
 * export function BlockingBackdrop() {
 *   return (
 *     <AlertDialog open>
 *       <AlertDialogPortal>
 *         <AlertDialogOverlay className="bg-black/60" />
 *       </AlertDialogPortal>
 *     </AlertDialog>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AlertDialogOverlay({ className, ...props }: AlertDialogPrimitive.Backdrop.Props) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn(
        "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-black/50 duration-100 fixed inset-0 z-50",
        className
      )}
      {...props}
    />
  );
}

/**
 * Centered alert dialog surface with built-in portal and overlay.
 *
 * @example
 * ```tsx
 * import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@beep/ui/components/alert-dialog"
 *
 * export function CompactConfirmation() {
 *   return (
 *     <AlertDialog open>
 *       <AlertDialogContent size="sm">
 *         <AlertDialogTitle>Reset workspace?</AlertDialogTitle>
 *         <AlertDialogDescription>Saved drafts stay available.</AlertDialogDescription>
 *       </AlertDialogContent>
 *     </AlertDialog>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AlertDialogContent({
  className,
  size = "default",
  ...props
}: AlertDialogPrimitive.Popup.Props & {
  readonly size?: undefined | "default" | "sm";
}) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(
          "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 bg-background ring-foreground/10 gap-4 rounded-xl p-4 ring-1 duration-100 data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 outline-none",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
}

/**
 * Header layout for alert dialog titles, descriptions, and optional media.
 *
 * @example
 * ```tsx
 * import { AlertDialogDescription, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from "@beep/ui/components/alert-dialog"
 *
 * export function WarningDialogHeader() {
 *   return (
 *     <AlertDialogHeader>
 *       <AlertDialogMedia>!</AlertDialogMedia>
 *       <AlertDialogTitle>Transfer ownership?</AlertDialogTitle>
 *       <AlertDialogDescription>The new owner can manage billing.</AlertDialogDescription>
 *     </AlertDialogHeader>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className
      )}
      {...props}
    />
  );
}

/**
 * Footer layout for alert dialog cancel and action controls.
 *
 * @example
 * ```tsx
 * import { AlertDialogAction, AlertDialogCancel, AlertDialogFooter } from "@beep/ui/components/alert-dialog"
 *
 * export function ConfirmationActions() {
 *   return (
 *     <AlertDialogFooter>
 *       <AlertDialogCancel>Keep draft</AlertDialogCancel>
 *       <AlertDialogAction variant="destructive">Discard draft</AlertDialogAction>
 *     </AlertDialogFooter>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "bg-muted/50 -mx-4 -mb-4 rounded-b-xl border-t p-4 flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

/**
 * Visual slot for an icon or status marker in an alert dialog header.
 *
 * @example
 * ```tsx
 * import { AlertDialogMedia } from "@beep/ui/components/alert-dialog"
 *
 * export function DestructiveDialogIcon() {
 *   return <AlertDialogMedia className="text-destructive">!</AlertDialogMedia>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AlertDialogMedia({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "bg-muted mb-2 inline-flex size-10 items-center justify-center rounded-md sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-6",
        className
      )}
      {...props}
    />
  );
}

/**
 * Accessible title announced as the alert dialog heading.
 *
 * @example
 * ```tsx
 * import { AlertDialogTitle } from "@beep/ui/components/alert-dialog"
 *
 * export function RemoveMemberTitle() {
 *   return <AlertDialogTitle>Remove this member?</AlertDialogTitle>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        "text-sm font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        className
      )}
      {...props}
    />
  );
}

/**
 * Supporting copy announced with the alert dialog title.
 *
 * @example
 * ```tsx
 * import { AlertDialogDescription } from "@beep/ui/components/alert-dialog"
 *
 * export function RemoveMemberDescription() {
 *   return <AlertDialogDescription>The member loses access immediately.</AlertDialogDescription>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(
        "text-muted-foreground *:[a]:hover:text-foreground text-sm text-balance md:text-pretty *:[a]:underline *:[a]:underline-offset-3",
        className
      )}
      {...props}
    />
  );
}

/**
 * Primary close action styled with the shared button variants.
 *
 * @example
 * ```tsx
 * import { AlertDialogAction } from "@beep/ui/components/alert-dialog"
 *
 * export function DestructiveDialogAction() {
 *   return (
 *     <AlertDialogAction variant="destructive" size="sm">
 *       Delete project
 *     </AlertDialogAction>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AlertDialogAction({
  className,
  variant = "default",
  size = "default",
  ...props
}: AlertDialogPrimitive.Close.Props & Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-action"
      className={cn(className)}
      render={<Button variant={variant} size={size} />}
      {...props}
    />
  );
}

/**
 * Secondary close action for dismissing the alert dialog.
 *
 * @example
 * ```tsx
 * import { AlertDialogCancel } from "@beep/ui/components/alert-dialog"
 *
 * export function DialogCancelButton() {
 *   return (
 *     <AlertDialogCancel variant="outline" size="sm">
 *       Cancel
 *     </AlertDialogCancel>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  ...props
}: AlertDialogPrimitive.Close.Props & Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      className={cn(className)}
      render={<Button variant={variant} size={size} />}
      {...props}
    />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
