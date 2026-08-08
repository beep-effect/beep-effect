/**
 * Breadcrumb primitive: a navigation landmark rendering a hierarchical page trail.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { CaretRightIcon, DotsThreeIcon } from "@phosphor-icons/react";
import { cn } from "../lib/index.ts";
import type * as React from "react";

/**
 * Navigation landmark for a hierarchical page trail.
 *
 * **Example** (Matters engagement trail)
 *
 * ```tsx
 * import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@beep/ui/components/breadcrumb"
 *
 * export function MatterBreadcrumb() {
 *   return (
 *     <Breadcrumb>
 *       <BreadcrumbList>
 *         <BreadcrumbItem><BreadcrumbLink href="/matters">Matters</BreadcrumbLink></BreadcrumbItem>
 *         <BreadcrumbSeparator />
 *         <BreadcrumbItem><BreadcrumbPage>Engagement letter</BreadcrumbPage></BreadcrumbItem>
 *       </BreadcrumbList>
 *     </Breadcrumb>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Breadcrumb({ ...props }: React.ComponentPropsWithoutRef<"nav">) {
  return <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />;
}

/**
 * Ordered list container for breadcrumb items and separators.
 *
 * **Example** (List with custom gap)
 *
 * ```tsx
 * import { BreadcrumbList } from "@beep/ui/components/breadcrumb"
 *
 * export function BreadcrumbTrailList() {
 *   return <BreadcrumbList className="gap-2">Dashboard</BreadcrumbList>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function BreadcrumbList({ className, ...props }: React.ComponentPropsWithoutRef<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5",
        className
      )}
      {...props}
    />
  );
}

/**
 * List item wrapper for one breadcrumb link, page, or separator.
 *
 * **Example** (Linked matter item)
 *
 * ```tsx
 * import { BreadcrumbItem, BreadcrumbLink } from "@beep/ui/components/breadcrumb"
 *
 * export function BreadcrumbMatterItem() {
 *   return (
 *     <BreadcrumbItem>
 *       <BreadcrumbLink href="/matters/42">Matter 42</BreadcrumbLink>
 *     </BreadcrumbItem>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function BreadcrumbItem({ className, ...props }: React.ComponentPropsWithoutRef<"li">) {
  return <li data-slot="breadcrumb-item" className={cn("inline-flex items-center gap-1.5", className)} {...props} />;
}

/**
 * Navigable breadcrumb segment.
 *
 * **Example** (Clients navigation link)
 *
 * ```tsx
 * import { BreadcrumbLink } from "@beep/ui/components/breadcrumb"
 *
 * export function BreadcrumbBackLink() {
 *   return <BreadcrumbLink href="/clients">Clients</BreadcrumbLink>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function BreadcrumbLink({ className, ...props }: React.ComponentPropsWithoutRef<"a">) {
  return (
    <a data-slot="breadcrumb-link" className={cn("hover:text-foreground transition-colors", className)} {...props} />
  );
}

/**
 * Non-interactive breadcrumb segment for the current page.
 *
 * **Example** (Current invoice page)
 *
 * ```tsx
 * import { BreadcrumbPage } from "@beep/ui/components/breadcrumb"
 *
 * export function CurrentBreadcrumbPage() {
 *   return <BreadcrumbPage>Invoice review</BreadcrumbPage>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function BreadcrumbPage({ className, ...props }: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("text-foreground font-normal", className)}
      {...props}
    />
  );
}

/**
 * Decorative separator between breadcrumb items.
 *
 * **Example** (Custom slash separator)
 *
 * ```tsx
 * import { BreadcrumbSeparator } from "@beep/ui/components/breadcrumb"
 *
 * export function SlashBreadcrumbSeparator() {
 *   return <BreadcrumbSeparator>/</BreadcrumbSeparator>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function BreadcrumbSeparator({ children, className, ...props }: React.ComponentPropsWithoutRef<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? <CaretRightIcon />}
    </li>
  );
}

/**
 * Compact placeholder for collapsed breadcrumb segments.
 *
 * **Example** (Collapsed segment ellipsis)
 *
 * ```tsx
 * import { BreadcrumbEllipsis, BreadcrumbItem } from "@beep/ui/components/breadcrumb"
 *
 * export function CollapsedBreadcrumbItems() {
 *   return (
 *     <BreadcrumbItem>
 *       <BreadcrumbEllipsis />
 *     </BreadcrumbItem>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function BreadcrumbEllipsis({ className, ...props }: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <DotsThreeIcon className="size-4" />
      <span className="sr-only">More</span>
    </span>
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
