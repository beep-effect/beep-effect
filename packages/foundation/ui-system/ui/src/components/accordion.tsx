/**
 * Accordion primitive: a vertically stacked, single- or multi-item disclosure group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import { cn } from "../lib/index.ts";

/**
 * Root container for a vertically stacked disclosure group.
 *
 * @example
 * ```tsx
 * import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@beep/ui/components/accordion"
 *
 * export function BillingAccordion() {
 *   return (
 *     <Accordion>
 *       <AccordionItem value="invoices">
 *         <AccordionTrigger>Invoices</AccordionTrigger>
 *         <AccordionContent>Download current and past invoices.</AccordionContent>
 *       </AccordionItem>
 *     </Accordion>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return <AccordionPrimitive.Root data-slot="accordion" className={cn("flex w-full flex-col", className)} {...props} />;
}

/**
 * Disclosure item that owns one trigger/content pair.
 *
 * @example
 * ```tsx
 * import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@beep/ui/components/accordion"
 *
 * export function SecurityAccordionItem() {
 *   return (
 *     <Accordion>
 *       <AccordionItem value="security">
 *         <AccordionTrigger>Security</AccordionTrigger>
 *         <AccordionContent>Manage passkeys and recovery codes.</AccordionContent>
 *       </AccordionItem>
 *     </Accordion>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item data-slot="accordion-item" className={cn("not-last:border-b", className)} {...props} />
  );
}

/**
 * Button-like control that toggles its accordion panel.
 *
 * @example
 * ```tsx
 * import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@beep/ui/components/accordion"
 *
 * export function PreferencesTrigger() {
 *   return (
 *     <Accordion>
 *       <AccordionItem value="preferences">
 *         <AccordionTrigger>Preferences</AccordionTrigger>
 *         <AccordionContent>Update notification defaults.</AccordionContent>
 *       </AccordionItem>
 *     </Accordion>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "focus-visible:ring-ring/50 focus-visible:border-ring focus-visible:after:border-ring **:data-[slot=accordion-trigger-icon]:text-muted-foreground rounded-lg py-2.5 text-left text-sm font-medium hover:underline focus-visible:ring-[3px] **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 group/accordion-trigger relative flex flex-1 items-start justify-between border border-transparent transition-all outline-none disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
        <CaretDownIcon
          data-slot="accordion-trigger-icon"
          className="pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden"
        />
        <CaretUpIcon
          data-slot="accordion-trigger-icon"
          className="pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

/**
 * Collapsible panel content for an accordion item.
 *
 * @example
 * ```tsx
 * import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@beep/ui/components/accordion"
 *
 * export function DetailsAccordionContent() {
 *   return (
 *     <Accordion>
 *       <AccordionItem value="details">
 *         <AccordionTrigger>Details</AccordionTrigger>
 *         <AccordionContent>
 *           <p>Owner, status, and billing metadata stay grouped in this panel.</p>
 *         </AccordionContent>
 *       </AccordionItem>
 *     </Accordion>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AccordionContent({ className, children, ...props }: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="data-open:animate-accordion-down data-closed:animate-accordion-up text-sm overflow-hidden"
      {...props}
    >
      <div
        className={cn(
          "pt-0 pb-2.5 [&_a]:hover:text-foreground h-(--accordion-panel-height) data-ending-style:h-0 data-starting-style:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4",
          className
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
