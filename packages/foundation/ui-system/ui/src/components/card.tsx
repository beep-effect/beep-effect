/**
 * Card primitive: a framed content container with standard and compact density.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { cn } from "../lib/index.ts";
import type * as React from "react";

/**
 * Framed content container with standard and compact density.
 *
 * @example
 * ```tsx
 * import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@beep/ui/components/card"
 *
 * export function BillingCard() {
 *   return (
 *     <Card size="sm">
 *       <CardHeader>
 *         <CardTitle>Billing</CardTitle>
 *         <CardDescription>Next invoice posts July 15.</CardDescription>
 *       </CardHeader>
 *       <CardContent>$248.00 due</CardContent>
 *     </Card>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { readonly size?: undefined | "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "ring-foreground/10 bg-card text-card-foreground gap-4 overflow-hidden rounded-xl py-4 text-sm ring-1 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl group/card flex flex-col",
        className
      )}
      {...props}
    />
  );
}

/**
 * Header grid for card title, description, and optional action.
 *
 * @example
 * ```tsx
 * import { CardAction, CardHeader, CardTitle } from "@beep/ui/components/card"
 *
 * export function CardHeaderWithAction() {
 *   return (
 *     <CardHeader>
 *       <CardTitle>Documents</CardTitle>
 *       <CardAction>12 files</CardAction>
 *     </CardHeader>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "gap-1 rounded-t-xl px-4 group-data-[size=sm]/card:px-3 [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3 group/card-header @container/card-header grid auto-rows-min items-start has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]",
        className
      )}
      {...props}
    />
  );
}

/**
 * Primary heading slot for a card.
 *
 * @example
 * ```tsx
 * import { CardTitle } from "@beep/ui/components/card"
 *
 * export function CardSectionTitle() {
 *   return <CardTitle>Recent activity</CardTitle>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-base leading-snug font-medium group-data-[size=sm]/card:text-sm", className)}
      {...props}
    />
  );
}

/**
 * Muted supporting text for a card heading.
 *
 * @example
 * ```tsx
 * import { CardDescription } from "@beep/ui/components/card"
 *
 * export function CardSubtitle() {
 *   return <CardDescription>Updated two minutes ago.</CardDescription>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-muted-foreground text-sm", className)} {...props} />;
}

/**
 * Top-right action slot in a card header.
 *
 * @example
 * ```tsx
 * import { Button } from "@beep/ui/components/button"
 * import { CardAction } from "@beep/ui/components/card"
 *
 * export function CardHeaderAction() {
 *   return (
 *     <CardAction>
 *       <Button size="sm" variant="outline">Open</Button>
 *     </CardAction>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

/**
 * Main body area for a card.
 *
 * @example
 * ```tsx
 * import { CardContent } from "@beep/ui/components/card"
 *
 * export function CardMetricContent() {
 *   return <CardContent className="font-mono">$12,480</CardContent>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-4 group-data-[size=sm]/card:px-3", className)} {...props} />;
}

/**
 * Footer band for card totals, metadata, or secondary actions.
 *
 * @example
 * ```tsx
 * import { Button } from "@beep/ui/components/button"
 * import { CardFooter } from "@beep/ui/components/card"
 *
 * export function CardFooterActions() {
 *   return (
 *     <CardFooter className="justify-end gap-2">
 *       <Button variant="ghost" size="sm">Cancel</Button>
 *       <Button size="sm">Save</Button>
 *     </CardFooter>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("bg-muted/50 rounded-b-xl border-t p-4 group-data-[size=sm]/card:p-3 flex items-center", className)}
      {...props}
    />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
