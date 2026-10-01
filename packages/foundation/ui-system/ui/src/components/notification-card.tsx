/**
 * Notification-card primitive: status, action-type, and action-style variants for a notification row.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { $UiId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import { ArrowRightIcon, CheckIcon, ClockIcon, SpinnerGapIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { DateTime, Effect, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { formatShortDate, toUtcDateTime } from "../lib/date-time.ts";
import { cn } from "../lib/index.ts";

const $I = $UiId.create("components/notification-card");

const NotificationStatus = LiteralKit(["unread", "read", "archived"]).pipe(
  $I.annoteSchema("NotificationStatus", {
    description: "The status of a notification",
  })
);

/**
 * Notification status type.
 *
 * **Example** (Assign unread status)
 *
 * ```ts
 * import type { NotificationStatus } from "@beep/ui/components/notification-card"
 *
 * const status: NotificationStatus = "unread"
 *
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type NotificationStatus = typeof NotificationStatus.Type;

/**
 * Action type component.
 *
 * **Example** (Log ActionType value)
 *
 * ```tsx
 * import { ActionType } from "@beep/ui/components/notification-card"
 *
 * console.log(ActionType)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const ActionType = LiteralKit(["redirect", "api_call", "workflow", "modal"]).pipe(
  $I.annoteSchema("ActionType", {
    description: "The type of action to perform",
  })
);

/**
 * Action type type.
 *
 * **Example** (Assign redirect action)
 *
 * ```ts
 * import type { ActionType } from "@beep/ui/components/notification-card"
 *
 * const actionType: ActionType = "redirect"
 *
 * console.log(actionType)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ActionType = typeof ActionType.Type;

/**
 * Action style theme value.
 *
 * **Example** (Log ActionStyle value)
 *
 * ```tsx
 * import { ActionStyle } from "@beep/ui/components/notification-card"
 *
 * console.log(ActionStyle)
 * ```
 *
 * @category themes
 * @since 0.0.0
 */
