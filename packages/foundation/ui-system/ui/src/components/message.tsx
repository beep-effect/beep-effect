/**
 * Message primitive: a chat-message row layout with avatar and content slots.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { cn } from "@beep/ui/lib/utils";
import type * as React from "react";

/**
 * Message group component.
 *
 * @example
 * ```tsx
 * import { MessageGroup } from "@beep/ui/components/message"
 *
 * console.log(MessageGroup)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MessageGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="message-group" className={cn("flex min-w-0 flex-col gap-2", className)} {...props} />;
}

/**
 * Message component.
 *
 * @example
 * ```tsx
 * import { Message } from "@beep/ui/components/message"
 *
 * console.log(Message)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Message({ className, align = "start", ...props }: React.ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        "group/message relative flex w-full min-w-0 gap-2 text-sm data-[align=end]:flex-row-reverse",
        className
      )}
      {...props}
    />
  );
}

/**
 * Message avatar component.
 *
 * @example
 * ```tsx
 * import { MessageAvatar } from "@beep/ui/components/message"
 *
 * console.log(MessageAvatar)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MessageAvatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-avatar"
      className={cn(
        "flex w-fit min-w-8 shrink-0 items-center justify-center self-end overflow-hidden rounded-full bg-muted group-has-data-[slot=message-footer]/message:-translate-y-8",
        className
      )}
      {...props}
    />
  );
}

/**
 * Message content component.
 *
 * @example
 * ```tsx
 * import { MessageContent } from "@beep/ui/components/message"
 *
 * console.log(MessageContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "flex w-full min-w-0 flex-col gap-2.5 wrap-break-word group-data-[align=end]/message:*:data-slot:self-end",
        className
      )}
      {...props}
    />
  );
}

/**
 * Message header component.
 *
 * @example
 * ```tsx
 * import { MessageHeader } from "@beep/ui/components/message"
 *
 * console.log(MessageHeader)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-header"
      className={cn(
        "flex max-w-full min-w-0 items-center px-3 text-xs font-medium text-muted-foreground group-has-data-[variant=ghost]/message:px-0",
        className
      )}
      {...props}
    />
  );
}

/**
 * Message footer component.
 *
 * @example
 * ```tsx
 * import { MessageFooter } from "@beep/ui/components/message"
 *
 * console.log(MessageFooter)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MessageFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-footer"
      className={cn(
        "flex max-w-full min-w-0 items-center px-3 text-xs font-medium text-muted-foreground group-has-data-[variant=ghost]/message:px-0 group-data-[align=end]/message:justify-end",
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
export { Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup, MessageHeader };
