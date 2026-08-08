/**
 * Resizable primitive: a resizable panel group built on react-resizable-panels.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Group, Panel, Separator } from "react-resizable-panels";
import { cn } from "../lib/index.ts";
import type * as React from "react";

/**
 * Resizable panel group component.
 *
 * **Example** (Import ResizablePanelGroup)
 *
 * ```tsx
 * import { ResizablePanelGroup } from "@beep/ui/components/resizable"
 *
 * console.log(ResizablePanelGroup)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ResizablePanelGroup({ className, ...props }: React.ComponentProps<typeof Group>) {
  return <Group data-slot="resizable-panel-group" className={cn("flex h-full w-full", className)} {...props} />;
}

/**
 * Resizable panel component.
 *
 * **Example** (Import ResizablePanel component)
 *
 * ```tsx
 * import { ResizablePanel } from "@beep/ui/components/resizable"
 *
 * console.log(ResizablePanel)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ResizablePanel({ ...props }: React.ComponentProps<typeof Panel>) {
  return <Panel data-slot="resizable-panel" {...props} />;
}

interface ResizableHandleProps extends React.ComponentProps<typeof Separator> {
  readonly orientation?: undefined | "horizontal" | "vertical";
  readonly withHandle?: undefined | boolean;
}

/**
 * Resizable handle component.
 *
 * **Example** (Import ResizableHandle component)
 *
 * ```tsx
 * import { ResizableHandle } from "@beep/ui/components/resizable"
 *
 * console.log(ResizableHandle)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ResizableHandle({ withHandle, orientation = "horizontal", className, ...props }: ResizableHandleProps) {
  const isVertical = orientation === "vertical";

  // Style the separator itself as the visual handle - no children to avoid event interference
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        "relative bg-transparent transition-colors hover:bg-muted-foreground/20",
        isVertical ? "h-2 w-full cursor-row-resize" : "h-full w-2 cursor-col-resize",
        withHandle &&
          (isVertical
            ? "before:absolute before:left-1/2 before:top-1/2 before:h-1 before:w-10 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-muted-foreground/40"
            : "before:absolute before:left-1/2 before:top-1/2 before:h-8 before:w-1 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-muted-foreground/40"),
        className
      )}
      {...props}
    />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
