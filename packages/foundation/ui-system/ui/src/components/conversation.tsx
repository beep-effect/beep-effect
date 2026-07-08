"use client";

import { ArrowDownIcon } from "@phosphor-icons/react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { cn } from "../lib/index.ts";
import { Button } from "./button";
import type React from "react";
import type { ComponentProps } from "react";

/**
 * Conversation props type.
 *
 * @example
 * ```ts
 * import type { ConversationProps } from "@beep/ui/components/conversation"
 *
 * const describe = (props: ConversationProps): string => props.className ?? "unstyled"
 *
 * console.log(typeof describe)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConversationProps = ComponentProps<typeof StickToBottom>;

/**
 * Conversation component.
 *
 * @example
 * ```tsx
 * import { Conversation } from "@beep/ui/components/conversation"
 *
 * console.log(Conversation)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const Conversation = ({ className, ...props }: ConversationProps) => (
  <StickToBottom
    className={cn("relative flex-1 overflow-y-auto", className)}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  />
);

/**
 * Conversation content props type.
 *
 * @example
 * ```ts
 * import type { ConversationContentProps } from "@beep/ui/components/conversation"
 *
 * const describe = (props: ConversationContentProps): string => props.className ?? "unstyled"
 *
 * console.log(typeof describe)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>;

/**
 * Conversation content component.
 *
 * @example
 * ```tsx
 * import { ConversationContent } from "@beep/ui/components/conversation"
 *
 * console.log(ConversationContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const ConversationContent = ({ className, ...props }: ConversationContentProps) => (
  <StickToBottom.Content className={cn("p-4", className)} {...props} />
);

/**
 * Conversation empty state props type.
 *
 * @example
 * ```ts
 * import type { ConversationEmptyStateProps } from "@beep/ui/components/conversation"
 *
 * const describe = (props: ConversationEmptyStateProps): string => props.className ?? "unstyled"
 *
 * console.log(describe({}))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConversationEmptyStateProps = Omit<ComponentProps<"div">, "title"> & {
  readonly title?: undefined | React.ReactNode;
  readonly description?: undefined | React.ReactNode;
  readonly icon?: undefined | React.ReactNode;
};

/**
 * Conversation empty state component.
 *
 * @example
 * ```tsx
 * import { ConversationEmptyState } from "@beep/ui/components/conversation"
 *
 * console.log(ConversationEmptyState)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn("flex size-full flex-col items-center justify-center gap-3 p-8 text-center", className)}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{title}</h3>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
      </>
    )}
  </div>
);

/**
 * Conversation scroll button props type.
 *
 * @example
 * ```ts
 * import type { ConversationScrollButtonProps } from "@beep/ui/components/conversation"
 *
 * const describe = (props: ConversationScrollButtonProps): string =>
 *   typeof props.className === "string" ? props.className : "unstyled"
 *
 * console.log(describe({}))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

/**
 * Conversation scroll button component.
 *
 * @example
 * ```tsx
 * import { ConversationScrollButton } from "@beep/ui/components/conversation"
 *
 * console.log(ConversationScrollButton)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const ConversationScrollButton = ({ className, ...props }: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  return (
    !isAtBottom && (
      <Button
        className={cn(
          "bg-background dark:bg-background absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full shadow-md",
          className
        )}
        onClick={() => void scrollToBottom()}
        size="icon"
        variant="outline"
        {...props}
      >
        <ArrowDownIcon className="size-4" />
      </Button>
    )
  );
};
