/**
 * Alert primitive: a status message container with default and destructive variants.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { cva } from "class-variance-authority";
import { cn } from "../lib/index.ts";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

const alertVariants = cva(
  "grid gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4 w-full relative group/alert",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "text-destructive bg-card *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/**
 * Status message container with default and destructive variants.
 *
 * **Example** (Destructive payment failure alert)
 *
 * ```tsx
 * import { Alert, AlertDescription, AlertTitle } from "@beep/ui/components/alert"
 *
 * export function PaymentAlert() {
 *   return (
 *     <Alert variant="destructive">
 *       <AlertTitle>Payment failed</AlertTitle>
 *       <AlertDescription>Update the card before the next billing attempt.</AlertDescription>
 *     </Alert>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

/**
 * Prominent heading text inside an {@link Alert}.
 *
 * **Example** (Sync complete alert title)
 *
 * ```tsx
 * import { Alert, AlertTitle } from "@beep/ui/components/alert"
 *
 * export function SyncAlertTitle() {
 *   return (
 *     <Alert>
 *       <AlertTitle>Sync complete</AlertTitle>
 *     </Alert>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3",
        className
      )}
      {...props}
    />
  );
}

/**
 * Supporting body copy inside an {@link Alert}.
 *
 * **Example** (Invite sent description body)
 *
 * ```tsx
 * import { Alert, AlertDescription, AlertTitle } from "@beep/ui/components/alert"
 *
 * export function InviteAlertDescription() {
 *   return (
 *     <Alert>
 *       <AlertTitle>Invite sent</AlertTitle>
 *       <AlertDescription>The teammate will receive a setup link by email.</AlertDescription>
 *     </Alert>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-muted-foreground text-sm text-balance md:text-pretty [&_p:not(:last-child)]:mb-4 [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3",
        className
      )}
      {...props}
    />
  );
}

/**
 * Right-aligned action slot for compact alert controls.
 *
 * **Example** (Retry button action slot)
 *
 * ```tsx
 * import { Alert, AlertAction, AlertDescription, AlertTitle } from "@beep/ui/components/alert"
 *
 * export function RetryAlertAction() {
 *   return (
 *     <Alert>
 *       <AlertTitle>Upload paused</AlertTitle>
 *       <AlertDescription>Reconnect to continue sending files.</AlertDescription>
 *       <AlertAction>
 *         <button type="button">Retry</button>
 *       </AlertAction>
 *     </Alert>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-action" className={cn("absolute top-2 right-2", className)} {...props} />;
}

/**
 * @category components
 * @since 0.0.0
 */
export { Alert, AlertAction, AlertDescription, AlertTitle };
