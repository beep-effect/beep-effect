/**
 * Button-group primitive: class factory for segmented horizontal or vertical button groups.
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

/**
 * Class factory for segmented horizontal or vertical button groups.
 *
 * @example
 * ```tsx
 * import { strictEqual } from "node:assert"
 * import { buttonGroupVariants } from "@beep/ui/components/button-group"
 *
 * const horizontal = buttonGroupVariants({ orientation: "horizontal" })
 * const vertical = buttonGroupVariants({ orientation: "vertical" })
 * const classes = `${horizontal} ${vertical}`
 * strictEqual(classes.includes("flex-col"), true)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const buttonGroupVariants = cva(
  "flex w-fit items-stretch has-[>[data-slot=button-group]]:gap-2 [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  {
    variants: {
      orientation: {
        horizontal:
          "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none",
        vertical:
          "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  }
);

/**
 * Segmented control container for adjacent buttons and inputs.
 *
 * @example
 * ```tsx
 * import { Button } from "@beep/ui/components/button"
 * import { ButtonGroup } from "@beep/ui/components/button-group"
 *
 * export function ApprovalButtonGroup() {
 *   return (
 *     <ButtonGroup orientation="horizontal">
 *       <Button variant="outline">Reject</Button>
 *       <Button>Approve</Button>
 *     </ButtonGroup>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ButtonGroup({
  className,
  orientation,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  );
}

/**
 * Non-interactive text segment that aligns with grouped controls.
 *
 * @example
 * ```tsx
 * import { Button } from "@beep/ui/components/button"
 * import { ButtonGroup, ButtonGroupText } from "@beep/ui/components/button-group"
 *
 * export function CurrencyButtonGroup() {
 *   return (
 *     <ButtonGroup>
 *       <ButtonGroupText>USD</ButtonGroupText>
 *       <Button variant="outline">Convert</Button>
 *     </ButtonGroup>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ButtonGroupText({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "flex items-center gap-2 rounded-md border bg-muted px-4 font-medium text-sm shadow-xs [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
          className
        ),
      },
      props
    ),
    ...O.getSomesStruct({ render: O.fromUndefinedOr(render) }),
    state: {
      slot: "button-group-text",
    },
  });
}

/**
 * Divider that matches grouped button orientation.
 *
 * @example
 * ```tsx
 * import { Button } from "@beep/ui/components/button"
 * import { ButtonGroup, ButtonGroupSeparator } from "@beep/ui/components/button-group"
 *
 * export function SplitActionGroup() {
 *   return (
 *     <ButtonGroup>
 *       <Button>Save</Button>
 *       <ButtonGroupSeparator orientation="vertical" />
 *       <Button variant="outline">Save as</Button>
 *     </ButtonGroup>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={orientation}
      className={cn("!m-0 relative self-stretch bg-input data-[orientation=vertical]:h-auto", className)}
      {...props}
    />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText, buttonGroupVariants };
