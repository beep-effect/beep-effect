/**
 * Collapsible primitive: a disclosure root for content that expands and collapses.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { cn } from "../lib/index.ts";

/**
 * Disclosure root for content that can expand and collapse.
 *
 * **Example** (Default open filters panel)
 *
 * ```tsx
 * import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@beep/ui/components/collapsible"
 *
 * export function AdvancedFilters() {
 *   return (
 *     <Collapsible defaultOpen>
 *       <CollapsibleTrigger>Filters</CollapsibleTrigger>
 *       <CollapsibleContent>Status, owner, and due date filters.</CollapsibleContent>
 *     </Collapsible>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Collapsible({ className, ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" className={cn(className)} {...props} />;
}

/**
 * Control that toggles a collapsible panel.
 *
 * **Example** (Show filters trigger)
 *
 * ```tsx
 * import { CollapsibleTrigger } from "@beep/ui/components/collapsible"
 *
 * export function FiltersTrigger() {
 *   return <CollapsibleTrigger>Show filters</CollapsibleTrigger>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CollapsibleTrigger({ className, ...props }: CollapsiblePrimitive.Trigger.Props) {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" className={cn(className)} {...props} />;
}

/**
 * Animated panel body for collapsible content.
 *
 * **Example** (Overdue filters content)
 *
 * ```tsx
 * import { CollapsibleContent } from "@beep/ui/components/collapsible"
 *
 * export function FiltersContent() {
 *   return <CollapsibleContent>Only show overdue matters.</CollapsibleContent>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CollapsibleContent({ className, ...props }: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      className={cn("overflow-hidden transition-all data-[ending-style]:h-0 data-[starting-style]:h-0", className)}
      {...props}
    />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { Collapsible, CollapsibleContent, CollapsibleTrigger };
