/**
 * Item primitive: a list-row layout with media, content, and action slots.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Separator } from "@beep/ui/components/separator";
import * as O from "@beep/utils/Option";
import { cva } from "class-variance-authority";
import { cn } from "../lib/index.ts";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

/**
 * Item group component.
 *
 * **Example** (Import ItemGroup component)
 *
 * ```tsx
 * import { ItemGroup } from "@beep/ui/components/item"
 *
 * console.log(ItemGroup)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ItemGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div role="list" data-slot="item-group" className={cn("group/item-group flex flex-col", className)} {...props} />
  );
}

/**
 * Item separator component.
 *
 * **Example** (Import ItemSeparator component)
 *
 * ```tsx
 * import { ItemSeparator } from "@beep/ui/components/item"
 *
 * console.log(ItemSeparator)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ItemSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return <Separator data-slot="item-separator" orientation="horizontal" className={cn("my-0", className)} {...props} />;
}

const itemVariants = cva(
  "group/item flex flex-wrap items-center rounded-md border border-transparent text-sm outline-none transition-colors duration-100 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-accent/50",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border-border",
        muted: "bg-muted/50",
      },
      size: {
        default: "gap-4 p-4",
        sm: "gap-2.5 px-4 py-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

/**
 * Item component.
 *
 * **Example** (Import Item component)
 *
 * ```tsx
 * import { Item } from "@beep/ui/components/item"
 *
 * console.log(Item)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Item({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof itemVariants>) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(itemVariants({ variant, size, className })),
      },
      {
        "data-slot": "item",
        "data-variant": variant,
        "data-size": size,
      } as React.ComponentProps<"div">,
      props
    ),
    ...O.getSomesStruct({ render: O.fromUndefinedOr(render) }),
    state: {
      slot: "item",
      variant,
      size,
    },
  });
}

const itemMediaVariants = cva(
  "flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=item-description]]/item:translate-y-0.5 group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "size-8 rounded-sm border bg-muted [&_svg:not([class*='size-'])]:size-4",
        image: "size-10 overflow-hidden rounded-sm [&_img]:size-full [&_img]:object-cover",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/**
 * Item media component.
 *
 * **Example** (Import ItemMedia component)
 *
 * ```tsx
 * import { ItemMedia } from "@beep/ui/components/item"
 *
 * console.log(ItemMedia)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ItemMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof itemMediaVariants>) {
  return (
    <div
      data-slot="item-media"
      data-variant={variant}
      className={cn(itemMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

/**
 * Item content component.
 *
 * **Example** (Import ItemContent component)
 *
 * ```tsx
 * import { ItemContent } from "@beep/ui/components/item"
 *
 * console.log(ItemContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-content"
      className={cn("flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none", className)}
      {...props}
    />
  );
}

/**
 * Item title component.
 *
 * **Example** (Import ItemTitle component)
 *
 * ```tsx
 * import { ItemTitle } from "@beep/ui/components/item"
 *
 * console.log(ItemTitle)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-title"
      className={cn("flex w-fit items-center gap-2 font-medium text-sm leading-snug", className)}
      {...props}
    />
  );
}

/**
 * Item description component.
 *
 * **Example** (Import ItemDescription component)
 *
 * ```tsx
 * import { ItemDescription } from "@beep/ui/components/item"
 *
 * console.log(ItemDescription)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ItemDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="item-description"
      className={cn(
        "line-clamp-2 text-balance font-normal text-muted-foreground text-sm leading-normal",
        "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
        className
      )}
      {...props}
    />
  );
}

/**
 * Item actions component.
 *
 * **Example** (Import ItemActions component)
 *
 * ```tsx
 * import { ItemActions } from "@beep/ui/components/item"
 *
 * console.log(ItemActions)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="item-actions" className={cn("flex items-center gap-2", className)} {...props} />;
}

/**
 * Item header component.
 *
 * **Example** (Import ItemHeader component)
 *
 * ```tsx
 * import { ItemHeader } from "@beep/ui/components/item"
 *
 * console.log(ItemHeader)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ItemHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-header"
      className={cn("flex basis-full items-center justify-between gap-2", className)}
      {...props}
    />
  );
}

/**
 * Item footer component.
 *
 * **Example** (Import ItemFooter component)
 *
 * ```tsx
 * import { ItemFooter } from "@beep/ui/components/item"
 *
 * console.log(ItemFooter)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ItemFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-footer"
      className={cn("flex basis-full items-center justify-between gap-2", className)}
      {...props}
    />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
};
