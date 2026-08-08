/**
 * Tabs primitive: a tabbed panel root built on Base UI's tabs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva } from "class-variance-authority";
import { cn } from "../lib/index.ts";
import type { VariantProps } from "class-variance-authority";

/**
 * Tabs component.
 *
 * **Example** (Import Tabs component)
 *
 * ```tsx
 * import { Tabs } from "@beep/ui/components/tabs"
 *
 * console.log(Tabs)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("gap-2 group/tabs flex data-[orientation=horizontal]:flex-col", className)}
      {...props}
    />
  );
}

/**
 * Tabs list variants component.
 *
 * **Example** (Import tabsListVariants)
 *
 * ```tsx
 * import { tabsListVariants } from "@beep/ui/components/tabs"
 *
 * console.log(tabsListVariants)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const tabsListVariants = cva(
  "rounded-lg p-[3px] group-data-horizontal/tabs:h-8 data-[variant=line]:rounded-none group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/**
 * Tabs list component.
 *
 * **Example** (Import TabsList component)
 *
 * ```tsx
 * import { TabsList } from "@beep/ui/components/tabs"
 *
 * console.log(TabsList)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

/**
 * Tabs trigger component.
 *
 * **Example** (Import TabsTrigger component)
 *
 * ```tsx
 * import { TabsTrigger } from "@beep/ui/components/tabs"
 *
 * console.log(TabsTrigger)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg:not([class*='size-'])]:size-4 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center whitespace-nowrap transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background dark:data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 data-active:text-foreground",
        "after:bg-foreground after:absolute after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  );
}

/**
 * Tabs content component.
 *
 * **Example** (Import TabsContent component)
 *
 * ```tsx
 * import { TabsContent } from "@beep/ui/components/tabs"
 *
 * console.log(TabsContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel data-slot="tabs-content" className={cn("text-sm flex-1 outline-none", className)} {...props} />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants };
