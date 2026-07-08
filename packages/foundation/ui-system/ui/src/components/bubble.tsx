/**
 * Bubble primitive: a vertical stack layout for chat bubbles or message fragments.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@beep/ui/lib/utils";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

/**
 * Vertical stack for chat bubbles or message fragments.
 *
 * @example
 * ```tsx
 * import { Bubble, BubbleContent, BubbleGroup } from "@beep/ui/components/bubble"
 *
 * export function ConversationBubbleGroup() {
 *   return (
 *     <BubbleGroup>
 *       <Bubble><BubbleContent>Can you review the draft?</BubbleContent></Bubble>
 *       <Bubble align="end" variant="secondary"><BubbleContent>Already on it.</BubbleContent></Bubble>
 *     </BubbleGroup>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function BubbleGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="bubble-group" className={cn("flex min-w-0 flex-col gap-2", className)} {...props} />;
}

const bubbleVariants = cva(
  "group/bubble relative flex w-fit max-w-[80%] min-w-0 flex-col gap-1 group-data-[align=end]/message:self-end data-[align=end]:self-end data-[variant=ghost]:max-w-full",
  {
    variants: {
      variant: {
        default:
          "*:data-[slot=bubble-content]:bg-primary *:data-[slot=bubble-content]:text-primary-foreground [&>[data-slot=bubble-content]:is(button,a):hover]:bg-primary/80",
        secondary:
          "*:data-[slot=bubble-content]:bg-secondary *:data-[slot=bubble-content]:text-secondary-foreground [&>[data-slot=bubble-content]:is(button,a):hover]:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
        muted:
          "*:data-[slot=bubble-content]:bg-muted [&>[data-slot=bubble-content]:is(button,a):hover]:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_5%)]",
        tinted:
          "*:data-[slot=bubble-content]:bg-[oklch(from_var(--primary)_0.93_calc(c*0.4)_h)] *:data-[slot=bubble-content]:text-foreground dark:*:data-[slot=bubble-content]:bg-[oklch(from_var(--primary)_0.3_calc(c*0.4)_h)] [&>[data-slot=bubble-content]:is(button,a):hover]:bg-[oklch(from_var(--primary)_0.88_calc(c*0.5)_h)] dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-[oklch(from_var(--primary)_0.35_calc(c*0.5)_h)]",
        outline:
          "*:data-[slot=bubble-content]:border-border *:data-[slot=bubble-content]:bg-background [&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted [&>[data-slot=bubble-content]:is(button,a):hover]:text-foreground dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-input/30",
        ghost:
          "border-none *:data-[slot=bubble-content]:rounded-none *:data-[slot=bubble-content]:bg-transparent *:data-[slot=bubble-content]:p-0 [&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted [&>[data-slot=bubble-content]:is(button,a):hover]:text-foreground dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted/50",
        destructive:
          "*:data-[slot=bubble-content]:bg-destructive/10 *:data-[slot=bubble-content]:text-destructive dark:*:data-[slot=bubble-content]:bg-destructive/20 [&>[data-slot=bubble-content]:is(button,a):hover]:bg-destructive/20 dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-destructive/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/**
 * Chat bubble wrapper with alignment and color variants.
 *
 * @example
 * ```tsx
 * import { Bubble, BubbleContent, BubbleReactions } from "@beep/ui/components/bubble"
 *
 * export function OutboundChatBubble() {
 *   return (
 *     <Bubble align="end" variant="tinted">
 *       <BubbleContent>The engagement letter is ready.</BubbleContent>
 *       <BubbleReactions side="bottom" align="end">Seen</BubbleReactions>
 *     </Bubble>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Bubble({
  variant = "default",
  align = "start",
  className,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof bubbleVariants> & {
    readonly align?: "start" | "end";
  }) {
  return (
    <div
      data-slot="bubble"
      data-variant={variant}
      data-align={align}
      className={cn(bubbleVariants({ variant }), className)}
      {...props}
    />
  );
}

/**
 * Renderable content surface inside a chat bubble.
 *
 * @example
 * ```tsx
 * import { Bubble, BubbleContent } from "@beep/ui/components/bubble"
 *
 * export function LinkedBubbleContent() {
 *   return (
 *     <Bubble variant="outline">
 *       <BubbleContent render={<a href="/matters/42" />}>Open matter</BubbleContent>
 *     </Bubble>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function BubbleContent({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "w-fit max-w-full min-w-0 overflow-hidden rounded-xl border border-transparent px-3 py-2 text-sm leading-relaxed wrap-break-word group-data-[align=end]/bubble:self-end [button]:text-left [button,a]:transition-colors [button,a]:outline-none [button,a]:focus-visible:border-ring [button,a]:focus-visible:ring-3 [button,a]:focus-visible:ring-ring/50",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "bubble-content",
    },
  });
}

const bubbleReactionsVariants = cva(
  "absolute z-10 flex w-fit shrink-0 items-center justify-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-sm ring-3 ring-card has-[button]:p-0",
  {
    variants: {
      side: {
        top: "top-0 -translate-y-3/4",
        bottom: "bottom-0 translate-y-3/4",
      },
      align: {
        start: "left-3",
        end: "right-3",
      },
    },
    defaultVariants: {
      side: "bottom",
      align: "end",
    },
  }
);

/**
 * Floating reaction strip anchored to a bubble.
 *
 * @example
 * ```tsx
 * import { Bubble, BubbleContent, BubbleReactions } from "@beep/ui/components/bubble"
 *
 * export function BubbleWithTopReactions() {
 *   return (
 *     <Bubble variant="muted">
 *       <BubbleContent>Filed with the court.</BubbleContent>
 *       <BubbleReactions side="top" align="start">+1</BubbleReactions>
 *     </Bubble>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function BubbleReactions({
  side = "bottom",
  align = "end",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  readonly align?: "start" | "end";
  readonly side?: "top" | "bottom";
}) {
  return (
    <div
      data-slot="bubble-reactions"
      data-align={align}
      data-side={side}
      className={cn(bubbleReactionsVariants({ side, align }), className)}
      {...props}
    />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { Bubble, BubbleContent, BubbleGroup, BubbleReactions };