export const ActionStyle = LiteralKit(["primary", "danger", "default"]).pipe(
  $I.annoteSchema("ActionStyle", {
    description: "The style of the action button",
  })
);
/**
 * Action style type.
 *
 * **Example** (Assign primary style)
 *
 * ```ts
 * import type { ActionStyle } from "@beep/ui/components/notification-card"
 *
 * const actionStyle: ActionStyle = "primary"
 *
 * console.log(actionStyle)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ActionStyle = typeof ActionStyle.Type;

const defaultActionStyleClassName = "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground";

const actionStyleClassName = ActionStyle.$match({
  primary: () => "bg-info/10 text-info-text hover:bg-info/20",
  danger: () => "bg-destructive/10 text-destructive hover:bg-destructive/20",
  default: () => defaultActionStyleClassName,
});

const NotificationActionFields = {
  executed: S.OptionFromOptionalKey(S.Boolean).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    $I.annoteKey("NotificationAction.executed", {
      description: "Optional completion state projected to false by the notification renderer.",
    })
  ),
  id: S.NonEmptyString.pipe(
    $I.annoteKey("NotificationAction.id", {
      description: "Stable non-empty action identifier used for callbacks and loading state.",
    })
  ),
  label: S.NonEmptyString.pipe(
    $I.annoteKey("NotificationAction.label", {
      description: "Human-readable non-empty action button label.",
    })
  ),
  style: S.OptionFromOptionalKey(ActionStyle).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    $I.annoteKey("NotificationAction.style", {
      description: "Optional visual button style projected to default by the notification renderer.",
    })
  ),
};

/**
 * Notification action component.
 *
 * **Example** (Log NotificationAction value)
 *
 * ```tsx
 * import { NotificationAction } from "@beep/ui/components/notification-card"
 *
 * console.log(NotificationAction)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const NotificationAction = ActionType.toTaggedUnion("type")({
  redirect: NotificationActionFields,
  api_call: NotificationActionFields,
  workflow: NotificationActionFields,
  modal: NotificationActionFields,
}).pipe(
  $I.annoteSchema("NotificationAction", {
    description: "An action to perform on a notification",
  })
);

/**
 * Notification action type.
 *
 * **Example** (Extract action type field)
 *
 * ```ts
 * import type { NotificationAction } from "@beep/ui/components/notification-card"
 *
 * const describe = (action: NotificationAction): NotificationAction["type"] => action.type
 *
 * console.log(typeof describe)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type NotificationAction = typeof NotificationAction.Type;

const actionIcon = (action: NotificationAction) =>
  NotificationAction.match(action, {
    redirect: () => <ArrowRightIcon size={12} weight="bold" />,
    api_call: () => <CheckIcon size={12} weight="bold" />,
    workflow: () => <ClockIcon size={12} weight="bold" />,
    modal: () => <WarningCircleIcon size={12} weight="bold" />,
  });

interface NotificationCardProps {
  readonly actions?: undefined | NotificationAction[];
  readonly body: string;
  readonly className?: undefined | string;
  readonly createdAt?: undefined | Date | string;
  readonly id: string;
  readonly loadingActionId?: undefined | string;
  readonly onAction?: undefined | ((notificationId: string, actionId: string, actionType: ActionType) => void);
  readonly onMarkAsRead?: undefined | ((id: string) => void);
  readonly status?: undefined | NotificationStatus;
  readonly title: string;
}

const formatDate = (date: Date | string): string => {
  const parsed = toUtcDateTime(date);
  const now = DateTime.nowUnsafe();
  const diffMs = DateTime.toEpochMillis(now) - DateTime.toEpochMillis(parsed);
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatShortDate(parsed);
};

/**
 * Notification card component.
 *
 * **Example** (Log NotificationCard value)
 *
 * ```tsx
 * import { NotificationCard } from "@beep/ui/components/notification-card"
 *
 * console.log(NotificationCard)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function NotificationCard({
  id,
  title,
  body,
  status = "unread",
  createdAt,
  actions = [],
  onMarkAsRead,
  onAction,
  loadingActionId,
  className,
}: NotificationCardProps) {
  const isUnread = status === "unread";

  return (
    <div
      className={cn(
        "group relative w-full rounded-2xl transition-all",
        isUnread ? "bg-muted" : "bg-muted/50",
        className
      )}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3
                className={cn(
                  "text-sm-plus font-semibold leading-tight",
                  isUnread ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {title}
              </h3>
              {isUnread && <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-info" />}
            </div>

            <p className={cn("mb-0 text-xs-plus", isUnread ? "text-muted-foreground" : "text-muted-foreground/70")}>
              {body}
            </p>
          </div>

          {isUnread && onMarkAsRead && (
            <button
              type="button"
              onClick={() => onMarkAsRead(id)}
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              aria-label="Mark as read"
            >
              <CheckIcon size={16} weight="bold" />
            </button>
          )}
        </div>

        <div className="mt-3 flex items-end justify-between">
          {actions.length > 0 && (
            <div className={cn("flex flex-wrap items-center gap-2", !isUnread && "opacity-60")}>
              {A.map(actions, (action) => {
                const isLoading = loadingActionId === action.id;
                const isExecuted = pipe(
                  action.executed,
                  O.getOrElse(() => false)
                );
                const showLoading = isLoading && action.type !== "modal";

                return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={isLoading || isExecuted}
                    onClick={() => onAction?.(id, action.id, action.type)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-normal transition",
                      pipe(
                        action.style,
                        O.map(actionStyleClassName),
                        O.getOrElse(() => defaultActionStyleClassName)
                      ),
                      showLoading && "opacity-50",
                      isExecuted && "cursor-not-allowed opacity-60"
                    )}
                  >
                    {showLoading ? (
                      <SpinnerGapIcon size={12} className="animate-spin" />
                    ) : (
                      <>
                        <span>{action.label}</span>
                        {isExecuted ? <CheckIcon size={12} weight="bold" /> : actionIcon(action)}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {createdAt && <span className="inline-block text-2xs text-muted-foreground/70">{formatDate(createdAt)}</span>}
        </div>
      </div>
    </div>
  );
}
