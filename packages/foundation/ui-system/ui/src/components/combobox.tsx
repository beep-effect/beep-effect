/**
 * Combobox primitive: an editable, filterable select root built on Base UI's combobox.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { Button } from "@beep/ui/components/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@beep/ui/components/input-group";
import { CaretDownIcon, CheckIcon, XIcon } from "@phosphor-icons/react";
import * as React from "react";
import { cn } from "../lib/index.ts";

/**
 * Editable, filterable select root built on Base UI's combobox primitive.
 *
 * @example
 * ```tsx
 * import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from "@beep/ui/components/combobox"
 *
 * export function FrameworkCombobox() {
 *   return (
 *     <Combobox items={["Next.js", "Remix"]}>
 *       <ComboboxInput placeholder="Select framework..." aria-label="Framework" />
 *       <ComboboxContent>
 *         <ComboboxList>
 *           <ComboboxItem value="Next.js">Next.js</ComboboxItem>
 *           <ComboboxItem value="Remix">Remix</ComboboxItem>
 *         </ComboboxList>
 *       </ComboboxContent>
 *     </Combobox>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const Combobox = ComboboxPrimitive.Root;

/**
 * Current combobox value renderer for custom display or chips.
 *
 * @example
 * ```tsx
 * import { Combobox, ComboboxInput, ComboboxValue } from "@beep/ui/components/combobox"
 *
 * export function ComboboxValuePreview() {
 *   return (
 *     <Combobox items={["Open", "Closed"]} defaultValue="Open">
 *       <ComboboxInput aria-label="Status">
 *         <ComboboxValue placeholder="Select status" />
 *       </ComboboxInput>
 *     </Combobox>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />;
}

/**
 * Button affordance that opens the combobox popup.
 *
 * @example
 * ```tsx
 * import { Combobox, ComboboxInput, ComboboxTrigger } from "@beep/ui/components/combobox"
 *
 * export function ComboboxWithTrigger() {
 *   return (
 *     <Combobox items={["Open", "Closed"]}>
 *       <ComboboxInput showTrigger={false} aria-label="Status">
 *         <ComboboxTrigger aria-label="Open status options" />
 *       </ComboboxInput>
 *     </Combobox>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ComboboxTrigger({ className, children, ...props }: ComboboxPrimitive.Trigger.Props) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn("[&_svg:not([class*='size-'])]:size-4", className)}
      {...props}
    >
      {children}
      <CaretDownIcon className="text-muted-foreground size-4 pointer-events-none" />
    </ComboboxPrimitive.Trigger>
  );
}

function ComboboxClear({ className, ...props }: ComboboxPrimitive.Clear.Props) {
  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      render={<InputGroupButton variant="ghost" size="icon-xs" />}
      className={cn(className)}
      {...props}
    >
      <XIcon className="pointer-events-none" />
    </ComboboxPrimitive.Clear>
  );
}

/**
 * Text input wrapper with optional trigger and clear controls.
 *
 * @example
 * ```tsx
 * import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from "@beep/ui/components/combobox"
 *
 * export function ClearableStatusCombobox() {
 *   return (
 *     <Combobox items={["Open", "Closed"]} defaultValue="Open">
 *       <ComboboxInput showClear placeholder="Select status..." aria-label="Status" />
 *       <ComboboxContent>
 *         <ComboboxList>
 *           <ComboboxItem value="Open">Open</ComboboxItem>
 *           <ComboboxItem value="Closed">Closed</ComboboxItem>
 *         </ComboboxList>
 *       </ComboboxContent>
 *     </Combobox>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ComboboxInput({
  className,
  children,
  disabled = false,
  showTrigger = true,
  showClear = false,
  ...props
}: ComboboxPrimitive.Input.Props & {
  readonly showTrigger?: undefined | boolean;
  readonly showClear?: undefined | boolean;
}) {
  return (
    <InputGroup className={cn("w-auto", className)}>
      <ComboboxPrimitive.Input render={<InputGroupInput disabled={disabled} />} {...props} />
      <InputGroupAddon align="inline-end">
        {showTrigger && (
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            render={<ComboboxTrigger />}
            data-slot="input-group-button"
            className="group-has-data-[slot=combobox-clear]/input-group:hidden data-[pressed]:bg-transparent"
            disabled={disabled}
          />
        )}
        {showClear && <ComboboxClear disabled={disabled} />}
      </InputGroupAddon>
      {children}
    </InputGroup>
  );
}

/**
 * Positioned popup surface for combobox options.
 *
 * @example
 * ```tsx
 * import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from "@beep/ui/components/combobox"
 *
 * export function AlignedComboboxContent() {
 *   return (
 *     <Combobox items={["Client", "Matter"]}>
 *       <ComboboxInput aria-label="Scope" />
 *       <ComboboxContent side="bottom" align="start" sideOffset={8}>
 *         <ComboboxList>
 *           <ComboboxItem value="Client">Client</ComboboxItem>
 *           <ComboboxItem value="Matter">Matter</ComboboxItem>
 *         </ComboboxList>
 *       </ComboboxContent>
 *     </Combobox>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ComboboxContent({
  className,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  anchor,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<ComboboxPrimitive.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset" | "anchor">) {
  const hasAnchor = anchor !== undefined && anchor !== null;

  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        {...(hasAnchor ? { anchor } : {})}
        className="isolate z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          data-chips={hasAnchor}
          className={cn(
            "bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:border-input/30 max-h-72 min-w-36 overflow-hidden rounded-lg shadow-md ring-1 duration-100 *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:shadow-none group/combobox-content relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) data-[chips=true]:min-w-(--anchor-width)",
            className
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

/**
 * Scrollable listbox container for combobox items.
 *
 * @example
 * ```tsx
 * import { ComboboxItem, ComboboxList } from "@beep/ui/components/combobox"
 *
 * export function StatusOptionList() {
 *   return (
 *     <ComboboxList>
 *       <ComboboxItem value="open">Open</ComboboxItem>
 *       <ComboboxItem value="closed">Closed</ComboboxItem>
 *     </ComboboxList>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        "no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 overflow-y-auto p-1 data-empty:p-0 overflow-y-auto overscroll-contain",
        className
      )}
      {...props}
    />
  );
}

/**
 * Selectable option row with checked-state indicator.
 *
 * @example
 * ```tsx
 * import { ComboboxItem } from "@beep/ui/components/combobox"
 *
 * export function OpenStatusOption() {
 *   return <ComboboxItem value="open">Open</ComboboxItem>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ComboboxItem({ className, children, ...props }: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground gap-2 rounded-md py-1 pr-8 pl-1.5 text-sm [&_svg:not([class*='size-'])]:size-4 relative flex w-full cursor-default items-center outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator
        render={<span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />}
      >
        <CheckIcon className="pointer-events-none" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

/**
 * Option group for sectioning a combobox list.
 *
 * @example
 * ```tsx
 * import { ComboboxGroup, ComboboxItem, ComboboxLabel } from "@beep/ui/components/combobox"
 *
 * export function GroupedMatterOptions() {
 *   return (
 *     <ComboboxGroup>
 *       <ComboboxLabel>Matters</ComboboxLabel>
 *       <ComboboxItem value="active">Active matters</ComboboxItem>
 *     </ComboboxGroup>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
  return <ComboboxPrimitive.Group data-slot="combobox-group" className={cn(className)} {...props} />;
}

/**
 * Muted label for an option group.
 *
 * @example
 * ```tsx
 * import { ComboboxLabel } from "@beep/ui/components/combobox"
 *
 * export function StatusGroupLabel() {
 *   return <ComboboxLabel>Status</ComboboxLabel>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ComboboxLabel({ className, ...props }: ComboboxPrimitive.GroupLabel.Props) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  );
}

/**
 * Collection boundary for combobox items that are rendered outside the list.
 *
 * @example
 * ```tsx
 * import { ComboboxCollection, ComboboxItem } from "@beep/ui/components/combobox"
 *
 * export function ComboboxCollectionOptions() {
 *   return (
 *     <ComboboxCollection>
 *       {(item) => (
 *         <ComboboxItem key={String(item)} value={item}>
 *           {String(item)}
 *         </ComboboxItem>
 *       )}
 *     </ComboboxCollection>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ComboboxCollection({ ...props }: ComboboxPrimitive.Collection.Props) {
  return <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />;
}

/**
 * Empty-state row shown when filtering leaves no options.
 *
 * @example
 * ```tsx
 * import { ComboboxEmpty } from "@beep/ui/components/combobox"
 *
 * export function NoOptionsMessage() {
 *   return <ComboboxEmpty>No matters found.</ComboboxEmpty>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(
        "text-muted-foreground hidden w-full justify-center py-2 text-center text-sm group-data-empty/combobox-content:flex",
        className
      )}
      {...props}
    />
  );
}

/**
 * Divider between combobox option groups.
 *
 * @example
 * ```tsx
 * import { ComboboxGroup, ComboboxLabel, ComboboxSeparator } from "@beep/ui/components/combobox"
 *
 * export function SeparatedComboboxGroup() {
 *   return (
 *     <ComboboxGroup>
 *       <ComboboxSeparator />
 *       <ComboboxLabel>Archived</ComboboxLabel>
 *     </ComboboxGroup>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ComboboxSeparator({ className, ...props }: ComboboxPrimitive.Separator.Props) {
  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

/**
 * Multi-select chip container that also anchors the popup.
 *
 * @example
 * ```tsx
 * import { Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput, ComboboxValue } from "@beep/ui/components/combobox"
 *
 * export function AssigneeChips() {
 *   return (
 *     <Combobox items={["Ada", "Grace"]} multiple>
 *       <ComboboxChips>
 *         <ComboboxValue>
 *           {(value: ReadonlyArray<string>) =>
 *             value.map((assignee) => <ComboboxChip key={assignee}>{assignee}</ComboboxChip>)
 *           }
 *         </ComboboxValue>
 *         <ComboboxChipsInput aria-label="Assignees" placeholder="Add assignee..." />
 *       </ComboboxChips>
 *     </Combobox>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ComboboxChips({
  className,
  ...props
}: React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> & ComboboxPrimitive.Chips.Props) {
  return (
    <ComboboxPrimitive.Chips
      data-slot="combobox-chips"
      className={cn(
        "dark:bg-input/30 border-input focus-within:border-ring focus-within:ring-ring/50 has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40 has-aria-invalid:border-destructive dark:has-aria-invalid:border-destructive/50 flex min-h-8 flex-wrap items-center gap-1 rounded-lg border bg-transparent bg-clip-padding px-2.5 py-1 text-sm transition-colors focus-within:ring-[3px] has-aria-invalid:ring-[3px] has-data-[slot=combobox-chip]:px-1",
        className
      )}
      {...props}
    />
  );
}

/**
 * Removable selected value token for multi-select comboboxes.
 *
 * @example
 * ```tsx
 * import { ComboboxChip } from "@beep/ui/components/combobox"
 *
 * export function SelectedAssigneeChip() {
 *   return <ComboboxChip showRemove={false}>Ada</ComboboxChip>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ComboboxChip({
  className,
  children,
  showRemove = true,
  ...props
}: ComboboxPrimitive.Chip.Props & {
  readonly showRemove?: undefined | boolean;
}) {
  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      className={cn(
        "bg-muted text-foreground flex h-[calc(--spacing(5.25))] w-fit items-center justify-center gap-1 rounded-sm px-1.5 text-xs font-medium whitespace-nowrap has-data-[slot=combobox-chip-remove]:pr-0 has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {showRemove && (
        <ComboboxPrimitive.ChipRemove
          render={<Button variant="ghost" size="icon-xs" />}
          className="-ml-1 opacity-50 hover:opacity-100"
          data-slot="combobox-chip-remove"
        >
          <XIcon className="pointer-events-none" />
        </ComboboxPrimitive.ChipRemove>
      )}
    </ComboboxPrimitive.Chip>
  );
}

/**
 * Inline search input used inside a multi-select chip container.
 *
 * @example
 * ```tsx
 * import { ComboboxChipsInput } from "@beep/ui/components/combobox"
 *
 * export function AssigneeChipInput() {
 *   return <ComboboxChipsInput aria-label="Assignees" placeholder="Add assignee..." />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ComboboxChipsInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-chip-input"
      className={cn("min-w-16 flex-1 outline-none", className)}
      {...props}
    />
  );
}

/**
 * Stable ref for anchoring chip-mode combobox popups to the chips container.
 *
 * @remarks
 * Pass the returned ref to `ComboboxChips` and to `ComboboxContent`'s `anchor`
 * prop so the popup width and position follow the chip input surface.
 *
 * @example
 * ```tsx
 * import { Combobox, ComboboxChips, ComboboxChipsInput, ComboboxContent, useComboboxAnchor } from "@beep/ui/components/combobox"
 *
 * export function AnchoredChipCombobox() {
 *   const anchor = useComboboxAnchor()
 *   return (
 *     <Combobox items={["Ada", "Grace"]} multiple>
 *       <ComboboxChips ref={anchor}>
 *         <ComboboxChipsInput aria-label="Assignees" />
 *       </ComboboxChips>
 *       <ComboboxContent anchor={anchor} />
 *     </Combobox>
 *   )
 * }
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null);
}

/**
 * @category components
 * @since 0.0.0
 */
export {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
};
