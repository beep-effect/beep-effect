/**
 * Pagination primitive: page-link controls composed from the shared button variants.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Button } from "@beep/ui/components/button";
import { CaretLeftIcon, CaretRightIcon, DotsThreeIcon } from "@phosphor-icons/react";
import { cn } from "../lib/index.ts";
import type * as React from "react";

/**
 * Pagination component.
 *
 * **Example** (Import Pagination component)
 *
 * ```tsx
 * import { Pagination } from "@beep/ui/components/pagination"
 *
 * console.log(Pagination)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

/**
 * Pagination content component.
 *
 * **Example** (Import PaginationContent component)
 *
 * ```tsx
 * import { PaginationContent } from "@beep/ui/components/pagination"
 *
 * console.log(PaginationContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="pagination-content" className={cn("gap-0.5 flex items-center", className)} {...props} />;
}

/**
 * Pagination item component.
 *
 * **Example** (Import PaginationItem component)
 *
 * ```tsx
 * import { PaginationItem } from "@beep/ui/components/pagination"
 *
 * console.log(PaginationItem)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
  readonly isActive?: undefined | boolean;
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<"a">;

/**
 * Pagination link component.
 *
 * **Example** (Import PaginationLink component)
 *
 * ```tsx
 * import { PaginationLink } from "@beep/ui/components/pagination"
 *
 * console.log(PaginationLink)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function PaginationLink({ className, isActive, size = "icon", ...props }: PaginationLinkProps) {
  const active = isActive === true;

  return (
    <Button
      variant={active ? "outline" : "ghost"}
      size={size}
      className={cn(className)}
      nativeButton={false}
      render={
        <a aria-current={active ? "page" : undefined} data-slot="pagination-link" data-active={active} {...props} />
      }
    />
  );
}

/**
 * Pagination previous component.
 *
 * **Example** (Import PaginationPrevious component)
 *
 * ```tsx
 * import { PaginationPrevious } from "@beep/ui/components/pagination"
 *
 * console.log(PaginationPrevious)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function PaginationPrevious({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink aria-label="Go to previous page" size="default" className={cn("pl-1.5!", className)} {...props}>
      <CaretLeftIcon data-icon="inline-start" />
      <span className="hidden sm:block">Previous</span>
    </PaginationLink>
  );
}

/**
 * Pagination next component.
 *
 * **Example** (Import PaginationNext component)
 *
 * ```tsx
 * import { PaginationNext } from "@beep/ui/components/pagination"
 *
 * console.log(PaginationNext)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function PaginationNext({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink aria-label="Go to next page" size="default" className={cn("pr-1.5!", className)} {...props}>
      <span className="hidden sm:block">Next</span>
      <CaretRightIcon data-icon="inline-end" />
    </PaginationLink>
  );
}

/**
 * Pagination ellipsis component.
 *
 * **Example** (Import PaginationEllipsis component)
 *
 * ```tsx
 * import { PaginationEllipsis } from "@beep/ui/components/pagination"
 *
 * console.log(PaginationEllipsis)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        "size-8 items-center justify-center [&_svg:not([class*='size-'])]:size-4 flex items-center justify-center",
        className
      )}
      {...props}
    >
      <DotsThreeIcon />
      <span className="sr-only">More pages</span>
    </span>
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
