/**
 * Hover-card primitive: a pointer-triggered preview card built on Base UI's hover card.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import { cn } from "../lib/index.ts";

/**
 * Hover card component.
 *
 * @example
 * ```tsx
 * import { HoverCard } from "@beep/ui/components/hover-card"
 *
 * console.log(HoverCard)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function HoverCard({ ...props }: PreviewCardPrimitive.Root.Props) {
  return <PreviewCardPrimitive.Root data-slot="hover-card" {...props} />;
}

/**
 * Hover card trigger component.
 *
 * @example
 * ```tsx
 * import { HoverCardTrigger } from "@beep/ui/components/hover-card"
 *
 * console.log(HoverCardTrigger)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function HoverCardTrigger({ ...props }: PreviewCardPrimitive.Trigger.Props) {
  return <PreviewCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />;
}

/**
 * Hover card content component.
 *
 * @example
 * ```tsx
 * import { HoverCardContent } from "@beep/ui/components/hover-card"
 *
 * console.log(HoverCardContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function HoverCardContent({
  className,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 4,
  ...props
}: PreviewCardPrimitive.Popup.Props &
  Pick<PreviewCardPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  return (
    <PreviewCardPrimitive.Portal data-slot="hover-card-portal">
      <PreviewCardPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PreviewCardPrimitive.Popup
          data-slot="hover-card-content"
          className={cn(
            "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 bg-popover text-popover-foreground w-64 rounded-lg p-2.5 text-sm shadow-md ring-1 duration-100 z-50 origin-(--transform-origin) outline-hidden",
            className
          )}
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { HoverCard, HoverCardContent, HoverCardTrigger };
