/**
 * Attachment primitive: a file-attachment shell with state, size, and orientation styling hooks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Button } from "@beep/ui/components/button";
import { cn } from "@beep/ui/lib/utils";
import { P } from "@beep/utils";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

const attachmentVariants = cva(
  "group/attachment relative flex w-fit max-w-full min-w-0 shrink-0 flex-wrap rounded-xl border bg-card text-card-foreground transition-colors focus-within:ring-1 focus-within:ring-ring/50 has-[>a,>button]:hover:bg-muted/50 data-[state=error]:border-destructive/30 data-[state=idle]:border-dashed",
  {
    variants: {
      size: {
        default:
          "gap-2 text-sm has-data-[slot=attachment-content]:px-2.5 has-data-[slot=attachment-content]:py-2 has-data-[slot=attachment-media]:p-2",
        sm: "gap-2.5 text-xs has-data-[slot=attachment-content]:px-2 has-data-[slot=attachment-content]:py-1.5 has-data-[slot=attachment-media]:p-1.5",
        xs: "gap-1.5 rounded-lg text-xs has-data-[slot=attachment-content]:px-1.5 has-data-[slot=attachment-content]:py-1 has-data-[slot=attachment-media]:p-1",
      },
      orientation: {
        horizontal: "min-w-40 items-center",
        vertical: "w-24 flex-col has-data-[slot=attachment-content]:w-30",
      },
    },
  }
);

/**
 * File attachment shell with state, size, and orientation styling hooks.
 *
 * @example
 * ```tsx
 * import { Attachment, AttachmentContent, AttachmentDescription, AttachmentTitle } from "@beep/ui/components/attachment"
 *
 * export function UploadedInvoiceAttachment() {
 *   return (
 *     <Attachment state="done" size="sm" orientation="horizontal">
 *       <AttachmentContent>
 *         <AttachmentTitle>invoice-q2.pdf</AttachmentTitle>
 *         <AttachmentDescription>248 KB</AttachmentDescription>
 *       </AttachmentContent>
 *     </Attachment>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Attachment({
  className,
  state = "done",
  size = "default",
  orientation = "horizontal",
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof attachmentVariants> & {
    state?: "idle" | "uploading" | "processing" | "error" | "done";
  }) {
  return (
    <div
      data-slot="attachment"
      data-state={state}
      data-size={size}
      data-orientation={orientation}
      className={cn(attachmentVariants({ size, orientation }), className)}
      {...props}
    />
  );
}

const attachmentMediaVariants = cva(
  "relative flex aspect-square w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-foreground group-data-[orientation=vertical]/attachment:w-full group-data-[size=sm]/attachment:w-8 group-data-[size=xs]/attachment:w-7 group-data-[size=xs]/attachment:rounded-md group-data-[state=error]/attachment:bg-destructive/10 group-data-[state=error]/attachment:text-destructive group-data-[orientation=vertical]/attachment:*:data-[slot=spinner]:size-6! [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 group-data-[orientation=vertical]/attachment:[&_svg:not([class*='size-'])]:size-6 group-data-[size=xs]/attachment:[&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        icon: "",
        image:
          "opacity-60 group-data-[state=done]/attachment:opacity-100 group-data-[state=idle]/attachment:opacity-100 *:[img]:aspect-square *:[img]:w-full *:[img]:object-cover",
      },
    },
    defaultVariants: {
      variant: "icon",
    },
  }
);

/**
 * Media slot for an attachment icon, spinner, or thumbnail image.
 *
 * @example
 * ```tsx
 * import { Attachment, AttachmentMedia } from "@beep/ui/components/attachment"
 *
 * export function AttachmentPreview() {
 *   return (
 *     <Attachment orientation="vertical">
 *       <AttachmentMedia variant="image">
 *         <img src="/files/receipt.png" alt="Receipt preview" />
 *       </AttachmentMedia>
 *     </Attachment>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AttachmentMedia({
  className,
  variant = "icon",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof attachmentMediaVariants>) {
  return (
    <div
      data-slot="attachment-media"
      data-variant={variant}
      className={cn(attachmentMediaVariants({ variant }), className)}
      {...props}
    />
  );
}

/**
 * Text column for attachment titles and descriptions.
 *
 * @example
 * ```tsx
 * import { AttachmentContent, AttachmentDescription, AttachmentTitle } from "@beep/ui/components/attachment"
 *
 * export function AttachmentSummary() {
 *   return (
 *     <AttachmentContent>
 *       <AttachmentTitle>contract.pdf</AttachmentTitle>
 *       <AttachmentDescription>Processing scan</AttachmentDescription>
 *     </AttachmentContent>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AttachmentContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="attachment-content"
      className={cn(
        "max-w-full min-w-0 flex-1 leading-tight group-data-[orientation=vertical]/attachment:px-1",
        className
      )}
      {...props}
    />
  );
}

/**
 * Truncated primary label for an attachment.
 *
 * @example
 * ```tsx
 * import { AttachmentTitle } from "@beep/ui/components/attachment"
 *
 * export function AttachmentFileName() {
 *   return <AttachmentTitle>signed-engagement-letter.pdf</AttachmentTitle>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AttachmentTitle({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="attachment-title"
      className={cn(
        "block max-w-full min-w-0 truncate font-medium group-data-[state=processing]/attachment:shimmer group-data-[state=uploading]/attachment:shimmer",
        className
      )}
      {...props}
    />
  );
}

/**
 * Secondary attachment metadata such as size, status, or error text.
 *
 * @example
 * ```tsx
 * import { AttachmentDescription } from "@beep/ui/components/attachment"
 *
 * export function AttachmentUploadStatus() {
 *   return <AttachmentDescription>Uploading 62%</AttachmentDescription>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AttachmentDescription({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="attachment-description"
      className={cn(
        "mt-0.5 block min-w-0 truncate text-xs text-muted-foreground group-data-[state=error]/attachment:text-destructive/80",
        "max-w-full",
        className
      )}
      {...props}
    />
  );
}

/**
 * Action cluster positioned inside an attachment.
 *
 * @example
 * ```tsx
 * import { AttachmentAction, AttachmentActions } from "@beep/ui/components/attachment"
 *
 * export function AttachmentMenuActions() {
 *   return (
 *     <AttachmentActions>
 *       <AttachmentAction aria-label="Download attachment">Download</AttachmentAction>
 *       <AttachmentAction aria-label="Remove attachment" variant="ghost">Remove</AttachmentAction>
 *     </AttachmentActions>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AttachmentActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="attachment-actions"
      className={cn(
        "relative z-20 flex shrink-0 items-center group-data-[orientation=vertical]/attachment:absolute group-data-[orientation=vertical]/attachment:top-3 group-data-[orientation=vertical]/attachment:right-3 group-data-[orientation=vertical]/attachment:gap-1",
        className
      )}
      {...props}
    />
  );
}

/**
 * Button styled for attachment-level commands.
 *
 * @example
 * ```tsx
 * import { AttachmentAction } from "@beep/ui/components/attachment"
 *
 * export function RemoveAttachmentAction() {
 *   return (
 *     <AttachmentAction variant="ghost" size="icon-xs" aria-label="Remove attachment">
 *       Remove
 *     </AttachmentAction>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AttachmentAction({ className, variant, size = "icon-xs", ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="attachment-action"
      variant={variant ?? "ghost"}
      size={size}
      className={cn(className)}
      {...props}
    />
  );
}

/**
 * Full-surface button overlay for making an attachment clickable.
 *
 * @example
 * ```tsx
 * import { Attachment, AttachmentTrigger } from "@beep/ui/components/attachment"
 *
 * export function OpenableAttachment() {
 *   return (
 *     <Attachment>
 *       <AttachmentTrigger aria-label="Open attachment" />
 *     </Attachment>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AttachmentTrigger({ className, render, type, ...props }: useRender.ComponentProps<"button">) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        type: P.isNotNullish(render) ? type : (type ?? "button"),
        className: cn("absolute inset-0 z-10 outline-none", className),
      },
      props
    ),
    render,
    state: {
      slot: "attachment-trigger",
    },
  });
}

/**
 * Horizontally scrollable group of attachment cards.
 *
 * @example
 * ```tsx
 * import { Attachment, AttachmentContent, AttachmentGroup, AttachmentTitle } from "@beep/ui/components/attachment"
 *
 * export function AttachmentTray() {
 *   return (
 *     <AttachmentGroup>
 *       <Attachment size="xs">
 *         <AttachmentContent>
 *           <AttachmentTitle>tax-return.pdf</AttachmentTitle>
 *         </AttachmentContent>
 *       </Attachment>
 *       <Attachment size="xs">
 *         <AttachmentContent>
 *           <AttachmentTitle>w2.pdf</AttachmentTitle>
 *         </AttachmentContent>
 *       </Attachment>
 *     </AttachmentGroup>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AttachmentGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="attachment-group"
      className={cn(
        "flex min-w-0 scroll-fade-x snap-x snap-mandatory scroll-px-1 scrollbar-none gap-3 overflow-x-auto overscroll-x-contain py-1 *:data-[slot=attachment]:flex-none *:data-[slot=attachment]:snap-start",
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
export {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
};
