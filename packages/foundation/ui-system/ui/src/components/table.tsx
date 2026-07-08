/**
 * Table primitive: a styled `<table>` with header, body, row, and cell wrappers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { cn } from "../lib/index.ts";
import type * as React from "react";

/**
 * Table component.
 *
 * @example
 * ```tsx
 * import { Table } from "@beep/ui/components/table"
 *
 * console.log(Table)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table data-slot="table" className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

/**
 * Table header component.
 *
 * @example
 * ```tsx
 * import { TableHeader } from "@beep/ui/components/table"
 *
 * console.log(TableHeader)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

/**
 * Table body component.
 *
 * @example
 * ```tsx
 * import { TableBody } from "@beep/ui/components/table"
 *
 * console.log(TableBody)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

/**
 * Table footer component.
 *
 * @example
 * ```tsx
 * import { TableFooter } from "@beep/ui/components/table"
 *
 * console.log(TableFooter)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("bg-muted/50 border-t font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}

/**
 * Table row component.
 *
 * @example
 * ```tsx
 * import { TableRow } from "@beep/ui/components/table"
 *
 * console.log(TableRow)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn("hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors", className)}
      {...props}
    />
  );
}

/**
 * Table head component.
 *
 * @example
 * ```tsx
 * import { TableHead } from "@beep/ui/components/table"
 *
 * console.log(TableHead)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  );
}

/**
 * Table cell component.
 *
 * @example
 * ```tsx
 * import { TableCell } from "@beep/ui/components/table"
 *
 * console.log(TableCell)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    />
  );
}

/**
 * Table caption component.
 *
 * @example
 * ```tsx
 * import { TableCaption } from "@beep/ui/components/table"
 *
 * console.log(TableCaption)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption data-slot="table-caption" className={cn("text-muted-foreground mt-4 text-sm", className)} {...props} />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
